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
 * ERINA is its hero: a monster hunter, a grown woman drawn in the traditional anime register (the anime head's grown
 * woman's face, `z-fighter`, on the strong grown heroine's body, `mizuki`), long dark hair in a side tail, a hunter's
 * coat in the castle's crimson, a hunter's longsword in her right hand (the equipment shelf's `hunter`: a hero's blade of
 * silver under a winged guard, nothing lit). She fights with
 * Zero Boy's saber string (the galaxy-boy feel's `saber` variant, feel/saber.js: three cuts on the fire press, in place,
 * and a cut in the air), and the castle takes away what it never asks of her: no wall slide and no wall kick (`cling:
 * null`, the dash never off a wall), no stomp (the card's `pound` is null), no buster; her sword is steel, not the
 * saber's light (`blade.steel`: no strand over it, her cut's slash in steel).
 *
 *   vampireSonata({ box?, turn? }) → the map's words (box.js readBox's), the castle at 12 × 8 screens unless said
 *   erinaHero()          → the character door's words for her (create_character { as: 'hero', spec, toon })
 *   vampireSonataGame({ heroRef?, id?, name? }) → a designed game's words: the feel, the side camera, her book (adopted
 *                        by `heroRef`, the row erinaHero mints), the castle one level
 *   VAMPIRE_SONATA_PREMISE, VAMPIRE_SONATA_POWERS, VAMPIRE_SONATA_FEEL, ERINA
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
    theme: 'castle',
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

/** The castle's feel: Zero Boy's saber string on the run and gun's body, without its wall (no slide, no kick off one),
 * played with a sword of steel (`blade.steel`: no strand of light over it, its slash in steel, feel/saber.js). */
export const VAMPIRE_SONATA_FEEL = Object.freeze({ pole: 'galaxy-boy', variant: 'saber', takes: true, set: Object.freeze({ cling: null, dash: Object.freeze({ wall: false }), blade: Object.freeze({ steel: true }) }) });

/** Erina: the monster hunter, a grown woman in the traditional anime register, her longsword in her right hand. */
export const ERINA = Object.freeze({
  name: 'Erina', cast: 'female', head: 'anime', animeStyle: 'z-fighter', animeBody: 'mizuki',
  look: 'heroine', hair: Object.freeze(['long', 'side-tail']), expression: 'determined',
  palette: Object.freeze({ Skin: '#f1d6c4', Hair: '#2b2233', Top: '#5a1a26', Bottom: '#1f1a24', Shoes: '#2e2420' }),
  stylism: Object.freeze({ genre: 'fantasy', register: 'heroic', canon: 'anime', silhouette: 'rogue' }),
  gear: Object.freeze({ right: Object.freeze({ item: 'sword', style: 'hunter' }) }),
});

/** The character door's words for Erina. */
export const erinaHero = () => ({ as: 'hero', toon: { light: true }, spec: structuredClone({ ...ERINA }) });

/** Vampire Sonata as a designed game's words: Erina's feel and book, the castle its one level. */
export function vampireSonataGame({ heroRef, id = 'vampire-sonata', name = 'Vampire Sonata', box, turn } = {}) {
  return {
    id, name,
    feel: structuredClone(VAMPIRE_SONATA_FEEL),
    camera: 'side',
    // (no lives: an action RPG's vitals, health and MP, her death a waking in the last save room: metroidvania/level.js)
    characters: { direction: { tradition: 'anime', body: { rail: 'realistic', style: 'anime' } }, ...(heroRef ? { hero: { ref: heroRef } } : {}) },
    levels: { castle: { name: 'The castle', metroidvania: vampireSonata({ ...(box ? { box } : {}), ...(turn ? { turn } : {}) }) } },
  };
}
