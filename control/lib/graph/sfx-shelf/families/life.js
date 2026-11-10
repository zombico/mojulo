/**
 * families/life — a life sim's hands at work (`work`: digging, hoeing, planting, watering, harvesting, chopping,
 * mining, hammering, sawing, casting a line and the fish biting) and its stove (`cooking`, held: a pan sizzling by its
 * heat, idling as a simmer). Pure.
 */
import { transient, sub, grit, tail, plate, harmonicsOf, whoosh, ringOf, knock } from '../layers.js';

export const work = {
  label: 'hands at work: dig, hoe, plant, water, harvest, chop, mine, hammer, saw, cast a line, a bite',
  dials: { act: ['dig', 'hoe', 'plant', 'water', 'harvest', 'chop', 'mine', 'hammer', 'saw', 'cast-line', 'bite'] },
  defaults: { act: 'dig' },
  ordered: [],
  build(d, seed) {
    switch (d.act) {
      case 'dig': return [transient(2200, 0.01, 0.25), ringOf('metal', 'D5', 0.06, 0.05), ...knock('A2', 'E2', 0.1, 0.35, 1500), grit(40, 0.25, 150, 2000, 0.2, seed(1), { at: 0.02, pan: -0.25, send: 0.2 }), grit(20, 0.3, 400, 3000, 0.12, seed(2), { at: 0.12, pan: 0.3 }), sub('C1', 'A0', 0.12, 0.06)];
      case 'hoe': return [whoosh(500, 2500, 0.1, 0.12, { pan: -0.2 }), transient(2000, 0.01, 0.2, { at: 0.08 }), ...knock('C3', 'G2', 0.06, 0.3, 1800, { at: 0.08 }), grit(30, 0.15, 200, 2200, 0.18, seed(1), { at: 0.09, pan: 0.25, send: 0.2 }), ringOf('metal', 'G5', 0.04, 0.04, { at: 0.08 })];
      case 'plant': return [grit(20, 0.15, 150, 1800, 0.16, seed(1), { pan: -0.2 }), ...knock('E3', 'B2', 0.05, 0.25, 1000, { at: 0.12 }), ...knock('E3', 'B2', 0.05, 0.2, 1000, { at: 0.24 }), grit(12, 0.1, 400, 2500, 0.1, seed(2), { at: 0.15, pan: 0.25 }), transient(1500, 0.008, 0.08, { at: 0.12 })];
      case 'water': return [
        // a watering can: a stream pattering on soil, droplets around it
        { type: 'burst', decay: 0.9, vol: 0.2, bandpass: 1800, q: 0.6, filterEnv: { from: 3000, to: 1500, decay: 0.9 }, send: 0.3 },
        grit(120, 0.9, 1000, 7000, 0.14, seed(1), { decay: [0.002, 0.008], pan: -0.25, send: 0.3 }), grit(60, 0.9, 300, 2500, 0.12, seed(2), { pan: 0.25 }),
        { type: 'thump', from: 'C4', to: 'G3', decay: 0.04, vol: 0.08 }, transient(3000, 0.006, 0.08),
      ];
      case 'harvest': return [transient(3000, 0.008, 0.25), { type: 'thump', from: 'E3', to: 'B2', decay: 0.04, vol: 0.2 }, ringOf('wood', 'A4', 0.05, 0.06), grit(30, 0.3, 1500, 7000, 0.14, seed(1), { at: 0.01, pan: -0.3, send: 0.2 }), grit(20, 0.25, 300, 2000, 0.12, seed(2), { at: 0.05, pan: 0.3 })];
      case 'chop': {
        const body = { type: 'thump', from: 'A2', to: 'D2', decay: 0.14, vol: 0.5 };
        return [whoosh(500, 3000, 0.1, 0.12, { pan: -0.2 }), transient(2200, 0.012, 0.4, { at: 0.08 }), { ...body, at: 0.08 }, { ...harmonicsOf(body, 0.12, 300), at: 0.08 }, ringOf('wood', 'D4', 0.12, 0.14, { at: 0.08, send: 0.25 }), ringOf('wood', 'A4', 0.08, 0.08, { at: 0.1 }), grit(20, 0.15, 800, 5000, 0.16, seed(1), { at: 0.09, pan: 0.3, send: 0.25 }), sub('C1', 'A0', 0.12, 0.06, { at: 0.08 })];
      }
      case 'mine': return [transient(4000, 0.008, 0.4), ringOf('metal', 'A5', 0.12, 0.1, { send: 0.3 }), plate('E5', 0.15, 0.04), ...knock('E2', 'A1', 0.1, 0.35, 1800), grit(40, 0.35, 300, 4500, 0.18, seed(1), { at: 0.02, pan: -0.35, send: 0.35 }), grit(20, 0.3, 2000, 8000, 0.1, seed(2), { at: 0.03, pan: 0.35 })];
      case 'hammer': return [transient(4500, 0.006, 0.4), ringOf('metal', 'E6', 0.15, 0.1, { send: 0.25 }), ringOf('metal', 'B6', 0.1, 0.05, { pan: 0.2 }), ...knock('C3', 'G2', 0.06, 0.3, 2500), ringOf('wood', 'C4', 0.08, 0.08), grit(6, 0.04, 2000, 8000, 0.08, seed(1))];
      case 'saw': return [
        // two strokes: the teeth cutting (a band of noise pulsing with the stroke), dust falling
        ...[0, 0.32].flatMap((t, i) => [{ type: 'burst', decay: 0.28, vol: 0.22, bandpass: i ? 2600 : 2000, q: 1.2, filterEnv: { from: 6000, to: 2500, decay: 0.28 }, at: t, pan: i ? 0.2 : -0.2, send: 0.2 },
          grit(50, 0.28, 1500, 8000, 0.12, seed(i + 1), { at: t, decay: [0.002, 0.006] }), { type: 'thump', from: 'C3', to: 'G2', decay: 0.04, vol: 0.12, at: t }]),
        grit(20, 0.6, 300, 2500, 0.08, seed(3), { pan: 0.3 }), transient(2500, 0.006, 0.08),
      ];
      case 'cast-line': return [whoosh(1500, 7000, 0.3, 0.25, { pan: -0.3, send: 0.2 }), { type: 'sweep', wave: 'sine', from: 'E6', to: 'B5', dur: 0.25, vol: 0.03, pan: 0.2 }, ...[0.05, 0.09, 0.13, 0.17, 0.21].map((t) => transient(4500, 0.004, 0.1, { at: t, pan: 0.25 })), { type: 'burst', at: 0.55, decay: 0.12, vol: 0.2, bandpass: 1500, q: 0.8, send: 0.3 }, grit(20, 0.2, 1000, 6000, 0.1, seed(1), { at: 0.56, pan: 0.3, send: 0.3 }), { type: 'thump', from: 'G3', to: 'D3', decay: 0.04, vol: 0.1, at: 0.55 }];
      default: return [
        // a bite: the float plunging, water thrashing, the line going taut
        { type: 'sweep', wave: 'sine', from: 'G4', to: 'G3', dur: 0.06, vol: 0.2 }, { type: 'burst', decay: 0.25, vol: 0.35, bandpass: 1200, q: 0.7, send: 0.3 },
        grit(60, 0.5, 800, 6000, 0.16, seed(1), { at: 0.02, pan: -0.35, send: 0.4 }), grit(40, 0.5, 1500, 8000, 0.12, seed(2), { at: 0.1, pan: 0.35, send: 0.4 }),
        { type: 'tone', note: 'E5', dur: 0.3, wave: 'triangle', vol: 0.04, at: 0.15, release: 0.2, tremolo: { rate: 30, depth: 0.7 } }, tail(0.4, 6000, 1200, 0.1, { at: 0.04, send: 0.4 }), transient(2500, 0.008, 0.12),
      ];
    }
  },
};

export const cooking = {
  label: 'a pan sizzling, by its heat (a simmer at 0)',
  sustain: true,
  ordered: [],
  dials: { kind: ['pan'] },
  defaults: { kind: 'pan' },
  idle: 'running',
  build() {
    return { attack: 0.5, release: 0.8, layers: [
      { kind: 'noise', gain: [0.04, 0.4], band: { lo: 2000 }, cutoff: [4500, 9500] },
      { kind: 'noise', gain: [0.02, 0.25], band: { lo: 1200 }, cutoff: [3000, 8000], lfo: { to: 'gain', wave: 'sawtooth', rate: [9, 31], depth: -0.85 }, pan: 0.25 },
      { kind: 'noise', gain: [0.02, 0.15], band: { lo: 2500 }, lfo: { to: 'gain', wave: 'sawtooth', rate: [6.7, 23.3], depth: -0.9 }, pan: -0.25 },
      { kind: 'noise', gain: [0.04, 0.1], band: { lo: 80, hi: 500 }, lfo: { to: 'gain', rate: [1.3, 3.1], depth: 0.6 } },
    ] };
  },
};
