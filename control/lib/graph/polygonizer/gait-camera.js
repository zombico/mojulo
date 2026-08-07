/**
 * gait-camera — bake the figure rig's walk cycle into a compact camera-offset
 * curve for the World tier's first-person view (see fpv-gait-camera.plan.md).
 *
 * The head-bob of a believable FPV is NOT a hand-tuned sine wave: it is the real
 * trajectory the rig's head travels through every stride — the pelvis vaults
 * (inverted pendulum), the body sways laterally over each planted foot, the head
 * counter-yaws to hold the gaze level. This module samples that trajectory ONCE,
 * server-side, into a tiny per-cycle offset table that the browser indexes by
 * distance walked. Same philosophy as the baked vexar lighting: the auto-effect
 * is a readout of the rig, not a fake bolted beside it.
 *
 * The trajectory is sampled through the SAME balance/vault pipeline the figure
 * render uses (figure-render.js `buildPosedFigure`): a walk's `dof.plant` drives
 * `groundVault`, which is where the dominant vertical bob comes from — articulate()
 * alone (hip pinned at rest height) cannot produce it.
 *
 * Net locomotion is intentionally NOT in the curve. `gait()` stays in place (the
 * planted foot treadmills backward); forward travel comes from the walk controller.
 * So after sampling we subtract the per-cycle mean — only the wobble survives.
 */
import { gait, WALK_DEFAULTS } from './figure-posing.js';
import { articulate } from './figure-vajra.js';
import { groundVault } from './figure-balance.js';

const DEG = 180 / Math.PI;
const BOB_KEYS = ['dx', 'dy', 'dz', 'pitch', 'roll', 'yaw'];

// Band-limit a periodic series to its first `kmax` harmonics (a DFT low-pass). The raw
// rig trajectory is faithful but PEAKY — the vault's inverted-pendulum low is a sharp
// cusp at each footfall, which reads as a jolt. Keeping only the low harmonics turns it
// into the smooth FPS-style bob (sway at the stride fundamental, vertical at the 2nd) while
// preserving the gait's real amplitude + phase. Feel accuracy over pure fidelity.
function bandLimit(series, kmax) {
  const N = series.length;
  const out = new Array(N).fill(0);
  for (let k = 0; k <= kmax; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) { const a = (2 * Math.PI * k * n) / N; re += series[n] * Math.cos(a); im -= series[n] * Math.sin(a); }
    re /= N; im /= N;
    const fold = k === 0 || (N % 2 === 0 && k === N / 2) ? 1 : 2;   // sum the conjugate negative frequency
    for (let n = 0; n < N; n++) { const a = (2 * Math.PI * k * n) / N; out[n] += fold * (re * Math.cos(a) - im * Math.sin(a)); }
  }
  return out;
}

// Pose the rig at one phase and read the head as a camera mount. Mirrors the
// balance branch of buildPosedFigure: a walk sets dof.plant (vault:true), so the
// inverted-pendulum vault carries the real bob; without plant we read pure FK.
function headPoseAt(gaitFn, phase) {
  const dof = gaitFn(phase);
  const full = articulate(dof);
  const balanced = dof.plant ? groundVault(full, { plant: dof.plant }) : full;
  const hb = balanced.headBase;   // atlas — the skull-on-spine pivot, ~eye level
  const ht = balanced.headTop;    // head apex — gives the head's up/tilt segment
  // Gaze azimuth (looking left/right) is an AXIAL rotation: it lives in dof.head.yaw
  // (the gait's counter-hold against the sway) + dof.neck.yaw, and is invisible in
  // the near-vertical headBase→headTop segment, so it is read from the dof here.
  const yawDeg = ((dof.head && dof.head.yaw) || 0) + ((dof.neck && dof.neck.yaw) || 0);
  return { hb, ht, yawDeg };
}

/**
 * Bake a walk's head motion into a compact camera-offset curve.
 *
 * @param {Partial<typeof WALK_DEFAULTS>} [params]  gait dials (intensity lives here:
 *   hipSway, headLevel, pelvisRot, vault, …) — passed straight to gait().
 * @param {number} [samples=32]  curve resolution over one stride cycle.
 * @param {{smooth?: number|boolean}} [opts]  smooth → band-limit the curve to its first
 *   N harmonics (true = 2: the FPS sway+vault model, jitter removed). 0/false = raw rig.
 * @returns {{ samples:number, strideDistance:number, curve:Array<{
 *   dx:number, dy:number, dz:number, pitch:number, roll:number, yaw:number }> }}
 *   Positions in STAND units (dx lateral, dy fore/aft, dz vertical); angles in
 *   degrees. All zero-meaned over the cycle. `strideDistance` = the controller
 *   ground travel (STAND units) that advances the phase by one full cycle.
 */
export function gaitCameraCurve(params = {}, samples = 32, opts = {}) {
  const gaitFn = gait(params);
  const raw = [];
  for (let i = 0; i < samples; i++) {
    const { hb, ht, yawDeg } = headPoseAt(gaitFn, i / samples);
    const v = { x: ht.x - hb.x, y: ht.y - hb.y, z: ht.z - hb.z };   // head up-segment
    const upXY = Math.hypot(v.x, v.z) || 1;
    raw.push({
      x: hb.x, y: hb.y, z: hb.z,
      pitch: Math.atan2(v.y, Math.hypot(v.x, v.z)) * DEG,   // fore/aft nod
      roll: Math.atan2(v.x, upXY) * DEG,                    // lateral head tilt
      yaw: yawDeg,                                          // gaze counter-hold (deg)
    });
  }
  // Zero-mean each channel so only the wobble survives (locomotion comes from the
  // walk controller; gait() itself stays in place).
  const mean = (k) => raw.reduce((s, r) => s + r[k], 0) / raw.length;
  const m = { x: mean('x'), y: mean('y'), z: mean('z'), pitch: mean('pitch'), roll: mean('roll'), yaw: mean('yaw') };
  let curve = raw.map((r) => ({
    dx: r.x - m.x, dy: r.y - m.y, dz: r.z - m.z,
    pitch: r.pitch - m.pitch, roll: r.roll - m.roll, yaw: r.yaw - m.yaw,
  }));
  if (opts.smooth) {
    const kmax = opts.smooth === true ? 2 : opts.smooth;
    const lim = {};
    for (const key of BOB_KEYS) lim[key] = bandLimit(curve.map((c) => c[key]), kmax);
    curve = curve.map((_, n) => Object.fromEntries(BOB_KEYS.map((key) => [key, lim[key][n]])));
  }
  const strideLength = params.strideLength ?? WALK_DEFAULTS.strideLength;
  return { samples, strideDistance: strideLength, curve };
}
