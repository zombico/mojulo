// COMMON GREEN LACEWING (Chrysoperla carnea). Thesis: a SLIM soft pale-green body (small head, short thorax, a thin
// abdomen) almost hidden under TWO pairs of big clear, green-veined, oval wings held as a steep ROOF (a tent) over the
// back, reaching well past the abdomen's tip (forewing longer than the body) · long thin thread (filiform) antennae,
// about as long as the forewing, swept forward · big round GOLDEN eyes bulging on the sides of a small forward head ·
// six slender pale legs, body carried low · body 9–11 mm, forewing 10–13 mm (Canard, Séméria & New, Biology of
// Chrysopidae, 1984; Henry et al. 2002, the carnea song-species complex).
export const bug = {
  order: 'Neuroptera',
  name: 'a green lacewing',
  length: 0.01,
  clearance: 0.05,
  head: { form: 'prognathous', len: 0.12, w: 0.065, h: 0.055, pitch: -20, r0: 0.75, peak: 0.45, r1: 0.6 },
  trunk: { form: 'compact', len: 0.28, w: 0.065, h: 0.07, split: [0.2, 0.42, 0.38] },
  tail: { form: 'tapered', len: 0.58, w: 0.055, h: 0.05, segments: 8, peak: 0.25, r0: 0.85, r1: 0.35, pitch: -2 },
  legs: { form: 'walker', reach: 0.9, thick: 0.55, fore: { yaw: 40 }, hind: { yaw: -38 } },
  antennae: { form: 'filiform', len: 1.1, r: 0.005, rise: 22, yaw: 14, curve: 20 },
  mouth: { form: 'mandibles', len: 0.03 },
  eyes: { form: 'compound', size: 0.62, depth: 0.6, bulge: 0.7, at: 0.5, elev: 10 },
  wings: {
    pose: 'roof',
    poseOver: { sweep: 80, dihedral: 6, roll: -62 },
    pairs: [
      { form: 'membrane', len: 1.25, chord: 0.36, r0: 0.3, peak: 0.5, r1: 0.35, lead: 0.4, slots: 'ring20', stations: 14 },
      { form: 'membrane', len: 1.1, chord: 0.3, r0: 0.3, peak: 0.5, r1: 0.35, lead: 0.4, slots: 'ring20', stations: 14 },
    ],
  },
  colors: { body: '#93c24f', head: '#9dc85a', trunk: '#8dbd48', tail: '#a2cc62', legs: '#b5d47a', eyes: '#c99a2e', antennae: '#a8c070', wing: '#dcebcb', mouth: '#7a9a40' },
};
