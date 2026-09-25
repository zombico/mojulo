import { describe, expect, it } from 'vitest';

import { layeredExposure } from './station-loft-exposure.js';
import { compileLayered } from './station-loft.js';
import { expandPlan, PLAN_SCHEMA } from './station-loft-plan.js';
import { rasterDepth, rasterMask, viewCamera, viewAzimuth, LAYERED_VIEW_AZ } from '../scene/depth-raster.js';

// a biped leg with two claws on the shin: one grows OUT of the surface, one is pointed INTO the shin (buried)
const recipe = expandPlan({
  schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y' },
  joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05] },
  segments: [
    { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24] }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, mirror: 'plane' },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.14, rB: 0.1, mirror: 'name' },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.1, rB: [0.08, 0.04], over: [0.6, 0.3], mirror: 'name' },
  ],
  details: [
    // the shin's axis passes (0.22, 0.19, 0.3) with a ~0.09 radius: the spur starts on its front skin and points forward; the
    // hidden claw starts just under that skin and points into the axis
    { name: 'spurR', kind: 'claw', base: [0.22, 0.27, 0.3], dir: [0, 1, 0.1], length: 0.15, radius: 0.02, pin: { parent: 'shinR', face: 'shinR/st1-st2.k0.b', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['shinR/st1.front', 'shinR/st2.front'], handedness: 1 }, mirror: 'spurL' },
    { name: 'hiddenR', kind: 'claw', base: [0.22, 0.25, 0.3], dir: [0, -1, 0], length: 0.05, radius: 0.012, pin: { parent: 'shinR', face: 'shinR/st1-st2.k0.b', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['shinR/st1.front', 'shinR/st2.front'], handedness: 1 }, mirror: 'hiddenL' },
  ],
});
const mesh = compileLayered(recipe);

describe('depth-raster — the z-buffer eye', () => {
  it('named views map to azimuths; the raster covers the solid, keeps the nearest face and frames the whole source', () => {
    expect(viewAzimuth('frontal')).toBe(180); expect(viewAzimuth('three-quarter-left')).toBe(210); expect(viewAzimuth(37)).toBe(37); expect(() => viewAzimuth('above')).toThrow(/unknown view/);
    const source = { vertices: mesh.vertices, faces: mesh.faces };
    for (const view of Object.keys(LAYERED_VIEW_AZ)) {
      const r = rasterDepth(source, viewCamera(source, view), 128);
      expect(r.covered).toBeGreaterThan(500); expect(r.bbox[0]).toBeGreaterThan(0); expect(r.bbox[2]).toBeLessThan(127); expect(r.bbox[1]).toBeGreaterThan(0); expect(r.bbox[3]).toBeLessThan(127);
      const m = rasterMask(r); expect(m.reduce((s, x) => s + x, 0)).toBe(r.covered);
      for (let k = 0; k < r.face.length; k++) if (r.face[k] >= 0) expect(Number.isFinite(r.depth[k])).toBe(true);
    }
    // frontal and back see the same silhouette width (a mirror-symmetric body); the flatter side view covers less
    const r = (view) => rasterDepth(source, viewCamera(source, view), 128); const w = (x) => x.bbox[2] - x.bbox[0];
    expect(Math.abs(w(r('frontal')) - w(r('back')))).toBeLessThanOrEqual(2); expect(r('lateral').covered).toBeLessThan(r('frontal').covered);
  });
});

describe('station-loft-exposure — the exposure ledger', () => {
  it('a spur that grows out of the shin reads; a claw pointed into it is buried; the mirrored pair agrees; deterministic', () => {
    const e = layeredExposure(mesh, { res: 384 });
    expect(Object.keys(e.parts).sort()).toEqual(['hiddenL', 'hiddenR', 'spurL', 'spurR']);
    expect(e.parts.spurR.flag).toBe('reads'); expect(e.parts.spurL.flag).toBe('reads'); expect(e.parts.spurR.exposed).toBeGreaterThan(0.5);
    expect(e.parts.hiddenR.flag).toBe('buried'); expect(e.parts.hiddenL.flag).toBe('buried'); expect(e.buried.sort()).toEqual(['hiddenL', 'hiddenR']);
    expect(Math.abs(e.parts.spurR.exposed - e.parts.spurL.exposed)).toBeLessThan(0.15);   // each side is seen from its own views
    expect(e.parts.spurR.visible.frontal).toBeGreaterThan(0.9); expect(e.parts.spurR.visible.back).toBeLessThan(0.2);   // it points at the front camera; the shin hides it from behind
    for (const v of Object.values(e.parts.hiddenR.visible)) expect(v).toBeLessThan(0.05);
    expect(e.flags).toEqual({ reads: 2, faint: 0, buried: 2 });
    expect(JSON.stringify(layeredExposure(mesh, { res: 384 }))).toBe(JSON.stringify(e));
  });
  it('a custom view list (azimuths in degrees) and a raster size are honoured; L1 parts are not in the ledger', () => {
    const e = layeredExposure(mesh, { views: [90, 'frontal'], res: 128 });
    expect(e.views).toEqual(['90', 'frontal']); expect(e.res).toBe(128); expect(Object.keys(e.parts.spurR.visible)).toEqual(['90', 'frontal']);
    expect(e.parts.torso).toBeUndefined(); expect(e.covered.frontal).toBeGreaterThan(100);
  });
});
