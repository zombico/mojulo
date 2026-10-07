// CAT FLEA female (Ctenocephalides felis). Thesis: a body FLATTENED SIDE TO SIDE — in profile a tall oval, about half
// as tall as long, seen head-on a narrow blade; a small helmet head (face down, no neck) flowing into a short thorax
// and a big rounded abdomen of visible plates, the back one smooth arch · no wings · tiny antennae tucked in grooves,
// a short piercing beak pointing down · six legs held under the body in its own plane (not sprawled), the HIND legs
// the biggest: a broad coxa, the femur along the flank, the tibia and a long tarsus folded back under it (the spring)
// · dark red-brown · female 2.5 mm, male ~2 mm (Bitam et al. 2010, Fleas and flea-borne diseases, Int J Infect Dis
// 14: e667; Dryden & Rust 1994, The cat flea, Vet Parasitol 52: 1–19).
export const bug = {
  order: 'Siphonaptera',
  name: 'a cat flea',
  length: 0.0025,
  clearance: 0.17,
  head: { form: 'hypognathous', len: 0.18, w: 0.065, h: 0.14, pitch: -50, lift: 0.03, r0: 0.7, peak: 0.45, r1: 0.6 },
  trunk: { form: 'compact', len: 0.26, w: 0.075, h: 0.17, split: [0.3, 0.35, 0.35], dip: 0.03, r0: 0.75, peak: 0.6, r1: 0.9, arch: 0.02 },
  tail: { form: 'oval', len: 0.58, w: 0.1, h: 0.215, segments: 7, dip: 0.06, r0: 0.85, peak: 0.4, r1: 0.25, q: 0.8, pitch: 0 },
  legs: {
    form: 'walker', reach: 1.3, socket: -70,
    fore: { yaw: 65, reach: 0.9, angles: { coxa: -75, tibia: -65 } },
    mid: { yaw: -55, reach: 0.95, angles: { coxa: -75, tibia: -65 } },
    hind: { form: 'jumper', reach: 1, yaw: 75, turn: { tarsus: 180 }, at: 0.92, coxa: { len: 0.12, r: 0.06 }, femur: { len: 0.32, r: 0.085 }, tibia: { len: 0.42, r: 0.022 }, tarsus: { len: 0.32, r: 0.01 }, tarsi: 5, angles: { coxa: -80, femur: 20, tibia: -55 } },
  },
  antennae: { form: 'setaceous', len: 0.06, rise: 10, yaw: 60 },
  mouth: { form: 'stylet', len: 0.14, r: 0.012, pitch: -110 },
  eyes: { form: 'small', size: 0.18, at: 0.55, elev: 10 },
  colors: { body: '#4a2a16', head: '#4f2e18', trunk: '#4a2a16', tail: '#56321b', legs: '#5e3a20', eyes: '#140c08' },
};
