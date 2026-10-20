/**
 * DERMAL TEXTURE — the dermal map (dermal-map.js) laid out as the textures an engine binds: an ATLAS over a chart
 * (dermal-chart.js), whatever shape made the chart. Every part a rectangle as wide as its girth and as long as its
 * length at ONE texel density (the face weighted up: a game spends its texels where the eye goes), its seam turned to
 * the side least seen (the limbs' medial line, the trunk's and the head's back, the hand's and the foot's inner edge),
 * shelf-packed onto a square page. The channels are painted from the address alone:
 *
 *   albedo         the map's colour, with the TRICKS a realistic skin is painted with: the SCALP PAINT (the scalp in the
 *                  hair's colour under a groom, so a gap between cards reads as hair, never as skin), the beard's
 *                  STUBBLE (each follicle's dot of hair where it leaves the skin, its share of the texel by density and
 *                  length: the shadow a shaven face carries), the freckles, the mottle
 *   roughness      the sheen's map (grey: 0 glossy … 255 matte)
 *   translucency   the skin's thinness, the subsurface's mask (the ears, the nostrils, the lips, the fingers glow)
 *   hair           the terminal hair's density (grey, √ of /cm² over 200) and its FLOW (RG: the direction it lies, in the
 *                  rectangle's own u and v), what a card or shell groom combs by
 *   fuzz           the vellus's sheen (the peach-fuzz rim a shader adds: no strands)
 *   detail         which relief tile a texel wears (an index into `classes`): the detail-normal trick, a small tileable
 *                  relief (`reliefTile`, from skin-relief.js, friction ridges on glabrous skin) repeated at its true
 *                  scale and masked per kind, since no atlas holds pores at a body's size
 *
 *   layoutDermis(chart, opts)                     → { page, pageH, rects, mmPerTexel } (`page` wide, `pageH` tall)
 *   paintDermis(chart, dermis, layout, opts)      → { page, albedo (RGBA), roughness, translucency, hair (RGBA: density,
 *                                                     flow u, flow v, 255), fuzz, detail, classes, faceUV(fi) }
 *   reliefTile(relief, { size, px, seed, age })   → { px, size, height, normal (RGB), cavity }: periodic both ways
 *   dermalPngs(texture)                           → { albedo, roughness, translucency, hair, fuzz } PNG buffers
 *
 * Pure and deterministic: no dice outside the seeds, no clock. Faces whose corners lie on different parts, or off the
 * skin, take the white texel at the page's corner.
 */
import { dermisAt, hairColourOf, freckle, seedOf, toSrgb } from './dermal-map.js';
import { skinRelief } from './skin-relief.js';
import { hash3, vnoise } from '../era/dirt.js';
import { encodePng, encodePngGrey, encodePngRgba } from '../landscape/surface-textures.js';

/** where each part's ring is cut (its `around`): the side least seen */
export const DERMAL_SEAMS = Object.freeze({ head: 0.5, neck: 0.5, trunk: 0.5, pelvis: 0.5, upperArm: 0.75, forearm: 0.75, hand: 0.75, finger: 0.75, thigh: 0.75, shank: 0.75, foot: 0.75, toe: 0.75 });
const PAD = 2, WHITE = 4, STEP = 4;   // texels between rectangles; the white tile's size; the map's evaluation stride
const GRID = 12;   // the chart's girth twelfths

/** The atlas's rectangles: `page` texels square, `faceWeight` the head's texel density over the body's. */
export function layoutDermis(chart, { page = 1024, faceWeight = 2 } = {}) {
  const rects = Object.entries(chart.parts).map(([key, P]) => {
    const k = P.part === 'head' ? faceWeight : 1;
    // one ring step past the seam, for the faces that cross it
    return { key, part: P.part, side: P.side, seam: DERMAL_SEAMS[P.part] ?? 0.5, wmm: P.girth * 1000 * k, hmm: P.length * 1000 * k, extra: 0.06, density: k };
  }).sort((a, b) => b.hmm - a.hmm || (a.key < b.key ? -1 : 1));
  const pack = (mpt) => {
    let x = WHITE + PAD, y = 0, shelf = 0;
    if (rects.length && Math.ceil(rects[0].wmm * (1 + rects[0].extra) / mpt) + x + PAD > page) { x = 0; y = WHITE + PAD; }
    for (const r of rects) {
      r.w = Math.max(4, Math.ceil(r.wmm * (1 + r.extra) / mpt)); r.h = Math.max(4, Math.ceil(r.hmm / mpt));
      if (x + r.w + PAD > page) { x = 0; y += shelf + PAD; shelf = 0; }
      r.x = x; r.y = y; x += r.w + PAD; shelf = Math.max(shelf, r.h);
    }
    return y + shelf <= page && rects.every((r) => r.w <= page);
  };
  // the finest density that packs: bisect the millimetres a texel holds; the page then as tall as it needs (a power of
  // two), so a lone wide part (a head) does not leave most of a square page empty
  let lo = 0.05, hi = 50;
  for (let i = 0; i < 30; i++) { const mid = Math.sqrt(lo * hi); if (pack(mid)) hi = mid; else lo = mid; }
  // packed at full height first, then filled: a page cut to a power of two re-packs at the finest density that fits it
  pack(hi);
  const used = Math.max(...rects.map((r) => r.y + r.h)) + PAD, pageH = Math.min(page, 1 << Math.ceil(Math.log2(Math.max(8, used))));
  let mpt = hi;
  if (pageH < page) { const tall = (m) => pack(m) && Math.max(...rects.map((r) => r.y + r.h)) <= pageH; lo = 0.05; hi = mpt; for (let i = 0; i < 30; i++) { const mid = Math.sqrt(lo * hi); if (tall(mid)) hi = mid; else lo = mid; } mpt = hi; pack(mpt); }
  return { page, pageH, mmPerTexel: mpt, faceWeight, rects };
}

/** a rectangle texel's address: its u round the ring from the seam, its v down the part */
function addressAt(chart, r, u, v) {
  const P = chart.parts[r.key], around = (((u + r.seam) % 1) + 1) % 1;
  return { key: r.key, part: P.part, side: P.side, along: v, around, length: P.length, girth: P.girths[Math.min(GRID - 1, Math.floor(v * GRID))], ...(P.marks ? { marks: P.marks } : {}) };
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const byte = (x) => Math.round(clamp01(x) * 255);

/**
 * Paint the channels. `opts.scalp` true when a groom covers the scalp (its paint), false for a bare scalp (a shaven
 * shadow); `opts.scalpPaint` the paint's share (default 0.8).
 */
export function paintDermis(chart, D, layout, { scalp = true, scalpPaint = 0.8 } = {}) {
  const N = layout.page, NH = layout.pageH ?? N, albedo = new Uint8Array(N * NH * 4), rough = new Uint8Array(N * NH).fill(140), trans = new Uint8Array(N * NH);
  const hair = new Uint8Array(N * NH * 4), fuzz = new Uint8Array(N * NH), detail = new Uint8Array(N * NH);
  for (let i = 0; i < N * NH; i++) { albedo[i * 4] = albedo[i * 4 + 1] = albedo[i * 4 + 2] = albedo[i * 4 + 3] = 255; hair[i * 4 + 1] = hair[i * 4 + 2] = 128; hair[i * 4 + 3] = 255; }
  const classes = [], classOf = new Map(), hairLin = hairColourOf(D);
  const classIndex = (rel) => { if (!classOf.has(rel.class)) { classOf.set(rel.class, classes.length); classes.push({ ...rel }); } return classOf.get(rel.class); };
  for (const r of layout.rects) {
    // the map at a stride (its masks are smooth), bilinear between; the fine detail per texel
    const gw = Math.ceil(r.w / STEP) + 1, gh = Math.ceil(r.h / STEP) + 1, grid = new Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const u = Math.min(1 + r.extra, (i * STEP + 0.5) / r.w * (1 + r.extra)), v = clamp01((j * STEP + 0.5) / r.h);
      grid[j * gw + i] = dermisAt(addressAt(chart, r, u, v), D, { detail: false });
    }
    const mpt = layout.mmPerTexel / r.density;
    for (let py = 0; py < r.h; py++) for (let px = 0; px < r.w; px++) {
      const gx = px / STEP, gy = py / STEP, i0 = Math.min(gw - 2, Math.floor(gx)), j0 = Math.min(gh - 2, Math.floor(gy)), fx = gx - i0, fy = gy - j0;
      const c = [grid[j0 * gw + i0], grid[j0 * gw + i0 + 1], grid[(j0 + 1) * gw + i0], grid[(j0 + 1) * gw + i0 + 1]];
      const W = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      const lerp = (f) => W[0] * f(c[0]) + W[1] * f(c[1]) + W[2] * f(c[2]) + W[3] * f(c[3]);
      const near = c[W.indexOf(Math.max(...W))];   // the nearest sample, for what does not blend (the kind, the tract)
      const u = (px + 0.5) / r.w * (1 + r.extra), v = (py + 0.5) / r.h, A = addressAt(chart, r, u, v);
      let col = [0, 1, 2].map((k) => lerp((s) => s.albedo[k]));
      // the fine detail: freckles, the stubble's follicles, the scalp's paint
      const fm = lerp((s) => s.freckleMask);
      if (fm > 0.002) { const f = freckle(A, seedOf(A, D)) * fm; col = col.map((x, k) => x * (1 + ([0.8, 0.68, 0.56][k] - 1) * f)); }
      const scalpW = lerp((s) => s.regions.scalp || 0), beardD = lerp((s) => (s.hair.tract === 'beard' ? s.hair.density : 0));
      if (scalpW > 0.01) {
        if (scalp) col = mixc(col, hairLin.map((x) => x * 0.8), scalpPaint * scalpW);
        else col = mixc(col, hairLin, follicles(A, 200, 0.3, mpt, D.seed + 17) * scalpW * 0.6);
      }
      if (beardD > 0.5 && D.stubble > 0) col = mixc(col, hairLin, follicles(A, beardD, D.stubble, mpt, D.seed + 23));
      const o = (r.y + py) * N + r.x + px;
      for (let k = 0; k < 3; k++) albedo[o * 4 + k] = byte(toSrgb(col[k]));
      rough[o] = byte(lerp((s) => s.roughness));
      trans[o] = byte(lerp((s) => s.translucency));
      fuzz[o] = byte(lerp((s) => s.fuzz));
      const hd = near.hair.kind === 'terminal' && near.hair.tract !== 'scalp' ? lerp((s) => (s.hair.kind === 'terminal' ? s.hair.density : 0)) : near.hair.tract === 'scalp' ? 200 : 0;
      hair[o * 4] = byte(Math.sqrt(hd / 200));
      // the flow in the rectangle's own axes: u round the ring (around increasing), v down the part (along increasing)
      const th = near.hair.flow;
      hair[o * 4 + 1] = byte(0.5 + 0.5 * Math.sin(th)); hair[o * 4 + 2] = byte(0.5 + 0.5 * Math.cos(th));
      detail[o] = classIndex(near.relief);
    }
  }
  // the white tile: what no skin face samples
  for (let y = 0; y < WHITE; y++) for (let x = 0; x < WHITE; x++) { const o = y * N + x; albedo.fill(255, o * 4, o * 4 + 4); }
  const uvOf = faceUVs(chart, layout);
  return { page: N, pageH: NH, albedo, roughness: rough, translucency: trans, hair, fuzz, detail, classes, mmPerTexel: layout.mmPerTexel, faceUV: uvOf };
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The share of a texel a follicle field covers (0 … 0.9): follicles on a jittered lattice `density` per cm², each a dot
 * of hair where it leaves the skin, wider the longer the hair (a stubble's lie covers more of the skin than a shave's
 * cut), at a texel of `mpt` mm. A texel finer than the lattice draws the dots; a coarser one their expected share.
 */
function follicles(A, density, lengthMm, mpt, seed) {
  const sp = Math.sqrt(100 / Math.max(density, 0.1)), r = 0.07 + 0.09 * Math.min(lengthMm, 5);
  const expect = Math.min(0.9, (Math.PI * r * r) / (sp * sp) * (1 + 0.15 * Math.min(lengthMm, 5)));
  if (mpt > sp * 0.7) return expect * (0.85 + 0.3 * vnoise(A.around * A.girth * 1000 / 3, A.along * A.length * 1000 / 3, seed));
  // (a dot finer than the texel covers its area's share of it, never the whole texel: a stubble is a shadow of dots)
  const G = A.girth * 1000, x = A.around * G / sp, y = A.along * A.length * 1000 / sp, share = Math.min(1, (Math.PI * r * r) / (mpt * mpt));
  let cov = 0;
  for (let j = Math.floor(y) - 1; j <= Math.floor(y) + 1; j++) for (let i = Math.floor(x) - 1; i <= Math.floor(x) + 1; i++) {
    const cx = i + 0.15 + 0.7 * hash3(i, j, seed), cy = j + 0.15 + 0.7 * hash3(j, i, seed + 1);
    // a hair lies along its flow: its dot drawn out down the part a little
    const d = Math.hypot(x - cx, (y - cy) * 0.6) * sp;
    cov = Math.max(cov, share * clamp01((r + 0.5 * mpt - d) / (0.5 * mpt)));
  }
  return Math.min(0.9, cov);
}

/**
 * Each face's three UVs on the page (null off the skin: the white texel). A face crossing its rectangle's seam takes its
 * low corners a turn on (the rectangle's extra column); a cap's apex (where `around` means nothing) takes its
 * neighbours' mean.
 */
export function faceUVs(chart, layout) {
  const N = layout.page, NH = layout.pageH ?? N, byKey = new Map(layout.rects.map((r) => [r.key, r])), white = [(WHITE / 2) / N, 1 - (WHITE / 2) / NH];
  const out = chart.faces.map((tri) => {
    const s = tri.map((vi) => chart.samples[vi]);
    if (s.some((x) => !x) || s.some((x) => x.key !== s[0].key)) return null;
    const r = byKey.get(s[0].key); if (!r) return null;
    let us = s.map((x) => (((x.around - r.seam) % 1) + 1) % 1);
    if (Math.max(...us) - Math.min(...us) > 0.5) us = us.map((u) => (u < 0.5 ? u + 1 : u));
    // a cap's apex: its around is arbitrary; it takes the other two corners' mean
    us = us.map((u, k) => { const o = us.filter((_, q) => q !== k), m = (o[0] + o[1]) / 2; return (s[k].along < 0.015 || s[k].along > 0.985) && Math.abs(u - m) > 0.2 ? m : u; });
    return us.map((u, k) => [(r.x + (u / (1 + r.extra)) * r.w) / N, 1 - (r.y + s[k].along * r.h) / NH]);
  });
  return (fi) => out[fi] || [white, white, white];
}

/**
 * A tileable RELIEF tile: skin-relief.js's keratin, pores and grain (or, on glabrous skin, friction ridges) over a
 * `size` mm window at `px` texels, made periodic by blending the window with its three shifts and restoring the
 * variance the blend loses (a plain blend halves the contrast in the middle: a tile that reads flat where it repeats).
 * Returns heights (0 … 255, 128 the skin), a tangent-space normal map (RGB) and a cavity (the grooves' shadow).
 */
export function reliefTile(relief, { size = 12, px = 256, seed = 1, age = 0.35, strength = 1 } = {}) {
  const ridges = relief.ridges > 0;
  const R = ridges ? null : skinRelief({ region: { angle: 0, ...relief }, fidelity: 'micro', age, seed });
  const H = (x, y) => {
    if (!ridges) { const s = R.at(x, y); return [s.h, s.cavity]; }
    // friction ridges: parallel crests `ridges` mm apart along the tension, wandering, with seeded endings (a ridge's
    // phase steps where a minutia sits); pores on the crests
    const warp = 1.4 * (vnoise(x / 6, y / 6, seed) - 0.5) + 0.4 * (vnoise(x / 1.7, y / 1.7, seed + 2) - 0.5);
    const q = (y + warp) / relief.ridges, k = Math.floor(q), step = hash3(k, Math.floor(x / 2.5), seed + 4) < 0.08 ? 0.5 : 0;
    const crest = 0.5 + 0.5 * Math.cos(2 * Math.PI * (q + step)), pore = hash3(Math.floor(x / 0.45), k, seed + 6) < 0.25 ? Math.max(0, 1 - Math.hypot((x % 0.45) - 0.22, ((q % 1) - 0.5) * relief.ridges) / 0.06) : 0;
    const h = (crest - 0.5) * relief.furrow * 0.001 - pore * 0.02;
    return [h, (1 - crest) * 0.5 + pore * 0.4];
  };
  const S = size, n = px, hgt = new Float64Array(n * n), cav = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i / n) * S, y = (j / n) * S, wx = x / S, wy = y / S;
    const w = [(1 - wx) * (1 - wy), wx * (1 - wy), (1 - wx) * wy, wx * wy], norm = Math.sqrt(w.reduce((a, b) => a + b * b, 0));
    const s = [H(x, y), H(x - S, y), H(x, y - S), H(x - S, y - S)];
    hgt[j * n + i] = (w[0] * s[0][0] + w[1] * s[1][0] + w[2] * s[2][0] + w[3] * s[3][0]) / norm;
    cav[j * n + i] = (w[0] * s[0][1] + w[1] * s[1][1] + w[2] * s[2][1] + w[3] * s[3][1]) / norm;
  }
  let mean = 0; for (const h of hgt) mean += h; mean /= n * n;
  let dev = 0; for (const h of hgt) dev = Math.max(dev, Math.abs(h - mean)); dev = dev || 1;
  const height = new Uint8Array(n * n), normal = new Uint8Array(n * n * 3), cavity = new Uint8Array(n * n);
  const mpp = S / n, at = (i, j) => hgt[((j + n) % n) * n + ((i + n) % n)];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const o = j * n + i;
    height[o] = byte(0.5 + 0.5 * (hgt[o] - mean) / dev);
    cavity[o] = byte(clamp01(cav[o] / 0.7));
    // the slope in mm per mm, wrapped at the edges (the tile is periodic)
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * mpp) * 12 * strength, dy = (at(i, j + 1) - at(i, j - 1)) / (2 * mpp) * 12 * strength, l = Math.hypot(dx, dy, 1);
    normal[o * 3] = byte(0.5 - 0.5 * dx / l); normal[o * 3 + 1] = byte(0.5 - 0.5 * dy / l); normal[o * 3 + 2] = byte(0.5 + 0.5 / l);
  }
  return { px: n, size: S, height, normal, cavity };
}

/** The texture's channels as PNG buffers. */
export function dermalPngs(T) {
  const N = T.page, NH = T.pageH ?? N, B = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  return {
    albedo: encodePngRgba(B(T.albedo), N, NH), roughness: encodePngGrey(B(T.roughness), N, NH), translucency: encodePngGrey(B(T.translucency), N, NH),
    hair: encodePngRgba(B(T.hair), N, NH), fuzz: encodePngGrey(B(T.fuzz), N, NH),
  };
}
export { encodePng };
