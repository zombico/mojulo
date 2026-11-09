/**
 * families/war — what armies and pilots hear: building (`build`: a tower placed, upgraded, demolished, repaired, by
 * what it is made of), siege (`siege`: a catapult, a cannon, a ballista, a volley of arrows, a war horn), flight
 * (`flight`: a sonic boom, a missile away, an afterburner lit, a warp jump, the gear down, flares out) and the
 * brawl (`brawl`: a grab, a throw, a body slam, an uppercut, a counter, a knockout). Pure.
 */
import { transient, sub, grit, tail, plate, duck, harmonicsOf, whoosh, ringOf, chime, knock, creak } from '../layers.js';

const BUILD = { wood: ['wood', 'C4', 1800], stone: ['wood', 'A3', 1400], metal: ['metal', 'A5', 3500], tech: ['glass', 'E6', 4500] };
export const build = {
  label: 'building: a tower placed, upgraded, demolished, repaired, by its material',
  dials: { act: ['place', 'upgrade', 'demolish', 'repair'], material: Object.keys(BUILD) },
  defaults: { act: 'place', material: 'wood' },
  ordered: [],
  build(d, seed) {
    const [mat, note, lp] = BUILD[d.material], tech = d.material === 'tech';
    const hammer = (t, i) => [transient(4000, 0.006, 0.25, { at: t }), ringOf(d.material === 'metal' ? 'metal' : 'wood', note, 0.08, 0.08, { at: t, pan: i % 2 ? 0.25 : -0.25 }), { type: 'thump', from: 'C3', to: 'G2', decay: 0.05, vol: 0.18, at: t }];
    switch (d.act) {
      case 'place': return [...knock('D2', 'A1', 0.2, 0.5, lp), harmonicsOf({ type: 'thump', from: 'D2', to: 'A1', decay: 0.2, vol: 0.5 }, 0.12, 300), transient(lp * 1.5, 0.012, 0.3), ringOf(mat, note, 0.2, 0.1, { send: 0.3 }),
        grit(30, 0.4, 300, 4000, 0.16, seed(1), { at: 0.03, pan: -0.3, send: 0.35 }), ...hammer(0.35, 0), ...hammer(0.5, 1), sub('C1', 'A0', 0.2, 0.08),
        ...(tech ? [{ type: 'sweep', wave: 'sine', from: 'A4', to: 'A5', dur: 0.3, vol: 0.06, at: 0.1, send: 0.3 }] : [])];
      case 'upgrade': return [...[0, 0.08, 0.16, 0.24].flatMap((t, i) => [transient(3500, 0.006, 0.18, { at: t }), ringOf('metal', ['C6', 'D6', 'E6', 'G6'][i], 0.05, 0.05, { at: t })]),
        ...chime(tech ? 'glass' : 'bell', ['C5', 'E5', 'G5', 'C6'], 0.32, 0.06, 0.6, 0.09), { type: 'sweep', wave: 'triangle', from: 'C4', to: 'C5', dur: 0.3, vol: 0.06, at: 0.3, send: 0.3 },
        ...knock('A2', 'E2', 0.12, 0.35, lp, { at: 0.3 }), grit(20, 0.4, 3000, 11000, 0.1, seed(1), { at: 0.3, pan: 0.3, send: 0.4 })];
      case 'demolish': return [transient(1800, 0.02, 0.45), ...knock('E2', 'A1', 0.3, 0.55, lp), sub('A0', 'E0', 0.5, 0.12), ringOf(mat, note, 0.25, 0.08, { send: 0.4 }),
        creak(d.material === 'metal' ? ['E3', 'G3', 'D3'] : ['A2', 'C3', 'G2'], 0.3, 14, 0.07, seed(1)),
        grit(60, 0.9, 300, 5000, 0.2, seed(2), { at: 0.05, pan: -0.4, send: 0.45 }), grit(40, 0.8, 600, 6000, 0.14, seed(3), { at: 0.1, pan: 0.4, send: 0.45 }), tail(0.9, 2500, 150, 0.14, { at: 0.05, send: 0.6 }), duck(4, 0.2, 0.6)];
      default: return [...hammer(0, 0), ...hammer(0.22, 1), ...hammer(0.44, 2), grit(10, 0.5, 800, 4000, 0.08, seed(1), { pan: 0.2 }), ...(tech ? [{ type: 'tone', note: 'E5', dur: 0.5, wave: 'sine', vol: 0.015, tremolo: { rate: 12, depth: 0.5 }, send: 0.3 }] : [])];
    }
  },
};

export const siege = {
  label: 'siege: a catapult, a cannon, a ballista, a volley of arrows, a war horn',
  dials: { act: ['catapult', 'cannon', 'ballista', 'arrow-volley', 'war-horn'] },
  defaults: { act: 'cannon' },
  ordered: [],
  build(d, seed) {
    switch (d.act) {
      case 'catapult': return [creak(['A1', 'C2', 'B1'], 0.35, 10, 0.09, seed(1)), ...knock('D2', 'G1', 0.25, 0.55, 1200, { at: 0.35 }), transient(1800, 0.02, 0.35, { at: 0.35 }), ringOf('wood', 'D3', 0.2, 0.12, { at: 0.35, send: 0.3 }),
        whoosh(400, 3000, 0.6, 0.25, { at: 0.38, pan: 0.3, send: 0.4 }), sub('C1', 'A0', 0.3, 0.1, { at: 0.35 }), grit(20, 0.3, 500, 3000, 0.12, seed(2), { at: 0.36, pan: -0.3 })];
      case 'cannon': {
        const body = { type: 'thump', from: 'D2', to: 'G0', decay: 0.6, vol: 0.6 };
        return [transient(1200, 0.03, 0.55), body, harmonicsOf(body, 0.16, 250), sub('A0', 'E0', 0.9, 0.12), { type: 'burst', decay: 0.35, vol: 0.5, filterEnv: { from: 5000, to: 200, decay: 0.35 }, send: 0.4 },
          tail(1.6, 2500, 100, 0.22, { at: 0.03, send: 0.7 }), grit(30, 0.6, 600, 4000, 0.12, seed(1), { at: 0.05, pan: 0.35, send: 0.4 }), duck(6, 0.2, 0.9)];
      }
      case 'ballista': return [transient(2500, 0.015, 0.45), ...knock('A2', 'D2', 0.15, 0.5, 1800), { type: 'tone', note: 'A2', dur: 0.4, wave: 'sawtooth', lowpass: 1200, vol: 0.08, release: 0.3, tremolo: { rate: 14, depth: 0.7 }, send: 0.3 },
        whoosh(800, 5000, 0.4, 0.28, { at: 0.02, pan: 0.3, send: 0.35 }), ringOf('wood', 'A3', 0.15, 0.1), grit(10, 0.1, 1500, 6000, 0.12, seed(1), { pan: -0.3 }), sub('C1', 'A0', 0.2, 0.08)];
      case 'arrow-volley': return [
        // a sky of arrows: dozens of strings loosed close together, then the whoosh of them all
        ...Array.from({ length: 10 }, (_, i) => transient(2200 + 150 * i, 0.008, 0.12, { at: 0.018 * i + 0.006 * (i % 3), pan: ((i * 7) % 10) / 10 - 0.45 })),
        grit(80, 0.3, 800, 6000, 0.14, seed(1), { decay: [0.003, 0.012], pan: -0.3, send: 0.3 }),
        whoosh(1200, 8000, 0.9, 0.3, { at: 0.2, pan: -0.2, send: 0.45 }), whoosh(1500, 9000, 0.8, 0.22, { at: 0.3, pan: 0.3, send: 0.45 }),
        grit(120, 0.9, 2500, 10000, 0.1, seed(2), { at: 0.25, decay: [0.004, 0.02], pan: 0.35, send: 0.45 }), { type: 'thump', from: 'C3', to: 'G2', decay: 0.1, vol: 0.18 },
      ];
      default: return [
        { type: 'tone', note: 'D3', to: 'D3', dur: 1.6, wave: 'sawtooth', lowpass: 1500, vol: 0.18, attack: 0.25, release: 0.4, vibrato: { rate: 5, depth: 12 }, send: 0.6 },
        { type: 'tone', note: 'A3', dur: 1.6, wave: 'sawtooth', lowpass: 2200, vol: 0.08, attack: 0.3, release: 0.4, vibrato: { rate: 5.3, depth: 12 }, pan: 0.2, send: 0.6 },
        { type: 'tone', note: 'D2', dur: 1.6, wave: 'square', lowpass: 500, vol: 0.06, attack: 0.25, release: 0.4, send: 0.5 },
        { type: 'burst', decay: 1.6, vol: 0.05, bandpass: 1500, q: 1, send: 0.5 }, transient(1500, 0.02, 0.1), duck(4, 1.2, 0.6),
      ];
    }
  },
};

export const flight = {
  label: 'flight\'s one-shots: a sonic boom, a missile away, an afterburner lit, a warp jump, the gear down, flares out',
  dials: { act: ['sonic-boom', 'missile-launch', 'afterburner', 'warp-jump', 'landing-gear', 'flares'] },
  defaults: { act: 'missile-launch' },
  ordered: [],
  build(d, seed) {
    switch (d.act) {
      case 'sonic-boom': return [transient(800, 0.04, 0.6), { type: 'thump', from: 'A1', to: 'A0', decay: 0.5, vol: 0.55 }, transient(800, 0.03, 0.45, { at: 0.12 }), { type: 'thump', from: 'E1', to: 'E0', decay: 0.4, vol: 0.4, at: 0.12 },
        sub('A0', 'E0', 0.8, 0.12), tail(1.4, 2000, 100, 0.25, { at: 0.02, send: 0.7 }), grit(20, 0.6, 1500, 6000, 0.06, seed(1), { at: 0.15, pan: 0.3 }), duck(7, 0.3, 0.9)];
      case 'missile-launch': return [transient(1500, 0.02, 0.45), ...knock('G2', 'C2', 0.12, 0.45, 2500), { type: 'burst', decay: 1.1, vol: 0.4, filterEnv: { from: 7000, to: 1500, decay: 1.1 }, pan: 0.2, send: 0.45 },
        { type: 'tone', note: 'C3', to: 'G2', dur: 1, wave: 'sawtooth', lowpass: 900, vol: 0.1, attack: 0.05, release: 0.3, send: 0.4 }, grit(60, 1, 800, 5000, 0.12, seed(1), { pan: -0.3, send: 0.4 }), sub('C1', 'A0', 0.3, 0.1), duck(3, 0.2, 0.6)];
      case 'afterburner': return [{ type: 'riser', dur: 0.3, from: 300, to: 4000, q: 1, vol: 0.3, send: 0.3 }, transient(1200, 0.03, 0.45, { at: 0.28 }), { type: 'thump', from: 'E2', to: 'A0', decay: 0.4, vol: 0.5, at: 0.28 },
        { type: 'burst', at: 0.28, decay: 0.9, vol: 0.4, filterEnv: { from: 6000, to: 800, decay: 0.9 }, send: 0.4 }, grit(40, 0.8, 800, 5000, 0.12, seed(1), { at: 0.3, pan: 0.3, send: 0.35 }), sub('A0', 'E0', 0.5, 0.12, { at: 0.28 }), duck(4, 0.2, 0.5)];
      case 'warp-jump': return [{ type: 'riser', dur: 0.8, from: 200, to: 9000, q: 2.5, vol: 0.3, send: 0.4 }, { type: 'tone', note: 'A2', to: 'A6', dur: 0.8, wave: 'sawtooth', lowpass: 6000, vol: 0.06, attack: 0.3, release: 0.05, tremolo: { rate: 20, depth: 0.5 }, send: 0.4 },
        transient(1000, 0.04, 0.55, { at: 0.8 }), { type: 'thump', from: 'E2', to: 'E0', decay: 0.7, vol: 0.55, at: 0.8 }, sub('E0', 'E0', 0.9, 0.12, { at: 0.8 }), grit(50, 0.6, 3000, 12000, 0.14, seed(1), { at: 0.8, pan: 0.35, send: 0.5 }),
        tail(1.2, 8000, 200, 0.18, { at: 0.82, send: 0.7 }), duck(8, 0.3, 1)];
      case 'landing-gear': return [{ type: 'tone', note: 'C3', to: 'G3', dur: 0.6, wave: 'sawtooth', lowpass: 900, vol: 0.06, attack: 0.05, release: 0.1, send: 0.2 }, grit(30, 0.6, 1500, 6000, 0.08, seed(1), { pan: -0.2 }),
        ...knock('A2', 'D2', 0.15, 0.45, 1800, { at: 0.65 }), transient(3500, 0.012, 0.3, { at: 0.65 }), plate('E4', 0.25, 0.06, { at: 0.65, send: 0.3 }), ringOf('metal', 'A5', 0.08, 0.05, { at: 0.7 })];
      default: return [...[0, 0.12, 0.24, 0.36].flatMap((t, i) => [transient(1800, 0.015, 0.3, { at: t, pan: i % 2 ? 0.35 : -0.35 }), { type: 'thump', from: 'C3', to: 'G2', decay: 0.06, vol: 0.25, at: t }, { type: 'burst', at: t + 0.01, decay: 0.5, vol: 0.12, filterEnv: { from: 5000, to: 1200, decay: 0.5 }, pan: i % 2 ? 0.4 : -0.4, send: 0.4 }]),
        grit(40, 0.8, 1500, 8000, 0.1, seed(1), { at: 0.05, send: 0.35 })];
    }
  },
};

export const brawl = {
  label: 'the brawl: a grab, a throw, a body slam, an uppercut, a counter, a knockout',
  dials: { act: ['grab', 'throw', 'body-slam', 'uppercut', 'counter', 'knockout'] },
  defaults: { act: 'uppercut' },
  ordered: [],
  build(d, seed) {
    const blow = (from, to, decay, vol, at = 0) => { const b = { type: 'thump', from, to, decay, vol, at }; return [b, { ...harmonicsOf(b, 0.14, 300), at }, { type: 'burst', at, decay: decay * 0.5, vol: vol * 0.85, lowpass: 2200, send: 0.15 }, transient(2200, 0.01, 0.2, { at })]; };
    switch (d.act) {
      case 'grab': return [grit(20, 0.12, 400, 3500, 0.18, seed(1), { pan: -0.25 }), { type: 'burst', decay: 0.05, vol: 0.3, lowpass: 2500 }, ...knock('C3', 'G2', 0.05, 0.25, 2200), grit(10, 0.08, 1500, 6000, 0.1, seed(2), { at: 0.04, pan: 0.25 }), transient(2000, 0.006, 0.1)];
      case 'throw': return [whoosh(300, 2500, 0.45, 0.35, { pan: -0.3, send: 0.3 }), whoosh(600, 4000, 0.35, 0.2, { at: 0.08, pan: 0.3, send: 0.3 }), grit(16, 0.3, 500, 4000, 0.1, seed(1)), { type: 'thump', from: 'E3', to: 'B2', decay: 0.05, vol: 0.15 }];
      case 'body-slam': return [whoosh(300, 2000, 0.2, 0.15, { pan: -0.2 }), ...blow('E2', 'A0', 0.4, 0.6, 0.18), sub('A0', 'E0', 0.5, 0.12, { at: 0.18 }), plate('A3', 0.4, 0.05, { at: 0.19, send: 0.4 }),
        grit(40, 0.4, 300, 4000, 0.18, seed(1), { at: 0.19, pan: -0.35, send: 0.4 }), tail(0.6, 2000, 150, 0.12, { at: 0.2, send: 0.5 }), duck(5, 0.15, 0.5)];
      case 'uppercut': return [whoosh(400, 4000, 0.15, 0.25, { pan: -0.25, send: 0.2 }), ...blow('A2', 'D2', 0.18, 0.55, 0.1), sub('C1', 'A0', 0.2, 0.1, { at: 0.1 }), grit(14, 0.1, 600, 4000, 0.14, seed(1), { at: 0.11, pan: 0.3 }), duck(2, 0.05, 0.2)];
      case 'counter': return [transient(5000, 0.008, 0.4), ringOf('metal', 'E6', 0.4, 0.08, { send: 0.4 }), ringOf('glass', 'B6', 0.5, 0.05, { pan: 0.3, send: 0.4 }), whoosh(2000, 9000, 0.2, 0.2, { pan: -0.3 }), ...blow('E3', 'A2', 0.1, 0.4, 0.04), grit(20, 0.2, 3000, 11000, 0.12, seed(1), { pan: 0.35, send: 0.35 })];
      default: return [
        // the knockout: the blow, the world slowing (a low boom swelling out), the body down
        whoosh(300, 3000, 0.15, 0.25), ...blow('G2', 'C1', 0.5, 0.65, 0.1), sub('E0', 'E0', 1.2, 0.12, { at: 0.1 }), tail(1.5, 3000, 100, 0.22, { at: 0.12, send: 0.7 }),
        { type: 'tone', note: 'E2', to: 'A1', dur: 1, wave: 'sine', vol: 0.06, at: 0.15, release: 0.4, send: 0.5 }, ...knock('D2', 'A1', 0.2, 0.4, 1200, { at: 0.75 }), grit(30, 0.3, 300, 3000, 0.14, seed(1), { at: 0.76, pan: 0.3, send: 0.4 }), duck(10, 0.6, 1),
      ];
    }
  },
};
