// materials/damascus — pattern-welded steel as a layer field: a billet of L0 · 2^folds layers (a bright nickel steel and a
// dark carbon steel, alternating), deformed the way a smith deforms it, then cut by the blade's own surface.
//
// Coordinates are the blade's, in metres: x along the blade, y through its thickness (the layers are parallel to the
// flats, so y is the layer depth), w across it. The layer coordinate is q = y + deform(x, w, y); a point is bright where
// ⌊q / s⌋ is odd. Flats parallel to the layers show the deformation; a bevel cuts down through the layers, so it shows
// bands parallel to the edge. The page draws the same field per pixel (scene/channels/metal.js, figure 8) with the etch
// box-filtered over one pixel, so sub-pixel layers read as their mean grey: Damascus resolves up close and reads as
// steel far off, as the real thing does. This module is the field's definition and the machine gate's reference.
//
// `random` is forging waviness; `ladder` grooves pressed across and ground flat; `raindrop` punched dimples ground flat;
// `twist` the bar turned about its length and forged flat. `scale` multiplies every length (a stylized blade shows a
// bolder pattern). Pure and seeded: an integer hash, no dice.

export const DAMASCUS_TYPES = Object.freeze(['random', 'ladder', 'raindrop', 'twist']);
const MM = 0.001;
export const DAMASCUS_DEFAULTS = Object.freeze({ L0: 7, folds: 4, stock: 4 * MM, wave: 0.35 * MM, depth: 0.9 * MM, rung: 6 * MM, drop: 7 * MM, pitch: 40 * MM, flat: 0.35 });

const hash2 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s, oct = 3) => { let t = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, s + i * 17); a *= 0.5; f *= 2; } return t / (1 - Math.pow(0.5, oct)); };

/** Resolved field options: the defaults, `folds`, and every length times `scale`. */
export function damascusOptions({ folds = DAMASCUS_DEFAULTS.folds, scale = 1, seed = 0 } = {}) {
  const o = { ...DAMASCUS_DEFAULTS, folds, seed };
  for (const k of ['stock', 'wave', 'depth', 'rung', 'drop', 'pitch']) o[k] *= scale;
  o.N = o.L0 * Math.pow(2, folds); o.spacing = o.stock / o.N; o.mm = MM * scale;
  return o;
}

const DEFORM = {
  random: (x, w, y, o) => o.wave * (fbm(x / (9 * o.mm), w / (5 * o.mm), o.seed) - 0.5) * 2,
  ladder: (x, w, y, o) => o.depth * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * x / o.rung), 3) + 0.25 * o.wave * (fbm(x / (9 * o.mm), w / (5 * o.mm), o.seed) - 0.5),
  raindrop: (x, w, y, o) => {
    const s = o.drop, R = 0.36 * s; let best = 0; const ci = Math.floor(x / s), cj = Math.floor(w / (s * 0.866));
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const j = cj + dj, i = ci + di; const cx = (i + (j & 1 ? 0.5 : 0) + 0.1 * (hash2(i, j, o.seed) - 0.5)) * s, cz = j * s * 0.866;
      const r = Math.hypot(x - cx, w - cz) / R; if (r < 1) best = Math.max(best, Math.cos(r * Math.PI / 2) ** 2);
    }
    return o.depth * best + 0.25 * o.wave * (fbm(x / (9 * o.mm), w / (5 * o.mm), o.seed) - 0.5);
  },
  // the square bar turned one turn per pitch about its length (through the blade's centre), then forged flat
  twist: (x, w, y, o) => { const th = 2 * Math.PI * x / o.pitch; return y * Math.cos(th) + w * o.flat * Math.sin(th) - y; },
};

/** The layer coordinate at a point of the blade (metres). */
export function damascusQ(type, x, y, w, o) { return y + (DEFORM[type] || DEFORM.random)(x, w, y, o); }
/** The fraction of bright layer over [q − fw/2, q + fw/2]: the etch, box-filtered over a pixel's footprint `fw`. */
export function brightFraction(q, fw, s) {
  const I = (t) => { const P = 2 * s; const k = Math.floor(t / P); return k * s + Math.min(s, Math.max(0, t - k * P - s)); };
  if (fw < 1e-12) return Math.floor(q / s) & 1 ? 1 : 0;
  return (I(q + fw / 2) - I(q - fw / 2)) / fw;
}

/** Why a `pattern` is invalid (a sentence naming the choices), or null. */
export function damascusError(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return "pattern is { kind: 'damascus', type?, folds?, scale?, layers? }";
  const extra = Object.keys(p).filter((k) => !['kind', 'type', 'folds', 'scale', 'layers'].includes(k));
  if (extra.length) return `pattern takes kind, type, folds, scale, layers — not ${extra.join(', ')}`;
  if (p.kind !== 'damascus') return `pattern.kind is 'damascus' (pattern-welded steel) — got '${p.kind}'`;
  if (p.type != null && !DAMASCUS_TYPES.includes(p.type)) return `pattern.type '${p.type}' is not one of ${DAMASCUS_TYPES.join(', ')}`;
  if (p.folds != null && !(Number.isInteger(p.folds) && p.folds >= 1 && p.folds <= 8)) return 'pattern.folds is a whole number 1–8 (layers = 7 · 2^folds)';
  if (p.scale != null && !(Number.isFinite(p.scale) && p.scale >= 0.25 && p.scale <= 20)) return 'pattern.scale is a number 0.25–20 (every length of the pattern times it)';
  const l = p.layers; if (l != null && !(['x', 'y', 'z'].includes(l) || (Array.isArray(l) && l.length === 3 && l.every(Number.isFinite) && Math.hypot(...l) > 0))) return 'pattern.layers is the axis through the layers: x, y, z or [x, y, z]';
  return null;
}
/** The canonical pattern: every field filled, in a fixed order (part of the surface's key). */
export function canonDamascus(p) {
  return { kind: 'damascus', type: p.type || 'random', folds: p.folds ?? DAMASCUS_DEFAULTS.folds, scale: p.scale ?? 1, layers: p.layers ?? 'y' };
}
