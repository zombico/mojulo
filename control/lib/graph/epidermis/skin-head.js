/**
 * SKIN ON THE HEAD — the epidermis cube's skin relief (skin-relief.js) laid on a relational head as a SHADING layer: a
 * normal perturbed per point, never geometry, shown by the zoom (`SKIN_ZOOM`). From a close-up the keratin lines and
 * pores show, the finest net and grain only in a macro shot; past its range a layer is held back (not aliased), so a
 * whole-head or portrait view is untouched. It lays no creases: no crow's feet, no wrinkles.
 *
 *   the chart     millimetres on the head: around its vertical axis (u, the arc at the face's radius) and up it (v).
 *                 Good on the face and the sides; it stretches under the chin and over the crown.
 *   the regions   from the relations: the nose along its dorsum, the eyelids about the eyes, the forehead above the
 *                 brow, the chin about pogonion, the cheek elsewhere; blended where they meet, the tension's
 *                 direction mirrored left to right.
 *
 *   skinOnHead(head, skin) → { shade(p, n, mmPerPixel) → { normal, cavity }, normal(…), height(p, mmPerPixel), chart(p),
 *                              regions(p), tethers }
 *
 * `head` is `relationalHead`'s; `skin` the cube's (`readEpidermis(…).skin`); points in the head's units (STAND).
 */
import { skinRelief, skinZoomWeights, SKIN_REGIONS } from './skin-relief.js';

const MM_V = 230;   // millimetres in a head height (V)

export function skinOnHead(head, skin) {
  const R = head.relational;
  if (!R) throw new Error('skin: lays on a relational head (head-relational.js)');
  const sc = R.V, P = R.points;
  // THE CHART: around the head's vertical axis, through the middle of glabella and opisthocranion
  const cy = (P.g.y + P.op.y) / 2, r0 = (P.g.y - cy) * MM_V;
  const chartV = (q) => { const phi = Math.atan2(q.x, q.y - cy); return { u: phi * r0, v: q.z * MM_V, phi }; };
  const chart = (p) => chartV({ x: p.x / sc, y: p.y / sc, z: p.z / sc });
  // (no creases: the head carries no crow's feet or wrinkles — the operator found them incongruous with its design;
  // the creases tier stays in skin-relief.js for the swatch study)
  const tethers = [];

  // THE REGIONS: each one's share at a point (V), from the relations
  const seg = (q, a, b) => {
    const bx = b.x - a.x, by = b.y - a.y, bz = b.z - a.z, l2 = bx * bx + by * by + bz * bz || 1e-12;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * bx + (q.y - a.y) * by + (q.z - a.z) * bz) / l2));
    return Math.hypot(q.x - a.x - bx * t, q.y - a.y - by * t, q.z - a.z - bz * t);
  };
  const g = (d, s) => Math.exp(-((d / s) ** 2));
  const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const regionsV = (q) => {
    const w = {
      nose: g(seg(q, P.n, P.prn), 0.05),
      eyelid: Math.max(g(Math.hypot(q.x - P.eyeL.x, q.y - P.eyeL.y, q.z - P.eyeL.z), 0.045), g(Math.hypot(q.x - P.eyeR.x, q.y - P.eyeR.y, q.z - P.eyeR.z), 0.045)),
      forehead: 1.2 * smooth((q.z - P.g.z - 0.02) / 0.06),
      chin: g(Math.hypot(q.x - P.pg.x, q.y - P.pg.y, q.z - P.pg.z), 0.075),
      cheek: 0.35,
    };
    const top = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 2), sum = top[0][1] + top[1][1];
    return top.map(([name, v]) => ({ name, w: v / sum })).filter((r) => r.w > 0.02);
  };
  const regions = (p) => regionsV({ x: p.x / sc, y: p.y / sc, z: p.z / sc });

  // the reliefs: one per region and side (the tension mirrored on the left), all the tethers on each
  const reliefs = {};
  const reliefOf = (name, side) => (reliefs[name + side] ??= skinRelief({
    region: name, fidelity: skin.fidelity, age: skin.age, pores: skin.pores, creases: skin.creases, seed: skin.seed,
    angle: side === 'L' ? -2 * SKIN_REGIONS[name].angle : 0, tethers,
  }));

  // the height (mm) at a point, at a zoom: the regions blended; a crease wider than its true width when the pixels
  // are coarser than it, so it reads as the soft line it is from afar (its depth eased to keep its shadow's weight)
  const sample = (p, mmPerPixel, at = chart(p)) => {
    const w = { ...skinZoomWeights(mmPerPixel), footprint: mmPerPixel };
    if (!(w.creases > 0 || w.keratin > 0 || w.micro > 0)) return { h: 0, cavity: 0 };
    const side = p.x < 0 ? 'L' : 'R';
    let h = 0, cavity = 0;
    for (const r of regions(p)) { const s = reliefOf(r.name, side).at(at.u, at.v, w); h += r.w * s.h; cavity += r.w * s.cavity; }
    return { h, cavity };
  };
  const heightAt = (p, mmPerPixel, at) => sample(p, mmPerPixel, at).h;
  // the shading: the normal perturbed by the height's slope along the chart (the surface does not move), and the
  // cavity (0 … 0.7) to darken by, the grooves' and pores' shadow, which is what carries a wrinkle from afar
  const shade = (p, n, mmPerPixel) => {
    const w = skinZoomWeights(mmPerPixel);
    if (!(w.creases > 0 || w.keratin > 0 || w.micro > 0)) return { normal: n, cavity: 0 };
    const c = chart(p), d = Math.max(0.02, 0.5 * mmPerPixel);
    const s0 = sample(p, mmPerPixel, c), hu = (heightAt(p, mmPerPixel, { ...c, u: c.u + d }) - s0.h) / d, hv = (heightAt(p, mmPerPixel, { ...c, v: c.v + d }) - s0.h) / d;
    const Tu = [Math.cos(c.phi), -Math.sin(c.phi), 0], Tv = [0, 0, 1];
    const tu = Tu[0] * n[0] + Tu[1] * n[1], tv = n[2];
    const m = [0, 1, 2].map((i) => n[i] - hu * (Tu[i] - n[i] * tu) - hv * (Tv[i] - n[i] * tv)), l = Math.hypot(...m) || 1;
    return { normal: m.map((x) => x / l), cavity: s0.cavity };
  };
  const normal = (p, n, mmPerPixel) => shade(p, n, mmPerPixel).normal;
  return { shade, normal, height: heightAt, chart, regions, tethers };
}
