/**
 * head — THE NECK'S TURN AND TILT: the head as the face acting carries it. A head has a CARRIAGE (its base turn, nod
 * and tilt: the listening tilt, the drowsy sink, the wary tucked chin), a slow SWAY, and it FOLLOWS THE EYES: a look
 * within `HEAD.follow.from` degrees of where the head points is the eyes' alone; past it the head takes a share of the
 * rest, starting a moment after the eyes and arriving slower (the head's inertia: a critically damped spring), while the
 * eyes turn back in their orbits to keep the gaze where it was sent; the larger the turn, the quicker (the vestibulo-ocular reflex: the eye-in-head is the
 * gaze less the head). A stir may move the head (a drowsy head sinking and caught); a spoken word's emphasis nods it.
 *
 *   • `headTake`: per frame the head's yaw, pitch and roll (degrees: +yaw the figure's right, +pitch up, +roll the head's
 *     top to the figure's right) from the gaze's target and the carriage, and the eyes' turn in the head that keeps the
 *     gaze; a loop's whole cycles round (the spring run round the loop until it repeats, its seam closed).
 *   • `headBones`: those angles on the body: the neck's joint turned by its share about its root, the head's and the
 *     jaw's turned by the whole and carried round the neck's root; a rig without the neck, the head or the feet's
 *     forward breathes no head (an empty object). Offsets from the rest pose, an additive layer over any body clip.
 * Gaze-head coordination (Freedman; Guitton) and the VOR read as an animator's rule: the eyes lead, the head follows
 * the larger shifts, the eyes counter-roll; tuned on the eyes gate. Pure and deterministic.
 */

/** the head: how it follows the eyes (no part of a look within `from` degrees; past it a `share`, and always whatever
 * would turn the eyes in the head past `eyes` degrees, the orbit's comfortable reach), its spring (rad/s:
 * the head's settling, about a third of a second), its lag behind the eyes (s), its reach (degrees); the neck's share of
 * a turn (the rest the head's on its own joint) */
export const HEAD = Object.freeze({
  follow: Object.freeze({ from: 10, share: 0.6, eyes: 18 }), spring: 13, lag: 0.04,
  reach: Object.freeze({ yaw: 70, pitch: 35, roll: 25 }), neck: 0.4,
  baton: Object.freeze({ pitch: -3, down: 0.12, up: 0.3 }),
});
const AXES = ['yaw', 'pitch', 'roll'];
const clampTo = (v, r) => Math.max(-r, Math.min(r, v));

/**
 * The head over a take: `gaze` the gaze's target per frame ({ yaw: [], pitch: [] }, degrees, where the eyes are sent),
 * `pose(t)` the carriage at a moment ({ yaw, pitch, roll, follow? (× the share), sway? (degrees) }), `pulses` moments the
 * head is moved ([{ t, up, hold, down, yaw?, pitch?, roll? }]), `n` frames at `fps`; `loop` a loop's (whole cycles, its
 * seam closed); `waves` the sway's slow sines per axis ([[ω, φ], …], the caller's dice) → { yaw, pitch, roll, eyes:
 * { yaw, pitch } } (the eyes' turn in the head that keeps the gaze).
 */
export function headTake({ gaze, pose, pulses = [], n, fps, loop = false, waves }) {
  const P = (n - 1) / fps, lagN = Math.round(HEAD.lag * fps), F = HEAD.follow, w = HEAD.spring, dt = 1 / fps;
  const soft = (d) => Math.sign(d) * Math.max(0, Math.abs(d) - F.from);
  const env = (p, t) => { const s = loop ? (((t - p.t) % P) + P) % P : t - p.t; if (s < 0 || s > p.up + p.hold + p.down) return 0; return s < p.up ? s / p.up : s < p.up + p.hold ? 1 : 1 - (s - p.up - p.hold) / p.down; };
  const smooth = (x) => x * x * (3 - 2 * x);
  // (where the head is drawn to at a frame: its carriage, its sway, the stirs and the nods, and a share of the gaze's
  // reach past the eyes' own)
  const target = (i) => {
    const t = (loop ? i % (n - 1) : i) / fps, c = pose(t), j = loop ? (((i - lagN) % (n - 1)) + (n - 1)) % (n - 1) : Math.max(0, i - lagN);
    const out = {};
    for (const ax of AXES) {
      const sway = (c.sway ?? 0) * (waves?.[ax] ?? []).reduce((m, [om, ph]) => m + Math.sin(om * t + ph), 0) / Math.max(1, waves?.[ax]?.length ?? 1);
      const pulse = pulses.reduce((m, p) => m + (p[ax] ?? 0) * smooth(env(p, t)), 0);
      // (no look rolls the head; a turn or a nod takes its share, or what the eyes cannot comfortably reach)
      const d = ax === 'roll' ? 0 : gaze[ax][j] - (c[ax] ?? 0), want = F.share * (c.follow ?? 1) * soft(d), must = Math.sign(d) * Math.max(0, Math.abs(d) - F.eyes);
      const follow = Math.abs(must) > Math.abs(want) ? must : want;
      out[ax] = clampTo((c[ax] ?? 0) + sway + pulse + follow, HEAD.reach[ax]);
    }
    return out;
  };
  // (the spring: critically damped toward the target; a loop run round until it repeats, then its seam closed)
  const head = { yaw: new Array(n), pitch: new Array(n), roll: new Array(n) }, x = target(0), v = { yaw: 0, pitch: 0, roll: 0 };
  const run = (record) => {
    for (let i = 0; i < n; i++) {
      const T = target(i);
      // (the farther the head has to go, the quicker it goes: a head's movements quicken with their size)
      for (const ax of AXES) { const wq = w * Math.min(2.5, 1 + Math.abs(T[ax] - x[ax]) / 15); v[ax] += (wq * wq * (T[ax] - x[ax]) - 2 * wq * v[ax]) * dt; x[ax] += v[ax] * dt; if (record) head[ax][i] = x[ax]; }
    }
  };
  if (loop) { run(false); run(false); }
  run(true);
  if (loop) for (const ax of AXES) { const e = head[ax][0] - head[ax][n - 1]; for (let i = 0; i < n; i++) head[ax][i] += (e * i) / (n - 1); }
  // (the eyes keep the gaze: their turn in the head is the gaze less the head)
  const eyes = { yaw: gaze.yaw.map((g, i) => g - head.yaw[i]), pitch: gaze.pitch.map((g, i) => g - head.pitch[i]) };
  return { ...head, eyes };
}

/**
 * The head's angles on the body: `heads` the rig's joints' rest heads ({ id: [x, y, z] }, the native frame), `head` a
 * take's { yaw, pitch, roll } (degrees per frame) → { id: { r: [qx, qy, qz, qw per frame], d?: [dx, dy, dz per frame] } }:
 * the neck turned by its share about its own root; the head's and the jaw's joints turned by the whole, each carried
 * round the neck's root and the head's.
 */
export function headBones(heads, head) {
  if (!['neck', 'head', 'footL', 'toesL'].every((id) => heads[id])) return {};
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const quat = (axis, deg) => { const h = (deg * Math.PI) / 360, s = Math.sin(h); return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(h)]; };
  const rot = (q, p) => { const u = [q[0], q[1], q[2]], t = cross(u, p).map((c) => 2 * c), c2 = cross(u, t); return [p[0] + q[3] * t[0] + c2[0], p[1] + q[3] * t[1] + c2[1], p[2] + q[3] * t[2] + c2[2]]; };
  // (the head's frame from the rig: up from the neck to the head, forward from the foot to its toes; a turn to the right
  // about −up, a nod up about right, a tilt to the right about forward)
  const up = norm(sub(heads.head, heads.neck)), f0 = sub(heads.toesL, heads.footL), fd = f0[0] * up[0] + f0[1] * up[1] + f0[2] * up[2];
  const fw = norm(sub(f0, up.map((u) => u * fd))), right = cross(fw, up), down = up.map((u) => -u);
  const turn = (yaw, pitch, roll) => qmul(qmul(quat(down, yaw), quat(right, pitch)), quat(fw, roll));
  const N = heads.neck, H = heads.head, carried = ['head', 'jaw'].filter((id) => heads[id]), f = head.yaw.length, out = { neck: { r: new Array(f * 4) } };
  for (const id of carried) out[id] = { r: new Array(f * 4), d: new Array(f * 3) };
  for (let i = 0; i < f; i++) {
    const s = HEAD.neck, qn = turn(head.yaw[i] * s, head.pitch[i] * s, head.roll[i] * s), qh = turn(head.yaw[i] * (1 - s), head.pitch[i] * (1 - s), head.roll[i] * (1 - s)), q = qmul(qn, qh);
    out.neck.r.splice(i * 4, 4, ...qn);
    const H2 = add(N, rot(qn, sub(H, N)));
    for (const id of carried) {
      const P2 = id === 'head' ? H2 : add(H2, rot(q, sub(heads[id], H)));
      out[id].r.splice(i * 4, 4, ...q);
      out[id].d.splice(i * 3, 3, ...sub(P2, heads[id]));
    }
  }
  return out;
}
