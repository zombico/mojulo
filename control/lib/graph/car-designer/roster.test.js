// The roster: a field of racers, each in the machine its driver reads as, and the balance law over them. The concepts:
// an entry in any of its forms reads to one recipe (junk refused); the measures are read off physics derived from what
// was built (a heavier build is heavier, a needle cuts the air, a sticky tyre corners and drags); the law holds over a
// drawn field and a field that fails it is leaned through the solver's own parts, every change with its reason (a pin
// the creator set never swapped); the rule a machine plays by is its own; deterministic.
import { describe, it, expect } from 'vitest';
import { ARCHETYPES } from '../egocube/facets.js';
import { racerSpec, racerOf, racerMeasures, racerRule, balanceOf, solveRoster, MEASURES } from './roster.js';

const arch = Object.keys(ARCHETYPES)[0];

describe('the roster', () => {
  it('reads an entry in each of its forms to one recipe, and refuses what is not one', () => {
    expect(racerSpec(arch, 0, 1)).toEqual({ facets: { archetype: arch }, seed: 32 });
    expect(racerSpec('a grumpy old wizard', 1, 1)).toEqual({ facets: {}, brief: 'a grumpy old wizard', seed: 39 });
    expect(racerSpec({ archetype: arch, build: 'brute', seed: 4, parts: { wheel: 'slick' } })).toEqual({ facets: { archetype: arch, build: 'brute' }, seed: 4, parts: { wheel: 'slick' } });
    expect(() => racerSpec(3)).toThrow(/a racer is an archetype, a brief in words/);
    expect(() => racerSpec({ archetype: arch, wings: 2 })).toThrow(/wings is not one of/);
    expect(() => solveRoster(9)).toThrow(/1 to 8 racers/);
  });
  it('reads its measures off the physics built: build, silhouette and tyres each tell', () => {
    const at = (facets, parts) => racerOf({ facets, seed: 5, ...(parts ? { parts } : {}) });
    const brute = at({ archetype: arch, build: 'brute' }), lithe = at({ archetype: arch, build: 'lithe' });
    expect(racerMeasures(brute.S).heft).toBeGreaterThan(racerMeasures(lithe.S).heft);
    expect(Object.keys(racerMeasures(brute.S))).toEqual(Object.keys(MEASURES));
    // the same machine on two tyres: the sticky one corners harder and gives up top speed to its drag
    const slick = at({ archetype: arch }, { wheel: 'slick' }), wire = at({ archetype: arch }, { wheel: 'wire' });
    const a = racerMeasures(slick.S), b = racerMeasures(wire.S);
    expect(a.corner).toBeGreaterThan(b.corner);
    expect(a.top).toBeLessThan(b.top);
    // its rule is its own: its mass and drag, arcade unless asked
    expect(racerRule(brute.S)).toMatchObject({ type: 'drive', vehicle: 'racer', tuning: 'arcade', mass: brute.S.physics.mass });
    expect(racerRule(brute.S, { tuning: 'sim', conditions: 'wet' })).toMatchObject({ tuning: 'sim', muScale: 0.62 });
  });
  it('holds balance: none best at everything, none bettered everywhere; a field that fails is leaned, with reasons', () => {
    expect(balanceOf([{ top: 2, pull: 2, corner: 2, turn: 2, heft: 2 }, { top: 1, pull: 1, corner: 1, turn: 1, heft: 3 }]).holds).toBe(true);
    expect(balanceOf([{ top: 2, pull: 2, corner: 2, turn: 2, heft: 2 }, { top: 1, pull: 1, corner: 1, turn: 1, heft: 1 }])).toMatchObject({ holds: false, everything: [0], bettered: [{ i: 1, by: 0 }] });
    // a drawn field the lean had to fix (the seed found by the sweep in roster.deep.test.js)
    const F = solveRoster(8, { seed: 7 });
    expect(new Set(F.racers.map((r) => r.archetype)).size).toBe(8);
    expect(F.balance.holds).toBe(true);
    expect(F.changes.length).toBeGreaterThan(0);
    for (const c of F.changes) {
      expect(['engine', 'wheel']).toContain(c.family);
      expect(F.racers[c.racer].S.ids[c.family]).toBe(F.racers[c.racer].spec.parts[c.family]);
      expect(c.why).toMatch(/every measure/);
    }
    // a pin is the creator's: kept even where a lean would have taken that family
    const leaned = F.changes[0], entries = F.racers.map((r, i) => (i === leaned.racer ? { ...r.spec.facets, seed: r.spec.seed, parts: { [leaned.family]: leaned.from } } : { ...r.spec.facets, seed: r.spec.seed }));
    const P = solveRoster(entries, { seed: 7 });
    expect(P.racers[leaned.racer].S.ids[leaned.family]).toBe(leaned.from);
  });
  it('is deterministic', () => {
    const a = solveRoster(3, { seed: 2 }), b = solveRoster(3, { seed: 2 });
    expect(a.racers.map((r) => r.spec)).toEqual(b.racers.map((r) => r.spec));
    expect(a.racers.map((r) => r.measures)).toEqual(b.racers.map((r) => r.measures));
  });
});
