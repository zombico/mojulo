import { describe, it, expect } from 'vitest';
import { CLOUD_KINDS, CLOUDS_FILE, cloudsErrors, cloudsSpec, cloudsPng } from './clouds.js';
import { WEATHERS } from '../matte-paint/sky.js';
import { sceneScreenplay, sceneStamp } from './film.js';
import { departmentOfPath, ADVICE_HOME } from './departments.js';

// the scene's clouds: one of the world's own skies, lowered to the film's light and painted as the band its sky wears
const full = CLOUD_KINDS.find((k) => cloudsSpec(k).sky), open = CLOUD_KINDS.find((k) => WEATHERS[k].light.disc && cloudsSpec(k).sun > 0.8);

describe('the scene\'s clouds', () => {
  it('are one of the world\'s skies, by name or as a recipe says them', () => {
    expect(CLOUD_KINDS).toEqual(Object.keys(WEATHERS));
    expect(cloudsErrors(open)).toEqual([]);
    expect(cloudsErrors({ kind: full, cover: 0.8, seed: 3 })).toEqual([]);
    expect(cloudsErrors('fluffy')[0]).toMatch(/^clouds: the sky over the scene.*one of/);
    expect(cloudsErrors({ kind: open, cover: 2 })[0]).toMatch(/cover/);
  });

  it('let less sun through and soften it as they close, and a full cover is a grey sky', () => {
    const O = cloudsSpec(open), F = cloudsSpec(full);
    expect(O).toMatchObject({ kind: open, cover: 0.5, seed: 1, band: CLOUDS_FILE, top: 62 });
    expect(O.sky).toBeUndefined();
    expect(F.sun).toBeLessThan(O.sun);
    expect(F.soften).toBeGreaterThan(O.soften);
    expect(F.sky.color).toHaveLength(3);
    // (the same sky thinner: more sun, a harder shadow, and the hour's own sky behind it)
    const thin = cloudsSpec({ kind: full, cover: 0.2 }), thick = cloudsSpec({ kind: full, cover: 0.9 });
    expect(thin.sun).toBeGreaterThan(F.sun);
    expect(thick.sun).toBeLessThan(F.sun);
    expect(thin.soften).toBeLessThan(F.soften);
    expect(thin.sky).toBeUndefined();
    expect(cloudsSpec({ kind: open, cover: 0 })).toMatchObject({ sun: 1, soften: 0.6 });
  });

  it('are painted for the film\'s sun at the scene\'s hour, the same bytes twice, another seed another sky', () => {
    const small = { W: 96, H: 24 }, day = cloudsPng(cloudsSpec(open), small);
    expect(day.subarray(1, 4).toString()).toBe('PNG');
    expect(Buffer.compare(day, cloudsPng(cloudsSpec(open), small))).toBe(0);
    expect(Buffer.compare(day, cloudsPng(cloudsSpec({ kind: open, seed: 2 }), small))).not.toBe(0);
    expect(Buffer.compare(day, cloudsPng(cloudsSpec(open, { preset: 'dusk' }), { ...small, preset: 'dusk' }))).not.toBe(0);
    // (the sun stands lower at dusk, and the band is dimmer against a night sky than a day's)
    expect(cloudsSpec(open, { preset: 'dusk' }).elevation).toBeLessThan(cloudsSpec(open).elevation);
    expect(cloudsSpec(open, { preset: 'night' }).gain).toBeLessThan(cloudsSpec(open).gain);
  });

  it('are a scene\'s key, the look and light department\'s, and a change of them remakes the scene', () => {
    const F = { cast: { a: {} }, scenes: [{ id: 'x', clouds: open, cast: { a: {} }, script: 'A: Hi.' }] };
    expect(sceneScreenplay(F, 'x').clouds).toBe(open);
    expect(sceneStamp(F, 'x')).not.toBe(sceneStamp({ ...F, scenes: [{ ...F.scenes[0], clouds: full }] }, 'x'));
    expect(departmentOfPath('/scenes/0/clouds')).toBe('look');
    expect(ADVICE_HOME['clouds-unused']).toBe('look');
  });
});
