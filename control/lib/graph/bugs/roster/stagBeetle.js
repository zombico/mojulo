// EUROPEAN STAG BEETLE male (Lucanus cervus). Thesis: a long flat dark beetle with ANTLER MANDIBLES as long as the
// head and pronotum together, forked and toothed, reddish-brown · a broad head wider than the pronotum · chestnut
// elytra over the abdomen · long walking legs · elbowed antennae ending in plates · 35–75 mm with the mandibles; the
// body without them about 50 mm (Harvey et al., The Ecology and Conservation of Stag Beetles).
export const bug = {
  order: 'Coleoptera', name: 'a male stag beetle', length: 0.05, clearance: 0.05,
  head: { form: 'prognathous', len: 0.2, w: 0.2, h: 0.07, pitch: 10, r0: 0.8, peak: 0.55, r1: 0.75, p: 0.6, q: 0.6 },
  trunk: { form: 'shield', len: 0.28, w: 0.15, h: 0.075, split: [0.5, 0.25, 0.25] },
  pronotum: { from: 0, to: 0.55, w: 1.15, h: 1.12 },
  tail: { form: 'flat', len: 0.42, w: 0.13, h: 0.085, segments: 5, r0: 0.9, peak: 0.3, r1: 0.45, q: 0.6 },
  legs: { form: 'walker', reach: 0.85, thick: 1.8 },
  antennae: { form: 'geniculate', len: 0.3, segs: 10, rise: 15, yaw: 50, elbow: { at: 1, deg: 40, flare: -30 }, plates: { count: 4, len: 0.05, w: 0.025 } }, mouth: { form: 'tusks', len: 0.42, r: 0.042, flat: 1.2, bend: -0.32, spread: 14, pitch: 18, teeth: [{ at: 0.45, len: 2.2, dir: [-1, 0, 0.2] }, { at: 0.8, len: 3, dir: [-0.5, 0, 1] }] }, eyes: { form: 'small', size: 0.18, at: 0.6, elev: 0 },
  wings: { pairs: [{ form: 'elytra', len: 0.55, w: 1.25, h: 1.0, r0: 0.9, peak: 0.3, r1: 0.45, p: 0.6, q: 0.6 }] },
  colors: { body: '#1c1410', head: '#211712', mouth: '#6e3420', tail: '#5e2c18', elytra: '#5e2c18', legs: '#17110d', eyes: '#0d0b0a' },
};
