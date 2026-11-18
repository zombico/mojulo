/**
 * A MINE ON A TRACK — a kart race through a mountain the miners bored (a design language's `parts.mine`,
 * track-language.js: `candy-mine`, a gem mine in a chocolate mountain). Laid from what mojulo already knows of the
 * underground (era/cave.js, era/cavern.js: a passage under rock is lit by what it sees of the day through its mouth and
 * by its own lamps, each by its falloff; a big bore lit as a small one, its lamps scaled by its width), in the track's
 * family, so the rock, the timber and the gems are the track's own:
 *
 *   galleries  stretches of the lap under a hill: a bore whose walls stand past the rail (a ledge between them for the
 *              cart line) and arch over the way, under a lumpy hill of the language's rock that falls to the land at
 *              its flanks; at each end a PORTAL, the hill's rock face round the bore and a timber frame over the way
 *              with a board. A gallery is laid where the way bends gently enough for its walls (never round a hairpin)
 *              and never over the grid; the longest first, then the next
 *   sets       the miners' timber down every gallery: two log posts at the walls and a log cap across, a set every
 *              `every` metres, knees in the corners
 *   lanterns   on the posts, the two walls by turns, a set in two: warm pools down the bore (the cave's torch register,
 *              era/cave.js CAVE_LIGHTS, in its colour and falloff)
 *   gems       clusters of crystals in the walls between the sets, the language's bright colours, glowing (each a small
 *              light of its own colour)
 *   cart line  a narrow-gauge line on the ledge down one side of every gallery and out of the first portal to its yard,
 *              carts parked on it, heaped with gems
 *   yard       outside the first portal on the cart line's side: a headframe (four legs, a platform, a wheel), a heap of
 *              spoil
 *
 * The LIGHT is the cave's: under a gallery a corner sees the day only through the portals (the share falling as it is
 * deeper in, `dark` the least), and its lamps lay their own (mineLight). On the form render the sun's shadow is still
 * cast live by the hill; the light pass dims what the day gives under it and adds what the lamps give, both before the
 * page draws.
 *
 *   planMine(plan, card, { seed }) → { galleries: [{ s0, s1 }], side, keepOut, hw } | null   (in two dimensions, so the
 *     land round the track keeps clear of the hill)
 *   buildMine(planned, plan, card, K) → { faces, colliders, things, light, report }
 *     light   { galleries: [{ s0, s1, stations }], hw, crown, lamps: [{ at, colour, strength, near, reach }], dark,
 *             depth }: what mineLight reads
 *   mineLight(faces, light) → faces: each corner under a gallery dimmed by what it sees of the day and lit by the lamps
 *     (a form face's `cornerLight` and `sunShare`; a baked face's `cornerFills`). Faces out from under every gallery,
 *     and the glowing ones (`mine:glow`), as they were
 *   MINE_GLOW   the glowing faces' group (the gems, the lanterns' glass): their own light, kept from the bake
 *
 * Pure, seeded (mulberry32).
 */
import { mulberry32 } from '../vegetation/grow.js';
import { CAVE_LIGHTS, CRACK, lampScale } from '../era/cave.js';
import { designClass } from './classes.js';
import { chunkyFaces, chunkyLightOf, CHUNKY_LIGHT, CHUNKY_SUN } from './chunky-look.js';
import { FINISHES } from './track-language.js';
import { trackRuns } from './track.js';

export const MINE_GLOW = 'mine:glow';
const r3 = (v) => Math.round(v * 1000) / 1000;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mean = (ps) => ps.reduce((s, p) => [s[0] + p[0] / ps.length, s[1] + p[1] / ps.length, s[2] + p[2] / ps.length], [0, 0, 0]);
function newell(c) {
  let n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  const l = Math.hypot(...n) || 1; return n.map((v) => v / l);
}
// a raw face turned to look along `hint`
function face(corners, hint, M, part) {
  let n = newell(corners);
  if (dot(n, hint) < 0) { corners = corners.slice().reverse(); n = n.map((v) => -v); }
  return { corners: corners.map((p) => p.map(r3)), hex: M.hex, normal: n, gloss: FINISHES[M.finish] ?? 0, part };
}
const matOf = (card, id) => { const M = card.materials[id]; if (!M) throw new Error(`roadway: language '${card.id}' names no material '${id}'`); return M; };

// the way's frame without its bank past the kerb (what stands beyond the rail stands on the runoff's level)
function framer(a, X) {
  const L = a.length, at = (s) => a.at(a.closed ? ((s % L) + L) % L : Math.max(0, Math.min(L, s)));
  const bank = (q, off) => -Math.sign(q.k) * (q.e ?? 0) * Math.max(-X.kerb, Math.min(X.kerb, off));
  return { at, P: (s, off, dz = 0) => { const q = at(s); return [q.x - Math.sin(q.heading) * off, q.y + Math.cos(q.heading) * off, q.z + bank(q, off) + dz]; } };
}

// ── primitives in the chunky drawing: logs, balls, crystals, a wheel ───────────────────────────────────────────────
/** A log from p to q, radius r, `n` sides, capped. */
function logFaces(p, q, r, M, part, n = 7) {
  const d = sub(q, p), l = Math.hypot(...d) || 1, u = d.map((v) => v / l), a = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const x = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]], xl = Math.hypot(...x); const e1 = x.map((v) => v / xl);
  const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
  const ring = (c) => Array.from({ length: n }, (_, k) => { const t = (k / n) * 2 * Math.PI; return [0, 1, 2].map((i) => c[i] + r * (Math.cos(t) * e1[i] + Math.sin(t) * e2[i])); });
  const A = ring(p), B = ring(q), out = [];
  for (let k = 0; k < n; k++) { const quad = [A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]]; out.push(face(quad, sub(mean(quad), mean([p, q])), M, part)); }
  out.push(face(A, u.map((v) => -v), M, part), face(B, u, M, part));
  return out;
}
/** A ball, `seg` round, squashed by `squash` in its height. */
function ballFaces(c, r, M, part, { seg = 8, squash = 1 } = {}) {
  const out = [], F = [-0.8, -0.35, 0.15, 0.6, 0.92];
  const ring = (f) => Array.from({ length: seg }, (_, k) => { const t = (k / seg) * 2 * Math.PI, q = Math.cos(Math.asin(f)); return [c[0] + r * q * Math.cos(t), c[1] + r * q * Math.sin(t), c[2] + r * f * squash]; });
  const L = F.map(ring), top = [c[0], c[1], c[2] + r * squash], bot = [c[0], c[1], c[2] - r * squash];
  for (let i = 0; i < L.length - 1; i++) for (let k = 0; k < seg; k++) { const q = [L[i][k], L[i][(k + 1) % seg], L[i + 1][(k + 1) % seg], L[i + 1][k]]; out.push(face(q, sub(mean(q), c), M, part)); }
  for (let k = 0; k < seg; k++) { const a = [L[L.length - 1][k], L[L.length - 1][(k + 1) % seg], top], b = [L[0][(k + 1) % seg], L[0][k], bot]; out.push(face(a, sub(mean(a), c), M, part), face(b, sub(mean(b), c), M, part)); }
  return out;
}
/** A crystal: a six-sided prism from `p` along `u`, `l` long, `r` across, its tip a point. */
function crystalFaces(p, u, l, r, M) {
  const a = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const x = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]], xl = Math.hypot(...x), e1 = x.map((v) => v / xl);
  const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
  const ring = (c, rr) => Array.from({ length: 6 }, (_, k) => { const t = (k / 6) * 2 * Math.PI; return [0, 1, 2].map((i) => c[i] + rr * (Math.cos(t) * e1[i] + Math.sin(t) * e2[i])); });
  const mid = p.map((v, i) => v + u[i] * l * 0.72), tip = p.map((v, i) => v + u[i] * l), A = ring(p, r * 0.85), B = ring(mid, r), out = [];
  for (let k = 0; k < 6; k++) { const q = [A[k], A[(k + 1) % 6], B[(k + 1) % 6], B[k]]; out.push(face(q, sub(mean(q), mean([p, mid])), M, 'gem')); const t = [B[k], B[(k + 1) % 6], tip]; out.push(face(t, sub(mean(t), mid), M, 'gem')); }
  return out;
}
/** A wheel: a round-sectioned ring of radius R in the plane of e1, e2 about c, `r` thick, and its spokes. */
function wheelFaces(c, e1, e2, R, r, M, part, spokes = 0) {
  const n = 20, m = 6, out = [], axis = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const pt = (i, j) => { const t = (i / n) * 2 * Math.PI, f = (j / m) * 2 * Math.PI, rad = [0, 1, 2].map((k) => Math.cos(t) * e1[k] + Math.sin(t) * e2[k]), w = R + r * Math.cos(f); return [0, 1, 2].map((k) => c[k] + rad[k] * w + axis[k] * r * Math.sin(f)); };
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)], t = ((i + 0.5) / n) * 2 * Math.PI, ctr = [0, 1, 2].map((k) => c[k] + (Math.cos(t) * e1[k] + Math.sin(t) * e2[k]) * R);
    out.push(face(q, sub(mean(q), ctr), M, part));
  }
  for (let k = 0; k < spokes; k++) { const t = (k / spokes) * 2 * Math.PI, d = [0, 1, 2].map((i) => Math.cos(t) * e1[i] + Math.sin(t) * e2[i]); out.push(...logFaces(c, c.map((v, i) => v + d[i] * R), r * 0.55, M, part, 5)); }
  return out;
}
/** A box, its corners from a centre, its three half-axes. */
function boxFaces(c, ax, M, part) {
  const out = [], P = (a, b, d) => [0, 1, 2].map((i) => c[i] + ax[0][i] * a + ax[1][i] * b + ax[2][i] * d);
  for (const [k, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
    const o = [0, 1, 2].filter((i) => i !== k), q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const w = [0, 0, 0]; w[k] = s; w[o[0]] = u; w[o[1]] = v; return P(...w); });
    out.push(face(q, ax[k].map((v) => v * s), M, part));
  }
  return out;
}
/** A cart: a tub widening to its rim, a cream lip, four wheels, heaped with crystals. On the line at `at`, along `t`. */
function cartFaces(card, at, t, rnd, C) {
  const out = [], up = [0, 0, 1], n = [-t[1], t[0], 0], T = [t[0], t[1], 0], body = matOf(card, C.carts.body), rim = matOf(card, C.carts.rim), wheel = matOf(card, C.rock);
  const P = (u, v, z) => [at[0] + T[0] * u + n[0] * v, at[1] + T[1] * u + n[1] * v, at[2] + z];
  const lo = [[-0.7, -0.45], [0.7, -0.45], [0.7, 0.45], [-0.7, 0.45]], hi = [[-0.95, -0.62], [0.95, -0.62], [0.95, 0.62], [-0.95, 0.62]];
  for (let k = 0; k < 4; k++) { const q = [P(...lo[k], 0.45), P(...lo[(k + 1) % 4], 0.45), P(...hi[(k + 1) % 4], 1.25), P(...hi[k], 1.25)]; out.push(face(q, sub(mean(q), P(0, 0, 0.85)), body, 'cart')); }
  out.push(face(lo.map(([u, v]) => P(u, v, 0.45)), [0, 0, -1], body, 'cart'));
  for (let k = 0; k < 4; k++) out.push(...logFaces(P(...hi[k], 1.27), P(...hi[(k + 1) % 4], 1.27), 0.08, rim, 'cart', 5));
  for (const [u, v] of [[-0.45, -0.5], [0.45, -0.5], [-0.45, 0.5], [0.45, 0.5]]) out.push(...logFaces(P(u, v * 1.0, 0.3), P(u, v * 1.25, 0.3), 0.27, wheel, 'cart', 8));
  // (the heap: crystals standing out of the tub's top, the language's bright colours by turns)
  const heap = [];
  for (let k = 0; k < 6; k++) { const M = matOf(card, C.gems.colours[(k + Math.floor(rnd() * 2)) % C.gems.colours.length]), u = (rnd() - 0.5) * 1.1, v = (rnd() - 0.5) * 0.7, d = [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7, 1], l = Math.hypot(...d);
    const dir = d[0] * T[0] + d[1] * n[0], dir2 = d[0] * T[1] + d[1] * n[1]; heap.push(...crystalFaces(P(u, v, 1.0), [dir / l, dir2 / l, d[2] / l], 0.55 + 0.35 * rnd(), 0.17 + 0.06 * rnd(), M)); }
  return { faces: out, glow: heap };
}

// ── the plan ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the galleries go, which side the cart line runs, and what the land keeps clear of. */
export function planMine(plan, card, { seed = 1 } = {}) {
  const C = card?.parts?.mine;
  if (!C) return null;
  const a = plan.alignment, X = plan.X, L = a.length, st = plan.stations, B = C.bore;
  const hw = X.outer + B.ledge, kMax = 1 / (hw * 1.6), R = hw + B.flank;
  // (the grid and the gantry keep the open sky: no gallery within `clearStart` of the line either way)
  const ok = (s) => { const q = a.at(((s % L) + L) % L); return Math.abs(q.k) < kMax; };
  const galleries = [];
  for (const g of C.galleries) {
    for (let len = Math.min(g.most ?? 220, Math.max(g.least ?? 30, g.share * L)); len >= (g.least ?? 30); len *= 0.85) {
      let best = null;
      for (let s0 = C.clearStart; s0 + len <= L - C.clearStart; s0 += 2) {
        const s1 = s0 + len;
        if (galleries.some((q) => s0 < q.s1 + C.apart && s1 > q.s0 - C.apart)) continue;
        let fine = true, bend = 0;
        for (let s = s0 - 6; s <= s1 + 6; s += 2) { if (!ok(s)) { fine = false; break; } bend += Math.abs(a.at(s).k) * 2; }
        // (a gallery that bends is more of a mine than a straight bore: the most bend wins, the earliest on a tie)
        if (fine && (!best || bend > best.bend + 1e-9)) best = { s0, s1, bend };
      }
      if (best) { galleries.push({ s0: r3(best.s0), s1: r3(best.s1) }); break; }
    }
  }
  if (!galleries.length) return null;
  galleries.sort((p, q) => p.s0 - q.s0);
  // the cart line's side: away from the lap's middle (the yard has the land beyond the lap to stand in)
  const xs = st.map((p) => p.x), ys = st.map((p) => p.y), mid = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const yardOf = galleries.reduce((b, g, i) => (g.s1 - g.s0 > galleries[b].s1 - galleries[b].s0 ? i : b), 0), g0 = galleries[yardOf], q0 = a.at(g0.s0), toward = -(mid[0] - q0.x) * Math.sin(q0.heading) + (mid[1] - q0.y) * Math.cos(q0.heading), side = toward > 0 ? -1 : 1;
  const { P } = framer(a, X), keepOut = [];
  for (const g of galleries) for (let s = g.s0; s <= g.s1 + 1e-6; s += 8) { const p = P(s, 0); keepOut.push({ at: [r3(p[0]), r3(p[1])], r: r3(R + 2) }); }
  const yard = P(g0.s0 - C.yard.back, side * (X.outer + C.yard.off));
  keepOut.push({ at: [r3(yard[0]), r3(yard[1])], r: C.yard.r });
  void seed;
  return { galleries, side, yardOf, keepOut, hw: r3(hw), R: r3(R), yard: [r3(yard[0]), r3(yard[1])], ...(C.cavern ? { cavern: planCavern(plan, C, mid, yard) } : {}) };
}

/**
 * THE CAVERN round the whole arena (the card's `mine.cavern`; era/cavern.js's idea, a trail underground under a pretend
 * ceiling, laid round a lap): its outline a ring round the lap's middle, as far out at each bearing as the lap reaches
 * there and a margin, so the track, its hills and its yard stand inside; its skylight over the yard, the one shaft of day.
 */
function planCavern(plan, C, mid, yard) {
  const V = C.cavern, S = V.segs, a = plan.alignment, L = a.length, reach = new Array(S).fill(0);
  const bucket = (x, y) => { const t = Math.atan2(y - mid[1], x - mid[0]); return ((Math.round((t / (2 * Math.PI)) * S) % S) + S) % S; };
  for (let s = 0; s < L; s += 2) { const q = a.at(s), b = bucket(q.x, q.y); reach[b] = Math.max(reach[b], Math.hypot(q.x - mid[0], q.y - mid[1])); }
  { const b = bucket(yard[0], yard[1]); reach[b] = Math.max(reach[b], Math.hypot(yard[0] - mid[0], yard[1] - mid[1])); }
  // (no notch: a bearing reaches as far as its neighbours do, then the ring is eased)
  let r = reach.map((_, j) => Math.max(...[-3, -2, -1, 0, 1, 2, 3].map((d) => reach[(j + d + S) % S])));
  for (let pass = 0; pass < 3; pass++) r = r.map((v, j) => (r[(j + S - 1) % S] + 2 * v + r[(j + 1) % S]) / 4);
  const zs = plan.stations.map((q) => q.z), outline = r.map((v) => v + V.margin), base = zs.reduce((m, v) => m + v, 0) / zs.length;
  // the skylight where the day's sun, coming down through it, falls on the yard (its headframe in the shaft of day),
  // kept inside the ceiling's reach
  const cv0 = { at: mid, outline, base }, sun = CHUNKY_SUN.dir;
  let sky = [...yard];
  for (let k = 0; k < 8; k++) {
    const R0 = ringAt(cv0, sky[0], sky[1]).r, u = Math.min(0.98, Math.hypot(sky[0] - mid[0], sky[1] - mid[1]) / R0), h = ceilingAt(cv0, V, u) - base;
    sky = [yard[0] + (sun[0] / sun[2]) * h, yard[1] + (sun[1] / sun[2]) * h];
    const d = Math.hypot(sky[0] - mid[0], sky[1] - mid[1]), Rk = ringAt(cv0, sky[0], sky[1]).r * 0.88;
    if (d > Rk) sky = [mid[0] + ((sky[0] - mid[0]) * Rk) / d, mid[1] + ((sky[1] - mid[1]) * Rk) / d];
  }
  return { at: mid.map(r3), outline: outline.map(r3), base: r3(base), skylight: { at: sky.map(r3), r: V.skylight.r } };
}
/** A point's bearing round the cavern's middle, as the ring's index and the share between it and the next. */
function ringAt(cv, x, y) { const S = cv.outline.length, t = Math.atan2(y - cv.at[1], x - cv.at[0]), f = ((t / (2 * Math.PI)) * S + S) % S, j = Math.floor(f) % S; return { j, k: f - Math.floor(f), r: cv.outline[j] * (1 - (f - Math.floor(f))) + cv.outline[(j + 1) % S] * (f - Math.floor(f)) }; }
/** The ceiling's height over a point (u: its share of the way out to the wall). */
const ceilingAt = (cv, V, u) => cv.base + V.wall + (V.crown - V.wall) * Math.sqrt(Math.max(0, 1 - u * u));

/** Is a point under (or on) one of the planned galleries' hills? → the gallery, or null. */
export function inMine(planned, plan, p, pad = 0) {
  if (!planned) return null;
  const a = plan.alignment;
  for (const g of planned.galleries) for (let s = g.s0 - 4; s <= g.s1 + 4; s += 2) { const q = a.at(s); if (Math.hypot(q.x - p[0], q.y - p[1]) < planned.R + pad) return g; }
  return null;
}

// ── the build ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function buildMine(planned, plan, card, K) {
  if (!planned) return null;
  const C = card.parts.mine, B = C.bore, a = plan.alignment, X = plan.X, { P, at } = framer(a, X), ground = plan.groundAt;
  const rnd = mulberry32(((plan.course?.seed ?? 1) * 2654435761 ^ 0x3a1e) >>> 0);
  const dust = matOf(card, C.floor), frost = C.frost ? matOf(card, C.frost) : null, rock = matOf(card, C.rock), timber = matOf(card, C.timber), lamp = matOf(card, C.lantern), iron = matOf(card, C.line.rail);
  const way = trackRuns(plan), raw = [], glow = [], colliders = [], things = [], lamps = [], hw = planned.hw, R = planned.R, side = planned.side;
  // the lumps: a few slow waves along the way and round the section, seeded, so the rock is never a tube
  const waves = Array.from({ length: 4 }, () => ({ f: 0.04 + 0.1 * rnd(), g: 1 + Math.floor(rnd() * 4), p: rnd() * 6.283, q: rnd() * 6.283 }));
  const lump = (s, t, amp) => amp * waves.reduce((v, w) => v + Math.sin(s * w.f + w.p) * Math.cos(t * w.g * Math.PI + w.q), 0) / 2;
  const torch = CAVE_LIGHTS.torch, scale = lampScale({ width: 2 * hw });
  const half = [[X.outer, 0.02], [hw, 0.02], [hw + 0.2, B.spring * 0.5], [hw, B.spring], ...Array.from({ length: B.round }, (_, k) => { const th = ((k + 1) / (B.round + 1)) * Math.PI / 2; return [hw * Math.cos(th), B.spring + (B.crown - B.spring) * Math.sin(th)]; })];
  const PROF = [...half, [0, B.crown], ...half.slice().reverse().map(([o, z]) => [-o, z])], N = PROF.length;
  const galleries = [];
  for (const g of planned.galleries) {
    // the section at s, as one run of points from the hill's foot on the left, over its top, to its foot on the right
    // (OUT), and the bore's from the left ledge's foot, up its wall, over the way, down the right (IN): N points each
    // the bore's section, one run of points from the left ledge's foot (by the rail), across the ledge, up its wall to the
    // spring, over the way in an arch, and down the right (PROF: [off, z]); the hill's, as many points from its left foot
    // over its top to its right foot
    // (the hill's face over a portal leans back into it: a point of the hill's section the higher, the further in from
    // the mouth, `lean` metres at its crest, so the hill falls to the mouth as a hillside and is not cut like a loaf)
    const shapeOf = (t) => Math.pow(Math.sin(Math.PI * t), 0.7), lenG = g.s1 - g.s0, leanOf = (t) => Math.min(B.lean, lenG * 0.3) * shapeOf(t);
    // (a point of the hill at s along the gallery and t across it, 0 its left foot, 1 its right; `up` metres over it)
    const HILL = (s0, t, up = 0) => {
      const ln = leanOf(t), s = g.s0 + ln + (s0 - g.s0) * (lenG - 2 * ln) / lenG;
      // (a mountain, not a loaf: it rises toward the gallery's middle and swells and dips along it)
      const u = (s - g.s0) / Math.max(1, g.s1 - g.s0), peak = 1 + B.peak * Math.sin(Math.PI * u) + 0.12 * Math.sin(s * 0.09 + waves[0].p);
      const off = R - 2 * R * t, base = P(s, off), gz = ground(base[0], base[1]) - 0.4, crown = at(s).z + (B.crown + B.cover) * peak;
      const shape = shapeOf(t), z = gz + (crown - gz) * shape + lump(s, t, B.lump * 4) * Math.sin(Math.PI * t);
      return [base[0], base[1], z + up];
    };
    const OUT = (s0) => Array.from({ length: N }, (_, k) => HILL(s0, k / (N - 1)));
    // its FROSTING: a sheet over the crest down to a line that dips and swells along each flank (the two flanks never
    // alike), smooth as the rock is, half a metre over it (the rock's lumps under it)
    const FM = 9, edgeT = (sm, side) => { const thr = 1 - B.frost + 0.08 * Math.sin(sm * 0.21 + waves[side ? 1 : 2].p) + 0.03 * Math.sin(sm * 0.53 + waves[side ? 3 : 0].q); const t = Math.asin(Math.pow(Math.min(0.999, thr), 1 / 0.7)) / Math.PI; return side ? 1 - t : t; };
    const FROST = (s0) => { const tL = edgeT(s0, 0), tR = edgeT(s0, 1); return Array.from({ length: FM }, (_, k) => HILL(s0, tL + ((tR - tL) * k) / (FM - 1), 0.5)); };
    const IN = (s) => PROF.map(([off, z], k) => {
      if (k < 2 || k > N - 3) return P(s, off, z);
      // (the rock's lumps: the wall pushed out, the arch up, never into the way)
      const L0 = Math.max(0, lump(s, k / (N - 1), B.lump)), wall = z <= B.spring + 1e-6;
      return wall ? P(s, off + Math.sign(off) * L0, z) : P(s, off * (1 + L0 / hw), z + L0 * 0.7);
    });
    const len = g.s1 - g.s0, n = Math.max(2, Math.round(len / B.step)), ss = Array.from({ length: n + 1 }, (_, i) => g.s0 + (len * i) / n);
    for (let i = 0; i < n; i++) {
      const A = OUT(ss[i]), Bo = OUT(ss[i + 1]), Ai = IN(ss[i]), Bi = IN(ss[i + 1]), axA = P(ss[i], 0, B.spring), axB = P(ss[i + 1], 0, B.spring);
      for (let k = 0; k < N - 1; k++) {
        const qo = [A[k], A[k + 1], Bo[k + 1], Bo[k]], qi = [Ai[k], Ai[k + 1], Bi[k + 1], Bi[k]], ax = mean([axA, axB]);
        raw.push({ ...face(qo, sub(mean(qo), [ax[0], ax[1], ax[2] - B.spring - 4]), rock, 'hill'), group: 'mine:hill' });
        raw.push(face(qi, sub(ax, mean(qi)), rock, 'bore'));
      }
      const Fa = B.frost ? FROST(ss[i]) : [], Fb = B.frost ? FROST(ss[i + 1]) : [];
      if (B.frost) for (let k = 0; k < FM - 1; k++) raw.push({ ...face([Fa[k], Fa[k + 1], Fb[k + 1], Fb[k]], [0, 0, 1], frost, 'frost'), group: 'mine:hill' });
    }
    // the portals: the hill's face round the bore at each end, looking out of the hill
    for (const [s, out] of [[g.s0, -1], [g.s1, 1]]) {
      const O = OUT(s), I = IN(s), q = at(s), dir = [Math.cos(q.heading) * out, Math.sin(q.heading) * out, 0];
      for (let k = 0; k < N - 1; k++) raw.push(face([O[k], O[k + 1], I[k + 1], I[k]], dir, rock, 'portal'));
      // (its rocks: balls along the face's top edge and at its feet, never two alike)
      for (let k = 1; k < N - 1; k += 2) { const p = O[k], r = 1.1 + 1.2 * rnd(); raw.push(...ballFaces([p[0] + dir[0] * 0.6, p[1] + dir[1] * 0.6, p[2] - r * 0.3], r, rock, 'rock', { squash: 0.8 })); }
      // the portal's frame: two thick posts at the walls, a lintel over them, a board on it
      const Pf = (off, z) => P(s + out * 0.3, off, z), top = B.spring + 0.9;
      for (const sg of [1, -1]) raw.push(...logFaces(Pf(sg * (hw - 0.6), -0.2), Pf(sg * (hw - 0.6), top), 0.48, timber, 'portal-post'));
      raw.push(...logFaces(Pf(hw + 0.2, top), Pf(-hw - 0.2, top), 0.5, timber, 'portal-lintel'));
      const bd = matOf(card, C.board.material), edge = matOf(card, C.board.edge), Pb = (u, z) => P(s + out * 0.8, u, z), bw = C.board.w / 2, bz = top + 0.5;
      raw.push(face([Pb(-bw, bz), Pb(bw, bz), Pb(bw, bz + C.board.h), Pb(-bw, bz + C.board.h)], dir, bd, 'board'));
      raw.push(...logFaces(Pb(-bw, bz + C.board.h), Pb(bw, bz + C.board.h), 0.16, edge, 'board', 6), ...logFaces(Pb(-bw, bz), Pb(bw, bz), 0.16, edge, 'board', 6));
      // (three gems set in the board: the mine's sign)
      for (let k = 0; k < 3; k++) glow.push(...crystalFaces(Pb((k - 1) * bw * 0.55, bz + C.board.h / 2), dir, 0.5, 0.3, matOf(card, C.gems.colours[k % C.gems.colours.length])));
      // a lantern either side of the mouth
      for (const sg of [1, -1]) { const c = Pf(sg * (hw - 0.1), B.spring - 0.2); glow.push(...ballFaces(c, 0.34, lamp, 'lantern')); raw.push(...ballFaces([c[0], c[1], c[2] + 0.38], 0.2, rock, 'lantern-cap', { squash: 0.6 })); lamps.push({ at: c, colour: torch.colour, strength: torch.strength, near: torch.near * scale, reach: torch.reach * scale }); }
      things.push({ kind: 'portal', interest: 'focus', at: Pf(0, top), span: 2 * hw, top: Pf(0, top + C.board.h + 1)[2] });
    }
    // the hill's boulders: rocks half sunk in its flanks, never two alike
    for (let s = g.s0 + 6; s < g.s1 - 4; s += B.boulders * (0.7 + 0.6 * rnd())) {
      const O = OUT(s), k = 1 + Math.floor(rnd() * (N / 2 - 3)), p = O[rnd() < 0.5 ? k : N - 1 - k], r = 1.3 + 1.8 * rnd();
      raw.push(...ballFaces([p[0], p[1], p[2] - r * 0.25], r, rock, 'boulder', { squash: 0.75 }));
    }
    // the floor under the hill: the runoff and the ledge in the rock's own dust, laid over the verge
    for (let i = 0; i < n; i++) for (const sg of [1, -1]) {
      const A0 = ss[i], B0 = ss[i + 1], sm = (A0 + B0) / 2, from = way.straights.some((r) => sm >= r.s0 && sm <= r.s1) ? X.road + 0.45 : X.kerb + 0.05;
      const q = [P(A0, sg * from, 0.05), P(B0, sg * from, 0.05), P(B0, sg * (X.runoff - 0.05), 0.05), P(A0, sg * (X.runoff - 0.05), 0.05)];
      raw.push(face(q, [0, 0, 1], dust, 'floor'));
    }
    // the sets: posts at the walls, a cap across, knees; a lantern on a post, the walls by turns, a set in two
    let k = 0;
    for (let s = g.s0 + C.sets.every; s < g.s1 - C.sets.every / 2; s += C.sets.every, k++) {
      const z = B.spring - 0.1, w = hw - 0.5;
      for (const sg of [1, -1]) raw.push(...logFaces(P(s, sg * w, -0.2), P(s, sg * w, z), C.sets.r, timber, 'set-post'));
      raw.push(...logFaces(P(s, w + 0.3, z), P(s, -w - 0.3, z), C.sets.r, timber, 'set-cap'));
      for (const sg of [1, -1]) raw.push(...logFaces(P(s, sg * w, z - 1.1), P(s, sg * (w - 1.1), z), C.sets.r * 0.6, timber, 'set-knee', 5));
      if (k % 2 === 0) for (const sg of [1, -1]) {
        // (a pair hung from the cap over the kerbs: their pools on the way, clear of the kart's line)
        const c = P(s, sg * C.lanterns.off, z - C.lanterns.drop);
        raw.push(...logFaces(P(s, sg * C.lanterns.off, z), [c[0], c[1], c[2] + C.lanterns.r], 0.05, rock, 'chain', 4));
        glow.push(...ballFaces(c, C.lanterns.r, lamp, 'lantern'));
        raw.push(...ballFaces([c[0], c[1], c[2] + C.lanterns.r * 1.05], C.lanterns.r * 0.6, rock, 'lantern-cap', { squash: 0.6 }));
        lamps.push({ at: c, colour: torch.colour, strength: torch.strength * C.lanterns.gain, near: torch.near * scale, reach: torch.reach * scale });
      }
      // the gems: a cluster in the wall between this set and the next, on one wall or the other, the colours by turns
      if (rnd() < C.gems.share) {
        const sg = rnd() < 0.5 ? 1 : -1, sm = s + C.sets.every / 2, zc = 1.2 + 2.2 * rnd(), base = P(sm, sg * (hw + 0.2), zc), M = matOf(card, C.gems.colours[k % C.gems.colours.length]);
        const inward = P(sm, sg * (hw - 1), zc), d0 = sub(inward, base), dl = Math.hypot(...d0), u0 = d0.map((v) => v / dl);
        for (let j = 0; j < 5; j++) { const d = [u0[0] + (rnd() - 0.5) * 0.9, u0[1] + (rnd() - 0.5) * 0.9, u0[2] + 0.3 + (rnd() - 0.4) * 0.9], l = Math.hypot(...d); glow.push(...crystalFaces(base, d.map((v) => v / l), C.gems.size * (0.7 + 0.6 * rnd()), C.gems.size * (0.2 + 0.1 * rnd()), M)); }
        const rgb = [1, 3, 5].map((i) => parseInt(M.hex.slice(i, i + 2), 16) / 255), pk = Math.max(...rgb);
        lamps.push({ at: P(sm, sg * (hw - 0.8), zc + 0.4), colour: rgb.map((v) => r3(v / pk)), strength: C.gems.glow, near: 1.4, reach: 7 });
      }
    }
    galleries.push({ s0: g.s0, s1: g.s1 });
  }
  // the cart line: down the ledge on its side through every gallery, and out of the first portal to the yard
  const Ln = C.line, g0 = planned.galleries[planned.yardOf], railAt = side * (X.outer + B.ledge * 0.5), runs = planned.galleries.map((g, i) => [i === planned.yardOf ? g.s0 - C.yard.back - 6 : g.s0 - 4, g.s1 + 4]);
  const sleeper = matOf(card, C.timber);
  for (const [s0, s1] of runs) {
    for (let s = s0; s < s1; s += 2) {
      const sB = Math.min(s1, s + 2);
      for (const g of [-1, 1]) raw.push(...logFaces(P(s, railAt + g * Ln.gauge / 2, 0.2), P(sB, railAt + g * Ln.gauge / 2, 0.2), 0.06, iron, 'cart-rail', 5));
      const q = at(s + 1), t = [Math.cos(q.heading), Math.sin(q.heading), 0], n = [-t[1], t[0], 0];
      raw.push(...boxFaces(P(s + 1, railAt, 0.08), [t.map((v) => v * 0.16), n.map((v) => v * (Ln.gauge / 2 + 0.3)), [0, 0, 0.08]], sleeper, 'sleeper'));
    }
  }
  // the carts: two at the yard, and down the galleries a few, parked on the line
  const cartAt = [g0.s0 - C.yard.back + 2, g0.s0 - C.yard.back - 1.2, ...planned.galleries.flatMap((g) => Array.from({ length: C.carts.inside }, (_, i) => g.s0 + ((i + 1) * (g.s1 - g.s0)) / (C.carts.inside + 1)))];
  for (const s of cartAt) { const q = at(s), c = cartFaces(card, P(s, railAt, 0.12), [Math.cos(q.heading), Math.sin(q.heading)], rnd, C); raw.push(...c.faces); glow.push(...c.glow); }
  // the yard: a headframe over a shaft, its wheel at the top; a heap of spoil beside it
  const Y = planned.yard, gy = ground(Y[0], Y[1]), q0 = at(g0.s0 - C.yard.back), t0 = [Math.cos(q0.heading), Math.sin(q0.heading), 0], n0 = [-t0[1] * side, t0[0] * side, 0];
  const H = C.yard.headframe, foot = (u, v) => [Y[0] + t0[0] * u + n0[0] * v, Y[1] + t0[1] * u + n0[1] * v, gy - 0.2], head = (u, v) => [Y[0] + t0[0] * u * 0.45 + n0[0] * v * 0.45, Y[1] + t0[1] * u * 0.45 + n0[1] * v * 0.45, gy + H];
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [u * 3, v * 3]);
  for (const [u, v] of legs) raw.push(...logFaces(foot(u, v), head(u, v), 0.34, timber, 'headframe'));
  for (const h of [0.35, 0.68]) for (let k = 0; k < 4; k++) { const [u0, v0] = legs[k], [u1, v1] = legs[(k + 1) % 4], f = 1 - 0.55 * h, A = [Y[0] + (t0[0] * u0 + n0[0] * v0) * f, Y[1] + (t0[1] * u0 + n0[1] * v0) * f, gy + H * h], Bq = [Y[0] + (t0[0] * u1 + n0[0] * v1) * f, Y[1] + (t0[1] * u1 + n0[1] * v1) * f, gy + H * h]; raw.push(...logFaces(A, Bq, 0.22, timber, 'headframe', 6)); }
  raw.push(...boxFaces([Y[0], Y[1], gy + H + 0.15], [t0.map((v) => v * 1.8), n0.map((v) => v * 1.8), [0, 0, 0.15]], timber, 'headframe'));
  const wc = [Y[0], Y[1], gy + H + C.yard.wheel + 0.4];
  raw.push(...wheelFaces(wc, n0, [0, 0, 1], C.yard.wheel, 0.18, matOf(card, C.yard.wheelMaterial), 'wheel', 6), ...ballFaces(wc, 0.4, lamp, 'axle'));
  raw.push(...logFaces([wc[0] + n0[0] * C.yard.wheel, wc[1] + n0[1] * C.yard.wheel, wc[2]], [wc[0] + n0[0] * C.yard.wheel, wc[1] + n0[1] * C.yard.wheel, gy + 0.6], 0.05, iron, 'cable', 4));
  for (const [u, v] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) raw.push(...logFaces([wc[0] + t0[0] * u * 0.2, wc[1] + t0[1] * u * 0.2, gy + H + 0.3], [wc[0] + t0[0] * u * 0.2 + n0[0] * v * 0.1, wc[1] + t0[1] * u * 0.2 + n0[1] * v * 0.1, wc[2]], 0.15, timber, 'headframe', 5));
  colliders.push({ min: [r3(Y[0] - 3.4), r3(Y[1] - 3.4), r3(gy)], max: [r3(Y[0] + 3.4), r3(Y[1] + 3.4), r3(gy + H)], of: 'mine:headframe' });
  things.push({ kind: 'headframe', interest: 'landmark', at: [Y[0], Y[1], gy + H / 2], span: 6, top: gy + H + 2 * C.yard.wheel, landmark: true });
  // (the spoil: a heap of rock balls beyond the headframe, the biggest at its heart)
  const sp = [Y[0] + t0[0] * 9 + n0[0] * 3, Y[1] + t0[1] * 9 + n0[1] * 3];
  for (let k = 0; k < 7; k++) { const t = rnd() * 6.283, d = k ? 1.2 + 2.6 * rnd() : 0, r = k ? 1 + 1.2 * rnd() : 2.6, c = [sp[0] + Math.cos(t) * d, sp[1] + Math.sin(t) * d]; raw.push(...ballFaces([c[0], c[1], ground(c[0], c[1]) + r * 0.3], r, rock, 'spoil', { squash: 0.7 })); }
  // THE CAVERN: its walls and its ceiling round the whole arena, stalactites from the ceiling and stalagmites off the
  // way, lantern posts down the lap, crystal clusters glowing on its floor; a shaft of day through its skylight
  const cv = planned.cavern, V = C.cavern;
  let caveLight = null;
  if (cv) {
    const S = cv.outline.length, RG = V.rings, cw = Array.from({ length: 6 }, () => ({ g: 2 + Math.floor(rnd() * 5), f: 0.4 + rnd() * 0.8, p: rnd() * 6.283, q: rnd() * 6.283 }));
    const bump = (t, h) => cw.reduce((v, w) => v + Math.sin(t * w.g + w.p) * Math.cos(h * w.f + w.q), 0) / 3;
    const ring = (j) => { const t = (j / S) * 2 * Math.PI; return [Math.cos(t), Math.sin(t), t]; };
    const sky = cv.skylight, hole = (x, y) => Math.hypot(x - sky.at[0], y - sky.at[1]) < sky.r;
    // the wall: from under the floor up to the ceiling's rim, bulging out at its middle, lumpy
    const WH = [-1.5, V.wall * 0.3, V.wall * 0.65, V.wall], OUT = [0, 1.8, 1.2, 0];
    const wallPt = (j, k) => { const [cx, cy, t] = ring(j), rr = cv.outline[j] + OUT[k] + V.lump * bump(t, k), x = cv.at[0] + cx * rr, y = cv.at[1] + cy * rr; return [x, y, k === 0 ? ground(x, y) - 1.5 : cv.base + WH[k] + V.lump * 0.4 * bump(t + 1, k)]; };
    const ceilPt = (j, i) => { const [cx, cy, t] = ring(j), u = 1 - i / RG, rr = cv.outline[j] * u + (i === 0 ? V.lump * bump(t, 3) : 0), x = cv.at[0] + cx * rr, y = cv.at[1] + cy * rr; return [x, y, ceilingAt(cv, V, u) - (i > 0 && i < RG ? V.lump * Math.abs(bump(t * 1.7, i)) : 0)]; };
    for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S;
      for (let k = 0; k < WH.length - 1; k++) { const q = [wallPt(j, k), wallPt(j1, k), wallPt(j1, k + 1), wallPt(j, k + 1)], m = mean(q); raw.push(face(q, [cv.at[0] - m[0], cv.at[1] - m[1], 0], rock, 'cave-wall')); }
      // (the wall's top meets the ceiling's rim)
      { const q = [wallPt(j, 3), wallPt(j1, 3), ceilPt(j1, 0), ceilPt(j, 0)], m = mean(q); raw.push(face(q, [cv.at[0] - m[0], cv.at[1] - m[1], -1], rock, 'cave-ceiling')); }
      for (let i = 0; i < RG; i++) {
        const q = i === RG - 1 ? [ceilPt(j, i), ceilPt(j1, i), ceilPt(j, RG)] : [ceilPt(j, i), ceilPt(j1, i), ceilPt(j1, i + 1), ceilPt(j, i + 1)], m = mean(q);
        if (hole(m[0], m[1])) continue;
        raw.push(face(q, [0, 0, -1], rock, 'cave-ceiling'));
      }
    }
    // the skylight's rim: rocks round the hole, and the sky's light down it
    const uSky = Math.min(0.98, Math.hypot(sky.at[0] - cv.at[0], sky.at[1] - cv.at[1]) / ringAt(cv, sky.at[0], sky.at[1]).r), top = ceilingAt(cv, V, uSky);
    for (let k = 0; k < 9; k++) { const t = (k / 9) * 2 * Math.PI + rnd() * 0.4, rr = sky.r * (1.05 + 0.2 * rnd()), b = 1.6 + 1.4 * rnd(); raw.push(...ballFaces([sky.at[0] + Math.cos(t) * rr, sky.at[1] + Math.sin(t) * rr, top - b * 0.3], b, rock, 'skylight-rim', { squash: 0.7 })); }
    lamps.push({ at: [sky.at[0], sky.at[1], top - 1], colour: CRACK.colour, strength: V.skylight.strength ?? 2.4, near: sky.r, reach: sky.r * 7 });
    // the lap's line, sampled: what the cave's things keep clear of
    const lap = Array.from({ length: Math.ceil(a.length / 3) }, (_, i) => a.at(i * 3)), clearOfWay = (x, y, pad) => lap.every((q) => Math.hypot(q.x - x, q.y - y) > X.outer + pad) && !(planned.keepOut ?? []).some((d) => Math.hypot(d.at[0] - x, d.at[1] - y) < d.r);
    const inside = (u, t) => { const j = Math.floor((((t / (2 * Math.PI)) * S) % S + S) % S); return [cv.at[0] + Math.cos(t) * cv.outline[j] * u, cv.at[1] + Math.sin(t) * cv.outline[j] * u]; };
    // stalactites: cones hanging from the ceiling, never in the skylight
    for (let n = 0; n < V.stalactites; n++) {
      const u = 0.15 + 0.8 * rnd(), t = rnd() * 2 * Math.PI, [x, y] = inside(u, t), z = ceilingAt(cv, V, u), l = 3 + 7 * rnd() * (1 - 0.4 * u);
      if (hole(x, y) || Math.hypot(x - sky.at[0], y - sky.at[1]) < sky.r + 4) continue;
      raw.push(...crystalFaces([x, y, z + 0.5], [0, 0, -1], l, 0.6 + l * 0.13, rock).map((f) => ({ ...f, part: 'stalactite' })));
    }
    // stalagmites: cones from the floor, off the way and the hills
    for (let n = 0, made = 0; n < V.stalagmites * 3 && made < V.stalagmites; n++) {
      const u = 0.1 + 0.88 * rnd(), t = rnd() * 2 * Math.PI, [x, y] = inside(u, t), h = 2 + 5 * rnd(), r = 0.7 + h * 0.18;
      if (!clearOfWay(x, y, 3 + r)) continue;
      raw.push(...crystalFaces([x, y, ground(x, y) - 0.3], [0, 0, 1], h, r, rock).map((f) => ({ ...f, part: 'stalagmite' }))); made++;
    }
    // lantern posts down the lap, the two sides by turns, but in a gallery (it has its own)
    let side2 = 1;
    for (let s = V.posts.every / 2; s < a.length; s += V.posts.every) {
      if (planned.galleries.some((g) => s > g.s0 - 6 && s < g.s1 + 6)) continue;
      side2 = -side2;
      const foot = P(s, side2 * (X.outer + 1.4), -0.2), headP = P(s, side2 * (X.outer + 1.4), V.posts.h), armP = P(s, side2 * (X.outer + 1.4 - V.posts.arm), V.posts.h - 0.2);
      raw.push(...logFaces(foot, headP, 0.22, timber, 'post'), ...logFaces([headP[0], headP[1], headP[2] - 0.2], armP, 0.13, timber, 'post', 6));
      const c = [armP[0], armP[1], armP[2] - 0.9];
      raw.push(...logFaces(armP, [c[0], c[1], c[2] + 0.4], 0.05, rock, 'chain', 4));
      glow.push(...ballFaces(c, 0.45, lamp, 'lantern'));
      raw.push(...ballFaces([c[0], c[1], c[2] + 0.47], 0.27, rock, 'lantern-cap', { squash: 0.6 }));
      lamps.push({ at: c, colour: torch.colour, strength: torch.strength * (V.posts.gain ?? C.lanterns.gain), near: torch.near * scale, reach: torch.reach * scale });
    }
    // crystal clusters glowing on the floor: by the walls, and some near the way, the colours by turns
    for (let n = 0, made = 0; n < V.crystals.count * 3 && made < V.crystals.count; n++) {
      const near = n % 3 === 0, u = near ? 0.3 + 0.6 * rnd() : 0.8 + 0.17 * rnd(), t = rnd() * 2 * Math.PI, [x, y] = inside(u, t);
      if (!clearOfWay(x, y, 4) || hole(x, y)) continue;
      const M = matOf(card, C.gems.colours[made % C.gems.colours.length]), base = [x, y, ground(x, y) - 0.2], sz = V.crystals.size * (0.6 + 0.6 * rnd());
      for (let k = 0; k < 6; k++) { const d = [(rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2, 1], l = Math.hypot(...d); glow.push(...crystalFaces(base.map((v, i) => v + (i < 2 ? (rnd() - 0.5) * sz * 0.5 : 0)), d.map((v) => v / l), sz * (0.5 + 0.7 * rnd()), sz * 0.16, M)); }
      const rgb = [1, 3, 5].map((i) => parseInt(M.hex.slice(i, i + 2), 16) / 255), pk = Math.max(...rgb);
      lamps.push({ at: [x, y, base[2] + sz * 0.8], colour: rgb.map((v) => r3(v / pk)), strength: V.crystals.glow, near: 3 + 1.5 * sz, reach: 22 + 4 * sz });
      made++;
    }
    caveLight = { at: cv.at, outline: cv.outline, base: cv.base, wall: V.wall, crown: V.crown, lump: V.lump, dark: V.dark, skylight: { at: sky.at, r: sky.r, top: r3(top) } };
  }
  // drawn: the rock, the timber and the line under the kit's chunky light; the glowing things their own light
  const light = chunkyLightOf(K), hill = raw.filter((f) => f.group === 'mine:hill'), rest = raw.filter((f) => f.group !== 'mine:hill');
  const faces = [...chunkyFaces(hill, { light }).map((f) => ({ ...f, group: 'mine:hill' })), ...chunkyFaces(rest, { light }), ...chunkyFaces(glow, { light: CHUNKY_LIGHT }).map((f) => ({ ...f, group: MINE_GLOW }))];
  const st = (g) => Array.from({ length: Math.round(g.s1 - g.s0) + 9 }, (_, i) => { const s = g.s0 - 4 + i, q = at(s); return [r3(s), r3(q.x), r3(q.y), r3(q.z), r3(q.heading)]; });
  return {
    faces, colliders, things,
    light: { galleries: galleries.map((g) => ({ ...g, stations: st(g) })), hw, crown: B.crown, lamps: lamps.map((l) => ({ ...l, at: l.at.map(r3) })), dark: C.dark, depth: C.depth, ...(caveLight ? { cavern: caveLight } : {}) },
    report: { galleries: galleries.map((g) => ({ s0: g.s0, s1: g.s1, length: r3(g.s1 - g.s0) })), side, lamps: lamps.length, carts: cartAt.length, sets: Math.floor(galleries.reduce((n, g) => n + (g.s1 - g.s0), 0) / C.sets.every), class: designClass(plan.course.class) ? plan.course.class : null },
  };
}

// ── the light under the hill ───────────────────────────────────────────────────────────────────────────────────────
const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Where a point is in a gallery: { day, under } (day: the share of the day it sees through the portals), or null. */
function underOf(light, p) {
  for (const g of light.galleries) {
    let best = null, bd = Infinity;
    for (const q of g.stations) { const d = (q[1] - p[0]) ** 2 + (q[2] - p[1]) ** 2; if (d < bd) { bd = d; best = q; } }
    if (!best || bd > (light.hw + 2) ** 2) continue;
    const [s, x, y, z, h] = best, off = -(p[0] - x) * Math.sin(h) + (p[1] - y) * Math.cos(h);
    if (s < g.s0 || s > g.s1 || Math.abs(off) > light.hw + 1.4 || p[2] - z > light.crown + 0.8) continue;
    const deep = Math.min(s - g.s0, g.s1 - s);
    return { day: light.dark + (1 - light.dark) * Math.exp(-deep / light.depth) };
  }
  return null;
}
function lampsAt(light, p, n) {
  const out = [0, 0, 0];
  for (const l of light.lamps) {
    const d = sub(l.at, p), r = Math.hypot(...d);
    if (r > l.reach || r < 1e-6) continue;
    const cos = dot(n, d) / r;
    if (cos <= 0) continue;
    // (the cave's falloff, era/cave.js lampLight: near its full strength, gone by its reach)
    const e = l.strength * cos / (1 + (r / l.near) ** 2) * (1 - smooth(l.reach * 0.7, l.reach, r));
    for (let c = 0; c < 3; c++) out[c] += e * l.colour[c];
  }
  return out;
}
/** In the cavern: { sky, sun } the shares of the day's sky and its sun a point gets (the sky the cave's dark, the sun only
 *  down the skylight's shaft), or null out of it. */
function caveOf(light, p) {
  const cv = light.cavern;
  if (!cv) return null;
  const R = ringAt(cv, p[0], p[1]), d = Math.hypot(p[0] - cv.at[0], p[1] - cv.at[1]);
  if (d > R.r + 2 * cv.lump + 2.5 || p[2] > cv.base + cv.crown + 2) return null;
  const sun = CHUNKY_SUN.dir, K = cv.skylight;
  let shaft = 0;
  if (sun[2] > 0 && p[2] < K.top) { const t = (K.top - p[2]) / sun[2], q = [p[0] + sun[0] * t, p[1] + sun[1] * t], e = Math.hypot(q[0] - K.at[0], q[1] - K.at[1]); shaft = 1 - smooth(K.r * 0.6, K.r, e); }
  return { sky: cv.dark, sun: shaft };
}
export function mineLight(faces, light) {
  if (!light || !light.galleries?.length) return faces;
  const cv = light.cavern;
  const xs = cv ? cv.outline.map((r, j) => cv.at[0] + Math.cos((j / cv.outline.length) * 2 * Math.PI) * r) : light.galleries.flatMap((g) => g.stations.map((q) => q[1]));
  const ys = cv ? cv.outline.map((r, j) => cv.at[1] + Math.sin((j / cv.outline.length) * 2 * Math.PI) * r) : light.galleries.flatMap((g) => g.stations.map((q) => q[2]));
  const pad = cv ? 3 * cv.lump + 4 : light.hw + 2;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('')}`, rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return faces.map((f) => {
    if (!f || !Array.isArray(f.corners) || f.group === MINE_GLOW || f.group === 'mine:hill' || f.group === 'track:cloud') return f;
    if (!f.corners.some((p) => p[0] > box[0] && p[0] < box[2] && p[1] > box[1] && p[1] < box[3])) return f;
    // (each corner's shares of the day: a gallery's by its depth, the cavern's dark and its shaft)
    const U = f.corners.map((p) => { const g = underOf(light, p), c = caveOf(light, p); if (!g && !c) return null; const day = g ? g.day : 1; return c ? { sky: c.sky * Math.min(1, day * 2), sun: g ? 0 : c.sun } : { sky: day, sun: day }; });
    if (!U.some(Boolean)) return f;
    const nOf = (i) => (Array.isArray(f.cornerNormals) ? f.cornerNormals[i] : f.normal ?? [0, 0, 1]);
    const lift = (i) => { const p = f.corners[i], n = nOf(i); return lampsAt(light, [p[0] + n[0] * 0.1, p[1] + n[1] * 0.1, p[2] + n[2] * 0.1], n); };
    if (Array.isArray(f.cornerLight)) {
      const cornerLight = [], sunShare = [];
      f.cornerLight.forEach((c, i) => {
        // (the corner's light parted into the sun's share and the sky's, each dimmed by what reaches it, the lamps' added)
        const u = U[i], sh = f.sunShare?.[i] ?? 0, ks = u ? u.sky : 1, ku = u ? u.sun : 1, e = u ? lift(i) : [0, 0, 0];
        const all = c.map((v, ch) => r3(v * (1 - sh) * ks + v * sh * ku + e[ch])), y = lumOf(all), sun = sh * lumOf(c) * ku;
        cornerLight.push(all); sunShare.push(y > 1e-9 ? r3(Math.min(1, sun / y)) : 0);
      });
      return { ...f, cornerLight, sunShare };
    }
    // (a baked face: its colours dimmed and lit alike, the lamps' light on its paint)
    const fills = f.cornerFills ?? f.corners.map(() => f.fill);
    const cornerFills = fills.map((h, i) => { const u = U[i]; if (!u) return h; const c = rgb(h), e = lift(i), k = 0.6 * u.sky + 0.4 * u.sun; return hex(c.map((v, ch) => v * k + v * e[ch] * 1.4)); });
    const avg = [0, 1, 2].map((ch) => cornerFills.reduce((s, h) => s + rgb(h)[ch], 0) / cornerFills.length);
    return { ...f, fill: hex(avg), cornerFills };
  });
}
