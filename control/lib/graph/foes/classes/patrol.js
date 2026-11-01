// PATROL: it walks its round between two posts and back, watching ahead in a narrow beam; an intruder it sees it engages,
// and once it has seen no one for a while it takes up its round again. The guard on the wall walk, the sentry on the
// fence line, the night watch with a lamp: the round is what a sneak times.
export const foe = {
  id: 'patrol',
  reads: 'walks its round and back, watching ahead; engages what it sees, then takes up its round again',
  move: 'patrol', pace: 'slow',
  attack: { kind: 'strike' },
  mind: { motivation: 'guard', aggressiveness: 'bold', perception: 'sight', sight: 'narrow' },
  fits: { support: ['four', 'two'], size: ['smol', 'chonky'] },
  presence: 1,
  toll: { downs: 2, harm: 1 }, stomp: 'blow', threat: 2,
  standIn: 'wolf',
};
