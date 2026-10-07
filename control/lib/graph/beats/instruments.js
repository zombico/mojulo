/**
 * instruments — the B6 layered instrument model (beats.plan.md → B6).
 *
 * An instrument is NOT a monolith: it is a named composition of four orthogonal
 * layers — voice (kernel topology), patch (timbre params), color (chain effects),
 * and feel (performance preset). This file holds the two DATA shelves (named
 * instruments, named feel presets) and the resolver that merges them, in the
 * `getPatch(name, overrides)` spirit: an instrument resolves to { patch, chain,
 * feel } and part-level fields OVERRIDE the instrument's defaults. Instruments add
 * no runtime path — normalizeBeatsManifest expands `instrument:` into the same
 * patch/chain/feel the kernel already realizes, so the kernel stays layer-agnostic.
 *
 * Sustainability (B6): flat named data + a merge, never a class hierarchy. Two
 * instruments that share color/feel reference the same shelf entry; they do not
 * subclass. New instruments are data here; only a genuinely new excitation×
 * resonator topology earns a kernel voice.
 */

import { PATCHES } from './audio-patches.js';

// ── feel presets — articulation as named data (noteFeel params) ───────────────
// Reused across instruments exactly like patches. `robotic` is the null feel
// (perfectly quantized); it resolves to no params, i.e. byte-identical to today.
export const FEEL_PRESETS = {
  robotic: {},
  'strum-down': { strum: 0.022, jitterTime: 0.008, jitterVel: 0.12, jitterTimbre: 0.06 },
  'strum-alt': { strum: 0.02, strumAlternate: true, jitterTime: 0.008, jitterVel: 0.12, jitterTimbre: 0.06 },
  fingerpick: { strum: 0, jitterTime: 0.007, jitterVel: 0.1, jitterTimbre: 0.05 },
  'alt-pick': { strum: 0.006, jitterTime: 0.004, jitterVel: 0.14, jitterTimbre: 0.04 },
  'palm-mute': { strum: 0.009, jitterTime: 0.004, jitterVel: 0.16, jitterTimbre: 0.05 },
  ensemble: { strum: 0.03, jitterTime: 0.014, jitterVel: 0.14, jitterTimbre: 0.06 },
  staccato: { strum: 0.005, jitterTime: 0.004, jitterVel: 0.12 },
  // two hands on a keyboard: a whisper of chord roll + touch variation. Velocity
  // jitter matters more here than elsewhere — velToFilter turns it into per-note
  // brightness variation, which is most of what "played, not programmed" means on keys.
  keys: { strum: 0.006, jitterTime: 0.005, jitterVel: 0.12 },
  // a rock drummer (orchestra and era): kick and snare sit a hair behind the
  // beat, hats accent the downbeats, tom fills rush a little and flam (GM notes).
  'rock-drummer': { jitterTime: 0.004, jitterVel: 0.08, laid: { 36: 0.006, 38: 0.012, 40: 0.012, 41: -0.004, 43: -0.004, 45: -0.004, 47: -0.004, 48: -0.004, 50: -0.004 }, accent: { notes: [42, 44, 46], pattern: [1, 0.7, 0.85, 0.7] }, flam: { notes: [41, 43, 45, 47, 48, 50], gap: 0.016, vel: 0.4 } },
};

// ── radiators (audio improvements): `body` resonance sets for the v3 sections.
// Strings: A0 (air), B1− and B1+ (corpus), the bridge hill (broad). Brass: the
// bell's radiation peak and a weaker upper one. Gains ride on `mix: 1`: a
// resonance adds `gain` × its band over the dry signal (≈ +7–8 dB at 1.4).
const BODY = {
  violin: [{ freq: 280, q: 12, gain: 1 }, { freq: 460, q: 14, gain: 1.4 }, { freq: 540, q: 12, gain: 1.6 }, { freq: 2500, q: 1.6, gain: 1.1 }, { freq: 3500, q: 4, gain: 0.4 }],
  viola: [{ freq: 230, q: 12, gain: 1 }, { freq: 360, q: 12, gain: 1.3 }, { freq: 440, q: 12, gain: 1.4 }, { freq: 2000, q: 1.5, gain: 1 }],
  cello: [{ freq: 100, q: 10, gain: 1 }, { freq: 175, q: 12, gain: 1.4 }, { freq: 205, q: 12, gain: 1.5 }, { freq: 1200, q: 1.4, gain: 0.9 }, { freq: 2600, q: 3, gain: 0.3 }],
  contrabass: [{ freq: 62, q: 8, gain: 1 }, { freq: 105, q: 10, gain: 1.4 }, { freq: 130, q: 10, gain: 1.2 }, { freq: 700, q: 1.4, gain: 0.8 }],
  trumpet: [{ freq: 1300, q: 1.2, gain: 1.2 }, { freq: 2800, q: 2, gain: 0.4 }],
  horn: [{ freq: 480, q: 1.3, gain: 1 }],
  trombone: [{ freq: 600, q: 1.2, gain: 1 }, { freq: 1500, q: 2, gain: 0.4 }],
  tuba: [{ freq: 280, q: 1.2, gain: 1 }],
};

// ── instrument shelf — { patch, chain, feel } compositions of the four layers ──
// patch is a name (kernel resolves it); chain is a color stack; feel is a preset
// name or inline params. Guitars are the B6.0 seed set; other families land as
// their voices/patches do (B6.2 modal → bells/mallets, etc.).
export const INSTRUMENTS = {
  // A dreadnought soundbox: strong low air (Helmholtz ~100Hz) + top-plate/back
  // wood modes, tuned resonances instead of the generic default. THIS is the
  // "boxy" warmth of an acoustic vs a bare string.
  'acoustic-guitar': { patch: 'guitarClean', chain: [{ type: 'body', mix: 0.4, resonances: [{ freq: 100, q: 9, gain: 1 }, { freq: 200, q: 7, gain: 0.8 }, { freq: 300, q: 6, gain: 0.55 }, { freq: 400, q: 5, gain: 0.4 }] }, { type: 'reverb', wet: 0.18, decay: 2.2 }], feel: 'strum-alt' },
  // A smaller, darker nylon body — lower, rounder resonances, a touch more mix.
  'nylon-guitar': { patch: 'guitarNylon', chain: [{ type: 'body', mix: 0.42, resonances: [{ freq: 95, q: 9, gain: 1 }, { freq: 185, q: 7, gain: 0.75 }, { freq: 280, q: 6, gain: 0.5 }] }, { type: 'reverb', wet: 0.16, decay: 2 }], feel: 'fingerpick' },
  'electric-guitar': { patch: 'guitarElectric', chain: [{ type: 'drive', amount: 0.55, tone: 3400 }, { type: 'reverb', wet: 0.12, decay: 1.5 }], feel: 'alt-pick' },
  'electric-clean': { patch: 'guitarElectric', chain: [{ type: 'reverb', wet: 0.16, decay: 1.8 }], feel: 'alt-pick' },
  'distorted-guitar': { patch: 'guitarElectric', chain: [{ type: 'drive', amount: 0.72, tone: 3400 }, { type: 'reverb', wet: 0.08, decay: 1.2 }], feel: 'palm-mute' },
  // rock pair (amp spike, proven in the Twin Circuit A/B): `amp` = gain STAGING,
  // not curve shape — the clip saturates most of the note's life so the envelope
  // decouples from the string (loudness holds, brightness decays). Dual-pluck
  // patch feeds the intermodulation growl. rock-guitar is the rhythm wall;
  // rock-lead runs the same amp 12dB cooler + delay so its phrasing stays a
  // VOICE above the wall (enough envelope survives to read as played notes).
  'rock-guitar': { patch: 'guitarAmp', chain: [{ type: 'amp', gain: 42, bias: 0.18, presence: 4 }, { type: 'reverb', wet: 0.06, decay: 1 }], feel: 'palm-mute' },
  'rock-lead': { patch: 'guitarLead', chain: [{ type: 'amp', gain: 30, bias: 0.14, presence: 5, level: -12 }, { type: 'delay', time: '3/16', feedback: 0.3, mix: 0.22 }, { type: 'reverb', wet: 0.2, decay: 2.5 }], feel: 'alt-pick' },
  'lead-guitar': { patch: 'guitarLead', chain: [{ type: 'drive', amount: 0.5, tone: 3000 }, { type: 'delay', time: '3/16', feedback: 0.3, mix: 0.25 }, { type: 'reverb', wet: 0.15 }], feel: 'alt-pick' },
  'muted-guitar': { patch: 'guitarMuted', chain: [{ type: 'body', mix: 0.2 }], feel: 'palm-mute' },
  // Bowed strings (synth section, not sampled). Body warmth + a long hall reverb;
  // `ensemble` feel gives the section a slight bow-onset spread so a chord doesn't
  // land as one block. A whole string quartet follows the harmony bus by name.
  violin: { patch: 'violin', chain: [{ type: 'body', mix: 0.22 }, { type: 'reverb', wet: 0.32, decay: 3.5 }], feel: 'ensemble' },
  viola: { patch: 'viola', chain: [{ type: 'body', mix: 0.26 }, { type: 'reverb', wet: 0.3, decay: 3.5 }], feel: 'ensemble' },
  cello: { patch: 'cello', chain: [{ type: 'body', mix: 0.3 }, { type: 'reverb', wet: 0.3, decay: 3.5 }], feel: 'ensemble' },
  contrabass: { patch: 'contrabass', chain: [{ type: 'reverb', wet: 0.22, decay: 3 }], feel: 'robotic' },
  // Brass section (synth brass, not sampled). A light strum + velocity jitter = the
  // human looseness of players not attacking perfectly together; tuba stays tight.
  trumpet: { patch: 'trumpet', chain: [{ type: 'reverb', wet: 0.22, decay: 2.2 }], feel: { strum: 0.01, jitterTime: 0.007, jitterVel: 0.14 } },
  'french-horn': { patch: 'frenchHorn', chain: [{ type: 'reverb', wet: 0.32, decay: 3.2 }], feel: { strum: 0.016, jitterTime: 0.01, jitterVel: 0.12 } },
  trombone: { patch: 'trombone', chain: [{ type: 'reverb', wet: 0.24, decay: 2.4 }], feel: { strum: 0.012, jitterTime: 0.008, jitterVel: 0.13 } },
  tuba: { patch: 'tuba', chain: [{ type: 'reverb', wet: 0.2, decay: 2.2 }], feel: 'robotic' },
  // Section v2 (audio fidelity): same colors and feels over the v2 patches
  // (de-locked vibrato, drift, bow/breath air, register- and velocity-tracked
  // brightness). New names: the originals are unchanged.
  'violin-2': { patch: 'violin2', chain: [{ type: 'body', mix: 0.22 }, { type: 'reverb', wet: 0.32, decay: 3.5 }], feel: 'ensemble' },
  'viola-2': { patch: 'viola2', chain: [{ type: 'body', mix: 0.26 }, { type: 'reverb', wet: 0.3, decay: 3.5 }], feel: 'ensemble' },
  'cello-2': { patch: 'cello2', chain: [{ type: 'body', mix: 0.3 }, { type: 'reverb', wet: 0.3, decay: 3.5 }], feel: 'ensemble' },
  'contrabass-2': { patch: 'contrabass2', chain: [{ type: 'reverb', wet: 0.22, decay: 3 }], feel: 'robotic' },
  'trumpet-2': { patch: 'trumpet2', chain: [{ type: 'reverb', wet: 0.22, decay: 2.2 }], feel: { strum: 0.01, jitterTime: 0.007, jitterVel: 0.14 } },
  'french-horn-2': { patch: 'frenchHorn2', chain: [{ type: 'reverb', wet: 0.32, decay: 3.2 }], feel: { strum: 0.016, jitterTime: 0.01, jitterVel: 0.12 } },
  'trombone-2': { patch: 'trombone2', chain: [{ type: 'reverb', wet: 0.24, decay: 2.4 }], feel: { strum: 0.012, jitterTime: 0.008, jitterVel: 0.13 } },
  'tuba-2': { patch: 'tuba2', chain: [{ type: 'reverb', wet: 0.2, decay: 2.2 }], feel: 'robotic' },
  // Section v3 (audio improvements): the v3 patches through each instrument's
  // radiator. A bowed string is a sawtooth-like source seen through its box:
  // the air mode (A0), the two corpus modes (B1−, B1+) and the broad bridge
  // hill lift the partials that land on them, and the body barely radiates
  // below A0 (the highpass), so a violin's open G is thin and its vibrato
  // flickers as partials sweep across fixed peaks. Frequencies scale with body
  // size, less than proportionally (the bigger boxes are relatively small for
  // their range). Brass: the bell's radiation peak, darker as the bell grows
  // and, for the horn, faces away. Same rooms and feels as v2.
  'violin-3': { patch: 'violin3', chain: [{ type: 'filter', mode: 'highpass', freq: 230, q: 0.9 }, { type: 'body', mix: 1, resonances: BODY.violin }, { type: 'reverb', wet: 0.32, decay: 3.5 }], feel: 'ensemble' },
  'viola-3': { patch: 'viola3', chain: [{ type: 'filter', mode: 'highpass', freq: 185, q: 0.9 }, { type: 'body', mix: 1, resonances: BODY.viola }, { type: 'reverb', wet: 0.3, decay: 3.5 }], feel: 'ensemble' },
  'cello-3': { patch: 'cello3', chain: [{ type: 'filter', mode: 'highpass', freq: 82, q: 0.9 }, { type: 'body', mix: 1, resonances: BODY.cello }, { type: 'reverb', wet: 0.3, decay: 3.5 }], feel: 'ensemble' },
  'contrabass-3': { patch: 'contrabass3', chain: [{ type: 'filter', mode: 'highpass', freq: 48, q: 0.9 }, { type: 'body', mix: 1, resonances: BODY.contrabass }, { type: 'reverb', wet: 0.22, decay: 3 }], feel: 'robotic' },
  'trumpet-3': { patch: 'trumpet3', chain: [{ type: 'filter', mode: 'highpass', freq: 160, q: 0.7 }, { type: 'body', mix: 1, resonances: BODY.trumpet }, { type: 'reverb', wet: 0.22, decay: 2.2 }], feel: { strum: 0.01, jitterTime: 0.007, jitterVel: 0.14 } },
  'french-horn-3': { patch: 'frenchHorn3', chain: [{ type: 'filter', mode: 'highpass', freq: 65, q: 0.7 }, { type: 'body', mix: 1, resonances: BODY.horn }, { type: 'reverb', wet: 0.32, decay: 3.2 }], feel: { strum: 0.016, jitterTime: 0.01, jitterVel: 0.12 } },
  'trombone-3': { patch: 'trombone3', chain: [{ type: 'filter', mode: 'highpass', freq: 70, q: 0.7 }, { type: 'body', mix: 1, resonances: BODY.trombone }, { type: 'reverb', wet: 0.24, decay: 2.4 }], feel: { strum: 0.012, jitterTime: 0.008, jitterVel: 0.13 } },
  'tuba-3': { patch: 'tuba3', chain: [{ type: 'filter', mode: 'highpass', freq: 34, q: 0.7 }, { type: 'body', mix: 1, resonances: BODY.tuba }, { type: 'reverb', wet: 0.2, decay: 2.2 }], feel: 'robotic' },
  // the drum kit (audio fidelity): one part/track, GM drum notes pick the piece
  // (C2 kick, D2 snare, F#2 hat, A#2 open hat, F2/A2/C3 toms, C#3 crash, D#3
  // ride — GM numbers, C4 = 60). A small room; a whisper of timing/velocity looseness.
  'drum-kit': { patch: 'drumKit', chain: [{ type: 'reverb', wet: 0.1, decay: 1.2 }], feel: { jitterTime: 0.003, jitterVel: 0.1 } },
  // World strings — same two voices, new patches: shamisen is plucked (guitar
  // family), erhu is bowed (violin family).
  // A shamisen dō: a small skin-covered box — brighter, more percussive, higher
  // resonances than a wooden guitar soundbox (the "pon" of the skin). This box is
  // what separates a real shamisen from a bare twangy pluck.
  shamisen: { patch: 'shamisen', chain: [{ type: 'body', mix: 0.36, resonances: [{ freq: 180, q: 7, gain: 0.9 }, { freq: 350, q: 6, gain: 0.7 }, { freq: 700, q: 5, gain: 0.5 }, { freq: 1200, q: 4, gain: 0.3 }] }, { type: 'reverb', wet: 0.14, decay: 1.4 }], feel: { jitterTime: 0.006, jitterVel: 0.16 } },
  erhu: { patch: 'erhu', chain: [{ type: 'reverb', wet: 0.28, decay: 2.6 }], feel: { jitterTime: 0.01, jitterVel: 0.12 } },
  // steelpan (tuned struck metal) — a bright hall reverb is the steel-band setting;
  // a light timing/velocity jitter is the human mallet touch.
  'steel-drum': { patch: 'steelpan', chain: [{ type: 'reverb', wet: 0.3, decay: 2.4 }], feel: { jitterTime: 0.007, jitterVel: 0.14 } },
  // ── keyboards (B6.2b) ────────────────────────────────────────────────────────
  // A piano soundboard: big low resonances under the struck strings — the same
  // `body` trick as the guitar dreadnought, an octave down and wider. Room, not
  // hall, reverb: a piano sits IN the room.
  piano: { patch: 'piano', chain: [{ type: 'body', mix: 0.3, resonances: [{ freq: 90, q: 7, gain: 0.9 }, { freq: 180, q: 6, gain: 0.7 }, { freq: 280, q: 5, gain: 0.5 }, { freq: 450, q: 4, gain: 0.35 }] }, { type: 'reverb', wet: 0.16, decay: 1.8 }], feel: 'keys' },
  // the tuned grand (audio fidelity): same soundboard and room as `piano`.
  'grand-piano': { patch: 'pianoGrand', chain: [{ type: 'body', mix: 0.3, resonances: [{ freq: 90, q: 7, gain: 0.9 }, { freq: 180, q: 6, gain: 0.7 }, { freq: 280, q: 5, gain: 0.5 }, { freq: 450, q: 4, gain: 0.35 }] }, { type: 'reverb', wet: 0.16, decay: 1.8 }], feel: 'keys' },
  // suitcase rhodes: the chorus is the stereo vibrato of the amp — it's half the sound.
  rhodes: { patch: 'rhodes', chain: [{ type: 'chorus', rate: 0.8, depth: 0.006, mix: 0.4 }, { type: 'reverb', wet: 0.18, decay: 1.8 }], feel: 'keys' },
  // harpsichord: NO velocity jitter — the quill gives every note the same weight
  // (that flatness is the instrument, not a limitation). Tiny timing humanization only.
  harpsichord: { patch: 'harpsichord', chain: [{ type: 'body', mix: 0.28, resonances: [{ freq: 140, q: 7, gain: 0.8 }, { freq: 320, q: 5, gain: 0.55 }, { freq: 600, q: 4, gain: 0.35 }] }, { type: 'reverb', wet: 0.2, decay: 1.9 }], feel: { jitterTime: 0.005 } },
  // clavinet through a lightly driven amp — Superstition. Staccato is the idiom.
  clavinet: { patch: 'clav', chain: [{ type: 'drive', amount: 0.3, tone: 3400 }, { type: 'reverb', wet: 0.1, decay: 1.2 }], feel: 'staccato' },
  celesta: { patch: 'celesta', chain: [{ type: 'reverb', wet: 0.3, decay: 2.4 }], feel: 'keys' },
  // a music box is a machine — perfectly quantized IS the sound. Long sweet reverb.
  'music-box': { patch: 'musicBox', chain: [{ type: 'reverb', wet: 0.35, decay: 2.8 }], feel: 'robotic' },
  // drawbar organ: binary keys (no velocity), rotary swirl from a deeper chorus.
  organ: { patch: 'organ', chain: [{ type: 'chorus', rate: 0.7, depth: 0.007, mix: 0.5 }, { type: 'reverb', wet: 0.22, decay: 2 }], feel: 'robotic' },
  // ── the orchestra shelf (orchestra and era) ───────────────────────────────
  // Woodwinds: a formant `body` is the reed's hollow (oboe ~1.1 / 2.9 kHz,
  // bassoon ~480 Hz / 1.15 kHz), hall reverb. `-2` = a small section.
  flute: { patch: 'flute', chain: [{ type: 'reverb', wet: 0.3, decay: 3 }], feel: { jitterTime: 0.008, jitterVel: 0.1 } },
  clarinet: { patch: 'clarinet', chain: [{ type: 'body', mix: 0.18, resonances: [{ freq: 1500, q: 3, gain: 0.6 }, { freq: 3200, q: 4, gain: 0.3 }] }, { type: 'reverb', wet: 0.28, decay: 3 }], feel: { jitterTime: 0.008, jitterVel: 0.1 } },
  oboe: { patch: 'oboe', chain: [{ type: 'body', mix: 0.45, resonances: [{ freq: 1100, q: 5, gain: 1 }, { freq: 2900, q: 5, gain: 0.55 }] }, { type: 'reverb', wet: 0.28, decay: 3 }], feel: { jitterTime: 0.008, jitterVel: 0.1 } },
  bassoon: { patch: 'bassoon', chain: [{ type: 'body', mix: 0.45, resonances: [{ freq: 480, q: 5, gain: 1 }, { freq: 1150, q: 5, gain: 0.5 }] }, { type: 'reverb', wet: 0.26, decay: 3 }], feel: { jitterTime: 0.009, jitterVel: 0.1 } },
  harp: { patch: 'harp', chain: [{ type: 'body', mix: 0.2, resonances: [{ freq: 130, q: 6, gain: 0.8 }, { freq: 260, q: 5, gain: 0.5 }] }, { type: 'reverb', wet: 0.34, decay: 3.2 }], feel: { jitterTime: 0.006, jitterVel: 0.12 } },
  glockenspiel: { patch: 'glockenspiel', chain: [{ type: 'reverb', wet: 0.3, decay: 2.8 }], feel: { jitterTime: 0.004, jitterVel: 0.1 } },
  xylophone: { patch: 'xylophone', chain: [{ type: 'reverb', wet: 0.24, decay: 2.2 }], feel: { jitterTime: 0.004, jitterVel: 0.12 } },
  marimba: { patch: 'marimba', chain: [{ type: 'body', mix: 0.15, resonances: [{ freq: 220, q: 4, gain: 0.6 }] }, { type: 'reverb', wet: 0.24, decay: 2.2 }], feel: { jitterTime: 0.005, jitterVel: 0.12 } },
  vibraphone: { patch: 'vibraphone', chain: [{ type: 'reverb', wet: 0.28, decay: 2.6 }], feel: { jitterTime: 0.005, jitterVel: 0.12 } },
  'tubular-bells': { patch: 'tubularBells', chain: [{ type: 'reverb', wet: 0.36, decay: 3.6 }], feel: 'robotic' },
  timpani: { patch: 'timpani', chain: [{ type: 'reverb', wet: 0.3, decay: 3 }], feel: { jitterTime: 0.005, jitterVel: 0.08 } },
};
for (const w of ['flute', 'clarinet', 'oboe', 'bassoon']) INSTRUMENTS[w + '-2'] = { ...INSTRUMENTS[w], patch: w + '2', feel: 'ensemble' };
// `-3` (audio improvements) = the solo player whose tone follows force (harmonicsLoud).
for (const w of ['flute', 'clarinet', 'oboe', 'bassoon']) INSTRUMENTS[w + '-3'] = { ...INSTRUMENTS[w], patch: w + '3' };
// percussion kits (orchestra and era): every piece `vary`-able, GM note maps,
// hat chokes. The arena kit's chain IS its kit bus: parallel compression under
// the dry kit, then one shared room2 (20 ms pre-delay) with a driven return —
// a row's `roomMix` sets how big the room is.
Object.assign(INSTRUMENTS, {
  'drum-machine-88': { patch: 'drumMachine88', feel: 'robotic' },
  'drum-machine-909': { patch: 'drumMachine909', chain: [{ type: 'reverb', wet: 0.06, decay: 0.9 }], feel: 'robotic' },
  'drum-machine-bright': { patch: 'drumMachineBright', feel: 'robotic' },
  'acoustic-kit': { patch: 'acousticKit', chain: [{ type: 'reverb', model: 'room2', decay: 1.2, wet: 0.14 }], feel: { jitterTime: 0.003, jitterVel: 0.1 } },
  'latin-perc': { patch: 'latinPerc', chain: [{ type: 'reverb', wet: 0.14, decay: 1.4 }], feel: { jitterTime: 0.005, jitterVel: 0.14 } },
  'orchestral-perc': { patch: 'orchestralPerc', chain: [{ type: 'reverb', model: 'room2', decay: 3, wet: 0.32 }], feel: { jitterTime: 0.004, jitterVel: 0.08 } },
  'stadium-kit': { patch: 'stadiumKit', chain: [{ type: 'compress', parallel: 0.6, threshold: -32, ratio: 10, attack: 0.002, release: 0.1 }, { type: 'reverb', model: 'room2', decay: 2.2, predelay: 0.02, damp: 0.45, wet: 0.4, drive: 0.25 }], feel: 'rock-drummer' },
  crotales: { patch: 'crotales', chain: [{ type: 'reverb', wet: 0.32, decay: 3.2 }], feel: 'robotic' },
  // the power-ballad arena: the same kit into a GATED room (huge, then gone).
  'stadium-kit-gated': { patch: 'stadiumKit', chain: [{ type: 'compress', parallel: 0.6, threshold: -32, ratio: 10, attack: 0.002, release: 0.1 }, { type: 'reverb', model: 'gated', decay: 1.8, predelay: 0.012, damp: 0.35, gate: 0.32, wet: 0.55, drive: 0.3 }], feel: 'rock-drummer' },
  // the era synths: named for what they are; the machines they recall live in card prose.
  'acid-bass': { patch: 'acidBass', chain: [{ type: 'drive', amount: 0.25, tone: 5200 }, { type: 'delay', time: '3/16', feedback: 0.3, mix: 0.18 }], feel: 'robotic' },
  'reese-bass': { patch: 'reeseBass', chain: [{ type: 'drive', amount: 0.2, tone: 3200 }], feel: 'robotic' },
  hoover: { patch: 'hoover', chain: [{ type: 'chorus', model: 'bbd', mode: 'II', mix: 0.55 }, { type: 'reverb', wet: 0.22, decay: 2 }], feel: 'robotic' },
  'poly-strings': { patch: 'polyStrings', chain: [{ type: 'chorus', model: 'bbd', mode: 'II', mix: 0.5 }, { type: 'reverb', wet: 0.3, decay: 3 }], feel: 'robotic' },
  'string-machine': { patch: 'stringMachine', chain: [{ type: 'chorus', model: 'bbd', mode: 'I+II', mix: 0.55 }, { type: 'reverb', wet: 0.28, decay: 2.6 }], feel: 'robotic' },
  'trance-pluck': { patch: 'trancePluck', chain: [{ type: 'pingpong', time: '3/16', feedback: 0.4, mix: 0.3 }, { type: 'reverb', wet: 0.3, decay: 3 }], feel: 'robotic' },
  'supersaw-lead': { patch: 'supersawLead', chain: [{ type: 'delay', time: '3/16', feedback: 0.35, mix: 0.22 }, { type: 'reverb', wet: 0.32, decay: 3.2 }], feel: 'robotic' },
  'rave-stab': { patch: 'raveStab', chain: [{ type: 'reverb', wet: 0.18, decay: 1.6 }], feel: 'robotic' },
  'wobble-bass': { patch: 'wobbleBass', chain: [{ type: 'drive', amount: 0.3, tone: 4200 }], feel: 'robotic' },
  'fm-bass': { patch: 'fmBass', feel: 'robotic' },
  'fm-keys': { patch: 'fmKeys', chain: [{ type: 'chorus', rate: 0.7, depth: 0.004, mix: 0.4 }, { type: 'reverb', wet: 0.2, decay: 1.8 }], feel: 'keys' },
  'fm-brass': { patch: 'fmBrass', chain: [{ type: 'reverb', wet: 0.22, decay: 2 }], feel: { strum: 0.008, jitterTime: 0.006, jitterVel: 0.1 } },
  'fm-organ': { patch: 'fmOrgan', chain: [{ type: 'chorus', rate: 0.9, depth: 0.006, mix: 0.45 }, { type: 'reverb', wet: 0.2, decay: 1.8 }], feel: 'robotic' },
  'fm-bell': { patch: 'fmBell4', chain: [{ type: 'reverb', wet: 0.3, decay: 3 }], feel: 'robotic' },
});

// anthem styles: the band. The drop-tuned rhythm wall runs hotter than
// rock-guitar and cuts lower; the basses carry their own drive.
Object.assign(INSTRUMENTS, {
  'drop-guitar': { patch: 'guitarDropChug', chain: [{ type: 'amp', gain: 46, bias: 0.2, presence: 5, cut: 4800 }, { type: 'reverb', wet: 0.05, decay: 0.9 }], feel: 'palm-mute' },
  'picked-bass': { patch: 'bassPick', chain: [{ type: 'drive', amount: 0.22, tone: 3200 }], feel: { jitterTime: 0.004, jitterVel: 0.1 } },
  'slap-bass': { patch: 'bassSlap', chain: [{ type: 'drive', amount: 0.12, tone: 5200 }], feel: { jitterTime: 0.004, jitterVel: 0.14 } },
  // the 90s rock kit: parallel compression, then a short bright plate.
  'drum-kit-90s-rock': { patch: 'rockKit90s', chain: [{ type: 'compress', parallel: 0.45, threshold: -30, ratio: 8, attack: 0.002, release: 0.08 }, { type: 'reverb', model: 'plate', decay: 1.3, predelay: 0.006, wet: 0.24 }], feel: 'rock-drummer' },
  // the orchestra hit into a hall (a section change's exclamation mark).
  'orchestra-hit': { patch: 'orchHit', chain: [{ type: 'reverb', model: 'room2', decay: 2.8, predelay: 0.02, wet: 0.35 }], feel: { strum: 0.004 } },
  // roots styles (country, blues, the soloist)
  'twang-guitar': { patch: 'guitarTwang', chain: [{ type: 'compress', threshold: -24, ratio: 4, attack: 0.003, release: 0.12 }, { type: 'delay', time: 0.11, feedback: 0, mix: 0.3 }, { type: 'reverb', model: 'room2', decay: 1.2, wet: 0.1 }], feel: 'alt-pick' },
  'crunch-guitar': { patch: 'guitarElectric', chain: [{ type: 'drive', model: 'tube', amount: 0.38, tone: 3000 }, { type: 'reverb', model: 'room2', decay: 1.4, wet: 0.12 }], feel: 'alt-pick' },
  'pedal-steel': { patch: 'pedalSteel', chain: [{ type: 'delay', time: '3/16', feedback: 0.2, mix: 0.14 }, { type: 'reverb', wet: 0.24, decay: 2.4 }], feel: { jitterTime: 0.006, jitterVel: 0.06 } },
  banjo: { patch: 'banjo', chain: [{ type: 'body', mix: 0.45, resonances: [{ freq: 360, q: 6, gain: 1 }, { freq: 720, q: 5, gain: 0.6 }, { freq: 1500, q: 4, gain: 0.35 }] }, { type: 'reverb', model: 'room2', decay: 1, wet: 0.08 }], feel: 'fingerpick' },
  harmonica: { patch: 'harmonica', chain: [{ type: 'drive', amount: 0.18, tone: 2800 }, { type: 'reverb', model: 'room2', decay: 1.3, wet: 0.14 }], feel: { jitterTime: 0.008, jitterVel: 0.08 } },
  'upright-bass': { patch: 'bassUpright', chain: [{ type: 'body', mix: 0.3, resonances: [{ freq: 90, q: 6, gain: 1 }, { freq: 190, q: 5, gain: 0.5 }] }], feel: { jitterTime: 0.005, jitterVel: 0.1 } },
  fiddle: { patch: 'violin2', chain: [{ type: 'body', mix: 0.28 }, { type: 'reverb', model: 'room2', decay: 1.4, wet: 0.14 }], feel: { jitterTime: 0.006, jitterVel: 0.08 } },
  'organ-rotary': { patch: 'organ', chain: [{ type: 'rotary', speed: 'fast' }, { type: 'drive', amount: 0.15, tone: 3600 }, { type: 'reverb', model: 'room2', decay: 1.6, wet: 0.14 }], feel: 'robotic' },
  'classical-guitar': { patch: 'guitarClassical', chain: [{ type: 'body', mix: 0.42, resonances: [{ freq: 95, q: 9, gain: 1 }, { freq: 185, q: 7, gain: 0.75 }, { freq: 280, q: 6, gain: 0.5 }] }, { type: 'reverb', wet: 0.24, decay: 2.4 }], feel: 'fingerpick' },
  'flamenco-guitar': { patch: 'guitarFlamenco', chain: [{ type: 'body', mix: 0.38, resonances: [{ freq: 110, q: 8, gain: 0.8 }, { freq: 230, q: 7, gain: 0.8 }, { freq: 3200, q: 2, gain: 0.35 }] }, { type: 'reverb', model: 'room2', decay: 1.3, wet: 0.12 }], feel: 'fingerpick' },
  'gypsy-jazz-guitar': { patch: 'guitarGypsy', chain: [{ type: 'body', mix: 0.36, resonances: [{ freq: 220, q: 6, gain: 1 }, { freq: 480, q: 5, gain: 0.6 }, { freq: 2600, q: 2, gain: 0.3 }] }, { type: 'reverb', model: 'room2', decay: 1.1, wet: 0.1 }], feel: 'alt-pick' },
  'brush-kit': { patch: 'brushKit', chain: [{ type: 'reverb', model: 'room2', decay: 1.1, wet: 0.14 }], feel: { jitterTime: 0.005, jitterVel: 0.12 } },
  'blues-kit': { patch: 'acousticKit', chain: [{ type: 'compress', threshold: -22, ratio: 3, attack: 0.004, release: 0.1 }, { type: 'reverb', model: 'room2', decay: 1.4, wet: 0.16 }], feel: { jitterTime: 0.006, jitterVel: 0.12 } },
  palmas: { patch: 'palmas', chain: [{ type: 'reverb', model: 'room2', decay: 1.2, wet: 0.2 }], feel: { jitterTime: 0.007, jitterVel: 0.15 } },
});

// Wooden bodies v2 (audio improvements): the acoustic guitars, harp and grand
// through a modal body — dozens of seeded body modes shaped by the same
// resonance set, convolved (`body` model 'modal'), instead of three broad
// peaks; the guitars on the tuned string. Same rooms and feels. Soundboards
// ring longer and reach higher than guitar boxes.
const MODAL = {
  'acoustic-guitar': { patch: 'guitarClean2', modes: 64, ring: 0.16, lo: 80, hi: 5000, mix: 0.55 },
  'nylon-guitar': { patch: 'guitarNylon2', modes: 64, ring: 0.18, lo: 80, hi: 4000, mix: 0.55 },
  'classical-guitar': { patch: 'guitarClassical2', modes: 64, ring: 0.18, lo: 80, hi: 4000, mix: 0.55 },
  'flamenco-guitar': { patch: 'guitarFlamenco2', modes: 64, ring: 0.12, lo: 90, hi: 6000, mix: 0.5 },
  'gypsy-jazz-guitar': { patch: 'guitarGypsy2', modes: 56, ring: 0.1, lo: 120, hi: 6000, mix: 0.5 },
  harp: { patch: 'harp', modes: 72, ring: 0.22, lo: 70, hi: 5000, mix: 0.45 },
  'grand-piano': { patch: 'pianoGrand', modes: 96, ring: 0.28, lo: 50, hi: 6000, mix: 0.45 },
};
for (const [name, m] of Object.entries(MODAL)) {
  const { patch, ...body } = m, base = INSTRUMENTS[name];
  INSTRUMENTS[name + '-2'] = { ...base, patch, chain: base.chain.map((f) => (f.type === 'body' ? { type: 'body', model: 'modal', resonances: f.resonances, ...body } : f)) };
}

// grand-piano-3 (audio improvements): grand-piano-2's soundboard over keys
// tuned each their own way, and the pedal-down halo — every undamped string
// ringing in sympathy (`sympathetic`). The dial (`life`) scales both.
INSTRUMENTS['grand-piano-3'] = { ...INSTRUMENTS['grand-piano-2'], patch: 'pianoGrand3', chain: [...INSTRUMENTS['grand-piano-2'].chain.filter((f) => f.type !== 'reverb'), { type: 'sympathetic', mix: 0.22, decay: 8 }, ...INSTRUMENTS['grand-piano-2'].chain.filter((f) => f.type === 'reverb')] };

// ── playable ranges (orchestra and era) — sounding pitch, lowest–highest.
// Advice only: validation warns on a note outside, the note still plays. A
// range is shelf data beside the instrument; it never reaches a manifest.
const RANGE = {
  violin: ['G3', 'E7'], viola: ['C3', 'E6'], cello: ['C2', 'A5'], contrabass: ['E1', 'G4'],
  trumpet: ['F#3', 'D6'], 'french-horn': ['B1', 'F5'], trombone: ['E2', 'F5'], tuba: ['D1', 'F4'],
  piano: ['A0', 'C8'], 'grand-piano': ['A0', 'C8'], harpsichord: ['F1', 'F6'], celesta: ['C4', 'C8'],
  'acoustic-guitar': ['E2', 'B5'], 'nylon-guitar': ['E2', 'B5'], erhu: ['D4', 'D7'], shamisen: ['C3', 'C6'],
  flute: ['C4', 'C7'], clarinet: ['D3', 'Bb6'], oboe: ['Bb3', 'A6'], bassoon: ['Bb1', 'E5'], harp: ['B0', 'G#7'],
  glockenspiel: ['G5', 'C8'], xylophone: ['F4', 'C8'], marimba: ['C2', 'C7'], vibraphone: ['F3', 'F6'],
  'tubular-bells': ['C4', 'F5'], timpani: ['D2', 'C4'], crotales: ['C6', 'C8'],
  'drop-guitar': ['B1', 'E6'], 'picked-bass': ['B0', 'G4'], 'slap-bass': ['B0', 'G4'],
  'twang-guitar': ['E2', 'E6'], 'crunch-guitar': ['E2', 'E6'], 'pedal-steel': ['E2', 'E6'], banjo: ['C3', 'D6'],
  harmonica: ['C4', 'C7'], 'upright-bass': ['E1', 'G4'], fiddle: ['G3', 'E7'], 'classical-guitar': ['E2', 'B5'],
  'flamenco-guitar': ['E2', 'B5'], 'gypsy-jazz-guitar': ['E2', 'C6'],
};
for (const [name, r] of Object.entries(RANGE)) {
  for (const n of [name, name + '-2', name + '-3']) if (INSTRUMENTS[n]) INSTRUMENTS[n].range = r;
}
// the range of the first instrument voiced by a patch (normalized rows carry
// only the patch name).
export function rangeOfPatch(patch) {
  if (!patch) return null;
  for (const inst of Object.values(INSTRUMENTS)) if (inst.patch === patch && inst.range) return inst.range;
  return null;
}

// Resolve a feel value (preset name | inline params | null) to a params object,
// or undefined when it carries no params (the quantized/null feel).
export function resolveFeel(value) {
  if (value == null) return undefined;
  let obj;
  if (typeof value === 'string') {
    if (!FEEL_PRESETS[value]) {
      throw new Error(`beats: unknown feel preset '${value}'. Known presets: ${Object.keys(FEEL_PRESETS).join(', ')}.`);
    }
    obj = { ...FEEL_PRESETS[value] };
  } else if (typeof value === 'object' && !Array.isArray(value)) {
    obj = { ...value };
  } else {
    throw new Error('beats: feel must be a preset name (string) or a params object.');
  }
  return Object.keys(obj).length ? obj : undefined;
}

// Shallow-merge two feel values (base under override, override wins per-key).
function mergeFeel(base, over) {
  const a = resolveFeel(base) || {};
  const b = resolveFeel(over) || {};
  const merged = { ...a, ...b };
  return Object.keys(merged).length ? merged : undefined;
}

// Resolve an instrument name + part-level overrides → { patch, chain, feel }.
// patch/chain replace wholesale (override wins); feel shallow-merges so a part
// can tweak one param (e.g. widen the strum) without redeclaring the preset.
export function resolveInstrument(name, overrides) {
  const base = INSTRUMENTS[name];
  if (!base) {
    throw new Error(`beats: unknown instrument '${name}'. Known instruments: ${Object.keys(INSTRUMENTS).join(', ')}.`);
  }
  const o = overrides || {};
  return {
    patch: o.patch || base.patch,
    chain: o.chain !== undefined ? o.chain : base.chain,
    feel: mergeFeel(base.feel, o.feel),
  };
}

// Shelf-integrity: every instrument references a real patch and a valid feel.
// Called by a test so a typo in the shelf fails loudly rather than at play time.
export function auditInstruments() {
  const problems = [];
  for (const [name, inst] of Object.entries(INSTRUMENTS)) {
    if (!PATCHES[inst.patch]) problems.push(`instrument '${name}' → unknown patch '${inst.patch}'`);
    if (typeof inst.feel === 'string' && !FEEL_PRESETS[inst.feel]) problems.push(`instrument '${name}' → unknown feel preset '${inst.feel}'`);
  }
  for (const [name, patch] of Object.entries(PATCHES)) {
    for (const [midi, piece] of Object.entries(patch.kit || {})) if (!PATCHES[piece]) problems.push(`kit '${name}' note ${midi} → unknown patch '${piece}'`);
  }
  return problems;
}
