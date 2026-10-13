/**
 * THE WAYS INTO A CITY'S BUILDINGS: two, as a game city has them.
 *
 *   walk   the building's ground storey is part of the map: a lobby open to the street (its door a gap in the front
 *          wall, a floor, a ceiling, a counter, a stair rising out of sight), walked into without a scene changing.
 *          Small on purpose: a lobby, a stair to somewhere the level does not go.
 *   door   the building's door changes the scene: its facade carries a marked door, the level a `door` zone on the
 *          walk in front of it, and its inside is a level of its own, a building on the rail (structure/level.js
 *          `level: { door: 'out' }`): an office, a store, a restaurant, chosen by the lot's use, or the lot's own
 *          `inside`. create_game links the two doors.
 *
 *   lots:     { '<lot id>': { enter: 'walk' | 'door', inside?: { kind, … } } }     a lot by hand
 *   segments: { levels: true, enter?: { walk, door } }                              each segment's own, picked
 *
 * A segment picks its entries from the lots nearest its middle that can hold one (a lobby wants a frontage and a
 * storey's height to spare), the walk-ins among shopfronts and towers, the doors among offices and shops: no dice,
 * so an entry moves only when its lot does.
 */
import { strHash } from './dice.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const ENTER = Object.freeze(['walk', 'door']);
export const INSIDE_KINDS = Object.freeze(['office', 'store', 'restaurant']);
export const ENTER_DEFAULT = Object.freeze({ walk: 2, door: 1 });
const STORE_CARDS = ['cafe', 'apparel', 'bookstore', 'food', 'electronics', 'homewares'];
// a lobby: how deep it reaches into the lot, how high its ceiling stands, the door's width
export const LOBBY = Object.freeze({ depth: 9, height: 4.4, door: 2.6, wall: 0.3, minFront: 8, minDepth: 12 });

/** A lot's `inside`, checked (or the one its use implies). */
export function readInside(v, at) {
  if (v === undefined) return undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v) || !INSIDE_KINDS.includes(v.kind)) throw new Error(`city: ${at} is { kind: ${INSIDE_KINDS.map((k) => `'${k}'`).join(' | ')}, … } (a store's card, an office's storeys)`);
  for (const k of Object.keys(v)) if (!['kind', 'card', 'storeys', 'seed'].includes(k)) throw new Error(`city: ${at}.${k} is not an inside setting (kind, card, storeys, seed)`);
  return v;
}
/** The inside a lot's use implies: an office for an office or a tower, a store or a restaurant for a shop. */
export function insideOf(lot) {
  if (lot.tower || lot.use === 'office' || lot.use === 'civic') return { kind: 'office', storeys: 2 };
  const h = strHash(lot.id);
  return h % 3 === 0 ? { kind: 'restaurant', seed: (h % 997) + 1 } : { kind: 'store', card: STORE_CARDS[(h >>> 4) % STORE_CARDS.length] };
}
const canLobby = (l) => l.use !== 'parking' && l.street !== undefined && Math.min(l.x1 - l.x0, l.y1 - l.y0) >= LOBBY.minFront && Math.max(l.x1 - l.x0, l.y1 - l.y0) >= LOBBY.minDepth && l.h >= LOBBY.height + 6;
const canDoor = (l) => l.use !== 'parking' && l.street !== undefined && l.h > 0;

/** The city's entries: [{ lot, enter, segment?, inside? }], the lots by hand first, then each segment's picks. */
export function cityEntries(d) {
  const byLot = new Map();
  for (const [id, o] of Object.entries(d.plan.lots)) if (o.enter) byLot.set(id, { lot: id, enter: o.enter, ...(o.enter === 'door' ? { inside: o.inside ?? null } : {}), byHand: true });
  const S = d.plan.segments, want = S && (S.enter ?? (S.levels ? ENTER_DEFAULT : null));
  const lots = new Map(d.lots.map((l) => [l.id, l]));
  if (want && d.segments) for (const seg of d.segments) {
    const cx = (seg.rect.x0 + seg.rect.x1) / 2, cy = (seg.rect.y0 + seg.rect.y1) / 2;
    const near = seg.lots.map((id) => lots.get(id)).filter(Boolean).sort((a, b) => Math.hypot(a.door[0] - cx, a.door[1] - cy) - Math.hypot(b.door[0] - cx, b.door[1] - cy) || (a.id < b.id ? -1 : 1));
    const take = (n, ok, rank) => near.filter((l) => !byLot.has(l.id) && ok(l)).sort((a, b) => rank(b) - rank(a)).slice(0, n);
    // a walk-in where people go in off the street (a shopfront, a tower's lobby); a door into an office before a shop
    for (const l of take(want.walk ?? 0, canLobby, (l) => (l.tower ? 2 : l.shopfront ? 1 : 0))) byLot.set(l.id, { lot: l.id, enter: 'walk', segment: seg.id });
    for (const l of take(want.door ?? 0, canDoor, (l) => (l.tower || l.use === 'office' ? 2 : l.shopfront ? 1 : 0))) byLot.set(l.id, { lot: l.id, enter: 'door', segment: seg.id });
  }
  const segOf = (id) => (d.segments || []).find((s) => s.lots.includes(id))?.id;
  return [...byLot.values()].filter((e) => lots.has(e.lot)).map((e) => {
    const l = lots.get(e.lot);
    if (e.enter === 'walk' && !canLobby(l)) return { ...e, error: `lot ${e.lot} cannot hold a lobby (a ${LOBBY.minFront} m frontage, ${LOBBY.minDepth} m deep, ${LOBBY.height + 6} m tall)` };
    return { ...e, segment: e.segment ?? segOf(e.lot), ...(e.enter === 'door' ? { inside: e.inside ?? insideOf(l), door: doorOf(l) } : {}) };
  });
}

// a lot's front frame: origin at its front-left corner, u along the front, v in
export function frontFrame(l) {
  const w = l.face === 'n' || l.face === 's' ? l.x1 - l.x0 : l.y1 - l.y0, depth = l.face === 'n' || l.face === 's' ? l.y1 - l.y0 : l.x1 - l.x0;
  const F = { n: [[l.x0, l.y0], [1, 0], [0, 1]], s: [[l.x1, l.y1], [-1, 0], [0, -1]], w: [[l.x0, l.y1], [0, -1], [1, 0]], e: [[l.x1, l.y0], [0, 1], [-1, 0]] }[l.face];
  const [o, u, v] = F;
  return { w, depth, u, v, P: (a, b, z = 0) => [r2(o[0] + u[0] * a + v[0] * b), r2(o[1] + u[1] * a + v[1] * b), r2(z)] };
}

/** A door-scene lot's door, in metres: the zone on the walk a step out from its door, where a walker coming back out
 *  stands (four metres out, facing the street), the door's own place on the facade. */
export function doorOf(l) {
  const F = frontFrame(l), mid = F.w / 2, out = [-F.v[0], -F.v[1]];
  return { id: `lot-${l.id.replace(/\./g, '-')}`, at: F.P(mid, -1.1), spawn: F.P(mid, -4), heading: r2(Math.atan2(out[1], out[0])), face: F.P(mid, 0) };
}

/** A walk-in lot's lobby, in metres: { height, faces, colliders } (the facade stands on it from `height` up). */
export function lobbyOf(l, colours) {
  const F = frontFrame(l), t = LOBBY.wall, H = Math.min(LOBBY.height, l.h - 6), D = Math.min(LOBBY.depth, F.depth - 2), W = F.w;
  const mid = W / 2, g0 = mid - LOBBY.door / 2, g1 = mid + LOBBY.door / 2, faces = [], colliders = [];
  const quad = (cs, n, fill, group) => faces.push({ corners: cs, normal: n, fill, group, doubleSided: true });
  const nrm = (dir) => [r2(dir[0]), r2(dir[1]), 0];
  const inward = nrm(F.v), outward = nrm([-F.v[0], -F.v[1]]), along = nrm(F.u), back = nrm([-F.u[0], -F.u[1]]);
  quad([F.P(t, 0.02, 0.05), F.P(W - t, 0.02, 0.05), F.P(W - t, D, 0.05), F.P(t, D, 0.05)], [0, 0, 1], colours.floor, 'city:lobby-floor');
  quad([F.P(t, 0, H), F.P(t, D, H), F.P(W - t, D, H), F.P(W - t, 0, H)], [0, 0, -1], colours.ceiling, 'city:lobby-ceiling');
  quad([F.P(t, D, 0), F.P(W - t, D, 0), F.P(W - t, D, H), F.P(t, D, H)], outward, colours.wall, 'city:lobby-wall');
  quad([F.P(t, 0, 0), F.P(t, D, 0), F.P(t, D, H), F.P(t, 0, H)], along, colours.wall, 'city:lobby-wall');
  quad([F.P(W - t, D, 0), F.P(W - t, 0, 0), F.P(W - t, 0, H), F.P(W - t, D, H)], back, colours.wall, 'city:lobby-wall');
  // the front: the wall either side of the door, its outer face and its inner, a transom over the door
  // each side of the door: a base, a band of glass to a transom's height, the wall over it; a mullion every 1.5 m
  for (const [a0, a1] of [[0, g0], [g1, W]]) {
    if (a1 - a0 < 0.05) continue;
    quad([F.P(a0, 0, 0), F.P(a1, 0, 0), F.P(a1, 0, 0.5), F.P(a0, 0, 0.5)], outward, colours.front, 'city:lobby-front');
    quad([F.P(a0, 0, 3), F.P(a1, 0, 3), F.P(a1, 0, H), F.P(a0, 0, H)], outward, colours.front, 'city:lobby-front');
    quad([F.P(a0, 0.02, 0.5), F.P(a1, 0.02, 0.5), F.P(a1, 0.02, 3), F.P(a0, 0.02, 3)], outward, colours.glass, 'city:lobby-glass');
    for (let a = a0 + 1.5; a < a1 - 0.3; a += 1.5) quad([F.P(a - 0.05, -0.02, 0.5), F.P(a + 0.05, -0.02, 0.5), F.P(a + 0.05, -0.02, 3), F.P(a - 0.05, -0.02, 3)], outward, colours.front, 'city:lobby-mullion');
    quad([F.P(a1, t, 0), F.P(a0, t, 0), F.P(a0, t, H), F.P(a1, t, H)], inward, colours.wall, 'city:lobby-wall');
  }
  quad([F.P(g0, 0, 3), F.P(g1, 0, 3), F.P(g1, 0, H), F.P(g0, 0, H)], outward, colours.front, 'city:lobby-front');
  // the counter, and a stair rising along one side to the ceiling
  const box = (a0, b0, a1, b1, z0, z1, fill, group) => {
    const c = [F.P(a0, b0), F.P(a1, b0), F.P(a1, b1), F.P(a0, b1)], at = (p, z) => [p[0], p[1], r2(z)];
    quad(c.map((p) => at(p, z1)), [0, 0, 1], fill, group);
    for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; quad([at(p, z0), at(q, z0), at(q, z1), at(p, z1)], nrm([q[1] - p[1], -(q[0] - p[0])].map((x) => x / (Math.hypot(q[0] - p[0], q[1] - p[1]) || 1))), fill, group); }
    colliders.push({ min: [Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), r2(z0)], max: [Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1])), r2(z1)], of: `lobby:${l.id}:${group}` });
  };
  box(mid - 1.6, D - 2.6, mid + 1.6, D - 1.8, 0, 1.1, colours.counter, 'city:lobby-counter');
  const steps = Math.max(6, Math.round(H / 0.18)), run = (D - 2.2) / steps, a0 = W - t - 1.7, a1 = W - t - 0.1;
  for (let k = 0; k < steps; k++) box(a0, 1.2 + k * run, a1, 1.2 + (k + 1) * run, 0, r2((k + 1) * (H / steps)), colours.stair, 'city:lobby-stair');
  // its walls, for the walker: the front either side of the door, the sides, the back
  const wall = (pa, pb) => colliders.push({ min: [Math.min(pa[0], pb[0]), Math.min(pa[1], pb[1]), 0], max: [Math.max(pa[0], pb[0]), Math.max(pa[1], pb[1]), H], of: `lobby:${l.id}:wall` });
  wall(F.P(0, 0), F.P(g0, t)); wall(F.P(g1, 0), F.P(W, t)); wall(F.P(0, 0), F.P(t, D)); wall(F.P(W - t, 0), F.P(W, D)); wall(F.P(0, D), F.P(W, D + t));
  return { height: H, depth: D, door: F.P(mid, 0), faces, colliders };
}

/** A door-scene lot's marked door on its facade, in metres: a dark leaf in a lit surround, a canopy over it. */
export function doorFaces(l, accent) {
  const F = frontFrame(l), mid = F.w / 2, out = [-F.v[0], -F.v[1], 0], faces = [];
  const q = (a0, a1, z0, z1, b, fill, group) => faces.push({ corners: [F.P(a0, b, z0), F.P(a1, b, z0), F.P(a1, b, z1), F.P(a0, b, z1)], normal: out.map(r2), fill, group, doubleSided: true });
  q(mid - 1.5, mid + 1.5, 0, 3.4, -0.06, accent, 'city:door-surround');
  q(mid - 1.1, mid + 1.1, 0, 2.9, -0.1, '#2b231e', 'city:door');
  // the canopy: a slab out over the walk
  const c = [F.P(mid - 1.8, 0, 3.6), F.P(mid + 1.8, 0, 3.6), F.P(mid + 1.8, -1.6, 3.6), F.P(mid - 1.8, -1.6, 3.6)];
  faces.push({ corners: c, normal: [0, 0, 1], fill: accent, group: 'city:door-canopy', doubleSided: true });
  return faces;
}
