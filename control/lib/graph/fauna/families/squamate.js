// SQUAMATE — lizards and snakes. The family's tables are a MONITOR LIZARD: a long, slightly flattened trunk slung
// between SPRAWLING legs (upper arm and thigh out sideways, the feet planted wide with long clawed toes), a LONG
// NECK, a long narrow head with the eyes on the sides, no external ears, a forked tongue (opt-in ornament), and a
// long, round-to-slightly-flattened whip TAIL longer than the body. A snake is the same plan with `legs: []`, a short
// level trunk at the head end, and the body laid down as a sinuous loft (`sinuous()` below). Tables are authored in
// metres at Komodo-dragon size. Worked species: the Komodo dragon (monitorLizard) and the Burmese python (snake).

const flat = (rows, kx, kz) => rows.map(([id, y, top, ...rest]) => [id, y, top * kz, ...rest.slice(0, 5).map(([x, z]) => [x * kx, z * kz]), rest[5] * kz]);
const flatJaw = (rows, kx, kz) => rows.map(([id, y, s]) => [id, y, { gum: s.gum * kz, gumR: [s.gumR[0] * kx, s.gumR[1] * kz], jaw: [s.jaw[0] * kx, s.jaw[1] * kz], bottom: s.bottom * kz }]);
// the skull rows (the crocodilian's, from the canine): reshaped per species by flat() + muzzleW / muzzleLen
const SKULL = [
  ['st0', -0.15, 0.045, [0.03, 0.043], [0.06, 0.02], [0.065, -0.02], [0.055, -0.05], [0.035, -0.065], -0.07],
  ['st1', -0.09, 0.085, [0.02, 0.083], [0.07, 0.055], [0.09, -0.01], [0.08, -0.05], [0.05, -0.075], -0.08],
  ['st2', -0.02, 0.088, [0.035, 0.084], [0.083, 0.045], [0.10, -0.005], [0.085, -0.05], [0.05, -0.075], -0.08],
  ['st3', 0.04, 0.06, [0.012, 0.059], [0.05, 0.03], [0.06, -0.015], [0.055, -0.048], [0.04, -0.068], -0.07],
  ['st4', 0.10, 0.036, [0.018, 0.034], [0.036, 0.012], [0.042, -0.02], [0.038, -0.045], [0.03, -0.06], -0.062],
  ['st5', 0.16, 0.024, [0.015, 0.021], [0.027, 0.002], [0.03, -0.023], [0.028, -0.042], [0.022, -0.053], -0.055],
  ['st6', 0.21, 0.014, [0.01, 0.012], [0.019, -0.005], [0.02, -0.024], [0.018, -0.037], [0.015, -0.046], -0.047],
];
const JAW = [
  ['st0', -0.07, { gum: -0.075, gumR: [0.045, -0.075], jaw: [0.05, -0.1], bottom: -0.115 }],
  ['st1', 0.0, { gum: -0.075, gumR: [0.04, -0.075], jaw: [0.043, -0.097], bottom: -0.108 }],
  ['st2', 0.07, { gum: -0.064, gumR: [0.031, -0.064], jaw: [0.033, -0.083], bottom: -0.092 }],
  ['st3', 0.14, { gum: -0.056, gumR: [0.024, -0.056], jaw: [0.025, -0.071], bottom: -0.078 }],
  ['st4', 0.195, { gum: -0.049, gumR: [0.017, -0.049], jaw: [0.018, -0.06], bottom: -0.066 }],
];
const loftOf = (pts) => pts.map(([x, y, z, r]) => ({ at: [x, y, z], r }));

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
const spiral = ({ c = [0, 0], r0 = 0.1, r1 = 0.2, turns = 1, a0 = 0, dir = 1, k = 16, h = () => 0 }) => Array.from({ length: Math.round(k * turns) + 1 }, (_, i) => {
  const f = i / Math.round(k * turns), a = a0 + dir * 2 * Math.PI * turns * f, r = r0 + (r1 - r0) * f; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), h(f)]; });

export const family = {
  family: 'squamate',
  colors: {
    coat: '#6a6150', sock: '#5d5545', ash: '#9a8f72', ashAlt: '#8c8166', brow: '#4c4536', iris: '#c9a23a',
    ink: '#14120d', sclera: '#2d2a1d', nose: '#3a3428', teeth: '#e4ddc8', mouth: '#b07a6e', tip: '#4c4536',
    hoof: '#2f2b22', belly: '#a69a78',
  },
  joints: {
    neckBase: [0, 0.38, 0.27], neckTop: [0, 0.78, 0.32],
    // sprawling: the elbow and the knee out past the body, the feet set wide, the long toes splayed forward
    shoulder: [0.12, 0.30, 0.24], elbow: [0.30, 0.27, 0.21], carpus: [0.32, 0.33, 0.045], forePaw: [0.32, 0.345, 0.02], foreToe: [0.37, 0.46, 0.008],
    hip: [0.11, -0.36, 0.25], stifle: [0.33, -0.30, 0.22], hock: [0.35, -0.45, 0.05], hindPaw: [0.35, -0.44, 0.02], hindToe: [0.41, -0.31, 0.008],
  },
  torso: [
    { at: [0, -0.48, 0.27], r: [0.11, 0.10] },
    { at: [0, -0.28, 0.27], r: [0.17, 0.125] },
    { at: [0, 0.0, 0.27], r: [0.19, 0.13] },
    { at: [0, 0.24, 0.27], r: [0.16, 0.12] },
    { at: [0, 0.42, 0.27], r: [0.10, 0.09] },
  ],
  torsoCaps: { back: [0, -0.55, 0.27], tip: [0, 0.50, 0.27] },
  neckRA: [0.095, 0.085], neckRB: [0.05, 0.05], neckRMid: [0.07, 0.065],
  tail: null, tip: null,
  legs: [
    ['upperArmR', 'shoulder', 'elbow', [0.055, 0.05], [0.04, 0.038], 'Coat', [0.5, 0.4]],
    ['foreArmR', 'elbow', 'carpus', [0.04, 0.038], [0.03, 0.03], 'Coat', [0.4, 0.3]],
    ['pasternR', 'carpus', 'forePaw', 0.03, 0.028, 'Sock', [0.3, 0.3]],
    ['forePawR', 'forePaw', 'foreToe', [0.04, 0.014], [0.03, 0.007], 'Hoof', [0.3, 0.2]],
    ['thighR', 'hip', 'stifle', [0.075, 0.07], [0.05, 0.045], 'Coat', [0.4, 0.4]],
    ['shinR', 'stifle', 'hock', [0.045, 0.042], [0.033, 0.033], 'Coat', [0.4, 0.3]],
    ['metaR', 'hock', 'hindPaw', 0.033, 0.03, 'Sock', [0.3, 0.3]],
    ['hindPawR', 'hindPaw', 'hindToe', [0.045, 0.015], [0.032, 0.007], 'Hoof', [0.3, 0.2]],
  ],
  levelLegs: true,
  // the skull: narrow and only a little flattened, the snout drawn out moderately (a monitor's long tapering head)
  craniumRows: flat(SKULL, 0.8, 0.8),
  craniumCaps: { back: [0, -0.18, 0.0], tip: [0, 0.225, -0.012] },
  muzzleFrom: 3,
  jawRows: flatJaw(JAW, 0.8, 0.8),
  jawCaps: { back: [0, -0.1, -0.05], tip: [0, 0.21, -0.03] },
  skinControls: {
    browRaise: { amp: 0.01, map: [['st2.brow', 0.8, [0, 0, 1]], ['st3.brow', 0.6, [0, 0, 1]]] },
    browFurrow: { amp: 0.012, map: [['st3.brow', 1, [-0.3, 0.2, -1]], ['st2.brow', 0.4, [0, 0, -1]]] },
    sneer: { amp: 0.012, map: [['st5.jowl', 1, [0.2, 0, 1]], ['st5.lip', 0.8, [0.2, 0, 1]], ['st6.jowl', 0.5, [0.2, 0, 1]], ['st4.crown', 0.3, [0, -0.3, 1]]] },
    cheekBunch: { amp: 0.01, map: [['st3.cheek', 1, [0.5, 0, 0.8]], ['st2.cheek', 0.6, [0.5, 0, 0.8]]] },
    cornerRetract: { amp: 0.015, map: [['st3.lip', 0.8, [0.1, -1, 0.3]], ['st4.lip', 0.5, [0.1, -1, 0.3]]] },
  },
  headScale: 0.6, nape: [0, -0.1, -0.02],
  // the eyes on the sides of the skull, nostrils near the snout tip, no nose pad, no external ears
  eyeAt: [1.9, 2.1], eyeR: 0.011, orbit: { reach: [0.003, 0.0035, 0.004], bulk: [0.001, 0.002], thickness: 0.002 }, pupil: 'round', irisAngle: 40,
  browStrip: [[1.6, 1.8], [1.9, 1.7], [2.2, 1.7], [2.5, 1.8], [2.8, 1.9]],
  foldStrip: [[5.5, 2.2], [5.0, 2.9], [4.4, 3.6], [3.8, 4.2], [3.3, 4.7]],
  nostrilAt: [5.4, 1.6], noseAt: [5.8, 0.0001], noseR: [0.001, 0.001], webCranium: [1.7, 3.3, 4.97], nose: false,
  ears: false, earAt: [1.2, 1.5], earSpine: [[0, 0, 0], [0, 0, 0.01]], earR: [0.01, 0.01], earSquash: [1, 1], earH: 1,
  muzzleW: 0.85, muzzleLen: 1.6,
  headOrnaments: [], headTiles: [], bodyTiles: [],
  scale: 1,
};
// the tail: a long whip [x, y, z, [half-width, half-height]] on stable rings, drooping to rest on the ground
family.tailStations = [[0, -0.50, 0.27, [0.11, 0.10]], [0, -0.75, 0.24, [0.10, 0.095]], [0, -1.05, 0.17, [0.065, 0.07]], [0, -1.40, 0.09, [0.045, 0.05]], [0, -1.75, 0.04, [0.025, 0.03]], [0, -2.0, 0.018, [0.012, 0.014]]];
family.extraSegments = [
  { name: 'tailWhip', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: 'plane', up: true, stations: loftOf(family.tailStations), caps: { back: [0, -0.42, 0.27], tip: [0, -2.07, 0.012] } },
];

// the FORKED TONGUE (opt-in ornament): two thin prongs flicked out from under the snout tip, splayed apart
export const TONGUE = [-1, 1].map((s, i) => ({ kind: 'sweep', name: `tongue${i}`, at: [5.95, 6], space: 'local', spine: [[0, 0, -0.004], [0, 0.02, 0.004], [s * 0.008, 0.04, 0.006]], radii: [0.004, 0.003, 0.0012], m: 5, group: 'Tongue' }));

// the snake's body: a short level trunk behind the head, then the S of coils on the ground
const PY_R = [0.1, 0.08];
const PY_BODY = sinuous({ y0: -0.05, length: 3.25, amp: 0.33, waves: 2, back: 2.0, n: 56, r0: PY_R, taper: [[0, 0.95], [0.5, 1.15], [0.82, 0.95], [0.93, 0.45], [1, 0.08]] });

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
//   head    { shape: 'blunt' | 'viper' | 'slender' | 'coffin' | 'dragon', scale, eyeR, eyeAt, ornaments, tongue = true }
//           (the tongue scales with the head) a shape sets the skull's flattening and the muzzle; eye / orbit / brow / nostril are authored at a
//           python-size head (0.42) and scale with it (headRelative), so a small head builds
//   tail    { kind: 'taper' } | { kind: 'rattle', beads } | { kind: 'fin', height }   (the taper is the profile's end)
//   crest   { every = 3, above = 1.4, len: [base, ×girth], from, to }   upright blades out of the back (a frill)
//   pattern markings on the part 'body' (build.js markings). With up [0, 1, -1] a ring's t = 0 is the BELLY on the ground
//           and the throat (facing +y) where reared; t = 1 the back. colors as the family's
const HEAD_SHAPES = {
  blunt: { skull: [1.15, 0.55], muzzle: [1.05, 0.9] }, viper: { skull: [1.45, 0.6], muzzle: [0.6, 0.75] },
  slender: { skull: [0.9, 0.6], muzzle: [0.9, 0.85] }, coffin: { skull: [0.75, 0.55], muzzle: [0.9, 1.1] }, dragon: { skull: [0.95, 0.75], muzzle: [0.95, 1.45] },
};
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
  const H = HEAD_SHAPES[head.shape || 'blunt'], hs = head.scale ?? 0.42;
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
    craniumRows: flat(SKULL, ...H.skull), jawRows: flatJaw(JAW, ...H.skull),
    headScale: hs, muzzleW: H.muzzle[0], muzzleLen: H.muzzle[1], headRelative: 0.42, relBrow: true,
    eyeAt: head.eyeAt ?? [2.2, 2.3], eyeR: head.eyeR ?? 0.006, orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.0015 },
    headOrnaments: [...(head.tongue === false ? [] : TONGUE.map((o) => ({ ...o, spine: o.spine.map((q) => q.map((v) => v * hs / 0.42)), radii: o.radii.map((v) => v * hs / 0.42) }))), ...(head.ornaments || [])],
    extraSegments: extra, markings: body.marks, colors,
  };
}

// the species of this family: each the numbers over the family's tables that make it that animal
export const species = {
  // KOMODO DRAGON (Varanus komodoensis), the monitor lizard. Thesis: a long, heavy, slightly flattened trunk held
  // just off the ground on SPRAWLING, thick, clawed legs · a LONG NECK carrying a long narrow head, eyes on the sides,
  // no ears, a forked tongue · a long, thick, tapering tail as long as the body, dragged · drab grey-brown · ~2.6 m
  // total, ~0.4 m to the top of the back (Wikipedia / Smithsonian NZP: adult males average 2.59 m, 79–91 kg; the tail
  // about half the total length).
  monitorLizard: {
    // kept v4 (blind judges: A v4 over post-critic v5 55%; B v5 over v1 65%)
    family: 'squamate', name: 'a Komodo dragon', scale: 1, legBulk: 1.2, headOrnaments: TONGUE,
  },
  // BURMESE PYTHON (Python bivittatus), the snake. Thesis: NO legs · a long, thick, heavy body laid on the ground in an
  // S, thickest mid-body, tapering to a short tail · a broad, flat, wedge head wider than the neck, eyes on the sides,
  // held a little off the ground · blotched tan and dark brown · ~3.7 m long, ~0.17 m body thickness (Wikipedia:
  // wild adults average 3.7 m; Reed & Rodda 2009, USGS: large adults 4–5 m).
  snake: {
    // kept v5 (blind judges: A v5 over v4 75%; B v5 over v1 75%)
    family: 'squamate', name: 'a Burmese python', scale: 1, orbitFallback: true,
    legs: [], levelLegs: false,
    joints: { neckBase: [0, 0.32, 0.085], neckTop: [0, 0.48, 0.10] },
    torso: [
      { at: [0, -0.10, 0.08], r: PY_R },
      { at: [0, 0.10, 0.08], r: PY_R },
      { at: [0, 0.30, 0.08], r: [0.08, 0.07] },
    ],
    torsoCaps: { back: [0, -0.16, 0.08], tip: [0, 0.36, 0.08] },
    neckRA: [0.06, 0.055], neckRB: [0.045, 0.04], neckRMid: [0.05, 0.045],
    craniumRows: flat(SKULL, 1.15, 0.55), jawRows: flatJaw(JAW, 1.15, 0.55),
    headScale: 0.42, muzzleW: 1.05, muzzleLen: 0.9,
    eyeAt: [2.4, 2.5], eyeR: 0.005, orbit: { reach: [0.002, 0.0025, 0.003], bulk: [0.0005, 0.001], thickness: 0.0015 }, headOrnaments: TONGUE,
    extraSegments: [
      { name: 'coils', kind: 'loft', slots: 'ring12', group: 'Coat', mirror: null, up: true, stations: loftOf(PY_BODY),
        caps: { back: [0, -0.04, 0.08], tip: [PY_BODY.at(-1)[0], PY_BODY.at(-1)[1] - 0.03, 0.01] } },
    ],
    colors: { coat: '#8a6a3e', sock: '#8a6a3e', ash: '#a8875a', ashAlt: '#9a7a50', brow: '#4a3622', belly: '#d8cba2', iris: '#9a7a3a', tip: '#4a3622' },
  },
  // KING COBRA (Ophiophagus hannah). Thesis: NO legs · the FRONT THIRD REARED straight up off the ground (head held
  // level ~0.95 m up) with a long, narrow spread HOOD just behind the head · the rest a long, slender, loose S on the
  // ground · a smallish rounded head · olive-brown with pale cross bands, pale throat · ~3.6 m long (Wikipedia: adults
  // typically 3.18–4 m, record 5.85 m; it can rear about a third of its length).
  kingCobra: serpentMaker({ name: 'a king cobra', girth: [0.042, 0.036], profile: [[0, 0.8], [0.25, 1], [0.7, 1], [0.9, 0.55], [1, 0.1]],
    path: { kind: 'raised', height: 0.92, ground: [[0.2, -0.78], [0.3, -1.05], [0.12, -1.32], [-0.18, -1.5], [-0.32, -1.78], [-0.15, -2.08], [0.15, -2.25], [0.3, -2.5], [0.25, -2.75]] },
    hood: { width: 0.15, from: 0.04, peak: 0.2, to: 0.5 }, head: { shape: 'slender', scale: 0.26, eyeR: 0.0065 },
    pattern: [
      { on: 'body', kind: 'stripes', count: 26, run: [0.2, 0.96], width: 0.28, group: 'Band', color: '#c9c58e' },
      { on: 'body', kind: 'band', run: [0, 0.12], t: [0, 0.45], group: 'Throat', color: '#d8cf98' },
    ],
    colors: { coat: '#4f5230', sock: '#4f5230', ash: '#6a6a3c', ashAlt: '#5d5d36', brow: '#33341d', belly: '#c9c58e', iris: '#6a5a2a', tip: '#33341d' } }),
  // WESTERN DIAMONDBACK RATTLESNAKE (Crotalus atrox). Thesis: NO legs · heavy body in a flat ground COIL with the neck
  // raised over it in an S, ready to strike · a broad TRIANGULAR viper head on a thin neck · the RATTLE: a stack of
  // keratin beads at the lifted tail tip, the tail above it ringed black and white · grey-brown with dark DIAMONDS down
  // the back · ~1.2 m long (Wikipedia: adults commonly 1.2 m, max ~2.1 m), head ~5 cm.
  rattlesnake: serpentMaker({ name: 'a western diamondback rattlesnake', n: 84, girth: [0.036, 0.03], profile: [[0, 0.6], [0.15, 0.9], [0.35, 1.05], [0.8, 0.9], [0.95, 0.45], [1, 0.32]],
    path: { kind: 'coil', height: 0.2, neck: [[-0.05, 0.16], [-0.02, 0.11], [-0.07, 0.05], [-0.1, 0.0]], centre: [0, -0.17], r: [0.07, 0.165], turns: 1.25,
      lift: [[-0.17, -0.12, 0.02], [-0.175, -0.1, 0.05]] },
    head: { shape: 'viper', scale: 0.17, eyeR: 0.0065 }, tail: { kind: 'rattle', beads: 7 },
    pattern: [
      { on: 'body', kind: 'patch', grid: [24, 1], run: [0.12, 0.86], t: [0.62, 1], size: [0.6, 1], group: 'Diamond', color: '#4b3b2a' },
      { on: 'body', kind: 'band', run: [0.86, 1], group: 'TailWhite', color: '#e4ddcb' },
      { on: 'body', kind: 'stripes', count: 4, run: [0.86, 1], width: 0.5, group: 'TailBlack', color: '#1d1a17' },
    ],
    colors: { coat: '#8f8166', sock: '#8f8166', ash: '#a39478', ashAlt: '#968a6e', brow: '#4b3b2a', belly: '#d9cfb4', iris: '#a88a3a', tip: '#4b3b2a', horn: '#b7a27a' } }),
  // GREEN MAMBA (Dendroaspis viridis, western green mamba). Thesis: NO legs · very SLENDER and long, the front loosely
  // raised, the rest draped in a long loose S · a narrow, long, coffin-shaped head barely wider than the neck · uniform
  // BRIGHT GREEN, yellow-green belly · ~2.0 m long (Wikipedia: adults average 1.4–2 m, max 2.4 m).
  greenMamba: serpentMaker({ name: 'a green mamba', girth: [0.02, 0.018], profile: [[0, 0.75], [0.2, 1], [0.7, 0.95], [0.9, 0.5], [1, 0.12]],
    path: { kind: 'pts', pts: [[0, -0.03, 0.24], [0, -0.1, 0.19], [0, -0.2, 0.1], [0, -0.32, 0.02], [0, -0.45, 0], [0.18, -0.62, 0], [0.22, -0.85, 0], [0.02, -1.05, 0],
      [-0.2, -1.22, 0], [-0.24, -1.45, 0], [-0.05, -1.65, 0], [0.15, -1.8, 0]] },
    head: { shape: 'coffin', scale: 0.15, eyeR: 0.006 },
    pattern: [{ on: 'body', kind: 'band', t: [0, 0.32], group: 'Belly' }],
    colors: { coat: '#3f9f35', sock: '#3f9f35', ash: '#7cbd45', ashAlt: '#6db03d', brow: '#2d7a28', belly: '#b9d65a', iris: '#8a9a2a', tip: '#2d7a28' } }),
  // SEA SERPENT (mythic). Thesis: NO legs · HUGE: a body ~40 m long and ~1.2 m thick, a swan neck rearing the head ~7 m
  // out of the sea, then three HUMPS arching out of the water (their feet on the water plane z = 0) and a tail run · a
  // finned dorsal FRILL of upright blades along the neck and humps · a long DRAGON-LIKE head (~2 m) with swept-back horns
  // and jaw frills · dark sea-green, pale belly, red frill. Intended scale: after Olaus Magnus's (1555) "200 ft" sea
  // serpent, brought down to ~40 m so the humps read at gameplay camera (no published figure exists).
  seaSerpent: serpentMaker({ name: 'a sea serpent', n: 120, girth: [0.6, 0.6], up: [1, 0, 0], profile: [[0, 0.62], [0.12, 0.85], [0.3, 1], [0.6, 0.85], [0.85, 0.5], [1, 0.12]],
    path: { kind: 'arches', height: 6.4, neck: [[-1.2, 5.7], [-1.7, 4.4], [-1.6, 3.0], [-1.2, 1.6], [-1.4, 0.35], [-2.4, 0]], start: -3.0, humps: [[3.6, 5], [3.0, 4.6], [2.3, 4]], run: 3.1 },
    crest: { every: 3, above: 1.4, to: 104 },
    head: { shape: 'dragon', scale: 4.2, eyeR: 0.005, tongue: false, ornaments: [   // pinned on the right; the head mirrors them
      { kind: 'sweep', name: 'horn', at: [1.3, 1.6], space: 'local', spine: [[0, 0, 0], [-0.35, -0.1, 0.45], [-1.0, -0.25, 0.8], [-1.6, -0.2, 0.85]], radii: [0.16, 0.12, 0.06, 0.015], m: 6, group: 'Horn' },
      { kind: 'sweep', name: 'frill', at: [1.6, 3.6], space: 'local', spine: [[0, 0, -0.02], [-0.2, 0, 0.12], [-0.6, 0, 0.35], [-1.1, 0, 0.5]], radii: [0.04, 0.26, 0.2, 0.03], squash: [0.15, 1], m: 6, group: 'Mane' },
    ] },
    pattern: [{ on: 'body', kind: 'band', t: [0.5, 1], group: 'Belly' }],
    colors: { coat: '#24514c', sock: '#24514c', ash: '#3c6a5e', ashAlt: '#356055', brow: '#163a36', belly: '#c9c49a', iris: '#d6a12a', tip: '#163a36', horn: '#d8cdb0', mane: '#a8402c', sclera: '#1a1a12' } }),
};
