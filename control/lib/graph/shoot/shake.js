/**
 * Shoot plan — the camera's SHAKE: how a camera held by a person, worn on a rig, run with or shaken by the world moves
 * off its keyed path. A camera's `shake` is a style (a SHAKES row) and how much of it (`amount`), over its whole range
 * or a `span`; the sampler (sample.js `cameraAt`) lays it over the keyed camera, so every reader of a sampled camera
 * (the render, the page's track, the Blender frames, the frame read) gets the same shake. A camera with none is
 * sampled exactly as before.
 *
 *   readShake(v, { seed, metersPerUnit }) → { shake, warnings }   v: a style word, `true` (handheld) or { style, amount?,
 *     seed?, span? }; the shake as stored: { style, amount, seed, span?, mpu? } (idempotent)
 *   shakeAt(shake, t) → { right, up, fwd, yaw, pitch, roll }   the offset at world time t: metres along the camera's
 *     own axes (in world units), and degrees of turn
 *
 * Noise from seeded dice only (the dice hashed from the seed, the channel and the lattice step), smooth between steps,
 * a second faster octave for a hand's tremor. Faded in and out over FADE at a span's ends. Pure and deterministic.
 */
import { mulberry32 } from '../city/plan/dice.js';

/** the styles: the drift's rate (Hz), how far it moves the camera (m), turns its aim and rolls it (degrees), and the
 * share of a faster tremor laid over it */
export const SHAKES = Object.freeze([
  { id: 'steadicam', says: 'worn on a rig: a slow float, no tremor', hz: 0.3, pos: 0.05, aim: 0.35, roll: 0.4, tremor: 0 },
  { id: 'handheld', says: 'held in the hands: a breathing drift and a small tremor', hz: 0.8, pos: 0.02, aim: 0.6, roll: 0.7, tremor: 0.18 },
  { id: 'run', says: 'run and gun: the operator moving with the action', hz: 2.2, pos: 0.045, aim: 1.6, roll: 1.3, tremor: 0.3 },
  { id: 'rumble', says: 'the world shaking: a blast, a quake, a train going by', hz: 7, pos: 0.03, aim: 1.1, roll: 0.8, tremor: 0.4 },
]);
const WORDS = { 'hand-held': 'handheld', hand: 'handheld', documentary: 'handheld', verite: 'handheld', 'vérité': 'handheld', steady: 'steadicam', gimbal: 'steadicam', float: 'steadicam', 'run-and-gun': 'run', running: 'run', shaky: 'run', quake: 'rumble', earthquake: 'rumble', explosion: 'rumble', impact: 'rumble' };
/** the fade at a span's ends (s), the tremor's rate over the drift's, the most a shake is turned up */
export const FADE = 0.3, TREMOR = 5.3, MOST = 4;

const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const hashSeed = (s) => { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const styleOf = (w) => { const s = String(w).trim().toLowerCase().replace(/[\s_]+/g, '-'); return SHAKES.find((x) => x.id === s) || SHAKES.find((x) => x.id === WORDS[s]) || null; };

/** The shake as stored (see the header) */
export function readShake(v, { seed = 'cam', metersPerUnit = 1 } = {}) {
  const warnings = [];
  if (v == null || v === false) return { shake: null, warnings };
  const o = typeof v === 'object' && !Array.isArray(v) ? v : { style: v === true ? 'handheld' : v };
  const row = styleOf(o.style ?? 'handheld');
  if (!row) { warnings.push(`unknown shake '${o.style}' (${SHAKES.map((x) => x.id).join(' | ')}); handheld kept`); }
  const amount = fin(o.amount) && o.amount > 0 ? Math.min(MOST, o.amount) : 1;
  const span = Array.isArray(o.span) && o.span.length === 2 && o.span.every(fin) && o.span[1] > o.span[0] ? o.span.slice() : null;
  const mpu = fin(o.mpu) && o.mpu > 0 ? o.mpu : (fin(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 1);
  const s = Number.isInteger(o.seed) && o.seed >= 0 ? o.seed : hashSeed(o.seed ?? seed);
  return { shake: { style: (row || SHAKES[1]).id, amount, seed: s, ...(span ? { span } : {}), ...(mpu !== 1 ? { mpu } : {}) }, warnings };
}

// a lattice value in [-1, 1] for (seed, channel, step), and the smooth value noise through them
const lattice = (seed, c, i) => mulberry32((seed ^ Math.imul(c + 1, 0x9e3779b1) ^ Math.imul(i, 0x85ebca77)) >>> 0)() * 2 - 1;
function noise(seed, c, x) {
  const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  return lattice(seed, c, i) * (1 - s) + lattice(seed, c, i + 1) * s;
}

/** The offset at a time (see the header) */
export function shakeAt(shake, t) {
  const zero = { right: 0, up: 0, fwd: 0, yaw: 0, pitch: 0, roll: 0 };
  if (!shake) return zero;
  const row = styleOf(shake.style) || SHAKES[1];
  let env = shake.amount ?? 1;
  if (shake.span) {
    const [a, b] = shake.span;
    if (t <= a || t >= b) return zero;
    env *= Math.min(1, (t - a) / FADE, (b - t) / FADE);
  }
  const n = (c) => noise(shake.seed, c, t * row.hz) + row.tremor * noise(shake.seed, c + 16, t * row.hz * TREMOR);
  const m = row.pos / (shake.mpu || 1);
  return { right: n(0) * m * env, up: n(1) * m * env, fwd: n(2) * m * 0.5 * env, yaw: n(3) * row.aim * env, pitch: n(4) * row.aim * env, roll: n(5) * row.roll * env };
}
