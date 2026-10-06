/**
 * beast-asset — an animal from the creature creator (the `animal` kind: buildAnimal over a species recipe) baked at
 * LOW density into the shared `{corners,fill}` face currency and cheaply placed: the pedestrian (pedestrian-asset.js)
 * for four legs. Same pipeline: build once → re-mesh each part's ring-stack at a few rings and samples → bake once per
 * recipe → scale / rotate / translate per instance.
 *
 * The recipe is the creature creator's resolved pair `{ archetype, opts }` (what a minted `animal` sketch stores), so
 * a beast designed with `mint_solid` drops in as data. The face decor too small to read at a distance (the eye and
 * nose dots, named by the recipe's own `face` colours) is left out; the coat keeps its countershaded belly.
 *
 * Coordinates: rotated so the HEAD is +x (a heading rotation about z then faces it), centred on x/y, hooves at z=0,
 * in metres at the recipe's `height` (the top of the beast: the poll, the hump, the horns).
 */
import { buildAnimal } from '../polygonizer/figure-animal-build.js';
import { makeLight, shadeHex, dot3, sub3, centroid } from '../polygonizer/vexar.js';
import { SM, mathKey } from '../../util/math-scope.js';
import { smoothCorners } from './smooth-corners.js';

const LIGHT = makeLight({ direction: [0.42, -0.5, -0.76], ambient: 0.40, diffuse: 0.76 });   // == pedestrian-asset / figure-render
const MAX_RINGS = 3, MAX_SAMPLES = 5;   // a part at most 3 × 5 quads, a small one (a hoof, an ear, a lock, a horn) one band of 3: ~450 a beast vs ~9k
const SMALL = 10;   // rings in a small part

const newell = (pts) => {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = SM.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
};
const stride = (n, max) => Math.max(1, Math.ceil(n / max));
const mean = (pts) => { let x = 0, y = 0, z = 0; for (const q of pts) { x += q.x; y += q.y; z += q.z; } const n = pts.length || 1; return { x: x / n, y: y / n, z: z / n }; };

// ── bake (memoized per recipe key) ────────────────────────────────────────────────────────────────────────────────
// The creature faces ±y (its head the end the eyes are at): turned so the head is +x, centred on x/y, hooves at z=0,
// scaled so its top stands at `height` metres. Stores { corners, fill, cornerFills } lit once (a fixed-bake shade, as
// the pedestrian's), shaded smooth, colour and all: a beast's coat is its recipe, not a per-instance palette.
const _cache = new Map();
function bake(key, { archetype, opts = {} }, height) {
  const k = `${key}:${height}${mathKey()}`;
  const hit = _cache.get(k);
  if (hit) return hit;
  // the OVERLAP body (no welded skin): each bone its own ring-stack shell, the same build the human miniature thins.
  // The welded skin is a dozen overlapping marched tubes; thinned to a few rings each they open into gaps
  const built = buildAnimal(archetype, { ...opts, skin: false });
  const face = opts.face || {}, decor = new Set([face.eyeHex, face.noseHex].filter(Boolean));
  const parts = built.parts.filter((p) => p.polylines && p.polylines.length >= 2 && !decor.has(p.stroke));
  // which end is the head: the side of y the eyes sit on
  const eyes = built.parts.filter((p) => p.polylines && face.eyeHex && p.stroke === face.eyeHex).flatMap((p) => p.polylines.flat());
  const all = parts.flatMap((p) => p.polylines.flat());
  const midY = (Math.min(...all.map((q) => q.y)) + Math.max(...all.map((q) => q.y))) / 2;
  const headPlus = eyes.length ? mean(eyes).y > midY : true;
  const minZ = Math.min(...all.map((q) => q.z)), maxZ = Math.max(...all.map((q) => q.z));
  const u = height / (maxZ - minZ || 1);
  // head along +y → +x: (x, y) → (y, −x); along −y → (−y, x)
  const V = headPlus ? (q) => [q.y * u, -q.x * u, (q.z - minZ) * u] : (q) => [-q.y * u, q.x * u, (q.z - minZ) * u];
  // the coat's countershading (the animal kind's own rule: a down-facing coat face takes the belly colour)
  const coat = opts.coat && opts.coat.color, under = opts.underHex, cut = opts.underCut ?? -0.3;
  const raw = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [pi, p] of parts.entries()) {
    const rings = p.polylines, small = rings.length <= SMALL, rs = stride(rings.length - 1, small ? 1 : MAX_RINGS), idx = [];
    for (let i = 0; i < rings.length; i += rs) idx.push(i);
    if (idx[idx.length - 1] !== rings.length - 1) idx.push(rings.length - 1);
    for (let kk = 0; kk + 1 < idx.length; kk++) {
      const a = rings[idx[kk]], b = rings[idx[kk + 1]], m = Math.min(a.length, b.length); if (m < 2) continue;
      const ss = stride(m - 1, small ? 3 : MAX_SAMPLES), cw = V(mean([...a, ...b]));
      for (let j = 0; j + 1 < m; j += ss) {
        const j2 = Math.min(j + ss, m - 1); if (j2 === j) continue;
        const w = [V(a[j]), V(a[j2]), V(b[j2]), V(b[j])];
        let n = newell(w);
        if (dot3(n, sub3(centroid(w), cw)) < 0) n = [-n[0], -n[1], -n[2]];
        const hex = under && p.stroke === coat && n[2] < cut ? under : p.stroke;
        for (const [x, y] of w) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
        raw.push({ corners: w, hex, normal: n, group: pi });
      }
    }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  // shaded smooth: each corner by its normal averaged over its part (./smooth-corners.js), the flat fill beside it
  const vn = smoothCorners(raw);
  const baked = raw.map((f, i) => ({ fill: shadeHex(f.hex, f.normal, LIGHT), cornerFills: vn[i].map((n) => shadeHex(f.hex, n, LIGHT)), corners: f.corners.map(([x, y, z]) => [x - cx, y - cy, z]) }));
  _cache.set(k, baked);
  return baked;
}

/**
 * A beast instance as world faces: the baked recipe at `height` metres, scaled by `scale` (metres → the scene's
 * units), turned to `heading` and set down at (cx, cy, cz). `key` names the recipe for the bake cache.
 * @returns {Array<{corners:number[][], fill:string, doubleSided:boolean}>}
 */
export function beastFaces({ key, recipe, height, cx = 0, cy = 0, cz = 0, heading = 0, scale = 1 }) {
  const baked = bake(key, recipe, height);
  const ct = SM.cos(heading), st = SM.sin(heading);
  return baked.map((f) => ({
    fill: f.fill,
    cornerFills: f.cornerFills,
    doubleSided: true,
    corners: f.corners.map(([x, y, z]) => [cx + (x * ct - y * st) * scale, cy + (x * st + y * ct) * scale, cz + z * scale]),
  }));
}
