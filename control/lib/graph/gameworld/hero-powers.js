/**
 * HERO POWERS IN THE ROUND — the superhero beat-em-up's powers (brawl/brawl-powers.js POWERS: a beam, a ball of force, a
 * barrage, a flame, each a card) lowered onto the open world's runtime, so a hero in a city fires the power the street's
 * hero fires. The card stays the truth of what a power IS (its look, its uses, its joules); this says how the round
 * runtime's one RANGE slot plays it (worlds/controllable/combat-ranged.js: a magazine, a rate, a hitscan or a lob).
 *
 *   A power's USES are its card's `stock`: the slot's magazine. Spent, it RECHARGES (the slot's reload, `recharge`
 *   seconds) instead of waiting for a fall, as a street's stock does: an open city has no lives to fill it.
 *   Its LOOK is the beam its card names (playscape/elements/beams.js BEAMS): the round's tint is that beam's colour.
 *   Its ENERGY is its card's `knock` (rupa's knockback, worlds/controllable/knock.js): joules on what it strikes or where it
 *   lands, so a grunt flies and a heavy staggers, as on the street.
 *
 *   CITY_POWERS[id] = { read, play, recharge }   what the round slot does with the card (the rest is the card's): `play`
 *                     the sidearm's own words (combos.js readSidearm: an `auto` held at its rate, a hitscan; a `draw`
 *                     raised and loosed, a round that flies and bursts, `splash`), `perUse` an auto's rounds a use;
 *                     `recharge` the seconds a use comes back in (an auto's magazine reloaded whole; a draw's one round
 *                     nocked again, its uses spread over the same time)
 *   powerSidearm(id)  → the RANGE slot's sidearm for the power (an arsenal's `ranged` entry, in the sidearm's words:
 *                     `colour` its beam's, `knock` its card's)
 *   POWER_IDS         the powers a city hero may carry (the ones the round runtime plays; the street's others are close or
 *                     all-round moves its belt plays and the round slot has no word for: storm, frenzy, phase, might,
 *                     gale, wall)
 *
 * Damage is in a foe's hit points (a city crew's grunt holds 5): a beam downs a grunt in two, the ball of force in one.
 * Pure, no dice.
 */
import { POWERS } from '../brawl/brawl-powers.js';
import { BEAMS } from '../playscape/elements/beams.js';

export const CITY_POWERS = Object.freeze({
  // there at once down the line (a hitscan), three uses
  beam: Object.freeze({ read: 'a beam from the eyes or the hands, there at once down the line', play: Object.freeze({ mode: 'auto', rof: 2, damage: 3, range: 45 }), recharge: 9 }),
  // raised (held, it gathers) and sent slowly: it bursts where it meets something, flooring all near it
  nova: Object.freeze({ read: 'a great ball of force raised and sent slowly: it bursts where it lands and floors all round it', play: Object.freeze({ mode: 'draw', draw: 0.6, speed: 16, drop: 0, damage: 5, impact: 40, splash: 3.5 }), recharge: 10 }),
  // a quick stream of darts, four throws of a few darts each
  barrage: Object.freeze({ read: 'a fistful of charged darts: quick, a few at a throw', play: Object.freeze({ mode: 'auto', rof: 8, damage: 0.7, range: 30, perUse: 4 }), recharge: 8 }),
  // short and hot, three gouts of a few licks each
  flame: Object.freeze({ read: 'a gout of fire from the hand: short, through the first in its way', play: Object.freeze({ mode: 'auto', rof: 6, damage: 1.2, range: 9, perUse: 5 }), recharge: 10 }),
});
export const POWER_IDS = Object.freeze(Object.keys(CITY_POWERS));

// a beam's colour (0..1 a channel) as the renderer's tint, an integer 0xRRGGBB
const hexOf = (c) => c.reduce((n, v) => n * 256 + Math.max(0, Math.min(255, Math.round(v * 255))), 0);

/** The RANGE slot's sidearm for a power: its card's uses as the magazine, recharged; its beam's colour; its joules. */
export function powerSidearm(id) {
  const C = CITY_POWERS[id], card = POWERS[id];
  if (!C || !card) throw new Error(`a hero's power is one of ${POWER_IDS.join(', ')} (the street's powers the open city plays), not '${id}'`);
  const { perUse = 1, ...play } = C.play, beam = BEAMS[card.beam];
  const uses = play.mode === 'draw' ? { nock: Math.round((C.recharge / card.stock) * 100) / 100 } : { magazine: card.stock * perUse, reload: C.recharge };
  return {
    id: `power-${id}`, name: id[0].toUpperCase() + id.slice(1), ...play, ...uses, hand: 'right',
    ...(beam && Array.isArray(beam.color) ? { colour: hexOf(beam.color) } : {}),
    ...(card.knock ? { knock: { ...card.knock } } : {}),
  };
}
