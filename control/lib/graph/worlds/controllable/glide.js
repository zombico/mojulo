/**
 * glide — a body CARRIED (a cue's `glide: { who, to, seconds? | speed?, face? }`, playscape/ui/cast.js): straight lines
 * through the air from point to point, its height with it, each leg eased in and out (smoothstep on the leg's own
 * time): a ship come in over the field, a pod lowered on its cables and set in the ground, a lift. No ground snap, no
 * walls, no gait: it is moved, it does not walk. It holds at the last point (facing `face` there), and says `arrive`
 * at each point as a walk does (the cast's facts read `arrivals`), so a scene's `until: { arrive }` waits for it.
 *
 *   glide { points: [[x, y, z | null]], names?, seconds? | speed?, face? }   (a null z: the body's height as it starts;
 *                         seconds the whole way, else speed m/s, GLIDE.speed)
 *   finish                (a skipped scene) every glide lands at its last point, facing, the arrive fact said
 *   stop                  the glide ends where it is
 *
 * Opt-in (compose.js EMISSION_OPT_IN `glide`): composed into a page only when its events carry a glide, so a page without
 * one keeps every byte. The cast's own ops run first (castOps wrapped); as a body owner just ahead of the cast's (198 <
 * 200) it has the body while it is carried.
 *
 *   e.glide   { points, names, legs: [seconds], i, u, from, face }
 *
 * BUILDER CONTRACT (compose.js): import-free; deterministic (no dice).
 */
export const GLIDE = Object.freeze({ speed: 4 });

export function buildGlide(E) {
  const { registerBodyOwner } = E;
  const DEG = Math.PI / 180, SPEED = 4;
  function step(e, dt) {
    const G = e.glide, t = e.transform;
    G.u += dt;
    while (G.u >= G.legs[G.i]) {
      const p = G.points[G.i];
      G.u -= G.legs[G.i]; t.pos[0] = p[0]; t.pos[1] = p[1]; t.pos[2] = p[2];
      const last = G.i === G.points.length - 1;
      e.arrivals = (e.arrivals || 0) + 1; e.arrivedAt = G.names[G.i]; e.arrivedLast = last;
      if (last) { e.glide = null; e.held = true; if (G.face != null) t.heading = G.face; if (Array.isArray(e.vel)) e.vel = [0, 0, 0]; e.moving = false; return; }
      G.from = p.slice(); G.i++;
    }
    const p = G.points[G.i], f = G.from, k = Math.min(1, G.u / Math.max(1e-6, G.legs[G.i])), s = k * k * (3 - 2 * k);
    for (let j = 0; j < 3; j++) t.pos[j] = f[j] + (p[j] - f[j]) * s;
    if (Array.isArray(e.vel)) e.vel = [0, 0, 0];
    e.moving = false;
  }
  const castOps = E.castOps;
  E.castOps = function (state, ops) {
    for (const o of ops || []) {
      if (o && o.op === 'finish') for (const w of state.entities) if (w.glide) { const G = w.glide; G.i = G.points.length - 1; G.u = G.legs[G.i]; step(w, 0); }
      if (o && o.op === 'stop' && state.byId[o.who]) state.byId[o.who].glide = null;
    }
    castOps(state, (ops || []).filter((o) => !(o && o.op === 'glide')));
    for (const o of ops || []) {
      if (!o || o.op !== 'glide') continue;
      const e = state.byId && state.byId[o.who];
      if (!e || e.isCamera || e.downed || e.gone || !Array.isArray(o.points) || !o.points.length) continue;
      const from = e.transform.pos.slice(0, 3), z0 = from[2];
      const points = o.points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0], p[1], Number.isFinite(p[2]) ? p[2] : z0]);
      if (!points.length) continue;
      const lens = points.map((p, i) => { const q = i ? points[i - 1] : from; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); });
      const sum = lens.reduce((a, b) => a + b, 0);
      const speed = Number.isFinite(o.seconds) && o.seconds > 0 ? Math.max(1e-6, sum) / o.seconds : Number.isFinite(o.speed) && o.speed > 0 ? o.speed : SPEED;
      e.route = null; e.held = false; e.pose = null;
      e.glide = { points, names: points.map((_, i) => (Array.isArray(o.names) && typeof o.names[i] === 'string' ? o.names[i] : String(i))), legs: lens.map((l) => l / speed), i: 0, u: 0, from, face: Number.isFinite(o.face) ? o.face * DEG : null };
    }
  };
  registerBodyOwner('glide', (e, input, dt) => {
    if (!e.glide) return false;
    if (e.gone || e.downed) { e.glide = null; return false; }
    step(e, dt);
    return true;
  }, 198);
}
