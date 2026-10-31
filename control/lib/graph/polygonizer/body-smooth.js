/** body-smooth.js — THE BODY ROUNDED: a compiled layered mesh's body skin split once, each triangle into four, its new
 * points on the curved patch the corners' normals describe (the curved PN triangle's edge: the cubic through two corners
 * whose tangents lie in each corner's tangent plane), so the body reads as one rounded form rather than its rings'
 * facets, as the anime face does.
 *
 * The corners stay where they are, byte for byte: a joint, a pinned part's seat and a corner's bind keep their places.
 * A new point is appended after every point the mesh had, its provenance its edge's first corner's, with `mix` naming
 * the two corners it lies between (station-loft-rig.js bindLayered weighs it as their mean). The normals the patch
 * reads are the body's welded ones: area-weighted over every body triangle at a corner's place, so two parts meeting on
 * a seam (the torso and the pelvis, the neck) curve as one. An edge on the body's border (a part's open rim) is split
 * on its straight line. Only the parts named are split; every other part and every point's index are as they were.
 * Pure: no dice. */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** the weld key of a place (points within 1e-5 of each other share their normal) */
const keyOf = (p) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)},${Math.round(p[2] * 1e5)}`;

/** the curved patch's point midway along the edge (a, b), with unit normals na, nb at its ends */
export function curvedMidpoint(a, b, na, nb) {
  const e = sub(b, a), wa = dot(e, na), wb = -dot(e, nb);
  // the cubic's control points b210 = (2a + b − wa·na) / 3 and b120 = (2b + a − wb·nb) / 3; its midpoint
  // (a + 3·b210 + 3·b120 + b) / 8 = (a + b) / 2 − (wa·na + wb·nb) / 8 (on a convex form both w ≤ 0: the point stands out)
  return [0, 1, 2].map((k) => r6((a[k] + b[k]) / 2 - (wa * na[k] + wb * nb[k]) / 8));
}

/**
 * The mesh with its named parts' triangles split once. `mesh` a compiled layered mesh (station-loft.js compileLayered),
 * `parts` the names of the parts split (a Set or an array). Returns a new mesh: the points it had, then the new ones;
 * the split parts' faces replaced by their four each (in their place in the face list, `<face id>.0 … .3`), every other
 * face as it was.
 */
export function smoothBody(mesh, parts) {
  const P = parts instanceof Set ? parts : new Set(parts);
  const V = mesh.vertices, F = mesh.faces, prov = mesh.provenance;
  const isBody = F.map((f) => P.has(prov[f[0]].part));
  // the body's welded normals: area-weighted over every body triangle at a corner's place
  const acc = new Map();
  F.forEach((f, fi) => {
    if (!isBody[fi]) return;
    const n = cross(sub(V[f[1]], V[f[0]]), sub(V[f[2]], V[f[0]]));
    for (const v of f) { const k = keyOf(V[v]); const s = acc.get(k); if (s) { s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; } else acc.set(k, [...n]); }
  });
  const normalOf = (v) => unit(acc.get(keyOf(V[v])));
  // the body's border: an edge one body triangle uses (by its corners' places, so a seam two parts share is inside)
  const placeEdge = (a, b) => { const ka = keyOf(V[a]), kb = keyOf(V[b]); return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`; };
  const uses = new Map();
  F.forEach((f, fi) => { if (isBody[fi]) for (let k = 0; k < 3; k++) { const e = placeEdge(f[k], f[(k + 1) % 3]); uses.set(e, (uses.get(e) ?? 0) + 1); } });
  const vertices = V.slice(), provenance = prov.slice(), pointIds = mesh.pointIds.slice(), faces = [], faceIds = [], groups = [];
  const mids = new Map();
  // the edge's new point, once per edge of a part (two parts meeting on a seam each split it at the same place)
  const midOf = (a, b) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`; const got = mids.get(key); if (got !== undefined) return got;
    const border = uses.get(placeEdge(a, b)) === 1;
    const p = border ? [0, 1, 2].map((k) => r6((V[a][k] + V[b][k]) / 2)) : curvedMidpoint(V[a], V[b], normalOf(a), normalOf(b));
    const i = vertices.length, lo = a < b ? a : b, hi = a < b ? b : a;
    vertices.push(p); pointIds.push(`${mesh.pointIds[lo]}~${mesh.pointIds[hi]}`);
    provenance.push({ ...prov[lo], id: `${prov[lo].id}~${prov[hi].id}`, mix: [lo, hi] });
    mids.set(key, i); return i;
  };
  F.forEach((f, fi) => {
    if (!isBody[fi]) { faces.push(f); faceIds.push(mesh.faceIds[fi]); groups.push(mesh.groups[fi]); return; }
    const [a, b, c] = f, ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
    for (const [k, t] of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]].entries()) { faces.push(t); faceIds.push(`${mesh.faceIds[fi]}.${k}`); groups.push(mesh.groups[fi]); }
  });
  return { ...mesh, vertices, faces, groups, pointIds, faceIds, provenance, smoothed: { parts: [...P].sort(), points: V.length } };
}

/** the hero's body parts a smoothing splits: every layer-1 part but the head's carrier (`cranium`) */
export const bodyPartsOf = (recipe) => Object.entries(recipe.parts).filter(([n, p]) => p.layer === 1 && n !== 'cranium').map(([n]) => n);
