// The feature grammar (feature-grammar.js): the converter's laws, one species per body plan (chosen in code from the roster,
// never a catalog walk). Every plan builds; structure and decoration are apart (the decoration dials at 0 leave every mass
// where it was and lay no tuft and no marking layer); a plan's own solution is there (a bird's wings and beak, a hoofed
// animal's hooves, a scaled skin's spines, an orb's missing neck); a species' measures size its ears; and a plan other
// than the raccoon's goes through the whole pipeline to one skin on the rig. The silhouettes vary with the species' body
// (one per silhouette, chosen from the roster in code), the belly is the species' own or none, a bird stands as a bird.
import { describe, it, expect } from 'vitest';
import { featureBuild, PLAN_OF, PLANS, speciesMeasures } from './feature-grammar.js';
import { SILHOUETTES, silhouetteOf, speciesMetrics, BELLY_CONTRAST } from './feature-silhouettes.js';
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
    expect(SILHOUETTES[b('orb').silhouette].neck).toBe('merged');
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

  // (one species per silhouette, the first the roster reads as it)
  const SIL = {}; for (const id of Object.keys(SPECIES)) { const f = SPECIES[id].family, s = silhouetteOf(id, f, PLAN_OF[f] ?? 'stander'); SIL[s] ??= id; }

  it('the silhouettes vary with the body: every one is cast from the roster, each a different set of masses and proportions', () => {
    expect(Object.keys(SIL).sort()).toEqual(Object.keys(SILHOUETTES).sort());
    const shapes = Object.entries(SIL).map(([s, id]) => { const b = featureBuild(animalCard(id)); expect(b.silhouette, id).toBe(s); return JSON.stringify([b.heads, b.eggs.filter((e) => e.bone !== 'head').map((e) => [e.c, e.r])]); });
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(featureBuild(animalCard('raccoon')).silhouette).toBe('pear');
  });

  it('a belly is the species\' own: none where the roster shows no belly, its own colour where it does, a breast on a bird', () => {
    for (const id of Object.values(SIL)) {
      const b = featureBuild(animalCard(id)), c = speciesMetrics(id).bellyContrast, tune = ['procyonid', 'canine', 'feline'].includes(SPECIES[id].family);
      const pale = b.marks.find((m) => m.name === 'belly');
      if (!tune && b.belly !== 'tuxedo' && (c == null || Math.abs(c) < BELLY_CONTRAST)) { expect(b.belly, id).toBe('none'); expect(pale, id).toBeUndefined(); }
      else expect(pale?.regions.length, id).toBeGreaterThan(0);
    }
    const birdId = Object.keys(SPECIES).find((id) => PLAN_OF[SPECIES[id].family] === 'bird' && silhouetteOf(id, SPECIES[id].family, 'bird') === 'perch' && Math.abs(speciesMetrics(id).bellyContrast ?? 0) >= BELLY_CONTRAST);
    expect(featureBuild(animalCard(birdId)).belly).toBe('breast');
  });

  it('a standing bird is built as a bird: wings folded on its sides as panels, primaries back along the fold, thin legs, toes', () => {
    const b = featureBuild(animalCard(SIL.perch));
    const wing = b.eggs.find((e) => e.name === 'wingR'), prim = b.tufts.filter((t) => t.name.startsWith('primary'));
    expect(wing && b.eggs.some((e) => e.name === 'wingForeR')).toBe(true);
    expect(Math.min(...wing.r)).toBeLessThan(0.1);                               // (a panel: thin)
    for (const t of prim) expect(t.aim[1], t.name).toBeLessThan(-0.5);           // (folded back, not spread out)
    expect(b.limbs.filter((l) => /^toe/.test(l.name)).length).toBe(4);
    expect(b.limbs.find((l) => l.name === 'shinR').rb).toBeLessThan(0.08);
    expect(b.tufts.some((t) => t.name.startsWith('crown'))).toBe(false);
  });
});
