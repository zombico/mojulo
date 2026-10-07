// GENKI on the anime hero (anime-genki.js): one more layer over the look and the own layer, composed as every anime layer
// is; absent and 0 change nothing (the zero law); the door stores it only when it adds something; the stand moves after
// it resolves; a genki hero still mints through the rig gates, dressed and geared.
import { describe, expect, it } from 'vitest';
import { GENKI, validateGenki, genkiLayers, genkiExpression, genkiStand } from './anime-genki.js';
import { composeAnime, animeHeroEffective } from './anime-looks.js';
import { resolveGesture } from './hero-gesture.js';
import { heroRecord, heroPlanOf, expandLayeredManifest, normalizeHero, planLayered } from '../../mcp/tools/layered.js';

const heroine = { cast: 'female', head: 'anime', look: ['heroine', 'soft', 'large-eyes', 'side-parted'], expression: ['smile', { open: 0.3 }], tune: { shoulders: 1.03, legs: 1.04 } };
const lead = { cast: 'male', head: 'anime', look: ['lead', 'tsurime', 'strong-chin'], expression: 'determined', gesture: 'guard' };

describe('the zero law', () => {
  it('absent, 0 and null genki compose the same head as before, and the door stores nothing', () => {
    for (const spec of [heroine, lead]) {
      const base = animeHeroEffective(heroRecord(spec));
      for (const g of [0, null, undefined]) {
        const rec = heroRecord({ ...spec, genki: g });
        expect(rec.genki).toBeUndefined();
        expect(animeHeroEffective(rec)).toEqual(base);
      }
      expect(heroPlanOf(heroRecord({ ...spec, genki: 0 }))).toEqual(heroPlanOf(heroRecord(spec)));
    }
    expect(genkiLayers({ genki: 0 })).toBeNull();
    expect(genkiStand({ stance: 1.2 }, {})).toEqual({ stance: 1.2 });
  });
  it('a patch that sets genki back to 0 or null drops the field', () => {
    const rec = heroRecord({ ...heroine, genki: 1 });
    expect(rec.genki).toBe(1);
    expect(normalizeHero({ ...rec, genki: 0 }).genki).toBeUndefined();
    expect('genki' in normalizeHero({ ...rec, genki: null })).toBe(false);
  });
});

describe('the layer laws', () => {
  it('ratios multiply the look × own value as ratio^s; offsets add offset × s', () => {
    const base = animeHeroEffective(heroRecord(heroine));
    for (const s of [0.5, 1]) {
      const eff = animeHeroEffective(heroRecord({ ...heroine, genki: s }));
      expect(eff.tune.shoulders).toBeCloseTo(base.tune.shoulders * GENKI.tune.shoulders ** s, 5);
      expect(eff.face.eyeHeight).toBeCloseTo(base.face.eyeHeight * GENKI.face.eyeHeight ** s, 5);
      expect(eff.sculpt.browThick).toBeCloseTo(base.sculpt.browThick * GENKI.sculpt.browThick ** s, 5);
      expect(eff.sculpt.browAngle).toBeCloseTo(base.sculpt.browAngle + GENKI.sculptOff.browAngle * s, 5);
    }
  });
  it('the male pole grows the eyes; the female narrows the opening and keeps the eye width', () => {
    const m0 = animeHeroEffective(heroRecord(lead)), m1 = animeHeroEffective(heroRecord({ ...lead, genki: 1 }));
    expect(m1.face.eyeWidth).toBeGreaterThan(m0.face.eyeWidth);
    expect(m1.face.eyeHeight).toBeGreaterThan(m0.face.eyeHeight);
    const f0 = animeHeroEffective(heroRecord(heroine)), f1 = animeHeroEffective(heroRecord({ ...heroine, genki: 1 }));
    expect(f1.face.eyeWidth).toBe(f0.face.eyeWidth);
    expect(f1.face.eyeHeight).toBeLessThan(f0.face.eyeHeight);
  });
  it('the expression: the brow set, the mouth more open, the smile wider, every channel in range', () => {
    const e = genkiExpression({ blink: 0.12, smile: 1, open: 0.3, brow: 0.3 }, { genki: 1 });
    expect(e.brow).toBeCloseTo(0.55, 6); expect(e.open).toBeCloseTo(0.48, 6); expect(e.smile).toBe(1); expect(e.blink).toBe(0.12);
    expect(genkiExpression({ blink: 0, smile: 0, open: 0.9, brow: 0.95 }, { genki: 1 })).toMatchObject({ open: 1, brow: 1 });
  });
  it('the stand: the resolved pose keeps every word, its stance scaled, the chest and the chin raised', () => {
    const pose = resolveGesture('relaxed', 'female', { core: 'structured' }), g = genkiStand(pose, { genki: 1 });
    expect(g.stance).toBeCloseTo((pose.stance ?? 1) * GENKI.stand.stance, 6);
    expect(g.head.pitch).toBeCloseTo((pose.head?.pitch ?? 0) + GENKI.stand.pitchOff, 6);
    expect(g.head.yaw).toBe(pose.head.yaw);
    expect(g.support).toBe(pose.support);
  });
  it('composeAnime takes genki last, over the own layer (an own edit and genki compose)', () => {
    const rec = heroRecord({ ...heroine, tune: { shoulders: 1.1 }, genki: 1 });
    const eff = composeAnime(rec, 'long');
    expect(eff.tune.shoulders).toBeCloseTo(1.1 * GENKI.tune.shoulders, 5);
  });
});

describe('the door', () => {
  it('refuses an amount out of [0, 1] and genki on a head other than the anime head, by name', () => {
    expect(validateGenki({ head: 'anime', genki: 1.5 })[0]).toMatch(/genki: a number from 0/);
    expect(validateGenki({ head: 'anime', genki: -0.1 })[0]).toMatch(/genki/);
    expect(validateGenki({ genki: 0.5 })[0]).toMatch(/anime head/);
    expect(() => heroRecord({ ...heroine, genki: 2 })).toThrow(/genki/);
  });
  it('a genki hero mints through the rig gates, dressed: the stand first, closed, the stand clip carries the genki pose', () => {
    for (const spec of [{ ...heroine, detail: 'clothed', genki: 1 }, { ...lead, adorn: 'ranger', genki: 1 }]) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
      expect(Object.keys(m.plan.clips)[0]).toBe('gesture');
      const { stats } = planLayered(m);
      expect(stats.closed).toBe(true);
      const base = resolveGesture(spec.gesture ?? 'relaxed', spec.cast, { core: 'structured' });
      expect(m.plan.clips.gesture[0].head.pitch).toBeCloseTo((base.head?.pitch ?? 0) + GENKI.stand.pitchOff, 6);
    }
  });
});
