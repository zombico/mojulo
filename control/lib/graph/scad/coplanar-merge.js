/**
 * coplanar-merge — fold a triangle soup's flat regions back into polygons, for the CSS-3D still.
 *
 * OpenSCAD hands back triangles. The three.js World and every mesh export are indifferent, but
 * the CSS-3D scene (the /scene shots and the gallery PNG) paints ONE compositor layer per face,
 * so a 5,000-triangle phone reads as a haze of hairline panels where the workbench's quads read
 * clean. Here the triangles that share a plane, a tint and a group are joined over shared edges,
 * and each connected region becomes one panel: the parallelogram spanning it in-plane plus a
 * `clip` polygon (the emitter's mask for a cap) — concave outlines as they are, holes through an
 * `evenodd` path. A region whose boundary will not walk as simple loops stays as its triangles:
 * correctness first, the merge is a courtesy to the still.
 *
 * Pure and deterministic: keys are quantized coordinates; output order follows input order.
 */

const Q = 1e-4;
const key3 = (p) => `${Math.round(p[0] / Q)},${Math.round(p[1] / Q)},${Math.round(p[2] / Q)}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** The plane key: normal to 1e-3, offset to 1e-3 units. */
function planeKey(rec) {
  const n = rec.normal;
  const d = dot(n, rec.corners[0]);
  return `${Math.round(n[0] * 1000)},${Math.round(n[1] * 1000)},${Math.round(n[2] * 1000)}|${Math.round(d * 1000)}`;
}

/**
 * mergeCoplanarTriangles(records) → records, where a mergeable flat region of triangles
 * `{ corners:[a,b,c], tint, normal, group }` is replaced by ONE `{ corners:[4 parallelogram
 * corners], clip:'polygon(…)', tint, normal, group, merged:<n> }` and everything else passes
 * through unchanged.
 */
export function mergeCoplanarTriangles(records) {
  // 1. bucket by plane + tint + group
  const buckets = new Map();
  records.forEach((r, i) => {
    if (!r || !Array.isArray(r.corners) || r.corners.length !== 3 || !r.normal) return;
    const k = `${planeKey(r)}|${r.tint}|${r.group}`;
    let b = buckets.get(k);
    if (!b) { b = []; buckets.set(k, b); }
    b.push(i);
  });
  const replaced = new Map(); // first index of a component → merged record
  const dropped = new Set();
  for (const idxs of buckets.values()) {
    if (idxs.length < 2) continue;
    for (const comp of components(records, idxs)) {
      if (comp.length < 2) continue;
      const merged = mergeComponent(records, comp);
      if (!merged) continue;
      replaced.set(comp[0], { ...merged, first: comp[0] });
      for (const i of comp.slice(1)) dropped.add(i);
    }
  }
  if (!replaced.size) return records;
  const out = [];
  records.forEach((r, i) => {
    if (dropped.has(i)) return;
    out.push(replaced.get(i) || r);
  });
  return out;
}

/** Connected components of a bucket's triangles over shared (undirected) edges; input order kept. */
function components(records, idxs) {
  const parent = new Map(idxs.map((i) => [i, i]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const byEdge = new Map();
  for (const i of idxs) {
    const c = records[i].corners;
    for (let e = 0; e < 3; e += 1) {
      const a = key3(c[e]), b = key3(c[(e + 1) % 3]);
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      const prev = byEdge.get(ek);
      if (prev !== undefined) union(prev, i); else byEdge.set(ek, i);
    }
  }
  const groups = new Map();
  for (const i of idxs) { const r = find(i); let g = groups.get(r); if (!g) { g = []; groups.set(r, g); } g.push(i); }
  return [...groups.values()];
}

/**
 * One connected coplanar component → a merged panel, or null when its outline is not a set of
 * simple loops. The largest loop is the outline; every other loop is a hole, and the clip is
 * ONE `polygon(evenodd, …)` path that visits the outline, then each hole over a doubled bridge
 * from the outline's first point (the bridge cancels under evenodd). Concave outlines are fine:
 * a simple loop is a valid clip. What is refused: a pinched vertex (two boundary edges leaving
 * one point), a broken walk, or fewer than three corners.
 */
function mergeComponent(records, comp) {
  const seen = new Map(); // undirected key → count
  const pts = new Map();
  for (const i of comp) {
    const c = records[i].corners;
    for (let e = 0; e < 3; e += 1) {
      const A = c[e], B = c[(e + 1) % 3];
      const a = key3(A), b = key3(B);
      pts.set(a, A); pts.set(b, B);
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      seen.set(ek, (seen.get(ek) || 0) + 1);
    }
  }
  // directed boundary edges, in each triangle's own winding
  const directed = new Map();
  for (const i of comp) {
    const c = records[i].corners;
    for (let e = 0; e < 3; e += 1) {
      const a = key3(c[e]), b = key3(c[(e + 1) % 3]);
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.get(ek) !== 1) continue;
      if (directed.has(a)) return null; // a pinched outline
      directed.set(a, b);
    }
  }
  if (directed.size < 3) return null;
  // walk every loop
  const loops = [];
  const visited = new Set();
  for (const start of directed.keys()) {
    if (visited.has(start)) continue;
    const loop = [];
    let cur = start;
    do {
      visited.add(cur);
      loop.push(pts.get(cur));
      cur = directed.get(cur);
      if (cur === undefined || loop.length > directed.size) return null;
    } while (cur !== start);
    if (loop.length < 3) return null;
    loops.push(loop);
  }
  const n = records[comp[0]].normal;
  const p0 = loops[0][0];
  const U = norm(sub(loops[0][1], p0));
  const V = norm(cross(n, U));
  const to2 = (p) => { const d = sub(p, p0); return [dot(d, U), dot(d, V)]; };
  // per loop: 2D points with collinear corners dropped, and the signed area
  const flat = loops.map((loop) => {
    const uv = loop.map(to2);
    const kept = [];
    for (let i = 0; i < uv.length; i += 1) {
      const a = uv[(i - 1 + uv.length) % uv.length], b = uv[i], c = uv[(i + 1) % uv.length];
      const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(z) > 1e-9) kept.push(b);
    }
    let area = 0;
    for (let i = 0; i < kept.length; i += 1) { const a = kept[i], b = kept[(i + 1) % kept.length]; area += a[0] * b[1] - b[0] * a[1]; }
    return { uv: kept, area: Math.abs(area) / 2 };
  });
  if (flat.some((l) => l.uv.length < 3)) return null;
  flat.sort((a, b) => b.area - a.area);
  const outer = flat[0].uv, holes = flat.slice(1).map((l) => l.uv);
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const [u, v] of outer) { if (u < umin) umin = u; if (u > umax) umax = u; if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
  const du = umax - umin || 1, dv = vmax - vmin || 1;
  const O = add(p0, add(mul(U, umin), mul(V, vmin)));
  const corners = [O, add(O, mul(U, du)), add(O, add(mul(U, du), mul(V, dv))), add(O, mul(V, dv))];
  const pct = ([u, v]) => `${(((u - umin) / du) * 100).toFixed(1)}% ${(((v - vmin) / dv) * 100).toFixed(1)}%`;
  const path = [...outer.map(pct)];
  for (const h of holes) path.push(pct(outer[0]), ...h.map(pct), pct(h[0]));
  const clip = holes.length ? `polygon(evenodd, ${path.join(', ')})` : `polygon(${path.join(', ')})`;
  const first = records[comp[0]];
  return { corners, clip, tint: first.tint, normal: n, group: first.group, merged: comp.length, ...(holes.length ? { holes: holes.length } : {}) };
}

/**
 * mergeExactFaces(faces) → faces: the same fold over an already-SHADED face list — the exact
 * field kernel's output (field-exact.js), which is triangles carrying `fill` and `outNormal`.
 * Only faces flagged `exact` are folded (by plane + fill + group); every other face passes
 * through untouched, so a recipe without an exact field emits byte for byte. Merged panels and
 * the exact triangles that stay are flagged `noInflate`: the emitter's seam-hiding grow is for
 * hairline tiles, and a 5% grow of a 120 mm sliver throws it out of its plane.
 */
export function mergeExactFaces(faces) {
  if (!faces.some((f) => f && f.exact === true)) return faces;
  const records = [];
  const slotOf = [];   // record index → face index
  faces.forEach((f, i) => {
    if (!f || f.exact !== true || !Array.isArray(f.corners) || !f.outNormal) return;
    records.push({ corners: f.corners.slice(0, 3), tint: f.fill, normal: f.outNormal, group: f.group });
    slotOf.push(i);
  });
  const merged = mergeCoplanarTriangles(records);
  const identity = new Map(records.map((r, k) => [r, k]));
  const replacement = new Map(); // face index → the record to emit there
  for (const m of merged) {
    const k = m.first !== undefined ? m.first : identity.get(m);
    if (k !== undefined) replacement.set(slotOf[k], m);
  }
  const out = [];
  faces.forEach((f, i) => {
    if (!f || f.exact !== true) { out.push(f); return; }
    const m = replacement.get(i);
    if (!m) return; // folded into a neighbour's panel
    if (m.merged) out.push({ corners: m.corners, fill: m.tint, clip: m.clip, doubleSided: true, outNormal: m.normal, group: m.group, exact: true, noInflate: true });
    else out.push({ ...f, noInflate: true });
  });
  return out;
}
