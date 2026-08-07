/**
 * Parts-bank spike — BANK V2, front view (animation-cheats.plan.md
 * Addendum 2). The working view is frontal: OpenPose compliance is strong
 * (no joint calibration needed), the A-pose is in-prior, and the torso is
 * ALWAYS ARMLESS — manufactured by declared-mask inpaint, never asked for.
 * Outfit is explicitly part of the split: sleeve+hand = arm part, coat
 * body + skirt = torso, boots ride the lower legs.
 *
 * Two source renders per bank: the A-pose full figure (limb harvest
 * source) and its armless inpaint (the torso base). Both front view, both
 * pale-blue contract.
 */
import { sampleMotionPose } from '../../polygonizer/figure-render.js';
import { figureOpenPose, buildOpenPoseSvg } from '../openpose.js';

export const CANVAS = { width: 832, height: 1216 };
export const VIEW = 'frontal';

// The A-pose: the production-standard front reference pose — arms out
// ~35° (clear of the coat for capsule harvest), legs slightly apart.
export const APOSE = {
  // 35°, pinned by evidence: 35° is in-prior AND pose-compliant (seed
  // 800001). A 55° retry was IGNORED (arms painted hanging, coat went
  // floor-length — the wider pose is out-of-prior for this outfit and the
  // CN loses).
  // DOF signs are ABSOLUTE, not per-side mirrored (the walk pose uses
  // ±22): same-sign yaw abducted ONE arm and folded the other behind the
  // torso — the silent asymmetry behind every registration drift up to
  // the meru-guide addendum. shL +35 / shR −35 is the symmetric A-pose.
  shL: { yaw: 35 }, shR: { yaw: -35 },
  elbowL: 6, elbowR: 6,
  hipL: { yaw: 8 }, hipR: { yaw: -8 },
};

// Demo target: a wave — planar limb rotation in the frontal plane (front
// view's honest motion register; walking is foreshortened and out of v1
// scope for this view).
export const targetPose = (phase = 0.5) => sampleMotionPose('wave', phase);

export function bankScaffold() {
  return figureOpenPose({ pose: APOSE, view: VIEW, background: false }, CANVAS);
}

export function targetScaffold(phase = 0.5) {
  return figureOpenPose({ pose: targetPose(phase), view: VIEW, background: false }, CANVAS);
}

/** The armless conditioning skeleton: arm keypoint slots nulled so the
 * ControlNet never asks for arms (used by the inpaint passes). */
export function armlessSkeletonSvg(scaffold) {
  const kps = scaffold.keypoints.map((p, i) => (i >= 2 && i <= 7 ? null : p));
  return buildOpenPoseSvg(kps, CANVAS);
}

// segment distance + extend, local copies (harvest.js keeps its own)
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
};
const extend = ([ax, ay], [bx, by], k) => [bx + (bx - ax) * k, by + (by - ay) * k];

/**
 * Front-view part definitions over DECLARED nodes (front compliance makes
 * calibration unnecessary). Arms harvested from the A-POSE render (both
 * sides, two segments each); lower legs harvested from the ARMLESS render.
 */
export function frontArmDefs(nodes, { armR = 44 } = {}) {
  const defs = [];
  for (const s of ['L', 'R']) {
    const tip = extend(nodes['elbow' + s], nodes['wrist' + s], 0.45);
    defs.push({
      id: 'upperArm' + s,
      chain: ['shoulder' + s, 'elbow' + s],
      claims: (x, y) => segDist(x, y, ...nodes['shoulder' + s], ...nodes['elbow' + s]) < armR,
    });
    defs.push({
      id: 'forearm' + s,
      chain: ['elbow' + s, 'wrist' + s],
      claims: (x, y) => segDist(x, y, ...nodes['elbow' + s], ...tip) < armR,
    });
  }
  return defs;
}

export function frontLegDefs(nodes, { legR = 54, footR = 108 } = {}) {
  return ['L', 'R'].map((s) => {
    const knee = nodes['knee' + s], ankle = nodes['ankle' + s];
    // start BELOW the hem (the knee hides under the skirt — cutting there
    // bites holes in the hem; legs composite behind the torso so the hem
    // covers the seam), and reach past the boot sole
    const top = [knee[0] + (ankle[0] - knee[0]) * 0.2, knee[1] + (ankle[1] - knee[1]) * 0.2];
    const footTip = extend(knee, ankle, 0.72);
    return {
      id: 'lowerLeg' + s,
      chain: ['knee' + s, 'ankle' + s],
      claims: (x, y) =>
        segDist(x, y, ...top, ...footTip) < legR ||
        Math.hypot(x - footTip[0], y - footTip[1]) < footR,
    };
  });
}

// JOINT CALIBRATION (front edition). Registration normalizes SCALE, but the
// bbox-center alignment is thrown by paint asymmetry (the extended sleeve
// widens one side) and painted shoulders sit narrower than the mannequin's —
// declared joints still miss by ~50–70px at part granularity. Measured off
// the REGISTERED keyed A-pose render (seed 800001 + armless inpaints),
// screen-left = figure's R (front view mirror). Re-measure if the bank
// renders change; the parts-sheet cell re-harvest retires this stage.
export const MEASURED_FRONT_NODES = {
  neckHub: [330, 280], pelvisHub: [348, 555],
  shoulderR: [272, 320], elbowR: [282, 445], wristR: [322, 585],
  shoulderL: [432, 330], elbowL: [530, 440], wristL: [632, 515],
  kneeR: [255, 938], ankleR: [250, 1038],
  kneeL: [420, 935], ankleL: [425, 1035],
};

/**
 * The MERU GUIDE (operator direction, 2026-07-12): the vajra mannequin at
 * declared scale/position + crown/ground register lines, on the exact
 * canvas — the worker's BASE image. The character is painted OVER the
 * mannequin, covering it ("skin the mannequin"), so scale, height, and
 * joint positions are inherited by construction: no registration, no
 * joint calibration. Returns { svg, crownY, groundY }.
 */
export async function meruGuideSvg() {
  const bank = bankScaffold();
  return {
    figureSvg: bank.figureSvg,
    nodes: bank.nodes,
    lines: (crownY, groundY) => [
      `<svg xmlns='http://www.w3.org/2000/svg' width='${CANVAS.width}' height='${CANVAS.height}'>`,
      `<rect width='${CANVAS.width}' height='${CANVAS.height}' fill='#add0eb'/>`,
      `<line x1='0' y1='${crownY}' x2='${CANVAS.width}' y2='${crownY}' stroke='#7da8cc' stroke-width='3'/>`,
      `<line x1='0' y1='${groundY}' x2='${CANVAS.width}' y2='${groundY}' stroke='#7da8cc' stroke-width='3'/>`,
      '</svg>',
    ].join(''),
  };
}

export const SHEET = { width: 1216, height: 832, bg: { r: 173, g: 208, b: 235 } };

export const FRONT_PROMPTS = {
  bank: [
    'full body character reference, young woman, dark brown chin-length bob haircut,',
    '(knee-length tan trench coat:1.2), coat hem at the knee, white top, dark navy knee skirt,',
    '(bare lower legs and brown ankle boots clearly visible:1.2), dark brown crossbody bag,',
    'standing facing the viewer, front view, A-pose with both arms held slightly out from her sides,',
    'legs slightly apart, whole figure in frame, flat cel animation style, clean dark outlines, flat colors,',
    'soft daylight, the character alone on a plain uniform pale sky-blue background,',
    'no scenery, no ground, (no shadow:1.4), floating on the plain pale blue background',
  ].join(' '),
  // per-arm background inpaint (armless manufacture): run once per side
  // with that side's declared arm-capsule mask, denoise ~0.95, CN 0
  armInpaint: 'plain flat uniform pale sky-blue background, empty space, flat color field, nothing',
  armInpaintNegative: 'arm, hand, sleeve, fingers, limb, object, character, clothing, shadow, gradient, texture, detail',
  compile: [
    'full body character, young woman, dark brown chin-length bob haircut,',
    'knee-length tan trench coat, white top, dark navy knee skirt, brown ankle boots,',
    'dark brown crossbody bag, standing facing the viewer, front view, one arm raised waving,',
    'whole figure in frame, flat cel animation style, clean dark outlines, flat colors, soft daylight,',
    'the character alone on a plain uniform pale sky-blue background,',
    'no scenery, no ground, (no shadow:1.4)',
  ].join(' '),
};
