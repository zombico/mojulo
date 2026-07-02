import { describe, expect, it } from 'vitest';

import { createBusState, processEvents, stepTime, watchEvents, hashState } from './event-bus.js';

// ── CONCEPTUAL triggers: in-world things with NO physics equivalent ─────────────────────────────
// Same bus, no integrator. State lives in `vars`; `set`/`inc` write it; `watch` predicates fire on
// the edge their condition becomes true. contact/rest were just built-in physics predicates — these
// are the general case. The determinism oracle still holds (vars fold into the hash).

// One conceptual tick: run incoming events, then loop watches→reactions to a fixed point (so a
// reaction that writes a var can trigger a watch SAME tick), then advance any timer sequences.
function tick(bus, incoming, dt) {
  if (incoming && incoming.length) processEvents(bus, incoming);
  let guard = 0;
  while (guard++ < 8) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); }
  if (dt) { const t = stepTime(bus, dt); if (t.length) processEvents(bus, t); }
}
const count = (bus, type) => bus.log.filter((r) => r.type === type).length;

// A vault: collect 3 keys → the gate unlocks → after a beat, the treasure is revealed. Pure concept.
const vault = () => createBusState({
  vars: { keys: 0 },
  reactions: [
    { on: 'grab-key', do: 'inc', var: 'keys' },           // a fact increments conceptual state
    { on: 'unlocked', do: 'toggle', target: 'gate' },     // the conceptual trigger opens the gate
  ],
  watches: [
    { type: 'unlocked', when: { var: 'keys', gte: 3 } },  // an edge-triggered predicate over a var
  ],
  sequences: [
    { id: 'reveal', trigger: { on: 'unlocked' }, steps: [{ await: { timer: 0.6 } }, { do: 'toggle', target: 'treasure' }] },
  ],
}, [{ id: 'gate' }, { id: 'treasure' }]);

describe('conceptual threshold trigger (the three-key vault)', () => {
  it('the gate unlocks only on the 3rd key, fires once, and a 4th key does not re-fire', () => {
    const bus = vault();
    tick(bus, [{ type: 'grab-key' }]);                     // keys 1
    tick(bus, [{ type: 'grab-key' }]);                     // keys 2
    expect(bus.byId.gate.on).toBe(false);                  // still locked
    tick(bus, [{ type: 'grab-key' }]);                     // keys 3 → watch fires → gate opens, same tick
    expect(bus.vars.keys).toBe(3);
    expect(bus.byId.gate.on).toBe(true);
    expect(count(bus, 'unlocked')).toBe(1);
    tick(bus, [{ type: 'grab-key' }]);                     // keys 4: predicate still true → NO new edge
    expect(bus.vars.keys).toBe(4);
    expect(count(bus, 'unlocked')).toBe(1);               // edge-triggered, not level-triggered
  });

  it('the conceptual trigger starts a timed sequence (reveal after a beat)', () => {
    const bus = vault();
    for (let i = 0; i < 3; i++) tick(bus, [{ type: 'grab-key' }]);
    expect(bus.byId.treasure.on).toBe(false);             // unlocked, but not yet revealed
    for (let i = 0; i < 7; i++) tick(bus, [], 0.1);        // 0.7s of dt crosses the 0.6s await
    expect(bus.byId.treasure.on).toBe(true);
  });

  it('purely conceptual playthrough is byte-reproducible', () => {
    const run = () => {
      const bus = vault();
      for (let i = 0; i < 3; i++) tick(bus, [{ type: 'grab-key' }]);
      for (let i = 0; i < 7; i++) tick(bus, [], 0.1);
      return hashState(bus);
    };
    expect(run()).toBe(run());
  });
});

describe('conceptual aggregate trigger (three levers open a door)', () => {
  const levers = () => createBusState({
    reactions: [
      { on: 'pull', do: 'toggle', target: 'event.lever' },
      { on: 'all-set', do: 'toggle', target: 'door' },
    ],
    watches: [{ type: 'all-set', when: { all: 'lever-*', field: 'on', eq: true } }],
  }, [{ id: 'lever-1' }, { id: 'lever-2' }, { id: 'lever-3' }, { id: 'door' }]);

  it('the door opens only when ALL levers are on, and re-arms if one flips back', () => {
    const bus = levers();
    tick(bus, [{ type: 'pull', lever: 'lever-1' }]);
    tick(bus, [{ type: 'pull', lever: 'lever-2' }]);
    expect(bus.byId.door.on).toBe(false);                 // not all on yet
    tick(bus, [{ type: 'pull', lever: 'lever-3' }]);       // all three → predicate edge → door opens
    expect(bus.byId.door.on).toBe(true);
    expect(count(bus, 'all-set')).toBe(1);

    tick(bus, [{ type: 'pull', lever: 'lever-2' }]);       // flip one off → predicate goes false
    tick(bus, [{ type: 'pull', lever: 'lever-2' }]);       // back on → NEW edge → fires again
    expect(count(bus, 'all-set')).toBe(2);
  });
});
