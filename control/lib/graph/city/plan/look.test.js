import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { cityBoxes, assembleCityScene } from './scene.js';
import { readPaint, lookLight, CITY_HAZE } from './look.js';
import { resolveLookSpec } from '../../era/look.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';

const recipe = (rec = {}) => ({ kind: 'city', ...inferCity({ seed: 3, grammar: 'paris', ...rec }).recipe });

describe('a city takes the world-wide look, and a geocube\'s paint', () => {
  it.each([
    [{ look: 'neon-noir' }, /unknown look 'neon-noir'/],
    [{ paint: 'jungle-haze' }, /paint is \{ geocube/],
    [{ paint: { geocube: 'atlantis' } }, /paint.geocube: .*not a preset/],
    [{ paint: { geocube: 'jungle-haze', amount: 2 } }, /paint.amount is how far/],
    [{ paint: { geocube: 'jungle-haze', colour: '#fff' } }, /paint.colour is not a paint setting/],
  ])('%j is refused by name', (rec, msg) => expect(() => readCityPlan(rec)).toThrow(msg));

  it('lights itself by the look\'s sun, or with none by a moon, never black', () => {
    const day = lookLight(resolveLookSpec('island-noon')), night = lookLight(resolveLookSpec('gothic-night'), readPaint({ geocube: 'gothic-night' }));
    expect(day.night).toBe(false);
    expect(night.night).toBe(true);
    expect(night.light.ambient).toBeGreaterThan(0.3);
  });
  it('a paint moves no street, lot or storey, and leans every skin toward the cube', () => {
    const a = designCity(recipe()), b = designCity(recipe({ paint: { geocube: 'jungle-haze', amount: 0.8 } }));
    expect(JSON.stringify(b.lots)).toBe(JSON.stringify(a.lots));
    const sa = cityBoxes(a), sb = cityBoxes(b);
    expect(sb.length).toBe(sa.length);
    expect(sb.filter((x, i) => x.skin.frame !== sa[i].skin.frame).length).toBeGreaterThan(sa.length * 0.9);
    expect(cityBoxes(designCity(recipe({ paint: { geocube: 'jungle-haze', amount: 0 } }))).map((x) => x.skin)).toEqual(sa.map((x) => x.skin));
  });
  it('the world-wide channel lays the look\'s air thinned for a city, the city lit by it', async () => {
    const { payload } = await resolveWorldScene({ ref: 'look-test', manifest: recipe({ look: 'gothic-night', fidelity: 'massing' }) });
    expect(payload.look).toEqual({ id: 'gothic-night', baked: false, lit: true });
    expect(payload.lookNote).toBeUndefined();
    expect(payload.haze.density).toBeCloseTo(resolveLookSpec('gothic-night').ref.air.fog.density * CITY_HAZE, 5);
  });
  it('a paint without a look lights and airs the city by its cube\'s own look', () => {
    const s = assembleCityScene(recipe({ paint: { geocube: 'jungle-haze' }, fidelity: 'massing' }));
    expect(s.city).toMatchObject({ look: 'jungle-haze', paint: 'jungle-haze' });
    expect(s.sky.day).toBe(1);
    expect(s.haze.density).toBeGreaterThan(0);
  });
});
