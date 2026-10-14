/**
 * social — how an animal lives with its own kind, as a mind reads it: in a PACK (hunts together), a HERD (grazes
 * together and breaks together), a FLOCK or a SCHOOL (a herd in the air or the water), or SOLITARY. Set per family,
 * with species overrides. It sits on the mind side: the fauna tags are each read by a fauna behavior strategy, and this
 * is read only by minds (`faunaMind` and `faunaGroup` in ./presets.js), which turn it into a group (the engine's
 * worlds/controllable/group.js).
 */

export const SOCIAL = Object.freeze({
  pack:     { line: 'hunts with its own kind: fans out, rings the prey, two bite at a time' },
  herd:     { line: 'grazes near its own kind and runs when any of them is frightened' },
  flock:    { line: 'a herd in the air: keeps together and scatters at a fright' },
  school:   { line: 'a herd in the water: keeps together and scatters at a fright' },
  solitary: { line: 'lives alone: no group' },
});

const FAMILY = Object.freeze({
  canine: 'pack', feline: 'solitary', equine: 'herd', cervid: 'herd', bovid: 'herd', ursine: 'solitary',
  pachyderm: 'herd', procyonid: 'solitary', macropod: 'herd', rodent: 'solitary', mustelid: 'solitary',
  monotreme: 'solitary', avian: 'flock', crocodilian: 'solitary', testudine: 'solitary', leporid: 'solitary',
  suid: 'herd', giraffid: 'herd', primate: 'herd', squamate: 'solitary', anuran: 'solitary', chiropteran: 'flock',
  chondrichthyan: 'solitary', teleost: 'school', theropod: 'solitary', ceratopsian: 'herd', hadrosaur: 'herd',
  sauropod: 'herd', thyreophoran: 'herd', pterosaur: 'flock', plesiosaur: 'solitary',
  cetacean: 'school',
});

// where a species lives otherwise than its family
const SPECIES_SOCIAL = Object.freeze({
  fox: 'solitary', lion: 'pack', moose: 'solitary', meerkat: 'herd', velociraptor: 'pack',
  baldEagle: 'solitary', greatHornedOwl: 'solitary', vulture: 'solitary', hummingbird: 'solitary', peacock: 'solitary',
  morayEel: 'solitary', pufferfish: 'solitary', orangutan: 'solitary', sloth: 'solitary', hammerhead: 'school', orca: 'pack', humpbackWhale: 'solitary',
});

export function socialOf(species, family) {
  return SPECIES_SOCIAL[species] || FAMILY[family] || 'solitary';
}
