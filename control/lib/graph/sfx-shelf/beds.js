/**
 * sfx-shelf/beds — an environment's bed: the shelf's one-shots as a groove (a beats pattern), the way a beatboxer
 * holds a beat. A bed stores no long sound: it is which shelf words play, how often and how loud, and the pattern
 * the beats engine already loops. Every hit is a seeded variant (`vary`), and each loop pass a new one, so a bed's
 * second pass is not its first. Pure: the same bed is the same manifest.
 *
 *   BEDS                      { <id>: { label, aliases, bpm, tracks: [{ word, hits, vel: [lo, hi], pan? }] } }
 *   bedManifest(id, { style })  → a beats-pattern manifest (64 sixteenths; each track's hits placed by a seeded draw)
 *   resolveBed(word)          → a bed id by its id or an alias, or null
 */
import { sfxSound } from './resolve.js';
import { normalizeName } from './roster.js';

const STEPS = 64;

export const BEDS = Object.freeze({
  rain: { label: 'rain falling, thunder far off now and then', aliases: ['rainfall', 'raining', 'rainstorm'], bpm: 90, tracks: [
    { word: 'raindrop', hits: 34, vel: [0.35, 0.9], pan: -0.35 }, { word: 'raindrop', hits: 30, vel: [0.3, 0.8], pan: 0.35 },
    { word: 'raindrop', hits: 22, vel: [0.25, 0.6], pan: 0 }, { word: 'thunder-far', hits: 1, vel: [0.5, 0.6] }] },
  night: { label: 'a night outside: crickets, a frog, an owl', aliases: ['night', 'night ambience', 'nighttime'], bpm: 90, tracks: [
    { word: 'cricket', hits: 6, vel: [0.4, 0.6], pan: -0.4 }, { word: 'cricket', hits: 5, vel: [0.3, 0.5], pan: 0.45 },
    { word: 'frog', hits: 2, vel: [0.4, 0.55], pan: 0.2 }, { word: 'owl', hits: 1, vel: [0.45, 0.5], pan: -0.2 }] },
  forest: { label: 'a forest by day: songbirds, wings now and then', aliases: ['forest', 'woods', 'birdsong ambience', 'forest day'], bpm: 90, tracks: [
    { word: 'bird-chirp', hits: 3, vel: [0.35, 0.6], pan: -0.5 }, { word: 'sparrow', hits: 3, vel: [0.3, 0.55], pan: 0.4 },
    { word: 'bird-trill', hits: 2, vel: [0.3, 0.5], pan: 0.1 }, { word: 'bird-warble', hits: 1, vel: [0.35, 0.45], pan: -0.2 },
    { word: 'bat-wings', hits: 1, vel: [0.25, 0.35], pan: 0.3 }] },
  cave: { label: 'a cave: drips, bats far in', aliases: ['cave', 'cavern', 'cave ambience'], bpm: 90, tracks: [
    { word: 'drip', hits: 5, vel: [0.35, 0.7], pan: -0.3 }, { word: 'drip', hits: 3, vel: [0.25, 0.5], pan: 0.4 },
    { word: 'bat-squeak', hits: 2, vel: [0.2, 0.35], pan: 0.5 }, { word: 'bat-chatter', hits: 1, vel: [0.25, 0.3], pan: -0.4 }] },
  swamp: { label: 'a swamp: frogs, crickets, bubbling, a fly', aliases: ['swamp', 'marsh', 'bog ambience'], bpm: 90, tracks: [
    { word: 'frog', hits: 4, vel: [0.4, 0.6], pan: -0.3 }, { word: 'frog', hits: 3, vel: [0.3, 0.5], pan: 0.4 },
    { word: 'cricket', hits: 3, vel: [0.25, 0.4], pan: 0.1 }, { word: 'bubbling', hits: 2, vel: [0.3, 0.45], pan: -0.1 },
    { word: 'fly', hits: 1, vel: [0.25, 0.35], pan: 0.3 }] },
  farm: { label: 'a farmyard: hens, ducks, a goose, the rooster now and then', aliases: ['farm', 'farmyard', 'barnyard'], bpm: 90, tracks: [
    { word: 'chicken', hits: 3, vel: [0.35, 0.55], pan: -0.4 }, { word: 'duck', hits: 2, vel: [0.3, 0.5], pan: 0.4 },
    { word: 'goose', hits: 1, vel: [0.3, 0.45], pan: 0.2 }, { word: 'rooster', hits: 1, vel: [0.4, 0.5], pan: -0.1 }] },
});

let index = null;
/** A bed by its id or an alias, or null. */
export function resolveBed(word) {
  if (!index) { index = new Map(); for (const [id, b] of Object.entries(BEDS)) for (const w of [id, ...b.aliases]) if (!index.has(normalizeName(w))) index.set(normalizeName(w), id); }
  return BEDS[word] ? word : index.get(normalizeName(word)) ?? null;
}

// seeded draws: the bed and the track decide where its hits fall and how loud
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const r2 = (v) => Math.round(v * 100) / 100;

/** The bed as a beats pattern: each track its shelf word's voice, its hits on distinct sixteenths, each a variant. */
export function bedManifest(id, { style = 'mouth' } = {}) {
  const bed = BEDS[resolveBed(id) ?? ''];
  if (!bed) throw new Error(`sfx-shelf: '${id}' is no bed (${Object.keys(BEDS).join(', ')})`);
  const tracks = bed.tracks.map((tr, k) => {
    const v = sfxSound(tr.word, { style });
    if (!v || !v.gestures) throw new Error(`sfx-shelf: bed ${id}: '${tr.word}' has no one-shot voice in ${style}`);
    const rnd = mulberry32(hash(`${id}/${k}/${tr.word}`)), mask = Array(STEPS).fill(0);
    let placed = 0;
    while (placed < Math.min(tr.hits, STEPS)) {
      const at = Math.floor(rnd() * STEPS);
      if (mask[at]) continue;
      mask[at] = r2(tr.vel[0] + rnd() * (tr.vel[1] - tr.vel[0])); placed++;
    }
    return { name: `${tr.word}-${k}`, cue: v.gestures, vary: true, mask, ...(tr.pan ? { pan: tr.pan } : {}) };
  });
  return { kind: 'beats-pattern', title: bed.label, bpm: bed.bpm, steps: STEPS, tracks };
}
