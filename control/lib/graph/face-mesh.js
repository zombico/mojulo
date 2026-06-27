/**
 * face-mesh — pure adapter from the engine-agnostic baked face list
 * (the same `{ corners, fill, bg, doubleSided }` shape `emitPreserve3dScene`
 * consumes) into renderer-ready triangle data for the three.js World path.
 *
 * Deliberately has NO three.js import: it emits plain typed arrays so it stays
 * unit-testable in node and `emitThreeWorld` remains the only three-aware module.
 *
 * The lighting is ALREADY baked into each face's `fill` hex (Lambert + diffusion
 * + shadows, computed in scene-css3d). So the mesh carries colour per vertex and
 * the World renders it UNLIT (MeshBasicMaterial + vertexColors) — the baked look
 * is reproduced exactly from any camera, with no lighting setup downstream.
 *
 * Quads are emitted as non-indexed triangle soup (6 verts/face): flat per-face
 * colour is trivial, and at city scale (a few thousand faces) the vertex count is
 * a rounding error for the GPU.
 *
 * World coordinates are kept verbatim (z-up). The emitter sets camera.up = +Z so
 * the `worldFraming` cameraPosition/lookAt values flow through without remapping.
 */

const HEX_RE = /#([0-9a-f]{3}|[0-9a-f]{6})\b/i;
// `rgb(r,g,b)` / `rgba(r,g,b,a)` — box-world faces are baked as #hex, but the
// painted-landscape terrain bakes per-cell Lambert as rgb() strings; without this
// every terrain face would miss HEX_RE and fall back to the neutral grey.
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i;

// sRGB channel (0..1) → linear. Vertex colours in a BufferAttribute are treated
// as linear by three; the renderer's sRGB output then re-encodes them, so the
// on-screen result matches the original hex.
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Resolve a face's representative colour as linear [r,g,b] in 0..1.
 * Prefers `fill` (baked Lambert hex); falls back to the first hex found in a CSS
 * `bg` gradient (facades / clouds are gradient-painted — we can only approximate
 * them with a single triangle colour, which is the documented World/Scene
 * material trade-off); else a neutral grey.
 */
export function faceColorLinear(face, fallback = [0.5, 0.5, 0.5]) {
  const src = (face && (face.fill || face.bg)) || '';
  if (typeof src !== 'string') return fallback;
  const rgb = src.match(RGB_RE);
  if (rgb) {
    return [srgbToLinear(+rgb[1] / 255), srgbToLinear(+rgb[2] / 255), srgbToLinear(+rgb[3] / 255)];
  }
  const m = src.match(HEX_RE);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

/**
 * Collect object-glow emitters from a baked face list. Any face carrying a `glow`
 * marker (emitted by scene-css3d `emissiveFixture` — the CSS path renders it as a
 * box-shadow halo) becomes one camera-facing additive sprite in the World. Returns
 * `[{ pos:[x,y,z], color:[r,g,b] (sRGB 0..1), size }]`; the World renders these so the
 * baked light SOLVE stays shared while the halo is realized per-renderer.
 *
 * `pos` is the fixture face centroid; `size` (world-space halo radius) is derived from
 * the CSS glow blur+spread so a wider authored glow reads wider. `scale` multiplies it.
 */
export function collectGlowSprites(faces = [], { scale = 1 } = {}) {
  const out = [];
  for (const f of faces) {
    if (!f || !f.glow || typeof f.fill !== 'string' || f.fill[0] !== '#' || !Array.isArray(f.corners) || f.corners.length < 4) continue;
    const c = f.corners;
    const pos = [0, 1, 2].map((k) => (c[0][k] + c[1][k] + c[2][k] + c[3][k]) / 4);
    let h = f.fill.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const color = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const m = /(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/.exec(f.glow); // "0 0 28px 9px rgba(...)" → blur, spread
    const blur = m ? +m[1] : 24, spread = m ? +m[2] : 8;
    out.push({ pos, color, size: (2.5 + (blur + spread) / 11) * scale });
  }
  return out;
}

/**
 * Collect shadow decals for the World — the dark counterpart of collectGlowSprites, and how
 * the CSS-3D cast/contact shadows survive into three.js. Both shadow kinds are floor-planar
 * dark radial fields, so each becomes a flat alpha-textured ground quad (preserving the soft
 * falloff + translucency a flat-per-face mesh would otherwise drop). Two inputs:
 *   • CONTACT — a whole face tagged `decal:'shadow'` (+ `shadowAlpha`): its quad IS the
 *     footprint, used verbatim.
 *   • CAST — a face carrying `shadowDecal:{uv,spread,alpha,color}` (the reverse-diffusion
 *     pool projected to the floor): a sub-quad is built around the hit (uv→world via the
 *     face's own edge axes), sized by `spread` to mirror the CSS pool radius.
 * Returns `[{ quad:[[x,y,z]×4], alpha, color:[r,g,b] 0..255 }]`. CSS-3D ignores these fields
 * and keeps painting the gradient into `bg`, so its output is unchanged.
 */
export function collectShadowDecals(faces = []) {
  const out = [];
  for (const f of faces) {
    if (!Array.isArray(f?.corners) || f.corners.length < 4) continue;
    if (f.decal === 'shadow') {
      out.push({ quad: f.corners.slice(0, 4), alpha: f.shadowAlpha ?? 0.5, color: f.shadowColor || [0, 0, 0] });
    } else if (f.shadowDecal && Array.isArray(f.shadowDecal.uv)) {
      const { uv, spread = 0.2, alpha = 0.4, color = [10, 8, 6] } = f.shadowDecal;
      const c = f.corners;
      const center = bilerp(c, uv[0], uv[1]);
      const uAx = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]];
      const vAx = [c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]];
      const r = Math.min(1.2, spread * 2.2 + 0.16);   // fraction of the face — mirrors the CSS pool radius
      const hu = uAx.map((k) => k * r * 0.5), hv = vAx.map((k) => k * r * 0.5);
      out.push({ quad: [
        [center[0] - hu[0] - hv[0], center[1] - hu[1] - hv[1], center[2] - hu[2] - hv[2]],
        [center[0] + hu[0] - hv[0], center[1] + hu[1] - hv[1], center[2] + hu[2] - hv[2]],
        [center[0] + hu[0] + hv[0], center[1] + hu[1] + hv[1], center[2] + hu[2] + hv[2]],
        [center[0] - hu[0] + hv[0], center[1] - hu[1] + hv[1], center[2] - hu[2] + hv[2]],
      ], alpha, color });
    }
  }
  return out;
}

const TRIS = [[0, 1, 2], [0, 2, 3]]; // quad → two triangles

// Alpha channel of an `rgba(r,g,b,a)` fill (1 when opaque / no alpha).
const RGBA_A_RE = /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/i;
function faceAlpha(face) {
  const src = (face && (face.fill || face.bg)) || '';
  const m = typeof src === 'string' ? src.match(RGBA_A_RE) : null;
  return m ? Math.max(0, Math.min(1, +m[1])) : 1;
}

/**
 * Build a TRANSLUCENT mesh from faces tagged `water: true`. The opaque faceListToMesh
 * path carries RGB vertex colours (MeshBasicMaterial, opaque); water instead needs
 * PER-VERTEX ALPHA so shallows read clear and deeps read opaque — the depth cue the
 * painted-landscape sheet bakes into each quad's `rgba()` fill. Returns a 4-component
 * colour buffer (r,g,b,a, linear/0..1) which three consumes via USE_COLOR_ALPHA when
 * the BufferAttribute itemSize is 4. Water quads are plain (no clip/radius), so each is
 * a flat 2-triangle split — no tessellation. Empty input → null.
 */
export function collectWaterMesh(faces = []) {
  const pos = [], col = [];
  for (const f of faces) {
    const c = f && f.corners;
    if (!Array.isArray(c) || c.length < 4) continue;
    const [r, g, b] = faceColorLinear(f);
    // PER-CORNER alpha when the face carries `cornerAlpha: [a0,a1,a2,a3]` (e.g. soft cloud veils
    // whose opacity is sampled at each corner) — adjacent quads share corner values, so the
    // translucent sheet feathers smoothly instead of reading as flat blocks. Else one face alpha.
    const ca = Array.isArray(f.cornerAlpha) && f.cornerAlpha.length >= 4 ? f.cornerAlpha : null;
    const a = faceAlpha(f);
    for (const tri of TRIS) for (const k of tri) { pos.push(c[k][0], c[k][1], c[k][2]); col.push(r, g, b, ca ? Math.max(0, Math.min(1, ca[k])) : a); }
  }
  if (!pos.length) return null;
  return { positions: new Float32Array(pos), colors: new Float32Array(col), vertexCount: pos.length / 3 };
}

/**
 * Parse a CSS `clip-path: polygon(...)` whose vertices are ALL `%` coords into an
 * array of [u, v] in 0..1. Returns null for anything we can't map onto the quad
 * verbatim — a missing clip, an `ellipse(...)` clip, or any px (non-%) coordinate —
 * so the caller falls back to the plain two-triangle quad. The percentage frame
 * matches how scene-css3d authored the clip: 0% 0% is corner[0], 100% 0% is
 * corner[1], and the bottom edge runs corner[3] → corner[2].
 */
function parseClipPolygon(clip) {
  if (typeof clip !== 'string') return null;
  const m = clip.match(/polygon\(([^)]*)\)/i);
  if (!m) return null;
  const pts = [];
  for (const pair of m[1].split(',')) {
    const nums = pair.trim().match(/^(-?[\d.]+)%\s+(-?[\d.]+)%$/);
    if (!nums) return null; // non-% coord (e.g. px) — can't map without the face's pixel size
    pts.push([parseFloat(nums[1]) / 100, parseFloat(nums[2]) / 100]);
  }
  return pts.length >= 3 ? pts : null;
}

/**
 * Bilinear map of (u, v) in 0..1 onto a quad's four corners: top edge corner0→corner1,
 * bottom edge corner3→corner2, then lerp top→bottom by v. Reconstructs the exact world
 * point a CSS %-clip vertex addresses (e.g. a tri() apex maps back precisely).
 */
function bilerp(c, u, v) {
  const tx = c[0][0] + (c[1][0] - c[0][0]) * u;
  const ty = c[0][1] + (c[1][1] - c[0][1]) * u;
  const tz = c[0][2] + (c[1][2] - c[0][2]) * u;
  const bx = c[3][0] + (c[2][0] - c[3][0]) * u;
  const by = c[3][1] + (c[2][1] - c[3][1]) * u;
  const bz = c[3][2] + (c[2][2] - c[3][2]) * u;
  return [tx + (bx - tx) * v, ty + (by - ty) * v, tz + (bz - tz) * v];
}

// Expand a 1–4 value CSS corner shorthand to [TL, TR, BR, BL] (the box-model order
// border-radius uses).
function expandCorners(t) {
  if (t.length === 1) return [t[0], t[0], t[0], t[0]];
  if (t.length === 2) return [t[0], t[1], t[0], t[1]];
  if (t.length === 3) return [t[0], t[1], t[2], t[1]];
  return [t[0], t[1], t[2], t[3]];
}

// One border-radius token → fraction in 0..1 ("50%" → 0.5, "0" → 0). Returns null for
// any unit we can't resolve without the face's pixel size (e.g. "8px"), so the caller
// falls back to the plain quad — the same posture as parseClipPolygon.
function radiusFrac(tok) {
  if (tok === '0') return 0;
  const m = /^(-?[\d.]+)%$/.exec(tok);
  return m ? Math.max(0, parseFloat(m[1]) / 100) : null;
}

/**
 * Parse a CSS `border-radius` (incl. the two-axis `h... / v...` form) into four
 * [rh, rv] corner radii (fractions of the face's u-width / v-height) ordered TL, TR,
 * BR, BL. That order matches both CSS and face-mesh's (u,v) frame: (0,0)=TL=corner0,
 * (1,0)=TR=corner1, (1,1)=BR=corner2, (0,1)=BL=corner3 — so the radii land on the
 * same corners the CSS-3D path rounds. Returns null for a non-% unit or an all-zero
 * radius (→ plain quad). This is how scene-css3d's arched windows/iwans (rounded
 * world-top corners) and the dharma-wheel disc ('50%') render as true curved geometry
 * in the World instead of square-topped quad approximations.
 */
function parseBorderRadius(radius) {
  if (typeof radius !== 'string' || !radius.trim()) return null;
  const [hPart, vPart] = radius.split('/').map((s) => s.trim());
  const hTok = hPart.split(/\s+/), vTok = vPart ? vPart.split(/\s+/) : hTok;
  const h = expandCorners(hTok).map(radiusFrac);
  const v = expandCorners(vTok).map(radiusFrac);
  if (h.some((x) => x == null) || v.some((x) => x == null)) return null;
  if (h.every((x) => x === 0) && v.every((x) => x === 0)) return null;
  return [[h[0], v[0]], [h[1], v[1]], [h[2], v[2]], [h[3], v[3]]];
}

// Quarter-ellipse arc points (inclusive endpoints) around centre (cu,cv) with radii
// (rh,rv), sweeping from angle a0→a1 degrees. A zero-radius corner collapses to its
// sharp point. Appends [u,v] pairs to `out`.
function arcInto(out, cu, cv, rh, rv, a0, a1, seg) {
  if (rh === 0 && rv === 0) { out.push([cu, cv]); return; }
  for (let i = 0; i <= seg; i++) {
    const a = (a0 + (a1 - a0) * (i / seg)) * Math.PI / 180;
    out.push([cu + rh * Math.cos(a), cv + rv * Math.sin(a)]);
  }
}

/**
 * Rounded-rectangle outline in the face's (u,v) frame for a parsed border-radius
 * ([[rh,rv] TL,TR,BR,BL]). Radii are clamped per CSS so adjacent corners never
 * overlap an edge, then each corner is swept as a quarter ellipse (TL 180→270,
 * TR 270→360, BR 0→90, BL 90→180) joined by the straight edges. Consecutive
 * duplicate points (sharp corners, full-radius meets) are dropped.
 */
function roundedRectOutline(radii, seg = 8) {
  let [[hTL, vTL], [hTR, vTR], [hBR, vBR], [hBL, vBL]] = radii;
  // CSS overlap clamp: scale all radii by the tightest edge ratio (no-op when ≤1).
  const f = Math.min(1, 1 / ((hTL + hTR) || 1), 1 / ((hBR + hBL) || 1), 1 / ((vTL + vBL) || 1), 1 / ((vTR + vBR) || 1));
  hTL *= f; vTL *= f; hTR *= f; vTR *= f; hBR *= f; vBR *= f; hBL *= f; vBL *= f;
  const pts = [];
  arcInto(pts, hTL, vTL, hTL, vTL, 180, 270, seg);            // TL, centre (hTL, vTL)
  arcInto(pts, 1 - hTR, vTR, hTR, vTR, 270, 360, seg);        // TR, centre (1-hTR, vTR)
  arcInto(pts, 1 - hBR, 1 - vBR, hBR, vBR, 0, 90, seg);       // BR, centre (1-hBR, 1-vBR)
  arcInto(pts, hBL, 1 - vBL, hBL, vBL, 90, 180, seg);         // BL, centre (hBL, 1-vBL)
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1] || pts[pts.length - 1];
    if (Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6) out.push(p);
  }
  return out;
}

// --- coplanar de-collision (depth stagger) --------------------------------------------
// Two faces baked onto the SAME plane at the SAME depth z-fight: the depth buffer can't
// order them, so the GPU dithers them per-pixel as the camera moves. Opaque faces are
// merged into one MeshBasicMaterial (no per-face polygonOffset to reach for), so we break
// the tie at BAKE time: bucket faces by the plane they live on and lift each face after the
// first in its bucket a hair ALONG ITS NORMAL. Coplanar faces share a normal, so a normal-
// axis offset is a pure depth shift from EVERY camera — camera-independent and flicker-free
// (unlike a render-time bias). The first face in a plane stays put (lift 0), so any scene
// whose faces all sit on distinct planes is byte-for-byte unchanged.

// Geometric unit normal of a (planar) quad from its first three corners. Returns [0,0,0]
// for a degenerate zero-area quad — its lift is then a no-op, the safe thing to do.
function faceNormal(c) {
  const ux = c[1][0] - c[0][0], uy = c[1][1] - c[0][1], uz = c[1][2] - c[0][2];
  const vx = c[3][0] - c[0][0], vy = c[3][1] - c[0][1], vz = c[3][2] - c[0][2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const L = Math.hypot(nx, ny, nz);
  if (L < 1e-12) return [0, 0, 0];
  nx /= L; ny /= L; nz /= L;
  // Canonical hemisphere: a face and its back-side twin (opposite winding) live on the same
  // plane, so flip to one consistent direction → they land in the SAME bucket and stagger.
  if (nx < -1e-9 || (Math.abs(nx) < 1e-9 && (ny < -1e-9 || (Math.abs(ny) < 1e-9 && nz < 0)))) {
    return [-nx, -ny, -nz];
  }
  return [nx, ny, nz];
}

// Mean edge length of a quad — the local scale that sizes the lift, so a small post and a
// city block each get a proportional (sub-pixel) nudge.
function faceScale(c) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4];
    s += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return s / 4;
}

// Stable key for the plane a face lives on: quantized normal direction + quantized signed
// distance from the origin. `distQ` (scene-scaled) sets how close two parallel planes must be
// to count as "the same" — coincident faces share it exactly, genuinely-separate surfaces don't.
function planeKey(normal, c0, distQ) {
  const d = normal[0] * c0[0] + normal[1] * c0[1] + normal[2] * c0[2];
  const qn = (x) => Math.round(x / 1e-3); // ~0.06° direction bucket
  return qn(normal[0]) + ',' + qn(normal[1]) + ',' + qn(normal[2]) + ',' + Math.round(d / distQ);
}

// Fraction of a face's own size to lift per stack step. ~5e-4 is well under a pixel at normal
// framing yet clears float32 depth precision; raise it only if z-fighting survives at extreme
// camera distance (the trade is a slightly wider hairline where unrelated faces share an edge).
const STAGGER_EPS = 5e-4;

// Two in-plane axes for a unit normal — a stable basis to project a face's footprint into 2D.
function planeBasis(n) {
  const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = n[1] * ref[2] - n[2] * ref[1], uy = n[2] * ref[0] - n[0] * ref[2], uz = n[0] * ref[1] - n[1] * ref[0];
  const L = Math.hypot(ux, uy, uz) || 1; ux /= L; uy /= L; uz /= L;
  return [[ux, uy, uz], [n[1] * uz - n[2] * uy, n[2] * ux - n[0] * uz, n[0] * uy - n[1] * ux]];
}

// Axis-aligned bounds of a quad's footprint in a plane basis (u,v) → [umin,umax,vmin,vmax].
function planeAABB(c, u, v) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < 4; i++) {
    const p = c[i], a = p[0] * u[0] + p[1] * u[1] + p[2] * u[2], b = p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
    if (a < u0) u0 = a; if (a > u1) u1 = a; if (b < v0) v0 = b; if (b > v1) v1 = b;
  }
  return [u0, u1, v0, v1];
}

// Positive-area overlap of two in-plane AABBs (a shared edge — adjacent tessellation tiles — is
// NOT an overlap, thanks to `tol`).
function aabbOverlap(a, b, tol) {
  return a[0] < b[1] - tol && b[0] < a[1] - tol && a[2] < b[3] - tol && b[2] < a[3] - tol;
}

/**
 * decollideFaces(faces) → faces with OVERLAPPING coincident-coplanar quads lifted apart in depth.
 * Returns a new array; faces are returned UNCHANGED (same reference) unless they actually overlap
 * another face already placed on their plane, in which case a fresh object is returned with its
 * `corners` shifted a hair along the plane normal.
 *
 * Same-plane is NOT enough — a flat surface tessellated into many coplanar tiles must stay flat.
 * So within each plane bucket we test footprint OVERLAP (2D AABB in the plane basis): tiles that
 * merely tile/touch get ordinal 0 (no lift); a face stacked ON TOP of others gets one step above
 * the highest it overlaps. Operate on the WHOLE face list (across render groups) so coincident
 * faces in SEPARATE meshes — the worst z-fight case — are caught too. Idempotent: a lifted face
 * lands on a now-distinct plane, so re-running moves nothing.
 *
 * Cost is ~O(k²) within a single plane bucket (k = faces sharing that plane); fine in practice
 * since real scenes spread faces across many planes.
 */
export function decollideFaces(faces = [], { eps = STAGGER_EPS } = {}) {
  let coordMax = 0;
  for (const f of faces) {
    const c = f && f.corners;
    if (!c || c.length < 4) continue;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const a = Math.abs(c[i][k]); if (a > coordMax) coordMax = a; }
  }
  const distQ = Math.max(1e-4, coordMax * 5e-6); // scene-scaled "same plane" tolerance
  const tol = distQ;                               // edge-touch tolerance for the overlap test
  const buckets = new Map();                       // plane key → [{ aabb, ord }] already placed
  return faces.map((f) => {
    const c = f && f.corners;
    if (!c || c.length < 4) return f;
    const fn = faceNormal(c);
    const key = planeKey(fn, c[0], distQ);
    const [u, v] = planeBasis(fn);
    const aabb = planeAABB(c, u, v);
    let list = buckets.get(key);
    if (!list) { list = []; buckets.set(key, list); }
    let ord = 0; // one step above the highest face this one actually overlaps (0 if it overlaps none)
    for (const placed of list) if (aabbOverlap(aabb, placed.aabb, tol)) ord = Math.max(ord, placed.ord + 1);
    list.push({ aabb, ord });
    if (ord === 0) return f; // tiles/touches/first-on-plane → byte-for-byte unchanged
    const lift = ord * faceScale(c) * eps;
    const ox = fn[0] * lift, oy = fn[1] * lift, oz = fn[2] * lift;
    return { ...f, corners: c.map((p) => [p[0] + ox, p[1] + oy, p[2] + oz]) };
  });
}

/**
 * faceListToMesh(faces) → { positions, colors, vertexCount, faceCount, center, radius }
 * positions/colors are Float32Array triangle soup ready for BufferGeometry.
 * center/radius bound the geometry for a camera-framing fallback when a world
 * ships no `worldFraming` camera.
 *
 * A face carrying a `clip: polygon(...)` (all-% coords) is triangulated to honour the
 * clip exactly — its vertices are mapped onto the quad and fan-triangulated. This is
 * what makes the landmark onion-dome tips and roof fans (authored as clipped quads via
 * tri()) render as true triangles in the World instead of full-quad flaps. A face
 * carrying a `radius: <border-radius>` (all-% coords) is likewise outlined as a rounded
 * rectangle and fan-triangulated, so arched windows/iwans and the dharma-wheel disc
 * curve in the World instead of squaring off. `ellipse(...)` clips and px-unit radii
 * are still approximated by the full quad.
 */
export function faceListToMesh(faces = [], { decollide = true } = {}) {
  const positions = [];
  const colors = [];
  // Faces carrying a `texture` key + per-corner `uv` are split into one mesh group per key (rendered
  // with a MeshBasicMaterial({ map }) by emitThreeWorld — the workbench's label-wrap path). Faces
  // WITHOUT a texture follow the exact path below, so a scene with no textured faces is unchanged.
  const textureGroups = {};
  let cx = 0, cy = 0, cz = 0, n = 0;
  // Coincident-coplanar faces are lifted apart in depth before baking (z-fight de-collision).
  // `decollide:false` skips it — used by emitThreeWorld, which de-collides ONCE across all groups
  // (so cross-mesh collisions are caught) and then bakes each group with this off to avoid a
  // redundant second pass.
  const src = decollide ? decollideFaces(faces) : faces;
  for (const f of src) {
    const c = f && f.corners;
    if (!c || c.length < 4) continue;
    if (typeof f.texture === 'string' && Array.isArray(f.uv) && f.uv.length >= 4) {
      const grp = textureGroups[f.texture] || (textureGroups[f.texture] = { positions: [], uvs: [], colors: [], lit: false });
      // `textureLit` opts a textured face into MULTIPLY-lit rendering: the baked per-face
      // colour rides into the group so emitThreeWorld can do texel × bakedLight (vertexColors).
      // Label wraps omit it → unlit sticker, exactly as before.
      if (f.textureLit) grp.lit = true;
      const [tr, tg, tb] = faceColorLinear(f);
      for (const tri of TRIS) {
        for (const idx of tri) {
          const p = c[idx], uv = f.uv[idx];
          grp.positions.push(p[0], p[1], p[2]);
          grp.uvs.push(uv[0], uv[1]);
          grp.colors.push(tr, tg, tb);
        }
      }
      for (let i = 0; i < 4; i++) { cx += c[i][0]; cy += c[i][1]; cz += c[i][2]; n++; }
      continue;
    }
    const [lr, lg, lb] = faceColorLinear(f);
    const clipPts = parseClipPolygon(f.clip);
    const radPts = clipPts ? null : parseBorderRadius(f.radius);
    if (clipPts || radPts) {
      const mapped = (clipPts || roundedRectOutline(radPts)).map(([u, v]) => bilerp(c, u, v));
      for (let i = 1; i < mapped.length - 1; i++) {
        for (const p of [mapped[0], mapped[i], mapped[i + 1]]) {
          positions.push(p[0], p[1], p[2]);
          colors.push(lr, lg, lb);
        }
      }
    } else {
      for (const tri of TRIS) {
        for (const idx of tri) {
          const p = c[idx];
          positions.push(p[0], p[1], p[2]);
          colors.push(lr, lg, lb);
        }
      }
    }
    for (let i = 0; i < 4; i++) { cx += c[i][0]; cy += c[i][1]; cz += c[i][2]; n++; }
  }
  const center = n ? [cx / n, cy / n, cz / n] : [0, 0, 0];
  let radius = 0;
  const bound = (arr) => {
    for (let i = 0; i < arr.length; i += 3) {
      const dx = arr[i] - center[0], dy = arr[i + 1] - center[1], dz = arr[i + 2] - center[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > radius) radius = d;
    }
  };
  bound(positions);
  const textures = {};
  for (const [key, grp] of Object.entries(textureGroups)) {
    bound(grp.positions);
    textures[key] = { positions: Float32Array.from(grp.positions), uvs: Float32Array.from(grp.uvs), colors: Float32Array.from(grp.colors), lit: grp.lit };
  }
  return {
    positions: Float32Array.from(positions),
    colors: Float32Array.from(colors),
    vertexCount: positions.length / 3,
    faceCount: faces.length,
    center,
    radius,
    textureGroups: textures,
  };
}
