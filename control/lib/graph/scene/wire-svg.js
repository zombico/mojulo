/**
 * wire-svg — hidden-line WIRE drawing of a face list through a physical pinhole camera.
 *
 * The native port of the spatial-wire contract in docs/planar-drawing-svg.md (the Python
 * reference generator in docs/examples/raccoon-head-wire/build-wire.py is the fixture this is
 * pinned against): every stroke is a projection of a persistent spatial edge, visibility is
 * resolved against the source triangles with perspective-correct depth at half-pixel samples,
 * strokes split at visibility changes, and the drawing carries its source and camera as
 * metadata so a stroke maps back to its edge and 3D parameter interval.
 *
 * Camera basis: PHYSICAL (right = forward × worldUp, up = right × forward), i.e. the picture
 * three.js, the GLB root and every engine leg show for one worldFraming. `resolveCameraBasis`
 * in pure-mandala (the CSS3D and scaffold-SVG renderers) takes right = worldUp × forward, the
 * horizontal MIRROR of this; those renderers keep their pinned bytes and are documented as
 * mirrored. The wire view is the one that matches the model.
 *
 * Line rules (the reference policy, not universal anatomy): an edge is drawn when it is a
 * boundary, a crease over `creaseDegrees`, a group boundary, a silhouette (facing flips across
 * it) or a declared feature edge. Weight: outline (silhouette) > feature (a face in `features`
 * or a declared feature edge) > plane. Coplanar internal tessellation is suppressed.
 *
 * Pure: no DB, no IO, no randomness. Deterministic byte output for identical input.
 */

const SAMPLES_PER_PX = 2;          // half-pixel spacing along each projected edge
const MIN_RUN_PX = 0.7;            // runs shorter than this are dropped
const DEPTH_TOL = 1e-5;            // world-unit tolerance against covering triangles
const BARY_EPS = -1e-8;
export const WIRE_STYLES = { outline: ['#253744', 2.7], feature: ['#344b59', 2.0], plane: ['#82939c', 1.05] };
const HIDDEN_STYLE = ['#c7cccd', 0.8];
const TYPE_ORDER = ['plane', 'feature', 'outline'];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** Orbit camera in the reference convention: az about z (0 = south of the target looking north,
 *  image-right = (cos az, sin az)), el above the horizon, `distance` from `target`, `f` px at `size`. */
export function orbitCamera({ azimuthDegrees = 150, elevationDegrees = 10, target = [0, 0, 0], distance = 1, focalPixels = 1400, size = 900 } = {}) {
  const a = azimuthDegrees * Math.PI / 180; const e = elevationDegrees * Math.PI / 180;
  const position = [target[0] + distance * Math.cos(e) * Math.sin(a), target[1] - distance * Math.cos(e) * Math.cos(a), target[2] + distance * Math.sin(e)];
  const R = [[Math.cos(a), Math.sin(a), 0], [Math.sin(e) * Math.sin(a), -Math.sin(e) * Math.cos(a), -Math.cos(e)], [-Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), -Math.sin(e)]];
  return { position, R, f: focalPixels, principal: [size / 2, size / 2], size, meta: { azimuthDegrees, elevationDegrees, target, distance, focalPixels } };
}

/** The same camera from a mojulo `worldFraming` primitive, through the PHYSICAL basis. */
export function worldFramingCamera(cameraPrimitive = {}, { size = 900 } = {}) {
  const wf = cameraPrimitive.worldFraming || {}; const W = cameraPrimitive.viewBox?.width || size; const H = cameraPrimitive.viewBox?.height || size;
  const position = wf.cameraPosition; const lookAt = wf.lookAt;
  if (!Array.isArray(position) || !Array.isArray(lookAt)) throw new Error('wire-svg: worldFraming needs cameraPosition and lookAt');
  const hfov = Number.isFinite(wf.horizontalFov) ? wf.horizontalFov : 60;
  const f = W / (2 * Math.tan((hfov * Math.PI / 180) / 2));
  const forward = norm(sub(lookAt, position)); let right = norm(cross(forward, [0, 0, 1])); if (Math.hypot(...right) < 1e-9) right = [1, 0, 0];
  const up = cross(right, forward);
  return { position, R: [right, up.map((x) => -x), forward], f, principal: [W / 2, H / 2], size: Math.max(W, H), meta: { worldFraming: wf, basis: 'physical' } };
}

/** Project vertices: [x_px, y_px, depth]. Throws when any vertex sits at or behind the camera. */
export function projectVertices(vertices, cam) {
  const out = new Array(vertices.length);
  for (let i = 0; i < vertices.length; i++) {
    const d = sub(vertices[i], cam.position); const c = [dot(cam.R[0], d), dot(cam.R[1], d), dot(cam.R[2], d)];
    if (!(c[2] > 0)) throw new Error('wire-svg: source behind camera; near-plane clipping not supported');
    out[i] = [cam.principal[0] + cam.f * c[0] / c[2], cam.principal[1] + cam.f * c[1] / c[2], c[2]];
  }
  return out;
}

/** Weld a `lowerObjectFaces`-shaped list ({ corners, group? }) into the indexed source the wire
 *  emitter consumes. Triangulates n-gons as fans; groups default to `groupOf(face)`. */
export function weldFaces(faces, { groupOf = (f) => f.group ?? f.part ?? f.tint ?? '' } = {}) {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; }
  const eps = Math.max(1e-9, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1e-6);
  const key = new Map(); const vertices = []; const tris = []; const groups = [];
  const id = (p) => { const k = `${Math.round(p[0] / eps)},${Math.round(p[1] / eps)},${Math.round(p[2] / eps)}`; let i = key.get(k); if (i === undefined) { i = vertices.length; key.set(k, i); vertices.push([p[0], p[1], p[2]]); } return i; };
  for (const f of faces) {
    const ids = []; for (const c of f.corners) { const i = id(c); if (!ids.length || ids[ids.length - 1] !== i) ids.push(i); }
    if (ids.length > 1 && ids[0] === ids[ids.length - 1]) ids.pop(); if (ids.length < 3) continue;
    for (let k = 1; k + 1 < ids.length; k++) { tris.push([ids[0], ids[k], ids[k + 1]]); groups.push(String(groupOf(f))); }
  }
  return { vertices, faces: tris, groups };
}

/**
 * The runs: every drawn edge split into visible / hidden stretches.
 * @param {{vertices:number[][], faces:number[][], groups:string[], featureEdges?:number[][]}} source
 * @param cam from orbitCamera / worldFramingCamera
 * @returns {Array<{edge:[a,b], type, visible, screenT:[t0,t1], xyzT:[t0,t1], xy:[[x,y],[x,y]]}>}
 */
export function wireRuns(source, cam, { features = [], creaseDegrees = 7 } = {}) {
  const V = source.vertices; const F = source.faces; const G = source.groups || [];
  const featureSet = new Set(features); const featureEdges = new Set((source.featureEdges || []).map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`)));
  const N = []; const cent = []; const edges = new Map();
  for (let j = 0; j < F.length; j++) {
    const f = F[j]; const p = f.map((i) => V[i]); N.push(norm(cross(sub(p[1], p[0]), sub(p[2], p[0]))));
    const c = [0, 0, 0]; for (const q of p) { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; } cent.push([c[0] / p.length, c[1] / p.length, c[2] / p.length]);
    for (let k = 0; k < f.length; k++) { const a = f[k]; const b = f[(k + 1) % f.length]; const key = a < b ? `${a}|${b}` : `${b}|${a}`; (edges.get(key) || edges.set(key, []).get(key)).push(j); }
  }
  const q = projectVertices(V, cam);
  const tris = []; for (const f of F) for (let k = 1; k + 1 < f.length; k++) tris.push([q[f[0]], q[f[k]], q[f[k + 1]]]);
  const grid = triangleGrid(tris);
  const facing = N.map((n, j) => dot(n, sub(cam.position, cent[j])));
  const cosCrease = Math.cos(creaseDegrees * Math.PI / 180);
  const paths = [];
  for (const [key, fs] of edges) {
    const [a, b] = key.split('|').map(Number);
    const groups = new Set(fs.map((i) => G[i])); const boundary = fs.length === 1;
    const crease = boundary || fs.slice(1).some((j) => Math.abs(dot(N[fs[0]], N[j])) < cosCrease);
    let mn = Infinity; let mx = -Infinity; for (const j of fs) { if (facing[j] < mn) mn = facing[j]; if (facing[j] > mx) mx = facing[j]; }
    const silhouette = boundary || (mn < 0 && 0 < mx);
    const declared = featureEdges.has(key);
    const feature = [...groups].some((g) => featureSet.has(g)) || declared;
    if (!(crease || groups.size > 1 || silhouette || declared)) continue;
    const type = silhouette ? 'outline' : feature ? 'feature' : 'plane';
    const pa = q[a]; const pb = q[b]; const length = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    const steps = Math.max(2, Math.trunc(length * SAMPLES_PER_PX) + 1); const step = 1 / (steps - 1);
    const t = new Array(steps); const xy = new Array(steps); const z = new Array(steps); const seen = new Array(steps);
    for (let i = 0; i < steps; i++) {
      t[i] = i * step; xy[i] = [pa[0] + t[i] * (pb[0] - pa[0]), pa[1] + t[i] * (pb[1] - pa[1])]; z[i] = 1 / ((1 - t[i]) / pa[2] + t[i] / pb[2]);
      seen[i] = visibleAt(xy[i][0], xy[i][1], z[i], grid.at(xy[i][0], xy[i][1]));
    }
    let start = 0;
    for (let j = 1; j <= steps; j++) {
      if (j === steps || seen[j] !== seen[start]) {
        const end = j - 1;
        if (end > start && Math.hypot(xy[end][0] - xy[start][0], xy[end][1] - xy[start][1]) > MIN_RUN_PX) {
          const xyzT = [start, end].map((k) => (t[k] / pb[2]) / ((1 - t[k]) / pa[2] + t[k] / pb[2]));
          paths.push({ edge: [a, b], type, visible: seen[start], screenT: [t[start], t[end]], xyzT, xy: [xy[start], xy[end]] });
        }
        start = j;
      }
    }
  }
  return paths;
}

/**
 * A screen-space bucket grid over the projected triangles: each cell lists, in their original order, the triangles
 * whose bounding box (grown a pixel) touches it. A sample tests only its cell's list — the triangles that can contain
 * it — so the depth test's answer is the one a test against every triangle gives, at a fraction of the cost.
 */
function triangleGrid(tris, cellPx = 24) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of tris) for (const v of p) { if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0]; if (v[1] < y0) y0 = v[1]; if (v[1] > y1) y1 = v[1]; }
  if (!tris.length) return { at: () => tris };
  const nx = Math.max(1, Math.min(512, Math.ceil((x1 - x0 + 2) / cellPx))), ny = Math.max(1, Math.min(512, Math.ceil((y1 - y0 + 2) / cellPx)));
  const cw = (x1 - x0 + 2) / nx, ch = (y1 - y0 + 2) / ny, ox = x0 - 1, oy = y0 - 1;
  const cells = Array.from({ length: nx * ny }, () => []);
  const clampX = (v) => Math.max(0, Math.min(nx - 1, v)), clampY = (v) => Math.max(0, Math.min(ny - 1, v));
  tris.forEach((p) => {
    const a = clampX(Math.floor((Math.min(p[0][0], p[1][0], p[2][0]) - 1 - ox) / cw)), b = clampX(Math.floor((Math.max(p[0][0], p[1][0], p[2][0]) + 1 - ox) / cw));
    const c = clampY(Math.floor((Math.min(p[0][1], p[1][1], p[2][1]) - 1 - oy) / ch)), d = clampY(Math.floor((Math.max(p[0][1], p[1][1], p[2][1]) + 1 - oy) / ch));
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) cells[j * nx + i].push(p);
  });
  const none = [];
  return { at: (x, y) => { const i = Math.floor((x - ox) / cw), j = Math.floor((y - oy) / ch); return i < 0 || j < 0 || i >= nx || j >= ny ? none : cells[j * nx + i]; } };
}

// depth test at one projected sample against every triangle, perspective-correct (harmonic) depth
function visibleAt(x, y, z, tris) {
  let nearest = Infinity;
  for (const p of tris) {
    const den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
    if (Math.abs(den) <= 1e-12) continue;
    const ba = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / den;
    const bb = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / den;
    const bc = 1 - ba - bb;
    if (ba >= BARY_EPS && bb >= BARY_EPS && bc >= BARY_EPS) { const d = 1 / (ba / p[0][2] + bb / p[1][2] + bc / p[2][2]); if (d < nearest) nearest = d; }
  }
  return z <= nearest + DEPTH_TOL;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const sortedJson = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v);

/**
 * The SVG. `hidden: true` is construction mode (hidden runs faint and dashed, behind visible lines).
 * `source` is embedded whole as `<metadata id="spatial-source">`; the camera as `<metadata id="projection">`.
 */
export function wireSvg(source, cam, { features = [], creaseDegrees = 7, hidden = false, title = 'spatial wire drawing', background = '#f7f5ef', embedSource = true } = {}) {
  const paths = wireRuns(source, cam, { features, creaseDegrees });
  const W = cam.size;
  const s = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}"><title>${esc(title)}</title>`];
  if (embedSource) s.push(`<metadata id="spatial-source">${esc(JSON.stringify(source))}</metadata>`);
  s.push(`<rect width="${W}" height="${W}" fill="${background}"/>`);
  const projection = { ...cam.meta, principal: cam.principal, viewBox: [0, 0, W, W], basis: 'physical right=forward cross world-up; SVG y down', visibility: `half-pixel samples; perspective-correct triangle depth; tolerance ${DEPTH_TOL} world units`, hiddenEdges: hidden, creaseDegrees, features };
  s.push(`<metadata id="projection">${esc(sortedJson(projection))}</metadata>`);
  const ordered = paths.map((p, i) => [p, i]).sort(([p, i], [r, j]) => (Number(p.visible) - Number(r.visible)) || (TYPE_ORDER.indexOf(p.type) - TYPE_ORDER.indexOf(r.type)) || (i - j)).map(([p]) => p);
  ordered.forEach((p, j) => {
    if (!p.visible && !hidden) return;
    const [col, width] = p.visible ? WIRE_STYLES[p.type] : HIDDEN_STYLE; const [[x, y], [u, v]] = p.xy; const dash = p.visible ? '' : ' stroke-dasharray="3 5"';
    const ids = source.pointIds ? ` data-point-ids="${esc(p.edge.map((i) => source.pointIds[i]).join(' '))}"` : '';
    s.push(`<path${ids} id="edge-${p.edge[0]}-${p.edge[1]}-run-${j}" data-spatial-edge="${p.edge[0]} ${p.edge[1]}" data-visible="${p.visible}" data-source-t="${p.xyzT[0].toFixed(10)} ${p.xyzT[1].toFixed(10)}" data-edge-role="${p.type}" d="M${x.toFixed(3)},${y.toFixed(3)} L${u.toFixed(3)},${v.toFixed(3)}" fill="none" stroke="${col}" stroke-width="${width}" stroke-linecap="round"${dash}/>`);
  });
  return `${s.join('')}</svg>`;
}

/** Framing that keeps a source in frame under a full orbit: target = bbox centre; distance = the
 *  bounding sphere's keep-in-frame distance for this lens (radius / sin(half-fov)) × `margin`, or an
 *  explicit `distanceMultiplier` × radius. */
export function frameSource(source, { distanceMultiplier = null, focalPixels = 1400, size = 900, margin = 1.08 } = {}) {
  const lo = [Infinity, Infinity, Infinity]; const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of source.vertices) for (let k = 0; k < 3; k++) { if (v[k] < lo[k]) lo[k] = v[k]; if (v[k] > hi[k]) hi[k] = v[k]; }
  const target = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  let radius = 0; for (const v of source.vertices) radius = Math.max(radius, Math.hypot(v[0] - target[0], v[1] - target[1], v[2] - target[2]));
  const k = Number.isFinite(distanceMultiplier) ? distanceMultiplier : margin / Math.sin(Math.atan(size / (2 * focalPixels)));
  return { target, distance: k * radius, radius, distanceMultiplier: k };
}
