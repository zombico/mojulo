/**
 * THE RAILS — the game types mojulo builds, one row each: what the producer knows before anything is asked for. A rail
 * is a TEMPLATE, never the game: a person makes a stealth action game of their own design and starts it from Steel
 * Serpents. The rail's name is ours (a house title, or the type's own word where it has no title); the game's name, its
 * hero, its world and its story are theirs. A rail names a variant we found in how a game's level, action, character
 * and world are tuned, and scopes things to it.
 *
 * It NAMES; the tables behind it still MEASURE. A row's handles are its keys into them, so no number is copied here:
 *
 *   pole     gameworld/feel/cards.js POLES: how the buttons feel (the action tuning), its camera, what it lacks
 *   genres   cosmos/fixtures.js FIXTURES (intent.js GENRES): the cubes it starts a designed game from, the first its own
 *   quick    gameworld/quick.js QUICK_GOALS: the goals it plays as one level
 *   pixel    pixelizer/pixelizer-games.js PIXELIZER_REDUCERS: the one-page games it is
 *   table    'tabletop' | 'table-rpg': create_game's own key for it
 *
 * A row:
 *   name     the template's name, as the producer says it ("started from Steel Serpents")
 *   like     the game type in plain words: what the person hears first
 *   sizes    how much of mojulo it can be made with (SIZES), least first: the producer's size call starts at the least
 *            that answers the ask
 *   level1   what its first level is: a level, a match, a race, a shift
 *   words    the words people say for it that its pole's and its genres' own word lists lack
 *   lacks    what it does not do yet, beyond its pole's own `needs`
 *
 * How it is played THROUGH (levels in turns or an open world, the world's shape) is not a rail's: it is the Game
 * Brief's labour (gmn.js LABOURS). A rail says how a moment plays.
 *
 * Listed only when it reaches a playable first level today; NOT_YET names the types built apart that no door makes a
 * game from, each with what it waits on. rails.test.js holds every pole, every quick goal and every pixelizer game to a
 * row (GENERIC_GOALS aside), every `sizes` to what the tables say, and NOT_YET to still being so: a new game type is a
 * row here first.
 *
 *   SIZES, RAILS, RAIL_IDS, NOT_YET, GENERIC_GOALS
 *   railOf(id)                 → the row (with its id), or throws naming the rails
 *   railOfPole(pole) · railOfGenre(genre) · railsOfGoal(goal)
 *   seenOf(rail)               → 'side' | 'free' | 'above' | 'first-person' | 'fixed' | null: how it is seen, from its
 *                              pole's camera, else its first genre's
 *   railWords(rail)            → the words a brief uses for it: its own, its pole's, its genres'
 *   railLacks(rail)            → what it does not do yet: its own, then its pole's needs
 *   railShape(rail)            → the producer's one line: name, like, sizes, how it is seen, its first level
 *
 * Pure: no database, no clock, no dice.
 */
import { POLES } from './feel/cards.js';
import { FEEL_WORDS } from './feel/suggest.js';
import { GENRES, genreCube } from './intent.js';

const row = (o) => Object.freeze(o);
const list = (a) => Object.freeze(a);

/** How much of mojulo a game is made with, least first. */
export const SIZES = Object.freeze({
  pixel: row({ name: 'a pixelizer game', door: 'create_pixelizer_game({ reducer })', says: 'one page, no levels to design: it is the game as soon as it is made' }),
  quick: row({ name: 'a quick game', door: 'design_game({ quick: { goal } })', says: 'one level and one goal, made in a call; it can grow into a designed game later' }),
  table: row({ name: 'a table game', door: 'create_game({ tabletop | table_rpg })', says: 'a board or a pen-and-paper game on one page, played against the computer or in text' }),
  designed: row({ name: 'a designed game', door: 'design_game({ world })', says: 'the full loop: a hero, a world, a main quest and its levels, a chapter at a time' }),
});
export const SIZE_IDS = Object.freeze(Object.keys(SIZES));

/** The quick goals any rail takes: a way to end a level, not a game type. */
export const GENERIC_GOALS = Object.freeze(['reach', 'survive', 'avoid']);

export const RAILS = Object.freeze({
  // ── on foot: the house titles (each a feel template) ──
  'fallen-angel': row({ name: 'Fallen Angel', like: 'stylish action: long sword strings, launchers and air combos, guns between',
    handles: row({ pole: 'fallen-angel', genres: list(['stylish-action', 'arena-brawler']) }), sizes: list(['designed']), level1: 'a level: a gate court, a great hall, a long gallery, a sanctum and its boss' }),
  'ebon-spirits': row({ name: 'Ebon Spirits', like: 'deliberate action: committed blows, a roll, the guard, room after room',
    handles: row({ pole: 'ebon-spirits', genres: list(['dungeon-crawler', 'survival-horror']) }), sizes: list(['designed']), level1: 'a level: rooms to the exit, loot and hazards on the way' }),
  'fable-of-artesia': row({ name: 'Fable of Artesia', like: 'action adventure and action RPG: sword and shield, a land to cross, dungeons in it',
    handles: row({ pole: 'fable-of-artesia', genres: list(['action-rpg', 'top-down-adventure', 'open-adventure']) }), sizes: list(['designed']), level1: 'a level: a field, a first dungeon, what it gives the hero' }),
  'jumping-giuseppe': row({ name: 'Jumping Giuseppe', like: 'a platformer: the jump is the game, things to collect, foes to stomp',
    handles: row({ pole: 'jumping-giuseppe', genres: list(['collectathon', 'platformer-3d', 'co-op-platformer']), quick: list(['collect']) }), sizes: list(['quick', 'designed']), level1: 'a level: basics, a first foe, the harder jumps, a gauntlet, a boss if asked' }),
  'galaxy-boy': row({ name: 'Galaxy Boy', like: 'a side-on run and gun: the dash, the wall kick, a charged shot, powers that open the map',
    handles: row({ pole: 'galaxy-boy', genres: list(['metroidvania']) }), sizes: list(['designed']), level1: 'a level seen from the side, its first power at the end' }),
  'steel-serpents': row({ name: 'Steel Serpents', like: 'stealth action: guards who see what is in front of them, slipped past or taken down',
    handles: row({ pole: 'steel-serpents', genres: list(['stealth', 'tactical-espionage']), quick: list(['sneak']) }), sizes: list(['quick', 'designed']), level1: 'a level: a compound crossed unseen',
    lacks: list(['the top-down floor map with CQC and a silenced pistol (the tactical-espionage cube) has gaps']) }),
  'vigilante-justice': row({ name: 'Vigilante Justice', like: 'a hero over a city: rooftops, a glide or a swing, a crowd fought with counters',
    handles: row({ pole: 'vigilante-justice', genres: list(['city-stalker']) }), sizes: list(['designed']), level1: 'a district crossed by its rooftops' }),
  'mech-battle-kai': row({ name: 'Mech Battle Kai', like: 'robot action: a heavy machine that boosts, hovers, shoots and transforms',
    handles: row({ pole: 'mech-battle-kai', genres: list([]) }), sizes: list(['designed']), level1: 'a battlefield crossed in the machine',
    lacks: list(['no genre cube of its own: a designed game names its feel and starts from the cube nearest the ask']) }),
  'isekai-party': row({ name: 'Isekai Party', like: 'a party RPG: battles turn by turn, classes, skills and a bestiary',
    handles: row({ pole: 'isekai-party', genres: list(['jrpg', 'story-adventure', 'long-rpg']), quick: list(['battle']) }), sizes: list(['quick', 'designed']), level1: 'a level: a field, its first battles, a town' }),
  // ── with a gun ──
  conscription: row({ name: 'Conscription', like: 'a first-person shooter: a soldier\'s run, cover, the guns',
    handles: row({ pole: 'conscription', genres: list(['shooter', 'military-sim']), quick: list(['shoot']) }), sizes: list(['quick', 'designed']), level1: 'a level: armed foes behind cover, shot through to the end' }),
  'infinity-crisis': row({ name: 'Infinity Crisis', like: 'an arena shooter: movement first, a deathmatch against bots',
    handles: row({ pole: 'infinity-crisis', genres: list(['arena-shooter']), quick: list(['deathmatch']) }), sizes: list(['quick']), level1: 'a match: first to the frag limit' }),
  'cogs-of-combat': row({ name: 'Cogs of Combat', like: 'a third-person cover shooter: heavy bodies, a roadie run, an evade roll',
    handles: row({ pole: 'cogs-of-combat', genres: list([]) }), sizes: list(['designed']), level1: 'a level: armed foes behind cover, from over the shoulder',
    lacks: list(['no genre cube of its own: a designed game names its feel over the shooter\'s cube']) }),
  // ── one fight, one run ──
  'mojulo-fighter': row({ name: 'Mojulo Fighter', like: 'a one-on-one fighting game from the side: a roster, arenas, rounds',
    handles: row({ pole: 'mojulo-fighter', genres: list(['versus-fighter']), quick: list(['fight']) }), sizes: list(['quick']), level1: 'a fight: two fighters, best of its rounds' }),
  'commuter-rail-runner': row({ name: 'Commuter Rail Runner', like: 'an endless runner: three lanes, ever faster, jump, slide, coins',
    handles: row({ pole: 'commuter-rail-runner', genres: list(['endless-runner']), quick: list(['runner']) }), sizes: list(['quick', 'designed']), level1: 'a run: as far as it goes before the crash' }),
  // ── off their feet: named for their type (they have no house title yet) ──
  racing: row({ name: 'Racing', like: 'a race: a track or a road, checkpoints, rivals, the best time kept',
    handles: row({ genres: list(['racing', 'kart-racer']), quick: list(['race']) }), sizes: list(['quick']), level1: 'a race: the laps, the podium' }),
  flight: row({ name: 'Flight', like: 'flying: a gate course, a dogfight, a sector of space',
    handles: row({ genres: list(['flight-sim', 'air-combat', 'space-shooter']), quick: list(['fly']) }), sizes: list(['quick', 'designed']), level1: 'a course flown gate by gate, and the landing' }),
  sports: row({ name: 'Sports', like: 'a sport in an arena: a net game, a turn sport, a team goal game, bat and ball, an athletics meet',
    handles: row({ genres: list(['net-game', 'turn-sport', 'team-goal-game', 'athletics-meet']), quick: list(['contest', 'meet']) }), sizes: list(['quick']), level1: 'a match, or an event of the meet',
    words: list(['sport', 'match', 'tournament', 'cricket']) }),
  'board-game': row({ name: 'Board Game Simulator', like: 'a board game: chess, checkers or one written out, against the computer',
    handles: row({ genres: list([]), quick: list(['tabletop']), table: 'tabletop' }), sizes: list(['quick', 'table']), level1: 'a game of it, start to finish',
    words: list(['board game', 'chess', 'checkers', 'draughts', 'tabletop']) }),
  'table-rpg': row({ name: 'Table RPG', like: 'a pen-and-paper RPG played in text, with its printed game book',
    handles: row({ genres: list([]), table: 'table-rpg' }), sizes: list(['table']), level1: 'a first session of the module',
    words: list(['pen and paper', 'pen-and-paper', 'dungeons and dragons', 'tabletop rpg', 'game master', 'dice']) }),
  'work-sim': row({ name: 'Work Sim', like: 'a work shift: a kitchen, a farm stand, a workshop: orders worked station to station before the bell',
    handles: row({ genres: list([]), quick: list(['work']) }), sizes: list(['quick']), level1: 'a shift: the orders served by the bell',
    words: list(['cooking', 'cooking sim', 'kitchen', 'restaurant', 'overcooked', 'shift', 'orders']),
    lacks: list(['one cook: the shared kitchen (two to four on one screen) waits on its seats']) }),
  farming: row({ name: 'Farming', like: 'a farm: plant, let the days ripen it, harvest and sell',
    handles: row({ genres: list(['farming']), quick: list(['farm']) }), sizes: list(['quick']), level1: 'a day: the gold made before it ends' }),
  'tower-defense': row({ name: 'Tower Defense', like: 'tower defense: foes walk the path in waves, towers built beside it hold the base',
    handles: row({ genres: list(['tower-defense']), quick: list(['defend']) }), sizes: list(['quick']), level1: 'a base held through its waves' }),
  strategy: row({ name: 'Strategy', like: 'strategy from above: a base, workers who mine, soldiers trained and ordered about',
    handles: row({ genres: list(['rts', 'tactics']), quick: list(['conquer']) }), sizes: list(['quick']), level1: 'a skirmish: the enemy\'s base taken' }),
  rhythm: row({ name: 'Rhythm', like: 'a run to the music: jump on the beat',
    handles: row({ genres: list(['rhythm']), quick: list(['rhythm']) }), sizes: list(['quick']), level1: 'a song run for its score' }),
  puzzle: row({ name: 'Puzzle', like: 'a puzzle: boulders pushed onto their plates, blocks cleared, stones matched',
    handles: row({ genres: list(['block-puzzle', 'pixel-puzzle', 'match-3-saga']), quick: list(['puzzle']), pixel: list(['brickster', 'philosophers-stone', 'stone-saga']) }), sizes: list(['pixel', 'quick']), level1: 'a board solved; a pixelizer game is the game itself',
    words: list(['breakout', 'brick breaker', 'falling blocks', 'match-3', 'match 3', 'arcade']) }),
});
export const RAIL_IDS = Object.freeze(Object.keys(RAILS));

/** Game types built apart that no door makes a game from yet: said to the person, never offered as a rail. */
export const NOT_YET = Object.freeze({
  'beat-em-up': row({ name: 'Side-scroll beat-em-up', like: 'a street brawler down a belt, with its guns', genres: list(['co-op-brawler', 'run-and-gun']), waits: 'its belt and its fight are built as their own and not yet made from a game' }),
  'shared-kitchen': row({ name: 'Shared kitchen', like: 'two to four cooks on one screen', genres: list(['co-op-kitchen']), waits: 'the work shift\'s seats; one cook plays today (the Work Sim rail)' }),
});

const fail = (m) => new Error(`gameworld: rail${m}`);

export function railOf(id) {
  if (!RAILS[id]) throw fail(` '${id}' is not one: ${RAIL_IDS.join(', ')}`);
  return { id, ...RAILS[id] };
}
const find = (f) => { const id = RAIL_IDS.find((k) => f(RAILS[k])); return id ? railOf(id) : null; };
export const railOfPole = (pole) => find((r) => r.handles.pole === pole);
export const railOfGenre = (genre) => find((r) => r.handles.genres.includes(genre));
export const railsOfGoal = (goal) => RAIL_IDS.filter((k) => (RAILS[k].handles.quick ?? []).includes(goal)).map(railOf);

// a camera's word (a pole's view, a cube's space.camera) as how the game is seen
const SEEN = Object.freeze({
  side: 'side', 'first-person': 'first-person', fixed: 'fixed',
  'third-person': 'free', orbit: 'free', shoulder: 'free', follow: 'free', mech: 'free',
  overhead: 'above', 'top-down': 'above', iso: 'above', tactical: 'above',
});
export const SEEN_WORDS = Object.freeze({ side: 'from the side', free: 'in the round, the camera free', above: 'from above', 'first-person': 'through the hero\'s eyes', fixed: 'on one fixed screen' });

const rowOf = (rail) => (typeof rail === 'string' ? railOf(rail) : rail);

export function seenOf(rail) {
  const R = rowOf(rail), H = R.handles;
  const camera = (H.pole ? POLES[H.pole]?.view?.camera : null) ?? (H.genres[0] ? genreCube(H.genres[0])?.space?.camera : null);
  return camera ? SEEN[camera] ?? null : null;
}

export function railWords(rail) {
  const R = rowOf(rail), H = R.handles;
  return [...new Set([...(R.words ?? []), ...(H.pole ? FEEL_WORDS[H.pole] ?? [] : []), ...H.genres.flatMap((g) => GENRES[g]?.words ?? [])])];
}

export function railLacks(rail) {
  const R = rowOf(rail);
  return [...(R.lacks ?? []), ...(R.handles.pole ? POLES[R.handles.pole]?.needs ?? [] : [])];
}

export function railShape(rail) {
  const R = rowOf(rail), seen = seenOf(R);
  return `${R.name}: ${R.like}. ${R.sizes.map((s) => SIZES[s].name).join(' or ')}${seen ? `, seen ${SEEN_WORDS[seen]}` : ''}. First: ${R.level1}.`;
}
