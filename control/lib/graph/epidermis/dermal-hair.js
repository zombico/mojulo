/**
 * DERMAL HAIR — the hair the dermal map's tracts grow (dermal-map.js), on any body with a chart (dermal-chart.js), for
 * the realistic register. Strands are the truth; a game's cards are derived from them, as the epidermis cube says.
 *
 *   BODY HAIR    the terminal tracts (the forearm, the shin, the chest, the beard's stubble, the axilla …): each follicle
 *                rooted on a skin face at the tract's density, leaving the skin at its `lift` along the tract's FLOW and
 *                bending down to lie on it within a millimetre (the brow's walk, epidermis.js, carried to the body:
 *                a hair never stands off the skin like a pin); a curl by tract (the chest's and the axilla's curl,
 *                the limbs' barely). A render's `share` thins the count; the tally says how many each strand stands for.
 *   SCALP        COMBED (`growScalp`): one smooth comb over the scalp (never across the part), guides walked along it
 *                lifted off the skull, hung by the elastica (polygonizer/hair-spine.js: B from the lock's length³) where
 *                the head turns away, waved in phase so the crests run across the flow, and every strand interpolated
 *                from its nearest guides: parallel, combed. A curl's length is the hair's own (stretched): it FALLS
 *                shorter by the coil's shrinkage, as coily hair does.
 *   TYPES        straight, wavy, curly, coily (`HAIR_TYPES`: the curl's radius and period, frizz, stiffness, clumping,
 *                root volume, flyaways, sheen); the egocube's hair textures by the same words, the coily gap closed.
 *   CARDS        one ribbon per guide on the head's shell: the game's hair, derived. `hairShade` gives the shader its numbers (the root darker than the
 *                tip, the shifted dual highlight of a hair shader: the primary toward the root, the secondary tinted
 *                and toward the tip).
 *
 *   readScalp(spec)                       a style word, or { style, type, length, part, fringe, … } → the scalp groom
 *   growScalp(chart, dermis, scalp, opts) → { guides, strands, cards, shade, counts }
 *   growBodyHair(chart, dermis, opts)     → { strands, counts: { tract: { strands, represents } } }
 *
 * Metres in the chart's frame (z up). Seeded dice only (city/plan/dice.js `streamOf`): the same chart and dials grow the
 * same hair, strand for strand. No clock.
 */
import { streamOf } from '../city/plan/dice.js';
import { vnoise } from '../era/dirt.js';
import { dermisAt, hairColourOf, linHex, HEAD_LEVELS } from './dermal-map.js';
import { lockSpine, lockB, coilSpine, drapeSpine, keepOut } from '../polygonizer/hair-spine.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const unit = (a, fb = [0, 0, 1]) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : fb; };
const perp = (a, t) => sub(a, scl(t, dot(a, t)));
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ad = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

/**
 * The hair's TYPES (hair artists' readings, tuned on the eyes gate): `curl` { radius (m), period (m: one turn's run
 * along the stretched hair), planar (an S-wave, not a helix) }, `frizz` (m, the tips' wander), `stiffness` (a spine word:
 * hair-spine.js SPINE_STIFFNESS), `clump` (0 … 1, how far a clump's children close on its guide at the tip), `volume`
 * (the root's lift, as the share of the lock held along its aim), `flyaways` (the share of children escaping),
 * `roughness` (the highlight's spread: straight hair glossy, coily matte).
 */
export const HAIR_TYPES = Object.freeze({
  straight: { curl: null, frizz: 0.0015, stiffness: 'limp', clump: 0.55, volume: 0.06, flyaways: 0.02, roughness: 0.25 },
  wavy: { curl: { radius: 0.007, period: 0.075, planar: true }, frizz: 0.003, stiffness: 'soft', clump: 0.62, volume: 0.1, flyaways: 0.035, roughness: 0.32 },
  curly: { curl: { radius: 0.008, period: 0.032 }, frizz: 0.004, stiffness: 'springy', clump: 0.72, volume: 0.16, flyaways: 0.05, roughness: 0.42 },
  coily: { curl: { radius: 0.0028, period: 0.008 }, frizz: 0.005, stiffness: 'stiff', clump: 0.5, volume: 0.3, flyaways: 0.07, roughness: 0.6 },
});

/**
 * The scalp's STYLES: `length` (m, stretched, at the back), the region's share of it (`front`, `sides`, `crown`), the
 * `part` (side | centre | none: swept back), a `fringe` (the front combed forward over the brow), `ragged` (how much the
 * ends wander: 0 a buzz's even cut) and its CUT, the stylist's: `line` (a perimeter: `at` a level or metres above the
 * menton, `shape` blunt | a-line | stacked | v | u, `drop`), `taper` (a clipper's length by the root's rise over the
 * hairline: `min` at `rise[0]`, the full length by `rise[1]`), `shelf` (the sides and back under `rise` clipped to `min`:
 * an undercut), `layers` (no lock longer than this from its root), `soft` (point cutting off the line, m). A style under
 * 4 cm lies on the scalp as body hair does.
 */
export const SCALP_STYLES = Object.freeze({
  buzz: { length: 0.006, front: 1, sides: 0.8, crown: 1, part: 'none', fringe: false, ragged: 0 },
  crop: { length: 0.03, front: 1.1, sides: 0.6, crown: 1, part: 'none', fringe: false },
  // a scissor-over-comb short back and sides: the top long, tapered to the nape and round the ears
  short: { length: 0.07, front: 1, sides: 1, crown: 1, part: 'side', fringe: false, cut: { taper: { min: 0.008, rise: [0.05, 0.55] } } },
  // the sides and the back clipped under a shelf, the top long and combed over to lie on it: disconnected
  undercut: { length: 0.11, front: 1, sides: 1, crown: 1, part: 'side', fringe: false, volume: 0.12, cut: { shelf: { rise: 0.5, min: 0.004 } } },
  // one-length cuts: grown long and cut to a line (the front a little shorter, framing the face)
  bob: { length: 0.32, front: 0.7, sides: 1, crown: 1, part: 'side', fringe: false, cut: { line: { at: 'jaw', shape: 'blunt' } } },
  angled: { length: 0.36, front: 0.85, sides: 1, crown: 1, part: 'side', fringe: false, cut: { line: { at: 'jaw', shape: 'a-line', drop: 0.05 } } },
  shoulder: { length: 0.45, front: 0.6, sides: 1, crown: 1, part: 'side', fringe: false, cut: { line: { at: 'shoulder', shape: 'blunt' } } },
  long: { length: 0.7, front: 0.55, sides: 1, crown: 1, part: 'centre', fringe: false, cut: { line: { at: 'chest', shape: 'u', drop: 0.05 } } },
  // layered: a rounded perimeter, every lock no longer than the layer from its root (the top falls in shorter layers)
  layers: { length: 0.6, front: 0.6, sides: 1, crown: 1, part: 'side', fringe: false, cut: { line: { at: 'collarbone', shape: 'u', drop: 0.04 }, layers: 0.24 } },
});
const SCALP_KEYS = ['style', 'type', 'length', 'front', 'sides', 'crown', 'part', 'fringe', 'ragged', 'cut', 'spacing', 'strandGap', 'seed', 'stiffness', 'volume', 'frizz', 'clump'];
const CUT_KEYS = ['line', 'taper', 'shelf', 'layers', 'soft'];
/** the cut's errors (empty = valid) */
function cutErrors(c) {
  if (c === undefined || c === null) return [];
  if (typeof c !== 'object' || Array.isArray(c)) return [`scalp.cut: { ${CUT_KEYS.join(', ')} }`];
  const e = [];
  for (const k of Object.keys(c)) if (!CUT_KEYS.includes(k)) e.push(`scalp.cut.${k}: unknown (have ${CUT_KEYS.join(', ')})`);
  if (c.line) {
    if (!(typeof c.line.at === 'number' || Object.hasOwn(CUT_LEVELS, c.line.at))) e.push(`scalp.cut.line.at: metres above the menton or a level (${Object.keys(CUT_LEVELS).join(', ')})`);
    if (c.line.shape !== undefined && !CUT_SHAPES.includes(c.line.shape)) e.push(`scalp.cut.line.shape: ${CUT_SHAPES.join(' | ')}`);
    if (c.line.drop !== undefined && !(c.line.drop >= 0 && c.line.drop <= 0.3)) e.push('scalp.cut.line.drop: 0 … 0.3 m');
  }
  if (c.taper && !(c.taper.min >= 0 && Array.isArray(c.taper.rise) && c.taper.rise[0] < c.taper.rise[1])) e.push('scalp.cut.taper: { min: m, rise: [from, to] (0 the hairline … 1 the vertex) }');
  if (c.shelf && !(c.shelf.rise > 0 && c.shelf.rise < 1 && c.shelf.min >= 0)) e.push('scalp.cut.shelf: { rise: 0 … 1, min: m }');
  if (c.layers !== undefined && !(c.layers > 0.01)) e.push('scalp.cut.layers: metres (> 0.01)');
  if (c.soft !== undefined && !(c.soft >= 0 && c.soft <= 0.03)) e.push('scalp.cut.soft: 0 … 0.03 m (point cutting)');
  return e;
}

/** The scalp groom: a style word, or { style, type, …the style's numbers over it, spacing (m, between guides), strandGap (m,
 * between strands), seed }. */
export function readScalp(spec = 'short') {
  const doc = typeof spec === 'string' ? { style: spec } : spec || {};
  for (const k of Object.keys(doc)) if (!SCALP_KEYS.includes(k)) throw new Error(`scalp: unknown key '${k}' (have ${SCALP_KEYS.join(', ')})`);
  const st = SCALP_STYLES[doc.style || 'short'];
  if (!st) throw new Error(`scalp: unknown style '${doc.style}' (have ${Object.keys(SCALP_STYLES).join(', ')})`);
  const ty = HAIR_TYPES[doc.type || 'straight'];
  if (!ty) throw new Error(`scalp: unknown type '${doc.type}' (have ${Object.keys(HAIR_TYPES).join(', ')})`);
  const out = { style: doc.style || 'short', type: doc.type || 'straight', ragged: 1, ...st, ...ty, spacing: 0.012, strandGap: 0.003, seed: 1, ...doc, cut: doc.cut === null ? null : { ...(st.cut || {}), ...(doc.cut || {}) } };
  if (!['side', 'centre', 'none'].includes(out.part)) throw new Error(`scalp: part '${out.part}' (side | centre | none)`);
  if (!(out.length > 0 && out.length <= 1.2)) throw new Error('scalp: length 0 … 1.2 m');
  if (!(out.spacing >= 0.004 && out.spacing <= 0.04)) throw new Error('scalp: spacing 0.004 … 0.04 m');
  if (!(out.strandGap >= 0.001 && out.strandGap <= out.spacing)) throw new Error('scalp: strandGap 0.001 m … the guides\' spacing');
  if (!(out.ragged >= 0 && out.ragged <= 2)) throw new Error('scalp: ragged 0 … 2 (0 a cut without wander: a buzz)');
  const ce = cutErrors(out.cut); if (ce.length) throw new Error(ce.join('; '));
  return Object.freeze(out);
}

/** The shrinkage of a coil: the share of the stretched length a curled hair falls (1 straight). */
export function curlShrink(curl) {
  if (!curl || !curl.radius || !curl.period) return 1;
  const r = curl.planar ? curl.radius / 2 : curl.radius;
  return 1 / Math.sqrt(1 + ((2 * Math.PI * r) / curl.period) ** 2);
}

/** The hair shader's numbers from a colour (linear RGB) and a type: the root, the tip, the two highlights. */
export function hairShade(colour, type = 'straight', { bleach = 0.15 } = {}) {
  const T = HAIR_TYPES[type] || HAIR_TYPES.straight;
  const root = colour.map((x) => x * 0.72), tip = colour.map((x) => Math.min(1, x * (1 + bleach) + 0.02 * bleach));
  return {
    root: linHex(root), tip: linHex(tip),
    // Kajiya-Kay / Marschner, as a game shades it: the primary (R) white and shifted toward the root, the secondary (TRT)
    // tinted with the hair's colour, broader and shifted toward the tip
    primary: { shift: -0.08, roughness: T.roughness }, secondary: { shift: 0.12, roughness: Math.min(0.9, T.roughness * 1.8), tint: linHex(colour.map((x) => Math.min(1, x * 1.6 + 0.04))) },
    scatter: 0.4 + 0.4 * (1 - Math.min(1, colour.reduce((a, b) => a + b, 0) / 1.5)),
  };
}

// ─── the skin's hull, for draping: per part, the outermost sample of each (along, around) cell ───
function hullColliders(chart, parts, gap) {
  const out = [];
  for (const key of Object.keys(chart.parts)) {
    if (!parts.includes(chart.parts[key].part)) continue;
    const cells = new Map();
    chart.samples.forEach((s, vi) => {
      if (!s || s.key !== key || s.feature) return;
      const c = `${Math.min(23, Math.floor(s.along * 24))}:${Math.floor(s.around * 32) % 32}`, b = cells.get(c);
      if (!b || s.radius > chart.samples[b].radius) cells.set(c, vi);
    });
    const vis = [...cells.values()].sort((a, b) => a - b);
    if (!vis.length) continue;
    out.push({ surface: { pts: vis.map((vi) => chart.vertices[vi]), nrm: vis.map((vi) => chart.samples[vi].n), gap, reach: 0.05, frame: chart.parts[key].part === 'head' } });
  }
  return out;
}

/** a point on a face at barycentric (b1, b2) with its interpolated frame and address (the around unwrapped) */
function onFace(chart, tri, b1, b2) {
  const w = [1 - b1 - b2, b1, b2], s = tri.map((vi) => chart.samples[vi]);
  const mix = (f) => [0, 1, 2].map((k) => w[0] * f(0)[k] + w[1] * f(1)[k] + w[2] * f(2)[k]);
  const p = mix((i) => chart.vertices[tri[i]]), n = unit(mix((i) => s[i].n));
  const ta = unit(perp(mix((i) => s[i].ta), n)), tr = unit(perp(mix((i) => s[i].tr), n), cross(n, ta));
  let ar = s.map((x) => x.around); if (Math.max(...ar) - Math.min(...ar) > 0.5) ar = ar.map((a) => (a < 0.5 ? a + 1 : a));
  const around = ((w[0] * ar[0] + w[1] * ar[1] + w[2] * ar[2]) % 1 + 1) % 1, along = w[0] * s[0].along + w[1] * s[1].along + w[2] * s[2].along;
  return { p, n, ta, tr, address: { key: s[0].key, part: s[0].part, side: s[0].side, along, around, length: s[0].length, girth: s[0].girth, ...(s[0].marks ? { marks: s[0].marks } : {}) } };
}
const faceArea = (chart, tri) => len(cross(sub(chart.vertices[tri[1]], chart.vertices[tri[0]]), sub(chart.vertices[tri[2]], chart.vertices[tri[0]]))) / 2;
const skinFace = (chart, tri) => tri.every((vi) => chart.samples[vi] && !chart.samples[vi].feature) && tri.every((vi) => chart.samples[vi].key === chart.samples[tri[0]].key);

/** How each tract curls (0 straight … 1 a tight curl) and how long its strands are drawn in steps. */
const TRACT_CURL = { chest: 0.7, trail: 0.5, axilla: 0.9, beard: 0.35, scalp: 0.2, forearm: 0.15, upperArm: 0.15, thigh: 0.2, shank: 0.2, hand: 0.1, finger: 0.1, foot: 0.15, toe: 0.1 };

/** one lying hair: rising at `lift` along `dir`, bending down to lie on the skin, curling sideways by `curl`, kept a
 * hair's breadth above the root's tangent plane */
function lyingHair(root, n, dir, L, lift, curl, dice) {
  const side = cross(n, dir), K = 5, pts = [add(root, scl(n, 0.00005))];
  const ph = dice() * Math.PI * 2, e0 = lift * (0.7 + 0.6 * dice());
  let p = pts[0];
  for (let k = 1; k <= K; k++) {
    const s = (k - 0.5) / K, e = e0 * (1 - s) ** 1.4 - 0.08 * s, phi = curl * 1.1 * Math.sin(ph + 5 * s) + (dice() - 0.5) * 0.25;
    const d = add(scl(add(scl(dir, Math.cos(phi)), scl(side, Math.sin(phi))), Math.cos(e)), scl(n, Math.sin(e)));
    p = add(p, scl(unit(d), L / K));
    const h = dot(sub(p, root), n); if (h < 0.00012) p = add(p, scl(n, 0.00012 - h));
    pts.push(p);
  }
  return pts;
}

/**
 * The body's terminal hair: strands on every skin face whose tract grows terminal hair (the scalp's left to
 * `growScalp`, unless `scalpLength` (m) is given: a buzz lies like body hair). `share` thins the count (0 … 1);
 * `tracts` keeps only those named.
 */
export function growBodyHair(chart, D, { share = 0.25, tracts = null, scalpLength = 0, ragged = 1, seed = D.seed } = {}) {
  const strands = [], counts = {};
  chart.faces.forEach((tri, fi) => {
    if (!skinFace(chart, tri)) return;
    const mid = onFace(chart, tri, 1 / 3, 1 / 3), H = dermisAt(mid.address, D, { detail: false }).hair;
    if (H.kind !== 'terminal' || (tracts && !tracts.includes(H.tract))) return;
    const scalp = H.tract === 'scalp';
    if (scalp && !scalpLength) return;
    const L = (scalp ? scalpLength * 1000 : H.length) / 1000;
    // a beard's shadow (under 1.5 mm) is the texture's follicles, not strands
    if (!(L > 0.0003) || (H.tract === 'beard' && L < 0.0015)) return;
    const dice = streamOf(seed, 'dermal-body', `${fi}`);
    const want = H.density * faceArea(chart, tri) * 1e4 * share, n = Math.floor(want) + (dice() < want % 1 ? 1 : 0);
    const c = (counts[H.tract] ??= { strands: 0, represents: Math.round(1 / share) });
    for (let i = 0; i < n; i++) {
      let b1 = dice(), b2 = dice(); if (b1 + b2 > 1) { b1 = 1 - b1; b2 = 1 - b2; }
      const at = onFace(chart, tri, b1, b2), h = dermisAt(at.address, D, { detail: false }).hair;
      if (h.kind !== 'terminal') continue;
      const th = h.flow + (dice() - 0.5) * 0.35, dir = unit(add(scl(at.ta, Math.cos(th)), scl(at.tr, Math.sin(th))));
      const pts = lyingHair(at.p, at.n, dir, L * (1 + 0.3 * ragged * (2 * dice() - 1)), h.lift, TRACT_CURL[h.tract] ?? 0.2, dice);
      strands.push({ pts, r: 0.00004, groom: h.tract });
      c.strands++;
    }
  });
  return { strands, counts };
}

/** a lock's root zone walked on the head's shell along `dir`, `gap` off it, in 4 mm steps: kept to the nearest hull
 * sample's tangent plane, until the shell faces neither up nor forward (the head's side, the back) or `max` is run; a
 * `hug`ging lock (a short cut) lies the whole of `max` wherever the shell faces */
function lieOnScalp(root, dir, heads, max, gap, hug = false) {
  const pts = heads.flatMap((c) => c.surface.pts), nrm = heads.flatMap((c) => c.surface.nrm);
  const nearest = (p) => { let bi = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (p[0] - pts[i][0]) ** 2 + (p[1] - pts[i][1]) ** 2 + (p[2] - pts[i][2]) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  let i0 = nearest(root), n = nrm[i0], p = add(root, scl(n, gap)), d = unit(perp(dir, n), dir), run = 0;
  const out = [p];
  if (!pts.length) return { pts: out, dir, run: 0, n };
  while (run + 0.004 <= max && (hug || n[2] > 0.35 || n[1] > 0.35)) {
    let q = add(p, scl(d, 0.004));
    const j = nearest(q), m = nrm[j];
    q = add(q, scl(m, gap - dot(sub(q, pts[j]), m)));   // back onto the shell, a gap off it
    d = unit(perp(sub(q, p), m), d); n = m; p = q; run += 0.004; out.push(p);
  }
  return { pts: out, dir: d, run, n };
}

/** points resampled at equal arc: `n + 1` of them, and the line's length */
function arcResample(pts, n) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const L = cum[cum.length - 1], out = [];
  for (let k = 0, j = 0; k <= n; k++) {
    const s = (L * k) / n; while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const t = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
    out.push(add(pts[j], scl(sub(pts[j + 1], pts[j]), Math.max(0, Math.min(1, t)))));
  }
  return { pts: out, L };
}

/** the `k` nearest of `P` to `p` (indices), optionally only those `ok` admits */
function nearestK(P, p, k, ok = () => true) {
  const best = [];
  for (let i = 0; i < P.length; i++) {
    if (!ok(i)) continue;
    const d = (P[i][0] - p[0]) ** 2 + (P[i][1] - p[1]) ** 2 + (P[i][2] - p[2]) ** 2;
    if (best.length < k) { best.push([d, i]); best.sort((a, b) => a[0] - b[0]); } else if (d < best[k - 1][0]) { best[k - 1] = [d, i]; best.sort((a, b) => a[0] - b[0]); }
  }
  return best.map(([d, i]) => ({ i, d: Math.sqrt(d) }));
}

/** the heights the cut's words name (m above the menton): the head's own, from its marks; the body's below the chin */
const CUT_LEVELS = { brow: (M) => M.g.Y / 1000, eye: (M) => M.eyeR.Y / 1000, cheekbone: (M) => M.malarR.Y / 1000, mouth: (M) => M.sto.Y / 1000, jaw: (M) => M.goR.Y / 1000, chin: () => 0.008, neck: () => -0.06, shoulder: () => -0.13, collarbone: () => -0.17, chest: () => -0.3, waist: () => -0.55 };
export const CUT_SHAPES = Object.freeze(['blunt', 'a-line', 'stacked', 'v', 'u']);
/**
 * A perimeter line as the cut height at a point (m): `at` a word (`CUT_LEVELS`) or metres above the menton; `shape`
 * blunt (level all round), a-line (longer at the front by `drop`), stacked (shorter at the back by `drop`: a graduated
 * bob), v (a point at the back's middle, `drop` below the sides), u (rounded, `drop` deeper at the back).
 */
function cutLine(line, chart) {
  const M = chart.parts[Object.keys(chart.parts).find((q) => chart.parts[q].part === 'head')]?.marks?.points;
  const lvl = typeof line.at === 'number' ? line.at : M && CUT_LEVELS[line.at] ? CUT_LEVELS[line.at](M) : CUT_LEVELS[line.at]?.({}) ?? 0;
  const drop = line.drop ?? 0.04, cy = ((chart.parts.head?.axis?.[0]?.[1]) ?? 0);
  return (p) => {
    const f = Math.min(1, Math.abs(Math.atan2(p[0], p[1] - cy)) / Math.PI);   // 0 the front, 1 the back's middle
    return line.shape === 'a-line' ? lvl - drop * (1 - f) : line.shape === 'stacked' ? lvl + drop * f
      : line.shape === 'v' ? lvl - drop * Math.max(0, (f - 0.5) / 0.5) ** 1.2 : line.shape === 'u' ? lvl - drop * f * f : lvl;
  };
}
/** where along a line (0 … 1 of its points) it first crosses below the cut height, past its first fifth; null if never */
function crossing(pts, cutZ) {
  const N = pts.length - 1;
  for (let i = Math.max(1, Math.floor(N * 0.1)); i <= N; i++) {
    const a = pts[i - 1], b = pts[i], za = a[2] - cutZ(a), zb = b[2] - cutZ(b);
    if (za >= 0 && zb < 0) return (i - 1 + za / (za - zb)) / N;
  }
  return null;
}
/** a guide cut at `t` of its arc, resampled to `NS` again */
function trimTo(g, t, NS) {
  const N = g.pts.length - 1, u = Math.max(0, Math.min(1, t)) * N, j = Math.min(N - 1, Math.floor(u)), f = u - j;
  const kept = [...g.pts.slice(0, j + 1), add(g.pts[j], scl(sub(g.pts[j + 1], g.pts[j]), f))];
  const line = arcResample(kept, NS);
  return { ...g, pts: line.pts, L: line.L };
}

/** How each type WAVES when combed: a wave across the lock in the hair's own layer (`amp` m, `period` m along it), or a
 * helix (`coil`: the curl's radius and period, hair-spine.js's coil). Straight hair combed still shows a long, low wave. */
const COMB_WAVE = { straight: { amp: 0.0018, period: 0.065 }, wavy: { amp: 0.006, period: 0.07 }, curly: { coil: true }, coily: { coil: true } };

/**
 * The scalp, COMBED: the strands harmonized into parallel waves, as a comb leaves hair.
 *
 *   the comb       one direction per GUIDE root (down from the crown's whorl, off the part on top, back where there is
 *                  none, a fringe forward, nothing over the face), smoothed over its neighbours on its own side of the
 *                  part (never across it: the part stays a line), so the field has no patches
 *   the phase      a coordinate integrated along that field over the scalp (each root's place downstream), so a wave's
 *                  crests run ACROSS the flow at the same place on neighbouring locks: bands, as a comb leaves them
 *   the guides     each a streamline of the field walked on the head at its LIFT (the root's rise off the skull: the
 *                  volume), fullest on top and the crown, close at the sides and the nape; where the head turns away
 *                  (past the parietal ridge, the occiput) the rest hangs by the elastica (hair-spine.js); a short cut
 *                  lies the whole way. Then waved (or coiled) at its phase, and draped
 *   the strands    every strand interpolated from its nearest guides on its own side of the part (weights by nearness),
 *                  so neighbouring strands run parallel and never cross; its tip a few percent ragged
 *   the cards      one ribbon per guide, for an engine
 *
 * `opts.colliders` the parts the locks drape over (default the head, the neck, the trunk and the upper arms). A style
 * under 4 cm lies on the scalp as body hair does.
 */
export function growScalp(chart, D, scalp, { colliders = ['head', 'neck', 'trunk', 'upperArm'] } = {}) {
  const S = scalp, colour = hairColourOf(D), shade = hairShade(colour, S.type);
  const empty = (extra = {}) => ({ guides: [], strands: [], cards: [], shade, counts: { guides: 0, strands: 0, ...extra } });
  if (S.length < 0.04) {
    const body = growBodyHair(chart, D, { share: 0.5, tracts: ['scalp'], scalpLength: S.length, ragged: S.ragged, seed: S.seed });
    return { ...empty({ strands: body.strands.length, lying: true }), strands: body.strands };
  }
  // ── the scalp's faces and roots: darts by area, none nearer than `gap` ──
  const scalpOf = new Map();
  const isScalp = (vi) => { if (!scalpOf.has(vi)) { const s = chart.samples[vi]; scalpOf.set(vi, !!s && !s.feature && s.part === 'head' && (dermisAt(s, D, { detail: false }).regions.scalp || 0) > 0.5); } return scalpOf.get(vi); };
  const faces = chart.faces.filter((tri) => skinFace(chart, tri) && tri.every(isScalp));
  const areas = faces.map((tri) => faceArea(chart, tri)), total = areas.reduce((a, b) => a + b, 0);
  if (!faces.length) return empty();
  const cum = []; areas.reduce((a, b, i) => (cum[i] = a + b), 0);
  const darts = (gap, layer) => {
    const dice = streamOf(S.seed, 'dermal-comb', layer), cell = gap, grid = new Map(), out = [];
    const tries = Math.ceil((total / (gap * gap)) * 5);
    for (let t = 0; t < tries; t++) {
      const x = dice() * total; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
      let b1 = dice(), b2 = dice(); if (b1 + b2 > 1) { b1 = 1 - b1; b2 = 1 - b2; }
      const at = onFace(chart, faces[lo], b1, b2), g = at.p.map((v) => Math.floor(v / cell));
      let ok = true;
      for (let i = -1; i <= 1 && ok; i++) for (let j = -1; j <= 1 && ok; j++) for (let k = -1; k <= 1 && ok; k++) {
        for (const q of grid.get(`${g[0] + i},${g[1] + j},${g[2] + k}`) || []) if (len(sub(q, at.p)) < gap) { ok = false; break; }
      }
      if (!ok) continue;
      const key = g.join(','); (grid.get(key) || grid.set(key, []).get(key)).push(at.p);
      out.push(at);
    }
    return out;
  };
  const roots = darts(S.spacing, 'guides'), G = roots.map((r) => r.p);
  // ── the comb at a root, then smoothed on its own side of the part ──
  const pAround = S.part === 'side' ? 0.92 : 0;
  // (a part runs over the top from the hairline toward the crown, never down the back: below it the comb is one field)
  const sideOf = (a) => (S.part === 'none' || a.along < 0.66 || ad(a.around, 0) > 0.38 ? 0 : Math.sign(((a.around - pAround + 1.5) % 1) - 0.5) || 1);
  const combAt = (at) => {
    const a = at.address, fd = ad(a.around, 0), u = a.along, down = scl(at.ta, -1);
    const top = smooth(0.62, 0.86, u) * (1 - smooth(0.3, 0.42, fd));
    const away = S.part === 'none' ? scl(at.tr, ((0.5 - a.around) % 1 + 1) % 1 <= 0.5 ? 1 : -1) : scl(at.tr, sideOf(a));
    const fringe = S.fringe && fd < 0.13 && u > HEAD_LEVELS.hairline - 0.12, wAway = Math.max(top, fringe ? 0 : 1 - smooth(0.16, 0.24, fd));
    let comb = fringe ? down : unit(add(scl(down, 1 - 0.75 * wAway), scl(away, wAway)));
    if (!fringe && fd < 0.22 && comb[1] > 0) comb = unit([comb[0], 0.15 * comb[1], comb[2]]);
    return comb;
  };
  const side = roots.map((r) => sideOf(r.address)), same = (a, b) => a === b || a === 0 || b === 0;
  const nbr = G.map((p, i) => nearestK(G, p, 9, (j) => j !== i && same(side[j], side[i])).filter((q) => q.d < S.spacing * 3.2));
  let comb = roots.map(combAt);
  for (let it = 0; it < 6; it++) comb = comb.map((c, i) => { let v = scl(c, 1.5); for (const q of nbr[i]) if (dot(comb[q.i], c) > 0) v = add(v, comb[q.i]); return unit(perp(v, roots[i].n), c); });
  // ── the phase: each root's place downstream, integrated along the comb (Gauss-Seidel over the neighbours) ──
  const phi = G.map((p) => -p[2]);   // started as the depth below the vertex
  for (let it = 0; it < 60; it++) for (let i = 0; i < G.length; i++) {
    let s = 0, w = 0;
    for (const q of nbr[i]) { const c = unit(add(comb[i], comb[q.i])); s += phi[q.i] + dot(sub(G[i], G[q.i]), c); w++; }
    if (w) phi[i] = 0.5 * phi[i] + 0.5 * (s / w);
  }
  // ── the field anywhere near the scalp: the nearest guides' combs, by nearness, on the side of the nearest ──
  const fieldAt = (p, sd) => { const ns = nearestK(G, p, 4, (j) => same(side[j], sd)); let v = [0, 0, 0]; for (const q of ns) v = add(v, scl(comb[q.i], 1 / (q.d + 0.003))); return unit(v, [0, 0, -1]); };
  // ── the guides: streamlines at their lift, then the hang ──
  const cols = hullColliders(chart, colliders, 0.004 + 0.01 * S.volume), headC = cols.filter((c) => c.surface.frame);
  const hull = { pts: headC.flatMap((c) => c.surface.pts), nrm: headC.flatMap((c) => c.surface.nrm) };
  const nearHull = (p) => { let bi = 0, bd = Infinity; for (let i = 0; i < hull.pts.length; i++) { const q = hull.pts[i], d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  const k = curlShrink(S.curl), REG = { front: S.front, sides: S.sides, back: 1, crown: S.crown }, wave = COMB_WAVE[S.type] || COMB_WAVE.straight;
  const ax = chart.parts[Object.keys(chart.parts).find((q) => chart.parts[q].part === 'head')].axis, c0 = scl(add(ax[0], ax[ax.length - 1]), 0.5);
  // a root's rise: 0 at the hairline under it, 1 at the vertex (the hairline read from the scalp's own roots, by azimuth)
  const BINS = 36, hlAt = new Array(BINS).fill(1);
  for (const r of roots) { const b = Math.floor(r.address.around * BINS) % BINS; hlAt[b] = Math.min(hlAt[b], r.address.along); }
  const riseOf = (r) => { const h = hlAt[Math.floor(r.address.around * BINS) % BINS]; return Math.max(0, (r.address.along - h) / Math.max(1e-6, 1 - h)); };
  const liftOf = (a) => { const fd = ad(a.around, 0), topW = smooth(0.62, 0.85, a.along); return (0.003 + 0.06 * S.volume) * (0.35 + 0.65 * Math.max(topW, 1 - smooth(0.2, 0.3, fd) * (1 - topW))); };
  const lengthOf = (a) => { const fd = ad(a.around, 0), fr = 1 - smooth(0.12, 0.2, fd), sd = smooth(0.12, 0.2, fd) * (1 - smooth(0.33, 0.4, fd)), cr = smooth(0.82, 0.92, a.along); return S.length * ((fr * REG.front + sd * REG.sides + (1 - fr - sd)) * (1 - cr) + cr * REG.crown); };
  const NS = 48;
  // one guide grown at a stretched length L: the streamline on the head, the hang, the coil, the drape, the wave
  const growGuide = (at, gi, L) => {
    const F = L * k, lift = liftOf(at.address), hug = L < 0.12, sd = side[gi];
    // the streamline: 4 mm steps on the head at the lift (rising to it over the first 2 cm), turning with the field
    let p = add(at.p, scl(at.n, 0.0008)), d = comb[gi], run = 0, n = at.n;
    const walk = [p], max = Math.min((hug ? 0.9 : 0.5) * F, 0.16);
    while (run + 0.004 <= max) {
      const j = nearHull(p), m = hull.nrm[j];
      if (!hug && run > 0.01 && m[2] <= 0.3 && m[1] <= 0.35) break;   // the head turns away: the rest hangs
      d = unit(perp(add(scl(d, 0.55), scl(fieldAt(p, sd), 0.45)), m), d);
      let q = add(p, scl(d, 0.004));
      const jj = nearHull(q), mm = hull.nrm[jj], h = 0.0008 + (lift - 0.0008) * smooth(0, 0.02, run + 0.004);
      q = add(q, scl(mm, h - dot(sub(q, hull.pts[jj]), mm)));
      d = unit(sub(q, p), d); n = mm; p = q; run += 0.004; walk.push(p);
    }
    const free = Math.max(0.004, F - run);
    const turns = wave.coil && S.curl ? free / (S.curl.period * k) : 0, steps = Math.min(220, Math.max(12, Math.ceil(8 * turns) + 4));
    let hang = lockSpine({ root: p, aim: unit(add(d, scl(n, 0.1 + 0.4 * S.volume))), L: free, B: lockB(S.stiffness, free), hold: 0, n: steps });
    if (wave.coil && S.curl) hang = coilSpine(hang, { radius: S.curl.radius, turns, hand: 1, from: 0.02 }, free, n, false, (2 * Math.PI * (phi[gi] + run)) / (S.curl.period * k));
    const line = arcResample([...walk.slice(0, -1), ...drapeSpine(hang, cols, 0.04)], NS);
    // the combed wave: across the lock in the hair's layer (square to the lock and to the head's outward), its phase the
    // root's place downstream plus the arc, so neighbouring locks crest together; none at the root
    if (wave.amp) {
      line.pts = line.pts.map((q, i) => {
        if (!i) return q;
        const t = unit(sub(line.pts[Math.min(NS, i + 1)], line.pts[i - 1])), out = unit(perp(sub(q, c0), t)), across = cross(t, out), s = (line.L * i) / NS;
        return keepOut(add(q, scl(across, wave.amp * smooth(0, 0.03, s) * Math.sin((2 * Math.PI * (phi[gi] + s)) / wave.period))), cols, 0.04).p;
      });
    }
    return { root: at.p, n: at.n, side: sd, pts: line.pts, L: line.L, fall: F };
  };
  // ── THE CUT: the stylist's, where the ends land ──
  const C = S.cut || {}, cutZ = C.line ? cutLine(C.line, chart) : null, lay = C.layers ?? Infinity;
  const guides = roots.map((at, gi) => {
    let L = Math.min(lengthOf(at.address), lay / k);
    // a clipper's taper: the length by the root's height over the hairline (short at the nape and round the ears)
    if (C.taper) { const r = riseOf(at); L = Math.min(L, C.taper.min + (L - C.taper.min) * smooth(C.taper.rise[0], C.taper.rise[1], r)); }
    // a disconnection: the sides and the back under the shelf cut to the clipper's length, the top left long
    if (C.shelf && riseOf(at) < C.shelf.rise && ad(at.address.around, 0) > 0.12) L = Math.min(L, C.shelf.min);
    // (under a line every lock is grown long enough to reach it: the line, not the length, says where the ends land;
    // the front is still held to its own share, the pieces that frame the face)
    const own = L;
    if (cutZ) L = Math.max(L, 1.8 * S.length);
    let g = growGuide(at, gi, L);
    // a perimeter LINE: combed down and cut where the lock crosses it, regrown at that length and a centimetre over (a
    // shorter lock hangs stiffer, and may stop short: then grown on by what it lacks) and cut again, on the line
    const t0 = cutZ ? crossing(g.pts, cutZ) : null;
    if (t0 !== null) {
      let Lc = Math.max(0.006, (g.L * t0 + 0.012) / k);
      for (let pass = 0; pass < 4; pass++) {
        g = growGuide(at, gi, Lc);
        const t = crossing(g.pts, cutZ);
        if (t !== null) { g = trimTo(g, t, NS); break; }
        const end = g.pts[g.pts.length - 1];
        Lc += (Math.max(0, end[2] - cutZ(end)) + 0.01) / k;   // still short of the line by that much: grown on
      }
    }
    if (cutZ && S.front < 1 && ad(at.address.around, 0) < 0.2 && g.L > own * k) g = trimTo(g, (own * k) / g.L, NS);
    // point cutting: a few millimetres of softness off the line, never past it
    const pd = streamOf(S.seed, 'dermal-cut', `${gi}`), soft = (C.soft ?? 0.006) * (S.ragged ?? 1) * pd();
    if (soft > 0 && g.L > soft * 3) g = trimTo(g, 1 - soft / g.L, NS);
    return g;
  });
  // ── the strands: each from its nearest guides on its own side, parallel ──
  const sroots = darts(S.strandGap, 'strands'), strands = [];
  sroots.forEach((at, si) => {
    const sd = sideOf(at.address), ns = nearestK(G, at.p, 3, (j) => sd === 0 ? side[j] === 0 || nearestK(G, at.p, 1)[0].i === j : side[j] === sd);
    if (!ns.length) return;
    const W = ns.map((q) => 1 / (q.d + 0.002)), Wt = W.reduce((a, b) => a + b, 0), dice = streamOf(S.seed, 'dermal-strand', `${si}`);
    // blended at the same distance from the root on every guide (the cut leaves neighbours of different lengths), as long
    // as their weighted length, a few percent ragged
    const Ls = ns.reduce((a, g, gk) => a + guides[g.i].L * W[gk], 0) / Wt, end = Math.round(NS * (1 - 0.06 * (S.ragged ?? 1) * dice()));
    const at_ = (gd, sArc) => { const u = Math.min(NS, (sArc / Math.max(1e-6, gd.L)) * NS), j = Math.min(NS - 1, Math.floor(u)), f = u - j; return add(gd.pts[j], scl(sub(gd.pts[j + 1], gd.pts[j]), f)); };
    const pts = [];
    for (let i = 0; i <= end; i++) {
      let q = at.p.slice();
      ns.forEach((g, gk) => { const gd = guides[g.i]; q = add(q, scl(sub(at_(gd, (Ls * i) / NS), gd.pts[0]), W[gk] / Wt)); });
      if (i > 1) q = keepOut(q, i < NS / 2 ? headC : cols, 0.04).p;
      pts.push(q);
    }
    strands.push({ pts, r: 0.00004, groom: 'scalp' });
  });
  // ── the cards: a ribbon per guide, for an engine ──
  const cards = guides.map((g, gi) => ({ guide: gi, pts: g.pts, side: g.pts.map((p, i) => unit(cross(unit(sub(g.pts[Math.min(NS, i + 1)], g.pts[Math.max(0, i - 1)])), unit(sub(p, c0))), roots[gi].tr)), width: g.pts.map((_, i) => S.spacing * 1.5 * (1 - 0.5 * (i / NS))), v: g.pts.map((_, i) => i / NS) }));
  return { guides, strands, cards, shade, counts: { guides: guides.length, strands: strands.length, scalpCm2: Math.round(total * 1e4), shrink: k, hairsPerStrand: Math.round(200 * (S.strandGap * 100) ** 2 * 10) / 10 } };
}
