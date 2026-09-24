import { describe, expect, it } from 'vitest';

import { VOLUME_NOISE_GLSL, VOLUME_PHASE_GLSL, VOLUME_ENERGY, volumeSunGLSL, volumeLightGLSL } from './volume-lib.js';

describe('volume-lib — shared GLSL for lit volumes', () => {
  it('the noise block is self-contained: its own hash, trilinear noise, fbm, both Worleys', () => {
    expect(VOLUME_NOISE_GLSL).toContain('float svHash13(vec3 p)');
    expect(VOLUME_NOISE_GLSL).toContain('float svNoise(vec3 p)');
    expect(VOLUME_NOISE_GLSL).toContain('f = f * f * (3.0 - 2.0 * f)');          // smoothstep-interpolated corners, not cubes
    expect(VOLUME_NOISE_GLSL).toContain('float svFbm(vec3 p)');
    expect(VOLUME_NOISE_GLSL).toContain('float svWorley(vec3 p)');
    expect(VOLUME_NOISE_GLSL).toContain('float svWorley8(vec3 p)');
    expect(VOLUME_NOISE_GLSL).not.toContain('vrHash13');                          // no dependency on buildVolumeFrag's helpers
  });

  it('the phase block normalises to isotropic == 1 and caps the forward peak', () => {
    expect(VOLUME_PHASE_GLSL).toContain('float svHG(float mu, float g)');
    expect(VOLUME_PHASE_GLSL).toContain('* 4.0 * SV_PI, cap)');
    expect(VOLUME_ENERGY.phaseCap).toBe(2.0);
    expect(VOLUME_ENERGY.gFogMax).toBeLessThan(VOLUME_ENERGY.gCloudMax);
  });

  it('the sun block normalises the direction and bakes the four constants', () => {
    const g = volumeSunGLSL({ sun: [0, 0, 2] });
    expect(g).toContain('const vec3 SV_SUN = vec3(0.0000, 0.0000, 1.0000);');
    expect(g).toContain('const vec3 SV_SUNCOL = vec3(1.0000, 0.9400, 0.8400) * 1.0000;');
    expect(g).toContain('const vec3 SV_SKYCOL');
    expect(g).toContain('const vec3 SV_GNDCOL');
    expect(volumeSunGLSL({ sunScale: 1.35 })).toContain('* 1.3500;');
  });

  it('the light block marches toward the sun through the named shadow density', () => {
    const g = volumeLightGLSL({ shadowFn: 'densityShadow', taps: 4, step0: 0.6, grow: 1.7 });
    expect(g).toContain('for (int i = 0; i < 4; i++){ q += SV_SUN * ds; od += densityShadow(q) * ds; ds *= 1.7000; }');
    expect(g).toContain('float od = 0.0, ds = 0.6000;');
    expect(g).toContain('vec3 svLight(vec3 p, vec3 rd, float d, float sigma, float hNorm, float ambAmt, float powderK)');
    expect(g).toContain('svPhase(mu, 0.5500, -0.1800, 0.3200, 2.0000)');           // defaults, capped
    expect(volumeLightGLSL()).toContain('od += density(q) * ds');                 // default shadow fn
  });

  it('is deterministic — same options, same bytes', () => {
    expect(volumeLightGLSL({ gFwd: 0.4 })).toBe(volumeLightGLSL({ gFwd: 0.4 }));
    expect(volumeSunGLSL({ sun: [1, 2, 3] })).toBe(volumeSunGLSL({ sun: [1, 2, 3] }));
  });
});
