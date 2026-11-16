/**
 * THE STORE IN A SLOT — a concept card (store-cards.js) built to a shop someone else stands: a town's plot, a city's
 * bay. The client gives the slot (how wide, how deep, how high, where its door is); this gives back the inside as a
 * TEMPLATE about the door's foot, to be stamped as a repeat drawn near the camera only, with what holds a body in it
 * (its fixtures' boxes, its partitions'), its till and its grade. The card runs through the standalone store's own
 * builders (store-concept.js: its shell, its cells, its fit-out degraded to the unit), so a mall's store and a street's
 * are one card; the storefront is the client's own (a town's shopfront, a city's front), so none is built here.
 *
 *   SLOT                          the slot's numbers: the least it holds, the wall it keeps inside the building's, its
 *                                 floor's lift over the pad, its ring, the faces an inside is held to, and the
 *                                 STANDARD UNITS a store is built to (so every street's shops share their insides)
 *   readEnter, tenantOf, TENANCY  a place's `shops` and the stores a street lets to (store-enter.js)
 *   slotOf({ w, d, h, door: { x, w } }) → the slot rounded to its steps, { w, d, h, door, slack: [x, y], key }, or
 *                                 null when it holds no store. `w` along the front, `d` into the building, `h` the
 *                                 storey's clear height, `door.x` its centre from the slot's left as you walk in; metres
 *   storeSlot(card, slot, { seed? }) → { card, key, sign?, faces, boxes, inside, door, till, keeper, faceCount, assessment, shed,
 *                                 degraded } in the SLOT FRAME: the origin the door's centre at the floor on the front
 *                                 line, +x your right hand as you walk in, +y into the store, +z up; metres
 *   openingLess(faces, rect)      a wall's faces less a door's opening ({ x0, x1, z0, z1, y0, y1 }: the opening and
 *                                 the band of depth its wall lies in): a rectangle in the band cut to the strips round
 *                                 it, any other face in the band whose middle lies in the opening left out
 *   rectLess(r, cut)              a box in plan less another: its pieces round it
 *
 * Pure; the card's own dice only.
 */
import { buildStandaloneStore } from './store-concept.js';
import { assessStoreConcept } from './store-assess.js';
import { resolveCard } from './store-cards.js';
import { ENTER_CARDS, ENTER_NEAR, TENANCY, readEnter, tenantOf } from './store-enter.js';

export { ENTER_CARDS, TENANCY, readEnter, tenantOf };

const FT = 0.3048;
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

export const SLOT = Object.freeze({
  least: Object.freeze({ w: 4.2, d: 7, h: 2.6 }),
  // the wall the inside keeps within the building's own; its floor over the pad; how far past its door it is drawn; how far
  // into that wall a slot may slide to stand its door on the client's
  wall: 0.3, lift: 0.03, near: ENTER_NEAR, slide: 0.15,
  // the faces an inside is held to (a law, advice)
  faces: 6000,
  // THE STANDARD UNITS a store is built to, so shops of every street share their insides: a slot takes the widest and
  // the deepest that fit it, its height the one that fits, its door at the standard place nearest the client's, its
  // door's way a standard width. A store is then one template a card a unit, whatever the bay it stands in
  units: Object.freeze({ w: Object.freeze([7.5, 6, 5]), d: Object.freeze([13, 9]), h: Object.freeze([2.7, 2.6]), door: Object.freeze([0.2, 0.3, 0.5, 0.7, 0.8]), doorW: 1.5 }),
  // the pier the store keeps at each end of its front (ft), inside the client's own front
  pier: 0.5,
});

export function slotOf({ w, d, h, door }) {
  const S = SLOT, U = S.units;
  if (!door || !(door.w > 0.6) || door.w > U.doorW + 1e-9) return null;
  const D = U.d.find((x) => x <= d + 1e-9), H = U.h.find((x) => x <= h + 1e-9);
  if (D === undefined || H === undefined) return null;
  // (the widest unit whose door, at one of its standard places, can be stood on the client's by sliding the unit within
  // the room it has, and no further than `slide` into the wall it keeps; the nearest place to the client's door first)
  for (const W of U.w) {
    if (W > w + 1e-9) continue;
    for (const at of [...U.door].sort((a, b) => Math.abs(a * W - (door.x - (w - W) / 2)) - Math.abs(b * W - (door.x - (w - W) / 2)))) {
      const left = door.x - at * W;
      if (left >= -S.slide - 1e-9 && left <= w - W + S.slide + 1e-9) return { w: W, d: D, h: H, door: { x: r5(at * W), w: U.doorW }, slack: [r5(left), 0], key: `${W}x${D}x${H}@${at}` };
    }
  }
  return null;
}

/** The store's faces a walker could never see left out: a box's face that lies wholly against another box or in the
 *  shell's wall (a shelf's back, an item's back against its shelf, two boxes' meeting sides). A box is five faces as
 *  store-box.js lays them (its sides, then its top); in the store's feet, its room [0, W] x [0, D]. */
function seenFaces(faces, W, D) {
  const E = 0.02, ORDER = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]];
  const isN = (f, n) => f?.normal && Math.abs(f.normal[0] - n[0]) < 1e-6 && Math.abs(f.normal[1] - n[1]) < 1e-6 && Math.abs(f.normal[2] - n[2]) < 1e-6;
  const boxes = [], boxOf = new Map();
  for (let i = 0; i + 4 < faces.length; i++) {
    if (!ORDER.every((n, k) => isN(faces[i + k], n) && faces[i + k].corners.length === 4)) continue;
    const cs = faces.slice(i, i + 5).flatMap((f) => f.corners), b = [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]))).concat([0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]))));
    for (let k = 0; k < 5; k++) boxOf.set(faces[i + k], boxes.length);
    boxes.push(b);
    i += 4;
  }
  const inside = (p, b) => p[0] > b[0] - E && p[0] < b[3] + E && p[1] > b[1] - E && p[1] < b[4] + E && p[2] > b[2] - E && p[2] < b[5] + E;
  const out = [];
  for (const f of faces) {
    const me = boxOf.get(f);
    if (me === undefined) { out.push(f); continue; }
    // (its corners drawn in a hair toward its middle and pushed a hair out of it: all in one other box, or all in the wall)
    const n = f.normal, m = [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / 4);
    const pts = [m, ...f.corners.map((c) => c.map((v, k) => v + (m[k] - v) * 0.04))].map((q) => q.map((v, k) => v + n[k] * 0.04));
    const walled = pts.every((q) => q[0] < 0 || q[0] > W || q[1] > D);
    if (walled || boxes.some((b, k) => k !== me && pts.every((q) => inside(q, b)))) continue;
    out.push(f);
  }
  return out;
}

export function storeSlot(cardIn, slot, { seed } = {}) {
  const card0 = resolveCard(cardIn);
  if (!card0) throw new Error(`store-slot: unknown card '${cardIn}'`);
  // (its shell plain: its floor one face and its walls bare, each told its part and its card's finish, for the client
  // to lay its own tile on (a texture the client's page already carries) where it has one for that finish)
  const F = card0.finishes ?? {};
  const card = { ...card0, finishes: { ...F, floor: 'plain', wall: 'paint' }, entry: { ...(card0.entry ?? {}), at: slot.door.x / slot.w, width: slot.door.w / FT } };
  const key = `${card0.id}:${slot.key}`, hFt = slot.h / FT, Wf = slot.w / FT, Df = slot.d / FT;
  const s = buildStandaloneStore(card, { width: Wf, depth: Df, wallHeight: hFt, doorHeight: Math.min(8.2, hFt - 1), pier: SLOT.pier, seed: seed ?? (strHash(key) % 100000) + 1, degrade: true });
  // the slot's frame: the store's (feet, its front on y = 0) about its door, in metres, its floor lifted off the pad
  const ex = s.entry.world[0], at = ([x, y, z]) => [r5((x - ex) * FT), r5(y * FT), r5(z * FT + SLOT.lift)];
  const faces = [];
  const lay = (f, part) => {
    if (typeof f.fill !== 'string' || f.fill[0] !== '#') return;   // (its own glass: the client's front has it)
    // (its slab's edge, under the client's pad; its own stoop before its front: the client's walk is there)
    if (f.corners.some((c) => c[2] < -1e-6 || c[1] < -0.35)) return;
    // (its floor in its card's own tint: the plain floor it is built with knows none)
    const g = { corners: f.corners.map(at), fill: part === 'floor' && F.floorTint ? F.floorTint : f.fill };
    if (f.normal) g.normal = f.normal.map(r5);
    if (f.outNormal) g.outNormal = f.outNormal.map(r5);
    // (a part of its shell told, and its normal with it: what a client's tile is laid by)
    if (part) { g.part = part; if (!g.normal && g.outNormal) g.normal = g.outNormal; }
    faces.push(g);
  };
  // (its shell: its outer skin stands inside the client's own wall, never seen; the rest its floor, its ceiling, its walls)
  for (const f of s.structure.faces) {
    if (f.group === 'facade:skin') continue;
    const zs = f.corners.map((c) => c[2]), flat = Math.max(...zs) - Math.min(...zs) < 1e-6;
    lay(f, flat ? (zs[0] < 0.5 ? 'floor' : 'ceiling') : 'wall');
  }
  for (const f of seenFaces(s.fitOut.faces, Wf, Df)) lay(f, null);
  // what holds a body: each fixture's box, the partition between the sales floor and its cells (open at each cell's
  // door), the walls between the cells
  const boxes = [], T = 0.2;
  const box = (x0, y0, x1, y1, h, of) => { if (x1 - x0 > 0.02 && y1 - y0 > 0.02) boxes.push({ min: at([x0, y0, 0]), max: at([x1, y1, h]), of }); };
  const rectIn = (frame, p) => { const a = frame.toWorld(p.x0, p.y0), b = frame.toWorld(p.x1, p.y1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
  for (const p of s.fitOut.placements) { const q = rectIn(s.salesFrame, p); box(q[0], q[1], q[2], q[3], p.row?.decl?.height ?? 3, p.archetype); }
  for (const p of s.fitOut.cellPlacements ?? []) if (p.frame?.toWorld) { const q = rectIn(p.frame, p); box(q[0], q[1], q[2], q[3], p.row?.decl?.height ?? 3, p.archetype); }
  const sw = s.sub.salesWorld, cells = s.sub.cells ?? [];
  if (cells.length) {
    const gaps = cells.map((c) => [c.door.world[0] - c.door.width / 2, c.door.world[0] + c.door.width / 2]).sort((a, b) => a[0] - b[0]);
    let x = 0;
    for (const [a, b] of gaps) { box(x, sw.y1 - T, a, sw.y1 + T, hFt, 'partition'); x = b; }
    box(x, sw.y1 - T, Wf, sw.y1 + T, hFt, 'partition');
    for (const c of cells) if (c.world.x1 < Wf - 0.5) box(c.world.x1 - T, sw.y1, c.world.x1 + T, c.world.y1, hFt, 'partition');
  }
  const counter = s.fitOut.placements.find((p) => p.archetype === 'counter'), cq = counter ? rectIn(s.salesFrame, counter) : null;
  const A = assessStoreConcept(card, s), inv = A.findings.filter((f) => f.severity === 'invariant');
  return {
    card: card0.id, key, faces, boxes, faceCount: faces.length, ...(card0.finishes?.sign ? { sign: card0.finishes.sign } : {}),
    // (its card's finishes, for the client's tiles: floor floorboards | marble | plain, wall paint | wainscot | wallpaper | brick)
    finish: { floor: F.floor ?? 'floorboards', wall: F.wall ?? 'paint' },
    inside: { x0: r5(-ex * FT), x1: r5((Wf - ex) * FT), y0: 0, y1: slot.d, h: r5(slot.h + SLOT.lift) },
    door: { x: 0, w: r5(s.entry.width * FT) },
    // (the till: before the counter, on the door's side of it; its keeper's place behind it, facing the till)
    ...(cq ? { till: at([(cq[0] + cq[2]) / 2, cq[1] - 2, 0]), keeper: at([(cq[0] + cq[2]) / 2, cq[3] + 1.2, 0]) } : {}),
    assessment: { ok: A.ok, invariants: inv.map((f) => f.id) },
    shed: s.sub.shed?.length ?? 0, degraded: s.fitOut.report.degraded?.length ?? 0,
  };
}

export function rectLess([x0, y0, x1, y1], [a0, b0, a1, b1]) {
  const cx0 = Math.max(x0, a0), cy0 = Math.max(y0, b0), cx1 = Math.min(x1, a1), cy1 = Math.min(y1, b1);
  if (cx1 <= cx0 || cy1 <= cy0) return [[x0, y0, x1, y1]];
  return [[x0, y0, x1, cy0], [x0, cy1, x1, y1], [x0, cy0, cx0, cy1], [cx1, cy0, x1, cy1]].filter((r) => r[2] - r[0] > 1e-6 && r[3] - r[1] > 1e-6);
}

export function openingLess(faces, O) {
  const E = 1e-4, out = [];
  for (const f of faces) {
    const cs = f.corners;
    if (!cs.every((c) => c[1] >= O.y0 - E && c[1] <= O.y1 + E)) { out.push(f); continue; }
    const xs = cs.map((c) => c[0]), zs = cs.map((c) => c[2]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    if (x1 <= O.x0 + E || x0 >= O.x1 - E || z1 <= O.z0 + E || z0 >= O.z1 - E) { out.push(f); continue; }
    const rect = cs.length === 4 && x1 - x0 > E && z1 - z0 > E && cs.every((c) => (Math.abs(c[0] - x0) < E || Math.abs(c[0] - x1) < E) && (Math.abs(c[2] - z0) < E || Math.abs(c[2] - z1) < E));
    if (!rect) {
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length, mz = zs.reduce((a, b) => a + b, 0) / zs.length;
      if (!(mx > O.x0 + E && mx < O.x1 - E && mz > O.z0 + E && mz < O.z1 - E)) out.push(f);
      continue;
    }
    const a = Math.max(x0, O.x0), b = Math.min(x1, O.x1);
    for (const [sx0, sx1, sz0, sz1] of [[x0, a, z0, z1], [b, x1, z0, z1], [a, b, O.z1, z1], [a, b, z0, O.z0]]) {
      if (sx1 - sx0 < 0.05 || sz1 - sz0 < 0.05) continue;   // (a sliver is left out)
      out.push({ ...f, corners: cs.map((c) => [Math.abs(c[0] - x0) < E ? sx0 : sx1, c[1], Math.abs(c[2] - z0) < E ? sz0 : sz1]) });
    }
  }
  return out;
}
