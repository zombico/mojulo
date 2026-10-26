/**
 * NO FLAT BUILDING POLYGONS (the operator's rule, 1026): a built surface whose edge can be seen has thickness. A roof is a
 * slab, not a sheet: its covering, an underside a thickness below it, and a band along every edge no other face of the
 * covering shares (the fascia at an eave, the verge at a gable), so from below an eave is a soffit and a fascia, never a
 * knife edge. A doorway is cut through a wall's depth, not punched in a skin (stage-buildings.js lays its reveals).
 *
 * On when a recipe says `solid: true` (stamped at mint on a world that builds, so a world minted from then is solid and a
 * row minted before keeps its bytes) or when the world is read in the form render (gen-7, era/eras.js): the render's
 * `ctx.solid` (worlds/world-scene.js).
 *
 *   slabOf(polys, T)   → { under: [corners], edges: [{ corners, out }] }   a covering's polygons (each [[x, y, z], …]) as
 *                        a slab T thick: each polygon's underside (wound to face down) and a band down every free edge
 *                        (`out` the way it faces: level, away from its polygon)
 *   openEdges(polys)   → the edges of a set of polygons no second polygon shares: none for a closed solid (the law)
 *   buildsBuildings(m) → whether a world recipe builds buildings (a stage's `buildings` or `town`, a geocube's town)
 *   stampSolid(m)      → a new world recipe that builds, `solid: true` unless it says; any other as it came
 *
 * Pure: corners rounded to the millimetre, no dice.
 */
const r3 = (v) => Math.round(v * 1000) / 1000;
const P3 = (p) => p.map(r3);
const key = (a, b) => { const s = a.join(','), t = b.join(','); return s < t ? `${s}|${t}` : `${t}|${s}`; };

function edgeCounts(polys) {
  const n = new Map();
  for (const poly of polys) for (let i = 0; i < poly.length; i++) {
    const k = key(P3(poly[i]), P3(poly[(i + 1) % poly.length]));
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return n;
}

/** A covering as a slab `T` thick: its polygons' undersides and a band down each edge no other polygon shares. */
export function slabOf(polys, T) {
  if (!(T > 0)) throw new Error('solid: a slab is some thickness, T > 0 metres');
  const counts = edgeCounts(polys), under = [], edges = [];
  for (const poly of polys) {
    const c = poly.map(P3), m = c.reduce((s, p) => [s[0] + p[0] / c.length, s[1] + p[1] / c.length], [0, 0]);
    // the underside: the same outline a thickness lower, wound the other way (its face looks down)
    under.push(c.map((p) => [p[0], p[1], r3(p[2] - T)]).reverse());
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      if (counts.get(key(a, b)) !== 1) continue;
      // a free edge: its band faces level and away from its polygon's middle
      const ex = b[0] - a[0], ey = b[1] - a[1], mx = (a[0] + b[0]) / 2 - m[0], my = (a[1] + b[1]) / 2 - m[1];
      let nx = ey, ny = -ex;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      const l = Math.hypot(nx, ny) || 1;
      edges.push({ corners: [a, b, [b[0], b[1], r3(b[2] - T)], [a[0], a[1], r3(a[2] - T)]], out: [r3(nx / l), r3(ny / l), 0] });
    }
  }
  return { under, edges };
}

/** The edges of `polys` that no second polygon shares (a closed solid has none). */
export function openEdges(polys) {
  return [...edgeCounts(polys)].filter(([, n]) => n === 1).map(([k]) => k);
}

/** Whether a world recipe builds buildings: a stage's `buildings` or `town`, the geocube kind's town. */
export function buildsBuildings(m) {
  if (!m || typeof m !== 'object') return false;
  if (m.kind === 'stage') return m.buildings !== undefined || m.town !== undefined;
  if (m.kind === 'geocube') return m.show === 'town';
  return false;
}

/** A NEW world recipe that builds is solid from its mint (`solid: true`), unless it says; an edit or a restore keeps the
 *  row's own (the caller stamps only a new mint), so a row minted before keeps its bytes. */
export const stampSolid = (m) => (buildsBuildings(m) && m.solid === undefined ? { ...m, solid: true } : m);
