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
 *   undeadBody(form, { build, pole, k, g, chest, hips, seed, biped, layers })   → { id, card, body, lost, frameParts,
 *                                  posture, head, skull, layers }: the biped built and passed (`biped` handed in by the
 *                                  creature door: this module never imports it back), then the lineage's LAYERS laid
 *                                  over it (UNDEAD_LAYERS: `bared` a corpse's parts gone back to bone, `decayed` gaunt flesh back on the
 *                                  bone, then `shreds` the card's clothes in rags), each on its own dice
 *
 * Pure and deterministic: its dice are the sheet's seed.
 */
import { UNDEAD_CARDS, UNDEAD_FORMS, UNDEAD_LAYERS } from './cards.js';
import { shreds } from './shreds.js';
import { decay } from './decay.js';
import { bared } from './bared.js';
import { fleshPasses, bonePasses, posture, poseArms } from './passes.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

export { UNDEAD_CARDS, UNDEAD_FORMS, UNDEAD_LAYERS };

/** the head each form wears (creature-heads/derive.js) */
export const UNDEAD_HEADS = Object.freeze({ zombie: 'gaunt', skeleton: 'skull' });

export function variantOf(form, build) {
  const F = UNDEAD_FORMS[form];
  if (!F) throw new Error(`undead: no form '${form}' (forms: ${Object.keys(UNDEAD_FORMS).join(', ')})`);
  return F.variants.find((id) => UNDEAD_CARDS[id].build === build) ?? F.variants.find((id) => UNDEAD_CARDS[id].build === 'canonical');
}

export function undeadBody(form, { build = 'canonical', pole = 'male', k, g, chest, hips, seed = 1, biped, layers = [] }) {
  for (const l of layers) if (!UNDEAD_LAYERS[l]) throw new Error(`undead: no layer '${l}' (layers: ${Object.keys(UNDEAD_LAYERS).join(', ')})`);
  const id = variantOf(form, build), card = UNDEAD_CARDS[id], rand = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  // (a skeleton's hands: four fingers, no claws; a zombie's the same)
  const base = biped({ k, g, legs: 'plantigrade', fingers: 4, pole, build });
  const out = card.form === 'bone' ? bonePasses(base, card, { k, g, chest, hips, rand }) : fleshPasses(base, card, { k, g, rand });
  // (the arms built where the rest holds them: ./passes.js poseArms)
  const P = poseArms(out.body, posture(card, rand));
  // the layers, over the posed body (a sleeve's rags hang from the arm where it is held), each on its own stream so a
  // layer never moves the form's own rolls
  const frameParts = [...(out.frameParts ?? [])];
  // (bone bared on a gaunt corpse: over flesh only; its skull, when it bares one, is the head)
  let skull = out.skull ?? null;
  if (layers.includes('bared')) {
    if (card.form !== 'flesh') throw new Error(`undead: the bared layer lies over flesh (the ${form} is already bone)`);
    const D = bared(out.body, card.bared ?? { count: [1, 2], parts: ['foreArm', 'ribs', 'shin', 'skull'] }, { k, g, rand: mulberry32((seed >>> 0) ^ 0x165667b1), lost: out.lost });
    Object.assign(out.body.joints, D.joints); out.body.segments.push(...D.segments); frameParts.push(...D.lean);
    // (a skull hangs from its base, not from a face built out from the nape: the card's drop would swing it into the
    // chest, so a bared skull hangs a third as far, its tilt kept)
    if (D.skull) { skull = D.skull; const h = P.head, n = Math.hypot(h.x, h.y, h.z * 0.3) || 1; P.head = { x: Math.round((h.x / n) * 1000) / 1000, y: Math.round((h.y / n) * 1000) / 1000, z: Math.round(((h.z * 0.3) / n) * 1000) / 1000 }; }
    out.bared = D.replaced;
  }
  // (the flesh first, so the rags hang clear of it)
  if (layers.includes('decayed')) {
    if (card.form !== 'bone') throw new Error(`undead: the decayed layer lies over bone (the ${form} keeps its own flesh)`);
    const D = decay(out.body, card.decay ?? { open: 0.5, limbs: 0.6, neck: 0.6, scalp: 0.5 }, { k, g, s: card.bones?.shaft ?? 1, skull: out.skull, lost: out.lost, rand: mulberry32((seed >>> 0) ^ 0x27d4eb2f) });
    Object.assign(out.body.joints, D.joints); out.body.segments.push(...D.segments); frameParts.push(...D.lean);
  }
  if (layers.includes('shreds')) {
    const W = shreds(out.body, card.shreds ?? { chest: 0.5, back: 0.5, hips: 0.6, arms: 0.4, length: 1 }, { k, rand: mulberry32((seed >>> 0) ^ 0x5bd1e995) });
    out.body.segments.push(...W.segments); frameParts.push(...W.chest, ...W.arms);
  }
  // (a skeleton's skull is its own bones, ./skull.js: it wears no head card)
  return { id, card, body: out.body, lost: out.lost ?? null, frameParts, posture: P, head: skull ? null : UNDEAD_HEADS[form], skull, layers: [...layers], ...(out.bared ? { bared: out.bared } : {}) };
}
