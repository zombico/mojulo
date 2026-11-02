/**
 * A BUILDING AS A NODE — a building of the core shape (era/programs.js `shape: 'core'`: an office, a clinic, a lab, a
 * warehouse, every one of a base's) set into a site with a BASEMENT (era/program-core.js `basement`) and joined to a
 * network (network/): its storey 1 at the ground at its door, its basement under it, its passages leaving the basement's
 * walls that face out (the concourse under its lobby, its corridors' far ends, an annex's undercroft).
 *
 *   buildingFit(spec, { id, at, facing, door }) → fit | throws   where it stands before it is built: its plan (the program laid
 *       with its basement), its frame (its front door's middle at `at`, [x, y], its way in facing `facing`: '-y' | '+y'
 *       | '-x' | '+x'), its footprint, and its node for the network ({ id, rect, rooms: [{ id, rect, sides }], solid, door:
 *       the width of the ways its passages meet it by, its section's `door` })
 *   buildingNode(fit, { padZ, ports }) → node   built: its inside on its kit, lowered so its storey 1 meets `padZ`;
 *       `ports` ([{ id, room, side, u, width? }]: the network's ways out, on the world's sides, `width` the edge's door
 *       there, network/edges.js) laid as ways out of their rooms,
 *       each answered in the world ({ id, side, room, u, plane, lo, hi, z0, top, N, reach }); `down` its way from its door
 *       to its concourse and each port's `reach` from its stair's foot (the stage's own routes, structure/level.js, from
 *       the lobby), its faces, colliders and lights, its rooms' boxes, `rise` (storey 1 over the basement)
 *
 * `spec`: { use, seed?, storeys?, wings?, loading?, bays?, kit?, compose? } (a program's settings, its kit and its finish
 * on the bay axes). Its windows are buried (its outside is its site's, network/complex.js); nothing is laid on its floors
 * (the walks are the network's). Metres, the design's frame. Pure.
 */
import { withProgram } from '../era/programs.js';
import { assembleStageScene, planStage } from '../era/stage.js';
import { stageLevel } from '../structure/level.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
// the stage's wall: each room's interior a half wall inside its box (era/stage.js STAGE_KITS)
const T = 0.25;
const FACING = { '-y': [0, -1], '+y': [0, 1], '-x': [-1, 0], '+x': [1, 0] };
const SIDES = ['-y', '+y', '-x', '+x'];

/** The quarter turn that carries the plan's front (-y, out of the lobby's way in) onto `facing`. */
function turnFor(facing) {
  const q = { '-y': 0, '+x': 1, '+y': 2, '-x': 3 }[facing];
  const c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q];
  return { q, rot: ([x, y]) => [c * x - s * y, s * x + c * y], unrot: ([x, y]) => [c * x + s * y, -s * x + c * y] };
}
/** A side of the plan carried to the world's, and back. */
const sideTo = (rot, side) => { const v = rot(FACING[side]).map(Math.round); return SIDES.find((k) => FACING[k][0] === v[0] && FACING[k][1] === v[1]); };

export function buildingFit(spec, { id, at, facing = '-y', door = 2 }) {
  if (!FACING[facing]) throw new Error(`network: a building faces -y, +y, -x or +x (its way in), not ${facing}`);
  const { use, kit, compose, ...plan } = spec;
  const recipe = withProgram({ kind: 'stage', ...(kit ? { kit } : {}), ...(compose ? { compose } : {}), props: false, program: { use, ...plan, basement: true } });
  if (!recipe._program.under) throw new Error(`network: a ${use} has no basement (only a building of the core shape takes one)`);
  const PI = planStage(recipe), lobby = recipe.rooms.find((r) => r.id === 'lobby'), way = PI.ways.find((w) => w.room === 'lobby');
  const { q, rot, unrot } = turnFor(facing), N = FACING[facing];
  // (its door's middle on the lobby's outer wall face, at `at`)
  const doorPlan = [(way.lo + way.hi) / 2, lobby.y - T], Tw = at;
  const toWorld = ([x, y]) => { const [u, v] = rot([x - doorPlan[0], y - doorPlan[1]]); return [Tw[0] + u, Tw[1] + v]; };
  const toPlan = ([x, y]) => { const [u, v] = unrot([x - Tw[0], y - Tw[1]]); return [u + doorPlan[0], v + doorPlan[1]]; };
  const rectOf = (a0, b0, a1, b1) => { const a = toWorld([a0, b0]), c = toWorld([a1, b1]); return P3([Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]); };
  const ground = recipe.rooms.filter((r) => (r.storey ?? 0) === 1 || r.id === 'lobby');
  const xs = recipe.rooms.flatMap((r) => [r.x, r.x + r.w]), ys = recipe.rooms.flatMap((r) => [r.y, r.y + r.d]);
  const footprint = rectOf(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  // its node: the basement's rooms with walls that face out, each its inside in the world and those walls' sides
  const byRoom = new Map();
  for (const p of recipe._program.under.ports) byRoom.set(p.room, [...(byRoom.get(p.room) ?? []), p.side]);
  const rooms = [...byRoom].map(([rid, sides]) => { const r = recipe.rooms.find((x) => x.id === rid); return { id: rid, rect: rectOf(r.x + T, r.y + T, r.x + r.w - T, r.y + r.d - T), sides: sides.map((sd) => sideTo(rot, sd)), plan: sides }; });
  // (a way out on a world's side at `u` along it: the plan's side, and its coordinate along that side)
  const port = (rid, side, u) => {
    const pside = SIDES.find((k) => sideTo(rot, k) === side), pl = toPlan(side.endsWith('y') ? [u, (footprint[1] + footprint[3]) / 2] : [(footprint[0] + footprint[2]) / 2, u]);
    return { room: rid, side: pside, along: r5(pside.endsWith('y') ? pl[0] : pl[1]) };
  };
  // (its basement's rooms' insides in the world: a passage leaves one and crosses none of the others)
  const solid = recipe.rooms.filter((r) => !r.storey).map((r) => ({ id: r.id, rect: rectOf(r.x + T, r.y + T, r.x + r.w - T, r.y + r.d - T) }));
  return { id, spec, recipe, PI, q, rot, N, at, facing, toWorld, footprint, ground, port, node: { id, rect: footprint, rooms: rooms.map(({ id: rid, rect, sides }) => ({ id: rid, rect, sides })), solid, door } };
}

export function buildingNode(fit, { padZ, ports = [] }) {
  const doorW = fit.node.door;
  const { recipe, rot, toWorld, q } = fit;
  const asked = ports.map((p) => ({ ...p, plan: fit.port(p.room, p.side, p.u) }));
  const m = { ...recipe, ways: [...recipe.ways, ...asked.map((p) => ({ room: p.plan.room, side: p.plan.side, width: p.width ?? doorW, along: p.plan.along }))] };
  const PI = planStage(m), rise = PI.storeys[1].z0, top = PI.storeys[PI.storeys.length - 1].z0 + 8, base = padZ - rise;
  // (no window: its basement in the ground; its outside is its site's, the land against every wall to its roof)
  const P = assembleStageScene({ ...m, _ground: { y0: -1e4, y1: 1e4, z0: top, z1: top } }, {});
  const W = (p) => [...toWorld(p), p[2] + base], turnN = (n) => { const [x, y] = rot([n[0], n[1]]); return [x, y, n[2]]; };
  const box = (lo, hi) => { const a = W(lo), c = W(hi); return { min: P3([Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])]), max: P3([Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])]) }; };
  const faces = hazardAsFloor(P.faces.filter((f) => f.group !== 'stage:sky' && f.group !== 'stage:sunpatch')).map((f) => ({ ...f, corners: f.corners.map((c) => P3(W(c))), ...(f.normal ? { normal: P3(turnN(f.normal)) } : {}), ...(f.outNormal ? { outNormal: P3(turnN(f.outNormal)) } : {}) }));
  const colliders = (P.colliders || []).map((c) => ({ ...box(c.min, c.max), of: `${fit.id}:in:${c.of}` }));
  const lights = (P.lights || []).map((l) => ({ ...l, name: `${fit.id}-${l.name}`, position: P3(W(l.position)) }));
  // each way's threshold: its floor across the wall's depth (the stage's way leaves none between its faces)
  const tz = turnN([0, 0, 1]);
  PI.ways.forEach((way) => {
    const r = PI.rooms.find((x) => x.id === way.room), z = r.z0 ?? 0, o = FACING[way.side], ax = way.side.endsWith('y') ? 0 : 1;
    const fl = P.faces.find((f) => f.normal?.[2] > 0.9 && Math.abs(f.corners[0][2] - z) < 1e-3 && typeof f.fill === 'string'), fill = fl?.fill ?? '#9a948a';
    const pt = (u, k) => { const p = [0, 0, z]; p[ax] = u; p[1 - ax] = way.at + (o[1 - ax] || 0) * k; return p; };
    const cs = [pt(way.lo, T), pt(way.hi, T), pt(way.hi, -T - 0.05), pt(way.lo, -T - 0.05)].map((c) => P3(W(c)));
    const up = ((cs[1][0] - cs[0][0]) * (cs[3][1] - cs[0][1]) - (cs[1][1] - cs[0][1]) * (cs[3][0] - cs[0][0])) > 0 ? cs : cs.slice().reverse();
    faces.push({ corners: up, normal: P3(tz), outNormal: P3(tz), group: 'stage:floor', fill, cornerFills: up.map(() => fill) });
  });
  const pt = (p, z) => P3(W([p[0], p[1], z]));
  // its way down: in at its door, through its lobby, down its stair to its concourse (the stage's own route, from the
  // lobby; its points' heights are where each starts, the walk stands on what is under them)
  const way0 = PI.ways.find((w) => w.room === 'lobby'), lobby = PI.rooms.find((r) => r.id === 'lobby'), front = [(way0.lo + way0.hi) / 2, lobby.y0];
  const toRoom = (goal, from = 'lobby') => stageLevel(m, { goal, from }).route;
  // (and on to the concourse's middle, off the doorway it came in by: a walk on from there keeps off that wall)
  const cc = PI.rooms.find((r) => r.id === 'concourse'), route = toRoom('concourse'), mid = [(cc.x0 + cc.x1) / 2, (cc.y0 + cc.y1) / 2];
  const down = [pt([front[0], front[1] - 1.5], rise), pt([front[0], front[1] + 1.5], rise), ...route.map((p) => pt(p, rise)), pt(mid, 0)];
  const foot = down[down.length - 1];
  // each way out of the basement, in the world: its outer face's plane, its span, its floor and head, and its reach
  const outPorts = asked.map((p, k) => {
    const wy = PI.ways[recipe.ways.length + k], o = FACING[wy.side], ax = wy.side.endsWith('y') ? 0 : 1, wax = p.side.endsWith('y') ? 0 : 1;
    const atW = (u, inset) => { const pp = [0, 0]; pp[ax] = u; pp[1 - ax] = wy.at - (o[1 - ax] || 0) * inset; return toWorld(pp); };
    const A = atW(wy.lo, -T), B = atW(wy.hi, -T), mid = (wy.lo + wy.hi) / 2, inner = atW(mid, 2), outer = atW(mid, -T);
    // (from where the way down ends, in the concourse, through the basement to the room it leaves, then out)
    const reach = [P3([foot[0], foot[1], base]), ...(wy.room === 'concourse' ? [] : toRoom(wy.room, 'concourse').map((pp) => pt(pp, 0))), P3([...inner, base]), P3([...outer, base])];
    return { id: p.id, side: p.side, room: p.room, u: p.u, plane: r5(A[1 - wax]), lo: r5(Math.min(A[wax], B[wax])), hi: r5(Math.max(A[wax], B[wax])), z0: r5(base), top: r5(wy.top), N: FACING[p.side], reach };
  });
  const rooms = PI.rooms.map((r) => ({ id: r.id, storey: r.storey ?? 0, box: box([r.x0, r.y0, r.z0 ?? 0], [r.x1, r.y1, (r.z0 ?? 0) + r.h]) }));
  return { id: fit.id, use: fit.spec.use, faces, colliders, lights, rise: r5(rise), floor0: r5(base), turn: q, ports: outPorts, down, rooms, footprint: fit.footprint, door: { at: P3([...fit.at, padZ]), N: fit.N } };
}

/** A bay kit's hazard band (a lab's yellow and black, laid as the floor at its doorways: a hole where it is taken out)
 *  repainted as the floor beside it: its texture the floor's at the floor's rate, its light the floor's. */
export function hazardAsFloor(faces) {
  const floors = faces.filter((f) => f.group === 'stage:floor' && f.texture && f.uv && f.corners.length >= 3);
  return faces.map((f) => {
    if (f.group !== 'stage:hazard') return f;
    const z = f.corners[0][2], fl = floors.find((x) => Math.abs(x.corners[0][2] - z) < 0.02);
    if (!fl) return { ...f, group: 'stage:floor', texture: undefined, uv: undefined };
    const du = Math.hypot(fl.uv[1][0] - fl.uv[0][0], fl.uv[1][1] - fl.uv[0][1]), dp = Math.hypot(fl.corners[1][0] - fl.corners[0][0], fl.corners[1][1] - fl.corners[0][1]), scale = du > 1e-9 ? dp / du : 1;
    return { ...f, group: 'stage:floor', texture: fl.texture, textureLit: true, uv: f.corners.map((c) => [Math.round((c[0] / scale) * 1e5) / 1e5, Math.round((c[1] / scale) * 1e5) / 1e5]), fill: fl.fill, cornerFills: f.corners.map(() => fl.fill) };
  });
}
