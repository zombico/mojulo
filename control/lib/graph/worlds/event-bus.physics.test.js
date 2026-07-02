import { describe, expect, it } from 'vitest';

import { createState, step } from './physics-sim.js';
import { createBusState, processEvents, deriveEvents, hashState } from './event-bus.js';

// ── Phase 2 integration: the membrane between mechanism and policy ──────────────────────────────
// physics-sim emits physical FACTS (contact / rest); the bus assigns MEANING via reactions. This
// is the first time the two run together — a real ball-drop, not synthetic events. The combined
// loop is deterministic because BOTH halves are, which keeps the replay oracle intact end to end.

const DT = 1 / 120;
const ball = (over = {}) => ({ id: 'ball', collider: 'sphere', position: [0, 0, 5], radius: 0.5, restitution: 0.3, ...over });
const floor = () => ({ collider: 'plane', id: 'floor', position: [0, 0, 0], normal: [0, 0, 1], mass: 0 });

// Run physics + bus together for `steps` fixed steps. Returns { phys, bus }.
function worldRun(physSpec, busCfg, entities, sources, steps) {
  const phys = createState(physSpec);
  const bus = createBusState(busCfg, entities);
  let prev;
  for (let i = 0; i < steps; i++) {
    step(phys, DT);
    const derived = deriveEvents(phys, prev, sources);
    prev = derived.prev;
    if (derived.events.length) processEvents(bus, derived.events);
  }
  return { phys, bus };
}

describe('rest fact → rule (a ball coming to rest lights a goal)', () => {
  const sources = [{ type: 'rest', when: { body: 'ball' } }];
  const cfg = { reactions: [{ on: 'rest', match: { body: 'ball' }, do: 'toggle', target: 'goal-light' }] };

  it('fires the rule once the ball settles, and only on the rest ONSET edge', () => {
    const { bus } = worldRun(
      { gravity: [0, 0, -9.8], bodies: [ball(), floor()] },
      cfg, [{ id: 'goal-light' }], sources, 600, // 5s — plenty to bounce out and settle
    );
    const restEvents = bus.log.filter((r) => r.type === 'rest');
    expect(restEvents.length).toBe(1);                 // edge-triggered: one rest, not one-per-tick
    expect(bus.byId['goal-light'].on).toBe(true);      // the fact drove the policy
  });
});

describe('contact fact → emit chain (ball striking the floor)', () => {
  const sources = [{ type: 'contact', when: { a: 'ball', b: 'floor' } }];
  const cfg = { reactions: [{ on: 'contact', match: { a: 'ball' }, do: 'spawn', type: 'splash', at: 'event.point' }] };

  it('each impact is a contact onset that spawns a splash at the contact point', () => {
    const { bus } = worldRun(
      { gravity: [0, 0, -9.8], bodies: [ball({ restitution: 0.6 }), floor()] },
      cfg, [], sources, 400,
    );
    const contacts = bus.log.filter((r) => r.type === 'contact');
    expect(contacts.length).toBeGreaterThanOrEqual(1);          // at least the first strike
    const splashes = bus.entities.filter((e) => e.type === 'splash');
    expect(splashes.length).toBe(contacts.length);              // one splash per onset, no silent drop
    // splashes land on/near the floor, never below it or at NaN.
    for (const s of splashes) {
      expect(Number.isFinite(s.position[2])).toBe(true);
      expect(s.position[2]).toBeGreaterThan(-0.01);
    }
  });
});

describe('end-to-end determinism (the oracle survives the physics→bus seam)', () => {
  it('two full physics+bus playthroughs are byte-identical', () => {
    const run = () => hashState(worldRun(
      { gravity: [0, 0, -9.8], seed: 11, bodies: [ball(), ball({ id: 'ball-2', position: [0.2, 0, 7] }), floor()] },
      { reactions: [{ on: 'rest', match: { body: 'ball*' }, do: 'toggle', target: 'goal-light' }] },
      [{ id: 'goal-light' }],
      [{ type: 'rest', when: { body: 'ball*' } }],
      600,
    ).bus);
    expect(run()).toBe(run());
  });
});
