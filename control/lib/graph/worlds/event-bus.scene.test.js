import { describe, expect, it } from 'vitest';

import { emitThreeWorld } from '../scene/scene-three.js';
import { buildBus } from './event-bus.js';

// ── Phase 5: the EVENTS channel in the /world page ─────────────────────────────────────────────
// The browser can't run here, so (as with the physics channel) we verify two things: the wiring is
// emitted into the page, and the emitted reducer source is itself valid, runnable JS with the right
// behaviour. The single-source-of-truth claim is checked by asserting buildBus' source appears verbatim.

const baseFace = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#445566' };
const physics = { gravity: [0, 0, -9.8], bodies: [{ id: 'ball', collider: 'sphere', position: [0, 0, 5], radius: 0.5 }, { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0 }] };
const events = {
  sources: [{ type: 'rest', when: { body: 'ball' } }],
  reactions: [{ on: 'rest', match: { body: 'ball' }, do: 'toggle', target: 'goal-light' }],
  entities: [{ id: 'goal-light', on: false }],
};

describe('emitThreeWorld events channel', () => {
  it('emits the events block only when reactions/sequences are present', () => {
    const without = emitThreeWorld({ faces: [baseFace], physics });
    expect(without).not.toContain('const EVENTS =');
    const bare = emitThreeWorld({ faces: [baseFace], physics, events: { sources: events.sources } });
    expect(bare).not.toContain('const EVENTS ='); // a sources-only config with nothing listening is inert
    const withEvents = emitThreeWorld({ faces: [baseFace], physics, events });
    expect(withEvents).toContain('const EVENTS =');
    expect(withEvents).toContain('stepEvents = (t) =>');
    expect(withEvents).toContain('window.__mojBus');
  });

  it('wires stepEvents into the per-frame step, after stepPhysics', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics, events });
    expect(html).toContain('stepEvents(t)');
    expect(html.indexOf('stepPhysics(t)')).toBeLessThan(html.indexOf('stepEvents(t)')); // facts before reactions
  });

  it('serializes the manifest events verbatim into EVENTS', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics, events });
    expect(html).toContain(JSON.stringify(events));
  });

  it('emits the reducer source inline (single source of truth, no drift)', () => {
    const html = emitThreeWorld({ faces: [baseFace], physics, events });
    expect(html).toContain(buildBus.toString());
  });

  it('the emitted reducer source is itself valid, runnable JS', () => {
    // Reconstruct what the browser evaluates: (buildBus source)() → the bus API, then react to a fact.
    // eslint-disable-next-line no-new-func
    const bus = new Function(`return (${buildBus.toString()})();`)();
    const state = bus.createBusState(events, events.entities);
    bus.processEvents(state, [{ type: 'rest', body: 'ball', source: 'ball' }]);
    expect(state.byId['goal-light'].on).toBe(true); // the rest fact toggled the goal light
    expect(typeof bus.deriveEvents).toBe('function');
  });
});
