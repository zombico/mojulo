import { describe, it, expect } from 'vitest';

import { buildBus } from './event-bus.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// ── M0-pre: the controllable trigger/zone fact source (game-mechanics.plan.md) ──────────────────
// The walking player emits no physics contacts, so every spatial mechanic needs this: a per-tick
// overlap test of entity positions vs declared zones, emitting edge-triggered enter/exit facts into
// the same bus the reactions consume. These tests are the affordance's determinism contract.

const B = buildBus();

// a controllable-shaped entity (matches controllable-world.js: { id, transform:{ pos } })
const ent = (id, pos) => ({ id, transform: { pos } });

const GOAL = { type: 'zone', zone: 'goal', at: [10, 0, 0], radius: 2 };
const FOOT = { type: 'zone', zone: 'pad', at: [0, 0, 0], half: [3, 3, 5], planar: true };

describe('deriveZoneEvents — edge-triggered enter/exit', () => {
  it('fires enter only on the ONSET tick, not while still inside', () => {
    let prev;
    // outside → no event
    let r = B.deriveZoneEvents([ent('p', [0, 0, 0])], prev, [GOAL]); prev = r.prev;
    expect(r.events).toEqual([]);
    // step into the zone → enter
    r = B.deriveZoneEvents([ent('p', [10, 0, 0])], prev, [GOAL]); prev = r.prev;
    expect(r.events).toEqual([{ type: 'enter', zone: 'goal', entity: 'p', source: 'goal', at: [10, 0, 0] }]);
    // still inside next tick → nothing (not a re-onset)
    r = B.deriveZoneEvents([ent('p', [10.5, 0, 0])], prev, [GOAL]); prev = r.prev;
    expect(r.events).toEqual([]);
    // leave → exit
    r = B.deriveZoneEvents([ent('p', [0, 0, 0])], prev, [GOAL]); prev = r.prev;
    expect(r.events).toEqual([{ type: 'exit', zone: 'goal', entity: 'p', source: 'goal' }]);
  });

  it('sphere radius uses true distance; box half uses per-axis extent', () => {
    const near = B.deriveZoneEvents([ent('p', [11.9, 0, 0])], null, [GOAL]);   // dist 1.9 < 2
    expect(near.events.length).toBe(1);
    const far = B.deriveZoneEvents([ent('p', [12.5, 0, 0])], null, [GOAL]);    // dist 2.5 > 2
    expect(far.events.length).toBe(0);
    const corner = B.deriveZoneEvents([ent('p', [2.9, 2.9, 0])], null, [FOOT]); // inside 3×3 box
    expect(corner.events.length).toBe(1);
  });

  it('planar zones ignore Z — a jumping player over the footprint still counts inside', () => {
    const high = B.deriveZoneEvents([ent('p', [0, 0, 50])], null, [FOOT]);     // Z ignored (planar)
    expect(high.events.length).toBe(1);
    const solid = B.deriveZoneEvents([ent('p', [0, 0, 50])], null, [{ ...FOOT, planar: false, half: [3, 3, 5] }]);
    expect(solid.events.length).toBe(0);                                        // Z 50 > half 5
  });

  it('watch filters which entity a zone reacts to (glob)', () => {
    const src = { ...GOAL, watch: 'hero' };
    const ents = [ent('hero', [10, 0, 0]), ent('mob-1', [10, 0, 0])];
    const r = B.deriveZoneEvents(ents, null, [src]);
    expect(r.events.map((e) => e.entity)).toEqual(['hero']);
  });

  it('is pure/deterministic: same positions + prev → identical events', () => {
    const a = B.deriveZoneEvents([ent('p', [10, 0, 0])], { inside: {} }, [GOAL]);
    const b = B.deriveZoneEvents([ent('p', [10, 0, 0])], { inside: {} }, [GOAL]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('tolerates physics-body shape ({ id, position }) too, so a zone can watch either', () => {
    const body = { id: 'ball', position: [10, 0, 0] };
    const r = B.deriveZoneEvents([body], null, [GOAL]);
    expect(r.events[0]).toMatchObject({ type: 'enter', zone: 'goal', entity: 'ball' });
  });

  it('ignores non-zone sources (leaves contact/rest to deriveEvents)', () => {
    const r = B.deriveZoneEvents([ent('p', [10, 0, 0])], null, [{ type: 'contact', when: {} }]);
    expect(r.events).toEqual([]);
  });
});

describe('zone facts drive the real bus reducer (the whole point)', () => {
  it('an enter fact trips a reaction → a bus var, end to end through processEvents', () => {
    // a level: zone source + a reaction that maps entering the goal to a HUD var (stand-in for the
    // game on-map's end('success')). This is the exact path a reach-exit mechanic will lower to.
    const events = {
      sources: [GOAL],
      reactions: [{ on: 'enter', match: { zone: 'goal' }, do: 'set', var: 'won', to: 1 }],
      hud: [{ var: 'won' }],
      vars: { won: 0 },
    };
    const state = B.createBusState(events, []);
    // tick 1: player outside → derive → process → still 0
    let z = B.deriveZoneEvents([ent('p', [0, 0, 0])], undefined, events.sources);
    B.processEvents(state, z.events);
    expect(state.vars.won).toBe(0);
    // tick 2: player reaches the goal → enter fact → reaction fires → won = 1
    z = B.deriveZoneEvents([ent('p', [10, 0, 0])], z.prev, events.sources);
    B.processEvents(state, z.events);
    expect(state.vars.won).toBe(1);
  });
});

describe('emitted worlds wire the zone deriver into the loop', () => {
  it('a controllable world with a zone source emits the deriveZoneEvents call, gated on __mojCtrl', () => {
    const html = emitThreeWorld({
      faces: [{ pts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: '#888' }],
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' } }],
      events: {
        sources: [{ type: 'zone', zone: 'goal', at: [10, 0, 0], radius: 2 }],
        reactions: [{ on: 'enter', match: { zone: 'goal' }, do: 'set', var: 'won', to: 1 }],
        hud: [{ var: 'won' }], vars: { won: 0 },
      },
    });
    expect(html).toContain('deriveZoneEvents');
    expect(html).toContain('window.__mojCtrl) {');
  });

  it('a world with no events channel emits no zone deriver (additive, byte-identical posture)', () => {
    const html = emitThreeWorld({ faces: [{ pts: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], color: '#888' }] });
    expect(html).not.toContain('deriveZoneEvents');
  });
});
