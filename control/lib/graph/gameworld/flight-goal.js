/**
 * THE FLIGHT GOAL — what an airspace level is flown for, read once for both doors: a quick game's goal (`fly`, `shoot`
 * with a craft) and a designed level's (`levels.<id>.goal.flight`). A lesson, a stage and a sortie are the same thing
 * here: an airspace (skyscape/), a goal over it, and what the goal stands in it.
 *
 *   course    the course's gates in three dimensions, then a landing on the runway, round its laps, against the clock
 *             (skyscape/course.js flightLaps: the laps mechanic, a crash coming back at the last gate passed)
 *   dogfight  a wing of fighters, every one shot down (skyscape/dogfight.js): the craft's hp taken by their hits and by a
 *             crash, which comes back aloft at the start; `waves` wings, each woken when the one before is down
 *   trench    a battle station's trench flown to its port, the port shot (skyscape/trench.js): won by the port alone
 *   tasks     a list done in order (game/objectives.js), in the level's own words:
 *               { gates: true | [from, to] }            the course's gates (all, or gates from..to, counted from 1)
 *               { land: true }                          set down soft on a runway or a pad of the map
 *               { band: { alt?, agl?, speed?, climb?, bank?, heading? }, seconds, total? }
 *                                                       hold the pilot in the band (the HUD's units: m, knots, m/s, degrees)
 *               { reach: [x, y, z] | { gate: n }, radius? }   a nav point: fly to it
 *               { down: n | true }                      the next n of the level's fighters shot down (true: WING.n); they
 *                                                       are minted asleep and woken as the task begins
 *             each with an optional `text` (what the player is told; a plain one is written when absent). A crash is
 *             `crash`: 'fail' (the attempt is over: a lesson's, the default with no fighters) or 'respawn' (it comes
 *             back at the start, costing hp: the default with fighters, whose hits the level's hp takes too)
 *
 *   readFlightGoal(v, at)          → { kind, foes?, waves?, tasks?, crash? }; throws, teaching
 *   flightGoalOfQuick(quick)       → the quick game's flight goal, or null (not a flight)
 *   defaultFlightGoal(airspace)    → what an airspace with no goal is flown for: its course, its trench, else null
 *   flightGoalMechanics(goal, ends)→ the level's mechanics (ends: levels.js airspaceEnds)
 *   flightGoalCast(goal, ends)     → { entities, pilot, camera } the goal stands (its fighters, the craft's guns), or null
 *   flightLegend(goal)             → the keys its play adds to the level's legend, or null
 *
 * Pure: no database, no clock, no dice (the cast's dice are the dogfight's, seeded by its map).
 */
import { flightLaps, padBoxes } from '../skyscape/course.js';
import { dogfightCast, waveIds, WING } from '../skyscape/dogfight.js';
import { BAND_FACTS } from '../game/objectives.js';

/** A fight in the air's costs: the craft's hp, what a hit on it takes, and what a crash does. */
export const DOGFIGHT = Object.freeze({ hp: 100, hit: 4, crash: 25 });
export const FLIGHT_GOALS = Object.freeze(['course', 'dogfight', 'trench', 'tasks']);
export const FLIGHT_TASKS = Object.freeze(['gates', 'land', 'band', 'reach', 'down']);
export const FLIGHT_CRASH = Object.freeze(['fail', 'respawn']);
/** The legend a fight in the air adds: the craft's guns and missiles, its flares, boost and roll. */
export const FIGHT_LEGEND = 'click or Z  guns · R  missile · X  flare · F  boost · Q / E  roll';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const SHAPE = `is 'course' | 'dogfight' | 'trench', { dogfight: true | { foes?, waves? } }, or { tasks: [ ${FLIGHT_TASKS.map((k) => `{ ${k} }`).join(' | ')} ], crash?: ${FLIGHT_CRASH.join(' | ')} }`;

/** A flight goal in a level's words, read and taught. */
export function readFlightGoal(v, at = 'goal.flight') {
  const fail = (m) => { throw new Error(`gameworld: ${at}${m}`); };
  if (v === 'course' || v === 'dogfight' || v === 'trench') return { kind: v };
  if (!isObj(v)) fail(` ${SHAPE}`);
  const keys = Object.keys(v);
  if (v.dogfight !== undefined) {
    if (keys.length !== 1) fail(': a dogfight is { dogfight: true | { foes?, waves? } } alone');
    const D = v.dogfight === true ? {} : v.dogfight;
    if (!isObj(D) || Object.keys(D).some((k) => k !== 'foes' && k !== 'waves')) fail('.dogfight is true or { foes?, waves? }');
    for (const k of ['foes', 'waves']) if (D[k] !== undefined && !(Number.isInteger(D[k]) && D[k] >= 1 && D[k] <= WING.max)) fail(`.dogfight.${k} is a whole number, 1 to ${WING.max}`);
    return { kind: 'dogfight', ...(D.foes !== undefined ? { foes: D.foes } : {}), ...(D.waves !== undefined ? { waves: D.waves } : {}) };
  }
  if (v.tasks === undefined) fail(` ${SHAPE}`);
  for (const k of keys) if (k !== 'tasks' && k !== 'crash') fail(`.${k} is not a flight goal's (tasks, crash)`);
  if (v.crash !== undefined && !FLIGHT_CRASH.includes(v.crash)) fail(`.crash is ${FLIGHT_CRASH.join(' or ')}: what a crash does`);
  if (!Array.isArray(v.tasks) || !v.tasks.length) fail('.tasks is a list, at least one, done in order');
  const tasks = v.tasks.map((t, k) => {
    const where = `.tasks[${k}]`;
    if (!isObj(t)) fail(`${where} is { ${FLIGHT_TASKS.join(' | ')}, text? }`);
    const kind = FLIGHT_TASKS.filter((f) => t[f] !== undefined);
    if (kind.length !== 1) fail(`${where} is one of ${FLIGHT_TASKS.join(', ')} (with its own settings), ${kind.length ? `not ${kind.join(' and ')}` : 'none given'}`);
    const K = kind[0], own = { gates: [], land: [], band: ['seconds', 'total'], reach: ['radius'], down: [] }[K];
    for (const f of Object.keys(t)) if (f !== K && f !== 'text' && !own.includes(f)) fail(`${where}.${f} is not a ${K} task's (${[K, ...own, 'text'].join(', ')})`);
    if (t.text !== undefined && !(typeof t.text === 'string' && t.text)) fail(`${where}.text is what the player is told`);
    if (K === 'gates' && !(t.gates === true || (Array.isArray(t.gates) && t.gates.length === 2 && t.gates.every((n) => Number.isInteger(n) && n >= 1) && t.gates[0] <= t.gates[1]))) fail(`${where}.gates is true (every gate) or [from, to] (counted from 1)`);
    if (K === 'land' && t.land !== true) fail(`${where}.land is true: set down on a runway or a pad of the map`);
    if (K === 'band') {
      if (!isObj(t.band) || !Object.keys(t.band).length) fail(`${where}.band is { ${BAND_FACTS.join('?, ')}? }, each [min, max]`);
      for (const f of Object.keys(t.band)) {
        const r = t.band[f];
        if (!BAND_FACTS.includes(f)) fail(`${where}.band.${f} is not a gauge (${BAND_FACTS.join(', ')})`);
        if (!(Array.isArray(r) && r.length === 2 && r.every((x) => x === null || Number.isFinite(x)) && !(r[0] === null && r[1] === null))) fail(`${where}.band.${f} is [min, max], each a number or null (open), not both null`);
      }
      if (!(Number.isFinite(t.seconds) && t.seconds > 0)) fail(`${where}.seconds is how long the band is held, above 0`);
      if (t.total !== undefined && typeof t.total !== 'boolean') fail(`${where}.total is true (the seconds add up) or false (held in one go)`);
    }
    if (K === 'reach' && !(isVec(t.reach) || (isObj(t.reach) && Number.isInteger(t.reach.gate) && t.reach.gate >= 1 && Object.keys(t.reach).length === 1))) fail(`${where}.reach is [x, y, z] (metres) or { gate: n } (the course's nth gate)`);
    if (K === 'reach' && t.radius !== undefined && !(Number.isFinite(t.radius) && t.radius > 0)) fail(`${where}.radius is metres, above 0`);
    if (K === 'down' && !(t.down === true || (Number.isInteger(t.down) && t.down >= 1 && t.down <= WING.max))) fail(`${where}.down is true (a wing of ${WING.n}) or how many, 1 to ${WING.max}`);
    return t;
  });
  return { kind: 'tasks', tasks, ...(v.crash !== undefined ? { crash: v.crash } : {}) };
}

/** The quick game's flight goal: `fly` a course, `shoot` with a craft a dogfight (a trench run when its space says so). */
export function flightGoalOfQuick(quick) {
  if (!quick) return null;
  if (quick.goal === 'fly') return { kind: 'course' };
  if (quick.goal === 'shoot' && quick.craft !== undefined) return quick.airspace?.space?.trench ? { kind: 'trench' } : { kind: 'dogfight', ...(quick.foes !== undefined ? { foes: quick.foes } : {}), ...(quick.waves !== undefined ? { waves: quick.waves } : {}) };
  return null;
}

/** What an airspace with no goal of its own is flown for: its course when it has one, its trench when it has one. */
export function defaultFlightGoal(airspace) {
  if (airspace?.space?.trench) return { kind: 'trench' };
  if (airspace?.course) return { kind: 'course' };
  return null;
}

// a task's count of fighters, and the fighters each down task wakes, in order (foe-1 …)
const downCount = (t) => (t.down === true ? WING.n : t.down);
function wingOf(goal) {
  const per = goal.tasks.filter((t) => t.down !== undefined).map(downCount);
  let n = 0;
  return { total: per.reduce((a, b) => a + b, 0), most: per.length ? Math.max(...per) : 0, bands: per.length, ids: per.map((c) => Array.from({ length: c }, () => `foe-${++n}`)) };
}
// a band in words: "280 to 320 m, 85 to 95 kt"
const UNIT = { alt: 'm', agl: 'm over the ground', speed: 'kt', climb: 'm/s climbing', bank: '° of bank', heading: '' };
function bandText(t) {
  const part = (f) => {
    const [lo, hi] = t.band[f], u = UNIT[f];
    const say = lo === null ? `under ${hi}` : hi === null ? `over ${lo}` : `${lo} to ${hi}`;
    return f === 'heading' ? `heading ${say}` : `${say} ${u}`.trim();
  };
  return `Hold ${Object.keys(t.band).map(part).join(', ')} for ${t.seconds} s`;
}

/** The goal's mechanics on the level's airspace (`ends`: levels.js airspaceEnds). */
export function flightGoalMechanics(goal, ends) {
  const map = ends.airMap, field = ends.airField, seat = ends.seat, course = ends.course, p = seat.transform;
  const fail = (m) => { throw new Error(`gameworld: goal.flight: ${m}`); };
  if (goal.kind === 'course') {
    if (!course) fail('a course is flown on a course: give the airspace one (course: true)');
    return [flightLaps(course, map, field, seat)];
  }
  if (goal.kind === 'dogfight' || goal.kind === 'trench') {
    if (goal.kind === 'trench' && !field.port) fail('a trench run needs a trench: the airspace\'s space is { trench: true }');
    return [
      { kind: 'fail-on-death', startHp: DOGFIGHT.hp, hits: DOGFIGHT.hit },
      { kind: 'respawn', at: { spot: p.pos, heading: p.heading, aloft: 1 }, hurt: DOGFIGHT.crash },
      // a dogfight in waves: wing after wing, each woken when the one before is down (dogfight.js waveIds); a trench run
      // won by its port alone; a dogfight by the wing
      ...(goal.waves && !field.port ? [{ kind: 'waves', waves: waveIds(goal.waves, goal.foes ?? WING.n), clear: true }] : [
        { kind: 'defeat-all', who: 'foe-*', count: field.port ? 1 : Math.max(1, Math.min(WING.max, goal.foes ?? WING.n)), label: field.port ? 'Port' : 'Down' }]),
    ];
  }
  // a list of tasks done in order (game/objectives.js), each said in the air's own terms
  const W = wingOf(goal), pads = padBoxes(field), gates = course?.gates ?? [];
  let d = 0;
  const tasks = goal.tasks.map((t, k) => {
    const id = `t${k + 1}`;
    if (t.gates !== undefined) {
      if (!gates.length) fail(`tasks[${k}]: gates are a course's: give the airspace one (course: true)`);
      const [a, b] = t.gates === true ? [1, gates.length] : t.gates;
      if (b > gates.length) fail(`tasks[${k}].gates: the course has ${gates.length} gates`);
      return { id, kind: 'gates', text: t.text ?? (t.gates === true ? 'Fly the gates' : `Fly gates ${a} to ${b}`), gates: gates.slice(a - 1, b).map((g) => ({ at: g.at, radius: g.radius })) };
    }
    if (t.land !== undefined) {
      if (!pads.length) fail(`tasks[${k}]: a landing needs a runway or a pad on the map (ground.pads)`);
      return { id, kind: 'land', text: t.text ?? 'Land on the runway', pads };
    }
    if (t.band !== undefined) return { id, kind: 'band', text: t.text ?? bandText(t), band: t.band, seconds: t.seconds, ...(t.total ? { total: true } : {}) };
    if (t.reach !== undefined) {
      const at = Array.isArray(t.reach) ? t.reach : gates[t.reach.gate - 1]?.at;
      if (!at) fail(`tasks[${k}].reach.gate: the course has ${gates.length} gates`);
      return { id, kind: 'reach', text: t.text ?? 'Fly to the marker', at, radius: t.radius ?? (Array.isArray(t.reach) ? 60 : gates[t.reach.gate - 1].radius), planar: false };
    }
    const foes = W.ids[d++];
    return { id, kind: 'clear', text: t.text ?? (foes.length === 1 ? 'Shoot down the fighter' : `Shoot down the ${foes.length} fighters`), foes };
  });
  const crash = goal.crash ?? (W.total ? 'respawn' : 'fail');
  return [
    { kind: 'objectives', tasks },
    ...(W.total ? [{ kind: 'fail-on-death', startHp: DOGFIGHT.hp, hits: DOGFIGHT.hit }] : []),
    crash === 'fail'
      ? { kind: 'crash', then: 'fail', ...(pads.length ? { pads } : {}) }
      : { kind: 'crash', then: 'respawn', ...(pads.length ? { pads } : {}), at: { spot: p.pos, heading: p.heading, aloft: map.form === 'void' || seat.rule.engine === false ? 1 : 0 }, ...(W.total ? { hurt: DOGFIGHT.crash } : {}) },
  ];
}

/** What the goal stands in the airspace: its fighters (asleep until their task wakes them), the trench's port and
 * turrets, the craft's guns and a mouse that flies it; null when it stands nothing (a course, a lesson). */
export function flightGoalCast(goal, ends) {
  const map = ends.airMap, field = ends.airField, seat = ends.seat;
  if (goal.kind === 'dogfight' || goal.kind === 'trench') return dogfightCast(map, field, seat, { foes: goal.foes, waves: goal.waves });
  if (goal.kind !== 'tasks') return null;
  const W = wingOf(goal);
  if (!W.total) return null;
  // the wing in bands, one a down task, every fighter minted asleep (woken by its task); only the ones a task names
  const cast = dogfightCast(map, field, seat, { foes: W.most, waves: W.bands });
  const keep = new Set(W.ids.flat()), byBand = W.ids;
  const entities = [];
  byBand.forEach((ids, b) => ids.forEach((id, j) => {
    const e = cast.entities[b * W.most + j];
    entities.push({ ...e, id, dormant: true });
  }));
  return { ...cast, entities: entities.filter((e) => keep.has(e.id)) };
}

/** The keys the goal's play adds to the level's legend: a fight's guns, or nothing. */
export function flightLegend(goal) {
  if (goal.kind === 'dogfight' || goal.kind === 'trench') return FIGHT_LEGEND;
  if (goal.kind === 'tasks' && goal.tasks.some((t) => t.down !== undefined)) return FIGHT_LEGEND;
  return null;
}
