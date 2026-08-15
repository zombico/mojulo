// triangulate — ear-clipping of evenodd contour sets with holes (interchange.plan.md I2:
// the carved-solid cap tessellation rides this; these tests pin it on both synthetic rings
// and the ACTUAL glyph contours the carver produces for letters with holes).

import { describe, expect, it } from 'vitest';

import { triangulateRings, signedArea } from './triangulate.js';

const triArea = ([a, b, c]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
const totalArea = (tris) => tris.reduce((s, t) => s + triArea(t), 0);
// evenodd area of a ring set = Σ|outer| − Σ|holes| (holes are odd-depth rings)
const square = (cx, cy, r) => [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r]];

describe('triangulateRings — synthetic rings', () => {
  it('a plain convex ring ear-clips to n-2 triangles of the exact area', () => {
    const tris = triangulateRings([square(0, 0, 1)]);
    expect(tris).toHaveLength(2);
    expect(totalArea(tris)).toBeCloseTo(4, 9);
  });

  it('a square with a square hole (the O topology) conserves evenodd area', () => {
    const tris = triangulateRings([square(0, 0, 2), square(0, 0, 1)]);
    expect(tris.length).toBeGreaterThanOrEqual(8);
    expect(totalArea(tris)).toBeCloseTo(16 - 4, 9);
    // no triangle centroid may land inside the hole
    for (const t of tris) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      expect(Math.abs(cx) < 1 && Math.abs(cy) < 1).toBe(false);
    }
  });

  it('two holes in one outer (the B topology) conserve evenodd area', () => {
    // holes deliberately STAGGERED in x: two identical-max-x holes put their bridge
    // segments exactly collinear with hole edges, a known ear-clip degeneracy this
    // triangulator does not handle (glyph outlines never produce it — curve-sampled
    // contours are not axis-aligned-coincident; the O/A/B pins below cover the real case).
    const tris = triangulateRings([square(0, 0, 3), square(0.4, 1.5, 0.7), square(-0.4, -1.5, 0.7)]);
    expect(totalArea(tris)).toBeCloseTo(36 - 2 * 1.96, 6);
  });

  it('two disjoint outers (separate glyphs) triangulate independently', () => {
    const tris = triangulateRings([square(-3, 0, 1), square(3, 0, 1)]);
    expect(tris).toHaveLength(4);
    expect(totalArea(tris)).toBeCloseTo(8, 9);
  });

  it('winding order does not matter (rings normalized by nesting depth)', () => {
    const rev = (r) => r.slice().reverse();
    const a = totalArea(triangulateRings([square(0, 0, 2), square(0, 0, 1)]));
    const b = totalArea(triangulateRings([rev(square(0, 0, 2)), rev(square(0, 0, 1))]));
    expect(a).toBeCloseTo(b, 9);
  });

  it('degenerate rings (line, duplicate points) are dropped, not fatal', () => {
    const tris = triangulateRings([[[0, 0], [1, 0]], [[0, 0], [0, 0], [0, 0]], square(0, 0, 1)]);
    expect(totalArea(tris)).toBeCloseTo(4, 9);
  });
});

// resolveContours needs a system font (Arial Black on macOS / DejaVu on the CI image);
// skip the glyph pins gracefully only if NO font resolves — the synthetic net above still runs.
let contoursOf = null;
try {
  const { resolveContours } = await import('../effects/carved-solid.js');
  resolveContours({ text: 'O' }, {});
  contoursOf = (text) => resolveContours({ text }, {});
} catch { contoursOf = null; }

describe('triangulateRings — actual carver glyph contours (letters with holes)', () => {
  it.skipIf(!contoursOf)('O / A / B tessellate with evenodd-conserved area and expected hole counts', () => {
    for (const [letter, holes] of [['O', 1], ['A', 1], ['B', 2]]) {
      const rings = contoursOf(letter);
      expect(rings.length, `${letter} ring count`).toBeGreaterThanOrEqual(1 + holes);
      const areas = rings.map((r) => Math.abs(signedArea(r))).sort((a, b) => b - a);
      const outer = areas[0];
      const holeArea = areas.slice(1, 1 + holes).reduce((s, a) => s + a, 0);
      const tris = triangulateRings(rings);
      expect(tris.length, `${letter} produced triangles`).toBeGreaterThan(4);
      // glyph outlines are curve-sampled; earclip + bridge should conserve area to ~0.5%
      expect(totalArea(tris)).toBeCloseTo(outer - holeArea, 2);
    }
  });

  it.skipIf(!contoursOf)('a whole word with holes (BO) tessellates deterministically', () => {
    const rings = contoursOf('BO');
    const a = triangulateRings(rings);
    const b = triangulateRings(rings.map((r) => r.map((p) => [...p])));
    expect(a.length).toBe(b.length);
    expect(totalArea(a)).toBeCloseTo(totalArea(b), 12);
  });
});
