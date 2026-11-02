// In-page helper (the far trees' and the far structures' cards: channels/form-flora.js, channels/far-structures.js): THE
// CARD SMOOTHED, so an impression past the view cone's reach reads as the same 3D world seen far off, not as a pixel
// asset standing in it. A card is baked point-sampled (a texel is the front-most triangle where its centre falls), which
// keeps it no thicker than what it stands for; drawn with nearest filtering and a hard alpha cut it showed as blocks
// that crawled as the eye moved. Smoothed:
//
//   coverage   each texel's alpha is how much of it the silhouette covers: whole where the bake put something, and in a
//              fringe one texel out, the share of its neighbours that are covered (a tent over its 3 × 3, × `fringe`):
//              the edge falls off over a texel instead of stepping. Within its own cell (one bearing of one template), so
//              no card bleeds into the next
//   dilation   a fringe texel takes its covered neighbours' mean, and every texel still empty its cell's mean (alpha 0),
//              so filtering at the edge and the mipmaps far off blend toward the card's own colour, never toward black
//   filtering  the atlas is mipmapped and filtered (trilinear): far off a card is its own average, not a sample that
//              jumps. Its alpha is SHARPENED back to an edge a pixel wide (the filtered coverage over its own screen
//              derivative, about `edge`: an anti-aliased alpha test, the edge a little under a half so a crown of leaves
//              smaller than a pixel keeps the weight the whole tree has at the swap), lifted at each coarser mip level
//              (`mip`) so a crown keeps its density as it shrinks instead of thinning to a ghost, and drawn as coverage
//              (alpha-to-coverage under the page's MSAA)
//
// `cardCover` is a pure function the page inlines (its source, not its name, so a bundler's renaming cannot break it).
export const CARD_SMOOTH = Object.freeze({ fringe: 1.25, cut: 0.02, shadow: 0.5, mip: 0.6, edge: 0.4 });

/** Coverage and dilation, in place, over an RGBA atlas of `cols` × `rows` cells of `cw` × `ch` texels, its covered texels
 *  those whose alpha is not 0 (the bake's mark). */
export function cardCover(atlas, cw, ch, cols, rows, fringe = 1.25) {
  const W = cols * cw, H = rows * ch, mask = new Uint8Array(W * H);
  for (let q = 0; q < W * H; q++) mask[q] = atlas[q * 4 + 3] > 0 ? 1 : 0;
  const K = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y / ch) * ch, y1 = y0 + ch - 1;
    for (let x = 0; x < W; x++) {
      const q = y * W + x;
      if (mask[q]) { atlas[q * 4 + 3] = 255; continue; }
      const x0 = Math.floor(x / cw) * cw, x1 = x0 + cw - 1;
      let w = 0, wc = 0, r = 0, g = 0, b = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j, k = K[(j + 1) * 3 + i + 1];
        if (xx < x0 || xx > x1 || yy < y0 || yy > y1) continue;
        w += k; const p = yy * W + xx;
        if (mask[p]) { wc += k; r += atlas[p * 4] * k; g += atlas[p * 4 + 1] * k; b += atlas[p * 4 + 2] * k; }
      }
      if (!wc) { atlas[q * 4 + 3] = 0; continue; }
      atlas[q * 4] = Math.round(r / wc); atlas[q * 4 + 1] = Math.round(g / wc); atlas[q * 4 + 2] = Math.round(b / wc);
      atlas[q * 4 + 3] = Math.round(Math.min(1, (wc / w) * fringe) * 255);
    }
  }
  // (every texel still empty takes its cell's mean covered colour, alpha 0: a mipmap averages a card toward its own
  // colour, never toward black)
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let n = 0, r = 0, g = 0, b = 0;
    for (let y = cy * ch; y < (cy + 1) * ch; y++) for (let x = cx * cw; x < (cx + 1) * cw; x++) { const p = y * W + x; if (mask[p]) { n++; r += atlas[p * 4]; g += atlas[p * 4 + 1]; b += atlas[p * 4 + 2]; } }
    if (!n) continue;
    r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
    for (let y = cy * ch; y < (cy + 1) * ch; y++) for (let x = cx * cw; x < (cx + 1) * cw; x++) { const p = y * W + x; if (!atlas[p * 4 + 3]) { atlas[p * 4] = r; atlas[p * 4 + 1] = g; atlas[p * 4 + 2] = b; } }
  }
  return atlas;
}

/** The page's source for a smoothed card atlas: the helper inlined once, and a texture of it mipmapped and filtered. */
export function cardSmoothSource() {
  return `const __cardCover = ${cardCover.toString()};
const __cardTex = (atlas, cw, ch, cols, rows) => { __cardCover(atlas, cw, ch, cols, rows, ${CARD_SMOOTH.fringe});
  const t = new THREE.DataTexture(atlas, cols * cw, rows * ch, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };`;
}

/** The fragment's alpha from a smoothed card (GLSL statements): `tex` the atlas, `uv` its coordinate, `size` a vec2
 *  uniform of its texels, `out` the float it sets; the mip level from the coordinate's screen derivatives. */
export function cardAlphaGlsl(tex, uv, size, out) {
  const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
  return `vec2 ${out}T = ${uv} * ${size}; float ${out}L = max( 0.0, 0.5 * log2( max( dot( dFdx( ${out}T ), dFdx( ${out}T ) ), dot( dFdy( ${out}T ), dFdy( ${out}T ) ) ) ) );
  float ${out}A = texture2D( ${tex}, ${uv} ).a * ( 1.0 + ${out}L * ${f(CARD_SMOOTH.mip)} );
  float ${out} = clamp( ( ${out}A - ${f(CARD_SMOOTH.edge)} ) / max( fwidth( ${out}A ), 1e-4 ) + 0.5, 0.0, 1.0 );`;
}
