/**
 * stroke-resolve — a STROKE drawn on a layered solid becomes surface addresses.
 *
 * A stroke is data on the layered manifest (`strokes: [...]`), the authoring record of a person who
 * thinks in lines: `{ id, view, intent, points: [[x, y, pressure], …], mirror?, closed?, note?, camera? }`.
 * `view` names one of depth-raster's azimuths (frontal, three-quarter, …) or gives `{ azimuth, elevation }`;
 * `points` are normalized image coordinates in [0, 1]² (x right, y down) with pressure in [0, 1];
 * `intent` says what the stroke asks for (STROKE_INTENTS). `camera` is the orbit camera the stroke was
 * drawn against, recorded when the stroke is stored (`cameraRecord`) so it means the same thing after the
 * form under it changes; without one, the camera is the view's framing of the current mesh.
 *
 * Resolving (`resolveStroke`) casts each point through the view's z-buffer (depth-raster.js) onto the
 * compiled mesh: a hit on a layer-1 face becomes the station/slot parameter address `(part, s, t, side)`
 * the detail operators use (station-loft-detail.js `address`), by perspective-correct barycentrics over
 * the face's provenance; a hit on a pinned detail (layer ≥ 2) reports the detail (`via`) and its pin's
 * carrier address; a point off the solid is a miss and stays in view space. `mirror` adds the bilateral
 * twin by name: the same (s, t) on the other side.
 *
 * The mesh is read as the wire CLI reads it — unseated, the recipe's own frame — so a stroke drawn on the
 * wire SVG and one drawn on the World page overlay (which shifts back the seat) resolve alike.
 * Pure, deterministic: nothing here rolls dice.
 */
import { orbitCamera, projectVertices } from '../scene/wire-svg.js';
import { LAYERED_VIEWS, viewAzimuth, viewCamera, rasterDepth } from '../scene/depth-raster.js';
import { mirrorPid } from './station-loft.js';
import { pinToAddress } from './station-loft-detail.js';

export const STROKE_INTENTS = Object.freeze(['silhouette', 'contour', 'brush', 'landmark', 'fold']);
export const STROKE_RES = 512;
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A view is a named azimuth or `{ azimuth, elevation? }`. */
export function viewOf(view) {
  if (typeof view === 'string') { if (!LAYERED_VIEWS.includes(view)) throw new Error(`stroke: view must be one of ${LAYERED_VIEWS.join(', ')} or { azimuth, elevation? } (got '${view}')`); return { azimuth: viewAzimuth(view), elevation: 10, name: view }; }
  if (isObj(view) && Number.isFinite(view.azimuth)) return { azimuth: view.azimuth, elevation: Number.isFinite(view.elevation) ? view.elevation : 10, name: null };
  throw new Error(`stroke: view must be one of ${LAYERED_VIEWS.join(', ')} or { azimuth, elevation? }`);
}

/** Error strings for a strokes list (empty = valid). Form only; a stroke's fitness is the resolve's to judge. */
export function validateStrokes(strokes) {
  if (strokes === undefined) return [];
  if (!Array.isArray(strokes)) return ['strokes: must be a list of { id, view, intent, points, mirror?, closed?, note? }'];
  const errs = []; const ids = new Set();
  strokes.forEach((s, i) => {
    const at = `strokes[${i}]`;
    if (!isObj(s)) { errs.push(`${at}: must be an object`); return; }
    if (typeof s.id !== 'string' || !/^[A-Za-z0-9_.-]{1,40}$/.test(s.id)) errs.push(`${at}.id: a short name ([A-Za-z0-9_.-], ≤ 40 chars)`);
    else if (ids.has(s.id)) errs.push(`${at}.id: '${s.id}' is carried twice`); else ids.add(s.id);
    try { viewOf(s.view); } catch (e) { errs.push(`${at}.view: ${e.message.replace(/^stroke: view /, '')}`); }
    if (!STROKE_INTENTS.includes(s.intent)) errs.push(`${at}.intent: one of ${STROKE_INTENTS.join(', ')}`);
    if (!Array.isArray(s.points) || s.points.length < 2) errs.push(`${at}.points: at least two [x, y, pressure?] points`);
    else s.points.forEach((p, k) => {
      if (!Array.isArray(p) || p.length < 2 || p.length > 3 || !p.every(Number.isFinite)) { errs.push(`${at}.points[${k}]: [x, y] or [x, y, pressure], finite`); return; }
      if (p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1) errs.push(`${at}.points[${k}]: x and y are normalized image coordinates in [0, 1]`);
      if (p.length === 3 && (p[2] < 0 || p[2] > 1)) errs.push(`${at}.points[${k}]: pressure in [0, 1]`);
    });
    if (s.intent === 'silhouette' && s.closed === false) errs.push(`${at}: a silhouette stroke is closed`);
    if (s.intent === 'silhouette' && Array.isArray(s.points) && s.points.length < 3) errs.push(`${at}: a silhouette needs at least three points`);
    for (const k of ['mirror', 'closed']) if (s[k] !== undefined && typeof s[k] !== 'boolean') errs.push(`${at}.${k}: true or false`);
    if (s.note !== undefined && typeof s.note !== 'string') errs.push(`${at}.note: a string`);
    if (s.camera !== undefined && !isCameraRecord(s.camera)) errs.push(`${at}.camera: { azimuth, elevation, target: [x, y, z], distance > 0, focalPixels > 0, size > 0 } (recorded when the stroke is stored; leave it out)`);
    if (s.solved !== undefined) errs.push(...solvedErrors(s.solved, `${at}.solved`));
  });
  return errs;
}
const isCameraRecord = (c) => isObj(c) && ['azimuth', 'elevation', 'distance', 'focalPixels', 'size'].every((k) => Number.isFinite(c[k])) && ['distance', 'focalPixels', 'size'].every((k) => c[k] > 0)
  && Array.isArray(c.target) && c.target.length === 3 && c.target.every(Number.isFinite);

// What a solve leaves on a stroke (silhouette-solve.js solvedRecord; the contour and brush records in layered-strokes.js).
// The readers index into it (measure_solid joins `bounds`, the World overlay counts `parts`), so a record that did not
// come from a solve is refused by field here instead of throwing on a later read. Unknown keys pass.
const SOLVED_NUMBERS = ['iou', 'before', 'compiles', 'stations', 'height', 'width', 'hits', 'misses', 'entries', 'amp', 'radius', 'pointsMoved', 'maxPush'];
const isStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumberMap = (v) => isObj(v) && Object.values(v).every(Number.isFinite);
function solvedErrors(v, at) {
  const leave = 'written by the solve; leave it out, or re-solve';
  if (!isObj(v)) return [`${at}: ${leave}`];
  const errs = [];
  for (const k of SOLVED_NUMBERS) if (v[k] !== undefined && !Number.isFinite(v[k])) errs.push(`${at}.${k}: a number (${leave})`);
  for (const k of ['carrier', 'side', 'dial']) if (v[k] !== undefined && typeof v[k] !== 'string') errs.push(`${at}.${k}: a string (${leave})`);
  for (const k of ['bounds', 'parts']) if (v[k] !== undefined && !isStrings(v[k])) errs.push(`${at}.${k}: a list of strings (${leave})`);
  if (v.dials !== undefined && !isNumberMap(v.dials)) errs.push(`${at}.dials: { <dial>: number } (${leave})`);
  if (v.residual !== undefined && !(isObj(v.residual) && Number.isFinite(v.residual.share) && (v.residual.bbox === null || (Array.isArray(v.residual.bbox) && v.residual.bbox.length === 4 && v.residual.bbox.every(Number.isFinite))))) errs.push(`${at}.residual: { share: number, bbox: [x0, y0, x1, y1] | null } (${leave})`);
  if (v.exposure !== undefined && !(isObj(v.exposure) && Object.values(v.exposure).every((e) => e === null || (isObj(e) && Number.isFinite(e.exposed) && typeof e.flag === 'string')))) errs.push(`${at}.exposure: { <part>: { exposed, flag } | null } (${leave})`);
  return errs;
}

/** The source the wire CLI draws: the compiled mesh's own vertices and faces, unseated. */
export const meshSource = (mesh) => ({ vertices: mesh.vertices, faces: mesh.faces });

/** The camera a stroke is drawn against, as a record the manifest can carry: the view's framing of this mesh. */
export function cameraRecord(mesh, view) {
  const V = viewOf(view); const cam = viewCamera(meshSource(mesh), V.azimuth, { elevationDegrees: V.elevation });
  const m = cam.meta;
  return { azimuth: V.azimuth, elevation: V.elevation, target: m.target.map(r6), distance: r6(m.distance), focalPixels: m.focalPixels, size: cam.size };
}
/** The orbit camera of a stroke: its record when it has one, else the view's framing of `mesh`. */
export function strokeCamera(stroke, mesh) {
  const c = stroke.camera;
  if (isCameraRecord(c)) return orbitCamera({ azimuthDegrees: c.azimuth, elevationDegrees: c.elevation, target: c.target, distance: c.distance, focalPixels: c.focalPixels, size: c.size });
  const V = viewOf(stroke.view); return viewCamera(meshSource(mesh), V.azimuth, { elevationDegrees: V.elevation });
}

// ── slot and station parameters (the continuous coordinates station-loft-detail's `address` reads) ──
/** the parameter of a slot on its part and which side it lies: midline and right-half slots are 'R'. */
function slotParam(part, slot) {
  const n = part.slots.length, half = n / 2, idx = part.slots.indexOf(slot);
  if (idx < 0) throw new Error(`stroke: slot ${slot} is not on ${part.slots.join(',')}`);
  if (idx <= half) return { t: part.slotT?.[slot] ?? idx, side: 'R' };
  return { t: part.slotT?.[mirrorPid(slot)] ?? (n - idx), side: 'L' };
}
const stationParam = (part, stationId) => { const i = part.stations.findIndex((st) => st.id === stationId); return part.stations[i].u ?? i; };

/** the address of a layer-1 face hit: perspective-correct barycentrics over the face's station/slot parameters. */
function l1Address(mesh, part, partName, tri, weights, faceId) {
  let s = 0, t = 0, wsum = 0, side = 'R', cap = null;
  const m = faceId.match(/\/(back|tip)\.k\d+$/); if (m) cap = m[1];
  tri.forEach((vi, k) => {
    const pv = mesh.provenance[vi];
    if (!pv.station) return;   // a cap vertex has no station: its weight folds onto the ring
    const sp = slotParam(part, pv.slot); if (sp.side === 'L') side = 'L';
    s += weights[k] * stationParam(part, pv.station); t += weights[k] * sp.t; wsum += weights[k];
  });
  if (!(wsum > 0)) return null;
  return { part: partName, s: r6(s / wsum), t: r6(t / wsum), side, ...(cap ? { cap } : {}) };
}

/**
 * resolveStroke(mesh, stroke, { res }) → { camera, addresses: [{ x, y, pressure, hit }], hits, misses, mirrored? }
 * `hit` is null off the solid, else `{ face, faceId, layer, part, world: [x, y, z], s, t, side, via?, cap? }`.
 */
export function resolveStroke(mesh, stroke, { res = STROKE_RES } = {}) {
  const cam = strokeCamera(stroke, mesh); const source = meshSource(mesh);
  const raster = rasterDepth(source, cam, res); const q = projectVertices(source.vertices, cam);
  const addresses = stroke.points.map(([x, y, pressure = 0.5]) => {
    const i = Math.min(res - 1, Math.max(0, Math.floor(x * res))), j = Math.min(res - 1, Math.max(0, Math.floor(y * res)));
    const fi = raster.face[j * res + i];
    if (fi < 0) return { x, y, pressure, hit: null };
    const tri = mesh.faces[fi]; const px = x * cam.size, py = y * cam.size;
    // screen barycentrics at the exact point, made perspective-correct by 1/z; clamped to the face
    const p = tri.map((vi) => q[vi]);
    const den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
    let b = [1 / 3, 1 / 3, 1 / 3];
    if (Math.abs(den) > 1e-12) {
      const ba = ((p[1][1] - p[2][1]) * (px - p[2][0]) + (p[2][0] - p[1][0]) * (py - p[2][1])) / den;
      const bb = ((p[2][1] - p[0][1]) * (px - p[2][0]) + (p[0][0] - p[2][0]) * (py - p[2][1])) / den;
      b = [ba, bb, 1 - ba - bb].map((v) => Math.max(0, v)); const sum = b[0] + b[1] + b[2]; b = b.map((v) => v / sum);
    }
    const pc = b.map((v, k) => v / p[k][2]); const ps = pc[0] + pc[1] + pc[2]; const w = pc.map((v) => v / ps);
    const world = [0, 1, 2].map((c) => r6(tri.reduce((acc, vi, k) => acc + w[k] * mesh.vertices[vi][c], 0)));
    const partName = mesh.provenance[tri[0]].part; const part = mesh.parts[partName]; const faceId = mesh.faceIds[fi];
    const base = { face: fi, faceId, layer: part.layer, part: partName, world };
    if (part.layer === 1) { const a = l1Address(mesh, part, partName, tri, w, faceId); return { x, y, pressure, hit: a ? { ...base, ...a } : base }; }
    // a pinned detail: the carrier address of its pin, with the detail named
    const carrier = mesh.parts[part.pin.parent];
    try {
      const { at } = pinToAddress(carrier, part.pin);
      return { x, y, pressure, hit: { ...base, via: partName, part: part.pin.parent, s: r6(at[0]), t: r6(at[1]), side: part.pin.handedness === -1 ? 'L' : 'R' } };
    } catch { return { x, y, pressure, hit: { ...base, via: partName } }; }
  });
  const hits = addresses.filter((a) => a.hit).length;
  const out = { camera: cam.meta, res, addresses, hits, misses: addresses.length - hits };
  if (stroke.mirror) out.mirrored = addresses.map((a) => (a.hit && a.hit.side ? { ...a, hit: { ...a.hit, side: a.hit.side === 'R' ? 'L' : 'R', world: [-a.hit.world[0], a.hit.world[1], a.hit.world[2]] } } : a));
  return out;
}

/** The compact resolve summary a ledger carries. */
export function strokeLedgerEntry(stroke, resolved) {
  const parts = {}; for (const a of resolved.addresses) if (a.hit) parts[a.hit.part] = (parts[a.hit.part] || 0) + 1;
  return { intent: stroke.intent, points: stroke.points.length, hits: resolved.hits, misses: resolved.misses, parts, ...(stroke.mirror ? { mirror: true } : {}), ...(stroke.solved ? { solved: stroke.solved } : {}) };
}
