/**
 * world-units.js — the ONE place a recipe's authoring unit becomes a number
 * (world-contract-tiers, D1).
 *
 * Until now three tables agreed by convention: UNIT_TO_MM in the export tool (print + USD),
 * UNIT_TO_M in blender-pack.js, and FLOORPLAN_METERS_PER_UNIT hard-wired into one floorplan
 * assembler. The lounge landed in Unreal at 3.28× because the GLB root read one table and
 * the walker another. Now: a manifest may declare `units`; a kind family may have an
 * AUTHORING unit when its recipes never say (the floorplan family is feet); everything that
 * needs a factor asks here. Pure — no dice, no clock, no engine knowledge.
 */

// Declared-unit label → metres per unit. The millimetre table is derived, never restated.
export const UNIT_TO_M = Object.freeze({ mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 });

/**
 * Kind families whose recipes are authored in a unit other than metres and never carry a
 * `units` label of their own. A row here is a declaration about the KIND, so it belongs
 * beside the kind's own constants; add a row only after reading the builder (a walker's
 * eye of 5.4 in a metre world is the tell). Kinds absent here are metres by the
 * substrate's pinned MOJULO_UNITS.
 */
export const AUTHORING_UNITS = Object.freeze({
  floorplan: 'ft',
  restaurant: 'ft',
});

/** metersPerUnitFor(units) → metres per unit; unknown or absent label ⇒ 1 (metres). */
export function metersPerUnitFor(units) {
  if (typeof units !== 'string') return 1;
  const m = UNIT_TO_M[units.trim().toLowerCase()];
  return Number.isFinite(m) ? m : 1;
}

/** unitMillimetres(units) → millimetres per unit, or null for an unknown / absent label. */
export function unitMillimetres(units) {
  if (typeof units !== 'string') return null;
  const m = UNIT_TO_M[units.trim().toLowerCase()];
  return Number.isFinite(m) ? m * 1000 : null;
}

/**
 * declaredUnits(manifest) → { units, source } | null.
 *   source 'manifest' — the recipe carries `units` itself (the workbench family).
 *   source 'kind'     — the kind family's authoring unit (AUTHORING_UNITS).
 * null when neither says: the substrate's metres apply.
 */
export function declaredUnits(manifest = {}) {
  if (manifest && typeof manifest.units === 'string' && manifest.units.trim()) {
    return { units: manifest.units.trim(), source: 'manifest' };
  }
  const kind = manifest && typeof manifest.kind === 'string' ? manifest.kind : null;
  const u = kind ? AUTHORING_UNITS[kind] : undefined;
  return u ? { units: u, source: 'kind' } : null;
}

/** unitsLabel(manifest) → the bare label declaredUnits resolves to, or null. */
export function unitsLabel(manifest = {}) {
  const d = declaredUnits(manifest);
  return d ? d.units : null;
}
