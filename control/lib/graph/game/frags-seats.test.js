// FRAGS WITH SEATS (mechanics.js frags, a level's seats): every seat a contender as the player is, its own hp, its fall,
// its frags in its corner. Co-op, the seats are one side against the bots (a seat's hit on another counts for nothing);
// versus and free-for-all, each against each; the first to the limit wins the match, named. No seats: as it was.
import { describe, expect, it } from 'vitest';

import { composeMechanics, lowerMechanic } from './mechanics.js';
import { simLevel } from './level-sim.js';

const SPAWNS = [[24, 0, 0], [12, 16, 0], [12, -16, 0], [30, 10, 0]];
const FRAGS = { kind: 'frags', rivals: ['bot-1'], frags: 2, spawns: SPAWNS, respawn: 1, hits: 50 };
const body = (id, x, extra = {}) => ({ id, transform: { pos: [x, 0, 0], heading: 0 }, body: { type: 'none', hittable: true }, ...extra });
const pilot = (id, x) => body(id, x, { pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, ambient: { type: 'static' } });
const bot = (id, x) => body(id, x, { rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 100 } });

function match(contest) {
  const mech = composeMechanics([FRAGS], { player: 'hero', seats: ['hero-2'], ...(contest ? { seatContest: contest } : {}) });
  const L = simLevel({ entities: [pilot('hero', 0), pilot('hero-2', 4), bot('bot-1', 10)], events: mech.events, world: { seats: { bodies: ['hero-2'], downs: 'level' } } });
  L.input.seats = { 2: {} };
  return L;
}
// a hit on `who` by `by`, as the cast says one (hit:<id>, by)
const hit = (L, who, by, n = 1) => { for (let k = 0; k < n; k++) L.frame(1 / 30, [{ type: `hit:${who}`, entity: who, by }]); };
const said = (L, type) => L.bus.log.filter((e) => e && e.type === type);

describe('frags\' lowering with seats', () => {
  it('no seats: the player and its rivals alone, as it was', () => {
    const W = lowerMechanic('frags', FRAGS, { i: 0, player: 'hero' }).world;
    expect(Object.keys(W.vars).filter((k) => k.startsWith('hp'))).toEqual(['hp']);
    expect(W.hud.some((r) => /P2/.test(r.label))).toBe(false);
  });

  it('seats: each its own hp and frags, in its corner and colour', () => {
    const W = lowerMechanic('frags', FRAGS, { i: 0, player: 'hero', seats: ['hero-2'] }).world;
    expect(W.vars['hp:2']).toBe(100);
    expect(W.hud.find((r) => r.label === 'P2 frags')).toMatchObject({ var: '__frag_0_hero-2', slot: 'bottom-right', color: '#3b7be5' });
  });
});

describe('a match with seats, played on the bus', () => {
  it('co-op: a seat\'s hit on the player counts for nothing; its frag on a bot is its own', () => {
    const L = match();
    hit(L, 'hero', 'hero-2', 2);
    expect(L.bus.vars.hp).toBe(0);                       // the hits land (friendly fire is the runtime's to stop)
    expect(said(L, 'kill')).toEqual([]);                 // but the fall is nobody's frag
    hit(L, 'bot-1', 'hero-2');
    L.world.byId['bot-1'].downed = true; L.frame(1 / 30);
    expect(L.bus.vars['__frag_0_hero-2']).toBe(1);
    expect(said(L, 'kill')).toHaveLength(1);
    expect(L.bus.vars.__frag_0_hero).toBe(0);
  });

  it('free-for-all: seat against seat; the first to the limit wins, named', () => {
    const L = match('free-for-all');
    for (let r = 0; r < 2; r++) {
      hit(L, 'hero', 'hero-2', 2);                       // two hits of 50: the player falls to seat 2
      L.run(1.5);                                        // and rises after its second
    }
    expect(L.bus.vars['__frag_0_hero-2']).toBe(2);
    expect(said(L, 'frags:won')).toHaveLength(1);
    expect(L.bus.vars.__winner_0).toBe(2);
    expect(said(L, 'frags:lost')).toEqual([]);
  });

  it('a seat hit to nothing falls, is felled, and rises with its hp whole', () => {
    const L = match('versus');
    hit(L, 'hero-2', 'hero', 2);
    L.frame(1 / 30);
    expect(L.world.byId['hero-2'].downed).toBe(true);
    L.run(1.5);
    expect(L.bus.vars['hp:2']).toBe(100);
    expect(L.world.byId['hero-2'].downed).toBe(false);
  });
});

// A MATCH OF TWO SIDES (a team deathmatch's red and blue): its sides name the player 'player' where its pilot is a hero
// (the word is the level's player); seats against each other split across them, the odd on the player's side
describe('a match of two sides with seats', () => {
  const SIDED = { kind: 'frags', rivals: ['bot-1', 'bot-2'], frags: 2, teams: { red: ['player', 'bot-2'], blue: ['bot-1'] }, spawns: { red: [[0, 0, 0]], blue: [[20, 0, 0]] }, respawn: 1, hits: 50 };
  it('the sides\' "player" is the level\'s pilot, a hero', () => {
    expect(() => composeMechanics([SIDED], { player: 'hero' })).not.toThrow();
    expect(() => composeMechanics([{ ...SIDED, teams: { red: ['ghost', 'bot-2'], blue: ['bot-1'] } }], { player: 'hero' })).toThrow(/teams are two sides/);
  });

  it('teams: seat 2 on the other side; its frags count for that side, and that side\'s win is said as the couch\'s, side 2', () => {
    const mech = composeMechanics([SIDED], { player: 'hero', seats: ['hero-2'], seatContest: 'teams' });
    const L = simLevel({ entities: [pilot('hero', 0), pilot('hero-2', 4), bot('bot-1', 10), bot('bot-2', 12)], events: mech.events, world: { seats: { bodies: ['hero-2'], downs: 'level' } } });
    L.input.seats = { 2: {} };
    for (let r = 0; r < 2; r++) { hit(L, 'hero', 'hero-2', 2); L.run(1.5); }
    expect(L.bus.vars['__frag_0_hero-2']).toBe(2);
    expect(L.bus.vars.__team_0_blue).toBe(2);
    expect(said(L, 'frags:won')).toHaveLength(1);
    expect(L.bus.vars.__winner_0).toBe(2);
  });

  it('co-op: every seat on the player\'s side', () => {
    const mech = composeMechanics([SIDED], { player: 'hero', seats: ['hero-2'] });
    const L = simLevel({ entities: [pilot('hero', 0), pilot('hero-2', 4), bot('bot-1', 10), bot('bot-2', 12)], events: mech.events, world: { seats: { bodies: ['hero-2'], downs: 'level' } } });
    hit(L, 'hero', 'hero-2', 2);
    L.frame(1 / 30);
    expect(L.bus.vars.__team_0_blue).toBe(0);
    expect(L.bus.vars.__team_0_red).toBe(0);
  });
});

// SUPPLIES WITH SEATS (11-28): seats 2 to 4 take a drop as the player does, health their own hp, the drop taken once
describe('supplies with seats', () => {
  it('seat 2 walks onto health: its own hp mended, the drop gone for the player', () => {
    const mech = composeMechanics([FRAGS, { kind: 'supplies', max: 100, drops: [{ at: [4, 0, 0], gives: 'health', amount: 30 }] }], { player: 'hero', seats: ['hero-2'], seatContest: 'free-for-all' });
    const L = simLevel({ entities: [pilot('hero', 0), pilot('hero-2', 8), bot('bot-1', 20)], events: mech.events, world: { seats: { bodies: ['hero-2'], downs: 'level' } } });
    L.input.seats = { 2: {} };
    hit(L, 'hero-2', 'hero', 1);
    expect(L.bus.vars['hp:2']).toBe(50);
    const put = (id, x) => { L.world.byId[id].transform.pos = [x, 0, 0]; L.frame(1 / 30); L.frame(1 / 30); };
    put('hero-2', 4);
    expect(L.bus.vars['hp:2']).toBe(80);
    put('hero-2', 8); put('hero', 4);
    expect(L.bus.vars.hp).toBe(100);
    expect(said(L, 'supply:health')).toHaveLength(1);
  });
});

// CONTROL WITH SEATS (11-28): seats on their sides on the point, a side a seat holds the couch's win
describe('control with seats', () => {
  const POINT = { kind: 'control', teams: { red: ['player', 'bot-2'], blue: ['bot-1'] }, at: [10, 0, 0], radius: 3, hold: 5 };
  const L0 = (contest) => {
    const mech = composeMechanics([POINT], { player: 'hero', seats: ['hero-2'], ...(contest ? { seatContest: contest } : {}) });
    const L = simLevel({ entities: [pilot('hero', 0), pilot('hero-2', 30), bot('bot-1', 40), bot('bot-2', 50)], events: mech.events, world: { seats: { bodies: ['hero-2'], downs: 'level' } } });
    L.input.seats = { 2: {} };
    return L;
  };
  it('co-op: seat 2 alone on the point holds it for the player\'s side; held, won', () => {
    const L = L0();
    L.world.byId['hero-2'].transform.pos = [10, 0, 0];
    L.run(6);
    expect(said(L, 'control:won')).toHaveLength(1);
  });
  it('teams: seat 2 on the other side; held by it, won for the couch, side 2', () => {
    const L = L0('teams');
    L.world.byId['hero-2'].transform.pos = [10, 0, 0];
    L.run(6);
    expect(said(L, 'control:won')).toHaveLength(1);
    expect(L.bus.vars.__cp_winner_0).toBe(2);
  });
});
