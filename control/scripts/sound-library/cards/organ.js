/**
 * The recorded ORGAN, note by note (the sound library's instrument `organ`): an electric drawbar organ's held notes,
 * the robot band's colour organ recorded. Each note is asked by its letter (the generator lands on the letter within
 * a few cents and on the octave by chance, keys-spike.js), and conditioning measures each take's real root and its
 * loop (pitch.js), so the instrument is zoned by what each take is: a page plays each note on its nearest take, bent
 * the rest of the way, held on its loop (beats-kernel.js sampleZone; audio-patches.js organRec).
 *
 * Twelve letters in the middle register, four asked low, and twelve in the low register asked in the left hand's words;
 * two takes each. No vibrato, no Leslie swirl, no chord: a
 * note that wobbles or beats does not loop.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const note = (name, octave, register) => ({
  id: `organ-${name.replace('#', 's')}${octave}`, band: `organ:${name}${octave}`, instrument: 'organ', sustain: true, role: 'instrument',
  prompt: `a single held note on an electric drawbar organ, ${register}, the note ${name}${octave} (${HZ(name, octave)} Hz), steady at one pitch with no vibrato and no Leslie swirl, solo, one note only, no chord, no music, no voice`,
  seconds: 3.5, influence: 0.85, loop: false, takes: 2, tags: ['instrument', 'organ', `${name}${octave}`],
});

export const CARDS = [
  ...LETTERS.map((n) => note(n, 4, 'in the middle register')),
  ...['C', 'E', 'G', 'A#'].map((n) => note(n, 2, 'a deep low bass note')),
  // (the low register asked again in words, as the piano's was: its first asks came back an octave or two up)
  ...LETTERS.map((n) => note(n, 3, 'in its low register, a full warm low note played by the left hand')),
];
