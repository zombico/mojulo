// CRYSTAL: the animal grown through with stone. Its coat gone toward slate, a ridge of glowing crystal shards down the
// back, shards breaking the skin in seeded spots, violet eyes. The druses at the joints (phase 5's crystal faces) are
// still to come; this row draws the read from what the pushes have.
export const ooze = {
  id: 'crystal',
  about: 'grown through with crystal: a slate coat, a ridge of glowing shards down the back, shards in the skin, violet eyes',
  push: {
    desaturate: 0.4,
    tint: { color: '#4d5163', amount: 0.4, light: 0.4 },
    hackles: { count: 9, height: 0.75, lean: 0.12, color: '#b98cff', glow: true },
    marks: [
      { on: 'torso', kind: 'spots', count: 8, size: [0.07, 0.16], group: 'Shard', color: '#c9a6ff', glow: true },
    ],
    eyes: { color: '#c58cff', glow: true },
    surfaces: { Hackle: 'glass' },
  },
};
