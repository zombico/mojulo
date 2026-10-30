/**
 * HAIR LOCKS — the realistic hero's hair as its MAIN SHAPES (realistic laws 10), in ONE colour, from the groom's guide
 * strands (dermal-hair.js growScalp). A STROKE BUDGET (the operator's: "a number of major flows, volumize it, add some
 * trailers, that's it"):
 *
 *   MAJOR FLOWS   the guides gathered (by root, middle and end, never across the part) into the dial's few dozen flows;
 *                 each flow's section drawn THROUGH its own guides across it (a smooth arc fitted to them, `LOCK_RAIL`), so
 *                 a broad flow lies on the head as its guides do, domed and grooved on top, its root walked to the hairline
 *                 and its end to the cut's line (`LOCK_EDGE`); over the scalp WRAPPED round the head at its own height,
 *                 the higher-rooted flows the outer (`LOCK_CONFORM`): shingles, never chords standing off the head
 *   VOLUME        round by round the flows nearest where the scalp shows grow (`LOCK_OVERLAP.wide`) until the OVERLAP PRINCIPLE
 *                 holds (hair-score.js overlapHair: from a turntable, the scalp and the shell under the flows show only in
 *                 a split between two flows or at the part); the gate advises, its last round is kept
 *   TRAILERS      a few strokes a flow riding its edges toward its tip and on past it (`LOCK_TRAIL`), breaking its
 *                 outline; standing hair's are its spikes, anime sections laid down over a lying layer (`LOCK_SECTION`)
 *   THE FADE      the shell's edge smoothed and fringed with strand cards (laws 7's page, undyed) out over the skin
 *                 (`LOCK_FADE`): no hairline is a hard line
 *
 * Detail is shape, never paint. ONE DIAL, `stylize` 0 … 1, between two references: 0 a seventh-generation realistic
 * game's (more and thinner flows, finer grooves, tip cards laid on them, `LOCK_TIP`), 1 a stylised one's (a dozen and a half chunky sculpted flows,
 * rounded tips, deep gaps between them, no tip cards). `HAIR_LOCKS` holds the two ends; a number between is lerped. One
 * procedure a hair CLASS (`lockClass`: hair-depict.js hairClass, a falling curly groom long):
 *
 *   cropped   the shell alone, raised to the hair's length (a buzz's barely), faded at its edge
 *   coil      standing coils (an afro, a crop of curls) a SCULPTED VOLUME: the shell raised to where the coils stand (the guides' reach off the scalp), lumped by
 *             the dial's puffs (finer at 0, big at 1), never strokes
 *   short, long   flows and trailers (a long flow falls to its cut, outside the hero's neck and shoulders)
 *   standing  a lying layer of flows and the spikes over it
 *   tied      the walks to the tie as flat flows pulled taut, the tail (a ponytail, a braid, a bun) a SEPARATE MASS: a
 *             core tube along the tie's bundle, wrapped by the dial's few or many locks
 *   rope      each loc, row or braid a ROPE: a round tube along its bundle, a twist groove round it (`LOCK_ROPE`), over
 *             the shell
 *
 *   lockHair(chart, D, S, { level, centre, stylize, colliders, maps }) → { mesh, cards, cap, locks, streak?, clip?, overlap?, counts }
 *             (`clip` { n, mm } the cut's length over the head where a clipper took the hair under its shell: the skin's paint,
 *             dermal-texture.js)
 *   lockStrands(guides, chart, { kind, centre, stylize, level, group, sides, under }) → { mesh, flows }   the face's hair
 *   beardShell(chart, guides, { stylize, seed }) → height(p)   a beard's sculpted coat
 *   readStylize(v)   the dial's value (default HAIR_STYLIZE), or throws
 *
 * Meshes as hair-depict.js's: { vertices, faces, groups, closure } in the chart's frame (metres, z up); `cards` an open
 * mesh with `uv` ([across, along, cell] on the strand page). Every stroke lies outside the head (the chart's skin and its
 * ears) and over the shell (`HAIR_CLEAR.gap` past the shell's height), and outside `colliders` (surfaces { vertices,
 * normals } in the chart's frame: the neck, the shoulders and the back a hero gives) by `HAIR_CLEAR.body`; with `seal`, a
 * stroke whose spine runs into a collider stops there (never pushed out round it).
 * Deterministic: no dice beyond the groom's own; the same chart, dermis, groom and dial give the same mesh.
 */
import { dermisAt, CLIPPER } from './dermal-map.js';
import { growScalp, partDistance } from './dermal-hair.js';
import { capMesh, hairClass, HAT_CAP } from './hair-depict.js';
import { overlapHair } from './hair-score.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a, fb = [0, 0, 1]) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : fb; };
const perp = (a, t) => sub(a, scl(t, dot(a, t)));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const r7 = (v) => Math.round(v * 1e7) / 1e7;

/** the dial's default: between the two references */
export const HAIR_STYLIZE = 0.5;
/** the dial's value, 0 … 1 */
export function readStylize(v) {
  if (v === undefined || v === null) return HAIR_STYLIZE;
  if (!(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error('stylize: 0 (a realistic game\'s locks: many, fine, soft cards) … 1 (a stylised game\'s: a few dozen chunky sculpted locks)');
  return v;
}
/**
 * THE DIAL's two ends ([at 0, at 1], lerped): `locks` on a full scalp (~600 cm², the guides' ~240) at L1; `cover` a lock's
 * root width over its share of the scalp's (the overlap that leaves no gap at the root); `flat` its thickness over its
 * width; `grooves` along its top and their `depth` (the share of its thickness); `point` the taper's exponent (a point
 * near 1) against `round` (a sculpted rounded tip); `cards` the share of locks carrying tip cards (none past `cardsTo` on
 * the dial: the hairline is the fade's); `card` a tip card's reach (the share of its lock's length, m at most `cardMax`);
 * `puff` a coil's lumps (m across) and `lump` their height (the share of the volume's).
 */
export const HAIR_LOCKS = Object.freeze({
  locks: [40, 18], trailers: [2, 1], thick: [0.006, 0.012], cover: [1.35, 1.2], flat: [0.3, 0.55], grooves: [2, 1], depth: [0.18, 0.4],
  point: [0.9, 0.5], round: [0, 1], cards: [1, 0], cardsTo: 0.65, card: 0.22, cardMax: 0.05,
  puff: [0.018, 0.045], lump: [0.12, 0.28],
});
/** THE LADDER's rungs for locks (dermal-hair.js HAIR_LADDER: the head's size on screen): `count` × the dial's locks, a lock's
 * `ring` points round, a station every `seg` m along (at most `stations`), the coat's `cells` (the shell's faces: a head
 * ~50 px tall on a 1080p third-person screen is L0) */
export const LOCK_RUNG = Object.freeze({
  L2: Object.freeze({ count: 1.4, ring: 12, seg: 0.012, stations: 16 }),
  L1: Object.freeze({ count: 1, ring: 10, seg: 0.016, stations: 12 }),
  L0: Object.freeze({ count: 0.45, ring: 6, seg: 0.026, stations: 7 }),
});
/** CLEARANCE: every point at least `gap` (m) off the head's skin, `reach` the farthest a skin sample is looked for, `body`
 * (m) off a collider's (the neck and shoulders, cloth's thickness and a little: hair lies over the collar); `inside` how
 * deep under a collider a stroke's spine is taken to have run into the body (`seal`: cut there) */
export const HAIR_CLEAR = Object.freeze({ gap: 0.0008, reach: 0.03, body: 0.006, inside: 0.004 });
/** the groups: the mass and its cards one colour; the shell under it; a dye only where the groom asks for a streak */
export const LOCK_GROUPS = Object.freeze({ mass: 'Hair', shell: 'Hair', streak: 'HairStreak' });
const FULL_GUIDES = 236;
/** the shell under the locks: its height off the skin and the run in from its edge it rises over (m) */
export const LOCK_SHELL = Object.freeze({ height: 0.002, edge: 0.006 });
/** a guide shorter than this (m) makes no lock: the shell is its hair (stubble) */
export const LOCK_MIN = 0.006;
/** CLIPPED HAIR's grid for the painter (`grid` cells round the head and along it) and how far past a shell's edge (m) the
 * scalp is looked at for clipped hair (a fade's line, not a hairline: no cards there); a clipped shell's edge smoothed
 * `smooth` rounds (a fade's line runs across the chart's cells: fewer leave it wavy) */
export const LOCK_CLIP = Object.freeze({ grid: 72, past: 0.004, smooth: 12 });
/** the clipped lengths (mm, at the chart's points) as a grid over the head's addresses: { n, mm } (row by along, −1 where
 * no scalp point falls, each cell its points' mean, under 99 mm) */
function clipGrid(chart, cutMm) {
  const n = LOCK_CLIP.grid, sum = new Float64Array(n * n), cnt = new Uint32Array(n * n);
  chart.samples.forEach((a, i) => { if (!a || !Number.isFinite(cutMm[i])) return; const c = Math.min(n - 1, Math.floor(a.along * n)) * n + (Math.floor(a.around * n) % n); sum[c] += Math.min(99, cutMm[i]); cnt[c]++; });
  return { n, mm: Array.from(sum, (v, c) => (cnt[c] ? Math.round((v / cnt[c]) * 10) / 10 : -1)) };
}
/** a lock's root walked toward the hairline: a `step` (m) at a time, as far as `reach` (m); a flow that reaches the cut's
 * line holds its width from `held` along it */
/** a flow's section runs through its guides across it, on past its outermost by `margin` × the guides' spacing × the round's
 * volume over the scalp (its neighbour's margin meets it: the flows tile the scalp); past its outermost guide its slope at most `slope`, its
 * rise off the row at most `rise` (m) */
/** THE FADE round the shell's edge: its smoothing rounds, a card every `step` (m), `inside` and `outside` it (m), `half` wide (m),
 * every point at least `gap` (m) off the skin */
export const LOCK_FADE = Object.freeze({ smooth: 4, step: 0.005, inside: 0.008, outside: 0.006, half: 0.004, gap: 0.0003 });
export const LOCK_RAIL = Object.freeze({ margin: 0.8, slope: 0.6, rise: 0.015 });
/** A FLOW LIES ON THE HEAD: over the scalp a section is laid at its spine's own height off the skin across its whole width
 * (wrapped round the head as hair lies, never a chord standing off it), in full while the spine is within `near` (m) of
 * the skin, letting go by `far`; each flow `layer` (m) at most further out the higher its root (the crown's hair lies over
 * the nape's), its root on the shell and rising to its layer over `rise` of its length (a root comes out of the scalp) */
export const LOCK_CONFORM = Object.freeze({ near: 0.02, far: 0.035, layer: 0.006, rise: 0.12 });
export const LOCK_EDGE = Object.freeze({ step: 0.002, reach: 0.035, held: 0.4 });
/** a TRAILER: riding its flow's edge (`at` across it, −1 … 1) from `from` along it to its tip, on past a free tip by `beyond`
 * of that run, `width` of its flow's; standing hair's `spikes` × the dial's trailers (each its own guide) */
export const LOCK_TRAIL = Object.freeze({ from: 0.35, at: 0.7, beyond: 0.15, width: 0.35, spikes: 2 });
/** hair shorter than this (m) is stubble: there the shell is the hair, and the overlap principle passes over it (a skin
 * fade's last few millimetres); every longer section, a taper's and a fade's included, is a lock the turntable sees */
export const LOCK_SHOWS = 0.006;
/** THE OVERLAP rounds: a flow's margin over the scalp × each step of `wide` in turn (volume, never more strokes), the `near`
 * flows nearest each spot where the scalp shows taking the next, until it shows only in splits (hair-score.js overlapHair),
 * measured `px` across from `views` (a turntable: every 45° a little above, and the top); the groom's part a split `part` turns
 * round the head either side of its line (~1.5 cm) */
export const LOCK_OVERLAP = Object.freeze({ part: 0.025, near: 2, wide: Object.freeze([1, 1.15, 1.3, 1.5, 1.7, 1.9, 2.15, 2.4]), px: 192, views: Object.freeze([...[0, 45, 90, 135, 180, 225, 270, 315].map((az) => Object.freeze([az, 12])), 'top']) });

/** a curly groom that FALLS (standing less than `stand`, at least `length` m long: curls to the shoulder) is drawn as flows,
 * as long hair is; one that stands (an afro, a crop of curls) is the coil's sculpted volume */
export const LOCK_COIL = Object.freeze({ stand: 0.3, length: 0.15 });
/** the lock hair's class: hair-depict.js hairClass's, a falling curly groom 'long' */
export function lockClass(S) {
  const cls = hairClass(S);
  return cls === 'coil' && (S.stand ?? 0) < LOCK_COIL.stand && S.length >= LOCK_COIL.length ? 'long' : cls;
}
/** the dial's numbers at `s` */
export function lockStyleAt(s) {
  const o = {};
  for (const [k, v] of Object.entries(HAIR_LOCKS)) o[k] = Array.isArray(v) ? lerp(v[0], v[1], s) : v;
  o.cards = s >= HAIR_LOCKS.cardsTo ? 0 : 1 - smooth(0, HAIR_LOCKS.cardsTo, s);
  o.grooves = Math.round(o.grooves);
  return o;
}

// ── a surface as a clearance: its points by a grid, each with its normal (the head's skin, the body a hero gives) ────
/** a surface { vertices, normals, samples? } as a clearance: `out(p, gap)` lays `p` at least `gap` off it along the nearest
 * point's normal (a point past `reach` is left) */
export function surfaceClear(chart, reach = HAIR_CLEAR.reach) {
  const cell = reach / 2, grid = new Map(), key = (p) => p.map((v) => Math.floor(v / cell)).join(',');
  chart.vertices.forEach((p, i) => { if (chart.samples && !chart.samples[i]) return; const k = key(p); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const nearest = (p) => {
    const c = p.map((v) => Math.floor(v / cell)); let bi = -1, bd = Infinity;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) {
      for (const i of grid.get(`${c[0] + a},${c[1] + b},${c[2] + e}`) || []) { const q = chart.vertices[i], d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd || (d === bd && i < bi)) { bd = d; bi = i; } }
    }
    return bi;
  };
  /** `p` laid at least `gap` off the skin along the nearest sample's normal (a point past reach is left) */
  const out = (p, gap = HAIR_CLEAR.gap) => {
    const i = nearest(p); if (i < 0) return p;
    const n = unit(chart.normals[i]), h = dot(sub(p, chart.vertices[i]), n);
    return h >= gap ? p : add(p, scl(n, gap - h));
  };
  /** `p`'s height over the surface along the nearest sample's normal (negative under it); Infinity past reach */
  const depth = (p) => { const i = nearest(p); return i < 0 ? Infinity : dot(sub(p, chart.vertices[i]), unit(chart.normals[i])); };
  return { nearest, out, depth };
}

// ── a polyline's arc and its resampling ──────────────────────────────────────────────────────────────────────────────
function arcOf(P) { const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + len(sub(P[i], P[i - 1]))); return cum; }
function at(P, cum, u) {
  const L = cum.at(-1), s = Math.max(0, Math.min(1, u)) * L;
  let j = 0; while (j < P.length - 2 && cum[j + 1] < s) j++;
  const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
  return add(P[j], scl(sub(P[j + 1], P[j]), Math.max(0, Math.min(1, f))));
}
/** a path cut to its first `L` m */
const cutTo = (P, L) => { const cum = arcOf(P); if (cum.at(-1) <= L) return P; const k = cum.findIndex((c) => c >= L); return [...P.slice(0, k), at(P, cum, L / cum.at(-1))]; };
/** the least-squares parabola through points [x, y] (a line under three, a constant under two) → y(x) */
function parabola(P, { spread = 0.004, rise = 0.02 } = {}) {
  const n = P.length, mx = P.reduce((a, q) => a + q[0], 0) / n, my = P.reduce((a, q) => a + q[1], 0) / n;
  // (a row narrower than `spread` (m) its mean: a parabola through nearly one x is anything; the arc never more than `rise`
  // (m) from the row's mean)
  const xs = P.map((q) => q[0]);
  if (n < 3 || Math.max(...xs) - Math.min(...xs) < spread) return () => my;
  const clampY = (y) => Math.max(my - rise, Math.min(my + rise, y));
  let s = [0, 0, 0, 0, 0], r = [0, 0, 0];
  for (const [x0, y] of P) { const x = x0 - mx; s = s.map((v, k) => v + x ** k); r = r.map((v, k) => v + y * x ** k); }
  // (the normal equations for a + b x + c x², solved by Cramer; a flat row's degenerate system falls back to the mean)
  const m = [[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]], det = (A) => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
  const D0 = det(m);
  if (Math.abs(D0) < 1e-18) return () => my;
  const col = (k) => m.map((row, i) => row.map((v, q) => (q === k ? r[i] : v)));
  const [a, b, c] = [0, 1, 2].map((k) => det(col(k)) / D0);
  return (x0) => { const x = x0 - mx; return clampY(a + b * x + c * x * x); };
}
/** a path from `u` of its length on */
const fromOn = (P, u) => { const cum = arcOf(P), L = cum.at(-1) * u, k = cum.findIndex((c) => c > L); return k <= 0 ? P : [at(P, cum, u), ...P.slice(k)]; };
const resample = (P, n) => { const cum = arcOf(P); return Array.from({ length: n + 1 }, (_, i) => at(P, cum, i / n)); };

// ── gathering: guides into locks (farthest seeds, then a few rounds of nearest by root, middle and end) ─────────────
function gather(feats, k) {
  const n = feats.length, d2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  k = Math.max(1, Math.min(n, k));
  const seeds = [0], best = feats.map((f) => d2(f, feats[0]));
  while (seeds.length < k) { let bi = 0; for (let i = 1; i < n; i++) if (best[i] > best[bi]) bi = i; seeds.push(bi); for (let i = 0; i < n; i++) best[i] = Math.min(best[i], d2(feats[i], feats[bi])); }
  let C = seeds.map((i) => feats[i].slice()), of = new Array(n).fill(0);
  for (let round = 0; round < 6; round++) {
    of = feats.map((f) => { let bj = 0, bd = Infinity; C.forEach((c, j) => { const d = d2(f, c); if (d < bd) { bd = d; bj = j; } }); return bj; });
    C = C.map((c, j) => { const m = feats.filter((_, i) => of[i] === j); return m.length ? c.map((_, q) => m.reduce((s, f) => s + f[q], 0) / m.length) : c; });
  }
  const groups = C.map(() => []); of.forEach((j, i) => groups[j].push(i));
  return groups.filter((g) => g.length);
}

// ── a lock lofted: a ring a station round its spine, closed at the root and at the tip ──────────────────────────────
/**
 * A LOCK as a closed tube: `spine` its stations, `width(u)` and `thick(u)` across and out, its top `grooves` deep `depth`
 * (the share of its thickness), `out(i)` the way off the head a station faces, `ring` points round. Its underside flat (it
 * lies on what is under it), its top domed and grooved; `rail(station, across −1 … 1, across axis)` a section's underside
 * point where a flow's guides give it (null: the spine's straight section). Pushes into `M` ({ vertices, faces, groups }); `group(u)` a face's.
 */
function loftLock(M, spine, { width, thick, grooves = 0, depth = 0, ring = 8, outAt, group, clear, twist = 0, rail = null, round = false, tipOut = 0 }) {
  const N = spine.length - 1, base = M.vertices.length, rows = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, t = unit(sub(spine[Math.min(N, i + 1)], spine[Math.max(0, i - 1)])), o0 = outAt(i, t);
    const tw = twist * u * Math.PI * 2, A0 = unit(cross(t, o0), unit(perp([1, 0, 0], t)));
    const o = unit(add(scl(o0, Math.cos(tw)), scl(A0, Math.sin(tw)))), A = unit(cross(t, o));
    const w = width(u), h = thick(u), row = [];
    for (let r = 0; r < ring; r++) {
      const ph = (2 * Math.PI * r) / ring, x = Math.cos(ph), y = Math.sin(ph);
      // (the top domed and grooved across, the underside flatter; the ring's middle a third of its thickness off the spine)
      const g = grooves > 0 && y > 0 ? 1 - depth * (0.5 - 0.5 * Math.cos(2 * Math.PI * grooves * (x + 1) / 2)) * smooth(0, 0.15, u) * (1 - smooth(0.8, 1, u)) : 1;
      const up = y > 0 ? y * g : y * (round ? 1 : 0.45);
      // (`rail`: a flow's section drawn through its own guides across it, so a broad flow lies on the head as they do)
      const b = rail ? rail(i, x, A) : null;
      let p = b ? add(b, scl(o, (up * h) / 2 + h * 0.2)) : add(spine[i], add(scl(A, (x * w) / 2), scl(o, (up * h) / 2 + h * 0.2)));
      // (twice: a point pushed off one sample can land under its neighbour's plane)
      if (clear) p = clear(clear(clear(p)));
      row.push(M.vertices.push(p.map(r7)) - 1);
    }
    rows.push(row);
  }
  const face = (a, b, c, g) => { M.faces.push([a, b, c]); M.groups.push(g); };
  for (let i = 0; i < N; i++) {
    const g = group((i + 0.5) / N);
    for (let r = 0; r < ring; r++) { const a = rows[i][r], b = rows[i][(r + 1) % ring], c = rows[i + 1][(r + 1) % ring], d = rows[i + 1][r]; face(a, c, b, g); face(a, d, c, g); }
  }
  // (the root closed by a fan to its middle; the tip by one to the spine's end)
  const mid = (row) => scl(row.reduce((s, v) => add(s, M.vertices[v]), [0, 0, 0]), 1 / row.length);
  // (`tipOut` (m): the tip on past the spine's end, so a lock lying on the skin never closes on a point of its last ring)
  const tEnd = unit(sub(spine[N], spine[N - 1])), end = (p) => (clear ? clear(clear(clear(p))) : p), r0 = M.vertices.push(end(mid(rows[0])).map(r7)) - 1, tip = M.vertices.push(end(add(spine[N], scl(tEnd, tipOut))).map(r7)) - 1;
  for (let r = 0; r < ring; r++) { face(r0, rows[0][r], rows[0][(r + 1) % ring], group(0)); face(tip, rows[N][(r + 1) % ring], rows[N][r], group(1)); }
  return base;
}

/** ANIME SECTIONS (standing hair, the operator's 2026-10-28: anime's principles, not as spiky): how far a spike is laid
 * down along the head (`lie`, the share of its rise off the head pressed into the head's tangent, its length kept), its root
 * at least `base` of its length wide, its thickness `flat` of its width (a thin section), its wedge's shoulder (`wedge`, the power its
 * width holds by before it draws to the point); a lock shorter than `short` (m) laid down the more the shorter; under the
 * spikes (its trailers) a lying layer of the dial's flows (`under` laid down, cut to `underLength` m, `underFlat` of its
 * width thick: flat sections, the spikes the volume) */
export const LOCK_SECTION = Object.freeze({ lie: 0.4, base: 0.7, flat: 0.32, wedge: 2, short: 0.04, under: 0.92, underLength: 0.035, underFlat: 0.18 });
/** a spine laid toward the head round `centre` by `lie` (bladeOf's lie: the rise off its root pressed into the tangent,
 * each point's distance from the root kept) */
function layDown(P, centre, lie) {
  const r0 = P[0], o = unit(sub(r0, centre));
  return P.map((p, i) => { if (!i) return p; const d = sub(p, r0), l = len(d), h = Math.max(0, dot(d, o)), q = sub(d, scl(o, lie * h)), lq = len(q); return lq > 1e-9 ? add(r0, scl(q, l / lq)) : p; });
}
/** a ROPE (a loc, a row, a braid): round, its twist groove a turn every `period` (m) of its kind, drawn in at least `perTurn`
 * stations a turn (at most `stations` along it); a loc and a row thin, six points round */
export const LOCK_ROPE = Object.freeze({ period: Object.freeze({ braid: 0.03, loc: 0.05, row: 0.03 }), perTurn: 6, stations: 72 });
/** a tail's radius along it: full, drawn in over its last third to the dial's end (a point at 0, a round at 1) */
const tailEnd = (u, St) => 1 - (0.75 - 0.35 * St.round) * smooth(0.55, 1, u) ** 1.5;
/** a lock's width along it (`u` 0 the root … 1 the tip): full near the root, its end by the dial (a point or a round) */
function profile(u, St, { point = false, rope = false } = {}) {
  if (rope) return 1 - 0.25 * smooth(0.85, 1, u);
  // (a section's wedge: broad most of its way, drawn to a point at every turn of the dial, never a cone)
  if (point) return Math.max(0.03, (1 - u ** LOCK_SECTION.wedge) * (1 - u) ** 0.45);
  const sharp = (1 - u) ** St.point, round = Math.sqrt(Math.max(0, 1 - u ** 3)) * (1 - 0.25 * u);
  const p = point ? (1 - u) ** 0.8 : lerp(sharp, round, St.round);
  return Math.max(0.04, p) * (0.6 + 0.4 * Math.sqrt(smooth(0, 0.15, u)));
}

/**
 * ALPHA CARDS (laws 7's: hair-depict.js stripMesh `card`, the strand page's `cell`) as one open mesh: each { pts, across,
 * half } a strip, its `uv` [across, along, cell], along 0 (the strand page's filled root) at its first point.
 */
function cardMesh(cards, clear = (p) => p) {
  const vertices = [], faces = [], groups = [], uv = [];
  cards.forEach((C, ci) => {
    const n = C.pts.length - 1, cell = (ci * 7 + 3) % 8, L = [], R = [];
    C.pts.forEach((p, i) => { const a = C.across[i], h = C.half[i]; L.push(vertices.push(clear(add(p, scl(a, h))).map(r7)) - 1); uv.push([0, i / n, cell]); R.push(vertices.push(clear(sub(p, scl(a, h))).map(r7)) - 1); uv.push([1, i / n, cell]); });
    // (a face its points pushed off the skin onto one another leaves no area: dropped, the strip open there as it is)
    const has = (f) => len(cross(sub(vertices[f[1]], vertices[f[0]]), sub(vertices[f[2]], vertices[f[0]]))) > 1e-12;
    for (let i = 0; i < n; i++) for (const f of [[L[i], R[i], R[i + 1]], [L[i], R[i + 1], L[i + 1]]]) if (has(f)) { faces.push(f); groups.push(C.group); }
  });
  return faces.length ? { vertices, faces, groups, closure: 'open', uv } : null;
}

/**
 * A SHELL raised off the scalp by `heightAt(vertex)` (m): the cap's construction (hair-depict.js capMesh: the faces that
 * grow the scalp's hair, the part left open, run in soft over `edge` from its edge). A crop's, a coil's volume.
 */
function shellMesh(chart, D, S, heightAt, { edge, where = null }) {
  return capMesh(chart, D, { S, group: LOCK_GROUPS.shell, height: heightAt, edge, smoothEdge: where ? LOCK_CLIP.smooth : LOCK_FADE.smooth, where });
}
/** two card meshes as one (their places on the strand page kept) */
const joinCards = (A, B) => (!A ? B : !B ? A : { vertices: [...A.vertices, ...B.vertices], faces: [...A.faces, ...B.faces.map((f) => f.map((v) => v + A.vertices.length))], groups: [...A.groups, ...B.groups], closure: 'open', uv: [...A.uv, ...B.uv] });
/** a shell without its rim (what is pinned) */
const bare = (M) => { if (!M) return M; const { rim: _r, ...rest } = M; return rest; };
/**
 * THE FADE (the operator's, 2026-10-28: the shell's edge is never a hard line): a strand card every `step` (m) round the
 * shell's smoothed rim, rooted `inside` (m) in the hair over the shell, its strands' ends `outside` (m) out over the skin,
 * `half` (m) its half-width, laid on the head; in the mass's colour, so the hairline fades as hair does.
 */
function fadeCards(cap, skin, skip = null) {
  if (!cap?.rim?.length) return [];
  const F = LOCK_FADE, out = [], kept = [];
  for (const r of cap.rim) { if (kept.some((q) => len(sub(q, r.p)) < F.step) || skip?.(r)) continue; kept.push(r.p);
    const lay = (q, h) => skin.out(add(q, scl(r.n, h)), h);
    const pts = [lay(sub(r.p, scl(r.out, F.inside)), LOCK_SHELL.height + 0.0004), lay(r.p, 0.0005), lay(add(r.p, scl(r.out, F.outside)), 0.0003)];
    const across = unit(cross(r.n, r.out));
    out.push({ pts, across: pts.map(() => across), half: pts.map(() => F.half), group: LOCK_GROUPS.mass });
  }
  return out;
}

/** seeded value noise in 3D (an integer hash, no dice): 0 … 1 */
const hash = (a, b, c, s) => { let h = (a * 374761393 + b * 668265263 + c * 2246822519 + s * 3266489917) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise3(p, s) {
  const i = p.map(Math.floor), f = p.map((v, q) => { const t = v - i[q]; return t * t * (3 - 2 * t); });
  let v = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) v += hash(i[0] + a, i[1] + b, i[2] + c, s) * (a ? f[0] : 1 - f[0]) * (b ? f[1] : 1 - f[1]) * (c ? f[2] : 1 - f[2]);
  return v;
}

/**
 * THE LOCK HAIR on a head: the groom `S` (readScalp's) on `chart` with dermis `D`, at the ladder's `level`, `stylize` the
 * dial, `centre` the head's middle (a lock's top faces away from it), `colliders` surfaces the hair falls outside.
 */
export function lockHair(chart, D, S, { level = 'L1', centre = [0, 0, 0], stylize = HAIR_STYLIZE, colliders = [], maps = false, seal = false } = {}) {
  const s = readStylize(stylize), St = lockStyleAt(s), R = LOCK_RUNG[level] ?? LOCK_RUNG.L1, cls = lockClass(S);
  // (the head's skin, then what the hero gives the hair to fall over: its neck, its shoulders, its back)
  // (a lock lies over the shell, never under it: the shell would hide it)
  const lockGap = LOCK_SHELL.height + HAIR_CLEAR.gap;
  const skin = surfaceClear(chart), body = colliders.map((C) => surfaceClear(C, 0.06)), clear = (p) => body.reduce((q, B) => B.out(q, HAIR_CLEAR.body), skin.out(p, lockGap));
  const counts = { class: cls, level, stylize: s, locks: 0, cards: 0 };
  // ── the guides (the comb's; a buzz has none: it lies on the scalp) ──
  const G = S.length < 0.02 && !S.ties.length ? null : growScalp(chart, D, S, { colliders: ['head'], strands: false });
  const guides = G?.guides ?? [];
  counts.guides = guides.length;
  // ── CLIPPED HAIR (dermal-map.js CLIPPER): under the clipper's shell length no shell, the skin's paint its shadow; each
  // point's length the CUT's own (growScalp's `clipOf`: smooth, as a barber's fade is, never a guide's patch); `clip` a
  // grid of it over the head (LOCK_CLIP.grid cells round by along, mm, −1 off the scalp) for the painter, or null where
  // nothing is clipped ──
  const growing = growsOf(chart, D, null), cutMm = G?.clipOf ? chart.vertices.map((p, i) => (growing[i] ? G.clipOf(chart.samples[i], p) * 1000 : Infinity)) : null;
  const clipped = !!cutMm && cutMm.some((mm) => mm < CLIPPER.shell), mmAt = (p) => { const i = skin.nearest(p); return i < 0 ? Infinity : cutMm[i]; };
  const shelled = clipped ? (p) => mmAt(p) >= CLIPPER.shell : null;
  // (the fade's cards fringe the hairline alone: where the scalp runs on clipped past the shell's edge, the paint is the fade)
  const onClipped = clipped ? (r) => mmAt(add(r.p, scl(r.out, LOCK_CLIP.past))) < CLIPPER.shell : null;
  const clip = clipped ? clipGrid(chart, cutMm) : null;
  // ── the SHELL: a cropped head's and a coil's the whole hair; under locks the cap, sunk to the skin ──
  let cap = null;
  if (cls === 'cropped' || cls === 'coil' || !guides.length) {
    // (each scalp point's height: the nearest guides' reach off the scalp, a crop's a share of its length)
    const reach = guides.map((g) => { const n = unit(g.n ?? [0, 0, 1]); return Math.max(...g.pts.map((p) => dot(sub(p, g.root), n))); });
    const lenOf = guides.map((g) => arcOf(g.pts).at(-1));
    const roots = guides.map((g) => g.root);
    const near = (p) => { let v = 0, w = 0; roots.forEach((r, i) => { const d = len(sub(p, r)); if (d < 0.03) { const k = 1 / (d + 0.004) ** 2; v += k * (cls === 'coil' ? reach[i] : Math.min(0.007, 0.2 * lenOf[i])); w += k; } }); return w ? v / w : 0; };
    const base = guides.length ? null : Math.min(0.0025, Math.max(HAT_CAP.height, (S.length ?? 0) * 0.3));
    const heightAt = (p) => {
      if (base !== null) return base;
      const h = near(p);
      if (cls !== 'coil') return Math.max(HAT_CAP.height, h);
      // (the coil's PUFFS: the dial's lumps, a seeded noise over the volume, finer at 0, big at 1)
      const q = scl(p, 1 / St.puff), n = 0.65 * noise3(q, S.seed ?? 1) + 0.35 * noise3(scl(q, 2.1), (S.seed ?? 1) + 7);
      return Math.max(HAT_CAP.height, h * (1 + St.lump * (2 * n - 1)));
    };
    cap = shellMesh(chart, D, S, heightAt, { edge: cls === 'coil' ? 0.02 : 0.006, where: shelled });
    const fc = fadeCards(cap, skin, onClipped), fade = cardMesh(fc, (p) => skin.out(skin.out(p, LOCK_FADE.gap), LOCK_FADE.gap));
    if (cls === 'cropped' || cls === 'coil' || !guides.length) return { mesh: null, cards: fade, cap: bare(cap), locks: [], ...(clip ? { clip } : {}), counts: { ...counts, shell: cap?.faces.length ?? 0, fade: fade ? fc.length : 0 } };
  }
  // (the shell under locks a little raised, so a gap between two locks shows hair, not a painted scalp)
  cap = capMesh(chart, D, { S, group: LOCK_GROUPS.shell, height: LOCK_SHELL.height, edge: LOCK_SHELL.edge, smoothEdge: shelled ? LOCK_CLIP.smooth : LOCK_FADE.smooth, where: shelled });
  // ── the LOCKS: the guides gathered (a tied guide's walk to its tie; a rope's guides lie under the shell) ──
  const tiedRope = cls === 'rope';
  const paths = guides.map((g) => (g.tie !== undefined ? g.walk : g.pts)).map((P) => (P.length > 1 ? P : null));
  // (a guide makes a lock when its hair is long enough: the groom's own length, a tied guide's its walk)
  const lockable = paths.map((P, i) => !!P && (guides[i].tie !== undefined ? arcOf(P).at(-1) : guides[i].L ?? arcOf(P).at(-1)) > LOCK_MIN);
  const live = paths.map((P, i) => (lockable[i] && !tiedRope ? i : -1)).filter((i) => i >= 0);
  const feats = live.map((i) => { const P = paths[i], cum = arcOf(P), m = at(P, cum, 0.4), e = at(P, cum, 1); return [...P[0], ...scl(m, 0.8), ...scl(e, 0.4)]; });
  const want = Math.round(St.locks * R.count * Math.min(1.2, guides.length / FULL_GUIDES));
  const spacing = S.spacing ?? 0.012, partOf = (g) => g.side ?? 0;
  // (the part a line: guides either side of it never share a lock)
  const sides = [...new Set(live.map((i) => partOf(guides[i])))];
  const gatherBy = (k) => sides.flatMap((sd) => {
    const mine = live.map((i, q) => [i, q]).filter(([i]) => partOf(guides[i]) === sd);
    return gather(mine.map(([, q]) => feats[q]), Math.max(1, Math.round((k * mine.length) / Math.max(1, live.length)))).map((g) => g.map((q) => mine[q][0]));
  });
  // THE STROKE BUDGET (the operator's, 2026-10-28: "a number of major flows, volumize it, add some trailers, that's it"):
  // the dial's MAJOR FLOWS, each widened and thickened round by round until the scalp is covered, and a few TRAILERS a
  // flow off its edges toward its tip; nothing else. Standing hair's flows lie along the comb (a short cut's sections, as
  // anime's spiky hair is built) and its trailers are its spikes.
  const stands = cls === 'standing';
  const groupsAll = gatherBy(want).map((g) => (stands ? Object.assign(g, { lie: true }) : g));
  const grows = growsOf(chart, D, S);
  // (a point's height off the scalp and the way out there: null off the scalp or out of reach)
  const scalpAt = chart.samples.map((sm) => !!sm && !sm.feature && dermisAt(sm, D, { detail: false }).hair.tract === 'scalp');
  // (and the same out to a hand's reach, for a point well off the head)
  const far = surfaceClear(chart, 2 * HAIR_CLEAR.reach), heightOn = (p) => { const i = far.nearest(p); if (i < 0 || !scalpAt[i]) return null; const n = unit(chart.normals[i]); return { h: dot(sub(p, chart.vertices[i]), n), n }; };
  const offScalp = (p) => { const i = skin.nearest(p); if (i < 0 || !scalpAt[i]) return null; const n = unit(chart.normals[i]); return { h: dot(sub(p, chart.vertices[i]), n), n }; };
  // (each flow's layer: its root's height among the flows', the highest outermost)
  const rootZ = (flow) => flow.reduce((a, i) => a + paths[i][0][2], 0) / flow.length;
  const zs = groupsAll.map(rootZ), z0 = Math.min(...zs), z1 = Math.max(...zs);
  groupsAll.forEach((g, k) => { g.layer = z1 > z0 ? (zs[k] - z0) / (z1 - z0) : 0; });
  // (a lock's root walked upstream on the scalp toward where the hair stops: when it is reached within `LOCK_EDGE.reach`,
  // the root is laid just past it, so the hairline is the locks' and not the shell's edge)
  const toEdge = (p0, dir, stops = (q) => !grows[skin.nearest(q)]) => { for (let k = 1; k * LOCK_EDGE.step <= LOCK_EDGE.reach; k++) { const q = skin.out(sub(p0, scl(dir, k * LOCK_EDGE.step)), lockGap); if (stops(q)) return q; } return null; };
  const streakOf = (gi) => G.cards[gi]?.streak;
  // (a flow's TRAILERS: its guides farthest out to either side, alternately, the dial's few; each knows its flow's width)
  const flowWidth = new Map(), flowGeom = new Map(), nTrail = Math.round(St.trailers * (stands ? LOCK_TRAIL.spikes : 1));
  const trailersOf = (flow) => {
    if (flow.trail || flow.length < 2 || !nTrail || guides[flow[0]].tie !== undefined) return [];
    const c = scl(flow.reduce((a, i) => add(a, paths[i][0]), [0, 0, 0]), 1 / flow.length), t = unit(sub(at(paths[flow[0]], arcOf(paths[flow[0]]), 0.3), paths[flow[0]][0])), A = unit(cross(t, unit(sub(c, centre))));
    const by = flow.map((i) => [i, dot(sub(paths[i][0], c), A)]).sort((x, y) => x[1] - y[1] || x[0] - y[0]);
    const pick = []; for (let k = 0; pick.length < Math.min(nTrail, by.length); k++) pick.push((k % 2 ? by[by.length - 1 - (k >> 1)] : by[k >> 1]));
    return [...new Map(pick.map(([i, x]) => [i, x]))].map(([i, x]) => Object.assign([i], { trail: true, flow, side: x < 0 ? -1 : 1, flowWidth: flowWidth.get(flow) ?? spacing * 2 }));
  };
  // (round by round the flows by where the scalp shows a little wider, until the OVERLAP PRINCIPLE holds: hair-score.js
  // overlapHair, the scalp shown only in a split between locks or at the part; advisory, its last round kept. Each open spot's
  // `LOCK_OVERLAP.near` nearest flows take the next step of `LOCK_OVERLAP.wide`, the rest keep theirs: volume where the
  // scalp shows, never every flow widened into panels)
  const exempt = shortAt(guides, guides.map((g, i) => !!paths[i] && (g.tie !== undefined || (g.L ?? 0) > LOCK_SHOWS))), partOf2 = (a) => partDistance(a, S) < LOCK_OVERLAP.part;
  let M, cards, locks, streak, overlap = null, round = 0, trailers = 0;
  const step = new Map(groupsAll.map((g) => [g, 0]));
  for (let r = 0; r < LOCK_OVERLAP.wide.length; r++) {
    M = { vertices: [], faces: [], groups: [] }; cards = []; locks = []; streak = null; round++; counts.tails = 0; trailers = 0;
    for (const flow of groupsAll) for (const members of [flow, ...trailersOf(flow)]) {
      // (a trailer: one guide of its flow, from `LOCK_TRAIL.from` along it to its tip, thinner; standing hair's a spike)
      const wide = LOCK_OVERLAP.wide[step.get(members.trail ? members.flow : members) ?? 0];
      const trail = !!members.trail, cutOf = (P) => (trail && !stands ? fromOn(P, LOCK_TRAIL.from) : members.lie ? cutTo(P, LOCK_SECTION.underLength) : P);
      if (trail) trailers++;
      const Ls = members.map((i) => arcOf(cutOf(paths[i])).at(-1)), Lm = Ls.reduce((a, b) => a + b, 0) / Ls.length;
      const tied = guides[members[0]].tie !== undefined;
      const n = Math.max(3, Math.min(R.stations, Math.ceil(Lm / R.seg)));
      let rs = members.map((i) => resample(cutOf(paths[i]), n));
      // (a standing flow's guides laid along the comb, each its own: its section lies on the head as they do)
      if (stands && members.lie) rs = rs.map((P) => layDown(P, centre, LOCK_SECTION.under));
      let spine = rs[0].map((_, j) => scl(rs.reduce((a, P) => add(a, P[j]), [0, 0, 0]), 1 / rs.length));
      const core = spine;
      // (a lying flow's trailer rides its flow's edge, as its flow lies: never its own guide flaring off it)
      const ride = trail && !stands ? flowGeom.get(members.flow) : null;
      if (ride) spine = rideEdge(ride, members.side);
      // (standing hair as an anime SECTION, less spiky: laid down along the comb by `LOCK_SECTION.lie`, its length kept, so
      // it shingles over the next and lifts toward its tip)
      const stand = stands && trail;
      if (stand) spine = layDown(spine, centre, LOCK_SECTION.lie);
      // (a short lock lies along the head as a short section does: a taper's, a fade's)
      else if (Lm < LOCK_SECTION.short) spine = layDown(spine, centre, 0.9 * (1 - Lm / LOCK_SECTION.short));
      // (the lock begins at its most upstream root, so it lies over its whole patch of scalp and not as a shingle on it; its
      // width the patch's across the flow)
      const t0 = unit(sub(spine[1], spine[0])), A0 = unit(cross(t0, unit(perp(sub(spine[0], centre), t0))));
      const back = Math.min(0, ...rs.map((P) => dot(sub(P[0], spine[0]), t0))), across = rs.map((P) => dot(sub(P[0], spine[0]), A0));
      // (and half a guide's spacing on, over the hairline's edge: a root is never nearer it than that; each round of volume
      // a spacing more, so flows radiating from a whorl meet there)
      const reachBack = back - spacing * (0.5 + (wide - 1)), start = add(spine[0], scl(t0, back)), edge = trail && !stands ? null : toEdge(start, t0);
      const pre = trail && !stands ? 0 : 2;
      if (!(trail && !stands)) spine = edge ? [edge, scl(add(edge, spine[0]), 0.5), ...spine.slice(1)] : [add(spine[0], scl(t0, reachBack)), add(spine[0], scl(t0, reachBack / 2)), ...spine.slice(1)];
      // (and its tip on downstream to where the hair stops or turns to stubble, when that is within reach: the cut's line,
      // a fade's, is the locks' and not the shell's edge)
      let cutEnd = false;
      if (!tied && !stand && !ride) { const N0 = spine.length - 1, tEnd = unit(sub(spine[N0], spine[N0 - 1])), end = toEdge(spine[N0], scl(tEnd, -1), (q) => !grows[skin.nearest(q)] || exempt(q)); if (end) { spine = [...spine, end]; cutEnd = true; } }
      // (a flow that reaches the cut's line keeps its width to it, cut there: only a free end draws to its tip)
      const along = (u) => (cutEnd ? Math.min(u, LOCK_EDGE.held) : u);
      // (`seal`, realistic laws 13: a stroke STOPS where it meets the body, as it does on the head. Where its spine runs into
      // a collider (the neck, the trunk, the upper arms, the upper neck under the jaw) it is cut there and tapers to its end;
      // one cut back to its root is dropped. A guide falls past the body, which it never meets; pushed out point by point,
      // a spine through the neck came out the far side, wrapped round the throat and down the chest)
      if (seal && body.length && !tied) {
        const k = spine.findIndex((p, i) => i > pre && body.some((B) => B.depth(p) < -HAIR_CLEAR.inside));
        if (k >= 0 && k <= pre + 2) { if (trail) trailers--; counts.dropped = (counts.dropped ?? 0) + 1; continue; }
        if (k >= 0) { spine = spine.slice(0, k); cutEnd = false; counts.stopped = (counts.stopped ?? 0) + 1; }
      }
      spine = spine.map(clear);
      // (a lying flow's root, walked or reached back along its first tangent, laid round the head at its first guide point's height: a
      // straight reach off a curved crown stands up off it)
      if (pre && !stands) { const h0 = heightOn(spine[pre]); if (h0) for (let k = 0; k < pre; k++) { const a = heightOn(spine[k]); if (a) spine[k] = add(spine[k], scl(a.n, Math.max(lockGap, h0.h) - a.h)); } }
      // (never wider than it is long and half again: a clipped nape's short guides make no wing; a section's root at least
      // `LOCK_SECTION.base` of its length: a broad wedge, never a thorn)
      const wFlow = Math.min(Math.max(1.6 * spacing, St.cover * wide * (Math.max(...across) - Math.min(...across) + spacing)) * (tied ? 0.9 : 1), Math.max(spacing, 1.5 * arcOf(spine).at(-1)));
      const w0 = trail ? Math.max(spacing, LOCK_TRAIL.width * members.flowWidth) : wFlow;
      // (a lying flow's trailer as wide as its flow's own, never the round's volume: a widened flow's trailers would hang as
      // panels; standing hair's spikes are its volume, and widen with it)
      if (!trail) flowWidth.set(members, wFlow / (stands ? 1 : wide));
      const wBase = stand ? Math.max(w0, LOCK_SECTION.base * Lm * wide) : w0;
      // (a lock's width is its members' spread where they gather tighter than its root: a tie, a parting)
      const spread = !tied ? null : rs[0].map((_, j) => { let m = 0; for (const P of rs) m = Math.max(m, len(sub(P[j], spine[j]))); return 2 * m + spacing; });
      const widthAt = (u) => { const j = Math.min(n, Math.round(u * n)); return Math.min(wBase * profile(along(u), St, { point: stand }), tied ? Math.max(spacing, spread[j] * 1.1) : Infinity); };
      // (a flow volumized with the rounds: its thickness its width's share, the width grown; a trailer as the dial's)
      const flat = tied ? St.flat * 0.6 : stand ? LOCK_SECTION.flat : members.lie && stands ? LOCK_SECTION.underFlat * wide : St.flat;
      // (a lock's streak: the groom's dye where most of its guides carry one, from where along it starts; never a grey fleck)
      const dyed = members.filter((i) => streakOf(i) && !streakOf(i).grey);
      const from = dyed.length * 2 > members.length ? Math.min(...dyed.map((i) => streakOf(i).from ?? 0)) : null;
      const group = (u) => (from !== null && u >= from ? LOCK_GROUPS.streak : LOCK_GROUPS.mass);
      if (from !== null) streak ??= streakOf(dyed[0]).colour;
      const outAt = (i, t) => unit(perp(sub(spine[i], centre), t), unit(perp([0, 0, 1], t), [0, 1, 0]));
      // (its thickness its width's share, at most the dial's `thick`: volume, never a slab)
      // (a flow of guides drawn through them across it: its station's row of guide points, sorted across, the section on
      // past the outermost by the margin, drawn in toward the tip by the dial's profile; a trailer or a lone guide a tube)
      // (the round's volume over the scalp only, where the principle looks: a flow hanging free keeps its own margin)
      const N1 = spine.length - 1, margin = (i) => LOCK_RAIL.margin * spacing * (1 + (wide - 1) * (spineOff[i] ? 1 - smooth(LOCK_CONFORM.near, LOCK_CONFORM.far, spineOff[i].h) : 0));
      // (the section a smooth arc: the guides' rise off the straight section fitted as a parabola across, so it curves as the
      // head does under them and never crumples where two guides cross)
      const rail = rs.length < 2 || stand ? null : (i, x, A) => {
        const j = Math.max(0, Math.min(n, i - pre)), d = sub(spine[i], core[j]), t = unit(sub(spine[Math.min(N1, i + 1)], spine[Math.max(0, i - 1)])), o = unit(cross(A, t));
        const pts = rs.map((P) => sub(add(P[j], d), spine[i])).map((q) => [dot(q, A), dot(q, o)]);
        const xs = pts.map((q) => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), lo = x0 - margin(i), hi = x1 + margin(i), X = (lo + hi) / 2 + ((x * (hi - lo)) / 2) * profile(along(i / N1), St, {});
        // (past its outermost guides straight on along the arc's slope there: an arc extrapolated curls off the head)
        // (its slope at most `LOCK_RAIL.slope`, its rise off the row's middle at most the arc's own bound: never a chopstick)
        const f = parabola(pts), e = 1e-4, Xc = Math.max(x0, Math.min(x1, X)), slope = Math.max(-LOCK_RAIL.slope, Math.min(LOCK_RAIL.slope, (f(Xc + e) - f(Xc - e)) / (2 * e)));
        const y = f(Xc) + slope * (X - Xc), my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
        const p = add(spine[i], add(scl(A, X), scl(o, Math.max(my - LOCK_RAIL.rise, Math.min(my + LOCK_RAIL.rise, y)))));
        // (over the scalp, laid at the spine's height off it, the flow's layer out: LOCK_CONFORM)
        const hs = spineOff[i], at = hs && offScalp(p);
        if (!at) return p;
        const w = 1 - smooth(LOCK_CONFORM.near, LOCK_CONFORM.far, hs.h);
        return add(p, scl(at.n, w * (Math.max(lockGap, hs.h) + LOCK_CONFORM.layer * (members.layer ?? 0) * smooth(0, LOCK_CONFORM.rise, i / N1) - at.h)));
      };
      const spineOff = spine.map(offScalp);
      // (its thickness its width's share, at most the dial's `thick`: volume, never a slab)
      const lockThick = (u) => Math.min(St.thick, widthAt(u) * flat) * (0.25 + 0.75 * smooth(0, 0.3, u));
      loftLock(M, spine, { width: widthAt, thick: lockThick, grooves: R.ring >= 8 ? St.grooves : 0, depth: St.depth, ring: R.ring, outAt, group, clear, rail });
      if (!trail) { locks.push({ guides: members.length, length: Lm, width: w0 }); flowGeom.set(members, { spine, rail, thick: lockThick, widthAt, outAt, cutEnd }); }
      // the TIP CARDS (the dial's share), on from the lock's last third (the hairline is the fade's)
      if (St.cards > 0) {
        const die = hash(members[0], members.length, 11, S.seed ?? 1);
        // (a flow cut on the cut's line ends there, blunt: no card hangs past it)
        if (die < St.cards && !tied && !trail && !cutEnd) cards.push(...tipCards(spine, { widthAt, thick: lockThick, rail, outAt, clear, L: Lm, St, group: group(1) }));
      }
    }
    counts.locks = locks.length;
    // ── the TAILS: a ponytail, a braid, a bun, a loc, a row, each a separate mass ──
    for (const T of G?.tails ?? []) {
      const rope = T.kind === 'loc' || T.kind === 'row' || T.kind === 'braid', LT = arcOf(T.pts).at(-1), turns = rope ? LT / LOCK_ROPE.period[T.kind] : 0;
      // (a rope's stations as its twist needs them: a turn drawn in fewer reads as a zigzag)
      const n = Math.max(4, Math.min(R.stations * (T.kind === 'bun' ? 3 : 2), Math.ceil(LT / R.seg)), Math.min(LOCK_ROPE.stations, Math.ceil(turns * LOCK_ROPE.perTurn)));
      const idx = Array.from({ length: n + 1 }, (_, j) => Math.round((j * (T.pts.length - 1)) / n)), spine = idx.map((j) => T.pts[j]).map(clear), rr = idx.map((j) => T.r[j]);
      const rad = (u) => rr[Math.min(n, Math.round(u * n))] * (T.kind === 'tail' ? tailEnd(u, St) : 1);
      const outAt = (i, t) => unit(perp(sub(spine[i], centre), t), unit(perp([0, 0, 1], t), [0, 1, 0]));
      // (the core: round, the tail's own radius; a rope's twist a groove spiralling round it)
      loftLock(M, spine, { width: (u) => 2 * rad(u), thick: (u) => 2 * rad(u) * (rope ? 0.85 : 0.8), grooves: rope ? 1 : 0, depth: rope ? St.depth * 0.8 : 0, ring: T.kind === 'loc' || T.kind === 'row' ? 6 : Math.max(6, R.ring), outAt, group: () => LOCK_GROUPS.mass, clear, twist: turns, round: rope });
      // (a ponytail's and a bun's locks round the core: the dial's few chunky or many fine)
      if (!rope) {
        const k = Math.max(3, Math.round(lerp(9, 4, s) * (level === 'L0' ? 0.6 : 1)));
        for (let q = 0; q < k; q++) {
          const th = (2 * Math.PI * (q + 0.5)) / k, ro = 0.7;
          const lspine = spine.map((p, i) => { const t = unit(sub(spine[Math.min(n, i + 1)], spine[Math.max(0, i - 1)])), o = outAt(i, t), A = unit(cross(t, o)); return clear(add(p, add(scl(A, Math.cos(th) * ro * rad(i / n)), scl(o, Math.sin(th) * ro * rad(i / n))))); });
          const lw = (u) => 2 * rad(u) * Math.sin(Math.PI / k) * 2;
          const louts = (i, t) => unit(perp(sub(lspine[i], spine[i]), t), outAt(i, t));
          loftLock(M, lspine, { width: lw, thick: (u) => lw(u) * St.flat * 1.2, grooves: R.ring >= 8 ? St.grooves : 0, depth: St.depth, ring: R.ring, outAt: louts, group: () => LOCK_GROUPS.mass, clear });
          if (St.cards > 0 && T.kind === 'tail' && hash(q, k, 13, S.seed ?? 1) < St.cards) cards.push(...tipCards(lspine, { widthAt: lw, thick: (u) => lw(u) * St.flat * 1.2, outAt: louts, clear, L: arcOf(lspine).at(-1), St, group: LOCK_GROUPS.mass }));
        }
      }
      counts.tails++;
    }
    if (!M.faces.length || cls === 'rope') break;
    overlap = overlapHair(chart, D, { mass: M, under: [cap] }, { px: LOCK_OVERLAP.px, views: LOCK_OVERLAP.views, exempt, partOf: partOf2, maps });
    if (overlap.passes) break;
    // (the flows nearest where the scalp shows a step wider; none left to widen, the round stands)
    const toFlow = (p, g) => Math.min(Infinity, ...(flowGeom.get(g)?.spine ?? []).map((q) => len(sub(p, q))));
    const grow = new Set();
    for (const p of overlap.openAt) for (const [g] of groupsAll.map((g, k) => [g, toFlow(p, g), k]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).slice(0, LOCK_OVERLAP.near)) grow.add(g);
    let grew = false;
    for (const g of grow) if (step.get(g) < LOCK_OVERLAP.wide.length - 1) { step.set(g, step.get(g) + 1); grew = true; }
    if (!grew) break;
  }
  counts.trailers = trailers;
  const overlapMaps = maps && overlap?.maps ? { maps: overlap.maps, px: overlap.px } : null;
  if (overlap) counts.overlap = { open: overlap.open, worst: overlap.worst, split: overlap.split, passes: overlap.passes, rounds: round };
  // (the locks' cards laid off the head as the locks are; the fade's on the skin, its ends over it)
  const fade = fadeCards(cap, skin, onClipped), C = joinCards(cardMesh(cards.filter(Boolean), (p) => clear(clear(p))), cardMesh(fade, (p) => skin.out(skin.out(p, LOCK_FADE.gap), LOCK_FADE.gap)));
  counts.fade = fade.length;
  cap = bare(cap);
  counts.cards = cards.filter(Boolean).length;
  return { mesh: M.faces.length ? { ...M, closure: 'closed' } : null, cards: C, cap, locks, ...(streak ? { streak } : {}), ...(clip ? { clip } : {}), ...(overlapMaps ? { overlap: overlapMaps } : {}), counts: { ...counts, faces: M.faces.length, cardFaces: C?.faces.length ?? 0, shell: cap?.faces.length ?? 0 } };
}

/** a trailer's spine along its flow `F`'s edge on `side`: over its top there from LOCK_TRAIL.from on, past a free tip */
function rideEdge(F, side) {
  const { spine, rail, thick, widthAt, outAt, cutEnd } = F, N = spine.length - 1, i0 = Math.min(N - 1, Math.round(N * LOCK_TRAIL.from)), x = side * LOCK_TRAIL.at, pts = [];
  for (let i = i0; i <= N; i++) {
    const t = unit(sub(spine[Math.min(N, i + 1)], spine[Math.max(0, i - 1)])), o = outAt(i, t), A = unit(cross(t, o)), h = thick(i / N);
    const b = rail ? rail(i, x, A) : add(spine[i], scl(A, (x * widthAt(i / N)) / 2));
    pts.push(add(b, scl(o, (Math.sqrt(1 - x * x) * h) / 2 + h * 0.2)));
  }
  if (!cutEnd) pts.push(add(pts.at(-1), scl(unit(sub(spine[N], spine[N - 1])), LOCK_TRAIL.beyond * arcOf(pts).at(-1))));
  return pts;
}
/** where a guide too short for a lock is the nearest: the shell is the hair there (the overlap principle passes over it) */
function shortAt(guides, long) {
  const roots = guides.map((g) => g.root);
  return (p) => { let bi = -1, bd = Infinity; roots.forEach((r, i) => { const d = len(sub(p, r)); if (d < bd) { bd = d; bi = i; } }); return bi >= 0 && !long[bi]; };
}
/** TIP CARDS: from `from` along a lock, on past its tip by the dial's reach, laid ON its top: as many narrow cards side by side
 * as its width takes at `width` (m) each, each through the lock's own section (its rail, else its straight one), so a broad
 * flow's cards curve with it and never stand off it as a plank; `lift` (m) over its top; `half` (m) a card's least
 * half-width (where the lock draws in to its tip, never a strip of no width) */
export const LOCK_TIP = Object.freeze({ from: 0.7, width: 0.016, lift: 0.0004, half: 0.0005 });
function tipCards(spine, { widthAt, thick, rail = null, outAt, clear, L, St, group }) {
  const n = spine.length - 1, j0 = Math.max(1, Math.round(n * LOCK_TIP.from)), ext = Math.min(HAIR_LOCKS.cardMax, St.card * L);
  if (ext < 0.006) return [];
  const frame = (i) => { const t = unit(sub(spine[Math.min(n, i + 1)], spine[Math.max(0, i - 1)])), o = outAt(i, t); return { o, A: unit(cross(t, o)) }; };
  // (a point of its top across it, `x` −1 … 1 as the loft's ring: the rail's underside raised by the dome there)
  const top = (i, x) => { const { o, A } = frame(i), h = thick(i / n), b = rail ? rail(i, x, A) : add(spine[i], scl(A, (x * widthAt(i / n)) / 2)); return add(b, scl(o, (Math.sqrt(Math.max(0, 1 - x * x)) * h) / 2 + h * 0.2 + LOCK_TIP.lift)); };
  const k = Math.max(1, Math.ceil(len(sub(top(j0, 1), top(j0, -1))) / LOCK_TIP.width)), out = [];
  for (let q = 0; q < k; q++) {
    const x = 0.9 * (-1 + (2 * q + 1) / k), hx = 0.9 / k, stations = Array.from({ length: n - j0 + 1 }, (_, m) => j0 + m);
    const body = stations.map((i) => clear(top(i, x))), half = stations.map((i) => Math.max(LOCK_TIP.half, len(sub(top(i, x + hx), top(i, x - hx))) / 2)), across = stations.map((i) => unit(sub(top(i, x + hx), top(i, x - hx))));
    const d = unit(sub(spine[n], spine[n - 1])), pts = [...body, clear(add(body.at(-1), scl(d, ext * 0.5))), clear(add(body.at(-1), scl(d, ext)))];
    out.push({ pts, across: [...across, across.at(-1), across.at(-1)], half: [...half, half.at(-1) * 0.9, half.at(-1) * 0.8], group });
  }
  return out;
}
/** each chart point: does it grow the scalp's hair (off the part) */
const growsOf = (chart, D, S) => chart.samples.map((s) => { if (!s || s.feature) return false; const H = dermisAt(s, D, { detail: false }).hair; return H.tract === 'scalp' && H.kind === 'terminal' && !(S && partDistance(s, S) < HAT_CAP.part); });
/**
 * FACE HAIR AS ITS MAIN SHAPES (realistic laws 10; the scalp's stroke budget on the face), in ONE colour, from its
 * guides (one strand a clump, hero-head-layers.js heroFaceHair):
 *
 *   a BAND     a brow along its ridge, a moustache's half along the lip: its MASS (browMass: the band's whole shape) and
 *              the dial's few `flows` over it, each a STROKE (its guides' mean path laid on the mass, `stroke` m wide at
 *              most, held inside the mass)
 *   a BEARD    its coat SCULPTED to where its hairs stand (beardShell, the coil's procedure); only a guide whose tip
 *              stands at least `hang` m off the skin HANGS as a flow (a full beard's chin), lofted THROUGH its guides
 *              across it (`per` guides a flow), rooted inside the coat so it comes out at its edge, its tip rounded at
 *              least `round`
 *
 * The dial's ends ([at 0, at 1], lerped): a flow's `thick`ness at most and `flat` (thickness over width), `cover` (its
 * width over its guides' spread and their spacing), `grooves` and their `depth`; `min` the shortest guide that makes a
 * flow (m); a band's `lift` (m) of its strokes over its mass and its mass's `mass` (thickness over width).
 */
export const FACE_LOCKS = Object.freeze({
  beard: Object.freeze({ per: [6, 12], thick: [0.003, 0.005], flat: [0.35, 0.5], cover: [1.3, 1.2], grooves: [2, 1], depth: [0.2, 0.35], min: 0.012, hang: 0.018, round: 0.85 }),
  moustache: Object.freeze({ flows: [4, 2], stroke: [0.004, 0.007], thick: [0.0025, 0.004], flat: [0.3, 0.45], cover: [1.2, 1.1], grooves: [2, 1], depth: [0.2, 0.3], min: 0, lift: 0.0004, mass: 0.3 }),
  brow: Object.freeze({ flows: [6, 3], stroke: [0.0025, 0.004], thick: [0.0008, 0.0014], flat: [0.25, 0.4], cover: [1.3, 1.2], grooves: [1, 0], depth: [0.15, 0.3], min: 0, lift: 0.0003, mass: 0.12 }),
});
/** a face flow's least width and thickness (m) */
export const FACE_MIN = Object.freeze({ width: 0.0006, thick: 0.00015 });
/** a face tract's dial numbers at `s` */
function faceStyleAt(kind, s) {
  const o = {};
  for (const [k, v] of Object.entries(FACE_LOCKS[kind])) o[k] = Array.isArray(v) ? lerp(v[0], v[1], s) : v;
  o.grooves = Math.round(o.grooves);
  return o;
}
/**
 * The face tract's shapes: `guides` [{ pts }] (chart frame, root first) on `chart`, `kind` 'beard' | 'moustache' |
 * 'brow' (FACE_LOCKS), split by the face's middle when `sides` (a moustache's halves, a brow each), `under(p)` the height
 * (m) a band lies over at a point; one closed mesh in `group`, or null. Deterministic.
 *
 *   lockStrands(guides, chart, { kind, centre, stylize, level, group, sides, under }) → { mesh, flows } | null
 */
export function lockStrands(guides, chart, { kind = 'beard', centre = [0, 0, 0], stylize = HAIR_STYLIZE, level = 'L1', group = 'Beard', sides = false, under = () => 0 } = {}) {
  const s = readStylize(stylize), F = faceStyleAt(kind, s), St0 = lockStyleAt(s), St = F.round ? { ...St0, round: Math.max(St0.round, F.round) } : St0, R = LOCK_RUNG[level] ?? LOCK_RUNG.L1, skin = surfaceClear(chart, 0.02);
  const banded = F.flows !== undefined, height = (p) => { const i = skin.nearest(p); if (i < 0) return null; const n = unit(chart.normals[i]); return { h: dot(sub(p, chart.vertices[i]), n), n }; };
  const tipOff = (g) => height(g.pts.at(-1))?.h ?? Infinity;
  const live = guides.filter((g) => g.pts.length > 1 && arcOf(g.pts).at(-1) >= F.min && !(F.hang && tipOff(g) < F.hang));
  if (!live.length) return null;
  // (the guides' spacing: each root's nearest other's distance, the median)
  // (a lone guide has no neighbour: the spacing's default, never an infinite one that made every point of its flow NaN)
  const roots = live.map((g) => g.pts[0]), near = roots.map((p, i) => Math.min(...roots.map((q, j) => (i === j ? Infinity : len(sub(p, q)))))).filter(Number.isFinite).sort((a, b) => a - b);
  const spacing = Math.max(0.0005, near[Math.floor(near.length / 2)] ?? 0.002);
  // (a band over what is under it; a beard's hang off the skin alone, its root inside the coat)
  const clear = banded ? (p) => skin.out(p, under(p) + HAIR_CLEAR.gap) : (p) => skin.out(p, HAIR_CLEAR.gap);
  const feats = live.map((g) => { const cum = arcOf(g.pts), m = at(g.pts, cum, 0.4), e = at(g.pts, cum, 1); return [...g.pts[0], ...scl(m, 0.8), ...scl(e, 0.4)]; });
  const halves = sides ? [(i) => live[i].pts[0][0] < 0, (i) => live[i].pts[0][0] >= 0] : [() => true];
  const M = { vertices: [], faces: [], groups: [] };
  let flows = 0;
  /** a flow lofted from its members' guides, each point held by `bound` (a band's) */
  const loft = (members, bound) => {
    const Lm = members.reduce((a, i) => a + arcOf(live[i].pts).at(-1), 0) / members.length;
    const n = Math.max(3, Math.min(R.stations, Math.ceil(Lm / Math.min(R.seg, Math.max(0.002, Lm / 4)))));
    const rs = members.map((i) => resample(live[i].pts, n));
    let spine = rs[0].map((_, j) => clear(bound(scl(rs.reduce((a, P) => add(a, P[j]), [0, 0, 0]), 1 / rs.length))));
    // (a band's flow a STROKE laid on its mass: its spine at the mass's top, its section straight)
    if (banded) spine = spine.map((p) => { const a = height(p); return a ? add(p, scl(a.n, under(p) + HAIR_CLEAR.gap + F.lift + F.thick * 0.6 - a.h)) : p; });
    const outAt = (i, t) => unit(perp(sub(spine[i], centre), t), unit(perp([0, 0, 1], t), [0, 1, 0])), margin = 0.5 * spacing * F.cover;
    // (a hang's section through its guides across it: a smooth arc on past the outermost by the margin)
    const rail = (i, x, A) => {
      const t = unit(sub(spine[Math.min(n, i + 1)], spine[Math.max(0, i - 1)])), o = unit(cross(A, t));
      const pts = rs.map((P) => sub(P[i], spine[i])).map((q) => [dot(q, A), dot(q, o)]), xs = pts.map((q) => q[0]);
      const lo = Math.min(...xs) - margin, hi = Math.max(...xs) + margin, X = (lo + hi) / 2 + ((x * (hi - lo)) / 2) * profile(i / n, St, {});
      const f = parabola(pts, { spread: spacing, rise: 0.004 }), Xc = Math.max(Math.min(...xs), Math.min(Math.max(...xs), X));
      return add(spine[i], add(scl(A, X), scl(o, f(Xc))));
    };
    const spread = Math.max(...rs.map((P) => len(sub(P[0], spine[0])))) * 2 + spacing, w0 = banded ? Math.min(F.stroke, F.cover * spread) : F.cover * spread;
    // (never finer than FACE_MIN at its tip: a ring a few microns across, pushed off the skin, folds flat)
    const width = (u) => Math.max(FACE_MIN.width, w0 * profile(u, St, {})), thick = (u) => Math.max(FACE_MIN.thick, Math.min(F.thick, width(u) * F.flat) * (0.35 + 0.65 * smooth(0, 0.25, u)));
    loftLock(M, spine, { width, thick, grooves: R.ring < 8 ? 0 : F.grooves, depth: F.depth, ring: Math.max(6, R.ring - 2), outAt, group: () => group, clear, rail: rs.length > 1 && !banded ? rail : null, tipOut: FACE_MIN.width });
    flows++;
  };
  for (const half of halves) {
    const mine = live.map((_, i) => i).filter(half);
    if (!mine.length) continue;
    // (a band's MASS: its whole shape along it; its strokes over it, inside it)
    const bound = banded && mine.length > 2 ? browMass(M, mine.map((i) => live[i]), { F, R, centre, group, height, clear }) : (p) => p;
    const k = banded ? Math.round(F.flows) : Math.max(1, Math.round(mine.length / F.per));
    for (const g of gather(mine.map((i) => feats[i]), Math.min(k, mine.length))) loft(g.map((q) => mine[q]), bound);
  }
  return M.faces.length ? { mesh: { ...M, closure: 'closed' }, flows } : null;
}
/** the principal direction of points (power iteration on their covariance, from x) */
function axisOf(P) {
  const c = scl(P.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / P.length), C = [0, 1, 2].map((r) => [0, 1, 2].map((q) => P.reduce((a, p) => a + (p[r] - c[r]) * (p[q] - c[q]), 0)));
  let v = [1, 0, 0];
  for (let k = 0; k < 24; k++) v = unit(C.map((row) => dot(row, v)), v);
  return { c, v };
}
/**
 * A BAND's MASS (a brow's, a moustache half's): one flat lock ALONG it (its roots' principal direction, medial to lateral), `FACE_BROW.stations`
 * along it, each as wide as `reach` of the brow's hairs cover there across it (a share: a stray hair is no part of its
 * shape), its HEAD (the medial end) rounded over `head` of its length and its TAIL drawn in over `tail` to a third,
 * by `cover`, wrapped on the skin; its flows lie over it, inside it: → `bound(p)`, a point held within `inside` of its
 * width across it (a flow is a stroke in the brow, never a tuft off it). Pushes into `M`.
 */
export const FACE_BROW = Object.freeze({ stations: 9, head: 0.15, tail: 0.35, reach: 0.8, cover: 1.25, inside: 0.85 });
function browMass(M, guides, { F, R, centre, group, height, clear }) {
  const pts = guides.flatMap((g) => resample(g.pts, 3)), { c, v } = axisOf(guides.map((g) => g.pts[0]));
  const along = pts.map((p) => dot(sub(p, c), v)), t0 = Math.min(...along), t1 = Math.max(...along), n = FACE_BROW.stations;
  const out = unit(sub(c, centre)), B = unit(cross(out, v));
  // (each station its bin's points: their middle and their reach across)
  const bins = Array.from({ length: n + 1 }, (_, j) => { const t = t0 + ((t1 - t0) * j) / n, h = (t1 - t0) / n; return pts.filter((_, q) => Math.abs(along[q] - t) <= h); });
  const mids = bins.map((b, j) => (b.length ? scl(b.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / b.length) : add(c, scl(v, t0 + ((t1 - t0) * j) / n))));
  const half = bins.map((b, j) => { const d = b.map((p) => Math.abs(dot(sub(p, mids[j]), B))).sort((x, y) => x - y); return d.length ? d[Math.floor((d.length - 1) * FACE_BROW.reach)] : 0; });
  // (the head the end nearer the face's middle)
  const medialFirst = Math.abs(mids[0][0]) <= Math.abs(mids[n][0]), shape = (u) => { const m = medialFirst ? u : 1 - u; return Math.sqrt(smooth(0, FACE_BROW.head, m)) * (1 - (2 / 3) * smooth(1 - FACE_BROW.tail, 1, m)); };
  const spine = mids.map(clear), end = (u) => Math.min(1, 0.3 + shape(u));
  const w = (u) => { const j = Math.min(n, Math.round(u * n)); return Math.max(0.0008, 2 * half[j] * FACE_BROW.cover) * (0.2 + 0.8 * shape(u)); };
  const outAt = (i, t) => unit(perp(sub(spine[i], centre), t), out);
  // (wrapped on the skin: a section's point laid at the gap off it, never a chord across the brow's ridge)
  const rail = (i, x, A) => { const p = add(spine[i], scl(A, (x * w(i / n)) / 2)), a = height(p); return a ? add(p, scl(a.n, HAIR_CLEAR.gap - a.h)) : p; };
  loftLock(M, spine, { width: w, thick: (u) => Math.min(F.thick * 0.6, w(u) * F.mass) * (0.4 + 0.6 * end(u)), ring: Math.max(6, R.ring - 2), outAt, group: () => group, clear, rail, tipOut: FACE_MIN.width });
  return (p) => {
    const t = Math.max(t0, Math.min(t1, dot(sub(p, c), v))), u = (t - t0) / (t1 - t0), j = Math.min(n, Math.round(u * n)), lim = (FACE_BROW.inside * w(u)) / 2;
    const d = dot(sub(p, spine[j]), B), q = Math.max(-lim, Math.min(lim, d));
    return add(p, scl(B, q - d));
  };
}
/**
 * A BEARD's SCULPTED COAT (realistic laws 10; the coil's procedure on the face): the coat raised at each point to where
 * its hairs stand off the skin there (its nearest `guides`' reach off their roots' skin, weighted by nearness, at most
 * `max` m: a longer hair hangs as a flow), lumped by the dial's `puff` (m across) and `lump` (a share of the height),
 * finer at 0, chunkier at 1; at least the cap's height. → height(p), m: hair-depict.js capMesh's `height`, and the
 * height a beard's flows lie over.
 */
export const FACE_SHELL = Object.freeze({ max: 0.009, near: 0.012, puff: [0.006, 0.014], lump: [0.15, 0.3] });
export function beardShell(chart, guides, { stylize = HAIR_STYLIZE, seed = 1 } = {}) {
  const s = readStylize(stylize), skin = surfaceClear(chart, 0.02), puff = lerp(...FACE_SHELL.puff, s), lump = lerp(...FACE_SHELL.lump, s);
  const reach = guides.map((g) => { const i = skin.nearest(g.pts[0]), n = i < 0 ? [0, 0, 1] : unit(chart.normals[i]); return Math.min(FACE_SHELL.max, Math.max(0, ...g.pts.map((p) => dot(sub(p, g.pts[0]), n)))); });
  const roots = guides.map((g) => g.pts[0]), cell = FACE_SHELL.near, grid = new Map(), key = (p) => p.map((v) => Math.floor(v / cell)).join(',');
  roots.forEach((p, i) => { const k = key(p); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  return (p) => {
    const c = p.map((v) => Math.floor(v / cell)); let v = 0, w = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) for (const i of grid.get(`${c[0] + a},${c[1] + b},${c[2] + e}`) || []) { const d = len(sub(p, roots[i])); if (d < cell) { const k = 1 / (d + 0.002) ** 2; v += k * reach[i]; w += k; } }
    const h = w ? v / w : 0, q = scl(p, 1 / puff), n = 0.65 * noise3(q, seed) + 0.35 * noise3(scl(q, 2.1), seed + 7);
    return Math.max(HAT_CAP.height, h * (1 + lump * (2 * n - 1)));
  };
}
