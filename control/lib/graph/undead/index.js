/**
 * THE UNDEAD: core forms for the dead that walk, as creature-loop bodies (egocube/plan.js `biped`, rigged by its
 * `dialsAndRig`), so every one is minted, rigged, animated and fielded as any creature is. FORM ONLY: what the body is
 * shaped like, never its colours (the palette stays the creature loop's neutral reading; decay is the dressing layer's).
 *
 *   zombie     the body kept, and wrong: wasted or swollen, hunched, the head hung and cocked, the jaw slack, the arms
 *              out before it; a seeded loss (a forearm, a hand) on some
 *   skeleton   the body gone to its frame: a spine, curved ribs, a breastbone and collarbones, a pelvis basin, every limb
 *              a shaft with knobbed ends, a skull
 *
 * A variation is a card (./cards.js), rolled by the egocube build: a bestiary skin `{ people: 'skeleton', facets:
 * { build: 'brute' } }` stands the giant. The lineages `zombie` and `skeleton` (egocube/ancestry.js) carry the form; the
 * creature door builds them here.
 *
 *   UNDEAD_FORMS, UNDEAD_CARDS     the forms and their cards
 *   variantOf(form, build)         → the card id a build rolls (canonical's when the form has none for it)
 *   undeadBody(form, { build, pole, k, g, chest, hips, seed, biped })   → { id, card, body, lost, frameParts, posture,
 *                                  head }: the biped built and passed (`biped` handed in by the creature door: this
 *                                  module never imports it back)
 *
 * Pure and deterministic: its dice are the sheet's seed.
 */
import { UNDEAD_CARDS, UNDEAD_FORMS } from './cards.js';
import { fleshPasses, bonePasses, posture, poseArms } from './passes.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

export { UNDEAD_CARDS, UNDEAD_FORMS };

/** the head each form wears (creature-heads/derive.js) */
export const UNDEAD_HEADS = Object.freeze({ zombie: 'gaunt', skeleton: 'skull' });

export function variantOf(form, build) {
  const F = UNDEAD_FORMS[form];
  if (!F) throw new Error(`undead: no form '${form}' (forms: ${Object.keys(UNDEAD_FORMS).join(', ')})`);
  return F.variants.find((id) => UNDEAD_CARDS[id].build === build) ?? F.variants.find((id) => UNDEAD_CARDS[id].build === 'canonical');
}

export function undeadBody(form, { build = 'canonical', pole = 'male', k, g, chest, hips, seed = 1, biped }) {
  const id = variantOf(form, build), card = UNDEAD_CARDS[id], rand = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  // (a skeleton's hands: four fingers, no claws; a zombie's the same)
  const base = biped({ k, g, legs: 'plantigrade', fingers: 4, pole, build });
  const out = card.form === 'bone' ? bonePasses(base, card, { k, g, chest, hips, rand }) : fleshPasses(base, card, { k, g, rand });
  // (the arms built where the rest holds them: ./passes.js poseArms)
  const P = poseArms(out.body, posture(card, rand));
  // (a skeleton's skull is its own bones, ./skull.js: it wears no head card)
  return { id, card, body: out.body, lost: out.lost ?? null, frameParts: out.frameParts ?? [], posture: P, head: out.skull ? null : UNDEAD_HEADS[form], skull: out.skull ?? null };
}
