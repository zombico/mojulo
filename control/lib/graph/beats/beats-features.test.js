import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildBeatsKernel, emitBeatsKernel, BEATS_KERNEL_FEATURES } from './beats-kernel.js';
import { buildBeatsKernel as buildBeatsKernel21 } from './beats-kernel-2.1.js';
import { beatsFeatures, audioFeatures, pagePatches } from './beats-features.js';
import { PATCHES, LEGACY_PATCH_NAMES } from './audio-patches.js';
import { normalizeBeatsManifest } from './beats-manifest.js';
import { renderBeatsOffline, renderWithKernel } from './beats-render.js';
import { BASELINE_FIXTURES } from './beats-render.baseline.fixtures.js';

// Feature-sliced emission: a page embeds only the kernel slices and shelf
// entries its recipe uses, and a recipe with no opt-in gets the 2.1 bytes.

const src = (file) => {
  const t = readFileSync(new URL(file, import.meta.url), 'utf8');
  return t.slice(t.indexOf('function buildBeatsKernel()'), t.lastIndexOf('}') + 1);
};
// innermost regions first: a newer feature's hook may sit inside an older region.
const REGION = /\/\*@(\w+)\{\*\/\n((?:(?!\/\*@)[\s\S])*?)\/\*\|\n((?:(?!\/\*@)[\s\S])*?)@\*\/\n/g;
const allOff = (t) => { for (let p = null; p !== t;) { p = t; t = t.replace(REGION, (m, f, nu, old) => old); } return t; };
const evalKernel = (text) => new Function('return (' + text + ')()')();

const comp = (parts, extra = {}) => normalizeBeatsManifest({ kind: 'beats-composition', title: 'f', bpm: 110, seed: 3, parts, ...extra });
const FIXTURES = {
  voice: [comp([
    { name: 'vln', instrument: 'violin-2', events: [['0:0:0', 'E5', '1:0:0', 0.7]] },
    { name: 'kit', instrument: 'drum-kit', events: [['0:0:0', ['C2', 'F#2']], ['0:1:0', 'D2'], ['0:2:0', ['C2', 'A#2']]] },
    { name: 'lead', patch: 'organ', glide: 0.1, events: [['0:0:0', 'C4', '0:1:0'], ['0:1:0', 'G4', '0:1:0']] },
    { name: 'hat', patch: 'hat', patchParams: { vary: true }, events: [['0:0:0', 'C1', '0:0:1'], ['0:1:0', 'C1', '0:0:1']] },
  ]), ['voice']],
  strings: [comp([{ name: 'g', instrument: 'acoustic-guitar', patchParams: { tune: 'exact', ringT60: [4, 1] }, events: [['0:0:0', ['E2', 'B2', 'E3', 'G#3'], '1:0:0']] }]), ['voice', 'strings']],
  grand: [comp([{ name: 'p', instrument: 'grand-piano', events: [['0:0:0', ['C3', 'E4', 'G5'], '1:0:0']] }]), ['voice', 'strings']],
  mix: [comp([
    { name: 'p', instrument: 'piano', pan: -0.4, send: 0.3, events: [['0:0:0', ['C3', 'G3'], '1:0:0']] },
    { name: 'b', patch: 'bassMono', chain: [{ type: 'reverb', model: 'room2', decay: 1.5, wet: 0.3 }], events: [['0:0:0', 'C2', '1:0:0']] },
  ], { room: { decay: 1.8 }, master: { limit: -3 } }), ['mix']],
  sfx: [normalizeBeatsManifest({ kind: 'beats-sfx', title: 's', cues: { a: [
    { type: 'tone', note: 'A2', to: 'E3', dur: 0.4, tremolo: { rate: 12, depth: 0.4 } },
    { type: 'ring', material: 'cymbal', at: 0.1 },
    { type: 'ring', material: 'metal', note: 'A5', excite: 'noise', at: 0.15 },
    { type: 'thump', mass: 20, at: 0.2 },
    { type: 'burst', decay: 0.3, filterEnv: { from: 8000, to: 300 }, at: 0.25 },
  ] } }), ['sfx']],
  varyTrack: [normalizeBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 140, seed: 2, steps: 16, tracks: [
    { name: 'gun', cue: [{ type: 'burst', decay: 0.08 }, { type: 'grain', grains: 4, over: 0.03, seed: 5 }], vary: true, mask: [1, 0, 1, 0] },
  ] }), ['sfx']],
  score: [comp([
    { name: 'lead', patch: 'organ', form: [{ phrase: 'A', at: '0:0:0' }, { phrase: 'A', at: '1:0:0', transpose: 5, retro: true }], dynamics: [{ at: 0, to: 'p' }, { at: 0, to: 'ff', over: '2:0:0' }] },
    { name: 'bass', patch: 'bassMono', events: [{ at: '0:0:0', n: 'C2', d: '2:0:0', dyn: 'mf' }] },
  ], { meter: '3/4', tempo: [{ at: '1:0:0', bpm: 90, ramp: 'linear' }], phrases: { A: [['0:0:0', 'C4', '0:1:0'], ['0:1:0', 'E4', '0:1:0'], ['0:2:0', 'G4', '0:1:0']] } }), ['voice', 'ev', 'score']],
  orch: [comp([
    { name: 'fl', instrument: 'flute-2', players: 3, desk: 'back', events: [['0:0:0', 'A5', '1:0:0', 0.7]] },
    { name: 'cl', instrument: 'clarinet', pan: 0.3, events: [['0:0:0', ['D4', 'F4'], '1:0:0', 0.6]] },
    { name: 'tp', instrument: 'timpani', glide: 0.3, events: [['0:0:0', 'G2'], ['0:2:0', 'C3']] },
    { name: 'vb', instrument: 'vibraphone', events: [['0:1:0', 'E5']] },
    { name: 'hp', instrument: 'harp', events: [['0:0:0', ['C3', 'G3', 'E4']]] },
  ], { a4: 442, seating: 'film', room: { decay: 1.6 } }), ['voice', 'strings', 'mix', 'orch']],
  arts: [comp([
    { name: 'vn', patch: 'violin2', events: [{ at: 0, n: 'A4', d: 1, art: 'legato' }, { at: 1, n: 'B4', d: 1, art: 'legato' }, { at: 2, n: 'E5', d: 1, art: { type: 'trill', rate: 9 } }, ['0:3:0', 'A4', '0:1:0', 0.7, 'pizz']] },
    { name: 'tp', patch: 'trumpet2', events: [{ at: 0, n: 'C5', d: 2, art: 'mute' }, { at: 2, n: 'G4', d: 1, art: 'sfz' }, { at: 3, n: 'C5', art: 'port' }] },
    { name: 'hp', patch: 'harp', events: [{ at: 0, n: 'C4', d: 1, art: { type: 'gliss', to: 'G5' } }] },
    { name: 'fl', patch: 'flute', events: [{ at: 0, n: 'D5', d: 2, art: 'flutter-tongue' }, { at: 2, n: 'D5', d: 1, art: { type: 'trem', mode: 'lfo' } }] },
  ]), ['voice', 'strings', 'ev', 'score', 'orch']],
  perc: [comp([
    { name: 'dm', instrument: 'drum-machine-88', events: [['0:0:0', ['C2', 'A#2']], ['0:0:2', 'D#2'], ['0:1:0', 'F#2'], ['0:2:0', ['C2', 'G#3']], ['0:3:0', 'A#2']] },
    { name: 'arena', instrument: 'stadium-kit', roomMix: 0.5, events: [['0:0:0', 'C2', '0:0:1', 1], ['0:1:0', 'D2'], ['0:2:0', ['C2', 'F#2']], ['0:3:0', 'E2'], ['0:3:2', 'A2']] },
    { name: 'lat', instrument: 'latin-perc', events: [['0:0:0', 'D#4'], ['0:1:0', 'D4'], ['0:2:0', 'D5'], ['0:3:0', 'F#3']] },
    { name: 'orc', instrument: 'orchestral-perc', events: [['0:0:0', 'E3'], ['0:2:0', 'D2', '0:2:0', 0.4, { type: 'roll', cresc: 2 }]] },
  ]), ['voice', 'mix', 'ev', 'score', 'orch', 'perc']],
  percPattern: [normalizeBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 126, seed: 2, steps: 16, tracks: [
    { name: 'kit', instrument: 'drum-machine-909', mask: [1, 0, 1, 1], notes: [['C2', 'F#2'], 'F#2', 'A#2', 'D#2'] },
  ] }), ['voice', 'ev', 'perc']],
  va: [comp([
    { name: 'reese', instrument: 'reese-bass', events: [['0:0:0', 'E1', '1:0:0', 0.8]] },
    { name: 'hoover', instrument: 'hoover', events: [['0:0:0', ['A3', 'E4'], '0:2:0', 0.8]] },
    { name: 'ss', instrument: 'supersaw-lead', glide: 0.08, events: [['0:0:0', 'A4', '0:1:0'], ['0:1:0', 'C5', '0:1:0']] },
    { name: 'fm', instrument: 'fm-keys', events: [['0:0:0', ['C4', 'E4', 'G4'], '0:2:0', 0.7]] },
    { name: 'fmb', instrument: 'fm-bass', events: [['0:2:0', 'E2', '0:0:2', 0.9]] },
    { name: 'wob', instrument: 'wobble-bass', events: [['0:0:0', 'E1', '1:0:0', 0.8]] },
  ], { bpm: 140 }), ['voice', 'mix', 'ev', 'orch', 'va', 'fx']],
  acid: [normalizeBeatsManifest({ kind: 'beats-pattern', title: 'p', bpm: 128, seed: 3, steps: 16, tracks: [
    { name: 'acid', instrument: 'acid-bass', mask: [1, 0, 1, 1], notes: ['A2', 'A2', 'C3', 'A3', 'E3'], accent: [1, 0, 0, 1, 1], slide: [0, 0, 1, 0], ratchet: [1, 1, 1, 1, 1, 1, 1, 2], prob: [1, 1, 1, 0.6] },
    { name: 'stab', instrument: 'rave-stab', mask: [0, 0, 1, 0], notes: [['A3', 'C4', 'E4']] },
  ] }), ['voice', 'ev', 'orch', 'va']],
  fx: [comp([
    { name: 'k', patch: 'kick2', events: [0, 1, 2, 3].map((b) => [b, 'C2', '0:0:2', 0.9]) },
    { name: 'pad', instrument: 'poly-strings', duck: { by: 'k', depth: 9 }, gate: { mask: [1, 0, 1, 1] }, events: [['0:0:0', ['A3', 'C4', 'E4'], '1:0:0', 0.7]] },
    { name: 'voc', patch: 'sawStab', chain: [{ type: 'vocoder', modulator: 'lead', bands: 8, hide: true }], events: [['0:0:0', ['A2', 'E3'], '1:0:0']] },
    { name: 'lead', patch: 'chipLead', chain: [{ type: 'phaser', rate: 0.7 }, { type: 'flanger' }, { type: 'tape' }, { type: 'autopan', sync: '1/4' }], events: [['0:0:0', 'E5', '0:0:2'], ['0:1:0', 'G5', '0:0:2']] },
    { name: 'dirt', patch: 'bassMono', stutter: [{ at: '0:2:0', len: '0:0:1', repeats: 4 }], chain: [{ type: 'crush', bits: 5 }, { type: 'ringmod', hz: 80, mix: 0.3 }, { type: 'drive', model: 'fold', amount: 0.4 }, { type: 'delay', model: 'dub', time: '3/16' }, { type: 'reverb', model: 'gated', gate: 0.2 }], events: [['0:0:0', 'A1', '0:0:2'], ['0:2:0', 'C2', '0:0:1'], ['0:3:0', 'E2', '0:0:2']] },
  ], { room: { decay: 1.5, model: 'reverse' } }), ['voice', 'mix', 'ev', 'va', 'fx']],
  everything: [comp([
    { name: 'p', instrument: 'grand-piano', pan: 0.3, send: 0.4, events: [['0:0:0', ['C3', 'G4'], '1:0:0']] },
    { name: 'kit', instrument: 'drum-kit', events: [['0:0:0', 'C2'], ['0:2:0', 'D2']] },
  ], { room: { decay: 2, model: 'room2' } }), ['voice', 'strings', 'mix']],
};

describe('the frozen 2.1 kernel', () => {
  it('is 2.1 byte-for-byte, and the living kernel with every feature off reduces to it', () => {
    const frozen = src('./beats-kernel-2.1.js');
    expect(createHash('sha256').update(frozen).digest('hex')).toBe('42c7009940e6bdfdb0918bbcc65acc2fcfe8e9af6144e488aae32a148c91c7c2');
    expect(allOff(src('./beats-kernel.js'))).toBe(frozen);
  });

  it('is what a no-feature page embeds', () => {
    expect(emitBeatsKernel([])).toBe(buildBeatsKernel21.toString());
    expect(emitBeatsKernel(undefined)).toBe(buildBeatsKernel21.toString());
  });
});

describe('emitBeatsKernel', () => {
  const FS = BEATS_KERNEL_FEATURES.filter((f) => f !== 'x');
  it('every feature subset slices to a valid, self-contained kernel', () => {
    const whole = buildBeatsKernel.toString();
    for (let mask = 1; mask < 1 << FS.length; mask++) {
      const on = FS.filter((_, i) => (mask >> i) & 1);
      const text = emitBeatsKernel(on);
      expect(text, on.join('+')).not.toContain('/*@'); // sliced, not the fallback
      expect(text.length).toBeLessThan(whole.length);
      const K = evalKernel(text);
      expect(typeof K.createEngine).toBe('function');
    }
    expect(evalKernel(emitBeatsKernel(['x'])).createEngine).toBeTypeOf('function');
  });

  it('slices grow with what is on', () => {
    const size = (f) => emitBeatsKernel(f).length;
    expect(size(['x'])).toBeGreaterThan(size([]));
    for (const f of FS) expect(size([f])).toBeGreaterThan(size(['x']));
    expect(size(FS)).toBeGreaterThan(Math.max(...FS.map((f) => size([f]))));
  });
});

describe('beatsFeatures', () => {
  it('finds nothing in recipes that opt into nothing (the baseline fixtures)', () => {
    for (const { manifest } of Object.values(BASELINE_FIXTURES)) expect(beatsFeatures(manifest)).toEqual([]);
  });

  it.each(Object.entries(FIXTURES))('%s → the expected features', (name, [m, want]) => {
    expect(beatsFeatures(m)).toEqual(want);
  });

  it('reads unnormalized rows (instrument names) too', () => {
    expect(beatsFeatures({ kind: 'beats-composition', parts: [{ name: 'a', instrument: 'trumpet-2', events: [] }] })).toEqual(['voice']);
    expect(beatsFeatures({ kind: 'beats-composition', parts: [{ name: 'a', instrument: 'trumpet', events: [] }] })).toEqual([]);
  });

  it('audioFeatures covers a world payload: soundtrack, cue lists, wind.vary, sfx.vary', () => {
    expect(audioFeatures({ soundtrack: BASELINE_FIXTURES.ambient.manifest, footsteps: { step: [{ type: 'burst' }] }, wind: { level: -30, freq: 300 } })).toEqual([]);
    expect(audioFeatures({ wind: { vary: true } })).toEqual(['x']);
    expect(audioFeatures({ cues: { a: [{ type: 'tone' }] } })).toEqual(['sfx']);
    expect(audioFeatures({ weapon: { shot: [{ type: 'ring', material: 'plate' }] } })).toEqual(['sfx']);
    expect(audioFeatures({ vary: true, cues: { a: [{ type: 'burst' }] } })).toEqual(['sfx']);
    expect(audioFeatures({ soundtrack: FIXTURES.mix[0] })).toEqual(['mix']);
  });
});

describe('pagePatches', () => {
  it('is the 2.1 shelf, JSON-identical, when nothing newer is referenced', () => {
    const shelf = pagePatches(BASELINE_FIXTURES.composition.manifest, BASELINE_FIXTURES.pattern.manifest);
    expect(Object.keys(shelf)).toEqual([...LEGACY_PATCH_NAMES]);
    expect(JSON.stringify(shelf)).toBe(JSON.stringify(Object.fromEntries(LEGACY_PATCH_NAMES.map((k) => [k, PATCHES[k]]))));
    expect(pagePatches()).toEqual(shelf);
  });

  it('adds only the newer names a recipe uses, kit pieces included', () => {
    const shelf = pagePatches(FIXTURES.voice[0]);
    for (const n of ['violin2', 'drumKit', 'kick2', 'snare2', 'hat808', 'crash']) expect(shelf[n]).toBeTruthy();
    expect(shelf.pianoGrand).toBeUndefined();
    expect(shelf.trumpet2).toBeUndefined();
  });
});

describe('a feature slice sounds exactly like the full kernel', () => {
  it.each(Object.entries(FIXTURES))('%s', async (name, [m]) => {
    const opts = { tail: 0.5, loops: 1 };
    const sliced = await renderWithKernel(evalKernel(emitBeatsKernel(beatsFeatures(m))), m, opts);
    const full = await renderBeatsOffline(m, opts);
    expect(sliced.wav.equals(full.wav)).toBe(true);
  });

  it('the frozen 2.1 kernel renders every no-opt-in baseline fixture byte-identical to the export', async () => {
    const K21 = evalKernel(emitBeatsKernel([]));
    for (const { manifest, opts } of Object.values(BASELINE_FIXTURES)) {
      const a = await renderWithKernel(K21, manifest, opts);
      const b = await renderBeatsOffline(manifest, opts);
      expect(a.wav.equals(b.wav)).toBe(true);
    }
  });
});

describe('world audio channel', () => {
  it('carries the per-hit variant counter only when audio.sfx.vary is set', async () => {
    const { audioChannelScript } = await import('../scene/channels/audio.js');
    const cues = { hit: [{ type: 'burst' }] };
    expect(audioChannelScript({ cues })).not.toContain('__beatsVar');
    const on = audioChannelScript({ cues, vary: true });
    expect(on).toContain('++__beatsVar');
    expect(on).toContain(emitBeatsKernel(['sfx']));
  });
});
