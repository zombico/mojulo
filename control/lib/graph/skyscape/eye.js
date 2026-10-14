/**
 * THE PILOT'S EYE — scapeshift's eye spot, read from the air. A driver's things are spaced in seconds along a road a
 * metre under the eye (roads/eye.js); a pilot's eye is tens to thousands of metres over the ground and moves at up to
 * a few hundred metres a second, so the same law (a thing reads when it spans the eye spot where it is: 12 px of a
 * 640 × 448 frame at 60°, playscape/objects/laws.js) sets very different numbers for the ground:
 *
 *   rings        times to reach, as for the driver (near under 0.6 s, mid to 3 s, far beyond), in metres at a speed
 *   gaze         where the eye lands: GAZE_AHEAD s down the flight path, so the slant range to it grows with height
 *   spacing      the finest ground spacing that reads at a slant range: half the eye spot there (two cells per spot,
 *                so a feature the size of the spot keeps its shape)
 *   lod          the terrain channel's quadtree knobs that follow (scene/channels/terrain-lod.js): `split` from the
 *                frame alone (a leaf's spacing tracks the eye spot at every range), `minSize` from the lowest eye the
 *                craft needs (an approach to land, or its low pass), and how many chunks a frame the ground must build
 *                to keep up at top speed down low
 *
 * A CRAFT is an envelope, not a model: the speeds and heights the eye needs (the fly rule's dials come from it too).
 * Each is a class of real aircraft with its numbers from the type's published figures (stall, cruise, never-exceed,
 * service ceiling, normal bank limit); `lowPass` (the lowest it flies when not landing) is a game choice per class.
 *
 *   CRAFT, craftOf(spec), pilotEye(craft, { lands })
 *
 * Pure, deterministic (dmath for every transcendental that reaches a number we keep).
 */
import { FRAME, EYE_SPOT_PX } from '../playscape/objects/laws.js';
import { EYE_RINGS } from '../roads/eye.js';
import * as dmath from '../../util/dmath.js';

const DEG = Math.PI / 180;
export const G = 9.81;
/** s down the flight path where the pilot's eye lands (the driver's is 1.5 s; a pilot looks further, as instructors teach). */
export const GAZE_AHEAD = 3;
/** Ground cells per eye spot: two, so a feature the size of the spot keeps a shape. */
export const CELLS_PER_SPOT = 2;
/** The terrain channel's chunk is n × n quads (TERRAIN_LOD_DEFAULTS.n). */
export const CHUNK_N = 32;
/** An approach's speed over the stall (the 1.3 Vs rule of thumb), and the eye's height at the flare (m). */
export const APPROACH = Object.freeze({ overStall: 1.3, flareEye: 2 });

/**
 * The classes. Speeds m/s, heights m, bank in degrees, mass kg (a typical flying weight), thrust N (static; a
 * propeller's is its power at the climb speed, roughly), glide the best glide ratio (the engine-out lesson), sink the
 * touchdown sink rate (m/s) its gear is built for (light aircraft gear ~3 m/s, a transport's limit landing 3.6).
 *   glider   a two-seat training glider (Schweizer SGS 2-33 class: stall ~31 kt, Vne 98 mph, ~1,000 lb flying, L/D 23)
 *   trainer  a four-seat piston trainer (Cessna 172 class: stall ~48 kt, cruise ~122 kt, Vne 163 kt, 13,500 ft,
 *            ~2,400 lb, 180 hp)
 *   jet      a jet trainer (BAE Hawk class: stall ~100 kt, cruise ~400 kt, M0.84 low, 44,500 ft, ~5 t, one Adour
 *            of ~26 kN)
 */
export const CRAFT = Object.freeze({
  glider: { label: 'training glider', stall: 16, cruise: 24, max: 44, ceiling: 3000, lowPass: 30, bankMax: 45, sink: 2, engine: false, mass: 470, thrust: 0, glide: 23 },
  trainer: { label: 'piston trainer', stall: 25, cruise: 63, max: 84, ceiling: 4100, lowPass: 60, bankMax: 60, sink: 3, engine: true, mass: 1090, thrust: 2900, glide: 9 },
  jet: { label: 'jet trainer', stall: 52, cruise: 206, max: 285, ceiling: 13500, lowPass: 150, bankMax: 80, sink: 3.6, engine: true, mass: 5000, thrust: 26000, glide: 12 },
});

const FIELDS = ['stall', 'cruise', 'max', 'ceiling', 'lowPass', 'bankMax'];

/** A craft from a class name or a custom envelope (its missing fields the trainer's). Throws a teaching error. */
export function craftOf(spec = 'trainer') {
  if (typeof spec === 'string') {
    const c = CRAFT[spec];
    if (!c) throw new Error(`craft: unknown class '${spec}'; classes: ${Object.keys(CRAFT).join(', ')}, or a custom { stall, cruise, max, ceiling, lowPass, bankMax }`);
    return { key: spec, ...c };
  }
  if (!spec || typeof spec !== 'object') throw new Error('craft: a class name or a custom envelope { stall, cruise, max, ceiling, lowPass, bankMax }');
  const c = { key: 'custom', ...CRAFT.trainer, label: 'custom craft', ...spec };
  for (const k of FIELDS) if (!(Number.isFinite(c[k]) && c[k] > 0)) throw new Error(`craft.${k} must be a number > 0`);
  if (!(c.stall < c.cruise && c.cruise <= c.max)) throw new Error('craft: stall < cruise ≤ max');
  if (!(c.bankMax < 89)) throw new Error('craft.bankMax must be under 89 degrees');
  return c;
}

/** The metres one frame pixel covers at a distance (FRAME's vertical fov over its height), deterministically. */
export const metresPerPx = (d) => (2 * d * dmath.tan((FRAME.fovDeg * DEG) / 2)) / FRAME.height;
/** The least span (m) that reads at a distance. */
export const eyeSpotAt = (d) => EYE_SPOT_PX * metresPerPx(d);
/** The finest ground spacing (m) that reads at a slant range. */
export const spacingAt = (d) => eyeSpotAt(d) / CELLS_PER_SPOT;
/** The slant range (m) to where the eye lands, from a height (m) at a speed (m/s). */
export const gazeRange = (h, v) => dmath.hypot(h, v * GAZE_AHEAD);
/** The level turn's radius (m) at a speed and bank (deg): r = v² / (g · tan bank). */
export const turnRadius = (v, bankDeg) => (v * v) / (G * dmath.tan(bankDeg * DEG));

const r2 = (v) => Math.round(v * 100) / 100;
const pow2Floor = (x) => { let p = 4; while (p * 2 <= x) p *= 2; return p; };

/**
 * What the eye needs from the ground for a craft. `lands`: the craft lands in play (a flight sim), so the ground at the
 * flare must read; otherwise its low pass is the lowest eye.
 * → { craft, rings: { cruise, max } (each { near, mid, far } in m), gaze: { lowPass, cruise }, spacing: { flare,
 *     lowPass, cruise }, lod: { n, split, minSize, chunksPerSecond, chunksPerFrame }, turn: { cruise, max } }
 */
export function pilotEye(craftSpec, { lands = true } = {}) {
  const c = craftOf(craftSpec);
  const ringsAt = (v) => Object.fromEntries(Object.entries(EYE_RINGS).map(([k, [a, b]]) => [k, [r2(a * v), Number.isFinite(b) ? r2(b * v) : null]]));
  const approach = c.stall * APPROACH.overStall;
  const gFlare = gazeRange(APPROACH.flareEye, approach), gLow = gazeRange(c.lowPass, c.max), gCruise = gazeRange(c.lowPass * 4, c.cruise);
  const spacing = { flare: r2(spacingAt(gFlare)), lowPass: r2(spacingAt(gLow)), cruise: r2(spacingAt(gCruise)) };
  // a leaf's spacing is its size / n, and a node splits while the eye is nearer than split × its size: so at range D the
  // finest built spacing is about D / (split · n). Matching spacingAt(D) = k·D gives split = 1 / (n · k), a law of the
  // frame alone, the same at every height
  const k = spacingAt(1);
  const split = r2(1 / (CHUNK_N * k));
  const finest = lands ? spacing.flare : spacing.lowPass;
  const minSize = Math.min(4096, pow2Floor(Math.max(4, finest * CHUNK_N)));
  // keeping up: down low at top speed the finest ring's front edge sweeps new leaves; each coarser level sweeps half as
  // many, so the levels together build about twice the finest's. The finest level the eye splits to at the low pass:
  const leaf = Math.max(minSize, pow2Floor(c.lowPass / split) || minSize);
  const rowWidth = 2 * split * leaf;                         // the finest ring is about split leaves either side
  const chunksPerSecond = r2(2 * (c.max / leaf) * (rowWidth / leaf));
  return {
    craft: c,
    rings: { cruise: ringsAt(c.cruise), max: ringsAt(c.max) },
    gaze: { flare: r2(gFlare), lowPass: r2(gLow), cruise: r2(gCruise) },
    spacing,
    lod: { n: CHUNK_N, split, minSize, leafAtLowPass: leaf, chunksPerSecond, chunksPerFrame: r2(chunksPerSecond / 60) },
    turn: { cruise: r2(turnRadius(c.cruise, c.bankMax)), max: r2(turnRadius(c.max, c.bankMax)) },
  };
}
