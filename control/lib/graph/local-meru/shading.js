/**
 * The land lit by polygons (local meru `shading`): what a sixth-gen level baked into its vertex colours, read from the
 * land's own shape, so the same land always takes the same marks. No texture: the facets and their light carry it.
 *
 *   bakeLand(faces, ambient, sun, S)   the land's faces baked: rock (cliff, boulders) lit once per facet; ground, sand
 *                                      and trail lit at each corner by the mean normal round it when `S.smooth`
 *   ruleLand(faces, S)                 the three rules multiplied into the baked corner colours
 *
 * The rules, at every corner of the land:
 *   crevice  its concavity (the neighbours' height over the plane of its vertex normal, per mean edge, smoothed one
 *            ring so a mark follows a crease and not a single small facet) darkens it toward the shade colour
 *   ridge    the same measure, convex, lifts it a little: the lit lip a facet catches
 *   blend    a different surface a corner or two away carries its colour over the seam (grass takes on stone at the
 *            cliff foot, sand at the beach); rock keeps its own
 *   grain    (with a relief) the relief's octaves finer than the land's cells move the value of ground and sand, so
 *            the light carries detail the geometry is too coarse to hold; rock and trail keep their own
 *   mix      (S.mix metres) every corner's colour is its surfaces' by how much of each lies round it: the weights
 *            spread S.mix metres over the welded corners, then drawn back to a soft edge with a little noise, so a
 *            seam between grass, rock and sand is a curve a cell or two wide, on both sides of it (blend steps aside)
 *   valley   (S.valley) a corner whose horizon stands high (`valley.at`, the ground grid's horizon read over tens of
 *            metres) darkens toward the shade: the foot of a slope, a hollow, a gully
 * (`S.facet`, rock in planes, is the ground's geometry: local-meru/scene.js planarises the rock before it is lit.)
 */
import { bakeStageLight } from '../era/stage.js';
import { hexRgb, rgbHex } from '../era/geom.js';
import { gnoise2, smoothstep } from '../noise/noise.js';

export const ROCK = new Set(['isekai:cliff', 'isekai:rock']);
const PRIORITY = ['isekai:cliff', 'isekai:rock', 'isekai:snow', 'isekai:sand', 'isekai:ground', 'isekai:trail'];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const keyOf = (c) => `${Math.round(c[0] * 100)},${Math.round(c[1] * 100)},${Math.round(c[2] * 100)}`;
const lin = (c) => c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const srgb = (c) => c.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Bake the land: rock flat per facet (marked `aoFlat`, so the AO bake gives it one occlusion too), the rest smoothed. */
export function bakeLand(faces, ambient, sun, S) {
  const rock = [], soft = [];
  faces.forEach((f, i) => (ROCK.has(f.group) ? rock : soft).push(i));
  const out = new Array(faces.length);
  const bakedRock = bakeStageLight(rock.map((i) => faces[i]), [], ambient, undefined, sun);
  rock.forEach((i, k) => { const f = bakedRock[k]; out[i] = { ...f, ...(f.cornerFills ? { cornerFills: f.cornerFills.map(() => f.fill) } : {}), aoFlat: true }; });
  if (!S.smooth) { const b = bakeStageLight(soft.map((i) => faces[i]), [], ambient, undefined, sun); soft.forEach((i, k) => { out[i] = b[k]; }); return out; }
  // each corner baked once as a point (a one-corner face is lit at its centroid) with the mean normal of the soft
  // faces round it, its colour its own face's; a corner shared by two surfaces is baked once for each
  const vn = new Map();
  for (const i of soft) for (const c of faces[i].corners) { const k = keyOf(c); vn.set(k, add(vn.get(k) || [0, 0, 0], faces[i].normal)); }
  const points = [], at = new Map();
  for (const i of soft) for (const c of faces[i].corners) {
    const k = `${keyOf(c)}|${faces[i].group}`;
    if (!at.has(k)) { at.set(k, points.length); points.push({ corners: [c], normal: unit(vn.get(keyOf(c))), tint: faces[i].tint, group: faces[i].group }); }
  }
  const lit = bakeStageLight(points, [], ambient, undefined, sun).map((p) => hexRgb(p.fill));
  for (const i of soft) {
    const { tint, ...f } = faces[i], cs = f.corners.map((c) => lit[at.get(`${keyOf(c)}|${f.group}`)]);
    const m = [0, 1, 2].map((j) => cs.reduce((a, v) => a + v[j], 0) / cs.length);
    out[i] = { ...f, fill: rgbHex(m), cornerFills: cs.map(rgbHex) };
  }
  return out;
}

/** The land's shape at each corner: concavity, and the nearest different surface (0: it touches it, 1: one corner off). */
function shapeOf(faces, mix = null) {
  const V = new Map();
  const at = (c) => { const k = keyOf(c); let v = V.get(k); if (!v) V.set(k, (v = { p: c, n: [0, 0, 0], nb: new Set(), groups: new Set(), cav: 0 })); return v; };
  for (const f of faces) {
    const vs = f.corners.map(at), n = f.corners.length;
    vs.forEach((v, i) => { v.n = add(v.n, f.normal); v.groups.add(f.group); for (const j of [1, n - 1]) { const w = vs[(i + j) % n]; if (w !== v) v.nb.add(w); } });
  }
  const all = [...V.values()];
  for (const v of all) {
    const n = unit(v.n); let h = 0, e = 0;
    for (const w of v.nb) { const d = sub(w.p, v.p); h += dot(d, n); e += Math.hypot(d[0], d[1], d[2]); }
    v.cav0 = v.nb.size ? h / Math.max(e, 1e-6) : 0;   // about −0.5 (a sharp ridge) to +0.5 (a sharp crease); 0 on a plane
  }
  for (const v of all) { let s = 0; for (const w of v.nb) s += w.cav0; v.cav = v.nb.size ? 0.5 * v.cav0 + 0.5 * s / v.nb.size : 0; }
  const other = (gs, own) => PRIORITY.find((g) => gs.has(g) && g !== own && !(ROCK.has(g) && ROCK.has(own)));
  if (mix) mixWeights(faces, V, mix);
  return faces.map((f) => f.corners.map((c) => {
    const v = V.get(keyOf(c)), g0 = other(v.groups, f.group);
    if (g0) return { cav: v.cav, near: [0, g0], mix: v.mix };
    for (const w of v.nb) { const g1 = other(w.groups, f.group); if (g1) return { cav: v.cav, near: [1, g1], mix: v.mix }; }
    return { cav: v.cav, near: null, mix: v.mix };
  }));
}

// the surfaces a corner mixes: rock, ground, sand (a trail is laid over the ground and keeps its own)
const CLASS = { 'isekai:cliff': 0, 'isekai:rock': 0, 'isekai:ground': 1, 'isekai:sand': 2 };
const MIX_EDGE = 0.3, MIX_JITTER = [0.18, 0, 0.12];
/** Each welded corner's share of rock, ground and sand (`v.mix`), spread `rings` corners and drawn back to a soft edge. */
function mixWeights(faces, V, { rings, seed }) {
  const all = [...V.values()];
  for (const v of all) v.w = [0, 0, 0];
  for (const f of faces) { const c = CLASS[f.group]; if (c === undefined) continue; for (const p of f.corners) V.get(keyOf(p)).w[c] += 1; }
  for (const v of all) { const t = v.w[0] + v.w[1] + v.w[2]; v.w = t > 0 ? v.w.map((x) => x / t) : null; }
  for (let r = 0; r < rings; r++) {
    for (const v of all) {
      if (!v.w) continue;
      let s = [0, 0, 0], n = 0;
      for (const u of v.nb) if (u.w) { s = [s[0] + u.w[0], s[1] + u.w[1], s[2] + u.w[2]]; n++; }
      v.w2 = n ? v.w.map((x, j) => 0.5 * x + 0.5 * s[j] / n) : v.w;
    }
    for (const v of all) if (v.w) v.w = v.w2;
  }
  for (const v of all) {
    if (!v.w) { v.mix = null; continue; }
    const [x, y] = v.p, j = [gnoise2(x * 0.6, y * 0.6, seed), 0, gnoise2(x * 0.6 + 31.7, y * 0.6, seed + 1)];
    const e = v.w.map((w, k) => smoothstep(0.5 - MIX_EDGE, 0.5 + MIX_EDGE, w + MIX_JITTER[k] * j[k])), t = e[0] + e[1] + e[2];
    v.mix = t > 1e-6 ? e.map((w) => w / t) : v.w;
  }
}

const K = 5, DEEP = 0.35, LIFT = 0.22, GRAIN = 0.35, GRAINED = new Set(['isekai:ground', 'isekai:sand', 'isekai:snow']), VALLEY = 1.8;
/**
 * The rules into each corner colour, in linear light. `tints` is each surface's albedo (0..1 sRGB) for the blend and
 * the mix. `X` (optional): `grain` ({ at(x, y) → about [−1, 1], amount 0..1 }) the relief's fine octaves for the value;
 * `cell` the land's cell in metres (the mix's spread is counted in cells); `valley` ({ at(corner) → 0..1 or null }) the
 * horizon the valley rule reads; `seed` for the mix's edge.
 */
export function ruleLand(faces, S, tints, X = null) {
  const s = lin(hexRgb(S.shade)), sl = lum(s) || 1, shade = s.map((v) => v / sl);
  const T = Object.fromEntries(Object.entries(tints).map(([g, t]) => [g, lin(t)]));
  const grain = X?.grain ?? null, valley = S.valley > 0 && X?.valley ? X.valley : null;
  const mixing = S.mix > 0, shape = shapeOf(faces, mixing ? { rings: Math.max(1, Math.round(S.mix / (X?.cell ?? 0.5))), seed: (X?.seed ?? 1) | 0 } : null);
  const M = mixing ? [T['isekai:cliff'] ?? T['isekai:rock'], T['isekai:ground'], T['isekai:sand'] ?? T['isekai:ground']] : null;
  return faces.map((f, i) => {
    if (!f.cornerFills) return f;
    const own = T[f.group];
    const cornerFills = f.cornerFills.map((hex, k) => {
      const { cav, near, mix } = shape[i][k];
      const d = Math.min(1, Math.max(0, cav * K)) * S.crevice, up = Math.min(1, Math.max(0, -cav * K)) * S.ridge * LIFT;
      let m = shade.map((sv) => (1 - d) + d * DEEP * sv + up);
      if (mixing) {
        // the surfaces round the corner, on whichever side of the seam it lies; a trail keeps its own
        if (mix && own && CLASS[f.group] !== undefined) m = m.map((v, j) => v * (mix[0] * M[0][j] + mix[1] * M[1][j] + mix[2] * M[2][j]) / Math.max(own[j], 1e-4));
      } else if (near && own && !ROCK.has(f.group) && T[near[1]]) {
        const w = S.blend * (near[0] === 0 ? 0.55 : 0.22), o = T[near[1]];
        m = m.map((v, j) => v * ((1 - w) + w * o[j] / Math.max(own[j], 1e-4)));
      }
      if (grain && GRAINED.has(f.group)) { const c = f.corners[k], g = 1 + grain.amount * GRAIN * grain.at(c[0], c[1]); m = m.map((v) => v * g); }
      if (valley) { const o = valley.at(f.corners[k]); if (o !== null) { const t = Math.min(1, o * VALLEY) * S.valley; m = m.map((v, j) => v * ((1 - t) + t * DEEP * shade[j])); } }
      return rgbHex(srgb(lin(hexRgb(hex)).map((v, j) => Math.min(1, v * m[j]))));
    });
    const mean = [0, 1, 2].map((j) => cornerFills.reduce((a, h) => a + hexRgb(h)[j], 0) / cornerFills.length);
    return { ...f, cornerFills, fill: rgbHex(mean) };
  });
}
