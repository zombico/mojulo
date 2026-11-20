/**
 * THE ACTION LEVEL PLANS — the places a stylish game's level is fought through, each a row: a building's use from the era's
 * programs (era/programs.js) with its fight rooms sized for a fight (a ring, the rifts round it, headroom for a launch),
 * the rooms it does not fight in dropped or kept as passages; the kit its rooms are laid in and the cube that dresses it;
 * the light mood it is read in (action-first-level.js LIGHT_MOODS); and which fight each room holds, in the order they are
 * fought (gameroom/fight.js: a duel, a melee, a gallery, the boss). A game names one, and every word is then its own to
 * change: the plan is the first reading, never the level. A new place is a row first.
 *
 *   citadel        a gate court, the great hall, the long gallery, the sanctum: rooms in a chain, the boss on its dais
 *   cathedral      a porch, one long tall nave fought down its length, the sanctuary at its head
 *   catacombs      a stair down, a low gallery, a chamber, the tomb: tight, low and dark
 *   keep           a gatehouse, the great hall, up the stair the solar and the treasury
 *   tower          up a tower a fight a floor: its base, the guard room over it, the lookout at the top
 *   jungle-temple  a temple the jungle has taken: its porch, its nave, its sanctuary, in green light
 *
 *   ACTION_LEVELS     id → the row   ·   ACTION_LEVEL_IDS
 *   levelPlan(id, { cast? }) → { level, fights, grade, mood }: the level (`building`, `goal.tasks`), its fights by the
 *                     room each is for (their waves the kind's, on the undead cast's roles), the screen's grade
 *   planOfWords(text) → the id of the first plan whose words the text says, else null
 *
 * Pure: words in, a recipe out.
 */
import { ACTION_FIGHTS, moodOf } from './action-first-level.js';

// each kind's waves, the citadel's own (its rooms are the kinds': gate a duel, hall a melee, gallery a gallery, sanctum a boss)
const WAVES = Object.freeze(Object.fromEntries(Object.values(ACTION_FIGHTS).map((F) => [F.kind, F.waves])));
const GEN7 = (from, bones) => ({ from, era: 'gen-7', inside: { bones } });

export const ACTION_LEVELS = Object.freeze({
  citadel: Object.freeze({ says: 'a gate court, the great hall, the long gallery, the sanctum: rooms in a chain, the boss on its dais',
    words: ['citadel', 'castle', 'fortress', 'stronghold'], use: 'citadel', cube: GEN7('gothic-night', 'gothic-ashlar'), mood: 'tenebrae',
    rooms: { gate: { h: 10 }, hall: { h: 16 }, gallery: { h: 14 }, sanctum: { h: 18 } },
    fights: [['gate', 'duel'], ['hall', 'melee'], ['gallery', 'gallery'], ['sanctum', 'boss']] }),
  cathedral: Object.freeze({ says: 'a porch, one long tall nave fought down its length, the sanctuary at its head',
    words: ['cathedral', 'church', 'chapel', 'abbey', 'basilica'], use: 'temple', cube: GEN7('gothic-night', 'gothic-nave'), mood: 'cathedral',
    rooms: { narthex: { w: 14, d: 12, h: 10 }, nave: { w: 20, d: 36, h: 22 }, sanctuary: { w: 24, d: 24, h: 18 }, vestry: { drop: true } },
    fights: [['narthex', 'duel'], ['nave', 'melee'], ['sanctuary', 'boss']] }),
  catacombs: Object.freeze({ says: 'a stair down, a low gallery, a chamber, the tomb: tight, low and dark',
    words: ['catacomb', 'catacombs', 'crypt', 'tomb', 'ossuary', 'underground'], use: 'crypt', cube: GEN7('gothic-night', 'catacomb'), mood: 'tenebrae',
    rooms: { stair: { w: 12, d: 12, h: 7 }, gallery: { w: 16, d: 28, h: 7 }, chamber: { w: 20, d: 20, h: 7 }, 'chamber-2': { drop: true }, tomb: { w: 24, d: 24, h: 9 } },
    fights: [['stair', 'duel'], ['gallery', 'gallery'], ['chamber', 'melee'], ['tomb', 'boss']] }),
  keep: Object.freeze({ says: 'a gatehouse, the great hall, up the stair the solar and the treasury',
    words: ['keep', 'manor', 'lord', 'treasury', 'hold'], use: 'keep', cube: GEN7('gothic-night', 'gothic-stone'), mood: 'tenebrae',
    // (the solar stands over the armoury and the treasury over the gatehouse, a storey up: their floors those rooms'; the
    // stair long enough to climb the taller hall's storey)
    rooms: { gatehouse: { w: 24, d: 24, h: 9 }, hall: { w: 22, d: 20, h: 16 }, chapel: { drop: true }, armoury: { w: 16, d: 22, h: 9 }, stair: { w: 8, d: 16 }, solar: { h: 7 }, treasury: { h: 8 } },
    fights: [['gatehouse', 'duel'], ['hall', 'melee'], ['solar', 'gallery'], ['treasury', 'boss']] }),
  tower: Object.freeze({ says: 'up a tower a fight a floor: its base, the guard room over it, the lookout at the top',
    words: ['tower', 'spire', 'ascent', 'climb', 'summit'], use: 'tower', cube: GEN7('gothic-night', 'gothic-stone'), mood: 'moonlit',
    // (every floor stands over the base: its floor the base's; the stair long enough to climb a fight's storey)
    rooms: { base: { w: 22, d: 22, h: 9 }, stair: { w: 8, d: 16 }, guard: { h: 7 }, lookout: { h: 8 } },
    fights: [['base', 'melee'], ['guard', 'gallery'], ['lookout', 'boss']] }),
  'jungle-temple': Object.freeze({ says: 'a temple the jungle has taken: its porch, its nave, its sanctuary, in green light',
    words: ['jungle', 'ruin', 'ruins', 'overgrown', 'aztec', 'maya'], use: 'temple', cube: GEN7('jungle-haze', 'gothic-stone'), mood: 'cathedral',
    rooms: { narthex: { w: 14, d: 12, h: 9 }, nave: { w: 20, d: 32, h: 16 }, sanctuary: { w: 24, d: 24, h: 14 }, vestry: { drop: true } },
    fights: [['narthex', 'duel'], ['nave', 'melee'], ['sanctuary', 'boss']] }),
});
export const ACTION_LEVEL_IDS = Object.freeze(Object.keys(ACTION_LEVELS));

const copy = (v) => JSON.parse(JSON.stringify(v));
/** a plan's level, its fights and its light: the creator's to change by name */
export function levelPlan(id, { mood = null } = {}) {
  const P = ACTION_LEVELS[id];
  if (!P) throw new Error(`gameworld: no action level plan '${id}' (${ACTION_LEVEL_IDS.join(', ')})`);
  const rooms = P.fights.map(([r]) => r), M = moodOf(mood ?? P.mood, rooms);
  const fights = Object.fromEntries(P.fights.map(([r, kind]) => [r, { kind, waves: copy(WAVES[kind]) }]));
  const geocube = { ...copy(P.cube), light: { shade: M.shade } };
  return {
    mood: mood ?? P.mood, fights, grade: M.grade,
    level: { name: `The ${id.replace(/-/g, ' ')}`, building: { use: P.use, rooms: copy(P.rooms), plot: M.plot, geocube }, goal: { tasks: rooms.map((r) => ({ fight: r, at: r })) } },
  };
}
/** the plan a pitch's words name, by its own words; null when none */
export function planOfWords(text) {
  const t = ` ${String(text ?? '').toLowerCase().replace(/[^a-z]+/g, ' ')} `;
  return ACTION_LEVEL_IDS.find((id) => ACTION_LEVELS[id].words.some((w) => t.includes(` ${w} `))) ?? null;
}
