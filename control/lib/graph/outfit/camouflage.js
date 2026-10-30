// outfit/camouflage — the CAMOUFLAGE patterns a layer may be printed in (its `pattern`, beside the weaves of
// epidermis/cloth-relief.js), painted on either body as FIELD PAINT (polygonizer/field-paint.js: shapes cut into the faces,
// so the print shows on the game body, the World page and the export alike). Each pattern its GROUND (the layer's own
// tone: what no shape covers) and its COLOURS laid over it in order, each a kind of mark drawn by the dice:
//
//   blobs    lumps of a few ovals (woodland, desert, multicam, urban): `size` [min, max] m, `cover` its share of the
//            cloth, `aspect` the ovals' length to width, `angle` (degrees) and its jitter
//   strokes  brush strokes (DPM): blobs long and leaning
//   stripes  long tapering bars across the body (tiger stripe): chains of thin ovals
//   dots     clusters of small dots (flecktarn): `size` the dots', `cluster` [count, spread m]
//   pixels   a grid of squares (digital): `cell` m, `cover`, `clump` the noise's scale (m)
//   shards   splinters, angular (Splittertarn), and `rain` the thin short bars down it
//
//   CAMOS                      the patterns, by name
//   isCamo(word)               a pattern word that is a camouflage
//   camoTone(L)                { <group>: ground } for each layer the language prints in one (its tone)
//   camoFieldPaint(L, recipe)  the field paint entries: every layer printed in the same pattern shares them, over one
//                              box round all their parts, from each side (front, back, left, right: projection charts,
//                              linear in metres, so a mark is its size on any piece and runs on across the pieces)
//
// Pure and deterministic: the dice seeded by the pattern, the colour and the side (city/plan/dice.js).
import { streamOf } from '../city/plan/dice.js';

export const CAMOS = Object.freeze({
  woodland: { ground: '#7d7f55', colours: [
    { color: '#5c452e', mark: 'blobs', size: [0.05, 0.11], cover: 0.3, aspect: 1.7, angle: -25, jitter: 30 },
    { color: '#3c492b', mark: 'blobs', size: [0.05, 0.12], cover: 0.32, aspect: 1.7, angle: -25, jitter: 30 },
    { color: '#1c1b17', mark: 'blobs', size: [0.014, 0.032], cover: 0.1, aspect: 2.6, angle: -25, jitter: 50 }] },
  desert: { ground: '#c7b389', colours: [
    { color: '#a4825a', mark: 'blobs', size: [0.07, 0.15], cover: 0.34, aspect: 1.9, angle: -15, jitter: 25 },
    { color: '#8d8366', mark: 'blobs', size: [0.05, 0.11], cover: 0.2, aspect: 2.1, angle: -15, jitter: 25 }] },
  dpm: { ground: '#a39969', colours: [
    { color: '#58612f', mark: 'strokes', size: [0.025, 0.06], cover: 0.3, aspect: 3.2, angle: 75, jitter: 20 },
    { color: '#6a4a2d', mark: 'strokes', size: [0.025, 0.06], cover: 0.26, aspect: 3.2, angle: 75, jitter: 20 },
    { color: '#1c1b16', mark: 'strokes', size: [0.012, 0.03], cover: 0.1, aspect: 3.5, angle: 75, jitter: 25 }] },
  tiger: { ground: '#86865a', colours: [
    { color: '#3b4527', mark: 'stripes', size: [0.02, 0.045], cover: 0.36, aspect: 5.5, angle: 0, jitter: 12 },
    { color: '#181913', mark: 'stripes', size: [0.01, 0.024], cover: 0.2, aspect: 6.5, angle: 0, jitter: 12 }] },
  flecktarn: { ground: '#6c724e', colours: [
    { color: '#8b905f', mark: 'dots', size: [0.011, 0.02], cover: 0.22, cluster: [6, 0.034] },
    { color: '#3e4a2c', mark: 'dots', size: [0.011, 0.021], cover: 0.26, cluster: [6, 0.036] },
    { color: '#593e2a', mark: 'dots', size: [0.01, 0.018], cover: 0.16, cluster: [5, 0.03] },
    { color: '#1e1f19', mark: 'dots', size: [0.008, 0.013], cover: 0.08, cluster: [4, 0.024] }] },
  digital: { ground: '#69694b', colours: [
    { color: '#8a8466', mark: 'pixels', cell: 0.02, cover: 0.24, clump: 0.07 },
    { color: '#3d422b', mark: 'pixels', cell: 0.02, cover: 0.24, clump: 0.07 },
    { color: '#28281f', mark: 'pixels', cell: 0.02, cover: 0.1, clump: 0.05 }] },
  splinter: { ground: '#8c8a6d', colours: [
    { color: '#4d5a3a', mark: 'shards', size: [0.06, 0.15], cover: 0.32 },
    { color: '#6d5137', mark: 'shards', size: [0.05, 0.12], cover: 0.2 },
    { color: '#39472a', mark: 'rain', size: [0.003, 0.03], cover: 0.05 }] },
  multicam: { ground: '#a3936f', colours: [
    { color: '#c6ba94', mark: 'blobs', size: [0.05, 0.12], cover: 0.25, aspect: 1.5, angle: 70, jitter: 40 },
    { color: '#7a6c4b', mark: 'blobs', size: [0.05, 0.11], cover: 0.28, aspect: 1.6, angle: 70, jitter: 40 },
    { color: '#5c6943', mark: 'blobs', size: [0.04, 0.09], cover: 0.2, aspect: 1.8, angle: 70, jitter: 40 },
    { color: '#3d3929', mark: 'blobs', size: [0.012, 0.03], cover: 0.08, aspect: 2.5, angle: 70, jitter: 50 }] },
  urban: { ground: '#9a9a95', colours: [
    { color: '#c6c6c1', mark: 'blobs', size: [0.05, 0.11], cover: 0.25, aspect: 1.7, angle: -20, jitter: 30 },
    { color: '#5d5d5a', mark: 'blobs', size: [0.05, 0.11], cover: 0.3, aspect: 1.7, angle: -20, jitter: 30 },
    { color: '#2a2a2a', mark: 'blobs', size: [0.014, 0.03], cover: 0.1, aspect: 2.6, angle: -20, jitter: 50 }] },
  snow: { ground: '#e6e6e1', colours: [
    { color: '#b7bab3', mark: 'blobs', size: [0.04, 0.1], cover: 0.18, aspect: 1.8, angle: -20, jitter: 30 },
    { color: '#7f857b', mark: 'blobs', size: [0.01, 0.025], cover: 0.05, aspect: 2.5, angle: -20, jitter: 50 }] },
});

/** the layers a language prints and their groups, and each's parts on either body (by the pieces' prefixes) */
const LAYERS = Object.freeze([
  { slot: 'top', group: 'Top', parts: ['top*'] },
  { slot: 'bottom', group: 'Bottom', parts: ['bottom*', 'cargo*', 'skirt*'] },
  { slot: 'outer', group: 'Outer', parts: ['outer*'] },
  { slot: 'waistcoat', group: 'Waistcoat', parts: ['vest*'] },
]);
const SIDES = Object.freeze(['front', 'back', 'left', 'right']);

const wordOf = (layer) => { const w = layer && typeof layer === 'object' ? layer.pattern : null; return typeof w === 'string' ? w : w && typeof w === 'object' ? w.kind : null; };
/** a pattern word that is a camouflage */
export const isCamo = (word) => !!CAMOS[word];

/** { <group>: its camouflage's ground } for each layer the language prints in one */
export function camoTone(L) {
  const out = {};
  for (const { slot, group } of LAYERS) { const w = wordOf(L?.[slot]); if (CAMOS[w]) out[group] = CAMOS[w].ground; }
  return out;
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** a convex oval, `n` points round, its half-lengths a × b, turned `t` radians, about c */
const oval = (c, a, b, t, n = 8) => Array.from({ length: n }, (_, k) => { const u = (2 * Math.PI * k) / n, x = a * Math.cos(u), y = b * Math.sin(u); return [c[0] + x * Math.cos(t) - y * Math.sin(t), c[1] + x * Math.sin(t) + y * Math.cos(t)]; });
/** a mark's convex pieces across a W × H window (m), by the dice */
function marks(M, W, H, dice) {
  const area = W * H, out = [], rnd = (a, b) => a + (b - a) * dice();
  if (M.mark === 'blobs' || M.mark === 'strokes' || M.mark === 'stripes') {
    const mid = (M.size[0] + M.size[1]) / 2, aspect = M.aspect ?? 1.5, n = Math.max(1, Math.round((M.cover * area) / (Math.PI * mid * mid * aspect * (M.mark === 'stripes' ? 1.6 : 1))));
    for (let i = 0; i < n; i++) {
      const c = [rnd(-0.1 * W, 1.1 * W), rnd(-0.1 * H, 1.1 * H)], r = rnd(M.size[0], M.size[1]), t = ((M.angle ?? 0) + rnd(-1, 1) * (M.jitter ?? 20)) * (Math.PI / 180);
      if (M.mark === 'stripes') {
        // (a stripe: thin ovals down its length, tapering to either end)
        const L = r * aspect * 2, k = 5;
        for (let j = 0; j < k; j++) { const f = (j - (k - 1) / 2) / (k - 1), w = r * (1 - 0.7 * Math.abs(f) * 2) * 0.5 + r * 0.15, p = [c[0] + Math.cos(t) * f * L, c[1] + Math.sin(t) * f * L + rnd(-0.2, 0.2) * r]; out.push(oval(p, L / k * 0.85, Math.max(r * 0.12, w), t + rnd(-0.15, 0.15))); }
      } else {
        // (a blob: lumps of ovals about its middle; a stroke one long oval and a lump)
        const lumps = M.mark === 'strokes' ? 2 : 3;
        for (let j = 0; j < lumps; j++) { const o = j ? [rnd(-0.6, 0.6) * r * aspect, rnd(-0.6, 0.6) * r] : [0, 0], p = [c[0] + o[0] * Math.cos(t) - o[1] * Math.sin(t), c[1] + o[0] * Math.sin(t) + o[1] * Math.cos(t)]; out.push(oval(p, r * aspect * rnd(0.6, 1), r * rnd(0.55, 1), t + rnd(-0.3, 0.3))); }
      }
    }
  } else if (M.mark === 'dots') {
    const [k, spread] = M.cluster ?? [6, 0.03], mid = (M.size[0] + M.size[1]) / 2, n = Math.max(1, Math.round((M.cover * area) / (k * Math.PI * mid * mid)));
    for (let i = 0; i < n; i++) { const c = [rnd(0, W), rnd(0, H)]; for (let j = 0; j < k; j++) { const r = rnd(M.size[0], M.size[1]); out.push(oval([c[0] + rnd(-1, 1) * spread, c[1] + rnd(-1, 1) * spread], r, r * rnd(0.8, 1.1), rnd(0, Math.PI), 6)); } }
  } else if (M.mark === 'pixels') {
    // (cells where a smooth noise of the dice's lattice passes its threshold: clumps of squares)
    const g = M.cell, nx = Math.ceil(W / g), ny = Math.ceil(H / g), q = Math.max(1, Math.round(M.clump / g)), lat = new Map();
    const L = (i, j) => { const key = `${i},${j}`; if (!lat.has(key)) lat.set(key, dice()); return lat.get(key); };
    const vals = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = i / q, b = j / q, i0 = Math.floor(a), j0 = Math.floor(b), fa = a - i0, fb = b - j0;
      const v = L(i0, j0) * (1 - fa) * (1 - fb) + L(i0 + 1, j0) * fa * (1 - fb) + L(i0, j0 + 1) * (1 - fa) * fb + L(i0 + 1, j0 + 1) * fa * fb + 0.25 * (dice() - 0.5); vals.push([v, i, j]); }
    const cut = [...vals].sort((u, w) => w[0] - u[0])[Math.min(vals.length - 1, Math.floor(vals.length * M.cover))][0];
    // (a row's run of cells one bar: fewer pieces to cut, the same squares)
    const on = new Set(vals.filter(([v]) => v > cut).map(([, i, j]) => `${i},${j}`));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { if (!on.has(`${i},${j}`) || on.has(`${i - 1},${j}`)) continue; let e = i; while (on.has(`${e + 1},${j}`)) e++; out.push([[i * g, j * g], [(e + 1) * g, j * g], [(e + 1) * g, (j + 1) * g], [i * g, (j + 1) * g]]); }
  } else if (M.mark === 'shards') {
    const mid = (M.size[0] + M.size[1]) / 2, n = Math.max(1, Math.round((M.cover * area) / (0.35 * mid * mid)));
    for (let i = 0; i < n; i++) { const c = [rnd(-0.1 * W, 1.1 * W), rnd(-0.1 * H, 1.1 * H)], r = rnd(M.size[0], M.size[1]), t0 = rnd(0, 2 * Math.PI);
      // (a splinter: three or four corners round its middle at uneven angles, its long axis anywhere: convex)
      const k = dice() < 0.5 ? 3 : 4, as = Array.from({ length: k }, (_, j) => t0 + (2 * Math.PI * (j + rnd(-0.25, 0.25))) / k).sort((u, w) => u - w);
      out.push(as.map((a, j) => { const rr = r * (j % 2 ? 0.35 : 1) * rnd(0.7, 1); return [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]; })); }
  } else if (M.mark === 'rain') {
    const n = Math.max(1, Math.round((M.cover * area) / (M.size[0] * M.size[1])));
    for (let i = 0; i < Math.min(n, 580); i++) { const c = [rnd(0, W), rnd(0, H)], w = M.size[0] / 2, h = M.size[1] / 2; out.push([[c[0] - w, c[1] - h], [c[0] + w, c[1] - h], [c[0] + w, c[1] + h], [c[0] - w, c[1] + h]]); }
  }
  return out.slice(0, 600);
}

/** a convex polygon clipped to the box −1 … 1 (still convex), null where nothing of it is left */
function clipBox(P) {
  let Q = P;
  for (const [k, lim, keep] of [[0, -1, (v) => v >= -1], [0, 1, (v) => v <= 1], [1, -1, (v) => v >= -1], [1, 1, (v) => v <= 1]]) {
    const R = [];
    for (let i = 0; i < Q.length; i++) {
      const a = Q[i], b = Q[(i + 1) % Q.length], ia = keep(a[k]), ib = keep(b[k]);
      if (ia) R.push(a);
      if (ia !== ib) { const t = (lim - a[k]) / (b[k] - a[k]); R.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    Q = R; if (Q.length < 3) return null;
  }
  // (rounded, its repeated corners gone and its turns all one way: a sliver that rounding folded is dropped)
  const R = Q.map(([x, y]) => [r4(x), r4(y)]).filter((p, i, A) => p[0] !== A[(i + 1) % A.length][0] || p[1] !== A[(i + 1) % A.length][1]);
  if (R.length < 3) return null;
  const turns = R.map((a, i) => { const b = R[(i + 1) % R.length], c = R[(i + 2) % R.length]; return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); });
  const area = R.reduce((s, p, i) => { const q = R[(i + 1) % R.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  return Math.abs(area) > 1e-8 && (turns.every((t) => t >= 0) || turns.every((t) => t <= 0)) ? R : null;
}
/** the [name, part]s named (by a prefix ending '*', or a name) */
const partsNamed = (parts, names) => Object.entries(parts).filter(([k]) => names.some((n) => (n.endsWith('*') ? k.startsWith(n.slice(0, -1)) : k === n)));

/** The field paint for the camouflage a language prints (see the head of the file), null for none. */
export function camoFieldPaint(L, recipe) {
  if (!L || !recipe?.parts) return null;
  const byCamo = new Map();
  for (const ly of LAYERS) { const w = wordOf(L[ly.slot]); if (!CAMOS[w]) continue; if (!byCamo.has(w)) byCamo.set(w, []); byCamo.get(w).push(ly); }
  if (!byCamo.size) return null;
  const out = [];
  for (const [w, layers] of byCamo) {
    // (its parts: the layers' pieces by name, and anything else in their groups, the game body's skin painted as the cloth
    // over it, the shirt's chest its pectorals)
    const C = CAMOS[w], groups = layers.map((ly) => ly.group), names = [...new Set([...partsNamed(recipe.parts, layers.flatMap((ly) => ly.parts)).map(([k]) => k), ...Object.keys(recipe.parts).filter((k) => groups.includes(recipe.parts[k]?.group))])].sort();
    if (!names.length) continue;
    const pts = names.map((k) => recipe.parts[k]).filter((P) => Array.isArray(P?.stations)).flatMap((P) => P.stations.flatMap((st) => Object.values(st.points)));
    if (!pts.length) continue;
    const span = (k) => Math.max(1e-3, Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k])));
    const [Wx, Wy, Hz] = [span(0), span(1), span(2)];
    // (each colour over the ground and the colours before it: a later mark lies on an earlier one, woodland's black on its
    // brown)
    const camoGroup = (ci) => `Camo${w[0].toUpperCase()}${w.slice(1)}${ci + 1}`;
    C.colours.forEach((M, ci) => {
      const only = [...groups, ...C.colours.slice(0, ci).map((_, j) => camoGroup(j))];
      for (const side of SIDES) {
        const W = side === 'front' || side === 'back' ? Wx : Wy, polys = marks(M, W, Hz, streamOf('camo', w, `${ci}|${side}`));
        if (!polys.length) continue;
        // (each piece from the window's metres into the shape's box, −1 … 1 over the whole chart)
        const cut = polys.map((pl) => clipBox(pl.map(([x, y]) => [(2 * x) / W - 1, (2 * y) / Hz - 1]))).filter(Boolean);
        if (!cut.length) continue;
        out.push({ id: `camo-${w}-${ci}-${side}`, part: names, chart: side, at: [0.5, 0.5], size: [1, 1], shape: { polys: cut },
          group: camoGroup(ci), color: M.color, only });
      }
    });
  }
  return out.length ? out : null;
}
