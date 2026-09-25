/**
 * audio-patches — the named synth-patch shelf (beats.plan.md), in the spirit of
 * theme packs: tiny param sets the beats-kernel voices interpret. A patch is a
 * PURE param object — no audio nodes, no time, no state — so the Phase-5 verify
 * contract ("patches are pure functions of (params, time)") holds by construction:
 * the kernel realizes (patch, hz, t, dur, vel) into nodes; the patch itself never
 * changes between calls.
 *
 * Voice kinds (see beats-kernel playVoice): osc | noise | membrane | fm | string.
 * Volumes are dB against the engine master. Patch names are the vocabulary the
 * beats manifests reference (`channel.patch: 'pad'`); getPatch merges per-channel
 * overrides without mutating the shelf.
 */

export const PATCHES = {
  // sustained triangle poly-pad — the Night Circuit harmony voice.
  pad: { voice: 'osc', wave: 'triangle', attack: 1.4, decay: 0.4, sustain: 0.8, release: 3.5, volume: -16 },
  // filtered saw mono bass — roots.
  bassMono: { voice: 'osc', wave: 'sawtooth', attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.5, volume: -11, filter: { mode: 'lowpass', freq: 420, q: 1 } },
  // plain sine pluck — the default voice and the ambient melody lead.
  sinePluck: { voice: 'osc', wave: 'sine', attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.9, volume: -15 },
  // square chip lead — chiptune melodies and gestures.
  chipLead: { voice: 'osc', wave: 'square', attack: 0.002, decay: 0.08, sustain: 0.35, release: 0.05, volume: -15 },
  // 2-op FM bell — the DX7 catalog in one patch (ratio/index/modDecay tunable).
  fmBell: { voice: 'fm', ratio: 3.5, index: 4, modDecay: 0.8, attack: 0.002, decay: 0.6, sustain: 0.1, release: 1.2, volume: -16 },
  // pitch-swept sine kick — an 808 is a swept sine.
  kick: { voice: 'membrane', octaves: 5, pitchDecay: 0.045, attack: 0.001, decay: 0.35, sustain: 0, release: 0.05, volume: -8 },
  // white-noise hat — short envelope, highpassed at the voice filter.
  hat: { voice: 'noise', attack: 0.001, decay: 0.045, sustain: 0, release: 0.01, volume: -22, filter: { mode: 'highpass', freq: 8000 } },
  // longer noise wash — snares, scuffs, impacts.
  burstSoft: { voice: 'noise', attack: 0.001, decay: 0.18, sustain: 0, release: 0.05, volume: -16, filter: { mode: 'highpass', freq: 1200 } },
  // detuned-saw garage/house chord stab (B5.0, Night Bus spike): unison saws
  // through a swept low-pass — the signature is the 2200→420Hz filter envelope.
  sawStab: { voice: 'osc', wave: 'sawtooth', detune: 12, unison: 4, attack: 0.003, decay: 0.24, sustain: 0, release: 0.08, volume: -18, filter: { mode: 'lowpass', q: 1.2 }, filterEnv: { from: 2200, to: 420, decay: 0.2 } },
  // Karplus-Strong plucked strings (voice: 'string'). The ADSR is a near-flat gate
  // (fast attack, sustain 1, short release) — the RING comes from the string math,
  // not the envelope. pluckDamping is the steel↔nylon brightness axis, pluckDecay
  // is how long it sustains, pick rounds the attack.
  // steel-string acoustic / clean electric — the default guitar. Heavy pick
  // smoothing rounds off the quill-like attack (the "harpsichord" tell) and the
  // body low-pass rolls off the metallic top like a wooden soundboard.
  guitarClean: { voice: 'string', pluckDamping: 0.72, pluckDecay: 0.9965, pick: 0.42, attack: 0.006, decay: 0.05, sustain: 1, release: 0.14, volume: -12, filter: { mode: 'lowpass', freq: 2800, q: 0.7 } },
  // warm nylon / classical — darkest loop filter, softest pick, lowest body cutoff.
  guitarNylon: { voice: 'string', pluckDamping: 0.9, pluckDecay: 0.9955, pick: 0.65, attack: 0.008, decay: 0.05, sustain: 1, release: 0.16, volume: -12, filter: { mode: 'lowpass', freq: 2100, q: 0.6 } },
  // palm-muted chug — short ring, tighter body, quick release. Riffs and downstrokes.
  guitarMuted: { voice: 'string', pluckDamping: 0.6, pluckDecay: 0.984, pick: 0.22, attack: 0.003, decay: 0.04, sustain: 1, release: 0.06, volume: -11, filter: { mode: 'lowpass', freq: 3000, q: 0.7 } },
  // driven electric lead — long ring through a resonant low-pass for a vocal, amp-like
  // body (the filter is the "cabinet"; overdrive proper is a future waveshaper voice).
  guitarLead: { voice: 'string', pluckDamping: 0.5, pluckDecay: 0.9985, pick: 0.28, attack: 0.004, decay: 0.06, sustain: 1, release: 0.2, volume: -13, filter: { mode: 'lowpass', freq: 2600, q: 3 } },
  // raw electric pickup — bright, long-sustaining, NO baked cabinet: pair it with a
  // `drive` chain effect (the amp) which supplies the overdrive + cabinet tone.
  // e.g. chain: [{ type:'drive', amount:0.5, tone:3200 }, { type:'reverb', wet:0.12 }].
  guitarElectric: { voice: 'string', pluckDamping: 0.42, pluckDecay: 0.9986, pick: 0.18, attack: 0.003, decay: 0.06, sustain: 1, release: 0.18, volume: -14 },
  // amp-voice feedstock (B6 amp spike): guitarElectric with two detuned plucks
  // (pluckDetune, cents) and a longer ring. The beating is barely audible dry;
  // through an `amp` chain the difference tones become the growl. New name, not a
  // guitarElectric edit — existing artifacts re-synthesize byte-identical.
  guitarAmp: { voice: 'string', pluckDamping: 0.42, pluckDecay: 0.999, pick: 0.15, pluckDetune: 9, attack: 0.003, decay: 0.06, sustain: 1, release: 0.22, volume: -14 },
  // Bowed strings (voice: 'osc', sawtooth) — the string-machine / section sound,
  // NOT the plucked `string` voice. The bow is a slow attack + sustain; ensemble
  // `unison`/`detune` gives the section chorus; `vibrato` is the pitch wobble that
  // reads as bowed. Register is set by the low-pass cutoff (bright violin → dark
  // bass) and the notes you play. Warm them further with a `body` chain effect.
  violin: { voice: 'osc', wave: 'sawtooth', attack: 0.16, decay: 0.2, sustain: 0.85, release: 0.4, volume: -17, unison: 3, detune: 10, vibrato: { rate: 5.8, depth: 12 }, filter: { mode: 'lowpass', freq: 4200, q: 0.6 } },
  viola: { voice: 'osc', wave: 'sawtooth', attack: 0.2, decay: 0.2, sustain: 0.85, release: 0.45, volume: -16, unison: 3, detune: 11, vibrato: { rate: 5.4, depth: 12 }, filter: { mode: 'lowpass', freq: 3200, q: 0.6 } },
  cello: { voice: 'osc', wave: 'sawtooth', attack: 0.22, decay: 0.22, sustain: 0.85, release: 0.55, volume: -15, unison: 3, detune: 9, vibrato: { rate: 5.0, depth: 11 }, filter: { mode: 'lowpass', freq: 2400, q: 0.6 } },
  contrabass: { voice: 'osc', wave: 'sawtooth', attack: 0.18, decay: 0.2, sustain: 0.8, release: 0.45, volume: -13, unison: 2, detune: 7, vibrato: { rate: 4.6, depth: 8 }, filter: { mode: 'lowpass', freq: 1300, q: 0.7 } },
  // Brass (voice: 'osc', sawtooth) — the '80s synth-brass recipe. THE signature is
  // the filterEnv that OPENS on the attack (cutoff sweeps UP: low → high), the
  // note "blaring" brighter as it's blown; `q` adds the honk. Vibrato blooms in on
  // held notes. Register + brightness set by the filterEnv ceiling. No new voice.
  trumpet: { voice: 'osc', wave: 'sawtooth', attack: 0.03, decay: 0.1, sustain: 0.8, release: 0.2, volume: -16, unison: 2, detune: 6, vibrato: { rate: 5.6, depth: 9, delay: 0.3 }, filter: { mode: 'lowpass', q: 1.4 }, filterEnv: { from: 800, to: 4800, decay: 0.06 } },
  frenchHorn: { voice: 'osc', wave: 'sawtooth', attack: 0.06, decay: 0.12, sustain: 0.85, release: 0.4, volume: -15, unison: 2, detune: 8, vibrato: { rate: 5.0, depth: 7, delay: 0.35 }, filter: { mode: 'lowpass', q: 1.1 }, filterEnv: { from: 400, to: 2600, decay: 0.12 } },
  trombone: { voice: 'osc', wave: 'sawtooth', attack: 0.04, decay: 0.1, sustain: 0.82, release: 0.3, volume: -15, unison: 2, detune: 6, vibrato: { rate: 5.2, depth: 8, delay: 0.3 }, filter: { mode: 'lowpass', q: 1.3 }, filterEnv: { from: 450, to: 3200, decay: 0.08 } },
  tuba: { voice: 'osc', wave: 'sawtooth', attack: 0.05, decay: 0.12, sustain: 0.8, release: 0.35, volume: -12, unison: 1, detune: 0, vibrato: { rate: 4.5, depth: 5, delay: 0.4 }, filter: { mode: 'lowpass', q: 1.2 }, filterEnv: { from: 250, to: 1500, decay: 0.1 } },
  // shamisen — PLUCKED (string voice), a bright/twangy cousin of the guitars: a
  // hard plectrum (bachi) attack (near-zero pick), short ring, and low damping so
  // the high partials jangle — approximating the sawari buzz. Highpass thins it.
  // attackNoise = the bachi (plectrum) contact click: a bright, very short noise
  // burst layered at onset — the percussive "chak" that makes it read as a bachi
  // strike, not just a plucked string.
  shamisen: { voice: 'string', pluckDamping: 0.22, pluckDecay: 0.991, pick: 0.04, attack: 0.002, decay: 0.04, sustain: 1, release: 0.08, volume: -12, filter: { mode: 'highpass', freq: 260, q: 0.7 }, attackNoise: { level: -9, decay: 0.022, tone: 2400, q: 0.6 } },
  // erhu — BOWED (osc voice), a nasal, vocal cousin of the strings: a RESONANT
  // (high-Q) low-pass gives the reedy/nasal edge, and a deep, fast vibrato that
  // blooms in quickly is the erhu's singing signature. Solo (no ensemble unison).
  erhu: { voice: 'osc', wave: 'sawtooth', attack: 0.09, decay: 0.15, sustain: 0.9, release: 0.4, volume: -16, unison: 1, detune: 0, vibrato: { rate: 6.2, depth: 22, delay: 0.12 }, filter: { mode: 'lowpass', freq: 2200, q: 3 } },
  // ── keyboards (B6.2b) — all reachable from existing voices; no new topology ──
  // rhodes — electric piano (FM voice). The tine is a near-harmonic 2-op stack:
  // ratio 1 keeps it pitched, the index envelope IS the "bark" (bright strike
  // that mellows into a sine-ish sustain). Pair with a chorus chain (the stereo
  // vibrato of the suitcase amp).
  rhodes: { voice: 'fm', ratio: 1, index: 1.8, modDecay: 0.4, attack: 0.004, decay: 0.6, sustain: 0.5, release: 0.9, volume: -14, filter: { mode: 'lowpass', freq: 3800, q: 0.7 }, velToFilter: 1.2 },
  // harpsichord — the quill: pick 0 (the sharp attack the guitars engineer AWAY
  // from is exactly a plucked quill), bright low damping, moderate ring. No
  // velocity-to-anything: a harpsichord has no dynamics — that's its character.
  harpsichord: { voice: 'string', pluckDamping: 0.3, pluckDecay: 0.994, pick: 0, attack: 0.002, decay: 0.04, sustain: 1, release: 0.1, volume: -14, filter: { mode: 'lowpass', freq: 4600, q: 0.6 } },
  // clavinet — a struck/fretted string against a pickup: short funky ring, bright,
  // a little resonant bite. Wants a light drive chain (the amp) + staccato feel.
  clav: { voice: 'string', pluckDamping: 0.35, pluckDecay: 0.988, pick: 0.08, attack: 0.002, decay: 0.04, sustain: 1, release: 0.06, volume: -13, filter: { mode: 'lowpass', freq: 3200, q: 1.4 }, velToFilter: 0.9 },
  // piano — acoustic piano, MODELED not sampled (B6 doctrine): a hammer-struck KS
  // string. pick rounds the felt hammer, long pluckDecay is the open-string ring,
  // velToFilter is the defining expressive axis (harder = brighter, not just
  // louder), attackNoise is the hammer knock. The soundboard lives in the
  // instrument's `body` chain. pluckDetune = the unison course (a real key strikes
  // 2-3 strings ~1-3 cents apart): the slow beat between them is the piano's
  // shimmer AND its two-stage decay — unison energy cancels fast (the bloom), the
  // detuned residue rings on (the singing tail). maxRing lifted so bass notes
  // ring like open strings, not gated samples.
  piano: { voice: 'string', pluckDamping: 0.55, pluckDecay: 0.998, pick: 0.3, pluckDetune: 2.5, maxRing: 6, attack: 0.004, decay: 0.05, sustain: 1, release: 0.16, volume: -12, filter: { mode: 'lowpass', freq: 3400, q: 0.7 }, velToFilter: 1.6, attackNoise: { level: -20, decay: 0.014, tone: 320, q: 0.7 } },
  // celesta — struck steel plate over a wooden resonator (modal): a strong pure
  // fundamental, one bright shimmer partial, dies sweetly. The Nutcracker voice.
  celesta: {
    voice: 'modal', attack: 0.002, volume: -12,
    partials: [
      { ratio: 1, gain: 1.0, decay: 1.6 },
      { ratio: 4, gain: 0.22, decay: 0.5 },
      { ratio: 5.4, gain: 0.08, decay: 0.2 },
    ],
    attackNoise: { level: -26, decay: 0.006, tone: 3800, q: 0.5 },
  },
  // music box — a plucked comb tine (modal): bright, slightly inharmonic uppers,
  // tiny body, quick sparkle. Pair with the `robotic` feel — it IS a machine.
  musicBox: {
    voice: 'modal', attack: 0.001, volume: -16,
    partials: [
      { ratio: 1, gain: 1.0, decay: 1.2 },
      { ratio: 3.4, gain: 0.3, decay: 0.5 },
      { ratio: 6.8, gain: 0.14, decay: 0.25 },
    ],
    attackNoise: { level: -30, decay: 0.005, tone: 5200, q: 0.5 },
  },
  // organ — drawbar-ish sustain (osc voice): triangle for soft odd harmonics,
  // gate envelope (organs are binary — no velocity, no decay), slight unison
  // warmth. The rotary swirl is the instrument's chorus chain, not the patch.
  organ: { voice: 'osc', wave: 'triangle', attack: 0.006, decay: 0.02, sustain: 1, release: 0.08, volume: -16, unison: 2, detune: 4, filter: { mode: 'lowpass', freq: 4200, q: 0.5 } },
  // steelpan — tuned struck metal (MODAL voice, B6.2). Panmakers tune the octave
  // (2×) and twelfth (3×) into each note, so the low modes are near-harmonic and
  // ring long; the bright, slightly-inharmonic upper modes give the metallic
  // shimmer and die fast — the ping-then-warm signature. attackNoise = mallet tick.
  steelpan: {
    voice: 'modal', attack: 0.002, volume: -9,
    partials: [
      { ratio: 1, gain: 1.0, decay: 1.3 },
      { ratio: 2, gain: 0.55, decay: 1.0 },
      { ratio: 3, gain: 0.32, decay: 0.7 },
      { ratio: 4, gain: 0.18, decay: 0.45 },
      { ratio: 5.4, gain: 0.12, decay: 0.26 },
      { ratio: 6.9, gain: 0.08, decay: 0.17 },
    ],
    attackNoise: { level: -20, decay: 0.008, tone: 4500, q: 0.5 },
  },
};

// The pre-fidelity shelf, in shelf order: what a page embeds when its recipe
// references none of the names added below (so such a page is byte-identical).
export const LEGACY_PATCH_NAMES = Object.freeze(Object.keys(PATCHES));

// grand piano (audio fidelity) — piano on the tuned string: exact
// fractional-delay tuning (the old loop runs up to +38 cents sharp in the
// treble), ring time in seconds by register (long bass, short treble — not
// the per-period 1/f law), stiffness = the stretched upper partials that
// separate a piano from a harp, exponential release. New name, not a piano
// edit: rows that say `piano` re-synthesize byte-identical.
Object.assign(PATCHES, {
  pianoGrand: { voice: 'string', pluckDamping: 0.55, pick: 0.3, pluckDetune: 2.5, tune: 'exact', ringT60: [9, 1.4], stiffness: 0.5, curve: 'exp', attack: 0.004, decay: 0.05, sustain: 1, release: 0.3, volume: -12, filter: { mode: 'lowpass', freq: 3400, q: 0.7 }, velToFilter: 1.6, attackNoise: { level: -20, decay: 0.014, tone: 320, q: 0.7 } },
});

// ── drum kit (audio fidelity) — layered pieces at fixed pitch (`pitch`, Hz:
// the piece ignores the note), exponential envelopes, per-hit noise (`vary`).
// kick2 = swept sine body + a 3 ms click; snare2 = a ~185 Hz membrane body +
// band-noise wires; toms = pitched membranes; the hats, ride and crash are the
// 808's six square partials at inharmonic ratios through a highpass (modal
// voice + `filter`) with noise sizzle. `drumKit` maps GM drum notes to pieces.
const SQ808 = [1, 1.4827, 1.8003, 2.546, 2.6303, 3.8967];
const cluster = (gain, decay) => SQ808.map((ratio, i) => ({ ratio, gain, decay: decay * (1 - i * 0.05), wave: 'square' }));
Object.assign(PATCHES, {
  kick2: { voice: 'membrane', pitch: 48, octaves: 3.4, pitchDecay: 0.055, attack: 0.001, decay: 0.42, sustain: 0, release: 0.06, curve: 'exp', volume: -7, vary: true, attackNoise: { mode: 'highpass', tone: 1800, q: 0.7, level: -14, decay: 0.003 } },
  snare2: { voice: 'membrane', pitch: 185, octaves: 1, pitchDecay: 0.03, attack: 0.001, decay: 0.12, sustain: 0, release: 0.05, curve: 'exp', volume: -13, vary: true, attackNoise: { mode: 'bandpass', tone: 3400, q: 0.45, level: -15, decay: 0.19 } },
  tomLo: { voice: 'membrane', pitch: 98, octaves: 1.2, pitchDecay: 0.09, attack: 0.001, decay: 0.5, sustain: 0, release: 0.08, curve: 'exp', volume: -10, vary: true, attackNoise: { tone: 1800, q: 0.7, level: -28, decay: 0.006 } },
  tomMid: { voice: 'membrane', pitch: 138, octaves: 1.2, pitchDecay: 0.08, attack: 0.001, decay: 0.42, sustain: 0, release: 0.07, curve: 'exp', volume: -10, vary: true, attackNoise: { tone: 2200, q: 0.7, level: -28, decay: 0.006 } },
  tomHi: { voice: 'membrane', pitch: 196, octaves: 1.2, pitchDecay: 0.07, attack: 0.001, decay: 0.36, sustain: 0, release: 0.06, curve: 'exp', volume: -10, vary: true, attackNoise: { tone: 2600, q: 0.7, level: -28, decay: 0.006 } },
  hat808: { voice: 'modal', pitch: 205.3, attack: 0.001, volume: -13, partials: cluster(0.6, 0.07), filter: { mode: 'highpass', freq: 7000, q: 0.7 }, vary: true, attackNoise: { mode: 'highpass', tone: 9000, q: 0.7, level: -24, decay: 0.03 } },
  hatOpen: { voice: 'modal', pitch: 205.3, attack: 0.001, volume: -19, partials: cluster(0.6, 0.42), filter: { mode: 'highpass', freq: 6500, q: 0.7 }, vary: true, attackNoise: { mode: 'highpass', tone: 8000, q: 0.7, level: -30, decay: 0.3 } },
  ride: { voice: 'modal', pitch: 410, attack: 0.001, volume: -21, partials: [...cluster(0.35, 1.5), { ratio: 5.3, gain: 0.5, decay: 0.9 }], filter: { mode: 'highpass', freq: 3200, q: 0.7 }, vary: true, attackNoise: { mode: 'highpass', tone: 7000, q: 0.7, level: -34, decay: 0.05 } },
  crash: { voice: 'modal', pitch: 330, attack: 0.001, volume: -27, partials: cluster(0.45, 2.2), filter: { mode: 'highpass', freq: 3000, q: 0.7 }, vary: true, attackNoise: { mode: 'highpass', tone: 5000, q: 0.5, level: -18, decay: 1.6 } },
  // GM drum map (MIDI note → piece): 35/36 kick, 37/38/40 snare, 42/44 closed
  // hat, 46 open hat, 41/43 low tom, 45/47 mid tom, 48/50 high tom, 49/57
  // crash, 51/53/59 ride. In this kernel's naming (C4 = 60): C2 kick, D2 snare,
  // F#2 closed hat, A#2 open hat, F2/A2/C3 toms, C#3 crash, D#3 ride.
  drumKit: { kit: { 35: 'kick2', 36: 'kick2', 37: 'snare2', 38: 'snare2', 40: 'snare2', 42: 'hat808', 44: 'hat808', 46: 'hatOpen', 41: 'tomLo', 43: 'tomLo', 45: 'tomMid', 47: 'tomMid', 48: 'tomHi', 50: 'tomHi', 49: 'crash', 57: 'crash', 51: 'ride', 53: 'ride', 59: 'ride' } },
});

// Section v2 (audio fidelity): the bowed and brass patches with the expression
// opt-ins on — per-voice de-locked vibrato (spread), a slow pitch drift, bow or
// breath air under the note, brightness that follows register (keyTrack) and,
// for brass, velocity (velToFilter now reaches the filterEnv sweep), and an
// exponential release. New names; the originals re-synthesize byte-identical.
const BOWED_V2 = { drift: 4, keyTrack: 0.4, curve: 'exp', width: 0.5 };
const BRASS_V2 = { drift: 3, keyTrack: 0.5, velToFilter: 1.3, curve: 'exp' };
for (const [name, base, extra] of [
  ['violin2', 'violin', { ...BOWED_V2, breath: { level: -30, tone: 2800, q: 0.8 } }],
  ['viola2', 'viola', { ...BOWED_V2, breath: { level: -30, tone: 2300, q: 0.8 } }],
  ['cello2', 'cello', { ...BOWED_V2, breath: { level: -31, tone: 1700, q: 0.8 } }],
  ['contrabass2', 'contrabass', { ...BOWED_V2, breath: { level: -32, tone: 1100, q: 0.8 } }],
  ['trumpet2', 'trumpet', { ...BRASS_V2, breath: { level: -34, tone: 1600, q: 0.7 } }],
  ['frenchHorn2', 'frenchHorn', { ...BRASS_V2, breath: { level: -36, tone: 900, q: 0.7 } }],
  ['trombone2', 'trombone', { ...BRASS_V2, breath: { level: -35, tone: 1100, q: 0.7 } }],
  ['tuba2', 'tuba', { ...BRASS_V2, breath: { level: -36, tone: 600, q: 0.7 } }],
]) PATCHES[name] = { ...PATCHES[base], ...extra, vibrato: { ...PATCHES[base].vibrato, spread: 1 } };

export function getPatch(name, overrides) {
  const base = PATCHES[name];
  if (!base) {
    throw new Error(`beats: unknown patch '${name}'. Known patches: ${Object.keys(PATCHES).join(', ')}.`);
  }
  return overrides && typeof overrides === 'object' ? { ...base, ...overrides } : { ...base };
}
