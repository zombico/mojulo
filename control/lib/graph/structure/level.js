/**
 * structure/level — any building on the rail as a game level, at game depth (no frame, no trades, no BIM).
 *
 * A building's recipe asks for it with one field, `level: { goal? }`. The read already knows what a level needs:
 * the entry door, every room on every storey, the stairs and their flights, and every wall with its openings. From
 * it this module derives, purely:
 *   - the spawn: a walker just inside the entry door, facing in;
 *   - the goal: a room ('top', the default: the largest room on the top storey; a room tag like '301'; or a role
 *     like 'openOffice'), its centre at its floor;
 *   - the route: the entry, each stair's flights climbed in order, the goal (the audit walks it);
 *   - the colliders: a box per wall run between its doors (a lintel over each), on every storey.
 * Lowered on every read (`withBuildingLevel`), never stored: the recipe keeps `level: { goal }`, and the level's
 * `game` channel, walker, camera and colliders regenerate from the building, so an edit to the building moves them.
 *
 * Frames: the read is in plan feet (y south). A floor-kernel building's World is reflected (world y = −plan y,
 * polygonizer/floorplan-world.js); a school's is built in world frame already. Positions here are world frame.
 */

import { readStructure } from './read.js';
import { planStage } from '../era/stage.js';
import { withGeocube } from '../era/geocube.js';
import { withProgram } from '../era/programs.js';
import { buildNav } from '../worlds/controllable/nav.js';
import { stageColliders } from '../era/anchors.js';
import { stairColliders } from '../era/storeys.js';

// the kinds that lower their own level (a city's segment registers itself: city/plan/level.js), so a building's level
// never imports them
const LEVEL_KINDS = new Map();
/** A kind that lowers `level` itself: `lower(manifest, ref)` → the manifest with its game channel. */
export function registerLevelKind(kind, lower) { LEVEL_KINDS.set(kind, lower); }

// the walkers' own pathfinder (A* over the colliders, string-pulled), run once at lowering: the route goes round walls
const NAV = {};
buildNav(NAV);

const EYE = 5.3;                       // ft: the walker's eye, as the buildings' own walk holds it
const r2 = (n) => Math.round(n * 100) / 100;
const PLAN_FRAME = new Set(['house', 'store', 'restaurant', 'mall', 'office']);   // built through planToWorld

const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const inRoom = (p, r) => p[0] >= r.rect.x - 0.01 && p[0] <= r.rect.x + r.rect.w + 0.01 && p[1] >= r.rect.y - 0.01 && p[1] <= r.rect.y + r.rect.h + 0.01;
const NOT_A_GOAL = new Set(['circulation', 'core', 'unplanned', 'concourse']);

/** The storeys a walker reaches from `ground` by flights (a stair the read drew; a core or escalator it did not). */
function reachedByFlights(read, ground) {
  const seen = new Set([ground]);
  for (let grew = true; grew;) {
    grew = false;
    for (const st of read.elements.stairs) {
      if (!st.flights) continue;
      for (const [a, b] of [[st.from, st.to], [st.to, st.from]]) if (seen.has(a) && !seen.has(b)) { seen.add(b); grew = true; }
    }
  }
  return seen;
}

/**
 * The goal room: 'top' (the default) is the highest storey a flight reaches, and on it the room farthest from the
 * way in that is not circulation or a core (the deepest room: a level, not the room you start in); or a room tag
 * like '301'; or a role like 'openOffice'.
 */
export function goalRoom(read, goal = 'top', from = null) {
  if (goal === 'top' || goal == null) {
    const ground = read.storeys.some((s) => s.index === 0) ? 0 : read.storeys[0].index;
    const top = Math.max(...reachedByFlights(read, ground));
    const on = read.rooms.filter((r) => r.storey === top);
    const pick = on.filter((r) => !NOT_A_GOAL.has(r.role));
    const pool = pick.length ? pick : on;
    const far = (r) => (from ? Math.hypot(centre(r.rect)[0] - from[0], centre(r.rect)[1] - from[1]) : r.area);
    return pool.slice().sort((a, b) => far(b) - far(a) || b.area - a.area)[0] || null;
  }
  return read.rooms.find((r) => r.tag === String(goal)) || read.rooms.find((r) => r.role === goal) || null;
}

/** The flight's foot and head in plan: the middle of its rect at the low end of its climb, and at the high end. */
function footAndHead(f) {
  const [cx, cy] = centre(f.rect), [dx, dy] = f.climb;
  const hx = (f.rect.w / 2) * Math.abs(dx), hy = (f.rect.h / 2) * Math.abs(dy);
  return [[cx - dx * hx, cy - dy * hy], [cx + dx * hx, cy + dy * hy]];
}

/**
 * The plan route from the entry up (or down) to the goal's storey, stair by stair: where the walker meets each stair
 * (`enter`, on storey `on`), and its flights in climbing order (`climb`, ending on the next storey).
 */
function stairRoute(read, from, to) {
  const groups = [];
  const step = to > from ? 1 : -1;
  for (let s = from; s !== to; s += step) {
    const st = read.elements.stairs.find((x) => (x.from === s && x.to === s + step) || (x.to === s && x.from === s + step));
    if (!st || !st.flights) return null;                 // no flight between these storeys: the goal is out of reach
    const climbing = st.from === s;
    const up = climbing ? st.flights : [...st.flights].reverse();
    const out = [];
    // a walker steers greedily and turns in a circle several feet across, so its points are far apart and in line:
    // 4 ft short of the first flight's foot, straight up to its head, the landing's middle between a switchback's
    // flights, the next head, and 3 ft on past the last (going down, the same from the top)
    up.forEach((f, i) => {
      const [foot, head] = footAndHead(f);
      const [a, b] = climbing ? [foot, head] : [head, foot];
      const dir = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
      // the approach: up to 4 ft short of the foot, but inside a room on this storey (a flight can start by a wall)
      if (i === 0) {
        const back = [4, 3, 2, 1.2, 0].find((k) => { const p = [a[0] - dir[0] * k, a[1] - dir[1] * k];
          return k === 0 || read.rooms.some((r) => r.storey === s && p[0] > r.rect.x + 1 && p[0] < r.rect.x + r.rect.w - 1 && p[1] > r.rect.y + 1 && p[1] < r.rect.y + r.rect.h - 1); });
        out.push([a[0] - dir[0] * back, a[1] - dir[1] * back]);
      }
      else if (st.landing) out.push(centre(st.landing.rect));
      out.push(b);
      if (i === up.length - 1) out.push([b[0] + dir[0] * 3, b[1] + dir[1] * 3]);
    });
    groups.push({ on: s, enter: out[0], climb: out.slice(1) });
  }
  return groups;
}

/**
 * The corners a walker of body `radius` turns at between two points on one floor (`footZ`), round the colliders; []
 * when the way is straight or not found (the walk then goes straight, as before).
 */
function corners(colliders, a, b, footZ, o) {
  const p = NAV.navPath({ colliders }, a, b, { radius: o.radius, height: o.height, footZ, step: o.step, cell: o.cell });
  return p && p.length ? p.slice(0, -1).map((q) => q.map(r2)) : [];
}

/** Box colliders from the walls: each run solid between its doors, a lintel over each door; windows stay solid. */
export function wallColliders(read, toWorld) {
  const out = [];
  const zOf = new Map(read.storeys.map((s) => [s.index, { z0: s.baseZ, z1: s.baseZ + s.height }]));
  for (const w of read.elements.walls) {
    const { z0, z1 } = zOf.get(w.storey) || { z0: 0, z1: 9 };
    const t = Math.max(0.3, w.thickness) / 2;
    const doors = read.elements.doors.filter((d) => d.host === w.tag)
      .map((d) => { const c = w.orientation === 'h' ? d.at.x : d.at.y; return { a: c - d.width / 2, b: c + d.width / 2, top: z0 + (d.height ?? 6.9) }; })
      .sort((p, q) => p.a - q.a);
    const box = (a, b, za, zb) => {
      if (b - a < 0.05 || zb - za < 0.05) return;
      const p0 = w.orientation === 'h' ? [a, w.at - t] : [w.at - t, a], p1 = w.orientation === 'h' ? [b, w.at + t] : [w.at + t, b];
      const [x0, y0] = toWorld(p0), [x1, y1] = toWorld(p1);
      out.push({ min: [r2(Math.min(x0, x1)), r2(Math.min(y0, y1)), r2(za)], max: [r2(Math.max(x0, x1)), r2(Math.max(y0, y1)), r2(zb)], of: `wall:${w.tag}` });
    };
    let u = w.along[0];
    for (const d of doors) { box(u, d.a, z0, z1); box(d.a, d.b, d.top, z1); u = d.b; }
    box(u, w.along[1], z0, z1);
  }
  return out;
}

/**
 * The level a building makes: { spawn, heading, goal: { room, at }, route, colliders, frame } in world frame, or
 * { error } when it cannot make one (no door in, a goal that names no room, no flight to the goal's storey).
 */
export function buildingLevel(read, { goal = 'top' } = {}) {
  const flip = PLAN_FRAME.has(read.occupancy?.id ?? 'house');
  const toWorld = (p) => [r2(p[0]), r2(flip ? -p[1] : p[1])];
  const ground = read.storeys.some((s) => s.index === 0) ? 0 : read.storeys[0].index;
  const doors = read.elements.doors.filter((d) => d.storey === ground && d.exterior);
  const door = doors.find((d) => d.entry) || doors[0];
  if (!door) return { error: 'the building has no door in on its ground floor' };
  const into = read.rooms.find((r) => r.tag === door.serves) || read.rooms.find((r) => r.storey === ground && inRoom([door.at.x, door.at.y], r));
  if (!into) return { error: `the entry ${door.tag} opens into no room` };
  // just inside the door, toward the middle of the room it opens into
  const [rcx, rcy] = centre(into.rect);
  const dx = rcx - door.at.x, dy = rcy - door.at.y, len = Math.hypot(dx, dy) || 1, inset = Math.min(3, len * 0.6);
  const spawnPlan = [door.at.x + (dx / len) * inset, door.at.y + (dy / len) * inset];
  const room = goalRoom(read, goal, [door.at.x, door.at.y]);
  if (!room) return { error: `the goal '${goal}' names no room (a room tag like '301', a role, or 'top')` };
  const stairs = room.storey === ground ? [] : stairRoute(read, ground, room.storey);
  if (!stairs) return { error: `no stair climbs from L${ground + 1} to the goal's storey L${room.storey + 1}` };
  const st = (i) => read.storeys.find((s) => s.index === i);
  const goalPlan = centre(room.rect);
  const headingPlan = Math.atan2(dy, dx);
  const colliders = wallColliders(read, toWorld);
  // the route: round the walls on each floor (door to stair, stair to stair, stair to the goal), up each stair's flights
  const nav = { radius: 0.9, height: EYE, step: 1, cell: 0.2 };
  const route = [];
  let at = toWorld(spawnPlan), z = st(ground).baseZ;
  for (const g of stairs) {
    const enter = toWorld(g.enter);
    route.push(...corners(colliders, at, enter, z, nav), enter, ...g.climb.map(toWorld));
    at = route[route.length - 1];
    z = st(g.on + (room.storey > ground ? 1 : -1)).baseZ;
  }
  route.push(...corners(colliders, at, toWorld(goalPlan), z, nav));
  // the way in from the threshold: a door zone a foot inside it, and a walker entering by it two strides further in
  const dirW = (() => { const a = toWorld([door.at.x, door.at.y]), b = toWorld([door.at.x + dx / len, door.at.y + dy / len]); return [b[0] - a[0], b[1] - a[1]]; })();
  const doorW = toWorld([door.at.x, door.at.y]);
  return {
    frame: flip ? 'plan-reflected' : 'world',
    spawn: [...toWorld(spawnPlan), r2(st(ground).baseZ)],
    heading: r2(flip ? -headingPlan : headingPlan),
    door: door.tag,
    entry: { at: [r2(doorW[0] + dirW[0] * 1.2), r2(doorW[1] + dirW[1] * 1.2), r2(st(ground).baseZ)], arrive: [r2(doorW[0] + dirW[0] * 6), r2(doorW[1] + dirW[1] * 6), r2(st(ground).baseZ)] },
    goal: { room: room.tag, name: room.name, at: [...toWorld(goalPlan), r2(st(room.storey).baseZ)] },
    route,
    colliders,
  };
}

/**
 * A room-kit stage (era/stage.js) as a level, in its own frame (metres, z-up; the World draws it as planned):
 * { spawn, heading, goal: { room, at }, route }, or { error }. The rooms are the stage's boxes and its doorways the
 * links between them; the walls are the stage's own colliders, already on its payload.
 *   - spawn: the stage's own (the first room), or the room `from` names; facing its first doorway;
 *   - goal: 'deepest' (the default) is the room most doorways from the spawn (a stair is one), the larger on a tie;
 *     'top' the deepest on the highest storey (on one storey, the same); or a room id; it stands a step (0.6 m) through
 *     the doorway the room is entered by (its middle is where a dressing seats its set piece), or where its stair is
 *     climbed out of;
 *   - route: through each doorway on the way, a step short of it and a step past it, in line with its wall's normal
 *     (past the last, the goal); up each stair from its approach, foot to head, to its arrival; on storeys, round the
 *     flights and the holes' rails between them.
 */
export function stageLevel(m, { goal = 'deepest', from = null } = {}) {
  // the stage as it builds: its program's rooms laid, its cube lowered under it
  const mp = m.program !== undefined ? withProgram(m) : m;
  const plan = planStage(mp.geocube !== undefined ? withGeocube(mp) : mp);
  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const start = from != null ? byId.get(String(from)) : plan.rooms[0];
  if (!start) return { error: `the level's 'from' names no room (${plan.rooms.map((r) => r.id).join(', ')})` };
  // breadth first from the spawn's room: each room's depth in doorways, and the doorway it was reached by
  // (a stage on storeys: its stairs are ways between rooms too, storeys.js)
  const ways = [...plan.links, ...(plan.stairs || []).map((x) => ({ ...x, stair: true }))];
  const via = new Map([[start.id, null]]), depth = new Map([[start.id, 0]]), queue = [start.id];
  while (queue.length) {
    const id = queue.shift();
    for (const l of ways) {
      const next = l.from === id ? l.to : l.to === id ? l.from : null;
      if (next == null || via.has(next)) continue;
      via.set(next, { link: l, prev: id }); depth.set(next, depth.get(id) + 1); queue.push(next);
    }
  }
  const area = (r) => (r.x1 - r.x0) * (r.y1 - r.y0);
  // 'top' on storeys: the deepest room of the highest storey reached
  const topStorey = plan.stairs ? Math.max(...plan.rooms.filter((r) => depth.has(r.id)).map((r) => r.storey)) : 0;
  const room = goal === 'deepest' || goal === 'top' || goal == null
    ? plan.rooms.filter((r) => depth.has(r.id) && (goal !== 'top' || !plan.stairs || r.storey === topStorey)).sort((a, b) => depth.get(b.id) - depth.get(a.id) || area(b) - area(a))[0]
    : byId.get(String(goal));
  if (!room) return { error: `the goal '${goal}' names no room (${plan.rooms.map((r) => r.id).join(', ')}, or 'deepest')` };
  if (!depth.has(room.id)) return { error: `no doorway leads from '${start.id}' to the goal '${room.id}': link the rooms` };
  const path = [];
  for (let id = room.id; via.get(id); id = via.get(id).prev) path.unshift({ link: via.get(id).link, into: id });
  const mid = (r) => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
  // a doorway's middle on its wall, and the way through it into `into`
  const door = ({ link: l, into }) => {
    const alongX = l.wall.endsWith('y'), m0 = (l.lo + l.hi) / 2, at = alongX ? [m0, l.at] : [l.at, m0];
    const sg = (l.wall.startsWith('+') ? 1 : -1) * (into === l.to ? 1 : -1);
    return { at, n: alongX ? [0, sg] : [sg, 0] };
  };
  const STEP = 1.5;
  // a stair is met at its approach and climbed foot to head, left at its arrival (going down, the other way)
  const stairWay = ({ link: x, into }) => {
    const up = into === x.upper, pt = (u) => (x.axis === 'y' ? [x.approach[0], u] : [u, x.approach[1]]);
    const seq = [x.approach, pt(x.foot + x.dir * 0.3), pt(x.head), x.arrival];
    return up ? seq : [...seq].reverse();
  };
  // a step short of each doorway and a step past it; past the last, the goal itself
  const route0 = path.flatMap((p, i) => { if (p.link.stair) return stairWay(p);
    const d = door(p), short = [d.at[0] - d.n[0] * STEP, d.at[1] - d.n[1] * STEP];
    return i === path.length - 1 ? [short] : [short, [d.at[0] + d.n[0] * STEP, d.at[1] + d.n[1] * STEP]]; });
  const spawn = from != null ? [...mid(start), start.z0 ?? 0] : plan.spawn;
  const first = path.length ? (path[0].link.stair ? stairWay(path[0])[0] : door(path[0]).at) : mid(room);
  // the goal stands a step through the doorway the room is entered by (its zone reaches on into the room), not at
  // its middle, where a dressing seats its set piece (a tomb, an altar) with a walkway round it a metre wide
  const IN = 0.6;
  const goalAt = (() => {
    if (!path.length) return mid(room);
    const last = path[path.length - 1];
    // up a stair, the goal is where it is climbed out of
    if (last.link.stair) return stairWay(last).at(-1);
    const d = door(last);
    return [d.at[0] + d.n[0] * IN, d.at[1] + d.n[1] * IN];
  })();
  // on storeys, the way between two points on one floor goes round the flights and the holes' rails (the walls too)
  const route = !plan.stairs ? route0 : (() => {
    const cols = [...plan.storeys.flatMap((st) => stageColliders({ ...plan, rooms: plan.rooms.filter((r) => r.storey === st.index) }, {}, [])
      .map((c) => ({ ...c, min: [c.min[0], c.min[1], c.min[2] + st.z0], max: [c.max[0], c.max[1], c.max[2] + st.z0] }))), ...stairColliders(plan.stairs)];
    // a stair's own points are on it (no corners there); its last puts the walk on the floor it climbs to
    const climbs = new Set(path.filter((p) => p.link.stair).flatMap((p) => stairWay(p).slice(1, -1).map((q) => q.join())));
    const pts = [spawn.slice(0, 2), ...route0, goalAt], out = [];
    let z = spawn[2] ?? 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (!climbs.has(a.join()) && !climbs.has(b.join())) out.push(...corners(cols, a, b, z, { radius: 0.4, height: STAGE_EYE, step: 0.35, cell: 0.2 }));
      if (i < pts.length - 1) out.push(b);
      const st = path.find((p) => p.link.stair && stairWay(p).at(-1).join() === b.join());
      if (st) z = st.into === st.link.upper ? st.link.z1 : st.link.z0;
    }
    return out;
  })();
  return {
    frame: 'world', unit: 'm',
    spawn: spawn.map(r2), heading: r2(Math.atan2(first[1] - spawn[1], first[0] - spawn[0])),
    goal: { room: room.id, at: [...goalAt.map(r2), r2(room.z0 ?? 0)], ...(plan.stairs ? { storey: room.storey } : {}) },
    route: route.map((p) => p.map(r2)),
  };
}

const STAGE_EYE = 1.7;   // m: the stage's own walk eye
export const PROBE = 0.6;   // m: on storeys, the ground is looked for from this high over the feet (rules-basic.js `probe`)
/** Does a stage recipe stand on storeys (its own rooms, or its program's)? */
export const storeyed = (m) => (Array.isArray(m.rooms) ? m.rooms : m.program !== undefined ? withProgram(m).rooms : []).some((r) => r && r.storey);

function withStageLevel(m, ref) {
  // a program names its goal room when the level does not
  const goal = m.level.goal ?? (m.program !== undefined ? withProgram(m).level.goal : undefined);
  const L = stageLevel(m, { goal, from: m.level.from });
  if (L.error) throw new Error(`level: ${L.error}`);
  const radius = m.level.radius ?? 1.5;
  // `mechanics`: the level's own beside the goal (pickups in its rooms, a clock); `exit: false` leaves the goal out
  const exit = { kind: 'reach-exit', at: [L.goal.at[0], L.goal.at[1], r2(L.goal.at[2] + STAGE_EYE)], radius, planar: false, ...(L.route.length ? { via: L.route } : {}) };
  // `door`: the way out is a DOOR to another level (an inside entered from outside, the scene changing at it): a door
  // in the way-in room's front wall, its zone just inside, and a walker entering by it standing a few steps in
  const D = typeof m.level.door === 'string' ? stageDoor(m, m.level.from) : null;
  const doorMech = D ? [{ kind: 'door', id: m.level.door, at: D.at, half: D.half, spawn: D.spawn, heading: D.heading }] : [];
  const game = { levelRef: ref, mechanics: [...(m.level.mechanics ?? []), ...doorMech, ...(m.level.exit === false ? [] : [exit])], fall: { mode: 'respawn' } };
  const doors = D ? { doors: [...(m.doors ?? []), { id: m.level.door, at: { side: '-y', u: D.u }, room: D.room, to: { map: 'outside', door: m.level.door } }] } : {};
  const spawn = D ? [D.spawn[0], D.spawn[1], 0] : L.spawn, heading = D ? D.heading : L.heading;
  // a recipe that brings its own pilot (a gameworld's hero) keeps it, its figures and its camera: only the game channel
  if (Array.isArray(m.entities) && m.entities.some((e) => e && e.pilotable)) return { ...m, ...doors, game };
  return {
    ...m,
    ...doors,
    game,
    // the stage's walls are its payload's colliders: the walker stops at them (no `colliders` here, which would replace them)
    // on storeys it looks for its ground just over its feet (it climbs a flight's treads, never onto the floor above)
    entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: 4.5, turn: 4, eye: STAGE_EYE, turnMode: 'look', keyTurn: true, strafe: 1, collideRadius: 0.3, ...(storeyed(m) ? { probe: PROBE } : {}) }, body: { type: 'none' }, transform: { pos: [spawn[0], spawn[1], spawn[2] + STAGE_EYE], heading } }],
    camera: { rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2, turnMode: 'look' },
  };
}

/**
 * The door out of a stage's way-in room (its program's entry, else `from`, else its first room), in the middle of its
 * front (-y) wall: where its zone stands (just inside), and where a walker entering by it stands and faces (2.6 m in,
 * into the room). `u` is along the wall from its inner corner, as a stage door end takes it (era/doors.js).
 */
function stageDoor(m, from = null) {
  const mp = m.program !== undefined ? withProgram(m) : m;
  const plan = planStage(mp.geocube !== undefined ? withGeocube(mp) : mp);
  const id = from ?? mp._program?.entry ?? plan.rooms[0].id, r = plan.rooms.find((q) => q.id === id) ?? plan.rooms[0];
  const mid = r2((r.x0 + r.x1) / 2), y = r.y0;
  return { room: r.id, u: r2(mid - r.x0), at: [mid, r2(y + 0.8), 0], half: [1.4, 0.7, 2], spawn: [mid, r2(y + 2.6), 0], heading: r2(Math.PI / 2) };
}

/** Is this manifest a building (on the rail, or a room-kit stage) that asks to be a level? */
export const asksLevel = (m) => !!(m && typeof m === 'object' && m.level && typeof m.level === 'object' && !m.game);

/**
 * A building manifest with its level lowered: the `game` channel (reach-exit at the goal, routed through the
 * stairs for the audit), a first-person walker at the entry, its camera, and the wall colliders. `ref` is the
 * level's own sketch ref (its levelRef). A manifest that does not ask (or already carries `game`) passes through.
 */
export function withBuildingLevel(m, ref, read = null) {
  if (!asksLevel(m)) return m;
  if (m.kind === 'stage') return withStageLevel(m, ref);
  // a kind that lowers its own (a city's segment, its city already merged in by ref: city/plan/ref.js)
  if (LEVEL_KINDS.has(m.kind)) return LEVEL_KINDS.get(m.kind)(m, ref);
  const r = read || readStructure(m);
  if (!r) return m;
  const L = buildingLevel(r, { goal: m.level.goal });
  if (L.error) throw new Error(`level: ${L.error}`);
  const radius = m.level.radius ?? 3;
  // `door`: the building is an inside entered by a door from another level (a city's lot, a town's): its entry is that
  // door, a zone just inside the threshold, a walker coming in by it standing two strides in, facing in
  const doorMech = typeof m.level.door === 'string' ? [{ kind: 'door', id: m.level.door, at: L.entry.at, radius: 2, spawn: L.entry.arrive, heading: L.heading }] : [];
  return {
    ...m,
    // the zone watches the walker, whose position is its eye: the goal stands at the goal room's eye height
    game: { levelRef: ref, mechanics: [...doorMech, { kind: 'reach-exit', at: [L.goal.at[0], L.goal.at[1], r2(L.goal.at[2] + EYE)], radius, planar: false, ...(L.route.length ? { via: L.route } : {}) }], fall: { mode: 'respawn' } },
    // first person: the mouse looks once captured (click the view), A/D and the arrows turn, W/S walk, Q/E strafe;
    // the walls stop it (a body 0.8 ft round, stepping onto a tread)
    entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: 9, turn: 4, eye: EYE, turnMode: 'look', keyTurn: true, strafe: 1, collideRadius: 0.8, collideHeight: EYE, step: 1 }, body: { type: 'none' }, transform: { pos: doorMech.length ? [L.entry.arrive[0], L.entry.arrive[1], L.entry.arrive[2] + EYE] : [L.spawn[0], L.spawn[1], L.spawn[2] + EYE], heading: L.heading } }],
    camera: { rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2, turnMode: 'look' },
    colliders: L.colliders,
  };
}
