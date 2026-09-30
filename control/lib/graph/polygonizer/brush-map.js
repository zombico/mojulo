/**
 * brush-map — a BRUSH stroke becomes a skin map on the layered recipe: a `brush` dial.
 *
 * The stroke's resolved addresses (stroke-resolve.js) along one layer-1 carrier become the entries of a
 * `brush` dial (station-loft.js): each `{ at: [s, t], side, r, w }` pushes the skin within `r` of the address
 * along the surface normal with a falloff, `w` from the point's pressure, `r` from the pressure and the
 * declared brush size. The dial is stored at 1 with `rest: 1` and a range of [−2, 2], so the person can dial
 * the push down, off, or inward by name, and it replays on every re-lowering: change the form under it and
 * the brushwork follows, since addresses are dial-invariant. `mirror` adds the twin entries by side. The dial
 * carries `from: <stroke id>` so a re-solve replaces exactly what this stroke made.
 *
 * Pure, deterministic. Sizes in the recipe's units: `amp` (the push at pressure 1) defaults to 2 % of the
 * carrier's height, `radius` (the brush at pressure 1) to the larger of 6 % and 1.5 × the carrier's grain.
 */
import { contourRun } from './contour-strip.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
export const BRUSH_PREFIX = 'stroke.';

function carrierHeight(part) { let lo = Infinity, hi = -Infinity; for (const p of Object.values(part.points)) { if (p[2] < lo) lo = p[2]; if (p[2] > hi) hi = p[2]; } return Math.max(1e-3, hi - lo); }
/** the carrier's grain: its median edge length, so a default brush always reaches a vertex on a coarse carrier */
export function carrierGrain(part) {
  const L = []; for (const tri of Object.values(part.faces || {})) for (let i = 0; i < 3; i++) { const a = part.points[tri[i]], b = part.points[tri[(i + 1) % 3]]; if (a && b) L.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
  if (!L.length) return 0; L.sort((x, y) => x - y); return L[Math.floor(L.length / 2)];
}

/**
 * brushDial(mesh, stroke, resolved, { amp?, radius?, direction? }) → { name, dial, value, carrier, side, entries }
 * `direction` 1 pushes out along the normal (default), −1 pushes in.
 */
export function brushDial(mesh, stroke, resolved, { amp = null, radius = null, direction = 1 } = {}) {
  const { carrier, side, run } = contourRun(resolved, stroke.id);
  const part = mesh.parts[carrier]; if (!part || part.layer !== 1) throw new Error(`brush-map: ${carrier} is not a layer-1 carrier`);
  // the default brush is the larger of 6 % of the carrier's height and 1.5 × its grain (median edge), so it always
  // holds a vertex even on a coarse carrier; an explicit `radius` is taken as asked (the readout says if it moved nothing)
  const H = carrierHeight(part); const A = Number.isFinite(amp) && amp > 0 ? amp : H * 0.02; const R = Number.isFinite(radius) && radius > 0 ? radius : Math.max(H * 0.06, carrierGrain(part) * 1.5);
  const sides = stroke.mirror ? [side, side === 'R' ? 'L' : 'R'] : [side];
  const entries = [];
  for (const sd of sides) for (const p of run) entries.push({ at: p.at.map(r6), side: sd, r: r6(R * (0.5 + 0.5 * p.pressure)), w: r6(p.pressure) });
  const name = `${BRUSH_PREFIX}${stroke.id}`;
  const dial = { min: -2, max: 2, rest: 1, op: 'brush', parts: [carrier], entries, amp: r6(A * (direction < 0 ? -1 : 1)), from: stroke.id, doc: `a brush drawn on ${carrier} (stroke ${stroke.id}): 1 as drawn, 0 off, −1 inward` };
  return { name, dial, value: 1, carrier, side, entries: entries.length, amp: r6(A), radius: r6(R) };
}

/** every dial a stroke made (by `from`), so a re-solve replaces them */
export function dialsFrom(recipe, strokeId) { return Object.keys(recipe.dials || {}).filter((n) => recipe.dials[n]?.from === strokeId); }
