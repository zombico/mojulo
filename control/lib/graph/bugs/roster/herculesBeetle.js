// HERCULES BEETLE male (Dynastes hercules). Thesis: a huge broad high-domed rhinoceros beetle, the PINCER of two horns
// its whole read: a long glossy black THORACIC HORN from the pronotum arching forward over the head, longer than the
// pronotum and elytra-front together, and below it a shorter HEAD HORN rising and curving up to meet it · a domed black
// pronotum as wide as the elytra · broad olive-khaki elytra with scattered black spots, rounded behind · a small head
// under the pronotum · long stout black legs holding the body high · short lamellate antennae. Body 50–85 mm without
// the horns, males to ~173 mm with them (Wikipedia "Hercules beetle", after Animal Diversity Web, D. hercules):
// built at 85 mm head front to tail tip, the thoracic horn reaching ~60 mm past the head (~145 mm overall).
export const bug = {
  order: 'Coleoptera', name: 'a male Hercules beetle', length: 0.085, clearance: 0.16,
  head: { form: 'prognathous', len: 0.13, w: 0.075, h: 0.055, pitch: -12, overlap: 0.3 },
  trunk: { form: 'shield', len: 0.32, w: 0.2, h: 0.14, split: [0.5, 0.25, 0.25], belly: 0.6 },
  pronotum: { from: 0, to: 0.55, w: 1.14, h: 1.42 },
  tail: { form: 'flat', len: 0.52, w: 0.21, h: 0.16, segments: 5, r0: 0.9, peak: 0.35, r1: 0.45, p: 0.7, q: 0.8, belly: 0.5 },
  legs: { form: 'walker', reach: 1.4, thick: 2.3 },
  antennae: { form: 'lamellate', len: 0.12, rise: 10, yaw: 55 },
  // the HEAD HORN: the builder names every horn 'horn' (one per bug), so it is the mouth's needle, a single carrot
  // from the head's front tipped up and sagging so its tip curls up toward the thoracic horn
  mouth: { form: 'snout', len: 0.6, r: 0.042, end: 0, pitch: 16, bend: 0.25, toward: [0, 0.3, -1] },
  eyes: { form: 'small', size: 0.25, at: 0.45, elev: 0 },
  horns: [
    { on: 'pronotum', at: 0.78, len: 0.95, r: 0.055, rise: -2, bend: 0.14, toward: [0, 0, 1] },
  ],
  wings: { pairs: [{ form: 'elytra', len: 0.64, w: 1.15, h: 1.08, r0: 0.85, peak: 0.35, r1: 0.4, p: 0.7, q: 0.8, seam: 0.3, stations: 16 }] },
  colors: { body: '#121010', head: '#121010', pronotum: '#151313', horn: '#141212', mouth: '#141212', tail: '#a8955c', elytra: '#a8955c', legs: '#151212', eyes: '#0d0b0a' },
  markings: [
    { on: 'elytron', kind: 'spots', spots: [[0.2, 0.3, 0.06, 0.06], [0.35, 0.15, 0.05, 0.06], [0.5, 0.35, 0.06, 0.05], [0.65, 0.2, 0.05, 0.06], [0.8, 0.4, 0.05, 0.06], [0.45, 0.55, 0.05, 0.05]], group: 'Spot', color: '#161210' },
  ],
};
