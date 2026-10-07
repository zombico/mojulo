// SACRED SCARAB (Scarabaeus sacer). Thesis: a BROAD, FLAT-BACKED black beetle, about 0.6 as wide as long, low and
// squat · the head a wide flat semicircular SHOVEL (the clypeus) with six short teeth along its front edge, the eyes
// hidden at its back corners · a big transverse pronotum with rounded sides, as wide as the elytra · short square
// elytra over the abdomen, the rear blunt · RAKING FORELEGS splayed forward, the tibiae broad and toothed, no foretarsi
// · long slender curved mid and hind legs splayed back, the body carried off the ground · short antennae with a small
// three-leaf club · matte black · 26–40 mm (Baraud, Coléoptères Scarabaeoidea d'Europe, 1992).
export const bug = {
  order: 'Coleoptera', name: 'a sacred scarab', length: 0.03, clearance: 0.12,
  head: { form: 'prognathous', len: 0.2, w: 0.27, h: 0.03, pitch: -18, r0: 0.65, peak: 0.65, r1: 0.2, p: 0.6, q: 0.45, overlap: 0.25 },
  trunk: { form: 'shield', len: 0.3, w: 0.2, h: 0.09, split: [0.55, 0.22, 0.23], belly: 0.6 },
  pronotum: { from: 0, to: 0.62, w: 1.45, h: 1.15 },
  tail: { form: 'flat', len: 0.45, w: 0.27, h: 0.12, segments: 5, r0: 0.95, peak: 0.5, r1: 0.3, p: 0.7, q: 0.4, belly: 0.5 },
  legs: { form: 'walker', reach: 1.0, thick: 1.5,
    fore: { form: 'digger', reach: 1.0, thick: 1.3, yaw: 58, femur: { len: 0.16 }, tibia: { len: 0.19, r: 0.03, shape: 'carrot', end: 1.5, flat: 0.3, thin: 'up', bend: 0 }, tarsus: { len: 0.012, r: 0.006, end: 0.8 }, tarsi: 1, claws: null, angles: { coxa: -35, femur: 5, tibia: -22, tarsus: -25 } },
    mid: { yaw: -38, femur: { len: 0.22 }, tibia: { len: 0.24, bend: 0.14 } },
    hind: { yaw: -50, femur: { len: 0.25 }, tibia: { len: 0.32, bend: 0.14 }, tarsus: { len: 0.2 } } },
  antennae: { form: 'lamellate', len: 0.1, rise: -5, yaw: 55, plates: { count: 3, len: 0.04, w: 0.02 } },
  mouth: { form: 'mandibles', len: 0.17, r: 0.03, flat: 0.25, bend: 0.25, spread: 75, toward: [0, -1, 0], teeth: [{ at: 0.1, len: 2.8, dir: [0.15, 1, -0.1] }, { at: 0.5, len: 2.8, dir: [0.7, 1, -0.1] }, { at: 0.9, len: 2.8, dir: [1, 0.4, -0.1] }] },
  eyes: { form: 'small', size: 0.12, at: 0.15, elev: 0 },
  wings: { pairs: [{ form: 'elytra', len: 0.5, w: 1.05, h: 1.0, r0: 0.95, peak: 0.45, r1: 0.3, p: 0.7, q: 0.4, seam: 0.3 }] },
  colors: { body: '#161514', head: '#1a1917', mouth: '#1a1917', tail: '#141312', elytra: '#1b1a18', legs: '#131211', eyes: '#0c0b0a' },
};
