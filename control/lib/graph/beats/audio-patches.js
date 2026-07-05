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
};

export function getPatch(name, overrides) {
  const base = PATCHES[name];
  if (!base) {
    throw new Error(`beats: unknown patch '${name}'. Known patches: ${Object.keys(PATCHES).join(', ')}.`);
  }
  return overrides && typeof overrides === 'object' ? { ...base, ...overrides } : { ...base };
}
