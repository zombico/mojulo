// text-to-cad-seam.plan.md T2 — measured printability over the exported soup.
import { describe, it, expect } from 'vitest';
import { measurePrintability, printSoup, measureLine } from './print-measure.js';
import { resolvePrinter, printAdvisories } from './print-advisory.js';

// An axis-aligned box as outward-wound triangle soup (12 triangles), in mm.
function box([x0, y0, z0], [x1, y1, z1], flip = false) {
  const v = (x, y, z) => [x, y, z];
  const q = (a, b, c, d) => (flip ? [a, d, c, a, c, b] : [a, b, c, a, c, d]);
  const P = {
    a: v(x0, y0, z0), b: v(x1, y0, z0), c: v(x1, y1, z0), d: v(x0, y1, z0),
    e: v(x0, y0, z1), f: v(x1, y0, z1), g: v(x1, y1, z1), h: v(x0, y1, z1),
  };
  const faces = [
    q(P.a, P.d, P.c, P.b), // bottom (normal −z)
    q(P.e, P.f, P.g, P.h), // top (+z)
    q(P.a, P.b, P.f, P.e), // front (−y)
    q(P.c, P.d, P.h, P.g), // back (+y)
    q(P.d, P.a, P.e, P.h), // left (−x)
    q(P.b, P.c, P.g, P.f), // right (+x)
  ];
  return Float32Array.from(faces.flat(2));
}
const cat = (...arrs) => { const n = arrs.reduce((s, a) => s + a.length, 0); const out = new Float32Array(n); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; };

// An inverted square pyramid: apex at the bottom, 20 mm base at z=10 — every side
// face leans out 45° exactly; with the apex 10 below a 10-half-width base the
// side tilt from vertical is atan(10/10) = 45°.
function invertedPyramid(halfW = 10, h = 10) {
  const apex = [0, 0, 0];
  const b = [[-halfW, -halfW, h], [halfW, -halfW, h], [halfW, halfW, h], [-halfW, halfW, h]];
  const tris = [];
  // sides, outward = away from the axis and downward
  for (let i = 0; i < 4; i++) { const p = b[i], q = b[(i + 1) % 4]; tris.push(apex, q, p); }
  // top cap (+z)
  tris.push(b[0], b[1], b[2], b[0], b[2], b[3]);
  return Float32Array.from(tris.flat());
}

const fdm = resolvePrinter();

describe('measurePrintability — overhang', () => {
  it('a cube on the bed has no overhang; its bottom is bed contact; walls read the cube', () => {
    const m = measurePrintability({ positions: box([0, 0, 0], [10, 10, 10]), printer: fdm });
    expect(m.triangles).toBe(12);
    expect(m.area_mm2).toBe(600);
    expect(m.overhang.area_mm2).toBe(0);
    expect(m.bed_contact_mm2).toBe(100);
    expect(m.support.footprint_mm2).toBe(0);
    expect(m.orientation.best).toBe('z+');
    expect(m.walls.measured).toBe(true);
    expect(m.walls.min_mm).toBe(10);
    expect(m.walls.p05_mm).toBe(10);
    expect(m.walls.sampled).toBe(12);
  });

  it('a T on its stem: the crossbar underside is 100% overhang, footprint = crossbar minus stem; z- is the better build', () => {
    const stem = box([-2, -2, 0], [2, 2, 20]);
    const bar = box([-15, -5, 20], [15, 5, 24]);
    const m = measurePrintability({ positions: cat(stem, bar), printer: fdm, walls: false });
    // underside of the bar is 30 × 10 = 300 mm², all at 90° from vertical
    expect(m.overhang.area_mm2).toBe(300);
    expect(m.overhang.worst_deg).toBe(90);
    expect(m.support.footprint_mm2).toBe(300);
    // column to bed: 300 mm² × 20 mm height (centroid z = 20 above z_min = 0)
    expect(m.support.volume_mm3_upper).toBe(6000);
    // upside down the bar sits on the bed and the stem points up: zero support — the
    // stem's top face (buried inside the bar) is skipped, not counted as an overhang
    expect(m.orientation.footprint_mm2_by_axis['z-']).toBe(0);
    expect(m.orientation.best).toBe('z-');
    expect(m.orientation.buried_filtered).toBe(true);
    expect(m.walls.measured).toBe(false);
  });

  it('an inverted pyramid leans exactly 45°: clear at the FDM limit, flagged under a 30° resin limit', () => {
    const p = invertedPyramid();
    const m45 = measurePrintability({ positions: p, printer: fdm, walls: false });
    expect(m45.overhang.area_mm2).toBe(0); // 45° is not > 45°
    const sla = resolvePrinter({ process: 'sla' });
    const m30 = measurePrintability({ positions: p, printer: sla, walls: false });
    expect(m30.overhang.area_mm2).toBeGreaterThan(0);
    expect(m30.overhang.worst_deg).toBeCloseTo(45, 0);
    expect(m30.overhang.faces).toBe(4);
    // apex-up (z-) the flat cap sits on the bed and the sides face UP: nothing to support
    expect(m30.orientation.footprint_mm2_by_axis['z-']).toBe(0);
    expect(m30.orientation.best).toBe('z-');
  });

  it('a powder process judges no overhang at all', () => {
    const m = measurePrintability({ positions: invertedPyramid(), printer: resolvePrinter({ process: 'sls' }), walls: false });
    expect(m.overhang).toBeNull();
    expect(m.support).toBeNull();
    expect(m.orientation).toBeNull();
    expect(m.area_mm2).toBeGreaterThan(0);
  });
});

describe('measurePrintability — walls', () => {
  it('a hollow box (outer shell + inward-facing inner shell) reads its 0.5 mm wall', () => {
    const outer = box([0, 0, 0], [10, 10, 10]);
    const inner = box([0.5, 0.5, 0.5], [9.5, 9.5, 9.5], true); // flipped: normals point INTO the cavity
    const m = measurePrintability({ positions: cat(outer, inner), printer: fdm });
    expect(m.walls.measured).toBe(true);
    expect(m.walls.min_mm).toBe(0.5);
    expect(m.walls.p05_mm).toBe(0.5);
    // every sampled face sees a 0.5 mm wall
    expect(m.walls.median_mm).toBe(0.5);
    // the advisory words it, at the 5th percentile, under the 0.8 mm floor — and the
    // cavity's ceiling is a real 9 × 9 mm bridge, reported as the overhang it is
    const rows = printAdvisories({ printer: fdm, measure: m });
    expect(rows.map((r) => r.kind)).toEqual(['thin_wall_measured', 'overhang']);
    expect(rows[0].detail).toContain('0.5 mm at the 5th percentile');
    expect(m.overhang.area_mm2).toBe(81);
  });

  it('two overlapping shells read the UNION depth, not the overlap gap; buried faces are skipped', () => {
    const a = box([0, 0, 0], [10, 10, 10]);
    const b = box([5, 0, 0], [15, 10, 10]); // overlaps a on x ∈ [5, 10]
    const m = measurePrintability({ positions: cat(a, b), printer: fdm });
    expect(m.walls.measured).toBe(true);
    // the thinnest honest reading is the 10 mm y / z depth; along x a ray from x=0 exits at x=15
    expect(m.walls.min_mm).toBe(10);
    // a's right face and b's left face sit inside the other box: buried, not sampled
    expect(m.walls.buried).toBe(4);
    expect(m.walls.unresolved).toBe(0);
    // no overhang: the shared top is flat and every down-facing face is on the bed
    expect(m.overhang.area_mm2).toBe(0);
  });

  it('a flush joint reads the parts\' own depths, never a zero wall (the hook finding)', () => {
    // a 20 mm block with a 10 mm arm growing from its +x face: the arm's cap sits ON the block
    const block = box([0, 0, 0], [20, 20, 20]);
    const arm = box([20, 5, 5], [30, 15, 15]);
    const m = measurePrintability({ positions: cat(block, arm), printer: fdm });
    expect(m.walls.measured).toBe(true);
    expect(m.walls.min_mm).toBe(10); // the arm's own 10 mm section, never the 0 mm joint
    expect(m.walls.buried).toBeGreaterThan(0); // the two flush faces sit inside the other part and are set aside
    // the arm's underside (10 × 10 mm, 5 mm above the bed) is a real overhang, and only that
    expect(printAdvisories({ printer: fdm, measure: m }).map((r) => r.kind)).toEqual(['overhang']);
    expect(m.overhang.area_mm2).toBe(100);
  });

  it('a stray near-coplanar face (a mesher\'s double wall 0.01 mm under the skin) is coincident, not a wall and not a dead end', () => {
    const cube = box([0, 0, 0], [10, 10, 10]);
    // a duplicate of the top face 0.01 mm below it, same outward normal (+z)
    const dup = Float32Array.from([0, 0, 9.99, 10, 0, 9.99, 10, 10, 9.99, 0, 0, 9.99, 10, 10, 9.99, 0, 10, 9.99]);
    const m = measurePrintability({ positions: cat(cube, dup), printer: fdm });
    expect(m.walls.measured).toBe(true);
    expect(m.walls.min_mm).toBeCloseTo(10, 1); // from the top the ray skips the 0.01 mm double and reaches the floor; from the floor the double IS the far side, 9.99
    expect(m.walls.coincident).toBeGreaterThan(0);
    expect(m.walls.unresolved).toBe(0);
    expect(m.walls.touch_mm).toBeCloseTo(0.01, 2);
  });

  it('an open shell says so rather than guessing thick', () => {
    // a single square (two triangles) — no far side anywhere
    const sheet = Float32Array.from([0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 0, 0, 10, 10, 0, 0, 10, 0]);
    const m = measurePrintability({ positions: sheet, printer: fdm });
    expect(m.walls.measured).toBe(false);
    expect(m.walls.reason).toMatch(/no far side/);
    expect(printAdvisories({ printer: fdm, measure: m })).toEqual([]);
  });

  it('the sample stride caps the rays and says how many it took', () => {
    const many = cat(...Array.from({ length: 40 }, (_, i) => box([i * 20, 0, 0], [i * 20 + 10, 10, 10])));
    const m = measurePrintability({ positions: many, printer: fdm, sample: 100 });
    expect(m.triangles).toBe(480);
    expect(m.walls.sampled).toBeLessThanOrEqual(100);
    expect(m.walls.sampled).toBeGreaterThan(50);
    expect(m.walls.min_mm).toBe(10);
  });
});

describe('printSoup + advisories + line', () => {
  it('printSoup expands repeats at scale and drops slivers, like the STL', () => {
    const tpl = [
      { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#888' },
    ];
    const payload = { faces: [], repeats: [{ group: 'g', template: tpl, transforms: [{ pos: [0, 0, 0] }, { pos: [5, 0, 0] }] }] };
    const soup = printSoup(payload, { scale: 10 });
    expect(soup).not.toBeNull();
    expect(soup.length % 9).toBe(0);
    expect(soup.length / 9).toBe(4); // two quads → four triangles
    expect(Math.max(...soup)).toBe(60); // (5 + 1) × 10
    expect(printSoup({ faces: [] })).toBeNull();
  });

  it('the overhang advisory names the area, the limit, and the better axis; the line reads', () => {
    const stem = box([-2, -2, 0], [2, 2, 20]);
    const bar = box([-15, -5, 20], [15, 5, 24]);
    const m = measurePrintability({ positions: cat(stem, bar), printer: fdm, walls: false });
    const rows = printAdvisories({ printer: fdm, measure: m });
    expect(rows.map((r) => r.kind)).toEqual(['overhang']);
    expect(rows[0].detail).toContain('300 mm²');
    expect(rows[0].detail).toContain('45° self-support limit');
    expect(rows[0].detail).toContain('least support if built along z-');
    expect(measureLine(m)).toMatch(/overhang 300 mm²/);
    expect(measureLine(m)).toMatch(/least support built along z-/);
    // a powder printer suppresses the overhang row and states the trapped-volume caveat
    const sls = resolvePrinter({ process: 'sls' });
    const mp = measurePrintability({ positions: cat(stem, bar), printer: sls, walls: false });
    expect(printAdvisories({ printer: sls, measure: mp }).map((r) => r.kind)).toEqual(['trapped_volume']);
    expect(measureLine(mp)).toMatch(/not judged/);
  });
});
