// EUROPEAN EARWIG (Forficula auricularia), adult male. Thesis: a long, FLAT, parallel-sided body carried low · the
// ABDOMEN left bare (seven or eight plates, slightly widening to the rear) and ending in the FORCEPS: two stout cerci,
// in the male bowed out then curving in like callipers, a third of the body long · short SQUARE-CUT tegmina covering
// only the thorax, a square pronotum ahead of them · a flat heart-shaped prognathous head with beaded (moniliform)
// antennae about half the body long · six short pale legs, sprawled · dark reddish-brown, pale legs and tegmina ·
// body 12–15 mm without the forceps; male forceps 4–9 mm, female 3–4 mm and straight (Brindle, British Earwigs,
// 1977; Albouy & Caussanel, Dermaptères, Faune de France 75, 1990).
export const bug = {
  order: 'Dermaptera',
  name: 'a common earwig',
  length: 0.014,
  clearance: 0.04,
  head: { form: 'prognathous', len: 0.13, w: 0.072, h: 0.035, pitch: -4, r0: 0.7, peak: 0.45, r1: 0.6, p: 0.7, q: 0.8 },
  trunk: { form: 'shield', len: 0.27, w: 0.076, h: 0.038, split: [0.34, 0.33, 0.33], r0: 0.8, peak: 0.6, r1: 0.95 },
  pronotum: { from: 0, to: 0.34, w: 1.12, h: 1.15 },
  tail: { form: 'tapered', len: 0.62, w: 0.1, h: 0.034, segments: 8, dip: 0.1, r0: 0.9, peak: 0.65, r1: 1.0, p: 0.8, q: 0.6, pitch: 2 },
  legs: { form: 'walker', reach: 0.6, thick: 0.75, yaw: [50, -5, -45], angles: { coxa: -45, femur: 10, tibia: -50, tarsus: -4 } },
  antennae: { form: 'moniliform', len: 0.55, r: 0.008, segs: 14, rise: 18, yaw: 30, curve: 20 },
  mouth: { form: 'mandibles', len: 0.035 },
  eyes: { form: 'small', size: 0.2, at: 0.6, elev: 5 },
  wings: { pairs: [{ form: 'elytra', len: 0.26, w: 1.08, h: 1.1, r0: 0.95, peak: 0.5, r1: 0.9, p: 0.5, q: 0.4, seam: 0.15 }] },
  extras: [{ kind: 'cerci', shape: 'banana', len: 0.4, r: 0.038, flat: 0.6, bend: -0.45, spread: 8, rise: 3 }],
  colors: { body: '#4a2416', head: '#7a3a1e', trunk: '#3b2216', pronotum: '#4a2a18', elytra: '#8a5a30', tail: '#4a2416', legs: '#c39d5e', antennae: '#6a4a30', eyes: '#0d0b0a', mouth: '#5a2a16', cerci: '#3a1e12' },
};
