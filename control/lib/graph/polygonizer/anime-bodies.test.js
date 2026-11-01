// anime-bodies: the body codenames, each a dyad (a simplified form, a body tune; a muscular form, a muscle card worn over
// the same base). The concepts: a word is checked against the pole and the anime head; the base's codenames draw the
// Z-Fighter body as it was; a codename's tune stands for the style's body, the style's head kept; the muscular form wears
// the codename's own card; the door stores a resolved stamp.
import { describe, it, expect } from 'vitest';
import { ANIME_BODIES, ANIME_BODY_NAMES, validateAnimeBody, resolveAnimeBody } from './anime-bodies.js';
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
    expect(hero.animeBodyResolved).toEqual(resolveAnimeBody('maki'));
    const worn = expandLayeredManifest({ kind: 'layered', hero }).recipe;
    const own = muscleShirt(mint({ animeStyle: 'z-fighter', cast: 'female', animeBody: 'maki' }), { card: 'maki', definition: 1 });
    expect(worn.parts.torso.stations).toEqual(own.recipe.parts.torso.stations);
  });
});
