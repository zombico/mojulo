/**
 * SEE-THROUGH BARRIERS — glass and mesh: a body cannot pass them, a gaze can. A world's `barriers` ([{ min, max, kind?,
 * of? }], boxes in world metres: an office window's panes, a cage's mesh) are kept apart from its colliders, so every
 * sight test (mind.js perceive, foe.js, alarm.js, the guards' cones) runs through them as through air, and after each
 * step every body standing in one is put back out of it, as a wall would hold it (core.js resolveBlocking).
 *
 *   createWorld({ …, barriers })   the world keeps them (state.barriers)
 *   stepWorld                      after the step, each body with a rule held out of every barrier
 *
 * A round goes through them too (glass breaks, mesh lets it by). Wraps createWorld and stepWorld, outermost (compose.js
 * lists it last). Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose
 * world has barriers, so every other page keeps every byte.
 */
export function buildBarrier(E) {
  const make = E.createWorld, step = E.stepWorld;
  E.createWorld = function createWithBarriers(spec) {
    const s = make(spec);
    if (spec && Array.isArray(spec.barriers) && spec.barriers.length) s.barriers = spec.barriers;
    return s;
  };
  E.stepWorld = function stepWithBarriers(state, input, dt, hooks) {
    const out = step(state, input, dt, hooks), B = state.barriers;
    if (!B) return out;
    for (const e of state.entities) {
      if (e.isCamera || e.gone || !e.rule || !e.transform) continue;
      const r = e.rule, t = e.transform.pos;
      E.resolveBlocking(t, t[2] - (r.eye || 0), r.collideHeight ?? 1.8, r.collideRadius ?? 0.3, B, 0.35);
    }
    return out;
  };
}
