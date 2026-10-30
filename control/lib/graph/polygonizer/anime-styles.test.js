// anime-styles: the style pole (a family of anime faces for a kind of game). The concepts: the anime head's only, a known
// word; absent, every hero as before; a style sits under the hero's own words (they compose on it) and is the base they
// move off; stored as its word beside a stamp that keeps the row when the table moves; each base's styled default
// advised nothing by its style's bands; the body skinnier, its neck slim, under a smaller head.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroPlanOf, normalizeHero, validateHeroSpec } from '../../mcp/tools/layered.js';
import { animeHeroEffective, animeFaceBase, heroFeatureAdvice } from './anime-looks.js';
import { ANIME_STYLES, ANIME_STYLE_NAMES, animeStyleOf, resolveAnimeStyle } from './anime-styles.js';

const STYLE = ANIME_STYLE_NAMES[0];

describe('the style pole', () => {
  it('is the anime head\'s, by a known word', () => {
    expect(validateHeroSpec({ cast: 'male', head: 'anime', animeStyle: STYLE })).toEqual([]);
    expect(validateHeroSpec({ cast: 'male', head: 'anime', animeStyle: 'shojo-low' })[0]).toMatch(/^animeStyle: one of /);
    expect(validateHeroSpec({ cast: 'male', animeStyle: STYLE })[0]).toMatch(/^animeStyle: the anime head's/);
  });
  it('absent, the hero as before; present, under the hero\'s own words, and the base they move off', () => {
    const plain = heroRecord({ cast: 'female', head: 'anime' });
    expect(plain.animeStyle).toBeUndefined(); expect(plain.animeStyleResolved).toBeUndefined();
    const styled = (spec = {}) => animeHeroEffective(heroRecord({ cast: 'female', head: 'anime', animeStyle: STYLE, ...spec }));
    const S = ANIME_STYLES[STYLE].female, own = styled({ face: { width: 1.02 } });
    expect(own.face.width).toBeCloseTo(styled().face.width * 1.02, 9);
    expect(styled().face.width).toBeCloseTo(animeHeroEffective(plain).face.width * S.face.width, 9);
    // (the style's words are not the hero's own: the hero moved off its base by its own word alone)
    const base = animeFaceBase(heroRecord({ cast: 'female', head: 'anime', animeStyle: STYLE, face: { width: 1.02 } }));
    expect(Object.entries(own.face).filter(([k, v]) => Math.abs(v - base[k]) > 1e-9).map(([k]) => k)).toEqual(['width']);
    // (the body: a smaller head on a leaner frame)
    expect(styled().tune.head).toBeLessThan(animeHeroEffective(plain).tune.head); expect(styled().tune.neckGirth).toBeLessThan(1); expect(styled().tune.upperArm).toBeLessThan(1);
  });
  it('is stored as its word beside a stamp: kept on the same word, renewed on another, dropped with it', () => {
    const hero = heroRecord({ cast: 'male', head: 'anime', animeStyle: STYLE });
    expect(hero.animeStyleResolved).toEqual(resolveAnimeStyle(STYLE));
    // (a stamp from before a re-tuning stays as it was while its word stands)
    const old = { ...hero, animeStyleResolved: { ...hero.animeStyleResolved, male: { ...hero.animeStyleResolved.male, face: { ...hero.animeStyleResolved.male.face, width: 0.9 } } } };
    expect(animeStyleOf(normalizeHero(old), 'male').face.width).toBe(0.9);
    expect(normalizeHero({ ...old, animeStyleResolved: { ...old.animeStyleResolved, word: 'another' } }).animeStyleResolved).toEqual(resolveAnimeStyle(STYLE));
    const off = normalizeHero({ ...hero, animeStyle: null });
    expect(off).not.toHaveProperty('animeStyle'); expect(off).not.toHaveProperty('animeStyleResolved');
  });
  it('advises each base\'s styled default nothing, by its style\'s bands over the form\'s', () => {
    for (const cast of ['male', 'female']) {
      const hero = heroRecord({ cast, head: 'anime', animeStyle: STYLE }), f = heroPlanOf(hero).include[0].faceMeasures.features;
      expect(heroFeatureAdvice(hero, f), cast).toEqual([]);
    }
  });
}, 300000);
