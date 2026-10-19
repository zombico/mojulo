// FIRE: the animal of the flame. Its coat charred dark, cracks of lava glowing through it down the flanks and round
// the feet, a crest of flame-tongues, a burning tail and eyes of fire. An element: it lays over any form.
export const ooze = {
  id: 'fire',
  about: 'of the flame: a charred coat cracked with glowing lava, flame-tongues down the back, a burning tail, eyes of fire',
  element: 'fire',
  push: {
    coat: 0.55,
    tint: { color: '#5a1e0e', amount: 0.45, light: 0.3 },
    hackles: { count: 7, height: 0.6, lean: 0.55, color: '#ffb12a', glow: true },
    marks: [
      { on: 'torso', kind: 'stripes', run: [0.05, 0.95], t: [0.2, 0.9], count: 6, width: 0.16, slant: 0.6, group: 'Ember', color: '#ff7a1a', glow: true },
      { on: 'legs', kind: 'band', run: [0.75, 1], group: 'Ember', color: '#ff7a1a', glow: true },
    ],
    tipGlow: true,
    eyes: { color: '#ffd23a', glow: true },
    motif: 'flame',
  },
};
