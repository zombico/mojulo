/**
 * The orchestra recorded, note by note (the sound library's instruments, zoned by their takes' measured roots: pitch.js),
 * completing the sections the instrument shelf's orchestral patches play: the horns, the low brass, the viola and the
 * bowed contrabass, the woodwinds, and the timpani and tubular bells. Bowed and blown notes are asked with no vibrato, so
 * they loop on their measured periods (the synthesized patch's vibrato is laid over the take: audio-patches.js recHeld);
 * the timpani and the bells are struck and ring out. Letters and registers in words; the contrabass by string and fret,
 * as the fretted instruments are (cards/instruments.js). Two takes a note.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const END = 'solo, one note only, no chord, no music, no voice';
const card = (inst, id, prompt, seconds, held, tag) => ({ id, band: `${inst}:${tag}`, instrument: inst, role: 'instrument', ...(held ? { sustain: true } : {}), prompt, seconds, influence: 0.85, loop: false, takes: 2, tags: ['instrument', 'orchestra', inst, tag] });
const HOLD = { held: true, how: 'held steady at one pitch with no vibrato' };
const registered = (inst, what, registers, seconds, { held = false, how = 'struck once and left to ring' } = {}) => registers.flatMap(([octave, words]) => LETTERS.map((name) =>
  card(inst, `${inst}-${name.replace('#', 's')}${octave}`, `a single ${what} note, ${words}, the note ${name}${octave} (${HZ(name, octave)} Hz), ${how}, ${END}`, seconds, held, `${name}${octave}`)));
const bowedByString = (inst, what, strings, seconds) => strings.flatMap(([string, open]) => [...Array(12).keys()].map((f) => {
  const m = LETTERS.indexOf(open.slice(0, -1)) + 12 * (Number(open.slice(-1)) + 1) + f, name = LETTERS[m % 12], octave = Math.floor(m / 12) - 1;
  return card(inst, `${inst}-${string}-p${f}`, `a single note on the ${string} string of a ${what}, ${f === 0 ? 'the open string' : `stopped ${f} semitones up`}, the note ${name}${octave} (${HZ(name, octave)} Hz), bowed and held steady at one pitch with no vibrato, ${END}`, seconds, true, `${name}${octave}`);
}));

export const CARDS = [
  // brass
  ...registered('french-horn', 'French horn', [[3, 'in its low register, warm and round'], [4, 'in its middle register, noble and heroic']], 3, { ...HOLD, how: `blown and ${HOLD.how}` }),
  ...registered('trombone', 'tenor trombone', [[2, 'in its low register, dark and full'], [3, 'in its middle register']], 3, { ...HOLD, how: `blown and ${HOLD.how}` }),
  ...registered('tuba', 'tuba', [[1, 'in its deepest register, a huge low note'], [2, 'in its low register']], 3, { ...HOLD, how: `blown and ${HOLD.how}` }),
  // strings
  ...registered('viola', 'viola', [[3, 'on its low C and G strings, dark'], [4, 'on its upper strings']], 4, { ...HOLD, how: `bowed and ${HOLD.how}` }),
  ...bowedByString('contrabass', 'double bass played with the bow (arco)', [['E', 'E1'], ['A', 'A1']], 4),
  // woodwinds
  ...registered('clarinet', 'clarinet', [[3, 'in its low chalumeau register, dark and woody'], [4, 'in its middle register, clear']], 3, { ...HOLD, how: `blown and ${HOLD.how}` }),
  ...registered('oboe', 'oboe', [[4, 'in its low register, reedy'], [5, 'in its middle register, bright and nasal']], 3, { ...HOLD, how: `blown and ${HOLD.how}` }),
  ...registered('bassoon', 'bassoon', [[2, 'in its low register, deep and reedy'], [3, 'in its middle register']], 3, { ...HOLD, how: `blown and ${HOLD.how}` }),
  // percussion with pitch
  ...registered('timpani', 'orchestral timpani drum', [[2, 'a deep low kettle drum, the large drum'], [3, 'a higher kettle drum, the small drum']], 3, { how: 'struck once with soft mallets and left to ring' }),
  ...registered('tubular-bells', 'tubular bells (orchestral chimes)', [[4, 'in its low register, a deep church-like bell'], [5, 'in its upper register, a bright bell']], 4, { how: 'struck once with a hammer and left to ring' }),
];
