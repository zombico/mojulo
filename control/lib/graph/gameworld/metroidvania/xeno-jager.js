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
 *   xenoJager({ box?, turn?, theme? }) → the map's words (box.js readBox's), the planet at 14 × 8 screens unless said;
 *                        `theme: null` leaves the look to the level's geocube (XENOJAGER_CUBE: cube.js)
 *   xenoJagerStart()     → the planet as a starter: its feel, the side camera, its level on its cube (the galaxy-boy rail's
 *                        `xenojager` variant)
 *   XENOJAGER_PREMISE, XENOJAGER_POWERS, XENOJAGER_HANDLE, XENOJAGER_CUBE, XENOJAGER_FEEL
 *
 * Pure: words in, words out.
 */
/**
 * XenoJager's GEOCUBE: the planet as a style (era/geocube.js), a document over the gothic night: its box the planet's
 * library in the planet's own colours (tint 0), its stone and floor a cave's, its accent the crystals' violet. A world
 * whose `style.geocube` is this cube dresses any box level that names no theme as the planet (cube.js), and its other
 * levels on the same stone. A document until the planet earns a preset.
 */
export const XENOJAGER_CUBE = Object.freeze({
  from: 'gothic-night', id: 'xenojager', title: 'XenoJager\'s planet', reads: 'A dangerous planet\'s caves: rock, strange life, water and lava, lit by what grows there',
  colour: Object.freeze({ stone: '#4e4250', floor: '#6a5c58', trim: '#5a4a52', accent: '#a07ad8', grass: '#2e5a48', foliage: '#2a4a3a', water: '#1e3a5a', sand: '#5a4c44' }),
  box: Object.freeze({ library: 'xeno', tint: 0 }),
  why: Object.freeze([
    'Rock is never laid: it breaks as rock does, boulders of every shape, the dark of the cracks between them.',
    'The only light is what grows and burns there: glowing pods, crystals, lava; the sky only over the crust.',
    'Each depth its own water: green life, blue water, red heat, the rings unlike one another.',
    'What stands in the rock is real: its boulders fractured and grained, its crystals their lattice\'s own faces.',
  ]),
});
export const XENOJAGER_PREMISE = 'An explorer goes down through a dangerous planet\'s crust, cavern by cavern, to the nest at its core';
export const XENOJAGER_POWERS = Object.freeze({
  'thruster-leap': Object.freeze({ opens: 'double-jump', name: 'the thruster leap' }),
  'pulse-cannon': Object.freeze({ opens: 'wall-break', name: 'the pulse cannon' }),
  'curl-drive': Object.freeze({ opens: 'form', name: 'the curl drive' }),
});

/** The planet as the map's words. */
export function xenoJager({ box = [14, 8], turn = 'ccw', theme = 'xeno' } = {}) {
  return {
    premise: XENOJAGER_PREMISE,
    box: [...box],
    turn,
    ...(theme ? { theme } : {}),
    powers: structuredClone({ ...XENOJAGER_POWERS }),
    rings: [
      { id: 'crust', place: 'the crust', towers: true, key: true, boss: 'the Crust Warden', finds: 'thruster-leap', inward: 'double-jump',
        pockets: [{ gate: 'double-jump', holds: 'an energy tank' }, { gate: 'wall-break', holds: 'a missile pack' }, { gate: 'form', holds: 'an energy tank' }, { gate: 'secret', holds: 'a missile pack' }] },
      { id: 'fungal-caverns', place: 'the fungal caverns', finds: 'pulse-cannon', inward: 'wall-break', pockets: [{ gate: 'form', holds: 'an energy tank' }, { gate: 'secret', holds: 'an energy tank' }] },
      { id: 'flooded-depths', place: 'the flooded depths', boss: 'the Leviathan', finds: 'curl-drive', inward: 'form' },
      { id: 'magma-core', place: 'the magma core', boss: 'the Brood Mother' },
    ],
  };
}

/** XenoJager's feel: the galaxy-boy pole's run and gun as it is, its wall cling and kick kept (a planet's shafts are
 * climbed off their walls), its buster the cannon. */
export const XENOJAGER_FEEL = Object.freeze({ pole: 'galaxy-boy', takes: true });

/** XenoJager's sound: its own recordings (`xeno-jager`: a sealed suit's cannon and boots, the planet's rock), its menus
 * and its HUD on the terminal's set (nocturne-xeno), and a boss falling as a great body does. */
export const XENOJAGER_SOUND = Object.freeze({ style: 'realistic', flavor: 'xeno-jager', menus: 'terminal', run: Object.freeze({ boss: 'boss-collapse' }) });

/** The planet as a STARTER (the galaxy-boy rail's `xenojager` variant, pitch-start.js): its feel, the side camera, the
 * planet one level whose look is the world's geocube (XENOJAGER_CUBE), its HUD the castle's card re-keyed for the planet.
 * No hero: the person's own, made with the character door. */
export function xenoJagerStart() {
  return {
    camera: 'side', feel: structuredClone({ ...XENOJAGER_FEEL }), style: { geocube: structuredClone(XENOJAGER_CUBE) },
    levels: { planet: { name: 'The planet', metroidvania: xenoJager({ theme: null }) } },
    ui: { theme: 'nocturne' },
    sound: structuredClone(XENOJAGER_SOUND),
  };
}

/**
 * What the next builder picks up to make XenoJager a game (each marked wired or not: this is the handle, said).
 *   hero      an explorer in a sealed suit, her right arm a cannon: the character door's words to be written (the
 *             equipment shelf's arms, `equipment/arms/`, for the cannon)
 *   feel      wired: the galaxy-boy pole's run and gun, its buster the cannon, its cling and wall kick KEPT (a planet's
 *             shafts are climbed off their walls; the castle refuses it, gates.js REFUSED_MOVES, the box itself lays no
 *             chimney): XENOJAGER_FEEL, the starter's
 *   hazards   the looks' `hazard` (the flooded depths' water, the magma core's lava), recorded in each room's dress plan
 *             (dress.js `plan[room].hazard`): drawn today, harmless; a suit's power is to let her through, and a gate kind
 *             for it (a pool, a lava floor) is a row of gates.js the box would lay as it lays a grate
 *   ui        wired: the box's HUD wears the planet's card, `nocturne-xeno` (hud.js BOX_LOOKS), once a game asks for one
 */
export const XENOJAGER_HANDLE = Object.freeze({
  hero: Object.freeze({ name: 'Jager', role: 'an explorer in a sealed suit, her right arm a cannon', wired: false }),
  feel: Object.freeze({ pole: 'galaxy-boy', takes: true, keeps: Object.freeze(['cling', 'wall-kick', 'buster']), wired: true }),
  hazards: Object.freeze({
    water: Object.freeze({ in: 'the flooded depths', suit: 'the dive frame', does: 'slows her and cuts her jump until the suit is found', wired: false }),
    lava: Object.freeze({ in: 'the magma core', suit: 'the heat shell', does: 'burns her until the suit is found', wired: false }),
  }),
  ui: Object.freeze({ theme: 'nocturne-xeno', wired: true }),
  // (wired: a world whose style names this cube dresses its box levels as the planet, cube.js)
  cube: Object.freeze({ geocube: XENOJAGER_CUBE, wired: true }),
});
