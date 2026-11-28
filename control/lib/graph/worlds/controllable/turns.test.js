import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// TURNS (core.js `seats.turns`, soul.input=turns: the alternating arcade game): one hero body, the seats taking turns at
// it. The seat whose turn it is drives it with its own controller, the others wait; its fall (or its body downed) spends
// that seat's own life and passes the turn to the next seat with lives left; `seconds` passes it on a clock too. None
// left to pass to: the seats are over. Without turns, as before.

const DT = 1 / 60;
const PIT = { ground: (p) => (p[1] > 50 ? null : 0) };
const hero = () => ({ id: 'p1', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6 }, ambient: { type: 'static' }, body: { type: 'none', hittable: true }, transform: { pos: [0, 0, 0], heading: 0 } });
const mk = (turns = {}, lives = 2) => createWorld({ entities: [hero()], seats: { bodies: [], max: 2, turns, lives, pool: 'own' } });
const run = (w, input, n) => { for (let i = 0; i < n; i++) stepWorld(w, input, DT, PIT); return w; };
const x = (w) => w.byId.p1.transform.pos[0];
const fall = (w) => { w.byId.p1.transform.pos = [x(w), 60, -30]; stepWorld(w, { seats: { 2: {} } }, DT, PIT); };

describe('turns', () => {
  it('seat 1\'s turn first: its stick drives, seat 2\'s does nothing', () => {
    const w = run(mk(), { forward: 0, seats: { 2: { forward: 1 } } }, 30);
    expect(w.turnOf.n).toBe(1);
    expect(x(w)).toBe(0);
    run(w, { forward: 1, seats: { 2: {} } }, 30);
    expect(x(w)).toBeGreaterThan(1);
  });

  it('a fall spends the turn\'s seat a life and passes the turn: now seat 2\'s stick drives', () => {
    const w = mk();
    fall(w);
    expect(w.seatLives).toEqual({ 1: 1, 2: 2 });
    expect(w.turnOf.n).toBe(2);
    const x0 = x(w);
    run(w, { forward: 1, seats: { 2: {} } }, 30);
    expect(x(w)).toBeCloseTo(x0, 6);                     // seat 1's stick, not its turn
    run(w, { forward: 0, seats: { 2: { forward: 1 } } }, 30);
    expect(x(w)).toBeGreaterThan(x0 + 1);
  });

  it('a seat with no lives is passed over; none left, the seats are over', () => {
    const w = mk({}, 1);
    fall(w);                                             // seat 1's last: seat 2's turn
    expect([w.turnOf.n, w.seatsOver]).toEqual([2, undefined]);
    fall(w);                                             // seat 2's last: nobody left
    expect(w.seatsOver).toBe(true);
  });

  it('seconds: the turn passes on the clock too', () => {
    const w = run(mk({ seconds: 2 }), { seats: { 2: {} } }, 125);
    expect(w.turnOf.n).toBe(2);
    expect(w.seatLives).toEqual({ 1: 2, 2: 2 });         // a turn timed out costs no life
  });

  it('without turns the extra seat\'s input is never read, and seat 1 drives as before', () => {
    const a = createWorld({ entities: [hero()] }), b = createWorld({ entities: [hero()] });
    run(a, { forward: 1 }, 30); run(b, { forward: 1, seats: { 2: { forward: -1 } } }, 30);
    expect(a.turnOf).toBeUndefined();
    expect(b.byId.p1.transform.pos).toEqual(a.byId.p1.transform.pos);
  });
});
