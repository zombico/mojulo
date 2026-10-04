/** hero-form.js — the HERO FORM: a human ring plan on the vajra rest skeleton, and its TUNE.
 *
 * `heroPlan({ cast, register, girth, headScale, scale, palette, head, body, tune })` returns a `layered-plan-v1` plan
 * whose JOINTS are the figure's vajra rest landmarks (figure-vajra.js STAND, scaled by a figure-cast preset or dial map,
 * then into metres), so the rig's core is the figure's own rest pose and every pose word, gait and emote resolves the
 * same way it does on the SVG figure. The MESH is not the vajra field: it is rings along those joints — a torso trunk, a
 * neck, a head trunk (chin → crown), a THIGH LOFT from the hip crest to the knee (the two thighs carry the pelvis between
 * them, so there is no pelvis part: the streamlined read), and one straight loft per remaining limb bone (upper arm,
 * forearm with a swell, a mitten hand, shank with a calf, a foot whose overshoot behind the ankle is the heel, toes).
 * Proportion is data: start from a cast word, then edit the radii, station heights and `e` for THIS human. `register`
 * sets the art style (slot family and superellipse exponent) for every ring at once. Colour is the palette by group.
 * Face, hair and adornments are not here: the head is a blank trunk until a head is worn as an include. The neck names
 * the trunk family (it is a segment that reads as part of the midline).
 *
 * THE TUNE (`tune`): proportion as PERCENTAGES OF THE CAST'S OWN BASELINE, the contract the body proportion lab
 * established — thirteen relative controls in five groups (TUNE_GROUPS), each a ratio about 1 applied to the cast's
 * dials and body radii: lengths move joints only (figure-cast re-seats the soles), widths and thicknesses scale rings
 * about their own centres, `stature` and `head` are the two uniform scales. A tune is a MOVE word (HERO_MOVES), an
 * object of keys, or a list of either resolved left → right with ratios composing by PRODUCT (`['athletic',
 * { shoulders: 1.05 }]` is broader still); a group word expands first so an explicit key in the same object wins, as
 * figure-cast's aggregates do. A unit ratio is an exact no-op, so `tune: {}` changes no bytes. TUNE_RANGES are the
 * lab's comfortable exploration limits: `tuneWarnings` advises past them, nothing refuses (docs/bicycles.md).
 *
 * The canonical JSON lives at docs/examples/ring-plans/hero.plan.json, written by hero.plan.mjs (a re-export of this). */
import { PLAN_SCHEMA, r6, SLOT_FAMILIES, ringPoints } from './station-loft-plan.js';
import { mirrorPid } from './station-loft.js';
import { castArmature, resolveCast, validateCast } from './figure-cast.js';
import { ratioControls } from './ratio-controls.js';
import * as dmath from '../../util/dmath.js';
import { withMath } from '../../util/math-scope.js';

/** vajra rest units → metres: the canonical figure's crown lands at 1.80 m */
export const SCALE = 1.8;
export const REGISTERS = {
  lowpoly: { slots: 'ring6', limbSlots: 'limb6', e: 2 },
  round: { slots: 'ring8', limbSlots: 'limb6', e: 2 },
  chamfer: { slots: 'ring8', limbSlots: 'ring8', e: 6 },
  box: { slots: 'ring8', limbSlots: 'ring8', e: 12 },
};
export const PALETTE = { Skin: '#d9a77e', Top: '#3d6fa8', Bottom: '#2c3a55', Shoes: '#4a3526' };
/** the hero's own cast words, on top of figure-cast's presets: a cast is dials on the vajra rest plus a girth */
export const HERO_CASTS = {
  // hip spans narrow enough that the thighs meet at the crotch and stay close to the knee (a reference read: the
  // legs stand together, the hips are one mass); the shoulders sit a little inside the canonical span
  male: { dials: { shoulderSpan: 0.96, shoulderDrop: 8, hipSpan: 0.62 }, girth: 1, scale: 1, body: { waist: 0.165, chest: 0.22, chestDepth: 0.115, hip: 0.1, thigh: 0.086, calf: 0.067, arm: 0.061, neck: 0.066 } },
  // The female is an independent arrangement of the same vajra girdles, not a uniformly reduced male.
  // Relaxed shoulders lead into a short waist transition; the wider pelvic girdle continues through the
  // upper thighs before tapering at the knee. Chest depth belongs to the torso envelope by default. The
  // optional bust control remains available for a character that specifically calls for separate mounds.
  female: { silhouette: 'female', headScale: 1.06, dials: { shoulderSpan: 0.80, shoulderDrop: 11, hipSpan: 0.62, lumbar: 0.98, thoracic: 0.98, thigh: 1.02, shank: 1.02 }, girth: 1, scale: 0.94,
    body: { waist: 0.15, chest: 0.195, chestDepth: 0.13, hip: 0.137, hipDepth: 0.108, thigh: 0.11, calf: 0.056, arm: 0.054, neck: 0.052, bust: 0 } },
};
/** the BODY controls (metres, before girth): the radii the eye reads a build off. A cast carries its own defaults.
 * `bust` is the radius of each of two mounds on the chest, 0 for none: they protrude from the chest station, meet the
 * mirror plane only inside the torso (the cleft between them) and read as a circular W from below. `forearm` is the
 * forearm's ring radius at the elbow and its swell; null takes the arm's, so the two thicknesses are separate controls
 * that agree by default. */
/** The midsection's construction: `structured` (the default: the vajra core; `pelvis` is the basin, turned by the hip line
 * alone, a `lumbar` bone carries the pelvis hub to the navel, the pelvis part, converged legs) or `streamlined` (the
 * hero before it: the thigh lofts carry the pelvis between them, one `pelvis` bone from the pelvis hub to the navel). */
export const HERO_CORES = ['streamlined', 'structured'];
export const DEFAULT_CORE = 'structured';
const CORE_HEM = Object.freeze({ pelvis: 0.5, lumbar: 0.5 });
/** the structured core's femur, slanting in from the hip joint to the knee (degrees from vertical, front view): the
 * female's wider pelvis over a narrower knee slants more; the knee keeps its own radius plus KNEE_CLEAR off the midline */
const FEMUR_IN = Object.freeze({ female: 8, male: 4 });
const KNEE_CLEAR = 0.014;
/** the structured pelvis per body (hero-form PELVIS): `flare` the outer edge at the iliac rim, halfway down and at the hip joints as shares
 * of the way from the waist to the hip's full width (reached at the trochanter); `front` how far the midline front
 * recedes under the hem at the rim, the joints, the trochanter and the crotch (m: the female's front falls away to the
 * pubis, the male's holds nearer the belly line); `sacrum` the back's step out over the hem; `crotch` its height under the
 * hip joints (of the lumbar run); `crotchHalf` / `inner` the basin's half-width at the crotch (of the hip joint's x) and at
 * the trochanter (of the hip's width); `glute` the seat's step out behind the hem at the hip joints (m) */
/** the structured torso per body (hero-form TORSO): rings on the vajra rib egg (vajra-body.js ribCageLines: widest in its
 * lower third, narrowing to the inlet) between the five the dress addresses. Widths are drawn half-widths: `waist` the
 * navel ring (of the hem's), `rib` the costal ring's share of the way from the navel to the chest, `chest` the chest ring
 * (of the cast's chest), `lat` the armpit ring (of the shoulder joint's x: the male's back is widest there), `yoke` how far
 * the shoulder ring sits inside the joint and `capRise` how far over it (of the arm's radius: the ring meets the top of
 * the arm's own cap, so the cap reads as the deltoid outside it), `trap` the trapezius
 * ring's share of the way from the shoulder ring to the neck; `chestZ` the chest ring's height (of the navel → neck run);
 * `depth` the half-depths of the navel, costal, armpit, shoulder and trapezius rings (m, × the depth tune) and `chestDepth`
 * the chest ring's (of the cast's); `yc` the chest, armpit, shoulder and trapezius rings' centres (m, + forward); `e` the
 * superellipse of the navel … trapezius rings in a round register (a box register keeps its own) */
const TORSO_FORM = Object.freeze({
  female: Object.freeze({ waist: 0.88, rib: 0.55, chest: 0.86, lat: 0.93, yoke: -0.1, capRise: 0.5, trap: 0.5, chestZ: 0.6, depth: [0.092, 0.1, 0.1, 0.085, 0.07], chestDepth: 0.86, yc: [0.01, 0, -0.008, -0.012], e: [2.3, 2.4, 2.5, 2.6, 2.4, 2.2] }),
  male: Object.freeze({ waist: 0.98, rib: 0.5, chest: 0.97, lat: 1, yoke: -0.15, capRise: 0.55, trap: 0.5, chestZ: 0.6, depth: [0.1, 0.108, 0.108, 0.09, 0.072], chestDepth: 1, yc: [0.012, 0, -0.008, -0.012], e: [2.3, 2.4, 2.5, 2.6, 2.4, 2.2] }),
});
/** the structured bust (hero-form BUST): `size` the default bust (`body.bust`, of the cast's chest; the adult female cast
 * only), `splay` the push turned out from straight forward (degrees); `push` per torso ring [id, the midline slot's push,
 * the first slot off the midline's push (both of the bust), that slot's weight on the bust bone] */
const BUST_FORM = Object.freeze({ size: 0.27, splay: 10, push: [['st1_st2_50', 0.05, 0.45, 0.4], ['st2', 0.35, 1, 0.7], ['st2_st3_50', 0.22, 0.65, 0.4]] });
const PELVIS_FORM = Object.freeze({
  female: Object.freeze({ flare: [0.25, 0.55, 0.8], front: [0.004, 0.022, 0.042, 0.06], sacrum: 0.01, glute: 0.04, crotch: 0.42, crotchHalf: 0.32, inner: 0.5 }),
  male: Object.freeze({ flare: [0.4, 0.7, 0.88], front: [0.002, 0.012, 0.026, 0.045], sacrum: 0.006, glute: 0.03, crotch: 0.4, crotchHalf: 0.3, inner: 0.52 }),
});
export const BODY_DEFAULTS = { waist: 0.175, chest: 0.22, chestDepth: 0.115, hip: 0.105, hipDepth: null, thigh: 0.086, calf: 0.067, arm: 0.061, forearm: null, neck: 0.066, bust: 0 };
/** the bust's ceiling as a share of the chest radius it sits on: each mound centres 0.42 of the chest out, so at 0.4 it
 * still stays on the chest; past it the number is a runaway (bust: 5 built a mound metres wide) */
export const BUST_MAX_OF_CHEST = 0.4;

/** ANIME PROPORTIONS (anime-form): the female and male casts re-proportioned for the anime head, as ratios of the
 * realistic casts, baked into the anime casts below so a tune stays a percentage of THEIR baseline. The head is larger
 * relative to the body (about 6.5 heads tall on the female, 7 on the male, where the realistic casts are ~7.6), the legs
 * a little longer and the torso shorter (the inseam at about half the height), the shoulders narrower (about 1.6 and
 * 2 heads), the neck, waist and limbs slimmer, the hands and feet smaller (`extremities`: lengths and widths; a foot
 * keeps its height, so the sole stays on the ground). Measured, not asserted (hero-form.test.js). The overall height stays
 * within a centimetre of the realistic cast's. */
export const ANIME_PROPORTIONS = Object.freeze({
  female: Object.freeze({ head: 1.14, legs: 1.03, torso: 0.86, neck: 0.95, shoulders: 0.93, waist: 0.93, upperArm: 0.86, thigh: 0.92, calf: 0.9, neckGirth: 0.82, extremities: 0.85 }),
  male: Object.freeze({ head: 1.08, legs: 1.03, torso: 0.9, neck: 0.95, shoulders: 0.93, waist: 0.95, upperArm: 0.9, thigh: 0.95, calf: 0.92, neckGirth: 0.88, extremities: 0.9 }),
});
/** a hero cast re-proportioned: the lengths and the shoulder span on its resolved dials, the radii on its body, the head
 * on its head scale (the forearm follows the arm, as on the realistic casts) */
function animeCast(c, a) {
  const { from: _f, ...dials } = resolveCast(c.dials);
  dials.lumbar *= a.torso; dials.thoracic *= a.torso; dials.thigh *= a.legs; dials.shank *= a.legs; dials.neck *= a.neck; dials.shoulderSpan *= a.shoulders;
  const b = { ...BODY_DEFAULTS, ...c.body };
  const body = { ...c.body, waist: r6(b.waist * a.waist), arm: r6(b.arm * a.upperArm), thigh: r6(b.thigh * a.thigh), calf: r6(b.calf * a.calf), neck: r6(b.neck * a.neckGirth) };
  return { ...c, dials: Object.fromEntries(Object.entries(dials).map(([k, v]) => [k, r6(v)])), body, headScale: r6((c.headScale ?? 1) * a.head), extremities: a.extremities, proportions: 'anime' };
}
/** the anime casts (`heroPlan({ proportions: 'anime' })`): the hero casts re-proportioned for the anime head */
export const ANIME_CASTS = Object.freeze({ female: animeCast(HERO_CASTS.female, ANIME_PROPORTIONS.female), male: animeCast(HERO_CASTS.male, ANIME_PROPORTIONS.male) });
/** the cast a word names under a proportion: the anime cast when asked for and there is one, else the hero cast */
export const castOf = (cast, proportions = 'hero') => (typeof cast === 'string' ? (proportions === 'anime' && ANIME_CASTS[cast]) || HERO_CASTS[cast] : null);

/** THE NECK FORM (`heroPlan({ neckForm })`; the humanoid starter passes a cast's own under the anime head and anime
 * proportions): the neck as a LOFT of explicit rings instead of the three-ring segment, so the column shades round and
 * its back rises into the occiput instead of shelving out behind the lower skull, and the torso's top ring re-placed as
 * the TRAPEZIUS RING, so the shoulder line breaks convex there instead of running as one straight cone to a collar.
 *   girth     × the cast's neck radius (the loft's own factor: the cast's `neck` and the `body.neck` word still size it)
 *   slots, e  the ring family and exponent in every register (ring12: 30° between faces, under the 35° weld crease)
 *   lean      degrees the axis tilts forward going up (the cervical column's carriage); each ring stays square to the
 *             axis, so its back sits higher than its front (the nape high under the occiput, the throat low)
 *   yBase     the axis' y at its base (m, + = front); top: the axis' top above the head's base joint (m)
 *   rings     [t, width ×, depth ×, (dy m)] along the base → top run, × the neck radius: a base flare hidden in the torso,
 *             the collar, mid-neck, under the jaw, and past the top the NAPE RING set back, which carries the back of the
 *             neck up into the occiput
 *   tip       the top cap's point, [dy, dz] from the LAST ring's centre (inside the skull)
 *   blend     the loft's bone weights by station; the base cap rides the torso, the top cap the head
 *   trap      the trapezius ring: `z` and the top cap's `tip` above the neck hub (m), `r` [side, depth] (m), `yc`, `blend`
 * A neck form moves only the neck and, with a `trap`, the torso's top ring (the starter then skips its collar rise and
 * widening). */
const NAPE_LOFT = {
  slots: 'ring12', e: 2, lean: 3, yBase: -0.016, top: 0.03,
  rings: [[0, 1.25, 0.98], [0.35, 1.04, 0.84], [0.7, 0.95, 0.72], [1, 0.86, 0.64], [1.2, 0.62, 0.5, -0.022]],
  tip: [-0.01, 0.025],
  blend: { back: { torso: 1 }, st0: { torso: 0.5, neck: 0.5 }, st3: { neck: 0.5, head: 0.5 }, st4: { neck: 0.2, head: 0.8 }, tip: { head: 1 } },
};
/** the anime casts' neck forms: the male's column is 1.2 × his cast's neck radius (0.75–0.8 of the face width) with the
 * trapezius ring; the female keeps her own radius (about 0.4 of the face width) and her collar, and takes the same loft */
export const ANIME_NECK_FORMS = deepFreeze({
  male: { ...NAPE_LOFT, girth: 1.2, trap: { z: 0.04, r: [0.135, 0.09], yc: -0.015, tip: 0.078, blend: { torso: 0.85, neck: 0.15 } } },
  female: { ...NAPE_LOFT, girth: 1 },
});
function deepFreeze(o) { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); }

/** THE ANIME WAVE (the humanoid starter puts it over the form's own `wave` under the anime head, whatever the
 * proportions; every other head keeps the form's): the upper arm out to the side, about 27° below horizontal and 11°
 * forward (the elbow 14–15 cm below the shoulder and out past the torso's side), the elbow bent so the forearm stands
 * upright with the hand beside the head, the mitten's broad face to the front, the head tilted toward the hand, the other
 * arm hanging. The stroke swings the forearm on the elbow's HINGE (the elbow still, the hand across the front plane; a
 * shoulder roll would swing it toward and away from the camera), 35° out and back, twice, the hand dipping toward the
 * chin at the outer end. The upright key is the inner end of the stroke, since the forearm bone's frame is the shortest
 * arc from its hanging direction and spins where the forearm leans past about 15° toward the head (that direction's
 * opposite). Six keys, so each lands on one of the pack's 12 samples a cycle, a third of a second apart over the
 * designed 2 s: rest, in, out, in, out, in, back to rest at the seam. Found by a search over the rig's solve on the anime
 * casts; the words are directions, so one set serves every cast. */
const WAVE_ARM = { shR: { yaw: -53, pitch: 20, roll: 90 }, head: { yaw: 8, pitch: 0 } };
const WAVE_IN = { elbowL: 'slight', elbowR: 120, ...WAVE_ARM }, WAVE_OUT = { elbowL: 'slight', elbowR: 85, ...WAVE_ARM };
export const ANIME_WAVE = deepFreeze(JSON.parse(JSON.stringify([{ elbowL: 'slight', elbowR: 'slight' }, WAVE_IN, WAVE_OUT, WAVE_IN, WAVE_OUT, WAVE_IN])));

// ─── The tune ─────────────────────────────────────────────────────────────
// the thirteen body controls by group (a group word is an aggregate over its keys; `arms` over the two arm thicknesses),
// the lab's exploration limits (comfortable, not a wall) and its three MOVES. A move earns a slot by demonstrated need,
// never by list; do not quote this list's length. One resolver with the face (ratio-controls.js).
export const HERO_MOVES = Object.freeze({
  athletic: { note: 'broad shoulders over a narrower waist', tune: { shoulders: 1.18, waist: 0.94 } },
  'long-legs': { note: 'longer legs; the trunk, arms and head keep their size', tune: { legs: 1.12 } },
  'full-limbs': { note: 'fuller upper arms, forearms, thighs and calves; joints and attachment rings stay', tune: { upperArm: 1.3, forearm: 1.2, thigh: 1.2, calf: 1.25 } },
});
export const TUNE = ratioControls({
  label: 'tune',
  groups: { scale: ['stature'], lengths: ['torso', 'neck', 'legs'], widths: ['shoulders', 'waist', 'hips', 'depth'], head: ['head'], limbs: ['upperArm', 'forearm', 'thigh', 'calf'] },
  aggregates: { arms: ['upperArm', 'forearm'] },
  moves: HERO_MOVES,
  ranges: { stature: [0.85, 1.15], torso: [0.85, 1.15], neck: [0.85, 1.15], legs: [0.85, 1.15], head: [0.85, 1.15],
    shoulders: [0.8, 1.25], waist: [0.8, 1.2], hips: [0.85, 1.2], depth: [0.85, 1.2],
    upperArm: [0.65, 1.5], forearm: [0.65, 1.5], thigh: [0.65, 1.5], calf: [0.65, 1.5] },
});
export const { GROUPS: TUNE_GROUPS, KEYS: TUNE_KEYS, AGGREGATE_KEYS: TUNE_AGGREGATE_KEYS, DEFAULT: TUNE_DEFAULT, RANGES: TUNE_RANGES, MOVE_NAMES: HERO_MOVE_NAMES } = TUNE;
/** Resolve a tune spec to every TUNE_KEYS ratio, plus `from` when a move named it (see ratio-controls.js). */
export const resolveTune = TUNE.resolve;
/** Error strings for a tune spec (empty = valid). */
export const validateTune = (spec, label = 'tune') => TUNE.validate(spec, label);
/** Advisory: the resolved keys outside the lab's comfortable range. Never a refusal. */
export const tuneWarnings = TUNE.warnings;

const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s); const unit = (v) => mul(v, 1 / dmath.hypot(...v));
const R = (v) => (Array.isArray(v) ? v.map(r6) : r6(v));

/**
 * @param {object} opts
 *   cast       a HERO_CASTS word (male / female), a figure-cast preset name or a dial map (default 'canonical')
 *   register   a REGISTERS key or { slots, limbSlots, e } (default 'round')
 *   girth      multiplies every ring radius (default 1)
 *   headScale  multiplies the head trunk's radii and its spread about the atlas (default 1; a chibi wants ≥ 1.3)
 *   scale      one uniform scale over the finished figure, joints, rings and worn head alike (default the cast's, 1)
 *   palette    { group: '#hex' } (default PALETTE)
 *   body       overrides on BODY_DEFAULTS (waist, chest, chestDepth, hip, hipDepth, thigh, calf, arm, neck, bust: radii in metres)
 *   head       a head include (docs/examples/hero-head `bakeHero()` / baked.json, or docs/examples/humanoid `humanoidHead()`)
 *              worn at the atlas instead of the blank head trunk: its cranium rides the head bone, its jaw a jaw bone
 *              with a `jaw` chain; a head whose chin would sit below the collar is lifted with its jaw anchors
 *   tune       anything `resolveTune` takes: ratios to THIS cast's baseline (see TUNE_GROUPS). `stature` and `head`
 *              multiply `scale` and `headScale`; lengths and `shoulders` multiply the cast's dials; the widths and
 *              thicknesses multiply its body radii. A worn head include is pre-baked: `head` scales only the blank
 *              trunk here (the humanoid starter bakes its head at the tuned scale)
 *   neckForm   a neck form (ANIME_NECK_FORMS' shape): the neck as a loft of rings and the trapezius ring; null (the
 *              default) is the three-ring segment
 *   core       the midsection's construction (HERO_CORES): 'structured' (DEFAULT_CORE: the basin and lumbar bones, the
 *              pelvis part, converged legs) or 'streamlined' (the hero before it)
 */
export function heroPlan({ cast = 'canonical', register = 'round', girth = 1, headScale, palette = PALETTE, head = null, body = {}, scale, tune, proportions = 'hero', neckForm = null, core = DEFAULT_CORE } = {}) {
  const reg = typeof register === 'string' ? REGISTERS[register] : register;
  if (!HERO_CORES.includes(core)) throw new Error(`hero.plan: unknown core '${core}' (have ${HERO_CORES.join(', ')})`);
  const structured = core === 'structured';
  if (!reg) throw new Error(`hero.plan: unknown register '${register}' (have ${Object.keys(REGISTERS).join(', ')})`);
  if (!['hero', 'anime'].includes(proportions)) throw new Error(`hero.plan: unknown proportions '${proportions}' (have hero, anime)`);
  const preset = castOf(cast, proportions);
  if (typeof cast === 'string' && !preset) { const errs = validateCast(cast, 'cast'); if (errs.length) throw new Error(`hero.plan: ${errs[0]} — or a hero cast (${Object.keys(HERO_CASTS).join(', ')})`); }
  const tuneErrors = validateTune(tune); if (tuneErrors.length) throw new Error(`hero.plan: ${tuneErrors.join('; ')}`);
  const TN = resolveTune(tune);
  // the tune's lengths and shoulders multiply the cast's own dials (a unit ratio leaves the dial exactly as cast)
  const { from: _castFrom, ...castDials } = resolveCast(preset ? preset.dials : cast);
  const tuneDial = (k, f) => { if (f !== 1) castDials[k] = castDials[k] * f; };
  tuneDial('lumbar', TN.torso); tuneDial('thoracic', TN.torso); tuneDial('neck', TN.neck); tuneDial('thigh', TN.legs); tuneDial('shank', TN.legs); tuneDial('shoulderSpan', TN.shoulders);
  const m = withMath(dmath, () => castArmature(castDials));   // the shared figure cast, on dmath (util/math-scope.js)
  const g0 = girth * (preset?.girth ?? 1);
  for (const k of Object.keys(body)) if (!(k in BODY_DEFAULTS) || !(Number.isFinite(body[k]) && (k === 'bust' ? body[k] >= 0 : body[k] > 0))) throw new Error(`hero.plan: body.${k} is not a body control (have ${Object.keys(BODY_DEFAULTS).join(', ')}) or not a positive number`);
  const b = { ...BODY_DEFAULTS, ...(preset?.body || {}), ...body };
  if (b.bust > BUST_MAX_OF_CHEST * b.chest) throw new Error(`hero.plan: body.bust ${b.bust} is past its ceiling: at most ${BUST_MAX_OF_CHEST} × the chest radius, ${r6(BUST_MAX_OF_CHEST * b.chest)} m for this chest (${b.chest} m)`);
  // the tune's widths and thicknesses multiply the cast's radii. The forearm takes the arm's radius when it names none,
  // and the hip's profile depth derives from the UNTUNED hip, so `hips` widens the pelvis without deepening it (the
  // lab's contract: one control, one axis). Multiplying by 1 is exact in IEEE 754, so an untouched key changes no bytes.
  const forearmBase = b.forearm ?? b.arm, armBase = b.arm;
  const hipDepthBase = b.hipDepth ?? b.hip + 0.013;
  b.waist *= TN.waist; b.hip *= TN.hips; b.chestDepth *= TN.depth; b.arm *= TN.upperArm; b.forearm = forearmBase * TN.forearm; b.thigh *= TN.thigh; b.calf *= TN.calf;
  const D = TN.depth;
  const S = planScale({ cast, scale, tune, proportions });
  const HS = (headScale ?? preset?.headScale ?? 1) * TN.head;
  if (!(Number.isFinite(S) && S > 0)) throw new Error(`hero.plan: scale must be a positive number, got ${scale}`);
  const P = (k) => [m[k].x, m[k].y, m[k].z].map((v) => r6(v * SCALE));
  const g = (v, f = g0) => (Array.isArray(v) ? v.map((x) => r6(x * f)) : r6(v * f));

  // ── the joint table (metres): midline hubs and the right side; hands and feet extend the core ──
  const J = { pelvisHub: P('pelvisHub'), navel: P('navel'), neckHub: P('neckHub'), headBase: P('headBase'), headTop: P('headTop'),
    hip: P('hipR'), knee: P('kneeR'), ankle: P('ankleR'), shoulder: P('shoulderR'), elbow: P('elbowR'), wrist: P('wristR') };
  // the structured core's legs CONVERGE: the femur slants in from the hip joint to the knee (vajra-body.js femoralNeckLines:
  // "shaft converging to the knee"), so the knee sits inside the hip by the femur's inward angle and never closer to the
  // midline than its own radius and a clearance; the ankle stands under the knee. The cast's `hipSpan` moves the leg only
  // 45 % with the hip (figure-cast.js), a rule made for widening hips: narrowed hips (the female's 0.62) leave the knees
  // wider than the sockets, the thighs splayed out and the crotch a deep V. The streamlined core keeps the cast's legs.
  if (structured) {
    // the slant is taken over the UNTUNED femur, so `legs` moves the knee down and not in (a length moves joints only)
    const femaleLeg = preset?.silhouette === 'female', drop = (J.hip[2] - J.knee[2]) / TN.legs;
    const kneeX = r6(Math.max(J.hip[0] - drop * dmath.tan(FEMUR_IN[femaleLeg ? 'female' : 'male'] * Math.PI / 180), b.calf / TN.calf + KNEE_CLEAR));   // the untuned calf: `calf` thickens, it moves no joint
    if (kneeX < J.knee[0]) { J.knee = [kneeX, J.knee[1], J.knee[2]]; J.ankle = [kneeX, J.ankle[1], J.ankle[2]]; }
  }
  // hands and feet: a cast may carry an `extremities` scale (the anime casts' smaller hands and feet; 1 is exact)
  const X = preset?.extremities ?? 1;
  J.toeBase = R(add(J.ankle, [0, 0.085 * X, J.ankle[2] > 0.02 ? 0.02 - J.ankle[2] : 0]));
  J.toeTip = R(add(J.toeBase, [0, 0.08 * X, -0.005]));
  J.knuckles = R(add(J.wrist, mul(unit(add(J.wrist, mul(J.elbow, -1))), 0.09 * X)));
  const joints = Object.fromEntries(Object.entries(J).filter(([k]) => !['pelvisHub', 'navel', 'neckHub', 'headBase', 'headTop'].includes(k)));
  Object.assign(joints, { neckHub: J.neckHub, headBase: J.headBase });

  // ── the trunk: the torso alone. There is no pelvis part: the thighs start at the hip crest and carry the pelvis
  // between them (the streamlined read), the `pelvis` BONE still exists for the rig ──
  const zp = J.pelvisHub[2], zn = J.navel[2], zs = J.neckHub[2], hb = J.headBase[2], ht = J.headTop[2];
  const L = zn - zp, T = zs - zn, H = (ht - hb) * HS;
  const st = (z, r, extra = {}) => ({ z: r6(z), r: g(r), ...extra });
  const shoulderHalf = J.shoulder[0], zWaist = zp + 0.63 * L;
  const torso = { name: 'torso', kind: 'trunk', stations: [
    st(zWaist, [b.waist, 0.098 * D], { yc: 0.01 }), st(zn, [b.waist * 1.05, 0.102 * D]), st(zn + 0.55 * T, [b.chest, b.chestDepth], { yc: 0.006 }),
    st(J.shoulder[2] + 0.021, [shoulderHalf / g0 + armBase * 0.72, 0.104 * D]), st(zs + 0.025, [b.neck * 1.1, b.neck * 0.86]),
  ], caps: { back: R([0, 0, zp + 0.54 * L]), tip: R([0, 0, zs + 0.04]) }, group: 'Top', mirror: 'plane',
    bind: { bone: 'torso', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.5, torso: 0.5 }, st4: { torso: 0.6, neck: 0.4 }, tip: { neck: 1 } } } };
  // the structured core (HERO_CORES): the hem sits at the iliac rim, where the basin meets the lumbar, so it blends the
  // two; the navel ring blends the lumbar and the chest, as it blended the old pelvis bone (now `lumbar`) and the chest
  if (structured) Object.assign(torso.bind.blend, { back: { ...CORE_HEM }, st0: { ...CORE_HEM }, st1: { lumbar: 0.5, torso: 0.5 } });
  // a worn head sits at the atlas; if its chin would hang below the collar (a big or chibi head), lift it, jaw anchors too
  // (a head without a jaw part — the anime head opens its mouth as an aperture — says its chin as `chinZ`)
  const chin = head?.parts?.jaw ? Math.min(...head.parts.jaw.stations.flatMap((st) => Object.values(st.points).map((p) => p[2]))) : (head?.chinZ ?? 0);
  const rise = head ? Math.max(0, zs + 0.07 - (hb + chin)) : 0;
  const neck = neckForm ? neckLoft(neckForm, { b, g, zs, hb: hb + rise }) : { name: 'neck', kind: 'segment', from: 'neckHub', to: 'headBase', rA: g([b.neck, b.neck * 0.92]), rB: g([b.neck * 0.92, b.neck * 0.9]), slots: reg.slots, over: [0.15, 0.2], group: 'Skin', mirror: 'plane',
    bind: { bone: 'neck', blend: { back: { torso: 1 }, st0: { torso: 0.5, neck: 0.5 }, st2: { neck: 0.5, head: 0.5 }, tip: { head: 1 } } } };
  if (neckForm?.trap) {   // the trapezius ring: the torso's top ring, its top cap and its weights (absolute heights over the hub)
    const T = neckForm.trap, top = torso.stations[4];
    top.z = r6(zs + T.z); top.r = g([T.r[0], T.r[1]]); if (T.yc != null) top.yc = r6(T.yc);
    torso.caps.tip = R([0, 0, zs + T.tip]);
    if (T.blend) torso.bind.blend.st4 = { ...T.blend };
  }
  // the structured core's TORSO (TORSO_FORM): the five addressed rings re-cut on the rib egg, and three shaping rings
  // between them at fractional `u` (the costal margin, the armpit, the trapezius), so every torso address (s 0 … 4, a
  // collar's station) keeps its meaning. A shaping ring takes the name refine would give it (`st3_st4_50`).
  if (structured) {
    const F = TORSO_FORM[preset?.silhouette === 'female' ? 'female' : 'male'];
    const SF = typeof reg.slots === 'string' ? SLOT_FAMILIES[reg.slots] : reg.slots;
    const dT = Math.max(...SF.map((_, k) => Math.abs(dmath.sin(2 * Math.PI * k / SF.length))));
    const [h0, , , , n4] = torso.stations, aR = g(armBase), Sx = shoulderHalf;   // the untuned arm: the yoke is the torso's, `upperArm` thickens only the arm
    const E = (i) => (reg.e <= 3 ? { e: F.e[i] } : {});
    const ring = (id, u, z, X, Y, yc, i) => ({ id, u, z: r6(z), r: [r6(X / dT), r6(Y)], ...(yc ? { yc: r6(yc) } : {}), ...E(i) });
    const xN = F.waist * g(b.waist) * dT, xC = F.chest * g(b.chest) * dT, xS = Sx - F.yoke * aR, xNeck = n4.r[0] * dT;
    const zC = zn + F.chestZ * T, zS = J.shoulder[2] + F.capRise * aR, zA = (zC + zS) / 2;
    torso.stations = [
      { ...h0, id: 'st0', u: 0 },
      ring('st1', 1, zn, xN, F.depth[0] * D, 0, 0),
      ring('st1_st2_50', 1.5, (zn + zC) / 2, xN + F.rib * (xC - xN), F.depth[1] * D, 0, 1),
      ring('st2', 2, zC, xC, F.chestDepth * g(b.chestDepth), F.yc[0], 2),
      ring('st2_st3_50', 2.5, zA, F.lat * Sx, F.depth[2] * D, F.yc[1], 3),
      ring('st3', 3, zS, xS, F.depth[3] * D, F.yc[2], 4),
      ring('st3_st4_50', 3.5, (zS + n4.z) / 2, xS + F.trap * (xNeck - xS), F.depth[4] * D, F.yc[3], 5),
      { ...n4, id: 'st4', u: 4 },
    ];
  }
  const hs = (k, r, yc) => ({ z: r6(hb + k * H), r: r.map((x) => r6(x * H)), ...(yc ? { yc: r6(yc * H) } : {}) });
  const blankHead = { name: 'head', kind: 'trunk', stations: [
    hs(-0.25, [0.48, 0.5], 0.04), hs(0.35, [0.70, 0.74], 0.06), hs(0.9, [0.74, 0.78], 0.04), hs(1.35, [0.66, 0.70]), hs(1.65, [0.42, 0.46]),
  ], caps: { back: R([0, 0, hb - 0.45 * H]), tip: R([0, 0, hb + 1.8 * H]) }, group: 'Skin', mirror: 'plane', bind: 'head' };

  // ── the limbs: right side authored, left by name. The thigh is a LOFT from the hip crest (half the pelvis width, at
  // the waist) down past the hip to the knee, so the two thighs together read as the hips; arms and shanks carry a
  // mid-station swell; overshoots are small where the trunk already covers the joint ──
  const hip = J.hip, knee = J.knee; const dz = zp - knee[2], femaleMass = preset?.silhouette === 'female';
  const hipCenter = femaleMass ? 0.58 : 0.62, upperCenter = femaleMass ? 0.68 : 0.72;
  const midCenter = femaleMass ? 0.58 : 0.5;
  const hipRadius = Math.max(b.hip, hipCenter * hip[0] + 0.004);
  const upperRadius = Math.max(upperCenter * hip[0] + 0.004, b.thigh);
  const kneeRadius = b.calf - 0.003, midX = hip[0] + midCenter * (knee[0] - hip[0]);
  const hipDepth = hipDepthBase * D;
  // On the female mass, interpolate the OUTER contour rather than the local radius: the vajra knee
  // sits farther from the midline than the hip, so a naive radius interpolation makes the thigh widen
  // as it descends. Solving the radius back from the desired outer edge keeps the pelvis dominant.
  const midThigh = femaleMass
    ? hipCenter * hip[0] + hipRadius + midCenter * (knee[0] + kneeRadius - hipCenter * hip[0] - hipRadius) - midX
    : (b.thigh + b.calf - 0.003) / 2 + 0.007;
  const crestInset = femaleMass ? -0.011 : 0.005;
  const thigh = { name: 'thighR', kind: 'loft', stations: [
    // the crest, hip and upper-thigh rings CROSS the mirror plane (side radius well past the centre's x), so the two
    // thighs overlap through the middle: one pelvis with no groove up its front and back. Their centres sit inside the
    // hip joint (0.45 / 0.62 / 0.72 of its x): the crest is as wide as the waist less a hair, so the torso hem meets
    // the hips instead of shelving over them; the hip ring is `hip` wide (the pair a little past the waist)
    { at: R([0.45 * hip[0], 0.01, zWaist]), r: [r6(g(b.waist) - crestInset - 0.45 * hip[0]), 0.1] },
    { at: R([hipCenter * hip[0], hip[1] * (femaleMass ? 0.42 : 0.5), zp]), r: [r6(hipRadius), r6(hipDepth)] },
    { at: R([upperCenter * hip[0], hip[1] * (femaleMass ? 0.62 : 1), zp - 0.215 * dz]), r: [r6(upperRadius), r6(b.thigh + (femaleMass ? 0.012 : 0.016))] },
    { at: R([hip[0] + midCenter * (knee[0] - hip[0]), hip[1] * (femaleMass ? 0.70 : 1), zp - 0.5 * dz]), r: [r6(midThigh), r6(midThigh + 0.004)] },
    { at: R([knee[0], knee[1], knee[2] - 0.018]), r: [r6(b.calf - 0.003), r6(b.calf - 0.001)] },
  ], caps: { back: R([0.3 * hip[0], 0.01, zWaist + 0.003]), tip: R([knee[0], knee[1], knee[2] - 0.025]) }, group: 'Bottom', mirror: 'name',
    bind: { bone: 'thighR', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.8, thighR: 0.2 }, st2: { pelvis: 0.2, thighR: 0.8 }, st4: { thighR: 0.5, shankR: 0.5 }, tip: { shankR: 1 } } } };
  // the thigh's crest meets the hem at the iliac rim and blends as it does; the hip ring and below ride the basin as before
  if (structured) Object.assign(thigh.bind.blend, { back: { ...CORE_HEM }, st0: { ...CORE_HEM } });
  // the bust: two mounds, right one authored, from inside the chest forward and a little down. Their base rings overlap
  // the mirror plane inside the torso; where they leave the chest they are apart, so the cleft is the gap between two
  // round rings and the underside reads as a W. Rings in the torso's family; the torso bone carries them.
  // The structured core gives the adult female cast a bust unless her body names one (BUST_FORM.size of the chest; the
  // door says 0 for a child-coded figure), and re-cuts the mounds on its chest ring: see below.
  if (structured && femaleMass && body.bust === undefined) b.bust = r6(BUST_FORM.size * b.chest);
  const zc = zn + 0.55 * T, yFront = 0.006 + g(b.chestDepth), xb = 0.42 * g(b.chest), rb = g(b.bust);
  const bustJoints = {};
  const bust = rb > 0 && structured ? structuredBust() : rb > 0 ? [{ name: 'bustR', kind: 'loft', slots: reg.slots, stations: [
    { at: R([xb, yFront - 0.06, zc + 0.01]), r: r6(rb * 1.02) }, { at: R([xb * 1.05, yFront - 0.02, zc]), r: r6(rb) },
    { at: R([xb * 1.1, yFront + 0.02, zc - 0.012]), r: r6(rb * 0.94) }, { at: R([xb * 1.14, yFront + 0.045, zc - 0.024]), r: r6(rb * 0.74) },
  ], caps: { back: R([xb, yFront - 0.075, zc + 0.012]), tip: R([xb * 1.15, yFront + 0.062, zc - 0.032]) }, group: 'Top', mirror: 'name', bind: 'torso' }] : [];
  // the structured BUST (BUST_FORM): a form IN the chest's own surface, no part of its own (a separate mound carries its
  // own outline and reads as a ball on the shirt): the first slot off the midline of the costal, chest and armpit rings
  // pushed forward and a little out (`splay`), most on the chest ring, the midline slot less, so the cleft is the valley
  // between and the lower pole the fuller. A bone each (bustR, bustL: from the chest ring's slot to where it is pushed,
  // joints riding the torso) owns those slots, so an engine's spring has a bone to drive; the midline stays on the torso.
  function structuredBust() {
    const SF = typeof reg.slots === 'string' ? SLOT_FAMILIES[reg.slots] : reg.slots, side = SF[1], sp = BUST_FORM.splay * Math.PI / 180;
    for (const [id, front, slot, w] of BUST_FORM.push) {
      const st = torso.stations.find((x) => x.id === id);
      st.push = { [SF[0]]: [0, r6(front * rb), 0], [side]: [r6(dmath.sin(sp) * slot * rb), r6(dmath.cos(sp) * slot * rb), 0] };
      torso.bind.blend[`${id}.${side}`] = { bustR: w, torso: r6(1 - w) }; torso.bind.blend[`${id}.${mirrorPid(side)}`] = { bustL: w, torso: r6(1 - w) };
    }
    const C = torso.stations.find((x) => x.id === 'st2'), at = ringPoints([0, C.yc ?? 0, C.z], [0, 0, 1], C.r, SF, C.e ?? reg.e)[side];
    bustJoints.bustRoot$S = { at: R(at), rides: 'torso' }; bustJoints.bustTip$S = { at: R(add(at, C.push[side])), rides: 'torso' };
    return [];
  }
  // ── the structured core's PELVIS (HERO_CORES): a midline trunk on the vajra basket (vajra-body.js pelvisLines) from the
  // crotch up into the torso's hem with the seat as its back, and the thigh re-rooted at the hip socket under it with
  // the trochanter as the hip's outer edge. Heights are the vajra landmarks as shares of the lumbar run L (STAND: the
  // iliac rim 0.105 over the hip joints, the trochanter 0.04 under them, of a 0.155 run). The hip keeps the cast's width
  // but peaks at the trochanter, not the joint, and narrows steadily to the knee; the front below the waist recedes to
  // the pubis (no pouch: the female's more than the male's); the back gains the sacrum and the seat. ──
  const pelvisParts = [];
  if (structured) {
    const P = PELVIS_FORM[femaleMass ? 'female' : 'male'];
    // the crest ring sits under the hem: the vajra rim (0.68 L) can land above the hero's hem (0.63 L), and a ring above
    // the waist ring would fold the trunk and shelve the hip out over the hem
    const zr = Math.min(zp + 0.68 * L, zWaist) - 0.035, zt = zp - 0.26 * L, zc = zp - P.crotch * L;
    // WIDTHS AS DRAWN: a ring reaches its radius at the side only when its family has a side slot (ring8); ring6 reaches
    // sin 60° of it, ring10 sin 72° (sideOf). The pelvis and thigh take the trunk's family (dT), the old limbs the limbs'
    // (dL), so every width below is what is drawn and each ring's radius is solved back from it: the outline is one curve
    // in every register, not only in the round one
    const sideOf = (fam) => { const S = typeof fam === 'string' ? SLOT_FAMILIES[fam] : fam; return Array.isArray(S) ? Math.max(...S.map((_, k) => Math.abs(dmath.sin(2 * Math.PI * k / S.length)))) : 1; };
    const dT = sideOf(reg.slots), dL = sideOf(reg.limbSlots);
    const waist = g(b.waist), waistD = dT * waist, F0 = r6(0.01 + g(0.098 * D)), B0 = r6(0.01 - g(0.098 * D));   // the torso hem's own width (drawn), front and back
    // the cast's hip width as today's thigh DRAWS it, now at the trochanter
    const Wt = hipCenter * hip[0] + dL * hipRadius;
    const ring = (z, half, F, B) => ({ z: r6(z), r: [r6(half / dT), r6((F - B) / 2)], yc: r6((F + B) / 2) });
    const flareAt = (k) => waistD + k * (Wt - waistD);
    // the seat is the basin's own back (no separate lobes: every closed part carries its own ink outline, and two lobes
    // read as a pouch stuck on); the front recedes to the pubis
    pelvisParts.push({ name: 'pelvis', kind: 'trunk', stations: [
      ring(zc, P.crotchHalf * hip[0], F0 - P.front[3], B0 + 0.025),
      ring(zt, P.inner * Wt, F0 - P.front[2], B0 - 0.55 * P.glute),
      ring(zp, flareAt(P.flare[2]), F0 - P.front[1], B0 - P.glute),
      // the flare spreads from the hem to the joints over three rings (a short steep flare lights as a band of its own)
      ring((zp + zr) / 2, flareAt(P.flare[1]), F0 - (P.front[0] + P.front[1]) / 2, B0 - P.sacrum - 0.45 * P.glute),
      ring(zr, flareAt(P.flare[0]), F0 - P.front[0], B0 - P.sacrum),
      ring(zWaist - 0.004, waistD, F0, B0),
      ring(zWaist + 0.02, 0.96 * waistD, F0 - 0.004, B0 + 0.004),
    ], caps: { back: R([0, r6(F0 - P.front[3] - 0.03), zc - 0.014]), tip: R([0, 0.01, zWaist + 0.045]) }, group: 'Bottom', mirror: 'plane',
      bind: { bone: 'pelvis', blend: { back: { pelvis: 1 }, st4: { pelvis: 0.75, lumbar: 0.25 }, st5: { ...CORE_HEM }, st6: { ...CORE_HEM }, tip: { ...CORE_HEM } } } });
    // the thigh from the socket. Its upper rings stay INSIDE the basin's front and seat, so it comes out of the pelvis
    // along the groin's diagonal (high at the hip, low at the crotch) instead of a level seam; at the trochanter it carries
    // the hip's full width with its inner edge at the midline (the thighs meet under the crotch); below, the outer edge
    // tapers to the knee and the front comes forward to it. Rings by their front, back, outer and inner edges.
    // the outline runs to the knee of the UNTUNED calf (so `calf` thickens the knee ring alone), and `thigh` scales the
    // thigh's own rings about their centres (a thickness is radial)
    const calf0 = b.calf / TN.calf, kT = TN.thigh;
    const inner0 = 0.003, kneeOut = knee[0] + dL * calf0, kneeIn = knee[0] - calf0 + 0.004;
    const kneeF = knee[1] + calf0, kneeB = knee[1] - calf0;
    const edge = (o, i, F, B, z, k = 1) => ({ at: R([r6((o + i) / 2), r6((F + B) / 2), r6(z)]), r: [r6(k * (o - i) / (2 * dT)), r6(k * (F - B) / 2)] });
    const lerp = (a, c, t) => a + (c - a) * t, zAt = (t) => zt - t * (zt - knee[2]);
    // the socket ring meets the basin's own edge at the hip joints, so the outline runs on from the pelvis into the
    // trochanter without a dip between them
    const atJoint = flareAt(P.flare[2]);
    const fT = F0 - P.front[2] - 0.004, bT = B0 - 0.55 * P.glute + 0.008;
    thigh.stations = [
      // the socket ring stands straight over the trochanter ring (the same centre), so the first span is vertical and its
      // rings do not tilt: a tilted ring's side point drops, and on a short body (a chibi) the hip dipped under the joint
      edge(atJoint, Wt + inner0 - atJoint, F0 - P.front[1] - 0.01, B0 - P.glute + 0.015, zp + 0.015),
      edge(Wt, inner0, fT, bT, zt),
      edge(lerp(Wt, kneeOut, 0.3), lerp(inner0, kneeIn, 0.09), fT + 0.012, lerp(bT, kneeB, 0.3), zAt(0.3), kT),
      edge(lerp(Wt, kneeOut, 0.62), lerp(inner0, kneeIn, 0.38), lerp(fT + 0.012, kneeF, 0.5), lerp(bT, kneeB, 0.62), zAt(0.62), kT),
      // the knee ring draws the shin's own width (the shin is a limb ring: dL of its radius at the side)
      { at: R([knee[0], knee[1], knee[2] - 0.018]), r: [r6(dL * (b.calf - 0.003) / dT), r6(b.calf - 0.001)] },
    ];
    thigh.slots = reg.slots;
    thigh.caps = { back: R([r6((Wt + inner0) / 2), hip[1] * 0.4, zp + 0.04]), tip: R([knee[0], knee[1], knee[2] - 0.025]) };
    thigh.bind = { bone: 'thighR', blend: { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 0.5, thighR: 0.5 }, st2: { pelvis: 0.1, thighR: 0.9 }, st4: { thighR: 0.5, shankR: 0.5 }, tip: { shankR: 1 } } };
  }
  const limb = (name, from, to, rA, rB, over, group, prev, next, extra = {}) => ({ name, kind: 'segment', from, to, rA, rB, ...extra, over, group, mirror: 'name', bind: { bone: name, prev, next } });
  const segments = [torso, ...bust, ...pelvisParts, neck, ...(head ? [] : [blankHead]),
    limb('upperArmR', 'shoulder', 'elbow', g([b.arm, b.arm * 1.08]), g([b.arm * 0.74, b.arm * 0.82]), [0.03, 0.36], 'Top', 'torso', 'foreArmR'),
    limb('foreArmR', 'elbow', 'wrist', g([b.forearm * 0.76, b.forearm * 0.86]), g([0.029, 0.03]), [0.36, 0.2], 'Top', 'upperArmR', 'handR', { mid: 0.3, rMid: g([b.forearm * 0.77, b.forearm * 0.82]) }),
    limb('handR', 'wrist', 'knuckles', g([0.035 * X, 0.025 * X]), g([0.037 * X, 0.023 * X]), [0.25, 0.1], 'Skin', 'foreArmR', null, { e: Math.max(reg.e, 3) }),
    thigh,
    limb('shankR', 'knee', 'ankle', [r6(b.calf - 0.004), r6(b.calf - 0.002)], r6(b.calf - 0.028), [0.32, 0.28], 'Bottom', 'thighR', 'footR', { mid: 0.36, rMid: [r6(b.calf), r6(b.calf + 0.002)] }),
    limb('footR', 'ankle', 'toeBase', [r6(0.046 * X), 0.038], [r6(0.056 * X), 0.028], [1.1, 0.2], 'Shoes', 'shankR', 'toesR', { e: Math.max(reg.e, 3) }),   // the width scales; the height keeps the sole
    limb('toesR', 'toeBase', 'toeTip', [r6(0.056 * X), 0.028], [r6(0.05 * X), 0.02], [0.2, 0.35], 'Shoes', 'footR', null, { e: Math.max(reg.e, 3) }),
  ];

  // ── dials: silhouette-scale moves only; posing is the rig's ──
  const all = (w) => ({ st0: w, st1: w, st2: w, st3: w, st4: w, back: w, tip: w });
  const armParts = ['upperArm$S', 'foreArm$S', 'hand$S'], legParts = ['thigh$S', 'shank$S', 'foot$S', 'toes$S', ...(structured ? ['pelvis'] : [])], trunkParts = ['torso', ...(rb > 0 && !structured ? ['bust$S'] : [])];
  const jawed = !!head?.joints?.jawHinge;
  const HEAD_SHIFT = [0, 0, r6(hb + rise)];
  const shifted = (p) => R(add(p, HEAD_SHIFT));
  // a worn head's hair record and measures ride the include (extra include keys are tolerated), so the readout can answer
  const include = head ? [{ name: 'head', parts: head.parts, dials: head.dials, creases: head.creases, palette: head.palette, shift: HEAD_SHIFT, bind: head.bind, ...(head.hair && typeof head.hair === 'object' ? { hair: head.hair, hairMeasures: head.hairMeasures ?? null } : {}), ...(head.measures ? { faceMeasures: head.measures } : {}), ...(head.hairCoverage ? { hairCoverage: head.hairCoverage } : {}) }] : [];
  const dials = {
    ...(head ? { head: { op: 'include', name: 'head' } } : {}),
    bulk: { min: 0.8, max: 1.4, rest: 1, doc: 'x scale of the torso and arms about the mirror plane (broader chest and shoulders)', op: 'scale', axis: 'x', pivot: 0, parts: [...trunkParts, ...armParts], blend: all(1) },
    stance: { min: 0.8, max: 1.35, rest: 1, doc: 'x scale of the legs about the mirror plane (wider hips and stance, thicker legs)', op: 'scale', axis: 'x', pivot: 0, parts: legParts, blend: all(1) },
    lean: { min: -10, max: 25, rest: 0, doc: 'degrees the torso, arms, neck and head hinge forward about the waist; the legs stay planted', op: 'hinge', parts: [...trunkParts, 'neck', ...(head ? (jawed ? ['cranium', 'jaw'] : Object.keys(head.bind)) : ['head']), ...armParts], pivot: 'torso/back', axis: 'x', sign: -1 },
  };

  // a shaping ring (fractional u) takes its skin and every dial's blend from its addressed neighbours by u, the rule the
  // body refine pass uses for the rings it inserts (station-loft-body.js extendBinds, extendBlends)
  for (const P of segments.filter((p) => p.kind === 'trunk' && p.stations.some((st) => st.u !== undefined && !Number.isInteger(st.u)))) {
    const at = (blend, i, own) => blend[`st${i}`] ?? own;
    const lerpW = (lo, hi, t) => { const w = {}; for (const k of [...new Set([...Object.keys(lo), ...Object.keys(hi)])].sort()) { const v = r6((lo[k] ?? 0) * (1 - t) + (hi[k] ?? 0) * t); if (v > 0) w[k] = v; } return w; };
    for (const st of P.stations) {
      if (st.u === undefined || Number.isInteger(st.u)) continue;
      const i = Math.floor(st.u), t = st.u - i;
      if (P.bind && typeof P.bind === 'object' && P.bind.blend && P.bind.blend[st.id] === undefined) {
        const w = lerpW(at(P.bind.blend, i, { [P.bind.bone]: 1 }), at(P.bind.blend, i + 1, { [P.bind.bone]: 1 }), t);
        if (!(Object.keys(w).length === 1 && w[P.bind.bone] === 1)) P.bind.blend[st.id] = w;
      }
      for (const d of Object.values(dials)) if (d.blend && d.parts?.includes(P.name) && d.blend[st.id] === undefined) d.blend[st.id] = r6((d.blend[`st${i}`] ?? 0) * (1 - t) + (d.blend[`st${i + 1}`] ?? 0) * t);
    }
  }

  // ── the rig: the vajra core IS the joint table; hands and feet ride or plant ──
  const rig = {
    joints: { pelvisHub: { at: J.pelvisHub }, navel: { at: J.navel }, neckHub: { at: J.neckHub }, headBase: { at: J.headBase }, headTop: { at: J.headTop },
      hip$S: { at: J.hip }, knee$S: { at: J.knee }, ankle$S: { at: J.ankle }, toeBase$S: { at: J.toeBase }, toeTip$S: { at: J.toeTip },
      shoulder$S: { at: J.shoulder }, elbow$S: { at: J.elbow }, wrist$S: { at: J.wrist }, knuckles$S: { at: J.knuckles, rides: 'foreArm$S' },
      ...(jawed ? { jawHinge: { at: shifted(head.joints.jawHinge), rides: 'head' }, jawTip: { at: shifted(head.joints.jawTip), rides: 'head' } } : {}), ...bustJoints },
    bones: [
      ...(structured
        // the basin turns with the hip line alone (figure-vajra.js articulateTransforms' pelvis rides hipL); the lumbar is
        // the old pelvis frame, the pelvis hub to the navel, so a spine curl bends it over a still basin
        ? [{ id: 'pelvis', head: 'pelvisHub', tail: 'navel', align: ['hipR', 'hipL'] }, { id: 'lumbar', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }]
        : [{ id: 'pelvis', head: 'pelvisHub', tail: 'navel', aux: ['hipL', 'hipR'] }]),
      { id: 'torso', head: 'navel', tail: 'neckHub', aux: ['shoulderL', 'shoulderR'] },
      { id: 'neck', head: 'neckHub', tail: 'headBase' }, { id: 'head', head: 'headBase', tail: 'headTop' }, ...(jawed ? [{ id: 'jaw', head: 'jawHinge', tail: 'jawTip' }] : []),
      { perSide: [
        { id: 'upperArm$S', head: 'shoulder$S', tail: 'elbow$S' }, { id: 'foreArm$S', head: 'elbow$S', tail: 'wrist$S' }, { id: 'hand$S', head: 'wrist$S', tail: 'knuckles$S' },
        ...(bustJoints.bustRoot$S ? [{ id: 'bust$S', head: 'bustRoot$S', tail: 'bustTip$S' }] : []),
        { id: 'thigh$S', head: 'hip$S', tail: 'knee$S' }, { id: 'shank$S', head: 'knee$S', tail: 'ankle$S' }, { id: 'foot$S', head: 'ankle$S', tail: 'toeBase$S' }, { id: 'toes$S', head: 'toeBase$S', tail: 'toeTip$S' },
      ] },
    ],
    ...(jawed ? { chains: { jaw: { axis: 'x', sign: -1, links: [{ pivot: 'jawHinge', joints: ['jawTip'] }] } } } : {}),
    legs: Object.fromEntries(['R', 'L'].map((S) => [S, { hip: `hip${S}`, knee: `knee${S}`, hock: `ankle${S}`, toeBase: `toeBase${S}`, toeTip: `toeTip${S}`, pole: [0, 1, 0] }])),
    reach: 'reject',
  };

  // ── clips: pose words for the core; a walk in place (one foot planted, the other swings) ──
  const READY = { elbowL: 'slight', elbowR: 'slight' };
  const swingR = { support: 'L', legR: { x: 0.08, y: 0.45, z: -0.89 }, kneeR: 'slight', armL: { x: -0.2, y: 0.42, z: -0.88 }, armR: { x: 0.2, y: -0.4, z: -0.9 }, elbowL: 'half', elbowR: 'slight' };
  const swingL = { support: 'R', legL: { x: -0.08, y: 0.45, z: -0.89 }, kneeL: 'slight', armR: { x: 0.2, y: 0.42, z: -0.88 }, armL: { x: -0.2, y: -0.4, z: -0.9 }, elbowR: 'half', elbowL: 'slight' };
  const clips = {
    idle: [READY, { ...READY, spine: { arch: 0.06 } }, READY, { ...READY, crouch: 0.03, ...(jawed ? { jaw: 4 } : {}) }],
    walk: [{ ...READY, ...swingR }, READY, { ...READY, ...swingL }, READY],
    // the wave: the upper arm out and forward at shoulder height, the forearm standing up (the elbow never over the head),
    // the hand waving by the elbow opening and closing (raw swivels, searched on the rig: elbow ≤ the shoulder line)
    wave: [READY, { ...READY, shR: { yaw: -45, pitch: 90, roll: 90 }, elbowR: 100, head: { x: 0.1, y: 0.95, z: 0.3 } }, { ...READY, shR: { yaw: -45, pitch: 90, roll: 90 }, elbowR: 78 }, { ...READY, shR: { yaw: -45, pitch: 90, roll: 90 }, elbowR: 118 }],
  };

  return scalePlan({
    schema: PLAN_SCHEMA,
    frame: { up: '+z', front: '+y', note: `1 unit = 1 m; a human on the vajra rest skeleton (cast ${typeof cast === 'string' ? cast : 'dials'}${preset?.proportions === 'anime' ? ', anime proportions' : ''}${S !== 1 ? `, ×${S}` : ''}${HS !== 1 ? `, head ×${HS}` : ''}${tuned(TN)}), soles on z = 0, facing +y` },
    symmetry: { plane: 'x=0', policy: 'midline parts: right half authored, left half mirrored by name; limbs: right limb authored, left limb mirrored in x with R ↔ L renamed on the part and the slot' },
    style: { slots: reg.slots, limbSlots: reg.limbSlots, e: reg.e },
    joints, segments, include, dials, palette, rig, clips,
  }, S);
}

/** A neck form's loft (see ANIME_NECK_FORMS): the axis from below the neck hub (hidden in the torso) to `top` above the
 * head's base joint (`hb`, lifted with a lifted head), leaning forward; each ring on it at its fraction, sized off the
 * cast's neck radius, the nape ring set back; the base cap under the axis, the top cap off the LAST ring's centre (so
 * a ring past the axis' top carries it, and the cap's fan keeps its winding). */
function neckLoft(N, { b, g, zs, hb }) {
  const k = N.girth ?? 1, lean = ((N.lean ?? 0) * Math.PI) / 180;
  const z0 = zs - 0.15 * b.neck, z1 = hb + (N.top ?? 0.2 * b.neck), y0 = N.yBase ?? 0;
  const at = (t) => { const z = z0 + t * (z1 - z0); return [0, y0 + (z - z0) * dmath.tan(lean), z]; };
  const stations = N.rings.map(([t, w, d, dy]) => { const p = at(t); return { at: R(dy ? [0, p[1] + dy, p[2]] : p), r: g([b.neck * k * w, b.neck * k * d]) }; });
  const end = stations.at(-1).at, tip = N.tip ?? [0, 0.35 * b.neck];
  return { name: 'neck', kind: 'loft', stations, caps: { back: R([0, y0, z0 - 0.3 * b.neck]), tip: R([0, end[1] + tip[0], end[2] + tip[1]]) }, slots: N.slots, ...(N.e ? { e: N.e } : {}), group: 'Skin', mirror: 'plane',
    bind: { bone: 'neck', blend: JSON.parse(JSON.stringify(N.blend)) } };
}

/** the frame note's tune clause: the keys that moved, as percentages (`from` first when a move named it) */
const tuned = (T) => { const d = TUNE.describe(T); return d ? `; ${d}` : ''; };

/** The uniform scale heroPlan puts over a finished figure (scalePlan's `s`): the given `scale`, else the cast's, times the
 * tune's stature. */
export const planScale = ({ cast, scale, tune, proportions = 'hero' }) => (scale ?? castOf(cast, proportions)?.scale ?? 1) * resolveTune(tune).stature;
/** One include part under scalePlan's scale: a layer-1 part's station points and caps, any other part's pin-local
 * offsets (a new object; the part is not touched). */
export function scaleIncludePart(part, s) {
  const v = (p) => R(mul(p, s));
  return part.stations
    ? { ...part, stations: part.stations.map((st) => ({ ...st, points: Object.fromEntries(Object.entries(st.points).map(([k, p]) => [k, v(p)])) })), caps: Object.fromEntries(Object.entries(part.caps).map(([k, p]) => [k, v(p)])) }
    : { ...part, offsets: Object.fromEntries(Object.entries(part.offsets).map(([k, p]) => [k, v(p)])) };
}
/** One uniform scale over a finished hero plan: every joint, ring, cap, include point and rig anchor, so the figure keeps
 * its proportions at another height (overshoots are fractions and dials are angles or ratios, so they stay). */
export function scalePlan(plan, s) {
  if (s === 1) return plan;
  const v = (p) => R(mul(p, s)), rad = (r) => (Array.isArray(r) ? r.map((x) => r6(x * s)) : r6(r * s));
  const joints = Object.fromEntries(Object.entries(plan.joints).map(([k, p]) => [k, v(p)]));
  const segments = plan.segments.map((seg) => {
    const out = { ...seg };
    if (seg.kind === 'trunk') out.stations = seg.stations.map((st) => ({ ...st, z: r6(st.z * s), r: rad(st.r), ...(st.yc != null ? { yc: r6(st.yc * s) } : {}), ...(st.push ? { push: Object.fromEntries(Object.entries(st.push).map(([k, d]) => [k, v(d)])) } : {}) }));
    if (seg.kind === 'loft') out.stations = seg.stations.map((st) => ({ ...st, at: v(st.at), r: rad(st.r) }));
    if (seg.kind === 'segment') { out.rA = rad(seg.rA); out.rB = rad(seg.rB); if (seg.rMid != null) out.rMid = rad(seg.rMid); }
    if (seg.kind === 'chain') out.r = rad(seg.r);
    if (seg.caps) out.caps = { back: v(seg.caps.back), tip: v(seg.caps.tip) };
    return out;
  });
  const include = (plan.include || []).map((inc) => ({ ...inc, shift: v(inc.shift), parts: Object.fromEntries(Object.entries(inc.parts).map(([name, part]) => [name, scaleIncludePart(part, s)])) }));
  const rigJoints = Object.fromEntries(Object.entries(plan.rig.joints).map(([k, j]) => [k, { ...j, at: v(j.at) }]));
  return { ...plan, joints, segments, include, rig: { ...plan.rig, joints: rigJoints } };
}
