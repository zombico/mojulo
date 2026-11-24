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
 *   bellTower({ box? }) · courtyard({ box? })   → the castle's other boxes: a serpentine and a hub (shapes.js)
 *   vampireSonataCastle() → a castle of boxes (castle.js): the tower, a bridge, the courtyard, a gatehouse, the keep
 *   erinaHero()          → the character door's words for her (create_character { as: 'hero', spec, toon })
 *   vampireSonataGame({ heroRef?, id?, name?, castle? }) → a designed game's words: the feel, the side camera, her book (adopted
 *                        by `heroRef`, the row erinaHero mints), the castle one level
 *   VAMPIRE_SONATA_PREMISE, VAMPIRE_SONATA_POWERS, VAMPIRE_SONATA_FEEL, VAMPIRE_SONATA_TREES, ERINA
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
    maps: true,
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

/**
 * The castle's other boxes, each a shape (shapes.js) of its own: the BELL TOWER a serpentine climbed row by row from its
 * foot to its spire (a pass-through: in at the bottom left, out at the top), and the COURTYARD a hub, its approach up the
 * barbican to the court and three wings walked out and back from it (the chapel, the armoury, the crypt).
 */
export function bellTower({ box = [8, 6] } = {}) {
  return {
    premise: 'The bell tower climbed from its foot to its spire, a floor a turn', box: [...box], shape: 'serpentine', theme: 'castle', maps: true,
    powers: structuredClone({ ...VAMPIRE_SONATA_POWERS }),
    rings: [
      { id: 'foot', place: 'the tower foot', key: true, boss: 'the Bell Ringer', finds: 'second-leap', inward: 'double-jump',
        pockets: [{ gate: 'double-jump', holds: 'a heart vessel' }, { gate: 'wall-break', holds: 'a relic' }] },
      { id: 'belfry', place: 'the belfry', finds: 'ram-strike', inward: 'wall-break' },
      { id: 'spire', place: 'the spire', boss: 'the Great Bell' },
    ],
  };
}
export function courtyard({ box = [7, 8] } = {}) {
  return {
    premise: 'The courtyard reached up the barbican, its chapel, armoury and crypt walked out from it and back', box: [...box], shape: 'hub', theme: 'castle', maps: true,
    powers: structuredClone({ ...VAMPIRE_SONATA_POWERS }),
    rings: [
      { id: 'barbican', place: 'the barbican', key: true, inward: 'key' },
      { id: 'court', place: 'the courtyard' },
      { id: 'chapel', place: 'the chapel', boss: 'the Warden', finds: 'second-leap', inward: 'double-jump' },
      { id: 'armoury', place: 'the armoury', finds: 'ram-strike', inward: 'wall-break', pockets: [{ gate: 'double-jump', holds: 'a heart vessel' }] },
      { id: 'crypt', place: 'the crypt', boss: 'the Crypt Lord' },
    ],
  };
}

/**
 * THE CASTLE OF BOXES (castle.js): the bell tower climbed from its foot to its open spire, a bridge across the night to
 * the courtyard's barbican, the courtyard open to the sky with its chapel, armoury and crypt, a gatehouse and its keeper,
 * and the keep wound in to the throne. The powers are the castle's, each found once: the second leap at the tower's
 * foot, the ram strike in the chapel, the mist veil in the armoury; every one opens something behind as well as on.
 */
export function vampireSonataCastle() {
  return {
    premise: 'A hunter climbs the bell tower, crosses to the courtyard and storms the keep', theme: 'castle', maps: true,
    powers: structuredClone({ ...VAMPIRE_SONATA_POWERS }),
    boxes: [
      { id: 'tower', box: [8, 5], shape: 'serpentine', rings: [
        { id: 'foot', place: 'the tower foot', look: 1, boss: 'the Bell Ringer', finds: 'second-leap', inward: 'double-jump', pockets: [{ gate: 'double-jump', holds: 'a heart vessel' }] },
        { id: 'belfry', place: 'the belfry', look: 2, key: true, inward: 'key', pockets: [{ gate: 'wall-break', holds: 'a relic' }] },
        { id: 'spire', place: 'the spire', look: 0, boss: 'the Great Bell' },
      ] },
      { id: 'court', box: [7, 8], shape: 'hub', rings: [
        { id: 'barbican', place: 'the barbican', look: 3, key: true, inward: 'key' },
        { id: 'yard', place: 'the courtyard', look: 0 },
        { id: 'chapel', place: 'the chapel', look: 1, boss: 'the Warden', finds: 'ram-strike', inward: 'wall-break', pockets: [{ gate: 'form', holds: 'a heart vessel' }] },
        { id: 'armoury', place: 'the armoury', look: 3, finds: 'mist-veil', inward: 'form' },
        { id: 'crypt', place: 'the crypt', look: 2, boss: 'the Crypt Lord' },
      ] },
      { id: 'keep', box: [8, 6], rings: [
        { id: 'lower', place: 'the lower keep', look: 1, key: true, inward: 'double-jump' },
        { id: 'upper', place: 'the upper keep', look: 2, inward: 'form' },
        { id: 'throne', place: 'the throne room', look: 3, boss: 'the Lord of the Keep' },
      ] },
    ],
    joins: [
      { from: 'tower', to: 'court', by: 'bridge', length: 2, place: 'the bell bridge' },
      { from: 'court', to: 'keep', by: 'gatehouse', gate: 'boss', boss: 'the Gatekeeper', place: 'the keep\'s gatehouse' },
    ],
  };
}

/**
 * ERINA'S TREES (trees/tree.js), one purse for both: a point for each boss felled and each pocket's prize.
 *   the SKILLS (movement)  the second leap's double jump, found with it; a third leap on it; a faster run, the dash carried
 *                          further, an air dash more
 *   the TECHS (spells and attacks)   the hunter's thrust on the heavy, the cleave forked off her string, the rising cut
 *                          and the plunge from the air; the soul burst on the special, the crescent dash and the blood
 *                          spiral with the modifier, each for MP
 * More than a castle's points buy: she grows one way or another.
 */
export const VAMPIRE_SONATA_TREES = Object.freeze({
  points: Object.freeze({ boss: 1, prize: 1 }),
  movement: Object.freeze({ name: 'Skills', nodes: Object.freeze([
    Object.freeze({ move: 'double-jump', name: 'Second leap', found: 'second-leap' }),
    Object.freeze({ move: 'triple-jump', name: 'Third leap', requires: Object.freeze(['double-jump']), cost: 2 }),
    Object.freeze({ move: 'swift', name: 'Swift foot', cost: 1 }),
    Object.freeze({ move: 'long-dash', name: 'Long dash', requires: Object.freeze(['swift']), cost: 1 }),
    Object.freeze({ move: 'air-dash', name: 'Wing dash', requires: Object.freeze(['long-dash']), cost: 2 }),
  ]) }),
  techs: Object.freeze({ name: 'Techs', nodes: Object.freeze([
    Object.freeze({ tech: 'thrust', name: 'Hunter\'s thrust', cost: 1 }),
    Object.freeze({ tech: 'cleave', name: 'Cleave', requires: Object.freeze(['thrust']), cost: 1 }),
    Object.freeze({ tech: 'rising-cut', name: 'Rising cut', requires: Object.freeze(['thrust']), cost: 2 }),
    Object.freeze({ tech: 'plunge', name: 'Plunge', requires: Object.freeze(['rising-cut']), cost: 2 }),
    Object.freeze({ tech: 'soul-burst', name: 'Soul burst', cost: 1 }),
    Object.freeze({ tech: 'crescent-dash', name: 'Crescent dash', requires: Object.freeze(['soul-burst']), cost: 2 }),
    Object.freeze({ tech: 'blood-spiral', name: 'Blood spiral', requires: Object.freeze(['crescent-dash']), cost: 3 }),
  ]) }),
});

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
export function vampireSonataGame({ heroRef, id = 'vampire-sonata', name = 'Vampire Sonata', box, turn, castle = false } = {}) {
  return {
    id, name,
    feel: structuredClone(VAMPIRE_SONATA_FEEL),
    camera: 'side',
    // (no lives: an action RPG's vitals, health and MP, her death a waking in the last save room: metroidvania/level.js;
    // her growth her trees, learned with the points the castle gives)
    trees: structuredClone(VAMPIRE_SONATA_TREES),
    characters: { direction: { tradition: 'anime', body: { rail: 'realistic', style: 'anime' } }, ...(heroRef ? { hero: { ref: heroRef } } : {}) },
    // (the castle one box, or, `castle`, the castle of boxes: the tower, the courtyard and the keep joined, castle.js)
    levels: { castle: { name: 'The castle', metroidvania: castle ? vampireSonataCastle() : vampireSonata({ ...(box ? { box } : {}), ...(turn ? { turn } : {}) }) } },
  };
}
