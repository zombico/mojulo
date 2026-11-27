import { describe, expect, it } from 'vitest';

import { composeMechanics } from './mechanics.js';
import { buildBus } from '../worlds/event-bus.js';

// ── the `sortie` mechanic (game/sortie.js): a mission's goals together, its craft arriving ─────────────────────────────
// Won when every destroy and survive goal is met, in any order; lost when a protected craft goes down; a group brought in
// after a time, or once others are down. On the real bus.

const B = buildBus();
const sortie = (p) => {
  const C = composeMechanics([{ kind: 'sortie', ...p }], { player: 'player', spawn: [0, 0, 0], fall: 'none' }), ev = C.events;
  const S = B.createBusState(ev, ev.entities ?? []), ops = [];
  const pump = (list) => { if (list.length) B.processEvents(S, list); let w = B.watchEvents(S), g = 0; while (w.length && g++ < 16) { B.processEvents(S, w); w = B.watchEvents(S); } B.syncToCtrl(S, [], (o) => ops.push(...o)); };
  pump(ev.initial ?? []);
  const ended = () => { for (const r of S.log) for (const [type, o] of Object.entries(C.on ?? {})) if (r.type === type) return o.end; return null; };
  return { S, ops, ended, down: (id) => pump([{ type: 'down', entity: id }]), enter: (b) => pump([{ type: 'enter', zone: `__srt_0:b:${b}`, entity: 'player' }]), wait: (s) => { for (let t = 0; t < s; t += 0.1) { pump(B.tickTimers(S, 0.1)); pump(B.stepTime(S, 0.1)); } } };
};

describe('the sortie', () => {
  it('is won when every goal is met, in any order; each said as it is met', () => {
    const M = sortie({ goals: [{ destroy: ['a-1', 'a-2'] }, { destroy: ['b-1'] }] });
    M.down('b-1');
    expect(M.S.log.filter((r) => r.type === 'sortie:goal')).toHaveLength(1);
    expect(M.ended()).toBe(null);
    M.down('a-2'); M.down('a-1');
    expect(M.ended()).toBe('success');
  });

  it('is lost when a protected craft goes down; a survive goal is the seconds flown', () => {
    const M = sortie({ goals: [{ protect: ['f-1'] }, { survive: 30 }] });
    M.wait(10);
    expect(M.ended()).toBe(null);
    M.down('f-1');
    expect(M.ended()).toBe('fail');
    const N = sortie({ goals: [{ protect: ['f-1'] }, { survive: 30 }] });
    N.wait(31);
    expect(N.ended()).toBe('success');
  });

  it('brings a group in after its seconds, or once the group before it is down (and its seconds after)', () => {
    const M = sortie({ goals: [{ destroy: ['a-1', 'b-1', 'c-1'] }], arrivals: [{ craft: ['b-1'], after: 5 }, { craft: ['c-1'], down: ['a-1', 'b-1'], after: 2, with: 'jump' }] });
    const spawned = () => M.ops.filter((o) => o.op === 'spawn').map((o) => o.who);
    M.wait(4);
    expect(spawned()).toEqual([]);
    M.wait(1.2);
    expect(spawned()).toEqual(['b-1']);
    M.down('a-1'); M.down('b-1');
    M.wait(1);
    expect(spawned()).toEqual(['b-1']);
    M.wait(1.2);
    expect(spawned()).toEqual(['b-1', 'c-1']);
    expect(M.ops.find((o) => o.who === 'c-1').with).toBe('jump');
    expect(M.S.log.filter((r) => r.type === 'arrival')).toHaveLength(2);
  });

  it('refuses what it cannot lay, teaching', () => {
    expect(() => sortie({ goals: [{ protect: ['f-1'] }] })).toThrow(/at least one destroy or survive/);
    expect(() => sortie({ goals: [{ destroy: [] }] })).toThrow(/the ids of the craft/);
    expect(() => sortie({ goals: [{ destroy: ['a'] }], arrivals: [{ craft: ['b'] }] })).toThrow(/says when/);
    expect(() => sortie({ goals: [{ reach: 'nowhere' }] })).toThrow(/a beacon's id/);
  });

  it('sends the pilot to beacons: a zone each; reached once, while lit; a reach a goal, an arrival, a light', () => {
    const beacons = [
      { id: 'nav', at: [0, 1000, 0], radius: 150, entity: 'beacon-nav' },
      { id: 'jump', at: [500, 2000, 0], radius: 150, entity: 'beacon-jump', lit: { down: ['r-1'] }, say: 'There' },
    ];
    const M = sortie({ beacons, goals: [{ destroy: ['r-1'] }, { reach: 'jump' }], arrivals: [{ craft: ['r-1'], reach: 'nav', after: 2 }] });
    // (a beacon's state on the bus: -1 dark, 0 lit, 1 reached)
    const state = (id) => M.S.vars[`__srt_0_b_${id}`], lit = () => ['nav', 'jump'].filter((id) => state(id) >= 0), reached = () => ['nav', 'jump'].filter((id) => state(id) === 1);
    expect(lit()).toEqual(['nav']);
    // a dark beacon flown into is nothing
    M.enter('jump');
    expect(reached()).toEqual([]);
    // reaching the first brings the raider in, its seconds after
    M.enter('nav');
    expect(reached()).toEqual(['nav']);
    expect(M.ops.filter((o) => o.op === 'spawn').map((o) => o.who)).toEqual(['beacon-nav']);
    M.wait(2.2);
    expect(M.ops.filter((o) => o.op === 'spawn').map((o) => o.who)).toEqual(['beacon-nav', 'r-1']);
    expect(M.ops.filter((o) => o.op === 'vanish').map((o) => o.who)).toEqual(['beacon-nav']);
    // once reached, never again
    M.enter('nav');
    expect(reached()).toEqual(['nav']);
    // its raider down lights the next; reaching it meets the last goal
    M.down('r-1');
    expect(lit()).toEqual(['nav', 'jump']);
    expect(M.ended()).toBe(null);
    M.enter('jump');
    expect(M.ended()).toBe('success');
  });
});
