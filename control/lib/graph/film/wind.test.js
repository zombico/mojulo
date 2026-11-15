import { describe, it, expect } from 'vitest';
import { WIND_WORDS, PLANT_WORDS, WIND_REACH, windErrors, windSpec } from './wind.js';
import { STATES } from '../weather/weather.js';
import { SPECIES } from '../vegetation/species.js';
import { sceneScreenplay, sceneStamp } from './film.js';
import { departmentOfPath, ADVICE_HOME } from './departments.js';

// the scene's wind: a word, a number, the weather's own, or its speed, gust and bearing; lowered to how a plant sways
const words = Object.keys(WIND_WORDS), soft = words.find((w) => WIND_WORDS[w] > 0 && WIND_WORDS[w] < 0.5), hard = words.find((w) => WIND_WORDS[w] === 1);
const windy = Object.keys(STATES).find((s) => STATES[s].wind > 0.4), calm = words.find((w) => WIND_WORDS[w] === 0);

describe('the scene\'s wind', () => {
  it('is a word, a number, the weather\'s own, or its speed, gust and bearing', () => {
    for (const v of [soft, 0.4, 'weather', { speed: hard, gust: 0.2, from: 90 }]) expect(windErrors(v)).toEqual([]);
    expect(windErrors('howling')[0]).toMatch(/wind: how hard the air moves/);
    expect(windErrors(3)[0]).toMatch(/0 to 1/);
    expect(windErrors({ speed: 0.5, force: 2 })[0]).toMatch(/not force/);
    expect(windErrors({ speed: 0.5, from: 400 })[0]).toMatch(/wind\.from/);
    expect(() => windSpec('weather')).toThrow(/give the scene a weather/);
  });

  it('bends a plant more the harder it blows, and still air performs nothing', () => {
    const S = windSpec(soft), H = windSpec(hard);
    expect(windSpec(calm)).toBeNull();
    expect(windSpec(0)).toBeNull();
    for (const k of ['lean', 'sway', 'hz', 'flutter']) expect(H[k]).toBeGreaterThan(S[k]);
    expect(S).toMatchObject({ speed: WIND_WORDS[soft], from: 250, reach: WIND_REACH });
    expect(windSpec({ speed: soft, from: 90, gust: 0 })).toMatchObject({ from: 90, gust: 0 });
    expect(windSpec(soft, { about: [3.14159, 2] }).about).toEqual([3.142, 2]);
    expect(JSON.stringify(windSpec(hard))).toBe(JSON.stringify(windSpec(hard)));
  });

  it('blows the weather\'s own wind when asked to', () => {
    expect(windSpec('weather', { weather: windy })).toMatchObject({ speed: STATES[windy].wind, gust: STATES[windy].gust });
  });

  it('knows a plant by the shelves\' words and the grower\'s species', () => {
    expect(PLANT_WORDS).toContain('tree');
    expect(PLANT_WORDS).toContain(Object.keys(SPECIES)[0].toLowerCase());
    expect(windSpec(soft).plants).toEqual([...PLANT_WORDS]);
  });

  it('is a scene\'s key, the look and light department\'s, and a change of it remakes the scene', () => {
    const F = { cast: { a: {} }, scenes: [{ id: 'x', wind: soft, cast: { a: {} }, script: 'A: Hi.' }] };
    expect(sceneScreenplay(F, 'x').wind).toBe(soft);
    expect(sceneStamp(F, 'x')).not.toBe(sceneStamp({ ...F, scenes: [{ ...F.scenes[0], wind: hard }] }, 'x'));
    expect(departmentOfPath('/scenes/0/wind')).toBe('look');
    expect(ADVICE_HOME['wind-unused']).toBe('look');
  });
});
