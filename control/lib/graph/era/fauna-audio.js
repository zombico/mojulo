/**
 * era/fauna-audio — a biocube's fauna HEARD: the field's kinds and its herds calling from where they live, as the page's
 * place sounds (`audio.emitters`, the audio channel's: each sounds its cue again after a wait rolled between its bounds,
 * heard by the listener's distance and not past its reach). Each kind and each herd is heard in its animal's voice (the
 * animal shelf, sfx-shelf/animal-sounds.js: the species a kind stands on, a herd's own) and only where the sound
 * library records that voice: a page without the library, or a voice it does not hold, carries none of it.
 *
 *   FIELD_SOUNDS   each field kind's sound settings (era/biocube-fauna.js FIELD_KINDS): which call, how often (`every`,
 *                  seconds), how far it carries (`reach`, metres), how loud (`level`), at how many of its places (`most`);
 *                  null for a kind that makes no sound (a firefly's light, a butterfly's wings)
 *   HERD_SOUND     a herd's: how often, its reach by its voice's weight (a mouse's squeak to an elephant's trumpet), how loud
 *   faunaAudio({ fauna, entities })   → { sfx: { cues }, emitters } an audio spec (beats-world resolves it), or null:
 *                  `fauna` the page's field (biocube-fauna.js placeFauna / placeIndoorFauna), `entities` the page's,
 *                  whose herd members (`fauna: true`, ids `fauna:<species>:<group>:<k>`) call one a group
 *
 * Pure but for the library's index (it reads which voices are recorded); timeless.
 */
import { FIELD_KINDS } from './biocube-fauna.js';
import { animalSounds, animalRecorded } from '../sfx-shelf/animal-sounds.js';
import { ANIMAL_CLASSES } from '../sfx-shelf/animal-voices.js';
import { sfxSound } from '../sfx-shelf/resolve.js';

const fz = (o) => Object.freeze(o);
export const FIELD_SOUNDS = fz({
  gnats: fz({ call: 'call', every: fz([5, 12]), reach: 10, level: 0.35, most: 4 }),
  fireflies: null,
  butterflies: null,
  // (a flock's caw now and then over the whole site, about as often as one crosses: its `every`)
  birds: fz({ call: 'call', every: 'flock', reach: 'span', level: 0.5, most: 1 }),
  ducks: fz({ call: 'call', every: fz([6, 16]), reach: 22, level: 0.5, most: 3 }),
  roaches: fz({ call: 'call', every: fz([14, 36]), reach: 6, level: 0.3, most: 3 }),
  mice: fz({ call: 'call', every: fz([10, 28]), reach: 8, level: 0.4, most: 3 }),
});
export const HERD_SOUND = fz({ every: fz([10, 30]), reach: fz({ light: 14, mid: 30, heavy: 55 }), level: 0.6 });
// (the audio channel's limit on a page's place sounds)
const MOST = 32;

const r2 = (v) => Math.round(v * 100) / 100;
// a kind's places: where each of it lives on the page's field
const placesOf = (k, F) => {
  if (k === 'gnats') return F.clouds ?? [];
  if (k === 'ducks') return (F.ducks ?? []).map((d) => d.slice(0, 3));
  if (k === 'birds') return F.centre ? [[F.centre[0], F.centre[1], r2(F.centre[2] + (F.height?.[0] ?? 24))]] : [];
  // (a wall run's room: its middle)
  if (k === 'roaches' || k === 'mice') return (F.runs ?? []).map((r) => [r2((r[0] + r[2]) / 2), r2((r[1] + r[3]) / 2), 0]);
  return [];
};

export function faunaAudio({ fauna = null, entities = [] } = {}) {
  const cues = {}, emitters = [];
  const voiced = (species, call) => {
    const A = animalSounds(species);
    if (!A?.voice || !animalRecorded(A.voice)) return null;
    const word = A[call], id = `fauna:${word}`;
    if (!(id in cues)) { const v = sfxSound(word); if (!v?.gestures) return null; cues[id] = v.gestures; }
    return { id, voice: A.voice };
  };
  for (const [k, S] of Object.entries(FIELD_SOUNDS)) {
    if (!S || !fauna || !fauna[k]) continue;
    const v = voiced(FIELD_KINDS[k].stands, S.call);
    if (!v) continue;
    const F = fauna[k], every = S.every === 'flock' ? [Math.max(0.2, r2(F.every * 0.6)), Math.max(0.2, r2(F.every * 1.4))] : [...S.every];
    const reach = S.reach === 'span' ? F.span ?? 120 : S.reach;
    // (its places spread over the field: every n-th, not the first few in a corner)
    const P = placesOf(k, F), step = Math.max(1, Math.floor(P.length / S.most));
    for (let i = 0; i < P.length && emitters.length < MOST && i / step < S.most; i += step) emitters.push({ at: P[i].map(r2), cue: v.id, every, reach, level: S.level });
  }
  // a herd's call from its ground: one a group, at its first member
  const groups = new Map();
  for (const e of entities) {
    if (!e?.fauna || e.food || typeof e.id !== 'string') continue;
    const [, species, g] = e.id.split(':');
    const key = `${species}:${g}`;
    if (species && !groups.has(key)) groups.set(key, { species, at: e.transform?.pos });
  }
  for (const { species, at } of [...groups.values()].sort((a, b) => (a.species < b.species ? -1 : a.species > b.species ? 1 : 0))) {
    if (emitters.length >= MOST || !Array.isArray(at)) continue;
    const v = voiced(species, 'call');
    if (!v) continue;
    emitters.push({ at: [r2(at[0]), r2(at[1]), r2(at[2] ?? 0)], cue: v.id, every: [...HERD_SOUND.every], reach: HERD_SOUND.reach[ANIMAL_CLASSES[v.voice].weight] ?? 30, level: HERD_SOUND.level });
  }
  return emitters.length ? { sfx: { cues }, emitters } : null;
}
