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

/** Resolve a name, a #hex (→ satin tint), or an object { preset?, base?, … overrides }. */
export function resolveMaterial(m) {
  if (!m) return MATERIALS.steel;
  if (typeof m === 'string') return MATERIALS[m] || (m.startsWith('#') ? { ...MATERIALS.satin, base: m } : MATERIALS.steel);
  return { ...(MATERIALS[m.preset] || MATERIALS.satin), ...m };
}

/**
 * Validate a manifest-level material reference BEFORE resolveMaterial's forgiving
 * fallback swallows a typo ('golden' would silently become steel). Returns an error
 * string, or null when the reference is well-formed. null/undefined is fine (no material).
 */
export function validateMaterialRef(m) {
  if (m == null) return null;
  if (typeof m === 'string') {
    if (m.startsWith('#') || MATERIALS[m]) return null;
    return `unknown material '${m}' — use one of: ${MATERIAL_NAMES.join(', ')} (or a '#hex' tint, or { preset, …overrides })`;
  }
  if (typeof m === 'object') {
    if (m.preset != null && !MATERIALS[m.preset]) return `unknown material preset '${m.preset}' — use one of: ${MATERIAL_NAMES.join(', ')}`;
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
export function tagFacesWithMaterial(faces, mat) {
  if (!mat || !Array.isArray(faces)) return faces;
  const spec = mat.specular > 0 ? [mat.specular, mat.shininess || 16] : null;
  const pbr = materialPbr(mat);
  for (const f of faces) {
    if (!f) continue;
    if (spec) f.spec = spec;
    if (pbr) f.pbr = pbr;
  }
  return faces;
}
