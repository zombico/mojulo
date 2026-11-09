/**
 * families/explosion — a blast, from a grenade's pop to a mobile suit's wreck going up. Pure.
 *
 * The layers: a crack (the shock front), a body thump and its harmonics, a sub boom, the blast's noise darkening as it
 * spends itself, debris thrown both ways, a fire crackling on for the big ones, a rumble rolling into the space, and
 * the score ducking by the size. `metal` adds what a machine's wreck has that a shell's burst does not: plates
 * ringing as it comes apart, and pieces clanking down after.
 */
import { transient, sub, grit, tail, plate, duck, harmonicsOf } from '../layers.js';

const SIZE = ['small', 'medium', 'large', 'huge'];
const BODY = [['A2', 'A1'], ['E2', 'E1'], ['B1', 'B0'], ['F#1', 'F#0']];
const BOOM = [['E1', 'A0'], ['C1', 'G0'], ['A0', 'E0'], ['F#0', 'C0']];

export const explosion = {
  label: 'a blast, by its size',
  dials: { size: SIZE, debris: [true, false], metal: [false, true] },
  defaults: { size: 'medium', debris: true, metal: false },
  ordered: [{ dial: 'size', rises: ['ms'], falls: ['centroidHz'] }],
  build(d, seed) {
    const k = SIZE.indexOf(d.size);
    const body = { type: 'thump', from: BODY[k][0], to: BODY[k][1], decay: 0.25 + 0.2 * k, vol: 0.5 + 0.08 * k };
    const out = [
      transient(2400 - 450 * k, 0.02, 0.5 - 0.06 * k),   // the bigger the blast, the darker its crack
      body,
      harmonicsOf(body, 0.14 + 0.03 * k),
      sub(BOOM[k][0], BOOM[k][1], 0.4 + 0.35 * k, 0.12 + 0.04 * k),
      tail(0.25 + 0.35 * k, 6000 - 800 * k, 250, 0.5 + 0.06 * k, { send: 0.4 }),
      tail(0.8 + 0.6 * k, 900, 80, 0.18 + 0.05 * k, { at: 0.05, lowpass: 300, send: 0.6 }),
    ];
    if (d.debris) {
      out.push(grit(15 + 15 * k, 0.3 + 0.4 * k, 300, 5000, 0.26, seed(1), { at: 0.05, pan: -0.5, send: 0.45 }));
      out.push(grit(12 + 12 * k, 0.25 + 0.35 * k, 500, 6500, 0.22, seed(2), { at: 0.08, pan: 0.5, send: 0.45 }));
    }
    if (k >= 2) out.push(grit(25 + 10 * k, 0.8 + 0.5 * k, 600, 4000, 0.16, seed(3), { at: 0.15, decay: [0.003, 0.012], send: 0.35 }));
    if (d.metal) {
      out.push(plate('C3', 0.9, 0.08, { at: 0.01, send: 0.5 }));
      out.push(plate('F#3', 0.6, 0.06, { at: 0.04, pan: 0.3, send: 0.5 }));
      for (const [i, t] of [0.32, 0.47, 0.61].entries()) out.push(transient(3200, 0.012, 0.16 - 0.03 * i, { at: t + 0.1 * k, pan: [-0.4, 0.35, -0.1][i], send: 0.3 }));
    }
    out.push(duck(4 + 3 * k, 0.1 + 0.1 * k, 0.4 + 0.4 * k));
    return out;
  },
};
