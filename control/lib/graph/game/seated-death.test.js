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
  it('no seats: what it was', () => {
    const bare = lowerMechanic('fail-on-death', DEATH, { i: 0, player: 'hero' });
    expect(bare.world.vars).toEqual({ hp: 30 });
    expect(bare.world.watches).toEqual([{ type: 'dead', when: { var: 'hp', lte: 0 } }]);
    expect(bare.world.reactions).toEqual([{ on: 'hit:hero', do: 'inc', var: 'hp', by: -10, min: 0 }]);
  });

  it('seats with no hits counted: each its own hp all the same (a hazard takes it), no hit reactions', () => {
    const W = lowerMechanic('fail-on-death', { startHp: 30 }, { i: 0, player: 'hero', seats: ['hero-2'] }).world;
    expect(W.vars).toEqual({ hp: 30, 'hp:2': 30 });
    expect(W.reactions.filter((r) => r.on.startsWith('hit:'))).toEqual([]);
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

// THE SHARED ZONES WITH SEATS (mechanics.js takers): any seat takes a pickup (once) and the way out; a hazard hurts whoever
// walks in, in its own hp
describe('the level\'s zones answer every seat', () => {
  const sim = (mechanics) => {
    const mech = composeMechanics(mechanics, { player: 'hero', seats: ['hero-2'] });
    return simLevel({ entities: [hero('hero', 0), hero('hero-2', -2)], events: mech.events, world: { seats: { bodies: ['hero-2'] } } });
  };
  const put = (L, at) => { for (const [id, x] of Object.entries(at)) L.world.byId[id].transform.pos = [x, 0, 0]; L.frame(1 / 30); L.frame(1 / 30); };

  it('a coin seat 2 walks into counts, once: walked back over, or both in it on one frame', () => {
    const L = sim([{ kind: 'coins', pickups: [{ at: [5, 0, 0] }, { at: [9, 0, 0] }] }, EXIT]);
    put(L, { 'hero-2': 5 });
    expect(L.bus.vars.coins).toBe(1);
    put(L, { 'hero-2': 0 }); put(L, { 'hero-2': 5 });
    expect(L.bus.vars.coins).toBe(1);
    put(L, { hero: 9, 'hero-2': 9 });
    expect(L.bus.vars.coins).toBe(2);
  });

  it('seat 2 at the way out takes it', () => {
    const L = sim([EXIT]);
    put(L, { 'hero-2': 40 });
    expect(L.bus.log.map((e) => e && e.type)).toContain('goal:reached');
  });

  it('a hazard hurts whoever walks in, in its own hp', () => {
    const L = sim([{ kind: 'hazard-damage', startHp: 30, hazards: [{ at: [5, 0, 0], damage: 10 }] }, { kind: 'fail-on-death', startHp: 30 }, EXIT]);
    put(L, { 'hero-2': 5 });
    expect([L.bus.vars.hp, L.bus.vars['hp:2']]).toEqual([30, 20]);
    put(L, { hero: 5 });
    expect([L.bus.vars.hp, L.bus.vars['hp:2']]).toEqual([20, 20]);
  });
});

describe('a pickup alone, walked back over (11-28)', () => {
  it('counts once: a coin and an item, the one player walking back over them', () => {
    const mech = composeMechanics([{ kind: 'coins', pickups: [{ at: [5, 0, 0] }] }, { kind: 'collect', pickups: [{ item: 'gem', at: [9, 0, 0] }] }, EXIT], { player: 'hero', storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }] } });
    const L = simLevel({ entities: [hero('hero', 0)], events: mech.events });
    const at = (x) => { L.world.byId.hero.transform.pos = [x, 0, 0]; L.frame(1 / 30); L.frame(1 / 30); };
    at(5); at(0); at(5); at(9); at(0); at(9);
    expect(L.bus.vars.coins).toBe(1);
    expect(L.bus.vars['held:bag:gem']).toBe(1);
  });
});
