/**
 * sfx-shelf/sets/buster — an arm cannon's shots, the run and gun's (gameworld/sound-sheet.js RUN_SOUNDS): energy, not
 * powder, and not a voice. Synthesized in the kernel's own tones: a square's bright edge sweeping down for the zip, a
 * triangle or a saw under it for the body, a hair of noise for the muzzle's snap; the charged rounds fatter (a saw
 * driven, a warble of its harmonics, a thump under it), the full charge a blast (its thump, a long fall, a burst of
 * air closing down, sparks after). Each shot is the one before it grown, so the three read as one gun. Pure data.
 *
 *   buster-shot          the tap: short and bright, a pew
 *   buster-charged-shot  the first charge: lower, longer, driven
 *   buster-full-shot     the full charge: a blast with a long falling tail
 */
import { freeze } from '../layers.js';

export const BUSTER = freeze({
  label: 'Arm cannon',
  cues: {
    'buster-shot': [
      { type: 'sweep', wave: 'square', from: 'B6', to: 'E5', dur: 0.075, vol: 0.36, chain: [{ type: 'filter', mode: 'lowpass', freq: 9000 }] },
      { type: 'sweep', wave: 'triangle', from: 'E6', to: 'B4', dur: 0.1, vol: 0.32 },
      { type: 'sweep', wave: 'sine', from: 'E5', to: 'E4', dur: 0.07, vol: 0.22, send: 0.1 },
      { type: 'burst', decay: 0.008, vol: 0.14, highpass: 5000, send: 0 },
    ],
    'buster-charged-shot': [
      { type: 'thump', from: 'A2', to: 'E1', decay: 0.2, vol: 0.34 },
      { type: 'sweep', wave: 'sawtooth', from: 'A5', to: 'A3', dur: 0.24, vol: 0.28, chain: [{ type: 'drive', amount: 0.3, tone: 8000 }] },
      { type: 'sweep', wave: 'square', from: 'E6', to: 'E4', dur: 0.16, vol: 0.2 },
      { type: 'flutter', wave: 'triangle', rateHz: 60, hold: 0.2, jitter: 0.4, tiers: [{ at: 0, table: ['E5', 'B5', 'E6'] }], vol: 0.1, seed: 5101, pan: 0.2, send: 0.2 },
      { type: 'burst', decay: 0.02, vol: 0.26, highpass: 3000, send: 0 },
      { type: 'grain', grains: 12, over: 0.18, band: { lo: 3000, hi: 10000 }, vol: 0.1, spread: 0.5, seed: 5102, pan: -0.2, send: 0.3 },
    ],
    'buster-full-shot': [
      { type: 'thump', from: 'A2', to: 'A0', decay: 0.45, vol: 0.58 },
      { type: 'sweep', wave: 'sawtooth', from: 'E5', to: 'E2', dur: 0.5, vol: 0.3, chain: [{ type: 'drive', amount: 0.45, tone: 7000 }] },
      { type: 'sweep', wave: 'square', from: 'B6', to: 'B3', dur: 0.3, vol: 0.2 },
      { type: 'flutter', wave: 'sawtooth', rateHz: 72, hold: 0.36, jitter: 0.6, tiers: [{ at: 0, table: ['E4', 'B4', 'E5', 'G#5'] }], vol: 0.14, seed: 5103, pan: -0.25, send: 0.25 },
      { type: 'burst', decay: 0.022, vol: 0.4, highpass: 3200, send: 0 },
      { type: 'burst', decay: 0.5, vol: 0.18, filterEnv: { from: 9000, to: 400, decay: 0.5 }, at: 0.015, send: 0.5 },
      { type: 'grain', grains: 28, over: 0.4, decay: [0.004, 0.02], band: { lo: 3000, hi: 11000 }, vol: 0.16, spread: 0.55, seed: 5104, pan: 0.3, send: 0.4 },
      { type: 'duck', depth: 4, hold: 0.12, release: 0.4 },
    ],
  },
});
