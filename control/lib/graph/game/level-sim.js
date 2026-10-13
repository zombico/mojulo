/**
 * LEVEL SIM — a level's world and bus stepped together in Node, in the page's order (scene/channels/events.js), with no
 * rendering: the walkers' zone facts and the cast's facts join the frame's events, the bus processes them, its watches,
 * timers and sagas run, the character intents it queued reach the world, then the world steps. For laws that play a
 * level through (a defence held, a race run) where the page would take minutes and a hidden tab barely ticks.
 *
 *   simLevel({ entities, events, colliders? }, { ground?, surface? }) → { world, bus, input, frame(dt, events?), run(seconds, at?) }
 *     `at`: { <second>: [events] } pushed into the frame that reaches that time (an interact press: { type: 'use-<id>' })
 *     `input`: the pilot's held input every frame (set its fields: { fire: 1, … }), as the page's keys and mouse give it
 *
 * Deterministic: a fixed dt (1/30 s), the bus's own content order, the world's seeded rules.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { buildBus } from '../worlds/event-bus.js';

let E = null;
const B = buildBus();

export function simLevel({ entities = [], events = {}, colliders } = {}, { ground = () => 0, surface = null } = {}) {
  E ??= composeLive();
  const world = E.createWorld({ entities, ...(colliders ? { colliders } : {}) });
  const bus = B.createBusState(events, events.entities);
  const hooks = { ground, ...(surface ? { surface } : {}) };
  let zonePrev, castPrev, t = 0;
  const input = {};
  const pump = (list) => {
    if (list.length) B.processEvents(bus, list);
    let w = B.watchEvents(bus);
    for (let k = 0; w.length && k < 8; k++) { B.processEvents(bus, w); w = B.watchEvents(bus); }
  };
  pump(events.initial || []);
  const frame = (dt, extra = []) => {
    const incoming = [...extra];
    const z = B.deriveZoneEvents(world.entities, zonePrev, events.sources); zonePrev = z.prev; incoming.push(...z.events);
    const c = E.castFacts(world, castPrev); castPrev = c.prev; incoming.push(...c.events);
    pump(incoming);
    pump(B.tickTimers(bus, dt));
    pump(B.stepTime(bus, dt));
    B.syncToCtrl(bus, world.entities, (ops) => E.castOps(world, ops));
    E.stepWorld(world, input, dt, hooks);
    t += dt;
  };
  const run = (seconds, at = {}) => {
    const due = Object.keys(at).map(Number).sort((a, b) => a - b);
    for (let n = Math.round(seconds * 30); n > 0; n--) {
      const now = [];
      while (due.length && due[0] <= t + 1e-9) now.push(...at[due.shift()]);
      frame(1 / 30, now);
    }
  };
  return { world, bus, input, frame, run, get time() { return t; } };
}
