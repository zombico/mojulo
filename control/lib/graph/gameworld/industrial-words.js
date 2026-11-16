/**
 * AN INDUSTRIAL LEVEL'S WORDS — what one says of itself and the reader that holds it to its rails
 * (gameworld/mission-industrial.js plans and lays it). Apart from the level so the game's reader takes the words
 * without the whole of what builds them.
 *
 *   INDUSTRIAL               what one is when it names nothing
 *   readIndustrial(v, at?)   as written → { use, depth, hour, weather, walker, cube? }; throws, teaching
 */
import { CELL } from '../arena-map/blocks.js';
import { PROGRAM_IDS, PROGRAMS } from '../era/programs.js';
import { STATES } from '../weather/weather.js';
import { readHour } from '../era/geocube-hours.js';

export const INDUSTRIAL = Object.freeze({ use: 'warehouse', depth: 33, hour: 'night', weather: 'rain', walker: 'siege-walker' });
const KEYS = ['use', 'depth', 'hour', 'weather', 'walker', 'cube'];

/** An industrial level as written (see the header). */
export function readIndustrial(v = {}, at = 'industrial') {
  const no = (m) => { throw new Error(`gameworld: ${at}${m}`); };
  if (v === true) v = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) no(` is true or { ${KEYS.join('?, ')}? }`);
  const bad = Object.keys(v).find((k) => !KEYS.includes(k));
  if (bad) no(`.${bad} is not an industrial level's word (${KEYS.join(', ')})`);
  const I = { ...INDUSTRIAL, ...v, walker: v.walker === undefined ? INDUSTRIAL.walker : v.walker === false ? null : v.walker };
  const halls = PROGRAM_IDS.filter((u) => PROGRAMS[u].annex);
  if (!halls.includes(I.use)) no(`.use is a building with a hall, its yard before it: ${halls.join(', ')}`);
  if (!(Number.isFinite(I.depth) && I.depth >= 18 && I.depth <= 36 && I.depth % CELL === 0)) no(`.depth is its yard's depth before the building, 18 to 36 m in ${CELL}s (a yard deep enough to fight across, inside its site)`);
  try { readHour(I.hour); } catch (e) { no(`.${e.message}`); }
  if (I.weather !== null && I.weather !== false && !(typeof I.weather === 'string' && STATES[I.weather])) no(`.weather is the air over it (${Object.keys(STATES).join(', ')}), or false`);
  if (I.walker !== null && typeof I.walker !== 'string') no('.walker is the vehicle parked on its yard, by its word (siege-walker), or false');
  return I;
}
