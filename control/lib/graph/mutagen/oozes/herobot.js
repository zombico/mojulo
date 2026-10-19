// HEROBOT: the animal as a toy hero robot, in the herobot language (docs/examples/humanoid/cast/herobot-*.json,
// hero-form.js HEROBOT_PROPORTIONS) carried to a beast, its face its own. A big rounded head with big friendly eyes,
// ear domes for ears and a red gem on the brow; girth contrast in rounded volumes (a barrel chest, a ball over each
// shoulder, the paws grown into flared boots); moulded plastic in two tones, the toy hero's light suit under dark
// armour (the skull a helmet over a light face, dark boots, pauldrons, domes and chest plate) and one red accent.
// Friendly, clean and readable: no grime, no spikes.
export const ooze = {
  id: 'herobot',
  about: 'a toy hero robot: a big round head, friendly eyes, ear domes and a red gem, ball pauldrons, flared boots, two-tone blue plastic',
  form: { headScale: 1.6, bulk: 1.05 },
  push: {
    motif: 'toy',
    head: { skull: { width: 1.15, height: 1.2 }, muzzle: { width: 1.08, height: 1.05 }, eye: 1.6 },
    ears: { none: true },
    earDomes: { size: 1.4 },
    gem: true,
    wedge: { fore: 1.15, hind: 1, broad: 1.12 },
    limbs: { paws: 1.6 },
    boots: { flare: 1.6 },
    pauldrons: { size: 1 },
    desaturate: 1,
    tint: { color: '#4aa8ff', amount: 0.92, light: 1, lightColor: '#cdeeff' },
    groups: { Skull: { color: '#1f5fc8' }, SkullBack: { color: '#1f5fc8' }, Sock: { color: '#1f5fc8' }, Hoof: { color: '#1f5fc8' }, Tip: { color: '#8fd6ff' } },
    marks: [{ on: 'torso', kind: 'band', run: [0.62, 1], t: [0, 1], group: 'ChestPlate', color: '#1f5fc8' }],
    armor: { color: '#1f5fc8', material: 'plastic' },
    surfaces: { '*': 'plastic' },
    eyes: { color: '#36d7ff', open: 1.4 },
  },
};
