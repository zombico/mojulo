/**
 * design_game — the rail in front of the game tools. A gameworld (the game book's recipe: its levels, its hero, its
 * gear, its systems) is a `gameworld` sketch; this door writes it, takes the creator's verdicts on its parts, and RUNS
 * it: every step that is ready is made through the same handlers an agent would call (the hero through the hero door,
 * the gear through the equipment door, the systems world through create_sketch), at refs derived from the gameworld's
 * own, and recorded in its `made` (gameworld/made.js). A run with nothing changed makes nothing; what the creator edited
 * by hand since a run is left as it is unless `force`; a run a step fails partway keeps the record of the steps made
 * before it, so the next run never reads them as edited. Its answer is the readout: each part's stamp, which steps may
 * start, what was made, and the next moves. The world bible is `/api/sketches/<ref>/bible`, the character bible
 * `…/bible?book=characters`, with a feel its feel book (`…/bible?book=feel`: the stick view of its controls), and with
 * foes (or a casting call's proposal) its cast sheet (`…/bible?book=foes`); the sketch page shows them.
 *
 * In one call, in order: the recipe (`world` creates or replaces it, `patch` edits it by part), then the verdicts
 * (`approve`, `revise`), then the run (`run: true`). Each is optional; a call with only `ref` reads.
 */
import { NEW_GAME_SCREEN } from '@/lib/graph/game/screen';
import { registerTool, clientTakesJobAgents } from '@/lib/mcp/server';
import { getClientInfo } from '@/lib/mcp/client-bindings';
import { shareForContext, workshopForContext } from '@/lib/mcp/hosts/handoff';
import { shareBrief } from '@/lib/graph/game/share-offer.js';
import { RENDER_TOOL_TIMEOUT_MS } from '@/lib/mcp/telemetry';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchRevisionRepository } from '@/lib/db/repositories/sketch-revisions';
import { createSketchHandler, updateSketchHandler } from './sketches.js';
import { mintSolidHandler } from './mint-solid.js';
import { createCharacterHandler } from './create-character.js';
import { createGameHandler, auditGameLevel } from './create-game.js';
import { heroMintArgs, heroRemakeOps } from './hero-mint.js';
import { HERO_FIELDS } from './layered.js';
import { LAWS_VERSION } from '@/lib/graph/equipment/expand.js';
import {
  GAMEWORLD_KIND, isGameworldKind, gameworldOf, readGameworld, resolveBook, reviewState, approve as approveWorldPart, reviewParts,
  characterState, characterReady, approveCharacter, keepApproval, CHARACTER_PART_IDS, CAST_PART, fingerprint, pinBase, revisionLookup, runSteps, heroRefOf, decide, childRef, storyReport, landAdvice,
  castable, foeState, foeParts, approveFoe, castingCall, gameworldGraph,
} from '@/lib/graph/gameworld/index';
import { sameness, grounding, authorship, compareWorlds, REFERENCES } from '@/lib/graph/gameworld/advice.js';
import { intentReport, cubeOfWorld } from '@/lib/graph/gameworld/intent.js';
import { compilerGaps, formGaps } from '@/lib/graph/gameworld/resonance.js';
import { AUDIT_STEP } from '@/lib/graph/gameworld/runner.js';
import { chapterBook, chapterSteps, CHAPTERS, unitOf, levelStep, chaptersOfPath } from '@/lib/graph/gameworld/chapters.js';
import { applyManifestPatch } from './manifest-patch.js';
import { chapterView } from '@/lib/graph/gameworld/chapter-view.js';
import { readMainQuest, mainQuestContext, mainQuestReport } from '@/lib/graph/gameworld/main-quest.js';
import { questPlays, withQuestLevels } from '@/lib/graph/gameworld/main-quest-lay.js';
import { goalposts } from '@/lib/graph/gameworld/goalposts.js';
import { loopOf, loopLaws } from '@/lib/graph/gameworld/core-loop.js';
import { compileCheck, planError } from './design-game-check.js';
import { feelReport } from '@/lib/graph/gameworld/feel/lower.js';
import { feelSuggestion } from '@/lib/graph/gameworld/feel/suggest.js';
import { juiceOfGame, juiceSuggestion } from '@/lib/graph/gameworld/juice.js';
import { arsenalOfGame, arsenalSuggestion, heroStrikes } from '@/lib/graph/gameworld/arsenal.js';
import { roomEligible } from '@/lib/graph/gameworld/practice-room.js';
import { railOfGame } from '@/lib/graph/gameworld/game-bodies.js';
import { quickWorld, sportConceptOf } from '@/lib/graph/gameworld/quick.js';
import { quickVehicleWords, patchVehicleWords } from '@/lib/graph/vehicle-registry/doors.js';
import { composeGameworld } from '@/lib/graph/gameworld/compose.js';
import { complexAdvice } from '@/lib/graph/gameworld/levels.js';
import { rebase } from '@/lib/graph/gameworld/rebase.js';
import { levelLawsOf, STAFFING, readLedger, notesWith, pullThrough, remitAdvice, ledgerSummary, reqForView, unitParts, unitPrint, receiptOf, upstreamPrints, reqStatus, unitsOf, reqParts, reqLevels } from '@/lib/graph/gameworld/reqs.js';
import { GameworldReqRepository, GameworldReqJobRepository, GameworldAskRepository, GameworldProductionRepository, GameworldReqNoteRepository } from '@/lib/db/repositories/gameworld-reqs.js';
import { STYLES, DIRECTS, checkProduction, postureOf, roleOf, maySettle, checkpointLevels, productionSummary } from '@/lib/graph/gameworld/production.js';
import { checkAsk, traceStart, traceOf } from '@/lib/graph/gameworld/asks.js';
import { beatUnit, beatRemit, questUnits, beatCrew, actUnit, actRemit } from '@/lib/graph/gameworld/quest-reqs.js';
import { authorPlan, criticPlan, jobsLeft, reissuesLeft, outsideOf, checkSubmit, jobBrief, jobReport, nextOf, jobLines, jobUnit, seatOf } from '@/lib/graph/gameworld/jobs.js';
import { segmentUnits, checkSegment, segmentRemit } from '@/lib/graph/gameworld/segments.js';
import './palette-ledger.js';
import { stampWorldPalette, stampGeocubes } from '@/lib/graph/color-theorist/stamp.js';
import { withoutWarm } from '@/lib/graph/scene/scene-png-warm';
import { firstFrameReadout } from '@/lib/graph/game/first-frame-check.js';
import { gauntletLaws } from '@/lib/graph/gameworld/gauntlet.js';
import { proveGauntlets } from '@/lib/graph/gameworld/gauntlet-proof.js';
import { proveErrands, lastStageManifests } from '@/lib/graph/gameworld/errand-proof.js';


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

/** A NAMED HERO's ref, found by its name (create_character spec.name; names are a hero's own on this machine), or the
 * call refused naming what it found: none by that name, or a ref beside it that is another hero's. */
function namedHeroRef(name, ref) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('design_game: a hero named by name is { name: \'<its name>\' } (create_character spec.name)');
  const row = SketchRepository.heroByName(name);
  if (!row) throw new Error(`design_game: no hero named '${name}' on this machine (name one with create_character { as: 'hero', spec: { name } }, or adopt one by its ref)`);
  if (ref !== undefined && ref !== row.ref) throw new Error(`design_game: the hero named '${name}' is '${row.ref}', not '${ref}': give the name or the ref`);
  return row.ref;
}
/** A world whose character book names its hero by name, with the named hero's ref written beside it. */
function withNamedHero(world) {
  const H = isObj(world) && isObj(world.characters) && isObj(world.characters.hero) ? world.characters.hero : null;
  if (!H || H.name === undefined) return world;
  return { ...world, characters: { ...world.characters, hero: { ...H, ref: namedHeroRef(H.name, H.ref) } } };
}

/** Has the hero a run made been edited by hand since? (Its row no longer prints as the run left it.) */
const handEdited = (world, lookup) => !!(world.made?.hero && lookup?.head && fingerprint(lookup.head) !== world.made.hero.stored);

const storedPrint = (ref) => { const row = SketchRepository.getByRef(ref); return row ? fingerprint(row.manifest) : null; };
const headRev = (ref) => (SketchRevisionRepository.head(ref)?.rev ?? 0) + 1;

/** The world with the hero's base pinned (the looks page holds the pin). An approval of the base that stood on the book
 * as it was (given before the first mint, or before a remake of what was approved) is kept on what the run made from
 * it (character-review.js keepApproval): the pin is the run carrying out the approved page, not a change to review. */
function withPin(world, pin) {
  const hero = world.characters.hero ?? {};
  const pinned = { ...world, characters: { ...world.characters, hero: { ...hero, looks: { ...(hero.looks ?? {}), base: pin } } } };
  return keepApproval(world, pinned, 'hero:base');
}

/** the steps a hero is made for, through the hero door (hero-mint.js): the book's hero and cast, a quick game's figures
 * (each role a pool of rolls: `guard`, `guard-2` …, runner.js) */
// (a battle foe kind's figure, `foe-<kind>` (gameworld/battles.js FOE_LOOKS: a person), is made as a hero is)
// (a town's folk, gameworld/folk-cast.js: each body a step minted through the hero door as a guard is)
const HERO_STEP = /^(hero|hero-equipped|hero-sheathed|(guard|tower|farmhand|keeper|athlete)(-\d+)?|foe(-[a-z0-9][a-z0-9-]*)?|cast-.+|folk-[a-z0-9-]+)$/;
const HERO_NOTE = { hero: 'the book\'s base', 'hero-equipped': 'the hero equipped', 'hero-sheathed': 'the hero, its blade sheathed' };

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
  // (a bestiary person dressed as a crew's, gameworld/foes.js isDressed: the hero door's grunt, made as a guard is)
  if ((HERO_STEP.test(key) && !(key.startsWith('foe-') && !order.mint)) || (key.startsWith('foes-') && order.mint)) {
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
  if (/^(fighter|foes?)-.+-sheet$/.test(key)) {
    // a fighter's sheet, or a bestiary people's (an egocube): rolled where it is written; a changed roll rolls it anew in
    // place
    if (action === 'make') await createSketchHandler({ ...order, ref });
    else await updateSketchHandler({ ref, title: order.title, manifest: order.manifest });
    return {};
  }
  if (key.startsWith('fighter-') || (/^foes?-/.test(key) && order.egocube)) {
    // a fighter, or a bestiary people (gameworld/foes.js): the character its sheet makes (create_character { egocube }),
    // a people with its moves on it. Remade (its sheet rolled anew, the
    // character not edited by hand since): made beside it from the sheet as it is now and moved into its own row, so
    // the ref and its history stay
    // (a people foe's body its game puts in its henchmen: the words laid over the sheet's person, gameworld/runner.js)
    if (action === 'make') await createCharacterHandler({ egocube: order.egocube, title: order.title, ref, ...(order.spec ? { spec: order.spec } : {}) });
    else {
      const beside = childRef(ref, 'remake');
      await createCharacterHandler({ egocube: order.egocube, title: order.title, ref: beside, ...(order.spec ? { spec: order.spec } : {}) });
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
    // the game over the levels: create_game (its levels dry-run and recorded unaudited: the run's audit steps walk them
    // after, one a step, runner.js auditSteps), its manifest whole in place
    const { title, store, levels, links, theme, shell, final, hud } = order;
    if (action === 'make') {
      await createGameHandler({ ...order, ref });
      return {};
    } else {
      // (a game made with no theme was given one at mint: a remake keeps it)
      const kept = theme ?? SketchRepository.getByRef(ref)?.manifest?.theme;
      await updateSketchHandler({ ref, title, manifest: { kind: 'game', title, store, levels, ...(links ? { links } : {}), ...(kept ? { theme: kept } : {}), ...(shell ? { shell } : {}), ...(final ? { final } : {}), ...(hud ? { hud } : {}) } });
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

/**
 * THE RUN'S BUDGET. A run makes its ready steps one after another, and a big book's steps (its people, its levels, a
 * walk through each level) add up past what one tool call may hold: so a run starts no new step once it has spent its
 * budget, says the steps it left as `pending`, and keeps the record of what it made, and the next run takes up where it
 * stopped (the steps it made are kept, by their record). Every run makes at least one step, so a run always moves; a
 * step is never cut partway. The world a run leaves is the same however many calls it took (the record decides, not the
 * clock). MOJULO_RUN_BUDGET_MS sets it (0: no budget, every step in one call).
 */
export const RUN_BUDGET_MS = 120_000;
export function runBudgetMs(env = process.env) {
  const raw = env.MOJULO_RUN_BUDGET_MS;
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : RUN_BUDGET_MS;
}

/** What an audit step would walk, as a print (the level's row, the game's, and whether a browser can walk it, so a
 * verdict no browser gave is walked once one can): null until the level and the game are made. */
async function auditedPrint(step, browser) {
  const level = storedPrint(step.ref), game = storedPrint(step.order.game);
  if (!level || !game) return null;
  return fingerprint({ level, game, walked: !!(await browser()) });
}

/** A stored gameworld manifest with a run's changes laid on it: its own head (kind, title) kept, its world rebased. */
function storedRebased(manifest, base, mine) {
  const head = Object.fromEntries(Object.entries(manifest).filter(([k]) => k === 'kind' || k === 'title'));
  return { ...head, ...rebase(gameworldOf(manifest), base, mine) };
}

/** Run the world stored at `ref`: every ready step made, remade or kept, until the budget is spent;
 * → { world, ran, pending? } (world with its new record; pending the keys of the steps it left for the next run). */
async function runWorld(ref, world, { force = false, check = false, budgetMs = runBudgetMs(), clock = Date.now, chapter = null } = {}) {
  // the main quest's levels laid at the run (gameworld/main-quest-lay.js): a beat with only a goal its own level, once,
  // into the recipe; the levels in the quest's order. The record the run writes carries them; from then on the creator's
  let W = world.mainQuest ? withQuestLevels(world) : world;
  const made = { ...(W.made ?? {}) }, ran = [], pending = [];
  // the record kept as the run goes: each step made is written into the stored world at once (in place: a gameworld
  // keeps no revisions), so a run cut off partway (its process ended, a host's time limit) leaves its rows recorded as
  // its own, and the next run keeps them rather than reading them as edited by hand ('taken'). The run's own write at
  // the end is the world as the handler stores it
  // (each write lays the run's changes onto the world as stored now, gameworld/rebase.js: a page another chapter wrote
  // while the run ran is kept, never reverted to the run's copy)
  const checkpoint = () => {
    try { const row = SketchRepository.getByRef(ref); if (row) SketchRepository.update({ ref, manifest: storedRebased(row.manifest, world, { ...W, made }) }); } catch { /* the run goes on; its end writes the record */ }
  };
  const t0 = clock();
  let moved = false;
  const spent = () => moved && budgetMs > 0 && clock() - t0 >= budgetMs;
  // the browser an audit walks in, found once a run (an installed one only: first-frame-check.js levelBrowser)
  let found;
  const browser = async () => {
    if (found === undefined) found = (await (await import('@/lib/graph/game/first-frame-check')).levelBrowser()).path ?? null;
    return found;
  };
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
      checkpoint();
      return;
    }
    // a run compiles; walking each level is a check, asked for (`check: true`): an audit step is left out of a run that
    // does not ask, its last verdict kept
    if (step.audit && !check) return;
    const now = step.audit ? await auditedPrint(step, browser) : storedPrint(step.ref);
    const action = decide(step, made[step.key], now, { force });
    // the budget spent: a step that would make or remake is left for the next run, said as pending
    if ((action === 'make' || action === 'remake') && spent()) {
      ran.push({ key: step.key, ref: step.ref, action: 'pending' });
      pending.push(step.key);
      return;
    }
    // a level's intent laws that do not hold (lay-concerns.js): advice, never a refusal
    const advises = (step.laws ?? []).filter((l) => !l.holds).map((l) => `${l.concern}: ${l.says}`);
    // a sport's machine gate when it holds (who plays, the arena, the one style): the agent's to tell the player
    const checked = (step.laws ?? []).filter((l) => l.holds && SPORT_CHECKS.includes(l.law)).map((l) => `${l.concern}: ${l.says}`);
    // (a chapter's run makes a step ahead of the approvals it waits on: chapters.js chapterSteps; said with what it skipped)
    ran.push({ key: step.key, ref: step.ref, action, ...(step.waiting ? { waiting: step.waiting.map((w) => `${w.id} (${w.status})`) } : {}), ...(step.ahead?.length && (action === 'make' || action === 'remake') ? { ahead: step.ahead } : {}), ...(advises.length ? { advises } : {}), ...(checked.length ? { checked } : {}) });
    if (action !== 'make' && action !== 'remake') return;
    moved = true;
    if (step.audit) {
      // a level walked (create-game.js auditGameLevel): its verdict kept beside the level's record, said once here
      const verdict = await auditGameLevel({ gameRef: step.order.game, levelRef: step.ref, findBrowser: async () => ({ path: await browser(), why: 'no browser' }) });
      made[step.key] = { ref: step.ref, order: step.print, stored: now, verdict };
      ran[ran.length - 1].audit = verdict;
      checkpoint();
      return;
    }
    const { pin } = await realize(step, action);
    made[step.key] = { ref: step.ref, order: step.print, stored: storedPrint(step.ref) };
    if (pin && W.characters) W = withPin(W, pin);   // a quick game's hero has no book to pin it in
    checkpoint();
  };
  // a chapter's run: its own steps and what they name, made ahead of their approvals (chapters.js chapterSteps); the
  // build's is the whole run
  const scoped = (steps) => (chapter && chapter !== 'build' ? chapterSteps(steps, chapter) : composedBuild(steps, composite));
  // the hero first: the systems and the gear wait on its pinned base
  const heroRef = heroRefOf(W, ref), composite = compositeOf(ref, W);
  const first = scoped(runSteps(W, { ref, lookup: heroLookup(heroRef), composite }));
  if (!first.length) return { world: W, ran };
  let rest;
  try {
    await act(first[0]);
    // the rest read the record as this run left the hero (a hero just made or remade is not an edit by hand)
    rest = scoped(runSteps({ ...W, made }, { ref, lookup: heroLookup(heroRef), composite })).filter((s) => s.key !== first[0].key);
    for (const step of rest) await act(step);
  } catch (err) {
    // a step that throws partway: the steps made before it are rows now, so their record is kept with the world
    // (else the next run reads them as edited by hand and leaves them); the error reaches the caller as it was
    const partial = Object.keys(made).length ? { ...W, made } : W;
    if (JSON.stringify(partial) !== JSON.stringify(world)) {
      try { await updateSketchHandler({ ref, manifest: { kind: GAMEWORLD_KIND, ...rebase(gameworldOf(SketchRepository.getByRef(ref)?.manifest), world, partial) }, note: 'design_game: the record of a run that failed partway' }); } catch { /* the step's error is the one to say */ }
    }
    throw err;
  }
  // the compiler's own check (gameworld/resonance.js): what the cube's combined values open that these steps did not
  // lay, or laid and does not hold; reported with the run, never refused (the audits lay nothing: left out). A chapter's
  // run lays part of the book, so it is the whole run's to say
  const gaps = chapter && chapter !== 'build' ? [] : compilerGaps(cubeOfWorld(W).cube, [first[0], ...rest].filter((s) => !s.audit).map((s) => s.order), W);
  return { world: Object.keys(made).length ? { ...W, made } : W, ran, ...(pending.length ? { pending } : {}), ...(gaps.length ? { resonance: gaps } : {}) };
}

/** The pre-compile check (design-game-check.js) on the world as it stands: its plan, each order as its door would read
 * it, the refs they name, and the build left, priced. Advice: a run goes ahead whatever it says. */
async function compileReadout(ref, world, { check = false } = {}) {
  let W = world;
  let steps;
  // (with the levels a run would lay from the main quest, and its planned beats priced apart; a composite's build its
  // accepted levels alone)
  let plays = null;
  const composite = compositeOf(ref, W);
  try { plays = W.mainQuest ? questPlays(W) : null; W = W.mainQuest ? withQuestLevels(W) : W; steps = composedBuild(runSteps(W, { ref, lookup: heroLookup(heroRefOf(W, ref)), composite }), composite); }
  catch (err) { return { gate: 'machine', ready: false, blockers: [planError(err.message)] }; }
  const made = W.made ?? {}, actions = {};
  const moves = (k) => actions[k] === 'make' || actions[k] === 'remake';
  for (const s of steps) {
    if (s.adopt) actions[s.key] = made.hero?.ref === s.ref ? 'keep' : 'adopt';
    // a walk is taken again when its level or its game is made or remade (the door prints it from the rows it walked)
    // (a run that does not check walks none: its walks are not part of the build it prices)
    else if (s.audit) actions[s.key] = !check ? 'unchecked' : !s.ready ? 'waiting' : !made[s.key] || moves(s.order.level) || moves('game') ? (made[s.key] ? 'remake' : 'make') : 'keep';
    else actions[s.key] = decide(s, made[s.key], storedPrint(s.ref));
  }
  return compileCheck(steps, { actions, row: (r) => SketchRepository.getByRef(r), budgetMs: runBudgetMs(), plannedBeats: plays?.planned.length ?? 0 });
}

// the sport game's laws said when they hold too (gameworld/runner.js sportLaws, sportStyle)
const SPORT_CHECKS = ['characters', 'venue', 'one-look'];

/** Each part's stamp, the steps, what was made, and what to do next. */
// a world that names land (its style's or a level's): what of it no stage draws, as advice; a world the reader refuses
// says so elsewhere, so here it says nothing
const landGapsOf = (world) => {
  if (!world.style?.land && !Object.values(world.levels ?? {}).some((l) => l?.style?.land)) return [];
  try { return landAdvice(world); } catch { return []; }
};
// the walled-core dungeon's principles that do not hold (wcd/wcd.js): advice, never refused; a world the reader refuses
// says so elsewhere
const wcdAdviceOf = (world) => {
  if (!world.wcd) return [];
  try { return (readGameworld(world).wcd?.laws ?? []).filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`); } catch { return []; }
};
// a complex level's network laws (network/complex.js), from its layout: in the dungeon's advice where the world has one
// (its buildings are its spaces), else on their own
const complexAdviceOf = (world) => (Object.values(world.levels ?? {}).some((L) => L?.building?.complex !== undefined) ? complexAdvice(world) : []);
// the quest open world's principles that do not hold (qow/qow.js): advice, never refused
const qowAdviceOf = (world) => {
  if (!world.qow) return [];
  try { return (readGameworld(world).qow?.laws ?? []).filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`); } catch { return []; }
};
// the errands' laws (gameworld/errand.js) that advise, each named by its errand
const errandAdviceOf = (world) => {
  if (!world.errands) return [];
  try { return (readGameworld(world).errands ?? []).flatMap((E) => E.laws.filter((l) => !l.holds).map((l) => `${E.id} ${l.law}: ${l.says}`)); } catch { return []; }
};
// the wave gauntlets' laws (gameworld/gauntlet.js) that advise, each named by its level
const gauntletAdviceOf = (world) => {
  if (!Object.values(world.levels ?? {}).some((L) => L?.goal?.gauntlet)) return [];
  try { const G = readGameworld(world); return G.ids.flatMap((id) => (G.levels[id].goal?.gauntlet ? gauntletLaws(G.levels[id].goal.gauntlet).filter((l) => !l.holds).map((l) => `${id} ${l.law}: ${l.says}`) : [])); } catch { return []; }
};
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
  // the cast sheet's parts (foe-cast.js): reviewed beside the others, never holding a run back
  const foeStamps = castable(world) ? foeState(world) : [];
  const parts = [...stamps, ...foeStamps].map((s) => ({ id: s.id, status: s.status, ...(s.machine?.length ? { advises: s.machine } : {}), ...(s.note ? { note: s.note } : {}) }));
  // the book as the studio works it (gameworld/chapters.js): each chapter the world holds, its department, its state, the
  // parts it has open and the chapters upstream it waits on, so a department can take its chapter alone
  const chapters = chapterBook(world, { stamps: [...stamps, ...foeStamps] });
  const steps = world.characters ? characterReady(world, { state: stamps.filter((s) => CHARACTER_PART_IDS.includes(s.id) || s.id === CAST_PART) }) : null;
  const made = Object.fromEntries(Object.entries(world.made ?? {}).filter(([k]) => !AUDIT_STEP.test(k)).map(([k, v]) => [k, v.ref]));
  // the levels the run walked (its audit steps' verdicts): how many it proved, and what it saw where it did not
  const verdicts = Object.entries(world.made ?? {}).filter(([k]) => AUDIT_STEP.test(k)).map(([, v]) => ({ ref: v.ref, ...v.verdict }));
  const audits = verdicts.length ? { gate: 'machine', proved: verdicts.filter((v) => v.completable === true).length, of: verdicts.length, ...(verdicts.some((v) => v.completable !== true) ? { unproved: verdicts.filter((v) => v.completable !== true).map((v) => ({ ref: v.ref, note: v.note })) } : {}) } : null;
  // the next moves as step ids: what each means is the gameworld-next card (get_game_vocab),
  // read once, not re-said on every call
  const mode = world.mode ?? 'gated', next = [];
  // WHERE IT IS SEEN (game/workshop.js): a game whose level outgrows this host's page limit is played on the operator's
  // machine; said first, on every readout while it holds, so the operator chooses before the chapter is built
  const ws = workshopForContext(context, world);
  if (ws) next.push({ step: 'workshop', ...ws });
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
  // the form (resonance.js): what the world's cube asks that the world does not hold yet, and who fills it (the hero is
  // the creator's), said before the run so the run can lay it
  const form = formGaps(world, cubeOfWorld(world).cube);
  if (form.length) next.push({ step: 'form', asks: form.map((f) => ({ for: f.row, field: f.field, by: f.by, says: f.says })), card: 'gameworld-next' });
  if (!intent.written && !world.quick) next.push({ step: 'intent', ...(intent.suggest ? { suggest: intent.suggest.map((g) => g.id) } : {}), card: 'gameworld-intent' });
  // a quick game's goal changed since its genre was written: keep the written one or change it, the creator's call
  if (intent.drift) next.push({ step: 'intent', drift: intent.drift, card: 'gameworld-intent' });
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
  // its weapons and strings (gameworld/arsenal.js): the kit its striking hero plays on every level, or the one its feel's
  // template would lay (written, never laid: a kit changes every level); one written for a hero that strikes with nothing, said
  const armed = arsenalOfGame(world), arsenalSuggest = armed ? null : arsenalSuggestion(world);
  if (arsenalSuggest) next.push({ step: 'arsenal', suggest: arsenalSuggest.suggest, template: arsenalSuggest.template, why: arsenalSuggest.why, patch: [{ op: 'set', path: '/arsenal', value: 'auto' }], card: 'gameworld-feel' });
  if (armed && !heroStrikes(world)) next.push({ step: 'arsenal', unarmed: true, why: 'the arsenal is laid on a hero that strikes: give the hero a right-hand item that serves strike (a blade)', card: 'gameworld-feel' });
  const arsenal = armed ? { ...(armed.template ? { template: armed.template } : {}), from: armed.from, weapons: armed.arsenal.weapons.map((W) => W.id), combos: armed.arsenal.weapons.reduce((n, W) => n + W.combos.length, 0), ...(armed.arsenal.ranged?.length ? { sidearm: armed.arsenal.ranged[0].id } : {}) } : null;
  // the body the game puts in its hero (gameworld/game-bodies.js): a book whose direction names none, the rail its kind
  // reads proposed (opt-in: a body is written, never laid)
  const bodyRail = world.characters?.direction && world.characters.direction.body === undefined ? railOfGame({ genre: world.intent?.from ?? null, goal: world.quick?.goal ?? null, feel: typeof world.feel === 'string' ? world.feel : world.feel?.pole ?? null }) : null;
  if (bodyRail) next.push({ step: 'body', suggest: 'game', rail: bodyRail.rail, why: bodyRail.why, patch: [{ op: 'add', path: '/characters/direction/body', value: 'game' }], card: 'gameworld-direction' });
  // who it fights (gameworld/foe-casting.js): a world that fights and keeps no bestiary, the cast a casting call proposes
  const call = castingCall(world);
  if (call) next.push({ step: 'foes', suggest: Object.fromEntries(call.roles.map((r) => [r.id, `${r.class}${r.rank !== 'minion' ? ` ${r.rank}` : ''}${r.skin ? ` (${r.skin.people})` : ''}`])), why: call.reasons, patch: call.patch, card: 'gameworld-foes' });
  const same = sameness(world), questions = grounding(world), own = authorship(world);
  // the land its levels cannot draw (gameworld/nature.js landToLevel): each gap, and the levels it is one on
  const landGaps = landGapsOf(world);
  const cxGaps = complexAdviceOf(world), wcdGaps = [...wcdAdviceOf(world), ...(world.wcd ? cxGaps : [])];
  const qowGaps = qowAdviceOf(world);
  // the main quest (gameworld/main-quest.js): its acts and beats, and its laws that do not hold (advice, never refused);
  // the core loop (core-loop.js), written or read from the book, and its laws
  const MQ = world.mainQuest ? (() => {
    try {
      const C = mainQuestContext(world), P = questPlays(world);
      // (each beat's level, what the next run lays from a beat's own words, the beats planned and not made)
      return { ...mainQuestReport(readMainQuest(world.mainQuest, C), C), plays: P.plays, ...(P.lays.length ? { lays: P.lays.map((x) => x.beat) } : {}) };
    } catch { return null; }
  })() : null;
  const loop = (() => { try { return loopOf(world); } catch { return null; } })();
  const loopGaps = (() => { try { return loopLaws(world).filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`); } catch { return []; } })();
  const errandGaps = errandAdviceOf(world);
  const gauntletGaps = gauntletAdviceOf(world);
  const advice = { authorship: own.line, ...(same.length ? { sameness: same } : {}), ...(questions.length ? { questions } : {}), ...(landGaps.length ? { land: landGaps } : {}), ...(wcdGaps.length ? { wcd: wcdGaps } : {}), ...(!world.wcd && cxGaps.length ? { complex: cxGaps } : {}), ...(qowGaps.length ? { qow: qowGaps } : {}), ...(MQ?.laws.length ? { mainQuest: MQ.laws } : {}), ...(loopGaps.length ? { loop: loopGaps } : {}), ...(errandGaps.length ? { errands: errandGaps } : {}), ...(gauntletGaps.length ? { gauntlet: gauntletGaps } : {}) };
  if (same.length || questions.length) next.push({ step: 'advice', card: 'gameworld-next' });
  return { ref, url: `/sketches/${encodeURIComponent(ref)}`, ...(Array.isArray(world.brief?.read) ? { composed: composedOf(world.brief) } : {}), ...(world.quick?.concept !== undefined ? { concept: sportConceptOf(world.quick) } : {}), intent, ...(MQ ? { mainQuest: (({ laws: _l, ...r }) => r)(MQ) } : {}), ...(loop ? { loop } : {}), ...(feel ? { feel } : {}), ...(arsenal ? { arsenal } : {}), ...(juice ? { juice: { ...juice.fxStyle, from: juice.from } } : {}), advice, ...(numbers ? { numbers } : {}), bible: `/api/sketches/${encodeURIComponent(ref)}/bible`, ...(world.characters ? { characterBible: `/api/sketches/${encodeURIComponent(ref)}/bible?book=characters` } : {}), ...(feel ? { feelBook: `/api/sketches/${encodeURIComponent(ref)}/bible?book=feel` } : {}), ...(feel && !roomEligible(world) ? { practiceRoom: `/api/sketches/${encodeURIComponent(ref)}/bible?book=practice` } : {}), ...(foeStamps.length || call ? { foeBook: `/api/sketches/${encodeURIComponent(ref)}/bible?book=foes` } : {}), mode, parts, ...(steps ? { steps: Object.fromEntries(Object.entries(steps).map(([k, s]) => [k, s.ready ? 'ready' : 'waiting'])) } : {}), ...(chapters.length ? { chapters } : {}), ...(Object.keys(made).length ? { made } : {}), ...(audits ? { audits } : {}), ...(told ? { story: { bound: told.bound.length, unplaced: told.unplaced.length, ...(told.unset?.length ? { unset: told.unset } : {}), ...(told.notes?.length ? { notes: told.notes.map((n) => ({ moment: n.id, script: n.script, says: n.notes.map((x) => `${x.id}: ${x.says} ${x.try}`) })) } : {}) } } : {}), next };
}

/** The verdicts as the review to write. */
function reviewWith(world, { approve, revise, note }) {
  let review = { ...(world.review ?? {}) }, W = world;
  const worldIds = reviewParts(world).map((p) => p.id);
  // the book's parts: every book's, and the cast's where it has a casting page
  const bookIds = world.characters ? [...CHARACTER_PART_IDS, ...(world.characters.casting ? [CAST_PART] : [])] : [];
  // (and the cast sheet's: the cast, and each foe of the bestiary)
  const foeIds = castable(world) ? foeParts(world).map((p) => p.id) : [];
  for (const part of list(approve)) {
    if (typeof part !== 'string') throw new Error('design_game: approve is a part id or a list of them');
    if (bookIds.includes(part)) review = approveCharacter(W, part, note);
    else if (foeIds.includes(part)) review = approveFoe(W, part, note);
    else if (worldIds.includes(part)) review = approveWorldPart(W, part, note);
    else throw new Error(`design_game: '${part}' is not a part (parts: ${[...worldIds, ...bookIds, ...foeIds].join(', ')})`);
    W = { ...W, review };
  }
  for (const r of list(revise)) {
    if (!isObj(r) || typeof r.part !== 'string' || typeof r.note !== 'string' || !r.note.trim()) throw new Error('design_game: revise is { part, note }: the part sent back and what to change');
    if (!bookIds.includes(r.part) && !worldIds.includes(r.part) && !foeIds.includes(r.part)) throw new Error(`design_game: '${r.part}' is not a part`);
    review = { ...review, [r.part]: { status: 'revise', note: r.note.trim() } };
  }
  return review;
}

// the words a world is composed from: { prompt, levels?, seed?, name? }
export function composedWorld(c) {
  if (!isObj(c) || typeof c.prompt !== 'string' || !c.prompt.trim()) throw new Error('design_game: compose is { prompt, levels?, seed?, name? }: the few words the world is read from');
  for (const k of Object.keys(c)) if (!['prompt', 'levels', 'seed', 'name'].includes(k)) throw new Error(`design_game: compose.${k} is not a setting (prompt, levels, seed, name)`);
  if (c.levels !== undefined && !(Number.isInteger(c.levels) && c.levels >= 1 && c.levels <= 6)) throw new Error('design_game: compose.levels is 1 to 6');
  if (c.seed !== undefined && !(Number.isInteger(c.seed) && c.seed >= 1)) throw new Error('design_game: compose.seed is a whole number from 1');
  const world = composeGameworld({ prompt: c.prompt, ...(c.levels !== undefined ? { levels: c.levels } : {}), ...(c.seed !== undefined ? { seed: c.seed } : {}), ...(c.name !== undefined ? { name: String(c.name) } : {}) });
  // a composed world with its hero whose genre fights (foe-casting.js: melee or ranged, a hunting mind) is cast: the
  // casting call's proposal written (its foes, each level's stand), the brief naming it; the creator revises it as any part
  const call = world.characters ? castingCall(world) : null;
  if (!call) return world;
  const levels = Object.fromEntries(Object.entries(world.levels).map(([id, L]) => [id, call.levels[id] ? { ...L, foes: call.levels[id] } : L]));
  return { ...world, foes: call.foes, levels, brief: { ...world.brief, foes: call.roles.map((r) => r.id) } };
}
// what a composed world's words decided (its brief): each word read and what it decided, the cube, what nothing read
const composedOf = (b) => ({ prompt: b.prompt, read: b.read.map((r) => `${r.word}: ${r.decides.join(', ')}`), ...(b.cube ? { cube: b.cube } : {}), ...(b.unread?.length ? { unread: b.unread } : {}) });

/**
 * A department's variations (internal name mangekyou, lib/graph/mangekyou/): `vary` { at?, concept?, n?, principles?,
 * keep?, reject?, spread?, roll? } over the game at `ref`, routed to the department whose chapter owns `at` (the chapter
 * named, or the seat's unit, when `at` is not given). Answered as proposals and nothing is written: a variant is taken
 * with design_game({ ref, patch }) and its stamps say what it moved. `keep` and `reject` are variant patches from a pass
 * before (the game's variants are never minted, so a pass is carried by its patches); `roll` replays an order.
 */
async function varyGame(ref, vary, chapter) {
  if (!isObj(vary)) throw new Error('design_game: vary is { at?, concept?, n?, principles?, keep?, reject?, spread?, roll? }');
  const row = SketchRepository.getByRef(ref);
  if (!row) throw new Error(`design_game: no sketch at '${ref}'`);
  if (!isGameworldKind(row.manifest?.kind)) throw new Error(`design_game: '${ref}' is a '${row.manifest?.kind}', not a gameworld`);
  const unit = chapter !== undefined ? unitOf(chapter) : null;
  let at = vary.at;
  if (at === undefined && unit) {
    if (unit.level) {
      const i = (row.manifest.levels ?? []).findIndex((l) => l?.id === unit.level);
      if (i < 0) throw new Error(`design_game: the game has no level '${unit.level}' to vary`);
      at = `/levels/${i}`;
    } else at = unit.chapter.paths.find((q) => q.slice(1).split('/').reduce((v, k) => (v && typeof v === 'object' ? v[k] : undefined), row.manifest) !== undefined);
    if (at === undefined) throw new Error(`design_game: the ${unit.chapter.name.toLowerCase()} chapter writes nothing yet to vary`);
  }
  const passOf = (list, name) => {
    if (list === undefined) return [];
    if (!Array.isArray(list) || list.some((p) => !Array.isArray(p))) throw new Error(`design_game: vary.${name} is a list of variant patches (each a list of ops) from a pass before`);
    return list.map((p) => applyManifestPatch(row.manifest, p).manifest);
  };
  const [{ turnMangekyou, rollOrder }, { checkGameworldManifest }] = await Promise.all([import('@/lib/graph/mangekyou/index.js'), import('./sketch-mint.js')]);
  // a proposal the game would refuse is never offered: the reader's own gate, the next candidate in its place
  const gate = (m) => { try { checkGameworldManifest(m); return null; } catch (err) { return err.message; } };
  const turned = turnMangekyou({
    gate,
    manifest: row.manifest, at, concept: vary.concept, n: vary.n, principles: vary.principles, spread: vary.spread,
    kept: passOf(vary.keep, 'keep'), rejected: passOf(vary.reject, 'reject'),
    roll: vary.roll ?? rollOrder(), by: unit ? unit.chapter.department : 'user',
  });
  return {
    ref,
    vary: {
      order: { ...turned.order, from: { ref, title: row.title, kind: row.manifest.kind } },
      variants: turned.variants.map(({ id, says, moves, patch, distance }) => ({ id, says, moves, patch, distance })),
      spread: turned.spread,
    },
    next: `Proposals only: nothing was written. Take one with design_game({ ref: '${ref}', patch: <its patch> }); the next pass `
      + `is design_game({ ref: '${ref}', vary: { …this order, keep: [patches you like], reject: [patches you do not] } }); `
      + `the same order again is roll ${turned.order.roll}.`,
  };
}

export async function designGameHandler(input, context = {}) {
  if (!isObj(input)) throw new Error('design_game takes { ref?, title?, world?, compose?, patch?, approve?, revise?, note?, run?, force?, check?, example?, compare?, chapter?, req?, ask?, trace?, preview?, production?, as?, vary? }');
  const { ref: given, title, world: written, patch, approve, revise, note, run: asked, force, check, example, compare, quick, compose, readout: shape, chapter: named, req, ask, trace, preview, production, as } = input;
  // a job's seat (`as`): its own view and its report, nothing else; its chapter defaults to its unit
  const seat = as !== undefined ? jobSeat(input) : null;
  const chapter = named ?? seat?.unit;
  if (shape !== undefined && shape !== 'full' && shape !== 'changed') throw new Error("design_game: readout is 'full' (the default) or 'changed'");
  // one chapter's readout (gameworld/chapter-view.js): checked before anything is written
  if (req !== undefined) checkReq(req);
  // a ticket (gameworld/asks.js): the intent acted on, cut only when the call does work; a trace reads the ledger
  if (ask !== undefined) {
    checkAsk(ask);
    const works = [req, approve, revise, patch, written, compose, quick].some((x) => x !== undefined) || asked === true;
    if (!works) throw new Error('design_game: an ask is cut when intent becomes work: give it with the req, the verdict (approve, revise), the patch or the run it causes');
  }
  if (trace !== undefined) traceStart(trace);
  if (production !== undefined) checkProduction(production);
  if (preview !== undefined && (preview !== true || patch === undefined || written !== undefined || given === undefined)) throw new Error('design_game: preview: true goes with a ref and a patch: it says what the patch would do and writes nothing');
  if (preview === true && (ask !== undefined || req !== undefined || approve !== undefined || revise !== undefined || asked !== undefined)) throw new Error('design_game: a preview writes nothing: give it alone with its patch, then the ask, verdicts or run with the patch itself');
  if (chapter !== undefined && !unitOf(chapter)) throw new Error(`design_game: chapter is one of ${CHAPTERS.map((c) => c.id).join(', ')} (the readout's \`chapters\`), or one level as 'level:<id>'`);
  if (input.vary !== undefined) {
    const others = Object.keys(input).filter((k) => !['ref', 'vary', 'chapter', 'as'].includes(k) && input[k] !== undefined);
    if (!given || others.length) throw new Error(`design_game: vary goes with a ref (and a chapter or seat) alone: it proposes and writes nothing${others.length ? ` (not with ${others.join(', ')})` : ''}`);
    return varyGame(given, input.vary, chapter);
  }
  // the world as it stood before this call, for readout: 'changed'
  const prior = given ? SketchRepository.getByRef(given) : null;
  const before = prior && isGameworldKind(prior.manifest?.kind) ? gameworldOf(prior.manifest) : null;
  // the quick path: one level, one goal; its gameworld is written here, and it is run at once (nothing to review)
  if (quick !== undefined && written !== undefined) throw new Error('design_game: `quick` writes the world itself; pass the world\'s own settings (id, name, style …) beside the goal as quick.world, or a whole `world` without quick');
  // the interpreter (gameworld/compose.js): a few words read into a whole world, stored as `world` is
  if (compose !== undefined && (written !== undefined || patch !== undefined || quick !== undefined)) throw new Error('design_game: `compose` writes the world from its words; give it alone, then edit the world with `patch`');
  // a hero named by its name (a named hero, create_character spec.name) is found on this machine: its ref is written
  const quickQ = quick !== undefined && isObj(quick.hero) && quick.hero.name !== undefined ? { ...quick, hero: { ref: namedHeroRef(quick.hero.name, quick.hero.ref) } } : quick;
  const world = withNamedHero(compose !== undefined ? composedWorld(compose) : quickQ !== undefined ? quickWorld({ ...(isObj(quickQ.world) ? quickQ.world : {}), quick: Object.fromEntries(Object.entries(quickQ).filter(([k]) => k !== 'world')) }) : written);
  const run = asked ?? (quick !== undefined ? true : undefined);
  // a reference, made on request (the creator asked to see one): a gameworld of its own, never mixed into theirs
  if (example !== undefined) {
    if (!REFERENCES[example]) throw new Error(`design_game: example is one of ${Object.keys(REFERENCES).join(', ')} (a reference made only when the creator asks to see one)`);
    if (world !== undefined || patch !== undefined || given !== undefined) throw new Error('design_game: an example is made on its own, at its own ref; it takes no world, patch or ref');
    const at = `example-${example}`;
    const out = SketchRepository.getByRef(at) ? await designGameHandler({ ref: at, run, check }, context) : await designGameHandler({ world: REFERENCES[example], ref: at, title: `Reference example: ${REFERENCES[example].name}`, run, check }, context);
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
    // a preview: what the patch would do, and nothing written
    if (preview === true) return previewPatch(ref, patchVehicleWords(patch).patch);
    // a quick game's vehicle word is read through the vehicle registry first, as the quick path reads it (doors.js)
    if (patch !== undefined) await oneWrite(ref, () => updateSketchHandler({ ref, patch: patchVehicleWords(patch).patch, ...(title ? { title } : {}) }));
  }
  // what the vehicle registry read: a word written as its table's key (absent when none was)
  const redirected = [...(quick !== undefined ? quickVehicleWords(quick).redirects : []), ...(patch !== undefined ? patchVehicleWords(patch).redirects : [])];
  try {
    const patched = list(patch).map((op) => op?.path).filter((p) => typeof p === 'string');
    // a job's report or a kept proposal: written before the readout reads the world
    // a req naming the main quest read as the levels it plays on (and those a run would lay, laid); then a job's report
    // or a kept proposal, written before the readout reads the world
    const reqIn = req !== undefined ? await questReq(ref, req) : undefined;
    const reqDone = reqIn !== undefined ? await oneWrite(ref, () => reqWrites(ref, reqIn)) : null;
    const out = await afterWrite(ref, { approve, revise, note, run, force, check, compare, before, shape, chapter, patched, req: reqIn, reqDone, ask, trace, production, seat }, context);
    return redirected.length ? { ...out, vehicles: { registry: redirected } } : out;
  } catch (err) {
    // the recipe is stored; the call failed after it: say where, so the next call fixes it in place
    throw new Error(`${err.message}\n— the gameworld is stored at '${ref}' as written; fix it with design_game({ ref: '${ref}', patch }) rather than starting a new one.`);
  }
}

// ONE WRITE AT A TIME A WORLD: a crew's authors report at once, and each patch is read whole and applied onto the recipe
// as it is stored; the update reads the recipe and awaits its gates before it writes, so two applied together would
// write over each other (the second dropping the first's segment). Each waits for the one before it; reads never wait.
const WRITES = new Map();
function oneWrite(ref, fn) {
  const run = (WRITES.get(ref) ?? Promise.resolve()).then(fn, fn);
  const tail = run.catch(() => {});
  WRITES.set(ref, tail);
  tail.then(() => { if (WRITES.get(ref) === tail) WRITES.delete(ref); });
  return run;
}

// what a job's seat may send beside `as`: its view (chapter, readout) and its report (req, naming its own job)
const SEAT_KEYS = new Set(['ref', 'as', 'chapter', 'readout', 'req']);

/** A job's seat (`as: '<req>.<job>'`, jobs.js seatOf): the job its brief names, the unit its view is, checked before
 * anything is written; a seat reads its own unit and reports its own job, and does nothing else. */
function jobSeat(input) {
  const extra = Object.keys(input).filter((k) => !SEAT_KEYS.has(k) && input[k] !== undefined);
  if (extra.length) throw new Error(`design_game: a job's seat (as) reads its view and reports its job, nothing else (not ${extra.join(', ')}): the director does the rest`);
  if (!input.ref) throw new Error('design_game: as names a job in a world: give its ref');
  const id = /^(r\d+)\./.exec(String(input.as))?.[1];
  const seat = seatOf(input.as, { req: id ? GameworldReqRepository.get(input.ref, id) : null, jobs: id ? GameworldReqJobRepository.list(input.ref, id) : [] });
  if (input.chapter !== undefined && !seat.units.includes(input.chapter)) throw new Error(`design_game: as '${input.as}' is ${seat.units.length > 1 ? `the ${seat.job.kind}'s, whose view is ${seat.units.join(' or ')}` : `${seat.job.kind} on ${seat.unit}: its view is that unit's`} (not ${input.chapter})`);
  if (input.req !== undefined && (input.req?.id !== seat.job.req || input.req?.job !== seat.job.id)) throw new Error(`design_game: as '${input.as}' reports its own job: req: { id: '${seat.job.req}', job: '${seat.job.id}', … }`);
  return seat;
}

/** The director's call on a req (production.js): settle it (DIRECTED, after the vertical slice, outside the pillars and
 * the checkpoints), send it back to its crew with a note (its authors reissued within the budget), or show the creator. */
function directReq(ref, W, { r, L, parts, note, direct, only = null, raised, advises }) {
  const jobs = GameworldReqJobRepository.list(ref, r.id);
  const rec = jobs.filter((j) => j.kind === 'assistant' && j.status === 'submitted').at(-1)?.report?.recommend ?? null;
  if (direct === 'settle') {
    const P = GameworldProductionRepository.get(ref);
    const slice = L.reqs.some((x) => unitOf(x.unit)?.level != null && x.status === 'accepted');
    const plays = W.mainQuest ? questPlays(W)?.plays ?? {} : {};
    const may = maySettle({ units: unitsOf(r), slice, checkpoints: P?.checkpoints ?? [], checkpointed: checkpointLevels(P?.checkpoints ?? [], { quest: W.mainQuest, plays }) });
    if (!may.may) throw new Error(`design_game: ${r.id} is not the director's to settle: ${may.why}`);
    const own = reqParts(r, parts);
    GameworldReqRepository.update(ref, r.id, { verdict: { status: 'directed', prints: Object.fromEntries(own.map((p) => [p.id, p.print])), print: unitPrint(W, r.unit), upstream: upstreamPrints(r.unit, W, r.crew ?? []), ...(note ? { note } : {}), ...(rec ? { recommended: rec } : {}) } });
    raised.push(`${r.id} directed: the director's call${rec ? ` (the assistant recommended ${rec})` : ''}; never the creator's accepted`);
  } else if (direct === 'rework') {
    // (`jobs`: the authors sent back, the rest of the crew's work kept as it stands; every author without it)
    const live = jobs.filter((j) => (j.kind === 'author' || j.kind === 'diverge') && j.status !== 'reissued');
    const unknown = (only ?? []).filter((id) => !live.some((j) => j.id === id));
    if (unknown.length) throw new Error(`design_game: ${unknown.join(', ')} is no author of ${r.id} to send back (its authors: ${live.map((j) => j.id).join(', ')})`);
    const authors = only ? live.filter((j) => only.includes(j.id)) : live;
    const R = GameworldReqRepository.get(ref, r.id);
    if (note) { GameworldReqNoteRepository.post(ref, r.id, 'director', note); GameworldReqRepository.update(ref, r.id, { notes: [...(R.notes ?? []), { unit: r.unit, part: 'director', note }] }); }
    for (const old of authors) {
      if (!reissuesLeft(GameworldReqRepository.get(ref, r.id), GameworldReqJobRepository.list(ref, r.id)) || !jobsLeft(R, GameworldReqJobRepository.list(ref, r.id))) { advises.push(`${r.id}: ${old.id} not reissued: the budget is spent`); continue; }
      GameworldReqJobRepository.update(ref, r.id, old.id, { status: 'reissued' });
      const [j] = GameworldReqJobRepository.issue(ref, r.id, [{ kind: old.kind, tier: old.tier, angle: old.angle, unit: old.unit, role: old.role }]);
      raised.push(`${r.id} ${j.id} ${j.kind}${j.unit ? ` ${j.unit}` : ''} issued (rework of ${old.id})`);
    }
    // (the critics and the assistant read the work again once an author has gone back; none went, they stand)
    if (raised.some((line) => line.startsWith(`${r.id} j`) && line.includes('(rework of '))) for (const c of jobs.filter((j) => (j.kind === 'critic' || j.kind === 'assistant') && j.status !== 'reissued')) GameworldReqJobRepository.update(ref, r.id, c.id, { status: 'reissued' });
  } else {
    GameworldReqRepository.update(ref, r.id, { verdict: { ...(r.verdict ?? {}), presented: true } });
    raised.push(`${r.id} shown to the creator: their verdict (approve, revise) is next`);
  }
}

/** A `req` as the door takes it: raise a unit ({ unit, remit?, staffing? }), or act on one ({ id, remit?, staffing?,
 * budget?, cancel?, accept?, note? }). Checked before anything is written. */
function checkReq(req) {
  if (!isObj(req)) throw new Error('design_game: req is { unit, remit?, staffing? } to raise a unit, { quest: true } for the main quest\'s beats, or { id, remit?, staffing?, budget?, cancel?, accept?, note? } for one raised');
  if (req.quest !== undefined) {
    if (req.quest !== true || req.unit !== undefined || req.id !== undefined) throw new Error('design_game: { req: { quest: true, staffing?, budget? } } asks for every built beat of the main quest, in its order; give no unit or id with it');
  } else if ((req.unit === undefined) === (req.id === undefined)) throw new Error('design_game: a req names its `unit` (to raise one) or its `id` (r1, r2 …), one or the other');
  const beat = typeof req.unit === 'string' && /^(beat|act):[a-z][a-z0-9-]*$/.test(req.unit);
  if (req.unit !== undefined && !beat && !unitOf(req.unit)) throw new Error(`design_game: a req's unit is a chapter (${CHAPTERS.map((c) => c.id).join(', ')}), one level as 'level:<id>', one segment of a planned map as 'level:<id>/<segment>', a main quest beat as 'beat:<id>', or a whole act of it as 'act:<id>' (its town, its outskirts and its dungeon, worked as one)`);
  if (req.segments !== undefined && (req.segments !== true || !(typeof req.unit === 'string' && unitOf(req.unit)?.level != null && unitOf(req.unit).segment == null))) throw new Error('design_game: segments: true goes with a planned map\'s level (unit: \'level:<id>\'): every segment of its plan, an author each, worked as one');
  if (req.staffing !== undefined && !STAFFING[req.staffing]) throw new Error(`design_game: a req's staffing is ${Object.keys(STAFFING).join(' or ')}`);
  if (req.remit !== undefined && req.remit !== null && !isObj(req.remit)) throw new Error('design_game: a req\'s remit is an object (a level\'s: in, out, band, idea, foes, beat)');
  if (req.budget !== undefined && !isObj(req.budget)) throw new Error('design_game: a req\'s budget is an object (jobs, tier, diverge, critics, reissues)');
  if (req.cancel && req.accept) throw new Error('design_game: a req is cancelled or accepted, not both');
  const acts = ['start', 'job', 'keep', 'reissue', 'probe', 'assist', 'direct'].filter((k) => req[k] !== undefined);
  if (acts.length && req.id === undefined) throw new Error('design_game: start, job, keep, reissue, probe, assist and direct act on a raised req: give its `id`');
  if (acts.length > 1) throw new Error(`design_game: a req call does one of start, job, keep, reissue, probe, assist, direct (given ${acts.join(', ')})`);
  if (req.direct !== undefined && !DIRECTS[req.direct]) throw new Error(`design_game: direct is ${Object.entries(DIRECTS).map(([k, v]) => `${k} (${v})`).join(', ')}`);
  if (req.jobs !== undefined && (req.direct !== 'rework' || !Array.isArray(req.jobs) || !req.jobs.length || req.jobs.some((j) => typeof j !== 'string'))) throw new Error('design_game: jobs names the authors a rework sends back (direct: \'rework\', jobs: [\'j2\']); without it every author goes back');
  if (req.style !== undefined && !STYLES[req.style]) throw new Error(`design_game: a style is ${Object.keys(STYLES).join(', ')}`);
  if (req.crew !== undefined && (req.crew !== true || !(typeof req.unit === 'string' && /^(beat|act):/.test(req.unit)))) throw new Error('design_game: crew: true goes with a beat (unit: \'beat:<id>\'): its level and the departments the beat brings, worked as one (an act, \'act:<id>\', is always a crew)');
  if (req.post !== undefined && (req.job === undefined || typeof req.post !== 'string' || !req.post.trim())) throw new Error('design_game: a job posts to its crew\'s notebook as { id, job, post: \'…\' }');
  if (req.job === undefined && ['patch', 'decisions', 'findings'].some((k) => req[k] !== undefined)) throw new Error('design_game: a patch, decisions or findings report a job: give its `job` (j1, j2 …)');
}

/** A req that names the main quest (gameworld/quest-reqs.js): a beat (`beat:<id>`) or every built beat (`quest: true`),
 * read as the levels they are played on, each with its remit filled from the quest (the director's own words winning,
 * key by key). A beat whose level a run would lay is laid now, as the run lays it, so its req has a level to name.
 * → the req as the ledger takes it ({ …, raise: [{ unit, remit, beat }], questSaid? }), or the req as it was. */
async function questReq(ref, req) {
  // a planned map's SEGMENTS (gameworld/segments.js): one req, its first segment the unit and the rest its crew, an
  // author each; the segments' page laid, so each author's set lands
  const seg = typeof req.unit === 'string' ? unitOf(req.unit) : null;
  if (seg?.level != null && (req.segments === true || seg.segment != null)) {
    const W0 = gameworldOf(SketchRepository.getByRef(ref).manifest);
    try { (req.segments ? segmentUnits(W0, seg.level) : [req.unit]).forEach((u) => checkSegment(W0, u)); } catch (e) { throw new Error(`design_game: ${e.message}`); }
    if (!isObj(W0.levels[seg.level].glyphs.segments)) await updateSketchHandler({ ref, patch: [{ op: 'set', path: `/levels/${seg.level}/glyphs/segments`, value: {} }], note: 'design_game: the planned map\'s segments laid for its authors' });
    // (and its sketch's: each author plans its segment in miniature too, level/map-sketch.js)
    const sk = W0.levels[seg.level].glyphs.sketch;
    if (!isObj(sk) || !isObj(sk.segments)) await updateSketchHandler({ ref, patch: [{ op: 'set', path: `/levels/${seg.level}/glyphs/sketch`, value: { ...(isObj(sk) ? sk : {}), segments: {} } }], note: 'design_game: the planned map\'s sketch laid for its authors' });
    if (req.segments === true) {
      const units = segmentUnits(W0, seg.level), { unit: _u, segments: _s, ...rest } = req;
      // (a budget for the crew: an author a segment and one rework each, the critics and the assistant beside them)
      return { ...rest, budget: req.budget ?? { jobs: units.length * 2 + 3, reissues: units.length }, raise: [{ unit: units[0], remit: req.remit ?? null, crew: units.slice(1) }] };
    }
  }
  const beat = typeof req.unit === 'string' && req.unit.startsWith('beat:') ? req.unit.slice(5) : null;
  const act = typeof req.unit === 'string' && req.unit.startsWith('act:') ? req.unit.slice(4) : null;
  if (!beat && !act && req.quest !== true) return req;
  let W = gameworldOf(SketchRepository.getByRef(ref).manifest);
  // an act: ONE req, its first level the unit, the rest of its levels and the departments its beats bring the crew
  if (act) {
    actUnit(W, act);
    const laid0 = withQuestLevels(W);
    if (laid0 !== W) {
      await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/levels', value: laid0.levels }], note: 'design_game: the main quest\'s levels laid for its reqs' });
      W = gameworldOf(SketchRepository.getByRef(ref).manifest);
    }
    const A = actUnit(W, act), { unit: _u, remit: remit0, crew: _c, ...rest0 } = req;
    return { ...rest0, raise: [{ unit: `level:${A.levels[0]}`, beat: `act ${act}`, remit: { ...actRemit(W, act), ...(isObj(remit0) ? remit0 : {}) }, crew: [...A.levels.slice(1).map((lv) => `level:${lv}`), ...A.crew] }] };
  }
  const wanted = beat ? [{ beat, level: beatUnit(W, beat).level }] : questUnits(W).units;
  const listed = beat ? null : questUnits(W);
  // the levels a run would lay from the quest's beats, laid now (main-quest-lay.js: deterministic, the run's own lay)
  const laid = withQuestLevels(W);
  if (laid !== W) {
    await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/levels', value: laid.levels }], note: 'design_game: the main quest\'s levels laid for its reqs' });
    W = gameworldOf(SketchRepository.getByRef(ref).manifest);
  }
  const { unit: _u, quest: _q, remit, crew: _c, ...rest } = req;
  const raise = wanted.map((x) => ({ unit: `level:${x.level}`, beat: x.beat, remit: { ...beatRemit(W, x.beat), ...(beat && isObj(remit) ? remit : {}) }, ...(req.crew ? { crew: beatCrew(W, x.beat) } : {}) }));
  const questSaid = listed ? [...(listed.planned.length ? [`planned, not asked for yet: ${listed.planned.join(', ')}`] : []), ...listed.unhosted.map((x) => `${x.beat} is played on no level${x.as ? ` (as ${x.as})` : ''}: not a level's req`)] : [];
  return { ...rest, raise, ...(questSaid.length ? { questSaid } : {}) };
}

/** A job's proposal applied to the recipe, as the door applies any patch. */
async function applyProposal(ref, r, job) {
  await updateSketchHandler({ ref, patch: patchVehicleWords(job.report.patch).patch, note: `design_game: ${r.id} ${job.id} (${job.kind}) kept` });
}

/** The critics a kept proposal is given, as many as the budget leaves. → lines said */
function issueCritics(ref, r) {
  const plan = criticPlan(r), left = jobsLeft(r, GameworldReqJobRepository.list(ref, r.id));
  const issued = GameworldReqJobRepository.issue(ref, r.id, plan.slice(0, left));
  return [...issued.map((j) => `${j.id} critic issued (${j.lens})`), ...(plan.length > left ? [`${plan.length - left} critic(s) not issued: the budget's jobs are spent`] : [])];
}

/** A req's writes, before the readout is read: a job's report (an author's patch applied when it is the only author,
 * a diverge author's held, a critic's findings kept) and a kept proposal (its patch applied, its siblings declined,
 * its critics issued). → lines said, or null */
async function reqWrites(ref, req) {
  if (req.probe) return probeReq(ref, req);
  if (req.job === undefined && req.keep === undefined) return null;
  // a crew's notebook: what one job found that the others need (crews: posted as it works, read in every view)
  if (req.post !== undefined) {
    const r0 = GameworldReqRepository.get(ref, req.id);
    if (!r0 || !GameworldReqJobRepository.get(ref, r0.id, req.job)) throw new Error(`design_game: no job '${req.job}' on '${req.id}'`);
    GameworldReqNoteRepository.post(ref, r0.id, req.job, req.post.trim().slice(0, 1024));
    return [`${req.job} posted to ${r0.id}'s notebook`];
  }
  const r = GameworldReqRepository.get(ref, req.id);
  if (!r) throw new Error(`design_game: no req '${req.id}' in this world (${GameworldReqRepository.list(ref).map((x) => x.id).join(', ') || 'none raised'})`);
  const jobs = GameworldReqJobRepository.list(ref, r.id), said = [];
  const named = (id) => jobs.find((j) => j.id === id) ?? null;
  if (req.job !== undefined) {
    const job = named(req.job);
    if (!job) throw new Error(`design_game: no job '${req.job}' on ${r.id} (${jobs.map((j) => j.id).join(', ') || 'none issued: start it'})`);
    try { checkSubmit(job, req); } catch (e) { throw new Error(`design_game: ${e.message}`); }
    // (a segment's author writes its segment only: two authors of one map never write one path)
    const seg = (job.kind === 'author' || job.kind === 'diverge') ? unitOf(jobUnit(job, r)) : null;
    const past = seg?.segment != null ? outsideOf(jobUnit(job, r), req.patch) : [];
    if (past.length) throw new Error(`design_game: ${job.id}'s patch is refused, nothing written (${job.id} stays issued): ${jobUnit(job, r)} writes its segment only (/levels/${seg.level}/glyphs/segments/${seg.segment} and its sketch, /levels/${seg.level}/glyphs/sketch/segments/${seg.segment}), not ${past.join(', ')}`);
    // (a segment's sketch is approved by the creator, never by its author)
    if (seg?.segment != null && approvesSketch(req.patch)) throw new Error(`design_game: ${job.id}'s patch is refused, nothing written (${job.id} stays issued): a segment's sketch is approved by the creator, never by its author (leave its status a draft)`);
    // a patch the door would refuse is refused before anything is written and before the job moves: the recipe and the
    // job stay as they were, so the job reports again (an author's patch is applied at once, a diverge one later)
    if (Array.isArray(req.patch) && (job.kind === 'author' || job.kind === 'diverge')) {
      const row = SketchRepository.getByRef(ref);
      try { gameworldGraph(gameworldOf(applyManifestPatch(row.manifest, patchVehicleWords(req.patch).patch).manifest)); }   // (the world read, every level's walk read)
      catch (e) { throw new Error(`design_game: ${job.id}'s patch is refused, nothing written (${job.id} stays issued: fix it and report again): ${e.message.replace(/^gameworld: /, '')}`); }
    }
    const outside = job.kind === 'critic' || job.kind === 'assistant' ? [] : outsideOf(jobUnit(job, r), req.patch);
    const report = { ...(req.patch ? { patch: req.patch } : {}), ...(req.decisions ? { decisions: req.decisions } : {}), ...(req.findings ? { findings: req.findings } : {}), ...(req.recommend ? { recommend: req.recommend, reasons: req.reasons, ...(req.fixes ? { fixes: req.fixes } : {}), ...(req.bolder ? { bolder: req.bolder } : {}) } : {}), ...(Array.isArray(req.asks) ? { asks: req.asks } : {}), ...(Array.isArray(req.warnings) ? { warnings: req.warnings } : {}), ...(outside.length ? { outside } : {}) };
    if (job.kind === 'author') {
      // the only author: its proposal is the unit's, applied at once
      await applyProposal(ref, r, { ...job, report });
      GameworldReqJobRepository.update(ref, r.id, job.id, { status: 'kept', report: { ...report, rev: headRev(ref) } });
      // (a crew's critics come once every author is kept)
      const authors = GameworldReqJobRepository.list(ref, r.id).filter((j) => j.kind === 'author' && j.status !== 'reissued');
      const allKept = authors.every((j) => j.status === 'kept');
      said.push(`${job.id} author kept: its patch applied`, ...(allKept ? issueCritics(ref, r) : [`${authors.filter((j) => j.status !== 'kept').length} of the crew still to report`]));
    } else {
      GameworldReqJobRepository.update(ref, r.id, job.id, { status: 'submitted', report });
      said.push(job.kind === 'diverge' ? `${job.id} diverge held: keep one of the proposals ({ req: { id: '${r.id}', keep } })`
        : job.kind === 'assistant' ? `${job.id} the assistant director recommends ${req.recommend}: ${req.reasons.join('; ')} (the director decides: { req: { id: '${r.id}', direct } })`
        : `${job.id} critic reported ${req.findings.length} finding(s)`);
    }
    if (outside.length) said.push(`${job.id} wrote past ${r.unit}: ${outside.join(', ')}`);
    // what the remit asked that no word of the recipe reaches: a gap said to the director, never faked
    if (req.asks?.length) said.push(`${job.id} asks for what no word reaches: ${req.asks.join('; ')}`);
  } else {
    const job = named(req.keep);
    if (!job || job.kind !== 'diverge' || job.status !== 'submitted') throw new Error(`design_game: keep names a diverge proposal that has reported (${jobs.filter((j) => j.kind === 'diverge' && j.status === 'submitted').map((j) => j.id).join(', ') || 'none yet'})`);
    if (jobs.some((j) => j.status === 'kept' && j.kind !== 'critic')) throw new Error(`design_game: ${r.id} has a kept proposal already; reissue to try again`);
    await applyProposal(ref, r, job);
    GameworldReqJobRepository.update(ref, r.id, job.id, { status: 'kept', report: { ...job.report, rev: headRev(ref) } });
    for (const j of jobs.filter((x) => x.kind === 'diverge' && x.id !== job.id && (x.status === 'submitted' || x.status === 'issued'))) GameworldReqJobRepository.update(ref, r.id, j.id, { status: 'declined' });
    said.push(`${job.id} kept: its patch applied; the other proposals declined and kept on record`, ...issueCritics(ref, r));
  }
  return said;
}

/** The play probe on a level req's stages as they stand (game/level-probe.js, a machine gate), kept as the req's ride
 * job: its verdict, the prints of the stages it played, and its frames on disk for the look critic. → lines said */
async function probeReq(ref, req) {
  const r = GameworldReqRepository.get(ref, req.id);
  if (!r) throw new Error(`design_game: no req '${req.id}' in this world (${GameworldReqRepository.list(ref).map((x) => x.id).join(', ') || 'none raised'})`);
  // (every level the req holds: its own, and a chapter's crew's, each played as its own level)
  const lvs = reqLevels(r);
  if (!lvs.length) throw new Error(`design_game: the probe plays a level; ${r.id} is ${r.unit}`);
  const W = gameworldOf(SketchRepository.getByRef(ref).manifest), made = W.made ?? {};
  const keysOf = (lv) => Object.keys(made).filter((k) => levelStep(lv).test(k)).sort(), keys = lvs.flatMap(keysOf);
  const unmade = lvs.filter((lv) => !keysOf(lv).length);
  if (unmade.length) return [`${r.id}: no stage of ${unmade.map((lv) => `level:${lv}`).join(', ')} made yet: ${unmade.map((lv) => `{ ref, chapter: 'level:${lv}', run: true }`).join(', ')} first`];
  const { levelBrowser, levelPage } = await import('@/lib/graph/game/first-frame-check');
  const { probeLevel, mergeVerdicts } = await import('@/lib/graph/game/level-probe.js');
  const n = GameworldReqJobRepository.list(ref, r.id).length + 1;
  const { mkdir, writeFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const framesDir0 = path.join(process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes'), 'probes', ref.replace(/[^A-Za-z0-9_-]/g, '_'), `${r.id}-j${n}`);
  const verdicts = [];
  for (const lv of lvs) {
    const stages = [];
    for (const k of keysOf(lv)) {
      const at = made[k].ref;
      // eslint-disable-next-line no-await-in-loop -- one stage page at a time
      stages.push({ ref: at, manifest: SketchRepository.getByRef(at)?.manifest ?? null, ...(await levelPage(at)) });
    }
    // eslint-disable-next-line no-await-in-loop -- one level at a time
    verdicts.push([lv, await withoutWarm(() => probeLevel(stages, {
      goal: W.levels?.[lv]?.goal, findBrowser: levelBrowser, framesDir: lvs.length > 1 ? path.join(framesDir0, lv) : framesDir0,
      writeFile: async (file, png) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, png); },
    }))]);
  }
  const verdict = verdicts.length > 1 ? mergeVerdicts(verdicts) : verdicts[0][1];
  const prints = Object.fromEntries(keys.map((k) => [k, made[k]?.stored ?? null]));
  const [job] = GameworldReqJobRepository.issue(ref, r.id, [{ kind: 'probe', tier: 'ride' }]);
  GameworldReqJobRepository.update(ref, r.id, job.id, { status: 'submitted', report: { ...verdict, prints } });
  const failing = (verdict.checks ?? []).filter((c) => !c.holds);
  return [verdict.holds ? `${job.id} probe holds on ${keys.length} stage(s) (machine gate; the eyes gate has not run)`
    : verdict.skipped ? `${job.id} probe ${verdict.skipped}` : `${job.id} probe does not hold: ${failing.map((c) => `${c.check}: ${c.says}`).join('; ') || verdict.note}`];
}

/** A composite's build: the stages of its accepted levels and everything they share (the hero, the casts, the foes),
 * never a level no one has worked yet (a level's stages are its own unit's to make, { chapter: 'level:<id>', run }). */
const composedBuild = (steps, composite) => (Array.isArray(composite) ? steps.filter((s) => !/^level-/.test(s.key) || composite.some((id) => levelStep(id).test(s.key))) : steps);

/** The levels the game is made of (runner.js composedStages): when the world's ledger asks for levels one at a time,
 * the ones the creator has accepted as they stand, so the game is always playable to its last accepted level; a world
 * that asks for none is made whole, as before (undefined). */
function compositeOf(ref, W) {
  const rows = GameworldReqRepository.list(ref).filter((r) => unitOf(r.unit)?.level != null);
  if (!rows.length) return undefined;
  const parts = reviewState(W);
  // (a chapter's req brings every level it holds: its crew's too)
  const accepted = new Set(rows.filter((r) => ['accepted', 'directed'].includes(reqStatus(r, { world: W, parts }))).flatMap((r) => reqLevels(r)));
  return Object.keys(W.levels ?? {}).filter((id) => accepted.has(id));
}

/** A req's received gate, as the ledger reads it: its jobs, the unit's parts, the world's record. */
const receiptFor = (ref, W, parts) => (r) => receiptOf(r, { jobs: GameworldReqJobRepository.list(ref, r.id), parts, world: W, made: W.made ?? {} });
// the probe as the director's next move reads it: not played (or its stages moved), skipped (no browser: the loop
// degrades, it never breaks), failed (back to its author), or holding
const probeState = (receipt) => {
  const c = receipt.checks.find((x) => x.check === 'probe');
  if (!c) return 'none';
  if (c.holds) return 'holds';
  if (/^skipped/.test(c.says ?? '')) return 'skipped';
  return /probe again|not played|no stage/.test(c.says ?? '') ? 'none' : 'failed';
};

// (an op that sets a sketch's status approved: the whole segment's sketch, or its status alone)
const approvesSketch = (patch = []) => patch.some((op) => typeof op?.path === 'string' && /\/glyphs\/sketch\/segments\/[^/]+(\/status)?$/.test(op.path) && (op.value === 'approved' || op.value?.status === 'approved'));
// (a segment's author is handed its plan's remit: its gates, role, words, the beats on it, the floor its fill lays)
const segmentBrief = (W, j, r) => ((j.kind === 'author' || j.kind === 'diverge') && unitOf(jobUnit(j, r))?.segment != null ? { segment: segmentRemit(W, jobUnit(j, r)) } : {});

/** A req as its unit's view carries it: its remit, precedent, budget, what the director does next, and its jobs (an
 * issued job's brief, a reported one's report). */
function reqView(ref, r, reqs, { W, parts, seat = null, agents = false }) {
  const jobs = GameworldReqJobRepository.list(ref, r.id);
  const receipt = receiptOf(r, { jobs, parts, world: W, made: W.made ?? {} });
  const level = unitOf(r.unit)?.level != null;
  const V = reqForView(r, reqs), mine = GameworldAskRepository.askOf(ref, r.id);
  // the intent each was made for (the production ledger): this unit's, and the last accepted unit's in its precedent
  const lastAsk = V.precedent?.last ? GameworldAskRepository.askOf(ref, V.precedent.last.id) : null;
  if (lastAsk) V.precedent.last = { ...V.precedent.last, intent: lastAsk.intent };
  const notebook = GameworldReqNoteRepository.list(ref, r.id);
  return {
    ...V, ...(r.crew?.length ? { crew: unitsOf(r) } : {}), ...(r.style ? { style: r.style } : {}),
    ...(mine ? { intent: { ask: mine.id, intent: mine.intent } } : {}), does: nextOf(jobs, { level, probe: probeState(receipt), presented: !!r.verdict?.presented }), receipt,
    ...(notebook.length ? { notebook } : {}),
    ...(jobs.length ? { jobs: jobs.filter((j) => !seat || j.id === seat.job.id || seat.job.kind === 'assistant').map((j) => (j.status === 'issued' ? { ...jobBrief(j, r, { ref, agents }), ...segmentBrief(W, j, r) } : j.kind === 'probe' ? { job: j.id, kind: 'probe', holds: j.report?.holds ?? false, ...(j.report?.skipped ? { skipped: j.report.skipped } : {}), checks: j.report?.checks ?? [], frames: (j.report?.frames ?? []).map((f) => f.file ?? `${f.ref} at ${f.at}s`) } : jobReport(j))) } : {}),
  };
}

const TERMINAL_REQ = new Set(['accepted', 'directed', 'cancelled', 'gone']);

/** The ledger worked and read: the creator's notes kept, the `req` acted on (raise with its pull-through, edit, cancel,
 * accept a unit with no review part), the ledger read again. → { L, summary } */
/** Each level's intent laws that do not hold (lay-concerns.js: each level step's `laws`, as the run plans them), by its
 * part: { 'level:<id>': [law] }. The run says them as advice; the received gate holds a level's req to them. */
function levelLaws(ref, W) {
  let steps;
  try { steps = runSteps(W.mainQuest ? withQuestLevels(W) : W, { ref, lookup: heroLookup(heroRefOf(W, ref)) }); } catch { return {}; }
  return levelLawsOf(steps);
}

/** The stamps the ledger reads (reqs.js): every part's, as the readout's own are made, with their prints and the laws that
 * advise (`machine`); never the readout's projection of them, which carries neither. */
function ledgerStamps(ref, W) {
  return [...reviewState(W, { machine: levelLaws(ref, W) }), ...(W.characters ? characterState(W, { lookup: heroLookup(heroRefOf(W, ref)) }) : []), ...(castable(W) ? foeState(W) : [])];
}

function workLedger(ref, W, full, req, done = null) {
  const parts = ledgerStamps(ref, W), book = full.chapters ?? [];
  // the creator's notes on what they sent back: kept as the precedent the next unit reads; and a unit first read
  // accepted keeps the prints of the chapters it reads, so a move upstream after it stales it
  for (const r of GameworldReqRepository.list(ref)) {
    const notes = notesWith(r, parts);
    if (notes) GameworldReqRepository.update(ref, r.id, { notes });
    if (!r.verdict?.upstream && r.verdict?.status !== 'cancelled' && reqStatus(r, { world: W, parts }) === 'accepted') GameworldReqRepository.update(ref, r.id, { verdict: { ...(r.verdict ?? {}), upstream: upstreamPrints(r.unit, W) } });
  }
  const received = receiptFor(ref, W, parts);
  const raised = [], advises = [];
  if (req !== undefined) {
    const L = readLedger(GameworldReqRepository.list(ref), { world: W, parts, received: (r) => received(r).holds });
    const edit = { ...(req.remit !== undefined ? { remit: req.remit } : {}), ...(req.staffing !== undefined ? { staffing: req.staffing } : {}), ...(req.budget !== undefined ? { budget: req.budget } : {}), ...(req.id !== undefined && req.style !== undefined ? { style: req.style } : {}) };
    const asks = req.raise ?? (req.unit !== undefined ? [{ unit: req.unit, remit: req.remit }] : null);
    if (asks) {
      // (one unit, or the main quest's beats in its order: each its own req, the first open and the rest queued)
      let first = true;
      for (const ask of asks) {
        const LL = readLedger(GameworldReqRepository.list(ref), { world: W, parts });
        const lv = unitOf(ask.unit).level;
        for (const c of ask.crew ?? []) { const cl = unitOf(c)?.level; if (cl != null && !isObj(W.levels?.[cl])) throw new Error(`design_game: no level '${cl}' in this world (its levels: ${Object.keys(W.levels ?? {}).join(', ') || 'none'})`); }
        if (lv != null && !isObj(W.levels?.[lv])) throw new Error(`design_game: no level '${lv}' in this world (its levels: ${Object.keys(W.levels ?? {}).join(', ') || 'none'})`);
        const live = LL.reqs.find((r) => r.unit === ask.unit && !TERMINAL_REQ.has(r.status));
        const remit = ask.remit ?? null;
        if (live) {
          const own = { ...(req.raise ? {} : edit) };
          if (Object.keys(own).length) GameworldReqRepository.update(ref, live.id, own);
          advises.push(`${ask.unit} is already asked for: ${live.id} (${live.status})`);
        } else {
          if (first && LL.current) advises.push(`${LL.current.id} (${LL.current.unit}) is open: accept it or send it back first; ${asks.length > 1 ? 'these are' : `${ask.unit} is`} queued after it`);
          for (const up of pullThrough(ask.unit, { book, reqs: LL.reqs })) {
            const r = GameworldReqRepository.create({ worldRef: ref, unit: up, raisedBy: 'pull-through' });
            raised.push(`${r.id} ${up} (pulled through: ${ask.unit} reads it)`);
          }
          const r = GameworldReqRepository.create({ worldRef: ref, unit: ask.unit, remit, staffing: req.staffing ?? 'soloist', budget: req.budget ?? {}, raisedBy: ask.beat ? 'quest' : 'director', crew: ask.crew ?? null, style: req.style ?? null });
          raised.push(`${r.id} ${ask.unit}${ask.crew?.length ? ` + ${ask.crew.join(', ')}` : ''}${ask.beat ? ` (${ask.beat.startsWith('act ') ? ask.beat : `beat ${ask.beat}`})` : ''}`);
        }
        advises.push(...remitAdvice(ask.unit, remit ?? live?.remit));
        first = false;
      }
      advises.push(...(req.questSaid ?? []));
    } else {
      const r = GameworldReqRepository.get(ref, req.id);
      if (!r) throw new Error(`design_game: no req '${req.id}' in this world (${L.reqs.map((x) => x.id).join(', ') || 'none raised'})`);
      const own = unitParts(r.unit, parts);
      // a unit with parts is accepted by approving them; accepted again after a move upstream on the creator's word
      const upstreamStale = own.length && own.every((p) => p.status === 'approved') && reqStatus(r, { world: W, parts }) === 'stale';
      if (req.accept && own.length && !upstreamStale) throw new Error(`design_game: ${r.unit} is accepted by approving its parts (${own.map((p) => p.id).join(', ')}): { ref, approve: [...] }`);
      const verdict = req.cancel ? { status: 'cancelled', ...(req.note ? { note: req.note } : {}) }
        : req.accept && upstreamStale ? { ...(r.verdict ?? {}), upstream: upstreamPrints(r.unit, W), ...(req.note ? { note: req.note } : {}) }
        : req.accept ? { status: 'accepted', print: unitPrint(W, r.unit), upstream: upstreamPrints(r.unit, W), ...(req.note ? { note: req.note } : {}) } : undefined;
      GameworldReqRepository.update(ref, r.id, { ...edit, ...(verdict ? { verdict } : {}) });
      const jobs = GameworldReqJobRepository.list(ref, r.id);
      if (req.start) {
        // its authors, by its staffing (the budget's jobs bound them); started twice, once
        if (jobs.length) advises.push(`${r.id} is started: ${jobLines(jobs).join(' · ')}`);
        else {
          const R = GameworldReqRepository.get(ref, r.id), plan = authorPlan(R), left = jobsLeft(R, jobs);
          const L0 = L.reqs.find((x) => x.id === r.id);
          if (L.current && L.current.id !== r.id) advises.push(`${r.id} started out of order: ${L.current.id} (${L.current.unit}) is the one being worked`);
          for (const j of GameworldReqJobRepository.issue(ref, r.id, plan.slice(0, left).map((x) => ({ ...x, role: roleOf(ref, x.kind, x.unit ?? r.unit) })))) raised.push(`${r.id} ${j.id} ${j.kind}${j.unit ? ` ${j.unit}` : ''} issued${j.angle ? ` (${j.angle.split(':')[0]})` : ''}`);
          if (plan.length > left) advises.push(`${r.id}: ${plan.length - left} author(s) not issued: the budget's jobs are spent`);
          if (L0 && TERMINAL_REQ.has(L0.status)) advises.push(`${r.id} is ${L0.status}`);
        }
      }
      if (req.assist) {
        // the assistant director: prepares the director's call, in the posture its style sets (production.js)
        const live = jobs.find((j) => j.kind === 'assistant' && j.status !== 'reissued');
        if (live) advises.push(`${r.id} has its assistant director: ${live.id} (${live.status})`);
        else {
          const P = GameworldProductionRepository.get(ref), R = GameworldReqRepository.get(ref, r.id);
          const [j] = GameworldReqJobRepository.issue(ref, r.id, [{ kind: 'assistant', tier: 'judge', posture: postureOf(R, P), role: roleOf(ref, 'assistant') }]);
          raised.push(`${r.id} ${j.id} assistant issued (${j.posture})`);
          const L0 = L.reqs.find((x) => x.id === r.id);
          if (L0 && L0.status !== 'received') advises.push(`${r.id} is ${L0.status}, not yet received: the assistant reads what its gate says`);
        }
      }
      if (req.direct !== undefined) directReq(ref, W, { r, L, parts, note: req.note, direct: req.direct, only: req.jobs ?? null, raised, advises });
      if (req.reissue !== undefined) {
        const old = jobs.find((j) => j.id === req.reissue);
        if (!old) throw new Error(`design_game: no job '${req.reissue}' on ${r.id} (${jobs.map((j) => j.id).join(', ') || 'none issued'})`);
        if (old.status === 'kept' || old.status === 'reissued') throw new Error(`design_game: ${old.id} is ${old.status}: a kept or reissued job is not reissued`);
        const R = GameworldReqRepository.get(ref, r.id);
        if (!reissuesLeft(R, jobs) || !jobsLeft(R, jobs)) advises.push(`${r.id}: ${old.id} not reissued: the budget's ${!reissuesLeft(R, jobs) ? 'reissues' : 'jobs'} are spent; raise the budget ({ req: { id: '${r.id}', budget } }) or work with what was made`);
        else {
          GameworldReqJobRepository.update(ref, r.id, old.id, { status: 'reissued' });
          const [j] = GameworldReqJobRepository.issue(ref, r.id, [{ kind: old.kind, tier: old.tier, angle: old.angle, lens: old.lens, unit: old.unit, role: old.role, posture: old.posture }]);
          raised.push(`${r.id} ${j.id} ${j.kind} issued (reissue of ${old.id})`);
        }
      }
    }
  }
  const L = readLedger(GameworldReqRepository.list(ref), { world: W, parts, received: (r) => received(r).holds });
  const summary = ledgerSummary(L);
  if (summary?.current) {
    const jobs = GameworldReqJobRepository.list(ref, L.current.id), receipt = received(L.current);
    summary.current = { ...summary.current, ...(L.current.crew?.length ? { crew: L.current.crew } : {}), does: nextOf(jobs, { level: unitOf(L.current.unit)?.level != null, probe: probeState(receipt), presented: !!L.current.verdict?.presented }), ...(jobs.length ? { jobs: jobLines(jobs) } : {}), ...(receipt.holds ? {} : { gate: receipt.checks.filter((c) => !c.holds).map((c) => c.check) }) };
  }
  return { L, received, summary: summary ? { ...summary, ...(done?.length ? { done } : {}), ...(raised.length ? { raised } : {}), ...(advises.length ? { advises } : {}) } : null };
}

/**
 * THE IMPACT PREVIEW — design_game({ ref, patch, preview: true }): the patch applied in memory, as update_sketch applies
 * it (manifest-patch.js), and nothing written. It says what the patch would reach before it is made: the chapters it
 * touches, the approved parts that would come back for review, the accepted units that would go stale (their own parts
 * or a chapter they read), what a run would make, remake or drop, and the accepted levels the game would lose. So a
 * change that reaches far ("make the world moodier" restales every accepted level) is said before, not after.
 */
function previewPatch(ref, ops) {
  const row = SketchRepository.getByRef(ref);
  const W0 = gameworldOf(row.manifest);
  const W1 = gameworldOf(applyManifestPatch(row.manifest, ops).manifest);
  readGameworld(W1);   // a patch the door would refuse is refused here too, with the same words
  const s0 = ledgerStamps(ref, W0), s1 = ledgerStamps(ref, W1);
  const touches = [...new Set(ops.map((o) => o?.path).filter((x) => typeof x === 'string').flatMap((x) => chaptersOfPath(x).map((c) => c.id)))];
  const review = s1.filter((p) => p.status === 'changed' && s0.find((q) => q.id === p.id)?.status === 'approved').map((p) => p.id);
  const stale = GameworldReqRepository.list(ref).filter((r) => reqStatus(r, { world: W0, parts: s0 }) === 'accepted' && reqStatus(r, { world: W1, parts: s1 }) === 'stale').map((r) => `${r.id} ${r.unit}`);
  // what a run would do: the steps as each world would lay them (its main quest's levels laid, its composite), by print
  const c0 = compositeOf(ref, W0), c1 = compositeOf(ref, W1);
  let run = null;
  try {
    const lay = (W) => (W.mainQuest ? withQuestLevels(W) : W);
    const st0 = runSteps(lay(W0), { ref, lookup: heroLookup(heroRefOf(W0, ref)), composite: c0 });
    const st1 = runSteps(lay(W1), { ref, lookup: heroLookup(heroRefOf(W1, ref)), composite: c1 });
    const p0 = new Map(st0.map((x) => [x.key, x.print])), k1 = new Set(st1.map((x) => x.key));
    run = {
      remake: st1.filter((x) => p0.has(x.key) && p0.get(x.key) !== x.print).map((x) => x.key),
      make: st1.filter((x) => !p0.has(x.key)).map((x) => x.key),
      gone: st0.filter((x) => !k1.has(x.key)).map((x) => x.key),
    };
  } catch (err) { run = { unread: err.message.split('\n')[0] }; }
  const drops = (c0 ?? []).filter((id) => !(c1 ?? []).includes(id));
  return {
    ok: true, readout: 'preview', ref, written: false,
    touches, ...(review.length ? { review } : {}), ...(stale.length ? { stale } : {}), run, ...(drops.length ? { composite: { drops } } : {}),
    note: 'nothing written: the same patch without preview makes it',
  };
}

/** The ticket for a call: a new ask cut ({ intent, units? }) or an existing one named (a3), and what the call did linked
 * to it: the reqs it raised, the verdicts it gave, the patch it wrote, the run it made, each at the revision it left. */
function linkAsk(ref, ask, { raised = [], approve, revise, patched = [], ran }) {
  const A = typeof ask === 'string' ? GameworldAskRepository.get(ref, ask) : GameworldAskRepository.create({ worldRef: ref, intent: ask.intent.trim(), units: ask.units ?? null });
  if (!A) throw new Error(`design_game: no ask '${ask}' in this world (${GameworldAskRepository.list(ref).map((a) => a.id).join(', ') || 'none cut'})`);
  const rev = headRev(ref), linked = [];
  for (const line of raised) { const id = /^(r\d+) /.exec(line)?.[1]; if (id) { GameworldAskRepository.link(ref, A.id, 'req', id); linked.push(id); } }
  for (const part of list(approve)) { GameworldAskRepository.link(ref, A.id, 'verdict', part, { status: 'approved', rev }); linked.push(`approved ${part}`); }
  if (isObj(revise) && revise.part) { GameworldAskRepository.link(ref, A.id, 'verdict', revise.part, { status: 'revise', ...(revise.note ? { note: revise.note } : {}), rev }); linked.push(`sent back ${revise.part}`); }
  if (patched.length) { GameworldAskRepository.link(ref, A.id, 'patch', rev, { paths: patched }); linked.push(`patch at rev ${rev}`); }
  const made = (ran ?? []).filter((r) => r.action === 'make' || r.action === 'remake').map((r) => r.key);
  if (made.length) { GameworldAskRepository.link(ref, A.id, 'run', rev, { made }); linked.push(`run made ${made.length}`); }
  return { id: A.id, intent: A.intent, ...(linked.length ? { linked } : {}) };
}

/** A trace from a ticket (gameworld/asks.js traceOf): the ask, its reqs with their jobs, its verdicts, patches and runs. */
function traceFrom(ref, id, ledgerReqs) {
  const start = traceStart(id);
  const reqOf = (rid) => {
    const r = ledgerReqs.find((x) => x.id === rid);
    if (!r) throw new Error(`design_game: no req '${rid}' in this world (${ledgerReqs.map((x) => x.id).join(', ') || 'none raised'})`);
    return { id: r.id, unit: r.unit, status: r.status, remit: r.remit, jobs: GameworldReqJobRepository.list(ref, r.id) };
  };
  let A;
  if (start.ask) { A = GameworldAskRepository.get(ref, start.ask); if (!A) throw new Error(`design_game: no ask '${start.ask}' in this world (${GameworldAskRepository.list(ref).map((a) => a.id).join(', ') || 'none cut'})`); }
  else { reqOf(start.req); A = GameworldAskRepository.askOf(ref, start.req); }
  const links = A ? GameworldAskRepository.links(ref, A.id) : [];
  const rids = A ? [...new Set(links.filter((l) => l.kind === 'req').map((l) => l.target))] : [start.req];
  if (start.job && !GameworldReqJobRepository.get(ref, start.req, start.job)) throw new Error(`design_game: no job '${start.job}' on ${start.req}`);
  return traceOf({ world: ref, ask: A, links, reqs: rids.filter((r) => ledgerReqs.some((x) => x.id === r)).map(reqOf), focus: { req: start.req, job: start.job } });
}

async function afterWrite(ref, { approve, revise, note, run, force, check, compare, before, shape, chapter, patched = [], req, reqDone = null, ask, trace, production, seat = null }, context = {}) {
  let W = gameworldOf(SketchRepository.getByRef(ref).manifest);
  // how this game is run (gameworld/production.js): the director's style and the creator's checkpoints
  if (production !== undefined) GameworldProductionRepository.set(ref, production);
  // the verdicts
  if (approve !== undefined || revise !== undefined) {
    const review = reviewWith(W, { approve, revise, note });
    // a verdict the world already holds writes nothing
    if (JSON.stringify(review) !== JSON.stringify(W.review ?? {})) {
      await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/review', value: review }] });
      W = { ...W, review };
    }
  }
  // one level's unit names a level the world has, before a run makes anything for it
  const lv = chapter !== undefined ? unitOf(chapter)?.level : null;
  if (lv && !isObj(W.levels?.[lv])) throw new Error(`design_game: no level '${lv}' in this world (its levels: ${Object.keys(W.levels ?? {}).join(', ') || 'none'})`);
  // the run
  let ran, resonance, pending;
  if (run) {
    readGameworld(W);
    // (a run compiles: no gallery bake of the rows it makes as they land, no check unless asked)
    const out = await withoutWarm(() => runWorld(ref, W, { force: !!force, check: check === true, chapter: chapter ?? null }));
    ran = out.ran;
    resonance = out.resonance;
    pending = out.pending;
    // a run that made and remade nothing writes nothing: no revision, no new head
    if (JSON.stringify(out.world) !== JSON.stringify(W)) {
      const next = rebase(gameworldOf(SketchRepository.getByRef(ref).manifest), W, out.world);
      await updateSketchHandler({ ref, manifest: { kind: GAMEWORLD_KIND, ...next } });
      W = next;
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
  // the pre-compile check, on a run (what is left of the build) and on a chapter's view (each department its own
  // blockers): what a run would hit, found before it is made; a next move while anything blocks
  if (run || chapter) {
    full.compile = await compileReadout(ref, W, { check: check === true });
    if (full.compile.blockers) full.next = [...full.next, { step: 'compile', blockers: full.compile.blockers.length, card: 'gameworld-next' }];
  }
  // the requisitions (gameworld/reqs.js): the unit being worked, the queue, and what a unit reads besides its chapter
  const ledger = workLedger(ref, W, full, req, reqDone);
  if (ledger.summary) full.reqs = ledger.summary;
  // how the game is run, said wherever the ledger is (production.js): the style, the posture, the slice, who saw what
  const P = GameworldProductionRepository.get(ref);
  if (ledger.summary || P) {
    const slice = ledger.L.reqs.some((x) => unitOf(x.unit)?.level != null && x.status === 'accepted');
    full.production = productionSummary(P, { slice, accepted: ledger.L.reqs.filter((x) => x.status === 'accepted').length, directed: ledger.L.reqs.filter((x) => x.status === 'directed').length });
  }
  // (while a req is open the ledger leads: its move first; a run its budget stopped still goes before it)
  if (ledger.L.current) full.next = [{ step: 'req', id: ledger.L.current.id, unit: ledger.L.current.unit, status: ledger.L.current.status, does: ledger.summary.current.does, card: 'gameworld-ledger' }, ...full.next];
  // the composite: the accepted levels the game is not yet made of (a level accepted since, or one gone stale); a run
  // makes the game of them (runner.js composedStages)
  const composite = compositeOf(ref, W);
  if (composite?.length) {
    let game = null;
    try { game = runSteps(W, { ref, lookup: heroLookup(heroRefOf(W, ref)), composite }).find((s) => s.key === 'game'); } catch { /* the readout says what the book lacks */ }
    if (game && W.made?.game?.order !== game.print) full.next = [...full.next, { step: 'composite', levels: composite, ...(W.made?.game ? {} : { first: true }), card: 'gameworld-ledger' }];
    if (full.reqs) full.reqs.composite = { levels: composite, made: !!game && W.made?.game?.order === game.print };
  }
  // the first session's goalposts (gameworld/goalposts.js): where the game stands against what a good first session
  // leaves, read from the book; said while any is open, with where the next session picks up
  // (with the ledger's level reqs: goalposts 6 and 7 read the first level's req when the director asked for it)
  const levelReqs = ledger.L.reqs.filter((r) => unitOf(r.unit)?.level != null && !['cancelled', 'gone'].includes(r.status)).map((r) => {
    const receipt = ledger.received(r), jobs = GameworldReqJobRepository.list(ref, r.id);
    return { id: r.id, unit: r.unit, status: r.status, receipt, does: nextOf(jobs, { level: true, probe: probeState(receipt), presented: !!r.verdict?.presented }) };
  });
  const posts = (() => { try { return goalposts({ world: W, chapters: full.chapters ?? [], parts: full.parts ?? [], mainQuest: full.mainQuest ?? null, made: W.made ?? {}, compile: full.compile ?? null, reqs: levelReqs }); } catch { return null; } })();
  if (posts) full.goalposts = posts;
  // the ticket: what this call did, linked to the intent it acted on (gameworld/asks.js)
  const ticket = ask !== undefined ? linkAsk(ref, ask, { raised: ledger.summary?.raised ?? [], approve, revise, patched, ran }) : null;
  if (ticket) full.ask = ticket;
  // a trace: from a ticket, the intent above it and the work below it
  if (trace !== undefined) return { ok: true, readout: 'trace', ref, trace: traceFrom(ref, trace, ledger.L.reqs) };
  // a run its budget stopped: the next move is the run again, before any other (runWorld's RUN_BUDGET_MS)
  if (pending) full.next = [{ step: 'run', pending: pending.length, card: 'gameworld-next' }, ...full.next.filter((n) => n.step !== 'run' && n.step !== 'rerun')];
  // a run's levels on their opening frame (machine gate, game/first-frame-check.js): { first_frame } or nothing
  // (the levels walked and photographed only when the run asks, `check`: a run compiles; the pictures are the book's)
  const { record: framed, ...eyes } = check === true ? await firstFrameReadout(W, ran) : {};
  // a run's errands walked on the bus across the levels it made, the bag carried (machine gate, gameworld/errand-proof.js)
  const errandProof = ran && W.errands ? (() => {
    try { return { errand_proof: { gate: 'machine', errands: proveErrands(W, lastStageManifests(runSteps(W, { ref, lookup: heroLookup(heroRefOf(W, ref)), composite: compositeOf(ref, W) }))), note: 'machine gate: each errand walked on the bus, the bag carried level to level; the walk between levels, the fights and the knocks on the way are not played (the eyes gate has not run)' } }; } catch (e) { return { errand_proof: { gate: 'machine', error: e.message } }; }
  })() : {};
  // a run's wave gauntlets played on the bus on the levels it made, each fall given (machine gate, gameworld/gauntlet-proof.js)
  const gauntletProof = ran && Object.values(W.levels ?? {}).some((L) => L?.goal?.gauntlet) ? (() => {
    try { return { gauntlet_proof: { gate: 'machine', levels: proveGauntlets(W, lastStageManifests(runSteps(W, { ref, lookup: heroLookup(heroRefOf(W, ref)), composite: compositeOf(ref, W) }))), note: 'machine gate: each gauntlet played on the bus, every foe given its fall as it woke; whether a fight can be won is not played (the eyes gate has not run)' } }; } catch (e) { return { gauntlet_proof: { gate: 'machine', error: e.message } }; }
  })() : {};
  // each level's verdict kept in the run's record beside the row it judged: a later run gates only what changed
  if (framed) {
    const made = { ...W.made }, base = W;
    for (const [k, frame] of Object.entries(framed)) if (made[k]) made[k] = { ...made[k], frame };
    // (laid onto the world as stored now, as a run's own writes are: gameworld/rebase.js)
    W = rebase(gameworldOf(SketchRepository.getByRef(ref).manifest), base, { ...W, made });
    await updateSketchHandler({ ref, manifest: { kind: GAMEWORLD_KIND, ...W } });
  }
  // the run that made (or remade) the game completed it: the whole share offer rides this call, once
  const completed = W.made?.game && ran?.some((r) => r.key === 'game' && (r.action === 'make' || r.action === 'remake'));
  const share = completed ? { share: shareForContext(context, { ref: W.made.game.ref }) } : {};
  // one chapter: the whole readout projected onto it (a department's view; the share offer rides it as it rides the whole)
  if (chapter) {
    // a unit's own req (the live one asked for it): its remit, its precedent, its budget
    // (a job's seat reads its own req, whatever its status, and only its own job: the rest is the director's)
    const own = seat ? ledger.L.reqs.find((r) => r.id === seat.job.req) : ledger.L.reqs.find((r) => (r.unit === chapter || r.crew?.includes(chapter)) && !TERMINAL_REQ.has(r.status));
    const view = chapterView({ ...full, ...(resonance ? { resonance } : {}), ...eyes, ...errandProof, ...gauntletProof, ...(comparison ? { comparison } : {}) }, W, chapter, { ran, pending, patched });
    const R = own ? reqView(ref, own, ledger.L.reqs, { W, parts: ledgerStamps(ref, W), seat, agents: !seat && clientTakesJobAgents(context?.mcpSessionId ? getClientInfo(context.mcpSessionId) : null) }) : null;
    return { ok: true, readout: 'chapter', ...view, ...(seat ? { as: `${seat.job.req}.${seat.job.id}` } : {}), ...(R ? { req: R } : {}), ...(!seat && req !== undefined && full.reqs ? { reqs: full.reqs } : {}), ...(ticket ? { ask: ticket } : {}), ...share };
  }
  if (shape !== 'changed') return { ok: true, ...full, ...(ran ? { ran } : {}), ...(resonance ? { resonance } : {}), ...eyes, ...errandProof, ...gauntletProof, ...(comparison ? { comparison } : {}), ...share };
  return { ok: true, readout: 'changed', ...changedOnly(full, before ? readout(ref, before, context) : null), ...(req !== undefined && full.reqs ? { reqs: full.reqs } : {}), ...(ran ? { ran: ran.filter((r) => r.action !== 'keep' && r.action !== 'waiting') } : {}), ...(resonance ? { resonance } : {}), ...eyes, ...errandProof, ...gauntletProof, ...(comparison ? { comparison } : {}), ...share };
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
  for (const k of ['intent', 'advice', 'numbers', 'steps', 'chapters', 'made', 'audits', 'mode', 'fight']) if (full[k] !== undefined && !same(full[k], prev?.[k])) out[k] = full[k];
  return { ...out, next: full.next };
}

export function registerDesignGameTools() {
  registerTool({
    name: 'design_game',
    // a run mints the hero, the systems world and the gear in one call
    timeoutMs: RENDER_TOOL_TIMEOUT_MS,
    description:
      'The GAME rail: design a game top down and let mojulo make it. A gameworld (levels, hero, gear, systems) is '
      + 'a sketch; this writes it (`world`, `patch`), takes the creator\'s verdicts (`approve`, `revise` { part, note }) and, '
      + 'with `run: true`, makes every ready step through the real doors, keeping what did not move, leaving hand edits '
      + '(`force` overwrites). Answers the stamps, what was made, the advice and the next moves as step ids '
      + '(`readout: \'changed\'` for only what moved). Read '
      + 'get_game_vocab({ id: \'gameworld-guide\' }) first. `example` makes a reference only when the creator asks; '
      + '`compare` reads one against a made world. `compose: { prompt }`: words to a world. `chapter`: a chapter\'s view.',
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
        check: { type: 'boolean' },
        example: { type: 'string' },
        compare: { type: 'string' },
        readout: { type: 'string', enum: ['full', 'changed'] },
        quick: { type: 'object', description: 'One level, one goal (gameworld-quick).' },
        compose: { type: 'object', description: '{ prompt, levels?, seed?, name? }' },
        chapter: { type: 'string' },
        req: { type: 'object' },
        ask: { anyOf: [{ type: 'object' }, { type: 'string' }] },
        trace: { type: 'string' },
        preview: { type: 'boolean' },
        production: { type: 'object' },
        as: { type: 'string', description: 'A job\'s seat, r<n>.j<n>: its own view.' },
        vary: { type: 'object', description: 'Proposed variations { concept, n }.' },
      },
      required: [],
    },
    handler: designGameHandler,
  });
}
