/**
 * families/elemental — the elements as one-shots: fire flaring up, ice cracking, lightning striking (its crack, then
 * its thunder rolling), water splashing, a gust of wind. Pure. A fire that burns on, a rain that falls on, are beds,
 * not cues: the world's wind and weather channels hold those.
 */
import { transient, sub, grit, tail, duck } from '../layers.js';

export const elemental = {
  label: 'fire, ice, lightning, water, wind',
  dials: { element: ['fire', 'ice', 'lightning', 'water', 'wind'] },
  defaults: { element: 'fire' },
  ordered: [],
  swells: ['wind'],
  build(d, seed) {
    switch (d.element) {
      case 'fire': return [
        { type: 'burst', decay: 0.6, vol: 0.4, filterEnv: { from: 600, to: 3500, decay: 0.3 }, send: 0.3 },
        { type: 'thump', from: 'C2', to: 'G1', decay: 0.3, vol: 0.3 },
        grit(50, 0.7, 600, 4000, 0.2, seed(1), { decay: [0.003, 0.012], pan: -0.35, send: 0.35 }),
        grit(40, 0.6, 1500, 7000, 0.16, seed(2), { at: 0.05, decay: [0.002, 0.008], pan: 0.35, send: 0.35 }),
        tail(0.8, 2000, 300, 0.12, { at: 0.1, send: 0.45 }),
      ];
      case 'ice': return [
        transient(3000, 0.012, 0.45),
        { type: 'ring', material: 'glass', note: 'E6', decay: 0.25, vol: 0.1, send: 0.3 },
        { type: 'ring', material: 'glass', note: 'B6', decay: 0.2, vol: 0.08, at: 0.03, pan: 0.3, send: 0.3 },
        grit(30, 0.18, 2000, 9000, 0.16, seed(1), { pan: -0.3, send: 0.3 }),
        { type: 'flutter', wave: 'square', rateHz: 40, hold: 0.1, jitter: 0.9, tiers: [{ at: 0, table: ['E5', 'B5', 'G5'] }], vol: 0.05, seed: seed(2), send: 0.2 },
        { type: 'thump', from: 'E3', to: 'B2', decay: 0.05, vol: 0.2 },
      ];
      case 'lightning': return [
        transient(1000, 0.03, 0.6),
        grit(60, 0.25, 2000, 12000, 0.2, seed(1), { chain: [{ type: 'crush', bits: 5, mix: 0.6 }], pan: -0.3, send: 0.35 }),
        grit(40, 0.2, 3000, 12000, 0.16, seed(2), { at: 0.02, pan: 0.3, send: 0.35 }),
        { type: 'thump', from: 'E2', to: 'A0', decay: 0.4, vol: 0.5 },
        sub('A0', 'E0', 1.2, 0.12, { at: 0.12 }),
        tail(2, 2000, 120, 0.4, { at: 0.1, send: 0.6 }),
        duck(6, 0.3, 1.2),
      ];
      case 'water': return [
        { type: 'sweep', wave: 'sine', from: 'G4', to: 'G3', dur: 0.09, vol: 0.25, send: 0.1 },
        { type: 'burst', decay: 0.3, vol: 0.38, bandpass: 1200, q: 0.7, send: 0.3 },
        grit(60, 0.5, 800, 6000, 0.16, seed(1), { at: 0.02, pan: -0.35, send: 0.4 }),
        grit(40, 0.6, 1500, 8000, 0.12, seed(2), { at: 0.05, pan: 0.35, send: 0.4 }),
        tail(0.6, 7000, 1500, 0.14, { at: 0.04, send: 0.4 }),
        { type: 'thump', from: 'A2', to: 'E2', decay: 0.1, vol: 0.2 },
      ];
      case 'wind': return [
        { type: 'riser', dur: 0.9, from: 250, to: 1400, q: 1.5, vol: 0.35, pan: -0.3, send: 0.4 },
        { type: 'downlifter', at: 0.9, dur: 1.1, from: 1400, to: 250, q: 1.5, vol: 0.35, pan: 0.3, send: 0.4 },
        grit(40, 1.6, 2500, 9000, 0.06, seed(1), { at: 0.3, pan: 0.4, send: 0.3 }),
        { type: 'tone', note: 'A4', to: 'E4', dur: 1.6, wave: 'sine', vol: 0.025, attack: 0.6, release: 0.5, vibrato: { rate: 0.7, depth: 40 }, at: 0.2, send: 0.3 },
      ];
      default: return [];
    }
  },
};
