import { describe, it, expect } from 'vitest';
import { rollEgocube } from './egocube.js';
import { rollMascot } from './mascot.js';
import { mascotPlan, mascotPlanFromSheet } from './mascot-form.js';
import { ADORN_IDS, ORB_ADORNS, mascotAdorn } from './mascot-adorn.js';
import { mascotFacetsOfPerson, mascotOfPerson } from './mascot-from-person.js';
import { rollStored, egocubeCreate, readEgocubeKind, TURNAROUND } from './kind.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered } from '../polygonizer/station-loft.js';

describe('smooth edges (law 8)', () => {
  it('draws every round form on fine rings', () => {
    const { plan } = mascotPlan(rollMascot({ facets: { form: 'sprout', hook: 'none' } }));
    expect(plan.style).toMatchObject({ slots: 'ring20', limbSlots: 'ring12' });
    expect(plan.segments.find((s) => s.name === 'head').stations.length).toBeGreaterThanOrEqual(15);
    expect(plan.segments.find((s) => s.name === 'body').stations.length).toBeGreaterThanOrEqual(9);
    expect(plan.segments.find((s) => s.name === 'handR').stations.length).toBeGreaterThanOrEqual(10);
  });
});

describe('the signature piece (Ad1–Ad6)', () => {
  it('bakes every piece over the body as one adornment with its signature (one case each)', () => {
    for (const adorn of ADORN_IDS.filter((a) => a !== 'none')) {
      const { plan } = mascotPlan(rollMascot({ facets: { adorn, form: 'sprout', hook: 'none' } }));
      expect(plan.adorn?.length, adorn).toBeGreaterThan(0);
      for (const A of plan.adorn) expect(A.signature.kind, adorn).toBeTruthy();
      const recipe = expandPlan(plan);
      expect(Object.values(recipe.parts).filter((p) => (p.layer ?? 1) === 3).length, adorn).toBeGreaterThan(0);
      expect(compileLayered(recipe).faces.length).toBeGreaterThan(0);
    }
  }, 60000);
  it('wears nothing it cannot hold: the orb a bow or nothing, unless asked', () => {
    expect(ORB_ADORNS).toEqual(['none', 'bow']);
    for (let seed = 1; seed <= 6; seed++) expect(ORB_ADORNS, `seed ${seed}`).toContain(rollMascot({ facets: { form: 'orb' }, seed }).facets.adorn);
    expect(mascotAdorn({ adorn: 'belt' }, { R: 0.25, orb: true })).toEqual([]);
  });
  it('says the promise (Ad5), and the piece carries the colour the body lacks (Ad4)', () => {
    const counts = (promise) => [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => rollMascot({ facets: { promise, form: 'sprout' }, seed }).facets.adorn);
    expect(counts('pride').filter((a) => a === 'medal').length).toBeGreaterThan(2);
    const { plan } = mascotPlan(rollMascot({ brief: 'a fox mascot with a scarf' }));
    expect(plan.palette.Adorn).not.toBe(plan.palette.Body);
    expect(plan.palette.Shine).toMatch(/^#/);
    const person = mascotPlan(rollMascot({ brief: 'a mario-like mascot with a belt' })).plan.palette;
    expect(person.Adorn).not.toBe(person.Bottom);   // not lost on the trousers it is worn over
  });
});

describe('the egocube\'s mascot output: a person made as its mascot', () => {
  it('reads a person\'s facets into a mascot\'s, each with its reason', () => {
    const sheet = rollEgocube({ brief: 'a weary paladin', seed: 3 });
    const { facets, mapping } = mascotFacetsOfPerson(sheet);
    expect(facets).toMatchObject({ promise: 'might', hue: 'red', adorn: 'belt', energy: 'sturdy', being: 'human', extremities: 'gloves' });
    expect(mapping.every((m) => m.from && m.because)).toBe(true);
    expect(() => mascotFacetsOfPerson(rollMascot({}))).toThrow(/already one/);
  });
  it('plays a lineage by its animal, and keeps the person\'s seed (one character, two tunings)', () => {
    const cat = mascotOfPerson(rollEgocube({ facets: { ancestry: 'feline' }, seed: 2 }));
    expect(cat.facets.animal).toBe('houseCat');
    expect(cat.seed).toBe(2);
    expect(JSON.stringify(mascotOfPerson(rollEgocube({ facets: { ancestry: 'feline' }, seed: 2 })))).toBe(JSON.stringify(cat));
  });
  it('makes the cube\'s character as its mascot on ask or by the cube\'s output, with its model sheet', () => {
    const cube = rollStored({ kind: 'egocube', roll: { facets: { archetype: 'jester' }, seed: 5 } });
    expect(egocubeCreate(cube).create.as).toBe('hero');
    const M = egocubeCreate(cube, { output: 'mascot' });
    expect(M).toMatchObject({ output: 'mascot', create: { as: 'creature' } });
    expect(M.mascot.facets.promise).toBe('mischief');
    expect(M.modelSheet.laws).toHaveLength(10);
    expect(M.modelSheet.swatches.map((x) => x.role)).toEqual(expect.arrayContaining(['skin', 'shirt']));
    expect(egocubeCreate({ ...cube, output: 'mascot' }).output).toBe('mascot');
    expect(() => readEgocubeKind({ kind: 'egocube', roll: {}, output: 'plush' })).toThrow(/'character' or 'mascot'/);
    expect(TURNAROUND).toHaveLength(4);
  });
  it('gives a mascot cube its model sheet too, and the call compiles', () => {
    const C = egocubeCreate(rollStored({ kind: 'egocube', roll: { brief: 'a kirby-like mascot' } }));
    expect(C.modelSheet.faces.clips).toEqual(expect.arrayContaining(['happy', 'sad']));
    expect(() => expandPlan(C.create.spec.plan)).not.toThrow();
    expect(mascotPlanFromSheet(rollMascot({ brief: 'kirby-like' })).create.as).toBe('creature');
  });
});
