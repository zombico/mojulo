/**
 * Parts-bank spike P0 (animation-cheats.plan.md) — the bank + target poses
 * and their declared-coordinate scaffolds. One character, lateral view:
 * the BANK pose is the walk contact (the harvest pose — see below); the
 * TARGET is the passing pose the bank NEVER rendered — the rig supplies
 * the new limb configuration, mojulo assembles, the model compiles.
 * Throwaway-grade, beside the plan.
 */
import { sampleMotionPose } from '../../polygonizer/figure-render.js';
import { figureOpenPose } from '../openpose.js';

export const CANVAS = { width: 832, height: 1216 };
export const VIEW = 'lateral';

// The HARVEST pose (P0 rounds 4–6 doctrine): parts must be CLEAR OF THE
// BODY in the harvest view, but explicit A-poses ("arms held straight out",
// trench coat, profile) sit outside the model's prior and collapse the
// render. The pose that gives separation INSIDE the prior is the walk
// contact itself — arms swing naturally clear of the coat, legs split, and
// "walking, mid-stride" is the phrasing every good render came from. So the
// bank IS walk phase 0; the never-rendered target is the passing pose.
export const BANK_POSE = sampleMotionPose('walk', 0);

// Passing pose (phase 0.35) — a genuinely different limb configuration
// (legs crossing, arms mid-swing), never rendered as a whole figure.
export const targetPose = () => sampleMotionPose('walk', 0.35);

export function bankScaffold() {
  return figureOpenPose({ pose: BANK_POSE, view: VIEW, background: false }, CANVAS);
}

// JOINT CALIBRATION (P0 finding, the sub-cel round-2 doctrine one level up):
// the local CN stack holds the bank render's IDENTITY and overall STANCE but
// not per-limb angles — round 9's paint mirrored the declared arm swing. So
// harvest cuts are placed by joints MEASURED off the accepted render (the
// agent's eyes, once per bank), while target placement stays declared. Raw
// render space (832×1216), seed 411109. Painted front leg ↔ declared L
// (forward at contact), painted back leg ↔ declared R; arms likewise by
// visibility (near/visible ↔ R).
// Seed 411111 (pale-blue round 11). Painted back leg ↔ declared R (back at
// contact), painted front leg ↔ declared L. The far ARM is almost fully
// occluded (a hand at the hip) — NOT harvested; the assembly's far arm is
// the near-arm duplicate (the cut-out puppet convention) and the painted
// remnant stays baked in the torso.
export const MEASURED_BANK_NODES = {
  neckHub: [430, 250], pelvisHub: [430, 540],
  shoulderR: [395, 290], elbowR: [370, 470], wristR: [335, 645],
  kneeR: [330, 860], ankleR: [272, 985],
  kneeL: [515, 790], ankleL: [552, 905],
};

export function targetScaffold() {
  return figureOpenPose({ pose: targetPose(), view: VIEW, background: false }, CANVAS);
}

// The generation brief for the bank render (the acetate contract + chroma
// fallback, spike-2 doctrine). The driving agent appends nothing: identity
// rides IP-Adapter (the spike-1 character key's side cell), pose rides the
// OpenPose ControlNet (the rig skeleton), and this prompt carries style +
// the acetate clauses only.
// P0 rounds 2–9 lesson: every chroma-green element (weighted green prompt,
// green id-ref, green base) fights the model's prior and eventually bleeds
// INTO the subject (rounds 6–7 painted the coat green). The local acetate
// contract is instead: plain uniform background in the model's own register
// (cream), keyed by BORDER FLOOD-FILL + largest-connected-component — the
// flat-cel outline guarantees the flood can't leak into the figure, and the
// component filter drops any painted floor shadow (round 9's floats free).
export const BANK_PROMPT = [
  'full body character, young woman, dark brown chin-length bob haircut,',
  '(knee-length tan trench coat:1.2), coat hem at the knee, white top, dark navy knee skirt,',
  '(bare lower legs and brown ankle boots clearly visible:1.2),',
  'dark brown crossbody bag strap with small satchel,',
  'walking, mid-stride, arms swinging, side profile view, whole figure in frame,',
  'flat cel animation style, clean dark outlines, flat colors, soft daylight,',
  'the character alone on a plain uniform pale sky-blue background,',
  'no scenery, no ground, (no shadow:1.4), floating on the plain pale blue background',
].join(' ');

export const BANK_NEGATIVE = [
  'shadow, ground plane, background detail, scenery, gradient background,',
  'text, watermark, signature, wireframe, skeleton, stick figure, extra limbs,',
  'cropped, out of frame, three-quarter view, front view,',
  'floor-length coat, long coat covering legs,',
  'drop shadow, floor shadow, contact shadow, shadow under feet',
].join(' ');

export const COMPILE_PROMPT = [
  'full body character, young woman, dark brown chin-length bob haircut,',
  'knee-length tan trench coat, white top, dark navy knee skirt,',
  'brown ankle boots, dark brown crossbody bag strap with small satchel,',
  'walking, mid-stride, legs passing, side profile view, whole figure in frame,',
  'flat cel animation style, clean dark outlines, flat colors, soft daylight,',
  'the character alone on a plain uniform pale sky-blue background,',
  'no scenery, no ground, (no shadow:1.4)',
].join(' ');
