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

// Section v3 (audio improvements): the v2 patches with an onset — the bow's
// scrape before the Helmholtz motion settles, the lips' buzz before the bell
// speaks — and, for strings, the lowpass opened so the body's bridge hill
// (in the `-3` instruments' chains) has partials to lift. Brass scoops into
// pitch from a few cents flat. `volume` is level-matched to v2 by measured
// RMS through the v3 chains. New names; v2 is unchanged.
for (const [name, base, extra] of [
  ['violin3', 'violin2', { volume: -20, filter: { mode: 'lowpass', freq: 6800, q: 0.5 }, attackNoise: { level: -24, decay: 0.06, tone: 3400, q: 0.9 } }],
  ['viola3', 'viola2', { volume: -18.5, filter: { mode: 'lowpass', freq: 5200, q: 0.5 }, attackNoise: { level: -24, decay: 0.065, tone: 2800, q: 0.9 } }],
  ['cello3', 'cello2', { volume: -18, filter: { mode: 'lowpass', freq: 4200, q: 0.5 }, attackNoise: { level: -25, decay: 0.07, tone: 2000, q: 0.9 } }],
  ['contrabass3', 'contrabass2', { volume: -16, filter: { mode: 'lowpass', freq: 2400, q: 0.5 }, attackNoise: { level: -27, decay: 0.08, tone: 1200, q: 0.9 } }],
  ['trumpet3', 'trumpet2', { volume: -19, bend: [0.988, 1, 0, 0.035], attackNoise: { level: -30, decay: 0.025, tone: 1500, q: 0.8 } }],
  ['frenchHorn3', 'frenchHorn2', { volume: -18, bend: [0.985, 1, 0, 0.05], attackNoise: { level: -33, decay: 0.03, tone: 700, q: 0.8 } }],
  ['trombone3', 'trombone2', { volume: -18, bend: [0.985, 1, 0, 0.04], attackNoise: { level: -31, decay: 0.03, tone: 900, q: 0.8 } }],
  ['tuba3', 'tuba2', { volume: -14.5, bend: [0.985, 1, 0, 0.05], attackNoise: { level: -33, decay: 0.035, tone: 450, q: 0.8 } }],
]) PATCHES[name] = { ...PATCHES[base], ...extra };

// ── the orchestra shelf (orchestra and era) ────────────────────────────────
// Woodwinds are osc voices over computed `harmonics` (sine amplitudes 1..N):
// the flute a near-sine with breath and chiff, the clarinet an odd series
// whose brightness follows register (keyTrack), the oboe and bassoon narrow
// pulses (|sin(πkd)|/k) voiced by a formant `body` in their instruments.
// Mallets and timpani are modal (published mode ratios); the harp is the
// tuned string. `-2` woodwinds are small ensembles (players, de-locked
// vibrato, drift). All new names: nothing existing moves.
const round3 = (x) => Math.round(x * 1000) / 1000;
const pulse = (d, n) => Array.from({ length: n }, (_, i) => round3(Math.abs(Math.sin(Math.PI * (i + 1) * d)) / (i + 1) / Math.sin(Math.PI * d)));
const REED = { drift: 2, curve: 'exp', keyTrack: 0.4 };
Object.assign(PATCHES, {
  flute: { voice: 'osc', harmonics: [1, 0.12, 0.05, 0.02, 0.01], attack: 0.06, decay: 0.12, sustain: 0.88, release: 0.22, volume: -15, curve: 'exp', vibrato: { rate: 5.2, depth: 11, delay: 0.35 }, breath: { level: -26, tone: 2600, q: 0.9 }, attackNoise: { level: -22, decay: 0.03, tone: 3200, q: 0.8 }, filter: { mode: 'lowpass', freq: 5200, q: 0.5 }, keyTrack: 0.3 },
  clarinet: { voice: 'osc', harmonics: [1, 0.03, 0.62, 0.03, 0.38, 0.02, 0.24, 0.02, 0.14, 0.01, 0.08, 0.01, 0.05], attack: 0.035, decay: 0.1, sustain: 0.9, release: 0.16, volume: -15, ...REED, keyTrack: 0.6, breath: { level: -34, tone: 1800, q: 0.8 }, filter: { mode: 'lowpass', freq: 2600, q: 0.6 } },
  oboe: { voice: 'osc', harmonics: pulse(0.14, 16), attack: 0.03, decay: 0.08, sustain: 0.9, release: 0.14, volume: -19, ...REED, vibrato: { rate: 5.4, depth: 9, delay: 0.3 }, breath: { level: -36, tone: 2200, q: 0.8 }, filter: { mode: 'lowpass', freq: 4600, q: 0.7 } },
  bassoon: { voice: 'osc', harmonics: pulse(0.2, 14), attack: 0.04, decay: 0.1, sustain: 0.88, release: 0.18, volume: -15, ...REED, vibrato: { rate: 4.8, depth: 7, delay: 0.4 }, breath: { level: -36, tone: 900, q: 0.8 }, filter: { mode: 'lowpass', freq: 1900, q: 0.8 } },
  // concert harp: a tuned string, soft finger (pick), long bass ring, rings on after the note.
  harp: { voice: 'string', tune: 'exact', ringT60: [7, 1.3], pluckDamping: 0.62, pick: 0.55, attack: 0.003, decay: 0.05, sustain: 1, release: 1.4, curve: 'exp', volume: -12, filter: { mode: 'lowpass', freq: 3600, q: 0.6 }, velToFilter: 1 },
  // free bar 1 : 2.76 : 5.40 : 8.93 (the glockenspiel's steel).
  glockenspiel: { voice: 'modal', attack: 0.001, volume: -15, decayTrack: 0.4, partials: [{ ratio: 1, gain: 1, decay: 2.4 }, { ratio: 2.76, gain: 0.34, decay: 0.8 }, { ratio: 5.4, gain: 0.16, decay: 0.32 }, { ratio: 8.93, gain: 0.07, decay: 0.12 }], attackNoise: { level: -26, decay: 0.004, tone: 6000, q: 0.6 } },
  // rosewood bars tuned 1 : 3 (xylophone) and 1 : 4 (marimba); the resonator
  // tube is the long, strong fundamental.
  xylophone: { voice: 'modal', attack: 0.001, volume: -12, decayTrack: 0.5, partials: [{ ratio: 1, gain: 1, decay: 0.5 }, { ratio: 3, gain: 0.42, decay: 0.2 }, { ratio: 6.1, gain: 0.14, decay: 0.08 }, { ratio: 9.8, gain: 0.06, decay: 0.04 }], attackNoise: { level: -18, decay: 0.006, tone: 3000, q: 0.6 } },
  marimba: { voice: 'modal', attack: 0.002, volume: -10, decayTrack: 0.5, partials: [{ ratio: 1, gain: 1, decay: 1.3 }, { ratio: 3.93, gain: 0.26, decay: 0.3 }, { ratio: 9.2, gain: 0.06, decay: 0.09 }], attackNoise: { level: -28, decay: 0.008, tone: 1400, q: 0.6 } },
  // aluminium bars 1 : 4 : 10 and the motor's amplitude tremolo.
  vibraphone: { voice: 'modal', attack: 0.002, volume: -13, decayTrack: 0.3, partials: [{ ratio: 1, gain: 1, decay: 3.6 }, { ratio: 4, gain: 0.24, decay: 1 }, { ratio: 10, gain: 0.05, decay: 0.3 }], tremolo: { rate: 5.5, depth: 0.4 }, attackNoise: { level: -30, decay: 0.006, tone: 2600, q: 0.6 } },
  // tubular bells: free-bar modes ∝ (2n+1)², placed so modes 4–6 sit at 2 : 3 : 4
  // over the written note — the elevated strike note the ear hears.
  tubularBells: { voice: 'modal', attack: 0.001, volume: -16, partials: [{ ratio: 0.224, gain: 0.2, decay: 2.5 }, { ratio: 0.617, gain: 0.35, decay: 3.2 }, { ratio: 1.21, gain: 0.5, decay: 4 }, { ratio: 2, gain: 1, decay: 5 }, { ratio: 2.99, gain: 0.8, decay: 4 }, { ratio: 4.17, gain: 0.55, decay: 3 }, { ratio: 5.5, gain: 0.3, decay: 1.6 }], attackNoise: { level: -24, decay: 0.01, tone: 2400, q: 0.6 } },
  // timpani: the air-loaded membrane (1 : 1.5 : 1.99 : 2.44 : 2.98 over the
  // principal mode), a felt mallet, and `pedal` — a gliding row bends every mode.
  timpani: { voice: 'modal', attack: 0.003, volume: -9, pedal: true, partials: [{ ratio: 0.6, gain: 0.35, decay: 0.35 }, { ratio: 1, gain: 1, decay: 2.4 }, { ratio: 1.5, gain: 0.5, decay: 1.5 }, { ratio: 1.99, gain: 0.34, decay: 1.1 }, { ratio: 2.44, gain: 0.2, decay: 0.75 }, { ratio: 2.98, gain: 0.12, decay: 0.5 }], attackNoise: { level: -20, decay: 0.025, tone: 380, q: 0.7 } },
});
const WIND_V2 = { unison: 2, detune: 7, drift: 4, width: 0.4 };
for (const name of ['flute', 'clarinet', 'oboe', 'bassoon']) {
  const base = PATCHES[name];
  PATCHES[name + '2'] = { ...base, ...WIND_V2, vibrato: { rate: 5, depth: 9, delay: 0.3, ...base.vibrato, spread: 1 } };
}

// ── percussion: circuits and hands (orchestra and era) ─────────────────────
// Descriptive ids (the machines they recall are named only in card prose).
// Every piece is a formula: drum-machine voices modeled from their circuits,
// hand drums as bent membranes, orchestral percussion as modal and
// noise-excited mode banks (`excite: 'noise'`; `rise` per mode = the tam-tam's
// bloom), claps as seeded burst trains (`claps`), `velMap` for timbre that
// follows the hit. Kits map GM drum notes (C4 = 60 naming: C2 kick, D2 snare,
// F#2 closed hat) and carry `chokes` (GM note → group; normalize copies them to
// the row as `choke`, so an open hat is cut by the next closed hat).
const DENSE = [1, 1.4827, 1.8003, 2.546, 2.6303, 3.8967, 4.61, 5.53, 6.92, 8.21];
const bank = (ratios, gain0, decay0, rise) => ratios.map((ratio, i) => ({ ratio, gain: round3(gain0 * Math.pow(0.86, i)), decay: round3(decay0 * (1 - i * 0.06)), ...(rise ? { rise } : {}) }));
const tom = (pitch, extra) => ({ voice: 'membrane', pitch, octaves: 1.1, pitchDecay: 0.2, attack: 0.001, decay: 0.7, sustain: 0, release: 0.08, curve: 'exp', volume: -9, ...extra });
Object.assign(PATCHES, {
  // the analog machine: a bridged-T boom, two-mode snare + snappy, a burst-train clap.
  kickBoom: { voice: 'membrane', pitch: 49, octaves: 3.2, pitchDecay: 0.04, attack: 0.001, decay: 1.1, sustain: 0, release: 0.1, curve: 'exp', volume: -6 },
  snareAnalog: { voice: 'modal', pitch: 238, attack: 0.001, volume: -12, vary: true, partials: [{ ratio: 1, gain: 1, decay: 0.14 }, { ratio: 2, gain: 0.55, decay: 0.09 }], attackNoise: { mode: 'highpass', tone: 4500, q: 0.7, level: -11, decay: 0.16 } },
  clapAnalog: { voice: 'noise', claps: 4, clapGap: 0.0105, attack: 0.001, decay: 0.2, sustain: 0, release: 0.05, curve: 'exp', volume: -9, vary: true, filter: { mode: 'bandpass', freq: 1150, q: 1.1 } },
  cowbellAnalog: { voice: 'modal', pitch: 540, attack: 0.001, volume: -12, partials: [{ ratio: 1, gain: 1, decay: 0.32, wave: 'square' }, { ratio: 1.4815, gain: 0.8, decay: 0.28, wave: 'square' }], filter: { mode: 'bandpass', freq: 1000, q: 0.8 } },
  rimAnalog: { voice: 'modal', pitch: 455, attack: 0.001, volume: -12, partials: [{ ratio: 1, gain: 1, decay: 0.03 }, { ratio: 3.66, gain: 0.7, decay: 0.022 }], attackNoise: { mode: 'highpass', tone: 3000, q: 0.7, level: -18, decay: 0.004 } },
  clavesAnalog: { voice: 'modal', pitch: 2500, attack: 0.001, volume: -14, partials: [{ ratio: 1, gain: 1, decay: 0.07 }, { ratio: 1.6, gain: 0.15, decay: 0.03 }] },
  tomBoomLo: tom(88), tomBoomMid: tom(120), tomBoomHi: tom(165),
  hatBright: { voice: 'modal', pitch: 262, attack: 0.001, volume: -14, partials: cluster(0.6, 0.05), filter: { mode: 'highpass', freq: 8200, q: 0.7 }, vary: true, attackNoise: { mode: 'highpass', tone: 10000, q: 0.7, level: -22, decay: 0.025 } },
  hatBrightOpen: { voice: 'modal', pitch: 262, attack: 0.001, volume: -19, partials: cluster(0.6, 0.36), filter: { mode: 'highpass', freq: 7800, q: 0.7 }, vary: true, attackNoise: { mode: 'highpass', tone: 9000, q: 0.7, level: -28, decay: 0.26 } },
  // the punch machine: sine + click through its own drive, a brighter snare, noise hats.
  kickPunch: { voice: 'membrane', pitch: 54, octaves: 3.2, pitchDecay: 0.028, attack: 0.001, decay: 0.5, sustain: 0, release: 0.06, curve: 'exp', volume: -7, drive: 0.35, vary: true, attackNoise: { mode: 'highpass', tone: 2800, q: 0.7, level: -12, decay: 0.004 } },
  snarePunch: { voice: 'membrane', pitch: 195, octaves: 1.3, pitchDecay: 0.02, attack: 0.001, decay: 0.1, sustain: 0, release: 0.05, curve: 'exp', volume: -13, vary: true, attackNoise: { mode: 'bandpass', tone: 5200, q: 0.45, level: -10, decay: 0.2 } },
  clapPunch: { voice: 'noise', claps: 3, clapGap: 0.009, attack: 0.001, decay: 0.26, sustain: 0, release: 0.05, curve: 'exp', volume: -9, vary: true, filter: { mode: 'bandpass', freq: 1500, q: 0.9 } },
  hatPunch: { voice: 'noise', attack: 0.001, decay: 0.05, sustain: 0, release: 0.02, curve: 'exp', volume: -19, vary: true, filter: { mode: 'highpass', freq: 9000, q: 0.7 }, attackNoise: { mode: 'bandpass', tone: 12000, q: 1, level: -24, decay: 0.03 } },
  hatPunchOpen: { voice: 'noise', attack: 0.001, decay: 0.42, sustain: 0, release: 0.05, curve: 'exp', volume: -22, vary: true, filter: { mode: 'highpass', freq: 8500, q: 0.7 }, attackNoise: { mode: 'bandpass', tone: 12000, q: 1, level: -26, decay: 0.05 } },
  tomPunchLo: tom(95, { octaves: 1.4, pitchDecay: 0.09, decay: 0.45, vary: true, attackNoise: { tone: 1500, q: 0.7, level: -24, decay: 0.05 } }),
  tomPunchMid: tom(130, { octaves: 1.4, pitchDecay: 0.09, decay: 0.42, vary: true, attackNoise: { tone: 1800, q: 0.7, level: -24, decay: 0.05 } }),
  tomPunchHi: tom(180, { octaves: 1.4, pitchDecay: 0.08, decay: 0.38, vary: true, attackNoise: { tone: 2200, q: 0.7, level: -24, decay: 0.05 } }),
  // the acoustic kit: the fidelity pieces with velocity → timbre.
  kickAcoustic: { ...PATCHES.kick2, velMap: { 'attackNoise.level': [-26, -9], pitchDecay: [0.07, 0.045], decay: [0.32, 0.46] } },
  snareAcoustic: { ...PATCHES.snare2, velMap: { 'attackNoise.level': [-24, -11], 'attackNoise.tone': [2400, 4600], decay: [0.09, 0.14] } },
  hatAcoustic: { ...PATCHES.hat808, velMap: { 'attackNoise.level': [-32, -20], 'filter.freq': [8200, 6200] } },
  hatAcousticOpen: { ...PATCHES.hatOpen, velMap: { 'attackNoise.level': [-36, -26] } },
  tomAcousticLo: { ...PATCHES.tomLo, velMap: { pitchDecay: [0.12, 0.07], 'attackNoise.level': [-36, -22] } },
  tomAcousticMid: { ...PATCHES.tomMid, velMap: { pitchDecay: [0.11, 0.065], 'attackNoise.level': [-36, -22] } },
  tomAcousticHi: { ...PATCHES.tomHi, velMap: { pitchDecay: [0.1, 0.06], 'attackNoise.level': [-36, -22] } },
  crashAcoustic: { ...PATCHES.crash, velMap: { 'attackNoise.level': [-26, -15], 'filter.freq': [4000, 2600] } },
  rideAcoustic: { ...PATCHES.ride, velMap: { 'attackNoise.level': [-40, -30] } },
  // hands: bent membranes (open / muted / slap strokes as GM notes), noise
  // shakers, a jingle bank, burst-train scrapes.
  congaOpen: { voice: 'membrane', pitch: 330, octaves: 0.5, pitchDecay: 0.03, attack: 0.001, decay: 0.38, sustain: 0, release: 0.06, curve: 'exp', volume: -10, vary: true, attackNoise: { tone: 1800, q: 0.7, level: -26, decay: 0.008 } },
  congaMute: { voice: 'membrane', pitch: 330, octaves: 0.5, pitchDecay: 0.03, attack: 0.001, decay: 0.08, sustain: 0, release: 0.04, curve: 'exp', volume: -10, vary: true, filter: { mode: 'lowpass', freq: 1100, q: 0.7 }, attackNoise: { tone: 1500, q: 0.7, level: -24, decay: 0.006 } },
  congaSlap: { voice: 'membrane', pitch: 360, octaves: 0.5, pitchDecay: 0.02, attack: 0.001, decay: 0.12, sustain: 0, release: 0.04, curve: 'exp', volume: -11, vary: true, attackNoise: { mode: 'highpass', tone: 2500, q: 0.7, level: -8, decay: 0.03 } },
  congaLow: { voice: 'membrane', pitch: 220, octaves: 0.5, pitchDecay: 0.035, attack: 0.001, decay: 0.45, sustain: 0, release: 0.06, curve: 'exp', volume: -9, vary: true, attackNoise: { tone: 1500, q: 0.7, level: -26, decay: 0.008 } },
  bongoHi: { voice: 'membrane', pitch: 480, octaves: 0.6, pitchDecay: 0.02, attack: 0.001, decay: 0.18, sustain: 0, release: 0.04, curve: 'exp', volume: -12, vary: true, attackNoise: { tone: 2600, q: 0.7, level: -24, decay: 0.006 } },
  bongoLo: { voice: 'membrane', pitch: 360, octaves: 0.6, pitchDecay: 0.025, attack: 0.001, decay: 0.22, sustain: 0, release: 0.04, curve: 'exp', volume: -12, vary: true, attackNoise: { tone: 2200, q: 0.7, level: -24, decay: 0.006 } },
  shaker: { voice: 'noise', attack: 0.018, decay: 0.06, sustain: 0, release: 0.03, volume: -20, vary: true, filter: { mode: 'bandpass', freq: 6200, q: 1.3 } },
  tambourine: { voice: 'modal', excite: 'noise', q: 14, pitch: 5200, attack: 0.001, volume: -24, vary: true, partials: [{ ratio: 1, gain: 1, decay: 0.25 }, { ratio: 1.31, gain: 0.8, decay: 0.22 }, { ratio: 1.62, gain: 0.6, decay: 0.18 }, { ratio: 2.05, gain: 0.4, decay: 0.14 }], attackNoise: { mode: 'highpass', tone: 7000, q: 0.7, level: -20, decay: 0.02 } },
  cabasa: { voice: 'noise', claps: 6, clapGap: 0.006, attack: 0.002, decay: 0.08, sustain: 0, release: 0.03, volume: -20, vary: true, filter: { mode: 'highpass', freq: 5000, q: 0.7 } },
  guiroShort: { voice: 'noise', claps: 8, clapGap: 0.014, attack: 0.002, decay: 0.15, sustain: 0, release: 0.03, volume: -16, vary: true, filter: { mode: 'bandpass', freq: 2600, q: 1.5 } },
  guiroLong: { voice: 'noise', claps: 16, clapGap: 0.018, attack: 0.002, decay: 0.32, sustain: 0, release: 0.04, volume: -16, vary: true, filter: { mode: 'bandpass', freq: 2600, q: 1.5 } },
  // the orchestral section: a concert bass drum, a wire snare (roll it with
  // art 'roll'), noise-excited suspended cymbal and a tam-tam that blooms.
  bassDrumConcert: { voice: 'membrane', pitch: 42, octaves: 0.5, pitchDecay: 0.08, attack: 0.004, decay: 2.6, sustain: 0, release: 0.3, curve: 'exp', volume: -6, attackNoise: { mode: 'lowpass', tone: 300, q: 0.7, level: -20, decay: 0.06 } },
  snareConcert: { voice: 'membrane', pitch: 210, octaves: 0.8, pitchDecay: 0.02, attack: 0.001, decay: 0.09, sustain: 0, release: 0.05, curve: 'exp', volume: -14, vary: true, attackNoise: { mode: 'bandpass', tone: 4200, q: 0.5, level: -12, decay: 0.24 }, velMap: { 'attackNoise.level': [-22, -10] } },
  susCymbal: { voice: 'modal', excite: 'noise', q: 12, pitch: 420, attack: 0.003, volume: -22, vary: true, partials: bank(DENSE, 1, 3.6), filter: { mode: 'highpass', freq: 1800, q: 0.7 } },
  tamTam: { voice: 'modal', excite: 'noise', q: 25, pitch: 70, attack: 0.01, volume: -10, vary: true, partials: [[1, 1, 6, 0.05], [1.52, 0.7, 5.5, 0.3], [2.3, 0.6, 5, 0.6], [3.1, 0.55, 4.5, 0.9], [4.4, 0.5, 4, 1.2], [5.9, 0.45, 3.6, 1.4], [7.7, 0.4, 3, 1.6], [10.3, 0.3, 2.5, 1.5], [13.6, 0.2, 2, 1.2]].map(([ratio, gain, decay, rise]) => ({ ratio, gain, decay, rise })), attackNoise: { tone: 200, q: 0.7, level: -18, decay: 0.05 } },
  triangle: { voice: 'modal', pitch: 1480, attack: 0.001, volume: -20, partials: [{ ratio: 1, gain: 1, decay: 3 }, { ratio: 2.72, gain: 0.6, decay: 2 }, { ratio: 5.08, gain: 0.4, decay: 1.4 }, { ratio: 8.3, gain: 0.25, decay: 1 }] },
  // crotales: small tuned discs — pitched (a melodic row), a long pure ring.
  crotales: { voice: 'modal', attack: 0.001, volume: -16, decayTrack: 0.3, partials: [{ ratio: 1, gain: 1, decay: 5 }, { ratio: 2.76, gain: 0.3, decay: 2 }, { ratio: 5.4, gain: 0.12, decay: 0.8 }], attackNoise: { level: -28, decay: 0.004, tone: 7000, q: 0.6 } },
  // the arena kit: close pieces for a big shared room (the instrument's chain).
  kickArena: { voice: 'membrane', pitch: 58, octaves: 1.8, pitchDecay: 0.035, attack: 0.001, decay: 0.55, sustain: 0, release: 0.08, curve: 'exp', volume: -6, vary: true, attackNoise: { mode: 'bandpass', tone: 4000, q: 1, level: -16, decay: 0.006 }, velMap: { 'attackNoise.level': [-26, -9], 'attackNoise.tone': [3000, 5000] } },
  snareArena: { voice: 'modal', pitch: 200, attack: 0.001, volume: -9, vary: true, partials: [{ ratio: 1, gain: 1, decay: 0.2 }, { ratio: 1.6, gain: 0.55, decay: 0.14 }, { ratio: 2.3, gain: 0.35, decay: 0.09 }], attackNoise: { mode: 'bandpass', tone: 3800, q: 0.5, level: -8, decay: 0.3 }, velMap: { 'attackNoise.level': [-18, -6], 'attackNoise.tone': [2800, 4800] } },
  snareArenaRim: { voice: 'modal', pitch: 200, attack: 0.001, volume: -10, vary: true, partials: [{ ratio: 1, gain: 1, decay: 0.2 }, { ratio: 1.6, gain: 0.55, decay: 0.14 }, { ratio: 2.3, gain: 0.35, decay: 0.09 }, { ratio: 3.9, gain: 0.8, decay: 0.05 }, { ratio: 6.1, gain: 0.5, decay: 0.03 }], attackNoise: { mode: 'bandpass', tone: 4200, q: 0.5, level: -7, decay: 0.3 }, velMap: { 'attackNoise.level': [-16, -5] } },
  tomArenaFloor: tom(82.4, { octaves: 0.62, pitchDecay: 0.14, decay: 1, volume: -8, vary: true, attackNoise: { tone: 2400, q: 0.7, level: -24, decay: 0.01 } }),
  tomArenaLo: tom(110, { octaves: 0.62, pitchDecay: 0.14, decay: 0.95, volume: -8, vary: true, attackNoise: { tone: 2400, q: 0.7, level: -24, decay: 0.01 } }),
  tomArenaMid: tom(146.8, { octaves: 0.62, pitchDecay: 0.13, decay: 0.9, volume: -8, vary: true, attackNoise: { tone: 2600, q: 0.7, level: -24, decay: 0.01 } }),
  tomArenaHi: tom(196, { octaves: 0.62, pitchDecay: 0.12, decay: 0.85, volume: -8, vary: true, attackNoise: { tone: 2800, q: 0.7, level: -24, decay: 0.01 } }),
  crashArena: { voice: 'modal', excite: 'noise', q: 10, pitch: 380, attack: 0.002, volume: -20, vary: true, partials: bank(DENSE, 1, 3, 0.02), filter: { mode: 'highpass', freq: 2200, q: 0.7 }, attackNoise: { mode: 'highpass', tone: 5000, q: 0.5, level: -16, decay: 0.8 } },
  chinaArena: { voice: 'modal', excite: 'noise', q: 8, pitch: 520, attack: 0.002, volume: -20, vary: true, partials: bank([1, 1.31, 1.73, 2.19, 2.77, 3.42, 4.1, 5.2], 1, 2), filter: { mode: 'highpass', freq: 1500, q: 0.7 }, attackNoise: { mode: 'highpass', tone: 4000, q: 0.5, level: -14, decay: 0.5 } },
  rideBellArena: { voice: 'modal', pitch: 820, attack: 0.001, volume: -20, vary: true, partials: [{ ratio: 1, gain: 1, decay: 2 }, { ratio: 2.1, gain: 0.6, decay: 1.4 }, { ratio: 3.3, gain: 0.4, decay: 0.9 }, { ratio: 4.6, gain: 0.25, decay: 0.6 }], attackNoise: { mode: 'highpass', tone: 6000, q: 0.7, level: -30, decay: 0.03 } },
});
const HATS = { 42: 'hat', 44: 'hat', 46: 'hat' };
Object.assign(PATCHES, {
  drumMachine88: { kit: { 35: 'kickBoom', 36: 'kickBoom', 37: 'rimAnalog', 38: 'snareAnalog', 40: 'snareAnalog', 39: 'clapAnalog', 42: 'hat808', 44: 'hat808', 46: 'hatOpen', 41: 'tomBoomLo', 43: 'tomBoomLo', 45: 'tomBoomMid', 47: 'tomBoomMid', 48: 'tomBoomHi', 50: 'tomBoomHi', 49: 'crash', 56: 'cowbellAnalog', 75: 'clavesAnalog', 70: 'shaker' }, chokes: HATS },
  drumMachine909: { kit: { 35: 'kickPunch', 36: 'kickPunch', 37: 'rimAnalog', 38: 'snarePunch', 40: 'snarePunch', 39: 'clapPunch', 42: 'hatPunch', 44: 'hatPunch', 46: 'hatPunchOpen', 41: 'tomPunchLo', 43: 'tomPunchLo', 45: 'tomPunchMid', 47: 'tomPunchMid', 48: 'tomPunchHi', 50: 'tomPunchHi', 49: 'crash', 51: 'ride', 56: 'cowbellAnalog' }, chokes: HATS },
  drumMachineBright: { kit: { 35: 'kickBoom', 36: 'kickBoom', 38: 'snareAnalog', 39: 'clapAnalog', 42: 'hatBright', 44: 'hatBright', 46: 'hatBrightOpen', 41: 'tomBoomLo', 45: 'tomBoomMid', 48: 'tomBoomHi', 49: 'crash' }, chokes: HATS },
  acousticKit: { kit: { 35: 'kickAcoustic', 36: 'kickAcoustic', 37: 'snareAcoustic', 38: 'snareAcoustic', 40: 'snareAcoustic', 42: 'hatAcoustic', 44: 'hatAcoustic', 46: 'hatAcousticOpen', 41: 'tomAcousticLo', 43: 'tomAcousticLo', 45: 'tomAcousticMid', 47: 'tomAcousticMid', 48: 'tomAcousticHi', 50: 'tomAcousticHi', 49: 'crashAcoustic', 57: 'crashAcoustic', 51: 'rideAcoustic', 53: 'rideAcoustic', 59: 'rideAcoustic' }, chokes: HATS },
  latinPerc: { kit: { 60: 'bongoHi', 61: 'bongoLo', 62: 'congaMute', 63: 'congaOpen', 64: 'congaLow', 65: 'congaSlap', 54: 'tambourine', 56: 'cowbellAnalog', 69: 'cabasa', 70: 'shaker', 82: 'shaker', 73: 'guiroShort', 74: 'guiroLong', 75: 'clavesAnalog' } },
  orchestralPerc: { kit: { 35: 'bassDrumConcert', 36: 'bassDrumConcert', 38: 'snareConcert', 40: 'snareConcert', 49: 'susCymbal', 55: 'susCymbal', 52: 'tamTam', 81: 'triangle', 80: 'triangle' } },
  stadiumKit: { kit: { 35: 'kickArena', 36: 'kickArena', 37: 'rimAnalog', 38: 'snareArena', 40: 'snareArenaRim', 41: 'tomArenaFloor', 43: 'tomArenaLo', 45: 'tomArenaLo', 47: 'tomArenaMid', 48: 'tomArenaMid', 50: 'tomArenaHi', 42: 'hat808', 44: 'hat808', 46: 'hatOpen', 49: 'crashArena', 57: 'crashArena', 55: 'crashArena', 52: 'chinaArena', 51: 'ride', 59: 'ride', 53: 'rideBellArena' }, chokes: HATS },
});

// ── the era synths (orchestra and era): virtual analog and 4-op FM ─────────
// Named harmonic tables (a patchParams `table` name lowers to `harmonics` at
// normalize): the rave organ stab's drawbars, a full drawbar organ, two
// digital wavetable frames. Patches reach for `pulse` + PWM, the `supersaw`,
// the 24 dB `slope` (the ladder), `sub`, patch `lfo` slots (a `sync` fraction
// resolves to Hz against the recipe's bpm at normalize), `fm4`.
export const TABLES = {
  organStab: [1, 0.85, 0.9, 0.55, 0, 0.3, 0, 0.42, 0, 0.12],
  organFull: [1, 1, 0.9, 0.9, 0, 0.8, 0, 0.8],
  digitalA: [0.5, 0.3, 0.42, 0.62, 0.9, 1, 0.8, 0.52, 0.3, 0.18, 0.1, 0.05],
  digitalB: [1, 0, 0.6, 0, 0.22, 0, 0.5, 0, 0.4, 0, 0.12],
};
const LADDER = (freq, q, drive) => ({ mode: 'lowpass', slope: 24, freq, q, drive });
Object.assign(PATCHES, {
  // the acid line: a saw into the resonant ladder, a fast sweep; accent and slide ride the pattern.
  acidBass: { voice: 'osc', wave: 'sawtooth', attack: 0.002, decay: 0.25, sustain: 0.35, release: 0.05, volume: -12, filter: LADDER(300, 16, 0.35), filterEnv: { from: 2400, to: 220, decay: 0.2, velAmount: 0.6 }, keyTrack: 0.3 },
  acidSquare: { voice: 'osc', wave: 'square', attack: 0.002, decay: 0.25, sustain: 0.35, release: 0.05, volume: -14, filter: LADDER(300, 16, 0.35), filterEnv: { from: 2400, to: 220, decay: 0.2, velAmount: 0.6 }, keyTrack: 0.3 },
  // the reese: two detuned saws drifting against each other through the ladder, a slow cutoff sway, a sub.
  reeseBass: { voice: 'osc', wave: 'sawtooth', unison: 2, detune: 22, drift: 8, attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.25, volume: -12, width: 0.6, filter: LADDER(900, 4, 0.4), lfo: [{ rate: 0.23, target: 'filter', depth: 500 }], sub: { level: -9, octave: 1 } },
  // the hoover: a PWM pulse stack that dives in from above (its famous attack bend).
  hoover: { voice: 'osc', wave: 'pulse', pw: 0.3, unison: 5, detune: 28, attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.4, volume: -15, width: 0.8, bend: [1.26, 1, 0, 0.14], lfo: [{ rate: 0.8, target: 'pw', depth: 0.18 }], filter: { mode: 'lowpass', freq: 4200, q: 0.7 } },
  // poly strings: a slow pulse ensemble with PWM (the chorus lives in the instrument).
  polyStrings: { voice: 'osc', wave: 'pulse', pw: 0.5, unison: 2, detune: 5, attack: 0.35, decay: 0.3, sustain: 0.85, release: 1.1, volume: -17, width: 0.5, lfo: [{ rate: 0.6, target: 'pw', depth: 0.22 }], filter: { mode: 'lowpass', freq: 3200, q: 0.5 } },
  stringMachine: { voice: 'osc', wave: 'sawtooth', unison: 3, detune: 7, attack: 0.25, decay: 0.3, sustain: 0.9, release: 0.9, volume: -18, width: 0.7, filter: { mode: 'lowpass', freq: 2600, q: 0.5 }, lfo: [{ rate: 5.2, target: 'pitch', depth: 6, delay: 0.3 }] },
  // the supersaw: seven saws on the classic detune curve.
  trancePluck: { voice: 'osc', wave: 'supersaw', supersaw: { detune: 0.35, mix: 0.6 }, attack: 0.001, decay: 0.22, sustain: 0.05, release: 0.2, volume: -16, width: 0.8, filter: { mode: 'lowpass', q: 2 }, filterEnv: { from: 6000, to: 600, decay: 0.18, velAmount: 0.4 } },
  supersawLead: { voice: 'osc', wave: 'supersaw', supersaw: { detune: 0.5, mix: 0.75 }, attack: 0.01, decay: 0.3, sustain: 0.85, release: 0.35, volume: -18, width: 0.9, filter: { mode: 'lowpass', freq: 7000, q: 0.7 }, lfo: [{ rate: 5.5, target: 'pitch', depth: 8, delay: 0.4 }] },
  // the rave stab: the organ table through a swept filter.
  raveStab: { voice: 'osc', harmonics: TABLES.organStab, unison: 2, detune: 8, attack: 0.002, decay: 0.28, sustain: 0.2, release: 0.12, volume: -15, filter: { mode: 'lowpass', q: 1.5 }, filterEnv: { from: 5200, to: 900, decay: 0.25 } },
  // the wobble: a saw into the ladder, an lfo on the cutoff synced to the beat.
  wobbleBass: { voice: 'osc', wave: 'sawtooth', unison: 2, detune: 12, attack: 0.005, decay: 0.2, sustain: 0.95, release: 0.12, volume: -17, filter: LADDER(500, 10, 0.4), lfo: [{ sync: '1/8', rate: 4, target: 'filter', depth: 2400 }], sub: { level: -6, octave: 1 } },
  // 4-op FM: the punchy bass (two stacks, op 4 fed back), tine keys, brass, drawbar organ, bell.
  fmBass: { voice: 'fm4', algorithm: 5, feedback: 0.5, attack: 0.001, decay: 0.05, sustain: 1, release: 0.08, volume: -11, ops: [{ ratio: 1, level: 1, decay: 0.6, sustain: 0.3, release: 0.1 }, { ratio: 1, level: 2.2, decay: 0.18, sustain: 0.15, velSens: 0.8 }, { ratio: 0.5, level: 0.6, decay: 0.9, sustain: 0.5, release: 0.1 }, { ratio: 1, level: 1.4, decay: 0.12, sustain: 0.1 }] },
  fmKeys: { voice: 'fm4', algorithm: 5, feedback: 0.2, attack: 0.001, decay: 0.05, sustain: 1, release: 0.5, volume: -14, ops: [{ ratio: 1, level: 1, decay: 1.6, sustain: 0.25, release: 0.5 }, { ratio: 14, level: 1.1, decay: 0.35, sustain: 0.02, velSens: 1 }, { ratio: 1, level: 0.7, decay: 2.2, sustain: 0.3, release: 0.5 }, { ratio: 1, level: 0.8, decay: 1.2, sustain: 0.2, velSens: 0.6 }] },
  fmBrass: { voice: 'fm4', algorithm: 2, feedback: 0.45, attack: 0.02, decay: 0.05, sustain: 1, release: 0.25, volume: -15, ops: [{ ratio: 1, level: 1, attack: 0.04, decay: 0.3, sustain: 0.85, release: 0.25 }, { ratio: 1, level: 2.4, attack: 0.08, decay: 0.4, sustain: 0.7, velSens: 0.9 }, { ratio: 1, level: 1.1, attack: 0.1, decay: 0.5, sustain: 0.6 }, { ratio: 1, level: 0.9, attack: 0.06, decay: 0.3, sustain: 0.5 }] },
  fmOrgan: { voice: 'fm4', algorithm: 8, attack: 0.005, decay: 0.02, sustain: 1, release: 0.06, volume: -16, ops: [{ ratio: 0.5, level: 0.6, attack: 0.005, sustain: 1 }, { ratio: 1, level: 1, attack: 0.005, sustain: 1 }, { ratio: 2, level: 0.6, attack: 0.005, sustain: 1 }, { ratio: 3, level: 0.4, attack: 0.005, sustain: 1 }] },
  fmBell4: { voice: 'fm4', algorithm: 5, attack: 0.001, decay: 0.05, sustain: 1, release: 2, volume: -16, ops: [{ ratio: 1, level: 1, decay: 3.5, sustain: 0.05, release: 2 }, { ratio: 3.5, level: 3, decay: 1.5, sustain: 0.05 }, { ratio: 2.02, level: 0.6, decay: 2.5, sustain: 0.05, release: 2 }, { ratio: 5.19, level: 2, decay: 0.8, sustain: 0.02 }] },
});

// ── anthem styles: the band's guitars and basses ─────────────────────────────
// A drop-tuned chug (dual pluck, tight lows: the highpass keeps the palm-muted
// 16ths from blooming), a picked bass (a bright pick on a long string) and a
// slap bass (brighter still; the `pop` articulation adds its harmonic snap).
Object.assign(PATCHES, {
  guitarDropChug: { voice: 'string', pluckDamping: 0.5, pluckDecay: 0.9978, pick: 0.08, pluckDetune: 7, attack: 0.002, decay: 0.05, sustain: 1, release: 0.12, volume: -13, filter: { mode: 'highpass', freq: 75, q: 0.7 } },
  bassPick: { voice: 'string', pluckDamping: 0.3, pluckDecay: 0.9993, pick: 0.04, attack: 0.002, decay: 0.08, sustain: 1, release: 0.12, volume: -8, maxRing: 5, attackNoise: { mode: 'bandpass', level: -18, tone: 2400, q: 0.8, decay: 0.012 } },
  // the orchestra hit, synthesized: a detuned saw stack (brass + strings) with a
  // fast filter fall, a sub and a noise bloom (the timpani and the room), a
  // slight pitch drop, 250 ms — play it as a stacked chord; the instrument adds a hall.
  orchHit: { voice: 'osc', wave: 'sawtooth', unison: 5, detune: 16, width: 0.7, attack: 0.003, decay: 0.26, sustain: 0, release: 0.2, curve: 'exp', volume: -12, filter: { mode: 'lowpass', q: 1.2 }, filterEnv: { from: 7000, to: 900, decay: 0.3 }, bend: [1, 0.97, 0.04, 0.35], sub: { level: -8, octave: 1 }, noise: { level: -20 }, attackNoise: { mode: 'bandpass', level: -4, tone: 700, q: 0.6, decay: 0.14 } },
  bassSlap: { voice: 'string', pluckDamping: 0.18, pluckDecay: 0.9991, pick: 0, attack: 0.001, decay: 0.08, sustain: 1, release: 0.1, volume: -9, maxRing: 5, attackNoise: { mode: 'bandpass', level: -12, tone: 3000, q: 0.8, decay: 0.015 } },
});

// the 90s rock kit (anthem styles): tighter and brighter than the arena kit —
// the acoustic kick and hats, the arena's cracking snare and bent toms. The
// instrument puts the whole kit on a short plate (less room, more sheen).
Object.assign(PATCHES, {
  rockKit90s: { kit: { 35: 'kickAcoustic', 36: 'kickAcoustic', 37: 'snareArenaRim', 38: 'snareArena', 40: 'snareArenaRim', 41: 'tomArenaFloor', 43: 'tomArenaLo', 45: 'tomArenaLo', 47: 'tomArenaMid', 48: 'tomArenaMid', 50: 'tomArenaHi', 42: 'hatAcoustic', 44: 'hatAcoustic', 46: 'hatAcousticOpen', 49: 'crashArena', 57: 'crashArena', 55: 'crashArena', 52: 'chinaArena', 51: 'rideAcoustic', 53: 'rideBellArena', 59: 'rideAcoustic' }, chokes: HATS },
});

// ── roots styles: country, blues and the nylon and steel guitars ─────────────
// Plucked strings: a bright single-coil twang, the pedal steel (a slow swell
// hides the pluck: the bar and the volume pedal), a banjo (short, bright; its
// instrument adds the drum-head body), an upright bass (a dark, short string
// with a round thump), the classical nylon (warm, long), the flamenco nylon
// (brighter, drier, quicker) and the gypsy-jazz steel (bright, dry, little
// sustain). The harmonica is a reed: a bright harmonic series, breath, a quick
// swell.
Object.assign(PATCHES, {
  guitarTwang: { voice: 'string', pluckDamping: 0.3, pluckDecay: 0.9975, pick: 0.22, attack: 0.002, decay: 0.05, sustain: 1, release: 0.1, volume: -12, filter: { mode: 'lowpass', freq: 5400, q: 0.8 } },
  pedalSteel: { voice: 'string', pluckDamping: 0.32, pluckDecay: 0.9995, pick: 0.02, attack: 0.18, decay: 0.2, sustain: 1, release: 0.45, volume: -13, maxRing: 6, filter: { mode: 'lowpass', freq: 4200, q: 0.7 } },
  banjo: { voice: 'string', pluckDamping: 0.16, pluckDecay: 0.991, pick: 0.06, attack: 0.001, decay: 0.03, sustain: 1, release: 0.06, volume: -12, filter: { mode: 'highpass', freq: 160, q: 0.7 } },
  bassUpright: { voice: 'string', pluckDamping: 0.84, pluckDecay: 0.9975, pick: 0.5, attack: 0.004, decay: 0.08, sustain: 1, release: 0.12, volume: -8, maxRing: 2, attackNoise: { mode: 'lowpass', level: -16, tone: 420, q: 0.7, decay: 0.035 } },
  guitarClassical: { voice: 'string', pluckDamping: 0.88, pluckDecay: 0.997, pick: 0.62, attack: 0.008, decay: 0.05, sustain: 1, release: 0.22, volume: -12, filter: { mode: 'lowpass', freq: 3600, q: 0.6 } },
  guitarFlamenco: { voice: 'string', pluckDamping: 0.66, pluckDecay: 0.9935, pick: 0.45, attack: 0.003, decay: 0.04, sustain: 1, release: 0.1, volume: -11, filter: { mode: 'lowpass', freq: 5200, q: 0.7 } },
  guitarGypsy: { voice: 'string', pluckDamping: 0.24, pluckDecay: 0.994, pick: 0.3, attack: 0.002, decay: 0.04, sustain: 1, release: 0.08, volume: -12, filter: { mode: 'lowpass', freq: 6200, q: 0.8 } },
  harmonica: { voice: 'osc', harmonics: [1, 0.75, 0.6, 0.5, 0.36, 0.3, 0.2, 0.15, 0.1, 0.07], attack: 0.035, decay: 0.12, sustain: 0.85, release: 0.08, volume: -16, curve: 'exp', filter: { mode: 'lowpass', freq: 3400, q: 1.1 }, breath: { level: -27, tone: 2400, q: 0.7 } },
});
// brushes and palmas: a brush snare is a swish (filtered noise with a soft
// onset), the brush kick is soft, the cross-stick a rim click; palmas are the
// flamenco hand claps (sharp and muffled) and the golpe is a knock on the top.
Object.assign(PATCHES, {
  brushSnare: { voice: 'noise', attack: 0.012, decay: 0.18, sustain: 0, release: 0.06, curve: 'exp', volume: -15, vary: true, filter: { mode: 'bandpass', freq: 2600, q: 0.6 } },
  kickBrush: { ...PATCHES.kick2, volume: -10, decay: 0.3, attackNoise: { mode: 'highpass', tone: 1500, q: 0.7, level: -24, decay: 0.003 } },
  palmaSharp: { voice: 'noise', claps: 2, clapGap: 0.004, attack: 0.001, decay: 0.09, sustain: 0, release: 0.04, curve: 'exp', volume: -10, vary: true, filter: { mode: 'bandpass', freq: 2300, q: 0.9 } },
  palmaMuted: { voice: 'noise', claps: 2, clapGap: 0.005, attack: 0.001, decay: 0.06, sustain: 0, release: 0.03, curve: 'exp', volume: -13, vary: true, filter: { mode: 'bandpass', freq: 900, q: 0.8 } },
  // an acoustic cowbell: a short, clanky, inharmonic stick hit (not the 808's two squares).
  cowbellAcoustic: { voice: 'modal', pitch: 760, attack: 0.001, volume: -13, vary: true, partials: [{ ratio: 1, gain: 1, decay: 0.14 }, { ratio: 1.52, gain: 0.7, decay: 0.11 }, { ratio: 2.31, gain: 0.45, decay: 0.08 }, { ratio: 3.17, gain: 0.25, decay: 0.05 }], attackNoise: { mode: 'bandpass', tone: 2600, q: 0.9, level: -14, decay: 0.008 } },
  golpe: { voice: 'modal', pitch: 170, attack: 0.001, volume: -11, partials: [{ ratio: 1, gain: 1, decay: 0.06 }, { ratio: 2.4, gain: 0.5, decay: 0.035 }, { ratio: 4.1, gain: 0.25, decay: 0.02 }], attackNoise: { mode: 'bandpass', tone: 1800, q: 0.8, level: -16, decay: 0.006 } },
});
Object.assign(PATCHES, {
  brushKit: { kit: { 35: 'kickBrush', 36: 'kickBrush', 37: 'rimAnalog', 38: 'brushSnare', 40: 'brushSnare', 42: 'hatAcoustic', 44: 'hatAcoustic', 46: 'hatAcousticOpen', 41: 'tomAcousticLo', 43: 'tomAcousticLo', 45: 'tomAcousticMid', 47: 'tomAcousticMid', 48: 'tomAcousticHi', 50: 'tomAcousticHi', 49: 'crashAcoustic', 57: 'crashAcoustic', 51: 'rideAcoustic', 53: 'rideAcoustic', 59: 'rideAcoustic', 54: 'tambourine', 56: 'cowbellAcoustic' }, chokes: PATCHES.acousticKit.chokes },
  palmas: { kit: { 39: 'palmaSharp', 40: 'palmaMuted', 37: 'golpe' } },
});

export function getPatch(name, overrides) {
  const base = PATCHES[name];
  if (!base) {
    throw new Error(`beats: unknown patch '${name}'. Known patches: ${Object.keys(PATCHES).join(', ')}.`);
  }
  return overrides && typeof overrides === 'object' ? { ...base, ...overrides } : { ...base };
}
