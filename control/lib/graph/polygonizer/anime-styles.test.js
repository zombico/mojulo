// anime-styles: the head casts (the style poles: a figure's scale and theme, lit alike, for any game). The concepts: the
// anime head's only, a known word; absent from a record, every hero as before; a minted adult on the formed head wears
// the default cast, and a child, a chibi, the studio's face, an older law or `null` none; a remake keeps the cast stored;
// a cast sits under the hero's own words (they compose on it) and is the base they move off; stored as its word beside a
// stamp that keeps the row when the table moves; each base's cast default advised nothing by its cast's bands (every
// cast swept in anime-styles.deep.test.js); the body skinnier, its neck slim, under a smaller head.
import { describe, it, expect } from 'vitest';
import { heroRecord, heroPlanOf, normalizeHero, validateHeroSpec, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { heroFaceRig } from './anime-face-rig.js';
import { animeHeroEffective, animeFaceBase, heroFeatureAdvice, heroHeadPole, heroHairPole } from './anime-looks.js';
import { ANIME_STYLES, ANIME_STYLE_NAMES, ANIME_STYLE_DEFAULT, animeStyleOf, resolveAnimeStyle } from './anime-styles.js';
import { withDefaultForm } from './motion-stamp.js';
import { heroRemakeOps } from '../../mcp/tools/hero-mint.js';
import { headOf } from './anime-drawings.fixture.js';

const STYLE = ANIME_STYLE_NAMES[0];

describe('the style pole', () => {
  it('is the anime head\'s, by a known word', () => {
    expect(validateHeroSpec({ cast: 'male', head: 'anime', animeStyle: STYLE })).toEqual([]);
    expect(validateHeroSpec({ cast: 'male', head: 'anime', animeStyle: 'shojo-low' })[0]).toMatch(/^animeStyle: one of /);
    expect(validateHeroSpec({ cast: 'male', animeStyle: STYLE })[0]).toMatch(/^animeStyle: the anime head's/);
  });
  it('absent, the hero as before; present, under the hero\'s own words, and the base they move off', () => {
    const plain = heroRecord({ cast: 'male', head: 'anime' });
    expect(plain.animeStyle).toBeUndefined(); expect(plain.animeStyleResolved).toBeUndefined();
    const styled = (spec = {}) => animeHeroEffective(heroRecord({ cast: 'male', head: 'anime', animeStyle: STYLE, ...spec }));
    const S = ANIME_STYLES[STYLE].male, own = styled({ face: { width: 1.02 } });
    expect(own.face.width).toBeCloseTo(styled().face.width * 1.02, 9);
    expect(styled().face.width).toBeCloseTo(animeHeroEffective(plain).face.width * S.face.width, 9);
    // (the style's words are not the hero's own: the hero moved off its base by its own word alone)
    const base = animeFaceBase(heroRecord({ cast: 'male', head: 'anime', animeStyle: STYLE, face: { width: 1.02 } }));
    expect(Object.entries(own.face).filter(([k, v]) => Math.abs(v - base[k]) > 1e-9).map(([k]) => k)).toEqual(['width']);
    // (the body: a smaller head on a leaner frame)
    expect(styled().tune.head).toBeLessThan(animeHeroEffective(plain).tune.head); expect(styled().tune.neckGirth).toBeLessThan(1); expect(styled().tune.upperArm).toBeLessThan(1);
  });
  it('is the minted adult\'s by default: Shonen High; none for a child, a chibi, the studio\'s face, an older law or null', () => {
    expect(ANIME_STYLE_DEFAULT).toBe('shonen-high');
    const minted = (spec) => heroRecord(withDefaultForm({ head: 'anime', ...spec }));
    expect(minted({ cast: 'female' }).animeStyleResolved).toEqual(resolveAnimeStyle(ANIME_STYLE_DEFAULT));
    // (a cast named is kept; null is the form's bare head)
    expect(minted({ cast: 'male', animeStyle: ANIME_STYLE_NAMES[1] }).animeStyle).toBe(ANIME_STYLE_NAMES[1]);
    for (const spec of [{ cast: 'male', animeStyle: null }, { cast: { pole: 'female', build: 'child' } }, { cast: 'chibi' }, { cast: 'male', sculpt: false }, { cast: 'male', laws: 18 }]) expect(minted(spec), JSON.stringify(spec)).not.toHaveProperty('animeStyle');
    // (the landmark head takes no cast)
    expect(withDefaultForm({ cast: 'male' })).not.toHaveProperty('animeStyle');
  });
  it('a remake keeps the cast stored when the order names none, and none when none was stored', () => {
    const remade = (order, was) => heroRemakeOps({ spec: { head: 'anime', cast: 'male', ...order } }, { hero: was })[0].value;
    expect(remade({}, heroRecord({ cast: 'male', head: 'anime', animeStyle: ANIME_STYLE_NAMES[1] })).animeStyle).toBe(ANIME_STYLE_NAMES[1]);
    expect(remade({}, heroRecord({ cast: 'male', head: 'anime' }))).not.toHaveProperty('animeStyle');
    expect(remade({ animeStyle: ANIME_STYLE_NAMES[2] }, heroRecord({ cast: 'male', head: 'anime' })).animeStyle).toBe(ANIME_STYLE_NAMES[2]);
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
  it('lends a cast another base\'s head: Shonen High\'s female wears the male head, tuned; her hair and her body her own', () => {
    const her = heroRecord({ cast: 'female', head: 'anime', animeStyle: STYLE }), him = heroRecord({ cast: 'male', head: 'anime', animeStyle: STYLE });
    expect(heroHeadPole(her)).toBe('male'); expect(heroHairPole(her)).toBe('female'); expect(heroHeadPole(heroRecord({ cast: 'female', head: 'anime' }))).toBe('female');
    // (her face is his with her layer on it: her eyes a little taller than his, her chin narrower)
    const F = animeHeroEffective(her).face, M = animeHeroEffective(him).face;
    expect(F.eyeHeight).toBeGreaterThan(M.eyeHeight); expect(F.eyeHeight).toBeLessThan(M.eyeHeight * 1.1); expect(F.chin).toBeLessThan(M.chin);
    expect(heroPlanOf(her).include[0].faceMeasures.features.eyeLevel).toBeCloseTo(heroPlanOf(him).include[0].faceMeasures.features.eyeLevel, 1);
    // (and her face rig is built on the head she wears: its targets, and 7G's at acting full)
    const rigOf = (spec) => { const M = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }); return heroFaceRig(M, compileLayered(M.recipe, M.dials)); };
    const R = rigOf({ cast: 'female', head: 'anime', animeStyle: STYLE, acting: 'full', register: 'lowpoly' });
    expect(R.skipped).toBeUndefined(); expect(R.meta.sevenG.targets).toBeGreaterThan(0);
  });
  it('squares the jaw\'s line (sculpt `jawLine`, Shonen High\'s): absent adds nothing; on, the underside behind the chin raised', () => {
    // (the lowest skin point a third to a half of the way back from the chin, of the head's height above the chin)
    const lowBehind = (spec) => {
      const m = headOf(spec), skin = m.vertices.filter((_, i) => m.provenance[i].part === 'face'), zs = skin.map((p) => p[2]), z0 = Math.min(...zs), chin = skin[zs.indexOf(z0)];
      const ys = skin.map((p) => p[1]), back = [Math.min(...ys), Math.max(...ys)].sort((a, b) => Math.abs(b - chin[1]) - Math.abs(a - chin[1]))[0], t = (p) => (p[1] - chin[1]) / (back - chin[1]);
      return (Math.min(...skin.filter((p) => t(p) > 1 / 3 && t(p) < 0.5).map((p) => p[2])) - z0) / (Math.max(...zs) - z0);
    };
    expect(headOf({ cast: 'female', sculpt: { jawLine: 0 } }).vertices).toEqual(headOf({ cast: 'female' }).vertices);
    expect(lowBehind({ cast: 'female', sculpt: { jawLine: 1 } })).toBeGreaterThan(lowBehind({ cast: 'female' }) + 0.008);
  });
  it('seats a head back on its neck (sculpt `seatBack`): the head moves back along its depth, the neck stays', () => {
    const at = (sculpt) => { const P = heroPlanOf(heroRecord({ cast: 'female', head: 'anime', hair: 'none', ...(sculpt ? { sculpt } : {}) })), m = compileLayered({ parts: P.include[0].parts, dials: {}, creases: {} }), ys = m.vertices.filter((_, i) => m.provenance[i].part === 'face').map((p) => p[1]); return { neck: P.joints.neckHub, lo: Math.min(...ys), hi: Math.max(...ys) }; };
    const A = at(null), B = at({ seatBack: 0.08 });
    expect(B.neck).toEqual(A.neck);
    // (the whole head the same distance back: the hero's forward is +y)
    expect(B.hi - A.hi).toBeLessThan(-0.005); expect(B.lo - A.lo).toBeCloseTo(B.hi - A.hi, 4);
  });
  it('advises each base\'s styled default nothing, by its style\'s bands over the form\'s', () => {
    for (const cast of ['male', 'female']) {
      const hero = heroRecord({ cast, head: 'anime', animeStyle: STYLE }), f = heroPlanOf(hero).include[0].faceMeasures.features;
      expect(heroFeatureAdvice(hero, f), cast).toEqual([]);
    }
  });
}, 300000);
