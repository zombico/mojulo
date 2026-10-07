// COMMON EASTERN FIREFLY (Photinus pyralis). Thesis: a soft, NARROW, ELONGATE, flat beetle, parallel-sided, about 0.35
// as wide as long, low · the pronotum a broad rounded SHIELD that HIDES the head from above, its rim pink-yellow with a
// black centre spot · dark elytra with pale yellow side and seam margins, covering the abdomen · the last abdominal
// segments pale sulphur-yellow (the LANTERN), seen from the side and below · slender filiform antennae about 0.4 of
// the body · slender dark walking legs · 10–14 mm (Lloyd 1966, Studies on the flash communication system in Photinus
// fireflies; Wikipedia, "Photinus pyralis").
export const bug = {
  order: 'Coleoptera', name: 'a common eastern firefly', length: 0.012, clearance: 0.07,
  head: { form: 'prognathous', len: 0.11, w: 0.06, h: 0.04, pitch: -35, lift: -0.02, r0: 0.8, peak: 0.45, r1: 0.55, overlap: 0.6 },
  trunk: { form: 'shield', len: 0.26, w: 0.12, h: 0.055, r0: 0.95, peak: 0.6, r1: 0.85, belly: 0.7, split: [0.6, 0.2, 0.2] },
  pronotum: { from: 0, to: 0.6, w: 1.45, h: 0.95 },
  tail: { form: 'flat', len: 0.6, w: 0.15, h: 0.06, segments: 6, r0: 0.95, peak: 0.3, r1: 0.45, p: 0.8, q: 0.8, belly: 0.8 },
  legs: { form: 'walker', reach: 0.6, thick: 0.9 },
  antennae: { form: 'filiform', len: 0.42, segs: 11, r: 0.009, rise: 18, yaw: 28, curve: 25 },
  mouth: { form: 'mandibles', len: 0.03 },
  eyes: { form: 'small', size: 0.35, at: 0.55, elev: 5 },
  wings: { pairs: [{ form: 'elytra', len: 0.52, w: 1.05, h: 1.0, r0: 0.95, peak: 0.3, r1: 0.55, p: 0.7, q: 0.8, seam: 0.35, lift: 0.35 }] },
  colors: { body: '#2a2520', head: '#2a2520', pronotum: '#e3a08c', trunk: '#2a2520', tail: '#3a332b', elytra: '#2c2722', legs: '#2a2520', antennae: '#2a2520', mouth: '#2a2520', eyes: '#0d0c0b' },
  markings: [
    { on: 'pronotum', kind: 'spots', spots: [[0.5, 0.05, 0.35, 0.1]], group: 'Spot', color: '#161412' },
    { on: 'elytron', kind: 'band', run: [0, 1], t: [0.44, 0.52], group: 'Margin', color: '#d8c56a' },
    { on: 'tail', kind: 'segments', which: [3, 4, 5], group: 'Lantern', color: '#efe27a' },
  ],
};
