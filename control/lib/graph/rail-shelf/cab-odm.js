/**
 * cab-odm — the design grammar of a train's cab car, on the vehicle ODM's pattern (car-designer/vehicle-odm.js): a brief
 * solves into one physical frame, its body's section, its front as a field over that section, its anchors, all held to
 * laws. It does not draw; cab-surface.js compiles the surface from what this solves. Pure and deterministic: the seed
 * only explores a small band about each archetype's numbers, and an explicit dimension wins.
 *
 *   archetype   the cab's family, one per front form a train is drawn with:
 *               metro      a metro car's flat front, its corners rounded, a wraparound screen, an automatic coupler
 *               tram       a streetcar's rounded front over a low floor, its screen raked and tall, its coupler covered
 *               regional   a regional multiple unit's raked front over a crash nose, an automatic coupler
 *               highSpeed  a high-speed power car's long low nose, its screen high on its back, its coupler covered
 *               boxCab     an electric locomotive's flat cab front, two panes and a mullion, buffers and a buffer beam
 *
 *   The body's SECTION (`halfWidthAt(design, z)`): its half-width at each height above the rail, undercut from the skirt
 *   to the waist, leaning in by its tumblehome to the cant rail, round the cant rail's radius, across the roof's crown.
 *   The FRONT (`frontAt(design, x, z)`): how far forward of the nose's root the front stands at (x, z), a field
 *   y = root + nose·P(ζ)·Q(x / halfWidth(z)) over the section, ζ the height up the body: P the front's side profile
 *   (where it stands proud, where its screen rakes back, where its roof rounds over), Q its plan (1 on the centreline,
 *   0 at the side: (1 − |u|^m)^(1/m), m how square its corners are). At the side it meets the body exactly, so the
 *   seams the surface draws there are shared.
 *
 *   solveCabDesign(brief) → { version, archetype, seed, frame, section, front, screen, anchors, doors, laws, valid }
 *   halfWidthAt(design, z), frontAt(design, x, z), frontNormal(design, x, z)
 *
 * Coordinates: +y forward (the nose's tip at y = L/2), +x right, z up from the top of the rail. Metres. Generic: no
 * train or builder is copied; the numbers are each family's own band.
 */

import { BOGIE_ARCHETYPES, solveBogieDesign } from './bogie-odm.js';
import { solvePantoDesign, pantoPose } from './panto-odm.js';

const frozen = (x) => Object.freeze(x);
export const CAB_GRAMMAR_VERSION = 'rail-cab-v0.1';
const r4 = (x) => Math.round(x * 10000) / 10000 + 0;

// each family's frame and its front, at its centre; `profile` is P(ζ) as knots, `plan` the corners' m
export const CAB_ARCHETYPES = frozen({
  metro: frozen({
    length: 18.5, width: 2.9, height: 3.65, floor: 1.13, skirt: 0.55, nose: 0.6, overhang: 2.7,
    section: { undercut: 0.1, waist: 0.9, tumblehome: 0.08, cant: 0.42, radius: 0.34 },
    profile: [[0, 0.82], [0.14, 1], [0.5, 1], [0.8, 0.7], [0.94, 0.25], [1, 0]], plan: 5,
    screen: { bottom: 0.9, top: 2.15, half: 0.84, mullion: false }, sign: 0.22, mask: true,
    lamps: { z: 0.42, u: 0.62, high: false }, coupler: 'automatic', anticlimber: true, pilot: 'skirt',
    pantographs: [], bogies: ['metroMotor', 'metroTrailer'], doors: { count: 3, width: 1.4 }, windows: 'band', cabWindow: 1.4,
  }),
  tram: frozen({
    length: 11.5, width: 2.65, height: 3.4, floor: 0.35, skirt: 0.14, nose: 1.5, overhang: 2.3,
    section: { undercut: 0.06, waist: 0.75, tumblehome: 0.12, cant: 0.4, radius: 0.32 },
    profile: [[0, 0.72], [0.16, 0.98], [0.32, 1], [0.62, 0.7], [0.86, 0.3], [1, 0]], plan: 2.5,
    screen: { bottom: 0.72, top: 2.55, half: 0.9, mullion: false }, sign: 0.24, mask: true,
    lamps: { z: 0.55, u: 0.66, high: false }, coupler: 'covered', anticlimber: false, pilot: 'skirt',
    pantographs: [{ kind: 'tramArm', at: 0.08, facing: 1 }], bogies: ['tram', 'tram'], doors: { count: 2, width: 1.3 }, windows: 'band', cabWindow: 1.2,
  }),
  regional: frozen({
    length: 24, width: 2.85, height: 4.05, floor: 1.15, skirt: 0.55, nose: 2.6, overhang: 3.6,
    section: { undercut: 0.1, waist: 0.95, tumblehome: 0.09, cant: 0.5, radius: 0.4 },
    profile: [[0, 0.8], [0.2, 1], [0.34, 0.94], [0.62, 0.42], [0.86, 0.12], [1, 0]], plan: 3,
    screen: { bottom: 0.82, top: 2.1, half: 0.82, mullion: false }, sign: 0.2, mask: true,
    lamps: { z: 0.42, u: 0.6, high: true }, coupler: 'automatic', anticlimber: true, pilot: 'plough',
    pantographs: [{ kind: 'singleArm', at: -0.32, facing: 1 }], bogies: ['regionalMotor', 'regionalMotor'], doors: { count: 2, width: 1.3 }, windows: 'bays', cabWindow: 1.5,
  }),
  highSpeed: frozen({
    length: 25.5, width: 2.95, height: 3.9, floor: 1.25, skirt: 0.3, nose: 9, overhang: 7.4,
    section: { undercut: 0.12, waist: 0.95, tumblehome: 0.12, cant: 0.55, radius: 0.5 },
    profile: [[0, 0.86], [0.1, 1], [0.24, 0.9], [0.44, 0.48], [0.66, 0.17], [0.86, 0.04], [1, 0]], plan: 2.2,
    screen: { bottom: 0.95, top: 1.9, half: 0.7, mullion: false }, sign: 0, mask: true,
    lamps: { z: 0.12, u: 0.55, high: false }, coupler: 'covered', anticlimber: false, pilot: 'fairing',
    pantographs: [{ kind: 'singleArm', at: -0.4, facing: 1 }], bogies: ['highSpeed', 'highSpeed'], doors: { count: 1, width: 0.9 }, windows: 'band', cabWindow: 0,
  }),
  boxCab: frozen({
    length: 19, width: 3, height: 4.25, floor: 1.6, skirt: 0.95, nose: 0.42, overhang: 3.9,
    section: { undercut: 0.04, waist: 0.75, tumblehome: 0.05, cant: 0.6, radius: 0.42 },
    profile: [[0, 1], [0.42, 1], [0.72, 0.92], [0.92, 0.45], [1, 0]], plan: 7,
    screen: { bottom: 0.95, top: 1.85, half: 0.82, mullion: true }, sign: 0, mask: false,
    lamps: { z: -0.32, u: 0.66, high: true }, coupler: 'buffers', anticlimber: false, pilot: 'plough',
    pantographs: [{ kind: 'singleArm', at: 0.36, facing: -1 }, { kind: 'singleArm', at: -0.36, facing: 1 }], bogies: ['locoBoBo', 'locoBoBo'], doors: { count: 1, width: 0.75 }, windows: 'louvres', cabWindow: 0.9,
  }),
});
export const CAB_KINDS = Object.freeze(Object.keys(CAB_ARCHETYPES));

// what any cab car may be: a generic loading gauge's numbers and each frame number's band
export const CAB_LIMITS = frozen({
  length: [9, 28], width: [2.3, 3.2], height: [3.1, 4.35], floor: [0.28, 1.7], nose: [0.3, 12],
});
// a generic kinematic gauge: the half-width the body may not pass, by height above the rail (a box to the
// shoulder, tapering over it); not any one railway's
export const CAB_GAUGE = frozen([[0, 1.62], [3.3, 1.62], [3.9, 1.4], [4.4, 0.95]]);
// (over an electrified line the gauge's top gives way to the pantographs' zone: a folded pantograph's top under it)
export const CAB_PANTOGRAPH_ZONE = 4.9;
const gaugeAt = (z) => { for (let i = 1; i < CAB_GAUGE.length; i += 1) { const [z0, w0] = CAB_GAUGE[i - 1], [z1, w1] = CAB_GAUGE[i]; if (z <= z1) return w0 + ((w1 - w0) * (z - z0)) / (z1 - z0); } return 0; };

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let t = hash(seed); return () => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function number(value, fallback, limits, key) {
  if (value === undefined) return r4(Math.max(limits[0], Math.min(limits[1], fallback)));
  if (typeof value !== 'number' || !Number.isFinite(value) || value < limits[0] || value > limits[1]) throw new Error(`rail-cab: ${key} must be in [${limits.join(', ')}]`);
  return r4(value);
}

/** A monotone cubic through knots [[x, y]…] (no overshoot between them): the front's profile. */
export function monotone(knots) {
  const xs = knots.map((k) => k[0]), ys = knots.map((k) => k[1]), n = xs.length;
  const s = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = xs.map((_, i) => (i === 0 ? s[0] : i === n - 1 ? s[n - 2] : s[i - 1] * s[i] <= 0 ? 0 : 2 / (1 / s[i - 1] + 1 / s[i])));
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i += 1;
    const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

/** The body's half-width at height z above the rail (0 above the roof or below the skirt). */
export function halfWidthAt(d, z) {
  const S = d.section, { width: W, height: H } = d.frame, w = W / 2;
  if (z < S.z0 - 1e-9 || z > H + 1e-9) return 0;
  if (z <= S.zw) { const s = (z - S.z0) / (S.zw - S.z0); return w - S.undercut * (1 - s) * (1 - s); }
  if (z <= S.zc) return w - (S.tumblehome * (z - S.zw)) / (S.zc - S.zw);
  const cx = w - S.tumblehome - S.radius;
  if (z <= S.zc + S.radius) return cx + Math.sqrt(Math.max(0, S.radius * S.radius - (z - S.zc) ** 2));
  const zr = S.zc + S.radius, c = Math.min(1, (z - zr) / (H - zr));
  return cx * Math.sqrt(Math.max(0, 1 - c * c));
}

/** How far forward the front stands at (x, z): the nose's root plus its field (the root itself off the body). */
// (a design read back from its numbers, its profile's curve not carried: rebuilt from its knots, once)
const CURVES = new WeakMap();
const profileOf = (F) => { if (F.P) return F.P; if (!CURVES.has(F)) CURVES.set(F, monotone(F.profile)); return CURVES.get(F); };
export function frontAt(d, x, z) {
  const F = d.front, hw = halfWidthAt(d, z), P = profileOf(F);
  const u = hw > 1e-6 ? Math.min(1, Math.abs(x) / hw) : 1, zeta = (z - d.section.z0) / (d.frame.height - d.section.z0);
  const Q = Math.pow(Math.max(0, 1 - Math.pow(u, F.plan)), 1 / F.plan);
  return F.root + F.nose * Math.max(0, P(zeta)) * Q;
}

/** The front's outward normal at (x, z): the gradient of y − frontAt(x, z), forward. */
export function frontNormal(d, x, z) {
  const e = 0.004, fx = (frontAt(d, x + e, z) - frontAt(d, x - e, z)) / (2 * e), fz = (frontAt(d, x, z + e) - frontAt(d, x, z - e)) / (2 * e);
  const n = [-fx, 1, -fz], l = Math.hypot(...n);
  return n.map((v) => v / l);
}

/**
 * Solve a cab brief. Every station hangs off one frame; explicit dimensions win, the seed explores a small band.
 */
export function solveCabDesign({ seed = 1, archetype = 'metro', dimensions = {} } = {}) {
  const A = CAB_ARCHETYPES[archetype];
  if (!A) throw new Error(`rail-cab: unknown archetype ${archetype} (known: ${CAB_KINDS.join(', ')})`);
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) throw new Error('rail-cab: dimensions must be an object');
  for (const k of Object.keys(dimensions)) if (!Object.hasOwn(CAB_LIMITS, k)) throw new Error(`rail-cab: unknown dimension ${k}`);
  const random = rng(`${seed}:${archetype}`), jitter = (m) => (random() * 2 - 1) * m;
  const L = number(dimensions.length, A.length + jitter(0.3), CAB_LIMITS.length, 'length');
  const W = number(dimensions.width, A.width + jitter(0.02), CAB_LIMITS.width, 'width');
  const H = number(dimensions.height, A.height + jitter(0.03), CAB_LIMITS.height, 'height');
  const floor = number(dimensions.floor, A.floor, CAB_LIMITS.floor, 'floor');
  const nose = number(dimensions.nose, A.nose * (1 + jitter(0.06)), CAB_LIMITS.nose, 'nose');
  const S = A.section;
  // the section's heights: the skirt's foot, the waist, the cant rail (its round's foot)
  const section = frozen({ z0: A.skirt, zw: r4(floor + S.waist), zc: r4(H - S.cant), undercut: S.undercut, tumblehome: S.tumblehome, radius: S.radius });
  const P = monotone(A.profile), front = frozen({ root: r4(L / 2 - nose), nose, plan: A.plan, profile: A.profile, P });
  // (its bogies the bogie shelf's, solved on the same seed: their wheels, their wheelbase, their pivots' height)
  const B = A.bogies.map((k) => solveBogieDesign({ seed, archetype: k })), lead = B[0];
  const frame = frozen({ length: L, width: W, height: H, floor, wheel: lead.wheel, axle: lead.base, gauge: lead.gauge, bogies: [r4(L / 2 - A.overhang), r4(-L / 2 + A.overhang)],
    bogieKinds: frozen([...A.bogies]), pivot: r4(Math.max(...B.map((b) => b.pivot.z))) });
  // (its pantographs the shelf's, on its roof's crown at their places along it, facing their way)
  const pantographs = frozen(A.pantographs.map((p) => frozen({ kind: p.kind, y: r4((p.at * L) / 2), facing: p.facing })));
  const PD = pantographs.map((p) => solvePantoDesign({ seed, archetype: p.kind }));
  const screen = frozen({ z0: r4(floor + A.screen.bottom), z1: r4(floor + A.screen.top), half: A.screen.half, mullion: A.screen.mullion, sign: A.sign, mask: A.mask });
  const tip = r4(Math.max(...Array.from({ length: 41 }, (_, k) => frontAt({ frame, section, front }, 0, section.z0 + ((H - section.z0) * k) / 40))));
  const anchors = frozen({
    lamps: { z: r4(Math.max(section.z0 + 0.12, floor + A.lamps.z)), u: A.lamps.u, high: A.lamps.high },
    coupler: { kind: A.coupler, z: A.coupler === 'buffers' ? 1.06 : r4(Math.min(floor - 0.18, 1.0)) },
    anticlimber: A.anticlimber, pilot: A.pilot, tip,
  });
  // the doors: spaced along the body behind the cab, their leaves' width; the windows between them
  const D = A.doors, cab = 2.2 + nose, body = L - cab - 1.2, doors = [];
  for (let k = 0; k < D.count; k += 1) doors.push(r4(L / 2 - cab - (body * (k + (D.count === 1 ? 0.92 : 0.5))) / D.count));
  const design = { version: CAB_GRAMMAR_VERSION, archetype, seed, frame, section, front, screen, anchors, pantographs,
    doors: frozen({ at: frozen(doors), width: D.width, height: 1.95 }), windows: A.windows, cabWindow: A.cabWindow };
  // the laws: inside the gauge, the driver's eye inside the screen, the coupler's height, the wheels under the body
  const zs = Array.from({ length: 60 }, (_, k) => section.z0 + ((H - section.z0) * k) / 59);
  const eye = floor + 1.65, d = { frame, section, front };
  const laws = [
    { id: 'within-gauge', pass: zs.every((z) => halfWidthAt(d, z) <= gaugeAt(z) + 1e-9) && H <= CAB_GAUGE.at(-1)[0] },
    { id: 'eye-in-screen', pass: eye > screen.z0 && eye < screen.z1 },
    { id: 'screen-under-roof', pass: screen.z1 < section.zc + section.radius && screen.z0 > floor },
    { id: 'coupler-height', pass: anchors.coupler.kind === 'covered' || (anchors.coupler.z > 0.5 && anchors.coupler.z < 1.15) },
    { id: 'section-ordered', pass: section.z0 < floor + 0.01 && floor < section.zw && section.zw < section.zc && section.zc + section.radius < H },
    { id: 'front-ahead', pass: zs.every((z) => frontAt(d, 0, z) >= front.root - 1e-9) && tip <= L / 2 + 1e-3 },
    { id: 'wheels-under-body', pass: frame.gauge / 2 + 0.13 < W / 2 && frame.bogies[0] + frame.axle / 2 + frame.wheel / 2 < front.root + nose * 0.95 },
    // (each bogie's frame inside the body: its corners, at its pivot's height, inside the section and behind the front)
    { id: 'bogies-inside-body', pass: B.every((b, k) => { const yB = frame.bogies[k], ex = b.box.outer + (b.dampers.includes('yaw') ? 0.2 : 0.05), ey = b.base / 2 + b.wheel / 2 + (k === 0 ? 0.3 : 0.15), z = Math.max(section.z0 + 0.01, b.pivot.z);
      return [[ex, yB + ey], [-ex, yB + ey], [ex, yB - ey], [-ex, yB - ey]].every(([x, y]) => Math.abs(x) <= halfWidthAt(d, z) && y <= frontAt(d, x, z)); }) },
    // (the bogies' pivots under the floor; a low floor's bogies under the raised floor over them)
    { id: 'bogies-under-floor', pass: frame.pivot < floor - 0.05 || floor < frame.wheel },
    { id: 'bogies-valid', pass: B.every((b) => b.valid) },
    // (its pantographs folded inside an electrified gauge's pantograph zone, raised over their class's highest wire)
    { id: 'pantographs-fold-in-gauge', pass: PD.every((p) => H + pantoPose(p, { raise: 0 }).contact <= CAB_PANTOGRAPH_ZONE) },
    { id: 'pantographs-reach-wire', pass: PD.every((p) => p.valid && H + pantoPose(p, { raise: 1 }).contact >= p.band[1]) },
  ];
  return frozen({ ...design, laws: frozen(laws.map(frozen)), valid: laws.every((l) => l.pass) });
}
