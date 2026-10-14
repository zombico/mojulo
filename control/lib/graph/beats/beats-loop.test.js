// Loop points: an opt-in render that is exactly one seamless pass to the bar line, the ring-out folded onto the
// head, with a `smpl` loop chunk game engines and samplers read. Off, the bytes are unchanged. Live, a looped
// composition plays again from the same seam (the `loop` kernel slice).
import { describe, it, expect, vi } from 'vitest';
import { renderBeatsOffline, loopSeconds, renderBeatsPlan } from './beats-render.js';
import { emitBeatsKernel } from './beats-kernel.js';
import { beatsFeatures } from './beats-features.js';
import { PATCHES } from './audio-patches.js';
import { expandBeatsManifest } from './beats-authoring.js';
import { normalizeBeatsManifest, validateBeatsManifest } from './beats-manifest.js';
import { decodeWav, rms } from './audio-measure.js';
import { fieldScore } from './field-score.js';

// a 4/4 cue at 120 bpm (2 s bars) whose last note ends mid-bar 2, with a held pluck that rings past it.
const PLAIN = normalizeBeatsManifest({
  kind: 'beats-composition', title: 'loop probe', bpm: 120, seed: 3,
  parts: [{ name: 'lead', instrument: 'flute', events: [['0:1:0', 'A4', '0:1:0', 0.7], ['1:0:0', 'E5', '0:2:0', 0.7]] }],
});

function smplOf(buf) {
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'smpl') return { loops: buf.readUInt32LE(off + 36), type: buf.readUInt32LE(off + 52), start: buf.readUInt32LE(off + 56), end: buf.readUInt32LE(off + 60) };
    off += 8 + size + (size % 2);
  }
  return null;
}

describe('loop period', () => {
  it('runs to the next bar line, not the last note', () => {
    const plan = renderBeatsPlan(PLAIN);
    expect(plan.duration).toBeCloseTo(3, 6);         // the E5 ends at bar 1 beat 2
    expect(loopSeconds(PLAIN, plan.duration)).toBeCloseTo(4, 6); // two 2 s bars
  });

  it('reads a scored cue’s own meter', () => {
    const m = normalizeBeatsManifest(fieldScore('plains', { seed: 12, identity: 5 }));
    const plan = renderBeatsPlan(m);
    const L = loopSeconds(m, plan.duration);
    const barQ = { '4/4': 4, '3/4': 3, '6/8': 3 }[m.meter];
    const bars = L / (barQ * 60 / m.bpm);
    expect(Math.abs(bars - Math.round(bars))).toBeLessThan(1e-6);
    expect(L).toBeGreaterThanOrEqual(plan.duration - 1e-6);
  });
});

describe('looped render', () => {
  it('is one pass long, carries a forward smpl loop over the whole file, and folds the tail onto the head', async () => {
    const r = await renderBeatsOffline(PLAIN, { loop: true });
    const { channels, sr } = decodeWav(r.wav);
    expect(channels[0].length).toBe(4 * 44100);
    expect(r.meta.loop).toEqual({ seconds: 4, samples: 4 * 44100 });
    expect(r.durationSeconds).toBe(4);
    expect(smplOf(r.wav)).toEqual({ loops: 1, type: 0, start: 0, end: 4 * 44100 - 1 });
    // the first quarter is a rest: unlooped it is silent; looped it holds the folded ring-out.
    const plain = decodeWav((await renderBeatsOffline(PLAIN)).wav).channels[0];
    expect(rms(plain, 0, Math.floor(0.4 * sr))).toBeLessThan(1e-6);
    expect(rms(channels[0], 0, Math.floor(0.4 * sr))).toBeGreaterThan(1e-5);
  });

  it('off stays byte-identical, and the recipe can ask for it in export', async () => {
    const a = await renderBeatsOffline(PLAIN);
    const b = await renderBeatsOffline(PLAIN, { loop: false });
    expect(Buffer.compare(a.wav, b.wav)).toBe(0);
    expect(smplOf(a.wav)).toBeNull();
    const viaRecipe = await renderBeatsOffline({ ...PLAIN, export: { loop: true } });
    const viaOpt = await renderBeatsOffline(PLAIN, { loop: true });
    expect(Buffer.compare(viaRecipe.wav, viaOpt.wav)).toBe(0);
  });

  it('refuses an sfx, and the manifest validates export.loop', async () => {
    const sfx = normalizeBeatsManifest({ kind: 'beats-sfx', title: 'blip', cues: { blip: [{ type: 'tone', note: 'A5', dur: 0.1 }] } });
    await expect(renderBeatsOffline(sfx, { loop: true })).rejects.toThrow(/one-shot/);
    expect(validateBeatsManifest({ ...PLAIN, export: { loop: 'yes' } }).ok).toBe(false);
  });
});

// A stand-in AudioContext: every node and param is an inert stub, the clock is ours, and each source's start(when)
// is recorded, so the transport's schedule can be read without an audio device.
function stubContext() {
  const starts = [];
  const stub = () => new Proxy(function () {}, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k === 'start') return (when) => { starts.push(Math.round(when * 1000) / 1000); };
      if (k === 'getChannelData') return () => new Float32Array(16);
      if (k === 'length') return 16;
      if (k === 'value' || k === 'defaultValue') return 0;
      if (!(k in t)) t[k] = stub();
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return stub(); },
  });
  const clock = { currentTime: 0, sampleRate: 44100, starts };
  return new Proxy(clock, { get: (t, k) => (k in t ? t[k] : k === 'destination' ? stub() : () => stub()) });
}

// play `seconds` of the live transport (its 25 ms lookahead tick) and return the distinct start times. A page
// hands the engine the expanded recipe (beats-player, beats-world), so this does too.
function liveStarts(recipe, seconds) {
  const manifest = expandBeatsManifest(recipe);
  vi.useFakeTimers();
  try {
    const kernel = new Function('return (' + emitBeatsKernel(beatsFeatures(manifest)) + ')')()();
    const ctx = stubContext();
    kernel.createEngine(ctx).startComposition(manifest, PATCHES);
    for (let t = 0; t <= seconds; t += 0.025) { ctx.currentTime = t; vi.advanceTimersByTime(25); }
    return [...new Set(ctx.starts)].sort((a, b) => a - b);
  } finally { vi.useRealTimers(); }
}

describe('looped live transport', () => {
  // one note at bar 1 beat 1 (2.625 s at 120 bpm): the period is two bars, 4 s.
  const ONE = { kind: 'beats-composition', bpm: 120, seed: 3, parts: [{ name: 'a', patch: 'sinePluck', events: [['1:1:1', 'C4', '0:1:0', 0.8]] }] };

  it('detection adds the loop slice only for a looped composition', () => {
    expect(beatsFeatures({ ...ONE, loop: true })).toContain('loop');
    expect(beatsFeatures(ONE)).not.toContain('loop');
    expect(beatsFeatures({ kind: 'beats-pattern', bpm: 120, loop: true, tracks: [] })).not.toContain('loop');
  });

  it('plays the piece again one period on, where 2.1 went silent after one pass', () => {
    const t0 = 0.08;
    expect(liveStarts({ ...ONE, loop: true }, 11)).toEqual([t0 + 2.625, t0 + 6.625, t0 + 10.625].map((x) => Math.round(x * 1000) / 1000));
    expect(liveStarts(ONE, 11)).toEqual([Math.round((t0 + 2.625) * 1000) / 1000]);
  });

  it('wraps at the seam the export folds at (a scored field cue)', () => {
    const m = normalizeBeatsManifest(fieldScore('plains', { seed: 12, identity: 5 }));
    const L = loopSeconds(m, renderBeatsPlan(m).duration);
    const live = liveStarts({ ...m, loop: true }, L + 1.5);
    const first = live[0];
    expect(live.some((x) => Math.abs(x - (first + L)) < 0.002)).toBe(true);
  });
});
