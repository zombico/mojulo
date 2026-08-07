import { describe, expect, it } from 'vitest';

import { renderBeatsPlan, renderBeatsOffline, encodeWavPcm16, MAX_RENDER_SECONDS } from './beats-render.js';
import { normalizeBeatsManifest } from './beats-manifest.js';

// ── fixtures — minimal recipes run through the real normalizer, so the plan
// sees exactly the stored-manifest shape create_beats persists.

const AMBIENT = normalizeBeatsManifest({
  kind: 'beats-ambient',
  title: 'render loop',
  bpm: 120,
  swing: 0.1,
  seed: 20260709,
  progression: [
    { chord: ['C3', 'E3', 'G3'], root: 'C2' },
    { chord: ['A2', 'C3', 'E3'], root: 'A1' },
  ],
  channels: [
    { name: 'pads', role: 'harmony', patch: 'pad', chain: [{ type: 'reverb', decay: 2, wet: 0.3 }] },
    { name: 'bass', role: 'roots', patch: 'bassMono' },
    { name: 'kick', role: 'pulse', patch: 'kick', note: 'C1', steps: [1, 0, 0, 0, 0.9, 0, 0, 0] },
  ],
});

const COMPOSITION = normalizeBeatsManifest({
  kind: 'beats-composition',
  title: 'render score',
  bpm: 140,
  parts: [
    { name: 'lead', patch: 'sinePluck', feel: { strum: 0.02, jitterVel: 0.1 }, events: [
      ['0:0:0', ['C4', 'E4', 'G4'], 1, 0.9],
      ['0:2:0', 'A4', 0.5, 0.7],
    ] },
  ],
});

const PATTERN = normalizeBeatsManifest({
  kind: 'beats-pattern',
  title: 'render groove',
  bpm: 130,
  swing: 0.12,
  seed: 7,
  steps: 16,
  tracks: [
    { name: 'kick', gesture: { type: 'thump', from: 'G2', to: 'G1' }, mask: [1, 0, 0, 0] },
    { name: 'stab', patch: 'sawStab', feel: { jitterTime: 0.004 }, mask: [0, 0, 0.8, 0], notes: ['C3'] },
  ],
});

const SFX = normalizeBeatsManifest({
  kind: 'beats-sfx',
  title: 'render foley',
  cues: {
    pickup: [{ type: 'sweep', from: 'A4', to: 'A5', dur: 0.08 }],
    land: [{ type: 'thump' }, { type: 'burst', decay: 0.1 }],
  },
});

describe('renderBeatsPlan', () => {
  it('is deterministic: same manifest + opts → identical entries', () => {
    const a = renderBeatsPlan(PATTERN, { loops: 2 });
    const b = renderBeatsPlan(PATTERN, { loops: 2 });
    expect(a).toEqual(b);
  });

  it('ambient: defaults bars to the progression length and scales duration', () => {
    const one = renderBeatsPlan(AMBIENT); // 2-step progression → 2 bars @ 120bpm = 4s
    expect(one.meta.bars).toBe(2);
    expect(one.duration).toBeCloseTo(4, 6);
    const four = renderBeatsPlan(AMBIENT, { bars: 4 });
    expect(four.duration).toBeCloseTo(8, 6);
    expect(four.entries.length).toBeGreaterThan(one.entries.length);
    one.entries.forEach((e) => { expect(e.type).toBe('note'); expect(e.pluck).toBe(0); });
  });

  it('composition: duration is the score its own length; bars/loops ignored', () => {
    const plan = renderBeatsPlan(COMPOSITION, { bars: 99, loops: 99 });
    // last event: beat 2 + 0.5 beats @ 140bpm
    expect(plan.duration).toBeCloseTo((2 + 0.5) * (60 / 140), 6);
    // the chord is strummed: three notes of one event land at distinct times
    const chord = plan.entries.filter((e) => e.vel > 0.5 && e.dur > 0.3);
    expect(chord.length).toBe(3);
    expect(new Set(chord.map((e) => e.t)).size).toBe(3);
  });

  it('pattern: loops repeat the grid and gesture tracks lower to cue entries', () => {
    const plan = renderBeatsPlan(PATTERN, { loops: 3 });
    expect(plan.meta.loops).toBe(3);
    const loopDur = 16 * (60 / 130 / 4);
    expect(plan.duration).toBeCloseTo(3 * loopDur, 6);
    const cues = plan.entries.filter((e) => e.type === 'cue');
    // kick mask [1,0,0,0] wraps over 16 steps → 4 hits/loop × 3 loops
    expect(cues.length).toBe(12);
    expect(cues[0].gestures[0].type).toBe('thump');
    // per-loop evolving feel: the same grid cell differs across loops
    const stabs = plan.entries.filter((e) => e.type === 'note');
    expect(stabs.length).toBe(12);
    expect(stabs[0].t % loopDur).not.toBeCloseTo(stabs[4].t % loopDur, 12);
  });

  it('sfx: requires a cue when several exist, teaches the cue list', () => {
    expect(() => renderBeatsPlan(SFX)).toThrow(/pickup, land/);
    expect(() => renderBeatsPlan(SFX, { cue: 'nope' })).toThrow(/unknown cue 'nope'/);
    const plan = renderBeatsPlan(SFX, { cue: 'pickup' });
    expect(plan.meta.cue).toBe('pickup');
    expect(plan.entries).toHaveLength(1);
    expect(plan.duration).toBeGreaterThan(0.08);
    // single-cue artifacts need no cue arg
    const solo = normalizeBeatsManifest({ kind: 'beats-sfx', title: 's', cues: { only: [{ type: 'burst' }] } });
    expect(renderBeatsPlan(solo).meta.cue).toBe('only');
  });

  it('rejects bad opts and unknown kinds', () => {
    expect(() => renderBeatsPlan(AMBIENT, { bars: 0 })).toThrow(/positive integer/);
    expect(() => renderBeatsPlan(PATTERN, { loops: 1.5 })).toThrow(/positive integer/);
    expect(() => renderBeatsPlan({ kind: 'nope' })).toThrow(/unknown manifest kind/);
  });
});

describe('encodeWavPcm16', () => {
  it('writes a valid 16-bit stereo RIFF header and clamps samples', () => {
    const left = new Float32Array([0, 0.5, -0.5, 2]); // 2 must clamp to 0x7FFF
    const right = new Float32Array([0, -1, 1, -2]);
    const wav = encodeWavPcm16({ numberOfChannels: 2, sampleRate: 44100, length: 4, getChannelData: (c) => (c === 0 ? left : right) });
    expect(wav.length).toBe(44 + 4 * 4);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(22)).toBe(2);        // channels
    expect(wav.readUInt32LE(24)).toBe(44100);    // sample rate
    expect(wav.readUInt16LE(34)).toBe(16);       // bit depth
    expect(wav.readUInt32LE(40)).toBe(16);       // data bytes
    expect(wav.readInt16LE(44 + 3 * 4)).toBe(0x7FFF);      // clamped +2
    expect(wav.readInt16LE(44 + 3 * 4 + 2)).toBe(-0x8000); // clamped -2
  });
});

describe('renderBeatsOffline', () => {
  it('renders a pattern deterministically with audible output', async () => {
    const a = await renderBeatsOffline(PATTERN, { loops: 1, tail: 0.3 });
    const b = await renderBeatsOffline(PATTERN, { loops: 1, tail: 0.3 });
    expect(a.channels).toBe(2);
    expect(a.sampleRate).toBe(44100);
    const loopDur = 16 * (60 / 130 / 4);
    expect(a.durationSeconds).toBeCloseTo(loopDur + 0.3, 6);
    expect(a.wav.length).toBe(44 + Math.ceil(a.durationSeconds * 44100) * 4);
    expect(a.wav.equals(b.wav)).toBe(true);
    // non-silence: some sample exceeds -40dBFS
    let peak = 0;
    for (let off = 44; off < a.wav.length; off += 2) peak = Math.max(peak, Math.abs(a.wav.readInt16LE(off)));
    expect(peak).toBeGreaterThan(0x7FFF * 0.01);
  }, 30000);

  it('renders each remaining kind', async () => {
    const amb = await renderBeatsOffline(AMBIENT, { bars: 1, tail: 0.2 });
    expect(amb.wav.length).toBeGreaterThan(44);
    const comp = await renderBeatsOffline(COMPOSITION, { tail: 0.2 });
    expect(comp.wav.length).toBeGreaterThan(44);
    const sfx = await renderBeatsOffline(SFX, { cue: 'land', tail: 0.2 });
    expect(sfx.meta.cue).toBe('land');
    expect(sfx.wav.length).toBeGreaterThan(44);
  }, 30000);

  it('enforces the render ceiling and option bounds', async () => {
    await expect(renderBeatsOffline(AMBIENT, { bars: 1000 })).rejects.toThrow(new RegExp(`${MAX_RENDER_SECONDS}s`));
    await expect(renderBeatsOffline(AMBIENT, { bars: 1, sampleRate: 22050 })).rejects.toThrow(/44100 or 48000/);
    await expect(renderBeatsOffline(AMBIENT, { bars: 1, tail: 99 })).rejects.toThrow(/\[0, 30\]/);
  });
});
