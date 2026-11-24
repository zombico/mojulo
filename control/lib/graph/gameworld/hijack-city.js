/**
 * HIJACK CITY — the open city's crime game, as a rail (rails.js `hijack-city`) and its starter: a district of a metro
 * roamed on foot and in any car taken, its street alive (passers-by who react, traffic, police cars), a contact's jobs
 * told as missions, a wanted level and the law after it, a respray garage and a gun shop, the money in hand, a phone and
 * its fares, a title, a save and a score. Every piece is a word of the gameworld the book already reads; this module is
 * the template that says them together, so a person's own game starts whole and is theirs to change.
 *
 * It NAMES; the tables behind it MEASURE. The district is a geocity (geocity/: its metro, its rings, its evocation); the
 * law is gameworld/law.js (game/law-mechanics.js), the street's health gameworld/levels.js (game/vitals-mechanics.js),
 * the shops gameworld/shops.js (game/shop-mechanics.js), the jobs gameworld/errand.js (game/mission-mechanics.js), the
 * crews gameworld/factions.js, the look playscape/ui/interface-look.js, the score gameworld/cue-sheet.js cityScore.
 *
 *   HIJACK_CITY            the rail's name and the starter's title (a person's game takes its own)
 *   HIJACK_DISTRICT        the district's geocity: the metro it is cut from, its rings, its water, where it stands
 *   hijackCityWorld({ name?, seed?, register? }) → the starter gameworld: a hero, the district (its outskirts'
 *                          pattern `register`'s, the West Coast's unless named), four story missions for one contact
 *                          (the last the end), a repeated fare, two crews, the law, the shops, the look, sound and
 *                          music. A plain value: the same words give the same world
 *   hijackCityStart(world) → null | { world, says }: a locked pitch from the rail with no level yet, laid with the
 *                          starter under it; every key the creator wrote wins (gameworld/pitch-start.js)
 *   HIJACK_GROWS           the words the starter is grown by, each a key of the gameworld: what a person changes first
 *
 * Pure: no dice, no imports beyond the reader of a world's own keys.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const HIJACK_CITY = 'Hijack City';

/** The district a Hijack City is played in: a neighbourhood near a lakeshore metro's core, water on its south, its
 *  outskirts a West Coast tract. */
export const HIJACK_DISTRICT = Object.freeze({
  metro: Object.freeze({ from: 'lakeshore', rings: Object.freeze({ core: 350, frame: 700 }) }),
  extent: Object.freeze([1800, 1500]), water: Object.freeze({ sides: Object.freeze(['s']), depth: 200 }), core: Object.freeze([0.5, 0.2]),
  evoke: 'neighbourhood', at: 'B4', shops: true,
  // (its outskirts' register: a West Coast tract of stucco ranches under palms, geotown/pattern.js; the downtown the
  // metro's own)
  outskirts: 'west-coast',
});
/** A hill city's district, for a San Francisco register (geocity/metro.js `bayside`): a neighbourhood of its outskirts
 *  beside the frame, its core on the bay at the north-east, water north and east; its own fog (HIJACK_AIR). */
export const HIJACK_HILL_DISTRICT = Object.freeze({
  metro: Object.freeze({ from: 'bayside', rings: Object.freeze({ core: 350, frame: 700 }) }),
  extent: Object.freeze([2200, 1800]), water: Object.freeze({ sides: Object.freeze(['n', 'e']), depth: 220 }), core: Object.freeze([0.8, 0.8]),
  evoke: 'neighbourhood', at: 'B3', shops: true, outskirts: 'san-francisco',
});
/** The registers that lay the hill city's district, and the air each is seen through (the fog off the ocean). */
export const HIJACK_HILL_REGISTERS = Object.freeze(['san-francisco', 'sunset']);
const HILL_AIR = Object.freeze({ kind: 'mist' });

// the contact's jobs, told as missions: a first errand, one with heat, one against the clock, the end
const MISSIONS = Object.freeze([
  { id: 'pickup', name: 'The pick-up', reward: 60, item: 'package', offer: 'New in town? I\'ve got work. A package across the district, back to me. Don\'t open it.', mission: {} },
  { id: 'hot-goods', name: 'Hot goods', reward: 90, item: 'case', offer: 'A friend left a case in a shop. The owner will call the police. Bring it here clean.', mission: { heat: 2, clean: true } },
  { id: 'rush', name: 'Against the clock', reward: 80, item: 'medicine', offer: 'My sister\'s medicine. You have two and a half minutes. Drive.', mission: { time: 150 } },
  { id: 'the-jeweller', name: 'The jeweller', reward: 300, item: 'stones', offer: 'This is the one. The jeweller\'s. Take the stones, lose the police, bring them to me. Five minutes.', mission: { heat: 3, clean: true, time: 300, final: true } },
]);

/** What a person changes first, each a key of the gameworld (the gameworld-hijack-city card says how). */
export const HIJACK_GROWS = Object.freeze({
  name: 'the game\'s own title',
  characters: 'the hero: its body, its clothes, how it moves (create_character words)',
  levels: 'the district: its outskirts\' register (`geocity.outskirts`: west-coast, tropical, san-francisco, sunset, bay-and-gable, old-town), another metro (`geocity.metro.from`: lakeshore, bayside), its size, its water, another district beside it',
  errands: 'the story: the contact, the missions (`mission`: heat, clean, time, final), the side work',
  factions: 'the crews: their turf, their colours, their boards of work',
  law: 'the police: how many stars, how many per star, cars, when they come armed, the fine',
  shops: 'the respray garage and the gun shop, their prices',
  ui: 'the look of the menus and the HUD (a theme card)',
  music: 'the score: walking, the chase, the tension',
});

export function hijackCityWorld({ name = HIJACK_CITY, seed = 2, register = null } = {}) {
  // (`register`: its outskirts' pattern, geotown/pattern.js PATTERNS: 'tropical' for a coast, 'bay-and-gable' for a
  // northeastern streetcar suburb, 'san-francisco' or 'sunset' a hill city's district in its fog; the West Coast tract
  // unless named)
  const hill = HIJACK_HILL_REGISTERS.includes(register);
  const district = { ...JSON.parse(JSON.stringify(hill ? HIJACK_HILL_DISTRICT : HIJACK_DISTRICT)), ...(register ? { outskirts: register } : {}) };
  return {
    id: 'hijack-city', name, seed, mode: 'autonomous', screen: 'screen',
    // (the seventh generation: the sun's shadows, the actors' and the buildings' light; gen-6 for a lighter page; a fair
    // sky, a haze thick enough that the far blocks pale a kilometre off, the finish over the bake (one tone curve, the
    // sky in the glass, the lamps' bloom) and the view cone, so the street's kit, its trees and its traffic are drawn as
    // far as they read)
    style: { kit: 'trail-valley', geocube: { from: 'valley-morning', era: 'gen-7' }, clouds: 'fair', air: hill ? { ...HILL_AIR } : { kind: 'haze', visibility: 3500 }, finish: true, cone: true },
    characters: {
      direction: { tradition: 'western' },
      hero: { looks: { body: { cast: 'male' }, underlayer: { type: 'outfit', style: 'streetwear' } }, motion: { vibe: ['bold', 'athletic'] }, actions: { idiom: 'city-stalker-like' } },
    },
    levels: { district: { name: 'The district', seed, geocity: district } },
    topology: 'interconnected',
    errands: [
      ...MISSIONS.map((m) => ({ id: m.id, name: m.name, contact: 'vince', giver: 'district', reward: [{ item: 'coin', n: m.reward }], offer: m.offer, list: [{ item: m.item, at: 'district' }], mission: { ...m.mission } })),
      // (side work on the phone: fares, as many as are driven)
      { id: 'fare', giver: 'district', repeat: true, reward: [{ item: 'coin', n: 12 }], list: [{ item: 'passenger', at: 'district' }], app: 'taskfu' },
    ],
    ui: { theme: { from: 'downtown', icons: 'solid' }, colour: 'theme' },
    factions: {
      reds: { name: 'The Reds', colour: '#c0392b', turf: 'north', rivals: ['dockers'], says: 'You ride with the Reds now.', board: [
        { id: 'torch', name: 'Send a message', act: { verb: 'torch', target: 'car', on: 'dockers', fight: true }, reward: [{ item: 'coin', n: 50 }], says: 'Docker cars keep parking on our side. Fix that.' },
        { id: 'tag', name: 'Mark the block', act: { verb: 'tag', target: 'wall' }, standing: 2, rank: 1 },
      ] },
      dockers: { name: 'The Dockers', colour: '#2e86c1', turf: 'south', rivals: ['reds'], board: [{ id: 'repo', name: 'Repossession', act: { verb: 'take', target: 'car', on: 'reds' }, reward: [{ item: 'coin', n: 40 }] }], crew: 'docker' },
    },
    foes: { docker: { class: 'pursuer', skin: { people: 'human', dress: { faction: 'streetGang', colourway: 'blue' } } } },
    sound: {}, music: {},
    law: true,
    shops: { respray: true, guns: true },
  };
}

// the workflow's own keys: a starter never brings them over what the creator wrote
const OWN = ['rail', 'intake', 'brief', 'review', 'made'];
export function hijackCityStart(world) {
  if (!isObj(world) || world.levels !== undefined) return null;
  const S = hijackCityWorld({ ...(typeof world.name === 'string' && world.name.trim() ? { name: world.name } : {}), ...(Number.isInteger(world.seed) ? { seed: world.seed } : {}) });
  const starter = Object.fromEntries(Object.entries(S).filter(([k]) => !OWN.includes(k)));
  return { world: { ...starter, ...world }, says: `${HIJACK_CITY}'s starter: a district, a contact's missions, the law, the shops and the street, every one a word of the book: theirs to change` };
}
