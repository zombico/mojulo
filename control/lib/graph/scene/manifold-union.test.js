import { describe, expect, it } from 'vitest';

import { loadManifold, unionShells, shellsToInstances } from './manifold-union.js';
import { printableShells, applyTransform, facesToStl } from './scene-stl.js';
import { auditClosure } from '../polygonizer/face-closure.js';

// interchange-seams.plan.md seam 4a — Manifold CSG union of the printable shells.
// A closed box as six outward quads (TL,TR,BR,BL per face, CCW seen from outside).
function box(ox, oy, oz, s, fill) {
  const p = (x, y, z) => [ox + x * s, oy + y * s, oz + z * s];
  const q = (a, b, c, d) => ({ corners: [a, b, c, d], fill });
  return [
    q(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)), // bottom (−z)
    q(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)), // top (+z)
    q(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)), // −y
    q(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)), // +y
    q(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)), // −x
    q(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)), // +x
  ];
}

describe('manifold-union', () => {
  it('loads the optional module', async () => {
    const wasm = await loadManifold();
    expect(wasm).toBeTruthy();
    expect(typeof wasm.Manifold).toBe('function');
  });

  it('unions two overlapping closed boxes into one solid with the exact volume, colours kept', async () => {
    const faces = [...box(0, 0, 0, 1, '#ff0000'), ...box(0.5, 0, 0, 1, '#00ff00')];
    const shells = printableShells({ faces });
    const r = await unionShells(shellsToInstances(shells, applyTransform));
    expect(r.skipped).toBeUndefined();
    expect(r.stats.unioned).toBe(2); // one base shell, decomposed into its two closed components
    expect(r.stats.volume).toBeCloseTo(1.5, 5);
    expect(r.stats.genus).toBe(0);
    expect(r.stats.non_manifold).toEqual([]);
    expect(r.faces.length).toBe(r.stats.triangles);
    // the result is the standard currency: STL-able and closed
    const stl = facesToStl({ faces: r.faces });
    expect(stl.triangleCount).toBe(r.stats.triangles);
    expect(auditClosure(r.faces).holes).toEqual([]);
    const fills = new Set(r.faces.flatMap((f) => f.cornerFills || [f.fill]));
    expect(fills.has('#ff0000')).toBe(true);
    expect(fills.has('#00ff00')).toBe(true);
  });

  it('places repeat instances through the same transform the STL bakes', async () => {
    const shells = printableShells({ faces: [], repeats: [{ group: 'cubes', template: box(0, 0, 0, 1, '#888'), transforms: [{ pos: [0, 0, 0] }, { pos: [10, 0, 0], scale: 2 }] }] });
    const inst = shellsToInstances(shells, applyTransform);
    expect(inst.map((i) => i.name)).toEqual(['cubes:0', 'cubes:1']);
    const r = await unionShells(inst);
    expect(r.stats.unioned).toBe(2);
    expect(r.stats.volume).toBeCloseTo(1 + 8, 5); // disjoint: volumes add
  });

  it('reports a non-manifold shell by name and unions the rest', async () => {
    const open = { name: 'open', positions: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]), colors: null };
    const shells = printableShells({ faces: box(0, 0, 0, 1, '#888') });
    const r = await unionShells([...shellsToInstances(shells, applyTransform), open]);
    expect(r.stats.unioned).toBe(1);
    expect(r.stats.non_manifold).toEqual([{ name: 'open', error: expect.any(String) }]);
    expect(r.stats.volume).toBeCloseTo(1, 5);
  });

  it('skips with a reason when nothing is manifold', async () => {
    const open = { name: 'open', positions: Float32Array.from([0, 0, 0, 1, 0, 0, 1, 1, 0]), colors: null };
    const r = await unionShells([open]);
    expect(r.skipped).toBe(true);
    expect(r.reason).toContain('open');
  });
});
