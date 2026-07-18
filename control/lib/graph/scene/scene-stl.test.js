import { describe, expect, it } from 'vitest';

import { facesToStl } from './scene-stl.js';

// A minimal unit quad on the ground plane (z=0), corners in TL,TR,BR,BL order.
function quad(fill = '#808080', extra = {}) {
  return {
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    fill,
    ...extra,
  };
}

// Parse a binary STL Buffer back into { count, tris } for assertions.
// Each tri: { normal: [x,y,z], verts: [[..],[..],[..]] }.
function parseStl(buf) {
  expect(buf.length).toBeGreaterThanOrEqual(84);
  // binary STL must not start with the ASCII marker 'solid'
  expect(buf.slice(0, 5).toString('utf8')).not.toBe('solid');
  const count = buf.readUInt32LE(80);
  expect(buf.length).toBe(84 + count * 50);
  const tris = [];
  for (let i = 0; i < count; i++) {
    const o = 84 + i * 50;
    const f = (k) => buf.readFloatLE(o + k * 4);
    tris.push({
      normal: [f(0), f(1), f(2)],
      verts: [
        [f(3), f(4), f(5)],
        [f(6), f(7), f(8)],
        [f(9), f(10), f(11)],
      ],
      attr: buf.readUInt16LE(o + 48),
    });
  }
  return { count, tris };
}

describe('facesToStl', () => {
  it('returns null for an empty face list', () => {
    expect(facesToStl({ faces: [] })).toBeNull();
    expect(facesToStl({})).toBeNull();
  });

  it('emits a valid binary STL for a single quad (two triangles)', () => {
    const out = facesToStl({ faces: [quad()] });
    expect(out).not.toBeNull();
    const { count, tris } = parseStl(out.bytes);
    expect(count).toBe(2);
    expect(out.triangleCount).toBe(2);
    expect(out.vertexCount).toBe(6);
    expect(out.byteLength).toBe(out.bytes.length);
    for (const t of tris) expect(t.attr).toBe(0);
  });

  it('computes unit face normals from the vertex winding', () => {
    // TL,TR,BR winding on z=0 → normal along -Z (right-hand rule).
    const { tris } = parseStl(facesToStl({ faces: [quad()] }).bytes);
    for (const t of tris) {
      const [nx, ny, nz] = t.normal;
      expect(Math.sqrt(nx * nx + ny * ny + nz * nz)).toBeCloseTo(1, 5);
      expect(nx).toBeCloseTo(0, 5);
      expect(ny).toBeCloseTo(0, 5);
      expect(Math.abs(nz)).toBeCloseTo(1, 5);
    }
  });

  it('stays z-up: vertices export unrotated, scaled by `scale`', () => {
    const { tris } = parseStl(facesToStl({ faces: [quad()] }, { scale: 10 }).bytes);
    const xs = tris.flatMap((t) => t.verts.map((v) => v[0]));
    const ys = tris.flatMap((t) => t.verts.map((v) => v[1]));
    const zs = tris.flatMap((t) => t.verts.map((v) => v[2]));
    expect(Math.max(...xs)).toBeCloseTo(10, 5);
    expect(Math.max(...ys)).toBeCloseTo(10, 5);
    expect(zs.every((z) => z === 0)).toBe(true);
  });

  it('omits water and shadow/ink decals (not printable geometry)', () => {
    const out = facesToStl({
      faces: [
        quad('#808080'),
        quad('rgba(20,60,120,0.6)', { water: true }),
        quad('#222', { decal: 'shadow', shadowAlpha: 0.4 }),
        quad('#000', { decal: 'ink' }),
      ],
    });
    expect(parseStl(out.bytes).count).toBe(2); // only the solid quad
  });

  it('returns null when only non-printable faces remain', () => {
    expect(facesToStl({ faces: [quad('#222', { decal: 'shadow' })] })).toBeNull();
  });

  it('includes textured faces as bare geometry', () => {
    const f = quad('#808080', { texture: 'label', uv: [[0, 0], [1, 0], [1, 1], [0, 1]] });
    expect(parseStl(facesToStl({ faces: [f] }).bytes).count).toBe(2);
  });

  it('expands instanced repeats into real transformed triangles', () => {
    const out = facesToStl({
      faces: [],
      repeats: [
        {
          group: 'trees',
          template: [quad()],
          transforms: [
            { pos: [10, 0, 0] },
            { pos: [0, 20, 0], scale: 2 },
            { pos: [0, 0, 0], rotZ: Math.PI / 2 },
          ],
        },
      ],
    });
    const { count, tris } = parseStl(out.bytes);
    expect(count).toBe(6); // 2 tris × 3 instances
    const xs = tris.flatMap((t) => t.verts.map((v) => v[0]));
    const ys = tris.flatMap((t) => t.verts.map((v) => v[1]));
    expect(Math.max(...xs)).toBeCloseTo(11, 5); // translated instance
    expect(Math.max(...ys)).toBeCloseTo(22, 5); // scaled ×2 then translated to y=20
    expect(Math.min(...xs)).toBeCloseTo(-1, 5); // 90° rotation about +Z maps +Y → -X
  });

  it('drops zero-area slivers', () => {
    const degenerate = quad('#808080', {
      corners: [[0, 0, 0], [1, 0, 0], [1, 0, 0], [0, 0, 0]],
    });
    expect(facesToStl({ faces: [degenerate] })).toBeNull();
  });
});
