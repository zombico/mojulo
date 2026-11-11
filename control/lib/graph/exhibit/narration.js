/**
 * NARRATION: a stop's caption, spoken. The CAPTION IS THE TRUTH; the voice is a layer over it, optional, never the only
 * way a visitor gets the words: the page always shows the caption, and a stop with no voice (or a machine that does not
 * hold its recording) is simply quiet. A voice is a recording mojulo keeps (face-acting/recordings.js: content-addressed,
 * saved under the outcomes directory), made by whatever speaks: the optional Kokoro worker (docs/local-voice-worker.md:
 * `node speak.mjs --text "<the caption>" --out stop1.wav`), the driving agent's own speech, or a person reading it.
 *
 *   a stop's `narration`, as the door takes it:  'stop1.wav'  (everyone's)  or  { general?, child?, specialist? },
 *                                                  each a WAV's path or { audio: path }
 *   as the recipe keeps it:                        { general?: { recording, seconds }, child?: …, specialist?: … }
 *
 * stampNarration saves each WAV and keeps its id at WRITE (mint and update, before the world gate), so a stored recipe
 * never names a file. readNarration checks the kept form. voiceOf turns a held recording into the page's own audio: 16 kHz
 * 16-bit mono WAV inline (a third of Kokoro's 24 kHz), so an exported page stays one self-contained file.
 */
import { saveRecording, readRecording, decodeWav, RECORDING_ID } from '../face-acting/recordings.js';

export const NARRATED = Object.freeze(['general', 'child', 'specialist']);
export const VOICE_RATE = 16000;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// one audience's narration as the door takes it → as the recipe keeps it (a path saved as a recording)
function bindVoice(v, at) {
  const file = typeof v === 'string' ? v : isObj(v) && typeof v.audio === 'string' ? v.audio : null;
  if (file === null) return v;
  try {
    const rec = saveRecording(file);
    return { recording: rec.id, seconds: rec.seconds };
  } catch (err) {
    throw new Error(`tour: ${at} ${err.message.replace(/^recordings: /, '')}`);
  }
}

/** A manifest with every stop's narration bound (each WAV path saved as a recording, its id kept); the rest as given. */
export function stampNarration(manifest) {
  const stops = manifest?.tour?.stops;
  if (!Array.isArray(stops) || !stops.some((s) => s && s.narration !== undefined)) return manifest;
  const bound = stops.map((s, i) => {
    if (!s || s.narration === undefined) return s;
    const n = typeof s.narration === 'string' || (isObj(s.narration) && typeof s.narration.audio === 'string') ? { general: s.narration } : s.narration;
    if (!isObj(n)) return s;
    return { ...s, narration: Object.fromEntries(Object.entries(n).map(([a, v]) => [a, bindVoice(v, `stops[${i}].narration.${a}`)])) };
  });
  return { ...manifest, tour: { ...manifest.tour, stops: bound } };
}

/** A stop's kept narration, checked → { general?, child?, specialist? } of { recording, seconds }. */
export function readNarration(spec, at, fail) {
  if (!isObj(spec)) fail(at, "is { general?, child?, specialist? }, each a recording (give the door a WAV's path: it keeps the recording)");
  const bad = Object.keys(spec).filter((k) => !NARRATED.includes(k));
  if (bad.length) fail(at, `has '${bad[0]}' (it takes ${NARRATED.join(', ')})`);
  const out = {};
  for (const a of NARRATED) {
    if (spec[a] === undefined) continue;
    const v = spec[a];
    if (!isObj(v) || !RECORDING_ID.test(String(v.recording)) || !(typeof v.seconds === 'number' && v.seconds > 0)) {
      fail(`${at}.${a}`, "is a kept recording { recording, seconds }; a WAV's path is kept when the recipe is written (create_exhibit or update_sketch), so the file must be there then");
    }
    out[a] = { recording: v.recording, seconds: v.seconds };
  }
  return out;
}

// a held recording as the page's audio: mono, resampled to 16 kHz (linear), 16-bit PCM, a data URI
function encodeWav16(samples) {
  const n = samples.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(VOICE_RATE, 24); b.writeUInt32LE(VOICE_RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}

/** A recording this machine holds, as the page plays it (a data: URI), or null when it holds none. Deterministic. */
export function voiceOf(id) {
  const bytes = readRecording(id);
  if (!bytes) return null;
  const { sampleRate, samples } = decodeWav(bytes);
  const n = Math.max(1, Math.round(samples.length * VOICE_RATE / sampleRate)), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * sampleRate) / VOICE_RATE, k = Math.floor(x), f = x - k;
    out[i] = (samples[k] ?? 0) * (1 - f) + (samples[k + 1] ?? samples[k] ?? 0) * f;
  }
  return `data:audio/wav;base64,${encodeWav16(out).toString('base64')}`;
}

/** The read tour's stops with their voices for the page ({ [audience]: { src, seconds } }), and the recordings this
 * machine does not hold (the page is quiet there). */
export function attachVoices(tour) {
  const missing = [];
  const stops = tour.stops.map((s) => {
    if (!s.narration) return s;
    const voice = {};
    for (const [a, v] of Object.entries(s.narration)) {
      const src = voiceOf(v.recording);
      if (src) voice[a] = { src, seconds: v.seconds }; else missing.push(v.recording);
    }
    const { narration: _n, ...rest } = s;
    return Object.keys(voice).length ? { ...rest, voice } : rest;
  });
  return { tour: { ...tour, stops, ...(stops.some((s) => s.voice) ? { narrated: true } : {}) }, missing };
}
