/**
 * families/impact — one thing meeting another: a round landing, a body hitting the ground, a fist on a door, by the
 * material struck and the weight behind it. Pure.
 *
 * Material is the character (a card each: what its transient, its ring, its grit and its tail are); weight is the
 * scale: a heavier blow is lower, longer and louder. `armor` is a machine's plating taking a hit; `energy` a shield's
 * field taking one.
 */
import { transient, sub, grit, tail, plate, harmonicsOf } from '../layers.js';

const WEIGHT = ['light', 'medium', 'heavy'];
const lower = (notes, w) => notes[Math.min(w, notes.length - 1)];

// a material: its transient (highpass Hz, or a lowpassed thud), its body notes by weight, its ring, its grit band
const CARDS = {
  metal: { hp: 4000, body: [['E3', 'A2'], ['A2', 'D2'], ['D2', 'G1']], ring: { kind: 'plate', notes: ['A5', 'D5', 'G4'], decay: [0.25, 0.4, 0.6] }, grit: [2000, 9000, 8] },
  armor: { hp: 3000, body: [['C3', 'G2'], ['G2', 'C2'], ['C2', 'F1']], ring: { kind: 'plate', notes: ['E4', 'A3', 'D3'], decay: [0.18, 0.3, 0.45] }, grit: [1500, 7000, 10], clank: 1800 },
  stone: { hp: 2500, body: [['D3', 'A2'], ['A2', 'E2'], ['E2', 'A1']], grit: [400, 4000, 22], dust: true },
  wood: { hp: 2000, body: [['G3', 'D3'], ['D3', 'A2'], ['A2', 'E2']], ring: { kind: 'wood', notes: ['G4', 'D4', 'A3'], decay: [0.1, 0.12, 0.16] }, grit: [500, 3500, 10] },
  dirt: { thud: 2500, body: [['A2', 'E2'], ['E2', 'A1'], ['A1', 'E1']], grit: [150, 1800, 30], dust: true },
  flesh: { thud: 1800, body: [['C3', 'G2'], ['G2', 'D2'], ['D2', 'A1']], grit: [300, 1500, 6] },
  water: { splash: true, body: [['C5', 'C4'], ['G4', 'G3'], ['C4', 'C3']], grit: [800, 6000, 40] },
  energy: { hp: 3000, shimmer: ['E5', 'B4'], body: [['A3', 'E3'], ['E3', 'A2'], ['A2', 'E2']], ring: { kind: 'glass', notes: ['E6', 'B5', 'E5'], decay: [0.3, 0.4, 0.5] }, grit: [2500, 11000, 14] },
};

export const impact = {
  label: 'an impact, by the material struck and the weight behind it',
  dials: { material: Object.keys(CARDS), weight: WEIGHT },
  defaults: { material: 'stone', weight: 'medium' },
  ordered: [{ dial: 'weight', rises: ['ms'], falls: ['centroidHz'] }],
  build(d, seed) {
    const C = CARDS[d.material], w = WEIGHT.indexOf(d.weight), s = 1 + 0.5 * w;
    const [from, to] = C.body[w];
    const out = [];
    if (C.hp) out.push(transient(C.hp, 0.01 + 0.004 * w, 0.32 + 0.06 * w));
    if (C.thud) out.push({ type: 'burst', decay: 0.04 * s, vol: 0.4 + 0.06 * w, lowpass: C.thud, send: 0.1 });
    if (C.splash) {
      out.push({ type: 'sweep', wave: 'sine', from, to, dur: 0.06 * s, vol: 0.25, send: 0.1 });
      out.push({ type: 'burst', decay: 0.2 * s, vol: 0.35, bandpass: 1200, q: 0.7, send: 0.3 });
      out.push(tail(0.5 * s, 7000, 1500, 0.12, { at: 0.04, send: 0.4 }));
    } else {
      const body = { type: 'thump', from, to, decay: 0.12 * s, vol: 0.38 + 0.05 * w };
      out.push(body, harmonicsOf(body, 0.1 + 0.03 * w, 400));
    }
    if (w > 0) out.push(sub(lower(['E1', 'C1', 'A0'], w), 'A0', 0.15 + 0.15 * w, 0.07 + 0.04 * w));
    if (C.ring) {
      const r = C.ring, note = r.notes[w], decay = r.decay[w];
      out.push(r.kind === 'plate' ? plate(note, decay, 0.06 + 0.01 * w, { send: 0.35 }) : { type: 'ring', material: r.kind, note, decay, vol: 0.12, send: 0.3 });
    }
    if (C.clank) out.push({ type: 'burst', at: 0.004, decay: 0.03 * s, vol: 0.18, bandpass: C.clank, q: 2, send: 0.2 });
    if (C.shimmer) out.push({ type: 'tone', note: C.shimmer[0], to: C.shimmer[1], dur: 0.25 * s, wave: 'sine', vol: 0.12, tremolo: { rate: 30, depth: 0.6 }, send: 0.4 });
    const [lo, hi, n] = C.grit;
    out.push(grit(Math.round(n * s), 0.12 * s, lo, hi, 0.2 + 0.03 * w, seed(1), { at: 0.01, pan: -0.35, send: 0.35 }));
    out.push(grit(Math.round(n * s * 0.7), 0.1 * s, lo, hi, 0.15 + 0.03 * w, seed(2), { at: 0.02, pan: 0.35, send: 0.35 }));
    if (C.dust) out.push(tail(0.3 * s, 3000, 300, 0.18, { at: 0.02, send: 0.5 }));
    return out;
  },
};
