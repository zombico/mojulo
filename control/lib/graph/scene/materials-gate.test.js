/**
 * materials-gate (interchange-next N5): the file's own shading declaration is
 * the expectation the engine probes are compared against.
 */
import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { compareShading, declaredShading, sumDeclared } from './materials-gate.js';

const q = (x, y, z, extra = {}) => ({ corners: [[x, y, z], [x + 2, y, z], [x + 2, y + 2, z], [x, y + 2, z]], fill: '#8899aa', outNormal: [0, 0, 1], ...extra });
const payload = { faces: [q(0, 0, 0), q(3, 0, 0, { group: 'asset:chair' })] };

describe('declaredShading', () => {
  it('reads an unlit export as unlit on every primitive', () => {
    const d = declaredShading(facesToGlb(payload).bytes);
    expect(d.primitives).toBeGreaterThan(0);
    expect(d.unlit_primitives).toBe(d.primitives);
    expect(d.pbr_primitives).toBe(0);
    expect(d.unlit_materials).toBe(d.materials);
    expect(d.lights).toBe(0);
  });
  it('reads a lit export as PBR on every surface material', () => {
    const d = declaredShading(facesToGlb(payload, { lit: true }).bytes);
    expect(d.pbr_primitives).toBe(d.primitives);
    expect(d.unlit_primitives).toBe(0);
  });
  it('sums across files and rejects a non-GLB', () => {
    const a = declaredShading(facesToGlb(payload).bytes);
    const s = sumDeclared([a, a]);
    expect(s.primitives).toBe(a.primitives * 2);
    expect(() => declaredShading(Buffer.from('nope'))).toThrow(/GLB/);
  });
});

describe('compareShading', () => {
  const declared = { primitives: 16, unlit_primitives: 15, pbr_primitives: 1, materials: 16, unlit_materials: 15, pbr_materials: 1, lights: 9 };
  it('passes when the importer built exactly what the file says (per primitive)', () => {
    const r = compareShading({ declared, built: { surfaces: 16, unshaded: 15, shaded: 1, lights: 9 } });
    expect(r.ok).toBe(true);
    expect(r.checks.lights_as_declared.ok).toBe(true);
  });
  it('fails on a shading drift and names the two numbers', () => {
    const r = compareShading({ declared, built: { surfaces: 16, unshaded: 16, shaded: 0, lights: 9 } });
    expect(r.ok).toBe(false);
    expect(r.checks.shaded_as_declared).toMatchObject({ expected: 1, got: 0, ok: false });
  });
  it('compares per material for glTFast and leaves lights null when the file has none', () => {
    const r = compareShading({ declared: { ...declared, lights: 0 }, built: { materials: 16, unlit: 15, lit: 1, lights: 0 }, unit: 'materials' });
    expect(r.ok).toBe(true);
    expect(r.checks.lights_as_declared.ok).toBeNull();
  });
});
