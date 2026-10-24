/**
 * A cube at an hour (geocube-hours.js): the sun on one arc through the cube's own reference, the sky between the
 * references' day, golden and night, the moon the key at night. At the reference's hour the light is the reference's;
 * absent, the cube is as it was.
 */
import { describe, expect, it } from 'vitest';

import { GEOCUBE_PRESETS, readGeocube, lowerGeocube, withGeocube, assembleGeocubeScene } from './geocube.js';
import { HOUR_WORDS, readHour, referenceHour, hourLight } from './geocube-hours.js';
import { SIXTH_GEN_REFERENCES, resolveLook } from './sixth-gen.js';
import { lookOf } from './style/looks.js';
import { assembleStageScene } from './stage.js';
import { readClouds } from '../matte-paint/sky.js';
import { hourShift, hourDim, hourWin } from './isekai.js';

const refOf = (cube) => SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)];
// one cube lit by a sun and one by the moon, picked from the presets
const ids = Object.keys(GEOCUBE_PRESETS), cubes = ids.map((id) => readGeocube(id));
const DAY = cubes.find((c) => refOf(c).light.key), NIGHT = cubes.find((c) => !refOf(c).light.key);
const lum = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
const hexLum = (h) => lum([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const hexOf = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

describe('an hour', () => {
  it('is a number from 0 up to 24 or a word on the clock\'s dial; anything else is refused', () => {
    expect(readHour('noon')).toBe(12); expect(readHour(0)).toBe(0); expect(readHour(17.5)).toBe(HOUR_WORDS.golden);
    for (const bad of [24, -1, 'teatime', '12', NaN]) expect(() => readHour(bad)).toThrow(/hour/);
  });

  it('at the reference\'s own hour, the light is the reference\'s', () => {
    const ref = refOf(DAY), L = hourLight(DAY, referenceHour(ref)), sky = DAY.light.sky;
    expect(L.moonlit).toBe(false);
    expect(L.key).toEqual({ color: ref.light.key.color, elevation: ref.light.key.elevation, azimuth: ref.light.key.azimuth ?? 225 });
    expect(L.ambient).toBe(ref.light.ambient); expect(L.gainK).toBe(1);
    if (sky) { expect(hexOf(L.dome.zenith)).toBe(sky.zenith.toLowerCase()); expect(hexOf(L.dome.horizon)).toBe(sky.horizon.toLowerCase()); }
    // a night reference is its own 23:00: the cube's moon the key, at its gain
    const N = hourLight(NIGHT, referenceHour(refOf(NIGHT)));
    expect(N.moonlit).toBe(true); expect(N.gainK).toBe(1);
    expect(N.key).toEqual({ color: NIGHT.light.moon.color, elevation: NIGHT.light.moon.elevation, azimuth: NIGHT.light.moon.azimuth });
    expect(N.ambient).toBe(refOf(NIGHT).light.ambient);
  });

  it('moves the sun without a jump through the day, and hands the key to the moon through the dusk', () => {
    let last = null;
    for (let h = 0; h < 24; h += 0.1) {
      const L = hourLight(DAY, h);
      if (last) {
        expect(Math.abs(L.s - last.s), `s at ${h}`).toBeLessThan(0.12);
        if (!L.moonlit && !last.moonlit) expect(Math.abs(L.key.elevation - last.key.elevation), `elevation at ${h}`).toBeLessThan(2);
        expect(Math.abs(lum(L.dome.zenith) - lum(last.dome.zenith)), `zenith at ${h}`).toBeLessThan(15);
      }
      last = L;
    }
    expect(hourLight(DAY, 12).moonlit).toBe(false); expect(hourLight(DAY, 23).moonlit).toBe(true);
    expect(hourLight(DAY, readHour('dawn')).moonlit).toBe(false);
  });

  it('a night is darker than its day: the dome, the ambient and the key\'s gain', () => {
    for (const cube of [DAY, NIGHT]) {
      const d = hourLight(cube, 12), n = hourLight(cube, 23);
      expect(lum(n.dome.zenith)).toBeLessThan(lum(d.dome.zenith));
      expect(lum(n.dome.horizon)).toBeLessThan(lum(d.dome.horizon));
      expect(hexLum(n.ambient)).toBeLessThan(hexLum(d.ambient));
    }
    // the golden hour's horizon is warm, and the morning's is the day's again
    const g = hourLight(DAY, readHour('golden')).dome.horizon;
    expect(g[0]).toBeGreaterThan(g[2] + 40);
    expect(hourLight(DAY, readHour('morning')).dome).toEqual(hourLight(DAY, 12).dome);
  });
});

describe('a recipe\'s hour', () => {
  it('absent, the outside is the cube\'s own; at an hour, its look is lit by the hour and its air keeps its thickness', () => {
    const plain = lowerGeocube(DAY, 'outside'), golden = lowerGeocube(DAY, 'outside', undefined, readHour('golden'));
    expect(lowerGeocube(DAY, 'outside', undefined, undefined)).toEqual(plain);
    const a = lookOf(plain.kit), b = lookOf(golden.kit);
    expect(b.card.hour).toBe(17.5); expect(a.card.hour).toBeUndefined();
    expect(b.card.light.key.elevation).toBeLessThan(a.card.light.key.elevation);
    expect(b.card.air.fog.density).toBe(a.card.air.fog.density);
    expect(b.card.palette.rock).toEqual(a.card.palette.rock);
    expect(golden.meru).toEqual(plain.meru);
  });

  it('is the outside\'s: refused on a room, a room\'s show, and a trail in its own kit', () => {
    expect(() => withGeocube({ kind: 'stage', geocube: DAY.id, hour: 'noon' })).toThrow(/hour is the outside/);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: DAY.id, hour: 'noon' }, {}, assembleStageScene)).toThrow(/hour is the outside's/);
    expect(() => withGeocube({ kind: 'stage', geocube: DAY.id, hour: 'noon', trail: {}, kit: 'isekai-meadow' })).toThrow(/own kit/);
    expect(() => withGeocube({ kind: 'stage', geocube: DAY.id, hour: 'teatime', meru: true })).toThrow(/hour is a number/);
  });

  it('a moonlit hour draws the night on the island\'s dome: the moon where the key is, the stars out; a weather its clouds', () => {
    const P = assembleGeocubeScene({ kind: 'geocube', cube: DAY.id, show: 'land', walk: false, hour: 'night', clouds: 'fair' }, {}, assembleStageScene);
    expect(P.sky.day).toBeLessThan(0.5); expect(P.sky.stars).toBeGreaterThan(0); expect(P.sky.moon).toBeDefined();
    expect(P.sky.sun).toBeUndefined();
    expect(P.sky.clouds.src).toMatch(/^data:image\/png/);
  });
});

describe('a recipe\'s clouds', () => {
  it('leans the light as its cloud would, at the cube\'s own hour unless it names one; absent, no clouds', () => {
    const own = lookOf(lowerGeocube(DAY, 'outside', undefined, readHour(referenceHour(refOf(DAY))) ).kit).card;
    const fair = lookOf(lowerGeocube(DAY, 'outside', undefined, undefined, readClouds('fair')).kit).card;
    const grey = lookOf(lowerGeocube(DAY, 'outside', undefined, undefined, readClouds('overcast')).kit).card;
    expect(fair.light).toEqual(own.light); expect(fair.cloudBand.clouds.kind).toBe('fair');
    expect(grey.light.sunGain).toBeLessThan(own.light.sunGain);
    expect(grey.air.fog.density).toBeGreaterThan(own.air.fog.density);
    expect(grey.sun).toBeUndefined();
    expect(own.cloudBand).toBeUndefined(); expect(lookOf(lowerGeocube(DAY, 'outside').kit).card.cloudBand).toBeUndefined();
  });

  it('are the outside\'s, as the hour is', () => {
    expect(() => withGeocube({ kind: 'stage', geocube: DAY.id, clouds: 'fair' })).toThrow(/clouds are the outside/);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: DAY.id, clouds: 'fair' }, {}, assembleStageScene)).toThrow(/clouds are the outside's/);
    expect(() => withGeocube({ kind: 'stage', geocube: DAY.id, clouds: 'drizzle', meru: true })).toThrow(/clouds is one of/);
  });

  it('\'weather\' paints the sky of the recipe\'s live weather state, leaning only the sun\'s disc; a weather alone paints none', () => {
    const rain = withGeocube({ kind: 'stage', geocube: DAY.id, meru: true, weather: 'rain', clouds: 'weather' }), card = lookOf(rain.kit).card;
    expect(card.cloudBand.clouds.kind).toBe('storm'); expect(card.sun).toBeUndefined();
    expect(card.light).toEqual(lookOf(lowerGeocube(DAY, 'outside', undefined, readHour(referenceHour(refOf(DAY)))).kit).card.light);
    expect(rain.weather).toBe('rain');
    expect(withGeocube({ kind: 'stage', geocube: DAY.id, meru: true, weather: 'rain' })).toEqual(withGeocube({ kind: 'stage', geocube: DAY.id, meru: true, weather: 'rain' }));
    expect(lookOf(withGeocube({ kind: 'stage', geocube: DAY.id, meru: true, weather: 'rain' }).kit).card.cloudBand).toBeUndefined();
    expect(() => withGeocube({ kind: 'stage', geocube: DAY.id, meru: true, clouds: 'weather' })).toThrow(/names none/);
    expect(() => withGeocube({ kind: 'stage', geocube: DAY.id, meru: true, clouds: 'weather', weather: { climate: { rain: 1 } } })).toThrow(/climate/);
  });
});

// what is drawn in a ramp's stops rather than baked (a gritty crown's chips and cores, the live grass's windows, the
// rock flora) comes down the ramp by the hour against the cube's own light (era/isekai.js hourShift); the swatch-drawn
// flora dims by the same share (hourDim)
describe('the flora at an hour', () => {
  const cardAt = (cube, hour) => lookOf(lowerGeocube(cube, 'outside', undefined, hour).kit).card;
  const shiftOf = (st) => hourShift(st, st.tint.crown, st.palette.foliage);

  it('a cube\'s own palette comes down its ramps at night, and stays at its own hour; a cube with no hour has nothing to measure', () => {
    const night = cardAt(DAY, readHour('night')), own = cardAt(DAY, referenceHour(refOf(DAY)));
    expect(night.ownLight).toEqual(own.ownLight);
    expect(shiftOf(night)).toBeLessThan(0);
    expect(hourDim(night)).toBeLessThan(1);
    expect(shiftOf(own)).toBe(0); expect(hourDim(own)).toBe(1);
    expect('ownLight' in lookOf(lowerGeocube(DAY, 'outside').kit).card).toBe(false);
    expect(shiftOf(lookOf(lowerGeocube(DAY, 'outside').kit).card)).toBe(0);
  });

  it('a gritty cube\'s leaf card tile comes down the foliage with it', () => {
    const G = readGeocube({ from: DAY.id, grit: 0.7 }), tile = (h) => cardAt(G, h).tiles.leafcard.lit;
    const own = tile(referenceHour(refOf(DAY))), night = tile(readHour('night'));
    expect(Math.max(...night)).toBeLessThan(Math.max(...own));
    expect(lookOf(lowerGeocube(G, 'outside').kit).card.tiles.leafcard.lit).toEqual(own);
  });

  it('a night palette under its own moon is drawn as designed: no shift', () => {
    const own = cardAt(NIGHT, referenceHour(refOf(NIGHT)));
    expect(shiftOf(own)).toBe(0); expect(hourDim(own)).toBe(1);
  });

  it('moves a live grass\'s windows down by the shift, never below the ramp\'s first stop; by day the same object', () => {
    const w = { lit: [2, 4], shade: [0, 2] };
    expect(hourWin(w, 0)).toBe(w);
    expect(hourWin(w, -2)).toEqual({ lit: [0, 2], shade: [0, 0] });
  });
});
