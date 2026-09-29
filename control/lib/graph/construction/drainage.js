// construction/drainage — where a house's rain goes: gutters on every eave that sheds water, falling to outlets;
// downpipes from each outlet, swan-necked back to the wall and down it to grade; an outlet at the foot; and, where the
// tradition drains below ground, a pipe from each foot to a run round the house, through chambers, to one outfall.
// Read from the house the generator built (its footprint, wall runs and openings, storeys) and its roof style (form,
// eave overhang, pitch), in feet, the house's unit.
//
// Traditions (DRAINAGE_TRADITIONS):
//   · north-american — 5 in K-style aluminium gutters, 3 × 4 in downspouts, a kick-out onto a concrete splash block;
//   · british — 112 mm half-round gutters, 68 mm round downpipes into back-inlet gullies, a 110 mm drain run through
//     inspection chambers to the outfall;
//   · japanese — 105 mm half-round copper nokidoi; kusari-doi rain chains hang from each outlet to a stone at grade
//     (amaochi-ishi), or tatedoi (`downpipe: 'pipe'`) to a masu and a drain run;
//   · metric — 125 mm box gutters, 80 mm zinc downpipes into gullies, a drain run.
// Roof forms: gable-family eaves on the two long sides; hip-family eaves round all four, the short sides draining round
// the corners; a shed at its low eave; a butterfly in a box gutter along its valley, out through scuppers at each end;
// a flat deck through scuppers in the parapet.
//
// Checks (advisory arithmetic): the roof area each outlet takes (plan area, plus half the pitched rise for wind-driven
// rain) against what the outlet carries at the tradition's design rainfall; the gutter's fall; every downpipe reaching
// grade; the below-ground run's fall.
import { shadeHexMat, DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from '../polygonizer/materials.js';
import { rgbHex } from './timber.js';
import { CATALOG, TRADITION_KEYS } from './catalog.js';
import { planeFace } from './roofing.js';
import { instanceGroups } from './instancing.js';
import { ROOF_STYLES } from '../architecture/roof.js';

const MM = 1 / 304.8, IN = 1 / 12;
const q4 = (v) => Math.round(v * 1e4) / 1e4;
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * By tradition: the gutter (profile, width and depth in mm, material), the downpipe (shape 'rect' | 'round' | 'chain',
 * size in mm, material), the outlet at its foot, whether it drains below ground, and what an outlet carries (l/s) at
 * the design rainfall (mm/h).
 */
export const DRAINAGE_TRADITIONS = Object.freeze({
  'north-american': { gutter: { profile: 'k-style', width: 127, depth: 86, material: 'gutter:k-style-aluminium' }, downpipe: { shape: 'rect', size: [76, 102], material: 'pipe:downspout-3x4' }, outlet: 'splash-block', below: false, outletLs: 3.1, rainfall: 102 },
  british: { gutter: { profile: 'half-round', width: 112, depth: 56, material: 'gutter:half-round-112' }, downpipe: { shape: 'round', size: [68], material: 'pipe:downpipe-68' }, outlet: 'gully', below: true, outletLs: 0.8, rainfall: 75 },
  japanese: { gutter: { profile: 'half-round', width: 105, depth: 52, material: 'gutter:nokidoi-copper-105' }, downpipe: { shape: 'chain', size: [60], material: 'chain:kusari-copper' }, outlet: 'basin', below: false, outletLs: 0.5, rainfall: 100, pipe: { shape: 'round', size: [60], material: 'pipe:tatedoi-copper-60', outlet: 'masu', below: true, outletLs: 1.0 } },
  metric: { gutter: { profile: 'box', width: 125, depth: 90, material: 'gutter:box-zinc-125' }, downpipe: { shape: 'round', size: [80], material: 'pipe:downpipe-80-zinc' }, outlet: 'gully', below: true, outletLs: 1.2, rainfall: 75 },
});
export const DRAINAGE_OUTLETS = Object.freeze(['splash-block', 'gully', 'basin', 'masu']);

/** Validate a `drainage` value → string[]. */
export function validateDrainage(v, at = 'drainage') {
  if (v === true || v === undefined || v === false) return [];
  if (!v || typeof v !== 'object') return [`${at}: true or { tradition?, downpipe?, outlet?, below? }`];
  const e = [];
  if (v.tradition !== undefined && !TRADITION_KEYS.includes(v.tradition)) e.push(`${at}.tradition: one of ${TRADITION_KEYS.join(', ')}`);
  if (v.downpipe !== undefined && !['pipe', 'chain'].includes(v.downpipe)) e.push(`${at}.downpipe: 'pipe' or 'chain'`);
  if (v.outlet !== undefined && !DRAINAGE_OUTLETS.includes(v.outlet)) e.push(`${at}.outlet: one of ${DRAINAGE_OUTLETS.join(', ')}`);
  if (v.below !== undefined && typeof v.below !== 'boolean') e.push(`${at}.below: a boolean`);
  return e;
}

/** A `drainage` value and the tradition a framed house names → the resolved rules. */
export function drainageOf(v, tradition = null) {
  const spec = v && typeof v === 'object' ? v : {};
  const tk = spec.tradition || tradition || 'north-american';
  const t = DRAINAGE_TRADITIONS[tk] || DRAINAGE_TRADITIONS['north-american'];
  // a Japanese house may take tatedoi instead of chains; any house may hang chains to a stone
  let base = t;
  if (spec.downpipe === 'pipe' && t.pipe) base = { ...t, downpipe: { shape: t.pipe.shape, size: t.pipe.size, material: t.pipe.material }, outlet: t.pipe.outlet, below: t.pipe.below, outletLs: t.pipe.outletLs };
  if (spec.downpipe === 'chain' && t.downpipe.shape !== 'chain') base = { ...t, downpipe: { shape: 'chain', size: [60], material: 'chain:kusari-copper' }, outlet: 'basin', below: false, outletLs: 0.5 };
  return { tradition: tk, ...base, outlet: spec.outlet || base.outlet, below: spec.below ?? base.below };
}

// ── the eaves a roof sheds water from ────────────────────────────────────────────────────────────────────────────────

/**
 * The lines a roof's water leaves by → [{ kind: 'eave' | 'valley' | 'scupper-edge', axis: 'x' | 'y', at (the across
 * coordinate of the gutter's back), s0, s1 (along), z (the top of the gutter), out (±1: which way is outside),
 * wallAt (the wall plane under it, or null), outlets: bool (false: drains round a corner into its neighbours) }].
 */
export function roofDrainLines(fp, ze, roofSpec) {
  const spec = roofSpec && typeof roofSpec === 'object' ? { style: roofSpec.style || 'bungalow', ...roofSpec } : { style: typeof roofSpec === 'string' ? roofSpec : 'bungalow' };
  const st = { ...(ROOF_STYLES[spec.style] || ROOF_STYLES.bungalow), ...spec };
  const oh = st.eave ?? 1;
  const longX = fp.x1 - fp.x0 >= fp.y1 - fp.y0;
  const [wA0, wA1, wC0, wC1] = longX ? [fp.x0, fp.x1, fp.y0, fp.y1] : [fp.y0, fp.y1, fp.x0, fp.x1];
  const along = longX ? 'x' : 'y', across = longX ? 'y' : 'x';
  const L = (axis, at, s0, s1, z, out, wallAt, kind = 'eave', outlets = true) => ({ kind, axis, at, s0, s1, z, out, wallAt, outlets });
  const f = st.form;
  if (f === 'gable' || f === 'gambrel' || f === 'saltbox') return { form: f, oh, lines: [L(along, wC0 - oh, wA0, wA1, ze, -1, wC0), L(along, wC1 + oh, wA0, wA1, ze, 1, wC1)] };
  if (f === 'hip' || f === 'pyramid' || f === 'mansard') {
    return { form: f, oh, lines: [
      L(along, wC0 - oh, wA0 - oh, wA1 + oh, ze, -1, wC0), L(along, wC1 + oh, wA0 - oh, wA1 + oh, ze, 1, wC1),
      L(across, wA0 - oh, wC0 - oh, wC1 + oh, ze, -1, wA0, 'eave', false), L(across, wA1 + oh, wC0 - oh, wC1 + oh, ze, 1, wA1, 'eave', false),
    ] };
  }
  if (f === 'shed') return { form: f, oh, lines: [L(along, wC0 - oh, wA0 - oh, wA1 + oh, ze, -1, wC0)] };
  if (f === 'butterfly') return { form: f, oh, lines: [L(along, (wC0 + wC1) / 2, wA0, wA1, ze, 0, null, 'valley')] };
  // a flat deck: the water leaves through scuppers at the ends of its back parapet
  return { form: f, oh: 0, lines: [L(along, wC1, wA0, wA1, ze + 0.1, 1, wC1, 'scupper-edge')] };
}

// ── sections ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A gutter's open section, [y out from its back, z down from its top] in feet, back to front. */
function gutterSection(g) {
  const W = g.width * MM, D = g.depth * MM;
  if (g.profile === 'k-style') return [[0, 0], [0, -D], [W * 0.78, -D], [W * 0.9, -D * 0.72], [W * 0.84, -D * 0.46], [W, -D * 0.22], [W, 0]];
  if (g.profile === 'box') return [[0, 0], [0, -D], [W, -D], [W, 0]];
  const out = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * (1 - i / 8); out.push([W / 2 + (W / 2) * Math.cos(a), -(W / 2) * Math.sin(a) * (D / (W / 2))]); }
  return out;
}
/** A pipe's section: rectangle corners or an octagon, [y, z] in feet about its axis. */
function pipeSection(dp) {
  if (dp.shape === 'rect') { const [a, b] = dp.size.map((v) => (v * MM) / 2); return [[-b, -a], [b, -a], [b, a], [-b, a]]; }
  const r = (dp.size[0] * MM) / 2; const out = []; for (let i = 0; i < 8; i++) { const t = (Math.PI * 2 * i) / 8 + Math.PI / 8; out.push([r * Math.cos(t), r * Math.sin(t)]); }
  return out;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** A swept section's frame for a segment a→b: ex along it, ez the world up (or `side` for a vertical run), ey = ez × ex. */
function sweepFrame(a, b, side = [1, 0, 0]) {
  const ex = unit3(sub(b, a));
  let ez = Math.abs(ex[2]) > 0.95 ? side : [0, 0, 1];
  ez = unit3(sub(ez, mul(ex, ez[0] * ex[0] + ez[1] * ex[1] + ez[2] * ex[2])));
  return { ex, ey: cross(ez, ex), ez };
}

/**
 * planDrainage(house, drainage, o) → { faces, repeats, elements, report } or null when the house has no roof. `house`
 * is structurizeHouse's { levels, footprint, meru }; `o` its options (roof, view, light, exteriorThickness, tradition
 * (the framing's, when framed)).
 */
export function planDrainage(house, drainage, o = {}) {
  const rules = drainageOf(drainage, o.tradition);
  const light = o.light || DEFAULT_LIGHT;
  const levels = [...house.levels].sort((a, b) => a.index - b.index);
  const top = levels[levels.length - 1];
  const ze = top.baseZ + top.height;
  const grade = house.meru ? house.meru.groundZ : levels[0].baseZ;
  const fp = house.footprint;
  const roofSpec = o.roof || (o.view === 'exterior' ? 'bungalow' : null);
  if (!roofSpec) return null;
  const { form, lines } = roofDrainLines(fp, ze, roofSpec);
  const extT = o.exteriorThickness ?? 0.67;
  const faces = [], elements = [];
  const matG = resolveMaterial(/copper/.test(rules.gutter.material) ? 'copper' : /pvc|112|68/.test(rules.gutter.material) ? 'plastic' : 'satin');
  const rgbOf = (name) => (CATALOG[name] ? CATALOG[name].rgb : [200, 200, 200]);
  const fillOf = (name, n, mat = matG) => shadeHexMat(rgbHex(rgbOf(name)), n, mat, { light });
  const el = (key, ifc, type, material, pts, extra = {}) => {
    const lo = [0, 1, 2].map((i) => q4(Math.min(...pts.map((p) => p[i])))), hi = [0, 1, 2].map((i) => q4(Math.max(...pts.map((p) => p[i]))));
    elements.push({ key: `drain:${key}`, ifc, type, material, storey: top.index, lo, hi, system: 'rainwater', ...extra });
  };
  const P = (axis, s, c, z) => (axis === 'x' ? [s, c, z] : [c, s, z]);
  const report = { tradition: rules.tradition, form, gutters: { runs: 0, lengthFt: 0, fall: null }, downpipes: { count: 0, lengthFt: 0, kind: rules.downpipe.shape === 'chain' ? 'rain chain' : 'downpipe' }, outlets: { kind: rules.outlet, count: 0 }, below: rules.below ? { lengthFt: 0, chambers: 0 } : null, checks: [] };

  // openings on the wall under a line, as [s0, s1] (any storey), so a downpipe keeps clear of them
  const openingsOn = (axis, wallAt) => {
    if (wallAt === null) return [];
    const out = [];
    for (const l of levels) for (const run of (l.structure && l.structure.wallGraph && l.structure.wallGraph.runs) || []) {
      if (run.interior || (run.orientation === 'h') !== (axis === 'x') || Math.abs(run.at - wallAt) > 0.6) continue;
      for (const op of run.openings || []) out.push([op.a - 0.5, op.b + 0.5]);
    }
    return out;
  };
  const clear = (s, ops) => { for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4]) { const t = s + d * 0.75; if (!ops.some(([a, b]) => t > a && t < b)) return t; } return s; };

  // ── gutters and their outlets ──
  const outlets = [];                                                        // { at: [x,y,z], line, s }
  const sec = gutterSection(rules.gutter);
  const W = rules.gutter.width * MM, D = rules.gutter.depth * MM;
  const FALL = 1 / 350;                                                      // about 1 in 350 to each outlet
  // how many outlets the roof needs: its area (plan, plus half the pitched rise for wind-driven rain) over what one
  // outlet carries at the design rainfall — shared among the lines that take outlets
  const pitch = (ROOF_STYLES[(typeof roofSpec === 'object' ? roofSpec.style : roofSpec) || 'bungalow'] || ROOF_STYLES.bungalow).pitch || 0;
  const ohAll = roofDrainLines(fp, ze, roofSpec).oh;
  const planM2 = (fp.x1 - fp.x0 + 2 * ohAll) * (fp.y1 - fp.y0 + 2 * ohAll) * 0.3048 * 0.3048;
  const effM2 = planM2 * (1 + pitch / 2);
  const BOX_OUTLET_LS = 3.0;                                                // a 100 mm box-gutter or scupper outlet
  const capM2 = rules.outletLs / (rules.rainfall / 3600);
  const boxCapM2 = BOX_OUTLET_LS / (rules.rainfall / 3600);
  const outletLines = lines.filter((l) => l.outlets && l.kind === 'eave').length;
  const perLine = outletLines ? Math.ceil(Math.ceil(effM2 / capM2) / outletLines) : 0;
  lines.forEach((ln, li) => {
    const len = ln.s1 - ln.s0;
    if (ln.kind === 'scupper-edge') {
      // two scuppers through the parapet near the ends, each onto a conductor head
      for (const [k, s] of [[0, ln.s0 + 1.2], [1, ln.s1 - 1.2]]) {
        const sc = clear(s, openingsOn(ln.axis, ln.wallAt));
        const head = P(ln.axis, sc, ln.at + ln.out * (extT / 2 + 0.35), ln.z - 0.2);
        const hw = 0.4, hd = 0.3;
        const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
        for (let i = 0; i < 4; i++) {
          const [a0, b0] = corners[i], [a1, b1] = corners[(i + 1) % 4];
          const c = [P(ln.axis, sc + a0, ln.at + ln.out * (extT / 2 + 0.35) + b0, ln.z - 0.9), P(ln.axis, sc + a1, ln.at + ln.out * (extT / 2 + 0.35) + b1, ln.z - 0.9), P(ln.axis, sc + a1, ln.at + ln.out * (extT / 2 + 0.35) + b1, ln.z), P(ln.axis, sc + a0, ln.at + ln.out * (extT / 2 + 0.35) + b0, ln.z)];
          const n = unit3(cross(sub(c[1], c[0]), sub(c[3], c[0])));
          faces.push(planeFace(c, fillOf(rules.downpipe.material, n), n, { group: `drainage:head:${li}.${k}` }));
        }
        el(`head:${li}.${k}`, 'IfcPipeFitting', 'JUNCTION', rules.downpipe.material, [P(ln.axis, sc - hw, ln.at, ln.z - 0.9), P(ln.axis, sc + hw, ln.at + ln.out * (extT / 2 + 0.7), ln.z)]);
        outlets.push({ at: [...head.slice(0, 2), ln.z - 0.9], line: ln, s: sc, key: `${li}.${k}`, gutterAt: ln.at + ln.out * (extT / 2 + 0.35) });
      }
      report.gutters.fall = null;
      return;
    }
    // where its outlets go: over the wall, near each corner (one, at the far end, on a short wall), more while they
    // stand over 40 ft apart, each stepped clear of the openings under it; a valley's at its two ends
    let ss = [];
    if (ln.kind === 'valley') ss = [ln.s0 + 0.3, ln.s1 - 0.3];
    else if (ln.outlets) {
      const [w0, w1] = ln.axis === 'x' ? [fp.x0, fp.x1] : [fp.y0, fp.y1];
      ss = w1 - w0 > 24 ? [w0 + 0.75, w1 - 0.75] : [w1 - 0.75];
      // more, evenly, while they stand over 40 ft apart or carry more roof than they can
      while (ss.length > 1 && ((ss[ss.length - 1] - ss[0]) / (ss.length - 1) > 40 || ss.length < perLine)) { const n = ss.length; ss = Array.from({ length: n + 1 }, (_, i) => ss[0] + ((ss[n - 1] - ss[0]) * i) / n); }
      const ops = openingsOn(ln.axis, ln.wallAt);
      ss = ss.map((t) => clear(t, ops));
    }
    // the gutter falls to its nearest outlet from the point farthest from any (a line with none falls to its ends, into
    // the gutters round the corners)
    const stops = ss.length ? ss : [ln.s0, ln.s1];
    const knots = [...new Set([ln.s0, ln.s1, ...stops, ...stops.slice(0, -1).map((t, i) => (t + stops[i + 1]) / 2)])].filter((t) => t >= ln.s0 - 1e-6 && t <= ln.s1 + 1e-6).sort((a, b) => a - b);
    const dNear = (t) => Math.min(...stops.map((u) => Math.abs(u - t)));
    const dMax = Math.max(...knots.map(dNear));
    const zAt = (t) => ln.z - 0.06 - FALL * (dMax - dNear(t));
    const back = ln.kind === 'valley' ? ln.at - W / 2 : ln.at;
    const dir = ln.kind === 'valley' ? 1 : ln.out;
    for (let i = 0; i + 1 < knots.length; i++) {
      const s0 = knots[i], s1 = knots[i + 1];
      const z0 = zAt(s0), z1 = zAt(s1);
      for (let j = 0; j + 1 < sec.length; j++) {
        const [y0, d0] = sec[j], [y1, d1] = sec[j + 1];
        const c = [P(ln.axis, s0, back + dir * y0, z0 + d0), P(ln.axis, s1, back + dir * y0, z1 + d0), P(ln.axis, s1, back + dir * y1, z1 + d1), P(ln.axis, s0, back + dir * y1, z0 + d1)];
        let n = unit3(cross(sub(c[1], c[0]), sub(c[3], c[0])));
        if (n[2] < -0.3) n = mul(n, -1);
        faces.push(planeFace(c, fillOf(rules.gutter.material, n), n, { group: `drainage:gutter:${li}` }));
      }
    }
    // stop ends
    for (const s of [ln.s0, ln.s1]) {
      const z = zAt(s);
      for (let j = 0; j + 1 < sec.length; j++) {
        const [y0, d0] = sec[j], [y1, d1] = sec[j + 1];
        const c = [P(ln.axis, s, back + dir * y0, z + d0), P(ln.axis, s, back + dir * y1, z + d1), P(ln.axis, s, back + dir * y1, z), P(ln.axis, s, back + dir * y0, z)];
        if (Math.abs(d0) + Math.abs(d1) < 1e-4) continue;
        const n = ln.axis === 'x' ? [s === ln.s0 ? -1 : 1, 0, 0] : [0, s === ln.s0 ? -1 : 1, 0];
        faces.push(planeFace(c, fillOf(rules.gutter.material, n), n, { group: `drainage:gutter:${li}` }));
      }
    }
    el(`gutter:${li}`, 'IfcPipeSegment', 'GUTTER', rules.gutter.material, [P(ln.axis, ln.s0, back, ze), P(ln.axis, ln.s1, back + dir * W, ze - D - FALL * len)],
      { sweep: { from: P(ln.axis, ln.s0, back + dir * W / 2, ln.z - 0.06), to: P(ln.axis, ln.s1, back + dir * W / 2, ln.z - 0.06), section: sec.map(([y, d]) => [dir * (y - W / 2), d]) }, lengthFt: r1(len) });
    report.gutters.runs++; report.gutters.lengthFt += len;
    report.gutters.fall = `1 in ${Math.round(1 / FALL)}`;
    for (const [k, s] of ss.entries()) outlets.push({ at: P(ln.axis, s, back + dir * W / 2, zAt(s) - D), line: ln, s, key: `${li}.${k}`, gutterAt: back + dir * W / 2 });
  });
  report.gutters.lengthFt = r1(report.gutters.lengthFt);

  // ── downpipes (or chains) to an outlet at grade ──
  // a valley's or a deck's outlet is a box or scupper outlet into a pipe, never a chain
  const BOX_PIPE = { 'north-american': { shape: 'rect', size: [76, 102], material: 'pipe:downspout-3x4' }, british: { shape: 'round', size: [68], material: 'pipe:downpipe-68' }, japanese: { shape: 'round', size: [60], material: 'pipe:tatedoi-copper-60' }, metric: { shape: 'round', size: [80], material: 'pipe:downpipe-80-zinc' } };
  let dp = rules.downpipe, psec = null, pr = 0, matP = null;
  const usePipe = (d) => { dp = d; psec = d.shape === 'chain' ? null : pipeSection(d); pr = (d.size[0] * MM) / 2; matP = resolveMaterial(/copper/.test(d.material) ? 'copper' : /68/.test(d.material) ? 'plastic' : 'satin'); };
  const sweepFaces = (pts, section, material, gtag, side) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      let a = pts[i], b = pts[i + 1];
      const F = sweepFrame(a, b, side);
      a = sub(a, mul(F.ex, pr * 0.9)); b = addv(b, mul(F.ex, pr * 0.9));     // overlap into the bends
      const ring = (p) => section.map(([y, z]) => addv(addv(p, mul(F.ey, y)), mul(F.ez, z)));
      const ra = ring(a), rb = ring(b);
      for (let j = 0; j < section.length; j++) {
        const k = (j + 1) % section.length;
        const c = [ra[j], ra[k], rb[k], rb[j]];
        const n = unit3(addv(mul(F.ey, (section[j][0] + section[k][0]) / 2), mul(F.ez, (section[j][1] + section[k][1]) / 2)));
        faces.push(planeFace(c.map((p) => p.map(q4)), shadeHexMat(rgbHex(rgbOf(material)), n, matP, { light }), n, { group: gtag }));
      }
    }
  };
  const chainFaces = [];
  let chainRepeats = [];
  const belowFeet = [];                                                        // { at: [x, y], key } where a pipe goes into the ground
  for (const o2 of outlets) {
    const ln = o2.line;
    usePipe(ln.kind === 'eave' || rules.downpipe.shape !== 'chain' ? rules.downpipe : BOX_PIPE[rules.tradition] || BOX_PIPE.metric);
    const outDir = ln.kind === 'valley' ? 0 : ln.out;
    // the wall the pipe runs down: under the gutter, or (a valley) the gable wall at the line's end
    const valleyEnd = ln.kind === 'valley' ? (o2.s <= (ln.s0 + ln.s1) / 2 ? -1 : 1) : 0;
    const wallFace = ln.kind === 'valley' ? null : ln.wallAt + outDir * (extT / 2 + pr + 1.5 * IN);
    const top0 = o2.at;
    let pts;
    if (dp.shape === 'chain') {
      pts = [top0, [top0[0], top0[1], grade + 0.1]];
    } else if (ln.kind === 'valley') {
      // out through a scupper in the end wall onto a conductor head, down the gable
      const sOut = valleyEnd < 0 ? ln.s0 - (extT / 2 + pr + 1.5 * IN) : ln.s1 + (extT / 2 + pr + 1.5 * IN);
      const head = P(ln.axis, sOut, ln.at, top0[2] - 0.1);
      pts = [P(ln.axis, o2.s, ln.at, top0[2]), head, P(ln.axis, sOut, ln.at, grade + (rules.outlet === 'splash-block' ? 0.6 : 0.15))];
    } else {
      const drop = Math.abs(o2.gutterAt - wallFace);
      const zNeck = top0[2] - 0.35;
      pts = [top0, P(ln.axis, o2.s, o2.gutterAt, zNeck), P(ln.axis, o2.s, wallFace, zNeck - drop), P(ln.axis, o2.s, wallFace, grade + (rules.outlet === 'splash-block' ? 0.6 : 0.15))];
    }
    const foot = pts[pts.length - 1];
    if (rules.outlet === 'splash-block' && dp.shape !== 'chain') {
      const kick = ln.kind === 'valley' ? P(ln.axis, valleyEnd * 0.7, 0, 0) : P(ln.axis, 0, outDir * 0.7, 0);
      pts.push(addv(foot, [kick[0], kick[1], -0.35]));
    }
    const gtag = `drainage:pipe:${o2.key}`;
    if (dp.shape === 'chain') {
      // cups on a chain, one every 4 in
      for (let z = top0[2] - 0.2, n = 0; z > grade + 0.25; z -= 4 * IN, n++) {
        const r0 = 30 * MM, r1b = 20 * MM, h = 55 * MM;
        for (let i = 0; i < 8; i++) {
          const t0 = (Math.PI * 2 * i) / 8, t1 = (Math.PI * 2 * (i + 1)) / 8;
          const c = [[top0[0] + r1b * Math.cos(t0), top0[1] + r1b * Math.sin(t0), z - h], [top0[0] + r1b * Math.cos(t1), top0[1] + r1b * Math.sin(t1), z - h], [top0[0] + r0 * Math.cos(t1), top0[1] + r0 * Math.sin(t1), z], [top0[0] + r0 * Math.cos(t0), top0[1] + r0 * Math.sin(t0), z]];
          const tm = (t0 + t1) / 2, nn = [Math.cos(tm), Math.sin(tm), 0.2];
          chainFaces.push(planeFace(c.map((p) => p.map(q4)), shadeHexMat(rgbHex(rgbOf(dp.material)), unit3(nn), matP, { light }), unit3(nn), { group: `${gtag}:cup:${n}` }));
        }
      }
    } else {
      const side = ln.kind === 'valley' ? P(ln.axis, valleyEnd, 0, 0) : P(ln.axis, 0, outDir, 0);
      sweepFaces(pts, psec, dp.material, gtag, side);
    }
    let plen = 0; for (let i = 0; i + 1 < pts.length; i++) plen += dist(pts[i], pts[i + 1]);
    report.downpipes.count++; report.downpipes.lengthFt += plen;
    el(`pipe:${o2.key}`, 'IfcPipeSegment', dp.shape === 'chain' ? 'USERDEFINED' : 'RIGIDSEGMENT', dp.material, pts, { sweep: { path: pts.map((p) => p.map(q4)), section: dp.shape === 'chain' ? pipeSection({ shape: 'round', size: [60] }) : psec }, lengthFt: r1(plen), ...(dp.shape === 'chain' ? { objectType: 'RAINCHAIN' } : {}) });
    // the outlet at its foot
    const g = [pts[pts.length - 1][0], pts[pts.length - 1][1]];
    const box = (key, ifc, type, material, cx, cy, hx, hy, z0, z1, extra = {}) => {
      const lo = [cx - hx, cy - hy, z0], hi = [cx + hx, cy + hy, z1];
      const sides = [[[lo[0], lo[1], hi[2]], [hi[0], lo[1], hi[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]], [0, 0, 1]], [[lo[0], lo[1], lo[2]], [hi[0], lo[1], lo[2]], [hi[0], lo[1], hi[2]], [lo[0], lo[1], hi[2]], [0, -1, 0]], [[lo[0], hi[1], lo[2]], [hi[0], hi[1], lo[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]], [0, 1, 0]], [[lo[0], lo[1], lo[2]], [lo[0], hi[1], lo[2]], [lo[0], hi[1], hi[2]], [lo[0], lo[1], hi[2]], [-1, 0, 0]], [[hi[0], lo[1], lo[2]], [hi[0], hi[1], lo[2]], [hi[0], hi[1], hi[2]], [hi[0], lo[1], hi[2]], [1, 0, 0]]];
      for (const [a, b, c, d, n] of sides) faces.push(planeFace([a, b, c, d].map((p) => p.map(q4)), shadeHexMat(rgbHex(extra.rgb || rgbOf(material)), n, resolveMaterial('stone'), { light }), n, { group: `drainage:${key}` }));
      el(key, ifc, type, material, [lo, hi], extra.objectType ? { objectType: extra.objectType } : {});
    };
    if (rules.outlet === 'splash-block') {
      const kickOut = ln.kind === 'valley' ? P(ln.axis, valleyEnd, 0, 0) : P(ln.axis, 0, outDir, 0);
      const c = addv([g[0], g[1], 0], mul(kickOut, 0.6));
      const long = Math.abs(kickOut[0]) > 0.5;
      box(`splash:${o2.key}`, 'IfcBuildingElementProxy', 'USERDEFINED', 'precast:splash-block', c[0], c[1], long ? 1 : 0.5, long ? 0.5 : 1, grade, grade + 0.12, { objectType: 'SPLASHBLOCK' });
    } else if (rules.outlet === 'gully' || rules.outlet === 'masu') {
      box(`${rules.outlet}:${o2.key}`, rules.outlet === 'gully' ? 'IfcWasteTerminal' : 'IfcDistributionChamberElement', rules.outlet === 'gully' ? 'GULLYTRAP' : 'SUMP', rules.outlet === 'gully' ? 'fitting:gully' : 'fitting:masu', g[0], g[1], 0.45, 0.45, grade - 0.1, grade + 0.08);
      belowFeet.push({ at: g, key: o2.key, ln });
    } else if (rules.outlet === 'basin') {
      box(`basin:${o2.key}`, 'IfcBuildingElementProxy', 'USERDEFINED', 'stone:amaochi', g[0], g[1], 0.55, 0.55, grade, grade + 0.18, { objectType: 'RAINSTONE' });
    }
    report.outlets.count++;
  }
  usePipe(rules.downpipe);
  if (chainFaces.length) {
    const inst = instanceGroups(chainFaces, { name: 'drainage:chain' });
    faces.push(...inst.faces);
    chainRepeats = inst.repeats.map(({ members: _m, ...r }) => r);
  }
  report.downpipes.lengthFt = r1(report.downpipes.lengthFt);

  // ── below ground: from each foot out to a run round the house, falling to one outfall at the front ──
  if (rules.below && belowFeet.length) {
    const off = extT / 2 + 3;
    const R = { x0: fp.x0 - off, x1: fp.x1 + off, y0: fp.y0 - off, y1: fp.y1 + off };
    const per = 2 * (R.x1 - R.x0) + 2 * (R.y1 - R.y0);
    const param = ([x, y]) => {                                               // perimeter distance of a point on the ring
      if (Math.abs(y - R.y0) < 1e-6) return x - R.x0;
      if (Math.abs(x - R.x1) < 1e-6) return (R.x1 - R.x0) + (y - R.y0);
      if (Math.abs(y - R.y1) < 1e-6) return (R.x1 - R.x0) + (R.y1 - R.y0) + (R.x1 - x);
      return 2 * (R.x1 - R.x0) + (R.y1 - R.y0) + (R.y1 - y);
    };
    const at = (t) => { t = ((t % per) + per) % per; const a = R.x1 - R.x0, b = R.y1 - R.y0; if (t <= a) return [R.x0 + t, R.y0]; if (t <= a + b) return [R.x1, R.y0 + t - a]; if (t <= 2 * a + b) return [R.x1 - (t - a - b), R.y1]; return [R.x0, R.y1 - (t - 2 * a - b)]; };
    const snap = ([x, y]) => { const cands = [[x, R.y0], [x, R.y1], [R.x0, y], [R.x1, y]].map((p) => [p, Math.hypot(p[0] - x, p[1] - y)]); cands.sort((p, q) => p[1] - q[1]); const p = cands[0][0]; return [Math.min(R.x1, Math.max(R.x0, p[0])), Math.min(R.y1, Math.max(R.y0, p[1]))]; };
    const tOut = (R.x1 - R.x0) / 2;                                           // the outfall: the front of the ring, halfway
    const SLOPE = 1 / 80, inv0 = 1.5;
    const runs = [];                                                          // [t0, t1] intervals of the ring in use
    const junctions = belowFeet.map((b) => { const p = snap(b.at); const t = param(p); let d = t - tOut; if (d > per / 2) d -= per; if (d < -per / 2) d += per; return { ...b, p, t, d }; });
    const far = Math.max(...junctions.map((j) => Math.abs(j.d)));
    const zInv = (dd) => grade - inv0 - SLOPE * (far - Math.abs(dd));
    const chambers = new Map();
    const chamber = (t, name) => { const k = Math.round((((t % per) + per) % per) * 100); if (!chambers.has(k)) chambers.set(k, { t, name }); };
    for (const j of junctions) {
      runs.push(j.d >= 0 ? [tOut, tOut + j.d] : [tOut + j.d, tOut]);
      chamber(j.t, j.key);
    }
    chamber(tOut, 'outfall');
    // merge the intervals, add a chamber at each ring corner a run turns
    runs.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of runs) { if (merged.length && r[0] <= merged[merged.length - 1][1] + 1e-6) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]); else merged.push([...r]); }
    const corners = [0, R.x1 - R.x0, R.x1 - R.x0 + R.y1 - R.y0, 2 * (R.x1 - R.x0) + R.y1 - R.y0];
    const drainSec = pipeSection({ shape: 'round', size: [110] });
    const matD = resolveMaterial('plastic');
    const pipe = (a, b, key) => {
      const F = sweepFrame(a, b);
      const ring = (p) => drainSec.map(([y, z]) => addv(addv(p, mul(F.ey, y)), mul(F.ez, z)));
      const ra = ring(a), rb = ring(b);
      for (let j = 0; j < drainSec.length; j++) {
        const k = (j + 1) % drainSec.length;
        const n = unit3(addv(mul(F.ey, (drainSec[j][0] + drainSec[k][0]) / 2), mul(F.ez, (drainSec[j][1] + drainSec[k][1]) / 2)));
        faces.push(planeFace([ra[j], ra[k], rb[k], rb[j]].map((p) => p.map(q4)), shadeHexMat(rgbHex(rgbOf('pipe:drain-110')), n, matD, { light }), n, { group: `drainage:below:${key}` }));
      }
      el(`below:${key}`, 'IfcPipeSegment', 'RIGIDSEGMENT', 'pipe:drain-110', [a, b], { sweep: { path: [a, b].map((p) => p.map(q4)), section: drainSec }, lengthFt: r1(dist(a, b)) });
      report.below.lengthFt += dist(a, b);
    };
    merged.forEach(([t0, t1], mi) => {
      const ts = [t0, ...corners.flatMap((c) => [c, c + per, c - per]).filter((c) => c > t0 + 1e-6 && c < t1 - 1e-6), t1].sort((a, b) => a - b);
      for (let i = 0; i + 1 < ts.length; i++) {
        const [x0, y0] = at(ts[i]), [x1, y1] = at(ts[i + 1]);
        pipe([x0, y0, zInv(ts[i] - tOut)], [x1, y1, zInv(ts[i + 1] - tOut)], `${mi}.${i}`);
        if (i > 0) chamber(ts[i], 'corner');
      }
    });
    // each foot's branch, out to its junction
    for (const j of junctions) pipe([j.at[0], j.at[1], grade - inv0 + 0.3], [j.p[0], j.p[1], zInv(j.d)], `branch:${j.key}`);
    // the outfall, off the front to the boundary
    const [ox, oy] = at(tOut);
    pipe([ox, oy, zInv(0)], [ox, oy - 12, zInv(0) - 12 * SLOPE], 'outfall');
    for (const [, c] of chambers) {
      const [x, y] = at(c.t);
      const lo = [x - 0.75, y - 0.75, zInv(c.t - tOut) - 0.3], hi = [x + 0.75, y + 0.75, grade + 0.05];
      for (const [a, b, cc, d, n] of [[[lo[0], lo[1], hi[2]], [hi[0], lo[1], hi[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]], [0, 0, 1]], [[lo[0], lo[1], lo[2]], [hi[0], lo[1], lo[2]], [hi[0], lo[1], hi[2]], [lo[0], lo[1], hi[2]], [0, -1, 0]], [[lo[0], hi[1], lo[2]], [hi[0], hi[1], lo[2]], [hi[0], hi[1], hi[2]], [lo[0], hi[1], hi[2]], [0, 1, 0]], [[lo[0], lo[1], lo[2]], [lo[0], hi[1], lo[2]], [lo[0], hi[1], hi[2]], [lo[0], lo[1], hi[2]], [-1, 0, 0]], [[hi[0], lo[1], lo[2]], [hi[0], hi[1], lo[2]], [hi[0], hi[1], hi[2]], [hi[0], lo[1], hi[2]], [1, 0, 0]]]) {
        faces.push(planeFace([a, b, cc, d].map((p) => p.map(q4)), shadeHexMat(rgbHex(rgbOf('chamber:inspection')), n, resolveMaterial('stone'), { light }), n, { group: `drainage:chamber:${Math.round(c.t * 10)}` }));
      }
      el(`chamber:${Math.round(c.t * 10)}`, 'IfcDistributionChamberElement', rules.tradition === 'japanese' ? 'SUMP' : 'INSPECTIONCHAMBER', 'chamber:inspection', [lo, hi]);
      report.below.chambers++;
    }
    report.below.lengthFt = r1(report.below.lengthFt);
    report.below.fall = `1 in ${Math.round(1 / SLOPE)}`;
    report.checks.push({ rule: 'drain-fall', ok: SLOPE >= 1 / 100, fall: report.below.fall });
  }

  // ── checks ──
  const nBox = outlets.filter((x) => x.line.kind !== 'eave').length, nEave = outlets.length - nBox;
  const carries = nEave * capM2 + nBox * boxCapM2;
  report.roofAreaM2 = r1(planM2);
  report.checks.push({ rule: 'outlet-capacity', ok: outlets.length > 0 && effM2 <= carries, areaPerOutletM2: r1(outlets.length ? effM2 / outlets.length : 0), capacityM2: r1(outlets.length ? carries / outlets.length : 0), rainfallMmH: rules.rainfall });
  report.checks.push({ rule: 'gutter-per-eave', ok: report.gutters.runs === lines.filter((l) => l.kind !== 'scupper-edge').length });
  report.checks.push({ rule: 'downpipe-to-grade', ok: report.downpipes.count === report.outlets.count && report.outlets.count > 0 });
  report.failed = report.checks.filter((c) => !c.ok).length;
  return { faces: tagFacesWithMaterial(faces, matG), repeats: chainRepeats, elements, report };
}
