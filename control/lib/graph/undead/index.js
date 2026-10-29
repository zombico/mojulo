/**
 * THE UNDEAD: core forms for the dead that walk, on the tiered hero body (./tiered.js: a hero's `undead` field), so
 * every one is minted, rigged, animated and fielded as any hero is. FORM ONLY: what the body is shaped like, never its
 * colours (one tone; decay is the dressing layer's).
 *
 *   zombie     the body kept, and wrong: wasted or swollen, hunched, the head hung and cocked, the jaw slack, the arms
 *              out before it; a seeded loss (a forearm, a hand) on some
 *   skeleton   the body gone to its frame (./hero-bones.js): a spine, an egg of ribs, a breastbone and collarbones, a
 *              pelvis, every limb a shaft with knobbed ends, a skull with its own jaw
 *
 * A variation is a card (./cards.js), rolled by the build: a bestiary skin `{ people: 'skeleton', facets: { build:
 * 'brute' } }` stands the giant. The lineages (egocube/ancestry.js) carry the form and its layers (UNDEAD_LAYERS:
 * ./tiered-layers.js); the hero door builds them.
 *
 *   UNDEAD_FORMS, UNDEAD_CARDS, UNDEAD_LAYERS   the forms, their cards, the layers a lineage lays over them
 *   variantOf(form, build)         → the card id a build rolls (canonical's when the form has none for it)
 */
import { UNDEAD_CARDS, UNDEAD_FORMS, UNDEAD_LAYERS } from './cards.js';

export { UNDEAD_CARDS, UNDEAD_FORMS, UNDEAD_LAYERS };

export function variantOf(form, build) {
  const F = UNDEAD_FORMS[form];
  if (!F) throw new Error(`undead: no form '${form}' (forms: ${Object.keys(UNDEAD_FORMS).join(', ')})`);
  return F.variants.find((id) => UNDEAD_CARDS[id].build === build) ?? F.variants.find((id) => UNDEAD_CARDS[id].build === 'canonical');
}
