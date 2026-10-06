/**
 * strength/tensile.js — the tensile view: the material's stress–strain curve, idealised from the table, and the
 * part's working point on it.
 *
 * The table holds three numbers per material (E, strength and elongation, plus `ultimate` where the strength is a
 * yield). They make an idealised curve, the shape a materials course draws:
 *   brittle (elongation under 5 %)  linear to the break
 *   ductile, ultimate tabled        bilinear: elastic to yield, then linear hardening to the ultimate at break
 *   ductile, no ultimate            elastic, then a yield plateau to break
 * Necking, rate and temperature are not modelled; the view says so. A print loaded more across its layers than
 * along them (and wood across its grain) is drawn brittle at the reduced strength: an interlayer bond fails
 * without the stretch the in-plane curve shows.
 *
 * The working point is the reading's material-stress mode with the highest utilisation, as an equivalent tensile
 * stress = utilisation × the strength in that direction. A torsion or shear mode therefore lands where its von
 * Mises equivalent does, and the point sits at exactly the fraction of the curve the safety factor says.
 * Capacity modes (buckling, thread stripping) have no stress on the material's curve; when one governs, the view
 * names it. Pure: same reading → same view.
 */

import { isBrittle, isPrinted, BOLT_GRADES } from './materials.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export const TENSILE_NOTE = 'Idealised from typical table values (no necking, rate or temperature effects); check the supplier datasheet, or calibrate with a pulled coupon.';

/** The idealised engineering stress–strain curve: points [strain %, stress MPa]. */
export function materialCurve(m) {
  const E = m.E, s = m.strength;
  const ey = (s / E) * 100;
  if (isBrittle(m)) {
    return { model: 'linear to the break (brittle)', E_mpa: E, yield_mpa: null, ultimate_mpa: r2(s), break_pct: r3(ey), brittle: true, points: [[0, 0], [r3(ey), r2(s)]] };
  }
  const ult = m.basis === 'yield' && m.ultimate > s ? m.ultimate : s;
  const brk = Math.max(m.elong, ey);
  return {
    model: ult > s ? 'bilinear: elastic to yield, then linear hardening to the ultimate at break' : 'elastic, then a yield plateau to break',
    E_mpa: E, yield_mpa: r2(s), ultimate_mpa: r2(ult), break_pct: r3(brk), brittle: false,
    points: [[0, 0], [r3(ey), r2(s)], [r3(brk), r2(ult)]],
  };
}

/** The curve along a stressed direction: strength and stiffness scaled; across layers or grain, brittle. */
export function directionalCurve(m, f) {
  if (!f || (f.strength >= 1 && f.E >= 1)) return materialCurve(m);
  const across = (isPrinted(m) || m.family === 'wood') && (f.across ?? 1) > 0.5;
  return materialCurve({ ...m, strength: m.strength * f.strength, E: m.E * f.E, ...(m.ultimate ? { ultimate: m.ultimate * f.strength } : {}), ...(across ? { elong: 0 } : {}) });
}

// strain on the curve at a stress, or null on a plateau it never leaves
function strainAt(curve, s) {
  const p = curve.points;
  for (let i = 1; i < p.length; i++) {
    const [e0, s0] = p[i - 1], [e1, s1] = p[i];
    if (s <= s1 + 1e-9 && s1 > s0) return e0 + ((s - s0) / (s1 - s0)) * (e1 - e0);
  }
  return null;
}

function boltMaterial(spec, m) {
  const g = spec.grade ? BOLT_GRADES[spec.grade] : null;
  if (g) return { mat: { id: `bolt-${spec.grade}`, label: `bolt class ${spec.grade}`, family: 'metal', E: 205000, strength: g.yield, ultimate: g.ultimate, basis: 'yield', elong: g.elong }, f: null };
  return { mat: m, f: { strength: m.layer ?? 1, E: Math.max(m.layer ?? 1, 0.8), across: 1 } };   // a printed bolt: worst-case layers
}

/**
 * tensileView(check, spec, ctx, confidence) → the view block a reading carries, or null when no mode stresses the
 * material (a table-driven capacity check with nothing to place).
 */
export function tensileView(check, spec, ctx, conf) {
  const stressModes = check.modes.filter((x) => !x.rigidity && Number.isFinite(x.stress_mpa) && Number.isFinite(x.allow_mpa) && x.allow_mpa > 0);
  if (!stressModes.length) return null;
  const top = stressModes.reduce((a, b) => (b.utilization > a.utilization ? b : a));
  let mat = check.material_override || ctx.material, f = check.facts?.direction || null;
  if (/^bolt /.test(top.mode)) ({ mat, f } = boltMaterial(spec, ctx.material));
  const curve = directionalCurve(mat, f);
  const sDir = mat.strength * (f?.strength ?? 1);
  const seq = top.utilization * sDir;
  const yieldS = curve.yield_mpa ?? curve.ultimate_mpa;
  const zone = seq < yieldS - 1e-9 ? 'elastic'
    : !curve.brittle && seq < curve.ultimate_mpa - 1e-9 ? 'past yield: it takes a permanent set'
      : curve.brittle || curve.ultimate_mpa > yieldS ? 'past the break' : 'past yield: the idealised curve has no more strength, so it stretches until it breaks';
  // past the break, or on a yield plateau, the curve gives no single strain for the stress
  const plateau = !curve.brittle && curve.ultimate_mpa <= yieldS && seq >= yieldS - 1e-9;
  const strain = zone.startsWith('past the break') || plateau ? null : strainAt(curve, Math.min(seq, curve.ultimate_mpa));
  const allowed = sDir / conf.required_sf;
  const governing = check.modes.filter((x) => !x.rigidity).reduce((a, b) => (b.utilization > a.utilization ? b : a));
  const capacity = !stressModes.includes(governing) ? governing.mode : null;
  const label = mat.label;
  const line = `Tensile view: ${r2(seq)} MPa (${top.mode}${/torsion|shear/.test(top.mode) ? ', von Mises equivalent' : ''})`
    + `${strain != null ? ` at ${r3(strain)} % strain` : ''} on ${label}'s ${curve.brittle ? 'brittle ' : ''}curve${f && f.strength < 1 ? ` (${Math.round(f.strength * 100)} % of in-plane strength in this direction)` : ''} — ${zone}`
    + `; this confidence allows ${r2(allowed)} MPa${curve.yield_mpa ? ` (yield ${curve.yield_mpa})` : ` (break ${curve.ultimate_mpa})`}`
    + `${capacity ? `. The reading is governed by ${capacity}, not by the material` : ''}.`;
  return {
    material: label,
    ...(f && f.strength < 1 ? { direction: { strength: r3(f.strength), E: r3(f.E) }, in_plane: materialCurve(mat).points } : {}),
    curve,
    working: { mode: top.mode, stress_mpa: r2(seq), strain_pct: strain == null ? null : r3(strain), zone },
    allowed_mpa: r2(allowed),
    allowed_strain_pct: r3(strainAt(curve, Math.min(allowed, curve.ultimate_mpa)) ?? 0),
    ...(capacity ? { governed_by: capacity } : {}),
    line,
    note: TENSILE_NOTE,
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nice = (v) => { const p = 10 ** Math.floor(Math.log10(v)); const k = v / p; return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * p; };
const niceMax = (v) => { const st = nice(v / 4); return Math.ceil(v / st - 1e-9) * st; };
const fmt = (v) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(+v.toFixed(Math.abs(v) >= 10 ? 1 : 2)));

/**
 * The view as a small self-contained SVG (fixed colours, so it reads on any background it is dropped on). The
 * strain axis is zoomed to the elastic region and the working point when the break is far off, with the break
 * marked at the edge, so a metal's working point is not lost in its 26 % stretch.
 */
export function tensileSvg(view, { w = 300, h = 190, title = '' } = {}) {
  const c = view.curve, wp = view.working;
  const ey = c.points[1][0];
  const want = Math.max(ey * 2.2, (wp.strain_pct ?? 0) * 1.3, view.allowed_strain_pct * 1.3);
  const zoom = c.break_pct > want * 1.5;
  const xMax = niceMax(zoom ? want : c.break_pct * 1.08);
  const yMax = niceMax(Math.max(c.ultimate_mpa, wp.stress_mpa) * 1.12);
  const L = 38, B = 28, T = title ? 22 : 10, R = 10;
  const X = (x) => L + (Math.min(x, xMax) / xMax) * (w - L - R), Y = (y) => h - B - (Math.min(y, yMax) / yMax) * (h - B - T);
  const line = (pts) => pts.map(([x, y], i) => {
    if (x <= xMax) return [x, y];
    const [x0, y0] = pts[i - 1]; return [xMax, y0 + ((xMax - x0) / (x - x0)) * (y - y0)];
  }).map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="system-ui,sans-serif">`;
  s += `<rect width="${w}" height="${h}" rx="8" fill="#0e1014" fill-opacity=".9"/>`;
  if (title) s += `<text x="${L}" y="15" font-size="11" font-weight="600" fill="#e6e9ef">${esc(title)}</text>`;
  for (let i = 0; i <= 4; i++) {
    const yv = (yMax * i) / 4, xv = (xMax * i) / 4;
    s += `<line x1="${L}" x2="${w - R}" y1="${Y(yv)}" y2="${Y(yv)}" stroke="#263047"/><text x="${L - 4}" y="${Y(yv) + 3}" font-size="9" fill="#9aa3b2" text-anchor="end">${fmt(yv)}</text>`;
    s += `<text x="${X(xv)}" y="${h - B + 12}" font-size="9" fill="#9aa3b2" text-anchor="middle">${fmt(xv)}</text>`;
  }
  s += `<text x="${(L + w - R) / 2}" y="${h - 4}" font-size="9" fill="#9aa3b2" text-anchor="middle">strain %${zoom ? ` (zoomed; breaks at ${fmt(c.break_pct)} %)` : ''}</text>`;
  s += `<text x="9" y="${(T + h - B) / 2}" font-size="9" fill="#9aa3b2" text-anchor="middle" transform="rotate(-90 9 ${(T + h - B) / 2})">MPa</text>`;
  s += `<rect x="${L}" y="${Y(view.allowed_mpa)}" width="${w - R - L}" height="${Y(0) - Y(view.allowed_mpa)}" fill="#3fb950" fill-opacity=".14"/>`;
  s += `<text x="${w - R - 3}" y="${Y(view.allowed_mpa) + 10}" font-size="9" fill="#3fb950" text-anchor="end">allowed ${fmt(view.allowed_mpa)}</text>`;
  if (view.in_plane) s += `<polyline points="${line(view.in_plane)}" fill="none" stroke="#9aa3b2" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  s += `<polyline points="${line(c.points)}" fill="none" stroke="#6ea8ff" stroke-width="2"/>`;
  const [bx, by] = c.points[c.points.length - 1];
  if (bx <= xMax) s += `<text x="${X(bx)}" y="${Y(by) - 4}" font-size="11" fill="#6ea8ff" text-anchor="middle">×</text>`;
  const tone = wp.zone === 'elastic' ? (wp.stress_mpa <= view.allowed_mpa ? '#3fb950' : '#f5a524') : '#e5484d';
  const px = wp.strain_pct == null ? xMax : wp.strain_pct;
  s += `<circle cx="${X(px)}" cy="${Y(wp.stress_mpa)}" r="4.5" fill="${tone}" stroke="#0e1014" stroke-width="1.5"/>`;
  const right = X(px) > (L + w) / 2;
  s += `<text x="${X(px) + (right ? -8 : 8)}" y="${Y(wp.stress_mpa) - 6}" font-size="10" font-weight="600" fill="${tone}" text-anchor="${right ? 'end' : 'start'}">${fmt(wp.stress_mpa)} MPa</text>`;
  return s + '</svg>';
}
