// THE PODIUM WALKED INTO (`geocity.under`): a core podium entered from its plaza, a lobby level with it and a concourse
// under it down a stair. The parts on a lot of their own (its plan clear of its towers, the facade cut at its door), then
// the gate on the smallest evocation that holds one: walked by the page's ground probe over the payload's own faces and
// boxes, in at the door, down the stair, along the concourse and back, no step taller than a riser, no wall crossed,
// no box entered.
import { describe, it, expect } from 'vitest';
import { podiumInside, podiumRecipe, cutFace, PODIUM } from './podium.js';
import { assembleGeocityScene } from './scene.js';
import { planStage } from '../era/stage.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon' };

describe('a podium\'s inside, on its lot', () => {
  const lot = { id: 'X1.0.0:podium', x0: 100, y0: 200, x1: 140, y1: 236, z0: 5, h: 14, front: '-y' };
  const I = podiumInside(lot, { padZ: 5 });

  it('stands its lobby level with its plaza and its concourse a storey under it, inside its lot, its door in its front', () => {
    const lobby = I.rooms.find((r) => r.id === 'lobby').box, conc = I.rooms.find((r) => r.id === 'concourse').box;
    expect(lobby.min[2]).toBe(5);
    expect(I.rise).toBe(planStage(podiumRecipe(I.plan.w, I.plan.d, I.plan.h)).storeys[1].z0);
    expect(conc.min[2]).toBeCloseTo(5 - I.rise, 5);
    const [fx0, fy0, fx1, fy1] = I.footprint;
    expect(fx0 >= lot.x0 && fx1 <= lot.x1 && fy0 >= lot.y0 - 1e-6 && fy1 <= lot.y1).toBe(true);
    expect(fy0).toBeCloseTo(lot.y0, 5);
    expect(I.door).toMatchObject({ axis: 'x', plane: lot.y0, z0: 5, N: [0, -1, 0] });
    expect(I.door.u1 - I.door.u0).toBeCloseTo(PODIUM.door.width, 5);
    expect(I.plan).toEqual({ w: PODIUM.lobby.w, d: PODIUM.lobby.d, h: PODIUM.lobby.h });
    // (no window in it, so no sky card: its concourse in the ground, its lobby in its podium's mass)
    expect(I.faces.some((f) => f.group === 'stage:sky' || f.group === 'stage:pane')).toBe(false);
  });

  it('turns with its lot\'s front, keeps clear of what rises through its podium, and is none on a lot too small', () => {
    const E = podiumInside({ ...lot, front: '+x' }, { padZ: 5 });
    expect(E.door).toMatchObject({ axis: 'y', plane: lot.x1, N: [1, 0, 0] });
    expect(E.footprint[2]).toBeCloseTo(lot.x1, 5);
    // a tower standing where its lobby would: the lobby moves along its front, or shrinks, clear of it
    const tower = [124, 200, 140, 216], A = podiumInside(lot, { padZ: 5, avoid: [tower] }), [fx0, fy0, fx1, fy1] = A.footprint;
    expect(fx1 <= tower[0] - 0.5 || fx0 >= tower[2] + 0.5 || fy1 <= tower[1] - 0.5 || fy0 >= tower[3] + 0.5).toBe(true);
    expect(podiumInside({ ...lot, x1: lot.x0 + 12 }, { padZ: 5 })).toBeNull();
  });

  it('cuts a facade face round its door, and leaves a face it misses as it was', () => {
    const D = I.door, n = [0, -1, 0];
    const wall = { corners: [[D.u0 - 6, D.plane, 5], [D.u1 + 6, D.plane, 5], [D.u1 + 6, D.plane, 12], [D.u0 - 6, D.plane, 12]], normal: n, fill: '#888888', cornerFills: ['#888888', '#888888', '#888888', '#888888'], uv: [[0, 0], [1, 0], [1, 1], [0, 1]] };
    const strips = cutFace(wall, D);
    expect(strips).toHaveLength(3);
    // (none in the opening; together they and the opening are the wall)
    const area = (f) => { const xs = f.corners.map((c) => c[0]), zs = f.corners.map((c) => c[2]); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)); };
    for (const f of strips) { const xs = f.corners.map((c) => c[0]), zs = f.corners.map((c) => c[2]); expect(Math.max(...xs) <= D.u0 + 1e-6 || Math.min(...xs) >= D.u1 - 1e-6 || Math.min(...zs) >= D.z1 - 1e-6).toBe(true); }
    expect(strips.reduce((a, f) => a + area(f), 0) + (D.u1 - D.u0) * (D.z1 - D.z0)).toBeCloseTo(area(wall), 5);
    // (its tile laid at the wall's own rate)
    expect(strips[0].uv[0][0]).toBeCloseTo(0, 5);
    const high = { ...wall, corners: wall.corners.map(([x, y, z]) => [x, y, z + 10]) };
    expect(cutFace(high, D)).toEqual([high]);
    const sill = { corners: [[D.u0 - 1, D.plane - 0.3, 5.5], [D.u1 + 1, D.plane - 0.3, 5.5], [D.u1 + 1, D.plane, 5.6]], normal: [0, -0.3, 0.95] };
    expect(cutFace(sill, D)).toEqual([]);
  });
});

/** A walker over a payload: the page's ground probe (straight down from just over its feet) on the faces' tops, its
 *  walls the faces that stand up, its body kept out of the boxes. */
function walker(P) {
  const C = 2, tops = new Map(), walls = new Map(), key = (x, y) => `${Math.floor(x / C)},${Math.floor(y / C)}`;
  const index = (map, tri) => {
    const xs = tri.map((p) => p[0]), ys = tri.map((p) => p[1]);
    for (let i = Math.floor(Math.min(...xs) / C); i <= Math.floor(Math.max(...xs) / C); i++) for (let j = Math.floor(Math.min(...ys) / C); j <= Math.floor(Math.max(...ys) / C); j++) {
      const k = `${i},${j}`; if (!map.has(k)) map.set(k, []); map.get(k).push(tri);
    }
  };
  // (a top faces up, as the probe meets it; a face that faces down, a ceiling or a flight's soffit, is stood on by nothing)
  for (const f of P.faces) {
    const c = f.corners;
    for (let k = 1; k + 1 < c.length; k++) {
      const tri = [c[0], c[k], c[k + 1]], u = [tri[1][0] - tri[0][0], tri[1][1] - tri[0][1], tri[1][2] - tri[0][2]], v = [tri[2][0] - tri[0][0], tri[2][1] - tri[0][1], tri[2][2] - tri[0][2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n);
      if (l < 1e-9) continue;
      const nz = Array.isArray(f.normal) ? f.normal[2] : n[2] / l;
      if (nz > 0.5) index(tops, tri); else if (Math.abs(nz) <= 0.5) index(walls, tri);
    }
  }
  // the highest top under (x, y) no higher than `from`
  const ground = (x, y, from) => {
    let best = null;
    for (const [a, b, c] of tops.get(key(x, y)) || []) {
      const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const z = l1 * a[2] + l2 * b[2] + l3 * c[2];
      if (z <= from + 1e-6 && (best === null || z > best)) best = z;
    }
    return best;
  };
  // whether a level segment from p to q at height z crosses a wall (Möller–Trumbore against each standing triangle)
  const crosses = (p, q, z) => {
    const dir = [q[0] - p[0], q[1] - p[1], 0], len = Math.hypot(dir[0], dir[1]);
    if (len < 1e-9) return false;
    const seen = new Set();
    for (const k of new Set([key(p[0], p[1]), key(q[0], q[1])])) for (const tri of walls.get(k) || []) {
      if (seen.has(tri)) continue; seen.add(tri);
      const [a, b, c] = tri, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const h = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
      if (Math.abs(det) < 1e-12) continue;
      const s = [p[0] - a[0], p[1] - a[1], z - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
      if (u < 0 || u > 1) continue;
      const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (dir[0] * qv[0] + dir[1] * qv[1] + dir[2] * qv[2]) / det;
      if (v < 0 || u + v > 1) continue;
      const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
      if (t > 1e-6 && t < 1 - 1e-6) return true;
    }
    return false;
  };
  const boxed = (x, y, z, r = 0.25) => (P.colliders || []).find((c) => x > c.min[0] - r && x < c.max[0] + r && y > c.min[1] - r && y < c.max[1] + r && z + 0.5 > c.min[2] && z + 0.5 < c.max[2]);
  /** Walk a polyline from its first point's ground: each step a fifth of a metre, the feet stood on the highest top a
   *  riser and a hand over them; → { steepest, walls, boxes, end } */
  return (pts) => {
    let z = ground(pts[0][0], pts[0][1], pts[0][2] + 0.45), steepest = 0, wallsHit = 0;
    const boxes = [];
    for (let k = 0; k + 1 < pts.length; k++) {
      const [p, q] = [pts[k], pts[k + 1]], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.2));
      for (let i = 1; i <= n; i++) {
        const x0 = p[0] + ((q[0] - p[0]) * (i - 1)) / n, y0 = p[1] + ((q[1] - p[1]) * (i - 1)) / n, x = p[0] + ((q[0] - p[0]) * i) / n, y = p[1] + ((q[1] - p[1]) * i) / n;
        if (crosses([x0, y0], [x, y], z + 0.9) || crosses([x0, y0], [x, y], z + 1.6)) wallsHit++;
        const g = ground(x, y, z + 0.45);
        if (g === null) { steepest = Infinity; continue; }
        steepest = Math.max(steepest, Math.abs(g - z)); z = g;
        const B = boxed(x, y, z); if (B) boxes.push(B.of);
      }
    }
    return { steepest, walls: wallsHit, boxes: [...new Set(boxes)], end: z };
  };
}

describe('the podium walked into, in its evocation', () => {
  const N = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood', under: true } });
  const A = N.anchors.find((a) => a.kind === 'building'), lobby = A.rooms.find((r) => r.id === 'lobby').box, conc = A.rooms.find((r) => r.id === 'concourse').box;

  it('walks in at its door from its plaza, down its stair to its concourse and back: no step over a riser, no wall, no box', () => {
    const walk = walker(N), T = A.through;
    const down = walk(T), up = walk(T.slice().reverse());
    expect(down.steepest).toBeLessThanOrEqual(0.36);
    expect(up.steepest).toBeLessThanOrEqual(0.36);
    expect(down.walls).toBe(0);
    expect(up.walls).toBe(0);
    expect(down.boxes).toEqual([]);
    expect(up.boxes).toEqual([]);
    expect(down.end).toBeCloseTo(conc.min[2], 2);
    expect(up.end).toBeCloseTo(lobby.min[2], 2);
  });

  it('stands its lobby level with the plaza at its door and its concourse a storey under it, a box round the rest of its podium', () => {
    expect(N.geocity.under).toMatchObject({ podium: A.id.slice('podium-'.length), rise: A.rise, findings: [] });
    expect(lobby.min[2]).toBe(A.floor);
    expect(conc.min[2]).toBeCloseTo(A.floor - A.rise, 5);
    // (no paving over its footprint at the plaza's height: the lobby's floor is the ground there)
    const inFp = (f) => f.corners.every(([x, y]) => x > lobby.min[0] && x < lobby.max[0] && y > lobby.min[1] && y < lobby.max[1]);
    expect(N.faces.some((f) => f.group === 'geocity:paving' && inFp(f))).toBe(false);
    // (the podium's lot is no single box now: its mass round its inside)
    expect(N.colliders.some((c) => c.of === `${A.id.slice(7)}:podium` && c.min[0] < lobby.min[0] + 1 && c.max[0] > lobby.max[0] - 1 && c.min[1] < lobby.min[1] + 1 && c.max[1] > lobby.max[1] - 1 && c.min[2] <= A.floor + 0.5)).toBe(false);
    expect(N.cameras.slice(-2).map((c) => c.name)).toEqual(['lobby', 'concourse']);
    expect(N.lights.length).toBe(N.geocity.under.lights);
    expect(N.geocity.laws.find((l) => l.law === 'faces').ok).toBe(true);
  });

  it('is the same podium for the same recipe; without `under`, none', () => {
    const N2 = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood', under: true } });
    expect(N2.faces.length).toBe(N.faces.length);
    expect(N2.anchors).toEqual(N.anchors);
    const B = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood' } });
    expect(B.anchors).toBeUndefined();
    expect(B.lights).toBeUndefined();
    expect(B.geocity.under).toBeUndefined();
    expect(N.faces.length).toBeGreaterThan(B.faces.length);
  });

  it('refuses `under` on a metro drawn as massing, and a block it cannot walk into', () => {
    expect(() => assembleGeocityScene({ ...M, geocity: { ...geocity, under: true } })).toThrow(/under is an evocation's/);
    expect(() => assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood', under: { deep: 2 } } })).toThrow(/under is true or \{ at\?/);
    expect(() => assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood', under: { at: 'Z9.9.9' } } })).toThrow(/under.at 'Z9.9.9' is not an evoked tower or podium block/);
  });
});
