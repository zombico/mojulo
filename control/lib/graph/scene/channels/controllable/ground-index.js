/**
 * THE GROUND'S INDEX — the walker's ground probe (`__ground`, a straight-down ray under each walking body every frame)
 * answered from an index of the surfaces it can find, never by walking the whole scene. Every mesh a world ray would
 * test (a mesh whose raycast is three's own or the ground grid's, not a decoration's no-op, not a body's) is baked once
 * into a grid of CELL metres over the world's ground plan, each cell the surfaces whose plan box meets it; a probe reads
 * its cell and tests those few, each a big static one through its own triangle grid (ground-grid.js). What it finds is
 * what the full-scene ray found, at the cost of a lookup. The bake is redone when the set of such meshes changes (the
 * page asks again whenever the scene's top changes and every so many probes, as the grid's own indexing does), and a mesh
 * that has moved since the bake (its world matrix not the one baked) is noticed once a frame and tested on every probe
 * wherever it now stands.
 *
 *   indexBuckets(items, cell)   → { x0, y0, cell, nx, ny, cells }   items [{ id, box: [x0, y0, x1, y1] }]: each cell the
 *                                                                    ids whose box meets it (a box past the index's own
 *                                                                    reach is held to its edge cells)
 *   bucketsAt(B, x, y)          → [ids]                              the ids over (x, y), [] off the index
 *   groundIndexScript()         → the page's `__giGround(pos, own)`  (needs the page's THREE, scene, camera, __rayRoots,
 *                                                                    __world and the ground grid's script)
 *
 * Pure (the page emits these by their source).
 */

export const GROUND_INDEX = Object.freeze({ cell: 4, most: 400 });

/** A plan's buckets: each `cell` m square the ids whose box meets it. A box larger than `most` cells a side (a far land's
 * ring, a sky's floor) is kept apart and listed in every cell, so the index stays the world's play area's size. */
export function indexBuckets(items, cell = 4, most = 400) {   // (GROUND_INDEX's, inline: the page runs this by its source)
  const small = [], wide = [];
  for (const it of items) ((it.box[2] - it.box[0]) / cell > most || (it.box[3] - it.box[1]) / cell > most ? wide : small).push(it);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of small) { x0 = Math.min(x0, it.box[0]); y0 = Math.min(y0, it.box[1]); x1 = Math.max(x1, it.box[2]); y1 = Math.max(y1, it.box[3]); }
  if (!small.length) { x0 = y0 = 0; x1 = y1 = cell; }
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell) + 1), ny = Math.max(1, Math.ceil((y1 - y0) / cell) + 1);
  const cells = new Array(nx * ny);
  for (const it of small) {
    const i0 = Math.max(0, Math.floor((it.box[0] - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((it.box[2] - x0) / cell));
    const j0 = Math.max(0, Math.floor((it.box[1] - y0) / cell)), j1 = Math.min(ny - 1, Math.floor((it.box[3] - y0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) (cells[j * nx + i] ??= []).push(it.id);
  }
  return { x0, y0, cell, nx, ny, cells, wide: wide.map((it) => it.id) };
}

/** The ids over (x, y): its cell's, and every wide one's. */
export function bucketsAt(B, x, y) {
  const i = Math.floor((x - B.x0) / B.cell), j = Math.floor((y - B.y0) / B.cell);
  const own = i < 0 || j < 0 || i >= B.nx || j >= B.ny ? null : B.cells[j * B.nx + i];
  return own ? (B.wide.length ? own.concat(B.wide) : own) : B.wide;
}

export function groundIndexScript() {
  return `
// THE GROUND'S INDEX (ground-index.js): the ground probe reads the surfaces over its cell, never the whole scene
const __giBuckets = ${indexBuckets.toString()};
const __giAt = ${bucketsAt.toString()};
const __GI = { key: '', list: [], mats: [], B: null, moved: new Set(), seen: null, ray: new THREE.Raycaster(), box: new THREE.Box3() };
// (what a world ray would test: a mesh whose raycast is three's own or the ground grid's; a decoration's no-op, a sprite
// or a line never footing)
const __giRays = new Set([THREE.Mesh.prototype.raycast, THREE.SkinnedMesh.prototype.raycast, THREE.InstancedMesh.prototype.raycast, typeof __gridRaycast === 'function' ? __gridRaycast : null]);
function __giBake(own) {
  const list = [];
  for (const r of __rayRoots(own)) r.traverse((m) => { if (m.isMesh && m.geometry && m.geometry.attributes && m.geometry.attributes.position && __giRays.has(m.raycast)) list.push(m); });
  let key = list.length + ':'; for (const m of list) key += m.id + ',';
  if (key === __GI.key) return;
  __GI.key = key; __GI.list = list; __GI.moved = new Set();
  __GI.mats = list.map((m) => { m.updateWorldMatrix(true, false); return m.matrixWorld.clone(); });
  const B = __GI.box, items = list.map((m, id) => {
    if (m.isInstancedMesh) { m.computeBoundingBox(); B.copy(m.boundingBox).applyMatrix4(m.matrixWorld); }
    else { const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox(); B.copy(g.boundingBox).applyMatrix4(m.matrixWorld); }
    return { id, box: [B.min.x, B.min.y, B.max.x, B.max.y] };
  });
  __GI.B = __giBuckets(items);
}
// (a surface that has moved since the bake: noticed once a frame, and tested on every probe wherever it now stands)
function __giWatch() {
  const t = __world.time; if (t === __GI.seen) return; __GI.seen = t;
  const L = __GI.list, M = __GI.mats;
  for (let i = 0; i < L.length; i++) if (!__GI.moved.has(i) && !L[i].matrixWorld.equals(M[i])) __GI.moved.add(i);
}
// the ground under pos: the first surface a ray straight down from it meets, as the full-scene ray found it
function __giGround(pos, own) {
  if (!__GI.B) __giBake(own);
  __giWatch();
  const cand = [];
  for (const i of __giAt(__GI.B, pos[0], pos[1])) if (!__GI.moved.has(i)) cand.push(__GI.list[i]);
  for (const i of __GI.moved) cand.push(__GI.list[i]);
  if (!cand.length) return null;
  const R = __GI.ray;
  R.set(new THREE.Vector3(pos[0], pos[1], pos[2] + 0.05), new THREE.Vector3(0, 0, -1)); R.camera = camera;
  for (const hit of R.intersectObjects(cand, false)) { if (!hit.object.isMesh) continue; let o = hit.object; while (o) { if (own.includes(o)) break; o = o.parent; } if (!o) return hit.point.z; }
  return null;
}
`;
}
