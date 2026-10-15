import { describe, it, expect } from 'vitest';
import { SPECIES } from '../fauna/species.js';
import { FAMILY_MASCOT, SPECIES_MASCOT, IDENTITY_BUDGET, OUTLINE, KIT, animalCard, animalPalette, saturate, ANIMAL_WORDS } from './mascot-animals.js';
import { rollMascot } from './mascot.js';
import { mascotPlan, mascotPlanFromSheet } from './mascot-form.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig } from '../polygonizer/station-loft-rig.js';

/** one species per family, picked from the roster in code: a family is one procedure (its card) */
const ONE_PER_FAMILY = Object.values(Object.entries(SPECIES).reduce((o, [id, s]) => (o[s.family] ??= id, o), {}));
const hueOf = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return null; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };

describe('the distilled rules: a card for every family', () => {
  it('names a rule for every family in the roster, in the kit\'s own vocabulary', () => {
    for (const id of ONE_PER_FAMILY) expect(FAMILY_MASCOT[SPECIES[id].family], SPECIES[id].family).toBeTruthy();
    for (const card of Object.values(FAMILY_MASCOT)) for (const [k, v] of Object.entries(card.kit)) expect(KIT[k], k).toContain(v);
  });
  it('draws at most three outline identifiers (A1) and says what it let go', () => {
    for (const id of ONE_PER_FAMILY) {
      const c = animalCard(id);
      expect(Object.keys(c.kit).filter((k) => OUTLINE.includes(k) && c.kit[k] !== 'button').length, id).toBeLessThanOrEqual(IDENTITY_BUDGET);
      expect(c.drops, id).toMatch(/\w/);
    }
  });
  it('makes every family a mascot that compiles and rigs (one species each)', () => {
    for (const id of ONE_PER_FAMILY) {
      const sheet = rollMascot({ facets: { animal: id } }), { plan } = mascotPlan(sheet);
      const recipe = expandPlan(plan);
      expect(() => validateRig(recipe.rig), id).not.toThrow();
      expect(compileLayered(recipe).faces.length, id).toBeGreaterThan(200);
    }
  }, 120000);
});

describe('the crafted eight', () => {
  const kitOf = (id) => animalCard(id).kit;
  it('keeps what names each one and nothing past it', () => {
    expect(kitOf('fox')).toMatchObject({ ears: 'pointed', tail: 'brush', muzzle: 'point', pattern: 'socks' });
    expect(kitOf('giantPanda')).toMatchObject({ pattern: 'patches', ears: 'round' });
    expect(kitOf('rabbit')).toMatchObject({ ears: 'tall', tail: 'pom' });
    expect(kitOf('frog')).toMatchObject({ eyes: 'top', muzzle: 'wide', feet: 'webbed' });
    expect(kitOf('emperorPenguin')).toMatchObject({ pattern: 'tuxedo', muzzle: 'beak', arms: 'flipper' });
    expect(kitOf('elephant')).toMatchObject({ muzzle: 'trunk', ears: 'flap' });
    expect(kitOf('greatHornedOwl')).toMatchObject({ eyes: 'disc', ears: 'tufts', arms: 'wing' });
    expect(kitOf('lion')).toMatchObject({ mane: 'ring', tail: 'tuft', muzzle: 'button' });   // the muzzle past the budget leaves its nose
    expect(Object.keys(SPECIES_MASCOT)).toHaveLength(8);
  });
  it('reads the promise from the folk animal, not the family alone (A8)', () => {
    expect(animalCard('fox').promise).toBe('mischief');
    expect(animalCard('wolf').promise).toBe(FAMILY_MASCOT.canine.promise);
    expect(animalCard('lion').promise).toBe('pride');
  });
  it('draws the craft: the owl\'s iris, the panda\'s patches, the elephant\'s trunk, the lion\'s mane', () => {
    const parts = (id) => mascotPlan(rollMascot({ facets: { animal: id } })).plan.segments.map((s) => s.name);
    expect(parts('greatHornedOwl')).toEqual(expect.arrayContaining(['irisR', 'discR', 'earR', 'snout']));
    expect(parts('giantPanda')).toEqual(expect.arrayContaining(['patchR']));
    expect(parts('elephant')).toEqual(expect.arrayContaining(['trunk0', 'trunk1', 'earR']));
    expect(parts('lion')).toEqual(expect.arrayContaining(['mane', 'tail0', 'tail1', 'noseTip']));
  });
});

describe('the coat (A6) and the words', () => {
  it('takes the species\' own coat, pushed toward a mascot\'s saturation unless its identity is light against dark', () => {
    const fox = animalPalette('fox', animalCard('fox'));
    expect(Math.abs(hueOf(fox.Body) - hueOf('#b8602a'))).toBeLessThan(8);
    expect(saturate('#ece8dc')).toBe('#ece8dc');   // a panda's white stays white
    expect(animalPalette('emperorPenguin', animalCard('emperorPenguin')).Body).toBe('#1d1f2a');   // the craft's own colours win
  });
  it('reads an animal from the brief by id, by name and by everyday name, and lets the operator\'s facets win', () => {
    expect(ANIMAL_WORDS.panda).toEqual({ animal: 'giantPanda' });
    expect(rollMascot({ brief: 'a great horned owl mascot' }).facets.animal).toBe('greatHornedOwl');
    const s = rollMascot({ brief: 'a fox mascot', facets: { promise: 'speed' } });
    expect(s.facets).toMatchObject({ animal: 'fox', promise: 'speed', being: 'critter' });
    expect(s.notes.silhouette[0].line).toMatch(/named by ears, tail, muzzle/);
    expect(() => rollMascot({ facets: { animal: 'unicorn' } })).toThrow(/unknown animal 'unicorn'/);
  });
  it('compiles to the creature door and lands every note', () => {
    const sheet = rollMascot({ brief: 'a panda mascot' }), P = mascotPlanFromSheet(sheet);
    expect(P.create.as).toBe('creature');
    expect(P.ledger).toHaveLength(Object.values(sheet.notes).flat().length);
  });
});
