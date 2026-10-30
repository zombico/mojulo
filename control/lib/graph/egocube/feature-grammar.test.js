// The feature grammar (feature-grammar.js): the converter's laws, one species per body plan (chosen in code from the roster,
// never a catalog walk). Every plan builds; structure and decoration are apart (the decoration dials at 0 leave every mass
// where it was and lay no tuft and no marking layer); a plan's own solution is there (a bird's wings and beak, a hoofed
// animal's hooves, a scaled skin's spines, an orb's missing neck); a species' measures size its ears; and a plan other
// than the raccoon's goes through the whole pipeline to one skin on the rig.
import { describe, it, expect } from 'vitest';
import { featureBuild, PLAN_OF, PLANS, speciesMeasures } from './feature-grammar.js';
import { animalCard } from './mascot-animals.js';
import { SPECIES } from '../fauna/species.js';
import { rollMascot } from './mascot.js';
import { mascotPlanFromSheet } from './mascot-form.js';

// (the first species of the first family of each plan)
const ONE = Object.fromEntries(Object.keys(PLANS).map((plan) => { const fam = Object.keys(PLAN_OF).find((f) => PLAN_OF[f] === plan); return [plan, Object.keys(SPECIES).find((id) => SPECIES[id].family === fam)]; }));
const NO_DECOR = { tufts: 0, crown: 0, markings: 0, horns: 0, spines: 0, mane: 0, fins: 0 };

describe('the feature grammar', () => {
  it('every plan builds; its names are its own; the decoration dials at 0 leave the masses and lay no tuft or layer', () => {
    for (const [plan, id] of Object.entries(ONE)) {
      const card = animalCard(id), b = featureBuild(card), bare = featureBuild(card, { decor: NO_DECOR });
      expect(b.plan, id).toBe(plan);
      const names = [...b.eggs, ...b.tufts, ...b.limbs].map((x) => x.name);
      expect(new Set(names).size, id).toBe(names.length);
      expect(bare.eggs, id).toEqual(b.eggs); expect(bare.limbs, id).toEqual(b.limbs);
      // (the tufts left bare are structure: a thin tail, a trunk, a fluke's stock; no fan, crown, horn, spine or mane)
      expect(bare.tufts.map((t) => t.name).filter((n) => /^(cheek|crown|primary|tailFeather|spine|horn|mane|crest|ear)/.test(n)), id).toEqual([]);
      expect(bare.marks.filter((m) => m.strokes || m.bands), id).toEqual([]);
      expect(b.mouth.corner[0], id).toBeGreaterThan(0); expect(b.eye.r, id).toBeGreaterThan(0);
    }
  });

  it('each plan carries its solution: wings and a beak, hooves, spines, no neck on an orb', () => {
    const b = (plan) => featureBuild(animalCard(ONE[plan]));
    expect(b('bird').limbs.some((l) => l.name === 'beak') || b('bird').eggs.some((e) => e.name === 'bill')).toBe(true);
    expect(b('bird').tufts.some((t) => t.name.startsWith('primary'))).toBe(true); expect(b('bird').digits).toBeUndefined();
    expect(b('hoofed').marks.find((m) => m.group === 'Hoof')?.eggs).toEqual(expect.arrayContaining(['pawR', 'footL']));
    expect(b('reptile').tufts.filter((t) => t.name.startsWith('spine')).length).toBeGreaterThan(3);
    expect(b('orb').eggs.some((e) => e.name === 'neck')).toBe(false);
    expect(b('stander').digits.at.length).toBeGreaterThan(2);
  });

  it('a species\' measures size its ears: a mouse\'s bigger and rounder than a squirrel\'s; never below the module', () => {
    const mouse = speciesMeasures('mouse').ear, squirrel = speciesMeasures('squirrel').ear;
    expect(mouse.size).toBeGreaterThan(squirrel.size); expect(mouse.round).toBeGreaterThan(squirrel.round);
    for (const id of Object.values(ONE)) expect(speciesMeasures(id).ear?.size ?? 1).toBeGreaterThanOrEqual(1);
  });

  it('a bird goes through the whole pipeline: one skin on the rig, its wings bound to the hands, no finger bones', () => {
    const P = mascotPlanFromSheet(rollMascot({ facets: { style: 'feature', animal: ONE.bird } })), plan = P.create.spec.plan;
    const bound = new Set(Object.values(plan.segments[0].bind.blend).flatMap((w) => Object.keys(w)));
    expect(bound.has('handR') && bound.has('head') && bound.has('pelvis')).toBe(true);
    expect(plan.rig.bones.some((b) => /^digit/.test(b.id))).toBe(false);
  }, 120_000);
});
