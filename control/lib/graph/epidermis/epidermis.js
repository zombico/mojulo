/**
 * EPIDERMIS CUBE — a character's SURFACE as a small recipe, as the geocube (era/geocube.js) is a level's look: the rules
 * for its hair and its skin, nothing placed. The relational head (polygonizer/head-relational.js) places them by its
 * relations, so what grows on it moves with it: a groom roots on a named relational line, and an action that moves the
 * line carries the groom. A few numbers and a seed in; thousands of strands out, deterministic (seeded dice only).
 * Colouring is the egocube's (egocube/ancestry.js HAIR_COLOURS), never its own. Strands are the truth; cards for a
 * game are derived from them (later), as the game mesh is derived from the field.
 *
 *   hair.colour   an egocube hair colour's name, or a hex
 *   hair.brows    the brow groom: a shape word (`BROW_SHAPES`) and its numbers over it — `arch` (0 straight … 1 high),
 *                 `thickness`, `density` (hairs per mm²), `length` (mm, the body's hairs), `seed`
 *
 *   readEpidermis(spec)        a preset id, a document, or { from: preset, …changes } → the cube
 *   growEpidermis(head, cube)  the cube on a relational head → { strands: [{ pts, r, groom }], colour, counts }
 *
 * Phase 1 is the brows; the lashes (on the eye rig's lid curves) and the skin's micro-relief come next.
 */
import { streamOf } from '../city/plan/dice.js';
import { rayIn } from '../polygonizer/head-field-view.js';
import { HAIR_COLOURS } from '../egocube/ancestry.js';
import { GLOBE } from '../polygonizer/head-relational-eye.js';

const MM = 1 / 230;   // a millimetre in head heights (the relational head's V)

/** brow shapes: the groom's numbers over the natural brow (artists' readings; tuned on the eyes gate) */
export const BROW_SHAPES = Object.freeze({
  natural: { arch: 0.5, thickness: 1, density: 1, length: 8.5 },
  straight: { arch: 0.12, thickness: 1.1, density: 1, length: 8.5 },
  arched: { arch: 0.95, thickness: 0.85, density: 0.95, length: 8 },
  thick: { arch: 0.35, thickness: 1.45, density: 1.35, length: 9.5 },
  thin: { arch: 0.7, thickness: 0.55, density: 0.75, length: 7 },
});
export const EPIDERMIS_PRESETS = Object.freeze({
  default: { hair: { colour: 'dark-brown', brows: { shape: 'natural', seed: 1 } } },
});

/** The cube: a preset id, a document, or { from, …changes } (a groom's numbers over its shape word). */
export function readEpidermis(spec = 'default') {
  const doc = typeof spec === 'string' ? { from: spec } : spec || {};
  const base = EPIDERMIS_PRESETS[doc.from || 'default'];
  if (!base) throw new Error(`epidermis: unknown preset '${doc.from}' (have ${Object.keys(EPIDERMIS_PRESETS).join(', ')})`);
  const hair = { ...base.hair, ...(doc.hair || {}) };
  const bspec = { ...base.hair.brows, ...(doc.hair?.brows || {}) };
  if (doc.hair?.brows === false) hair.brows = null;
  else {
    const shape = BROW_SHAPES[bspec.shape || 'natural'];
    if (!shape) throw new Error(`epidermis: hair.brows.shape '${bspec.shape}' (have ${Object.keys(BROW_SHAPES).join(', ')})`);
    hair.brows = { ...shape, ...bspec };
  }
  return { hair };
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/**
 * THE BROW — its line from the relations (V units, side `s`): the HEAD over the inner canthus (a touch medial), the
 * ARCH'S PEAK over the iris's outer edge, the TAIL on the line from the nose's wing through the outer canthus; a spine
 * through them (rising convex to the peak, falling to the tail), a width that is broad at the head, narrowing past the
 * peak to a fine tail. Returns { spine(u) → {x, z}, slope(u), width(u), span } for u ∈ [0, 1] medial → lateral.
 */
export function browLine(P, s, brow) {
  const en = P[`en${s}`], ex = P[`ex${s}`], e = P[`eye${s}`], al = P[`al${s}`];
  const sg = Math.sign(ex.x - en.x);
  const H = { x: en.x - sg * 0.008, z: en.z + 0.075 };
  const archH = 0.01 + 0.025 * brow.arch;
  const K = { x: e.x + sg * GLOBE.iris, z: H.z + archH };
  const dx = ex.x - al.x, dz = ex.z - al.z, tau = (H.z + 0.004 - ex.z) / dz;
  const T = { x: ex.x + dx * tau, z: ex.z + dz * tau };
  const uK = Math.abs(K.x - H.x) / Math.abs(T.x - H.x);
  const spine = (u) => {
    const x = lerp(H.x, T.x, u);
    if (u <= uK) return { x, z: H.z + archH * Math.sin((Math.PI / 2) * (u / uK)) };
    const t = (u - uK) / (1 - uK);
    return { x, z: K.z + (T.z - K.z) * Math.pow(t, 1.4) };
  };
  const slope = (u) => { const a = spine(Math.max(0, u - 0.01)), b = spine(Math.min(1, u + 0.01)); return Math.atan2(b.z - a.z, Math.abs(b.x - a.x)); };
  const th = brow.thickness;
  const width = (u) => th * (u < 0.15 ? 0.03 : u < uK ? lerp(0.03, 0.024, (u - 0.15) / (uK - 0.15)) : lerp(0.024, 0.005, smooth((u - uK) / (1 - uK))));
  return { spine, slope, width, span: Math.abs(T.x - H.x), sg, uK };
}

/**
 * The brow groom for side `s`: roots scattered over the brow's band (more where it is broad), each hair combed by its
 * region — the HEAD's straight up, the BODY's out and up along the line, the TAIL's out and down — with the
 * HERRINGBONE across the band (the lower hairs angled up, the upper down, meeting along the spine); laid flat on the
 * skin (`skinY`), lifting a hair's breadth at its middle. `shift(u)` is how far the brow pad's action moved the line
 * there. Returns strands in V: [{ pts: [{x, y, z}], r }].
 */
export function growBrow(P, s, brow, skinY, shift) {
  const L = browLine(P, s, brow);
  const dice = streamOf(brow.seed ?? 1, 'brow', s);
  // how many: the band's area (mm²) × the density
  let area = 0; for (let i = 0; i < 40; i++) area += L.width((i + 0.5) / 40) * (L.span / 40);
  const n = Math.round((area / (MM * MM)) * brow.density);
  const strands = [];
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    // a root: u weighted toward the broad head (rejection against the width), v across the band (triangular: thinner
    // at the band's edges, as a brow is)
    let u, guard = 0;
    do { u = dice(); guard++; } while (dice() * 0.03 > L.width(u) / Math.max(brow.thickness, 0.01) && guard < 20);
    const v = dice() + dice() - 1, w = L.width(u);
    const sp = L.spine(u), sl = L.slope(u);
    const root = { x: sp.x, z: sp.z + v * w * 0.5 };
    // the comb: the head's hairs up, the body's along the line and up, the tail's along it and down; the herringbone
    const along = sl + 12 * deg - (u > 0.75 ? 10 * deg * smooth((u - 0.75) / 0.25) : 0);
    let phi = lerp(80 * deg, along, smooth(u / 0.22)) - v * 18 * deg + (dice() - 0.5) * 16 * deg;
    const len = (u < 0.2 ? lerp(5.5, brow.length, u / 0.2) : u > 0.7 ? lerp(brow.length, 6.5, (u - 0.7) / 0.3) : brow.length) * MM * (0.8 + 0.4 * dice());
    const bend = (-8 - 8 * dice()) * deg;   // a hair bows down along its length
    const pts = [];
    let x = root.x, z = root.z;
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const d = shift(u);
      pts.push({ x: x + d.x, y: skinY(x + d.x, z + d.z) + (0.12 + 0.35 * Math.sin(Math.PI * t)) * MM, z: z + d.z });
      const a = phi + bend * t;
      x += L.sg * Math.cos(a) * (len / 5); z += Math.sin(a) * (len / 5);
    }
    strands.push({ pts, r: 0.04 * MM, groom: 'brow' });
  }
  return strands;
}

/**
 * The cube grown on a relational head (`relationalHead`'s output): strands in the head's own units (STAND), the hair's
 * colour, and how many each groom grew. The skin's depth is probed from the head's field on a grid over each groom's
 * reach and read bilinearly (a ray per hair-point would cost a thousand-fold).
 */
export function growEpidermis(head, cube) {
  const R = head.relational;
  if (!R) throw new Error('epidermis: grows on a relational head (head-relational.js)');
  const sc = R.V, P = R.points;
  const colour = HAIR_COLOURS[cube.hair.colour] || cube.hair.colour || HAIR_COLOURS['dark-brown'];
  const strands = [], counts = {};
  if (cube.hair.brows) {
    counts.brows = 0;
    for (const s of ['L', 'R']) {
      const L = browLine(P, s, cube.hair.brows);
      // the skin's depth over the brow's reach, on a grid
      const x0 = Math.min(L.spine(0).x, L.spine(1).x) - 0.03, x1 = Math.max(L.spine(0).x, L.spine(1).x) + 0.03;
      const z0 = Math.min(L.spine(0).z, L.spine(1).z) - 0.05, z1 = L.spine(L.uK).z + 0.08, NX = 28, NZ = 16;
      const grid = [];
      for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
        const x = lerp(x0, x1, i / NX), z = lerp(z0, z1, j / NZ);
        const q = rayIn(head.field, { x: x * sc, y: 0, z: z * sc }, [0, 1, 0]);
        grid.push(q ? q.y / sc : null);
      }
      const at = (i, j) => grid[j * (NX + 1) + i];
      const skinY = (x, z) => {
        const fi = Math.max(0, Math.min(NX - 1e-9, ((x - x0) / (x1 - x0)) * NX)), fj = Math.max(0, Math.min(NZ - 1e-9, ((z - z0) / (z1 - z0)) * NZ));
        const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
        const c = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)];
        const known = c.filter((y) => y !== null);
        if (!known.length) return P[`eye${s}`].y;
        const fill = known.reduce((m, y) => m + y, 0) / known.length, [c00, c10, c01, c11] = c.map((y) => (y === null ? fill : y));
        return lerp(lerp(c00, c10, a), lerp(c01, c11, a), b);
      };
      // the brow pad's action: how far its medial and lateral beads moved (rest → moved), across the line
      const pr = R.rest.browPad, pm = R.moved.browPad;
      const lat = s === 'L' ? 'a' : 'b', dMed = { x: pm.c.x - pr.c.x, z: pm.c.z - pr.c.z }, dLat = { x: pm[lat].x - pr[lat].x, z: pm[lat].z - pr[lat].z };
      const shift = (u) => ({ x: lerp(dMed.x, dLat.x, u), z: lerp(dMed.z, dLat.z, u) });
      const grown = growBrow(P, s, cube.hair.brows, skinY, shift);
      counts.brows += grown.length;
      // WALK each hair over the skin: its root laid on the skin along the normal (the field's gradient), then each step
      // taken in the skin's tangent plane toward the comb's next point, snapped back to a hair's lift above the skin
      // along the normal, and kept to its length — a depth read along the view would stretch a hair into the air
      // wherever the skin turns to face sideways (the brow's tail)
      const lift = 0.1 * MM * sc, h = 0.0004, f = head.field;
      const normal = (q) => { const g = { x: f({ ...q, x: q.x + h }) - f({ ...q, x: q.x - h }), y: f({ ...q, y: q.y + h }) - f({ ...q, y: q.y - h }), z: f({ ...q, z: q.z + h }) - f({ ...q, z: q.z - h }) }, l = Math.hypot(g.x, g.y, g.z) || 1; return { x: g.x / l, y: g.y / l, z: g.z / l }; };
      const snap = (q, up) => { for (let k = 0; k < 3; k++) { const n = normal(q), m = up - f(q); q = { x: q.x + n.x * m, y: q.y + n.y * m, z: q.z + n.z * m }; } return q; };
      const walk = (g) => {
        const P0 = g.pts.map((p) => ({ x: p.x * sc, y: p.y * sc, z: p.z * sc }));
        const out = [snap(P0[0], lift)];
        for (let k = 1; k < P0.length; k++) {
          const prev = out[k - 1], want = { x: P0[k].x - P0[k - 1].x, z: P0[k].z - P0[k - 1].z }, len = Math.hypot(want.x, want.z);
          const n = normal(prev), d0 = { x: want.x, y: 0, z: want.z }, dn = d0.x * n.x + d0.z * n.z;
          let t = { x: d0.x - n.x * dn, y: -n.y * dn, z: d0.z - n.z * dn };   // the step in the tangent plane
          const tl = Math.hypot(t.x, t.y, t.z) || 1; t = { x: (t.x / tl) * len, y: (t.y / tl) * len, z: (t.z / tl) * len };
          // (a hair lifts a hair's breadth off the skin along its middle, lying at its root and its tip)
          out.push(snap({ x: prev.x + t.x, y: prev.y + t.y, z: prev.z + t.z }, lift + 0.35 * MM * sc * Math.sin((Math.PI * k) / (P0.length - 1))));
        }
        return out;
      };
      for (const g of grown) strands.push({ ...g, pts: walk(g), r: g.r * sc });
    }
  }
  return { strands, colour, counts };
}
