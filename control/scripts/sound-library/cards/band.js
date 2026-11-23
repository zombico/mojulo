/**
 * The robot band's PITCHED instruments recorded, note by note (beats-vocab/beats-robot-rock.md's band: its colour
 * instruments and its bass), each an instrument of the sound library zoned by its takes' measured roots (pitch.js;
 * beats-kernel.js sampleZone): the celesta, the vibraphone (its motor off: the patch's tremolo is laid over it), the
 * steel drum and the picked bass, each struck once and left to ring. Each note is asked by its letter and its register
 * in words (keys-spike.js: the letter lands, the octave follows the words), two registers an instrument, two takes a
 * note. Patches: audio-patches.js celestaRec, vibraphoneRec, steelpanRec, bassPickRec.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const instrument = (inst, what, registers, seconds = 2.5) => registers.flatMap(([octave, words]) => LETTERS.map((name) => ({
  id: `${inst}-${name.replace('#', 's')}${octave}`, band: `${inst}:${name}${octave}`, instrument: inst, role: 'instrument',
  prompt: `a single ${what} note, ${words}, the note ${name}${octave} (${HZ(name, octave)} Hz), struck once and left to ring, solo, one note only, no chord, no music, no voice`,
  seconds, influence: 0.85, loop: false, takes: 2, tags: ['instrument', inst, `${name}${octave}`],
})));

export const CARDS = [
  ...instrument('celesta', 'celesta', [[5, 'in its middle register, a soft bell-like chime'], [6, 'high in its upper register, a bright twinkling chime']]),
  ...instrument('vibraphone', 'vibraphone, motor off, struck with soft mallets', [[3, 'in its low register, warm and mellow'], [4, 'in its middle register']], 3),
  ...instrument('steelpan', 'tenor steel pan (steel drum)', [[4, 'in its middle register'], [5, 'in its upper register, bright']]),
  ...instrument('bass', 'electric bass guitar, picked with a pick', [[1, 'a deep low note on the bottom strings'], [2, 'in its middle register']]),
];
