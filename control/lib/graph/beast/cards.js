/**
 * THE BEAST-KIN'S CARDS: a non-human people (the egocube's lineages below the hero door: egocube/ancestry.js) as words over
 * the tiered body, the way an undead card is (undead/cards.js). A card names no geometry; ./tiered.js reads its words on
 * the hero's own parts:
 *
 *   reads     what the kin reads as, said plainly
 *   fingers   the fingers a hand keeps, the thumb among them (3: the thumb and two; 4: the thumb and three; 5: a person's)
 *   tail      the tail it carries (the creature biped's TAILS: thin, thick, brush, stub; or none)
 *   toes      the toes a foot keeps (a plantigrade foot its big toe among them; a digitigrade paw the middle ones)
 *   claws     'none' | 'blunt' | 'long': a hooked claw out of each digit's tip
 *   mass      each part family's girth against the person's (1 the hero's): `trunk` the chest and the hips, `waist` the
 *             trunk at the waist on top of it (over 1 a barrel, under 1 a wasp's waist), `neck`, `upperArm`, `foreArm`,
 *             `hand` (the palm and the digits), `thigh`, `shank`, `foot`, and `hips` (the pelvis and the belly over it, an insect's
 *             abdomen, fading out up to the waist)
 *   frame     its proportions, as the hero's tune words (shoulders, depth, legs, neck, waist, hips …: tune ratios of the
 *             cast), recorded under the operator's own (./tiered.js beastWords) and multiplied over the rolled build's
 *   keel      the chest's front swelling forward under the shoulders, 0 … 1 (its back held): a bird's keel, a deep-chested
 *             runner's brisket
 *   hump      the upper back's own mass, 0 … 1: the back of the trunk under the neck swelling out behind (the front held)
 *             and the slope to the neck filling (a bear's hump, the meat under a wolf's ruff)
 *   rest      how it stands, in the hero's pose words: `hunch` (degrees the trunk hinges forward over the hips), `crouch`
 *             (the knees given, 0 … 1), `arm` (the right arm's way down from the shoulder, the left mirrored)
 *   claw      the claws' tone
 *   ridge     'spines' when it carries a crest of spines down the back and the tail (./detail.js)
 *   ruff      'ruff' when heavy tufts hang round its neck's root (./detail.js)
 *   abdomen   'gaster' when an insect's abdomen rides where a tail would (./topology.js)
 *   legs      the kin's own legs where they are not the hero's word: 'serpent', a coil in place of the legs (./serpent.js)
 *   hair      true when its head keeps a person's hair (a lamia's; every other kin is bald under its coat)
 *   coat      the groups its coat colours and its cover covers, where not the whole bare body (a lamia's: the coil and
 *             the hips over it; its torso a person's skin)
 *
 * Each kin is a silhouette of its own, so a cast of them is not one lean figure in six coats: the bear the heavyweight
 * (a barrel and a hump, short legs), the dragon the hulking V (broad and deep, thick haunches), the wolf the brawler (an
 * inverted triangle, a narrow waist), the cat the athlete (the one lean kin, strong haunches), the bird top-heavy on its
 * keel, the insect segmented (a broad thorax, a wasp's waist, full hips). The rolled build varies it within the kin.
 *
 * The legs are not a kin's: a lineage stands digitigrade or not by how far from a person a sheet rolled it (its humanity),
 * so they are the hero's own word (`beast.legs`). Every number is a first reading the character loop iterates.
 */
import { LINEAGES } from '../egocube/ancestry.js';

export const BEAST_LEGS = Object.freeze(['plantigrade', 'digitigrade', 'serpent']);
export const BEAST_CLAWS = Object.freeze(['none', 'blunt', 'long']);
export const BEAST_FINGERS = Object.freeze([3, 4, 5]);
export const BEAST_TOES = Object.freeze([3, 4, 5]);

const MAMMAL_CLAW = '#3a3430', HORN_CLAW = '#e6dfcc';

export const BEAST_KINS = Object.freeze({
  ursine: {
    reads: 'bear-kin: a barrel of a trunk on round shoulders, a hump behind the neck, a neck as thick as the head, heavy forearms and paws, short legs, the weight carried low',
    fingers: 4, toes: 5, tail: 'stub', claws: 'blunt', claw: MAMMAL_CLAW,
    frame: { shoulders: 1.06, depth: 1.15, legs: 0.92, neck: 0.8 },
    mass: { trunk: 1.18, waist: 1.25, hips: 1.05, neck: 1.6, upperArm: 1.25, foreArm: 1.3, hand: 1.3, thigh: 1.25, shank: 1.2, foot: 1.2 }, hump: 0.5,
    rest: { hunch: 12, crouch: 0.1, arm: { x: 0.22, y: 0.22, z: -0.95 } },
  },
  lupine: {
    reads: 'wolf-kin: the brawler, broad shoulders and a deep chest over a narrow waist, a thick neck under its ruff, heavy haunches, the trunk leaning forward',
    fingers: 4, toes: 4, tail: 'brush', claws: 'blunt', claw: MAMMAL_CLAW, ruff: 'ruff',
    frame: { shoulders: 1.1, depth: 1.1, waist: 0.92, hips: 0.94 },
    mass: { trunk: 1.1, waist: 0.86, neck: 1.4, upperArm: 1.15, foreArm: 1.12, hand: 1.12, thigh: 1.2, shank: 1.35, foot: 1.15 }, hump: 0.3, keel: 0.25,
    rest: { hunch: 16, crouch: 0.12, arm: { x: 0.18, y: 0.28, z: -0.94 } },
  },
  feline: {
    reads: 'cat-kin: the athlete, a small waist, long limbs, strong haunches, a supple stoop',
    fingers: 4, toes: 4, tail: 'thin', claws: 'long', claw: HORN_CLAW,
    frame: { shoulders: 1.02 },
    mass: { trunk: 1.0, waist: 0.86, neck: 1.1, upperArm: 1.0, foreArm: 0.98, hand: 1.0, thigh: 1.2, shank: 1.2, foot: 1.05 }, hump: 0, keel: 0.1,
    rest: { hunch: 9, crouch: 0.14, arm: { x: 0.16, y: 0.2, z: -0.96 } },
  },
  draconic: {
    reads: 'dragon-kin: the hulking V, a broad deep trunk, a long thick neck, heavy limbs and thick haunches, three clawed fingers',
    fingers: 3, toes: 3, tail: 'thick', claws: 'long', claw: HORN_CLAW, ridge: 'spines',
    frame: { shoulders: 1.12, depth: 1.12, neck: 1.15, legs: 0.96 },
    mass: { trunk: 1.14, waist: 1.0, neck: 1.4, upperArm: 1.2, foreArm: 1.18, hand: 1.15, thigh: 1.24, shank: 1.4, foot: 1.25 }, hump: 0.2, keel: 0.2,
    rest: { hunch: 11, crouch: 0.08, arm: { x: 0.24, y: 0.2, z: -0.95 } },
  },
  avian: {
    reads: 'bird-kin: top-heavy on a deep keeled chest, a slender neck, light arms, strong thighs over thin shanks, three taloned fingers',
    fingers: 3, toes: 3, tail: 'none', claws: 'long', claw: HORN_CLAW,
    frame: { depth: 1.2, shoulders: 1.04, waist: 0.9, hips: 0.9 },
    mass: { trunk: 1.05, waist: 0.82, neck: 0.9, upperArm: 0.95, foreArm: 0.88, hand: 0.9, thigh: 1.2, shank: 0.95, foot: 0.95 }, hump: 0, keel: 0.8,
    rest: { hunch: 7, crouch: 0.1, arm: { x: 0.14, y: 0.16, z: -0.97 } },
  },
  serpentine: {
    reads: 'snake-kin (lamia): a person\'s torso, arms and head carried upright on a serpent\'s coil, the scales starting at the hips, slim through the waist',
    fingers: 5, toes: 5, tail: 'none', claws: 'none', claw: HORN_CLAW, legs: 'serpent', hair: true, coat: Object.freeze(['Coil', 'Bottom']),
    frame: { waist: 0.94 },
    mass: { trunk: 1.0, waist: 0.9, neck: 1.0, upperArm: 1.0, foreArm: 1.0, hand: 1.0, thigh: 1, shank: 1, foot: 1 }, hump: 0, keel: 0,
    rest: { hunch: 4, crouch: 0, arm: { x: 0.18, y: 0.18, z: -0.96 } },
  },
  insectoid: {
    reads: 'insect-kin: segmented, a broad plated thorax, a wasp\'s waist, full hips, thin hard limbs, three fingers',
    fingers: 3, toes: 3, tail: 'none', abdomen: 'gaster', claws: 'none', claw: MAMMAL_CLAW,
    frame: { shoulders: 1.14, depth: 1.12, hips: 1.1 },
    mass: { trunk: 1.08, waist: 0.6, hips: 1.14, neck: 0.8, upperArm: 0.85, foreArm: 0.82, hand: 0.88, thigh: 0.95, shank: 0.85, foot: 0.9 }, hump: 0, keel: 0.35,
    rest: { hunch: 6, crouch: 0.1, arm: { x: 0.2, y: 0.24, z: -0.95 } },
  },
});
export const BEAST_KIN_IDS = Object.freeze(Object.keys(BEAST_KINS));

/** the kin's coat when the hero names no skin: its lineage's first swatch (egocube/ancestry.js `cover`) */
export const kinCoat = (kin) => Object.values(LINEAGES[kin]?.cover ?? {})[0] ?? '#8a7a6a';
