// The cavern (era/cavern.js): a whole trail underground. The laws: its recipe read and refused by name; it is closed in
// (its ceiling over every ground face, its rim down into the land, its ends shut unless open); nothing grows in it (no
// grass, no tree, no far layers); its formations stand off the walk, a stalagmite up, a stalactite down; it is darker
// than the open, lit by its register's lamps, and a skylight lets the day in.

import { describe, it, expect } from 'vitest';
import { readCavern, formationFaces, floorKind, floorPieces, wallRocks, CAVERN, FLOOR, WALL_ROCKS } from './cavern.js';
import { assembleStageScene } from './stage.js';

const GROWS = /:(grass|crown|wood|blossom|bush|flower|ikebana|ridge)$/;
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);
const luma = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; };

describe('the cavern', () => {
  it('reads its recipe and says what is wrong', () => {
    expect(readCavern(true)).toEqual({ height: CAVERN.height, skylight: null, formations: CAVERN.formations, light: CAVERN.light, ends: 'closed', cracks: CAVERN.cracks });
    expect(readCavern({ skylight: { y: 30 } }).skylight).toEqual({ y: 30, r: CAVERN.skylight });
    expect(readCavern(undefined)).toBeNull();
    expect(() => readCavern({ roof: 1 })).toThrow(/roof is not a cavern setting/);
    expect(() => readCavern({ skylight: { r: 4 } })).toThrow(/needs y/);
    expect(() => readCavern({ light: 'neon' })).toThrow(/light is one of/);
    expect(() => readCavern({ ends: 'ajar' })).toThrow(/ends is 'closed'/);
  });

  it('lofts a stalagmite up from its foot, a stalactite down from its root, a column between', () => {
    for (const [kind, z0, z1] of [['mite', 0, 3], ['tite', 10, 7], ['column', 0, 10]]) {
      const F = formationFaces({ x: 0, y: 0, z0, z1, r: 0.6, kind, v: 3 });
      const zs = F.flatMap((f) => f.corners.map((c) => c[2]));
      expect(Math.min(...zs)).toBeCloseTo(Math.min(z0, z1), 5);
      expect(Math.max(...zs)).toBeCloseTo(Math.max(z0, z1), 5);
      expect(F.every((f) => f.group === 'isekai:rock' && f.cel === 'rock')).toBe(true);
    }
  });
});

describe('its floor', () => {
  // a straight walk 3 m wide down a site 60 m long
  const site = { trailX: () => 10, trailDist: (x) => Math.abs(x - 10), halfWAt: () => 1.5, D: 60, cliffX: () => -100, fringeAt: () => 0.8 };
  it('is soil, its walk broken by stretches of rock, scree round its rocks, the floor off the walk its dirt', () => {
    const walk = [];
    for (let y = 1; y < 60; y += 0.5) walk.push(floorKind(site, 10, y));
    // (the walk mostly soil, a stretch of its rock coming round along it)
    expect(walk.filter((k) => k === 'soil').length).toBeGreaterThan(walk.length * 0.4);
    expect(walk.some((k) => ['bedrock', 'flags', 'plates'].includes(k))).toBe(true);
    // (off the walk dirt, far from any rock; round a rock scree, rubble nearest)
    expect(floorKind(site, 20, 30)).toBe('dirt');
    const near = (x, y) => Math.max(0, Math.hypot(x - 20, y - 30) - 0.5);
    expect(floorKind(site, 20.6, 30, 1, near)).toBe('rubble');
    expect(['scree', 'dirt']).toContain(floorKind(site, 21.5, 30, 1, near));
    expect(Object.keys(FLOOR)).toEqual(expect.arrayContaining(['soil', 'dirt', 'bedrock', 'flags', 'gravel', 'scree']));
  });

  it('meets in rounded lines: a face cut along each field\'s contour, whole, each piece its surface', () => {
    const area = (P) => { let a = 0; for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
    const face = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
    // (a circle of scree round (0, 0), 0.7 across: the corner in it, the rest soil)
    const pieces = floorPieces(face, [{ kind: 'scree', f: (x, y) => 0.7 - Math.hypot(x, y) }]);
    expect(pieces.map((p) => p.kind).sort()).toEqual(['scree', 'soil']);
    expect(pieces.reduce((a, p) => a + area(p.corners), 0)).toBeCloseTo(1, 6);
    // (the cut on the contour: its new corners 0.7 from the centre along the face's edges)
    const cut = pieces.find((p) => p.kind === 'scree').corners.filter((c) => c[0] > 0 && c[1] === 0 || c[1] > 0 && c[0] === 0);
    for (const c of cut) expect(Math.hypot(c[0], c[1])).toBeCloseTo(0.7, 5);
    expect(floorPieces(face, [{ kind: 'gravel', f: () => -1 }])).toEqual([{ corners: face, kind: 'soil' }]);
  });

  it("heaps small rocks along every wall's foot, out of the walk", () => {
    const W = { ...site, cliffX: () => 0, fringeAt: () => 0.8, ground: (x) => (x < 1 ? 15 : x > 18.3 ? 15 : 0) };
    const R = wallRocks(W, readCavern(true));
    expect(R.length).toBeGreaterThan(40);
    expect(R.every((r) => W.trailDist(r.x, r.y) > W.halfWAt(r.y) + 0.8 && r.s >= WALL_ROCKS.size[0] && r.s <= WALL_ROCKS.size[1])).toBe(true);
    // (at the foot, on the level land, never up a wall's face)
    expect(R.every((r) => r.z0 === 0)).toBe(true);
  });
});

describe('a cavern in a trail', () => {
  const open = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: true });
  const P = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', trail: { ground: { cavern: { skylight: { y: 40 } } } } });
  const C = P.anchors.find((a) => a.kind === 'cavern');

  it('is an anchor: its rim, its crown, its skylight, its register', () => {
    expect(C).toMatchObject({ kind: 'cavern', height: CAVERN.height, light: CAVERN.light, skylight: { y: 40, r: CAVERN.skylight } });
  });

  it('lays its floor in the rock: its walk and its scree each a rock tile, lit by the cavern', () => {
    const floor = P.faces.filter((f) => f.floor);
    expect(floor.length).toBeGreaterThan(100);
    expect(new Set(floor.map((f) => f.floor)).size).toBeGreaterThanOrEqual(4);
    expect(floor.every((f) => f.textureLit && /^gen:/.test(f.texture) && f.uv.length === f.corners.length)).toBe(true);
    expect(floor.every((f) => Math.max(...f.corners.map((c) => c[2])) < C.top)).toBe(true);
  });

  it('grows nothing: no grass, no tree, no far layers', () => {
    expect(P.faces.filter((f) => GROWS.test(f.group))).toHaveLength(0);
    expect(P.liveGrass).toBeUndefined();
  });

  it('is closed in: a ceiling of rock over the walk, its rim down into the land', () => {
    // (its ceiling: every face of its rock looking down, the steep near its rim too)
    const roof = P.faces.filter((f) => f.group === 'isekai:cliff' && f.normal[2] < -0.05);
    expect(roof.length).toBeGreaterThan(100);
    // (the floor along its length, under the cliffs' tops: the walls' tops at the site's edge are the rock's, not floor)
    const walk = P.faces.filter((f) => /^isekai:(trail|scree)$/.test(f.group) && f.normal[2] > 0.5 && mid(f)[1] > 4 && mid(f)[1] < 68 && mid(f)[2] < C.top - 2).filter((_, i) => i % 7 === 0);
    const over = (p) => roof.some((f) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); return p[0] >= Math.min(...xs) && p[0] <= Math.max(...xs) && p[1] >= Math.min(...ys) && p[1] <= Math.max(...ys) && Math.min(...f.corners.map((c) => c[2])) > p[2]; });
    // (every face of the floor under the ceiling but the skylight's)
    expect(walk.length).toBeGreaterThan(50);
    const sk = C.skylight, open = walk.filter((f) => !over(mid(f)));
    expect(open.filter((f) => Math.hypot(mid(f)[0] - sk.x, mid(f)[1] - sk.y) > sk.r).length).toBeLessThan(walk.length * 0.02);
  });

  it('stands its formations off the walk, lit by its lamps and darker than the open', () => {
    const rock = P.faces.filter((f) => f.group === 'isekai:rock'), lamps = P.faces.filter((f) => f.group === 'cave:lamp');
    expect(rock.length).toBeGreaterThan(50);
    expect(lamps.length).toBeGreaterThan(0);
    // (its rock against the open's: the land's boulders and formations, each a fill of colour and light alike)
    const ground = (p) => p.faces.filter((f) => f.group === 'isekai:rock' && f.fill).map((f) => luma(f.fill));
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    // (its cracks, its torches and their bounce light it to a readable gloom: well under the open day)
    expect(mean(ground(P))).toBeLessThan(mean(ground(open)) * 0.7);
  });
});
