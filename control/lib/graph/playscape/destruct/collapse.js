/**
 * collapse — what the pieces do once cut: a timeline per body, pure, seeded and stepped by dt (replay-safe), for the
 * World page or a bench to play and for an engine to replace with its own physics.
 *
 *   DELAY    `delay` seconds whole and still: the cut being drawn (interceptors.js), before anything parts
 *   SPREAD   the dice beat (the `#` lattice opening): every body slides out from the item's centre, its offset scaled
 *            (`scale`, so a grid's gaps open evenly and the item still reads as itself), a seeded `jitter` and
 *            `twist`, eased over `seconds`, then hanging `hold` seconds, the beat before it falls; `offsets` ({ id: [x,y,z] })
 *            moves a body its own way instead (a slice's halves slipping along the cut). `spread: false` skips it.
 *   FALL     `passive`: a nudge and a little spin, then gravity; `explode`: a radial impulse from `origin`, falling
 *            off over `radius`, with spin; `none`: they hang where the spread left them.
 *
 * Bodies are rigid (a chunk or a dismantled group, moving as one), tumble with an inertia from their own vertices,
 * and land with impulses at their lowest corners (restitution, friction), so a block tips off a corner onto a face
 * and comes to rest. They land on the ground and on what still stands (`statics`); they pass through each other,
 * the honest limit of a deterministic stepper (an engine's solver takes over on export).
 *
 *   collapse(bodies, { statics?, ground?, mode?, origin?, power?, radius?, spread?, gravity?, seed?, until?, dt? })
 *     → { tracks: [{ id, frames: [{ t, pos, quat }], rest }], seconds, parting, hits: [{ t, id, speed, mass, at }] }
 *   `hits` are the landings an ear would hear (a contact faster than 0.8 m/s, one per body per 0.12 s); `parting` is
 *   when the spread starts. sounds.js turns both into cues.
 *   pos is where the body's centroid is, quat [x, y, z, w] its turn about it: a point p of the body is at
 *   pos + rotate(quat, p − centroid).
 */
import { vertices, V } from './polytope.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// quaternions [x, y, z, w]
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((x) => x / l); };
const qaxis = (axis, ang) => { const s = Math.sin(ang / 2), u = V.unit(axis); return [u[0] * s, u[1] * s, u[2] * s, Math.cos(ang / 2)]; };
export function rotate(q, v) {
  const u = [q[0], q[1], q[2]], s = q[3], uv = V.cross(u, v), uuv = V.cross(u, uv);
  return V.add(v, V.add(V.mul(uv, 2 * s), V.mul(uuv, 2)));
}
const ease = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
const randUnit = (rnd) => { const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; };

// points across a convex face, about `step` apart (at most 12 a side): a fan of the face's corners, gridded
function faceSamples(pts, step) {
  const out = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[0], b = pts[i], c = pts[i + 1], n = Math.min(12, Math.max(1, Math.ceil(Math.max(V.len(V.sub(b, a)), V.len(V.sub(c, a))) / step)));
    for (let u = 0; u <= n; u++) for (let v = 0; u + v <= n; v++) out.push(V.add(a, V.add(V.mul(V.sub(b, a), u / n), V.mul(V.sub(c, a), v / n))));
  }
  return out;
}

const DEFAULT_SPREAD = { scale: 0.18, jitter: 0.04, twist: 0.12, seconds: 0.6, hold: 0 };

export function collapse(bodies, {
  statics = [], ground = 0, mode = 'passive', origin, power = 8, radius = 3, spread = {}, gravity = 20, seed = 1,
  until = 4, dt = 1 / 120, sample = 1 / 30, restitution = 0.2, friction = 0.6, delay = 0,
} = {}) {
  if (!['passive', 'explode', 'none'].includes(mode)) throw new Error('collapse: mode must be passive, explode or none');
  const rnd = mulberry32(seed >>> 0);
  const all = bodies.map((b) => b.centroid), centre = origin || P(V.mul(all.reduce(V.add, [0, 0, 0]), 1 / Math.max(1, all.length)));
  const S = spread === false ? null : { ...DEFAULT_SPREAD, ...spread };
  // what stands: the boxes around the statics' pieces, as landing tops
  const tops = statics.flatMap((s) => s.pieces.map((p) => { const vs = vertices(p.poly); return { min: [0, 1, 2].map((k) => Math.min(...vs.map((v) => v[k]))), max: [0, 1, 2].map((k) => Math.max(...vs.map((v) => v[k]))) }; }));
  const step = tops.length ? Math.max(0.03, Math.min(...tops.map((t) => Math.min(t.max[0] - t.min[0], t.max[1] - t.min[1]))) / 2) : 0;
  const groundAt = (p) => { let g = ground; for (const b of tops) if (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && b.max[2] <= p[2] + 0.25) g = Math.max(g, b.max[2]); return g; };

  const B = bodies.map((b) => {
    const c0 = b.centroid, corners = b.pieces.flatMap((p) => vertices(p.poly));
    // on the flat ground a convex body touches first at a corner; over what still stands it can land face-on on a
    // post narrower than itself, so with statics the faces are sampled too, at the narrowest standing top's spacing
    const local = (tops.length ? corners.concat(b.pieces.flatMap((p) => p.poly.faces.flatMap((f) => faceSamples(f.pts, step)))) : corners).map((v) => V.sub(v, c0));
    const m = Math.max(1e-4, b.volume), I = m * Math.max(1e-4, corners.map((v) => V.sub(v, c0)).reduce((a, r) => a + V.dot(r, r), 0) / corners.length) * 0.4;
    const off = S && S.offsets && S.offsets[b.id] ? S.offsets[b.id] : V.mul(V.sub(c0, centre), S ? S.scale : 0), jit = S ? V.mul(randUnit(rnd), S.jitter) : [0, 0, 0], twAxis = S ? randUnit(rnd) : [0, 0, 1], twAng = S ? S.twist * (rnd() * 2 - 1) : 0;
    return { id: b.id, c0, local, m, I, off: V.add(off, jit), twAxis, twAng, x: [...c0], v: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0], rest: null, hold: null, frames: [] };
  });

  const record = (b, t) => b.frames.push({ t: r5(t), pos: P(b.x), quat: b.q.map(r5) });
  // the delay: whole and still while the cut is drawn (the slicing interceptors' seconds), then the spread
  if (delay > 0) for (let t = 0; t < delay - 1e-9; t += sample) for (const b of B) record(b, t);
  const t0 = delay + (S ? S.seconds : 0);
  // the spread: hanging, eased out to its offset and twist
  if (S) for (let t = delay; t < t0 - 1e-9; t += sample) for (const b of B) {
    const e = ease((t - delay) / S.seconds);
    b.x = V.add(b.c0, V.mul(b.off, e)); b.q = qaxis(b.twAxis, b.twAng * e);
    record(b, t);
  }
  for (const b of B) { b.x = V.add(b.c0, b.off); b.q = qaxis(b.twAxis, b.twAng); record(b, t0); }
  // the hold: the opened lattice hangs, the beat before it falls
  const hold = S ? S.hold : 0;
  for (let t = t0 + sample; t <= t0 + hold + 1e-9; t += sample) for (const b of B) record(b, t);
  if (mode === 'none') return { tracks: B.map((b) => ({ id: b.id, frames: b.frames, rest: r5(t0) })), seconds: r5(t0 + hold), centre, parting: S ? r5(delay) : null, hits: [] };

  // the throw
  for (const b of B) {
    const d = V.sub(b.x, centre), dist = V.len(d);
    if (mode === 'explode') {
      const fall = 1 / (1 + (dist * dist) / (radius * radius)), dir = V.unit(V.add(dist > 1e-6 ? d : randUnit(rnd), [0, 0, 0.35 * (dist || 1)]));
      b.v = V.mul(dir, power * fall * (0.8 + 0.4 * rnd()));
      b.w = V.mul(randUnit(rnd), (power * fall * (0.5 + rnd())) / Math.max(0.2, Math.sqrt(b.I / b.m) * 3));
    } else {
      b.v = V.mul(dist > 1e-6 ? V.unit([d[0], d[1], 0]) : [0, 0, 0], 0.6 * rnd());
      b.w = V.mul(randUnit(rnd), 1.5 * rnd());
    }
  }
  const n = [0, 0, 1];
  const hits = [];
  let next = t0 + hold + sample;
  for (let t = t0 + hold; t < until + hold; ) {
    t += dt;
    for (const b of B) {
      if (b.rest != null) continue;
      b.v[2] -= gravity * dt;
      b.x = V.add(b.x, V.mul(b.v, dt));
      b.q = qnorm(qmul(qnorm([b.w[0] * dt / 2, b.w[1] * dt / 2, b.w[2] * dt / 2, 1]), b.q));
      let deepest = 0, touching = false;
      for (const r0 of b.local) {
        const r = rotate(b.q, r0), p = V.add(b.x, r), g = groundAt(p), pen = g - p[2];
        if (pen <= 0) continue;
        touching = true; deepest = Math.max(deepest, pen);
        const vc = V.add(b.v, V.cross(b.w, r)), vn = V.dot(vc, n);
        if (vn >= 0) continue;
        const e = -vn < 2 * gravity * dt ? 0 : restitution;
        if (-vn > 0.8 && (b.lastHit == null || t - b.lastHit > 0.12)) { b.lastHit = t; hits.push({ t: r5(t), id: b.id, speed: r5(-vn), mass: r5(b.m), at: P(p) }); }   // a hit the ear hears   // a resting contact does not bounce: no jitter at rest
        const rn = V.cross(r, n), j = (-(1 + e) * vn) / (1 / b.m + V.dot(rn, rn) / b.I);
        b.v = V.add(b.v, V.mul(n, j / b.m)); b.w = V.add(b.w, V.mul(rn, j / b.I));
        const vc2 = V.add(b.v, V.cross(b.w, r)), vt = V.sub(vc2, V.mul(n, V.dot(vc2, n))), st = V.len(vt);
        if (st > 1e-6) {
          const tdir = V.mul(vt, 1 / st), rt = V.cross(r, tdir), jt = Math.min(st / (1 / b.m + V.dot(rt, rt) / b.I), friction * j);
          b.v = V.sub(b.v, V.mul(tdir, jt / b.m)); b.w = V.sub(b.w, V.mul(rt, jt / b.I));
        }
      }
      if (deepest > 0) b.x[2] += deepest * 0.8;
      b.w = V.mul(b.w, touching ? 0.99 : 0.9995);   // rolling resistance in contact: a bar does not rock on its edge for seconds
      // at rest: touching, and it has not drifted a centimetre nor turned two degrees in 0.4 s
      if (!touching || !b.hold || V.len(V.sub(b.x, b.hold.x)) > 0.01 || Math.abs(b.q[0] * b.hold.q[0] + b.q[1] * b.hold.q[1] + b.q[2] * b.hold.q[2] + b.q[3] * b.hold.q[3]) < Math.cos(0.015)) b.hold = { x: [...b.x], q: [...b.q], t };
      else if (t - b.hold.t >= 0.4) { b.rest = t; b.v = [0, 0, 0]; b.w = [0, 0, 0]; b.x = b.hold.x; b.q = b.hold.q; }
    }
    if (t >= next - 1e-9) { for (const b of B) record(b, t); next += sample; }
    if (B.every((b) => b.rest != null)) break;
  }
  return { tracks: B.map((b) => ({ id: b.id, frames: b.frames, rest: b.rest == null ? null : r5(b.rest) })), seconds: r5(Math.max(...B.map((b) => b.frames[b.frames.length - 1].t))), centre, parting: S ? r5(delay) : null, hits };
}
