/**
 * versus sfx — THE FIGHT'S SOUNDS, from the SFX shelf (sfx-shelf/, docs/sfx-shelf.md): what a blow, a block, a throw and
 * a knockout sound like, each cue built from the shelf's families at their dials (never written here), so a fight hears
 * the library every game hears. Pure.
 *
 *   FIGHT_SFX                 cue id → its layers, each [family, dials] (two layers sound as one: a punch over the
 *                             flesh it lands on)
 *   fightCues()               → { <cue id>: gestures } (beats-sfx cues: the page's audio channel plays them)
 *   FIGHT_MIX                 the fight's SFX bus: one room, a voice cap, no distance (the camera frames both)
 *   fightAudio({ register })  → a world's `audio` spec (beats-world.js resolveWorldAudio) carrying the cues and the mix,
 *                               or null: a fight sounds its blows from the library under a fight game's register (an
 *                               arena made before the register keeps its own beeps, every byte)
 *
 * Which cue a fight's event plays (its blow's weight, its limb, a counter, a spark) is the runtime's
 * (versus-runtime.client.js fightCue), so the sim's events stay the sim's.
 */
import { familyCue } from '../sfx-shelf/families.js';

const L = (family, dials) => [family, dials];
export const FIGHT_SFX = Object.freeze({
  // a fist (an elbow, a head): a jab, a body blow over its flesh, a haymaker
  'hit-light': [L('melee', { act: 'punch' })],
  'hit-medium': [L('melee', { act: 'punch' }), L('impact', { material: 'flesh', weight: 'medium' })],
  'hit-heavy': [L('brawl', { act: 'uppercut' }), L('impact', { material: 'flesh', weight: 'heavy' })],
  // a foot (a knee)
  'kick-light': [L('melee', { act: 'kick' })],
  'kick-heavy': [L('melee', { act: 'kick' }), L('impact', { material: 'flesh', weight: 'heavy' })],
  // a blade, and a shot that lands
  'blade-light': [L('melee', { act: 'blade-hit' })],
  'blade-heavy': [L('melee', { act: 'blade-hit' }), L('impact', { material: 'flesh', weight: 'heavy' })],
  'shot-hit': [L('impact', { material: 'energy', weight: 'medium' })],
  // what a hit says more: a counter, a spark (the black flash), a heavy blow's body slammed to the floor
  counter: [L('brawl', { act: 'counter' })],
  spark: [L('brawl', { act: 'counter' }), L('impact', { material: 'energy', weight: 'heavy' })],
  land: [L('impact', { material: 'dirt', weight: 'heavy' })],
  // the guard: a block, two blows or blades meeting, a guard crushed
  block: [L('melee', { act: 'block' })],
  clash: [L('melee', { act: 'clash' })],
  crush: [L('shield', { act: 'break' })],
  // the grapple: a grab caught or broken, a throw slammed down
  grab: [L('brawl', { act: 'grab' })],
  throw: [L('brawl', { act: 'body-slam' })],
  // the meter's: a burst, a super, a projectile thrown
  burst: [L('explosion', { size: 'small', debris: false, metal: false })],
  super: [L('launch', { power: 'full' })],
  fireball: [L('elemental', { element: 'fire' })],
  // the end
  ko: [L('brawl', { act: 'knockout' })],
});

/** The cues, each its layers' gestures in order (built once: the families are deterministic for their dials). */
let CUES = null;
export function fightCues() {
  if (CUES) return CUES;
  CUES = Object.fromEntries(Object.entries(FIGHT_SFX).map(([id, layers]) => [id, layers.flatMap(([family, dials]) => familyCue(family, dials))]));
  return CUES;
}

/** The fight's SFX bus: a hall's room (the blows ring in it a little), at most 10 at once, every cue as near as the fight */
export const FIGHT_MIX = Object.freeze({ space: 'interior', voices: 10, distance: false });

/** A world's audio spec for a fight under its register: the library's cues on the fight's bus, each hit its own variant. */
export function fightAudio({ register = null } = {}) {
  if (register !== 'anime' && register !== 'western') return null;
  return { sfx: { cues: fightCues(), vary: true, mix: { ...FIGHT_MIX } } };
}
