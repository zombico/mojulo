import { describe, expect, it } from 'vitest';

import { faceColorLinear, faceListToMesh } from './face-mesh.js';

describe('faceColorLinear', () => {
  it('parses a 6-digit fill hex to linear rgb', () => {
    // #ffffff (sRGB white) → linear white
    expect(faceColorLinear({ fill: '#ffffff' })).toEqual([1, 1, 1]);
    // #000000 → linear black
    expect(faceColorLinear({ fill: '#000000' })).toEqual([0, 0, 0]);
  });

  it('expands a 3-digit hex', () => {
    expect(faceColorLinear({ fill: '#fff' })).toEqual([1, 1, 1]);
  });

  it('applies the sRGB→linear transfer (mid-grey is darkened)', () => {
    const [r] = faceColorLinear({ fill: '#808080' });
    expect(r).toBeGreaterThan(0.21);
    expect(r).toBeLessThan(0.22); // ~0.2158, not the naive 0.502
  });

  it('falls back to the first hex inside a CSS gradient bg', () => {
    const c = faceColorLinear({ bg: 'linear-gradient(150deg,#3a4350,#1d232b 72%)' });
    const expected = faceColorLinear({ fill: '#3a4350' });
    expect(c).toEqual(expected);
  });

  it('returns the neutral fallback when no colour is resolvable', () => {
    expect(faceColorLinear({})).toEqual([0.5, 0.5, 0.5]);
    expect(faceColorLinear({ bg: 'none' })).toEqual([0.5, 0.5, 0.5]);
  });
});

describe('faceListToMesh', () => {
  const quad = {
    corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]],
    fill: '#ffffff',
  };

  it('emits two triangles (6 verts) per quad face', () => {
    const mesh = faceListToMesh([quad]);
    expect(mesh.faceCount).toBe(1);
    expect(mesh.vertexCount).toBe(6);
    expect(mesh.positions.length).toBe(18);
    expect(mesh.colors.length).toBe(18);
  });

  it('shares the face colour across all 6 verts', () => {
    const { colors } = faceListToMesh([quad]);
    for (let i = 0; i < colors.length; i++) expect(colors[i]).toBe(1);
  });

  it('skips degenerate faces with fewer than 4 corners', () => {
    const mesh = faceListToMesh([{ corners: [[0, 0, 0], [1, 0, 0]], fill: '#fff' }, quad]);
    expect(mesh.vertexCount).toBe(6); // only the valid quad contributed
  });

  it('computes a center and bounding radius from corner coords', () => {
    const mesh = faceListToMesh([quad]);
    expect(mesh.center).toEqual([1, 0, 1]);
    expect(mesh.radius).toBeCloseTo(Math.SQRT2, 5); // corner at (0,0,0) is √2 from center (1,0,1)
  });

  it('returns empty arrays and origin for no faces', () => {
    const mesh = faceListToMesh([]);
    expect(mesh.vertexCount).toBe(0);
    expect(mesh.center).toEqual([0, 0, 0]);
    expect(mesh.radius).toBe(0);
  });
});
