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
function noteEntries(events, { seed, feelFor, seedIndexFor }) {
  const entries = [];
  events.forEach((ev, ei) => {
    const feel = feelFor(ev);
    ev.notes.forEach((n, ni) => {
      const fl = kernel.noteFeel(feel, seed, seedIndexFor(ei), ni, ev.notes.length);
      entries.push({
        type: 'note', t: ev.t + fl.timeOffset, channel: ev.channel,
        patch: ev.patch, pluck: fl.pluck, note: n, dur: ev.dur, vel: ev.vel * fl.velScale,
      });
    });
  });
  return entries;
}

// Conservative end time for one gesture-op list (cuePlan output).
function opsEnd(ops) {
  let end = 0;
  for (const op of ops) end = Math.max(end, op.at + (op.dur || op.decay || 0.05) + 0.15);
  return end;
}

/**
 * Lower a normalized beats manifest to { entries, duration, meta } — pure.
 * opts: { bars? (ambient), loops? (pattern), cue? (sfx) }.
 */
export function renderBeatsPlan(manifest, opts = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('beats-render: manifest must be an object');
  const kind = manifest.kind;

  if (kind === 'beats-ambient') {
    const bars = posInt(opts.bars, 'bars', (manifest.progression || []).length || 4);
    const bar = kernel.barSeconds(manifest.bpm);
    const entries = [];
    for (let b = 0; b < bars; b++) {
      // ambient mode has no feel layer (matches startTransport's ambient branch).
      for (const ev of kernel.ambientBarEvents(manifest, b)) {
        const ch = (manifest.channels || []).find((c) => c.name === ev.channel);
        for (const n of ev.notes) {
          entries.push({ type: 'note', t: b * bar + ev.t, channel: ev.channel, patch: (ch && ch.patch) || 'sinePluck', pluck: 0, note: n, dur: ev.dur, vel: ev.vel });
        }
      }
    }
    return { entries, duration: bars * bar, meta: { bars } };
  }

  if (kind === 'beats-composition') {
    const flat = kernel.compositionEvents(manifest);
    const parts = manifest.parts || [];
    const withPatch = flat.events.map((ev) => {
      const part = parts.find((p) => p.name === ev.channel);
      return { ...ev, patch: (part && part.patch) || 'sinePluck', part };
    });
    const entries = noteEntries(withPatch, {
      seed: manifest.seed,
      feelFor: (ev) => (ev.part && ev.part.feel) || manifest.feel,
      seedIndexFor: (ei) => ei,
    });
    return { entries, duration: flat.duration, meta: {} };
  }

  if (kind === 'beats-pattern') {
    const loops = posInt(opts.loops, 'loops', 2);
    const pat = kernel.patternEvents(manifest);
    const tracks = manifest.tracks || [];
    const entries = [];
    for (let cursor = 0; cursor < loops; cursor++) {
      const base = cursor * pat.duration;
      pat.events.forEach((ev, ei) => {
        const tr = tracks.find((c) => c.name === ev.channel);
        if (tr && (tr.cue || tr.gesture)) {
          entries.push({ type: 'cue', t: base + ev.t, channel: ev.channel, gestures: tr.cue || [tr.gesture], vel: ev.vel });
          return;
        }
        const feel = tr && tr.feel;
        ev.notes.forEach((n, ni) => {
          // same per-loop evolving seed fold as the live transport (B6.1).
          const fl = kernel.noteFeel(feel, manifest.seed, cursor * 1000 + ei, ni, ev.notes.length);
          entries.push({
            type: 'note', t: base + ev.t + fl.timeOffset, channel: ev.channel,
            patch: (tr && tr.patch) || 'sinePluck', pluck: fl.pluck, note: n, dur: ev.dur, vel: ev.vel * fl.velScale,
          });
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
    const entries = [{ type: 'cue', t: 0, channel: null, gestures, vel: 1 }];
    return { entries, duration: opsEnd(kernel.cuePlan(gestures)), meta: { cue } };
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

/**
 * Render a normalized beats manifest to a WAV Buffer via the kernel's own
 * realizer on an OfflineAudioContext. Deterministic for the same
 * (manifest, opts). opts: { bars?, loops?, cue?, tail? = 2, sampleRate? = 44100 }.
 * Returns { wav, durationSeconds, sampleRate, channels, meta }.
 */
export async function renderBeatsOffline(manifest, opts = {}) {
  const sampleRate = opts.sampleRate === undefined ? 44100 : opts.sampleRate;
  if (sampleRate !== 44100 && sampleRate !== 48000) {
    throw new Error('beats-render: `sampleRate` must be 44100 or 48000');
  }
  const tail = opts.tail === undefined ? 2 : opts.tail;
  if (!Number.isFinite(tail) || tail < 0 || tail > 30) throw new Error('beats-render: `tail` must be a number in [0, 30] seconds');

  const plan = renderBeatsPlan(manifest, opts);
  const total = plan.duration + tail;
  if (total > MAX_RENDER_SECONDS) {
    throw new Error(`beats-render: requested render is ${total.toFixed(1)}s — the ceiling is ${MAX_RENDER_SECONDS}s. Lower bars/loops.`);
  }

  // Lazy native import: create_beats / the player never load the audio backend.
  const { OfflineAudioContext } = await import('node-web-audio-api');
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * sampleRate)), sampleRate);
  const engine = kernel.createEngine(ctx);

  // Per-channel chains, exactly as startTransport builds them. Stored B5.2
  // macros are applied statically here: a `tone` value inserts the same
  // chain-head low-pass the live transport uses (only when the recipe carries
  // one, so macro-less renders stay byte-identical to pre-B5.2), and
  // `transpose` shifts note pitch at realize time below.
  const rows = manifest.channels || manifest.parts || manifest.tracks || [];
  const chains = {};
  const transposeFor = {};
  for (const ch of rows) {
    const built = engine.buildChain(ch.chain, manifest.seed, manifest.bpm);
    built.output.connect(engine.channelGain(ch.name));
    let dest = built.input;
    if (ch.tone !== undefined) {
      const tn = ctx.createBiquadFilter();
      tn.type = 'lowpass'; tn.Q.value = 0.5;
      tn.frequency.value = kernel.toneFreq(ch.tone);
      tn.connect(built.input);
      dest = tn;
    }
    chains[ch.name] = dest;
    if (ch.transpose) transposeFor[ch.name] = Math.pow(2, ch.transpose / 12);
  }

  for (const e of plan.entries) {
    // Feel jitter can push a time-zero event a few ms negative; the browser's
    // AudioContext clamps that to "now", but OfflineAudioContext throws.
    const t = Math.max(0, e.t);
    if (e.type === 'cue') {
      engine.playCue(e.gestures, t, e.channel ? chains[e.channel] : undefined, e.vel);
    } else {
      const patch = PATCHES[e.patch] || {};
      const p = e.pluck ? { ...patch, pick: clamp01((patch.pick || 0) + e.pluck) } : patch;
      engine.playVoice(p, kernel.noteHz(e.note) * (transposeFor[e.channel] || 1), t, e.dur, e.vel, chains[e.channel]);
    }
  }

  const rendered = await ctx.startRendering();
  return {
    wav: encodeWavPcm16(rendered),
    durationSeconds: total,
    sampleRate,
    channels: rendered.numberOfChannels,
    meta: plan.meta,
  };
}
