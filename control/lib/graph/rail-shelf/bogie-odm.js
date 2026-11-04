/**
 * bogie-odm — the design grammar of a railway bogie (a truck), on the vehicle ODM's pattern: a brief solved into one
 * set of numbers that hang off its wheel and its gauge, held to laws. bogie-surface.js compiles it. Pure and
 * deterministic: the seed explores a small band, an explicit dimension wins. Generic: no maker's bogie is copied.
 *
 *   archetype   metroMotor     a metro motor bogie: an H-frame, coil primaries, air springs, two frame-mounted motors
 *                              and their gearboxes, tread brakes
 *               metroTrailer   its trailer: no motors, two brake discs on each axle
 *               tram           a streetcar's: small wheels, rubber chevron primaries, coil secondaries, two motors, disc
 *                              brakes and the magnetic track brake shoes over the rails between its wheels
 *               regionalMotor  a regional unit's motor bogie: coil primaries, air springs, two motors, discs, yaw dampers
 *               highSpeed      a high-speed bogie: a long wheelbase, three discs an axle, yaw dampers on both sides
 *               freight        a freight car's three-piece truck: two cast side frames and a bolster through them on its
 *                              spring nests, tread brakes on a brake beam, no motor
 *               locoBoBo       a locomotive's two-axle bogie: big wheels, flexicoil secondaries, two nose-suspended
 *                              motors, tread brakes, sand pipes
 *               locoCoCo       a locomotive's three-axle bogie: the same over three axles
 *
 *   The wheel's PROFILE on the gauge: its back-to-back (the inner faces' distance), its flange, its width, its tread's
 *   taper; a wheel's tread meets the rail at the gauge's half. The FRAME's numbers: where its side beams stand outside
 *   the wheels (or the three-piece's side frames), how high over the axle boxes, how far it dips at its middle, its
 *   transoms; the SUSPENSION's: the primary's length between the axle box and the frame, the secondary's height to the
 *   pivot (the body's seat).
 *
 *   solveBogieDesign(brief) → { version, archetype, seed, axles, wheel, base, gauge, profile, frame, primary, secondary,
 *                               drive, brakes, dampers, pivot, laws, valid }
 *   axlesOf(design) → the axles' places along the bogie (y), centre first-to-last
 *
 * Bogie space: the origin on the bogie's centre at the top of the rail, +y forward, +x right, z up. Metres.
 */
const frozen = (x) => Object.freeze(x);
export const BOGIE_GRAMMAR_VERSION = 'rail-bogie-v0.1';
const r4 = (x) => Math.round(x * 10000) / 10000 + 0;

export const BOGIE_ARCHETYPES = frozen({
  metroMotor: frozen({ axles: 2, wheel: 0.84, base: 2.2, frame: 'h', primary: 'coil', secondary: 'air', drive: 'frame', motors: 2, brakes: 'tread', discs: 0, dampers: ['vertical', 'lateral'], track: false }),
  metroTrailer: frozen({ axles: 2, wheel: 0.84, base: 2.2, frame: 'h', primary: 'coil', secondary: 'air', drive: 'none', motors: 0, brakes: 'disc', discs: 2, dampers: ['vertical', 'lateral'], track: false }),
  tram: frozen({ axles: 2, wheel: 0.66, base: 1.8, frame: 'h', primary: 'chevron', secondary: 'coil', drive: 'frame', motors: 2, brakes: 'disc', discs: 1, dampers: ['vertical'], track: true }),
  regionalMotor: frozen({ axles: 2, wheel: 0.92, base: 2.5, frame: 'h', primary: 'coil', secondary: 'air', drive: 'frame', motors: 2, brakes: 'disc', discs: 1, dampers: ['vertical', 'lateral', 'yaw'], track: false }),
  highSpeed: frozen({ axles: 2, wheel: 0.92, base: 3.0, frame: 'h', primary: 'coil', secondary: 'air', drive: 'none', motors: 0, brakes: 'disc', discs: 3, dampers: ['vertical', 'lateral', 'yaw', 'yaw'], track: false }),
  freight: frozen({ axles: 2, wheel: 0.84, base: 1.83, frame: 'threePiece', primary: 'none', secondary: 'nest', drive: 'none', motors: 0, brakes: 'tread', discs: 0, dampers: [], track: false }),
  locoBoBo: frozen({ axles: 2, wheel: 1.25, base: 2.6, frame: 'h', primary: 'coil', secondary: 'flexicoil', drive: 'nose', motors: 2, brakes: 'tread', discs: 0, dampers: ['vertical', 'lateral'], track: false, sand: true }),
  locoCoCo: frozen({ axles: 3, wheel: 1.07, base: 3.9, frame: 'h', primary: 'coil', secondary: 'flexicoil', drive: 'nose', motors: 3, brakes: 'tread', discs: 0, dampers: ['vertical', 'lateral'], track: false, sand: true }),
});
export const BOGIE_KINDS = Object.freeze(Object.keys(BOGIE_ARCHETYPES));
export const BOGIE_LIMITS = frozen({ wheel: [0.55, 1.3], base: [1.6, 4.4], gauge: [1.0, 1.7] });
// the wheel's profile on standard gauge, metres: its back to back, its width, its flange's height and thickness, its
// tread's taper (1 in 20)
export const WHEEL_PROFILE = frozen({ backToBack: 1.36, width: 0.135, flange: 0.028, flangeThickness: 0.032, taper: 1 / 20 });

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let t = hash(seed); return () => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function number(value, fallback, limits, key) {
  if (value === undefined) return r4(Math.max(limits[0], Math.min(limits[1], fallback)));
  if (typeof value !== 'number' || !Number.isFinite(value) || value < limits[0] || value > limits[1]) throw new Error(`rail-bogie: ${key} must be in [${limits.join(', ')}]`);
  return r4(value);
}

/** The axles' places along the bogie, back to front. */
export function axlesOf(d) {
  const n = d.axles;
  return Array.from({ length: n }, (_, k) => r4(-d.base / 2 + (d.base * k) / (n - 1)));
}

export function solveBogieDesign({ seed = 1, archetype = 'metroMotor', dimensions = {} } = {}) {
  const A = BOGIE_ARCHETYPES[archetype];
  if (!A) throw new Error(`rail-bogie: unknown archetype ${archetype} (known: ${BOGIE_KINDS.join(', ')})`);
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) throw new Error('rail-bogie: dimensions must be an object');
  for (const k of Object.keys(dimensions)) if (!Object.hasOwn(BOGIE_LIMITS, k)) throw new Error(`rail-bogie: unknown dimension ${k}`);
  const random = rng(`${seed}:${archetype}`), jitter = (m) => (random() * 2 - 1) * m;
  const wheel = number(dimensions.wheel, A.wheel + jitter(0.01), BOGIE_LIMITS.wheel, 'wheel');
  const base = number(dimensions.base, A.base + jitter(0.03), BOGIE_LIMITS.base, 'base');
  const gauge = number(dimensions.gauge, 1.435, BOGIE_LIMITS.gauge, 'gauge');
  const r = wheel / 2, k = gauge / 1.435, W = WHEEL_PROFILE;
  // the wheel on the gauge: its inner face at half the back to back, its outer face a width outboard
  const profile = frozen({ inner: r4((W.backToBack * k) / 2), outer: r4((W.backToBack * k) / 2 + W.width), flange: W.flange, flangeThickness: W.flangeThickness, taper: W.taper, width: W.width });
  const heavy = archetype.startsWith('loco'), low = archetype === 'tram';
  // the axle box outboard of the wheel, the frame over it: an H-frame's side beams over the boxes, a three-piece's
  // side frames round them
  const box = frozen({ inner: r4(profile.outer + 0.03), outer: r4(profile.outer + (heavy ? 0.3 : 0.24)), half: r4(heavy ? 0.16 : 0.13) });
  const primary = frozen({ kind: A.primary, length: r4(A.primary === 'none' ? 0 : low ? 0.1 : heavy ? 0.24 : 0.15) });
  const frameDepth = r4(heavy ? 0.32 : low ? 0.18 : 0.22), z0 = r4(r + box.half + primary.length);
  const frame = frozen({
    kind: A.frame, x: r4((box.inner + box.outer) / 2), width: r4(box.outer - box.inner), z0, depth: frameDepth,
    // (the side beam's middle dips toward the rail between the axles: the secondary's seat)
    dip: r4(A.frame === 'h' ? Math.min(0.22, 0.4 * r) : 0), length: r4(base + wheel * 0.55 + 0.3), transoms: A.axles === 3 ? 2 : 2,
  });
  const secondary = frozen({ kind: A.secondary, height: r4(A.secondary === 'nest' ? 0.28 : A.secondary === 'flexicoil' ? 0.32 : low ? 0.14 : 0.2) });
  const seat = A.frame === 'h' ? frame.z0 + frame.depth - frame.dip : r + 0.18;
  const pivot = frozen({ z: r4(seat + secondary.height + 0.06) });
  const drive = frozen({ kind: A.drive, motors: A.motors });
  const brakes = frozen({ kind: A.brakes, discs: A.discs, track: A.track });
  const design = { version: BOGIE_GRAMMAR_VERSION, archetype, seed, axles: A.axles, wheel, base, gauge, profile, box, frame, primary, secondary, drive, brakes,
    dampers: frozen([...A.dampers]), sand: !!A.sand, pivot };
  const ys = axlesOf(design);
  const laws = [
    // (the wheels on the gauge: each tread's contact at the gauge's half, between the flange's root and the outer face)
    { id: 'wheels-on-gauge', pass: profile.inner + profile.flangeThickness < gauge / 2 + 0.02 && gauge / 2 < profile.outer },
    { id: 'wheels-apart', pass: ys.every((y, i) => !i || y - ys[i - 1] > wheel + 0.25) },
    { id: 'frame-clear-of-wheels', pass: A.frame === 'threePiece' ? box.inner > profile.outer : frame.x - frame.width / 2 > profile.outer + 0.01 },
    { id: 'frame-clear-of-rail', pass: (A.frame === 'h' ? frame.z0 - frame.dip : r - 0.22) > 0.1 },
    { id: 'within-envelope', pass: box.outer + 0.08 < 1.55 * k },
    { id: 'pivot-above-frame', pass: pivot.z > seat },
  ];
  return frozen({ ...design, laws: frozen(laws.map(frozen)), valid: laws.every((l) => l.pass) });
}
