/**
 * strength/materials.js — the mechanical material table the strength sensor reads.
 *
 * "Material" elsewhere in mojulo is appearance (chrome, marble, a wood colour). This table is the other
 * meaning: how stiff and how strong a material is, and how much that varies. Every value is a TYPICAL
 * figure from public datasheets and handbooks, never a guarantee. The reading stamps "check the supplier
 * datasheet" beside it, as the mech library's standard tables do.
 *
 * Units are the engineer's consistent set: N, mm, MPa (= N/mm²). Density is g/cm³, temperature °C.
 *
 *   E        Young's modulus along the strong direction (MPa)
 *   strength the failure stress the check compares against (MPa), on the `basis` named:
 *              'yield' for ductile metals and plastics, 'ultimate' for brittle ones,
 *              'mor' (modulus of rupture, bending) for clear wood
 *   ultimate the tensile (ultimate) strength, MPa, where the table's `strength` is a yield. Only the tensile
 *            view's curve reads it (hardening from yield to ultimate); no check judges against it.
 *   elong    elongation at break (%). Below 5 % the material is treated as brittle: stress raisers count
 *            even under a static load, and it fails without warning.
 *   cov      coefficient of variation of strength (spread ÷ mean). Feeds the material-certainty grade.
 *   nu       Poisson's ratio (shear modulus G = E / 2(1 + ν))
 *   serviceC the temperature above which the numbers stop applying (heat deflection for plastics)
 *   creep    true when a sustained load keeps deforming it over days and weeks at room temperature
 *   layer    for printed processes: the share of in-plane strength and stiffness left when stress pulls
 *            the layers apart. 1 for an isotropic process.
 *   grain    for wood: { E, strength } across the grain
 *
 * Changing an entry changes readings over stored rows: treat each number as a compatibility promise and
 * note any change in the changelog.
 */

const M = (id, o) => ({ id, ...o });

export const MATERIALS = Object.freeze({
  // ── printed: FDM, 100 % infill, printed on a well-tuned machine. In-plane (XY) values. ──
  pla:      M('pla',      { label: 'PLA (FDM)',          family: 'fdm',     E: 3200,  strength: 50,  basis: 'ultimate', elong: 4,   density: 1.24, nu: 0.36, cov: 0.15, serviceC: 55,  creep: true,  layer: 0.5 }),
  petg:     M('petg',     { label: 'PETG (FDM)',         family: 'fdm',     E: 2000,  strength: 45,  basis: 'yield',    elong: 20,  density: 1.27, nu: 0.38, cov: 0.12, serviceC: 70,  creep: true,  layer: 0.6 }),
  abs:      M('abs',      { label: 'ABS (FDM)',          family: 'fdm',     E: 2100,  strength: 38,  basis: 'yield',    elong: 8,   density: 1.04, nu: 0.35, cov: 0.15, serviceC: 90,  creep: true,  layer: 0.5 }),
  asa:      M('asa',      { label: 'ASA (FDM)',          family: 'fdm',     E: 2000,  strength: 40,  basis: 'yield',    elong: 10,  density: 1.07, nu: 0.35, cov: 0.15, serviceC: 90,  creep: true,  layer: 0.5 }),
  'pa-cf':  M('pa-cf',    { label: 'Nylon-CF (FDM)',     family: 'fdm',     E: 7000,  strength: 80,  basis: 'ultimate', elong: 3,   density: 1.15, nu: 0.35, cov: 0.15, serviceC: 120, creep: true,  layer: 0.4 }),
  // ── printed: powder bed and resin, close to isotropic ──
  pa12:     M('pa12',     { label: 'PA12 (SLS/MJF)',     family: 'powder',  E: 1700,  strength: 48,  basis: 'yield',    elong: 15,  density: 1.01, nu: 0.39, cov: 0.08, serviceC: 95,  creep: true,  layer: 0.9 }),
  resin:    M('resin',    { label: 'Standard resin (SLA)', family: 'resin', E: 2500,  strength: 55,  basis: 'ultimate', elong: 5,   density: 1.15, nu: 0.38, cov: 0.12, serviceC: 50,  creep: true,  layer: 0.95 }),
  'tough-resin': M('tough-resin', { label: 'Tough resin (SLA)', family: 'resin', E: 1600, strength: 45, basis: 'yield', elong: 25, density: 1.15, nu: 0.38, cov: 0.12, serviceC: 50, creep: true, layer: 0.95 }),
  // ── stock metals ──
  'al-6061': M('al-6061', { label: 'Aluminium 6061-T6',  family: 'metal',   E: 68900, strength: 276, ultimate: 310, basis: 'yield', elong: 12,  density: 2.70, nu: 0.33, cov: 0.05, serviceC: 150, creep: false, layer: 1 }),
  s235:     M('s235',     { label: 'Mild steel S235',    family: 'metal',   E: 210000, strength: 235, ultimate: 360, basis: 'yield',  elong: 26,  density: 7.85, nu: 0.30, cov: 0.06, serviceC: 300, creep: false, layer: 1 }),
  'steel-1045': M('steel-1045', { label: 'Steel 1045 (hot rolled)', family: 'metal', E: 205000, strength: 310, ultimate: 565, basis: 'yield', elong: 16, density: 7.85, nu: 0.29, cov: 0.06, serviceC: 300, creep: false, layer: 1 }),
  'ss-304': M('ss-304',   { label: 'Stainless 304',      family: 'metal',   E: 193000, strength: 215, ultimate: 505, basis: 'yield',  elong: 40,  density: 8.00, nu: 0.29, cov: 0.06, serviceC: 400, creep: false, layer: 1 }),
  brass:    M('brass',    { label: 'Brass C360 (half hard)', family: 'metal', E: 97000, strength: 310, ultimate: 385, basis: 'yield', elong: 20,  density: 8.50, nu: 0.31, cov: 0.07, serviceC: 150, creep: false, layer: 1 }),
  // ── stock plastics ──
  acrylic:  M('acrylic',  { label: 'Acrylic (cast PMMA)', family: 'polymer', E: 3200, strength: 70,  basis: 'ultimate', elong: 4,   density: 1.19, nu: 0.37, cov: 0.10, serviceC: 80,  creep: true,  layer: 1 }),
  pc:       M('pc',       { label: 'Polycarbonate',      family: 'polymer', E: 2350,  strength: 62,  ultimate: 65, basis: 'yield',  elong: 100, density: 1.20, nu: 0.37, cov: 0.08, serviceC: 125, creep: true,  layer: 1 }),
  // ── clear wood at 12 % moisture (USDA Wood Handbook). Along the grain; `grain` is across it. ──
  oak:      M('oak',      { label: 'Red oak',            family: 'wood',    E: 12500, strength: 99,  basis: 'mor',      elong: 1,   density: 0.63, nu: 0.35, cov: 0.16, serviceC: 65,  creep: true,  layer: 1, grain: { E: 960, strength: 5.5 } }),
  pine:     M('pine',     { label: 'White pine',         family: 'wood',    E: 8500,  strength: 59,  basis: 'mor',      elong: 1,   density: 0.35, nu: 0.35, cov: 0.16, serviceC: 65,  creep: true,  layer: 1, grain: { E: 450, strength: 2.1 } }),
  plywood:  M('plywood',  { label: 'Birch plywood',      family: 'wood',    E: 9000,  strength: 60,  basis: 'mor',      elong: 1,   density: 0.68, nu: 0.30, cov: 0.15, serviceC: 65,  creep: true,  layer: 1 }),
});

// Bolt property classes (ISO 898-1 / ISO 3506): yield (or 0.2 % proof) and tensile strength, MPa, and the minimum
// elongation after fracture, % (A2-70 typical).
export const BOLT_GRADES = Object.freeze({
  '4.6':   { yield: 240,  ultimate: 400,  elong: 22 },
  '5.8':   { yield: 400,  ultimate: 500,  elong: 10 },
  '8.8':   { yield: 640,  ultimate: 800,  elong: 12 },
  '10.9':  { yield: 940,  ultimate: 1040, elong: 9 },
  '12.9':  { yield: 1100, ultimate: 1220, elong: 8 },
  'A2-70': { yield: 450,  ultimate: 700,  elong: 20 },
});

export const PRINTED_FAMILIES = new Set(['fdm', 'powder', 'resin']);
export const isPrinted = (m) => PRINTED_FAMILIES.has(m.family);
export const isBrittle = (m) => m.elong < 5;
export const shearModulus = (m) => m.E / (2 * (1 + m.nu));

/** Resolve a material by id or by an inline object; throws with the known ids when it can't. */
export function resolveMaterial(spec) {
  if (spec && typeof spec === 'object') {
    for (const k of ['E', 'strength']) if (!(+spec[k] > 0)) throw new Error(`strength: an inline material needs a positive '${k}' (MPa)`);
    return { id: spec.id || 'custom', label: spec.label || 'custom material', family: spec.family || 'polymer', basis: spec.basis || 'yield',
      elong: spec.elong ?? 10, density: spec.density ?? 1, nu: spec.nu ?? 0.35, cov: spec.cov ?? 0.2, serviceC: spec.serviceC ?? 60,
      creep: spec.creep ?? true, layer: spec.layer ?? 1, ...spec, custom: true };
  }
  const m = MATERIALS[String(spec || '').toLowerCase()];
  if (!m) throw new Error(`strength: unknown material '${spec}'. Known: ${Object.keys(MATERIALS).join(', ')} — or pass { E, strength, … } inline (MPa).`);
  return m;
}

// Hankinson's formula (1921), the standard for off-axis wood and a fair fit for layered prints: the strength at
// an angle blends the strong and weak values harmonically, falling fast once the stress leaves the strong axis.
const hankinson = (weak, cos2Weak) => weak / (cos2Weak + weak * (1 - cos2Weak));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The share of the table's strength and stiffness left for a stress acting along `stressDir` (unit) when the
 * part is built along `buildDir` (unit). Stress straight across the layers keeps `layer`; stress in the layer
 * plane keeps 1; between, Hankinson. An unknown build direction takes the worst case and says so (known:false).
 * Stiffness loses far less than strength across layers; 0.8 is the typical floor for a dense FDM print.
 */
export function directionFactor(material, stressDir, buildDir) {
  if (material.family === 'wood') return grainFactor(material, stressDir, material.grainDir || null);
  const k = material.layer ?? 1;
  if (k >= 1) return { strength: 1, E: 1, across: 0, known: true };
  const kE = Math.max(k, 0.8);
  if (!buildDir) return { strength: k, E: kE, across: 1, known: false };
  const c = Math.abs(dot(stressDir, buildDir)); const across = c * c;
  return { strength: hankinson(k, across), E: hankinson(kE, across), across, known: true };
}

/** Wood: `grainDir` is the grain axis. Stress along it keeps the table values; across it, the `grain` entry. */
export function grainFactor(material, stressDir, grainDir) {
  if (!material.grain) return { strength: 1, E: 1, across: 0, known: !!grainDir };
  const s = material.grain.strength / material.strength, e = material.grain.E / material.E;
  if (!grainDir) return { strength: s, E: e, across: 1, known: false };
  const c = Math.abs(dot(stressDir, grainDir)); const across = 1 - c * c;
  return { strength: hankinson(s, across), E: hankinson(e, across), across, known: true };
}
