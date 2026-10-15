// concept.test.js — the concept (what character this is) decides what agrees before a piece is chosen, and its own
// adornment (found, textile, ritual, craft) joins the gear: one beast across archetypes wears different things.
import { describe, expect, it } from 'vitest';
import { rollEgocube } from './egocube.js';
import { planFromSheet, CLOTHED_H } from './plan.js';
import { conceptOf, dressByConcept, CONCEPTS } from './concept.js';
import { ARCHETYPE_IDS } from './facets.js';
import { compileOutfit } from '../polygonizer/outfit-plan.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';

const dressed = (facets, seed = 1) => planFromSheet(rollEgocube({ seed, facets: { ancestry: 'draconic', ...facets } }), { dress: 'designed' }).create.spec.plan;

describe('the concept', () => {
  it('a word from the archetype, turned by the role; a people below the clothed line is wild, keeping its flavour', () => {
    const sage = conceptOf(rollEgocube({ facets: { ancestry: 'draconic', archetype: 'sage', role: 'caster', humanity: 0.5 } }));
    expect(sage.word).toBe('scholar'); expect(sage.refuses).toContain('chestPlate');
    // a frontline scholar fights: the warrior's first family joins, and plate is no longer refused
    const fighting = conceptOf(rollEgocube({ facets: { ancestry: 'draconic', archetype: 'sage', role: 'frontline', humanity: 0.5 } }));
    expect(fighting.also).toBe('warrior'); expect(fighting.families).toContain(CONCEPTS.warrior.families[0]); expect(fighting.refuses).not.toContain('chestPlate');
    const wild = conceptOf(rollEgocube({ facets: { ancestry: 'draconic', archetype: 'magician', humanity: CLOTHED_H - 0.05 } }));
    expect(wild.word).toBe('wild'); expect(wild.flavour).toBe('mystic'); expect(wild.families[0]).toBe('charms');
  });
  it('what it refuses is dropped, a disagreeing pair resolved, its own pieces added within the room', () => {
    const sheet = rollEgocube({ facets: { ancestry: 'draconic', archetype: 'ruler', role: 'support', humanity: 0.5 } });
    const pieces = [{ kind: 'chain', role: 'focal' }, { kind: 'harness' }, { kind: 'satchel' }];
    const why = dressByConcept(pieces, sheet, { room: 5 });
    expect(pieces.map((p) => p.kind)).not.toContain('harness'); expect(why.some((w) => /harness: not the noble's/.test(w))).toBe(true);
    expect(pieces.some((p) => p.family)).toBe(true);
    const plated = [{ kind: 'chestPlate', cut: 'cuirass' }, { kind: 'sash' }];
    dressByConcept(plated, rollEgocube({ facets: { ancestry: 'draconic', archetype: 'hero', role: 'frontline', humanity: 0.5 } }), { room: 5 });
    expect(plated.map((p) => p.kind)).not.toContain('sash');
  });
});

describe('one beast across archetypes', () => {
  it('wears its concept\'s own things: distinct adornment, never a refused kind, and every one builds', () => {
    const sets = new Set();
    for (const archetype of ARCHETYPE_IDS.filter((_, i) => i % 2 === 0)) for (const humanity of [CLOTHED_H - 0.05, 0.5]) {
      const plan = dressed({ archetype, humanity }), c = conceptOf(rollEgocube({ seed: 1, facets: { ancestry: 'draconic', archetype, humanity } }));
      const kinds = plan.outfit.pieces.map((p) => p.kind);
      for (const k of c.refuses) expect(kinds, `${archetype} ${humanity}: ${k}`).not.toContain(k);
      expect(plan.outfit.pieces.some((p) => p.family), `${archetype} ${humanity}`).toBe(true);
      sets.add(plan.outfit.pieces.filter((p) => p.family).map((p) => p.kind).sort().join('+'));
      expect(() => expandPlan(compileOutfit(plan)), `${archetype} ${humanity}`).not.toThrow();
    }
    expect(sets.size).toBeGreaterThanOrEqual(5);
  }, 60000);
});
