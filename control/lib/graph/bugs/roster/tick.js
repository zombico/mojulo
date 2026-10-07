// CASTOR BEAN TICK female, unfed (Ixodes ricinus). Thesis: ONE flat body (the idiosoma: no head, no waist, no
// segments), a TEARDROP from above — narrow in front, broad and rounded behind — and thin as a seed in profile · the
// CAPITULUM sticking straight forward from its narrow front: a small basis and long club palps either side of the
// barbed hypostome, the only "head" · a dark shield (scutum) over the front third, the rest red-brown · EIGHT legs, all
// from the front half of the body, jointed and spread, the first pair reaching forward past the mouthparts, the fourth
// back · no eyes, no antennae, no wings · 3–4 mm with the capitulum, the idiosoma ~3 × 1.6 mm (Hillyard 1996, Ticks of
// North-West Europe, Synopses of the British Fauna 52).
export const bug = {
  order: 'Ixodida',
  name: 'a castor bean tick',
  length: 0.0036,
  clearance: 0.05,
  // the capitulum as a small forward "head": basis capituli + palps, the hypostome the mouth
  head: { form: 'prognathous', len: 0.22, w: 0.065, h: 0.04, pitch: -4, lift: 0, r0: 1, peak: 0.25, r1: 0.55, overlap: 0.05 },
  trunk: { form: 'cephalothorax', len: 0.62, w: 0.28, h: 0.1, r0: 0.95, peak: 0.25, r1: 0.35, p: 0.7, q: 0.9, arch: 0.01, samples: 10 },
  tail: { form: 'sac', len: 0.25, w: 0.28, h: 0.09, r0: 0.97, peak: 0.0, r1: 0.7, p: 0.7, q: 0.5, pitch: 0, waist: null, overhang: 0.06 },
  waist: null,
  legs: {
    form: 'spider', reach: 0.5, thick: 0.7, socket: -55, angles: { coxa: -15, femur: 20, tibia: -35, tarsus: -12 },
    each: [
      { yaw: 68, at: 0.3, reach: 0.62 },
      { yaw: 25, at: 0.42 },
      { yaw: -15, at: 0.54 },
      { yaw: -48, at: 0.66, reach: 0.56 },
    ],
  },
  antennae: null,
  mouth: { form: 'snout', len: 0.12, r: 0.02, end: 0.5, pitch: -6 },
  eyes: 'none',
  colors: { body: '#7a3420', trunk: '#7a3420', tail: '#7a3420', head: '#2a1b14', legs: '#2e211a', mouth: '#2a1b14' },
  markings: [{ on: 'trunk', kind: 'band', run: [0.55, 1], t: [0, 0.32], group: 'Scutum', color: '#231711' }],
};
