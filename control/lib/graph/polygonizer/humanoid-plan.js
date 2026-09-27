/** humanoid-plan.js — the HUMANOID starter (core since face-tune; docs/examples/humanoid/humanoid.plan.mjs re-exports it): the hero form (docs/examples/ring-plans) with a male / female preset,
 * the body controls, and the planar LANDMARK HEAD from ./head.mjs (a cage on the figure's own skull landmarks, the
 * jaw hinged along the mandibular angle, expressions displacing the flesh, hair as one mass). Hair, palette and
 * expression are independent of the proportions. The shirt-panel refinement lives here; shared anatomy lives in the hero form or the head. */
import { heroPlan, HERO_CASTS, BODY_DEFAULTS, REGISTERS, resolveTune } from './hero-form.js';
import { humanoidHead, HAIR_STYLES, EXPRESSIONS, FACE_VERSION, FACE, resolveFace, validateFace, HEAD_PRESETS } from './humanoid-head.js';
import { validateCast } from './figure-cast.js';
import { dressPlan, kitPalette } from './hero-dress.js';

export const BODY_PRESETS = Object.fromEntries(Object.entries(HERO_CASTS).map(([k, c]) => [k, { ...BODY_DEFAULTS, ...c.body }]));
export const PALETTE = { Skin: '#d9a77e', Top: '#3d6fa8', Bottom: '#2c3a55', Shoes: '#4a3526', Hair: '#3b291e' };
export { HAIR_STYLES, EXPRESSIONS, REGISTERS, FACE_VERSION, FACE };

/**
 * @param {object} opts
 *   preset      'male' | 'female' (a HERO_CASTS word: joints, girth, body defaults; the head's dimorph pole)
 *   body        overrides on the body controls (waist, chest, chestDepth, hip, hipDepth, thigh, arm, neck)
 *   face        the FACE controls (humanoid-head.js `FACE`): a move word ('broad-jaw', 'large-eyes'), a ratio object over the
 *               shape knobs and the lab's words (skullWidth, faceWidth, faceLength, jawWidth, chinProjection, cheek, eyeSpacing,
 *               eyeSize, browHeight, noseWidth, noseSize, mouthWidth …) or a list composed by product; 1 = the fitted head
 *   headPreset  the head's pole and fit ('male' | 'female'); defaults to `preset` when that is a hero cast, else 'male'
 *   register    'lowpoly' | 'round' | 'chamfer' | 'box' (the body's rings and the head's planes)
 *   hair        'crop' | 'swept' | 'bob' | 'none';  expression  'neutral' | 'smile' | 'determined' | 'surprised'
 *   headScale   scales the head (its carriers, pin-local detail and jaw anchors together)
 *   detail      BODY DETAIL (hero-dress.js): 'clothed' | 'none' | body data — the dragon's passes with the hero's parameters
 *   adorn       ADORNMENT (hero-dress.js): 'ranger' | 'none' | a kit — worn over the detail, one signature each
 *   tune        anything the hero form's `resolveTune` takes: percentages of the preset's own baseline (a move word,
 *               { shoulders, waist, hips, depth, torso, neck, legs, head, stature, upperArm, forearm, thigh, calf }, or a list).
 *               `head` here scales the WORN head: it is baked at the tuned scale (the form's own `head` only sizes a blank trunk)
 */
export function humanoidPlan({ preset = 'male', body = {}, face = {}, register = 'round', girth = 1, headScale, palette = {}, hair = 'swept', expression = 'neutral', tune, headPreset, detail, adorn } = {}) {
  const heroCast = typeof preset === 'string' && HERO_CASTS[preset];
  if (!heroCast && (typeof preset !== 'string' || validateCast(preset).length)) throw new Error(`humanoid: unknown preset '${preset}' (have ${Object.keys(HERO_CASTS).join(', ')}, or a figure cast)`);
  const pole = headPreset ?? (heroCast ? preset : 'male');
  if (!HEAD_PRESETS[pole]) throw new Error(`humanoid: unknown headPreset '${pole}' (have ${Object.keys(HEAD_PRESETS).join(', ')})`);
  const faceErrors = validateFace(face); if (faceErrors.length) throw new Error(`humanoid: ${faceErrors.join('; ')}`);
  const { from: _faceFrom, ...shape } = resolveFace(face);
  const colours = { ...PALETTE, ...kitPalette(adorn), ...palette };   // a kit's suggested colours, beneath the operator's
  const resolvedHeadScale = (headScale ?? heroCast?.headScale ?? 1) * resolveTune(tune).head;
  const head = humanoidHead({ preset: pole, shape, register, hair, expression, scale: resolvedHeadScale, skin: colours.Skin, hairColor: colours.Hair, palette: colours });
  const plan = heroPlan({ cast: preset, register, girth, headScale: resolvedHeadScale, palette: colours, head, body, tune });
  // Broad shirt panels and a sloping shoulder yoke are specific to this starter.
  // Keep the hero recipe (and previously stored plans) independent of this art direction.
  const torso = plan.segments.find(s => s.name === 'torso');
  torso.stations[0].r[1] *= 1.12; // overlap the trouser crest with a continuous shirt hem
  torso.e = Math.max(REGISTERS[register].e, 3);
  const shoulder = torso.stations[3], collar = torso.stations[4];
  const collarRise = 0.025 * (heroCast?.scale ?? 1);
  collar.z += collarRise;
  torso.caps.tip[2] += collarRise;
  shoulder.r[1] *= 1.08;
  collar.r[0] *= 1.10;
  collar.r[1] *= 1.10;
  dressPlan(plan, { detail, adorn, operatorPalette: palette, scale: (heroCast?.scale ?? 1) * resolveTune(tune).stature });
  plan.frame.note = `1 unit = 1 m; humanoid ${preset} starter, face v${FACE_VERSION}, ${register}; proportions are body controls, hair and palette independent${(() => { const d = FACE.describe(resolveFace(face)); return d ? `; ${d}` : ''; })()}`;
  return plan;
}
