/**
 * STOREYS — a room-kit stage built on more than one floor. A room's `storey` (0, the default, is the ground) stacks it
 * over the rooms of the storey below, and a link between two rooms on neighbouring storeys is a STAIR: a straight
 * flight laid in the lower room, climbing through a hole in the upper room's floor.
 *
 *   rooms: [{ id, x, y, w, d, h, storey? }]     a room on storey s stands over rooms of storey s − 1
 *   links: [{ from, to }]                        rooms on one storey: a doorway; on neighbouring storeys: a stair
 *
 * How it stands:
 *   - a storey's floor is the storey below's floor, the tallest room it stands over, and a slab (SLAB);
 *   - a room with a room over it has a flat ceiling (a kit's vault would rise through the floor above), with its beams;
 *   - a flight is treads a hand over a foot (RISE, GOING: a steep stair, as a keep's is), FLIGHT wide, set in from a
 *     wall (IN) of the lower room, where its foot and head are clear of every doorway; its hole in the upper floor is
 *     railed on three sides (the head left open, where it is climbed out of);
 *   - each storey is built as a stage of its own (dressed, lit by its own torches) and lifted to its floor, so the
 *     dressings, the bake and the anchors stay one storey's.
 *
 * The walk stands on whatever is under its eye (the page's ground ray), so a flight is climbed as the rail's stairs
 * are; the colliders under each tread keep a walker from walking under a flight, and the rails keep it out of a hole.
 *
 *   readStoreys(rooms, kit)                       → the storeys' floors (z0), each room's storey and floor, `flat`
 *   placeStairs(rooms, links, kit)                → each stair: its flight, its hole, where it is met and left
 *   storeyCut(faces, cuts)                        a storey's own faces with its flights' and holes' ground cut out
 *   stairFaces(out, cuts, surf)                   the flights, the wells' linings and the rails
 *   assembleStoreys(manifest, ctx, assemble)      the storeyed stage: each storey built and lifted, then joined
 *
 * Pure: a function of the plan. Metres, z-up.
 */
import { r5, P, panel, box } from './geom.js';

export const SLAB = 0.5;                       // m: a floor's thickness between a ceiling and the floor over it
export const RISE = 0.3, GOING = 0.3;          // a tread's rise (at most; a walker steps 0.35) and going
export const FLIGHT = 1.6, IN = 0.6;           // a flight's width, and its set-in from the wall (over a plinth and a gutter)
const APPROACH = 0.6, ARRIVE = 1.2, BODY = 0.45, RAIL = { h: 1, t: 0.15 };
const MAX_STOREY = 6;

const overlap = (a, b, gap = 0) => a[0] < b[2] + gap && b[0] < a[2] + gap && a[1] < b[3] + gap && b[1] < a[3] + gap;
const inside = (p, R, m = 0) => p[0] >= R[0] + m && p[0] <= R[2] - m && p[1] >= R[1] + m && p[1] <= R[3] - m;
const interior = (r) => [r.x0, r.y0, r.x1, r.y1];

/**
 * The storeys of planned rooms (each with `storey`): every room on storey s ≥ 1 stands over rooms of storey s − 1 (its
 * metre cells over their boxes); a storey's floor is the floor below plus the tallest room it stands over and a slab.
 * → { z0s: [floor per storey], flat: Set of the rooms with a room over them }. Sets each room's `z0`.
 */
export function readStoreys(rooms) {
  const top = Math.max(...rooms.map((r) => r.storey));
  const on = (s) => rooms.filter((r) => r.storey === s);
  const z0s = [0], flat = new Set();
  for (let s = 1; s <= top; s++) {
    if (!on(s).length) throw new Error(`stage: no room stands on storey ${s}, but one stands on storey ${top}: storeys stack from 0`);
    const under = new Set();
    for (const r of on(s)) {
      const [bx0, by0, bx1, by1] = r.box;
      for (let x = bx0 + 0.5; x < bx1; x += 1) for (let y = by0 + 0.5; y < by1; y += 1) {
        const below = on(s - 1).filter((q) => x > q.box[0] && x < q.box[2] && y > q.box[1] && y < q.box[3]);
        if (!below.length) throw new Error(`stage: room '${r.id}' on storey ${s} stands over nothing at (${x - 0.5}, ${y - 0.5}): a room stands over rooms of the storey below`);
        for (const q of below) under.add(q);
      }
    }
    for (const q of under) flat.add(q.id);
    z0s.push(r5(z0s[s - 1] + Math.max(...[...under].map((q) => q.h)) + SLAB));
  }
  for (const r of rooms) r.z0 = z0s[r.storey];
  return { z0s, flat };
}

/** The doorways' and ways' landings in a room: a strip a metre deep inside each, where a walker comes through. */
function landings(room, links, ways, t) {
  const out = [];
  const strip = (wall, at, lo, hi) => {
    const into = wall === '-x' || wall === '-y' ? 1 : -1, alongX = wall.endsWith('y'), d0 = at, d1 = at + into * (t + 1.2);
    out.push(alongX ? [lo, Math.min(d0, d1), hi, Math.max(d0, d1)] : [Math.min(d0, d1), lo, Math.max(d0, d1), hi]);
  };
  for (const l of links) {
    if (l.from === room.id) strip(l.wall, l.at, l.lo, l.hi);           // `wall` is the side of `from`; of `to`, the other
    else if (l.to === room.id) strip(flip(l.wall), l.at, l.lo, l.hi);
  }
  for (const w of ways) if (w.room === room.id) strip(w.side, w.at, w.lo, w.hi);
  return out;
}
const flip = (s) => (s.startsWith('+') ? `-${s[1]}` : `+${s[1]}`);

/**
 * Each stair (a link across neighbouring storeys) given its flight: in the lower room, under the upper one, against a
 * wall of their overlap, its foot and head clear of every doorway's landing and of any flight or hole already in either
 * room; met at its `approach` (on the lower floor) and left at its `arrival` (on the upper). → [{ from, to, lower,
 * upper, axis, dir, lat, foot, head, n, rise, run, rect, approach, arrival, z0, z1 }]
 */
export function placeStairs(rooms, stairLinks, links, ways, kit) {
  const byId = new Map(rooms.map((r) => [r.id, r])), taken = new Map(rooms.map((r) => [r.id, []]));
  const t = kit.wall / 2;
  return stairLinks.map((l) => {
    const a = byId.get(l.from), b = byId.get(l.to);
    const [L, U] = a.storey < b.storey ? [a, b] : [b, a];
    const rise = r5(U.z0 - L.z0), n = Math.ceil(rise / RISE - 1e-9), run = r5(n * GOING);
    const O = [Math.max(L.x0, U.x0), Math.max(L.y0, U.y0), Math.min(L.x1, U.x1), Math.min(L.y1, U.y1)];
    const busyL = [...landings(L, links, ways, t), ...taken.get(L.id)], busyU = [...landings(U, links, ways, t), ...taken.get(U.id)];
    const longY = O[3] - O[1] >= O[2] - O[0];
    for (const axis of longY ? ['y', 'x'] : ['x', 'y']) {
      const A = axis === 'y' ? 1 : 0, Lt = 1 - A;               // the climb's coordinate, and the lateral one
      for (const dir of [1, -1]) for (const side of [0, 1]) {
        const lat = side === 0 ? [O[Lt] + IN, O[Lt] + IN + FLIGHT] : [O[Lt + 2] - IN - FLIGHT, O[Lt + 2] - IN];
        if (lat[0] < O[Lt] + IN - 1e-9 || lat[1] > O[Lt + 2] - IN + 1e-9) continue;
        const mid = (lat[0] + lat[1]) / 2;
        // the foot from the start of the overlap on, a half metre at a time, while the head and its arrival still fit
        for (let k = 0; ; k++) {
          const foot = dir > 0 ? O[A] + APPROACH + BODY + k * 0.5 : O[A + 2] - APPROACH - BODY - k * 0.5, head = foot + dir * run;
          const arrival = foot + dir * (run + ARRIVE);
          if (dir > 0 ? arrival > O[A + 2] - BODY + 1e-9 : arrival < O[A] + BODY - 1e-9) break;
          const pt = (u, v) => (axis === 'y' ? [v, u] : [u, v]);
          const lo = Math.min(foot, head), hi = Math.max(foot, head);
          const rect = axis === 'y' ? [lat[0], lo, lat[1], hi] : [lo, lat[0], hi, lat[1]];
          const approach = pt(foot - dir * APPROACH, mid), arr = pt(arrival, mid);
          if (!inside(approach, interior(L), BODY) || !inside(arr, interior(U), BODY)) continue;
          // the flight and its approach clear of the lower room's landings and what it already holds; the hole and its
          // rails clear of the upper room's
          const reach = axis === 'y' ? [rect[0], Math.min(rect[1], approach[1]), rect[2], Math.max(rect[3], approach[1])] : [Math.min(rect[0], approach[0]), rect[1], Math.max(rect[2], approach[0]), rect[3]];
          if (busyL.some((q) => overlap(reach, q, 0.2))) continue;
          if (busyU.some((q) => overlap(rect, q, RAIL.t + 0.3)) || taken.get(U.id).some((q) => inside(arr, q))) continue;
          taken.get(L.id).push(reach); taken.get(U.id).push(rect, [arr[0] - 0.5, arr[1] - 0.5, arr[0] + 0.5, arr[1] + 0.5]);
          return { from: l.from, to: l.to, lower: L.id, upper: U.id, axis, dir, lat: lat.map(r5), foot: r5(foot), head: r5(head), n, rise, run,
            rect: rect.map(r5), approach: P(approach), arrival: P(arr), z0: L.z0, z1: U.z0 };
        }
      }
    }
    throw new Error(`stage: the stair from '${L.id}' up to '${U.id}' finds no wall to climb along: a ${rise} m rise needs ${r5(run + APPROACH + ARRIVE + 2 * BODY)} m of floor one way, under both rooms and clear of their doorways`);
  });
}

/**
 * Cut a storey's own faces (its kit's geometry, before the bake) round its stairs: over a flight (in its lower room)
 * every face above the floor goes (its ceiling exactly, its beams and ducts whole), and under a hole (in its upper
 * room) the floor goes exactly and anything standing on it whole. `cuts`: { flights, holes } (rects in plan).
 */
export function storeyCut(faces, cuts) {
  if (!cuts) return faces;
  const regions = [...cuts.flights.map((s) => ({ R: s.rect, keep: (z) => z <= 0.05 })), ...cuts.holes.map((s) => ({ R: s.rect, keep: (z) => z >= 0.5 }))];
  let out = faces;
  for (const { R, keep } of regions) {
    const next = [];
    for (const f of out) {
      const zs = f.corners.map((c) => c[2]), z = zs.reduce((s, v) => s + v, 0) / zs.length;
      const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
      const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      if (keep(z) || !overlap(bb, R, -1e-6)) { next.push(f); continue; }
      const level = Math.max(...zs) - Math.min(...zs) < 1e-6;
      if (level && f.corners.length === 4 && isRect(f)) { next.push(...rectMinus(f, R)); continue; }
      const c = [xs.reduce((s, v) => s + v, 0) / xs.length, ys.reduce((s, v) => s + v, 0) / ys.length];
      if (!inside(c, R)) next.push(f);
    }
    out = next;
  }
  return out;
}

/** Does a point stand in a storey's stairs: over a flight (above its floor) or in a hole's room under it (on its floor)? */
export function inStairs(cuts, p) {
  if (!cuts) return false;
  return cuts.flights.some((s) => p[2] > 0.05 && inside(p, s.rect)) || cuts.holes.some((s) => p[2] < 2.5 && inside(p, [s.rect[0] - RAIL.t, s.rect[1] - RAIL.t, s.rect[2] + RAIL.t, s.rect[3] + RAIL.t]));
}

/** Does a box ({ min, max }) stand in a storey's stairs: over a flight, or over a hole and its rails? */
export function boxInStairs(cuts, b) {
  if (!cuts || !b) return false;
  const R = [b.min[0], b.min[1], b.max[0], b.max[1]];
  return cuts.flights.some((s) => overlap(R, s.rect)) || cuts.holes.some((s) => overlap(R, s.rect, RAIL.t));
}

/** Is a level quad an axis-aligned rectangle in plan? */
function isRect(f) {
  const xs = new Set(f.corners.map((c) => r5(c[0]))), ys = new Set(f.corners.map((c) => r5(c[1])));
  return xs.size === 2 && ys.size === 2;
}

/**
 * A level rectangle face less a rect: up to four pieces, each wound as the face is, its uv carried (a panel's uv is
 * affine in its corners).
 */
function rectMinus(f, R) {
  const [c0, c1, , c3] = f.corners, A = [c1[0] - c0[0], c1[1] - c0[1]], B = [c3[0] - c0[0], c3[1] - c0[1]];
  const la = Math.hypot(...A), lb = Math.hypot(...B);
  if (la < 1e-9 || lb < 1e-9) return [f];
  const ua = [A[0] / la, A[1] / la], ub = [B[0] / lb, B[1] / lb];
  // R in the face's own (u, v)
  const uvOfP = (p) => [((p[0] - c0[0]) * ua[0] + (p[1] - c0[1]) * ua[1]), ((p[0] - c0[0]) * ub[0] + (p[1] - c0[1]) * ub[1])];
  const rc = [[R[0], R[1]], [R[2], R[1]], [R[2], R[3]], [R[0], R[3]]].map(uvOfP);
  const ru0 = Math.max(0, Math.min(...rc.map((q) => q[0]))), ru1 = Math.min(la, Math.max(...rc.map((q) => q[0])));
  const rv0 = Math.max(0, Math.min(...rc.map((q) => q[1]))), rv1 = Math.min(lb, Math.max(...rc.map((q) => q[1])));
  if (ru1 - ru0 < 1e-6 || rv1 - rv0 < 1e-6) return [f];
  const pieces = [[0, ru0, 0, lb], [ru1, la, 0, lb], [ru0, ru1, 0, rv0], [ru0, ru1, rv1, lb]].filter(([u0, u1, v0, v1]) => u1 - u0 > 1e-6 && v1 - v0 > 1e-6);
  const uvAt = f.uv ? (u, v) => f.uv[0].map((q, k) => r5(q + (f.uv[1][k] - q) * (u / la) + (f.uv[3][k] - q) * (v / lb))) : null;
  const at = (u, v) => P([c0[0] + ua[0] * u + ub[0] * v, c0[1] + ua[1] * u + ub[1] * v, c0[2]]);
  return pieces.map(([u0, u1, v0, v1]) => {
    const q = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    return { ...f, corners: q.map(([u, v]) => at(u, v)), ...(uvAt ? { uv: q.map(([u, v]) => uvAt(u, v)) } : {}) };
  });
}

/**
 * The stairs' faces on a storey: each flight in its lower room (a solid stepped block, its treads in the kit's trim,
 * its sides in its wall), the well's lining from the lower ceiling up to the floor over it, and round each hole in its
 * upper room a low wall on three sides (the head open). `surf(part)` the stage's surface maker; `ceilingOf(id)` a
 * room's ceiling height.
 */
export function stairFaces(out, cuts, surf, ceilingOf) {
  const tread = surf('trim'), side = surf('wall'), cell = side.cell;
  for (const s of cuts.flights) {
    const rr = s.rise / s.n, [l0, l1] = s.lat;
    for (let k = 0; k < s.n; k++) {
      const a = s.foot + s.dir * k * GOING, b = s.foot + s.dir * (k + 1) * GOING, z = r5((k + 1) * rr);
      const u0 = Math.min(a, b), u1 = Math.max(a, b);
      const mn = s.axis === 'y' ? [l0, u0, 0] : [u0, l0, 0], mx = s.axis === 'y' ? [l1, u1, z] : [u1, l1, z];
      // the riser faces the foot; the step's back is hidden by the next step (the last's by the floor's edge)
      const back = s.axis === 'y' ? (s.dir > 0 ? '+y' : '-y') : (s.dir > 0 ? '+x' : '-x');
      box(out, mn, mx, { ...tread, group: 'stage:stair' }, tread.cell, ['-z', ...(k < s.n - 1 ? [back] : [])]);
    }
    // its balustrades: a low wall on each side, stepping up with the treads
    const bal = { ...tread, group: 'stage:stair' };
    balustrades(s).forEach(([mn, mx], i) => { const k = Math.floor(i / 2), top = (k + 1) * rr; box(out, [mn[0], mn[1], top], mx, bal, bal.cell, ['-z']); });
    // the well: from the ceiling under it to the floor over it, round the hole, facing in
    const h = ceilingOf(s.lower), [x0, y0, x1, y1] = s.rect, lift = s.rise - h;
    if (lift > 1e-3) {
      panel(out, [x0, y0, h], [1, 0, 0], x1 - x0, [0, 0, 1], lift, [0, 1, 0], side, cell);
      panel(out, [x1, y1, h], [-1, 0, 0], x1 - x0, [0, 0, 1], lift, [0, -1, 0], side, cell);
      panel(out, [x0, y1, h], [0, -1, 0], y1 - y0, [0, 0, 1], lift, [1, 0, 0], side, cell);
      panel(out, [x1, y0, h], [0, 1, 0], y1 - y0, [0, 0, 1], lift, [-1, 0, 0], side, cell);
    }
  }
  for (const s of cuts.holes) for (const [mn, mx] of railBoxes(s, 0)) box(out, mn, mx, { ...tread, group: 'stage:stair' }, tread.cell, ['-z']);
}

/** A hole's rails: low walls along its two sides and its foot, just outside it, the head left open. At floor `z`. */
function railBoxes(s, z) {
  const [x0, y0, x1, y1] = s.rect, t = RAIL.t, h = z + RAIL.h;
  const footAt = s.dir > 0 ? (s.axis === 'y' ? y0 : x0) : (s.axis === 'y' ? y1 : x1);
  if (s.axis === 'y') {
    const ya = s.dir > 0 ? y0 - t : y0, yb = s.dir > 0 ? y1 : y1 + t;
    return [[[x0 - t, ya, z], [x0, yb, h]], [[x1, ya, z], [x1 + t, yb, h]], [[x0 - t, s.dir > 0 ? footAt - t : footAt, z], [x1 + t, s.dir > 0 ? footAt : footAt + t, h]]];
  }
  const xa = s.dir > 0 ? x0 - t : x0, xb = s.dir > 0 ? x1 : x1 + t;
  return [[[xa, y0 - t, z], [xb, y0, h]], [[xa, y1, z], [xb, y1 + t, h]], [[s.dir > 0 ? footAt - t : footAt, y0 - t, z], [s.dir > 0 ? footAt : footAt + t, y1 + t, h]]];
}

/**
 * The stairs' colliders, at their floors. A flight's balustrades, tread by tread, a rail's height over each tread (a
 * walker on the flight is stepped up by the ground under its eye and kept on it; one beside it is kept from climbing on
 * or walking under it), and its back to the full rise (no walking under its head); each hole's rails.
 */
export function stairColliders(stairs) {
  const out = [];
  for (const s of stairs) {
    const of = `stair:${s.lower}:${s.upper}`;
    for (const [mn, mx] of balustrades(s)) out.push({ min: P([mn[0], mn[1], s.z0]), max: P([mx[0], mx[1], s.z0 + mx[2]]), of });
    const T = 0.1, [l0, l1] = s.lat, a0 = Math.min(s.head, s.head - s.dir * T), a1 = Math.max(s.head, s.head - s.dir * T);
    out.push({ min: P(s.axis === 'y' ? [l0, a0, s.z0] : [a0, l0, s.z0]), max: P(s.axis === 'y' ? [l1, a1, s.z1] : [a1, l1, s.z1]), of });
    for (const [mn, mx] of railBoxes(s, s.z1)) out.push({ min: P(mn), max: P(mx), of: `rail:${s.upper}` });
  }
  return out;
}

/** A flight's balustrades, in its floor's frame: on both its sides, tread by tread, from the floor to a rail's height
 *  over the tread. → [[min, max]] */
function balustrades(s) {
  const out = [], rr = s.rise / s.n, [l0, l1] = s.lat, t = RAIL.t;
  for (let k = 0; k < s.n; k++) {
    const a = s.foot + s.dir * k * GOING, b = s.foot + s.dir * (k + 1) * GOING, u0 = Math.min(a, b), u1 = Math.max(a, b), z = (k + 1) * rr + RAIL.h;
    for (const [b0, b1] of [[l0 - t, l0], [l1, l1 + t]]) out.push(s.axis === 'y' ? [[b0, u0, 0], [b1, u1, z]] : [[u0, b0, 0], [u1, b1, z]]);
  }
  return out;
}

const LIFTED = ['at', 'sill', 'spawn', 'position'];
/** A record lifted by dz: its points (at, sill, spawn, position), its boxes (box, trigger: { min, max }). */
function lift(o, dz) {
  if (!dz) return o;
  const up = (p) => (Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) ? P([p[0], p[1], p[2] + dz]) : p);
  const q = { ...o };
  for (const k of LIFTED) if (q[k] !== undefined) q[k] = up(q[k]);
  for (const k of ['box', 'trigger']) if (q[k] && q[k].min) q[k] = { ...q[k], min: up(q[k].min), max: up(q[k].max) };
  if (q.min && q.max) { q.min = up(q.min); q.max = up(q.max); }
  return q;
}

/**
 * The storeyed stage: each storey's rooms built as a stage of their own (`assemble`: stage.js assembleStageScene) with
 * its stairs' cuts, lifted to its floor, and joined. The ground storey gives the page its frame (camera, walk, sky,
 * air); every storey's faces, lights, colliders, anchors and rooms join. Ids on a storey above the ground carry it
 * (`torch-1@1`), so a name is one thing.
 */
export function assembleStoreys(manifest, ctx, plan, assemble) {
  const roomsOf = (s) => manifest.rooms.filter((r) => (r.storey ?? 0) === s);
  const idOf = (r) => r.id ?? `r${manifest.rooms.indexOf(r)}`, ids = (s) => new Set(roomsOf(s).map(idOf));
  // the dressing's set piece (a tomb, an altar) stands where the walk ends: on the storey of the last way in (a program
  // orders its goal's last), every other storey bare of it, so it never stands across the way up
  const lastWay = (manifest.links || []).at(-1), byRoom = new Map(plan.rooms.map((r) => [r.id, r]));
  const goalStorey = lastWay && byRoom.has(lastWay.to) ? byRoom.get(lastWay.to).storey : 0;
  const parts = plan.storeys.map((st) => {
    const s = st.index, mine = ids(s);
    const rooms = roomsOf(s).map((r) => { const { storey, ...rest } = r; return { ...rest, id: idOf(r) }; });
    const links = (manifest.links || []).filter((l) => mine.has(l.from) && mine.has(l.to));
    // the dressing seats its set piece in the room of the last doorway (crypt.js): never one a stair stands in
    const stairRooms = new Set(plan.stairs.flatMap((x) => [x.lower, x.upper]).filter((id) => mine.has(id)));
    // (a doorway into a stair room from one that is not is turned round to end there)
    const lastOk = [...links].reverse().find((l) => !stairRooms.has(l.to));
    const turned = lastOk ? null : [...links].reverse().find((l) => !stairRooms.has(l.from));
    const ordered = lastOk ? [...links.filter((l) => l !== lastOk), lastOk] : turned ? [...links.filter((l) => l !== turned), { ...turned, from: turned.to, to: turned.from }] : links;
    const cuts = { flights: plan.stairs.filter((x) => mine.has(x.lower)), holes: plan.stairs.filter((x) => mine.has(x.upper)), flat: [...plan.flat].filter((id) => mine.has(id)),
      ...(s === goalStorey ? {} : { bare: true }) };
    const sub = {
      ...manifest, rooms, links: ordered, _storey: cuts,
      ...(manifest.ways ? { ways: s === 0 ? manifest.ways : [] } : {}),
      ...(manifest.doors ? { doors: manifest.doors.filter((d) => mine.has(d.room)) } : {}),
      ...(manifest.items ? { items: manifest.items.filter((it) => it.room === undefined ? s === 0 : mine.has(it.room)) } : {}),
      ...(s > 0 ? { camera: undefined } : {}),
    };
    if (sub.doors && !sub.doors.length) delete sub.doors;
    if (sub.items && !sub.items.length) delete sub.items;
    if (sub.ways && !sub.ways.length) delete sub.ways;
    return { s, z: st.z0, P: assemble(sub, ctx) };
  });
  const tag = (s) => (id) => (s === 0 || id == null ? id : `${id}@${s}`);
  const g = parts[0].P;
  const faces = parts.flatMap(({ s, z, P: Q }) => Q.faces.map((f) => {
    const q = { ...f, corners: f.corners.map((c) => P([c[0], c[1], c[2] + z])) };
    if (f.node && s > 0) q.node = tag(s)(f.node);
    return q;
  }));
  const lights = parts.flatMap(({ z, P: Q }) => (Q.lights || []).map((l) => ({ ...l, position: P([l.position[0], l.position[1], l.position[2] + z]) }))).map((l, i) => ({ ...l, name: `stage-light-${i}` }));
  const colliders = [...parts.flatMap(({ s, z, P: Q }) => (Q.colliders || []).map((c) => ({ ...lift(c, z), ...(s > 0 && c.of ? { of: `${c.of}@${s}` } : {}) }))), ...stairColliders(plan.stairs)];
  const anchors = parts.flatMap(({ s, z, P: Q }) => (Q.anchors || []).map((a) => ({ ...lift(a, z), id: tag(s)(a.id), ...(a.node ? { node: tag(s)(a.node) } : {}), storey: s })));
  const rooms = parts.flatMap(({ s, z, P: Q }) => (Q.rooms || []).map((r) => ({ ...r, box: { min: P([r.box.min[0], r.box.min[1], r.box.min[2] + z]), max: P([r.box.max[0], r.box.max[1], r.box.max[2] + z]) }, storey: s,
    doorways: r.doorways.map(tag(s)), stairs: plan.stairs.filter((x) => x.lower === r.id || x.upper === r.id).map((x) => `stair-${x.lower}-${x.upper}`) })));
  const stairs = plan.stairs.map((x) => ({ id: `stair-${x.lower}-${x.upper}`, kind: 'stair', room: x.lower, between: [x.lower, x.upper], at: P([x.approach[0], x.approach[1], x.z0]), to: P([x.arrival[0], x.arrival[1], x.z1]), rise: x.rise, treads: x.n }));
  const cutouts = [...new Set(parts.flatMap(({ P: Q }) => Q.cutouts || []))].sort();
  const fires = parts.flatMap(({ z, P: Q }) => (Q.fireSources || []).map((f) => lift(f, z)));
  const mote = parts.map(({ z, P: Q }) => Q.motes && { ...Q.motes, boxes: Q.motes.boxes.map((b) => [b[0], b[1], r5(b[2] + z), b[3], b[4], r5(b[5] + z)]), lights: Q.motes.lights.map((l) => [l[0], l[1], r5(l[2] + z), l[3]]) }).filter(Boolean);
  const lamps = parts.flatMap(({ z, P: Q }) => (Q.flicker ? Q.flicker.lamps.map((l) => lift(l, z)) : []));
  return {
    ...g,
    faces, lights, colliders, anchors: [...anchors, ...stairs], rooms,
    ...(cutouts.length ? { cutouts } : {}),
    ...(g.doors || parts.some(({ P: Q }) => Q.doors) ? { doors: parts.flatMap(({ z, P: Q }) => (Q.doors || []).map((d) => lift(d, z))) } : {}),
    ...(parts.some(({ P: Q }) => Q.items) ? { items: parts.flatMap(({ z, P: Q }) => (Q.items || []).map((it) => lift(it, z))) } : {}),
    ...(fires.length ? { fireSources: fires } : {}),
    ...(mote.length ? { motes: { ...mote[0], count: Math.min(3200, mote.reduce((a, m) => a + m.count, 0)), boxes: mote.flatMap((m) => m.boxes), lights: mote.flatMap((m) => m.lights).slice(0, 48) } } : {}),
    ...(lamps.length ? { flicker: { lamps: lamps.slice(0, 8) } } : {}),
    storeys: plan.storeys.map((st) => ({ index: st.index, z0: st.z0, rooms: [...ids(st.index)] })),
    ...(manifest._program ? { program: manifest._program } : {}),
  };
}
