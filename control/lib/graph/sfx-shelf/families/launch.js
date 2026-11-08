/**
 * families/launch — a machine's jump released: a piston slam, heavier the longer the jump was gathered. Pure.
 *
 * The audio channel's jump release (scene/channels/audio.js), ported at three powers: an air-release burst (300 Hz up, its lowpass
 * opening 1.1 → 2.6 kHz, longer with power) and a sine launch thunk falling further and longer (about 180 → 72 Hz at
 * the lightest, 125 → 32 Hz at full; to the nearest notes). Then what the register adds: a transient, a sub, the
 * thunk's harmonics, the frame's plate clank, and a hiss trailing off.
 */
import { transient, sub, plate, harmonicsOf } from '../layers.js';

const POWER = ['low', 'mid', 'full'];
const P = [0.2, 0.6, 1];
const THUNK = [['E3', 'C2'], ['D3', 'G1'], ['B2', 'C1']];

export const launch = {
  label: 'a machine\'s jump released, by how long it was gathered',
  dials: { power: POWER },
  defaults: { power: 'mid' },
  ordered: [{ dial: 'power', rises: ['ms'], falls: ['centroidHz'] }],
  build(d) {
    const k = POWER.indexOf(d.power), p = P[k];
    const thunk = { type: 'thump', from: THUNK[k][0], to: THUNK[k][1], decay: 0.12 + 0.2 * p, vol: 0.4 + 0.5 * p };
    return [
      { type: 'burst', decay: 0.08 + 0.12 * p, vol: 0.2 + 0.28 * p, highpass: 300, lowpass: Math.round(1100 + 1500 * p), send: 0.2 },
      thunk,
      transient(2800, 0.01, 0.2 + 0.1 * p),
      harmonicsOf(thunk, 0.08 + 0.06 * p, 300),
      sub('C1', 'A0', 0.15 + 0.25 * p, 0.06 + 0.08 * p),
      plate('D4', 0.15 + 0.15 * p, 0.05, { at: 0.004, send: 0.3 }),
      { type: 'burst', at: 0.04, decay: 0.15 + 0.2 * p, vol: 0.08, highpass: 3500, pan: 0.25, send: 0.25 },
    ];
  },
};
