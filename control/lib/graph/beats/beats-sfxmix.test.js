import { describe, expect, it } from 'vitest';
import { OfflineAudioContext } from 'node-web-audio-api';

import { buildBeatsKernel, emitBeatsKernel, BEATS_KERNEL_FEATURES } from './beats-kernel.js';
import { audioFeatures, beatsFeatures } from './beats-features.js';
import { validateBeatsManifest, SFX_SPACE_NAMES, SFX_CHAIN_TYPES } from './beats-manifest.js';
import { renderBeatsOffline } from './beats-render.js';
import { resolveWorldAudio } from './beats-world.js';
import { decodeWav, lrCorrelation, rms, centroid, peak } from './audio-measure.js';

// The SFX mixer (kernel feature `sfxmix`): a gesture as a layer with its own chain, pan and send; the duck gesture;
// the engine's SFX bus, space, music bus and voice cap; a cue placed by its distance. Machine gates: nobody listened.

const K = buildBeatsKernel();
const SR = 44100;
const CUE = [
  { type: 'thump', from: 'E2', to: 'A1', decay: 0.25, vol: 0.6 },
  { type: 'burst', decay: 0.1, vol: 0.4, highpass: 1200 },
  { type: 'grain', grains: 20, over: 0.2, band: { lo: 2000, hi: 10000 }, vol: 0.3, seed: 7 },
];
const sfx = (cue, mix) => ({ kind: 'beats-sfx', title: 'mix probe', cues: { c: cue }, ...(mix ? { mix } : {}) });
async function render(manifest, opts = {}) {
  const { wav } = await renderBeatsOffline(manifest, { cue: 'c', tail: 1.5, ...opts });
  return decodeWav(wav).channels;
}
// the sound's length: onset to the last sample within 40 dB of the peak
function soundMs(y) {
  const f = peak(y) * 0.01;
  let a = 0, b = y.length - 1;
  while (a < y.length && Math.abs(y[a]) < f) a++;
  while (b > a && Math.abs(y[b]) < f) b--;
  return ((b - a) / SR) * 1000;
}
const onset = (y) => { const f = peak(y) * 0.01; let a = 0; while (Math.abs(y[a]) < f) a++; return a; };
const db = (r) => 20 * Math.log10(r);

describe('the plan: a layer is tagged, a plain gesture is not', () => {
  it('a plain cue\'s ops carry no layer key, with a variant or without', () => {
    for (const v of [undefined, 3]) expect(K.cuePlan(CUE, v).some((op) => 'layer' in op)).toBe(false);
  });

  it('a gesture with its own chain, pan or send tags every op it lowers to with its index', () => {
    const cue = [CUE[0], { ...CUE[1], pan: 0.5 }, { ...CUE[2], send: 0.3 }];
    for (const v of [undefined, 2]) {
      const ops = K.cuePlan(cue, v);
      expect(ops.filter((o) => o.layer === 1).length).toBe(1);
      expect(ops.filter((o) => o.layer === 2).length).toBe(CUE[2].grains);
      expect(ops.filter((o) => o.layer == null).length).toBe(1);
    }
  });

  it('a duck lowers to one silent op with its defaults', () => {
    expect(K.gesturePlan({ type: 'duck', at: 0.1 })).toEqual([{ at: 0.1, kind: 'duck', depth: 6, hold: 0.12, release: 0.45 }]);
  });

  it('the kernel\'s spaces are the ones validation knows; the mixer is a feature of its own', () => {
    expect(Object.keys(K.SFX_SPACES)).toEqual([...SFX_SPACE_NAMES]);
    expect(BEATS_KERNEL_FEATURES).toContain('sfxmix');
    const without = BEATS_KERNEL_FEATURES.filter((f) => f !== 'sfxmix' && f !== 'sustain');   // sustain implies the mixer
    expect(emitBeatsKernel(without)).not.toContain('setSfx');
    expect(emitBeatsKernel(['sfxmix'])).toContain('setSfx');
  });
});

describe('detection and validation', () => {
  it('a recipe asks for the mixer only by using it', () => {
    expect(beatsFeatures(sfx(CUE))).not.toContain('sfxmix');
    expect(beatsFeatures(sfx([{ ...CUE[0], pan: -1 }]))).toContain('sfxmix');
    expect(beatsFeatures(sfx([...CUE, { type: 'duck' }]))).toContain('sfxmix');
    expect(beatsFeatures(sfx(CUE, { space: 'open' }))).toContain('sfxmix');
    expect(beatsFeatures(sfx([{ ...CUE[0], chain: [{ type: 'crush', bits: 6 }] }]))).toContain('fx');
    expect(audioFeatures({ cues: { a: CUE } })).not.toContain('sfxmix');
    expect(audioFeatures({ cues: { a: CUE }, mix: { space: 'hangar' } })).toContain('sfxmix');
  });

  it('takes a layered cue, a duck and a mix; says what is wrong with a bad one', () => {
    const good = sfx([{ ...CUE[0], chain: SFX_CHAIN_TYPES.map((type) => ({ type })), pan: 0.2, send: 0.5 }, { type: 'duck', depth: 9 }], { space: { decay: 1.2, damp: 0.4 }, send: 0.1, voices: 8 });
    expect(validateBeatsManifest(good)).toEqual({ ok: true, errors: [] });
    const bad = validateBeatsManifest(sfx([
      { ...CUE[0], chain: [{ type: 'reverb' }] },
      { ...CUE[1], pan: 2, send: -1 },
      { type: 'duck', depth: 40, pan: 0 },
    ], { space: 'attic', voices: 0, distance: true }));
    expect(bad.ok).toBe(false);
    for (const m of ['cues.c[0].chain', 'cues.c[1].pan', 'cues.c[1].send', 'cues.c[2].depth', 'cues.c[2]: a duck', 'mix.space', 'mix.voices', 'mix.distance']) {
      expect(bad.errors.some((e) => e.startsWith(m)), m).toBe(true);
    }
  });

  it('a world carries its mix to the page, distance on unless it says false', () => {
    const cues = { boom: CUE };
    expect(resolveWorldAudio({ sfx: { cues, mix: { space: 'hangar' } } }).mix).toEqual({ space: 'hangar', distance: true });
    expect(resolveWorldAudio({ sfx: { cues, mix: { voices: 6, distance: false } } }).mix).toEqual({ voices: 6, distance: false });
    expect(resolveWorldAudio({ sfx: { cues } }).mix).toBeUndefined();
    expect(resolveWorldAudio({ sfx: { auto: 'arcade', mix: { space: 'open' } } }).mix).toEqual({ space: 'open', distance: true });
    expect(() => resolveWorldAudio({ sfx: { cues, mix: { space: 'attic' } } })).toThrow(/audio\.sfx\.mix/);
  });
});

describe('the gates (rendered as an export renders)', () => {
  it('a space lengthens the tail; vacuum darkens the sound and adds none', async () => {
    const [dry] = await render(sfx(CUE)), [hall] = await render(sfx(CUE, { space: 'hangar' })), [vac] = await render(sfx(CUE, { space: 'vacuum' }));
    expect(soundMs(hall)).toBeGreaterThan(soundMs(dry) * 1.4);
    expect(soundMs(vac)).toBeLessThan(soundMs(dry) * 1.1);
    expect(centroid(vac, SR, onset(vac))).toBeLessThan(centroid(dry, SR, onset(dry)) * 0.5);
  });

  it('a hard-panned layer decorrelates left and right; unpanned is mono', async () => {
    const [L0, R0] = await render(sfx(CUE));
    const [L1, R1] = await render(sfx(CUE.map((g, i) => ({ ...g, pan: i % 2 ? 0.9 : -0.9 }))));
    expect(lrCorrelation(L0, R0)).toBeGreaterThan(0.99);
    expect(lrCorrelation(L1, R1)).toBeLessThan(0.8);
  });

  it('a drive on the body layer saturates it: its crest falls', async () => {
    const body = [CUE[0]];
    const [clean] = await render(sfx(body)), [driven] = await render(sfx([{ ...CUE[0], chain: [{ type: 'drive', amount: 0.9, tone: 8000 }] }]));
    const crest = (y) => db(peak(y) / rms(y, onset(y), onset(y) + Math.round(0.2 * SR)));
    expect(crest(driven)).toBeLessThan(crest(clean) - 1);
  });

  it('far darkens the attack', async () => {
    const [near] = await render(sfx(CUE)), [far] = await render(sfx(CUE), { far: 0.9 });
    expect(centroid(far, SR, onset(far))).toBeLessThan(centroid(near, SR, onset(near)) * 0.6);
  });
});

describe('the engine: ducks and the voice cap', () => {
  // a held music row on the engine's channel gain, and cues against it
  async function play(setup, seconds = 1.2) {
    const ctx = new OfflineAudioContext(1, Math.round(seconds * SR), SR);
    const e = K.createEngine(ctx);
    setup(e, ctx);
    return (await ctx.startRendering()).getChannelData(0);
  }
  const music = (e, ctx) => { const o = ctx.createOscillator(); o.frequency.value = 220; const g = ctx.createGain(); g.gain.value = 0.2; o.connect(g); g.connect(e.channelGain('music')); o.start(0); };
  const win = (y, a, b) => rms(y, Math.round(a * SR), Math.round(b * SR));

  it('a duck dips the music bus by about its depth, then lets it back', async () => {
    const y = await play((e, ctx) => { e.setSfx({}); music(e, ctx); e.playCue([{ type: 'duck', depth: 12, hold: 0.3, release: 0.06 }], 0.4); });
    const before = win(y, 0.1, 0.35), under = win(y, 0.5, 0.68), after = win(y, 1.0, 1.15);
    expect(db(under / before)).toBeLessThan(-9);
    expect(db(under / before)).toBeGreaterThan(-15);
    expect(Math.abs(db(after / before))).toBeLessThan(1);
  });

  it('a shallow duck landing inside a deep one keeps the deeper dip and the later hold', async () => {
    const y = await play((e, ctx) => {
      e.setSfx({}); music(e, ctx);
      e.playCue([{ type: 'duck', depth: 12, hold: 0.2, release: 0.05 }], 0.3);
      e.playCue([{ type: 'duck', depth: 3, hold: 0.4, release: 0.05 }], 0.4);
    });
    const before = win(y, 0.1, 0.25);
    expect(db(win(y, 0.45, 0.48) / before)).toBeLessThan(-9);   // still the deep dip, where the shallow one began
    expect(db(win(y, 0.72, 0.78) / before)).toBeLessThan(-9);   // held to the later end
    expect(Math.abs(db(win(y, 0.95, 1.1) / before))).toBeLessThan(1);
  });

  it('without setSfx a duck leaves the music alone (no music bus)', async () => {
    const y = await play((e, ctx) => { music(e, ctx); e.playCue([{ type: 'duck', depth: 12, hold: 0.3 }], 0.4); });
    expect(Math.abs(db(win(y, 0.5, 0.68) / win(y, 0.1, 0.35)))).toBeLessThan(0.5);
  });

  it('a cap of two keeps six cues at once near the loudness of two; a louder cue steals the quietest', async () => {
    const hit = [{ type: 'thump', from: 'A2', to: 'A1', decay: 0.4, vol: 0.5 }];
    const fire = (n, cap, vel = () => 0.5) => (e) => { e.setSfx(cap ? { voices: cap } : {}); for (let i = 0; i < n; i++) e.playCue(hit, 0.1, null, vel(i)); };
    const six2 = await play(fire(6, 2), 0.6), two = await play(fire(2, 0), 0.6), six = await play(fire(6, 0), 0.6);
    const loud = (y) => win(y, 0.1, 0.3);
    expect(Math.abs(db(loud(six2) / loud(two)))).toBeLessThan(0.5);
    expect(db(loud(six) / loud(two))).toBeGreaterThan(1);
    // the third, louder, steals: the sound after 20 ms is the two loudest, not the first two
    const stolen = await play(fire(3, 2, (i) => (i === 2 ? 1 : 0.4)), 0.6), kept = await play(fire(2, 0, (i) => (i === 1 ? 1 : 0.4)), 0.6);
    expect(Math.abs(db(win(stolen, 0.13, 0.3) / win(kept, 0.13, 0.3)))).toBeLessThan(0.5);
  });
});
