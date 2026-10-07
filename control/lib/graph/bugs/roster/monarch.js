// MONARCH BUTTERFLY (Danaus plexippus), wings open in a basking V. Thesis: a slim dark body with two pairs of BROAD orange wings,
// the forewing a long triangle and the hindwing rounded, black veins and a black border dotted white · long clubbed
// (capitate) antennae · a coiled proboscis · only FOUR walking legs: the forelegs small and held up · body about
// 28 mm, wingspan 89–102 mm (Oberhauser & Solensky, The Monarch Butterfly).
export const bug = {
  order: 'Lepidoptera', name: 'a monarch butterfly', length: 0.028, clearance: 0.23348,
  head: { form: 'globe', len: 0.13, w: 0.07, h: 0.065 },
  trunk: { form: 'compact', len: 0.3, w: 0.075, h: 0.075 },
  tail: { form: 'tapered', len: 0.56, w: 0.06, h: 0.06, segments: 7, r1: 0.3 },
  legs: { form: 'walker', reach: 1.25, fore: { form: 'palp', reach: 0.45, angles: { coxa: -10, femur: 10, tibia: -60, tarsus: -80 } } },
  antennae: { form: 'capitate', len: 0.62, rise: 40 }, mouth: 'coiled', eyes: { form: 'compound', size: 0.5 },
  wings: { pose: 'spread', pairs: [
    { form: 'scaled', len: 1.7, chord: 1.0, r0: 0.32, peak: 0.6, r1: 0.05, p: 1, q: 1.2, lead: 0.12, slots: 'ring20', stations: 14, poseOver: { sweep: -6, dihedral: 28 } },
    { form: 'scaledHind', len: 1.3, chord: 1.05, r0: 0.45, peak: 0.5, r1: 0.3, p: 0.6, q: 0.55, lead: 0.3, slots: 'ring20', stations: 14, poseOver: { sweep: 48, dihedral: 24 } }] },
  colors: { body: '#1d1a17', wing: '#d9701c', hindWing: '#d9701c', legs: '#1d1a17', antennae: '#1d1a17', eyes: '#2a2620' },
  // the wing ring's t runs across the CHORD (0 the leading edge → 1 the trailing, both faces alike; ring20 bands are
  // fine at the edges, ~15% of the chord mid-wing). BLACK VEINS are two of the narrower bands along the span
  // (spreading with the chord, so they radiate from the root); the BLACK BORDER is the costa, the trailing margin and the apex; white dots
  // ride the apex border.
  markings: [
    { on: 'wingFore', kind: 'band', t: [0.2, 0.3], run: [0.06, 0.9], group: 'WingEdge', color: '#1d1a17' }, { on: 'wingFore', kind: 'band', t: [0.7, 0.8], run: [0.06, 0.9], group: 'WingEdge' },
    { on: 'wingHind', kind: 'band', t: [0.2, 0.3], run: [0.06, 0.9], group: 'WingEdge' }, { on: 'wingHind', kind: 'band', t: [0.5, 0.6], run: [0.06, 0.9], group: 'WingEdge' },
    { on: 'wingFore', kind: 'band', t: [0, 0.1], group: 'WingEdge' }, { on: 'wingFore', kind: 'band', t: [0.9, 1], group: 'WingEdge' }, { on: 'wingFore', kind: 'band', run: [0.78, 1], group: 'WingEdge' },
    { on: 'wingHind', kind: 'band', t: [0, 0.1], group: 'WingEdge' }, { on: 'wingHind', kind: 'band', t: [0.8, 1], group: 'WingEdge' }, { on: 'wingHind', kind: 'band', run: [0.84, 1], group: 'WingEdge' },
    { on: 'wingFore', kind: 'spots', spots: [[0.86, 0.3, 0.04, 0.08], [0.86, 0.6, 0.04, 0.08], [0.95, 0.15, 0.04, 0.08], [0.95, 0.45, 0.04, 0.08], [0.95, 0.75, 0.04, 0.08]], group: 'WingSpot', color: '#f1ece0' },
    { on: 'wingHind', kind: 'spots', spots: [[0.93, 0.25, 0.04, 0.08], [0.93, 0.55, 0.04, 0.08], [0.88, 0.9, 0.04, 0.06]], group: 'WingSpot' },
  ],
};
