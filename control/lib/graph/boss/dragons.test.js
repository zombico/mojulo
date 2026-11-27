// THE DRAGONS (boss/dragons.js): a family of bosses sharing their idioms and their tell language, each its element, its
// signatures and its snout. One dragon read is every dragon read; each one's own laws hold.
import { describe, it, expect } from 'vitest';
import { DRAGONS, DRAGON_IDS, DRAGON_IDIOMS, dragonBoss, dragonFigure } from './dragons.js';
import { bossLaws, ANSWERS } from './bosses.js';
import { bossRule } from './stand.js';
import { HEAD_LIBRARY, headPlan } from '../creature-heads/index.js';
import { validateHead } from '../polygonizer/station-loft-head.js';

describe('a family of dragons', () => {
  it('every dragon is a boss the director fights, its laws holding: told, escapable, survivable, opened after', () => {
    for (const id of DRAGON_IDS) for (const l of bossLaws(dragonBoss(id))) expect(l.holds, `${id} ${l.law}: ${l.says}`).toBe(true);
  });
  it('they share the idioms, each in its own element\'s words, and each adds its own signatures as it is hurt', () => {
    for (const id of DRAGON_IDS) {
      const B = dragonBoss(id), own = Object.keys(DRAGONS[id].signature);
      for (const m of Object.keys(DRAGON_IDIOMS)) expect(B.moves[m].pattern, `${id} ${m}`).toBe(DRAGON_IDIOMS[m].pattern);
      expect(B.moves.breath.says).not.toContain('{breath}');
      for (const m of own) { expect(Object.keys(B.phases[0].moves)).not.toContain(m); expect(Object.keys(B.phases.at(-1).moves)).toContain(m); }
      expect(B.phases.at(-1).tempo).toBeLessThan(B.phases[0].tempo);
    }
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
