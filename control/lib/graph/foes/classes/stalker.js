// STALKER: the hunter. It hunts the hero round obstacles, remembers where it last saw it and searches there, and
// strikes only when the hero cannot answer. The wolf, the raptor, the panther.
export const foe = {
  id: 'stalker',
  reads: 'hunts the hero round obstacles, searches where it last saw it, and strikes when the hero cannot answer',
  move: 'chase', pace: 'quick',
  attack: { kind: 'strike', timing: { startup: 24, active: 6, recovery: 24 }, reach: 1.4 },
  mind: { aggressiveness: 'opportunist', perception: 'memory', pathing: 'navmesh' },
  fits: { support: ['four', 'two'], size: ['chonky', 'behemoth'] },
  presence: 0.9,
  toll: { downs: 2, harm: 2 }, stomp: 'blow', threat: 3,
  standIn: 'wolf',
};
