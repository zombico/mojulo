// INDIAN STICK INSECT (Carausius morosus), adult female at rest. Thesis: a WINGLESS, very long, pencil-thin body of
// even width, a twig · a tiny forward head, a short prothorax, a LONG mesothorax (about a quarter of the body, the mid
// legs at its rear end), a shorter metathorax and a long ten-segment abdomen · at rest the long FORELEGS are stretched
// STRAIGHT FORWARD alongside the short thread antennae (the femora notched at the base to wrap the head), so the
// insect reads as one long stick; the mid and hind legs long and thin, splayed out to the sides · green to brown ·
// females 70–84 mm, males rare (Brock, Stick and Leaf Insects of Britain and Europe, 1999; Phasmid Study Group PSG 1).
export const bug = {
  order: 'Phasmida',
  name: 'an Indian stick insect',
  length: 0.08,
  clearance: 0.045,
  head: { form: 'prognathous', len: 0.055, w: 0.024, h: 0.02, pitch: -6, r0: 0.8, peak: 0.45, r1: 0.65 },
  trunk: { form: 'long', len: 0.43, w: 0.022, h: 0.021, split: [0.1, 0.56, 0.34], dip: 0.06, r0: 0.9, peak: 0.5, r1: 0.95, p: 0.6, q: 0.6 },
  tail: { form: 'long', len: 0.52, w: 0.024, h: 0.023, segments: 10, pitch: 0, r0: 1.0, peak: 0.3, r1: 0.55, q: 0.5 },
  legs: {
    form: 'runner', thick: 0.32, socket: -30, reach: 1.15,
    fore: { ground: false, reach: 1, at: 0.04, yaw: 89, coxa: { len: 0.03 }, femur: { len: 0.22 }, tibia: { len: 0.22 }, tarsus: { len: 0.08 }, angles: { coxa: -5, femur: -2, tibia: 0, tarsus: -2 }, claws: { len: 0.012, r: 0.004 } },
    mid: { at: 0.62, yaw: 30, coxa: { len: 0.03 }, femur: { len: 0.17 }, tibia: { len: 0.17 }, tarsus: { len: 0.07 }, angles: { coxa: -30, femur: 18, tibia: -42, tarsus: -4 } },
    hind: { at: 0.93, yaw: -45, coxa: { len: 0.03 }, femur: { len: 0.2 }, tibia: { len: 0.21 }, tarsus: { len: 0.07 }, angles: { coxa: -30, femur: 18, tibia: -42, tarsus: -4 } },
  },
  antennae: { form: 'filiform', len: 0.12, r: 0.004, rise: 2, yaw: 1, curve: 6, at: 0.95 },
  mouth: { form: 'mandibles', len: 0.015, r: 0.006 },
  eyes: { form: 'small', size: 0.3 },
  colors: { body: '#7d9a45', head: '#82a04a', legs: '#86a24c', antennae: '#86a24c', eyes: '#5a6a30', feet: '#7a9442' },
};
