/**
 * boat-looks — a boat's look as a card, never a second hull: the same boat reads as a pleasure boat or a naval one by
 * the card it wears, the drones' way (drone-looks.js, whose lookCard reads these too). A card says:
 *   palette   the colours its parts take (a craft palette, craft-common.js), or none: the boat's own
 *   slots     the material slots its painted parts are drawn in (craft-form.js)
 *   lights    'nav' (its sidelights and all-round light lit) | 'covert' (dark: darkened ship)
 *   payloads  (a drone's; a boat's none)
 *   livery    the livery it wears when none is named (air-surface.js): a pleasure boat's registration on its bows; a
 *             naval boat's low-visibility number on its bows and its emblem amidships
 *
 * A boat asked for another look takes that card's palette and lights, and its livery unless one is named; its hull, its
 * drive and its fittings stay as they are. Pure.
 */

export const BOAT_LOOKS = Object.freeze({
  pleasure: Object.freeze({
    reads: 'a pleasure boat: its own colours, its lights lit, its registration on its bows',
    palette: null, slots: {}, lights: 'nav', payloads: {},
    livery: { pattern: 'mono', marks: { style: 'civil' } },
  }),
  naval: Object.freeze({
    reads: 'a naval boat: haze grey, darkened (its lights out), a low-visibility number on its bows, an emblem amidships',
    palette: 'navalHaze', slots: {}, lights: 'covert', payloads: {},
    livery: { pattern: 'mono', marks: { style: 'military', emblem: 'bar', warnings: false } },
  }),
});
export const BOAT_LOOK_IDS = Object.freeze(Object.keys(BOAT_LOOKS));
