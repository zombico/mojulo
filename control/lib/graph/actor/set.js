/**
 * set — a WORLD as a scene's set: its named places as the screenplay's marks, the floor under them, its rooms from
 * above. The places are those a game's written scene reads (playscape/ui/scene-script.js): the world's anchors with a
 * stand on each side of a door (playscape/ui/cast.js standPoints, `<door>-<room>`), and each room's middle as
 * `room-<id>`, every name in the letters a screenplay writes a mark in (`placeName`). What hangs on
 * a wall (a torch, a niche) is no place to stand and is left out. Feet worlds are read in metres (payload.metersPerUnit).
 *
 *   setPlaces(payload) → { marks: { <id>: [x, y] }, floors: { <id>: z }, rooms: [{ id, min: [x, y], max: [x, y], walled?, h?, solids?, blocks?, openings? }],
 *     paths?: [[[x, y], …]] the ways a walker goes in a geocube's world (its trail, its sidewalks) }
 *   castOnSet(sp, set) → the screenplay with the set's places among its marks (its own marks win) and, for a part with
 *     no mark, a mark of its own about the largest room's middle (or the first place), the cast in a line PAIR apart;
 *     `floor` the place's height under the first part's mark; on a set that says what stands on its floor,
 *     `floor_plan` beside them (what the scene's crosses go round: scene.js)
 *
 * Pure and deterministic.
 */
import { standPoints } from '../playscape/ui/cast.js';
import { PAIR } from './scene.js';

/** what hangs on a wall: a place to light or to look at, not to stand */
export const WALL_KINDS = Object.freeze(['torch', 'niche', 'sign', 'window']);
/** how far before a building's front its place to stand is, metres */
const FRONT = 1.6;
/** how many of a city's street corners are places, and how far in from the kerb a corner's place is, metres */
const CORNERS = 4, KERB = 2;
const r3 = (v) => Math.round(v * 1000) / 1000;
/** a place's name as a screenplay writes it (screenplay.js reads a mark as lower-case letters, digits, - and _) */
export const placeName = (id) => String(id ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

/** The world's places, in metres (see the header) */
export function setPlaces(payload) {
  const k = Number.isFinite(payload?.metersPerUnit) && payload.metersPerUnit > 0 ? payload.metersPerUnit : 1;
  const marks = {}, floors = {}, rooms = [];
  const put = (raw, at) => { const id = placeName(raw); if (!id || !Array.isArray(at) || at.length < 2 || !at.slice(0, 2).every(Number.isFinite) || Object.hasOwn(marks, id)) return; marks[id] = [r3(at[0] * k), r3(at[1] * k)]; floors[id] = r3((Number.isFinite(at[2]) ? at[2] : 0) * k); };
  for (const R of Array.isArray(payload?.rooms) ? payload.rooms : []) {
    const b = R?.box, lo = b?.min ?? (Array.isArray(b) ? b.slice(0, 2) : null), hi = b?.max ?? (Array.isArray(b) ? b.slice(2, 4) : null);
    if (!R?.id || !lo || !hi) continue;
    // (`walled`: a room closed on every side, which a camera must stand inside, actor/coverage.js fitRoom; `h` its ceiling (`z` its floor, when not 0), `solids` what
    // stands in it taller than a camera, `blocks` everything that stands on its floor, each with its height `h`)
    const rects = (v) => (R.walled && Array.isArray(v) ? v.filter((B) => B?.min && B?.max).map((B) => ({ min: [r3(B.min[0] * k), r3(B.min[1] * k)], max: [r3(B.max[0] * k), r3(B.max[1] * k)], ...(Number.isFinite(B.h) && B.h > 0 ? { h: r3(B.h * k) } : {}) })) : []);
    const solids = rects(R.solids), blocks = rects(R.blocks);
    // (its doors and windows, each a span along a wall with its sill and head above the floor: a storyboard draws them)
    const openings = rects(R.openings).map((B, i) => { const O = R.openings.filter((o) => o?.min && o?.max)[i]; return { kind: O.kind === 'door' ? 'door' : 'window', ...B, sill: r3((Number.isFinite(O.sill) ? O.sill : 0) * k), head: r3((Number.isFinite(O.head) ? O.head : 0) * k) }; }).filter((O) => O.head > O.sill);
    rooms.push({ id: R.id, min: [r3(lo[0] * k), r3(lo[1] * k)], max: [r3(hi[0] * k), r3(hi[1] * k)], ...(R.walled ? { walled: true, ...(Number.isFinite(R.h) ? { h: r3(R.h * k) } : {}), ...(lo[2] ? { z: r3(lo[2] * k) } : {}), ...(solids.length ? { solids } : {}), ...(blocks.length ? { blocks } : {}), ...(openings.length ? { openings } : {}) } : {}) });
    // (a furnished room says where its open floor is, `stand`; a bare one is stood in its middle)
    const stand = Array.isArray(R.stand) && R.stand.slice(0, 2).every(Number.isFinite) ? R.stand : [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
    put(`room-${R.id}`, [stand[0], stand[1], lo[2] ?? 0]);
  }
  const anchors = (Array.isArray(payload?.anchors) ? payload.anchors : []).filter((a) => a && !WALL_KINDS.includes(a.kind));
  // (a place that is a building, its `box` and the way its front faces, `N`: the place to stand is before its front,
  //  a step off the wall, on the ground the building stands on, not the middle of it)
  const before = (a) => {
    const b = a.box, n = a.N;
    if (!b?.min || !b?.max || !Array.isArray(n) || !Array.isArray(a.at) || !(Math.hypot(n[0], n[1]) > 1e-6)) return a.at;
    const l = Math.hypot(n[0], n[1]), d = [n[0] / l, n[1] / l];
    // how far along the front's way the box's edge is from the place, and FRONT metres past it
    const tx = d[0] > 1e-6 ? (b.max[0] - a.at[0]) / d[0] : d[0] < -1e-6 ? (b.min[0] - a.at[0]) / d[0] : Infinity, ty = d[1] > 1e-6 ? (b.max[1] - a.at[1]) / d[1] : d[1] < -1e-6 ? (b.min[1] - a.at[1]) / d[1] : Infinity;
    const t = Math.max(0, Math.min(tx, ty)) + FRONT / k;
    return [a.at[0] + d[0] * t, a.at[1] + d[1] * t, Number.isFinite(a.floor) ? a.floor : a.at[2]];
  };
  for (const a of anchors) put(a.id, before(a));
  for (const s of standPoints(anchors)) put(s.id, s.at);
  // PLACES A WORLD KNOWS BUT DOES NOT NAME (a geocube's land, town or city): where a walker starts, its streets and
  // where two cross. Read from what the world already carries; a world that carries none is as it was
  const open = payload?.geocube || payload?.geotown || payload?.geocity;
  const spawn = payload?.walk?.spawn;
  // (the walk's start: a spawn is given at the eye, so its floor is the eye's height under it)
  if (open && Array.isArray(spawn) && spawn.slice(0, 3).every(Number.isFinite)) put('start', [spawn[0], spawn[1], spawn[2] - (Number.isFinite(payload.walk.minEye) ? payload.walk.minEye : 1.7)]);
  // (a town's streets, each the middle of its run; and the first place a street running one way meets one running the other)
  const ports = (Array.isArray(payload?.geotown?.ports) ? payload.geotown.ports : []).filter((p) => Array.isArray(p?.from) && Array.isArray(p?.to) && p.from.concat(p.to).every(Number.isFinite));
  const zOf = (p, t) => (Array.isArray(p.z) && p.z.every(Number.isFinite) ? p.z[0] + (p.z[1] - p.z[0]) * t : 0);
  ports.forEach((p, i) => put(i ? `street-${i + 1}` : 'street', [(p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2, zOf(p, 0.5)]));
  cross: for (const a of ports) for (const b of ports) {
    const d = [a.to[0] - a.from[0], a.to[1] - a.from[1]], e = [b.to[0] - b.from[0], b.to[1] - b.from[1]], det = d[0] * e[1] - d[1] * e[0];
    if (a === b || Math.abs(det) < 1e-9) continue;
    const t = ((b.from[0] - a.from[0]) * e[1] - (b.from[1] - a.from[1]) * e[0]) / det, u = ((b.from[0] - a.from[0]) * d[1] - (b.from[1] - a.from[1]) * d[0]) / det;
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    put('crossing', [a.from[0] + d[0] * t, a.from[1] + d[1] * t, zOf(a, t)]);
    break cross;
  }
  // (a city's street corners: the crossings nearest its seat, each stood on the pavement at the corner, not in the
  //  road; their height the nearest the city's own walker goes at, a hint the ground is then read from)
  const seat = payload?.geocity?.seat, sigs = Array.isArray(payload?.flow?.signals) ? payload.flow.signals.filter((g) => [g?.x, g?.y].every(Number.isFinite)) : [];
  if (Array.isArray(seat) && seat.slice(0, 2).every(Number.isFinite) && sigs.length) {
    const walked = (Array.isArray(payload?.walkers) ? payload.walkers : []).flatMap((W) => (Array.isArray(W?.path) ? W.path : [])).filter((q) => Array.isArray(q) && q.slice(0, 3).every(Number.isFinite));
    const hint = (x, y) => walked.reduce((b, q) => { const d = Math.hypot(q[0] - x, q[1] - y); return d < b.d ? { d, z: q[2] } : b; }, { d: Infinity, z: Array.isArray(spawn) ? spawn[2] - 1.7 : 0 }).z;
    sigs.map((g, i) => ({ g, i, d: Math.hypot(g.x - seat[0], g.y - seat[1]) })).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, CORNERS).forEach(({ g }, i) => {
      const x = g.x + (Number.isFinite(g.wx) ? g.wx / 2 : 6) + KERB / k, y = g.y - (Number.isFinite(g.wy) ? g.wy / 2 : 6) - KERB / k;
      put(i ? `corner-${i + 1}` : 'corner', [x, y, hint(x, y)]);
    });
  }
  // (the ways a walker goes in it: a trail, a sidewalk. A cross between two places on one follows it: route.js pathWalk)
  const paths = (Array.isArray(payload?.walkers) ? payload.walkers : []).map((W) => (Array.isArray(W?.path) ? W.path.filter((q) => Array.isArray(q) && q.slice(0, 2).every(Number.isFinite)).map((q) => [r3(q[0] * k), r3(q[1] * k)]) : [])).filter((P) => P.length > 1);
  return { marks, floors, rooms, ...(open && paths.length ? { paths } : {}) };
}

/** The screenplay cast on the set (see the header) */
export function castOnSet(sp, set) {
  const own = sp.marks ?? {}, marks = { ...set.marks, ...own }, cast = { ...sp.cast };
  const names = Object.keys(cast), free = names.filter((w) => cast[w].mark === undefined);
  // (the set's largest room: where a coverage has the most room to stand its cameras)
  const area = (R) => (R.max[0] - R.min[0]) * (R.max[1] - R.min[1]);
  const first = [...set.rooms].sort((x, y) => area(y) - area(x))[0], mid = first ? set.marks[placeName(`room-${first.id}`)] ?? [(first.min[0] + first.max[0]) / 2, (first.min[1] + first.max[1]) / 2] : Object.values(set.marks)[0] ?? [0, 0];
  const midFloor = first ? set.floors[placeName(`room-${first.id}`)] ?? 0 : set.floors[Object.keys(set.marks)[0]] ?? 0;
  const floors = { ...set.floors };
  free.forEach((w, i) => {
    const id = `${w}-mark`;
    if (!Object.hasOwn(marks, id)) { marks[id] = [r3(mid[0] + (i - (free.length - 1) / 2) * PAIR), r3(mid[1])]; floors[id] = midFloor; }
    cast[w] = { ...cast[w], mark: id };
  });
  const lead = cast[names[0]]?.mark;
  // (a mark the screenplay gives itself stands on that room's floor)
  // (what stands on the set's floor, for the crosses to go round: scene.js `floor_plan`, route.js)
  const blocks = set.rooms.flatMap((R) => R.blocks ?? []);
  const plan = blocks.length ? { floor_plan: { blocks, rooms: set.rooms.filter((R) => R.walled).map((R) => ({ min: R.min, max: R.max })) } } : {};
  return { screenplay: { ...sp, marks, cast }, ...plan, floor: Object.hasOwn(own, lead) ? midFloor : floors[lead] ?? midFloor };
}
