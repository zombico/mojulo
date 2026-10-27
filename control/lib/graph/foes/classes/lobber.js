// LOBBER: it keeps its distance and lobs at where the hero stood, so standing still is what it punishes. The monkey
// with the coconut, the crab on the ledge.
export const foe = {
  id: 'lobber',
  reads: 'keeps its place and lobs at where the hero stood; it bursts where it lands',
  move: 'hold',
  attack: { kind: 'lob' },
  mind: { aggressiveness: 'bold' },
  fits: { support: ['four', 'two', 'none'], size: ['smol', 'chonky'] },
  toll: { downs: 1, harm: 1 }, stomp: 'blow', threat: 2,
  standIn: 'capuchin',
};
