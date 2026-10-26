/**
 * THE FORM RENDER'S MATERIAL (gen-7, era/eras.js): a surface carries its material and its form, never light, and the
 * renderer lights it. A dressed face's relief (matte-paint/relief.js: a height field in metres) is read here into the
 * material an engine reads (glTF's metal-rough, Unreal's master material), where the paint (matte-paint/light.js) bakes
 * one sun into it:
 *
 *   baseColor   the material's own colour: the paint's colour pass under no light (its value held at 1, no cavity)
 *   normal      the relief's slope in tangent space (x along the row, y up the face: the glTF / OpenGL convention,
 *               green toward row 0, the face's top), so the renderer's sun finds every arris and joint
 *   orm         occlusion (red: the relief's hollows, the cavity light.js finds), roughness (green: the material's,
 *               polished where the relief crests), metalness (blue: none): one texture for glTF's occlusion and
 *               metallicRoughness both
 *   height      the relief itself (metres, kept for parallax and displacement)
 *
 *   reliefMaterial({ W, H, px, height, tile? }, { base, cavity, convex, rough? }) → { W, H, px, baseColor, normal, orm,
 *                  height }   base: Buffer (RGB, the colour pass's); cavity, convex: light.js's; rough: the material's
 *                  roughness, 0..1 (0.85, stone)
 *
 * Pure: no dice; the normal's slope wraps round a tile's edges (`tile`), as light.js's does.
 */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const byte = (v) => Math.round(clamp(v, 0, 1) * 255);

/** How deep a hollow occludes: the cavity's share of the light kept (light.js's `cavity` at its strongest). */
export const CAVITY_OCCLUSION = 0.6;
/** How much a crest is polished: roughness taken off where the relief stands proud of its neighbourhood. */
export const CREST_POLISH = 0.2;

export function reliefMaterial({ W, H, px, height, tile = true }, { base, cavity, convex, rough = 0.85 }) {
  if (!(W > 0 && H > 0 && px > 0) || height.length !== W * H) throw new Error('form: a relief is { W, H, px, height[W × H] }');
  if (!base || base.length !== W * H * 3) throw new Error('form: base is the colour pass, RGB, W × H');
  const at = tile ? (i, j) => height[(((j % H) + H) % H) * W + (((i % W) + W) % W)] : (i, j) => height[clamp(j, 0, H - 1) * W + clamp(i, 0, W - 1)];
  const normal = Buffer.alloc(W * H * 3), orm = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    // (the slope as light.js reads it: x along the row, y down it; the map's y is up the face)
    const dx = (at(i + 1, j) - at(i - 1, j)) / (2 * px), dy = (at(i, j + 1) - at(i, j - 1)) / (2 * px), l = Math.sqrt(dx * dx + dy * dy + 1);
    normal[k * 3] = byte(0.5 - (0.5 * dx) / l);
    normal[k * 3 + 1] = byte(0.5 + (0.5 * dy) / l);
    normal[k * 3 + 2] = byte(0.5 + 0.5 / l);
    orm[k * 3] = byte(1 - CAVITY_OCCLUSION * (cavity ? cavity[k] : 0));
    orm[k * 3 + 1] = byte(rough - CREST_POLISH * (convex ? convex[k] : 0));
    orm[k * 3 + 2] = 0;
  }
  return { W, H, px, baseColor: base, normal, orm, height };
}
