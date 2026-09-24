/**
 * station-loft-workbench — a compiled layered mesh → a workbench spec (`lofts`), so a `layered` sketch
 * rides the workbench studio, `measure_solid`, and every export leg.
 *
 * Every part becomes ONE straight loft whose stations are its rings:
 * - L1 parts: the axis is the first ring's normal through the back cap point; rings are perpendicular
 *   to it by construction (a hinged part rotated rigidly keeps that), so the profiles reproduce the
 *   compiled points exactly; the caps are pinched end stations (a displaced pinch point is a profile
 *   whose points coincide; loft-faces drops the cap of a zero-area end station).
 * - L2 parts declare `loft: { rings: [[localIds]…], from, to, axis: 'from-to' | 'ring-normal',
 *   pinch: { back?, tip? } }`. `ring-normal` (a base ring + an apex) is exact; `from-to` projects each
 *   ring on its station plane and reports the residual in `loweringError`.
 * - Parts without a `loft` (open patches, creases) have no workbench channel: `omitted`.
 * `seat` (default true) drops the whole solid so its lowest point sits on the grid (z = 0).
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v); if (!(l > 1e-12)) throw new Error('station-loft-workbench: degenerate axis'); return mul(v, 1 / l); };
const mean = (ps) => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
/** loft-faces' straight-axis frame (extrude-faces `perpBasis`): u = z × d, v = d × u. */
export function loftBasis(d) { if (Math.abs(d[2]) > 0.999) return [[1, 0, 0], [0, 1, 0]]; const u = unit(cross([0, 0, 1], d)); return [u, unit(cross(d, u))]; }
const r6 = (x) => Math.round(x * 1e6) / 1e6;

function straightLoft(name, axisFrom, axisTo, rings, { backPinch = null, tipPinch = null, tint } = {}) {
  const d = unit(sub(axisTo, axisFrom)); const L = Math.hypot(...sub(axisTo, axisFrom)); const [u, v] = loftBasis(d);
  const n = rings[0].length; const stations = []; let maxErr = 0;
  const station = (points) => { const c = mean(points); const t = dot(sub(c, axisFrom), d) / L; const origin = add(axisFrom, mul(d, t * L)); const profile = points.map((p) => { const r = sub(p, origin); maxErr = Math.max(maxErr, Math.abs(dot(r, d))); return [r6(dot(r, u)), r6(dot(r, v))]; }); return { t: r6(t), profile }; };
  if (backPinch) { const r = sub(backPinch, axisFrom); stations.push({ t: 0, profile: Array.from({ length: n }, () => [r6(dot(r, u)), r6(dot(r, v))]) }); maxErr = Math.max(maxErr, Math.abs(dot(r, d))); }
  for (const ring of rings) stations.push(station(ring));
  if (tipPinch) { const r = sub(tipPinch, axisTo); stations.push({ t: 1, profile: Array.from({ length: n }, () => [r6(dot(r, u)), r6(dot(r, v))]) }); maxErr = Math.max(maxErr, Math.abs(dot(r, d))); }
  for (let i = 1; i < stations.length; i++) if (!(stations[i].t > stations[i - 1].t)) throw new Error(`station-loft-workbench: ${name} stations not increasing at ${i}`);
  // loft-faces winds its walls and caps from the profile order and expects CCW in (u, v); a ring authored by
  // slot name runs whichever way its axis makes it, so orient every profile by the first ring with area.
  const area = (pr) => pr.reduce((a, p, i) => { const q = pr[(i + 1) % pr.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const first = stations.find((s) => Math.abs(area(s.profile)) > 1e-12);
  if (first && area(first.profile) < 0) for (const s of stations) s.profile.reverse();
  return { loft: { id: name, group: name, path: [axisFrom.map(r6), axisTo.map(r6)], stations, caps: true, tint: tint || '#8a8f96' }, loweringError: maxErr };
}

function l1Loft(name, part) {
  const slots = part.slots; const stations = part.stations.map((s) => s.id);
  const rings = stations.map((st) => slots.map((s) => part.points[`${name}/${st}.${s}`]));
  const back = part.points[`${name}/back`]; const tip = part.points[`${name}/tip`];
  const r0 = rings[0]; const half = slots.length / 2; const normal = unit(cross(sub(r0[Math.floor(half / 2)], r0[0]), sub(r0[half], r0[0])));
  const dir = dot(normal, sub(tip, back)) >= 0 ? normal : mul(normal, -1);
  return straightLoft(name, back, add(back, mul(dir, dot(sub(tip, back), dir))), rings, { backPinch: back, tipPinch: tip, tint: part.tint });
}

function l2Loft(name, part) {
  const spec = part.loft; if (!spec) return null; const P = part.points;
  const rings = spec.rings.map((ids) => ids.map((id) => { if (!P[id]) throw new Error(`station-loft-workbench: ${name}.loft names unknown point ${id}`); return P[id]; }));
  const from = spec.from ? P[spec.from] : mean(rings[0]); const to = spec.to ? P[spec.to] : mean(rings[rings.length - 1]);
  const pinch = { backPinch: spec.pinch?.back ? P[spec.pinch.back] : null, tipPinch: spec.pinch?.tip ? P[spec.pinch.tip] : null, tint: part.tint };
  if (spec.axis === 'ring-normal') {
    const b = rings[0]; let n = unit(cross(sub(b[1], b[0]), sub(b[2], b[0]))); const h = dot(sub(to, from), n); if (h < 0) n = mul(n, -1);
    if (Math.abs(h) < 1e-9) return { omitted: 'zero height' };
    return straightLoft(name, from, add(from, mul(n, Math.abs(h))), rings, pinch);
  }
  if (Math.hypot(...sub(to, from)) < 1e-9) return { omitted: 'zero length' };
  return straightLoft(name, from, to, rings, pinch);
}

/** @returns {{ spec, loweringError: { part: units }, omitted: string[], seatedFrom: number|null }} */
export function lowerLayeredToWorkbench(mesh, { title, seat = true, units = 'm', facing = '+y' } = {}) {
  let minZ = Infinity; for (const part of Object.values(mesh.parts)) for (const p of Object.values(part.points)) if (p[2] < minZ) minZ = p[2];
  const dz = seat && Number.isFinite(minZ) ? -minZ : 0;
  const parts = dz === 0 ? mesh.parts : Object.fromEntries(Object.entries(mesh.parts).map(([n, part]) => [n, { ...part, points: Object.fromEntries(Object.entries(part.points).map(([id, p]) => [id, [p[0], p[1], p[2] + dz]])) }]));
  const lofts = []; const loweringError = {}; const omitted = [];
  for (const [name, part] of Object.entries(parts)) {
    const r = part.layer === 1 ? l1Loft(name, part) : l2Loft(name, part);
    if (!r || r.omitted) { omitted.push(name); continue; }
    lofts.push(r.loft); loweringError[name] = r6(r.loweringError);
  }
  const spec = { units, facing, ...(title ? { title } : {}), lofts, meta: { source: 'layered', dials: mesh.dials, omitted, seatedFrom: dz === 0 ? null : r6(minZ) } };
  return { spec, loweringError, omitted, seatedFrom: dz === 0 ? null : minZ };
}

/** A stored `layered` manifest → the workbench manifest the studio renders (the World, measure, export). */
export function lowerLayeredManifest(manifest, compile) {
  const mesh = compile(manifest.recipe, manifest.dials || {}, manifest.channels || {});
  const { spec } = lowerLayeredToWorkbench(mesh, { title: manifest.title, seat: manifest.seat !== false, units: manifest.units || 'm', facing: manifest.facing || '+y' });
  return { kind: 'workbench', ...spec, ...(manifest.toon != null ? { toon: manifest.toon } : {}), ...(manifest.grid === false ? { grid: false } : {}) };
}
