/**
 * THE COURT KIT — the furniture and the fittings of the concourses under the geocity (geocity/dress.js lays them):
 * rounded where a hand or a hip meets them, each piece a few turned or boxed parts in its own materials.
 *
 *   SETS        the food court's seating, each a table and what sits round it, and its footprint (half extents, m):
 *                 cafe       a round table on a pedestal, four chairs with curved backs turned to it
 *                 bistro     a high round table, three tall round stools
 *                 communal   a long table with rounded ends, a bench down each side
 *                 booth      a table between two upholstered benches with high backs
 *   FITTINGS    what stands in a concourse: `bins` (a waste and a recycling bin, round, side by side), `planter` (a
 *               round steel planter, its shrubs in a dome), `bench` (a backless bench, slatted, on two steel legs),
 *               `directory` (a lit wayfinding totem, its route's colour in a band)
 *   setFaces(type, at, turn, look) → faces     a set at `at` ([x, y, z]), turned `turn` quarter turns
 *   fitFaces(kind, at, turn, look) → faces     a fitting the same way
 *
 * `look`: { seat, wood } (a set's upholstery and its table's top) or { band } (a directory's route colour). Metres, z up.
 * Pure: no dice (dress.js chooses the type and the look).
 */
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const KEY = [0.35, -0.45, 0.82];   // a fixed key the round parts are shaded by, so they read round on an unlit page

export const SETS = Object.freeze({
  cafe: Object.freeze({ half: [1.05, 1.05] }),
  bistro: Object.freeze({ half: [0.85, 0.85] }),
  communal: Object.freeze({ half: [1.45, 1.0] }),
  booth: Object.freeze({ half: [1.1, 1.05] }),
});
export const FITTINGS = Object.freeze({
  bins: Object.freeze({ half: [0.55, 0.3] }),
  planter: Object.freeze({ half: [0.6, 0.6] }),
  bench: Object.freeze({ half: [0.95, 0.3] }),
  directory: Object.freeze({ half: [0.4, 0.2] }),
});
const STEEL = '#9aa0a6', DARK = '#3a3d42', CHROME = '#c4c9ce';

const shade = (hex, g) => `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * g))).toString(16).padStart(2, '0')).join('')}`;
const lam = (n) => 0.72 + 0.32 * Math.max(0, n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]);

/** A builder in a piece's own frame (x right, y forward, z up), turned and placed when it is done. */
function piece(group) {
  const out = [];
  const face = (cs, n, fill, extra = {}) => {
    const e1 = [cs[1][0] - cs[0][0], cs[1][1] - cs[0][1], cs[1][2] - cs[0][2]], e2 = [cs[cs.length - 1][0] - cs[0][0], cs[cs.length - 1][1] - cs[0][1], cs[cs.length - 1][2] - cs[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], c = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0 ? cs.slice().reverse() : cs;
    const f = shade(fill, lam(n));
    out.push({ corners: c, normal: n, group, fill: f, cornerFills: c.map(() => f), ...extra });
  };
  return {
    out,
    /** a turned part: a ring of `sides` round (cx, cy) from z0 to z1, its top (and its underside, `under`) capped; `r1`
     *  its top's radius for a taper */
    cyl(cx, cy, r, z0, z1, fill, { sides = 14, r1 = r, under = false, top = true } = {}) {
      const at = (k, rr, z) => [cx + rr * Math.cos((2 * Math.PI * k) / sides), cy + rr * Math.sin((2 * Math.PI * k) / sides), z];
      for (let k = 0; k < sides; k++) {
        const a = (2 * Math.PI * (k + 0.5)) / sides, n = [Math.cos(a), Math.sin(a), (r - r1) / Math.max(1e-6, z1 - z0)], l = Math.hypot(...n);
        face([at(k, r, z0), at(k + 1, r, z0), at(k + 1, r1, z1), at(k, r1, z1)], n.map((v) => v / l), fill);
      }
      if (top) face(Array.from({ length: sides }, (_, k) => at(k, r1, z1)), [0, 0, 1], fill);
      if (under) face(Array.from({ length: sides }, (_, k) => at(k, r, z0)), [0, 0, -1], fill);
    },
    /** a dome: rings of a sphere's upper half over (cx, cy, z0) */
    dome(cx, cy, z0, r, h, fill, sides = 12, rings = 4) {
      for (let j = 0; j < rings; j++) {
        const t0 = (j / rings) * (Math.PI / 2), t1 = ((j + 1) / rings) * (Math.PI / 2);
        for (let k = 0; k < sides; k++) {
          const p = (t, kk) => [cx + r * Math.cos(t) * Math.cos((2 * Math.PI * kk) / sides), cy + r * Math.cos(t) * Math.sin((2 * Math.PI * kk) / sides), z0 + h * Math.sin(t)];
          const a = (2 * Math.PI * (k + 0.5)) / sides, tm = (t0 + t1) / 2, n = [Math.cos(tm) * Math.cos(a), Math.cos(tm) * Math.sin(a), Math.sin(tm)];
          if (j === rings - 1) face([p(t0, k), p(t0, k + 1), [cx, cy, z0 + h]], n, fill);
          else face([p(t0, k), p(t0, k + 1), p(t1, k + 1), p(t1, k)], n, fill);
        }
      }
    },
    /** a box square to the piece's frame: its top and its four sides (and its underside, `under`) */
    box([x0, y0, z0], [x1, y1, z1], fill, under = false) {
      face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], fill);
      if (under) face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1], fill);
      face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], fill);
      face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], fill);
      face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0], fill);
      face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], fill);
    },
    /** a slab with rounded ends: a box between two half-turned ends (a long table's top, a bench's seat), along x */
    pill(x0, x1, y, w, z0, z1, fill, sides = 8) {
      const r = w / 2;
      this.box([x0 + r, y - r, z0], [x1 - r, y + r, z1], fill, true);
      for (const [cx, from] of [[x0 + r, Math.PI / 2], [x1 - r, -Math.PI / 2]]) {
        const pts = (z) => Array.from({ length: sides + 1 }, (_, k) => { const a = from + (Math.PI * k) / sides; return [cx + r * Math.cos(a), y + r * Math.sin(a), z]; });
        const top = pts(z1), bot = pts(z0);
        face([[cx, y, z1], ...top], [0, 0, 1], fill);
        face([[cx, y, z0], ...bot], [0, 0, -1], fill);
        for (let k = 0; k < sides; k++) { const a = from + (Math.PI * (k + 0.5)) / sides; face([bot[k], bot[k + 1], top[k + 1], top[k]], [Math.cos(a), Math.sin(a), 0], fill); }
      }
    },
    /** a curved back: a band of an arc round (cx, cy), `r` out, from angle a0 to a1, z0 to z1, `t` thick */
    arc(cx, cy, r, a0, a1, z0, z1, t, fill, segs = 6) {
      for (let k = 0; k < segs; k++) {
        const u0 = a0 + ((a1 - a0) * k) / segs, u1 = a0 + ((a1 - a0) * (k + 1)) / segs, um = (u0 + u1) / 2;
        const P = (u, rr, z) => [cx + rr * Math.cos(u), cy + rr * Math.sin(u), z];
        face([P(u0, r, z0), P(u1, r, z0), P(u1, r, z1), P(u0, r, z1)], [-Math.cos(um), -Math.sin(um), 0], fill);
        face([P(u0, r + t, z0), P(u1, r + t, z0), P(u1, r + t, z1), P(u0, r + t, z1)], [Math.cos(um), Math.sin(um), 0], shade(fill, 0.85));
        face([P(u0, r, z1), P(u1, r, z1), P(u1, r + t, z1), P(u0, r + t, z1)], [0, 0, 1], fill);
      }
    },
  };
}

/** A piece turned `turn` quarter turns about its origin and stood at `at`. */
function place(faces, at, turn) {
  const c = [1, 0, -1, 0][((turn % 4) + 4) % 4], s = [0, 1, 0, -1][((turn % 4) + 4) % 4];
  const R = ([x, y, z]) => [c * x - s * y, s * x + c * y, z];
  return faces.map((f) => { const n = R(f.normal); return { ...f, corners: f.corners.map((p) => { const q = R(p); return P3([q[0] + at[0], q[1] + at[1], q[2] + at[2]]); }), normal: P3(n), outNormal: P3(n) }; });
}

/** A chair facing +y (toward its table), its seat round, its back a curved band behind it, on four slim steel legs. */
function chair(B, x, y, toward, look) {
  const a = Math.atan2(toward[1] - y, toward[0] - x), back = a + Math.PI;
  for (const d of [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.15], [-0.15, -0.15]]) B.cyl(x + d[0], y + d[1], 0.018, 0, 0.44, CHROME, { sides: 6 });
  B.cyl(x, y, 0.22, 0.44, 0.48, look.seat, { sides: 14, under: true });
  B.arc(x, y, 0.19, back - 1.0, back + 1.0, 0.62, 0.86, 0.035, look.seat);
  for (const u of [back - 0.75, back + 0.75]) B.cyl(x + 0.2 * Math.cos(u), y + 0.2 * Math.sin(u), 0.015, 0.48, 0.66, CHROME, { sides: 6 });
}

/** A seating set in its own frame (its table at the origin), and its look. */
export function setFaces(type, at, turn, look) {
  const B = piece('geocity:food-court');
  if (type === 'cafe') {
    B.cyl(0, 0, 0.26, 0, 0.03, DARK, { sides: 16 });
    B.cyl(0, 0, 0.045, 0.03, 0.72, DARK, { sides: 8 });
    B.cyl(0, 0, 0.46, 0.72, 0.755, look.wood, { sides: 20, under: true });
    for (const [x, y] of [[0.72, 0], [-0.72, 0], [0, 0.72], [0, -0.72]]) chair(B, x, y, [0, 0], look);
  } else if (type === 'bistro') {
    B.cyl(0, 0, 0.25, 0, 0.03, DARK, { sides: 16 });
    B.cyl(0, 0, 0.04, 0.03, 1.05, CHROME, { sides: 8 });
    B.cyl(0, 0, 0.36, 1.05, 1.085, look.wood, { sides: 18, under: true });
    for (let k = 0; k < 3; k++) {
      const a = (2 * Math.PI * k) / 3 + 0.5, x = 0.62 * Math.cos(a), y = 0.62 * Math.sin(a);
      B.cyl(x, y, 0.17, 0, 0.02, DARK, { sides: 12 });
      B.cyl(x, y, 0.03, 0.02, 0.72, CHROME, { sides: 6 });
      B.cyl(x, y, 0.2, 0.7, 0.72, CHROME, { sides: 12, top: false });
      B.cyl(x, y, 0.19, 0.72, 0.78, look.seat, { sides: 14, under: true });
    }
  } else if (type === 'communal') {
    B.pill(-1.3, 1.3, 0, 0.9, 0.72, 0.76, look.wood);
    for (const x of [-0.95, 0.95]) B.box([x - 0.05, -0.3, 0], [x + 0.05, 0.3, 0.72], DARK);
    for (const y of [-0.78, 0.78]) {
      B.pill(-1.25, 1.25, y, 0.36, 0.42, 0.46, look.wood);
      for (const x of [-0.95, 0.95]) B.box([x - 0.04, y - 0.12, 0], [x + 0.04, y + 0.12, 0.42], DARK);
    }
  } else if (type === 'booth') {
    B.pill(-0.65, 0.65, 0, 0.75, 0.72, 0.76, look.wood);
    B.box([-0.05, -0.05, 0], [0.05, 0.05, 0.72], DARK);
    for (const sg of [-1, 1]) {
      const y0 = sg * 0.55, y1 = sg * 1.0;
      // (a bench upholstered: its seat, its high back, its plinth)
      B.box([-0.9, Math.min(y0, y0 + sg * 0.42), 0], [0.9, Math.max(y0, y0 + sg * 0.42), 0.12], DARK);
      B.box([-0.9, Math.min(y0, y0 + sg * 0.42), 0.12], [0.9, Math.max(y0, y0 + sg * 0.42), 0.46], look.seat);
      B.box([-0.9, Math.min(y1 - sg * 0.04, y1 - sg * 0.16), 0.46], [0.9, Math.max(y1 - sg * 0.04, y1 - sg * 0.16), 1.2], shade(look.seat, 0.9));
      B.box([-0.9, Math.min(y1 - sg * 0.16, y1 + sg * 0.02), 1.2], [0.9, Math.max(y1 - sg * 0.16, y1 + sg * 0.02), 1.26], look.wood);
    }
  }
  return place(B.out, at, turn);
}

/** A fitting in its own frame (its middle at the origin, its front toward -y). */
export function fitFaces(kind, at, turn, look = {}) {
  const B = piece(kind === 'planter' ? 'geocity:planter' : 'geocity:fitting');
  if (kind === 'bins') {
    // (a waste bin and a recycling bin, round, a coloured lid ring and a dark mouth each, on a shared steel plinth)
    B.box([-0.52, -0.27, 0], [0.52, 0.27, 0.04], DARK);
    for (const [x, lid] of [[-0.25, '#4a4d52'], [0.25, '#2f7d5a']]) {
      B.cyl(x, 0, 0.22, 0.04, 0.88, STEEL, { sides: 16, top: false });
      B.cyl(x, 0, 0.225, 0.88, 0.96, lid, { sides: 16 });
      B.cyl(x, 0, 0.08, 0.961, 0.965, '#1a1b1d', { sides: 10 });
    }
  } else if (kind === 'planter') {
    B.cyl(0, 0, 0.55, 0, 0.5, DARK, { sides: 18, r1: 0.58, top: false });
    B.cyl(0, 0, 0.6, 0.5, 0.54, STEEL, { sides: 18 });
    B.dome(0, 0, 0.54, 0.5, 0.55, '#4f7a3a', 12, 4);
    B.dome(0.18, -0.1, 0.62, 0.28, 0.38, '#5f8f44', 10, 3);
  } else if (kind === 'bench') {
    // (backless, slatted in wood on two steel legs)
    for (const x of [-0.7, 0.7]) B.box([x - 0.04, -0.22, 0], [x + 0.04, 0.22, 0.42], DARK);
    B.box([-0.85, -0.22, 0.4], [0.85, 0.22, 0.42], DARK);
    for (let k = 0; k < 4; k++) { const y = -0.2 + k * 0.11; B.pill(-0.92, 0.92, y + 0.04, 0.08, 0.42, 0.46, look.wood ?? '#a8865a', 4); }
  } else if (kind === 'directory') {
    // (a totem: a dark steel plinth, a lit panel each face, its route's colour in a band, a steel cap)
    B.box([-0.36, -0.12, 0], [0.36, 0.12, 0.12], DARK);
    B.box([-0.32, -0.09, 0.12], [0.32, 0.09, 2.05], '#2a2c30');
    for (const y of [-0.1, 0.1]) {
      const n = [0, Math.sign(y), 0];
      B.box([-0.27, y < 0 ? y - 0.005 : y, 0.5], [0.27, y < 0 ? y : y + 0.005, 1.75], '#eef2f4');
      B.box([-0.27, y < 0 ? y - 0.008 : y, 1.78], [0.27, y < 0 ? y : y + 0.008, 1.98], look.band ?? '#2f8fb0');
      void n;
    }
    B.box([-0.34, -0.11, 2.05], [0.34, 0.11, 2.1], STEEL);
  }
  return place(B.out, at, turn);
}
