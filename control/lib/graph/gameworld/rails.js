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
 *   genres   cosmos/fixtures.js FIXTURES (intent.js GENRES): the first is ITS OWN cube, what the template is (its
 *            tunings are read from it, built or not); the rest are the cubes near it a designed game may start from
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
 *   seen     how it is seen, said outright where its tables' cameras are not the game's (seenOf reads it alone)
 *   words    the words people say for it that its pole's and its genres' own word lists lack
 *   lacks    what it does not do yet, beyond its pole's own `needs`
 *   starter  { prompt, levels } the words its locked pitch's starter is composed from (pitch-start.js), where its genre's
 *            own one level would not be its game (the party RPG's round)
 *   steps    [{ step, does, card }] its game's own steps in the designed chain, before its first level
 *   variants { <id>: { name, like, level1, words, ask, quick, street } }: the variants of the type a door's words make
 *            (the beat-em-up's heroes): its own name and words, the step it ASKS before anything is made (`ask`, with
 *            its card), its quick door's words beside the goal and what a designed game's street carries (`street`)
 *
 * How it is played THROUGH (levels in turns or an open world, the world's shape) is not a rail's: it is the Game
 * Brief's labour (gmn.js LABOURS). A rail says how a moment plays.
 *
 * Listed only when it reaches a playable first level today; NOT_YET names the types built apart that no door makes a
 * game from, each with what it waits on (a type moves to RAILS the day the book lays it: rails.test.js fails until it does). rails.test.js holds every pole, every quick goal and every pixelizer game to a
 * row (GENERIC_GOALS aside), every `sizes` to what the tables say, and NOT_YET to still being so: a new game type is a
 * row here first.
 *
 *   SIZES, RAILS, RAIL_IDS, NOT_YET, GENERIC_GOALS
 *   railOf(id)                 → the row (with its id), or throws naming the rails
 *   railOfPole(pole) · railOfGenre(genre) · railsOfGoal(goal)
 *   seenOf(rail)               → the ways it is seen (['side', 'free']: side | free | above | first-person | fixed): the
 *                              row's own word where it says one, else its template's first, then its cubes' in order; more than one is a choice the producer
 *                              asks (side-on, or in the round?), [] when no table says
 *   railWords(rail)            → the words a brief uses for it: its own, its variants', its pole's, its genres'
 *   variantOf(rail, id)        → a variant of the rail (with its id), or throws naming the rail's variants
 *   railLacks(rail)            → what it does not do yet: its own, then its pole's needs
 *   railShape(rail)            → the producer's one line: name, like, sizes, how it is seen, its first level
 *
 * THE SIZE CALL — how much of mojulo an ask needs, the producer's first decision: a pixelizer game, a quick game, a
 * table game, or the full design loop. Advice, never a refusal: the person may ask for more or for less.
 *
 *   OWN                        what a person may want to be their own design: each is a chapter of the book, so any
 *                              one of them asks for a designed game
 *   sizeCall(rail | null, wants?) → { rail, size, door, with?, why, short?, next?, brief }
 *     wants   what the agent infers the person wants: { levels?: 1 | 2 … | 'many', own?: [<OWN>], simple?: true }
 *             (none: the least the rail is made with)
 *     size    the least size that answers it, of the rail's own; with no rail, quick or designed by the wants alone
 *     with    the rail's keys for that door: its quick goals, its pixelizer games, its table key, its genres
 *     short   { wanted, waits }: the ask wanted a size this rail does not reach yet; the largest it does is called,
 *             and what the larger one waits on is said (to the person, before anything is built)
 *     next    { size, name, says }: the next size up the rail reaches: what growing it would be
 *     brief   true for a designed game: the Game Brief (gmn.js: why it is played, how it is shaped) is asked next;
 *             a smaller game has none
 *
 * THE TWO DEPTHS — the producer knows the shape first and the details only once a rail is picked:
 *
 *   railShapes()               → { rails: [<a line a rail>], notYet: [<a line a type not made yet>] }: the shape of
 *                              what mojulo makes, the whole of what the producer holds before an ask
 *   railSheet(id)              → the rail's sheet, pulled once it is picked: { id, name, like, seen, level1, sizes:
 *                              [{ size, name, door, with }], from, starts, gaps?, tunings: { level, action, character,
 *                              world }, asks, labours, chain: [{ size, steps: [{ step, does, card? }] }], lacks, kinds? }
 *     from      its own cube, the one the tunings are read from (its first genre), or null
 *     starts    the cube a designed game starts from today: its own when the book lays it, else the nearest of its
 *               genres the book does lay (the person's game then changes the values that differ), or null
 *     gaps      what its own cube names that is not built yet ([{ facet, setting, value, status }]): why `starts` is
 *               another cube, said before anything is built
 *     tunings   the variant the rail names, each read from its tables: level (the cube's space), action (its feel
 *               template and the cube's power), character (the cube's soul), world (the cube's reality)
 *     asks      what the cube asks of a world (concerns.js)
 *     labours   the Game Brief's labours that suit it (gmn.js: advice, any labour may be mixed with any rail)
 *     chain     the tools that build it, in order, each with the card to pull when it is reached
 *     kinds     the kinds of level a game of it is built from (level-kinds.js LEVEL_KINDS), where the rail names them
 *   nearestRails(text, n?)     → [{ id, name, like, sizes, matched }] the rails whose words the text uses, most first;
 *                              a heuristic over words, said to be one: the agent, the real reader of a brief, picks
 *                              from it or asks. It suggests and refuses nothing
 *   notYetFor(text)            → [{ id, name, like, waits, matched }] the types not made yet whose own words the text uses:
 *                              said to the person before anything is built
 *
 * THE PITCH — a gameworld's `rail`: the template the person's game starts from and where their game departs from it.
 * A record the producer keeps, never a page: it lays nothing on a level, and a world without one is unchanged.
 *
 *   rail: { from: '<rail id>', size?: <SIZES>, departs?: { level?, action?, character?, world? }, locked?: true }
 *     from      the rail it is started from (a template: the game's name, hero, world and story stay theirs)
 *     size      the size the producer called (the size call), when it is said
 *     departs   where their game leaves the template, a line a tuning (TUNINGS), in the agent's own words
 *     locked    true once the person agreed the structure (how it is seen, its first level's shape): the work request
 *               chain starts from it. Content is never locked. A locked pitch moved to another rail is a RE-PLAN: said,
 *               never refused
 *
 *   TUNINGS                    the four tunings a rail names a variant in
 *   readRail(v)                → { from, size?, departs, locked }; throws, teaching
 *   railReport(world, before?) → null | { from, name, template, size?, short?, seen, level1, keeps: [<tuning>],
 *                              departs, locked, starts, gaps?, replanned?, card }: the pitch as the readout says it;
 *                              `keeps` the tunings the game takes from the template as they are, `short` a size the
 *                              rail does not reach, `replanned` { was } a locked pitch that moved (before: the world
 *                              as it stood)
 *   railMoves(world)           → { game?, play? }: the goalposts' moves a picked rail pre-answers (goalposts.js)
 *
 * Pure: no database, no clock, no dice.
 */
import { POLES } from './feel/cards.js';
import { FEEL_WORDS } from './feel/suggest.js';
import { GENRES, genreCube } from './intent.js';
import { pendingOf, PENDING, HAND_OFFS } from './genre-forms.js';
import { concernsOf } from './concerns.js';
import { LABOURS } from './gmn.js';
import { dryRun } from '../cosmos/cosmos.js';
import { levelKindsOf } from './level-kinds.js';

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
    handles: row({ pole: 'fallen-angel', genres: list(['stylish-action']) }), sizes: list(['designed']), level1: 'a level: a gate court, a great hall, a long gallery, a sanctum and its boss' }),
  'ebon-spirits': row({ name: 'Ebon Spirits', like: 'deliberate action: committed blows, a roll, the guard, room after room',
    handles: row({ pole: 'ebon-spirits', genres: list(['dungeon-crawler', 'survival-horror']) }), sizes: list(['designed']), level1: 'a level: rooms to the exit, loot and hazards on the way' }),
  'fable-of-artesia': row({ name: 'Fable of Artesia', like: 'action adventure and action RPG: sword and shield, a land to cross, dungeons in it',
    handles: row({ pole: 'fable-of-artesia', genres: list(['action-rpg', 'top-down-adventure', 'open-adventure']) }), sizes: list(['designed']), level1: 'a level: a field, a first dungeon, what it gives the hero' }),
  'jumping-giuseppe': row({ name: 'Jumping Giuseppe', like: 'a platformer: the jump is the game, things to collect, foes to stomp',
    handles: row({ pole: 'jumping-giuseppe', genres: list(['collectathon', 'platformer-3d', 'co-op-platformer']), quick: list(['collect']) }), sizes: list(['quick', 'designed']), level1: 'a level: basics, a first foe, the harder jumps, a gauntlet, a boss if asked' }),
  'galaxy-boy': row({ name: 'Galaxy Boy', like: 'a side-on run and gun: the dash, the wall kick, a charged shot, powers that open the map',
    handles: row({ pole: 'galaxy-boy', genres: list(['metroidvania']) }), sizes: list(['designed']), level1: 'a level seen from the side, its first power at the end' }),
  'steel-serpents': row({ name: 'Steel Serpents', like: 'stealth action: guards who see what is in front of them, slipped past or taken down',
    // (seen in the third person, the operator's word: the template's lab view is from overhead and the espionage cube's
    // from above, neither the game's camera)
    handles: row({ pole: 'steel-serpents', genres: list(['stealth', 'tactical-espionage', 'cinematic-action']), quick: list(['sneak']) }), sizes: list(['quick', 'designed']), level1: 'a level: a base infiltrated layer by layer, unseen',
    seen: list(['free']) }),
  'vigilante-justice': row({ name: 'Vigilante Justice', like: 'a hero over a city: rooftops, a glide or a swing, a crowd fought with counters',
    handles: row({ pole: 'vigilante-justice', genres: list(['city-stalker']) }), sizes: list(['designed']), level1: 'a district crossed by its rooftops' }),
  'hijack-city': row({ name: 'Hijack City', like: 'an open city crime game: any car taken, a contact\'s missions, a wanted level and the police after it, shops, the street alive',
    // (its starter is its own, gameworld/hijack-city.js: the district, the story, the law and the shops laid together)
    handles: row({ genres: list(['open-city-crime']) }), sizes: list(['designed']), level1: 'a district: its streets and cars, its law, a contact\'s first missions',
    seen: list(['free']), words: list(['gta', 'grand theft auto', 'gta-like', 'open world crime', 'crime sandbox', 'carjacking', 'wanted level', 'police chase', 'steal cars']) }),
  'mech-battle-kai': row({ name: 'Mech Battle Kai', like: 'robot action: a heavy machine that boosts, hovers, shoots and transforms',
    handles: row({ pole: 'mech-battle-kai', genres: list([]) }), sizes: list(['designed']), level1: 'a battlefield crossed in the machine',
    lacks: list(['no genre cube of its own: a designed game names its feel and starts from the cube nearest the ask']) }),
  // (its starter is the ROUND, compose.js: the town at its heart with an inn, a temple and a save point, the wilds as the
  // world map's blocks, a castle that keeps the core's key, and the dungeon at the core with its boss; laid in words the
  // composer reads, and taught as the round's steps beside the designed game's own)
  'isekai-party': row({ name: 'Isekai Party', like: 'a party RPG: battles turn by turn, classes, skills and a bestiary',
    handles: row({ pole: 'isekai-party', genres: list(['jrpg', 'story-adventure', 'long-rpg']), quick: list(['battle']) }), sizes: list(['quick', 'designed']),
    level1: 'the round: a town at its heart (an inn, a temple, a save point), the wilds with their first battles, a castle keeping the key, and the dungeon at the core with its boss',
    starter: row({ prompt: 'a jrpg: a walled town, the wilds with monsters, a castle, and a dungeon with a boss', levels: 4 }),
    steps: list([
      row({ step: 'round', does: 'the round as a mandala (megaworld): the town, the wilds and the castle round it, the core behind a key; its save points (saves), and a crossing by ship or airship where the world goes further', card: 'gameworld-world' }),
      row({ step: 'battles', does: 'the party and its classes, the packs, the boss as a party battle with its pattern and its pages, the states', card: 'gameworld-battles' }),
      row({ step: 'talk', does: 'the townspeople: what each says, as pages that follow the story (the key held, the boss beaten)', card: 'gameworld-folk' }),
    ]) }),
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
  // ── down a street, side on: named for their type ──
  'beat-em-up': row({ name: 'Side-scroll Beat-em-up', like: 'a beat-em-up down a street: wave after wave fought hand to hand, one to four players on one screen',
    handles: row({ genres: list(['co-op-brawler']), quick: list(['brawl']) }), sizes: list(['quick', 'designed']), level1: 'a street: its stops held wave by wave, a boss at the end',
    seen: list(['side']), words: list(['streets of rage', 'double dragon']),
    variants: row({
      // its heroes variant: a team of heroes each with a power, an army, a villain at the end (the street's `heroes`
      // tuning, brawl/brawl-tunings.js; a quick brawl's `heroes`, quick.js readHeroes)
      heroes: row({ name: 'Superhero Beat-em-up', like: 'a team of heroes down a street, each with one power on its own button: an army that drops in, a villain at the end',
        level1: 'a street of the heroes\' campaign: its stops held against the army, its boss at the end; the streets after it climb to the villain\'s lair',
        words: list(['superhero beat em up', 'super hero beat em up', 'hero beat em up', 'superhero brawler', 'x-men arcade']),
        ask: row({ step: 'heroes', does: 'ASK FIRST: who the heroes are (a sentence each, or ones made with create_character) and each one\'s power, and the villain: theirs to design (the pack\'s team if they have none)', card: 'gameworld-heroes' }),
        quick: 'heroes: { team, villain }', street: row({ tuning: 'heroes' }) }),
    }) }),
  'run-and-gun': row({ name: 'Run and Gun', like: 'a run and gun down a street: the same waves fought with guns, a roll, grenades, a crowd that shoots back',
    handles: row({ genres: list(['run-and-gun']), quick: list(['rungun']) }), sizes: list(['quick', 'designed']), level1: 'a street: its stops shot through wave by wave, a boss at the end',
    seen: list(['side']) }),
  // ── off their feet: named for their type (they have no house title yet) ──
  racing: row({ name: 'Racing', like: 'a race: a track or a road, checkpoints, rivals, the best time kept',
    handles: row({ genres: list(['racing', 'kart-racer']), quick: list(['race']) }), sizes: list(['quick']), level1: 'a race: the laps, the podium' }),
  flight: row({ name: 'Flight', like: 'flying: a gate course, a dogfight, a sector of space',
    handles: row({ genres: list(['air-combat']), quick: list(['fly']) }), sizes: list(['quick', 'designed']), level1: 'a course flown gate by gate, and the landing' }),
  // a licence earned lesson by lesson (pilot-school.js: its starter, the lessons on one airfield, each graded)
  'pilot-school': row({ name: 'Pilot School', like: 'learning to fly a light aircraft: lessons on one airfield, each graded bronze to gold, a licence at the end',
    handles: row({ genres: list(['flight-sim']) }), sizes: list(['designed']), level1: 'a lesson: the take-off, the first rings, leveling off over the field',
    words: list(['pilot school', 'flight school', 'learn to fly', 'flying lessons', 'flight lessons', 'flight training', 'pilot licence', 'pilot license', 'pilotwings', 'flight instructor', 'realistic flight']),
    lacks: list(['the circuit and the landing lesson, the stall, the cross-country, the crosswind and the check ride are later lessons, laid on the same words']) }),
  // stages flown down a path, flight as a concept (wolf-squadron.js: its starter, a planet's canyon and a field of rocks)
  'wolf-squadron': row({ name: 'Wolf Squadron', like: 'an arcade flight shooter: stages flown down a path on planets and in space, boost, brake and roll, waves of fighters, a boss at the end of each',
    handles: row({ genres: list(['space-shooter']) }), sizes: list(['designed']), level1: 'a stage: down a canyon on a planet, its waves and its boss',
    words: list(['wolf squadron', 'rail shooter', 'on-rails shooter', 'on rails shooter', 'arcade flight', 'arcade space shooter', 'starfighter', 'star fox', 'starfox', 'rogue squadron', 'barrel roll', 'space fighter game']),
    lacks: list(['the squad and its calls, the rival squad and the all-range arena are to come', 'its cube is the space shooter\'s: its stages fly on the rail rule (power.rules=rail), which a stage of its own names']) }),
  // a scrolling shooter, left to right (blaze-gunner.js: its starter, the fleet's edge; gameworld/scroll-stage/)
  'blaze-gunner': row({ name: 'Blaze Gunner', like: 'a scrolling shooter: a small ship on the d-pad over a screen that scrolls on its own, waves in formation, pods taken from foes for weapons, a capital ship broken by its systems at the end of each stage',
    handles: row({ genres: list(['co-op-scroller']) }), sizes: list(['designed']), level1: 'a stage: waves in the open, a hull run, the boss broken by its systems',
    seen: list(['side', 'above']),
    words: list(['blaze gunner', 'shmup', 'shoot em up', "shoot 'em up", 'bullet hell', 'scrolling shooter', 'horizontal shooter', 'side scrolling shmup', 'gradius', 'r-type', 'einhander', 'gunpod', 'gunpods']),
    lacks: list(['a vertical stage (seen from above, scrolling up) is the same stage turned: its frame is built, its first recipe is to come', 'its stage\'s own lives are the World page\'s: a designed level is lost when the ship is down, its continue the game\'s']) }),
  // a war flown from the cockpit, mission by mission (rebel-storm.js: its starter, the rebels' opening tour)
  'rebel-storm': row({ name: 'Rebel Storm / Rise of Empire', like: 'a space combat sim flown from the cockpit: the throttle set, the target picked, shields and power split, flight groups to destroy and craft to protect, a campaign of missions from either side of a war',
    handles: row({ genres: list(['space-sim']) }), sizes: list(['designed']), level1: 'a mission: a patrol of fighters met with Red flight, interceptors jumping in',
    words: list(['rebel storm', 'rise of empire', 'space combat sim', 'space sim', 'cockpit', 'x-wing', 'tie fighter', 'wing commander', 'freespace', 'flight groups', 'space combat campaign']),
    lacks: list(['Rise of Empire, the other side\'s campaign, is laid on the same words to come; debriefs between missions are to come']) }),
  sports: row({ name: 'Sports', like: 'a sport in an arena: a net game, a turn sport, a team goal game, bat and ball, an athletics meet',
    handles: row({ genres: list(['net-game', 'turn-sport', 'team-goal-game', 'athletics-meet']), quick: list(['contest', 'meet']) }), sizes: list(['quick']), level1: 'a match, or an event of the meet',
    words: list(['sport', 'match', 'tournament', 'cricket']) }),
  'board-game': row({ name: 'Board Game Simulator', like: 'a board game: chess, checkers or one written out, against the computer',
    handles: row({ genres: list([]), quick: list(['tabletop']), table: 'tabletop' }), sizes: list(['quick', 'table']), level1: 'a game of it, start to finish',
    words: list(['board game', 'chess', 'checkers', 'draughts', 'tabletop']) }),
  'table-rpg': row({ name: 'Table RPG', like: 'a pen-and-paper RPG played in text, with its printed game book',
    handles: row({ genres: list([]), table: 'table-rpg' }), sizes: list(['table']), level1: 'a first session of the module',
    words: list(['pen and paper', 'pen-and-paper', 'dungeons and dragons', 'tabletop rpg', 'game master', 'dice']) }),
  'work-sim': row({ name: 'Work Sim', like: 'a work shift: a kitchen, a farm stand, a workshop: orders worked station to station before the bell; alone, or two or four cooks sharing a kitchen of its own on one screen (quick.cooks), handing what they make across a pass',
    handles: row({ genres: list(['co-op-kitchen']), quick: list(['work']) }), sizes: list(['quick']), level1: 'a shift: the orders served by the bell (with cooks: in a kitchen of its own, each cook on a side of its counter)',
    words: list(['cooking', 'cooking sim', 'kitchen', 'restaurant', 'shift', 'orders', 'co-op kitchen', 'co-op cooking', 'cooking together', 'cook together', 'overcooked']) }),
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
export const NOT_YET = Object.freeze({});

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

export { seenSays };
export function seenOf(rail) {
  const R = rowOf(rail), H = R.handles;
  if (R.seen) return [...R.seen];
  const cameras = [H.pole ? POLES[H.pole]?.view?.camera : null, ...H.genres.map((g) => genreCube(g)?.space?.camera)];
  return [...new Set(cameras.map((c) => (c ? SEEN[c] : null)).filter(Boolean))];
}
const seenSays = (seen) => seen.map((w) => SEEN_WORDS[w]).join(', or ');

export function railWords(rail) {
  const R = rowOf(rail), H = R.handles;
  return [...new Set([...(R.words ?? []), ...Object.values(R.variants ?? {}).flatMap((V) => V.words ?? []), ...(H.pole ? FEEL_WORDS[H.pole] ?? [] : []), ...H.genres.flatMap((g) => GENRES[g]?.words ?? [])])];
}
export function variantOf(rail, id) {
  const R = rowOf(rail), V = R.variants?.[id];
  if (!V) throw new Error(`gameworld: ${R.id} has ${R.variants ? `the variants ${Object.keys(R.variants).join(', ')}` : 'no variants'}, not '${id}'`);
  return { id, ...V };
}

export function railLacks(rail) {
  const R = rowOf(rail);
  return [...(R.lacks ?? []), ...(R.handles.pole ? POLES[R.handles.pole]?.needs ?? [] : [])];
}

export function railShape(rail) {
  const R = rowOf(rail), seen = seenOf(R), V = Object.entries(R.variants ?? {});
  return `${R.name}: ${R.like}. ${R.sizes.map((s) => SIZES[s].name).join(' or ')}${seen.length ? `, seen ${seenSays(seen)}` : ''}. First: ${R.level1}.${V.length ? ` Variants: ${V.map(([id, v]) => `${v.name} (${id}: ${v.like})`).join('; ')}.` : ''}`;
}

// ══════════ the size call ══════════

/** What a person may want to be their own design. Each is a chapter of the book: any one asks for a designed game. */
export const OWN = Object.freeze({
  hero: 'a hero of their own design',
  world: 'a world of their own: its places, its look',
  story: 'a story: a main quest, an ending',
  cast: 'a cast or foes of their own',
  progression: 'something kept from level to level: powers, gear, a save',
});
const WANT_KEYS = ['levels', 'own', 'simple'];
const wantFail = (m) => new Error(`gameworld: a size call's wants${m}`);

function readWants(w) {
  if (w === undefined || w === null) return { levels: 1, own: [], simple: false };
  if (typeof w !== 'object' || Array.isArray(w)) throw wantFail(` are { levels?, own?, simple? }`);
  for (const k of Object.keys(w)) if (!WANT_KEYS.includes(k)) throw wantFail(`.${k} is not one (${WANT_KEYS.join(', ')})`);
  const levels = w.levels ?? 1;
  if (levels !== 'many' && !(Number.isInteger(levels) && levels >= 1)) throw wantFail(`.levels is how many levels the game has: 1, 2 … or 'many'`);
  const own = w.own ?? [];
  if (!Array.isArray(own) || own.some((o) => !OWN[o])) throw wantFail(`.own is what is theirs to design: [${Object.keys(OWN).join(' | ')}]`);
  if (w.simple !== undefined && typeof w.simple !== 'boolean') throw wantFail('.simple is true when they asked for something small');
  return { levels, own: [...new Set(own)], simple: w.simple === true };
}

// a rail's keys for a size's door
const keysFor = (R, size) => {
  const H = R.handles;
  if (size === 'pixel') return { reducer: [...H.pixel] };
  if (size === 'quick') return { goal: [...H.quick] };
  if (size === 'table') return { key: H.table === 'table-rpg' ? 'table_rpg' : 'tabletop' };
  return { ...(H.genres.length ? { from: [...H.genres] } : {}), ...(H.pole ? { feel: H.pole } : {}) };
};

export function sizeCall(rail, wants) {
  const W = readWants(wants), R = rail == null ? null : rowOf(rail);
  const more = W.levels !== 1, asksBook = more || W.own.length > 0;
  const reason = asksBook
    ? [more ? (W.levels === 'many' ? 'many levels' : `${W.levels} levels`) : null, ...W.own.map((o) => OWN[o])].filter(Boolean).join('; ')
    : W.simple ? 'something small was asked for' : 'one level answers it';
  if (!R) {
    const size = asksBook ? 'designed' : 'quick';
    return { rail: null, size, door: SIZES[size].door, why: `${reason}: ${SIZES[size].name}`, ...(size === 'quick' ? { next: { size: 'designed', name: SIZES.designed.name, says: SIZES.designed.says } } : {}), brief: size === 'designed' };
  }
  const reach = R.sizes, top = reach[reach.length - 1];
  const size = !asksBook ? reach[0] : reach.includes('designed') ? 'designed' : top;
  const at = reach.indexOf(size), up = reach[at + 1];
  // the ask wanted the book and the rail does not reach it: what its own genre waits on, said
  const waits = asksBook && size !== 'designed' ? (pendingOf(R.handles.genres[0])?.waits ?? `${R.name} is not laid as a designed game yet`) : null;
  return {
    rail: R.id, size, door: SIZES[size].door, with: keysFor(R, size),
    why: waits ? `${reason}: that asks for ${SIZES.designed.name}, which ${R.name} does not reach yet; ${SIZES[size].name} is what it is made with today` : `${reason}: ${SIZES[size].name}`,
    ...(waits ? { short: { wanted: 'designed', waits } } : {}),
    ...(up ? { next: { size: up, name: SIZES[up].name, says: SIZES[up].says } } : {}),
    brief: size === 'designed',
  };
}

// ══════════ the two depths: the shape, then the sheet ══════════

export function railShapes() {
  return {
    rails: RAIL_IDS.map((id) => `${id}: ${railShape(id)}`),
    notYet: Object.entries(NOT_YET).map(([id, N]) => `${id}: ${N.name}: ${N.like}. Not a game yet: ${N.waits}.`),
  };
}

/** A genre the book lays as a designed game today: its cube makeable, not waiting on its form, not another door's. */
export const laidGenre = (g) => !!GENRES[g] && !PENDING[g] && !HAND_OFFS[g] && dryRun(genreCube(g)).verdict === 'makeable';

// the steps that build a rail at a size, in order, each with the card pulled when it is reached
function chainOf(R, size, from, V = null) {
  const H = R.handles;
  if (size === 'pixel') return [{ step: 'make', does: `create_pixelizer_game({ reducer: ${H.pixel.map((p) => `'${p}'`).join(' | ')} }): it is the game` }];
  if (size === 'table') return [{ step: 'make', does: `create_game({ ${H.table === 'table-rpg' ? 'table_rpg' : 'tabletop'}: { … } })`, card: H.table }];
  // (a variant asks its own question first, before anything is made, and its quick door carries its words)
  if (size === 'quick') return [
    ...(V?.ask ? [{ ...V.ask }] : []),
    ...H.quick.map((g) => ({ step: 'make', does: V?.quick ? `design_game({ quick: { goal: '${g}', ${V.quick} } }): its streets, made in a call` : `design_game({ quick: { goal: '${g}' } }): one level, made in a call`, card: V?.ask?.card ?? `gameworld-quick-${g}` })),
    { step: 'play', does: 'the person plays it: the eyes gate is theirs' },
  ];
  const level1 = V?.level1 ?? R.level1, street = V?.street ? ` (its street: ${Object.entries(V.street).map(([k, v]) => `${k}: '${v}'`).join(', ')})` : '';
  return [
    { step: 'intake', does: 'what the person brought, placed or set aside', card: 'gameworld-producer' },
    { step: 'brief', does: 'why it is played and how it is shaped: the motivations and the labours', card: 'gameworld-brief' },
    ...(from ? [{ step: 'intent', does: `intent: { from: '${from}' }, then the cube's values the person's game changes`, card: `gameworld-intent-${from}` }] : [{ step: 'intent', does: 'the cube nearest the ask, its values changed to the person\'s game', card: 'gameworld-intent' }]),
    ...(H.pole ? [{ step: 'feel', does: `feel: '${H.pole}', tuned toward their game; tried in a practice room before any level`, card: 'gameworld-feel' }] : []),
    ...(V?.ask ? [{ ...V.ask }] : []),
    { step: 'chapters', does: 'the book a chapter at a time: the hero, the world, the main quest, the foes', card: 'gameworld-studio' },
    // (a rail's own steps, its game's shape taught before its first level: the party RPG's round)
    ...(R.steps ?? []).map((x) => ({ ...x })),
    { step: 'first-level', does: `the first level: ${level1}${street}; made, then proved by the machine gate`, card: 'gameworld-ledger' },
    { step: 'play', does: 'the person plays it: the eyes gate is theirs' },
  ];
}

export function railSheet(id, variant = null) {
  const R = railOf(id), H = R.handles, V = variant ? variantOf(R, variant) : null;
  const from = H.genres[0] ?? null, cube = from ? genreCube(from) : null;
  const starts = H.genres.find(laidGenre) ?? null;
  const dry = cube ? dryRun(cube) : null, gaps = dry ? [...dry.blocked, ...dry.gaps].map(({ facet, setting, value, status }) => ({ facet, setting, value, status })) : [];
  const pole = H.pole ? POLES[H.pole] : null;
  return {
    id: R.id, ...(V ? { variant: V.id } : {}), name: V?.name ?? R.name, like: V?.like ?? R.like, seen: seenOf(R), level1: V?.level1 ?? R.level1,
    ...(R.variants && !V ? { variants: Object.entries(R.variants).map(([vid, v]) => ({ id: vid, name: v.name, like: v.like })) } : {}),
    sizes: R.sizes.map((size) => ({ size, name: SIZES[size].name, door: SIZES[size].door, with: keysFor(R, size) })),
    from, starts, ...(gaps.length ? { gaps } : {}),
    tunings: {
      level: cube?.space ? { ...cube.space } : null,
      action: pole || cube?.power ? { ...(pole ? { feel: H.pole, base: pole.base, says: pole.says } : {}), ...(cube?.power ?? {}) } : null,
      character: cube?.soul ? { ...cube.soul } : null,
      world: cube?.reality ? { ...cube.reality } : null,
    },
    asks: cube ? concernsOf(cube).map((c) => c.id) : [],
    labours: Object.keys(LABOURS).filter((l) => LABOURS[l].genres.some((g) => H.genres.includes(g))),
    chain: R.sizes.map((size) => ({ size, steps: chainOf(R, size, size === 'designed' ? starts : null, V) })),
    lacks: railLacks(R),
    // (the kinds of level a game of it is built from, level-kinds.js: each picked by name, its laws its proof)
    ...(levelKindsOf(R.id).length ? { kinds: levelKindsOf(R.id).map((k) => ({ ...k })) } : {}),
  };
}

const norm = (t) => ` ${String(t ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ')} `;
const longest = (ws) => Math.max(...ws.map((w) => w.length));
const byMatch = (a, b) => b.matched.length - a.matched.length || longest(b.matched) - longest(a.matched);

export function nearestRails(text, n = 3) {
  const t = norm(text);
  return RAIL_IDS
    .map((id) => {
      const matched = railWords(id).filter((w) => t.includes(` ${w} `));
      // (a variant whose own words the text uses is named, with its own name)
      const V = Object.entries(RAILS[id].variants ?? {}).find(([, v]) => v.words.some((w) => matched.includes(w)));
      return { id, ...(V ? { variant: V[0] } : {}), name: V ? V[1].name : RAILS[id].name, like: V ? V[1].like : RAILS[id].like, sizes: [...RAILS[id].sizes], matched };
    })
    .filter((r) => r.matched.length).sort(byMatch).slice(0, n);
}

export function notYetFor(text) {
  const t = norm(text);
  return Object.entries(NOT_YET)
    .map(([id, N]) => ({ id, name: N.name, like: N.like, waits: N.waits, matched: N.words.filter((w) => t.includes(` ${w} `)) }))
    .filter((r) => r.matched.length).sort(byMatch);
}

// ══════════ the pitch: a gameworld's `rail` ══════════

/** The four tunings a rail names a variant in. */
export const TUNINGS = Object.freeze({
  level: 'how its levels are laid and seen',
  action: 'how its buttons feel and what the hero does',
  character: 'who the hero is and how they are drawn',
  world: 'where it is set and how it looks',
});
const RAIL_KEYS = ['from', 'variant', 'size', 'departs', 'locked'];
const pitchFail = (m) => new Error(`gameworld: rail${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readRail(v) {
  if (!isObj(v)) throw pitchFail(` is { from, variant?, size?, departs?, locked? }: the template the game starts from and where it departs (get_game_vocab({ id: 'gameworld-rails' }))`);
  for (const k of Object.keys(v)) if (!RAIL_KEYS.includes(k)) throw pitchFail(`.${k} is not part of a pitch (${RAIL_KEYS.join(', ')})`);
  if (!RAILS[v.from]) throw pitchFail(`.from is the rail it starts from: ${RAIL_IDS.join(', ')}`);
  if (v.variant !== undefined && !RAILS[v.from].variants?.[v.variant]) throw pitchFail(`.variant is one of ${v.from}'s variants: ${Object.keys(RAILS[v.from].variants ?? {}).join(', ') || 'it has none'}`);
  if (v.size !== undefined && !SIZES[v.size]) throw pitchFail(`.size is the size called: ${SIZE_IDS.join(', ')}`);
  if (v.departs !== undefined) {
    if (!isObj(v.departs)) throw pitchFail(`.departs is { ${Object.keys(TUNINGS).map((k) => `${k}?`).join(', ')} }: where their game leaves the template, a line each`);
    for (const [k, w] of Object.entries(v.departs)) {
      if (!TUNINGS[k]) throw pitchFail(`.departs.${k} is not a tuning (${Object.keys(TUNINGS).join(', ')})`);
      if (typeof w !== 'string' || !w.trim()) throw pitchFail(`.departs.${k} is a line: ${TUNINGS[k]}, as their game has it`);
    }
  }
  if (v.locked !== undefined && typeof v.locked !== 'boolean') throw pitchFail('.locked is true once the person agreed the structure');
  return { from: v.from, ...(v.variant !== undefined ? { variant: v.variant } : {}), ...(v.size !== undefined ? { size: v.size } : {}), departs: Object.fromEntries(Object.entries(v.departs ?? {}).map(([k, w]) => [k, w.trim()])), locked: v.locked === true };
}

export function railReport(world, before = null) {
  if (!isObj(world) || world.rail === undefined || world.rail === null) return null;
  const P = readRail(world.rail), R = railOf(P.from), S = railSheet(P.from, P.variant ?? null);
  const short = P.size && !R.sizes.includes(P.size) ? { wanted: P.size, reaches: [...R.sizes], waits: pendingOf(R.handles.genres[0])?.waits ?? `${R.name} is not made at that size yet` } : null;
  const was = (() => { try { return isObj(before?.rail) ? readRail(before.rail) : null; } catch { return null; } })();
  return {
    from: P.from, ...(P.variant ? { variant: P.variant } : {}), name: S.name, template: `a template: the game is theirs, started from ${S.name}`,
    ...(P.size ? { size: P.size } : {}), ...(short ? { short } : {}),
    seen: S.seen, level1: S.level1,
    keeps: Object.keys(TUNINGS).filter((k) => !P.departs[k]), departs: P.departs, locked: P.locked,
    starts: S.starts, ...(S.gaps ? { gaps: S.gaps } : {}),
    ...(was?.locked && was.from !== P.from ? { replanned: { was: was.from } } : {}),
    card: `gameworld-rail-${P.from}${P.variant ? `-${P.variant}` : ''}`,
  };
}

export function railMoves(world) {
  const P = (() => { try { return isObj(world?.rail) ? readRail(world.rail) : null; } catch { return null; } })();
  if (!P) return {};
  const R = railOf(P.from), S = railSheet(P.from);
  return {
    game: S.starts ? `write intent: { from: '${S.starts}' } (${R.name}'s cube${S.starts !== S.from ? ' today' : ''}), then the values their game changes (gameworld-rail-${P.from})` : `write intent from the cube nearest their game: ${R.name} has none the book lays (gameworld-rail-${P.from})`,
    ...(R.handles.pole ? { play: `write feel: '${R.handles.pole}' (${R.name}'s), tuned toward their game; write the motion and the actions (gameworld-feel)` } : {}),
  };
}
