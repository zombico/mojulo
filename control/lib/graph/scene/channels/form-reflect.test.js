// What a built surface gives back (channels/form.js `reflect`): the sky by Fresnel and the sun's highlight, and a wet
// ground's water as a state of its material. A page that asks for none carries none of its code.
import { describe, it, expect } from 'vitest';
import { formScript, FORM_PAGE } from './form.js';

const base = { ...FORM_PAGE, lights: [{ at: [0, 0, 1e6], key: [1.4, 1.3, 1.1], radius: 1e9, live: true }], ambient: [0.3, 0.35, 0.45], fall: 2, maps: {}, sun: { ground: [0.1, 0.1, 0.1] } };
const reflect = { env: { zenith: [0.2, 0.4, 0.8], horizon: [0.7, 0.8, 0.9], ground: [0.2, 0.2, 0.2] }, surfaces: { 'yard:container': { rough: 0.36 } } };

describe('the form render: what a built surface gives back', () => {
  it('a page that asks for none is as it was: none of its uniforms, none of its code', () => {
    const page = formScript(base);
    for (const word of ['FORM_ENV', 'FORM_WET', 'uFEnvZ', 'uFSurf', 'uFWet', 'fVN']) expect(page.includes(word), word).toBe(false);
  });

  it('a page that asks carries the sky, each surface its roughness, and the sun\'s highlight in the live set', () => {
    const page = formScript({ ...base, reflect });
    for (const word of ['#ifdef FORM_ENV', 'uFEnvZ', 'uFEnvH', 'uFEnvG', 'uFSurf', 'FORM_ENV: 1']) expect(page.includes(word), word).toBe(true);
    // (the loop over the live set is written at the page's own count, never left as its placeholder in the shader)
    expect(page).toContain(".split('__K__').join(String(K))");
    expect(page).toContain('"yard:container":{"rough":0.36}');
  });

  it('wet is a state of the material, on the groups it names: its water by the world\'s place and the recipe\'s seed', () => {
    const dry = formScript({ ...base, reflect }), wet = formScript({ ...base, reflect: { ...reflect, wet: { amount: 1, seed: 7.31, groups: ['building:apron'] } } });
    expect(wet).toContain('"groups":["building:apron"]');
    expect(wet).toContain('#ifdef FORM_WET');
    // (the same code either way: a dry page's amount is nothing, and no surface is named wet)
    expect(dry).toContain('uFWet');
    expect(dry.includes('"wet"')).toBe(false);
  });
});
