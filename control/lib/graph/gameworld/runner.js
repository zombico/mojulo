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
import { gameStages, stageLevelOrder, gameStore, gameLevels, gameLinks, mapPlan, stageEnds, stageSpots, stageLane } from './levels.js';
import { bindStory } from './story.js';
import { goalMechanics, goalAudio, guardPosts, defendCast, farmCast, battleCast, shootCast, QUICK_GUARD, QUICK_FOE, QUICK_TOWER, QUICK_FARMHAND, QUICK_GUNNER, quickStore } from './quick.js';
import { rideBuild, rideRule } from './ride.js';

const REF_MAX = 64;

/** The ref of what a run makes for `part` of the gameworld at `ref`: `<ref>-<part>`, or, past the 64 characters a ref
 * may have, the ref cut short with its print to keep it apart. */
export function childRef(ref, part) {
  const plain = `${ref}-${part}`;
  if (plain.length <= REF_MAX) return plain;
  return `${ref.slice(0, REF_MAX - part.length - 10)}-${fingerprint(ref)}-${part}`;
}

/** The steps of a run, in the order they are made (the hero first: the others name it, or wait on its pinned base). */
export function runSteps(world, { ref, lookup } = {}) {
  if (typeof ref !== 'string' || !ref) throw new Error('runner: the steps are made at refs derived from the gameworld\'s own ref');
  const G = readGameworld(world);
  if (world.quick) return quickSteps(world, G, ref);
  const O = heroOrders(G);
  if (!O) return [];
  const heroRef = childRef(ref, 'hero');
  const hero = { spec: O.mint.args.spec, mint: O.mint.args, motion: O.motion?.args.patch ?? null };
  const steps = [{ key: 'hero', ref: heroRef, ready: true, order: hero, print: fingerprint({ spec: hero.spec, motion: hero.motion, toon: hero.mint.toon ?? null }) }];
  const ready = characterReady(world, { lookup }), B = resolveBook(world);
  const waits = (r) => (r.ready ? {} : { waiting: r.waiting });
  const Q = equippedHero(G, { composed: { spec: hero.spec } });
  if (Q) {
    // the motion's gaits and clips ride; the stand that shows the gear (HOLD_STAND) wins over the motion's own
    const spec = { ...Q.spec, ...(hero.motion ? motionFields(hero.motion) : {}), ...(Q.spec.gesture ? { gesture: Q.spec.gesture } : {}) };
    steps.push({ key: 'hero-equipped', ref: childRef(ref, 'hero-equipped'), ready: ready.adornment.ready, ...waits(ready.adornment), order: { mint: { ...hero.mint, title: `${hero.mint.title} · equipped`, spec }, spec }, print: fingerprint({ spec, toon: hero.mint.toon ?? null }) });
  }
  // the cast: each made after the hero, as the hero is (a hero-door base, then its motion); it waits on nothing
  for (const id of Object.keys(G.characters?.cast ?? {})) {
    const C = castOrders(G, id), order = { spec: C.mint.args.spec, mint: C.mint.args, motion: C.motion?.args.patch ?? null };
    steps.push({ key: `cast-${id}`, ref: childRef(ref, `cast-${id}`), ready: true, order, print: fingerprint({ spec: order.spec, motion: order.motion, toon: order.mint.toon ?? null }) });
  }
  const MO = mechanicsOrders(G, B.mechanics, { heroRef });
  if (MO) steps.push({ key: 'systems', ref: childRef(ref, 'systems'), ready: ready.systems.ready, ...waits(ready.systems), order: MO.args, print: fingerprint(MO.args) });
  const EO = equipmentOrders(G, ready.equipment);
  for (const m of EO.mints.length ? EO.mints : EO.planned ?? []) {
    steps.push({ key: `gear-${m.class}`, ref: childRef(ref, `gear-${m.class}`), ready: ready.equipment.ready, ...waits(ready.equipment), order: m.args, print: fingerprint(m.args) });
  }
  // the levels: each stage a world the hero pilots (holding its gear when the equipped hero is made), with the systems'
  // play block; then the game over them in the play shell (play-shell.js), its store compiled from the book. Walkable by construction; beatability is
  // the creator's, in play (create_game records the levels as unaudited).
  const pilot = steps.some((s) => s.key === 'hero-equipped') ? childRef(ref, 'hero-equipped') : heroRef;
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
    const L = stageLevelOrder(G, s, { ref: levelRefs[i], heroRef: pilot, mechanics: B.mechanics, carryFrom, ...(map ? { map: map[i] } : {}), ...(st ? { story: st } : {}), ...(party.length ? { party } : {}) });
    steps.push({ key: `level-${s.level}-${s.index}`, ref: levelRefs[i], ready: ready.systems.ready, ...waits(ready.systems), order: L.args, print: fingerprint(L.args), ...(L.laws ? { laws: L.laws } : {}) });
  });
  if (stages.length) {
    const links = gameLinks(stages, levelRefs);
    const game = { title: G.name ?? G.id, store: gameStore(world, B), levels: gameLevels(stages, levelRefs, map), ...(links.length ? { links } : {}), allow_unaudited: true, shell: 'play' };
    steps.push({ key: 'game', ref: childRef(ref, 'game'), ready: ready.systems.ready, ...waits(ready.systems), order: game, print: fingerprint(game) });
  }
  return steps;
}

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
function quickSteps(world, G, ref) {
  const Q = world.quick, steps = [];
  const heroRef = Q.hero ? childRef(ref, 'hero') : null;
  if (Q.hero) {
    const mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} hero`, spec: Q.hero, ...(Q.hero.head === 'anime' ? { toon: { light: true } } : {}) };
    steps.push({ key: 'hero', ref: heroRef, ready: true, order: { spec: Q.hero, mint, motion: null }, print: fingerprint({ spec: Q.hero, toon: mint.toon ?? null }) });
  }
  // a ride (ride.js): the vehicle's build, minted as its own sketch; every stage drives it
  const rideRef = Q.ride ? childRef(ref, 'ride') : null;
  if (rideRef) {
    const seed = Number.isInteger(G.seed) ? G.seed : 1, build = rideBuild(Q.ride, seed);
    steps.push({ key: 'ride', ref: rideRef, ready: true, order: { title: build.title, manifest: build }, print: fingerprint({ ride: Q.ride, seed }) });
  }
  const ride = rideRef ? { ref: rideRef, rule: rideRule(Q.ride, Number.isInteger(G.seed) ? G.seed : 1) } : null;
  // a defence's foe and tower archer: one figure each, minted as a hero is
  const figRefs = {};
  if (Q.goal === 'defend' || Q.goal === 'battle' || Q.goal === 'shoot') {
    for (const [key, spec] of Q.goal === 'defend' ? [['foe', Q.foe ?? QUICK_FOE], ['tower', Q.tower ?? QUICK_TOWER]] : [['foe', Q.foe ?? (Q.goal === 'shoot' ? QUICK_GUNNER : QUICK_FOE)]]) {
      figRefs[key] = childRef(ref, key);
      const mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} ${key}`, spec, ...(spec.head === 'anime' ? { toon: { light: true } } : {}) };
      steps.push({ key, ref: figRefs[key], ready: true, order: { spec, mint, motion: null }, print: fingerprint({ spec, toon: mint.toon ?? null }) });
    }
  }
  // a farm's farmhands: one figure
  if (Q.goal === 'farm' && (Q.folk ?? 2) > 0) {
    const spec = Q.farmhand ?? QUICK_FARMHAND, mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} farmhand`, spec, ...(spec.head === 'anime' ? { toon: { light: true } } : {}) };
    figRefs.farmhand = childRef(ref, 'farmhand');
    steps.push({ key: 'farmhand', ref: figRefs.farmhand, ready: true, order: { spec, mint, motion: null }, print: fingerprint({ spec, toon: mint.toon ?? null }) });
  }
  // a sneak's guards: one figure, minted as a hero is (the game's own spec, or a plain one)
  const guardRef = Q.goal === 'sneak' ? childRef(ref, 'guard') : null;
  if (guardRef) {
    const spec = Q.guard ?? QUICK_GUARD, mint = { kind: 'layered', via: 'hero', title: `${G.name ?? G.id} guard`, spec, ...(spec.head === 'anime' ? { toon: { light: true } } : {}) };
    steps.push({ key: 'guard', ref: guardRef, ready: true, order: { spec, mint, motion: null }, print: fingerprint({ spec, toon: mint.toon ?? null }) });
  }
  const stages = gameStages(world), levelRefs = stages.map((s) => s.building?.ref ?? childRef(ref, `level-${s.level}-${s.index}`));
  const map = G.topology === 'interconnected' ? mapPlan(G, stages, levelRefs) : null;
  stages.forEach((s, i) => {
    if (s.building?.ref) return;
    const guards = guardRef ? { ref: guardRef, posts: (ends) => guardPosts(Q, ends) } : null;
    const L = stageLevelOrder(G, s, { ref: levelRefs[i], heroRef, goal: (ends) => goalMechanics(Q, ends), ...(map ? { map: map[i] } : {}), ...(guards ? { guards } : {}), ...(goalAudio(Q) ? { audio: goalAudio(Q) } : {}), ...(ride ? { ride } : {}), ...(Q.goal === 'defend' ? { extra: (ends) => defendCast(Q, ends, figRefs) } : Q.goal === 'battle' ? { extra: (ends) => battleCast(Q, ends, figRefs.foe) } : Q.goal === 'shoot' ? { extra: (ends) => shootCast(Q, ends, figRefs.foe, { hero: !!heroRef }), legend: 'click  fire' } : figRefs.farmhand ? { extra: (ends) => farmCast(Q, ends, figRefs.farmhand) } : {}) });
    steps.push({ key: `level-${s.level}-${s.index}`, ref: levelRefs[i], ready: true, order: L.args, print: fingerprint(L.args), ...(L.laws ? { laws: L.laws } : {}) });
  });
  const links = gameLinks(stages, levelRefs);
  // a run draws its levels: none waits on another
  const lvls = gameLevels(stages, levelRefs, map).map((l) => (Q.run ? (({ gate: _g, ...x }) => x)(l) : l));
  const game = { title: G.name ?? G.id, store: quickStore(Q), levels: lvls, ...(links.length ? { links } : {}), allow_unaudited: true, ...(Q.theme ? { theme: Q.theme } : {}), shell: 'play', ...(Q.run ? { run: { length: Q.run } } : {}) };
  steps.push({ key: 'game', ref: childRef(ref, 'game'), ready: true, order: game, print: fingerprint(game) });
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
