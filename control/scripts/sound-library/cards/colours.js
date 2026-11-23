/**
 * The SETTING COLOURS recorded, note by note: the instrument shelf's instruments that each stand for a place (a court's
 * harpsichord, a title screen's music box, the frontier's banjo and harmonica, East Asia's shamisen and erhu, the
 * country road's pedal steel), each zoned by its takes' measured roots (pitch.js). Plucked and struck ones ring out;
 * the harmonica and the erhu are held with no vibrato, so they loop, the synthesized vibrato laid over them
 * (audio-patches.js recHeld). Letters and registers in words; two takes a note.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const END = 'solo, one note only, no chord, no music, no voice';
const registered = (inst, what, registers, seconds, { held = false, how = 'struck once and left to ring' } = {}) => registers.flatMap(([octave, words]) => LETTERS.map((name) => ({
  id: `${inst}-${name.replace('#', 's')}${octave}`, band: `${inst}:${name}${octave}`, instrument: inst, role: 'instrument', ...(held ? { sustain: true } : {}),
  prompt: `a single ${what} note, ${words}, the note ${name}${octave} (${HZ(name, octave)} Hz), ${how}, ${END}`,
  seconds, influence: 0.85, loop: false, takes: 2, tags: ['instrument', 'colour', inst, `${name}${octave}`],
})));

export const CARDS = [
  ...registered('harpsichord', 'harpsichord', [[3, 'in its low register'], [4, 'in its middle register, bright and plucked']], 3, { how: 'a key pressed once, the string plucked and left to ring' }),
  ...registered('music-box', 'music box (a tuned steel comb)', [[5, 'in its middle register, a delicate chime'], [6, 'in its upper register, a tiny bright chime']], 2.5, { how: 'a single tine plucked once and left to ring' }),
  ...registered('banjo', 'five-string banjo', [[3, 'in its low register'], [4, 'in its middle register, bright and twangy']], 2, { how: 'picked once and left to ring' }),
  ...registered('harmonica', 'blues harmonica', [[4, 'in its low register'], [5, 'in its middle register, bright and reedy']], 3, { held: true, how: 'blown and held steady at one pitch with no vibrato and no bend' }),
  ...registered('shamisen', 'Japanese shamisen', [[3, 'in its low register'], [4, 'in its middle register, sharp and twangy']], 2, { how: 'struck once with the bachi plectrum and left to ring' }),
  ...registered('erhu', 'Chinese erhu (two-string fiddle)', [[4, 'in its low register, warm and nasal'], [5, 'in its upper register, singing']], 4, { held: true, how: 'bowed and held steady at one pitch with no vibrato and no slide' }),
  ...registered('pedal-steel', 'pedal steel guitar', [[3, 'in its low register'], [4, 'in its middle register, sweet and singing']], 4, { how: 'picked once and left to sustain at one pitch, no slide and no pedal bend' }),
];
