/**
 * CLOTH RELIEF — the realistic hero's clothes as material for an engine that lights them (realistic laws 12): each
 * garment's tube unrolled onto a CLOTH PAGE of its skin's atlas (dermal-hero.js heroSkinPaint), its relief baked there as
 * a height (the creases where its body bends, its seams, its hems, the cloth's grain), and every texel's roughness,
 * metalness and occlusion its cloth's; read into the figure's normal map beside the head's (dermal-relief.js heroRelief)
 * and an ORM map (glTF's occlusion and metallicRoughness: scene-gltf.js), so a leather jacket shines satin over its
 * creases, a wool suit is dull, a buckle is metal.
 *
 *   clothOnRecord(hero)              a hero whose lit skinned export carries it: the realistic form minted under laws 12
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
 *   clothMaps(bake, page)            → { normal (RGB8, tangent space, +Y up the image), orm (RGB8) }
 *
 * The relief is a height over the unrolled tube, so the map's tangent space is the tube's own: x round it, y along it,
 * the UVs a face's corners take its basis from (normal-bake.js meshTangents). Pure and deterministic: the dice are seeded
 * by the part's name (city/plan/dice.js), the transcendental math dmath's.
 */
import { streamOf, strHash } from '../city/plan/dice.js';
import { exp, cos } from '../../util/dmath.js';

/** the realistic laws a hero's cloth relief is minted under (layered.js REALISTIC_LAWS_VERSION) */
export const CLOTH_LAWS = 12;
/** the cloth page: a texel (m) at the relief's full size (the head's page 512 across: RELIEF_SIZE.L2), the gutter about an
 * island and a swatch's side (texels) */
export const CLOTH_PAGE = Object.freeze({ texel: 0.002, gutter: 4, swatch: 8 });
/** the skin's roughness on the ORM (the lit export's own: scene-gltf.js litRoughness, its default), which the material's
 * factor scales the map back to */
export const SKIN_ROUGH = 0.85;
/** the narrowest a feature is laid (texels) */
const TEXEL_MIN = 1.5;

/**
 * THE CLOTHS: each its roughness and metalness, its CREASE (where it bends: `amp` m deep, `w` m wide, `n` of them over
 * `spread` m either side of the joint, each across `arc` of the turn), its GRAIN (value noise: [cell m, amp m] layers),
 * its SEAM's depth (a share of the seam's own), `polish` (roughness its crests lose), `rib` (a knit rib's pitch and
 * depth, m) and `wear` (leather's: the short creases it takes everywhere it is worn, one a `cell` m square, `amp` deep,
 * `len` long). A cloth with no crease is a swatch's (hard goods). Every feature is at least TEXEL_MIN texels wide on the
 * page it is baked on (a crease finer than a texel aliases to nothing at a lower rung) and a grain finer than two
 * texels is left off.
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
  rib: { rough: 0.9, metal: 0, crease: { amp: 0.0012, w: 0.008, n: 2, spread: 0.05, arc: 0.3 }, grain: [], seam: 0.5, polish: 0, rib: [0.006, 0.0005] },
  silk: { rough: 0.34, metal: 0, crease: { amp: 0.0018, w: 0.006, n: 3, spread: 0.05, arc: 0.3 }, grain: [], seam: 0.5, polish: 0.04 },
  rubber: { rough: 0.9, metal: 0 },
  horn: { rough: 0.4, metal: 0 },
  steel: { rough: 0.3, metal: 1 },
  brass: { rough: 0.35, metal: 1 },
});

/** a group's cloth where neither the part nor the outfit's language names one */
const GROUP_CLOTH = Object.freeze({ Shoes: 'leather', Leather: 'leather', Strap: 'leather', Sole: 'rubber', Buckle: 'steel', Brass: 'brass', Button: 'horn', Tie: 'silk', Rib: 'rib', Trim: 'rib' });

/** a hero record whose lit skinned export carries its cloth's relief: the realistic form minted under realistic laws 12 */
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
  if (group === 'Bottom') return knit(L?.bottom) ? 'jersey' : L?.bottom?.kind === 'skirt' ? 'wool' : 'twill';
  return knit(L?.top) ? 'jersey' : 'cotton';
}

const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** the parts the realistic body wears and charts (the body's and the head's own parts are the skin's) */
const SKIN_PART = /^(torso|neck|pelvis|upperArm[RL]|foreArm[RL]|hand[RL]|thumb[RL]|index[RL]|middle[RL]|ring[RL]|little[RL]|thigh[RL]|shank[RL]|foot[RL]|toes[RL]|cranium|jaw|visage|nose|eye[RL]|ear[RL]|headSkin|jewel\w*|hair\w*|globe[RL]|mouth)$/;

/**
 * The tube `P` UNROLLED: each station's distance along it (its middles' path, m) and each slot's round its ring (the
 * chords' path from the back slot, m), its ring's turn (m, the closing chord in it). → { along, around, turn, width,
 * length, back }
 */
function unroll(P) {
  const n = P.slots.length, back = Math.floor(n / 2), along = [0], around = [], turn = [];
  const C = P.stations.map((st) => mean(Object.values(st.points)));
  for (let i = 1; i < C.length; i++) along.push(along[i - 1] + dist(C[i], C[i - 1]));
  let width = 0;
  for (const st of P.stations) {
    const a = new Array(n); let s = 0;
    for (let j = 0; j < n; j++) { const k = (back + j) % n; if (j) s += dist(st.points[P.slots[k]], st.points[P.slots[(k - 1 + n) % n]]); a[k] = s; }
    const T = s + dist(st.points[P.slots[(back + n - 1) % n]], st.points[P.slots[back]]);
    around.push(a); turn.push(T); width = Math.max(width, T + 0.02);
  }
  return { along, around, turn, width, length: along[along.length - 1], back, C };
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
    const tube = P.garment && Array.isArray(P.stations) && P.stations.length >= 3 && P.slots?.length >= 8 && CLOTHS[clothOf(P.group, P, language)].crease;
    if (tube) {
      let I = byPart.get(name);
      if (I === undefined) {
        const U = unroll(P), ids = new Map(P.stations.map((st, i) => [st.id, i])), slots = new Map(P.slots.map((sl, k) => [sl, k]));
        I = islands.length; byPart.set(name, I);
        islands.push({ part: name, cloth: clothOf(P.group, P, language), ...U, ids, slots });
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
    const k = Math.max(1, Math.ceil((isl.width / texel + 2 * gutter) / width)), w = Math.ceil(isl.width / (texel * k)) + 2 * gutter, h = Math.ceil(isl.length / (texel * k)) + 2 * gutter;
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
  return { W: width, H, texel, gutter, swatch, place, swatches: sw, faceUV };
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
      if (db !== 0 && dt / db >= 0 && dt / db < 1) { const u0 = isl.around[i][k], u1 = j === n - 1 ? isl.turn[i] : isl.around[i][k2]; return (u0 + (u1 - u0) * (dt / db)) / isl.turn[i]; }
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
    const seams = seamsOf(isl, P), seamAt = (seam, i, f) => seam[i] + wrapF(seam[Math.min(last, i + 1)] - seam[i]) * f;
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
      for (const e of [0.022, isl.length - 0.022]) { const d = s - e; if (Math.abs(d) < 4 * hg) h -= C.seam * 0.0006 * exp(-((d / hg) ** 2)); }
      // WEAR: each nearby cell's crease, a valley across its short line, tapering to its ends
      if (wear.length) { const a = Math.floor(s / C.wear.cell), b0 = Math.floor(u / C.wear.cell), nu = Math.ceil(isl.width / C.wear.cell);
        for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const c = wear[(a + da) * nu + (b0 + db)]; if (!c || a + da < 0 || b0 + db < 0 || b0 + db >= nu) continue;
          const du = u - c.u, ds = s - c.s, along = du * c.cx + ds * c.sx, across = -du * c.sx + ds * c.cx; if (Math.abs(along) >= c.half) continue;
          const d = across / w; if (Math.abs(d) > 5) continue; h -= c.amp * cos((Math.PI / 2) * (along / c.half)) ** 2 * exp(-d * d); } }
      // GRAIN: the cloth's own noise, layer by layer; a knit's RIB down the tube
      for (const [cell, a] of grain) h += a * noise(seed + Math.round(cell * 1e4), u / cell, s / cell);
      if (C.rib && C.rib[0] >= 2 * t) h += C.rib[1] * cos((2 * Math.PI * u) / C.rib[0]);
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

/** The bake read into its NORMAL map (tangent space: x round the tube, y up the image; each island's slope within it, a
 * swatch flat) and its ORM (occlusion, roughness, metalness). */
export function clothMaps(bake, page) {
  const { W, H, height } = bake, normal = new Uint8Array(W * H * 3), orm = new Uint8Array(W * H * 3);
  for (let q = 0; q < W * H; q++) { normal[q * 3] = 128; normal[q * 3 + 1] = 128; normal[q * 3 + 2] = 255; }
  page.place.forEach((p) => {
    const t = page.texel * p.k, at = (x, y) => height[(p.y + Math.min(p.h - 1, Math.max(0, y))) * W + p.x + Math.min(p.w - 1, Math.max(0, x))];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) / (2 * t), dy = (at(x, y + 1) - at(x, y - 1)) / (2 * t), l = Math.sqrt(dx * dx + dy * dy + 1), q = (p.y + y) * W + p.x + x;
      // (+Y up the image: the height's slope up the page is −dy)
      normal[q * 3] = byte(0.5 - (0.5 * dx) / l); normal[q * 3 + 1] = byte(0.5 + (0.5 * dy) / l); normal[q * 3 + 2] = byte(0.5 + 0.5 / l);
    }
  });
  for (let q = 0; q < W * H; q++) { orm[q * 3] = byte(bake.occlusion[q]); orm[q * 3 + 1] = byte(bake.rough[q]); orm[q * 3 + 2] = bake.metal[q]; }
  return { normal, orm };
}
