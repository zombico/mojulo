// HOPPER: a walker that leaves the ground. It travels in hops, so the hero meets it in the air as often as on the
// floor; timing the stomp is the skill it teaches. Bodies that hop or pronk.
export const foe = {
  id: 'hopper',
  reads: 'travels in hops; touching it hurts, a stomp downs it, and it is as often in the air as on the floor',
  move: 'hop', pace: 'even',
  attack: { kind: 'contact' },
  mind: { aggressiveness: 'bold' },
  fits: { support: ['four', 'two'], size: ['mini', 'smol', 'chonky'], gaits: ['hop', 'pronk'] },
  toll: { downs: 1, harm: 1 }, stomp: 'blow', threat: 1,
  standIn: 'frog',
};
