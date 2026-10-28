// SHADOW: the animal of the dark. Its coat near black, a faint violet glow down its spine, a wisping crest of shadow,
// and pale violet eyes: a silhouette with eyes, the most readable creature there is. An element: it lays over any form.
export const ooze = {
  id: 'shadow',
  about: 'of the dark: a near-black coat, a faint violet line down the spine, a wisping shadow crest, pale violet eyes',
  element: 'dark',
  push: {
    coat: 0.85,
    desaturate: 0.6,
    tint: { color: '#2a1a3a', amount: 0.3, light: 0.3 },
    hackles: { count: 8, height: 0.7, lean: 0.9, color: '#120c1a' },
    marks: [
      { on: ['torso', 'neck'], kind: 'band', t: [0, 0.12], group: 'Umbra', color: '#6a34a8', glow: true },
    ],
    cover: { sheen: 'matte' },
    tipGlow: true,
    eyes: { color: '#d9b3ff', glow: true, open: 1.2 },
    motif: 'shade',
  },
};
