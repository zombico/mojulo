/**
 * THE QUICK PATH — a game whose LOOP is simple: one level and one goal, no hero book, no stats, no progression. Its
 * graphics are not simple: the ground is the world's (a kit, a look in words, the land), the hero is any hero the hero
 * door draws (every word of it, gear and paint included) or none at all (first person), and the goal is dressed by the
 * game's own decoration (glyph forms chosen by the pickup's word, sparkles, the exit's marker) and the shell's theme.
 *
 *   gameworld.quick: {
 *     goal: 'reach' | 'collect' | 'survive' | 'avoid' | 'race' | 'sneak' | 'rhythm' | 'defend' | 'puzzle' | 'farm' | 'battle' | 'fly',
 *     hero?: <a hero-door spec> | false,    // false or absent: first person, you are the camera
 *     ride?: 'car' | 'coupe' | 'van',        // the hero is a vehicle (ride.js): driven, its feel derived from its build
 *     transformer?: { robot?, vehicle?, scheme?, fold?, legs?, height? },   // the hero TRANSFORMS (transformation/: B,
 *                                           // the pad's L3): a robot that is a vehicle too. robot: { variable: { palette? } }
 *                                           // a variable suit folding into its waverider, { alien: { palette? } } an alien
 *                                           // body of pointed shells folding into a hover jetski; vehicle: { supercar } |
 *                                           // { ride } | { racer } a car that stands up into a robot (scheme 'car-bot', or
 *                                           // 'rear-foot': its legs together the rear, the head popping out of the
 *                                           // middle), { craft } a jet that does ('jet-bot', or 'fuselage-fold' with fold
 *                                           // 'front' | 'back' and legs 'stretch' | 'box'). A car's and a jetski's goals
 *                                           // are a trail's (reach, collect, survive, avoid, race alone); a flier's the
 *                                           // fly goal, flown from its seat in the air
 *     climb?: true,                         // a climb after the trail, the exit at its top
 *     building?: { use, seed?, goal?, … },  // the level is a building in place of the trail (gameworld building levels):
 *                                           // entered at its way in, its goal room the end, pickups in its other rooms
 *     pickup?: '<word>',                    // collect: what lies along the way (its word picks the glyph: coin, key, star…)
 *     seconds?: n,                          // survive: how long
 *     track?: 'trail' | 'loop',             // race: run the trail end to end, or go round a loop laid on its land
 *     vehicle?: '<class>',                  // ride: the physics it plays (roads/vehicles.js VEHICLES), its look the ride's
 *     tuning?: 'sim' | 'arcade',            // ride: the derived envelope as is, or lifted (vehicles.js)
 *     conditions?: 'dry' | 'wet' | 'snow' | 'ice',   // ride: the road's grip in the weather
 *     roadway?: '<preset>' | { … },          // race: on a roadway built for driving (roads/course.js COURSE_PRESETS,
 *                                           // or a course spec), its land dressed: a lap or a stage, as the course is;
 *                                           // or { intent: 'words' }: the track from words (roads/trackscape-compose.js)
 *     laps?: n,                             // race: times round (1 to 9; 3 on a loop, 1 on a trail)
 *     rivals?: n,                           // race: rival drivers in the same car (1 to 7; a ride's), racing for a place
 *     racers?: n | [<racer>, …],            // race: a field of cartoon racers (2 to 8), each in the machine its driver
 *                                           // reads as (car-designer/roster.js), the first yours, the rest your rivals:
 *                                           // n drawn, or each an archetype, a brief in words, or { archetype?, build?,
 *                                           // age?, brief?, facets?, seed?, parts?, shade?, tuning? }; balanced, each
 *                                           // on its own physics (shade 'smooth': bevelled parts, smooth light; 'cel' the
 *                                           // default), each driver rolled in the game's setting
 *     guards?: n,                           // sneak: how many guards keep the trail (1 to 8, 3), on its beats
 *     guard?: <a hero-door spec>,           // sneak: what a guard looks like (by default, rolled in the game's setting:
 *                                           // gameworld/cast-setting.js)
 *     alarms?: n,                           // sneak: how many sightings end it (1: the first)
 *     music?: '<mood>' | 'auto',            // rhythm: the field score whose beat it runs to (wayfarer). Any other goal:
 *                                           // a field score under each level, one identity across the game ('auto':
 *                                           // the mood each level's place and play call for, beats/score-suggest.js)
 *     sfx?: 'auto' | '<palette>',           // action sounds wired to the goal's events, in the music's key ('auto': the
 *                                           // palette the score implies; arcade, foley, orchestral, synth; beats/sfx-palettes.js)
 *     misses?: n,                           // rhythm: how many presses off the beat end it (none: no limit)
 *     waves?: n, lives?: n, pads?: n,       // defend: how many waves (3), lives (5), tower pads by the trail (4)
 *     foe?, tower?: <a hero-door spec>      // defend: what a foe and a tower's archer look like (rolled by default)
 *     board?: true | { cols?, rows?, gold? }   // conquer: the skirmish's board and its purse (board/board-rts.js)
 *     sides?: [player, enemy?]              // conquer: each side a civilization of the world (its id) or one in
 *                                           // words ('armoured walkers, laser carbines, a sentry turret'), fielding
 *                                           // what its technology crafts (board/board-rts-tech.js); a side not
 *                                           // named plays the plain worker, soldier and archer
 *     doctrine?: 'economy' | 'aggression' | 'fortress' | 'science'   // conquer: how the player chose to play
 *     match?: true                          // conquer: a whole match (board-rts.js rts.match): a lobby first, the
 *                                           // fog, the melee rule, a field a side, results, rematch
 *     board?: true | { cols?, rows?, gold? }   // defend: a TOWER DEFENCE on the stage's spots (board/board-td.js):
 *                                           // towers on any free spot that keeps the road open, the waves the
 *                                           // ladder's (waves: 1 to 5), no hero; without it, the trail's defence
 *     boulders?: n,                         // puzzle: how many boulders to push onto their plates (2, at most 4)
 *     craft?: 'glider' | 'trainer' | 'jet', // fly: the aircraft (skyscape/eye.js CRAFT); the map and the course are its
 *     assist?: 'arcade' | 'sim',            // fly: never stalls, wings level quickly | the bank holds (absent: between)
 *     airspace?: { map?, ground?, course? }, // fly: the flight map (an island by default), as an airspace level takes it
 *     plots?: n, target?: n, days?: n,     // farm: plots (6), the gold to make (40), by which day (6)
 *     folk?: n, farmhand?: <a hero-door spec> // farm: farmhands keeping their day (2), and their looks (rolled by default)
 *     foes?: n,                             // battle: how many foes stand on the trail to be fought turn by turn (3)
 *     moves?: true,                         // every person the run makes (the hero, foes, guards, towers, farmhands) is
 *                                           // made with its own hit, stagger, fall and rise, and plays them (the world's)
 *     cast?: true | { scale?, n?, cast?, anchor?, bodies?, factions?, seed? },   // on foot: the people rolled for the
 *                                           // game (gameworld/casting.js, its page less the journey; true: a party of
 *                                           // one). Its party and familiars walk beside you from the start and fight
 *                                           // what you fight; a rival with a person's body is the first foe where the
 *                                           // goal has foes (battle, shoot, deathmatch)
 *     roster?: [<fighter>, …],              // fight: the fighters, each a CHARACTER (versus/versus-sheet.js): an Egocube
 *                                           // sheet (an archetype word, a brief, { brief?, facets?, seed?, archetype?,
 *                                           // role?, build?, age?, name?, color? }) made into one by the run, or { hero:
 *                                           // { ref } } (one made with create_character); the fight read off the sheet,
 *                                           // the entry's style?, signature?, weapon?, library?, normals?, specials?,
 *                                           // super?, tune? over it; four sheets (one per style) if absent
 *     game?, human?, lift?: 'holo',        // tabletop: the board game (chess, checkers, one written out), the player you
 *                                           // are, and its depiction: lifted into a hologram arena (tabletop/holo-arena.js),
 *                                           // players 0..2 and level as a contest's
 *     athletes?: false | [<athlete>, …],   // meet, contest: who plays, each slot (a lane, a side's player, a seat) a
 *                                           // CHARACTER in its own body on the arena's page (contest/athletes.js): { ref }
 *                                           // (one made with create_character) or a hero-door spec made by the run, cycled
 *                                           // over the slots; absent, rolled in the game's setting (cast-setting.js: its
 *                                           // tradition is how they are drawn) in the sport's kit (sportswear/kits.js), a
 *                                           // team's sides each a rank in its side's colour with a keeper in a kit of its
 *                                           // own; false, the arena's stick figures
 *     kits?: [<kit words>, …],              // meet, contest: the rolled athletes' kits ({ sport?, colours?, pattern?,
 *                                           // trim?, socks? }), cycled over the sides (a court, a pitch) or the athletes
 *     arenas?: [{ id, name?, kit?, look?, width?, depth?, height?, crowd? }],
 *                                           // fight: scapeshift arenas (versus/versus-arena.js), each a stage world the
 *                                           // fight runs on in 3D (a plaza and a nave if absent)
 *     rounds?: n, timer?: n,                // fight: rounds to win (1 to 3, 2) and seconds a round (30 to 99, 99)
 *     rules?: { systems?, … },              // fight: the full rules block (versus/versus-core.js readRules): systems (parry,
 *                                           // burst, guard) and the sim's dials; rounds and timer win over it
 *     theme?: { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? },   // the game shell's skin (create_game)
 *     camera?: 'third-person' | 'first-person' | 'top-down' | 'side' | 'fixed',   // written to the world's own `camera` (cameras.js)
 *     screen?: 'phone' | 'tablet' | 'screen' | { … },   // written to the world's own `screen` (game/screen.js)
 *     run?: n,                              // RUNS: a pool of n + 2 trails (each its own seed), a run draws n of them in a
 *                                           // rolled order; a death ends the run (the play shell keeps the deepest)
 *   }
 *
 * The world around it is an ordinary gameworld: `style` (kit, look, land) and one level are written by `quickWorld`, so
 * the creator may edit any of it, and writing a hero's pages later (characters) turns the same sketch into the book.
 *
 * Pure. `readQuick` reads the shape; `quickWorld` writes the gameworld; `goalMechanics` places the goal on a stage's own
 * anchors (levels.js `stageEnds`); `quickStore` the store the goal needs.
 */
import { TD_WAVES } from '../board/board-td.js';
import { STAGE_KITS, isGroundKit, GROUND_KITS, roomKitDoor, resolveKitId } from '../era/stage.js';
import { COURSE_PRESETS } from '../roads/course.js';
import { composeTrack } from '../roads/trackscape-compose.js';
import { VEHICLES, TUNINGS, CONDITIONS, vehicleRule } from '../roads/vehicles.js';
import { CAMERAS } from './cameras.js';
import { readScreen } from '../game/screen.js';
import { readRunner } from '../worlds/controllable/runner.js';
import { RIDES, RIDE_H } from './ride.js';
import { libraryFigure, foeFigure, beastLook, readBeastFoe, standRule, stand, facing, PERSON_BODY } from './stage-figures.js';
import { mulberry32 } from '../vegetation/grow.js';
import { beatPosts, padSites, askBoxes } from './lay-concerns.js';
import { shooterPole, readPole } from './shooter-pole.js';
import { poleArmory, roleLoadout } from './weapon-roles.js';
import { racerSpec, solveRoster, racerRule } from '../car-designer/roster.js';
import { composeSupercar, SUPERCAR_LIBRARY } from '../car-designer/vehicle-library.js';
import { supercarRule } from '../car-designer/supercar-figure.js';
import { paintHex, liveryOf } from '../car-designer/vehicle-livery.js';
import { solveLiveries } from '../color-theorist/livery.js';
import { RACE_MOOD_IDS, RACE_MOODS, moodOf, moodGround } from '../roads/race-mood.js';
import { SCORE_MOODS } from '../beats/field-score.js';
import { CLUB_MOODS } from '../beats/club-score.js';
import { suggestScore, levelScoreContext } from '../beats/score-suggest.js';
import { SFX_PALETTE_NAMES } from '../beats/sfx-palettes.js';
import { CRAFT } from '../skyscape/eye.js';
import { VARIABLE_PALETTES } from '../transformation/variable-suit.js';
import { ALIEN_PALETTES } from '../transformation/alien-body.js';
import { SCHEME_DIALS } from '../transformation/schemes.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { flightLaps } from '../skyscape/course.js';
import { dogfightCast, waveIds, WING } from '../skyscape/dogfight.js';
import { solveFighter } from '../versus/versus-solver.js';
import { compileFighter } from '../versus/versus-compile.js';
import { readRules } from '../versus/versus-core.js';
import { fighterSpec, defaultFighters } from '../versus/versus-sheet.js';
import { readMeet, meetManifest } from '../contest/meet-arena.js';
import { readHolo, holoManifest, HOLO_LIFTS } from '../tabletop/holo-arena.js';
import { readKit, kitSportOf, SPORT_KITS } from '../sportswear/kits.js';
import { readMatch, matchManifest } from '../contest/match-arena.js';
import { readTurns, turnsManifest } from '../contest/turn-arena.js';
import { readTeam, teamManifest, teamArenaData } from '../contest/team-arena.js';
import { resolveSport } from '../contest/sports.js';
import { readArena, arenaManifest } from '../versus/versus-arena.js';
import { RTS_DOCTRINES } from '../board/board-rts.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export const QUICK_GOALS = Object.freeze({
  reach: 'reach the stage\'s end: a trail\'s exit, or a climb\'s top',
  collect: 'collect what lies along the way (on the trail\'s beats), and reach the end',
  survive: 'stay on the stage until the clock runs out',
  avoid: 'reach the end past its hazards (the water a trail crosses), with hp to spare',
  race: 'run the trail\'s checkpoints in order (its beats) to the finish (its end), against the clock; the best time is kept. On a loop (track), laps round it; with rivals, finish on the podium',
  sneak: 'reach the end past guards who keep the trail, sweeping their gaze: seen, and it is over',
  rhythm: 'run the trail to the music: jump on its beat for points (off the beat is a miss); the best score is kept',
  defend: 'foes walk the trail in waves to your base (its start); build archers\' towers on the pads beside it (E, for gold) and hold',
  puzzle: 'push the boulders on a grid by the trail\'s start onto their plates (walk into one to push it a cell)',
  farm: 'plant the plots by the start (E), let the days ripen them, harvest and sell: make the gold before the day runs out',
  battle: 'foes stand on the trail; walk up to one and the fight is turn by turn (attack, guard, flee): beat them all, with hp to spare',
  fight: 'a 1v1 fighter from the side, every fighter a character the character loop designs: roster, arenas, rounds, timer, rules',
  meet: 'an athletic meet in an arena (the contest kernel the referee): a sprint, the hurdles or the long jump in lanes, up to four local players on one keyboard, the rest the computer\'s; the gun, a false start, the clock or the measure, the placings',
  tabletop: 'a board game lifted into a hologram arena, the tabletop kernel the referee: chess, checkers or a game of moves written out, its pieces summoned as holograms, a capture an attack and a piece destroyed, the life points on the overlay; you against the computer, hot-seat, or an exhibition',
  contest: 'a sport in an arena, the contest kernel the referee: a net game (tennis) on two pads, a turn sport (golf, bowling) hot-seat on one, a team goal game (soccer, hockey) on two; the computer takes what nobody holds; a sport not in the book is written out (the distilled-rulebook catalyst)',
  shoot: 'armed foes hold the trail behind low walls, hunting you by sight and ducking into cover when hurt or reloading; shoot them all (click), with hp to spare: health and rounds lie along the way',
  deathmatch: 'an arena on the trail\'s land: you and bots who fight whom they see; first to the frag limit, or the place at the horn',
  fly: 'fly the ring gates in order and land; best time kept',
  conquer: 'a real-time skirmish on the stage\'s spots, seen from above: workers mine gold, a barracks trains soldiers and archers; select and order them (move, attack-move, hold) and take the enemy\'s base before it takes yours',
  runner: 'an endless run down three lanes: the hero runs on its own, ever faster; swipe or A / D to change lane, jump the hurdles, slide (S) under the bars, take the coins; a crash ends the run, the best score kept (with distance: reach it to win)',
});
// a shooter's numbers: the player's hp and what a hit takes, its rifle and spare rounds, the foes' guns and hp, the
// supplies (health given, rounds given)
/** A dogfight's costs: what a hit on the craft takes off its hp, and what a crash does. */
export const DOGFIGHT = Object.freeze({ hit: 4, crash: 25 });
export const SHOOT = Object.freeze({
  hp: 100, hit: 8, health: 30, rounds: 24, foeHp: 4,
  rifle: { fireClass: 'sight', auto: false, cooldown: 0.3, magazine: 12, reserve: 36, reload: 1.5, damage: 1, impact: 1, range: 60, coreAngle: 1.5 },
  gun: { fireClass: 'sight', auto: false, cooldown: 0.7, magazine: 6, reload: 2.2, damage: 1, range: 28, coreAngle: 1.5, eye: 1.4 },
});
// a person's hit volume (an egg: `a` its half-width, `c` its half-height), stood on its feet
const PERSON = Object.freeze({ a: 0.35, c: 0.9 });
// a battle's numbers: the hero's hp and blow, each foe's (the later ones tougher)
// a race's numbers: the trail a loop is laid on (its run, seconds: the longest; its beats, none that cuts the land or
// stands a stone on it: no pit, no stream, no landmark), laps round it, metres between its checkpoints, the grid (the first row's distance behind the
// line, each row's after it, the cars' distance off the middle), the rivals' lane off the line and their pace (the
// pole's, the last's), and their lane off a roadway's racing line (narrower: that line already runs near the edges),
// and a car's body on a roadway (its radius: the barriers stop it; the ride's own rule carries none)
export const RACE = Object.freeze({ run: 25, beats: ['reveal', 'pocket', 'rest', 'reveal', 'pocket'], laps: 3, leg: 20, gridFront: 4, gridRow: 6, gridSide: 2, lane: 1.2, pace: [0.86, 0.72], roadLane: 0.8, body: 0.9 });
// a deathmatch's numbers: bots in it, the frag limit, the seconds a fallen body lies, its arena's words when it names none
export const DEATHMATCH = Object.freeze({ bots: 3, frags: 10, respawn: 3, arena: 'a three-lane arena', teamFrags: 20, hold: 60 });
// a deathmatch's modes: everyone for themselves; two sides to a frag limit; two sides holding a point for time
export const DEATHMATCH_MODES = Object.freeze(['free-for-all', 'team', 'control']);
export const BATTLE = Object.freeze({ hp: 20, atk: 2, foeHp: [4, 6, 8, 10, 12, 14], foeAtk: [1, 2, 2, 3, 3, 4] });
// a farm's numbers: seed and sale, the purse it starts with, how fast its day runs (game minutes a second)
export const FARM = Object.freeze({ cost: 2, price: 6, gold: 6, rate: 4, start: 6 });
// a defence's numbers: what a tower costs, the purse it starts with, what a felled foe pays, foes in a wave
export const DEFEND = Object.freeze({ cost: 5, gold: 10, bounty: 2, perWave: [3, 5, 7, 9, 11, 13], hp: 3 });
// the field scores a rhythm game runs to (each a steady tempo, beats-world's audio.beat)
export const RHYTHM_MOODS = Object.freeze(['wayfarer', 'expedition', 'tavern', 'village', 'plains', 'forest', 'highlands', 'desert']);
const KEYS = ['goal', 'craft', 'assist', 'airspace', 'hero', 'ride', 'transformer', 'racers', 'supercars', 'mood', 'vehicle', 'tuning', 'conditions', 'track', 'roadway', 'laps', 'rivals', 'climb', 'building', 'pickup', 'seconds', 'theme', 'camera', 'screen', 'runner', 'distance', 'guards', 'guard', 'alarms', 'music', 'sfx', 'misses', 'waves', 'lives', 'pads', 'foe', 'tower', 'board', 'sides', 'doctrine', 'match', 'boulders', 'plots', 'target', 'days', 'folk', 'farmhand', 'run', 'foes', 'bots', 'frags', 'arena', 'pole', 'weapons', 'mode', 'roster', 'arenas', 'stages', 'rounds', 'timer', 'rules', 'cast', 'moves', 'event', 'lanes', 'sport', 'players', 'register', 'level', 'seats', 'sets', 'periods', 'attempts', 'athletes', 'kits', 'game', 'human', 'lift'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: quick${m}`);

// a quick game's cast: the casting page's words less the journey's (no review to approve its sheets), on foot only
export const QUICK_CAST_KEYS = Object.freeze(['scale', 'n', 'cast', 'anchor', 'bodies', 'factions', 'seed']);
export const QUICK_CAST_SCALES = Object.freeze(['hero', 'rival', 'party']);
function readQuickCast(Q) {
  const C = Q.cast;
  if (['fight', 'fly', 'race'].includes(Q.goal) || Q.ride !== undefined || Q.craft !== undefined) throw fail(`.cast walks beside a hero on foot: a ${Q.ride !== undefined ? 'ride' : Q.craft !== undefined ? 'craft' : Q.goal} has none (a fight's roster is its cast)`);
  if (C === true) return;
  if (!isObj(C)) throw fail(`.cast is true (a party of one) or { ${QUICK_CAST_KEYS.join('?, ')}? } (the casting page: get_game_vocab({ id: 'gameworld-story' }))`);
  for (const k of Object.keys(C)) if (!QUICK_CAST_KEYS.includes(k)) throw fail(`.cast.${k} is not part of a quick game's cast (${QUICK_CAST_KEYS.join(', ')})`);
  if (C.scale !== undefined && !QUICK_CAST_SCALES.includes(C.scale)) throw fail(`.cast.scale is ${QUICK_CAST_SCALES.join(', ')} (a journey's cast is the book's: its sheets wait on the creator's approval)`);
  if (C.n !== undefined && !(Number.isInteger(C.n) && C.n >= 1 && C.n <= 4)) throw fail('.cast.n is the party beside you, 1 to 4');
}

// a quick transformer: which form its vehicle is (a car drives a trail; a jet or a variable suit's waverider flies),
// and the goals each plays
export const QUICK_TRANSFORMER_GOALS = Object.freeze({ ground: ['reach', 'collect', 'survive', 'avoid', 'race'], air: ['fly'] });
export const transformerForm = (T) => (T.vehicle ? (T.vehicle.craft ? 'air' : 'ground') : T.robot && T.robot.alien ? 'ground' : 'air');
// the ways a car and a craft may transform (a body drawn to fold has its own)
export const QUICK_TRANSFORMER_SCHEMES = Object.freeze({ car: ['car-bot', 'rear-foot'], craft: ['jet-bot', 'fuselage-fold'] });
function readQuickTransformer(Q) {
  const T = Q.transformer;
  const shape = '.transformer is { robot?, vehicle?, scheme?, fold?, legs?, height? }: robot { variable: { palette?, build? } } (a variable suit, folding into its waverider) or { alien: { palette?, build? } } (pointed shells folding into a hover jetski), vehicle one of { supercar: { preset? } }, { ride: \'car\' | \'coupe\' | \'van\' }, { racer: { … } }, { craft: \'<archetype>\' }';
  if (!isObj(T)) throw fail(shape);
  for (const k of Object.keys(T)) if (!['robot', 'vehicle', 'scheme', 'fold', 'legs', 'height'].includes(k)) throw fail(`.transformer.${k}: ${shape}`);
  for (const k of ['hero', 'ride', 'racers', 'supercars', 'craft', 'rivals']) if (Q[k] !== undefined && Q[k] !== false) throw fail(`.transformer is the hero: no ${k} beside it`);
  if (Q.climb || Q.building !== undefined) throw fail('.transformer runs a trail or flies a map: no climb, no building');
  if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.transformer is followed from behind (camera third-person)');
  if (T.height !== undefined && !(Number.isFinite(T.height) && T.height >= 2 && T.height <= 40)) throw fail('.transformer.height is the robot\'s height in metres, 2 to 40');
  if (T.robot !== undefined) {
    const kind = isObj(T.robot) && Object.keys(T.robot).length === 1 ? Object.keys(T.robot)[0] : null;
    if (!['variable', 'alien'].includes(kind) || !isObj(T.robot[kind])) throw fail('.transformer.robot is { variable: { palette?, build? } } or { alien: { palette?, build? } } (a stored suit rides compose_world\'s figures.<name>.transformer)');
    const P = T.robot[kind].palette, PAL = kind === 'alien' ? ALIEN_PALETTES : VARIABLE_PALETTES;
    if (P !== undefined && !PAL[P]) throw fail(`.transformer.robot.${kind}.palette is one of ${Object.keys(PAL).join(', ')}`);
    if (T.vehicle !== undefined) throw fail(`.transformer.robot { ${kind} } is its own vehicle (${kind === 'alien' ? 'its jetski' : 'its waverider'}): no vehicle beside it`);
    for (const k of ['scheme', 'fold', 'legs']) if (T[k] !== undefined) throw fail(`.transformer.${k}: a body drawn to fold folds its own way (no ${k})`);
  }
  if (T.vehicle !== undefined) {
    const V = T.vehicle, ks = isObj(V) ? Object.keys(V) : [];
    if (!isObj(V) || ks.length !== 1 || !['supercar', 'ride', 'racer', 'craft'].includes(ks[0])) throw fail(shape);
    if (V.ride !== undefined && !RIDES[V.ride]) throw fail(`.transformer.vehicle.ride is one of ${Object.keys(RIDES).join(', ')}`);
    if (V.craft !== undefined && !CRAFT_ARCHETYPES[V.craft]) throw fail(`.transformer.vehicle.craft is a craft archetype (${Object.keys(CRAFT_ARCHETYPES).slice(0, 6).join(', ')}, …)`);
    if (V.supercar !== undefined && !(isObj(V.supercar) && (V.supercar.preset === undefined || SUPERCAR_LIBRARY[V.supercar.preset]))) throw fail(`.transformer.vehicle.supercar is { preset?: ${Object.keys(SUPERCAR_LIBRARY).join(' | ')} }`);
    if (V.racer !== undefined && !isObj(V.racer)) throw fail('.transformer.vehicle.racer is a racer\'s recipe ({ seed?, facets?, brief? })');
  }
  if (T.vehicle !== undefined) {
    const which = T.vehicle.craft !== undefined ? 'craft' : 'car', ok = QUICK_TRANSFORMER_SCHEMES[which];
    if (T.scheme !== undefined && !ok.includes(T.scheme)) throw fail(`.transformer.scheme: a ${which} transforms as ${ok.join(' or ')}`);
    const D = SCHEME_DIALS[T.scheme ?? ok[0]] || {};
    for (const k of ['fold', 'legs']) {
      if (T[k] === undefined) continue;
      if (!D[k]) throw fail(`.transformer.${k} is a fuselage fold's (scheme 'fuselage-fold')`);
      if (!D[k].includes(T[k])) throw fail(`.transformer.${k} is ${D[k].join(' or ')}`);
    }
  }
  const form = transformerForm(T);
  if (!QUICK_TRANSFORMER_GOALS[form].includes(Q.goal)) throw fail(`.transformer: a ${form === 'air' ? 'flier' : T.robot ? 'jetski' : 'car'}'s goals are ${QUICK_TRANSFORMER_GOALS[form].join(', ')}`);
}

/**
 * The quick transformer's body and its robot form: the figure spec (world-scene.js figures.<name>.transformer), the
 * robot's height, and its rule and camera, scaled to that height; a car's vehicle form too (a flier's is the airspace
 * seat's, levels.js). → { transformer, H, forms: { robot, vehicle? } }
 */
export function quickTransformer(Q) {
  const T = Q.transformer, form = transformerForm(T);
  // a variable suit stands a mobile worker's height on a trail's land; an alien its jetski's length; a car-bot its car's
  // length; a jet-bot its jet's
  const alien = !!(T.robot && T.robot.alien);
  const H = T.height ?? (alien ? 3.5 : T.robot ? 7 : T.vehicle.craft ? 14 : 4.5);
  const spec = { ...(T.robot ? { robot: T.robot } : {}), ...(T.vehicle ? { vehicle: T.vehicle } : {}), ...(T.scheme ? { scheme: T.scheme } : {}), ...(T.fold ? { fold: T.fold } : {}), ...(T.legs ? { legs: T.legs } : {}), height: H };
  const robot = {
    rule: { type: 'platform', speed: r3(2 + 2.2 * Math.sqrt(H)), jumpSpeed: r3(2 + 3 * Math.sqrt(H)), stride: r3(0.55 * H), collideRadius: r3(0.12 * H), collideHeight: r3(0.9 * H) },
    camera: { dist: r3(2.6 * H), height: r3(H), lead: r3(0.6 * H), lookH: r3(0.6 * H) },
  };
  if (form === 'air') return { transformer: spec, H, forms: { robot } };
  // the car: its proportions (a wheelbase about 0.6 of its length, a wheel about 0.077), on a ride's drive (a rear-foot
  // robot stands shorter than its car); a jetski skims on the same drive, quick to turn, no wheel to read
  const L = T.scheme === 'rear-foot' ? H / 0.85 : H;
  const vehicle = {
    rule: alien
      ? { type: 'drive', horsepower: 180, mass: 420, wheelbase: r3(0.5 * L), wheelRadius: r3(0.1 * L), topSpeed: 30, steerMax: 0.7, collideRadius: r3(0.25 * L) }
      : { type: 'drive', horsepower: 320, mass: 1500, wheelbase: r3(0.6 * L), wheelRadius: r3(0.077 * L), topSpeed: 26, collideRadius: r3(0.22 * L) },
    camera: { dist: r3(2.4 * L), height: r3(L), lead: 5, lookH: r3(0.27 * L) },
  };
  return { transformer: spec, H, forms: { robot, vehicle } };
}

/** Read the quick block and say what is wrong. */
export function readQuick(Q) {
  if (!isObj(Q)) throw fail(` is { goal: ${Object.keys(QUICK_GOALS).join(' | ')}, hero?, climb?, pickup?, seconds?, theme? }`);
  for (const k of Object.keys(Q)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a quick game (${KEYS.join(', ')})`);
  if (!QUICK_GOALS[Q.goal]) throw fail(`.goal is one of ${Object.entries(QUICK_GOALS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (Q.hero !== undefined && Q.hero !== false && !isObj(Q.hero)) throw fail('.hero is a hero-door spec (get_solid_vocab({ id: \'layered\' })), { ref } for a hero or mascot made with create_character, { mascot: true | { brief?, facets?, seed? } } for a mascot on foot, or false for first person');
  if (isObj(Q.hero) && Q.hero.mascot !== undefined) {
    const M = Q.hero.mascot;
    if (Object.keys(Q.hero).length !== 1) throw fail('.hero { mascot } is a mascot on foot alone (its words are the mascot\'s: brief, facets, seed)');
    if (!(M === true || (isObj(M) && Object.keys(M).every((k) => ['brief', 'facets', 'seed'].includes(k))))) throw fail('.hero.mascot is true (rolled in the game\'s setting) or { brief?, facets?, seed? } (docs/mascot.md)');
  }
  if (isObj(Q.hero) && Q.hero.ref !== undefined && (Object.keys(Q.hero).length !== 1 || !(typeof Q.hero.ref === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(Q.hero.ref)))) throw fail('.hero { ref } adopts a hero made with create_character, by its sketch ref alone (its words are its own row\'s)');
  if (Q.climb !== undefined && typeof Q.climb !== 'boolean') throw fail('.climb is true or false');
  if (Q.cast !== undefined) readQuickCast(Q);
  if (Q.moves !== undefined && typeof Q.moves !== 'boolean') throw fail('.moves is true: every person the run makes takes a blow on its own rig (a hit, a stagger, a fall and a rise)');
  if (Q.ride !== undefined) {
    if (!RIDES[Q.ride]) throw fail(`.ride is one of ${Object.entries(RIDES).map(([k, v]) => `${k} (${v.words})`).join('; ')}`);
    if (Q.hero) throw fail('.ride and .hero: the ride is the hero (one or the other)');
    if (Q.climb || Q.building !== undefined) throw fail('.ride drives a trail: no climb, no building');
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.ride is followed from behind (camera third-person)');
  }
  if (Q.transformer !== undefined) readQuickTransformer(Q);
  if (Q.racers !== undefined) {
    if (Q.goal !== 'race') throw fail('.racers belongs to the race goal');
    if (Q.ride !== undefined || Q.hero) throw fail('.racers and a ride or hero: your racer is the first of the field');
    if (Q.rivals !== undefined) throw fail('.racers is the whole field (yours first): no rivals beside it');
    if (Q.vehicle !== undefined) throw fail('.vehicle: a racer drives the machine it was built, its physics its own');
    if (Q.climb || Q.building !== undefined || Q.run !== undefined) throw fail('.racers race a lap or a roadway: no climb, building or run');
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.racers are followed from behind (camera third-person)');
    const list = Number.isInteger(Q.racers) ? null : Q.racers;
    if (list === null ? !(Q.racers >= 2 && Q.racers <= 8) : !(Array.isArray(list) && list.length >= 2 && list.length <= 8)) throw fail('.racers is how many racers (2 to 8), or a list of them: each an archetype, a brief in words, or { archetype?, build?, age?, brief?, facets?, seed?, parts?, shade? }');
    if (list) list.forEach((r, k) => { try { racerSpec(r, k); } catch (e) { throw fail(`.racers[${k}]: ${e.message.replace(/^car-designer: /, '')}`); } });
  }
  if (Q.supercars !== undefined) {
    if (Q.goal !== 'race') throw fail('.supercars belongs to the race goal');
    if (Q.ride !== undefined || Q.hero || Q.racers !== undefined) throw fail('.supercars and a ride, hero or racers: your car is the first of the field');
    if (Q.rivals !== undefined) throw fail('.supercars is the whole field (yours first): no rivals beside it');
    if (Q.vehicle !== undefined) throw fail('.vehicle: a supercar drives on its own frame, the sports class');
    if (Q.climb || Q.building !== undefined || Q.run !== undefined) throw fail('.supercars race a lap or a roadway: no climb, building or run');
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.supercars are followed from behind (camera third-person)');
    const list = Number.isInteger(Q.supercars) ? null : Q.supercars;
    if (list === null ? !(Q.supercars >= 2 && Q.supercars <= 8) : !(Array.isArray(list) && list.length >= 2 && list.length <= 8)) throw fail(`.supercars is how many cars (2 to 8), or a list of them: each { preset?: ${Object.keys(SUPERCAR_LIBRARY).join(' | ')}, paint?, livery?, seed? }`);
    if (list) list.forEach((c, k) => {
      const at = `.supercars[${k}]`;
      if (!isObj(c)) throw fail(`${at} is { preset?, paint?, livery?, seed? }`);
      for (const key of Object.keys(c)) if (!['preset', 'paint', 'livery', 'seed'].includes(key)) throw fail(`${at}.${key} is not one of preset, paint, livery, seed`);
      if (c.preset !== undefined && !SUPERCAR_LIBRARY[c.preset]) throw fail(`${at}.preset is one of ${Object.keys(SUPERCAR_LIBRARY).join(', ')}`);
      if (c.seed !== undefined && !Number.isInteger(c.seed)) throw fail(`${at}.seed is a whole number`);
      try { if (c.paint !== undefined) paintHex(c.paint); liveryOf(c.livery, c.paint ?? 'scarlet'); } catch (e) { throw fail(`${at}: ${e.message.replace(/^vehicle-odm: /, '')}`); }
    });
  }
  if (Q.mood !== undefined) {
    if (!RACE_MOODS[Q.mood]) throw fail(`.mood is one of ${RACE_MOOD_IDS.map((m) => `${m} (${RACE_MOODS[m].reads})`).join('; ')}`);
    if (Q.roadway === undefined) throw fail('.mood lights a roadway: name one (a course preset, a spec or { intent })');
  }
  for (const k of ['vehicle', 'tuning', 'conditions']) if (Q[k] !== undefined && !Q.ride && !((Q.racers !== undefined || Q.supercars !== undefined) && k !== 'vehicle')) throw fail(`.${k} is how the ride drives: name a ride`);
  if (Q.vehicle !== undefined && !VEHICLES[Q.vehicle]) throw fail(`.vehicle is one of ${Object.entries(VEHICLES).map(([k, v]) => `${k} (${v.words})`).join('; ')}`);
  if (Q.tuning !== undefined && !TUNINGS.includes(Q.tuning)) throw fail(`.tuning is ${TUNINGS.join(' or ')}`);
  if (Q.conditions !== undefined && !(Q.conditions in CONDITIONS)) throw fail(`.conditions is one of ${Object.keys(CONDITIONS).join(', ')}`);
  if (Q.pickup !== undefined && !(typeof Q.pickup === 'string' && /^[a-z][a-z-]{0,23}$/.test(Q.pickup))) throw fail('.pickup is one lower-case word (coin, key, star, gem, shell…)');
  if (Q.seconds !== undefined && !(Number.isInteger(Q.seconds) && Q.seconds >= 5 && Q.seconds <= 600)) throw fail('.seconds is a whole number of seconds, 5 to 600');
  if (Q.theme !== undefined && !isObj(Q.theme)) throw fail('.theme is the game shell\'s skin { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? }');
  if (Q.camera !== undefined && !CAMERAS[Q.camera]) throw fail(`.camera is one of ${Object.entries(CAMERAS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (Q.screen !== undefined) readScreen(Q.screen, 'quick.screen');
  if (Q.building !== undefined && !isObj(Q.building)) throw fail('.building is a building level { use, seed?, goal?, … } (card game-building)');
  if (Q.building !== undefined && Q.climb) throw fail('.climb and .building: a building is its own level, not a climb after a trail');
  if (Q.building !== undefined && Q.goal === 'avoid') throw fail('.building has no hazards to avoid (reach, collect or survive)');
  if (Q.goal !== 'collect' && Q.pickup !== undefined) throw fail('.pickup belongs to the collect goal');
  if (Q.goal !== 'survive' && Q.goal !== 'deathmatch' && Q.seconds !== undefined) throw fail('.seconds belongs to the survive and deathmatch goals');
  // the RUNNER (worlds/controllable/runner.js): its settings, and a distance that wins it (absent: endless)
  if (Q.goal !== 'runner' && Q.goal !== 'meet' && (Q.runner !== undefined || Q.distance !== undefined)) throw fail('.runner and .distance belong to the runner goal (a meet\'s distance is its event\'s)');
  if (Q.goal === 'runner') {
    if (Q.runner !== undefined) { try { readRunner(Q.runner, 'quick.runner'); } catch (e) { throw fail(`: ${e.message}`); } }
    if (Q.distance !== undefined && !(Number.isInteger(Q.distance) && Q.distance >= 10)) throw fail('.distance is the metres a run is won at, a whole number of 10 or more (leave it out: endless)');
    if (Q.hero === false) throw fail('.runner runs a hero: leave hero out (a hero is made) or give one');
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.runner is followed from behind (camera third-person)');
    for (const k of ['climb', 'building', 'run', 'ride', 'racers', 'supercars', 'roadway', 'airspace', 'craft']) if (Q[k] !== undefined) throw fail(`.${k}: a runner is the run alone`);
  }
  for (const k of ['bots', 'frags', 'arena', 'pole', 'weapons', 'mode']) if (Q.goal !== 'deathmatch' && Q[k] !== undefined) throw fail(`.${k} belongs to the deathmatch goal`);
  if (Q.mode !== undefined && !DEATHMATCH_MODES.includes(Q.mode)) throw fail(`.mode is ${DEATHMATCH_MODES.join(', ')} (two sides: team deathmatch, or a point held for time)`);
  if (Q.mode && Q.mode !== 'free-for-all' && (Q.bots ?? DEATHMATCH.bots) < 1) throw fail('.mode: two sides need a bot on the other side');
  if (Q.weapons !== undefined && Q.weapons !== true) throw fail('.weapons: true lays the pole\'s guns on the arena\'s floor to be picked up');
  if (Q.weapons && Q.pole === undefined) throw fail('.weapons rides the shooter pole: name a pole (realistic..stylized, 0..1)');
  if (Q.pole !== undefined) { try { readPole(Q.pole); } catch (e) { throw fail(`.pole is ${e.message.replace(/^shooter pole: /, '')}`); } }
  if (Q.arena !== undefined && !(typeof Q.arena === 'string' && Q.arena.trim())) throw fail('.arena is the arena in a few words ("a tight three-lane arena with long sightlines")');
  if (Q.bots !== undefined && !(Number.isInteger(Q.bots) && Q.bots >= 1 && Q.bots <= 7)) throw fail('.bots is how many bots in the match with you, 1 to 7');
  if (Q.frags !== undefined && !(Number.isInteger(Q.frags) && Q.frags >= 1 && Q.frags <= 50)) throw fail('.frags is the frag limit that wins, 1 to 50');
  if (Q.goal === 'deathmatch' && Q.seconds !== undefined && Q.seconds < 10) throw fail('.seconds is a deathmatch\'s time limit, 10 to 600');
  if (Q.goal === 'deathmatch' && (Q.building !== undefined || Q.ride || Q.climb || Q.run !== undefined)) throw fail('.deathmatch fights in an arena on a trail\'s land: no building, ride, climb or run');
  if (Q.goal === 'deathmatch' && Q.camera !== undefined && Q.camera !== 'first-person' && Q.camera !== 'third-person') throw fail('.deathmatch aims from the eye or over the shoulder: camera first-person or third-person');
  for (const k of ['track', 'rivals']) if (Q.goal !== 'race' && Q[k] !== undefined) throw fail(`.${k} belongs to the race goal`);
  if (Q.laps !== undefined && Q.goal !== 'race' && Q.goal !== 'fly') throw fail('.laps belongs to the race and fly goals');
  // a flight: the fly goal, or a shooter with a craft (a dogfight: skyscape/dogfight.js)
  const flies = Q.goal === 'fly' || (Q.goal === 'shoot' && Q.craft !== undefined);
  for (const k of ['craft', 'assist', 'airspace']) if (Q.goal !== 'fly' && Q.goal !== 'shoot' && Q[k] !== undefined) throw fail(`.${k} belongs to the fly goal (and shoot, for a dogfight)`);
  for (const k of ['assist', 'airspace']) if (Q.goal === 'shoot' && Q.craft === undefined && Q[k] !== undefined) throw fail(`.${k}: a shooter flies only with a craft (name .craft for a dogfight)`);
  if (flies) {
    if (Q.craft !== undefined && !CRAFT[Q.craft]) throw fail(`.craft is one of ${Object.entries(CRAFT).map(([k, v]) => `${k} (${v.label})`).join('; ')}`);
    if (Q.airspace !== undefined && !(isObj(Q.airspace) && Object.keys(Q.airspace).every((k) => ['map', 'ground', 'space', 'course'].includes(k)))) throw fail('.airspace is { map?, ground?, space?, course? }: the flight map as an airspace level takes it (space: { asteroids } for a space craft)');
    if (Q.assist !== undefined && !['arcade', 'sim'].includes(Q.assist)) throw fail(".assist is 'arcade' (never stalls, the wings level quickly) or 'sim' (the bank holds where it is put)");
    if (Q.airspace?.map?.craft !== undefined) throw fail('.airspace.map.craft: name the aircraft once, as .craft');
    for (const k of ['hero', 'ride', 'racers', 'climb', 'building', 'run', 'roadway']) if (Q[k] !== undefined && Q[k] !== false) throw fail(`.${k}: a flight is flown in its aircraft over its own map (no ${k})`);
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.fly is followed from behind (camera third-person)');
    if (Q.laps !== undefined && Q.craft === 'glider') throw fail('.laps: a glider cannot climb back round, its course is flown once, downhill');
  }
  if (Q.track !== undefined && !['trail', 'loop'].includes(Q.track)) throw fail('.track is trail (end to end) or loop (round a loop laid on the trail\'s land)');
  if (Q.roadway !== undefined) {
    if (Q.goal !== 'race') throw fail('.roadway belongs to the race goal');
    if (!(isObj(Q.roadway) || COURSE_PRESETS[Q.roadway])) throw fail(`.roadway is a course preset (${Object.keys(COURSE_PRESETS).join(', ')}), a course spec, or { intent: 'words' }`);
    if (isObj(Q.roadway) && Q.roadway.intent !== undefined && (typeof Q.roadway.intent !== 'string' || !Q.roadway.intent.trim() || Object.keys(Q.roadway).length > 1)) throw fail('.roadway.intent is the track in words ("a GT circuit in green hills"), alone');
    if (Q.track !== undefined || Q.climb || Q.building !== undefined || Q.run !== undefined) throw fail('.roadway is the race\'s whole ground: no track, climb, building or run');
  }
  if (Q.laps !== undefined && !(Number.isInteger(Q.laps) && Q.laps >= 1 && Q.laps <= 9)) throw fail('.laps is how many times round, 1 to 9');
  if (Q.rivals !== undefined && !(Number.isInteger(Q.rivals) && Q.rivals >= 1 && Q.rivals <= 7)) throw fail('.rivals is how many rival drivers, 1 to 7');
  if (Q.rivals !== undefined && !Q.ride) throw fail('.rivals drive the same car as you: name a ride');
  if (Q.track === 'trail' && Q.laps > 1) throw fail('.laps: a trail is run once, end to end (track loop goes round)');
  if ((Q.track === 'loop' || Q.rivals) && (Q.climb || Q.building !== undefined)) throw fail('.track loop is laid on a trail\'s land: no climb, no building');
  for (const k of ['guards', 'guard', 'alarms']) if (Q.goal !== 'sneak' && Q[k] !== undefined) throw fail(`.${k} belongs to the sneak goal`);
  if (Q.guards !== undefined && !(Number.isInteger(Q.guards) && Q.guards >= 1 && Q.guards <= 8)) throw fail('.guards is how many guards keep the trail, 1 to 8');
  if (Q.alarms !== undefined && !(Number.isInteger(Q.alarms) && Q.alarms >= 1 && Q.alarms <= 9)) throw fail('.alarms is how many sightings end the run, 1 to 9');
  if (Q.guard !== undefined && !isObj(Q.guard)) throw fail('.guard is a hero-door spec, as .hero is');
  if (Q.building !== undefined && (Q.goal === 'race' || Q.goal === 'sneak' || Q.goal === 'rhythm')) throw fail(`.building: ${Q.goal} runs a trail, not a building`);
  if (Q.goal !== 'rhythm' && Q.misses !== undefined) throw fail('.misses belongs to the rhythm goal');
  if (Q.goal === 'rhythm' && Q.music !== undefined && !RHYTHM_MOODS.includes(Q.music)) throw fail(`.music is a field score with a steady beat: ${RHYTHM_MOODS.join(', ')}`);
  if (Q.sfx !== undefined && Q.sfx !== 'auto' && !SFX_PALETTE_NAMES.includes(Q.sfx)) throw fail(`.sfx is 'auto' (the palette the music implies) or a palette: ${SFX_PALETTE_NAMES.join(', ')}`);
  if (Q.goal !== 'rhythm' && Q.music !== undefined && Q.music !== 'auto' && !Object.prototype.hasOwnProperty.call(SCORE_MOODS, Q.music) && !Object.prototype.hasOwnProperty.call(CLUB_MOODS, Q.music)) throw fail(`.music is 'auto' (each level's place and play pick its score) or a mood: ${Object.keys(SCORE_MOODS).join(', ')}; electronic: ${Object.keys(CLUB_MOODS).join(', ')}`);
  if (Q.misses !== undefined && !(Number.isInteger(Q.misses) && Q.misses >= 1 && Q.misses <= 99)) throw fail('.misses is how many presses off the beat end the run, 1 to 99');
  for (const k of ['lives', 'pads', 'tower']) if (Q.goal !== 'defend' && Q[k] !== undefined) throw fail(`.${k} belongs to the defend goal`);
  // (waves: a defence's, or a dogfight's wings: shoot with a craft)
  if (Q.waves !== undefined && Q.goal !== 'defend' && !(Q.goal === 'shoot' && Q.craft !== undefined)) throw fail('.waves belongs to the defend goal (and shoot with a craft: a dogfight\'s wings)');
  if (Q.foe !== undefined && Q.goal !== 'defend' && Q.goal !== 'battle' && Q.goal !== 'shoot' && Q.goal !== 'deathmatch') throw fail('.foe belongs to the defend, battle, shoot and deathmatch goals');
  if (Q.waves !== undefined && !(Number.isInteger(Q.waves) && Q.waves >= 1 && Q.waves <= DEFEND.perWave.length)) throw fail(`.waves is 1 to ${DEFEND.perWave.length}`);
  if (Q.lives !== undefined && !(Number.isInteger(Q.lives) && Q.lives >= 1 && Q.lives <= 20)) throw fail('.lives is 1 to 20');
  if (Q.pads !== undefined && !(Number.isInteger(Q.pads) && Q.pads >= 1 && Q.pads <= 8)) throw fail('.pads is 1 to 8');
  for (const k of ['foe', 'tower']) if (Q[k] !== undefined && !isObj(Q[k])) throw fail(`.${k} is a hero-door spec, as .hero is`);
  if (beastLook(Q.foe)) readBeastFoe(Q.foe, ['battle', 'defend'].includes(Q.goal) ? null : `a ${Q.goal}'s foes carry guns: a person's hands`, '.foe', fail);
  if (Q.goal === 'defend' && (Q.building !== undefined || Q.climb)) throw fail('.defend holds a trail: no climb, no building');
  if (Q.goal === 'conquer' && (Q.building !== undefined || Q.climb || Q.ride || Q.hero !== undefined || Q.run !== undefined)) throw fail('.conquer is a skirmish on the stage\'s spots, commanded from above: no hero, climb, building, ride or run');
  if (Q.doctrine !== undefined && (Q.goal !== 'conquer' || !RTS_DOCTRINES[Q.doctrine])) throw fail(Q.goal !== 'conquer' ? '.doctrine belongs to the conquer goal: how the player chose to play' : `.doctrine '${Q.doctrine}' is not a doctrine (${Object.entries(RTS_DOCTRINES).map(([k, v]) => `${k}: ${v.read}`).join('; ')})`);
  if (Q.match !== undefined && (Q.goal !== 'conquer' || typeof Q.match !== 'boolean')) throw fail(Q.goal !== 'conquer' ? '.match belongs to the conquer goal: a whole match, a lobby first and results after' : '.match is true (a whole match: a lobby first, results after) or false');
  if (Q.sides !== undefined) {
    if (Q.goal !== 'conquer') throw fail('.sides belongs to the conquer goal: the skirmish\'s two sides');
    if (!Array.isArray(Q.sides) || !Q.sides.length || Q.sides.length > 2 || !Q.sides.every((v) => typeof v === 'string' && v.trim())) throw fail('.sides is [player, enemy?]: each a civilization of the world (its id) or one in words (\'armoured walkers, laser carbines\')');
  }
  if (Q.board !== undefined) {
    if (Q.goal !== 'defend' && Q.goal !== 'conquer') throw fail('.board belongs to the defend goal (a tower defence on the stage\'s spots) and the conquer goal (the skirmish\'s board)');
    if (Q.board !== true && !isObj(Q.board)) throw fail('.board is true, or { cols?, rows?, gold? }');
    if (isObj(Q.board)) {
      for (const k of Object.keys(Q.board)) if (!['cols', 'rows', 'gold'].includes(k)) throw fail(`.board.${k} is not part of it (cols, rows, gold)`);
      for (const k of ['cols', 'rows']) if (Q.board[k] !== undefined && !(Number.isInteger(Q.board[k]) && Q.board[k] >= 6 && Q.board[k] <= 20)) throw fail(`.board.${k} is 6 to 20 spots`);
      if (Q.board.gold !== undefined && !(Number.isInteger(Q.board.gold) && Q.board.gold >= 0 && Q.board.gold <= 999)) throw fail('.board.gold is 0 to 999');
    }
    for (const k of ['pads', 'tower']) if (Q[k] !== undefined) throw fail(`.${k} is the trail's defence; on a board a tower stands on any free spot that keeps the road open`);
    if (Q.goal === 'defend' && Q.waves !== undefined && Q.waves > TD_WAVES.length) throw fail(`.waves is 1 to ${TD_WAVES.length} on a board (its ladder)`);
  }
  if (Q.goal !== 'puzzle' && Q.boulders !== undefined) throw fail('.boulders belongs to the puzzle goal');
  if (Q.boulders !== undefined && !(Number.isInteger(Q.boulders) && Q.boulders >= 1 && Q.boulders <= 4)) throw fail('.boulders is 1 to 4');
  if (Q.goal === 'puzzle' && (Q.building !== undefined || Q.climb || Q.ride)) throw fail('.puzzle lays its grid by a trail\'s start: no climb, building or ride');
  for (const k of ['plots', 'target', 'days', 'folk', 'farmhand']) if (Q.goal !== 'farm' && Q[k] !== undefined) throw fail(`.${k} belongs to the farm goal`);
  if (Q.plots !== undefined && !(Number.isInteger(Q.plots) && Q.plots >= 1 && Q.plots <= 12)) throw fail('.plots is 1 to 12');
  if (Q.target !== undefined && !(Number.isInteger(Q.target) && Q.target >= 10 && Q.target <= 500)) throw fail('.target is the gold to make, 10 to 500');
  if (Q.days !== undefined && !(Number.isInteger(Q.days) && Q.days >= 2 && Q.days <= 30)) throw fail('.days is 2 to 30');
  if (Q.folk !== undefined && !(Number.isInteger(Q.folk) && Q.folk >= 0 && Q.folk <= 6)) throw fail('.folk is 0 to 6');
  if (Q.farmhand !== undefined && !isObj(Q.farmhand)) throw fail('.farmhand is a hero-door spec, as .hero is');
  if (Q.goal === 'farm' && (Q.building !== undefined || Q.climb || Q.ride)) throw fail('.farm tills the land by a trail\'s start: no climb, building or ride');
  if (Q.run !== undefined && !(Number.isInteger(Q.run) && Q.run >= 2 && Q.run <= 8)) throw fail('.run is how many trails a run draws, 2 to 8');
  if (Q.goal !== 'battle' && Q.goal !== 'shoot' && Q.foes !== undefined) throw fail('.foes belongs to the battle and shoot goals');
  const most = Q.goal === 'shoot' ? 8 : BATTLE.foeHp.length;
  if (Q.foes !== undefined && !(Number.isInteger(Q.foes) && Q.foes >= 1 && Q.foes <= most)) throw fail(`.foes is 1 to ${most}`);
  if (Q.goal === 'shoot' && (Q.building !== undefined || Q.ride)) throw fail('.shoot fights along a trail on foot: no building, no ride');
  if (Q.goal === 'shoot' && !flies && Q.camera !== undefined && Q.camera !== 'first-person' && Q.camera !== 'third-person') throw fail('.shoot aims from the eye or over the shoulder: camera first-person or third-person');
  if (Q.goal === 'battle' && Q.building !== undefined) throw fail('.battle stands its foes on a trail: no building');
  if (Q.run !== undefined && (Q.building !== undefined || Q.climb)) throw fail('.run draws trails: no climb, no building');
  for (const k of ['roster', 'arenas', 'stages', 'rounds', 'timer', 'rules']) if (Q.goal !== 'fight' && !(Q.goal === 'contest' && k === 'rounds') && Q[k] !== undefined) throw fail(`.${k} belongs to the fight goal`);
  if (Q.goal === 'fight') readFight(Q);
  for (const k of SPORT_KEYS) if (Q.goal !== 'meet' && Q.goal !== 'contest' && !(Q.goal === 'tabletop' && TABLETOP_KEYS.includes(k)) && Q[k] !== undefined) throw fail(`.${k} belongs to the meet and contest goals`);
  for (const k of ['game', 'human', 'lift']) if (Q.goal !== 'tabletop' && Q[k] !== undefined) throw fail(`.${k} belongs to the tabletop goal`);
  if (Q.goal === 'meet' || Q.goal === 'contest') readSport(Q);
  if (Q.goal === 'tabletop') readTabletop(Q);
  return Q;
}

// what a sport takes (a contest is its own simulation on the World page: no hero, trail, building, ride or run)
const SPORT_KEYS = ['event', 'lanes', 'sport', 'players', 'register', 'level', 'seats', 'sets', 'periods', 'attempts', 'athletes', 'kits'];
const MEET_KEYS = ['goal', 'event', 'lanes', 'players', 'register', 'distance', 'attempts', 'athletes', 'kits', 'theme', 'screen'];
const CONTEST_KEYS = ['goal', 'sport', 'players', 'register', 'level', 'seats', 'sets', 'rounds', 'periods', 'seconds', 'athletes', 'kits', 'theme', 'screen'];
const pick = (Q, keys) => Object.fromEntries(keys.filter((k) => Q[k] !== undefined).map((k) => [k, Q[k]]));
/** The sport's words read by its arena (contest/*-arena.js), the refusal its own. */
function readSport(Q) {
  const keys = Q.goal === 'meet' ? MEET_KEYS : CONTEST_KEYS;
  if (Q.camera !== undefined) throw fail('.camera: a sport is seen from its arena\'s camera (the broadcast, the end, the follow)');
  for (const k of Object.keys(Q)) if (!keys.includes(k)) throw fail(`.${k}: a ${Q.goal} takes ${keys.join(', ')} (${Q.goal === 'meet' ? 'its runners are its lanes' : 'its players are its pads'})`);
  readSportAthletes(Q);
  try {
    if (Q.goal === 'meet') { readMeet(pick(Q, ['event', 'lanes', 'players', 'register', 'distance', 'attempts'])); return; }
    if (Q.sport === undefined) throw new Error('contest: sport names the sport: tennis (a net game), golf or bowling (a turn sport), soccer or hockey (a team goal game), or a sport written out { id, shape, words, spec, … }');
    const sp = resolveSport(Q.sport);
    const own = { match: ['sets'], turns: ['seats', 'rounds'], team: ['periods', 'seconds'] };
    for (const [shape, ks] of Object.entries(own)) if (shape !== sp.shape) for (const k of ks) if (Q[k] !== undefined) throw new Error(`contest: ${k} belongs to a ${shape === 'match' ? 'net game' : shape === 'turns' ? 'turn sport' : 'team goal game'}; ${sp.id} is a ${sp.shape === 'match' ? 'net game' : sp.shape === 'turns' ? 'turn sport' : 'team goal game'}`);
    if (sp.shape === 'match') readMatch(pick(Q, ['sport', 'players', 'register', 'level', 'sets']));
    else if (sp.shape === 'turns') readTurns(pick(Q, ['sport', 'seats', 'players', 'register', 'level', 'rounds']));
    else readTeam(pick(Q, ['sport', 'players', 'register', 'level', 'periods', 'seconds']));
  } catch (e) { throw fail(`: ${e.message.replace(/^(contest|meet|court|turns|team): /, '')}`); }
}

/** The sport's kit card (sportswear/kits.js): a meet's the track's, a book sport's its own, one written out its shape's. */
export function sportKitOf(Q) {
  if (Q.goal === 'meet') return 'track';
  const sp = resolveSport(Q.sport);
  return SPORT_KITS[sp.id] ? sp.id : kitSportOf(sp.shape);
}
/** A sport's slots, in its sim's order: the lanes, side a's players then side b's, the seats. → { n, sides? } */
export function sportSlots(Q) {
  if (Q.goal === 'meet') return { n: readMeet(pick(Q, ['event', 'lanes', 'players', 'register', 'distance', 'attempts'])).lanes };
  const sp = resolveSport(Q.sport);
  if (sp.shape === 'match') return { n: 2, sides: 2 };
  if (sp.shape === 'turns') return { n: readTurns(pick(Q, ['sport', 'seats', 'players', 'register', 'level', 'rounds'])).seats };
  const roles = Object.keys(teamArenaData(pick(Q, ['sport', 'players', 'register', 'level', 'periods', 'seconds'])).C.roles);
  return { n: 2 * roles.length, sides: 2, roles };
}
const ATHLETE_WORDS = 'false (the stick figures) or 1 to 12 athletes, each { ref } (a character made with create_character) or a hero-door spec the run makes; absent, rolled in the game\'s setting';
function readSportAthletes(Q) {
  if (Q.kits !== undefined) {
    if (Q.athletes !== undefined) throw fail('.kits dress the athletes the run rolls; athletes given are dressed by their own words (a hero-door spec\'s kit)');
    if (!Array.isArray(Q.kits) || Q.kits.length < 1 || Q.kits.length > 8) throw fail('.kits is 1 to 8 kits, each a sport kit\'s words { sport?, colours?, pattern?, trim?, socks? } (sportswear/kits.js), cycled over the sides (a court, a pitch) or the athletes');
    Q.kits.forEach((k, i) => { const e = readKit(k); if (e.length) throw fail(`.kits[${i}]: ${e.join('; ').replace(/^kit/, 'kit')}`); });
  }
  const A = Q.athletes;
  if (A === undefined || A === false) return;
  if (!Array.isArray(A) || A.length < 1 || A.length > 12) throw fail(`.athletes is ${ATHLETE_WORDS}`);
  A.forEach((e, i) => {
    if (!isObj(e)) throw fail(`.athletes[${i}]: an athlete is { ref } or a hero-door spec (.athletes is ${ATHLETE_WORDS})`);
    if (e.ref !== undefined && (Object.keys(e).length !== 1 || !(typeof e.ref === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(e.ref)))) throw fail(`.athletes[${i}] { ref } adopts a character made with create_character, by its sketch ref alone (its words are its own row's)`);
  });
}

/** A sport's level: the arena as a stage recipe carrying its play, with the game contract a hosted level speaks (the
 * page posts READY, takes INIT, posts the OUTCOME: contest/*-arena.client.js). One level, named for its ground. */
export function sportArenas(Q, { title, seed = 1, athletes = null } = {}) {
  const own = athletes ? { athletes } : {};
  const contract = (id, text) => ({ levelRef: id, consumes: [], produces: { results: ['success', 'fail'], events: [] }, presets: { default: {} }, complete: { text } });
  if (Q.goal === 'meet') {
    const m = meetManifest({ ...pick(Q, ['event', 'lanes', 'players', 'register', 'distance', 'attempts']), seed, ...(title ? { title } : {}), ...own });
    return [{ id: 'track', name: m.title, manifest: { ...m, game: contract('track', 'the meet') } }];
  }
  const sp = resolveSport(Q.sport);
  if (sp.shape === 'match') { const m = matchManifest({ ...pick(Q, ['sport', 'players', 'register', 'level', 'sets']), seed, ...(title ? { title } : {}), ...own }); return [{ id: 'court', name: m.title, manifest: { ...m, game: contract('court', 'the match') } }]; }
  if (sp.shape === 'turns') { const m = turnsManifest({ ...pick(Q, ['sport', 'seats', 'players', 'register', 'level', 'rounds']), seed, ...(title ? { title } : {}), ...own }); return [{ id: 'course', name: m.title, manifest: { ...m, game: contract('course', 'the round') } }]; }
  const m = teamManifest({ ...pick(Q, ['sport', 'players', 'register', 'level', 'periods', 'seconds']), seed, ...(title ? { title } : {}), ...own });
  return [{ id: 'pitch', name: m.title, manifest: { ...m, game: contract('pitch', 'the match') } }];
}

// what a board game takes, lifted (tabletop/holo-arena.js: the tabletop kernel the referee, the arena its depiction)
const TABLETOP_KEYS = ['goal', 'game', 'human', 'players', 'level', 'lift', 'theme', 'screen'];
function readTabletop(Q) {
  if (Q.camera !== undefined) throw fail('.camera: a board game is seen from its arena\'s camera, behind your podium');
  for (const k of Object.keys(Q)) if (!TABLETOP_KEYS.includes(k)) throw fail(`.${k}: a tabletop takes ${TABLETOP_KEYS.join(', ')} (its pieces are its game's)`);
  if (Q.lift !== undefined && !HOLO_LIFTS.includes(Q.lift)) throw fail(`.lift is ${HOLO_LIFTS.join(' | ')} (the depiction; the game on its own page is create_game { tabletop })`);
  try { readHolo(pick(Q, ['game', 'human', 'players', 'level'])); } catch (e) { throw fail(`: ${e.message.replace(/^holo: /, '')}`); }
}
/** A board game's level: the hologram arena as a stage carrying the game and a hosted level's contract. */
export function tabletopArenas(Q, { title, seed = 1 } = {}) {
  const m = holoManifest({ ...pick(Q, ['game', 'human', 'players', 'level']), seed, ...(title ? { title } : {}) });
  const contract = { levelRef: 'holo', consumes: [], produces: { results: ['success', 'fail'], events: [] }, presets: { default: {} }, complete: { text: 'the duel' } };
  return [{ id: 'arena', name: m.title, manifest: { ...m, game: contract } }];
}

// what a fight takes (a versus game is its own simulation: no hero, trail, building, ride or run)
const FIGHT_KEYS = ['goal', 'roster', 'arenas', 'rounds', 'timer', 'rules', 'theme', 'camera', 'screen'];
function readFight(Q) {
  for (const k of Object.keys(Q)) {
    if (k === 'stages') throw fail('.stages: a fight is fought on its arenas (name them as arenas)');
    if (!FIGHT_KEYS.includes(k)) throw fail(`.${k}: a fight takes ${FIGHT_KEYS.join(', ')} (its fighters are its roster)`);
  }
  if (Q.camera !== undefined && Q.camera !== 'side') throw fail('.fight is seen from the side (camera side)');
  if (Q.roster !== undefined) {
    if (!Array.isArray(Q.roster) || Q.roster.length < 1 || Q.roster.length > 12) throw fail('.roster is 1 to 12 fighters, each a character: an archetype word, a brief in words, { brief?, facets?, seed?, archetype?, role?, build?, age?, … }, or { hero: { ref } }');
    const ids = new Set();
    Q.roster.forEach((r, i) => {
      let spec;
      try { spec = fighterSpec(r, i); } catch (e) { throw fail(`.roster[${i}]: ${e.message.replace(/^versus: /, '')}`); }
      if (ids.has(spec.id)) throw fail(`.roster[${i}].id '${spec.id}' is taken`);
      ids.add(spec.id);
      // the fight's own words over the sheet compile as they would on any fighter
      const { style, ...over } = spec.over;
      try { compileFighter(solveFighter({ id: spec.id, archetype: style, ...over }).recipe); } catch (e) { throw fail(`.roster[${i}]: ${e.message.replace(/^versus: /, '')}`); }
    });
  }
  if (Q.arenas === false) throw fail('.arenas: a fight is fought on its arenas (name them, or leave them out for a plaza and a nave)');
  if (Q.arenas !== undefined && Q.arenas !== false) {
    if (!Array.isArray(Q.arenas) || Q.arenas.length < 1 || Q.arenas.length > 8) throw fail('.arenas is 1 to 8 arenas { id, name?, kit?, look?, width?, depth?, height?, crowd? }, or false for flat stages');
    const ids = new Set();
    Q.arenas.forEach((a, i) => {
      if (!isObj(a) || typeof a.id !== 'string' || !/^[a-z0-9-]{1,32}$/.test(a.id)) throw fail(`.arenas[${i}] needs an id (a short lower-case name)`);
      if (ids.has(a.id)) throw fail(`.arenas[${i}].id '${a.id}' is taken`);
      ids.add(a.id);
      const { id: _id, name: _n, ...words } = a;
      try { readArena(words); } catch (e) { throw fail(`.arenas[${i}]: ${e.message.replace(/^versus: /, '')}`); }
    });
  }
  if (Q.rounds !== undefined && !(Number.isInteger(Q.rounds) && Q.rounds >= 1 && Q.rounds <= 3)) throw fail('.rounds is how many rounds win the match, 1 to 3');
  if (Q.timer !== undefined && !(Number.isInteger(Q.timer) && Q.timer >= 30 && Q.timer <= 99)) throw fail('.timer is a round\'s seconds, 30 to 99');
  if (Q.rules !== undefined) {
    try { readRules(Q.rules); } catch (e) { throw fail(`.rules: ${e.message.replace(/^versus: /, '')}`); }
  }
}

// a fight's arenas when it names none: an open-air plaza and a nave
export const FIGHT_ARENAS = Object.freeze([{ id: 'plaza', name: 'Plaza', kit: 'island-plaza' }, { id: 'nave', name: 'Nave', kit: 'gothic-nave' }]);

/** A fight's arenas as stage recipes (each a level the fight runs on): → [{ id, name, manifest }]; none with arenas: false. */
export function fightArenas(Q, { title, roster } = {}) {
  const rules = fightRules(Q);
  return (Q.arenas ?? FIGHT_ARENAS).map(({ id, name, ...words }) => ({
    id, name: name ?? id,
    manifest: arenaManifest({ ...words, title: `${title ?? 'versus'} · ${name ?? id}`, ...(roster ? { roster } : {}), ...(rules ? { rules } : {}) }),
  }));
}

/** A fight's fighters (versus-sheet.js fighterSpec): each a sheet to make into a character, or a character already
 * made; the default four sheets when the roster names none. */
export const fightFighters = (Q, seed = 1) => (Q.roster ?? defaultFighters(seed)).map((e, k) => fighterSpec(e, k, seed));
// the fight's rules: the full block (versus-core readRules: systems and the sim's dials), rounds and timer over it
const fightRules = (Q) => (Q.rounds || Q.timer || Q.rules ? { ...(Q.rules ?? {}), ...(Q.rounds ? { rounds: Q.rounds } : {}), ...(Q.timer ? { timer: Q.timer } : {}) } : null);

/** A fight's game: the versus manifest the play route serves (versus/versus-page.js); `roster` its characters, `arenas`
 * its levels' refs. */
export function quickVersus(Q, { title, theme, arenas, roster } = {}) {
  return {
    kind: 'game', engine: 'versus', title,
    ...(roster ? { roster } : {}),
    ...(arenas && arenas.length ? { arenas } : {}),
    ...(fightRules(Q) ? { rules: fightRules(Q) } : {}),
    ...(theme ? { theme } : {}),
  };
}

/** A quick game's gameworld: the creator's own settings (id, name, seed, style …) kept, one level written. */
export function quickWorld({ quick: given, id, name, seed, style, ...rest } = {}) {
  readQuick(given);
  // the camera is the world's setting, not the goal's: it moves up to the world, where both run paths read it
  // (and the screen it is made for, beside it: game/screen.js)
  const { camera: named, moves, screen, ...quick } = given;
  // a shooter aims: without a camera named, from the eye
  const camera = named ?? ((quick.goal === 'shoot' && quick.craft === undefined) || quick.goal === 'deathmatch' ? 'first-person' : quick.goal === 'fight' ? 'side' : undefined);
  if (typeof id !== 'string') throw fail(': the world needs an id (a short lower-case name)');
  const kit = style?.kit ?? 'trail-valley';
  // one rule for open ground (era/stage.js isGroundKit): a room kit had a shell, passed, and failed deep in the stage
  if (!isGroundKit(kit)) throw fail(`: style.kit ${STAGE_KITS[resolveKitId(kit)] ? roomKitDoor(kit).replace('levels.<id>.building', 'quick.building').replace(' (a quick game: quick.building)', '') : `'${kit}' is not a stage kit`} (open ground: ${GROUND_KITS.join(', ')})`);
  // a loop is laid on the trail's land: the longest trail, so a lap is a stretch worth driving
  const loop = quick.goal === 'race' && (quick.track === 'loop' || ((quick.rivals || quick.racers || quick.supercars) && quick.track !== 'trail'));
  // an arena too: its trail the longest, with no beat that cuts the land or stands a stone on it
  const nodes = { path: { trail: loop || quick.goal === 'deathmatch' ? { run: RACE.run, beats: RACE.beats } : {} }, ...(quick.climb ? { top: { meru: {} } } : {}) };
  // a run's pool: trails each laid from its own seed, two more than a run draws
  const s0 = Number.isInteger(seed) ? seed : 1;
  // a race on a roadway: the level is the roadway itself (a lap, or a stage when its course runs end to end), dressed
  // (in words, `{ intent }`: trackscape's door, roads/trackscape-compose.js — the course designed, drawn in the words'
  // look and dressed where a driver looks)
  const worded = isObj(quick.roadway) && typeof quick.roadway.intent === 'string' ? composeTrack(quick.roadway.intent, { seed: s0 }) : null;
  // a flight: the level is an airspace (skyscape/), its map flown by the craft, its course its laps
  // (a dogfight is a flight with no course: the foes are its goal)
  const dogfight = quick.goal === 'shoot' && quick.craft !== undefined;
  const flight = quick.goal === 'fly' || dogfight ? { run: { name: name ?? id, airspace: { ...(quick.airspace ?? {}), ...(dogfight ? { course: false } : {}), map: { ...(quick.airspace?.map ?? {}), craft: quick.craft ?? (quick.transformer ? 'jet' : 'trainer') }, ...(quick.assist ? { assist: quick.assist } : {}), ...(quick.laps ? { course: { ...(isObj(quick.airspace?.course) ? quick.airspace.course : {}), laps: quick.laps } } : {}) } } } : null;
  // (the race's mood: the roadway lit in it, roads/race-mood.js)
  const mood = quick.mood ? { mood: quick.mood } : {};
  // a runner: the run is the level (its seed the world's), and a hero runs it (made when none is named)
  if (quick.goal === 'runner') {
    return {
      id, name: name ?? id, ...(seed !== undefined ? { seed } : {}), mode: 'autonomous', ...rest, ...(screen !== undefined ? { screen } : {}),
      style: { ...(style ?? {}), kit },
      levels: { run: { name: name ?? id, runner: quick.runner ?? true } },
      quick: { ...quick, hero: quick.hero ?? {} },
    };
  }
  const levels = flight ?? (worded ? { run: { name: name ?? id, roadway: { form: worded.form, course: worded.course, kit: worded.kit, scape: worded.scape, ...mood } } }
    : quick.roadway ? { run: { name: name ?? id, roadway: { course: quick.roadway, dress: true, ...mood } } } : quick.run
    ? Object.fromEntries(Array.from({ length: quick.run + 2 }, (_, k) => [`stretch-${k + 1}`, { name: `${name ?? id} ${k + 1}`, seed: s0 + 101 * (k + 1), walk: { nodes: { path: { trail: {} } } } }]))
    : { run: quick.building ? { name: name ?? id, building: quick.building } : { name: name ?? id, walk: { nodes, ...(quick.climb ? { edges: [{ from: 'path', to: 'top' }] } : {}) },
      // a deathmatch's arena: its words, a spawn for each in the match
      ...(quick.goal === 'deathmatch' ? { arena: { words: quick.arena ?? (quick.pole !== undefined ? shooterPole(quick.pole).arena : DEATHMATCH.arena), spawns: (quick.bots ?? DEATHMATCH.bots) + 1, ...(quick.weapons ? { weapons: poleArmory(quick.pole).slice(1) } : {}), ...(deathmatchSides(quick) ? { teams: 2 } : {}) } } : {}) } });
  return {
    id, name: name ?? id, ...(seed !== undefined ? { seed } : {}), mode: 'autonomous', ...rest, ...(camera ? { camera } : {}), ...(moves ? { moves: true } : {}), ...(screen !== undefined ? { screen } : {}),
    style: { ...(style ?? {}), kit },
    levels,
    quick,
  };
}

/** The goal's mechanics on a stage, placed on its own anchors (`ends`: stageEnds'). The exit ends every goal but
 * survive; on a climb's stage the exit is its top (a volume, not a disc on the ground). */
export function goalMechanics(quick, ends) {
  const exit = { kind: 'reach-exit', at: ends.exit, radius: 2.5, ...(ends.planar ? {} : { planar: false }) };
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  switch (quick.goal) {
    case 'collect': {
      const pickups = along.map((b) => ({ item: quick.pickup ?? 'gem', at: b.at, radius: 1.6 }));
      // the bag carried level to level (the bag mechanic): what was picked up, used or bought goes on
      return [...(pickups.length ? [{ kind: 'collect', into: 'bag', pickups }] : []), { kind: 'bag', slice: 'bag' }, exit];
    }
    case 'survive':
      return [{ kind: 'survive', seconds: quick.seconds ?? 45 }];
    case 'runner':
      return [{ kind: 'runner', ...(quick.distance !== undefined ? { distance: quick.distance } : {}) }];
    case 'fly': {
      // the course's gates in three dimensions, then a landing on the runway (skyscape/course.js), round `laps` times; a
      // crash comes back at the last gate passed
      if (!ends.course) throw new Error('gameworld: quick.fly needs a course on its airspace (course: true)');
      return [flightLaps(ends.course, ends.airMap, ends.airField, ends.seat)];
    }
    case 'race': {
      // the trail's beats in order are the checkpoints, its end the finish; spaced when the intent asks (a beat nearer
      // the last kept, or the start, than `ends.spacing` is passed by)
      const kept = [];
      for (const b of along) { const last = kept.length ? kept[kept.length - 1].at : ends.spawn; if (!ends.spacing || Math.hypot(b.at[0] - last[0], b.at[1] - last[1]) >= ends.spacing) kept.push(b); }
      const rivals = raceRivals(quick), race = rivals.length ? { rivals, win: raceWin(rivals.length) } : {};
      // on a roadway (roads/contract.js): its own checkpoints, the last its finish; a lap goes round `laps` times
      if (ends.roadway) {
        const T = ends.roadway;
        return [{ kind: 'laps', checkpoints: T.checkpoints, ...(T.closed ? { laps: quick.laps ?? RACE.laps } : {}), ...race }];
      }
      // round a loop (lay-concerns.js loopSite): checkpoints about every RACE.leg metres of its line, the last its start
      const loop = ends.loop;
      if (loop) {
        const L = loop.line, n = L.length, K = Math.max(4, Math.round(loop.length / RACE.leg));
        const checkpoints = Array.from({ length: K }, (_, j) => { const q = L[Math.round(((j + 1) * n) / K) % n]; return { at: [q[0], q[1], q[2] ?? ends.spawn[2]], radius: loop.width / 2 + 1 }; });
        return [{ kind: 'laps', checkpoints, laps: quick.laps ?? RACE.laps, ...race }];
      }
      const checkpoints = [...kept.map((b) => ({ at: b.at, radius: 3.5 })), { at: ends.exit, radius: 3, ...(ends.planar ? {} : { planar: false }) }];
      return [{ kind: 'laps', checkpoints, ...race }];
    }
    case 'rhythm':
      return [{ kind: 'on-beat', ...(quick.misses ? { misses: quick.misses } : {}) }, { kind: 'score', label: 'Beats', points: [{ on: 'beat:hit' }] }, exit];
    case 'defend': {
      // the foes' walk: from the trail's end, back down its beats, to the start (the base)
      const W = quick.waves ?? 3, path = [ends.exit, ...along.slice().reverse().map((b) => b.at), ends.spawn].map((p) => [p[0], p[1]]);
      let n = 0;
      const waves = DEFEND.perWave.slice(0, W).map((c, k) => ({ ...(k ? { after: 10 } : { after: 6 }), foes: Array.from({ length: c }, () => `foe-${++n}`), every: 1.6 }));
      return [{ kind: 'waves', waves, path, lives: quick.lives ?? 5, bounty: DEFEND.bounty, purse: { var: 'gold', start: DEFEND.gold } }];
    }
    case 'puzzle':
      return [puzzleGrid(quick, ends)];
    case 'farm': {
      const plots = farmPlots(quick, ends), target = quick.target ?? 40;
      return [
        { kind: 'clock', start: FARM.start, rate: FARM.rate },
        { kind: 'crops', plots: plots.map((at) => ({ at })), cost: FARM.cost, price: FARM.price, days: 2, purse: { var: 'gold', start: FARM.gold }, by: quick.days ?? 6 },
        { kind: 'win-when', when: { var: 'gold', gte: target }, event: 'farm:rich', hud: 'Gold' },
      ];
    }
    case 'shoot': {
      // a dogfight (a craft: skyscape/dogfight.js): every fighter down, each hit on the craft costs hp, a crash costs
      // more and comes back at the start
      if (ends.airMap) {
        const p = ends.seat.transform;
        return [
          { kind: 'fail-on-death', startHp: SHOOT.hp, hits: DOGFIGHT.hit },
          { kind: 'respawn', at: { spot: p.pos, heading: p.heading, aloft: 1 }, hurt: DOGFIGHT.crash },
          // a dogfight in waves: wing after wing, each woken when the one before is down (dogfight.js waveIds)
          ...(quick.waves && !ends.airField.port ? [{ kind: 'waves', waves: waveIds(quick.waves, quick.foes ?? WING.n), clear: true }] : [
          // a trench run (a station's trench: skyscape/trench.js) is won by its port alone; a dogfight by the wing
          { kind: 'defeat-all', who: 'foe-*', count: ends.airField.port ? 1 : Math.max(1, Math.min(WING.max, quick.foes ?? WING.n)), label: ends.airField.port ? 'Port' : 'Down' }]),
        ];
      }
      // every foe down; each hit on you costs hp; the supplies between the posts
      const posts = shootPosts(quick, ends), drops = shootDrops(posts, ends);
      return [
        { kind: 'fail-on-death', startHp: SHOOT.hp, hits: SHOOT.hit },
        ...(drops.length ? [{ kind: 'supplies', max: SHOOT.hp, drops }] : []),
        { kind: 'defeat-all', who: 'foe-*', count: posts.length, label: 'Down' },
      ];
    }
    case 'deathmatch': {
      // a match on the arena its concern laid: the bots its rivals, its spawns where the fallen come back, its supplies
      if (!ends.arena) throw new Error('gameworld: quick deathmatch: the stage laid no arena (its trail is too short to hold one)');
      // two sides (mode team or control): each comes back at its own base, the frags its side's; with control, a point
      // in the middle the sides hold for time (frags' limit then high: the point decides)
      const rivals = deathmatchBots(quick), S = deathmatchSides(quick), A = ends.arena;
      const limit = quick.frags ?? (quick.mode === 'control' ? 50 : S ? DEATHMATCH.teamFrags : DEATHMATCH.frags);
      const sides = S ? { teams: S, spawns: { red: A.bases[0].map((k) => A.spawns[k]), blue: A.bases[1].map((k) => A.spawns[k]) } } : { spawns: A.spawns };
      const base = { kind: 'frags', rivals, frags: limit, ...(quick.seconds ? { seconds: quick.seconds } : {}), ...sides };
      const point = quick.mode === 'control' ? [{ kind: 'control', teams: S, at: deathmatchPoint(ends), radius: 4, hold: DEATHMATCH.hold }] : [];
      const drops = deathmatchDrops(quick, ends);
      if (quick.pole === undefined) return [
        { ...base, respawn: DEATHMATCH.respawn, hp: SHOOT.hp, hits: SHOOT.hit },
        { kind: 'supplies', max: SHOOT.hp, drops: drops.map((d) => ({ ...d, amount: d.gives === 'health' ? SHOOT.health : SHOOT.rounds })), takers: 'bot-*' },
        ...point,
      ];
      // on the shooter pole (shooter-pole.js): its hp taking each round's own damage (armor first), its respawn, its kit
      const P = shooterPole(quick.pole), ab = P.abilities;
      const amount = { health: Math.round(P.hp * 0.3), ammo: P.weapon.magazine, armor: Math.round(P.hp * 0.5), overdrive: 10 };
      return [
        { ...base, respawn: P.respawn, hp: P.hp, damage: true, ...(drops.some((d) => d.gives === 'armor') ? { armor: true } : {}) },
        { kind: 'supplies', max: P.hp, armorMax: P.hp, drops: drops.map((d) => ({ ...d, amount: amount[d.gives] })), takers: 'bot-*' },
        ...(P.regen ? [{ kind: 'regen', ...P.regen }] : []),
        ...(ab.heal || ab.ultimate ? [{ kind: 'abilities', ...(ab.heal ? { heal: ab.heal } : {}), ...(ab.ultimate ? { ultimate: { ...ab.ultimate, rivals: S ? S.blue : rivals } } : {}) }] : []),
        ...point,
      ];
    }
    case 'battle':
      return [{ kind: 'fail-on-death', startHp: BATTLE.hp }, { kind: 'win-when', when: { var: 'won', gte: Math.min(quick.foes ?? 3, along.length || 1) }, event: 'battles:won', hud: 'Won' }];
    case 'sneak':
      return [{ kind: 'unseen', ...(quick.alarms > 1 ? { alarms: quick.alarms } : {}) }, exit];
    case 'avoid': {
      const hazards = (ends.hazards ?? []).map((h) => ({ at: h.at, radius: 2.2, damage: 25 }));
      return [...(hazards.length ? [{ kind: 'hazard-damage', hazards }, { kind: 'fail-on-death' }] : []), exit];
    }
    default:
      return [exit];
  }
}

/** A sneak's guards on a stage: `count` posts on the trail's beats (spread from start to end, never the first few
 * metres), each facing back down the trail toward the start, its gaze sweeping. [{ id, at, heading }]. */
/** A race's rivals' ids (quick.rivals of them). */
const fieldSize = (f) => (Array.isArray(f) ? f.length : f);
export const raceRivals = (quick) => Array.from({ length: quick.racers !== undefined ? fieldSize(quick.racers) - 1 : quick.supercars !== undefined ? fieldSize(quick.supercars) - 1 : quick.rivals ?? 0 }, (_, k) => `rival-${k + 1}`);

/** A field of supercars (quick.supercars): each a composed card (the library's in turn unless named), its livery its
 * own or solved (color-theorist/livery.js) against what the race is seen on (the mood's road, kerb, verge and sky),
 * its rule the sports class at its own frame, at the race's tuning (arcade unless named) and conditions, and its
 * figure the recipe the page draws it by, lit in the race's mood. → { field: [{ spec, figure, rule }] } */
export function quickSupercars(quick, seed = 1) {
  const given = Array.isArray(quick.supercars) ? quick.supercars : Array.from({ length: quick.supercars }, () => ({}));
  const presets = Object.keys(SUPERCAR_LIBRARY), unpainted = given.filter((c) => c.paint === undefined).length;
  const solved = unpainted ? solveLiveries({ n: unpainted, seed, ...(quick.mood ? { against: moodGround(moodOf(quick.mood)) } : {}) }).liveries : [];
  let u = 0;
  const field = given.map((c, k) => {
    const L = c.paint === undefined ? solved[u++] : null;
    const surface = L ? { paint: L.paint, livery: c.livery ?? { pattern: L.pattern, secondary: L.secondary } } : { paint: c.paint, ...(c.livery ? { livery: c.livery } : {}) };
    const spec = { preset: c.preset ?? presets[k % presets.length], seed: c.seed ?? seed * 31 + 7 * k + 1, surface, ...(quick.mood ? { mood: quick.mood } : {}) };
    const design = composeSupercar({ preset: spec.preset, seed: spec.seed, surface: { ...surface, quality: 'game' } }).design;
    return { spec, figure: { supercar: spec }, rule: { ...supercarRule(design, { tuning: quick.tuning ?? 'arcade', conditions: quick.conditions ?? 'dry' }), eye: 0 } };
  });
  return { field };
}

/** A field of racers (quick.racers): the roster solved and balanced (car-designer/roster.js), each racer's recipe (what
 * its figure resolves through) and the drive rule its own machine plays by, at the race's tuning (arcade unless named)
 * and conditions. → { field: [{ spec, archetype, rule }], balance, changes } */
export function quickRacers(quick, seed = 1, setting) {
  const { racers, balance, changes } = solveRoster(quick.racers, { seed, ...(setting ? { setting } : {}) });
  const field = racers.map((r) => ({ spec: r.spec, archetype: r.archetype, rule: { ...racerRule(r.S, { tuning: quick.tuning ?? 'arcade', conditions: quick.conditions ?? 'dry' }), eye: 0 } }));
  return { field, balance, changes };
}
// the place a race against n rivals is won at: the top half of the field, the podium at most
const raceWin = (n) => Math.min(3, Math.ceil((n + 1) / 2));

/** A race's grid and its rivals (quick.rivals): every car in the ride's build, two abreast behind the start line (a
 * loop's, else the spawn), the player last; each rival on the racer rule along the way (the loop's line, closed, or
 * the trail's beats to its end), a lane off it by turns and a pace that falls off down the grid.
 * → { figures, entities, pilot: { transform } } (stageLevelOrder's extra); nothing for a race alone on a trail */
export function raceCast(quick, ends, ride) {
  const rivals = raceRivals(quick), loop = ends.loop;
  if (ends.roadway) return roadwayCast(rivals, ends.roadway, ride);
  if (!loop && !rivals.length) return {};
  const start = loop ? loop.start : ends.spawn, h = loop ? loop.heading : ends.heading;
  const u = [Math.cos(h), Math.sin(h)], l = [-u[1], u[0]];
  const slot = (k) => {
    const row = Math.floor(k / 2), side = k % 2 ? -1 : 1, back = RACE.gridFront + RACE.gridRow * row;
    const x = start[0] - u[0] * back + l[0] * RACE.gridSide * side, y = start[1] - u[1] * back + l[1] * RACE.gridSide * side;
    const z = ends.ground ? ends.ground(x, y) : null;
    return [r3(x), r3(y), z ?? start[2]];
  };
  const line = loop ? loop.line.map((q) => [q[0], q[1]]) : [...(ends.beats ?? []).filter((b) => b.beat !== 'trailhead').map((b) => [b.at[0], b.at[1]])];
  const figures = {}, entities = [];
  rivals.forEach((id, k) => {
    // (a field of racers: each rival in its own machine, on its own rule)
    const mine = ride.field?.[k + 1];
    figures[id] = mine ? (mine.figure ?? { racer: mine.spec }) : { vehicleRef: ride.ref, targetH: RIDE_H };
    const pace = r3(RACE.pace[0] - ((RACE.pace[0] - RACE.pace[1]) * k) / Math.max(1, rivals.length - 1));
    const rule = { ...(mine ? mine.rule : ride.rule), type: 'racer', line, closed: !!loop, lane: k % 2 ? -RACE.lane : RACE.lane, pace };
    entities.push({ id, team: 'rivals', rule, body: { type: 'figure-rig', figure: id }, transform: { pos: slot(k), heading: h } });
  });
  return { figures, entities, pilot: { transform: { pos: slot(rivals.length), heading: h } } };
}

/** The class a ride plays when the quick game asks for a tuning or conditions but names no vehicle. */
export const RIDE_CLASS = Object.freeze({ car: 'midsize', coupe: 'sports', van: 'van' });
/** The ride's rule: its build's (ride.js) unless the quick game names a vehicle, a tuning or conditions, then the
 *  class's (roads/vehicles.js), in its look. */
export function quickRideRule(Q, built) {
  if (Q.vehicle === undefined && Q.tuning === undefined && Q.conditions === undefined) return built;
  return vehicleRule(Q.vehicle ?? RIDE_CLASS[Q.ride], { ...(Q.tuning ? { tuning: Q.tuning } : {}), ...(Q.conditions ? { conditions: Q.conditions } : {}) });
}

/** A race's cast on a roadway: every car on the contract's grid (the player behind the rivals), each rival on the racer
 * rule along the racing line, a lane either side of it by turns, its pace falling off down the grid. */
function roadwayCast(rivals, T, ride) {
  const line = T.line.map((q) => [q[0], q[1]]), slot = (k) => T.grid[Math.min(k, T.grid.length - 1)];
  // the ramps a rival would overshoot: each lip and the fastest speed that lands it (a kicker lands anywhere)
  const ramps = T.ramps.filter((r) => r.lip && r.band).map((r) => ({ at: [r.lip.at[0], r.lip.at[1]], lo: r.band.lo, hi: r.band.hi }));
  const figures = {}, entities = [];
  rivals.forEach((id, k) => {
    const mine = ride.field?.[k + 1];
    figures[id] = mine ? (mine.figure ?? { racer: mine.spec }) : { vehicleRef: ride.ref, targetH: RIDE_H };
    const pace = r3(RACE.pace[0] - ((RACE.pace[0] - RACE.pace[1]) * k) / Math.max(1, rivals.length - 1));
    const rule = { ...(mine ? mine.rule : ride.rule), type: 'racer', line, closed: T.closed, lane: k % 2 ? -RACE.roadLane : RACE.roadLane, pace, collideRadius: mine ? mine.rule.collideRadius : RACE.body, ...(ramps.length ? { ramps } : {}) };
    entities.push({ id, team: 'rivals', rule, body: { type: 'figure-rig', figure: id }, transform: { pos: slot(k).at, heading: slot(k).heading } });
  });
  return { figures, entities, pilot: { rule: { collideRadius: ride.field ? ride.field[0].rule.collideRadius : RACE.body }, transform: { pos: slot(rivals.length).at, heading: slot(rivals.length).heading } } };
}

export function guardPosts(quick, ends) {
  return beatPosts(ends, quick.guards ?? 3).map((p, k) => ({ ...p, id: `guard-${k + 1}` }));
}

/** A puzzle's grid by the trail (5 × 5 cells of 2.5 m, square to the world), centred on the first of its beats (then
 * the start, then 10 m on from it) where every cell lies on the land and the land is fairly level (2 m from its lowest
 * cell to its highest). `boulders` lanes, each a boulder two pushes from its plate with room to push from, none crossing
 * another; seeded by the stage's own spawn, so a stage lays the same puzzle every time. → the push mechanic. */
export function puzzleGrid(quick, ends) {
  const cols = 5, rows = 5, cell = 2.5, s = ends.spawn, h = ends.heading ?? 0;
  const lay = (c) => {
    const origin = [r3(c[0] - (cols * cell) / 2), r3(c[1] - (rows * cell) / 2), s[2]];
    if (!ends.ground) return { origin, heights: null };
    const heights = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, k) => ends.ground(origin[0] + (k + 0.5) * cell, origin[1] + (r + 0.5) * cell)));
    const all = heights.flat();
    if (all.some((z) => z == null) || Math.max(...all) - Math.min(...all) > 2) return null;
    return { origin: [origin[0], origin[1], r3(Math.min(...all))], heights };
  };
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead').map((b) => b.at);
  let site = null;
  // the board the intent flattened for it (lay-concerns.js), first
  for (const c of [...(ends.board ? [ends.board] : []), ...along, s, [s[0] + Math.cos(h) * 10, s[1] + Math.sin(h) * 10]]) if ((site = lay(c))) break;
  site ??= { origin: [r3(s[0] + Math.cos(h) * 10 - (cols * cell) / 2), r3(s[1] + Math.sin(h) * 10 - (rows * cell) / 2), s[2]], heights: null };
  const rnd = mulberry32(Math.abs(Math.round(s[0] * 131 + s[1] * 71)) + 1);
  const used = new Set(), blocks = [], plates = [], K = (q) => `${q[0]},${q[1]}`;
  const inside = (q) => q[0] >= 0 && q[1] >= 0 && q[0] < cols && q[1] < rows;
  for (let tries = 0; blocks.length < (quick.boulders ?? 2) && tries < 400; tries++) {
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)];
    const b = [Math.floor(rnd() * cols), Math.floor(rnd() * rows)];
    const lane = [[b[0] - dx, b[1] - dy], b, [b[0] + dx, b[1] + dy], [b[0] + 2 * dx, b[1] + 2 * dy]];   // stand, boulder, between, plate
    if (!lane.every(inside) || lane.some((q) => used.has(K(q)))) continue;
    lane.forEach((q) => used.add(K(q)));
    blocks.push(b); plates.push(lane[3]);
  }
  return { kind: 'push', origin: site.origin, cols, rows, cell, blocks, plates, ...(site.heights ? { heights: site.heights } : {}) };
}

/** A farm's plots: a block of them (three a row, 2.5 m apart) on the first level land by the trail (its beats, then the
 * start), each on the land's own height. → [[x, y, z]] */
export function farmPlots(quick, ends) {
  const n = quick.plots ?? 6, per = 3, rows = Math.ceil(n / per), gap = 2.5, s = ends.spawn, h = ends.heading ?? 0;
  const lay = (c) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const x = c[0] + ((k % per) - (per - 1) / 2) * gap, y = c[1] + (Math.floor(k / per) - (rows - 1) / 2) * gap;
      const z = ends.ground ? ends.ground(x, y) : s[2];
      if (z == null) return null;
      out.push([r3(x), r3(y), z]);
    }
    const zs = out.map((p) => p[2]);
    return Math.max(...zs) - Math.min(...zs) <= 1.5 ? out : null;
  };
  // beside the way: off to the side of each beat, so the trail stays clear
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead').map((b) => b.at);
  const sites = along.flatMap((a, k) => { const prev = k ? along[k - 1] : s, hh = Math.atan2(a[1] - prev[1], a[0] - prev[0]); return [1, -1].map((side) => [a[0] - Math.sin(hh) * 6 * side, a[1] + Math.cos(hh) * 6 * side]); });
  // the field the intent flattened for them (lay-concerns.js), first
  for (const c of [...(ends.field ? [ends.field] : []), ...sites, [s[0] + Math.cos(h) * 8, s[1] + Math.sin(h) * 8]]) { const got = lay(c); if (got) return got; }
  return lay([s[0] + Math.cos(h) * 8, s[1] + Math.sin(h) * 8]) ?? [[r3(s[0] + Math.cos(h) * 8), r3(s[1] + Math.sin(h) * 8), s[2]]];
}

/** A farm's farmhands: `folk` (2) standing by the start, each keeping a day (play.routines): out to the plots at seven,
 * home at the start at six in the evening. `ref`: their figure. → { figures, entities, play } (stageLevelOrder's `extra`) */
/** A cast's figure for its k-th member: `ref` one figure for all, or a pool (runner.js: each a roll of its own) cycled. */
export const refAt = (ref, k) => (Array.isArray(ref) ? ref[k % ref.length] : ref);

export function farmCast(quick, ends, ref) {
  const n = quick.folk ?? 2, plots = farmPlots(quick, ends), s = ends.spawn;
  const field = plots.reduce((a, p) => [a[0] + p[0] / plots.length, a[1] + p[1] / plots.length], [0, 0]);
  const figures = {}, entities = [], routines = [];
  for (let k = 1; k <= n; k++) {
    const id = `farmhand-${k}`;
    figures[id] = libraryFigure(refAt(ref, k - 1));
    entities.push({ id, rule: standRule({ speed: 1.6 }), body: { type: 'figure-rig', figure: id }, transform: { pos: [r3(s[0] + 2 * k), r3(s[1] - 2), s[2]], heading: 0 } });
    routines.push({ who: id, plan: [{ hour: 7, to: `field-${k}` }, { hour: 18, to: 'home' }] });
  }
  const spots = [{ id: 'home', at: [s[0], s[1]] }, ...Array.from({ length: n }, (_, k) => ({ id: `field-${k + 1}`, at: [r3(field[0] + (k - (n - 1) / 2) * 1.5), r3(field[1] - 3)] }))];
  return { figures, entities, play: { spots, routines } };
}

/** A battle's foes: `foes` (3) standing on the trail's beats, facing back down it, each fought turn by turn when the
 * hero walks up (play.battle, playscape/ui/battles.js). `ref`: their figure. → { figures, entities, play } */
export function battleCast(quick, ends, ref) {
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  const n = Math.min(quick.foes ?? 3, along.length);
  const picks = Array.from({ length: n }, (_, k) => along[Math.min(along.length - 1, Math.floor(((k + 0.5) * along.length) / n))]);
  const figures = {}, entities = [], foes = [];
  picks.forEach((b, k) => {
    const id = `foe-${k + 1}`, back = k ? picks[k - 1].at : ends.spawn;
    standFoe(figures, entities, id, refAt(ref, k), b.at, back, quick.foe);
    foes.push({ who: id, at: [b.at[0], b.at[1]], name: `Foe ${k + 1}`, hp: BATTLE.foeHp[k], atk: BATTLE.foeAtk[k] });
  });
  return { figures, entities, play: { battle: { hero: { atk: BATTLE.atk, hp: 'hp' }, foes } } };
}

// a foe fought turn by turn: its figure (a person, or the beast its `look` names), standing at `at`, facing `back` (the
// way the hero comes)
function standFoe(figures, entities, id, ref, at, back, look = null) {
  stand({ figures, entities }, id, foeFigure(ref, look), at, facing(at, back));
}

/**
 * A LEVEL'S GOAL in a whole gameworld (a level's `goal`, world.js): quick's goals laid together on a level's stages,
 * through the same mechanics a quick game's goal uses.
 *   collect   what lies along each stage's beats picked up into the bag (the collect goal's pickups, its bag on I)
 *   boss      a foe at the end of the level's last stage, fought turn by turn (a battle's foe, the last one's hp): its
 *             fall ends the level, in place of the exit
 *   health    hp on the HUD, the level lost at none (fail-on-death), the stage's hazards hurting (avoid's)
 * Numbers: the hero's hp a battle's, a hazard's bite a quarter of it, the boss the last foe's hp, a blow short of its
 * atk, so a fight fought by attacks alone is won with hp to spare.
 */
export const LEVEL_GOAL = Object.freeze({ hp: BATTLE.hp, hit: BATTLE.atk, hazard: BATTLE.hp / 4, boss: { hp: BATTLE.foeHp.at(-1), atk: BATTLE.foeAtk.at(-1) - 1 } });
export const LEVEL_GOAL_PARTS = Object.freeze(['collect', 'boss', 'health']);

/** A level goal's mechanics on one stage (`ends`: stageEnds'); `last`: the level's last stage, where its boss stands. */
export function levelGoalMechanics(goal, ends, { last = false } = {}) {
  const exit = { kind: 'reach-exit', at: ends.exit, radius: 2.5, ...(ends.planar ? {} : { planar: false }), ...(ends.via ? { via: ends.via } : {}) };
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  const boss = !!goal.boss && last, out = [];
  if (goal.collect) {
    const pickups = along.map((b) => ({ item: goal.collect === true ? 'gem' : goal.collect, at: b.at, radius: 1.6 }));
    out.push(...(pickups.length ? [{ kind: 'collect', into: 'bag', pickups }] : []), { kind: 'bag', slice: 'bag' });
  }
  const hazards = goal.health ? (ends.hazards ?? []).map((h) => ({ at: h.at, radius: 2.2, damage: LEVEL_GOAL.hazard })) : [];
  if (hazards.length) out.push({ kind: 'hazard-damage', startHp: LEVEL_GOAL.hp, hazards });
  // the boss's blows take the hp a battle's fail-on-death owns; health shows it on the HUD (a hit's cost named)
  if (goal.health || boss) out.push({ kind: 'fail-on-death', startHp: LEVEL_GOAL.hp, ...(goal.health ? { hits: LEVEL_GOAL.hit } : {}) });
  out.push(boss ? { kind: 'win-when', when: { var: 'won', gte: 1 }, event: 'battles:won' } : exit);
  return out;
}

/** What a level goal stands in a stage beside the pilot (stageLevelOrder's `goalCast`, its `extra`'s shape): the boss
 * at the end of the last stage (`ref`: its figure), the bag's menu on I (and its `legend`). Null when it stands nothing. */
export function levelGoalCast(goal, ends, { last = false, ref = null, look = null } = {}) {
  const bag = goal.collect ? bagPlay({ pickup: goal.collect === true ? 'gem' : goal.collect }) : null;
  const boss = goal.boss && last && ref;
  if (!bag && !boss) return null;
  const figures = {}, entities = [], play = { ...(bag ? bag.play : {}) };
  if (boss) {
    // (it stands on the floor: a building's exit is at its walker's eye, `bossAt` its floor)
    const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead'), at = ends.bossAt ?? ends.exit;
    standFoe(figures, entities, 'boss', ref, at, along.at(-1)?.at ?? ends.spawn, look);
    play.battle = { hero: { atk: BATTLE.atk, hp: 'hp' }, foes: [{ who: 'boss', at: [at[0], at[1]], name: 'The boss', hp: LEVEL_GOAL.boss.hp, atk: LEVEL_GOAL.boss.atk }] };
  }
  return { ...(boss ? { figures, entities } : {}), play, ...(bag ? { inputs: bag.inputs, legend: 'I  bag' } : {}) };
}

/** A shooter's posts: `foes` (4) on the trail's beats (lay-concerns.js beatPosts), each a foe's id. */
export function shootPosts(quick, ends) {
  return beatPosts(ends, quick.foes ?? 4).map((p, k) => ({ ...p, id: `foe-${k + 1}` }));
}

/** A shooter's supplies: half way between each post and the one before (the start for the first), a little off the
 * line; health and rounds by turns, rounds first. */
export function shootDrops(posts, ends) {
  return posts.map((p, k) => {
    const m = [(p.at[0] + p.back[0]) / 2 - p.from[1] * 2, (p.at[1] + p.back[1]) / 2 + p.from[0] * 2];
    const z = ends.ground ? ends.ground(m[0], m[1]) : null;
    return { at: [r3(m[0]), r3(m[1]), z ?? p.at[2]], gives: k % 2 ? 'health' : 'ammo', ...(k % 2 ? { amount: SHOOT.health } : { amount: SHOOT.rounds }) };
  });
}

/** A shooter's cast, on a stage: each foe at its post, armed, hunting by sight and taking cover (the walls are the
 * intent's: its `cover` concern stands them by these posts, lay-concerns.js). `ref`: their figure; `hero`: the player
 * has a body (its eye over its feet). → { figures, entities, posts, pilot } (stageLevelOrder's `extra`). */
export function shootCast(quick, ends, ref, { hero = false, camera } = {}) {
  // with a craft, a dogfight: the wing of fighters and the craft's cannon (skyscape/dogfight.js)
  if (ends.airMap) return dogfightCast(ends.airMap, ends.airField, ends.seat, { foes: quick.foes, waves: quick.waves });
  const posts = shootPosts(quick, ends), figures = {}, entities = [];
  posts.forEach((p, k) => {
    figures[p.id] = libraryFigure(refAt(ref, k));
    entities.push({
      id: p.id, team: 'foes',
      rule: { type: 'ai', mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh' }, sightRange: 30, sightCone: 1.1, memorySpan: 6, navCell: 0.5, cover: { radius: 7, hold: 2.5 }, standoff: 12, speed: 3, turn: 3, dodge: false, burst: 0.3, pause: 1.2, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 },
      weapon: { ...SHOOT.gun },
      body: { type: 'figure-rig', figure: p.id, hittable: true, hp: SHOOT.foeHp, poise: 2, radius: 0.6, egg: { ...PERSON, cz: PERSON.c } },
      transform: { pos: p.at, heading: p.heading },
    });
  });
  // the player, armed: hittable (a person's egg: over its feet, or under the eye it walks at), its eye's height known
  // (sight is eye to eye), the rifle at its eye; over the shoulder (shoulderOf) its rounds converge on the crosshair
  const over = shoulderOf(camera ?? quick.camera, hero);
  const pilot = {
    rule: { collideRadius: 0.3, collideHeight: 1.7 },
    weapon: { ...SHOOT.rifle, eye: hero ? 1.5 : 0, ...(over ? { converge: true } : {}) },
    body: { hittable: true, radius: 0.5, egg: { ...PERSON, cz: hero ? PERSON.c : PERSON.c - 1.7 } },
  };
  return { figures, entities, posts, pilot, ...(over ? { camera: over } : {}) };
}

// OVER THE SHOULDER: a shooter's third-person camera, close behind the hero and off its right shoulder, its crosshair's
// line crossing the body's own `lead` metres out; the player's rounds go from the muzzle to the point under the
// crosshair (weapon.converge), so what the crosshair is on is what is hit, a wall the gun cannot clear included
export const SHOULDER = Object.freeze({ dist: 2.8, height: 1.8, shoulder: 0.75, lookH: 1.55, lead: 10, lerp: 16, pitchFollow: 1 });
/** The over-the-shoulder camera for a shooter's hero played third-person (`camera`: the world's), else null. */
export const shoulderOf = (camera, hero) => (hero && camera === 'third-person' ? SHOULDER : null);

/** A deathmatch's legend: fire, and on the shooter pole its feet and its kit. */
export function deathmatchLegend(quick) {
  if (quick.pole === undefined) return 'click  fire';
  const P = shooterPole(quick.pole);
  return ['click  fire', quick.weapons ? '1-4  a gun picked up · R  the next' : null, P.move.jump ? `Space  jump${P.move.airJumps ? ' (twice)' : ''}` : null, P.move.dash ? 'F F  dash' : null, P.abilities.heal ? 'Q  heal' : null, P.abilities.ultimate ? 'X  ultimate' : null].filter(Boolean).join(' · ');
}

// the seconds each supply takes to come back (an arena's item timing)
export const ITEM_BACK = Object.freeze({ health: 20, ammo: 15, armor: 25, overdrive: 45, weapon: 30 });
/** A deathmatch's supplies, from its arena's (placed by risk, tunnel-arena.js): health and rounds always, armor on the
 * shooter pole, the overdrive where the pole has an ultimate (the stylized end), the guns the arena serves when it asks
 * for weapons; each comes back after its ITEM_BACK. → [{ at, gives, respawn, slot? }] */
export function deathmatchDrops(quick, ends) {
  const P = quick.pole !== undefined ? shooterPole(quick.pole) : null;
  const keep = (g) => g === 'health' || g === 'ammo' || (P && g === 'armor') || (P && g === 'overdrive' && !!P.abilities.ultimate) || (quick.weapons && g === 'weapon');
  return ends.arena.drops.filter((d) => keep(d.gives)).map((d) => ({ at: d.at, gives: d.gives, respawn: ITEM_BACK[d.gives], ...(d.slot ? { slot: d.slot } : {}) }));
}
/** A deathmatch's loadout with weapons (weapon-roles.js): the pole's rifle in hand, each gun its arena laid to be
 * picked up after it; every slot carries its band (a mind takes the gun for the range). `eye`: the guns' height;
 * `converge`: the rounds go to the crosshair's point (over the shoulder). */
export function deathmatchLoadout(quick, ends, eye, converge = false) {
  const laid = [...new Set(ends.arena.drops.filter((d) => d.gives === 'weapon').map((d) => d.slot))];
  return roleLoadout(quick.pole, laid).map((c) => ({ ...c, weapon: { ...c.weapon, eye, ...(converge ? { converge: true } : {}) } }));
}

/** A deathmatch's two sides (mode team or control), or null: the player and every other bot red, the rest blue. */
export function deathmatchSides(quick) {
  if (!quick.mode || quick.mode === 'free-for-all') return null;
  const all = ['player', ...deathmatchBots(quick)];
  return { red: all.filter((_, k) => k % 2 === 0), blue: all.filter((_, k) => k % 2 === 1) };
}
/** A control match's point: the clear floor nearest the arena's middle (a blocker may stand on the middle itself). */
export function deathmatchPoint(ends) {
  const A = ends.arena, boxes = askBoxes(A.blocks), [cx, cy] = A.centre;
  const clear = (x, y) => !boxes.some((B) => x > B.min[0] - 1 && x < B.max[0] + 1 && y > B.min[1] - 1 && y < B.max[1] + 1);
  for (let r = 0; r <= A.half; r += 1) for (let k = 0; k < Math.max(1, Math.round(r * 2 * Math.PI)); k++) {
    const a = (k / Math.max(1, Math.round(r * 2 * Math.PI))) * 2 * Math.PI, x = r3(cx + r * Math.cos(a)), y = r3(cy + r * Math.sin(a));
    if (clear(x, y)) return [x, y, A.z ?? 0];
  }
  return [cx, cy, A.z ?? 0];
}
/** A deathmatch's bots' ids (quick.bots of them). */
export const deathmatchBots = (quick) => Array.from({ length: quick.bots ?? DEATHMATCH.bots }, (_, k) => `bot-${k + 1}`);

/** A deathmatch's cast, on its arena (ends.arena): the player on the first spawn, each bot on the next, all facing the
 * centre; every gun held right-handed (`hand`: past an edge on its right a shooter fires with less of itself out); the
 * bots match players (mind.js `frag`: fight whom they see, hunt the noise, strafe, peek an edge) on the navmesh.
 * `ref`: their figure; `hero`: the player has a body. → { figures, entities, pilot } (stageLevelOrder's `extra`). */
export function deathmatchCast(quick, ends, ref, { hero = false, camera } = {}) {
  const A = ends.arena, bots = deathmatchBots(quick), figures = {}, entities = [];
  const face = (p) => r3(Math.atan2(A.centre[1] - p[1], A.centre[0] - p[0]));
  // on the shooter pole: every gun the pole's (the same for all), every body its hp, the bots' minds and the player's
  // feet the pole's (shooter-pole.js)
  const P = quick.pole !== undefined ? shooterPole(quick.pole) : null;
  // two sides: each body on its own base (the player first on red's), its side its team (allies pass through, minds
  // fight the other side and hold fire rather than shoot through a teammate); with control, the point their objective
  const S = deathmatchSides(quick), sideOf = (id) => (S ? (S.red.includes(id) ? 'red' : 'blue') : null);
  const spot = (id, k) => {
    if (!S) return A.spawns[k % A.spawns.length];
    const b = A.bases[sideOf(id) === 'red' ? 0 : 1], j = S[sideOf(id)].indexOf(id);
    return A.spawns[b[j % b.length]];
  };
  const teamRule = S ? { clearLine: true, ...(quick.mode === 'control' ? { objective: { at: deathmatchPoint(ends), radius: 2.5 } } : {}) } : {};
  bots.forEach((id, k) => {
    const at = spot(id, k + 1);
    figures[id] = libraryFigure(refAt(ref, k));
    entities.push({
      id, ...(S ? { team: sideOf(id) } : {}),
      rule: { ...teamRule, type: 'ai', mind: { motivation: 'frag', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh' }, peek: P ? P.mind.peek : true, sightRange: 40, sightCone: 1.2, memorySpan: 6, navCell: 0.5, standoff: 10, speed: P ? r3(P.move.speed * 0.75) : 3.4, turn: 3, dodge: P ? P.mind.dodge : false, ...(P ? { strafe: P.mind.strafe } : {}), ...(P?.mind.kit ? { kit: P.mind.kit } : {}), items: deathmatchDrops(quick, ends).map((d) => ({ at: d.at, gives: d.gives, back: d.respawn, ...(d.slot ? { slot: d.slot } : {}) })), ...(ends.arena.floors ? { floors: ends.arena.floors } : {}), ...(quick.weapons ? { loadout: deathmatchLoadout(quick, ends, 1.4), keepRange: true, perches: [...ends.arena.drops.filter((d) => d.slot === 'long').map((d) => d.at), ...(ends.arena.floors ?? []).map((f) => [r3((f.area[0] + f.area[2]) / 2), r3((f.area[1] + f.area[3]) / 2), f.z])] } : {}), burst: 0.3, pause: 1.2, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 },
      weapon: P ? { ...P.weapon, eye: 1.4 } : { ...SHOOT.gun, range: 40, hand: 'right' },
      body: { type: 'figure-rig', figure: id, hittable: true, hp: P ? P.hp : SHOOT.foeHp, poise: P ? 6 : 2, radius: 0.6, egg: { ...PERSON, cz: PERSON.c } },
      transform: { pos: at, heading: face(at) },
    });
  });
  const s0 = spot('player', 0);
  // the player's feet: the pole's pace; past its jump threshold the platform rule (a jump, an air jump, a dash)
  // (with weapons it is the platform rule too: the rule that carries a loadout; short of the pole's jump, a hop a step high)
  const feet = !P ? {} : P.move.jump ? { type: 'platform', speed: P.move.speed, jumpSpeed: 8.5, airJumps: P.move.airJumps, dodge: !!P.move.dash }
    : quick.weapons ? { type: 'platform', speed: P.move.speed, jumpSpeed: 3.2, airJumps: 0, dodge: !!P.move.dash } : { speed: P.move.speed };
  const over = shoulderOf(camera ?? quick.camera, hero), conv = over ? { converge: true } : {};
  const pilot = {
    ...(S ? { team: 'red' } : {}),
    rule: { collideRadius: 0.3, collideHeight: 1.7, ...feet, ...(quick.weapons ? { loadout: deathmatchLoadout(quick, ends, hero ? 1.5 : 0, !!over) } : {}) },
    weapon: P ? { ...P.weapon, eye: hero ? 1.5 : 0, ...conv } : { ...SHOOT.rifle, eye: hero ? 1.5 : 0, hand: 'right', ...conv },
    body: { hittable: true, radius: 0.5, egg: { ...PERSON, cz: hero ? PERSON.c : PERSON.c - 1.7 } },
    transform: { pos: [s0[0], s0[1], s0[2] + (hero ? 0 : 1.7)], heading: face(s0) },
  };
  return { figures, entities, pilot, ...(over ? { camera: over } : {}) };
}

/** A defence's cast and its building, on a stage: the foes asleep at the trail's end (as many as its waves send), a
 * tower asleep on each pad (beside the trail's beats, alternate sides), and a cue per pad that builds it for gold.
 * `refs`: { foe, tower } (their figures). → { figures, entities, play } (levels.js stageLevelOrder's `extra`). */
export function defendCast(quick, ends, refs) {
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  const foes = DEFEND.perWave.slice(0, quick.waves ?? 3).reduce((a, b) => a + b, 0);
  const fig = libraryFigure, body = PERSON_BODY;
  const figures = {}, entities = [], cues = [];
  const x = ends.exit, back = along.length ? along[along.length - 1].at : ends.spawn, face = Math.atan2(back[1] - x[1], back[0] - x[0]);
  for (let k = 1; k <= foes; k++) {
    figures[`foe-${k}`] = foeFigure(refAt(refs.foe, k - 1), quick.foe);
    entities.push({ id: `foe-${k}`, dormant: true, team: 'wave', rule: { type: 'static', speed: 2.2, ...body }, body: { type: 'figure-rig', figure: `foe-${k}`, hittable: true, hp: DEFEND.hp, poise: 2, radius: 0.6 }, transform: { pos: [x[0], x[1], x[2]], heading: r3(face) } });
  }
  // the pads beside the road, on land level with it (the intent's road-to-base concern, lay-concerns.js padSites)
  const posts = beatPosts(ends, quick.pads ?? 4), pads = padSites(posts, ends);
  posts.forEach((p, k) => {
    const h = Math.atan2(p.from[1], p.from[0]), at = pads[k], id = `tower-${k + 1}`;
    figures[id] = fig(refAt(refs.tower, k));
    entities.push({
      id, dormant: true, team: 'defense',
      rule: { type: 'ai', mind: { motivation: 'sentry' }, foes: 'wave', range: 13, turnRate: 5, dodge: false, ...body },
      weapon: { fireClass: 'area', auto: false, cooldown: 0.7, damage: 1, range: 13, coreAngle: 4, assistAngle: 12, eye: 1.4 },
      body: { type: 'figure-rig', figure: id },
      transform: { pos: at, heading: r3(h + Math.PI) },
    });
    cues.push({
      id: `build-${k + 1}`, once: true,
      when: { use: { at, r: 2.2 }, prompt: `build a tower (${DEFEND.cost} gold)` },
      if: { var: 'gold', gte: DEFEND.cost },
      then: [{ add: 'gold', by: -DEFEND.cost }, { spawn: id }, { say: 'a tower stands', as: 'toast' }],
      else: { say: `a tower costs ${DEFEND.cost} gold`, as: 'toast' },
    });
  });
  return { figures, entities, pads, play: { cues } };
}

/** A collect's bag: what it picks up as an item, the inventory menu over the bag, opened on I (stageLevelOrder's
 * `extra`: its play and its key). */
export function bagPlay(quick) {
  const item = quick.pickup ?? 'gem';
  return {
    play: { items: { [item]: {} }, menus: [{ id: 'bag', kind: 'inventory', title: 'Bag' }], cues: [{ id: 'open-bag', when: { on: 'bag' }, then: { open: 'bag' } }] },
    inputs: [{ on: 'key', key: 'i', emit: { type: 'bag' } }],
  };
}

/**
 * A level's audio (null: none). A rhythm game's music, its beat said on the bus. Any other goal with `music`: a field
 * score under the level, every level sharing the game's identity (`game`, a seed); 'auto' asks score-suggest for the
 * mood the level's place (`manifest`) and play (the goal, `final`) call for, quiet when its place calls for none.
 * `sfx`: the level's action sounds (beats-world resolves 'auto' against the level's own mechanics).
 */
export function goalAudio(quick, { manifest = {}, final = false, game } = {}) {
  const sfx = quick.sfx === undefined ? null : quick.sfx === 'auto' ? 'auto' : { auto: quick.sfx };
  const withSfx = (a) => (sfx ? { ...(a || {}), sfx } : a);
  if (quick.goal === 'rhythm') return withSfx({ soundtrack: `field:${quick.music ?? 'wayfarer'}`, beat: true });
  if (quick.music === undefined) return withSfx(null);
  const s = quick.music === 'auto' ? suggestScore(levelScoreContext(manifest, { goal: quick.goal, final })) : null;
  const mood = quick.music === 'auto' ? s?.mood : quick.music;
  const club = s?.style === 'club' || Object.prototype.hasOwnProperty.call(CLUB_MOODS, mood ?? '');
  const score = (m) => ({ score: { mood: m, ...(club ? { style: 'club' } : {}), ...(Number.isInteger(game) ? { game } : {}) } });
  // auto on a fight: the scene's own music, the fight's coming in with the tension (adaptive-music.js)
  return withSfx(mood ? { soundtrack: score(s?.explore ?? mood), ...(s?.explore ? { combat: score(mood) } : {}) } : null);
}

/** The store the goal needs (create_game's `store`): a campaign always; a bag to collect into; the hero's hp to lose. */
export function quickStore(quick) {
  return {
    slices: [
      ...(quick.goal === 'avoid' || quick.goal === 'battle' || quick.goal === 'shoot' ? [{ name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }] : []),
      ...(quick.goal === 'collect' ? [{ name: 'bag', kind: 'inventory' }] : []),
      { name: 'campaign', kind: 'progression' },
    ],
  };
}
