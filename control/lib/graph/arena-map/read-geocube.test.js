// A GEOCUBE BUILDING READ AS AN ARENA MAP (arena-map/read-geocube.js). One building a plan shape, chosen from the
// program table in code (the first use of each shape), and one yard of two buildings. The concepts: the reading is a
// function of the plan; it stays on its grid; a doorway is an open edge and a wall a closed one; a stair joins its two
// levels by a way the laws walk; the laws run on what comes out; the bare shell adds no stock.
import { describe, expect, it } from 'vitest';

import { readBuildingMap, readSiteMap, planOf } from './read-geocube.js';
import { indexMap, distances, key } from './map.js';
import { mapLaws, LAW_IDS } from './laws.js';
import { PROGRAMS, PROGRAM_IDS } from '../era/programs.js';

const SHAPES = [...new Set(PROGRAM_IDS.map((id) => PROGRAMS[id].shape))];
const FIRST = Object.fromEntries(SHAPES.map((s) => [s, PROGRAM_IDS.find((id) => PROGRAMS[id].shape === s)]));
const READ = Object.fromEntries(SHAPES.map((s) => [s, readBuildingMap({ use: FIRST[s], seed: 1 })]));
const wallSet = (M) => new Map(M.walls.map((w) => [`${w.at},${w.side}`, w.kind]));
const cellsOf = (e) => [e.at, e.side === 'e' ? [e.at[0] + 1, e.at[1], e.at[2]] : [e.at[0], e.at[1] + 1, e.at[2]]];

describe('a building read onto the arena grid', () => {
  it.each(SHAPES)('(%s) is a function of its plan, and stays on its grid', (shape) => {
    const M = READ[shape];
    expect(readBuildingMap({ use: FIRST[shape], seed: 1 })).toEqual(M);
    expect(M.floors.length).toBeGreaterThan(0);
    for (const [i, j, k] of [...M.floors, ...M.solids]) expect(i >= 0 && j >= 0 && k >= 0 && i < M.nx && j < M.ny && k < M.nz).toBe(true);
    // (every room of the plan read, or said lost)
    expect(M.read.rooms.length).toBe(planOf({ use: FIRST[shape], seed: 1 }).rooms.length);
    for (const r of M.read.rooms.filter((x) => x.lost)) expect(M.read.notes.join(' ')).toContain(r.id);
  });

  it.each(SHAPES)('(%s) opens its doorways and closes its walls', (shape) => {
    const M = READ[shape], W = wallSet(M), I = indexMap(M), floor = new Set(M.floors.map((c) => key(...c)));
    expect(M.read.doors.length).toBeGreaterThan(0);
    for (const d of M.read.doors) {
      expect(W.has(`${d.at},${d.side}`)).toBe(false);
      const [a, b] = cellsOf(d);
      expect(floor.has(key(...a)) && floor.has(key(...b))).toBe(true);
      // (walked across, where neither side is a stair's run)
      if (I.standable(...a) && I.standable(...b)) expect(I.adj.get(key(...a)).some((e) => e.to === key(...b) && e.kind === 'walk')).toBe(true);
    }
    // a room's side that is no doorway is a wall: the first room's west side, where no door is
    const R = M.read.rooms.find((r) => !r.lost), [i0, j0, , j1] = R.box, doorEdges = new Set(M.read.doors.map((d) => `${d.at},${d.side}`));
    for (let j = j0; j < j1; j++) { const id = `${[i0 - 1, j, R.level]},e`; if (!doorEdges.has(id)) expect(W.get(id)).toBe('full'); }
    // and the laws judge it bounded: the way out is shut by default
    expect(mapLaws(M).laws.find((l) => l.law === 'bounded').holds).toBe(true);
  });

  it('joins a stair\'s two levels by a way the laws walk', () => {
    const shape = SHAPES.find((s) => READ[s].read.stairs.length), M = READ[shape];
    const S = M.read.stairs.find((s) => s.read !== 'none');
    expect(S).toBeTruthy();
    const n = (S.read === 'ramp' ? M.ramps : M.ladders).findIndex((x) => x.at.join() === S.at.join()), I = indexMap(M), C = I.connectors.find((c) => c.kind === S.read && c.n === n);
    expect(C.faults).toEqual([]);
    expect(C.to[2]).toBe(C.from[2] + 1);
    expect(distances(I, key(...C.from)).has(key(...C.to))).toBe(true);
    expect(distances(I, key(...C.to)).has(key(...C.from))).toBe(true);
    // (its true slope is said beside how it was read)
    expect(S.slope).toBeGreaterThan(0);
  });

  it('runs the laws on what it reads', () => {
    for (const s of SHAPES) {
      const R = mapLaws(READ[s]);
      expect(R.laws.map((l) => l.law)).toEqual(LAW_IDS);
      expect(R.held).toBeLessThanOrEqual(R.of);
      for (const l of R.laws) expect(typeof l.says).toBe('string');
    }
  });

  it('reads a stocked building\'s cover, and the bare shell reads none', () => {
    const use = PROGRAM_IDS.find((id) => PROGRAMS[id].base);
    const M = readBuildingMap({ use, seed: 1 }), bare = readBuildingMap({ use, seed: 1 }, { props: false });
    expect(M.read.props.solids + M.read.props.low + Object.keys(M.read.props.lost).length).toBeGreaterThan(0);
    expect(bare.solids).toEqual([]);
    expect(bare.walls.filter((w) => w.kind === 'low')).toEqual([]);
    const floor = new Set(M.floors.map((c) => key(...c)));
    for (const c of M.solids) expect(floor.has(key(...c))).toBe(true);
  });
});

describe('buildings on a yard', () => {
  it('floors the ground between them and opens their ways onto it', () => {
    const [a, b] = PROGRAM_IDS.filter((id) => PROGRAMS[id].shape === 'core' && PROGRAMS[id].core.storeys === 1);
    const A = planOf({ use: a, seed: 1 }), w = Math.max(...A.rooms.map((r) => r.box[2])) - Math.min(...A.rooms.map((r) => r.box[0]));
    const M = readSiteMap({ buildings: [{ id: a, plan: A, at: [0, 0] }, { id: b, plan: { use: b, seed: 1 }, at: [w + 12, 0] }] });
    const R = mapLaws(M);
    expect(R.laws.find((l) => l.law === 'bounded').holds).toBe(true);
    expect(R.laws.find((l) => l.law === 'connected').holds).toBe(true);
    const out = M.read.exits.filter((x) => x.open);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const x of out) expect(wallSet(M).has(`${x.at},${x.side}`)).toBe(false);
    expect(readSiteMap({ buildings: [{ id: a, plan: A, at: [0, 0] }, { id: b, plan: { use: b, seed: 1 }, at: [w + 12, 0] }] })).toEqual(M);
  });
});

// a building designed as a fighting map (era/programs.js FIGHT): the dials the plan carries, read
describe('a building designed as a fighting map, read', () => {
  // (a hall tall enough to be overlooked, off a single-loaded wing: the first in the table)
  const use = PROGRAM_IDS.find((id) => PROGRAMS[id].shape === 'core' && PROGRAMS[id].annex && PROGRAMS[id].core.storeys >= 2 && PROGRAMS[id].core.loading === 'single');
  const held = (M) => new Map(mapLaws(M).laws.map((l) => [l.law, l.holds]));

  it('reads nothing new where no dial is asked', () => {
    expect(readBuildingMap({ use, seed: 1, fight: false })).toEqual(readBuildingMap({ use, seed: 1 }));
  });

  it('reads a gallery as its deck at the upper level, railed, its doorway open and its stairs walked', () => {
    const M = readBuildingMap({ use, seed: 1, fight: { gallery: true } }), G = M.read.galleries?.[0];
    expect(G?.read).toBe('deck');
    const floor = new Set(M.floors.map((c) => key(...c))), I = indexMap(M);
    // (its deck at the level of the room it opens from, a column of cells railed by low walls on its open side)
    const deck = M.floors.filter((c) => c[2] === G.level && I.standable(...c) && M.walls.some((w) => w.kind === 'low' && w.at[2] === G.level && cellsOf(w).some((q) => q.join() === c.join())));
    expect(deck.length).toBeGreaterThan(1);
    // (its doorway: an open edge from the upper room onto it)
    const d = M.read.doors.find((x) => x.to.endsWith('/gallery'));
    expect(d).toBeTruthy();
    expect(wallSet(M).has(`${d.at},${d.side}`)).toBe(false);
    for (const c of cellsOf(d)) expect(floor.has(key(...c))).toBe(true);
    // (its stairs ramps the laws walk, up from the hall's floor to the deck)
    expect(G.stairs.length).toBeGreaterThan(0);
    for (const s of G.stairs) {
      const n = M.ramps.findIndex((r) => r.at.join() === s.at.join()), C = I.connectors.find((c) => c.kind === 'ramp' && c.n === n);
      expect(C.faults).toEqual([]);
      expect(C.to[2]).toBe(G.level);
    }
  });

  it('turns the circuit\'s laws: the loop and the second way up, where the bare plan fails them', () => {
    const before = held(readBuildingMap({ use, seed: 1 })), after = held(readBuildingMap({ use, seed: 1, fight: true }));
    for (const law of ['loops', 'levels-twice']) { expect(before.get(law), law).toBe(false); expect(after.get(law), law).toBe(true); }
    // (and keeps what held)
    for (const [law, ok] of before) if (ok) expect(after.get(law), law).toBe(true);
  });
});
