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
 *   stage     an arcade stage flown down a path (airspace.rail; skyscape/rail-stage.js, the rail rule): its waves woken
 *             as the craft passes their marks, its hazards met where they stand (a pillar's column, a rock), its boss's
 *             parts shot down to win; the craft's shield the level's hp, taken by hits and hazards, never by the ground
 *   tasks     a list done in order (game/objectives.js), in the level's own words:
 *               { gates: true | [from, to] }            the course's gates (all, or gates from..to, counted from 1)
 *               { land: true }                          set down soft on a runway or a pad of the map
 *               { band: { alt?, agl?, speed?, climb?, bank?, heading?, height?, turn? }, seconds, total? }
 *                                                       hold the pilot in the band (the HUD's units: m, knots, m/s, degrees);
 *                                                       a lesson's words are said against the airfield, so they hold on any
 *                                                       seed's map: `height` m over the runway, `turn` degrees from its
 *                                                       heading (right positive), laid as the alt and the heading
 *               { reach: [x, y, z] | { gate: n }, radius? }   a nav point: fly to it
 *               { down: n | true }                      the next n of the level's fighters shot down (true: WING.n); they
 *                                                       are minted asleep and woken as the task begins
 *             each with an optional `text` (what the player is told; a plain one is written when absent). A crash is
 *             `crash`: 'fail' (the attempt is over: a lesson's, the default with no fighters) or 'respawn' (it comes
 *             back at the start, costing hp: the default with fighters, whose hits the level's hp takes too). A
 *             `grade` gives a medal (game/grade.js) by `time` (s), `slip` (s out of its bands) and `sink` (the landing's
 *             m/s), each [gold, silver, bronze], least best
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
import { dogfightCast, waveIds, WING, wingFighter, armedPilot, guns } from '../skyscape/dogfight.js';
import { BAND_FACTS } from '../game/objectives.js';
import { readSortie, sortieMechanics, sortieCast } from './flight-sortie.js';
import { cockpitOf } from '../skyscape/cockpits.js';

/** A fight in the air's costs: the craft's hp, what a hit on it takes, and what a crash does. */
export const DOGFIGHT = Object.freeze({ hp: 100, hit: 4, crash: 25 });
export const FLIGHT_GOALS = Object.freeze(['course', 'dogfight', 'trench', 'stage', 'sortie', 'tasks']);
/** A stage's costs and its foes: what a hit and a hazard flown into take off the shield, how its fighters fire (an
 *  arcade wing: no missiles, short bursts, long pauses, so a wave is broken up and not a wall of fire), and what they
 *  fire: a round that travels (m/s, flat, seen), so the craft steered out of its way or rolled through it is not hit. */
export const STAGE = Object.freeze({
  hit: 2, hazard: 20,
  wing: Object.freeze({ burst: 0.3, pause: 3.2, rof: 2 }), boss: Object.freeze({ burst: 0.5, pause: 1.8 }),
  // (the craft's guns on a stage: an arcade's sights, wider than a dogfight's)
  sights: Object.freeze({ coreAngle: 4, assistAngle: 12 }),
  round: Object.freeze({ fireClass: 'lob', lobAngle: 0, projectileSpeed: 170, projectileGravity: 0, projRadius: 2, splashRadius: 0, fuse: 4, noGround: true, passTeam: true, smokeTrail: false, fxColor: 0xff5a3c, fxScale: 2 }),
});
export const FLIGHT_TASKS = Object.freeze(['gates', 'land', 'band', 'reach', 'down']);
export const FLIGHT_CRASH = Object.freeze(['fail', 'respawn']);
/** A band's words: the gauges, and a lesson's two said against the airfield. */
export const BAND_WORDS = Object.freeze([...BAND_FACTS, 'height', 'turn']);
/** What a grade reads, each [gold, silver, bronze], least best: the time, the seconds out of a band, a landing's sink. */
export const GRADE_BY = Object.freeze(['time', 'slip', 'sink']);
/** The legend a fight in the air adds: the craft's guns and missiles, its flares, boost and roll. */
export const FIGHT_LEGEND = 'click or Z  guns · R  missile · X  flare · F  boost · Q / E  roll';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const SHAPE = `is 'course' | 'dogfight' | 'trench' | 'stage', { dogfight: true | { foes?, waves? } }, { sortie: { groups, goals } } (a cockpit's), or { tasks: [ ${FLIGHT_TASKS.map((k) => `{ ${k} }`).join(' | ')} ], crash?: ${FLIGHT_CRASH.join(' | ')} }`;

/** A flight goal in a level's words, read and taught. */
export function readFlightGoal(v, at = 'goal.flight') {
  const fail = (m) => { throw new Error(`gameworld: ${at}${m}`); };
  if (v === 'course' || v === 'dogfight' || v === 'trench' || v === 'stage') return { kind: v };
  if (!isObj(v)) fail(` ${SHAPE}`);
  const keys = Object.keys(v);
  if (v.dogfight !== undefined) {
    if (keys.length !== 1) fail(': a dogfight is { dogfight: true | { foes?, waves? } } alone');
    const D = v.dogfight === true ? {} : v.dogfight;
    if (!isObj(D) || Object.keys(D).some((k) => k !== 'foes' && k !== 'waves')) fail('.dogfight is true or { foes?, waves? }');
    for (const k of ['foes', 'waves']) if (D[k] !== undefined && !(Number.isInteger(D[k]) && D[k] >= 1 && D[k] <= WING.max)) fail(`.dogfight.${k} is a whole number, 1 to ${WING.max}`);
    return { kind: 'dogfight', ...(D.foes !== undefined ? { foes: D.foes } : {}), ...(D.waves !== undefined ? { waves: D.waves } : {}) };
  }
  if (v.sortie !== undefined) {
    if (keys.length !== 1) fail(': a sortie is { sortie: { groups, goals } } alone');
    return { kind: 'sortie', sortie: readSortie(v.sortie, `${at}.sortie`) };
  }
  if (v.tasks === undefined) fail(` ${SHAPE}`);
  for (const k of keys) if (!['tasks', 'crash', 'grade'].includes(k)) fail(`.${k} is not a flight goal's (tasks, crash, grade)`);
  if (v.grade !== undefined) {
    if (!isObj(v.grade) || !Object.keys(v.grade).length) fail(`.grade is { ${GRADE_BY.join('?, ')}? }, each [gold, silver, bronze]`);
    for (const [g, b] of Object.entries(v.grade)) {
      if (!GRADE_BY.includes(g)) fail(`.grade.${g} is not graded (${GRADE_BY.join(', ')})`);
      if (!(Array.isArray(b) && b.length === 3 && b.every(Number.isFinite) && b[0] <= b[1] && b[1] <= b[2])) fail(`.grade.${g} is [gold, silver, bronze], least best (gold the smallest)`);
    }
  }
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
      if (!isObj(t.band) || !Object.keys(t.band).length) fail(`${where}.band is { ${BAND_WORDS.join('?, ')}? }, each [min, max]`);
      for (const f of Object.keys(t.band)) {
        const r = t.band[f];
        if (!BAND_WORDS.includes(f)) fail(`${where}.band.${f} is not a gauge (${BAND_WORDS.join(', ')})`);
        if ((f === 'height' && t.band.alt !== undefined) || (f === 'turn' && t.band.heading !== undefined)) fail(`${where}.band: ${f} and ${f === 'height' ? 'alt' : 'heading'} say the same thing, one of them`);
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
  return { kind: 'tasks', tasks, ...(v.crash !== undefined ? { crash: v.crash } : {}), ...(v.grade !== undefined ? { grade: v.grade } : {}) };
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
  if (airspace?.rail) return { kind: 'stage' };
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
const UNIT = { alt: 'm', agl: 'm over the ground', speed: 'kt', climb: 'm/s climbing', bank: '° of bank', heading: '', height: 'm over the field', turn: '° from the runway heading' };
function bandText(t) {
  const part = (f) => {
    const [lo, hi] = t.band[f], u = UNIT[f];
    const say = lo === null ? `under ${hi}` : hi === null ? `over ${lo}` : `${lo} to ${hi}`;
    return f === 'heading' ? `heading ${say}` : f === 'turn' ? `${say}${u}` : `${say} ${u}`.trim();
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
  if (goal.kind === 'stage') {
    const S = ends.rail;
    if (!S) fail('a stage is flown down a rail: give the airspace one (airspace.rail: true)');
    return [
      // the shield: the level's hp, a bar; a hit takes its share, a hazard flown into more
      { kind: 'fail-on-death', startHp: DOGFIGHT.hp, hits: STAGE.hit, bar: true },
      ...(S.waves.length ? [{ kind: 'wake', marks: S.waves.map((w) => ({ fact: 'along', min: w.along, foes: w.foes })) }] : []),
      ...(S.hazards.length ? [{ kind: 'hazard-damage', hazards: S.hazards.map((h) => (h.size ? { at: [h.at[0], h.at[1], h.base + h.size[2] / 2], half: [h.radius, h.radius, h.size[2] / 2], damage: STAGE.hazard, planar: false } : { at: h.at, radius: h.radius, damage: STAGE.hazard, planar: false })) }] : []),
      { kind: 'defeat-all', who: 'boss-*', count: S.boss.parts.length, label: 'Boss' },
    ];
  }
  // a sortie (flight-sortie.js): a cockpit's mission, its flight groups and its goals together
  if (goal.kind === 'sortie') {
    if (!ends.cockpit) fail('a sortie is flown from a cockpit: the airspace is { cockpit: true } in space');
    return sortieMechanics(goal.sortie);
  }
  if (goal.kind === 'dogfight' || goal.kind === 'trench') {
    if (goal.kind === 'trench' && !field.port) fail('a trench run needs a trench: the airspace\'s space is { trench: true }');
    return [
      // (a cockpit's hull is its body's, its shields in front of it: the level lost when the craft is down; else the
      // level's hp takes each hit, and a crash comes back)
      ...(ends.cockpit ? [{ kind: 'fail-on-death', of: 'body' }] : [
        { kind: 'fail-on-death', startHp: DOGFIGHT.hp, hits: DOGFIGHT.hit },
        { kind: 'respawn', at: { spot: p.pos, heading: p.heading, aloft: 1 }, hurt: DOGFIGHT.crash }]),
      // a dogfight in waves: wing after wing, each woken when the one before is down (dogfight.js waveIds); a trench run
      // won by its port alone; a dogfight by the wing
      ...(goal.waves && !field.port ? [{ kind: 'waves', waves: waveIds(goal.waves, goal.foes ?? WING.n), clear: true }] : [
        { kind: 'defeat-all', who: 'foe-*', count: field.port ? 1 : Math.max(1, Math.min(WING.max, goal.foes ?? WING.n)), label: field.port ? 'Port' : 'Down' }]),
    ];
  }
  // a list of tasks done in order (game/objectives.js), each said in the air's own terms
  const W = wingOf(goal), pads = padBoxes(field), gates = course?.gates ?? [];
  // a lesson's words against the airfield: the runway's datum and the compass heading it is taken off along
  const datum = field.pads?.[0]?.datum, depart = ((90 - (seat.transform.heading * 180) / Math.PI) % 360 + 360) % 360;
  const wrap = (x) => Math.round((((x % 360) + 360) % 360) * 100) / 100;
  const gaugesOf = (B, k) => Object.fromEntries(Object.entries(B).map(([f, r]) => {
    if (f === 'height') {
      if (!Number.isFinite(datum)) fail(`tasks[${k}].band.height is over the runway: give the map one (ground.pads)`);
      return ['alt', r.map((x) => (x === null ? null : Math.round((datum + x) * 100) / 100))];
    }
    if (f === 'turn') return ['heading', [r[0] === null ? null : wrap(depart + r[0]), r[1] === null ? null : wrap(depart + r[1])]];
    return [f, r];
  }));
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
    if (t.band !== undefined) return { id, kind: 'band', text: t.text ?? bandText(t), band: gaugesOf(t.band, k), seconds: t.seconds, ...(t.total ? { total: true } : {}) };
    if (t.reach !== undefined) {
      const at = Array.isArray(t.reach) ? t.reach : gates[t.reach.gate - 1]?.at;
      if (!at) fail(`tasks[${k}].reach.gate: the course has ${gates.length} gates`);
      return { id, kind: 'reach', text: t.text ?? 'Fly to the marker', at, radius: t.radius ?? (Array.isArray(t.reach) ? 60 : gates[t.reach.gate - 1].radius), planar: false };
    }
    const foes = W.ids[d++];
    return { id, kind: 'clear', text: t.text ?? (foes.length === 1 ? 'Shoot down the fighter' : `Shoot down the ${foes.length} fighters`), foes };
  });
  const crash = goal.crash ?? (W.total ? 'respawn' : 'fail');
  // its grade, read off what the objectives keep (game/objectives.js objectiveNames: the time, a band's slip, the sink)
  const N = { time: '__obj_time', slip: '__obj_slip', sink: '__obj_sink' };
  if (goal.grade?.slip && !tasks.some((t) => t.kind === 'band')) fail('grade.slip grades the seconds out of a band: the goal has none');
  if (goal.grade?.sink && !tasks.some((t) => t.kind === 'land')) fail('grade.sink grades a landing: the goal has none');
  const grade = goal.grade ? [{ kind: 'grade', criteria: Object.entries(goal.grade).map(([g, [gold, silver, bronze]]) => ({ var: N[g], best: 'low', gold, silver, bronze })) }] : [];
  return [
    { kind: 'objectives', tasks, say: 'line' },
    ...grade,
    ...(W.total ? [ends.cockpit ? { kind: 'fail-on-death', of: 'body' } : { kind: 'fail-on-death', startHp: DOGFIGHT.hp, hits: DOGFIGHT.hit }] : []),
    ...(ends.cockpit ? [] : [crash === 'fail'
      ? { kind: 'crash', then: 'fail', ...(pads.length ? { pads } : {}) }
      : { kind: 'crash', then: 'respawn', ...(pads.length ? { pads } : {}), at: { spot: p.pos, heading: p.heading, aloft: map.form === 'void' || seat.rule.engine === false ? 1 : 0 }, ...(W.total ? { hurt: DOGFIGHT.crash } : {}) }]),
  ];
}

/** What the goal stands in the airspace: its fighters (asleep until their task wakes them), the trench's port and
 * turrets, the craft's guns and a mouse that flies it; null when it stands nothing (a course, a lesson). */
export function flightGoalCast(goal, ends) {
  const X = castOf(goal, ends);
  if (!X || !ends.cockpit || !X.pilot) return X;
  // (a cockpit keeps its own cannons, its lasers, and flies without the arcade's boost and roll: its warheads ride)
  const { weapon: _w, rule = {}, body: _b, ...pilot } = X.pilot, { boost: _o, roll: _r, ...keep } = rule;
  return { ...X, pilot: { ...pilot, rule: keep } };
}

function castOf(goal, ends) {
  // (a sortie's flight groups as craft; the pilot armed with its warheads)
  if (goal.kind === 'sortie') {
    // (its warheads its cockpit card's count: a craft that carries none flies with its cannons alone)
    const n = cockpitOf(ends.airframe).numbers.warheads, M = armedPilot(ends.airMap.craft, 6).rule.missiles;
    return { ...sortieCast(goal.sortie, ends), ...(n > 0 ? { pilot: { rule: { missiles: { ...M, count: n } } } } : {}) };
  }
  const map = ends.airMap, field = ends.airField, seat = ends.seat;
  if (goal.kind === 'stage' && ends.rail) {
    // the stage's fighters at their posts, asleep until their marks; its boss's parts, static minds with guns; the craft
    // armed (its cannon and missiles). Its hazards are the airspace's own to draw (rocks: airspace.js), the mechanic's to hurt
    const S = ends.rail, c = map.craft, size = Math.round(Math.max(4, c.max / 25) * 100) / 100, entities = [];
    const toward = (at) => { const e = S.path[0]; return Math.atan2(e[1] - at[1], e[0] - at[0]); };
    // (an arcade wing: the dogfight's fighter without its missiles, firing in short bursts, on station ahead of the craft
    // once woken: rules-rail.js)
    for (const f of S.foes) {
      const w = wingFighter(map, f.id, f.at, toward(f.at), { dormant: true }), { missiles: _m, ...rule } = w.rule;
      entities.push({ ...w, rule: { ...rule, burst: STAGE.wing.burst, pause: STAGE.wing.pause, station: { of: 'player', ...f.station } }, weapon: { ...w.weapon, ...STAGE.round, rof: STAGE.wing.rof } });
    }
    for (const p of S.boss.parts) entities.push({
      id: p.id, team: 'foes',
      rule: { type: 'ai', space: true, speed: 0, turn: 2, standoff: 0, fireArc: 12, burst: STAGE.boss.burst, pause: STAGE.boss.pause, sightRange: Math.round(5 * c.cruise), eye: 0 },
      weapon: { ...guns(c), ...STAGE.round, rof: p.id === 'boss-core' ? 4 : 2, range: Math.round(3 * c.cruise), assistAngle: 3 },
      body: { type: 'mesh', shape: 'box', size: [p.size, p.size, p.size * 0.6], color: p.id === 'boss-core' ? '#b8323a' : '#5c6470', hittable: true, hp: p.hp, poise: 99, radius: p.size / 2, egg: { a: p.size / 2, c: p.size / 2, cz: 0 } },
      transform: { pos: p.at, heading: toward(p.at), pitch: 0 },
    });
    const A = armedPilot(c, size);
    return { entities, pilot: { weapon: { ...A.weapon, ...STAGE.sights }, rule: { missiles: A.rule.missiles }, body: A.body } };
  }
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
  if (goal.kind === 'stage') return 'click or Z  guns · R  missile';
  if (goal.kind === 'dogfight' || goal.kind === 'trench') return FIGHT_LEGEND;
  if (goal.kind === 'tasks' && goal.tasks.some((t) => t.down !== undefined)) return FIGHT_LEGEND;
  return null;
}
