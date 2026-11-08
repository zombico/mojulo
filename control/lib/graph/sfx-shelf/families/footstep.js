/**
 * families/footstep — one footfall, by the surface under it and the body making it. Pure.
 *
 * The body is the weight: a person's step is a short dull knock, a heavy trooper's longer, a mobile suit's a thump
 * with its frame clanking and its ankle's hydraulics breathing out, a giant's a quake. The surface is the texture: a
 * scuff on concrete, a ring on metal, a crunch in gravel, a swish in grass, a squeak in snow, a splash in water. One
 * cue is one footfall; the cadence is the gait's (the audio channel fires a step on each half gait).
 */
import { transient, sub, grit, tail, plate, harmonicsOf } from '../layers.js';

const BODY = ['human', 'heavy', 'mech', 'giant'];
const KNOCK = [['D3', 'A2', 0.04, 0.15], ['G2', 'D2', 0.07, 0.22], ['C2', 'E1', 0.12, 0.3], ['F1', 'B0', 0.2, 0.4]];

// a surface: its transient, its ring, its grit (lo, hi, grains, over), whether it splashes or lowpasses the knock
const SURFACES = {
  concrete: { hp: 2500, grit: [1000, 6000, 5, 0.03] },
  metal: { hp: 3500, ring: ['metal', 'A4', 0.12], grit: [2000, 8000, 4, 0.03] },
  dirt: { thud: 2200, grit: [200, 2000, 9, 0.05] },
  grass: { grit: [1500, 7000, 14, 0.09], soft: true },
  gravel: { hp: 1800, grit: [500, 5000, 18, 0.06] },
  wood: { hp: 1600, ring: ['wood', 'C4', 0.08], grit: [700, 3500, 4, 0.03] },
  snow: { thud: 1800, grit: [300, 2500, 16, 0.1], squeak: true },
  water: { splash: true, grit: [800, 5000, 16, 0.12] },
};

export const footstep = {
  label: 'a footfall, by the surface and the body',
  dials: { surface: Object.keys(SURFACES), body: BODY },
  defaults: { surface: 'concrete', body: 'human' },
  ordered: [{ dial: 'body', rises: ['ms'], falls: ['centroidHz'] }],
  build(d, seed) {
    const S = SURFACES[d.surface], b = BODY.indexOf(d.body), s = 1 + 0.6 * b, [from, to, decay, vol] = KNOCK[b];
    const knock = { type: 'thump', from, to, decay, vol, ...(S.soft ? { vol: vol * 0.7 } : {}) };
    const out = [knock, harmonicsOf(knock, 0.06 + 0.03 * b, 350)];
    if (S.hp) out.push(transient(S.hp, 0.008 + 0.004 * b, 0.12 + 0.04 * b));
    if (S.thud) out.push({ type: 'burst', decay: 0.03 * s, vol: 0.2 + 0.05 * b, lowpass: S.thud, send: 0.1 });
    if (S.ring) out.push({ type: 'ring', material: S.ring[0], note: S.ring[1], decay: S.ring[2] * s, vol: 0.08, send: 0.25 });
    if (S.splash) out.push({ type: 'burst', decay: 0.12 * s, vol: 0.22, bandpass: 1500, q: 0.8, send: 0.3 });
    if (S.squeak) out.push({ type: 'sweep', wave: 'triangle', from: 'C6', to: 'G5', dur: 0.04, vol: 0.025, at: 0.02, send: 0.1 });
    const [lo, hi, n, over] = S.grit;
    out.push(grit(Math.round(n * (1 + 0.4 * b)), over * s, lo, hi, 0.15 + 0.05 * b, seed(1), { pan: -0.25, send: 0.25 }));
    // the second train an octave up: the surface's bright edge (the crunch's top, the scuff's hiss)
    out.push(grit(Math.round(n * 0.6 * (1 + 0.4 * b)), over * s, lo * 2, Math.min(12000, hi * 2), 0.1 + 0.04 * b, seed(2), { at: 0.01, pan: 0.25, send: 0.25 }));
    if (b >= 1) out.push(sub(['E1', 'C1', 'A0'][b - 1], 'A0', 0.12 + 0.1 * b, 0.05 + 0.04 * b));
    if (b >= 2) {
      // a machine's foot: its frame clanking, then its ankle's hydraulics breathing out
      out.push(plate(b === 2 ? 'D4' : 'A3', 0.12 * s, 0.05, { at: 0.005, send: 0.25 }));
      out.push({ type: 'burst', at: 0.05 * s, decay: 0.05 * s, vol: 0.05, highpass: 3000, pan: 0.2, send: 0.2 });
    }
    if (b === 3) out.push(tail(0.6, 1200, 80, 0.12, { at: 0.03, lowpass: 400, send: 0.5 }));
    return out;
  },
};
