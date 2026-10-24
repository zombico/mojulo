/**
 * design_game — the rail in front of the game tools. A gameworld (the game book's recipe: its levels, its hero, its
 * gear, its systems) is a `gameworld` sketch; this door writes it, takes the creator's verdicts on its parts, and RUNS
 * it: every step that is ready is made through the same handlers an agent would call (the hero through the hero door,
 * the gear through the equipment door, the systems world through create_sketch), at refs derived from the gameworld's
 * own, and recorded in its `made` (gameworld/made.js). A run with nothing changed makes nothing; what the creator edited
 * by hand since a run is left as it is unless `force`. Its answer is the readout: each part's stamp, which steps may
 * start, what was made, and the next moves. The world bible is `/api/sketches/<ref>/bible`, the character bible
 * `…/bible?book=characters`, and with a feel its feel book (`…/bible?book=feel`: the stick view of its controls); the
 * sketch page shows them.
 *
 * In one call, in order: the recipe (`world` creates or replaces it, `patch` edits it by part), then the verdicts
 * (`approve`, `revise`), then the run (`run: true`). Each is optional; a call with only `ref` reads.
 */
import { NEW_GAME_SCREEN } from '@/lib/graph/game/screen';
import { registerTool } from '@/lib/mcp/server';
import { shareForContext } from '@/lib/mcp/hosts/handoff';
import { shareBrief } from '@/lib/graph/game/share-offer.js';
import { RENDER_TOOL_TIMEOUT_MS } from '@/lib/mcp/telemetry';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { mintSolidHandler } from './mint-solid.js';
import { createCharacterHandler } from './create-character.js';
import { createGameHandler } from './create-game.js';
import { heroMintArgs, heroRemakeOps } from './hero-mint.js';
import { HERO_FIELDS } from './layered.js';
import { LAWS_VERSION } from '@/lib/graph/equipment/expand.js';
import {
  GAMEWORLD_KIND, isGameworldKind, gameworldOf, readGameworld, resolveBook, reviewState, approve as approveWorldPart, reviewParts,
  characterState, characterReady, approveCharacter, CHARACTER_PART_IDS, CAST_PART, fingerprint, pinBase, revisionLookup, runSteps, heroRefOf, decide, childRef, storyReport,
} from '@/lib/graph/gameworld/index';
import { sameness, grounding, authorship, compareWorlds, REFERENCES } from '@/lib/graph/gameworld/advice.js';
import { intentReport } from '@/lib/graph/gameworld/intent.js';
import { feelReport } from '@/lib/graph/gameworld/feel/lower.js';
import { feelSuggestion } from '@/lib/graph/gameworld/feel/suggest.js';
import { juiceOfGame, juiceSuggestion } from '@/lib/graph/gameworld/juice.js';
import { quickWorld } from '@/lib/graph/gameworld/quick.js';
import { composeGameworld } from '@/lib/graph/gameworld/compose.js';
import './palette-ledger.js';
import { stampWorldPalette, stampGeocubes } from '@/lib/graph/color-theorist/stamp.js';
import { firstFrameReadout } from '@/lib/graph/game/first-frame-check.js';


const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** The lookup a pinned base is verified with: the hero's row and its archive. It also carries HEAD (`head`, the row's
 * manifest, and `heroSpec`, its hero in the door's words), so a run can see a hero edited by hand since it was made. */
function heroLookup(heroRef) {
  const row = SketchRepository.getByRef(heroRef);
  if (!row) return () => null;
  const headRev = (SketchRevisionRepository.head(heroRef)?.rev ?? 0) + 1;
  const lookup = revisionLookup({ ref: heroRef, headRev, head: row.manifest, get: (r, rev) => SketchRevisionRepository.get(r, rev)?.manifest ?? null });
  const hero = isObj(row.manifest?.hero) ? row.manifest.hero : null;
  return Object.assign(lookup, { head: row.manifest, headRev, heroSpec: hero ? Object.fromEntries(HERO_FIELDS.filter((k) => hero[k] !== undefined).map((k) => [k, hero[k]])) : null });
}

/** Has the hero a run made been edited by hand since? (Its row no longer prints as the run left it.) */
const handEdited = (world, lookup) => !!(world.made?.hero && lookup?.head && fingerprint(lookup.head) !== world.made.hero.stored);

const storedPrint = (ref) => { const row = SketchRepository.getByRef(ref); return row ? fingerprint(row.manifest) : null; };
const headRev = (ref) => (SketchRevisionRepository.head(ref)?.rev ?? 0) + 1;

/** The world with the hero's base pinned (the looks page holds the pin). */
function withPin(world, pin) {
  const hero = world.characters.hero ?? {};
  return { ...world, characters: { ...world.characters, hero: { ...hero, looks: { ...(hero.looks ?? {}), base: pin } } } };
}

/** the steps a hero is made for, through the hero door (hero-mint.js): the book's hero and cast, a quick game's figures
 * (each role a pool of rolls: `guard`, `guard-2` …, runner.js) */
const HERO_STEP = /^(hero|hero-equipped|(guard|foe|tower|farmhand|keeper)(-\d+)?|cast-.+)$/;
const HERO_NOTE = { hero: 'the book\'s base', 'hero-equipped': 'the hero equipped' };

/** Make or remake one step; → the record to keep. */
async function realize(step, action) {
  const { key, ref, order } = step;
  if (key === 'casting') {
    // the casting page's cast (an egocube row, casting.js): rolled where it is written; a changed request rolls it anew in place
    if (action === 'make') await createSketchHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title: order.title, manifest: order.manifest });
    return {};
  }
  if (key.startsWith('cast-') && order.egocube) {
    // a rolled cast member: the character its cast makes by path (create_character { egocube, member }); remade beside
    // and moved into its own row, as a fighter is, so the ref and its history stay
    if (action === 'make') await createCharacterHandler({ egocube: order.egocube, member: order.member, title: order.title, ref });
    else {
      const beside = childRef(ref, 'remake');
      await createCharacterHandler({ egocube: order.egocube, member: order.member, title: order.title, ref: beside });
      try { await updateSketchHandler({ ref, title: order.title, manifest: SketchRepository.getByRef(beside).manifest, note: 'design_game: a cast member remade from its cast' }); }
      finally { SketchRepository.deleteByRef(beside); }
    }
    return {};
  }
  if (order.animal) {
    // a figure that is a beast (a battle's wolf, a wave of spiders: runner.js): made through the animal door
    // (create_character { as: 'animal' }) with its gaits and reactions; remade beside and moved in, as a cast member is
    if (action === 'make') await createCharacterHandler({ as: 'animal', spec: order.animal, title: order.title, ref });
    else {
      const beside = childRef(ref, 'remake');
      await createCharacterHandler({ as: 'animal', spec: order.animal, title: order.title, ref: beside });
      try { await updateSketchHandler({ ref, title: order.title, manifest: SketchRepository.getByRef(beside).manifest, note: 'design_game: a beast remade' }); }
      finally { SketchRepository.deleteByRef(beside); }
    }
    return {};
  }
  if (HERO_STEP.test(key)) {
    if (action === 'make') await mintSolidHandler({ ...heroMintArgs(order.mint), ref });
    // (a quick game's mascot hero, runner.js: a ring plan through the creature door, remade by its plan whole)
    else if (order.mascot) await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/plan', value: order.mint.spec.plan }], note: 'design_game: the mascot hero' });
    else await updateSketchHandler({ ref, patch: heroRemakeOps(order, SketchRepository.getByRef(ref)?.manifest), note: `design_game: ${HERO_NOTE[key] ?? (key.startsWith('cast-') ? 'a cast member' : `the ${key}`)}` });
    // the book's base is the revision as made: pinned before the motion branches from it
    const pin = key === 'hero' ? pinBase({ ref, rev: headRev(ref), manifest: SketchRepository.getByRef(ref).manifest }) : null;
    if (order.motion) await updateSketchHandler({ ref, patch: order.motion, note: `design_game: ${key === 'hero' ? 'the motion page' : 'a cast member\'s motion'}` });
    return pin ? { pin } : {};
  }
  if (key === 'ride') {
    // a quick game's ride: the vehicle's build (an assembler sketch), its manifest whole in place
    if (action === 'make') await createSketchHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title: order.title, manifest: order.manifest });
    return {};
  }
  if (key.startsWith('level-') || /^map-\d+$/.test(key)) {
    // a stage as a level (or an epoch's map, a level of its own): create_sketch at mint, its manifest whole in place
    if (action === 'make') await createSketchHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title: order.title, manifest: order.manifest });
    return {};
  }
  if (/^fighter-.+-sheet$/.test(key)) {
    // a fighter's sheet (an egocube): rolled where it is written; a changed roll rolls it anew in place
    if (action === 'make') await createSketchHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title: order.title, manifest: order.manifest });
    return {};
  }
  if (key.startsWith('fighter-')) {
    // a fighter: the character its sheet makes (create_character { egocube }). Remade (its sheet rolled anew, the
    // character not edited by hand since): made beside it from the sheet as it is now and moved into its own row, so
    // the ref and its history stay
    if (action === 'make') await createCharacterHandler({ egocube: order.egocube, title: order.title, ref });
    else {
      const beside = childRef(ref, 'remake');
      await createCharacterHandler({ egocube: order.egocube, title: order.title, ref: beside });
      try { await updateSketchHandler({ ref, title: order.title, manifest: SketchRepository.getByRef(beside).manifest, note: 'design_game: the fighter remade from its sheet' }); }
      finally { SketchRepository.deleteByRef(beside); }
    }
    return {};
  }
  if (key === 'game' && order.engine === 'versus') {
    // a fight's game (quick goal fight): the versus manifest as the row, whole in place
    if (action === 'make') {
      // the edit gate's, paid at mint too: a character in the roster must be one the store has
      const { versusGate } = await import('@/lib/graph/versus/versus-character.js');
      const { ok, errors } = await versusGate(order);
      if (!ok) throw new Error(`Invalid versus game: ${errors.join('; ')}`);
      SketchRepository.create({ title: order.title, manifest: order, ref });
    }
    else await updateSketchHandler({ ref, title: order.title, manifest: order });
    return {};
  }
  if (key === 'game') {
    // the game over the levels: create_game (each level audited where the runner asked, else unaudited, recorded), its
    // manifest whole in place
    const { title, store, levels, links, theme, shell, final } = order;
    if (action === 'make') {
      const minted = await createGameHandler({ ...order, ref });
      return order.auto_audit ? { audits: (minted.audits ?? []).map((a) => ({ ref: a.ref, audited: a.audited, note: a.note })) } : {};
    } else {
      // (a game made with no theme was given one at mint: a remake keeps it)
      const kept = theme ?? SketchRepository.getByRef(ref)?.manifest?.theme;
      await updateSketchHandler({ ref, title, manifest: { kind: 'game', title, store, levels, ...(links ? { links } : {}), ...(kept ? { theme: kept } : {}), ...(shell ? { shell } : {}), ...(final ? { final } : {}) } });
    }
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
    // an adopted hero (characters.hero.ref, quick.hero.ref): pinned as it stands when the world first names it, never
    // made or remade (it is the creator's own row); a ref with no row is said, and the steps that need it wait
    if (step.adopt) {
      const row = SketchRepository.getByRef(step.ref);
      const action = !row ? 'missing' : made.hero?.ref === step.ref ? 'keep' : 'adopt';
      ran.push({ key: step.key, ref: step.ref, action });
      if (action !== 'adopt') return;
      made.hero = { ref: step.ref, order: step.print, stored: storedPrint(step.ref) };
      if (W.characters) W = withPin(W, pinBase({ ref: step.ref, rev: headRev(step.ref), manifest: row.manifest }));
      return;
    }
    const action = decide(step, made[step.key], storedPrint(step.ref), { force });
    // a level's intent laws that do not hold (lay-concerns.js): advice, never a refusal
    const advises = (step.laws ?? []).filter((l) => !l.holds).map((l) => `${l.concern}: ${l.says}`);
    ran.push({ key: step.key, ref: step.ref, action, ...(step.waiting ? { waiting: step.waiting.map((w) => `${w.id} (${w.status})`) } : {}), ...(advises.length ? { advises } : {}) });
    if (action !== 'make' && action !== 'remake') return;
    const { pin, audits } = await realize(step, action);
    if (audits) ran[ran.length - 1].audits = audits;   // the game's level audits, as create_game recorded them
    made[step.key] = { ref: step.ref, order: step.print, stored: storedPrint(step.ref) };
    if (pin && W.characters) W = withPin(W, pin);   // a quick game's hero has no book to pin it in
  };
  // the hero first: the systems and the gear wait on its pinned base
  const heroRef = heroRefOf(W, ref);
  const first = runSteps(W, { ref, lookup: heroLookup(heroRef) });
  if (!first.length) return { world: W, ran };
  await act(first[0]);
  // the rest read the record as this run left the hero (a hero just made or remade is not an edit by hand)
  for (const step of runSteps({ ...W, made }, { ref, lookup: heroLookup(heroRef) }).slice(1)) await act(step);
  return { world: Object.keys(made).length ? { ...W, made } : W, ran };
}

/** Each part's stamp, the steps, what was made, and what to do next. */
function readout(ref, world, context = {}) {
  const lookup = world.characters ? heroLookup(heroRefOf(world, ref)) : undefined;
  // a hero edited by hand since the run has moved past its pinned base: said on the base's part, never refused
  const adopted = world.characters?.hero?.ref;
  const edited = {
    ...(handEdited(world, lookup) ? { 'hero:base': [adopted ? `the adopted hero '${adopted}' was edited since it was pinned (revision ${lookup.headRev}): it plays as edited` : `the hero was edited by hand since the run (revision ${lookup.headRev}): it plays as edited and has moved past its pinned base; a rerun leaves it as it is, and force remakes it from the book`] } : {}),
    ...(adopted && lookup && !lookup.head ? { 'hero:base': [`no sketch '${adopted}': the adopted hero is made with create_character first`] } : {}),
    ...(adopted && (world.characters.hero.motion || (lookup?.heroSpec && !('jog' in (lookup.heroSpec.motion ?? {})))) ? { 'hero:motion': [
      ...(world.characters.hero.motion ? [`the hero is adopted ('${adopted}'): its own motion plays; this page is not applied to it (revise it with update_character)`] : []),
      ...(lookup?.heroSpec && !('jog' in (lookup.heroSpec.motion ?? {})) ? [`the adopted hero has no jog of its own: the library's plays forward (update_character spec: { motion: { jog: true } } gives it the calibrated one)`] : []),
    ] } : {}),
  };
  const stamps = [...reviewState(world), ...(world.characters ? characterState(world, { lookup, machine: edited }) : [])];
  const parts = stamps.map((s) => ({ id: s.id, status: s.status, ...(s.machine?.length ? { advises: s.machine } : {}), ...(s.note ? { note: s.note } : {}) }));
  const steps = world.characters ? characterReady(world, { state: stamps.filter((s) => CHARACTER_PART_IDS.includes(s.id) || s.id === CAST_PART) }) : null;
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
    // how to share it, by what this host can do; the call that made the game carries the whole offer (`share`)
    next.push({ step: 'share', can: shareBrief(shareForContext(context, { ref: world.made.game.ref })), card: 'gameworld-next' });
  }
  // the run, whenever a run can make something: a world with a character book (its hero first), and a world before its
  // people (a composed world: runner.js worldSteps lays its levels and the game) once its parts are settled. The run
  // used to be offered only with characters, so a composed world stalled after compose
  const worldFirst = !world.characters && !world.quick && Object.keys(world.levels ?? {}).length > 0;
  const settled = (st) => st === 'approved' || st === 'auto';
  if (world.characters) next.push({ step: world.made?.hero ? 'rerun' : 'run', card: 'gameworld-next' });
  else if (worldFirst && stamps.every((x) => settled(x.status))) next.push({ step: world.made?.game ? 'rerun' : 'run', card: 'gameworld-next' });
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
  // what game it is (gameworld/intent.js): the cube the world is, and what that asks of the world
  const intent = intentReport(world);
  if (!intent.written && !world.quick) next.push({ step: 'intent', ...(intent.suggest ? { suggest: intent.suggest.map((g) => g.id) } : {}), card: 'gameworld-intent' });
  // a quick game's goal changed since its genre was written: keep the written one or change it, the creator's call
  if (intent.drift) next.push({ step: 'intent', drift: intent.drift, card: 'gameworld-intent' });
  // the engine the intent names, and what of the world it does not carry: advice, never a refusal
  if (intent.target && !intent.target.carries) next.push({ step: 'target', engine: intent.target.engine, lost: intent.target.lost, card: 'gameworld-intent' });
  // how the hero moves (gameworld/feel): the template, its viewer, and what the runtime carries of its card
  const feel = world.feel !== undefined && world.feel !== null ? feelReport(world.feel) : null;
  if (feel?.lost.length) next.push({ step: 'feel', pole: feel.pole, lost: feel.lost.map((x) => x.field), card: 'gameworld-feel' });
  // none written: the template its brief, its shooter pole or its genre points at, suggested (a default is written, never laid)
  const feelSuggest = feel ? null : feelSuggestion(world);
  if (feelSuggest) next.push({ step: 'feel', suggest: feelSuggest.feel, why: feelSuggest.why, from: feelSuggest.from, card: 'gameworld-feel' });
  // how its effects are drawn and timed (gameworld/juice.js): the floor its levels carry, or what 'auto' would lay
  const JW = feel ? { ...world, feel: { pole: feel.pole } } : world;
  const juice = juiceOfGame(JW), juiceSuggest = juice ? null : juiceSuggestion(JW);
  if (juiceSuggest) next.push({ step: 'juice', suggest: juiceSuggest.fxStyle, why: juiceSuggest.why, card: 'gameworld-juice' });
  const same = sameness(world), questions = grounding(world), own = authorship(world);
  const advice = { authorship: own.line, ...(same.length ? { sameness: same } : {}), ...(questions.length ? { questions } : {}) };
  if (same.length || questions.length) next.push({ step: 'advice', card: 'gameworld-next' });
  return { ref, url: `/sketches/${encodeURIComponent(ref)}`, ...(Array.isArray(world.brief?.read) ? { composed: composedOf(world.brief) } : {}), intent, ...(feel ? { feel } : {}), ...(juice ? { juice: { ...juice.fxStyle, from: juice.from } } : {}), advice, ...(numbers ? { numbers } : {}), bible: `/api/sketches/${encodeURIComponent(ref)}/bible`, ...(world.characters ? { characterBible: `/api/sketches/${encodeURIComponent(ref)}/bible?book=characters` } : {}), ...(feel ? { feelBook: `/api/sketches/${encodeURIComponent(ref)}/bible?book=feel` } : {}), mode, parts, ...(steps ? { steps: Object.fromEntries(Object.entries(steps).map(([k, s]) => [k, s.ready ? 'ready' : 'waiting'])) } : {}), ...(Object.keys(made).length ? { made } : {}), ...(told ? { story: { bound: told.bound.length, unplaced: told.unplaced.length, ...(told.unset?.length ? { unset: told.unset } : {}) } } : {}), next };
}

/** The verdicts as the review to write. */
function reviewWith(world, { approve, revise, note }) {
  let review = { ...(world.review ?? {}) }, W = world;
  const worldIds = reviewParts(world).map((p) => p.id);
  // the book's parts: every book's, and the cast's where it has a casting page
  const bookIds = world.characters ? [...CHARACTER_PART_IDS, ...(world.characters.casting ? [CAST_PART] : [])] : [];
  for (const part of list(approve)) {
    if (typeof part !== 'string') throw new Error('design_game: approve is a part id or a list of them');
    if (bookIds.includes(part)) review = approveCharacter(W, part, note);
    else if (worldIds.includes(part)) review = approveWorldPart(W, part, note);
    else throw new Error(`design_game: '${part}' is not a part (parts: ${[...worldIds, ...bookIds].join(', ')})`);
    W = { ...W, review };
  }
  for (const r of list(revise)) {
    if (!isObj(r) || typeof r.part !== 'string' || typeof r.note !== 'string' || !r.note.trim()) throw new Error('design_game: revise is { part, note }: the part sent back and what to change');
    if (!bookIds.includes(r.part) && !worldIds.includes(r.part)) throw new Error(`design_game: '${r.part}' is not a part`);
    review = { ...review, [r.part]: { status: 'revise', note: r.note.trim() } };
  }
  return review;
}

// the words a world is composed from: { prompt, levels?, seed?, name? }
function composedWorld(c) {
  if (!isObj(c) || typeof c.prompt !== 'string' || !c.prompt.trim()) throw new Error('design_game: compose is { prompt, levels?, seed?, name? }: the few words the world is read from');
  for (const k of Object.keys(c)) if (!['prompt', 'levels', 'seed', 'name'].includes(k)) throw new Error(`design_game: compose.${k} is not a setting (prompt, levels, seed, name)`);
  if (c.levels !== undefined && !(Number.isInteger(c.levels) && c.levels >= 1 && c.levels <= 6)) throw new Error('design_game: compose.levels is 1 to 6');
  if (c.seed !== undefined && !(Number.isInteger(c.seed) && c.seed >= 1)) throw new Error('design_game: compose.seed is a whole number from 1');
  return composeGameworld({ prompt: c.prompt, ...(c.levels !== undefined ? { levels: c.levels } : {}), ...(c.seed !== undefined ? { seed: c.seed } : {}), ...(c.name !== undefined ? { name: String(c.name) } : {}) });
}
// what a composed world's words decided (its brief): each word read and what it decided, the cube, what nothing read
const composedOf = (b) => ({ prompt: b.prompt, read: b.read.map((r) => `${r.word}: ${r.decides.join(', ')}`), ...(b.cube ? { cube: b.cube } : {}), ...(b.unread?.length ? { unread: b.unread } : {}) });

export async function designGameHandler(input, context = {}) {
  if (!isObj(input)) throw new Error('design_game takes { ref?, title?, world?, compose?, patch?, approve?, revise?, note?, run?, force?, example?, compare? }');
  const { ref: given, title, world: written, patch, approve, revise, note, run: asked, force, example, compare, quick, compose, readout: shape } = input;
  if (shape !== undefined && shape !== 'full' && shape !== 'changed') throw new Error("design_game: readout is 'full' (the default) or 'changed'");
  // the world as it stood before this call, for readout: 'changed'
  const prior = given ? SketchRepository.getByRef(given) : null;
  const before = prior && isGameworldKind(prior.manifest?.kind) ? gameworldOf(prior.manifest) : null;
  // the quick path: one level, one goal; its gameworld is written here, and it is run at once (nothing to review)
  if (quick !== undefined && written !== undefined) throw new Error('design_game: `quick` writes the world itself; pass the world\'s own settings (id, name, style …) beside the goal as quick.world, or a whole `world` without quick');
  // the interpreter (gameworld/compose.js): a few words read into a whole world, stored as `world` is
  if (compose !== undefined && (written !== undefined || patch !== undefined || quick !== undefined)) throw new Error('design_game: `compose` writes the world from its words; give it alone, then edit the world with `patch`');
  const world = compose !== undefined ? composedWorld(compose) : quick !== undefined ? quickWorld({ ...(isObj(quick.world) ? quick.world : {}), quick: Object.fromEntries(Object.entries(quick).filter(([k]) => k !== 'world')) }) : written;
  const run = asked ?? (quick !== undefined ? true : undefined);
  // a reference, made on request (the creator asked to see one): a gameworld of its own, never mixed into theirs
  if (example !== undefined) {
    if (!REFERENCES[example]) throw new Error(`design_game: example is one of ${Object.keys(REFERENCES).join(', ')} (a reference made only when the creator asks to see one)`);
    if (world !== undefined || patch !== undefined || given !== undefined) throw new Error('design_game: an example is made on its own, at its own ref; it takes no world, patch or ref');
    const at = `example-${example}`;
    const out = SketchRepository.getByRef(at) ? await designGameHandler({ ref: at, run }, context) : await designGameHandler({ world: REFERENCES[example], ref: at, title: `Reference example: ${REFERENCES[example].name}`, run }, context);
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
      // (and its palette: a recipe re-sent whole keeps the colours it was given, so the same recipe writes nothing)
      // (and its screen: a recipe re-sent whole without one keeps the screen it was made for; null asks for none)
      const kept = world.screen === undefined && exists.manifest.screen !== undefined ? { ...manifest, screen: exists.manifest.screen } : manifest;
      const next = stampWorldPalette(stampGeocubes(world.made === undefined && exists.manifest.made ? { ...kept, made: exists.manifest.made } : kept, exists.manifest), exists.manifest);
      if (JSON.stringify(next) !== JSON.stringify(exists.manifest) || (title && title !== exists.title)) {
        await updateSketchHandler({ ref, ...(title ? { title } : {}), manifest: next });
      }
    } else {
      // a new game is made for a screen (game/screen.js): a phone unless the creator names another, or null for none
      ref = (await createSketchHandler({ title: title ?? world.name ?? world.id, manifest: world.screen === undefined ? { ...manifest, screen: NEW_GAME_SCREEN } : manifest, ...(ref ? { ref } : {}) })).ref;
    }
  } else {
    if (!ref) throw new Error('design_game: name the gameworld (`ref`), or give a `world` to start one');
    const row = SketchRepository.getByRef(ref);
    if (!row) throw new Error(`design_game: no sketch at '${ref}'`);
    if (!isGameworldKind(row.manifest?.kind)) throw new Error(`design_game: '${ref}' is a '${row.manifest?.kind}', not a gameworld`);
    if (patch !== undefined) await updateSketchHandler({ ref, patch, ...(title ? { title } : {}) });
  }
  try {
    return await afterWrite(ref, { approve, revise, note, run, force, compare, before, shape }, context);
  } catch (err) {
    // the recipe is stored; the call failed after it: say where, so the next call fixes it in place
    throw new Error(`${err.message}\n— the gameworld is stored at '${ref}' as written; fix it with design_game({ ref: '${ref}', patch }) rather than starting a new one.`);
  }
}

async function afterWrite(ref, { approve, revise, note, run, force, compare, before, shape }, context = {}) {
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
  const full = { ...readout(ref, W, context), ...(await fightReadout(W)) };
  // a run's levels on their opening frame (machine gate, game/first-frame-check.js): { first_frame } or nothing
  const eyes = await firstFrameReadout(W, ran);
  // the run that made (or remade) the game completed it: the whole share offer rides this call, once
  const completed = W.made?.game && ran?.some((r) => r.key === 'game' && (r.action === 'make' || r.action === 'remake'));
  const share = completed ? { share: shareForContext(context, { ref: W.made.game.ref }) } : {};
  if (shape !== 'changed') return { ok: true, ...full, ...(ran ? { ran } : {}), ...eyes, ...(comparison ? { comparison } : {}), ...share };
  return { ok: true, readout: 'changed', ...changedOnly(full, before ? readout(ref, before, context) : null), ...(ran ? { ran: ran.filter((r) => r.action !== 'keep' && r.action !== 'waiting') } : {}), ...eyes, ...(comparison ? { comparison } : {}), ...share };
}

/** A fight's readout (quick goal fight, once made): each fighter's character, the sheet it came from and what the sheet
 * chose for the fight and why, and each fighter's law stamp (advice). */
async function fightReadout(W) {
  const game = W.quick?.goal === 'fight' && W.made?.game ? SketchRepository.getByRef(W.made.game.ref)?.manifest : null;
  if (game?.engine !== 'versus') return {};
  const { versusGate } = await import('@/lib/graph/versus/versus-character.js');
  const { ok, errors, laws, fighters } = await versusGate(game);
  if (!ok) return { fight: { errors } };
  const stamp = Object.fromEntries(laws.map(({ id, ...l }) => [id, l]));
  return { fight: { fighters: fighters.map((f) => ({ ...f, laws: stamp[f.id] })) } };
}

// readout: 'changed': the parts whose stamp moved since the call began, any other section that differs, and the next
// moves (always: they are what to do now). A new world has no before, so every part is new.
function changedOnly(full, prev) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const prevParts = new Map((prev?.parts ?? []).map((p) => [p.id, p]));
  const out = { ref: full.ref, url: full.url, parts: full.parts.filter((p) => !same(p, prevParts.get(p.id))) };
  for (const k of ['intent', 'advice', 'numbers', 'steps', 'made', 'mode', 'fight']) if (full[k] !== undefined && !same(full[k], prev?.[k])) out[k] = full[k];
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
      + '`compare` reads one against a made world. `compose: { prompt }`: a world from words.',
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
        compose: { type: 'object', description: '{ prompt, levels?, seed?, name? }' },
      },
      required: [],
    },
    handler: designGameHandler,
  });
}
