// A people's body (people.js): a foe skinned as a person or a non-human people is measured on two legs at its own
// stature and fitted to its class as a beast is; it fights in the role its class's attack gives it; and it stands at its
// own height, grown only by its rank. Classes are chosen in code by the procedure they run.
import { describe, it, expect } from 'vitest';
import { PEOPLE, peopleBody, peopleRole, peopleRoll, peopleSeed, readPeopleSkin } from './people.js';
import { FOE_CLASSES } from './index.js';
import { MOVES, FOE_RANKS } from './vocab.js';
import { fitOfPeople } from './fit.js';
import { resolveFoe } from './resolve.js';

const CLASSES = Object.values(FOE_CLASSES);
const pick = (what, pred) => { const c = CLASSES.find(pred); if (!c) throw new Error(`no class ${what}`); return c; };
const FLIER = pick('that flies', (c) => MOVES[c.move].needs.includes('wings'));
const GROUND = pick('on the ground that fits a person', (c) => fitOfPeople(c.id, { people: 'human' }).ok);

describe('a people\'s body', () => {
  it('a person and a non-human people stand on two legs, wingless, at their own stature', () => {
    expect(PEOPLE[0]).toBe('human');
    const b = peopleBody({ people: 'orcish' });
    expect(b).toMatchObject({ support: 'two', wings: false, swimmer: false, scale: 1, people: 'orcish' });
    expect(peopleBody({ people: 'human', facets: { age: 'child' } }).height).toBeLessThan(b.height);
  });
  it('a class asks it as it asks a beast: a flier refuses it, saying why', () => {
    expect(fitOfPeople(FLIER.id, { people: 'human' }).misses.join()).toMatch(/wings/);
    expect(() => resolveFoe({ class: FLIER.id, skin: { people: 'human' } })).toThrow(/does not fit a human/);
    expect(GROUND).toBeTruthy();
  });
  it('fights in its class\'s role: a shot ranged, a lob a caster, an opportunist a flanker, a blade frontline', () => {
    const by = (kind) => pick(`with a ${kind}`, (c) => c.attack.kind === kind);
    expect(peopleRole(by('shot'))).toBe('ranged');
    expect(peopleRole(by('lob'))).toBe('caster');
    expect(peopleRole(pick('opportunist', (c) => c.mind.aggressiveness === 'opportunist'))).toBe('flanker');
    expect(peopleRole(pick('a blade on the bold', (c) => c.attack.kind === 'strike' && c.mind.aggressiveness !== 'opportunist'))).toBe('frontline');
    expect(peopleRoll({ people: 'undead', facets: { build: 'brute' } }, GROUND, { seed: 3 }).facets).toMatchObject({ ancestry: 'undead', build: 'brute' });
    expect(peopleRoll({ people: 'human' }, GROUND).facets.ancestry).toBeUndefined();
    expect(peopleSeed(1, 'a')).not.toBe(peopleSeed(1, 'b'));
  });
  it('stands at its own height, grown by its rank; its body is no beast\'s', () => {
    const f = resolveFoe({ class: GROUND.id, rank: 'boss', skin: { people: 'human' } });
    expect(f.body).toBeNull();
    expect(f.skin).toEqual({ people: 'human' });
    expect(f.scale).toBe(FOE_RANKS.boss.presence);
    expect(f.stature).toBeCloseTo(f.measured.height * FOE_RANKS.boss.presence, 2);
    expect(f.strike).toBeNull();
  });
  it('refuses a word it does not know, naming the known ones', () => {
    expect(() => readPeopleSkin({ people: 'goblin' })).toThrow(/no people 'goblin'/);
    expect(() => readPeopleSkin({ people: 'human', facets: { ancestry: 'orcish' } })).toThrow(/say it as people/);
    expect(() => readPeopleSkin({ people: 'human', species: 'wolf' })).toThrow(/no key 'species'/);
    expect(() => resolveFoe({ class: GROUND.id, skin: { species: 'wolf', people: 'human' } })).toThrow(/no key 'species'/);
  });
});
