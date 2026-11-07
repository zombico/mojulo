import { describe, it, expect } from 'vitest';
import { WORLDMAP_SAMPLE, worldmapGame, crossings } from './worldmap-bed.js';
import { readGameworld } from './world.js';
import { gameStages } from './levels.js';

// A ZONED MAP AS A GAME (level/zones.js): a stage a segment, each its own page, its ways the plan's gates on its border,
// arrival keyed by the zone come from. The world before its people (no hero): each zone walked first person.
describe('a zoned map made into a game', () => {
  it('is a stage a segment, the walk\'s first, then on along it, the segments off it last', () => {
    const S = gameStages(WORLDMAP_SAMPLE);
    expect(S.map((s) => [s.node, s.zone, s.manifest.kind, s.manifest.level.zone])).toEqual([['A', 'A', 'map', 'A'], ['B', 'B', 'map', 'B'], ['D', 'D', 'map', 'D'], ['C', 'C', 'map', 'C']]);
    expect(S[0].manifest.level.zoned).toBeUndefined();
  });

  it('leaves each zone by its gates, named by side, toward the zone across; arrives by the zone come from', () => {
    const M = worldmapGame(WORLDMAP_SAMPLE, { ref: 'wm' }), ref = (S) => M.levels.find((l) => l.zone === S).ref;
    const exits = Object.fromEntries(M.game.levels.map((l) => [M.levels.find((x) => x.ref === l.ref).zone, (l.exits ?? []).map((e) => `${e.id}>${M.levels.find((x) => x.ref === e.to).zone}`)]));
    expect(exits).toEqual({ A: ['gate-e>B', 'gate-s>C'], B: ['gate-w>A', 'gate-s>D'], D: ['gate-n>B', 'gate-w>C'], C: ['gate-n>A', 'gate-e>D'] });
    // (B: its reach-exits on its gates' exits, its arrivals on its gates' arrivals, a metre up)
    const B = M.levels.find((l) => l.zone === 'B').manifest, Z = M.zones[ref('B')];
    const gates = B.game.mechanics.filter((m) => m.kind === 'reach-exit');
    expect(gates.map((m) => [m.exit, m.at]).sort()).toEqual([['gate-s', Z.ways[0].exit], ['gate-w', Z.ways[1].exit]]);
    expect(B.game.arrive.sort()).toEqual([ref('A'), ref('D')].sort());
    const fromA = B.events.reactions.find((r) => r.on === `arrive:${ref('A')}`);
    expect(fromA.to.slice(0, 2)).toEqual(Z.ways.find((w) => w.to === 'A').arrive.slice(0, 2));
    // (set out at its way in from the town, facing in)
    expect(B.entities[0].transform.heading).toBeCloseTo(0);
    // (the keep holds the walk's goal: it keeps its own exit, the game's win, beside its gates)
    const D = M.levels.find((l) => l.zone === 'D').manifest;
    expect(D.game.mechanics.filter((m) => m.kind === 'reach-exit' && m.exit === undefined)).toHaveLength(1);
    // (no gate exit in A: it holds no goal)
    expect(M.levels.find((l) => l.zone === 'A').manifest.game.mechanics.filter((m) => m.kind === 'reach-exit' && m.exit === undefined)).toHaveLength(0);
  });

  it('walks every gate of the world once, each crossing from where the last set down', () => {
    const M = worldmapGame(WORLDMAP_SAMPLE, { ref: 'wm' }), C = crossings(M);
    const zone = (r) => M.levels.find((l) => l.ref === r).zone;
    expect(new Set(C.map((c) => `${zone(c.from)}>${c.exit}`)).size).toBe(8);
    C.slice(1).forEach((c, i) => expect(c.from).toBe(C[i].to));
  });

  it('refuses a zoned map with no plan, or in a world not travelled', () => {
    const lv = WORLDMAP_SAMPLE.levels.overworld.glyphs;
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, topology: undefined })).toThrow(/zoned is a world map.*interconnected/);
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { tile: 24, zoned: true, rows: ['# #'] } } } })).toThrow(/write its plan/);
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { ...lv, zoned: false } } } })).toThrow(/zoned is true/);
    const { zoned: _z, ...plain } = lv;
    expect(() => readGameworld({ ...WORLDMAP_SAMPLE, levels: { overworld: { glyphs: { ...plain, apron: 1 } } } })).toThrow(/apron is a zoned map's/);
  });
});
