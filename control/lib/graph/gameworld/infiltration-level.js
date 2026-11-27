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

// the deck's and the night's values: a ship's grey steel in two tones, its hull darker, its rail lighter; a night's
// floor the same greys dimmed
const DECK = Object.freeze({ steel: ['#5d6266', '#565b5f'], hull: '#30363b', rail: '#7a8086', side: 3.2, sea: -3, cell: 2 });
const NIGHT = Object.freeze({ bg: '#05080d', sky: Object.freeze({ zenith: [6, 10, 18], horizon: [24, 32, 44], day: 0, stars: 0.6, seed: 7 }), dim: 0.55 });
const quad = (a, b, c, d, fill, group, two = false) => ({ corners: [a, b, c, d], fill, group, ...(two ? { doubleSided: true } : {}) });
const dimmed = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
// a box's faces (its top and four sides) from z0 to z1, and (where it is walked against) its collider
function boxOf(x0, x1, y0, y1, z0, z1, fill, group) {
  return [quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], fill, group, true),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], fill, group, true), quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], fill, group, true),
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], fill, group, true), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], fill, group, true),
    ...(z0 > 0 ? [quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], fill, group, true)] : [])];
}

/** The stage: the floor walled round (or a ship's deck railed round over its sea), the cover's boxes on it (each a
 *  collider a body hides behind, or crawls under where it is raised), the scenery seen beyond it. */
export function infiltrationStage(G, P) {
  const k = P.night ? NIGHT.dim : 1, faces = [], colliders = [];
  if (P.deck) {
    const { length, beam, rail } = P.deck, X = beam / 2, Y = length / 2, C = DECK.cell, side = DECK.side;
    // (the deck in cells of steel, its hull's sides down to the water, a rail round its edge: a body is never off it)
    for (let x = -X; x < X - 1e-6; x += C) for (let y = -Y; y < Y - 1e-6; y += C) {
      const x1 = Math.min(X, x + C), y1 = Math.min(Y, y + C), n = Math.round((x + X) / C) + Math.round((y + Y) / C);
      faces.push(quad([r2(x), r2(y), 0], [r2(x1), r2(y), 0], [r2(x1), r2(y1), 0], [r2(x), r2(y1), 0], dimmed(DECK.steel[n % 2], k), 'deck:floor', true));
    }
    const hull = dimmed(DECK.hull, k);
    faces.push(quad([-X, -Y, -side], [X, -Y, -side], [X, -Y, 0], [-X, -Y, 0], hull, 'deck:hull', true), quad([X, Y, -side], [-X, Y, -side], [-X, Y, 0], [X, Y, 0], hull, 'deck:hull', true),
      quad([-X, Y, -side], [-X, -Y, -side], [-X, -Y, 0], [-X, Y, 0], hull, 'deck:hull', true), quad([X, -Y, -side], [X, Y, -side], [X, Y, 0], [X, -Y, 0], hull, 'deck:hull', true));
    // (the rail drawn thin; its collider thick and outboard, deeper than a vault crosses (free-run.js `depth`), so a body
    // run at it is never carried over it or through it in one step)
    const T = 0.12, O = 2, R = dimmed(DECK.rail, k);
    for (const [x0, x1, y0, y1, c] of [[-X, X, -Y, -Y + T, [-X - O, X + O, -Y - O, -Y + T]], [-X, X, Y - T, Y, [-X - O, X + O, Y - T, Y + O]], [-X, -X + T, -Y, Y, [-X - O, -X + T, -Y - O, Y + O]], [X - T, X, -Y, Y, [X - T, X + O, -Y - O, Y + O]]]) {
      faces.push(...boxOf(x0, x1, y0, y1, 0, rail, R, 'deck:rail'));
      colliders.push({ min: [r2(c[0]), r2(c[2]), 0], max: [r2(c[1]), r2(c[3]), rail], hold: false });
    }
  } else {
    const F = floorOf({ half: P.half });
    faces.push(...(k === 1 ? F.faces : F.faces.map((f) => ({ ...f, fill: dimmed(f.fill, k) })))); colliders.push(...F.colliders);
  }
  // (the cover: a box on the floor, or raised off it, a pipe run a body crawls under)
  for (const c of P.cover) {
    const [x, y] = c.at, [w, d, h] = c.size, z0 = c.z ?? 0, x0 = r2(x - w / 2), x1 = r2(x + w / 2), y0 = r2(y - d / 2), y1 = r2(y + d / 2);
    faces.push(...boxOf(x0, x1, y0, y1, z0, r2(z0 + h), dimmed(c.colour ?? '#6d6f74', k), `cover:${c.id}`));
    colliders.push({ min: [x0, y0, z0], max: [x1, y1, r2(z0 + h)], ...(z0 > 0 ? { hold: false } : {}) });
  }
  // (the sea: one plane to the horizon under the deck's edge)
  // (lower than a vault lands, free-run.js: the deck's edge is never a way down to it)
  if (P.sea) { const S = 2400, z = DECK.sea; faces.push(quad([-S, -S, z], [S, -S, z], [S, S, z], [-S, S, z], P.sea.colour, 'sea', true)); }
  // (the scenery: seen, never walked; at night its lit faces (a window, a lamp) keep their colour)
  for (const b of P.scenery ?? []) {
    const [x, y, z] = b.at, [w, d, h] = b.size;
    faces.push(...boxOf(r2(x - w / 2), r2(x + w / 2), r2(y - d / 2), r2(y + d / 2), z, r2(z + h), b.lit ?? dimmed(b.colour, k), `scenery:${b.id}`));
  }
  return { kind: 'controllable', title: 'infiltration', bg: P.night ? NIGHT.bg : '#1b1d22', faces, colliders, ...(P.night ? { sky: { ...NIGHT.sky } } : {}) };
}

/** Where the level starts and ends (levels.js reads a stage's ends). */
export function infiltrationEnds(P) {
  const at3 = (p) => [p[0], p[1], 0];
  // (a level with no exit ends where its last placed task is, else where it starts)
  const last = P.exit?.at ?? [...P.tasks].reverse().find((t) => t.at)?.at ?? P.start;
  return { spawn: at3(P.start), heading: P.heading, exit: at3(last), exitFrom: 'the way on', beats: [{ beat: 'trailhead', at: at3(P.start) }, ...P.tasks.filter((t) => t.at).map((t, k) => ({ beat: `task-${k + 1}`, at: at3(t.at) })), { beat: 'exit', at: at3(last) }], planar: true, ...(P.marks ? { marks: P.marks.map((m) => ({ id: m.id, at: m.at.slice() })) } : {}) };
}

/** The level's mechanics: its tasks in order, the way on the last (objectives.js); being seen loses nothing. */
export function infiltrationMechanics(P) {
  const tasks = [...P.tasks.map((t, k) => ({ id: `t${k + 1}`, kind: t.kind, text: t.text, ...(t.at ? { at: [t.at[0], t.at[1], 0], radius: t.radius, planar: true } : { on: t.on }) })),
    ...(P.exit ? [{ id: `t${P.tasks.length + 1}`, kind: 'reach', text: P.exit.text, at: [P.exit.at[0], P.exit.at[1], 0], radius: P.exit.radius, planar: true }] : [])];
  return [{ kind: 'objectives', id: INFILTRATION_TASK, tasks }];
}

/** The cast: the yard's operative at the level's start, each guard the yard's guard on its own round, the backup
 *  asleep where it comes from (see the header). */
export function infiltrationCast(G, P, { refs = {}, stunt = false } = {}) {
  // (its kit, where the level names one: carried as a quick kit is, loadout.js, in place of the world's)
  const room = infiltrationRoom(P.kit ? { ...G, quick: { ...(G.quick ?? {}), arms: P.kit } } : G, { refs, stunt });
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
