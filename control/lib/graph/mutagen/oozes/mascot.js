// MASCOT: the animal made its own mascot by the house's mascot laws (docs/mascot.md, docs/mascot-animals.md), on its own
// four legs: a plush, a toy, a game's critter rather than a standing cartoon (`as: 'mascot'` stands it up). A big round
// head on a rounder body, big glinting eyes in a happy face, the face shortened, thick limbs on big paws, the coat's own
// colours saturated, nothing on the surface, and one signature piece in the colour across the wheel from the coat. This
// row is the reading for any body; laid on a species (`base: 'mascot'`, mascot.js) its family's card decides the head,
// the muzzle, the identifiers, the limbs' weight and the piece its folk promise says.
export const ooze = {
  id: 'mascot',
  about: 'its own mascot, on its own legs: a big round head, big happy eyes, a short face, stumpy limbs on big paws, owned colours, one signature piece',
  base: 'mascot',
  form: { headScale: 2.2, bulk: 1.12, legBulk: 1.35 },
  push: {
    wedge: { fore: 1.06, hind: 1.06, broad: 1.08 },
    neck: 1.15,
    limbs: { paws: 1.45 },
    head: { skull: { width: 1.12, height: 1.15 }, muzzle: { length: 0.45, width: 1.1 }, brow: 0.15, eye: 2 },
    expression: { browRaise: 1, cheekBunch: 0.5, cornerRetract: 0.6, jawOpen: 4, earAttitude: 0.4 },
    eyes: { open: 1.35, toon: true },
    saturate: 0.45,
    smooth: true,
    surfaces: { '*': 'satin' },
    piece: { kind: 'bow', size: 1, color: 'opposite' },
  },
};
