/**
 * Workbench material threading (material-response.plan.md P4) — the manifest-level
 * contract: a monomer spec's `material` reaches the generator (response curve in the
 * fills, `spec`/`pbr` face tags), assembly parts pass it through, the World payload
 * carries it, and a typo'd name fails LOUDLY at mint instead of silently steeling.
 */

import { describe, it, expect } from 'vitest';

import { lowerObjectFaces, planWorkbench, assembleWorkbenchScene } from './workbench.js';
import { lowerAssembly } from '../polygonizer/workbench-assembly.js';
import { MATERIALS } from '../polygonizer/materials.js';

const LATHE = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 0.5 }, { t: 1, radius: 0.4 }] };
const EXTRUDE = { profile: { rect: { w: 1, h: 1 } }, axisFrom: { x: 2, y: 0, z: 0 }, axisTo: { x: 2, y: 0, z: 1 } };
const SWEEP = { path: [[4, 0, 0], [4, 0, 1], [4.5, 0, 1.5]], radius: 0.1 };
const RELIEF = { shape: { path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z' }, size: 0.5, anchor: { x: 6, y: 0, z: 0.1 } };

describe('lowerObjectFaces material threading', () => {
  it('threads per-monomer material for all four monomer kinds', () => {
    const faces = lowerObjectFaces({
      lathes: [{ ...LATHE, material: 'gold' }],
      extrudes: [{ ...EXTRUDE, material: 'stone' }],
      sweeps: [{ ...SWEEP, material: 'chrome' }],
      reliefs: [{ ...RELIEF, material: 'bronze' }],
    });
    expect(faces.length).toBeGreaterThan(0);
    // every face carries spec + pbr (all four shelf rows have specular > 0)
    expect(faces.every((f) => Array.isArray(f.spec) && Array.isArray(f.pbr))).toBe(true);
    // the metal rows read metallic, stone does not
    const strengths = new Set(faces.map((f) => f.spec[0]));
    expect(strengths.has(MATERIALS.gold.specular)).toBe(true);
    expect(strengths.has(MATERIALS.stone.specular)).toBe(true);
    expect(faces.some((f) => f.pbr[0] === 1)).toBe(true);
    expect(faces.some((f) => f.pbr[0] === 0)).toBe(true);
  });

  it('identity: material-free manifests emit untagged faces', () => {
    const faces = lowerObjectFaces({ lathes: [LATHE], extrudes: [EXTRUDE], sweeps: [SWEEP], reliefs: [RELIEF] });
    expect(faces.every((f) => f.spec === undefined && f.pbr === undefined)).toBe(true);
  });

  it('material reshapes the baked fills (same tint, different response)', () => {
    const plain = lowerObjectFaces({ lathes: [{ ...LATHE, tint: '#c7d0da' }] });
    const steel = lowerObjectFaces({ lathes: [{ ...LATHE, tint: '#c7d0da', material: 'steel' }] });
    expect(steel.length).toBe(plain.length);
    expect(steel.map((f) => f.fill).join()).not.toBe(plain.map((f) => f.fill).join());
  });
});

describe('assembly + world payload + validation', () => {
  it('assembly parts pass material through to the lowered monomers', () => {
    const { lathes } = lowerAssembly({ parts: [{ kind: 'lathe', height: 1, profile: [{ t: 0, radius: 0.4 }, { t: 1, radius: 0.4 }], material: 'copper' }] });
    expect(lathes[0].material).toBe('copper');
  });

  it('the assembled World payload carries the spec faces', () => {
    const scene = assembleWorkbenchScene({ kind: 'workbench', lathes: [{ ...LATHE, material: 'gold' }] });
    expect(scene.faces.some((f) => Array.isArray(f.spec))).toBe(true);
  });

  it('planWorkbench rejects a typo instead of silently steeling it', () => {
    expect(() => planWorkbench({ lathes: [{ ...LATHE, material: 'golden' }] }))
      .toThrow(/unknown material 'golden'.*gold/s);
    // hex tints and preset-override objects still pass
    expect(() => planWorkbench({ lathes: [{ ...LATHE, material: '#c79a4b' }] })).not.toThrow();
    expect(() => planWorkbench({ lathes: [{ ...LATHE, material: { preset: 'chrome', shininess: 60 } }] })).not.toThrow();
    expect(() => planWorkbench({ sweeps: [{ ...SWEEP, material: { preset: 'nope' } }] })).toThrow(/unknown material preset 'nope'/);
  });
});
