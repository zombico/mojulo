// CERES (gameworld/artesia.js): the world of Fable of Artesia, the rail's game, a megaworld chain of regions, each its own light,
// each opened by the shard freed from the dragon of the one before.
import { describe, it, expect } from 'vitest';
import { CERES, REGIONS, REGION_IDS, REGION_PLAINS, regionLevel, regionCube, ceresWorld, dragonKind, APPROACH, RHAYU, CERES_STORY, CERES_QUESTS, ceresApproach } from './artesia.js';
import { DRAGONS } from '../boss/dragons.js';
import { readGameworld } from './world.js';
import { megaworldLaws } from './megaworld.js';
import { pitchStart } from './pitch-start.js';
import { castingCall } from './foe-casting.js';
import { lairStage } from './lair.js';
import { stageLevelOrder, gameStore, gameStages, stageEnds, stageSpots, stageLane } from './levels.js';
import { bindStory, readGameQuests } from './story.js';
import { runSteps } from './runner.js';
import { gridEnds } from '../level/grid-ends.js';
import { guideOf } from '../level/guide.js';
import { levelGrid } from '../level/map-sketch.js';
import { buildGameStoreKernel } from '../game/store-kernel.js';
import { mergeContract } from '../game/level-synth.js';
import { readHour } from '../era/geocube-hours.js';

describe('the land of Ceres', () => {
  it('its regions a chain: each its own hour, each but the last a dragon of the shelf and its shard, the last its capital', () => {
    expect(new Set(REGION_IDS).size).toBe(REGIONS.length);
    expect(new Set(REGIONS.map((R) => R.hour)).size).toBe(REGIONS.length);
    for (const R of REGIONS) { expect(() => readHour(R.hour)).not.toThrow(); expect(R.blocks).toHaveLength(5 + REGION_PLAINS); }
    for (const R of REGIONS.slice(0, -1)) { expect(DRAGONS[R.dragon], R.id).toBeTruthy(); expect(R.shard).toBeTruthy(); }
    expect(REGIONS.at(-1).name).toBe(CERES.capital);
  });
  it('a region is a world map: its blocks named, lit at its hour, every block moved by its shift, its climax its dragon; none teaches (the approach does)', () => {
    const [R0, R1] = REGIONS, L0 = regionLevel(R0, 0), L1 = regionLevel(R1, 1);
    expect(L0.name).toBe(R0.name); expect(L0.style).toEqual({ hour: R0.hour });
    const K = L1.glyphs.plan.key;
    expect(L1.glyphs.plan.route.map((S) => K[S].name)).toEqual([...R1.blocks]);
    // (its own cube: the world's, its land and its palette moved; a world with no cube, none)
    const geo = { from: 'island-noon', palette: { seed: 3 } }, C = regionLevel(R1, 1, { geocube: geo }).style.geocube;
    expect(C).toEqual({ ...geo, ...(R1.biocube ? { biocube: R1.biocube } : {}), ...(R1.snow ? { snow: R1.snow } : {}), palette: { seed: 3, shift: { ...R1.shift } } });
    expect(regionCube('island-noon', R1)).toMatchObject({ from: 'island-noon' });
    expect(regionCube('island-noon', R1).palette).toBeUndefined();
    expect(regionCube(undefined, R1)).toBeNull();
    const snowy = REGIONS.find((R) => R.snow);
    if (snowy) expect(regionCube(geo, snowy).snow).toBe(snowy.snow);
    const climax = (L) => L.glyphs.sketch.scenario.beats.find((b) => b.kind === 'climax');
    expect(climax(L1).foes).toEqual({ [dragonKind(R1.dragon)]: 1 });
    for (const L of [L0, L1]) expect(L.glyphs.sketch.scenario.beats.some((b) => b.teach)).toBe(false);
  });
  it('the world laid as Ceres: the approach then its regions its levels, a chain whose every way into a region past the first waits on the shard freed before it; the creator\'s keys kept', () => {
    const W = ceresWorld({ id: 'c', name: 'Theirs', seed: 4, levels: { old: { name: 'old' } }, links: [{ from: 'old', to: 'old' }] });
    expect(Object.keys(W.levels)).toEqual([APPROACH.id, ...REGION_IDS]);
    expect(W).toMatchObject({ name: 'Theirs', seed: 4, start: APPROACH.id, topology: 'interconnected' });
    expect(W.links).toHaveLength(REGIONS.length);
    expect(W.links[0]).toMatchObject({ from: APPROACH.id, to: REGION_IDS[0], kind: 'road' });
    expect(W.links[0].key).toBeUndefined();
    W.links.slice(1).forEach((l, i) => expect(l).toMatchObject({ from: REGION_IDS[i], to: REGION_IDS[i + 1], kind: 'gate', key: REGIONS[i].shard, keyAt: REGION_IDS[i] }));
    // (a world with no people of its own gets no cast, so no story)
    expect(W.characters).toBeUndefined(); expect(W.story).toBeUndefined();
    for (const l of megaworldLaws(W.megaworld)) expect(l.ok, l.says).toBe(true);
  });
  it('laid from the rail: the composed Artesia, its one map the regions; each dragon cast on its region\'s climax', () => {
    const P = pitchStart({ id: 'g', name: 'Ceres', rail: { from: 'fable-of-artesia', locked: true } });
    expect(P.laid).toMatchObject({ levels: [APPROACH.id, ...REGION_IDS] });
    expect(P.world.feel).toBe('fable-of-artesia');
    expect(readGameworld(P.world).ids).toEqual([APPROACH.id, ...REGION_IDS]);
    const C = castingCall(P.world);
    for (const R of REGIONS.slice(0, -1)) {
      expect(C.foes[dragonKind(R.dragon)]).toMatchObject({ rank: 'boss', dragon: R.dragon });
      expect(C.levels[R.id].from).toContain(dragonKind(R.dragon));
    }
    // (the capital's climax the family's own boss: the hydra)
    expect(C.foes.boss.vehicle).toBe('hydra');
  }, 60_000);
  it('a lair grants the keys its ways keep there as its boss is brought down; one that keeps none, as it was', () => {
    const G = readGameworld({ id: 'l', foes: { grunt: { class: 'brute' }, boss: { class: 'brute', rank: 'boss', dragon: REGIONS[0].dragon } }, levels: { a: { name: 'a', walk: { nodes: { a: { trail: true } } } } } });
    const S = lairStage('a', 1, { kind: 'boss', beat: 'climax' }, G);
    const keyed = stageLevelOrder(G, S, { ref: 'lair', heroRef: 'hero', map: { on: [], back: [], keys: [REGIONS[0].shard], powers: [] } }).args.manifest.game;
    expect(keyed.wins).toEqual([{ type: 'grant', slice: 'bag', item: REGIONS[0].shard, count: 1 }]);
    expect(keyed.produces.events).toContainEqual({ type: 'grant', slice: 'bag' });
    const plain = stageLevelOrder(G, S, { ref: 'lair', heroRef: 'hero' }).args.manifest.game;
    expect(plain.wins).toBeUndefined(); expect(plain.produces).toBeUndefined();
  });
});

describe('one palette for Ceres', () => {
  it('every region on the world\'s seed, its own shift over it: a seed already stamped kept, else settled from the world\'s', () => {
    const geo = { from: 'island-noon', palette: { intent: 'x' } };
    const W = ceresWorld({ seed: 7, style: { geocube: geo } }), seed = W.style.geocube.palette.seed;
    expect(Number.isInteger(seed)).toBe(true);
    expect(ceresWorld({ seed: 7, style: { geocube: geo } }).style.geocube.palette.seed).toBe(seed);
    for (const R of REGIONS) expect(W.levels[R.id].style.geocube.palette).toEqual({ intent: 'x', seed, shift: { ...R.shift } });
    const kept = ceresWorld({ seed: 7, style: { geocube: { ...geo, palette: { ...geo.palette, seed: 42 } } } });
    expect(kept.levels[REGIONS[0].id].style.geocube.palette.seed).toBe(42);
  });
});

import { withGeocube } from '../era/geocube.js';
describe('a region under snow (Letzo\'s)', () => {
  it('a map\'s tile under a snowy cube carries its snow onto its polygon land; under a cube with none, none', () => {
    const snowy = withGeocube({ kind: 'stage', geocube: { from: 'island-noon', snow: 'cover' }, tile: { r: 0, c: 0 } });
    expect(snowy.snow).toBe('cover'); expect(snowy.shading).toBeTruthy();
    expect(withGeocube({ kind: 'stage', geocube: 'island-noon', tile: { r: 0, c: 0 } }).snow).toBeUndefined();
  });
});

describe('the crossing from a freed dragon\'s lair to the next region', () => {
  it('on the store: shut before the dragon is down, the lair\'s win puts its shard in the bag, and the way on opens', () => {
    const W = ceresWorld({ id: 'c', seed: 3 }), K = buildGameStoreKernel(), schema = gameStore(W);
    expect(schema.slices.some((s) => s.name === 'bag' && s.kind === 'inventory')).toBe(true);
    const link = W.links.find((l) => l.key), gate = { has: link.key, slice: 'bag' };
    const G = readGameworld({ id: 'l', foes: { grunt: { class: 'brute' }, boss: { class: 'brute', rank: 'boss', dragon: REGIONS[0].dragon } }, levels: { a: { name: 'a', walk: { nodes: { a: { trail: true } } } } } });
    const game = stageLevelOrder(G, lairStage('a', 1, { kind: 'boss', beat: 'climax' }, G), { ref: 'lair', heroRef: 'hero', map: { on: [], back: [], keys: [link.key], powers: [] } }).args.manifest.game;
    const contract = mergeContract(game, { produces: [] }), state0 = K.createStore(schema);
    expect(K.evalGate(schema, state0, gate)).toBe(false);
    const out = K.applyOutcome(schema, state0, contract, { contractVersion: K.CONTRACT_VERSION, levelRef: 'lair', seed: 1, result: 'success', events: game.wins });
    expect(out.ok, (out.errors ?? []).join('; ')).toBe(true);
    expect(K.evalGate(schema, out.state, gate)).toBe(true);
  });
});

// THE APPROACH (artesia.js APPROACH, world-map.js approachLevel): the game's first page, one block. Artesia comes up the
// coast road in Seimos's saddle and gets down (the controls taught, dismount first), the goblins have the merchant Rhayu
// at its far end (the first fight taught), and won, he thanks her (she is silent) and leads her on to the harbour village,
// a quest step saying so
describe('the approach', () => {
  const L = ceresApproach({ geocube: { from: 'island-noon', palette: { seed: 3 } } }), lv = { grid: { tile: L.glyphs.tile, plan: L.glyphs.plan }, sketch: L.glyphs.sketch };
  it('one block ridden onto, in its region\'s light: the controls with getting down first, the ambush up the road, the road on', () => {
    const R0 = REGIONS.find((R) => R.id === APPROACH.region);
    expect(L.glyphs.plan.route).toHaveLength(1);
    expect(L.glyphs.plan.key.A).toMatchObject({ name: APPROACH.name, ride: 'up' });
    expect(L.style).toMatchObject({ hour: R0.hour, geocube: { biocube: R0.biocube } });
    const E = gridEnds(lv), G = guideOf(lv, levelGrid(lv));
    expect(G.lessons.map((x) => x.fact)).toEqual(['dismount', 'move', 'look', 'jump', 'sprint']);
    expect(G.steps.map((x) => x.id)).toEqual(['ambush', 'ambush-rest', 'road-on']);
    expect(G.steps.at(-1).say).toBe(`Follow Rhayu to ${REGIONS[0].blocks[0]}`);
    // (the ambush is a place a story stands its people at, up the road from where she arrives, short of the way on)
    const ambush = stageSpots(E).find((x) => x.id === 'ambush');
    expect(ambush.at[0]).toBeGreaterThan(E.spawn[0] + 48);
    expect(ambush.at[0]).toBeLessThan(E.exit[0]);
  });

  it('Rhayu is in the cast and his story binds: at the ambush on its win, then at the harbour village; the quest on his flag', () => {
    const P = pitchStart({ id: 'g', name: 'Ceres', rail: { from: 'fable-of-artesia', locked: true } }), W = P.world;
    expect(W.characters.cast.rhayu).toEqual(RHAYU);
    expect(W.story).toEqual(CERES_STORY); expect(W.quests).toEqual(CERES_QUESTS);
    const G = readGameworld(W);
    expect(() => readGameQuests(W.quests, W.story)).not.toThrow();
    const B = bindStory(G, gameStages(G), { castRefs: { rhayu: 'r' }, layout: { stageEnds, stageSpots, stageLane } });
    expect(B.unplaced).toEqual([]); expect(B.unset).toEqual([]);
    expect(B.bound).toEqual([
      { id: 'rhayu-thanks', level: APPROACH.id, node: 'A', place: 'ambush' },
      { id: 'rhayu-harbour', level: REGIONS[0].id, node: 'A', slot: 'before' },
    ]);
    expect(B.byStage[`${APPROACH.id}/A`].scenes[0].when).toEqual({ on: 'won:ambush-rest' });
    // (the creator's own story wins)
    expect(ceresWorld({ ...W, story: [], quests: [] }).story).toEqual([]);
  }, 60_000);

  it('its page: Seimos ridden from the start, the second wave the one whose falls raise the win, Rhayu standing there', () => {
    const P = pitchStart({ id: 'g', name: 'Ceres', rail: { from: 'fable-of-artesia', locked: true } }), W = P.world, C = castingCall(W);
    const set = (o, path, v) => { const k = path.split('/').slice(1); let x = o; for (const q of k.slice(0, -1)) x = x[q] ??= {}; x[k.at(-1)] = v; };
    for (const op of C.patch) set(W, op.path, op.value);
    const steps = runSteps(W, { ref: 'g' }), m = steps.find((x) => x.key === `level-${APPROACH.id}-0`).order.manifest;
    expect(m.mounts).toEqual([{ beside: 0, coat: CERES.steed.coat, name: CERES.steed.name, call: true, ridden: true }]);
    const rest = m.entities.filter((e) => e.dormant && /^foe-/.test(e.id)).map((e) => e.id);
    expect(rest).toHaveLength(2);
    const won = m.play.cues.find((c) => c.id === 'won-ambush-rest');
    expect(won).toMatchObject({ when: { gte: 2 }, then: { emit: 'won:ambush-rest' } });
    expect(m.play.cues.filter((c) => /^won-foe-/.test(c.id)).map((c) => c.when.down).sort()).toEqual(rest.sort());
    expect(m.entities.some((e) => e.id === 'rhayu')).toBe(true);
    // (the region after it: no horse on its first page, Rhayu at its start)
    const L0 = steps.find((x) => x.key === `level-${REGIONS[0].id}-0`).order.manifest;
    expect(L0.mounts).toBeUndefined();
    expect(L0.entities.some((e) => e.id === 'rhayu')).toBe(true);
  }, 120_000);
});
