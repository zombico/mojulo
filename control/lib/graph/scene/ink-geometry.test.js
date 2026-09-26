import { describe, expect, it } from 'vitest';

import { inkCentroid, inkGeoNormals, inkWeldNormals, inkBake } from './ink-geometry.js';

// A closed unit cube as a triangle soup (12 tris, CCW-outward winding), per-corner face normals.
function cubeSoup() {
  const F = [
    // [corner quad (CCW from outside), outward normal]
    [[[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], [0, 0, -1]],   // bottom
    [[[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [0, 0, 1]],    // top
    [[[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], [0, -1, 0]],   // south
    [[[1, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1]], [0, 1, 0]],    // north
    [[[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], [-1, 0, 0]],   // west
    [[[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], [1, 0, 0]],    // east
  ];
  const pos = [], nrm = [];
  for (const [q, n] of F) for (const tri of [[0, 1, 2], [0, 2, 3]]) for (const c of tri) { pos.push(...q[c]); nrm.push(...n); }
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm) };
}

const signedVolume = (p) => {
  let v = 0;
  for (let t = 0; t < p.length; t += 9) {
    const a = [p[t], p[t + 1], p[t + 2]], b = [p[t + 3], p[t + 4], p[t + 5]], c = [p[t + 6], p[t + 7], p[t + 8]];
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
};

describe('ink-geometry — the toon-ink builders as bake-time code', () => {
  const { pos, nrm } = cubeSoup();

  it('welds: a cube corner sums its three face normals into the unit diagonal; every weld is unit-length', () => {
    const wn = inkWeldNormals(pos, nrm, 1e-3);
    for (let i = 0; i < wn.length; i += 3) {
      expect(Math.hypot(wn[i], wn[i + 1], wn[i + 2])).toBeCloseTo(1, 6);
      // every cube vertex is a 3-face corner: the weld points into all three axes at once (the
      // sum is occurrence-weighted — a quad's diagonal corners count their face twice — exactly
      // like the channel's weld over the packed per-corner soup)
      for (let c = 0; c < 3; c++) expect(Math.abs(wn[i + c])).toBeGreaterThan(0.2);
    }
    expect(inkCentroid(pos).every((c) => Math.abs(c - 0.5) < 1e-9)).toBe(true);
  });

  it('geo normals: winding-derived, oriented away from the centroid', () => {
    const gn = inkGeoNormals(pos, inkCentroid(pos));
    for (let t = 0; t < pos.length; t += 9) {
      const cx = (pos[t] + pos[t + 3] + pos[t + 6]) / 3 - 0.5, cy = (pos[t + 1] + pos[t + 4] + pos[t + 7]) / 3 - 0.5, cz = (pos[t + 2] + pos[t + 5] + pos[t + 8]) / 3 - 0.5;
      expect(gn[t] * cx + gn[t + 1] * cy + gn[t + 2] * cz).toBeGreaterThan(0);
    }
  });

  it('bake: the hull is pushed by width along the weld and its winding is FLIPPED; the cube creases all 12 edges; determinism', () => {
    const width = 0.05;
    const baked = inkBake(pos, nrm, { width, crease: 35, q: 1e-3 });
    // winding: source soup is outward-CCW (positive volume); the baked hull must be inverted
    expect(signedVolume(pos)).toBeCloseTo(1, 6);
    expect(signedVolume(baked.hullPos)).toBeLessThan(0);
    // push: every hull corner equals its SOURCE corner + weld·width (hullSrc carries the mapping)
    const wn = inkWeldNormals(pos, nrm, 1e-3);
    for (let i = 0; i < baked.hullSrc.length; i++) {
      const s = baked.hullSrc[i] * 3;
      for (let c = 0; c < 3; c++) expect(baked.hullPos[i * 3 + c]).toBeCloseTo(pos[s + c] + wn[s + c] * width, 6);
    }
    // creases: 12 cube edges, every one sharper than 35° → 12 segments (24 points), no open boundaries
    expect(baked.linePos.length).toBe(24 * 3);
    // the lines are lifted along the weld (0.35·width default): no line point sits on the cube surface
    for (let i = 0; i < baked.lineSrc.length; i++) {
      const s = baked.lineSrc[i] * 3;
      const d = Math.hypot(baked.linePos[i * 3] - pos[s], baked.linePos[i * 3 + 1] - pos[s + 1], baked.linePos[i * 3 + 2] - pos[s + 2]);
      expect(d).toBeCloseTo(width * 0.35, 6);
    }
    const again = inkBake(pos, nrm, { width, crease: 35, q: 1e-3 });
    expect(Array.from(again.hullPos)).toEqual(Array.from(baked.hullPos));
    expect(Array.from(again.linePos)).toEqual(Array.from(baked.linePos));
  });

  it('a degenerate twin drops out of the hull and the census; an open boundary becomes a contour line', () => {
    // one real triangle + one degenerate (repeated corner)
    const p = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, /* degenerate */ 0, 0, 0, 0, 0, 0, 1, 0, 0]);
    const n = Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const baked = inkBake(p, n, { width: 0.01, crease: 35, q: 1e-3 });
    expect(baked.hullPos.length).toBe(9);            // only the real triangle
    expect(baked.linePos.length).toBe(3 * 2 * 3);    // its three open edges → three segments
  });
});
