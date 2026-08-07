/**
 * beats-song-melody — standard melodic data → the parametric singer's inputs
 * (the S1 melody-import seam of beats-song.plan.md).
 *
 * A melody authored anywhere (Hooktheory's clipboard export is the proven
 * source) arrives as scale-degree + octave rows in a key; this module decodes
 * them to MIDI numbers / note names so a song script carries only DATA and the
 * degree math lives in one tested place. Extracted verbatim from the
 * render-cyborg spike line (2026-07-15; retrospectives in beats-song.plan.md).
 *
 * Pure: no audio, no IO, no dice.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// scale degree → semitones above the tonic
export const MINOR_DEGREES = { 1: 0, 2: 2, 3: 3, 4: 5, 5: 7, 6: 8, 7: 10 }; // natural minor
export const MAJOR_DEGREES = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };

/**
 * '#6' / 'b3' / '5' → semitones above the tonic in the given mode.
 * Accidentals stack ('##4') exactly as Hooktheory emits them.
 */
export function degreeSemitone(sd, mode = 'minor') {
  const degrees = mode === 'major' ? MAJOR_DEGREES : MINOR_DEGREES;
  let acc = 0;
  let s = String(sd);
  while (s[0] === '#' || s[0] === 'b') { acc += s[0] === '#' ? 1 : -1; s = s.slice(1); }
  const base = degrees[Number(s)];
  if (base === undefined) throw new Error(`beats-song-melody: unknown scale degree '${sd}'`);
  return base + acc;
}

/** MIDI number → note name ('G4'), the octave convention noteHz expects. */
export function midiNoteName(midi) {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

/**
 * Compact melody rows → the object notes parseHooktheory takes. Row shape
 * `[beat, duration, sd, octave, isRest?]` (one-based beats, rest rows keep a
 * placeholder degree) — the shorthand the spike scripts settled on for
 * hand-carried melodies.
 */
export function fromRows(rows) {
  return rows.map(([beat, duration, sd, octave, isRest]) => ({
    beat, duration, sd, octave, isRest: !!isRest,
  }));
}

/**
 * Hooktheory-shaped notes → singable events. Each note
 * `{ beat, duration, sd, octave, isRest }` (beat one-based) becomes
 * `{ beat, beats, isRest }` + for sounding notes `{ midi, note }`.
 * Rests are KEPT (a sequential renderer needs them; an absolute-onset
 * renderer filters them) — beats stay beats; the caller owns the bpm.
 * @param {Array} notes
 * @param {object} [opts]  { tonicMidi=67 (G4), mode='minor' }
 */
export function parseHooktheory(notes, { tonicMidi = 67, mode = 'minor' } = {}) {
  return notes.map((nt) => {
    if (nt.isRest) return { beat: nt.beat, beats: nt.duration, isRest: true };
    const midi = tonicMidi + 12 * nt.octave + degreeSemitone(nt.sd, mode);
    return { beat: nt.beat, beats: nt.duration, isRest: false, midi, note: midiNoteName(midi) };
  });
}
