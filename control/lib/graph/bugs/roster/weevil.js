// ACORN WEEVIL (Curculio glandium). Thesis: a small pear-shaped, high-domed brown beetle carrying a ROSTRUM (snout)
// about as long as the body itself, thin and angled down from a small round head — the diagnostic · a narrow conical
// pronotum widening back into broad-shouldered convex elytra that taper to the rear · elbowed antennae with a club,
// in life set halfway down the snout · stout walking legs, the femora clubbed · brown mottled with golden scales ·
// 4.5–8 mm without the rostrum (Morris, Orthocerous weevils / Hoffmann, Faune de France 62; ukbeetles.co.uk).
export const bug = {
  order: 'Curculionidae', name: 'an acorn weevil', length: 0.0065, clearance: 0.14,
  head: { form: 'prognathous', len: 0.11, w: 0.075, h: 0.07, pitch: -15, r0: 0.85, peak: 0.45, r1: 0.7, p: 0.8, q: 0.8, overlap: 0.3 },
  trunk: { form: 'shield', len: 0.3, w: 0.11, h: 0.11, r0: 0.95, peak: 0.2, r1: 0.5, p: 0.8, q: 1.1 },
  pronotum: { from: 0, to: 1, w: 1.0, h: 1.05 },
  tail: { form: 'flat', len: 0.62, w: 0.22, h: 0.2, segments: 5, r0: 0.75, peak: 0.2, r1: 0.35, p: 0.7, q: 0.85 },
  legs: { form: 'walker', reach: 0.92, thick: 1.6, femur: { r: 0.026, shape: 'bulb', r0: 0.4, peak: 0.75, end: 0.5 } },
  antennae: { form: 'geniculate', on: 'snout', onAt: 0.5, len: 0.4, segs: 10, scape: 0.4, rise: 35, yaw: 55, elbow: { at: 1, deg: 60 }, shape: [[0, 1], [0.4, 0.8], [0.42, 1], [0.78, 1], [0.82, 2.6], [1, 2.2]] },
  mouth: { form: 'snout', len: 0.95, r: 0.019, end: 0.6, pitch: -23, bend: 0.08, toward: [0, 0, 1] },
  eyes: { form: 'small', size: 0.35, at: 0.55, elev: 10 },
  wings: { pairs: [{ form: 'elytra', len: 0.68, w: 1.12, h: 1.05, r0: 0.75, peak: 0.2, r1: 0.35, p: 0.7, q: 0.85, seam: 0.2 }] },
  colors: { body: '#5e4026', head: '#4e3420', trunk: '#5e4026', pronotum: '#5e4026', tail: '#6e4c2c', elytra: '#7a5632', legs: '#553a22', antennae: '#5a3e24', mouth: '#4a301c', eyes: '#141010' },
};
