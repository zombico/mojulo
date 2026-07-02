/**
 * effects-fog — the productized volumetric-fog effect: one call turns a set of solid boxes into the
 * `fog` object emitThreeWorld's effects channel consumes. This is the harness guts (bake box field →
 * compose occluder GLSL → fog transfer function → overlay shader) packaged so world renderers can
 * offer fog as a SETTING. See docs/raymarch-effects-layer.md for the principles + how to add new
 * raymarch effect layers on this same spine.
 *
 * The three pieces it stitches (all reusable on their own):
 *   • bakeBoxField / boxFieldGLSL (effects-occluder.js) — the grid-culled scene-SDF occluder.
 *   • SDF_GLSL (sdf-glsl.js)                            — the sdfBox/opU primitives it unions.
 *   • buildVolumeFrag({ overlay:true }) (volume-raymarch.js) — the march, output as a premultiplied
 *                                                         RGBA layer that composites over the mesh.
 */
import { SDF_GLSL } from './sdf-glsl.js';
import { bakeBoxField, boxFieldGLSL } from './effects-occluder.js';
import { buildVolumeFrag } from './volume-raymarch.js';

/**
 * Compose a ground-hugging volumetric fog over a box world.
 * @param {Array<{cx,cy,cz,hx,hy,hz}>} boxes  the solid masses the fog clips against (the occluder).
 * @param {object} [opts]
 * @param {'y'|'z'} [opts.up='z']     vertical axis (World mesh = 'z'; raymarch render frame = 'y').
 * @param {number} [opts.cell=5]      grid cell size · [opts.margin=3] · [opts.K=12] per-cell capacity.
 * @param {number} [opts.height=9]    fog ceiling — density falls to 0 by this height above ground.
 * @param {number} [opts.density=0.4] overall thickness (lower → see further; ~0.24 reads well on foot).
 * @param {number[]} [opts.color=[0.88,0.90,0.95]]  fog colour (in-scattered airlight).
 * @param {number} [opts.maxDist=150] how far each fog ray marches before giving up.
 * @param {number} [opts.steps=160] march steps · [opts.traceSteps=130] SDF sphere-trace steps.
 * @returns {{ frag, customUniforms, dataTextures, meta }}  ready to pass as emitThreeWorld's `fog`.
 */
export function composeVolumeFog(boxes, {
  up = 'z', cell = 5, margin = 3, K = 12,
  height = 9, density = 0.4, color = [0.88, 0.90, 0.95],
  maxDist = 150, steps = 160, traceSteps = 130,
} = {}) {
  const baked = bakeBoxField(boxes, { cell, margin, K, up });
  const U = up;                                              // height component
  const drift = up === 'z' ? 'vec3(uTime*0.10, uTime*0.07, 0.0)' : 'vec3(uTime*0.10, 0.0, uTime*0.07)';
  const col3 = color.map((c) => (+c).toFixed(3)).join(', ');

  // the EFFECT side — fog density as a transfer function over height + drifting noise. `vrHash13` is
  // provided by buildVolumeFrag's VR_HELPERS (concatenated before globals).
  const fogGlsl = `
float fbm(vec3 p){ float v = 0.0, a = 0.55; for (int i = 0; i < 4; i++){ v += a * vrHash13(floor(p) + 0.5); p = p * 2.02; a *= 0.5; } return v; }
void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){
  float h = clamp(1.0 - p.${U} / ${(+height).toFixed(2)}, 0.0, 1.0);
  float layer = h * h;
  float drift = 0.5 + 0.7 * fbm(p * 0.20 + ${drift});
  float dens = layer * drift * ${(+density).toFixed(3)};
  vec3 fogCol = vec3(${col3});
  emis = fogCol * dens;        // in-scattered airlight
  ext  = vec3(dens * 0.9);     // grey extinction
}`;

  const frag = buildVolumeFrag({
    globals: `${SDF_GLSL}\n${boxFieldGLSL({ K, up })}\n${fogGlsl}`,
    uniforms: ['uniform float uMaxDist;'],
    rayDirArg: true,
    overlay: true,
    boundsRadius: 'uMaxDist',
    steps,
    occluder: { sdfFn: 'sdfScene', traceSteps, surfEps: '0.02', minStep: '0.05' },
  });

  return {
    frag,
    customUniforms: {
      uMaxDist: maxDist,
      uBoxCount: baked.count,
      uGridO: [baked.grid.ox, baked.grid.oz, baked.grid.cell],
      uGridN: [baked.grid.cols, baked.grid.rows, baked.grid.tpc],
    },
    dataTextures: { uBoxTex: baked.boxData, uCellTex: baked.cellData },
    meta: { count: baked.count, overflow: baked.overflow },
  };
}
