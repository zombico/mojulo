// SUMMONER: it keeps its place and calls others into the fight, a few at a time; its threat is what it calls (its entry's
// `summons`: any foe of the bestiary). Bound summons fall with it, the strings cut; a stunned summoner's go slack. The
// necromancer, the puppetmaster, the hive queen.
export const foe = {
  id: 'summoner',
  reads: 'keeps its place and calls its summons in, a few at a time',
  move: 'hold',
  attack: { kind: 'call' },
  mind: { aggressiveness: 'wary' },
  fits: { support: ['four', 'two', 'wingwalk', 'none'] },
  presence: 1,
  toll: { downs: 3, harm: 0 }, stomp: 'blow', threat: 3,
  standIn: 'greatHornedOwl',
};
