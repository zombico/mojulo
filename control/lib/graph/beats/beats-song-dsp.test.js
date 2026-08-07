import { describe, expect, it } from 'vitest';

import {
  noteHz,
  mulberry32,
  noiseSrc,
  readWavMono,
  trim,
  resampleTo,
  detectF0,
  bandpass,
  highpass,
  biquad,
  lowpass1,
  preEmph,
  normalizePeak,
} from './beats-song-dsp.js';

// build a minimal 16-bit PCM mono WAV buffer for readWavMono round-trips
function buildInt16Wav(samples, sr = 24000) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), i * 2);
  const buf = Buffer.alloc(44 + data.length);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(data.length, 40); data.copy(buf, 44);
  return buf;
}

const sine = (freq, sr, n) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * freq * i) / sr));
const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);

describe('noteHz', () => {
  it('maps note names to equal-temperament Hz', () => {
    expect(noteHz('A4')).toBeCloseTo(440, 6);
    expect(noteHz('C4')).toBeCloseTo(261.626, 2);
    expect(noteHz('A5')).toBeCloseTo(880, 6);
    expect(noteHz('Bb1')).toBeCloseTo(58.27, 1);
    expect(noteHz('F#3')).toBeCloseTo(185.0, 1);
  });
  it('passes bare numbers through as Hz', () => {
    expect(noteHz(293)).toBe(293);
  });
  it('throws on a bad name', () => {
    expect(() => noteHz('H2')).toThrow(/bad note name/);
  });
});

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it('yields values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('noiseSrc', () => {
  it('is seeded and in [-1, 1)', () => {
    const n = noiseSrc(64, mulberry32(3));
    expect(n).toHaveLength(64);
    for (const v of n) { expect(v).toBeGreaterThanOrEqual(-1); expect(v).toBeLessThan(1); }
    expect(Array.from(noiseSrc(8, mulberry32(9)))).toEqual(Array.from(noiseSrc(8, mulberry32(9))));
  });
});

describe('readWavMono', () => {
  it('round-trips int16 PCM samples', () => {
    const src = sine(200, 24000, 480);
    const { data, sr } = readWavMono(buildInt16Wav(src, 24000));
    expect(sr).toBe(24000);
    expect(data).toHaveLength(480);
    for (let i = 0; i < 480; i++) expect(data[i]).toBeCloseTo(src[i], 3);
  });
  it('throws on a non-WAV buffer', () => {
    expect(() => readWavMono(Buffer.from('not a wav at all really'))).toThrow(/RIFF\/WAVE/);
  });
});

describe('trim', () => {
  it('strips leading and trailing near-silence', () => {
    const d = Float32Array.from([0, 0.001, 0.5, -0.6, 0.001, 0]);
    const t = trim(d, 0.02);
    expect(t[0]).toBeCloseTo(0.5);
    expect(t[t.length - 1]).toBeCloseTo(-0.6);
  });
});

describe('resampleTo', () => {
  it('hits the exact target length and preserves endpoints', () => {
    const x = Float32Array.from([0, 1, 2, 3, 4]);
    const up = resampleTo(x, 9);
    expect(up).toHaveLength(9);
    expect(up[0]).toBeCloseTo(0);
    expect(up[8]).toBeCloseTo(4);
    expect(up[4]).toBeCloseTo(2);   // midpoint of a linear ramp
  });
  it('squishes down without touching endpoints', () => {
    const x = sine(3, 100, 100);
    const down = resampleTo(x, 40);
    expect(down).toHaveLength(40);
    expect(down[0]).toBeCloseTo(x[0], 5);
    expect(down[39]).toBeCloseTo(x[99], 5);
  });
});

describe('detectF0', () => {
  it('recovers the pitch of a synthetic vowel-range sine', () => {
    const sr = 24000;
    expect(detectF0(sine(220, sr, sr), sr)).toBeCloseTo(220, 0);
    expect(detectF0(sine(293, sr, sr), sr)).toBeCloseTo(293, 0);
  });
  it('falls back when the range excludes the true pitch', () => {
    const sr = 24000;
    expect(detectF0(sine(80, sr, sr), sr, { fMin: 150, fMax: 350, fallback: 222 })).toBeGreaterThan(0);
  });
});

describe('filters', () => {
  const sr = 24000;
  it('lowpass1 attenuates a high tone more than a low tone', () => {
    const lo = lowpass1(sine(100, sr, sr), sr, 500);
    const hi = lowpass1(sine(6000, sr, sr), sr, 500);
    expect(rms(hi)).toBeLessThan(rms(lo));
  });
  it('bandpass passes its centre and rejects far-off tones', () => {
    const k = bandpass(sr, 1000, 6);
    const atCentre = rms(biquad(sine(1000, sr, sr), k));
    const farOff = rms(biquad(sine(4000, sr, sr), k));
    expect(atCentre).toBeGreaterThan(farOff);
  });
  it('highpass rejects a low tone', () => {
    const k = highpass(sr, 2000);
    const low = rms(biquad(sine(100, sr, sr), k));
    const high = rms(biquad(sine(6000, sr, sr), k));
    expect(high).toBeGreaterThan(low);
  });
  it('preEmph kills DC and keeps length', () => {
    const dc = Float32Array.from({ length: 128 }, () => 0.5);
    const out = preEmph(dc);
    expect(out).toHaveLength(128);
    expect(Math.abs(out[64])).toBeLessThan(0.02);   // steady DC → ~0 after the first sample
  });
});

describe('normalizePeak', () => {
  it('scales the peak to the requested level in place', () => {
    const x = Float32Array.from([0.1, -0.3, 0.15]);
    const out = normalizePeak(x, 0.9);
    expect(out).toBe(x);   // in place
    let m = 0; for (const v of x) m = Math.max(m, Math.abs(v));
    expect(m).toBeCloseTo(0.9, 5);
  });
  it('leaves an all-zero buffer alone', () => {
    const z = new Float32Array(4);
    expect(Array.from(normalizePeak(z))).toEqual([0, 0, 0, 0]);
  });
});
