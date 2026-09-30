// vegetation/wood — wood is a field: the formation time t(p).
//
// The cambium lays one sheath of wood over the whole woody body each year, so the plant at age A is the level set
// t = A of one scalar field, and the annual rings are its other level sets. For a skeleton whose every internode keeps
// its ring history area[y] (grow.js, the pipe model), the field is exact and cheap:
//     t_e(p) = the first (fractional) year y at which internode e's radius r_e(y) reaches dist(p, axis_e)
//     t(p)   = min over internodes e of t_e(p)
// Knots come free: a branch's internodes are elements too, so where a branch base was engulfed by later trunk rings,
// the branch's own (older) formation times win the min — a cone of branch wood pointing to the trunk's pith.
// A dead (shed) branch stops growing in the year it died; the trunk rings that engulf it afterwards leave its stub as
// an encased (loose) knot.
// Colour is a function of t and the fractional ring position (earlywood → latewood), plus heartwood by age. A plank is
// a box with a few faces whose colour is sampled from the field per pixel: grain has no memory.
import * as dmath from '../../util/dmath.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = dmath.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Build the field from a grown plant. Uses every node that ever lived (dead ones keep their wood as knots). */
export function woodField(plant, { maxOrder = 3, minRadius = 0.004, wobble = 0.025, bark = 0.06 } = {}) {
  const { nodes } = plant; const Y = plant.params.years;
  const hist = (n) => { const R = new Float64Array(Y + 1); for (let y = 1; y <= Y; y++) R[y] = y < n.born ? 0 : Math.sqrt(n.area[y - 1] / Math.PI); return R; };
  const els = [];
  for (const n of nodes) {
    if (n.parent < 0 || n.order > maxOrder) continue;
    const rEnd = Math.sqrt(n.area[n.area.length - 1] / Math.PI); if (rEnd < minRadius) continue;
    const par = nodes[n.parent]; const a = par.pos, b = n.pos; const ab = sub(b, a); const L2 = dot(ab, ab); if (L2 < 1e-12) continue;
    // the internode is a truncated cone between its parent's ring history and its own (a branch's first internode
    // starts at its own size, not the trunk's) — nested cones, not a staircase of cylinders
    const Rb = hist(n); const sameAxis = par.axis === n.axis && par.parent >= 0;
    const Ra = sameAxis ? hist(par).map((r, y) => (y < n.born ? 0 : r)) : Rb;
    const rA = Ra[Y], rB = Rb[Y]; const rMax = Math.max(rA, rB) * (1 + bark + wobble) + 0.004;
    const ax = unit(ab); const ref = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; const e1 = unit(cross(ref, ax)); const e2 = cross(ax, e1);
    els.push({ a, ab, L2, Ra, Rb, born: n.born, died: n.died || Infinity, rMax, order: n.order, e1, e2, seed: n.id,
      lo: [Math.min(a[0], b[0]) - rMax, Math.min(a[1], b[1]) - rMax, Math.min(a[2], b[2]) - rMax],
      hi: [Math.max(a[0], b[0]) + rMax, Math.max(a[1], b[1]) + rMax, Math.max(a[2], b[2]) + rMax] });
  }
  const cs = 0.25; const hash = new Map(); const K = (i, j, k) => `${i},${j},${k}`;
  els.forEach((e, idx) => {
    for (let i = Math.floor(e.lo[0] / cs); i <= Math.floor(e.hi[0] / cs); i++) for (let j = Math.floor(e.lo[1] / cs); j <= Math.floor(e.hi[1] / cs); j++) for (let k = Math.floor(e.lo[2] / cs); k <= Math.floor(e.hi[2] / cs); k++) {
      const key = K(i, j, k); if (!hash.has(key)) hash.set(key, []); hash.get(key).push(idx);
    }
  });
  // ring wobble: each year's sheath is a little out of round, differently each year (deterministic in year and angle)
  const wob = (y, th) => 1 + wobble * (dmath.sin(3 * th + 0.23 * y) * 0.6 + dmath.sin(5 * th - 0.31 * y + 0.4) * 0.4);   // drifts slowly: sheaths nest
  /** t(p): fractional formation year (Infinity outside), the element that set it; `bark` true in the bark sheath. */
  function t(p) {
    const list = hash.get(K(Math.floor(p[0] / cs), Math.floor(p[1] / cs), Math.floor(p[2] / cs))); if (!list) return { t: Infinity, e: null, rho: 0 };
    let best = Infinity, be = null, brho = 0, inBark = false;
    for (const idx of list) {
      const e = els[idx]; const ap = sub(p, e.a); let s = dot(ap, e.ab) / e.L2; if (s < -0.02 || s > 1.02) continue; s = Math.max(0, Math.min(1, s));
      const q = [p[0] - e.a[0] - e.ab[0] * s, p[1] - e.a[1] - e.ab[1] * s, p[2] - e.a[2] - e.ab[2] * s]; const rho = dmath.hypot(q[0], q[1], q[2]);
      if (rho > e.rMax) continue;
      const th = dmath.atan2(dot(q, e.e2), dot(q, e.e1));
      const R = (y) => ((1 - s) * e.Ra[y] + s * e.Rb[y]) * wob(y, th);
      let y = e.born; while (y <= Y && R(y) < rho) y++;
      if (y > Y) { const RY = R(Y); if (rho < RY * (1 + bark) + 0.003 && 0 < best) { if (!be || best === Infinity) { inBark = true; be = e; brho = rho; } } continue; }
      const r0 = y > e.born ? R(y - 1) : 0; const f = R(y) > r0 ? (rho - r0) / (R(y) - r0) : 1;
      const tt = y - 1 + Math.max(0, Math.min(1, f));
      if (tt < best) { best = tt; be = e; brho = rho; inBark = false; }
    }
    return { t: best, e: be, rho: brho, bark: best === Infinity && inBark };
  }
  return { t, els, years: Y };
}

// ── colour: rings, heartwood, bark, knots ─────────────────────────────────────────────────────────────────────
export const WOODS = {
  oak: { early: [196, 160, 112], late: [150, 110, 70], heart: [128, 92, 58], sapYears: 12, bark: [96, 86, 76], ray: 0.08 },
  pine: { early: [226, 196, 146], late: [176, 118, 64], heart: [196, 142, 84], sapYears: 25, bark: [118, 76, 56], ray: 0.0 },
  ash: { early: [226, 208, 176], late: [176, 150, 112], heart: [200, 176, 140], sapYears: 30, bark: [110, 106, 98], ray: 0.03 },
};
/**
 * Wood colour at formation time `tt` for an element that finished at year Y. Earlywood → latewood inside each ring
 * (a sharp latewood band for conifers, a pore line for ring-porous oak), heartwood where the ring is older than
 * `sapYears` from the bark. `footprint` (world units per pixel) against the local ring width fades the rings to their
 * mean colour: past a pixel the figure is one constant, exactly like the rock grain.
 */
export function woodColor(tt, Y, wood, { footprint = 0, ringWidth = 0.004 } = {}) {
  const f = tt - Math.floor(tt); const age = Y - tt;
  const late = f < 0.62 ? dmath.pow(f / 0.62, 3) * 0.35 : 0.35 + 0.65 * Math.min(1, (f - 0.62) / 0.25);
  let c = wood.early.map((x, i) => x + (wood.late[i] - x) * late);
  const mean = wood.early.map((x, i) => x + (wood.late[i] - x) * 0.42);
  const fade = Math.max(0, Math.min(1, (footprint / ringWidth - 0.35) / 1.2));
  c = c.map((x, i) => x + (mean[i] - x) * fade);
  if (age > wood.sapYears) { const h = Math.min(1, (age - wood.sapYears) / 3); c = c.map((x, i) => x + (wood.heart[i] - x) * h * 0.7); }
  return c;
}
