// BRUTE: slow and heavy. It walks the hero down and swings a blow with a long wind-up that cannot be blocked (the
// lab's red zone): the lesson is to read the wind-up and be elsewhere. Too big to stomp. The bear, the ogre, the golem.
export const foe = {
  id: 'brute',
  reads: 'walks the hero down and swings a heavy blow on a long wind-up; too big to stomp',
  move: 'chase', pace: 'slow',
  attack: { kind: 'strike', timing: { startup: 48, active: 8, recovery: 36 }, reach: 2, zone: 'red' },
  mind: { aggressiveness: 'bold' },
  fits: { support: ['four', 'two'], size: ['chonky', 'behemoth', 'gargantuan'] },
  presence: 1.4,
  toll: { downs: 4, harm: 3 }, stomp: 'bounce', threat: 4,
  standIn: 'brownBear',
};
