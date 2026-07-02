import { describe, expect, it } from 'vitest';

import { planSaturnScene, assembleSaturnScene, SATURN_SCENARIOS, SATURN_PLANETS, SATURN_FRAG } from './saturn-view.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { sketchRenderMode, classifyBucket } from '../../sketch/sketch-manifest.js';

describe('planSaturnScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planSaturnScene({ kind: 'saturn-view', scenario: 'classic' });
    const b = planSaturnScene({ kind: 'saturn-view', scenario: 'classic' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to classic on an unknown scenario', () => {
    expect(planSaturnScene({ kind: 'saturn-view', scenario: 'jupiter' }).stats.scenario).toBe('classic');
  });

  it('produces a raymarch payload with the Saturn shader + ring/sun uniforms + camera', () => {
    const plan = planSaturnScene({ kind: 'saturn-view', scenario: 'classic' });
    expect(plan.raymarch.frag).toBe(SATURN_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uRingIn');
    expect(plan.raymarch.customUniforms).toHaveProperty('uRingOut');
    expect(Array.isArray(plan.raymarch.customUniforms.uSunDir)).toBe(true);   // a direction vector
    expect(plan.raymarch.cameraStart.length).toBe(3);
  });
});

describe('saturn-view — the shader physics that earns the shader path', () => {
  it('the rings cast a shadow on the planet (a shadow ray to the sun crossing the ring annulus)', () => {
    expect(SATURN_FRAG).toContain('float ringShadow(vec3 p, vec3 sun)');
    expect(SATURN_FRAG).toContain('ringShadow(hit, sun)');
  });

  it("the planet casts its shadow across the rings (the eclipse arc)", () => {
    expect(SATURN_FRAG).toContain('float planetShadow(vec3 p, vec3 sun)');
    expect(SATURN_FRAG).toContain('hitPlanet(p + sun');   // trace toward the sun, hit the globe?
  });

  it('the rings are semi-transparent — blended over the planet/space by opacity', () => {
    expect(SATURN_FRAG).toContain('mix(col, ringCol, ringOp)');
  });

  it('encodes the real ring structure (C / B / Cassini gap / A / Encke) + backlit forward scatter', () => {
    expect(SATURN_FRAG).toContain('void ringProps');
    expect(SATURN_FRAG).toContain('Cassini');
    expect(SATURN_FRAG).toContain('op * exp(-op * 2.6)');   // forward-scatter (B ring darkens, gaps brighten)
  });

  it('the globe is OBLATE (ray vs ellipsoid, not a sphere)', () => {
    expect(SATURN_FRAG).toContain('uOblate');
    expect(planSaturnScene({ kind: 'saturn-view' }).raymarch.customUniforms.uOblate).toBeLessThan(1);
  });

  it('the backlit preset flips uBacklit on; classic leaves it off', () => {
    expect(planSaturnScene({ kind: 'saturn-view', scenario: 'backlit' }).raymarch.customUniforms.uBacklit).toBe(1);
    expect(planSaturnScene({ kind: 'saturn-view', scenario: 'classic' }).raymarch.customUniforms.uBacklit).toBe(0);
  });

  it('the inclination knob opens the rings (raises the camera above the ring plane)', () => {
    const low = planSaturnScene({ kind: 'saturn-view', inclination: 5 }).raymarch.cameraStart[1];
    const high = planSaturnScene({ kind: 'saturn-view', inclination: 70 }).raymarch.cameraStart[1];
    expect(high).toBeGreaterThan(low);
  });
});

describe('saturn-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen Saturn shader World (no mesh pipeline)', () => {
    const html = emitThreeWorld({ ...assembleSaturnScene({ kind: 'saturn-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('ringProps');
    expect(html).not.toContain('GROUPS =');
  });

  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'saturn-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the three looks', () => {
    expect(SATURN_SCENARIOS).toEqual(['classic', 'backlit', 'polar']);
  });
});

describe('saturn-view — the giant-planet lineup (Jupiter / Saturn / Neptune / Uranus)', () => {
  it('exposes all eight planets in solar order and defaults to Saturn', () => {
    expect(SATURN_PLANETS).toEqual(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    expect(planSaturnScene({ kind: 'saturn-view' }).stats.planet).toBe('saturn');
    expect(planSaturnScene({ kind: 'saturn-view', planet: 'pluto' }).stats.planet).toBe('saturn');   // fallback
  });

  it('each planet selects its own ring system (uRingMode 1..4)', () => {
    const mode = (planet) => planSaturnScene({ kind: 'saturn-view', planet }).raymarch.customUniforms.uRingMode;
    expect(mode('saturn')).toBe(1);
    expect(mode('jupiter')).toBe(2);
    expect(mode('neptune')).toBe(3);
    expect(mode('uranus')).toBe(4);
  });

  it('Jupiter and Neptune carry a storm spot; Saturn and Uranus do not', () => {
    const spotSize = (planet) => planSaturnScene({ kind: 'saturn-view', planet }).raymarch.customUniforms.uSpot[2];
    expect(spotSize('jupiter')).toBeGreaterThan(0);   // Great Red Spot
    expect(spotSize('neptune')).toBeGreaterThan(0);   // Great Dark Spot
    expect(spotSize('saturn')).toBe(0);
    expect(spotSize('uranus')).toBe(0);
  });

  it('Uranus is tipped on its side (a large axial tilt → vertical rings); the others are upright', () => {
    expect(planSaturnScene({ kind: 'saturn-view', planet: 'uranus' }).raymarch.customUniforms.uTilt).toBeGreaterThan(1.0);
    expect(planSaturnScene({ kind: 'saturn-view', planet: 'saturn' }).raymarch.customUniforms.uTilt).toBeLessThan(0.2);
    expect(SATURN_FRAG).toContain('rotX(uCamPos, uTilt)');   // the body-frame tilt is applied in the shader
  });

  it('Neptune is blue, Jupiter is brown/cream (distinct band palettes)', () => {
    const nep = planSaturnScene({ kind: 'saturn-view', planet: 'neptune' }).raymarch.customUniforms.uBandA;
    const jup = planSaturnScene({ kind: 'saturn-view', planet: 'jupiter' }).raymarch.customUniforms.uBandA;
    expect(nep[2]).toBeGreaterThan(nep[0]);   // Neptune: blue channel dominant
    expect(jup[0]).toBeGreaterThan(jup[2]);   // Jupiter: red/brown channel dominant
  });

  it('the shader applies Neptune ring arcs (azimuthal clumping of the Adams ring)', () => {
    expect(SATURN_FRAG).toContain('Adams ring arcs');
  });
});

describe('saturn-view — the terrestrial planets (rocky / cloud / ocean, no rings)', () => {
  it('each terrestrial selects its surface type and has NO rings (uRingMode 0)', () => {
    const u = (planet) => planSaturnScene({ kind: 'saturn-view', planet }).raymarch.customUniforms;
    expect(u('mercury').uSurfType).toBe(1);   // rocky
    expect(u('venus').uSurfType).toBe(2);     // cloud
    expect(u('earth').uSurfType).toBe(3);     // ocean
    expect(u('mars').uSurfType).toBe(1);      // rocky
    for (const t of ['mercury', 'venus', 'earth', 'mars']) expect(u(t).uRingMode).toBe(0);
  });

  it('the shader has rocky / cloud / ocean surface branches + ice caps', () => {
    expect(SATURN_FRAG).toContain('float fbm(vec3 p)');
    expect(SATURN_FRAG).toContain('ROCKY');
    expect(SATURN_FRAG).toContain('OCEAN');
    expect(SATURN_FRAG).toContain('uIceLat');           // polar ice caps
  });

  it('Earth is ocean-blue + land + ice caps; Mars is red with caps', () => {
    const earth = planSaturnScene({ kind: 'saturn-view', planet: 'earth' }).raymarch.customUniforms;
    expect(earth.uBandA[2]).toBeGreaterThan(earth.uBandA[0]);   // ocean: blue dominant
    expect(earth.uIceLat).toBeLessThan(1);                      // has ice caps
    const mars = planSaturnScene({ kind: 'saturn-view', planet: 'mars' }).raymarch.customUniforms;
    expect(mars.uBandA[0]).toBeGreaterThan(mars.uBandA[2]);     // red dominant
    expect(mars.uIceLat).toBeLessThan(1);
  });

  it('Mercury has no atmosphere; Earth/Venus do', () => {
    expect(planSaturnScene({ kind: 'saturn-view', planet: 'mercury' }).raymarch.customUniforms.uAtmoStr).toBe(0);
    expect(planSaturnScene({ kind: 'saturn-view', planet: 'earth' }).raymarch.customUniforms.uAtmoStr).toBeGreaterThan(0);
  });
});

describe('saturn-view — the solar GALLERY stepper', () => {
  it('gallery:true builds a step per planet (all eight, solar order), same shader', () => {
    const plan = planSaturnScene({ kind: 'saturn-view', gallery: true });
    expect(plan.stats.gallery).toBe(true);
    expect(plan.raymarch.steps.length).toBe(8);
    expect(plan.raymarch.steps.map((s) => s.label)).toEqual(['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']);
    expect(plan.raymarch.frag).toBe(SATURN_FRAG);                       // one shader for all steps
    expect(plan.raymarch.customUniforms).toEqual(plan.raymarch.steps[0].uniforms);   // starts on Mercury
  });

  it('every gallery step carries a full uniform set + a readout', () => {
    const steps = planSaturnScene({ kind: 'saturn-view', gallery: true }).raymarch.steps;
    for (const st of steps) {
      expect(st.uniforms).toHaveProperty('uSurfType');
      expect(st.uniforms).toHaveProperty('uRingMode');
      expect(Array.isArray(st.readout) && st.readout.length).toBeTruthy();
    }
  });

  it('emits a STEPPER World — the prev/next bar + the uniform-swapping script', () => {
    const html = emitThreeWorld({ ...assembleSaturnScene({ kind: 'saturn-view', gallery: true }, {}), inline: true });
    expect(html).toContain('moj-stepper');
    expect(html).toContain('const STEPS =');
    expect(html).toContain('applyStep');
    expect(html).toContain('mojNext');
  });
});
