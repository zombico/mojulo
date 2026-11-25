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
