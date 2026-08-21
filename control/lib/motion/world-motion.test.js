import { describe, it, expect } from 'vitest';

import { deriveBaseShot, WORLD_MOTION_NAMES } from './world-motion.js';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';

describe('motion/world-motion — deriveBaseShot', () => {
  it('prefers the world\'s first authored camera bookmark', () => {
    const payload = {
      cameras: [{ worldFraming: { cameraPosition: [10, -20, 8], lookAt: [0, 0, 3], horizontalFov: 38 } }],
      faces: [],
    };
    expect(deriveBaseShot(payload)).toEqual({
      cameraPosition: [10, -20, 8],
      lookAt: [0, 0, 3],
      horizontalFov: 38,
    });
  });

  it('falls back to a bounds-derived 3/4 orbit when no camera ships', () => {
    // a unit cube centred at the origin (corners 0..1 on each axis → centre 0.5)
    const corners = [];
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) corners.push([x, y, z]);
    const payload = { cameras: [], faces: [{ corners }] };
    const base = deriveBaseShot(payload);
    expect(base.lookAt).toEqual([0.5, 0.5, 0.5]); // bbox centre
    // camera sits off to +x / −y / +z of the centre (the 3/4 orbit vantage)
    expect(base.cameraPosition[0]).toBeGreaterThan(0.5);
    expect(base.cameraPosition[1]).toBeLessThan(0.5);
    expect(base.cameraPosition[2]).toBeGreaterThan(0.5);
    expect(base.horizontalFov).toBe(55);
  });

  it('exposes exactly the camera motions (no deck/effect names)', () => {
    expect(WORLD_MOTION_NAMES).toEqual(['turntable', 'orbit', 'push_in', 'dolly_zoom', 'flythrough']);
  });
});

describe('scene-three — capture-mode emission', () => {
  const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: [0.5, 0.5, 0.5] }];

  it('capture:true publishes the __mojCapture.frame bridge and skips the rAF loop', () => {
    const html = emitThreeWorld({ faces, capture: true });
    expect(html).toContain('window.__mojCapture');
    expect(html).toContain('frame(spec)');
    expect(html).toContain('const _capture = true;');
    // the capture branch renders on demand, NOT via the live animation loop
    expect(html).toMatch(/if \(_capture\)/);
  });

  it('default (no capture) gates the bridge off and keeps the live animation loop', () => {
    const html = emitThreeWorld({ faces });
    // the bridge code is always present but runtime-gated (same pattern as ?t freeze);
    // with _capture=false the if(_capture) branch never runs, so __mojCapture stays unset.
    expect(html).toContain('const _capture = false;');
    expect(html).toContain('setAnimationLoop');
  });

  it('the shared __mojStep helper drives every animated channel', () => {
    const html = emitThreeWorld({ faces });
    expect(html).toContain('function __mojStep(t)');
    for (const ch of ['stepTracers(t)', 'stepMovers(t)', 'stepFields(t)', 'stepSurfaces(t)', 'stepBuildups(t)', 'stepTransports(t)']) {
      expect(html).toContain(ch);
    }
  });
});
