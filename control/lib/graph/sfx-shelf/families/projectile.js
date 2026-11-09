/**
 * families/projectile — what a round does that is not its firing or its landing: passing by (a bullet's whiz, a
 * beam's hum, a rocket's roar going past), glancing off (the ricochet's ping), and its spent casing bouncing on the
 * floor. Pure.
 */
import { transient, grit, tail } from '../layers.js';

export const projectile = {
  label: 'a round passing, glancing off, its casing falling',
  dials: { act: ['flyby', 'ricochet', 'casing'], kind: ['bullet', 'beam', 'rocket', 'shell'] },
  defaults: { act: 'flyby', kind: 'bullet' },
  ordered: [],
  build(d, seed) {
    if (d.act === 'casing') {
      const big = d.kind === 'shell' || d.kind === 'rocket';
      const n = big ? ['G5', 'D5', 'A4'] : ['C7', 'G6', 'E6'];
      return [0, 0.09, 0.15, 0.19].map((t, i) => ({ type: 'ring', material: 'metal', note: n[Math.min(i, 2)], decay: (big ? 0.3 : 0.15) * (1 - 0.2 * i), vol: 0.1 * (1 - 0.25 * i), at: t, pan: [0.2, -0.1, 0.25, 0][i], send: 0.15 }))
        .concat([transient(big ? 2500 : 4500, 0.006, 0.12), grit(big ? 10 : 4, 0.2, 3000, 11000, big ? 0.12 : 0.05, seed(1), { at: 0.02 }), ...(big ? [{ type: 'thump', from: 'D3', to: 'A2', decay: 0.04, vol: 0.12 }] : [])]);
    }
    if (d.act === 'ricochet') return [
      transient(4000, 0.008, 0.35),
      { type: 'sweep', wave: 'sine', from: d.kind === 'beam' ? 'E6' : 'E7', to: d.kind === 'beam' ? 'A5' : 'A6', dur: 0.28, vol: 0.06, at: 0.005, pan: 0.3, send: 0.35 },
      { type: 'ring', material: 'metal', note: 'B6', decay: 0.2, vol: 0.06, send: 0.3 },
      grit(22, 0.12, 4000, 12000, 0.22, seed(1), { pan: -0.3, send: 0.3 }),
      { type: 'thump', from: 'E3', to: 'B2', decay: 0.05, vol: 0.3 },
      { type: 'burst', decay: 0.04, vol: 0.18, lowpass: 2500, send: 0.15 },
    ];
    // flyby: a doppler fall past the listener, swept left to right by its layers
    if (d.kind === 'beam') return [
      { type: 'tone', note: 'A5', to: 'A4', dur: 0.25, wave: 'sawtooth', lowpass: 4000, vol: 0.08, tremolo: { rate: 40, depth: 0.5 }, pan: -0.4, send: 0.3 },
      { type: 'tone', note: 'E5', to: 'E4', dur: 0.25, wave: 'sine', vol: 0.06, at: 0.04, pan: 0.4, send: 0.3 },
      { type: 'burst', decay: 0.2, vol: 0.12, highpass: 3000, send: 0.3 },
      grit(16, 0.2, 3000, 10000, 0.08, seed(1), { pan: 0.3 }),
    ];
    if (d.kind === 'rocket' || d.kind === 'shell') return [
      { type: 'burst', decay: 0.7, vol: 0.3, filterEnv: { from: 5000, to: 600, decay: 0.7 }, pan: -0.3, send: 0.35 },
      { type: 'tone', note: 'C3', to: 'G2', dur: 0.6, wave: 'sawtooth', lowpass: 800, vol: 0.12, attack: 0.15, release: 0.2, pan: 0.2, send: 0.3 },
      grit(40, 0.6, 600, 4000, 0.1, seed(1), { pan: 0.35, send: 0.3 }),
      tail(0.5, 1500, 200, 0.1, { at: 0.2, lowpass: 600, send: 0.5 }),
    ];
    return [
      { type: 'burst', decay: 0.14, vol: 0.3, highpass: 1500, filterEnv: { from: 9000, to: 1800, decay: 0.14 }, pan: -0.3, send: 0.2 },
      { type: 'burst', at: 0.03, decay: 0.1, vol: 0.18, bandpass: 3200, q: 2, pan: 0.3, send: 0.2 },
      { type: 'sweep', wave: 'sine', from: 'E7', to: 'B6', dur: 0.12, vol: 0.03, at: 0.01 },
      grit(8, 0.1, 4000, 12000, 0.08, seed(1), { pan: 0.4 }),
    ];
  },
};
