/** humanoid.plan.mjs — the HUMANOID starter: the hero form (docs/examples/ring-plans) with a male / female preset,
 * the body controls, and the planar LANDMARK HEAD from ./head.mjs (a cage on the figure's own skull landmarks, the
 * jaw hinged along the mandibular angle, expressions displacing the flesh, hair as one mass). Hair, palette and
 * expression are independent of the proportions. A thin wrapper: every number lives in the hero form or the head. */
import { heroPlan, HERO_CASTS, BODY_DEFAULTS, REGISTERS } from '../ring-plans/hero.plan.mjs';
import { humanoidHead, HAIR_STYLES, EXPRESSIONS } from './head.mjs';

export const BODY_PRESETS = Object.fromEntries(Object.entries(HERO_CASTS).map(([k, c]) => [k, { ...BODY_DEFAULTS, ...c.body }]));
export const PALETTE = { Skin: '#d9a77e', Top: '#3d6fa8', Bottom: '#2c3a55', Shoes: '#4a3526', Hair: '#3b291e' };
export { HAIR_STYLES, EXPRESSIONS, REGISTERS };

/**
 * @param {object} opts
 *   preset      'male' | 'female' (a HERO_CASTS word: joints, girth, body defaults; the head's dimorph pole)
 *   body        overrides on the body controls (waist, chest, chestDepth, hip, thigh, arm, neck)
 *   face        overrides on the head's shape knobs (browRidge, jawWidth, chinPoint, noseSize, cheekbone, eyeSize …)
 *   register    'lowpoly' | 'round' | 'chamfer' | 'box' (the body's rings and the head's planes)
 *   hair        'crop' | 'swept' | 'bob' | 'none';  expression  'neutral' | 'smile' | 'determined' | 'surprised'
 *   headScale   scales the head (its carriers, pin-local detail and jaw anchors together)
 */
export function humanoidPlan({ preset = 'male', body = {}, face = {}, register = 'round', girth = 1, headScale = 1, palette = {}, hair = 'swept', expression = 'neutral' } = {}) {
  if (!HERO_CASTS[preset]) throw new Error(`humanoid: unknown preset '${preset}' (have ${Object.keys(HERO_CASTS).join(', ')})`);
  const colours = { ...PALETTE, ...palette };
  const head = humanoidHead({ preset, shape: face, register, hair, expression, scale: headScale, skin: colours.Skin, hairColor: colours.Hair, palette: colours });
  const plan = heroPlan({ cast: preset, register, girth, headScale, palette: colours, head, body });
  plan.frame.note = `1 unit = 1 m; humanoid ${preset} starter, ${register}; proportions are body controls, hair and palette independent`;
  return plan;
}
