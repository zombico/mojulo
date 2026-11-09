// THE FEEL'S MEASURES (measure.js): the practice room's hero played headless, each number beside what its kit and its
// feel card ask. One case per procedure: a template's kit carried move by move (the hitstop a blow lands taken out of
// its timing), a blow out of reach lost and said, the card's side read, the air strings named, nothing measured for a world
// with no room, the same numbers every run.
import { describe, expect, it } from 'vitest';

import { measureRule, measureRoom, measuredSummary, armedRule } from './measure.js';
import { practiceRoom } from '../practice-room.js';
import { POLES, STAGES } from './cards.js';
import { TEMPLATE_ARSENALS } from '../combos.js';

// (a template with a kit, chosen from the table; one that does not fight hand to hand)
const KITTED = Object.keys(TEMPLATE_ARSENALS).find((id) => STAGES[POLES[id].stage]?.blocks);
const UNARMED = Object.keys(POLES).find((id) => !POLES[id].demo.includes('attack'));
const heroRule = (feel) => practiceRoom({ feel }, { sound: 'none' }).manifest.entities.find((e) => e.pilotable).rule;

describe('a kit measured on its room', () => {
  const M = measureRoom({ feel: KITTED });
  it('every ground combo played as written: each move\'s contact in its window, its chain at its cancel, its travel', () => {
    expect(M.tally.lost).toBe(0);
    const sword = M.weapons.find((W) => W.id === 'sword'), three = sword.combos.find((C) => C.beats === 'L L L' && !C.skipped);
    expect(three.moves).toHaveLength(3);
    for (const m of three.moves) expect(m.verdicts.contact).toBe('carried');
    // (the first two chain at their cancels, the hitstop their blows froze them taken out; the last is its full length)
    expect(three.moves.slice(0, 2).map((m) => m.verdicts.chain)).toEqual(['carried', 'carried']);
    expect(three.moves[2].verdicts.length).toBe('carried');
    expect(three.moves.filter((m) => m.asked.travel != null).every((m) => m.verdicts.travel === 'carried')).toBe(true);
  });
  it('names what it does not measure: the air strings', () => {
    const air = M.weapons.flatMap((W) => W.combos).filter((C) => C.skipped);
    for (const C of air) expect(C.skipped).toMatch(/air string|sidearm/);
  });
  it('reads the card\'s side: the hitstop inside its range, the parry its window, the dodge measured', () => {
    const row = (k) => M.card.find((r) => r.measure === k);
    expect(row('hitstop').verdict).toBe('carried');
    expect(row('parry').verdict).toBe('carried');
    expect(row('dodge').verdict).not.toBe('lost');
  });
  it('is the same every run', () => {
    expect(JSON.stringify(measureRoom({ feel: KITTED }))).toBe(JSON.stringify(M));
  });
  it('summarises for the readout: the tally, what fell short', () => {
    const S = measuredSummary(M);
    expect(S).toMatchObject({ carried: M.tally.carried, partly: M.tally.partly, lost: 0 });
    if (M.partly.length) expect(S.short.length).toBeGreaterThan(0);
    expect(measuredSummary(null)).toBeNull();
  });
});

describe('what it says when a number is not carried', () => {
  it('a weapon whose blows cannot reach where it stands: every contact lost, in words', () => {
    const R = armedRule(heroRule(KITTED));
    // (the measure stands the dummy just inside the weapon's reach: a reach the blade does not have puts it out of range)
    const far = { ...R, weapons: R.weapons.map((W, k) => (k ? W : { ...W, reach: 5 })) };
    const M = measureRule(far, KITTED);
    expect(M.tally.lost).toBeGreaterThan(0);
    expect(M.lost[0]).toMatch(/contact at none where \[\d+, \d+\] was asked/);
  });
  it('a world with no room measures nothing', () => {
    expect(measureRoom({ feel: UNARMED })).toBeNull();
    expect(measureRoom({})).toBeNull();
  });
});
