// DIRE: the animal grown into its legend, drawn for a game, not a field guide. Bigger, and pushed toward the brute:
// the mass forward in the chest, shoulders and forelegs, a thick neck, heavy paws, the haunch held lean. One hook breaks
// the outline (a crest of hackles over the withers); the contrast is spent at the face (a low wide skull under a heavy
// brow, fangs, a rest snarl, eyes that burn against a darkened coat). Still the animal: its own limbs and rig, its
// proportions exaggerated, never reversed.
export const ooze = {
  id: 'dire',
  about: 'larger and more menacing, still the animal: grown whole, front-heavy, a hackle crest, a snarling face and burning eyes',
  form: { scale: 1.45, bulk: 1.1, headScale: 1.12 },
  push: {
    wedge: { fore: 1.45, hind: 0.8, broad: 1.25 },
    neck: 1.35,
    limbs: { fore: 1.35, hind: 0.8, paws: 1.5 },
    ears: { height: 1.15, sweep: 0.6 },
    head: { skull: { width: 1.15, height: 0.9 }, muzzle: { width: 1.15, height: 1.15 }, brow: 1.8, eye: 1.5 },
    fangs: 2.8,
    hackles: { count: 6, height: 0.65, lean: 0.7 },
    coat: 0.35,
    eyes: { color: '#ffb21a', glow: true, open: 1.3 },
    expression: { jawOpen: 16, browFurrow: 1, sneer: 1, cheekBunch: 0.7, cornerRetract: 0.6, nostrilFlare: 1, earAttitude: -0.8 },
  },
};
