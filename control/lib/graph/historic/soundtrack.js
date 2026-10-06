/**
 * soundtrack — a culture's period music, the optional default soundtrack of a `historic` world.
 *
 *   { kind: 'historic', culture: 'qin', audio: { soundtrack: 'default' } }
 *
 * One mood per culture family: a synthesized bed led by a timbre that stands in for an instrument the
 * culture played (a lyre, a harp and sistrum, the kithara and aulos, the zheng and bronze bells, the water
 * organ). The instrument families are the attested part; the scales, tempi and harmony are CONJECTURE, since
 * no ancient performance survives as sound. Kept out on purpose: the augmented-second "Orient" for Sumer and
 * Egypt (much later), the erhu and the gong for Qin (later; the gong is Han and southern), "epic" brass for Rome.
 *
 * A world's seed moves the mood's dice, so two towns of one culture sound related and not the same; seed 1 is
 * the take auditioned when the mood was written. The beds keep the place-music principles: few voices, slow
 * harmony, one room per place, and a cycle that ends open (never V–I), so the loop reads as a continuation.
 * Pure and deterministic.
 */
import { mulberry32 } from './layout-kit.js';
import { HISTORIC_CULTURES } from './cultures/index.js';

const steps = (on, v = 0.5) => Array.from({ length: 16 }, (_, i) => (on.includes(i) ? v : 0));
const flat = (v) => Array(16).fill(v);
const NORMALIZE = { normalize: { lufs: -20 } };   // a bed sits under the scene: the baked WAV's loudness

// ── Sumer: a dark gut-string lyre (Ur's bull-headed lyres), a reed pipe, a frame drum, canal water.
// A Aeolian over a fixed A drone: diatonic and heptatonic, as the Mesopotamian string tunings are.
const sumer = (seed) => ({
  kind: 'beats-ambient', title: 'Reed Canal at Dusk', bpm: 58, swing: 0, seed,
  progression: [
    { chord: ['A2', 'E3', 'A3'], root: 'A1' }, { chord: ['A2', 'E3', 'G3'], root: 'A1' },
    { chord: ['A2', 'E3', 'A3'], root: 'A1' }, { chord: ['A2', 'D3', 'F3'], root: 'A1' },
    { chord: ['A2', 'E3', 'A3'], root: 'A1' }, { chord: ['A2', 'E3', 'C4'], root: 'A1' },
    { chord: ['A2', 'D3', 'G3'], root: 'A1' }, { chord: ['A2', 'E3', 'B3'], root: 'A1' },   // closes on the 2nd
  ],
  room: { decay: 2.4, damp: 0.75, predelay: 0.02 },
  channels: [
    { name: 'drone', role: 'harmony', patch: 'pad', tone: 0.3, send: 0.35, trim: -12 },
    { name: 'lyre', role: 'melody', instrument: 'harp', tone: 0.45, pan: -0.2, send: 0.4, trim: 8,
      sequence: { table: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], gate: 0.38 } },
    { name: 'reed', role: 'melody', instrument: 'oboe', tone: 0.4, pan: 0.25, send: 0.5, trim: 8,
      sequence: { table: ['E4', 'D4', 'C4', 'B3', 'A3'], gate: 0.07 } },
    { name: 'frame', role: 'pulse', instrument: 'latin-perc', note: 'E4', steps: steps([0, 6, 10], 0.45), dropout: 0.35, pan: -0.1, send: 0.3 },
    { name: 'water', role: 'pulse', patch: 'burstSoft', note: 'C4', steps: steps([3, 11], 1), dropout: 0.5, tone: 0.55, pan: 0.4, send: 0.6, trim: 12 },
  ],
  export: NORMALIZE,
});

// ── Egypt: a New Kingdom harp ostinato, the sistrum's metal shimmer, clappers, an end-blown flute.
// D with a Mixolydian ♭VII; the cycle ends on ♭VII sus. The river breeze is the world's `wind`.
const egypt = (seed) => ({
  kind: 'beats-ambient', title: 'Harp on the Nile', bpm: 70, swing: 0.05, seed,
  progression: [
    { chord: ['D3', 'A3', 'D4', 'F#4'], root: 'D2' }, { chord: ['D3', 'A3', 'D4', 'F#4'], root: 'D2' },
    { chord: ['C3', 'G3', 'C4', 'E4'], root: 'C2' }, { chord: ['D3', 'A3', 'D4', 'E4'], root: 'D2' },
    { chord: ['G2', 'D3', 'G3', 'B3'], root: 'G1' }, { chord: ['D3', 'A3', 'D4', 'F#4'], root: 'D2' },
    { chord: ['C3', 'G3', 'C4', 'E4'], root: 'C2' }, { chord: ['C3', 'G3', 'C4', 'D4'], root: 'C2' },
  ],
  room: { decay: 1.8, damp: 0.5, predelay: 0.02 },
  channels: [
    { name: 'harp', role: 'melody', instrument: 'harp', pan: -0.25, send: 0.35, trim: 4,
      sequence: { table: ['D4', 'E4', 'F#4', 'A4', 'B4', 'C5', 'D5'], gate: 0.62 } },
    { name: 'bed', role: 'harmony', instrument: 'poly-strings', tone: 0.35, send: 0.4, trim: -8 },
    { name: 'roots', role: 'roots', instrument: 'harp', tone: 0.5, pan: -0.1, send: 0.3, trim: -2 },
    { name: 'flute', role: 'melody', instrument: 'flute', tone: 0.55, pan: 0.3, send: 0.55, trim: 2,
      sequence: { table: ['A4', 'B4', 'C5', 'D5', 'E5'], gate: 0.08 } },
    { name: 'sistrum', role: 'pulse', instrument: 'latin-perc', note: 'A4', steps: steps([4, 12], 0.7), dropout: 0.4, pan: 0.35, send: 0.3, trim: 12 },
    { name: 'clap', role: 'pulse', instrument: 'latin-perc', note: 'D#5', steps: steps([0, 7, 10], 0.25), dropout: 0.5, pan: -0.35, send: 0.25, trim: 12 },
  ],
  export: NORMALIZE,
});

// ── Greek: the kithara and the aulos, one pipe holding a drone; surf under the cliff, cicadas.
// E–D–C–B tetrachords (the Dorian harmonia, modern E Phrygian); the F–E half step left hanging.
const greek = (seed) => ({
  kind: 'beats-ambient', title: 'Kithara over the Bay', bpm: 64, swing: 0, seed,
  progression: [
    { chord: ['E3', 'B3', 'E4'], root: 'E2' }, { chord: ['E3', 'A3', 'C4'], root: 'E2' },
    { chord: ['E3', 'B3', 'D4'], root: 'E2' }, { chord: ['E3', 'G3', 'B3'], root: 'E2' },
    { chord: ['D3', 'A3', 'D4'], root: 'D2' }, { chord: ['E3', 'B3', 'E4'], root: 'E2' },
    { chord: ['C3', 'G3', 'C4'], root: 'C2' }, { chord: ['E3', 'F3', 'B3'], root: 'E2' },
  ],
  room: { decay: 3.2, damp: 0.4, predelay: 0.05 },
  channels: [
    { name: 'kithara', role: 'melody', instrument: 'classical-guitar', patchParams: { tune: 'exact' }, pan: -0.2, send: 0.35, trim: 6,
      sequence: { table: ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'], gate: 0.45 } },
    { name: 'aulos-drone', role: 'harmony', instrument: 'oboe', tone: 0.35, send: 0.45, trim: -8 },
    { name: 'aulos', role: 'melody', instrument: 'oboe', pan: 0.25, send: 0.5, trim: 6,
      sequence: { table: ['E5', 'D5', 'C5', 'B4', 'A4'], gate: 0.1 } },
    { name: 'surf', role: 'pulse', patch: 'burstSoft', note: 'C3', steps: steps([0, 8], 1), dropout: 0.35, tone: 0.45, send: 0.8, trim: 12 },
    { name: 'cicada', role: 'pulse', patch: 'hat', note: 'C6', steps: flat(0.5), dropout: 0.45, tone: 0.9, pan: 0.6, send: 0.2, trim: 10 },
  ],
  export: NORMALIZE,
});

// ── Rome: the hydraulis (water organ), cithara, tibia, a distant cornu call, the scabellum keeping time;
// cicadas and a fountain. G major with a Lydian C♯; the cycle ends on IV add6.
const roman = (seed) => ({
  kind: 'beats-ambient', title: 'Summer Morning, 79', bpm: 80, swing: 0.04, seed,
  progression: [
    { chord: ['G3', 'B3', 'D4'], root: 'G2' }, { chord: ['A3', 'C#4', 'E4'], root: 'A2' },
    { chord: ['G3', 'B3', 'D4'], root: 'G2' }, { chord: ['E3', 'G3', 'B3'], root: 'E2' },
    { chord: ['C3', 'E3', 'G3'], root: 'C2' }, { chord: ['G3', 'B3', 'D4'], root: 'G2' },
    { chord: ['A3', 'C#4', 'E4'], root: 'A2' }, { chord: ['C3', 'E3', 'A3'], root: 'C2' },
  ],
  room: { decay: 1.5, damp: 0.35, predelay: 0.015 },
  channels: [
    { name: 'hydraulis', role: 'harmony', instrument: 'organ', tone: 0.45, send: 0.35, trim: -12 },
    { name: 'cithara', role: 'melody', instrument: 'harp', pan: -0.3, send: 0.3, trim: 4,
      sequence: { table: ['G4', 'A4', 'B4', 'C#5', 'D5', 'E5', 'G5'], gate: 0.5 } },
    { name: 'tibia', role: 'melody', instrument: 'oboe', pan: 0.25, send: 0.4, trim: 6,
      sequence: { table: ['D5', 'E5', 'G5', 'A5', 'B5'], gate: 0.12 } },
    { name: 'cornu', role: 'melody', instrument: 'french-horn-2', tone: 0.35, pan: 0.5, send: 0.8,
      sequence: { table: ['G3', 'D4', 'G4'], gate: 0.03 } },
    { name: 'scabellum', role: 'pulse', instrument: 'latin-perc', note: 'D#5', steps: steps([0, 8], 0.3), dropout: 0.2, pan: -0.15, send: 0.25, trim: 12 },
    { name: 'cicada', role: 'pulse', patch: 'hat', note: 'C6', steps: flat(0.45), dropout: 0.4, tone: 0.9, pan: -0.6, send: 0.15, trim: 10 },
    { name: 'fountain', role: 'pulse', patch: 'burstSoft', note: 'C5', steps: steps([1, 3, 5, 9, 11, 13], 0.5), dropout: 0.35, tone: 0.7, pan: 0.45, send: 0.5, trim: 8 },
  ],
  export: NORMALIZE,
});

// ── Qin: the zheng and bronze bells. Li Si's memorial (c. 237 BCE) names Qin's own music as plucking the
// zheng and striking clay jars (fou). A score, not an ambient row: the zheng is its gestures. The string
// voice re-tuned (a silk-and-nail pluck, a long paulownia box, a two-string shimmer) plays press-bends into
// the notes the pentatonic skips (E→G, A→C), vibrato after the pluck, glissandi into a phrase, tremolo on a
// held note, left-hand octaves. The bianzhong is almond-section bronze: damped, inharmonic, two strike tones
// a third apart (centre, then side). C pentatonic; no triads.
const PENTA = ['C', 'D', 'E', 'G', 'A'];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC = { C: 0, D: 2, E: 4, G: 7, A: 9 };
const pent = (i) => PENTA[((i % 5) + 5) % 5] + Math.floor(i / 5);   // pentatonic index → note (22 = E4)
function shift(n, semis) {
  const m = /^([A-G])(-?\d)$/.exec(n), x = PC[m[1]] + (+m[2] + 1) * 12 + semis;
  return NAMES[x % 12] + (Math.floor(x / 12) - 1);
}
const ZHENG = {
  patch: 'harp',
  patchParams: { pluckDamping: 0.42, pick: 0.18, ringT60: [6, 1.6], pluckDetune: 2.5, stiffness: 0.15,
    filter: { mode: 'lowpass', freq: 5200, q: 0.6 }, attackNoise: { level: -20, decay: 0.01, tone: 3800, q: 0.8 } },
  chain: [{ type: 'body', mix: 0.3, resonances: [{ freq: 110, q: 5, gain: 0.7 }, { freq: 240, q: 6, gain: 0.6 }, { freq: 480, q: 5, gain: 0.4 }, { freq: 1500, q: 3, gain: 0.25 }] }],
};
const BIANZHONG = { partials: [
  { ratio: 1, gain: 1, decay: 2.4 }, { ratio: 1.19, gain: 0.28, decay: 1.6 }, { ratio: 2.08, gain: 0.55, decay: 1.3 },
  { ratio: 2.74, gain: 0.45, decay: 0.9 }, { ratio: 3.56, gain: 0.3, decay: 0.6 }, { ratio: 4.82, gain: 0.2, decay: 0.35 },
  { ratio: 6.3, gain: 0.12, decay: 0.2 }], attackNoise: { level: -16, decay: 0.03, tone: 900, q: 0.7 } };
const BELL_PAIRS = [['C4', 'E4'], ['A3', 'C4'], ['G3', 'A3'], ['D4', 'G4']];   // centre tone → side tone
const BARS = 16;

function qin(seed) {
  const r = mulberry32(seed), pick = (a) => a[Math.floor(r() * a.length)];
  const hi = [], lo = [], bells = [], fou = [], drone = [];
  let bar = 0, idx = 22;
  while (bar < BARS) {
    const t0 = bar * 4, ground = pick(['C3', 'G2', 'A2', 'D3']);
    lo.push([t0, ground, 4, 0.42], [t0 + 2, shift(ground, 12), 2, 0.28]);     // the left hand's open octave
    let t = t0;
    if (r() < 0.5) { lo.push([t, pent(idx - 6), 0.6, 0.3, { type: 'gliss', to: pent(idx), scale: [0, 2, 4, 7, 9] }]); t += 0.75; }
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const last = k === n - 1, d = last ? pick([2, 2.5, 3]) : pick([0.5, 1, 1, 1.5]), note = pent(idx), pc = PENTA[((idx % 5) + 5) % 5];
      if (!last && r() < 0.3 && (pc === 'G' || pc === 'C')) {
        // a press-bend: the string a minor third below, pushed up to the note
        hi.push([t, shift(note, -3), d, 0.55, { type: 'bend', to: 3, at: 0.06, over: 0.22, vib: { depth: 18, rate: 5, delay: 0.3 } }]);
      } else {
        const art = last ? (r() < 0.25 ? { type: 'trem', rate: 11 } : { type: 'vib', depth: 28, rate: 5.5, delay: 0.35 })
          : (r() < 0.3 ? { type: 'vib', depth: 15, rate: 5, delay: 0.25 } : undefined);
        hi.push(art ? [t, note, d, last ? 0.5 : 0.58, art] : [t, note, d, 0.58]);
      }
      t += d;
      idx = Math.max(17, Math.min(29, idx + pick([-2, -1, -1, 1, 1, 2])));
    }
    if (r() < 0.5) fou.push([t + 0.5, 'E4', 0.5, 0.35]);
    bar += Math.max(2, Math.ceil((t - t0) / 4)) + (r() < 0.6 ? 1 : 0);          // breathe between phrases
  }
  for (let b = 0; b < BARS; b += 4) {
    const [centre, side] = pick(BELL_PAIRS);
    bells.push([b * 4, centre, 3, 0.5], [b * 4 + 1.5, side, 3, 0.3]);
    drone.push([b * 4, ['C3', 'G3'], 16, 0.3]);
  }
  return {
    kind: 'beats-composition', title: 'Silk Zheng, Wei Valley', bpm: 52, loop: true,
    room: { decay: 4, damp: 0.6, predelay: 0.05 },
    parts: [
      { name: 'zheng', ...ZHENG, feel: { jitterTime: 0.008, jitterVel: 0.1 }, pan: 0.15, send: 0.35, trim: 4, events: hi },
      { name: 'zheng-low', ...ZHENG, feel: { jitterTime: 0.01, jitterVel: 0.1 }, pan: -0.1, send: 0.35, trim: 2, events: lo },
      { name: 'bianzhong', patch: 'tubularBells', patchParams: BIANZHONG, tone: 0.6, pan: -0.3, send: 0.45, trim: -2, events: bells },
      { name: 'fou', instrument: 'latin-perc', tone: 0.35, pan: 0.3, send: 0.4, trim: -2, events: fou },
      { name: 'drone', patch: 'pad', tone: 0.25, send: 0.4, trim: -16, events: drone },
    ],
    // the zheng's pluck is peaky: a gentle glue keeps the bed level with the others
    master: { limit: -1.5, glue: { threshold: -30, ratio: 3, knee: 6, attack: 0.002, release: 0.25 } },
    export: NORMALIZE,
  };
}

/**
 * Each mood and its base seed (the auditioned take). A culture names its mood on its card (`soundtrack`), so a
 * culture spread from another plays its parent's mood until it has its own; a new mood is a row here.
 */
export const MOODS = {
  sumer: { build: sumer, base: 2900 },
  egypt: { build: egypt, base: 1250 },
  greek: { build: greek, base: 180 },
  qin: { build: qin, base: 212 },
  roman: { build: roman, base: 79 },
};

/** The mood a culture plays (its card's `soundtrack`), or null. */
export function soundtrackMood(culture) {
  const m = HISTORIC_CULTURES[culture]?.soundtrack;
  return m && MOODS[m] ? m : null;
}

/** The culture's period soundtrack as a beats recipe; the world seed moves its dice (seed 1 = the auditioned take). */
export function historicSoundtrack(culture, seed = 1) {
  const mood = soundtrackMood(culture);
  if (!mood) throw new Error(`historic: ${culture} has no period soundtrack yet — the cultures with one: ${Object.keys(HISTORIC_CULTURES).filter(soundtrackMood).join(', ')}`);
  const M = MOODS[mood], s = Number.isInteger(seed) ? seed : 1;
  return M.build((M.base + (s - 1) * 7919) >>> 0);
}

/**
 * A `historic` manifest's `audio`, with `soundtrack: 'default'` replaced by its culture's recipe. Every other
 * field (wind, bindings, sfx, an inline or `beatsRef` soundtrack) passes through untouched; no `audio` stays none.
 */
export function historicAudio(m = {}) {
  const a = m.audio;
  if (!a || typeof a !== 'object' || typeof a.soundtrack !== 'string' || a.soundtrack.startsWith('field:')) return a;
  if (a.soundtrack !== 'default') throw new Error(`historic: audio.soundtrack '${a.soundtrack}' — use 'default' (the culture's period music), 'field:<mood>', an inline beats recipe or { beatsRef }`);
  return { ...a, soundtrack: historicSoundtrack(m.culture, Number.isInteger(m.seed) ? m.seed : 1) };
}
