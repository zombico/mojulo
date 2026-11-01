// anime-bodies: the body codenames, each a dyad (a simplified form, a body tune; a muscular form, a muscle card worn over
// the same base). The concepts: a word is checked against the pole and the anime head; the base's codenames draw the
// Z-Fighter body as it was; a codename's tune stands for the style's body, the style's head kept; the muscular form wears
// the codename's own card; the door stores a resolved stamp.
import { describe, it, expect } from 'vitest';
import { ANIME_BODIES, ANIME_BODY_NAMES, validateAnimeBody, resolveAnimeBody, headFit, neckFit, HEAD_SIZE, FIT_ALPHA } from './anime-bodies.js';
import { normalizeHero } from '../../mcp/tools/layered.js';
import { MUSCLE_CARDS, validateMuscleCard, muscleShirt } from '../musculature/index.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from './motion-stamp.js';

const mint = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ head: 'anime', ...spec })) }).recipe;

describe('the body codenames', () => {
  it('names each body a pole and a card the shirt knows, and refuses a word, a pole or a head that is not its', () => {
    for (const n of ANIME_BODY_NAMES) { expect(['male', 'female', null]).toContain(ANIME_BODIES[n].pole); expect(validateMuscleCard(MUSCLE_CARDS[ANIME_BODIES[n].card])).toEqual([]); }
    expect(validateAnimeBody('satoru', 'male')).toEqual([]);
    expect(validateAnimeBody('satoru', 'female')[0]).toMatch(/male body/);
    expect(validateAnimeBody('gojo')[0]).toMatch(/one of/);
    expect(() => heroRecord({ animeBody: 'satoru' })).toThrow(/head: 'anime'/);
  });
  it('draws the base as the Z-Fighter body was, the style\'s head kept: Toji and Mizuki', () => {
    for (const [cast, body] of [['male', 'toji'], ['female', 'mizuki']]) {
      expect(mint({ animeStyle: 'z-fighter', cast, animeBody: body }).parts).toEqual(mint({ animeStyle: 'z-fighter', cast }).parts);
    }
  });
  it('names Shonen High\'s body, either pole: the default drawn as it was, and under another head the lead\'s lean body', () => {
    const half = (r) => Math.abs((r.rig.joints.shoulderR.at ?? r.rig.joints.shoulderR)[0]);
    for (const cast of ['male', 'female']) {
      expect(mint({ cast, animeBody: 'shonen-high' }).parts).toEqual(mint({ cast }).parts);
      const zf = mint({ animeStyle: 'z-fighter', cast, animeBody: 'shonen-high' });
      expect(half(zf)).toBeCloseTo(half(mint({ cast })), 3);
      expect(heroRecord(withDefaultForm({ head: 'anime', cast, animeBody: 'shonen-high' })).animeBodyResolved.pole).toBe(cast);
    }
  }, 120000);
  it('lays the slim body over any head: Satoru narrower than Toji, broader in the shoulder than Shonen High\'s own', () => {
    const half = (r) => Math.abs((r.rig.joints.shoulderR.at ?? r.rig.joints.shoulderR)[0]);
    const satoru = mint({ animeStyle: 'shonen-high', animeBody: 'satoru' }), toji = mint({ animeStyle: 'shonen-high', animeBody: 'toji' }), sh = mint({ animeStyle: 'shonen-high' });
    expect(half(satoru)).toBeLessThan(half(toji));
    expect(half(satoru)).toBeGreaterThan(half(sh));
  });
  it('orders each pole slim, base, hulking: by the shoulder\'s width and the arm\'s girth, the simplified form and the muscular', () => {
    const half = (r) => Math.abs((r.rig.joints.shoulderR.at ?? r.rig.joints.shoulderR)[0]);
    const arm = (r) => Math.max(...r.parts.upperArmR.stations.map((x) => { const ps = Object.values(x.points), c = ps.reduce((a, p) => a.map((v, k) => v + p[k] / ps.length), [0, 0, 0]); return ps.reduce((a, p) => a + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / ps.length; }));
    for (const [cast, names] of [['male', ['satoru', 'toji', 'armstrong']], ['female', ['maki', 'mizuki', 'kale']]]) {
      // (the muscular forms, each over its simplified form's base: the shoulder's width is the base's own)
      const worn = names.map((b) => mint({ animeStyle: 'z-fighter', cast, animeBody: b, muscleShirt: { definition: 1 } }));
      expect(half(worn[0])).toBeLessThan(half(worn[1])); expect(half(worn[1])).toBeLessThan(half(worn[2]));
      expect(arm(worn[0])).toBeLessThan(arm(worn[1])); expect(arm(worn[1])).toBeLessThan(arm(worn[2]));
    }
  }, 120000);
  it('wears the codename\'s own card as its muscular form, and stores a resolved stamp', () => {
    const hero = heroRecord(withDefaultForm({ head: 'anime', animeStyle: 'z-fighter', cast: 'female', animeBody: 'maki', muscleShirt: { definition: 1 } }));
    expect(hero.animeBodyResolved).toEqual(resolveAnimeBody('maki', 'female', 'z-fighter'));
    const worn = expandLayeredManifest({ kind: 'layered', hero }).recipe;
    const own = muscleShirt(mint({ animeStyle: 'z-fighter', cast: 'female', animeBody: 'maki' }), { card: 'maki', definition: 1 });
    expect(worn.parts.torso.stations).toEqual(own.recipe.parts.torso.stations);
  });
});

describe('the head fitted to the body', () => {
  // (the head's width: the widest of the head's own parts; the stature its top)
  const headW = (r) => { let m = 0; for (const [id, P] of Object.entries(r.parts)) { if (!/^(cranium|head|face|skull)/i.test(id)) continue; for (const st of P.stations || []) for (const p of Object.values(st.points)) m = Math.max(m, Math.abs(p[0])); } return 2 * m; };
  const unfitted = (spec) => { const h = heroRecord(withDefaultForm({ head: 'anime', ...spec })); const { fit: _f, ...R } = h.animeBodyResolved; return expandLayeredManifest({ kind: 'layered', hero: { ...h, animeBodyResolved: R } }).recipe; };
  it('holds each style\'s head size against Shonen High\'s, measured on one body per pole', () => {
    for (const [cast, body] of [['male', 'satoru'], ['female', 'mizuki']]) {
      const base = headW(unfitted({ cast, animeStyle: 'shonen-high', animeBody: body }));
      for (const style of Object.keys(HEAD_SIZE[cast])) expect(headW(unfitted({ cast, animeStyle: style, animeBody: body })) / base, `${cast} ${style}`).toBeCloseTo(HEAD_SIZE[cast][style], 1);
    }
  }, 120000);
  it('fits a foreign head half the way to the body\'s home head, and none under the home style', () => {
    expect(headFit('toji', 'male', 'z-fighter')).toBe(1);
    expect(headFit('satoru', 'male', 'shonen-high')).toBe(1);
    expect(headFit('satoru', 'male', 'z-fighter')).toBeCloseTo((1 / HEAD_SIZE.male['z-fighter']) ** FIT_ALPHA, 4);
    expect(headFit('toji', 'male', 'shonen-high')).toBeGreaterThan(1);
    // (on the body: the worn head between its own size and the home head's)
    const own = headW(unfitted({ cast: 'male', animeStyle: 'school-kid-hero', animeBody: 'toji' }));
    const home = headW(unfitted({ cast: 'male', animeStyle: 'z-fighter', animeBody: 'toji' }));
    const fitted = headW(mint({ animeStyle: 'school-kid-hero', cast: 'male', animeBody: 'toji' }));
    expect(fitted).toBeLessThan(own);
    expect(fitted).toBeGreaterThan(home);
  }, 120000);
  it('fits again when the style changes, and leaves a row minted before without a fit as it was', () => {
    const h = heroRecord(withDefaultForm({ head: 'anime', cast: 'male', animeStyle: 'z-fighter', animeBody: 'satoru' }));
    expect(h.animeBodyResolved.fit).toEqual({ style: 'z-fighter', head: headFit('satoru', 'male', 'z-fighter'), neck: neckFit('satoru', 'male', 'z-fighter') });
    expect(normalizeHero({ ...h, animeStyle: 'shonen-high', animeStyleResolved: undefined }).animeBodyResolved.fit).toEqual({ style: 'shonen-high', head: 1, neck: 1 });
    const { fit: _f, ...old } = h.animeBodyResolved, before = { ...h, animeBodyResolved: old };
    expect(normalizeHero(before).animeBodyResolved).toEqual(old);
  });
  it('stands a bigger foreign head on a thicker neck and a smaller on a slimmer, the join nearer the home pair\'s', () => {
    const neckW = (r) => { let m = 0; for (const [id, P] of Object.entries(r.parts)) { if (!/^neck/i.test(id)) continue; for (const st of P.stations || []) for (const p of Object.values(st.points)) m = Math.max(m, Math.abs(p[0])); } return 2 * m; };
    expect(neckFit('toji', 'male', 'z-fighter')).toBe(1);
    expect(neckFit('toji', 'male', 'school-kid-hero')).toBeGreaterThan(1);
    expect(neckFit('armstrong', 'male', 'shonen-high')).toBeLessThan(1);
    const join = (r) => neckW(r) / headW(r);
    const home = join(unfitted({ cast: 'male', animeStyle: 'z-fighter', animeBody: 'toji' }));
    const h = heroRecord(withDefaultForm({ head: 'anime', cast: 'male', animeStyle: 'school-kid-hero', animeBody: 'toji' }));
    const { neck: _n, ...headOnly } = h.animeBodyResolved.fit;
    const without = join(expandLayeredManifest({ kind: 'layered', hero: { ...h, animeBodyResolved: { ...h.animeBodyResolved, fit: headOnly } } }).recipe);
    const withNeck = join(expandLayeredManifest({ kind: 'layered', hero: h }).recipe);
    expect(Math.abs(withNeck - home)).toBeLessThan(Math.abs(without - home));
  }, 120000);
});

