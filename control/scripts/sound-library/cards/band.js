/**
 * The robot band's PITCHED instruments recorded, note by note (beats-vocab/beats-robot-rock.md's band), each an
 * instrument of the sound library zoned by its takes' measured roots (pitch.js; beats-kernel.js sampleZone): the
 * celesta, the vibraphone (its motor off: the patch's tremolo is laid over it), the steel drum and the picked bass,
 * struck once and left to ring; its guitars clean and dry (the amp is the part's chain, as the synthesized guitar's
 * is); its brass and strings held (looped on their measured periods); its slap bass. Each note is asked by its letter
 * and its register in words (keys-spike.js: the letter lands, the octave follows the words), two takes a note.
 * Patches: audio-patches.js RECORDED_TWINS.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const instrument = (inst, what, registers, seconds = 2.5, { held = false, how = 'struck once and left to ring' } = {}) => registers.flatMap(([octave, words]) => LETTERS.map((name) => ({
  id: `${inst}-${name.replace('#', 's')}${octave}`, band: `${inst}:${name}${octave}`, instrument: inst, role: 'instrument', ...(held ? { sustain: true } : {}),
  prompt: `a single ${what} note, ${words}, the note ${name}${octave} (${HZ(name, octave)} Hz), ${how}, solo, one note only, no chord, no music, no voice`,
  seconds, influence: 0.85, loop: false, takes: 2, tags: ['instrument', inst, `${name}${octave}`],
})));

export const CARDS = [
  ...instrument('celesta', 'celesta', [[5, 'in its middle register, a soft bell-like chime'], [6, 'high in its upper register, a bright twinkling chime']]),
  ...instrument('vibraphone', 'vibraphone, motor off, struck with soft mallets', [[3, 'in its low register, warm and mellow'], [4, 'in its middle register']], 3).map((c) => ({ ...c, vel: 0.65 })),
  ...instrument('steelpan', 'tenor steel pan (steel drum)', [[4, 'in its middle register'], [5, 'in its upper register, bright']]),
  ...instrument('bass', 'electric bass guitar, picked with a pick', [[1, 'a deep low note on the bottom strings'], [2, 'in its middle register']]),
  // the rest of the band: its guitars recorded clean and dry (the band's amp, delay and room are its chain's, as the
  // synthesized guitar's are), its brass and its strings held (looped on their measured periods), its slap bass
  ...instrument('guitar', 'clean electric guitar, picked once, direct input with no amp, no distortion and no effects', [[2, 'low on the bottom strings'], [3, 'in the middle of the neck'], [4, 'high on the top strings']], 3),
  ...instrument('brass', 'brass section, trumpets and trombones in unison', [[3, 'in its low register, full and warm'], [4, 'in its middle register, bright']], 3, { held: true, how: 'played and held steady at one pitch' }),
  ...instrument('strings', 'string ensemble, violins and violas together', [[3, 'in its low register'], [4, 'in its middle register']], 4, { held: true, how: 'bowed and held steady at one pitch with no vibrato' }),
  ...instrument('slap-bass', 'electric bass guitar slapped with the thumb', [[1, 'a deep low note on the bottom strings'], [2, 'in its middle register']], 2, { how: 'slapped once, a funky percussive attack' }),
];
