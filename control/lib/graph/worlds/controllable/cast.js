/**
 * cast.js — the CAST: what the event bus may do to a character, and what a character tells the bus back.
 *
 *   castOps(state, ops)   apply the bus's queued character intents (event-bus `ctrl` verb, handed over by syncToCtrl),
 *                         in order. Each op is { op, who, … }; an unknown who is a no-op:
 *     spawn { at?, face? }    wake one minted asleep (`dormant`) or sent away: shown, revived, placed where it's told
 *     vanish                  send one away (asleep again: hidden, unhittable, its rule held)
 *     kill                    it falls (`downed`; hp to 0 when it has hp); its rule is held while it lies
 *     hurt { by } / heal { by? }   its body.hp, floored at 0 (a fall) and capped at its hpMax (heal with no by: full)
 *     walk { points, names?, speed?, then?, face?, pose?, reach? }   a DUMB PATH: straight lines from point to point
 *                         (turn toward it, step, ground snap, collider push-out); `then` at the last point: 'stay' (hold
 *                         there, take `face` / `pose`), 'loop', 'back' (walk the points back, then stay)
 *     stop                    end a walk or a hold
 *   castFacts(state, prev) → { events, prev }   edge-detected happenings, as bus events with `entity`:
 *     down · gone · spawned · arrive { at: the point's name, last: 1 | 0, pose? } · stuck
 *     (the first read seeds; nothing a world was minted with fires)
 *
 * A walk is a BODY OWNER (the rule waits while it walks or holds); so is a cast fall. A second of walking that closes
 * less than a sixth of its pace is stuck: the walk drops and `stuck` fires (a solid body in the way, a wall).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; core precedes it in EMISSION. Field ownership:
 * e.route, e.held, e.pose, e.castDown, e.arrivals, e.arrivedAt, e.arrivedLast, e.stucks.
 */

export function buildCast(E) {
  const { TAU, clamp, resolveBlocking, registerBodyOwner } = E;
  const DEG = Math.PI / 180;

  function stepRoute(e, dt, world) {
    const R = e.route, t = e.transform, r = e.rule || {};
    const p = R.points[R.i];
    const dx = p[0] - t.pos[0], dy = p[1] - t.pos[1], d = Math.hypot(dx, dy);
    if (d <= R.reach) {
      const last = R.i === R.points.length - 1;
      e.arrivals = (e.arrivals || 0) + 1; e.arrivedAt = R.names[R.i]; e.arrivedLast = last && R.then !== 'loop' && !(R.then === 'back' && !R.back);
      if (!last) R.i++;
      else if (R.then === 'loop') R.i = 0;
      else if (R.then === 'back' && !R.back) { R.points = R.points.slice().reverse(); R.names = R.names.slice().reverse(); R.back = true; R.i = R.points.length > 1 ? 1 : 0; }
      else {
        e.route = null; e.held = true;
        if (R.face != null) t.heading = R.face;
        e.pose = R.pose || null;
      }
      R.best = Infinity; R.watch = 0;
      e.moving = false;
      return;
    }
    // stuck: a second that closes less than a sixth of the pace (the post-step pushes have already landed)
    R.watch += dt;
    if (d < R.best) { if (R.best - d >= R.speed / 6 || R.best === Infinity) { R.best = d; R.watch = 0; } }
    if (R.watch >= 1) { e.route = null; e.stucks = (e.stucks || 0) + 1; e.moving = false; return; }
    const want = Math.atan2(dy, dx);
    const dh = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    t.heading = (t.heading + clamp(dh, -R.turn * dt, R.turn * dt)) % TAU;
    const stp = Math.min(R.speed * dt, d);
    t.pos[0] += dx / d * stp; t.pos[1] += dy / d * stp;
    const eye = r.eye ?? 0;
    if (world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 1.8, r.collideRadius ?? 0.3, world.colliders, r.step ?? 0.35);
    if (world && world.ground) { const g = world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 1.8)]); if (g != null) t.pos[2] = g + eye; }
    e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + stp / (r.stride ?? 2.4); e.moving = true;
  }

  // the cast holds the body while it walks a path, holds a spot, or lies where it was felled
  registerBodyOwner('cast', (e, input, dt, state, world) => {
    if (e.castDown) { e.moving = false; return true; }
    if (e.route) {
      if (e.downed || e.gone) { e.route = null; return false; }
      if (e.staggerT == null && !e.dropping && !e.climbing) stepRoute(e, dt, world);   // a reel, a drop-in or a climb has the body this frame
      return true;
    }
    return !!e.held;
  }, 200);

  const pt3 = (p, z) => [p[0], p[1], Number.isFinite(p[2]) ? p[2] : z];
  function castOps(state, ops) {
    for (const o of ops || []) {
      const e = o && state.byId[o.who];
      if (!e || e.isCamera) continue;
      if (o.op === 'spawn') {
        e.dormant = false; e.gone = false; e.downed = false; e.castDown = false; e.route = null; e.held = false; e.pose = null;
        if (Number.isFinite(e.hpMax) && e.body) { e.body.hp = e.hpMax; e.body.hittable = true; }
        if (Array.isArray(o.at)) e.transform.pos = pt3(o.at, e.transform.pos[2]);
        if (Number.isFinite(o.face)) e.transform.heading = o.face * DEG;
        if (Array.isArray(e.vel)) e.vel = [0, 0, 0];
      } else if (o.op === 'vanish') {
        e.gone = true; e.dormant = true; e.route = null; e.held = false; e.moving = false;
        if (e.body) e.body.hittable = false;
      } else if (o.op === 'kill' || o.op === 'hurt') {
        if (e.downed || e.gone) continue;
        const hp = e.body && Number.isFinite(e.body.hp);
        if (o.op === 'hurt') { if (!hp) continue; e.body.hp = Math.max(0, e.body.hp - (Number.isFinite(o.by) ? o.by : 1)); if (e.body.hp > 0) continue; }
        if (hp) e.body.hp = 0;
        e.downed = true; e.castDown = true; e.route = null; e.held = false; e.moving = false;
      } else if (o.op === 'heal') {
        if (e.downed || !e.body || !Number.isFinite(e.body.hp)) continue;
        const max = Number.isFinite(e.hpMax) ? e.hpMax : e.body.hp;
        e.body.hp = Math.min(max, Number.isFinite(o.by) ? e.body.hp + o.by : max);
      } else if (o.op === 'walk') {
        if (e.downed || e.gone || !Array.isArray(o.points) || !o.points.length) continue;
        const points = o.points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0], p[1]]);
        if (!points.length) continue;
        const names = points.map((_, i) => (Array.isArray(o.names) && typeof o.names[i] === 'string' ? o.names[i] : String(i)));
        e.held = false; e.pose = null;
        e.route = {
          points, names, i: 0, back: false, best: Infinity, watch: 0,
          speed: Number.isFinite(o.speed) && o.speed > 0 ? o.speed : (e.rule && e.rule.speed) || 2.5,
          turn: Number.isFinite(o.turn) && o.turn > 0 ? o.turn : 8,
          reach: Number.isFinite(o.reach) && o.reach > 0 ? o.reach : 0.3,
          then: o.then === 'loop' || o.then === 'back' ? o.then : 'stay',
          face: Number.isFinite(o.face) ? o.face * DEG : null, pose: typeof o.pose === 'string' ? o.pose : null,
        };
      } else if (o.op === 'stop') { e.route = null; e.held = false; e.moving = false; }
    }
  }

  function castFacts(state, prev) {
    const seed = !prev, next = {}, events = [];
    for (const e of state.entities) {
      if (e.isCamera) continue;
      const cur = { d: !!e.downed, g: !!e.gone, a: e.arrivals || 0, s: e.stucks || 0 };
      next[e.id] = cur;
      const p = !seed && prev[e.id];
      if (!p) continue;
      if (cur.d && !p.d) events.push({ type: 'down', entity: e.id });
      if (cur.g && !p.g) events.push({ type: 'gone', entity: e.id });
      if (!cur.g && p.g) events.push({ type: 'spawned', entity: e.id });
      if (cur.a > p.a) events.push({ type: 'arrive', entity: e.id, at: e.arrivedAt, last: e.arrivedLast ? 1 : 0, ...(e.arrivedLast && e.pose ? { pose: e.pose } : {}) });
      if (cur.s > p.s) events.push({ type: 'stuck', entity: e.id });
    }
    return { events, prev: next };
  }

  Object.assign(E, { castOps, castFacts });
}
