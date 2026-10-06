// THE SERPENT MAKER — a species-free generator for legless squamates (snakes, sea serpents): a path3 loft body laid
// along a centre-line path (raised / coiled / arched / any points), a short trunk + neck + snake skull at its head
// end, optional hood, rattle and crest, markings on the body. `serpent(params)` (or the original `serpentMaker`)
// returns fauna params with family 'squamate' that buildFauna accepts merged over the squamate family table.
// Units: metres at TRUE size (scale 1), +y the head, z up, the ground z = 0.
//
// serpent(params) — every field optional (defaults: a generic ~2 m ground-S snake). Fields:
//   name     string
//   path     the body centre line, head end first (see below): { kind: 'raised' | 'coil' | 'arches' | 'pts', … }
//   n        loft stations along the body, 24 … 200 (default 80)
//   girth    [halfWidth, halfHeight] m at the profile's 1.0 (0.003 … 2)
//   profile  [[u, ×], …] girth multiplier along the arc, u 0 (head) → 1 (tail tip), u ascending
//   up       the loft's stable frame vector, never along the path: [0, 1, -1] ground S / reared front, [1, 0, 0] a path
//            in the x = 0 plane (arches)
//   hood     { width m, from, peak, to (m of arc) } a cobra hood
//   head     { shape: 'blunt' | 'viper' | 'slender' | 'coffin' | 'dragon', scale (0.05 … 6; 0.42 = a 3.7 m python's
//            head), skull: [width ×, height ×] (the skull rows' flattening — e.g. blunt [1.15, 0.55]), muzzle: [width ×,
//            length ×], eyeR m, eyeAt [station, slot], ornaments [...], tongue true|false }
//   tail     { kind: 'taper' } | { kind: 'rattle', beads 3 … 14 }
//   crest    { every, above, len: [base, ×girth], from, to } upright back blades
//   pattern  markings on part 'body' (band / belly / stripes / patch; t 0 = belly, 1 = back)
//   colors   the family colour slots (coat, belly, brow, iris, tip, horn, mane …)
// PATH kinds (control points [x, y, h], h = belly height above the ground):
//   raised  { height, lean = 0.55, ground: [[x, y], …] }     coil { height, neck: [[y, h], …], centre: [x, y],
//   r: [inner, outer], turns, a0, lift: [[x, y, h], …] }      arches { height, neck, start, humps: [[h, w], …], gap, run }
//   pts     { pts: [[x, y, h], …] }

export const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
export const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
// the skull rows (the crocodilian's, from the canine): reshaped per species by flat() + muzzleW / muzzleLen
export const SKULL = [
  ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
  ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
  ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
  ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
  ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
  ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
  ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
];
export const JAW = [
  ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
  ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
  ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
  ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
  ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
];
// the SNAKE skull rows (serpents only; the monitor keeps SKULL): a solid rounded wedge — a domed crown, deep
// cheeks carried down to a jaw that is a visible lower half, the snout staying thick and rounding off at the tip
// (not the crocodilian's thin plate). Authored at kx = kz = 1 as a python: ~0.21 wide, ~0.19 deep at the back.
export const SNAKE_SKULL = [
  ['st0', -0.15, 0.06, [0.035, 0.058], [0.068, 0.036], [0.08, -0.005], [0.072, -0.04], [0.052, -0.06], -0.065],
  ['st1', -0.09, 0.086, [0.042, 0.083], [0.085, 0.056], [0.105, 0.005], [0.1, -0.04], [0.076, -0.064], -0.07],
  ['st2', -0.02, 0.084, [0.041, 0.081], [0.084, 0.055], [0.1, 0.005], [0.095, -0.038], [0.071, -0.06], -0.065],
  ['st3', 0.04, 0.076, [0.036, 0.073], [0.075, 0.05], [0.088, 0.005], [0.083, -0.035], [0.063, -0.055], -0.06],
  ['st4', 0.10, 0.065, [0.031, 0.063], [0.064, 0.042], [0.074, 0.003], [0.069, -0.032], [0.051, -0.05], -0.054],
  ['st5', 0.16, 0.05, [0.025, 0.048], [0.05, 0.031], [0.057, 0.0], [0.053, -0.028], [0.039, -0.043], -0.047],
  ['st6', 0.20, 0.033, [0.016, 0.032], [0.032, 0.019], [0.036, -0.004], [0.033, -0.024], [0.024, -0.034], -0.039],
];
export const SNAKE_JAW = [
  ['st0', -0.07, { gum: -0.064, gumR: [0.07, -0.064], jaw: [0.073, -0.094], bottom: -0.106 }],
  ['st1', 0.0, { gum: -0.063, gumR: [0.068, -0.063], jaw: [0.069, -0.09], bottom: -0.1 }],
  ['st2', 0.07, { gum: -0.057, gumR: [0.058, -0.057], jaw: [0.058, -0.08], bottom: -0.088 }],
  ['st3', 0.14, { gum: -0.049, gumR: [0.045, -0.049], jaw: [0.045, -0.067], bottom: -0.074 }],
  ['st4', 0.19, { gum: -0.041, gumR: [0.029, -0.041], jaw: [0.028, -0.054], bottom: -0.059 }],
];
export const SNAKE_CAPS = { craniumCaps: { back: [0, -0.18, 0.01], tip: [0, 0.215, -0.004] }, jawCaps: { back: [0, -0.1, -0.075], tip: [0, 0.2, -0.048] } };
export const loftOf = (pts) => pts.map(([x, y, z, r]) => ({ at: [x, y, z], r }));

/** A SINUOUS body on the ground: a loft whose centre line is an S (x = amp·sin, y running back), at height = the
 * ring's half-height, so the belly rests on z = 0. Stations every `step` of arc, radii tapering from `r0` to the tail.
 * Returns [x, y, z, [halfWidth, halfHeight]] rows, starting at (0, y0) heading back (−y). */
export function sinuous({ y0 = 0, length = 3, amp = 0.4, waves = 1.25, back = 2, r0 = [0.08, 0.065], taper = [[0, 1], [0.5, 1], [0.8, 0.6], [1, 0.12]], n = 26, x0 = 0 }) {
  // sample the curve finely, then re-sample by arc length
  const f = (t) => [x0 + amp * Math.sin(2 * Math.PI * waves * t), y0 - back * t];
  const fine = Array.from({ length: 400 }, (_, i) => f(i / 399)); const s = [0];
  for (let i = 1; i < fine.length; i++) s.push(s[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]));
  const L = s[s.length - 1], k = length / L;   // scale the S so its arc is `length`
  const tap = (u) => { for (let i = 1; i < taper.length; i++) if (u <= taper[i][0]) { const [a, va] = taper[i - 1], [b, vb] = taper[i]; return va + (vb - va) * (u - a) / (b - a); } return taper[taper.length - 1][1]; };
  return Array.from({ length: n }, (_, j) => { const u = j / (n - 1), target = u * L; let i = s.findIndex((x) => x >= target); if (i < 0) i = s.length - 1;
    const [x, y] = fine[i]; const r = r0.map((v) => v * tap(u)); return [x0 + (x - x0) * k, y0 + (y - y0) * k, r[1], r]; });
}

/** A 3D SERPENT PATH: a smooth loft centre line through control points [x, y, h] (h = the BELLY's height above the
 * ground; the centre sits r[1] above it, so h = 0 rests the ring on z = 0), sampled by arc length into `n` stations.
 * Radii taper from `r0` along the arc (`taper` as in sinuous), and `shape(s, r)` (s = metres of arc from the first
 * point) may reshape a ring (a cobra's hood). Raised parts, coils and arches are just control points; give the loft a
 * stable frame (`up`) that is never parallel to the path. Returns [x, y, z, [rs, rf]] rows. */
export function path3({ pts, n = 60, r0 = [0.05, 0.045], taper = [[0, 1], [1, 1]], shape = null }) {
  const cr = (a, b, c, d, t) => a.map((_, i) => 0.5 * (2 * b[i] + (c[i] - a[i]) * t + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * t * t + (3 * b[i] - a[i] - 3 * c[i] + d[i]) * t * t * t));
  const P = [pts[0], ...pts, pts[pts.length - 1]], fine = [];
  for (let i = 1; i < P.length - 2; i++) for (let j = 0; j < 40; j++) fine.push(cr(P[i - 1], P[i], P[i + 1], P[i + 2], j / 40));
  fine.push(pts[pts.length - 1]);
  const s = [0]; for (let i = 1; i < fine.length; i++) s.push(s[i - 1] + Math.hypot(...fine[i].map((x, c) => x - fine[i - 1][c])));
  const L = s[s.length - 1];
  const tap = (u) => { for (let i = 1; i < taper.length; i++) if (u <= taper[i][0]) { const [a, va] = taper[i - 1], [b, vb] = taper[i]; return va + (vb - va) * (u - a) / (b - a); } return taper[taper.length - 1][1]; };
  return Array.from({ length: n }, (_, j) => { const u = j / (n - 1), target = u * L; let i = s.findIndex((x) => x >= target); if (i < 0) i = s.length - 1;
    let r = r0.map((v) => v * tap(u)); if (shape) r = shape(target, r);
    const [x, y, h] = fine[i]; return [x, y, Math.max(0, h) + r[1] + 1e-5 * j, r]; });   // + a 10 µm ramp: the builder's cap pass (loftPart) refuses a ring whose axis is exactly level and off y
}
/** The closed loft for a path3 / sinuous body: stations plus caps pushed out along the end directions. */
const bodyLoft = (name, rows, up, group = 'Coat') => { const end = (a, b) => { const d = a.slice(0, 3).map((x, c) => x - b[c]), m = Math.hypot(...d), k = 0.5 * Math.max(...a[3]) / m; return a.slice(0, 3).map((x, c) => x + d[c] * k); };
  return { name, kind: 'loft', slots: 'ring12', group, mirror: null, up, stations: loftOf(rows), caps: { back: end(rows[0], rows[1]), tip: end(rows.at(-1), rows.at(-2)) } }; };
/** A flat SPIRAL on the ground (control points): centre [cx, cy], radius ρ0 → ρ1 over `turns`, from angle a0 (0 = +x),
 * turning `dir` (+1 counter-clockwise), belly height h (a function of the turn fraction, for a stacked inner coil). */
export const spiral = ({ c = [0, 0], r0 = 0.1, r1 = 0.2, turns = 1, a0 = 0, dir = 1, k = 16, h = () => 0 }) => Array.from({ length: Math.round(k * turns) + 1 }, (_, i) => {
  const f = i / Math.round(k * turns), a = a0 + dir * 2 * Math.PI * turns * f, r = r0 + (r1 - r0) * f; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), h(f)]; });

// the FORKED TONGUE (opt-in ornament): two thin prongs flicked out from under the snout tip, splayed apart
export const TONGUE = [-1, 1].map((s, i) => ({ kind: 'sweep', name: `tongue${i}`, at: [5.95, 6], space: 'local', spine: [[0, 0, -0.004], [0, 0.02, 0.004], [s * 0.008, 0.04, 0.006]], radii: [0.004, 0.003, 0.0012], m: 5, group: 'Tongue' }));

// ── THE SERPENT MAKER: one species-free generator for legless squamates (the snake above predates it and is kept as
// authored). serpentMaker(spec) returns species params; a serpent is a short call to it. The parts:
//   path    the body's centre line from just behind the head to the tail tip (control points [x, y, h], h = belly
//           height; see path3), by kind:
//             { kind: 'raised', height, lean = 0.55, ground: [[x, y] …] }   a column reared straight up to `height`, curving
//                     back over `lean` m onto the ground, then the ground points (an S)
//             { kind: 'coil', height, neck: [[y, h] …], centre: [x, y], r: [inner, outer], turns, a0, lift: [[x, y, h] …] }
//                     an S neck down onto the inner end of a flat ground spiral, then the lifted tail points
//             { kind: 'arches', height, neck: [[y, h] …], start, humps: [[h, w] …], gap = 1, run }   a swan neck out of
//                     the water, humps whose feet sit on z = 0, a flat `run` of tail
//             { kind: 'pts', pts }   any control points
//   length (m, documented; the path's own arc is what builds), n (stations), girth: [half-width, half-height] and
//           profile: [[u, ×] …] along the arc (head end u = 0)
//   up      the loft's stable frame (never along the path): [0, 1, -1] for a ground S / raised front, [1, 0, 0] for a
//           path in the x = 0 plane
//   hood    { width, from, peak, to } (m of arc): the rings widened across and thinned front-to-back (a cobra's hood)
//   head    { shape: 'blunt' | 'viper' | 'slender' | 'coffin' | 'dragon', scale, skull: [kx, kz], muzzle: [w, len], eyeR, eyeAt, ornaments, tongue = true }
//           skull = [width ×, HEIGHT ×] of the skull rows and muzzle = [muzzleW, muzzleLen] override the shape's (HEAD_SHAPES)
//           (the tongue scales with the head) a shape sets the skull's flattening and the muzzle; eye / orbit / brow / nostril are authored at a
//           python-size head (0.42) and scale with it (headRelative), so a small head builds
//   tail    { kind: 'taper' } | { kind: 'rattle', beads } | { kind: 'fin', height }   (the taper is the profile's end)
//   crest   { every = 3, above = 1.4, len: [base, ×girth], from, to }   upright blades out of the back (a frill)
//   pattern markings on the part 'body' (build.js markings). With up [0, 1, -1] a ring's t = 0 is the BELLY on the ground
//           and the throat (facing +y) where reared; t = 1 the back. colors as the family's
// skull = [width ×, height ×] over SNAKE_SKULL (a python at [1, 1]); the dragon keeps the long crocodilian rows (croc)
export const HEAD_SHAPES = {
  blunt: { skull: [1.05, 0.8], muzzle: [1.0, 0.9] }, viper: { skull: [1.4, 0.78], muzzle: [0.62, 0.8] },
  slender: { skull: [0.95, 0.85], muzzle: [0.9, 0.85] }, coffin: { skull: [0.8, 0.75], muzzle: [0.9, 1.15] }, dragon: { skull: [0.95, 0.75], muzzle: [0.95, 1.45], croc: true },
};
/** The serpent head rows + caps for a shape: SNAKE_SKULL (or the crocodilian SKULL for `croc`) flattened by [kx, kz]. */
export function snakeHead([kx, kz], croc = false) {
  if (croc) return { craniumRows: flat(SKULL, kx, kz), jawRows: flatJaw(JAW, kx, kz) };
  const c = (q) => [q[0], q[1], q[2] * kz];
  return { craniumRows: flat(SNAKE_SKULL, kx, kz), jawRows: flatJaw(SNAKE_JAW, kx, kz),
    craniumCaps: { back: c(SNAKE_CAPS.craniumCaps.back), tip: c(SNAKE_CAPS.craniumCaps.tip) }, jawCaps: { back: c(SNAKE_CAPS.jawCaps.back), tip: c(SNAKE_CAPS.jawCaps.tip) } };
}
const bump = (s, a, m, b) => (s <= a || s >= b ? 0 : s < m ? Math.sin((Math.PI / 2) * (s - a) / (m - a)) : Math.cos((Math.PI / 2) * (s - m) / (b - m)));
function serpentPath(p) {
  if (p.kind === 'pts') return p.pts;
  const H = p.height;
  if (p.kind === 'raised') { const l = p.lean ?? 0.55;
    return [[0, -0.03, H], [0, -0.05, 0.79 * H], [0, -0.08, 0.58 * H], [0, -0.24 * l, 0.38 * H], [0, -0.4 * l, 0.19 * H], [0, -0.65 * l, 0.05 * H], [0, -l, 0], ...p.ground.map(([x, y]) => [x, y, 0])]; }
  if (p.kind === 'coil') { const [c, [r0, r1]] = [p.centre, p.r];
    return [[0, 0, H], ...p.neck.map(([y, h]) => [0, y, h]), ...spiral({ c, r0, r1, turns: p.turns, a0: p.a0 ?? Math.PI / 2, k: 20 }).slice(1), ...(p.lift || [])]; }
  if (p.kind === 'arches') { const out = [[0, -0.4, H], ...p.neck.map(([y, h]) => [0, y, h])]; let y = p.start;
    const hump = (y0, h, w) => [[0, y0 - 0.15 * w, 0.15 * h], [0, y0 - 0.27 * w, 0.75 * h], [0, y0 - 0.5 * w, h], [0, y0 - 0.73 * w, 0.75 * h], [0, y0 - 0.85 * w, 0.15 * h], [0, y0 - w, 0]];
    out.push([0, y + 0.6, 0], [0, y, 0]); for (const [h, w] of p.humps) { out.push(...hump(y, h, w)); y -= w + (p.gap ?? 1); out.push([0, y, 0]); }
    out.push([0, y - p.run, 0]); return out; }
  throw new Error(`serpentMaker: path kind '${p.kind}'`);
}
/** The RATTLE: a loft of keratin beads (wide / waist / wide …) carried on along the tail's last direction. */
function rattleOf(rows, beads = 7, len = 0.0095, w0 = [0.016, 0.0095]) { const a = rows.at(-1), b = rows.at(-2), d = a.slice(0, 3).map((x, c) => x - b[c]), m = Math.hypot(...d), u = d.map((x) => x / m);
  const st = []; for (let i = 0; i <= 2 * beads; i++) { const t = (i / 2) * len - 0.004, w = (i % 2 ? 0.55 : 1) * (1 - 0.25 * i / (2 * beads)); st.push([a[0] + u[0] * t, a[1] + u[1] * t, a[2] + u[2] * t, w0.map((x) => x * w)]); }
  return bodyLoft('rattle', st, [0, 0, 1], 'Horn'); }
/** The CREST: upright blades standing out of the back of a path in the x = 0 plane (the side away from its inner
 * curve), thin across, long along the body; returns their joints and midline segments. */
function crestOf(rows, { every = 3, above = 1.4, from = 4, to = rows.length - 16, len = [0.55, 0.5] }) { const J = {}, segs = [];
  rows.forEach((row, i) => { if (i < from || i > to || i % every || row[2] < above) return; const a = rows[i - 1], b = rows[i + 1], d = [b[1] - a[1], b[2] - a[2]], m = Math.hypot(...d), n = [d[1] / m, -d[0] / m];
    const r = row[3][0], L = len[0] + len[1] * r, k = segs.length; J[`fin${k}a`] = [0, row[1] + n[0] * 0.7 * r, row[2] + n[1] * 0.7 * r]; J[`fin${k}b`] = [0, row[1] + n[0] * (r + L), row[2] + n[1] * (r + L)];
    segs.push({ name: `fin${k}`, kind: 'segment', from: `fin${k}a`, to: `fin${k}b`, rA: [0.05, 0.42 * r + 0.08], rB: [0.012, 0.05], slots: 'ring12', group: 'Mane', mirror: 'plane', over: [0.2, 0.2] }); });
  return { J, segs }; }
/** A body that TURNS past side-on (a coil) cannot be one stable-frame loft: the builder's ring frame keeps its side
 * vector on +x, so the ring's handedness flips where the path's side swings through x = 0 (a winding error). Such a
 * body is cut into lofts at those flips (`body0`, `body1` …, each closed, butting cap to cap), and the markings on
 * 'body' are re-addressed onto the pieces (stripes and patch grids become their bands first). One piece: unchanged. */
function sideSign(rows, i, U) { const a = rows[Math.max(i - 1, 0)], b = rows[Math.min(i + 1, rows.length - 1)], d0 = [0, 1, 2].map((c) => b[c] - a[c]), m = Math.hypot(...d0), d = d0.map((x) => x / m);
  const u = Math.hypot(...U), Uu = U.map((x) => x / u), k = Uu[0] * d[0] + Uu[1] * d[1] + Uu[2] * d[2], f = Uu.map((x, c) => x - d[c] * k); return Math.sign(f[1] * d[2] - f[2] * d[1]); }
function splitBody(rows, up, marks) {
  const cuts = [0]; for (let i = 1; i < rows.length; i++) if (sideSign(rows, i, up) !== sideSign(rows, i - 1, up)) cuts.push(i);
  if (cuts.length === 1) return { parts: [bodyLoft('body', rows, up)], marks };
  cuts.push(rows.length); const N = rows.length - 1, pieces = cuts.slice(0, -1).map((a, k) => [a, cuts[k + 1] - 1]).filter(([a, b]) => b - a >= 2);
  const bands = marks.flatMap((M) => { if (M.on !== 'body') return [M]; const R = M.run ?? [0, 1], T = M.t ?? [0, 1], g = { group: M.group, ...(M.color ? { color: M.color } : {}) };
    if (M.kind === 'band') return [{ ...g, run: R, t: T }]; if (M.kind === 'belly') return [{ ...g, run: R, t: [M.from ?? 0.6, 1] }];
    if (M.kind === 'stripes') { const n = M.count ?? 8, per = (R[1] - R[0]) / n, w = per * (M.width ?? 0.5); return Array.from({ length: n }, (_, i) => ({ ...g, run: [R[0] + per * (i + 0.5) - w / 2, R[0] + per * (i + 0.5) + w / 2], t: T })); }
    if (M.kind === 'patch') { const [na, nt] = M.grid ?? [6, 3], ca = (R[1] - R[0]) / na, ct = (T[1] - T[0]) / nt, sz = M.size ?? 0.7, [sa, st] = Array.isArray(sz) ? sz : [sz, sz], out = [];
      for (let j = 0; j < nt; j++) for (let i = 0; i < na; i++) { const a = R[0] + ca * (i + 0.5), t = T[0] + ct * (j + 0.5); out.push({ ...g, run: [a - ca * sa / 2, a + ca * sa / 2], t: [t - ct * st / 2, t + ct * st / 2] }); } return out; }
    throw new Error(`splitBody: marking kind '${M.kind}' on a split body`); });
  const out = []; for (const B of bands) { if (!B.run) { out.push(B); continue; }
    pieces.forEach(([a, b], k) => { const lo = (B.run[0] * N - a) / (b - a), hi = (B.run[1] * N - a) / (b - a); if (hi > 0 && lo < 1) out.push({ on: `body${k}`, kind: 'band', group: B.group, ...(B.color ? { color: B.color } : {}), run: [Math.max(0, lo), Math.min(1, hi)], t: B.t }); }); }
  return { parts: pieces.map(([a, b], k) => bodyLoft(`body${k}`, rows.slice(a, b + 1), up)), marks: out };
}
export function serpentMaker({ name, path, n = 80, girth, profile = [[0, 1], [1, 0.1]], up = [0, 1, -1], hood = null, head = {}, tail = { kind: 'taper' }, crest = null, pattern = [], colors }) {
  const shape = hood ? (s, r) => { const w = bump(s, hood.from, hood.peak, hood.to); return [r[0] + (hood.width - r[0]) * w, r[1] * (1 - 0.6 * w)]; } : null;
  const rows = path3({ n, r0: girth, taper: profile, pts: serpentPath(path), shape });
  // the trunk: a short level piece at the head end of the path (its top is the reared height), the neck, the head
  const [x0, y0, z0] = rows[0], g = rows[0][3].map((v) => v * 0.85), gl = Math.max(...g);
  const H0 = HEAD_SHAPES[head.shape || 'blunt'], H = { skull: head.skull ?? H0.skull, muzzle: head.muzzle ?? H0.muzzle }, hs = head.scale ?? 0.42, tk = H0.croc ? 1 : 0.55;
  const body = splitBody(rows, up, pattern), extra = [...body.parts];
  if (tail.kind === 'rattle') extra.push(rattleOf(rows, tail.beads));
  let crestJ = {};
  if (crest) { const c = crestOf(rows, crest); crestJ = c.J; extra.push(...c.segs); }
  return {
    family: 'squamate', name, scale: 1, legs: [], levelLegs: false,
    joints: { neckBase: [x0, y0 + 1.2 * gl, z0], neckTop: [x0, y0 + 2.4 * gl, z0 + 0.06 * gl], ...crestJ },
    torso: [{ at: [x0, y0 - 0.5 * gl, z0], r: g }, { at: [x0, y0 + 1.4 * gl, z0], r: g.map((v) => v * 0.9) }],
    torsoCaps: { back: [x0, y0 - 1.3 * gl, z0], tip: [x0, y0 + 2.2 * gl, z0] },
    neckRA: g.map((v) => v * 0.9), neckRB: g.map((v) => v * 0.78), neckRMid: g.map((v) => v * 0.84),
    ...snakeHead(H.skull, H0.croc),
    headScale: hs, muzzleW: H.muzzle[0], muzzleLen: H.muzzle[1], headRelative: 0.42, relBrow: true,
    eyeAt: head.eyeAt ?? (H0.croc ? [2.2, 2.3] : [2.4, 2.9]), eyeR: head.eyeR ?? 0.006, orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.0015 },
    headOrnaments: [...(head.tongue === false ? [] : TONGUE.map((o) => ({ ...o, spine: o.spine.map((q) => q.map((v) => v * tk * hs / 0.42)), radii: o.radii.map((v) => v * tk * hs / 0.42) }))), ...(head.ornaments || [])],
    extraSegments: extra, markings: body.marks, colors,
  };
}

// ── THE DOOR ────────────────────────────────────────────────────────────────────────────────────────────────────
export const SERPENT_DEFAULTS = {
  name: 'a snake', girth: [0.035, 0.03], profile: [[0, 0.7], [0.2, 1], [0.7, 1], [0.9, 0.5], [1, 0.1]],
  path: { kind: 'pts', pts: [[0, -0.03, 0.06], [0, -0.15, 0.02], [0, -0.3, 0], [0.15, -0.5, 0], [0.18, -0.75, 0], [0, -0.95, 0], [-0.18, -1.15, 0], [-0.15, -1.4, 0], [0.05, -1.6, 0]] },
  head: { shape: 'blunt', scale: 0.2, eyeR: 0.006 },
  pattern: [{ on: 'body', kind: 'band', t: [0, 0.3], group: 'Belly' }],
  colors: { coat: '#6b6a45', sock: '#6b6a45', ash: '#85825a', ashAlt: '#7a7850', brow: '#46452c', belly: '#cfc79a', iris: '#9a8a3a', tip: '#46452c' },
};
export const SERPENT_KEYS = ['name', 'path', 'n', 'girth', 'profile', 'up', 'hood', 'head', 'tail', 'crest', 'pattern', 'colors'];
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** Validate serpent params; throws an Error naming the field and what it takes. */
export function validateSerpent(p = {}) {
  if (!isObj(p)) throw new Error('serpent params must be an object');
  const bad = Object.keys(p).filter((k) => !SERPENT_KEYS.includes(k));
  if (bad.length) throw new Error(`serpent: unknown param(s) ${bad.join(', ')} — takes ${SERPENT_KEYS.join(', ')}`);
  if (p.path !== undefined) {
    const P = p.path;
    if (!isObj(P) || !['raised', 'coil', 'arches', 'pts'].includes(P.kind)) throw new Error("serpent: `path` is { kind: 'raised' | 'coil' | 'arches' | 'pts', … }");
    if (P.kind === 'pts' && !(Array.isArray(P.pts) && P.pts.length >= 3 && P.pts.every((q) => Array.isArray(q) && q.length === 3 && q.every(num)))) throw new Error('serpent: path.pts is ≥ 3 control points [x, y, h] (metres; h = belly height)');
    if (P.kind === 'raised' && !(num(P.height) && Array.isArray(P.ground) && P.ground.length >= 2)) throw new Error('serpent: a raised path needs { height, ground: [[x, y], …] (≥ 2) }');
    if (P.kind === 'coil' && !(num(P.height) && Array.isArray(P.neck) && Array.isArray(P.centre) && Array.isArray(P.r) && num(P.turns))) throw new Error('serpent: a coil path needs { height, neck: [[y, h], …], centre: [x, y], r: [inner, outer], turns }');
    if (P.kind === 'arches' && !(num(P.height) && Array.isArray(P.neck) && num(P.start) && Array.isArray(P.humps) && num(P.run))) throw new Error('serpent: an arches path needs { height, neck, start, humps: [[h, w], …], run }');
  }
  if (p.n !== undefined && !(Number.isInteger(p.n) && p.n >= 24 && p.n <= 200)) throw new Error('serpent: `n` is an integer 24 … 200 (body stations)');
  if (p.girth !== undefined && !(Array.isArray(p.girth) && p.girth.length === 2 && p.girth.every((v) => num(v) && v >= 0.003 && v <= 2))) throw new Error('serpent: `girth` is [halfWidth, halfHeight] in metres, each 0.003 … 2');
  if (p.profile !== undefined && !(Array.isArray(p.profile) && p.profile.length >= 2 && p.profile.every((r, i) => Array.isArray(r) && r.length === 2 && r.every(num) && (!i || r[0] > p.profile[i - 1][0]))))
    throw new Error('serpent: `profile` is [[u, ×], …] with u ascending 0 (head) → 1 (tail)');
  if (p.head !== undefined) {
    const H = p.head; if (!isObj(H)) throw new Error('serpent: `head` is { shape, scale, skull, muzzle, eyeR, eyeAt, tongue, ornaments }');
    if (H.shape !== undefined && !HEAD_SHAPES[H.shape]) throw new Error(`serpent: head.shape must be ${Object.keys(HEAD_SHAPES).join(' | ')} (got ${JSON.stringify(H.shape)})`);
    if (H.scale !== undefined && !(num(H.scale) && H.scale >= 0.05 && H.scale <= 6)) throw new Error('serpent: head.scale is 0.05 … 6 (0.42 = a 3.7 m python)');
    for (const k of ['skull', 'muzzle']) if (H[k] !== undefined && !(Array.isArray(H[k]) && H[k].length === 2 && H[k].every((v) => num(v) && v > 0))) throw new Error(`serpent: head.${k} is [width ×, ${k === 'skull' ? 'height' : 'length'} ×], positive`);
  }
  if (p.tail !== undefined && !(isObj(p.tail) && ['taper', 'rattle'].includes(p.tail.kind))) throw new Error("serpent: `tail` is { kind: 'taper' } | { kind: 'rattle', beads }");
  if (p.pattern !== undefined && !Array.isArray(p.pattern)) throw new Error("serpent: `pattern` is a list of markings on 'body'");
}

/** THE SERPENT: params (see the header) → fauna params, family 'squamate'. Head / colors merge one level over the defaults. */
export function serpent(params = {}) {
  validateSerpent(params);
  const D = SERPENT_DEFAULTS, P = { ...D, ...params };
  for (const k of ['head', 'colors']) if (params[k]) P[k] = { ...D[k], ...params[k] };
  return serpentMaker(P);
}
