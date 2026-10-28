/**
 * THE BEAST-KIN'S CARDS: a non-human people (the egocube's lineages below the hero door: egocube/ancestry.js) as words over
 * the tiered body, the way an undead card is (undead/cards.js). A card names no geometry; ./tiered.js reads its words on
 * the hero's own parts:
 *
 *   reads     what the kin reads as, said plainly
 *   fingers   the fingers a hand keeps, the thumb among them (3: the thumb and two; 4: the thumb and three; 5: a person's)
 *   toes      the toes a foot keeps (a plantigrade foot its big toe among them; a digitigrade paw the middle ones)
 *   claws     'none' | 'blunt' | 'long': a hooked claw out of each digit's tip
 *   mass      each part family's girth against the person's (1 the hero's): `trunk` the chest and the hips, `waist` the
 *             trunk at the waist on top of it (over 1 a barrel, under 1 a wasp's waist), `neck`, `upperArm`, `foreArm`,
 *             `hand` (the palm and the digits), `thigh`, `shank`, `foot`
 *   rest      how it stands, in the hero's pose words: `hunch` (degrees the trunk hinges forward over the hips), `crouch`
 *             (the knees given, 0 … 1), `arm` (the right arm's way down from the shoulder, the left mirrored)
 *   claw      the claws' tone
 *
 * The legs are not a kin's: a lineage stands digitigrade or not by how far from a person a sheet rolled it (its humanity),
 * so they are the hero's own word (`beast.legs`). Every number is a first reading the character loop iterates.
 */
import { LINEAGES } from '../egocube/ancestry.js';

export const BEAST_LEGS = Object.freeze(['plantigrade', 'digitigrade']);
export const BEAST_CLAWS = Object.freeze(['none', 'blunt', 'long']);
export const BEAST_FINGERS = Object.freeze([3, 4, 5]);
export const BEAST_TOES = Object.freeze([3, 4, 5]);

const MAMMAL_CLAW = '#3a3430', HORN_CLAW = '#e6dfcc';

export const BEAST_KINS = Object.freeze({
  ursine: {
    reads: 'bear-kin: a barrel of a trunk on round shoulders, a neck as thick as the head, heavy forearms and paws, the weight carried low',
    fingers: 4, toes: 5, claws: 'blunt', claw: MAMMAL_CLAW,
    mass: { trunk: 1.12, waist: 1.12, neck: 1.5, upperArm: 1.15, foreArm: 1.22, hand: 1.22, thigh: 1.12, shank: 1.1, foot: 1.15 },
    rest: { hunch: 12, crouch: 0.1, arm: { x: 0.22, y: 0.22, z: -0.95 } },
  },
  lupine: {
    reads: 'wolf-kin: a deep chest over a narrow waist, a thick neck under its ruff, long sinewy arms, the trunk leaning forward',
    fingers: 4, toes: 4, claws: 'blunt', claw: MAMMAL_CLAW,
    mass: { trunk: 1.04, waist: 0.88, neck: 1.3, upperArm: 1.05, foreArm: 1.02, hand: 1.08, thigh: 1.06, shank: 0.96, foot: 1.0 },
    rest: { hunch: 16, crouch: 0.12, arm: { x: 0.18, y: 0.28, z: -0.94 } },
  },
  feline: {
    reads: 'cat-kin: lithe, a small waist, long light limbs, a supple stoop',
    fingers: 4, toes: 4, claws: 'long', claw: HORN_CLAW,
    mass: { trunk: 0.94, waist: 0.86, neck: 1.05, upperArm: 0.92, foreArm: 0.92, hand: 0.98, thigh: 0.98, shank: 0.9, foot: 0.95 },
    rest: { hunch: 9, crouch: 0.14, arm: { x: 0.16, y: 0.2, z: -0.96 } },
  },
  draconic: {
    reads: 'dragon-kin: a hulking trunk, a long thick neck, heavy limbs, three clawed fingers',
    fingers: 3, toes: 3, claws: 'long', claw: HORN_CLAW,
    mass: { trunk: 1.1, waist: 1.04, neck: 1.35, upperArm: 1.1, foreArm: 1.1, hand: 1.1, thigh: 1.14, shank: 1.08, foot: 1.12 },
    rest: { hunch: 11, crouch: 0.08, arm: { x: 0.24, y: 0.2, z: -0.95 } },
  },
  avian: {
    reads: 'bird-kin: a keeled chest on a light frame, a slender neck, thin arms and legs, three taloned fingers',
    fingers: 3, toes: 3, claws: 'long', claw: HORN_CLAW,
    mass: { trunk: 0.98, waist: 0.84, neck: 0.85, upperArm: 0.84, foreArm: 0.8, hand: 0.9, thigh: 0.92, shank: 0.78, foot: 0.9 },
    rest: { hunch: 7, crouch: 0.1, arm: { x: 0.14, y: 0.16, z: -0.97 } },
  },
  insectoid: {
    reads: 'insect-kin: plated and narrow, a wasp\'s waist, thin hard limbs, three fingers',
    fingers: 3, toes: 3, claws: 'none', claw: MAMMAL_CLAW,
    mass: { trunk: 0.92, waist: 0.7, neck: 0.78, upperArm: 0.72, foreArm: 0.7, hand: 0.86, thigh: 0.8, shank: 0.72, foot: 0.9 },
    rest: { hunch: 6, crouch: 0.1, arm: { x: 0.2, y: 0.24, z: -0.95 } },
  },
});
export const BEAST_KIN_IDS = Object.freeze(Object.keys(BEAST_KINS));

/** the kin's coat when the hero names no skin: its lineage's first swatch (egocube/ancestry.js `cover`) */
export const kinCoat = (kin) => Object.values(LINEAGES[kin]?.cover ?? {})[0] ?? '#8a7a6a';
