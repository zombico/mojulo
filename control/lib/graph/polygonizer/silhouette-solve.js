/**
 * silhouette-solve — a drawn SILHOUETTE becomes a dial solve.
 *
 * A closed `silhouette` stroke (stroke-resolve.js) is rasterised into the stroke's own camera square; the
 * solid's continuous SHAPE dials are then moved, within their declared bounds, to maximise the overlap
 * (IoU) between the compiled mesh's silhouette from that camera and the drawn one. The camera is the
 * stroke's recorded one, fixed for the whole solve: a dial that grows the solid must not also re-frame it.
 *
 * Solver: deterministic coordinate descent — for each dial in turn try a step up and a step down (a
 * fraction of the dial's range), keep the first that improves, halve the step when a full pass improves
 * nothing, stop at the compile budget or when the step falls under 1/256 of the range. No dice, no
 * gradient; the objective is monotone non-increasing by construction. Posing dials (`hinge`, `chain`) are
 * not shape and move only when named.
 *
 * The RESIDUAL is the product: the pixels where the drawn silhouette and the solved one disagree, as a
 * share of the drawn area (above 1 when the solid spills past the drawing by more than the drawing's own
 * area) and a normalized box, plus the dials that ended on a bound (the grammar was short a word there).
 * The mask is returned for a sheet, never persisted.
 *
 * A silhouette is the outline of the WHOLE solid in that view. One drawn around a part of it (a jaw, the
 * head) encloses a sliver of the solid's outline, and the whole-mesh IoU would drive every body-wide shape
 * dial to its bound for a sliver of overlap; a drawing that encloses less than SILHOUETTE_MIN_COVER of the
 * solid's outline is refused (a local change is a contour or a brush stroke).
 */
import { rasterDepth, rasterMask } from '../scene/depth-raster.js';
import { compileLayered, resolveLayeredDials } from './station-loft.js';
import { strokeCamera, meshSource } from './stroke-resolve.js';

export const SHAPE_DIAL_OPS = Object.freeze(['scale', 'offset', 'stretch']);
/** the least share of the solid's own outline (in the stroke's camera, at the start dials) a silhouette must enclose */
export const SILHOUETTE_MIN_COVER = 0.25;
const r3 = (x) => Math.round(x * 1000) / 1000; const r4 = (x) => Math.round(x * 1e4) / 1e4;

/** The dials a silhouette moves: every continuous shape dial (scale / offset / stretch), or the ones named. */
export function solvableDials(recipe, names = null) {
  const spec = recipe.dials || {};
  if (names) { for (const n of names) if (!spec[n]) throw new Error(`silhouette-solve: unknown dial '${n}' (have ${Object.keys(spec).join(', ') || 'none'})`); return [...names]; }
  return Object.entries(spec).filter(([, d]) => SHAPE_DIAL_OPS.includes(d.op) && d.max > d.min).map(([n]) => n);
}

/** A closed stroke as a res × res mask in its camera square: even-odd scanline fill of the polygon. */
export function strokeMask(stroke, res) {
  const pts = stroke.points.map(([x, y]) => [x * res, y * res]); const n = pts.length; const mask = new Uint8Array(res * res);
  for (let j = 0; j < res; j++) {
    const y = j + 0.5; const xs = [];
    for (let k = 0; k < n; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % n]; if ((y0 <= y) !== (y1 <= y)) xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0)); }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(res - 1, Math.floor(xs[k + 1] - 0.5)); for (let i = a; i <= b; i++) mask[j * res + i] = 1; }
  }
  return mask;
}

const iou = (a, b) => { let inter = 0, uni = 0; for (let k = 0; k < a.length; k++) { if (a[k] | b[k]) { uni++; if (a[k] & b[k]) inter++; } } return uni ? inter / uni : 1; };
/** where two masks disagree: count, share of the target, normalized bbox */
export function residualOf(target, got, res) {
  let n = 0, tn = 0, x0 = res, y0 = res, x1 = -1, y1 = -1; const xor = new Uint8Array(res * res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) { const k = j * res + i; if (target[k]) tn++; if (target[k] !== got[k]) { xor[k] = 1; n++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
  return { pixels: n, share: tn ? r4(n / tn) : (n ? 1 : 0), bbox: n ? [x0 / res, y0 / res, (x1 + 1) / res, (y1 + 1) / res].map(r4) : null, mask: xor };
}

/**
 * fitSilhouetteDials(recipe, dials, stroke, { names?, budget = 60, res = 128, mesh? })
 *   → { dials, moved, bounds, iou, before, residual, compiles, trace }
 * `mesh` is the compiled mesh at `dials` (saves one compile); the stroke's camera comes from its record, else
 * from that mesh's framing (stroke-resolve.js strokeCamera).
 */
export function fitSilhouetteDials(recipe, dials, stroke, { names = null, budget = 60, res = 128, mesh = null } = {}) {
  if (stroke.intent !== 'silhouette') throw new Error(`silhouette-solve: stroke '${stroke.id}' is a ${stroke.intent}, not a silhouette`);
  if (!Array.isArray(stroke.points) || stroke.points.length < 3) throw new Error(`silhouette-solve: stroke '${stroke.id}' needs a closed outline of at least three points`);
  const spec = recipe.dials || {}; const start = resolveLayeredDials(spec, dials || {});
  const solve = solvableDials(recipe, names);
  const mesh0 = mesh || compileLayered(recipe, start); const cam = strokeCamera(stroke, mesh0);
  const target = strokeMask(stroke, res); let tn = 0; for (let k = 0; k < target.length; k++) tn += target[k];
  if (!tn) throw new Error(`silhouette-solve: stroke '${stroke.id}' encloses no area at ${res} px`);
  let compiles = 0;
  const silhouette = (d) => { compiles++; const m = compiles === 1 && mesh ? mesh : compileLayered(recipe, d); return rasterMask(rasterDepth(meshSource(m), cam, res)); };
  const objective = (d) => 1 - iou(silhouette(d), target);
  const mask0 = silhouette(start); let sn = 0; for (let k = 0; k < mask0.length; k++) sn += mask0[k];
  if (tn < SILHOUETTE_MIN_COVER * sn) throw new Error(`silhouette-solve: stroke '${stroke.id}' encloses ${Math.round(100 * tn / sn)} % of the solid's outline in its view; a silhouette is the outline of the WHOLE solid there (at least ${100 * SILHOUETTE_MIN_COVER} %) — for a local change (a jaw, a cheek) draw a contour or a brush stroke`);
  let cur = { ...start }; let best = 1 - iou(mask0, target); const before = 1 - best; const trace = [r4(best)];
  if (solve.length) {
    let step = 0.25;
    while (compiles < budget && step >= 1 / 256) {
      let improved = false;
      for (const name of solve) {
        const { min, max } = spec[name]; const range = max - min;
        for (const sgn of [1, -1]) {
          if (compiles >= budget) break;
          const v = Math.min(max, Math.max(min, cur[name] + sgn * step * range)); if (v === cur[name]) continue;
          const trial = { ...cur, [name]: v }; const f = objective(trial);
          if (f < best - 1e-9) { best = f; cur = trial; improved = true; trace.push(r4(best)); break; }
        }
        if (compiles >= budget) break;
      }
      if (!improved) step /= 2;
    }
  }
  const got = silhouette(cur); const residual = residualOf(target, got, res);
  const out = Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, Math.min(spec[k].max, Math.max(spec[k].min, r4(v)))]));
  const moved = solve.filter((n) => out[n] !== start[n]).map((n) => [n, out[n]]);
  const bounds = solve.filter((n) => out[n] === spec[n].min || out[n] === spec[n].max).map((n) => `${n}=${out[n]} (${out[n] === spec[n].min ? 'min' : 'max'})`);
  // the values the moved dials had before, so a solve can be undone by hand (a layered row keeps no revisions)
  const was = Object.fromEntries(moved.map(([n]) => [n, start[n]]));
  return { dials: out, moved: Object.fromEntries(moved), was, bounds, iou: r3(1 - best), before: r3(before), residual, compiles, trace, res, solved: solve };
}

/** The residual of a silhouette stroke against THIS mesh (no solve): what the form reaches now. */
export function silhouetteResidual(mesh, stroke, { res = 128 } = {}) {
  const cam = strokeCamera(stroke, mesh); const target = strokeMask(stroke, res); const got = rasterMask(rasterDepth(meshSource(mesh), cam, res));
  const r = residualOf(target, got, res); return { iou: r3(iou(got, target)), share: r.share, bbox: r.bbox, mask: r.mask, res };
}

/** What a solve leaves on the stroke: its summary, the residual without the mask, and the moved dials' earlier values. */
export function solvedRecord(fit) {
  return { iou: fit.iou, before: fit.before, residual: { share: fit.residual.share, bbox: fit.residual.bbox }, dials: fit.moved, ...(Object.keys(fit.moved).length ? { dialsBefore: fit.was } : {}), ...(fit.bounds.length ? { bounds: fit.bounds } : {}), compiles: fit.compiles };
}
