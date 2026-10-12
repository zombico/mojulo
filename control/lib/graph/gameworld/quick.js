/**
 * THE QUICK PATH — a game whose LOOP is simple: one level and one goal, no hero book, no stats, no progression. Its
 * graphics are not simple: the ground is the world's (a kit, a look in words, the land), the hero is any hero the hero
 * door draws (every word of it, gear and paint included) or none at all (first person), and the goal is dressed by the
 * game's own decoration (glyph forms chosen by the pickup's word, sparkles, the exit's marker) and the shell's theme.
 *
 *   gameworld.quick: {
 *     goal: 'reach' | 'collect' | 'survive' | 'avoid' | 'race' | 'sneak' | 'rhythm' | 'defend' | 'puzzle' | 'farm',
 *     hero?: <a hero-door spec> | false,    // false or absent: first person, you are the camera
 *     ride?: 'car' | 'coupe' | 'van',        // the hero is a vehicle (ride.js): driven, its feel derived from its build
 *     climb?: true,                         // a climb after the trail, the exit at its top
 *     building?: { use, seed?, goal?, … },  // the level is a building in place of the trail (gameworld building levels):
 *                                           // entered at its way in, its goal room the end, pickups in its other rooms
 *     pickup?: '<word>',                    // collect: what lies along the way (its word picks the glyph: coin, key, star…)
 *     seconds?: n,                          // survive: how long
 *     guards?: n,                           // sneak: how many guards keep the trail (1 to 8, 3), on its beats
 *     guard?: <a hero-door spec>,           // sneak: what a guard looks like (a plain one by default)
 *     alarms?: n,                           // sneak: how many sightings end it (1: the first)
 *     music?: '<mood>',                     // rhythm: the field score whose beat it runs to (wayfarer)
 *     misses?: n,                           // rhythm: how many presses off the beat end it (none: no limit)
 *     waves?: n, lives?: n, pads?: n,       // defend: how many waves (3), lives (5), tower pads by the trail (4)
 *     foe?, tower?: <a hero-door spec>      // defend: what a foe and a tower's archer look like (plain ones by default)
 *     boulders?: n,                         // puzzle: how many boulders to push onto their plates (2, at most 4)
 *     plots?: n, target?: n, days?: n,     // farm: plots (6), the gold to make (40), by which day (6)
 *     folk?: n, farmhand?: <a hero-door spec> // farm: farmhands keeping their day (2), and their looks
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
import { CAMERAS } from './cameras.js';
import { RIDES } from './ride.js';
import { playerStates } from '../playscape/player.js';
import { mulberry32 } from '../vegetation/grow.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export const QUICK_GOALS = Object.freeze({
  reach: 'reach the stage\'s end: a trail\'s exit, or a climb\'s top',
  collect: 'collect what lies along the way (on the trail\'s beats), and reach the end',
  survive: 'stay on the stage until the clock runs out',
  avoid: 'reach the end past its hazards (the water a trail crosses), with hp to spare',
  race: 'run the trail\'s checkpoints in order (its beats) to the finish (its end), against the clock; the best time is kept',
  sneak: 'reach the end past guards who keep the trail, sweeping their gaze: seen, and it is over',
  rhythm: 'run the trail to the music: jump on its beat for points (off the beat is a miss); the best score is kept',
  defend: 'foes walk the trail in waves to your base (its start); build archers\' towers on the pads beside it (E, for gold) and hold',
  puzzle: 'push the boulders on a grid by the trail\'s start onto their plates (walk into one to push it a cell)',
  farm: 'plant the plots by the start (E), let the days ripen them, harvest and sell: make the gold before the day runs out',
});
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
const KEYS = ['goal', 'hero', 'ride', 'climb', 'building', 'pickup', 'seconds', 'theme', 'camera', 'guards', 'guard', 'alarms', 'music', 'misses', 'waves', 'lives', 'pads', 'foe', 'tower', 'boulders', 'plots', 'target', 'days', 'folk', 'farmhand', 'run'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => new Error(`gameworld: quick${m}`);

/** Read the quick block and say what is wrong. */
export function readQuick(Q) {
  if (!isObj(Q)) throw fail(` is { goal: ${Object.keys(QUICK_GOALS).join(' | ')}, hero?, climb?, pickup?, seconds?, theme? }`);
  for (const k of Object.keys(Q)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a quick game (${KEYS.join(', ')})`);
  if (!QUICK_GOALS[Q.goal]) throw fail(`.goal is one of ${Object.entries(QUICK_GOALS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (Q.hero !== undefined && Q.hero !== false && !isObj(Q.hero)) throw fail('.hero is a hero-door spec (get_solid_vocab({ id: \'layered\' })), or false for first person');
  if (Q.climb !== undefined && typeof Q.climb !== 'boolean') throw fail('.climb is true or false');
  if (Q.ride !== undefined) {
    if (!RIDES[Q.ride]) throw fail(`.ride is one of ${Object.entries(RIDES).map(([k, v]) => `${k} (${v.words})`).join('; ')}`);
    if (Q.hero) throw fail('.ride and .hero: the ride is the hero (one or the other)');
    if (Q.climb || Q.building !== undefined) throw fail('.ride drives a trail: no climb, no building');
    if (Q.camera !== undefined && Q.camera !== 'third-person') throw fail('.ride is followed from behind (camera third-person)');
  }
  if (Q.pickup !== undefined && !(typeof Q.pickup === 'string' && /^[a-z][a-z-]{0,23}$/.test(Q.pickup))) throw fail('.pickup is one lower-case word (coin, key, star, gem, shell…)');
  if (Q.seconds !== undefined && !(Number.isInteger(Q.seconds) && Q.seconds >= 5 && Q.seconds <= 600)) throw fail('.seconds is a whole number of seconds, 5 to 600');
  if (Q.theme !== undefined && !isObj(Q.theme)) throw fail('.theme is the game shell\'s skin { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? }');
  if (Q.camera !== undefined && !CAMERAS[Q.camera]) throw fail(`.camera is one of ${Object.entries(CAMERAS).map(([k, v]) => `${k} (${v})`).join('; ')}`);
  if (Q.building !== undefined && !isObj(Q.building)) throw fail('.building is a building level { use, seed?, goal?, … } (card game-building)');
  if (Q.building !== undefined && Q.climb) throw fail('.climb and .building: a building is its own level, not a climb after a trail');
  if (Q.building !== undefined && Q.goal === 'avoid') throw fail('.building has no hazards to avoid (reach, collect or survive)');
  if (Q.goal !== 'collect' && Q.pickup !== undefined) throw fail('.pickup belongs to the collect goal');
  if (Q.goal !== 'survive' && Q.seconds !== undefined) throw fail('.seconds belongs to the survive goal');
  for (const k of ['guards', 'guard', 'alarms']) if (Q.goal !== 'sneak' && Q[k] !== undefined) throw fail(`.${k} belongs to the sneak goal`);
  if (Q.guards !== undefined && !(Number.isInteger(Q.guards) && Q.guards >= 1 && Q.guards <= 8)) throw fail('.guards is how many guards keep the trail, 1 to 8');
  if (Q.alarms !== undefined && !(Number.isInteger(Q.alarms) && Q.alarms >= 1 && Q.alarms <= 9)) throw fail('.alarms is how many sightings end the run, 1 to 9');
  if (Q.guard !== undefined && !isObj(Q.guard)) throw fail('.guard is a hero-door spec, as .hero is');
  if (Q.building !== undefined && (Q.goal === 'race' || Q.goal === 'sneak' || Q.goal === 'rhythm')) throw fail(`.building: ${Q.goal} runs a trail, not a building`);
  for (const k of ['music', 'misses']) if (Q.goal !== 'rhythm' && Q[k] !== undefined) throw fail(`.${k} belongs to the rhythm goal`);
  if (Q.music !== undefined && !RHYTHM_MOODS.includes(Q.music)) throw fail(`.music is a field score with a steady beat: ${RHYTHM_MOODS.join(', ')}`);
  if (Q.misses !== undefined && !(Number.isInteger(Q.misses) && Q.misses >= 1 && Q.misses <= 99)) throw fail('.misses is how many presses off the beat end the run, 1 to 99');
  for (const k of ['waves', 'lives', 'pads', 'foe', 'tower']) if (Q.goal !== 'defend' && Q[k] !== undefined) throw fail(`.${k} belongs to the defend goal`);
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
  if (Q.run !== undefined && (Q.building !== undefined || Q.climb)) throw fail('.run draws trails: no climb, no building');
  return Q;
}

/** A quick game's gameworld: the creator's own settings (id, name, seed, style …) kept, one level written. */
export function quickWorld({ quick: given, id, name, seed, style, ...rest } = {}) {
  readQuick(given);
  // the camera is the world's setting, not the goal's: it moves up to the world, where both run paths read it
  const { camera, ...quick } = given;
  if (typeof id !== 'string') throw fail(': the world needs an id (a short lower-case name)');
  const kit = style?.kit ?? 'trail-valley';
  if (!STAGE_KITS[kit]?.shell) throw fail(`: style.kit '${kit}' is not an outdoor stage kit (${Object.keys(STAGE_KITS).filter((k) => STAGE_KITS[k].shell).join(', ')})`);
  const nodes = { path: { trail: {} }, ...(quick.climb ? { top: { meru: {} } } : {}) };
  // a run's pool: trails each laid from its own seed, two more than a run draws
  const s0 = Number.isInteger(seed) ? seed : 1;
  const levels = quick.run
    ? Object.fromEntries(Array.from({ length: quick.run + 2 }, (_, k) => [`stretch-${k + 1}`, { name: `${name ?? id} ${k + 1}`, seed: s0 + 101 * (k + 1), walk: { nodes: { path: { trail: {} } } } }]))
    : { run: quick.building ? { name: name ?? id, building: quick.building } : { name: name ?? id, walk: { nodes, ...(quick.climb ? { edges: [{ from: 'path', to: 'top' }] } : {}) } } };
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
      return [...(pickups.length ? [{ kind: 'collect', into: 'bag', pickups }] : []), exit];
    }
    case 'survive':
      return [{ kind: 'survive', seconds: quick.seconds ?? 45 }];
    case 'race': {
      // the trail's beats in order are the checkpoints, its end the finish
      const checkpoints = [...along.map((b) => ({ at: b.at, radius: 3.5 })), { at: ends.exit, radius: 3, ...(ends.planar ? {} : { planar: false }) }];
      return [{ kind: 'laps', checkpoints }];
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
export function guardPosts(quick, ends) {
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead');
  const n = Math.min(quick.guards ?? 3, along.length);
  if (!n) return [];
  const picks = Array.from({ length: n }, (_, k) => along[Math.min(along.length - 1, Math.floor(((k + 0.5) * along.length) / n))]);
  return picks.map((b, k) => {
    const back = k ? picks[k - 1].at : ends.spawn;
    return { id: `guard-${k + 1}`, at: b.at, heading: Math.round(Math.atan2(back[1] - b.at[1], back[0] - b.at[0]) * 1000) / 1000 };
  });
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
  for (const c of [...along, s, [s[0] + Math.cos(h) * 10, s[1] + Math.sin(h) * 10]]) if ((site = lay(c))) break;
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
  for (const c of [...sites, [s[0] + Math.cos(h) * 8, s[1] + Math.sin(h) * 8]]) { const got = lay(c); if (got) return got; }
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
  const n = Math.min(quick.pads ?? 4, along.length);
  const picks = Array.from({ length: n }, (_, k) => along[Math.min(along.length - 1, Math.floor(((k + 0.5) * along.length) / n))]);
  picks.forEach((b, k) => {
    // beside the trail: off its line at that beat, alternate sides
    const prev = k ? picks[k - 1].at : ends.spawn, h = Math.atan2(b.at[1] - prev[1], b.at[0] - prev[0]), side = k % 2 ? -1 : 1;
    const at = [r3(b.at[0] - Math.sin(h) * 4 * side), r3(b.at[1] + Math.cos(h) * 4 * side), b.at[2]], id = `tower-${k + 1}`;
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
  return { figures, entities, play: { cues } };
}

/** The level's audio a goal needs: a rhythm game's music, its beat said on the bus (null: none). */
export function goalAudio(quick) {
  return quick.goal === 'rhythm' ? { soundtrack: `field:${quick.music ?? 'wayfarer'}`, beat: true } : null;
}

/** The store the goal needs (create_game's `store`): a campaign always; a bag to collect into; the hero's hp to lose. */
export function quickStore(quick) {
  return {
    slices: [
      ...(quick.goal === 'avoid' ? [{ name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }] : []),
      ...(quick.goal === 'collect' ? [{ name: 'bag', kind: 'inventory' }] : []),
      { name: 'campaign', kind: 'progression' },
    ],
  };
}
