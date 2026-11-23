/**
 * takedown.js — THE TAKEDOWN: a watcher that has not seen the body, come up on from behind, is put down in one move.
 * Opt-in on the pilot's rule:
 *
 *   rule.takedown: {
 *     reach?: 1.5,     how near (metres, feet to feet)
 *     behind?: 100,    the arc behind the watcher it is taken from (degrees, all of it: 100 is 50 either side of its back)
 *     aware?: 1.5,     a watcher that saw the body within this many seconds knows it is there: no takedown
 *     dur?: 0.9,       the move's seconds; the watcher goes down `at` of the way through it (0.5)
 *     clip?: '<name>'  what the body plays through it (a clip of its own); absent, its strike's
 *   }
 *
 *   input.act    an edge: where a watcher (a body with a mind, standing, that can be hit) is within `reach`, the body
 *                faces it, stands in the arc behind it and has not been seen by it lately, the takedown: the body is
 *                held through the move and turned onto the watcher, and the watcher goes down (its health spent,
 *                `downed`, struck by the body: a death as any other, so its game's own way of falling plays; with the
 *                pilot's `rule.knockout`, knockout.js, it is knocked out instead: asleep where it falls).
 *                Anywhere else the press is whatever else the action is.
 *   E.takedownTarget(state, body) → the watcher a press would take now, or null (the page's prompt reads it)
 *
 * Field ownership: e.td ({ id, t, dur, done }) while the move runs, e.tdPrev, e.takedowns (how many); the watcher's
 * `body.hp`, `downed`, `lastHitBy` and `takenDown` as it falls.
 *
 * Wraps stepWorld, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a rule with `takedown`, so every other page keeps every byte.
 */
export function buildTakedown(E) {
  const step = E.stepWorld;
  E.takedownTarget = (state, p) => {
    const T = p && p.rule && p.rule.takedown; if (!T || p.downed || p.gone || p.fr || p.dodgeT != null) return null;
    const reach = T.reach ?? 1.5, arc = Math.cos(((T.behind ?? 100) / 2) * Math.PI / 180), now = state.time || 0, q = p.transform.pos;
    let best = null, bd = Infinity;
    for (const e of state.entities) {
      if (e === p || !e.body || !e.body.hittable || e.downed || e.gone || e.dormant || !(e.rule && e.rule.type === 'ai')) continue;
      const dx = e.transform.pos[0] - q[0], dy = e.transform.pos[1] - q[1], d = Math.hypot(dx, dy);
      if (d > reach || d < 1e-6 || Math.abs(e.transform.pos[2] - q[2]) > 1) continue;
      // (the body in the arc behind the watcher: the way from the watcher to the body against the watcher's facing)
      const h = e.transform.heading;
      if (-(Math.cos(h) * -dx + Math.sin(h) * -dy) / d < arc) continue;
      // (and the body turned toward it)
      if ((Math.cos(p.transform.heading) * dx + Math.sin(p.transform.heading) * dy) / d < 0.2) continue;
      if (e.lastSeen && e.lastSeen.id === p.id && now - e.lastSeen.t < (T.aware ?? 1.5)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  E.stepWorld = function stepWithTakedown(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, T = p && p.rule && p.rule.takedown;
    if (!T || !input) return step(state, input, dt, hooks);
    const edge = !!input.act && !p.tdPrev; p.tdPrev = !!input.act;
    if (!p.td && edge) { const tg = E.takedownTarget(state, p); if (tg) p.td = { id: tg.id, t: 0, dur: T.dur ?? 0.9, done: false }; }
    const M = p.td;
    if (!M) return step(state, input, dt, hooks);
    // the move: the body held (nothing it presses is read), turned onto the watcher; the watcher down at its middle
    const tg = state.byId[M.id];
    const out = step(state, { lookDX: input.lookDX, lookDY: input.lookDY }, dt, hooks);
    M.t = Math.min(1, M.t + dt / M.dur);
    if (tg) p.transform.heading = Math.atan2(tg.transform.pos[1] - p.transform.pos[1], tg.transform.pos[0] - p.transform.pos[0]);
    if (!M.done && M.t >= (T.at ?? 0.5)) {
      M.done = true;
      // (with the pilot's knockout, knockout.js: knocked out, asleep where it falls; else its health spent)
      if (tg && !tg.downed && p.rule.knockout && E.knockOut) { E.knockOut(state, tg, p, 'takedown'); tg.takenDown = true; p.takedowns = (p.takedowns || 0) + 1; }
      else if (tg && !tg.downed) { if (tg.body && Number.isFinite(tg.body.hp)) tg.body.hp = 0; tg.downed = true; tg.lastHitBy = p.id; tg.takenDown = true; p.takedowns = (p.takedowns || 0) + 1; }
    }
    p.locomotion = T.clip || p.swingClip || 'swing_neutral'; p.gaitPhase = Math.min(M.t, 0.999); p.moving = true;
    if (M.t >= 1) p.td = null;
    return out;
  };
}
