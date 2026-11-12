// An opening cut into a wall (carve.js): the wall's faces cut round a convex hole, the rest untouched.
import { describe, it, expect } from 'vitest';
import { carveFaces } from './carve.js';
import { panel } from './geom.js';
import { STAGE_KITS, assembleStageScene } from './stage.js';

const F = { o: [0, 0, 0], U: [1, 0, 0], N: [0, 1, 0], len: 4 };
const wall = () => { const out = []; panel(out, F.o, F.U, 4, [0, 0, 1], 3, F.N, { key: 't', scale: 2, tint: [1, 1, 1], group: 'stage:wall' }, 0.5); return out; };
const areaOf = (f) => { let s = 0; const c = f.corners; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; s += p[0] * q[2] - q[0] * p[2]; } return Math.abs(s) / 2; };
const sum = (fs) => fs.reduce((s, f) => s + areaOf(f), 0);

describe('carve: an opening cut into a wall', () => {
  it('no hole changes nothing: the same array back', () => {
    const w = wall();
    expect(carveFaces(w, [])).toBe(w);
    expect(carveFaces(w, null)).toBe(w);
  });

  it('a hole takes exactly its own area out of the wall, wherever it falls on the wall\'s cells', () => {
    const w = wall(), hole = { F, poly: [[1.1, 0.7], [2.3, 0.7], [2.3, 1.45], [1.1, 1.45]] };
    const cut = carveFaces(w, [hole]);
    expect(sum(cut)).toBeCloseTo(12 - 1.2 * 0.75, 4);
    for (const f of cut) expect([3, 4]).toContain(f.corners.length);
    // (no piece lies inside the hole)
    for (const f of cut) { const cx = f.corners.reduce((s, c) => s + c[0], 0) / f.corners.length, cz = f.corners.reduce((s, c) => s + c[2], 0) / f.corners.length;
      expect(cx > 1.1 + 1e-6 && cx < 2.3 - 1e-6 && cz > 0.7 + 1e-6 && cz < 1.45 - 1e-6).toBe(false); }
  });

  it('a piece keeps the wall\'s own mapping: its texture does not slip where it is cut', () => {
    const cut = carveFaces(wall(), [{ F, poly: [[1.1, 0.7], [2.3, 0.7], [2.3, 1.45], [1.1, 1.45]] }]);
    for (const f of cut) f.corners.forEach((c, i) => { expect(f.uv[i][0]).toBeCloseTo(c[0] / 2, 4); expect(f.uv[i][1]).toBeCloseTo(c[2] / 2, 4); });
  });

  it('a round head is a hole too (convex), and a wall that is not the hole\'s is left alone', () => {
    const arch = Array.from({ length: 7 }, (_, i) => { const t = (Math.PI * i) / 8 + Math.PI / 8; return [1.7 + 0.6 * Math.cos(t), 1.4 + 0.6 * Math.sin(t)]; });
    const hole = { F, poly: [[1.1, 0.7], [2.3, 0.7], [2.3, 1.4], ...arch, [1.1, 1.4]] };
    expect(sum(carveFaces(wall(), [hole]))).toBeLessThan(12 - 1.2 * 0.7);
    const other = wall().map((f) => ({ ...f, normal: [0, -1, 0] }));
    expect(carveFaces(other, [hole]).length).toBe(other.length);
    const floor = wall().map((f) => ({ ...f, group: 'stage:floor' }));
    expect(carveFaces(floor, [hole]).length).toBe(floor.length);
  });

  it('a kit whose niches have a depth cuts them in, and what a niche holds stands behind the wall\'s face; a kit without does not', () => {
    const rooms = [{ id: 'a', x: 0, y: 0, w: 10, d: 14, h: 6 }];
    const faces = (kit) => assembleStageScene({ kind: 'stage', kit, rooms }).faces;
    const cut = faces('catacomb'), sides = cut.filter((f) => f.group === 'stage:niche-side');
    expect(sides.length).toBeGreaterThan(0);
    expect(STAGE_KITS['gothic-stone'].dress.niches.depth).toBeUndefined();
    expect(faces('gothic-stone').some((f) => f.group === 'stage:niche-side')).toBe(false);
  });
});
