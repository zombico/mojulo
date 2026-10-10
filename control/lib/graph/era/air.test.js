import { describe, it, expect } from 'vitest';
import { airCard, airFromHaze, airColour, castOf, readAir } from './air.js';
import { ISEKAI_STYLES } from './isekai.js';
import { NATURE_STYLES } from './nature.js';
import { JUNGLE_STYLES } from './jungle.js';
import { STATES, STATE_NAMES, readWeather } from '../weather/weather.js';
import { airOfKit } from '../gameworld/style-guide.js';

describe('air: the style draws its own', () => {
  it('a cel kit is banded in its own steps, a painted one smooth; shade is the style\'s ambient, never black', () => {
    const cel = airCard(ISEKAI_STYLES['isekai-meadow']), nat = airCard(NATURE_STYLES['nature-trail']), jun = airCard(JUNGLE_STYLES['jungle-mgs3']);
    expect(cel).toMatchObject({ body: 'banded', hue: '#b4d8f0', shade: '#86aede' });
    expect(cel.steps).toBeGreaterThanOrEqual(3);
    expect(nat.body).toBe('smooth'); expect(jun.body).toBe('smooth');
    for (const c of [cel, nat, jun]) expect(c.shade).not.toBe('#000000');
    expect(airOfKit('isekai-meadow')).toEqual(cel);
    expect(airOfKit('no-such-kit')).toBeNull();
  });

  it('every state has a colour at every veil, never black, and the style may own a state\'s hue', () => {
    for (const k of ['isekai-meadow', 'alien-night']) {
      const c = airOfKit(k);
      for (const n of STATE_NAMES) for (const v of [0, 0.3, 0.75, 1]) {
        const col = airColour(c, n, v);
        expect(col.every((x) => x >= 0 && x <= 1.0001), `${k} ${n} ${v}`).toBe(true);
        expect(Math.max(...col)).toBeGreaterThan(0.08);
      }
    }
    const c = airCard(ISEKAI_STYLES['isekai-meadow']), dust = airColour(c, 'duststorm', STATES.duststorm.veil), clear = airColour(c, 'clear', STATES.clear.veil);
    expect(dust[0] - dust[2]).toBeGreaterThan(clear[0] - clear[2]);       // warmer than the clear air
    const own = airCard(ISEKAI_STYLES['isekai-meadow'], { states: { fog: { hue: '#ff0000' } } });
    expect(airColour(own, 'fog', 0.75)).toEqual([1, 0, 0]);
  });

  it('murk falls toward the shade as the veil falls, and light as it rises', () => {
    const c = airOfKit('isekai-meadow'), lum = (v) => airColour(c, 'rain', v).reduce((a, b) => a + b, 0);
    expect(lum(0.3)).toBeLessThan(lum(0.75)); expect(lum(0.75)).toBeLessThan(lum(1.0));
    const deep = airCard(ISEKAI_STYLES['isekai-meadow'], { depth: 1 });
    expect(airColour(deep, 'rain', 0.1).reduce((a, b) => a + b, 0)).toBeLessThan(airColour(c, 'rain', 0.1).reduce((a, b) => a + b, 0));
  });

  it('cast shadows follow the sun and the fog, under the card\'s ceiling', () => {
    const c = airOfKit('isekai-meadow');
    expect(castOf(STATES.clear, c)).toBeCloseTo(1, 5);
    expect(castOf(STATES.rain, c)).toBeLessThan(castOf(STATES.overcast, c));
    expect(castOf(STATES.fog, c)).toBeLessThan(castOf(STATES.overcast, c));
    expect(castOf(STATES.clear, { ...c, cast: 0.4 })).toBeCloseTo(0.4, 5);
  });

  it('a world with no kit gets an air made of its haze; the tuning reads with teaching errors', () => {
    expect(airFromHaze({ color: '#445566', density: 0.01 }).hue).toBe('#445566');
    expect(airFromHaze(null).body).toBe('smooth');
    expect(readAir({ body: 'dithered', steps: 3, shade: '#112233' })).toEqual({ body: 'dithered', steps: 3, shade: '#112233' });
    expect(() => readAir({ body: 'foggy' })).toThrow(/body is one of/);
    expect(() => readAir({ shade: 'red' })).toThrow(/#rrggbb/);
    expect(() => readAir({ depth: 2 })).toThrow(/0 to 1/);
    expect(() => readAir({ states: { sleet: { hue: '#aabbcc' } } }, 'air', STATE_NAMES)).toThrow(/not a weather state/);
    expect(readWeather({ climate: 'temperate', air: { cast: 0.5 } }).air).toEqual({ cast: 0.5 });
    expect(() => readWeather({ climate: 'temperate', air: { fog: 1 } })).toThrow(/not an air setting/);
  });
});
