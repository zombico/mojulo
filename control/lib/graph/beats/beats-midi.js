/**
 * beats-midi — render a beats manifest to a Standard MIDI File (the musician
 * handoff). Export-only, like every beats render: the recipe stays the source
 * of truth, the .mid is a deterministic derived artifact (same manifest +
 * options → the same bytes), never imported back.
 *
 * Built on the same pure seam as the WAV export: renderBeatsPlan lowers the
 * manifest to absolute-time note events with feel/swing/velocity already
 * applied — so the PERFORMANCE travels (a swung, humanized groove arrives
 * swung and humanized), not a quantized skeleton. What travels and what
 * doesn't:
 *   - travels: tempo, every note (pitch/onset/duration/velocity), track
 *     names, per-row `transpose` macros (rounded to semitones), drum hits.
 *   - doesn't: synthesis timbre (MIDI carries the score, not the sound —
 *     pair with the .wav), effects chains, `tone` macros, and pitch-swept
 *     foley gestures (sweep/flutter have no note identity; they're skipped
 *     with a note in the result).
 *   - beats-sfx is refused: a foley cue is choreography, not a score.
 *
 * Format 1 SMF: track 0 = tempo/meta, then one track per channel/part/track
 * in manifest order. Melodic rows get their own MIDI channel with a
 * best-guess General MIDI program (so the import sounds *roughly* right in a
 * DAW / MuseScore); drum-shaped rows (membrane/noise patches, thump/burst
 * gestures) land on MIDI channel 10 with GM percussion notes.
 */

import { PATCHES } from './audio-patches.js';
import { renderBeatsPlan } from './beats-render.js';

export const TICKS_PER_QUARTER = 480;

// ── note name → MIDI number ─────────────────────────────────────────────────
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midiNote(note) {
  if (typeof note === 'number') {
    // numeric notes are Hz in the beats dialect — snap to the nearest key.
    return Math.max(0, Math.min(127, Math.round(69 + 12 * Math.log2(note / 440))));
  }
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(note).trim());
  if (!m) throw new Error(`beats-midi: bad note name '${note}'`);
  let semi = SEMI[m[1].toUpperCase()];
  if (m[2] === '#') semi += 1;
  if (m[2] === 'b') semi -= 1;
  return Math.max(0, Math.min(127, (parseInt(m[3], 10) + 1) * 12 + semi));
}

// ── General MIDI best-guesses per patch (0-indexed program bytes) ───────────
// Approximation by design: the .mid should *read* right and sound roughly
// right on a GM synth; the true timbre ships in the .wav.
const GM_PROGRAM = {
  pad: 89,            // warm pad
  bassMono: 38,       // synth bass 1
  sinePluck: 108,     // kalimba
  chipLead: 80,       // square lead
  fmBell: 14,         // tubular bells
  sawStab: 81,        // saw lead
  guitarClean: 25, guitarNylon: 24, guitarMuted: 28, guitarLead: 29,
  guitarElectric: 27, guitarAmp: 30,
  violin: 40, viola: 41, cello: 42, contrabass: 43,
  trumpet: 56, frenchHorn: 60, trombone: 57, tuba: 58,
  shamisen: 106, erhu: 110,
  rhodes: 4, harpsichord: 6, clav: 7, piano: 0,
  celesta: 8, musicBox: 10, organ: 16, steelpan: 114,
};

// drum-shaped patches → GM percussion notes (channel 10).
const GM_DRUM_NOTE = { kick: 36, hat: 42, burstSoft: 38 };

function drumNoteForPatch(patchName) {
  if (GM_DRUM_NOTE[patchName] !== undefined) return GM_DRUM_NOTE[patchName];
  const p = PATCHES[patchName];
  if (!p) return null;
  if (p.voice === 'membrane') return 36;
  if (p.voice === 'noise') {
    const hp = p.filter && p.filter.mode === 'highpass' ? p.filter.freq : 0;
    return hp >= 4000 ? 42 : 38;
  }
  return null;
}

// a gesture-instrument hit → a GM percussion note (or null = unmappable).
function drumNoteForGestures(gestures) {
  const g = Array.isArray(gestures) ? gestures[0] : null;
  if (!g) return null;
  if (g.type === 'thump') return 36;
  if (g.type === 'burst') return (g.highpass || 0) >= 1000 ? 42 : 38;
  return null;   // sweep/flutter are pitched foley — no note identity.
}

// ── SMF byte plumbing ───────────────────────────────────────────────────────
function vlq(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

function meta(type, data) {
  return [0xff, type, ...vlq(data.length), ...data];
}

function textMeta(type, s) {
  return meta(type, [...Buffer.from(String(s), 'utf8')]);
}

function encodeTrack(events) {
  // events: [{ tick, data: [bytes] }] — sort by tick; at equal ticks put
  // note-offs (0x80) before note-ons so re-struck notes don't strangle.
  const sorted = [...events].sort((a, b) => a.tick - b.tick || (a.data[0] & 0xf0) - (b.data[0] & 0xf0));
  const bytes = [];
  let at = 0;
  for (const ev of sorted) {
    bytes.push(...vlq(Math.max(0, Math.round(ev.tick - at))), ...ev.data);
    at = Math.max(at, ev.tick);
  }
  bytes.push(...vlq(0), ...meta(0x2f, []));   // end of track
  const buf = Buffer.alloc(8 + bytes.length);
  buf.write('MTrk', 0);
  buf.writeUInt32BE(bytes.length, 4);
  Buffer.from(bytes).copy(buf, 8);
  return buf;
}

/**
 * renderBeatsMidi(manifest, opts) → { mid: Buffer, meta } — pure + deterministic.
 * opts: { bars? (ambient), loops? (pattern) } — same duration semantics as the
 * WAV render. beats-sfx throws (choreography, not a score).
 */
export function renderBeatsMidi(manifest, opts = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('beats-midi: manifest must be an object');
  if (manifest.kind === 'beats-sfx') {
    throw new Error('beats-midi: beats-sfx cues are foley choreography, not a score — export the .wav instead');
  }

  const plan = renderBeatsPlan(manifest, opts);
  const bpm = manifest.bpm;
  const tickOf = (seconds) => Math.max(0, Math.round(seconds * (bpm / 60) * TICKS_PER_QUARTER));
  const rows = manifest.channels || manifest.parts || manifest.tracks || [];

  // tempo/meta track.
  const usPerQuarter = Math.round(60000000 / bpm);
  const track0 = encodeTrack([
    { tick: 0, data: textMeta(0x03, manifest.title || 'mojulo beats') },
    { tick: 0, data: meta(0x51, [(usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff]) },
    { tick: 0, data: meta(0x58, [4, 2, 24, 8]) },   // 4/4
  ]);

  // one track per row, manifest order; melodic rows get channels 0.. (skipping
  // 10); drum-shaped rows share MIDI channel 10 (byte 9).
  const tracks = [track0];
  let nextMelodic = 0;
  let skippedGestureHits = 0;
  let noteCount = 0;

  for (const row of rows) {
    const entries = plan.entries.filter((e) => e.channel === row.name);
    const isGesture = !!(row.cue || row.gesture);
    const drumNote = isGesture ? drumNoteForGestures(row.cue || [row.gesture]) : drumNoteForPatch(row.patch);
    const events = [{ tick: 0, data: textMeta(0x03, row.name) }];
    let channel;
    if (drumNote !== null && drumNote !== undefined) {
      channel = 9;
    } else {
      channel = nextMelodic === 9 ? (nextMelodic = 10) : nextMelodic;
      nextMelodic += 1;
      const program = GM_PROGRAM[row.patch] ?? 0;
      events.push({ tick: 0, data: [0xc0 | channel, program] });
    }
    const transpose = Math.round(row.transpose || 0);
    for (const e of entries) {
      const vel = Math.max(1, Math.min(127, Math.round((e.vel == null ? 0.8 : e.vel) * 127)));
      if (e.type === 'cue') {
        if (drumNote === null || drumNote === undefined) { skippedGestureHits += 1; continue; }
        const on = tickOf(e.t);
        events.push({ tick: on, data: [0x90 | 9, drumNote, vel] });
        events.push({ tick: on + TICKS_PER_QUARTER / 4, data: [0x80 | 9, drumNote, 0] });
        noteCount += 1;
        continue;
      }
      const pitch = Math.max(0, Math.min(127, (channel === 9 && drumNote !== null ? drumNote : midiNote(e.note) + transpose)));
      const on = tickOf(e.t);
      const off = Math.max(on + 1, tickOf(e.t + e.dur));
      events.push({ tick: on, data: [0x90 | channel, pitch, vel] });
      events.push({ tick: off, data: [0x80 | channel, pitch, 0] });
      noteCount += 1;
    }
    tracks.push(encodeTrack(events));
  }

  const header = Buffer.alloc(14);
  header.write('MThd', 0);
  header.writeUInt32BE(6, 4);
  header.writeUInt16BE(1, 8);                    // format 1
  header.writeUInt16BE(tracks.length, 10);
  header.writeUInt16BE(TICKS_PER_QUARTER, 12);

  return {
    mid: Buffer.concat([header, ...tracks]),
    meta: {
      ...plan.meta,
      tracks: tracks.length - 1,
      notes: noteCount,
      duration_s: Number(plan.duration.toFixed(3)),
      ...(skippedGestureHits ? { skipped_gesture_hits: skippedGestureHits } : {}),
    },
  };
}
