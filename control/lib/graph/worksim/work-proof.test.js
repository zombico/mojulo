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

// TWO COOKS, ONE PASS: the orders card laid split in two (a cook's side each, x < 0 and x > 0): the crates and every
// station that takes only raw things on cook 1's side, every station that takes a made thing (the assembly) and the
// hand-in on cook 2's, the shelves on the line between, put from cook 1's side and taken from cook 2's
function split(card) {
  const C = SCENARIOS[card], raw = (i) => !Object.values(C.stations).some((s) => s.gives[i]);
  const takes = Object.values(C.stations).flatMap((s) => Object.keys(s.takes ?? {}));
  const crates = [...new Set(takes.filter(raw))], made = [...new Set(takes.filter((i) => !raw(i)))];
  const sides = Object.entries(C.stations).reduce((o, [sid, s]) => { (Object.keys(s.takes ?? {}).some((i) => !raw(i)) ? o.r : o.l).push(sid); return o; }, { l: [], r: [] });
  const col = (list, x) => Object.fromEntries(list.map((k, j) => [k, [x, (j - (list.length - 1) / 2) * 2.5, 0]]));
  return { crates: col(crates, -6), stations: { ...col(sides.l, -3), ...col(sides.r, 3) }, shelves: col(made, 0), serve: [6, 0, 0] };
}

describe('the work proof, two cooks', () => {
  const cooks = [{ spawn: [-2, 0, 0], reach: (p) => p[0] < 0 }, { spawn: [2, 0, 0], reach: (p) => p[0] > 0 }];
  it('a kitchen split in two is won only through the pass: cook 2 serves what cook 1 put across', () => {
    const at = split(ORDERS), r = proveWork({ card: ORDERS, at }, { spawn: cooks[0].spawn, cooks });
    expect(r.won).toBe(true);
    const [one, two] = r.cooks;
    expect([one.outside, two.outside]).toEqual([0, 0]);
    expect(one.served).toBe(0);
    expect(two.served).toBe(r.served);
    expect(Object.values(r.passed).reduce((t, n) => t + n, 0)).toBeGreaterThanOrEqual(r.served);
    expect(proveWork({ card: ORDERS, at }, { spawn: cooks[0].spawn, cooks })).toEqual(r);
  });
  it('with nobody on the far side nothing crosses, and the shift is lost', () => {
    const at = split(ORDERS), r = proveWork({ card: ORDERS, at }, { spawn: cooks[0].spawn, cooks: [cooks[0], { spawn: [2, 0, 0], reach: () => false }] });
    expect(r.won).toBe(false);
    expect(r.served).toBe(0);
  });
});
