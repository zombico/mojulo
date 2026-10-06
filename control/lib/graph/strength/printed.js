/**
 * strength/printed.js — a print's cross-section as the slicer lays it down: perimeter walls and top/bottom skins
 * at full strength, around an infill core that carries a fraction of it.
 *
 * The measured section (exact loops off the mesh) is filled on a grid aligned with the build direction as it
 * falls in the section plane. The core is what survives eroding it by the shell: the wall thickness
 * (walls × line width) across the build, the skin thickness (top_bottom × layer height) along it — a cross, since
 * perimeters are horizontal offsets and skins vertical ones. When the build runs along the member, the section IS
 * a layer and the walls are an even offset (a disk). Each row's spans are eroded exactly in x; rows are sampled
 * finely in y.
 *
 * The section is then the composite-beam ("transformed") section with the solid in-plane E as the reference:
 * the shell weighs 1 and the core kE, so A*, the centroid, I* and J* are the exact solid values minus (1 − kE) ×
 * the core's. Boundary fibres are shell fibres: σ = M·c / I* there. The core is checked on its own extreme
 * fibres at kE of the strain, against ks × the strength.
 *
 * Infill factors are Gibson–Ashby forms (Gibson & Ashby, Cellular Solids, 1997), typical and ±50 %:
 *   prismatic walls (grid, lines, triangles, honeycomb) with the stress along the build: they run with it, kE = ks = ρ
 *   bending-dominated (gyroid, cubic, or grid/honeycomb loaded across the build): kE = ρ², ks = 0.3 ρ^1.5
 *   triangles across the build (stretch-dominated): ρ/3;  lines (±45° per layer) across the build: ρ/4
 * Between the two directions the factors blend by cos² of the angle. `infill_E` / `infill_strength` (fractions
 * of solid, from your own test) override the table. Pure.
 */

import { toPlane } from './section.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export const PRINT_DEFAULTS = Object.freeze({ walls: 2, line_mm: 0.45, top_bottom: 4, layer_mm: 0.2, infill: 0.2, pattern: 'grid' });
const LAWS = {
  prism: (r) => ({ kE: r, ks: r }),
  bending: (r) => ({ kE: r * r, ks: 0.3 * r ** 1.5 }),
  stretch: (r) => ({ kE: r / 3, ks: r / 3 }),
  lines: (r) => ({ kE: r / 4, ks: r / 4 }),
};
export const PATTERNS = Object.freeze({
  grid: { along: 'prism', across: 'bending' },
  lines: { along: 'prism', across: 'lines' },
  triangles: { along: 'prism', across: 'stretch' },
  honeycomb: { along: 'prism', across: 'bending' },
  cubic: { along: 'bending', across: 'bending' },
  gyroid: { along: 'bending', across: 'bending' },
});

/** Problems with a print spec (the update_sketch gate), prefixed by `where`. */
export function printErrors(p, where = 'print') {
  if (p == null) return [];
  if (typeof p !== 'object') return [`${where} must be { walls, line_mm, top_bottom, layer_mm, infill, pattern }`];
  const errs = [];
  for (const k of ['walls', 'top_bottom']) if (p[k] != null && !(Number.isInteger(+p[k]) && +p[k] >= 0)) errs.push(`${where}.${k} must be a whole number ≥ 0`);
  for (const k of ['line_mm', 'layer_mm']) if (p[k] != null && !(+p[k] > 0)) errs.push(`${where}.${k} must be positive (mm)`);
  if (p.infill != null && !(+p.infill >= 0 && +p.infill <= 1)) errs.push(`${where}.infill must be a fraction 0–1 (0.2 = 20 %)`);
  if (p.pattern != null && !PATTERNS[p.pattern]) errs.push(`${where}.pattern must be one of ${Object.keys(PATTERNS).join(', ')}`);
  for (const k of ['infill_E', 'infill_strength']) if (p[k] != null && !(+p[k] >= 0 && +p[k] <= 1)) errs.push(`${where}.${k} must be a fraction of solid, 0–1`);
  return errs;
}

/** The print with defaults filled in, or null for a solid part (absent, or 100 % infill). */
export function resolvePrint(p) {
  if (p == null) return null;
  const q = { ...PRINT_DEFAULTS, ...p };
  for (const k of ['walls', 'line_mm', 'top_bottom', 'layer_mm', 'infill']) q[k] = +q[k];
  return q.infill >= 1 ? null : q;
}

/**
 * The core's stiffness and strength factors for a stress along unit `stressDir` in a part built along `buildDir`
 * (null: unknown, so the weaker of the two directions is taken).
 */
export function infillFactors(print, stressDir, buildDir) {
  const pat = PATTERNS[print.pattern] || PATTERNS.grid;
  const along = LAWS[pat.along](print.infill), across = LAWS[pat.across](print.infill);
  let kE, ks, basis;
  if (!buildDir) { kE = Math.min(along.kE, across.kE); ks = Math.min(along.ks, across.ks); basis = 'build unknown: the weaker direction'; }
  else {
    const c = stressDir[0] * buildDir[0] + stressDir[1] * buildDir[1] + stressDir[2] * buildDir[2]; const c2 = c * c;
    kE = c2 * along.kE + (1 - c2) * across.kE; ks = c2 * along.ks + (1 - c2) * across.ks;
    basis = c2 > 0.5 ? `${print.pattern}, stress along the build` : `${print.pattern}, stress across the build`;
  }
  const own = print.infill_E != null || print.infill_strength != null;
  if (print.infill_E != null) kE = +print.infill_E;
  if (print.infill_strength != null) ks = +print.infill_strength;
  return { kE, ks, basis: own ? 'your measured infill' : basis, own };
}

/**
 * printedSection(slice, props, print, buildDir, factors) → props for the printed section (same shape as
 * sectionProps', so every check reads it unchanged) plus `printed`, or the solid props when there is no core.
 */
export function printedSection(slice, props, print, buildDir, factors) {
  if (!print || props.empty) return props;
  const tw = print.walls * print.line_mm, ts = print.top_bottom * print.layer_mm;
  const b = buildDir ? toPlane(slice, buildDir) : null;
  const inPlane = b ? Math.hypot(b[0], b[1]) : 0;
  // e2 runs with the build as it falls in the plane; e1 across it
  const e2 = inPlane > 1e-6 ? [b[0] / inPlane, b[1] / inPlane] : [0, 1];
  const e1 = [e2[1], -e2[0]];
  // Across the layers (the build lies in the plane) perimeters are horizontal offsets and skins vertical ones:
  // a point is core when a horizontal reach of the wall thickness and a vertical reach of the skin thickness both
  // stay inside (a cross). Along a layer (the build runs with the member) the walls are an even offset: a disk.
  const layer = !b || inPlane < 0.5 ? (b ? 'disk' : 'cross') : 'cross';
  const ax = layer === 'disk' ? tw : (b ? tw : Math.min(tw, ts));
  const ay = layer === 'disk' ? tw : (b ? ts : Math.min(tw, ts));
  const loops = slice.loops.filter((L) => L.closed).map((L) => L.pts.map(([u, v]) => [u * e1[0] + v * e1[1], u * e2[0] + v * e2[1]]));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const L of loops) for (const [x, y] of L) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const ext = Math.max(x1 - x0, y1 - y0);
  // rows are spaced so the vertical reach is a whole number of them: the core's edge then falls on a row boundary
  const H = y1 - y0;
  const target = Math.min(ext / 160, ay > 0 ? ay / 12 : ext / 160);
  let m = ay > 0 ? Math.max(1, Math.ceil(ay / target)) : 0;
  let hy = ay > 0 ? ay / m : target;
  if (H / hy > 400) { hy = H / 400; m = Math.round(ay / hy); }
  const rows = Math.max(1, Math.ceil(H / hy - 1e-9));
  // each row's filled spans (even–odd over every loop, holes included)
  const spans = [];
  for (let j = 0; j < rows; j++) {
    const y = y0 + (j + 0.5) * hy; const xs = [];
    for (const L of loops) for (let i = 0; i < L.length; i++) {
      const [xa, ya] = L[i], [xb, yb] = L[(i + 1) % L.length];
      if ((ya > y) !== (yb > y)) xs.push(xa + ((y - ya) / (yb - ya)) * (xb - xa));
    }
    xs.sort((p, q) => p - q);
    const row = []; for (let k = 0; k + 1 < xs.length; k += 2) row.push([xs[k], xs[k + 1]]);
    spans.push(row);
  }
  const shrink = (row, w) => (w > 0 ? row.map(([lo, hi]) => [lo + w, hi - w]).filter(([lo, hi]) => hi > lo) : row);
  // the horizontal reach required at a row offset d: the cross needs the full wall only on its own row, the disk
  // a chord of the wall radius
  const reachAt = (d) => (layer === 'disk' ? Math.sqrt(Math.max(0, ax * ax - (Math.max(0, Math.abs(d) - 0.5) * hy) ** 2)) : d === 0 ? ax : 0);
  const clip = (A, B) => { const o = []; let i = 0, k = 0; while (i < A.length && k < B.length) { const lo = Math.max(A[i][0], B[k][0]), hi = Math.min(A[i][1], B[k][1]); if (hi > lo) o.push([lo, hi]); if (A[i][1] < B[k][1]) i++; else k++; } return o; };
  const reach = m;
  let Ac = 0, Sx = 0, Sy = 0, Ixx = 0, Iyy = 0, Ixy = 0; const edge = [];
  for (let j = 0; j < rows; j++) {
    if (j - reach < 0 || j + reach >= rows) continue;
    let core = shrink(spans[j], reachAt(0));
    for (let d = 1; d <= reach && core.length; d++) core = clip(clip(core, shrink(spans[j - d], reachAt(d))), shrink(spans[j + d], reachAt(d)));
    const y = y0 + (j + 0.5) * hy;
    for (const [a, c] of core) {
      const w = c - a, dA = w * hy, xm = (a + c) / 2;
      Ac += dA; Sx += xm * dA; Sy += y * dA;
      Iyy += hy * (c ** 3 - a ** 3) / 3;               // ∫x² over the strip
      Ixx += w * (y * y * hy + hy ** 3 / 12);          // ∫y²
      Ixy += xm * y * dA;
      edge.push([a, y], [c, y]);
    }
  }
  const who = { walls: print.walls, infill: print.infill, pattern: print.pattern, own: !!factors.own };
  if (!(Ac > 1e-9)) return { ...props, solidArea: props.area, printed: { ...who, walls_mm: r2(tw), skins_mm: r2(ay), core_mm2: 0, kE: r3(factors.kE), ks: r3(factors.ks), basis: factors.basis, core_share: 0, coreVerts: [] } };
  // back to (u, v): u = x·e1u + y·e2u, v = x·e1v + y·e2v (e1 = (e1[0], e1[1]) etc. in (u, v))
  const toU = (x, y) => [x * e1[0] + y * e2[0], x * e1[1] + y * e2[1]];
  const [cu, cv] = toU(Sx / Ac, Sy / Ac);
  // second moments about the origin, rotated: [Iuu0 Ivv0 Iuv0] from [∫x², ∫y², ∫xy]
  const Ru = [e1[0], e2[0]], Rv = [e1[1], e2[1]];   // u = Ru·(x, y), v = Rv·(x, y)
  const Iuu0c = Rv[0] * Rv[0] * Iyy + 2 * Rv[0] * Rv[1] * Ixy + Rv[1] * Rv[1] * Ixx;   // ∫v²
  const Ivv0c = Ru[0] * Ru[0] * Iyy + 2 * Ru[0] * Ru[1] * Ixy + Ru[1] * Ru[1] * Ixx;   // ∫u²
  const Iuv0c = Ru[0] * Rv[0] * Iyy + (Ru[0] * Rv[1] + Ru[1] * Rv[0]) * Ixy + Ru[1] * Rv[1] * Ixx;
  // the solid's moments about the origin, then the transformed section
  const A = props.area, [su, sv] = props.centroid;
  const k = 1 - factors.kE;
  const As = A - k * Ac;
  const cuS = (A * su - k * Ac * cu) / As, cvS = (A * sv - k * Ac * cv) / As;
  const Iuu0 = props.Iuu + A * sv * sv - k * Iuu0c, Ivv0 = props.Ivv + A * su * su - k * Ivv0c, Iuv0 = props.Iuv + A * su * sv - k * Iuv0c;
  const Iuu = Iuu0 - As * cvS * cvS, Ivv = Ivv0 - As * cuS * cuS, Iuv = Iuv0 - As * cuS * cvS;
  const mean = (Iuu + Ivv) / 2, rad = Math.hypot((Iuu - Ivv) / 2, Iuv);
  let rmax = 0; for (const [x, y] of props.verts) rmax = Math.max(rmax, Math.hypot(x - cuS, y - cvS));
  const coreJ = (Iuu0c - Ac * cv * cv) + (Ivv0c - Ac * cu * cu) + Ac * ((cu - cuS) ** 2 + (cv - cvS) ** 2);
  return {
    ...props, area: As, centroid: [cuS, cvS], Iuu, Ivv, Iuv, I1: mean + rad, I2: mean - rad, theta: 0.5 * Math.atan2(-2 * Iuv, Iuu - Ivv), J0: Iuu + Ivv, rmax,
    solidArea: A,
    printed: {
      ...who, walls_mm: r2(tw), skins_mm: r2(ay), core_mm2: r2(Ac), kE: r3(factors.kE), ks: r3(factors.ks), basis: factors.basis,
      core_share: r3((factors.kE * coreJ) / (Iuu + Ivv)),            // the core's share of the stiffness (polar, about the printed centroid)
      coreVerts: edge.map(([x, y]) => toU(x, y)),
    },
  };
}

/** A one-line account of a printed section (its `printed` summary), for reasons and assumptions. */
export const printSummary = (p) => { const { coreVerts, ...rest } = p; return rest; };
export function printLine(p) {
  return `printed section: ${p.walls} walls (${p.walls_mm} mm) and ${p.skins_mm} mm skins around a ${Math.round(p.infill * 100)} % ${p.pattern} core`
    + ` taking ${Math.round(p.kE * 1000) / 10} % of solid stiffness (${p.basis}${p.own ? '' : ', a typical estimate ±50 %'}); the core carries ${Math.round(p.core_share * 100)} % of the section's stiffness`;
}
