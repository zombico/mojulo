/**
 * THE CIVIC KIT: what the city's utility vehicles share (road-civic-works.js, road-civic-emergency.js,
 * road-civic-lifts.js), in the hull kit's language (mil-hull.js) and the airside's (airside-kit.js, whose cab-over cab,
 * mudguards, lamps and hazard stripes they reuse): how far each deploys, its plain livery, the conventional cab and the
 * crew cab, a light bar, reflective stripes, chevrons and chequers, roll-up lockers, outriggers, and a hinge's turn.
 *
 *   CIVIC_REACH, CIVIC_WORDS          kind → { stowed, deployed, range } (metres: what each body measures its deployment
 *                                     on), and the words that deploy it (a refuse truck tipping, a plough down, a
 *                                     sweeper's brooms down, a ladder or a bucket raised)
 *   civicWords(kind, words)           → { deployed }
 *   reachOf(kind, { words?, pose? })  → the height it deploys to: `pose.reach` clamped to its range, else deployed or
 *                                       stowed by its words
 *   CIVIC_LIVERY                      kind → the plain livery it wears when none is named (its base colour, its fleet
 *                                     number, no emblem)
 *   CC, own                           the civic colours, a look in its own colour (what a livery leaves alone)
 *   conventionalCab(out, { … })       → a bonneted cab pushed into out (its bonnet, grille, lamps, fenders, the cab
 *                                       behind its raked screen, its doors); its anchors
 *   crewCab(out, { … })               → a cab-over crew cab (airside-kit.js cabOver lengthened, its rear doors, a raised
 *                                       roof over its crew); its anchors
 *   lightBar(at, { width, colours })  → a roof light bar: its base and its lenses, alternating
 *   stripes({ o, u, v, w, h, n, colours, pitch, mirror? }) → bands at 45° on a face (mirrored: chevrons)
 *   chequer({ o, u, v, w, h, n, colours, cell }) → a band of squares, two rows, alternating
 *   band(o, u, v, w, h, n, look)      → a flat stripe on a face
 *   lockers(out, { s, y0, y1, z0, z1, x, n })  → roll-up lockers along a side: their shutters, ribs, handles, frames
 *   outrigger(out, { x, y, hw, deployed, z }) → an outrigger beam out of the frame and its jack, down on its pad when
 *                                       deployed
 *   hinge(faces, { pivot: [y, z], angle }) → faces turned about an axis along x through the pivot (radians, + lifts the
 *                                       +y side, − the −y side)
 *   chassis(out, { axles, yT, yN, r, hw, zf }) → the frame on its axles, the rear guards, the side and rear under-run bars
 *   without(faces, parts)             → faces without those parts
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres. Pure and deterministic.
 */
import { plate, tube, bend, face } from './mil-hull.js';
import { M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, cabOver, C } from './airside-kit.js';

// (each kind's deployment, measured where its test reads it: a refuse body's tailgate's lower edge, a plough blade's
// foot, a sweeper's brooms' tips, a ladder's tip, a bucket's floor; the stowed and the deployed, and the range it moves
// through)
const REACH = {
  refuse: { stowed: 0.85, deployed: 2.5, range: [0.85, 2.65] },
  plough: { stowed: 0.32, deployed: 0, range: [0, 0.45] },
  sweeper: { stowed: 0.16, deployed: 0, range: [0, 0.2] },
  ladder: { stowed: 2.98, deployed: 20, range: [2.98, 28] },
  bucket: { stowed: 1.64, deployed: 10, range: [1.64, 12.5] },
  // (the refuse fleet's other models: a front loader's forks, a side loader's gripper, a roll-off container's nose, a
  // skip's bottom)
  frontLoader: { stowed: 1.52, deployed: 5.6, range: [1.52, 5.8] },
  sideLoader: { stowed: 0.72, deployed: 3.0, range: [0.72, 3.4] },
  rollOff: { stowed: 1.25, deployed: 4.2, range: [1.25, 4.7] },
  skipLoader: { stowed: 1.15, deployed: 0, range: [0, 1.15] },
};
export const CIVIC_REACH = Object.freeze(Object.fromEntries(Object.entries(REACH).map(([k, v]) => [k, Object.freeze({ ...v, range: Object.freeze(v.range) })])));
// (a brief's words the car sheet reads as its own, `lowered` a stance, never reach a body: none of them deploys one)
export const CIVIC_WORDS = Object.freeze({
  refuse: Object.freeze(['tipping', 'tipped', 'dumping', 'emptying', 'unloading', 'open', 'opened']),
  plough: Object.freeze(['plowing', 'ploughing', 'down', 'clearing', 'working', 'deployed']),
  sweeper: Object.freeze(['sweeping', 'working', 'down', 'deployed']),
  ladder: Object.freeze(['raised', 'extended', 'up', 'deployed', 'rescuing', 'working', 'elevated']),
  bucket: Object.freeze(['raised', 'extended', 'up', 'deployed', 'working', 'elevated', 'lifted']),
  frontLoader: Object.freeze(['lifting', 'tipping', 'emptying', 'dumping', 'raised', 'up']),
  sideLoader: Object.freeze(['lifting', 'collecting', 'emptying', 'tipping', 'working', 'picking']),
  rollOff: Object.freeze(['tipping', 'dumping', 'unloading', 'tilted', 'raised']),
  skipLoader: Object.freeze(['unloading', 'dropping', 'down', 'deployed', 'set down', 'delivering']),
});

/** A civic body's words: whether its brief deploys it (each kind its own words, CIVIC_WORDS). */
export function civicWords(kind, words = []) {
  const W = words.map((w) => String(w).toLowerCase()), D = CIVIC_WORDS[kind] ?? [];
  return { deployed: W.some((w) => D.includes(w)) };
}

/** How far a kind deploys: `pose.reach` clamped to its range, else deployed or stowed by its words. */
export function reachOf(kind, { words = [], pose = {} } = {}) {
  const R = CIVIC_REACH[kind];
  if (!R) throw new Error(`car-designer: '${kind}' is not a civic body that deploys (${Object.keys(CIVIC_REACH).join(', ')})`);
  const want = Number.isFinite(pose?.reach) ? pose.reach : civicWords(kind, words).deployed ? R.deployed : R.stowed;
  return Math.min(R.range[1], Math.max(R.range[0], want));
}

// the civic colours, unlit: a fire appliance's red, a municipal white and orange, the reflective bands, the emergency
// lenses, chrome
export const CC = Object.freeze({
  fire: '#b3161c', white: '#ecebe6', orange: '#de6f17', municipal: '#e9e9e2', green: '#2e7a46', yellow: '#f2c51c', reflRed: '#c71f26',
  reflWhite: '#f4f4ef', chrome: '#c9ccce', red: '#e0241f', blue: '#1f62d8', amber: '#e39a1c', lens: '#eef1f3', hivis: '#d8e21c',
});
export const own = (part, albedo, material = 'plate') => M(part, material, albedo);

const mono = (c) => Object.freeze({ pattern: 'mono', colours: Object.freeze([c]), marks: Object.freeze({ emblem: false }) });
/** Each civic kind's plain livery: its base under its own bands. */
export const CIVIC_LIVERY = Object.freeze({
  refuse: mono(CC.municipal), plough: mono(CC.orange), sweeper: mono(CC.municipal), fireEngine: mono(CC.fire), ladder: mono(CC.fire),
  ambulance: mono(CC.white), paramedic: mono(CC.white), bucket: mono(CC.white),
  frontLoader: mono(CC.municipal), sideLoader: mono(CC.green), rollOff: mono('#2f5f9e'), skipLoader: mono(CC.municipal),
});

export const without = (faces, parts) => faces.filter((f) => !f || !parts.includes(f.part));

/** Faces turned about an axis along x through `pivot` ([y, z]) by `angle` (radians; positive turns +y up). */
export function hinge(faces, { pivot: [py, pz], angle }) {
  if (!angle) return faces;
  const c = Math.cos(angle), s = Math.sin(angle);
  const P = ([x, y, z]) => [x, py + (y - py) * c - (z - pz) * s, pz + (y - py) * s + (z - pz) * c];
  const N = ([x, y, z]) => [x, y * c - z * s, y * s + z * c];
  return faces.filter(Boolean).map((f) => ({ ...f, corners: f.corners.map(P), outNormal: N(f.outNormal), ...(f.cornerNormals ? { cornerNormals: f.cornerNormals.map(N) } : {}) }));
}

// the band of a rectangle (s across [0, w], t up [0, h]) where lo ≤ s ± t ≤ hi: clipped by two lines
function clipBand(w, h, lo, hi, sign) {
  let P = rect(0, w, 0, h);
  for (const [sg, c] of [[1, lo], [-1, -hi]]) {
    const val = (q) => sg * (q[0] + sign * q[1]), out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ia = val(a) >= c - 1e-9, ib = val(b) >= c - 1e-9;
      if (ia) out.push(a);
      if (ia !== ib) { const fa = val(a) - c, fb = val(b) - c, t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    P = out;
    if (P.length < 3) return null;
  }
  return P;
}
/** Reflective bands at 45° on a face: from `o`, `w` along `u` and `h` along `v`, standing out along `n`, in `colours`
 *  alternating; `mirror` mirrors them about the face's middle (chevrons pointing up). */
export function stripes({ o, u, v, w, h, n, colours = [CC.reflRed, CC.yellow], pitch = 0.15, mirror = false, part = 'chevron' }) {
  const out = [], at = (q) => [0, 1, 2].map((k) => o[k] + u[k] * q[0] + v[k] * q[1] + n[k] * 0.003);
  const halves = mirror ? [[0, w / 2, -1], [w / 2, w / 2, 1]] : [[0, w, 1]];
  for (const [s0, ww, sign] of halves) {
    const lo = sign > 0 ? 0 : -h - ww, hi = sign > 0 ? ww + h : ww;
    for (let k = 0; lo + k * pitch < hi; k++) {
      const B = clipBand(ww, h, lo + k * pitch, lo + (k + 1) * pitch, sign);
      if (B) out.push(face(B.map((q) => at([q[0] + s0, q[1]])), own(part, colours[k % colours.length]), n));
    }
  }
  return out.filter(Boolean);
}
/** A band of squares, two rows, alternating two colours (a high-visibility chequer). */
export function chequer({ o, u, v, w, h, n, colours = [CC.hivis, CC.green], part = 'chequer' }) {
  const out = [], cell = h / 2, m = Math.max(1, Math.round(w / cell)), cw = w / m, at = (s, t) => [0, 1, 2].map((k) => o[k] + u[k] * s + v[k] * t + n[k] * 0.003);
  for (let i = 0; i < m; i++) for (let j = 0; j < 2; j++) out.push(face([at(i * cw, j * cell), at((i + 1) * cw, j * cell), at((i + 1) * cw, (j + 1) * cell), at(i * cw, (j + 1) * cell)], own(part, colours[(i + j) % 2]), n));
  return out.filter(Boolean);
}
/** A flat stripe on a face. */
export function band(o, u, v, w, h, n, look) {
  const at = (s, t) => [0, 1, 2].map((k) => o[k] + u[k] * s + v[k] * t + n[k] * 0.003);
  return [face([at(0, 0), at(w, 0), at(w, h), at(0, h)], look, n)].filter(Boolean);
}

// (a lens lit by its own colour's light: a red one the tail lamps', an amber one the markers', a blue or a white one the
// headlamps')
export const lensOf = (c) => (c === CC.red || c === CC.reflRed ? 'tail' : c === CC.amber ? 'marker' : 'lamp');
/** A roof light bar at `at` (its foot's middle): its base, its lenses alternating `colours` across `width`. */
export function lightBar(at, { width = 1.6, colours = [CC.red, CC.blue], depth = 0.3 } = {}) {
  const out = [], [x0, y0, z0] = at, hw = width / 2;
  out.push(...plate({ axis: 'y', profile: rect(x0 - hw, x0 + hw, z0, z0 + 0.05), from: y0 - depth / 2, to: y0 + depth / 2, r: 0.015, seg: 1, look: M('lightbar.base', 'carbon', C.black) }));
  const n = 6, cw = width / n;
  for (let i = 0; i < n; i++) {
    const a = x0 - hw + i * cw + 0.01, b = a + cw - 0.02;
    const c = colours[(i < n / 2 ? 0 : 1) % colours.length];
    out.push(...plate({ axis: 'y', profile: rect(a, b, z0 + 0.05, z0 + 0.15), from: y0 - depth / 2 + 0.02, to: y0 + depth / 2 - 0.02, r: 0.02, seg: 1, look: M('lightbar', lensOf(c), c) }));
  }
  return out;
}

/** A bonneted cab: the bonnet from the cowl `yw` to its grille at `yG`, the bumper's face at `yN`; the cab from its back
 *  `yb` to the cowl, its screen raked; hw the cab's half width, hb the bonnet's; z0 the frame's top, zB the bonnet's,
 *  z1 the roof's; yf the front axle (its fenders); r the wheel. Its anchors (mirror posts, sills, grab bars, its number). */
export function conventionalCab(out, { yb, yw, yG, yN, hw, hb, z0, zB, z1, yf, r }) {
  const P = (o) => out.push(...plate(o));
  // (the bonnet: its top falling a little to its nose, its sides; the grille on its face, its lamps beside it)
  P({ axis: 'x', profile: [[yw, z0], [yG, z0], [yG, zB - 0.12], [yG - 0.12, zB - 0.02], [yw, zB + 0.04]], from: -hb, to: hb, r: 0.06, seg: 2, look: paint('bonnet') });
  P({ axis: 'y', profile: rect(-hb + 0.12, hb - 0.12, z0 + 0.12, zB - 0.16), from: yG - 0.004, to: yG + 0.02, r: 0.01, seg: 1, look: M('grille', 'carbon', C.black) });
  for (let z = z0 + 0.18; z < zB - 0.18; z += 0.07) P({ axis: 'y', profile: rect(-hb + 0.14, hb - 0.14, z, z + 0.02), from: yG + 0.02, to: yG + 0.035, look: M('grille.bar', 'alloy', CC.chrome) });
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hb + 0.14), yG - 0.015, z0 + 0.32], Y, 0.24, 0.16, 'lamp', 'headlamp'));
    out.push(...lamp([s * (hb + 0.14), yG - 0.015, z0 + 0.14], Y, 0.18, 0.07, 'marker', 'indicator'));
    // (the fenders: out over the front wheels from the bonnet's sides to the cab's width, their lamps' housing)
    P({ axis: 'x', profile: [[yw + 0.05, z0 - 0.05], [yG - 0.02, z0 - 0.05], [yG - 0.02, z0 + 0.45], [yG - 0.25, z0 + 0.52], [yw + 0.05, z0 + 0.58]], from: s > 0 ? hb : -hw, to: s > 0 ? hw : -hb, r: 0.04, seg: 2, look: paint('fender') });
    out.push(...guard(yf, r, r + 0.1, 0.15, Math.PI - 0.15, ...xs(s, hb + 0.02, hw - 0.02), dark('guard')));
  }
  // (the cab: its floor over the frame, its back, its roof, its screen raked back from the cowl)
  const zs = zB + 0.05, ys = yw - 0.55;
  P({ axis: 'x', profile: [[yb, z0 - 0.1], [yw, z0 - 0.1], [yw, zs], [ys, z1], [yb, z1]], from: -hw, to: hw, r: 0.05, seg: 2, look: paint('cab') });
  const along = (t, s) => [s, yw + (ys - yw) * t, zs + (z1 - zs) * t], nS = (() => { const d = [0, ys - yw, z1 - zs], l = Math.hypot(d[1], d[2]); return [0, d[2] / l, -d[1] / l]; })();
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.03, hw - 0.1), q = [along(0.08, a), along(0.08, b), along(0.88, b), along(0.88, a)].map((p) => p.map((c, i) => c + nS[i] * 0.004));
    out.push(face(q, M('glass', 'glass', C.glass), nS));
    out.push(...tube([along(0.1, s * 0.12), along(0.4, s * 0.55)].map((p) => p.map((c, i) => c + nS[i] * 0.03)), 0.008, { sides: 6, look: M('wiper', 'carbon', C.black) }));
  }
  // (the doors: their glass, shut lines and handles; a rear quarter's glass)
  const seam = M('seam', 'seal', '#151614'), zw = zB + 0.1, yd0 = yw - 0.08, yd1 = Math.max(yb + 0.25, yw - 1.15);
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.003), n = [s, 0, 0];
    const pillar = (z) => yw + ((ys - yw) * (z - zs)) / (z1 - zs) - 0.08;
    out.push(face([[x, yd1 + 0.08, zw], [x, pillar(zw), zw], [x, pillar(z1 - 0.12), z1 - 0.12], [x, yd1 + 0.08, z1 - 0.12]], M('glass', 'glass', C.glass), n));
    const strip = (ya, y2, za, zb) => out.push(face([[x, ya, za], [x, y2, za], [x, y2, zb], [x, ya, zb]], seam, n));
    strip(yd1, yd0, z0 - 0.06, z0 - 0.048); strip(yd1, yd1 + 0.012, z0 - 0.06, z1 - 0.1); strip(yd0 - 0.012, yd0, z0 - 0.06, zs);
    out.push(...tube(bend([[x, yd1 + 0.1, zw - 0.1], [x + s * 0.03, yd1 + 0.1, zw - 0.1], [x + s * 0.03, yd1 + 0.25, zw - 0.1], [x, yd1 + 0.25, zw - 0.1]], 0.012, 2), 0.01, { sides: 6, look: paint('door.handle') }));
    if (yd1 - yb > 0.4) out.push(face([[x, yb + 0.12, zw], [x, yd1 - 0.06, zw], [x, yd1 - 0.06, z1 - 0.15], [x, yb + 0.12, z1 - 0.15]], M('glass', 'glass', C.glass), n));
  }
  // (the bumper across the nose)
  P({ axis: 'x', profile: rect(yG - 0.1, yN, z0 - 0.42, z0 - 0.12), from: -hw + 0.02, to: hw - 0.02, r: 0.03, seg: 2, look: M('bumper', 'alloy', CC.chrome) });
  return [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `post.${L}`, kind: 'post', at: [s * hw, yw - 0.12, zB + 0.25], out: sd, up: Z },
      { id: `sill.${L}`, kind: 'sill', at: [s * (hw - 0.12), (yd0 + yd1) / 2, z0 - 0.12], out: sd, up: Z },
      { id: `grab.${L}`, kind: 'flank', at: [s * hw, yd1 - 0.05, zw - 0.05], out: sd, up: Z },
      { id: `mark.cab.${L}`, kind: 'mark', role: 'number', at: [s * (hw + 0.004), (yd0 + yd1) / 2, z0 + 0.22], out: sd, up: Z, h: 0.12 },
    ];
  });
}

/** A cab-over crew cab: the airside's cab-over (airside-kit.js) from `yb` to its face `yf`, its rear doors' shut lines
 *  and a raised roof over its crew from `yb` to `yR`; its beacon replaced by the caller's lights. */
export function crewCab(out, { yb, yf, yN, hw, z0, z1, yR, raise = 0.28, roof = paint('cab.roof') }) {
  const own0 = [];
  const anchors = cabOver(own0, { yb, yf, yN, hw, z0, z1 });
  out.push(...without(own0, ['beacon', 'beacon.base']));
  out.push(...plate({ axis: 'x', profile: [[yb, z1 - 0.02], [yR, z1 - 0.02], [yR - 0.12, z1 + raise], [yb, z1 + raise]], from: -hw, to: hw, r: 0.04, seg: 2, look: roof }));
  const seam = M('seam', 'seal', '#151614'), zw = z0 + 0.42, yd = yR - 0.06;
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.004), n = [s, 0, 0];
    out.push(face([[x, yd - 0.012, z0 + 0.05], [x, yd, z0 + 0.05], [x, yd, z1 - 0.1], [x, yd - 0.012, z1 - 0.1]], seam, n));
    out.push(face([[x, yb + 0.12, zw], [x, yd - 0.08, zw], [x, yd - 0.08, z1 - 0.18], [x, yb + 0.12, z1 - 0.18]], M('glass', 'glass', C.glass), n));
  }
  return anchors;
}

/** Roll-up lockers along a side `s` at x: `n` shutters between y0 and y1, z0 to z1, each framed, ribbed, its handle bar. */
export function lockers(out, { s, y0, y1, z0, z1, x, n }) {
  const P = (o) => out.push(...plate(o)), w = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const a = y0 + i * w + 0.04, b = a + w - 0.08;
    P({ axis: 'x', profile: rect(a, b, z0, z1), from: s * (x - 0.012), to: s * (x + 0.004), r: 0.004, seg: 1, look: alu('locker.shutter') });
    for (let z = z0 + 0.08; z < z1 - 0.04; z += 0.08) out.push(face([[s * (x + 0.006), a + 0.01, z], [s * (x + 0.006), b - 0.01, z], [s * (x + 0.006), b - 0.01, z + 0.012], [s * (x + 0.006), a + 0.01, z + 0.012]], M('locker.rib', 'seal', '#6f7377'), [s, 0, 0]));
    out.push(...tube([[s * (x + 0.012), a + 0.08, z0 + 0.06], [s * (x + 0.012), b - 0.08, z0 + 0.06]], 0.01, { sides: 6, look: M('locker.handle', 'alloy', CC.chrome) }));
  }
}

/** An outrigger at (x side, y): a beam out from the frame (stowed inside the body's width), its jack down on its pad when
 *  deployed, `z` the frame's height. */
export function outrigger(out, { s, y, hw, deployed, z = 0.9 }) {
  const P = (o) => out.push(...plate(o)), xo = deployed ? hw + 0.85 : hw - 0.13, foot = deployed ? 0.0 : z - 0.35;
  P({ axis: 'x', profile: rect(y - 0.12, y + 0.12, z - 0.16, z + 0.08), from: s * 0.5, to: s * xo, r: 0.01, seg: 1, look: dark('outrigger') });
  out.push(...tube([[s * (xo - 0.1), y, z], [s * (xo - 0.1), y, foot + 0.06]], 0.07, { sides: 10, look: dark('outrigger.jack') }));
  P({ axis: 'z', profile: rect(s * (xo - 0.1) - 0.2, s * (xo - 0.1) + 0.2, y - 0.2, y + 0.2), from: foot, to: foot + 0.05, r: 0.01, seg: 1, look: M('outrigger.pad', 'steel', C.steel) });
}

/** The frame on its axles (its rails, the axles' tubes), the rear axles' guards (a tandem's one pair over both), the
 *  side under-run rails between the front axle and the rear, the rear under-run bar striped red and white. */
export function chassis(out, { axles, yT, yN, r, hw, zf = 0.92, sideRails = true, rails = [0.42, 0.52], axleHalf = 0.86 }) {
  const P = (o) => out.push(...plate(o)), [yf] = axles, rear = axles.slice(1), y1 = Math.max(...rear), y2 = Math.min(...rear);
  for (const s of [-1, 1]) P({ axis: 'y', profile: rect(...xs(s, ...rails), zf - 0.26, zf), from: yT + 0.15, to: yN - 0.3, r: 0.01, seg: 1, look: dark('frame') });
  for (const y of axles) out.push(...tube([[-axleHalf, y, r], [axleHalf, y, r]], 0.065, { sides: 10, look: M('axle', 'steel', C.steel) }));
  for (const s of [-1, 1]) {
    if (rear.length > 1) out.push(...guard((y1 + y2) / 2, r, r + 0.08 + (y1 - y2) / 2, 0.35, Math.PI - 0.35, ...xs(s, 0.74, hw - 0.04), dark('guard.rear')));
    else out.push(...guard(y1, r, r + 0.08, 0.15, Math.PI - 0.15, ...xs(s, 0.74, hw - 0.04), dark('guard.rear')));
    if (sideRails) out.push(...tube([[s * (hw - 0.06), yf - r - 0.25, 0.55], [s * (hw - 0.06), y1 + r + 0.25, 0.55]], 0.03, { sides: 8, look: alu('underrun.side') }));
  }
  P({ axis: 'x', profile: rect(yT + 0.02, yT + 0.14, 0.4, 0.56), from: -hw + 0.12, to: hw - 0.12, r: 0.012, seg: 1, look: dark('underrun') });
  out.push(...stripes({ o: [hw - 0.14, yT + 0.02, 0.41], u: neg(X), v: Z, w: 2 * hw - 0.28, h: 0.14, n: neg(Y), colours: [CC.reflRed, CC.reflWhite], part: 'underrun.stripe' }));
}

export { M, paint, dark, alu, rect, xs, X, Y, Z, neg, guard, lamp, cabOver, C };
