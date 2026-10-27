// SWOOPER: the threat from above. It hangs in the air out of reach and weaves, then swoops at the hero on a telegraph
// (a cry, a fold of the wings) and climbs back. The bat, the hawk, the wasp.
export const foe = {
  id: 'swooper',
  reads: 'weaves out of reach, then swoops at the hero on a telegraph and climbs back',
  move: 'dive', pace: 'quick',
  attack: { kind: 'contact' },
  mind: { aggressiveness: 'bold' },
  fits: { size: ['mini', 'smol', 'chonky'] },
  toll: { downs: 1, harm: 1 }, stomp: 'blow', threat: 2,
  standIn: 'fruitBat',
};
