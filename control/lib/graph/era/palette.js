/**
 * PALETTE LOCK — a level's colours as RAMPS: each a list of stops ([r, g, b] 0–255) from its darkest to its lightest.
 * Shading moves a colour ALONG its ramp, never off it:
 *   · `onRamp(rgb, ramp)` → the nearest point on the ramp's polyline (rgb 0–1 in and out): the lock for a baked colour
 *   · `lockFaces(faces, rampOf)` → every baked `fill` and `cornerFills` of a face whose group has a ramp, projected
 *   · `rampDistance(rgb, ramp)` → how far a colour sits off its ramp (the machine gate's measure)
 * A tile is locked harder still: it is painted from the stops alone (isekai-tiles.js). Deterministic; no dice.
 */
import { hexRgb, rgbHex } from './geom.js';

const near = (p, a, b) => {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const t = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L)) : 0;
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
};
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const unitStops = (ramp) => ramp.map((s) => s.map((v) => v / 255));

/** The nearest point to `rgb` (0–1) on the ramp's polyline. */
export function onRamp(rgb, ramp) {
  const S = unitStops(ramp);
  if (S.length === 1) return S[0];
  let best = null, bd = Infinity;
  for (let i = 0; i + 1 < S.length; i++) { const q = near(rgb, S[i], S[i + 1]), d = d2(rgb, q); if (d < bd) { bd = d; best = q; } }
  return best;
}

/** The largest per-channel distance (0–1) from `rgb` to its ramp. */
export function rampDistance(rgb, ramp) {
  const q = onRamp(rgb, ramp);
  return Math.max(...rgb.map((v, k) => Math.abs(v - q[k])));
}

/** The point `t` (0 = darkest stop, 1 = lightest) along the ramp, by stop index. */
export function rampAt(ramp, t) {
  const S = unitStops(ramp), x = Math.max(0, Math.min(1, t)) * (S.length - 1), i = Math.min(S.length - 2, Math.floor(x)), f = x - i;
  return S.length === 1 ? S[0] : S[i].map((v, k) => v + (S[i + 1][k] - v) * f);
}

const lockHex = (h, ramp) => rgbHex(onRamp(hexRgb(h), ramp));
/** Every baked colour of a face whose group `rampOf(face)` names a ramp, moved onto it. Other faces pass untouched. */
export function lockFaces(faces, rampOf) {
  return faces.map((f) => {
    const ramp = rampOf(f);
    if (!ramp || (!f.fill && !f.cornerFills)) return f;
    return { ...f, ...(f.fill ? { fill: lockHex(f.fill, ramp) } : {}), ...(f.cornerFills ? { cornerFills: f.cornerFills.map((c) => lockHex(c, ramp)) } : {}) };
  });
}
