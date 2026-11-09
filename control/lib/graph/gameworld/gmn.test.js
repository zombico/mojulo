import { describe, it, expect } from 'vitest';
import { readGameBrief, resolveGmn, layOrders, stampGameBrief, MOTIVATIONS, LABOURS, SIDE_SHARE } from './gmn.js';
import { readGameworld } from './world.js';
import { reviewParts } from './review.js';
import { intentReport } from './intent.js';
import { chaptersOfPath } from './chapters.js';

// THE GAME BRIEF: what a game is about, a mix of motivations and labours resolved once into decisions and orders. One
// case a procedure: a labour's structure, a motivation's stakes and arc, a mix's thresholds, the orders' two fixtures.

const pick = (rows, test) => Object.keys(rows).find((id) => test(rows[id]));
const CITADEL = pick(LABOURS, (l) => l.climax.kind === 'citadel'), PIECE = pick(LABOURS, (l) => l.climax.kind !== 'citadel' && l.shape !== 'hub'), HUB = pick(LABOURS, (l) => l.shape === 'hub');
const [M1, M2] = Object.keys(MOTIVATIONS);
const gmn = { motivations: { [M1]: 0.7, [M2]: 0.3 }, labours: { [CITADEL]: 0.7, [HUB]: 0.25, [PIECE]: 0.05 } };

describe('the Game Brief', () => {
  it('resolves the mix: the largest labour the structure, the others past the threshold their side, the rest said and dropped', () => {
    const R = resolveGmn(gmn), L = LABOURS[CITADEL], M = MOTIVATIONS[M1];
    expect(R).toMatchObject({ labour: CITADEL, motivation: M1, stakes: M.stakes, script: M.script, structure: { shape: L.shape, climax: 'citadel', beats: L.beats } });
    expect(R.side.map((s) => s.labour)).toEqual([CITADEL, HUB]);
    expect(R.said).toEqual([expect.stringContaining(`under ${SIDE_SHARE}`)]);
    // (the second motivation adds its cast and flags, never its stakes)
    for (const c of MOTIVATIONS[M2].cast) expect(R.cast).toContain(c);
    expect(R.spine.acts.map((a) => a.stage)).toEqual(['early', 'mid', 'late']);
    // (the same mix however its keys are written)
    expect(resolveGmn({ labours: { [PIECE]: 0.05, [HUB]: 0.25, [CITADEL]: 0.7 }, motivations: { [M2]: 0.3, [M1]: 0.7 } })).toEqual(R);
  });

  it('lays the first level and the climax, with the colour theorist\'s notes; a hub its home; nothing without a labour', () => {
    const R = resolveGmn(gmn), O = layOrders(R);
    expect(O.map((x) => [x.id, x.kind, x.role])).toEqual([['lv0', 'map', 'arrival'], ['citadel', 'citadel', 'climax']]);
    expect(O[0].mood).toEqual({ script: R.script, at: 0, light: R.light[0] });
    expect(O[1].mood).toEqual({ script: R.script, at: 1, light: R.light[2] });
    expect(layOrders(resolveGmn({ labours: { [PIECE]: 1 } })).map((x) => x.id)).toEqual(['lv0', 'climax']);
    expect(layOrders(resolveGmn({ labours: { [HUB]: 1 } })).map((x) => x.id)).toEqual(['lv0', 'hub', 'climax']);
    expect(layOrders(resolveGmn({ motivations: { [M1]: 1 } }))).toEqual([]);
  });

  it('is stamped once: kept until the mix changes, the operator\'s orders kept through it, rerolled on asking', () => {
    const none = { id: 'w' };
    expect(stampGameBrief(none)).toBe(none);
    const W = stampGameBrief({ id: 'w', gameBrief: { gmn } }), mine = [{ ...W.gameBrief.orders[0], words: 'the operator\'s own' }];
    const again = stampGameBrief(W);
    expect(again.gameBrief.resolved).toBe(W.gameBrief.resolved);
    const moved = stampGameBrief({ id: 'w', gameBrief: { ...W.gameBrief, orders: mine, gmn: { labours: { [PIECE]: 1 } } } });
    expect(moved.gameBrief.resolved.labour).toBe(PIECE);
    expect(moved.gameBrief.orders).toEqual(mine);
    expect(stampGameBrief({ id: 'w', gameBrief: { ...moved.gameBrief, orders: 'reroll' } }).gameBrief.orders.map((x) => x.id)).toEqual(['lv0', 'climax']);
  });

  it('refuses what it cannot read, by name', () => {
    const bad = (v, re) => expect(() => readGameBrief(v)).toThrow(re);
    bad({ gmn: { labours: { 'not-one': 1 } } }, /not-one is not one/);
    bad({ gmn: { labours: { [CITADEL]: 0.5 } } }, /sums to 0.5/);
    bad({ gmn: {} }, /names motivations, labours or both/);
    bad({ gmn, pitch: 'x' }, /\.pitch is not part of it/);
    bad({ gmn, orders: [{ id: 'a', kind: 'map', role: 'arrival' }] }, /words say what is ordered/);
    bad({ gmn, orders: [{ id: 'a', kind: 'map', role: 'arrival', words: 'x', mood: { light: 'bright' } }] }, /mood\.light is/);
    bad({ gmn, orders: [{ id: 'a', kind: 'map', role: 'x', words: 'x' }] }, /role is/);
  });

  it('is the intent pillar\'s: read by the world, in the part the creator accepts, its genres suggested, never written', () => {
    const base = { id: 'w', start: 'a', levels: { a: { walk: { nodes: { t: { trail: {} } } } } } };
    const W = stampGameBrief({ ...base, gameBrief: { gmn } });
    expect(chaptersOfPath('/gameBrief/gmn').map((c) => c.id ?? c)).toContain('intent');
    expect(() => readGameworld({ ...base, gameBrief: { gmn: { labours: { x: 1 } } } })).toThrow(/x is not one/);
    const part = reviewParts(W).find((p) => p.id === 'intent');
    expect(part.content.gmn).toEqual(gmn);
    expect(part.content.orders.map((o) => o.id)).toEqual(['lv0', 'citadel']);
    // (a world without a brief has no such part from it)
    expect(reviewParts(base).find((p) => p.id === 'intent')).toBeUndefined();
    const I = intentReport(W);
    expect(I.suggest[0].matched[0]).toContain(CITADEL);
    expect(I.gameBrief).toMatchObject({ labour: CITADEL, motivation: M1 });
    expect(I.gameBrief.orders[0]).toMatch(/^lv0: map, arrival: /);
    // (a written intent holds: nothing suggested over it)
    expect(intentReport({ ...W, intent: { from: 'jrpg' } }).suggest).toBeUndefined();
  });
});
