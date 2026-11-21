// THE WANTED LEVEL (law-mechanics.js lowerWanted), walked on the bus: mayhem raises a star, each star brings its police
// near the player; time clear of trouble takes a star off and sends its police away; police blows bust the player,
// fined and set down at the start.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] }, player: 'hero', spawn: [0, 0, 0] };
const COPS = ['police-1', 'police-2', 'police-3', 'police-4'];
const CARS = ['police-car-1', 'police-car-2'];
const WANT = { kind: 'wanted', police: COPS, cars: CARS, per: 2, stars: 2, calm: 5, busted: 3, fine: 20, back: [1, 2, 0], mayhem: ['encounter:torch'] };
const M = [{ kind: 'bag', slice: 'bag' }, WANT, { kind: 'reach-exit', at: [999, 999, 0] }];

function play(script, { coin = 0 } = {}) {
  const c = composeMechanics(M, ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  if (coin) s.vars['held:bag:coin'] = coin;
  s._ctrlOps = [];
  for (const step of script) {
    if (step.event) pump([{ type: step.event, ...(step.entity ? { entity: step.entity } : {}), ...(step.by ? { by: step.by } : {}) }]);
    if (step.wait) for (let k = 0; k < step.wait; k++) pump(B.tickTimers(s, 1));
  }
  const ops = (s._ctrlOps || []).map((o) => `${o.op}:${o.who}`);
  return { vars: s.vars, log: s.log.map((r) => r.type), ops, near: (s._ctrlOps || []).find((o) => o.op === 'spawn'), moves: s.log.filter((r) => r.type === 'busted') };
}
const jack = { event: 'mayhem:carjack' }, blow = { event: 'hit:hero', by: 'police-1' };

describe('the wanted level', () => {
  it('is quiet until mayhem: no stars, no police', () => {
    const r = play([{ wait: 30 }]);
    expect(r.vars.wanted).toBe(0);
    expect(r.ops.filter((o) => o.startsWith('spawn'))).toHaveLength(0);
  });
  it('mayhem raises a star and brings its police near the player, out of reach', () => {
    const r = play([jack]);
    expect(r.vars.wanted).toBe(1);
    expect(r.ops).toEqual(['spawn:police-1', 'spawn:police-2', 'spawn:police-car-1']);
    expect(r.near).toMatchObject({ near: 'hero', fresh: true });
    expect(r.near.ring[0]).toBeGreaterThan(10);
    // (a police car set down farther off, near the player too)
    expect(play([jack]).vars.wanted).toBe(1);
    // (a second: the next two; never past the most)
    const two = play([jack, { event: 'encounter:torch' }, jack, jack]);
    expect(two.vars.wanted).toBe(2);
    expect(two.ops.filter((o) => o.startsWith('spawn'))).toEqual(['spawn:police-1', 'spawn:police-2', 'spawn:police-car-1', 'spawn:police-3', 'spawn:police-4', 'spawn:police-car-2']);
    // (a police body downed is mayhem too)
    expect(play([jack, { event: 'down', entity: 'police-2' }]).vars.wanted).toBe(2);
  });
  it('time clear of trouble takes a star off and sends its police away; at none, shaken off', () => {
    const r = play([jack, jack, { wait: 5 }]);
    expect(r.vars.wanted).toBe(1);
    expect(r.ops).toContain('vanish:police-3');
    expect(r.ops).toContain('vanish:police-car-2'); expect(r.ops).not.toContain('vanish:police-car-1');
    expect(r.ops).not.toContain('vanish:police-1');
    const gone = play([jack, jack, { wait: 10 }]);
    expect(gone.vars.wanted).toBe(0);
    expect(gone.log).toContain('wanted-lost');
    // (a police blow starts the calm over)
    const held = play([jack, { wait: 4 }, blow, { wait: 4 }]);
    expect(held.vars.wanted).toBe(1);
  });
  it('a police car\'s blows (holding a player who stands) count as an officer\'s', () => {
    const car = { event: 'held:hero', by: 'police-car-1' };
    expect(play([jack, car, car, car]).log).toContain('busted');
  });
  it('police blows bust the player: fined when it holds the coin, set down at the start, wanted no more', () => {
    const r = play([jack, blow, blow, blow], { coin: 50 });
    expect(r.log).toContain('busted');
    expect(r.vars).toMatchObject({ wanted: 0, 'wanted-hits': 0, 'held:bag:coin': 30 });
    expect(r.log).not.toContain('wanted-lost');
    expect(r.log).toContain('fined:wanted');
    // (held none: busted all the same, nothing taken, no fine said)
    const poor = play([jack, blow, blow, blow]);
    expect(poor.log).toContain('busted'); expect(poor.log).not.toContain('fined:wanted');
    expect(r.ops).toContain('vanish:police-1');
    // (out of what it drives first, set down at the start)
    expect(r.ops).toContain('dismount:hero');
    // (blows from anyone else, or while not wanted, are no bust)
    expect(play([blow, blow, blow, blow]).log).not.toContain('busted');
    expect(play([jack, { event: 'hit:hero', by: 'foe-1' }, { event: 'hit:hero', by: 'foe-1' }, { event: 'hit:hero', by: 'foe-1' }]).log).not.toContain('busted');
  });
  it('refuses a malformed one, teaching', () => {
    expect(() => composeMechanics([{ kind: 'wanted', police: [] }, { kind: 'reach-exit', at: [9, 9, 0] }], ctx)).toThrow(/police is the bodies/);
    expect(() => composeMechanics([{ kind: 'wanted', police: COPS, stars: 9 }, { kind: 'reach-exit', at: [9, 9, 0] }], ctx)).toThrow(/stars is the most/);
  });
});
