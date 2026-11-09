/**
 * families/shield — an energy field: raised (a charge whining up into a chime), dropped (the same falling away), and
 * broken (a burst of glassy shards and a crackle as it fails). A hit on a raised shield is an impact on `energy`
 * (families/impact). Pure.
 */
import { transient, grit, duck } from '../layers.js';

export const shield = {
  label: 'an energy shield raised, dropped, broken',
  dials: { act: ['up', 'down', 'break'] },
  defaults: { act: 'up' },
  ordered: [],
  build(d, seed) {
    const up = d.act === 'up';
    if (d.act === 'break') return [
      transient(3500, 0.02, 0.45),
      ...['E7', 'B6', 'G#6', 'E6', 'B5'].map((note, i) => ({ type: 'ring', material: 'glass', note, decay: 0.4, vol: 0.08, at: 0.02 * i, pan: [-0.4, 0.4, -0.2, 0.2, 0][i], send: 0.4 })),
      { type: 'tone', note: 'E5', to: 'E3', dur: 0.5, wave: 'sawtooth', lowpass: 3000, vol: 0.08, tremolo: { rate: 30, depth: 0.7 }, send: 0.35 },
      grit(50, 0.4, 2500, 11000, 0.16, seed(1), { chain: [{ type: 'crush', bits: 6, mix: 0.5 }], pan: 0.3, send: 0.4 }),
      { type: 'thump', from: 'E2', to: 'A1', decay: 0.25, vol: 0.35 },
      duck(4, 0.1, 0.5),
    ];
    return [
      { type: 'tone', note: up ? 'A3' : 'A5', to: up ? 'A5' : 'A3', dur: 0.35, wave: 'sine', vol: 0.12, attack: 0.02, release: 0.15, tremolo: { rate: 24, depth: 0.4 }, send: 0.3 },
      { type: 'flutter', wave: 'triangle', rateHz: 28, hold: 0.32, tiers: up ? [{ at: 0, table: ['E4', 'A4'] }, { at: 0.15, table: ['A4', 'E5'] }, { at: 0.25, table: ['E5', 'A5'] }] : [{ at: 0, table: ['E5', 'A5'] }, { at: 0.15, table: ['A4', 'E5'] }, { at: 0.25, table: ['E4', 'A4'] }], vol: 0.06, pan: -0.3, send: 0.3 },
      { type: 'ring', material: 'glass', note: up ? 'A6' : 'A5', decay: 0.5, vol: 0.09, at: up ? 0.33 : 0, pan: 0.25, send: 0.45 },
      grit(16, 0.35, 3000, 10000, 0.06, seed(1), { pan: 0.35, send: 0.3 }),
      { type: 'thump', from: up ? 'A2' : 'E2', to: up ? 'E2' : 'A1', decay: 0.12, vol: 0.2, at: up ? 0.3 : 0 },
      transient(3500, 0.006, 0.12, { at: up ? 0.33 : 0 }),
    ];
  },
};
