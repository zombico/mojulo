// launch-falls-short.plan.md P2 — forgiving workbench specs: both point spellings render the
// same bytes, a canonical recipe keeps its identity, and plain-word materials resolve.

import { describe, expect, it } from 'vitest';

import { canonicalizeMonomers, lowerObjectFaces, planWorkbench } from './workbench.js';
import { MATERIALS, materialName, resolveMaterial, validateMaterialRef } from '../polygonizer/materials.js';

const BODY = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 9 }, profile: [{ t: 0, radius: 3.6 }, { t: 1, radius: 4 }], tint: '#b8342c', material: 'satin' };
const HANDLE = { path: [[3.8, 0, 2.2], [6.2, 0, 3.2], [6.6, 0, 5.2], [3.8, 0, 7.4]], radius: 0.6, tint: '#b8342c', material: 'satin' };
const CANON = { kind: 'workbench', units: 'cm', lathes: [BODY], sweeps: [HANDLE] };
const MIXED = {
  kind: 'workbench', units: 'cm',
  lathes: [{ ...BODY, axisFrom: [0, 0, 0], axisTo: [0, 0, 9] }],
  sweeps: [{ ...HANDLE, path: HANDLE.path.map(([x, y, z]) => ({ x, y, z })) }],
};

describe('canonicalizeMonomers', () => {
  it('is the identity on a canonical recipe (no copy, no byte change)', () => {
    expect(canonicalizeMonomers(CANON)).toBe(CANON);
    expect(canonicalizeMonomers(CANON).lathes).toBe(CANON.lathes);
  });
  it('turns object path points into arrays and array endpoints into objects', () => {
    const c = canonicalizeMonomers(MIXED);
    expect(c).not.toBe(MIXED);
    expect(c.sweeps[0].path).toEqual(HANDLE.path);
    expect(c.lathes[0].axisFrom).toEqual({ x: 0, y: 0, z: 0 });
    expect(c.lathes[0].axisTo).toEqual({ x: 0, y: 0, z: 9 });
    // untouched input
    expect(Array.isArray(MIXED.lathes[0].axisFrom)).toBe(true);
  });
  it('the mixed spelling mints and renders byte-identically to the canonical one', () => {
    const a = planWorkbench(CANON);
    const b = planWorkbench(MIXED);
    expect(b.stats.faces).toBe(a.stats.faces);
    expect(b.stats.size).toEqual(a.stats.size);
    expect(JSON.stringify(lowerObjectFaces(MIXED))).toBe(JSON.stringify(lowerObjectFaces(CANON)));
  });
  it('a bad point still refuses with the same message', () => {
    expect(() => planWorkbench({ kind: 'workbench', sweeps: [{ ...HANDLE, path: [[0, 0, 0], { x: 1, y: 'no', z: 0 }] }] })).toThrow(/path must be an array of >= 2 finite \[x,y,z\] points/);
  });
});

describe('material aliases', () => {
  it('plain words resolve to a shelf row and validate', () => {
    expect(materialName('ceramic')).toBe('satin');
    expect(materialName('Iron')).toBe('gunmetal');
    expect(resolveMaterial('ceramic')).toBe(MATERIALS.satin);
    expect(resolveMaterial({ preset: 'brass', base: '#ffcc00' }).specular).toBe(MATERIALS.bronze.specular);
    expect(validateMaterialRef('ceramic')).toBeNull();
    expect(validateMaterialRef({ preset: 'marble' })).toBeNull();
  });
  it('unknown names still refuse, and the refusal mentions the aliases', () => {
    expect(validateMaterialRef('golden')).toMatch(/unknown material 'golden'.*plain words like ceramic/s);
    expect(materialName('golden')).toBeNull();
  });
  it('an aliased mug mints', () => {
    const r = planWorkbench({ kind: 'workbench', units: 'cm', lathes: [{ ...BODY, material: 'ceramic' }] });
    expect(r.stats.faces).toBeGreaterThan(0);
  });
});
