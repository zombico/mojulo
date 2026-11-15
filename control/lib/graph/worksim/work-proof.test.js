// The work proof: a level of a card played on the bus by a walker who knows it, beside the simulator. One card per
// procedure, chosen from the starters in code: an orders card with a station that runs alone, and a backlog card.
import { describe, it, expect } from 'vitest';
import { proveWork } from './work-proof.js';
import { SCENARIOS } from './scenarios.js';

const cards = Object.entries(SCENARIOS);
const [ORDERS] = cards.find(([, c]) => (c.demand.mode ?? 'orders') === 'orders' && Object.values(c.stations).some((s) => s.wait));
const [BACKLOG] = cards.find(([, c]) => c.demand.mode === 'backlog');

describe('the work proof', () => {
  it('an orders level is won by a walker who knows the card, near what the simulator serves', () => {
    const r = proveWork({ card: ORDERS });
    expect(r.won).toBe(true);
    expect(r.served).toBeGreaterThanOrEqual(r.goal);
    expect(Math.abs(r.served - r.sim.served)).toBeLessThanOrEqual(Math.ceil(r.sim.served * 0.25));
  });
  it('a backlog level is cleared to its goal, and the proof is deterministic', () => {
    const r = proveWork({ card: BACKLOG });
    expect(r.won).toBe(true);
    expect(proveWork({ card: BACKLOG })).toEqual(r);
  });
  it('a goal past what can be done is lost, and said', () => {
    const r = proveWork({ card: BACKLOG, goal: 99 });
    expect(r.won).toBe(false);
    expect(r.says).toMatch(/^lost/);
  });
});
