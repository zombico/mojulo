/**
 * DOORS — the ends by which one stage map links to another. A recipe names its ends:
 *
 *   doors: [{ id, at, to: { map, door }, room?, locked? }]
 *     at: { house: k, side }   the k-th house door along a plaza side
 *         { portal: true }     the nave's great portal (the dressing's portal bay)
 *         { side, u, w? }      a point u m along a wall of the room, `w` wide: snapped to the middle of the bay it
 *                              falls in (a kit that builds bays), and given a door — a leaf in a stone frame — since
 *                              the wall has none there (on an open side it is a threshold only)
 *     locked: '<item id>'      the end will not let a walker through until the run holds that item (the atlas shell
 *                              decides; the page only reports the step)
 *
 *   items: [{ id, at: [x, y] }]   things a walker takes by walking up to them (a key on a plinth); the page reports
 *                                 the taking, the atlas carries it, and a map entered again keeps it taken
 *
 * and each resolves from what the kit already built to { id, to, sill, N, trigger, spawn, face }: the TRIGGER is a
 * box in front of the end, inside the room, the walker crosses by stepping into; the SPAWN is where a walker
 * arriving through this end stands, further in, FACING into the room (away from the end, so walking on does not
 * take you straight back). Pure: a function of the plan and the built geometry.
 */
import { r5, P, wallFrame, wallBox, box } from './geom.js';

const SIDES = ['-y', '+x', '+y', '-x'];
const DEPTH = 1.1, SPAWN = 2.6, HEIGHT = 3.2, EYE = 1.7;

/** Where an end stands: the wall frame it is on, the u of its middle and its half width. */
function anchor(plan, geom, end) {
  const r = end.room ? plan.rooms.find((q) => q.id === end.room) : plan.rooms[0];
  if (!r) throw new Error(`stage: door '${end.id}' names room '${end.room}', which is not in the recipe`);
  const at = end.at || {};
  if (at.portal) {
    const bay = (geom.bays || []).find((b) => b.portal);
    if (!bay) throw new Error(`stage: door '${end.id}' is at the portal, but kit '${plan.kitId}' built none`);
    return { F: bay.F, u: (bay.u0 + bay.u1) / 2, hw: plan.kit.dress.portal.width / 2 };
  }
  if (!SIDES.includes(at.side)) throw new Error(`stage: door '${end.id}' needs at.side, one of ${SIDES.join(' ')}`);
  const F = wallFrame(r, at.side);
  if (Number.isInteger(at.house)) {
    const row = (geom.houses || []).filter((h) => h.F.o.join() === F.o.join());
    const h = row[at.house];
    if (!h) throw new Error(`stage: door '${end.id}' names house ${at.house} on side ${at.side}, which has ${row.length}`);
    return { F, u: h.door.mid, hw: h.door.dw };
  }
  if (!Number.isFinite(at.u) || at.u < 0 || at.u > F.len) throw new Error(`stage: door '${end.id}' needs at.u within 0..${F.len} along side ${at.side}`);
  // a kit that builds in bays puts a door in the middle of one, clear of the columns at the bay lines
  const bay = (geom.bays || []).find((b) => b.F.o.join() === F.o.join() && at.u >= b.u0 && at.u <= b.u1);
  return { F, u: bay ? (bay.u0 + bay.u1) / 2 : at.u, hw: (at.w ?? 1.6) / 2, build: !r.open.includes(at.side) };
}

/** The recipe's door ends, resolved. No `doors` → []. */
export function stageDoors(plan, geom, doors = []) {
  if (!Array.isArray(doors)) throw new Error('stage: `doors` must be an array of { id, at, to: { map, door } }');
  const seen = new Set();
  return doors.map((end) => {
    if (typeof end?.id !== 'string' || !end.id) throw new Error('stage: every door needs a string id');
    if (seen.has(end.id)) throw new Error(`stage: door id '${end.id}' is used twice`);
    seen.add(end.id);
    if (typeof end.to?.map !== 'string' || typeof end.to?.door !== 'string') throw new Error(`stage: door '${end.id}' needs to: { map, door }`);
    if (end.locked !== undefined && (typeof end.locked !== 'string' || !end.locked)) throw new Error(`stage: door '${end.id}' locked: names an item id`);
    const { F, u, hw, build } = anchor(plan, geom, end);
    const p = (along, off, z) => [F.o[0] + F.U[0] * along + F.N[0] * off, F.o[1] + F.U[1] * along + F.N[1] * off, z];
    const a = p(u - hw - 0.3, 0, 0), b = p(u + hw + 0.3, DEPTH, HEIGHT);
    const spawn = p(u, SPAWN, EYE);
    return {
      id: end.id, to: { map: end.to.map, door: end.to.door }, ...(end.locked ? { locked: end.locked } : {}), ...(build ? { build: { u, hw, F } } : {}),
      sill: P(p(u, 0, 0)), N: P([F.N[0], F.N[1], 0]),
      trigger: { min: P([0, 1, 2].map((k) => Math.min(a[k], b[k]))), max: P([0, 1, 2].map((k) => Math.max(a[k], b[k]))) },
      spawn: P(spawn), face: [r5(F.N[0]), r5(F.N[1])],
    };
  });
}

/** The doors a recipe's wall-point ends need (a leaf in a stone frame, standing on the wall), baked like the shell.
 *  `build` is dropped from the ends once used: the payload carries none of it. */
export function doorFaces(plan, ends) {
  const kit = plan.kit, t = kit.tiles.trim, out = [];
  const trim = { key: t.family ? `${t.family}-a` : t.key, scale: t.scale, tint: kit.tint.trim, group: 'stage:trim', cell: kit.cells.trim };
  const leaf = { key: 'wood-oak', scale: 1.4, tint: [0.5, 0.38, 0.28], group: 'stage:door', cell: 1 };
  for (const e of ends) {
    if (!e.build) continue;
    // it stands proud of the wall's own plinth (a band along the foot of the wall would run across the leaf)
    const { F, u, hw } = e.build, h = 2.7, f = 0.3, o = (kit.plinth?.out ?? 0) + 0.06, n0 = out.length;
    wallBox(out, F, u - hw, u + hw, 0, h, o, leaf, 1);
    for (let q = n0; q < out.length; q++) out[q].node = e.id;   // the leaf is the end's own node (anchors.js); its frame is the wall's
    wallBox(out, F, u - hw - f, u - hw, 0, h + f, o + 0.1, trim, trim.cell);
    wallBox(out, F, u + hw, u + hw + f, 0, h + f, o + 0.1, trim, trim.cell);
    wallBox(out, F, u - hw - f, u + hw + f, h, h + f, o + 0.12, trim, trim.cell);
  }
  return out;
}
export const withoutBuild = (ends) => ends.map(({ build, ...e }) => e);

const GOLD = '#f0c24a', GOLD_DARK = '#a8781e';
/** The recipe's items: a stone plinth (baked) and the thing on it (self-lit gold, its own group so the page can take it
 *  away) → { faces, items: [{ id, at, r }] }. */
export function stageItems(plan, items = []) {
  if (!Array.isArray(items)) throw new Error('stage: `items` must be an array of { id, at: [x, y] }');
  const kit = plan.kit, t = kit.tiles.trim, faces = [], seen = new Set();
  const stone = { key: t.family ? `${t.family}-a` : t.key, scale: t.scale, tint: kit.tint.trim, group: 'stage:plinth' };
  const records = items.map((it) => {
    if (typeof it?.id !== 'string' || !it.id) throw new Error('stage: every item needs a string id');
    if (seen.has(it.id)) throw new Error(`stage: item id '${it.id}' is used twice`);
    seen.add(it.id);
    if (!Array.isArray(it.at) || it.at.length !== 2 || !it.at.every(Number.isFinite)) throw new Error(`stage: item '${it.id}' needs at: [x, y]`);
    const [x, y] = it.at, z = 0.9;
    box(faces, [x - 0.25, y - 0.25, 0], [x + 0.25, y + 0.25, z], { ...stone, cell: 1 }, 1);
    box(faces, [x - 0.31, y - 0.31, z], [x + 0.31, y + 0.31, z + 0.08], { ...stone, cell: 1 }, 1);
    // a key standing on its bit: a square bow, a shaft, two teeth
    const raw = [], k = z + 0.12, plain = { key: null, scale: 1, tint: [1, 1, 1] };
    const bar = (mn, mx) => box(raw, [x + mn[0], y + mn[1], k + mn[2]], [x + mx[0], y + mx[1], k + mx[2]], plain, 1);
    bar([-0.03, -0.03, 0.05], [0.03, 0.03, 0.42]);
    bar([0.03, -0.025, 0.05], [0.12, 0.025, 0.1]); bar([0.03, -0.025, 0.15], [0.1, 0.025, 0.2]);
    bar([-0.12, -0.03, 0.42], [0.12, 0.03, 0.47]); bar([-0.12, -0.03, 0.66], [0.12, 0.03, 0.71]);
    bar([-0.12, -0.03, 0.47], [-0.07, 0.03, 0.66]); bar([0.07, -0.03, 0.47], [0.12, 0.03, 0.66]);
    for (const { texture, textureLit, uv, tint, cell, ...f } of raw) faces.push({ ...f, fill: f.normal[2] < -0.5 ? GOLD_DARK : GOLD, group: `item:${it.id}` });
    return { id: it.id, at: P([x, y, k + 0.35]), r: 1 };
  });
  return { faces, items: records };
}
