// floorplan-world — the one reflection between a floor plan and the world it is built in.
//
// A plan is authored as it is drawn: x east, y SOUTH (the plan card reads y down, north at the top, a
// door on edge 'S' sits at the largest y). The world is z-up and right-handed, where north is +y. Copying
// plan (x, y) straight into world (x, y) built every house as the MIRROR of its plan. Everything inside the
// floorplan family keeps working in the plan frame (wall and facing letters, glyph layouts, furnishing, the
// plan card); each assembler hands its finished payload through `planToWorld` once, on the way out.
//
// The reflection is world y = −plan y. On a face: corners reflect and their order reverses so the winding
// (and with it every derived normal, `singleSide` cull and GLB normal) still faces out; explicit normals
// reflect; per-corner arrays follow their corners; an explicit `uv` mirrors in u so a texture reads the right
// way round; a CSS `clip` is re-measured on the new corner frame. Positions (cameras, spawn, lights, repeat
// placements, item refs) reflect; angles about z (walk yaw, rotZ) change sign; an item ref's facing becomes a
// world angle, its own mesh placed true-handed.

const PER_CORNER = ['uv', 'vao', 'cornerFills'];
const ry = (p) => (Array.isArray(p) && p.length >= 2 ? [p[0], -p[1], ...p.slice(2)] : p);
const neg = (a) => (Number.isFinite(a) ? -a : a);

// The new corner order: [c1, c0, c(n−1) … c2]. For a quad that is [c1, c0, c3, c2], which keeps the second
// edge's direction (the CSS/default-uv v axis) and turns the first (u), so an unmapped texture reads true.
// A triangle carried as 4 corners whose last repeats the first keeps that encoding.
function cornerOrder(c) {
  const n = c.length;
  if (n === 4 && sameAt(c, 3, 0)) return [1, 0, 2, 1];
  const ix = [1, 0];
  for (let i = n - 1; i >= 2; i--) ix.push(i);
  return n >= 2 ? ix : [0];
}
function sameAt(c, i, j) {
  const a = c[i], b = c[j];
  return Array.isArray(a) && Array.isArray(b) && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 && Math.abs((a[2] || 0) - (b[2] || 0)) < 1e-9;
}

// The CSS clip of a quad, in the % of its own c0→c1 × c0→c3 frame (the formula roof.js mints it with).
function clipFor(c4) {
  const O = c4[0], U = [c4[1][0] - O[0], c4[1][1] - O[1], c4[1][2] - O[2]], V = [c4[3][0] - O[0], c4[3][1] - O[1], c4[3][2] - O[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const uu = dot(U, U), vv = dot(V, V), uv = dot(U, V), det = uu * vv - uv * uv || 1;
  const poly = c4.map((p) => { const d = [p[0] - O[0], p[1] - O[1], p[2] - O[2]], du = dot(d, U), dv = dot(d, V); return [(vv * du - uv * dv) / det, (uu * dv - uv * du) / det]; });
  return 'polygon(' + poly.map(([u, v]) => `${(u * 100).toFixed(2)}% ${(v * 100).toFixed(2)}%`).join(',') + ')';
}

/** One face, plan frame → world frame. */
export function reflectFace(f) {
  if (!f || !Array.isArray(f.corners)) return f;
  const order = cornerOrder(f.corners);
  const out = { ...f, corners: order.map((i) => ry(f.corners[i])) };
  for (const k of PER_CORNER) if (Array.isArray(f[k]) && f[k].length === f.corners.length) out[k] = order.map((i) => f[k][i]);
  if (Array.isArray(out.uv)) out.uv = out.uv.map((t) => (Array.isArray(t) ? [1 - t[0], t[1]] : t));
  if (f.normal) out.normal = ry(f.normal);
  if (f.outNormal) out.outNormal = ry(f.outNormal);
  if (typeof f.clip === 'string' && out.corners.length === 4) out.clip = clipFor(out.corners);
  return out;
}

const reflectCamera = (c) => (c && c.worldFraming
  ? { ...c, worldFraming: { ...c.worldFraming, ...(c.worldFraming.cameraPosition ? { cameraPosition: ry(c.worldFraming.cameraPosition) } : {}), ...(c.worldFraming.lookAt ? { lookAt: ry(c.worldFraming.lookAt) } : {}) } }
  : c);

/** A walk option, plan frame → world frame (spawn reflects, yaw — counter-clockwise from +x — negates). */
export function reflectWalk(w) {
  if (!w || typeof w !== 'object') return w;
  return { ...w, ...(w.spawn ? { spawn: ry(w.spawn) } : {}), ...(Number.isFinite(w.yaw) ? { yaw: -w.yaw } : {}) };
}

const reflectLight = (l) => {
  if (!l || typeof l !== 'object') return l;
  const o = { ...l };
  for (const k of ['position', 'target', 'direction', 'dir', 'toLight', 'fillToLight']) if (Array.isArray(l[k])) o[k] = ry(l[k]);
  return o;
};

// An item ref's facing, as the angle that turns its own +y front onto it in the WORLD (N = +y). The ref's
// own mesh is not reflected — it is placed true-handed — and its `turn` corrects that mesh's front in its own
// frame before it is faced, so the turn rides through untouched.
const WORLD_FACING_ANGLE = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 };
const reflectItemRef = (r) => (r && Array.isArray(r.center)
  ? { ...r, center: ry(r.center), facingAngle: WORLD_FACING_ANGLE[r.facing] ?? Math.PI }
  : r);

const reflectRepeat = (r) => (r && typeof r === 'object'
  ? {
    ...r,
    ...(Array.isArray(r.template) ? { template: r.template.map(reflectFace) } : {}),
    ...(Array.isArray(r.transforms) ? { transforms: r.transforms.map((t) => ({ ...t, ...(t.pos ? { pos: ry(t.pos) } : {}), ...(Number.isFinite(t.rotZ) ? { rotZ: -t.rotZ } : {}) })) } : {}),
  }
  : r);

/**
 * A floorplan-family scene payload (faces, cameras, walk, lights, light, repeats, itemRefs), plan frame →
 * world frame. Keys it does not name pass through untouched; the plan-space blobs a payload carries for
 * reports (`structure`, `restaurant`, …) stay in the plan frame they describe. Pure; call it exactly once.
 */
export function planToWorld(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  if (Array.isArray(payload.faces)) out.faces = payload.faces.map(reflectFace);
  if (Array.isArray(payload.cameras)) out.cameras = payload.cameras.map(reflectCamera);
  if (payload.walk && typeof payload.walk === 'object') out.walk = reflectWalk(payload.walk);
  if (Array.isArray(payload.lights)) out.lights = payload.lights.map(reflectLight);
  if (payload.light && typeof payload.light === 'object') out.light = reflectLight(payload.light);
  if (Array.isArray(payload.repeats)) out.repeats = payload.repeats.map(reflectRepeat);
  if (Array.isArray(payload.itemRefs)) out.itemRefs = payload.itemRefs.map(reflectItemRef);
  return out;
}

/** A plan point [x, y, z?] in the world. */
export const planPointToWorld = ry;
