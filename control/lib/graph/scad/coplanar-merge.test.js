import { describe, it, expect } from 'vitest';
import { mergeCoplanarTriangles, mergeExactFaces } from './coplanar-merge.js';

const tri = (a, b, c, extra = {}) => ({ corners: [a, b, c], tint: '#ff0000', normal: [0, 0, 1], group: 'g', ...extra });

describe('coplanar-merge — flat triangle regions become one clipped panel', () => {
  it('two triangles of a unit square merge into one parallelogram with a 4-point clip', () => {
    const out = mergeCoplanarTriangles([
      tri([0, 0, 0], [1, 0, 0], [1, 1, 0]),
      tri([0, 0, 0], [1, 1, 0], [0, 1, 0]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].merged).toBe(2);
    expect(out[0].corners).toHaveLength(4);
    expect(out[0].clip).toMatch(/^polygon\(/);
    expect(out[0].clip.split(',')).toHaveLength(4);
    expect(out[0].tint).toBe('#ff0000');
    expect(out[0].group).toBe('g');
    // the panel spans the square exactly
    const xs = out[0].corners.map((c) => c[0]), ys = out[0].corners.map((c) => c[1]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 1, 0, 1]);
  });

  it('a disc fan merges into one panel whose clip has one point per rim vertex', () => {
    const n = 12;
    const rim = Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2), Math.sin((i / n) * Math.PI * 2), 0]);
    const fan = rim.map((p, i) => tri([0, 0, 0], p, rim[(i + 1) % n]));
    const out = mergeCoplanarTriangles(fan);
    expect(out).toHaveLength(1);
    expect(out[0].merged).toBe(n);
    expect(out[0].clip.split(',')).toHaveLength(n);
  });

  it('an annulus (a hole) merges into one panel with an evenodd clip that visits the hole', () => {
    const n = 8;
    const ring = (r) => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2), 0]);
    const inner = ring(1), outer = ring(2);
    const tris = [];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      tris.push(tri(inner[i], outer[i], outer[j]), tri(inner[i], outer[j], inner[j]));
    }
    const out = mergeCoplanarTriangles(tris);
    expect(out).toHaveLength(1);
    expect(out[0].holes).toBe(1);
    expect(out[0].clip).toMatch(/^polygon\(evenodd, /);
    // outline (8) + bridge to the hole (1) + hole (8) + close (1)
    expect(out[0].clip.replace('polygon(evenodd, ', '').split(',')).toHaveLength(8 + 1 + 8 + 1);
  });

  it('a concave L merges into one clipped panel; two islands on one plane merge separately', () => {
    // built from full shared edges (no T-junctions), as a manifold mesh is
    const L = [
      tri([0, 0, 0], [1, 0, 0], [1, 1, 0]), tri([0, 0, 0], [1, 1, 0], [0, 1, 0]),
      tri([1, 0, 0], [2, 0, 0], [2, 1, 0]), tri([1, 0, 0], [2, 1, 0], [1, 1, 0]),
      tri([0, 1, 0], [1, 1, 0], [1, 2, 0]), tri([0, 1, 0], [1, 2, 0], [0, 2, 0]),
    ];
    const out = mergeCoplanarTriangles(L);
    expect(out).toHaveLength(1);
    expect(out[0].merged).toBe(6);
    expect(out[0].clip.split(',')).toHaveLength(6);
    const islands = [
      tri([0, 0, 0], [1, 0, 0], [1, 1, 0]), tri([0, 0, 0], [1, 1, 0], [0, 1, 0]),
      tri([5, 0, 0], [6, 0, 0], [6, 1, 0]), tri([5, 0, 0], [6, 1, 0], [5, 1, 0]),
    ];
    const two = mergeCoplanarTriangles(islands);
    expect(two).toHaveLength(2);
    expect(two.every((r) => r.merged === 2)).toBe(true);
  });

  it('different tints, groups or planes never merge', () => {
    const mixed = [
      tri([0, 0, 0], [1, 0, 0], [1, 1, 0]),
      tri([0, 0, 0], [1, 1, 0], [0, 1, 0], { tint: '#00ff00' }),
      tri([0, 0, 1], [1, 0, 1], [1, 1, 1]),
      tri([0, 0, 1], [1, 1, 1], [0, 1, 1], { group: 'h' }),
    ];
    expect(mergeCoplanarTriangles(mixed)).toBe(mixed);
  });
});

describe('coplanar-merge — mergeExactFaces over a shaded face list', () => {
  const shaded = (a, b, c, extra = {}) => ({ corners: [a, b, c, a], fill: '#808080', outNormal: [0, 0, 1], group: 'g', doubleSided: true, exact: true, ...extra });
  it('folds only the exact faces, keeps the others in place, flags noInflate', () => {
    const plain = { corners: [[9, 9, 9], [10, 9, 9], [9, 10, 9], [9, 9, 9]], fill: '#ff0000', outNormal: [0, 0, 1] };
    const faces = [
      plain,
      shaded([0, 0, 0], [1, 0, 0], [1, 1, 0]),
      shaded([0, 0, 0], [1, 1, 0], [0, 1, 0]),
      shaded([5, 0, 0], [6, 0, 0], [6, 1, 0], { fill: '#00ff00' }), // alone: stays a triangle
    ];
    const out = mergeExactFaces(faces);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(plain);
    expect(out[1].clip).toMatch(/^polygon\(/);
    expect(out[1].fill).toBe('#808080');
    expect(out[1].noInflate).toBe(true);
    expect(out[2].corners).toEqual(faces[3].corners);
    expect(out[2].noInflate).toBe(true);
  });
  it('is the identity for a face list with no exact faces', () => {
    const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 0, 0]], fill: '#ff0000', outNormal: [0, 0, 1] }];
    expect(mergeExactFaces(faces)).toBe(faces);
  });
});
