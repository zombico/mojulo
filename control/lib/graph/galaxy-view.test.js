import { describe, expect, it } from 'vitest';

import { planGalaxyScene, assembleGalaxyScene, GALAXY_SCENARIOS, GALAXY_FRAG } from './galaxy-view.js';
import { emitThreeWorld } from './scene-three.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

describe('planGalaxyScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planGalaxyScene({ kind: 'galaxy-view', scenario: 'oblique' });
    const b = planGalaxyScene({ kind: 'galaxy-view', scenario: 'oblique' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to oblique on an unknown scenario', () => {
    expect(planGalaxyScene({ kind: 'galaxy-view', scenario: 'quasar' }).stats.scenario).toBe('oblique');
  });

  it('produces a raymarch payload carrying the volume shader + structure uniforms + camera', () => {
    const plan = planGalaxyScene({ kind: 'galaxy-view', scenario: 'oblique' });
    expect(plan.raymarch.frag).toBe(GALAXY_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uRmax');
    expect(plan.raymarch.customUniforms).toHaveProperty('uPitchT');
    expect(plan.raymarch.customUniforms).toHaveProperty('uExposure');
    expect(plan.raymarch.cameraStart.length).toBe(3);
    expect(plan.raymarch.readout.length).toBeGreaterThan(3);
  });
});

describe('galaxy-view — volumetric physics in the shader (not brightness vomit)', () => {
  it('integrates emission/absorption front-to-back, with dust that occludes & reddens', () => {
    expect(GALAXY_FRAG).toContain('col += trans * emis * dt');        // emission through transmittance
    expect(GALAXY_FRAG).toContain('trans *= exp(-dust * dt * vec3(2.2, 1.5, 0.9)');  // wavelength-dependent extinction
  });

  it('tone-maps ONCE (ACES) — no stacked additive bloom', () => {
    expect(GALAXY_FRAG).toContain('aces(');
    expect(GALAXY_FRAG).toContain('col *= uExposure');               // expose once, before the map
  });

  it('shapes the field with logarithmic arms + a bar (structurally honest)', () => {
    expect(GALAXY_FRAG).toContain('log(max(r');                       // logarithmic spiral winding
    expect(GALAXY_FRAG).toContain('uBarLen');                         // central bar
  });

  it('the edge-on preset views nearer the disk plane than the face-on preset', () => {
    const face = planGalaxyScene({ kind: 'galaxy-view', scenario: 'face-on' }).stats.inclination;
    const edge = planGalaxyScene({ kind: 'galaxy-view', scenario: 'edge-on' }).stats.inclination;
    expect(edge).toBeGreaterThan(face);
  });

  it('the inclination knob lowers the camera toward the disk plane as it approaches edge-on', () => {
    const faceOn = planGalaxyScene({ kind: 'galaxy-view', inclination: 5 }).raymarch.cameraStart[1];
    const edgeOn = planGalaxyScene({ kind: 'galaxy-view', inclination: 85 }).raymarch.cameraStart[1];
    expect(faceOn).toBeGreaterThan(edgeOn);   // face-on sits high above the plane; edge-on drops into it
  });
});

describe('galaxy-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen shader World for a raymarch payload', () => {
    const html = emitThreeWorld({ ...assembleGalaxyScene({ kind: 'galaxy-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uCamBasis');
    expect(html).toContain('OrbitControls');
    expect(html).not.toContain('GROUPS =');   // no mesh pipeline
  });

  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'galaxy-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the three looks', () => {
    expect(GALAXY_SCENARIOS).toEqual(['oblique', 'face-on', 'edge-on']);
  });
});
