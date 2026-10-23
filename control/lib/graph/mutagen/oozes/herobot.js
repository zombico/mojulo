// HEROBOT: the animal as a toy hero robot, in the herobot language (docs/examples/humanoid/cast/herobot-*.json,
// hero-form.js HEROBOT_PROPORTIONS) carried to a beast, its face its own. The silhouette is the toy hero's: a big
// rounded head under a helmet, ear domes for ears, a gem on the brow, a barrel chest under a plate, a ball over each
// shoulder, the paws grown into flared boots. What makes it a machine is construction, not a colour: ball joints at
// every elbow, knee, wrist and hock, twin antennae, panel seams round the body and the limbs, vent grilles on the flanks,
// a segmented tail and LED eyes, in moulded plastic. Its colours are the animal's own made into a toy's two tones: a
// light suit, its coat darkened into the armour, and one accent, the coat's complement (the colour words).
export const ooze = {
  id: 'herobot',
  about: 'a toy hero robot in its own colours: a helmeted big head, ear domes, a gem, antennae, ball joints, pauldrons, flared boots, panel seams',
  form: { headScale: 1.6, bulk: 1.05 },
  push: {
    motif: 'toy',
    motifColor: 'accent',
    head: { skull: { width: 1.15, height: 1.2 }, muzzle: { width: 1.08, height: 1.05 }, eye: 1.6 },
    ears: { none: true },
    earDomes: { size: 1.4 },
    gem: true,
    antenna: { size: 1 },
    wedge: { fore: 1.15, hind: 1, broad: 1.12 },
    limbs: { paws: 1.6 },
    boots: { flare: 1.6 },
    pauldrons: { size: 1 },
    jointBalls: { size: 1 },
    tint: { color: 'suit', amount: 0.85, light: 1, lightColor: '#f1ede4' },
    groups: { Skull: { color: 'armor' }, SkullBack: { color: 'armor' }, Sock: { color: 'armor' }, Hoof: { color: 'armor' }, Tip: { color: 'accent' } },
    marks: [
      { on: 'torso', kind: 'band', run: [0.62, 1], t: [0, 1], group: 'ChestPlate', color: 'armor' },
      { on: 'torso', kind: 'stripes', run: [0.1, 0.62], t: [0, 1], count: 2, width: 0.06, group: 'Seam', color: 'seam' },
      { on: 'torso', kind: 'stripes', run: [0.3, 0.44], t: [0.4, 0.58], count: 3, width: 0.4, group: 'Vent', color: 'seam' },
      { on: 'legs', kind: 'band', run: [0.46, 0.54], group: 'Seam', color: 'seam' },
      { on: 'tail', kind: 'stripes', count: 4, width: 0.18, group: 'Seam', color: 'seam' },
    ],
    armor: { color: 'armor', material: 'plastic' },
    surfaces: { '*': 'plastic' },
    eyes: { color: 'accent', glow: true, open: 1.4 },
  },
};
