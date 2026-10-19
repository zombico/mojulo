// MYTHICAL: the animal as a legend, a boss. Twice its size and front-heavy, crowned with great curling horns, a crest
// of gold down the back, three runes burning on each flank and a burning tail, eyes of white gold. Its own stylism is
// mythic and rich (the spec's words stand over them): the register heightens all of it, and the detail budget spends
// its ornaments in gold from the head out. Extra heads (a cerberus) are a later step.
export const ooze = {
  id: 'mythical',
  about: 'a legend, a boss: twice the size, great horns, a gold crest, runes burning down its flanks, eyes of white gold',
  form: { scale: 2, bulk: 1.1, headScale: 1.1 },
  stylism: { register: 'mythic', detail: 'rich' },
  push: {
    wedge: { fore: 1.3, hind: 0.9, broad: 1.15 },
    neck: 1.2,
    limbs: { fore: 1.2, paws: 1.3 },
    head: { skull: { width: 1.1 }, brow: 1.6, eye: 1.3, pace: 0.6 },
    horns: { size: 1, curl: 0.6 },
    fangs: 2,
    hackles: { count: 9, height: 0.7, lean: 0.4, color: '#d8b25a', glow: true },
    marks: [
      { on: 'torso', kind: 'stripes', run: [0.3, 0.85], t: [0.3, 0.5], count: 3, width: 0.12, group: 'Rune', color: '#ffd66b', glow: true },
    ],
    tipGlow: true,
    eyes: { color: '#fff1b0', glow: true },
    motif: 'gold',
    expression: { browFurrow: 0.8, sneer: 0.5, jawOpen: 6 },
  },
};
