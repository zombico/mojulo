// MASH (mechanics.js mash, docs/local-multiplayer-principles.md principle 12): a contest read over a window of every
// seat's presses, a pure function of them: for `seconds` each seat's presses (the page's `press:<n>`, its jump or A,
// a fresh press each) are counted; at the horn the most wins, a tie for the most a draw. No physics, no camera.
import { describe, expect, it } from 'vitest';

import { composeMechanics, lowerMechanic } from './mechanics.js';
import { simLevel } from './level-sim.js';

const pilot = (id, x) => ({ id, pilotable: true, rule: { type: 'walk', speed: 0, eye: 0 }, ambient: { type: 'static' }, body: { type: 'none', hittable: true }, transform: { pos: [x, 0, 0], heading: 0 } });
const round = (mash, seats = ['hero-2', 'hero-3']) => {
  const mech = composeMechanics([{ kind: 'mash', ...mash }], { player: 'hero', seats });
  return simLevel({ entities: [pilot('hero', 0), ...seats.map((id, k) => pilot(id, k + 1))], events: mech.events });
};
const press = (L, counts) => {
  // the frames of the window, each seat pressing its share of them
  const most = Math.max(...Object.values(counts));
  for (let f = 0; f < most; f++) L.frame(1 / 30, Object.entries(counts).filter(([, c]) => f < c).map(([n]) => ({ type: `press:${n}` })));
};
const said = (L, type) => L.bus.log.filter((e) => e && e.type === type).length;

describe('mash, lowered', () => {
  it('without seats it is the player\'s alone: one count, against the clock or to break free', () => {
    const W = lowerMechanic('mash', { seconds: 5, to: 20 }, { i: 0, player: 'hero' }).world;
    expect(Object.keys(W.vars).filter((k) => k.startsWith('presses:'))).toEqual(['presses:1']);
  });

  it('a count a seat in its corner and colour, the window\'s clock, the winner kept; it listens for each seat\'s presses', () => {
    const low = lowerMechanic('mash', { seconds: 5 }, { i: 0, player: 'hero', seats: ['hero-2'] });
    expect(low.world.vars).toMatchObject({ 'presses:1': 0, 'presses:2': 0 });
    expect(low.world.hud.find((r) => r.var === 'presses:2')).toMatchObject({ label: 'P2', slot: 'bottom-right', color: '#3b7be5' });
    expect(low.world.reactions.map((r) => r.on)).toEqual(expect.arrayContaining(['press:1', 'press:2']));
  });
});

describe('a mash, played on the bus', () => {
  it('the most presses in the window wins, named; presses after the horn count for nothing', () => {
    const L = round({ seconds: 2 });
    press(L, { 1: 6, 2: 11, 3: 4 });
    L.run(2.5);
    expect(said(L, 'mash:end')).toBe(1);
    expect(L.bus.vars.__mash_winner_0).toBe(2);
    press(L, { 1: 20 });
    expect(L.bus.vars['presses:1']).toBe(6);
  });

  it('a tie for the most is a draw (no winner)', () => {
    const L = round({ seconds: 2 });
    press(L, { 1: 7, 2: 7, 3: 2 });
    L.run(2.5);
    expect(L.bus.vars.__mash_winner_0).toBe(0);
  });

  it('a race to a count (`to`): the first to it wins, the window closed at once', () => {
    const L = round({ seconds: 10, to: 5 }, ['hero-2']);
    press(L, { 1: 3, 2: 5 });
    expect(said(L, 'mash:end')).toBe(1);
    expect(L.bus.vars.__mash_winner_0).toBe(2);
  });

  it('the same presses, the same result (inputs are the record)', () => {
    const a = round({ seconds: 2 }), b = round({ seconds: 2 });
    for (const L of [a, b]) { press(L, { 1: 9, 2: 3, 3: 8 }); L.run(2.5); }
    expect([a.bus.vars.__mash_winner_0, a.bus.vars['presses:3']]).toEqual([b.bus.vars.__mash_winner_0, b.bus.vars['presses:3']]);
  });
});
