/**
 * AN ACTION GAME'S FIRST LEVEL — the sibling of a platformer's (first-level.js): a building fought through, room by room,
 * each room a fight settled in the practice door's game room and laid by the same rules (tasks.js). What a hero that
 * plays strings is taught, in order:
 *
 *   the gate court    a duel: one armed skeleton, alone, to learn the string on
 *   the great hall    a melee: the dead in waves, slow ones first, then armed ones among them, then one that takes more
 *   the long gallery  a gallery: archers on their perches, a lane to dash down, the sidearm's and the air's answer
 *   the sanctum       the boss: a skeleton knight on its dais
 *
 * On the seventh generation's basis: the ashlar kit, made for tall rooms (era/stage.js `gothic-ashlar`).
 *
 *   UNDEAD_CAST        its bestiary: zombies and armed skeletons (the undead form library's, foes/people.js), each a class
 *                      of the foe shelf: the slow dead, the armed skeleton that comes on, the archer, the armoured dead
 *                      that takes several strings, the knight
 *   ACTION_FIGHTS      its four fights, by the room each is for (`fights`)
 *   actionFirstLevel({ kit?, boss? (true) }) → { foes, fights, level }: the bestiary, the kept fights and the level
 *                      (`building: { use: 'citadel', kit }`, `goal: { tasks }`), to lay on a world that fights hand to hand
 *
 * Pure: words in, a recipe out.
 */
export const UNDEAD_CAST = Object.freeze({
  zombie: Object.freeze({ class: 'walker', skin: Object.freeze({ people: 'zombie' }) }),
  skeleton: Object.freeze({ class: 'pursuer', skin: Object.freeze({ people: 'revenant' }) }),
  archer: Object.freeze({ class: 'hunter', skin: Object.freeze({ people: 'revenant' }) }),
  risen: Object.freeze({ class: 'brute', rank: 'elite', skin: Object.freeze({ people: 'risen' }) }),
  knight: Object.freeze({ class: 'pursuer', rank: 'boss', skin: Object.freeze({ people: 'revenant' }) }),
});

export const ACTION_FIGHTS = Object.freeze({
  gate: Object.freeze({ kind: 'duel', waves: [{ skeleton: 1 }] }),
  hall: Object.freeze({ kind: 'melee', waves: [{ zombie: 3 }, { zombie: 2, skeleton: 2 }, { skeleton: 2, risen: 1 }] }),
  gallery: Object.freeze({ kind: 'gallery', waves: [{ skeleton: 1, archer: 1 }, { skeleton: 2, archer: 2 }] }),
  sanctum: Object.freeze({ kind: 'boss', waves: [{ knight: 1 }] }),
});

export function actionFirstLevel({ kit = 'gothic-ashlar', boss = true } = {}) {
  const rooms = ['gate', 'hall', 'gallery', ...(boss ? ['sanctum'] : [])];
  const fights = Object.fromEntries(rooms.map((r) => [r, { ...ACTION_FIGHTS[r], waves: ACTION_FIGHTS[r].waves.map((w) => ({ ...w })) }]));
  return {
    foes: Object.fromEntries(Object.entries(UNDEAD_CAST).map(([id, e]) => [id, { ...e, skin: { ...e.skin } }])),
    fights,
    level: { name: 'The citadel', building: { use: 'citadel', kit }, goal: { tasks: rooms.map((r) => ({ fight: r, at: r })) } },
  };
}
