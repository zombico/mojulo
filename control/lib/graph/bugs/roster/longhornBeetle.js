// ROSALIA LONGICORN male (Rosalia alpina). Thesis: a NARROW, PARALLEL-SIDED longhorn about four times as long as wide,
// its ANTENNAE about TWICE THE BODY LENGTH, eleven segments ringed blue and black, black tufts at the ends of the middle
// segments, swept up and back in an arc · ash-blue (blue-grey) all over, the elytra crossed by black velvet marks: a
// patch at the shoulders, a broad band across the middle, a smaller spot before the tip · a pronotum narrower than the
// elytra with a black spot at its front · a small head tipped down · long slim walking legs, blue with black knees ·
// 15–38 mm (Wikipedia "Rosalia longicorn"; Russo et al., Rosalia alpina monitoring guidelines, Nature Conservation 20,
// 2017; kerbtier.de species portrait).
const tuft = (i) => ({ on: `antenna${i}`, kind: 'band', run: [0.5, 1], group: 'Tuft', color: '#141414' });
export const bug = {
  order: 'Coleoptera', name: 'a Rosalia longicorn', length: 0.03, clearance: 0.07,
  head: { form: 'prognathous', len: 0.12, w: 0.07, h: 0.055, pitch: -30, lift: -0.01, r0: 0.85, peak: 0.45, r1: 0.6, overlap: 0.2 },
  trunk: { form: 'shield', len: 0.25, w: 0.075, h: 0.065, split: [0.45, 0.27, 0.28], r0: 0.85, peak: 0.55, r1: 0.8 },
  pronotum: { from: 0, to: 0.45, w: 1.27, h: 1.12 },
  tail: { form: 'flat', len: 0.56, w: 0.1, h: 0.065, segments: 5, r0: 0.95, peak: 0.3, r1: 0.5, p: 0.7, q: 0.9 },
  legs: { form: 'walker', reach: 1.15, thick: 1.1, hind: { reach: 1.35 } },
  antennae: { form: 'whip', len: 2.0, segs: 11, scape: 0.08, r: 0.011, shape: [[0, 1.3], [0.08, 1], [1, 0.45]], rise: 35, yaw: 28, curve: 55, flare: 50 },
  mouth: { form: 'mandibles', len: 0.04, r: 0.012 },
  eyes: { form: 'small', size: 0.3, at: 0.6, elev: 20 },
  wings: { pairs: [{ form: 'elytra', len: 0.66, w: 1.08, h: 1.05, r0: 0.95, peak: 0.25, r1: 0.55, p: 0.6, q: 0.8, seam: 0.4, lift: 0.1, stations: 16, slots: 'ring20' }] },
  colors: { body: '#7e95b4', head: '#7e95b4', pronotum: '#869ebd', tail: '#7e95b4', elytra: '#8ea8c8', legs: '#7e95b4', antennae: '#7e95b4', mouth: '#1c1c1c', eyes: '#111111' },
  markings: [
    { on: 'elytron', kind: 'band', run: [0.04, 0.16], t: [0.1, 0.45], group: 'Mark', color: '#151515' },
    { on: 'elytron', kind: 'band', run: [0.4, 0.58], t: [0, 0.7], group: 'Mark', color: '#151515' },
    { on: 'elytron', kind: 'band', run: [0.74, 0.84], t: [0, 0.4], group: 'Mark', color: '#151515' },
    { on: 'pronotum', kind: 'band', run: [0.55, 0.95], t: [0, 0.15], group: 'Mark', color: '#151515' },
    { on: 'legs', kind: 'band', run: [0.75, 1], group: 'Mark', color: '#151515' },
    ...[2, 3, 4, 5, 6, 7, 8].map(tuft),
  ],
};
