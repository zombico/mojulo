/**
 * THE SABER (a feel card's `blade: { kit: 'saber' }`: Galaxy Boy's feel's `saber` variant, cards.js; Zero Boy's,
 * gameworld/herobots.js): a run and gun's saber in place of the buster, after the later 3D games' saber heroes: a
 * THREE-HIT STRING on the fire press that does not move the body (every cut's travel `none`), the last the hardest and
 * the widest, on the buster's DAMAGE SCALE (lower.js BUSTER_DAMAGE of a blow: the tap 10, the first charge 20, the full
 * charge 50), never the arsenal's (arsenal.js renumbers a world's foes in strings; this game's foes stay counted in its
 * buster's shots).
 *
 *   the CUTS     a light cut, a second the other way, a finisher: each a swing the hero's held blade is baked with
 *                (combos.js SWINGS: neutral the overhead cross, left the rising cut, back the two-handed cleave), its
 *                frames at 60 fps, its cancel the frame the next press chains in, travel none; its PLANT the feet's
 *                split as the body swings into it (one leg forward, one back, the body still: combos.js `plant`), held
 *                from cut to cut, the finisher's the widest
 *   the BLADE    its reach (the arm and the blade), its cone, its colour (the slash's and its light's)
 *
 *   SABER_STRIKE   the blade's numbers: damage (a cut's, × the move's), reach, cone, colour
 *   SABER_COMBOS   the string as a combo manifest (combos.js readCombos)
 *   saberRule()    → the platform rule's strike: { strike: 'melee', strikeContact, strikeDamage, strikeReach, strikeCone,
 *                  strikeFx, moveset }
 *
 * Pure.
 */
import { lowerCombos, readCombos } from '../combos.js';

// a cut's damage: three quarters of a blow (15: a tap and a half), the finisher twice it (30); the string 60, a little
// over a full charge (50), for standing in reach and in place to deal it
export const SABER_STRIKE = Object.freeze({ damage: 15, reach: 1.9, cone: 80, color: 0x7dfff0, contact: Object.freeze([0.3, 0.62]) });

export const SABER_COMBOS = Object.freeze({
  timing: { buffer: 14, late: 12, pause: [16, 50], blend: 3, rest: 18 },
  moves: {
    'saber-1': { swing: 'neutral', role: 'opener', frames: 18, cancel: 11, travel: { kind: 'none' }, plant: 0.5, damage: 1 },
    'saber-2': { swing: 'left', role: 'filler', frames: 18, cancel: 11, travel: { kind: 'none' }, plant: 0.5, damage: 1 },
    'saber-3': { swing: 'back', role: 'finisher', frames: 30, travel: { kind: 'none' }, plant: 0.6, damage: 2, impact: 2 },
  },
  combos: [{ id: 'three-cuts', name: 'Three cuts', beats: ['L', 'L', 'L'], moves: ['saber-1', 'saber-2', 'saber-3'] }],
});

/** The platform rule's strike for the saber: the string on the fire press, in place. */
export function saberRule() {
  readCombos(SABER_COMBOS);
  const S = SABER_STRIKE;
  return { strike: 'melee', strikeContact: [...S.contact], strikeDamage: S.damage, strikeReach: S.reach, strikeCone: S.cone, strikeFx: { color: S.color, scale: 1 }, moveset: lowerCombos(SABER_COMBOS) };
}
