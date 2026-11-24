/**
 * The saxophones recorded, note by note (the sound library's instruments, zoned by their takes' measured roots: pitch.js):
 * the soprano, the alto, the tenor and the baritone, each in two registers asked in words, blown and held with no vibrato,
 * so each take loops on its measured periods; the synthesized patch's vibrato is laid over it (audio-patches.js recHeld).
 * One wording up each horn, so its two registers sound like one instrument (docs/sound-library.md). Two takes a note.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const HOW = 'blown and held steady at one pitch with no vibrato, a warm reedy tone, solo, one note only, no chord, no music, no voice';
const sax = (inst, what, registers) => registers.flatMap(([octave, words]) => LETTERS.map((name) => ({
  id: `${inst}-${name.replace('#', 's')}${octave}`, band: `${inst}:${name}${octave}`, instrument: inst, role: 'instrument', sustain: true,
  prompt: `a single ${what} note, ${words}, the note ${name}${octave} (${HZ(name, octave)} Hz), ${HOW}`,
  seconds: 3, influence: 0.85, loop: false, takes: 2, tags: ['instrument', 'saxophone', inst, `${name}${octave}`],
})));

// the ends the two registers did not reach (their takes landed about an octave and a half each), asked the same way
const fill = (inst, what, notes, words) => notes.map(([name, octave]) => {
  const [c] = sax(inst, what, [[octave, words]]).filter((x) => x.band === `${inst}:${name}${octave}`);
  return { ...c, id: `${inst}-fill-${name.replace('#', 's')}${octave}`, tags: [...c.tags, 'fill'] };
});
const run = (from, to) => { const out = []; for (let m = from; m <= to; m++) out.push([LETTERS[m % 12], Math.floor(m / 12) - 1]); return out; };
const MIDI = (n, o) => LETTERS.indexOf(n) + 12 * (o + 1);

export const CARDS = [
  ...sax('soprano-sax', 'soprano saxophone', [[4, 'in its low register'], [5, 'in its middle register']]),
  ...sax('alto-sax', 'alto saxophone', [[3, 'in its low register'], [4, 'in its middle register']]),
  ...sax('tenor-sax', 'tenor saxophone', [[3, 'in its low register'], [4, 'in its middle register']]),
  ...sax('baritone-sax', 'baritone saxophone', [[2, 'in its low register'], [3, 'in its middle register']]),
  ...fill('soprano-sax', 'soprano saxophone', run(MIDI('G#', 5), MIDI('D#', 6)), 'high in its upper register'),
  ...fill('alto-sax', 'alto saxophone', run(MIDI('C', 5), MIDI('G#', 5)), 'high in its upper register'),
  ...fill('tenor-sax', 'tenor saxophone', run(MIDI('G', 4), MIDI('E', 5)), 'high in its upper register'),
  ...fill('baritone-sax', 'baritone saxophone', run(MIDI('C#', 2), MIDI('F', 2)), 'at the very bottom of its range, deep and low'),
];
