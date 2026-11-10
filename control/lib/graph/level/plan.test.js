import { describe, it, expect } from 'vitest';
import { readGrid } from './grid.js';
import { gridEnds } from './grid-ends.js';
import { assembleGridScene } from './grid-scene.js';
import { gameStages, stageEnds } from '../gameworld/levels.js';
import { battlePlan, roomOf } from '../gameworld/battles.js';
import { readGameworld } from '../gameworld/world.js';
import { mapItems } from './map-items.js';
import { readMainQuest, mainQuestContext } from '../gameworld/main-quest.js';

// A MAP'S PLAN: the map planned whole as segments, each written on its own against the gates the plan fixed, and the
// plan stitching them into one grid. A segment not yet written is laid from the plan, so the map is one level at every
// moment; a written one is held to its law, so it never joins a neighbour the plan did not join.

// three segments of 4 × 4 tiles: the town (A) east to the woods (B), south to the shrine (C)
const plan = {
  size: 4, rows: ['A B', '. C'], route: ['A', 'B', 'C'],
  key: { A: { name: 'the town' }, B: { name: 'the woods', rise: 3 }, C: { name: 'the shrine', rise: 6, goal: { use: 'temple' } } },
};
const grid = (segments) => ({ tile: 32, plan, ...(segments ? { segments } : {}) });

describe('a map planned as segments', () => {
  it('is a whole level before any segment is written: the plan lays each one, gate to gate', () => {
    const G = readGrid(grid());
    expect([G.rows, G.cols]).toEqual([8, 8]);
    // (the gates: A's east to B's west on their middle row, B's south to C's north on their middle column; an even
    // side's lower middle)
    expect(G.plan.gates).toEqual([
      { from: 'A', to: 'B', side: 'e', tiles: [[1, 3], [1, 4]] },
      { from: 'B', to: 'C', side: 's', tiles: [[3, 5], [4, 5]] },
    ]);
    expect(G.plan.roles).toEqual({ A: 'arrival', B: 'passage', C: 'climax' });
    expect(Object.values(G.plan.segments).map((s) => s.written)).toEqual([false, false, false]);
    // (each segment its region, named and risen as the plan says; open land the level's own)
    expect(G.at(0, 0).region).toBe('A'); expect(G.at(5, 5).region).toBe('C'); expect(G.at(5, 1).region).toBeUndefined();
    expect(G.regions.B).toMatchObject({ name: 'the woods', rise: 3 });
    // (the walk: set out from the town's middle, the shrine's temple its goal)
    const E = gridEnds({ seed: 3, grid: grid() });
    expect(E.exit).toBeTruthy();
    expect(E.places.find((p) => p.use === 'temple')).toMatchObject({ region: 'the shrine' });
    expect(E.beats.filter((b) => b.beat === 'along').map((b) => b.region)).toEqual(expect.arrayContaining(['the town', 'the woods']));
  });

  it('takes a written segment in place of its fill, renaming a place glyph two segments share', () => {
    // (A's west side and B's east side lie on the map's edge, C's west side on open land: their own)
    const A = { rows: ['h . . .', '# # # #', '. s . .', '. . . .'], key: { h: { use: 'dwelling' }, s: { use: 'shop' } } };
    const B = { rows: ['. . . .', '# # . .', '. # # #', '. # . .'], key: {} };
    const C = { rows: ['. # . .', 'h # . .', '. G . .', '. . . .'], key: { h: { use: 'dwelling', door: 'e' }, G: { use: 'temple', goal: true } } };
    const G = readGrid(grid({ A, B, C }));
    expect(Object.values(G.plan.segments).map((s) => s.written)).toEqual([true, true, true]);
    // (A's dwelling keeps 'h'; C's, a different place, takes the next free letter)
    const dwellings = G.cells.filter((x) => x.kind === 'place' && x.place.use === 'dwelling');
    expect(new Set(dwellings.map((x) => x.glyph)).size).toBe(2);
    expect(G.at(0, 0).glyph).toBe('h');
    // (written in any order, the same map)
    const again = readGrid(grid({ C, A, B }));
    expect(again.cells.map((x) => x.glyph).join('')).toBe(G.cells.map((x) => x.glyph).join(''));
  });

  it('sets the walk out from its arrival, facing the way on, though its ways all end at doors', () => {
    // (no path end anywhere: the town's street ends at the keeper's door, the woods' lookout at its tower's: the first
    // path tile in reading order lies in the woods, the walk still sets out from the town's far end, facing down its street)
    const A = { rows: ['K . . .', '# # # #', '. . . .', '. . . .'], key: { K: { use: 'dwelling', door: 's' } } };
    const B = { rows: ['. L # .', '# # # .', '. # . .', '. # . .'], key: { L: { use: 'tower', door: 'e' } } };
    const E = gridEnds({ seed: 3, grid: { tile: 32, plan, segments: { A, B } } });
    expect(E.home).toBe('the town');
    expect(E.spawn[0]).toBeLessThan(32); expect(E.spawn[1]).toBeLessThan(-32);
    expect(Math.abs(E.heading)).toBeLessThan(0.3);
  });

  it('holds a written segment to its law: its gates, its border, its own ways, its goal', () => {
    const bad = (seg, re) => expect(() => readGrid(grid({ B: seg }))).toThrow(re);
    // (a path on a side a neighbour lies beyond, off its gate, would join the neighbour where the plan did not)
    bad({ rows: ['. . . .', '# # . .', '# # . .', '. # . .'] }, /lies on its west side, which a neighbour lies beyond/);
    // (but a side on the map's edge is its own: a lookout off the woods' east edge)
    expect(() => readGrid(grid({ B: { rows: ['. . . .', '# # . .', '. # # #', '. # . .'] } }))).not.toThrow();
    // (its gate is a path, where the plan's way crosses)
    bad({ rows: ['. . . .', '. # . .', '. # . .', '. # . .'] }, /gate on the west side/);
    // (its size the plan's)
    bad({ rows: ['. .', '# #'] }, /4 rows of 4 glyphs/);
    // (every path reached from its gates)
    bad({ rows: ['. . . .', '# # . .', '. # . #', '. # . .'] }, /not reached from its gates/);
    expect(() => readGrid(grid({ C: { rows: ['. # . .', '. # . .', '. . . .', '. . . .'] } }))).toThrow(/no place in it is that goal/);
    // (a segment the plan does not lay out)
    expect(() => readGrid(grid({ D: { rows: ['. . . .', '. . . .', '. . . .', '. . . .'] } }))).toThrow(/no such segment/);
  });

  it('refuses a route that is not a walk through every segment, step by step', () => {
    const P = (p) => () => readGrid({ plan: { ...plan, ...p } });
    expect(P({ route: ['A', 'B'] })).toThrow(/never reaches 'C'/);
    expect(P({ rows: ['A B', 'C .'], route: ['A', 'B', 'C'] })).toThrow(/do not share a side/);
    expect(P({ route: ['A', 'B', 'A'] })).toThrow(/walks a segment twice/);
    expect(() => readGrid({ plan, rows: ['# #'] })).toThrow(/never in rows/);
    expect(() => readGrid({ rows: ['# #'], segments: {} })).toThrow(/written against a plan/);
  });

  it('builds one page whose laws hold, with every segment filled and with them written', async () => {
    const T = 24, tileStage = async (m) => {
      const faces = [];
      for (let x = 0; x < T; x += 4) for (let y = 0; y < T; y += 4) faces.push({ corners: [[x, y, 0], [x + 4, y, 0], [x + 4, y + 4, 0], [x, y + 4, 0]], normal: [0, 0, 1], group: 'isekai:ground', fill: '#7aa04a' });
      return { faces, walk: { speed: 6, minEye: 1.7 }, sky: { day: 1 } };
    };
    for (const segments of [undefined, { B: { rows: ['. . . .', '# # . .', '. # # #', '. # . .'] } }]) {
      const P = await assembleGridScene({ level: { kit: 'isekai-meadow', seed: 2, grid: { tile: T, plan, ...(segments ? { segments } : {}) } } }, {}, { buildStage: tileStage });
      for (const l of P.map.laws) expect(l.ok, `${l.law}: ${l.value}`).toBe(true);
      expect(Object.keys(P.map.regions)).toEqual(['A', 'B', 'C']);
      // (the plan and its pieces read out; the pieces law among the laws)
      expect(P.map.pieces.map((it) => it.kind)).toEqual(['hero-tree', 'pack', 'boss']);
      expect(P.map.laws.find((l) => l.law === 'pieces').value).toMatch(/^3 pieces placed/);
    }
    // (a plan whose segments rise too far apart for its tiles: its paths climb a wall, and the law says where)
    const steep = { ...plan, key: { ...plan.key, B: { ...plan.key.B, rise: 10 } } };
    const S = await assembleGridScene({ level: { kit: 'isekai-meadow', seed: 2, grid: { tile: T, plan: steep } } }, {}, { buildStage: tileStage });
    expect(S.map.laws.find((l) => l.law === 'path-grade')).toMatchObject({ ok: false, value: expect.stringMatching(/climb 63% at the steepest .*10 m over a 24 m tile/) });
  });

  it('is a gameworld level: one map stage, set out from the town, its packs past it, its quest beats on its segments', () => {
    const W = { id: 'w', start: 'vale', levels: { vale: { glyphs: { tile: 32, plan } } }, battles: { per: 1 } };
    const S = gameStages(W), E = stageEnds(S[0].manifest);
    expect(S.map((s) => [s.node, s.manifest.kind])).toEqual([['map', 'map']]);
    expect(E.home).toBe('the town');
    expect(E.exitFrom).toMatch(/temple/);
    // (a stage's worth of packs in each segment past the town)
    expect(battlePlan(readGameworld(W), S, () => roomOf(E))[0]).toHaveLength(2);
    // (a beat plays a segment, by its letter: the segment is its region)
    const C = mainQuestContext(W), Q = { acts: [{ id: 'one', goal: 'reach the shrine', beats: [{ id: 'woods', goal: 'cross the woods', as: { level: 'vale', region: 'B' } }] }] };
    expect(readMainQuest(Q, C).acts[0].beats[0].as).toMatchObject({ kind: 'level', at: 'vale', region: 'the woods' });
    // (a segment's law reaches the gameworld's own read)
    expect(() => readGameworld({ ...W, levels: { vale: { glyphs: { tile: 32, plan, segments: { B: { rows: ['. . . .', '. # . .', '. # . .', '. # . .'] } } } } } })).toThrow(/gate on the west side/);
  });
});

// THE MAP'S PIECES (level/map-items.js): each segment's role placed on the map as stitched, the composer's set pieces at
// the map's scale; the plan pins what it wants otherwise.
describe('a planned map\'s pieces', () => {
  it('places each role\'s piece on the way: the town its hero tree, the woods a pack, the shrine its boss', () => {
    const G = readGrid(grid());
    expect(mapItems(G).map((it) => [it.id, it.kind, it.role])).toEqual([
      ['A/focus/hero-tree', 'hero-tree', 'arrival'], ['B/way/pack', 'pack', 'passage'], ['C/focus/boss', 'boss', 'climax'],
    ]);
    // (each on a path tile of its own segment, on the way)
    for (const it of mapItems(G)) { const x = G.at(...it.tile); expect(x.kind).toBe('path'); expect(x.region).toBe(it.segment); }
    // (a pinned landmark takes the hero tree from the arrival)
    const lm = readGrid({ ...grid(), plan: { ...plan, key: { ...plan.key, B: { ...plan.key.B, role: 'landmark' } } } });
    expect(mapItems(lm).map((it) => it.id)).toEqual(['B/focus/hero-tree', 'C/focus/boss']);
    // (a plain grid has none)
    expect(mapItems(readGrid({ rows: ['# #'] }))).toEqual([]);
  });

  it('takes the plan\'s pins: a piece moved to a tile of its segment, or none, and refuses a pin off its ground', () => {
    const B = { rows: ['. . . .', '# # . .', '. # # #', '. # . .'] };
    const pinned = readGrid({ tile: 32, plan: { ...plan, props: { 'B/way/pack': { tile: [2, 3] }, 'A/focus/hero-tree': false } }, segments: { B } });
    const it = mapItems(pinned);
    expect(it.map((x) => x.id)).toEqual(['B/way/pack', 'C/focus/boss']);
    expect(it[0]).toMatchObject({ tile: [2, 7], pinned: true });
    expect(() => mapItems(readGrid({ tile: 32, plan: { ...plan, props: { 'B/way/pack': { tile: [0, 0] } } } }))).toThrow(/no path for a pack of foes/);
    expect(() => mapItems(readGrid({ tile: 32, plan: { ...plan, props: { 'Z/way/pack': false } } }))).toThrow(/no such piece/);
    expect(() => readGrid({ tile: 32, plan: { ...plan, props: { 'B/way/pack': { tile: [9, 0] } } } })).toThrow(/a tile of its segment \(0 to 3\)/);
  });

  it('stands the hero tree and the packs where the pieces are: the page\'s hero tile, the battles\' spots', async () => {
    const W = { id: 'w', start: 'vale', levels: { vale: { glyphs: { tile: 32, plan } } }, battles: { per: 1 } };
    const S = gameStages(W), E = stageEnds(S[0].manifest), G = readGrid(grid());
    // (the ends say where the packs stand, in the order the way meets them)
    expect(E.packs.map((p) => p.piece)).toEqual(['B/way/pack', 'C/focus/boss']);
    // (the page's hero tile is the piece's)
    const seen = [];
    await assembleGridScene({ level: { kit: 'isekai-meadow', seed: 2, grid: { tile: 24, plan } } }, {}, { buildStage: async (m) => { seen.push(m.tile); return { faces: [], walk: {}, sky: {} }; } });
    const hero = mapItems(G).find((it) => it.kind === 'hero-tree').tile;
    expect(seen.filter((t) => t.hero).map((t) => t.origin)).toEqual([[hero[1] * 24, -(hero[0] + 1) * 24]]);
  });
});

