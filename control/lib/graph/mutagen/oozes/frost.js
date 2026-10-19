// FROST: the animal of the ice. Its coat gone pale and blue, rime along the spine, a crest of ice spikes that faintly
// glows, and eyes of cold light. An element: it lays over any form (a dire wolf of the winter is [dire, frost]).
export const ooze = {
  id: 'frost',
  about: 'of the ice: a pale blue coat, rime down the spine, a crest of glowing ice spikes and eyes of cold light',
  element: 'ice',
  push: {
    desaturate: 0.35,
    tint: { color: '#cfe7f7', amount: 0.55, light: 0.45 },
    hackles: { count: 7, height: 0.5, lean: 0.35, color: '#bfefff', glow: true },
    marks: [
      { on: ['torso', 'neck'], kind: 'band', t: [0, 0.22], group: 'Rime', color: '#f2fbff' },
    ],
    eyes: { color: '#7fe8ff', glow: true },
    surfaces: { Hackle: 'glass' },
  },
};
