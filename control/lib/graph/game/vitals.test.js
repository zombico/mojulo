// THE STREET'S HEALTH (vitals-mechanics.js lowerVitals), walked on the bus: blows cost health, quiet mends it, and at
// none the player is WASTED: out of the car, billed when they hold the coin, set down, whole again; the law lets them
// go, and a fight under way is lost with it.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] }, player: 'hero', spawn: [0, 0, 0] };
const VIT = { kind: 'vitals', hp: 100, hit: 25, mend: 10, after: 3, bill: 30, back: [1, 2, 0] };
const WANT = { kind: 'wanted', police: ['police-1', 'police-2'], per: 2, stars: 1, back: [1, 2, 0] };
const FIGHT = { kind: 'act', id: 'torch', faction: 'reds', verb: 'torch', flag: 'took-torch', done: 'done-torch', at: [40, 0, 0], fight: { foes: ['foe-1'], at: [40, 0, 0], wasted: 'wasted' } };

function play(M, script, { coin = 0 } = {}) {
  const c = composeMechanics([{ kind: 'bag', slice: 'bag' }, ...M, { kind: 'reach-exit', at: [999, 999, 0] }], ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  if (coin) s.vars['held:bag:coin'] = coin;
  s._ctrlOps = [];
  for (const step of script) {
    if (step.event) pump([{ type: step.event, ...(step.by ? { by: step.by } : {}), ...(step.entity ? { entity: step.entity } : {}), ...(step.zone ? { zone: step.zone } : {}) }]);
    if (step.wait) for (let k = 0; k < step.wait; k++) pump(B.tickTimers(s, 1));
  }
  return { vars: s.vars, log: s.log.map((r) => r.type), ops: (s._ctrlOps || []).map((o) => `${o.op}:${o.who}`), dismount: (s._ctrlOps || []).find((o) => o.op === 'dismount') };
}
const blow = { event: 'hit:hero', by: 'foe-1' };

describe('the street\'s health', () => {
  it('a blow costs health; quiet a while, it mends, never past whole', () => {
    expect(play([VIT], [blow]).vars.health).toBe(75);
    expect(play([VIT], [blow, { wait: 3 }]).vars.health).toBe(75);
    expect(play([VIT], [blow, { wait: 5 }]).vars.health).toBe(95);
    expect(play([VIT], [blow, { wait: 20 }]).vars.health).toBe(100);
    // (a blow starts the quiet over)
    expect(play([VIT], [blow, { wait: 3 }, blow, { wait: 3 }]).vars.health).toBe(50);
  });
  it('at none, wasted: out of the car, set down, whole again; billed only when they hold the coin', () => {
    const r = play([VIT], [blow, blow, blow, blow], { coin: 50 });
    expect(r.log).toContain('wasted');
    expect(r.vars).toMatchObject({ health: 100, 'held:bag:coin': 20 });
    expect(r.dismount).toMatchObject({ who: 'hero', to: [1, 2, 0] });
    expect(r.log).toContain('billed:health');
    const poor = play([VIT], [blow, blow, blow, blow]);
    expect(poor.log).toContain('wasted'); expect(poor.log).not.toContain('billed:health');
  });
  it('the law lets a wasted player go; a fight under way is lost with it, and keeps no health of its own', () => {
    const r = play([VIT, WANT], [{ event: 'mayhem:carjack' }, blow, blow, blow, blow]);
    expect(r.vars.wanted).toBe(0);
    expect(r.ops).toContain('vanish:police-1');
    const f = play([VIT, FIGHT], [{ event: 'app:take:torch' }, { event: 'enter', zone: 'fight-torch', entity: 'hero' }, blow, blow, blow, blow]);
    expect(f.log).toContain('encounter:torch');
    expect(f.log).toContain('encounter-lost:torch');
    expect(f.vars['fight-hp-torch']).toBeUndefined();
  });
  it('refuses a malformed one, teaching', () => {
    expect(() => composeMechanics([{ kind: 'vitals', hp: 0 }, { kind: 'reach-exit', at: [9, 9, 0] }], ctx)).toThrow(/hp is the player/);
  });
});
