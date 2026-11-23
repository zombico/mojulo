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
  return { S, ops, ended, down: (id) => pump([{ type: 'down', entity: id }]), wait: (s) => { for (let t = 0; t < s; t += 0.1) { pump(B.tickTimers(S, 0.1)); pump(B.stepTime(S, 0.1)); } } };
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
  });
});
