// PERIODICAL CICADA (Magicicada septendecim). Thesis: a STOUT black body under clear WINGS held as a steep ROOF, the
// forewings reaching well past the tail (~1.2 × the body), their veins and leading edge ORANGE · a short broad head,
// wider than long, the big RED EYES set out at its corners · a broad deep thorax (pronotum collar, mesonotum) · a
// tapering black abdomen · short bristle antennae · the beak folded back under the chest · short orange walking legs,
// the forefemora thickened · body (head to abdomen tip) 24–33 mm, to the wing tips 33–38 mm (Marlatt, The Periodical
// Cicada, USDA Bur. Ent. Bull. 71, 1907; Alexander & Moore 1962, Univ. Michigan Misc. Publ. 121).
export const bug = {
  order: 'Cicadidae', name: 'a periodical cicada', length: 0.028, clearance: 0.06,
  head: { form: 'globe', len: 0.12, w: 0.16, h: 0.075, pitch: -30, r0: 0.8, peak: 0.45, r1: 0.6, p: 0.8, q: 0.8, overlap: 0.25 },
  trunk: { form: 'compact', len: 0.36, w: 0.15, h: 0.13, split: [0.3, 0.55, 0.15], r0: 0.75, peak: 0.55, r1: 0.8 },
  pronotum: { from: 0, to: 0.32, w: 1.08, h: 1.06 },
  tail: { form: 'oval', len: 0.5, w: 0.13, h: 0.115, segments: 7, r0: 0.85, peak: 0.22, r1: 0.25, p: 0.8, q: 1.2, pitch: -4 },
  legs: { form: 'walker', reach: 0.62, thick: 1.6, fore: { yaw: 35, femur: { r: 0.03, bend: 0.06 } }, mid: { yaw: -5 }, hind: { yaw: -40 } },
  antennae: { form: 'setaceous', len: 0.1 },
  mouth: { form: 'beak', len: 0.4, r: 0.014, pitch: -160 },
  eyes: { form: 'compound', size: 0.7, at: 0.42, elev: 8, bulge: 0.75 },
  wings: { pose: 'roof', poseOver: { sweep: 86, dihedral: -10, roll: -58 }, pairs: [{ form: 'membrane', len: 1.05, chord: 0.3, r0: 0.3, peak: 0.6, r1: 0.4, lead: 0.3, slots: 'ring20', stations: 14 }, { form: 'membrane', len: 0.6, chord: 0.22, r0: 0.4, peak: 0.5, r1: 0.4, slots: 'ring20', stations: 12 }] },
  colors: { body: '#151311', head: '#151311', trunk: '#151311', tail: '#191614', legs: '#c4561c', antennae: '#1a1714', mouth: '#2a1e16', eyes: '#b3261a', wing: '#d8dedb' },
  // the wing ring's t runs across the chord (0 the leading edge): the orange COSTA a band at the front, the veins thin lines
  markings: [{ on: 'wingFore', kind: 'band', t: [0, 0.1], run: [0, 1], group: 'Vein', color: '#d0661a' }, { on: 'wingFore', kind: 'veins', count: 3, width: 0.03, run: [0.05, 0.85], group: 'Vein' },
    { on: 'wingHind', kind: 'band', t: [0, 0.1], run: [0, 1], group: 'Vein' }],
};
