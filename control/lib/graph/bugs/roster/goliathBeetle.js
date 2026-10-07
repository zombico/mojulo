// GOLIATH BEETLE male (Goliathus goliatus). Thesis: a MASSIVE, broad, flat flower chafer, near a rounded oblong from
// above (about half as wide as long), low and heavy · the PRONOTUM is the read: white with bold black longitudinal
// stripes, broad and rounded · velvety brown elytra with white patches along the base and the sides, the abdomen tip
// just showing · a small head carrying a short forked (Y-shaped) horn pointing forward and up · long strong black
// legs, the fore tibiae toothed · short lamellate antennae. Males 50–110 mm (Wikipedia "Goliathus goliatus"; 60–110 mm
// in most field guides), among the heaviest insects: built at 90 mm head front to tail tip.
export const bug = {
  order: 'Coleoptera', name: 'a Goliath beetle', length: 0.09, clearance: 0.08,
  head: { form: 'prognathous', len: 0.12, w: 0.08, h: 0.05, pitch: -6, overlap: 0.1 },
  trunk: { form: 'shield', len: 0.3, w: 0.23, h: 0.1, split: [0.5, 0.25, 0.25], belly: 0.6 },
  pronotum: { from: 0, to: 0.5, w: 1.1, h: 1.2, drop: -0.3 },
  tail: { form: 'flat', len: 0.52, w: 0.24, h: 0.11, segments: 5, r0: 0.95, peak: 0.3, r1: 0.55, p: 0.6, q: 0.7, belly: 0.5 },
  legs: { form: 'walker', reach: 0.95, thick: 2.6 },
  antennae: { form: 'lamellate', len: 0.08, rise: 5, yaw: 60 },
  // the FORK: a short stem horn on the head and the mouth's two jaws tipped up and splayed as its arms (no forked horn)
  mouth: { form: 'mandibles', len: 0.1, r: 0.02, flat: 0.8, pitch: 48, spread: 30, bend: 0.12, toward: [1, 0, 0] },
  horns: [{ on: 'head', at: 0.8, len: 0.14, r: 0.03, rise: 42, bend: 0.1 }],
  eyes: { form: 'small', size: 0.22, at: 0.5, elev: 0 },
  wings: { pairs: [{ form: 'elytra', len: 0.6, w: 1.12, h: 1.1, r0: 0.95, peak: 0.3, r1: 0.62, p: 0.6, q: 0.6, seam: 0.3, stations: 16 }] },
  colors: { body: '#141210', head: '#141210', pronotum: '#e4ddc8', horn: '#141210', mouth: '#141210', tail: '#5a3a22', elytra: '#5a3a22', legs: '#141210', eyes: '#0d0b0a' },
  markings: [
    { on: 'pronotum', kind: 'band', run: [0, 1], t: [0.15, 0.25], group: 'Stripe', color: '#141210' },
    { on: 'pronotum', kind: 'band', run: [0, 1], t: [0.45, 0.55], group: 'Stripe', color: '#141210' },
    { on: 'elytron', kind: 'spots', spots: [[0.06, 0.3, 0.1, 0.5], [0.3, 0.55, 0.25, 0.12], [0.6, 0.6, 0.2, 0.12], [0.35, 0.1, 0.2, 0.1]], group: 'Patch', color: '#e4ddc8' },
  ],
};
