// A fighter designed by the character loop: the fight read off its Egocube (role the style, archetype and its shadow
// the signature, the body's heavy or light holding over the drive's), the roster's entries read and refused by name,
// and the default roster one sheet per style.
import { describe, it, expect } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { fighterFromSheet, fighterSpec, defaultFighters, fighterName, STYLE_OF_ROLE } from './versus-sheet.js';
import { solveFighter, ARCHETYPES as STYLES } from './versus-solver.js';
import { compileFighter } from './versus-compile.js';

const roll = (facets, seed = 1) => rollEgocube({ facets, seed });
const wordsOf = (sheet) => fighterFromSheet(sheet).intent.signature ?? [];

describe('versus: the fight read off a sheet', () => {
  it('reads the role as the style, each style one the solver plays, and says why', () => {
    for (const [role, [style]] of Object.entries(STYLE_OF_ROLE)) expect(STYLES[style], role).toBeTruthy();
    const { intent, reads } = fighterFromSheet(roll({ role: 'frontline', archetype: 'hero', motivation: 0.1 }));
    expect(intent.archetype).toBe('grappler');
    expect(reads[0]).toMatchObject({ facet: 'role', value: 'frontline', word: 'grappler' });
    expect(reads.every((r) => typeof r.why === 'string' && r.why.length > 8)).toBe(true);
  });

  it('the archetype gives its word in the light, the shadow its own as motivation turns it', () => {
    expect(wordsOf(roll({ archetype: 'hero', build: 'canonical', age: 'adult', motivation: 0.1 }))).toEqual(['reversal']);
    expect(wordsOf(roll({ archetype: 'hero', build: 'canonical', age: 'adult', motivation: 0.97 }))).toEqual(['heavy']);
    const turning = roll({ archetype: 'outlaw', build: 'canonical', age: 'adult', motivation: 0.55 });
    expect(turning.reading.reads).toBe('turning');
    expect(wordsOf(turning)).toEqual(['overhead', 'grab']);
  });

  it('the body holds against the drive: a brute innocent is heavy, not light, and says so', () => {
    const { intent, reads } = fighterFromSheet(roll({ archetype: 'innocent', build: 'brute', age: 'adult', motivation: 0.1 }));
    expect(intent.signature).toEqual(['heavy']);
    expect(reads.find((r) => r.facet === 'archetype' && !r.word).why).toMatch(/the body already says heavy/);
  });

  it('every reading is a fighter that compiles, and the HUD names the shadow it has become', () => {
    const sheet = roll({ role: 'caster', archetype: 'ruler', motivation: 0.97 });
    expect(() => compileFighter(solveFighter({ id: 'x', ...fighterFromSheet(sheet).intent }).recipe)).not.toThrow();
    expect(fighterName(sheet)).toBe('The Tyrant');
    expect(fighterName(roll({ archetype: 'sage', motivation: 0.1 }))).toBe('The Sage');
  });
});

describe('versus: a roster entry is a character', () => {
  it('an archetype word or a brief is a sheet to roll; an object says the sheet, the fight words lay over it', () => {
    expect(fighterSpec('hero', 0, 2)).toMatchObject({ id: 'fighter-1', roll: { facets: { archetype: 'hero' } }, over: {} });
    expect(fighterSpec('a weary paladin', 1)).toMatchObject({ id: 'fighter-2', roll: { brief: 'a weary paladin', facets: {} } });
    expect(fighterSpec({ id: 'kai', role: 'flanker', style: 'zoner', weapon: 'staff' })).toMatchObject({ id: 'kai', roll: { facets: { role: 'flanker' } }, over: { style: 'zoner', weapon: 'staff' } });
    expect(fighterSpec({ hero: { ref: 'mira' }, style: 'rushdown' })).toEqual({ id: 'fighter-1', hero: { ref: 'mira' }, over: { style: 'rushdown' } });
    // the same entry at the same place rolls the same sheet
    expect(fighterSpec('hero', 0, 2).roll.seed).toBe(fighterSpec('hero', 0, 2).roll.seed);
  });

  it('refuses a stick fighter, and a fight style where who they are belongs, by name', () => {
    expect(() => fighterSpec('grappler')).toThrow(/'grappler' is a fight style: say who the fighter is/);
    expect(() => fighterSpec({ archetype: 'zoner' })).toThrow(/archetype 'zoner' is a fight style: give it as style/);
    expect(() => fighterSpec({ cast: 'brute' })).toThrow(/cast: a fighter's body is its character's/);
    expect(() => fighterSpec({ hero: { ref: 'mira' }, build: 'brute' })).toThrow(/build: a character already made has its sheet/);
    expect(() => fighterSpec({ style: 'tank' })).toThrow(/style is a fight style/);
  });

  it('the default roster is one sheet per style, of different archetypes, by the seed', () => {
    const four = defaultFighters(5);
    expect(four.map((f) => STYLE_OF_ROLE[f.role][0])).toEqual(['grappler', 'rushdown', 'zoner', 'all-rounder']);
    expect(new Set(four.map((f) => f.archetype)).size).toBe(4);
    expect(defaultFighters(5)).toEqual(four);
  });
});
