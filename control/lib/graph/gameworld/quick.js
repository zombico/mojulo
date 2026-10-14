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
 *                                           // age?, brief?, facets?, seed?, parts? }; balanced, each on its own physics
 *     guards?: n,                           // sneak: how many guards keep the trail (1 to 8, 3), on its beats
 *     guard?: <a hero-door spec>,           // sneak: what a guard looks like (a plain one by default)
 *     alarms?: n,                           // sneak: how many sightings end it (1: the first)
 *     music?: '<mood>' | 'auto',            // rhythm: the field score whose beat it runs to (wayfarer). Any other goal:
 *                                           // a field score under each level, one identity across the game ('auto':
 *                                           // the mood each level's place and play call for, beats/score-suggest.js)
 *     sfx?: 'auto' | '<palette>',           // action sounds wired to the goal's events, in the music's key ('auto': the
 *                                           // palette the score implies; arcade, foley, orchestral, synth; beats/sfx-palettes.js)
 *     misses?: n,                           // rhythm: how many presses off the beat end it (none: no limit)
 *     waves?: n, lives?: n, pads?: n,       // defend: how many waves (3), lives (5), tower pads by the trail (4)
 *     foe?, tower?: <a hero-door spec>      // defend: what a foe and a tower's archer look like (plain ones by default)
 *     boulders?: n,                         // puzzle: how many boulders to push onto their plates (2, at most 4)
 *     craft?: 'glider' | 'trainer' | 'jet', // fly: the aircraft (skyscape/eye.js CRAFT); the map and the course are its
 *     assist?: 'arcade' | 'sim',            // fly: never stalls, wings level quickly | the bank holds (absent: between)
 *     airspace?: { map?, ground?, course? }, // fly: the flight map (an island by default), as an airspace level takes it
 *     plots?: n, target?: n, days?: n,     // farm: plots (6), the gold to make (40), by which day (6)
 *     folk?: n, farmhand?: <a hero-door spec> // farm: farmhands keeping their day (2), and their looks
 *     foes?: n,                             // battle: how many foes stand on the trail to be fought turn by turn (3)
 *     theme?: { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? },   // the game shell's skin (create_game)
 *     camera?: 'third-person' | 'first-person' | 'top-down' | 'side' | 'fixed',   // written to the world's own `camera` (cameras.js)
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
import { STAGE_KITS } from '../era/stage.js';
import { COURSE_PRESETS } from '../roads/course.js';
import { composeTrack } from '../roads/trackscape-compose.js';
import { VEHICLES, TUNINGS, CONDITIONS, vehicleRule } from '../roads/vehicles.js';
import { CAMERAS } from './cameras.js';
import { RIDES, RIDE_H } from './ride.js';
import { playerStates } from '../playscape/player.js';
import { mulberry32 } from '../vegetation/grow.js';
import { beatPosts, padSites } from './lay-concerns.js';
import { racerSpec, solveRoster, racerRule } from '../car-designer/roster.js';
import { SCORE_MOODS } from '../beats/field-score.js';
import { CLUB_MOODS } from '../beats/club-score.js';
import { suggestScore, levelScoreContext } from '../beats/score-suggest.js';
import { SFX_PALETTE_NAMES } from '../beats/sfx-palettes.js';
import { CRAFT } from '../skyscape/eye.js';
import { flightLaps } from '../skyscape/course.js';

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
  shoot: 'armed foes hold the trail behind low walls, hunting you by sight and ducking into cover when hurt or reloading; shoot them all (click), with hp to spare: health and rounds lie along the way',
  fly: 'fly the ring gates in order and land; best time kept',
});
// a shooter's numbers: the player's hp and what a hit takes, its rifle and spare rounds, the foes' guns and hp, the
// supplies (health given, rounds given)
export const SHOOT = Object.freeze({
  hp: 100, hit: 8, health: 30, rounds: 24, foeHp: 4,
  rifle: { fireClass: 'sight', auto: false, cooldown: 0.3, magazine: 12, reserve: 36, reload: 1.5, damage: 1, impact: 1, range: 60, coreAngle: 1.5 },
  gun: { fireClass: 'sight', auto: false, cooldown: 0.7, magazine: 6, reload: 2.2, damage: 1, range: 28, coreAngle: 1.5, eye: 1.4 },
});
// a person's hit volume (an egg: `a` its half-width, `c` its half-height), stood on its feet
const PERSON = Object.freeze({ a: 0.35, c: 0.9 });
export const QUICK_GUNNER = Object.freeze({ cast: 'male', palette: { Top: '#4a5530' }, gear: { right: { item: 'bow' } } });
// a battle's numbers: the hero's hp and blow, each foe's (the later ones tougher)
// a race's numbers: the trail a loop is laid on (its run, seconds: the longest; its beats, none that cuts the land or
// stands a stone on it: no pit, no stream, no landmark), laps round it, metres between its checkpoints, the grid (the first row's distance behind the
// line, each row's after it, the cars' distance off the middle), the rivals' lane off the line and their pace (the
// pole's, the last's), and their lane off a roadway's racing line (narrower: that line already runs near the edges),
// and a car's body on a roadway (its radius: the barriers stop it; the ride's own rule carries none)
export const RACE = Object.freeze({ run: 25, beats: ['reveal', 'pocket', 'rest', 'reveal', 'pocket'], laps: 3, leg: 20, gridFront: 4, gridRow: 6, gridSide: 2, lane: 1.2, pace: [0.86, 0.72], roadLane: 0.8, body: 0.9 });
export const BATTLE = Object.freeze({ hp: 20, atk: 2, foeHp: [4, 6, 8, 10, 12, 14], foeAtk: [1, 2, 2, 3, 3, 4] });
export const QUICK_FARMHAND = Object.freeze({ cast: 'male', palette: { Top: '#8a6a3a' } });
// a farm's numbers: seed and sale, the purse it starts with, how fast its day runs (game minutes a second)
export const FARM = Object.freeze({ cost: 2, price: 6, gold: 6, rate: 4, start: 6 });
export const QUICK_FOE = Object.freeze({ cast: 'male', palette: { Top: '#6b2222' }, gear: { right: { item: 'dagger' } } });
export const QUICK_TOWER = Object.freeze({ cast: 'female', palette: { Top: '#2e5c3a' }, gear: { right: { item: 'bow' } } });
// a defence's numbers: what a tower costs, the purse it starts with, what a felled foe pays, foes in a wave
export const DEFEND = Object.freeze({ cost: 5, gold: 10, bounty: 2, perWave: [3, 5, 7, 9, 11, 13], hp: 3 });
// the field scores a rhythm game runs to (each a steady tempo, beats-world's audio.beat)
export const RHYTHM_MOODS = Object.freeze(['wayfarer', 'expedition', 'tavern', 'village', 'plains', 'forest', 'highlands', 'desert']);
// a guard when the game names none: plain, armed
export const QUICK_GUARD = Object.freeze({ cast: 'male', palette: { Top: '#3a4660' }, gear: { right: { item: 'sword' } } });
const KEYS = ['goal', 'craft', 'assist', 'airspace', 'hero', 'ride', 'racers', 'vehicle', 'tuning', 'conditions', 'track', 'roadway', 'laps', 'rivals', 'climb', 'building', 'pickup', 'seconds', 'theme', 'camera', 'guards', 'guard', 'alarms', 'music', 'sfx', 'misses', 'waves', 'lives', 'pads', 'foe', 'tower', 'boulders', 'plots', 'target', 'days', 'folk', 'farmhand', 'run', 'foes'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: quick${m}`);

/** Read the quick block and say what is wrong. */
export function readQuick(Q) {
  if (!isObj(Q)) throw fail(` is { goal: ${Object.keys(QUICK_GOALS).join(' | ')}, hero?, climb?, pickup?, seconds?, theme? }`);
  for (const k of Object.keys(Q)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a quick game (${KEYS.join(', ')})`);
  if (!QUICK_GOALS[Q.goal]) throw fail(`.goal is one of ${Object.entries(QUICK_GOALS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (Q.hero !== undefined && Q.hero !== false && !isObj(Q.hero)) throw fail('.hero is a hero-door spec (get_solid_vocab({ id: \'layered\' })), { ref } for a hero made with create_character, or false for first person');
  if (isObj(Q.hero) && Q.hero.ref !== undefined && (Object.keys(Q.hero).length !== 1 || !(typeof Q.hero.ref === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(Q.hero.ref)))) throw fail('.hero { ref } adopts a hero made with create_character, by its sketch ref alone (its words are its own row\'s)');
  if (Q.climb !== undefined && typeof Q.climb !== 'boolean') throw fail('.climb is true or false');
  if (Q.ride !== undefined) {
    if (!RIDES[Q.ride]) throw fail(`.ride is one of ${Object.entries(RIDES).map(([k, v]) => `${k} (${v.words})`).join('; ')}`);
    if (Q.hero) throw fail('.ride and .hero: the ride is the hero (one or the other)');
    if (Q.climb || Q.building !== undefined) throw fail('.ride drives a trail: no climb, no building');
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.ride is followed from behind (camera third-person)');
  }
  if (Q.racers !== undefined) {
    if (Q.goal !== 'race') throw fail('.racers belongs to the race goal');
    if (Q.ride !== undefined || Q.hero) throw fail('.racers and a ride or hero: your racer is the first of the field');
    if (Q.rivals !== undefined) throw fail('.racers is the whole field (yours first): no rivals beside it');
    if (Q.vehicle !== undefined) throw fail('.vehicle: a racer drives the machine it was built, its physics its own');
    if (Q.climb || Q.building !== undefined || Q.run !== undefined) throw fail('.racers race a lap or a roadway: no climb, building or run');
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.racers are followed from behind (camera third-person)');
    const list = Number.isInteger(Q.racers) ? null : Q.racers;
    if (list === null ? !(Q.racers >= 2 && Q.racers <= 8) : !(Array.isArray(list) && list.length >= 2 && list.length <= 8)) throw fail('.racers is how many racers (2 to 8), or a list of them: each an archetype, a brief in words, or { archetype?, build?, age?, brief?, facets?, seed?, parts? }');
    if (list) list.forEach((r, k) => { try { racerSpec(r, k); } catch (e) { throw fail(`.racers[${k}]: ${e.message.replace(/^car-designer: /, '')}`); } });
  }
  for (const k of ['vehicle', 'tuning', 'conditions']) if (Q[k] !== undefined && !Q.ride && !(Q.racers !== undefined && k !== 'vehicle')) throw fail(`.${k} is how the ride drives: name a ride`);
  if (Q.vehicle !== undefined && !VEHICLES[Q.vehicle]) throw fail(`.vehicle is one of ${Object.entries(VEHICLES).map(([k, v]) => `${k} (${v.words})`).join('; ')}`);
  if (Q.tuning !== undefined && !TUNINGS.includes(Q.tuning)) throw fail(`.tuning is ${TUNINGS.join(' or ')}`);
  if (Q.conditions !== undefined && !(Q.conditions in CONDITIONS)) throw fail(`.conditions is one of ${Object.keys(CONDITIONS).join(', ')}`);
  if (Q.pickup !== undefined && !(typeof Q.pickup === 'string' && /^[a-z][a-z-]{0,23}$/.test(Q.pickup))) throw fail('.pickup is one lower-case word (coin, key, star, gem, shell…)');
  if (Q.seconds !== undefined && !(Number.isInteger(Q.seconds) && Q.seconds >= 5 && Q.seconds <= 600)) throw fail('.seconds is a whole number of seconds, 5 to 600');
  if (Q.theme !== undefined && !isObj(Q.theme)) throw fail('.theme is the game shell\'s skin { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? }');
  if (Q.camera !== undefined && !CAMERAS[Q.camera]) throw fail(`.camera is one of ${Object.entries(CAMERAS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (Q.building !== undefined && !isObj(Q.building)) throw fail('.building is a building level { use, seed?, goal?, … } (card game-building)');
  if (Q.building !== undefined && Q.climb) throw fail('.climb and .building: a building is its own level, not a climb after a trail');
  if (Q.building !== undefined && Q.goal === 'avoid') throw fail('.building has no hazards to avoid (reach, collect or survive)');
  if (Q.goal !== 'collect' && Q.pickup !== undefined) throw fail('.pickup belongs to the collect goal');
  if (Q.goal !== 'survive' && Q.seconds !== undefined) throw fail('.seconds belongs to the survive goal');
  for (const k of ['track', 'rivals']) if (Q.goal !== 'race' && Q[k] !== undefined) throw fail(`.${k} belongs to the race goal`);
  if (Q.laps !== undefined && Q.goal !== 'race' && Q.goal !== 'fly') throw fail('.laps belongs to the race and fly goals');
  for (const k of ['craft', 'assist', 'airspace']) if (Q.goal !== 'fly' && Q[k] !== undefined) throw fail(`.${k} belongs to the fly goal`);
  if (Q.goal === 'fly') {
    if (Q.craft !== undefined && !CRAFT[Q.craft]) throw fail(`.craft is one of ${Object.entries(CRAFT).map(([k, v]) => `${k} (${v.label})`).join('; ')}`);
    if (Q.airspace !== undefined && !(isObj(Q.airspace) && Object.keys(Q.airspace).every((k) => ['map', 'ground', 'course'].includes(k)))) throw fail('.airspace is { map?, ground?, course? }: the flight map as an airspace level takes it');
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
  for (const k of ['waves', 'lives', 'pads', 'tower']) if (Q.goal !== 'defend' && Q[k] !== undefined) throw fail(`.${k} belongs to the defend goal`);
  if (Q.foe !== undefined && Q.goal !== 'defend' && Q.goal !== 'battle' && Q.goal !== 'shoot') throw fail('.foe belongs to the defend, battle and shoot goals');
  if (Q.waves !== undefined && !(Number.isInteger(Q.waves) && Q.waves >= 1 && Q.waves <= DEFEND.perWave.length)) throw fail(`.waves is 1 to ${DEFEND.perWave.length}`);
  if (Q.lives !== undefined && !(Number.isInteger(Q.lives) && Q.lives >= 1 && Q.lives <= 20)) throw fail('.lives is 1 to 20');
  if (Q.pads !== undefined && !(Number.isInteger(Q.pads) && Q.pads >= 1 && Q.pads <= 8)) throw fail('.pads is 1 to 8');
  for (const k of ['foe', 'tower']) if (Q[k] !== undefined && !isObj(Q[k])) throw fail(`.${k} is a hero-door spec, as .hero is`);
  if (Q.goal === 'defend' && (Q.building !== undefined || Q.climb)) throw fail('.defend holds a trail: no climb, no building');
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
  if (Q.goal === 'shoot' && Q.camera !== undefined && Q.camera !== 'first-person' && Q.camera !== 'third-person') throw fail('.shoot aims from the eye or over the shoulder: camera first-person or third-person');
  if (Q.goal === 'battle' && Q.building !== undefined) throw fail('.battle stands its foes on a trail: no building');
  if (Q.run !== undefined && (Q.building !== undefined || Q.climb)) throw fail('.run draws trails: no climb, no building');
  return Q;
}

/** A quick game's gameworld: the creator's own settings (id, name, seed, style …) kept, one level written. */
export function quickWorld({ quick: given, id, name, seed, style, ...rest } = {}) {
  readQuick(given);
  // the camera is the world's setting, not the goal's: it moves up to the world, where both run paths read it
  const { camera: named, ...quick } = given;
  // a shooter aims: without a camera named, from the eye
  const camera = named ?? (quick.goal === 'shoot' ? 'first-person' : undefined);
  if (typeof id !== 'string') throw fail(': the world needs an id (a short lower-case name)');
  const kit = style?.kit ?? 'trail-valley';
  if (!STAGE_KITS[kit]?.shell) throw fail(`: style.kit '${kit}' is not an outdoor stage kit (${Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].shell).join(', ')})`);
  // a loop is laid on the trail's land: the longest trail, so a lap is a stretch worth driving
  const loop = quick.goal === 'race' && (quick.track === 'loop' || ((quick.rivals || quick.racers) && quick.track !== 'trail'));
  const nodes = { path: { trail: loop ? { run: RACE.run, beats: RACE.beats } : {} }, ...(quick.climb ? { top: { meru: {} } } : {}) };
  // a run's pool: trails each laid from its own seed, two more than a run draws
  const s0 = Number.isInteger(seed) ? seed : 1;
  // a race on a roadway: the level is the roadway itself (a lap, or a stage when its course runs end to end), dressed
  // (in words, `{ intent }`: trackscape's door, roads/trackscape-compose.js — the course designed, drawn in the words'
  // look and dressed where a driver looks)
  const worded = isObj(quick.roadway) && typeof quick.roadway.intent === 'string' ? composeTrack(quick.roadway.intent, { seed: s0 }) : null;
  // a flight: the level is an airspace (skyscape/), its map flown by the craft, its course its laps
  const flight = quick.goal === 'fly' ? { run: { name: name ?? id, airspace: { ...(quick.airspace ?? {}), map: { ...(quick.airspace?.map ?? {}), craft: quick.craft ?? 'trainer' }, ...(quick.assist ? { assist: quick.assist } : {}), ...(quick.laps ? { course: { ...(isObj(quick.airspace?.course) ? quick.airspace.course : {}), laps: quick.laps } } : {}) } } } : null;
  const levels = flight ?? (worded ? { run: { name: name ?? id, roadway: { form: worded.form, course: worded.course, kit: worded.kit, scape: worded.scape } } }
    : quick.roadway ? { run: { name: name ?? id, roadway: { course: quick.roadway, dress: true } } } : quick.run
    ? Object.fromEntries(Array.from({ length: quick.run + 2 }, (_, k) => [`stretch-${k + 1}`, { name: `${name ?? id} ${k + 1}`, seed: s0 + 101 * (k + 1), walk: { nodes: { path: { trail: {} } } } }]))
    : { run: quick.building ? { name: name ?? id, building: quick.building } : { name: name ?? id, walk: { nodes, ...(quick.climb ? { edges: [{ from: 'path', to: 'top' }] } : {}) } } });
  return {
    id, name: name ?? id, ...(seed !== undefined ? { seed } : {}), mode: 'autonomous', ...rest, ...(camera ? { camera } : {}),
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
      // every foe down; each hit on you costs hp; the supplies between the posts
      const posts = shootPosts(quick, ends), drops = shootDrops(posts, ends);
      return [
        { kind: 'fail-on-death', startHp: SHOOT.hp, hits: SHOOT.hit },
        ...(drops.length ? [{ kind: 'supplies', max: SHOOT.hp, drops }] : []),
        { kind: 'defeat-all', who: 'foe-*', count: posts.length, label: 'Down' },
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
export const raceRivals = (quick) => Array.from({ length: quick.racers !== undefined ? (Array.isArray(quick.racers) ? quick.racers.length : quick.racers) - 1 : quick.rivals ?? 0 }, (_, k) => `rival-${k + 1}`);

/** A field of racers (quick.racers): the roster solved and balanced (car-designer/roster.js), each racer's recipe (what
 * its figure resolves through) and the drive rule its own machine plays by, at the race's tuning (arcade unless named)
 * and conditions. → { field: [{ spec, archetype, rule }], balance, changes } */
export function quickRacers(quick, seed = 1) {
  const { racers, balance, changes } = solveRoster(quick.racers, { seed });
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
    figures[id] = mine ? { racer: mine.spec } : { vehicleRef: ride.ref, targetH: RIDE_H };
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
    figures[id] = mine ? { racer: mine.spec } : { vehicleRef: ride.ref, targetH: RIDE_H };
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
export function farmCast(quick, ends, ref) {
  const n = quick.folk ?? 2, plots = farmPlots(quick, ends), s = ends.spawn;
  const field = plots.reduce((a, p) => [a[0] + p[0] / plots.length, a[1] + p[1] / plots.length], [0, 0]);
  const figures = {}, entities = [], routines = [];
  for (let k = 1; k <= n; k++) {
    const id = `farmhand-${k}`;
    figures[id] = { heroRef: ref, library: 'quaternius-ual', clips: { ...playerStates([], 'quaternius-ual'), forward: 'Walk_Loop' } };
    entities.push({ id, rule: { type: 'static', speed: 1.6, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 }, body: { type: 'figure-rig', figure: id }, transform: { pos: [r3(s[0] + 2 * k), r3(s[1] - 2), s[2]], heading: 0 } });
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
    figures[id] = { heroRef: ref, library: 'quaternius-ual', clips: { ...playerStates([], 'quaternius-ual'), forward: 'Walk_Loop' } };
    entities.push({ id, rule: { type: 'static', eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 }, body: { type: 'figure-rig', figure: id }, transform: { pos: b.at, heading: r3(Math.atan2(back[1] - b.at[1], back[0] - b.at[0])) } });
    foes.push({ who: id, at: [b.at[0], b.at[1]], name: `Foe ${k + 1}`, hp: BATTLE.foeHp[k], atk: BATTLE.foeAtk[k] });
  });
  return { figures, entities, play: { battle: { hero: { atk: BATTLE.atk, hp: 'hp' }, foes } } };
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
export function shootCast(quick, ends, ref, { hero = false } = {}) {
  const posts = shootPosts(quick, ends), figures = {}, entities = [];
  posts.forEach((p) => {
    figures[p.id] = { heroRef: ref, library: 'quaternius-ual', clips: { ...playerStates([], 'quaternius-ual'), forward: 'Walk_Loop' } };
    entities.push({
      id: p.id, team: 'foes',
      rule: { type: 'ai', mind: { motivation: 'hunt', aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh' }, sightRange: 30, sightCone: 1.1, memorySpan: 6, navCell: 0.5, cover: { radius: 7, hold: 2.5 }, standoff: 12, speed: 3, turn: 3, dodge: false, burst: 0.3, pause: 1.2, eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 },
      weapon: { ...SHOOT.gun },
      body: { type: 'figure-rig', figure: p.id, hittable: true, hp: SHOOT.foeHp, poise: 2, radius: 0.6, egg: { ...PERSON, cz: PERSON.c } },
      transform: { pos: p.at, heading: p.heading },
    });
  });
  // the player, armed: hittable (a person's egg: over its feet, or under the eye it walks at), its eye's height known
  // (sight is eye to eye), the rifle at its eye
  const pilot = {
    rule: { collideRadius: 0.3, collideHeight: 1.7 },
    weapon: { ...SHOOT.rifle, eye: hero ? 1.5 : 0 },
    body: { hittable: true, radius: 0.5, egg: { ...PERSON, cz: hero ? PERSON.c : PERSON.c - 1.7 } },
  };
  return { figures, entities, posts, pilot };
}

/** A defence's cast and its building, on a stage: the foes asleep at the trail's end (as many as its waves send), a
 * tower asleep on each pad (beside the trail's beats, alternate sides), and a cue per pad that builds it for gold.
 * `refs`: { foe, tower } (their figures). → { figures, entities, play } (levels.js stageLevelOrder's `extra`). */
export function defendCast(quick, ends, refs) {
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  const foes = DEFEND.perWave.slice(0, quick.waves ?? 3).reduce((a, b) => a + b, 0);
  const fig = (ref) => ({ heroRef: ref, library: 'quaternius-ual', clips: { ...playerStates([], 'quaternius-ual'), forward: 'Walk_Loop' } });
  const body = { eye: 0, stride: 1.6, collideRadius: 0.3, collideHeight: 1.7, step: 0.3 };
  const figures = {}, entities = [], cues = [];
  const x = ends.exit, back = along.length ? along[along.length - 1].at : ends.spawn, face = Math.atan2(back[1] - x[1], back[0] - x[0]);
  for (let k = 1; k <= foes; k++) {
    figures[`foe-${k}`] = fig(refs.foe);
    entities.push({ id: `foe-${k}`, dormant: true, team: 'wave', rule: { type: 'static', speed: 2.2, ...body }, body: { type: 'figure-rig', figure: `foe-${k}`, hittable: true, hp: DEFEND.hp, poise: 2, radius: 0.6 }, transform: { pos: [x[0], x[1], x[2]], heading: r3(face) } });
  }
  // the pads beside the road, on land level with it (the intent's road-to-base concern, lay-concerns.js padSites)
  const posts = beatPosts(ends, quick.pads ?? 4), pads = padSites(posts, ends);
  posts.forEach((p, k) => {
    const h = Math.atan2(p.from[1], p.from[0]), at = pads[k], id = `tower-${k + 1}`;
    figures[id] = fig(refs.tower);
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
