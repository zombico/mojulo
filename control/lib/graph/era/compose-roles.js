/**
 * THE ROOMS' ROLES (the scene composer, era/compose.js): what each room of a stage is for in the walk through it, read
 * from the plan's own graph (its rooms, doorways, ways in, stairs and goal), so a program's building, a hall and a hand-
 * laid stage are read alike. A role names the set piece the room holds and its FOCUS, the spot the room is built to be
 * looked at from its doorway: the light plot makes it the brightest thing there (the plot's work, not this module's).
 *
 *   ROLES   { role: { setPiece, focus, words } }
 *     arrival   the way in: what it shows first is the way on
 *     passage   a corridor or a stair room: the way on, nothing to stop for
 *     landmark  the room the building is for: something great at the end of the sightline
 *     pocket    a dead end with something in it
 *     climax    the goal: what the level is played for
 *     rest      a still, even room
 *   roomRoles(plan, { goal?, pinned? }) → [{ room, role, setPiece, focus: [x, y, z], why }]   in the plan's room order
 *     goal    the goal room's id (a program's); pinned { room: role } kept over the reading
 *
 * The reading, in order: the goal is the climax; the room of the first way in (the walk's entry; another way in is a
 * way out) is the arrival; a stair's room and a long narrow room (LONG times as long as wide, at most NARROW wide) are
 * passages; the biggest of the rest, by its floor times its height, is the landmark when it is at least BIG times the
 * middle room's; the deepest dead ends of each storey, POCKETS at most (in-hall's cap: a building of rooms off a corridor
 * has a dead end at every door, and a find behind every one is none), are pockets; the rest are rests.
 */

export const ROLES = Object.freeze({
  arrival: Object.freeze({ setPiece: 'sign', focus: 'way-on', words: 'the way in: what it shows first is the way on' }),
  passage: Object.freeze({ setPiece: null, focus: 'way-on', words: 'a corridor or a stair room: the way on, nothing to stop for' }),
  landmark: Object.freeze({ setPiece: 'great-object', focus: 'far', words: 'the room the building is for: something great at the end of the sightline' }),
  pocket: Object.freeze({ setPiece: 'find', focus: 'far', words: 'a dead end with something in it' }),
  climax: Object.freeze({ setPiece: 'prize', focus: 'far', words: 'the goal: what the level is played for' }),
  rest: Object.freeze({ setPiece: null, focus: 'centre', words: 'a still, even room' }),
});
export const ROLE_IDS = Object.freeze(Object.keys(ROLES));
const LONG = 3, NARROW = 4, BIG = 1.5, POCKETS = 2;
// the focus stands this far off the far wall, at about a standing eye's height over its floor
const OFF = 1.5, EYE = 1.5;
const r3 = (v) => Math.round(v * 1000) / 1000;

// a doorway's middle on its wall, and the way it opens into `into` (+1 or -1 along its axis)
function doorway(l, into) {
  const X = l.wall.endsWith('x'), s = l.wall.startsWith('+') ? 1 : -1, mid = (l.lo + l.hi) / 2;
  return { at: X ? [l.at, mid] : [mid, l.at], axis: X ? 0 : 1, dir: into === l.to ? s : -s };
}

/** Each room's role in the walk, its set piece and its focus. */
export function roomRoles(plan, { goal, pinned = {} } = {}) {
  const rooms = plan.rooms, byId = new Map(rooms.map((r) => [r.id, r]));
  for (const [id, role] of Object.entries(pinned)) {
    if (!byId.has(id)) throw new Error(`stage: compose.roles.${id}: no such room (${rooms.map((r) => r.id).join(', ')})`);
    if (!ROLES[role]) throw new Error(`stage: compose.roles.${id} is ${ROLE_IDS.join(', ')}`);
  }
  // the graph: doorways both ways, a stair as a step between its rooms
  const next = new Map(rooms.map((r) => [r.id, []]));
  for (const l of plan.links || []) { next.get(l.from)?.push({ to: l.to, link: l }); next.get(l.to)?.push({ to: l.from, link: l }); }
  for (const s of plan.stairs || []) { next.get(s.lower)?.push({ to: s.upper, stair: s }); next.get(s.upper)?.push({ to: s.lower, stair: s }); }
  // the walk from the ways in (else the first room): how each room is entered, and its way on toward the goal
  const first = (plan.ways || []).find((w) => byId.has(w.room));
  const entry = [first ? first.room : rooms[0].id], came = new Map(entry.map((id) => [id, null])), q = [...entry];
  while (q.length) { const id = q.shift(); for (const e of next.get(id)) if (!came.has(e.to)) { came.set(e.to, { from: id, ...e }); q.push(e.to); } }
  const toward = new Map();
  if (goal && came.has(goal)) for (let c = goal; came.get(c); c = came.get(c).from) toward.set(came.get(c).from, came.get(c));
  const size = (r) => (r.x1 - r.x0) * (r.y1 - r.y0) * r.h;
  const stairRooms = new Set((plan.stairs || []).flatMap((s) => [s.lower, s.upper]));
  const role = new Map(), why = new Map(), set = (id, ro, w) => { if (!role.has(id)) { role.set(id, ro); why.set(id, w); } };
  for (const [id, ro] of Object.entries(pinned)) set(id, ro, 'pinned');
  if (goal && byId.has(goal)) set(goal, 'climax', 'the goal');
  for (const id of entry) set(id, 'arrival', 'a way in');
  for (const r of rooms) {
    const w = r.x1 - r.x0, d = r.y1 - r.y0, long = Math.max(w, d) / Math.min(w, d);
    if (stairRooms.has(r.id)) set(r.id, 'passage', 'a stair\'s room');
    else if (long >= LONG && Math.min(w, d) <= NARROW) set(r.id, 'passage', 'long and narrow');
  }
  // (the landmark before the pockets: a room that big is what the building is for, a dead end or not)
  const open = rooms.filter((r) => !role.has(r.id)), sizes = rooms.map(size).sort((a, b) => a - b);
  const big = open.length ? open.reduce((b, r) => (size(r) > size(b) ? r : b)) : null;
  if (big && size(big) >= BIG * sizes[(sizes.length - 1) >> 1]) set(big.id, 'landmark', 'the biggest room');
  // (the deepest dead ends of each storey; of those as deep, the farthest from the way in, then the walk's order)
  const depth = (id) => { let n = 0; for (let c = came.get(id); c; c = came.get(c.from)) n++; return n; };
  const E = byId.get(entry[0]), mid = (r) => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], away = (r) => Math.hypot(mid(r)[0] - mid(E)[0], mid(r)[1] - mid(E)[1]);
  const ends = rooms.filter((r) => !role.has(r.id) && next.get(r.id).length === 1 && came.has(r.id));
  for (const s of new Set(ends.map((r) => r.storey ?? 0))) {
    ends.filter((r) => (r.storey ?? 0) === s).map((r, i) => ({ r, i, d: depth(r.id), far: away(r) })).sort((a, b) => b.d - a.d || b.far - a.far || a.i - b.i)
      .slice(0, POCKETS).forEach(({ r }) => set(r.id, 'pocket', 'a dead end, deep in the walk'));
  }
  for (const r of rooms) set(r.id, 'rest', 'none of the others');
  return rooms.map((r) => {
    const ro = role.get(r.id), R = ROLES[ro], z = (r.z0 ?? 0) + EYE, c = came.get(r.id);
    const centre = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    // the way on: toward the goal, else the first doorway out that is not the one come in by
    const on = toward.get(r.id) ?? next.get(r.id).find((e) => e.link && !(c && c.link === e.link));
    let at = centre;
    if (R.focus === 'way-on' && on?.link) at = doorway(on.link, on.to).at;
    else if (R.focus === 'far' && c?.link) {
      // straight across from the doorway come in by, short of the far wall
      const D = doorway(c.link, r.id), lo = D.axis ? r.y0 : r.x0, hi = D.axis ? r.y1 : r.x1, far = D.dir > 0 ? hi - OFF : lo + OFF;
      at = D.axis ? [D.at[0], far] : [far, D.at[1]];
    }
    return { room: r.id, role: ro, setPiece: R.setPiece, focus: [r3(at[0]), r3(at[1]), r3(z)], why: why.get(r.id) };
  });
}
