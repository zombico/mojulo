// statue/base — the base a statue stands on (principles.js law 7), built at read time under the posed figure as studio
// faces: stacks of closed sections, each a square or a round ring at a height, so every solid is closed and the base
// prints with the figure (`export_model { union: true }` merges them). Proportioned to the figure: its height H and the
// footprint it stands on (the feet, or a bust's cut). Pure and deterministic.
import { shadeHex } from '../polygonizer/vexar.js';
import { BASES } from './principles.js';
import * as dmath from '../../util/dmath.js';

const ROUND = 32;
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** a ring of `n` points about (cx, cy) at z: a square (n 4, its sides on the axes, half-widths [hx, hy]) or a circle */
function ring(c, z, n, r) {
  if (n === 4) { const [hx, hy] = r; return [[c[0] + hx, c[1] + hy, z], [c[0] - hx, c[1] + hy, z], [c[0] - hx, c[1] - hy, z], [c[0] + hx, c[1] - hy, z]]; }
  return Array.from({ length: n }, (_, i) => { const t = 2 * Math.PI * i / n; return [c[0] + r * dmath.cos(t), c[1] + r * dmath.sin(t), z]; });
}
/** one closed solid through its sections (bottom → top: { z, r }), `n` sides; triangles wound outward */
function solid(c, sections, n) {
  const rings = sections.map((s) => ring(c, s.z, n, s.r)), tris = [];
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < n; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % n], d = rings[i + 1][k], e = rings[i + 1][(k + 1) % n];
    tris.push([a, b, e], [a, e, d]);
  }
  const bot = rings[0], top = rings.at(-1), cb = [c[0], c[1], sections[0].z], ct = [c[0], c[1], sections.at(-1).z];
  for (let k = 0; k < n; k++) { tris.push([cb, bot[(k + 1) % n], bot[k]]); tris.push([ct, top[k], top[(k + 1) % n]]); }
  return tris;
}
const sq = (hx, hy = hx) => [hx, hy];

/** the base's solids for `kind`, standing at z 0 with its top at `h` → { solids: [{ sections, n }], h } */
function profile(kind, { H, fw, fd }) {
  const B = BASES[kind], h = B.h * H;
  if (kind === 'block') { const s = Math.max(fw, fd, 0.3 * H) * B.margin / 2;
    return { h, solids: [{ n: 4, sections: [{ z: 0, r: sq(s * 1.06) }, { z: 0.12 * h, r: sq(s * 1.06) }, { z: 0.12 * h, r: sq(s) }, { z: 0.82 * h, r: sq(s) }, { z: 0.86 * h, r: sq(s * 1.05) }, { z: h, r: sq(s * 1.05) }] }] }; }
  if (kind === 'attic') { const s = Math.max(fw, fd, 0.3 * H) * B.margin / 2, p = 0.3 * h, R = s * 0.94;
    return { h, solids: [{ n: 4, sections: [{ z: 0, r: sq(s) }, { z: p, r: sq(s) }] },
      { n: ROUND, sections: [{ z: p, r: R }, { z: p + 0.1 * h, r: R * 1.0 }, { z: p + 0.2 * h, r: R * 0.97 }, { z: p + 0.26 * h, r: R * 0.88 }, { z: p + 0.36 * h, r: R * 0.84 },
        { z: p + 0.44 * h, r: R * 0.9 }, { z: p + 0.52 * h, r: R * 0.9 }, { z: p + 0.6 * h, r: R * 0.86 }, { z: h, r: R * 0.86 }] }] }; }
  if (kind === 'drum') { const R = Math.max(fw, fd, 0.3 * H) * B.margin / 2;
    return { h, solids: [{ n: ROUND, sections: [{ z: 0, r: R * 1.06 }, { z: 0.1 * h, r: R * 1.06 }, { z: 0.14 * h, r: R }, { z: 0.88 * h, r: R }, { z: 0.92 * h, r: R * 1.05 }, { z: h, r: R * 1.05 }] }] }; }
  if (kind === 'socle') { const R = Math.min(fw, fd) * B.margin / 2;
    return { h, solids: [{ n: ROUND, sections: [{ z: 0, r: R * 1.5 }, { z: 0.12 * h, r: R * 1.5 }, { z: 0.22 * h, r: R * 1.2 }, { z: 0.4 * h, r: R * 0.62 }, { z: 0.6 * h, r: R * 0.55 },
      { z: 0.8 * h, r: R * 0.8 }, { z: 0.9 * h, r: R }, { z: h, r: R }] }] }; }
  if (kind === 'herm') { const t = Math.min(fw, fd) * B.margin / 2, foot = 0.08 * h;
    return { h, solids: [{ n: 4, sections: [{ z: 0, r: sq(t * 1.25, t * 1.1) }, { z: foot, r: sq(t * 1.25, t * 1.1) }] },
      { n: 4, sections: [{ z: foot, r: sq(t * 0.78, t * 0.7) }, { z: 0.97 * h, r: sq(t, t * 0.9) }, { z: h, r: sq(t * 1.06, t * 0.96) }] }] }; }
  return { h: 0, solids: [] };
}

/** The footprint a figure's faces stand on: the bounds of its corners within `band` of its lowest point (the feet, or a
 * bust's cut), its overall height, its lowest z and its centre there */
export function standingOn(faces, band = 0.03) {
  let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { if (c[2] < lo) lo = c[2]; if (c[2] > hi) hi = c[2]; }
  const b = [Infinity, -Infinity, Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) if (c[2] <= lo + band) { b[0] = Math.min(b[0], c[0]); b[1] = Math.max(b[1], c[0]); b[2] = Math.min(b[2], c[1]); b[3] = Math.max(b[3], c[1]); }
  return { H: hi - lo, lo, fw: b[1] - b[0], fd: b[3] - b[2], c: [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2] };
}

/**
 * The base under a figure's faces: `kind` (principles.js BASES), its stone `tone`, the `surface` its faces carry
 * (tagged by `tag`, polygonizer/materials.js's), lit by `light`. The base stands on the floor (z 0) and the figure is
 * LIFTED onto it, its lowest point on the base's top (a posed figure may dip below its rest floor): the caller shifts
 * the figure's faces (and anything seated with them) up by `lift`. → { faces, lift } ('none' ⇒ no faces, lift 0)
 */
export function statueBaseFaces(figure, { kind, tone, light, group = 'base', tag = null }) {
  if (!kind || kind === 'none' || !figure.length) return { faces: [], lift: 0 };
  const at = standingOn(figure), { h, solids } = profile(kind, at);
  const faces = [];
  for (const s of solids) for (const t of solid(at.c, s.sections, s.n)) {
    const corners = t.map((p) => p.map(r6)), n = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])), l = dmath.hypot(n[0], n[1], n[2]);
    if (!(l > 1e-14)) continue;   // a section stacked on one of the same size makes no side
    const outNormal = [n[0] / l, n[1] / l, n[2] / l];
    faces.push({ corners, fill: shadeHex(tone, outNormal, light), group, outNormal });
  }
  if (tag) tag(faces);
  return { faces, lift: r6(h - at.lo) };
}
