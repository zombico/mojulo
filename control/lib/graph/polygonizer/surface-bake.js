/**
 * surface-bake — the CHARACTER BAKE STACK: hand-painted light baked into a layered figure's corners, read off its own
 * REST geometry (no camera, no light, no texture), so it is the same per corner in every pose and every reader (the
 * World page's faces, the rig pack's vertex colour, every export) carries it the way it carries the face tint.
 *
 * `bake` on a layered manifest (beside `toon` and `hullShade`; not `toon.bake`, the ink's GLB geometry):
 *   true                       every group its finish by name, at full strength
 *   { finish?, strength? }     `finish`: { <group> | '*': a FINISH word or an inline finish } over the name table;
 *                              `strength` 0–1 scales every channel's pull away from the base colour (default 1)
 *
 * The CHANNELS, per corner, geometry alone:
 *   sky        the welded surface normal's facing up (−1 down … 1 up): the painted top-light, the sky's band on metal
 *   occlusion  disk-to-point occlusion (every face within a radius set by the figure's height, facing the corner, in
 *              front of it): a cavity within a part AND the contact between parts (a plate's inner wall over the body,
 *              the arm against the torso, the belt over the tabard), 0 open … 1 buried
 *   edge       the welded surface's convexity at the corner, 0 flat … 1 a rim or a ridge: the painted edge highlight
 *   height     over the figure, 0 its lowest point … 1 its highest: a cloth darkening toward its hem and the feet
 *   rise       over its own PART, 0 the part's lowest point … 1 its highest: each plate, each scale-row, painted light at
 *              its top and dark at its foot (the hand-painted piece gradient), whatever height it is worn at
 *
 * A FINISH turns them into an [r, g, b] multiplier: `sky` a ramp over the facing ([[facing, multiplier], …], linear
 * between), `occlusion` the darkening at 1, `edge` the lift at 1, `height` the darkening at the figure's foot, `rise` the
 * swing across a part (its foot 1 − rise / 2, its top 1 + rise / 2), `tint`
 * the colour its lifts lean toward (a gilt highlight warmer, a skin's shadow redder: [r, g, b] weights on the lift and the
 * occlusion). Plain data: an inline finish is a new direction with no code.
 *
 *   validateBake(bake)                     error strings
 *   resolveBake(bake)                      { finish, strength } or null (absent, false, or invalid ⇒ null)
 *   finishFor(group, resolved)             the finish a palette group wears
 *   bakeChannels(mesh)                     per vertex { sky, occlusion, edge, height, rise }
 *   bakeTint(mesh, bake, { glows })        per face its corners' multipliers (the face-tint shape), or null
 *   stackTints(a, b)                       two tints as one (corner by corner, the product)
 *
 * Pure, deterministic: fixed arithmetic over the mesh, no dice.
 */

const FIELDS = ['finish', 'strength'];
const FINISH_KEYS = ['sky', 'occlusion', 'edge', 'height', 'rise', 'tint'];

/** The finishes. Each multiplier stays near 1 where a surface faces sideways in the open: the palette's colour is the
 * mid-tone, the bake paints the light above it and the shadow below. */
export const FINISHES = Object.freeze({
  // a polished plate: a dark ground band below the horizon, a bright sky band above it, the zenith settling back
  metal: Object.freeze({ sky: [[-1, 0.5], [-0.25, 0.62], [0.05, 0.98], [0.3, 0.84], [0.62, 1.42], [0.85, 1.2], [1, 1.06]], occlusion: 0.75, edge: 0.55, height: 0.18, rise: 0.6, tint: [1, 1, 1] }),
  // gold and bronze: metal's bands, its lifts warmer
  gilt: Object.freeze({ sky: [[-1, 0.52], [-0.25, 0.64], [0.05, 0.98], [0.3, 0.86], [0.62, 1.38], [0.85, 1.22], [1, 1.08]], occlusion: 0.75, edge: 0.6, height: 0.15, rise: 0.4, tint: [1, 0.92, 0.7] }),
  // worn leather: a low sheen over the top, its edges rubbed lighter
  leather: Object.freeze({ sky: [[-1, 0.74], [0, 0.92], [0.6, 1.12], [1, 1.06]], occlusion: 0.7, edge: 0.3, height: 0.15, rise: 0.2, tint: [1, 0.95, 0.88] }),
  // cloth: soft and matte, deep in its folds, falling darker toward the hem
  cloth: Object.freeze({ sky: [[-1, 0.76], [0, 0.94], [1, 1.07]], occlusion: 0.8, edge: 0.08, height: 0.3, rise: 0.25, tint: [1, 1, 1] }),
  // skin: barely painted, its shadows warm
  skin: Object.freeze({ sky: [[-1, 0.9], [1, 1.03]], occlusion: 0.45, edge: 0.04, height: 0.06, tint: [0.7, 1, 1] }),
  // a scaled hide: dark in the seams between scales, the scales' crowns catching light
  scale: Object.freeze({ sky: [[-1, 0.7], [0, 0.94], [1, 1.1]], occlusion: 0.9, edge: 0.4, height: 0.12, rise: 0.3, tint: [1, 1, 0.94] }),
  // anything else: a plain painted top-light
  matte: Object.freeze({ sky: [[-1, 0.8], [1, 1.05]], occlusion: 0.65, edge: 0.12, height: 0.12, tint: [1, 1, 1] }),
});
export const FINISH_NAMES = Object.freeze(Object.keys(FINISHES));

/** The name table: a palette group's finish by its name (the armour cards', the dress tones', a creature's), first match
 * wins; every other group is `matte`. */
export const FINISH_BY_GROUP = Object.freeze([
  [/^(Trim|Accent|Gold|Gilt|Brass|Bronze|Crest|Kanamono)/, 'gilt'],
  [/^(Plate|Iron|Steel|Silver|Rivet|Helm|Metal|Chain|Mail|Lacquer)/, 'metal'],
  [/^(Leather|Strap|Belt|Shoes|Boot|Wrap|Bracer)/, 'leather'],
  [/^(Top|Bottom|Cloth|Tabard|Quilt|Cuff|Odoshi|Cape|Cloak|Hem|Patch|Swim|Suit|Glove|Sleeve|Robe)/, 'cloth'],
  [/^(Skin|Lip|Navel|EarInner)/, 'skin'],
  [/^(Scale|Scales|Hide|Scute|Wing|Membrane)/, 'scale'],
]);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Error strings for an inline finish (or a word) at `at`. */
function finishErrors(F, at) {
  if (typeof F === 'string') return Object.hasOwn(FINISHES, F) ? [] : [`${at}: '${F}' is not a finish (${FINISH_NAMES.join(', ')}), or an inline { ${FINISH_KEYS.join(', ')} }`];
  if (!isPlain(F)) return [`${at}: a finish word (${FINISH_NAMES.join(', ')}) or an inline { ${FINISH_KEYS.join(', ')} }`];
  const errs = [];
  for (const k of Object.keys(F)) if (!FINISH_KEYS.includes(k)) errs.push(`${at}.${k}: not a finish key (${FINISH_KEYS.join(', ')})`);
  if (F.sky !== undefined) {
    const ok = Array.isArray(F.sky) && F.sky.length >= 1 && F.sky.length <= 16 && F.sky.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]) && p[0] >= -1 && p[0] <= 1 && p[1] >= 0 && p[1] <= 2)
      && F.sky.every((p, i) => i === 0 || p[0] > F.sky[i - 1][0]);
    if (!ok) errs.push(`${at}.sky: 1–16 points [facing −1…1 ascending, multiplier 0–2]`);
  }
  for (const k of ['occlusion', 'edge', 'height', 'rise']) if (F[k] !== undefined && !(isNum(F[k]) && F[k] >= 0 && F[k] <= 1)) errs.push(`${at}.${k}: a number 0–1`);
  if (F.tint !== undefined && !(Array.isArray(F.tint) && F.tint.length === 3 && F.tint.every((x) => isNum(x) && x >= 0 && x <= 1))) errs.push(`${at}.tint: [r, g, b], each 0–1`);
  return errs;
}

/** Error strings for a manifest's `bake` (absent, null and false are no bake). */
export function validateBake(bake) {
  if (bake === undefined || bake === null || bake === false || bake === true) return [];
  if (!isPlain(bake)) return ['bake: true, or { finish?: { <group> | \'*\': a finish }, strength?: 0–1 }'];
  const errs = [];
  for (const k of Object.keys(bake)) if (!FIELDS.includes(k)) errs.push(`bake.${k}: not a bake word (${FIELDS.join(', ')})`);
  if (bake.strength !== undefined && !(isNum(bake.strength) && bake.strength >= 0 && bake.strength <= 1)) errs.push('bake.strength: a number 0–1');
  if (bake.finish !== undefined) {
    if (!isPlain(bake.finish)) errs.push('bake.finish: { <group> | \'*\': a finish word or an inline finish }');
    else for (const [g, F] of Object.entries(bake.finish)) errs.push(...finishErrors(F, `bake.finish.${g}`));
  }
  return errs;
}

/** `bake` → { finish, strength } or null. An invalid bake throws its errors (the resolve's posture: say it, never guess). */
export function resolveBake(bake) {
  if (bake === undefined || bake === null || bake === false) return null;
  const errs = validateBake(bake);
  if (errs.length) throw new Error(`bake refused:\n - ${errs.join('\n - ')}\nThe bake — manual: get_solid_vocab({ id: 'layered' }) (the Spec section).`);
  const B = bake === true ? {} : bake;
  return { finish: B.finish ?? {}, strength: B.strength ?? 1 };
}

const finishOf = (F) => (typeof F === 'string' ? FINISHES[F] : { ...FINISHES.matte, ...F });
/** The finish a palette group wears: the operator's by group, then by '*', then the name table, then matte. */
export function finishFor(group, resolved) {
  const own = resolved.finish[group] ?? resolved.finish['*'];
  if (own !== undefined) return finishOf(own);
  for (const [re, word] of FINISH_BY_GROUP) if (re.test(group)) return FINISHES[word];
  return FINISHES.matte;
}

// ─── the channels ───
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const smooth = (lo, hi, x) => { const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };
/** the occlusion radius as a share of the figure's height (6 cm on a 1.75 m figure) */
export const OCCLUSION_REACH = 0.035;
/** the occlusion's gain: the disk sum at which a corner reads fully buried */
const OCCLUSION_GAIN = 2.2;
/** a RIM: a corner where some face turns away from the welded normal by more than a low-poly ring's own facets do (a ring
 * of six turns 30° a facet), read from EDGE_LO to EDGE_HI degrees, and only where the surface is convex there */
const EDGE_LO = 32, EDGE_HI = 50;

/**
 * Per vertex of `mesh` (its rest positions): { sky, occlusion, edge, height }, arrays by vertex index. The surface a
 * corner belongs to is its PART welded by position (a part's own seams close; a plate never borrows the body's normal).
 */
export function bakeChannels(mesh) {
  const V = mesh.vertices, F = mesh.faces, nV = V.length, partOf = (vi) => mesh.provenance[vi].part;
  // the weld: (part, position) → one surface point
  const q = 1e-5, wid = new Int32Array(nV), ids = new Map(); let nW = 0;
  for (let vi = 0; vi < nV; vi++) { const p = V[vi], k = `${partOf(vi)}|${Math.round(p[0] / q)},${Math.round(p[1] / q)},${Math.round(p[2] / q)}`; let w = ids.get(k); if (w === undefined) { w = nW++; ids.set(k, w); } wid[vi] = w; }
  const pos = new Array(nW), nrm = Array.from({ length: nW }, () => [0, 0, 0]), nbr = Array.from({ length: nW }, () => new Set()), turn = new Float64Array(nW).fill(1);
  for (let vi = 0; vi < nV; vi++) pos[wid[vi]] = V[vi];
  // the faces as emitters: centroid, unit normal, area
  const C = new Array(F.length), N = new Array(F.length), A = new Float64Array(F.length);
  F.forEach((t, fi) => {
    const a = V[t[0]], b = V[t[1]], c = V[t[2]], n = cross(sub(b, a), sub(c, a)), l = len(n);
    C[fi] = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]; A[fi] = l / 2; N[fi] = l > 1e-14 ? [n[0] / l, n[1] / l, n[2] / l] : [0, 0, 0];
    const w = t.map((vi) => wid[vi]);
    for (let k = 0; k < 3; k++) { const W = w[k]; nrm[W][0] += n[0]; nrm[W][1] += n[1]; nrm[W][2] += n[2]; nbr[W].add(w[(k + 1) % 3]); nbr[W].add(w[(k + 2) % 3]); }
  });
  for (let W = 0; W < nW; W++) { const l = len(nrm[W]); nrm[W] = l > 1e-14 ? [nrm[W][0] / l, nrm[W][1] / l, nrm[W][2] / l] : [0, 0, 1]; }
  // each corner's sharpest turn: the least cosine between its welded normal and a face it touches
  F.forEach((t, fi) => { if (!(A[fi] > 0)) return; for (const vi of t) { const W = wid[vi], c = dot(nrm[W], N[fi]); if (c < turn[W]) turn[W] = c; } });
  const cosLo = Math.cos(EDGE_LO * Math.PI / 180), cosHi = Math.cos(EDGE_HI * Math.PI / 180);
  // the figure's extent, and each part's
  let lo = Infinity, hi = -Infinity; for (const p of pos) { if (p[2] < lo) lo = p[2]; if (p[2] > hi) hi = p[2]; }
  const span = new Map(); for (let vi = 0; vi < nV; vi++) { const pn = partOf(vi), z = V[vi][2]; const e = span.get(pn); if (!e) span.set(pn, [z, z]); else { if (z < e[0]) e[0] = z; if (z > e[1]) e[1] = z; } }
  const wPart = new Array(nW); for (let vi = 0; vi < nV; vi++) wPart[wid[vi]] = partOf(vi);
  const H = hi > lo ? hi - lo : 1, R = OCCLUSION_REACH * H, R2 = R * R;
  // the emitters' grid, cell R
  const cell = (x) => Math.floor(x / R), grid = new Map(), key = (i, j, k) => `${i},${j},${k}`;
  for (let fi = 0; fi < F.length; fi++) { if (!(A[fi] > 0)) continue; const c = C[fi], k = key(cell(c[0]), cell(c[1]), cell(c[2])); let L = grid.get(k); if (!L) grid.set(k, L = []); L.push(fi); }
  const wSky = new Float64Array(nW), wOcc = new Float64Array(nW), wEdge = new Float64Array(nW), wH = new Float64Array(nW), wRise = new Float64Array(nW);
  for (let W = 0; W < nW; W++) {
    const p = pos[W], n = nrm[W];
    wSky[W] = n[2]; wH[W] = (p[2] - lo) / H;
    { const [a, b] = span.get(wPart[W]); wRise[W] = b - a > 1e-9 ? (p[2] - a) / (b - a) : 0.5; }
    // the edge: a sharp turn where the welded neighbours' centroid lies behind the corner (convex; a crease's valley is
    // the occlusion's)
    if (nbr[W].size) {
      let cx = 0, cy = 0, cz = 0; for (const j of nbr[W]) { const r = pos[j]; cx += r[0]; cy += r[1]; cz += r[2]; }
      const m = nbr[W].size, d = [cx / m - p[0], cy / m - p[1], cz / m - p[2]];
      wEdge[W] = dot(d, n) < 0 ? smooth(cosLo, cosHi, turn[W]) : 0;
    }
    // the occlusion: every emitter in reach, in front of the corner and facing it (Bunnell's disk-to-point, faded to
    // nothing at the reach so no ring shows where it ends)
    const i0 = cell(p[0]), j0 = cell(p[1]), k0 = cell(p[2]); let s = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
      const L = grid.get(key(i0 + di, j0 + dj, k0 + dk)); if (!L) continue;
      for (const fi of L) {
        const c = C[fi], v = [c[0] - p[0], c[1] - p[1], c[2] - p[2]], d2 = dot(v, v);
        if (d2 >= R2 || d2 < 1e-12) continue;
        const d = Math.sqrt(d2), ux = v[0] / d, uy = v[1] / d, uz = v[2] / d;
        const front = n[0] * ux + n[1] * uy + n[2] * uz; if (front <= 0.02) continue;
        const face = -(N[fi][0] * ux + N[fi][1] * uy + N[fi][2] * uz); if (face <= 0) continue;
        const fade = 1 - d / R;
        s += (A[fi] * front * face / (Math.PI * d2 + A[fi])) * fade * fade;
      }
    }
    wOcc[W] = Math.min(1, s * OCCLUSION_GAIN);
  }
  const by = (arr) => Float64Array.from(wid, (w) => arr[w]);
  return { sky: by(wSky), occlusion: by(wOcc), edge: by(wEdge), height: by(wH), rise: by(wRise) };
}

// ─── the finish ───
const ramp = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; return ya + (yb - ya) * (x - a) / (b - a); }
  return pts[pts.length - 1][1];
};
const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** One corner's multiplier under finish `F` at strength `s`: the sky's ramp, lifted at an edge, darkened by occlusion and
 * toward the foot; the lifts and the occlusion lean toward the finish's tint. */
export function finishColour(F, ch, s = 1) {
  const sky = ramp(F.sky ?? FINISHES.matte.sky, ch.sky), lift = (F.edge ?? 0) * ch.edge, occ = (F.occlusion ?? 0) * ch.occlusion;
  const foot = (1 - (F.height ?? 0) * (1 - ch.height) * (1 - ch.height)) * (1 + (F.rise ?? 0) * (ch.rise - 0.5)), T = F.tint ?? [1, 1, 1];
  return [0, 1, 2].map((c) => {
    const up = Math.max(0, sky - 1) * T[c] + Math.min(0, sky - 1), m = (1 + up + lift * 0.6 * T[c]) * (1 - occ * (1 - 0.35 * (1 - T[c]))) * foot;
    return r4(Math.max(0, Math.min(1.6, 1 + s * (m - 1))));
  });
}

/** Per face of `mesh`, its three corners' [r, g, b] multipliers under `bake` (the face-tint shape: the World faces and the
 * rig pack carry it), or null for no bake. `glows`: the emissive groups, left untouched. */
export function bakeTint(mesh, bake, { glows = [] } = {}) {
  const B = resolveBake(bake); if (!B) return null;
  const ch = bakeChannels(mesh), lit = new Set(glows), fin = new Map();
  return mesh.faces.map((t, fi) => {
    const g = mesh.groups[fi]; if (lit.has(g)) return null;
    let F = fin.get(g); if (!F) fin.set(g, F = finishFor(g, B));
    return t.map((vi) => finishColour(F, { sky: ch.sky[vi], occlusion: ch.occlusion[vi], edge: ch.edge[vi], height: ch.height[vi], rise: ch.rise[vi] }, B.strength));
  });
}

/** Two tints (either may be null, or hold null faces) as one: corner by corner, channel by channel, the product. */
export function stackTints(a, b) {
  if (!a) return b ?? null; if (!b) return a;
  return a.map((ta, fi) => { const tb = b[fi]; if (!ta) return tb ?? null; if (!tb) return ta; return ta.map((c, k) => c.map((x, j) => r4(x * tb[k][j]))); });
}

/** The readout: each group's finish (a word, or 'inline'), and the occlusion's reach in metres. */
export function bakeReadout(mesh, bake) {
  const B = resolveBake(bake); if (!B) return null;
  const groups = {}; for (const g of new Set(mesh.groups)) { const own = B.finish[g] ?? B.finish['*']; groups[g] = own !== undefined ? (typeof own === 'string' ? own : 'inline') : (FINISH_BY_GROUP.find(([re]) => re.test(g))?.[1] ?? 'matte'); }
  let lo = Infinity, hi = -Infinity; for (const v of mesh.vertices) { if (v[2] < lo) lo = v[2]; if (v[2] > hi) hi = v[2]; }
  return { strength: B.strength, finish: groups, reach: r4(OCCLUSION_REACH * (hi - lo)) };
}
