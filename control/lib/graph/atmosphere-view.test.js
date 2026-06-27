import { describe, expect, it } from 'vitest';

import { planAtmosphereScene, assembleAtmosphereScene, ATMOSPHERE_SCENARIOS, ATMOSPHERE_FRAG } from './atmosphere-view.js';
import { emitThreeWorld } from './scene-three.js';
import { sketchRenderMode, classifyBucket } from './sketch-manifest.js';

describe('planAtmosphereScene — determinism & shape', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planAtmosphereScene({ kind: 'atmosphere-view', scenario: 'sunset' });
    const b = planAtmosphereScene({ kind: 'atmosphere-view', scenario: 'sunset' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('falls back to day on an unknown scenario', () => {
    expect(planAtmosphereScene({ kind: 'atmosphere-view', scenario: 'venus' }).stats.scenario).toBe('day');
  });

  it('produces a raymarch payload carrying the scattering shader + planet/sun uniforms + camera', () => {
    const plan = planAtmosphereScene({ kind: 'atmosphere-view', scenario: 'limb' });
    expect(plan.raymarch.frag).toBe(ATMOSPHERE_FRAG);
    expect(plan.raymarch.customUniforms).toHaveProperty('uRg');
    expect(plan.raymarch.customUniforms).toHaveProperty('uRt');
    expect(plan.raymarch.customUniforms).toHaveProperty('uSunI');
    expect(Array.isArray(plan.raymarch.customUniforms.uSunDir)).toBe(true);
    expect(plan.raymarch.cameraStart.length).toBe(3);
    expect(plan.raymarch.readout.length).toBeGreaterThan(3);
  });

  it('normalizes the sun direction to a unit vector', () => {
    const d = planAtmosphereScene({ scenario: 'sunset' }).raymarch.customUniforms.uSunDir;
    const len = Math.hypot(d[0], d[1], d[2]);
    expect(len).toBeCloseTo(1, 6);
  });

  it('the brightness knob is clamped and overrides the scenario default', () => {
    expect(planAtmosphereScene({ scenario: 'day', brightness: 999 }).stats.sunI).toBe(60);
    expect(planAtmosphereScene({ scenario: 'day', brightness: 1 }).stats.sunI).toBe(4);
    expect(planAtmosphereScene({ scenario: 'day', brightness: 30 }).stats.sunI).toBe(30);
  });
});

describe('atmosphere-view — single-scattering physics in the shader', () => {
  it('rides the scaffold with its rayDir + occluder generalizations', () => {
    expect(ATMOSPHERE_FRAG).toContain('volSample(p, rd, emis, ext);');   // rayDirArg form
    expect(ATMOSPHERE_FRAG).toContain('bool hitGround');                 // occluder (solid planet)
    expect(ATMOSPHERE_FRAG).toContain('groundColor(ro + rd * tg.x, rd)');
  });

  it('scatters wavelength-dependently (Rayleigh λ⁻⁴: blue ≫ red) — why the sky is blue', () => {
    expect(ATMOSPHERE_FRAG).toContain('vec3  bR = vec3(1.55, 3.64, 6.27)');   // R < G < B
  });

  it('does a secondary light march to the sun and applies both phase functions', () => {
    expect(ATMOSPHERE_FRAG).toContain('sunOpticalDepth(vec3 p)');        // sun transmittance march
    expect(ATMOSPHERE_FRAG).toContain('3.0 / (16.0 * PI) * (1.0 + mu * mu)');  // Rayleigh phase
    expect(ATMOSPHERE_FRAG).toContain('1.0 + g2 - 2.0 * gM * mu');       // Cornette–Shanks Mie phase
  });

  it('shadows in-scattering where the planet blocks the sun', () => {
    expect(ATMOSPHERE_FRAG).toContain('return vec2(-1.0);');             // shadow sentinel
    expect(ATMOSPHERE_FRAG).toContain('if (od.x < 0.0) { emis = vec3(0.0); return; }');
  });
});

describe('atmosphere-view — raymarch emit + registration', () => {
  it('emitThreeWorld early-returns the full-screen shader World and passes the sun vec3 uniform', () => {
    const html = emitThreeWorld({ ...assembleAtmosphereScene({ kind: 'atmosphere-view' }, {}), inline: true });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('ShaderMaterial');
    expect(html).toContain('uSunDir:{value:new THREE.Vector3(');        // vec3 uniform serialized
    expect(html).not.toContain('GROUPS =');   // no mesh pipeline
  });

  it('every scenario emits a balanced, full-screen shader World', () => {
    for (const scenario of ATMOSPHERE_SCENARIOS) {
      const html = emitThreeWorld({ ...assembleAtmosphereScene({ kind: 'atmosphere-view', scenario }, {}), inline: true });
      expect(html.startsWith('<!doctype html>')).toBe(true);
    }
  });

  it('the composed shader is brace- and paren-balanced (GLSL sanity)', () => {
    const braces = [...ATMOSPHERE_FRAG].reduce((n, c) => n + (c === '{' ? 1 : c === '}' ? -1 : 0), 0);
    const parens = [...ATMOSPHERE_FRAG].reduce((n, c) => n + (c === '(' ? 1 : c === ')' ? -1 : 0), 0);
    expect(braces).toBe(0);
    expect(parens).toBe(0);
  });

  it('routes to the world renderer and the world concern bucket', () => {
    const m = { kind: 'atmosphere-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('world');
  });

  it('exposes the three scenarios', () => {
    expect(ATMOSPHERE_SCENARIOS).toEqual(['day', 'sunset', 'limb']);
  });
});
