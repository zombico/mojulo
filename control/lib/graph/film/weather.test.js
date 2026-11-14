import { describe, it, expect } from 'vitest';
import { weatherSpec, WEATHER_STATES, WEATHER_REACH } from './weather.js';
import { CLOUDS_OF_WEATHER } from '../matte-paint/sky.js';
import { filmErrors, sceneScreenplay, sceneStamp } from './film.js';
import { departmentOfPath, ADVICE_HOME } from './departments.js';

// the scene's weather: one of the world's own states, lowered to what the Blender light performs
const stateOf = (pred) => WEATHER_STATES.find((s) => pred(weatherSpec(s)));

describe('the scene\'s weather', () => {
  it('is one of the world\'s weather states, each with its sky\'s cover', () => {
    for (const s of WEATHER_STATES) expect(weatherSpec(s)).toMatchObject({ state: s, cover: CLOUDS_OF_WEATHER[s] });
    expect(() => weatherSpec('sunny')).toThrow(/weather is one of clear,/);
    // (things on the wind are not a film's weather)
    expect(WEATHER_STATES).not.toContain('petals');
  });

  it('lets less sun through, and softer, the more the sky is covered', () => {
    const clear = weatherSpec('clear'), over = weatherSpec('overcast'), storm = weatherSpec(stateOf((w) => w.cover === 'storm'));
    expect(clear).toMatchObject({ sun: 1 });
    expect(clear.sky).toBeUndefined();
    expect(clear.air).toBeUndefined();
    expect(over.sun).toBeLessThan(clear.sun);
    expect(storm.sun).toBeLessThan(over.sun);
    expect(over.soften).toBeGreaterThan(clear.soften);
    // under cloud the sky is the cloud: one grey light
    expect(over.sky.color).toHaveLength(3);
    expect(storm.sky.color[0]).toBeLessThan(over.sky.color[0]);
  });

  it('thickens the air for a mist and a fog, and says what falls and where', () => {
    const mist = weatherSpec('mist'), fog = weatherSpec('fog');
    expect(fog.air.density).toBeGreaterThan(mist.air.density);
    expect(weatherSpec('drizzle').rain).toBeLessThan(weatherSpec('downpour').rain);
    expect(weatherSpec('snow').snow).toBeLessThan(weatherSpec('blizzard').snow);
    expect(weatherSpec('rain').snow).toBeUndefined();
    expect(weatherSpec('rain', { about: [3.14159, 2, 1] })).toMatchObject({ about: [3.142, 2, 1], reach: WEATHER_REACH });
    expect(JSON.stringify(weatherSpec('rain'))).toBe(JSON.stringify(weatherSpec('rain')));
  });

  it('rides a film\'s scene into its screenplay, and belongs to the look and light department', () => {
    const F = { cast: { a: {} }, scenes: [{ id: 'x', weather: 'rain', cast: { a: {} }, script: 'A: Hi.' }] };
    expect(filmErrors(F)).toEqual([]);
    expect(sceneScreenplay(F, 'x').weather).toBe('rain');
    expect(sceneStamp(F, 'x')).not.toBe(sceneStamp({ ...F, scenes: [{ ...F.scenes[0], weather: 'snow' }] }, 'x'));
    expect(departmentOfPath('/scenes/0/weather')).toBe('look');
    expect(ADVICE_HOME['weather-unused']).toBe('look');
  });
});
