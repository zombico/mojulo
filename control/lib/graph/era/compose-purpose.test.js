// What a place is for (compose-purpose.js): the purpose read and stamped, its rail, a room's allowance (the recipe's
// own over its rail's), and a room's pieces laid in rank within it, a costly piece left out and a cheaper one tried.
import { describe, expect, it } from 'vitest';
import { PURPOSES, PURPOSE_IDS, readPurpose, purposeAtMint, railOf, allowanceOf, rankOf, layWithin, PIECE_RANK } from './compose-purpose.js';
import { ROLES } from '../furnishings/roster.js';

describe('the purpose', () => {
  it('read, stamped (a level a game, a house a show), its rail; absent, none: as it was', () => {
    expect(readPurpose(undefined)).toBeNull();
    expect(() => readPurpose('demo')).toThrow(/purpose: one of/);
    expect(purposeAtMint({})).toBe('show');
    expect(purposeAtMint({ level: { goal: 'top' } })).toBe('game');
    expect(purposeAtMint({ level: { goal: 'top' }, purpose: 'show' })).toBe('show');
    expect(railOf(undefined)).toBeNull();
    for (const p of PURPOSE_IDS) expect(railOf(p)).toBe(PURPOSES[p]);
    // (a game reads at a grain within an allowance; a show at its pieces' own)
    expect([railOf('game').grain > 0, railOf('game').allowance.room > 0, railOf('show').grain, railOf('show').allowance]).toEqual([true, true, null, null]);
  });

  it('a room\'s allowance: the recipe\'s own over its rail\'s, a game\'s only', () => {
    expect(allowanceOf({ purpose: 'game' })).toBe(PURPOSES.game.allowance.room);
    expect(allowanceOf({ purpose: 'game', allowance: { room: 40 } })).toBe(40);
    expect(allowanceOf({ purpose: 'show' })).toBeNull();
    expect(allowanceOf({})).toBeNull();
    expect(() => allowanceOf({ purpose: 'show', allowance: { room: 40 } })).toThrow(/a game's/);
    expect(() => allowanceOf({ purpose: 'game', allowance: { room: 0 } })).toThrow(/allowance: \{ room/);
  });
});

describe('a room laid within its allowance', () => {
  it('in rank: what the room is for always stands; a costly piece left out, a cheaper one after it tried; null keeps all', () => {
    // (every rank the roster's roles take is ranked)
    for (const role of Object.keys(ROLES)) expect(PIECE_RANK[role], role).toBeDefined();
    const pieces = [{ id: 'lamp', role: 'lamp', cost: 5 }, { id: 'chair', role: 'easy-chair', cost: 60 }, { id: 'bed', role: 'bed', cost: 50 }, { id: 'cup', role: 'tabletop', cost: 1 }];
    const by = { costOf: (p) => p.cost, rankOf: (p) => rankOf(p.role) };
    const L = layWithin(pieces, { allowance: 58, ...by });
    expect(L.kept.map((p) => p.id)).toEqual(['lamp', 'bed', 'cup']);   // (in the given order)
    expect(L.dropped.map((d) => [d.piece.id, d.cost])).toEqual([['chair', 60]]);
    expect([L.spent, L.over]).toEqual([56, false]);
    expect(layWithin(pieces, { allowance: null, ...by }).kept).toEqual(pieces);
    // (the bed stands even past the allowance, said over; nothing else is laid)
    const T = layWithin(pieces, { allowance: 20, ...by });
    expect([T.kept.map((p) => p.id), T.over]).toEqual([['bed'], true]);
  });
});
