// THE MASCOT READING: the mascot laws (docs/mascot.md) and the animal-mascot principles (docs/mascot-animals.md) laid
// over a real species as an ooze, on its own body. `create_character({ as: 'mascot' })` stands an animal up into a
// biped; this keeps its stance, limbs and rig (the quadruped mascot: a plush, a toy, a game's critter) and reads every
// other law onto it, from the species' family card (egocube/mascot-animals.js), so each animal is made a mascot by
// what names it:
//
//   law 3   head-heavy: the head grown by the card's form (orb, sprout, toon), the trunk rounder, the neck thick
//   law 4   the eyes carry it: big, open, a white round a big iris; the brow (a slant reads as a frown) and every
//           other feature reduced; a happy rest face
//   A4      the face shortened by its muzzle's kind (a point, a bulb, a button), a muzzle that is the name kept long
//   A1      its identifiers drawn big (the ears, the tail), an outline feature past the budget let go (smaller)
//   laws 6, A7   thick limbs weighted by the family's mass, big paws
//   laws 7, A6   the coat's own zones pushed to a mascot's saturation (a grey one keeps its values; a tiger's stripes,
//           its coat shell, stay)
//   law 8   nothing on the surface: no fur cards, a soft satin skin
//   Ad1–Ad6 one signature piece, said by the folk promise, in the colour across the wheel from its coat, a gold shine
//
// `mascotFor(id)` → `{ form, push, note }` for a species (null for anything else: the row's own form and push stand).
// The ooze row is data; resolveMutagen calls the reader its `base` names with the base it is laid on. Pure.
import { SPECIES, speciesParams } from '../fauna/species.js';
import { animalCard } from '../egocube/mascot-animals.js';

/** Ad5: the piece that says each promise, on a body that keeps its four legs (a champion's belt is a studded collar). */
export const MASCOT_PIECES = Object.freeze({ comfort: 'bell', speed: 'scarf', cheer: 'bow', mischief: 'bandana', pride: 'medal', might: 'studs', wonder: 'pack' });
/** Law 3 by the card's form: the orb's head is most of it, the toon's least. */
const HEAD = Object.freeze({ orb: 2.4, sprout: 2.2, toon: 1.9 });
/** Law 4: the eye's radius a tenth of the head's length (its height a third of the head's): grown to it, never shrunk. */
const EYE_SHARE = 0.1;
/** A4: a muzzle's length by its kind; a muzzle that is the name (a trunk, a crocodile's jaw, a bill) keeps most of it. */
const MUZZLE = Object.freeze({ trunk: 0.9, long: 0.85, bill: 0.8, beak: 0.8, point: 0.55, round: 0.45, wide: 0.5, disc: 0.35, button: 0.3 });
const EARS = Object.freeze({ tall: 1.5, pointed: 1.3, tufts: 1.3, flap: 1.2, round: 0.9 });
const r3 = (x) => +x.toFixed(3);

export function mascotFor(id, row) {
  if (!Object.hasOwn(SPECIES, id)) return null;
  const card = animalCard(id), kit = card.kit, kept = new Set(card.identity), piece = MASCOT_PIECES[card.promise] ?? 'bow';
  const form = { ...row.form, headScale: HEAD[card.form] ?? row.form.headScale, legBulk: r3(row.form.legBulk * Math.sqrt(card.limbs)) };
  if (kept.has('tail')) form.tailBush = kit.tail === 'pom' ? 1.5 : 1.3;
  const push = structuredClone(row.push);
  push.head.muzzle.length = MUZZLE[kit.muzzle] ?? push.head.muzzle.length;
  // the eye grown to law 4's share of the head (a prey animal's big eye a little, a bear's small one a lot)
  const P = speciesParams(id), L = P.craniumCaps ? P.craniumCaps.tip[1] - P.craniumCaps.back[1] : 0;
  if (L > 0 && P.eyeR) push.head.eye = r3(Math.min(3, Math.max(1.3, (EYE_SHARE * L) / P.eyeR)));
  // an ear that names the animal is drawn big; an ear past the budget is let go: smaller, still there
  if (kept.has('ears')) push.ears = { height: EARS[kit.ears] ?? 1.3 };
  else if (card.dropped.includes('ears')) push.ears = { height: 0.7 };
  if (card.extremities === 'nubs') push.limbs = { ...push.limbs, paws: 1.2 };
  push.piece = { ...push.piece, kind: piece };
  const name = SPECIES[id].name?.replace(/^an? /, '') ?? id;
  const note = `mascot: the folk ${name} (${card.crafted ? 'a crafted card' : `${card.family}: ${card.folk}`}) promises ${card.promise}, said by a ${piece}; `
    + `drawn big: ${card.identity.join(', ') || 'no outline feature (the face and the coat name it)'}${card.dropped.length ? `; let go: ${card.dropped.join(', ')}` : ''}`;
  return { form, push, note };
}
