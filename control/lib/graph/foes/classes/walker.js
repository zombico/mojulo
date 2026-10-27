// WALKER: the first thing a level throws at the hero. It walks its stretch and turns at the ends; it does not notice
// the hero, it is simply in the way. Touching it hurts; a stomp downs it. The goomba and the level-one foot soldier.
export const foe = {
  id: 'walker',
  reads: 'walks its stretch and turns at its ends; touching it hurts, a stomp downs it',
  move: 'pace', pace: 'slow',
  attack: { kind: 'contact' },
  mind: { aggressiveness: 'bold' },
  fits: { support: ['four', 'two', 'none'], size: ['mini', 'smol', 'chonky'] },
  toll: { downs: 1, harm: 1 }, stomp: 'blow', threat: 1,
  standIn: 'guineaPig',
};
