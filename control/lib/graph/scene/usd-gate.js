/**
 * usd-gate — the pure half of the USD verify gate (interchange-seams.plan.md seam 2,
 * driven by scripts/verify-usd.mjs). Compares what mojulo DECLARED it wrote
 * (the export_model result) with what a reader actually BUILT (Blender's headless
 * import report, or usdcat's parse) and returns a verdict block. Advisory, never
 * a refusal: every check is a named boolean with the two numbers beside it.
 */

// Blender-side size is metres (USD metersPerUnit applied at import); mojulo's is
// world units. A 5% band absorbs float drift and the instancer bounds approximation.
export function compareUsdGate({ exported, blender, tolerance = 0.05 } = {}) {
  const checks = {};
  const expectedTris = Number.isFinite(exported?.triangles) ? exported.triangles : null;
  checks.triangles = {
    expected: expectedTris,
    got: blender?.triangles ?? null,
    ok: expectedTris != null && blender?.triangles != null ? blender.triangles === expectedTris : null,
  };
  const mpu = Number.isFinite(exported?.meters_per_unit) ? exported.meters_per_unit : 1;
  const expectedM = Array.isArray(exported?.size_units) ? exported.size_units.map((v) => v * mpu) : null;
  const gotM = Array.isArray(blender?.size) ? blender.size : null;
  let sizeOk = null;
  if (expectedM && gotM) {
    sizeOk = expectedM.every((e, i) => {
      const g = gotM[i];
      if (e < 1e-6) return g < 1e-3;
      return Math.abs(g - e) <= Math.max(e * tolerance, 1e-4);
    });
  }
  checks.size_m = { expected: expectedM ? expectedM.map((v) => Math.round(v * 10000) / 10000) : null, got: gotM, ok: sizeOk, meters_per_unit: mpu };
  checks.vertex_colours = {
    expected: (exported?.nodes ?? 0) > 0,
    got: blender?.vertex_colour_meshes ?? null,
    ok: blender ? (blender.vertex_colour_meshes ?? 0) > 0 : null,
  };
  if (Number.isFinite(exported?.textures)) {
    checks.textures = { expected: exported.textures, got: blender?.textured_materials?.length ?? null, ok: blender ? (blender.textured_materials?.length ?? 0) >= 1 : null };
  }
  if (Number.isFinite(exported?.cameras)) {
    checks.cameras = { expected: exported.cameras, got: blender?.cameras ?? null, ok: blender ? blender.cameras === exported.cameras : null };
  }
  if (Array.isArray(exported?.humanoid_figures) && exported.humanoid_figures.length) {
    const want = ['hips', 'spine', 'head', 'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm', 'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'];
    const got = new Set((blender?.bones || []).map((b) => b.split(':').pop()));
    const missing = want.filter((w) => !got.has(w));
    checks.humanoid_bones = { expected: want.length, got: blender?.bones?.length ?? null, missing, ok: blender ? missing.length === 0 : null };
  }
  const values = Object.values(checks).map((c) => c.ok).filter((v) => v !== null);
  return { ok: values.length > 0 && values.every(Boolean), checks };
}
