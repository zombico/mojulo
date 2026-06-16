/**
 * Visual Reference — the harness as the vision adapter.
 *
 * A vision-capable harness (Claude Code / Codex / …) reads a photo it ALREADY
 * sees, decomposes it into mojulo's own generative dials, and files the result
 * as a reusable "reference + insights" artifact in a stash. There is no vision
 * key, no vision API call, and no pixels-for-understanding crossing the MCP
 * boundary — only the model's structured read. This mirrors the App paradigm's
 * posture (inference parked back on the agent) applied to vision.
 *
 * The capability is extraction-target-polymorphic: the same mechanism aimed at
 * different dummies. Only two things vary per target — the dial-set the model
 * writes into, and the "what's lost" caveats:
 *
 *   - scene → camera / roomBasis      → a perspective-frame cage (sketch marks)
 *   - pose  → figure pose dials        → a posed figure dummy (kind: 'figure')
 *
 * Everything else is shared: the stash item, the `insights` block, the fidelity
 * dial (thematic/gesture vs faithful), the single-shot/multi-pass lifecycle.
 *
 * This module owns the CONTENT (the two extraction protocols — the "how to
 * look") and the pure lowering (insights → cage manifest). The DB orchestration
 * (mint stash, create cage sketch, gather item) lives in the tool handler.
 *
 * See lite-template/integration/0612/visual-reference.plan.md.
 */

import { validateSketchManifest } from '@/lib/graph/sketch-manifest';
import { solvePoseFromXManji } from './pose-solve.js';

// Named figure views → azimuth degrees (matches figure-render's view convention).
const VIEW_AZ = { frontal: 0, 'three-quarter': 38, lateral: 90, left: -90, back: 180 };
function viewToAz(v) {
  if (Number.isFinite(v)) return v;
  if (typeof v === 'string' && VIEW_AZ[v] != null) return VIEW_AZ[v];
  return 0;
}

/**
 * Resolve the pose dials for a pose reference. Preferred input is an X-manji
 * (`insights.xmanji.landmarks` + `view`): the substrate SOLVES the dials against
 * the locked armature (direction "B" — see pose-solve.js). `insights.dials` is an
 * escape hatch when the model already has joint angles. Returns the dials plus a
 * `solve` report (error + which DOFs were depth-frozen) so the caller can surface
 * the fit quality and the multi-pass cue.
 */
export function resolvePoseDials(insights = {}) {
  const xm = insights.xmanji;
  if (xm && xm.landmarks && typeof xm.landmarks === 'object' && !Array.isArray(xm.landmarks)) {
    const view = viewToAz(xm.view !== undefined ? xm.view : insights.view);
    const { dof, error, frozen } = solvePoseFromXManji(xm.landmarks, { view });
    return { dials: dof, view, solve: { source: 'xmanji', error, frozen, view } };
  }
  const dials = insights.dials || insights.pose;
  if (!dials || typeof dials !== 'object' || Array.isArray(dials)) {
    throw new Error('pose reference requires insights.xmanji.landmarks (preferred) or insights.dials');
  }
  return { dials, view: insights.view, solve: { source: 'dials' } };
}

export const REFERENCE_TARGETS = ['scene', 'pose'];

// Per-target default fidelity. Scene/pose lean THEMATIC/GESTURE — recover the
// scaffold's attitude, let the substrate fill the rest; `faithful` is the opt-in.
export const DEFAULT_FIDELITY = { scene: 'thematic', pose: 'gesture' };

// ---------------------------------------------------------------------------
// The extraction protocols (the heart — content, not plumbing). Each is the
// "how to look" a vision harness reads BEFORE it fills capture_reference args:
// which key lines to read off the image, which dials to map them onto, how
// tightly to quantize at the chosen fidelity, the expressive ceiling, and which
// second view resolves which single-photo ambiguity.
// ---------------------------------------------------------------------------

const SCENE_PROTOCOL = {
  target: 'scene',
  summary:
    "Read a scene/room/building photo's PERSPECTIVE — not its texture. Recover the spatial scaffold (horizon, vanishing points, floor convergence, relative scale) and write it into a two-point camera the substrate builds inside. Throw away surface; keep the cage.",
  key_lines: [
    'HORIZON: the eye-level line. Find where receding parallel edges would converge in Y; that band is the horizon. Report its pixel Y (`camera.horizonY`).',
    'VANISHING POINTS: extend the two dominant sets of parallel horizontal edges (e.g. the two wall/floor directions). Where each set converges ON the horizon is a vanishing point. Report both as screen pixels (`camera.vanishingPoints.left` / `.right`); they are usually OUTSIDE the photo frame — that is expected.',
    'FLOOR QUAD: the near edge of the ground plane. Report its left corner in pixels (`roomBasis.frontLeft`); the opposite corner (`roomBasis.frontRight`) if you can read it.',
    'DEPTH FALLOFF: how fast things shrink with distance → `roomBasis.depthReach` (0.08–0.88, default 0.46) and `roomBasis.verticalUnit` (px per world-height unit).',
    'RELATIVE SCALE: pick two recognizable objects and report a ratio ("the figure ≈ 0.4 × the door"). Do NOT invent absolute metres unless the operator names a known dimension → then set `roomBasis.worldExtent`.',
  ],
  dial_schema: {
    'camera.vanishingPoints.left/right': '[x, y] screen pixels on the horizon (may be off-frame).',
    'camera.horizonY': 'number — horizon line Y in pixels.',
    'camera.verticalAxis': '[x, y] unit vector, default [0, -1] (up).',
    'roomBasis.frontLeft / frontRight': '[x, y] near floor corners in pixels.',
    'roomBasis.depthReach': '0.08–0.88, vanishing-point influence falloff (default 0.46).',
    'roomBasis.verticalUnit': 'px per world-height unit (default 26).',
    'roomBasis.xRange / yRange': 'world-space [min,max] extents (defaults [-18,18] / [-28,8]).',
    'roomBasis.worldExtent': 'OPTIONAL { width, depth, height } in real units — only if the operator grounds a dimension.',
    'viewBox': 'OPTIONAL { width, height } — the pixel space your coordinates are measured in (used to draw the cage).',
  },
  fidelity_contract: {
    thematic:
      'DEFAULT. Recover rough horizon + VP spread + relative depth; let palette/structure/walls come from substrate vocabulary. Loose knobs, generative fill.',
    faithful:
      'Measure the ACTUAL VP pixel positions and floor convergence and pin them. Then re-render the cage, Read it back, and check the convergence lines land where the photo\'s do; nudge depthReach/VP and repeat.',
  },
  ceiling: [
    'AFFINE two-point only — no lens intrinsics, no focal length, no >2 vanishing points. Wide-angle / fisheye barrel curvature is FLATTENED (straight lines that bow in the photo go straight).',
    'No bird\'s-eye / worm\'s-eye in the recipe path — VPs sit on the horizon (eye-level).',
    'Scale is RELATIVE unless the operator names a real dimension; a single photo cannot recover absolute metres.',
  ],
  multipass_hint:
    'Single photo = affine cage with relative-scale guesses. A SECOND viewpoint of the same scene lets you triangulate true depth/scale — call capture_reference again with the same stash_ref to refine. Sanity check: render the cage from a different angle; if it looks wrong, the depth was guessed wrong → ask for another photo.',
  capture_call:
    "capture_reference({ target:'scene', fidelity, insights:{ camera, roomBasis, viewBox?, scale, thematic, provenance, caveats }, stash_ref? })",
};

const POSE_PROTOCOL = {
  target: 'pose',
  summary:
    "Read a human photo's GESTURE by TRACING its X-manji — the figure's stick-skeleton (head, central axis, shoulder bar, hip bar, the anatomical X, and the limb lines). You place 2D landmark points; you do NOT guess joint angles. capture_reference SOLVES the pose dials from your X-manji against the locked armature (fixed bone lengths + clamped limits), so a clean trace beats hand-tuned degrees.",
  key_lines: [
    'TRACE these landmarks as 2D points, one per joint: headTop, neckHub, navel, pelvisHub; shoulderL/R, elbowL/R, wristL/R; hipL/R, kneeL/R, ankleL/R. (Place as many as the photo shows; more landmarks = a tighter solve.)',
    "COORDINATES are ANATOMICAL and un-mirrored: x = the figure's RIGHT side is +x (so a front-facing subject's image-left maps to +x), y = UP. Units are arbitrary — the solver normalizes scale + position; only the GESTURE matters.",
    'The X: the shoulder bar (shoulderL↔shoulderR) and hip bar (hipL↔hipR) tilting OPPOSITE each other is contrapposto / line-of-action — trace those tilts faithfully, they carry the spine drives.',
    "VIEW: report the azimuth you traced at — `xmanji.view` as a number (0 = front, 90 = profile/side, 38 = three-quarter). The solver freezes the DOFs unobservable at that view (see ceiling).",
  ],
  input_schema: {
    'insights.xmanji.landmarks': '{ <nodeKey>: { x, y } } — your traced 2D points (anatomical coords, y up). Keys from the list above.',
    'insights.xmanji.view': 'number — azimuth (deg) you traced at. Default 0 (front).',
    'insights.proto': 'OPTIONAL { sex, height, … } — the pose is body-AGNOSTIC (locked armature; only flesh changes). Apply any body.',
    '(advanced) insights.dials': 'OPTIONAL escape hatch — supply joint dials directly instead of an X-manji, if you already have them. Prefer the X-manji.',
  },
  fidelity_contract: {
    gesture:
      'DEFAULT. Trace the bars + limb lines roughly — the attitude (reach, contrapposto, slump). The solver + the L2 prior fill in the smallest pose that fits.',
    faithful:
      'Place every landmark carefully and trace a SECOND view (front + side) so the solver can unfreeze the depth DOFs. Then render the cage, Read it, and re-trace where it disagrees.',
  },
  ceiling: [
    'SINGLE-VIEW DEPTH is under-determined: at a frontal trace the forward/back bend (spine.sagittal), head nod, and any limb folding TOWARD the camera (a forearm/knee bending forward) live in the invisible axis — the solver FREEZES them at neutral rather than inventing them. A second (side) view unlocks them.',
    'Limb ROLL (axial twist) is not solved from one view; it defaults.',
    'NO hands/fingers/feet/ankle/scapula articulation — captures LIMB gesture, never hand expression.',
  ],
  multipass_hint:
    'A FRONT X-manji nails the in-plane gesture; a SIDE X-manji disambiguates the depth/fold it could not see. Trace a second view and call capture_reference again with the same stash_ref to ground the pose. capture_reference returns the solve error + which DOFs it froze — if the froze list holds the articulation you care about, that is your cue to add the side view.',
  capture_call:
    "capture_reference({ target:'pose', fidelity, insights:{ xmanji:{ landmarks:{ shoulderR:{x,y}, ... }, view }, proto?, gesture?, caveats? }, stash_ref? })",
};

const PROTOCOLS = { scene: SCENE_PROTOCOL, pose: POSE_PROTOCOL };

export function getReferenceProtocol(target) {
  const proto = PROTOCOLS[target];
  if (!proto) {
    throw new Error(`target must be one of ${REFERENCE_TARGETS.join(' | ')} (got '${target}')`);
  }
  return proto;
}

// ---------------------------------------------------------------------------
// Lowering — insights → a cage manifest. Pure functions, no DB.
// ---------------------------------------------------------------------------

function isPair(v) {
  return Array.isArray(v) && v.length === 2 && Number.isFinite(v[0]) && Number.isFinite(v[1]);
}
function num(v, d) {
  return Number.isFinite(v) ? v : d;
}

/**
 * SCENE cage → a plain sketch (default renderer) that draws the perspective
 * frame: horizon, the near floor edge, the two receding edges converging on the
 * vanishing points, and VP markers. Every input (VPs, horizon, floor corners)
 * is already in screen pixels, so the cage is a faithful diagram of the
 * extracted camera. The viewBox is sized to CONTAIN the (usually off-frame)
 * vanishing points so the convergence is visible. Returns a manifest with NO
 * `kind` so /api/sketches/<ref>/svg routes it to the default renderer.
 */
export function lowerSceneCage(insights = {}, title = 'Scene reference') {
  const cam = insights.camera || {};
  const rb = insights.roomBasis || {};
  const vp = cam.vanishingPoints || {};
  const vpL = isPair(vp.left) ? vp.left : null;
  const vpR = isPair(vp.right) ? vp.right : null;
  const horizonY = num(cam.horizonY, vpL ? vpL[1] : vpR ? vpR[1] : 245);

  const frontLeft = isPair(rb.frontLeft) ? rb.frontLeft : [210, 510];
  let frontRight;
  if (isPair(rb.frontRight)) {
    frontRight = rb.frontRight;
  } else if (vpL && vpR) {
    // mirror frontLeft about the station point (midway between the two VPs)
    const midX = (vpL[0] + vpR[0]) / 2;
    frontRight = [2 * midX - frontLeft[0], frontLeft[1]];
  } else {
    frontRight = [frontLeft[0] + 600, frontLeft[1]];
  }

  // viewBox bbox over every reference point (+ y=0 so the horizon band reads).
  const pts = [frontLeft, frontRight, [0, horizonY]];
  if (vpL) pts.push(vpL);
  if (vpR) pts.push(vpR);
  const pad = 48;
  const minX = Math.min(...pts.map((p) => p[0])) - pad;
  const maxX = Math.max(...pts.map((p) => p[0])) + pad;
  const minY = Math.min(0, ...pts.map((p) => p[1])) - pad;
  const maxY = Math.max(frontLeft[1], frontRight[1], ...pts.map((p) => p[1])) + pad;
  const ox = -minX;
  const oy = -minY;
  const T = (p) => [p[0] + ox, p[1] + oy];
  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));

  const marks = [];
  // horizon (eye-level)
  const hL = T([minX, horizonY]);
  const hR = T([maxX, horizonY]);
  marks.push({ kind: 'line', x1: hL[0], y1: hL[1], x2: hR[0], y2: hR[1], stroke: '#9aa5b1', strokeWidth: 1.5 });
  marks.push({ kind: 'text', x: hL[0] + 8, y: hL[1] - 8, value: 'horizon', size: 12, anchor: 'start' });
  // near floor edge
  const fL = T(frontLeft);
  const fR = T(frontRight);
  marks.push({ kind: 'line', x1: fL[0], y1: fL[1], x2: fR[0], y2: fR[1], stroke: '#2c3e50', strokeWidth: 2 });
  // receding edges + VP markers
  if (vpL) {
    const v = T(vpL);
    marks.push({ kind: 'line', x1: fL[0], y1: fL[1], x2: v[0], y2: v[1], stroke: '#e67e22', strokeWidth: 1.5 });
    marks.push({ kind: 'circle', cx: v[0], cy: v[1], r: 6, fill: '#e74c3c' });
    marks.push({ kind: 'text', x: v[0] + 10, y: v[1], value: 'VP-L', size: 14, anchor: 'start' });
  }
  if (vpR) {
    const v = T(vpR);
    marks.push({ kind: 'line', x1: fR[0], y1: fR[1], x2: v[0], y2: v[1], stroke: '#e67e22', strokeWidth: 1.5 });
    marks.push({ kind: 'circle', cx: v[0], cy: v[1], r: 6, fill: '#e74c3c' });
    marks.push({ kind: 'text', x: v[0] - 10, y: v[1], value: 'VP-R', size: 14, anchor: 'end' });
  }

  const manifest = { title, viewBox: { width, height }, marks };
  const errors = validateSketchManifest(manifest);
  if (errors.length) {
    throw new Error(`scene cage manifest invalid:\n - ${errors.join('\n - ')}`);
  }
  return manifest;
}

/**
 * POSE cage → a figure manifest (kind: 'figure'). The extracted dials ARE the
 * pose object; view/proto ride alongside. Reuses the proven figure render path,
 * so the joint LIMITS + spine caps clamp any over-driven dial. The caller
 * validates by rendering (a bad dial fails at mint, not at view time).
 */
export function lowerPoseCage(insights = {}, title = 'Pose reference') {
  const { dials } = resolvePoseDials(insights);
  const manifest = { kind: 'figure', title, pose: dials };
  const renderView = insights.view ?? insights.xmanji?.view;
  if (renderView !== undefined && renderView !== null) manifest.view = renderView;
  if (insights.proto && typeof insights.proto === 'object' && !Array.isArray(insights.proto)) {
    manifest.proto = insights.proto;
  }
  return manifest;
}

/**
 * A short human-readable caption for the cage stash item's body_md.
 */
export function summarizeReference(target, insights = {}, fidelity, passes) {
  const lines = [`**Visual reference** — target \`${target}\`, fidelity \`${fidelity}\`, pass ${passes}.`];
  if (target === 'pose') {
    if (insights.gesture) lines.push(`Gesture: ${insights.gesture}`);
    if (insights.confidence) {
      const c = insights.confidence;
      lines.push(`Confidence: in-plane ${c.inPlane ?? '?'} · depth ${c.depth ?? '?'} · roll ${c.roll ?? '?'}`);
    }
  } else if (target === 'scene') {
    if (insights.scale?.relative) lines.push(`Scale: ${insights.scale.relative}${insights.scale.grounded ? ' (grounded)' : ' (relative)'}`);
    if (insights.thematic?.mood) lines.push(`Mood: ${insights.thematic.mood}`);
  }
  const caveats = Array.isArray(insights.caveats) ? insights.caveats : [];
  if (caveats.length) lines.push(`Caveats: ${caveats.join('; ')}`);
  return lines.join('\n\n');
}
