// statue/forms — the creature designer's library forms a city's statue can name instead of a stored sketch
// (historic/statues.js `{ at, form, material? }`): each a layered plan (polygonizer/*-form.js) under the statue filter
// (creature.js), resolved by the World with no store. Pure and deterministic.
import { sphinxPlan } from '../polygonizer/sphinx-form.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { MATERIAL_WORDS } from './principles.js';

/** each form: its plan, and the stone it is carved in when the entry names none */
export const STATUE_FORMS = Object.freeze({
  sphinx: { plan: () => sphinxPlan(), material: 'limestone', note: "the recumbent king-headed lion of Giza (sphinx-form.js)" },
});
export const STATUE_FORM_WORDS = Object.freeze(Object.keys(STATUE_FORMS));

/** Form errors for an entry's `form` and `material` */
export function validateStatueForm(form, material, at = 'statue') {
  const errs = [];
  if (!STATUE_FORMS[form]) errs.push(`${at}.form: one of ${STATUE_FORM_WORDS.join(', ')}`);
  if (material !== undefined && (!MATERIAL_WORDS.includes(material) || material === 'painted')) errs.push(`${at}.material: one of ${MATERIAL_WORDS.filter((w) => w !== 'painted').join(', ')}`);
  return errs;
}

/** The layered manifest a form resolves to: its plan expanded, carved in `material` (the form's stone by default) */
export function statueFormManifest(form, { material } = {}) {
  const F = STATUE_FORMS[form], plan = F.plan();
  return { kind: 'layered', plan, recipe: expandPlan(plan), dials: {}, statue: { type: 'statue', material: material ?? F.material } };
}
