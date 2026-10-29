/**
 * recordings — a performance's RECORDED LINES, kept as mojulo's own outcome: the audio a hero speaks (a voice worker's,
 * a native speech engine's, a person's narration), saved where mojulo keeps its outcomes so the take a hero acts is whole
 * without the worker that made it. A recording is CONTENT-ADDRESSED: its id is its bytes' hash (16 hex), so a line
 * names the same recording on every machine that holds it, a second save of the same audio is the same file, and the
 * recipe stays a recipe (the beat carries the id and the timed phonemes; the bytes are the outcome's).
 *
 *   `saveRecording(path)`  copies a WAV into `<outcomes>/recordings/<id>.wav` (once), with `<id>.json` beside it (its
 *                          length, rate, channels and the file it came from): → { id, seconds, sampleRate, samples }
 *   `readRecording(id)`    its bytes, or null when this machine does not hold it
 *   `decodeWav(bytes)`     PCM (8, 16, 24, 32 bit) or float (32, 64 bit), any channels, mixed to mono
 *   `bindLine(say)`        a beat's `say` as the door takes it (`audio`: a path) → as the record keeps it (`recording`:
 *                          the id, `seconds`, and its timing: the engine's own when its `.timings.json` lies beside the
 *                          audio (speak.py --timings) or the say gave `phonemes`; else the text aligned to the
 *                          recording (align.js); else, no text, the recording's loudness)
 *
 * Its directory follows the outcomes' (MOJULO_OUTCOMES_DIR, else <cwd>/data/outcomes), as the voice samples' does. Reads
 * and writes files; timeless (no clock: the id is the content's).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { alignText, loudness } from './align.js';
import { speechErrors } from './speech.js';

const outcomesBaseDir = () => process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes');
export const recordingDir = () => path.join(outcomesBaseDir(), 'recordings');
export const RECORDING_ID = /^[0-9a-f]{16}$/;

/** WAV bytes → { sampleRate, channels, samples: Float32Array (mono, −1 … 1) }; throws on what is no WAV it reads */
export function decodeWav(bytes) {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (b.length < 12 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('recordings: not a WAV (RIFF/WAVE) file');
  let fmt = null, data = null;
  for (let o = 12; o + 8 <= b.length;) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4), body = o + 8;
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(body), channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14), ext: size >= 26 ? b.readUInt16LE(body + 24) : null };
    else if (id === 'data') data = { at: body, size: Math.min(size, b.length - body) };
    o = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('recordings: a WAV with no fmt or data chunk');
  const format = fmt.format === 0xfffe ? fmt.ext : fmt.format, { channels, bits } = fmt, step = (bits / 8) * channels;
  if (!channels || !(format === 1 || format === 3) || ![8, 16, 24, 32, 64].includes(bits) || (format === 3 && bits < 32)) throw new Error(`recordings: a WAV of format ${format} at ${bits} bits is not read (PCM 8/16/24/32 bit or float 32/64 bit)`);
  const n = Math.floor(data.size / step), out = new Float32Array(n);
  const read = (at) => (format === 3 ? (bits === 32 ? b.readFloatLE(at) : b.readDoubleLE(at)) : bits === 8 ? (b.readUInt8(at) - 128) / 128 : bits === 16 ? b.readInt16LE(at) / 32768 : bits === 24 ? b.readIntLE(at, 3) / 8388608 : b.readInt32LE(at) / 2147483648);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < channels; c++) s += read(data.at + i * step + c * (bits / 8)); out[i] = s / channels; }
  return { sampleRate: fmt.sampleRate, channels, samples: out };
}

/** A WAV at `file` saved as a recording (once: the same bytes are the same recording) → { id, seconds, sampleRate, samples } */
export function saveRecording(file) {
  if (typeof file !== 'string' || !existsSync(file)) throw new Error(`recordings: no audio at '${file}'`);
  const bytes = readFileSync(file), wav = decodeWav(bytes), id = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const dir = recordingDir(), at = path.join(dir, `${id}.wav`), seconds = +(wav.samples.length / wav.sampleRate).toFixed(4);
  if (!existsSync(at)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(at, bytes);
    writeFileSync(path.join(dir, `${id}.json`), `${JSON.stringify({ id, seconds, sampleRate: wav.sampleRate, channels: wav.channels, from: path.basename(file) }, null, 1)}\n`);
  }
  return { id, seconds, sampleRate: wav.sampleRate, samples: wav.samples };
}

/** a recording's bytes, or null when this machine does not hold it */
export function readRecording(id) {
  if (!RECORDING_ID.test(String(id))) return null;
  const at = path.join(recordingDir(), `${id}.wav`);
  return existsSync(at) ? readFileSync(at) : null;
}

/** the engine's timings beside an audio file (speak.py --timings: `<name>.timings.json`), its phonemes, or null */
function sidecarOf(file) {
  const at = file.replace(/\.[^./]+$/, '.timings.json');
  if (!existsSync(at)) return null;
  try { const J = JSON.parse(readFileSync(at, 'utf8')); return Array.isArray(J.phonemes) && J.phonemes.length ? J.phonemes : null; } catch { return null; }
}

/**
 * A beat's `say` as the door takes it → as the record keeps it. With `audio` (a path to a WAV): the recording saved, the
 * say keeping its `recording` id, `seconds` and `timing` ('engine': phonemes given or beside the audio; 'aligned': the
 * text's own, aligned to the recording; 'loudness': no text, the mouth opening with the voice's loudness) and the timed
 * `phonemes` (and the aligned `words`, so an emphasized word still lifts the brows) or the `envelope`. Any other say
 * passes as it is. Throws (the door's refusal) on audio it cannot read.
 */
export function bindLine(say) {
  if (!say || typeof say !== 'object' || say.audio === undefined) return say;
  const { audio, ...rest } = say, rec = saveRecording(audio);
  const given = rest.phonemes ?? sidecarOf(audio);
  if (given) return { ...rest, recording: rec.id, seconds: rec.seconds, timing: 'engine', phonemes: given };
  if (typeof rest.text === 'string' && !speechErrors({ text: rest.text }).length) {
    const A = alignText(rest.text, rec.samples, rec.sampleRate);
    return { ...rest, recording: rec.id, seconds: rec.seconds, timing: 'aligned', phonemes: A.phonemes, words: A.words };
  }
  return { ...rest, recording: rec.id, seconds: rec.seconds, timing: 'loudness', envelope: loudness(rec.samples, rec.sampleRate) };
}

/** A hero's door words with every recorded line bound (`perform.<take>.beats[i].say.audio` saved and timed: bindLine);
 * the rest as given. Throws, naming the beat, on audio it cannot read. */
export function bindPerformance(spec) {
  if (!spec || typeof spec !== 'object' || !spec.perform || typeof spec.perform !== 'object') return spec;
  const perform = Object.fromEntries(Object.entries(spec.perform).map(([take, P]) => [take, P && Array.isArray(P.beats) ? { ...P, beats: P.beats.map((b, i) => {
    if (!b?.say || typeof b.say !== 'object' || b.say.audio === undefined) return b;
    try { return { ...b, say: bindLine(b.say) }; } catch (e) { throw new Error(`perform.${take}.beats[${i}].say.audio: ${e.message.replace(/^recordings: /, '')}`); }
  }) } : P]));
  return { ...spec, perform };
}

/** A resolved scene's recorded lines (each figure's `face.performances`, relational-face-rig.js performanceTrack): every
 * one this machine holds gets its `bytes` (so the GLB embeds it, scene-gltf.js); → [{ clip, at, recording, bytes|null }]
 * in the takes' order, for an engine pack to ship its WAVs beside the GLB. */
export function attachRecordings(payload) {
  const out = [];
  for (const fig of Object.values(payload?.figures ?? {})) for (const [take, P] of Object.entries(fig?.face?.performances ?? {})) for (const A of P.audio ?? []) {
    const bytes = readRecording(A.recording);
    if (bytes) A.bytes = bytes;
    out.push({ clip: `face:${take}`, at: A.at, recording: A.recording, bytes: bytes ?? null });
  }
  return out;
}
