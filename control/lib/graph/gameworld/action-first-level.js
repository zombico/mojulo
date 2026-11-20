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
 *                      the ashlar kit was drawn for (`rooms: { <room>: { h } }`) and the gothic night read in the
 *                      seventh generation (`geocube`); its light a mood's (below)
 *   LIGHT_MOODS        a building level's light as one word (tenebrae, moonlit, hellfire, cathedral): its rooms' `plot`,
 *                      its cube's `light.shade` and the world's `grade`; moodOf(mood, rooms) → { plot, shade, grade }
 *   actionStarter({ kit?, boss?, mood? ('tenebrae') }) → { foes, fights, level, grade }: the first level dressed in that
 *                      look (pitch-start.js)
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

/** THE LIGHT MOODS: a building level's light as one word, three writes (each room's `plot`, the cube's `light.shade`, the
 * world's `grade`), each a named reading the creator picks and then changes word by word. A room the mood does not name
 * takes its `room`. A new mood is a row. */
export const LIGHT_MOODS = Object.freeze({
  tenebrae: Object.freeze({ says: 'fire in the dark: torches by the way on, each flame its own, the shade black, a moonlit window where the room is tall',
    shade: 0.38, grade: { from: 'tenebrae', vignette: 0.35, exposure: 0.25 }, room: { torches: 3, vary: 0.7, lead: 1.4 },
    rooms: { gate: { torches: 2, vary: 0.8, lead: 1.4, cold: 1.2 }, hall: { torches: 4, key: 3, lead: 1.5, vary: 0.7, cold: 0.9 }, gallery: { torches: 6, vary: 1, lead: 1.4 }, sanctum: { torches: 3, key: 3.5, vary: 0.5, cold: 1.6 } } }),
  moonlit: Object.freeze({ says: 'the moon through the windows: few flames, a cold fill, the stone silver-blue',
    shade: 0.3, grade: { from: 'cold', vignette: 0.4 }, room: { torches: 1, fill: 0.6, cold: 2.5, vary: 0.4 },
    rooms: { hall: { torches: 2, fill: 0.6, cold: 3, vary: 0.4 }, sanctum: { torches: 1, key: 2, cold: 3.5, vary: 0.3 } } }),
  hellfire: Object.freeze({ says: 'a burning keep: flames everywhere, the hung light hot, no cold at all',
    shade: 0.3, grade: { from: 'warm', vignette: 0.45, exposure: 0.2 }, room: { torches: 7, key: 3, vary: 1, lead: 2 },
    rooms: { sanctum: { torches: 9, key: 4.5, vary: 1, lead: 2.5 } } }),
  cathedral: Object.freeze({ says: 'high light: the hung lights strong, the fill up, the flames few and steady',
    shade: 0.55, grade: { from: 'film', exposure: 0.3 }, room: { torches: 2, key: 5, fill: 1.5, vary: 0.3 },
    rooms: {} }),
});
export const MOOD_IDS = Object.freeze(Object.keys(LIGHT_MOODS));
/** a mood on a building's rooms → { plot, shade, grade } */
export function moodOf(mood, rooms) {
  const M = LIGHT_MOODS[mood];
  if (!M) throw new Error(`gameworld: no light mood '${mood}' (${MOOD_IDS.join(', ')})`);
  return { plot: Object.fromEntries(rooms.map((r) => [r, { ...(M.rooms[r] ?? M.room) }])), shade: M.shade, grade: { ...M.grade } };
}

/** the starter's look (a stylish game's first reading: the creator's to change by name, word by word) */
export const CITADEL_LOOK = Object.freeze({
  rooms: Object.freeze({ gate: { h: 10 }, hall: { h: 16 }, gallery: { h: 14 }, sanctum: { h: 18 } }),
  geocube: Object.freeze({ from: 'gothic-night', era: 'gen-7', inside: { bones: 'gothic-ashlar' } }),
});
const copy = (v) => JSON.parse(JSON.stringify(v));
export function actionStarter({ kit = 'gothic-ashlar', boss = true, mood = 'tenebrae' } = {}) {
  const A = actionFirstLevel({ kit, boss }), rooms = Object.keys(A.fights), M = moodOf(mood, rooms);
  const pick = (o) => Object.fromEntries(rooms.filter((r) => o[r]).map((r) => [r, copy(o[r])]));
  const geocube = { ...copy(CITADEL_LOOK.geocube), inside: { bones: kit }, light: { shade: M.shade } };
  // (the geocube dresses it, its bones the kit: a building takes a kit or a geocube, not both)
  const { kit: _k, ...building } = A.level.building;
  return { ...A, level: { ...A.level, building: { ...building, rooms: pick(CITADEL_LOOK.rooms), plot: M.plot, geocube } }, grade: M.grade };
}
