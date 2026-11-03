/**
 * THE AIRCRAFT'S SURFACE: a craft's paint, its markings and its wear, on its form faces (craft-form.js), all of it
 * geometry and slots, never a texture. The field's own surface (car-designer/livery-cut.js, mil-wear.js) told for an
 * aircraft: its camo is sprayed for the sky as well as the ground, its marks are generic (never a nation's), and its wear
 * is the air's (no mud; soot, streaks, chips at the leading edges, the sun's fade, a repainted panel).
 *
 *   livery  a pattern word, or { pattern, colours?, scale?, seed?, marks? }
 *     pattern   mono | counterShaded | naval | wraparound | splinter | desert | arctic (AIR_CAMO)
 *               counterShaded and naval are graded by height (a darker top over a paler belly, a wing by its face);
 *               wraparound, desert and arctic are blotches over every face; splinter is hard-edged plan-view shards
 *     colours   ['#rrggbb', …] over the pattern's own (for a graded pattern, the belly's first)
 *     scale     a blotch's size in metres (1 to 8; the pattern's own grown with the craft by default)
 *     marks     { number?: '<1-4 digits>' | false, emblem?: 'disc' | 'bar' | false, warnings?: boolean, style?:
 *               'military' | 'civil', hiVis?: boolean } | false: a tail number on the fin, a side number on the nose, a
 *               generic emblem on the fuselage's sides and the wings (one up, one down), the ejection warning by the
 *               canopy and the walkways by the wing roots, all low-visibility against the paint. A boat's: its number on
 *               both bows and its emblem amidships, on its outermost skin (a RIB's collar), low-visibility (military); or
 *               its registration on both bows, against its paint (civil). A drone's: its number
 *               on its frame's sides and its emblem on top (military); or its registration on its sides, its serial
 *               plate on top and, `hiVis`, orange bands round its arms' tips (civil). A registration is generic, never a
 *               real register's format
 *   wear    pristine | used | battered (mil-wear.js's words): soot aft of the guns and over the engine's end, grime
 *           streaks running aft, chips along the leading edges, the sun's fade on what faces up, repainted panels; on a
 *           boat its streaks run down its sides (salt on a dark paint, grime on a pale one) and its chips are at its bow
 *
 *   AIR_CAMO, AIR_WEAR
 *   readAirLivery(livery)                         → the livery read whole, or null when absent; throws naming its words
 *   paintCraft(stage, L, { base, seed, waist, length })   the stage's items (in place) cut into the pattern's bands
 *   markCraft(stage, L, { base, seed, length })            the marks laid on the stage's items (in place)
 *   wearCraft(stage, W, { seed, length })                  the wear laid on the stage's items (in place)
 *   decal(faces, A, shapes, look, { lift })                → faces: convex shapes in a frame A ({ at, out, up }) laid on
 *                                                            the faces turned toward A.out, conforming to them
 *
 * A stage is the craft's items as craft-form.js holds them before they are packed: [{ id, kind, family, fs }]. Pure and
 * deterministic: the fields are hashed noise, the placings mulberry32 from the seed.
 */
import { cutByField, noise3, STENCIL } from '../car-designer/livery-cut.js';
import { mulberry32 } from '../vegetation/grow.js';
import { woundTo } from './craft-form.js';

// ── the patterns ────────────────────────────────────────────────────────────────
// graded ('shade'): its colours belly first, the levels its bands change at (in half-heights of the hull from its waist);
// blotched ('field'): its colours base first, each band's share, the blotch (m, on a 15 m craft), its stretch along x, y,
// z and its warp; shards ('planes'): its colours and how many plan-view cuts make them
export const AIR_CAMO = Object.freeze({
  counterShaded: Object.freeze({ reads: 'counter-shaded: a darker grey over a paler belly, the line soft along the sides', kind: 'shade', colours: ['#a7aeb4', '#737c84'], levels: [0.05] }),
  naval: Object.freeze({ reads: 'naval: three greys, the darkest on top, a sea grey down the sides, pale beneath', kind: 'shade', colours: ['#b9bfc3', '#8b949b', '#626c75'], levels: [-0.3, 0.42] }),
  wraparound: Object.freeze({ reads: 'wraparound: green, dark green and tan blotches over every face', kind: 'field', colours: ['#5d6749', '#3e4737', '#7b6b4d'], shares: [0.45, 0.33, 0.22], scale: 2.4, stretch: [1, 1.5, 1], warp: 0.5 }),
  desert: Object.freeze({ reads: 'desert: sand with brown and pale clouds', kind: 'field', colours: ['#b8a27a', '#8e744f', '#d0c09b'], shares: [0.5, 0.3, 0.2], scale: 2.8, stretch: [1, 1.4, 1], warp: 0.45 }),
  arctic: Object.freeze({ reads: 'arctic: white with grey patches', kind: 'field', colours: ['#dfe2e0', '#8e959a', '#b7bcbf'], shares: [0.55, 0.25, 0.2], scale: 2.2, stretch: [1, 1.2, 1], warp: 0.55 }),
  splinter: Object.freeze({ reads: 'splinter: hard-edged shards of greens and brown, cut straight across the plan', kind: 'planes', colours: ['#6f7a4f', '#3f4834', '#9c8c60', '#2b2e26'], planes: 14 }),
});
export const AIR_PATTERNS = Object.freeze(['mono', ...Object.keys(AIR_CAMO)]);
export const AIR_EMBLEMS = Object.freeze(['disc', 'bar']);
const LIVERY_KEYS = Object.freeze(['pattern', 'colours', 'scale', 'seed', 'marks']);
const HEX = /^#[0-9a-f]{6}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The livery read whole, or null when absent; a word is its pattern. */
export function readAirLivery(livery) {
  if (livery === undefined || livery === null) return null;
  const L = typeof livery === 'string' ? { pattern: livery } : livery;
  const fail = (m) => new Error(`craft livery: ${m} (a livery is a pattern, ${AIR_PATTERNS.join(' | ')}, or { ${LIVERY_KEYS.join(', ')} })`);
  if (!isObj(L)) throw fail('it is a word or an object');
  for (const k of Object.keys(L)) if (!LIVERY_KEYS.includes(k)) throw fail(`'${k}' is not one of its words`);
  const pattern = L.pattern ?? 'mono';
  if (!AIR_PATTERNS.includes(pattern)) throw fail(`'${pattern}' is no pattern`);
  const P = AIR_CAMO[pattern] ?? { colours: [null] };
  if (L.colours !== undefined && (!Array.isArray(L.colours) || !L.colours.length || L.colours.length > P.colours.length || !L.colours.every((c) => typeof c === 'string' && HEX.test(c.toLowerCase())))) {
    throw fail(`colours are up to ${P.colours.length} '#rrggbb' for ${pattern}`);
  }
  const colours = P.colours.map((c, i) => (L.colours?.[i] ?? c)?.toLowerCase() ?? null);
  if (L.scale !== undefined && (typeof L.scale !== 'number' || !(L.scale >= 1 && L.scale <= 8))) throw fail('scale is a blotch\'s size in metres, 1 to 8');
  if (L.seed !== undefined && !Number.isInteger(L.seed)) throw fail('seed is an integer');
  let marks = { number: null, emblem: 'disc', warnings: true, style: 'military', hiVis: false };
  if (L.marks === false) marks = false;
  else if (L.marks !== undefined) {
    if (!isObj(L.marks) || Object.keys(L.marks).some((k) => !['number', 'emblem', 'warnings', 'style', 'hiVis'].includes(k))) throw fail('marks are { number?, emblem?, warnings?, style?, hiVis? } or false');
    const { number = null, emblem = 'disc', warnings = true, style = 'military', hiVis = false } = L.marks;
    if (!['military', 'civil'].includes(style)) throw fail('a mark\'s style is military or civil');
    if (typeof hiVis !== 'boolean') throw fail('hiVis is true or false');
    if (number !== null && number !== false && !(typeof number === 'string' && /^\d{1,4}$/.test(number))) throw fail('a mark\'s number is one to four digits, or false');
    if (emblem !== false && !AIR_EMBLEMS.includes(emblem)) throw fail(`an emblem is one of ${AIR_EMBLEMS.join(', ')}, or false`);
    if (typeof warnings !== 'boolean') throw fail('warnings are true or false');
    marks = { number, emblem, warnings, style, hiVis };
  }
  return { pattern, colours, ...(L.scale !== undefined ? { scale: L.scale } : {}), ...(L.seed !== undefined ? { seed: L.seed } : {}), marks };
}

// ── colour arithmetic ───────────────────────────────────────────────────────────
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const lum = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const scaleBy = (h, k) => hex(rgb(h).map((v) => v * k));
const mixHex = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
const centre = (P) => [0, 1, 2].map((k) => P.reduce((s, q) => s + q[k], 0) / P.length);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;
const extentOf = (fs, k) => { let lo = Infinity, hi = -Infinity; for (const f of fs) for (const c of f.corners) { if (c[k] < lo) lo = c[k]; if (c[k] > hi) hi = c[k]; } return [lo, hi]; };

// what the paint is sprayed on: the paint's slot, not a store's (a missile keeps its own), not the heat's bands
const SPRAYED = (it) => !['craft-weapon', 'craft-propeller', 'craft-canopy', 'drone-rotor', 'drone-motor', 'drone-payload'].includes(it.kind);
const painted = (f) => f.material === 'airPaint' && f.fitting !== 'heat' && f.fitting !== 'mark';
const PLATE = Object.freeze({ 'craft-wing': 'wing', 'craft-stabilizer': 'wing', 'craft-fin': 'fin' });

// ── the paint ───────────────────────────────────────────────────────────────────
/** The stage's painted faces cut into the pattern's bands, in place. A face a shade off the paint (a control surface)
 *  keeps its shade in its band's colour. */
export function paintCraft(stage, L, opts) {
  if (!L) return stage;
  const bandAt = paintBands(stage, L, opts);
  // (the heat's bands over the engine's end tint the camo under them as they tinted the paint: channel by channel)
  const cols = L.colours.map((c) => c ?? opts.base), B = rgb(opts.base);
  for (const it of stage) it.fs = it.fs.map((f) => {
    if (f.fitting !== 'heat') return f;
    const under = rgb(cols[bandAt(centre(f.corners))]), H = rgb(f.albedo);
    return { ...f, albedo: hex(under.map((v, i) => v * ((H[i] + 1) / (B[i] + 1)))) };
  });
  return stage;
}

// the cut, by pattern; → the band at a point (for what is laid over the paint after it)
function paintBands(stage, L, { base, seed = 1, waist = 0, half = 1, length = 15 }) {
  // (mono's colour, unless named, is the paint's own)
  const P = AIR_CAMO[L.pattern], cols = L.colours.map((c) => c ?? base);
  const kOf = (albedo, ref) => Math.max(0.6, Math.min(1.25, (lum(albedo) + 1) / (lum(ref) + 1)));
  // (first every painted face in the first band's colour, its shade kept; the cuts then recolour what lies past a level)
  const tint = (albedo, band) => scaleBy(cols[band], kOf(albedo, base));
  for (const it of stage) if (SPRAYED(it)) it.fs = it.fs.map((f) => (painted(f) ? { ...f, albedo: tint(f.albedo, 0) } : f));
  if (L.pattern === 'mono') return () => 0;
  const again = (f, band) => ({ part: f.part, material: f.material, albedo: scaleBy(cols[band], kOf(f.albedo, cols[0])) });
  const s = (((L.seed ?? seed) * 7919) + 13) | 0;
  if (P.kind === 'shade') {
    const wob = (p) => 0.14 * (noise3([p[0] / 0.9, p[1] / 1.6, p[2] / 0.9], s) - 0.5);
    const valueAt = (p) => (p[2] - waist) / half + wob(p);
    for (const it of stage) {
      if (!SPRAYED(it)) continue;
      const plate = PLATE[it.kind];
      if (plate) {
        // (a plate by its faces: a wing's upper face the top's colour, its lower the belly's; a fin a side's)
        it.fs = it.fs.map((f) => (painted(f) ? { ...f, albedo: scaleBy(cols[plate === 'fin' ? 1 : f.outNormal[2] > 0 ? cols.length - 1 : 0], kOf(f.albedo, cols[0])) } : f));
        continue;
      }
      // (its pieces as fine as a fighter's on a fighter, coarser on a bigger craft: the line is soft)
      const g = Math.max(1, length / 15);
      it.fs = cutByField(it.fs, { select: painted, valueAt, levels: P.levels, hMax: 0.6 * g, hMin: 0.14 * g, stripH: 0.3 * g, remake: (f, poly, band) => (band ? again(f, band) : null) });
    }
    return (p) => P.levels.filter((t) => valueAt(p) >= t).length;
  }
  if (P.kind === 'planes') {
    // shards: the plan cut straight across by lines through the craft, each shard its colour from the side of each line
    // it lies on
    const rnd = mulberry32(s), ext = [extentOf(stage.flatMap((it) => it.fs), 0), extentOf(stage.flatMap((it) => it.fs), 1)];
    const lines = Array.from({ length: P.planes }, () => {
      const a = rnd() * Math.PI, o = [ext[0][0] + rnd() * (ext[0][1] - ext[0][0]), ext[1][0] + rnd() * (ext[1][1] - ext[1][0])];
      return { n: [Math.cos(a), Math.sin(a)], o };
    });
    const side = (p, l) => (p[0] - l.o[0]) * l.n[0] + (p[1] - l.o[1]) * l.n[1];
    // (a shard's colour from which side of each line it lies on, the bits mixed so every line counts)
    const shardOf = (c) => {
      const code = lines.reduce((acc, l, i) => acc + (side(c, l) >= 0 ? 1 << i : 0), 0);
      let h = Math.imul((code + 1) ^ s, 0x45d9f3b); h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16;
      return (h >>> 0) % cols.length;
    };
    for (const it of stage) {
      if (!SPRAYED(it)) continue;
      for (const l of lines) it.fs = it.fs.flatMap((f) => (painted(f) ? splitAt(f, (p) => side(p, l)) : [f]));
      it.fs = it.fs.map((f) => {
        if (!painted(f)) return f;
        return { ...f, albedo: scaleBy(cols[shardOf(centre(f.corners))], kOf(f.albedo, cols[0])) };
      });
    }
    return shardOf;
  }
  // blotches: a warped field over the craft's space, its levels giving each band its share of the craft's painted area
  const k = (L.scale ?? P.scale * Math.max(0.6, length / 15)), str = P.stretch.map((v) => k * v);
  const field = (p) => {
    const x = p[0] / str[0], y = p[1] / str[1], z = p[2] / str[2];
    const w = [0, 1, 2].map((j) => noise3([x * 0.7 + 11.3 * (j === 0), y * 0.7 + 7.1 * (j === 1), z * 0.7 + 3.7 * (j === 2)], s + 101 + 110 * j) - 0.5);
    const q = [x + 2 * P.warp * w[0], y + 2 * P.warp * w[1], z + 2 * P.warp * w[2]];
    return 0.72 * noise3(q, s) + 0.28 * noise3(q.map((v) => v * 2.03), s + 17);
  };
  const samples = [];
  for (const it of stage) if (SPRAYED(it)) for (const f of it.fs) if (painted(f)) {
    const pts = [...f.corners, centre(f.corners)], a = areaOf(f.corners) / pts.length;
    for (const p of pts) samples.push({ v: field(p), a });
  }
  samples.sort((x, y) => x.v - y.v);
  const total = samples.reduce((t, x) => t + x.a, 0), levels = [];
  let acc = 0, want = 0, i = 0;
  for (let b = 0; b + 1 < P.shares.length; b++) {
    want += P.shares[b] * total;
    while (i < samples.length && acc + samples[i].a < want) acc += samples[i++].a;
    levels.push(samples[Math.min(i, samples.length - 1)]?.v ?? 0.5);
  }
  for (const it of stage) if (SPRAYED(it)) it.fs = cutByField(it.fs, { select: painted, valueAt: field, levels, hMax: k * 0.5, hMin: k * 0.16, stripH: k * 0.25, remake: (f, poly, band) => (band ? again(f, band) : null) });
  return (p) => levels.filter((t) => field(p) >= t).length;
}
// a face split exactly where a linear value crosses zero (a straight cut needs no finer pieces): both its halves, each
// with its corners' normals carried, or the face itself when the cut misses it
function splitAt(f, val) {
  const v = f.corners.map(val);
  if (v.every((x) => x >= 0) || v.every((x) => x < 0)) return [f];
  const ns = f.cornerNormals ?? f.corners.map(() => f.outNormal), A = [], B = [];
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length, here = { p: f.corners[i], n: ns[i] };
    (v[i] >= 0 ? A : B).push(here);
    if ((v[i] >= 0) !== (v[j] >= 0)) {
      const t = v[i] / (v[i] - v[j]), q = { p: f.corners[i].map((x, k) => r6(x + (f.corners[j][k] - x) * t)), n: unit(ns[i].map((x, k) => x + (ns[j][k] - x) * t)).map(r6) };
      A.push(q); B.push(q);
    }
  }
  return [A, B].filter((P) => P.length >= 3 && areaOf(P.map((q) => q.p)) > 1e-9).map((P) => ({ ...f, corners: P.map((q) => q.p), cornerNormals: P.map((q) => q.n) }));
}
function areaOf(P) { let n = [0, 0, 0]; for (let i = 0; i < P.length; i++) n = n.map((v, k) => v + crs(P[i], P[(i + 1) % P.length])[k]); return Math.hypot(...n) / 2; }

// ── the decal ───────────────────────────────────────────────────────────────────
// a convex polygon (u, v) clipped by a convex one (either winding)
function clipConvex(subject, clip) {
  const s = clip.reduce((t, p, i) => { const q = clip[(i + 1) % clip.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], inside = (p) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-12;
    const src = out; out = [];
    for (let j = 0; j < src.length; j++) {
      const p = src[j], q = src[(j + 1) % src.length], ip = inside(p), iq = inside(q);
      if (ip) out.push(p);
      if (ip !== iq) {
        const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]), t = d1 / (d1 - d2);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** Convex shapes ((u, v) polygons in metres, u across and v up a frame A = { at, out, up }) laid on the faces turned
 *  toward A.out that lie under them, conforming to each (a piece per face, on its plane, `lift` proud). `look(face)` →
 *  { material, albedo } or null to pass a face by. Within `depth` of A.at along A.out. */
export function decal(faces, A, shapes, look, { lift = 0.0016, depth = 0.6, fitting = 'mark' } = {}) {
  const out = unit(A.out), up = unit(sub(A.up, out.map((v) => v * dot(A.up, out)))), ex = crs(up, out);
  const bound = shapes.flat().reduce((m, [u, v]) => Math.max(m, Math.abs(u), Math.abs(v)), 0);
  const res = [];
  for (const f of faces) {
    const n = f.outNormal, c = dot(n, out);
    if (c < 0.35) continue;
    const uv = f.corners.map((p) => { const d = sub(p, A.at); return [dot(d, ex), dot(d, up), dot(d, out)]; });
    if (uv.every((q) => Math.abs(q[2]) > depth) || uv.every((q) => q[0] > bound) || uv.every((q) => q[0] < -bound) || uv.every((q) => q[1] > bound) || uv.every((q) => q[1] < -bound)) continue;
    const L = look(f);
    if (!L) continue;
    const f0 = f.corners[0], cn = (f.cornerNormals ?? [n]).reduce((t, v) => t.map((x, k) => x + v[k]), [0, 0, 0]), m = unit(cn).map(r6);
    for (const shape of shapes) {
      const poly = clipConvex(uv.map((q) => [q[0], q[1]]), shape);
      if (poly.length < 3) continue;
      const pts = poly.map(([u, v]) => {
        const p = [0, 1, 2].map((k) => A.at[k] + ex[k] * u + up[k] * v), t = dot(sub(f0, p), n) / c;
        return [0, 1, 2].map((k) => r6(p[k] + out[k] * t + n[k] * lift));
      });
      if (areaOf(pts) < 1e-7) continue;
      res.push({ corners: woundTo(pts, n), part: f.part, material: L.material, albedo: L.albedo, outNormal: n, cornerNormals: pts.map(() => m), fitting });
    }
  }
  return res;
}

// ── the shapes ──────────────────────────────────────────────────────────────────
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const ngon = (r, k = 16, c = [0, 0]) => Array.from({ length: k }, (_, i) => [c[0] + r * Math.cos((2 * Math.PI * i) / k), c[1] + r * Math.sin((2 * Math.PI * i) / k)]);
// a ring as k quads between two radii
const ring = (r0, r1, k = 16) => Array.from({ length: k }, (_, i) => { const a = (2 * Math.PI * i) / k, b = (2 * Math.PI * (i + 1)) / k; return [[r0 * Math.cos(a), r0 * Math.sin(a)], [r1 * Math.cos(a), r1 * Math.sin(a)], [r1 * Math.cos(b), r1 * Math.sin(b)], [r0 * Math.cos(b), r0 * Math.sin(b)]]; });
/** A number's figures, h high, centred: the stencil's segments as rectangles. */
function digits(number, h) {
  const { SEG, DIGIT } = STENCIL, w = 0.6 * h, gap = 0.18 * h, W = number.length * w + (number.length - 1) * gap, out = [];
  // (a dash its middle bar)
  [...number].forEach((d, i) => { const x0 = -W / 2 + i * (w + gap); for (const sg of d === '-' ? 'g' : DIGIT[Number(d)]) { const [a, b, c, e] = SEG[sg]; out.push(rect(x0 + a * h, b * h - h / 2, x0 + c * h, e * h - h / 2)); } });
  return out;
}
const outline = (w, h, t) => [rect(-w / 2, -h / 2, w / 2, -h / 2 + t), rect(-w / 2, h / 2 - t, w / 2, h / 2), rect(-w / 2, -h / 2, -w / 2 + t, h / 2), rect(w / 2 - t, -h / 2, w / 2, h / 2)];

// ── the marks ───────────────────────────────────────────────────────────────────
const WARN = '#a8392c';
const WALK = '#2b2d2f';
/** Low-visibility: a mark a step darker than a pale paint, a step paler than a dark one. */
const lowVis = (albedo) => (lum(albedo) > 120 ? scaleBy(albedo, 0.72) : mixHex(albedo, '#d6d8d4', 0.32));

/** The marks laid on the stage's items, in place: each a decal on its item's own skin (its faces that are no fitting). */
export function markCraft(stage, L, { seed = 1 } = {}) {
  if (!L?.marks) return stage;
  const M = L.marks, number = M.number === false ? null : M.number ?? String(100 + (((L.seed ?? seed) * 2654435761) >>> 0) % 900);
  const skinOf = (it) => it.fs.filter((f) => !f.fitting && SKINS.includes(f.material));
  const lay = (it, A, shapes, look, opts) => { it.fs.push(...decal(skinOf(it), A, shapes, look, opts)); };
  const mark = (f) => ({ material: f.material, albedo: lowVis(f.albedo) });
  const frame = stage.find((it) => it.kind === 'drone-frame');
  if (frame) return markDrone(stage, frame, M, { number, seed: L.seed ?? seed, skinOf, lay, mark });
  const boat = stage.find((it) => it.kind === 'boat-hull');
  if (boat) return markBoat(stage, boat, M, { number, seed: L.seed ?? seed, mark });
  const hull = stage.find((it) => it.kind === 'craft-fuselage');
  if (hull) {
    const fs = skinOf(hull), [y0, y1] = extentOf(fs, 1), [z0, z1] = extentOf(fs, 2), Lh = y1 - y0, H = z1 - z0, zc = (z0 + z1) / 2;
    for (const sx of [1, -1]) {
      // the emblem on each side aft of the wing's root, the side number on the nose
      const emb = (y, h) => (M.emblem === 'disc' ? [...ring(h * 0.34, h * 0.5), ngon(h * 0.2, 14)] : M.emblem === 'bar' ? [rect(-h, -h * 0.17, h, h * 0.17)] : []);
      lay(hull, { at: [0, y1 - 0.66 * Lh, zc], out: [sx, 0, 0], up: [0, 0, 1] }, emb(0, H * 0.42), mark, { depth: 3 });
      if (number) lay(hull, { at: [0, y1 - 0.17 * Lh, zc + H * 0.05], out: [sx, 0, 0], up: [0, 0, 1] }, digits(number.slice(-2), H * 0.2), mark, { depth: 3 });
      // the ejection warning by the canopy's front, a red triangle
      const can = stage.find((it) => it.kind === 'craft-canopy');
      if (M.warnings && can) {
        const [cy0, cy1] = extentOf(can.fs, 1), [cz0] = extentOf(can.fs, 2), h = Math.min(0.2, H * 0.12);
        lay(hull, { at: [0, cy1 - 0.15 * (cy1 - cy0), cz0 - h * 0.9], out: [sx, 0, 0], up: [0, 0, 1] }, [[[-h * 0.58, -h * 0.5], [h * 0.58, -h * 0.5], [0, h * 0.5]]], () => ({ material: 'airPaint', albedo: WARN }), { depth: 3 });
      }
    }
  }
  for (const it of stage) {
    const fs = skinOf(it);
    if (!fs.length) continue;
    if (it.kind === 'craft-fin' && number) {
      // the tail number on both sides of each fin
      const [y0, y1] = extentOf(fs, 1), [z0, z1] = extentOf(fs, 2), [x0, x1] = extentOf(fs, 0), h = (z1 - z0) * 0.14;
      for (const sx of [1, -1]) lay(it, { at: [(x0 + x1) / 2, y0 + 0.42 * (y1 - y0), z0 + 0.42 * (z1 - z0)], out: [sx, 0, 0], up: [0, 0, 1] }, digits(number, h), mark, { depth: 2 });
    }
    if (it.kind === 'craft-wing') {
      const [x0, x1] = extentOf(fs, 0), [y0, y1] = extentOf(fs, 1), [, z1] = extentOf(fs, 2), right = x0 + x1 > 0, span = x1 - x0;
      const tip = right ? x1 : x0, root = right ? x0 : x1, dir = right ? 1 : -1;
      // the emblem, on the left wing's upper face and the right wing's lower; the walkway by the root, on top
      if (M.emblem) {
        const at = [tip - dir * 0.28 * span, y0 + 0.52 * (y1 - y0), z1], h = Math.min(span * 0.36, (y1 - y0) * 0.36);
        lay(it, { at, out: [0, 0, right ? -1 : 1], up: [0, 1, 0] }, M.emblem === 'disc' ? [...ring(h * 0.34, h * 0.5), ngon(h * 0.2, 14)] : [rect(-h, -h * 0.17, h, h * 0.17)], mark, { depth: 2 });
      }
      if (M.warnings) lay(it, { at: [root + dir * 0.2 * span, y0 + 0.62 * (y1 - y0), z1], out: [0, 0, 1], up: [0, 1, 0] }, outline(Math.min(0.9, span * 0.22), Math.min(1.1, (y1 - y0) * 0.3), 0.035), () => ({ material: 'airTrim', albedo: WALK }), { depth: 2 });
    }
  }
  return stage;
}

// what a mark is laid on: a skin's paint, a drone's moulding or its carbon
const SKINS = Object.freeze(['airPaint', 'plastic', 'carbon']);
const HIVIS = '#ff6a1a';
const SERIAL = '#ece9e0';

/** A drone's marks: military, its number low-visibility on its frame's sides and its emblem on top; civil, its
 *  registration on its sides, its serial plate on top, and (hiVis) orange bands round its arms' tips. */
function markDrone(stage, frame, M, { number, seed, skinOf, lay, mark }) {
  const fs = skinOf(frame);
  if (!fs.length) return stage;
  const [x0, x1] = extentOf(fs, 0), [y0, y1] = extentOf(fs, 1), [z0, z1] = extentOf(fs, 2), Lf = y1 - y0, H = z1 - z0, W = x1 - x0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, zc = (z0 + z1) / 2;
  const dark = (f) => ({ material: f.material, albedo: lum(f.albedo) > 120 ? scaleBy(f.albedo, 0.32) : mixHex(f.albedo, '#e6e6e0', 0.75) });
  if (M.style === 'civil') {
    // a registration (generic: three figures, a dash, four), from the seed unless a number is named
    const r = ((seed * 2654435761) >>> 0) % 10000000, code = M.number ? `${M.number}` : `${String(Math.floor(r / 10000)).padStart(3, '0')}-${String(r % 10000).padStart(4, '0')}`;
    const h = Math.min(H * 0.26, Lf * 0.08);
    for (const sx of [1, -1]) lay(frame, { at: [cx, cy, zc], out: [sx, 0, 0], up: [0, 0, 1] }, digits(code, h), dark, { depth: W });
    // the serial plate on top, aft: a pale plate, its figures small on it
    const pw = Math.min(W * 0.4, 0.09), ph = pw * 0.45, at = [cx, y0 + Lf * 0.22, z1];
    lay(frame, { at, out: [0, 0, 1], up: [0, 1, 0] }, [rect(-pw / 2, -ph / 2, pw / 2, ph / 2)], (f) => ({ material: f.material, albedo: SERIAL }), { depth: H });
    frame.fs.push(...decal(frame.fs.filter((f) => f.fitting === 'mark' && f.albedo === SERIAL), { at, out: [0, 0, 1], up: [0, 1, 0] }, digits(code.replace('-', '').slice(-4), ph * 0.5), () => ({ material: 'plastic', albedo: '#2a2a28' }), { lift: 0.0026, depth: H }));
    if (M.hiVis) for (const arm of stage.filter((it) => it.kind === 'drone-arm')) {
      // a band round the arm near its tip: the arm's own run out from the frame, the band across it, seen from above
      const pts = skinOf(arm).flatMap((f) => f.corners);
      if (!pts.length) continue;
      const far = pts.reduce((b, p) => (Math.hypot(p[0] - cx, p[1] - cy) > Math.hypot(b[0] - cx, b[1] - cy) ? p : b)), d = Math.hypot(far[0] - cx, far[1] - cy) || 1;
      const dir = [(far[0] - cx) / d, (far[1] - cy) / d, 0], len = Math.min(0.12, d * 0.18), at = [far[0] - dir[0] * len * 1.6, far[1] - dir[1] * len * 1.6, far[2]];
      lay(arm, { at, out: [0, 0, 1], up: dir }, [rect(-len, -len / 2, len, len / 2)], (f) => ({ material: f.material, albedo: HIVIS }), { depth: 0.2 });
    }
    return stage;
  }
  // military: the number on both sides, low-visibility; the emblem on top
  if (number) for (const sx of [1, -1]) lay(frame, { at: [cx, cy, zc], out: [sx, 0, 0], up: [0, 0, 1] }, digits(number.slice(-3), Math.min(H * 0.3, Lf * 0.1)), mark, { depth: W });
  if (M.emblem) { const h = Math.min(W, Lf) * 0.32; lay(frame, { at: [cx, cy - Lf * 0.1, z1], out: [0, 0, 1], up: [0, 1, 0] }, M.emblem === 'disc' ? [...ring(h * 0.34, h * 0.5), ngon(h * 0.2, 14)] : [rect(-h * 0.5, -h * 0.09, h * 0.5, h * 0.09)], mark, { depth: H }); }
  return stage;
}

/** A boat's marks, on its outermost skin (a hull's topsides, or a RIB's collar over them): military, its number on both
 *  bows and its emblem amidships, a tone on its paint (stronger than an airframe's: read across the water); civil, its registration on both bows, dark on a pale hull and pale on a
 *  dark one. A registration is generic, never a real register's format. */
function markBoat(stage, hull, M, { number, seed, mark }) {
  const fs = hull.fs.filter((f) => !f.fitting && ['airPaint', 'airTrim'].includes(f.material));
  if (!fs.length) return stage;
  const [y0, y1] = extentOf(fs, 1), Lb = y1 - y0;
  // (the side a mark is laid on at [ya, yb]: the faces turned out to that side, the outermost of them, the mark as tall
  // as a share of their height)
  const lay = (sx, ya, yb, shapesOf, look) => {
    const S = fs.filter((f) => f.outNormal[0] * sx > 0.6 && Math.abs(f.outNormal[2]) < 0.55 && (() => { const c = centre(f.corners); return c[1] > ya && c[1] < yb; })());
    if (!S.length) return;
    // (laid on every face turned out within its depth: the topsides, and a collar's tube over them, the outermost seen)
    // (its plane where the mark's middle is: a ship's bow narrows along a mark's length)
    const yc = (ya + yb) / 2, near = S.filter((f) => Math.abs(centre(f.corners)[1] - yc) < (yb - ya) / 6), Sm = near.length ? near : S;
    let xm = -Infinity;
    for (const f of Sm) for (const c of f.corners) xm = Math.max(xm, c[0] * sx);
    // (a face's outermost corner: a long face at a narrowing bow leans in along its length)
    const outer = Sm.filter((f) => Math.max(...f.corners.map((c) => c[0] * sx)) > xm - 0.14);
    // (half a metre tall at most on a boat; a ship's a fiftieth of its length, its hull number read from the next ship)
    const [z0, z1] = extentOf(outer, 2), h = Math.min(Math.max(0.5, Lb * 0.02), (z1 - z0) * 0.42);
    hull.fs.push(...decal(S, { at: [sx * xm, yc, (z0 + z1) / 2], out: [sx, 0, 0], up: [0, 0, 1] }, shapesOf(h), look, { depth: Math.max(0.6, h * 0.4) }));
  };
  const bow = [y1 - 0.3 * Lb, y1 - 0.12 * Lb];
  if (M.style === 'civil') {
    const r = ((seed * 2654435761) >>> 0) % 10000000, code = M.number ? `${M.number}` : `${String(Math.floor(r / 10000)).padStart(3, '0')}-${String(r % 10000).padStart(4, '0')}`;
    const contrast = (f) => ({ material: f.material, albedo: lum(f.albedo) > 120 ? scaleBy(f.albedo, 0.28) : mixHex(f.albedo, '#ecebe4', 0.82) });
    for (const sx of [1, -1]) lay(sx, ...bow, (h) => digits(code, h * 0.55), contrast);
    return stage;
  }
  // (low-visibility, read across the water: a tone on its paint, stronger than an airframe's)
  const naval = (f) => ({ material: f.material, albedo: lum(f.albedo) > 120 ? scaleBy(f.albedo, 0.6) : mixHex(f.albedo, '#d6d8d4', 0.55) });
  void mark;
  if (number) for (const sx of [1, -1]) lay(sx, ...bow, (h) => digits(number.slice(-3), h), naval);
  if (M.emblem) for (const sx of [1, -1]) lay(sx, y0 + 0.42 * Lb, y0 + 0.58 * Lb, (h) => (M.emblem === 'disc' ? [...ring(h * 0.34, h * 0.5), ngon(h * 0.2, 14)] : [rect(-h, -h * 0.17, h, h * 0.17)]), naval);
  return stage;
}

// ── the wear ────────────────────────────────────────────────────────────────────
export const AIR_WEAR = Object.freeze({
  pristine: Object.freeze({ streaks: 0, chips: 0, soot: 0, fade: 0, patches: 0 }),
  used: Object.freeze({ streaks: 22, chips: 40, soot: 0.45, fade: 0.1, patches: 3 }),
  battered: Object.freeze({ streaks: 60, chips: 120, soot: 0.8, fade: 0.2, patches: 7 }),
});
const SOOT = '#2a2b2a';
// (a boat's salt, dried pale in its streaks; what of a boat its wear is laid on)
const SALT = '#d8dbd4';
const BOAT_SKINS = Object.freeze(['boat-hull', 'boat-console', 'boat-top']);
const BARE = '#9aa0a5';

/** The wear laid on the stage's items, in place: the sun's fade and the engine's soot per corner, then the gun's soot,
 *  repainted panels, grime streaks running aft and chips along the leading edges as decals. */
export function wearCraft(stage, W, { seed = 1 } = {}) {
  const A = AIR_WEAR[W?.level];
  if (!A || W.level === 'pristine') return stage;
  const rnd = mulberry32(((seed * 9173) + 29) | 0);
  // (its marks of wear its own size: a drone's streaks, patches and chips a fraction of an aircraft's, and fewer)
  const [cy0, cy1] = extentOf(stage.flatMap((it) => it.fs), 1), g = Math.max(0.06, Math.min(1, (cy1 - cy0) / 12)), count = (n) => Math.round(n * Math.max(0.25, g));
  // ── per corner: the sun's fade on what faces up; the engine's soot over the hull's end and on its nozzle
  const eng = stage.filter((it) => it.kind === 'craft-engine'), hull = stage.find((it) => it.kind === 'craft-fuselage');
  const exits = eng.map((it) => { const [y0] = extentOf(it.fs, 1); return { y: y0, x: centre(it.fs.flatMap((f) => f.corners))[0] }; });
  const soot = (p) => Math.max(0, ...exits.map((e) => (p[1] < e.y + 2.4 && Math.abs(p[0] - e.x) < 2 ? A.soot * Math.exp(-(p[1] - e.y) / 0.9) : 0)));
  for (const it of stage) {
    it.fs = it.fs.map((f) => {
      if (!['airPaint', 'airTrim', 'airMetal'].includes(f.material)) return f;
      const ns = f.cornerNormals ?? f.corners.map(() => f.outNormal);
      const corner = f.corners.map((p, j) => {
        let c = f.albedo;
        if (A.fade && ns[j][2] > 0.4 && f.material !== 'airMetal') { const l = lum(c) * 1.1 + 12; c = mixHex(c, hex([l, l, l]), A.fade * ns[j][2]); }
        const k = (it === hull || it.kind === 'craft-engine') ? Math.min(0.85, soot(p) * (0.6 + 0.8 * noise3([p[0] / 0.25, p[1] / 0.6, p[2] / 0.25], 41))) : 0;
        return k > 0.01 ? mixHex(c, SOOT, k) : c;
      });
      return corner.every((h) => h === f.albedo) ? f : { ...f, cornerAlbedo: corner };
    });
  }
  const skinOf = (it) => it.fs.filter((f) => !f.fitting && ['airPaint', 'airTrim', 'plastic', 'carbon'].includes(f.material));
  // ── the gun's soot: a plume aft of each gun's muzzle on the hull beside it
  if (hull) for (const g of stage.filter((it) => it.kind === 'craft-weapon' && ['rotary', 'cannon'].includes(it.family))) {
    const pts = g.fs.flatMap((f) => f.corners), [, my1] = extentOf(g.fs, 1), c = centre(pts), sx = c[0] >= 0 ? 1 : -1;
    const plume = [[-0.07, 0.15], [0.07, 0.15], [0.24, -1.6], [-0.24, -1.6]].map(([u, v]) => [u, -v]);
    hull.fs.push(...decal(skinOf(hull), { at: [c[0], my1, c[2]], out: [sx, 0, 0], up: [0, -1, 0] }, [plume], (f) => ({ material: f.material, albedo: mixHex(f.albedo, SOOT, 0.55 * (A.soot + 0.3)) }), { lift: 0.002, depth: 3, fitting: 'wear' }));
  }
  // where a decal falls: a face of the skin picked by its area, a point in it
  const pick = (cands) => {
    const areas = cands.map((x) => areaOf(x.f.corners)), tot = areas.reduce((t, a) => t + a, 0);
    let r = rnd() * tot, i = 0;
    while (i < cands.length - 1 && r > areas[i]) r -= areas[i++];
    const { f, it } = cands[i], P = f.corners, a = rnd(), b = rnd() * (1 - a), k = 1 + Math.floor(rnd() * (P.length - 2));
    return { it, f, p: [0, 1, 2].map((j) => P[0][j] * (1 - a - b) + P[k][j] * a + P[k + 1][j] * b) };
  };
  // (an aircraft's hull, wings and nacelles; a drone's frame and arms; a boat's hull and what stands on it)
  const boat = stage.some((it) => it.kind === 'boat-hull');
  const skins = stage.filter((it) => it.kind === 'craft-fuselage' || PLATE[it.kind] || it.kind === 'craft-engine' || it.kind === 'drone-frame' || it.kind === 'drone-arm' || BOAT_SKINS.includes(it.kind));
  const faceUp = skins.flatMap((it) => skinOf(it).filter((f) => f.outNormal[2] > -0.3 && ['airPaint', 'plastic', 'carbon'].includes(f.material)).map((f) => ({ f, it })));
  // flow: aft along the skin (-y laid into the face); a boat's down it (rain and spray running off its sides)
  const aftOn = (n) => { const d = boat ? [0, 0, -1] : [0, -1, 0], t = sub(d, n.map((v) => v * dot(d, n))); return Math.hypot(...t) < 0.2 ? (boat ? [0, -1, 0] : [0, 0, -1]) : unit(t); };
  // ── repainted panels: a rectangle of fresher paint (the colour under it, less faded)
  for (let i = 0; i < count(A.patches) && faceUp.length; i++) {
    const { it, f, p } = pick(faceUp), w = (0.3 + rnd() * 0.5) * g, h = (0.25 + rnd() * 0.45) * g;
    it.fs.push(...decal(skinOf(it), { at: p, out: f.outNormal, up: aftOn(f.outNormal) }, [rect(-w / 2, -h / 2, w / 2, h / 2)], (g) => (['airPaint', 'plastic'].includes(g.material) ? { material: g.material, albedo: scaleBy(g.albedo, 1.07) } : null), { lift: 0.0009, depth: 0.4, fitting: 'wear' }));
  }
  // ── grime streaks: from a point on the skin, aft with the flow, tapering
  for (let i = 0; i < count(A.streaks) && faceUp.length; i++) {
    const { it, f, p } = pick(faceUp), len = (0.5 + rnd() * (0.6 + 1.2 * A.soot)) * g, w = (0.02 + rnd() * 0.045) * Math.max(0.2, g), k = 0.84 + rnd() * 0.09;
    // (on a boat's dark paint the streak is salt, paler; on a pale one, grime)
    const streak = (g) => ({ material: g.material, albedo: boat && lum(g.albedo) < 110 ? mixHex(g.albedo, SALT, 0.2 + (1 - k) * 0.6) : scaleBy(g.albedo, k) });
    it.fs.push(...decal(skinOf(it), { at: p, out: f.outNormal, up: aftOn(f.outNormal) }, [[[-w, 0], [w, 0], [w * 0.35, len], [-w * 0.35, len]]], streak, { lift: 0.0021, depth: 0.3, fitting: 'wear' }));
  }
  // ── chips: the paint off to bare metal along the leading edges (what faces the air ahead) and the intake's lip
  // (what meets the air or the ground first: a wing's leading edge, an intake's lip, a drone's arms and its frame's nose)
  // (a boat's bow, what meets the sea and the quay first)
  const ahead = stage.filter((it) => PLATE[it.kind] || it.kind === 'craft-intake' || it.kind === 'drone-arm' || it.kind === 'drone-frame' || it.kind === 'boat-hull').flatMap((it) => skinOf(it).filter((f) => f.outNormal[1] > 0.45).map((f) => ({ f, it })));
  for (let i = 0; i < count(A.chips) && ahead.length; i++) {
    const { it, f, p } = pick(ahead), r = (0.008 + rnd() * 0.022) * Math.max(0.25, g), k = 5 + Math.floor(rnd() * 3);
    const chip = Array.from({ length: k }, (_, j) => { const a = (2 * Math.PI * j) / k, rr = r * (0.6 + 0.4 * rnd()); return [rr * Math.cos(a), rr * Math.sin(a)]; });
    it.fs.push(...decal(skinOf(it), { at: p, out: f.outNormal, up: aftOn(f.outNormal) }, [chip], () => ({ material: 'airMetal', albedo: BARE }), { lift: 0.0025, depth: 0.2, fitting: 'wear' }));
  }
  return stage;
}
