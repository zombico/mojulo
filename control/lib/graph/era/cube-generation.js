/**
 * A CUBE'S GENERATION — the line eras.js draws, read once for the world: `gen-6` is pure poly (baked vertex colour on
 * flat facets, every value on screen a ramp stop lit), `gen-7` is the texture-map layer (relief-painted tiles on walls,
 * roofs and paving, the resampler, the rock's fabric drawn on the page, and the palette's relief they speak in). Every
 * part of a world that draws textures asks here, not the cube's grit: inside gen-7 the grit is the layer's wear (how
 * broken, pitted and worn), and a gen-6 cube draws none whatever its grit says.
 *
 *   isTextured(cube)    the cube draws the texture-map layer (gen-7)
 *   cubeTexture(cube)   its wear when it does (its `grit`, else DEFAULT_WEAR), else null
 *   DEFAULT_WEAR        a gen-7 cube's wear when it names none
 *
 * Pure.
 */
export const DEFAULT_WEAR = 0.4;
export const isTextured = (cube) => cube?.era === 'gen-7';
export function cubeTexture(cube) {
  return isTextured(cube) ? cube.grit ?? DEFAULT_WEAR : null;
}
