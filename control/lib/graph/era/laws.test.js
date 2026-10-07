import { describe, it, expect } from 'vitest';
import { LAWS, LAYERS, PRINCIPLE_LAWS, statedPrinciples, lawLedger } from './laws.js';

describe('sixth-gen laws: every principle counted', () => {
  it('maps every principle every style card states, in order, and nothing a card does not state', () => {
    const stated = statedPrinciples();
    expect(Object.keys(PRINCIPLE_LAWS).sort()).toEqual(Object.keys(stated).sort());
    for (const [card, principles] of Object.entries(stated)) {
      expect(PRINCIPLE_LAWS[card], `${card}: one row of laws per principle`).toHaveLength(principles.length);
      PRINCIPLE_LAWS[card].forEach((laws, i) => expect(laws.length, `${card}#${i}: ${principles[i]}`).toBeGreaterThan(0));
    }
  });

  it('names only known laws, each on a known layer', () => {
    for (const L of Object.values(LAWS)) expect(LAYERS).toContain(L.layer);
    for (const [card, rows] of Object.entries(PRINCIPLE_LAWS)) rows.forEach((laws, i) => laws.forEach((l) => expect(LAWS[l], `${card}#${i} names '${l}'`).toBeDefined()));
  });

  it('every law is stated by a card or carried by the era', () => {
    for (const [id, L] of Object.entries(lawLedger())) expect(L.stated.length > 0 || L.era, id).toBe(true);
  });
});
