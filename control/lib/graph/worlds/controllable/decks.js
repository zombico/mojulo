/**
 * decks.js — A CARRIER'S DECK IS FOOTING. The runtime carries a rider with its carrier (core.js stepCarry: a moving
 * platform, a lift, a truck of a convoy, a car of a train) but leaves the deck's height to the world's ground probe, and
 * the World page's probe never stands a body on another body: on a page a moving deck was walked through. This wraps the
 * step so the ground it is handed answers a carrier's deck too: under a probe's origin, inside the carrier's footprint
 * (`body.carryHalf` [hx, hy], or `body.carryRadius`, 1.5) and at or below the origin, its top (`pos.z + body.deck`) where
 * it is higher than the ground the world found.
 *
 * Wraps stepWorld outermost (composed last), so every rule and wrapper that probes the ground (the platform rule, the
 * chase line's pursuers) stands on decks. Import-free inside the builder (the page runs its source via toString(),
 * compose.js); emitted only into a page whose world has a carrier, so every other page keeps every byte. Pure: the same
 * world and the same probe give the same footing.
 */
export function buildDecks(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithDecks(state, input, dt, hooks) {
    const cs = state.entities.filter((e) => e.body && e.body.carrier && !e.gone && !e.isCamera);
    if (!cs.length || !hooks || !hooks.ground) return step(state, input, dt, hooks);
    const g = hooks.ground;
    const ground = (p) => {
      let z = g(p);
      for (const c of cs) {
        const q = c.transform.pos, top = (q[2] || 0) + (c.body.deck || 0);
        if (top > p[2] + 0.05 || (z != null && top <= z)) continue;   // (above the probe's origin, or under what it found)
        const half = Array.isArray(c.body.carryHalf) ? c.body.carryHalf : null, rad = Number.isFinite(c.body.carryRadius) ? c.body.carryRadius : 1.5;
        if (half ? Math.abs(p[0] - q[0]) <= half[0] && Math.abs(p[1] - q[1]) <= half[1] : Math.hypot(p[0] - q[0], p[1] - q[1]) <= rad) z = top;
      }
      return z;
    };
    return step(state, input, dt, { ...hooks, ground });
  };
}
