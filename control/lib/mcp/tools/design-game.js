/**
 * design_game — the rail in front of the game tools. A gameworld (the game book's recipe: its levels, its hero, its
 * gear, its systems) is a `gameworld` sketch; this door writes it, takes the creator's verdicts on its parts, and RUNS
 * it: every step that is ready is made through the same handlers an agent would call (the hero through the hero door,
 * the gear through the equipment door, the systems world through create_sketch), at refs derived from the gameworld's
 * own, and recorded in its `made` (gameworld/made.js). A run with nothing changed makes nothing; what the creator edited
 * by hand since a run is left as it is unless `force`. Its answer is the readout: each part's stamp, which steps may
 * start, what was made, and the next moves. The bible is the sketch page's (`/api/sketches/<ref>/bible`).
 *
 * In one call, in order: the recipe (`world` creates or replaces it, `patch` edits it by part), then the verdicts
 * (`approve`, `revise`), then the run (`run: true`). Each is optional; a call with only `ref` reads.
 */
import { registerTool } from '@/lib/mcp/server';
import { RENDER_TOOL_TIMEOUT_MS } from '@/lib/mcp/telemetry';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { mintSolidHandler } from './mint-solid.js';
import { createGameHandler } from './create-game.js';
import { heroRecord } from './layered.js';
import { LAWS_VERSION } from '@/lib/graph/equipment/expand.js';
import {
  GAMEWORLD_KIND, isGameworldKind, gameworldOf, readGameworld, resolveBook, reviewState, approve as approveWorldPart, reviewParts,
  characterState, characterReady, approveCharacter, CHARACTER_PART_IDS, fingerprint, pinBase, revisionLookup, runSteps, decide, childRef, storyReport,
} from '@/lib/graph/gameworld/index';
import { sameness, grounding, authorship, compareWorlds, REFERENCES } from '@/lib/graph/gameworld/advice.js';
import { quickWorld } from '@/lib/graph/gameworld/quick.js';


const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** The lookup a pinned base is verified with: the hero's row and its archive. */
function heroLookup(heroRef) {
  const row = SketchRepository.getByRef(heroRef);
  if (!row) return () => null;
  const headRev = (SketchRevisionRepository.head(heroRef)?.rev ?? 0) + 1;
  return revisionLookup({ ref: heroRef, headRev, head: row.manifest, get: (r, rev) => SketchRevisionRepository.get(r, rev)?.manifest ?? null });
}

const storedPrint = (ref) => { const row = SketchRepository.getByRef(ref); return row ? fingerprint(row.manifest) : null; };
const headRev = (ref) => (SketchRevisionRepository.head(ref)?.rev ?? 0) + 1;

/** The world with the hero's base pinned (the looks page holds the pin). */
function withPin(world, pin) {
  const hero = world.characters.hero ?? {};
  return { ...world, characters: { ...world.characters, hero: { ...hero, looks: { ...(hero.looks ?? {}), base: pin } } } };
}

/** Make or remake one step; → the record to keep. */
async function realize(step, action) {
  const { key, ref, order } = step;
  if (key === 'hero') {
    if (action === 'make') await mintSolidHandler({ ...order.mint, ref });
    else await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/hero', value: heroRecord(order.spec) }], note: 'design_game: the book\'s base' });
    // the base is the revision as made: pinned before the motion branches from it
    const pin = pinBase({ ref, rev: headRev(ref), manifest: SketchRepository.getByRef(ref).manifest });
    if (order.motion) await updateSketchHandler({ ref, patch: order.motion, note: 'design_game: the motion page' });
    return { pin };
  }
  if (key.startsWith('cast-')) {
    // a cast member: made as the hero is (the book's base, then its motion), without a pin
    if (action === 'make') await mintSolidHandler({ ...order.mint, ref });
    else await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/hero', value: heroRecord(order.spec) }], note: 'design_game: a cast member' });
    if (order.motion) await updateSketchHandler({ ref, patch: order.motion, note: 'design_game: a cast member\'s motion' });
    return {};
  }
  if (key === 'hero-equipped') {
    if (action === 'make') await mintSolidHandler({ ...order.mint, ref });
    else await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/hero', value: heroRecord(order.spec) }], note: 'design_game: the hero equipped' });
    return {};
  }
  if (key.startsWith('level-')) {
    // a stage as a level: create_sketch at mint, its manifest whole in place
    if (action === 'make') await createSketchHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title: order.title, manifest: order.manifest });
    return {};
  }
  if (key === 'game') {
    // the game over the levels: create_game (the levels unaudited, recorded), its manifest whole in place
    const { title, store, levels, links, theme, shell } = order;
    if (action === 'make') await createGameHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title, manifest: { kind: 'game', title, store, levels, ...(links ? { links } : {}), ...(theme ? { theme } : {}), ...(shell ? { shell } : {}) } });
    return {};
  }
  if (key === 'systems') {
    if (action === 'make') await createSketchHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title: order.title, manifest: order.manifest });
    return {};
  }
  // gear: the equipment door at mint; in place, the build it would store (stamped with the laws, as the door does)
  if (action === 'make') await mintSolidHandler({ ...order, ref });
  else await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/build', value: { type: 'equipment', ...order.spec, laws: LAWS_VERSION } }, { op: 'set', path: '/title', value: order.title }] });
  return {};
}

/** Run the world stored at `ref`: every ready step made, remade or kept; → { world, ran } (world with its new record). */
async function runWorld(ref, world, { force = false } = {}) {
  let W = world;
  const made = { ...(W.made ?? {}) }, ran = [];
  const act = async (step, lookup) => {
    const action = decide(step, made[step.key], storedPrint(step.ref), { force });
    ran.push({ key: step.key, ref: step.ref, action, ...(step.waiting ? { waiting: step.waiting.map((w) => `${w.id} (${w.status})`) } : {}) });
    if (action !== 'make' && action !== 'remake') return;
    const { pin } = await realize(step, action);
    made[step.key] = { ref: step.ref, order: step.print, stored: storedPrint(step.ref) };
    if (pin && W.characters) W = withPin(W, pin);   // a quick game's hero has no book to pin it in
  };
  // the hero first: the systems and the gear wait on its pinned base
  const heroRef = childRef(ref, 'hero');
  const first = runSteps(W, { ref, lookup: heroLookup(heroRef) });
  if (!first.length) return { world: W, ran };
  await act(first[0]);
  for (const step of runSteps(W, { ref, lookup: heroLookup(heroRef) }).slice(1)) await act(step);
  return { world: Object.keys(made).length ? { ...W, made } : W, ran };
}

/** Each part's stamp, the steps, what was made, and what to do next. */
function readout(ref, world) {
  const lookup = world.characters ? heroLookup(childRef(ref, 'hero')) : undefined;
  const stamps = [...reviewState(world), ...(world.characters ? characterState(world, { lookup }) : [])];
  const parts = stamps.map((s) => ({ id: s.id, status: s.status, ...(s.machine?.length ? { advises: s.machine } : {}), ...(s.note ? { note: s.note } : {}) }));
  const steps = world.characters ? characterReady(world, { state: stamps.filter((s) => CHARACTER_PART_IDS.includes(s.id)) }) : null;
  const made = Object.fromEntries(Object.entries(world.made ?? {}).map(([k, v]) => [k, v.ref]));
  // the next moves as step ids: what each means is the gameworld-next card (get_game_vocab),
  // read once, not re-said on every call
  const mode = world.mode ?? 'gated', next = [];
  const open = parts.filter((p) => p.status === 'proposed' || p.status === 'changed' || p.status === 'revise');
  if (mode === 'gated' && open.length) next.push({ step: 'review', parts: open.map((p) => p.id), card: 'gameworld-next' });
  if (mode === 'autonomous' && parts.some((p) => p.status === 'revise')) next.push({ step: 'advised', parts: parts.filter((p) => p.status === 'revise').map((p) => p.id), card: 'gameworld-next' });
  if (world.made?.game) {
    // the game as a player gets it, and the playtest: every level open, nothing saved, `?level=<ref>` for one
    const game = encodeURIComponent(world.made.game.ref);
    next.push({ step: 'play', url: `/api/sketches/${game}/game`, playtest: `/api/sketches/${game}/playtest`, gate: 'eyes', card: 'gameworld-next' });
  }
  if (world.characters) next.push({ step: world.made?.hero ? 'rerun' : 'run', card: 'gameworld-next' });
  if (world.characters?.hero?.actions && !world.characters.hero.adornment) next.push({ step: 'adornment', path: '/characters/hero/adornment', card: 'gameworld-adornment' });
  if (steps) for (const [k, s] of Object.entries(steps)) if (!s.ready) next.push({ step: 'wait', on: k, waiting: s.waiting.map((w) => `${w.id} (${w.status})`), card: 'gameworld-next' });
  // the numbers the systems derive, readable without the bible (the sheet needs a browser)
  const M = world.characters ? resolveBook(world).mechanics : null, S = M?.play.stats;
  const numbers = S ? {
    stats: Object.fromEntries(S.stats.map((x) => [x.id, x.base ?? x.value ?? null])),
    ...(S.resources?.length ? { resources: Object.fromEntries(S.resources.map((r) => [r.id, r.cap ?? r.start ?? null])) } : {}),
    ...(S.level ? { level: { max: S.level.max, each: S.level.each?.raise ?? null } } : {}),
    ...(S.epochs?.length ? { epochs: Object.fromEntries(S.epochs.map((e) => [e.id, e.level ?? 1])) } : {}),
    powers: M.powers.map((p) => ({ id: p.id, ...(p.key ? { key: p.key } : {}), ...(p.spends ? { spends: p.spends } : {}), ...(p.look ? { shows: p.look } : {}) })),
    hud: (M.play.parts ?? []).map((p) => p.id ?? p.kind),
  } : null;
  // the story as it binds to the world now: a moment that lost its place says what is missing (the world still builds)
  const told = world.story || world.quests ? storyReport(world, { ref }) : null;
  if (told?.unplaced.length) next.push({ step: 'story', unplaced: told.unplaced, card: 'gameworld-story' });
  // the advice: measured, never a verdict on the design
  const same = sameness(world), questions = grounding(world), own = authorship(world);
  const advice = { authorship: own.line, ...(same.length ? { sameness: same } : {}), ...(questions.length ? { questions } : {}) };
  if (same.length || questions.length) next.push({ step: 'advice', card: 'gameworld-next' });
  return { ref, url: `/sketches/${encodeURIComponent(ref)}`, advice, ...(numbers ? { numbers } : {}), bible: `/api/sketches/${encodeURIComponent(ref)}/bible`, mode, parts, ...(steps ? { steps: Object.fromEntries(Object.entries(steps).map(([k, s]) => [k, s.ready ? 'ready' : 'waiting'])) } : {}), ...(Object.keys(made).length ? { made } : {}), ...(told ? { story: { bound: told.bound.length, unplaced: told.unplaced.length, ...(told.unset?.length ? { unset: told.unset } : {}) } } : {}), next };
}

/** The verdicts as the review to write. */
function reviewWith(world, { approve, revise, note }) {
  let review = { ...(world.review ?? {}) }, W = world;
  const worldIds = reviewParts(world).map((p) => p.id);
  for (const part of list(approve)) {
    if (typeof part !== 'string') throw new Error('design_game: approve is a part id or a list of them');
    if (CHARACTER_PART_IDS.includes(part)) review = approveCharacter(W, part, note);
    else if (worldIds.includes(part)) review = approveWorldPart(W, part, note);
    else throw new Error(`design_game: '${part}' is not a part (parts: ${[...worldIds, ...(world.characters ? CHARACTER_PART_IDS : [])].join(', ')})`);
    W = { ...W, review };
  }
  for (const r of list(revise)) {
    if (!isObj(r) || typeof r.part !== 'string' || typeof r.note !== 'string' || !r.note.trim()) throw new Error('design_game: revise is { part, note }: the part sent back and what to change');
    if (!CHARACTER_PART_IDS.includes(r.part) && !worldIds.includes(r.part)) throw new Error(`design_game: '${r.part}' is not a part`);
    review = { ...review, [r.part]: { status: 'revise', note: r.note.trim() } };
  }
  return review;
}

export async function designGameHandler(input) {
  if (!isObj(input)) throw new Error('design_game takes { ref?, title?, world?, patch?, approve?, revise?, note?, run?, force?, example?, compare? }');
  const { ref: given, title, world: written, patch, approve, revise, note, run: asked, force, example, compare, quick, readout: shape } = input;
  if (shape !== undefined && shape !== 'full' && shape !== 'changed') throw new Error("design_game: readout is 'full' (the default) or 'changed'");
  // the world as it stood before this call, for readout: 'changed'
  const prior = given ? SketchRepository.getByRef(given) : null;
  const before = prior && isGameworldKind(prior.manifest?.kind) ? gameworldOf(prior.manifest) : null;
  // the quick path: one level, one goal; its gameworld is written here, and it is run at once (nothing to review)
  if (quick !== undefined && written !== undefined) throw new Error('design_game: `quick` writes the world itself; pass the world\'s own settings (id, name, style …) beside the goal as quick.world, or a whole `world` without quick');
  const world = quick !== undefined ? quickWorld({ ...(isObj(quick.world) ? quick.world : {}), quick: Object.fromEntries(Object.entries(quick).filter(([k]) => k !== 'world')) }) : written;
  const run = asked ?? (quick !== undefined ? true : undefined);
  // a reference, made on request (the creator asked to see one): a gameworld of its own, never mixed into theirs
  if (example !== undefined) {
    if (!REFERENCES[example]) throw new Error(`design_game: example is one of ${Object.keys(REFERENCES).join(', ')} (a reference made only when the creator asks to see one)`);
    if (world !== undefined || patch !== undefined || given !== undefined) throw new Error('design_game: an example is made on its own, at its own ref; it takes no world, patch or ref');
    const at = `example-${example}`;
    const out = SketchRepository.getByRef(at) ? await designGameHandler({ ref: at, run }) : await designGameHandler({ world: REFERENCES[example], ref: at, title: `Reference example: ${REFERENCES[example].name}`, run });
    return { ...out, example: `a reference, made because it was asked for: compare your own world with it after you have made yours (design_game({ ref, compare: '${example}' })), never as a start` };
  }
  if (world !== undefined && patch !== undefined) throw new Error('design_game: `world` replaces the recipe whole, `patch` edits it by part: one or the other');
  let ref = given;
  // the recipe
  if (world !== undefined) {
    if (!isObj(world)) throw new Error('design_game: world is the gameworld recipe { id, name?, levels, characters?, equipment?, mechanics?, mode?, brief? … }');
    const manifest = { kind: GAMEWORLD_KIND, ...world };
    const exists = ref && SketchRepository.getByRef(ref);
    if (exists) {
      if (!isGameworldKind(exists.manifest?.kind)) throw new Error(`design_game: '${ref}' is a '${exists.manifest?.kind}', not a gameworld`);
      // the runner's record stays with the recipe unless the new one brings its own; the same recipe again writes nothing
      const next = world.made === undefined && exists.manifest.made ? { ...manifest, made: exists.manifest.made } : manifest;
      if (JSON.stringify(next) !== JSON.stringify(exists.manifest) || (title && title !== exists.title)) {
        await updateSketchHandler({ ref, ...(title ? { title } : {}), manifest: next });
      }
    } else {
      ref = (await createSketchHandler({ title: title ?? world.name ?? world.id, manifest, ...(ref ? { ref } : {}) })).ref;
    }
  } else {
    if (!ref) throw new Error('design_game: name the gameworld (`ref`), or give a `world` to start one');
    const row = SketchRepository.getByRef(ref);
    if (!row) throw new Error(`design_game: no sketch at '${ref}'`);
    if (!isGameworldKind(row.manifest?.kind)) throw new Error(`design_game: '${ref}' is a '${row.manifest?.kind}', not a gameworld`);
    if (patch !== undefined) await updateSketchHandler({ ref, patch, ...(title ? { title } : {}) });
  }
  try {
    return await afterWrite(ref, { approve, revise, note, run, force, compare, before, shape });
  } catch (err) {
    // the recipe is stored; the call failed after it: say where, so the next call fixes it in place
    throw new Error(`${err.message}\n— the gameworld is stored at '${ref}' as written; fix it with design_game({ ref: '${ref}', patch }) rather than starting a new one.`);
  }
}

async function afterWrite(ref, { approve, revise, note, run, force, compare, before, shape }) {
  let W = gameworldOf(SketchRepository.getByRef(ref).manifest);
  // the verdicts
  if (approve !== undefined || revise !== undefined) {
    const review = reviewWith(W, { approve, revise, note });
    // a verdict the world already holds writes nothing
    if (JSON.stringify(review) !== JSON.stringify(W.review ?? {})) {
      await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/review', value: review }] });
      W = { ...W, review };
    }
  }
  // the run
  let ran;
  if (run) {
    readGameworld(W);
    const out = await runWorld(ref, W, { force: !!force });
    ran = out.ran;
    // a run that made and remade nothing writes nothing: no revision, no new head
    if (JSON.stringify(out.world) !== JSON.stringify(W)) {
      await updateSketchHandler({ ref, manifest: { kind: GAMEWORLD_KIND, ...out.world } });
      W = out.world;
    }
  }
  // the comparison, after creation only: a world that has made nothing has nothing of its own to compare
  let comparison;
  if (compare !== undefined) {
    if (!REFERENCES[compare]) throw new Error(`design_game: compare is one of ${Object.keys(REFERENCES).join(', ')}`);
    if (!W.made?.hero) throw new Error('design_game: compare after you have made your own world (run it first): a reference read before the design is a template, and this one is not');
    comparison = { reference: compare, ...compareWorlds(W, REFERENCES[compare]) };
  }
  const full = readout(ref, W);
  if (shape !== 'changed') return { ok: true, ...full, ...(ran ? { ran } : {}), ...(comparison ? { comparison } : {}) };
  return { ok: true, readout: 'changed', ...changedOnly(full, before ? readout(ref, before) : null), ...(ran ? { ran: ran.filter((r) => r.action !== 'keep' && r.action !== 'waiting') } : {}), ...(comparison ? { comparison } : {}) };
}

// readout: 'changed': the parts whose stamp moved since the call began, any other section that differs, and the next
// moves (always: they are what to do now). A new world has no before, so every part is new.
function changedOnly(full, prev) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const prevParts = new Map((prev?.parts ?? []).map((p) => [p.id, p]));
  const out = { ref: full.ref, url: full.url, parts: full.parts.filter((p) => !same(p, prevParts.get(p.id))) };
  for (const k of ['advice', 'numbers', 'steps', 'made', 'mode']) if (full[k] !== undefined && !same(full[k], prev?.[k])) out[k] = full[k];
  return { ...out, next: full.next };
}

export function registerDesignGameTools() {
  registerTool({
    name: 'design_game',
    // a run mints the hero, the systems world and the gear in one call
    timeoutMs: RENDER_TOOL_TIMEOUT_MS,
    description:
      'The GAME rail: design a game top down and let mojulo make it. A gameworld (levels, a hero, its gear, the systems) is '
      + 'a sketch; this writes it (`world`, `patch`), takes the creator\'s verdicts (`approve`, `revise` { part, note }) and, '
      + 'with `run: true`, makes every ready step through the real doors, keeping what did not move and leaving hand edits '
      + '(`force` overwrites). Answers each part\'s stamp, the steps, what was made, the advice, the next moves as step ids '
      + '(`readout: \'changed\'` for only what moved). Read '
      + 'get_game_vocab({ id: \'gameworld-guide\' }) first. `example` makes a reference only when the creator asks; '
      + '`compare` reads one against a world once made.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string' },
        title: { type: 'string' },
        world: { type: 'object', description: 'The recipe (get_game_vocab).' },
        patch: { type: 'array', items: { type: 'object' }, description: 'JSON Pointer ops.' },
        approve: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Part id(s).' },
        revise: { type: 'object', description: '{ part, note }' },
        note: { type: 'string' },
        run: { type: 'boolean' },
        force: { type: 'boolean' },
        example: { type: 'string' },
        compare: { type: 'string' },
        readout: { type: 'string', enum: ['full', 'changed'] },
        quick: { type: 'object', description: 'One level, one goal (gameworld-quick).' },
      },
      required: [],
    },
    handler: designGameHandler,
  });
}
