/**
 * materials-gate — the pure half of the engine legs' MATERIALS probe
 * (interchange-next.plan.md N5; driven by scripts/export-godot.mjs and
 * scripts/export-unity.mjs). The question is narrow: did the engine's importer
 * build the shading the GLB DECLARES — KHR_materials_unlit on a primitive ⇒ an
 * unshaded material, a real pbrMetallicRoughness ⇒ a shaded one — and did its
 * KHR_lights_punctual become lights? `--lit` only labels the run: an unlit export
 * may carry a PBR emissive disc, a lit export keeps its unlit stickers, and both
 * are right as long as the importer built what the file says. Advisory verdicts:
 * every check is a named boolean with the two numbers beside it.
 */

function glbJson(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB (magic)');
  const jsonLen = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
}

/**
 * declaredShading(glbBuffer) → what the file says, counted two ways: per PRIMITIVE
 * (Godot builds one surface per primitive) and per MATERIAL (glTFast builds one
 * Material per glTF material), plus the punctual lights the file carries.
 */
export function declaredShading(buf) {
  const j = glbJson(buf);
  const materials = Array.isArray(j.materials) ? j.materials : [];
  const isUnlit = (m) => !!(m && m.extensions && m.extensions.KHR_materials_unlit);
  const out = { primitives: 0, unlit_primitives: 0, pbr_primitives: 0, materials: materials.length, unlit_materials: 0, pbr_materials: 0, lights: 0 };
  for (const m of materials) { if (isUnlit(m)) out.unlit_materials++; else out.pbr_materials++; }
  for (const mesh of j.meshes || []) {
    for (const p of mesh.primitives || []) {
      out.primitives++;
      const m = p.material == null ? null : materials[p.material];
      if (m == null || isUnlit(m)) out.unlit_primitives++; else out.pbr_primitives++;   // no material = glTF default = unlit look in mojulo's terms
    }
  }
  out.lights = j.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
  return out;
}

/** Sum several files' declarations (a game pack has one GLB per level). */
export function sumDeclared(list) {
  const keys = ['primitives', 'unlit_primitives', 'pbr_primitives', 'materials', 'unlit_materials', 'pbr_materials', 'lights'];
  return list.reduce((acc, d) => { for (const k of keys) acc[k] += d[k] || 0; return acc; }, Object.fromEntries(keys.map((k) => [k, 0])));
}

/**
 * compareShading({ declared, built, unit }) → { ok, checks }. `unit` is 'primitives'
 * (built = { surfaces, unshaded, shaded, lights }) or 'materials'
 * (built = { materials, unlit, lit, lights }). `lights_as_declared` is null when the
 * file carries no lights (nothing to check), never a pass by default.
 */
export function compareShading({ declared, built, unit = 'primitives' } = {}) {
  const d = declared || {}; const b = built || {};
  const checks = {};
  if (unit === 'materials') {
    checks.materials_built = { expected: d.materials ?? null, got: b.materials ?? null, ok: b.materials != null && d.materials != null ? b.materials === d.materials : null };
    checks.unlit_as_declared = { expected: d.unlit_materials ?? null, got: b.unlit ?? null, ok: b.unlit != null && d.unlit_materials != null ? b.unlit === d.unlit_materials : null };
    checks.shaded_as_declared = { expected: d.pbr_materials ?? null, got: b.lit ?? null, ok: b.lit != null && d.pbr_materials != null ? b.lit === d.pbr_materials : null };
  } else {
    checks.surfaces_built = { expected: d.primitives ?? null, got: b.surfaces ?? null, ok: b.surfaces != null && d.primitives != null ? b.surfaces === d.primitives : null };
    checks.unlit_as_declared = { expected: d.unlit_primitives ?? null, got: b.unshaded ?? null, ok: b.unshaded != null && d.unlit_primitives != null ? b.unshaded === d.unlit_primitives : null };
    checks.shaded_as_declared = { expected: d.pbr_primitives ?? null, got: b.shaded ?? null, ok: b.shaded != null && d.pbr_primitives != null ? b.shaded === d.pbr_primitives : null };
  }
  checks.lights_as_declared = { expected: d.lights ?? null, got: b.lights ?? null, ok: (d.lights ?? 0) > 0 && b.lights != null ? b.lights === d.lights : null };
  const values = Object.values(checks).map((c) => c.ok).filter((v) => v !== null);
  return { ok: values.length > 0 && values.every(Boolean), checks };
}
