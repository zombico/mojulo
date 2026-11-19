/**
 * THE GENRE'S FORM — what the sentence door (compose.js) lays for a genre it reads, in the book. A genre whose kernel
 * the book carries as a level form has its levels laid in that form (a flight sim's courses are airspaces); a genre
 * that is another door's medium is handed to that door, nothing laid; a genre the registry cannot make yet (the cosmos
 * dry run's verdict), or one the book cannot lay from a sentence yet (PENDING), is refused with what it waits on, nothing
 * laid in its place. The genres the book lays in its own walks and buildings are laid as they were.
 *
 *   GENRE_FORMS[id]         → { form, name, hero?, screen?, level(i, n) → the level's form keys } the book level form a
 *                             genre's levels take (`hero`: played by the hero by default, its `moves`; `screen`: its own)
 *   HAND_OFFS[id]           → { door, why } the door that makes a genre that is not a book of levels
 *   refusalOf(id, others)   → null | { verdict, waits, others } why a read genre is not laid (hand-offs are said apart)
 *   PENDING[id], pendingOf(id) → what a genre the book cannot lay from a sentence yet waits on (refused, nothing laid)
 *   heroFrameOf(id, tradition) → { characters, camera, screen } | null: the hero, camera and screen a genre on foot is laid with
 *   HERO_STREET_WORDS, heroStreetWords(prompt) → the words that make a beat-em-up's streets a superhero one (the heroes
 *                             tuning), [] for none
 *
 * Forms wait on what they need beside them: a race's ride (the vehicle registry's front door) before racing's roadway
 * is laid. A form a hero plays (a runner's lanes, a city's rooftops) is laid with the hero by default beside it.
 * Pure: the door probes (door-probes.js) read what the run makes of it.
 */
import { dryRun } from '../cosmos/cosmos.js';
import { genreCube, GENRES } from './intent.js';
import { HIJACK_DISTRICT } from './hijack-city.js';

// (the street a sentence lays: three stops that build to the cast's boss, a novice for a first street, and five falls
// allowed: measured with a hero the sentence door made, the brawl's basic player lost it at three and won it at five,
// brawl/brawl-playthrough.js). Its boss fights in three stages, a level harder each and calling two of the rank and file
// in at the second and the third: measured with the basic player, won by a beat-em-up's with two of five falls and by
// an arcade run & gun's with three of five)
export const STREET_FROM_A_SENTENCE = Object.freeze({ stops: [{ wave: { grunt: 2 } }, { wave: { grunt: 3, shooter: 1 } }, { wave: { elite: 1, grunt: 3 } }], boss: Object.freeze({ foe: 'boss', cpu: 'novice', stages: Object.freeze([Object.freeze({}), Object.freeze({ cpu: 'regular', calls: Object.freeze({ grunt: 2 }) }), Object.freeze({ cpu: 'veteran', calls: Object.freeze({ grunt: 2 }) })]) }), lives: 5 });
// (a beat-em-up a sentence calls a SUPERHERO one: its streets laid on the heroes tuning, brawl/brawl-tunings.js, every
// seat a hero with a power, an army that drops in; the words that say so, read as deciding it)
export const HERO_STREET_WORDS = Object.freeze(['superhero', 'superheroes', 'super hero', 'super heroes', 'mutant', 'mutants', 'superpowers', 'super powers', 'superpowered']);
/** The hero words a sentence uses (HERO_STREET_WORDS), whole words only: [] for none. */
export function heroStreetWords(prompt) {
  const t = ` ${String(prompt ?? '').toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  return HERO_STREET_WORDS.filter((w) => t.includes(` ${w} `));
}
/** The book level forms the sentence door lays a genre's levels in. */
export const GENRE_FORMS = Object.freeze({
  // the flight genres: an airspace a level (skyscape/airspace.js): a runway, a gate course, the genre's craft
  'flight-sim': Object.freeze({ form: 'airspace', name: 'Course', level: () => ({ airspace: { map: { craft: 'trainer' }, course: true } }) }),
  'air-combat': Object.freeze({ form: 'airspace', name: 'Sortie', level: () => ({ airspace: { map: { craft: 'jet' }, course: true } }) }),
  'space-shooter': Object.freeze({ form: 'airspace', name: 'Sector', level: () => ({ airspace: { map: { craft: 'fighter' }, space: { asteroids: 'field' }, course: true } }) }),
  // the forms a hero plays (heroFrameOf lays the hero beside them; `moves` the ones the form asks of its body): the
  // endless run down lanes (worlds/controllable/runner.js), the city swung through by its rooftops (city/plan/level.js)
  // (a runner is made for a phone held upright: its lanes run up the screen)
  'endless-runner': Object.freeze({ form: 'runner', name: 'Run', hero: Object.freeze({}), screen: 'phone', level: () => ({ runner: true }) }),
  // the street genres (brawl-cast.js): a level a street of stops and a boss, the world's cast its crowd; a beat-em-up
  // fought hand to hand, a run & gun with guns (the world's intent decides: the same level form). A street runs across
  // the screen, and a hero plays it (a stand-in where the world has none yet)
  'co-op-brawler': Object.freeze({ form: 'street', name: 'Street', hero: Object.freeze({}), screen: 'screen', level: () => ({ street: STREET_FROM_A_SENTENCE }) }),
  'run-and-gun': Object.freeze({ form: 'street', name: 'Street', hero: Object.freeze({}), screen: 'screen', level: () => ({ street: STREET_FROM_A_SENTENCE }) }),
  // (the open city's crime game: a district of a metro, gameworld/hijack-city.js's; its law and its story are the world's)
  'open-city-crime': Object.freeze({ form: 'geocity', name: 'District', hero: Object.freeze({}), screen: 'screen', level: () => ({ geocity: JSON.parse(JSON.stringify(HIJACK_DISTRICT)) }) }),
  'city-stalker': Object.freeze({ form: 'city', name: 'District', hero: Object.freeze({ moves: Object.freeze(['wall', 'swinger']) }), level: () => ({ city: { stalker: true } }) }),
});

/** The genres that are another door's medium: said, never laid as levels. */
export const HAND_OFFS = Object.freeze({
  'match-3-saga': Object.freeze({ door: "create_pixelizer_game({ reducer: 'stone-saga' })", why: 'a match-3 saga is a board of swaps on a map of levels, which the pixelizer plays; it is not a walked world' }),
});

/** What a read genre the book cannot lay from a sentence yet waits on: refused, nothing laid in its place, until its
 * form lands. (The genres laid in the book's own walks and buildings are laid as they were: a dungeon crawler, a
 * collectathon, a top-down adventure, a metroidvania, survival horror, a story; stealth's guards, a co-op platformer's
 * side camera and seats, a party's battles, each played once the world has a hero.) */
export const WAITS = Object.freeze({
  ride: 'a ride the book drives (the hero as a vehicle, on a roadway level with a race goal)',
  form: 'its kernel as a book level (today it plays as one level alone)',
});
export const PENDING = Object.freeze({
  racing: 'ride', 'kart-racer': 'ride',
  'arena-shooter': 'form',
  'tower-defense': 'form', rts: 'form', tactics: 'form', farming: 'form', rhythm: 'form', roguelike: 'form', 'block-puzzle': 'form',
  'pixel-puzzle': 'form', 'versus-fighter': 'form', 'athletics-meet': 'form', 'net-game': 'form', 'turn-sport': 'form', 'team-goal-game': 'form',
  'co-op-kitchen': 'form',
});
// the one level a pending genre plays alone today (quick.js QUICK_GOALS, the one-level door), said beside its refusal
const ONE_LEVEL = Object.freeze({
  racing: 'race', 'kart-racer': 'race', shooter: 'shoot', 'arena-shooter': 'deathmatch', 'tower-defense': 'defend', rts: 'conquer',
  farming: 'farm', rhythm: 'rhythm', 'block-puzzle': 'puzzle', 'versus-fighter': 'fight', 'athletics-meet': 'meet', 'net-game': 'contest',
  'turn-sport': 'contest', 'team-goal-game': 'contest', 'endless-runner': 'runner', 'co-op-kitchen': 'work',
});
// (and the words that make it what the genre is, where the goal alone does not: the cooks a co-op kitchen seats)
const ONE_WITH = Object.freeze({ 'co-op-kitchen': Object.freeze({ cooks: 2 }) });
/** The quick door that plays a pending genre's one level alone, as the producer says it: `{ goal: 'work', cooks: 2 }`. */
export const oneLevelCall = (id) => (ONE_LEVEL[id] ? `{ goal: '${ONE_LEVEL[id]}'${Object.entries(ONE_WITH[id] ?? {}).map(([k, v]) => `, ${k}: ${JSON.stringify(v)}`).join('')} }` : null);

/** Why a read genre is not laid from a sentence yet (PENDING): { waits, one? } (`one`: the quick goal that plays one
 * level of it alone; `call`, the quick door's words for it), or null. */
export const pendingOf = (id) => (PENDING[id] ? { waits: WAITS[PENDING[id]], ...(ONE_LEVEL[id] ? { one: ONE_LEVEL[id], call: oneLevelCall(id) } : {}) } : null);

// the vibe a genre's hero moves with where its cube names none (gameworld-motion's words)
const GENRE_VIBE = Object.freeze({
  'dungeon-crawler': 'stoic', 'top-down-adventure': 'spirited', metroidvania: 'nimble', 'survival-horror': 'weary',
  'story-adventure': 'composed', stealth: 'nimble', 'co-op-platformer': 'bouncy', jrpg: 'spirited', collectathon: 'bouncy',
});
// the blade a melee genre's hero carries for its own blow (its swing, reach and damage the held strike's: world-scene.js)
const MELEE_ITEM = Object.freeze({ id: 'blade', slot: 'right', build: Object.freeze({ item: 'sword' }), serves: Object.freeze(['strike']) });
// the gun a ranged genre's hero carries for its own shot (the arms library's: a long gun the rifle's numbers, a pistol
// the handgun's), by genre where its fiction names one
const RANGED_ITEM = Object.freeze({ id: 'gun', slot: 'right', serves: Object.freeze(['shoot']) });
const GENRE_GUN = Object.freeze({ 'survival-horror': 'pistol' });
// the cameras a world names (cameras.js) that the genre's cube asks of its hero; third person is the hero's own default.
// (the 3D platformer's chases too: `follow`, and `orbit`, the one an action hero turns by the mouse and locks on with)
const NAMED_CAMERAS = new Set(['side', 'top-down', 'fixed', 'first-person', 'follow', 'orbit']);

/** The frame a genre's sentence is laid in when its cube asks a hero on foot: the hero the book makes by default (its
 * body the game's, game-bodies.js; it moves by the genre's vibe; no powers, said (`actions.none`), so the book has
 * nothing open to hold its levels back), the camera the cube asks (side, top-down, fixed; null for third person) and the
 * screen it is made for (a monitor's 16:9: a chase, a side-scroller or an overhead reads across, not up a phone). A genre
 * whose hero is a vehicle or an aircraft is laid by its form, not a book hero: null. A genre that fights arms the hero:
 * a blade for its own blow where it fights in melee (`serves: ['strike']`), a gun for its own shot where it fights only at
 * range (`serves: ['shoot']`; a first-person shooter is played from the armed hero's eyes). `tradition` is the world's
 * register. */
export function heroFrameOf(id, tradition) {
  const cube = genreCube(id);
  const combat = [].concat(cube?.power?.combat ?? []), ranged = combat.includes('ranged') && !combat.includes('melee');
  // (a first-person genre is laid with a hero only when it fights at range: you look out of the armed hero's eyes)
  if (!cube || cube.soul?.hero !== 'hero' || (cube.space?.camera === 'first-person' && !ranged)) return null;
  const vibe = cube.soul?.vibe ?? GENRE_VIBE[id] ?? 'spirited', camera = NAMED_CAMERAS.has(cube.space?.camera) ? cube.space.camera : null;
  const moves = GENRE_FORMS[id]?.hero?.moves;
  // (a genre that fights arms its hero, in the right hand, for its own blow or its own shot (adornment.js BASIC_VERBS):
  // a blade where it fights in melee, a gun where it fights only at range; a climber's hands are its own)
  // (a turn-based hero carries the blade too: its swing is what it acts out in the party battles)
  const item = moves ? null : combat.includes('melee') || combat.includes('turn-based') ? MELEE_ITEM : ranged ? { ...RANGED_ITEM, build: { item: GENRE_GUN[id] ?? 'carbine' } } : null;
  // (a genre that fights is played by people who take its blows: every person the run makes has its own hit, stagger,
  // fall and rise, world.js moves)
  const fights = combat.some((k) => ['melee', 'ranged', 'turn-based'].includes(k));
  // (a genre that fights turn by turn fights as a party: a casting page, its scale read from the sentence's own words
  // or a party by default (casting.js), the rolled companions in the party battles from the start, each in its class)
  const party = combat.includes('turn-based');
  return {
    characters: { direction: { tradition, body: 'game' }, hero: { motion: { vibe: [vibe] }, actions: { none: true, ...(moves ? { moves: [...moves] } : {}) }, ...(item ? { adornment: { items: [{ ...item, build: { ...item.build }, serves: [...item.serves] }] } } : {}) }, ...(party ? { casting: {} } : {}) },
    camera, screen: 'screen', ...(fights ? { moves: true } : {}),
  };
}

const code = (x) => `${x.facet}.${x.setting}=${x.value}`;

/** Why a read genre is not laid: the registry's verdict for its cube (cosmos dryRun) when it is blocked or has gaps,
 * with what it waits on and the makeable genres the same words point at; null when it is makeable. */
export function refusalOf(id, others = []) {
  const cube = genreCube(id);
  if (!cube) return null;
  const R = dryRun(cube);
  if (R.verdict === 'makeable') return null;
  const alt = others.filter((g) => g !== id && GENRES[g] && genreCube(g) && dryRun(genreCube(g)).verdict === 'makeable');
  return { verdict: R.verdict, waits: [...R.blocked, ...R.gaps].map(code), others: alt };
}
