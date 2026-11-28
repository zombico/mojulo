/**
 * THE PEOPLE OF A STREET (people.js): the quick figures a six at a time by default; a level's realistic people (geocity's
 * `people: 'realistic'`) the street's cast instead, a six of realistic heroes each drawn at the realistic crowd grade.
 */
import { describe, expect, it } from 'vitest';

import { PEOPLE, PERSON, streetPeople } from './people.js';

const G = { seed: 7, theme: 'modern' };

describe('the people of a street', () => {
  it('realistic: the street\'s cast, a six a set, each a realistic hero at the crowd grade', () => {
    const { figures, reads } = streetPeople(G, undefined, { sets: 2, realistic: true, locale: 'los-angeles' });
    const names = Object.keys(figures);
    expect(names).toHaveLength(2 * PEOPLE.pool);
    expect(names.every((n) => PERSON.test(n))).toBe(true);
    expect(reads).toHaveLength(names.length);
    for (const f of Object.values(figures)) {
      expect(f).toMatchObject({ grade: 'play', crowd: 'real' });
      expect(f.hero.form).toBe('realistic');
    }
    // (a six is six different people: three men and three women, each a face of their own)
    const six = names.slice(0, PEOPLE.pool).map((n) => figures[n].hero);
    expect(six.filter((h) => h.cast === 'female')).toHaveLength(3);
    expect(new Set(six.map((h) => h.face.seed)).size).toBe(PEOPLE.pool);
    // (pure)
    expect(streetPeople(G, undefined, { sets: 2, realistic: true, locale: 'los-angeles' })).toEqual({ figures, reads });
  });
});

describe('the street\'s gaits (street-cast.js STREET_GAITS)', () => {
  it('each person walks the hero\'s own walk as the mint stamps it, moved by a gait their age and build make likely', async () => {
    const { STREET_GAITS, gaitOdds, streetWalk, streetSix } = await import('./street-cast.js');
    const { stampHeroMotion } = await import('../polygonizer/hero-motion.js');
    // (easy is the hero's own walk; another gait moves its dials, never drops the hero's own ones)
    expect(streetWalk('easy', 'female')).toEqual(stampHeroMotion({ walk: true }, { pole: 'female' }).walk);
    const brisk = streetWalk('brisk', 'male'), easy = streetWalk('easy', 'male');
    expect(brisk.strideLength).toBeGreaterThan(easy.strideLength);
    expect(brisk.seconds).toBeLessThan(easy.seconds);
    expect(brisk.duty).toBe(easy.duty);
    // (the old walk slower, a heavy build heavier)
    expect(gaitOdds({ age: 70 }).brisk).toBeUndefined();
    expect(gaitOdds({ age: 70 }).weary).toBeGreaterThan(0);
    expect(gaitOdds({ age: 25, build: 'heavyset' }).heavy).toBeGreaterThan(gaitOdds({ age: 25 }).heavy ?? 0);
    for (const P of streetSix(3, { locale: 'miami' })) {
      expect(Object.keys(STREET_GAITS)).toContain(P.reads.gait);
      expect(P.spec.motion.walk).toEqual(streetWalk(P.reads.gait, P.spec.cast));
    }
  });
});
