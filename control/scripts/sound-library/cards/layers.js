/**
 * VELOCITY LAYERS: the keys recorded again, soft and hard, so a note played gently is a gentle note (darker, rounder)
 * and one struck hard is a hard one (brighter, its hammer heard), not the same take turned down or up. Each card's `vel`
 * (0…1) is the strength it was asked at; the takes asked at medium carry 0.65 (cards/piano.js, cards/instruments.js).
 * The kernel plays each note on the take nearest it in pitch and in strength (beats-kernel.js sampleZone); its level
 * still follows the note's velocity. The piano in its three registers, the Rhodes, the harp, the marimba and the
 * vibraphone in their two; two takes a note.
 */

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const HZ = (name, octave) => Math.round(440 * Math.pow(2, (LETTERS.indexOf(name) + 12 * (octave + 1) - 69) / 12) * 100) / 100;
const STRENGTH = { soft: { vel: 0.3, how: 'played very softly, pianissimo, a gentle touch' }, hard: { vel: 0.95, how: 'struck hard, fortissimo, a forceful attack' } };
const layered = (inst, what, registers, seconds) => Object.entries(STRENGTH).flatMap(([layer, L]) => registers.flatMap(([octave, words]) => LETTERS.map((name) => ({
  id: `${inst}-${layer}-${name.replace('#', 's')}${octave}`, band: `${inst}:${name}${octave}`, instrument: inst, role: 'instrument', vel: L.vel,
  prompt: `a single ${what} note, ${words}, the note ${name}${octave} (${HZ(name, octave)} Hz), ${L.how}, left to ring, solo, one note only, no chord, no music, no voice`,
  seconds, influence: 0.85, loop: false, takes: 2, tags: ['instrument', inst, layer, `${name}${octave}`],
}))));

export const CARDS = [
  ...layered('piano', 'grand piano', [[2, 'a low bass note in the lower register, played by the left hand, deep and resonant'], [4, 'in the middle register, near middle C'], [5, 'a treble note in the upper register']], 4),
  ...layered('rhodes', 'Rhodes electric piano', [[3, 'in its low register, warm'], [4, 'in its middle register, bell-like']], 3),
  // the harp and the mallets: plucked or struck softly, a round dark note; hard, its attack bright and ringing
  ...layered('harp', 'concert harp', [[3, 'in its low register, warm and round'], [5, 'in its upper register, bright and clear']], 3),
  ...layered('marimba', 'marimba', [[3, 'in its low register, deep and woody'], [4, 'in its middle register']], 2),
  ...layered('vibraphone', 'vibraphone, motor off, struck with mallets', [[3, 'in its low register, warm and mellow'], [4, 'in its middle register']], 3),
];
