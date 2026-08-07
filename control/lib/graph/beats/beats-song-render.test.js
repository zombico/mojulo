import { describe, expect, it } from 'vitest';

import { renderBeatsPlan, renderBeatsOffline } from './beats-render.js';
import { normalizeBeatsManifest, validateBeatsManifest } from './beats-manifest.js';

// beats-song S0 — a `patch: 'voice'` composition part sings. A voice part is not a
// synth patch: each event is a sung syllable, synthesized beside the kernel and
// spliced into the offline mix. These tests pin the plan shape (lyric alignment,
// padding, timing on the beats grid) and that a voice composition renders finite,
// deterministic audio while non-voice beats stay byte-identical.

const SONG = normalizeBeatsManifest({
  kind: 'beats-composition',
  title: 'twinkle head',
  bpm: 120,
  seed: 42,
  parts: [
    { name: 'voc', patch: 'voice', voice: { formantScale: 1.05 }, emphasis: { s: 1.4 },
      lyrics: ['twin', 'kle', 'twin', 'kle'],
      events: [
        ['0:0:0', 'C4', 1, 0.9],
        ['0:1:0', 'C4', 1, 0.9],
        ['0:2:0', 'G4', 1, 0.9],
        ['0:3:0', 'G4', 1, 0.9],
      ] },
  ],
});

// a mixed composition: a backing instrument part alongside the voice part.
const MIXED = normalizeBeatsManifest({
  kind: 'beats-composition',
  title: 'voice + piano',
  bpm: 120,
  seed: 7,
  parts: [
    { name: 'piano', patch: 'sinePluck', events: [['0:0:0', ['C3', 'E3', 'G3'], 2, 0.7]] },
    { name: 'voc', patch: 'voice', lyrics: ['la'], events: [['0:0:0', 'C4', 2, 0.9]] },
  ],
});

describe('beats-song validation', () => {
  it('accepts a voice part and its lyric/voice/emphasis fields', () => {
    const r = validateBeatsManifest({
      kind: 'beats-composition', title: 't', bpm: 120,
      parts: [{ name: 'v', patch: 'voice', lyrics: ['do'], voice: { formantScale: 1.1, detuneCents: -5 }, emphasis: { m: 2 }, events: [['0:0:0', 'C4']] }],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects malformed voice fields with a helpful message', () => {
    const bad = validateBeatsManifest({
      kind: 'beats-composition', title: 't', bpm: 120,
      parts: [{ name: 'v', patch: 'voice', lyrics: 'notarray', voice: { formantScale: -1 }, emphasis: { m: 'x' }, events: [['0:0:0', 'C4']] }],
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join('\n')).toMatch(/lyrics must be an array/);
    expect(bad.errors.join('\n')).toMatch(/formantScale must be a positive number/);
    expect(bad.errors.join('\n')).toMatch(/emphasis must be an object/);
  });

  it('still rejects an unknown non-voice patch', () => {
    const bad = validateBeatsManifest({
      kind: 'beats-composition', title: 't', bpm: 120,
      parts: [{ name: 'v', patch: 'notapatch', events: [['0:0:0', 'C4']] }],
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join('\n')).toMatch(/patch 'notapatch' is unknown/);
  });
});

describe('renderBeatsPlan — voice parts', () => {
  it('lowers each voice event to a sing entry on the beats grid', () => {
    const plan = renderBeatsPlan(SONG);
    const sing = plan.entries.filter((e) => e.type === 'sing');
    expect(sing.length).toBe(4);
    const beat = 60 / 120;
    expect(sing.map((e) => e.t)).toEqual([0, beat, 2 * beat, 3 * beat]);
    expect(sing.map((e) => e.syllable)).toEqual(['twin', 'kle', 'twin', 'kle']);
    expect(sing.map((e) => e.note)).toEqual(['C4', 'C4', 'G4', 'G4']);
    // per-part voice/emphasis knobs ride along on the entry
    expect(sing[0].voice).toEqual({ formantScale: 1.05 });
    expect(sing[0].emphasis).toEqual({ s: 1.4 });
    // duration spans the four quarter notes
    expect(plan.duration).toBeCloseTo(4 * beat, 6);
    // no warnings when lyrics match events 1:1
    expect(plan.meta.warnings).toBeUndefined();
  });

  it('is deterministic and pads/truncates a lyric mismatch instead of crashing', () => {
    const short = normalizeBeatsManifest({
      kind: 'beats-composition', title: 's', bpm: 120,
      parts: [{ name: 'v', patch: 'voice', lyrics: ['do'], events: [['0:0:0', 'C4', 1], ['0:1:0', 'D4', 1]] }],
    });
    const a = renderBeatsPlan(short);
    const b = renderBeatsPlan(short);
    expect(a).toEqual(b);
    const sing = a.entries.filter((e) => e.type === 'sing');
    expect(sing.map((e) => e.syllable)).toEqual(['do', 'la']); // second padded
    expect(a.meta.warnings[0]).toMatch(/1 lyric syllable\(s\) for 2 event\(s\)/);
  });

  it('leaves instrument parts of a mixed composition untouched', () => {
    const plan = renderBeatsPlan(MIXED);
    const notes = plan.entries.filter((e) => e.type === 'note');
    const sing = plan.entries.filter((e) => e.type === 'sing');
    // the piano chord still strums into three note entries
    expect(notes.length).toBe(3);
    expect(sing.length).toBe(1);
    // duration spans the 2-beat notes
    expect(plan.duration).toBeCloseTo(2 * (60 / 120), 6);
  });
});

describe('beats-song choir (optional ensemble register)', () => {
  const base = {
    kind: 'beats-composition', title: 'choir', bpm: 120, seed: 3,
    parts: [{ name: 'v', patch: 'voice', lyrics: ['la', 'la'],
      events: [['0:0:0', 'C4', 1], ['0:1:0', 'E4', 1]] }],
  };
  const withEnsemble = (voices) => normalizeBeatsManifest({
    ...base, parts: [{ ...base.parts[0], voice: { ensemble: { voices } } }],
  });

  it('validates ensemble voices and rejects malformed ones', () => {
    expect(validateBeatsManifest({ ...base, parts: [{ ...base.parts[0], voice: { ensemble: { voices: [{ detuneCents: 5, formantScale: 1.02, timeMs: 20 }] } } }] }).ok).toBe(true);
    const bad = validateBeatsManifest({ ...base, parts: [{ ...base.parts[0], voice: { ensemble: { voices: 'nope' } } }] });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join('\n')).toMatch(/ensemble must be \{ voices/);
    const bad2 = validateBeatsManifest({ ...base, parts: [{ ...base.parts[0], voice: { ensemble: { voices: [{ formantScale: -1 }] } } }] });
    expect(bad2.ok).toBe(false);
    expect(bad2.errors.join('\n')).toMatch(/formantScale must be a positive number/);
  });

  it('renders a 3-voice choir: deterministic, and thicker than the solo', async () => {
    const solo = normalizeBeatsManifest(base);
    const choir = withEnsemble([
      { detuneCents: 5, formantScale: 0.98, timeMs: 0 },
      { detuneCents: -7, formantScale: 1.02, timeMs: 18 },
      { detuneCents: -12, formantScale: 1.06, timeMs: 34 },
    ]);
    const a = await renderBeatsOffline(choir, { tail: 0.3 });
    const b = await renderBeatsOffline(choir, { tail: 0.3 });
    expect(a.wav.equals(b.wav)).toBe(true);              // deterministic
    const s = await renderBeatsOffline(solo, { tail: 0.3 });
    // the choir's timing spread pushes the tail out, so its render is at least as long
    expect(a.durationSeconds).toBeGreaterThanOrEqual(s.durationSeconds - 1e-9);
    // and it is audibly different from the solo (de-locked stack ≠ single voice)
    expect(a.wav.equals(s.wav)).toBe(false);
  }, 30000);
});

describe('renderBeatsOffline — singing', () => {
  it('renders a voice composition to finite, audible, deterministic audio', async () => {
    const a = await renderBeatsOffline(SONG, { tail: 0.3 });
    const b = await renderBeatsOffline(SONG, { tail: 0.3 });
    expect(a.channels).toBe(2);
    expect(a.wav.equals(b.wav)).toBe(true);
    // no NaN/Inf leaked through: the WAV is exactly the header + PCM it claims
    expect(a.wav.length).toBe(44 + Math.ceil(a.durationSeconds * 44100) * 4);
    let peak = 0;
    for (let off = 44; off < a.wav.length; off += 2) peak = Math.max(peak, Math.abs(a.wav.readInt16LE(off)));
    expect(peak).toBeGreaterThan(0x7FFF * 0.01);
  }, 30000);

  it('renders a mixed voice + instrument composition', async () => {
    const mix = await renderBeatsOffline(MIXED, { tail: 0.3 });
    expect(mix.wav.length).toBeGreaterThan(44);
  }, 30000);
});
