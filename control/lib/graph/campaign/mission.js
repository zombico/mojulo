/**
 * A CAMPAIGN MISSION'S DESIGN — a space mission as one designed thing before its level is built: where it is (the place
 * and its theatre: theatre.js), who is in it (the cast), what is asked (the goals), and how it is told to the pilot (the
 * briefing's steps). It is drawn as a holo briefing (briefing.js) for the person to approve; once approved it is compiled
 * onto a cockpit level (a sortie: gameworld/flight-sortie.js) and built.
 *
 *   mission = {
 *     id, name, status?: 'draft' | 'approved',
 *     place:    { system, cluster, station, moon, star?, seed? }                         (theatre.js readPlace)
 *     theatre:  { field?, moon: { kind, bearing, elevation, size? }, station: { kind, at, side?, heading? },
 *                 rocks?, nav?: { <id>: { name, at } } }                                  (theatre.js readTheatre)
 *     cast:     [ a flight group  { id, name, side, craft?, count?, at?, arrive?, hull?, shields?, hold?, pilot? }
 *                 a capital ship  { id, name, side, capital: <class>, at, heading? }
 *                 a station       is the theatre's, in the cast as 'station' under the place's name ]
 *               `at` a nav point's id or [x, y, z] metres from the start; `pilot` the player's flight (its first craft
 *               the player's, the rest wingmen); `arrive` as a sortie's ('start', { after }, { down, after? }, say?)
 *     goals:    [{ destroy | protect: id | [ids], say? } | { survive: s, say? }]           (over the flight groups)
 *     steps:    [{ title, say, show: [ids], routes?: [[from, to]…] }]                       the briefing, after the
 *               place's opening (the system, the cluster, the station); ids are the cast's and the nav points'
 *   }
 *
 *   readMission(v)        → the mission read (throws, teaching, naming the field)
 *   missionLaws(M)        → [{ law, ok, says }]   the machine gate: every step shows what exists, every foe introduced,
 *                           every goal shown before launch, the pilot's flight in it, the briefing a length a pilot sits
 *                           through; advisory, never refusing
 *   compileMission(M, { airframe? }) → { level, build, approved }   the level a gameworld lays: its airspace (the field,
 *                           the cluster's rocks, the capital ships and the station off the fleet where the briefing showed
 *                           them, `space.fleet`, the numbered moon the sky's large world at its bearing,
 *                           `space.backdrop.toward`) and a sortie of the flight groups; and what was laid, by name
 *   CAST_SIDES · MISSION_STEPS
 *
 * Pure: the same design, the same mission.
 */
import { readPlace, readTheatre, placeLine } from './theatre.js';
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { CAPITAL_CLASSES } from '../fleet/classes.js';
import { readSortie, SORTIE } from '../gameworld/flight-sortie.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export const CAST_SIDES = Object.freeze(['friend', 'foe', 'neutral']);
/** A briefing's length: the fewest and most steps a design writes (the place's opening comes before them). */
export const MISSION_STEPS = Object.freeze({ least: 2, most: 10 });
const GROUP = ['id', 'name', 'side', 'craft', 'count', 'at', 'arrive', 'hull', 'shields', 'hold', 'pilot'];
const CAPITAL = ['id', 'name', 'side', 'capital', 'at', 'heading'];

/** A mission's design read: every fault said, naming its field. */
export function readMission(v) {
  const fail = (m) => { throw new Error(`campaign: mission${m}`); };
  if (!isObj(v)) fail(' is { id, name, place, theatre, cast, goals, steps, status? }');
  for (const k of Object.keys(v)) if (!['id', 'name', 'status', 'place', 'theatre', 'cast', 'goals', 'steps'].includes(k)) fail(`.${k} is not part of a mission's design (id, name, status, place, theatre, cast, goals, steps)`);
  if (typeof v.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(v.id)) fail('.id is a short name (mission-1)');
  if (typeof v.name !== 'string' || !v.name) fail('.name is the mission\'s name');
  if (v.status !== undefined && !['draft', 'approved'].includes(v.status)) fail('.status is draft (the default: designed, not yet approved) or approved (the person approved its briefing)');
  const place = readPlace(v.place);
  const theatre = readTheatre(v.theatre);
  const half = theatre.field / 2;
  if (!Array.isArray(v.cast) || !v.cast.length) fail('.cast is a list: the flight groups and the capital ships');
  const ids = new Set(['station', ...Object.keys(theatre.nav)]);
  const cast = [{ id: 'station', name: placeLine(place).split(' | ')[2], side: theatre.station.side, station: theatre.station.kind, at: theatre.station.at, heading: theatre.station.heading }];
  const where = (a, w) => {
    if (typeof a === 'string') { if (!theatre.nav[a]) fail(`${w}.at '${a}' is not a nav point (${Object.keys(theatre.nav).join(', ')})`); return a; }
    if (!vec3(a) || !a.every((c) => Math.abs(c) <= half)) fail(`${w}.at is a nav point's id or [x, y, z] metres from the start, inside the field (±${half})`);
    return a.slice();
  };
  let pilots = 0;
  for (const [k, c] of v.cast.entries()) {
    const w = `.cast[${k}]`;
    if (!isObj(c)) fail(`${w} is a flight group { id, name, side, craft?, count?, at?, … } or a capital ship { id, name, side, capital, at, heading? }`);
    if (typeof c.id !== 'string' || !/^[a-z][a-z0-9]*$/.test(c.id)) fail(`${w}.id is a short name, lower case letters and digits`);
    if (ids.has(c.id)) fail(`${w}.id '${c.id}' is named twice (the station and the nav points have theirs)`);
    ids.add(c.id);
    if (typeof c.name !== 'string' || !c.name) fail(`${w}.name is what the pilot hears it called`);
    if (!CAST_SIDES.includes(c.side)) fail(`${w}.side is ${CAST_SIDES.join(', ')}`);
    if (c.capital !== undefined) {
      for (const f of Object.keys(c)) if (!CAPITAL.includes(f)) fail(`${w}.${f} is not a capital ship's (${CAPITAL.join(', ')})`);
      if (!CAPITAL_CLASSES[c.capital]) fail(`${w}.capital is a capital ship's class: ${Object.keys(CAPITAL_CLASSES).join(', ')}`);
      if (c.at === undefined) fail(`${w}.at: a capital ship is laid somewhere (a nav point or [x, y, z])`);
      cast.push({ id: c.id, name: c.name, side: c.side, capital: c.capital, at: where(c.at, w), heading: Number.isFinite(c.heading) ? c.heading : 0 });
      continue;
    }
    for (const f of Object.keys(c)) if (!GROUP.includes(f)) fail(`${w}.${f} is not a flight group's (${GROUP.join(', ')})`);
    if (c.side === 'neutral') fail(`${w}.side: a flight group is a friend's or a foe's (a neutral is a capital ship or the station)`);
    if (c.craft !== undefined && (!CRAFT_ARCHETYPES[c.craft] || CRAFT_ARCHETYPES[c.craft].realm !== 'space')) fail(`${w}.craft is a spacecraft of the shelf (craft-shelf/craft-archetypes.js)`);
    if (c.count !== undefined && !(Number.isInteger(c.count) && c.count >= 1 && c.count <= SORTIE.most)) fail(`${w}.count is 1 to ${SORTIE.most}`);
    if (c.pilot !== undefined && c.pilot !== true) fail(`${w}.pilot is true on the player's flight`);
    if (c.pilot) { pilots += 1; if (c.side !== 'friend') fail(`${w}.pilot: the player's flight is a friend's`); }
    cast.push({ id: c.id, name: c.name, side: c.side, craft: c.craft ?? SORTIE.craft[c.side], count: c.count ?? 1, ...(c.at !== undefined ? { at: where(c.at, w) } : {}),
      ...(c.arrive !== undefined ? { arrive: c.arrive } : {}), ...(c.hull !== undefined ? { hull: c.hull } : {}), ...(c.shields !== undefined ? { shields: c.shields } : {}), ...(c.hold ? { hold: true } : {}), ...(c.pilot ? { pilot: true } : {}) });
  }
  if (pilots !== 1) fail('.cast: one flight group is the player\'s (pilot: true)');
  const known = (id) => ids.has(id);
  if (!Array.isArray(v.goals) || !v.goals.length) fail('.goals is a list: { destroy | protect: id | [ids], say? } | { survive: s, say? }');
  const steps = v.steps;
  if (!Array.isArray(steps) || steps.length < MISSION_STEPS.least || steps.length > MISSION_STEPS.most) fail(`.steps is the briefing: ${MISSION_STEPS.least} to ${MISSION_STEPS.most} steps, each { title, say, show, routes? }`);
  const out = steps.map((s, k) => {
    const w = `.steps[${k}]`;
    if (!isObj(s)) fail(`${w} is { title, say, show, routes? }`);
    for (const f of Object.keys(s)) if (!['title', 'say', 'show', 'routes'].includes(f)) fail(`${w}.${f} is not a step's (title, say, show, routes)`);
    if (typeof s.title !== 'string' || !s.title || s.title.length > 32) fail(`${w}.title is a few words (at most 32 letters)`);
    if (typeof s.say !== 'string' || !s.say || s.say.length > 240) fail(`${w}.say is what the briefing officer says, a sentence or two (at most 240 letters)`);
    if (!Array.isArray(s.show) || !s.show.length) fail(`${w}.show is the ids the step is about (the cast's, the nav points', 'station')`);
    for (const id of s.show) if (!known(id)) fail(`${w}.show: '${id}' is in neither the cast nor the nav points`);
    const routes = s.routes ?? [];
    if (!Array.isArray(routes) || routes.some((r) => !Array.isArray(r) || r.length !== 2)) fail(`${w}.routes is a list of [from, to] ids`);
    for (const r of routes) for (const id of r) if (!known(id)) fail(`${w}.routes: '${id}' is in neither the cast nor the nav points`);
    return { title: s.title, say: s.say, show: s.show.slice(), routes: routes.map((r) => r.slice()) };
  });
  return { id: v.id, name: v.name, status: v.status ?? 'draft', place, theatre, cast, goals: JSON.parse(JSON.stringify(v.goals)), steps: out };
}

const groupsOf = (g) => [g.destroy, g.protect].flat().filter((x) => typeof x === 'string');
const posOf = (M, c) => (typeof c.at === 'string' ? M.theatre.nav[c.at].at : c.at);

/** The machine gate over a design: each law, met or not, and what it says. Advisory. */
export function missionLaws(M) {
  const byId = Object.fromEntries(M.cast.map((c) => [c.id, c]));
  const last = M.steps.length - 1;
  const shownBefore = (id, k) => M.steps.slice(0, k).some((s) => s.show.includes(id));
  const goalGroups = [...new Set(M.goals.flatMap(groupsOf))];
  const foes = M.cast.filter((c) => c.side === 'foe');
  const pilot = M.cast.find((c) => c.pilot);
  const law = (id, ok, says) => ({ law: id, ok: !!ok, says });
  const unknownGoal = goalGroups.filter((id) => !byId[id] || !byId[id].craft);
  return [
    law('pilot-first', M.steps.slice(0, 2).some((s) => s.show.includes(pilot.id)), `the pilot sees their own flight (${pilot.name}) in the first two steps`),
    law('foes-introduced', foes.every((c) => M.steps.some((s) => s.show.includes(c.id))), `every foe is shown before launch${foes.filter((c) => !M.steps.some((s) => s.show.includes(c.id))).map((c) => `: ${c.name} never is`).join('')}`),
    law('goals-shown', goalGroups.every((id) => shownBefore(id, last + 1)), 'every group a goal names is shown in the briefing'),
    law('goals-flown', !unknownGoal.length, unknownGoal.length ? `a goal names what a sortie cannot score yet (${unknownGoal.join(', ')}): goals are over flight groups` : 'every goal is over flight groups the sortie scores'),
    law('goals-last', goalGroups.every((id) => M.steps[last].show.includes(id)), 'the last step, the one Launch is pressed from, shows every group a goal names'),
    law('arrivals-told', M.cast.filter((c) => c.arrive && c.arrive !== 'start').every((c) => M.steps.some((s) => s.show.includes(c.id))), 'every group that jumps in is told before it does'),
    law('inside-field', M.cast.every((c) => !c.at || posOf(M, c).every((v) => Math.abs(v) <= M.theatre.field / 2)), 'everything is laid inside the field'),
    law('steps-length', M.steps.length >= 3 && M.steps.length <= 8, `${M.steps.length} steps after the place's three: a pilot sits through three to eight`),
  ];
}

const toAt = (p) => ({ side: p[0], ahead: p[1], up: p[2] });

/** The design compiled: the level a gameworld lays, and what the build lays beyond the sortie. */
export function compileMission(M, { airframe = 'strikeFoil' } = {}) {
  const groups = [];
  for (const c of M.cast) {
    if (!c.craft) continue;
    if (c.pilot) {
      // the player's flight: its first craft is the player's (the level's pilot); the rest fly beside as wingmen
      if (c.count > 1) groups.push({ id: c.id, name: c.name, side: 'friend', craft: c.craft, count: c.count - 1 });
      continue;
    }
    groups.push({ id: c.id, name: c.name, side: c.side, craft: c.craft, count: c.count, ...(c.at ? { at: toAt(posOf(M, c)) } : {}), ...(c.arrive !== undefined ? { arrive: c.arrive } : {}),
      ...(c.hull !== undefined ? { hull: c.hull } : {}), ...(c.shields !== undefined ? { shields: c.shields } : {}), ...(c.hold ? { hold: true } : {}) });
  }
  // (read as the level will read it: a design the sortie cannot fly fails here, naming the field)
  readSortie({ groups, goals: M.goals }, `campaign: mission '${M.id}' compiled`);
  const sortie = { groups, goals: JSON.parse(JSON.stringify(M.goals)) };
  const T = M.theatre;
  // the capital ships and the station, laid off the fleet where the briefing showed them (skyscape/space-fleet.js)
  const fleet = M.cast.filter((c) => c.capital || c.station).map((c) => ({ id: c.id, ...(c.capital ? { capital: c.capital } : { station: c.station }), at: toAt(posOf(M, c)), heading: c.heading ?? 0 }));
  const level = {
    name: M.name,
    airspace: { map: { craft: 'fighter', field: T.field }, space: { asteroids: T.rocks, fleet,
      // (the numbered moon the sky's large world, where the briefing put it)
      backdrop: { worlds: [T.moon.kind], proximity: T.moon.size, toward: { bearing: T.moon.bearing, elevation: T.moon.elevation } } }, airframe, cockpit: true },
    goal: { flight: { sortie } },
  };
  return {
    level,
    approved: M.status === 'approved',
    build: { place: placeLine(M.place), fleet: M.cast.filter((c) => c.capital || c.station).map((c) => ({ id: c.id, name: c.name, side: c.side, kind: c.capital ?? c.station })), moon: { ...T.moon }, rocks: T.rocks },
  };
}
