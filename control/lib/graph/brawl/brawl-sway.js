/**
 * brawl-sway — what hangs loose on a street's body (long hair below the neck, cloth below the hips: a skirt, a coat's
 * tails, a cape's hem) swung by the air it moves through, as it is drawn. The street's bodies carry no strings (the
 * hero's cloth bake, hero-cloth.js, is the realistic body's and its hair is not baked), so the page bends what hangs
 * about its root: one damped spring a region, driven by the air RELATIVE to the body.
 *
 *   • THE AIR: the wind where the body stands (a gale's, brawl-core.js `gusts`) less the body's own motion, so running
 *     into still air is a headwind and the hair streams back; a body carried on the air (a weather power's) is also
 *     borne up by it, so what hangs on it billows and streams behind as it glides.
 *   • THE HANG: what hangs takes the direction its weight and the air's drag on it set (drag ½ρCdA|a|a over its mass:
 *     one coefficient a region, `drag`), at most `max` from hanging straight down. A turbulent air flutters it, more the
 *     faster the air.
 *   • THE SPRING: the hang eased to by a damped spring (the hair underdamped, so it swings past and back; the cloth
 *     heavier), stepped by the sim's frames, so it holds when the street holds (a super's beat, a pause).
 *   • THE BEND: the hanging part curved about its root at an even curvature, its tip turned the whole angle, so its
 *     length along its hang is kept (a strand never stretches).
 *
 * Frames: the carrier's rest frame, x across, y forward, z up (the figure's). Still air bends nothing: the rest
 * positions come back byte for byte. Render only: nothing here reaches the sim. Pure.
 */

/** the regions: `least` the shortest hang that is loose (m: hair just to the neck, or a trouser's seat below the hip,
 * is not), `drag` the air's pull per (m/s)² against gravity's 9.81, `max` the most bend (rad), the spring's
 * stiffness (1/s²) and damping ratio, the flutter's most (rad) and the air speed it is whole at (m/s) */
export const BRAWL_SWAY = Object.freeze({
  G: 9.81,
  hair: Object.freeze({ least: 0.06, drag: 0.45, max: 1.35, stiff: 70, zeta: 0.32, flutter: 0.16, flutterAt: 12 }),
  cloth: Object.freeze({ least: 0.15, drag: 0.2, max: 1.0, stiff: 45, zeta: 0.45, flutter: 0.1, flutterAt: 14 }),
  // (a body borne on the air: the updraft under it (m/s), the glide's stream behind it, and its billow's flutter (rad))
  float: Object.freeze({ up: 4, back: 1.6, billow: 0.12 }),
  // (the fastest a body's own motion is read, m/s: a body set down elsewhere by a scene is not a gust)
  most: 14,
  // (how far below the neck a lock is long hair, and below the hip a hem is loose cloth, m)
  neck: 0.03,
  hip: 0.06,
});

const hyp = (x, y) => Math.sqrt(x * x + y * y);

/**
 * The air a body's loose parts feel, in the figure's frame (x across, y forward, z up), m/s: the wind less the body's
 * own velocity, both along the belt (`along` its facing's way, `depth` toward the camera's back, `up`), and a floating
 * body's updraft and glide. `face` ±1.
 */
export function swayAir(vel, wind, face, float = false) {
  const ax = (wind[0] - vel[0]) * face, ad = (wind[1] - vel[1]), au = (wind[2] - vel[2]);
  const F = BRAWL_SWAY.float;
  // (figure across: the belt's depth turned by the facing; a floater's glide streams it back as if always under way)
  return [-ad * face, ax - (float ? F.back : 0), au + (float ? F.up : 0)];
}

/** The hang a region takes in an air `a` (its carrier's rest frame): its bend as a turn [about x, about y] (rad) */
export function swayHang(a, P) {
  const s = Math.hypot(a[0], a[1], a[2]);
  const hx = P.drag * s * a[0], hy = P.drag * s * a[1], hz = -BRAWL_SWAY.G + P.drag * s * a[2];
  const h = hyp(hx, hy);
  if (h < 1e-6) return [0, 0];
  // (borne up past its weight it would rise past level: held to the region's most)
  const th = Math.min(P.max, Math.atan2(h, -hz));
  // (bending toward e = (hx, hy) is a turn about (e_y, -e_x))
  return [(th * hy) / h, (-th * hx) / h];
}

/**
 * One region's spring stepped `frames` sim frames toward its hang, with its flutter (`f` the sim's frame, `seed` the
 * body's): `st` { wx, wy, vx, vy } in place. A floater's billow flutters it even in still air.
 */
export function swayStep(st, hang, a, P, frames, f, seed, float = false) {
  const dt = 1 / 60, c = 2 * P.zeta * Math.sqrt(P.stiff);
  const amp = P.flutter * Math.min(1, Math.hypot(a[0], a[1], a[2]) / P.flutterAt) + (float ? BRAWL_SWAY.float.billow : 0);
  for (let k = 0; k < frames; k++) {
    const tt = (f - frames + k + 1) / 60 + seed;
    const tx = hang[0] + amp * Math.sin(tt * 7.3) * 0.6, ty = hang[1] + amp * Math.sin(tt * 9.1 + 1.7);
    st.vx += (P.stiff * (tx - st.wx) - c * st.vx) * dt; st.vy += (P.stiff * (ty - st.wy) - c * st.vy) * dt;
    st.wx += st.vx * dt; st.wy += st.vy * dt;
  }
  const w = hyp(st.wx, st.wy);
  if (w > P.max) { st.wx *= P.max / w; st.wy *= P.max / w; }
  return st;
}

/**
 * A region of a part's rest positions (`pos`, xyz): the vertices `pick(i)` takes that hang below `root` (z), measured
 * from the pivot [x, y] on the root → { idx, u (depth below the root), ox, oy (offset from the hang's axis), L, pivot,
 * rest (its vertices' own rest positions, xyz in its order) },
 * or null when nothing hangs `least` (m) below it.
 */
export function swayRegion(pos, root, pivot, pick = () => true, least = 0.02) {
  const idx = [];
  let L = 0;
  for (let i = 0; i < pos.length / 3; i++) { const u = root - pos[i * 3 + 2]; if (u > 0 && pick(i)) { idx.push(i); if (u > L) L = u; } }
  if (!idx.length || L < least) return null;
  // (its own vertices' rest positions kept with it: a still air writes them back, and nothing else of the part is copied)
  const n = idx.length, u = new Float32Array(n), ox = new Float32Array(n), oy = new Float32Array(n), rest = new Float32Array(n * 3);
  idx.forEach((i, k) => { u[k] = root - pos[i * 3 + 2]; ox[k] = pos[i * 3] - pivot[0]; oy[k] = pos[i * 3 + 1] - pivot[1]; rest.set(pos.subarray ? pos.subarray(i * 3, i * 3 + 3) : pos.slice(i * 3, i * 3 + 3), k * 3); });
  return { idx: Int32Array.from(idx), u, ox, oy, L, pivot: [pivot[0], pivot[1], root], rest };
}

/**
 * The region bent by the turn [wx, wy] (rad) into `out` (xyz, the part's positions): its axis curved at an even curvature
 * from the root, the tip turned the whole angle, each vertex's offset from the axis turned with it. Under a thousandth
 * of a radian ⇒ the rest positions, as they were.
 */
export function swayBend(out, R, wx, wy) {
  const th = hyp(wx, wy), { idx, u, ox, oy, L, pivot, rest } = R;
  if (th < 1e-3) { for (let k = 0; k < idx.length; k++) { const j = idx[k] * 3; out[j] = rest[k * 3]; out[j + 1] = rest[k * 3 + 1]; out[j + 2] = rest[k * 3 + 2]; } return out; }
  const kx = wx / th, ky = wy / th, ex = -ky, ey = kx, r = L / th;
  for (let k = 0; k < idx.length; k++) {
    const j = idx[k] * 3, phi = (th * Math.min(u[k], L)) / L, c = Math.cos(phi), s = Math.sin(phi);
    // the axis at depth u, curved toward e; the offset (in the plane at the root) turned about k by phi
    const bx = ex * (1 - c) * r, by = ey * (1 - c) * r, bz = -s * r;
    const o0 = ox[k], o1 = oy[k], kd = kx * o0 + ky * o1, cz = kx * o1 - ky * o0;
    out[j] = pivot[0] + bx + o0 * c + kx * kd * (1 - c);
    out[j + 1] = pivot[1] + by + o1 * c + ky * kd * (1 - c);
    out[j + 2] = pivot[2] + bz + cz * s;
  }
  return out;
}
