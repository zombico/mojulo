/**
 * steer.js — STEERED WHEELS: a body that turns as a wheeled machine turns, about a point beside it, by the angle its
 * front wheels are steered to, never in place. Import-free (the page runs this source via toString(), compose.js);
 * emitted only into a page whose world has a steered body, so every other page keeps every byte.
 *
 * A rule's `steer` (opt-in; a `walk` rule's, a form's: a walker's tank form, gameworld/combat/frames.js):
 *   wheelbase   metres from the fixed axles' line to the steered axle's
 *   max         the steered wheels' lock (°)
 *   rate        how fast the wheels are steered toward the hand (°/s)
 *
 * THE HAND: the turn input (A / D) asks the wheels for a share of their lock; they turn toward it at their rate, and back
 * to straight when it is let go. At speed the lock is what its grip allows (the turn's rate within the rule's `turn`), so
 * its wheels point along the circle it drives; standing or slow, its full lock.
 * THE TURN: the body's heading turns at v · tan(δ) / wheelbase (v its speed along its heading, δ its steer): a tighter
 * lock or a shorter wheelbase a tighter circle, standing it does not turn, reversing it turns the other way. The walk
 * rule then moves it; its turn input is the turn this asks of it.
 *
 * Field ownership: e.steer (the steered angle, °, + to the right: what the page draws its wheels at).
 */
export function buildSteer(E) {
  const step = E.stepWorld;
  const D = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function steered(e, input, dt) {
    const r = e.rule, S = r.steer, rate = S.rate > 0 ? S.rate : 90, wb = Math.max(0.1, S.wheelbase), cap = r.turn > 0 ? r.turn : 1;
    // (its speed along its heading, as the walk rule will move it: its forward input at its pace)
    const v = clamp(input.forward || 0, -1, 1) * (r.speed ?? 6);
    // (its lock at speed what its grip allows: the turn's rate v·tan(δ)/wheelbase no more than its rule's turn, so its
    // wheels point along the circle it drives and never scrub; standing or slow, its full lock)
    const lock = Math.min(S.max, Math.abs(v) > 1e-6 ? Math.atan((wb * cap) / Math.abs(v)) / D : S.max);
    const want = clamp(input.turn || 0, -1, 1) * lock, s = e.steer || 0;
    e.steer = s + clamp(want - s, -rate * dt, rate * dt);
    const yaw = (v * Math.tan(e.steer * D)) / wb;
    return { ...input, turn: clamp(yaw / cap, -1, 1) };
  }
  E.stepWorld = function stepWithSteer(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null;
    let inp = input;
    if (p && input && p.rule && p.rule.steer && p.transformT == null) inp = steered(p, input, dt);
    // (a body out of its steered form lets its wheels straighten)
    else if (p && p.steer) p.steer = 0;
    return step(state, inp, dt, hooks);
  };
}
