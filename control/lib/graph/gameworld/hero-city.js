/**
 * HERO CITY — the city stalker's starter: a superhero who keeps a district of a metro, built from what two games already
 * made rather than anew. Hijack City (hijack-city.js) is the MAP and the QUEST spine: the district, a contact who gives
 * jobs told as missions (a name, a clock, the last one the end), the journal, the guide's line and pillar of light, the
 * phone that calls with the next job, the save, the title and its front. The superhero beat-em-up (brawl/) is the ACTION:
 * its powers, each a card, lowered onto the open world's range button (hero-powers.js), and its villain's way of
 * fighting, the mastermind who keeps back behind those it summons (brawl/brawl-villains.js), as the foe shelf's summoner.
 *
 * What changes from the crime game: the hero is the law's side, so there is no wanted level, no police, no shops and no
 * sides to join; its jobs are the contact's (a police captain) BOUNTIES on the street's crews (errand.js `from: { foe }`:
 * the proof drops where one falls), the crews the city's people (foes.js CITY_CREWS), and the last a supervillain.
 *
 *   HERO_CITY                 the starter's title (a person's game takes its own)
 *   heroCityWorld({ name?, seed?, power? }) → the starter gameworld: Hijack City's district and spine, a kit hero
 *                             (the swinger's line and hands) carrying `power` (hero-powers.js POWER_IDS; a beam unsaid) on
 *                             its range button, the crews in the street, four missions for the captain, the last the
 *                             mastermind. Drawn calm (world.js CITY_CALM: no traffic, no occlusion pass): a city in play
 *                             draws a frame once. A plain value: the same words give the same world
 *   heroCityStart(world)      → null | { world, says }: a locked pitch on the vigilante rail with no level yet, laid with
 *                             the starter under it; every key the creator wrote wins (gameworld/pitch-start.js)
 *   HERO_CITY_GROWS           the words the starter is grown by: what a person changes first
 *
 * Pure: no dice.
 */
import { hijackCityWorld } from './hijack-city.js';
import { CITY_CREWS } from './foes.js';
import { POWER_IDS } from './hero-powers.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const HERO_CITY = 'Hero City';

// the hero's suit: the comic body, broad in the shoulders, a knit suit skin-fit from wrist to ankle in red over blue,
// gold trim, boots and gloves, a belt and an emblem on the chest (create_character's words)
const HERO_SUIT = Object.freeze({"body": {"cast": "male", "tune": {"shoulders": 1.15, "legs": 1.05, "depth": 1.05}}, "hair": {"hair": {"style": "swept"}}, "colour": {"palette": {"Skin": "#f7ead0", "Hair": "#1c1714", "Top": "#c62828", "Bottom": "#1a237e", "Shoes": "#1a237e", "Gloves": "#1a237e", "Trim": "#ffd400", "OutfitBase": "#c62828", "OutfitSecond": "#c62828", "OutfitTrim": "#ffd400", "OutfitAccent": "#ffd400"}}, "underlayer": {"type": "outfit", "style": "athlete", "dials": {"fit": 1, "stylize": 0.7, "coverage": 0.95, "ornament": 1}, "language": {"fit": "skin", "feet": "boots", "top": {"family": "knit", "sleeve": "long", "hem": "hip"}, "bottom": {"family": "knit", "leg": "long", "cut": "skinny"}}, "pieces": [{"kind": "belt", "at": "waist"}], "detail": [{"prim": "embroidery", "role": "chest", "motif": "diamond"}]}});

// the supervillain: the beat-em-up's mastermind (brawl-villains.js), kept back behind the thugs it calls in, two at a
// time; the crime family's enforcer in a cream suit, on the comic rail
const VILLAIN = Object.freeze({ class: 'summoner', summons: Object.freeze({ foe: 'thug', count: 2 }), skin: Object.freeze({ people: 'human', dress: Object.freeze({ faction: 'crimeFamily', kind: 'enforcer', colourway: 'cream', rail: 'comic' }) }) });

// the captain's jobs, told as missions: each a crew's proof brought back, one against the clock, the end
const MISSIONS = Object.freeze([
  { id: 'corner', name: 'The corner', reward: 50, item: 'bandana', foe: 'thug', offer: 'You\'re the one in the papers? Good. A gang\'s working the corner by the market. Put them down and bring me something that says so.', mission: {} },
  { id: 'the-family', name: 'The family business', reward: 80, item: 'ledger', foe: 'criminal', offer: 'The crime family runs its books out of this district. One of their soldiers carries the ledger. I want it.', mission: {} },
  { id: 'hired-guns', name: 'Hired guns', reward: 90, item: 'dog-tags', foe: 'mercenary', offer: 'Mercenaries, here, armed. Someone is paying them. Three minutes before they move. Go.', mission: { time: 180 } },
  { id: 'mastermind', name: 'The mastermind', reward: 300, item: 'mask', foe: 'mastermind', offer: 'All of it leads to one man. He keeps behind his thugs and calls more. Cut him down and they fall with him.', mission: { final: true } },
]);

/** What a person changes first, each a key of the gameworld. */
export const HERO_CITY_GROWS = Object.freeze({
  name: 'the game\'s own title',
  characters: 'the hero: its body, its suit, how it moves (create_character words), and its kit: the line, the hands, the power',
  power: `the hero's power on its range button (characters.hero.kit.ranged): ${POWER_IDS.join(', ')}`,
  levels: 'the district: another metro (`geocity.metro.from`), another neighbourhood, more crews in the street',
  errands: 'the story: the captain, the missions (`mission`: time, final), whose proof each asks for',
  foes: 'the crews and the villain: their kinds, their dress, who the mastermind calls',
  ui: 'the look of the menus and the HUD (a theme card)',
  music: 'the score: the patrol, the fight, the tension',
});

export function heroCityWorld({ name = HERO_CITY, seed = 2, power = 'beam' } = {}) {
  if (!POWER_IDS.includes(power)) throw new Error(`heroCityWorld: power is one of ${POWER_IDS.join(', ')}, not '${power}'`);
  const H = hijackCityWorld({ name, seed });
  const district = { ...H.levels.district, foes: { from: ['thug', 'criminal', 'mercenary', 'mastermind'], count: 7 } };
  const { law: _law, shops: _shops, factions: _factions, ...rest } = H;
  return {
    ...rest,
    id: 'hero-city',
    // (gen 7's sun and baked light kept; the frame drawn once: calm)
    style: { ...H.style, calm: true },
    characters: {
      direction: { tradition: 'western', body: 'comic' },
      hero: {
        looks: structuredClone(HERO_SUIT),
        motion: { vibe: ['heroic'] },
        actions: { idiom: 'city-stalker-like' },
        kit: { from: 'swinger', ranged: power },
      },
    },
    levels: { district },
    errands: MISSIONS.map((m) => ({ id: m.id, name: m.name, contact: 'reyes', giver: 'district', reward: [{ item: 'coin', n: m.reward }], offer: m.offer, list: [{ item: m.item, at: 'district', from: { foe: m.foe } }], mission: { ...m.mission } })),
    foes: { ...structuredClone(CITY_CREWS), mastermind: structuredClone(VILLAIN) },
  };
}

// the workflow's own keys: a starter never brings them over what the creator wrote
const OWN = ['rail', 'intake', 'brief', 'review', 'made'];
export function heroCityStart(world) {
  if (!isObj(world) || world.levels !== undefined) return null;
  const S = heroCityWorld({ ...(typeof world.name === 'string' && world.name.trim() ? { name: world.name } : {}), ...(Number.isInteger(world.seed) ? { seed: world.seed } : {}) });
  const starter = Object.fromEntries(Object.entries(S).filter(([k]) => !OWN.includes(k)));
  return { world: { ...starter, ...world }, says: `${HERO_CITY}'s starter: Hijack City's district and missions, a hero with a power, the crews and a mastermind, every one a word of the book: theirs to change` };
}
