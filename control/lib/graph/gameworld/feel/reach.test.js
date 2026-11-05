import { describe, it, expect } from 'vitest';
import { POLE_IDS, poleCard } from './cards.js';
import { reachOf, reachAt, shippedRule, MOVES, DROP } from './reach.js';
import { feelRule } from './lower.js';

// THE REACH: each move's arc, played on the rule a game ships. One template per procedure, chosen from the catalog: one
// with an air jump and a cut jump (a short hop), one with neither air jump nor gather, one that gathers before it leaves.
const airy = POLE_IDS.find((id) => poleCard(id).air?.jumps > 0 && poleCard(id).jump.cut < 1 && poleCard(id).jump.commit === 0);
const grounded = POLE_IDS.find((id) => !(poleCard(id).air?.jumps > 0) && poleCard(id).jump.commit === 0 && poleCard(id).jump.cut < 1);
const gathers = POLE_IDS.find((id) => poleCard(id).jump.commit > 1);

describe('the reach of a feel', () => {
  const A = reachOf(airy), G = reachOf(grounded);

  it('is measured on the shipped rule: the run\'s apex is the card\'s height, its flight the run speed times its air', () => {
    expect(A.rule).toEqual(shippedRule(airy));
    expect(A.moves.run.height).toBeCloseTo(poleCard(airy).jump.height, 2);
    expect(A.moves.run.long).toBeCloseTo(A.speed * A.moves.run.air, 0);
    expect(Object.keys(A.moves)).toEqual(MOVES);
  });

  it('orders the moves: the hop shortest, the run longest of the single jumps, the air jump higher and farther still', () => {
    const M = A.moves;
    expect(M.hop.height).toBeLessThan(M.run.height);
    expect(M.hop.long).toBeLessThan(M.stand.long);
    expect(M.stand.long).toBeLessThanOrEqual(M.run.long);
    expect(M.air.height).toBeGreaterThan(M.run.height);
    expect(M.air.long).toBeGreaterThan(M.run.long);
  });

  it('a card without an air jump has no air move; one with no cut hops as high as it jumps', () => {
    expect(G.moves.air).toBeUndefined();
    const noCut = POLE_IDS.find((id) => poleCard(id).jump.cut >= 1);
    if (noCut) { const N = reachOf(noCut).moves; expect(N.hop.height).toBeCloseTo(N.run.height, 3); }
  });

  it('a ledge higher lands nearer, one lower farther; past the apex, none; the arc followed DROP metres down', () => {
    const run = A.moves.run;
    expect(reachAt(run, 0)).toBe(run.long);
    expect(reachAt(run, 1)).toBeLessThan(run.long);
    expect(reachAt(run, -2)).toBeGreaterThan(run.long);
    expect(reachAt(run, run.height + 0.01)).toBeNull();
    expect(Math.min(...run.arc.map((p) => p[1]))).toBeLessThan(-DROP + 0.5);
    expect(reachAt(run, -DROP - 1)).toBeNull();
  });

  it('a card that gathers leaves after its gather, the stand\'s flight its own; the takes change no reach', () => {
    const R = reachOf(gathers).moves;
    expect(R.run.height).toBeCloseTo(poleCard(gathers).jump.height, 1);
    expect(reachOf({ pole: airy, takes: true }).moves.run).toEqual(A.moves.run);
    expect(shippedRule({ pole: airy, takes: true })).toMatchObject(feelRule({ pole: airy, takes: true }));
  });

  it('is deterministic', () => {
    expect(reachOf(grounded)).toEqual(G);
  });
});
