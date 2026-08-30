import { describe, expect, it } from 'vitest';

import {
  shellToFaces, validateShells, shellFaceCount,
  SHELL_SOLIDS, SHELL_FACE_COUNTS, MAX_GEODESIC_FREQUENCY,
} from './shell-faces.js';
import { faceSides, faceCenter, faceNormal, distinctCorners } from './face-select.js';
import { faceListToMesh } from '../figures/face-mesh.js';

const isHex = (s) => /^#[0-9a-f]{6}$/i.test(s);
const finiteVec = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

const shell = (extra = {}) => ({ solid: 'icosahedron', radius: 2, ...extra });

// Unique undirected edges of a face list, keyed on rounded endpoint coordinates.
function edgeCount(faces) {
  const edges = new Set();
  for (const f of faces) {
    const pts = distinctCorners(f);
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const k = [a, b].map((p) => p.map((v) => v.toFixed(6)).join(',')).sort().join('|');
      edges.add(k);
    }
  }
  return edges.size;
}

function vertexCount(faces) {
  const vs = new Set();
  for (const f of faces) for (const p of distinctCorners(f)) vs.add(p.map((v) => v.toFixed(6)).join(','));
  return vs.size;
}

describe('shellToFaces — the named solids', () => {
  it.each([
    ['tetrahedron', 4, [3]],
    ['cube', 6, [4]],
    ['octahedron', 8, [3]],
    ['dodecahedron', 12, [5]],
    ['icosahedron', 20, [3]],
    ['truncated_icosahedron', 32, [5, 6]],
  ])('%s → %i faces with the right polygons', (solid, count, sides) => {
    const faces = shellToFaces(shell({ solid }));
    expect(faces).toHaveLength(count);
    expect(SHELL_FACE_COUNTS[solid]).toBe(count);
    expect([...new Set(faces.map(faceSides))].sort()).toEqual(sides);
  });

  it('the truncated icosahedron is a soccer ball: 12 pentagons + 20 hexagons', () => {
    const faces = shellToFaces(shell({ solid: 'truncated_icosahedron' }));
    expect(faces.filter((f) => faceSides(f) === 5)).toHaveLength(12);
    expect(faces.filter((f) => faceSides(f) === 6)).toHaveLength(20);
  });

  it.each(SHELL_SOLIDS.filter((s) => s !== 'geodesic'))('%s satisfies Euler V - E + F = 2', (solid) => {
    const faces = shellToFaces(shell({ solid }));
    expect(vertexCount(faces) - edgeCount(faces) + faces.length).toBe(2);
  });

  it.each(SHELL_SOLIDS.filter((s) => s !== 'geodesic'))('%s has all edges the same length', (solid) => {
    const faces = shellToFaces(shell({ solid }));
    const lens = [];
    for (const f of faces) {
      const pts = distinctCorners(f);
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        lens.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
    }
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThan(1e-9);
  });
});

describe('shellToFaces — geometry invariants', () => {
  it.each(SHELL_SOLIDS)('%s: every vertex sits on the circumsphere at `radius`', (solid) => {
    const faces = shellToFaces(shell({ solid, radius: 3, center: { x: 1, y: -2, z: 5 }, frequency: 2 }));
    for (const f of faces) {
      for (const p of distinctCorners(f)) {
        expect(Math.hypot(p[0] - 1, p[1] + 2, p[2] - 5)).toBeCloseTo(3, 9);
      }
    }
  });

  it.each(SHELL_SOLIDS)('%s: every face is planar', (solid) => {
    const faces = shellToFaces(shell({ solid, frequency: 2 }));
    for (const f of faces) {
      const pts = distinctCorners(f);
      const n = faceNormal(f), c = faceCenter(f);
      for (const p of pts) {
        expect(Math.abs((p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2])).toBeLessThan(1e-9);
      }
    }
  });

  it.each(SHELL_SOLIDS)('%s: every outNormal points away from the center', (solid) => {
    const center = { x: 4, y: 0, z: 1 };
    const faces = shellToFaces(shell({ solid, center, frequency: 2 }));
    for (const f of faces) {
      const c = faceCenter(f), n = f.outNormal;
      expect((c[0] - 4) * n[0] + (c[1] - 0) * n[1] + (c[2] - 1) * n[2]).toBeGreaterThan(0);
    }
  });

  it.each(SHELL_SOLIDS)('%s: corner winding agrees with the authored outNormal', (solid) => {
    const faces = shellToFaces(shell({ solid, frequency: 2 }));
    for (const f of faces) {
      // faceNormal recomputes from the winding when outNormal is stripped; the two must agree.
      const fromWinding = faceNormal({ corners: f.corners });
      expect(fromWinding[0] * f.outNormal[0] + fromWinding[1] * f.outNormal[1] + fromWinding[2] * f.outNormal[2]).toBeGreaterThan(0.999);
    }
  });

  it('emits the sibling face-record shape (corners / hex fill / doubleSided / outNormal)', () => {
    const faces = shellToFaces(shell({ solid: 'dodecahedron' }));
    for (const f of faces) {
      expect(f.corners.every(finiteVec)).toBe(true);
      expect(isHex(f.fill)).toBe(true);
      expect(f.doubleSided).toBe(true);
      expect(finiteVec(f.outNormal)).toBe(true);
    }
  });

  it('lowers through faceListToMesh like any other monomer', () => {
    const mesh = faceListToMesh(shellToFaces(shell({ solid: 'truncated_icosahedron' })));
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
  });
});

describe('shellToFaces — geodesic', () => {
  it.each([[1, 20], [2, 80], [3, 180], [4, 320]])('frequency %i → %i triangles', (frequency, count) => {
    const faces = shellToFaces(shell({ solid: 'geodesic', frequency }));
    expect(faces).toHaveLength(count);
    expect(shellFaceCount({ solid: 'geodesic', frequency })).toBe(count);
    expect(faces.every((f) => faceSides(f) === 3)).toBe(true);
  });

  it('frequency 1 is the icosahedron', () => {
    const geo = shellToFaces(shell({ solid: 'geodesic', frequency: 1 }));
    const ico = shellToFaces(shell({ solid: 'icosahedron' }));
    expect(geo).toHaveLength(ico.length);
  });

  it('defaults to frequency 1', () => {
    expect(shellToFaces(shell({ solid: 'geodesic' }))).toHaveLength(20);
  });
});

describe('shellToFaces — placement and identity', () => {
  it('center translates and radius scales', () => {
    const faces = shellToFaces(shell({ solid: 'octahedron', radius: 5, center: { x: 10, y: 0, z: 0 } }));
    const centers = faces.map(faceCenter);
    expect(Math.min(...centers.map((c) => c[0]))).toBeGreaterThan(10 - 5);
    expect(Math.max(...centers.map((c) => c[0]))).toBeLessThan(10 + 5);
  });

  it('orient rotates the solid but not its size', () => {
    const flat = shellToFaces(shell({ solid: 'cube' }));
    const turned = shellToFaces(shell({ solid: 'cube', orient: [0, 0, 45] }));
    expect(turned).toHaveLength(flat.length);
    expect(JSON.stringify(turned)).not.toBe(JSON.stringify(flat));
    for (const f of turned) for (const p of distinctCorners(f)) expect(Math.hypot(...p)).toBeCloseTo(2, 9);
  });

  it('faceId is stable and unique, and seeded by the monomer index', () => {
    const a = shellToFaces(shell({ solid: 'dodecahedron' }));
    const b = shellToFaces(shell({ solid: 'dodecahedron' }), { index: 3 });
    expect(a.map((f) => f.faceId)).toEqual(a.map((_, i) => `0:${i}`));
    expect(b.map((f) => f.faceId)).toEqual(b.map((_, i) => `3:${i}`));
    expect(new Set(a.map((f) => f.faceId)).size).toBe(a.length);
  });

  it('is deterministic — the same spec re-renders byte-identical', () => {
    const spec = shell({ solid: 'truncated_icosahedron', radius: 2.5, center: { x: 1, y: 1, z: 1 }, orient: [10, 20, 30] });
    expect(JSON.stringify(shellToFaces(spec))).toBe(JSON.stringify(shellToFaces(spec)));
  });

  it('tags a group, defaulting to shell', () => {
    expect(shellToFaces(shell()).every((f) => f.group === 'shell')).toBe(true);
    expect(shellToFaces(shell({ group: 'dome' })).every((f) => f.group === 'dome')).toBe(true);
  });

  it('a material tints the faces and rides the spec/pbr channels', () => {
    const plain = shellToFaces(shell({ solid: 'cube' }));
    const gold = shellToFaces(shell({ solid: 'cube', material: 'gold' }));
    expect(gold.map((f) => f.fill)).not.toEqual(plain.map((f) => f.fill));
    expect(gold.every((f) => Array.isArray(f.pbr))).toBe(true);
  });
});

describe('shellToFaces — open (cutaway)', () => {
  it('drops the selected faces', () => {
    const closed = shellToFaces(shell({ solid: 'cube' }));
    const dome = shellToFaces(shell({ solid: 'cube', open: { facing: '-z' } }));
    expect(closed).toHaveLength(6);
    expect(dome).toHaveLength(5);
    expect(dome.some((f) => f.outNormal[2] < -0.9)).toBe(false);
  });

  it('survivors keep the faceIds they had on the closed solid', () => {
    const closed = shellToFaces(shell({ solid: 'cube' }));
    const cut = shellToFaces(shell({ solid: 'cube', open: { facing: '+z' } }));
    const dropped = closed.find((f) => f.outNormal[2] > 0.9).faceId;
    expect(cut.map((f) => f.faceId)).toEqual(closed.map((f) => f.faceId).filter((id) => id !== dropped));
  });

  it('an open selector matching nothing leaves the shell closed', () => {
    expect(shellToFaces(shell({ solid: 'cube', open: { sides: 7 } }))).toHaveLength(6);
  });
});

describe('validateShells', () => {
  const ok = (spec) => validateShells([spec]);

  it('accepts a well-formed shell', () => {
    expect(ok({ solid: 'icosahedron', radius: 2 })).toEqual([]);
    expect(ok({ solid: 'geodesic', radius: 1, frequency: 3, center: { x: 0, y: 0, z: 1 }, orient: [0, 0, 30], open: { ring: 'bottom' } })).toEqual([]);
  });

  it('an unknown solid lists the solids', () => {
    expect(ok({ solid: 'soccerball', radius: 1 })[0]).toMatch(new RegExp(SHELL_SOLIDS.join(', ')));
  });

  it('a missing solid is refused as required', () => {
    expect(ok({ radius: 1 })[0]).toMatch(/required/);
  });

  it('radius must be positive', () => {
    expect(ok({ solid: 'cube' })[0]).toMatch(/radius/);
    expect(ok({ solid: 'cube', radius: 0 })[0]).toMatch(/radius/);
    expect(ok({ solid: 'cube', radius: -2 })[0]).toMatch(/radius/);
  });

  it('frequency belongs to geodesic and is capped', () => {
    expect(ok({ solid: 'cube', radius: 1, frequency: 2 })[0]).toMatch(/only applies to solid:'geodesic'/);
    expect(ok({ solid: 'geodesic', radius: 1, frequency: 0 })[0]).toMatch(/≥ 1/);
    expect(ok({ solid: 'geodesic', radius: 1, frequency: MAX_GEODESIC_FREQUENCY + 1 })[0]).toMatch(/exceeds/);
    expect(ok({ solid: 'geodesic', radius: 1, frequency: MAX_GEODESIC_FREQUENCY })).toEqual([]);
  });

  it('malformed center / orient / group are refused', () => {
    expect(ok({ solid: 'cube', radius: 1, center: [0, 0, 0] })[0]).toMatch(/center/);
    expect(ok({ solid: 'cube', radius: 1, orient: [0, 0] })[0]).toMatch(/orient/);
    expect(ok({ solid: 'cube', radius: 1, group: 7 })[0]).toMatch(/group/);
  });

  it('a bad open selector is caught at validation, not at render', () => {
    expect(ok({ solid: 'cube', radius: 1, open: { facing: 'up' } })[0]).toMatch(/^shells\[0\]\.open: /);
  });

  it('indexes errors by position and tolerates a non-array', () => {
    expect(validateShells([{ solid: 'cube', radius: 1 }, { solid: 'nope', radius: 1 }])[0]).toMatch(/^shells\[1\]/);
    expect(validateShells(undefined)).toEqual([]);
  });
});
