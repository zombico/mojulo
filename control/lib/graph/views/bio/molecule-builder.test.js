import { describe, expect, it } from 'vitest';
import { buildMoleculeGeometry, resolveMoleculeRecipe, MOLECULE_NAMES } from './molecule-builder.js';

// angle (degrees) at atom b between a–b and c–b, from a built geometry.
function angleDeg(atoms, a, b, c) {
  const pa = atoms[a].pos, pb = atoms[b].pos, pc = atoms[c].pos;
  const u = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]];
  const v = [pc[0] - pb[0], pc[1] - pb[1], pc[2] - pb[2]];
  const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v));
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}
const dist = (atoms, a, b) => Math.hypot(...atoms[a].pos.map((v, i) => v - atoms[b].pos[i]));

describe('buildMoleculeGeometry — VSEPR shapes', () => {
  it('water is bent (~tetrahedral H–O–H), not linear', () => {
    const { atoms } = buildMoleculeGeometry({ atoms: ['O', 'H', 'H'], bonds: [[0, 1], [0, 2]] });
    expect(angleDeg(atoms, 1, 0, 2)).toBeGreaterThan(100);
    expect(angleDeg(atoms, 1, 0, 2)).toBeLessThan(115);
  });

  it('methane is tetrahedral (all H–C–H ≈ 109.5°)', () => {
    const { atoms } = buildMoleculeGeometry({ atoms: ['C', 'H', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] });
    for (const [i, j] of [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]) {
      expect(Math.abs(angleDeg(atoms, i, 0, j) - 109.47)).toBeLessThan(1);
    }
  });

  it('ammonia is pyramidal (H–N–H ≈ 109.5°, not 120°)', () => {
    const { atoms } = buildMoleculeGeometry({ atoms: ['N', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3]] });
    expect(Math.abs(angleDeg(atoms, 1, 0, 2) - 109.47)).toBeLessThan(1.5);
  });

  it('CO2 is linear (O=C=O ≈ 180°)', () => {
    const { atoms } = buildMoleculeGeometry({ atoms: ['C', 'O', 'O'], bonds: [[0, 1, 2], [0, 2, 2]] });
    expect(angleDeg(atoms, 1, 0, 2)).toBeGreaterThan(179);
  });

  it('shortens multiple bonds (C=O < C–O baseline)', () => {
    const single = buildMoleculeGeometry({ atoms: ['C', 'O'], bonds: [[0, 1, 1]] });
    const dbl = buildMoleculeGeometry({ atoms: ['C', 'O'], bonds: [[0, 1, 2]] });
    expect(dist(dbl.atoms, 0, 1)).toBeLessThan(dist(single.atoms, 0, 1));
  });

  it('ethylene is planar (all six atoms coplanar)', () => {
    const { atoms } = buildMoleculeGeometry({
      atoms: ['C', 'C', 'H', 'H', 'H', 'H'], bonds: [[0, 1, 2], [0, 2], [0, 3], [1, 4], [1, 5]],
    });
    // plane through C0 with normal from two of its bonds; every atom must lie on it.
    const p0 = atoms[0].pos;
    const e1 = atoms[2].pos.map((v, i) => v - p0[i]);  // C0→H
    const e2 = atoms[1].pos.map((v, i) => v - p0[i]);  // C0→C1
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nl = Math.hypot(...nrm);
    for (const a of atoms) {
      const d = Math.abs((a.pos[0] - p0[0]) * nrm[0] + (a.pos[1] - p0[1]) * nrm[1] + (a.pos[2] - p0[2]) * nrm[2]) / nl;
      expect(d).toBeLessThan(1e-6);
    }
  });

  it('is deterministic — same connectivity yields identical coordinates', () => {
    const a = buildMoleculeGeometry({ atoms: ['C', 'H', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] });
    const b = buildMoleculeGeometry({ atoms: ['C', 'H', 'H', 'H', 'H'], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] });
    expect(JSON.stringify(a.atoms)).toBe(JSON.stringify(b.atoms));
  });

  it('closes a ring (benzene carbons form a regular planar hexagon)', () => {
    const { atoms, warnings } = buildMoleculeGeometry({
      atoms: ['C', 'C', 'C', 'C', 'C', 'C'],
      bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1]],
    });
    expect(warnings).toHaveLength(0);                       // ring is placed, not flagged
    const zs = atoms.map((a) => a.pos[2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1e-6); // coplanar
    // every C–C ring bond is the same length (regular hexagon).
    const d = (i, j) => Math.hypot(...atoms[i].pos.map((v, k) => v - atoms[j].pos[k]));
    const lens = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]].map(([i, j]) => d(i, j));
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThan(1e-3);
  });

  it('places a saturated 6-ring (cyclohexane, sp³) as a non-planar chair', () => {
    const { atoms } = buildMoleculeGeometry({
      atoms: ['C', 'C', 'C', 'C', 'C', 'C', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'],
      bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
        [0, 6], [0, 7], [1, 8], [1, 9], [2, 10], [2, 11], [3, 12], [3, 13], [4, 14], [4, 15], [5, 16], [5, 17]],
    });
    const ringZ = atoms.slice(0, 6).map((a) => a.pos[2]);  // the 6 ring carbons pucker
    expect(Math.max(...ringZ) - Math.min(...ringZ)).toBeGreaterThan(0.3);
  });

  it('builds a fused bicyclic (naphthalene) coplanar with all 10 carbons placed', () => {
    const C = Array(10).fill('C');
    const { atoms, warnings } = buildMoleculeGeometry({
      atoms: C,
      bonds: [[0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 1], [5, 6, 2], [6, 7, 1], [7, 8, 2], [8, 9, 1], [9, 0, 1], [4, 9, 2]],
    });
    expect(warnings).toHaveLength(0);
    expect(atoms.every((a) => Number.isFinite(a.pos[0]))).toBe(true);
    const zs = atoms.map((a) => a.pos[2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1e-6);
  });
});

describe('resolveMoleculeRecipe — the molecule-view seam', () => {
  it('library name expands to atoms with positions', () => {
    const r = resolveMoleculeRecipe({ kind: 'molecule-view', library: 'water' });
    expect(r.atoms).toHaveLength(3);
    expect(r.atoms.every((a) => Array.isArray(a.pos))).toBe(true);
    expect(r.library).toBeUndefined(); // consumed
  });

  it('connectivity (symbol atoms, no pos) gets built', () => {
    const r = resolveMoleculeRecipe({ kind: 'molecule-view', atoms: ['O', 'H', 'H'], bonds: [[0, 1], [0, 2]] });
    expect(r.atoms.every((a) => Array.isArray(a.pos))).toBe(true);
  });

  it('explicit-coordinate recipes pass through unchanged', () => {
    const recipe = { kind: 'molecule-view', atoms: [{ symbol: 'O', pos: [0, 0, 0] }, { symbol: 'H', pos: [1, 0, 0] }], bonds: [{ from: 0, to: 1 }] };
    expect(resolveMoleculeRecipe(recipe)).toBe(recipe);
  });

  it('rejects an unknown library name', () => {
    expect(() => resolveMoleculeRecipe({ library: 'unobtanium' })).toThrow(/unknown molecule library/);
  });

  it('every library entry resolves to positioned atoms', () => {
    for (const name of MOLECULE_NAMES) {
      const r = resolveMoleculeRecipe({ library: name });
      expect(r.atoms.length, name).toBeGreaterThan(0);
      expect(r.atoms.every((a) => Array.isArray(a.pos)), name).toBe(true);
    }
  });
});
