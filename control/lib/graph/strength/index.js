/**
 * strength/index.js — the rigidity sensor's front door: a stored solid, the material it is made from and the
 * work it has to do → readings. measure_solid calls it with the same mm soup the STL writes.
 *
 * The spec (stored on the row as `manifest.strength`, or passed to measure_solid):
 *   {
 *     material: 'petg' | { E, strength, … },      // see materials.js
 *     build?: 'z+' | [x, y, z],                    // print build direction; absent → worst case, confidence drops
 *     grain?: [x, y, z],                           // wood: the grain axis
 *     calibrated?: true,                           // the material's numbers came from your own tests
 *     coupon?: { break_n, build?: 'flat' | 'upright', section_mm2? } | [...],   // pulled mj_tensile_coupon results:
 *                                                  // flat sets the in-plane strength, upright the layer factor
 *     temperature?: °C,
 *     checks: [{ element: 'cantilever' | 'lever' | 'shaft' | 'strut' | 'tie' | 'bolt' | 'gear', label?, kind?: 'static' |
 *                'repeated' | 'impact', sustained?, certainty?: 'measured' | 'estimated' | 'guess', … }],
 *     show?: false,                                // keep the weak-spot pointer off the World view
 *   }
 * Points and lengths are in the model's own units (mm for a scad row); forces in N (or { value, unit }), torques
 * in N·m. Pure: same soup and spec → same readings.
 */

import { resolveMaterial } from './materials.js';
import { ELEMENTS } from './checks.js';
import { readCheck } from './reading.js';
import { unit } from './section.js';
import { tensileSvg } from './tensile.js';

const AXES = { 'x+': [1, 0, 0], 'x-': [-1, 0, 0], 'y+': [0, 1, 0], 'y-': [0, -1, 0], 'z+': [0, 0, 1], 'z-': [0, 0, -1] };
const r2 = (v) => Math.round(v * 100) / 100;

const POINT_PATHS = [['root', 'at'], ['load', 'at'], ['fulcrum', 'at'], ['effort', 'at'], ['axis', 'at'], ['from'], ['to'], ['at']];
const LENGTH_PATHS = [['length'], ['engaged_mm'], ['limit', 'deflection_mm'], ['limit', 'elongation_mm']];

function scaled(check, s) {
  if (s === 1) return check;
  const c = structuredClone(check);
  const get = (o, p) => p.reduce((x, k) => (x == null ? x : x[k]), o);
  const set = (o, p, v) => { const last = p[p.length - 1]; const parent = p.slice(0, -1).reduce((x, k) => x[k], o); parent[last] = v; };
  for (const p of POINT_PATHS) { const v = get(c, p); if (Array.isArray(v)) set(c, p, v.map((x) => x * s)); }
  for (const p of LENGTH_PATHS) { const v = get(c, p); if (Number.isFinite(v)) set(c, p, v * s); }
  return c;
}

// The ISO 527-2 1A coupon's gauge section (10 × 4 mm), which mj_tensile_coupon prints.
export const COUPON_SECTION_MM2 = 40;
const couponList = (c) => (c == null ? [] : Array.isArray(c) ? c : [c]);

/**
 * Calibrate a material from pulled coupons: the peak load ÷ the gauge section is the strength in that direction.
 * A flat coupon (pulled along its layers) replaces the in-plane strength; an upright one (pulled across them)
 * sets the layer factor against the in-plane strength. The table's stiffness and spread are kept.
 */
export function applyCoupons(material, coupons) {
  const list = couponList(coupons);
  if (!list.length) return material;
  const mpa = (c) => +c.break_n / (+c.section_mm2 || COUPON_SECTION_MM2);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const flat = list.filter((c) => (c.build || 'flat') === 'flat').map(mpa);
  const up = list.filter((c) => c.build === 'upright').map(mpa);
  const strength = flat.length ? mean(flat) : material.strength;
  const layer = up.length ? Math.min(1, Math.max(0.05, mean(up) / strength)) : material.layer;
  return {
    ...material, strength, layer,
    calibration: { coupons: list.length, ...(flat.length ? { flat_mpa: r2(strength), table_mpa: material.strength } : {}), ...(up.length ? { upright_mpa: r2(mean(up)), layer: r2(layer), table_layer: material.layer } : {}) },
  };
}

/** Shape-check a spec without geometry (the update_sketch gate). Returns a list of problems. */
export function strengthSpecErrors(spec) {
  const errs = [];
  if (!spec || typeof spec !== 'object') return ['strength must be an object { material, checks: [...] }'];
  try { resolveMaterial(spec.material); } catch (e) { errs.push(e.message.replace(/^strength: /, '')); }
  if (spec.build != null && !AXES[spec.build] && !(Array.isArray(spec.build) && spec.build.length === 3)) errs.push(`build must be one of ${Object.keys(AXES).join(', ')} or [x, y, z]`);
  couponList(spec.coupon).forEach((c, i) => {
    if (!(+c?.break_n > 0)) errs.push(`coupon[${i}].break_n must be the peak pull in N`);
    if (c?.build != null && !['flat', 'upright'].includes(c.build)) errs.push(`coupon[${i}].build must be flat or upright`);
    if (c?.section_mm2 != null && !(+c.section_mm2 > 0)) errs.push(`coupon[${i}].section_mm2 must be positive`);
  });
  if (!Array.isArray(spec.checks) || !spec.checks.length) errs.push('checks must be a non-empty list');
  else spec.checks.forEach((c, i) => {
    if (!ELEMENTS[c?.element]) errs.push(`checks[${i}].element must be one of ${Object.keys(ELEMENTS).join(', ')}`);
    if (c?.kind && !['static', 'repeated', 'impact'].includes(c.kind)) errs.push(`checks[${i}].kind must be static, repeated or impact`);
    if (c?.certainty && !['measured', 'estimated', 'guess'].includes(c.certainty)) errs.push(`checks[${i}].certainty must be measured, estimated or guess`);
  });
  return errs;
}

/**
 * strengthReading(soup, spec, { scale }) → { readings, worst, marks, line, not_covered, note }.
 * `soup` is the mm triangle soup (printSoup); `scale` maps the model's units to mm.
 */
export function strengthReading(soup, spec, { scale = 1 } = {}) {
  const errs = strengthSpecErrors(spec);
  if (errs.length) throw new Error(`strength: ${errs.join('; ')}`);
  const material = applyCoupons(resolveMaterial(spec.material), spec.coupon);
  const build = spec.build == null ? null : unit(AXES[spec.build] || spec.build.map(Number));
  const ctx = { material: spec.grain ? { ...material, grainDir: unit(spec.grain.map(Number)) } : material, build, temperature: spec.temperature, calibrated: !!spec.calibrated || couponList(spec.coupon).length > 0 };
  const readings = spec.checks.map((c, i) => {
    try {
      const check = ELEMENTS[c.element](soup, scaled(c, scale), ctx);
      return readCheck(check, c, ctx);
    } catch (e) {
      return { element: c.element, label: c.label || null, error: e.message.replace(/^strength: /, ''), index: i };
    }
  });
  const ok = readings.filter((r) => !r.error);
  const worst = ok.length ? ok.reduce((a, b) => (b.margin.utilization > a.margin.utilization ? b : a)) : null;
  const marks = spec.show === false ? [] : strengthMarks(ok, scale);
  return {
    material: { id: material.id, label: material.label, basis: material.basis, E_mpa: material.E, strength_mpa: material.strength, ...(material.custom ? { custom: true } : {}), ...(material.calibration ? { calibration: material.calibration } : {}), note: 'typical values — check the supplier datasheet' },
    build: build ? build.map(r2) : null,
    readings,
    ...(worst ? { worst: { label: worst.label || worst.element, element: worst.element, sf: worst.margin.sf, verdict: worst.verdict, confidence: worst.confidence.grade, weak_spot: worst.weak_spot } } : {}),
    marks,
    line: worst ? worst.line : 'No check could run — see each reading\'s error.',
    sensor: 'A sensor reading, not a guarantee: textbook formulas on the measured shape, with typical material values. It does not cover general 3D stress (FEA), fatigue life, creep rates, temperature curves or the joints it was not asked about. Test the real part before trusting it with anything that matters.',
  };
}

// The pointer the World draws at each weak spot, in the model's own units. Colour by verdict.
const VERDICT_COLOR = { fail: '#e5484d', below: '#f5a524', meets: '#3fb950' };
export function strengthMarks(readings, scale = 1) {
  const out = [];
  for (const r of readings) {
    const w = r.weak_spot;
    if (!w || !Array.isArray(w.at)) continue;
    const tone = r.verdict.startsWith('predicted') ? 'fail' : r.verdict.startsWith('below') ? 'below' : 'meets';
    out.push({
      at: w.at.map((x) => r2(x / scale)),
      ...(Array.isArray(w.normal) ? { normal: w.normal } : {}),
      label: `${r.label || w.label || r.element}: ${w.mode}, SF ${r.margin.sf} (${r.confidence.grade} confidence)`,
      color: VERDICT_COLOR[tone],
      tone,
      ...(r.tensile ? { chart: tensileSvg(r.tensile, { title: `${r.label || w.label || r.element}: ${r.tensile.material}` }) } : {}),
    });
  }
  return out;
}
