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
 * Two rungs, both measurements over what the recipe SAYS or what the export
 * WROTE — never a kernel in the recipe:
 *  1. DECLARED thicknesses (this file): the recipe's own `wallThickness`,
 *     sweep radii, lathe necks, against the profile's floor; the printed box
 *     against the bed.
 *  2. MEASURED facts over the exported soup (`print-measure.js`,
 *     text-to-cad-seam.plan.md T2): overhang area against the process's
 *     self-support angle, the support footprint, a SAMPLED wall thickness by
 *     inward ray, an orientation hint. No distance field is built; a sample
 *     along the normal is what it is and says so.
 * What neither rung can see, the slicer's own analysis is the next rung.
 *
 * The PROCESS table (text-to-cad-seam.plan.md T1) words both rungs per
 * manufacturing process. Numbers are design-guide defaults for a typical
 * machine, not a promise about yours — override any field.
 *
 * Pure: no DB, no three.js, unit-testable in node.
 */

/**
 * Per-process limits. `min_wall_mm` is the thinnest honest wall; `self_support_deg`
 * is the angle FROM VERTICAL up to which a face prints without support (null =
 * the process supports everything — powder). `trapped_volume` marks processes
 * where an enclosed cavity needs an escape hole (unmeasured here; flagged).
 * Sources: Prusa knowledge base (FDM two perimeters at 0.4 mm, 45° rule);
 * Formlabs design guide (SLA ≈0.5 mm supported walls, 19–30° self-support
 * depending on layer height — 30° is the lenient end); HP MJF / EOS SLS design
 * guides (≈0.7–1.0 mm walls, powder escape holes ≥ 2–3 mm, no support angle).
 */
export const PROCESS_LIMITS = Object.freeze({
  fdm: Object.freeze({ nozzle_mm: 0.4, layer_mm: 0.2, min_wall_mm: 0.8, self_support_deg: 45, bed_mm: Object.freeze([220, 220, 250]), trapped_volume: false }),
  sla: Object.freeze({ nozzle_mm: null, layer_mm: 0.05, min_wall_mm: 0.5, self_support_deg: 30, bed_mm: Object.freeze([145, 145, 175]), trapped_volume: true }),
  sls: Object.freeze({ nozzle_mm: null, layer_mm: 0.1, min_wall_mm: 0.7, self_support_deg: null, bed_mm: Object.freeze([300, 300, 300]), trapped_volume: true }),
  mjf: Object.freeze({ nozzle_mm: null, layer_mm: 0.08, min_wall_mm: 1.0, self_support_deg: null, bed_mm: Object.freeze([380, 284, 380]), trapped_volume: true }),
});

// The default is the FDM desk printer: 0.4 mm nozzle, 0.2 mm layers, two
// perimeters as the thinnest honest wall, 45° self-support, a 220 × 220 × 250 mm
// bed (Prusa MK-class / Ender).
export const PRINTER_DEFAULT = Object.freeze({
  process: 'fdm',
  ...PROCESS_LIMITS.fdm,
});

const posNum = (v) => Number.isFinite(v) && v > 0;

/**
 * resolvePrinter(input) → a complete profile. `null`/undefined = the default;
 * `process` picks a row of PROCESS_LIMITS, then explicit fields override (a
 * `nozzle_mm` without `min_wall_mm` implies two perimeters = 2 × nozzle;
 * `self_support_deg: null` says "supports everything"). Throws on a malformed
 * field.
 */
export function resolvePrinter(input) {
  if (input == null) return { ...PRINTER_DEFAULT, bed_mm: [...PRINTER_DEFAULT.bed_mm] };
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('`printer` must be an object { process?, nozzle_mm?, layer_mm?, min_wall_mm?, self_support_deg?, bed_mm?:[x,y,z] }');
  }
  let process = 'fdm';
  if (input.process !== undefined) {
    if (typeof input.process !== 'string' || !PROCESS_LIMITS[input.process]) {
      throw new Error(`\`printer.process\` must be one of ${Object.keys(PROCESS_LIMITS).join(' | ')}`);
    }
    process = input.process;
  }
  const base = PROCESS_LIMITS[process];
  const out = { process, ...base, bed_mm: [...base.bed_mm] };
  for (const k of ['nozzle_mm', 'layer_mm', 'min_wall_mm']) {
    if (input[k] === undefined) continue;
    if (k === 'nozzle_mm' && input[k] === null) { out.nozzle_mm = null; continue; } // no nozzle to name (resin / powder)
    if (!posNum(input[k])) throw new Error(`\`printer.${k}\` must be a positive number`);
    out[k] = input[k];
  }
  if (posNum(input.nozzle_mm) && input.min_wall_mm === undefined) out.min_wall_mm = 2 * input.nozzle_mm;
  if (input.self_support_deg !== undefined) {
    if (input.self_support_deg !== null && !(Number.isFinite(input.self_support_deg) && input.self_support_deg > 0 && input.self_support_deg < 90)) {
      throw new Error('`printer.self_support_deg` must be a number in (0, 90) — degrees from vertical — or null for a process that supports everything');
    }
    out.self_support_deg = input.self_support_deg;
  }
  if (input.bed_mm !== undefined) {
    if (!Array.isArray(input.bed_mm) || input.bed_mm.length !== 3 || !input.bed_mm.every(posNum)) {
      throw new Error('`printer.bed_mm` must be [x, y, z] positive millimetres');
    }
    out.bed_mm = input.bed_mm.map(Number);
  }
  return out;
}

// The floor's wording per process — FDM's floor is two perimeters of a nozzle;
// the others have no nozzle to name.
function floorPhrase(p) {
  return p.nozzle_mm ? `${p.min_wall_mm} mm two-perimeter floor for a ${p.nozzle_mm} mm nozzle` : `${p.min_wall_mm} mm ${p.process.toUpperCase()} wall floor`;
}

/**
 * declaredFeatures(manifest) → [{ at, role, value }] in WORLD units — every
 * thickness the recipe states outright. `role`: 'wall' (extrude wallThickness),
 * 'floor' (extrude floorThickness), 'section' (a sweep's tube diameter, a
 * lathe's narrowest real-radius station as a diameter), 'bore' (the same
 * numbers on a monomer a `cuts[]` entry SUBTRACTS — a hole's diameter, not a
 * strut's; parts-booleans.plan.md B4). Only the workbench monomer arrays
 * declare these; other kinds return [].
 */
export function declaredFeatures(manifest) {
  const out = [];
  if (!manifest || typeof manifest !== 'object') return out;
  // ids a cut subtracts: their diameters are HOLES (a bore too fine closes up), never sections
  const bores = new Set();
  for (const c of Array.isArray(manifest.cuts) ? manifest.cuts : []) {
    for (const id of Array.isArray(c && c.subtract) ? c.subtract : []) if (typeof id === 'string') bores.add(id);
  }
  const sectionRole = (s) => (s && typeof s.id === 'string' && bores.has(s.id) ? 'bore' : 'section');
  const boreTag = (s) => (sectionRole(s) === 'bore' ? ` (bore '${s.id}')` : '');
  const extrudes = Array.isArray(manifest.extrudes) ? manifest.extrudes : [];
  extrudes.forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    if (posNum(s.wallThickness)) out.push({ at: `extrudes[${i}].wallThickness`, role: 'wall', value: s.wallThickness });
    if (posNum(s.floorThickness)) out.push({ at: `extrudes[${i}].floorThickness`, role: 'floor', value: s.floorThickness });
  });
  const sweeps = Array.isArray(manifest.sweeps) ? manifest.sweeps : [];
  sweeps.forEach((s, i) => {
    if (s && posNum(s.radius)) out.push({ at: `sweeps[${i}].radius${boreTag(s)}`, role: sectionRole(s), value: 2 * s.radius });
  });
  const lathes = Array.isArray(manifest.lathes) ? manifest.lathes : [];
  lathes.forEach((s, i) => {
    if (!s || !Array.isArray(s.profile)) return;
    // The narrowest station with a REAL radius — a taper to 0 is a pole, not a neck.
    let min = Infinity;
    for (const st of s.profile) if (st && posNum(st.radius) && st.radius < min) min = st.radius;
    if (Number.isFinite(min)) out.push({ at: `lathes[${i}].profile (narrowest station)${boreTag(s)}`, role: sectionRole(s), value: 2 * min });
  });
  return out;
}

const r2 = (v) => Math.round(v * 100) / 100;

/**
 * printAdvisories({ manifest, scale, sizeMm, printer, measure }) → [{ kind, detail, at?, mm? }]
 *   thin_wall           — a declared wall/floor × scale is under `min_wall_mm`
 *   tiny_feature        — a declared cross-section × scale is under `min_wall_mm`;
 *                         or a `cuts[]` bore that fine (worded as a hole that closes up)
 *   over_bed            — the printed size exceeds `bed_mm` on an axis (as
 *                         exported; the slicer may still rotate it to fit)
 *   thin_wall_measured  — (rung 2) the sampled p05 wall thickness is under the floor
 *   overhang            — (rung 2) faces steeper than `self_support_deg` exist;
 *                         suppressed for a process that supports everything
 *   trapped_volume      — a powder / resin process: enclosed cavities need an
 *                         escape hole and are NOT measured here (always stated)
 * `scale` is the world-units → mm factor the export resolved; `sizeMm` the
 * exported bounds; `measure` the optional `measurePrintability` result. Empty
 * array = nothing to say. Never throws on a manifest.
 */
export function printAdvisories({ manifest = null, scale = 1, sizeMm = null, printer = null, measure = null } = {}) {
  const p = resolvePrinter(printer);
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const rows = [];
  for (const f of declaredFeatures(manifest)) {
    const mm = f.value * k;
    if (mm >= p.min_wall_mm) continue;
    if (f.role === 'bore') {
      rows.push({ kind: 'tiny_feature', at: f.at, mm: r2(mm), detail: `${f.at} is a hole ${r2(mm)} mm across — under the ${floorPhrase(p)}; it will close up or print as a pinhole; widen the bore or raise \`scale\`` });
    } else if (f.role === 'section') {
      rows.push({ kind: 'tiny_feature', at: f.at, mm: r2(mm), detail: `${f.at} prints ${r2(mm)} mm across — under the ${floorPhrase(p)}; it will print as a thread or not at all` });
    } else {
      rows.push({ kind: 'thin_wall', at: f.at, mm: r2(mm), detail: `${f.at} prints ${r2(mm)} mm thick — under the ${floorPhrase(p)}; thicken it or raise \`scale\`` });
    }
  }
  if (Array.isArray(sizeMm) && sizeMm.length === 3 && sizeMm.every(Number.isFinite)) {
    const over = [0, 1, 2].filter((i) => sizeMm[i] > p.bed_mm[i]);
    if (over.length) {
      rows.push({ kind: 'over_bed', mm: sizeMm.map(r2), detail: `prints ${sizeMm.map(r2).join(' × ')} mm — over the ${p.bed_mm.join(' × ')} mm bed on ${over.map((i) => 'xyz'[i]).join(', ')}; lower \`target_mm\` / \`scale\`, or split the part` });
    }
  }
  // Rung 2 — what the exported soup measured (print-measure.js). Advisory like the rest.
  if (measure && typeof measure === 'object') {
    const w = measure.walls;
    if (w && w.measured && Number.isFinite(w.p05_mm) && w.p05_mm < p.min_wall_mm) {
      rows.push({ kind: 'thin_wall_measured', mm: r2(w.p05_mm), detail: `sampled walls reach ${r2(w.p05_mm)} mm at the 5th percentile (thinnest ${r2(w.min_mm)} mm, ${w.sampled} samples) — under the ${floorPhrase(p)}; a wall the recipe did not declare, or a fillet / taper thinner than its station` });
    }
    const o = measure.overhang;
    if (o && p.self_support_deg != null && Number.isFinite(o.area_mm2) && o.area_mm2 > 0) {
      const hint = measure.orientation && measure.orientation.best && measure.orientation.best !== 'z+'
        ? `; least support if built along ${measure.orientation.best}`
        : '';
      rows.push({ kind: 'overhang', mm: r2(o.area_mm2), detail: `${r2(o.area_mm2)} mm² of faces (${Math.round((o.fraction || 0) * 100)}% of the surface, steepest ${Math.round(o.worst_deg)}° from vertical) exceed the ${p.self_support_deg}° self-support limit — orient, or expect supports over ≈${r2(measure.support?.footprint_mm2 ?? 0)} mm² of footprint${hint}` });
    }
  }
  if (p.trapped_volume) {
    rows.push({ kind: 'trapped_volume', detail: `${p.process.toUpperCase()} traps ${p.process === 'sla' ? 'resin' : 'powder'} in any enclosed cavity — an escape hole is needed and cavities are NOT measured here; check hollow parts by eye` });
  }
  return rows;
}

/** advisoryLines(rows) → README/note strings; one line saying "none" when clean. */
export function advisoryLines(rows, printer = null) {
  const p = resolvePrinter(printer);
  const head = `print advisories (profile: ${p.process.toUpperCase()}${p.nozzle_mm ? `, ${p.nozzle_mm} mm nozzle` : ''}, ${p.min_wall_mm} mm min wall${p.self_support_deg != null ? `, ${p.self_support_deg}° self-support` : ''}, ${p.bed_mm.join(' × ')} mm bed)`;
  if (!rows || !rows.length) return [`${head}: none — every declared feature clears the floor and the part fits the bed`];
  return [`${head}:`, ...rows.map((r) => `  - ${r.kind}: ${r.detail}`)];
}
