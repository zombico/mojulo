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
import { INFILTRATION, readInfiltration } from './infiltration-words.js';

export const INFILTRATION_TASK = 'obj';
const r2 = (v) => Math.round(v * 100) / 100;
export { INFILTRATION, readInfiltration };

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
