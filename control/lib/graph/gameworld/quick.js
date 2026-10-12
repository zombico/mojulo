/**
 * THE QUICK PATH — a game whose LOOP is simple: one level and one goal, no hero book, no stats, no progression. Its
 * graphics are not simple: the ground is the world's (a kit, a look in words, the land), the hero is any hero the hero
 * door draws (every word of it, gear and paint included) or none at all (first person), and the goal is dressed by the
 * game's own decoration (glyph forms chosen by the pickup's word, sparkles, the exit's marker) and the shell's theme.
 *
 *   gameworld.quick: {
 *     goal: 'reach' | 'collect' | 'survive' | 'avoid' | 'race' | 'sneak' | 'rhythm',
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
 *     theme?: { accent?, accent2?, ink?, bg?, panel?, line?, font?, style? },   // the game shell's skin (create_game)
 *     camera?: 'third-person' | 'first-person' | 'top-down' | 'side',   // written to the world's own `camera` (cameras.js)
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

export const QUICK_GOALS = Object.freeze({
  reach: 'reach the stage\'s end: a trail\'s exit, or a climb\'s top',
  collect: 'collect what lies along the way (on the trail\'s beats), and reach the end',
  survive: 'stay on the stage until the clock runs out',
  avoid: 'reach the end past its hazards (the water a trail crosses), with hp to spare',
  race: 'run the trail\'s checkpoints in order (its beats) to the finish (its end), against the clock; the best time is kept',
  sneak: 'reach the end past guards who keep the trail, sweeping their gaze: seen, and it is over',
  rhythm: 'run the trail to the music: jump on its beat for points (off the beat is a miss); the best score is kept',
});
// the field scores a rhythm game runs to (each a steady tempo, beats-world's audio.beat)
export const RHYTHM_MOODS = Object.freeze(['wayfarer', 'expedition', 'tavern', 'village', 'plains', 'forest', 'highlands', 'desert']);
// a guard when the game names none: plain, armed
export const QUICK_GUARD = Object.freeze({ cast: 'male', palette: { Top: '#3a4660' }, gear: { right: { item: 'sword' } } });
const KEYS = ['goal', 'hero', 'ride', 'climb', 'building', 'pickup', 'seconds', 'theme', 'camera', 'guards', 'guard', 'alarms', 'music', 'misses'];
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
  return {
    id, name: name ?? id, ...(seed !== undefined ? { seed } : {}), mode: 'autonomous', ...rest, ...(camera ? { camera } : {}),
    style: { ...(style ?? {}), kit },
    levels: { run: quick.building ? { name: name ?? id, building: quick.building } : { name: name ?? id, walk: { nodes, ...(quick.climb ? { edges: [{ from: 'path', to: 'top' }] } : {}) } } },
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
