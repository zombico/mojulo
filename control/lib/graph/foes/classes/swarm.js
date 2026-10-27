// SWARM: many weak bodies as one. The pack fans out, rings the hero and closes, two at a time; each goes down to one
// blow, and the threat is the number. Rats, wasps, piranhas.
export const foe = {
  id: 'swarm',
  reads: 'a pack of weak bodies that rings the hero and closes, a few at a time; each one blow',
  move: 'swarm', pace: 'quick',
  attack: { kind: 'contact' },
  mind: { aggressiveness: 'relentless' },
  fits: { support: ['four', 'two', 'none'], size: ['mini', 'smol'] },
  presence: 0.35,
  toll: { downs: 1, harm: 1 }, stomp: 'blow', threat: 1,
  standIn: 'rat',
};
