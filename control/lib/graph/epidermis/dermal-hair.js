/**
 * DERMAL HAIR — the hair the dermal map's tracts grow (dermal-map.js), on any body with a chart (dermal-chart.js), for
 * the realistic register. Strands are the truth; a game's cards are derived from them, as the epidermis cube says.
 *
 *   BODY HAIR    the terminal tracts (the forearm, the shin, the chest, the beard's stubble, the axilla …): each follicle
 *                rooted on a skin face at the tract's density, leaving the skin at its `lift` along the tract's FLOW and
 *                bending down to lie on it within a millimetre (the brow's walk, epidermis.js, carried to the body:
 *                a hair never stands off the skin like a pin); a curl by tract (the chest's and the axilla's curl,
 *                the limbs' barely). A render's `share` thins the count; the tally says how many each strand stands for.
 *   SCALP LOCKS  hair grows in CLUMPS, and the clump is what reads: GUIDES rooted over the scalp at a spacing, each the
 *                elastica's lock (polygonizer/hair-spine.js: B from the clump's length³, so long locks fall and short ones
 *                stand), coiled by the hair's TYPE, draped over the head, the neck and the shoulders; CHILDREN round
 *                each guide, drawn in toward it down the lock (the clump's taper: tight at the tip, loose at the root),
 *                FRIZZ growing toward the tips, RAGGED tips (no lock ends square), FLYAWAYS escaping the clump. A curl's
 *                length is the hair's own (stretched): it FALLS shorter by the coil's shrinkage, as coily hair does.
 *   TYPES        straight, wavy, curly, coily (`HAIR_TYPES`: the curl's radius and period, frizz, stiffness, clumping,
 *                root volume, flyaways, sheen); the egocube's hair textures by the same words, the coily gap closed.
 *   CARDS        one ribbon per clump along its guide, lying on the head's shell, as wide as the clump and narrowing to
 *                its tip: the game's hair, derived. `hairShade` gives the shader its numbers (the root darker than the
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
 * `part` (side | centre | none: swept back), a `fringe` (the front combed forward over the brow). A style under 4 cm
 * lies on the scalp as body hair does (a buzz, a crop): no clumps.
 */
export const SCALP_STYLES = Object.freeze({
  buzz: { length: 0.006, front: 1, sides: 0.8, crown: 1, part: 'none', fringe: false },
  crop: { length: 0.03, front: 1.1, sides: 0.6, crown: 1, part: 'none', fringe: false },
  short: { length: 0.07, front: 1, sides: 0.55, crown: 1.05, part: 'side', fringe: false },
  bob: { length: 0.2, front: 0.7, sides: 0.9, crown: 0.6, part: 'side', fringe: false },
  shoulder: { length: 0.32, front: 0.55, sides: 0.85, crown: 0.6, part: 'side', fringe: false },
  long: { length: 0.5, front: 0.5, sides: 0.85, crown: 0.6, part: 'centre', fringe: false },
});
const SCALP_KEYS = ['style', 'type', 'length', 'front', 'sides', 'crown', 'part', 'fringe', 'spacing', 'children', 'seed', 'stiffness', 'volume', 'frizz', 'clump'];

/** The scalp groom: a style word, or { style, type, …the style's numbers over it, spacing (m), children, seed }. */
export function readScalp(spec = 'short') {
  const doc = typeof spec === 'string' ? { style: spec } : spec || {};
  for (const k of Object.keys(doc)) if (!SCALP_KEYS.includes(k)) throw new Error(`scalp: unknown key '${k}' (have ${SCALP_KEYS.join(', ')})`);
  const st = SCALP_STYLES[doc.style || 'short'];
  if (!st) throw new Error(`scalp: unknown style '${doc.style}' (have ${Object.keys(SCALP_STYLES).join(', ')})`);
  const ty = HAIR_TYPES[doc.type || 'straight'];
  if (!ty) throw new Error(`scalp: unknown type '${doc.type}' (have ${Object.keys(HAIR_TYPES).join(', ')})`);
  const out = { style: doc.style || 'short', type: doc.type || 'straight', ...st, ...ty, spacing: 0.011, children: 14, seed: 1, ...doc };
  if (!['side', 'centre', 'none'].includes(out.part)) throw new Error(`scalp: part '${out.part}' (side | centre | none)`);
  if (!(out.length > 0 && out.length <= 1.2)) throw new Error('scalp: length 0 … 1.2 m');
  if (!(out.spacing >= 0.004 && out.spacing <= 0.04)) throw new Error('scalp: spacing 0.004 … 0.04 m');
  if (!(Number.isInteger(out.children) && out.children >= 0 && out.children <= 200)) throw new Error('scalp: children 0 … 200');
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
  return { p, n, ta, tr, address: { key: s[0].key, part: s[0].part, side: s[0].side, along, around, length: s[0].length, girth: s[0].girth } };
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
export function growBodyHair(chart, D, { share = 0.25, tracts = null, scalpLength = 0, seed = D.seed } = {}) {
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
      const pts = lyingHair(at.p, at.n, dir, L * (0.7 + 0.6 * dice()), h.lift, TRACT_CURL[h.tract] ?? 0.2, dice);
      strands.push({ pts, r: 0.00004, groom: h.tract });
      c.strands++;
    }
  });
  return { strands, counts };
}

/** a lock's root zone walked on the head's shell along `dir`, `gap` off it, in 4 mm steps: kept to the nearest hull
 * sample's tangent plane, until the shell faces neither up nor forward (the head's side, the back) or `max` is run */
function lieOnScalp(root, dir, heads, max, gap) {
  const pts = heads.flatMap((c) => c.surface.pts), nrm = heads.flatMap((c) => c.surface.nrm);
  const nearest = (p) => { let bi = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (p[0] - pts[i][0]) ** 2 + (p[1] - pts[i][1]) ** 2 + (p[2] - pts[i][2]) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  let i0 = nearest(root), n = nrm[i0], p = add(root, scl(n, gap)), d = unit(perp(dir, n), dir), run = 0;
  const out = [p];
  if (!pts.length) return { pts: out, dir, run: 0, n };
  while (run + 0.004 <= max && (n[2] > 0.35 || n[1] > 0.35)) {
    let q = add(p, scl(d, 0.004));
    const j = nearest(q), m = nrm[j];
    q = add(q, scl(m, gap - dot(sub(q, pts[j]), m)));   // back onto the shell, a gap off it
    d = unit(perp(sub(q, p), m), d); n = m; p = q; run += 0.004; out.push(p);
  }
  return { pts: out, dir: d, run, n };
}

/**
 * The scalp's locks. `opts.share` thins the children (a quick look), `opts.colliders` the parts the locks drape over
 * (default the head, the neck, the trunk and the upper arms).
 */
export function growScalp(chart, D, scalp, { share = 1, colliders = ['head', 'neck', 'trunk', 'upperArm'] } = {}) {
  const S = scalp, colour = hairColourOf(D), shade = hairShade(colour, S.type);
  // a short style lies on the scalp as body hair does
  if (S.length < 0.04) {
    const body = growBodyHair(chart, D, { share: 0.5 * share, tracts: ['scalp'], scalpLength: S.length, seed: S.seed });
    return { guides: [], strands: body.strands, cards: [], shade, counts: { guides: 0, strands: body.strands.length, lying: true } };
  }
  // ── the scalp's faces (each corner on the scalp tract) and their areas ──
  const scalpOf = new Map();
  const isScalp = (vi) => { if (!scalpOf.has(vi)) { const s = chart.samples[vi]; scalpOf.set(vi, !!s && !s.feature && s.part === 'head' && (dermisAt(s, D, { detail: false }).regions.scalp || 0) > 0.5); } return scalpOf.get(vi); };
  const faces = chart.faces.filter((tri) => skinFace(chart, tri) && tri.every(isScalp));
  const areas = faces.map((tri) => faceArea(chart, tri)), total = areas.reduce((a, b) => a + b, 0);
  if (!faces.length) return { guides: [], strands: [], cards: [], shade, counts: { guides: 0, strands: 0 } };
  // ── the guides' roots: darts thrown by area, none nearer than the spacing's 0.8 ──
  const dice = streamOf(S.seed, 'dermal-scalp', 'roots'), sp = S.spacing, cell = sp * 0.8, grid = new Map(), roots = [];
  const cum = []; areas.reduce((a, b, i) => (cum[i] = a + b), 0);
  const tries = Math.ceil((total / (sp * sp)) * 6);
  for (let t = 0; t < tries; t++) {
    const x = dice() * total; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    let b1 = dice(), b2 = dice(); if (b1 + b2 > 1) { b1 = 1 - b1; b2 = 1 - b2; }
    const at = onFace(chart, faces[lo], b1, b2), g = at.p.map((v) => Math.floor(v / cell));
    let ok = true;
    for (let i = -1; i <= 1 && ok; i++) for (let j = -1; j <= 1 && ok; j++) for (let k = -1; k <= 1 && ok; k++) {
      for (const q of grid.get(`${g[0] + i},${g[1] + j},${g[2] + k}`) || []) if (len(sub(q, at.p)) < cell) { ok = false; break; }
    }
    if (!ok) continue;
    const key = g.join(','); (grid.get(key) || grid.set(key, []).get(key)).push(at.p);
    roots.push(at);
  }
  // ── each guide: its comb, its length, the elastica, the coil, the drape ──
  const cols = hullColliders(chart, colliders, 0.004 + 0.01 * S.volume);
  const headC = cols.filter((c) => c.surface.frame);
  const pAround = S.part === 'side' ? 0.92 : 0, k = curlShrink(S.curl);
  const guides = roots.map((at, gi) => {
    const gd = streamOf(S.seed, 'dermal-scalp', `g${gi}`), a = at.address, fd = ad(a.around, 0), u = a.along;
    // the comb: down from the crown (the whorl radiates), swept off the part on top, back where there is no part;
    // a fringe combs the front forward; otherwise nothing falls in front of the face
    const down = scl(at.ta, -1);
    const top = smooth(0.62, 0.86, u) * (1 - smooth(0.3, 0.42, fd));
    let away = [0, 0, 0];
    if (S.part === 'none') { const s = ((0.5 - a.around) % 1 + 1) % 1 <= 0.5 ? 1 : -1; away = scl(at.tr, s); }
    else { const d = ((a.around - pAround + 1.5) % 1) - 0.5; away = scl(at.tr, Math.sign(d) || 1); }
    const fringe = S.fringe && fd < 0.13 && u > HEAD_LEVELS.hairline - 0.12;
    // the front: off the face (sideways from the part, or back where there is none) however low the root sits
    const face = fringe ? 0 : 1 - smooth(0.16, 0.24, fd);
    const wAway = Math.max(top, face);
    let comb = fringe ? down : unit(add(scl(down, 1 - 0.75 * wAway), scl(away, wAway)));
    if (!fringe && fd < 0.22 && comb[1] > 0) comb = unit([comb[0], 0.15 * comb[1], comb[2]]);
    const aim = unit(add(comb, scl(at.n, 0.12 + 0.6 * S.volume)));
    // the length: the style's, by region (the front, the sides, the crown, the back), a seeded wander
    const fr = 1 - smooth(0.12, 0.2, fd), sd = smooth(0.12, 0.2, fd) * (1 - smooth(0.33, 0.4, fd)), cr = smooth(0.82, 0.92, u);
    const reg = (fr * S.front + sd * S.sides + (1 - fr - sd) * 1) * (1 - cr) + cr * S.crown;
    const L = S.length * reg * (0.93 + 0.14 * gd()), F = L * k;
    // the comb LIES on the scalp first (the styling cheat: a lock combed, never released over the face), walked along
    // the shell until it turns down the head's side, then the elastica hangs the rest from there
    const lie = fringe ? { pts: [add(at.p, scl(at.n, 0.0008))], dir: aim, run: 0 } : lieOnScalp(at.p, comb, headC, Math.min(0.45 * F, 0.12), 0.0008 + 0.004 * S.volume);
    const free = Math.max(0.004, F - lie.run);
    const turns = S.curl ? free / (S.curl.period * k) : 0, nSteps = Math.min(220, Math.max(12, Math.ceil(8 * turns) + 4));
    const lastN = lie.n || at.n;
    let pts = lockSpine({ root: lie.pts[lie.pts.length - 1], aim: unit(add(lie.dir, scl(lastN, 0.12 + 0.6 * S.volume))), L: free, B: lockB(S.stiffness, free), hold: lie.run ? 0 : S.volume, n: nSteps });
    if (S.curl) pts = coilSpine(pts, { radius: S.curl.radius, turns, hand: gd() < 0.5 ? 1 : -1, from: 0.04 }, free, lastN, !!S.curl.planar, gd() * Math.PI * 2);
    pts = drapeSpine(pts, cols, 0.04);
    pts = [...lie.pts.slice(0, -1), ...pts];
    return { root: at.p, n: at.n, ta: at.ta, tr: at.tr, pts, L, fall: F };
  });
  // ── the children of each clump ──
  const strands = [], R = sp * 0.6, kids = Math.max(0, Math.round(S.children * share));
  guides.forEach((G, gi) => {
    const cd = streamOf(S.seed, 'dermal-scalp', `c${gi}`), N = G.pts.length - 1;
    for (let c = 0; c < kids; c++) {
      const fly = cd() < S.flyaways, rr = R * Math.sqrt(cd()), ang = cd() * Math.PI * 2;
      const off0 = add(scl(G.ta, rr * Math.cos(ang)), scl(G.tr, rr * Math.sin(ang)));
      const clump = fly ? 0 : S.clump * (0.75 + 0.5 * cd()), frizz = S.frizz * (fly ? 3.5 : 0.6 + 0.8 * cd());
      const end = 1 - 0.18 * cd() ** 2, M = Math.max(2, Math.round(N * end)), seed = (S.seed * 131 + gi * 977 + c * 31) | 0;
      const pts = [];
      for (let i = 0; i <= M; i++) {
        const s = i / N, b = G.pts[i], t = unit(sub(G.pts[Math.min(N, i + 1)], G.pts[Math.max(0, i - 1)]));
        // the root's offset carried down the lock square to it, closing on the guide toward the tip
        let p = add(b, scl(perp(off0, t), 1 - clump * s ** 0.8));
        const f = frizz * s ** 1.5;
        if (f > 0) p = add(p, [f * (vnoise(s * 9, 0.5, seed) - 0.5) * 2, f * (vnoise(s * 9, 3.5, seed) - 0.5) * 2, f * (vnoise(s * 9, 6.5, seed) - 0.5) * 2]);
        if (fly) p = add(p, scl(G.n, 0.012 * s * s));
        if (i > 0 && s > 0.05) p = keepOut(p, s < 0.5 ? headC : cols, 0.04).p;
        pts.push(p);
      }
      strands.push({ pts, r: 0.00004, groom: fly ? 'flyaway' : 'scalp', clump: gi });
    }
  });
  // ── the cards: a ribbon per clump on its guide, lying on the head's shell ──
  const centre = chart.parts[Object.keys(chart.parts).find((k2) => chart.parts[k2].part === 'head')]?.axis ?? [[0, 0, 0], [0, 0, 1]];
  const mid = scl(add(centre[0], centre[centre.length - 1]), 0.5);
  const cards = guides.map((G, gi) => {
    const N = G.pts.length - 1;
    const side = G.pts.map((p, i) => { const t = unit(sub(G.pts[Math.min(N, i + 1)], G.pts[Math.max(0, i - 1)])); return unit(cross(t, unit(sub(p, mid))), G.tr); });
    const width = G.pts.map((_, i) => 2 * R * (1 - 0.6 * S.clump * (i / N)));
    return { clump: gi, pts: G.pts, side, width, v: G.pts.map((_, i) => i / N) };
  });
  return { guides, strands, cards, shade, counts: { guides: guides.length, strands: strands.length, children: kids, scalpCm2: Math.round(total * 1e4), shrink: k } };
}
