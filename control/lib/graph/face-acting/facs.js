/**
 * facs — the face's controls in the vocabulary of FACS (Ekman, Friesen and Hager's Facial Action Coding System): each
 * ACTION UNIT one muscle's (or a group's) visible action, the unit an actor's face, an animator's rig and a capture
 * session all read. A face's state is AU intensities, 0 … 1 (FACS scores A trace … E maximum: `INTENSITY`), each AU
 * whole (`AU12`) or a side alone (`AU12L`, `AU12R`: L the figure's left), or a lip alone where ARKit splits a unit by lip
 * (`AU28T` the upper lip's, `AU28B` the lower's: the f's and the v's lower lip under the teeth).
 *
 *   • `FACS_UNITS`: each AU's name, its muscle, whether it acts per side, its ARKit names (Apple's 52 blendshapes, the
 *     capture format iPhone Live Link Face, MetaHuman and VRM perfect sync speak: FACS per side), and the realistic
 *     head's ACTION that makes it (head-relational.js `ACTIONS`), or none: a GAP, said, never approximated by another.
 *   • `ARKIT_SHAPES`: the 52, each with the AUs it reads.
 *   • `EMOTION_PROTOTYPES`: the basic emotions as FACS's own prototypes give them (EMFACS), AUs at intensities.
 *   • `facsActions(state)`: a FACS state → the head's action activations, and the AUs it could not make.
 * Pure tables and arithmetic; no geometry.
 */
import { ACTIONS } from '../polygonizer/head-relational.js';

/** FACS intensity scores as activations: A trace, B slight, C marked, D severe, E maximum */
export const INTENSITY = Object.freeze({ A: 0.2, B: 0.4, C: 0.6, D: 0.8, E: 1 });

/**
 * The action units: `muscle`, `sided` (acts on one side alone in a face; ARKit splits it), `arkit` (the shapes that
 * capture it, per side Left then Right where sided), `action` (the realistic head's, a side by its `L`/`R` suffix where
 * `sided`, a list where the unit is two of its actions; null: a gap), `lips` (a lip alone's action, `T` the upper and `B`
 * the lower, where ARKit splits the unit by lip) and `region` (upper face, lower face, eyes, jaw: what a blend of two emotions divides).
 */
export const FACS_UNITS = Object.freeze({
  AU1: { name: 'inner brow raiser', muscle: 'frontalis, pars medialis', sided: false, arkit: ['browInnerUp'], action: 'browInner', region: 'upper' },
  AU2: { name: 'outer brow raiser', muscle: 'frontalis, pars lateralis', sided: true, arkit: ['browOuterUpLeft', 'browOuterUpRight'], action: 'browOuter', region: 'upper' },
  AU4: { name: 'brow lowerer', muscle: 'corrugator supercilii, depressor supercilii, procerus', sided: true, arkit: ['browDownLeft', 'browDownRight'], action: 'browLower', region: 'upper' },
  AU5: { name: 'upper lid raiser', muscle: 'levator palpebrae superioris', sided: true, arkit: ['eyeWideLeft', 'eyeWideRight'], action: 'wide', region: 'eyes' },
  AU6: { name: 'cheek raiser', muscle: 'orbicularis oculi, pars orbitalis', sided: true, arkit: ['cheekSquintLeft', 'cheekSquintRight'], action: 'cheekRaise', region: 'eyes' },
  AU7: { name: 'lid tightener', muscle: 'orbicularis oculi, pars palpebralis', sided: true, arkit: ['eyeSquintLeft', 'eyeSquintRight'], action: 'squint', region: 'eyes' },
  AU9: { name: 'nose wrinkler', muscle: 'levator labii superioris alaeque nasi', sided: true, arkit: ['noseSneerLeft', 'noseSneerRight'], action: 'sneer', region: 'lower' },
  AU10: { name: 'upper lip raiser', muscle: 'levator labii superioris', sided: true, arkit: ['mouthUpperUpLeft', 'mouthUpperUpRight'], action: 'upperLipUp', region: 'lower' },
  AU11: { name: 'nasolabial deepener', muscle: 'zygomaticus minor', sided: true, arkit: [], action: null, region: 'lower' },
  AU12: { name: 'lip corner puller', muscle: 'zygomaticus major', sided: true, arkit: ['mouthSmileLeft', 'mouthSmileRight'], action: 'smile', region: 'lower' },
  AU13: { name: 'sharp lip puller', muscle: 'levator anguli oris (caninus)', sided: true, arkit: [], action: null, region: 'lower' },
  AU14: { name: 'dimpler', muscle: 'buccinator', sided: true, arkit: ['mouthDimpleLeft', 'mouthDimpleRight'], action: 'dimple', region: 'lower' },
  AU15: { name: 'lip corner depressor', muscle: 'depressor anguli oris (triangularis)', sided: true, arkit: ['mouthFrownLeft', 'mouthFrownRight'], action: 'frown', region: 'lower' },
  AU16: { name: 'lower lip depressor', muscle: 'depressor labii inferioris', sided: true, arkit: ['mouthLowerDownLeft', 'mouthLowerDownRight'], action: 'lowerLipDown', region: 'lower' },
  AU17: { name: 'chin raiser', muscle: 'mentalis', sided: false, arkit: ['mouthShrugLower'], action: 'chinRaise', region: 'lower' },
  AU18: { name: 'lip pucker', muscle: 'incisivii labii superioris and inferioris', sided: false, arkit: ['mouthPucker'], action: 'pucker', region: 'lower' },
  AU20: { name: 'lip stretcher', muscle: 'risorius, platysma', sided: true, arkit: ['mouthStretchLeft', 'mouthStretchRight'], action: 'stretch', region: 'lower' },
  AU22: { name: 'lip funneler', muscle: 'orbicularis oris', sided: false, arkit: ['mouthFunnel'], action: 'funnel', region: 'lower' },
  AU23: { name: 'lip tightener', muscle: 'orbicularis oris', sided: false, arkit: [], action: 'tighten', region: 'lower' },
  AU24: { name: 'lip presser', muscle: 'orbicularis oris', sided: true, arkit: ['mouthPressLeft', 'mouthPressRight'], action: 'press', region: 'lower' },
  AU25: { name: 'lips part', muscle: 'depressor labii inferioris, relaxed mentalis or orbicularis oris', sided: false, arkit: [], action: 'lipsPart', region: 'lower' },
  AU26: { name: 'jaw drop', muscle: 'masseter, temporalis and pterygoids relaxed', sided: false, arkit: ['jawOpen'], action: 'jaw', region: 'jaw' },
  AU28: { name: 'lip suck', muscle: 'orbicularis oris', sided: false, lips: { T: 'rollUpper', B: 'rollLower' }, arkit: ['mouthRollLower', 'mouthRollUpper'], action: ['rollUpper', 'rollLower'], region: 'lower' },
  AU29: { name: 'jaw thrust', muscle: 'pterygoids', sided: false, arkit: ['jawForward'], action: null, region: 'jaw' },
  AU30: { name: 'jaw sideways', muscle: 'pterygoids', sided: true, arkit: ['jawLeft', 'jawRight'], action: null, region: 'jaw' },
  AU34: { name: 'cheek puff', muscle: 'buccinator (air)', sided: false, arkit: ['cheekPuff'], action: null, region: 'lower' },
  AU45: { name: 'blink', muscle: 'orbicularis oculi relaxing levator', sided: true, arkit: ['eyeBlinkLeft', 'eyeBlinkRight'], action: 'blink', region: 'eyes' },
});
export const FACS_UNIT_IDS = Object.freeze(Object.keys(FACS_UNITS));

/** ARKit's 52 blendshapes, each with the AU it reads (a side by L/R) and, for the gaze and the tongue, what FACS calls
 * them (the eyes' turn and the tongue are not muscles of the face's surface: FACS 61–64 and 19) */
export const ARKIT_SHAPES = Object.freeze({
  eyeBlinkLeft: 'AU45L', eyeBlinkRight: 'AU45R', eyeWideLeft: 'AU5L', eyeWideRight: 'AU5R', eyeSquintLeft: 'AU7L', eyeSquintRight: 'AU7R',
  eyeLookUpLeft: 'gaze', eyeLookUpRight: 'gaze', eyeLookDownLeft: 'gaze', eyeLookDownRight: 'gaze',
  eyeLookInLeft: 'gaze', eyeLookInRight: 'gaze', eyeLookOutLeft: 'gaze', eyeLookOutRight: 'gaze',
  jawOpen: 'AU26', jawForward: 'AU29', jawLeft: 'AU30L', jawRight: 'AU30R',
  mouthClose: 'speech', mouthFunnel: 'AU22', mouthPucker: 'AU18', mouthLeft: 'speech', mouthRight: 'speech',
  mouthSmileLeft: 'AU12L', mouthSmileRight: 'AU12R', mouthFrownLeft: 'AU15L', mouthFrownRight: 'AU15R',
  mouthDimpleLeft: 'AU14L', mouthDimpleRight: 'AU14R', mouthStretchLeft: 'AU20L', mouthStretchRight: 'AU20R',
  mouthRollLower: 'AU28', mouthRollUpper: 'AU28', mouthShrugLower: 'AU17', mouthShrugUpper: 'speech',
  mouthPressLeft: 'AU24L', mouthPressRight: 'AU24R', mouthLowerDownLeft: 'AU16L', mouthLowerDownRight: 'AU16R',
  mouthUpperUpLeft: 'AU10L', mouthUpperUpRight: 'AU10R',
  browDownLeft: 'AU4L', browDownRight: 'AU4R', browInnerUp: 'AU1', browOuterUpLeft: 'AU2L', browOuterUpRight: 'AU2R',
  cheekPuff: 'AU34', cheekSquintLeft: 'AU6L', cheekSquintRight: 'AU6R', noseSneerLeft: 'AU9L', noseSneerRight: 'AU9R',
  tongueOut: 'tongue',
});

/**
 * The basic emotions as FACS's prototypes (EMFACS, Ekman and Friesen; Matsumoto and Ekman's readings): the AUs whose
 * appearance together reads as that emotion, at intensities (`INTENSITY`). Contempt is one-sided: the figure's right.
 */
export const EMOTION_PROTOTYPES = Object.freeze({
  happiness: { AU6: 0.6, AU12: 0.8 },
  sadness: { AU1: 0.8, AU4: 0.4, AU15: 0.6, AU17: 0.4 },
  surprise: { AU1: 0.8, AU2: 0.8, AU5: 0.4, AU26: 0.6 },
  fear: { AU1: 0.8, AU2: 0.6, AU4: 0.6, AU5: 0.8, AU7: 0.4, AU20: 0.6, AU26: 0.4 },
  anger: { AU4: 0.8, AU5: 0.6, AU7: 0.6, AU23: 0.8 },
  disgust: { AU9: 0.8, AU15: 0.4, AU16: 0.4 },
  contempt: { AU12R: 0.4, AU14R: 0.4 },
});

/** a state's key → its AU and side or lip (`AU12L` → ['AU12', 'L']; `AU28B` → ['AU28', 'B']; `AU12` → ['AU12', null]); null
 * for a key not an AU (or a lip on a unit not split by lip) */
export function auOf(key) {
  const m = /^(AU\d+)([LRTB])?$/.exec(key), U = m && FACS_UNITS[m[1]];
  return U && (!m[2] || 'LR'.includes(m[2]) || U.lips) ? [m[1], m[2] ?? null] : null;
}

/**
 * A FACS state ({ AU12: 0.8, AU14R: 0.4, … }, each 0 … 1) → the realistic head's action activations ({ smile: 0.8, … },
 * a side's by its suffix) and `gaps`, the AUs the head cannot make yet (or not on one side alone), with their
 * intensities. A side and the whole sum, clamped to 1. A key that is no AU throws.
 */
export function facsActions(state = {}) {
  const actions = {}, gaps = {};
  const put = (k, v) => { actions[k] = Math.min(1, (actions[k] ?? 0) + v); };
  for (const [key, raw] of Object.entries(state)) {
    const at = auOf(key);
    if (!at) throw new Error(`facs: '${key}' is not an action unit (have ${FACS_UNIT_IDS.join(', ')}, a side by L or R, a lip by T or B where split)`);
    const [au, side] = at, U = FACS_UNITS[au], v = Math.max(0, Math.min(1, Number(raw) || 0));
    if (!v) continue;
    // (a side alone is that side's action, which the head has or not: a side it moves only whole is a gap, never both;
    // a lip alone its lip's)
    const lip = side === 'T' || side === 'B';
    const act = lip ? U.lips[side] : U.action && (side ? (U.sided ? `${U.action}${side}` : null) : U.action), acts = Array.isArray(act) ? act : [act];
    if (!act || acts.some((x) => !Object.hasOwn(ACTIONS, x))) { gaps[key] = v; continue; }
    for (const x of acts) put(x, v);
  }
  return { actions, gaps };
}
