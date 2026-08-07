/**
 * procedural-material — a texture-free, layered VERTEX-COLOUR material system for baked faces.
 *
 * The Wii/PS2-era look: hand-shaded diffuse + baked lighting + soft brushed mottle + weathering, all
 * expressed as per-corner colours (the `cornerFills` channel faceListToMesh reads) instead of textures.
 * A face opts in by carrying `material: '<preset>'` or `material: { kind, ...overrides }`; the world
 * render path calls resolveFaceMaterials() on the assembled face list (world-scene.js), which
 * TESSELLATES each material face into a grid and colours every vertex through a stack of layers:
 *
 *   layer 1 — RAMP:    a top-lit vertical gradient over the model's z-extent (cohesive, not per-face)
 *   layer 2 — BRUSHED: anisotropic value-noise → soft brushed-metal cloud (fast one axis / slow other)
 *   layer 3 — WEATHER: rust patches (broad tint) + grime drips (dark vertical streaks), gravity-biased
 *
 * Deterministic (seeded value noise; never Math.random) so a recipe re-renders byte-identical. Composes
 * with the existing baked AO (`vao`) and specular (`spec`) channels — material sets colour, they modulate
 * it. Absent `material` on every face ⇒ the face list is returned untouched (byte-identical).
 *
 * Cost note: tessellation multiplies face count by grid². Presets default to grid 1–4; a big world of
 * high-grid material faces is expensive to bake — keep hero fidelity for offline renders, moderate grids
 * for live worlds. resolveFaceMaterials caps grid at MAX_GRID as a runaway guard.
 */

import { shadeHex, DEFAULT_LIGHT as LIGHT } from '@/lib/graph/polygonizer/vexar';

const MAX_GRID = 8;
const RUST = [118, 58, 28];
const GRIME = [20, 17, 15];

// Named presets → layer spec. `kind` on a face material object selects one; fields override it.
export const MATERIAL_PRESETS = {
  'gradient-plate': { grid: 1, ramp: 0.30 },                                  // smooth top-lit gradient only
  'brushed-steel': { grid: 4, ramp: 0.28, cloud: 0.30 },                      // + soft brushed mottle
  'brushed-hull': { grid: 4, ramp: 0.28, cloud: 0.36 },                       // heavier mottle
  'weathered-hull': { grid: 4, ramp: 0.28, cloud: 0.30, wear: 1.0 },          // + rust/grime weathering
  'weathered-heavy': { grid: 6, ramp: 0.26, cloud: 0.30, wear: 1.5 },         // grimy, offline-fidelity
};
export const MATERIAL_KINDS = Object.keys(MATERIAL_PRESETS);

// ── colour helpers ──
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbHex = (c) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const bilerp = (c, u, v) => lerp3(lerp3(c[0], c[1], u), lerp3(c[3], c[2], u), v);

// ── deterministic seeded value-noise + fbm ──
export function mkNoise(seed) {
  const S = seed >>> 0;
  const hash = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + S) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const sm = (t) => t * t * (3 - 2 * t);
  const vn = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    const u = sm(fx), v = sm(fy);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  const fbm = (x, y, oct = 4) => { let s = 0, amp = 0.5, f = 1, nrm = 0; for (let o = 0; o < oct; o++) { s += amp * vn(x * f, y * f); nrm += amp; amp *= 0.5; f *= 2; } return s / nrm; };
  return { fbm };
}

// geometric unit normal of a (planar) quad from its first three corners
function geoNormal(c) {
  const ux = c[1][0] - c[0][0], uy = c[1][1] - c[0][1], uz = c[1][2] - c[0][2];
  const vx = c[3][0] - c[0][0], vy = c[3][1] - c[0][1], vz = c[3][2] - c[0][2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const L = Math.hypot(nx, ny, nz) || 1;
  return [nx / L, ny / L, nz / L];
}
// project a world point to 2D by the face's dominant normal (seamless per face)
const proj = (p, n) => { const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]); return az >= ax && az >= ay ? [p[0], p[1]] : (ax >= ay ? [p[1], p[2]] : [p[0], p[2]]); };

function resolveSpec(material) {
  const base = typeof material === 'string' ? { kind: material } : (material || {});
  const preset = MATERIAL_PRESETS[base.kind] || MATERIAL_PRESETS['brushed-steel'];
  return { ...preset, ...base };
}

// per-corner colour = base × ramp × brushed-cloud, then weathering tint/darken
function shadeCorner(baseRGB, p, n, spec, ctx, NZ) {
  const { zmin, zmax } = ctx;
  const span = (zmax - zmin) || 1;
  const t = (p[2] - (zmin + zmax) / 2) / (span / 2);
  let b = Math.max(0.5, Math.min(1.65, 1 + (spec.ramp ?? 0.28) * t));   // ramp
  if (spec.cloud) {
    const [sx, sy] = proj(p, n);
    const streak = (NZ.fbm(sx * 0.55, sy * 0.16, 4) - 0.5) * 2;
    const broad = (NZ.fbm(sx * 0.12 + 5, sy * 0.12 + 5, 3) - 0.5) * 2;
    b *= 1 + spec.cloud * streak + spec.cloud * 0.5 * broad;            // brushed cloud
  }
  let rgb = [baseRGB[0] * b, baseRGB[1] * b, baseRGB[2] * b];
  if (spec.wear) {
    const [sx, sy] = proj(p, n);
    const low = clamp01((zmax - p[2]) / span) ** 1.3;                   // gravity bias
    const patch = NZ.fbm(sx * 0.15 + 31, sy * 0.15 + 31, 4);           // rust ZONES
    const drip = NZ.fbm(sx * 0.9 + 7, sy * 0.06 + 7, 3);              // vertical grime runs
    const rustW = clamp01((patch - 0.42) * 3.2) * (0.45 + 0.85 * low) * spec.wear;
    const dripW = clamp01((drip - 0.52) * 3.4) * (0.35 + 0.95 * low) * spec.wear;
    rgb = mix(mix(rgb, RUST, Math.min(1, rustW) * 0.72), GRIME, Math.min(1, dripW) * 0.62);
  }
  return rgbHex(rgb);
}

/**
 * resolveFaceMaterials(faces) → faces
 *
 * Replaces every face carrying a `material` with its tessellated, vertex-coloured expansion; passes
 * all other faces through unchanged. The z-extent used by the ramp/weathering is computed ONCE over
 * all material faces so the top-lit gradient is cohesive across the whole model (not per-face). Pure;
 * a list with no `material` faces is returned as-is (same reference-equality-safe contents).
 */
export function resolveFaceMaterials(faces = []) {
  if (!Array.isArray(faces) || !faces.some((f) => f && f.material)) return faces;
  // global z-extent over material faces (cohesive ramp)
  let zmin = Infinity, zmax = -Infinity;
  for (const f of faces) {
    if (!f || !f.material || !Array.isArray(f.corners)) continue;
    for (const c of f.corners) { if (c[2] < zmin) zmin = c[2]; if (c[2] > zmax) zmax = c[2]; }
  }
  if (!isFinite(zmin)) { zmin = 0; zmax = 1; }
  const ctx = { zmin, zmax };
  const out = [];
  for (const f of faces) {
    if (!f || !f.material || !Array.isArray(f.corners) || f.corners.length < 4) { out.push(f); continue; }
    const spec = resolveSpec(f.material);
    const grid = Math.max(1, Math.min(MAX_GRID, spec.grid || 1));
    const NZ = mkNoise(spec.seed ?? 1337);
    const n = geoNormal(f.corners);
    // base = the material's flat tint, LAMBERT-shaded by the face normal (the material lights itself,
    // so an author supplies an unlit base colour + a preset — no pre-shading needed). `lit:false`
    // opts out (use the face's fill verbatim, e.g. when the builder already baked its own shade).
    const baseHex = spec.tint || f.fill || '#8f96a0';
    const baseRGB = hexRGB(spec.lit === false ? baseHex : shadeHex(baseHex, n, LIGHT));
    const carry = {};
    if (f.doubleSided) carry.doubleSided = true;
    if (Array.isArray(f.spec)) carry.spec = f.spec;
    for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
      const uv = [[i / grid, j / grid], [(i + 1) / grid, j / grid], [(i + 1) / grid, (j + 1) / grid], [i / grid, (j + 1) / grid]];
      const cc = uv.map(([u, v]) => bilerp(f.corners, u, v));
      out.push({ corners: cc, fill: rgbHex(baseRGB), cornerFills: cc.map((p) => shadeCorner(baseRGB, p, n, spec, ctx, NZ)), ...carry });
    }
  }
  return out;
}

/** Convenience: stamp a material spec onto every face in a list (builder-side helper). */
export function stampMaterial(faces, material) {
  return faces.map((f) => ({ ...f, material }));
}

// ── rig weathering: the suit analog of the face `material` channel ─────────────────────────────────
// Rig-baked figures (mobile suits, walkers) bake to per-vertex buffers, not face objects: each part is
// { pos: Float32 xyz (base64), col: Uint8 RGB (base64), ... }. weatherRigParts modulates the existing
// `col` in place by the SAME weathering field — livery colours stay the base, rust/grime reads on top.
const decF32 = (b) => { const r = Buffer.from(b, 'base64'); return new Float32Array(r.buffer.slice(r.byteOffset, r.byteOffset + r.length)); };
const decU8 = (b) => { const r = Buffer.from(b, 'base64'); return new Uint8Array(r.buffer.slice(r.byteOffset, r.byteOffset + r.length)); };
const encU8 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const to255 = (x) => Math.max(0, Math.min(255, x));

/**
 * weatherRigParts(parts, opts) → parts (mutated in place)
 *
 * Two composable per-vertex layers on a rig figure's baked colour buffers:
 *   • `cloud` (brushed metal): HUE-PRESERVING brightness variation from anisotropic noise — the surface
 *     reads as brushed/mottled metal while the livery colour stays (blue stays blue). Set `cloud`>0.
 *   • `amt`   (weathering): rust patches + grime drips, gravity-biased low. Set `amt`>0; `amt:0` = clean.
 * So `{ cloud:0.35, amt:0 }` = brushed metal, colour intact; `{ amt:1.5 }` = rusty; both = grimy brushed.
 * `opts`: { seed, amt, cloud, zmin?, zmax? }. Deterministic; parts without pos/col pass through. This is
 * what the world `weathering` manifest channel calls for every figure.
 */
export function weatherRigParts(parts, { seed = 1337, amt = 1, cloud = 0, zmin, zmax } = {}) {
  if (!Array.isArray(parts) || !parts.length) return parts;
  const NZ = mkNoise(seed);
  if (zmin == null || zmax == null) {
    zmin = Infinity; zmax = -Infinity;
    for (const p of parts) { if (!p || !p.pos) continue; const pos = decF32(p.pos); for (let i = 2; i < pos.length; i += 3) { if (pos[i] < zmin) zmin = pos[i]; if (pos[i] > zmax) zmax = pos[i]; } }
  }
  if (!isFinite(zmin)) return parts;
  const span = (zmax - zmin) || 1;
  for (const p of parts) {
    if (!p || !p.pos || !p.col) continue;
    const pos = decF32(p.pos), col = decU8(p.col), nV = (col.length / 3) | 0;
    for (let i = 0; i < nV; i++) {
      const x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
      let c0 = col[3 * i], c1 = col[3 * i + 1], c2 = col[3 * i + 2];
      if (cloud) {
        // brushed metal: brightness-only (multiply all channels) so hue/livery is preserved. Slow-z
        // sampling → soft vertical brush streaks; both x- and y-facing panels get variation.
        const m = (NZ.fbm(x * 0.5 + 3, z * 0.16 + 3, 4) - 0.5) + (NZ.fbm(y * 0.5 + 9, z * 0.16 + 9, 4) - 0.5);
        const bf = 1 + cloud * m;
        c0 *= bf; c1 *= bf; c2 *= bf;
      }
      if (amt) {
        const low = clamp01((zmax - z) / span) ** 1.3;
        const patch = NZ.fbm(x * 0.55 + 31, y * 0.55 + 31, 4);
        const drip = NZ.fbm(x * 3.2 + 7, z * 0.5 + 7, 3);
        const rustW = Math.min(1, clamp01((patch - 0.42) * 3.2) * (0.45 + 0.85 * low) * amt);
        const dripW = Math.min(1, clamp01((drip - 0.52) * 3.4) * (0.35 + 0.95 * low) * amt);
        c0 += (RUST[0] - c0) * rustW * 0.6; c1 += (RUST[1] - c1) * rustW * 0.6; c2 += (RUST[2] - c2) * rustW * 0.6;
        c0 += (GRIME[0] - c0) * dripW * 0.55; c1 += (GRIME[1] - c1) * dripW * 0.55; c2 += (GRIME[2] - c2) * dripW * 0.55;
      }
      col[3 * i] = to255(c0); col[3 * i + 1] = to255(c1); col[3 * i + 2] = to255(c2);
    }
    p.col = encU8(col);
  }
  return parts;
}
