/**
 * A LEVEL HELD AS AN ESCAPE ROOM (a level's `goal: { escape }`, world.js): the level's last stage is a room whose way out
 * is sealed until its locks open, each by a key lying inside it (the escape-room mechanic, game/escape-room.js), laid on
 * the stage's own ends so the walk the audit takes passes its keys, then its locks, then the way out.
 *   on a trail       the keys on the beats along the way (spread over them), the locks on the approach to the exit, a
 *                    few metres apart, and a walker turned away at the seal put back before them
 *   in a building    the keys spread along its route from the way in toward the goal room (the walk through its
 *                    doorways), the locks a step short of the goal room's door, a walker turned away put back there; its
 *                    audit walks the route itself, which passes them in that order
 * Names: the room is the level's id, so its keys, locks and seal are `<level>-key-<n>`, `<level>-lock-<n>`,
 * `<level>-seal` wherever the level travels.
 *
 *   ESCAPE_LOCKS            how many locks `escape: true` lays, and the most a level takes
 *   readEscapeGoal(v, room) → { locks, room }   (throws a teaching error)
 *   escapeRoomOf(E, ends)   → the escape-room mechanic for a stage (`ends`: levels.js stageEnds / a building's)
 *
 * Pure, no dice.
 */

export const ESCAPE_LOCKS = Object.freeze({ default: 2, max: 4 });
const r3 = (n) => Math.round(n * 1000) / 1000;

/** A level goal's `escape`, read: true (two locks) or how many (1 to 4); the room the level it holds. */
export function readEscapeGoal(v, room) {
  if (v === true) return { locks: ESCAPE_LOCKS.default, room };
  if (Number.isInteger(v) && v >= 1 && v <= ESCAPE_LOCKS.max) return { locks: v, room };
  // (read already: a level handed down again)
  if (v && typeof v === 'object' && Object.keys(v).length === 2 && Number.isInteger(v.locks) && v.locks >= 1 && v.locks <= ESCAPE_LOCKS.max && v.room === room) return { locks: v.locks, room };
  throw new Error(`goal.escape is true (${ESCAPE_LOCKS.default} locks) or how many locks hold the way out, 1 to ${ESCAPE_LOCKS.max}`);
}

// k of n spread over a list (the middle of each share), as a battle's foes are picked from the beats
const spread = (list, n) => Array.from({ length: n }, (_, k) => list[Math.min(list.length - 1, Math.floor(((k + 0.5) * list.length) / n))]);

/** The escape-room mechanic laid on a stage's ends. */
export function escapeRoomOf(E, ends) {
  const { room } = E, exit = ends.exit;
  // a building: its route through the doorways to the goal room (2D), the goal at the walker's eye
  if (!ends.planar && Array.isArray(ends.via) && ends.via.length >= 2) return buildingRoom(E, ends);
  const along = (ends.beats ?? []).filter((b) => b.beat !== 'exit' && b.beat !== 'trailhead').map((b) => b.at);
  const n = Math.max(1, Math.min(E.locks, along.length || E.locks));
  const s = ends.spawn, last = along.at(-1) ?? s;
  // the keys: on the beats, spread; a trail with none, on the way from the start toward the exit
  const keys = along.length ? spread(along, n) : Array.from({ length: n }, (_, k) => lerp(s, exit, (k + 1) / (n + 2)));
  // the locks: on the approach, from the exit back toward the last beat, 3 m apart from 5 m out; turned away, put back
  // past them
  const dx = last[0] - exit[0], dy = last[1] - exit[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const on = (d) => { const x = r3(exit[0] + ux * d), y = r3(exit[1] + uy * d), z = ends.ground ? ends.ground(x, y) : null; return [x, y, Number.isFinite(z) ? r3(z) : r3(exit[2] + ((last[2] - exit[2]) * Math.min(d, L)) / L)]; };
  const locks = Array.from({ length: n }, (_, k) => on(5 + 3 * (n - 1 - k)));
  const back = on(5 + 3 * n + 2);
  return {
    kind: 'escape-room', id: room,
    locks: locks.map((at, k) => ({ id: String(k + 1), at, key: { item: 'key', at: keys[k].slice() } })),
    at: exit.slice(), radius: 2.5, ...(ends.planar ? {} : { planar: false }), back: [back[0], back[1], r3(back[2] + 0.3)], ...(ends.via ? { via: ends.via } : {}),
  };
}

const lerp = (a, b, t) => [r3(a[0] + (b[0] - a[0]) * t), r3(a[1] + (b[1] - a[1]) * t), r3(a[2] + (b[2] - a[2]) * t)];

// a building's room: the walk along its route (from the way in to the goal room's door, a point each half metre) holds
// the keys, spread over the stretch clear of the way in and the door (each at the floor of the room it is in, climbing
// as the route does); the door the locks
function buildingRoom(E, ends) {
  const route = ends.via, exit = ends.exit, door = route.at(-1), before = route.at(-2), s0 = [ends.spawn[0], ends.spawn[1]];
  const pts = [s0, ...route.map((p) => [p[0], p[1]])], walk = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / 0.5));
    for (let k = i === 1 ? 0 : 1; k <= m; k++) walk.push([a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m]);
  }
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const spots = walk.filter((p) => d(p, door) > 3 && d(p, s0) > 1.5);
  const n = Math.max(1, Math.min(E.locks, spots.length));
  // the floor under a point on the walk: the room it stands in, the lowest at or above the floor the walk has reached
  let floor = ends.spawn[2] ?? 0;
  const floorAt = new Map(walk.map((p) => {
    const under = (ends.rooms ?? []).filter((r) => p[0] >= r.x - 0.01 && p[0] <= r.x + r.w + 0.01 && p[1] >= r.y - 0.01 && p[1] <= r.y + r.d + 0.01).map((r) => r.z).filter((z) => z >= floor - 0.01).sort((a, b) => a - b);
    if (under.length) floor = under[0];
    return [p, floor];
  }));
  const keys = spots.length ? spread(spots, n).map((p) => [r3(p[0]), r3(p[1]), r3(floorAt.get(p))]) : spread(ends.beats.map((b) => b.at), n);
  // the locks a step short of the door, half a metre apart back along the way to it, at the walker's eye
  const bx = before[0] - door[0], by = before[1] - door[1], L = Math.hypot(bx, by) || 1;
  const lockAt = (k) => [r3(door[0] + (bx / L) * 0.5 * k), r3(door[1] + (by / L) * 0.5 * k), exit[2]];
  return {
    kind: 'escape-room', id: E.room,
    locks: Array.from({ length: n }, (_, k) => ({ id: String(k + 1), at: lockAt(k), planar: false, radius: 1.4, key: { item: 'key', at: keys[k] } })),
    at: exit.slice(), radius: 1.5, planar: false, back: [door[0], door[1], exit[2]],
    // the walk the route already is: it passes the keys (on it), then the locks (at its end), then the goal
    audit: { kind: 'walkto', target: exit.slice(), via: route.map((p) => [p[0], p[1]]) },
  };
}
