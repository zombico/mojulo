// CHARGER: sees the hero, braces (the telegraph), and charges in a straight line it cannot turn out of; a wall stuns
// it. The lesson is to step aside, then punish the stun. The boar, the bull, the rhino.
export const foe = {
  id: 'charger',
  reads: 'braces when it sees the hero, then charges in a line; step aside, and a wall stuns it',
  move: 'rush', pace: 'fast',
  attack: { kind: 'charge' },
  mind: { aggressiveness: 'bold' },
  fits: { support: ['four', 'two'], size: ['chonky', 'behemoth', 'gargantuan'] },
  toll: { downs: 2, harm: 2 }, stomp: 'blow', threat: 2,
  standIn: 'wildBoar',
};
