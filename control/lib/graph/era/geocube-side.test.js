import { describe, it, expect } from 'vitest';
import { assembleSideStrip, sideRuns, sidePads, sideLaws, foreTop, SIDE, SIDE_CAMERA } from './geocube-side.js';

// THE SIDE STRIP (geocube-side.js): a course (the shape course.js lays on a straight lane) skinned in the cube's layers,
// the land behind it, the hills and the range at their depths, a low foreground. One small course: two floors with a gap,
// a wall up to a third that stands built, the ground before and after it.
const box = (y0, y1, top, role = 'terrain') => ({ min: [-1.5, y0, 0], max: [1.5, y1, top], role });
const COURSE = [box(4, 5.5, 2.2), box(4.75, 12, 2.2), box(15, 22, 2.2), box(22, 30, 3.8, 'built')];
const M = { kind: 'geocube', show: 'side', seed: 3, side: { length: 34, boxes: [...COURSE, ...sidePads(COURSE, 34)] } };
const P = assembleSideStrip(M);
const groups = (g) => P.faces.filter((f) => f.group === g);

describe('the side strip', () => {
  it('merges the course\'s tiles into runs, one a top and a role', () => {
    const R = sideRuns(COURSE);
    expect(R.map((r) => [r.y0, r.y1, r.top, r.role])).toEqual([[4, 12, 2.2, 'terrain'], [15, 22, 2.2, 'terrain'], [22, 30, 3.8, 'built']]);
  });

  it('skins each run in its role\'s layers: turf over dirt over the rock\'s beds, or a cornice over ashlar', () => {
    for (const g of ['side:turf', 'side:dirt', 'side:rock', 'side:trim', 'side:stone', 'side:top', 'side:top-built']) expect(groups(g).length, g).toBeGreaterThan(0);
    // (the built run wears stone, never turf; a terrain run's face never stone)
    const onBuilt = (f) => f.corners.every((c) => c[1] >= 22 - 1e-6 && c[1] <= 30 + 1e-6) && f.corners.some((c) => c[2] > 2.3);
    expect(groups('side:turf').some(onBuilt)).toBe(false);
    expect(groups('side:stone').every((f) => f.corners.every((c) => c[1] >= 22 - 1e-6))).toBe(true);
    // (the beds lie level across the gap: a bed's top on one side is a bed's top on the other)
    const bedTops = (y0, y1) => new Set(groups('side:rock').filter((f) => f.normal[0] === 1 && f.corners.every((c) => c[1] >= y0 && c[1] <= y1)).map((f) => Math.max(...f.corners.map((c) => c[2])).toFixed(3)));
    const a = bedTops(4, 12), b = bedTops(15, 22);
    expect([...a].filter((z) => b.has(z)).length).toBeGreaterThan(2);
  });

  it('builds only what the side camera sees: no face turned away from it', () => {
    for (const f of P.faces) expect(f.normal[0], f.group).toBeGreaterThanOrEqual(-0.35);
    // (each quad's winding agrees with its normal)
    for (const f of P.faces.slice(0, 400)) {
      const [a, b, c] = f.corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      expect(w[0] * f.normal[0] + w[1] * f.normal[1] + w[2] * f.normal[2]).toBeGreaterThan(-1e-9);
    }
  });

  it('lays the land behind it and the layers at their depths, and a foreground under the hero\'s feet', () => {
    for (const g of ['side:terrace', 'side:hills', 'side:crowns', 'side:range']) expect(groups(g).length, g).toBeGreaterThan(0);
    expect(Math.max(...groups('side:hills').flatMap((f) => f.corners.map((c) => c[0])))).toBeLessThan(SIDE.terrace.back);
    expect(Math.max(...groups('side:range').flatMap((f) => f.corners.map((c) => c[0])))).toBeLessThan(SIDE.hills.foot);
    const F = groups('side:fore');
    expect(F.length).toBeGreaterThan(0);
    for (const f of F) for (const c of f.corners) expect(c[2]).toBeLessThanOrEqual(foreTop(2.2, SIDE.fore.x) + 1e-6);
    // (the feet line: a shape there under it is under the hero's feet in the frame)
    const C = SIDE_CAMERA, H = C.lookH + C.dist * Math.sin(C.tilt), Dc = C.dist * Math.cos(C.tilt);
    expect(Math.atan2(H - (foreTop(2.2, SIDE.fore.x) - 2.2), Dc - SIDE.fore.x)).toBeGreaterThan(Math.atan2(H, Dc));
  });

  it('holds its laws, and is the same strip every time', () => {
    expect(sideLaws(M, P).filter((l) => !l.holds)).toEqual([]);
    expect(JSON.stringify(assembleSideStrip(M).faces)).toBe(JSON.stringify(P.faces));
    expect(JSON.stringify(assembleSideStrip({ ...M, seed: 4 }).faces)).not.toBe(JSON.stringify(P.faces));
  });

  it('takes a cube by name, and says what is wrong with its course', () => {
    expect(assembleSideStrip({ ...M, cube: 'gothic-night' }).bg).not.toBe(P.bg);
    expect(() => assembleSideStrip({ ...M, side: { length: 10 } })).toThrow(/boxes/);
  });
});
