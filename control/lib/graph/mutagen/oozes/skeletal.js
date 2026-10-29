// SKELETAL: the animal down to its bones, the platformer's dry bones. Every ring drawn in to a bone's girth, every
// colour bone; the ribs read as dark gaps across the chest, the spine as a row of short processes, the skull earless
// with dark sockets round a burning pupil and a gaping jaw. Its own limbs and rig: a skeleton that walks as it did.
export const ooze = {
  id: 'skeletal',
  about: 'down to the bones: thin as bone, bone-white, ribs and spine showing, an earless skull with burning sockets',
  form: { bulk: 0.5, legBulk: 0.5, tailBush: 0.35 },
  push: {
    motif: 'bone',
    neck: 0.55,
    limbs: { paws: 0.8 },
    head: { skull: { height: 0.92 }, muzzle: { width: 0.85, height: 0.85 } },
    ears: { none: true },
    cover: { length: 'short', sheen: 'matte' },
    fangs: 1.6,
    hackles: { count: 12, height: 0.3, lean: 0.25, color: '#d9cfb6' },
    tint: { color: '#e4dac2', amount: 1, light: 1 },
    marks: [
      { on: 'torso', kind: 'stripes', run: [0.45, 0.95], t: [0.1, 0.88], count: 5, width: 0.45, group: 'RibGap', color: '#2a231c' },
    ],
    eyes: { color: '#ff6a1f', glow: true, socket: true },
    expression: { jawOpen: 14 },
  },
};
