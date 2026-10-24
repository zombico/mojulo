import { describe, expect, it } from 'vitest';

import { buildSeatsKernel, SEATS } from './seats-kernel.js';

// a seat is a player position bound to one controller (docs/local-multiplayer-principles.md)
const K = SEATS;
const press = (...ids) => Object.fromEntries(ids.map((id) => [id, { join: true }]));

describe('seats', () => {
  it('a controller joins the lowest free seat, once, until the seats are full; each seat its number and colour', () => {
    let S = K.newSeats({ max: 2 });
    S = K.step(S, press('pad:1'));
    S = K.step(S, press('pad:1', 'keyboard'));   // pad:1 again: it holds its seat, it does not take another
    S = K.step(S, press('pad:0'));               // full
    expect(S.seats.map((x) => [x.n, x.controller, x.label, x.color])).toEqual([[1, 'pad:1', 'P1', '#e5483b'], [2, 'keyboard', 'P2', '#3b7be5']]);
    expect(K.seatOf(S, 'pad:0')).toBeNull();
  });

  it('a lost pad keeps its seat, away, until the same pad is back; a leave frees the number for the next to join', () => {
    let S = K.step(K.step(K.newSeats({ max: 4 }), press('pad:0')), press('pad:2', 'keyboard'));
    S = K.step(S, { 'pad:2': { connected: false } });
    expect(K.seatOf(S, 'pad:2')).toMatchObject({ n: 2, away: true });
    expect(K.present(S).map((x) => x.n)).toEqual([1, 3]);
    S = K.step(S, { 'pad:3': { join: true } });   // another pad takes the next free seat, not the away one
    expect(K.seatOf(S, 'pad:3').n).toBe(4);
    S = K.step(S, { 'pad:2': { connected: true } });
    expect(K.seatOf(S, 'pad:2')).toMatchObject({ n: 2, away: false });
    S = K.step(S, { keyboard: { leave: true } });
    S = K.step(S, press('pad:5'));
    expect(K.seatOf(S, 'pad:5').n).toBe(3);
    expect(S.seats.map((x) => x.n)).toEqual([1, 2, 3, 4]);
  });

  it('a lobby seats only while it is open; drop-in seats at any time', () => {
    let L = K.setOpen(K.newSeats({ join: 'lobby' }), false);
    expect(K.step(L, press('pad:0')).seats).toEqual([]);
    L = K.setOpen(L, true);
    expect(K.step(L, press('pad:0')).seats.length).toBe(1);
    expect(K.step(K.setOpen(K.newSeats(), false), press('pad:0')).seats.length).toBe(1);
  });

  it('is pure: a step leaves its input as it was, and joined names the frame\'s joins', () => {
    const S0 = K.newSeats(), S1 = K.step(S0, press('touch'));
    expect(S0.seats).toEqual([]);
    expect(K.joined(S1, S0).map((x) => x.controller)).toEqual(['touch']);
  });

  it('runs the same from its own source, as a page emits it', () => {
    const P = new Function(`return (${buildSeatsKernel.toString()})();`)();
    expect(P.step(P.newSeats(), press('pad:0')).seats).toEqual(K.step(K.newSeats(), press('pad:0')).seats);
    expect(() => K.newSeats({ max: 5 })).toThrow(/1 to 4/);
  });
});
