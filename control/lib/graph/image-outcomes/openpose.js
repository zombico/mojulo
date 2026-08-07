/**
 * openpose — render the figure rig's armature as an OpenPose (COCO-18)
 * skeleton image, the conditioning input the SDXL OpenPose ControlNet was
 * trained on (animation-cheats.plan.md, declared-coordinate contracts).
 *
 * The skeleton is a PROJECTION OF DECLARED GEOMETRY: keypoints come from
 * `renderFigureWithArmature` (figure-render.js), which projects the balanced
 * armature through the exact camera + fit transform as the rendered mesh —
 * so the pose the ControlNet enforces IS the pose the manifest states, and
 * downstream part cuts / anchor audits measure against the same coordinates.
 *
 * Pure module: no Date, no Math.random, no I/O. SVG out; callers rasterize
 * (sharp, same path as sketch-png).
 */
import { renderFigureWithArmature } from '../polygonizer/figure-render.js';

// COCO-18 keypoint order. Eyes/ears (14–17) are emitted as null in v1 —
// OpenPose renders with absent keypoints are normal; face landmarks enter at
// P1 as declared landmarks, not skeleton points.
export const OPENPOSE_KEYPOINTS = [
  'nose', 'neck',
  'shoulderR', 'elbowR', 'wristR',
  'shoulderL', 'elbowL', 'wristL',
  'hipR', 'kneeR', 'ankleR',
  'hipL', 'kneeL', 'ankleL',
  'eyeR', 'eyeL', 'earR', 'earL',
];

// The canonical OpenPose limb palette (keypoint i and limb i share colors[i]).
const COLORS = [
  [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0],
  [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170], [0, 255, 255],
  [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255],
  [255, 0, 255], [255, 0, 170], [255, 0, 85],
];

// Limb pairs (0-indexed into OPENPOSE_KEYPOINTS), canonical draw order.
const LIMBS = [
  [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7],
  [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13],
  [1, 0], [0, 14], [14, 16], [0, 15], [15, 17],
];

const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rgb = ([r, g, b]) => `rgb(${r},${g},${b})`;

/**
 * Armature screen nodes (renderFigureWithArmature's `nodes`) → the 18-slot
 * COCO keypoint array ([x, y] | null per slot). The nose is approximated on
 * the head axis (45% headBase→headTop) — good enough for skeleton
 * conditioning; real face landmarks are P1's declared-landmark layer.
 */
export function openPoseKeypoints(nodes) {
  const n = (k) => nodes[k] || null;
  const nose = n('headBase') && n('headTop') ? lerp2(n('headBase'), n('headTop'), 0.45) : null;
  return [
    nose, n('neckHub'),
    n('shoulderR'), n('elbowR'), n('wristR'),
    n('shoulderL'), n('elbowL'), n('wristL'),
    n('hipR'), n('kneeR'), n('ankleR'),
    n('hipL'), n('kneeL'), n('ankleL'),
    null, null, null, null,
  ];
}

/**
 * Uniform letterbox fit of a source viewBox into a target canvas — exported
 * so callers place the FIGURE render with the same transform and skeleton /
 * figure / declared anchors stay pixel-aligned on the output canvas.
 */
export function canvasFit(viewBox, canvas) {
  const s = Math.min(canvas.width / viewBox.width, canvas.height / viewBox.height);
  return { s, ox: (canvas.width - viewBox.width * s) / 2, oy: (canvas.height - viewBox.height * s) / 2 };
}

/**
 * Draw a COCO-18 keypoint array as an OpenPose conditioning SVG: colored
 * limbs + joint dots on black. Stroke/dot sizes follow the reference
 * renderer's stickwidth=4-at-512 convention, scaled to the canvas.
 * `fit` (from canvasFit) maps keypoint space → canvas; identity when omitted.
 */
export function buildOpenPoseSvg(keypoints, { width, height, fit = null } = {}) {
  const F = fit || { s: 1, ox: 0, oy: 0 };
  const P = (p) => [p[0] * F.s + F.ox, p[1] * F.s + F.oy];
  const stick = Math.max(2, Math.round(4 * (Math.min(width, height) / 512)));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" fill="#000"/>`,
  ];
  LIMBS.forEach(([a, b], i) => {
    const pa = keypoints[a], pb = keypoints[b];
    if (!pa || !pb) return;
    const [x1, y1] = P(pa), [x2, y2] = P(pb);
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${rgb(COLORS[i])}" stroke-width="${stick * 2}" stroke-linecap="round"/>`);
  });
  keypoints.forEach((p, i) => {
    if (!p) return;
    const [x, y] = P(p);
    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${stick}" fill="${rgb(COLORS[i])}"/>`);
  });
  parts.push('</svg>');
  return parts.join('\n');
}

/**
 * One-call door: a figure manifest (create_figure shape: pose/proto/garment/
 * view/setup/background) → { skeletonSvg, figureSvg, keypoints, nodes, fit }
 * on a target canvas. figureSvg is the manifest's own render wrapped in the
 * SAME letterbox transform, so skeleton and figure rasterize pixel-aligned —
 * conditioning image and harvest source share one coordinate space, and the
 * returned keypoints/nodes ARE the declared coordinates on that canvas.
 */
export function figureOpenPose(manifest = {}, { width = 832, height = 1216 } = {}) {
  const { svg, nodes, viewBox } = renderFigureWithArmature(manifest);
  const fit = canvasFit(viewBox, { width, height });
  const canvasNodes = {};
  for (const [k, [x, y]] of Object.entries(nodes)) canvasNodes[k] = [x * fit.s + fit.ox, y * fit.s + fit.oy];
  const keypoints = openPoseKeypoints(canvasNodes);
  const skeletonSvg = buildOpenPoseSvg(keypoints, { width, height });
  const figureSvg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<svg x="${fit.ox.toFixed(1)}" y="${fit.oy.toFixed(1)}" width="${(viewBox.width * fit.s).toFixed(1)}" height="${(viewBox.height * fit.s).toFixed(1)}" viewBox="0 0 ${viewBox.width} ${viewBox.height}">`,
    svg,
    '</svg>',
    '</svg>',
  ].join('\n');
  return { skeletonSvg, figureSvg, keypoints, nodes: canvasNodes, fit };
}
