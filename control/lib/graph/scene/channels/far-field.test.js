/**
 * The far field (scene/channels/far-field.js): past the view cone's reach the grass is its colour on the ground,
 * speckled, in the ground's own shader, and adds no draw. The blocks parse, and the form channel carries the blanket in
 * its ground and the far field after its grass.
 */
import { describe, expect, it } from 'vitest';

import { FAR_FIELD, FAR_BLANKET_GLSL, farFieldScript } from './far-field.js';
import { formLandScript } from './form-land.js';

const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };

describe('the far field', () => {
  it('draws the grass past the reach as its colour on the ground, speckled, nothing standing', () => {
    expect(FAR_BLANKET_GLSL).toContain('vec4 farBlanket( vec3 P, vec3 nW )');
    // (specks a pixel or so at their distance, the grain snapped to a power of two; flowers, weeds and flecks)
    expect(FAR_FIELD.speck.px).toBeGreaterThan(0);
    expect(FAR_FIELD.speck.px).toBeLessThanOrEqual(3);
    expect(FAR_BLANKET_GLSL).toContain('exp2( ceil( log2(');
    expect(FAR_FIELD.speck.flowers + FAR_FIELD.speck.light + FAR_FIELD.speck.dark).toBeLessThan(1);
  });

  it('adds no draw: no strokes, no image read back, only the ground\'s uniforms each frame', () => {
    const src = farFieldScript();
    expect(() => new Function('THREE', 'scene', 'LAYER_U', src)).not.toThrow();
    for (const s of ['WebGLRenderTarget', 'renderer.render', 'InstancedBufferGeometry', 'scene.add']) expect(src).not.toContain(s);
  });

  it('the form channel carries the blanket in its ground and the far field after its grass', () => {
    const page = formLandScript(land);
    expect(page).toContain('farBlanket( vWPos, nW )');
    expect(page.indexOf('window.__formFar = {')).toBeLessThan(page.indexOf('the far field: the grass past'));
  });
});

describe('one far grass (farGrass: lift)', () => {
  it('the calm blanket is the colour alone, no speck; asked for nothing, the blanket as it was', async () => {
    const { farBlanketGlsl, FAR_BLANKET_GLSL } = await import('./far-field.js');
    expect(farBlanketGlsl()).toBe(FAR_BLANKET_GLSL);
    const calm = farBlanketGlsl(true);
    expect(calm).not.toMatch(/flowering && h|weedy && h|h > /);
    expect(calm).toContain('return vec4( a, k );');
    expect(calm).toContain('// (calm: the colour alone, no speck)');
  });
  it('the tall stand ends at the reach only where the lift carries it past; the lift takes the calm colour', async () => {
    const { formGrassScript } = await import('./form-grass.js'), { farLiftScript } = await import('./far-lift.js');
    expect(formGrassScript({ stand: true, reach: true })).toContain("Object.assign(sh.uniforms, GU, PV, {");
    expect(formGrassScript({ stand: true })).toContain('ST ? PVS : PV');
    expect(farLiftScript({ calm: true })).toContain('(calm: the colour alone, no speck)');
    expect(farLiftScript({})).not.toContain('(calm: the colour alone');
  });
});

describe('one far grass, tuned', () => {
  it('a level\'s blades (whole further) and raise (a higher platform) reach the grass and the lift; unnamed, as they were', async () => {
    const { formGrassScript, POV_GRASS } = await import('./form-grass.js'), { farLiftScript, FAR_LIFT } = await import('./far-lift.js');
    expect(formGrassScript({ stand: true, thin: 0.7 })).toContain('"thin":0.7');
    expect(formGrassScript({ stand: true })).toContain(`"thin":${POV_GRASS.thin}`);
    const tuned = farLiftScript({ from: 0.7, stand: 2.5 }), plain = farLiftScript({});
    expect(tuned).toContain('"from":0.7');
    expect(tuned).toContain('m * 2.500 * smoothstep');
    expect(plain).toContain(`m * ${FAR_LIFT.stand.toFixed(3)} * smoothstep`);
    expect(plain).toContain(`"from":${FAR_LIFT.from}`);
  });
});
