/**
 * A gritty cube's city painted from relief (dress.js): the wall a facade's windows are cut through, and its sidewalks;
 * glass, windows and roads as they were; a quiet cube's city byte for byte.
 */
import { describe, expect, it } from 'vitest';

import { cityDressOf, dressCity } from './dress.js';
import { readPaint } from './look.js';
import { assembleCityScene } from './scene.js';
import { geocubeCity } from '../../era/geocube-city.js';
import { expandSurfaceCards, projectCardOntoQuad } from '../../architecture/facade-card.js';
import { CITY_METERS_PER_UNIT } from '../fractal-city.js';

const U = CITY_METERS_PER_UNIT, city = (cube) => assembleCityScene(geocubeCity({ kind: 'geocube', cube, show: 'city', seed: 3 }).city);

describe('a city\'s dress', () => {
  it('is a gritty cube\'s alone: a quiet cube\'s city carries none, and its faces are the plain paint\'s', () => {
    expect(cityDressOf(readPaint({ geocube: 'valley-morning' }), U)).toBeNull();
    const D = cityDressOf(readPaint({ geocube: 'limestone-crags' }), U);
    expect(Object.keys(D.walls).sort()).toEqual(['banded', 'pier', 'punched']);
    expect(D.walls.pier.unit).toBe(U);
    const quiet = city('valley-morning');
    expect(quiet.faces.some((f) => f.texture || f.card?.dress)).toBe(false);
    expect(dressCity(quiet.faces, readPaint({ geocube: 'valley-morning' }), U)).toBeNull();
  });

  it('dresses the wall a facade\'s windows are cut through, and the sidewalks; a curtain wall and the roads keep theirs', () => {
    const P = city('limestone-crags'), cards = P.faces.filter((f) => f.card);
    expect(cards.filter((f) => ['punched', 'pier', 'banded'].includes(f.card.rhythm)).every((f) => f.card.dress)).toBe(true);
    expect(cards.filter((f) => ['curtain', 'grid'].includes(f.card.rhythm)).some((f) => f.card.dress)).toBe(false);
    expect(P.faces.filter((f) => f.group === 'city:walk').every((f) => /^detail:/.test(f.texture || ''))).toBe(true);
    expect(P.faces.some((f) => f.group === 'city:road' && f.texture)).toBe(false);
    // every tile a face or a card names is served with the payload
    const keys = new Set([...P.faces.map((f) => f.texture).filter(Boolean), ...cards.flatMap((f) => f.card.dress?.keys ?? [])].filter((k) => k.startsWith('detail:')));
    for (const k of keys) expect(P.textures[k], k).toMatch(/^data:image\/png/);
  });
});

describe('a dressed card, realized', () => {
  const P = city('limestone-crags'), f = P.faces.find((x) => x.card?.dress && x.card.rhythm === 'pier');
  it('lays the stone on the shirt\'s facets, world-locked in metres; the windows\' body behind is as it was', () => {
    const plain = projectCardOntoQuad(f.corners, { ...f.card, dress: undefined }, { lit: f.lit }), dressed = projectCardOntoQuad(f.corners, f.card, { lit: f.lit });
    expect(dressed.length).toBe(plain.length);
    expect(dressed[0]).toEqual(plain[0]);
    const shirt = dressed.slice(1).filter((x) => x.texture);
    expect(shirt.length).toBeGreaterThan(0);
    expect(shirt.every((x) => f.card.dress.keys.includes(x.texture) && x.textureLit)).toBe(true);
    // (a metre on the wall is unit / metres of the tile: a facet's u span is its width so measured)
    const x = shirt[0], us = x.uv.map((p) => p[0]), xs = x.corners.map((p) => p[0]), ys = x.corners.map((p) => p[1]);
    const w = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo((w * U) / f.card.dress.metres, 2);
  });
  it('a card without a dress is realized as before', () => {
    const g = { ...f, card: { ...f.card, dress: undefined } };
    expect(JSON.stringify(expandSurfaceCards([g]))).toBe(JSON.stringify(projectCardOntoQuad(g.corners, g.card, { lit: g.lit })));
  });
});
