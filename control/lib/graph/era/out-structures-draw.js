/**
 * The structures drawer: buildings, doodads and ground drawn as faces in one of four views (axonometric, lane face,
 * side, plan), in values as built, or painted by the style guide's paint (era/out-structures-paint.js), mass by mass so walls carry their openings and roofs
 * their courses. Shared by the structures sheet (out-structures-html.js) and the town map (out-town-html.js). Pure.
 */
import { hexOfRgb } from './style/swatches.js';
import { paintIndex } from './out-structures-paint.js';
import { poleOf, materialOf, platePattern } from './style/pole.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const SUN = (() => { const s = [-0.45, -0.6, 0.66], l = Math.hypot(...s); return s.map((x) => x / l); })();
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// the parts mounted on a wall: each is drawn straight after the wall it is on
const DECAL = new Set(['opening', 'trim', 'shutter', 'door', 'accent', 'frame', 'socle', 'sign', 'course', 'motif', 'lens', 'sill', 'lintel', 'quoin', 'bond', 'cornice']);
const ROOFISH = new Set(['roof', 'edge', 'chimney', 'cap', 'spike']);

// ── views ───────────────────────────────────────────────────────────────────────────────────────────────────────────
// u across the drawing, v up it, depth away from the eye; a face is drawn if it turns toward the eye
const AZ = (35 * Math.PI) / 180, EL = (30 * Math.PI) / 180;
const AXON = (() => { const F = [-Math.sin(AZ) * Math.cos(EL), Math.cos(AZ) * Math.cos(EL), -Math.sin(EL)], R = [Math.cos(AZ), Math.sin(AZ), 0]; const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]]; return { R, U, F }; })();
export const VIEWS = {
  front: { uv: (p) => [p[0], p[2]], depth: (p) => p[1], F: [0, 1, 0] },
  side: { uv: (p) => [p[1], p[2]], depth: (p) => -p[0], F: [-1, 0, 0] },
  plan: { uv: (p) => [p[0], p[1]], depth: (p) => -p[2], F: [0, 0, -1] },
  axon: { uv: (p) => [dot(p, AXON.R), dot(p, AXON.U)], depth: (p) => dot(p, AXON.F), F: AXON.F },
};

// ground takes the kit's land ramps; a kit drawn from textures has none, and takes its stone
/** A face's fill: the light first (a stop up where it faces the sun, down where it turns away), then the paint picks
 *  the colour off the face's group's ramp. Without a paint the face is drawn in its values: the asset as built. On the
 *  MATERIAL pole (era/style/pole.js) and given `defs` (a Map the drawing puts in its <defs>), the face is its material,
 *  a pixel pattern in the stops round that colour (the paint's `materials` say what a group is made of where its ramp
 *  can't: a machine's finish); a mark, a light or a void stays flat. */
export function fillOf(f, paint, defs = null) {
  const lam = dot(f.normal, SUN), step = lam > 0.5 ? 1 : lam < 0.12 ? -1 : 0;
  if (!paint) { const g = Math.round(Math.max(0.03, Math.min(1, f.value + step * 0.1)) * 255).toString(16).padStart(2, '0'); return `#${g}${g}${g}`; }
  const { stops, i, ramp } = paintIndex(paint, f.group ?? 'str:plaster', f.value, step), m = defs && poleOf(paint.kitId) === 'material' ? (paint.materials && f.group in paint.materials ? paint.materials[f.group] : materialOf(ramp)) : null;
  return m ? platePattern(defs, { stops, i, material: m, seed: ramp, kit: paint.kitId, step }) : hexOfRgb(stops[i]);
}
/** A surface group at a value as a fill (a plan's ground, a route, a court): its paint stop, or on the material pole and
 *  given `defs` its material's pattern round that stop. */
export function paintFill(paint, group, value, defs = null) {
  if (!paint) { const g = Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0'); return `#${g}${g}${g}`; }
  const { stops, i, ramp } = paintIndex(paint, group, value), m = defs && poleOf(paint.kitId) === 'material' ? materialOf(ramp) : null;
  return m ? platePattern(defs, { stops, i, material: m, seed: ramp, kit: paint.kitId }) : hexOfRgb(stops[i]);
}
/** The <defs> of a drawing's material patterns ('' when there are none: a banded drawing is as it was). */
export const defsOf = (defs) => (defs && defs.size ? `<defs>${[...defs.values()].join('')}</defs>` : '');
/** The flat colour under a fill (a pattern's middle stop): what an outline is stroked in. */
const strokeOf = (f, paint) => (paint ? fillOf(f, paint) : '#111');

/**
 * Buildings drawn in one view: `groups` is a list of face lists (one per building); groups are drawn far to near,
 * inside each its masses far to near, then what is mounted on its walls, then what stands before them. `ppm` fixes the
 * scale (pixels a metre) so a row compares sizes; `markTile` hatches the tile's marks; `ground` draws the ground line.
 */
export function drawStructures(groups, { view = 'axon', paint = null, w = 260, h = 220, ppm = null, pad = 10, ground = true, markTile = false, under = '', over = '', at = null, floor = [], defs: shared = null } = {}) {
  const V = VIEWS[view], vis = (f) => dot(f.normal, V.F) < -1e-6;
  const centre = (f) => f.corners.reduce((s, p) => [s[0] + p[0] / f.corners.length, s[1] + p[1] / f.corners.length, s[2] + p[2] / f.corners.length], [0, 0, 0]);
  // a building is drawn mass by mass, far to near; inside a mass its walls far to near, each followed by what is
  // mounted on it (proudest last), then its roof; a mounted part with no wall under it comes after the walls
  const order = (faces) => {
    const masses = new Map();
    for (const f of faces) { const k = f.mass ?? 'main'; if (!masses.has(k)) masses.set(k, []); masses.get(k).push(f); }
    const out = [];
    const mList = [...masses.values()].map((fs) => ({ fs, d: fs.reduce((s, f) => s + V.depth(centre(f)), 0) / fs.length })).sort((a, b) => b.d - a.d);
    for (const { fs } of mList) {
      const shown = fs.filter(vis), base = shown.filter((f) => !DECAL.has(f.part) && !f.tile && !ROOFISH.has(f.part)), mounted = shown.filter((f) => DECAL.has(f.part) || f.tile), roofs = shown.filter((f) => ROOFISH.has(f.part) && !f.tile);
      const plane = (f) => dot(f.normal, f.corners[0]), hosts = new Map([...base, ...roofs].map((f) => [f, []])), loose = [];
      for (const m of mounted) {
        const c = centre(m), host = [...base, ...roofs].find((f) => dot(f.normal, m.normal) > 0.999 && Math.abs(dot(f.normal, c) - plane(f)) < 0.08 && [0, 1, 2].every((k) => c[k] >= Math.min(...f.corners.map((p) => p[k])) - 0.05 && c[k] <= Math.max(...f.corners.map((p) => p[k])) + 0.05));
        (host ? hosts.get(host) : loose).push(m);
      }
      const proud = (m, f) => dot(m.normal, centre(m)) - plane(f);
      for (const f of base.sort((a, b) => V.depth(centre(b)) - V.depth(centre(a)))) { out.push(f); out.push(...hosts.get(f).sort((a, b) => proud(a, f) - proud(b, f))); }
      out.push(...loose.sort((a, b) => V.depth(centre(b)) - V.depth(centre(a))));
      for (const f of roofs.sort((a, b) => V.depth(centre(b)) - V.depth(centre(a)))) { out.push(f); out.push(...hosts.get(f).sort((a, b) => proud(a, f) - proud(b, f))); }
    }
    return out;
  };
  const prepared = groups.map((faces) => {
    const shown = order(faces).map((f) => ({ f, pts: f.corners.map(V.uv) }));
    const depth = faces.length ? faces.reduce((s, f) => s + V.depth(centre(f)), 0) / faces.length : 0;
    return { shown, depth };
  }).sort((a, b) => b.depth - a.depth);
  // the floor (ground under the buildings) is drawn first, whatever its depth
  if (floor.length) prepared.unshift({ shown: floor.filter(vis).map((f) => ({ f, pts: f.corners.map(V.uv) })), depth: Infinity });
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const g of prepared) for (const x of g.shown) for (const [u, v] of x.pts) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  if (!Number.isFinite(u0)) { u0 = 0; u1 = 1; v0 = 0; v1 = 1; }
  const k = ppm ?? Math.min((w - 2 * pad) / Math.max(0.01, u1 - u0), (h - 2 * pad) / Math.max(0.01, v1 - v0));
  // `at` pins the origin (px) so a drawing can share a frame with what is under it
  const ox = at ? at[0] : w / 2 - ((u0 + u1) / 2) * k, oy = at ? at[1] : h - pad - (view === 'plan' ? (h - 2 * pad - (v1 - v0) * k) / 2 : 0) + v0 * k;
  const X = (u) => (ox + u * k).toFixed(1), Y = (v) => (oy - v * k).toFixed(1);
  // (`defs`: a Map the caller's own under/over drew patterns into, so all of them land in the one <defs>)
  const polys = [], defs = shared ?? new Map();
  for (const g of prepared) for (const x of g.shown) {
    // a face may carry its own paint (a household's, by the street's rules); without a paint all is values
    const P = paint ? (x.f.paint ?? paint) : null, fill = fillOf(x.f, P, defs), pts = x.pts.map(([u, v]) => `${X(u)},${Y(v)}`).join(' ');
    polys.push(`<polygon points="${pts}" fill="${fill}" stroke="${strokeOf(x.f, P)}" stroke-width="${paint ? 0.5 : 0.35}" stroke-linejoin="round"${x.f.tile && markTile ? ' stroke-dasharray="2 1.5" opacity="0.85"' : ''}/>`);
  }
  const g = ground && view !== 'plan' && view !== 'axon' ? `<line x1="2" x2="${w - 2}" y1="${Y(0)}" y2="${Y(0)}" stroke="#111" stroke-width="1.2"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defsOf(defs)}${under}${g}${polys.join('')}${over}</svg>`;
}
export const fig = (svg, cap) => `<figure>${svg}<figcaption>${cap}</figcaption></figure>`;
