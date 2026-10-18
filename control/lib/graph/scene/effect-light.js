/**
 * EFFECT LIGHT — the light an effect throws on the world it plays in (`fxLight`, opt-in on a world whose cues fire
 * beams, puffs or explosions). Nothing is authored per effect: the RULES read what each one already says of itself.
 *
 *   a beam's strand    a light at its head, the attack's colour, as strong as the strand is wide (FX_LIGHT.head) and as
 *                      soft (reach × width); a ray a second one at the middle of its spine, so a laser lights its path
 *   a beam's charge    a light at the hand, swelling with the orb (FX_LIGHT.charge × its size)
 *   a moment           its own light (moments.js / explosions.js `light: { k, life, z }`), tinted by its colour, else
 *                      its kind's (MOMENT_TINT: a strike cold white, sparks and blasts warm)
 *   the level          the sky: an effect lights a night level fully and a noon one a quarter as much (fxDay)
 *
 * The page gathers every light each frame (__fxlPush, from the beam and moment channels), keeps the FX_LIGHT.max
 * strongest, and every basic material on the page adds them (chained after any patch it carries, the metal channel's
 * included, at the tone-map, so live metal, baked faces and the character light all take it): the surface's own colour
 * at a plausible albedo times the light, falling off as an extended source's, k / (d² + r²), as the fire channel does.
 * Absent `fxLight`, none of this is emitted.
 *
 *   FX_LIGHT, MOMENT_TINT     the rules' numbers
 *   fxDay(rgb)                how much an effect adds under a sky of this colour (0–255 or 0–1 channels)
 *   fxLightScript({ day })    the page's block: __fxlPush(p, rgb, k, r2), __stepFxLight()
 */

export const FX_LIGHT = Object.freeze({
  head: 6,          // a strand head's light, per metre of the strand's width (× its head scale)
  body: 2.4,        // a ray's second light, at the middle of its spine, per metre of width
  reach: 2.5,       // a light's core radius, in widths (the r in k / (d² + r²))
  charge: 4,        // a charging orb's light, per metre of its size, as it swells
  moment: 0.9,      // a moment's own light, × its k (moments.js) and scale
  momentReach: 0.8, // a moment light's core radius, metres × its scale
  max: 8,           // lights a surface adds
  night: 1, noon: 0.25,
});
// a moment's tint when it names no colour, by its kind (moments.js keys; an explosion's spec is warm)
export const MOMENT_TINT = Object.freeze({
  strike: [0.72, 0.84, 1], flash: [1, 0.96, 0.9], sparks: [1, 0.72, 0.36], fireworks: [1, 0.8, 0.6], splash: [0.75, 0.9, 1],
  explosion: [1, 0.6, 0.28],
});

/** How much an effect adds under a sky of this colour: a night sky fully, a noon one FX_LIGHT.noon as much. */
export function fxDay(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3) return FX_LIGHT.night;
  const s = rgb.some((v) => v > 1) ? 255 : 1, lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / s;
  const t = Math.min(1, Math.max(0, (lum - 0.08) / 0.5));
  return +(FX_LIGHT.night + (FX_LIGHT.noon - FX_LIGHT.night) * t).toFixed(3);
}

/** The page's block: the frame's lights (__fxlPush), and every basic material taking the strongest. */
export function fxLightScript({ day = FX_LIGHT.night } = {}) {
  const N = FX_LIGHT.max;
  return `
// --- effect light (fxLight): what the beams and moments throw on the world, every frame (scene/effect-light.js) ---
const __FXLR = ${JSON.stringify({ ...FX_LIGHT, tint: MOMENT_TINT })};
const __fxlL = [];
const __fxlPush = (p, rgb, k, r2) => { if (k > 1e-3) __fxlL.push([p[0], p[1], p[2], rgb[0], rgb[1], rgb[2], k, r2]); };
const __fxlU = { uFxP: { value: Array.from({ length: ${N} }, () => new THREE.Vector4()) }, uFxC: { value: Array.from({ length: ${N} }, () => new THREE.Vector4()) }, uFxDay: { value: ${day} } };
const __fxlFS = 'uniform vec4 uFxP[${N}]; uniform vec4 uFxC[${N}]; uniform float uFxDay; varying vec3 vFxW;\\n';
const __fxlLight = \`
  { vec3 fxA = vec3(0.0);
    for (int i = 0; i < ${N}; i++) { vec4 P = uFxP[i]; if (P.w <= 0.0) continue; vec3 d = vFxW - P.xyz; fxA += uFxC[i].rgb * P.w / (dot(d, d) + uFxC[i].w); }
    float fxLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor.rgb += gl_FragColor.rgb * min(3.0, 0.32 / max(fxLum, 0.03)) * min(fxA, vec3(3.0)) * uFxDay; }
\`;
function __fxlPatch(m) {
  // an effect's own additive pieces (its ribbons, sprites, rings) are light, not lit
  if (!m || !m.isMeshBasicMaterial || m.userData.__fxl || m.blending === THREE.AdditiveBlending) return;
  m.userData.__fxl = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    Object.assign(sh.uniforms, __fxlU);
    sh.vertexShader = 'varying vec3 vFxW;\\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\\n  #ifdef USE_INSTANCING\\n  vFxW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\\n  #else\\n  vFxW = (modelMatrix * vec4(transformed, 1.0)).xyz;\\n  #endif');
    sh.fragmentShader = __fxlFS + sh.fragmentShader.replace('#include <tonemapping_fragment>', __fxlLight + '\\n#include <tonemapping_fragment>');
  };
  m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|fxl'; };
  m.needsUpdate = true;
}
// patched as it steps, so meshes made after load (a rig's bones, a beam's target) learn it, wrapping every patch before
let __fxlSeen = -1;
function __stepFxLight() {
  let n = 0; scene.traverse(() => { n++; });
  if (n !== __fxlSeen) { __fxlSeen = n; scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(__fxlPatch); }); }
  __fxlL.sort((a, b) => b[6] - a[6]);
  for (let i = 0; i < ${N}; i++) {
    const L = __fxlL[i];
    if (L) { __fxlU.uFxP.value[i].set(L[0], L[1], L[2], L[6]); __fxlU.uFxC.value[i].set(L[3], L[4], L[5], L[7]); } else __fxlU.uFxP.value[i].w = 0;
  }
  __fxlL.length = 0;
}
window.__mojFxLight = { lights: () => __fxlU.uFxP.value.filter((v) => v.w > 0).length };`;
}
