import { describe, expect, it } from 'vitest';

import { resolveTheme, listThemes, hasTheme, registerTheme } from './theme-registry.js';
import { cityThemeAdapter } from './city/fractal-city.js';

// The composer's PURE core: theme resolution + the city adapter that lowers abstract slots
// onto mintFractalCity params. The DB-minting path (composeWorld) is exercised at runtime,
// not here — these tests touch no SketchRepository / no headless render.

describe('theme-registry', () => {
  it('resolves the shipped packs and reports them', () => {
    expect(hasTheme('earth-temperate')).toBe(true);
    expect(resolveTheme('mars-colony').family).toBe('scifi');
    const ids = listThemes().map((t) => t.id);
    expect(ids).toEqual(['earth-temperate', 'old-world-europe', 'pacifica-tropical', 'mars-colony']);
  });

  it('filters by family', () => {
    expect(listThemes({ family: 'scifi' }).map((t) => t.id)).toEqual(['mars-colony']);
    expect(listThemes({ family: 'earth' }).length).toBe(3);
  });

  it('throws on an unknown theme, naming the known ids', () => {
    expect(() => resolveTheme('atlantis')).toThrow(/unknown theme 'atlantis'/);
    expect(() => resolveTheme('atlantis')).toThrow(/earth-temperate/);
  });

  it('registers with sane defaults for optional fields', () => {
    registerTheme({ id: '__test-minimal' });
    const p = resolveTheme('__test-minimal');
    expect(p.family).toBe('earth');
    expect(p.slots).toEqual({});
  });
});

describe('cityThemeAdapter', () => {
  it('is the IDENTITY for earth-temperate (empty params → bare create_fractal_city)', () => {
    expect(cityThemeAdapter(resolveTheme('earth-temperate').slots)).toEqual({});
  });

  it('lowers old-world-europe slots onto city knobs', () => {
    expect(cityThemeAdapter(resolveTheme('old-world-europe').slots)).toEqual({
      locale: 'europe',
      climate: 'temperate',
      time: 'day',
      elements: { townhouses: true, religiousPlaces: true, streetcars: true },
    });
  });

  it('lowers mars-colony massing + asset slots', () => {
    expect(cityThemeAdapter(resolveTheme('mars-colony').slots)).toEqual({
      time: 'night',
      density: 0.8,
      depth: 3,
      anchor: 'tower',
      elements: { civicDomes: true, cityTrees: false, parkDoodads: false, religiousPlaces: false, powerLines: true },
    });
  });

  it('maps a monument slot to landmark and civic to civicAreas', () => {
    const out = cityThemeAdapter({ asset: { monument: 'eiffel-tower', civic: ['city-park', 'town-square'] } });
    expect(out).toEqual({ landmark: 'eiffel-tower', civicAreas: ['city-park', 'town-square'] });
  });

  it('IGNORES slots the city base cannot render (material / style)', () => {
    const out = cityThemeAdapter({
      context: { time: 'day' },
      material: { wall: 'rock-granite' },
      style: { wallStyle: 'cave' },
    });
    expect(out).toEqual({ time: 'day' });
  });

  it('drops out-of-vocabulary scalar values (defensive)', () => {
    expect(cityThemeAdapter({ context: { time: 'twilight' }, asset: { anchor: 'spire' } })).toEqual({});
  });
});
