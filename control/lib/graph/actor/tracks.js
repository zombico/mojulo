/**
 * tracks — the body take's channels: pose words flattened into numbers by path and back, a track's eased value at a
 * time, and the joints' speed limits the body keeps to and the readings check. Light on purpose (no rig, no solver), so
 * the readings read a take without loading the body's solvers.
 *
 *   flatten(pose) → { num: { 'shR.pitch': v, 'elbowR': v, 'fingersR.index': v, 'spine.lean': v (signed) … }, words }
 *   unflatten(num, words) → pose words; trackAt(keys, t, dflt) → the eased value
 *   SPEED  each joint's quickest turn (degrees a second): first guesses, past what a person's quickest gesture turns (a
 *          strike's shoulder and elbow turn faster still), the wrist and the head held well under
 *   RANGE  the hinge's and the head's ranges (degrees); clampTo(path, v) keeps a value in its channel's
 *   jointOf(path) → the joint a channel turns ('sh', 'elbow', 'wrist', 'fingers', 'head', 'spine' …)
 *
 * Pure and deterministic.
 */
import { HAND_POSES } from '../polygonizer/station-loft-rig.js';

export const FPS = 30;
export const SPEED = Object.freeze({ sh: 1200, elbow: 1500, wrist: 900, fingers: 1500, head: 500, neck: 500, spine: 200, pelvis: 120 });
/** a channel's range (degrees), the hinge's and the head's carriage: the body clamps a gesture's goal into it */
export const RANGE = Object.freeze({ elbowR: [0, 150], elbowL: [0, 150], 'head.pitch': [-45, 40], 'head.yaw': [-80, 80], 'head.roll': [-35, 35] });
export const clampTo = (path, v) => { const r = RANGE[path]; return r ? Math.min(r[1], Math.max(r[0], v)) : v; };
export const jointOf = (path) => /^(sh|elbow|wrist|fingers)[LR]/.exec(path)?.[1] ?? path.split('.')[0];

const SIGNED = { sideBend: ['left', 'right'], twist: ['left', 'right'], lean: ['forward', 'back'] };
/** a pose's numeric channels by path (a hand word as its curls, a spine word as a signed amount), its words kept apart */
export function flatten(pose) {
  const num = {}, words = {};
  for (const [k, v] of Object.entries(pose ?? {})) {
    if (typeof v === 'number') num[k] = v;
    else if (typeof v === 'string') { if (/^fingers[LR]$/.test(k) && HAND_POSES[v]) for (const [d, x] of Object.entries(HAND_POSES[v])) num[`${k}.${d}`] = x; else words[k] = v; }
    else if (v && typeof v === 'object' && !Array.isArray(v)) for (const [s, x] of Object.entries(v)) {
      if (typeof x === 'number') num[`${k}.${s}`] = x;
      else if (Array.isArray(x) && SIGNED[s]) num[`${k}.${s}`] = (x[0] === SIGNED[s][0] ? 1 : -1) * x[1];
      else words[`${k}.${s}`] = x;
    }
    else words[k] = v;
  }
  return { num, words };
}
const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** channels back into pose words */
export function unflatten(num, words = {}) {
  const pose = {};
  for (const [p, v] of Object.entries(words)) { const [k, s] = p.split('.'); if (s) (pose[k] ??= {})[s] = v; else pose[k] = v; }
  for (const [p, v] of Object.entries(num)) {
    const [k, s] = p.split('.');
    if (!s) { pose[k] = r4(v); continue; }
    (pose[k] ??= {})[s] = k === 'spine' && SIGNED[s] ? [v >= 0 ? SIGNED[s][0] : SIGNED[s][1], r4(Math.abs(v))] : r4(v);
  }
  return pose;
}

const smooth = (u) => u * u * (3 - 2 * u);
/** a track's value at t (keys sorted by t), eased key to key (smoothstep); `dflt` for a track with no key */
export function trackAt(keys, t, dflt = 0) {
  if (!keys?.length) return dflt;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) { const a = keys[i - 1], b = keys[i], u = (t - a.t) / Math.max(1e-6, b.t - a.t); return a.v + (b.v - a.v) * smooth(u); }
  return keys.at(-1).v;
}
