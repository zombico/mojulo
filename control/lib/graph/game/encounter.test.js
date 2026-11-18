// AN ENCOUNTER IN FREE ROAM (errand-mechanics.js lowerAct `fight`), walked on the bus: a faction's posting that is a
// fight wakes its foes only when it is taken and its place come to; their falls are counted and the last is the act
// done, paid once in money and standing; the hero's hits count only while it is fought, and going down puts the foes
// away, the hero back, and lets it be come to again.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { storeSchema: { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'hero', kind: 'character' }] }, player: 'hero', spawn: [0, 0, 0] };
const FOES = ['foe-docker-torch-1', 'foe-docker-torch-2'];
const ACT = { kind: 'act', id: 'torch', faction: 'reds', verb: 'torch', flag: 'took-torch', done: 'done-torch', at: [40, 0, 0], reward: [{ item: 'coin', n: 50 }], standing: 1, name: 'Reds',
  fight: { foes: FOES, at: [40, 0, 0], radius: 8, back: [5, 5, 0] } };
const M = [{ kind: 'bag', slice: 'bag' }, ACT, { kind: 'reach-exit', at: [999, 999, 0] }];

function play(script) {
  const c = composeMechanics(M, ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
  let prev;
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);
  for (const step of script) {
    if (step.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: step.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
    if (step.event) pump([{ type: step.event, ...(step.entity ? { entity: step.entity } : {}) }]);
  }
  return { vars: s.vars, log: s.log.map((r) => r.type), ctrl: s.log.filter((r) => r.type === 'ctrl' || r.op).map((r) => `${r.op}:${r.who}`) };
}
const there = { at: [40, 0, 0] }, away = { at: [200, 0, 0] }, take = { event: 'app:take:torch' }, fall = (k) => ({ event: 'down', entity: FOES[k] });

describe('an encounter in free roam', () => {
  it('sleeps until its posting is taken and its place come to', () => {
    expect(play([there]).vars['fight-on-torch']).toBe(0);
    expect(play([take]).vars['fight-on-torch']).toBe(0);
    const r = play([take, there]);
    expect(r.vars['fight-on-torch']).toBe(1);
    expect(r.log).toContain('encounter:torch');
  });
  it('is won by every one of them down: paid once, in money and standing', () => {
    const one = play([take, there, fall(0)]);
    expect(one.vars['flag-done-torch']).toBe(0); expect(one.vars['fight-fell-torch']).toBe(1);
    const r = play([take, there, fall(0), fall(1), fall(1)]);
    expect(r.vars).toMatchObject({ 'flag-done-torch': 1, 'standing-reds': 1, 'held:bag:coin': 50, 'fight-on-torch': 0 });
    expect(r.log.filter((t) => t === 'act:torch:torch:ok')).toHaveLength(1);
    // (done: coming back wakes no one)
    const again = play([take, there, fall(0), fall(1), away, there]);
    expect(again.log.filter((t) => t === 'encounter:torch')).toHaveLength(1);
  });
  it('the hero\'s hits count only while it is fought; at none they are put away, the hero put back, and it can be come to again', () => {
    expect(play([take, { event: 'hit:hero' }]).vars['fight-hp-torch']).toBe(100);
    const hit = play([take, there, { event: 'hit:hero' }, { event: 'hit:hero' }]);
    expect(hit.vars['fight-hp-torch']).toBe(60);
    const lost = play([take, there, fall(0), ...Array.from({ length: 5 }, () => ({ event: 'hit:hero' }))]);
    expect(lost.log).toContain('encounter-lost:torch');
    expect(lost.vars).toMatchObject({ 'fight-hp-torch': 100, 'fight-fell-torch': 0, 'fight-on-torch': 0, 'flag-done-torch': 0 });
    const back = play([take, there, ...Array.from({ length: 5 }, () => ({ event: 'hit:hero' })), away, there, fall(0), fall(1)]);
    expect(back.log.filter((t) => t === 'encounter:torch')).toHaveLength(2);
    expect(back.vars['flag-done-torch']).toBe(1);
  });
});

describe('a side joined by the player\'s say', () => {
  const JOIN = { kind: 'join', faction: 'reds', at: [20, 0, 0], name: 'The Reds', others: ['dockers'], after: 'done-parcel' };
  const run = (script) => {
    const c = composeMechanics([JOIN, { kind: 'reach-exit', at: [999, 999, 0] }], ctx), ev = c.events, s = B.createBusState(ev, ev.entities);
    let prev;
    const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s), g = 0; while (w.length && g++ < 8) { B.processEvents(s, w); w = B.watchEvents(s); } };
    pump([]);
    for (const step of script) {
      if (step.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: step.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
      if (step.event) pump([{ type: step.event }]);
    }
    return { vars: s.vars, log: s.log.map((r) => r.type) };
  };
  const there = { at: [20, 0, 0] }, away = { at: [200, 0, 0] }, yes = { event: 'join-yes:reds' }, done = { event: 'flag:done-parcel' };
  it('its contact says nothing before the first job is done; walking up never joins; only the key, said there, does', () => {
    expect(run([there, yes]).vars['flag-in-reds']).toBe(0);
    const asked = run([done, there]);
    expect(asked.log).toContain('join-open:reds'); expect(asked.log).toContain('join-ask:reds');
    expect(asked.vars['flag-in-reds']).toBe(0);
    expect(run([done, there, away, yes]).vars['flag-in-reds']).toBe(0);
    expect(run([done, there, yes]).vars['flag-in-reds']).toBe(1);
  });
});
