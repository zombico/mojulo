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
 *
 * Metres, the design's frame (x east, y north, z up). Pure: a function of the lot.
 */
import { assembleStageScene, planStage } from '../era/stage.js';
import { stageLevel } from '../structure/level.js';

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
export function podiumRecipe(w, d, h) {
  return {
    kind: 'stage', kit: PODIUM.kit,
    rooms: [{ id: 'concourse', x: 0, y: 0, w, d, h: PODIUM.concourse.h }, { id: 'lobby', x: 0, y: 0, w, d, h, storey: 1 }],
    links: [{ from: 'concourse', to: 'lobby' }],
    ways: [{ room: 'lobby', side: '-y', width: PODIUM.door.width }],
  };
}

export function podiumInside(lot, { padZ, avoid = [] }) {
  const front = lot.front, alongX = front.endsWith('y');
  const along = alongX ? lot.x1 - lot.x0 : lot.y1 - lot.y0, deep = alongX ? lot.y1 - lot.y0 : lot.x1 - lot.x0;
  const h = Math.min(PODIUM.lobby.h, Math.floor((lot.h - 0.8) * 10) / 10);
  if (h < 3.2) return null;
  const { q, rot } = turnFor(front), N = FACING[front], E = alongX ? [1, 0] : [0, 1];
  const mid = alongX ? [(lot.x0 + lot.x1) / 2, front === '-y' ? lot.y0 : lot.y1] : [front === '-x' ? lot.x0 : lot.x1, (lot.y0 + lot.y1) / 2];
  // placed with its door's middle `s` along the front from its middle, the lobby's outer wall face in the facade's plane
  const frame = (w, s) => {
    const F = [mid[0] + E[0] * s, mid[1] + E[1] * s], doorPlan = [w / 2, 0], Tw = [F[0] - N[0] * T, F[1] - N[1] * T];
    return { F, toWorld: ([x, y]) => { const [u, v] = rot([x - doorPlan[0], y - doorPlan[1]]); return [Tw[0] + u, Tw[1] + v]; } };
  };
  const rectOf = (fr, w, d) => { const a = fr.toWorld([-T, -T]), c = fr.toWorld([w + T, d + T]); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[0], c[0]), Math.max(a[1], c[1])]; };
  const clear = (R) => avoid.every((A) => R[2] <= A[0] - 0.5 || R[0] >= A[2] + 0.5 || R[3] <= A[1] - 0.5 || R[1] >= A[3] + 0.5);
  // its plan on the kit's metre grid inside its lot's margin, clear of what rises through its podium (its towers): the
  // largest that fits, its door as near the front's middle as it can stand
  let fit = null;
  for (let d = Math.min(PODIUM.lobby.d, Math.floor(deep - PODIUM.margin)); d >= PODIUM.least.d && !fit; d--) {
    for (let w = Math.min(PODIUM.lobby.w, Math.floor(along - 2 * PODIUM.margin)); w >= PODIUM.least.w && !fit; w--) {
      const room = (along - 2 * PODIUM.margin - w) / 2;
      for (let k = 0; k <= 2 * Math.floor(room) && !fit; k++) {
        const s = (k % 2 ? -1 : 1) * Math.ceil(k / 2), fr = frame(w, s);
        if (Math.abs(s) <= room + 1e-6 && clear(rectOf(fr, w, d))) fit = { w, d, s, fr };
      }
    }
  }
  if (!fit) return null;
  const { w, d, fr } = fit, F = fr.F, toWorld = fr.toWorld;
  const recipe = podiumRecipe(w, d, h), PI = planStage(recipe), rise = PI.storeys[1].z0, base = padZ - rise;
  // (no window: its concourse in the ground, its lobby in the podium's mass; the land against every wall to the roof)
  const P = assembleStageScene({ ...recipe, _ground: { y0: -1e4, y1: 1e4, z0: rise + h + 1, z1: rise + h + 1 } }, {});
  const W = (p) => [...toWorld(p), p[2] + base];
  const turnN = (n) => { const [x, y] = rot([n[0], n[1]]); return [x, y, n[2]]; };
  const box = (lo, hi) => { const a = W(lo), c = W(hi); return { min: P3([Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2])]), max: P3([Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])]) }; };
  const faces = P.faces.filter((f) => f.group !== 'stage:sky' && f.group !== 'stage:sunpatch').map((f) => ({ ...f, corners: f.corners.map((c) => P3(W(c))), ...(f.normal ? { normal: P3(turnN(f.normal)) } : {}), ...(f.outNormal ? { outNormal: P3(turnN(f.outNormal)) } : {}) }));
  const colliders = (P.colliders || []).map((c) => ({ ...box(c.min, c.max), of: `${lot.id}:in:${c.of}` }));
  const lights = (P.lights || []).map((l) => ({ ...l, name: `${lot.id}-${l.name}`, position: P3(W(l.position)) }));
  // the threshold: the way in's floor across the wall's depth, from the facade's plane to the lobby's own floor, in
  // the lobby floor's paint
  const way0 = PI.ways[0], fl = P.faces.find((f) => f.normal?.[2] > 0.9 && Math.abs(f.corners[0][2] - rise) < 1e-3 && typeof f.fill === 'string');
  const thr = [[way0.lo, -T, rise], [way0.hi, -T, rise], [way0.hi, T + 0.05, rise], [way0.lo, T + 0.05, rise]].map((c) => P3(W(c))), tz = turnN([0, 0, 1]);
  faces.push({ corners: thr, normal: P3(tz), outNormal: P3(tz), group: 'stage:floor', fill: fl?.fill ?? '#9a948a', cornerFills: thr.map(() => fl?.fill ?? '#9a948a') });
  const fp = box([-T, -T, 0], [w + T, d + T, rise + h]);
  // the way in, as the facade is cut for it: its span along the front, its height from the plaza
  const way = PI.ways[0], a = toWorld([way.lo, -T]), c = toWorld([way.hi, -T]);
  const door = { axis: alongX ? 'x' : 'y', plane: r5(alongX ? F[1] : F[0]), u0: r5(Math.min(alongX ? a[0] : a[1], alongX ? c[0] : c[1])), u1: r5(Math.max(alongX ? a[0] : a[1], alongX ? c[0] : c[1])), z0: r5(padZ), z1: r5(padZ + way.top), N: P3([N[0], N[1], 0]), at: P3([F[0], F[1], padZ]) };
  // the way through: in from the plaza, across the lobby, down its stair, out along the concourse (each point at its floor)
  const L = stageLevel(recipe, { goal: 'concourse', from: 'lobby' }), st = PI.stairs[0];
  // (a point on the flight at its height along it, foot to head; before the flight the lobby's floor, past it the concourse's)
  const ax = st.axis === 'x' ? 0 : 1, on = (p) => p[0] >= st.rect[0] - 1e-6 && p[0] <= st.rect[2] + 1e-6 && p[1] >= st.rect[1] - 1e-6 && p[1] <= st.rect[3] + 1e-6;
  let down = false;
  const zs = L.route.map((p) => {
    if (on(p)) { down = true; return st.z0 + (st.z1 - st.z0) * Math.max(0, Math.min(1, (p[ax] - st.foot) / (st.head - st.foot))); }
    return down ? st.z0 : st.z1;
  });
  const pt = (p, z) => P3(W([p[0], p[1], z]));
  // (off the flight's foot to clear of its side toward the room's middle, then across the concourse to its far side)
  const lat = 1 - ax, side = (lat === 0 ? w : d) / 2 > (st.rect[lat] + st.rect[lat + 2]) / 2 ? 1 : -1, off = [...st.approach];
  off[lat] = side > 0 ? st.rect[lat + 2] + 0.8 : st.rect[lat] - 0.8;
  const through = [pt([w / 2, -2.5], rise), pt([w / 2, 1.5], rise), ...L.route.map((p, k) => pt(p, zs[k])), pt(off, 0), pt([w / 2, d - 1.5], 0)];
  return {
    faces, colliders, lights, rise: r5(rise), door, through, turn: q,
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
