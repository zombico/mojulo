// SPIKE sakura hero: a cherry flower built from its parts (Prunus × yedoensis 'Somei-yoshino'), the way the
// lignification spike built a tree from its axes. Unit: one petal's length (about 1.5 cm on the tree).
//   · five obovate petals, a narrow claw widening to three quarters of the way out, a notch at the tip; the edge is
//     fractal (midpoint displacement, half as far each level), the blade cupped across and curling at the tip;
//     pale pink at the claw to white at the edge, with faint veins fanning from the claw;
//   · the cup (hypanthium) and five reflexed sepals, red; about thirty stamens (white filaments, yellow anthers) and the
//     pistil; the pedicel, about one and a half petals long, which an umbel's flowers share a spur through.
// The flower opens toward +z; its pedicel runs down −z from the cup to (0, 0, −PEDICEL).
// `depth` is the edge's levels (0–4); `mid` is the flower a few metres off (plain outlines, its stamens one spot);
// `lo` the far flower, five petals of four triangles each.
// → { pos, nrm, col: Float32Array (xyz each), part: Float32Array (1 petal, 0 the rest: the page lights a petal as a
//   thin translucent sheet) }. Deterministic: the seed's mulberry32.
export const PEDICEL = 1.5;

function dice(seed) { let a = seed | 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const half = (t) => Math.max(0.025, 0.4 * Math.pow(t, 0.9) * Math.sqrt(Math.max(0, 1 - t ** 4)));

/** One petal's outline in its own plane (claw at the origin, tip at y ≈ 1), as a closed ring. */
export function petalOutline({ depth = 2, lo = false, mid = false, rnd = dice(1) } = {}) {
  let ring = [];
  if (mid) ring = [[half(0.1), 0.1], [half(0.55), 0.55], [half(0.85), 0.85], [0.1, 0.995], [0, 0.9], [-0.1, 0.995], [-half(0.85), 0.85], [-half(0.55), 0.55], [-half(0.1), 0.1]];
  else if (lo) ring = [[half(0.6), 0.6], [0.12, 0.99], [-0.12, 0.99], [-half(0.6), 0.6]];
  else {
    const N = 12; for (let i = 0; i <= N; i++) { const t = (i / N) * 0.96; ring.push([half(t), t]); }
    ring.push([0.1, 0.995], [0, 0.9], [-0.1, 0.995]);
    for (let i = N; i >= 0; i--) { const t = (i / N) * 0.96; ring.push([-half(t), t]); }
  }
  ring.push(ring[0]);
  let amp = 0.035;
  for (let d = 0; d < (lo || mid ? 0 : depth); d++) {
    const out = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const p = ring[i], q = ring[i + 1], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey) || 1;
      const k = Math.min(1, m[1] / 0.25) * amp * (rnd() * 2 - 1);
      out.push(p, [m[0] + (ey / L) * k, m[1] - (ex / L) * k]);
    }
    out.push(ring[ring.length - 1]); ring = out; amp *= 0.5;
  }
  return ring;
}

const surf = (x, y) => [x, y, 0.55 * x * x + 0.12 * y * y * y];
const surfN = (x, y) => { const n = [-1.1 * x, -0.36 * y * y, 1], l = Math.hypot(...n); return n.map((v) => v / l); };
function petalTone(x, y, pink) {
  const t = Math.min(1, Math.max(0, y)), k = Math.pow(t, 0.55), vein = 0.035 * Math.abs(Math.sin(Math.atan2(x, Math.max(0.05, y)) * 11)) * (1 - k);
  const claw = [0.95, 0.62 + 0.12 * (1 - pink), 0.74 + 0.08 * (1 - pink)], edge = [1, 0.955, 0.965];
  return claw.map((b, i) => b + (edge[i] - b) * k - (i ? vein : 0.3 * vein));
}

export function flowerGeometry({ seed = 1, depth = 2, lo = false, mid = false, single = false, pink = 0.5 } = {}) {
  const rnd = dice(seed); const pos = [], nrm = [], col = [], part = [];
  const tri = (a, b, c, n, cl, pt) => { for (const v of [a, b, c]) { pos.push(...v); nrm.push(...(typeof n === 'function' ? n(v) : n)); col.push(...(typeof cl === 'function' ? cl(v) : cl)); part.push(pt); } };
  const petal = (xf) => {
    const ring = petalOutline({ depth, lo, mid, rnd }); const hub = [0, 0.02];
    const midway = (p) => [hub[0] + 0.5 * (p[0] - hub[0]), hub[1] + 0.5 * (p[1] - hub[1])];
    const V = (p) => { const s = surf(p[0], p[1]), n = surfN(p[0], p[1]); return { p: xf.p(s), n: xf.n(n), c: petalTone(p[0], p[1], pink) }; };
    const emit = (a, b, c) => { const A = V(a), B = V(b), C = V(c); for (const v of [A, B, C]) { pos.push(...v.p); nrm.push(...v.n); col.push(...v.c); part.push(1); } };
    for (let i = 0; i < ring.length - 1; i++) {
      const p = ring[i], q = ring[i + 1];
      if (lo || mid) { emit(hub, p, q); continue; }
      const mp = midway(p), mq = midway(q); emit(hub, mp, mq); emit(mp, p, q); emit(mp, q, mq);
    }
  };
  const ident = { p: (v) => v, n: (v) => v };
  if (single) { petal(ident); return pack(pos, nrm, col, part); }
  // the five petals: each slid out from the centre, tilted up into a shallow cup, turned to its place, a little jitter
  for (let k = 0; k < 5; k++) {
    const th = (k * 2 * Math.PI) / 5 + 0.08 * (rnd() - 0.5), tilt = 0.22 + 0.12 * rnd(), lift = 0.012 * (k % 2), ct = Math.cos(tilt), st = Math.sin(tilt), c = Math.cos(th), s = Math.sin(th);
    const r = (v) => { const y = v[1] * ct - v[2] * st, z = v[1] * st + v[2] * ct; return [v[0] * c - y * s, v[0] * s + y * c, z]; };
    petal({ p: (v) => { const w = r([v[0], v[1] + 0.07, v[2]]); return [w[0], w[1], w[2] + lift]; }, n: r });
  }
  if (lo) return pack(pos, nrm, col, part);
  // the cup: a short cone down to the pedicel, and the sepals turned back under the petals
  const CUP = [0.62, 0.24, 0.3], SEPAL = [0.5, 0.22, 0.24], STALK = [0.46, 0.32, 0.26];
  const sides = lo ? 4 : 6, top = 0.1, bot = 0.035, zc = -0.32;
  for (let j = 0; j < sides; j++) {
    const a0 = (j / sides) * 2 * Math.PI, a1 = ((j + 1) / sides) * 2 * Math.PI, P = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];
    const n = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0.3];
    tri(P(top, a0, 0.01), P(bot, a0, zc), P(bot, a1, zc), n, CUP, 0); tri(P(top, a0, 0.01), P(bot, a1, zc), P(top, a1, 0.01), n, CUP, 0);
  }
  for (let k = 0; k < 5; k++) {
    const a = ((k + 0.5) * 2 * Math.PI) / 5, d = [Math.cos(a), Math.sin(a)], sd = [-d[1] * 0.07, d[0] * 0.07];
    tri([d[0] * 0.09 + sd[0], d[1] * 0.09 + sd[1], -0.02], [d[0] * 0.09 - sd[0], d[1] * 0.09 - sd[1], -0.02], [d[0] * 0.24, d[1] * 0.24, -0.36], [d[0] * 0.4, d[1] * 0.4, -0.8], SEPAL, 0);
  }
  // the pedicel: a thin three-sided stalk
  const pr = 0.022;
  for (let j = 0; j < 3; j++) {
    const a0 = (j / 3) * 2 * Math.PI, a1 = ((j + 1) / 3) * 2 * Math.PI, P = (a, z) => [pr * Math.cos(a), pr * Math.sin(a), z], n = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0];
    tri(P(a0, zc), P(a0, -PEDICEL), P(a1, -PEDICEL), n, STALK, 0); tri(P(a0, zc), P(a1, -PEDICEL), P(a1, zc), n, STALK, 0);
  }
  if (mid) {
    // seen from a few metres the stamens are one spot: the flower's eye, reddening as it ages
    for (let k = 0; k < 6; k++) { const a0 = (k / 6) * 2 * Math.PI, a1 = ((k + 1) / 6) * 2 * Math.PI; tri([0, 0, 0.05], [0.14 * Math.cos(a0), 0.14 * Math.sin(a0), 0.03], [0.14 * Math.cos(a1), 0.14 * Math.sin(a1), 0.03], [0, 0, 1], [0.92, 0.55, 0.5], 0); }
  } else {
    // stamens: filaments fanning out of the cup, each an anther at its tip; the pistil straight up in the middle
    const NS = depth >= 2 ? 30 : 14;
    for (let k = 0; k < NS; k++) {
      const th = (k * 2 * Math.PI) / NS + 0.1 * rnd(), c = Math.cos(th), s = Math.sin(th), r0 = 0.06, r1 = 0.2 + 0.08 * rnd(), h = 0.26 + 0.1 * rnd(), w = 0.008;
      const tip = [r1 * c, r1 * s, h], up = [c * 0.4, s * 0.4, 1];
      tri([r0 * c - s * w, r0 * s + c * w, 0.02], [r0 * c + s * w, r0 * s - c * w, 0.02], tip, up, [0.97, 0.92, 0.9], 0);
      const aw = 0.022, ah = 0.03;
      tri([tip[0] - s * aw, tip[1] + c * aw, tip[2]], [tip[0] + s * aw, tip[1] - c * aw, tip[2]], [tip[0], tip[1], tip[2] + ah], up, [1, 0.84, 0.32], 0);
      tri([tip[0] + s * aw, tip[1] - c * aw, tip[2]], [tip[0] - s * aw, tip[1] + c * aw, tip[2]], [tip[0], tip[1], tip[2] - ah * 0.6], up, [0.95, 0.72, 0.25], 0);
    }
    tri([-0.01, 0, 0.02], [0.01, 0, 0.02], [0, 0, 0.36], [0, -1, 0.2], [0.8, 0.88, 0.55], 0);
    tri([0, -0.01, 0.02], [0, 0.01, 0.02], [0, 0, 0.36], [1, 0, 0.2], [0.8, 0.88, 0.55], 0);
  }
  return pack(pos, nrm, col, part);
}
const pack = (pos, nrm, col, part) => ({ pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), part: new Float32Array(part) });
