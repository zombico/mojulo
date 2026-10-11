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
 */
import { bakeStageLight } from '../era/stage.js';
import { hexRgb, rgbHex } from '../era/geom.js';

export const ROCK = new Set(['isekai:cliff', 'isekai:rock']);
const PRIORITY = ['isekai:cliff', 'isekai:rock', 'isekai:sand', 'isekai:ground', 'isekai:trail'];
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
function shapeOf(faces) {
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
  return faces.map((f) => f.corners.map((c) => {
    const v = V.get(keyOf(c)), g0 = other(v.groups, f.group);
    if (g0) return { cav: v.cav, near: [0, g0] };
    for (const w of v.nb) { const g1 = other(w.groups, f.group); if (g1) return { cav: v.cav, near: [1, g1] }; }
    return { cav: v.cav, near: null };
  }));
}

const K = 5, DEEP = 0.35, LIFT = 0.22;
/** The rules into each corner colour, in linear light. `tints` is each surface's albedo (0..1 sRGB) for the blend. */
export function ruleLand(faces, S, tints) {
  const s = lin(hexRgb(S.shade)), sl = lum(s) || 1, shade = s.map((v) => v / sl);
  const T = Object.fromEntries(Object.entries(tints).map(([g, t]) => [g, lin(t)]));
  const shape = shapeOf(faces);
  return faces.map((f, i) => {
    if (!f.cornerFills) return f;
    const own = T[f.group];
    const cornerFills = f.cornerFills.map((hex, k) => {
      const { cav, near } = shape[i][k];
      const d = Math.min(1, Math.max(0, cav * K)) * S.crevice, up = Math.min(1, Math.max(0, -cav * K)) * S.ridge * LIFT;
      let m = shade.map((sv) => (1 - d) + d * DEEP * sv + up);
      if (near && own && !ROCK.has(f.group) && T[near[1]]) {
        const w = S.blend * (near[0] === 0 ? 0.55 : 0.22), o = T[near[1]];
        m = m.map((v, j) => v * ((1 - w) + w * o[j] / Math.max(own[j], 1e-4)));
      }
      return rgbHex(srgb(lin(hexRgb(hex)).map((v, j) => Math.min(1, v * m[j]))));
    });
    const mean = [0, 1, 2].map((j) => cornerFills.reduce((a, h) => a + hexRgb(h)[j], 0) / cornerFills.length);
    return { ...f, cornerFills, fill: rgbHex(mean) };
  });
}
