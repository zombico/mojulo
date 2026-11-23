/**
 * REPASSES by string and position, for instruments whose registers asked in words never landed (pitch.js measured
 * them, YIN agreed): the violin's upper strings came back an octave low (nothing above B4, so a melody at E5 was a take
 * bent up an octave: thin and screechy), and the erhu came back on its open strings whatever note was asked. A bowed
 * note is asked as a player names it: the string, and how far up it it is stopped, with the note and its frequency.
 * Held with no vibrato (each loops; the synthesized vibrato is laid over it). Two takes a note.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const END = 'solo, one note only, no chord, no music, no voice';
const bowed = (inst, what, string, open, from, to, seconds = 4) => [...Array(to - from + 1).keys()].map((k) => {
  const f = from + k, m = LETTERS.indexOf(open.slice(0, -1)) + 12 * (Number(open.slice(-1)) + 1) + f, name = LETTERS[m % 12], octave = Math.floor(m / 12) - 1;
  return {
    id: `${inst}-${string.replace(/\s+/g, "")}-p${f}`, band: `${inst}:${name}${octave}`, instrument: inst, role: 'instrument', sustain: true,
    prompt: `a single note on the ${string} string of a ${what}, ${f === 0 ? 'the open string' : `stopped ${f} semitones up the string`}, the note ${name}${octave} (${HZ(name, octave)} Hz), bowed and held steady at one pitch with no vibrato, ${END}`,
    seconds, influence: 0.85, loop: false, takes: 2, tags: ['instrument', inst, 'repass', `${name}${octave}`],
  };
});

export const CARDS = [
  // the violin's upper register: up its highest string, and the A string below it
  ...bowed('violin', 'violin (the highest string, bright and singing)', 'E', 'E5', 0, 14),
  ...bowed('violin', 'violin', 'A', 'A4', 0, 6),
  // the erhu, up both its strings (inner D, outer A)
  ...bowed('erhu', 'Chinese erhu (two-string fiddle)', 'inner D', 'D4', 0, 11),
  ...bowed('erhu', 'Chinese erhu (two-string fiddle)', 'outer A', 'A4', 0, 11),
];
