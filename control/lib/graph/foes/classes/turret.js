// TURRET: it never moves. It turns to the hero in range and fires a pattern from the lab's shots; the lesson is the
// pattern (a single aimed shot, a spread, a ring to jump). The spitting plant, the eye in the wall, the cobra.
export const foe = {
  id: 'turret',
  reads: 'never moves; turns to the hero in range and fires its pattern',
  move: 'hold',
  attack: { kind: 'shot', pattern: 'aimed' },
  mind: { aggressiveness: 'bold' },
  fits: {},
  presence: 0.7,
  toll: { downs: 2, harm: 1 }, stomp: 'blow', threat: 2,
  standIn: 'kingCobra',
};
