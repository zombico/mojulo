/**
 * print-advisory — the print leg's manufacturability ADVISORIES
 * (continuous-guardrails.plan.md G3).
 *
 * The closure audit says whether the rims are closed; the slicer gate says
 * whether it slices. Neither owns a number a printer cares about BEFORE the
 * slice: is a declared wall thinner than the nozzle can lay, does the part fit
 * the bed, is a declared feature too fine to exist. This module owns those
 * numbers as a small printer profile and turns them into `{ kind, detail }`
 * rows the export result, README, and `measure_solid` all carry.
 *
 * Posture (cad-aid.plan.md, settled): ADVISORY, never a refusal by default —
 * `export_model strict:true` is the operator asking for a hard stop (G4).
 * DECLARED thicknesses only: the recipe's own `wallThickness`, sweep radii,
 * lathe necks. Measuring a mesh's thinnest wall is a distance field over the
 * printable set — a mesh kernel, a non-goal. What the recipe did not declare
 * is not judged here; the slicer's own analysis is the next rung.
 *
 * Pure: no DB, no three.js, unit-testable in node.
 */

// A common FDM desk printer: 0.4 mm nozzle, 0.2 mm layers, two perimeters as
// the thinnest honest wall, a 220 × 220 × 250 mm bed (Prusa MK-class / Ender).
export const PRINTER_DEFAULT = Object.freeze({
  nozzle_mm: 0.4,
  layer_mm: 0.2,
  min_wall_mm: 0.8,
  bed_mm: Object.freeze([220, 220, 250]),
});

const posNum = (v) => Number.isFinite(v) && v > 0;

/**
 * resolvePrinter(input) → a complete profile. `null`/undefined = the default;
 * a partial object overrides fields (a `nozzle_mm` without `min_wall_mm`
 * implies two perimeters = 2 × nozzle). Throws on a malformed field.
 */
export function resolvePrinter(input) {
  const out = { ...PRINTER_DEFAULT, bed_mm: [...PRINTER_DEFAULT.bed_mm] };
  if (input == null) return out;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('`printer` must be an object { nozzle_mm?, layer_mm?, min_wall_mm?, bed_mm?:[x,y,z] }');
  }
  for (const k of ['nozzle_mm', 'layer_mm', 'min_wall_mm']) {
    if (input[k] === undefined) continue;
    if (!posNum(input[k])) throw new Error(`\`printer.${k}\` must be a positive number`);
    out[k] = input[k];
  }
  if (input.nozzle_mm !== undefined && input.min_wall_mm === undefined) out.min_wall_mm = 2 * input.nozzle_mm;
  if (input.bed_mm !== undefined) {
    if (!Array.isArray(input.bed_mm) || input.bed_mm.length !== 3 || !input.bed_mm.every(posNum)) {
      throw new Error('`printer.bed_mm` must be [x, y, z] positive millimetres');
    }
    out.bed_mm = input.bed_mm.map(Number);
  }
  return out;
}

/**
 * declaredFeatures(manifest) → [{ at, role, value }] in WORLD units — every
 * thickness the recipe states outright. `role`: 'wall' (extrude wallThickness),
 * 'floor' (extrude floorThickness), 'section' (a sweep's tube diameter, a
 * lathe's narrowest real-radius station as a diameter). Only the workbench
 * monomer arrays declare these; other kinds return [].
 */
export function declaredFeatures(manifest) {
  const out = [];
  if (!manifest || typeof manifest !== 'object') return out;
  const extrudes = Array.isArray(manifest.extrudes) ? manifest.extrudes : [];
  extrudes.forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    if (posNum(s.wallThickness)) out.push({ at: `extrudes[${i}].wallThickness`, role: 'wall', value: s.wallThickness });
    if (posNum(s.floorThickness)) out.push({ at: `extrudes[${i}].floorThickness`, role: 'floor', value: s.floorThickness });
  });
  const sweeps = Array.isArray(manifest.sweeps) ? manifest.sweeps : [];
  sweeps.forEach((s, i) => {
    if (s && posNum(s.radius)) out.push({ at: `sweeps[${i}].radius`, role: 'section', value: 2 * s.radius });
  });
  const lathes = Array.isArray(manifest.lathes) ? manifest.lathes : [];
  lathes.forEach((s, i) => {
    if (!s || !Array.isArray(s.profile)) return;
    // The narrowest station with a REAL radius — a taper to 0 is a pole, not a neck.
    let min = Infinity;
    for (const st of s.profile) if (st && posNum(st.radius) && st.radius < min) min = st.radius;
    if (Number.isFinite(min)) out.push({ at: `lathes[${i}].profile (narrowest station)`, role: 'section', value: 2 * min });
  });
  return out;
}

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * printAdvisories({ manifest, scale, sizeMm, printer }) → [{ kind, detail, at? }]
 *   thin_wall     — a declared wall/floor × scale is under `min_wall_mm`
 *   tiny_feature  — a declared cross-section × scale is under `min_wall_mm`
 *   over_bed      — the printed size exceeds `bed_mm` on an axis (as exported;
 *                   the slicer may still rotate it to fit)
 * `scale` is the world-units → mm factor the export resolved; `sizeMm` the
 * exported bounds. Empty array = nothing to say. Never throws on a manifest.
 */
export function printAdvisories({ manifest = null, scale = 1, sizeMm = null, printer = null } = {}) {
  const p = resolvePrinter(printer);
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const rows = [];
  for (const f of declaredFeatures(manifest)) {
    const mm = f.value * k;
    if (mm >= p.min_wall_mm) continue;
    if (f.role === 'section') {
      rows.push({ kind: 'tiny_feature', at: f.at, mm: r2(mm), detail: `${f.at} prints ${r2(mm)} mm across — under the ${p.min_wall_mm} mm two-perimeter floor for a ${p.nozzle_mm} mm nozzle; it will print as a thread or not at all` });
    } else {
      rows.push({ kind: 'thin_wall', at: f.at, mm: r2(mm), detail: `${f.at} prints ${r2(mm)} mm thick — under the ${p.min_wall_mm} mm two-perimeter floor for a ${p.nozzle_mm} mm nozzle; thicken it or raise \`scale\`` });
    }
  }
  if (Array.isArray(sizeMm) && sizeMm.length === 3 && sizeMm.every(Number.isFinite)) {
    const over = [0, 1, 2].filter((i) => sizeMm[i] > p.bed_mm[i]);
    if (over.length) {
      rows.push({ kind: 'over_bed', mm: sizeMm.map(r2), detail: `prints ${sizeMm.map(r2).join(' × ')} mm — over the ${p.bed_mm.join(' × ')} mm bed on ${over.map((i) => 'xyz'[i]).join(', ')}; lower \`target_mm\` / \`scale\`, or split the part` });
    }
  }
  return rows;
}

/** advisoryLines(rows) → README/note strings; one line saying "none" when clean. */
export function advisoryLines(rows, printer = null) {
  const p = resolvePrinter(printer);
  const head = `print advisories (profile: ${p.nozzle_mm} mm nozzle, ${p.min_wall_mm} mm min wall, ${p.bed_mm.join(' × ')} mm bed)`;
  if (!rows || !rows.length) return [`${head}: none — every declared feature clears the floor and the part fits the bed`];
  return [`${head}:`, ...rows.map((r) => `  - ${r.kind}: ${r.detail}`)];
}
