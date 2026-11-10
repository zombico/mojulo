import { describe, it, expect } from 'vitest';
import { traceSound, refineTrace, analyzeFrames, steadyHum, TRACE_BANDS, TRACE_Q, TRACE_STEP } from './trace.js';
import { buildBeatsKernel, emitBeatsKernel } from '../beats/beats-kernel.js';
import { beatsFeatures } from '../beats/beats-features.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';
import { renderBeatsOffline } from '../beats/beats-render.js';
import { decodeWav, peak } from '../beats/audio-measure.js';
import { MOUTH } from './sets/mouth.js';
import { MOUTH_TRACES } from './sets/mouth-traces.js';
import { familyCue } from './families.js';
import { SOUNDS, SOUND_IDS } from './roster.js';

const SR = 44100;
const K = buildBeatsKernel();
const mulberry32 = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const manifest = (cue) => ({ kind: 'beats-sfx', title: 'trace', cues: { c: cue } });
const render = async (cue) => decodeWav(Buffer.from((await renderBeatsOffline(manifest(cue), { cue: 'c', tail: 0.3, sampleRate: SR })).wav));

// the smallest input that is a swish: seeded noise, its band gliding down, swelling then falling, 0.2 s
function swish() {
  const rnd = mulberry32(7), n = Math.round(0.2 * SR), y = new Float32Array(n);
  let lp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, fc = 6000 * (1200 / 6000) ** t, a = Math.min(1, 2 * Math.PI * fc / SR);
    lp += a * ((rnd() * 2 - 1) - lp);                       // a one-pole lowpass at fc...
    const hp = lp - prev; prev = lp;                         // ...and its difference: a rough band at fc
    y[i] = hp * (t < 0.5 ? t / 0.5 : Math.exp(-5 * (t - 0.5))) * 4;
  }
  return y;
}

describe('the trace gesture (the kernel)', () => {
  it('lowers to one trace op on the kernel defaults the tracer mirrors', () => {
    const [op] = K.gesturePlan({ type: 'trace', lv: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] });
    expect(op).toMatchObject({ kind: 'trace', step: TRACE_STEP, q: TRACE_Q, len: TRACE_STEP });
    expect(op.bands).toEqual([...TRACE_BANDS]);
  });

  it('is an opt-in feature: a trace brings it, nothing else does', () => {
    expect(beatsFeatures(manifest([{ type: 'trace', lv: [Array(12).fill(-10)] }]))).toContain('trace');
    expect(beatsFeatures(manifest([{ type: 'burst' }]))).not.toContain('trace');
    expect(emitBeatsKernel(['trace'])).toContain("op.kind === 'trace'");
    expect(emitBeatsKernel(['sfx'])).not.toContain("'trace'");
  });

  it('is checked: every lane one value a frame, levels in range', () => {
    const lv = [Array(12).fill(-10), Array(12).fill(-12)];
    expect(validateBeatsManifest(manifest([{ type: 'trace', lv, voiced: [0, 50], pitch: [120, 120], side: [-50, 50] }])).errors ?? []).toEqual([]);
    const bad = (g) => (validateBeatsManifest(manifest([{ type: 'trace', ...g }])).errors || []).join(' ');
    expect(bad({ lv: [[0, 0]] })).toMatch(/lv must be/);
    expect(bad({ lv, side: [0] })).toMatch(/side must be 2 values/);
    expect(bad({ lv, voiced: [10, 10] })).toMatch(/voiced needs pitch/);
  });
});

describe('the tracer', () => {
  it('traces a swish and, refined, renders it back within a few dB, as long as it was', async () => {
    const y = swish();
    const { gesture, targets } = traceSound(y, SR, { voicing: false });
    expect(gesture.voiced).toBeUndefined();
    expect(gesture.lv[0]).toHaveLength(TRACE_BANDS.length);
    const { gesture: g, error } = await refineTrace(gesture, targets, (x) => render([x]), { iterations: 2 });
    expect(error).toBeLessThan(3);
    const out = await render([g]);
    const got = analyzeFrames(out.channels[0], out.sr, { frames: g.lv.length }).db;
    // where the band is loudest moves down, as the swish's did
    const loudest = (row) => row.indexOf(Math.max(...row));
    expect(loudest(got[2])).toBeGreaterThan(loudest(got[g.lv.length - 3]));
  }, 60_000);

  it('holds a hum steady: a harmonic leap pulled back to the voice, a flicker smoothed out', () => {
    const voiced = [70, 10, 80, 100, 100, 100, 100, 100, 0, 0];
    const pitch = [44, 280, 43, 45, 44, 501, 46, 45, 95, 95];
    const h = steadyHum(voiced, pitch);
    expect(Math.max(...h.pitch)).toBeLessThan(60);               // no leap survives
    const flips = (v) => v.slice(1).filter((x, k) => Math.abs(x - v[k]) > 40).length;
    expect(flips(h.voiced)).toBeLessThan(flips(voiced));
  });

  it('renders the same samples every time (seeded noise)', async () => {
    const g = { type: 'trace', lv: [Array(12).fill(-20), Array(12).fill(-10), Array(12).fill(-30)], seed: 3 };
    const [a, b] = [await render([g]), await render([g])];
    expect(Buffer.from(a.channels[0].buffer).equals(Buffer.from(b.channels[0].buffer))).toBe(true);
    expect(peak(a.channels[0])).toBeGreaterThan(0);
  });
});

describe('the mouth set', () => {
  it('is a valid beats-sfx manifest with a cue for every traced row and every row it voices', () => {
    for (const id of Object.keys(MOUTH_TRACES)) expect(MOUTH.cues[id], id).toBeDefined();
    for (const id of SOUND_IDS.filter((i) => SOUNDS[i].voices?.mouth)) expect(MOUTH.cues[id], id).toBeDefined();
    expect(validateBeatsManifest({ kind: 'beats-sfx', title: 'mouth', cues: MOUTH.cues }).errors ?? []).toEqual([]);
  });

  it('lays a hybrid trace under its family cue, the cue kept whole and in order', () => {
    const [id, e] = Object.entries(MOUTH_TRACES).find(([, x]) => x.with);
    const base = familyCue(e.with.family, e.with.dials);
    expect(MOUTH.cues[id].slice(0, base.length)).toEqual(base);
    expect(MOUTH.cues[id].at(-1).type).toBe('trace');
  });
});
