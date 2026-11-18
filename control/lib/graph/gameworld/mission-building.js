/**
 * THE MISSION IN A BUILDING — a shooter's first level fought inside a geocube building designed as a fighting map
 * (`levels.<id>: { building: { use, fight? }, mission }`, world.js), not on greybox. The firing range decides the rules
 * (mission/brief.js: the guns, their bands, the hold's clock); the building decides where. Its plan (era/stage.js
 * planStage of the level's stage) is read onto the arena grid (arena-map/read-geocube.js readBuildingMap), the phases are
 * placed on that grid from its own measures (arena-map/phases.js phasesOnMap: arm up, a clear a band, hold the heart, get
 * out), and every place is taken back to the building's own metres and floor heights.
 *
 * The grid snaps a wall by up to half a cell and reads a storey as 3 m, so a place read back is HELD TO THE REAL PLAN:
 * inside its room's inner bounds (the wall's half thickness and a body's radius in), on that room's floor, clear of the
 * walls (era/anchors.js stageColliders), the stairs' balustrades and wells (era/storeys.js stairColliders, each stair's
 * own footprint) and the stocked pieces (era/compose-dress.js footprintOf), and a body's width from a place already set.
 * A place that fails is moved to the nearest free spot of the same room (a half-metre lattice, nearest first, ties by the
 * mission's seeded dice) and the move is recorded; a foe or a drop with no free spot is left out, and a law says so. A
 * place on a hall's gallery (era/programs.js FIGHT `gallery`) stands on its deck.
 *
 *   the start   the building level's own: its walker's spawn inside its door (gameworld/levels.js buildingEnds)
 *   get out     a real way out: one of the plan's doors (`ways`), a step inside it, read at the body's height
 *
 *   buildingMissionPlan(G, stage, { spec?, seed?, spawn, heading? }) → { brief, mission, laws, map, moved, dropped }
 *     stage    the level's stage manifest (levels.js levelBuildingStage); spawn: its walker's feet (buildingEnds)
 *     mission  the composition missionCast, missionMechanics and missionUi consume, in the building's metres:
 *              { on: 'building', seed, heading, sections, primitives: [], anchors: { spawn, exit }, heart, cells,
 *                frame: { origin, cell, floors: [z0 a storey], stairs: [{ z0, z1, way: [[x, y], …] (up) }] },
 *                floors?: the storey over the ground and its stairs, a mind's `rule.floors` (a hold's wave crosses) }
 *              (take and reach read at their height: `planar: false`, their `at` on the floor, lifted to the eye by
 *              missionTasks)
 *     laws     the phases' own on the grid (phaseLaws) and `placed-in-plan`: what was moved, what was left out
 *   MISSION_BUILDINGS        (mission/brief.js) the core building design_game proposes a mission in, by the kit's band
 *   missionBuildingFor(G)    → { use, why } | null the row for a world's kit (null: it carries no gun)
 *   realOf(frame, gridPoint) → [x, y, z] the building's metres of a grid point (arena-map/ground.js mapPoint's)
 *   gridOf(frame, p)         → [i, j, k] the grid cell a point of the building stands in
 *
 * Pure but for the composition's seeded dice.
 */
import { CELL, RISE } from '../arena-map/blocks.js';
import { readBuildingMap, planOf } from '../arena-map/read-geocube.js';
import { phasesOnMap, phaseLaws } from '../arena-map/phases.js';
import { stageColliders } from '../era/anchors.js';
import { stairColliders } from '../era/storeys.js';
import { PIECES, footprintOf } from '../era/compose-dress.js';
import { missionBrief, MISSION_BUILDINGS } from '../mission/brief.js';

export { MISSION_BUILDINGS };
import { mulberry32 } from '../vegetation/grow.js';

const r2 = (v) => Math.round(v * 100) / 100;

/** The building a world's kit is proposed its mission in, by the longest band it serves (null: no gun). */
export function missionBuildingFor(G) {
  const B = missionBrief(G);
  if (!B) return null;
  return MISSION_BUILDINGS[B.serves.long ? 'long' : B.serves.mid ? 'mid' : 'close'];
}
// a body: its radius off every wall and piece, its height, and the spacing between two places
const BODY = 0.45, TALL = 1.7, APART = 0.9, LATTICE = 0.5, IN = 1.2;

/** The building's metres of a grid point (mapPoint's: a cell's centre on its level's floor). */
export function realOf(F, p) {
  const i = Math.floor(p[0] / CELL + 1e-9), j = Math.floor(p[1] / CELL + 1e-9), k = Math.max(0, Math.round(p[2] / RISE));
  return [r2(F.origin[0] + (i + 0.5) * F.cell), r2(F.origin[1] + (j + 0.5) * F.cell), F.floors[Math.min(k, F.floors.length - 1)] ?? 0];
}
/** The grid cell a point of the building stands in (its storey the floor nearest under it). */
export function gridOf(F, p) {
  let k = 0;
  F.floors.forEach((z, s) => { if (z <= p[2] + 0.6) k = s; });
  return [Math.floor((p[0] - F.origin[0]) / F.cell), Math.floor((p[1] - F.origin[1]) / F.cell), k];
}

// a stair's way up, as the level's own route walks it (structure/level.js stairWay): its switchback's points, else its
// approach, its foot, its head and its arrival
function stairWay(s) {
  const pt = (u) => (s.axis === 'y' ? [s.approach[0], u] : [u, s.approach[1]]);
  return (s.route ? s.route : [s.approach, pt(s.foot + s.dir * 0.3), pt(s.head), s.arrival]).map((q) => [r2(q[0]), r2(q[1])]);
}

// what stands in a storey's way: its walls, the stairs' guards, the stocked pieces; the stairs' footprints; the decks
function obstacles(plan) {
  const floors = plan.storeys?.map((s) => s.z0) ?? [0], storeyOf = (r) => r.storey ?? 0;
  const cols = floors.flatMap((z0, s) => stageColliders({ ...plan, rooms: plan.rooms.filter((r) => storeyOf(r) === s) }, {}, [])
    .map((c) => ({ min: [c.min[0], c.min[1], c.min[2] + z0], max: [c.max[0], c.max[1], c.max[2] + z0] })));
  if (plan.stairs?.length) cols.push(...stairColliders(plan.stairs));
  const roomZ = new Map(plan.rooms.map((r) => [r.id, floors[storeyOf(r)] ?? 0]));
  for (const it of plan.props ?? []) {
    const P = PIECES[it.kind];
    if (!P || P.solid === false || it.wall || !Array.isArray(it.at)) continue;
    const F = footprintOf(it), z = roomZ.get(it.room) ?? 0;
    cols.push({ min: [F.min[0], F.min[1], z], max: [F.max[0], F.max[1], z + P.h * (it.scale ?? 1) * ((it.level ?? 0) + 1)] });
  }
  // (a stair is walked, never stood on: its footprint on the storey it leaves, and the well over it on the one it reaches)
  const stairs = (plan.stairs ?? []).map((s) => ({ rect: s.rect, z: [s.z0, s.z1] }));
  // (a hall's gallery: its deck at the upper storey's floor, along its wall; its depth from the wall, its run along it)
  const decks = (plan.galleries ?? []).filter((g) => !g.lost && Array.isArray(g.deck) && Array.isArray(g.depth)).map((g) => {
    const H = plan.rooms.find((r) => r.id === g.hall), [x0, y0, x1, y1] = H.box, d = g.depth;
    const across = g.side === '-x' ? [x0 + d[0], x0 + d[1]] : g.side === '+x' ? [x1 - d[1], x1 - d[0]] : g.side === '-y' ? [y0 + d[0], y0 + d[1]] : [y1 - d[1], y1 - d[0]];
    const box = g.side.endsWith('x') ? [across[0], g.deck[0], across[1], g.deck[1]] : [g.deck[0], across[0], g.deck[1], across[1]];
    return { id: `${g.hall}/gallery`, box, z: g.z, storey: floors.findIndex((z) => Math.abs(z - g.z) < 0.05) };
  });
  return { floors, cols, stairs, decks };
}

/** The phases placed in the building (see the header). */
export function buildingMissionPlan(G, stage, { spec = {}, seed = null, spawn, heading = null } = {}) {
  const brief = missionBrief(G, spec);
  if (!brief) return null;
  const dice = seed ?? spec.seed ?? (Number.isInteger(G?.seed) ? G.seed : 1);
  const plan = planOf(stage), map = readBuildingMap(plan), O = obstacles(plan), t = (plan.kit?.wall ?? 0.5) / 2;
  const frame = { origin: map.read.origin.slice(), cell: map.read.cell, floors: O.floors.slice(), stairs: (plan.stairs ?? []).map((s) => ({ z0: s.z0, z1: s.z1, way: stairWay(s) })) };
  // the rooms a place may stand in on each storey: a room's own floor (a tall room only at its own), and the decks
  const roomsOn = (s) => [...plan.rooms.filter((r) => (r.storey ?? 0) === s).map((r) => ({ id: r.id, box: r.box, z: O.floors[s] ?? 0, wall: t })), ...O.decks.filter((d) => d.storey === s).map((d) => ({ id: d.id, box: d.box, z: d.z, wall: 0 }))];
  const inner = (R) => [R.box[0] + R.wall + BODY, R.box[1] + R.wall + BODY, R.box[2] - R.wall - BODY, R.box[3] - R.wall - BODY];
  const roomAt = (x, y, s) => {
    let best = null, bm = -Infinity;
    for (const R of roomsOn(s)) { const b = inner(R), m = Math.min(x - b[0], y - b[1], b[2] - x, b[3] - y); if (x >= R.box[0] && x <= R.box[2] && y >= R.box[1] && y <= R.box[3] && m > bm) { bm = m; best = R; } }
    return best;
  };
  const set = [];
  const free = (p, R) => {
    const b = inner(R);
    if (p[0] < b[0] - 1e-6 || p[0] > b[2] + 1e-6 || p[1] < b[1] - 1e-6 || p[1] > b[3] + 1e-6) return false;
    const z0 = R.z + 0.05, z1 = R.z + TALL;
    if (O.cols.some((c) => p[0] > c.min[0] - BODY && p[0] < c.max[0] + BODY && p[1] > c.min[1] - BODY && p[1] < c.max[1] + BODY && c.max[2] > z0 && c.min[2] < z1)) return false;
    if (O.stairs.some((s) => (Math.abs(s.z[0] - R.z) < 0.05 || Math.abs(s.z[1] - R.z) < 0.05) && p[0] > s.rect[0] - BODY && p[0] < s.rect[2] + BODY && p[1] > s.rect[1] - BODY && p[1] < s.rect[3] + BODY)) return false;
    return !set.some((q) => Math.abs(q[2] - p[2]) < 0.5 && Math.hypot(q[0] - p[0], q[1] - p[1]) < APART);
  };
  const rnd = mulberry32((dice ^ 0x5bd1e995) | 0), moved = [], dropped = [];
  // a place held to the plan: where it is, else the nearest free spot of its room, else null
  const hold = (p, what) => {
    const s = gridOf(frame, p)[2], R = roomAt(p[0], p[1], s);
    if (!R) { dropped.push(`${what}: no room of storey ${s} under [${p[0]}, ${p[1]}]`); return null; }
    const at = [p[0], p[1], R.z];
    if (free(at, R)) { set.push(at); return at; }
    const b = inner(R), cands = [];
    for (let x = b[0]; x <= b[2] + 1e-6; x += LATTICE) for (let y = b[1]; y <= b[3] + 1e-6; y += LATTICE) cands.push({ q: [r2(x), r2(y), R.z], d: Math.hypot(x - p[0], y - p[1]), tie: rnd() });
    cands.sort((u, v) => u.d - v.d || u.tie - v.tie);
    const c = cands.find((u) => free(u.q, R));
    if (!c) { dropped.push(`${what}: no free spot in ${R.id}`); return null; }
    set.push(c.q);
    moved.push({ what, room: R.id, from: [p[0], p[1]], to: c.q.slice(0, 2), by: r2(c.d) });
    return c.q;
  };
  // THE START: the level's own (its door), on the grid where it stands; THE WAYS OUT: the plan's doors, a step inside
  const start = gridOf(frame, spawn);
  const ways = (plan.ways ?? []).map((w) => {
    const R = plan.rooms.find((r) => r.id === w.room), m = (w.lo + w.hi) / 2, [x0, y0, x1, y1] = R.box;
    const p = w.side === '-y' ? [m, y0 + IN] : w.side === '+y' ? [m, y1 - IN] : w.side === '-x' ? [x0 + IN, m] : [x1 - IN, m];
    return { room: w.room, side: w.side, at: [r2(p[0]), r2(p[1]), O.floors[R.storey ?? 0] ?? 0] };
  });
  const G0 = phasesOnMap(brief, map, { seed: dice, start, exits: ways.map((w) => gridOf(frame, w.at)) });
  const laws = phaseLaws(G0, map);
  const heart = realOf(frame, G0.heart);
  const sections = [];
  for (const S of G0.sections) {
    const entry = realOf(frame, S.entry), out = { id: S.id, kind: S.kind, band: S.band, entry, foes: [], drops: [], door: null, zone: null, cells: S.cells };
    const T = S.task;
    if (T.kind === 'reach') {
      // (a real way out: the door its grid cell reads, a step inside it)
      const c = S.cells.at, way = ways.find((w) => { const g = gridOf(frame, w.at); return g[0] === c[0] && g[1] === c[1] && g[2] === c[2]; }) ?? ways[0];
      const at = way ? hold(way.at, `${S.id}: the way out`) : hold(realOf(frame, T.at), `${S.id}: the way out`);
      out.task = { kind: 'reach', text: T.text, at: at ?? spawn.slice(), planar: false };
      out.way = way ? { room: way.room, side: way.side } : null;
    } else {
      for (const d of S.drops) { const at = hold(realOf(frame, d.at), `${S.id}: ${d.gives}`); if (at) out.drops.push({ at, gives: d.gives }); }
      for (const f of S.foes) {
        const at = hold(realOf(frame, f.at), `${S.id}: ${f.id}`);
        if (at) out.foes.push({ id: f.id, at, heading: r2(Math.atan2(entry[1] - at[1], entry[0] - at[0])) });
      }
      const kept = new Set(out.foes.map((f) => f.id));
      if (T.kind === 'take') {
        const lies = out.drops[0]?.at ?? hold(realOf(frame, T.at), `${S.id}: what is taken`) ?? entry;
        out.task = { kind: 'take', text: T.text, at: lies.slice(), planar: false };
      } else if (T.kind === 'hold') {
        out.task = { ...T, waves: T.waves.map((w) => w.filter((id) => kept.has(id))).filter((w) => w.length), at: heart.slice() };
      } else out.task = { ...T, foes: T.foes.filter((id) => kept.has(id)) };
    }
    // (a clear with every foe left out has nothing to clear: it is left out, and said)
    if ((out.task.kind === 'clear' && !out.task.foes.length)) { dropped.push(`${S.id}: every foe left out, so the section is`); continue; }
    sections.push(out);
  }
  laws.push({
    law: 'placed-in-plan',
    holds: !dropped.length,
    says: dropped.length ? `left out (no free floor for it in its room): ${dropped.slice(0, 4).join('; ')}`
      : `every place stands in its room on its floor, clear of the walls, the stairs and the stock${moved.length ? `; ${moved.length} moved off the grid's snap (${moved.slice(0, 3).map((m) => `${m.what} ${m.by} m in ${m.room}`).join(', ')}${moved.length > 3 ? ', …' : ''})` : ''}`,
  });
  const exitS = sections.findLast((S) => S.task?.kind === 'reach');
  // the storey over the ground and the stairs up to it, for the minds a hold sends (missionCast; a mind's `rule.floors`):
  // its rooms' and decks' reach, each stair from the ground a flight walked by its own points, a switchback's turn and
  // all. One storey: a mind crosses the ground and the floor over it, and a storey higher is not handed to it
  const upper = O.floors.length > 1 ? roomsOn(1) : [], ups = frame.stairs.filter((x) => Math.abs(x.z0 - O.floors[0]) < 0.05 && Math.abs(x.z1 - O.floors[1]) < 0.05);
  const floors = upper.length && ups.length ? [{
    area: [r2(Math.min(...upper.map((R) => R.box[0]))), r2(Math.min(...upper.map((R) => R.box[1]))), r2(Math.max(...upper.map((R) => R.box[2]))), r2(Math.max(...upper.map((R) => R.box[3])))],
    z: O.floors[1], flights: ups.map((x) => ({ bottom: x.way[0].slice(), top: x.way.at(-1).slice(), way: x.way.map((q) => q.slice()) })),
  }] : null;
  const mission = {
    on: 'building', seed: dice, heading: heading ?? G0.heading, sections, primitives: [],
    anchors: { spawn: spawn.slice(), exit: exitS ? exitS.task.at.slice() : spawn.slice() }, heart, cells: G0.cells, frame,
    ...(floors ? { floors } : {}),
  };
  if (brief.squad) mission.squad = brief.squad;
  return { brief, mission, laws, map, moved, dropped };
}
