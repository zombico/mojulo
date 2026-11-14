// PURSUER: it comes at the hero. The moment it sees them, from a fair way off, it leaves where it stood and runs them
// down to swing a blow; it holds no post and goes back to none. Where a guard is met by walking up to it, a pursuer
// meets the hero on the way: the raider on the road, the pack's rank and file, the soldier sent out after you.
export const foe = {
  id: 'pursuer',
  reads: 'comes at the hero it sees, from a fair way off, and swings a blow; it holds no post',
  move: 'chase', pace: 'even',
  attack: { kind: 'strike' },
  mind: { aggressiveness: 'bold', perception: 'sight', sight: 'wide' },
  fits: { support: ['four', 'two'], size: ['smol', 'chonky'] },
  presence: 1,
  toll: { downs: 2, harm: 1 }, stomp: 'blow', threat: 2,
  standIn: 'wolf',
};
