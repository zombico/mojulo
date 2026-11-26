/**
 * THE STRIKE ZONE — where on the hero a foe's blow goes, by how tall it stands against the hero. A blow is thrown AT
 * something: a foe a head shorter than the hero does not chop at the air over its own head, it goes for the legs; one
 * its height goes for the body; one a head taller brings it down from above. The zone says three things a card's swing
 * is fitted by (foes/attacks.js; the bake, worlds/world-kinds.js; the audit, gameworld/foe-audit.js):
 *
 *   band     the share of the hero's height the weapon must pass through while it can hit (`foe-zone`, the audit's law,
 *            reads the weapon's measured path against it: figures/clip-reach.js)
 *   words    the swing each of the runtime's swing directions plays (worlds/controllable/mind.js: an opener on a side,
 *            neutral, left or right, then the `back` finisher): the legs' a level cut from each side in turn, low
 *   moves    how it fights there: `combo` (the two-hit string, openers on alternate sides) and `lunge` (a step in with
 *            the blow, metres a second through the wind-up, stopping at half its reach): the low foe darts in and cuts
 *            from one side then the other, never standing still
 *
 *   STRIKE_ZONES, ZONE_IDS
 *   zoneOf(stature, hero?)          → the zone id: under `legs.under` of the hero's height, `legs`; over `high.over`, `high`;
 *                                     else `body`
 *   zoneAim(stature, hero?, zone?)  → { drop, sink, bend }: the swing aimed at its band's middle from the foe's own
 *                                     shoulder, the arm's pitch dropped by `drop` degrees through the blow, the body
 *                                     sinking `sink` and hinging `bend` more with it (polygonizer/hero-swing.js aimSwingKeys)
 *   zoneBand(zone, hero?)           → [low, high] metres on the hero
 *
 * Measured in the bodies' own heights (docs/foes.md rule 6). Pure.
 */
import { HERO } from './vocab.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export const STRIKE_ZONES = Object.freeze({
  legs: Object.freeze({ under: 0.78, band: [0.1, 0.5], reads: 'it goes for your legs, a low cut from one side then the other: jump it',
    words: Object.freeze({ neutral: 'forehand', left: 'forehand', right: 'backhand', forward: 'forehand', back: 'backhand' }),
    moves: Object.freeze({ combo: true, lunge: 2.6 }), sink: 0.14, bend: 14 }),
  body: Object.freeze({ band: [0.35, 0.85], reads: 'it swings at your body', words: null, moves: Object.freeze({ combo: false, lunge: 1.4 }), sink: 0, bend: 0 }),
  high: Object.freeze({ over: 1.25, band: [0.55, 1.05], reads: 'it brings its blow down on you from above: step out from under it',
    words: Object.freeze({ neutral: 'chop', left: 'chop', right: 'chop', forward: 'chop', back: 'cleave' }),
    moves: Object.freeze({ combo: false, lunge: 1 }), sink: 0.06, bend: 8 }),
});
export const ZONE_IDS = Object.freeze(Object.keys(STRIKE_ZONES));

export function zoneOf(stature, hero = HERO) {
  const r = stature / hero.height;
  return r < STRIKE_ZONES.legs.under ? 'legs' : r > STRIKE_ZONES.high.over ? 'high' : 'body';
}

export const zoneBand = (zone, hero = HERO) => STRIKE_ZONES[zone].band.map((b) => r3(b * hero.height));

// (a foe's proportions as shares of its height: its shoulder, and its arm with what it holds, hand to tip)
const SHOULDER = 0.8, REACH = 0.75;

export function zoneAim(stature, hero = HERO, zone = zoneOf(stature, hero)) {
  const Z = STRIKE_ZONES[zone], [lo, hi] = zoneBand(zone, hero), aim = (lo + hi) / 2;
  // (the shoulder as the body sinks into the blow; a level arm carries the weapon at it, a drop of d degrees lowers the
  // tip by the arm's reach times its sine)
  const shoulder = stature * (SHOULDER - Z.sink * 0.5), reach = stature * REACH;
  const s = Math.max(-0.9, Math.min(0.95, (shoulder - aim) / reach));
  return { drop: r3((Math.asin(s) * 180) / Math.PI), sink: Z.sink, bend: Z.bend };
}
