// The wave gauntlet (wave-gauntlet.js): arenas × waves, sealed until nothing is left alive. The laws: a wave's foes are
// woken only once the wave before is all down, arena after arena; the way out stays sealed (and turns the walker back)
// until the last wave is down, then wins; without a way out the clear wins at once; death begins the arena again (its
// foes put away, its counts zeroed, hp full), or the checkpoint's; `death: 'fail'` loses instead; a malformed one says so.
import { describe, it, expect } from 'vitest';
import { composeMechanics } from './mechanics.js';
import { gauntletWaves } from './wave-gauntlet.js';
import { buildBus } from '../worlds/event-bus.js';

const B = buildBus();
const ctx = { player: 'hero', spawn: [0, 0, 0], fall: 'none' };
const LIFT = {
  kind: 'wave-gauntlet', id: 'lift',
  arenas: [{ waves: [{ foes: ['g1', 'g2'] }, { foes: ['g3'] }] }, { waves: [{ foes: ['b1', 'b2'] }] }],
  at: [12, 0, 0], back: [8, 0, 0], start: [0, 0, 0],
};

// a bus stepped in time: events, then seconds of timers and sequences; the walker's zones; the cast's ops it asked for
function run(mechs, script) {
  const c = composeMechanics(mechs, ctx), ev = c.events, s = B.createBusState(ev, ev.entities), ops = [], warps = [];
  let prev;
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } if (s._ctrlOps) { ops.push(...s._ctrlOps); s._ctrlOps = []; } if (s._ctrlWarps) { warps.push(s._ctrlWarps.hero); s._ctrlWarps = null; } };
  pump(ev.initial ?? []);
  for (const st of script) {
    if (st.down) pump(st.down.map((id) => ({ type: 'down', entity: id })));
    if (st.hit) for (let k = 0; k < st.hit; k++) pump([{ type: 'hit:hero' }]);
    if (st.at) for (let f = 0; f < 2; f++) { const z = B.deriveZoneEvents([{ id: 'hero', position: st.at }], prev, ev.sources); prev = z.prev; pump(z.events); }
    if (st.secs) for (let k = 0; k < Math.round(st.secs * 10); k++) { pump(B.tickTimers(s, 0.1)); pump(B.stepTime(s, 0.1)); }
  }
  const spawned = ops.filter((o) => o.op === 'spawn').map((o) => o.who), vanished = ops.filter((o) => o.op === 'vanish').map((o) => o.who);
  return { c, s, log: s.log.map((r) => r.type), spawned, vanished, warps };
}

describe('a wave gauntlet on the bus', () => {
  it('wakes each wave only once the one before is all down, arena after arena', () => {
    expect(gauntletWaves(LIFT).map((w) => `${w.arena}.${w.wave}`)).toEqual(['0.0', '0.1', '1.0']);
    const r = run([LIFT], [{ secs: 1.5 }, { down: ['g1'] }, { secs: 5 }]);
    expect(r.spawned).toEqual(['g1', 'g2']);   // one of two down: the next wave waits
    const r2 = run([LIFT], [{ secs: 1.5 }, { down: ['g1', 'g2'] }, { secs: 2.5 }, { down: ['g3'] }, { secs: 1 }]);
    expect(r2.spawned).toEqual(['g1', 'g2', 'g3']);   // an arena's first waits its arena's breath (4 s)
    expect(r2.log).toContain('gauntlet:arena');
    const r3 = run([LIFT], [{ secs: 1.5 }, { down: ['g1', 'g2'] }, { secs: 2.5 }, { down: ['g3'] }, { secs: 4.5 }]);
    expect(r3.spawned).toEqual(['g1', 'g2', 'g3', 'b1', 'b2']);
    expect(r3.s.vars.__wg_lift_arena).toBe(1);
  });

  it('keeps the way out sealed until the last wave is down, then lets the walker out', () => {
    const shut = run([LIFT], [{ secs: 1.5 }, { at: [12, 0, 0] }]);
    expect(shut.log).toContain('gauntlet:sealed:lift');
    expect(shut.warps).toEqual([[8, 0, 0]]);
    const won = run([LIFT], [{ secs: 1.5 }, { down: ['g1', 'g2'] }, { secs: 2.5 }, { down: ['g3'] }, { secs: 4.5 }, { down: ['b1', 'b2'] }, { at: [12, 0, 0] }]);
    expect(won.log).toEqual(expect.arrayContaining(['gauntlet:clear:lift', 'gauntlet:out:lift']));
    expect(won.s.byId['lift-seal'].on).toBe(false);
    expect(won.c.on).toEqual({ 'gauntlet:out:lift': { end: 'success' } });
  });

  it('without a way out (the elevator), the last wave down wins at once', () => {
    const { at: _a, back: _b, ...lift } = LIFT;
    const c = composeMechanics([lift], ctx);
    expect(c.on).toEqual({ 'gauntlet:clear:lift': { end: 'success' } });
    expect(c.events.entities).toBeUndefined();
  });

  it('death begins the arena again: its foes put away, its counts zeroed, hp full, the walker at its start', () => {
    // in arena 2: five hits of 20 and it begins again, arena 1 kept
    const r = run([LIFT], [{ secs: 1.5 }, { down: ['g1', 'g2'] }, { secs: 2.5 }, { down: ['g3'] }, { secs: 4.5 }, { down: ['b1'] }, { hit: 5 }, { secs: 2.5 }]);
    expect(r.vanished).toEqual(['b1', 'b2']);
    expect(r.s.vars.hp).toBe(100);
    expect(r.s.vars.__wg_lift_d2).toBe(0);
    expect(r.warps).toEqual([[0, 0, 0]]);
    expect(r.log).toContain('gauntlet:again');
    expect(r.spawned.filter((x) => x === 'b1')).toHaveLength(2);
    expect(r.spawned).not.toContain(undefined);
    expect(r.spawned.filter((x) => x === 'g1')).toHaveLength(1);
    // with a checkpoint every two arenas, a death in the second goes back to the first
    const cp = run([{ ...LIFT, checkpoint: 2 }], [{ secs: 1.5 }, { down: ['g1', 'g2'] }, { secs: 2.5 }, { down: ['g3'] }, { secs: 4.5 }, { hit: 5 }, { secs: 2.5 }]);
    expect(cp.vanished).toEqual(['g1', 'g2', 'g3', 'b1', 'b2']);
    expect(cp.spawned.filter((x) => x === 'g1')).toHaveLength(2);
  });

  it('a death in the pause after a clear wakes no wave of the next: the arena begins again alone', () => {
    const r = run([LIFT], [{ secs: 1.5 }, { down: ['g1', 'g2'] }, { secs: 0.5 }, { hit: 5 }, { secs: 3 }]);
    expect(r.spawned).toEqual(['g1', 'g2', 'g1', 'g2']);
  });

  it("death: 'fail' loses the level instead", () => {
    expect(composeMechanics([{ ...LIFT, death: 'fail' }], ctx).on).toMatchObject({ '__wg_lift:fell': { end: 'fail' } });
  });

  it('says what is wrong with a malformed gauntlet', () => {
    const bad = (m, re) => expect(() => composeMechanics([{ ...LIFT, ...m }], ctx)).toThrow(re);
    bad({ arenas: [] }, /needs arenas/);
    bad({ arenas: [{ waves: [] }] }, /arenas\[0\] needs waves/);
    bad({ arenas: [{ waves: [{ foes: [] }] }] }, /foes is/);
    bad({ arenas: [{ waves: [{ foes: ['g1'] }, { foes: ['g1'] }] }] }, /stands in two waves/);
    bad({ checkpoint: 0 }, /checkpoint is/);
    bad({ death: 'retry' }, /death is/);
    bad({ id: 'Lift' }, /id is/);
  });
});

describe('a wave gauntlet to endure', () => {
  const HOLD = { kind: 'wave-gauntlet', id: 'hold', arenas: [{ waves: [{ foes: ['z1', 'z2'] }, { foes: ['z3'] }, { foes: ['z4', 'z5'] }] }], pace: 'timed', every: 10 };
  it('timed: each wave on the clock, whatever still stands; cleared when every foe of every wave is down', () => {
    const r = run([HOLD], [{ secs: 1.5 }, { secs: 10 }, { secs: 10 }]);
    expect(r.spawned).toEqual(['z1', 'z2', 'z3', 'z4', 'z5']);   // none downed, all came
    expect(r.log).not.toContain('gauntlet:clear:hold');
    const all = run([HOLD], [{ secs: 1.5 }, { down: ['z1', 'z2'] }, { secs: 10 }, { down: ['z3'] }, { secs: 10 }, { down: ['z4', 'z5'] }]);
    expect(all.log).toContain('gauntlet:clear:hold');
    expect(composeMechanics([HOLD], ctx).on).toMatchObject({ 'gauntlet:clear:hold': { end: 'success' }, '__wg_hold:fell': { end: 'fail' } });
  });

  it('outlast: still standing when the clock runs out wins, whatever still stands; the seal lifts then', () => {
    const O = { ...HOLD, win: { outlast: 25 }, at: [12, 0, 0] };
    const early = run([O], [{ secs: 20 }, { at: [12, 0, 0] }]);
    expect(early.log).toContain('gauntlet:sealed:hold');
    const late = run([O], [{ secs: 26 }, { at: [12, 0, 0] }]);
    expect(late.log).toEqual(expect.arrayContaining(['gauntlet:outlasted:hold', 'gauntlet:out:hold']));
    expect(late.s.vars.__wg_hold_left).toBe(0);
    expect(composeMechanics([{ ...HOLD, win: { outlast: 25 } }], ctx).on).toMatchObject({ 'gauntlet:outlasted:hold': { end: 'success' } });
  });

  it('hold: the thing that must not fall loses the level when it does', () => {
    const c = composeMechanics([{ ...HOLD, hold: 'generator' }], ctx);
    expect(c.on['gauntlet:fallen:hold']).toEqual({ end: 'fail' });
    const r = run([{ ...HOLD, hold: 'generator' }], [{ secs: 1.5 }, { down: ['generator'] }]);
    expect(r.log).toContain('gauntlet:fallen:hold');
  });

  it('endurance fails on death by default, and a timed one refuses to begin an arena again', () => {
    expect(() => composeMechanics([{ ...HOLD, death: 'arena' }], ctx)).toThrow(/timed gauntlet's waves keep coming/);
    expect(() => composeMechanics([{ ...HOLD, pace: 'slow' }], ctx)).toThrow(/pace is/);
    expect(() => composeMechanics([{ ...HOLD, win: { outlast: 0 } }], ctx)).toThrow(/win is/);
    expect(() => composeMechanics([{ ...HOLD, hold: '' }], ctx)).toThrow(/hold is/);
    // a clear-paced one keeps its arena reset unless told
    const { pace: _p, every: _e, ...cleared } = HOLD;
    expect(composeMechanics([cleared], ctx).on['__wg_hold:fell']).toBeUndefined();
  });
});
