/**
 * THE CHASSIS — the second page of the technology design loop: a crafted thing's 66, as low-poly masses on a rigid rig,
 * in the workbench's own vocabulary (worlds/workbench.js: lofts, lathes, sweeps, extrudes), so it lowers, draws and
 * exports like any polygomer. It is SOLVED from the form's body plan (tech-bodyplan.js), never drawn by hand. Every mass is a monomer with a `piece` and a `role`; the rig is named JOINTS (a pivot, an
 * axis, a range, the pieces it carries, its parent); the adornment's places are named SOCKETS (a point, an outward
 * normal, a size, the functions what hangs there would serve).
 *
 * The direction (tech-direction.js) shapes it: the motif chooses a section (smooth: a rounded superellipse; faceted,
 * riveted, spiked: a chamfered box; organic: rounder; ornate: chamfered and finer), the style exaggerates by tier, and
 * the world's camera sets where it is met. A loop then holds it to the readout (tech-readout.js): its facets on today's
 * screen at the meet distance, its triangles under its rank's ceiling, its silhouette segments, one piece leading, and
 * every function the chassis carries showing. What the words claimed that only adornment can show (an armoured walker's
 * plates, a tower's dish) is PROMISED to the next page, never failed here.
 *
 *   CHASSIS_FORMS                       the forms with a body plan (tech-bodyplan.js BODY_PLANS)
 *   chassisManifest(thing, opts)        → { manifest, joints, sockets, pieces, lead, functions, promised }
 *   lowerChassis(manifest)              → faces, each tagged { piece, role } (lowered monomer by monomer)
 *   chassisLaws(faces, built, opts)     → [{ law, ok, value }]
 *   buildChassis(thing, { direction, rank, use, seed, passes }) → { …chassisManifest, faces, readout, laws, passes, held }
 *
 * Pure; no dice (a chassis is a function of its thing and its direction).
 */
import { lowerObjectFaces } from '../worlds/workbench.js';
import { BODY_PLANS, solveBodyPlan } from './tech-bodyplan.js';
import { FUNCTIONS } from '../era/blocks.js';
import { techReadout } from './tech-readout.js';
import { TECH_STYLES, pxPerMetre, meetDistance } from './tech-eras.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
/** The value each group is built at (era/blocks.js parts take the same): what the paint (page four) colours. */
export const GROUP_VALUE = Object.freeze({ 'tech:body': 0.72, 'tech:frame': 0.4, 'tech:skin': 0.8, 'tech:trim': 0.5, 'tech:light': 0.9, 'tech:glass': 0.15, 'tech:cable': 0.3, 'str:accent': 0.9 });

/** A section in its plane (u across, v up), by motif: `w` wide, `h` high, `n` points round (the resolution dial). */
export function section(motif, w, h, n = 12) {
  const a = w / 2, b = h / 2;
  if (['smooth', 'organic'].includes(motif)) {
    // a superellipse, its points spaced evenly along its outline (evenly by angle they bunch at the corners and leave
    // the flanks one wide facet each)
    const e = motif === 'organic' ? 2.4 : 3.2, M = 256, dense = [], at = (t) => { const c = Math.cos(t), s = Math.sin(t); return [a * Math.sign(c) * Math.abs(c) ** (2 / e), b * Math.sign(s) * Math.abs(s) ** (2 / e)]; };
    for (let i = 0; i <= M; i++) dense.push(at((2 * Math.PI * i) / M));
    const cum = [0];
    for (let i = 1; i <= M; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    const total = cum[M], pts = [];
    for (let i = 0, j = 1; i < n; i++) {
      const want = ((i + 0.5) / n) * total;
      while (cum[j] < want) j++;
      const f = (want - cum[j - 1]) / (cum[j] - cum[j - 1]);
      pts.push([r3(dense[j - 1][0] + f * (dense[j][0] - dense[j - 1][0])), r3(dense[j - 1][1] + f * (dense[j][1] - dense[j - 1][1]))]);
    }
    return pts;
  }
  // chamfered: the corners cut by a share of the lesser side (finer for ornate, coarser for riveted)
  const k = Math.min(a, b) * (motif === 'riveted' ? 0.25 : motif === 'ornate' ? 0.32 : 0.4);
  return [[-a + k, -b], [a - k, -b], [a, -b + k], [a, b - k], [a - k, b], [-a + k, b], [-a, b - k], [-a, -b + k]];
}

/** The forms with a body plan (tech-bodyplan.js): a row each, solved by one solver. Every other form keeps its block
 * until it has a row. */
export const CHASSIS_FORMS = BODY_PLANS;
export const hasChassis = (kind, form) => !!BODY_PLANS[`${kind}/${form}`];

/**
 * Each round sized for where it is met: points round a radius r, and rings along a curved length, enough that a facet
 * reads under the style's limit at `pxPerM` pixels a metre (with a margin), `res` a tweak over all of them.
 */
// the most points a round may take: enough for a tank's wheel seen from its own cockpit (2.5 m), where a round is
// read across a third of the screen
export const FIT_MAX = 96;
export function fitter(pxPerM, limit, res = 1) {
  const lim = limit * 0.85;
  return { fit: (r) => Math.max(6, Math.min(FIT_MAX, Math.ceil((2 * Math.PI * r * pxPerM * res) / lim))), fitLen: (len) => Math.max(2, Math.min(FIT_MAX, Math.ceil((len * pxPerM * res) / lim))) };
}
export function chassisManifest(t, { kind, motif = 'smooth', style = 'wc3', camera = 'third-person', use = 'watched', res = 1, thick = {}, tuck = 1 } = {}) {
  const row = BODY_PLANS[`${kind}/${t.form}`];
  if (!row) throw new Error(`chassis: no body plan for a ${kind} ${t.form} yet (${Object.keys(BODY_PLANS).join(', ')})`);
  const dials = t.dials ?? {}, scale = r3((dials.scale ?? 1) * (TECH_STYLES[style].exaggeration[t.block.tier] ?? 1));
  const { fit, fitLen } = fitter(pxPerMetre(meetDistance(camera, t.block.tier, use)), TECH_STYLES[style].facetPx[1], res);
  const out = solveBodyPlan(row, t, { motif, scale, fit, fitLen, thick, tuck });
  // what the words claimed that this chassis cannot show is the adornment's to show
  const promised = t.block.functions.filter((f) => !out.functions.includes(f));
  return { ...out, functions: out.functions, promised, scale };
}

/** Lower a chassis monomer by monomer, each face tagged with its piece and role. */
export function lowerChassis(manifest, pieces) {
  const faces = [];
  for (const key of ['lofts', 'lathes', 'sweeps', 'extrudes']) for (const spec of manifest[key] ?? []) {
    for (const f of lowerObjectFaces({ kind: 'workbench', units: manifest.units, [key]: [spec] })) faces.push({ ...f, piece: pieces[spec.id].piece, role: pieces[spec.id].role, monomer: spec.id, value: pieces[spec.id].value ?? GROUP_VALUE[spec.group] ?? 0.6 });
  }
  return faces;
}

// the picture each piece takes from the sheet's eye (era/blocks.js one-leads, on tagged faces)
const EYE = [-0.47, 0.67, -0.5];
function pictureByPiece(faces) {
  const area = {};
  for (const f of faces) {
    const n = f.outNormal ?? [0, 0, 1], k = Math.abs(n[0] * EYE[0] + n[1] * EYE[1] + n[2] * EYE[2]), c = f.corners;
    let a = [0, 0, 0];
    for (let i = 1; i + 1 < c.length; i++) { const u = [0, 1, 2].map((j) => c[i][j] - c[0][j]), v = [0, 1, 2].map((j) => c[i + 1][j] - c[0][j]); a = add(a, [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], 0.5); }
    area[f.piece] = (area[f.piece] ?? 0) + Math.hypot(...a) * k;
  }
  return area;
}

/** The chassis laws: one piece leads, it stands, every function it carries shows; the readout's facets, ceiling and segments. */
export function chassisLaws(faces, c, readout) {
  const out = [], law = (id, ok, value) => out.push({ law: id, ok, value });
  const area = pictureByPiece(faces), ranked = Object.entries(area).sort((a, b) => b[1] - a[1]), lead = ranked.find(([p]) => p === c.lead), next = ranked.find(([p]) => p !== c.lead);
  law('one-leads', !!lead && (!next || lead[1] >= 1.5 * next[1]), lead ? `${lead[0]} ${r3(lead[1])} m²${next ? ` over ${next[0]} ${r3(next[1])} m²` : ''}` : 'the lead is not drawn');
  const zMin = Math.min(...faces.flatMap((f) => f.corners.map((p) => p[2])));
  if (!(c.mounts ?? ['ground']).includes('water')) law('stands', Math.abs(zMin) <= 0.05, `foot at ${r3(zMin)} m`);
  const roles = new Set(faces.map((f) => f.role)), missing = [];
  for (const f of c.functions) for (const any of FUNCTIONS[f].reads) if (!any.some((r) => roles.has(r))) missing.push(`${f}: ${any.join(' or ')}`);
  law('functions-read', !missing.length, missing.length ? `missing ${missing.join('; ')}` : c.functions.join(', '));
  for (const a of readout.advice) if (['facets', 'budget'].includes(a.law)) law(a.law, false, a.line);
  for (const id of ['facets', 'budget']) if (!out.some((l) => l.law === id)) law(id, true, id === 'facets' ? `widest ${readout.facetPx.widest} px, median ${readout.facetPx.median} px` : `${readout.triangles} of ${readout.ceiling}`);
  // the 66 alone stays inside its outline: too few segments is the adornment's to make (promised); too many is the chassis'
  const [lo, hi] = readout.segmentBand;
  law('inverse-interest', readout.segments <= hi, readout.segments < lo ? `${readout.segments} segments: ${lo - readout.segments} more promised to the adornment` : `${readout.segments} segments`);
  return out;
}

/**
 * A thing's chassis, held to its laws: built at a resolution, read, and moved until its facets read in band and its lead
 * leads (more points round when its facets read too wide, fewer when too narrow, its lead grown when another piece takes
 * the picture), a bounded number of passes, every pass logged.
 */
export function buildChassis(t, { kind, direction = {}, rank = 'interactable', use = 'watched', passes = 6 } = {}) {
  const motif = direction.motif ?? 'smooth', style = direction.style ?? 'wc3', camera = direction.camera ?? 'third-person';
  let res = 1, thick = {}, last;
  const log = [];
  for (let p = 0; p < passes; p++) {
    const c = chassisManifest(t, { kind, motif, style, camera, use, res, thick }), faces = lowerChassis(c.manifest, c.pieces);
    const readout = techReadout(faces, { tier: t.block.tier, rank, use, camera, style }), laws = chassisLaws(faces, c, readout), failed = laws.filter((l) => !l.ok);
    last = { ...c, faces, readout, laws, res, thick };
    const entry = { pass: p + 1, res, triangles: readout.triangles, facetPx: readout.facetPx.widest, failed: failed.map((l) => l.law) };
    log.push(entry);
    if (!failed.length || p === passes - 1) break;
    const changed = [];
    for (const l of failed) {
      if (l.law === 'facets' && readout.facetPx.widest > readout.facetPx.band[1] && res < 4) { res = r3(Math.min(4, res * Math.max(1.05, readout.facetPx.widest / readout.facetPx.band[1]))); changed.push(`res ${res} (facets ${readout.facetPx.widest} px)`); }
      else if (l.law === 'facets' && readout.facetPx.median < readout.facetPx.band[0] && res > 0.5) { res = r3(Math.max(0.5, res * 0.75)); changed.push(`res ${res} (facets wasted)`); }
      else if (l.law === 'budget' && res > 0.5) { res = r3(Math.max(0.5, res * 0.8)); changed.push(`res ${res} (over budget)`); }
      else if (l.law === 'one-leads') { thick = { ...thick, [c.lead]: r3((thick[c.lead] ?? 1) * 1.12) }; changed.push(`${c.lead} × ${thick[c.lead]} (one leads)`); }
    }
    entry.changed = changed;
    if (!changed.length) break;
  }
  return { ...last, passes: log, held: last.laws.every((l) => l.ok) };
}
