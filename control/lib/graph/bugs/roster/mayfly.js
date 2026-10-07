// GREEN DRAKE MAYFLY (Ephemera danica), adult at rest. Thesis: big triangular FOREWINGS held UPRIGHT together over
// the back like a sail (the small hind wings at their base) · a long slender pale cream abdomen of ten segments curving
// UP toward the end, its last segments marked dark brown, ending in THREE LONG TAILS (two cerci and a median filament)
// about as long as the body or longer, held up and spread · a humped brown thorax, a small head with big eyes and
// tiny bristle antennae, no working mouth · the long FORELEGS held forward off the ground like feelers, the body
// standing on the four short mid and hind legs · body 16–24 mm, forewing 15–23 mm, tails to ~1.5× body in males
// (Elliott & Humpesch, A key to the adults of the British Ephemeroptera, FBA Sci. Publ. 47, 1983).
export const bug = {
  order: 'Ephemeroptera',
  name: 'a mayfly',
  length: 0.02,
  clearance: 0.07,
  head: { form: 'globe', len: 0.08, w: 0.055, h: 0.05, pitch: -25 },
  trunk: { form: 'compact', len: 0.24, w: 0.06, h: 0.075, split: [0.18, 0.52, 0.3], arch: 0.015 },
  tail: { form: 'long', len: 0.66, w: 0.048, h: 0.05, segments: 10, pitch: 14, r0: 1.15, peak: 0.2, r1: 0.55, q: 0.6 },
  legs: {
    form: 'walker', reach: 0.85, thick: 0.5,
    fore: { ground: false, yaw: 72, coxa: { len: 0.04 }, femur: { len: 0.2 }, tibia: { len: 0.26 }, tarsus: { len: 0.3 }, angles: { coxa: -20, femur: 25, tibia: 15, tarsus: 5 }, claws: null },
    mid: { yaw: 0, angles: { tibia: -70 } },
    hind: { yaw: -40, angles: { tibia: -70 } },
  },
  antennae: { form: 'setaceous', len: 0.06 },
  mouth: 'none',
  eyes: { form: 'large', size: 0.7 },
  wings: {
    pose: 'upright',
    pairs: [
      { form: 'membrane', len: 0.95, chord: 0.45, r0: 0.25, peak: 0.55, r1: 0.08, p: 0.9, q: 0.9, lead: 0.3, poseOver: { sweep: 22, dihedral: 84 } },
      { form: 'membrane', len: 0.32, chord: 0.16, r0: 0.5, peak: 0.5, r1: 0.4, lead: 0.3, poseOver: { sweep: 35, dihedral: 80 } },
    ],
  },
  extras: [
    { kind: 'cerci', len: 1.1, r: 0.006, spread: 18, rise: 22, bend: 0.03 },
    { kind: 'filament', len: 1.05, r: 0.006, rise: 24 },
  ],
  colors: { body: '#d9c79a', head: '#5a4128', trunk: '#6b4a2a', tail: '#e6d8ae', legs: '#5a4630', eyes: '#2a2a26', antennae: '#5a4630', wing: '#ece8cf', cerci: '#4a3a28' },
  markings: [
    { on: 'tail', kind: 'segments', which: [7, 8, 9], from: 0.6, trim: 0, group: 'Band', color: '#5a3c22' },
  ],
};
