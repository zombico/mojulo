// FAIL-ON-DEATH WITH SEATS (mechanics.js seatedDeath, rules-basic.js seat-falls): every seat its own hp, taken by the hits
// on its own body and shown in its corner in its colour; a seat's spent is a seat down (a life, up beside the others, or
// out), seat 1's the level lost unless the seats count lives. No seats: what it always was.
import { describe, expect, it } from 'vitest';

import { composeMechanics, lowerMechanic } from './mechanics.js';
import { simLevel } from './level-sim.js';

const DEATH = { kind: 'fail-on-death', startHp: 30, hits: 10 };
const EXIT = { kind: 'reach-exit', at: [40, 0, 0] };
const hero = (id, x) => ({ id, pilotable: true, rule: { type: 'platform', eye: 0, speed: 4 }, ambient: { type: 'static' }, body: { type: 'none', hittable: true }, transform: { pos: [x, 0, 0], heading: 0 } });

describe('fail-on-death\'s lowering with seats', () => {
  it('no seats, or no hits counted: byte for byte what it was', () => {
    const bare = lowerMechanic('fail-on-death', DEATH, { i: 0, player: 'hero' });
    const seatedNoHits = lowerMechanic('fail-on-death', { startHp: 30 }, { i: 0, player: 'hero', seats: ['hero-2'] });
    expect(JSON.stringify(seatedNoHits)).toBe(JSON.stringify(lowerMechanic('fail-on-death', { startHp: 30 }, { i: 0, player: 'hero' })));
    expect(bare.world.vars).toEqual({ hp: 30 });
    expect(bare.world.watches).toEqual([{ type: 'dead', when: { var: 'hp', lte: 0 } }]);
  });

  it('seats: each its own hp on its own hits, in its corner and colour; seat 1 still the level\'s', () => {
    const m = lowerMechanic('fail-on-death', DEATH, { i: 0, player: 'hero', seats: ['hero-2', 'hero-3'] });
    const W = m.world;
    expect(W.vars).toEqual({ hp: 30, 'hp:2': 30, 'hp:3': 30 });
    expect(W.reactions).toContainEqual({ on: 'hit:hero-2', do: 'inc', var: 'hp:2', by: -10, min: 0 });
    expect(W.reactions).toContainEqual({ on: 'seat-down:2', do: 'ctrl', op: 'kill', who: 'hero-2' });
    expect(W.watches).toContainEqual({ type: 'dead', when: { var: 'hp', lte: 0 } });
    expect(W.watches.map((w) => w.type)).not.toContain('seat-down:1');
    expect(W.hud.find((r) => r.var === 'hp:2')).toMatchObject({ label: 'P2 HP', slot: 'bottom-right', color: '#3b7be5' });
    expect(W.hud.find((r) => r.var === 'hp:3')).toMatchObject({ slot: 'top-right', color: '#f2c230' });
  });

  it('seats counting lives: seat 1 is a seat like the others, the level never lost on its hp', () => {
    const W = lowerMechanic('fail-on-death', DEATH, { i: 0, player: 'hero', seats: ['hero-2'], seatLives: true }).world;
    expect(W.watches.map((w) => w.type)).toEqual(['seat-down:1', 'seat-down:2']);
    expect(W.reactions).toContainEqual({ on: 'seat-down:1', do: 'ctrl', op: 'kill', who: 'hero' });
    const body = lowerMechanic('fail-on-death', { of: 'body' }, { i: 0, player: 'hero', seats: ['hero-2'], seatLives: true, hints: {} });
    expect(body.world.reactions ?? []).toEqual([]);
  });
});

describe('a seat\'s hp spent, played', () => {
  const level = (seats) => {
    const mech = composeMechanics([DEATH, EXIT], { player: 'hero', seats: seats.bodies, ...(seats.lives ? { seatLives: true } : {}) });
    return simLevel({ entities: [hero('hero', 0), hero('hero-2', -2)], events: mech.events, world: { seats } });
  };
  const hits = (L, id, n) => { for (let k = 0; k < n; k++) L.frame(1 / 30, [{ type: `hit:${id}`, entity: id }]); };

  it('seat 2 hit to nothing falls, then is up beside seat 1 with its hp whole, a life spent', () => {
    const L = level({ bodies: ['hero-2'], lives: 2, pool: 'own' });
    hits(L, 'hero-2', 3);
    L.frame(1 / 30);
    expect(L.world.byId['hero-2'].downed).toBe(true);
    expect(L.bus.vars['hp:2']).toBe(30);
    L.run(2);
    expect(L.world.byId['hero-2'].downed).toBe(false);
    expect(L.world.seatLives).toEqual({ 1: 2, 2: 1 });
    expect(L.world.byId['hero-2'].transform.pos.slice(0, 2)).toEqual(L.world.byId.hero.transform.pos.slice(0, 2));
  });

  it('without lives, seat 1 hit to nothing is the level lost, as before', () => {
    const L = level({ bodies: ['hero-2'] });
    hits(L, 'hero', 3);
    L.frame(1 / 30);
    expect(L.bus.log.map((e) => e && e.type)).toContain('dead');
  });

  it('with lives, seat 1 hit to nothing is a seat down too, never the level lost; out of lives, out', () => {
    const L = level({ bodies: ['hero-2'], lives: 1, pool: 'own' });
    L.input.seats = { 2: {} };   // someone sits in seat 2 (an empty seat is not playing: rules-basic.js seat-falls)
    hits(L, 'hero', 3);
    L.run(2);
    const said = L.bus.log.map((e) => e && e.type);
    expect(said).toContain('seat-down:1');
    expect(said).not.toContain('dead');
    expect(L.world.byId.hero.gone).toBe(true);
    expect(L.world.seatOut).toEqual({ 1: true });
    expect(L.world.seatsOver).toBeUndefined();
    hits(L, 'hero-2', 3);
    L.run(2);
    expect(L.world.seatsOver).toBe(true);
  });
});
