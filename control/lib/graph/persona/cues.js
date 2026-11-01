/**
 * cues — a read's CUE SHEET: what an editor, an engine or an animator hangs on the read's clock, as one JSON beside its
 * captions. The lines and their words (stressed or not), where the reader looks and when, the body's gestures, and the
 * clips the export carries for it (the face's `face:<id>` where the face is drawn, else none: fidelity.js).
 *
 *   cueSheet(id, read, { face }) → { id, register, seconds, clips: { face }, lines, words, gaze, body }
 *
 * Pure and deterministic.
 */
import { READ_GAZE } from './read.js';

/** the reader's look at each beat that moves it: [{ t, target }] (`lens` | `notes` | `away`, read.js READ_GAZE) */
function gazeCues(read) {
  const out = [], names = Object.entries(READ_GAZE);
  for (const b of read.beats) {
    const target = names.find(([, g]) => g === b.gaze)?.[0] ?? 'lens';
    if (out.at(-1)?.target !== target) out.push({ t: b.at, target });
  }
  return out;
}

export function cueSheet(id, read, { face = false } = {}) {
  return {
    id, register: read.register, seconds: read.seconds,
    clips: { face: face ? `face:${id}` : null },
    lines: read.lines.map((L) => ({ at: L.at, end: L.end, text: L.text, ...(L.aside ? { aside: true } : {}) })),
    words: read.lines.flatMap((L) => L.words.map((w) => ({ w: w.w, t: w.t, dur: w.dur, ...(w.emph ? { emph: true } : {}) }))),
    gaze: gazeCues(read),
    body: read.body.map((b) => ({ ...b })),
  };
}
