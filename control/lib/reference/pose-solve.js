/**
 * pose-solve — the X-manji → dials inverse (direction "B").
 *
 * The forward map is `articulate(dof) → 3D joint positions` (figure-vajra). This
 * module inverts it by analysis-by-synthesis: search the dial vector so that the
 * articulated, projected joints best match a 2D X-manji the model drew (or traced
 * off a photo), subject to the armature's `LIMITS`.
 *
 * Why this is well-posed despite single-view depth ambiguity: the armature has
 * FIXED bone lengths and CLAMPED joints, so the space of poses that reproject to
 * a given X-manji is small and bounded. We don't free-solve 3D points — we solve
 * ~18 clamped joint DOFs over the real forward model. Roll (limb axial twist) is
 * weakly observable from one view and is left at its default (the documented
 * residual); a second view resolves the rest.
 *
 * See lite-template/integration/0612/polygomerization.plan.md (pose siblings) and
 * the X-manji discussion in docs/figure-vajra.md.
 */

import { articulate, FIGURE_NODES } from '@/lib/graph/polygonizer/figure-vajra';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Joints whose 2D positions carry the gesture (used for the fit error).
const FIT_KEYS = [
  'headTop', 'neckHub', 'navel', 'pelvisHub',
  'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
];

// The DOF axes we solve, with anatomical ranges and a coarse initial step.
// Roll is deliberately omitted — single-view-unobservable; defaults to 0.
const PARAMS = [
  { path: 'spine.sagittal', min: -1, max: 1, step: 0.5 },
  { path: 'spine.lateral', min: -1, max: 1, step: 0.5 },
  { path: 'spine.axial', min: -1, max: 1, step: 0.5 },
  { path: 'shL.yaw', min: -80, max: 80, step: 35 },
  { path: 'shL.pitch', min: -80, max: 80, step: 35 },
  { path: 'shR.yaw', min: -80, max: 80, step: 35 },
  { path: 'shR.pitch', min: -80, max: 80, step: 35 },
  { path: 'elbowL', min: 0, max: 150, step: 40 },
  { path: 'elbowR', min: 0, max: 150, step: 40 },
  { path: 'hipL.yaw', min: -62, max: 62, step: 28 },
  { path: 'hipL.pitch', min: -62, max: 62, step: 28 },
  { path: 'hipR.yaw', min: -62, max: 62, step: 28 },
  { path: 'hipR.pitch', min: -62, max: 62, step: 28 },
  { path: 'kneeL', min: 0, max: 150, step: 40 },
  { path: 'kneeR', min: 0, max: 150, step: 40 },
  { path: 'head.yaw', min: -90, max: 90, step: 30 },
  { path: 'head.pitch', min: -90, max: 90, step: 30 },
];

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, val) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = val;
}
function cloneDof(d) { return JSON.parse(JSON.stringify(d)); }

/**
 * Orthographic projection of the 3D armature to the 2D drawing plane at a view
 * azimuth (degrees about the vertical Z axis). screen-x = in-plane horizontal,
 * screen-y = world up. Consistent between target and candidate — that is all the
 * solver needs; the final figure is rendered separately by renderFigureToSvg.
 */
export function projectLandmarks(positions, azDeg = 0) {
  const a = (azDeg * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a);
  const out = {};
  for (const key of Object.keys(positions)) {
    const p = positions[key];
    if (!p) continue;
    out[key] = { x: p.x * ca - p.y * sa, y: p.z };
  }
  return out;
}

/**
 * Center on the pelvis and scale by torso length (pelvis→neck) so the fit is
 * translation- and scale-invariant — only the GESTURE is compared, not where the
 * model happened to place the drawing or how big it is.
 */
export function normalizeLandmarks(L) {
  const pelvis = L.pelvisHub || (L.hipL && L.hipR ? { x: (L.hipL.x + L.hipR.x) / 2, y: (L.hipL.y + L.hipR.y) / 2 } : { x: 0, y: 0 });
  const neck = L.neckHub || { x: pelvis.x, y: pelvis.y + 1 };
  const scale = Math.hypot(neck.x - pelvis.x, neck.y - pelvis.y) || 1;
  const out = {};
  for (const key of Object.keys(L)) {
    out[key] = { x: (L[key].x - pelvis.x) / scale, y: (L[key].y - pelvis.y) / scale };
  }
  return out;
}

// Light L2 prior on the dials: among poses that reproject equally well, prefer
// the SMALLEST one. This is what tames single-view under-determination — a DOF
// that lives in the invisible depth axis (e.g. spine.sagittal / head nod at a
// frontal view) contributes nothing to the 2D fit, so the prior relaxes it to
// neutral instead of letting it drift to a degenerate extreme. Each DOF is
// normalized by its half-range so the penalty is comparable across axes.
const REG_LAMBDA = 0.0014;

function regPenalty(dof) {
  let p = 0;
  for (const param of PARAMS) {
    const v = getPath(dof, param.path);
    if (v == null) continue;
    const half = (param.max - param.min) / 2;
    p += (v / half) ** 2;
  }
  return REG_LAMBDA * p;
}

// Raw 2D reprojection error — "how well does the pose match the drawing." This
// is the honest fit metric (no prior), used for reporting + the round-trip proof.
function rawReprojectionError(normTarget, dof, azDeg) {
  const norm = normalizeLandmarks(projectLandmarks(articulate(dof), azDeg));
  let err = 0, n = 0;
  for (const key of FIT_KEYS) {
    const t = normTarget[key], c = norm[key];
    if (!t || !c) continue;
    err += (t.x - c.x) ** 2 + (t.y - c.y) ** 2;
    n++;
  }
  return n ? err / n : Infinity;
}

// The optimizer minimizes raw fit + the L2 prior.
function cost(normTarget, dof, azDeg) {
  return rawReprojectionError(normTarget, dof, azDeg) + regPenalty(dof);
}

/**
 * Solve the dial vector that reproduces a 2D X-manji.
 *
 * @param target2D  { <nodeKey>: { x, y } } screen-space landmarks (any units;
 *                  normalized internally). Provide as many FIT_KEYS as known.
 * @param opts.view azimuth degrees the X-manji was drawn at (0 = front).
 * @param opts.passes coordinate-descent passes (step shrinks each pass).
 * @returns { dof, error, normTarget }  dof is a create_figure pose object.
 */
// DOFs that live in the depth axis and are unobservable near a given view, so
// the solver freezes them at neutral rather than fitting noise. Near FRONTAL
// (az≈0/180) the sagittal bend and head NOD project to almost nothing; near
// LATERAL (az≈90) it's the lateral bend and head YAW. A second view unlocks them
// — this is the multi-pass logic expressed as a fit constraint.
function depthFrozenForView(azDeg) {
  const a = ((azDeg % 180) + 180) % 180;
  if (a < 35 || a > 145) return ['spine.sagittal', 'head.pitch']; // ~frontal
  if (a > 55 && a < 125) return ['spine.lateral', 'head.yaw'];    // ~lateral
  return [];
}

export function solvePoseFromXManji(target2D, { view = 0, passes = 16, freeze } = {}) {
  const normTarget = normalizeLandmarks(target2D);
  const frozen = new Set(freeze || depthFrozenForView(view));
  const params = PARAMS.filter((p) => !frozen.has(p.path));
  let dof = {};
  let c = cost(normTarget, dof, view);
  let stepScale = 1;
  for (let pass = 0; pass < passes; pass++) {
    for (const p of params) {
      const cur = getPath(dof, p.path) ?? 0;
      const s = p.step * stepScale;
      let bestVal = cur, bestCost = c;
      for (const delta of [s, -s]) {
        const v = clamp(cur + delta, p.min, p.max);
        if (v === cur) continue;
        const cand = cloneDof(dof);
        setPath(cand, p.path, v);
        const e = cost(normTarget, cand, view);
        if (e < bestCost) { bestCost = e; bestVal = v; }
      }
      if (bestVal !== cur) { setPath(dof, p.path, bestVal); c = bestCost; }
    }
    stepScale *= 0.62;
  }
  return { dof, error: rawReprojectionError(normTarget, dof, view), cost: c, frozen: [...frozen], normTarget };
}

export { FIT_KEYS, PARAMS, FIGURE_NODES };
