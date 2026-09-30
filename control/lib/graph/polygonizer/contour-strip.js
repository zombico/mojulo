/**
 * contour-strip — a CONTOUR stroke becomes a surface strip on the layered recipe.
 *
 * The stroke's resolved addresses (stroke-resolve.js) run along one layer-1 carrier; a SURFACE STRIP
 * (station-loft-detail.js `strip`: stations are (s, t) addresses, cross-sections in each station's own
 * surface frame) is lofted along them with a ridge profile whose height follows the stroke's pressure, and
 * stored the way `bakeLayered` stores a detail: a layer-2 closed part pinned at the run's middle address with
 * its geometry as local offsets in that pin's frame, `follow: true` so it rides the carrier under every dial.
 * `mirror` adds the twin by name on the other side. The parts carry `from: <stroke id>` so a re-solve
 * replaces exactly what this stroke made.
 *
 * Pure, deterministic. Sizes are in the recipe's units: `height` defaults to 1.5 % of the carrier's height,
 * `width` to 1.6 × height.
 */
import { pinFrame } from './station-loft.js';
import { strip, address } from './station-loft-detail.js';
import { surfaceLocalOffset } from './surface-pin.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
export const STRIP_PREFIX = 'stroke.';

/** the carrier and the ordered, de-duplicated (s, t) run of a resolved contour; refuses by name when nothing is under it */
export function contourRun(resolved, strokeId) {
  const hits = resolved.addresses.filter((a) => a.hit && a.hit.part && Number.isFinite(a.hit.s) && Number.isFinite(a.hit.t));
  if (!hits.length) throw new Error(`no-surface-under-stroke: stroke '${strokeId}' touches no part of the solid in its view`);
  const count = {}; for (const a of hits) count[a.hit.part] = (count[a.hit.part] || 0) + 1;
  const carrier = Object.entries(count).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0][0];
  const sides = {}; for (const a of hits) if (a.hit.part === carrier) sides[a.hit.side] = (sides[a.hit.side] || 0) + 1;
  const side = (sides.L || 0) > (sides.R || 0) ? 'L' : 'R';
  const run = []; let last = null;
  for (const a of hits) {
    if (a.hit.part !== carrier) continue;
    const at = [a.hit.s, a.hit.t]; if (last && Math.hypot(at[0] - last[0], at[1] - last[1]) < 1e-3) continue;
    run.push({ at, pressure: a.pressure ?? 0.5 }); last = at;
  }
  if (run.length < 2) throw new Error(`no-surface-under-stroke: stroke '${strokeId}' has fewer than two distinct points on ${carrier}`);
  return { carrier, side, run, dropped: hits.length - run.length };
}

/** carrier height in recipe units, for the default sizes */
function carrierHeight(part) { let lo = Infinity, hi = -Infinity; for (const p of Object.values(part.points)) { if (p[2] < lo) lo = p[2]; if (p[2] > hi) hi = p[2]; } return Math.max(1e-3, hi - lo); }

/**
 * contourStripParts(mesh, stroke, resolved, { height?, width?, group? }) → { parts, carrier, side, run, names }
 * `mesh` is the compiled mesh the stroke resolved against (its layer-1 parts carry the faces the pin names).
 */
export function contourStripParts(mesh, stroke, resolved, { height = null, width = null, group = null } = {}) {
  const { carrier, side, run } = contourRun(resolved, stroke.id);
  const L1 = mesh.parts; const part = L1[carrier]; if (!part || part.layer !== 1) throw new Error(`contour-strip: ${carrier} is not a layer-1 carrier`);
  const H = Number.isFinite(height) && height > 0 ? height : carrierHeight(part) * 0.015; const W = Number.isFinite(width) && width > 0 ? width : H * 1.6;
  const m = run.length; const addrs = run.map((r) => r.at);
  // the strip takes the colour group of the carrier face under the run's middle unless asked otherwise, so it reads
  // as a ridge of the same skin (a carrier may colour by band, not by one part group)
  if (!group) { const midPin = address(L1, carrier, addrs[Math.floor(m / 2)][0], addrs[Math.floor(m / 2)][1], side); group = part.groups?.[midPin.face] || part.group || 'Strokes'; }
  // a ridge: the profile rises with the point's pressure, tapers to nothing at the two ends
  const profile = (j) => { const tp = Math.sin(Math.PI * (j + 0.5) / m); const h = Math.max(0.0005, H * (0.35 + 0.65 * run[j].pressure) * tp), w = W * tp; return [[-w, -0.002 * H / 0.006], [0, h], [w, -0.002 * H / 0.006], [0, -0.004 * H / 0.006]]; };
  const parts = {}; const names = [];
  for (const sd of stroke.mirror ? [side, side === 'R' ? 'L' : 'R'] : [side]) {
    const built = strip(L1, carrier, addrs, sd, profile);
    const mid = addrs[Math.floor(m / 2)]; const pin = address(L1, carrier, mid[0], mid[1], sd); const frame = pinFrame(part, pin);
    const offsets = Object.fromEntries(Object.entries(built.points).map(([k, p]) => [k, surfaceLocalOffset(frame, p).map(r6)]));
    const faces = {}, groups = {}; built.faces.forEach((t, i) => { const id = `f${String(i).padStart(3, '0')}`; faces[id] = t; groups[id] = group; });
    const name = `${STRIP_PREFIX}${stroke.id}${sd}`; names.push(name);
    // the carrier's tint too: a recipe without a palette colours by part tint (station-loft-faces.js)
    parts[name] = { layer: 2, closure: 'closed', group, ...(part.tint ? { tint: part.tint } : {}), from: stroke.id, follow: true, pin, offsets, faces, groups };
  }
  return { parts, carrier, side, run: addrs, names, height: r6(H), width: r6(W) };
}

/** every part a stroke made (by `from`), so a re-solve replaces them */
export function partsFrom(recipe, strokeId) { return Object.keys(recipe.parts || {}).filter((n) => recipe.parts[n]?.from === strokeId); }
