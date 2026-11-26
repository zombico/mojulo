import { describe, it, expect } from 'vitest';
import { readFloor, floorShapes, worksFloor, FLOOR_KINDS, CELL_MAX, FOOTINGS, FOOTING_STEP } from './works-floor.js';
import { WORKS_CARDS, readWorks } from './works.js';

// THE WORKS' FLOOR (works-floor.js): the floor under a works designed from above. One case per concept: the words read
// and refuse; the plan is read off the works (a unit's pad under it, a rack's footings stepped along it), its zones
// ranked; the page's cells name the zones over them highest first, as the shader looks them up; absent, nothing.
const id = Object.keys(WORKS_CARDS).find((k) => WORKS_CARDS[k].floor);
const centre = [-20, 30];

// (the shader's lookup, in JS: the first zone in the point's cell that holds it)
function zoneAt(P, S, p) {
  const c = [Math.floor((p[0] - P.o[0]) / P.cell), Math.floor((p[1] - P.o[1]) / P.cell)], cells = Buffer.from(P.cells, 'base64');
  for (let k = 0; k < CELL_MAX; k++) {
    const i = cells[(c[1] * P.n[0] + c[0]) * CELL_MAX + k] - 1;
    if (i < 0) continue;
    const s = S[i], q = [p[0] - s.at[0], p[1] - s.at[1]];
    let d = s.r ? Math.hypot(...q) - s.r : Math.max(Math.abs(q[0]) - s.half[0], Math.abs(q[1]) - s.half[1]);
    if (s.kerb === FOOTINGS) { const al = (s.half[0] >= s.half[1] ? q[0] + s.half[0] : q[1] + s.half[1]) - 1.6; d = Math.max(d, Math.abs((((al + FOOTING_STEP / 2) % FOOTING_STEP) + FOOTING_STEP) % FOOTING_STEP - FOOTING_STEP / 2) - 1.6); }
    if (d < 0) return s;
  }
  return null;
}

describe('the works\' floor', () => {
  it('reads its words over its defaults and refuses what it does not know', () => {
    expect(readFloor({ yard: 'gravel' })).toMatchObject({ yard: 'gravel', ring: 0 });
    expect(readFloor(undefined)).toBeNull();
    expect(() => readFloor({ tiles: 1 })).toThrow(/not a word/);
    expect(() => readFloor({ lanes: [{ path: [[0, 0], [10, 10]] }] })).toThrow(/along the axes/);
    expect(() => readWorks({ from: id, floor: { yard: 'marble' } })).toThrow(/yard/);
  });

  it('is read off the works: a pad under each unit, a rack\'s footings stepped under its posts, ranked trench to lane', () => {
    const W = readWorks({ hall: { half: [200, 200], height: 60 }, frames: [{ at: [0, 0], bays: [2, 2], levels: [12] }], racks: [{ path: [[-100, 80], [100, 80]], tiers: [10], width: 10 }],
      furnaces: [{ at: [100, -100], radius: 10, height: 20 }], floor: { lanes: [{ path: [[-150, 40], [150, 40]] }], ring: 20 } });
    const S = floorShapes(W, readFloor(W.floor), centre), rank = [FLOOR_KINDS.trench, FLOOR_KINDS.apron, FLOOR_KINDS.pad, FLOOR_KINDS.lane];
    for (let i = 1; i < S.length; i++) expect(rank.indexOf(S[i].kind)).toBeGreaterThanOrEqual(rank.indexOf(S[i - 1].kind));
    const P = worksFloor(W, centre), at = (x, y) => zoneAt(P, S, [centre[0] + x, centre[1] + y]);
    expect(at(0, 0).kind).toBe(FLOOR_KINDS.pad);
    expect(at(100, -100).kind).toBe(FLOOR_KINDS.apron);
    expect(at(0, 40).kind).toBe(FLOOR_KINDS.lane);
    expect(at(0, -18).kind).toBe(FLOOR_KINDS.trench);   // (along the frame's south side, 2 m off its pad)
    expect(at(-100, 85).kind).toBe(FLOOR_KINDS.pad);    // (a post's footing, and the next a bent on)
    expect(at(-100 + FOOTING_STEP, 85).kind).toBe(FLOOR_KINDS.pad);
    expect(at(-100 + FOOTING_STEP / 2, 85)).toBeNull(); // (the yard between them)
    expect(at(-60, -60)).toBeNull();
    // (a track's ballast bed, a lane paved over it where they cross)
    const T = readWorks({ hall: { half: [200, 200], height: 60 }, rails: [{ path: [[-150, -120], [150, -120]] }], floor: { lanes: [{ path: [[0, -180], [0, 180]] }] } });
    const ST = floorShapes(T, readFloor(T.floor), centre), PT = worksFloor(T, centre), atT = (x, y) => zoneAt(PT, ST, [centre[0] + x, centre[1] + y]);
    expect(atT(-80, -120).kind).toBe(FLOOR_KINDS.bed);
    expect(atT(0, -120).kind).toBe(FLOOR_KINDS.lane);
  });

  it('packs the plan for the page, each cell its zones highest first, the same for the same works; none without a floor', () => {
    const W = readWorks(id), P = worksFloor(W, centre);
    expect(P.over).toBe(0);
    expect(P.count).toBeLessThanOrEqual(255);
    expect(Buffer.from(P.shapes, 'base64').length).toBe(P.count * 32);
    expect(Buffer.from(P.cells, 'base64').length).toBe(P.n[0] * P.n[1] * CELL_MAX);
    expect(JSON.stringify(worksFloor(structuredClone(W), centre))).toBe(JSON.stringify(P));
    expect(worksFloor(readWorks({ from: id, floor: null }), centre)).toBeNull();
  });
});
