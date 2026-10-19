/**
 * NOISE — the shared lattice noise a ground is grown from: 2D gradient noise, its gradient, fractal sums and the
 * shapers that make a field read as land. One home for what the terrain kernel, the atlas and the landform each carry
 * a copy of, so a new ground takes it from here.
 *
 * Every height path is integer-exact: + − × ÷, Math.floor, Math.sqrt and Math.imul only, never Math.sin, cos, pow or
 * exp (whose last bits differ between engines), so a recipe's field is the same number wherever it is evaluated. The
 * hash and the 8-direction gradient table are the terrain kernel's (`terrain/terrain-kernel.js` gh, gn): `gnoise2` is
 * its `gn` value for value, so moving the kernel onto this module is a byte check, not a re-render.
 *
 *   gnoise2(x, y, seed)            gradient noise, ≈ [−1, 1], 0 at every lattice point
 *   gnoised2(x, y, seed)           → [value, ∂x, ∂y]: the same value and its analytic gradient (the quintic fade is C2,
 *                                  so normals and curvature from it have no creases at the cells)
 *   fractal2(x, y, F)              → [value, ∂x, ∂y]: octaves summed in a flavour (FLAVOURS), ≈ [−1, 1]
 *   warp2(x, y, W)                 → [x', y']: the point pushed by two fractal fields (domain warp)
 *   terrace(h, step, riser)        h stepped into benches `step` high, each rising over `riser` of its step
 *   smoothstep(a, b, x)            the cubic ease, clamped
 *
 * FLAVOURS (F.flavour):
 *   fbm      the plain sum: rolling ground
 *   ridged   Musgrave's ridged multifractal: (1 − |n|)², each octave weighted by the one before, so detail gathers on
 *            the crests and the valleys stay smooth
 *   billow   2|n| − 1: rounded swells split by sharp creases
 *   damped   each octave divided by 1 + damp·|Σ∇n|²: where the coarser octaves are already steep the finer ones fade,
 *            so slopes stay clean and flats take the detail, the look of erosion at no cost (Quilez, "morenoise").
 *            Its gradient leaves out the damping's own derivative: a close lighting normal, not an exact one
 *
 * Octave k samples the plane turned by the exact 3-4-5 rotation k times and scaled by lacunarity^k, with a fixed
 * offset, so no two octaves share a lattice (the grid artefact of unrotated Perlin) and none is pinned to 0 at the
 * origin. Amplitudes are gain^k by repeated multiplication.
 */

// the terrain kernel's gradient table: the four axes and the four diagonals
const GX = [1, -1, 0, 0, 0.7071067811865476, -0.7071067811865476, 0.7071067811865476, -0.7071067811865476];
const GY = [0, 0, 1, -1, 0.7071067811865476, 0.7071067811865476, -0.7071067811865476, -0.7071067811865476];
const SCALE = 1.4142135623730951;
// each octave's turn (cos, sin of ≈36.87°, exact in binary) and shift off the last one's lattice
const RC = 0.8, RS = 0.6, SHIFT_X = 17.31, SHIFT_Y = -9.77;

export const FLAVOURS = Object.freeze(['fbm', 'ridged', 'billow', 'damped']);

function gh(i, j, sd) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(sd, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return (h ^ (h >>> 16)) & 7; }

/** The page's copy of gnoise2 (a World page's spines, effects/beam-channel.js): one closure built from this module's own
 * source, its names kept inside it, so the noise a page draws with is this noise. */
export const GNOISE2_PAGE_SRC = `(() => { const GX = ${JSON.stringify(GX)}, GY = ${JSON.stringify(GY)}, SCALE = ${SCALE}; ${gh.toString()} return ${gnoise2.toString()}; })()`;

/** 2D gradient noise, ≈ [−1, 1]: the terrain kernel's `gn`. */
export function gnoise2(x, y, sd) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const g00 = gh(i, j, sd), g10 = gh(i + 1, j, sd), g01 = gh(i, j + 1, sd), g11 = gh(i + 1, j + 1, sd);
  const n00 = GX[g00] * fx + GY[g00] * fy, n10 = GX[g10] * (fx - 1) + GY[g10] * fy, n01 = GX[g01] * fx + GY[g01] * (fy - 1), n11 = GX[g11] * (fx - 1) + GY[g11] * (fy - 1);
  const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
  return (a + v * (b - a)) * SCALE;
}

/** Gradient noise and its analytic gradient → [value, ∂x, ∂y]. */
export function gnoised2(x, y, sd) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const du = 30 * fx * fx * (fx * (fx - 2) + 1), dv = 30 * fy * fy * (fy * (fy - 2) + 1);
  const g00 = gh(i, j, sd), g10 = gh(i + 1, j, sd), g01 = gh(i, j + 1, sd), g11 = gh(i + 1, j + 1, sd);
  const n00 = GX[g00] * fx + GY[g00] * fy, n10 = GX[g10] * (fx - 1) + GY[g10] * fy, n01 = GX[g01] * fx + GY[g01] * (fy - 1), n11 = GX[g11] * (fx - 1) + GY[g11] * (fy - 1);
  const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
  // a = lerp along x of the bottom row, b of the top; each corner's ramp has the corner's gradient as its slope
  const ax = GX[g00] + du * (n10 - n00) + u * (GX[g10] - GX[g00]), ay = GY[g00] + u * (GY[g10] - GY[g00]);
  const bx = GX[g01] + du * (n11 - n01) + u * (GX[g11] - GX[g01]), by = GY[g01] + u * (GY[g11] - GY[g01]);
  return [(a + v * (b - a)) * SCALE, (ax + v * (bx - ax)) * SCALE, (ay + v * (by - ay) + dv * (b - a)) * SCALE];
}

/**
 * Octaves summed → [value, ∂x, ∂y], value ≈ [−1, 1]. F: { seed, octaves (1..12), lacunarity (2), gain (0.5),
 * flavour ('fbm'), damp (1, the damped flavour's strength) }. The gradient is in the plane's own units.
 */
export function fractal2(x, y, F = {}) {
  const sd = F.seed | 0, oct = F.octaves ?? 4, lac = F.lacunarity ?? 2, gain = F.gain ?? 0.5, fl = F.flavour ?? 'fbm', damp = F.damp ?? 1;
  // q = J·p + c: the octave's sample point; its gradient in the plane is Jᵀ∇n
  let qx = x, qy = y, j00 = 1, j01 = 0, j10 = 0, j11 = 1, f = 1;
  let a = 1, norm = 0, sum = 0, dx = 0, dy = 0;
  let w = 1, wx = 0, wy = 0, ex = 0, ey = 0;   // ridged: the weight and its gradient; damped: Σ∇n in the plane
  for (let o = 0; o < oct; o++) {
    const nd = gnoised2(qx, qy, sd + o * 1013), n = nd[0];
    const gx = j00 * nd[1] + j10 * nd[2], gy = j01 * nd[1] + j11 * nd[2];
    if (fl === 'fbm') { sum += a * n; dx += a * gx; dy += a * gy; }
    else if (fl === 'billow') { const sg = n < 0 ? -2 : 2; sum += a * (sg * n - 1); dx += a * sg * gx; dy += a * sg * gy; }
    else if (fl === 'ridged') {
      const sg = n < 0 ? -1 : 1, r = 1 - sg * n, s0 = r * r, s0x = -2 * r * sg * gx, s0y = -2 * r * sg * gy;
      const s = s0 * w, sx = s0x * w + s0 * wx, sy = s0y * w + s0 * wy;
      sum += a * s; dx += a * sx; dy += a * sy;
      const wn = 2 * s;
      if (wn <= 0) { w = 0; wx = 0; wy = 0; } else if (wn >= 1) { w = 1; wx = 0; wy = 0; } else { w = wn; wx = 2 * sx; wy = 2 * sy; }
    } else if (fl === 'damped') {
      ex += gx / f; ey += gy / f;
      const k = 1 / (1 + damp * (ex * ex + ey * ey));
      sum += a * n * k; dx += a * gx * k; dy += a * gy * k;
    } else throw new Error(`noise: flavour '${fl}' is not one (flavours: ${FLAVOURS.join(', ')})`);
    norm += a; a *= gain; f *= lac;
    // the next octave: turned, scaled, shifted
    const nqx = lac * (RC * qx - RS * qy) + SHIFT_X, nqy = lac * (RS * qx + RC * qy) + SHIFT_Y;
    const n00 = lac * (RC * j00 - RS * j10), n01 = lac * (RC * j01 - RS * j11), n10 = lac * (RS * j00 + RC * j10), n11 = lac * (RS * j01 + RC * j11);
    qx = nqx; qy = nqy; j00 = n00; j01 = n01; j10 = n10; j11 = n11;
  }
  // ridged sums lie in [0, 1]: centred so every flavour reads about 0 at the mean
  if (fl === 'ridged') return [2 * sum / norm - 1, 2 * dx / norm, 2 * dy / norm];
  return [sum / norm, dx / norm, dy / norm];
}

/** The point pushed by two fractal fields → [x', y']. W: { strength (plane units), scale (feature size), seed, octaves (3) }. */
export function warp2(x, y, W) {
  const s = 1 / W.scale, sd = W.seed | 0, oct = W.octaves ?? 3;
  const px = x * s, py = y * s;
  const qx = fractal2(px, py, { seed: sd, octaves: oct })[0], qy = fractal2(px + 5.2, py + 1.3, { seed: sd + 7, octaves: oct })[0];
  return [x + W.strength * qx, y + W.strength * qy];
}

export const smoothstep = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };

/** h in benches `step` high: flat for (1 − riser) of each step, then a smooth rise over the rest. */
export function terrace(h, step, riser = 0.3) {
  const k = h / step, f = Math.floor(k), t = k - f;
  return (f + smoothstep(1 - riser, 1, t)) * step;
}
