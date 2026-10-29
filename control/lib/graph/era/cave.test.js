// The cave (era/cave.js): cut into a trail's cliff, its walls the cliff's rock, its floor the land's, a lid of rock over
// it, lit by what it sees of the day. The laws: the recipe read and refused by name; the cut leaves the land outside as
// it lay; the lid's ceiling stands under its top and over its floor, closing at the mouth; nothing grows on its floor;
// its light falls with depth from the mouth, round its bend too, and a big cave lights as a small one of its shape does.

import { describe, it, expect } from 'vitest';
import { readCaves, cutCaves, lidFaces, caveClear, caveSky, formFactor, caveRocks, flipBoulder, CAVE } from './cave.js';
import { gridX, gridY } from '../polygonizer/landform.js';
import { assembleStageScene } from './stage.js';
import { outTrailOf } from './out-trail-board.js';

// a cliff 30 m high along x = 0, the land at 0 before it, a grid fine enough to cut a cave of either size into
const cliff = () => {
  const g = { x0: -60, y0: 0, dx: 0.5, nx: 141, ny: 241 };
  g.z = new Float64Array(g.nx * g.ny); g.apron = new Float64Array(g.nx * g.ny); g.hard = new Float64Array(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) g.z[j * g.nx + i] = gridX(g, i) < 0 ? 30 : 0;
  return g;
};
const opts = (g) => ({ gridX, gridY, cliffX: () => 0, floorAt: () => 0, back: g.x0 });

describe('the cave', () => {
  it('reads its recipe and says what is wrong', () => {
    expect(readCaves([{ y: 20 }])[0]).toMatchObject({ id: 'cave-1', y: 20, depth: CAVE.depth, width: CAVE.width, height: CAVE.height, along: 0, mouth: null });
    expect(() => readCaves([])).toThrow(/1 to 6 caves/);
    expect(() => readCaves([{ y: 20, roof: 2 }])).toThrow(/roof is not a cave setting/);
    expect(() => readCaves([{ y: 20, width: 90 }])).toThrow(/width is metres/);
  });

  it('is cut to its floor in the rock, the land before the cliff left as it lay', () => {
    const g = cliff(), [c] = cutCaves(g, readCaves([{ y: 60, depth: 12, along: 10 }]), opts(g));
    const z = (x, y) => g.z[Math.round((y - g.y0) / g.dx) * g.nx + Math.round((x - g.x0) / g.dx)];
    expect(z(-6, 60)).toBeCloseTo(c.floor(c.inside(-6, 60).s), 6);
    expect(z(-12, 66)).toBeLessThan(1);
    expect(z(-6, 70.5)).toBe(30);
    expect(z(2, 60)).toBe(0);
    expect(caveClear([c])(-6, 60)).toBe(true);
    expect(caveClear([c])(-30, 20)).toBe(false);
  });

  it("has a lid: its ceiling over the floor and under the land, its mouth open where the cliff's face falls below it", () => {
    const g = cliff(), [c] = cutCaves(g, readCaves([{ y: 60, depth: 12, mouth: 9 }]), opts(g)), L = lidFaces(c, g, { gridX, gridY });
    const under = L.filter((f) => f.under), over = L.filter((f) => !f.under && !f.skirt);
    expect(under.length).toBeGreaterThan(100);
    for (const f of under) for (const p of f.corners) expect(p[2]).toBeGreaterThan(c.floor(c.inside(p[0], p[1]).s) + 2);
    for (const f of over) for (const p of f.corners) expect(p[2]).toBeLessThanOrEqual(30 + 1e-6);
    // (the mouth: at the cliff's line nothing of the lid stands below the land's top there, the land before it open)
    expect(under.some((f) => f.corners.some((p) => p[0] > 0.3))).toBe(false);
    expect(c.covered(-8, 60)).toBe(true);
    expect(c.covered(1, 60)).toBe(false);
  });

  it('is lit by what it sees of the day: less with depth, round its bend too, never nothing', () => {
    const g = cliff(), [c] = cutCaves(g, readCaves([{ y: 60, depth: 14, along: 16 }]), opts(g));
    const floorAt = (x, y) => [x, y, c.floor(c.inside(x, y).s) + 0.1];
    const ks = [-1, -4, -8, -12].map((x) => caveSky(c, floorAt(x, 60), [0, 0, 1]));
    for (let k = 1; k < ks.length; k++) expect(ks[k]).toBeLessThan(ks[k - 1]);
    const bend = caveSky(c, floorAt(-14, 72), [0, 0, 1]);
    // (round the bend the cave is in its twilight: what its walls give back, never less than its floor's least)
    expect(bend).toBeGreaterThanOrEqual(0.03);
    expect(bend).toBeLessThan(ks[1]);
  });

  it('lights alike at any size: a cave twice as big lights its twice as far points as the small one does', () => {
    const small = cutCaves(cliff(), readCaves([{ y: 60, depth: 12, width: 6, height: 4 }]), opts(cliff()))[0];
    const g2 = cliff(), big = cutCaves(g2, readCaves([{ y: 60, depth: 24, width: 12, height: 8 }]), opts(g2))[0];
    for (const [d, n] of [[2, [0, 0, 1]], [5, [0, 0, 1]], [8, [0, 0, -1]]]) {
      const ps = [-d, 60, n[2] > 0 ? 0.1 : small.ceil(-d, 60) - 0.1], pb = [-2 * d, 60, n[2] > 0 ? 0.2 : big.ceil(-2 * d, 60) - 0.2];
      expect(Math.abs(caveSky(small, ps, n) - caveSky(big, pb, n))).toBeLessThan(0.05);
    }
  });

  it('is lined with rock: two rows along each wall up to its spring, slabs hung across its ceiling, none in a tall mouth', () => {
    const g = cliff(), [c] = cutCaves(g, readCaves([{ y: 60, depth: 14, along: 10, mouth: 10 }]), opts(g)), R = caveRocks(c, 1.5);
    const walls = R.filter((r) => !r.flip), slabs = R.filter((r) => r.flip);
    expect(walls.length).toBeGreaterThan(10);
    expect(slabs.length).toBeGreaterThan(5);
    // (the side walls' rocks in the wall; the far end's across the end of its centreline, its end wall)
    const total = c.path.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - c.path[k][0], p[1] - c.path[k][1]), 0);
    for (const r of walls) { const { d, s } = c.inside(r.x, r.y); if (s < total - 0.5) expect(d).toBeGreaterThan(c.width / 2); expect(r.z0).toBeLessThan(c.floor(s) + c.heightAt(s) * CAVE.spring); }
    for (const r of slabs) { expect(r.z0).toBeCloseTo(c.ceil(r.x, r.y) + 0.1, 6); expect(c.heightAt(c.inside(r.x, r.y).s)).toBeLessThanOrEqual(c.height * 1.1); }
    expect(R.every((r) => c.covered(r.x, r.y) || !r.flip)).toBe(true);
    // a slab hangs: its faces below the ceiling it is hung from, its face turned down
    const B = flipBoulder({ sides: [{ corners: [[0, 0, 5], [1, 0, 5], [1, 0, 6], [0, 0, 6]], normal: [0, -1, 0.2] }], cap: [{ corners: [[0, 0, 6], [1, 0, 6], [1, 1, 6]], normal: [0, 0, 1] }], rim: [{}] }, 5);
    expect(Math.max(...B.sides[0].corners.map((p) => p[2]))).toBe(5);
    expect(B.cap[0].normal[2]).toBe(-1);
    expect(B.rim).toEqual([]);
  });

  it("the form factor: a window over a point, a half of what the whole sky lays; none behind the face", () => {
    const big = 1e4, sky = formFactor([0, 0, 0], [0, 0, 1], [[-big, -big, 1], [big, -big, 1], [big, big, 1], [-big, big, 1]]);
    expect(sky).toBeCloseTo(1, 2);
    expect(formFactor([0, 0, 0], [0, 0, -1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]])).toBe(0);
  });
});

describe("a trail's ground for a big cave", () => {
  it('takes rock behind its far cliff: the land over the cliff that much deeper, the cliff where it was', () => {
    const base = outTrailOf({ kind: 'stage', kit: 'isekai-meadow', trail: true }).site, deep = outTrailOf({ kind: 'stage', kit: 'isekai-meadow', trail: { ground: { behind: 30 } } }).site;
    expect(base.grid.x0 - deep.grid.x0).toBeCloseTo(30, 6);
    expect(deep.cliffX(36)).toBeCloseTo(base.cliffX(36), 6);
    expect(() => outTrailOf({ kind: 'stage', kit: 'isekai-meadow', trail: { ground: { behind: 30, cliff: false } } })).toThrow(/has none/);
  });

  it('lines a gargantuan cave as a small one: its walls, its far end and its ceiling of the land\'s rock', () => {
    const g = cliff(), [c] = cutCaves(g, readCaves([{ y: 60, depth: 40, width: 22, height: 16, mouth: 24 }]), opts(g)), R = caveRocks(c, 1.5);
    const end = c.path.at(-1), atEnd = R.filter((r) => !r.flip && Math.abs(r.x - end[0]) < 4);
    expect(atEnd.length).toBeGreaterThan(4);
    expect(Math.max(...R.filter((r) => !r.flip).map((r) => r.size))).toBeGreaterThan(3);
  });
});

describe('a cave in a trail', () => {
  const P = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: { ground: { caves: [{ y: 36, depth: 10, along: 12, mouth: 8 }] } } });
  const C = P.anchors.find((a) => a.kind === 'cave');
  const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);
  const inside = (p) => { const [a, b, c] = C.path, onSeg = (u, v) => { const dx = v[0] - u[0], dy = v[1] - u[1], L = Math.hypot(dx, dy), t = Math.max(0, Math.min(1, ((p[0] - u[0]) * dx + (p[1] - u[1]) * dy) / (L * L))); return Math.hypot(p[0] - u[0] - dx * t, p[1] - u[1] - dy * t); }; return Math.min(onSeg(a, b), onSeg(b, c)) < C.width / 2 - 0.5 && p[0] < a[0] - CAVE.out - 1; };

  it('is an anchor with its path, its size and its mouth', () => {
    expect(C).toMatchObject({ id: 'cave-1', width: CAVE.width, height: CAVE.height, mouth: 8 });
    expect(C.path).toHaveLength(3);
  });

  it('is lined with the land\'s own boulders, no grass hat on any', () => {
    const rocks = P.faces.filter((f) => f.group === 'isekai:rock' && inside(mid(f)));
    expect(rocks.length).toBeGreaterThan(100);
    expect(P.faces.filter((f) => f.group === 'isekai:hat' && inside(mid(f))).length).toBe(0);
  });

  it('has a ceiling of rock over it, and nothing growing on its floor', () => {
    expect(P.faces.filter((f) => f.group === 'isekai:cliff' && f.normal[2] < -0.5 && inside(mid(f))).length).toBeGreaterThan(50);
    expect(P.faces.filter((f) => /:(wood|crown|grass|bush|flower|ikebana)$/.test(f.group) && inside(mid(f)) && mid(f)[2] < C.floor + C.height).length).toBe(0);
  });

  it('is darker in than at its mouth', () => {
    const luma = (f) => { const c = [1, 3, 5].map((i) => parseInt(f.fill.slice(i, i + 2), 16)); return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; };
    const floor = P.faces.filter((f) => f.fill && f.normal[2] > 0.9 && inside(mid(f)) && mid(f)[2] < C.floor + 1);
    const at = (x0, x1) => { const fs = floor.filter((f) => mid(f)[0] <= x0 && mid(f)[0] > x1 && Math.abs(mid(f)[1] - C.path[0][1]) < 2); return fs.reduce((a, f) => a + luma(f), 0) / Math.max(1, fs.length); };
    const near = at(C.path[0][0] - CAVE.out - 1, C.path[0][0] - CAVE.out - 3), far = at(C.path[1][0] + 2, C.path[1][0] - 1);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeLessThan(near);
  });
});
