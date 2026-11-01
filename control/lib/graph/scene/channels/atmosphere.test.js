/**
 * The air of a gen-7 page (scene/channels/atmosphere.js): a fog set by its visibility (the 2% contrast distance), lying low
 * outside by a scale height and even inside, glowing toward the sun; the gen-7 sky veiled to it; the far softened past
 * the view cone. Its words read and refuse; its optical depth is Beer-Lambert's; its block parses; absent, no byte.
 */
import { describe, expect, it } from 'vitest';

import { ATMOSPHERE, readAtmosphere, atmosphereInput, atmosphereGlsl, atmosphereScript, atmosphereEarlyScript, roomAirColour } from './atmosphere.js';
import { emitThreeWorld } from '../scene-three.js';

const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], normal: [0, 0, 1], fill: '#888888' };
// (the GLSL's optical depth, the same closed form in JS: a ray r from an eye at height z over the base)
const depth = (A, r, z) => {
  const L = Math.hypot(...r), s = A.sigma, run = Math.max(L - A.clear, 0);
  if (A.height === null) return s * run;
  const h0 = Math.max(z, 0), h1 = Math.max(z + r[2], 0), dh = (h1 - h0) / A.height, e0 = Math.exp(-h0 / A.height);
  return s * run * (Math.abs(dh) > 1e-4 ? (e0 - Math.exp(-h1 / A.height)) / dh : e0);
};

describe('the air', () => {
  it('reads a kind, true, or its settings over a kind; outside lying low, inside even', () => {
    const kind = Object.keys(ATMOSPHERE.kinds)[0];
    expect(readAtmosphere(undefined)).toBeNull();
    expect(readAtmosphere(false)).toBeNull();
    expect(readAtmosphere(true).kind).toBe('haze');
    const out = readAtmosphere(kind), inn = readAtmosphere(kind, { inside: true });
    expect(out.height).toBeGreaterThan(0);
    expect(inn.height).toBeNull();
    expect(inn.visibility).toBeLessThan(out.visibility);
    expect(readAtmosphere({ kind, visibility: 300, height: false, blur: false })).toMatchObject({ visibility: 300, height: null, blur: 0 });
    expect(readAtmosphere({ blur: 4 }).blur).toBe(4);
    // (a geocity's measures are a metro's: the same word sees further, lying in a deeper layer)
    const city = readAtmosphere(kind, { where: 'city' });
    expect(city.visibility).toBeGreaterThan(out.visibility);
    expect(city.height).toBeGreaterThan(out.height);
    expect(readAtmosphere(kind, { where: 'inside' })).toEqual(inn);
  });

  it('refuses what it is not, naming the setting', () => {
    expect(() => readAtmosphere('smog')).toThrow(/air.kind is one of/);
    expect(() => readAtmosphere({ density: 1 })).toThrow(/air.density is not a setting/);
    expect(() => readAtmosphere({ visibility: 2 })).toThrow(/air.visibility/);
    expect(() => readAtmosphere({ visibility: 100, clear: 120 })).toThrow(/air.clear/);
    expect(() => readAtmosphere({ height: 50 }, { inside: true })).toThrow(/inside, the air lies even/);
    expect(() => readAtmosphere({ blur: 40 })).toThrow(/air.blur/);
    expect(() => readAtmosphere(7)).toThrow(/air is a kind/);
  });

  it('is Beer-Lambert by its visibility: a dark thing level with the eye at the visibility keeps 2% of its contrast', () => {
    for (const inside of [false, true]) {
      const A = readAtmosphere({ kind: 'haze', height: false }, { inside });
      expect(Math.exp(-depth(A, [A.visibility, 0, 0], 0))).toBeCloseTo(ATMOSPHERE.contrast, 4);
      // (nothing inside the clear distance)
      expect(depth(A, [A.clear * 0.9, 0, 0], 0)).toBe(0);
    }
  });

  it('lies low outside: thinner over the base by its scale height, a hill top seen clearer than the plain', () => {
    const A = readAtmosphere('mist');
    const level = depth(A, [200, 0, 0], 1.7), up = depth(A, [200, 0, 60], 1.7), high = depth(A, [200, 0, 0], 40);
    expect(up).toBeLessThan(level);
    expect(high).toBeLessThan(level * Math.exp(-30 / A.height));
    // (a ray down from over the layer meets the dense air: more than one along the layer's top)
    expect(depth(A, [200, 0, -38], 40)).toBeGreaterThan(depth(A, [200, 0, 0], 40));
  });

  it('carries its measures in the page\'s units, the sun only outside', () => {
    const A = readAtmosphere('fog');
    const I = atmosphereInput(A, { base: 2, sun: [0, -1, 1], unit: 2 });
    expect(I.visibility).toBeCloseTo(A.visibility / 2, 4);
    expect(I.sigma).toBeCloseTo(A.sigma * 2, 4);
    expect(Math.hypot(...I.sun)).toBeCloseTo(1, 4);
    expect(atmosphereInput(readAtmosphere('fog', { inside: true })).glow).toBe(0);
    expect(atmosphereGlsl(atmosphereInput(readAtmosphere('fog', { inside: true })))).not.toContain('exp( - h0');
  });

  it('patches three\'s fog chunk first, softens the far past the cone innermost, then veils the gen-7 sky; both parse', () => {
    const cfg = atmosphereInput(readAtmosphere('mist'), { sun: [0, -0.5, 0.8] });
    const early = atmosphereEarlyScript(cfg), late = atmosphereScript(cfg);
    for (const src of [early, late]) expect(() => new Function('THREE', 'scene', 'renderer', src)).not.toThrow();
    for (const s of ["'float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );'", 'vAirRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;', 'airColour( vAirRay, fogColor )',
      'Math.max(AT.from, window.__mojCone ? window.__mojCone.reach : 0)', 'RT.isXRRenderTarget = true', 'renderer.xr.isPresenting', 'rt === RT ? null : rt']) expect(early).toContain(s);
    for (const s of ['m.uniforms.uCover', 'scene.fog.density = AT.sigma']) expect(late).toContain(s);
    // (a blur of zero keeps the frame: no target, no pass)
    expect(atmosphereEarlyScript(atmosphereInput(readAtmosphere({ kind: 'mist', blur: false })))).toContain('if (!(AT.blur > 0 && canHalf)) return;');
  });

  it('in a room, is the colour of the room\'s own light over its void, not the sky\'s', () => {
    const dim = roomAirColour({ ambient: [0.05, 0.05, 0.05], lights: [], void: '#101010' }), lit = roomAirColour({ ambient: [0.05, 0.05, 0.05], lights: [{ key: [3, 2, 1] }], void: '#101010' });
    expect(dim.every((v) => v > 0 && v < 1)).toBe(true);
    expect(lit[0]).toBeGreaterThan(dim[0]);
    expect(lit[0]).toBeGreaterThan(lit[2]);
    expect(atmosphereInput(readAtmosphere('haze', { inside: true }), { colour: lit }).colour).toEqual(lit);
    expect(atmosphereInput(readAtmosphere('haze')).colour).toBeUndefined();
  });

  it('is on the page only when asked, in two parts, before the weather\'s block (which thickens the fog it makes)', () => {
    const air = atmosphereInput(readAtmosphere('haze'), { sun: [0, -0.5, 0.8] });
    const page = emitThreeWorld({ faces: [face], air, weather: null });
    expect(page).toContain('the air: a fog by its visibility');
    // (its first part right after the scene is made: before any other wrapper of the render, before any material)
    expect(page.indexOf('the air, first')).toBeGreaterThan(page.indexOf('const scene = new THREE.Scene();'));
    expect(page.indexOf('the air, first')).toBeLessThan(page.indexOf('the air: a fog by its visibility'));
    expect(emitThreeWorld({ faces: [face] })).not.toContain('channels/atmosphere.js');
    expect(emitThreeWorld({ faces: [face] })).toBe(emitThreeWorld({ faces: [face], air: null }));
  });
});
