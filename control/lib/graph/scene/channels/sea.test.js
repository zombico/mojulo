/**
 * The sea a gen-7 page is seen through (scene/channels/sea.js): a land put under water by its light alone. Its words read
 * and refuse; the light at a depth loses its reds first and is never black; the way back is Beer-Lambert by a
 * visibility; the caustic net moves light and makes none; its blocks parse; absent, no byte.
 */
import { describe, expect, it } from 'vitest';

import { SEA, SEA_NET, seaNet, readSea, seaLight, seaInput, seaGlsl, seaScript, seaEarlyScript } from './sea.js';
import { emitThreeWorld } from '../scene-three.js';
import { assembleGeocityScene } from '../../geocity/scene.js';
import { assembleGeotownScene } from '../../geotown/scene.js';
import { geocubeCity } from '../../era/geocube-city.js';

const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], normal: [0, 0, 1], fill: '#888888' };
const ZONES = Object.keys(SEA.zones), first = ZONES[0], last = ZONES.at(-1);
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('the sea', () => {
  it('reads a zone, true, a depth, or its settings over a zone', () => {
    expect(readSea(undefined)).toBeNull();
    expect(readSea(false)).toBeNull();
    expect(readSea(true)).toMatchObject({ zone: 'reef', depth: SEA.zones.reef.depth, water: 'ocean', lamps: [], torch: null });
    expect(readSea(first)).toMatchObject({ zone: first, depth: SEA.zones[first].depth, caustics: SEA.zones[first].caustics });
    // (a depth names its own zone and takes its measures between the zones it lies between)
    const a = SEA.zones[ZONES[1]], b = SEA.zones[ZONES[2]], mid = readSea(Math.sqrt(a.depth * b.depth));
    expect(mid.zone).toBe(ZONES[1]);
    expect(mid.level).toBeCloseTo((a.level + b.level) / 2, 3);
    expect(readSea(SEA.range.depth[1]).level).toBe(SEA.zones[last].level);
    expect(readSea({ zone: last, snow: false, level: 0.1 })).toMatchObject({ snow: 0, level: 0.1 });
    const L = readSea({ lamps: [{ at: [1, 2, 3] }, { at: [0, 0, 5], aim: [0, 0, 0], cone: 40, power: 60, colour: '#80c0ff' }], torch: true });
    expect(L.lamps[0]).toEqual({ at: [1, 2, 3], colour: SEA.lamps.colour, power: SEA.lamps.power });
    expect(L.lamps[1]).toMatchObject({ aim: [0, 0, 0], cone: 40, power: 60 });
    expect(L.torch).toEqual({ colour: SEA.torch.colour, power: SEA.torch.power, cone: SEA.torch.cone });
  });

  it('refuses what it is not, naming the setting', () => {
    expect(() => readSea('lagoon')).toThrow(/sea.zone is one of/);
    expect(() => readSea({ density: 1 })).toThrow(/sea.density is not a setting/);
    expect(() => readSea(0.2)).toThrow(/sea.depth/);
    expect(() => readSea({ water: 'wine' })).toThrow(/sea.water is one of/);
    expect(() => readSea({ visibility: 900 })).toThrow(/sea.visibility/);
    expect(() => readSea({ level: 0 })).toThrow(/never black/);
    expect(() => readSea({ caustics: 9 })).toThrow(/sea.caustics/);
    expect(() => readSea([1])).toThrow(/sea is a zone/);
    expect(() => readSea({ lamps: [{}] })).toThrow(/sea.lamps\[0\].at/);
    expect(() => readSea({ lamps: [{ at: [0, 0, 0], cone: 30 }] })).toThrow(/give it an aim/);
    expect(() => readSea({ lamps: Array.from({ length: SEA.lamps.most + 1 }, () => ({ at: [0, 0, 0] })) })).toThrow(/at most/);
    expect(() => readSea({ torch: { at: [0, 0, 0] } })).toThrow(/sea.torch.at is not a setting/);
  });

  it('loses its reds first going down, and is never black: each zone darker than the one over it', () => {
    const lights = ZONES.map((z) => seaLight(readSea(z)));
    for (const [i, L] of lights.entries()) {
      // (red under green under blue in open water, from the first zone on)
      expect(L.tint[0]).toBeLessThan(L.tint[1]);
      expect(L.tint[1]).toBeLessThanOrEqual(L.tint[2]);
      expect(Math.max(...L.tint)).toBe(1);
      expect(lum(L.e0)).toBeGreaterThan(0);
      expect(lum(L.body)).toBeGreaterThan(0);
      if (i) { expect(lum(L.e0)).toBeLessThan(lum(lights[i - 1].e0)); expect(L.tint[0]).toBeLessThanOrEqual(lights[i - 1].tint[0]); }
    }
    // (the last light keeps the water's deep hue: never a primary)
    const deep = lights.at(-1).tint;
    expect(deep).toEqual(SEA.waters.ocean.deep.map((x, i) => (i === 2 ? 1 : x)));
    // (another water, another colour: a coast's light is green)
    const coast = seaLight(readSea({ zone: 'blue', water: 'coast' }));
    expect(coast.tint[1]).toBe(1);
    expect(coast.body[1]).toBeGreaterThan(coast.body[2]);
  });

  it('is Beer-Lambert by its visibility along the view, colour by colour', () => {
    for (const water of Object.keys(SEA.waters)) {
      const S = readSea({ water }), L = seaLight(S);
      // (the clearest colour keeps 2% of a dark thing's contrast at the visibility; the others have gone before)
      expect(Math.exp(-Math.min(...L.c) * S.visibility)).toBeCloseTo(SEA.contrast, 3);
      L.c.forEach((c, i) => expect(c).toBeCloseTo(L.k[i] + L.s, 4));
    }
    expect(seaLight(readSea({ visibility: 20 })).s).toBeGreaterThan(seaLight(readSea({ visibility: 60 })).s);
  });

  it('moves the light in its caustic net and makes none: its mean is 1, its lines over it', () => {
    let a = 0, top = 0, n = 0;
    for (let i = 0; i < 70; i++) for (let j = 0; j < 70; j++) { const w = seaNet(i * 0.613 + 40, j * 0.577 - 13, 7.3); a += w; top = Math.max(top, w); n++; }
    expect(a / n).toBeGreaterThan(0.9);
    expect(a / n).toBeLessThan(1.1);
    expect(top).toBeGreaterThan(2.5);
    expect(SEA_NET.length).toBeGreaterThan(2);
    // (the same point at the same time is the same light)
    expect(seaNet(1.5, 2.5, 3)).toBe(seaNet(1.5, 2.5, 3));
  });

  it('carries its measures in the page\'s units, the sun as it stands under water, the lamps in linear light', () => {
    const S = readSea({ zone: first, lamps: [{ at: [0, 0, 6], aim: [0, 3, 2], power: 20 }], torch: true }), I = seaInput(S, { base: 2, sun: [0.6, 0, 0.8], unit: 2 });
    expect(I.surface).toBeCloseTo(2 + S.depth / 2, 4);
    I.c.forEach((c, i) => expect(c).toBeCloseTo(seaLight(S).c[i] * 2, 4));
    // (refracted: steeper than in the air, by Snell's law)
    expect(Math.hypot(...I.sun)).toBeCloseTo(1, 3);
    expect(Math.hypot(I.sun[0], I.sun[1])).toBeCloseTo(0.6 / SEA.index, 3);
    expect(Math.hypot(...I.lamps[0].aim)).toBeCloseTo(1, 3);
    expect(I.lamps[0].cos[0]).toBeLessThan(I.lamps[0].cos[1]);
    expect(I.torch.cos[0]).toBeLessThan(I.torch.cos[1]);
    expect(I.hex).toMatch(/^#[0-9a-f]{6}$/);
    // (no sun, or one under the horizon: no caustics, no shafts)
    for (const sun of [null, [1, 0, -0.2]]) expect(seaInput(S, { sun })).toMatchObject({ sun: null, caustics: 0, shafts: 0 });
  });

  it('inside (a flooded hall, room or cavern) keeps the room\'s own light: no light down, no caustics, shafts or surface', () => {
    const S = readSea(first, { inside: true }), I = seaInput(S, { sun: [0, 0, 1] }), G = seaGlsl(I);
    expect(S).toMatchObject({ caustics: 0, shafts: 0, inside: true });
    expect(I.e0).toEqual([1, 1, 1]);
    expect(I.sun).toBeNull();
    expect(G).toContain('return SEA_E0;');
    expect(G).not.toContain('smoothstep( 0.601');
    expect(seaGlsl(seaInput(readSea(first), { sun: [0, 0, 1] }))).toContain('SEA_E0 * exp( clamp(');
  });

  it('writes only the terms it was asked for: no lamp, torch, caustic or shaft the page does not carry', () => {
    const bare = seaGlsl(seaInput(readSea(last), { sun: [0, 0, 1] }));
    for (const s of ['atan(', 'seaFwd() )', 'for ( int i']) expect(bare).not.toContain(s);
    const lit = seaGlsl(seaInput(readSea({ zone: first, lamps: [{ at: [0, 0, 3] }], torch: true }), { sun: [0.2, 0.1, 0.9] }));
    for (const s of ['atan(', 'seaFwd() )', 'for ( int i', 'dFdx( r )']) expect(lit).toContain(s);
  });

  it('patches three\'s fog chunk first, then lays the open water and its snow; both parse', () => {
    const cfg = seaInput(readSea({ zone: last, torch: true, lamps: [{ at: [1, 2, 3], aim: [0, 0, 0] }] }), { sun: [0, -0.5, 0.8] });
    const early = seaEarlyScript(cfg), late = seaScript(cfg);
    for (const src of [early, late]) expect(() => new Function('THREE', 'scene', 'renderer', src)).not.toThrow();
    for (const s of ['vSeaRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;', 'seaThrough( gl_FragColor.rgb, vSeaRay, ( fogDensity / ', 'window.__mojSea']) expect(early).toContain(s);
    for (const s of ['scene.fog.density = SE.sigma * (1 + t / ', 'THREE.Points', 'o.visible = false']) expect(late).toContain(s);
    // (the fog stays an honest one: its density the water's extinction in its clearest colour, the clock riding on it)
    expect(cfg.sigma).toBeCloseTo(Math.min(...cfg.c), 5);
    expect(SEA.ride).toBeLessThan(1);
    // (no snow asked, none made)
    expect(seaScript(seaInput(readSea(first), { sun: [0, 0, 1] }))).toContain('"snow":0');
  });

  it('is on the page only when asked, in two parts, and never with the air', () => {
    const sea = seaInput(readSea('reef'), { sun: [0, -0.5, 0.8] });
    const page = emitThreeWorld({ faces: [face], sea });
    expect(page.indexOf('the sea, first')).toBeGreaterThan(page.indexOf('const scene = new THREE.Scene();'));
    expect(page.indexOf('the sea, first')).toBeLessThan(page.indexOf('the sea: the open water'));
    expect(emitThreeWorld({ faces: [face] })).not.toContain('channels/sea.js');
    expect(emitThreeWorld({ faces: [face] })).toBe(emitThreeWorld({ faces: [face], sea: null }));
  });

  it('passes every geocube show\'s own settings gate: the geocity, the geotown, the micro-city', () => {
    for (const [show, gate] of [['geocity', assembleGeocityScene], ['geotown', assembleGeotownScene], ['city', geocubeCity]]) {
      expect(() => gate({ kind: 'geocube', cube: 'city-night', show, sea: 'blue', zz: 1 }), show).toThrow(/'zz' is not a setting/);
    }
  });
});
