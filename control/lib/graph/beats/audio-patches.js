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

export function getPatch(name, overrides) {
  const base = PATCHES[name];
  if (!base) {
    throw new Error(`beats: unknown patch '${name}'. Known patches: ${Object.keys(PATCHES).join(', ')}.`);
  }
  return overrides && typeof overrides === 'object' ? { ...base, ...overrides } : { ...base };
}
