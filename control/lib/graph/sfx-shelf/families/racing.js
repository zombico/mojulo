/**
 * families/racing — what a road and a race sound like besides the engine (held.js `engine`): tyres held at their
 * slip (`tires`: a squeal on asphalt, a churn on dirt, a crunch on gravel; rolling on the `road`, its roar and the wind), a crash by its severity (`crash`), and
 * the machine's own one-shots (`motoring`: a gear change, a horn, a boost, a backfire, a door). Pure.
 */
import { transient, sub, grit, tail, plate, duck, harmonicsOf, whoosh, ringOf } from '../layers.js';

export const tires = {
  label: 'tyres held at their slip, by the surface',
  sustain: true,
  ordered: [],
  dials: { surface: ['asphalt', 'dirt', 'gravel', 'road'] },
  defaults: { surface: 'asphalt' },
  idle: 'silent',
  build(d) {
    if (d.surface === 'dirt') return { attack: 0.08, release: 0.25, layers: [
      { kind: 'noise', gain: [0, 0.45], band: { lo: 150 }, cutoff: [700, 3000], lfo: { to: 'gain', wave: 'sawtooth', rate: [9, 24], depth: -0.6 } },
      { kind: 'noise', gain: [0, 0.18], band: { lo: 1500 }, cutoff: [3000, 7000], lfo: { to: 'gain', wave: 'sawtooth', rate: [13, 31], depth: -0.8 }, pan: 0.25 },
      { kind: 'noise', gain: [0, 0.15], band: { hi: 250 }, pan: -0.2 },
    ] };
    // (ROLLING, `road`: no slip, the tyres' roar on the asphalt and the wind past the body, by the speed: a car's road noise)
    if (d.surface === 'road') return { attack: 0.3, release: 0.4, layers: [
      { kind: 'noise', gain: [0, 0.32], band: { lo: 60, hi: 700 }, cutoff: [250, 900], q: 0.4 },
      { kind: 'noise', gain: [0, 0.16], band: { lo: 700 }, cutoff: [1200, 4500], q: 0.3, pan: 0.15, lfo: { to: 'gain', rate: [0.4, 1.3], depth: 0.25 } },
      { kind: 'osc', wave: 'sine', pitch: [40, 95], gain: [0, 0.08] },
    ] };
    if (d.surface === 'gravel') return { attack: 0.06, release: 0.2, layers: [
      { kind: 'noise', gain: [0, 0.4], band: { lo: 400 }, cutoff: [2000, 6000], lfo: { to: 'gain', wave: 'sawtooth', rate: [20, 45], depth: -0.9 } },
      { kind: 'noise', gain: [0, 0.25], band: { lo: 900 }, cutoff: [3000, 8000], lfo: { to: 'gain', wave: 'sawtooth', rate: [27, 59], depth: -0.9 }, pan: 0.3 },
      { kind: 'noise', gain: [0, 0.15], band: { lo: 100, hi: 600 }, pan: -0.25 },
    ] };
    return { attack: 0.05, release: 0.18, layers: [
      // the squeal: rubber's stick-slip, a tone wavering near 1 kHz, rising as it slides harder
      { kind: 'osc', wave: 'sine', pitch: [850, 1500], gain: [0, 0.14], lfo: { to: 'pitch', rate: [6, 11], depth: 45 } },
      { kind: 'osc', wave: 'triangle', pitch: [1700, 3000], gain: [0, 0.05], lfo: { to: 'pitch', rate: [7.3, 12.7], depth: 45 }, pan: 0.2 },
      { kind: 'noise', gain: [0, 0.3], band: { lo: 1500 }, cutoff: [3000, 8000], pan: -0.2 },
      { kind: 'noise', gain: [0, 0.12], band: { lo: 80, hi: 400 } },
    ] };
  },
};

const SEVERITY = ['light', 'medium', 'heavy'];
export const crash = {
  label: 'a vehicle crashing, by how hard',
  dials: { severity: SEVERITY },
  defaults: { severity: 'medium' },
  ordered: [{ dial: 'severity', rises: ['ms'], falls: ['centroidHz'] }],
  build(d, seed) {
    const k = SEVERITY.indexOf(d.severity), s = 1 + 0.6 * k;
    const body = { type: 'thump', from: ['C3', 'G2', 'D2'][k], to: ['G2', 'D2', 'G1'][k], decay: 0.15 * s, vol: 0.45 + 0.1 * k };
    return [
      transient(3000 - 600 * k, 0.015, 0.5 - 0.05 * k), body, harmonicsOf(body, 0.14, 300), sub('C1', 'A0', 0.2 * s, 0.08 + 0.05 * k),
      plate(['A4', 'E4', 'A3'][k], 0.3 * s, 0.08, { send: 0.4 }), plate(['D5', 'A4', 'D4'][k], 0.25 * s, 0.06, { at: 0.03, pan: 0.3, send: 0.4 }),
      grit(Math.round(20 * s), 0.3 * s, 2500, 11000, 0.2, seed(1), { at: 0.02, pan: -0.4, send: 0.4 }),
      grit(Math.round(14 * s), 0.4 * s, 800, 5000, 0.16, seed(2), { at: 0.05, pan: 0.4, send: 0.4 }),
      ...[0.18, 0.31, 0.43].slice(0, k + 1).map((t, i) => transient(3500, 0.01, 0.14 - 0.03 * i, { at: t * s, pan: [0.3, -0.35, 0.1][i], send: 0.3 })),
      tail(0.4 * s, 4000, 300, 0.12, { at: 0.04, send: 0.5 }),
      duck(3 + 2 * k, 0.1 * s, 0.4 * s),
    ];
  },
};

export const motoring = {
  label: 'a machine\'s own one-shots: a gear change, a horn, a boost, a backfire, a door shut and opened, the engine started and stopped, the brakes',
  dials: { act: ['gear-shift', 'horn', 'truck-horn', 'boost', 'backfire', 'door-slam', 'door-open', 'ignition', 'engine-off', 'brake-squeal'] },
  defaults: { act: 'gear-shift' },
  ordered: [],
  swells: ['horn', 'truck-horn', 'brake-squeal'],   // held tones, not strikes
  build(d, seed) {
    switch (d.act) {
      case 'horn': return [
        { type: 'tone', note: 'E4', dur: 0.5, wave: 'square', lowpass: 3200, vol: 0.12, attack: 0.01, release: 0.05, send: 0.3 },
        { type: 'tone', note: 'G#4', dur: 0.5, wave: 'square', lowpass: 3200, vol: 0.1, attack: 0.01, release: 0.05, pan: 0.2, send: 0.3 },
        { type: 'tone', note: 'E3', dur: 0.5, wave: 'sawtooth', lowpass: 900, vol: 0.08, attack: 0.01, release: 0.05 },
        transient(2000, 0.01, 0.1),
      ];
      case 'truck-horn': return [
        { type: 'tone', note: 'A2', dur: 1.1, wave: 'sawtooth', lowpass: 2000, vol: 0.18, attack: 0.05, release: 0.2, vibrato: { rate: 4, depth: 6 }, send: 0.5 },
        { type: 'tone', note: 'C#3', dur: 1.1, wave: 'sawtooth', lowpass: 2000, vol: 0.14, attack: 0.05, release: 0.2, pan: 0.25, send: 0.5 },
        { type: 'tone', note: 'E3', dur: 1.1, wave: 'sawtooth', lowpass: 2000, vol: 0.12, attack: 0.05, release: 0.2, pan: -0.25, send: 0.5 },
        { type: 'tone', note: 'A1', dur: 1.1, wave: 'square', lowpass: 500, vol: 0.1, attack: 0.05, release: 0.2 }, transient(1200, 0.02, 0.12),
      ];
      case 'boost': return [whoosh(800, 9000, 0.6, 0.35, { pan: -0.2, send: 0.35 }), { type: 'sweep', wave: 'sawtooth', from: 'A2', to: 'A4', dur: 0.5, vol: 0.1, send: 0.3 }, grit(30, 0.5, 2000, 10000, 0.14, seed(1), { pan: 0.3, send: 0.3 }), sub('A1', 'E1', 0.4, 0.12), transient(2500, 0.015, 0.25)];
      case 'backfire': return [transient(1200, 0.02, 0.5), { type: 'burst', decay: 0.1, vol: 0.4, lowpass: 3000, send: 0.3 }, { type: 'thump', from: 'G2', to: 'C2', decay: 0.12, vol: 0.4 }, tail(0.5, 3000, 200, 0.12, { at: 0.02, send: 0.6 }), grit(8, 0.08, 1500, 7000, 0.1, seed(1))];
      case 'door-slam': {
        const body = { type: 'thump', from: 'A2', to: 'D2', decay: 0.12, vol: 0.5 };
        return [{ type: 'burst', decay: 0.06, vol: 0.35, lowpass: 2000, send: 0.2 }, body, harmonicsOf(body, 0.12, 300), plate('E4', 0.18, 0.05, { send: 0.3 }), transient(3500, 0.01, 0.25, { at: 0.005 }), ringOf('metal', 'A5', 0.08, 0.05, { at: 0.01 }), grit(6, 0.05, 1000, 5000, 0.1, seed(1), { pan: 0.25 })];
      }
      // A DOOR OPENED: the latch let go, the door's weight swinging on its hinge, a little ring of the panel
      case 'door-open': return [transient(4200, 0.008, 0.22), { type: 'thump', from: 'C3', to: 'A2', decay: 0.05, vol: 0.18 }, ringOf('metal', 'C6', 0.05, 0.035, { at: 0.004 }), grit(5, 0.12, 900, 3500, 0.05, seed(2), { at: 0.03, pan: 0.15 })];
      // THE ENGINE STARTED: the starter turning it over, four cranks under the starter's whine, then it catches with a burst
      // and a blip of revs that settles toward the idle
      case 'ignition': return [
        { type: 'sweep', wave: 'sawtooth', from: 'D3', to: 'F3', dur: 0.62, vol: 0.05, lowpass: 2200, send: 0.1 },
        ...[0, 0.15, 0.3, 0.45].map((at, k) => ({ type: 'thump', from: 'E2', to: 'B1', decay: 0.07, vol: 0.2 + k * 0.03, at })),
        grit(10, 0.55, 600, 2400, 0.08, seed(3), { pan: -0.1 }),
        { type: 'burst', decay: 0.12, vol: 0.3, lowpass: 1800, at: 0.62, send: 0.2 },
        { type: 'thump', from: 'A2', to: 'E2', decay: 0.18, vol: 0.35, at: 0.62 },
        { type: 'sweep', wave: 'sawtooth', from: 'A2', to: 'E3', dur: 0.28, vol: 0.12, lowpass: 2600, at: 0.64 },
        { type: 'sweep', wave: 'sawtooth', from: 'E3', to: 'B2', dur: 0.45, vol: 0.08, lowpass: 2000, at: 0.92 },
      ];
      // THE ENGINE STOPPED: its note falling away under the last of its firing, a click as it dies, a tick or two as it cools
      case 'engine-off': return [
        { type: 'sweep', wave: 'sawtooth', from: 'B2', to: 'D1', dur: 0.55, vol: 0.12, lowpass: 1600 },
        grit(6, 0.45, 300, 1500, 0.06, seed(4)), transient(3000, 0.01, 0.12, { at: 0.55 }),
        ringOf('metal', 'G6', 0.03, 0.02, { at: 1.1, pan: 0.3 }), ringOf('metal', 'D7', 0.03, 0.015, { at: 1.6, pan: -0.2 }),
      ];
      // THE BRAKES: the pads' squeal on the discs, a high wavering note over a hiss, fading as the car slows
      case 'brake-squeal': return [
        { type: 'tone', note: 'E6', dur: 0.75, wave: 'sine', vol: 0.04, attack: 0.04, release: 0.3, vibrato: { rate: 9, depth: 18 }, send: 0.15 },
        { type: 'tone', note: 'G7', dur: 0.6, wave: 'triangle', vol: 0.04, attack: 0.05, release: 0.25, vibrato: { rate: 11, depth: 24 }, pan: 0.2 },
        grit(14, 0.6, 2500, 8000, 0.25, seed(5), { pan: -0.15 }),
        // (the tyres scrubbing the road under it)
        { type: 'burst', decay: 0.55, vol: 0.4, lowpass: 450, send: 0.1 },
        // (the pads' grab and the car's weight pitching onto its nose)
        transient(1800, 0.02, 0.12),
        { type: 'thump', from: 'C2', to: 'G1', decay: 0.28, vol: 0.14 },
      ];
      default: return [transient(3200, 0.012, 0.3), { type: 'thump', from: 'D3', to: 'A2', decay: 0.05, vol: 0.25 }, ringOf('metal', 'E5', 0.08, 0.06), grit(6, 0.04, 1500, 6000, 0.1, seed(1), { pan: -0.2 }), transient(2600, 0.01, 0.2, { at: 0.07 }), { type: 'thump', from: 'A2', to: 'E2', decay: 0.05, vol: 0.18, at: 0.07 }, whoosh(600, 2500, 0.15, 0.06, { at: 0.08, pan: 0.2 })];
    }
  },
};
