/**
 * A TRACK FROM WORDS — trackscape's one door: an intent ("a realistic GT circuit in green hills", "a twisty kart track by
 * a candy castle, with jumps") read into the track's BLOCKING (its class, form, length, twist, elevation, ramps, a
 * crossing: roads/course.js designRoadway) and its LOOK (the rest of the words, a scene's common words said in the land
 * tunnel's own: gameworld/tunnel-land.js composeLook), dressed by the set its class races in (set-pieces.js). Opinions,
 * all of them a word away from changed:
 *
 *   a GT circuit is realistic, a kart track voxel (a battle racer's cubes under the isekai light: voxel-look.js), unless
 *   a word says otherwise (cartoon, pixel: the banded pole; shaded, sunshine, kingdom hearts, ps2: the sixth
 *   generation's shaded polygons: shaded-look.js)
 *   a class has its length (a kart track 700 m, a circuit 2.2 km, a rally road 1.4 km, a stage 2 km)
 *   a course is designed from the seed (no two the same), a lap unless a word asks for a stage
 *   the land round it is hills unless a word names another (mountains, a canyon's mesas, plains), with a village where
 *   the lap sees most unless a word names farms, a town, or the wilderness
 *   its stands are the stadium's section (stadium/stand.js: raked tiers, the crowd, a canopy, glass boxes) on every
 *   pole but the voxel's, whose cubes keep the set piece's block (stamped at mint: `scape.stands`)
 *
 *   readTrackIntent(intent) → { track: { class, form, length, twist, elevation?, ramps?, crossing? }, set, pole, look,
 *                               vehicle, landmark?, surrounds?: { land?, settlement? }, reads: [{ phrase, decided }],
 *                               unread: [words] }
 *   composeTrack(intent, { seed? }) → a roadway manifest ({ form, course, kit: { look }, scape: { set, seed, stands? }, seed })
 *                               with `reads` and `vehicle` beside it: drawn by the roadway kind (track first)
 *   composeTrackWorld(intent, { seed?, id? }) → a gameworld recipe whose look is the words' and whose one level is the
 *                               track drawn in it (world and track together)
 *
 * Pure, deterministic (the seed designs the course).
 */
import { TRACK_FORMS } from './track.js';

/** The track's words: phrases, longest first; a later phrase wins what an earlier one set. */
export const TRACK_LEXICON = Object.freeze({
  // what is raced (the class, the set it is dressed from, its car)
  'gt': { class: 'circuit', set: 'gt' }, 'grand prix': { class: 'circuit', set: 'gt' }, 'formula': { class: 'circuit', set: 'gt' },
  'f1': { class: 'circuit', set: 'gt' }, 'touring': { class: 'circuit', set: 'gt' }, 'circuit': { class: 'circuit', set: 'gt' },
  'race track': { class: 'circuit', set: 'gt' }, 'racetrack': { class: 'circuit', set: 'gt' }, 'raceway': { class: 'circuit', set: 'gt' },
  'kart': { class: 'kart', set: 'kart' }, 'karting': { class: 'kart', set: 'kart' }, 'go-kart': { class: 'kart', set: 'kart' },
  'kart track': { class: 'kart', set: 'kart' }, 'mario kart': { class: 'kart', set: 'kart', pole: 'banded' },
  'rally': { class: 'rally', set: 'gt' }, 'rallycross': { class: 'rally', set: 'gt' },
  'rally stage': { class: 'rally', form: 'stage', set: 'gt' }, 'stage': { form: 'stage' }, 'point to point': { form: 'stage' },
  'dakar': { class: 'rally', form: 'stage', set: 'gt', length: 1.6, land: 'mesas' },
  // its shape
  'oval': { twist: 0.05 }, 'flowing': { twist: 0.25 }, 'fast': { twist: 0.25 }, 'sweeping': { twist: 0.25 },
  'twisty': { twist: 0.7 }, 'technical': { twist: 0.7 }, 'tight': { twist: 0.7 }, 'winding': { twist: 0.7 },
  'figure eight': { crossing: true }, 'figure-eight': { crossing: true }, 'crossover': { crossing: true },
  'short': { length: 0.6 }, 'long': { length: 1.6 }, 'endurance': { length: 1.8 },
  // its amplitude
  'flat': { elevation: null, land: 'flat' }, 'hills': { elevation: { amplitude: 12, hills: 3 }, land: 'hills' }, 'hilly': { elevation: { amplitude: 12, hills: 3 }, land: 'hills' },
  'rolling': { elevation: { amplitude: 8, hills: 3 }, land: 'hills' }, 'hillside': { elevation: { amplitude: 14, hills: 3 }, land: 'hills' },
  'mountain': { elevation: { amplitude: 24, hills: 4, crest: 'sharp' }, land: 'mountains' }, 'mountains': { elevation: { amplitude: 24, hills: 4, crest: 'sharp' }, land: 'mountains' },
  'alpine': { elevation: { amplitude: 24, hills: 4, crest: 'sharp' }, land: 'mountains' },
  // the land round it (the surrounds: surrounds.js), and what stands there
  'canyon': { land: 'mesas' }, 'desert': { land: 'mesas' }, 'mesa': { land: 'mesas' }, 'mesas': { land: 'mesas' }, 'badlands': { land: 'mesas' }, 'plains': { land: 'flat' },
  'village': { settlement: 'village' }, 'hamlet': { settlement: 'village' }, 'farm': { settlement: 'farms' }, 'farms': { settlement: 'farms' },
  'farmland': { settlement: 'farms' }, 'countryside': { settlement: 'farms' }, 'town': { settlement: 'town' }, 'city': { settlement: 'town' },
  'urban': { settlement: 'town' }, 'skyline': { settlement: 'town' }, 'wilderness': { settlement: 'none' }, 'remote': { settlement: 'none' },
  'jumps': { ramps: ['kicker', 'tabletop'] }, 'ramps': { ramps: ['kicker', 'tabletop'] }, 'stunt': { ramps: ['kicker', 'tabletop', 'gap'] },
  'stunts': { ramps: ['kicker', 'tabletop', 'gap'] }, 'big air': { ramps: ['gap', 'tabletop'] },
  // its landmark (the set's own unless a word names one)
  'castle': { landmark: 'castle' }, 'tower': { landmark: 'tower' }, 'control tower': { landmark: 'tower' }, 'mushrooms': { landmark: 'mushrooms' },
  'mushroom': { landmark: 'mushrooms' }, 'grandstand': { landmark: 'grandstand' }, 'stadium': { landmark: 'grandstand' }, 'forest': { landmark: 'grove' },
  // its pole (the look's drawing)
  'realistic': { pole: 'material' }, 'real': { pole: 'material' }, 'photoreal': { pole: 'material' }, 'lifelike': { pole: 'material' },
  'cartoon': { pole: 'banded' }, 'toy': { pole: 'banded' }, 'stylized': { pole: 'banded' }, 'cel': { pole: 'banded' },
  'pixel': { pole: 'banded' }, 'pixelated': { pole: 'banded' },
  'voxel': { pole: 'voxel' }, 'voxels': { pole: 'voxel' }, 'blocky': { pole: 'voxel' }, 'cubes': { pole: 'voxel' },
  'shaded': { pole: 'shaded' }, 'smooth': { pole: 'shaded' }, 'gouraud': { pole: 'shaded' }, 'sunshine': { pole: 'shaded' }, 'mario sunshine': { pole: 'shaded' },
  'kingdom hearts': { pole: 'shaded' }, 'gamecube': { pole: 'shaded' }, 'ps2': { pole: 'shaded' }, 'sixth gen': { pole: 'shaded' }, 'sixth-gen': { pole: 'shaded' },
  'battle racer': { class: 'kart', set: 'kart' }, 'battle racing': { class: 'kart', set: 'kart' }, 'kart battle': { class: 'kart', set: 'kart' },
});
/** A scene's common words, said in the land tunnel's own (what it reads: its traits and colour phrases). */
export const SCENE_WORDS = Object.freeze({
  autumn: 'ochre foliage, red trees', fall: 'ochre foliage, red trees', summer: 'lush green grass', spring: 'lush green grass, pink trees',
  forest: 'lush', woods: 'lush', wooded: 'lush', countryside: 'green grass, lush', meadow: 'green grass', meadows: 'green grass',
  snow: 'white ground, white grass', winter: 'white ground, white grass, pine', candy: 'pink grass, pink trees, violet sky',
  canyon: 'sandstone, tall cliffs, sparse, ochre grass, sand ground', desert: 'sandstone, sparse, ochre grass, sand ground',
  mesa: 'sandstone, ochre grass, sand ground', mesas: 'sandstone, ochre grass, sand ground', badlands: 'sandstone, ochre grass, sand ground', coast: 'sand ground, teal distance', seaside: 'sand ground, teal distance',
  volcanic: 'basalt, black ground, red sky', moor: 'umber grass, sparse', jungle: 'lush, moss trees',
});
/** A class's length (m), the car it is raced in. */
const LENGTH = Object.freeze({ kart: 700, circuit: 2200, rally: 1400, stage: 2000 });
const VEHICLE = Object.freeze({ kart: 'kart', circuit: 'sports', rally: 'rally' });
const PHRASES = Object.keys(TRACK_LEXICON).sort((a, b) => b.length - a.length);
const FILLER = new Set(['a', 'an', 'the', 'of', 'and', 'with', 'in', 'on', 'by', 'at', 'through', 'track', 'course', 'road', 'race', 'racing', 'level', 'some', 'lots']);

/** The intent read: the track's words, the scene's, what neither read. */
export function readTrackIntent(intent = '') {
  if (typeof intent !== 'string' || !intent.trim()) throw new Error('trackscape: an intent is words ("a GT circuit in green hills")');
  let text = ` ${intent.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const hits = [];
  for (const p of PHRASES) { let i = text.indexOf(` ${p} `); while (i >= 0) { hits.push({ at: i, p }); text = `${text.slice(0, i + 1)}${'#'.repeat(p.length)}${text.slice(i + 1 + p.length)}`; i = text.indexOf(` ${p} `); } }
  hits.sort((a, b) => a.at - b.at);
  const got = {}, reads = [];
  for (const h of hits) { Object.assign(got, TRACK_LEXICON[h.p]); reads.push({ phrase: h.p, decided: Object.keys(TRACK_LEXICON[h.p]).join(', ') }); }
  // a land's words read twice: the course's amplitude (or its landmark), and the look's (green hills, a forest)
  const twice = hits.filter((h) => TRACK_LEXICON[h.p].elevation !== undefined || TRACK_LEXICON[h.p].landmark === 'grove' || SCENE_WORDS[h.p]).map((h) => h.p);
  const rest = [...text.split(' ').filter((w) => w && !/^#+$/.test(w)), ...twice];
  // the scene: its common words said in the tunnel's; what the tunnel itself reads goes on as it is
  const scene = [];
  for (const w of rest) if (SCENE_WORDS[w]) { scene.push(SCENE_WORDS[w]); reads.push({ phrase: w, decided: `look: ${SCENE_WORDS[w]}` }); } else if (!FILLER.has(w)) scene.push(w);
  const cls = got.class ?? (got.set === 'kart' ? 'kart' : 'circuit'), set = got.set ?? (cls === 'kart' ? 'kart' : 'gt');
  // (a kart track voxel: the battle racer's look, cubes under the isekai light; a circuit realistic)
  const form = got.form ?? 'circuit', pole = got.pole ?? (set === 'kart' ? 'voxel' : 'material');
  const base = form === 'stage' ? LENGTH.stage : LENGTH[cls] ?? LENGTH.circuit;
  const track = { class: cls, form, length: Math.round(base * (got.length ?? 1)), twist: got.twist ?? (cls === 'kart' ? 0.5 : 0.4),
    ...(got.elevation ? { elevation: got.elevation } : {}), ...(got.ramps ? { ramps: got.ramps } : {}), ...(got.crossing ? { crossing: true } : {}) };
  // the look: the scene's words, the pole said in the tunnel's terms (realistic, or stylized) when no word did
  const said = scene.join(' ');
  const look = `${pole === 'material' && !/\b(realistic|realism|naturalistic|lifelike|photoreal)\b/.test(said) ? 'realistic ' : pole !== 'material' && !/\bstyli[sz]ed\b/.test(said) ? 'stylized ' : ''}${said}`.trim() || (pole === 'material' ? 'realistic green grass' : 'stylized green grass');
  // the surrounds: the land the words name (a course's mountains are the land's too), the settlement they name
  const surrounds = { ...(got.land ? { land: got.land } : {}), ...(got.settlement ? { settlement: got.settlement } : {}) };
  return { track, set, pole, look, vehicle: VEHICLE[cls] ?? 'sports', ...(got.landmark ? { landmark: got.landmark } : {}), ...(Object.keys(surrounds).length ? { surrounds } : {}), reads, unread: [] };
}

/** A roadway manifest from words: the course designed by the seed, the look composed wherever it is drawn. */
export function composeTrack(intent, { seed = 1 } = {}) {
  const R = readTrackIntent(intent), T = R.track;
  if (!TRACK_FORMS.includes(T.form)) throw new Error(`trackscape: form ${T.form}`);
  const course = { class: T.class, length: T.length, twist: T.twist, seed, ...(T.elevation ? { elevation: T.elevation } : {}), ...(T.ramps ? { ramps: T.ramps } : {}), ...(T.crossing ? { crossing: true } : {}), ...(T.form === 'stage' ? { closed: false } : {}) };
  return { kind: 'roadway', form: T.form, course, kit: { look: R.look, seed, ...(R.pole === 'voxel' || R.pole === 'shaded' ? { pole: R.pole } : {}) }, scape: { set: R.set, seed, ...(R.landmark ? { landmark: R.landmark } : {}), ...(R.surrounds ? { surrounds: R.surrounds } : {}), ...(R.pole !== 'voxel' ? { stands: 'bowl' } : {}) }, seed, intent, reads: R.reads, vehicle: R.vehicle };
}

/** A gameworld from words: its look the words', its one level the track drawn in it (the world and the track together). */
export function composeTrackWorld(intent, { seed = 1, id = 'trackscape' } = {}) {
  const R = readTrackIntent(intent), M = composeTrack(intent, { seed });
  return { id, seed, style: { look: R.look }, levels: { track: { name: intent, roadway: { form: M.form, course: M.course, kit: true, scape: M.scape } } } };
}
