/**
 * families/melee — close combat: a blade or a club swung, what it meets, two blades meeting, a block, a punch, a
 * kick. Pure. `kind` is the weapon's make (steel, or an energy blade: a beam saber, a lightsword); the fists ignore it.
 */
import { transient, sub, grit, plate, duck, harmonicsOf } from '../layers.js';

const ACTS = ['blade-swing', 'blade-hit', 'clash', 'block', 'blunt-swing', 'blunt-hit', 'punch', 'kick'];
const whoosh = (from, to, decay, vol, extra = {}) => ({ type: 'burst', decay, vol, highpass: 400, filterEnv: { from, to, decay }, ...extra });

export const melee = {
  label: 'close combat: a swing, a hit, a clash, a block, a blow',
  dials: { act: ACTS, kind: ['steel', 'energy'] },
  defaults: { act: 'blade-hit', kind: 'steel' },
  ordered: [],
  build(d, seed) {
    const E = d.kind === 'energy';
    const hum = (dur) => ({ type: 'tone', note: 'A2', dur, wave: 'sawtooth', lowpass: 1400, vol: 0.08, attack: 0.03, vibrato: { rate: 7, depth: 25 }, send: 0.2 });
    const crackle = (n, over, vol, i) => grit(n, over, 1500, 10000, vol, seed(i), { chain: [{ type: 'crush', bits: 6, mix: 0.5 }], pan: i % 2 ? 0.35 : -0.35, send: 0.3 });
    switch (d.act) {
      case 'blade-swing': return [
        whoosh(900, 7000, 0.3, 0.3, { pan: -0.2, send: 0.25 }),
        whoosh(1500, 9000, 0.22, 0.18, { at: 0.04, pan: 0.25, send: 0.25 }),
        grit(18, 0.25, 3000, 10000, 0.14, seed(1), { pan: 0.3 }),
        { type: 'sweep', wave: 'sine', from: 'E6', to: 'A5', dur: 0.2, vol: 0.04, send: 0.2 },
        { type: 'burst', at: 0.05, decay: 0.15, vol: 0.12, lowpass: 900, send: 0.2 },
        ...(E ? [hum(0.35), crackle(14, 0.3, 0.1, 2)] : []),
      ];
      case 'blade-hit': {
        const body = { type: 'thump', from: 'E3', to: 'A2', decay: 0.12, vol: 0.4 };
        return [
          transient(3500, 0.01, 0.35), body, harmonicsOf(body, 0.12, 400),
          E ? crackle(24, 0.2, 0.16, 1) : { type: 'ring', material: 'metal', note: 'A5', decay: 0.2, vol: 0.08, send: 0.3 },
          grit(12, 0.12, 1000, 6000, 0.14, seed(2), { pan: 0.3, send: 0.3 }),
          sub('C2', 'G1', 0.12, 0.12),
        ];
      }
      case 'clash': return E ? [
        transient(3000, 0.015, 0.4),
        { type: 'flutter', wave: 'sawtooth', rateHz: 90, hold: 0.3, jitter: 1, tiers: [{ at: 0, table: ['E5', 'A5', 'C5', 'G4'] }], vol: 0.18, seed: seed(1), pan: -0.25, send: 0.3 },
        crackle(40, 0.35, 0.2, 2), crackle(30, 0.3, 0.16, 3),
        { type: 'tone', note: 'A2', dur: 0.3, wave: 'sawtooth', lowpass: 2000, vol: 0.12, tremolo: { rate: 25, depth: 0.7 }, send: 0.25 },
        sub('E2', 'A1', 0.2, 0.15),
        duck(3, 0.06, 0.3),
      ] : [
        transient(4500, 0.012, 0.45),
        plate('D6', 0.5, 0.06, { send: 0.4 }),
        { type: 'ring', material: 'metal', note: 'A5', decay: 0.8, vol: 0.1, pan: 0.2, send: 0.4 },
        { type: 'sweep', wave: 'sine', from: 'A6', to: 'E6', dur: 0.12, vol: 0.05, at: 0.01, pan: -0.2 },
        grit(18, 0.15, 3000, 11000, 0.14, seed(1), { pan: 0.4, send: 0.35 }),
        { type: 'thump', from: 'E3', to: 'B2', decay: 0.08, vol: 0.25 },
        duck(2, 0.05, 0.25),
      ];
      case 'block': {
        const body = { type: 'thump', from: 'A2', to: 'D2', decay: 0.16, vol: 0.5 };
        return [
          { type: 'burst', decay: 0.06, vol: 0.4, lowpass: 2500, send: 0.15 }, body, harmonicsOf(body, 0.14, 350),
          plate('G3', 0.2, 0.05, { send: 0.3 }), transient(2800, 0.01, 0.2),
          grit(10, 0.1, 600, 4000, 0.12, seed(1), { pan: -0.3, send: 0.3 }),
          sub('D1', 'A0', 0.2, 0.15),
        ];
      }
      case 'blunt-swing': return [
        whoosh(400, 2500, 0.42, 0.34, { pan: -0.15, send: 0.25 }),
        whoosh(600, 3500, 0.32, 0.2, { at: 0.06, pan: 0.2, send: 0.25 }),
        grit(16, 0.35, 2500, 8000, 0.13, seed(1), { pan: 0.25 }),
        { type: 'sweep', wave: 'sine', from: 'C4', to: 'G3', dur: 0.3, vol: 0.05, send: 0.15 },
        { type: 'burst', at: 0.08, decay: 0.25, vol: 0.14, lowpass: 600, send: 0.2 },
      ];
      case 'blunt-hit': {
        const body = { type: 'thump', from: 'G2', to: 'C2', decay: 0.2, vol: 0.55 };
        return [
          { type: 'burst', decay: 0.08, vol: 0.45, lowpass: 1500, send: 0.15 }, body, harmonicsOf(body, 0.14, 300),
          transient(2000, 0.012, 0.2), { type: 'ring', material: 'wood', note: 'D3', decay: 0.12, vol: 0.1, send: 0.2 },
          grit(18, 0.15, 600, 5000, 0.2, seed(1), { pan: 0.3, send: 0.3 }),
          sub('C1', 'A0', 0.25, 0.12),
        ];
      }
      case 'punch':
      case 'kick': {
        const K = d.act === 'kick' ? 1 : 0;
        const body = { type: 'thump', from: K ? 'G2' : 'C3', to: K ? 'C2' : 'G2', decay: 0.08 + 0.05 * K, vol: 0.45 + 0.08 * K };
        return [
          whoosh(500, 3000, 0.08, 0.12, { pan: -0.2 }),
          { type: 'burst', at: 0.05, decay: 0.05 + 0.02 * K, vol: 0.42, lowpass: 2200, send: 0.15 },
          { ...body, at: 0.05 }, { ...harmonicsOf(body, 0.12, 350), at: 0.05 },
          transient(2200, 0.008, 0.18, { at: 0.05 }),
          grit(8, 0.06, 300, 1800, 0.12, seed(1), { at: 0.05, pan: 0.25, send: 0.2 }),
          sub('E1', 'A0', 0.12 + 0.08 * K, 0.12 + 0.04 * K, { at: 0.05 }),
        ];
      }
      default: return [];
    }
  },
};
