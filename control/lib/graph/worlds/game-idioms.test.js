import { describe, expect, it } from 'vitest';

import { createBusState, processEvents, stepTime, tickTimers, watchEvents, hashState, deriveEvents, linkPhysics, syncFromBodies, syncToBodies } from './event-bus.js';
import { createState, step } from './physics-sim.js';
import { compose, scoreCounter, countdownClock, gameOverFreeze, spawnOnHeartbeat, deed, onContact, pickup, onRest, hitConfirm, ephemeralTarget } from './game-idioms.js';
import { buildWhackAMole } from './games/whack-a-mole.js';
import { buildCradles } from './games/newton-cradles.js';
import { resolveWorldScene } from './world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// ── compose() — the lowering contract ──────────────────────────────────────────────────────────
describe('compose()', () => {
  it('concatenates array channels in idiom order and shallow-merges vars', () => {
    const ev = compose(
      { vars: { a: 1 }, reactions: [{ on: 'x' }] },
      { vars: { b: 2 }, reactions: [{ on: 'y' }], hud: [{ var: 'a' }] },
    );
    expect(ev.vars).toEqual({ a: 1, b: 2 });
    expect(ev.reactions).toEqual([{ on: 'x' }, { on: 'y' }]);
    expect(ev.hud).toEqual([{ var: 'a' }]);
  });

  it('reports a var declared by more than one idiom instead of silently clobbering', () => {
    expect(() => compose({ vars: { score: 0 } }, { vars: { score: 9 } })).toThrow(/score/);
  });

  it('omits channels no idiom contributed to (reads like a hand-written manifest)', () => {
    const ev = compose(scoreCounter('score'));
    expect(ev.timers).toBeUndefined();
    expect(ev.watches).toBeUndefined();
    expect(ev.hud).toEqual([{ var: 'score', label: 'score' }]);
  });
});

// ── each idiom lowers to exactly the primitive shape it claims (only existing verbs) ─────────────
describe('idiom lowering', () => {
  it('scoreCounter → a tracker var + a HUD row', () => {
    expect(scoreCounter('score', { label: 'Score' })).toEqual({ vars: { score: 0 }, hud: [{ var: 'score', label: 'Score' }] });
  });

  it('countdownClock → gated 1s timer + decrement reaction + on-zero watch + HUD row', () => {
    const f = countdownClock({ var: 'time', from: 10, gate: 'over', onZero: 'game-over', label: 'Time' });
    expect(f.vars).toEqual({ time: 10 });
    expect(f.timers).toEqual([{ every: 1, emit: { type: 'tick' }, while: { var: 'over', eq: 0 } }]);
    expect(f.reactions).toEqual([{ on: 'tick', do: 'inc', var: 'time', by: -1 }]);
    expect(f.watches).toEqual([{ type: 'game-over', when: { var: 'time', lte: 0 } }]);
    expect(f.hud).toEqual([{ var: 'time', label: 'Time' }]);
  });

  it('gameOverFreeze → raise the gate + banner + clear the board, all on the signal', () => {
    const f = gameOverFreeze({ signal: 'game-over', gate: 'over', banner: 'banner', clear: ['a', 'b'] });
    expect(f.vars).toEqual({ over: 0 });
    expect(f.reactions).toEqual([
      { on: 'game-over', do: 'set', var: 'over', to: 1 },
      { on: 'game-over', do: 'toggle', target: 'banner', to: true },
      { on: 'game-over', do: 'toggle', target: 'a', to: false },
      { on: 'game-over', do: 'toggle', target: 'b', to: false },
    ]);
  });

  it('gameOverFreeze omits the banner reaction when no banner is given', () => {
    const f = gameOverFreeze({ clear: ['a'] });
    expect(f.reactions).toEqual([
      { on: 'game-over', do: 'set', var: 'over', to: 1 },
      { on: 'game-over', do: 'toggle', target: 'a', to: false },
    ]);
  });

  it('spawnOnHeartbeat → one gated timer per target + a single rise reaction; periods cycle', () => {
    const f = spawnOnHeartbeat({ targets: ['h0', 'h1', 'h2'], periods: [0.5, 1], pop: 'pop', field: 'hole', gate: 'over' });
    expect(f.timers).toEqual([
      { every: 0.5, emit: { type: 'pop', hole: 'h0' }, while: { var: 'over', eq: 0 } },
      { every: 1, emit: { type: 'pop', hole: 'h1' }, while: { var: 'over', eq: 0 } },
      { every: 0.5, emit: { type: 'pop', hole: 'h2' }, while: { var: 'over', eq: 0 } },
    ]);
    expect(f.reactions).toEqual([{ on: 'pop', do: 'toggle', target: 'event.hole', to: true }]);
  });

  it('deed → an input binding + its effect reactions', () => {
    const f = deed({ on: 'pick', emit: 'whack', effects: [{ on: 'whack', do: 'inc', var: 'score' }] });
    expect(f.inputs).toEqual([{ on: 'pick', emit: { type: 'whack' } }]);
    expect(f.reactions).toEqual([{ on: 'whack', do: 'inc', var: 'score' }]);
  });

  it('onContact → a contact source + a matching reaction carrying the verb spec', () => {
    const f = onContact({ a: 'A-*', b: 'A-*', do: 'emit', type: 'clack', scope: 'A' });
    expect(f.sources).toEqual([{ type: 'contact', when: { a: 'A-*', b: 'A-*' } }]);
    expect(f.reactions).toEqual([{ on: 'contact', match: { a: 'A-*', b: 'A-*' }, do: 'emit', type: 'clack', scope: 'A' }]);
  });

  it('onContact leaves an unspecified side a wildcard (omits it from when/match)', () => {
    const f = onContact({ a: 'ball', do: 'spawn', template: 'splash' });
    expect(f.sources).toEqual([{ type: 'contact', when: { a: 'ball' } }]);
    expect(f.reactions).toEqual([{ on: 'contact', match: { a: 'ball' }, do: 'spawn', template: 'splash' }]);
  });

  it('pickup → contact source + drop-the-item + score-the-tracker reactions', () => {
    const f = pickup({ item: 'coin-*', by: 'hero', score: 'score' });
    expect(f.sources).toEqual([{ type: 'contact', when: { a: 'coin-*', b: 'hero' } }]);
    expect(f.reactions).toEqual([
      { on: 'contact', match: { a: 'coin-*', b: 'hero' }, do: 'toggle', target: 'event.a', to: false },
      { on: 'contact', match: { a: 'coin-*', b: 'hero' }, do: 'inc', var: 'score' },
    ]);
  });

  it('onRest → a rest source + a matching reaction', () => {
    const f = onRest({ body: 'stone-*', do: 'emit', type: 'delivered' });
    expect(f.sources).toEqual([{ type: 'rest', when: { body: 'stone-*' } }]);
    expect(f.reactions).toEqual([{ on: 'rest', match: { body: 'stone-*' }, do: 'emit', type: 'delivered' }]);
  });

  it('hitConfirm → a fire input + drop-the-hit-target + score reactions', () => {
    const f = hitConfirm({ on: 'fire', emit: 'shot', score: 'score' });
    expect(f.inputs).toEqual([{ on: 'fire', emit: { type: 'shot' } }]);
    expect(f.reactions).toEqual([
      { on: 'shot', do: 'toggle', target: 'event.target', to: false },
      { on: 'shot', do: 'inc', var: 'score' },
    ]);
  });

  it('hitConfirm: drop:false omits the target toggle; marker adds a hitmarker flash', () => {
    const f = hitConfirm({ emit: 'shot', drop: false, marker: 'reticle' });
    expect(f.reactions).toEqual([
      { on: 'shot', do: 'inc', var: 'score' },
      { on: 'shot', do: 'toggle', target: 'reticle', to: true },
    ]);
  });
});

// a minimal LOS world: one target + score + the laser deed. The raycast is mechanism (scene-three),
// so in the bus the hit is simulated by injecting the resolved `shot` event — exactly as whack-a-mole
// simulates a pick by injecting `whack`.
function buildLaserStub() {
  const events = compose(
    { entities: [{ id: 'target-0', on: true, color: '#ff5a4d', radius: 0.5, position: [0, 0, 2] }] },
    scoreCounter('score', { label: 'Score' }),
    hitConfirm({ on: 'fire', emit: 'shot', score: 'score' }),
  );
  return { kind: 'controllable', events, faces: [{ corners: [[-3, -3, 0], [3, -3, 0], [3, 3, 0], [-3, 3, 0]], fill: '#1c1f26' }] };
}

describe('hitConfirm policy (raycast simulated)', () => {
  it('a confirmed shot drops the hit target and scores; a stale target is a no-op', () => {
    const { events } = buildLaserStub();
    const bus = createBusState(events, events.entities);
    expect(bus.vars.score).toBe(0);
    processEvents(bus, [{ type: 'shot', target: 'target-0' }]);   // the renderer already resolved the LOS hit id
    expect(bus.vars.score).toBe(1);
    expect(bus.byId['target-0'].on).toBe(false);                   // the hit target dropped
    processEvents(bus, [{ type: 'shot', target: 'ghost' }]);       // a target that no longer exists
    expect(bus.vars.score).toBe(2);                                // score still tied to the deed
    expect(bus.metrics.noops).toBeGreaterThan(0);                  // the toggle was a recorded no-op, not a throw
  });
});

describe('LOS fire mechanism emitted into the /world page', () => {
  it('wires a camera-forward raycast over all scene geometry + the fire input binding', async () => {
    const out = await resolveWorldScene({ manifest: buildLaserStub(), title: 'laser-stub' });
    const html = emitThreeWorld({ ...out.payload });
    expect(html).toContain('__shotRay');                                // the LOS aim helper (camera-forward by default; `from` aims from an entity)
    expect(html).toContain('intersectObjects(scene.children, true)');   // raycasts ALL geometry → occlusion
    expect(html).toContain('camera.getWorldDirection');                 // default (no `from`) = camera-forward
    expect(html).toContain('"on":"fire"');                             // the fire input serialized
    expect(html).not.toContain('const PHYSICS =');                      // physics-free world
  });
});

// ── ephemeralTarget — a target that appears, lives ttl, disappears. Driven by the saga timer
// (stepTime), no physics, no input beyond the triggering `pop`. ──────────────────────────────────
function stepFrame(bus, incoming, dt = 1 / 60) {
  if (incoming && incoming.length) processEvents(bus, incoming);
  const timed = stepTime(bus, dt);
  if (timed.length) processEvents(bus, timed);
}
function buildEphemeralStub({ ttl = 2.0 } = {}) {
  return compose(
    { entities: [{ id: 't0', on: false, radius: 0.5, position: [0, 0, 0] }, { id: 't1', on: false, radius: 0.5, position: [1, 0, 0] }] },
    ephemeralTarget({ on: 'pop', ttl, field: 'target' }),
  );
}

describe('ephemeralTarget lowering', () => {
  it('→ a scope-per-target sequence: toggle on, await ttl, toggle off', () => {
    expect(ephemeralTarget({ on: 'pop', ttl: 2.0, field: 'target' })).toEqual({
      sequences: [{
        id: 'ttl-pop', scope: 'event.target', trigger: { on: 'pop' },
        steps: [
          { do: 'toggle', target: 'event.target', to: true },
          { await: { timer: 2.0 } },
          { do: 'toggle', target: 'event.target', to: false },
        ],
      }],
    });
  });
});

describe('ephemeralTarget behavior', () => {
  it('a popped target appears immediately, lives ~ttl, then disappears', () => {
    const events = buildEphemeralStub({ ttl: 2.0 });
    const bus = createBusState(events, events.entities);
    stepFrame(bus, [{ type: 'pop', target: 't0' }]);
    expect(bus.byId.t0.on).toBe(true);                 // appeared
    for (let i = 0; i < 100; i++) stepFrame(bus);       // ~1.67s — still within ttl
    expect(bus.byId.t0.on).toBe(true);
    for (let i = 0; i < 40; i++) stepFrame(bus);        // total ~2.33s — past ttl
    expect(bus.byId.t0.on).toBe(false);                // disappeared
  });

  it('the SAME target can pop again after its lifetime ends (scope frees on completion)', () => {
    const events = buildEphemeralStub({ ttl: 1.0 });
    const bus = createBusState(events, events.entities);
    stepFrame(bus, [{ type: 'pop', target: 't0' }]);
    expect(bus.byId.t0.on).toBe(true);
    for (let i = 0; i < 80; i++) stepFrame(bus);        // > 1s: lifetime ends, scope frees
    expect(bus.byId.t0.on).toBe(false);
    stepFrame(bus, [{ type: 'pop', target: 't0' }]);    // pop again — must re-appear (the bus fix)
    expect(bus.byId.t0.on).toBe(true);
  });

  it('targets have independent lifetimes (scope per target id)', () => {
    const events = buildEphemeralStub({ ttl: 2.0 });
    const bus = createBusState(events, events.entities);
    stepFrame(bus, [{ type: 'pop', target: 't0' }]);
    for (let i = 0; i < 60; i++) stepFrame(bus);        // 1s later
    stepFrame(bus, [{ type: 'pop', target: 't1' }]);    // t1 pops ~1s after t0
    expect(bus.byId.t0.on).toBe(true);
    expect(bus.byId.t1.on).toBe(true);
    for (let i = 0; i < 70; i++) stepFrame(bus);        // t0 passes 2s; t1 only ~1.17s
    expect(bus.byId.t0.on).toBe(false);                // t0 expired
    expect(bus.byId.t1.on).toBe(true);                 // t1 alive — independent
  });

  it('the playthrough is byte-reproducible (seeded saga timers)', () => {
    const run = () => {
      const events = buildEphemeralStub({ ttl: 2.0 });
      const bus = createBusState(events, events.entities);
      const script = { 0: 't0', 30: 't1', 200: 't0' };
      for (let i = 0; i <= 300; i++) stepFrame(bus, script[i] ? [{ type: 'pop', target: script[i] }] : null);
      return hashState(bus);
    };
    expect(run()).toBe(run());
  });
});

// ── THE PROOF: whack-a-mole recomposed from idioms is behaviorally identical to the hand-inlined
// manifest, asserted by the bus's OWN determinism oracle (hashState) over a seeded playthrough.
// hashState covers entities + vars + log + metrics — so identical hash ⇒ the refactor changed
// authoring, not behavior. Idiom expansion may order arrays differently; the hash proves it does
// not matter, which is exactly why the plan chose behavioral (not structural) equality. ─────────
const DT = 1 / 60;
const HORIZON = 720;                                          // 12s — past the 10s buzzer
const SCRIPT = { 30: 'hole-0', 90: 'hole-4', 150: 'hole-7', 300: 'hole-2' };  // state-independent deeds

const watchFix = (bus) => { let g = 0; while (g++ < 8) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
function frame(bus, incoming) {
  if (incoming && incoming.length) processEvents(bus, incoming);
  watchFix(bus);
  const ticks = tickTimers(bus, DT); if (ticks.length) processEvents(bus, ticks);
  const timed = stepTime(bus, DT); if (timed.length) processEvents(bus, timed);
  watchFix(bus);
}
function playthrough(events) {
  const bus = createBusState(events, events.entities);
  for (let i = 0; i <= HORIZON; i++) frame(bus, SCRIPT[i] ? [{ type: 'whack', target: SCRIPT[i] }] : null);
  return bus;
}

// GOLDEN: the hand-inlined manifest verbatim as whack-a-mole shipped before the idiom refactor.
function goldenWhackAMole({ holes = 9, seconds = 10 } = {}) {
  const cols = 3, gap = 1.7, z = 0.6;
  const periods = [0.7, 1.1, 0.9, 1.3, 0.6, 1.0, 1.2, 0.8, 1.4];
  const entities = [], timers = [], ids = [];
  for (let i = 0; i < holes; i++) {
    const id = 'hole-' + i; ids.push(id);
    const cx = (i % cols - (cols - 1) / 2) * gap;
    const cy = (Math.floor(i / cols) - 1) * gap;
    entities.push({ id, on: false, color: '#ff5a4d', radius: 0.55, position: [cx, cy, z] });
    timers.push({ every: periods[i % periods.length], emit: { type: 'pop', hole: id }, while: { var: 'over', eq: 0 } });
  }
  entities.push({ id: 'banner', on: false, color: '#ffd700', radius: 1.4, position: [0, 0, 3.2] });
  timers.push({ every: 1, emit: { type: 'tick' }, while: { var: 'over', eq: 0 } });
  return {
    vars: { score: 0, time: seconds, over: 0 }, entities, timers,
    reactions: [
      { on: 'pop', do: 'toggle', target: 'event.hole', to: true },
      { on: 'whack', do: 'toggle', target: 'event.target', to: false },
      { on: 'whack', do: 'inc', var: 'score' },
      { on: 'tick', do: 'inc', var: 'time', by: -1 },
      { on: 'game-over', do: 'set', var: 'over', to: 1 },
      { on: 'game-over', do: 'toggle', target: 'banner', to: true },
      ...ids.map((id) => ({ on: 'game-over', do: 'toggle', target: id, to: false })),
    ],
    watches: [{ type: 'game-over', when: { var: 'time', lte: 0 } }],
    inputs: [{ on: 'pick', emit: { type: 'whack' } }],
    hud: [{ var: 'score', label: 'Score' }, { var: 'time', label: 'Time' }],
  };
}

describe('whack-a-mole recomposed from idioms', () => {
  it('is byte-identical to the hand-inlined manifest under the determinism oracle', () => {
    const golden = hashState(playthrough(goldenWhackAMole()));
    const composed = hashState(playthrough(buildWhackAMole().events));
    expect(composed).toBe(golden);
  });

  it('the proof is non-trivial: the playthrough actually scores, runs out the clock, and freezes', () => {
    const bus = playthrough(buildWhackAMole().events);
    expect(bus.vars.score).toBe(4);                  // four scripted whacks landed in the tracker
    expect(bus.vars.time).toBeLessThanOrEqual(0);    // the clock ran out
    expect(bus.vars.over).toBe(1);                   // game-over froze the board
    expect(bus.byId.banner.on).toBe(true);
  });
});

// ── PROOF (contact idioms): newton-cradles' clack POLICY recomposed from `onContact` is
// behaviorally identical to the hand-paired source/reaction, driven through the full physics + bus
// loop and compared by hashState. Same oracle, now spanning the physics→bus seam. ────────────────
const DT_PHYS = 1 / 120;
function runCradleWorld(physics, events, steps) {
  const phys = createState(physics);
  const bus = createBusState(events);
  linkPhysics(bus, phys);
  if (events.initial) processEvents(bus, events.initial);     // arm the rig sagas
  let prev;
  for (let i = 0; i < steps; i++) {
    step(phys, DT_PHYS);
    syncFromBodies(bus, phys);
    const d = deriveEvents(phys, prev, events.sources); prev = d.prev;
    if (d.events.length) processEvents(bus, d.events);
    const timed = stepTime(bus, DT_PHYS);
    if (timed.length) processEvents(bus, timed);
    syncToBodies(bus, phys);
  }
  return bus;
}

// GOLDEN: the hand-paired source/reaction clack policy exactly as newton-cradles shipped before the
// onContact refactor (rig saga + arm events are unchanged either way, kept here for a full manifest).
function goldenCradleEvents(cradles) {
  return {
    sources: cradles.map((c) => ({ type: 'contact', when: { a: `${c.key}-*`, b: `${c.key}-*` } })),
    reactions: cradles.map((c) => ({ on: 'contact', match: { a: `${c.key}-*`, b: `${c.key}-*` }, do: 'emit', type: 'clack', scope: c.key })),
    sequences: [{
      id: 'rig', scope: 'event.cradle', trigger: { on: 'arm' },
      steps: [{ await: { timer: 'event.delay' } }, { do: 'impulse', target: 'event.endBall', dir: 'event.dir', gain: 'event.gain' }],
    }],
    initial: cradles.map((c) => ({ type: 'arm', cradle: c.key, endBall: `${c.key}-${c.end}`, dir: c.dir, gain: c.gain, delay: c.delay })),
  };
}

describe('newton-cradles clack policy recomposed from onContact', () => {
  it('is byte-identical to the hand-paired source/reaction under the determinism oracle', () => {
    const world = buildCradles();                              // physics shared; events now composed
    const golden = hashState(runCradleWorld(world.physics, goldenCradleEvents(world.cradles), 300));
    const composed = hashState(runCradleWorld(world.physics, world.events, 300));
    expect(composed).toBe(golden);
  });

  it('the proof is non-trivial: clacks actually fire and stay scope-isolated per cradle', () => {
    const world = buildCradles();
    const bus = runCradleWorld(world.physics, world.events, 300);
    const clacks = (scope) => bus.log.filter((r) => r.type === 'clack' && r.scope === scope).length;
    expect(clacks('A')).toBeGreaterThan(0);
    expect(clacks('B')).toBeGreaterThan(0);
  });
});
