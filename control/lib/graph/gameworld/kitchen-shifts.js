/**
 * THE KITCHEN'S SHIFTS: a kitchen as a level of its own (`levels.<id>.kitchen`), and a campaign of them, each shift a
 * new map and a new menu (`quick.shifts`). A level's kitchen says which layout (worksim/kitchen.js KITCHENS), which menu
 * (a work starter: the sushi counter and its menus, or a card), how hard (a challenge), and how the map is varied:
 * `mirror` (the kitchen flipped, its prep on the other side) and `obstacles` (a counter island in each side's floor).
 * The cooks are the game's (quick.cooks: the seats), never a level's.
 *
 *   SHIFT_KEYS, SHIFTS            a shift's words; the campaign's progression (a new map and a new menu each shift, the
 *                                 challenge rising), the rows a `shifts: n` takes from the top
 *   kitchenOf(quick)              → the kitchen a quick work goal's cooks share ('split' for two or more, or a campaign),
 *                                 or null (one cook, none named: the line by the trail)
 *   readShift(spec, at)           → the shift read (throws, teaching)
 *   shiftsOf(quick)               → the campaign's shifts: `shifts: n` the progression's first n, a list its own, else
 *                                 one shift of the quick game's own words
 *
 * Pure, no heavy imports (the quick door, the world's reader and the levels read it).
 */
import { KITCHEN_IDS } from '../worksim/kitchen.js';
import { SCENARIOS } from '../worksim/scenarios.js';

export const SHIFT_KEYS = Object.freeze(['name', 'kitchen', 'card', 'challenge', 'mirror', 'obstacles', 'serve']);
const CHALLENGES = ['beginner', 'intermediate', 'advanced'];

/** The campaign: each shift a new kitchen and a new menu, the challenge rising (maps the proof plays through: an island
 * suits the sushi counter, a split every menu). */
export const SHIFTS = Object.freeze([
  { name: 'Opening night', kitchen: 'island', card: 'kitchen', challenge: 'beginner' },
  { name: 'The pass', kitchen: 'split', card: 'kitchen', challenge: 'beginner' },
  { name: 'Two pots', kitchen: 'split', mirror: true, card: 'pasta', challenge: 'beginner' },
  { name: 'The wok line', kitchen: 'split', obstacles: true, card: 'wok', challenge: 'intermediate' },
  { name: 'Late service', kitchen: 'split', mirror: true, obstacles: true, card: 'ramen', challenge: 'intermediate' },
  { name: 'The grill', kitchen: 'split', card: 'diner', challenge: 'intermediate' },
  { name: 'Wood oven', kitchen: 'split', mirror: true, card: 'pizzeria', challenge: 'advanced' },
  { name: 'Full house', kitchen: 'split', mirror: true, obstacles: true, card: 'diner', challenge: 'advanced' },
].map((r) => Object.freeze(r)));

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const kitchenOf = (quick) => (quick?.goal !== 'work' ? null : quick.kitchen ?? ((quick.cooks ?? 1) > 1 || quick.shifts !== undefined ? 'split' : null));

export function readShift(spec, at = 'kitchen') {
  const fail = (m) => new Error(`gameworld: ${at}${m}`);
  if (!isObj(spec)) throw fail(` is { ${SHIFT_KEYS.join('?, ')}? }: a kitchen level (its layout, its menu, its challenge, its map's variations)`);
  for (const k of Object.keys(spec)) if (!SHIFT_KEYS.includes(k)) throw fail(`.${k} is not a kitchen's word (${SHIFT_KEYS.join(', ')})`);
  if (spec.name !== undefined && !(typeof spec.name === 'string' && spec.name.trim())) throw fail('.name is the shift\'s name');
  if (spec.kitchen !== undefined && !KITCHEN_IDS.includes(spec.kitchen)) throw fail(`.kitchen is one of ${KITCHEN_IDS.join(', ')}`);
  if (spec.card !== undefined && !(isObj(spec.card) || Object.prototype.hasOwnProperty.call(SCENARIOS, spec.card))) throw fail(`.card is a work starter (${Object.keys(SCENARIOS).join(', ')}) or a card`);
  if (spec.challenge !== undefined && !(CHALLENGES.includes(spec.challenge) || (Number.isFinite(spec.challenge) && spec.challenge >= 0 && spec.challenge <= 1))) throw fail(`.challenge is ${CHALLENGES.join(', ')} or 0..1`);
  for (const k of ['mirror', 'obstacles']) if (spec[k] !== undefined && typeof spec[k] !== 'boolean') throw fail(`.${k} is true or false`);
  if (spec.serve !== undefined && !(Number.isInteger(spec.serve) && spec.serve >= 1 && spec.serve <= 200)) throw fail('.serve is how many orders to serve by the bell, 1 to 200');
  return { ...spec };
}

export function shiftsOf(quick) {
  const S = quick?.shifts;
  if (S === undefined) return [{}];
  if (Number.isInteger(S)) return SHIFTS.slice(0, S).map((r) => ({ ...r }));
  return S.map((s, k) => readShift(s, `quick.shifts[${k}]`));
}
