// A building SET INTO ITS SLOPE (stage-buildings.js `embed`): its walkout on the land before it, a door out of its upper
// storey onto the land behind, the land graded between them (era/grade.js), a stair up the land beside it and paths of
// slabs to its doors (era/outdoor-stair.js). The gates: each door a step over its own land; in at the upper door, down
// its own stairs and out at the walkout with no wall in the way; round the outside from the walkout up the stair to the
// upper door, no step taller than a riser and nothing in the way; the bank on its other side walkable; no window under
// the land. And the parts: the grade, the stair, the room a trail's ground makes for it, a way out of an upper storey.

import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage } from './stage.js';
import { applyGrade, readGrade, FALL } from './grade.js';
import { planStair, stairFaces, slabPath, STAIR } from './outdoor-stair.js';
import { outTrailOf } from './out-trail-board.js';

// an outpost's command building set into the valley, on a trail with room beside it
const B0 = { use: 'command', wings: 'I', bays: 1, loading: 'single', embed: true };
const P = assembleStageScene({ kind: 'stage', geocube: 'valley-morning', trail: { ground: { room: 30 } }, hour: 'noon', buildings: [B0] });
const A = P.anchors.find((a) => a.kind === 'building'), E = A.embed;

// the land's height under a point: the highest ground face (or step, or path) over it, read through its triangles
const tris = P.faces.filter((f) => /:(ground|trail|top)$|^building:(stair|path)$/.test(f.group) && f.corners.length >= 3)
  .flatMap((f) => f.corners.slice(1, -1).map((_, k) => [f.corners[0], f.corners[k + 1], f.corners[k + 2]]));
const ground = (x, y) => {
  let best = null;
  for (const [a, b, c] of tris) {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const z = l1 * a[2] + l2 * b[2] + l3 * c[2];
    if (best === null || z > best) best = z;
  }
  return best;
};
const walls = P.colliders.filter((c) => !String(c.of).startsWith('bound:'));
const inWall = (p) => walls.some((c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2]);
// a walk along points: each leg sampled every quarter metre at a body's height, and the most it climbs between points
const walk = (pts) => {
  let blocked = 0, step = 0;
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25) || 1;
    step = Math.max(step, Math.abs(b[2] - a[2]));
    for (let j = 0; j <= n; j++) { const t = j / n; if (inWall([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + 1])) blocked++; }
  }
  return { blocked, step };
};

describe('a building set into its slope', () => {
  it('has two doors on opposite faces, each a step over its own land: the walkout below, the upper storey on the land behind', () => {
    expect(E.up).toBe(1);
    expect(E.rise).toBeGreaterThan(3);
    expect(E.upper.at[2] - E.lower.at[2]).toBeCloseTo(E.rise, 5);
    expect(E.upper.N[0] * E.lower.N[0] + E.upper.N[1] * E.lower.N[1]).toBe(-1);
    for (const d of [E.upper, E.lower]) {
      const z = ground(d.at[0] + d.N[0] * 1.2, d.at[1] + d.N[1] * 1.2);
      expect(d.at[2] - z, d.room).toBeGreaterThan(0);
      expect(d.at[2] - z, d.room).toBeLessThan(0.2);
    }
    expect(A.rooms.find((r) => r.id === E.upper.room).storey).toBe(1);
  });

  it('is walked through on its own stairs: in at the upper door, down a storey, out at the walkout, no wall in the way', () => {
    const T = E.through;
    expect(T[0][2] - A.floor).toBeCloseTo(E.rise, 5);
    expect(T.at(-1)[2]).toBeCloseTo(A.floor, 5);
    expect(walk(T).blocked).toBe(0);
  });

  it('is walked round outside: from the walkout up its stair to the upper door, no step over a riser, nothing in the way', () => {
    const R = E.round, w = walk(R);
    expect(E.stair.steps * E.stair.riser).toBeCloseTo(E.rise, 3);
    expect(E.stair.riser).toBeLessThanOrEqual(STAIR.riser);
    expect(R[0][2]).toBeLessThan(A.floor);
    expect(R.at(-1)[2]).toBeGreaterThan(A.floor + E.rise - 0.3);
    expect(w.blocked).toBe(0);
    expect(w.step).toBeLessThan(0.25);
    expect(E.paths).toBeGreaterThan(0);
    expect(P.faces.filter((f) => f.group === 'building:path').length).toBeGreaterThan(0);
    expect(P.faces.filter((f) => f.group === 'building:stair').length).toBe(2 * E.stair.steps);
  });

  it('on its other side the land is a bank walked up and down, from the walkout\'s ground to the upper door\'s', () => {
    const boxes = A.rooms.map((r) => r.box), lo = [0, 1].map((k) => Math.min(...boxes.map((b) => b.min[k]))), hi = [0, 1].map((k) => Math.max(...boxes.map((b) => b.max[k])));
    // (the side the stair is not on, 2.5 m out from the building, from its front to its back)
    const N = A.N, S = [-N[1], N[0]], c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], half = Math.abs(S[0]) * (hi[0] - lo[0]) / 2 + Math.abs(S[1]) * (hi[1] - lo[1]) / 2;
    const stairSide = Math.sign((E.stair.foot[0] - c[0]) * S[0] + (E.stair.foot[1] - c[1]) * S[1]), depth = Math.abs(N[0]) * (hi[0] - lo[0]) / 2 + Math.abs(N[1]) * (hi[1] - lo[1]) / 2;
    const pts = [];
    for (let s = depth; s >= -depth; s -= 0.5) { const x = c[0] - stairSide * S[0] * (half + 2.5) + N[0] * s, y = c[1] - stairSide * S[1] * (half + 2.5) + N[1] * s; pts.push([x, y, ground(x, y)]); }
    expect(pts.every((p) => p[2] !== null)).toBe(true);
    let steep = 0;
    for (let k = 0; k + 1 < pts.length; k++) steep = Math.max(steep, Math.abs(pts[k + 1][2] - pts[k][2]) / 0.5);
    expect(steep).toBeLessThan(0.45);
    expect(Math.max(...pts.map((p) => p[2])) - Math.min(...pts.map((p) => p[2]))).toBeGreaterThan(E.rise - 0.6);
  });

  it('lays no window under the land outside it', () => {
    const panes = P.faces.filter((f) => f.group === 'stage:pane');
    expect(panes.length).toBeGreaterThan(0);
    for (const p of panes) {
      const m = [0, 1, 2].map((k) => p.corners.reduce((a, c) => a + c[k], 0) / p.corners.length), o = [m[0] - p.normal[0] * 1.2, m[1] - p.normal[1] * 1.2];
      const z = ground(o[0], o[1]);
      if (z !== null) expect(Math.min(...p.corners.map((c) => c[2]))).toBeGreaterThan(z);
    }
  });

  it('says what is wrong', () => {
    const at = (b) => () => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: true, buildings: [b] });
    expect(at({ use: 'armoury', bays: 1, embed: true })).toThrow(/stands 1 storey: give it storeys/);
    expect(at({ ...B0, embed: { up: 1, stair: true } })).toThrow(/embed is true or \{ up\?/);
    expect(at({ ...B0, enter: 'door' })).toThrow(/changes no scene at a door/);
  });
});

describe('the parts', () => {
  const grid = () => ({ nx: 21, ny: 21, z: new Float64Array(21 * 21), apron: new Float64Array(21 * 21).fill(1), hard: new Float64Array(21 * 21).fill(1) });
  const opts = { gridX: (g, i) => i, gridY: (g, j) => j };
  const zAt = (g, x, y) => g.z[y * g.nx + x];

  it('the grade: a pad lays its box level, a ramp on its plane, each easing out over its fall, a later one over an earlier', () => {
    const g = applyGrade(grid(), readGrade([{ box: [2, 2, 18, 10], z: [0, 4], dir: [0, 1] }, { box: [2, 12, 18, 18], z: 4, fall: 2 }]), opts);
    expect(zAt(g, 10, 2)).toBeCloseTo(0, 6);
    expect(zAt(g, 10, 6)).toBeCloseTo(2, 6);
    expect(zAt(g, 10, 10)).toBeCloseTo(4, 6);
    expect(zAt(g, 10, 15)).toBeCloseTo(4, 6);
    expect(g.apron[15 * 21 + 10]).toBe(0);
    // a short fall leaves the land beside it as it was
    const h = applyGrade(grid(), [{ box: [8, 8, 12, 12], z: 3, fall: 1 }], opts);
    expect(zAt(h, 10, 10)).toBe(3);
    expect(zAt(h, 10, 14)).toBe(0);
    expect(FALL).toBeGreaterThan(1);
    expect(readGrade(undefined)).toBeNull();
    expect(() => readGrade([{ box: [0, 0, 1], z: 1 }])).toThrow(/_grade is/);
  });

  it('the stair: its risers within the most a riser is, its flight between landings, none on a side too short', () => {
    const S = planStair({ x0: 0, x1: 10, y0: 0, yu: 20, rise: 4, side: 1 });
    expect(S.n * S.h).toBeCloseTo(4, 3);
    expect(S.h).toBeLessThanOrEqual(STAIR.riser);
    expect(S.x[0]).toBeGreaterThan(10);
    expect(S.head - S.foot).toBeCloseTo(S.n * STAIR.going, 5);
    expect(S.foot).toBeGreaterThanOrEqual(STAIR.landing);
    expect(planStair({ x0: 0, x1: 10, y0: 0, yu: 6, rise: 4, side: -1 })).toBeNull();
    const F = stairFaces(S);
    expect(F.faces.filter((f) => f.group === 'stair')).toHaveLength(2 * S.n);
    expect(F.colliders).toHaveLength(2);
    expect(slabPath([0, 0], [6, 0], () => 1).every((f) => f.corners.every((c) => c[2] > 1))).toBe(true);
  });

  it("a trail's ground makes room past its far side, the trail where it was; a coast takes none", () => {
    const base = outTrailOf({ kind: 'stage', kit: 'isekai-meadow', trail: true }).site, wide = outTrailOf({ kind: 'stage', kit: 'isekai-meadow', trail: { ground: { room: 20 } } }).site;
    expect(wide.W - base.W).toBeCloseTo(20, 6);
    expect(wide.trailX(30)).toBeCloseTo(base.trailX(30), 6);
    expect(() => outTrailOf({ kind: 'stage', kit: 'isekai-meadow', trail: { ground: { room: 20, water: { coast: {} } } } })).toThrow(/takes no room/);
  });

  it('a room on an upper storey has a way out through an outside wall', () => {
    const rooms = [{ id: 'a', x: 0, y: 0, w: 8, d: 8, h: 4 }, { id: 'b', x: 8, y: 0, w: 7, d: 8, h: 4 }, { id: 'c', x: 8, y: 0, w: 7, d: 8, h: 4, storey: 1 }, { id: 'd', x: 0, y: 0, w: 8, d: 8, h: 4, storey: 1 }];
    const plan = planStage({ kind: 'stage', kit: 'gothic-stone', rooms, links: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }], ways: [{ room: 'a', side: '-y' }, { room: 'd', side: '+y' }] });
    expect(plan.ways.map((w) => w.room)).toEqual(['a', 'd']);
  });
});
