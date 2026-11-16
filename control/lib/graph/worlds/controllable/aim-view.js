/**
 * aim-view.js — THE AIM HELD: a third-person body that moves under a free camera and, while its aim is held, stands
 * behind its own shoulder, turns with the look and may fire; from there, its eye. Opt-in on the pilot's rule:
 *
 *   rule.aimView: {
 *     shoulder: { dist, height, shoulder, lookH, lead, lerp?, pitchFollow?, standOff? },   the follow camera held while
 *                                              aiming (gameworld/quick.js SHOULDER's words; `shoulder` metres to the right)
 *     eye?: 1.6,                               the eye's height over the feet (the first-person view's)
 *     hip?: true,                              the trigger fires with the aim down too (absent: only while aiming)
 *   }
 *
 *   input.aim        held: the aim. Rising, the camera's own rule and the body's own way of turning are set aside (as a
 *                    cast's `shot` sets a camera aside, cast.js heldRule); the body faces where the camera looked, turns
 *                    and pitches with the look (the platform rule's `turnMode: 'look'`), and the camera follows it over
 *                    the shoulder. Falling, both are given back, the camera's yaw and pitch where the aim left them.
 *   input.view       an edge, while aiming: to the eye and back (the `eye` rule on the body, `hideTarget`: the page hides
 *                    a body whose camera rides its eye). Letting the aim go leaves the eye too.
 *   input.shoulder   an edge, while aiming over the shoulder: the other shoulder.
 *   input.fire       held off while the aim is down, unless `hip`, or the body has no weapon in hand.
 *
 * Field ownership: e.av ({ on, fp, side, cam, rule, pv, ps }) on the pilot; while the aim is held, state.camera.rule and
 * the pilot's rule (a copy: the body's own is given back untouched).
 *
 * Wraps stepWorld (as gunplay.js does, and before it when both are on: compose.js lists it after), so the pinned
 * pipeline order is untouched. Import-free (the page runs this source via toString(), compose.js); emitted only into a
 * page whose world has a rule with `aimView`, so every other page keeps every byte.
 */
export function buildAimView(E) {
  const step = E.stepWorld;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const over = (A, id, side) => ({ type: 'follow', target: id, ...A.shoulder, shoulder: (A.shoulder.shoulder ?? 0.75) * side });
  const eye = (A, id) => ({ type: 'eye', target: id, height: A.eye ?? 1.6, hideTarget: true });
  E.stepWorld = function stepWithAimView(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, C = state.camera;
    const A = p && p.rule && p.rule.aimView;
    if (!A || !C || !input) return step(state, input, dt, hooks);
    const S = p.av || (p.av = { on: false, fp: false, side: 1, cam: null, rule: null, pv: false, ps: false });
    const want = !!input.aim && !p.downed && !p.gone;
    const view = !!input.view && !S.pv, swap = !!input.shoulder && !S.ps;
    S.pv = !!input.view; S.ps = !!input.shoulder;
    if (want && !S.on) {
      // the aim comes up: the body faces where the camera looked, and turns with the look from here
      S.on = true; S.fp = false; S.cam = C.rule; S.rule = p.rule;
      if (C.camYaw != null) p.transform.heading = C.camYaw;
      p.transform.pitch = clamp(C.camPitch || 0, -1.2, 1.2);
      const { move: _m, ...own } = p.rule;
      p.rule = { ...own, turnMode: 'look', lookPitch: true };
      C.rule = over(A, p.id, S.side);
    } else if (!want && S.on) {
      // the aim goes down: the camera's own rule again, looking where the aim left it; the body's own way of turning
      S.on = false; S.fp = false;
      C.rule = S.cam; p.rule = S.rule; S.cam = null; S.rule = null;
      C.camYaw = p.transform.heading; C.camPitch = clamp(p.transform.pitch || 0, -0.45, 0.7);
      p.transform.pitch = 0;
    } else if (S.on) {
      if (view) { S.fp = !S.fp; C.rule = S.fp ? eye(A, p.id) : over(A, p.id, S.side); }
      else if (swap && !S.fp) { S.side = -S.side; C.rule = over(A, p.id, S.side); }
    }
    // (the trigger is the aim's while a weapon is in hand; with none, it is whatever the body's own blow is)
    return step(state, S.on || A.hip || !p.weapon ? input : { ...input, fire: 0 }, dt, hooks);
  };
}
