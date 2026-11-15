/**
 * THE ARENA MAP, LAID AS GROUND — a map's blocks (blocks.js) as the faces a page draws and the colliders its runtime
 * stops a body on, in the shapes a greybox level carries (gameworld/mission-level.js `missionGround`): faces
 * `{ corners, fill, group, doubleSided? }`, colliders `{ min, max }`. The runtime reads them as every controllable page
 * does: the ground under the feet is the highest face at most a step over them (game/level-equivalence.js faceGround,
 * the platform rule's probe), and a box stops a body whose height band it meets unless its top is within a step of the
 * feet (worlds/controllable/core.js resolveBlocking).
 *
 *   the ground floor   a face at the level's height, nothing under it
 *   an upper floor     a slab `SLAB` thick: its top the face stood on, its underside and its open edges drawn, a collider
 *                      the thickness of the slab (a body walks under it with its head clear: RISE - SLAB over the floor
 *                      below, and stands on it: its top is within a step of the feet)
 *   a wall             a panel on its cell edge a level high, its collider the panel; a low wall or rail `LOW` high
 *   a solid            the cell filled a level high
 *   a ramp             a sloped face over its run, walked up and down (the probe climbs a slope whose rise a frame is
 *                      under a step), its sides drawn, and under it colliders in slices whose tops stay under the slope,
 *                      so a body beside it is stopped and one on it is not
 *   a ladder           the runtime's own climb (playscape/objects/ladder.js, the `rungs` variant, plumb): a `climbable`
 *                      entity the platform rule takes hold of walking into its face, or stood at its foot holding
 *                      jump (`hold`: it goes up while the key is held), mounted at the lip; it stands in
 *                      its foot cell against the ledge's edge, the cell over its foot its shaft. Its rails and rungs are
 *                      drawn upright, so no rung is a step the probe stands on
 *
 *   mapGround(map, { at? }) → { faces, colliders, entities }   (`at`: where the map's corner stands, metres; entities:
 *                             the ladders' climbables)
 *   mapPoint(c, at?)        → [x, y, z] a cell's centre on its floor, metres
 *   MAP_GREY                the greybox values
 *
 * Pure, no dice.
 */
import { CELL, RISE, SLAB, LOW } from './blocks.js';
import { indexMap } from './map.js';
import { ladderParams, climbSurface, LADDER } from '../playscape/objects/ladder.js';

export const MAP_GREY = Object.freeze({
  floor: Object.freeze([['#8b929a', '#848b93'], ['#96908a', '#8f8983'], ['#8f938a', '#888c83']]),
  water: Object.freeze(['#4f6b7d', '#4a6677']), under: '#6c7077', edge: '#7a7e85', wall: '#6f7278', low: '#7d8086', solid: '#686b71', ramp: '#9a958c', rampSide: '#7f7b74', ladder: '#b8935c',
});
const T = 0.2, SLICE = 0.25, WATER = { drop: 0.5, kerb: 0.6 };
const r3 = (v) => Math.round(v * 1000) / 1000;
const P = (p) => p.map(r3);
const quad = (a, b, c, d, fill, group, two = false) => ({ corners: [P(a), P(b), P(c), P(d)], fill, group, ...(two ? { doubleSided: true } : {}) });
// a box: its faces (a bottom too when asked) and its collider
function box(out, x0, y0, z0, x1, y1, z1, fill, group, { bottom = false, collide = true } = {}) {
  out.faces.push(
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], fill, group),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], fill, group), quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], fill, group),
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], fill, group), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], fill, group),
  );
  if (bottom) out.faces.push(quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], fill, group));
  if (collide) out.colliders.push({ min: P([x0, y0, z0]), max: P([x1, y1, z1]) });
}

/** A cell's centre on its floor, in metres. */
export const mapPoint = (c, at = [0, 0, 0]) => P([at[0] + (c[0] + 0.5) * CELL, at[1] + (c[1] + 0.5) * CELL, at[2] + c[2] * RISE]);

/** The map laid as ground (see the header). */
export function mapGround(M, { at = [0, 0, 0] } = {}) {
  const out = { faces: [], colliders: [], entities: [] }, [ox, oy, oz] = at;
  const X = (i) => ox + i * CELL, Y = (j) => oy + j * CELL, Z = (k) => oz + k * RISE;
  const floor = new Set(M.floors.map((c) => c.join(',')));
  // FLOORS: the ground a face; an upper floor a slab, its open edges and its underside drawn
  for (const [i, j, k] of M.floors) {
    const tone = MAP_GREY.floor[Math.min(k, MAP_GREY.floor.length - 1)][(i + j) % 2], g = `map:floor:${k}`;
    const x0 = X(i), x1 = X(i + 1), y0 = Y(j), y1 = Y(j + 1), z = Z(k);
    if (k === 0) { out.faces.push(quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], tone, g, true)); continue; }
    const zb = z - SLAB;
    out.faces.push(quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], tone, g), quad([x0, y1, zb], [x1, y1, zb], [x1, y0, zb], [x0, y0, zb], MAP_GREY.under, 'map:under'));
    // (an edge with no floor beside it shows the slab's thickness)
    if (!floor.has(`${i + 1},${j},${k}`)) out.faces.push(quad([x1, y0, zb], [x1, y1, zb], [x1, y1, z], [x1, y0, z], MAP_GREY.edge, 'map:edge'));
    if (!floor.has(`${i - 1},${j},${k}`)) out.faces.push(quad([x0, y1, zb], [x0, y0, zb], [x0, y0, z], [x0, y1, z], MAP_GREY.edge, 'map:edge'));
    if (!floor.has(`${i},${j + 1},${k}`)) out.faces.push(quad([x1, y1, zb], [x0, y1, zb], [x0, y1, z], [x1, y1, z], MAP_GREY.edge, 'map:edge'));
    if (!floor.has(`${i},${j - 1},${k}`)) out.faces.push(quad([x0, y0, zb], [x1, y0, zb], [x1, y0, z], [x0, y0, z], MAP_GREY.edge, 'map:edge'));
    out.colliders.push({ min: P([x0, y0, zb]), max: P([x1, y1, z]) });
  }
  // WATER (a place's cut, read-town.js `read.water`): a cell with no floor, its surface drawn under the ground's level
  // and a kerb's height kept over it, so a body stops at the shore and a line and a round cross it
  for (const [i, j] of M.read?.water ?? []) {
    const x0 = X(i), x1 = X(i + 1), y0 = Y(j), y1 = Y(j + 1), z = Z(0);
    out.faces.push(quad([x0, y0, z - WATER.drop], [x1, y0, z - WATER.drop], [x1, y1, z - WATER.drop], [x0, y1, z - WATER.drop], MAP_GREY.water[(i + j) % 2], 'map:water'));
    out.colliders.push({ min: P([x0, y0, z - WATER.drop]), max: P([x1, y1, z + WATER.kerb]) });
  }
  // SOLIDS: the cell filled a level high
  for (const [i, j, k] of M.solids ?? []) box(out, X(i), Y(j), Z(k), X(i + 1), Y(j + 1), Z(k + 1), MAP_GREY.solid, 'map:solid');
  // WALLS: a panel on its cell's east or north edge, a level high, or a rail LOW high
  for (const w of M.walls ?? []) {
    const [i, j, k] = w.at, h = w.kind === 'low' ? LOW : RISE, fill = w.kind === 'low' ? MAP_GREY.low : MAP_GREY.wall, g = w.kind === 'low' ? 'map:low-wall' : 'map:wall';
    if (w.side === 'e') box(out, X(i + 1) - T / 2, Y(j) - T / 2, Z(k), X(i + 1) + T / 2, Y(j + 1) + T / 2, Z(k) + h, fill, g);
    else box(out, X(i) - T / 2, Y(j + 1) - T / 2, Z(k), X(i + 1) + T / 2, Y(j + 1) + T / 2, Z(k) + h, fill, g);
  }
  // RAMPS: the slope, its two sides, and the slices under it
  for (const r of M.ramps ?? []) {
    const [di, dj] = r.dir, L = r.run * CELL, k = r.at[2], z0 = Z(k), base = k > 0 ? z0 - SLAB : z0;
    // (the run in metres: from the edge its foot landing meets to the edge its head landing meets)
    const a = [X(r.at[0]) + (di < 0 ? CELL : 0), Y(r.at[1]) + (dj < 0 ? CELL : 0)];
    const along = [di, dj];
    // the ramp's two long edges, across its line: the cell's two sides
    const side0 = di ? [a[0], Y(r.at[1])] : [X(r.at[0]), a[1]], side1 = di ? [a[0], Y(r.at[1] + 1)] : [X(r.at[0] + 1), a[1]];
    const pt = (s, u, z) => [s[0] + along[0] * u, s[1] + along[1] * u, z];
    out.faces.push(quad(pt(side0, 0, z0), pt(side1, 0, z0), pt(side1, L, z0 + RISE), pt(side0, L, z0 + RISE), MAP_GREY.ramp, 'map:ramp', true));
    for (const s of [side0, side1]) out.faces.push({ corners: [P(pt(s, 0, z0)), P(pt(s, L, z0 + RISE)), P(pt(s, L, base))], fill: MAP_GREY.rampSide, group: 'map:ramp-side', doubleSided: true }, quad(pt(s, 0, base), pt(s, L, base), pt(s, L, z0), pt(s, 0, z0), MAP_GREY.rampSide, 'map:ramp-side', true));
    // (each slice's top the slope's height at its low end, so a body on the slope is within a step of every slice ahead)
    for (let u = 0; u < L - 1e-9; u += SLICE) {
      const u1 = Math.min(L, u + SLICE), top = z0 + (u / L) * RISE;
      if (top - base < 1e-3) continue;
      const p0 = pt(side0, u, base), p1 = pt(side1, u1, top);
      out.colliders.push({ min: P([Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), base]), max: P([Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), top]) });
    }
  }
  // LADDERS: the runtime's climb, plumb against the ledge's edge
  (M.ladders ?? []).forEach((l, n) => {
    const k = l.at[2], [di, dj] = l.dir, c = mapPoint(l.at, at);
    const lip = [c[0] + di * CELL / 2, c[1] + dj * CELL / 2, Z(k + 1)];
    const p = ladderParams({ variant: 'rungs', from: [c[0], c[1], Z(k)], to: lip }), S = climbSurface(p);
    const id = `map-ladder-${n}`;
    // (climbed by walking into it, as any ladder, and by standing at its foot and HOLDING JUMP: worlds/controllable
    // rules-basic.js `hold`; its reach is most of its foot cell)
    out.entities.push(...LADDER.lower(p, S, id).entities.map((e) => (e.rule?.type === 'climbable' ? { ...e, rule: { ...e.rule, hold: true, holdReach: 1.6 } } : e)));
    // drawn upright: two rails and the rungs as faces in the ladder's plane, off the edge by its standoff
    const U = p.U, Nh = p.Nh, off = S.off, w = p.width / 2, f0 = [lip[0] + Nh[0] * off, lip[1] + Nh[1] * off];
    const at2 = (u, z) => [f0[0] + U[0] * u, f0[1] + U[1] * u, z];
    for (const s of [-w, w]) out.faces.push(quad(at2(s - 0.03, Z(k)), at2(s + 0.03, Z(k)), at2(s + 0.03, Z(k + 1) + 0.9), at2(s - 0.03, Z(k + 1) + 0.9), MAP_GREY.ladder, 'map:ladder', true));
    for (let s = 1; s <= p.steps; s++) { const z = Z(k) + s * p.pitch; out.faces.push(quad(at2(-w, z - 0.02), at2(w, z - 0.02), at2(w, z + 0.02), at2(-w, z + 0.02), MAP_GREY.ladder, 'map:ladder', true)); }
  });
  return out;
}

/**
 * THE MAP'S FLOORS FOR A MIND (worlds/controllable/mind.js `rule.floors`): each upper floor a body walks to, as the
 * box round it, with the ramps that reach it (a flight: its foot landing and its head landing). A mind given them goes
 * to a place on another floor by a ramp, and comes down by one. A mind is on a floor when it stands over its area AT
 * ITS HEIGHT, so the ground inside a gallery's ring is still the ground; a mind that walks such a floor wants its path
 * kept to it (`rule.navLedges`). What it does not carry, said: a ladder (a mind does not climb one), a floor no ramp
 * reaches, and a floor above the first (a mind's way is the ground to a floor and back).
 *   mapFloors(map, { at? }) → [{ area: [x0, y0, x1, y1], z, flights: [{ bottom: [x, y], top: [x, y] }] }]
 */
export function mapFloors(M, { at = [0, 0, 0] } = {}) {
  const I = indexMap(M), [ox, oy, oz] = at, mid = (c) => [r3(ox + (c[0] + 0.5) * CELL), r3(oy + (c[1] + 0.5) * CELL)], out = [];
  for (const plat of I.platforms) {
    if (plat.level !== 1) continue;
    const cells = plat.cells.map((id) => I.at.get(id)), has = new Set(cells.map((c) => `${c[0]},${c[1]}`));
    const flights = I.connectors.filter((x) => x.kind === 'ramp' && !x.faults.length && x.to[2] === 1 && has.has(`${x.to[0]},${x.to[1]}`)).map((x) => ({ bottom: mid(x.from), top: mid(x.to) }));
    if (!flights.length) continue;
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    out.push({ area: [r3(ox + Math.min(...xs) * CELL), r3(oy + Math.min(...ys) * CELL), r3(ox + (Math.max(...xs) + 1) * CELL), r3(oy + (Math.max(...ys) + 1) * CELL)], z: r3(oz + RISE), flights });
  }
  return out;
}
