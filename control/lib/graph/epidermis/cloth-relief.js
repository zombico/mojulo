/**
 * CLOTH RELIEF — the realistic hero's clothes as material for an engine that lights them (realistic laws 13): each
 * garment's tube unrolled onto a CLOTH PAGE of its skin's atlas (dermal-hero.js heroSkinPaint), its relief baked there as
 * a height (the creases where its body bends, its seams, its hems, the cloth's grain), and every texel's roughness,
 * metalness and occlusion its cloth's; read into the figure's normal map beside the head's (dermal-relief.js heroRelief)
 * and an ORM map (glTF's occlusion and metallicRoughness: scene-gltf.js), so a leather jacket shines satin over its
 * creases, a wool suit is dull, a buckle is metal.
 *
 *   clothOnRecord(hero)              a hero whose lit skinned export carries it: the realistic form minted under laws 13
 *   clothOf(group, P, language)      the cloth a face of `group` on part `P` is (CLOTHS' keys): the part's own word (an
 *                                    outer's `cloth`), else read off the outfit's language by its layer, else by group
 *   clothChart(mesh, recipe, { language })  → { islands, faceOf(fi) → { island, uv: [[u, s] × 3] (m) } | { swatch } | null,
 *                                    swatches }: each garment tube's faces unrolled (around × along, in metres, round
 *                                    from its back so the wrap is out of sight), the rest of the clothes' faces each on
 *                                    its cloth's SWATCH (a flat patch carrying only the cloth's ORM: a sole, a button,
 *                                    a buckle, a tie, a belt)
 *   clothPage(chart, { width, texel }) → the islands and swatches packed into a page `width` texels wide, a texel
 *                                    `texel` m: { W, H, faceUV(fi) → three corners in the page's texels, place }
 *   clothBake(chart, page, recipe)   → { height (m), rough, metal, occlusion }: per texel of the page
 *   clothMaps(bake, page)            → { normal (RGB8, tangent space, +Y up the image), orm (RGB8), depth (RGB8 grey: the
 *                                    parallax's, white the surface, black CLOTH_DEPTH under it) }
 *
 * The relief is a height over the unrolled tube, so the map's tangent space is the tube's own: x round it, y along it,
 * the UVs a face's corners take its basis from (normal-bake.js meshTangents). Pure and deterministic: the dice are seeded
 * by the part's name (city/plan/dice.js), the transcendental math dmath's.
 */
import { streamOf, strHash } from '../city/plan/dice.js';
import { exp, cos, sin } from '../../util/dmath.js';

/** the realistic laws a hero's cloth relief is minted under (layered.js REALISTIC_LAWS_VERSION) */
export const CLOTH_LAWS = 13;
/** the cloth page: a texel (m) at the relief's full size (the head's page 512 across: RELIEF_SIZE.L2), the gutter about an
 * island and a swatch's side (texels) */
export const CLOTH_PAGE = Object.freeze({ texel: 0.002, gutter: 4, swatch: 8 });
/** the skin's roughness on the ORM (the lit export's own: scene-gltf.js litRoughness, its default), which the material's
 * factor scales the map back to */
export const SKIN_ROUGH = 0.85;
/** the narrowest a feature is laid (texels) */
const TEXEL_MIN = 1.5;
/** the PARALLAX's depth map: black this far (m) under the cloth's surface, white the surface itself (and every texel no
 * cloth's: the skin, a swatch, so nothing else shifts) */
export const CLOTH_DEPTH = 0.01;

/**
 * THE CLOTHS: each its roughness and metalness, its CREASE (where it bends: `amp` m deep, `w` m wide, `n` of them over
 * `spread` m either side of the joint, each across `arc` of the turn), its GRAIN (value noise: [cell m, amp m] layers),
 * its SEAM's depth (a share of the seam's own), `polish` (roughness its crests lose), `rib` (a knit rib's pitch and
 * depth, m) and `wear` (leather's: the short creases it takes everywhere it is worn, one a `cell` m square, `amp` deep,
 * `len` long), `knit` (a sweater's stockinette: its stitches a `wale` m across, a `course` m along, each a V of two legs
 * of round yarn `yarn` m proud, a ply's twist every `ply` m along a leg), `cable` (ropes down a knit: one a panel of
 * `width` m every `every` m round, its two strands of `strand` m crossing every half `period` m, `rope` m proud, a purl
 * channel `channel` m wide either side) and `fine` (a share of the page's texel the cloth is baked at: a stitch needs
 * texels to read as a V). A cloth with no crease is a swatch's (hard goods). Every feature is at least TEXEL_MIN texels
 * wide on the page it is baked on (a crease finer than a texel aliases to nothing at a lower rung) and a grain finer than
 * two texels is left off.
 */
export const CLOTHS = Object.freeze({
  leather: { rough: 0.5, metal: 0, crease: { amp: 0.0045, w: 0.0045, n: 8, spread: 0.08, arc: 0.36 }, grain: [[0.004, 0.00012], [0.016, 0.0002]], seam: 1, polish: 0.14, wear: { cell: 0.07, amp: 0.0026, len: [0.03, 0.07] } },
  wool: { rough: 0.92, metal: 0, crease: { amp: 0.004, w: 0.009, n: 4, spread: 0.08, arc: 0.3 }, grain: [[0.006, 0.00004]], seam: 0.8, polish: 0 },
  twill: { rough: 0.86, metal: 0, crease: { amp: 0.0038, w: 0.0065, n: 5, spread: 0.08, arc: 0.32 }, grain: [[0.005, 0.00004]], seam: 0.9, polish: 0 },
  denim: { rough: 0.86, metal: 0, crease: { amp: 0.0042, w: 0.005, n: 6, spread: 0.08, arc: 0.34 }, grain: [[0.005, 0.00006]], seam: 1, polish: 0 },
  cotton: { rough: 0.78, metal: 0, crease: { amp: 0.0035, w: 0.007, n: 5, spread: 0.07, arc: 0.32 }, grain: [[0.005, 0.00003]], seam: 0.8, polish: 0 },
  canvas: { rough: 0.88, metal: 0, crease: { amp: 0.0045, w: 0.008, n: 4, spread: 0.08, arc: 0.3 }, grain: [[0.005, 0.00006]], seam: 1, polish: 0 },
  nylon: { rough: 0.42, metal: 0, crease: { amp: 0.0036, w: 0.006, n: 6, spread: 0.08, arc: 0.36 }, grain: [], seam: 0.9, polish: 0.06 },
  jersey: { rough: 0.88, metal: 0, crease: { amp: 0.0024, w: 0.01, n: 3, spread: 0.07, arc: 0.3 }, grain: [[0.006, 0.00003]], seam: 0.6, polish: 0 },
  rib: { rough: 0.9, metal: 0, crease: { amp: 0.0012, w: 0.008, n: 2, spread: 0.05, arc: 0.3 }, grain: [], seam: 0.5, polish: 0, rib: [0.008, 0.0012], fine: 0.5 },
  knit: { rough: 0.95, metal: 0, crease: { amp: 0.0025, w: 0.012, n: 3, spread: 0.07, arc: 0.3 }, grain: [], seam: 0.4, polish: 0, fine: 0.5, knit: { wale: 0.0065, course: 0.005, yarn: 0.0019, ply: 0.0018 } },
  cable: { rough: 0.95, metal: 0, crease: { amp: 0.0025, w: 0.012, n: 3, spread: 0.07, arc: 0.3 }, grain: [], seam: 0.4, polish: 0, fine: 0.5, knit: { wale: 0.006, course: 0.0045, yarn: 0.0018, ply: 0.0018 }, cable: { every: 0.085, width: 0.034, period: 0.064, strand: 0.0075, rope: 0.0035, channel: 0.008 } },
  silk: { rough: 0.34, metal: 0, crease: { amp: 0.0018, w: 0.006, n: 3, spread: 0.05, arc: 0.3 }, grain: [], seam: 0.5, polish: 0.04 },
  rubber: { rough: 0.9, metal: 0 },
  horn: { rough: 0.4, metal: 0 },
  steel: { rough: 0.3, metal: 1 },
  brass: { rough: 0.35, metal: 1 },
});

/** a group's cloth where neither the part nor the outfit's language names one */
const GROUP_CLOTH = Object.freeze({ Shoes: 'leather', Leather: 'leather', Strap: 'leather', Sole: 'rubber', Buckle: 'steel', Brass: 'brass', Button: 'horn', Tie: 'silk', Rib: 'rib', Trim: 'rib' });

/** a hero record whose lit skinned export carries its cloth's relief: the realistic form minted under realistic laws 13 */
export function clothOnRecord(hero) {
  if (!hero || hero.form !== 'realistic') return false;
  const laws = hero.physique && typeof hero.physique === 'object' ? hero.physique.laws : undefined;
  return (laws ?? 1) >= CLOTH_LAWS;
}

/** The cloth a face of `group` on the part `P` is (see the head of the file); `L` the outfit's language (or null). */
export function clothOf(group, P = null, L = null) {
  if (GROUP_CLOTH[group]) return GROUP_CLOTH[group];
  if (P?.cloth && CLOTHS[P.cloth]) return P.cloth;
  const knit = (layer) => layer && typeof layer === 'object' && layer.family === 'knit';
  if (group === 'Outer' || group === 'Lapel') return L?.outer?.cloth && CLOTHS[L.outer.cloth] ? L.outer.cloth : knit(L?.outer) ? 'jersey' : 'wool';
  if (group === 'Waistcoat') return L?.waistcoat?.cloth && CLOTHS[L.waistcoat.cloth] ? L.waistcoat.cloth : L?.outer?.cloth && CLOTHS[L.outer.cloth] ? L.outer.cloth : 'wool';
  if (group === 'Bottom') return L?.bottom?.cloth && CLOTHS[L.bottom.cloth] ? L.bottom.cloth : knit(L?.bottom) ? 'jersey' : L?.bottom?.kind === 'skirt' ? 'wool' : 'twill';
  return L?.top?.cloth && CLOTHS[L.top.cloth] ? L.top.cloth : knit(L?.top) ? 'jersey' : 'cotton';
}

/**
 * THE PATTERNS a layer may be woven or worked in (its `pattern`: a name, or { kind, scale?, contrast? }), each laid on its
 * cloth's island round and along the tube (a stripe runs down it): its RELIEF (≤ 0, into the normal map and the
 * parallax's depth) and its COLOUR, a grey the base colour's page multiplies the cloth's own by (a motif can only darken
 * the cloth it is worked into: the ground is the palette's). A colour weave is made as it is woven: warp and weft each
 * coloured by its order, the 2/2 twill showing the one or the other (houndstooth, a plaid's sett); a stripe in the ground's
 * darker cloth (pinstripe); a structure in the cloth's own (herringbone's twill reversing band by band, corduroy's wales,
 * a quilt's stitched diamonds, a waffle's cells, a tweed's flecks). Sizes in metres at scale 1.
 */
export const PATTERNS = Object.freeze({
  herringbone: { band: 0.012, pitch: 0.003, depth: 0.0007, shade: 0.14 },
  houndstooth: { check: 0.008, depth: 0.0003, dark: 0.7 },
  plaid: { sett: [0.012, 0.003, 0.012, 0.003, 0.03, 0.006], depth: 0.0003, dark: 0.45 },
  gingham: { check: 0.008, dark: 0.45 },
  pinstripe: { every: 0.012, line: 0.0008, ground: 0.2 },
  chalkstripe: { every: 0.016, line: 0.0025, ground: 0.16 },
  corduroy: { wale: 0.0035, depth: 0.0013 },
  quilted: { cell: 0.06, depth: 0.009, seam: 0.0015 },
  waffle: { cell: 0.007, depth: 0.001 },
  tweed: { fleck: 0.0025, dark: 0.4, depth: 0.0003 },
});

/** The pattern a face of `group` is worked in (its layer's `pattern`), null for none: { kind, scale, contrast }. */
export function patternOf(group, L = null) {
  const layer = group === 'Outer' || group === 'Lapel' ? L?.outer : group === 'Waistcoat' ? L?.waistcoat ?? L?.outer : group === 'Bottom' ? L?.bottom : group === 'Top' || group === 'Collar' ? L?.top : null;
  const w = layer && typeof layer === 'object' ? layer.pattern : null, o = typeof w === 'string' ? { kind: w } : w && typeof w === 'object' ? w : null;
  return o && PATTERNS[o.kind] ? { kind: o.kind, scale: Number.isFinite(o.scale) && o.scale > 0 ? o.scale : 1, contrast: Number.isFinite(o.contrast) ? Math.max(0, Math.min(1.5, o.contrast)) : 1 } : null;
}

const frac = (x) => x - Math.floor(x);
/** a 2/2 twill's ridges (≤ 0) at a pitch, slanting one way (dir 1) or the other */
const twill = (u, s, pitch, dir, depth) => (depth * (cos((2 * Math.PI * (u + dir * s)) / pitch) - 1)) / 2;
/** a thread's colour by its place in a sett ([widths], each band's darkness alternating light, dark, mid …) */
const settAt = (sett, x) => { const T = sett.reduce((a, b) => a + b, 0); let r = frac(x / T) * T, i = 0; while (i < sett.length - 1 && r >= sett[i]) r -= sett[i++]; return [0, 1, 0.5][i % 3]; };

/** A pattern's relief (m, ≤ 0) and its colour (the multiplier) at (u round, s along) m, the texel `t` m (a relief finer
 * than two texels left to the colour), the colour's pixel `pw` m (a stripe drawn by how much of the pixel it covers, and
 * never finer than a pixel and a fifth). */
export function patternAt(pat, u, s, t = 0, pw = 0) {
  const P = PATTERNS[pat.kind], k = pat.scale, c = pat.contrast, x = u / k, y = s / k;
  switch (pat.kind) {
    case 'herringbone': { const b = Math.floor(x / P.band), dir = b % 2 ? 1 : -1, w = cos((2 * Math.PI * (x + dir * y)) / P.pitch);
      const edge = Math.abs(frac(x / P.band) - 0.5) * 2, groove = edge > 0.9 ? -P.depth * 0.6 * ((edge - 0.9) / 0.1) : 0;
      return { h: (P.pitch * k >= 2 * t ? (P.depth * (w - 1)) / 2 : 0) + groove, a: 1 - c * P.shade * (0.5 + 0.5 * w) }; }
    case 'houndstooth': case 'plaid': {
      // (the threads: a houndstooth's four light and four dark both ways, a plaid's sett; the twill shows warp or weft)
      const th = pat.kind === 'houndstooth' ? P.check / 4 : 0.0015, i = Math.floor(x / th), j = Math.floor(y / th);
      const warp = pat.kind === 'houndstooth' ? (((i % 8) + 8) % 8 < 4 ? 1 : 0) : settAt(P.sett, x), weft = pat.kind === 'houndstooth' ? (((j % 8) + 8) % 8 < 4 ? 1 : 0) : settAt(P.sett, y);
      const shown = (((i + j) % 4) + 4) % 4 < 2 ? warp : weft;
      return { h: th * k >= 2 * t ? twill(x, y, th * 4, 1, P.depth) : 0, a: 1 - c * P.dark * (pat.kind === 'plaid' ? (warp + weft) / 2 * 0.6 + shown * 0.4 : shown) }; }
    case 'gingham': { const a = Math.floor(x / P.check) % 2 === 0 ? 1 : 0, b = Math.floor(y / P.check) % 2 === 0 ? 1 : 0; return { h: 0, a: 1 - c * P.dark * (a + b) / 2 }; }
    // (a stripe at each period's edge: a pinstripe a hard thread, a chalkstripe a soft line)
    case 'pinstripe': case 'chalkstripe': { const d = P.every / 2 - Math.abs(frac(x / P.every) - 0.5) * P.every, lw = Math.max(P.line, (1.2 * pw) / k), pq = Math.max(1e-9, pw / k);
      const on = pat.kind === 'pinstripe' ? Math.max(0, Math.min(1, (lw / 2 - d) / pq + 0.5)) : exp(-((d / (lw / 2)) ** 2));
      return { h: 0, a: 1 - c * P.ground * (1 - on) }; }
    case 'corduroy': return { h: P.wale * k >= 2 * t ? P.depth * (Math.abs(sin((Math.PI * x) / P.wale)) - 1) : 0, a: 1 - 0.06 * c * (1 - Math.abs(sin((Math.PI * x) / P.wale))) };
    case 'quilted': { const pp = (x + y) / (P.cell * Math.SQRT2), qq = (x - y) / (P.cell * Math.SQRT2), d = Math.min(Math.abs(frac(pp) - 0.5), Math.abs(frac(qq) - 0.5));
      const e = (0.5 - d) * P.cell * Math.SQRT2 / 2, puff = Math.min(1, e / (0.3 * P.cell)); return { h: -P.depth * (1 - Math.sqrt(puff)) - (e < P.seam ? P.depth * 0.3 : 0), a: 1 - 0.1 * c * (1 - puff) }; }
    case 'waffle': { const dx = Math.abs(frac(x / P.cell) - 0.5), dy = Math.abs(frac(y / P.cell) - 0.5), m = Math.max(dx, dy); return { h: P.cell * k >= 4 * t ? -P.depth * (m < 0.36 ? 1 : Math.max(0, (0.46 - m) / 0.1)) : 0, a: 1 - 0.05 * c * (m < 0.36 ? 1 : 0) }; }
    case 'tweed': { const v = lattice(9187, Math.floor(x / P.fleck), Math.floor(y / P.fleck)), n = noise(4111, x / 0.004, y / 0.004); return { h: P.depth * (n - 1) / 2, a: 1 - c * P.dark * (v > 0.8 ? 1 : v > 0.6 ? 0.35 : 0) }; }
  }
  return { h: 0, a: 1 };
}

const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** the parts the realistic body wears and charts (the body's and the head's own parts are the skin's) */
const SKIN_PART = /^(torso|neck|pelvis|upperArm[RL]|foreArm[RL]|hand[RL]|thumb[RL]|index[RL]|middle[RL]|ring[RL]|little[RL]|thigh[RL]|shank[RL]|foot[RL]|toes[RL]|cranium|jaw|visage|nose|eye[RL]|ear[RL]|headSkin|jewel\w*|hair\w*|globe[RL]|mouth)$/;

/**
 * The tube `P` UNROLLED: each station's distance along it (its middles' path, m) and each slot's round its ring (the
 * chords' path, m, from the point of the ring facing straight back: found between its slots by angle, so a stripe at one
 * distance round runs straight down the tube however its slots shift ring to ring, an opened front's among them), its
 * ring's turn (m, the closing chord in it). → { along, around, turn, width, length, back, C }
 */
function unroll(P) {
  const n = P.slots.length, along = [0], around = [], turn = [];
  const C = P.stations.map((st) => mean(Object.values(st.points)));
  for (let i = 1; i < C.length; i++) along.push(along[i - 1] + dist(C[i], C[i - 1]));
  let width = 0, prevK = null;
  P.stations.forEach((st, i) => {
    const pt = (k) => st.points[P.slots[((k % n) + n) % n]], raw = [0];
    let step = 0;
    for (let k = 1; k <= n; k++) { const d = dist(pt(k), pt(k - 1)); raw.push(raw[k - 1] + d); step = Math.max(step, d); }
    const T = raw[n], c = C[i];
    // (the back: where the slots' turn about the middle, in the ring's own plane, passes straight back, −y across the
    // tube's axis; straight down, the sole's side, on a tube running front to back, a foot's)
    const ax = (() => { const a = C[Math.min(C.length - 1, i + 1)], b = C[Math.max(0, i - 1)], d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], l = Math.hypot(...d) || 1; return d.map((v) => v / l); })();
    const off = (v) => { const d = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2]; return [v[0] - ax[0] * d, v[1] - ax[1] * d, v[2] - ax[2] * d]; };
    let e1 = off([0, -1, 0]); if (Math.hypot(...e1) < 0.3) e1 = off([0, 0, -1]);
    const l1 = Math.hypot(...e1) || 1; e1 = e1.map((v) => v / l1);
    const e2 = [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]];
    const ang = (k) => { const v = [pt(k)[0] - c[0], pt(k)[1] - c[1], pt(k)[2] - c[2]]; return Math.atan2(v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2], v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]); }, want = 0;
    // (each place it passes the back, by its slot and its share to the next; a ring folded on itself, an opened front's
    // outer face and its inner, passes it twice: the first ring takes the outer face's, the crossing farthest from the
    // middle, and each ring after the crossing nearest the one before it by slot, so the origin runs down the tube)
    const cross = [];
    for (let k = 0; k < n; k++) {
      let a0 = ang(k) - want, a1 = ang(k + 1) - want; a0 -= 2 * Math.PI * Math.round(a0 / (2 * Math.PI)); a1 -= 2 * Math.PI * Math.round(a1 / (2 * Math.PI));
      if (!((a0 <= 0 && a1 > 0) || (a0 >= 0 && a1 < 0)) || Math.abs(a1 - a0) >= Math.PI) continue;
      const f = a0 === a1 ? 0 : a0 / (a0 - a1), p0 = pt(k), p1 = pt(k + 1);
      cross.push({ kf: k + f, o: raw[k] + (raw[k + 1] - raw[k]) * f, r: dist([p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f], c) });
    }
    const wrapK = (d) => Math.abs(d - n * Math.round(d / n));
    const pick = !cross.length ? null : prevK === null ? cross.reduce((a, b) => (b.r > a.r ? b : a)) : cross.reduce((a, b) => (wrapK(b.kf - prevK) < wrapK(a.kf - prevK) ? b : a));
    const o = pick ? pick.o : 0; if (pick) prevK = pick.kf;
    // (an island a turn and its longest step wide: a face across the back is carried a turn on)
    around.push(P.slots.map((_, k) => { const v = raw[k] - o; return v < 0 ? v + T : v; })); turn.push(T); width = Math.max(width, T + step + 0.002);
  });
  // (each slot's share of its ring's turn, and the turn, EASED along the tube: a fold the tailor laid in the rings, a
  // crescent's ridges, runs a ring's arc longer there and slid every slot past it round; a stripe kinked at each fold.
  // Twelve passes of [1, 2, 1], the ends held: the tube's own taper stays, its folds' local slides go)
  const m = around.length;
  if (m > 2) {
    const F = around.map((a, i) => a.map((u) => u / turn[i]));
    for (let k = 0; k < n; k++) for (let i = 1; i < m; i++) F[i][k] = F[i - 1][k] + wrapF(F[i][k] - F[i - 1][k]);
    let T = turn.slice();
    for (let pass = 0; pass < 12; pass++) {
      const G = F.map((r) => r.slice()), U = T.slice();
      for (let i = 1; i < m - 1; i++) { T[i] = (U[i - 1] + 2 * U[i] + U[i + 1]) / 4; for (let k = 0; k < n; k++) F[i][k] = (G[i - 1][k] + 2 * G[i][k] + G[i + 1][k]) / 4; }
    }
    for (let i = 0; i < m; i++) { turn[i] = T[i]; around[i] = F[i].map((f) => frac(f) * T[i]); }
  }
  return { along, around, turn, width, length: along[along.length - 1], back: Math.floor(n / 2), C };
}

/** The clothes' chart (see the head of the file). */
export function clothChart(mesh, recipe, { language = null } = {}) {
  const parts = recipe.parts || {}, islands = [], byPart = new Map(), swatches = [], swatchOf = new Map();
  const faces = new Map();
  const partOf = (vi) => mesh.provenance[vi].part;
  const swatch = (cloth) => { let i = swatchOf.get(cloth); if (i === undefined) { i = swatches.length; swatchOf.set(cloth, i); swatches.push({ cloth }); } return i; };
  mesh.faces.forEach((tri, fi) => {
    const name = partOf(tri[0]), P = parts[name];
    if (!P || SKIN_PART.test(name) || mesh.groups[fi] === 'Skin') return;
    const cloth = clothOf(mesh.groups[fi], P, language);
    // a GARMENT's tube (rings round it, three or more) is charted; anything else, and a cap's face, on its cloth's swatch
    // (and a soft good's ribbon, a lapel, a tie, a belt, rings of four or more round it: its cloth and its pattern, no seams)
    const tube = Array.isArray(P.stations) && P.stations.length >= 3 && P.slots?.length >= (P.garment ? 8 : 4) && CLOTHS[clothOf(P.group, P, language)].crease;
    if (tube) {
      let I = byPart.get(name);
      if (I === undefined) {
        const U = unroll(P), ids = new Map(P.stations.map((st, i) => [st.id, i])), slots = new Map(P.slots.map((sl, k) => [sl, k]));
        I = islands.length; byPart.set(name, I);
        const pattern = patternOf(P.group, language);
        islands.push({ part: name, cloth: clothOf(P.group, P, language), ...(pattern ? { pattern } : {}), ...(P.garment ? {} : { ribbon: true }), ...U, ids, slots });
      }
      const isl = islands[I], at = tri.map((vi) => { const pv = mesh.provenance[vi]; const i = isl.ids.get(pv.station), k = isl.slots.get(pv.slot); return i === undefined || k === undefined || pv.part !== name ? null : [i, k]; });
      if (at.every(Boolean)) {
        // (a face across the ring's wrap, its corners round past the turn: those short of it carried a turn on)
        let uv = at.map(([i, k]) => [isl.around[i][k], isl.along[i]]);
        if (Math.max(...uv.map((c) => c[0])) - Math.min(...uv.map((c) => c[0])) > isl.width / 2) uv = uv.map((c, j) => (c[0] < isl.turn[at[j][0]] / 2 ? [c[0] + isl.turn[at[j][0]], c[1]] : c));
        faces.set(fi, { island: I, uv });
        return;
      }
    }
    faces.set(fi, { swatch: swatch(cloth) });
  });
  return { islands, swatches, faceOf: (fi) => faces.get(fi) ?? null, faces };
}

/** The chart packed onto a page `width` texels wide, a texel `texel` m (see the head of the file): shelves, the tallest
 * island first (ties by name), the swatches in a row after. */
export function clothPage(chart, { width, texel = CLOTH_PAGE.texel, gutter = CLOTH_PAGE.gutter, swatch = CLOTH_PAGE.swatch } = {}) {
  const order = chart.islands.map((isl, i) => i).sort((a, b) => chart.islands[b].length - chart.islands[a].length || (chart.islands[a].part < chart.islands[b].part ? -1 : 1));
  const place = new Array(chart.islands.length);
  let x = 0, y = 0, row = 0;
  for (const i of order) {
    const isl = chart.islands[i];
    // (an island wider than the page laid at a coarser texel: its own `k` times the page's)
    // (a knit's island at a finer texel, its cloth's `fine`: a stitch needs texels to read)
    const fine = CLOTHS[isl.cloth]?.fine ?? 1, k = fine * Math.max(1, Math.ceil((isl.width / (texel * fine) + 2 * gutter) / width)), w = Math.ceil(isl.width / (texel * k)) + 2 * gutter, h = Math.ceil(isl.length / (texel * k)) + 2 * gutter;
    if (x + w > width) { x = 0; y += row; row = 0; }
    place[i] = { x, y, w, h, k };
    x += w; row = Math.max(row, h);
  }
  y += row;
  const sw = chart.swatches.map((_, j) => ({ x: (j * swatch) % width, y: y + Math.floor((j * swatch) / width) * swatch }));
  const H = Math.max(1, y + (chart.swatches.length ? (Math.floor(((chart.swatches.length - 1) * swatch) / width) + 1) * swatch : 0));
  const faceUV = (fi) => {
    const f = chart.faceOf(fi); if (!f) return null;
    if (f.swatch !== undefined) { const s = sw[f.swatch]; return [0, 1, 2].map(() => [s.x + swatch / 2, s.y + swatch / 2]); }
    const p = place[f.island], t = texel * p.k;
    return f.uv.map(([u, s]) => [p.x + gutter + u / t, p.y + gutter + s / t]);
  };
  // (`least` the finest texel an island is laid at, m: the parallax's metre is read at it)
  return { W: width, H, texel, gutter, swatch, place, swatches: sw, faceUV, least: texel * Math.min(1, ...place.map((p) => p.k)) };
}

// THE BAKE

/** a lattice point's value in [−1, 1] (an integer hash of its cell and the seed) */
const lattice = (seed, i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return ((h >>> 0) / 4294967296) * 2 - 1; };
/** value noise at (x, y) in cells, smoothstepped */
function noise(seed, x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = lattice(seed, i, j), b = lattice(seed, i + 1, j), c = lattice(seed, i, j + 1), d = lattice(seed, i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** a point's distance from a segment, and its share along it */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t];
}

/**
 * THE KNIT at (u round, s along) m, never above the surface (the yarn's crowns at it, the gaps between them sunk, so a
 * parallax marches into them): stockinette, its stitches in columns down the tube (a sweater's lines), each a V of two
 * legs of round yarn from its foot to the tops of its column's sides, into the stitch above, a ply's twist across each.
 */
export function knitAt(K, u, s) {
  const i = Math.floor(u / K.wale), j = Math.floor(s / K.course), r = 0.26 * K.wale;
  let best = 0;
  for (let dj = -2; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const x0 = (i + di) * K.wale, y0 = (j + dj) * K.course, fx = x0 + K.wale / 2;
    for (const tx of [x0 + 0.1 * K.wale, x0 + 0.9 * K.wale]) {
      const ty = y0 + 1.25 * K.course, [d, t] = segDist(u, s, fx, y0, tx, ty);
      if (d >= r) continue;
      const v = Math.sqrt(1 - (d / r) ** 2) * (0.85 + 0.15 * cos(2 * Math.PI * ((t * Math.hypot(tx - fx, ty - y0)) / K.ply + (0.35 * d) / r)));
      if (v > best) best = v;
    }
  }
  return K.yarn * (best - 1);
}

/**
 * A CABLE KNIT at (u, s) on a ring `T` m round: its panels spaced evenly round it (as near `every` m apart as the turn
 * allows), each two strands of yarn crossing every half `period`, the one leaving to the left over the other (a rope's
 * twist), the knit riding them; a purl channel sunk either side; null off a panel (the ground's knit).
 */
function cableAt(Cb, K, u, s, T) {
  const n = Math.max(1, Math.round(T / Cb.every)), pitch = T / n, x = u - (Math.floor(u / pitch) + 0.5) * pitch, half = Cb.width / 2;
  if (Math.abs(x) > half + Cb.channel) return null;
  if (Math.abs(x) > half) return -K.yarn * 1.6;
  const ph = (2 * Math.PI * s) / Cb.period, c = (Cb.width / 4) * sin(ph), r = Cb.strand;
  const h1 = Math.sqrt(Math.max(0, 1 - ((x - c) / r) ** 2)), h2 = Math.sqrt(Math.max(0, 1 - ((x + c) / r) ** 2));
  const [over, under] = cos(ph) < 0 ? [h1, h2] : [h2, h1], v = Math.max(over, 0.75 * under);
  return Cb.rope * (v - 1) + 0.4 * knitAt(K, u, s);
}

/** a fraction's circular distance from another, in (−0.5, 0.5] */
const wrapF = (d) => d - Math.round(d);

/** the joints a garment bends at, the tubes that cross each (`on`, by the part's name: the elbow hangs beside the waist,
 * and is no crease of the shirt's body), and the way each folds (the body at its rest: the arms down, the legs straight):
 * an elbow's crook forward, a knee's behind it, the hip's lap in front, the armpit in toward the body, the wrist's and
 * the ankle's cloth stacked round it, the ankle's break in front */
const ARM = /(arm|Arm|Sleeve|Cuff)/, LEG = /(leg|Leg|thigh|shank)/;
const BENDS = Object.freeze([
  { joint: /^elbow[RL]$/, on: ARM, toward: () => [0, 1, 0], arc: 1 },
  { joint: /^knee[RL]$/, on: LEG, toward: () => [0, -1, 0], arc: 1 },
  { joint: /^hip[RL]$/, on: /(leg|Leg|thigh|pelvis|body)/, toward: () => [0, 1, 0], arc: 0.8 },
  { joint: /^shoulder[RL]$/, on: ARM, toward: (at) => [-Math.sign(at[0]) || 0, 0, -0.6], arc: 0.7 },
  { joint: /^wrist[RL]$/, on: ARM, toward: () => [0, 1, 0], arc: 2.4, end: true },
  { joint: /^ankle[RL]$/, on: LEG, toward: () => [0, 1, 0], arc: 1.1, end: true },
]);

/** an island's SEAMS, each its fraction round each ring (where the ring faces a direction, between its slots by angle,
 * then smoothed along the tube so a seam runs straight where the slots step): a limb's inner seam (an arm's under it, a
 * leg's inseam) and a leg's outseam; a trunk's side seams, and an outer layer's centre back */
function seamsOf(isl, P) {
  const n = P.slots.length, ang = (p, c) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const facing = (st, i, d) => {
    const c = isl.C[i], t = Math.atan2(d[1], d[0]);
    // (the slots' turn about the ring's middle, walked from the back: where it passes the direction, its share between)
    for (let j = 0; j < n; j++) {
      const k = (isl.back + j) % n, k2 = (k + 1) % n, a = ang(st.points[P.slots[k]], c), b = ang(st.points[P.slots[k2]], c);
      let db = b - a; db -= 2 * Math.PI * Math.round(db / (2 * Math.PI)); let dt = t - a; dt -= 2 * Math.PI * Math.round(dt / (2 * Math.PI));
      if (db !== 0 && dt / db >= 0 && dt / db < 1) { const u0 = isl.around[i][k], u1 = isl.around[i][k2] < u0 ? isl.around[i][k2] + isl.turn[i] : isl.around[i][k2]; return ((u0 + (u1 - u0) * (dt / db)) / isl.turn[i]) % 1; }
    }
    return 0;
  };
  const limb = /(arm|leg|Arm|Leg|thigh|shank)/.test(isl.part), c0 = isl.C[Math.floor(isl.C.length / 2)], side = Math.sign(c0[0]) || 1;
  const dirs = limb ? [[-side, 0], ...(/leg|thigh|shank/i.test(isl.part) ? [[side, 0]] : [])] : [[1, 0], [-1, 0], ...(P.group === 'Outer' ? [[0, -1]] : [])];
  return dirs.map((d) => {
    const f = P.stations.map((st, i) => facing(st, i, d));
    // (unwrapped along the tube, then eased: eight passes of [1, 2, 1], the ends held)
    for (let i = 1; i < f.length; i++) f[i] = f[i - 1] + wrapF(f[i] - f[i - 1]);
    for (let pass = 0; pass < 8; pass++) { const g = f.slice(); for (let i = 1; i < f.length - 1; i++) f[i] = (g[i - 1] + 2 * g[i] + g[i + 1]) / 4; }
    return f;
  });
}

/** Each texel's height, roughness, metalness and occlusion (see the head of the file). */
export function clothBake(chart, page, recipe) {
  const { W, H } = page, height = new Float32Array(W * H), rough = new Float32Array(W * H).fill(SKIN_ROUGH), metal = new Uint8Array(W * H), occlusion = new Float32Array(W * H).fill(1);
  const joints = recipe.rig?.joints ?? {};
  chart.islands.forEach((isl, I) => {
    const P = recipe.parts[isl.part], C = CLOTHS[isl.cloth], p = page.place[I], t = page.texel * p.k, g = page.gutter, last = isl.along.length - 1;
    const seed = strHash(isl.part), dice = streamOf('cloth', 'crease', isl.part);
    // (a ring's place at a distance along: its index and share to the next)
    const ringAt = (s) => { const a = isl.along; if (s <= 0) return [0, 0]; if (s >= a[last]) return [last - 1 < 0 ? 0 : last - 1, last ? 1 : 0]; let i = 0; while (i < last - 1 && a[i + 1] < s) i++; return [i, (s - a[i]) / Math.max(1e-9, a[i + 1] - a[i])]; };
    const turnAt = (i, f) => isl.turn[i] + ((isl.turn[Math.min(last, i + 1)] ?? isl.turn[i]) - isl.turn[i]) * f;
    // THE BENDS this tube spans: the joint's nearest ring within a ring's girth and a half of it, the fraction round that
    // ring facing the way it folds, its creases laid by the dice
    const bends = [];
    for (const B of BENDS) for (const [name, J] of Object.entries(joints)) {
      if (!B.joint.test(name) || !B.on.test(isl.part)) continue;
      const at = J.at; let bi = -1, bd = Infinity;
      isl.C.forEach((c, i) => { const d = dist(c, at); if (d < bd) { bd = d; bi = i; } });
      const st = P.stations[bi], r = Object.values(st.points).reduce((m, q) => m + Math.hypot(q[0] - isl.C[bi][0], q[1] - isl.C[bi][1]), 0) / P.slots.length;
      if (!(bd < 1.5 * r + 0.02)) continue;
      const to = B.toward(at), aim = [at[0] + to[0] * 0.3, at[1] + to[1] * 0.3, at[2] + to[2] * 0.3];
      let fk = 0, fd = Infinity; P.slots.forEach((sl, k) => { const d = dist(st.points[sl], aim); if (d < fd) { fd = d; fk = k; } });
      const cr = C.crease, list = [];
      for (let c = 0; c < cr.n; c++) {
        const o = (dice() * 2 - 1) * cr.spread * (B.end ? 0.5 : 1);
        list.push({ s: isl.along[bi] + (B.end ? -Math.abs(o) - 0.02 : o), half: Math.min(0.5, cr.arc * B.arc * (0.6 + 0.4 * dice()) / 2), bow: (dice() * 2 - 1) * 0.012, amp: cr.amp * (0.6 + 0.4 * dice()) * (1 - 0.5 * Math.abs(o) / cr.spread), shift: (dice() * 2 - 1) * 0.04 });
      }
      bends.push({ f: isl.around[bi][fk] / isl.turn[bi], list });
    }
    const seams = isl.ribbon ? [] : seamsOf(isl, P), seamAt = (seam, i, f) => seam[i] + wrapF(seam[Math.min(last, i + 1)] - seam[i]) * f;
    // (each feature's width no finer than the page's texel can draw)
    const w = Math.max(C.crease.w, TEXEL_MIN * t), sg = Math.max(0.0007, TEXEL_MIN * t * 0.5), sm = Math.max(0.0016, TEXEL_MIN * t), so = sg + sm, hg = Math.max(0.0008, TEXEL_MIN * t * 0.5);
    const grain = C.grain.filter(([cell]) => cell >= 2 * t);
    // LEATHER'S WEAR: a short crease in each cell of its own square grid over the tube, its place, its tilt (mostly across
    // the tube) and its length the dice's
    const wear = [];
    if (C.wear) { const wd = streamOf('cloth', 'wear', isl.part), nu = Math.ceil(isl.width / C.wear.cell), ns = Math.ceil(isl.length / C.wear.cell);
      for (let a = 0; a < ns; a++) for (let b = 0; b < nu; b++) { const L = C.wear.len[0] + (C.wear.len[1] - C.wear.len[0]) * wd(), th = (wd() * 2 - 1) * 0.5; wear.push({ u: (b + wd()) * C.wear.cell, s: (a + wd()) * C.wear.cell, cx: Math.cos(th), sx: Math.sin(th), half: L / 2, amp: C.wear.amp * (0.4 + 0.6 * wd()) }); } }
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      // (a gutter's texel the island's edge, clamped: the slope runs on into it, so the mips draw no seam)
      const u = Math.min(isl.width, Math.max(0, (x - g + 0.5) * t)), s = Math.min(isl.length, Math.max(0, (y - g + 0.5) * t));
      const [i, fi] = ringAt(s), T = turnAt(i, fi), f = u / T;
      let h = 0;
      // CREASES: valleys with their shoulders, across the fold's side, bowed, tapering to nothing round the ring
      for (const b of bends) for (const c of b.list) {
        const df = wrapF(f - b.f - c.shift); if (Math.abs(df) >= c.half) continue;
        const d = (s - c.s - c.bow * (df / c.half) ** 2) / w; if (Math.abs(d) > 6) continue;
        h += c.amp * cos((Math.PI / 2) * (df / c.half)) ** 2 * (-exp(-d * d) + 0.45 * exp(-(d * d) / 4.84));
      }
      // SEAMS: a groove with its two margins puffed, along the tube; the HEMS: a stitched line 2.2 cm in from either end
      for (const seam of seams) { const d = wrapF(f - seamAt(seam, i, fi)) * T; if (Math.abs(d) < so + 2 * sm) h += C.seam * (-0.0008 * exp(-((d / sg) ** 2)) + 0.00045 * (exp(-(((d - so) / sm) ** 2)) + exp(-(((d + so) / sm) ** 2)))); }
      if (!isl.ribbon) for (const e of [0.022, isl.length - 0.022]) { const d = s - e; if (Math.abs(d) < 4 * hg) h -= C.seam * 0.0006 * exp(-((d / hg) ** 2)); }
      // WEAR: each nearby cell's crease, a valley across its short line, tapering to its ends
      if (wear.length) { const a = Math.floor(s / C.wear.cell), b0 = Math.floor(u / C.wear.cell), nu = Math.ceil(isl.width / C.wear.cell);
        for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const c = wear[(a + da) * nu + (b0 + db)]; if (!c || a + da < 0 || b0 + db < 0 || b0 + db >= nu) continue;
          const du = u - c.u, ds = s - c.s, along = du * c.cx + ds * c.sx, across = -du * c.sx + ds * c.cx; if (Math.abs(along) >= c.half) continue;
          const d = across / w; if (Math.abs(d) > 5) continue; h -= c.amp * cos((Math.PI / 2) * (along / c.half)) ** 2 * exp(-d * d); } }
      // GRAIN: the cloth's own noise, layer by layer; a knit's RIB down the tube
      for (const [cell, a] of grain) h += a * noise(seed + Math.round(cell * 1e4), u / cell, s / cell);
      // (a rib's raised columns at the surface, its purl between them sunk)
      if (C.rib && C.rib[0] >= 2 * t) h += (C.rib[1] * (cos((2 * Math.PI * u) / C.rib[0]) - 1)) / 2;
      // THE PATTERN it is woven or worked in: its relief (its colour is the base colour's page's: clothAlbedo)
      if (isl.pattern) h += patternAt(isl.pattern, u, s, t).h;
      // THE KNIT: its stitches, or a cable knit's ropes over them
      if (C.cable) h += cableAt(C.cable, C.knit, u, s, T) ?? knitAt(C.knit, u, s);
      else if (C.knit) h += knitAt(C.knit, u, s);
      const q = (p.y + y) * W + p.x + x;
      height[q] = h;
      // the cloth's roughness, its crests polished; its valleys the crease's shade
      rough[q] = Math.min(1, Math.max(0.05, C.rough - C.polish * Math.max(0, Math.min(1, h / (C.crease.amp * 0.45)))));
      occlusion[q] = 1 - 0.35 * Math.max(0, Math.min(1, -h / C.crease.amp));
      metal[q] = C.metal ? 255 : 0;
    }
  });
  chart.swatches.forEach((sw, j) => {
    const C = CLOTHS[sw.cloth], at = page.swatches[j];
    for (let y = 0; y < page.swatch; y++) for (let x = 0; x < page.swatch; x++) { const q = (at.y + y) * W + at.x + x; rough[q] = C.rough; metal[q] = C.metal ? 255 : 0; }
  });
  return { W, H, height, rough, metal, occlusion };
}

const byte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);

/**
 * The PATTERNS' colour on the base colour's page (heroSkinPaint's cloth rows: `px` RGBA, `W` wide, from row `row`), each
 * island's atlas pixels `1 / scale` of the page's texels across: a grey the cloth's own colour is multiplied by; white
 * where no pattern is (the page as before). In place.
 */
export function clothAlbedo(chart, page, px, { W, row, scale }) {
  chart.islands.forEach((isl, I) => {
    if (!isl.pattern) return;
    const p = page.place[I], t = page.texel * p.k, g = page.gutter, x0 = Math.floor(p.x / scale), x1 = Math.ceil((p.x + p.w) / scale), y0 = Math.floor(p.y / scale), y1 = Math.ceil((p.y + p.h) / scale);
    for (let Y = y0; Y < y1; Y++) for (let X = x0; X < Math.min(W, x1); X++) {
      const u = Math.min(isl.width, Math.max(0, ((X + 0.5) * scale - p.x - g) * t)), s = Math.min(isl.length, Math.max(0, ((Y + 0.5) * scale - p.y - g) * t));
      const v = Math.round(Math.max(0, Math.min(1, patternAt(isl.pattern, u, s, 0, t * scale).a)) * 255), q = ((row + Y) * W + X) * 4;
      px[q] = v; px[q + 1] = v; px[q + 2] = v;
    }
  });
  return px;
}

/** The bake read into its NORMAL map (tangent space: x round the tube, y up the image; each island's slope within it, a
 * swatch flat) and its ORM (occlusion, roughness, metalness). */
export function clothMaps(bake, page) {
  const { W, H, height } = bake, normal = new Uint8Array(W * H * 3), orm = new Uint8Array(W * H * 3), depth = new Uint8Array(W * H * 3).fill(255);
  for (let q = 0; q < W * H; q++) { normal[q * 3] = 128; normal[q * 3 + 1] = 128; normal[q * 3 + 2] = 255; }
  page.place.forEach((p) => {
    const t = page.texel * p.k, at = (x, y) => height[(p.y + Math.min(p.h - 1, Math.max(0, y))) * W + p.x + Math.min(p.w - 1, Math.max(0, x))];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) / (2 * t), dy = (at(x, y + 1) - at(x, y - 1)) / (2 * t), l = Math.sqrt(dx * dx + dy * dy + 1), q = (p.y + y) * W + p.x + x;
      // (+Y up the image: the height's slope up the page is −dy)
      normal[q * 3] = byte(0.5 - (0.5 * dx) / l); normal[q * 3 + 1] = byte(0.5 + (0.5 * dy) / l); normal[q * 3 + 2] = byte(0.5 + 0.5 / l);
      // (the depth under the surface: a crest stands at it, a valley sinks; in the finest island's texels, so one metre's
      // worth of UVs, the page's `least`, marches every island right)
      const v = byte(1 - Math.max(0, Math.min(1, (-height[q] / CLOTH_DEPTH) * ((page.least ?? page.texel) / t)))); depth[q * 3] = v; depth[q * 3 + 1] = v; depth[q * 3 + 2] = v;
    }
  });
  for (let q = 0; q < W * H; q++) { orm[q * 3] = byte(bake.occlusion[q]); orm[q * 3 + 1] = byte(bake.rough[q]); orm[q * 3 + 2] = bake.metal[q]; }
  return { normal, orm, depth };
}
