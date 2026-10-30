import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// SEATS (opt-in `spec.seats`): the bodies seats 2 to 4 take, each on its pilot rule and its own input
// (`input.seats[n]`); seat 1 is the world's pilot. A seat with no player leaves its body to its AI (`drop: 'ai'`) or holds
// it (`'pause'`). Without `spec.seats` a world steps as it always did.

const DT = 1 / 60, FLAT = { ground: () => 0 };
const hero = (id, x) => ({ id, pilotable: true, rule: { type: 'platform', eye: 0, speed: 6 }, ambient: { type: 'static' }, transform: { pos: [x, 0, 0], heading: 0 } });
const mk = (seats) => createWorld({ entities: [hero('p1', 0), hero('p2', 0), hero('p3', 0)], ...(seats ? { seats } : {}) });
const run = (w, input, n) => { for (let i = 0; i < n; i++) stepWorld(w, input, DT, FLAT); return w; };
const x = (w, id) => w.byId[id].transform.pos[0];

describe('seats in the sim', () => {
  it('each seat drives its own body; an unseated pilotable body stands', () => {
    const w = run(mk({ bodies: ['p2'] }), { forward: 1, seats: { 2: { forward: 1, turn: 0 } } }, 30);
    expect(x(w, 'p1')).toBeGreaterThan(1);
    expect(x(w, 'p2')).toBeCloseTo(x(w, 'p1'), 9);   // the same stick, the same steps
    expect(x(w, 'p3')).toBe(0);
    const v = run(mk({ bodies: ['p2'] }), { forward: 1, seats: { 2: { forward: 0 } } }, 30);
    expect(x(v, 'p2')).toBe(0);                         // seat 2 holds still while seat 1 runs: its own input
    expect(x(v, 'p1')).toBeGreaterThan(1);
  });

  it('a seat with no player this frame leaves its body to its AI, or holds it on its pilot rule', () => {
    const ai = run(mk({ bodies: ['p2'] }), { forward: 1 }, 2);
    expect(ai.byId.p2.rule).toBe(ai.byId.p2.ambientRule);
    const held = run(mk({ bodies: ['p2'], drop: 'pause' }), { forward: 1 }, 2);
    expect(held.byId.p2.rule).toBe(held.byId.p2.pilotRule);
    expect(x(held, 'p2')).toBe(0);
  });

  it('without seats the extra input is never read, and seat 1 is the pilot as before', () => {
    const a = run(mk(), { forward: 1 }, 30), b = run(mk(), { forward: 1, seats: { 2: { forward: 1 } } }, 30);
    expect(a.seatOf).toBeUndefined();
    for (const id of ['p1', 'p2', 'p3']) expect(b.byId[id].transform.pos).toEqual(a.byId[id].transform.pos);
    expect(x(a, 'p2')).toBe(0);
  });
});

// THE GROUP FRAME (rules-basic.js groupFrame and the group leash): a shared camera holds every playing seat in view
describe('a shared camera with seats', () => {
  const cam = (type) => ({ rule: type, target: 'p1', dist: type === 'side' ? 11 : 14 });
  const mkCam = (type, seats) => createWorld({ entities: [hero('p1', 0), hero('p2', 0)], camera: cam(type), ...(seats ? { seats } : {}) });
  it.each(['side', 'overhead'])('%s: one pilot runs off and both stay in the shot, the camera backing off to its limit', (type) => {
    const w = mkCam(type, { bodies: ['p2'] }), C = w.camera, base = type === 'side' ? 11 : 14;
    let far = 0;
    for (let i = 0; i < 600; i++) {
      stepWorld(w, { forward: 1, seats: { 2: { forward: 0 } } }, DT, FLAT);
      const G = C.rule && { half: Math.tan((50 * Math.PI) / 360), max: base * 2.2 };
      const a = w.byId.p1.transform.pos, b = w.byId.p2.transform.pos, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const reach = G.max * G.half - 2;
      expect(Math.hypot(a[0] - mid[0], a[1] - mid[1])).toBeLessThanOrEqual(reach + 1e-9);
      far = Math.max(far, Math.hypot(C.transform.pos[0] - C.lookAt[0], C.transform.pos[1] - C.lookAt[1], C.transform.pos[2] - C.lookAt[2]));
    }
    expect(w.byId.p1.transform.pos[0] - w.byId.p2.transform.pos[0]).toBeGreaterThan(10);   // they did part
    expect(far).toBeGreaterThan(base * 1.5);                                               // and the camera stood back
    expect(C.lookAt[0]).toBeCloseTo((w.byId.p1.transform.pos[0] + w.byId.p2.transform.pos[0]) / 2, 1);
  });
  it('one seat: the camera frames its target, and nobody is held', () => {
    const w = mkCam('side');
    for (let i = 0; i < 600; i++) stepWorld(w, { forward: 1 }, DT, FLAT);
    expect(w.byId.p1.transform.pos[0]).toBeGreaterThan(30);
    expect(w.camera.lookAt[0]).toBeCloseTo(w.byId.p1.transform.pos[0], 6);
  });
});

// LIVES (soul.pool; rules-basic.js 'seat-falls'): a fall below the floor costs a seat one of its own lives, or one of the
// count the seats share; a seat with none left is out (its body gone), and when no seat is left playing the seats are over.
describe('lives per seat', () => {
  // ground everywhere but a pit past y = 50, where a body set below the floor keeps falling
  const PIT = { ground: (p) => (p[1] > 50 ? null : 0) };
  const drop = (w, id) => { w.byId[id].transform.pos = [w.byId[id].transform.pos[0], 60, -30]; stepWorld(w, { seats: { 2: {} } }, DT, PIT); };
  const two = (seats) => createWorld({ entities: [hero('p1', 0), hero('p2', 3)], seats: { bodies: ['p2'], ...seats } });

  it('own: each fall costs that seat one and brings it back beside the other; at none it sits out, the other plays on', () => {
    const w = two({ lives: 2 });
    drop(w, 'p2');
    expect(w.seatLives).toEqual({ 1: 2, 2: 1 });
    expect(w.byId.p2.transform.pos.slice(0, 2)).toEqual(w.byId.p1.transform.pos.slice(0, 2));
    drop(w, 'p2');
    expect(w.seatLives[2]).toBe(0);
    expect(w.byId.p2.gone).toBe(true);
    expect(w.seatOut).toEqual({ 2: true });
    expect(w.seatsOver).toBeUndefined();
    // seat 1 falls with lives left: back beside nobody playing, so where it started
    drop(w, 'p1');
    expect(w.seatLives[1]).toBe(1);
    expect(w.byId.p1.transform.pos.slice(0, 2)).toEqual([0, 0]);
    drop(w, 'p1');
    expect(w.seatsOver).toBe(true);
  });

  it('seat 1 out, seat 2 still in: the shared camera frames seat 2', () => {
    const w = createWorld({ entities: [hero('p1', 0), hero('p2', 3)], camera: { rule: 'side', target: 'p1', dist: 11 }, seats: { bodies: ['p2'], lives: 1 } });
    drop(w, 'p1');
    expect(w.byId.p1.gone).toBe(true);
    expect(w.seatsOver).toBeUndefined();
    for (let i = 0; i < 120; i++) stepWorld(w, { seats: { 2: { forward: 1 } } }, DT, FLAT);
    expect(w.camera.lookAt[0]).toBeCloseTo(w.byId.p2.transform.pos[0], 1);
  });

  it('shared: one count for every seat; at none every seat is out and the seats are over', () => {
    const w = two({ lives: 2, pool: 'shared' });
    drop(w, 'p2');
    drop(w, 'p1');
    expect(w.seatLives).toEqual({ shared: 0 });
    expect(w.byId.p1.gone && w.byId.p2.gone).toBe(true);
    expect(w.seatsOver).toBe(true);
  });

  it('without lives a fall costs nothing, and seat 1\'s is left to the level\'s catch', () => {
    const w = two({});
    drop(w, 'p1');
    expect(w.byId.p1.transform.pos[2]).toBeLessThan(-20);
    expect(w.seatLives).toBeUndefined();
  });
});
