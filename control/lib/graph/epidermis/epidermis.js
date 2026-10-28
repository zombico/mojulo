/**
 * EPIDERMIS CUBE — a character's SURFACE as a small recipe, as the geocube (era/geocube.js) is a level's look: the rules
 * for its hair and its skin, nothing placed. The relational head (polygonizer/head-relational.js) places them by its
 * relations, so what grows on it moves with it: a groom roots on a named relational line, and an action that moves the
 * line carries the groom. A few numbers and a seed in; thousands of strands out, deterministic (seeded dice only).
 * Colouring is the egocube's (egocube/ancestry.js HAIR_COLOURS), never its own. Strands are the truth; cards for a
 * game are derived from them (later), as the game mesh is derived from the field.
 *
 *   hair.colour   an egocube hair colour's name, or a hex
 *   hair.grey     0 … 1, the share of the scalp's hair gone grey (dermal-map.js `grey`): the brows' hairs silver by a
 *                 share of it, the lashes' by less (they grey last), each hair by its own die; absent, none
 *   hair.brows    the brow groom, hung on the head's brow bridge (its strings and the fold's arc): a shape word (`BROW_SHAPES`) and its numbers over it — `arch` (0 straight … 1 high),
 *                 `thickness`, `density` (hairs per mm²), `length` (mm, the body's hairs), `seed`
 *   hair.lashes   the lash groom, rooted on the eye rig's lid margins: a shape word (`LASH_SHAPES`) and its numbers —
 *                 `length` (mm, the upper's longest), `curl` (0 straight … 1 curled), `density` (1 a natural count),
 *                 `flare` (the lateral lashes' sweep outward), `lower` (the lower lashes' length over the upper's), `seed`
 *   skin          the skin's relief (skin-relief.js): `fidelity` (`SKIN_FIDELITY`: form, creases, keratin, micro),
 *                 `age` 0 … 1, `pores` and `creases` (scales), `seed`; studied on swatches before the head
 *
 *   readEpidermis(spec)        a preset id, a document, or { from: preset, …changes } → the cube
 *   growEpidermis(head, cube)  the cube on a relational head → { strands: [{ pts, r, groom }], colour, counts }
 *
 * The brows and the lashes grow on the head; the skin's relief is studied on swatches (`head-study --skin`) first.
 */
import { streamOf } from '../city/plan/dice.js';
import { rayIn } from '../polygonizer/head-field-view.js';
import { HAIR_COLOURS } from '../egocube/ancestry.js';
import { browBridge } from '../polygonizer/head-relational-eye.js';
import { SKIN_FIDELITY, SKIN_REGIONS } from './skin-relief.js';

const MM = 1 / 230;   // a millimetre in head heights (the relational head's V)

/** brow shapes: the groom's numbers over the natural brow (artists' readings; tuned on the eyes gate) */
export const BROW_SHAPES = Object.freeze({
  natural: { arch: 0.5, thickness: 1, density: 1, length: 8.5 },
  straight: { arch: 0.12, thickness: 1.1, density: 1, length: 8.5 },
  arched: { arch: 0.95, thickness: 0.85, density: 0.95, length: 8 },
  thick: { arch: 0.35, thickness: 1.45, density: 1.35, length: 9.5 },
  thin: { arch: 0.7, thickness: 0.55, density: 0.75, length: 7 },
});
/** lash shapes: the groom's numbers over the natural lash (artists' readings; tuned on the eyes gate) */
export const LASH_SHAPES = Object.freeze({
  natural: { length: 9.5, curl: 0.55, density: 1, flare: 0.5, lower: 0.55 },
  long: { length: 12, curl: 0.6, density: 1.1, flare: 0.6, lower: 0.6 },
  curled: { length: 10, curl: 1, density: 1, flare: 0.55, lower: 0.55 },
  straight: { length: 8.5, curl: 0.15, density: 0.95, flare: 0.35, lower: 0.5 },
  sparse: { length: 7.5, curl: 0.45, density: 0.55, flare: 0.4, lower: 0.5 },
  full: { length: 10.5, curl: 0.65, density: 1.5, flare: 0.65, lower: 0.6 },
});
export const EPIDERMIS_PRESETS = Object.freeze({
  default: {
    hair: { colour: 'dark-brown', brows: { shape: 'natural', seed: 1 }, lashes: { shape: 'natural', seed: 1 } },
    skin: { fidelity: 'micro', age: 0.35, pores: 1, creases: 1, seed: 1 },
  },
});

/** The cube: a preset id, a document, or { from, …changes } (a groom's numbers over its shape word). */
export function readEpidermis(spec = 'default') {
  const doc = typeof spec === 'string' ? { from: spec } : spec || {};
  const base = EPIDERMIS_PRESETS[doc.from || 'default'];
  if (!base) throw new Error(`epidermis: unknown preset '${doc.from}' (have ${Object.keys(EPIDERMIS_PRESETS).join(', ')})`);
  const hair = { ...base.hair, ...(doc.hair || {}) };
  // each groom: `false` grows none; otherwise its shape word's numbers, the preset's and the document's over them
  for (const [k, SHAPES] of [['brows', BROW_SHAPES], ['lashes', LASH_SHAPES]]) {
    if (doc.hair?.[k] === false || !base.hair[k] && !doc.hair?.[k]) { hair[k] = null; continue; }
    const spec = { ...base.hair[k], ...(doc.hair?.[k] || {}) };
    const shape = SHAPES[spec.shape || 'natural'];
    if (!shape) throw new Error(`epidermis: hair.${k}.shape '${spec.shape}' (have ${Object.keys(SHAPES).join(', ')})`);
    hair[k] = { ...shape, ...spec };
  }
  // the skin: the preset's numbers and the document's over them; `false` grows no relief
  let skin = null;
  if (doc.skin !== false && (base.skin || doc.skin)) {
    skin = { ...base.skin, ...(doc.skin || {}) };
    if (!SKIN_FIDELITY.includes(skin.fidelity)) throw new Error(`epidermis: skin.fidelity '${skin.fidelity}' (have ${SKIN_FIDELITY.join(', ')})`);
    if (skin.region !== undefined && typeof skin.region === 'string' && !SKIN_REGIONS[skin.region]) throw new Error(`epidermis: skin.region '${skin.region}' (have ${Object.keys(SKIN_REGIONS).join(', ')})`);
  }
  if (hair.grey !== undefined && !(hair.grey >= 0 && hair.grey <= 1)) throw new Error('epidermis: hair.grey 0 … 1 (the share of the hair gone grey)');
  return { hair, skin };
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };

/**
 * THE BROW: hung on the bridge's strings (head-relational-eye.js `browBridge`), as the fold under it is. The HEAD is
 * tied on the medial string, a touch medial of the inner canthus; the TAIL on the lateral string, which runs on the
 * line from the nose's wing through the outer canthus; the ARCH'S PEAK rides the fold's arc, over the iris's outer
 * edge, `arch` lifting it. A spine runs through them, rising convex to the peak and falling to the tail. Its width is
 * broad at the head and narrows past the peak to a fine tail. `side` is the bridge's for this side (pulled by the
 * brow's action: the strings carry the brow with the fold); at rest when absent. Returns { spine(u) → {x, z},
 * slope(u), width(u), span, sg, uK } for u ∈ [0, 1] medial → lateral, in V.
 */
export function browLine(P, s, brow, side = browBridge(P).sides[s]) {
  const sg = Math.sign(P[`ex${s}`].x - P[`en${s}`].x), H = side.head, T = side.tail;
  const K = { x: side.arc.K.x, z: side.arc.K.z + 0.005 + 0.025 * brow.arch };
  const archH = K.z - H.z;
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
 * skin (`skinY`), lifting a hair's breadth at its middle. `side` is the bridge's, as `browLine` takes it. Returns
 * strands in V: [{ pts: [{x, y, z}], r }].
 */
export function growBrow(P, s, brow, skinY, side) {
  const L = browLine(P, s, brow, side);
  const dice = streamOf(brow.seed ?? 1, 'brow', s);
  // how many: the band's area at rest (mm²) × the density — the same hairs whatever pulls the strings
  const L0 = browLine(P, s, brow);
  let area = 0; for (let i = 0; i < 40; i++) area += L0.width((i + 0.5) / 40) * (L0.span / 40);
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
      pts.push({ x, y: skinY(x, z) + (0.12 + 0.35 * Math.sin(Math.PI * t)) * MM, z });
      const a = phi + bend * t;
      x += L.sg * Math.cos(a) * (len / 5); z += Math.sin(a) * (len / 5);
    }
    strands.push({ pts, r: 0.04 * MM, groom: 'brow' });
  }
  return strands;
}

const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const unit = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

/** the lower lashes on a SEATED lid (`growLashes`'s `seated`), out of the tunnel that hid most of their length: rooted
 * `root` of the rim's radius up the margin's front from where the unseated root lay (the rim's front face, under the
 * lid's band, so they hung off it), a share of their `length`, their `curl` down, and `lift` degrees nearer level */
export const SEATED_LOWER = Object.freeze({ root: 0.7, length: 0.75, curl: 0.6, lift: 10 });

/**
 * THE LASHES for one eye: roots along each lid margin's front edge (the eye rig's lash lines, `margins.upper/lower`
 * at t medial → lateral), none at the inner canthus's punctum, thicker toward the lateral. Each lash leaves the margin
 * facing forward (the globe's normal there, its sideways share softened) at an ELEVATION set by where the margin sits
 * on the globe — half its angle, tipped down by the lid's roll, more as the lid shuts, so a closed lid's lashes hang —
 * then CURLS, the upper's up and the lower's down, the curl gathering toward the tip; the lateral lashes FLARE outward,
 * the medial a touch inward. The upper's longest sit centre-lateral, the lower's are shorter and sparser. Seeded per
 * side; `open` the lid's openness (the rig's channel). `skin` lays a root on the skin (`place(p)`, null where it cannot) and takes each step
 * (`step(prev, dir, len)`, which may deflect a lash off the skin it would sink into, or end it: null); both default to
 * free space. `seated`: the lids rest on the globe (head-relational-eye.js SEAT), so the lower lashes are no longer cut
 * short in a tunnel; they root on the margin's front edge under the eye and grow by `SEATED_LOWER`.
 * Returns strands in V, their first point the root.
 */
export function growLashes(margins, s, lash, open = 1, skin = {}, { seated = false } = {}) {
  const place = skin.place || ((p) => p), step = skin.step || ((p, d, l) => add(p, d, l));
  const deg = Math.PI / 180, strands = [], K = 6;
  for (const upper of [true, false]) {
    const line = upper ? margins.upper : margins.lower;
    const dice = streamOf(lash.seed ?? 1, upper ? 'lash' : 'lashLow', s);
    const n = Math.round((upper ? 110 : 55) * lash.density);
    const low = !upper && seated ? SEATED_LOWER : null;
    const L = lash.length * (upper ? 1 : lash.lower) * (low ? low.length : 1);
    const roll = (upper ? 16 + 34 * (1 - Math.min(1, open)) : low ? -low.lift : -4) * deg, curl = (upper ? 25 + 45 * lash.curl : (15 + 30 * lash.curl) * (low ? low.curl : 1)) * deg;
    for (let i = 0; i < n; i++) {
      // a root along the margin: from past the punctum to the lateral canthus, denser laterally
      const t = upper ? 0.08 + 0.9 * Math.pow(dice(), 0.85) : 0.15 + 0.82 * Math.pow(dice(), 0.75);
      const m = line(t);
      const row = dice() - 0.5;   // the lashes stand in rows across the margin's front
      const len = L * (upper ? 0.5 + 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t / 1.25 + 0.1)), 1.5) : 0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.12))) * (0.8 + 0.35 * dice()) * MM;
      const root = place(add(add(m.c, m.n, m.r * 0.85), m.away, -m.r * (upper ? 0.25 : low ? low.root : 0.15) + row * 0.5 * MM));
      if (!root) continue;
      // the frame: forward (the globe's normal, flattened), the margin's tangent for the flare, up
      const fwd = unit({ x: m.n.x * 0.6, y: m.n.y, z: 0 }), fl = lash.flare * (t - 0.4) * 0.9 + (dice() - 0.5) * 0.12;
      const e0 = 0.5 * Math.asin(Math.max(-1, Math.min(1, m.n.z))) - roll + (dice() - 0.5) * 10 * deg, cu = curl * (0.8 + 0.4 * dice()) * (upper ? 1 : -1);
      const pts = [root];
      let p = root;
      for (let k = 0; k < K; k++) {
        const e = e0 + cu * Math.pow((k + 0.5) / K, 1.4);
        const dir = unit(add({ x: fwd.x * Math.cos(e), y: fwd.y * Math.cos(e), z: Math.sin(e) }, m.T, fl));
        p = step(p, dir, len / K);
        if (!p) break;
        pts.push(p);
      }
      if (pts.length > 1) strands.push({ pts, r: (upper ? 0.05 : 0.035) * MM, groom: upper ? 'lash' : 'lashLow' });
    }
  }
  return strands;
}

/**
 * A point moved onto the field's level `up` (a hair's lift above the skin): Newton along the gradient, its step scaled
 * by the gradient's own size (the head's field is a distance only roughly — its blends and cuts steepen it, and a unit
 * step overshoots and rings), keeping the best point; failing that (a crease, where the gradient flips), bisected along
 * the first gradient over a bracket grown until it holds the level.
 */
function toLevel(f, q, up, tol) {
  const h = 0.0004;
  const grad = (p) => ({ x: (f({ ...p, x: p.x + h }) - f({ ...p, x: p.x - h })) / (2 * h), y: (f({ ...p, y: p.y + h }) - f({ ...p, y: p.y - h })) / (2 * h), z: (f({ ...p, z: p.z + h }) - f({ ...p, z: p.z - h })) / (2 * h) });
  const g0 = grad(q), d0 = unit(g0);
  let p = q, best = q, bestE = Math.abs(f(q) - up);
  for (let k = 0; k < 12 && bestE > tol; k++) {
    const g = grad(p), g2 = g.x * g.x + g.y * g.y + g.z * g.z || 1, m = (up - f(p)) / g2;
    p = add(p, g, m);
    const e = Math.abs(f(p) - up);
    if (e < bestE) { best = p; bestE = e; }
  }
  if (bestE <= tol) return best;
  let lo = 0, hi = 0.0005;
  while (f(add(q, d0, hi)) < up && hi < 0.05) hi *= 2;
  if (f(q) > up) { lo = -0.0005; while (f(add(q, d0, lo)) > up && lo > -0.05) lo *= 2; }
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (f(add(q, d0, mid)) < up) lo = mid; else hi = mid; }
  return add(q, d0, hi);
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
      // the brow hangs on the bridge's strings, as the action pulled them
      const side = R.bridge.sides[s], L = browLine(P, s, cube.hair.brows, side);
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
      const grown = growBrow(P, s, cube.hair.brows, skinY, side);
      counts.brows += grown.length;
      // WALK each hair over the skin: its root laid on the skin along the normal (the field's gradient), then each step
      // taken in the skin's tangent plane toward the comb's next point, snapped back to a hair's lift above the skin
      // along the normal, and kept to its length — a depth read along the view would stretch a hair into the air
      // wherever the skin turns to face sideways (the brow's tail)
      const lift = 0.1 * MM * sc, h = 0.0004, f = head.field;
      const normal = (q) => { const g = { x: f({ ...q, x: q.x + h }) - f({ ...q, x: q.x - h }), y: f({ ...q, y: q.y + h }) - f({ ...q, y: q.y - h }), z: f({ ...q, z: q.z + h }) - f({ ...q, z: q.z - h }) }, l = Math.hypot(g.x, g.y, g.z) || 1; return { x: g.x / l, y: g.y / l, z: g.z / l }; };
      const snap = (q, up) => toLevel(f, q, up, 0.05 * lift);
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
  if (cube.hair.lashes && R.eyeRigs?.length) {
    counts.lashes = 0;
    const f = head.field, h = 0.0004;
    const normal = (q) => unit({ x: f({ ...q, x: q.x + h }) - f({ ...q, x: q.x - h }), y: f({ ...q, y: q.y + h }) - f({ ...q, y: q.y - h }), z: f({ ...q, z: q.z + h }) - f({ ...q, z: q.z - h }) });
    // in head heights: a root laid on the lid's skin (the rim the margin's beads welded into it, along the field's
    // normal); a step the lash's curl would sink into the skin (a fold, the other lid on a shut eye, a full cheek) bent off
    // it toward the skin's normal until it clears a hair's breadth — its length kept, never stretched
    const fV = (p) => f({ x: p.x * sc, y: p.y * sc, z: p.z * sc }) / sc, nV = (p) => normal({ x: p.x * sc, y: p.y * sc, z: p.z * sc });
    const clear = 0.05 * MM;
    const skin = {
      // (a root the snap cannot lay within 2 mm of its lash line is not a root: the line runs into a fold there)
      place: (p) => { const q = toLevel(f, { x: p.x * sc, y: p.y * sc, z: p.z * sc }, 0.2 * clear * sc, 0.05 * clear * sc), r = { x: q.x / sc, y: q.y / sc, z: q.z / sc }; return Math.hypot(r.x - p.x, r.y - p.y, r.z - p.z) > 2 * MM ? null : r; },
      step: (p, dir, l) => {
        let q = add(p, dir, l);
        // (a lash heading down onto skin that faces up, a lower lash over a full cheek, is pushed forward off it, not
        // up: the normal's rise taken off)
        const off = (n) => (dir.z < 0 && n.z > 0 ? unit({ x: n.x, y: n.y, z: 0 }) : n);
        for (let w = 0.25, k = 0; k < 8 && fV(q) < clear; k++, w *= 1.6) q = add(p, unit(add(dir, off(nV(q)), w)), l);
        return fV(q) < clear ? null : q;   // (pressed against skin it cannot clear — a canthus's corner — it ends)
      },
    };
    for (const rig of R.eyeRigs) {
      for (const g of growLashes(rig.margins, rig.side, cube.hair.lashes, rig.channels.open, skin, { seated: !!rig.seated })) {
        strands.push({ ...g, pts: g.pts.map((p) => ({ x: p.x * sc, y: p.y * sc, z: p.z * sc })), r: g.r * sc });
        counts.lashes++;
      }
    }
  }
  // GREY: a share of the brows' and the lashes' hairs silver (`hair.grey`, the scalp's, the brows' at EPI_GREY of it),
  // each its own die, as the scalp's (dermal-hair.js): absent, the strands as they were
  if (cube.hair.grey > 0) {
    const silver = [1, 3, 5].map((i) => { const c = parseInt(GREY_HEX.slice(i, i + 2), 16) / 255; return Math.round((c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * 1e4) / 1e4; });
    const dice = streamOf(cube.hair.brows?.seed ?? 1, 'epidermis-grey', 'hairs');
    for (let i = 0; i < strands.length; i++) { const st = strands[i], share = cube.hair.grey * (EPI_GREY[st.groom] ?? 0); if (dice() < share) strands[i] = { ...st, streak: { colour: silver, from: 0, grey: true } }; }
  }
  return { strands, colour, counts };
}
/** the brows' and the lashes' share of the scalp's grey (the brows grey later, the lashes last); a grey hair's colour
 * (dermal-map.js GREY_HAIR's) */
const EPI_GREY = Object.freeze({ brow: 0.7, lash: 0.3, lashLow: 0.3 });
const GREY_HEX = '#cdc8bf';
