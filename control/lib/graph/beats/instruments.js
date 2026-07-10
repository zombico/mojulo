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
};

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
  return problems;
}
