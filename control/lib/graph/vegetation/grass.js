// vegetation/grass — grass as one primitive: a tuft of tillers from one crown, and its kinds as rows of numbers.
//
// A grass branches only at its base: tillers from the crown. Each carries blades (a blade is a strip cantilevered from
// its sheath, arching under its own weight by its bending number B: the palm frond's and the bamboo leaf's elastica),
// and some carry a flowering culm standing above the blades with its head: a panicle (Poa, Dactylis, the reed), a
// plume (pampas, fountain grass), a spike (timothy, the sedges) or feathered awns (the steppe's Stipa). A kind is its
// form (how many blades, how long, how wide, how stiff, how splayed, how many culms and what head) and its colours
// (base, tip, head, and how much of it is dry); habit says how it stands in a field: a tussock (intravaginal tillers,
// packed; bamboo's clump) or a sward (spreading by rhizome or stolon; bamboo's running grove), or a bed at the water.
//
// The leaf is the ruler, at its extreme: a blade is 2–25 mm wide, below a pixel a few metres off. So a tuft's ladder is
// short and steep, and it keeps its coverage as it thins (fewer blades, wider, as a crown's leaves become blobs):
//   L2 every blade, 7 segments · L1 a third of them, 3 segments, 2.6× as wide · L0 seven strips and the heads as
//   one triangle each · LF three blades of a triangle each, in the tuft's mean colour. Past the grass radius the ground's colour carries it.
// Grown at unit height (an instance scales to its height), deterministic from its seed (mulberry32).
import { mulberry32, vec } from './grow.js';
import { elastica } from './mechanics.js';
import { mix } from './util.js';

const { add, mul, unit, cross } = vec;
const DEG = Math.PI / 180;

/**
 * The kinds. H: blade length (m; the tuft's height is about 0.8 H, or its culms'); blades; w: blade width (m);
 * B: [lo, hi] bending numbers (low stands, high arches over); splay: [lo, hi] degrees from vertical at the crown;
 * crown: the crown's radius (m); culms: flowering culms, culmH: their height over H, head: 'panicle' | 'plume' | 'spike'
 * | 'awn' | null, headLen (m), headW (m); colors: base, tip, head (sRGB bytes); dry: 0..1, the share of blades gone to
 * straw; habit: 'tussock' | 'sward' | 'bed'; heights: [lo, hi], the placement range of a tuft's height (m).
 */
export const GRASSES = Object.freeze({
  // fine fescue (Festuca ovina / rubra): a tight, blue-green tuft of wiry blades, a few spiky heads
  fescue: { label: 'fine fescue', H: 0.28, blades: 70, w: 0.0022, B: [1, 4], splay: [5, 40], crown: 0.035, culms: 4, culmH: 1.5, head: 'spike', headLen: 0.05, headW: 0.006,
    colors: { base: [72, 104, 88], tip: [132, 150, 128], head: [168, 150, 110] }, dry: 0.1, habit: 'tussock', heights: [0.18, 0.4] },
  // meadow grass (Dactylis glomerata, Poa): soft, broad blades, tall culms with clustered panicles
  meadow: { label: 'meadow grass', H: 0.5, blades: 60, w: 0.007, B: [2, 9], splay: [10, 55], crown: 0.05, culms: 6, culmH: 1.8, head: 'panicle', headLen: 0.08, headW: 0.022,
    colors: { base: [78, 122, 56], tip: [142, 168, 86], head: [134, 128, 96] }, dry: 0.08, habit: 'sward', heights: [0.35, 0.8] },
  // snow tussock / páramo bunchgrass (Chionochloa, Festuca): a fountain of long, fine, arching blades, straw-tipped
  tussock: { label: 'tussock grass', H: 0.95, blades: 130, w: 0.004, B: [4, 16], splay: [8, 50], crown: 0.09, culms: 3, culmH: 1.2, head: 'panicle', headLen: 0.16, headW: 0.05,
    colors: { base: [116, 118, 70], tip: [196, 170, 112], head: [190, 170, 120] }, dry: 0.45, habit: 'tussock', heights: [0.6, 1.2] },
  // steppe needlegrass (Stipa): sparse, dry, rolled blades and long silver awns that catch the light
  needlegrass: { label: 'needlegrass', H: 0.45, blades: 45, w: 0.0018, B: [1.5, 6], splay: [5, 35], crown: 0.04, culms: 9, culmH: 1.6, head: 'awn', headLen: 0.22, headW: 0.004,
    colors: { base: [138, 136, 92], tip: [196, 186, 140], head: [226, 222, 204] }, dry: 0.6, habit: 'tussock', heights: [0.3, 0.7] },
  // sedge (Carex) of wet ground: stiff, keeled, dark blades, brown spikes
  sedge: { label: 'sedge', H: 0.55, blades: 50, w: 0.005, B: [1, 4], splay: [4, 30], crown: 0.05, culms: 5, culmH: 1.1, head: 'spike', headLen: 0.06, headW: 0.012,
    colors: { base: [52, 92, 56], tip: [88, 124, 70], head: [96, 72, 48] }, dry: 0.05, habit: 'sward', heights: [0.35, 0.8] },
  // fountain grass (Pennisetum setaceum 'Rubrum'): burgundy blades and pink foxtail plumes, arching
  fountain: { label: 'fountain grass', H: 0.8, blades: 60, w: 0.004, B: [3, 11], splay: [10, 45], crown: 0.06, culms: 10, culmH: 1.3, head: 'plume', headLen: 0.24, headW: 0.035,
    colors: { base: [96, 48, 52], tip: [150, 88, 84], head: [210, 150, 160] }, dry: 0, habit: 'tussock', heights: [0.6, 1.1] },
  // pampas grass (Cortaderia selloana): a big clump of arching blades under tall cream plumes
  pampas: { label: 'pampas grass', H: 1.5, blades: 110, w: 0.01, B: [3, 12], splay: [8, 45], crown: 0.3, culms: 12, culmH: 1.85, head: 'plume', headLen: 0.6, headW: 0.14,
    colors: { base: [92, 120, 70], tip: [150, 160, 100], head: [236, 226, 200] }, dry: 0.2, habit: 'tussock', heights: [1.8, 3] },
  // tall tropical grass (Pennisetum purpureum, Imperata, Hyparrhenia): broad, stiff-ish blades, cane culms, bristly spikes
  elephant: { label: 'elephant grass', H: 2, blades: 26, w: 0.025, B: [1.5, 5], splay: [4, 30], crown: 0.2, culms: 8, culmH: 1.3, head: 'spike', headLen: 0.2, headW: 0.025,
    colors: { base: [70, 120, 48], tip: [128, 162, 70], head: [160, 124, 76] }, dry: 0.12, habit: 'sward', heights: [1.8, 3.2] },
});

/** A strip along a polyline (pts), width w0 at the root narrowing to wEnd, colour c(s): → tris. */
function stripTris(pts, side, w0, wEnd, colorAt, tris) {
  const m = pts.length - 1;
  for (let i = 0; i < m; i++) {
    const s0 = i / m, s1 = (i + 1) / m; const a = w0 + (wEnd - w0) * s0, b = w0 + (wEnd - w0) * s1; const c = colorAt(s0);
    const a0 = add(pts[i], mul(side, a)), a1 = add(pts[i], mul(side, -a)), b0 = add(pts[i + 1], mul(side, b)), b1 = add(pts[i + 1], mul(side, -b));
    tris.push({ p: [a0, a1, b1], c, kind: 'leaf' }, { p: [a0, b1, b0], c, kind: 'leaf' });
  }
}

/** The head at `at` along `dir` (unit), in its kind's form: → tris. */
function headTris(G, at, dir, rng, tris, { coarse = false } = {}) {
  const L = G.headLen * (0.8 + 0.4 * rng()), W = G.headW * (0.8 + 0.4 * rng()); const c = mix(G.colors.head, G.colors.tip, 0.25 * rng());
  const side = unit(cross(dir, [0, 0, 1])); const s = Number.isFinite(side[0]) && Math.hypot(...side) > 1e-6 ? side : [1, 0, 0]; const s2 = cross(dir, s);
  const tip = add(at, mul(dir, L));
  if (coarse) { tris.push({ p: [add(at, mul(s, W / 2)), add(at, mul(s, -W / 2)), tip], c, kind: 'leaf' }); return; }
  if (G.head === 'panicle' || G.head === 'plume') {
    // strands from the head's axis, each a thin sliver drooping outward (the reed's plume): a panicle few and open, a
    // plume many and close, staggered along its length
    const plume = G.head === 'plume'; const n = plume ? 20 : 8; const U = s, V = s2;
    for (let q = 0; q < n; q++) {
      const a = q * 137.5 * DEG + rng() * 0.4; const out = add(mul(U, Math.cos(a)), mul(V, Math.sin(a)));
      const base = add(at, mul(dir, L * (plume ? 0.5 : 0.35) * (q / n))); const reach = plume ? 0.55 * W / G.headW * G.headW : W;
      const tip = add(add(base, mul(dir, L * (plume ? 0.6 : 0.55))), add(mul(out, plume ? 0.5 * W : reach), [0, 0, -(plume ? 0.12 : 0.18) * L]));
      const mid = add(add(base, mul(dir, 0.3 * L)), mul(out, 0.25 * W)); const t = Math.max(0.0015, (plume ? 0.01 : 0.01) * L);
      tris.push({ p: [base, add(mid, mul(out, t)), tip], c, kind: 'leaf' }, { p: [base, tip, add(mid, mul(out, -t))], c, kind: 'leaf' });
    }
  } else if (G.head === 'spike') {                           // a spindle: two crossed narrow lozenges
    const mid = add(at, mul(dir, L * 0.5));
    for (const o of [s, s2]) { const l = add(mid, mul(o, W / 2)), r = add(mid, mul(o, -W / 2)); tris.push({ p: [at, l, tip], c, kind: 'leaf' }, { p: [at, tip, r], c, kind: 'leaf' }); }
  } else if (G.head === 'awn') {                              // long fine awns, bowed out
    for (let k = 0; k < 3; k++) { const o = mul(add(mul(s, Math.cos(k * 2.1)), mul(s2, Math.sin(k * 2.1))), 0.3 * L); const end = add(add(at, mul(dir, 0.85 * L)), o);
      tris.push({ p: [add(at, mul(s, W)), add(at, mul(s, -W)), end], c, kind: 'leaf' }); }
  }
}

/**
 * One tuft of a kind, grown to unit height (the tallest of blades and culms is about 1), at a level. → tris.
 * `over` merges over the kind's row (a recipe may retune a kind's form or colours).
 */
export function grassTuft(kind, { seed = 1, level = 'L2', over = null } = {}) {
  const G0 = typeof kind === 'string' ? GRASSES[kind] : kind; if (!G0) throw new Error(`unknown grass '${kind}' (one of ${Object.keys(GRASSES).join(', ')})`);
  const G = over ? { ...G0, ...over, colors: { ...G0.colors, ...(over.colors || {}) } } : G0;
  const rng = mulberry32((seed * 2654435761 + 7) >>> 0); const tris = [];
  const LV = { L2: { keep: 1, segs: 7, wk: 1 }, L1: { keep: 0.3, segs: 3, wk: 2.6 }, L0: { keep: 0, segs: 2, wk: 1 } }[level] || null;
  const top = G.culms && G.head ? Math.max(G.H * 0.8, G.H * G.culmH) + G.headLen : G.H * 0.85; const k = 1 / top;   // unit height
  const colorOf = (dry) => (s) => mix(dry ? mix(G.colors.tip, [196, 178, 120], 0.6) : G.colors.base, dry ? [206, 190, 140] : G.colors.tip, s * 0.9);
  const blades = []; for (let b = 0; b < G.blades; b++) blades.push({ B: G.B[0] * Math.pow(G.B[1] / G.B[0], rng()), th: 90 - (G.splay[0] + (G.splay[1] - G.splay[0]) * Math.pow(rng(), 0.8)), L: G.H * (0.55 + 0.6 * rng()), az: rng() * 2 * Math.PI, r: G.crown * Math.sqrt(rng()), a: rng() * 2 * Math.PI, dry: rng() < G.dry, w: G.w * (0.8 + 0.4 * rng()) });
  const culms = []; for (let q = 0; q < (G.culms || 0); q++) culms.push({ az: rng() * 2 * Math.PI, lean: 3 + 14 * rng(), h: G.H * G.culmH * (0.8 + 0.3 * rng()), r: G.crown * 0.6 * Math.sqrt(rng()), a: rng() * 2 * Math.PI, bow: (G.head === 'plume' ? 0.1 : 0.04) + 0.1 * rng() });
  if (level === 'LF') {                                        // three blades fanned, a triangle each, in the tuft's mean colour
    const c = mix(mix(G.colors.base, G.colors.tip, 0.5), [206, 190, 140], G.dry * 0.5); const lean = Math.sin(((G.splay[0] + G.splay[1]) / 2) * DEG);
    for (let q = 0; q < 3; q++) { const a = q * 2.0944 + 0.4, d = [Math.cos(a), Math.sin(a)], sd = [-d[1], d[0]], w = 0.07;
      tris.push({ p: [[sd[0] * w, sd[1] * w, 0], [-sd[0] * w, -sd[1] * w, 0], [d[0] * lean * 0.8, d[1] * lean * 0.8, 0.8]], c, kind: 'leaf' }); }
    return tris;
  }
  if (level === 'L0') {                                        // seven strips: the tuft's outline; the heads one triangle each
    for (let q = 0; q < 7; q++) {
      const az = q * 0.8976 + 0.3, th = 90 - (G.splay[0] + G.splay[1]) / 2, L = G.H * 0.95, B = Math.sqrt(G.B[0] * G.B[1]);
      const e = elastica({ B, theta0: th * DEG, n: 8 }); const hor = [Math.cos(az), Math.sin(az), 0], side = [-hor[1], hor[0], 0];
      const pts = e.pts.filter((_, i) => i % 4 === 0).map(([x, y]) => mul(add(mul(hor, x * L), [0, 0, y * L]), k));
      stripTris(pts, side, Math.max(G.w * 8, 0.16 * G.H) * k, 0.3 * G.w * k, colorOf(G.dry > 0.4), tris);
    }
    culms.slice(0, 4).forEach((c) => { const d = unit([Math.sin(c.lean * DEG) * Math.cos(c.az), Math.sin(c.lean * DEG) * Math.sin(c.az), Math.cos(c.lean * DEG)]); headTris({ ...G, headLen: G.headLen * k, headW: G.headW * k * 2 }, mul(d, c.h * k), d, rng, tris, { coarse: true }); });
    return tris;
  }
  const keep = Math.max(3, Math.round(G.blades * LV.keep));
  blades.slice(0, keep).forEach((b) => {
    const e = elastica({ B: b.B, theta0: b.th * DEG, n: 16 }); const hor = [Math.cos(b.az), Math.sin(b.az), 0], side = [-hor[1], hor[0], 0];
    const root = [b.r * Math.cos(b.a), b.r * Math.sin(b.a), 0]; const step = Math.max(1, Math.round(16 / LV.segs));
    const pts = e.pts.filter((_, i) => i % step === 0 || i === e.pts.length - 1).map(([x, y]) => mul(add(root, add(mul(hor, x * b.L), [0, 0, y * b.L])), k));
    stripTris(pts, side, b.w * LV.wk * k, 0.1 * b.w * k, colorOf(b.dry), tris);
  });
  culms.slice(0, level === 'L1' ? Math.ceil(culms.length / 2) : culms.length).forEach((c) => {
    const d = unit([Math.sin(c.lean * DEG) * Math.cos(c.az), Math.sin(c.lean * DEG) * Math.sin(c.az), Math.cos(c.lean * DEG)]);
    const root = [c.r * Math.cos(c.a), c.r * Math.sin(c.a), 0]; const n = LV.segs; const pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push(mul(add(root, add(mul(d, c.h * u), [c.bow * c.h * u * u * Math.cos(c.az), c.bow * c.h * u * u * Math.sin(c.az), -c.bow * c.h * u * u * 0.5])), k)); }
    const side = [-Math.sin(c.az), Math.cos(c.az), 0]; stripTris(pts, side, 0.0016 * k * LV.wk, 0.001 * k, () => mix(G.colors.tip, G.colors.head, 0.4), tris);
    const end = pts[pts.length - 1]; const dir = unit([end[0] - pts[n - 1][0], end[1] - pts[n - 1][1], end[2] - pts[n - 1][2]]);
    headTris({ ...G, headLen: G.headLen * k, headW: G.headW * k }, end, dir, rng, tris, { coarse: level === 'L1' && G.head === 'panicle' });
  });
  return tris;
}

/**
 * Light a tuft as one volume (Fox Engine's rotated normals; Ghost of Tsushima's clump normals): each triangle takes a
 * normal bent out from the tuft's heart and up, not its own face's, so the blades shade as one soft mass whatever way
 * they face; and its base darkens (the light that reaches into a tuft's foot). Carried on the tris as `n`; the colour
 * baked. → tris (a new array).
 */
export function volumeLit(tris, { heart = 0.25, up = 0.65, ao = 0.38 } = {}) {
  return tris.map((t) => {
    const m = [(t.p[0][0] + t.p[1][0] + t.p[2][0]) / 3, (t.p[0][1] + t.p[1][1] + t.p[2][1]) / 3, (t.p[0][2] + t.p[1][2] + t.p[2][2]) / 3];
    const out = [m[0], m[1], m[2] - heart]; const l = Math.hypot(out[0], out[1], out[2]) || 1;
    const n = unit(add(mul(out, (1 - up) / l), [0, 0, up])); const shade = 1 - ao + ao * Math.min(1, Math.max(0, m[2] / 0.6));
    return { ...t, n, c: t.c.map((x) => x * shade) };
  });
}

/** A kind's ladder: { L2, L1, L0, LF } → tris, at unit height, lit as a volume. */
export function grassLadder(kind, { seed = 1, over = null } = {}) {
  return Object.fromEntries(['L2', 'L1', 'L0', 'LF'].map((l) => [l, volumeLit(grassTuft(kind, { seed, level: l, over }))]));
}
