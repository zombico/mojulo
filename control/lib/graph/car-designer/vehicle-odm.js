/**
 * Vehicle ODM — a deterministic, constrained design grammar for low, exotic road vehicles.
 *
 * This module resolves an architectural and styling brief into normalized body stations.
 * It does NOT claim to render the body: a later surface-patch compiler consumes the stations
 * and semantic anchors. Keeping it pure avoids disturbing the current realistic/racer poles.
 *
 * Coordinates: +y forward, +x right, +z up. Stations are ordered nose → tail;
 * `t` is normalized distance from the nose. Dimensions are metres.
 */
import { VEHICLES } from '../roads/vehicles.js';

const frozen = (x) => Object.freeze(x);
export const SUPERCAR_GRAMMAR_VERSION = 'vehicle-odm-v0.1';
export const SUPERCAR_ARCHETYPES = frozen({
  midEngine: frozen({ cabin: 0.43, nose: 0.18, tail: 0.19, frontShare: 0.44, cooling: 'side', roof: 'teardrop' }),
  frontEngine: frozen({ cabin: 0.53, nose: 0.26, tail: 0.13, frontShare: 0.51, cooling: 'front', roof: 'fastback' }),
  rearEngine: frozen({ cabin: 0.40, nose: 0.16, tail: 0.22, frontShare: 0.40, cooling: 'rear', roof: 'teardrop' }),
});
export const SUPERCAR_LANGUAGES = frozen({
  aeroWedge: frozen({ frontCrown: 0.65, rearHaunch: 0.94, canopyTaper: 0.71, tension: 0.85, intake: 'sculpted' }),
  grandTourer: frozen({ frontCrown: 0.84, rearHaunch: 0.76, canopyTaper: 0.83, tension: 0.58, intake: 'subtle' }),
  trackSpecial: frozen({ frontCrown: 0.56, rearHaunch: 1.0, canopyTaper: 0.66, tension: 0.96, intake: 'deep' }),
});
export const SUPERCAR_AERO = frozen({
  clean: frozen({ wing: 'none', splitter: 'integrated', diffuser: 'mild' }),
  road: frozen({ wing: 'active', splitter: 'integrated', diffuser: 'venturi' }),
  track: frozen({ wing: 'fixed', splitter: 'extended', diffuser: 'deep' }),
});
export const SUPERCAR_LIMITS = frozen({
  length: [4.1, 5.1], width: [1.85, 2.15], height: [1.05, 1.35],
  wheelbaseRatio: [0.55, 0.67], trackRatio: [0.78, 0.95],
  wheelRadius: [0.32, 0.40], groundClearance: [0.085, 0.16],
});
const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
const r4 = (x) => Math.round(x * 10000) / 10000;
const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
function rng(seed) {
  let t = hash(seed);
  return () => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
function choice(key, table) {
  if (!(key in table)) throw new Error(`vehicle-odm: unknown ${key} (known: ${Object.keys(table).join(', ')})`);
  return table[key];
}
function number(value, fallback, limits, key) {
  if (value === undefined) return r4(clamp(fallback, limits));
  if (typeof value !== 'number' || !Number.isFinite(value) || value < limits[0] || value > limits[1])
    throw new Error(`vehicle-odm: ${key} must be in [${limits.join(', ')}]`);
  return r4(value);
}

/**
 * Solve a design brief. All primary stations depend on the same physical frame,
 * rather than independent arbitrary attachment sizes.
 *
 * Explicit dimensions win; the seed only explores a small, safe design band.
 * No stock vehicle or registered marque is copied.
 */
export function solveSupercarDesign({
  seed = 1, architecture = 'midEngine', language = 'aeroWedge',
  aero = 'road', dimensions = {}, finish = 'paint',
} = {}) {
  const A = choice(architecture, SUPERCAR_ARCHETYPES);
  const D = choice(language, SUPERCAR_LANGUAGES);
  const E = choice(aero, SUPERCAR_AERO);
  if (!['paint', 'carbon', 'twoTone'].includes(finish)) throw new Error('vehicle-odm: unknown finish');
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) throw new Error('vehicle-odm: dimensions must be an object');
  for (const key of Object.keys(dimensions)) if (!Object.hasOwn(SUPERCAR_LIMITS, key)) throw new Error(`vehicle-odm: unknown dimension ${key}`);
  const random = rng(`${seed}:${architecture}:${language}`);
  const jitter = (m) => (random() * 2 - 1) * m;
  const L = number(dimensions.length, 4.55 + jitter(0.22), SUPERCAR_LIMITS.length, 'length');
  const W = number(dimensions.width, 2.0 + jitter(0.08), SUPERCAR_LIMITS.width, 'width');
  const H = number(dimensions.height, 1.18 + jitter(0.075), SUPERCAR_LIMITS.height, 'height');
  const wbRatio = number(dimensions.wheelbaseRatio, 0.605 + jitter(0.025), SUPERCAR_LIMITS.wheelbaseRatio, 'wheelbaseRatio');
  const trackRatio = number(dimensions.trackRatio, 0.85 + jitter(0.025), SUPERCAR_LIMITS.trackRatio, 'trackRatio');
  const r = number(dimensions.wheelRadius, 0.355 + jitter(0.018), SUPERCAR_LIMITS.wheelRadius, 'wheelRadius');
  const clearance = number(dimensions.groundClearance, 0.11 + jitter(0.018), SUPERCAR_LIMITS.groundClearance, 'groundClearance');
  const wheelbase = r4(L * wbRatio), track = r4(W * trackRatio);
  const overhang = r4((L - wheelbase) / 2);
  const cabinFront = r4(Math.max(0.29, A.cabin - 0.075));
  const cabinRear = r4(Math.min(0.79, A.cabin + 0.205));
  // Station widths are fractions of half-body width; heights are actual metres.
  const stations = [
    { id: 'nose', t: 0, halfWidth: r4(W * 0.35), zBottom: clearance, zTop: r4(H * 0.43) },
    { id: 'front-axle', t: r4(overhang / L), halfWidth: r4(W * 0.49 * D.frontCrown), zBottom: clearance, zTop: r4(H * 0.58) },
    { id: 'cowl', t: cabinFront, halfWidth: r4(W * 0.46), zBottom: clearance, zTop: r4(H * 0.68) },
    { id: 'canopy-peak', t: r4(A.cabin + 0.025), halfWidth: r4(W * 0.45 * D.canopyTaper), zBottom: clearance, zTop: H },
    { id: 'rear-glass', t: cabinRear, halfWidth: r4(W * 0.44 * D.canopyTaper), zBottom: clearance, zTop: r4(H * 0.80) },
    { id: 'rear-axle', t: r4((overhang + wheelbase) / L), halfWidth: r4(W * 0.49 * D.rearHaunch), zBottom: clearance, zTop: r4(H * 0.68) },
    { id: 'tail', t: 1, halfWidth: r4(W * 0.41), zBottom: clearance, zTop: r4(H * 0.50) },
  ];
  // No overlaps in the design grammar: fail rather than silently produce invalid surfaces.
  if (stations.some((s, i) => i && s.t <= stations[i - 1].t))
    throw new Error('vehicle-odm: invalid longitudinal station ordering');
  const anchors = {
    wheelFL: [r4(-track / 2), r4(L / 2 - overhang), r],
    wheelFR: [r4(track / 2), r4(L / 2 - overhang), r],
    wheelRL: [r4(-track / 2), r4(-L / 2 + overhang), r],
    wheelRR: [r4(track / 2), r4(-L / 2 + overhang), r],
    intakeL: [r4(-W * 0.48), r4(L * (0.5 - cabinRear)), r4(H * 0.38)],
    intakeR: [r4(W * 0.48), r4(L * (0.5 - cabinRear)), r4(H * 0.38)],
  };
  const laws = [
    { id: 'wheelbase-inside-body', pass: wheelbase < L },
    { id: 'wheels-inside-envelope', pass: track + r * 0.38 <= W },
    { id: 'ground-clearance', pass: clearance < r },
    { id: 'station-order', pass: stations.every((s, i) => !i || s.t > stations[i - 1].t) },
    { id: 'canopy-above-cowl', pass: H > stations[2].zTop },
  ];
  return {
    version: SUPERCAR_GRAMMAR_VERSION, seed, architecture, language, aero, finish,
    frame: { L, W, H, wheelbase, track, wheelRadius: r, groundClearance: clearance },
    topology: { stations, anchors, cooling: A.cooling, roof: A.roof, intake: D.intake, aero: E, surfaceTension: D.tension },
    laws, valid: laws.every((l) => l.pass),
    // A stable compatibility hint: geometry compiler and physics implementation are intentionally separate.
    drivingReference: 'sports', physicsReference: VEHICLES.sports.words,
  };
}
