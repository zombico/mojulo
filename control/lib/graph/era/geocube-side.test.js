import { describe, it, expect } from 'vitest';
import { assembleSideStrip, sideRuns, sidePads, sideLaws, foreTop, SIDE, SIDE_CAMERA, sideShapes, sideCameraWords, SIDE_SHAPES, SHAPE_FAMILIES, SHAPED_CAMERA, sliceOrder } from './geocube-side.js';

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

// THE DRESS AND THE SHAPE FAMILIES (docs/side-strip-principles.md): the land behind the lane in slices, and, where a cube
// names a family, every silhouette of it one kind of shape under a camera that shows the sky.
describe('the land behind the lane', () => {
  const groups = (p) => new Set(p.faces.map((f) => f.group));

  it('is laid in slices by the walls\' rule, however long the strip: never three alike, never a pair repeated', () => {
    for (const n of [3, 12, 60]) {
      const o = sliceOrder(n, 5);
      expect(o).toHaveLength(n);
      expect(/AAA|BBB/.test(o)).toBe(false);
      expect(/ABAB|BABA/.test(o)).toBe(false);
    }
    expect(P.side.order).toHaveLength(P.side.cells.length);
    expect([...groups(P)]).toEqual(expect.arrayContaining(['side:grove', 'side:tufts', 'side:tower']));
  });

  it('a cube with no family is drawn as it was: slopes and a range, the camera looking down', () => {
    expect(sideShapes(M.cube)).toBeNull();
    expect(sideCameraWords(M.cube)).toEqual({});
    expect(P.side.shapes).toBeNull();
    expect(groups(P).has('side:scallop')).toBe(false);
  });

  describe('in a shape family (scoops)', () => {
    const cube = Object.keys(SIDE_SHAPES)[0], Q = assembleSideStrip({ ...M, cube });

    it('the cube names its family, a strip may say its own, and an unknown one teaches', () => {
      expect(SHAPE_FAMILIES[sideShapes(cube)]).toBeTruthy();
      expect(sideShapes({ from: cube, palette: { seed: 1 } })).toBe(SIDE_SHAPES[cube]);
      expect(assembleSideStrip({ ...M, side: { ...M.side, shapes: 'scoops' } }).side.shapes).toBe('scoops');
      expect(() => sideShapes(cube, 'spikes')).toThrow(/scoops/);
    });

    it('every hill and cloud is a dome or a disc, the turf hangs in scallops, and every law holds', () => {
      expect(Q.side.shapes).toBe('scoops');
      for (const f of Q.faces.filter((x) => /^side:(hills|range|clouds|scallop)$/.test(x.group))) expect(f.corners.length).toBeGreaterThanOrEqual(7);
      expect(groups(Q).has('side:scallop')).toBe(true);
      expect(groups(Q).has('side:crowns')).toBe(false);
      expect(sideLaws({ ...M, cube }, Q).filter((l) => !l.holds)).toEqual([]);
      expect(sideLaws({ ...M, cube }, Q).map((l) => l.id)).toContain('one-family');
    });

    // (docs/side-scroll-backgrounds.md) the rows a stair under a quarter of sky; the terrace a step into the air; the backdrop moving
    it('stands its rows in a stair under the sky\'s share, takes the terrace into the air, and moves its clouds and blossom', () => {
      const C = SHAPED_CAMERA, top = 2.2, eye = top + C.lookH + C.dist * Math.sin(C.tilt), deg = 180 / Math.PI;
      const crest = (pred) => Math.max(...Q.faces.filter(pred).flatMap((f) => f.corners.map((c) => Math.atan2(c[2] - eye, C.dist - c[0]) * deg)));
      const far = crest((f) => f.group === 'side:range'), mid = crest((f) => f.group === 'side:hills' && f.corners[0][0] < -30), near = crest((f) => f.group === 'side:hills' && f.corners[0][0] > -30);
      expect(far).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(near);
      const frameTop = C.vfov / 2 - Math.atan2(eye - (top + C.lookH), C.dist) * deg;
      expect((frameTop - far) / C.vfov).toBeGreaterThan(0.2);
      // (cooler than the lane it stands behind: further into the air)
      const cool = (g) => { const fs = Q.faces.filter((f) => f.group === g && f.normal[2] > 0.5), rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return fs.reduce((a, f) => { const [r, , b] = rgb(f.fill); return a + b - r; }, 0) / fs.length; };
      expect(cool('side:terrace')).toBeGreaterThan(cool('side:top'));
      expect(Object.keys(Q.ambient.groups).sort()).toEqual(['side:blossom', 'side:clouds']);
      for (const g of Object.keys(Q.ambient.groups)) expect(groups(Q).has(g)).toBe(true);
      expect(P.ambient).toBeUndefined();
    });

    // (docs/side-strip-principles.md "Sceneries") the same family, another place, segment by segment
    it('lays a scenery a segment, a headland where it changes, and refuses one it does not know', () => {
      const segs = [{ node: 'a', s0: 0, length: 17 }, { node: 'b', s0: 17, length: 17 }];
      const lake = assembleSideStrip({ ...M, cube, side: { ...M.side, segments: segs, scenery: ['orchard', 'lake'] } }), forest = assembleSideStrip({ ...M, cube, side: { ...M.side, segments: segs, scenery: 'forest' } });
      const coast = assembleSideStrip({ ...M, cube, side: { ...M.side, scenery: 'coast' } });
      expect(groups(lake).has('side:water')).toBe(true);
      expect(groups(Q).has('side:water')).toBe(false);
      // (the lake lies on its own segment's stretch, never on the orchard's)
      expect(lake.faces.filter((f) => f.group === 'side:water').every((f) => f.corners.every((c) => c[1] >= 17 - 1e-6))).toBe(true);
      // (a forest's canopy where the near hills were; the coast's sea, its islands and no hills at all)
      expect(groups(forest).has('side:canopy')).toBe(true);
      expect(groups(coast).has('side:islands')).toBe(true);
      expect(coast.faces.some((f) => /^side:(hills|range)$/.test(f.group))).toBe(false);
      // (where it changes, a headland on each row; and the laws hold through every scenery)
      expect(lake.faces.filter((f) => f.group === 'side:range').length).toBeGreaterThan(Q.faces.filter((f) => f.group === 'side:range').length - 6);
      for (const P2 of [lake, forest, coast]) expect(sideLaws({ ...M, cube }, P2).filter((l) => !l.holds)).toEqual([]);
      // (its water glints and its canopy sways on the page)
      expect(Object.keys(lake.ambient.groups)).toContain('side:shimmer');
      expect(Object.keys(forest.ambient.groups)).toContain('side:canopy');
      expect(() => assembleSideStrip({ ...M, cube, side: { ...M.side, scenery: 'desert' } })).toThrow(/orchard, lake, forest, coast/);
    });

    it('is framed nearly level, so the sky is in the frame; and is the same every time', () => {
      expect(sideCameraWords(cube)).toEqual({ tilt: SHAPED_CAMERA.tilt, lookH: SHAPED_CAMERA.lookH });
      expect(SHAPED_CAMERA.tilt).toBeLessThan(SIDE_CAMERA.tilt);
      expect(JSON.stringify(assembleSideStrip({ ...M, cube }).faces)).toBe(JSON.stringify(Q.faces));
    });
  });
});
