/**
 * THE FAR RANGE — the mountains round a glyph map read in the form render (gen-7): real ground rising past the map's
 * rim (grid-scene.js RIM) into a range of ridged peaks, laid as a ring of land out to the horizon, in place of the first
 * tile's painted far ring (its standing curtains, scaled round the map). Its faces are the stage's far group
 * (`isekai:ridge`, form/land-read.js FAR_GROUPS), so the form draws them as its far land (channels/form-land.js
 * FAR_LAND): lit in facets, the grass's base low on them rising into the stone toward the peaks, the sky's air over them
 * the farther they stand. A painted read keeps its ring, every byte as it was.
 *
 *   THE RING   the rim's own border points (every RANGE.step metres round the map's box, out along the way from its
 *              middle), carried on outward at RANGE.rings metres past the box, the first ring the rim's outer edge at its
 *              own height, so the range rises out of the rim with no seam
 *   THE PEAKS  ridged noise on the level's frame (three octaves, RANGE.stride), its amplitude growing from nothing at the
 *              rim to RANGE.peak a few hundred metres out, over a slow lift (RANGE.lift): a valley's sides that become
 *              mountains, never a wall at the rim
 *
 *   RANGE                     the range's numbers (metres)
 *   farRange({ box, at, seed, fill, rim }) → [face]: box the map's [x0, y0, x1, y1], at(x, y) the land's height at its
 *                             border, rim { deep, rise } the rim's (grid-scene.js RIM), fill the far's painted colour
 * Pure: value noise on the level's frame, the same map the same range.
 */
import { vnoise } from '../era/dirt.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export const RANGE = Object.freeze({
  step: 6,
  // (each ring's distance past the map's box, m: the first the rim's outer edge)
  rings: Object.freeze([0, 10, 22, 36, 52, 72, 96, 124, 156, 194, 240, 295, 360, 440, 540, 660, 800]),
  peak: 130, lift: 35, grow: Object.freeze([10, 260]), stride: Object.freeze([210, 85, 32]), octave: Object.freeze([0.38, 0.14]),
});

// ridged noise: a crest where the noise crosses its middle, sharpened
const ridged = (x, y, s) => { const n = 1 - Math.abs(2 * vnoise(x, y, s) - 1); return n * n; };

export function farRange({ box, at, seed = 1, fill = '#7aa04a', rim }) {
  const [x0, y0, x1, y1] = box, ring = [];
  const side = (a, b) => { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / RANGE.step)); for (let k = 0; k < n; k++) ring.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); };
  side([x0, y1], [x1, y1]); side([x1, y1], [x1, y0]); side([x1, y0], [x0, y0]); side([x0, y0], [x0, y1]);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, n = ring.length;
  // (out from the border along the way from the map's middle, as the rim is laid)
  const outAt = (k, d) => { const [x, y] = ring[k], ux = x - cx, uy = y - cy, l = Math.hypot(ux, uy) || 1; return [x + (ux / l) * d, y + (uy / l) * d]; };
  const base = ring.map(([x, y]) => at(x, y) - 0.15 + rim.rise);
  const S = seed | 0;
  const z = (k, j) => {
    const d = RANGE.rings[j], [X, Y] = outAt(k, rim.deep + d), g = smooth(RANGE.grow[0], RANGE.grow[1], d);
    const [o1, o2] = RANGE.octave;
    const peaks = ridged(X / RANGE.stride[0], Y / RANGE.stride[0], S + 1501) + o1 * ridged(X / RANGE.stride[1], Y / RANGE.stride[1], S + 1503) + o2 * ridged(X / RANGE.stride[2], Y / RANGE.stride[2], S + 1507);
    return base[k] + RANGE.lift * smooth(0, RANGE.rings.at(-1), d) + RANGE.peak * g * peaks / (1 + o1 + o2);
  };
  const out = [];
  for (let j = 0; j + 1 < RANGE.rings.length; j++) for (let k = 0; k < n; k++) {
    const k1 = (k + 1) % n, p = [[k, j], [k1, j], [k1, j + 1], [k, j + 1]];
    const c = p.map(([a, b]) => [...outAt(a, rim.deep + RANGE.rings[b]), z(a, b)].map(r5));
    // (each quad its own facet's normal, toward the sky)
    const u = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]], v = [c[3][0] - c[1][0], c[3][1] - c[1][1], c[3][2] - c[1][2]];
    let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...nn) || 1; nn = nn.map((q) => q / l); if (nn[2] < 0) nn = nn.map((q) => -q);
    out.push({ corners: c, normal: nn.map(r5), group: 'isekai:ridge', fill, doubleSided: true });
  }
  return out;
}
