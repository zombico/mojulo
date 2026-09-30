// polygonizer/bark-skin — the trees' bark on any lathe or loft: `bark: 'oak' | { species, tile? }` on the monomer.
//
// The tile is vegetation/tiles.js `barkTile` — bark grown by the fracture model (vegetation/bark.js), periodic both
// ways, so it runs round and up a stem without a seam. A barked face carries `texture: 'bark-<species>'`, per-corner
// `uv` in tiles, `textureLit` (the page multiplies the tile by the baked light, so `fill` goes white-lit) and
// `plainFill` (the monomer's own shaded tint, for a consumer without textures). world-scene resolves the key through
// the resolver registered here, as construction/textures.js does for timber.
//   loft on a curved path  side faces are ring-major (k·M + i): u round the stem × its circumference, v arc length —
//                          the parameterization of vegetation/tree-mesh.js barkQuads
//   lathe, straight loft   cylindrical about the axis
// `tile` is the tile's edge in the recipe's units (default 12). Bark's crack spacing scales with the stem's thickness,
// so a staff wants a far smaller tile than a trunk. Absent `bark` → the faces pass through by identity.
import { registerTextureResolver } from '../landscape/surface-textures.js';
import { barkTile } from '../vegetation/tiles.js';
import { BARKS } from '../vegetation/bark.js';
import { shadeHexMat } from './vexar.js';

export const BARK_TEXTURE_PREFIX = 'bark-';
export const BARK_KEYS = Object.freeze(Object.keys(BARKS));
registerTextureResolver(BARK_TEXTURE_PREFIX, (key) => {
  const species = key.slice(BARK_TEXTURE_PREFIX.length);
  return BARKS[species] ? barkTile(species).url : null;
});

const barkOf = (spec) => {
  const b = spec && spec.bark; if (!b) return null;
  const species = typeof b === 'string' ? b : b.species;
  if (!BARKS[species]) return null;
  return { species, tile: typeof b === 'object' && Number.isFinite(b.tile) && b.tile > 0 ? b.tile : 12 };
};

/** Validate a monomer's `bark` → an error string or null. */
export function validateBark(b) {
  if (b === undefined) return null;
  const species = typeof b === 'string' ? b : b && b.species;
  if (!BARKS[species]) return `bark: '${species}' is not one of ${BARK_KEYS.join(', ')}`;
  if (typeof b === 'object' && b.tile !== undefined && !(Number.isFinite(b.tile) && b.tile > 0)) return 'bark.tile: a positive length in the recipe\'s units';
  return null;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const pt = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);
const isQuad = (f) => f.corners.length === 4 && new Set(f.corners.map((c) => c.join())).size === 4;

function stamp(f, key, uv, light) {
  return { ...f, texture: key, textureLit: true, uv, plainFill: f.fill, fill: shadeHexMat('#ffffff', f.outNormal || [0, 0, 1], null, { light }) };
}

// cylindrical uv about an axis: u = angle × radius / tile (the seam unwrapped per face), v = height / tile
function cylindrical(faces, from, to, R, bark, key, light) {
  const ax = unit(sub(to, from)); const e1 = unit(cross(Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], ax)); const e2 = cross(ax, e1);
  return faces.map((f) => {
    if (!isQuad(f)) return f;
    let th = f.corners.map((c) => { const d = sub(c, from); return Math.atan2(dot(d, e2), dot(d, e1)); });
    if (Math.max(...th) - Math.min(...th) > Math.PI) th = th.map((a) => (a < 0 ? a + 2 * Math.PI : a));
    return stamp(f, key, f.corners.map((c, j) => [(th[j] * R) / bark.tile, dot(sub(c, from), ax) / bark.tile]), light);
  });
}

/** Stamp a lathe's faces with its bark. */
export function barkLathe(faces, spec, light) {
  const bark = barkOf(spec); if (!bark) return faces;
  const R = Math.max(...(spec.profile || []).map((p) => p.radius || 0), 0.001);
  return cylindrical(faces, pt(spec.axisFrom), pt(spec.axisTo), R, bark, BARK_TEXTURE_PREFIX + bark.species, light);
}

/** Stamp a loft's faces with its bark (ring-major on a curved path; cylindrical on a straight one). */
export function barkLoft(faces, spec, light) {
  const bark = barkOf(spec); if (!bark) return faces;
  const key = BARK_TEXTURE_PREFIX + bark.species;
  const path = Array.isArray(spec.path) ? spec.path.map(pt) : [pt(spec.axisFrom), pt(spec.axisTo)];
  const prof = (st) => (Array.isArray(st.profile) ? st.profile : Array.from({ length: st.profile.sides || 16 }, (_, k) => { const a = (2 * Math.PI * k) / (st.profile.sides || 16); return [st.profile.radius * Math.cos(a), st.profile.radius * Math.sin(a)]; }));
  const rMean = spec.stations.reduce((s, st) => s + Math.max(...prof(st).map(([u, v]) => Math.hypot(u, v))), 0) / spec.stations.length;
  const K = path.length, M = prof(spec.stations[0]).length;
  if (K <= 2 || faces.length < (K - 1) * M) return cylindrical(faces, path[0], path[path.length - 1], rMean, bark, key, light);
  const cum = [0]; for (let k = 1; k < K; k++) cum.push(cum[k - 1] + Math.hypot(...sub(path[k], path[k - 1])));
  const U = (i) => ((i / M) * 2 * Math.PI * rMean) / bark.tile;
  return faces.map((f, n) => {
    if (n >= (K - 1) * M || !isQuad(f)) return f;
    const k = Math.floor(n / M), i = n % M, v0 = cum[k] / bark.tile, v1 = cum[k + 1] / bark.tile;
    return stamp(f, key, [[U(i), v0], [U(i + 1), v0], [U(i + 1), v1], [U(i), v1]], light);
  });
}
