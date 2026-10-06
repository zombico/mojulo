/**
 * strength/reading.js — turn an element check into a sensor reading: a margin, a confidence grade, the safety
 * factor that grade calls for, and one plain line. A sensor, never a guarantee: the reading never says "safe".
 *
 * Confidence is the WEAKEST of five inputs, not a product of made-up probabilities:
 *   material     how well the material's strength is known (its spread; printed parts loaded across layers)
 *   idealization how well the shape fits the formula (slender, continuous, stress raisers estimated)
 *   load         how well the load is known (measured, estimated, guessed)
 *   duty         what the formula leaves out for this duty (repeated loads → fatigue; impact)
 *   environment  sustained load on a material that creeps; heat near its service limit
 *
 * The factor each grade calls for follows the uncertainty-sized factors of Pugsley (1955) and Juvinall's
 * guidance: well-known material and load 1.5, average 2, uncertain 3, untried 4. Brittle materials, which fail
 * without warning, need 1.25 × that.
 */

import { tensileView } from './tensile.js';
import { printLine } from './printed.js';
import { isBrittle, isPrinted } from './materials.js';

export const GRADES = ['very low', 'low', 'medium', 'high'];
export const REQUIRED_SF = { high: 1.5, medium: 2, low: 3, 'very low': 4 };
const BRITTLE_EXTRA = 1.25;
const r2 = (v) => Math.round(v * 100) / 100;
const minGrade = (...g) => GRADES[Math.min(...g.map((x) => GRADES.indexOf(x)))];
const drop = (g) => GRADES[Math.max(0, GRADES.indexOf(g) - 1)];

export function gradeConfidence(check, spec, ctx) {
  const m = check.material_override || ctx.material;
  const reasons = [];
  const f = check.facts || {};

  // material
  let material = m.cov <= 0.07 ? 'high' : m.cov <= 0.12 ? 'medium' : m.cov <= 0.18 ? 'low' : 'very low';
  if (m.custom) { material = minGrade(material, 'medium'); reasons.push('material: your own values, not a table entry'); }
  if (m.cov > 0.07) reasons.push(`material: ${m.label} varies ±${Math.round(m.cov * 100)} % batch to batch`);
  if (isPrinted(m)) {
    if (ctx.calibrated) reasons.push('material: calibrated by your strength coupon');
    else if (m.family === 'fdm') { material = minGrade(material, 'medium'); }
    const dir = f.direction;
    if (dir && !dir.known && (m.layer ?? 1) < 1) { material = drop(material); reasons.push('material: print direction unknown, so the weakest (across-layer) strength is used — declare `build` to lift this'); }
    else if (dir && dir.across > 0.5 && m.family === 'fdm') { material = minGrade(material, 'low'); reasons.push(`material: loaded across the print layers (${Math.round(dir.strength * 100)} % of in-plane strength), the least predictable property of a print`); }
  }
  if (m.family === 'wood' && f.direction && !f.direction.known) { material = drop(material); reasons.push('material: grain direction not declared — across-grain strength used'); }

  // idealization
  let ideal = f.tableDriven ? 'medium' : 'high';
  if (f.tableDriven) reasons.push('idealization: standard formula on the declared size; the geometry was not measured');
  if (f.gaps > 0) { ideal = 'very low'; reasons.push(`idealization: ${f.gaps} cut${f.gaps === 1 ? '' : 's'} between the ends found no material — the load path does not run along this axis`); }
  if (f.open) { ideal = minGrade(ideal, 'low'); reasons.push('idealization: the mesh is not closed where it was cut'); }
  if (!f.tableDriven) {
    if (f.slenderness < 2) { ideal = minGrade(ideal, 'low'); reasons.push(`idealization: stubby (length ${f.slenderness}× depth): beam formulas misjudge shear and the root`); }
    else if (f.slenderness < 4) { ideal = minGrade(ideal, 'medium'); reasons.push(`idealization: short (length ${f.slenderness}× depth): beam formulas are approximate`); }
    if (f.pieces > 1) { ideal = minGrade(ideal, 'medium'); reasons.push('idealization: the section is more than one piece; they are assumed to act together'); }
  }
  if (f.printed) {
    ideal = minGrade(ideal, f.printed.own || f.printed.core_share <= 0.25 ? 'medium' : 'low');
    reasons.push(`idealization: ${printLine(f.printed)}`);
  }
  if (f.nonRound) { ideal = minGrade(ideal, 'low'); reasons.push('idealization: torsion of a non-round section is estimated'); }
  if (check.weak_spot?.raisers?.length) {
    ideal = minGrade(ideal, 'medium');
    const k = check.weak_spot.raisers.map((r) => `${r.kind} Kt ${r.kt}${r.fillet_mm != null ? ` (fillet ≈${r.fillet_mm} mm)` : ''}`).join(', ');
    reasons.push(`idealization: stress raiser at the weak spot — ${k}, estimated${check.weak_spot.kt_applied ? '' : '; not applied (a ductile part under a static load yields locally and shares the load)'}`);
  }

  // load
  const certainty = spec.certainty || 'estimated';
  const load = certainty === 'measured' ? 'high' : certainty === 'guess' ? 'low' : 'medium';
  if (load !== 'high') reasons.push(`load: ${certainty === 'guess' ? 'a guess' : 'estimated, not measured'}`);

  // duty
  let duty = 'high';
  if (spec.kind === 'repeated') { duty = m.family === 'metal' ? 'medium' : 'low'; reasons.push(`duty: repeated load — fatigue life is not computed${m.family === 'metal' ? '' : ' and plastics fatigue well below their static strength'}`); }
  if (spec.kind === 'impact') { duty = 'medium'; reasons.push('duty: impact taken as twice the load (sudden application); a real drop can be worse'); }

  // environment
  let env = 'high';
  const tC = ctx.temperature;
  if (Number.isFinite(tC) && tC > m.serviceC) { env = 'very low'; reasons.push(`environment: ${tC} °C is above ${m.label}'s ${m.serviceC} °C limit — the numbers do not apply`); }
  else if (Number.isFinite(tC) && tC > 0.8 * m.serviceC) { env = 'low'; reasons.push(`environment: ${tC} °C is near ${m.label}'s ${m.serviceC} °C limit`); }
  if (spec.sustained && m.creep) { env = minGrade(env, 'low'); reasons.push(`environment: a sustained load on ${m.label}, which creeps — the deflection is the first-day value and grows over weeks`); }

  const inputs = { material, idealization: ideal, load, duty, environment: env };
  const grade = minGrade(...Object.values(inputs));
  const brittle = isBrittle(m);
  const required = r2(REQUIRED_SF[grade] * (brittle ? BRITTLE_EXTRA : 1));
  return { grade, inputs, reasons, required_sf: required, brittle };
}

export function verdictFor(sf, required) {
  if (!(sf >= 1)) return 'predicted to fail';
  if (sf < required) return 'below what this confidence calls for';
  if (sf >= 4 * required) return 'meets what this confidence calls for, with room to spare (could be lighter)';
  return 'meets what this confidence calls for';
}

/** The full reading for one check: margin (worst strength mode), rigidity, confidence, verdict and the line. */
export function readCheck(check, spec, ctx) {
  const conf = gradeConfidence(check, spec, ctx);
  const strengthModes = check.modes.filter((x) => !x.rigidity && !x.advisory);
  const rigidModes = check.modes.filter((x) => x.rigidity);
  const worst = strengthModes.reduce((a, b) => (b.utilization > a.utilization ? b : a));
  const sf = r2(1 / worst.utilization);
  const verdict = verdictFor(sf, conf.required_sf);
  const rigid = rigidModes.map((x) => ({ ...x, verdict: x.utilization > 1 ? 'bends more than the limit' : 'within the limit' }));
  const m = check.material_override || ctx.material;
  const what = spec.label || check.element;
  const rigLine = rigid.map((x) => x.mode === 'twist'
    ? `twists ${x.twist_deg}° (limit ${x.limit_deg}°, ${x.basis})`
    : `bends ${x.deflection_mm} mm (limit ${x.limit_mm} mm, ${x.basis})`).join('; ');
  const advice = check.modes.filter((x) => x.advisory && x.utilization > 1).map((x) => `${x.mode}: ${x.note}`);
  const why = conf.reasons.filter((r) => !r.startsWith('load: estimated')).slice(0, 3).map((r) => r.replace(/^[a-z]+: /, '')).join('; ');
  const line = `${what}: weakest mode ${worst.mode}, safety factor ${sf} against ${m.basis === 'mor' ? 'rupture' : m.basis}`
    + `${rigLine ? `; ${rigLine}` : ''}. Confidence ${conf.grade}${why ? ` (${why})` : ''}; this confidence calls for ${conf.required_sf}. `
    + `Reading: ${verdict}.`
    + (advice.length ? ` Note — ${advice.join('; ')}.` : '');
  const tensile = tensileView(check, spec, ctx, conf);
  return {
    ...check,
    margin: { worst_mode: worst.mode, sf, utilization: worst.utilization },
    rigidity: rigid,
    confidence: conf,
    verdict,
    line,
    ...(tensile ? { tensile } : {}),
  };
}
