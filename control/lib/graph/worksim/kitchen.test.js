// The kitchen: a card laid as a designed arena for its cooks, held to its laws, played by its cooks on the bus, and
// tuned to them. One kitchen per procedure (sealed sides with passes, one open floor), chosen from the rows in code; the
// orders card with a station that runs alone, chosen from the starters in code.
import { describe, it, expect } from 'vitest';
import { KITCHENS, KITCHEN_IDS, layKitchen, kitchenLaws, cooksOf, rolesOf } from './kitchen.js';
import { proveWork, tuneKitchen } from './work-proof.js';
import { SCENARIOS } from './scenarios.js';

const [, CARD] = Object.entries(SCENARIOS).find(([, c]) => (c.demand.mode ?? 'orders') === 'orders' && Object.values(c.stations).some((s) => s.wait));
const SEALED = KITCHEN_IDS.find((k) => KITCHENS[k].sealed), OPEN = KITCHEN_IDS.find((k) => !KITCHENS[k].sealed);
const holds = (K) => Object.fromEntries(kitchenLaws(K).map((l) => [l.law, l.holds]));

describe('the kitchen', () => {
  it('reads each place\'s role off the card: raws, prep that takes only raws, assembly that takes a made thing', () => {
    const R = rolesOf(CARD);
    expect(R.prep.every((sid) => Object.keys(CARD.stations[sid].takes ?? {}).every((i) => R.raws.includes(i)))).toBe(true);
    expect(R.assembly.every((sid) => Object.keys(CARD.stations[sid].takes).some((i) => !R.raws.includes(i)))).toBe(true);
    expect([...R.prep, ...R.assembly].sort()).toEqual(Object.keys(CARD.stations).sort());
  });
  it('sealed sides: every law holds, prep on one side, the hand-in on the other, what crosses on a pass', () => {
    const K = layKitchen(CARD, { kitchen: SEALED, cooks: 2 });
    expect(holds(K)).toEqual({ reachable: true, sealed: true, handoff: true, passes: true, clearance: true, frame: true });
    const R = rolesOf(CARD);
    for (const sid of R.prep) expect(K.at.stations[sid].every((p) => p[0] < K.zones[0].rect[2])).toBe(true);
    expect(K.at.serve[0]).toBeGreaterThan(K.zones[1].rect[0]);
    expect(K.passes.length).toBeGreaterThan(0);
    expect(K.seatZone).toEqual([0, 1]);
  });
  it('a gap in the counter is a leak the sealed law sees', () => {
    const K = layKitchen(CARD, { kitchen: SEALED, cooks: 2 });
    const open = { ...K, blocks: K.blocks.filter((b) => b.kind !== 'counter') };
    expect(holds(open).sealed).toBe(false);
  });
  it('a map varied: mirrored, prep on the other side, the cooks facing the other way; an island in each floor; every law holds', () => {
    const K = layKitchen(CARD, { kitchen: SEALED, cooks: 2 }), M = layKitchen(CARD, { kitchen: SEALED, cooks: 2, mirror: true, obstacles: true });
    expect(holds(M)).toEqual({ reachable: true, sealed: true, handoff: true, passes: true, clearance: true, frame: true });
    expect(M.heading).toBeCloseTo(Math.PI);
    const R = rolesOf(CARD), mid = (b) => (b.min[0] + b.max[0]) / 2;
    const counter = (X) => mid(X.blocks.find((b) => b.kind === 'counter'));
    expect(R.prep.every((sid) => K.at.stations[sid].every((p) => p[0] < counter(K)))).toBe(true);
    expect(R.prep.every((sid) => M.at.stations[sid].every((p) => p[0] > counter(M)))).toBe(true);
    expect(M.blocks.filter((b) => b.kind === 'island').length).toBe(M.zones.length);
    expect(K.blocks.some((b) => b.kind === 'island')).toBe(false);
  });
  it('one open floor: every cook reaches everything, nothing claims a handoff', () => {
    const K = layKitchen(CARD, { kitchen: OPEN, cooks: 4 });
    const H = holds(K);
    expect(H).toMatchObject({ reachable: true, clearance: true, frame: true });
    expect(H.sealed).toBeUndefined();
    expect(new Set(K.seatZone)).toEqual(new Set([0]));
  });
  it('two cooks on sealed sides win only through the pass, and the proof is deterministic', () => {
    const K = layKitchen(CARD, { kitchen: SEALED, cooks: 2 }), at = K.at;
    const r = proveWork({ card: CARD, at }, { spawn: K.spawns[0], cooks: cooksOf(K) });
    expect(r.won).toBe(true);
    expect(r.cooks.map((c) => c.outside)).toEqual([0, 0]);
    expect(r.cooks[0].served).toBe(0);
    expect(Object.keys(r.passed).every((i) => K.passes.includes(i))).toBe(true);
    expect(proveWork({ card: CARD, at }, { spawn: K.spawns[0], cooks: cooksOf(K) })).toEqual(r);
  });
  it('tuned to its cooks: the orders the proof shows they keep up with, the goal from what they served', () => {
    const one = tuneKitchen(CARD, { kitchen: SEALED, cooks: 1 }), two = tuneKitchen(CARD, { kitchen: SEALED, cooks: 2 });
    expect(two.proof.served / two.proof.arrivals).toBeGreaterThanOrEqual(0.85);
    expect(two.goal).toBe(Math.floor(0.8 * two.proof.served));
    expect(two.goal).toBeGreaterThan(one.goal);
    expect(two.card.demand.every).toBeLessThan(one.card.demand.every);
  });
});
