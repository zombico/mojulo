/**
 * families/sports — the sounds of a contest: the ball (`ball`: kicked, bouncing, struck, caught, by the ball it is),
 * the officials' and the venue's (`sport`: a whistle, a bat's crack, the net, a horn, a buzzer, the starter's pistol, a
 * bell), and the crowd (held: its roar by the excitement, idling as a murmur). Pure.
 */
import { transient, sub, grit, tail, duck, harmonicsOf, whoosh, ringOf, lowBody, air } from '../layers.js';

// a ball: its body (by its size and pressure), its slap's lowpass, a hollow ring if it has one, the grit it meets
const BALLS = {
  soccer: { body: ['A2', 'E2', 0.09], slap: 2600, grit: [300, 3000] },
  basketball: { body: ['E2', 'B1', 0.12], slap: 1800, ring: ['metal', 'A2', 0.35], grit: [800, 5000] },
  tennis: { body: ['E3', 'B2', 0.05], slap: 4500, grit: [2000, 9000] },
  golf: { body: ['B3', 'E3', 0.03], slap: 7000, ring: ['metal', 'E6', 0.12], grit: [3000, 10000] },
  baseball: { body: ['D3', 'A2', 0.05], slap: 3500, grit: [1000, 6000] },
  volleyball: { body: ['C3', 'G2', 0.07], slap: 3000, grit: [600, 4000] },
};

export const ball = {
  label: 'a ball kicked, bouncing, struck or caught, by the ball it is',
  dials: { ball: Object.keys(BALLS), act: ['kick', 'bounce', 'hit', 'catch'] },
  defaults: { ball: 'soccer', act: 'kick' },
  ordered: [],
  build(d, seed) {
    const B = BALLS[d.ball], [from, to, decay] = B.body;
    const k = { kick: 1.3, bounce: 0.8, hit: 1.1, catch: 0.7 }[d.act];
    const body = { type: 'thump', from, to, decay: decay * k, vol: 0.35 * k };
    const out = [body, harmonicsOf(body, 0.08 * k, 400), { type: 'burst', decay: 0.03 * k, vol: 0.35 * k, lowpass: B.slap, send: 0.15 }];
    if (d.act === 'kick') out.push(whoosh(500, 3000, 0.08, 0.12, { at: 0, pan: -0.2 }), grit(10, 0.06, B.grit[0], B.grit[1], 0.14, seed(1), { pan: 0.25, send: 0.2 }), sub('E1', 'A0', 0.1, 0.08));
    if (d.act === 'hit') out.push(sub('C1', 'A0', 0.08, 0.06), air(0.2, 0.06), transient(3500, 0.008, 0.35), ringOf(d.ball === 'baseball' ? 'wood' : 'metal', d.ball === 'baseball' ? 'D4' : 'A5', 0.12, 0.08, { send: 0.2 }), grit(6, 0.03, 3000, 10000, 0.12, seed(1), { pan: 0.3 }));
    if (d.act === 'bounce') out.push(transient(2500, 0.006, 0.18), grit(5, 0.03, B.grit[0], B.grit[1], 0.1, seed(1), { pan: -0.2 }));
    if (d.act === 'catch') out.push(grit(12, 0.07, 400, 3000, 0.14, seed(1), { pan: 0.2 }), { type: 'burst', at: 0.03, decay: 0.06, vol: 0.12, lowpass: 1200 }, transient(2000, 0.006, 0.12));
    if (B.ring && d.act !== 'catch') out.push(ringOf(B.ring[0], B.ring[1], B.ring[2], 0.05, { send: 0.3 }));
    return out;
  },
};

export const sport = {
  label: 'the officials and the venue: a whistle, a bat, the net, a horn, a buzzer, the starter, a bell',
  dials: { act: ['whistle', 'whistle-long', 'whistle-triple', 'bat-crack', 'net-swish', 'goal-net', 'horn', 'buzzer', 'starter-pistol', 'bell'] },
  defaults: { act: 'whistle' },
  ordered: [],
  // held tones by nature, not strikes: their crest is not held to the register's
  swells: ['whistle', 'whistle-long', 'whistle-triple', 'buzzer', 'horn'],
  build(d, seed) {
    // a pea whistle: a tone near 3 kHz trilled by the pea (a fast vibrato), breath around it
    const blast = (at, dur) => [
      { type: 'tone', note: 'F#7', dur, wave: 'sine', vol: 0.12, attack: 0.01, release: 0.04, vibrato: { rate: 38, depth: 90 }, at, send: 0.3 },
      { type: 'tone', note: 'F#6', dur, wave: 'triangle', vol: 0.04, attack: 0.01, release: 0.04, vibrato: { rate: 38, depth: 90 }, at },
      { type: 'burst', decay: dur, vol: 0.06, bandpass: 3000, q: 1.5, at, send: 0.2 },
      transient(2500, 0.01, 0.12, { at }),
      { type: 'thump', from: 'A3', to: 'E3', decay: 0.03, vol: 0.08, at },
    ];
    switch (d.act) {
      case 'whistle': return blast(0, 0.25);
      case 'whistle-long': return blast(0, 0.9);
      case 'whistle-triple': return [...blast(0, 0.14), ...blast(0.22, 0.14), ...blast(0.44, 0.6)];
      case 'bat-crack': {
        const body = { type: 'thump', from: 'D3', to: 'A2', decay: 0.06, vol: 0.4 };
        return [transient(3000, 0.012, 0.5), body, harmonicsOf(body, 0.12, 500), ringOf('wood', 'D4', 0.1, 0.16, { send: 0.3 }), ringOf('wood', 'A4', 0.07, 0.1, { send: 0.3 }), grit(8, 0.04, 2000, 9000, 0.12, seed(1), { pan: 0.3 }), tail(0.3, 6000, 800, 0.08, { send: 0.5 })];
      }
      case 'net-swish': return [whoosh(2000, 7000, 0.25, 0.22, { pan: -0.2, send: 0.2 }), grit(30, 0.25, 2000, 9000, 0.16, seed(1), { pan: 0.2, send: 0.2 }), grit(12, 0.2, 800, 3000, 0.1, seed(2)), { type: 'thump', from: 'A3', to: 'E3', decay: 0.04, vol: 0.1 }];
      case 'goal-net': return [{ type: 'burst', decay: 0.15, vol: 0.3, lowpass: 2500, send: 0.3 }, grit(40, 0.4, 800, 6000, 0.18, seed(1), { pan: -0.3, send: 0.3 }), grit(30, 0.5, 400, 3000, 0.14, seed(2), { pan: 0.3, send: 0.3 }), { type: 'thump', from: 'A2', to: 'E2', decay: 0.12, vol: 0.3 }, transient(2500, 0.01, 0.15)];
      case 'horn': return [
        { type: 'tone', note: 'A3', dur: 1.2, wave: 'sawtooth', lowpass: 2400, vol: 0.18, attack: 0.04, release: 0.2, send: 0.5 },
        { type: 'tone', note: 'C#4', dur: 1.2, wave: 'sawtooth', lowpass: 2400, vol: 0.14, attack: 0.04, release: 0.2, pan: 0.2, send: 0.5 },
        { type: 'tone', note: 'A2', dur: 1.2, wave: 'square', lowpass: 600, vol: 0.12, attack: 0.04, release: 0.2, send: 0.4 },
        transient(1500, 0.02, 0.15), duck(4, 1, 0.5),
      ];
      case 'buzzer': return [
        { type: 'tone', note: 'A#2', dur: 0.8, wave: 'square', lowpass: 3000, vol: 0.16, attack: 0.005, release: 0.03, tremolo: { rate: 60, depth: 0.5 }, send: 0.4 },
        { type: 'tone', note: 'A#3', dur: 0.8, wave: 'sawtooth', lowpass: 4000, vol: 0.08, attack: 0.005, release: 0.03, send: 0.4 },
        transient(2000, 0.01, 0.15), { type: 'thump', from: 'A#1', to: 'A#1', decay: 0.1, vol: 0.12 },
      ];
      case 'starter-pistol': return [transient(1500, 0.02, 0.55), { type: 'burst', decay: 0.12, vol: 0.4, lowpass: 5000, send: 0.4 }, { type: 'thump', from: 'C3', to: 'C2', decay: 0.08, vol: 0.35 }, tail(0.9, 4000, 300, 0.15, { at: 0.02, send: 0.7 }), grit(6, 0.05, 3000, 9000, 0.1, seed(1))];
      default: return [lowBody(0.3), air(0.14, 0.3), ringOf('bell', 'E5', 0.8, 0.08, { send: 0.4 }), ringOf('metal', 'E6', 0.6, 0.06, { pan: 0.2 }), transient(3000, 0.008, 0.35), { type: 'thump', from: 'E2', to: 'B1', decay: 0.12, vol: 0.3 }, grit(10, 0.08, 3000, 11000, 0.14, seed(1), { pan: 0.25 }), ringOf('bell', 'E5', 0.8, 0.065, { at: 0.35, send: 0.4 }), transient(3000, 0.008, 0.28, { at: 0.35 }), { type: 'thump', from: 'E2', to: 'B1', decay: 0.12, vol: 0.24, at: 0.35 }];
    }
  },
};

export const crowd = {
  label: 'a crowd by its excitement: a murmur idling, a roar at the top',
  sustain: true,
  ordered: [],
  dials: { kind: ['stadium', 'arena', 'hall'] },
  defaults: { kind: 'stadium' },
  idle: 'running',
  build(d) {
    const big = { stadium: 1, arena: 0.8, hall: 0.55 }[d.kind];
    return { attack: 0.6, release: 1.2, send: 0.4 * big, layers: [
      // the murmur: voices as bands of noise breathing at their own slow rates
      { kind: 'noise', gain: [0.08, 0.25], band: { lo: 250, hi: 2500 }, cutoff: [1200, 3500], lfo: { to: 'gain', rate: [0.3, 0.7], depth: 0.3 }, pan: -0.3 },
      { kind: 'noise', gain: [0.07, 0.22], band: { lo: 400, hi: 3500 }, cutoff: [1500, 4500], lfo: { to: 'gain', rate: [0.43, 0.9], depth: 0.3 }, pan: 0.3 },
      // the roar: the whole room's breath rising with it
      { kind: 'noise', gain: [0, 0.5 * big], band: { lo: 150 }, cutoff: [900, 6000] },
      { kind: 'noise', gain: [0, 0.12], band: { lo: 3000 }, lfo: { to: 'gain', rate: [2, 6], depth: 0.5 }, pan: 0.2 },
      { kind: 'noise', gain: [0.02, 0.2 * big], band: { hi: 300 } },
    ] };
  },
};
