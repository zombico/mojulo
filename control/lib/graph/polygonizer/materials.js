/**
 * materials — the closed material shelf for baked surface shading.
 *
 * Promoted from effects/carved-solid.js (which proved the model and re-exports
 * these for its existing importers) so any vexar-shaded surface — lathe
 * polygomers, extruded solids, carved wordmarks — can name what it is made of.
 * See material-response.plan.md for doctrine; the shade that consumes a row is
 * vexar's shadeHexMat / shadeFaceMat.
 *
 * Materials are a shading MODEL, not just a tint — metal is one family among
 * matte / stone / plastic / glass / neon / cel. Each row: { base, ambient,
 * diffuse, specular?, shininess?, emissive?, cel?, opacity? }. `base` is the
 * row's own albedo (used when the caller has no color of its own); `ambient` /
 * `diffuse` REPLACE the light's when the row is applied; `specular`+`shininess`
 * are the Blinn-Phong highlight (only realized by fixed-camera renderers);
 * `emissive` blends back toward the unlit albedo; `cel` quantizes the Lambert
 * term into N bands. Extend by adding a row — never by forking a shade function.
 */

import { isMetalSurface, metalSurfaceError, resolveMetalSurface, metalShelfRow } from '../materials/metal-surface.js';
import { SM } from '../../util/math-scope.js';

export const MATERIALS = {
  // metallic — specular highlight, tinted. `metal: 1` marks the family for the
  // glTF pbrMetallicRoughness mapping (materialPbr below); the shades ignore it.
  gold:     { base: '#d8b25a', ambient: 0.26, diffuse: 0.70, specular: 0.60, shininess: 22, metal: 1 },
  steel:    { base: '#c7d0da', ambient: 0.26, diffuse: 0.70, specular: 0.60, shininess: 22, metal: 1 },
  chrome:   { base: '#dfe6ee', ambient: 0.20, diffuse: 0.58, specular: 0.85, shininess: 40, metal: 1 },
  bronze:   { base: '#b08d57', ambient: 0.26, diffuse: 0.68, specular: 0.50, shininess: 18, metal: 1 },
  silver:   { base: '#cfd6dd', ambient: 0.26, diffuse: 0.70, specular: 0.62, shininess: 26, metal: 1 },
  copper:   { base: '#c8743a', ambient: 0.26, diffuse: 0.68, specular: 0.50, shininess: 20, metal: 1 },
  gunmetal: { base: '#8b94a0', ambient: 0.24, diffuse: 0.66, specular: 0.45, shininess: 24, metal: 1 },
  // non-metal — matte / soft, little or no specular
  matte:    { base: '#c9ccd2', ambient: 0.44, diffuse: 0.60, specular: 0,    shininess: 1 },
  plaster:  { base: '#e8e4dc', ambient: 0.50, diffuse: 0.50, specular: 0.05, shininess: 4 },
  stone:    { base: '#8d8f93', ambient: 0.40, diffuse: 0.60, specular: 0.05, shininess: 3 },
  wood:     { base: '#9b6b3f', ambient: 0.40, diffuse: 0.60, specular: 0.06, shininess: 4 },
  rubber:   { base: '#2c2f36', ambient: 0.40, diffuse: 0.58, specular: 0.10, shininess: 6 },
  plastic:  { base: '#2f9bff', ambient: 0.34, diffuse: 0.66, specular: 0.35, shininess: 16 },
  satin:    { base: '#cdd3da', ambient: 0.34, diffuse: 0.62, specular: 0.22, shininess: 12 },
  // translucent / stylized
  glass:    { base: '#bfe6ff', ambient: 0.30, diffuse: 0.42, specular: 0.75, shininess: 48, opacity: 0.5 },
  neon:     { base: '#19f0c8', ambient: 0.60, diffuse: 0.40, specular: 0,    emissive: 0.85 },
  cel:      { base: '#ff5d73', ambient: 0.50, diffuse: 0.50, specular: 0,    cel: 4 },
};
export const MATERIAL_NAMES = Object.keys(MATERIALS);

// Plain words an agent reaches for that name a shelf row it does not know the name of
// (launch-falls-short.plan.md P2: 'ceramic' was the first cold mug's refusal). An alias resolves
// to its row; it is never a new row, and no stored recipe can carry one (they were refused).
export const MATERIAL_ALIASES = Object.freeze({
  ceramic: 'satin', porcelain: 'satin', glazed: 'satin', enamel: 'satin',
  iron: 'gunmetal', 'cast-iron': 'gunmetal', aluminium: 'steel', aluminum: 'steel', brass: 'bronze', tin: 'silver',
  marble: 'stone', concrete: 'stone', granite: 'stone', clay: 'plaster',
  fabric: 'matte', cloth: 'matte', paper: 'matte', cardboard: 'matte', leather: 'rubber', felt: 'matte',
});
/** materialName(m) → the shelf row a string names (aliases resolved), or null. */
export function materialName(m) {
  if (typeof m !== 'string') return null;
  if (Object.hasOwn(MATERIALS, m)) return m;   // own keys only: 'constructor' or 'toString' is not a row
  const k = m.trim().toLowerCase(), a = Object.hasOwn(MATERIAL_ALIASES, k) ? MATERIAL_ALIASES[k] : null;
  return a && Object.hasOwn(MATERIALS, a) ? a : null;
}

/**
 * Resolve a name, a #hex (→ satin tint), an object { preset?, base?, … overrides }, or a metal surface
 * { metal: '<name>', finish?, along?, film?, seed? } (materials/metal-surface.js: a shelf-shaped row carrying the
 * resolved surface, so fills shade as before and tagFacesWithMaterial stamps the page's `metal` tag). An invalid metal
 * surface falls back to steel like any other typo; validateMaterialRef is the loud gate.
 */
export function resolveMaterial(m) {
  if (!m) return MATERIALS.steel;
  if (isMetalSurface(m)) return metalSurfaceError(m) ? MATERIALS.steel : metalShelfRow(resolveMetalSurface(m));
  if (typeof m === 'string') return MATERIALS[materialName(m)] || (m.startsWith('#') ? { ...MATERIALS.satin, base: m } : MATERIALS.steel);
  return { ...(MATERIALS[materialName(m.preset)] || MATERIALS.satin), ...m };
}

/**
 * Validate a manifest-level material reference BEFORE resolveMaterial's forgiving
 * fallback swallows a typo ('golden' would silently become steel). Returns an error
 * string, or null when the reference is well-formed. null/undefined is fine (no material).
 */
export function validateMaterialRef(m) {
  if (m == null) return null;
  if (typeof m === 'string') {
    if (m.startsWith('#') || materialName(m)) return null;
    return `unknown material '${m}' — use one of: ${MATERIAL_NAMES.join(', ')} (or a '#hex' tint, or { preset, …overrides }; plain words like ${Object.keys(MATERIAL_ALIASES).slice(0, 4).join(' / ')} resolve to a row)`;
  }
  if (isMetalSurface(m)) { const e = metalSurfaceError(m); return e ? `metal surface: ${e}` : null; }
  if (typeof m === 'object') {
    if (m.preset != null && !materialName(m.preset)) return `unknown material preset '${m.preset}' — use one of: ${MATERIAL_NAMES.join(', ')}`;
    return null;
  }
  return `material must be a shelf name, a '#hex' tint, or an object — got ${typeof m}`;
}

/**
 * Shelf row → glTF pbrMetallicRoughness factors `[metallicFactor, roughnessFactor]`
 * (material-response.plan.md P3). Metalness is the family flag; roughness inverts
 * the row's specular strength (chrome 0.85 → 0.15 rough, stone 0.05 → 0.95),
 * floored so nothing exports as a perfect mirror.
 */
export function materialPbr(mat) {
  if (!mat) return null;
  return [mat.metal ? 1 : 0, Math.min(1, Math.max(0.08, 1 - (mat.specular || 0)))];
}

/**
 * Annotate baked faces with the material's payload-channel keys (in place, returns
 * the list): `spec: [strength, power]` for the World's live specular channel and
 * `pbr: [metallic, roughness]` for the .glb export. The camera-independent response
 * is already IN the fills; these carry the view-dependent remainder. No material or
 * no specular → faces untouched (byte-identical downstream).
 */
export function tagFacesWithMaterial(faces, mat, opts = {}) {
  if (!mat || !Array.isArray(faces)) return faces;
  if (mat.surface) return tagFacesWithMetal(faces, mat.surface, opts);
  const spec = mat.specular > 0 ? [mat.specular, mat.shininess || 16] : null;
  const pbr = materialPbr(mat);
  for (const f of faces) {
    if (!f) continue;
    if (spec) f.spec = spec;
    if (pbr) f.pbr = pbr;
  }
  return faces;
}

/**
 * Metal-surface faces carry `metal: { s, d, ta }` for the World's metal channel (the surface's canonical key, the
 * film thickness in nm, and the toolpath tangent as an angle from the face's first edge, about its normal) and
 * `pbr: [1, roughness]` for the exporters. The tangent is stored RELATIVE to the face so it survives every later
 * pose, scale and mirror of the corners (faceListToMesh rebuilds it from the final corners). No `spec`: the metal
 * channel draws the whole view-dependent response, and a white Blinn lobe on top would read as plastic again.
 */
export function tagFacesWithMetal(faces, surface, { axis = null, along: fallback = null } = {}) {
  const pbr = [1, Math.max(0.08, surface.roughness)];
  // a generator may name its natural toolpath (a lathe turns: 'around' its own axis) for a spec that set none
  const along = surface.alongSet ? surface.along : (fallback || surface.along);
  const pf = surface.pattern ? patternFrame(surface.pattern.layers, along) : null;
  for (const f of faces) {
    if (!f || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    f.metal = { s: surface.key, d: surface.d, ta: +toolpathAngle(f.corners, along, axis).toFixed(4) };
    // a pattern-welded surface: each corner's place in the billet — its depth through the layers, its offset across
    // the blade and its distance along it — in the part's own frame, so the etch rides every later pose
    if (pf) f.metal.p = f.corners.map((c) => [+dot3(c, pf.L).toFixed(5), +dot3(c, pf.W).toFixed(5), +dot3(c, pf.R).toFixed(5)]);
    f.pbr = pbr;
  }
  return faces;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (a) => { const l = SM.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : null; };
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
/** A pattern's frame in the part: L through the layers, R along the pattern's run, W across (L × R). */
function patternFrame(layers, along) {
  const L = unit3(AXES[layers] || layers) || [0, 1, 0]; const run = unit3(AXES[along] || (Array.isArray(along) ? along : [0, 0, 1])) || [0, 0, 1];
  const W = unit3(cross3(L, run)) || unit3(cross3(L, Math.abs(L[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  return { L, W, R: run };
}
/**
 * The toolpath direction on a face as an angle (radians) from its first edge, measured about the face normal
 * n = e0 × e1. `along`: 'auto' (an elongated face's longest edge, else the part's x — y where x is the normal), 'x' | 'y' | 'z' or [x, y, z] (in the part's own frame), or
 * 'around' (circumferential about an axis: `axis = { at, dir }` when the generator knows one — a lathe's own —
 * else the part's z through its origin: a lathe's turning marks).
 */
export function toolpathAngle(corners, along = 'auto', axis = null) {
  const e0 = unit3(sub3(corners[1], corners[0])); const n = unit3(cross3(sub3(corners[1], corners[0]), sub3(corners[2], corners[0])));
  if (!e0 || !n) return 0;
  let t;
  if (along === 'auto') {
    // a clearly elongated face (a bar's side, a tube's strip) runs along its longest edge; anything squarer (a cap, a
    // panel, a fan triangle) takes the part's x, or its y where x is the normal — so coplanar faces agree
    let best = 0, bi = 0; for (let i = 0; i < corners.length; i++) { const l = SM.hypot(...sub3(corners[(i + 1) % corners.length], corners[i])); if (l > best + 1e-12) { best = l; bi = i; } }
    let area = 0; for (let i = 1; i + 1 < corners.length; i++) area += SM.hypot(...cross3(sub3(corners[i], corners[0]), sub3(corners[i + 1], corners[0]))) / 2;
    const across = best > 0 ? (corners.length === 3 ? 2 : 1) * area / best : 0;
    t = across > 0 && best / across > 2 ? sub3(corners[(bi + 1) % corners.length], corners[bi]) : (Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]);
  }
  else if (along === 'around') { const c = corners.reduce((a, p) => [a[0] + p[0] / corners.length, a[1] + p[1] / corners.length, a[2] + p[2] / corners.length], [0, 0, 0]);
    t = axis ? cross3(axis.dir, sub3(c, axis.at)) : cross3([0, 0, 1], c);
    if (SM.hypot(...t) < 1e-9) { const a = axis ? axis.dir : [0, 0, 1]; t = cross3(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]); } }
  else t = along === 'x' ? [1, 0, 0] : along === 'y' ? [0, 1, 0] : along === 'z' ? [0, 0, 1] : along;
  // project into the face plane; a tangent along the normal has no in-plane direction → the first edge
  const tp = unit3(sub3(t, n.map((v) => v * dot3(t, n)))); if (!tp) return 0;
  return SM.atan2(dot3(cross3(e0, tp), n), dot3(e0, tp));
}
