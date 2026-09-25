/**
 * beats-render — offline render of a stored beats recipe to a WAV buffer (B8).
 *
 * The export seam other mojulo subsystems import: a "sound sample" in mojulo is
 * a beats ref, and this file turns its manifest into bytes on demand — the audio
 * sibling of facesToGlb. The recipe stays the only source of truth; nothing here
 * is stored (the /beats.wav route and export_beats regenerate per request), and
 * because the kernel is fully seeded the same manifest + options render the same
 * PCM every time.
 *
 * Two layers, the kernel's own discipline:
 *   renderBeatsPlan  — PURE: lower a manifest to absolute-time schedule entries
 *                      + total duration, per kind, reusing the kernel's pure
 *                      event derivation (ambientBarEvents / compositionEvents /
 *                      patternEvents / cuePlan) and noteFeel exactly as the
 *                      real-time transport applies them. Unit-tested, no audio.
 *   renderBeatsOffline — REALIZER: replay the plan through the kernel's own
 *                      createEngine() against an OfflineAudioContext from
 *                      node-web-audio-api (lazy-imported — the native dep is
 *                      only loaded on an actual export), then encode 16-bit PCM
 *                      WAV in plain JS. One realizer path shared with the
 *                      browser player; no drift between what plays and what
 *                      exports.
 *
 * Duration semantics per kind (loops/scores have no intrinsic file length):
 *   beats-composition — its own flattened duration (bars/loops ignored).
 *   beats-ambient     — `bars` (default: one full progression cycle).
 *   beats-pattern     — `loops` full pattern repetitions (default 2, so the
 *                       per-loop evolving feel is audible).
 *   beats-sfx         — one named `cue` (defaults to the only cue when there is
 *                       exactly one); duration = the cue's own extent.
 * All renders get `tail` seconds (default 2) for reverb/delay/ring-out.
 */

import { buildBeatsKernel } from './beats-kernel.js';
import { PATCHES } from './audio-patches.js';
import { authorSyllable } from './beats-song-lyrics.js';
import { renderParametricNote } from './beats-song-voice-parametric.js';

// The singing instrument (beats-song S0). A composition part with `patch: 'voice'`
// is not a synth patch: each of its events is a sung syllable, synthesized beside
// the kernel by the parametric vocal emitter and spliced into the offline mix as a
// buffer source. Kept out of the kernel (the reserved `voice:'buffer'` seam).
export const VOICE_PATCH = 'voice';

// Hard ceiling on rendered audio — an export is a sample, not an album side.
export const MAX_RENDER_SECONDS = 300;

const kernel = buildBeatsKernel();

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function posInt(v, name, fallback) {
  if (v === undefined || v === null) return fallback;
  if (!Number.isInteger(v) || v < 1) throw new Error(`beats-render: \`${name}\` must be a positive integer (got ${JSON.stringify(v)})`);
  return v;
}

// A note entry replays exactly what the transport would do at play time:
// patch lookup + noteFeel pluck merge happen in the realizer, so the plan
// stays plain data ({ type, t, channel, patch, pluck, note, dur, vel }).
function noteEntries(events, { seed, feelFor, seedIndexFor, glideFor }) {
  const entries = [];
  events.forEach((ev, ei) => {
    const feel = feelFor(ev);
    const glideFrom = glideFor ? glideFor(ev, ei) : null;
    ev.notes.forEach((n, ni) => {
      const fl = kernel.noteFeel(feel, seed, seedIndexFor(ei), ni, ev.notes.length);
      entries.push(withGlide({
        type: 'note', t: ev.t + fl.timeOffset, channel: ev.channel,
        patch: ev.patch, pluck: fl.pluck, note: n, dur: ev.dur, vel: ev.vel * fl.velScale,
      }, glideFrom));
    });
  });
  return entries;
}

// A gliding row's note carries the previous note it slides from (kernel
// glideNotes); rows without `glide` get no field, so their plans are unchanged.
function withGlide(entry, glideFrom) {
  if (glideFrom != null) entry.glideFrom = glideFrom;
  return entry;
}
function glideLookup(rows, events, wrap) {
  if (!rows.some((r) => r.glide)) return null;
  const prev = kernel.glideNotes(events, wrap);
  return (ev, ei) => { const row = rows.find((r) => r.name === ev.channel); return row && row.glide ? prev[ei] : null; };
}

// Push one `sing` plan entry per event of every voice part, returning the voice
// tail (latest note end) and any lyric-alignment warnings. A `sing` entry stays
// plain data — the syllable→katakana authoring and formant synthesis happen in the
// realizer, mirroring how note entries defer the patch/feel merge.
function voiceEntriesInto(entries, voiceParts, manifest) {
  const bpm = manifest.bpm;
  const swing = manifest.swing || 0;
  const sixteenth = 60 / bpm / 4;
  const beat = 60 / bpm;
  const warnings = [];
  let end = 0;
  for (const part of voiceParts) {
    const events = part.events || [];
    const lyrics = Array.isArray(part.lyrics) ? part.lyrics : [];
    if (lyrics.length !== events.length) {
      warnings.push(`part '${part.name}': ${lyrics.length} lyric syllable(s) for ${events.length} event(s) — ${lyrics.length < events.length ? 'padded with "la"' : 'extra lyrics ignored'}`);
    }
    events.forEach((ev, i) => {
      const [at, notes, dur, vel] = ev;
      let t = kernel.timeToSeconds(at, bpm);
      if (swing) {
        const pos = t / sixteenth;
        const idx = Math.round(pos);
        if (Math.abs(pos - idx) < 1e-6 && idx % 2 === 1) t += swing * sixteenth * (2 / 3);
      }
      const durSec = dur == null ? beat : kernel.timeToSeconds(dur, bpm);
      // A voice sings one pitch: take the melody (first) note of a chord event.
      const note = Array.isArray(notes) ? notes[0] : notes;
      const syllable = lyrics[i] != null ? lyrics[i] : 'la';
      entries.push({
        type: 'sing', t, channel: part.name, syllable, note, durSec,
        vel: vel == null ? 0.8 : vel,
        voice: part.voice || {}, emphasis: part.emphasis || {},
        seed: ((manifest.seed || 0) + i * 0x9e37) >>> 0,
      });
      if (t + durSec > end) end = t + durSec;
    });
  }
  return { warnings, duration: end };
}

// Synthesize one `sing` entry to a mono Float32Array at `sampleRate`. Solo by
// default; if the part carries `voice.ensemble.voices`, render the syllable once per
// de-locked singer (its detune/tract-size/timing nudged off the base voice) and mix —
// the choir as an optional register: the one locked voice, deliberately de-locked per
// singer. Deterministic (each singer seeded off the event seed).
function renderSingMono(e, sampleRate) {
  const v = e.voice || {};
  const kata = authorSyllable(e.syllable, e.durSec);
  const ens = v.ensemble && Array.isArray(v.ensemble.voices) && v.ensemble.voices.length ? v.ensemble.voices : null;
  const singers = ens || [{}];   // solo = one singer with no de-locking
  const parts = [];
  let maxLen = 1;
  singers.forEach((sv, k) => {
    const data = renderParametricNote(kata, e.note, e.durSec, {
      sr: sampleRate,
      seed: (e.seed + k * 0x9e3779b1) >>> 0,
      formantScale: (v.formantScale || 1) * (sv.formantScale || 1),
      detuneCents: (v.detuneCents || 0) + (sv.detuneCents || 0),
      emphasis: e.emphasis || {},
      expression: sv.vib ? { ...(v.expression || {}), vibrato: sv.vib } : (v.expression || {}),
    });
    const offset = Math.max(0, Math.round(((sv.timeMs || 0) / 1000) * sampleRate));
    parts.push({ data, offset });
    maxLen = Math.max(maxLen, data.length + offset);
  });
  if (parts.length === 1 && parts[0].offset === 0) return parts[0].data;
  const mix = new Float32Array(maxLen);
  for (const { data, offset } of parts) for (let i = 0; i < data.length; i++) mix[offset + i] += data[i];
  // scale an N-singer stack back toward a solo's level so the choir doesn't clip.
  if (singers.length > 1) { const g = 1 / Math.sqrt(singers.length); for (let i = 0; i < mix.length; i++) mix[i] *= g; }
  return mix;
}

// Conservative end time for one gesture-op list (cuePlan output).
function opsEnd(ops) {
  let end = 0;
  for (const op of ops) end = Math.max(end, op.at + (op.dur || op.decay || 0.05) + (op.release || 0) + 0.15);
  return end;
}

/**
 * Lower a normalized beats manifest to { entries, duration, meta } — pure.
 * opts: { bars? (ambient), loops? (pattern), cue? (sfx), variant? (sfx: a
 * per-hit variation counter, 0 = the plain cue) }.
 */
export function renderBeatsPlan(manifest, opts = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('beats-render: manifest must be an object');
  const kind = manifest.kind;

  if (kind === 'beats-ambient') {
    const bars = posInt(opts.bars, 'bars', (manifest.progression || []).length || 4);
    const bar = kernel.barSeconds(manifest.bpm);
    const entries = [];
    for (let b = 0; b < bars; b++) {
      // NOTE: no feel layer here, but the live transport DOES apply channel feel
      // in ambient (B6), so an ambient row with `feel` plays humanized live and
      // quantized in export. Matching them changes export bytes for those rows —
      // an open compatibility decision, deliberately not made in code.
      const events = kernel.ambientBarEvents(manifest, b);
      const glideFor = glideLookup(manifest.channels || [], events);
      events.forEach((ev, ei) => {
        const ch = (manifest.channels || []).find((c) => c.name === ev.channel);
        for (const n of ev.notes) {
          entries.push(withGlide({ type: 'note', t: b * bar + ev.t, channel: ev.channel, patch: (ch && ch.patch) || 'sinePluck', pluck: 0, note: n, dur: ev.dur, vel: ev.vel }, glideFor && glideFor(ev, ei)));
        }
      });
    }
    return { entries, duration: bars * bar, meta: { bars } };
  }

  if (kind === 'beats-composition') {
    const parts = manifest.parts || [];
    const voiceParts = parts.filter((p) => p.patch === VOICE_PATCH);
    const instrParts = parts.filter((p) => p.patch !== VOICE_PATCH);

    // Instrument parts go through the kernel's own event derivation, unchanged.
    const flat = kernel.compositionEvents({ ...manifest, parts: instrParts });
    const withPatch = flat.events.map((ev) => {
      const part = instrParts.find((p) => p.name === ev.channel);
      return { ...ev, patch: (part && part.patch) || 'sinePluck', part };
    });
    const entries = noteEntries(withPatch, {
      seed: manifest.seed,
      feelFor: (ev) => (ev.part && ev.part.feel) || manifest.feel,
      seedIndexFor: (ei) => ei,
      glideFor: glideLookup(instrParts, flat.events),
    });

    // Voice parts: each event is a sung syllable. Lyrics align 1:1 with the part's
    // events (in declared order — NOT the cross-part sort), padded/truncated so a
    // mismatch never crashes. Timing mirrors compositionEvents (timeToSeconds +
    // swing) so a voice sits on the same grid as the instruments.
    const { warnings, duration: voiceEnd } = voiceEntriesInto(entries, voiceParts, manifest);
    const meta = warnings.length ? { warnings } : {};
    return { entries, duration: Math.max(flat.duration, voiceEnd), meta };
  }

  if (kind === 'beats-pattern') {
    const loops = posInt(opts.loops, 'loops', 2);
    const pat = kernel.patternEvents(manifest);
    const tracks = manifest.tracks || [];
    const entries = [];
    const glides = [glideLookup(tracks, pat.events), glideLookup(tracks, pat.events, true)];
    for (let cursor = 0; cursor < loops; cursor++) {
      const base = cursor * pat.duration;
      const glideFor = glides[cursor ? 1 : 0];
      pat.events.forEach((ev, ei) => {
        const tr = tracks.find((c) => c.name === ev.channel);
        if (tr && (tr.cue || tr.gesture)) {
          const cue = { type: 'cue', t: base + ev.t, channel: ev.channel, gestures: tr.cue || [tr.gesture], vel: ev.vel };
          if (tr.vary) cue.variant = cursor * 1000 + ei + 1; // same counter as the live transport
          entries.push(cue);
          return;
        }
        const feel = tr && tr.feel;
        const glideFrom = glideFor && glideFor(ev, ei);
        ev.notes.forEach((n, ni) => {
          // same per-loop evolving seed fold as the live transport (B6.1).
          const fl = kernel.noteFeel(feel, manifest.seed, cursor * 1000 + ei, ni, ev.notes.length);
          entries.push(withGlide({
            type: 'note', t: base + ev.t + fl.timeOffset, channel: ev.channel,
            patch: (tr && tr.patch) || 'sinePluck', pluck: fl.pluck, note: n, dur: ev.dur, vel: ev.vel * fl.velScale,
          }, glideFrom));
        });
      });
    }
    return { entries, duration: loops * pat.duration, meta: { loops } };
  }

  if (kind === 'beats-sfx') {
    const ids = Object.keys(manifest.cues || {});
    let cue = opts.cue;
    if (!cue) {
      if (ids.length !== 1) throw new Error(`beats-render: this sfx artifact has ${ids.length} cues — pass \`cue\` (one of: ${ids.join(', ')})`);
      cue = ids[0];
    }
    if (!manifest.cues || !manifest.cues[cue]) {
      throw new Error(`beats-render: unknown cue '${cue}' (cues: ${ids.join(', ')})`);
    }
    const gestures = manifest.cues[cue];
    const variant = opts.variant ? posInt(opts.variant, 'variant', 0) : 0;
    const entries = [{ type: 'cue', t: 0, channel: null, gestures, vel: 1, ...(variant ? { variant } : {}) }];
    return { entries, duration: opsEnd(kernel.cuePlan(gestures, variant)), meta: variant ? { cue, variant } : { cue } };
  }

  throw new Error(`beats-render: unknown manifest kind '${kind}'`);
}

/**
 * Encode an AudioBuffer-shaped object ({ numberOfChannels, sampleRate, length,
 * getChannelData(c) }) as a 16-bit PCM RIFF/WAVE Buffer. Plain JS, no deps.
 */
export function encodeWavPcm16(audioBuffer) {
  const nCh = audioBuffer.numberOfChannels;
  const sr = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const blockAlign = nCh * 2;
  const dataBytes = len * blockAlign;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);            // fmt chunk size
  buf.writeUInt16LE(1, 20);             // PCM
  buf.writeUInt16LE(nCh, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * blockAlign, 28); // byte rate
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);            // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  const channels = [];
  for (let c = 0; c < nCh; c++) channels.push(audioBuffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      buf.writeInt16LE(s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF), off);
      off += 2;
    }
  }
  return buf;
}

// ── export polish (audio fidelity, opt-in) ───────────────────────────────────
// `bitDepth` 16 | 24 | 32 (float), seeded TPDF `dither` on the integer depths,
// and `normalize` { peak?: dBTP, lufs?: integrated loudness } — export-only,
// never the live page. With none of them set the WAV is encodeWavPcm16's bytes.

// True peak (dBTP, ITU-R BS.1770 style): the sample peak plus 4× oversampled
// intersample values from a Hann-windowed sinc.
export function truePeakDb(channels) {
  const TAPS = 16, taps = [];
  for (const f of [0.25, 0.5, 0.75]) {
    const h = [];
    for (let k = -TAPS + 1; k <= TAPS; k++) {
      const x = k - f;
      h.push((Math.sin(Math.PI * x) / (Math.PI * x)) * (0.5 + 0.5 * Math.cos((Math.PI * x) / TAPS)));
    }
    taps.push(h);
  }
  let pk = 0;
  for (const y of channels) {
    for (let i = 0; i < y.length; i++) {
      const a = Math.abs(y[i]);
      if (a > pk) pk = a;
      if (a < pk * 0.25) continue; // an intersample peak can't exceed ~4× its neighbours here
      for (const h of taps) {
        let v = 0;
        for (let k = 0; k < h.length; k++) { const j = i + k - TAPS + 1; if (j >= 0 && j < y.length) v += y[j] * h[k]; }
        if (Math.abs(v) > pk) pk = Math.abs(v);
      }
    }
  }
  return 20 * Math.log10(pk || 1e-12);
}

// Integrated loudness (LUFS, BS.1770-4): K-weighting, 400 ms blocks at 75 %
// overlap, −70 LUFS absolute gate, −10 LU relative gate.
export function integratedLufs(channels, sr) {
  const biquad = (y, b0, b1, b2, a1, a2) => {
    const o = new Float64Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) { const v = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; o[i] = v; }
    return o;
  };
  let K = Math.tan((Math.PI * 1681.974450955533) / sr), Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  K = Math.tan((Math.PI * 38.13547087602444) / sr); Q = 0.5003270373238773; a0 = 1 + K / Q + K * K;
  const hp = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  const kw = channels.map((y) => biquad(biquad(y, ...shelf), ...hp));
  const len = kw[0].length, block = Math.round(0.4 * sr), step = Math.round(0.1 * sr);
  const z = [];
  for (let s0 = 0; s0 + block <= Math.max(len, block); s0 += step) {
    let sum = 0;
    const end = Math.min(len, s0 + block), n = Math.max(1, end - s0);
    for (const y of kw) { let e = 0; for (let i = s0; i < end; i++) e += y[i] * y[i]; sum += e / n; }
    z.push(sum);
  }
  const lk = (v) => -0.691 + 10 * Math.log10(v || 1e-12);
  const abs = z.filter((v) => lk(v) > -70);
  if (!abs.length) return -Infinity;
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((v) => lk(v) > rel);
  return lk(gated.reduce((a, b) => a + b, 0) / gated.length);
}

// Encode at a chosen depth: 16/24-bit PCM (optionally TPDF-dithered from a
// seeded mulberry32) or 32-bit IEEE float (with the fact chunk non-PCM wants).
export function encodeWav(audioBuffer, { bitDepth = 16, dither = false, seed = 1 } = {}) {
  if (bitDepth === 16 && !dither) return encodeWavPcm16(audioBuffer);
  const nCh = audioBuffer.numberOfChannels, sr = audioBuffer.sampleRate, len = audioBuffer.length;
  const bytes = bitDepth / 8, float = bitDepth === 32, head = float ? 58 : 44;
  const dataBytes = len * nCh * bytes;
  const buf = Buffer.alloc(head + dataBytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(head - 8 + dataBytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(float ? 18 : 16, 16); buf.writeUInt16LE(float ? 3 : 1, 20);
  buf.writeUInt16LE(nCh, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * nCh * bytes, 28);
  buf.writeUInt16LE(nCh * bytes, 32); buf.writeUInt16LE(bitDepth, 34);
  let off = 36;
  if (float) { buf.writeUInt16LE(0, 36); buf.write('fact', 38); buf.writeUInt32LE(4, 42); buf.writeUInt32LE(len, 46); off = 50; }
  buf.write('data', off); buf.writeUInt32LE(dataBytes, off + 4); off += 8;
  const channels = [];
  for (let c = 0; c < nCh; c++) channels.push(audioBuffer.getChannelData(c));
  const full = bitDepth === 24 ? 8388607 : 32767;
  const rng = kernel.mulberry32(kernel.hashSeed(seed >>> 0, 0xD1748));
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = channels[c][i];
      if (float) { buf.writeFloatLE(s, off); off += 4; continue; }
      const q = Math.round(s * full + (dither ? rng() - rng() : 0));
      const v = Math.max(-full - 1, Math.min(full, q));
      if (bytes === 3) buf.writeIntLE(v, off, 3); else buf.writeInt16LE(v, off);
      off += bytes;
    }
  }
  return buf;
}

/**
 * Render a normalized beats manifest to a WAV Buffer via the kernel's own
 * realizer on an OfflineAudioContext. Deterministic for the same
 * (manifest, opts). opts: { bars?, loops?, cue?, tail? = 2, sampleRate? = 44100,
 * bitDepth?, dither?, normalize? } — the last three default from the manifest's
 * own `export` block. Returns { wav, durationSeconds, sampleRate, channels, meta }.
 */
export async function renderBeatsOffline(manifest, opts = {}) {
  return renderWithKernel(kernel, manifest, opts);
}

/**
 * The realizer with the kernel instance passed in. renderBeatsOffline passes
 * the full kernel; a page kernel (emitBeatsKernel(features), evaluated) renders
 * through here to prove a feature slice sounds identical to the full kernel.
 * A slice may lack routeChannel/setMaster (mix off, or the frozen 2.1 kernel):
 * the 2.1 route (chain → channel gain) stands in, which is what they build.
 */
export async function renderWithKernel(K, manifest, opts = {}) {
  const sampleRate = opts.sampleRate === undefined ? 44100 : opts.sampleRate;
  if (sampleRate !== 44100 && sampleRate !== 48000) {
    throw new Error('beats-render: `sampleRate` must be 44100 or 48000');
  }
  const tail = opts.tail === undefined ? 2 : opts.tail;
  if (!Number.isFinite(tail) || tail < 0 || tail > 30) throw new Error('beats-render: `tail` must be a number in [0, 30] seconds');

  if (opts.bitDepth !== undefined && ![16, 24, 32].includes(opts.bitDepth)) throw new Error('beats-render: `bitDepth` must be 16, 24 or 32 (float)');
  const plan = renderBeatsPlan(manifest, opts);
  const total = plan.duration + tail;
  if (total > MAX_RENDER_SECONDS) {
    throw new Error(`beats-render: requested render is ${total.toFixed(1)}s — the ceiling is ${MAX_RENDER_SECONDS}s. Lower bars/loops.`);
  }

  // Lazy native import: create_beats / the player never load the audio backend.
  const { OfflineAudioContext } = await import('node-web-audio-api');
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * sampleRate)), sampleRate);
  const engine = K.createEngine(ctx);
  if (engine.setMaster) engine.setMaster(manifest.master);

  // Per-channel chains, exactly as startTransport builds them. Stored B5.2
  // macros are applied statically here: a `tone` value inserts the same
  // chain-head low-pass the live transport uses (only when the recipe carries
  // one, so macro-less renders stay byte-identical to pre-B5.2), and
  // `transpose` shifts note pitch at realize time below.
  const rows = manifest.channels || manifest.parts || manifest.tracks || [];
  const chains = {};
  const transposeFor = {};
  const rowFor = {};
  for (const ch of rows) {
    let input;
    if (engine.routeChannel) input = engine.routeChannel(ch, manifest);
    else { const built = engine.buildChain(ch.chain, manifest.seed, manifest.bpm); built.output.connect(engine.channelGain(ch.name)); input = built.input; }
    let dest = input;
    if (ch.tone !== undefined) {
      const tn = ctx.createBiquadFilter();
      tn.type = 'lowpass'; tn.Q.value = 0.5;
      tn.frequency.value = kernel.toneFreq(ch.tone);
      tn.connect(input);
      dest = tn;
    }
    chains[ch.name] = dest;
    rowFor[ch.name] = ch;
    if (ch.transpose) transposeFor[ch.name] = Math.pow(2, ch.transpose / 12);
  }

  for (const e of plan.entries) {
    // Feel jitter can push a time-zero event a few ms negative; the browser's
    // AudioContext clamps that to "now", but OfflineAudioContext throws.
    const t = Math.max(0, e.t);
    if (e.type === 'cue') {
      engine.playCue(e.gestures, t, e.channel ? chains[e.channel] : undefined, e.vel, e.variant);
    } else if (e.type === 'sing') {
      // Synthesize the sung syllable at the context rate (no resample) and splice
      // it in as a buffer source — the reserved `voice:'buffer'` seam beside the
      // kernel. Deterministic: same manifest → same PCM (seeded per event).
      const data = renderSingMono(e, sampleRate);
      const len = Math.max(1, data.length);
      const buf = ctx.createBuffer(1, len, sampleRate);
      buf.getChannelData(0).set(data);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = e.vel;
      src.connect(g);
      g.connect(chains[e.channel]);
      src.start(t);
    } else {
      const row = rowFor[e.channel];
      const patch = kernel.resolvePatch(PATCHES, { patch: e.patch, patchParams: row && row.patchParams }, e.note);
      if (!patch) continue; // a kit note with no piece
      let p = e.pluck ? { ...patch, pick: clamp01((patch.pick || 0) + e.pluck) } : patch;
      if (e.glideFrom != null) p = { ...p, glide: row.glide, glideFrom: kernel.noteHz(e.glideFrom) * (transposeFor[e.channel] || 1) };
      const hz = kernel.noteHz(e.note) * (transposeFor[e.channel] || 1);
      engine.playVoice(p, hz, t, e.dur, e.vel, chains[e.channel], kernel.noteKey(manifest.seed, e.channel, e.t, hz));
    }
  }

  const rendered = await ctx.startRendering();
  const ex = { ...(manifest.export || {}) };
  for (const k of ['bitDepth', 'dither', 'normalize']) if (opts[k] !== undefined) ex[k] = opts[k];
  let meta = plan.meta;
  if (ex.normalize) {
    const data = [];
    for (let c = 0; c < rendered.numberOfChannels; c++) data.push(rendered.getChannelData(c));
    const tp = truePeakDb(data);
    const lufs = ex.normalize.lufs != null ? integratedLufs(data, sampleRate) : null;
    // a loudness target also respects a −1 dBTP ceiling unless `peak` says otherwise.
    const ceiling = ex.normalize.peak != null ? ex.normalize.peak : -1;
    let gainDb = ceiling - tp;
    const want = lufs != null && Number.isFinite(lufs) ? ex.normalize.lufs - lufs : null;
    if (want != null) gainDb = Math.min(gainDb, want);
    const g = Math.pow(10, gainDb / 20);
    for (const y of data) for (let i = 0; i < y.length; i++) y[i] *= g;
    meta = { ...meta, export: { gainDb: +gainDb.toFixed(2), truePeakDb: +(tp + gainDb).toFixed(2), ...(lufs != null ? { lufs: +(lufs + gainDb).toFixed(2) } : {}), ...(want != null && gainDb < want - 0.01 ? { ceilingLimited: true } : {}) } };
  }
  return {
    wav: encodeWav(rendered, { bitDepth: ex.bitDepth || 16, dither: !!ex.dither, seed: manifest.seed || 1 }),
    durationSeconds: total,
    sampleRate,
    channels: rendered.numberOfChannels,
    meta,
  };
}
