/**
 * body-types.js — the ONE list of the body types a controllable entity may carry, and the authoring checks that
 * read it. Not an engine builder (it is never emitted to the page): the World page's body switch
 * (scene/channels/controllable/index.js `__makeBody`) and world-scene.js's glyph lowering are what draw these, and a
 * test holds this list to that switch, so a type the page learns to draw is a row here first.
 *
 * normalizeEntity (core.js) takes any `body.type` it is handed and the page draws nothing for one it does not know:
 * an unknown type was an invisible hero with ok:true. The minting doors (compose_world's controllable base,
 * create_sketch / update_sketch of any world recipe carrying `entities`) refuse it here, naming the list.
 *
 *   BODY_TYPES               type → what it is (the teaching line a refusal prints)
 *   BODY_TYPE_NAMES          the types, in that order
 *   bodyTypeErrors(entities) one line per entity whose body.type is not a type here ([] when all are)
 *   heroRefError(name, ref, row)  why a figures-map `heroRef` cannot pilot (null when it can): a stored hero or a
 *                            mascot only; an animal is pointed at the animal mascot, which can
 */

import { isMascotPlan } from '../../egocube/mascot-pilot.js';

export const BODY_TYPES = Object.freeze({
  none: 'invisible (a first-person camera, a rule with no look)',
  mesh: "a box or a sphere: { shape: 'box'|'sphere', size|radius, color }",
  'figure-rig': 'a rigged figure from figures{}: a made character (heroRef / hero), a unitRef suit, a vehicleRef car, a racer, a supercar, or delivery: \'rig\'',
  'figure-frames': 'a baked human figure from figures{} ({ motion, proto })',
  polygomer: 'a dreamed manji-tree hero from figures{} (polygomerRef)',
  glyph: "a UI-language form: { form: 'gem'|'heart'|'flag'|…, tint? }",
  platform: 'a moving deck under a mover rule (carrier, carryHalf): it carries what stands on it and draws nothing itself',
});

export const BODY_TYPE_NAMES = Object.freeze(Object.keys(BODY_TYPES));

const HERO_PATH = "a made character is the hero as body: { type: 'figure-rig', figure: '<name>' } with figures: { <name>: { heroRef: '<its ref>', … } } (get_view_vocab({ id: 'controllable' }), \"A made character as the hero\")";

/** One line per entity whose body names a type the page does not draw. A body with no type is `none` (normalizeEntity). */
export function bodyTypeErrors(entities) {
  if (!Array.isArray(entities)) return [];
  const errors = [];
  entities.forEach((e, i) => {
    const t = e && e.body && typeof e.body === 'object' ? e.body.type : undefined;
    if (t === undefined || t === null || t === '' || (typeof t === 'string' && Object.hasOwn(BODY_TYPES, t))) return;
    const hint = t === 'character' || t === 'hero' || t === 'figure' ? `; ${HERO_PATH}` : '';
    errors.push(`entity '${(e && e.id) || i}' has body type ${JSON.stringify(t)}, which nothing draws (the body types: ${BODY_TYPE_NAMES.join(', ')})${hint}`);
  });
  return errors;
}

/** The kind of character a stored row is, as create_character reads it (create-character.js asOf). */
const isAnimalRow = (m) => !!m && (m.kind === 'animal' || (m.kind === 'layered' && !m.hero && !!(m.fauna || m.species)));

/** Why a figures-map entry's `heroRef` cannot be the hero (null when it can): a stored hero or a mascot pilots. */
export function heroRefError(name, ref, row) {
  const m = row && row.manifest;
  if (m && m.kind === 'layered' && (m.hero || isMascotPlan(m.plan))) return null;
  if (!m) return `figures.${name}: heroRef '${ref}' is not a stored sketch (make the hero with create_character { as: 'hero' } or { as: 'mascot' })`;
  if (isAnimalRow(m)) {
    return `figures.${name}: heroRef '${ref}' is an animal, and an animal is not a pilot yet (its rig has no run and jump the platform rule plays). `
      + "An animal mascot is: create_character({ as: 'mascot', spec: { brief: 'a fox mascot' } }) (or facets: { animal: '<species>' }), then heroRef its ref";
  }
  return `figures.${name}: heroRef '${ref}' is not a stored hero or mascot (it is a '${m.kind}'; make one with create_character { as: 'hero' } or { as: 'mascot' }; any other creature is not a pilot yet)`;
}
