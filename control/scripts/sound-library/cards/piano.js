/**
 * The recorded PIANO, note by note (the sound library's instrument `piano`): a grand piano's notes, struck once and left
 * to ring. Each is asked by its letter and its register in words (the generator lands on the letter within a few cents
 * and on the octave by chance, keys-spike.js), and conditioning measures each take's real root (pitch.js), so the
 * instrument is zoned by what each take is (beats-kernel.js sampleZone; audio-patches.js pianoRec). A piano is not
 * looped: a note rings out as its take does, and its damper ends it when the key is let go.
 *
 * Twelve letters in each of three registers, the low asked in the left hand's words; two takes each.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const REGISTERS = [
  [2, 'a low bass note in the lower register, played by the left hand, deep and resonant'],
  [4, 'in the middle register, near middle C'],
  [5, 'a bright treble note in the upper register'],
];
const note = (name, octave, register) => ({
  id: `piano-${name.replace('#', 's')}${octave}`, band: `piano:${name}${octave}`, instrument: 'piano', role: 'instrument', vel: 0.65,
  prompt: `a single grand piano note, ${register}, the note ${name}${octave} (${HZ(name, octave)} Hz), struck once at medium velocity and left to ring, solo, one note only, no chord, no music, no voice`,
  seconds: 4, influence: 0.85, loop: false, takes: 2, tags: ['instrument', 'piano', `${name}${octave}`],
});

export const CARDS = REGISTERS.flatMap(([octave, words]) => LETTERS.map((n) => note(n, octave, words)));
