// STORM: the animal of the thunderhead. Its coat gone slate, lightning chevrons crackling white-blue down its flanks, a
// few tall prongs down the back, a sparking tail and eyes of white light. An element: it lays over any form.
export const ooze = {
  id: 'storm',
  about: 'of the thunderhead: a slate coat, lightning chevrons down the flanks, tall sparking prongs, eyes of white light',
  element: 'thunder',
  push: {
    desaturate: 0.5,
    tint: { color: '#3d4a5c', amount: 0.5, light: 0.4 },
    hackles: { count: 5, height: 0.6, lean: 0.2, color: '#e6f4ff', glow: true },
    marks: [
      { on: 'torso', kind: 'stripes', run: [0.1, 0.9], t: [0.15, 0.85], count: 4, width: 0.1, slant: 0.8, chevron: true, group: 'Bolt', color: '#bfe4ff', glow: true },
    ],
    tipGlow: true,
    eyes: { color: '#ffffff', glow: true },
    motif: 'spark',
  },
};
