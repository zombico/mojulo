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

/** The plan route from the entry up (or down) to the goal's storey: each stair's flights in climbing order. */
function stairRoute(read, from, to) {
  const out = [];
  const step = to > from ? 1 : -1;
  for (let s = from; s !== to; s += step) {
    const st = read.elements.stairs.find((x) => (x.from === s && x.to === s + step) || (x.to === s && x.from === s + step));
    if (!st || !st.flights) return null;                 // no flight between these storeys: the goal is out of reach
    const climbing = st.from === s;
    const up = climbing ? st.flights : [...st.flights].reverse();
    // a walker steers greedily and turns in a circle several feet across, so its points are far apart and in line:
    // 4 ft short of the first flight's foot, straight up to its head, the landing's middle between a switchback's
    // flights, the next head, and 3 ft on past the last (going down, the same from the top)
    up.forEach((f, i) => {
      const [foot, head] = footAndHead(f);
      const [a, b] = climbing ? [foot, head] : [head, foot];
      const dir = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
      if (i === 0) out.push([a[0] - dir[0] * 4, a[1] - dir[1] * 4]);
      else if (st.landing) out.push(centre(st.landing.rect));
      out.push(b);
      if (i === up.length - 1) out.push([b[0] + dir[0] * 3, b[1] + dir[1] * 3]);
    });
  }
  return out;
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
  const route = room.storey === ground ? [] : stairRoute(read, ground, room.storey);
  if (!route) return { error: `no stair climbs from L${ground + 1} to the goal's storey L${room.storey + 1}` };
  const st = (i) => read.storeys.find((s) => s.index === i);
  const goalPlan = centre(room.rect);
  const headingPlan = Math.atan2(dy, dx);
  return {
    frame: flip ? 'plan-reflected' : 'world',
    spawn: [...toWorld(spawnPlan), r2(st(ground).baseZ)],
    heading: r2(flip ? -headingPlan : headingPlan),
    door: door.tag,
    goal: { room: room.tag, name: room.name, at: [...toWorld(goalPlan), r2(st(room.storey).baseZ)] },
    route: route.map(toWorld),
    colliders: wallColliders(read, toWorld),
  };
}

/** Is this manifest a rail building that asks to be a level? */
export const asksLevel = (m) => !!(m && typeof m === 'object' && m.level && typeof m.level === 'object' && !m.game);

/**
 * A building manifest with its level lowered: the `game` channel (reach-exit at the goal, routed through the
 * stairs for the audit), a first-person walker at the entry, its camera, and the wall colliders. `ref` is the
 * level's own sketch ref (its levelRef). A manifest that does not ask (or already carries `game`) passes through.
 */
export function withBuildingLevel(m, ref, read = null) {
  if (!asksLevel(m)) return m;
  const r = read || readStructure(m);
  if (!r) return m;
  const L = buildingLevel(r, { goal: m.level.goal });
  if (L.error) throw new Error(`level: ${L.error}`);
  const radius = m.level.radius ?? 3;
  return {
    ...m,
    // the zone watches the walker, whose position is its eye: the goal stands at the goal room's eye height
    game: { levelRef: ref, mechanics: [{ kind: 'reach-exit', at: [L.goal.at[0], L.goal.at[1], r2(L.goal.at[2] + EYE)], radius, planar: false, ...(L.route.length ? { via: L.route } : {}) }], fall: { mode: 'respawn' } },
    // first person: the mouse looks once captured (click the view), A/D and the arrows turn, W/S walk, Q/E strafe
    entities: [{ id: 'player', pilotable: true, rule: { type: 'walk', speed: 9, turn: 4, eye: EYE, turnMode: 'look', keyTurn: true, strafe: 1 }, body: { type: 'none' }, transform: { pos: [L.spawn[0], L.spawn[1], L.spawn[2] + EYE], heading: L.heading } }],
    camera: { rule: 'follow', target: 'player', dist: 0.05, height: 0, lookH: 0, lead: 2, turnMode: 'look' },
    colliders: L.colliders,
  };
}
