import { describe, expect, it } from 'vitest';

import { inkCentroid, inkGeoNormals, inkWeldNormals, inkBake, inkBuried } from './ink-geometry.js';

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

  it('lines: false (the silhouette-only ink) draws no segment at all — open boundaries included — and leaves the hull alone', () => {
    const baked = inkBake(pos, nrm, { width: 0.05, crease: 35, q: 1e-3 });
    const hullOnly = inkBake(pos, nrm, { width: 0.05, crease: 35, q: 1e-3, lines: false });
    expect(hullOnly.linePos.length).toBe(0); expect(hullOnly.lineSrc.length).toBe(0);
    expect(Array.from(hullOnly.hullPos)).toEqual(Array.from(baked.hullPos)); expect(Array.from(hullOnly.hullSrc)).toEqual(Array.from(baked.hullSrc));
    // a crease angle cannot do it: at 180° the creases go, but an open boundary still inks
    const open = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]); const up = Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(inkBake(pos, nrm, { crease: 180, q: 1e-3 }).linePos.length).toBe(0);
    expect(inkBake(open, up, { crease: 180, q: 1e-3 }).linePos.length).toBe(3 * 2 * 3);
    expect(inkBake(open, up, { crease: 180, q: 1e-3, lines: false }).linePos.length).toBe(0);
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

// The bake's stand-in for the World page's hair stencil rule (channels/draw-layers.js): the hull of hair lying INSIDE
// another hair part is left out. Soups here are boxes (cubeSoup scaled and moved), each its own closed part.
const box = (o, k) => { const { pos, nrm } = cubeSoup(); return { pos: pos.map((v, i) => o[i % 3] + k * v), nrm }; };
const cat = (...s) => ({ pos: Float32Array.from(s.flatMap((x) => [...x.pos])), nrm: Float32Array.from(s.flatMap((x) => [...x.nrm])) });

describe('inkBuried — the hair the baked hull leaves out', () => {
  it('a part wholly inside another: every one of its triangles, none of the container\'s', () => {
    const { pos } = cat(box([0, 0, 0], 1), box([0.3, 0.3, 0.3], 0.2));
    expect(Array.from(inkBuried(pos))).toEqual([...Array(12).fill(0), ...Array(12).fill(1)]);
  });
  it('a part half in: exactly the triangles whose centroid is inside the other (the straddling ones by their centroid)', () => {
    const big = box([0, 0, 0], 1), small = box([0.8, 0.4, 0.4], 0.4);   // x 0.8–1.2: through the big box's east face
    const flags = inkBuried(cat(big, small).pos);
    const want = []; for (let t = 0; t < small.pos.length; t += 9) { const c = [0, 1, 2].map((a) => (small.pos[t + a] + small.pos[t + 3 + a] + small.pos[t + 6 + a]) / 3); want.push(c.every((v) => v > 0 && v < 1) ? 1 : 0); }
    expect(Array.from(flags.subarray(12))).toEqual(want); expect(want.filter(Boolean).length).toBe(6);   // its west face whole, its top, bottom, south and north faces by centroid
    expect(Array.from(flags.subarray(0, 12)).filter(Boolean)).toEqual([]);   // the big box's east-face centroids (y or z 1/3) miss the small one
  });
  it('an open part contains nothing; parts touching at an exact corner are one part; nothing is flagged against itself', () => {
    const openBig = box([0, 0, 0], 1); const open = { pos: openBig.pos.subarray(0, 9 * 10), nrm: openBig.nrm.subarray(0, 9 * 10) };   // the east face missing
    expect(Array.from(inkBuried(cat(open, box([0.3, 0.3, 0.3], 0.2)).pos)).every((x) => x === 0)).toBe(true);
    const touching = cat(box([0, 0, 0], 1), box([0, 0, 0], 0.5));   // the small box shares the corner (0,0,0) bit for bit
    expect(Array.from(inkBuried(touching.pos)).every((x) => x === 0)).toBe(true);
    expect(Array.from(inkBuried(box([0, 0, 0], 1).pos)).every((x) => x === 0)).toBe(true);
    expect(inkBuried(new Float32Array(0))).toHaveLength(0);
  });
  it('inkBake `skip`: the flagged triangles give no hull, the rest the same hull; the lines and the weld never see the flags', () => {
    const s = cat(box([0, 0, 0], 1), box([0.3, 0.3, 0.3], 0.2)), skip = inkBuried(s.pos);
    const all = inkBake(s.pos, s.nrm, { width: 0.01, q: 1e-3 }), kept = inkBake(s.pos, s.nrm, { width: 0.01, q: 1e-3, skip });
    expect(kept.hullPos.length).toBe(all.hullPos.length - 12 * 9);   // the culling count: the buried box's 12
    expect(Array.from(kept.hullPos)).toEqual(Array.from(all.hullPos.subarray(0, 12 * 9)));
    expect(Array.from(kept.hullSrc).every((i) => i < 36)).toBe(true);
    expect(Array.from(kept.linePos)).toEqual(Array.from(all.linePos));
    expect(Array.from(inkBake(s.pos, s.nrm, { width: 0.01, q: 1e-3, skip: new Uint8Array(24) }).hullPos)).toEqual(Array.from(all.hullPos));
    expect(Array.from(inkBuried(s.pos))).toEqual(Array.from(skip));   // deterministic
  });
});
