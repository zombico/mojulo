import { describe, expect, it } from 'vitest';

import { buildBeatsKernel } from './beats-kernel.js';
import { PATCHES } from './audio-patches.js';
import { renderBeatsOffline } from './beats-render.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';
import { decodeWav, lrCorrelation, rms, peak, pitchHz, cents, t60, bandpass, magnitudeSpectrum, centroid, bandEnergy } from './audio-measure.js';
import { renderBeatsPlan, truePeakDb, integratedLufs } from './beats-render.js';
import { resolveInstrument } from './instruments.js';

// Audio fidelity — the machine gates. Every behavior here is opt-in (a new
// param, patch name, or model value); beats-render.baseline.test.js pins that
// rows without the opt-ins still render byte-identical. These tests measure
// what the opt-ins do. None of them is an ears gate: nobody listened here.

const K = buildBeatsKernel();
const SR = 44100;

async function render(manifest, opts = {}) {
  const { wav } = await renderBeatsOffline(normalizeBeatsManifest(manifest), { tail: 0.5, ...opts });
  return decodeWav(wav).channels;
}
const comp = (parts, extra = {}) => ({ kind: 'beats-composition', title: 'fidelity probe', bpm: 120, seed: 7, parts, ...extra });

describe('phase 1 — pan, width, per-hit noise, exponential envelopes', () => {
  it('noteKey is pure and separates channel, onset and pitch', () => {
    const k = K.noteKey(7, 'hat', 0.5, 440);
    expect(K.noteKey(7, 'hat', 0.5, 440)).toBe(k);
    expect(K.noteKey(7, 'hat', 1.0, 440)).not.toBe(k);
    expect(K.noteKey(7, 'snare', 0.5, 440)).not.toBe(k);
    expect(K.noteKey(7, 'hat', 0.5, 441)).not.toBe(k);
    expect(K.noteKey(8, 'hat', 0.5, 440)).not.toBe(k);
  });

  it('resolvePatch returns the shelf object untouched without patchParams, a merged copy with them', () => {
    expect(K.resolvePatch(PATCHES, { patch: 'hat' })).toBe(PATCHES.hat);
    const merged = K.resolvePatch(PATCHES, { patch: 'hat', patchParams: { vary: true } });
    expect(merged).toEqual({ ...PATCHES.hat, vary: true });
    expect(PATCHES.hat.vary).toBeUndefined();
    expect(K.resolvePatch(PATCHES, null)).toBe(PATCHES.sinePluck);
  });

  it('gate: a panned mix decorrelates L/R below 0.8 (unpanned is ~mono)', async () => {
    const parts = (pan) => [
      { name: 'keys', instrument: 'piano', ...(pan ? { pan: -0.7 } : {}), events: [['0:0:0', ['C3', 'E3', 'G3'], '1:0:0', 0.8]] },
      { name: 'hat', patch: 'hat', ...(pan ? { pan: 0.8 } : {}), events: [0, 1, 2, 3].map((b) => [`0:${b}:0`, 'C1', '0:0:1', 0.9]) },
      { name: 'vln', patch: 'violin', ...(pan ? { patchParams: { width: 1 } } : {}), events: [['0:0:0', 'E5', '1:0:0', 0.7]] },
    ];
    const [L0, R0] = await render(comp(parts(false)));
    const [L1, R1] = await render(comp(parts(true)));
    expect(lrCorrelation(L0, R0)).toBeGreaterThan(0.95);
    expect(lrCorrelation(L1, R1)).toBeLessThan(0.8);
  });

  it('gate: vary makes two identical hat hits differ (diff > 0.3); without it they are identical', async () => {
    const hits = (pp) => comp([{ name: 'hat', patch: 'hat', ...(pp ? { patchParams: pp } : {}), events: [['0:0:0', 'C1', '0:0:1', 0.9], ['0:1:0', 'C1', '0:0:1', 0.9]] }]);
    const diffOf = (L) => {
      const beat = Math.round(0.5 * SR);
      let d = 0, e = 0;
      for (let i = 0; i < 1500; i++) { d += Math.abs(L[i] - L[i + beat]); e += Math.abs(L[i]); }
      return d / e;
    };
    expect(diffOf((await render(hits(null)))[0])).toBeLessThan(0.001);
    expect(diffOf((await render(hits({ vary: true })))[0])).toBeGreaterThan(0.3);
  });

  it("curve: 'exp' releases exponentially — far below the linear ramp at mid-release", async () => {
    const note = (pp) => comp([{ name: 'pad', patch: 'pad', ...(pp ? { patchParams: pp } : {}), events: [['0:0:0', 'A3', '0:2:0', 0.8]] }]);
    // pad: attack 1.4 + decay 0.4, so the release starts at 1.8 s and lasts 3.5 s.
    const mid = Math.round((1.8 + 1.75) * SR);
    const lin = rms((await render(note(null), { tail: 4 }))[0], mid, mid + 2048);
    const exp = rms((await render(note({ curve: 'exp' }), { tail: 4 }))[0], mid, mid + 2048);
    expect(20 * Math.log10(exp / lin)).toBeLessThan(-15);
  });

  it('validation teaches pan and patchParams', () => {
    const bad = validateBeatsManifest(comp([{ name: 'a', patch: 'hat', pan: 2, patchParams: { curve: 'log', vary: 'yes', width: 3 }, events: [['0:0:0', 'C1']] }]));
    expect(bad.ok).toBe(false);
    expect(bad.errors.join('\n')).toMatch(/pan must be a number in \[-1, 1\]/);
    expect(bad.errors.join('\n')).toMatch(/patchParams.curve/);
    expect(bad.errors.join('\n')).toMatch(/patchParams.vary/);
    expect(bad.errors.join('\n')).toMatch(/patchParams.width/);
    expect(validateBeatsManifest(comp([{ name: 'a', patch: 'hat', pan: -0.5, patchParams: { vary: true }, events: [['0:0:0', 'C1']] }])).ok).toBe(true);
  });
});

// the string buffers are built by the engine against a real (offline) context.
async function stringEngine() {
  const { OfflineAudioContext } = await import('node-web-audio-api');
  return K.createEngine(new OfflineAudioContext(1, SR, SR));
}

describe('phase 2 — the tuned string', () => {
  const NOTES = ['E2', 'A2', 'E3', 'A3', 'E4', 'A4', 'E5', 'A5', 'C6', 'E6', 'C7'];

  it("gate: tune:'exact' holds |cents| ≤ 2 from E2 to C7 (the old loop runs up to +42)", async () => {
    const eng = await stringEngine();
    for (const name of ['guitarClean', 'piano', 'harpsichord']) {
      let worstOld = 0;
      for (const n of NOTES) {
        const hz = K.noteHz(n);
        const at = Math.floor(SR * 0.15);
        const exact = eng.stringBuffer(hz, { ...PATCHES[name], tune: 'exact' }).getChannelData(0);
        expect(Math.abs(cents(pitchHz(exact, SR, at, 4096, hz), hz)), `${name} ${n}`).toBeLessThanOrEqual(2);
        const old = eng.stringBuffer(hz, PATCHES[name]).getChannelData(0);
        worstOld = Math.max(worstOld, Math.abs(cents(pitchHz(old, SR, at, 4096, hz), hz)));
      }
      expect(worstOld).toBeGreaterThan(15); // the finding this fixes, still true of the default loop
    }
  });

  it('gate: ringT60 sets the fundamental T60 within ±10% at A2/A4/A5, in seconds, not per period', async () => {
    const eng = await stringEngine();
    for (const T of [1.5, 3]) {
      for (const n of ['A2', 'A4', 'A5']) {
        const hz = K.noteHz(n);
        const y = eng.stringBuffer(hz, { ...PATCHES.guitarClean, ringT60: T }).getChannelData(0);
        const got = t60(bandpass(y, SR, hz, 8), SR);
        expect(got, `${n} T60=${T}`).toBeGreaterThan(T * 0.9);
        expect(got, `${n} T60=${T}`).toBeLessThan(T * 1.1);
      }
    }
  });

  it('ringT60 pair interpolates by register: long bass, short treble', async () => {
    const eng = await stringEngine();
    const at = (n) => { const hz = K.noteHz(n); return t60(bandpass(eng.stringBuffer(hz, { ...PATCHES.piano, ringT60: [6, 1] }).getChannelData(0), SR, hz, 8), SR); };
    expect(at('C2')).toBeCloseTo(6, 0);
    expect(at('C5')).toBeGreaterThan(1.3);
    expect(at('C5')).toBeLessThan(at('C3'));
  });

  it('gate: no step at the buffer end — maxRing defaults to 1.1 × T60 and the tail fades to zero', async () => {
    const eng = await stringEngine();
    const hz = K.noteHz('E2');
    const old = eng.stringBuffer(hz, PATCHES.guitarClean).getChannelData(0);
    expect(rms(old, old.length - 512)).toBeGreaterThan(0.01); // the finding: a live cut at the cap
    const y = eng.stringBuffer(hz, { ...PATCHES.guitarClean, ringT60: 4 }).getChannelData(0);
    expect(y.length).toBe(Math.floor(SR * 4.4));
    expect(y[y.length - 1]).toBe(0);
    let jump = 0;
    for (let i = y.length - 2000; i < y.length; i++) jump = Math.max(jump, Math.abs(y[i] - y[i - 1]));
    expect(jump).toBeLessThan(0.01);
  });

  it('stiffness stretches the upper partials while the fundamental stays in tune', async () => {
    const eng = await stringEngine();
    const hz = K.noteHz('A4'), N = 65536;
    const y = eng.stringBuffer(hz, { ...PATCHES.piano, stiffness: 0.5, ringT60: 4 }).getChannelData(0);
    const mag = magnitudeSpectrum(y, 2000, N);
    const peakNear = (f) => {
      let bk = 0, bv = 0;
      for (let k = Math.round((f * 0.97 * N) / SR); k <= Math.round((f * 1.06 * N) / SR); k++) if (mag[k] > bv) { bv = mag[k]; bk = k; }
      const a = mag[bk - 1], b = mag[bk], c = mag[bk + 1];
      return ((bk + (0.5 * (a - c)) / (a - 2 * b + c)) * SR) / N;
    };
    const f1 = peakNear(hz);
    expect(Math.abs(cents(f1, hz))).toBeLessThan(2);
    expect(cents(peakNear(8 * f1), 8 * f1)).toBeGreaterThan(8);
  });

  it('pianoGrand / grand-piano are new names; piano is untouched', () => {
    expect(PATCHES.piano.tune).toBeUndefined();
    expect(PATCHES.pianoGrand).toMatchObject({ voice: 'string', tune: 'exact', stiffness: 0.5 });
    expect(resolveInstrument('grand-piano').patch).toBe('pianoGrand');
    const bad = validateBeatsManifest(comp([{ name: 'a', patch: 'piano', patchParams: { tune: 'close', ringT60: [0, 2], stiffness: 2 }, events: [['0:0:0', 'C4']] }]));
    expect(bad.errors.join('\n')).toMatch(/tune[\s\S]*ringT60[\s\S]*stiffness/);
  });
});

describe('phase 3 — expression wiring', () => {
  it('glideNotes is pure: each event gets its own row\'s previous note; wrap seeds a loop\'s second pass', () => {
    const evs = [{ channel: 'a', notes: ['C4'] }, { channel: 'b', notes: ['E3'] }, { channel: 'a', notes: ['D4'] }, { channel: 'a', notes: ['G3', 'G4'] }];
    expect(K.glideNotes(evs)).toEqual([null, null, 'C4', 'D4']);
    expect(K.glideNotes(evs, true)).toEqual(['G4', 'E3', 'C4', 'D4']);
    expect(K.glideNotes(evs)).toEqual(K.glideNotes(evs));
  });

  it('only gliding rows carry glideFrom in the render plan (other plans are unchanged)', () => {
    const m = normalizeBeatsManifest(comp([
      { name: 'lead', patch: 'organ', glide: 0.2, events: [['0:0:0', 'C4'], ['0:1:0', 'G4'], ['0:2:0', 'E4']] },
      { name: 'bass', patch: 'bassMono', events: [['0:0:0', 'C2'], ['0:2:0', 'G2']] },
    ]));
    const lead = renderBeatsPlan(m).entries.filter((e) => e.channel === 'lead');
    expect(lead.map((e) => e.glideFrom)).toEqual([undefined, 'C4', 'G4']);
    renderBeatsPlan(m).entries.filter((e) => e.channel === 'bass').forEach((e) => expect('glideFrom' in e).toBe(false));
  });

  it('glide slides in from the previous pitch, then lands', async () => {
    const [L] = await render(comp([{ name: 'lead', patch: 'organ', glide: 0.3, events: [['0:0:0', 'C4', '0:2:0'], ['0:2:0', 'C5', '0:2:0']] }]));
    const on = Math.round(SR * 1.0);
    const early = pitchHz(L, SR, on + Math.round(SR * 0.01), 1024, K.noteHz('F4'));
    const late = pitchHz(L, SR, on + Math.round(SR * 0.7), 2048, K.noteHz('C5'));
    expect(early).toBeLessThan(K.noteHz('A4'));
    expect(Math.abs(cents(late, K.noteHz('C5')))).toBeLessThan(10);
  });

  it('gate: brass v2 centroid rises monotonically with velocity (v1 ignores it under filterEnv)', async () => {
    const at = async (patch, vel) => {
      const [L] = await render(comp([{ name: 'b', patch, events: [['0:0:0', 'C4', '0:2:0', vel]] }]));
      return centroid(L, SR, Math.round(SR * 0.3), 8192);
    };
    const v2 = [await at('trumpet2', 0.3), await at('trumpet2', 0.6), await at('trumpet2', 0.95)];
    expect(v2[1]).toBeGreaterThan(v2[0] * 1.05);
    expect(v2[2]).toBeGreaterThan(v2[1] * 1.05);
    const v1 = [await at('trumpet', 0.3), await at('trumpet', 0.95)];
    expect(Math.abs(v1[1] / v1[0] - 1)).toBeLessThan(0.05);
  });

  it('gate: keyTrack 1 holds centroid/f0 roughly constant across octaves', async () => {
    const ratios = async (pp) => {
      const out = [];
      for (const n of ['C2', 'C3', 'C4', 'C5']) {
        const [L] = await render(comp([{ name: 'b', patch: 'bassMono', ...(pp ? { patchParams: pp } : {}), events: [['0:0:0', n, '0:2:0', 0.8]] }]));
        out.push(centroid(L, SR, Math.round(SR * 0.1), 8192) / K.noteHz(n));
      }
      return Math.max(...out) / Math.min(...out);
    };
    expect(await ratios({ keyTrack: 1 })).toBeLessThan(1.6);
    expect(await ratios(null)).toBeGreaterThan(3);
  });

  it('drift walks the pitch; vibrato.spread de-locks the unison; both seeded', async () => {
    const note = (pp) => comp([{ name: 'o', patch: 'organ', patchParams: { unison: 1, ...pp }, events: [['0:0:0', 'A4', '2:0:0', 0.8]] }]);
    const spreadOf = (L) => {
      const cs = [];
      for (let s = 0.3; s < 3.8; s += 0.25) cs.push(cents(pitchHz(L, SR, Math.round(SR * s), 2048, 440), 440));
      const m = cs.reduce((a, b) => a + b, 0) / cs.length;
      return Math.sqrt(cs.reduce((a, b) => a + (b - m) ** 2, 0) / cs.length);
    };
    expect(spreadOf((await render(note({})))[0])).toBeLessThan(0.5);
    const drifted = (await render(note({ drift: 20 })))[0];
    expect(spreadOf(drifted)).toBeGreaterThan(3);
    expect((await render(note({ drift: 20 })))[0]).toEqual(drifted);
    const locked = (await render(comp([{ name: 'v', patch: 'violin', events: [['0:0:0', 'A4', '1:0:0']] }])))[0];
    const free = (await render(comp([{ name: 'v', patch: 'violin', patchParams: { vibrato: { rate: 5.8, depth: 12, spread: 1 } }, events: [['0:0:0', 'A4', '1:0:0']] }])))[0];
    expect(rms(free.map((v, i) => v - locked[i]))).toBeGreaterThan(rms(locked) * 0.2);
  });

  it('breath lays air under the note; decayTrack shortens high modal notes', async () => {
    const band = async (pp) => {
      const [L] = await render(comp([{ name: 'o', patch: 'organ', ...(pp ? { patchParams: pp } : {}), events: [['0:0:0', 'C4', '1:0:0', 0.8]] }]));
      return bandEnergy(L, SR, Math.round(SR * 0.5), 8192, 6000, 9000);
    };
    expect(await band({ breath: { level: -18, tone: 7500, q: 1 } })).toBeGreaterThan(10 * (await band(null)));
    const ring = async (n, pp) => {
      const [L] = await render(comp([{ name: 'c', patch: 'celesta', ...(pp ? { patchParams: pp } : {}), events: [['0:0:0', n, '0:1:0', 0.8]] }]), { tail: 2 });
      return t60(bandpass(L, SR, K.noteHz(n), 8), SR);
    };
    expect((await ring('C6', { decayTrack: 1 })) / (await ring('C4', { decayTrack: 1 }))).toBeLessThan(0.4);
    expect((await ring('C6')) / (await ring('C4'))).toBeGreaterThan(0.8);
  });

  it('v2 section names are new; the originals are unchanged; validation teaches', () => {
    expect(PATCHES.violin.vibrato.spread).toBeUndefined();
    expect(PATCHES.trumpet.velToFilter).toBeUndefined();
    expect(PATCHES.violin2.vibrato).toMatchObject({ rate: 5.8, depth: 12, spread: 1 });
    expect(PATCHES.trumpet2).toMatchObject({ velToFilter: 1.3, keyTrack: 0.5 });
    for (const n of ['violin-2', 'viola-2', 'cello-2', 'contrabass-2', 'trumpet-2', 'french-horn-2', 'trombone-2', 'tuba-2']) expect(PATCHES[resolveInstrument(n).patch]).toBeTruthy();
    const bad = validateBeatsManifest(comp([{ name: 'a', patch: 'organ', glide: 5, patchParams: { keyTrack: -1, drift: 'lots', breath: 3, vibrato: { spread: 4 } }, events: [['0:0:0', 'C4']] }]));
    const msg = bad.errors.join('\n');
    for (const k of ['glide must be seconds', 'keyTrack', 'drift', 'breath', 'vibrato']) expect(msg).toContain(k);
  });
});

describe('phase 4 — drum kit and metal', () => {
  const sfx = (g) => ({ kind: 'beats-sfx', title: 'ring probe', cues: { a: [{ type: 'ring', ...g }] } });

  it("gate: ring material:'cymbal' has an attack centroid > 4 kHz (a sine metal at E4 sits near 1 kHz)", async () => {
    const [metal] = await render(sfx({ material: 'metal', note: 'E4' }));
    const [cym] = await render(sfx({ material: 'cymbal' }));
    const [cymLow] = await render(sfx({ material: 'cymbal', note: 'E4' }));
    expect(centroid(metal, SR, 0, 2048)).toBeLessThan(1500);
    expect(centroid(cym, SR, 0, 2048)).toBeGreaterThan(4000);
    expect(centroid(cymLow, SR, 0, 2048)).toBeGreaterThan(4000);
  });

  it("ring excite:'noise' lowers to band-noise modes at the partial frequencies; plate/bell are denser sets", async () => {
    const ops = K.gesturePlan({ type: 'ring', material: 'metal', note: 'A5', excite: 'noise', q: 20 });
    expect(ops).toHaveLength(4);
    ops.forEach((op) => { expect(op.kind).toBe('noise'); expect(op.q).toBe(20); });
    expect(ops[1].bandpass).toBeCloseTo(K.noteHz('A5') * 2.76, 6);
    const [L] = await render(sfx({ material: 'metal', note: 'A5', excite: 'noise' }));
    expect(rms(L, 0, 4410)).toBeGreaterThan(0.01);
    expect(K.gesturePlan({ type: 'ring', material: 'plate' }).length).toBeGreaterThan(6);
    expect(K.gesturePlan({ type: 'ring', material: 'bell' })[0].from).toBeCloseTo(K.noteHz('C4'), 6); // the hum, an octave under
    // the original materials lower exactly as before (no new op fields)
    expect(Object.keys(K.gesturePlan({ type: 'ring', material: 'glass' })[0]).sort()).toEqual(['at', 'decay', 'from', 'kind', 'to', 'vol']);
  });

  it('drumKit resolves GM notes to pieces (enharmonics too); unmapped notes are skipped', () => {
    expect(K.resolvePatch(PATCHES, { patch: 'drumKit' }, 'C2')).toBe(PATCHES.kick2);
    expect(K.resolvePatch(PATCHES, { patch: 'drumKit' }, 'Gb2')).toBe(PATCHES.hat808);
    expect(K.resolvePatch(PATCHES, { patch: 'drumKit' }, 'C4')).toBeNull();
    expect(K.resolvePatch(PATCHES, { patch: 'drumKit', patchParams: { vary: false } }, 'D2')).toEqual({ ...PATCHES.snare2, vary: false });
  });

  it('kit pieces are layered: kick2 carries a click, snare2 a tonal body, the 808 hat is bright', async () => {
    const hit = async (patch, note = 'C1') => (await render(comp([{ name: 'd', patch, events: [['0:0:0', note, '0:0:1', 0.9]] }])))[0];
    const [kick, kick2, burst, snare2, hat808] = [await hit('kick'), await hit('kick2', 'C2'), await hit('burstSoft'), await hit('snare2', 'D2'), await hit('hat808', 'F#2')];
    expect(bandEnergy(kick2, SR, 0, 1024, 2000, 8000)).toBeGreaterThan(10 * bandEnergy(kick, SR, 0, 1024, 2000, 8000));
    expect(bandEnergy(snare2, SR, 0, 4096, 150, 230)).toBeGreaterThan(10 * bandEnergy(burst, SR, 0, 4096, 150, 230));
    expect(centroid(hat808, SR, 0, 2048)).toBeGreaterThan(7000);
  });

  it('a drum-kit part renders its pieces, and vary makes repeated hits differ', async () => {
    const [L] = await render(comp([{ name: 'kit', instrument: 'drum-kit', feel: 'robotic', events: [['0:0:0', 'D2', '0:0:1', 0.9], ['0:1:0', 'D2', '0:0:1', 0.9]] }]));
    const beat = Math.round(0.5 * SR);
    let d = 0, e = 0;
    for (let i = 0; i < 3000; i++) { d += Math.abs(L[i] - L[i + beat]); e += Math.abs(L[i]); }
    expect(e).toBeGreaterThan(1);
    expect(d / e).toBeGreaterThan(0.1);
  });

  it('validation teaches kit notes, ring wave/excite, burst bandpass', () => {
    const bad = validateBeatsManifest(comp([{ name: 'kit', instrument: 'drum-kit', events: [['0:0:0', ['C2', 'C4']]] }]));
    expect(bad.errors.join('\n')).toMatch(/'C4' has no drum-kit piece/);
    const pat = validateBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 120, tracks: [{ name: 'kit', instrument: 'drum-kit', mask: [1] }] });
    expect(pat.errors.join('\n')).toMatch(/drum-kit track needs notes/);
    expect(validateBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 120, tracks: [{ name: 'kit', instrument: 'drum-kit', mask: [1, 1], notes: [['C2', 'F#2'], 'F#2'] }] }).ok).toBe(true);
    const cue = validateBeatsManifest({ kind: 'beats-sfx', title: 's', cues: { a: [{ type: 'ring', material: 'cymbal', wave: 'pulse', excite: 'air' }, { type: 'burst', bandpass: -3 }] } });
    expect(cue.errors.join('\n')).toMatch(/wave must be one of[\s\S]*excite must be 'noise'[\s\S]*bandpass must be/);
    expect(validateBeatsManifest(sfx({ material: 'bell', excite: 'noise', q: 40 })).ok).toBe(true);
  });
});

describe('phase 5 — room, bus, export', () => {
  it("gate: reverb model 'room2' — highs die before lows; pre-delay; independent L/R", async () => {
    const eng = await stringEngine();
    const ir = eng.impulse({ model: 'room2', decay: 2 }, 7);
    const [L, R] = [ir.getChannelData(0), ir.getChannelData(1)];
    const lo = t60(bandpass(L, SR, 250, 2), SR), hi = t60(bandpass(L, SR, 6000, 2), SR);
    expect(hi).toBeLessThan(lo * 0.7);
    expect(lo).toBeGreaterThan(1.4);
    expect(rms(L, 0, Math.round(SR * 0.015))).toBe(0);
    expect(Math.abs(lrCorrelation(L, R))).toBeLessThan(0.2);
    const old = eng.impulse({ decay: 2 }, 7).getChannelData(0);
    expect(t60(bandpass(old, SR, 6000, 2), SR) / t60(bandpass(old, SR, 250, 2), SR)).toBeGreaterThan(0.8);
  });

  it('a shared room: sends feed one stereo space; rows without send stay dry', async () => {
    const parts = (send) => [{ name: 'p', patch: 'sinePluck', ...(send ? { send } : {}), events: [['0:0:0', 'C5', '0:0:2', 0.9]] }];
    const [dL] = await render(comp(parts()), { tail: 2 });
    const [wL, wR] = await render(comp(parts(0.6), { room: { decay: 2 } }), { tail: 2 });
    const tail = Math.round(SR * 1.2);
    expect(rms(wL, tail, tail + SR * 0.5)).toBeGreaterThan(10 * rms(dL, tail, tail + SR * 0.5) + 1e-4);
    expect(lrCorrelation(wL.subarray(tail), wR.subarray(tail))).toBeLessThan(0.5);
    const [sameL] = await render(comp(parts(), { room: { decay: 2 } }), { tail: 2 });
    expect(sameL).toEqual(dL);
  });

  it('master.limit holds a loud mix down', async () => {
    const loud = (extra) => comp([{ name: 'b', patch: 'sawStab', events: [['0:0:0', ['C3', 'G3', 'C4', 'E4', 'G4'], '0:2:0', 1]] }, { name: 'k', patch: 'kick', events: [['0:0:0', 'C1', '0:1:0', 1]] }], extra);
    const [a] = await render(loud());
    const [b] = await render(loud({ master: { limit: -12, glue: { threshold: -18 } } }));
    expect(peak(b)).toBeLessThan(peak(a) * 0.8);
  });

  it('LUFS and true-peak meters read a known signal', () => {
    const y = new Float32Array(SR * 2);
    for (let i = 0; i < y.length; i++) y[i] = 0.1 * Math.sin((2 * Math.PI * 997 * i) / SR);
    expect(integratedLufs([y, y], SR)).toBeCloseTo(-20, 0);
    expect(truePeakDb([y])).toBeCloseTo(-20, 0);
  });

  it('gate: 24-bit and 32-bit float round-trip; 16-bit dither is seeded and within 2 LSB', async () => {
    const m = comp([{ name: 'p', instrument: 'piano', events: [['0:0:0', ['C4', 'E4'], '0:2:0', 0.8]] }]);
    const [p16] = await render(m);
    const [p24] = await render(m, { bitDepth: 24 });
    const [p32] = await render(m, { bitDepth: 32 });
    let e24 = 0, e16 = 0;
    for (let i = 0; i < p32.length; i++) { e24 = Math.max(e24, Math.abs(p24[i] - p32[i])); e16 = Math.max(e16, Math.abs(p16[i] - p32[i])); }
    expect(e24).toBeLessThanOrEqual(1 / 8388607);
    expect(e16).toBeLessThanOrEqual(1 / 32767);
    const [d1] = await render(m, { dither: true });
    const [d2] = await render(m, { dither: true });
    expect(d1).toEqual(d2);
    expect(d1).not.toEqual(p16);
    let ed = 0;
    for (let i = 0; i < d1.length; i++) ed = Math.max(ed, Math.abs(d1[i] - p16[i]));
    expect(ed).toBeLessThanOrEqual(2.01 / 32767);
  });

  it('gate: normalize respects −1 dBTP; a LUFS target lands (or stops at the ceiling, and says so)', async () => {
    const m = comp([{ name: 'p', instrument: 'piano', events: [['0:0:0', ['C3', 'G3', 'E4'], '1:0:0', 0.8]] }]);
    const { wav, meta } = await renderBeatsOffline(normalizeBeatsManifest(m), { tail: 0.5, normalize: { peak: -1 }, bitDepth: 24 });
    const chans = decodeWav(wav).channels;
    expect(truePeakDb(chans)).toBeLessThanOrEqual(-0.99);
    expect(meta.export.truePeakDb).toBeCloseTo(-1, 1);
    const quiet = await renderBeatsOffline(normalizeBeatsManifest({ ...m, export: { normalize: { lufs: -23 } } }), { tail: 0.5 });
    expect(integratedLufs(decodeWav(quiet.wav).channels, SR)).toBeCloseTo(-23, 0);
    expect(quiet.meta.export.lufs).toBeCloseTo(-23, 1);
  });

  it('validation teaches room, send, master and export', () => {
    const bad = validateBeatsManifest(comp([{ name: 'a', patch: 'hat', send: 0.5, chain: [{ type: 'reverb', model: 'plate' }], events: [['0:0:0', 'C1']] }], {
      master: { limit: 3, glue: { ratio: 50 } }, export: { bitDepth: 20, normalize: {} },
    }));
    const msg = bad.errors.join('\n');
    for (const k of ["model must be 'room2'", 'send needs a manifest-level room', 'master.limit', 'master.glue.ratio', 'export.bitDepth', 'export.normalize']) expect(msg).toContain(k);
    expect(validateBeatsManifest(comp([{ name: 'a', patch: 'hat', send: 0.3, events: [['0:0:0', 'C1']] }], { room: { decay: 2.2, model: 'room2' }, master: { limit: -1 }, export: { bitDepth: 24, dither: true, normalize: { lufs: -14 } } })).ok).toBe(true);
  });
});

describe('shelf sanity — every fidelity patch renders finite and sane over a long note', () => {
  const NEW = ['pianoGrand', 'violin2', 'viola2', 'cello2', 'contrabass2', 'trumpet2', 'frenchHorn2', 'trombone2', 'tuba2', 'kick2', 'snare2', 'tomLo', 'tomMid', 'tomHi', 'hat808', 'hatOpen', 'ride', 'crash'];
  it.each(NEW)('%s', async (patch) => {
    const [L, R] = await render(comp([{ name: 'a', patch, events: [['0:0:0', ['C3', 'G4'], '3:0:0', 0.9], ['3:0:0', 'C5', '0:1:0', 0.5]] }]), { bitDepth: 32 });
    for (const y of [L, R]) {
      expect(y.every(Number.isFinite)).toBe(true);
      expect(peak(y)).toBeLessThan(1);
      expect(peak(y)).toBeGreaterThan(0.005);
    }
  });
});

describe('phase 6 — SFX tuned realism', () => {
  const CUE = [
    { type: 'grain', grains: 10, over: 0.1, seed: 4 },
    { type: 'ring', material: 'metal', note: 'A5' },
    { type: 'burst', decay: 0.1 },
    { type: 'flutter', rateHz: 20, hold: 0.2, jitter: 0.5, seed: 3 },
  ];
  const sfx = (cue) => ({ kind: 'beats-sfx', title: 'sfx probe', cues: { a: cue } });

  it('gate: variant 0 / absent is the plain plan, op for op; variant n is deterministic and differs', () => {
    expect(K.cuePlan(CUE, 0)).toEqual(K.cuePlan(CUE));
    expect(K.cuePlan(CUE, 3)).toEqual(K.cuePlan(CUE, 3));
    expect(K.cuePlan(CUE, 3)).not.toEqual(K.cuePlan(CUE));
    expect(K.cuePlan(CUE, 3)).not.toEqual(K.cuePlan(CUE, 4));
    // micro-jitter stays within ±15 cents / ±10 % decay
    const base = K.cuePlan([{ type: 'thump', from: 'A3', to: 'A2', decay: 0.3 }])[0];
    for (let v = 1; v < 40; v++) {
      const op = K.cuePlan([{ type: 'thump', from: 'A3', to: 'A2', decay: 0.3 }], v)[0];
      expect(Math.abs(cents(op.from, base.from))).toBeLessThanOrEqual(15.0001);
      expect(Math.abs(op.decay / base.decay - 1)).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('gate: variant renders — 0 byte-identical to the plain cue, n deterministic and distinct', async () => {
    const plain = await renderBeatsOffline(normalizeBeatsManifest(sfx(CUE)), { tail: 0.3 });
    const v0 = await renderBeatsOffline(normalizeBeatsManifest(sfx(CUE)), { tail: 0.3, variant: 0 });
    const v5a = await renderBeatsOffline(normalizeBeatsManifest(sfx(CUE)), { tail: 0.3, variant: 5 });
    const v5b = await renderBeatsOffline(normalizeBeatsManifest(sfx(CUE)), { tail: 0.3, variant: 5 });
    expect(v0.wav.equals(plain.wav)).toBe(true);
    expect(v5a.wav.equals(v5b.wav)).toBe(true);
    expect(v5a.wav.equals(plain.wav)).toBe(false);
  });

  it('a pattern gesture track with vary: every hit a variant, same counter live and exported', () => {
    const m = normalizeBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 120, steps: 16, tracks: [{ name: 'clap', gesture: { type: 'burst', decay: 0.1 }, vary: true, mask: [1, 0, 0, 0] }] });
    const cues = renderBeatsPlan(m, { loops: 2 }).entries;
    expect(cues.map((e) => e.variant)).toEqual([1, 2, 3, 4, 1001, 1002, 1003, 1004]);
    const plain = normalizeBeatsManifest({ ...m, tracks: [{ ...m.tracks[0], vary: undefined }] });
    renderBeatsPlan(plain, { loops: 1 }).entries.forEach((e) => expect('variant' in e).toBe(false));
  });

  it('tone holds, bends and trembles', async () => {
    const [op] = K.gesturePlan({ type: 'tone', note: 'A2', to: 'A3', dur: 1.5, tremolo: { rate: 8, depth: 0.6 } });
    expect(op).toMatchObject({ kind: 'hum', dur: 1.5 });
    expect(op.to / op.from).toBeCloseTo(2, 6);
    const [L] = await render(sfx([{ type: 'tone', wave: 'sine', note: 'A3', dur: 1.2, vol: 0.8 }]));
    expect(rms(L, Math.round(SR * 1.0), Math.round(SR * 1.1))).toBeGreaterThan(0.5 * rms(L, Math.round(SR * 0.2), Math.round(SR * 0.3)));
    const [B] = await render(sfx([{ type: 'tone', wave: 'sine', note: 'A3', to: 'A4', dur: 1.2 }]));
    expect(pitchHz(B, SR, Math.round(SR * 1.1), 2048, 440)).toBeGreaterThan(400);
  });

  it('physical dials: ring size → pitch by material; thump mass → lower and longer', () => {
    const at = (g) => K.gesturePlan({ type: 'ring', ...g })[0].from;
    expect(at({ material: 'plate', size: 0.3 })).toBeCloseTo(440, 0);
    expect(at({ material: 'plate', size: 0.6 })).toBeCloseTo(220, 0);
    expect(at({ material: 'metal', size: 0.3 }) / at({ material: 'metal', size: 0.1 })).toBeCloseTo(1 / 3, 6);
    const light = K.gesturePlan({ type: 'thump', mass: 0.2 })[0], heavy = K.gesturePlan({ type: 'thump', mass: 60 })[0];
    expect(heavy.from).toBeLessThan(light.from);
    expect(heavy.decay).toBeGreaterThan(light.decay);
    expect(K.gesturePlan({ type: 'thump', mass: 60, from: 'C3' })[0].from).toBeCloseTo(K.noteHz('C3'), 6);
    expect(K.gesturePlan({ type: 'thump' })[0]).toEqual({ at: 0, kind: 'thump', from: K.noteHz('G2'), to: K.noteHz('G1'), decay: 0.25, vol: 0.9 });
  });

  it('burst filterEnv darkens the noise as it decays', async () => {
    const tailCentroid = async (g) => { const [L] = await render(sfx([{ type: 'burst', decay: 0.8, ...g }])); return centroid(L, SR, Math.round(SR * 0.4), 4096); };
    expect(await tailCentroid({ filterEnv: { from: 9000, to: 250 } })).toBeLessThan(0.5 * (await tailCentroid({})));
  });

  it('validation teaches tone, size, mass, filterEnv and track vary', () => {
    const bad = validateBeatsManifest(sfx([
      { type: 'tone', wave: 'pulse', dur: 99, tremolo: 3 },
      { type: 'ring', material: 'plate', size: 0.3, note: 'A4' },
      { type: 'thump', mass: -1 },
      { type: 'burst', filterEnv: { to: -5 } },
    ]));
    const msg = bad.errors.join('\n');
    for (const k of ['wave must be one of', 'dur must be seconds', 'tremolo must be', 'size OR note', 'mass must be kg', 'filterEnv must be']) expect(msg).toContain(k);
    const pat = validateBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 120, tracks: [{ name: 'a', patch: 'hat', vary: true, mask: [1] }] });
    expect(pat.errors.join('\n')).toMatch(/vary is for gesture\/cue tracks/);
    expect(validateBeatsManifest(sfx([{ type: 'tone', note: 'E2', to: 'E3', dur: 2, vibrato: { rate: 5, depth: 20 } }, { type: 'ring', material: 'bell', size: 0.4 }])).ok).toBe(true);
  });
});

describe('world wiring — opt-ins pass through, absence adds no keys', () => {
  it('audio.sfx.vary and audio.wind.vary resolve only when set', async () => {
    const { resolveWorldAudio } = await import('./beats-world.js');
    const cues = { hit: [{ type: 'burst' }] };
    const plain = resolveWorldAudio({ sfx: { cues }, wind: true });
    expect('vary' in plain).toBe(false);
    expect('vary' in plain.wind).toBe(false);
    const on = resolveWorldAudio({ sfx: { cues, vary: true }, wind: { vary: true } });
    expect(on.vary).toBe(true);
    expect(on.wind.vary).toBe(true);
  });
});

describe('MIDI handoff for the new shelf', () => {
  it('a drum-kit row exports on channel 10 at its own GM notes', async () => {
    const { renderBeatsMidi } = await import('./beats-midi.js');
    const m = normalizeBeatsManifest(comp([{ name: 'kit', instrument: 'drum-kit', events: [['0:0:0', ['C2', 'F#2']], ['0:1:0', 'D2']] }]));
    const bytes = [...renderBeatsMidi(m).mid];
    const ons = [];
    for (let i = 0; i + 2 < bytes.length; i++) if (bytes[i] === 0x99 && bytes[i + 2] > 0) ons.push(bytes[i + 1]);
    expect(ons.sort()).toEqual([36, 38, 42]);
  });
});
