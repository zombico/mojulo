/**
 * THE HERO'S MOTION, BY VIBE — once the hero is settled, its animation is assigned from the feel the creator wants,
 * then iterated from that baseline. Three layers, each declarative and optional:
 *
 *   motion: {
 *     vibe?:  ['cocky', 'light'],                 // words people say about how someone moves (VIBES)
 *     axes?:  { energy, weight, poise, confidence },   // the same, as amounts −1 … 1 (0 = neutral); an axis stated here wins
 *     from?:  { ref, rev },                       // the base revision this motion branched from (hero-base.js)
 *     clips?: { <name>: { seconds, keys } },      // custom clips, in the hero door's pose words, from the baseline
 *   }
 *
 * A vibe word is a small vector over the axes; the words sum and clamp. An AXIS is a fixed, documented linear map onto
 * the gaits' dials (AXIS_SPANS: what one unit of the axis adds to a dial), clamped to the dial's range: a table, not
 * code paths. The result is a door `motion` (walk, jog, sprint: only the dials that moved) and a stand word, written
 * into `hero.motion` and `hero.gesture`; every number is the gait's own dial, so the door validates it. A hero with no
 * vibe and no axes resolves to NO motion: its clips and exports are today's, byte for byte.
 *
 * Pure and deterministic: the same words, the same dials. The table is the first reading of the feel; the eyes gate
 * (the creator's look at the walk and the stand) is what calibrates it, and an axis whose ends the creator cannot tell
 * apart is cut. `snap` (smooth ↔ snappy: the clips' key timing) is not built; it needs the clip sampling.
 */
import { WALK_MINT, SPRINT_MINT } from '../polygonizer/figure-posing.js';
import { validateHeroMotion } from '../polygonizer/hero-motion.js';
import { GAITS as MOTION_GAITS } from '../polygonizer/hero-gaits.js';   // (the gaits alone: the motion library loads after)

/** The scales people say about a walk, each −1 … +1. */
export const AXES = Object.freeze({
  energy: 'sluggish ↔ spirited: the pace, the stride, the knee lift, the arm swing',
  weight: 'light ↔ heavy: how much the knees give, how high the foot lifts, how far the body lists',
  poise: 'loose ↔ composed: the hip sway, the trunk twist, the steadiness of the head',
  confidence: 'timid ↔ bold: the carriage upright or hunched, the head, the stride, the arm carry',
});

/** Words for how someone moves, each a vector over the axes. A creator's own word that is not here goes to the brief. */
export const VIBES = Object.freeze({
  spirited:  { energy: 0.8 },
  peppy:     { energy: 0.7, weight: -0.3 },
  bouncy:    { energy: 0.7, weight: -0.6, poise: -0.3 },
  nimble:    { energy: 0.5, weight: -0.7, poise: 0.2 },
  sluggish:  { energy: -0.8 },
  weary:     { energy: -0.7, weight: 0.4, confidence: -0.3 },
  tired:     { energy: -0.7, weight: 0.3, confidence: -0.3 },
  heavy:     { weight: 0.9, energy: -0.3 },
  light:     { weight: -0.8 },
  floaty:    { weight: -0.9, poise: 0.4 },
  graceful:  { poise: 0.8, weight: -0.4, energy: 0.1 },
  composed:  { poise: 0.8 },
  stoic:     { poise: 0.7, energy: -0.3 },
  loose:     { poise: -0.7 },
  clumsy:    { poise: -0.8, weight: 0.2 },
  relaxed:   { poise: -0.5, energy: -0.3, confidence: 0.2 },
  timid:     { confidence: -0.8, energy: -0.2 },
  shy:       { confidence: -0.7, energy: -0.2, weight: -0.2 },
  bold:      { confidence: 0.8 },
  cocky:     { confidence: 0.8, poise: -0.3, energy: 0.3 },
  swagger:   { confidence: 0.8, poise: -0.5, energy: 0.1 },
  noble:     { poise: 0.7, confidence: 0.6 },
  menacing:  { weight: 0.6, confidence: 0.6, energy: -0.2 },
});

/** The dials' ranges, so no axis pushes one past what the gait can hold: [min, max] (seconds are per gait, below). */
const RANGE = Object.freeze({
  strideLength: [0.15, 0.9], swingLift: [10, 80], armSwing: [0, 70], stanceKnee: [0, 30], weightShift: [0, 0.8],
  hipSway: [0, 0.2], spineTwist: [0, 0.3], pelvisRot: [0, 12], shoulderRot: [0, 12], headLevel: [0, 14],
  wristGive: [0, 15], lean: [0, 0.5], headTilt: [-10, 25], hipDrive: [0.8, 2], swingTuck: [60, 140],
  flightLift: [0, 0.12], dutyFactor: [0.28, 0.5], spineGive: [0, 0.08], tilt: [0, 35],
});
const SECONDS = Object.freeze({ walk: [0.7, 1.8], jog: [0.45, 1.1], sprint: [0.4, 0.9] });

/**
 * What one unit of an axis adds to a dial, per gait (`seconds` is the cycle, `tilt` the forward lean in degrees). At an
 * axis of −1 the same amount is taken away. Only gaits the vibe reaches are listed here; the stops and jumps are
 * studied poses and take no dials.
 */
export const AXIS_SPANS = Object.freeze({
  energy: {
    walk:   { strideLength: 0.10, swingLift: 14, armSwing: 10, seconds: -0.3 },
    jog:    { strideLength: 0.08, armSwing: 8, hipDrive: 0.25, seconds: -0.12, tilt: 4 },
    sprint: { strideLength: 0.08, armSwing: 8, hipDrive: 0.3, seconds: -0.08, tilt: 4 },
  },
  weight: {
    walk:   { stanceKnee: 8, swingLift: -12, weightShift: 0.25, armSwing: -4, pelvisRot: 2, seconds: 0.2 },
    jog:    { stanceKnee: 5, swingTuck: -12, flightLift: -0.03, dutyFactor: 0.04, seconds: 0.06 },
    sprint: { stanceKnee: 5, swingTuck: -12, flightLift: -0.03, dutyFactor: 0.04, seconds: 0.05 },
  },
  poise: {
    walk:   { hipSway: -0.04, spineTwist: -0.06, pelvisRot: -2, shoulderRot: -2, headLevel: 3, wristGive: -3 },
    jog:    { spineGive: -0.03 },
    sprint: { spineGive: -0.03 },
  },
  confidence: {
    walk:   { lean: -0.06, headTilt: -5, strideLength: 0.06, armSwing: 5, shoulderRot: 2 },
    jog:    { lean: -0.04, strideLength: 0.04, armSwing: 4 },
    sprint: { lean: -0.04, strideLength: 0.04, armSwing: 4 },
  },
});

/** Each gait's dials as a hero is minted with it now (the mint tables, figure-posing.js): the walk's, and the run's with
 * the gait's own base over them. The resolved motion is stamped with the rest of the table when it is written. */
export const GAIT_BASE = Object.freeze({
  walk: { ...WALK_MINT, seconds: MOTION_GAITS.walk.seconds, tilt: MOTION_GAITS.walk.tilt },
  jog: { ...SPRINT_MINT, ...MOTION_GAITS.jog.base, seconds: MOTION_GAITS.jog.seconds, tilt: MOTION_GAITS.jog.tilt },
  sprint: { ...SPRINT_MINT, ...MOTION_GAITS.sprint.base, seconds: MOTION_GAITS.sprint.seconds, tilt: MOTION_GAITS.sprint.tilt },
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const err = (m) => new Error(`characters: hero.motion${m}`);

/** Read the motion page's shape and say what is wrong. Carries the words; resolveMotion turns them into dials. */
export function readMotion(M) {
  if (!isObj(M)) throw err(' is { vibe?, axes?, from?, clips? }');
  for (const k of Object.keys(M)) if (!['vibe', 'axes', 'from', 'clips'].includes(k)) throw err(`.${k} is not part of the motion page (vibe, axes, from, clips)`);
  const out = {};
  if (M.vibe !== undefined) {
    const words = [M.vibe].flat();
    if (!words.length || !words.every((w) => typeof w === 'string' && w.trim())) throw err(`.vibe is a word or a list of words (${Object.keys(VIBES).join(', ')})`);
    out.vibe = words.map((w) => w.trim().toLowerCase());
  }
  if (M.axes !== undefined) {
    if (!isObj(M.axes)) throw err(`.axes is { ${Object.keys(AXES).join(', ')} }, each −1 … 1`);
    out.axes = {};
    for (const [k, v] of Object.entries(M.axes)) {
      if (!AXES[k]) throw err(`.axes.${k} is not an axis (${Object.keys(AXES).join(', ')})`);
      if (!(Number.isFinite(v) && v >= -1 && v <= 1)) throw err(`.axes.${k} is a number from −1 to 1 (0 = neutral)`);
      out.axes[k] = v;
    }
  }
  if (M.from !== undefined) {
    if (!isObj(M.from) || typeof M.from.ref !== 'string' || !Number.isInteger(M.from.rev) || M.from.rev < 1) throw err('.from is the base revision it branched from { ref, rev }');
    out.from = { ref: M.from.ref, rev: M.from.rev };
  }
  if (M.clips !== undefined) {
    if (!isObj(M.clips)) throw err('.clips is { <name>: { seconds, keys } }, in the hero door\'s pose words');
    for (const [name, c] of Object.entries(M.clips)) if (!isObj(c) || !Array.isArray(c.keys) || !c.keys.length) throw err(`.clips.${name} is { seconds, keys: [pose, …] }`);
    out.clips = M.clips;
  }
  return out;
}

/**
 * The tool call that realizes a resolved motion page against the hero's sketch: `update_sketch` patches that set the
 * gaits (`/hero/motion`), the stand (`/hero/gesture`) and the custom clips (`/hero/clips`, the page's whole set: a
 * patch creates only its last segment, and a freshly minted base has no clips to set one into). A patch lands as a
 * revision of the sketch, so a custom edit is kept beside the base it branched from. Null when there is nothing to set.
 */
export function motionOrders(R, ref = '<ref of the mint>') {
  const patch = [
    // the patch sets the whole motion page, so it carries the walk the hero was minted with when the vibe left it alone
    ...(R.motion ? [{ op: 'set', path: '/hero/motion', value: 'walk' in R.motion ? R.motion : { walk: true, ...R.motion } }] : []),
    ...(R.gesture ? [{ op: 'set', path: '/hero/gesture', value: R.gesture }] : []),
    ...(R.clips ? [{ op: 'set', path: '/hero/clips', value: R.clips }] : []),
  ];
  return patch.length ? { tool: 'update_sketch', part: 'hero:motion', args: { ref, patch }, ...(R.from ? { branchedFrom: R.from } : {}) } : null;
}

/** The stand the axes pick: a word of the hero door's gesture presets. A prior, shown with its reason, never forced. */
function standFor(a) {
  if (a.energy <= -0.6) return { gesture: 'rest', why: `energy ${a.energy} (sluggish) → the rest stand` };
  if (a.energy >= 0.4 && a.confidence >= 0.2) return { gesture: 'guard', why: `energy ${a.energy} and confidence ${a.confidence} → the guard stand` };
  return { gesture: 'relaxed', why: 'neither extreme → the relaxed stand' };
}

/**
 * The motion page resolved: `{ vibe, unread, axes, reasons, motion, gesture, errors, clips?, from? }`. `motion` is the
 * door's (a gait with only the dials that moved), null when nothing moved; `gesture` the stand word, only when the
 * creator has said how it feels; `unread` the words the lexicon does not know (they go to the brief, never an error);
 * `errors` what the hero door would refuse of `motion` (none, by construction). `reasons` says what each word decided.
 */
export function resolveMotion(M) {
  const m = readMotion(M ?? {}), reasons = [], unread = [], read = [];
  const sum = { energy: 0, weight: 0, poise: 0, confidence: 0 };
  for (const w of m.vibe ?? []) {
    if (!VIBES[w]) { unread.push(w); continue; }
    read.push(w);
    for (const [k, v] of Object.entries(VIBES[w])) { sum[k] += v; reasons.push(`${w} → ${k} ${v > 0 ? '+' : ''}${v}`); }
  }
  const axes = {};
  for (const k of Object.keys(AXES)) {
    axes[k] = r4(clamp(sum[k], [-1, 1]));
    if (m.axes && k in m.axes) { if (axes[k] !== 0) reasons.push(`${k}: stated ${m.axes[k]}, over the vibe's ${axes[k]}`); axes[k] = m.axes[k]; }
  }
  const felt = Object.values(axes).some((v) => v !== 0);
  const motion = {};
  if (felt) for (const g of ['walk', 'jog', 'sprint']) {
    const own = {};
    for (const dial of new Set(Object.keys(AXES).flatMap((k) => Object.keys(AXIS_SPANS[k][g])))) {
      const delta = Object.keys(AXES).reduce((s, k) => s + axes[k] * (AXIS_SPANS[k][g][dial] ?? 0), 0);
      if (!delta) continue;
      const v = r4(clamp(GAIT_BASE[g][dial] + delta, dial === 'seconds' ? SECONDS[g] : RANGE[dial]));
      if (v !== r4(GAIT_BASE[g][dial])) own[dial] = v;
    }
    if (Object.keys(own).length) motion[g] = own;
  }
  const stand = felt ? standFor(axes) : null;
  if (stand) reasons.push(stand.why);
  const resolved = Object.keys(motion).length ? motion : null;
  return {
    vibe: read, unread, axes, reasons, motion: resolved, gesture: stand?.gesture ?? null,
    errors: resolved ? validateHeroMotion(resolved) : [],
    ...(m.clips ? { clips: m.clips } : {}), ...(m.from ? { from: m.from } : {}),
  };
}
