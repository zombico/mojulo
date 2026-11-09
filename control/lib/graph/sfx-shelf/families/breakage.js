/**
 * families/breakage — a thing breaking, by what it is made of and how big it is: glass shattering into shards, wood
 * splintering, stone crumbling, metal tearing. Pure. A large one comes apart longer, and ducks the score.
 */
import { transient, sub, grit, tail, plate, duck, harmonicsOf } from '../layers.js';

const SIZE = ['small', 'large'];
// glass shards: a struck note each, scattered over the break (the times and notes are the recipe's, not dice)
const SHARDS = [['E7', 0], ['B6', 0.03], ['G7', 0.07], ['D7', 0.12], ['A6', 0.18], ['F#7', 0.26], ['C7', 0.35], ['E7', 0.46]];

export const breakage = {
  label: 'a thing breaking, by its material and its size',
  dials: { material: ['glass', 'wood', 'stone', 'metal'], size: SIZE },
  defaults: { material: 'glass', size: 'small' },
  ordered: [{ dial: 'size', rises: ['ms'] }],
  build(d, seed) {
    const L = SIZE.indexOf(d.size), s = 1 + 0.8 * L;
    const out = [];
    if (d.material === 'glass') {
      out.push(transient(5000, 0.015, 0.4), { type: 'burst', decay: 0.08, vol: 0.2, bandpass: 4000, q: 1, send: 0.2 });
      SHARDS.slice(0, L ? 8 : 5).forEach(([note, t], i) => out.push({ type: 'ring', material: 'glass', note, decay: 0.3 + 0.05 * i, vol: 0.09 - 0.006 * i, at: t * s, pan: ((i * 5) % 7) / 7 - 0.43, send: 0.35 }));
      out.push(grit(Math.round(40 * s), 0.4 * s, 3000, 12000, 0.16, seed(1), { pan: -0.35, send: 0.35 }), grit(Math.round(25 * s), 0.5 * s, 4000, 12000, 0.1, seed(2), { at: 0.05, pan: 0.35, send: 0.35 }));
      out.push({ type: 'thump', from: 'D3', to: 'A2', decay: 0.06, vol: 0.18 });
    } else if (d.material === 'wood') {
      const body = { type: 'thump', from: 'A2', to: 'E2', decay: 0.15 * s, vol: 0.45 };
      out.push(transient(2000, 0.02, 0.4), body, harmonicsOf(body, 0.12, 350));
      for (const [i, n] of ['D4', 'A3', 'F4'].entries()) out.push({ type: 'ring', material: 'wood', note: n, decay: 0.1, vol: 0.12, at: 0.02 + 0.05 * i * s, pan: [-0.3, 0.3, 0][i], send: 0.25 });
      out.push({ type: 'flutter', wave: 'sawtooth', rateHz: 14, hold: 0.12 * s, jitter: 0.8, tiers: [{ at: 0, table: ['A2', 'C3', 'G2'] }], vol: 0.08, seed: seed(1), send: 0.2 });
      out.push(grit(Math.round(30 * s), 0.3 * s, 800, 5000, 0.16, seed(2), { at: 0.02, pan: -0.35, send: 0.35 }), grit(Math.round(20 * s), 0.35 * s, 500, 3500, 0.12, seed(3), { at: 0.05, pan: 0.35, send: 0.35 }));
    } else if (d.material === 'stone') {
      const body = { type: 'thump', from: 'E2', to: 'A1', decay: 0.25 * s, vol: 0.55 };
      out.push(transient(1800, 0.025, 0.4), body, harmonicsOf(body, 0.14, 300), sub('C1', 'A0', 0.3 * s, 0.1));
      out.push(grit(Math.round(50 * s), 0.6 * s, 300, 4000, 0.24, seed(1), { at: 0.02, pan: -0.4, send: 0.4 }), grit(Math.round(35 * s), 0.7 * s, 600, 5500, 0.18, seed(2), { at: 0.06, pan: 0.4, send: 0.4 }));
      out.push(tail(0.8 * s, 2500, 150, 0.16, { at: 0.04, lowpass: 2500, send: 0.55 }));
    } else {
      const body = { type: 'thump', from: 'C2', to: 'F1', decay: 0.2 * s, vol: 0.5 };
      out.push(transient(3000, 0.015, 0.4), body, harmonicsOf(body, 0.14, 300));
      out.push({ type: 'flutter', wave: 'sawtooth', rateHz: 34, hold: 0.4 * s, jitter: 0.9, tiers: [{ at: 0, table: ['E4', 'G4', 'D4', 'A4'] }, { at: 0.2 * s, table: ['C4', 'D4', 'B3'] }], vol: 0.1, seed: seed(1), pan: -0.25, send: 0.35 });
      out.push(plate('G3', 0.6 * s, 0.07, { send: 0.45 }), plate('C#4', 0.4 * s, 0.05, { at: 0.08, pan: 0.3, send: 0.45 }));
      out.push(grit(Math.round(24 * s), 0.4 * s, 1500, 8000, 0.13, seed(2), { pan: 0.35, send: 0.35 }));
    }
    if (L) out.push(duck(4, 0.15, 0.6));
    return out;
  },
};
