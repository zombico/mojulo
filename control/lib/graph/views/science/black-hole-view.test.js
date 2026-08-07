import { describe, expect, it } from 'vitest';

import { planBlackHoleScene, assembleBlackHoleScene, BLACK_HOLE_SCENARIOS, BLACK_HOLE_FRAG } from './black-hole-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('planBlackHoleScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planBlackHoleScene({ kind: 'black-hole-view', scenario: 'interstellar' });
    const b = planBlackHoleScene({ kind: 'black-hole-view', scenario: 'interstellar' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to interstellar on an unknown scenario', () => {
    expect(planBlackHoleScene({ kind: 'black-hole-view', scenario: 'wormhole' }).stats.scenario).toBe('interstellar');
  });

  it('produces a raymarch payload carrying the GR geodesic shader + disk uniforms + camera', () => {
    const plan = planBlackHoleScene({ kind: 'black-hole-view', scenario: 'interstellar' });
    expect(plan.raymarch.frag).toBe(BLACK_HOLE_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uDiskIn');
    expect(plan.raymarch.customUniforms).toHaveProperty('uBeta');
    expect(plan.raymarch.cameraStart.length).toBe(3);
    expect(plan.raymarch.readout.length).toBeGreaterThan(3);
  });
});

describe('black-hole-view — contemporary physics in the shader', () => {
  it('the shader integrates the Schwarzschild null geodesic (exact light bending)', () => {
    expect(BLACK_HOLE_FRAG).toContain('-1.5 * h2 * pos');        // d²r/dλ² = −1.5 h² r̂ / r⁵
    expect(BLACK_HOLE_FRAG).toContain('cross(pos, vel)');        // conserved angular momentum
  });

  it('captures rays inside the horizon (the shadow) and beams the disk (Doppler)', () => {
    expect(BLACK_HOLE_FRAG).toContain('if (r < 1.0)');           // horizon capture → black
    expect(BLACK_HOLE_FRAG).toContain('pow(g, 3.0)');            // relativistic beaming (g = doppler·redshift)
  });

  it('combines Doppler beaming with GRAVITATIONAL REDSHIFT (g = dopp · √(1−Rs/r))', () => {
    expect(BLACK_HOLE_FRAG).toContain('sqrt(max(0.0, 1.0 - 1.0 / rr))');   // gravitational redshift factor
    expect(BLACK_HOLE_FRAG).toContain('float g = dopp * grav');            // total frequency ratio
  });

  it('the accretion disk is SEMI-TRANSPARENT — lensed images layer (emission + absorption)', () => {
    expect(BLACK_HOLE_FRAG).toContain('vec4 diskEmission');      // emission + opacity, not an opaque return
    expect(BLACK_HOLE_FRAG).toContain('trans *= (1.0 - em.a)');  // absorb what's behind → layering
  });

  it('the background is a LENSED galaxy (sampled with the bent ray → warps around the shadow)', () => {
    expect(BLACK_HOLE_FRAG).toContain('vec3 galaxy(vec3 d)');
    expect(BLACK_HOLE_FRAG).toContain('galaxy(normalize(vel))');  // the post-bending direction
  });

  it('the geodesic march is ADAPTIVE (fine steps near the hole → crisp photon ring)', () => {
    expect(BLACK_HOLE_FRAG).toContain('clamp(0.035 * r, 0.05, 0.5)');
  });

  it('disk_outer and beta knobs override the preset disk size / orbital speed', () => {
    const a = planBlackHoleScene({ kind: 'black-hole-view', diskOut: 16, beta: 0.7 });
    expect(a.raymarch.customUniforms.uDiskOut).toBe(16);
    expect(a.raymarch.customUniforms.uBeta).toBe(0.7);
    expect(a.stats.diskOut).toBe(16);
  });

  it('the EHT preset views nearer to face-on than the Interstellar preset', () => {
    const inter = planBlackHoleScene({ kind: 'black-hole-view', scenario: 'interstellar' }).stats.inclination;
    const eht = planBlackHoleScene({ kind: 'black-hole-view', scenario: 'eht' }).stats.inclination;
    expect(eht).toBeGreaterThan(inter);
  });

  it('the inclination knob raises the camera above the disk plane', () => {
    const low = planBlackHoleScene({ kind: 'black-hole-view', inclination: 5 }).raymarch.cameraStart[1];
    const high = planBlackHoleScene({ kind: 'black-hole-view', inclination: 70 }).raymarch.cameraStart[1];
    expect(high).toBeGreaterThan(low);
  });
});

describe('black-hole-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen shader World for a raymarch payload', () => {
    const html = emitThreeWorld({ ...assembleBlackHoleScene({ kind: 'black-hole-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).toContain('OrbitControls');
    expect(html).not.toContain('GROUPS =');   // no mesh pipeline
  });

  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'black-hole-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('exposes the two looks', () => {
    expect(BLACK_HOLE_SCENARIOS).toEqual(['interstellar', 'eht']);
  });
});
