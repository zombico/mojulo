// THE DRAGONS (boss/dragons.js): a family of bosses sharing one fight (two forms, the same idioms in each, one tell
// language), each its element's own implementation of every idiom, its signature and its snout. One dragon read is every
// dragon read; each one's own laws hold, and the family's.
import { describe, it, expect } from 'vitest';
import { DRAGONS, DRAGON_IDS, DRAGON_IDIOMS, DRAGON_RISE, ANSWERED_BY, dragonBoss, dragonLaws, dragonFigure } from './dragons.js';
import { bossLaws, ANSWERS } from './bosses.js';
import { bossRule } from './stand.js';
import { HEAD_LIBRARY, headPlan } from '../creature-heads/index.js';
import { validateHead } from '../polygonizer/station-loft-head.js';

describe('a family of dragons', () => {
  it('every dragon is a boss the director fights, its laws and the family\'s holding: one language, two forms', () => {
    for (const id of DRAGON_IDS) for (const l of dragonLaws(id)) expect(l.holds, `${id} ${l.law}: ${l.says}`).toBe(true);
    // (nothing it does risen is done on four legs)
    expect(dragonBoss(DRAGON_IDS[0]).phases[0].moves.dive).toBeUndefined();
  });
  it('one fight: on four legs, then risen (its look swapped onto it) with its signature joined, quicker each phase', () => {
    for (const id of DRAGON_IDS) {
      const B = dragonBoss(id), own = Object.keys(DRAGONS[id].signature);
      expect(B.phases[0].look).toBeUndefined();
      expect(B.phases[1]).toMatchObject({ below: DRAGON_RISE.below, look: DRAGON_RISE.look });
      expect(B.looks[DRAGON_RISE.look]).toBe(DRAGONS[id].rise.says);
      for (const m of own) { expect(Object.keys(B.phases[0].moves)).not.toContain(m); expect(Object.keys(B.phases[1].moves)).toContain(m); }
      expect(B.moves.breath.says).not.toContain('{breath}');
      for (let k = 1; k < B.phases.length; k++) expect(B.phases[k].tempo).toBeLessThan(B.phases[k - 1].tempo);
    }
    // (stood with its risen figure, the rise wears it)
    const R = bossRule(dragonBoss(DRAGON_IDS[0]), { figures: { risen: 'drake-risen' } });
    expect(R.phases[0].figure).toBeUndefined();
    expect(R.phases.slice(1).every((p) => p.figure === 'drake-risen')).toBe(true);
    expect(R.figures).toEqual(['drake-risen']);
  });
  it('the same idioms, each dragon its own implementation: its pattern one its answer answers, in its element\'s words', () => {
    for (const m of Object.keys(DRAGON_IDIOMS)) {
      const pats = DRAGON_IDS.map((id) => dragonBoss(id).moves[m].pattern);
      for (const p of pats) expect(ANSWERED_BY[DRAGON_IDIOMS[m].answer]).toContain(p);
      expect(new Set(DRAGON_IDS.map((id) => dragonBoss(id).moves[m].says)).size, m).toBe(DRAGON_IDS.length);
    }
    // (the breath, the tail and the buffet each done more than one way across the family)
    for (const m of ['breath', 'tail-sweep', 'wing-buffet']) expect(new Set(DRAGON_IDS.map((id) => dragonBoss(id).moves[m].pattern)).size, m).toBeGreaterThan(1);
  });
  it('one tell language: a move\'s answer is its tell\'s colour, the same in every dragon', () => {
    const colours = (id) => Object.fromEntries(Object.entries(bossRule(dragonBoss(id)).moves).map(([m, P]) => [m, P.tellColour]));
    const [a, b] = DRAGON_IDS.map(colours);
    for (const m of Object.keys(DRAGON_IDIOMS)) { expect(a[m]).toBe(ANSWERS[DRAGON_IDIOMS[m].answer]); expect(b[m]).toBe(a[m]); }
    expect(() => bossLaws({ ...dragonBoss(DRAGON_IDS[0]), moves: { ...dragonBoss(DRAGON_IDS[0]).moves, breath: { pattern: 'sweep', says: 'x', answer: 'dance' } } })).toThrow(/answer/);
  });
  it('each its own snout, a head drawn from the dragon\'s skull that stands; its body the draconic kin with wings', () => {
    const snouts = new Set(DRAGON_IDS.map((id) => DRAGONS[id].snout));
    expect(snouts.size).toBe(DRAGON_IDS.length);
    for (const s of snouts) { expect(HEAD_LIBRARY[s]?.from).toBe('dragon'); expect(() => validateHead(headPlan(s))).not.toThrow(); }
    const F = dragonFigure(DRAGON_IDS[0]);
    expect(F.beast).toMatchObject({ kin: 'draconic', head: DRAGONS[DRAGON_IDS[0]].snout });
    expect(F.outfit.pieces.some((p) => p.kind === 'wings')).toBe(true);
  });
});
