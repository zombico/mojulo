import { describe, expect, it } from 'vitest';

import { createBusState, processEvents, stepTime, hashState } from './event-bus.js';

// ── HARNESS CONTRACT (event-bus.plan.md → "Harness contract") ──────────────────────────────────
// The bus's value is invisible until many events fire at scale and nothing breaks. These seven
// assertions turn that invisible property into a checkable one — each closes a scale-only bug.

const hasNaN = (v) => Array.isArray(v) ? v.some(hasNaN) : (typeof v === 'number' && !Number.isFinite(v));

// A tiny billiards rule-set: a pocket is just a region; potting is just contact(ball, pocket).
// Nothing here is physics — these are synthetic facts fed straight to the reducer (the test seam).
const TABLE = {
  reactions: [
    { on: 'contact', match: { b: 'pocket-*' }, do: 'emit', type: 'potted', ball: 'event.a' },
    { on: 'potted', do: 'toggle', target: 'event.ball' }, // remove from play (.on flips true→false)
  ],
};
const balls = (n) => Array.from({ length: n }, (_, i) => ({ id: `ball-${i + 1}`, on: true }));
const pot = (ball, pocket) => ({ type: 'contact', a: ball, b: pocket });

describe('1. replay-equality (the deterministic loop)', () => {
  it('same event script run twice ⇒ byte-identical state', () => {
    const script = [pot('ball-1', 'pocket-tl'), pot('ball-2', 'pocket-tr'), pot('ball-3', 'pocket-bl')];
    const run = () => hashState(processEvents(createBusState(TABLE, balls(3)), script));
    expect(run()).toBe(run());
  });
});

describe('2. order-invariance (the #1 break bug)', () => {
  it('same event SET, shuffled emit order ⇒ identical state', () => {
    const set = [pot('ball-1', 'pocket-tl'), pot('ball-2', 'pocket-tr'), pot('ball-3', 'pocket-bl')];
    const forward = hashState(processEvents(createBusState(TABLE, balls(3)), set.slice()));
    const reversed = hashState(processEvents(createBusState(TABLE, balls(3)), set.slice().reverse()));
    expect(forward).toBe(reversed);
  });
});

describe('3. no-explosion under storm', () => {
  it('a high-rate event burst: never throws, no NaN, depth + budget respected', () => {
    // index-derived pseudo-randomness (no Date/Math.random — those break determinism).
    const storm = Array.from({ length: 600 }, (_, i) => pot(`ball-${(i % 9) + 1}`, `pocket-${(i * 7) % 6}`));
    const state = createBusState({ ...TABLE, budget: 5000, depthCap: 8 }, balls(9));
    expect(() => processEvents(state, storm)).not.toThrow();
    expect(state.metrics.maxDepth).toBeLessThanOrEqual(state.config.depthCap);
    expect(state.metrics.processed).toBeLessThanOrEqual(state.config.budget);
    expect(state.entities.some((e) => hasNaN(e.position) || hasNaN(e.velocity))).toBe(false);
  });

  it('two pots in one tick record TWO potted events (no silent drop)', () => {
    const state = processEvents(createBusState(TABLE, balls(2)), [pot('ball-1', 'pocket-tl'), pot('ball-2', 'pocket-tr')]);
    expect(state.log.filter((r) => r.type === 'potted')).toHaveLength(2);
  });
});

describe('4. caps are LOUD (no silent swallow)', () => {
  it('a self-emitting cascade trips the depth cap, counted + logged, and terminates', () => {
    const cfg = { reactions: [{ on: 'boom', do: 'emit', type: 'boom' }], depthCap: 6 };
    const state = createBusState(cfg, []);
    expect(() => processEvents(state, [{ type: 'boom' }])).not.toThrow(); // must terminate, not hang
    expect(state.metrics.capTrips).toBeGreaterThan(0);
    expect(state.metrics.dropped).toBeGreaterThan(0);
    expect(state.log.some((r) => r.op === 'cap' && r.reason === 'depth')).toBe(true);
  });

  it('a tight per-tick budget drops the overflow loudly', () => {
    const state = createBusState({ ...TABLE, budget: 2 }, balls(4));
    processEvents(state, [pot('ball-1', 'pocket-tl'), pot('ball-2', 'pocket-tr'), pot('ball-3', 'pocket-bl'), pot('ball-4', 'pocket-br')]);
    expect(state.metrics.processed).toBe(2);
    expect(state.metrics.dropped).toBeGreaterThan(0);
    expect(state.log.some((r) => r.op === 'cap' && r.reason === 'budget')).toBe(true);
  });
});

// A sequence (saga): one independent timeline per resolved scope key. "Doesn't block anything but
// its own parties" must fall out of the key — east and west advance with zero coordination.
const GATES = {
  sequences: [{
    id: 'open-gate',
    scope: 'event.region',
    trigger: { on: 'enter', region: 'gate-*' },
    steps: [
      { do: 'toggle', target: 'event.region' },                 // open this gate
      { await: { on: 'cleared', region: 'event.region' } },      // block THIS scope only
      { do: 'emit', type: 'gate-done', region: 'event.region' },
    ],
  }],
};
const gateEntities = () => [{ id: 'gate-east' }, { id: 'gate-west' }];

describe('5. scope isolation (the sequenced/saga guarantee)', () => {
  it('interleaved sagas on distinct scope keys advance independently', () => {
    const state = createBusState(GATES, gateEntities());
    processEvents(state, [{ type: 'enter', region: 'gate-east' }]); // east opens, blocks
    processEvents(state, [{ type: 'enter', region: 'gate-west' }]); // west opens, blocks
    expect(state.byId['gate-east'].on).toBe(true);
    expect(state.byId['gate-west'].on).toBe(true);

    // clear WEST first — only west should complete; east must be untouched.
    processEvents(state, [{ type: 'cleared', region: 'gate-west' }]);
    const done = (region) => state.log.filter((r) => r.type === 'gate-done' && r.scope === region).length;
    expect(done('gate-west')).toBe(1);
    expect(done('gate-east')).toBe(0);

    processEvents(state, [{ type: 'cleared', region: 'gate-east' }]);
    expect(done('gate-east')).toBe(1);
  });

  it('a saga run alone matches its progress when run interleaved (no cross-talk)', () => {
    const alone = createBusState(GATES, gateEntities());
    processEvents(alone, [{ type: 'enter', region: 'gate-east' }]);
    processEvents(alone, [{ type: 'cleared', region: 'gate-east' }]);
    const eastDoneAlone = alone.log.filter((r) => r.type === 'gate-done' && r.scope === 'gate-east').length;

    const inter = createBusState(GATES, gateEntities());
    processEvents(inter, [{ type: 'enter', region: 'gate-east' }]);
    processEvents(inter, [{ type: 'enter', region: 'gate-west' }]);
    processEvents(inter, [{ type: 'cleared', region: 'gate-west' }]);
    processEvents(inter, [{ type: 'cleared', region: 'gate-east' }]);
    const eastDoneInter = inter.log.filter((r) => r.type === 'gate-done' && r.scope === 'gate-east').length;

    expect(eastDoneInter).toBe(eastDoneAlone);
  });
});

describe('6. stale-ref safety', () => {
  it('events targeting a missing entity are recorded no-ops, never throws, replay-stable', () => {
    // ball-9 was never spawned; the potted→toggle reaction resolves a target that does not exist.
    const script = [pot('ball-9', 'pocket-tl'), pot('ball-1', 'pocket-tr')];
    const run = () => { const s = processEvents(createBusState(TABLE, balls(2)), script); return s; };
    let s;
    expect(() => { s = run(); }).not.toThrow();
    expect(s.metrics.noops).toBeGreaterThan(0);
    expect(hashState(run())).toBe(hashState(run()));
  });
});

describe('7. no-input determinism preserved (the export/encode case)', () => {
  it('a timer-driven saga playthrough with NO user input is byte-reproducible', () => {
    const cfg = {
      sequences: [{
        id: 'pulse', scope: 'static', trigger: { on: 'start' },
        steps: [{ await: { timer: 0.5 } }, { do: 'toggle', target: 'lamp' }],
      }],
    };
    const playthrough = () => {
      const s = createBusState(cfg, [{ id: 'lamp' }]);
      processEvents(s, [{ type: 'start' }]);     // arms the timer
      for (let i = 0; i < 6; i++) {              // 6 × 0.1s ticks crosses the 0.5s await
        const emitted = stepTime(s, 0.1);
        if (emitted.length) processEvents(s, emitted);
      }
      return s;
    };
    const a = playthrough();
    expect(a.byId['lamp'].on).toBe(true);        // the timer fired and toggled the lamp
    expect(hashState(a)).toBe(hashState(playthrough()));
  });
});
