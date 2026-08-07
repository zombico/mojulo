/**
 * transfigure — the TEMPORAL primitive, the peer of carve.
 *
 * carve (carve-solid) is SPATIAL: an outline ⇄ a solid (extrude = skin; the
 * solid's edges = wire). transfigure is TEMPORAL: it takes TWO forms and yields
 * the form-at-phase as one BECOMES the other. The default class is built FROM
 * carve and its inverse:
 *     deskin (carve⁻¹: solid → wireframe)  →  morph  →  reskin (carve: wireframe → solid)
 * Reshape the wireframe (the form's "soul") and the skin (the body) follows —
 * after Mahito's Idle Transfiguration (JJK).
 *
 * Other classes can choose a different carrier for the middle state. For example
 * liquid-metal leaves the beveled carve renderer and uses a smooth liquid mass
 * carrier while the outline morphs; chrome is its default render read, not an
 * endpoint material constraint.
 *
 * Pure geometry: no rendering, no carve dependency. It returns the morphed
 * contours + a skin/wire schedule; the carve renderer extrudes `contours` for the
 * skin (× skinAlpha) and draws their edges for the wire (× wireAlpha).
 *
 * The ONE new atom is `morphContours` — a point correspondence between two
 * outlines (resample to N, match winding, best-rotation align, lerp).
 *
 * A CLASS (TRANSFIGURE_CLASSES) is a transfiguration STYLE — the beat schedule +
 * carrier mode + wire look.
 */

const smooth01 = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
const sArea = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };

// accept a single ring ([[x,y],…]) OR a contour set ([[[x,y],…],…]).
const asRings = (c) => (Array.isArray(c) && Array.isArray(c[0]) && typeof c[0][0] === 'number') ? [c] : c;
const outerRing = (c) => asRings(c).reduce((a, b) => (Math.abs(sArea(b)) > Math.abs(sArea(a)) ? b : a));

function resample(ring, n) {
  const seg = []; let tot = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push({ a, b, d, acc: tot }); tot += d; }
  const out = [];
  for (let k = 0; k < n; k++) { const t = (k / n) * tot; const s = seg.find((s) => t >= s.acc && t < s.acc + s.d) || seg[seg.length - 1]; const f = s.d ? (t - s.acc) / s.d : 0; out.push([s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f]); }
  return out;
}
// reindex B (already resampled to A's length) to match A's winding + best rotation.
function align(A, B) {
  const N = A.length;
  if (Math.sign(sArea(A)) !== Math.sign(sArea(B))) B = B.slice().reverse();
  let off = 0, best = Infinity;
  for (let o = 0; o < N; o++) { let d = 0; for (let i = 0; i < N; i += 5) { const p = A[i], q = B[(i + o) % N]; d += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; } if (d < best) { best = d; off = o; } }
  return B.map((_, i) => B[(i + off) % N]);
}
const lerpRing = (A, B, m) => A.map((p, i) => [p[0] + (B[i][0] - p[0]) * m, p[1] + (B[i][1] - p[1]) * m]);

/** The atom: morph one outline into another at m∈[0,1] (one-shot; re-aligns each call). */
export function morphContours(ringA, ringB, m, { samples = 150 } = {}) {
  const A = resample(outerRing(ringA), samples);
  const B = align(A, resample(outerRing(ringB), samples));
  return lerpRing(A, B, m);
}

// ── transfiguration CLASSES — a style = a beat schedule + a wire look ──
export const TRANSFIGURE_CLASSES = {
  // strip → morph → reskin, cyan energized wire (the Galvatron shapeshift)
  galvatron: { schedule: { deskin: 0.22, morphFrom: 0.25, morphTo: 0.75, reskin: 0.78 }, wire: { color: '#34e0ff', core: '#eaffff' } },
  // smooth mass remains present while the contour liquefies and reshapes (T1000-ish);
  // chrome is the default carrier material, not a constraint on A/B materials.
  'liquid-metal': { mode: 'liquid-metal', schedule: { morphFrom: 0.12, morphTo: 0.88 }, material: 'chrome' },
};
export const TRANSFIGURE_CLASS_NAMES = Object.keys(TRANSFIGURE_CLASSES);

/** Fix the correspondence ONCE (resample + align). Cheap to call transfigure() per frame after. */
export function prepareTransfigure(fromContours, toContours, { klass = 'galvatron', samples = 150 } = {}) {
  const A = resample(outerRing(fromContours), samples);
  const B = align(A, resample(outerRing(toContours), samples));
  return { A, B, klass };
}

/**
 * The state at `phase` 0→1: the morphed outline + the skin/wire schedule.
 * @returns {{ contours: number[][][], skinAlpha:number, wireAlpha:number, wire:object, m:number }}
 */
export function transfigure(prep, phase) {
  const cls = TRANSFIGURE_CLASSES[prep.klass] || TRANSFIGURE_CLASSES.galvatron;
  const { deskin, morphFrom, morphTo, reskin } = cls.schedule;
  const m = smooth01((phase - morphFrom) / (morphTo - morphFrom));
  if (cls.mode === 'liquid-metal') {
    return { mode: cls.mode, contours: [lerpRing(prep.A, prep.B, m)], skinAlpha: 1, wireAlpha: 0, material: cls.material, m };
  }
  const skinAlpha = phase < deskin ? 1 - phase / deskin : (phase > reskin ? (phase - reskin) / (1 - reskin) : 0);
  const wireAlpha = phase < deskin ? phase / deskin : (phase > reskin ? 1 - (phase - reskin) / (1 - reskin) : 1);
  return { contours: [lerpRing(prep.A, prep.B, m)], skinAlpha, wireAlpha, wire: cls.wire, m };
}
