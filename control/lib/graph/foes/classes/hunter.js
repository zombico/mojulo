// HUNTER: it hunts the hero down by sight and memory (where it last saw them, it goes and searches), paths round what
// is in its way, fires from a fair way off and takes cover under fire. The soldier in a shooter, the poacher, the raptor.
export const foe = {
  id: 'hunter',
  reads: 'hunts by sight and memory, fires from range, takes cover',
  move: 'chase',
  pace: 'even',
  attack: { kind: 'shot', pattern: 'rifle' },
  mind: { aggressiveness: 'bold', perception: 'memory', pathing: 'navmesh', sight: 'wide', cover: true },
  fits: { support: ['two'] },
  presence: 1,
  toll: { downs: 2, harm: 1 }, stomp: 'blow', threat: 3,
  standIn: 'velociraptor',
};
