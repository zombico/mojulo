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
