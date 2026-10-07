// EUROPEAN RHINOCEROS BEETLE male (Oryctes nasicornis). Thesis: a stout, broad, near-cylindrical glossy CHESTNUT
// beetle with ONE diagnostic part: a single stout HORN on the head, rising almost straight up and curving BACK toward
// the pronotum (no thoracic horn) · a large sculpted pronotum, its front a steep scooped slope up to a raised ridge
// behind the horn · parallel-sided chestnut elytra, rounded behind · short stout legs, the forelegs broad toothed
// digging tibiae, the body carried low · short lamellate antennae. 20–42 mm (max 47) (Wikipedia "European rhinoceros
// beetle"; iNaturalist Oryctes nasicornis): built at 35 mm head front to tail tip, the horn ~10 mm.
export const bug = {
  order: 'Coleoptera', name: 'a European rhinoceros beetle', length: 0.035, clearance: 0.08,
  head: { form: 'prognathous', len: 0.13, w: 0.07, h: 0.045, pitch: -6, lift: 0, overlap: 0.02 },
  trunk: { form: 'shield', len: 0.34, w: 0.19, h: 0.13, split: [0.55, 0.22, 0.23], belly: 0.6 },
  pronotum: { from: 0, to: 0.58, w: 1.12, h: 1.25, drop: -0.45 },
  tail: { form: 'flat', len: 0.42, w: 0.2, h: 0.155, segments: 5, r0: 0.95, peak: 0.3, r1: 0.5, p: 0.6, q: 0.7, belly: 0.5 },
  legs: { form: 'walker', reach: 0.85, thick: 2.3, fore: { form: 'digger', reach: 0.85, yaw: 8 } },
  antennae: { form: 'lamellate', len: 0.12, rise: 5, yaw: 60 },
  mouth: { form: 'mandibles', len: 0.03 },
  eyes: { form: 'small', size: 0.22, at: 0.45, elev: 0 },
  horns: [{ on: 'head', at: 0.72, len: 0.32, r: 0.04, rise: 88, bend: 0.3, toward: [0, 1, 0.2] }],
  wings: { pairs: [{ form: 'elytra', len: 0.58, w: 1.12, h: 1.05, r0: 0.95, peak: 0.3, r1: 0.45, p: 0.6, q: 0.8, seam: 0.3, stations: 14 }] },
  colors: { body: '#3a1a0e', head: '#341709', pronotum: '#3e1c0e', horn: '#341709', tail: '#5e2c15', elytra: '#5e2c15', legs: '#331709', eyes: '#0d0b0a' },
};
