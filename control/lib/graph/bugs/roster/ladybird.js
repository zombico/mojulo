// SEVEN-SPOT LADYBIRD (Coccinella septempunctata). Thesis: a HALF-DOME, near round from above, the red wing cases
// (elytra) meeting in a straight seam · three black spots on each case and one shared at the front · a black pronotum
// with two white corner patches over a small hidden head · short legs tucked under the rim · short clubbed antennae ·
// 5–8 mm (Majerus, Ladybirds).
export const bug = {
  order: 'Coleoptera', name: 'a seven-spot ladybird', length: 0.0068, clearance: 0.04,
  head: { form: 'prognathous', len: 0.14, w: 0.1, h: 0.075, pitch: -40, lift: -0.035, overlap: 0.55 },
  trunk: { form: 'shield', len: 0.26, w: 0.22, h: 0.13, belly: 0.6 },
  pronotum: { from: 0, to: 0.5, w: 1.18, h: 1.05, drop: 0.08 },
  tail: { form: 'flat', len: 0.5, w: 0.23, h: 0.23, segments: 5, r0: 0.65, peak: 0.5, r1: 0.6, p: 0.7, q: 0.8, belly: 0.5 },
  legs: { form: 'tucked', reach: 0.65 },
  antennae: { form: 'clavate', len: 0.11 }, mouth: { form: 'mandibles', len: 0.04 }, eyes: { form: 'small', size: 0.3 },
  wings: { pairs: [{ form: 'elytra', len: 0.6, w: 1.4, h: 1.0, r0: 0.6, peak: 0.5, r1: 0.45, p: 0.7, q: 0.8, seam: 0.4, lift: 0.35, stations: 24, slots: 'ring20' }] },
  colors: { body: '#141210', pronotum: '#141210', tail: '#c0281c', elytra: '#c0281c', legs: '#141210', eyes: '#0d0c0b' },
  markings: [
    { on: 'elytron', kind: 'spots', spots: [[0.25, 0.55, 0.26, 0.08], [0.25, 0.55, 0.17, 0.28], [0.5, 0.2, 0.26, 0.18], [0.5, 0.2, 0.17, 0.36], [0.75, 0.55, 0.26, 0.08], [0.75, 0.55, 0.17, 0.28]], group: 'Spot', color: '#141210' },
    { on: 'tail', kind: 'spots', spots: [[0.24, 0.08, 0.12, 0.16]], group: 'Spot', color: '#141210' },
    { on: 'pronotum', kind: 'band', run: [0.5, 1], t: [0.34, 0.66], group: 'Patch', color: '#ece6d6' },
  ],
};
