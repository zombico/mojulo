/**
 * families/handling — a weapon worked, not fired: the magazine out and in, the slide or bolt racked, the weapon drawn
 * or switched, the trigger on an empty chamber. Pure. `kind` is what it is worked on: a firearm (metal on metal), an
 * energy weapon (a cell seating, a charge whining up), a mobile suit's arm (the same, at a machine's scale, with its
 * servos). A full reload is a sequence the caller plays: mag-out, then mag-in, then rack.
 */
import { transient, grit } from '../layers.js';

const KIND = ['firearm', 'energy', 'mech'];
// a clack: the metallic contact (a highpassed burst carries metal; a sine ring alone reads as a bongo), a quiet high
// ting, and a small body a hair late so the bright contact leads
const clack = (at, vol, m) => [
  transient(m ? 2600 : 4000, m ? 0.016 : 0.01, vol, { at }),
  { type: 'ring', material: 'metal', note: m ? 'E5' : 'A6', decay: m ? 0.12 : 0.06, vol: 0.06, at, send: 0.15 },
  { type: 'thump', from: m ? 'E2' : 'A3', to: m ? 'A1' : 'E3', decay: m ? 0.08 : 0.03, vol: 0.14, at: at + 0.003 },
];
const servo = (at, dur, up) => ({ type: 'tone', note: up ? 'C3' : 'G3', to: up ? 'G3' : 'C3', dur, wave: 'sawtooth', lowpass: 900, vol: 0.06, attack: 0.02, release: 0.05, at, send: 0.1 });
const slide = (at, over, vol, seed, pan = 0) => grit(Math.round(over * 120), over, 1500, 7000, vol, seed, { at, pan, decay: [0.002, 0.008], send: 0.1 });

export const handling = {
  label: 'a weapon worked: magazine, rack, draw, dry fire',
  dials: { act: ['mag-out', 'mag-in', 'rack', 'switch', 'dry-fire'], kind: KIND },
  defaults: { act: 'mag-in', kind: 'firearm' },
  ordered: [{ dial: 'kind', values: ['firearm', 'mech'], rises: ['ms'], falls: ['centroidHz'] }],
  build(d, seed) {
    const m = d.kind === 'mech', e = d.kind === 'energy';
    const T = m ? 1.8 : 1;   // a machine's hands take longer
    const chirp = (at, up) => ({ type: 'sweep', wave: 'sine', from: up ? 'A4' : 'A5', to: up ? 'A5' : 'A4', dur: 0.08, vol: 0.025, at, send: 0.2 });   // a held tone outweighs the clicks: kept short and soft
    switch (d.act) {
      case 'mag-out': return [...clack(0, 0.28, m), slide(0.012, 0.06 * T, 0.1, seed(1), -0.2), ...(e ? [chirp(0.02, false), { type: 'burst', at: 0.01, decay: 0.08, vol: 0.14, highpass: 5000, pan: 0.2, send: 0.2 }] : []), ...(m ? [servo(0, 0.2, false)] : []),
        { type: 'thump', from: 'D3', to: 'A2', decay: 0.04, vol: 0.06, at: 0.09 * T }];
      case 'mag-in': return [slide(0, 0.05 * T, 0.1, seed(1), 0.2), ...(m ? [servo(0, 0.18, true)] : []), ...clack(0.06 * T, 0.4, m), ...(e ? [chirp(0.08 * T, true), { type: 'tone', note: 'E5', dur: 0.12, wave: 'sine', vol: 0.05, at: 0.1 * T, tremolo: { rate: 30, depth: 0.5 } }] : []),
        grit(4, 0.02, 800, 4000, 0.06, seed(2), { at: 0.06 * T, pan: -0.2 })];
      case 'rack': return [...clack(0, 0.3, m), slide(0.01, 0.06 * T, 0.12, seed(1), -0.25), ...clack(0.12 * T, 0.42, m), slide(0.13 * T, 0.03 * T, 0.08, seed(2), 0.25),
        ...(e ? [{ type: 'sweep', wave: 'sawtooth', from: 'E3', to: 'E5', dur: 0.3, vol: 0.06, at: 0.12, send: 0.2 }] : []), ...(m ? [servo(0, 0.3, true)] : [])];
      case 'switch': return [grit(14, 0.15 * T, 500, 3000, 0.12, seed(1), { pan: -0.2, send: 0.1 }), { type: 'burst', decay: 0.12 * T, vol: 0.1, lowpass: 1800, send: 0.1 },
        ...clack(0.15 * T, 0.32, m), ...(e ? [chirp(0.12, true)] : []), ...(m ? [servo(0, 0.25, true), servo(0.25, 0.15, false)] : [])];
      case 'dry-fire': return [transient(m ? 3000 : 4500, 0.006, 0.25), { type: 'ring', material: 'metal', note: m ? 'B5' : 'E7', decay: 0.04, vol: 0.05, send: 0.1 },
        { type: 'thump', from: m ? 'A2' : 'E3', to: m ? 'E2' : 'B2', decay: 0.025, vol: 0.1 }, grit(3, 0.01, 2000, 8000, 0.05, seed(1)), ...(m ? [servo(0, 0.12, false)] : [])];
      default: return [];
    }
  },
};
