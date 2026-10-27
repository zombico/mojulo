// LURKER: the ambush. It lies still and unseen until the hero is near, then wakes and strikes; it teaches the hero to
// read the ground. Its back is armoured: a stomp hurts the stomper. The crocodile in the reeds, the trapdoor spider.
export const foe = {
  id: 'lurker',
  reads: 'lies unseen until the hero is near, then wakes and strikes; its back hurts a stomper',
  move: 'lurk', pace: 'quick',
  attack: { kind: 'strike', timing: { startup: 18, active: 6, recovery: 30 }, reach: 1.6 },
  mind: { aggressiveness: 'opportunist' },
  fits: { support: ['four', 'none'], size: ['chonky', 'behemoth'] },
  toll: { downs: 2, harm: 2 }, stomp: 'hurts', threat: 3,
  standIn: 'crocodile',
};
