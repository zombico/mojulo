/**
 * THE RUNNER'S PLAN — what a run of a gameworld makes, pure. The book's orders (heroOrders, mechanicsOrders,
 * equipmentOrders) are the tool calls that realize its pages; a run (design_game's `run`, lib/mcp/tools/design-game.js)
 * makes the ones whose step is ready, through the same handlers an agent would call, at refs it derives from the
 * gameworld's own, and records what it made (made.js). This module says, for the world as it stands, which steps there
 * are and what to do with each; the door does it.
 *
 *   runSteps(world, { ref, lookup })   → [{ key, ref, ready, waiting?, order, print }]
 *     hero       always ready once the world has a hero: the base must be made to be seen and pinned
 *     hero-equipped   when the adornment step is: the base holding what it carries at the last stage (a second
 *                sketch, a picture of the page; the base itself stays bare)
 *     systems    when the systems step is (characterReady): the player world with the stats and the HUD
 *     gear-<c>   when the equipment step is: one per filled class of the table
 *     stock-<id> when the equipment step is: one per starter item the world asks for (equipment.populate, world-gear.js)
 *     level-<level>-<n>   when the systems step is: each stage of each level, a world the hero pilots (levels.js)
 *     game       when the systems step is, after every level: create_game over them, the store from the book
 *   decide(step, record, storedNow, { force }) → what to do with one step:
 *     'waiting'  the step is not ready (its `waiting` says on what)
 *     'make'     nothing is at its ref
 *     'taken'    something the runner did not make is at its ref: left as it is (force: remade)
 *     'keep'     the book's order and what is stored are as the runner left them
 *     'edited'   the creator changed it by hand since: left as it is, even when the book moved (force: remade)
 *     'remake'   the book's order moved and the stored one is as the runner left it
 *
 * Every run of the same world and the same store decides the same: no dice, no clock.
 */
import { fingerprint } from './review.js';
import { readGameworld } from './world.js';
import { resolveBook, characterReady } from './character-review.js';
import { heroOrders, castOrders } from './hero-looks.js';
import { mechanicsOrders } from './mechanics.js';
import { equipmentOrders, equippedHero } from './equipment.js';
import { gearOrders } from './world-gear.js';
import { gameStages, stageLevelOrder, gameStore, gameLevels, gameLinks, mapPlan, stageEnds, stageSpots, stageLane } from './levels.js';
import { bindStory } from './story.js';
import { quickVersus, goalMechanics, goalAudio, guardPosts, defendCast, farmCast, battleCast, shootCast, deathmatchCast, deathmatchLegend, bagPlay, raceCast, quickRideRule, quickRacers, QUICK_GUARD, QUICK_FOE, QUICK_TOWER, QUICK_FARMHAND, QUICK_GUNNER, quickStore } from './quick.js';
import { rideBuild, rideRule } from './ride.js';
import { seedOfRef } from '../beats/field-cue.js';
import { solvePalette } from '../color-theorist/solve.js';
import { gameTheme } from '../color-theorist/adapters.js';

const REF_MAX = 64;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The character light in an order's print. Named `light` where an order carries one: the door now receives it (it
 * was dropped before), so the print of such an order moves and a run remakes the hero once, with its light. An order
 * with none prints as it always did. */
const lit = (toon) => (toon ? { light: toon } : { toon: null });

/** The ref of what a run makes for `part` of the gameworld at `ref`: `<ref>-<part>`, or, past the 64 characters a ref
 * may have, the ref cut short with its print to keep it apart. */
/** The game's HUD from the world's palette (color-theorist): one set of colours for the land and the shell. */
const paletteTheme = (G) => (G.style?.palette ? gameTheme(solvePalette(G.style.palette === 'auto' ? {} : G.style.palette)) : null);

export function childRef(ref, part) {
  const plain = `${ref}-${part}`;
  if (plain.length <= REF_MAX) return plain;
  return `${ref.slice(0, REF_MAX - part.length - 10)}-${fingerprint(ref)}-${part}`;
}

/** A hero a game plays runs on its own calibrated jog (a game's run speed is a jog's, not a walk's): `motion.jog`
 * unless it names its own. A figure that only walks about (a guard, the cast) keeps its walk alone. */
const playJog = (spec) => ((isObj(spec.motion) && 'jog' in spec.motion) || (isObj(spec.clips) && 'jog' in spec.clips) ? spec : { ...spec, motion: { ...(isObj(spec.motion) ? spec.motion : {}), jog: true } });
// the motion page sets /hero/motion whole: it keeps the jog the hero plays on
const keepJog = (patch) => patch && patch.map((op) => (op.op === 'set' && op.path === '/hero/motion' && isObj(op.value) && !('jog' in op.value) ? { ...op, value: { ...op.value, jog: true } } : op));
// the door gaits a pilot carries (player.js plays its own jog and walk over the library's)
const gaitsOf = (spec) => (spec && isObj(spec.motion) ? Object.keys(spec.motion) : null);

/** The hero's ref: the one the world adopts (`characters.hero.ref`, made with create_character), else the one a run
 * makes at `<ref>-hero`. */
export const heroRefOf = (world, ref) => world.characters?.hero?.ref ?? childRef(ref, 'hero');

/** The steps of a run, in the order they are made (the hero first: the others name it, or wait on its pinned base). */
export function runSteps(world, { ref, lookup } = {}) {
  if (typeof ref !== 'string' || !ref) throw new Error('runner: the steps are made at refs derived from the gameworld\'s own ref');
  const G = readGameworld(world);
  if (world.quick) return quickSteps(world, G, ref, lookup);
  const O = heroOrders(G);
  if (!O) return [];
  // an adopted hero (characters.hero.ref) is pinned, never made: the step says so (`adopt`), and it plays as it is
  const adopted = G.characters?.hero?.ref ?? null, heroRef = heroRefOf(world, ref);
  const hero = { spec: playJog(O.mint.args.spec), mint: { ...O.mint.args, spec: playJog(O.mint.args.spec) }, motion: keepJog(O.motion?.args.patch) ?? null };
  const steps = [adopted
    ? { key: 'hero', ref: heroRef, ready: true, adopt: true, order: { adopt: heroRef }, print: fingerprint({ adopt: heroRef }) }
    : { key: 'hero', ref: heroRef, ready: true, order: hero, print: fingerprint({ spec: hero.spec, motion: hero.motion, ...lit(hero.mint.toon) }) }];
  const ready = characterReady(world, { lookup }), B = resolveBook(world);
  const waits = (r) => (r.ready ? {} : { waiting: r.waiting });
  // a hero edited by hand since the run is the one that plays: the equipped hero is built over it (its own motion
  // included), not over the book's base (`lookup.heroSpec` is HEAD in the door's words, design-game.js heroLookup)
  // (an adopted hero is its own throughout: its looks and its motion, never the book's)
  const edited = !!(adopted ? lookup?.heroSpec : world.made?.hero?.ref === heroRef && lookup?.heroSpec && lookup.head && fingerprint(lookup.head) !== world.made.hero.stored);
  const Q = equippedHero(G, { composed: { spec: edited ? lookup.heroSpec : hero.spec } });
  if (Q) {
    // the motion's gaits and clips ride; the stand that shows the gear (HOLD_STAND) wins over the motion's own
    const spec = { ...Q.spec, ...(hero.motion && !edited ? motionFields(hero.motion) : {}), ...(Q.spec.gesture ? { gesture: Q.spec.gesture } : {}) };
    // an adopted hero's light is its own row's (create_character's `toon`), not the tradition's
    const toon = adopted ? lookup?.head?.toon : hero.mint.toon;
    const { toon: _t, ...mint } = hero.mint;
    steps.push({ key: 'hero-equipped', ref: childRef(ref, 'hero-equipped'), ready: ready.adornment.ready, ...waits(ready.adornment), order: { mint: { ...mint, ...(toon ? { toon } : {}), title: `${hero.mint.title} · equipped`, spec }, spec }, print: fingerprint({ spec, ...lit(toon) }) });
  }
  // the cast: each made after the hero, as the hero is (a hero-door base, then its motion); it waits on nothing
  for (const id of Object.keys(G.characters?.cast ?? {})) {
    const C = castOrders(G, id), order = { spec: C.mint.args.spec, mint: C.mint.args, motion: C.motion?.args.patch ?? null };
    steps.push({ key: `cast-${id}`, ref: childRef(ref, `cast-${id}`), ready: true, order, print: fingerprint({ spec: order.spec, motion: order.motion, ...lit(order.mint.toon) }) });
  }
  const MO = mechanicsOrders(G, B.mechanics, { heroRef });
  if (MO) steps.push({ key: 'systems', ref: childRef(ref, 'systems'), ready: ready.systems.ready, ...waits(ready.systems), order: MO.args, print: fingerprint(MO.args) });
  const EO = equipmentOrders(G, ready.equipment);
  for (const m of EO.mints.length ? EO.mints : EO.planned ?? []) {
    steps.push({ key: `gear-${m.class}`, ref: childRef(ref, `gear-${m.class}`), ready: ready.equipment.ready, ...waits(ready.equipment), order: m.args, print: fingerprint(m.args) });
  }
  // the starter gear a world asks for (`equipment.populate`, world-gear.js): made with the table, on the same readiness
  const GO = gearOrders(G, ready.equipment);
  for (const m of GO.mints.length ? GO.mints : GO.planned) {
    steps.push({ key: `stock-${m.id}`, ref: childRef(ref, `stock-${m.id}`), ready: ready.equipment.ready, ...waits(ready.equipment), order: m.args, print: fingerprint(m.args) });
  }
  // the levels: each stage a world the hero pilots (holding its gear when the equipped hero is made), with the systems'
  // play block; then the game over them in the play shell (play-shell.js), its store compiled from the book. Walkable by construction; beatability is
  // the creator's, in play (create_game records the levels as unaudited).
  const equipped = steps.find((s) => s.key === 'hero-equipped');
  const pilot = equipped ? childRef(ref, 'hero-equipped') : heroRef;
  const heroGaits = gaitsOf(equipped ? equipped.order.spec : adopted ? lookup?.heroSpec : { ...hero.spec, ...(hero.motion ? motionFields(hero.motion) : {}) });
  // a building by ref is played as it was made: its ref is the level, and no step makes it
  const stages = gameStages(world), levelRefs = stages.map((s) => s.building?.ref ?? childRef(ref, `level-${s.level}-${s.index}`));
  const map = G.topology === 'interconnected' ? mapPlan(G, stages, levelRefs) : null;
  // the story bound to the stages as laid: each stage its moments and people (none: nothing passed, nothing changes)
  const castRefs = Object.fromEntries(Object.keys(G.characters?.cast ?? {}).map((id) => [id, childRef(ref, `cast-${id}`)]));
  const told = G.story ? bindStory(G, stages, { castRefs, layout: { stageEnds, stageSpots, stageLane } }) : null;
  // where a scene's has and done read: the store's inventories, its campaign, each level by its last stage's ref
  const store = gameStore(world, B), last = {};
  stages.forEach((s, i) => { last[s.level] = levelRefs[i]; });
  const carryFrom = { items: store.slices.filter((x) => x.kind === 'inventory').map((x) => x.name), campaign: 'campaign', levels: last };
  // the cast who join the hero (characters.cast.<id>.joins): every stage carries them, asleep until they join
  const party = Object.entries(G.characters?.cast ?? {}).filter(([, m]) => m.joins).map(([id, m]) => ({ id, ref: castRefs[id], joins: m.joins }));
  stages.forEach((s, i) => {
    if (s.building?.ref) return;
    const st = told?.byStage[`${s.level}/${s.node}`];
    const L = stageLevelOrder(G, s, { ref: levelRefs[i], heroRef: pilot, ...(heroGaits ? { heroGaits } : {}), mechanics: B.mechanics, carryFrom, ...(map ? { map: map[i] } : {}), ...(st ? { story: st } : {}), ...(party.length ? { party } : {}), ...cityRefsOf(stages, levelRefs, s) });
    steps.push({ key: `level-${s.level}-${s.index}`, ref: levelRefs[i], ready: ready.systems.ready, ...waits(ready.systems), order: L.args, print: fingerprint(L.args), ...(L.laws ? { laws: L.laws } : {}) });
  });
  if (stages.length) {
    const links = gameLinks(stages, levelRefs);
    const theme = paletteTheme(G);
    const game = { title: G.name ?? G.id, store: gameStore(world, B), levels: gameLevels(stages, levelRefs, map), ...(links.length ? { links } : {}), allow_unaudited: true, ...(theme ? { theme } : {}), shell: 'play', ...(G.front ? { front: G.front } : {}) };
    steps.push({ key: 'game', ref: childRef(ref, 'game'), ready: ready.systems.ready, ...waits(ready.systems), order: game, print: fingerprint(game) });
  }
  return steps;
}

// a city segment's neighbours' levels by segment id, so its portals lead to the levels made beside it
const cityRefsOf = (stages, refs, s) => (s.section === 'city' ? { cityRefs: Object.fromEntries(stages.map((x, j) => [x, refs[j]]).filter(([x]) => x.level === s.level).map(([x, r]) => [x.node, r])) } : {});

/** The story bound to the world as it lays now: { bound: [{ id, level, node, place? }], unplaced: [{ id, why }],
 * unset? (with quests: the steps whose flag nothing in the story sets) }, or null when the world has no story and no
 * quests. What design_game and the bible report. */
export function storyReport(world, { ref = 'gw' } = {}) {
  const G = readGameworld(world);
  if (!G.story && !G.quests) return null;
  const castRefs = Object.fromEntries(Object.keys(G.characters?.cast ?? {}).map((id) => [id, childRef(ref, `cast-${id}`)]));
  const { bound, unplaced, unset } = bindStory(G, gameStages(world), { castRefs, layout: { stageEnds, stageSpots, stageLane } });
  return { bound, unplaced, ...(unset ? { unset } : {}) };
}

/** A quick game's steps: its hero if it has one (any hero-door spec, minted as given), each stage a level with the
 * goal placed on its anchors, piloted by the hero or in first person, then the game in the play shell (play-shell.js).
 * Nothing waits: a quick game has no book to review. */
function quickSteps(world, G, ref, lookup) {
  const Q = world.quick, steps = [];
  // a fight is its own simulation (versus/): one game row, its roster solved where it plays
  if (Q.goal === 'fight') {
    const game = quickVersus(Q, { title: G.name ?? G.id, theme: Q.theme ?? paletteTheme(G) });
    return [{ key: 'game', ref: childRef(ref, 'game'), ready: true, order: game, print: fingerprint(game) }];
  }
  // `hero: { ref }` adopts a hero made with create_character: pinned to nothing (a quick game has no book), never made
  const adopted = isObj(Q.hero) && typeof Q.hero.ref === 'string' ? Q.hero.ref : null;
  const heroRef = adopted ?? (Q.hero ? childRef(ref, 'hero') : null);
  if (adopted) steps.push({ key: 'hero', ref: heroRef, ready: true, adopt: true, order: { adopt: heroRef }, print: fingerprint({ adopt: heroRef }) });
  else if (Q.hero) {
    const spec = playJog(Q.hero), mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} hero`, spec, ...(Q.hero.head === 'anime' ? { toon: { light: true } } : {}) };
    steps.push({ key: 'hero', ref: heroRef, ready: true, order: { spec, mint, motion: null }, print: fingerprint({ spec, ...lit(mint.toon) }) });
  }
  const heroGaits = gaitsOf(adopted ? lookup?.heroSpec : Q.hero ? playJog(Q.hero) : null);
  // a ride (ride.js): the vehicle's build, minted as its own sketch; every stage drives it
  const rideRef = Q.ride ? childRef(ref, 'ride') : null;
  if (rideRef) {
    const seed = Number.isInteger(G.seed) ? G.seed : 1, build = rideBuild(Q.ride, seed);
    steps.push({ key: 'ride', ref: rideRef, ready: true, order: { title: build.title, manifest: build }, print: fingerprint({ ride: Q.ride, seed }) });
  }
  // a field of racers (quick.racers): solved here, each a recipe its figure resolves through (nothing to mint); yours first
  const racers = Q.racers !== undefined ? quickRacers(Q, Number.isInteger(G.seed) ? G.seed : 1) : null;
  const ride = rideRef ? { ref: rideRef, rule: quickRideRule(Q, rideRule(Q.ride, Number.isInteger(G.seed) ? G.seed : 1)) }
    : racers ? { racer: racers.field[0].spec, rule: racers.field[0].rule, field: racers.field } : null;
  // (the field's balance as a level law, in the concerns' shape: advice in the run's readout, never a refusal)
  const B = racers?.balance, nameOf = (i) => racers.field[i].archetype;
  const balance = racers ? { concern: 'racers', law: 'balance', holds: B.holds, says: B.holds ? `each of the ${racers.field.length} machines has something over every rival, none best at everything${racers.changes.length ? ` (leaned: ${racers.changes.map((c) => `the ${c.archetype}'s ${c.family} ${c.from} → ${c.to}`).join('; ')})` : ''}` : [...B.bettered.map((x) => `the ${nameOf(x.i)}'s machine bettered everywhere by the ${nameOf(x.by)}'s`), ...B.everything.map((i) => `the ${nameOf(i)}'s machine best at everything`)].join('; ') } : null;
  // a defence's foe and tower archer: one figure each, minted as a hero is
  const figRefs = {};
  // (a dogfight's foes are fighters, not figures: skyscape/dogfight.js)
  if (Q.goal === 'defend' || Q.goal === 'battle' || (Q.goal === 'shoot' && Q.craft === undefined)) {
    for (const [key, spec] of Q.goal === 'defend' ? [['foe', Q.foe ?? QUICK_FOE], ['tower', Q.tower ?? QUICK_TOWER]] : [['foe', Q.foe ?? (Q.goal === 'shoot' || Q.goal === 'deathmatch' ? QUICK_GUNNER : QUICK_FOE)]]) {
      figRefs[key] = childRef(ref, key);
      const mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} ${key}`, spec, ...(spec.head === 'anime' ? { toon: { light: true } } : {}) };
      steps.push({ key, ref: figRefs[key], ready: true, order: { spec, mint, motion: null }, print: fingerprint({ spec, ...lit(mint.toon) }) });
    }
  }
  // a farm's farmhands: one figure
  if (Q.goal === 'farm' && (Q.folk ?? 2) > 0) {
    const spec = Q.farmhand ?? QUICK_FARMHAND, mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} farmhand`, spec, ...(spec.head === 'anime' ? { toon: { light: true } } : {}) };
    figRefs.farmhand = childRef(ref, 'farmhand');
    steps.push({ key: 'farmhand', ref: figRefs.farmhand, ready: true, order: { spec, mint, motion: null }, print: fingerprint({ spec, ...lit(mint.toon) }) });
  }
  // a sneak's guards: one figure, minted as a hero is (the game's own spec, or a plain one)
  const guardRef = Q.goal === 'sneak' ? childRef(ref, 'guard') : null;
  if (guardRef) {
    const spec = Q.guard ?? QUICK_GUARD, mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} guard`, spec, ...(spec.head === 'anime' ? { toon: { light: true } } : {}) };
    steps.push({ key: 'guard', ref: guardRef, ready: true, order: { spec, mint, motion: null }, print: fingerprint({ spec, ...lit(mint.toon) }) });
  }
  const stages = gameStages(world), levelRefs = stages.map((s) => s.building?.ref ?? childRef(ref, `level-${s.level}-${s.index}`));
  const map = G.topology === 'interconnected' ? mapPlan(G, stages, levelRefs) : null;
  const gameRef = childRef(ref, 'game'), scoreOf = (s, i) => goalAudio(Q, { manifest: s.manifest ?? {}, final: stages.length > 1 && i === stages.length - 1, game: seedOfRef(gameRef) });
  stages.forEach((s, i) => {
    if (s.building?.ref) return;
    const audio = scoreOf(s, i);
    const guards = guardRef ? { ref: guardRef, posts: (ends) => guardPosts(Q, ends) } : null;
    const L = stageLevelOrder(G, s, { ref: levelRefs[i], heroRef, ...(heroGaits ? { heroGaits } : {}), goal: (ends) => goalMechanics(Q, ends), ...(map ? { map: map[i] } : {}), ...cityRefsOf(stages, levelRefs, s), ...(guards ? { guards } : {}), ...(audio ? { audio } : {}), ...(ride ? { ride } : {}), ...(Q.goal === 'defend' ? { extra: (ends) => defendCast(Q, ends, figRefs) } : Q.goal === 'battle' ? { extra: (ends) => battleCast(Q, ends, figRefs.foe) } : Q.goal === 'shoot' ? { extra: (ends) => shootCast(Q, ends, figRefs.foe, { hero: !!heroRef, camera: world.camera }), legend: Q.craft !== undefined ? 'click or Z  guns · R  missile · X  flare · F  boost · Q / E  roll' : 'click  fire' } : Q.goal === 'deathmatch' ? { extra: (ends) => deathmatchCast(Q, ends, figRefs.foe, { hero: !!heroRef, camera: world.camera }), legend: deathmatchLegend(Q) } : Q.goal === 'collect' ? { extra: () => bagPlay(Q), legend: 'I  bag' } : Q.goal === 'race' && ride ? { extra: (ends) => raceCast(Q, ends, ride) } : figRefs.farmhand ? { extra: (ends) => farmCast(Q, ends, figRefs.farmhand) } : {}) });
    const laws = balance ? [...(L.laws ?? []), balance] : L.laws;
    steps.push({ key: `level-${s.level}-${s.index}`, ref: levelRefs[i], ready: true, order: L.args, print: fingerprint(L.args), ...(laws ? { laws } : {}) });
  });
  const links = gameLinks(stages, levelRefs);
  // a run draws its levels: none waits on another
  const lvls = gameLevels(stages, levelRefs, map).map((l) => (Q.run ? (({ gate: _g, ...x }) => x)(l) : l));
  const game = { title: G.name ?? G.id, store: quickStore(Q), levels: lvls, ...(links.length ? { links } : {}), allow_unaudited: true, ...(Q.theme || paletteTheme(G) ? { theme: Q.theme ?? paletteTheme(G) } : {}), shell: 'play', ...(Q.run ? { run: { length: Q.run } } : {}), ...(G.front ? { front: G.front } : {}) };
  steps.push({ key: 'game', ref: gameRef, ready: true, order: game, print: fingerprint(game) });
  return steps;
}

/** The fields a motion page's patch sets on the hero (/hero/<field>), as a spec fragment. */
function motionFields(patch) {
  return Object.fromEntries(patch.filter((op) => op.op === 'set' && /^\/hero\/[a-zA-Z]+$/.test(op.path)).map((op) => [op.path.slice(6), op.value]));
}

/** What to do with one step. `record` is made[key], if any; `storedNow` the print of the manifest at its ref now, or
 * null when nothing is there. */
export function decide(step, record, storedNow, { force = false } = {}) {
  if (!step.ready) return 'waiting';
  if (storedNow === null) return 'make';
  if (!record || record.ref !== step.ref) return force ? 'remake' : 'taken';
  const edited = storedNow !== record.stored, moved = record.order !== step.print;
  if (edited && !force) return 'edited';
  return moved || edited ? 'remake' : 'keep';
}
