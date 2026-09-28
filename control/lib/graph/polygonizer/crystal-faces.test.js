import { describe, it, expect } from 'vitest';
import { crystalTermFaces, crystalPlacements, validateCrystalShape } from './crystal-faces.js';
import { fieldToFaces } from './field-faces.js';
import { FIELD_SHAPE_KINDS, shapeFromSpec, validateFieldTerms } from './field-terms.js';
import { exactSupport } from './field-exact-reach.js';
import { assembleWorkbenchScene } from '../worlds/workbench.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ruby = { id: 'heart', op: 'add', shape: { kind: 'crystal', gem: 'ruby', center: [0, 0, 1], size: 2 } };
const geodeLining = { id: 'lining', op: 'add', shape: { kind: 'crystal', gem: 'amethyst', size: 3, cluster: { count: 60, seed: 9, on: { ellipsoid: { center: [0, 0, 0], radii: [9.8, 8.8, 7.2], zMax: -0.4 } }, lengths: [0.8, 3.4] } } };

describe('the crystal field shape', () => {
  it('is a field kind, and validation teaches', () => {
    expect(FIELD_SHAPE_KINDS).toContain('crystal');
    expect(validateCrystalShape({ gem: 'jade', size: -1 }).join(' ')).toMatch(/gem: one of quartz.*size: the stone's longest extent.*center: \[x, y, z\]/);
    expect(validateCrystalShape(ruby.shape)).toEqual([]); expect(validateCrystalShape(geodeLining.shape)).toEqual([]);
    expect(validateFieldTerms([ruby], 'fields[0].terms')).toEqual([]);
  });
  it('one stone: exact faces (quads and triangles only), each tagged with its stone', () => {
    const f = crystalTermFaces(ruby); expect(f.length).toBeGreaterThanOrEqual(14);
    for (const q of f) { expect(q.corners.length).toBeLessThanOrEqual(4); expect(q.crystal).toMatchObject({ gem: 'ruby', stone: 'heart#0.0', cmu: 1 }); }
    expect(new Set(f.map((q) => q.crystal.stone)).size).toBe(1);
  });
  it('a cluster lines a cavity: stones below zMax, growing inward, many small and a few large', () => {
    const P = crystalPlacements(geodeLining.shape); expect(P.length).toBeGreaterThan(20); expect(P.length).toBeLessThanOrEqual(60);
    for (const p of P) { const c = p.R.map((r) => r[2]); const toCentre = [-p.center[0], -p.center[1], -p.center[2]]; expect(dot(c, toCentre)).toBeGreaterThan(0); }
    const sizes = P.map((p) => p.size).sort((a, b) => a - b); expect(sizes[Math.floor(sizes.length / 2)]).toBeLessThan((0.8 + 3.4) / 2);
  });
  it('fieldToFaces places crystals beside the field and polygonizes the rest', () => {
    const spec = { terms: [{ id: 'bed', op: 'add', shape: { kind: 'box', center: [0, 0, -0.5], size: [6, 6, 1] } }, ruby], cells: 24 };
    const faces = fieldToFaces(spec); const gems = faces.filter((f) => f.crystal), bed = faces.filter((f) => !f.crystal);
    expect(gems.length).toBeGreaterThan(0); expect(bed.length).toBeGreaterThan(0); expect(bed.every((f) => f.group === 'bed')).toBe(true);
    expect(fieldToFaces({ terms: [ruby] }).every((f) => f.crystal)).toBe(true);
  });
  it('as a term it bounds its stones; the exact kernel refuses it by name', () => {
    const t = shapeFromSpec(ruby.shape); expect(t.d({ x: 0, y: 0, z: 1 })).toBeLessThan(0); expect(t.d({ x: 0, y: 0, z: 9 })).toBeGreaterThan(0);
    expect(exactSupport([ruby]).why).toMatch(/already exact/);
  });
  it('a workbench geode reaches the World page with the crystal channel and prints', () => {
    const manifest = { kind: 'workbench', fields: [{ id: 'geode', cells: 40, terms: [
      { id: 'shell', op: 'add', shape: { kind: 'ellipsoid', center: [0, 0, 0], radii: [12, 10.8, 9] } },
      { id: 'cavity', op: 'subtract', shape: { kind: 'ellipsoid', center: [0, 0, 0], radii: [9.8, 8.8, 7.2] } },
      { id: 'open', op: 'subtract', shape: { kind: 'box', center: [0, 0, 10], size: [40, 40, 20] } }, geodeLining, { ...ruby, shape: { ...ruby.shape, center: [0, 0, -6] } }] }] };
    const payload = assembleWorkbenchScene(manifest); const cry = payload.faces.filter((f) => f.crystal);
    expect(new Set(cry.map((f) => f.crystal.gem))).toEqual(new Set(['amethyst', 'ruby']));
    const html = emitThreeWorld({ ...payload, hud: false });
    expect(html).toContain('crystal channel (crystal shine)'); expect(html).toContain('"gems":{"amethyst"');
  });
  it('no crystal term, no crystal bytes', () => {
    const spec = { terms: [{ id: 'bed', op: 'add', shape: { kind: 'box', center: [0, 0, 0], size: [2, 2, 2] } }], cells: 16 };
    expect(fieldToFaces(spec).some((f) => 'crystal' in f)).toBe(false);
    expect(emitThreeWorld({ faces: fieldToFaces(spec) })).not.toContain('crystal channel');
  });
});

describe('a cluster can clear a spot', () => {
  it('stones inside `avoid` are not placed; every other stone is where it was', () => {
    const shape = { kind: 'crystal', gem: 'amethyst', size: 1, cluster: { count: 60, seed: 4, on: { disc: { center: [0, 0, 0], radius: 5 } } } };
    const all = crystalPlacements(shape); const spot = { center: [1, 1, 0], radius: 2 };
    const some = crystalPlacements({ ...shape, cluster: { ...shape.cluster, avoid: [spot] } });
    const inside = all.filter((p) => Math.hypot(p.base[0] - 1, p.base[1] - 1, p.base[2]) < 2);
    expect(inside.length).toBeGreaterThan(0); expect(some).toHaveLength(all.length - inside.length);
    expect(JSON.stringify(some)).toBe(JSON.stringify(all.filter((p) => !inside.includes(p))));
    expect(validateCrystalShape({ ...shape, cluster: { ...shape.cluster, avoid: [{ center: [0, 0], radius: 1 }] } }).join()).toContain('avoid');
  });
});
