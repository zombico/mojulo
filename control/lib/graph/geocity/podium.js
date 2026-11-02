/**
 * THE PODIUM WALKED INTO — a core podium of the geocity (`geocity.under`, metro.js) entered from its street: a LOBBY on
 * storey 1 level with the plaza at its door, a CONCOURSE on storey 0 below grade, a stair between them through the
 * lobby's floor. The shape of a building set into its slope (era/stage-buildings.js `embed`: its way in an upper
 * storey's), placed by its lot rather than by a trail's pockets: storeys stack from 0 (era/storeys.js), so the concourse
 * is storey 0 and the whole inside is lowered until storey 1's floor meets the plaza.
 *
 * Its inside is a room-kit stage (era/stage.js) on the everyday bay kit (an office's, a shop floor's: era/style/bay-kits.js),
 * baked in its own lamps; no window opens (its storey 0 stands in the ground, its lobby inside the podium's own mass),
 * so no sky card stands in it.
 *
 *   PODIUM                        the inside's numbers: its kit, the lobby's most plan, its height, the concourse's,
 *                                 the way in's width, the margin it keeps inside its lot
 *   podiumInside(lot, { padZ })   → { faces, colliders, lights, footprint, door, through, rooms, rise, findings } in the
 *                                 metro's frame, or null when the lot is too small to hold it. `lot` is the evoked lot
 *                                 (geocity/scene.js `detailed`: { id, x0, y0, x1, y1, z0, h, front }), `padZ` the plaza
 *                                 at its door. `door`: the opening its facade is cut at ({ axis, plane, u0, u1, z0, z1,
 *                                 N }); `footprint` the inside's box in plan (the pad under it and the lot's box are cut
 *                                 round it); `through` the way in at the door, across the lobby, down the stair, to the
 *                                 concourse's far end, each point at its floor
 *   cutFace(face, door)           a facade face less the door's opening: the strips round it, or [] when the face is
 *                                 not a rectangle in the door's plane and the opening crosses it
 *   groundLess(face, rect)        a ground face (a drape's cell, a pad) less a rectangle in plan: its pieces round it,
 *                                 each corner at the height the face had there, its tile at the face's own rate
 *   wallLess(face, rect)          a standing face square to the axes (a terrace's retaining face) less the run of it
 *                                 inside a rectangle in plan
 *
 * Metres, the design's frame (x east, y north, z up). Pure: a function of the lot.
 */
import { assembleStageScene, planStage } from '../era/stage.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);

export const PODIUM = Object.freeze({
  kit: 'bay-everyday',
  // the lobby's most plan (along its front, into the lot), its height; the concourse's height under it
  lobby: Object.freeze({ w: 24, d: 16, h: 5 }),
  concourse: Object.freeze({ h: 4 }),
  // the way in (m), and how much of its lot the inside keeps clear round it (m)
  door: Object.freeze({ width: 3.6 }),
  margin: 2,
  // the least plan that still holds a stair beside a way across the lobby (m)
  least: Object.freeze({ w: 12, d: 10 }),
});
// the stage's wall: each room's interior a half wall inside its box (era/stage.js STAGE_KITS)
const T = 0.25;
const FACING = { '-y': [0, -1], '+y': [0, 1], '-x': [-1, 0], '+x': [1, 0] };

/** The quarter turn that carries the plan's front (-y, out of the lobby's way in) onto `facing`. */
function turnFor(facing) {
  const q = { '-y': 0, '+x': 1, '+y': 2, '-x': 3 }[facing];
  const c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q];
  return { q, rot: ([x, y]) => [c * x - s * y, s * x + c * y] };
}

/** The inside's recipe on the kit: its two rooms over one plan, the stair between them, the way in out of the lobby's
 *  front. `w` along the front, `d` into the lot, `h` the lobby's height. */
export function podiumRecipe(w, d, h, ports = []) {
  return {
    kind: 'stage', kit: PODIUM.kit,
    rooms: [{ id: 'concourse', x: 0, y: 0, w, d, h: PODIUM.concourse.h }, { id: 'lobby', x: 0, y: 0, w, d, h, storey: 1 }],
    links: [{ from: 'concourse', to: 'lobby' }],
    ways: [{ room: 'lobby', side: '-y', width: PODIUM.door.width }, ...ports.map((p) => ({ room: 'concourse', side: p.side, width: p.width ?? PODIUM.door.width, along: p.along }))],
  };
}

/** Where a podium's inside stands on its lot, before it is built: its plan (the largest inside the lot's margin, clear
 *  of `avoid`, its door as near the front's middle as it can stand) and its frame; on the lot's front first, then its
 *  other sides (`sides`), each door kept only where `accept(F, N)` holds (its plaza's height at it). null when none
 *  fits. → { lot, front, w, d, h, q, rot, N, F, toWorld, footprint, concourse (its room's inside, world), port(side, u) } */
export function podiumFit(lot, { avoid = [], sides = null, accept = () => true } = {}) {
  for (const front of sides ?? [lot.front]) {
    const fit = fitOn(lot, front, avoid, accept);
    if (fit) return fit;
  }
  return null;
}

function fitOn(lot, front, avoid, accept) {
  const alongX = front.endsWith('y');
  const along = alongX ? lot.x1 - lot.x0 : lot.y1 - lot.y0, deep = alongX ? lot.y1 - lot.y0 : lot.x1 - lot.x0;
  const h = Math.min(PODIUM.lobby.h, Math.floor((lot.h - 0.8) * 10) / 10);
  if (h < 3.2) return null;
  const { q, rot } = turnFor(front), N = FACING[front], E = alongX ? [1, 0] : [0, 1];
  const mid = alongX ? [(lot.x0 + lot.x1) / 2, front === '-y' ? lot.y0 : lot.y1] : [front === '-x' ? lot.x0 : lot.x1, (lot.y0 + lot.y1) / 2];
  // placed with its door's middle `s` along the front from its middle, the lobby's outer wall face in the facade's plane
  const frame = (w, s) => {
    const F = [mid[0] + E[0] * s, mid[1] + E[1] * s], doorPlan = [w / 2, 0], Tw = [F[0] - N[0] * T, F[1] - N[1] * T];
    return { F, Tw, doorPlan, toWorld: ([x, y]) => { const [u, v] = rot([x - doorPlan[0], y - doorPlan[1]]); return [Tw[0] + u, Tw[1] + v]; } };
  };
  const rectOf = (fr, a0, b0, a1, b1) => { const a = fr.toWorld([a0, b0]), c = fr.toWorld([a1, b1]); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; };
  const clear = (R) => avoid.every((A) => R[2] <= A[0] - 0.5 || R[0] >= A[2] + 0.5 || R[3] <= A[1] - 0.5 || R[1] >= A[3] + 0.5);
  // its plan on the kit's metre grid inside its lot's margin, clear of what rises through its podium (its towers): the
  // largest that fits, its door as near the front's middle as it can stand
  let fit = null;
  for (let d = Math.min(PODIUM.lobby.d, Math.floor(deep - PODIUM.margin)); d >= PODIUM.least.d && !fit; d--) {
    for (let w = Math.min(PODIUM.lobby.w, Math.floor(along - 2 * PODIUM.margin)); w >= PODIUM.least.w && !fit; w--) {
      const room = (along - 2 * PODIUM.margin - w) / 2;
      for (let k = 0; k <= 2 * Math.floor(room) && !fit; k++) {
        const s = (k % 2 ? -1 : 1) * Math.ceil(k / 2), fr = frame(w, s);
        if (Math.abs(s) <= room + 1e-6 && clear(rectOf(fr, -T, -T, w + T, d + T)) && accept(fr.F, N)) fit = { w, d, s, fr };
      }
    }
  }
  if (!fit) return null;
  const { w, d, fr } = fit;
  // (the plan's frame read back from the world's: a way out of the concourse onto a side of the world, at a point u
  // along it, is a side of the plan and a coordinate along that side)
  const c = [1, 0, -1, 0][q], sn = [0, 1, 0, -1][q], unrot = ([x, y]) => [c * x + sn * y, -sn * x + c * y];
  const toPlan = ([x, y]) => { const [u, v] = unrot([x - fr.Tw[0], y - fr.Tw[1]]); return [u + fr.doorPlan[0], v + fr.doorPlan[1]]; };
  const port = (side, u) => {
    const n = FACING[side], [px, py] = unrot(n).map((v) => Math.round(v)), pside = px ? (px > 0 ? '+x' : '-x') : (py > 0 ? '+y' : '-y');
    const P = side.endsWith('y') ? [u, (lot.y0 + lot.y1) / 2] : [(lot.x0 + lot.x1) / 2, u], pl = toPlan(P);
    return { side: pside, along: r5(pside.endsWith('y') ? pl[0] : pl[1]) };
  };
  return { lot, front, w, d, h, q, rot, N, F: fr.F, toWorld: fr.toWorld, footprint: rectOf(fr, -T, -T, w + T, d + T).map(r5), concourse: rectOf(fr, T, T, w - T, d - T).map(r5), port, s: fit.s };
}

/** Whether a podium's plan holds these ways out of its concourse (each on its wall, clear of its frames, its stair
 *  still finding a place clear of them all): the stage's own planner asked. */
export function portsHold(fit, ports) {
  try { planStage(podiumRecipe(fit.w, fit.d, fit.h, ports.map((p) => ({ ...p, ...fit.port(p.side, p.u) })))); return true; } catch { return false; }
}

/** A podium's inside built on its fit, its lobby's floor at `padZ`: `ports` the ways out of its concourse onto the world's
 *  sides ([{ id, side: '+x' | '-x' | '+y' | '-y', u }], `u` the way's middle along that side), each answered in `ports`
 *  with its doorway in the world ({ id, side, u, plane, lo, hi, z0, top, N }). */
export function podiumInside(lot, { padZ, avoid = [], ports = [], fit: F0 = null }) {
  const fit = F0 ?? podiumFit(lot, { avoid });
  if (!fit) return null;
  const { w, d, h, q, rot, N, F, toWorld } = fit, alongX = fit.front.endsWith('y');
  // (each asked on the world's side, laid on the plan's)
  const asked = ports.map((p) => ({ id: p.id, side: p.side, u: p.u, plan: fit.port(p.side, p.u) }));
  const recipe = podiumRecipe(w, d, h, asked.map((p) => p.plan)), PI = planStage(recipe), rise = PI.storeys[1].z0, base = padZ - rise;
  // (no window: its concourse in the ground, its lobby in the podium's mass; the land against every wall to the roof)
  const P = assembleStageScene({ ...recipe, _ground: { y0: -1e4, y1: 1e4, z0: rise + h + 1, z1: rise + h + 1 } }, {});
  const W = (p) => [...toWorld(p), p[2] + base];
  const turnN = (n) => { const [x, y] = rot([n[0], n[1]]); return [x, y, n[2]]; };
  const box = (lo, hi) => { const a = W(lo), c = W(hi); return { min: P3([Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])]), max: P3([Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])]) }; };
  const faces = P.faces.filter((f) => f.group !== 'stage:sky' && f.group !== 'stage:sunpatch').map((f) => ({ ...f, corners: f.corners.map((c) => P3(W(c))), ...(f.normal ? { normal: P3(turnN(f.normal)) } : {}), ...(f.outNormal ? { outNormal: P3(turnN(f.outNormal)) } : {}) }));
  const colliders = (P.colliders || []).map((c) => ({ ...box(c.min, c.max), of: `${lot.id}:in:${c.of}` }));
  const lights = (P.lights || []).map((l) => ({ ...l, name: `${lot.id}-${l.name}`, position: P3(W(l.position)) }));
  // each way's threshold: its floor across the wall's depth, from the wall's outer face to the room's own floor, in the
  // room floor's paint (the stage's way leaves none between them)
  const tz = turnN([0, 0, 1]);
  const sill = (way, z) => {
    const fl = P.faces.find((f) => f.normal?.[2] > 0.9 && Math.abs(f.corners[0][2] - z) < 1e-3 && typeof f.fill === 'string'), fill = fl?.fill ?? '#9a948a';
    const o = { '-y': [0, -1], '+y': [0, 1], '-x': [-1, 0], '+x': [1, 0] }[way.side], ax = way.side.endsWith('y') ? 0 : 1;
    const pt = (u, k) => { const p = [0, 0, z]; p[ax] = u; p[1 - ax] = way.at + (o[1 - ax] || 0) * k; return p; };
    const cs = [pt(way.lo, T), pt(way.hi, T), pt(way.hi, -T - 0.05), pt(way.lo, -T - 0.05)].map((c) => P3(W(c)));
    const up = ((cs[1][0] - cs[0][0]) * (cs[3][1] - cs[0][1]) - (cs[1][1] - cs[0][1]) * (cs[3][0] - cs[0][0])) > 0 ? cs : cs.slice().reverse();
    faces.push({ corners: up, normal: P3(tz), outNormal: P3(tz), group: 'stage:floor', fill, cornerFills: up.map(() => fill) });
  };
  PI.ways.forEach((way, k) => sill(way, k === 0 ? rise : 0));
  const fp = box([-T, -T, 0], [w + T, d + T, rise + h]);
  // the way in, as the facade is cut for it: its span along the front, its height from the plaza
  const way = PI.ways[0], a = toWorld([way.lo, -T]), c = toWorld([way.hi, -T]);
  const door = { axis: alongX ? 'x' : 'y', plane: r5(alongX ? F[1] : F[0]), u0: r5(Math.min(alongX ? a[0] : a[1], alongX ? c[0] : c[1])), u1: r5(Math.max(alongX ? a[0] : a[1], alongX ? c[0] : c[1])), z0: r5(padZ), z1: r5(padZ + way.top), N: P3([N[0], N[1], 0]), at: P3([F[0], F[1], padZ]) };
  // each way out of the concourse, in the world: its outer face's plane, its span, its floor and head
  const outPorts = asked.map((p, k) => {
    const wy = PI.ways[k + 1], o = { '-y': [0, -1], '+y': [0, 1], '-x': [-1, 0], '+x': [1, 0] }[wy.side], ax = wy.side.endsWith('y') ? 0 : 1;
    const at = (u) => { const pp = [0, 0]; pp[ax] = u; pp[1 - ax] = wy.at + (o[1 - ax] || 0) * T; return toWorld(pp); };
    const A = at(wy.lo), B = at(wy.hi), wax = p.side.endsWith('y') ? 0 : 1;
    return { id: p.id, side: p.side, u: p.u, plane: r5(A[1 - wax]), lo: r5(Math.min(A[wax], B[wax])), hi: r5(Math.max(A[wax], B[wax])), z0: r5(base), top: r5(wy.top), N: FACING[p.side] };
  });
  // the way through: in from the plaza, across the lobby round the stair's well to its head, down its flight, and on
  // round its foot (each point at its floor); a way out of the concourse reached from the flight's foot the same way
  const st = PI.stairs[0], ax = st.axis === 'x' ? 0 : 1, lat = 1 - ax, mid = (st.rect[lat] + st.rect[lat + 2]) / 2;
  const onFlight = (a) => { const p = [0, 0]; p[ax] = a; p[lat] = mid; return p; };
  const grow = (R, e) => [R[0] - e, R[1] - e, R[2] + e, R[3] + e], room = [T + 0.3, T + 0.3, w - T - 0.3, d - T - 0.3];
  const pt = (p, z) => P3(W([p[0], p[1], z]));
  const lobbyLeg = planPath(room, [grow(st.rect, 0.7)], [w / 2, 1.5], st.arrival).map((p) => pt(p, rise));
  const flight = [onFlight(st.head), onFlight(st.foot)].map((p, k) => pt(p, k ? st.z0 : st.z1));
  const down = [pt([w / 2, -1.2], rise), ...lobbyLeg, ...flight, pt(st.approach, 0)];
  // (the flight's boxes stand a cheek's width outside its plan: kept a body's width and a hand clear of them)
  const across = (to) => planPath(room, [grow(st.rect, 0.5)], st.approach, to).slice(1).map((p) => pt(p, 0));
  const through = [...down, ...across([w / 2, d - 1.5])];
  // (each way out of the concourse: from the flight's foot to 2 m inside it, then to its outer face)
  outPorts.forEach((p, k) => {
    const wy = PI.ways[k + 1], o = { '-y': [0, -1], '+y': [0, 1], '-x': [-1, 0], '+x': [1, 0] }[wy.side], wa = wy.side.endsWith('y') ? 0 : 1;
    const at = (inset) => { const q = [0, 0]; q[wa] = (wy.lo + wy.hi) / 2; q[1 - wa] = wy.at - (o[1 - wa] || 0) * inset; return q; };
    p.reach = [pt(st.approach, 0), ...across(at(2)), pt(at(-T), 0)];
  });
  return {
    faces, colliders, lights, rise: r5(rise), door, through, down, turn: q, ports: outPorts, floor0: r5(base),
    footprint: [fp.min[0], fp.min[1], fp.max[0], fp.max[1]],
    rooms: [{ id: 'lobby', storey: 1, box: box([T, T, rise], [w - T, d - T, rise + h]) }, { id: 'concourse', storey: 0, box: box([T, T, 0], [w - T, d - T, PODIUM.concourse.h]) }],
    plan: { w, d, h },
    findings: [...(w < PODIUM.lobby.w || d < PODIUM.lobby.d ? [`the ${lot.id}'s lobby is ${w} by ${d} m: its lot holds no more inside its margin, clear of its towers`] : [])],
  };
}

/** A face's uv at a point of its plane (`k` the axis along it, z up it): the affine map its corners lay, solved from
 *  three of them that are not in a line. */
function uvAt(cs, uv, k, p) {
  const A = cs[0], ia = [1, 2, 3].find((i) => Math.abs(cs[i][k] - A[k]) > 1e-6), ib = [1, 2, 3].find((i) => i !== ia && Math.abs((cs[i][k] - A[k]) * (cs[ia][2] - A[2]) - (cs[i][2] - A[2]) * (cs[ia][k] - A[k])) > 1e-9);
  const B = cs[ia], C = cs[ib], det = (B[k] - A[k]) * (C[2] - A[2]) - (C[k] - A[k]) * (B[2] - A[2]);
  const s = ((p[k] - A[k]) * (C[2] - A[2]) - (C[k] - A[k]) * (p[2] - A[2])) / det, t = ((B[k] - A[k]) * (p[2] - A[2]) - (p[k] - A[k]) * (B[2] - A[2])) / det;
  return [0, 1].map((c) => uv[0][c] + s * (uv[ia][c] - uv[0][c]) + t * (uv[ib][c] - uv[0][c]));
}

/** A face less the door's opening (in the door's plane, `axis` along it): the face as it was when the opening misses
 *  it; the strips round the opening when it is a rectangle in that plane; nothing when it is any other face the opening
 *  crosses (a sill's return, a shopfront's mullion: what stood in the way in). */
export function cutFace(f, door, depth = 1.2) {
  const k = door.axis === 'x' ? 0 : 1, j = 1 - k, cs = f.corners;
  const us = cs.map((p) => p[k]), ds = cs.map((p) => (p[j] - door.plane) * (door.axis === 'x' ? door.N[1] : door.N[0])), zs = cs.map((p) => p[2]);
  const u0 = Math.min(...us), u1 = Math.max(...us), z0 = Math.min(...zs), z1 = Math.max(...zs);
  // (only what stands at the front, within `depth` out of its plane and a hand inside it)
  if (Math.min(...ds) > depth || Math.max(...ds) < -0.3) return [f];
  if (u1 <= door.u0 + 1e-6 || u0 >= door.u1 - 1e-6 || z1 <= door.z0 + 1e-6 || z0 >= door.z1 - 1e-6) return [f];
  const flat = Math.max(...ds) - Math.min(...ds) < 1e-3, rect = cs.length === 4 && flat && cs.every((p) => (Math.abs(p[k] - u0) < 1e-4 || Math.abs(p[k] - u1) < 1e-4) && (Math.abs(p[2] - z0) < 1e-4 || Math.abs(p[2] - z1) < 1e-4));
  if (!rect) return [];
  const at = (u, z) => { const p = [0, 0, z]; p[k] = u; p[j] = cs[0][j]; return P3(p); };
  const strips = [];
  if (door.u0 > u0) strips.push([u0, door.u0, z0, z1]);
  if (door.u1 < u1) strips.push([door.u1, u1, z0, z1]);
  const m0 = Math.max(u0, door.u0), m1 = Math.min(u1, door.u1);
  if (door.z0 > z0) strips.push([m0, m1, z0, door.z0]);
  if (door.z1 < z1) strips.push([m0, m1, door.z1, z1]);
  // (each strip wound as the face was: its normal kept)
  const n = f.normal ?? [0, 0, 0], e1 = [0, 0, 0]; e1[k] = 1;
  const wind = (q4) => { const a = q4[0], b = q4[1], d = q4[3], cr = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])]; return cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? q4.slice().reverse() : q4; };
  return strips.filter(([a0, a1, b0, b1]) => a1 - a0 > 1e-3 && b1 - b0 > 1e-3).map(([a0, a1, b0, b1]) => {
    const c4 = wind([at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)]);
    const out = { ...f, corners: c4, ...(f.cornerFills ? { cornerFills: c4.map(() => f.fill ?? f.cornerFills[0]) } : {}) };
    // (a tiled face keeps its tile's scale: its uv laid again along the strip, by the face's own rate)
    if (f.uv && f.uv.length === cs.length) out.uv = c4.map((p) => uvAt(cs, f.uv, k, p).map(r5));
    return out;
  });
}

/** A ground face less a rectangle in plan ([x0, y0, x1, y1]): the face as it was when the rectangle misses it; the pieces
 *  of it round the rectangle when it is a quad square to the axes (a drape's cell, a pad), each corner at the height the
 *  face had there (bilinear over its corners, so a piece meets its neighbours along their edge) and its uv by its plan;
 *  nothing when it is any other face the rectangle crosses. */
export function groundLess(f, R) {
  const cs = f.corners, xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
  const q = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  if (q[2] <= R[0] || q[0] >= R[2] || q[3] <= R[1] || q[1] >= R[3]) return [f];
  const square = cs.length === 4 && cs.every((c) => (Math.abs(c[0] - q[0]) < 1e-4 || Math.abs(c[0] - q[2]) < 1e-4) && (Math.abs(c[1] - q[1]) < 1e-4 || Math.abs(c[1] - q[3]) < 1e-4));
  if (!square) return [];
  const cz = (x, y) => cs.find((c) => Math.abs(c[0] - x) < 1e-4 && Math.abs(c[1] - y) < 1e-4)[2];
  const z00 = cz(q[0], q[1]), z10 = cz(q[2], q[1]), z11 = cz(q[2], q[3]), z01 = cz(q[0], q[3]);
  const zAt = (x, y) => { const s = (x - q[0]) / (q[2] - q[0] || 1), t = (y - q[1]) / (q[3] - q[1] || 1); return z00 * (1 - s) * (1 - t) + z10 * s * (1 - t) + z11 * s * t + z01 * (1 - s) * t; };
  const a0 = Math.max(q[0], R[0]), b0 = Math.max(q[1], R[1]), a1 = Math.min(q[2], R[2]), b1 = Math.min(q[3], R[3]);
  const pieces = [[q[0], q[1], a0, q[3]], [a1, q[1], q[2], q[3]], [a0, q[1], a1, b0], [a0, b1, a1, q[3]]].filter((r) => r[2] - r[0] > 1e-3 && r[3] - r[1] > 1e-3);
  // (wound as the face was: up, or as it faced)
  const up = (f.normal?.[2] ?? 1) >= 0, uvOf = f.uv && f.uv.length === cs.length ? planUv(cs, f.uv) : null;
  return pieces.map(([x0, y0, x1, y1]) => {
    const c4 = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => P3([x, y, zAt(x, y)])), c = up ? c4 : c4.slice().reverse();
    return { ...f, corners: c, ...(f.cornerFills ? { cornerFills: c.map(() => f.fill ?? f.cornerFills[0]) } : {}), ...(uvOf ? { uv: c.map((p) => uvOf(p).map(r5)) } : {}) };
  });
}

/** A face's uv as an affine map of its plan (x, y), solved from three of its corners not in a line. */
function planUv(cs, uv) {
  const A = cs[0], ia = 1, ib = [2, 3].find((i) => Math.abs((cs[ia][0] - A[0]) * (cs[i][1] - A[1]) - (cs[ia][1] - A[1]) * (cs[i][0] - A[0])) > 1e-9) ?? 2;
  const B = cs[ia], C = cs[ib], det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
  return (p) => {
    const s = ((p[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (p[1] - A[1])) / det, t = ((B[0] - A[0]) * (p[1] - A[1]) - (p[0] - A[0]) * (B[1] - A[1])) / det;
    return [0, 1].map((k) => uv[0][k] + s * (uv[ia][k] - uv[0][k]) + t * (uv[ib][k] - uv[0][k]));
  };
}

/** A way across a room (`box`, [x0, y0, x1, y1]) from `a` to `b` round the rectangles in it (`blocks`): straight where
 *  nothing stands between, else a quarter-metre grid searched breadth first and pulled straight between what it can
 *  see (near either end the grid is free, so a way leaves a stair's foot from inside its margin).
 *  Its two ends kept, wherever they stand. */
function planPath(box, blocks, a, b) {
  const seen = (p, q) => blocks.every((R) => !segmentHits(p, q, R));
  if (seen(a, b)) return [a, b];
  const g = 0.25, nx = Math.max(1, Math.floor((box[2] - box[0]) / g)), ny = Math.max(1, Math.floor((box[3] - box[1]) / g));
  const at = (i, j) => [box[0] + (i + 0.5) * g, box[1] + (j + 0.5) * g];
  // (a cell is free off every block; near either end it is free anyway, so a way can leave a stair's foot and reach a
  // point that stands in a block's margin)
  const free = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && (() => { const [x, y] = at(i, j); return Math.hypot(x - a[0], y - a[1]) < 0.6 || Math.hypot(x - b[0], y - b[1]) < 0.6 || blocks.every((R) => !(x > R[0] && x < R[2] && y > R[1] && y < R[3])); })();
  const cell = (p) => [Math.max(0, Math.min(nx - 1, Math.floor((p[0] - box[0]) / g))), Math.max(0, Math.min(ny - 1, Math.floor((p[1] - box[1]) / g)))];
  const [si, sj] = cell(a), [ti, tj] = cell(b), from = new Map([[`${si},${sj}`, null]]), queue = [[si, sj]];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (queue.length) {
    const [i, j] = queue.shift();
    if (i === ti && j === tj) break;
    for (const [di, dj] of steps) {
      const I = i + di, J = j + dj, k = `${I},${J}`;
      if (from.has(k) || !(free(I, J) || (I === ti && J === tj))) continue;
      if (di && dj && !(free(i + di, j) && free(i, j + dj))) continue;
      from.set(k, [i, j]); queue.push([I, J]);
    }
  }
  if (!from.has(`${ti},${tj}`)) return [a, b];
  const cells = [];
  for (let c = [ti, tj]; c; c = from.get(`${c[0]},${c[1]}`)) cells.unshift(at(...c));
  const pts = [a, ...cells.slice(1, -1), b], out = [a];
  // (pulled straight: from each point kept, on to the furthest it can see)
  for (let k = 0; k < pts.length - 1;) {
    let n = pts.length - 1;
    while (n > k + 1 && !seen(pts[k], pts[n])) n--;
    out.push(pts[n]); k = n;
  }
  return out.map((p) => p.map(r5));
}

/** Whether a segment passes through a rectangle's inside (Liang–Barsky). */
function segmentHits(p, q, R) {
  let t0 = 0, t1 = 1;
  const d = [q[0] - p[0], q[1] - p[1]];
  for (const [pp, qq] of [[-d[0], p[0] - R[0]], [d[0], R[2] - p[0]], [-d[1], p[1] - R[1]], [d[1], R[3] - p[1]]]) {
    if (Math.abs(pp) < 1e-12) { if (qq <= 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 >= t1) return false;
  }
  return true;
}

/** A standing face square to the axes (a retaining face between terraces) less the run of it inside a rectangle in plan:
 *  the face as it was when its line misses the rectangle; its pieces either side of it, each end at the height the face
 *  had there; nothing when it is not a quad standing on one line. */
export function wallLess(f, R) {
  const cs = f.corners, xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
  const k = Math.max(...xs) - Math.min(...xs) < 1e-4 ? 1 : Math.max(...ys) - Math.min(...ys) < 1e-4 ? 0 : -1;
  if (k < 0 || cs.length !== 4) return [f];
  const line = k === 1 ? xs[0] : ys[0], j = 1 - k;
  if (line <= R[j] || line >= R[j + 2]) return [f];
  const us = cs.map((c) => c[k]), u0 = Math.min(...us), u1 = Math.max(...us);
  if (u1 <= R[k] || u0 >= R[k + 2]) return [f];
  // (its foot and its head along it, each a line between its ends)
  const lo = (u) => { const e = cs.filter((c) => Math.abs(c[k] - u) < 1e-4).map((c) => c[2]); return [Math.min(...e), Math.max(...e)]; };
  const [b0, t0] = lo(u0), [b1, t1] = lo(u1), z = (u, a, b) => a + ((b - a) * (u - u0)) / (u1 - u0 || 1);
  const pt = (u, zz) => { const p = [0, 0, zz]; p[k] = u; p[j] = line; return P3(p); };
  const n = f.normal ?? [0, 0, 0];
  return [[u0, Math.min(u1, R[k])], [Math.max(u0, R[k + 2]), u1]].filter(([a, b]) => b - a > 1e-3).map(([a, b]) => {
    let c4 = [pt(a, z(a, b0, b1)), pt(b, z(b, b0, b1)), pt(b, z(b, t0, t1)), pt(a, z(a, t0, t1))];
    const e1 = c4[1].map((v, i) => v - c4[0][i]), e2 = c4[3].map((v, i) => v - c4[0][i]), cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) c4 = c4.slice().reverse();
    return { ...f, corners: c4, ...(f.cornerFills ? { cornerFills: c4.map(() => f.fill ?? f.cornerFills[0]) } : {}) };
  });
}
