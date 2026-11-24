/**
 * A SPIKE: can a keyboard be recorded note by note? A few notes of a piano and of an organ, each asked at a named
 * pitch, to measure (scripts/sound-library/pitch.mjs) whether the generator lands on the pitch it was asked for, how
 * steady the note holds, and how far off it drifts: the root each sample would be zoned by. Not yet an instrument:
 * no shelf row or patch plays these.
 */

const NOTE_HZ = { C2: 65.41, C3: 130.81, A3: 220, C4: 261.63, A4: 440, C5: 523.25 };
const piano = (n) => ({ id: `keys-piano-${n}`, band: `keys-spike-piano:${n}`, role: 'instrument', prompt: `a single grand piano note, ${n} (${NOTE_HZ[n]} Hz), struck once at medium velocity and left to ring, solo, dry, no other notes, no music, no voice`, seconds: 2.5, influence: 0.8, loop: false, takes: 2, tags: ['keys', 'piano', n] });
const organ = (n) => ({ id: `keys-organ-${n}`, band: `keys-spike-organ:${n}`, role: 'instrument', prompt: `a single sustained pipe organ note, ${n} (${NOTE_HZ[n]} Hz), held steady at one pitch, solo, no other notes, no music, no voice`, seconds: 3, influence: 0.8, loop: false, takes: 2, tags: ['keys', 'organ', n] });

export const CARDS = [...['C3', 'A3', 'C4', 'A4', 'C5'].map(piano), ...['C3', 'C4', 'C5'].map(organ)];
export const ASKED_HZ = NOTE_HZ;
