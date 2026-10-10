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
import { heroRecord } from './layered.js';
import { LAWS_VERSION } from '@/lib/graph/equipment/expand.js';
import {
  GAMEWORLD_KIND, isGameworldKind, gameworldOf, readGameworld, reviewState, approve as approveWorldPart, reviewParts,
  characterState, characterReady, approveCharacter, CHARACTER_PART_IDS, fingerprint, pinBase, revisionLookup, runSteps, decide, childRef,
} from '@/lib/graph/gameworld/index';
import { sameness, grounding, authorship, compareWorlds, REFERENCES } from '@/lib/graph/gameworld/advice.js';


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
    if (pin) W = withPin(W, pin);
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
  const mode = world.mode ?? 'gated', next = [];
  const open = parts.filter((p) => p.status === 'proposed' || p.status === 'changed' || p.status === 'revise');
  if (mode === 'gated' && open.length) next.push(`look at the bible, then approve or send back: ${open.map((p) => p.id).join(', ')} (design_game { ref, approve: [...] } or { ref, revise: { part, note } })`);
  if (mode === 'autonomous' && parts.some((p) => p.status === 'revise')) next.push(`the machine gate advises on ${parts.filter((p) => p.status === 'revise').map((p) => p.id).join(', ')}: change the page, or approve it as it stands`);
  if (world.characters) next.push(world.made?.hero ? 'run again after a change: what moved is remade, what you edited by hand is left (force: true overwrites it)' : 'run: true makes the hero, and every step that is ready');
  if (world.characters?.hero?.actions && !world.characters.hero.adornment) next.push('the adornment page is empty: the bible proposes what the hero carries from the power verbs, with its reasons; write your own (patch /characters/hero/adornment), and its items seed the equipment table');
  if (steps) for (const [k, s] of Object.entries(steps)) if (!s.ready) next.push(`${k} waits on ${s.waiting.map((w) => `${w.id} (${w.status})`).join(', ')}`);
  // the advice: measured, never a verdict on the design
  const same = sameness(world), questions = grounding(world), own = authorship(world);
  const advice = { authorship: own.line, ...(same.length ? { sameness: same } : {}), ...(questions.length ? { questions } : {}) };
  if (same.length || questions.length) next.push('read the advice: a choice the brief does not explain, or one that reads as a fixture or a sample, is the creator\'s to confirm');
  return { ref, url: `/sketches/${encodeURIComponent(ref)}`, advice, bible: `/api/sketches/${encodeURIComponent(ref)}/bible`, mode, parts, ...(steps ? { steps: Object.fromEntries(Object.entries(steps).map(([k, s]) => [k, s.ready ? 'ready' : 'waiting'])) } : {}), ...(Object.keys(made).length ? { made } : {}), next };
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
  const { ref: given, title, world, patch, approve, revise, note, run, force, example, compare } = input;
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
      // the runner's record stays with the recipe unless the new one brings its own
      await updateSketchHandler({ ref, ...(title ? { title } : {}), manifest: world.made === undefined && exists.manifest.made ? { ...manifest, made: exists.manifest.made } : manifest });
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
  let W = gameworldOf(SketchRepository.getByRef(ref).manifest);
  // the verdicts
  if (approve !== undefined || revise !== undefined) {
    const review = reviewWith(W, { approve, revise, note });
    await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/review', value: review }] });
    W = { ...W, review };
  }
  // the run
  let ran;
  if (run) {
    readGameworld(W);
    const out = await runWorld(ref, W, { force: !!force });
    ran = out.ran;
    if (out.world !== W) {
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
  return { ok: true, ...readout(ref, W), ...(ran ? { ran } : {}), ...(comparison ? { comparison } : {}) };
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
      + '(`force` overwrites). Answers each part\'s stamp, the steps, what was made, the advice, the next moves. Read '
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
      },
      required: [],
    },
    handler: designGameHandler,
  });
}
