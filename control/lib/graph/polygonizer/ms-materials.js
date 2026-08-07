/**
 * ms-materials — the specular finish shelf for mobile-suit (MS) body panels.
 *
 * The g-series / z-series liveries color panels by ROLE (armor / panel / hardware /
 * frame / identity / signal / emblem / eyes). This module maps those same roles to
 * a material-shelf finish (polygonizer/materials.js) so a suit picks up a live
 * Blinn-Phong highlight through the World's specular channel — armor reads eggshell,
 * joints read metallic, the eye glow keeps its pure tint.
 *
 * DIFFUSE-PRESERVING BY DESIGN: every role finish carries ambient/diffuse EQUAL to
 * the workbench studio light (worlds/workbench.js WORKBENCH_LIGHT), so shadeHexMat's
 * camera-independent Lambert term is byte-identical to the no-material shadeHex path
 * (material-response: `material.ambient ?? light.ambient`). The ONLY thing a finish
 * adds is the view-dependent `spec` face tag → the live highlight. So stamping a suit
 * changes nothing about its baked look except that panels now catch the light.
 *
 * Layering note: these two constants MUST track WORKBENCH_LIGHT's ambient/diffuse.
 * They are duplicated (not imported) to keep polygonizer/ free of a worlds/ import;
 * if WORKBENCH_LIGHT's ambient/diffuse ever change, change these with them.
 */

export const MS_MAT_AMBIENT = 0.5;   // == WORKBENCH_LIGHT.ambient
export const MS_MAT_DIFFUSE = 0.56;  // == WORKBENCH_LIGHT.diffuse

// A role finish: a shelf preset with the studio-matched response + a specular
// strength/tightness. `base`/emissive/cel are never set, so only the highlight is new.
const finish = (specular, shininess, preset = 'satin') =>
  ({ preset, ambient: MS_MAT_AMBIENT, diffuse: MS_MAT_DIFFUSE, specular, shininess });

/**
 * role → finish. Roles ABSENT here (eyes / eye / marking) get no material: the eye
 * glow and painted markings keep their pure tint. armor eggshell; panel a touch
 * glossier; hardware metallic joints (gunmetal); frame a faint dark sheen; emblem
 * the gold points catching a metallic glint.
 */
export const MS_ROLE_MATERIALS = {
  armor:    finish(0.18, 14),
  identity: finish(0.18, 14),
  signal:   finish(0.18, 14),
  panel:    finish(0.22, 16),
  hardware: finish(0.42, 26, 'gunmetal'),
  frame:    finish(0.12, 10, 'rubber'),
  emblem:   finish(0.50, 22, 'gold'),
};

/** The finish for a classified role, or null (role gets no specular). */
export function msRoleMaterial(role) {
  return role && Object.prototype.hasOwnProperty.call(MS_ROLE_MATERIALS, role)
    ? MS_ROLE_MATERIALS[role] : null;
}

const MONOMER_KEYS = ['lathes', 'extrudes', 'sweeps', 'reliefs'];
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

// Every hex-tinted body monomer in an assembler/workbench-shaped manifest, in place
// order. Shield items are skipped (mounted kit keeps its own finish), mirroring the
// livery tint walk.
function* bodyMonomers(manifest) {
  const sources = Array.isArray(manifest?.items)
    ? manifest.items.filter((it) => !/shield/i.test(String(it?.id || ''))).map((it) => it?.source)
    : [manifest];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of MONOMER_KEYS) {
      for (const m of Array.isArray(source[key]) ? source[key] : []) {
        if (m && isHex(m.tint)) yield m;
      }
    }
  }
}

// Merge the studio-matched ambient/diffuse UNDER a caller ref (a bare preset name,
// a '#hex', or a material object) unless the ref sets its own — so a uniform finish
// adds specular without shifting the baked diffuse. preserveResponse:false passes
// the ref through untouched (the shelf row's own ambient/diffuse — a full re-finish).
function withResponse(ref, preserveResponse) {
  if (!preserveResponse) return ref;
  if (ref && typeof ref === 'object') {
    return { ...ref, ambient: ref.ambient ?? MS_MAT_AMBIENT, diffuse: ref.diffuse ?? MS_MAT_DIFFUSE };
  }
  if (typeof ref === 'string' && ref.startsWith('#')) {
    return { preset: 'satin', base: ref, ambient: MS_MAT_AMBIENT, diffuse: MS_MAT_DIFFUSE };
  }
  return { preset: ref, ambient: MS_MAT_AMBIENT, diffuse: MS_MAT_DIFFUSE };
}

/**
 * Stamp ONE finish onto every body monomer of a suit manifest (a uniform clear-coat).
 * Pure: returns a deep clone; the input is untouched. `ref` is any material-shelf
 * reference (a preset name, a '#hex' tint, or an object). By default the diffuse is
 * preserved so only specular is added; pass `preserveResponse:false` to apply the
 * material's full response. Series-agnostic — used by bakeUnitRig's `material` option
 * for base units that carry no livery role split. Role-differentiated finishes come
 * from the liveries, which classify each panel (see applyGSeriesLivery `material`).
 */
export function stampUniformMaterial(manifest, ref, { preserveResponse = true } = {}) {
  const clone = structuredClone(manifest);
  const mat = withResponse(ref, preserveResponse);
  for (const m of bodyMonomers(clone)) m.material = mat;
  return clone;
}
