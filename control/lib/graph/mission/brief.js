/**
 * THE MISSION'S BRIEF — what a first level asks of its ground, read from the game as the game room's brief is
 * (gameroom/needs.js): never a list of games, always what the world already says. Its guns are the firing range's
 * (gameworld/loadout.js loadoutOf), each carried for a band; the bands the kit serves choose the sections, its run sizes
 * them, and each need says why.
 *
 *   readMission(v, at)   a level's `mission` as written → { seed?, sections?, foes?, hold?, waves? }; throws, teaching
 *     true                 the mission the brief reads
 *     seed                 the composition's dice (the level's own when absent)
 *     sections             the sections in order (sections.js SECTIONS), in place of the ones the kit's bands choose
 *     foes                 how many the lane stands (1 to 6, 3): every fight section in proportion
 *     hold, waves          the holdout's clock (15 to 180 s, 40) and its waves (1 to 5, 3)
 *     map                  fought on a fighting map in place of the line (arena-map/): true (the map the kit's longest
 *                          band picks, MISSION_MAPS) or a template's id (arena-map/templates.js TEMPLATE_IDS)
 *                          or a PLACE: { town: true | <geotown recipe>, block?, size? } or { city: true | <geocity
 *                          recipe>, on?, size?, at? }: a window of the design cut as the map (arena-map/read-town.js),
 *                          `at` where a design step put it (arena-map/facility.js)
 *     (gun                 the emplacement's mounted gun: a gap, refused with what it waits on: sections.js)
 *   missionBrief(G, spec) → { guns: [{ name, band }], serves: { close, mid, long }, sections: [kind], yard, run, eye, width,
 *                             scale, hold, waves, camera, map: { template } | null, why: { <need>: words } } | null (a world
 *                             with no guns)
 *   MISSION_MAPS         { <the kit's longest band>: { template, why } }: the map `map: true` picks
 *   MISSION_BUILDINGS    { <the kit's longest band>: { use, why } }: the core building a mission is proposed in
 *
 * Pure, no dice.
 */
import { loadoutOf } from '../gameworld/loadout.js';
import { ARMS_KIT } from '../gameworld/arms-kit.js';
import { feelCard } from '../gameworld/feel/lower.js';
import { SECTIONS, SECTION_IDS, ARCHETYPE_BAND, FIRE_BAND } from './sections.js';
import { TEMPLATE_IDS } from '../arena-map/templates.js';
import { INDUSTRY_SEGMENTS } from '../geocity/segments.js';
import { WATERFRONT_KINDS } from '../geocity/waterfront.js';

// (what a city's cut is held to: arena-map/read-town.js cityOns(), read from its two tables here so the brief does not
// carry the designs)
// (read when asked, never as the module loads: the geocity's tables and this one meet in a ring of imports)
const cityOns = () => [...INDUSTRY_SEGMENTS, ...WATERFRONT_KINDS];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const KEYS = ['seed', 'sections', 'foes', 'hold', 'waves', 'map', 'squad'];
// (asked for by name so it can be answered: readMission says what it waits on)
const GAPS = ['gun'];
export const MISSION_LIMITS = Object.freeze({ sections: [2, 8], foes: [1, 6], hold: [15, 180], waves: [1, 5] });
export const MISSION_DEFAULTS = Object.freeze({ foes: 3, hold: 40, waves: 3 });
// the map a kit is fought on, by the longest band it serves: close guns alone a tower, where every fight is across a
// room or down a well; the mid band a court under a gallery; a long gun the figure of eight, the longest lines of the
// templates (none is sized for the long band yet: arena-map's templates are the mid band's)
export const MISSION_MAPS = Object.freeze({
  close: Object.freeze({ template: 'stack', why: 'close guns alone: a tower round a well, every fight across a room or up and down' }),
  mid: Object.freeze({ template: 'courtyard', why: 'the mid band: a court under a gallery, the court the heart both rings see' }),
  long: Object.freeze({ template: 'figure-eight', why: 'a long gun: the figure of eight, the longest lines the templates have (none is sized for the long band yet)' }),
});

// the building a kit's mission is proposed in (gameworld/mission-building.js), by the longest band it serves: a core
// building each (era/programs.js), a closed table
export const MISSION_BUILDINGS = Object.freeze({
  close: Object.freeze({ use: 'armoury', why: 'close guns alone: an armoury, one storey of cages off a corridor, every fight across a room or round a door' }),
  mid: Object.freeze({ use: 'warehouse', why: 'the mid band: a warehouse, its offices over the lockers down a corridor, the tall shed and its gallery the long room' }),
  long: Object.freeze({ use: 'hangar-bay', why: 'a long gun: a hangar bay, the longest floor of the core buildings under a gallery, its wings for the near fights' }),
});

/** A level's `mission`, read. */
export function readMission(v, at = 'mission') {
  if (v === true) return {};
  const no = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) no(` is true (the mission its guns ask for), or { ${KEYS.join('?, ')}? }`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k) && !GAPS.includes(k)) no(`.${k} is not a mission setting (${KEYS.join(', ')})`);
  const L = MISSION_LIMITS, out = {};
  if (v.seed !== undefined) { if (!Number.isInteger(v.seed)) no('.seed is a whole number'); out.seed = v.seed; }
  if (v.sections !== undefined) {
    const S = v.sections;
    if (!Array.isArray(S) || S.length < L.sections[0] || S.length > L.sections[1]) no(`.sections is ${L.sections[0]} to ${L.sections[1]} of ${SECTION_IDS.join(', ')}, in the order they are played`);
    S.forEach((s, i) => { if (!SECTIONS[s]) no(`.sections[${i}]: '${s}' is not a section (${SECTION_IDS.join(', ')})`); });
    S.forEach((s, i) => { if (SECTIONS[s].gap) no(`.sections[${i}]: '${s}' is designed, not built: ${SECTIONS[s].gap}`); });
    if (new Set(S).size !== S.length) no('.sections names a section twice: each is laid once');
    if (!S.some((s) => SECTIONS[s].task === 'reach')) no('.sections has no way out: end it with extract');
    out.sections = S.slice();
  }
  for (const k of ['foes', 'waves']) if (v[k] !== undefined) { if (!Number.isInteger(v[k]) || v[k] < L[k][0] || v[k] > L[k][1]) no(`.${k} is ${L[k][0]} to ${L[k][1]}`); out[k] = v[k]; }
  if (v.hold !== undefined) { if (!Number.isFinite(v.hold) || v.hold < L.hold[0] || v.hold > L.hold[1]) no(`.hold is the seconds the yard is held, ${L.hold[0]} to ${L.hold[1]}`); out.hold = v.hold; }
  // (`squad`: who fights beside the pilot, 0 to 2: a body each, at the pilot's shoulder, on the pilot's side)
  if (v.squad !== undefined) { if (!Number.isInteger(v.squad) || v.squad < 0 || v.squad > 2) no('.squad is how many fight beside the pilot, 0 to 2'); out.squad = v.squad; }
  if (v.map !== undefined) {
    if (isPlace(v.map)) out.map = readPlace(v.map, no);
    else { if (v.map !== true && !TEMPLATE_IDS.includes(v.map)) no(`.map is true (the map the kit picks), a template (${TEMPLATE_IDS.join(', ')}), or a place: { town: <a geotown> } or { city: <a geocity>, on: ${cityOns().join(' | ')} }`); out.map = v.map; }
  }
  // (the emplacement and its gun: a gap, said with what would close it; nothing is laid half)
  if (v.gun !== undefined) no(`.gun asks for the emplacement, which is designed, not built: ${SECTIONS.emplacement.gap}`);
  return out;
}

// A PLACE (`map: { town } | { city, on }`): a window of a designed geotown or geocity cut as the map (arena-map/
// read-town.js), then grown under the laws with its buildings, water and fences kept. `size` its side in metres
const isPlace = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const PLACE_KEYS = ['town', 'city', 'on', 'block', 'size', 'at'];
function readPlace(v, no) {
  const bad = Object.keys(v).find((k) => !PLACE_KEYS.includes(k));
  if (bad) no(`.map.${bad} is not a place's word (${PLACE_KEYS.join(', ')})`);
  if ((v.town === undefined) === (v.city === undefined)) no('.map is a place of a town or of a city: { town: <a geotown recipe> } or { city: <a geocity recipe>, on }');
  const obj = (x) => x === true || (x != null && typeof x === 'object' && !Array.isArray(x));
  if (v.town !== undefined && !obj(v.town)) no('.map.town is true (one block of houses) or a geotown recipe ({ segment: \'main-street\' })');
  if (v.city !== undefined && !obj(v.city)) no('.map.city is true (the metro as it is) or a geocity recipe');
  if (v.on !== undefined && (v.city === undefined || !cityOns().includes(v.on))) no(`.map.on is what a city's cut is held to: ${cityOns().join(', ')}`);
  if (v.block !== undefined && (v.town === undefined || typeof v.block !== 'string')) no('.map.block is a town\'s block by its id (A1)');
  if (v.size !== undefined && !(Number.isFinite(v.size) && v.size >= PLACE_SIZE[0] && v.size <= PLACE_SIZE[1])) no(`.map.size is the cut's side in metres, ${PLACE_SIZE[0]} to ${PLACE_SIZE[1]}`);
  // (where the cut stands, a design step's answer: arena-map/facility.js designFacility)
  if (v.at !== undefined && !(v.city !== undefined && Array.isArray(v.at) && v.at.length === 2 && v.at.every(Number.isFinite))) no('.map.at is a city cut\'s middle in the design\'s metres, [x, y]');
  const more = v.at !== undefined ? { at: v.at.slice() } : {};
  return { ...more, ...(v.town !== undefined ? { town: v.town === true ? {} : structuredClone(v.town), ...(v.block ? { block: v.block } : {}) } : { city: v.city === true ? {} : structuredClone(v.city), on: v.on ?? cityOns()[0] }), size: v.size ?? PLACE_SIZE[2] };
}
/** A place's cut: its least and most side, and the side a mission cuts when it names none (metres). */
export const PLACE_SIZE = Object.freeze([24, 54, 48]);

// the band a weapon is carried for: a kit word its archetype's, a weapon written by its fire type that type's
function bandOf(w) {
  if (typeof w === 'string') return ARCHETYPE_BAND[ARMS_KIT[w]?.as] ?? 'mid';
  if (w && w.fire) return FIRE_BAND[w.fire] ?? null;
  return 'mid';
}

/** The brief (see the header), or null for a world that carries no gun. */
export function missionBrief(G, spec = {}) {
  const L = loadoutOf(G);
  if (!L) return null;
  const guns = L.weapons.map((w) => ({ name: typeof w === 'string' ? w : w.name, band: bandOf(w) }));
  const has = (b) => guns.some((g) => g.band === b);
  // a band is served by a gun carried for it, or for a longer one: a rifle works across a room, a shotgun not down a hall
  const serves = { close: guns.some((g) => g.band), mid: has('mid') || has('long'), long: has('long') };
  const why = {};
  why.guns = `${guns.map((g) => `${g.name}${g.band ? ` (${g.band})` : ' (the free hand)'}`).join(', ')}: the firing range's, read from ${L.from === 'template' ? `the feel's template` : L.from === 'quick' ? 'the carried kit' : 'what the hero carries'}`;
  const card = G?.feel != null ? feelCard(G.feel) : null, run = card ? card.ground.run : 4.5;
  why.run = card ? `the feel's run, ${run} m/s` : 'a person\'s run, 4.5 m/s (no feel written)';
  const width = clamp(2 * Math.round((run * 3.5) / 2), 14, 22);
  why.width = `${width} m across: three and a half seconds of the run, room to flank and none to hide in`;
  const chosen = ['staging', 'contact', ...(serves.mid ? ['lane'] : []), ...(serves.long ? ['overwatch'] : []), 'holdout', 'extract'];
  const sections = spec.sections ?? chosen;
  why.sections = spec.sections ? 'written on the level' : serves.long ? 'a long gun: the long line too' : serves.mid ? 'no long gun: no long line' : 'close guns only: a room and a yard';
  // the yard tests what the kit was taught: held at the mid band where a gun reaches it, else across a room
  const yard = serves.mid ? 'mid' : 'close';
  why.yard = yard === 'mid' ? 'the yard is held at the mid band: a gun carried reaches it' : 'the yard is a room\'s length: no gun carried reaches further';
  const foes = spec.foes ?? MISSION_DEFAULTS.foes;
  why.foes = `${foes} down the lane, every fight in proportion`;
  const top = serves.long ? 'long' : serves.mid ? 'mid' : 'close', map = spec.map === undefined ? null : isPlace(spec.map) ? { template: 'given', place: spec.map } : { template: spec.map === true ? MISSION_MAPS[top].template : spec.map };
  if (map) why.map = map.place ? `a ${map.place.size} m cut of ${map.place.town ? `a town's ${map.place.town.segment ?? 'houses'} block` : `a city's ${map.place.on}`}, its buildings and water kept, cover grown on its open ground under the laws` : spec.map === true ? MISSION_MAPS[top].why : `the ${map.template} map, written on the level`;
  return {
    guns, serves, sections, yard, run, eye: 1.7, width, scale: foes / MISSION_DEFAULTS.foes,
    hold: spec.hold ?? MISSION_DEFAULTS.hold, waves: spec.waves ?? MISSION_DEFAULTS.waves, camera: G?.camera ?? null, map, why, ...(spec.squad ? { squad: spec.squad } : {}),
  };
}
