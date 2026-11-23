/**
 * More of the instrument shelf recorded, note by note (the sound library's instruments, zoned by their takes' measured
 * roots: pitch.js, beats-kernel.js sampleZone), and the low registers the band's guitar and slap bass missed.
 *
 * A note is asked by its letter and its register in words (the letter lands, the octave follows the words: keys-spike.js);
 * a fretted instrument's low notes by STRING AND FRET ("the low E string at the 5th fret"), the way a player names a pitch,
 * since the guitar's and the slap bass's low asks in words never came below the middle. Held instruments (bowed, blown)
 * are asked with no vibrato, so they loop on their measured periods; the synthesized patch's vibrato is laid over the take
 * (audio-patches.js: its `vibrato` carried as a pitch lfo). Two takes a note.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const ORD = (n) => (n === 0 ? 'open' : `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} fret`);
const card = (inst, id, prompt, seconds, held, tag) => ({ id, band: `${inst}:${tag}`, instrument: inst, role: 'instrument', ...(held ? { sustain: true } : {}), prompt, seconds, influence: 0.85, loop: false, takes: 2, tags: ['instrument', inst, tag] });
const END = 'solo, one note only, no chord, no music, no voice';

// by letter and register in words
const registered = (inst, what, registers, seconds, { held = false, how = 'struck once and left to ring', vel } = {}) => registers.flatMap(([octave, words]) => LETTERS.map((name) =>
  ({ ...card(inst, `${inst}-${name.replace('#', 's')}${octave}`, `a single ${what} note, ${words}, the note ${name}${octave} (${HZ(name, octave)} Hz), ${how}, ${END}`, seconds, held, `${name}${octave}`), ...(vel ? { vel } : {}) })));
// by string and fret: the string's open note and twelve frets up it
const fretted = (inst, what, strings, seconds, how = 'picked once and left to ring') => strings.flatMap(([string, open]) => [...Array(12).keys()].map((f) => {
  const m = LETTERS.indexOf(open.slice(0, -1)) + 12 * (Number(open.slice(-1)) + 1) + f, name = LETTERS[m % 12], octave = Math.floor(m / 12) - 1;
  return card(inst, `${inst}-${string}-f${f}`, `a single note on the ${string === 'E' ? 'low E' : string} string of a ${what}, at the ${ORD(f)}, the note ${name}${octave} (${HZ(name, octave)} Hz), ${how}, ${END}`, seconds, false, `${name}${octave}`);
}));

export const CARDS = [
  // the band's low registers, again, by string and fret
  ...fretted('guitar', 'clean electric guitar, direct input with no amp, no distortion and no effects', [['E', 'E2']], 3),
  ...fretted('slap-bass', 'electric bass guitar slapped with the thumb', [['E', 'E1'], ['A', 'A1']], 2, 'slapped once, a funky percussive attack'),
  // guitars
  ...fretted('acoustic-guitar', 'steel-string acoustic guitar', [['E', 'E2']], 3),
  ...registered('acoustic-guitar', 'steel-string acoustic guitar', [[3, 'in the middle of the neck']], 3, { how: 'picked once and left to ring' }),
  ...fretted('nylon-guitar', 'nylon-string classical guitar', [['E', 'E2']], 3, 'plucked once with the fingers and left to ring'),
  ...registered('nylon-guitar', 'nylon-string classical guitar', [[3, 'in the middle of the neck']], 3, { how: 'plucked once with the fingers and left to ring' }),
  // keys and harp
  // (asked at no strength, heard as medium: its soft and hard layers are cards/layers.js)
  ...registered('rhodes', 'Rhodes electric piano', [[3, 'in its low register, warm'], [4, 'in its middle register, bell-like']], 3, { vel: 0.65 }),
  ...registered('harp', 'concert harp', [[3, 'in its low register, warm and round'], [5, 'in its upper register, bright and clear']], 3, { how: 'plucked once and left to ring', vel: 0.65 }),
  // mallets
  ...registered('marimba', 'marimba', [[3, 'in its low register, deep and woody'], [4, 'in its middle register']], 2, { vel: 0.65 }),
  ...registered('xylophone', 'xylophone', [[5, 'in its middle register, bright and woody'], [6, 'in its upper register']], 1.5),
  ...registered('glockenspiel', 'glockenspiel', [[6, 'in its middle register, a bright metal bell'], [7, 'high in its upper register, a tiny bright bell']], 2),
  // the upright bass, by string and fret
  ...fretted('upright-bass', 'upright acoustic double bass', [['E', 'E1'], ['A', 'A1']], 2.5, 'plucked once with the finger, jazz pizzicato'),
  // bowed and blown, held: no vibrato, so the take loops; the synthesized vibrato is laid over it
  // (the violin's first pass, by register in words: set aside, its upper register an octave low and its character not
  // the violin recorded by string and position, cards/repass.js)
  ...registered('violin', 'violin', [[4, 'on its lower strings'], [5, 'on its upper strings']], 4, { held: true, how: 'bowed and held steady at one pitch with no vibrato' }).map((c) => ({ ...c, instrument: 'violin-set-aside' })),
  ...registered('cello', 'cello', [[2, 'on its low strings, deep and rich'], [3, 'in its middle register']], 4, { held: true, how: 'bowed and held steady at one pitch with no vibrato' }),
  ...registered('flute', 'concert flute', [[4, 'in its low register, breathy'], [5, 'in its middle register, clear']], 3, { held: true, how: 'blown and held steady at one pitch with no vibrato' }),
  ...registered('trumpet', 'trumpet', [[3, 'in its low register'], [4, 'in its middle register, bright']], 3, { held: true, how: 'blown and held steady at one pitch with no vibrato' }),
];
