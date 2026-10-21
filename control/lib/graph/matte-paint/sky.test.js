/**
 * The painted sky (sky.js): a cloud band round the dome from a weather's sheets, in an hour's light. Small bands keep it
 * quick: the laws are the same at full size.
 */
import { describe, expect, it } from 'vitest';

import { WEATHERS, readWeather, paintCloudBand, cloudBand } from './sky.js';
import { skyDomeScript } from '../scene/channels/sky-dome.js';

const SIZE = { W: 256, H: 48 };
const spec = (weather, more = {}) => ({ weather: readWeather(weather), sun: [-0.37, -0.37, 0.85], key: '#fff4d8', zenith: [90, 140, 200], horizon: [207, 225, 236], night: 0, ...more });
const alpha = (B) => { let s = 0; for (let k = 3; k < B.rgba.length; k += 4) s += B.rgba[k]; return s / (B.W * B.H * 255); };
// the mean lit value of the cloud a band holds (weighted by its alpha)
const cloudLum = (B) => { let s = 0, w = 0; for (let k = 0; k < B.rgba.length; k += 4) { const a = B.rgba[k + 3]; s += a * (B.rgba[k] + B.rgba[k + 1] + B.rgba[k + 2]) / 3; w += a; } return s / w; };

describe('a weather', () => {
  it('is a word, or { kind, cover, seed }; anything else is refused', () => {
    expect(readWeather('fair')).toEqual({ kind: 'fair', cover: 0.5, seed: 1 });
    expect(readWeather({ kind: 'storm', cover: 0.8, seed: 3 })).toEqual({ kind: 'storm', cover: 0.8, seed: 3 });
    for (const bad of ['drizzle', { kind: 'fair', cover: 2 }, { kind: 'fair', wind: 1 }, { cover: 0.5 }, { kind: 'fair', seed: 1.5 }]) expect(() => readWeather(bad)).toThrow(/weather/);
  });
});

describe('a cloud band', () => {
  const fair = paintCloudBand(spec('fair'), SIZE);

  it('wraps round the dome without a seam: the step from its last column to its first is no bigger than a step inside', () => {
    const at = (B, x, y, c) => B.rgba[(y * B.W + x) * 4 + c];
    let seam = 0, inside = 0;
    for (let y = 0; y < fair.H; y++) for (let c = 0; c < 4; c++) { seam += Math.abs(at(fair, fair.W - 1, y, c) - at(fair, 0, y, c)); inside += Math.abs(at(fair, fair.W / 2, y, c) - at(fair, fair.W / 2 - 1, y, c)); }
    expect(seam).toBeLessThan(2 * inside + fair.H * 4);
  });

  it('is the same bytes for the same sky, and another for another seed', () => {
    expect(Buffer.compare(paintCloudBand(spec('fair'), SIZE).rgba, fair.rgba)).toBe(0);
    expect(Buffer.compare(paintCloudBand(spec({ kind: 'fair', seed: 2 }), SIZE).rgba, fair.rgba)).not.toBe(0);
  });

  it('covers as its weather and cover say: an overcast more than a clear sky, more cover more cloud', () => {
    expect(alpha(paintCloudBand(spec('overcast'), SIZE))).toBeGreaterThan(alpha(paintCloudBand(spec('clear'), SIZE)) + 0.3);
    expect(alpha(paintCloudBand(spec({ kind: 'fair', cover: 0.8 }), SIZE))).toBeGreaterThan(alpha(paintCloudBand(spec({ kind: 'fair', cover: 0.2 }), SIZE)));
  });

  it('is lit by the hour: a night\'s cloud darker than a day\'s, a storm\'s darker than a fair one\'s', () => {
    const night = paintCloudBand(spec('fair', { key: '#9fb0e0', zenith: [0, 12, 33], horizon: [21, 34, 42], night: 1, sun: [0.41, -0.71, 0.56] }), SIZE);
    expect(cloudLum(night)).toBeLessThan(cloudLum(fair) * 0.5);
    expect(cloudLum(paintCloudBand(spec('storm'), SIZE))).toBeLessThan(cloudLum(fair));
  });

  it('every weather paints, and leans the light the way its cloud would', () => {
    for (const kind of Object.keys(WEATHERS)) expect(alpha(paintCloudBand(spec(kind), SIZE)), kind).toBeGreaterThan(0.01);
    expect(WEATHERS.overcast.light.gain).toBeLessThan(1); expect(WEATHERS.overcast.light.disc).toBe(false); expect(WEATHERS.fair.light.gain).toBe(1);
  });
});

describe('the dome', () => {
  it('draws a band only where a sky carries one: without, its script is as it was', () => {
    const sky = { space: false, zenith: [90, 140, 200], horizon: [207, 225, 236], day: 1, stars: 0, seed: 1, moon: null, sun: null, center: [0, 0, 0], radius: 50 };
    expect(skyDomeScript(sky)).not.toMatch(/cloud band/);
    const B = cloudBand(spec('fair'));
    expect(B.src).toMatch(/^data:image\/png;base64,/);
    expect(skyDomeScript({ ...sky, clouds: B })).toMatch(/cloud band/);
  });
});
