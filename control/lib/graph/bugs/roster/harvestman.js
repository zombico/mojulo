// COMMON HARVESTMAN female (Phalangium opilio). Thesis: ONE small oval body — the prosoma and the segmented abdomen
// broadly joined, NO waist (not a spider) — slung low between EIGHT EXTREMELY LONG, hair-thin legs, the knees high
// over the body, the feet far out in a wide ring · the second pair longest (~5–6 × the body), the third shortest · a
// small eye turret (ocularium) with two eyes on top of the body's front · small palps and chelicerae in front · no
// antennae, no wings, no silk · grey-brown with a darker saddle · body 4–9 mm (female), legs II to ~40 mm (Hillyard
// 2005, Harvestmen, Synopses of the British Fauna 4, 3rd ed.).
export const bug = {
  order: 'Opiliones',
  name: 'a harvestman',
  length: 0.007,
  clearance: 0.35,
  head: 'fused',
  trunk: { form: 'cephalothorax', len: 0.42, w: 0.23, h: 0.2, r0: 0.9, peak: 0.4, r1: 0.6, arch: 0.01 },
  tail: { form: 'sac', len: 0.62, w: 0.29, h: 0.22, segments: 5, dip: 0.025, r0: 0.95, peak: 0.35, r1: 0.35, p: 0.7, q: 0.9, pitch: 4, waist: null, overhang: 0.12 },
  waist: null,
  legs: {
    form: 'stilt', thick: 2.2, socket: -20, femur: { bend: 0.04 }, tibia: { bend: -0.06 },
    angles: { coxa: -20, femur: 55, tibia: -55, tarsus: -8 },
    each: [
      { yaw: 50, reach: 1.6 },
      { yaw: 18, reach: 2.6 },
      { yaw: -22, reach: 1.25 },
      { yaw: -52, reach: 1.8 },
    ],
  },
  horns: [{ at: 0.15, len: 0.22, r: 0.08, rise: 90, bend: 0, toward: [0, 0, 1] }],
  palps: { reach: 0.6, yaw: 35 },
  antennae: null,
  mouth: { form: 'fangs', len: 0.06 },
  eyes: { form: 'simple', count: 2, size: 0.12, at: 0.55, elev: 75 },
  colors: { body: '#8a7258', trunk: '#7d664e', tail: '#8a7258', legs: '#5a4634', horn: '#7d664e', eyes: '#141210' },
  markings: [{ on: 'tail', kind: 'band', run: [0.05, 0.85], t: [0, 0.22], group: 'Saddle', color: '#4e3d2c' }],
};
