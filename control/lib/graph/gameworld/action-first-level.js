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
 *   CITADEL_LOOK       the starter's look, each a default the creator changes by name: its rooms raised to the heights
 *                      the ashlar kit was drawn for (`rooms: { <room>: { h } }`), each room's light designed (`plot`),
 *                      the gothic night read in the seventh generation with its shade deep (`geocube`), and the
 *                      screen's grade (`grade`: tenebrae)
 *   actionStarter({ kit?, boss? }) → { foes, fights, level, grade }: the first level dressed in that look (pitch-start.js)
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

/** the starter's look (a stylish game's first reading: the creator's to change by name, word by word) */
export const CITADEL_LOOK = Object.freeze({
  rooms: Object.freeze({ gate: { h: 10 }, hall: { h: 16 }, gallery: { h: 14 }, sanctum: { h: 18 } }),
  plot: Object.freeze({ gate: { torches: 2, vary: 0.8, lead: 1.4, cold: 1.2 }, hall: { torches: 4, key: 3, lead: 1.5, vary: 0.7, cold: 0.9 },
    gallery: { torches: 6, vary: 1, lead: 1.4 }, sanctum: { torches: 3, key: 3.5, vary: 0.5, cold: 1.6 } }),
  geocube: Object.freeze({ from: 'gothic-night', era: 'gen-7', inside: { bones: 'gothic-ashlar' }, light: { shade: 0.38 } }),
  grade: Object.freeze({ from: 'tenebrae', vignette: 0.35, exposure: 0.25 }),
});
const copy = (v) => JSON.parse(JSON.stringify(v));
export function actionStarter({ kit = 'gothic-ashlar', boss = true } = {}) {
  const A = actionFirstLevel({ kit, boss }), rooms = Object.keys(A.fights);
  const pick = (o) => Object.fromEntries(rooms.filter((r) => o[r]).map((r) => [r, copy(o[r])]));
  const geocube = { ...copy(CITADEL_LOOK.geocube), inside: { bones: kit } };
  // (the geocube dresses it, its bones the kit: a building takes a kit or a geocube, not both)
  const { kit: _k, ...building } = A.level.building;
  return { ...A, level: { ...A.level, building: { ...building, rooms: pick(CITADEL_LOOK.rooms), plot: pick(CITADEL_LOOK.plot), geocube } }, grade: copy(CITADEL_LOOK.grade) };
}
