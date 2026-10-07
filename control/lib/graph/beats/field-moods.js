/**
 * field-moods — level music for open country: the plains, a desert road, a village, a forest.
 *
 *   fieldSoundtrack('plains', seed)  → a beats-composition recipe
 *
 * Each mood is a short loop written to the open-country principles (card `beats-orchestra`): space (three lines
 * at most), a woodwind lead answered rather than doubled, a drone or pedal instead of a bass line, strings as a
 * quiet distant pad, light or no percussion, gentle modal harmony that never closes V–i at the seam, and layers
 * that enter one at a time (one colour alone first). Card `beats-field-orchestra` is the manual; these are its
 * worked set.
 *
 * The adventurous moods take the same country up a step (see their block below).
 *
 * Like the historic MOODS, a seed moves the recipe's dice and seed 1 is the take auditioned when the mood was
 * written. Pure and deterministic.
 */

const NORMALIZE = { normalize: { lufs: -20 } };   // a bed sits under the level: the baked WAV's loudness
const form = (phrase, ...bars) => bars.map((b) => ({ phrase, at: `${b}:0:0` }));

// ── plains: the world map. 6/8, D Mixolydian over an open-fifth drone; a flute phrase, the oboe answers.
const plains = (seed) => ({
  kind: 'beats-composition', title: 'Open Road', bpm: 84, meter: '6/8', seed, key: 'D',
  band: 'orchestra-pastoral',
  progression: [{ chords: 'I bVII IV I', repeat: 6 }],
  phrases: {
    A: [[0, 'F#5', 1, 0.6], [1, 'E5', 0.5, 0.5], [1.5, 'D5', 1.5, 0.55], [3, 'E5', 1, 0.6], [4, 'G5', 0.5, 0.55], [4.5, 'E5', 1.5, 0.5],
        [6, 'D5', 1, 0.55], [7, 'B4', 0.5, 0.5], [7.5, 'D5', 1.5, 0.5], [9, 'A4', 2.5, 0.5]],
    B: [[0, 'A4', 1.5, 0.55], [1.5, 'F#4', 1.5, 0.5], [3, 'G4', 1, 0.55], [4, 'E4', 0.5, 0.5], [4.5, 'C5', 1.5, 0.55],
        [6, 'B4', 1.5, 0.5], [7.5, 'G4', 1.5, 0.5], [9, 'F#4', 1, 0.5], [10, 'E4', 0.5, 0.45], [10.5, 'D4', 1.5, 0.5]],
  },
  parts: [
    { name: 'harp', instrument: 'harp', chordVoice: 'arp', rhythm: 'lilt', vel: 0.55, octave: 4 },
    { name: 'drone', instrument: 'cello', chordVoice: 'drone', bars: [2, 24], hold: 1, vel: 0.32, octave: 2 },
    { name: 'strings', instrument: 'violin-2', chordVoice: 'upper', rhythm: 'whole', hold: 0.9, vel: 0.4, octave: 4, bars: [6, 20],
      dynamics: [{ at: '6:0:0', to: 'pp' }, { at: '8:0:0', to: 'p', over: '4:0:0' }, { at: '14:0:0', to: 'pp', over: '5:0:0' }] },
    { name: 'flute', instrument: 'flute', form: form('A', 2, 12) },
    { name: 'oboe', instrument: 'oboe', form: form('B', 6, 16) },
    { name: 'perc', instrument: 'orchestral-perc', groove: { style: 'travel', bars: [0, 20] } },
  ],
  export: NORMALIZE,
});

// ── desert: a dry Western in 6/8. G minor, roots a tritone apart (i bVI bV), then the chorus slides down
// (i bVI bV bIV7). A plucked guitar alone, a soft pedal, a low clarinet; a short dry room and no strings.
const desert = (seed) => ({
  kind: 'beats-composition', title: 'Dust Road', bpm: 108, meter: '6/8', seed, key: 'Gm',
  band: 'orchestra-pastoral',
  room: { model: 'room2', decay: 1.4, predelay: 0.012, damp: 0.6 },
  progression: [{ chords: 'i bVI bV bVI', repeat: 2 }, { chords: 'i bVI bV bIV7', repeat: 2 }, { chords: 'i bVI bV bVI', repeat: 2 }],
  phrases: {
    X: [[0, 'D5', 1.5, 0.6], [1.5, 'Bb4', 1.5, 0.5], [3, 'G4', 1, 0.55], [4, 'Bb4', 0.5, 0.5], [4.5, 'Eb5', 1.5, 0.6],
        [6, 'F5', 1.5, 0.55], [7.5, 'Db5', 1, 0.5], [8.5, 'C5', 0.5, 0.45], [9, 'Bb4', 3, 0.5]],
    Y: [[0, 'G4', 1.5, 0.55], [1.5, 'Bb4', 1.5, 0.55], [3, 'G4', 1.5, 0.5], [4.5, 'Eb4', 1.5, 0.5],
        [6, 'F4', 1.5, 0.5], [7.5, 'Ab4', 1.5, 0.55], [9, 'F#4', 1.5, 0.5], [10.5, 'D#4', 1.5, 0.45]],
  },
  parts: [
    { name: 'guitar', instrument: 'nylon-guitar', chordVoice: 'arp', rhythm: 'lilt', vel: 0.6, octave: 3, send: 0.18 },
    { name: 'pedal', instrument: 'cello', chordVoice: 'pedal', bars: [2, 24], hold: 1, vel: 0.3 },
    { name: 'clarinet', instrument: 'clarinet', form: form('X', 4, 20) },
    { name: 'oboe', instrument: 'oboe', form: form('Y', 8, 12) },
    { name: 'perc', instrument: 'orchestral-perc', groove: { style: 'travel', bars: [4, 16] } },
  ],
  export: NORMALIZE,
});

// ── village: idle routine. F major, the quiet-menu chart (I IV ii bVII7: home is never closed by V); a
// pizzicato boom-chick, a clarinet tune answered by the bassoon, a flute's long notes on the last pass.
const village = (seed) => ({
  kind: 'beats-composition', title: 'Market Morning', bpm: 100, seed, key: 'F',
  band: 'orchestra-pastoral',
  progression: [{ chords: 'I IV ii bVII7', repeat: 4 }],
  phrases: {
    T: [[0, 'C5', 1, 0.55], [1, 'A4', 0.5, 0.5], [1.5, 'Bb4', 0.5, 0.45], [2, 'C5', 1, 0.55], [3, 'F5', 1, 0.6],
        [4, 'D5', 1.5, 0.55], [5.5, 'C5', 0.5, 0.45], [6, 'Bb4', 1, 0.5], [7, 'F4', 1, 0.5],
        [8, 'G4', 1, 0.5], [9, 'Bb4', 1, 0.5], [10, 'D5', 1.5, 0.55], [11.5, 'C5', 0.5, 0.45],
        [12, 'Bb4', 1, 0.5], [13, 'G4', 1, 0.5], [14, 'Eb5', 2, 0.55]],
    U: [[0, 'F3', 2, 0.55], [2, 'A3', 1, 0.5], [3, 'C4', 1, 0.5], [4, 'Bb3', 1.5, 0.55], [5.5, 'A3', 0.5, 0.45], [6, 'G3', 1, 0.5], [7, 'F3', 1, 0.5],
        [8, 'G3', 2, 0.5], [10, 'D3', 2, 0.5], [12, 'Eb3', 1, 0.5], [13, 'G3', 1, 0.5], [14, 'Bb3', 1, 0.5], [15, 'Db4', 1, 0.5]],
    L: [[0, 'A5', 2, 0.45], [2, 'F5', 2, 0.42], [4, 'D5', 4, 0.42], [8, 'Bb5', 4, 0.42], [12, 'G5', 4, 0.4]],
  },
  parts: [
    { name: 'bass', instrument: 'contrabass', chordVoice: 'root-fifth', art: 'pizz', vel: 0.55 },
    { name: 'chick', instrument: 'violin-2', chordVoice: 'upper', rhythm: 'backbeat', art: 'pizz', vel: 0.45, octave: 4, bars: [2, 16] },
    { name: 'clarinet', instrument: 'clarinet', form: form('T', 4, 12) },
    { name: 'bassoon', instrument: 'bassoon', form: form('U', 8) },
    { name: 'flute', instrument: 'flute', form: form('L', 12) },
  ],
  export: NORMALIZE,
});

// ── forest: a chapel in the woods. E Dorian (the raised sixth: i IV), slow; the harp alone, then a soft pedal,
// a flute, distant strings swelling, rare glockenspiel glints; the oboe brings it home over IV–i.
const forest = (seed) => ({
  kind: 'beats-composition', title: 'Chapel in the Wood', bpm: 72, seed, key: 'Em',
  band: 'orchestra-pastoral',
  progression: [{ chords: 'i IV i IV', repeat: 2 }, { chords: 'bIII bVII IV i', repeat: 2 }],
  phrases: {
    F: [[0, 'B4', 2, 0.5], [2, 'E5', 2, 0.55], [4, 'C#5', 3, 0.55], [7, 'B4', 1, 0.45], [8, 'G4', 2, 0.5], [10, 'A4', 1, 0.45], [11, 'B4', 1, 0.5], [12, 'F#4', 4, 0.45]],
    G: [[0, 'B4', 2, 0.5], [2, 'D5', 2, 0.5], [4, 'A4', 2, 0.5], [6, 'F#4', 2, 0.45], [8, 'E4', 2, 0.5], [10, 'C#5', 2, 0.5], [12, 'B4', 4, 0.45]],
    glint: [[0, 'B6', 1, 0.3]],
  },
  parts: [
    { name: 'harp', instrument: 'harp', chordVoice: 'arp', arp: 'updown', rhythm: '8ths', vel: 0.45, octave: 3 },
    { name: 'pedal', instrument: 'cello', chordVoice: 'pedal', bars: [2, 16], hold: 1, vel: 0.3 },
    { name: 'flute', instrument: 'flute', form: form('F', 4) },
    { name: 'strings', instrument: 'violin-2', chordVoice: 'upper', rhythm: 'whole', hold: 0.9, vel: 0.4, octave: 4, bars: [8, 16],
      dynamics: [{ at: '8:0:0', to: 'pp' }, { at: '9:0:0', to: 'p', over: '3:0:0' }, { at: '13:0:0', to: 'pp', over: '3:0:0' }] },
    { name: 'oboe', instrument: 'oboe', form: form('G', 12) },
    { name: 'glock', instrument: 'glockenspiel', form: form('glint', 6, 10) },
  ],
  export: NORMALIZE,
});

// ── adventurous fields: the same country when the road gets dangerous. Motion (a light ostinato or riff, low
// brass on the downbeat at mp), a brass call answering the woodwinds, major flashes and modal turns rather than
// battle tension, a gear change between sections; still layered, still under forte.

// highlands: wind over open ground, something on the ridge. D minor whose tonic flips to major (i I bVII bVI iv),
// then a Phrygian stretch (i bII); a cello riff alone, a clarinet tune, the oboe through the danger, horns
// doubling the tune an octave down on its return.
const highlands = (seed) => ({
  kind: 'beats-composition', title: 'Ridge Wind', bpm: 104, seed, key: 'Dm',
  band: 'orchestra-field',
  progression: [{ chords: 'i i' }, { chords: 'i I bVII bVI iv bVI bVII bVII' }, { chords: 'i bII i bVII', repeat: 2 }, { chords: 'i I bVII bVI iv bVI bVII bVII' }],
  phrases: {
    M: [[0, 'A4', 1.5, 0.6], [1.5, 'D5', 0.5, 0.55], [2, 'F5', 1, 0.65], [3, 'E5', 1, 0.6], [4, 'F#5', 2, 0.7], [6, 'E5', 1, 0.6], [7, 'D5', 1, 0.55],
        [8, 'E5', 1.5, 0.6], [9.5, 'D5', 0.5, 0.55], [10, 'C5', 1, 0.55], [11, 'G4', 1, 0.55], [12, 'D5', 2, 0.6], [14, 'F5', 2, 0.65],
        [16, 'G5', 1.5, 0.7], [17.5, 'F5', 0.5, 0.6], [18, 'D5', 1, 0.6], [19, 'Bb4', 1, 0.55], [20, 'D5', 1.5, 0.6], [21.5, 'C5', 0.5, 0.55], [22, 'Bb4', 2, 0.55],
        [24, 'C5', 1, 0.6], [25, 'E5', 1, 0.6], [26, 'G5', 2, 0.65], [28, 'E5', 4, 0.55]],
    P: [[0, 'A4', 2, 0.6], [2, 'F4', 2, 0.55], [4, 'G4', 2, 0.6], [6, 'Bb4', 2, 0.65], [8, 'A4', 3, 0.6], [11, 'D5', 1, 0.6], [12, 'C5', 2, 0.6], [14, 'E5', 2, 0.65],
        [16, 'F5', 2, 0.65], [18, 'D5', 2, 0.6], [20, 'Eb5', 2, 0.7], [22, 'Bb4', 2, 0.6], [24, 'A4', 2, 0.6], [26, 'F4', 2, 0.55], [28, 'E4', 2, 0.6], [30, 'G4', 2, 0.6]],
  },
  parts: [
    { name: 'riff', instrument: 'cello', chordVoice: 'octaves', rhythm: '8ths', art: 'staccato', vel: 0.5, octave: 2 },
    { name: 'strings', instrument: 'violin-2', chordVoice: 'upper', rhythm: 'whole', hold: 0.9, vel: 0.45, octave: 4, bars: [6, 26],
      dynamics: [{ at: '6:0:0', to: 'pp' }, { at: '8:0:0', to: 'mp', over: '4:0:0' }, { at: '22:0:0', to: 'p', over: '4:0:0' }] },
    { name: 'clarinet', instrument: 'clarinet', form: [{ phrase: 'M', at: '2:0:0' }, { phrase: 'M', at: '18:0:0' }] },
    { name: 'oboe', instrument: 'oboe', form: [{ phrase: 'P', at: '10:0:0' }] },
    { name: 'horns', instrument: 'french-horn', form: [{ phrase: 'M', at: '18:0:0', transpose: -12, vel: 0.85 }] },
    { name: 'timp', instrument: 'timpani', events: [['9:3:0', 'A2', '0:0:2', 0.55], ['9:3:2', 'A2', '0:0:2', 0.6], ['10:0:0', 'D2', '0:2:0', 0.7], ['17:3:0', 'A2', '0:0:2', 0.55], ['17:3:2', 'A2', '0:0:2', 0.6], ['18:0:0', 'D2', '0:2:0', 0.7]] },
    { name: 'perc', instrument: 'orchestral-perc', groove: { style: 'travel', bars: [2, 26] } },
  ],
  export: NORMALIZE,
});

// expedition: a column on the move. E minor, the Aeolian loop with no leading tone (i bVII bVI bVII); string
// eighths alone, then tuba on the half bar, a dotted horn call answered by the oboe; the middle section a major
// third up (the gear change), a roll into each section, home again for the loop.
const expedition = (seed) => ({
  kind: 'beats-composition', title: 'Long Column', bpm: 112, seed, key: 'Em',
  band: 'orchestra-field',
  progression: [{ chords: 'i bVII bVI bVII', repeat: 6 }],
  modulate: [{ at: '8:0:0', semitones: 4 }, { at: '16:0:0', semitones: -4 }],
  phrases: {
    H: [[0, 'E4', 0.75, 0.65], [0.75, 'E4', 0.25, 0.55], [1, 'B4', 1, 0.7], [2, 'A4', 0.75, 0.6], [2.75, 'G4', 0.25, 0.55], [3, 'F#4', 1, 0.6],
        [4, 'D4', 0.75, 0.6], [4.75, 'F#4', 0.25, 0.55], [5, 'A4', 1.5, 0.65], [6.5, 'G4', 0.5, 0.55], [7, 'F#4', 1, 0.6],
        [8, 'G4', 0.75, 0.65], [8.75, 'G4', 0.25, 0.55], [9, 'E4', 1, 0.6], [10, 'C5', 1.5, 0.7], [11.5, 'B4', 0.5, 0.6], [12, 'A4', 2, 0.65], [14, 'F#4', 2, 0.55]],
    O: [[0, 'B4', 1.5, 0.6], [1.5, 'A4', 0.5, 0.5], [2, 'G4', 1, 0.55], [3, 'E4', 1, 0.55], [4, 'F#4', 1.5, 0.55], [5.5, 'G4', 0.5, 0.5], [6, 'A4', 2, 0.6],
        [8, 'G4', 1, 0.55], [9, 'E5', 2, 0.65], [11, 'D5', 1, 0.6], [12, 'C5', 1, 0.55], [13, 'B4', 1, 0.55], [14, 'A4', 2, 0.55]],
  },
  parts: [
    { name: 'strings', instrument: 'violin-2', chordVoice: 'upper', rhythm: '8ths', art: 'staccato', vel: 0.48, octave: 4 },
    { name: 'tuba', instrument: 'tuba', chordVoice: 'root', rhythm: 'half', vel: 0.5, octave: 2, bars: [2, 24] },
    { name: 'horn', instrument: 'french-horn', form: [{ phrase: 'H', at: '4:0:0' }, { phrase: 'H', at: '12:0:0' }, { phrase: 'H', at: '20:0:0' }] },
    { name: 'oboe', instrument: 'oboe', form: [{ phrase: 'O', at: '8:0:0' }, { phrase: 'O', at: '16:0:0' }] },
    { name: 'timp', instrument: 'timpani', events: [['7:3:0', 'B2', '0:0:2', 0.55], ['7:3:2', 'B2', '0:0:2', 0.6], ['8:0:0', 'E2', '0:2:0', 0.7], ['15:3:0', 'G2', '0:0:2', 0.55], ['15:3:2', 'G2', '0:0:2', 0.6], ['16:0:0', 'E2', '0:2:0', 0.7]] },
    { name: 'perc', instrument: 'orchestral-perc', groove: [
      { style: 'processional', bars: [4, 7], vel: 0.6 }, { style: 'processional', bars: [7, 8], fills: 'section', fill: 'long-roll', vel: 0.55 },
      { style: 'processional', bars: [8, 15], vel: 0.6 }, { style: 'processional', bars: [15, 16], fills: 'section', fill: 'long-roll', vel: 0.55 },
      { style: 'processional', bars: [16, 24], vel: 0.6 }] },
  ],
  export: NORMALIZE,
});

// wayfarer: a friendly road with a spring in it, festive rather than tense. G Mixolydian, a pizzicato boom-chick
// alone, a light snare cadence, a dotted tune passed flute → trumpet → clarinet → flute, the middle a fifth up,
// the horn doubling the last pass.
const wayfarer = (seed) => ({
  kind: 'beats-composition', title: 'Wayfarer', bpm: 120, seed, key: 'G',
  band: 'orchestra-field',
  progression: [{ chords: 'I bVII IV I', repeat: 6 }],
  modulate: [{ at: '8:0:0', semitones: 7 }, { at: '16:0:0', semitones: -7 }],
  phrases: {
    W: [[0, 'D5', 0.75, 0.6], [0.75, 'B4', 0.25, 0.5], [1, 'G4', 0.5, 0.55], [1.5, 'B4', 0.5, 0.55], [2, 'D5', 1, 0.6], [3, 'G5', 1, 0.65],
        [4, 'F5', 0.75, 0.6], [4.75, 'E5', 0.25, 0.5], [5, 'D5', 0.5, 0.55], [5.5, 'C5', 0.5, 0.55], [6, 'A4', 2, 0.6],
        [8, 'G4', 0.75, 0.55], [8.75, 'A4', 0.25, 0.5], [9, 'C5', 1, 0.6], [10, 'E5', 1, 0.6], [11, 'G5', 1, 0.65], [12, 'B4', 1.5, 0.6], [13.5, 'A4', 0.5, 0.5], [14, 'G4', 2, 0.55]],
  },
  parts: [
    { name: 'bass', instrument: 'contrabass', chordVoice: 'root-fifth', art: 'pizz', vel: 0.55 },
    { name: 'chick', instrument: 'violin-2', chordVoice: 'upper', rhythm: 'push', art: 'staccato', vel: 0.42, octave: 4, bars: [2, 24] },
    { name: 'flute', instrument: 'flute', form: [{ phrase: 'W', at: '4:0:0' }, { phrase: 'W', at: '20:0:0' }] },
    { name: 'trumpet', instrument: 'trumpet', form: [{ phrase: 'W', at: '8:0:0', transpose: -12 }] },
    { name: 'clarinet', instrument: 'clarinet', form: [{ phrase: 'W', at: '12:0:0', transpose: -12 }] },
    { name: 'horn', instrument: 'french-horn', form: [{ phrase: 'W', at: '20:0:0', transpose: -12, vel: 0.8 }] },
    { name: 'timp', instrument: 'timpani', events: [['7:3:0', 'D3', '0:1:0', 0.55], ['8:0:0', 'G2', '0:2:0', 0.65], ['15:3:0', 'D3', '0:1:0', 0.55], ['16:0:0', 'G2', '0:2:0', 0.65]] },
    { name: 'perc', instrument: 'orchestral-perc', groove: { style: 'march', bars: [4, 24], vel: 0.4, fills: 'every-4' } },
  ],
  export: NORMALIZE,
});

/**
 * Each mood, its energy and its base seed (the auditioned take). `idyllic`: the country at rest; `adventurous`:
 * the same country when the road gets dangerous (more motion, brass, mezzo forte at most). A new mood is a row here.
 */
export const FIELD_MOODS = {
  plains: { build: plains, base: 5, energy: 'idyllic' },
  desert: { build: desert, base: 31, energy: 'idyllic' },
  village: { build: village, base: 17, energy: 'idyllic' },
  forest: { build: forest, base: 43, energy: 'idyllic' },
  highlands: { build: highlands, base: 23, energy: 'adventurous' },
  expedition: { build: expedition, base: 61, energy: 'adventurous' },
  wayfarer: { build: wayfarer, base: 13, energy: 'adventurous' },
};

/** A field mood as a beats recipe; the seed moves its dice (seed 1 = the auditioned take). */
export function fieldSoundtrack(mood, seed = 1) {
  const M = FIELD_MOODS[mood];
  if (!M) throw new Error(`field-moods: no mood '${mood}' — the moods: ${Object.keys(FIELD_MOODS).join(', ')}`);
  const s = Number.isInteger(seed) ? seed : 1;
  return M.build((M.base + (s - 1) * 7919) >>> 0);
}
