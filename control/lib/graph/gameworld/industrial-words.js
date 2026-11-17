/**
 * AN INDUSTRIAL LEVEL'S WORDS — what one says of itself and the reader that holds it to its rails
 * (gameworld/mission-industrial.js plans and lays it). Apart from the level so the game's reader takes the words
 * without the whole of what builds them.
 *
 *   INDUSTRIAL               what one is when it names nothing
 *   readIndustrial(v, at?)   as written → { use, depth, hour, weather, wet, tower, walker, crew, masked, cube? }; throws, teaching
 */
import { CELL } from '../arena-map/blocks.js';
import { PROGRAM_IDS, PROGRAMS } from '../era/programs.js';
import { STATES } from '../weather/weather.js';
import { readHour } from '../era/geocube-hours.js';
import { readWetness } from '../era/wetness.js';
import { GRUNT_STYLE_IDS } from '../cosmos/packs/comic-hero/grunts.js';

export const INDUSTRIAL = Object.freeze({ use: 'warehouse', depth: 36, hour: 'golden', weather: false, wet: 'wet', tower: true, walker: false, crew: 'privateMilitary', masked: true });
const KEYS = ['use', 'depth', 'hour', 'weather', 'wet', 'tower', 'walker', 'crew', 'masked', 'cube'];

/** An industrial level as written (see the header). */
export function readIndustrial(v = {}, at = 'industrial') {
  const no = (m) => { throw new Error(`gameworld: ${at}${m}`); };
  if (v === true) v = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) no(` is true or { ${KEYS.join('?, ')}? }`);
  const bad = Object.keys(v).find((k) => !KEYS.includes(k));
  if (bad) no(`.${bad} is not an industrial level's word (${KEYS.join(', ')})`);
  const I = { ...INDUSTRIAL, ...v };
  // (one thing stands in the yard's middle: a walker named takes the tower's place unless the tower is asked for too)
  if (v.walker && v.tower === undefined) I.tower = false;
  I.walker = I.walker === false || I.walker === undefined ? null : I.walker;
  // (the ground under a wet weather is the weather's; under none, the level's own word)
  if (I.weather && v.wet === undefined) I.wet = null;
  const halls = PROGRAM_IDS.filter((u) => PROGRAMS[u].annex);
  if (!halls.includes(I.use)) no(`.use is a building with a hall, its yard before it: ${halls.join(', ')}`);
  if (!(Number.isFinite(I.depth) && I.depth >= 18 && I.depth <= 36 && I.depth % CELL === 0)) no(`.depth is its yard's depth before the building, 18 to 36 m in ${CELL}s (a yard deep enough to fight across, inside its site)`);
  try { readHour(I.hour); } catch (e) { no(`.${e.message}`); }
  if (I.weather !== null && I.weather !== false && !(typeof I.weather === 'string' && STATES[I.weather])) no(`.weather is the air over it (${Object.keys(STATES).join(', ')}), or false`);
  if (I.wet !== null && I.wet !== false) { try { readWetness(I.wet); } catch (e) { no(`.${e.message}`); } }
  if (typeof I.tower !== 'boolean') no('.tower is true (high ground on its yard: a railed deck up a stair) or false');
  if (I.tower && I.walker) no(' stands one thing in its yard\'s middle: a tower or a walker');
  if (I.crew === false) I.crew = null;
  if (I.crew !== null && !GRUNT_STYLE_IDS.includes(I.crew)) no(`.crew is who holds the yard, a crew its foes are dressed as (${GRUNT_STYLE_IDS.join(', ')}), or false for the plain stand-in`);
  if (typeof I.masked !== 'boolean') no('.masked is true (its crew masked: a tactical mask, a gas mask, a respirator) or false (their faces shown)');
  if (I.walker !== null && typeof I.walker !== 'string') no('.walker is the vehicle parked on its yard, by its word (siege-walker), or false');
  return I;
}
