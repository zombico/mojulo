/**
 * THE INFILTRATION LEVEL — a stealth action game's level as a designed game lays it (`levels.<id>.infiltration`,
 * world.js; levels.js lays it as one stage): the operative of the infiltration yard (infiltration-room.js: the run, the
 * crouch and the crawl, the takedown, the fists and the sleep dart, the dive, the ledge, the weapon menu), on a ground of
 * its own, its cover laid, its guards on their rounds with the garrison's alarm, its tasks done in order. Being seen is
 * never a fail: it raises the alarm, and the way out of it is to hide until it dies down (alarm.js). Played as any
 * designed level is, so the game's screens, its saves, its script and its results reach it.
 *
 *   levels.<id>.infiltration: {
 *     ground?   { half?: 20 }   the greybox floor, a square `half` metres each way of its middle, walled
 *     start     [x, y], heading? (degrees, 90: up the floor)    where the operative stands
 *     exit      [x, y] | { at, radius?, text? }                  the way on: reached, the level is won
 *     cover?    [{ id, at: [x, y], size: [w, d, h] }]            boxes to hide behind (under 0.7 m a body lying, about a
 *               metre a crouch), each a collider and a box drawn
 *     guards?   [{ id, kind: 'patrol', at, to, speed?, cone?, range?, look? } | { id, kind: 'post', at, facing, cone?,
 *               range? }]   a patrol walks from `at` to `to` and back; a post stands at `at` looking toward `facing`;
 *               `cone` its sight's half-angle (radians, 0.6), `range` its reach (14 m), `look: { secs }` a patrol that
 *               looks all the way round at each end
 *     alarm?    the garrison's numbers over the yard's (alarm.js: confirm, radio, found, detected, vigilant, sweep, every)
 *     backup?   { count, from: [x, y] }   bodies sent at a call that goes through, gone again when it dies down
 *     tasks?    [{ reach: [x, y], radius?, text? } | { take: [x, y], radius?, text? } | { act: '<bus event>', text? }]
 *               done in order before the exit (an act: a scene's end, `scene-end:<id>`; a terminal's insert)
 *   }
 *
 *   INFILTRATION                       the numbers: the floor's half, a guard's sight, a patrol's pace, a reach's radius
 *   readInfiltration(v, at?)           → the level's words read (throws, teaching)
 *   infiltrationStage(G, P)            → its stage manifest: the floor, its walls and its cover
 *   infiltrationEnds(P)                → { spawn, heading, exit, exitFrom, beats, planar } (levels.js reads a stage's ends)
 *   infiltrationMechanics(P)           → the level's mechanics: its tasks and the exit on the objectives mechanic
 *   infiltrationCast(G, P, { refs?, stunt? }) → { figures, entities, camera, events, fxStyle, figureGrade, castLight, legend }
 *                                       the operative at its start and each guard on its round, the backup asleep
 *   INFILTRATION_TASK                  the objectives mechanic's id (its task var, `objectives.js` objectiveNames)
 *
 * Pure, no dice.
 */
import { infiltrationRoom, INFILTRATION_LEGEND } from './infiltration-room.js';
import { floorOf } from './practice-room.js';

export const INFILTRATION = Object.freeze({ half: 20, cone: 0.6, range: 14, speed: 1.6, reach: 2.5, eye: 0.2 });
export const INFILTRATION_TASK = 'obj';
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]{0,40}$/;
const r2 = (v) => Math.round(v * 100) / 100;
const KEYS = ['ground', 'start', 'heading', 'exit', 'cover', 'guards', 'alarm', 'backup', 'tasks'];
const ALARM_KEYS = ['confirm', 'radio', 'found', 'detected', 'vigilant', 'sweep', 'every'];

/** The level's words (see the header): read, every place inside its floor; throws, teaching. */
export function readInfiltration(v, at = 'infiltration') {
  const fail = (m) => { throw new Error(`${at}${m}`); };
  if (!isObj(v)) fail(` is { ${KEYS.join(', ')} }: a stealth level's ground, its operative's start, its way on, its cover, its guards and its tasks`);
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) fail(`.${k} is not part of an infiltration level (${KEYS.join(', ')})`);
  const half = v.ground?.half ?? INFILTRATION.half;
  if (v.ground !== undefined && !(isObj(v.ground) && Object.keys(v.ground).every((k) => k === 'half'))) fail('.ground is { half }: the floor\'s half-width in metres');
  if (!(Number.isFinite(half) && half >= 6 && half <= 60)) fail('.ground.half is 6 to 60 m');
  const place = (p, w) => {
    if (!(Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) fail(`${w} is [x, y] in metres from the floor's middle`);
    if (Math.abs(p[0]) > half || Math.abs(p[1]) > half) fail(`${w} is off the floor (it reaches ${half} m each way)`);
    return [r2(p[0]), r2(p[1])];
  };
  const start = place(v.start, '.start');
  if (v.heading !== undefined && !Number.isFinite(v.heading)) fail('.heading is degrees, 90 up the floor');
  const X = Array.isArray(v.exit) ? { at: v.exit } : v.exit;
  if (!isObj(X)) fail('.exit is [x, y] or { at, radius?, text? }: the way on');
  const exit = { at: place(X.at, '.exit.at'), radius: X.radius ?? INFILTRATION.reach, text: X.text ?? 'Reach the way on' };
  const seen = new Set();
  const named = (id, w) => { if (typeof id !== 'string' || !ID.test(id) || seen.has(id)) fail(`${w}.id is its own short name, lower-case`); seen.add(id); return id; };
  const cover = (v.cover ?? []).map((c, i) => {
    const w = `.cover[${i}]`;
    if (!isObj(c)) fail(`${w} is { id, at, size: [w, d, h] }`);
    if (!(Array.isArray(c.size) && c.size.length === 3 && c.size.every((s) => Number.isFinite(s) && s > 0 && s <= 30))) fail(`${w}.size is [w, d, h] in metres`);
    return { id: named(c.id, w), at: place(c.at, `${w}.at`), size: c.size.map(r2) };
  });
  if (!Array.isArray(v.cover ?? [])) fail('.cover is a list of boxes');
  if (!Array.isArray(v.guards ?? [])) fail('.guards is a list of guards');
  const guards = (v.guards ?? []).map((g, i) => {
    const w = `.guards[${i}]`;
    if (!isObj(g) || !['patrol', 'post'].includes(g.kind)) fail(`${w} is { id, kind: 'patrol', at, to } or { id, kind: 'post', at, facing }`);
    const out = { id: named(g.id, w), kind: g.kind, at: place(g.at, `${w}.at`) };
    if (g.kind === 'patrol') out.to = place(g.to, `${w}.to`); else out.facing = place(g.facing, `${w}.facing`);
    for (const [k, lo, hi] of [['speed', 0.3, 4], ['cone', 0.1, 1.6], ['range', 2, 60]]) {
      if (g[k] === undefined) continue;
      if (!(Number.isFinite(g[k]) && g[k] >= lo && g[k] <= hi)) fail(`${w}.${k} is ${lo} to ${hi}`);
      out[k] = g[k];
    }
    if (g.look !== undefined) { if (!(isObj(g.look) && Number.isFinite(g.look.secs) && g.look.secs > 0)) fail(`${w}.look is { secs }: a look all the way round at each end`); out.look = { secs: g.look.secs }; }
    return out;
  });
  let alarm = null;
  if (v.alarm !== undefined) {
    if (!isObj(v.alarm) || Object.keys(v.alarm).some((k) => !ALARM_KEYS.includes(k) || !Number.isFinite(v.alarm[k]) || v.alarm[k] < 0)) fail(`.alarm is { ${ALARM_KEYS.join(', ')} }: the garrison's numbers (seconds, a gain, metres)`);
    alarm = { ...v.alarm };
  }
  let backup = null;
  if (v.backup !== undefined) {
    if (!isObj(v.backup) || !(Number.isInteger(v.backup.count) && v.backup.count >= 1 && v.backup.count <= 6)) fail('.backup is { count: 1 to 6, from: [x, y] }');
    backup = { count: v.backup.count, from: place(v.backup.from, '.backup.from') };
  }
  if (!Array.isArray(v.tasks ?? [])) fail('.tasks is a list');
  const tasks = (v.tasks ?? []).map((t, i) => {
    const w = `.tasks[${i}]`;
    if (!isObj(t)) fail(`${w} is { reach: [x, y] } | { take: [x, y] } | { act: '<bus event>' }, with text?`);
    const k = ['reach', 'take', 'act'].find((x) => t[x] !== undefined);
    if (!k) fail(`${w} names what is done: reach, take or act`);
    if (t.text !== undefined && !(typeof t.text === 'string' && t.text.length > 0 && t.text.length <= 80)) fail(`${w}.text is words, up to 80 letters`);
    if (k === 'act') { if (typeof t.act !== 'string' || !t.act) fail(`${w}.act is the bus event that meets it (a scene's end: scene-end:<id>)`); return { kind: 'act', on: t.act, text: t.text ?? 'Do what is asked' }; }
    return { kind: k, at: place(t[k], `${w}.${k}`), radius: t.radius ?? INFILTRATION.reach, text: t.text ?? (k === 'take' ? 'Take it' : 'Reach it') };
  });
  const heading = ((v.heading ?? 90) * Math.PI) / 180;
  return { half, start, heading: r2(heading), exit, cover, guards, alarm, backup, tasks };
}

/** The stage: the floor walled round, the cover's boxes on it (each a collider a body hides behind). */
export function infiltrationStage(G, P) {
  const blocks = P.cover.map((c) => ({ id: c.id, x: [r2(c.at[0] - c.size[0] / 2), r2(c.at[0] + c.size[0] / 2)], y: [r2(c.at[1] - c.size[1] / 2), r2(c.at[1] + c.size[1] / 2)], h: c.size[2], group: `cover:${c.id}` }));
  const { faces, colliders } = floorOf({ half: P.half, blocks });
  return { kind: 'controllable', title: 'infiltration', bg: '#1b1d22', faces, colliders };
}

/** Where the level starts and ends (levels.js reads a stage's ends). */
export function infiltrationEnds(P) {
  const at3 = (p) => [p[0], p[1], 0];
  return { spawn: at3(P.start), heading: P.heading, exit: at3(P.exit.at), exitFrom: 'the way on', beats: [{ beat: 'trailhead', at: at3(P.start) }, ...P.tasks.filter((t) => t.at).map((t, k) => ({ beat: `task-${k + 1}`, at: at3(t.at) })), { beat: 'exit', at: at3(P.exit.at) }], planar: true };
}

/** The level's mechanics: its tasks in order, the way on the last (objectives.js); being seen loses nothing. */
export function infiltrationMechanics(P) {
  const tasks = [...P.tasks.map((t, k) => ({ id: `t${k + 1}`, kind: t.kind, text: t.text, ...(t.at ? { at: [t.at[0], t.at[1], 0], radius: t.radius, planar: true } : { on: t.on }) })),
    { id: `t${P.tasks.length + 1}`, kind: 'reach', text: P.exit.text, at: [P.exit.at[0], P.exit.at[1], 0], radius: P.exit.radius, planar: true }];
  return [{ kind: 'objectives', id: INFILTRATION_TASK, tasks }];
}

/** The cast: the yard's operative at the level's start, each guard the yard's guard on its own round, the backup
 *  asleep where it comes from (see the header). */
export function infiltrationCast(G, P, { refs = {}, stunt = false } = {}) {
  const room = infiltrationRoom(G, { refs, stunt });
  const M = room.manifest, hero0 = M.entities.find((e) => e.id === 'hero'), guard0 = M.entities.find((e) => e.id === room.guards[0]);
  const hero = { ...hero0, transform: { pos: [P.start[0], P.start[1], INFILTRATION.eye], heading: P.heading } };
  const backupIds = Array.from({ length: P.backup?.count ?? 0 }, (_, k) => `backup-${k + 1}`);
  const from = P.backup ? [P.backup.from[0], P.backup.from[1], INFILTRATION.eye] : null;
  const alarm = { ...(guard0.rule.alarm ?? {}), ...(P.alarm ?? {}), ...(backupIds.length ? { backup: backupIds, from } : {}) };
  const guards = P.guards.map((w) => {
    const to = w.kind === 'patrol' ? w.to : w.facing, heading = r2(Math.atan2(to[1] - w.at[1], to[0] - w.at[0]));
    const stretch = w.kind === 'patrol' ? r2(Math.hypot(to[0] - w.at[0], to[1] - w.at[1])) : 10;
    return { ...guard0, id: w.id, transform: { pos: [w.at[0], w.at[1], INFILTRATION.eye], heading },
      rule: { ...guard0.rule, alarm, speed: w.kind === 'patrol' ? (w.speed ?? INFILTRATION.speed) : 0, sightCone: w.cone ?? INFILTRATION.cone, sightRange: w.range ?? INFILTRATION.range,
        foe: { ...guard0.rule.foe, stretch, ...(w.kind === 'patrol' ? { ends: [[w.at[0], w.at[1], INFILTRATION.eye], [to[0], to[1], INFILTRATION.eye]] } : {}), ...(w.look ? { patrol: { ...(guard0.rule.foe?.patrol ?? {}), look: w.look } } : {}) } } };
  });
  const backup = backupIds.map((id) => ({ ...guard0, id, dormant: true, transform: { pos: from.slice(), heading: -Math.PI / 2 }, rule: { ...guard0.rule, alarm } }));
  // (the guards' figure is the yard's guard's, one figure every guard shares; the yard's targets left out)
  const figures = Object.fromEntries(Object.entries(M.figures).filter(([k]) => !/^target/.test(k)));
  return { figures, entities: [hero, ...guards, ...backup], camera: M.camera, events: M.events, fxStyle: M.fxStyle, figureGrade: M.figureGrade, castLight: M.castLight, legend: INFILTRATION_LEGEND, guards: [...guards.map((g) => g.id), ...backupIds] };
}
