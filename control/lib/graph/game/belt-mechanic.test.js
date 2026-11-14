// The belt (belt-mechanic.js): a beat 'em up's level on the bus. The laws: a screen holds the player between its marks
// until its waves are down; the hold then opens as far as the next screen's end and says GO; the next screen begins
// only when the player walks into it, once; the last screen's clear wins; a death begins the screen again (its foes
// put away, its counts zeroed, hp full, the player put at its start), or loses with `death: 'fail'`; a malformed one
// says so.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { beltWaves } from './belt-mechanic.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { player: 'hero', spawn: [0, 1, 0], fall: 'none' };
const STREET = {
  kind: 'belt', id: 'street',
  screens: [
    { from: 0, to: 16, waves: [{ foes: [{ id: 'a1', at: [0, 12, 0] }, { id: 'a2', at: [1, 14, 0] }] }, { foes: [{ id: 'a3', at: [0, 15, 0] }] }] },
    { from: 16, to: 32, waves: [{ foes: [{ id: 'b1', at: [0, 28, 0] }] }] },
  ],
};

function run(mechs, script) {
  const c = composeMechanics(mechs, ctx), ev = c.events, s = B.createBusState(ev, ev.entities), ops = [], warps = [];
  let prev;
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } if (s._ctrlOps) { ops.push(...s._ctrlOps); s._ctrlOps = []; } if (s._ctrlWarps) { if (s._ctrlWarps.hero) warps.push(s._ctrlWarps.hero); s._ctrlWarps = null; } };
  pump(ev.initial ?? []);
  for (const st of script) {
    if (st.down) pump(st.down.map((id) => ({ type: 'down', entity: id })));
    if (st.hit) for (let k = 0; k < st.hit; k++) pump([{ type: 'hit:hero' }]);
    if (st.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: st.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
    if (st.secs) for (let k = 0; k < Math.round(st.secs * 10); k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); }
  }
  const of = (op) => ops.filter((o) => o.op === op);
  return { c, s, log: s.log.map((r) => r.type), spawned: of('spawn').map((o) => o.who), vanished: of('vanish').map((o) => o.who), holds: of('hold').map((o) => [o.lo ?? null, o.hi ?? null]), warps, ended: s.ended ?? null };
}
const CLEAR_ONE = [{ secs: 1.5 }, { down: ['a1', 'a2'] }, { secs: 2.5 }, { down: ['a3'] }, { secs: 0.2 }];

describe('a belt on the bus', () => {
  it('composes without an error, and its waves read in order', () => {
    expect(composeMechanics([STREET], ctx).errors ?? []).toEqual([]);
    expect(beltWaves(STREET).map((w) => `${w.screen}.${w.wave}`)).toEqual(['0.0', '0.1', '1.0']);
  });
  it('holds the first screen at once, and wakes each wave only once the one before is all down', () => {
    const r = run([STREET], [{ secs: 1.5 }, { down: ['a1'] }, { secs: 5 }]);
    expect(r.holds).toEqual([[0, 16]]);
    expect(r.spawned).toEqual(['a1', 'a2']);
    expect(run([STREET], [{ secs: 1.5 }, { down: ['a1', 'a2'] }, { secs: 2.5 }]).spawned).toEqual(['a1', 'a2', 'a3']);
  });
  it('a screen cleared: the hold opens as far as the next screen\'s end, and says GO; nothing of the next wakes yet', () => {
    const r = run([STREET], [...CLEAR_ONE, { secs: 5 }]);
    expect(r.holds).toEqual([[0, 16], [0, 32]]);
    expect(r.log).toContain('belt:go');
    expect(r.spawned).not.toContain('b1');
    expect(r.s.vars.belt_left).toBe(0);
  });
  it('the next screen begins when the player walks into it, once: held between its own marks', () => {
    const r = run([STREET], [...CLEAR_ONE, { at: [0, 20, 0] }, { secs: 1.5 }, { at: [0, 15, 0] }, { at: [0, 20, 0] }, { secs: 2 }]);
    expect(r.holds).toEqual([[0, 16], [0, 32], [16, 32]]);
    expect(r.spawned.filter((x) => x === 'b1')).toHaveLength(1);
    expect(r.s.vars.belt_screen).toBe(2);
  });
  it('walking into a screen not yet opened does nothing (the hold is what stops it; the bus does not begin it)', () => {
    expect(run([STREET], [{ secs: 1.5 }, { at: [0, 20, 0] }, { secs: 2 }]).spawned).toEqual(['a1', 'a2']);
  });
  it('the last screen\'s clear wins and lets go', () => {
    const r = run([STREET], [...CLEAR_ONE, { at: [0, 20, 0] }, { secs: 1.5 }, { down: ['b1'] }, { secs: 0.2 }]);
    expect(r.log).toContain('belt:won');
    expect(r.holds[r.holds.length - 1]).toEqual([null, null]);
  });
  it('a death begins the screen again: its foes put away, hp full, the player at its start, its first wave after a pause', () => {
    const r = run([STREET], [{ secs: 1.5 }, { down: ['a1'] }, { hit: 5 }, { secs: 2.5 }]);
    expect(r.vanished).toEqual(['a1', 'a2', 'a3']);
    expect(r.s.vars.hp).toBe(100);
    expect(r.log).toContain('belt:again');
    expect(r.spawned).toEqual(['a1', 'a2', 'a1', 'a2']);
    expect(r.holds[r.holds.length - 1]).toEqual([0, 16]);
  });
  it('a malformed one says so', () => {
    const bad = (p) => () => composeMechanics([{ ...STREET, ...p }], ctx);
    const err = (p) => { try { const c = bad(p)(); return (c.errors ?? []).join(' '); } catch (e) { return e.message; } };
    expect(err({ screens: [] })).toMatch(/screens/);
    expect(err({ screens: [STREET.screens[0], { ...STREET.screens[1], from: 20 }] })).toMatch(/follow one another/);
    expect(err({ screens: [{ from: 0, to: 16, waves: [{ foes: [{ id: 'a1' }] }, { foes: [{ id: 'a1' }] }] }] })).toMatch(/two waves/);
    expect(err({ death: 'arena' })).toMatch(/death/);
  });
});
