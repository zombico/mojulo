/**
 * XENOJAGER: the box's other pole, dangerous-planet exploration. The castle is stormed; the planet is gone DOWN into.
 * The idioms are the castle's own (box.js's spiralling box entered from the left, its rings, its gates, its pockets and
 * shortcuts, the climbs of climbs.js), drawn in a new visual library (themes.js `xeno`): rock for stone, crags for
 * parapets, cave mouths for arches, stalactites, crystals, fungi, tendrils, falls of water and of lava, the ruins of a
 * people before and the nest of the thing below. The way in is the crust under the planet's sky; the core is its magma.
 *
 *   the crust            the rim walked under a ringed planet: a key found at the far corner, the Crust Warden in the last
 *                        corner falls and gives the thruster leap; the step in a sill a double jump reaches
 *   the fungal caverns   the pulse cannon in the far corner; the step in a cracked wall its charge breaks
 *   the flooded depths   the sunken ruins, the Leviathan in the last corner gives the curl drive; the step in a crawlway
 *   the magma core       the nest, the Brood Mother in it
 *
 * THE HANDLE: there is no XenoJager game yet. These are the map's words (the box plays on the side map's runtime in
 * greybox, as the castle does), and XENOJAGER_HANDLE says what the next builder wires to make it one: the hero (an
 * explorer in a suit, her arm a cannon), the feel (the run and gun's body WITH its wall: a planet is climbed as the
 * castle is not), and the hazards its looks already name (`hazard: 'water' | 'lava'`, read into the dress plan) that a
 * suit's power would let her through, a gate kind gates.js does not yet have.
 *
 *   xenoJager({ box?, turn? }) → the map's words (box.js readBox's), the planet at 14 × 8 screens unless said
 *   XENOJAGER_PREMISE, XENOJAGER_POWERS, XENOJAGER_HANDLE
 *
 * Pure: words in, words out.
 */
export const XENOJAGER_PREMISE = 'An explorer goes down through a dangerous planet\'s crust, cavern by cavern, to the nest at its core';
export const XENOJAGER_POWERS = Object.freeze({
  'thruster-leap': Object.freeze({ opens: 'double-jump', name: 'the thruster leap' }),
  'pulse-cannon': Object.freeze({ opens: 'wall-break', name: 'the pulse cannon' }),
  'curl-drive': Object.freeze({ opens: 'form', name: 'the curl drive' }),
});

/** The planet as the map's words. */
export function xenoJager({ box = [14, 8], turn = 'ccw' } = {}) {
  return {
    premise: XENOJAGER_PREMISE,
    box: [...box],
    turn,
    theme: 'xeno',
    powers: structuredClone({ ...XENOJAGER_POWERS }),
    rings: [
      { id: 'crust', place: 'the crust', towers: true, key: true, boss: 'the Crust Warden', finds: 'thruster-leap', inward: 'double-jump',
        pockets: [{ gate: 'double-jump', holds: 'an energy tank' }, { gate: 'wall-break', holds: 'a missile pack' }, { gate: 'form', holds: 'an energy tank' }] },
      { id: 'fungal-caverns', place: 'the fungal caverns', finds: 'pulse-cannon', inward: 'wall-break', pockets: [{ gate: 'form', holds: 'an energy tank' }] },
      { id: 'flooded-depths', place: 'the flooded depths', boss: 'the Leviathan', finds: 'curl-drive', inward: 'form' },
      { id: 'magma-core', place: 'the magma core', boss: 'the Brood Mother' },
    ],
  };
}

/**
 * What the next builder picks up to make XenoJager a game (none of it is wired: this is the handle, said).
 *   hero      an explorer in a sealed suit, her right arm a cannon: the character door's words to be written (the
 *             equipment shelf's arms, `equipment/arms/`, for the cannon)
 *   feel      the galaxy-boy pole's run and gun, its buster the cannon, its cling and wall kick KEPT (a planet's shafts
 *             are climbed off their walls; the castle refuses it, gates.js REFUSED_MOVES, the box itself lays no chimney)
 *   hazards   the looks' `hazard` (the flooded depths' water, the magma core's lava), recorded in each room's dress plan
 *             (dress.js `plan[room].hazard`): drawn today, harmless; a suit's power is to let her through, and a gate kind
 *             for it (a pool, a lava floor) is a row of gates.js the box would lay as it lays a grate
 *   ui        wired: the box's HUD wears the planet's card, `nocturne-xeno` (hud.js BOX_LOOKS), once a game asks for one
 */
export const XENOJAGER_HANDLE = Object.freeze({
  hero: Object.freeze({ name: 'Jager', role: 'an explorer in a sealed suit, her right arm a cannon', wired: false }),
  feel: Object.freeze({ pole: 'galaxy-boy', takes: true, keeps: Object.freeze(['cling', 'wall-kick', 'buster']), wired: false }),
  hazards: Object.freeze({
    water: Object.freeze({ in: 'the flooded depths', suit: 'the dive frame', does: 'slows her and cuts her jump until the suit is found', wired: false }),
    lava: Object.freeze({ in: 'the magma core', suit: 'the heat shell', does: 'burns her until the suit is found', wired: false }),
  }),
  ui: Object.freeze({ theme: 'nocturne-xeno', wired: true }),
});
