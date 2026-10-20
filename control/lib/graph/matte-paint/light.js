/**
 * LIGHT — the relief lit from one direction, baked: what a painter does when they decide where the light comes from and
 * let every shape answer it. The output is a VALUE per texel, held at a mean of 1 over the face, so the paint can sit the
 * material's own colour at 1 and the World's vertex light still carries the large shading (nothing is lit twice).
 *
 *   direction  `az` degrees in the face's own frame (0: from the right, 90: from above), `el` degrees above the face
 *   diffuse    the face's normal against the light, wrapped by `wrap` (a soft terminator), over an `ambient` floor
 *   shadow     marched over the height field toward the light for `reach` m: a shape that stands in the way shades the
 *              texel, softened over `soft` m of clearance, down to `floor`
 *   cavity     a hollow (lower than its surroundings, over a ~`radius` m window) darkens by up to `cavity`; a crest
 *              lifts by up to `edge` (a worn arris catching the light)
 *
 *   lightRelief(field, light) → { value, up, cavity, convex } (Float32Array each; `up` is how far the normal faces the
 *                               top of the face, the side moss and dust settle on); a `field.wrap` tile is read round
 *                               its edges
 *
 * Pure. The light's vector is rounded to 1e-6 so its few trigonometric calls cannot move a texel between engines.
 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r6 = (v) => Math.round(v * 1e6) / 1e6;

const wrapAt = (v, n) => ((v % n) + n) % n;
/** A box blur of `r` texels (separable; clamped at the border, or wrapped round a periodic tile). */
function blur(src, W, H, r, wrap = false) {
  const ix = wrap ? (i) => wrapAt(i, W) : (i) => clamp(i, 0, W - 1), jy = wrap ? (j) => wrapAt(j, H) : (j) => clamp(j, 0, H - 1);
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0; for (let a = -r; a <= r; a++) s += src[j * W + ix(i + a)]; tmp[j * W + i] = s / n; }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let s = 0; for (let b = -r; b <= r; b++) s += tmp[jy(j + b) * W + i]; out[j * W + i] = s / n; }
  return out;
}

export function lightRelief({ W, H, px, height, inside, wrap = false }, S) {
  const az = (S.az * Math.PI) / 180, el = (S.el * Math.PI) / 180;
  const L = [r6(Math.cos(az) * Math.cos(el)), r6(-Math.sin(az) * Math.cos(el)), r6(Math.sin(el))];
  const lxy = Math.sqrt(L[0] * L[0] + L[1] * L[1]), sx = lxy ? L[0] / lxy : 0, sy = lxy ? L[1] / lxy : 0;
  const rise = lxy ? (L[2] / lxy) * px : 0, steps = lxy ? Math.max(1, Math.round(S.reach / px)) : 0;
  // (a periodic tile, `wrap`, reads its neighbours round the edge: the tile meets itself, so its light must too)
  const at = wrap ? (i, j) => height[wrapAt(j, H) * W + wrapAt(i, W)] : (i, j) => height[clamp(j, 0, H - 1) * W + clamp(i, 0, W - 1)];
  const mean = blur(height, W, H, Math.max(1, Math.round(S.radius / px)), wrap);
  const value = new Float32Array(W * H), up = new Float32Array(W * H), cavity = new Float32Array(W * H), convex = new Float32Array(W * H);
  let sum = 0, n = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (inside[k] <= 0) continue;
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * px), dy = (at(i, j + 1) - at(i, j - 1)) / (2 * px), nl = Math.sqrt(dx * dx + dy * dy + 1);
    const nx = -dx / nl, ny = -dy / nl, nz = 1 / nl;
    const ndl = nx * L[0] + ny * L[1] + nz * L[2], diffuse = clamp((ndl + S.wrap) / (1 + S.wrap), 0, 1);
    // the shadow: the most any texel toward the light stands above the ray, softened
    let occ = 0;
    for (let s = 1, z = height[k]; s <= steps; s++) {
      z += rise;
      const o = at(Math.round(i + sx * s), Math.round(j + sy * s)) - z;
      if (o > occ) occ = o;
    }
    const shadow = 1 - (1 - S.floor) * clamp(occ / S.soft, 0, 1);
    const c = clamp((mean[k] - height[k]) / 0.003, 0, 1), v = clamp((height[k] - mean[k]) / 0.003, 0, 1);
    let val = (S.ambient + (1 - S.ambient) * diffuse * shadow) * (1 - S.cavity * c) + S.edge * v;
    value[k] = val; up[k] = clamp(-ny, 0, 1); cavity[k] = c; convex[k] = v;
    sum += val; n++;
  }
  const m = n ? sum / n : 1;
  for (let k = 0; k < W * H; k++) if (inside[k] > 0) value[k] /= m;
  return { value, up, cavity, convex };
}
