/**
 * VAMPIRE SONATA — the metroidvania rail's template: storm the castle. A hunter crosses the drawbridge on the castle's
 * left and walks it as a spiral (box.js), wall by wall, to the keep at its heart. A homage to the idiom, nothing taken
 * but its principles: the castle's places, its bosses and its powers are the house's own.
 *
 *   the outer wall    the ramparts walked round: a key found at the far corner opens the top's locked door; the Gate
 *                     Warden, in the last corner, falls and gives the second leap; the step in is a sill a double
 *                     jump reaches
 *   the great halls   the ram strike in the relic room at the far top corner; the step in a cracked wall; its floor
 *                     drops out to the outer wall's, its top climbs back out through a cracked hatch
 *   the inner ward    the Bellkeeper in the last corner gives the mist veil; the step in a grate the mist passes
 *   the keep          the antechamber and the throne, the Lord of the Keep in it
 *
 * Pockets in the outer rings hold what a later power reaches, so every power sends the hunter back as well as on: the
 * outer wall's high shelf (the second leap), its cracked alcove and its grate, the halls' grate. No stomp, no wall kick
 * (gates.js REFUSED_MOVES): every climb is ledges a jump apart.
 *
 *   vampireSonata({ box?, turn? }) → the map's words (box.js readBox's), the castle at 12 × 8 screens unless said
 *   VAMPIRE_SONATA_PREMISE, VAMPIRE_SONATA_POWERS
 *
 * Pure: words in, words out.
 */
export const VAMPIRE_SONATA_PREMISE = 'A hunter storms the vampire lord\'s castle, wall by wall, to the keep at its heart';
export const VAMPIRE_SONATA_POWERS = Object.freeze({
  'second-leap': Object.freeze({ opens: 'double-jump', name: 'the second leap' }),
  'ram-strike': Object.freeze({ opens: 'wall-break', name: 'the ram strike' }),
  'mist-veil': Object.freeze({ opens: 'form', name: 'the mist veil' }),
});

/** The castle as the map's words. */
export function vampireSonata({ box = [12, 8], turn = 'ccw' } = {}) {
  return {
    premise: VAMPIRE_SONATA_PREMISE,
    box: [...box],
    turn,
    powers: structuredClone({ ...VAMPIRE_SONATA_POWERS }),
    rings: [
      { id: 'outer-wall', place: 'the outer wall', key: true, boss: 'the Gate Warden', finds: 'second-leap', inward: 'double-jump',
        pockets: [{ gate: 'double-jump', holds: 'a heart vessel' }, { gate: 'wall-break', holds: 'a relic' }, { gate: 'form', holds: 'a heart vessel' }] },
      { id: 'great-halls', place: 'the great halls', finds: 'ram-strike', inward: 'wall-break', pockets: [{ gate: 'form', holds: 'a heart vessel' }] },
      { id: 'inner-ward', place: 'the inner ward', boss: 'the Bellkeeper', finds: 'mist-veil', inward: 'form' },
      { id: 'keep', place: 'the keep', boss: 'the Lord of the Keep' },
    ],
  };
}
