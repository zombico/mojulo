import { describe, expect, it } from 'vitest';

import { BEATS_KERNEL_FEATURES, emitBeatsKernel } from './beats-kernel.js';
import { beatsFeatures, audioFeatures } from './beats-features.js';
import { validateBeatsManifest } from './beats-manifest.js';
import { renderBeatsOffline, renderBeatsPlan, SUSTAIN_LANE } from './beats-render.js';
import { decodeWav, rms, centroid } from './audio-measure.js';

// A held voice (kernel feature `sustain`): one sound driven by a control in 0..1, every range from x = 0 to x = 1.
// Machine gates: nobody listened.

const SR = 44100;
const VOICE = { attack: 0.08, release: 0.15, layers: [
  { kind: 'osc', wave: 'sawtooth', pitch: [80, 320], gain: [0, 0.4], cutoff: [500, 4000] },
  { kind: 'noise', gain: [0, 0.2], band: { lo: 1000 } },
] };
const man = (voice = VOICE) => ({ kind: 'beats-sfx', title: 'held', sustains: { v: voice } });
async function held(voice, lane) {
  const { wav } = await renderBeatsOffline(man(voice), { tail: 0.3, ...(lane ? { lane } : {}) });
  return decodeWav(wav).channels[0];
}
const win = (y, a, b) => rms(y, Math.round(a * SR), Math.round(b * SR));
const db = (r) => 20 * Math.log10(r + 1e-12);

describe('a held voice', () => {
  it('is a feature of its own, needing the mixer; a recipe asks for it only by holding a voice', () => {
    expect(BEATS_KERNEL_FEATURES).toContain('sustain');
    expect(emitBeatsKernel(BEATS_KERNEL_FEATURES.filter((f) => f !== 'sustain'))).not.toContain('function sustain');
    expect(beatsFeatures(man())).toContain('sustain');
    expect(beatsFeatures({ kind: 'beats-sfx', title: 'c', cues: { a: [{ type: 'burst' }] } })).not.toContain('sustain');
    expect(audioFeatures({ thruster: { level: 0.4 } })).not.toContain('sustain');
    expect(audioFeatures({ thruster: { level: 0.4, voice: VOICE } })).toContain('sustain');
  });

  it('a row of held voices only is valid; a bad layer says what is wrong', () => {
    expect(validateBeatsManifest(man())).toEqual({ ok: true, errors: [] });
    const bad = validateBeatsManifest(man({ layers: [
      { kind: 'grain' },
      { kind: 'noise', gain: [0, 3], pitch: [100, 200] },
      { kind: 'osc', pitch: [100, 200], gain: [0, 1], lfo: { to: 'cutoff', rate: [1, 2] } },
    ] }));
    for (const m of ['layers[0].kind', 'layers[1].gain', 'layers[1].pitch is for an osc', "layers[2].lfo.to 'cutoff' needs"]) expect(bad.errors.some((e) => e.includes(m)), m).toBe(true);
    expect(validateBeatsManifest(man({})).ok).toBe(false);
  });

  it('follows its control: silent at 0 where its gains start at 0, louder and brighter at 1 than at a half, gone after', async () => {
    const y = await held();
    const idle = win(y, 0.15, 0.55), half = win(y, 0.9, 1.35), full = win(y, 1.9, 2.35), gone = win(y, 2.9, 3.15);
    expect(db(idle)).toBeLessThan(-90);
    expect(db(full)).toBeGreaterThan(db(half) + 3);
    expect(centroid(y, SR, Math.round(1.9 * SR))).toBeGreaterThan(centroid(y, SR, Math.round(0.9 * SR)));
    expect(db(gone)).toBeLessThan(-90);
  });

  it('a new control inside a glide carries on from where the glide had got to (the ramp is not lost)', async () => {
    // a 1 s attack, the control set to 1 at 0.1 s and again at 0.6 s: the level rises through 0.1 – 0.6, it does not
    // sit at zero until the second set
    const y = await held({ ...VOICE, attack: 1 }, [[0, 0], [0.1, 1], [0.6, 1], [1.6, 1], [1.7, 0], [2, 0]]);
    expect(db(win(y, 0.4, 0.55))).toBeGreaterThan(db(win(y, 0.12, 0.2)) + 4);
    expect(db(win(y, 0.4, 0.55))).toBeGreaterThan(-60);
  });

  it('an idling voice runs at 0; the lane is checked', async () => {
    const y = await held({ ...VOICE, layers: [{ ...VOICE.layers[0], gain: [0.15, 0.4] }] });
    expect(db(win(y, 0.15, 0.55))).toBeGreaterThan(-50);
    expect(() => renderBeatsPlan(man(), { lane: [[0, 0], [1, 2]] })).toThrow(/lane/);
    expect(() => renderBeatsPlan(man(), { lane: [[1, 0], [0.5, 1]] })).toThrow(/rising/);
    expect(() => renderBeatsPlan(man(), { sustain: 'nope' })).toThrow(/unknown held voice/);
    expect(renderBeatsPlan(man()).entries[0].lane).toBe(SUSTAIN_LANE);
  });
});

describe('a world gives the thruster and the jump charge a held voice', () => {
  it('passes a voice through, checked; without one the slot is as it was', async () => {
    const { resolveWorldAudio } = await import('./beats-world.js');
    expect(resolveWorldAudio({ thruster: { level: 0.2 } }).thruster).toEqual({ level: 0.2 });
    expect(resolveWorldAudio({ thruster: { level: 0.2, voice: VOICE } }).thruster).toEqual({ level: 0.2, voice: VOICE });
    expect(resolveWorldAudio({ jump: { charge: { level: 0.3, voice: VOICE } } }).jump.charge).toEqual({ level: 0.3, voice: VOICE });
    expect(() => resolveWorldAudio({ thruster: { voice: { layers: [{ kind: 'grain' }] } } })).toThrow(/audio\.thruster\.voice/);
  });

  it('the page plays the voice through the kernel\'s sustain, and carries none of it without one', async () => {
    const { audioChannelScript } = await import('../scene/channels/audio.js');
    const plain = audioChannelScript({ thruster: { level: 0.2 }, jump: { charge: { level: 0.3 } } });
    const held = audioChannelScript({ thruster: { level: 0.2, voice: VOICE }, jump: { charge: { level: 0.3, voice: VOICE } } });
    expect(plain).not.toContain('.sustain(');
    expect(plain).toContain('__thrBuild');
    expect(held.match(/__beatsEng\.sustain\(/g)).toHaveLength(2);
    expect(held).not.toContain('__thrBuild');
    expect(held).not.toContain('motor.frequency.setTargetAtTime');
  });
});
