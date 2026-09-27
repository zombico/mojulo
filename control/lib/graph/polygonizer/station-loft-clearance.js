/**
 * station-loft-clearance — the CLEARANCE ledger of a layered recipe: does an adornment stay OUTSIDE the body it is
 * worn over when the live dials move that body? For every layer-3 part (an adornment, its signature, its links),
 * the share of its points inside any layer-1 part, at rest and at each dial's min and max; the worst configuration is
 * named. The head SEAM rule turned outward: that one asks a neck to stay buried at every head dial's extreme, this asks
 * worn things to stay clear at every body dial's extreme. Closure is per part and cannot see this; parts can each be
 * closed and pass through each other.
 *
 * Advisory: it measures and names, it never refuses (docs/bicycles.md). Pure, deterministic. Grouped by adornment
 * (`adorn.<id>` and its `.sig*` / `.link*` parts). A ray-parity test per point per L1 part, bounding boxes first.
 */
import { compileLayered } from './station-loft.js';

const d = [0.8726, 0.3313, 0.3589];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** a compiled part's triangles as coordinates with its bounding box, for repeated inside tests */
function solid(P) { const tris = Object.values(P.faces).map((f) => f.map((k) => P.points[k])); const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } return { tris, lo, hi }; }
function inside(S, q) { for (let i = 0; i < 3; i++) if (q[i] < S.lo[i] || q[i] > S.hi[i]) return false; let c = 0;
  for (const [A, B, C] of S.tris) { const e1 = sub(B, A), e2 = sub(C, A); const p = cross(d, e2); const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]; if (Math.abs(det) < 1e-14) continue;
    const tv = sub(q, A); const u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / det; if (u < 0 || u > 1) continue; const qq = cross(tv, e1); const v = (d[0] * qq[0] + d[1] * qq[1] + d[2] * qq[2]) / det; if (v < 0 || u + v > 1) continue;
    if ((e2[0] * qq[0] + e2[1] * qq[1] + e2[2] * qq[2]) / det > 0) c++; }
  return c % 2 === 1; }
const r3 = (x) => Math.round(x * 1000) / 1000;
/** the adornment a layer-3 part belongs to: `adorn.belt.sig0` → `belt`; any other layer-3 name is its own */
const adornmentOf = (name) => (name.startsWith('adorn.') ? name.split('.')[1] : name);

/** Clearance of every layer-3 part at rest and at each dial extreme. Returns `{ configs, adornments: { <id>: { points,
 * worst: { dial, value, inside, share, into: [the parts it sinks into, most first] }, rest } }, sinking: [ids whose
 * worst share > tolerance] }`. */
export function layeredClearance(recipe, { tolerance = 0.02 } = {}) {
  const configs = [{ dial: null, value: null, dials: {} }];
  for (const [k, op] of Object.entries(recipe.dials || {})) for (const v of [op.min, op.max]) if (Number.isFinite(v)) configs.push({ dial: k, value: v, dials: { [k]: v } });
  const out = {};
  for (const cfg of configs) {
    const m = compileLayered(recipe, cfg.dials);
    const bodies = Object.entries(m.parts).filter(([, p]) => (p.layer ?? 1) === 1).map(([n, p]) => ({ n, S: solid(p) }));
    const counts = {};
    for (const [name, P] of Object.entries(m.parts)) { if ((P.layer ?? 1) < 3) continue; const id = adornmentOf(name); const c = (counts[id] ??= { points: 0, inside: 0, into: {} });
      for (const q of Object.values(P.points)) { c.points++; const hit = bodies.find((b) => inside(b.S, q)); if (hit) { c.inside++; c.into[hit.n] = (c.into[hit.n] || 0) + 1; } } }
    for (const [id, c] of Object.entries(counts)) { const share = c.points ? r3(c.inside / c.points) : 0; const A = (out[id] ??= { points: c.points, rest: null, worst: null });
      if (cfg.dial === null) A.rest = { inside: c.inside, share };
      if (!A.worst || share > A.worst.share) A.worst = { dial: cfg.dial, value: cfg.value, inside: c.inside, share, into: Object.keys(c.into).sort((a, b) => c.into[b] - c.into[a] || (a < b ? -1 : 1)) }; }
  }
  return { configs: configs.length, adornments: out, sinking: Object.keys(out).filter((id) => out[id].worst.share > tolerance) };
}
