/**
 * cycle-looks — a machine's look is a card, never a second machine: its palette, how its painted parts are finished,
 * and what its bright metal becomes. The same parts in every look; only their colour and their finish change.
 *
 *   stock      the archetype's own palette and finish
 *   police     white and blue, its paint gloss
 *   military   matte olive, its paint and castings flat, its bright metal painted over
 *   blackout   matte black, its bright metal painted black
 *   classic    cream and maroon, its bright metal mirror chrome
 *
 *   lookCard(id) → the card, or throws naming the looks
 *   lookMaterial(card, role, material) → the material a part of that colour role wears in the look
 *
 * Pure data and pure functions.
 */

const MATTE = { preset: 'matte', ambient: 0.48, diffuse: 0.58, specular: 0.05, shininess: 4 };
const GLOSS = { preset: 'satin', ambient: 0.46, diffuse: 0.6, specular: 0.42, shininess: 34 };

export const CYCLE_LOOKS = Object.freeze({
  stock: Object.freeze({ label: 'as built' }),
  police: Object.freeze({ label: 'a police machine\'s white and blue', palette: 'policeWhite', paint: GLOSS }),
  // (a metal finish draws in its metal's own colour: a machine painted over wears paint, so its palette's tint shows)
  military: Object.freeze({ label: 'matte olive, its bright metal painted over', palette: 'fieldOlive', paint: MATTE, trim: MATTE, metal: MATTE }),
  blackout: Object.freeze({ label: 'matte black, its bright metal painted black', palette: 'blackout', paint: MATTE, metal: MATTE }),
  classic: Object.freeze({ label: 'cream and maroon, its bright metal chrome', palette: 'classicCream', paint: GLOSS, metal: { metal: 'chrome', finish: 'mirror' } }),
});
export const LOOK_IDS = Object.freeze(Object.keys(CYCLE_LOOKS));

export function lookCard(id) {
  const card = CYCLE_LOOKS[id ?? 'stock'];
  if (!card) throw new Error(`Unknown cycle look '${id}'; expected one of: ${LOOK_IDS.join(', ')}`);
  return card;
}

const isMetal = (m) => !!m && typeof m === 'object' && typeof m.metal === 'string';
/** The material a part wears in a look: the card's paint or trim finish for those roles, its metal for any bright metal
 *  (the chrome role's, or a part's own chrome or aluminium); everything else as it was. */
export function lookMaterial(card, role, material) {
  if (role === 'paint' && card.paint) return { ...card.paint };
  if (role === 'trim' && card.trim) return { ...card.trim };
  if (card.metal && isMetal(material) && ['chrome', 'aluminium'].includes(material.metal)) return { ...card.metal };
  return material;
}
