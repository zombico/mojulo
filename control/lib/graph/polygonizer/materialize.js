/**
 * materialize — the PRESENCE primitive: ∅ ⇄ form. The sibling of carve (substance:
 * wire ⇄ skin) and transfigure (identity: form A ⇄ form B). Where transfigure
 * needs two forms, materialize needs one — it brings it into being from nothing.
 *
 * Built from carve's wire/skin: the form's WIREFRAME draws on from nothing (the
 * hologram boot-up — a leading reveal arc + a slight rise), then the SKIN
 * solidifies over it. Pure geometry: (contours, class, phase) → a presence state
 * the carve renderer draws (partial wire × wireAlpha, extruded skin × skinAlpha).
 *
 * `dematerialize` is NOT a second thing — it is materialize run in reverse
 * (phase → 1−phase), exactly as deskin is carve reversed.
 *
 * A CLASS (MATERIALIZE_CLASSES) is a style — the beat schedule + wire look.
 */

const smooth01 = (x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };
const sArea = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };
const asRings = (c) => (Array.isArray(c) && Array.isArray(c[0]) && typeof c[0][0] === 'number') ? [c] : c;
const outerRing = (c) => asRings(c).reduce((a, b) => (Math.abs(sArea(b)) > Math.abs(sArea(a)) ? b : a));
function resample(ring, n) {
  const seg = []; let tot = 0;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push({ a, b, d, acc: tot }); tot += d; }
  const out = [];
  for (let k = 0; k < n; k++) { const t = (k / n) * tot; const s = seg.find((s) => t >= s.acc && t < s.acc + s.d) || seg[seg.length - 1]; const f = s.d ? (t - s.acc) / s.d : 0; out.push([s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f]); }
  return out;
}
const bcentroid = (rings) => { let x = 0, y = 0, n = 0; for (const r of rings) for (const p of r) { x += p[0]; y += p[1]; n++; } return [x / n, y / n]; };
const scaleAbout = (rings, c, s) => rings.map((r) => r.map((p) => [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s]));
// ── particle-field helpers (the `particles` mode: transporter) ──
const mulberry32 = (a) => { a >>>= 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const norm3v = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3v = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function ringsBbox(rings) { let a = [Infinity, Infinity], b = [-Infinity, -Infinity]; for (const r of rings) for (const p of r) { a = [Math.min(a[0], p[0]), Math.min(a[1], p[1])]; b = [Math.max(b[0], p[0]), Math.max(b[1], p[1])]; } return { a, b }; }
function pointInRings(p, rings) { let inside = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const yi = r[i][1], yj = r[j][1]; if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (r[j][0] - r[i][0]) * (p[1] - yi) / (yj - yi) + r[i][0])) inside = !inside; } return inside; }
function sampleInside(rings, count, rand) { const { a, b } = ringsBbox(rings); const out = []; let tries = 0; while (out.length < count && tries < count * 50) { const x = a[0] + rand() * (b[0] - a[0]), y = a[1] + rand() * (b[1] - a[1]); if (pointInRings([x, y], rings)) out.push([x, y]); tries++; } return out; }

// ── materialize CLASSES — a style = a beat schedule + a wire look ──
export const MATERIALIZE_CLASSES = {
  // hologram: wire draws on (0→0.55) with a slight rise, skin solidifies (0.45→1).
  hologram: { mode: 'reveal', wireIn: [0, 0.55], skinIn: [0.45, 1], rise: [0.88, 1], wire: { color: '#34e0ff', core: '#eaffff' } },
  // doom-platform: a glowing plane sweeps; the form PRINTS as the plane passes
  // (the renderer clips the skin to the swept region + draws the scan plane).
  // dematerialize (reverse) = the plane sweeps back, deprinting the form.
  doom: { mode: 'platform', sweep: [0.05, 0.95], plane: { color: '#ff7a2a', core: '#ffe6b0' } },
  // transporter: a dim scattered cloud CONVERGES along sine paths + brightens to
  // the form, then the skin solidifies. (Its reverse dematerializes the same way.)
  transporter: { mode: 'particles', count: 520, drift: 0.55, driftMode: 'radial', swirl: 0.16, flowSpeed: 5, driftWin: [0, 0.62], skinIn: [0.58, 1], color: '#cfeaff', size: 0.012, twinkle: 0.55, style: 'spark' },
};
export const MATERIALIZE_CLASS_NAMES = Object.keys(MATERIALIZE_CLASSES);

/** Fix the geometry once (resample the reveal ring, centroid). */
export function prepareMaterialize(contours, { klass = 'hologram', samples = 150 } = {}) {
  const rings = asRings(contours);
  const base = { rings, ring: resample(outerRing(contours), samples), centroid: bcentroid(rings), klass };
  const cls = MATERIALIZE_CLASSES[klass];
  if (cls && cls.mode === 'particles') {
    const rand = mulberry32((cls.count * 2654435761) >>> 0);
    const c = base.centroid;
    base.particles = sampleInside(rings, cls.count, rand).map((h) => {
      const home = [h[0], h[1], (rand() - 0.5) * 0.2];
      const dir = cls.driftMode === 'up'
        ? norm3v([(h[0] - c[0]) * 0.6, 0.7 + rand() * 0.9, (rand() - 0.5) * 0.5])      // ash drifts up + out
        : norm3v([(h[0] - c[0]) + (rand() - 0.5) * 0.4, (h[1] - c[1]) + (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.7]);
      const ref = Math.abs(dir[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];                       // two perp axes for the sine-path swirl
      const perp1 = norm3v(cross3v(dir, ref)), perp2 = cross3v(dir, perp1);
      return { home, dir, perp1, perp2, seed: rand(), tone: rand() };
    });
  }
  return base;
}

/**
 * Presence state at `phase` 0→1.
 * @returns {{ contours, wireRing, reveal, skinAlpha, wireAlpha, wire }} — geometry
 *   scaled by the rise; wire drawn up to `reveal` of `wireRing`; skin × skinAlpha.
 */
export function materialize(prep, phase) {
  const cls = MATERIALIZE_CLASSES[prep.klass] || MATERIALIZE_CLASSES.hologram;
  const win = (w) => smooth01((phase - w[0]) / (w[1] - w[0]));
  // platform mode: a swept clip plane prints the form; the renderer clips by `scan`.
  if (cls.mode === 'platform') {
    return { mode: 'platform', scan: win(cls.sweep), contours: prep.rings, plane: cls.plane };
  }
  // particle mode: a scattered cloud converges (+ brightens), then the skin solidifies.
  if (cls.mode === 'particles') {
    const driftF = 1 - win(cls.driftWin);           // 1 = fully scattered, 0 = converged at home
    const skinAlpha = win(cls.skinIn);
    const sw = (cls.swirl || 0) * driftF, fs = cls.flowSpeed || 4;   // sine-path swirl, vanishes as it converges
    const particles = prep.particles.map((pt) => {
      const k = cls.drift * driftF;
      const a1 = sw * Math.sin(pt.seed * 6.2832 + phase * fs), a2 = sw * Math.cos(pt.seed * 8.17 + phase * fs * 0.8);
      const pos = [
        pt.home[0] + pt.dir[0] * k + pt.perp1[0] * a1 + pt.perp2[0] * a2,
        pt.home[1] + pt.dir[1] * k + pt.perp1[1] * a1 + pt.perp2[1] * a2,
        pt.home[2] + pt.dir[2] * k + pt.perp1[2] * a1 + pt.perp2[2] * a2,
      ];
      const tw = (1 - cls.twinkle) + cls.twinkle * (0.5 + 0.5 * Math.sin(pt.seed * 6.2832 + phase * 9));
      const alpha = (0.3 + 0.7 * (1 - driftF)) * tw * (1 - skinAlpha);   // faint when scattered → bright as it converges, gone when solid
      return { pos, alpha };
    });
    return { mode: 'particles', particles, skinAlpha, contours: prep.rings, color: cls.color, size: cls.size };
  }
  const reveal = win(cls.wireIn);
  const skinAlpha = win(cls.skinIn);
  const wireAlpha = Math.min(1, reveal * 3) * (1 - 0.78 * skinAlpha);          // bright as it draws, dims as skin fills
  const sc = cls.rise[0] + (cls.rise[1] - cls.rise[0]) * smooth01(Math.min(1, phase / cls.wireIn[1]));
  return {
    contours: scaleAbout(prep.rings, prep.centroid, sc),
    wireRing: prep.ring.map((p) => [prep.centroid[0] + (p[0] - prep.centroid[0]) * sc, prep.centroid[1] + (p[1] - prep.centroid[1]) * sc]),
    reveal, skinAlpha, wireAlpha, wire: cls.wire,
  };
}

/** dematerialize = materialize in reverse. */
export const dematerialize = (prep, phase) => materialize(prep, 1 - phase);
