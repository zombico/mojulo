// CERES (gameworld/artesia.js): the world of Fable of Artesia, the rail's game, a megaworld chain of regions, each its own light,
// each opened by the shard freed from the dragon of the one before.
import { describe, it, expect } from 'vitest';
import { CERES, REGIONS, REGION_IDS, regionLevel, ceresWorld, dragonKind } from './artesia.js';
import { DRAGONS } from '../boss/dragons.js';
import { readGameworld } from './world.js';
import { megaworldLaws } from './megaworld.js';
import { pitchStart } from './pitch-start.js';
import { castingCall } from './foe-casting.js';
import { lairStage } from './lair.js';
import { stageLevelOrder } from './levels.js';
import { readHour } from '../era/geocube-hours.js';

describe('the land of Ceres', () => {
  it('its regions a chain: each its own hour, each but the last a dragon of the shelf and its shard, the last its capital', () => {
    expect(new Set(REGION_IDS).size).toBe(REGIONS.length);
    expect(new Set(REGIONS.map((R) => R.hour)).size).toBe(REGIONS.length);
    for (const R of REGIONS) { expect(() => readHour(R.hour)).not.toThrow(); expect(R.blocks).toHaveLength(5); }
    for (const R of REGIONS.slice(0, -1)) { expect(DRAGONS[R.dragon], R.id).toBeTruthy(); expect(R.shard).toBeTruthy(); }
    expect(REGIONS.at(-1).name).toBe(CERES.capital);
  });
  it('a region is a world map: its blocks named, lit at its hour, every block moved by its shift, its climax its dragon; only the first teaches', () => {
    const [R0, R1] = REGIONS, L0 = regionLevel(R0, 0), L1 = regionLevel(R1, 1);
    expect(L0.name).toBe(R0.name); expect(L0.style).toEqual({ hour: R0.hour });
    const K = L1.glyphs.plan.key;
    expect(Object.values(K).map((k) => k.name).slice(0, 5)).toEqual([...R1.blocks]);
    for (const k of Object.values(K)) expect(k.palette.shift).toMatchObject(R1.shift);
    const climax = (L) => L.glyphs.sketch.scenario.beats.find((b) => b.kind === 'climax');
    expect(climax(L1).foes).toEqual({ [dragonKind(R1.dragon)]: 1 });
    expect(L0.glyphs.sketch.scenario.beats.some((b) => b.teach)).toBe(true);
    expect(L1.glyphs.sketch.scenario.beats.some((b) => b.teach)).toBe(false);
  });
  it('the world laid as Ceres: its regions its levels, a chain whose every way in waits on the shard freed before it; the creator\'s keys kept', () => {
    const W = ceresWorld({ id: 'c', name: 'Theirs', seed: 4, levels: { old: { name: 'old' } }, links: [{ from: 'old', to: 'old' }] });
    expect(Object.keys(W.levels)).toEqual([...REGION_IDS]);
    expect(W).toMatchObject({ name: 'Theirs', seed: 4, start: REGION_IDS[0], topology: 'interconnected' });
    expect(W.links).toHaveLength(REGIONS.length - 1);
    W.links.forEach((l, i) => expect(l).toMatchObject({ from: REGION_IDS[i], to: REGION_IDS[i + 1], kind: 'gate', key: REGIONS[i].shard, keyAt: REGION_IDS[i] }));
    for (const l of megaworldLaws(W.megaworld)) expect(l.ok, l.says).toBe(true);
  });
  it('laid from the rail: the composed Artesia, its one map the regions; each dragon cast on its region\'s climax', () => {
    const P = pitchStart({ id: 'g', name: 'Ceres', rail: { from: 'fable-of-artesia', locked: true } });
    expect(P.laid).toMatchObject({ levels: [...REGION_IDS] });
    expect(P.world.feel).toBe('fable-of-artesia');
    expect(readGameworld(P.world).ids).toEqual([...REGION_IDS]);
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
