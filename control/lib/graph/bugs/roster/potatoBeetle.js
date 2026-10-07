// COLORADO POTATO BEETLE (Leptinotarsa decemlineata). Thesis: a HIGH ROUNDED DOME, oval from above (longer than a
// ladybird, broadest behind the middle), the cream-yellow elytra meeting in a straight seam · TEN black lengthwise
// stripes, five on each case, running front to rear · an orange pronotum, narrower than the elytra, with black spots
// (a central V-mark and spots either side) · a small orange head visible in front · short orange legs under the rim ·
// short antennae thickening to the tip · about 10 mm long and 7 mm wide (6–12 mm; Hare 1990, Annu. Rev. Entomol.
// 35:81; Wikipedia "Colorado potato beetle"; Connecticut Agric. Exp. Station fact sheet).
export const bug = {
  order: 'Coleoptera', name: 'a Colorado potato beetle', length: 0.01, clearance: 0.05,
  head: { form: 'prognathous', len: 0.11, w: 0.09, h: 0.065, pitch: -35, lift: -0.03, overlap: 0.55 },
  trunk: { form: 'shield', len: 0.3, w: 0.19, h: 0.17, belly: 0.6, split: [0.5, 0.25, 0.25], r0: 0.8, peak: 0.45, r1: 0.55, p: 0.8, q: 0.8 },
  pronotum: { from: 0, to: 0.55, w: 1.12, h: 1.12, drop: 0 },
  tail: { form: 'flat', len: 0.5, w: 0.24, h: 0.25, segments: 5, r0: 0.7, peak: 0.45, r1: 0.65, p: 0.7, q: 0.7, belly: 0.5 },
  legs: { form: 'tucked', reach: 0.75 },
  antennae: { form: 'clavate', len: 0.25, r: 0.007, shape: [[0, 1.1], [0.4, 0.9], [1, 1.7]] },
  mouth: { form: 'mandibles', len: 0.04 }, eyes: { form: 'small', size: 0.3 },
  wings: { pairs: [{ form: 'elytra', len: 0.66, w: 1.25, h: 0.98, r0: 0.55, peak: 0.58, r1: 0.55, p: 0.7, q: 0.7, seam: 0.4, lift: 0.35, stations: 24, slots: 'ring20' }] },
  colors: { body: '#c8742a', head: '#d07a2c', pronotum: '#d9862e', tail: '#e6d9a8', elytra: '#e6d9a8', legs: '#c8742a', antennae: '#2a2018', eyes: '#0d0c0b' },
  markings: [
    // five stripes a case: the crown band and two symmetric pairs (t is the ring half, 0 crown → 1 underside)
    { on: 'elytron', kind: 'band', run: [0.04, 0.96], t: [0.1, 0.2], group: 'Stripe', color: '#16130f' },
    { on: 'elytron', kind: 'band', run: [0.04, 0.96], t: [0.3, 0.4], group: 'Stripe', color: '#16130f' },
    { on: 'elytron', kind: 'band', run: [0.04, 0.96], t: [0.5, 0.6], group: 'Stripe', color: '#16130f' },
    { on: 'pronotum', kind: 'spots', spots: [[0.6, 0.05, 0.3, 0.1], [0.7, 0.3, 0.2, 0.12], [0.55, 0.55, 0.2, 0.12]], group: 'Spot', color: '#16130f' },
  ],
};
