/**
 * families/horror — dread's sounds: the body's own (held: `heartbeat` by fear, `breath` by exertion), and the
 * house's (`horror`: a jumpscare's stab, three knocks somewhere else, metal dragged far off, a drone swelling). Pure.
 */
import { transient, sub, grit, tail, duck, plate, ringOf, knock, creak } from '../layers.js';

export const heartbeat = {
  label: 'a heartbeat by fear: slow and faint at rest, fast and pounding at the top',
  sustain: true,
  ordered: [],
  dials: { kind: ['chest'] },
  defaults: { kind: 'chest' },
  idle: 'running',
  build() {
    // a beat is a sawtooth on the gain, a sharp start and a fall; the second, at twice the rate and fainter, is the
    // valve's dub between the lubs. A knock of the chest wall carries it up where it is heard.
    return { attack: 0.4, release: 0.6, layers: [
      { kind: 'osc', wave: 'sine', pitch: [48, 62], gain: [0.3, 0.7], lfo: { to: 'gain', wave: 'sawtooth', rate: [1.05, 2.6], depth: -1 } },
      { kind: 'osc', wave: 'sine', pitch: [70, 90], gain: [0.1, 0.3], lfo: { to: 'gain', wave: 'sawtooth', rate: [2.1, 5.2], depth: -1 } },
      { kind: 'noise', gain: [0.08, 0.3], band: { lo: 300, hi: 1600 }, lfo: { to: 'gain', wave: 'sawtooth', rate: [1.05, 2.6], depth: -1 } },
      { kind: 'noise', gain: [0.02, 0.1], band: { lo: 1500, hi: 4000 }, lfo: { to: 'gain', wave: 'sawtooth', rate: [1.05, 2.6], depth: -1 }, pan: 0.15 },
    ] };
  },
};

export const breath = {
  label: 'breath by exertion: slow and quiet at rest, fast and ragged at the top',
  sustain: true,
  ordered: [],
  dials: { kind: ['person'] },
  defaults: { kind: 'person' },
  idle: 'running',
  build() {
    return { attack: 0.6, release: 0.8, layers: [
      { kind: 'noise', gain: [0.06, 0.35], band: { lo: 300 }, cutoff: [1500, 4500], lfo: { to: 'gain', rate: [0.25, 1.1], depth: 0.95 } },
      { kind: 'noise', gain: [0.02, 0.15], band: { lo: 2500 }, cutoff: [5000, 9000], lfo: { to: 'gain', rate: [0.25, 1.1], depth: 0.9 }, pan: 0.15 },
      { kind: 'noise', gain: [0.01, 0.08], band: { lo: 150, hi: 600 }, lfo: { to: 'gain', rate: [0.25, 1.1], depth: 0.8 } },
    ] };
  },
};

export const horror = {
  label: 'dread\'s one-shots: a jumpscare\'s stab, knocks somewhere else, metal dragged far off, a drone swelling',
  dials: { act: ['jumpscare', 'distant-knock', 'far-scrape', 'drone-swell'] },
  defaults: { act: 'jumpscare' },
  ordered: [],
  swells: ['drone-swell'],
  build(d, seed) {
    switch (d.act) {
      case 'jumpscare': return [
        transient(1000, 0.03, 0.6), { type: 'thump', from: 'E2', to: 'A0', decay: 0.5, vol: 0.5 }, sub('A0', 'E0', 0.8, 0.12),
        // a cluster of strings stabbed a semitone apart, screeching out
        ...['C5', 'C#5', 'D5', 'G#5'].map((n, i) => ({ type: 'tone', note: n, dur: 0.5, wave: 'sawtooth', lowpass: 6000, vol: 0.06, attack: 0.005, release: 0.4, vibrato: { rate: 9, depth: 30 }, pan: i * 0.2 - 0.3, send: 0.5 })),
        grit(40, 0.3, 3000, 12000, 0.16, seed(1), { pan: 0.35, send: 0.4 }), tail(1.2, 4000, 150, 0.2, { at: 0.02, send: 0.7 }), duck(9, 0.4, 1),
      ];
      case 'distant-knock': return [...[0, 0.55, 1.1].flatMap((t) => [...knock('A2', 'E2', 0.12, 0.35, 700, { at: t, send: 0.6 }), transient(1200, 0.01, 0.08, { at: t })]), tail(2, 1500, 150, 0.06, { at: 0.02, lowpass: 900, send: 0.8 }), sub('C1', 'A0', 0.2, 0.05), grit(10, 1.5, 300, 2000, 0.04, seed(1), { at: 0.2 })];
      case 'far-scrape': return [creak(['C4', 'C#4', 'D4', 'B3'], 1.4, 26, 0.06, seed(1), { send: 0.7 }), grit(60, 1.4, 1500, 7000, 0.08, seed(2), { pan: -0.4, send: 0.7 }), plate('F3', 1.5, 0.04, { at: 0.2, send: 0.8 }), { type: 'burst', decay: 1.4, vol: 0.06, bandpass: 2500, q: 2, send: 0.7 }, knock('C2', 'G1', 0.2, 0.2, 800, { at: 1.4, send: 0.7 })[0], transient(1500, 0.01, 0.06, { at: 1.4 })];
      default: return [
        { type: 'riser', dur: 2.4, from: 120, to: 2500, q: 3, vol: 0.25, send: 0.6 },
        { type: 'tone', note: 'A1', to: 'A#1', dur: 2.4, wave: 'sawtooth', lowpass: 1200, vol: 0.08, attack: 1.5, release: 0.3, send: 0.5 },
        { type: 'tone', note: 'E2', to: 'F2', dur: 2.4, wave: 'sawtooth', lowpass: 1500, vol: 0.06, attack: 1.8, release: 0.3, pan: 0.3, send: 0.5 },
        { type: 'tone', note: 'G#5', dur: 2, wave: 'sine', vol: 0.02, attack: 1.6, release: 0.4, vibrato: { rate: 5, depth: 40 }, at: 0.4, pan: -0.3, send: 0.6 },
        grit(30, 2.2, 3000, 10000, 0.04, seed(1), { at: 0.2, pan: 0.3, send: 0.6 }), ringOf('cymbal', 'C6', 1.5, 0.03, { at: 2.3, send: 0.6 }), sub('A0', 'A0', 0.6, 0.06, { at: 2.3 }),
      ];
    }
  },
};
