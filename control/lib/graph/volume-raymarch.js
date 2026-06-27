/**
 * volume-raymarch — a reusable VOLUME-RAYMARCH scaffold for the emitThreeWorld `raymarch` channel.
 *
 * The roadmap (raymarch-science-roadmap.plan.md) flagged this as the single biggest force-multiplier:
 * "ray-vs-bounds + emission–absorption march + a transfer function, generalised out of the orbital
 * shader. Tiers 1–3's volumetric entries all reuse it." It is generalised from the two shipping volume
 * shaders — atom-view's `|ψ|²` orbital cloud and galaxy-view's Milky Way participating media — which
 * share an identical skeleton (camera ray → bounding-sphere → emission/absorption march → tonemap) and
 * differ ONLY in the per-view TRANSFER FUNCTION that samples the field.
 *
 * `buildVolumeFrag()` is a pure GLSL string composer. The consumer supplies the transfer function:
 *
 *     void volSample(vec3 p, out vec3 emis, out vec3 ext);              // default
 *     void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext);     // opts.rayDirArg (light-transport)
 *         emis — emission colour at p (premultiplied glow; for atmospheres this is IN-SCATTERED light)
 *         ext  — per-channel extinction coefficient at p (vec3 so dust/media can REDDEN, à la galaxy;
 *                pass a uniform grey vec3 for plain alpha-style absorption, à la atom)
 *
 * …plus a little config, and gets back a complete fragment shader wired to the built-in uniforms
 * (uCamPos, uCamBasis, uRes, uTime, uFov). See volume-raymarch.plan.md.
 *
 * Two opt-in generalizations (added for atmospheric scattering — the second consumer — without
 * disturbing the default path):
 *   • `rayDirArg`  — pass the view direction `rd` into volSample, needed by light-transport phenomena
 *                    whose emission depends on the view/sun angle (phase functions).
 *   • `occluder`   — a solid inner sphere that TERMINATES the ray (a planet surface, a horizon). The
 *                    march stops at the surface and the consumer shades the hit instead of the
 *                    background, so the body is opaque (no stars shining through a planet).
 */

// Shared GLSL helpers every volume shader wants — prefixed `vr` to never collide with consumer globals.
const VR_HELPERS = `
float vrHash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
// faint procedural starfield (seen through the residual transmittance so the volume occludes it).
vec3 vrStars(vec3 d){
  vec3 g = floor(d * 200.0); float s = vrHash13(g);
  float b = smoothstep(0.992, 1.0, s);
  return vec3(0.78, 0.85, 1.0) * b * b * (0.4 + 0.6 * vrHash13(g + 7.0)) + vec3(0.012, 0.014, 0.024);
}
// ray vs bounding sphere (radius R, centred at origin): returns vec2(tNear, tFar); tFar < tNear ⇒ miss.
vec2 vrSphereT(vec3 ro, vec3 rd, float R){
  float b = dot(ro, rd), c = dot(ro, ro) - R * R, h = b * b - c;
  if (h < 0.0) return vec2(1.0, -1.0);
  h = sqrt(h); return vec2(-b - h, -b + h);
}
// ACES filmic tonemap: toe keeps the void black, shoulder rolls off bright cores.
vec3 vrACES(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
`;

/**
 * Compose a complete volume-raymarch fragment shader.
 * @param {object} opts
 * @param {string[]} [opts.uniforms]       extra `uniform …;` declarations the transfer fn needs.
 * @param {string}   opts.globals          GLSL the transfer fn depends on, INCLUDING the `volSample` def.
 * @param {string}   [opts.boundsRadius]   uniform name for the bounding-sphere radius (default 'uRmax').
 * @param {number}   [opts.steps]          march step count (default 128).
 * @param {'aces'|'reinhard'} [opts.tonemap]  tonemap (default 'aces').
 * @param {string|null} [opts.exposureUniform]  scalar exposure uniform applied once pre-tonemap, or null.
 * @param {boolean}  [opts.jitter]         dither the ray start to kill step banding (default true).
 * @param {number}   [opts.gamma]          final gamma; emits pow(col, 1/gamma) (default 2.2 → sRGB).
 * @param {string|null} [opts.background]  name of a `vec3 bg(vec3 rd)` in globals, or null → built-in stars.
 * @param {boolean}  [opts.rayDirArg]      pass the view dir `rd` to volSample (default false).
 * @param {object|null} [opts.occluder]    `{ radiusUniform, groundFn }` — a solid inner sphere that stops
 *                                          the ray; `groundFn` is a `vec3 fn(vec3 p, vec3 rd)` shading the hit.
 * @returns {string} the GLSL fragment shader source.
 */
export function buildVolumeFrag({
  uniforms = [],
  globals = '',
  boundsRadius = 'uRmax',
  steps = 128,
  tonemap = 'aces',
  exposureUniform = null,
  jitter = true,
  gamma = 2.2,
  background = null,
  rayDirArg = false,
  occluder = null,
} = {}) {
  const N = Math.max(1, Math.floor(steps));
  const bg = background ? `${background}(rd)` : 'vrStars(rd)';
  const jit = jitter ? `vrHash13(vec3(gl_FragCoord.xy, floor(uTime)))` : '0.0';
  const expose = exposureUniform ? `  col *= ${exposureUniform};\n` : '';
  const tone = tonemap === 'reinhard' ? `col = col / (col + vec3(1.0));` : `col = vrACES(col);`;
  const invGamma = (1 / gamma).toFixed(4);
  const callSample = rayDirArg ? 'volSample(p, rd, emis, ext);' : 'volSample(p, emis, ext);';
  // optional inner occluder: stop the march at the surface and shade the hit instead of the background.
  const occSetup = occluder
    ? `  vec2 tg = vrSphereT(ro, rd, ${occluder.radiusUniform});\n  bool hitGround = (tg.y > tg.x) && tg.x > 0.0;\n`
    : '';
  const occClip = occluder ? `      if (hitGround) t1 = min(t1, tg.x);\n` : '';
  const bgComposite = occluder
    ? `  col += trans * (hitGround ? ${occluder.groundFn}(ro + rd * tg.x, rd) : ${bg});`
    : `  col += trans * ${bg};                                     // background, occluded by the volume`;

  return `precision highp float;
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime; uniform float uFov;
${uniforms.join('\n')}
${VR_HELPERS}
${globals}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float tanf = tan(uFov * 0.5);
  vec3 rd = normalize(uCamBasis * vec3(uv.x * tanf, uv.y * tanf, 1.0));
  vec3 ro = uCamPos;

  vec3 col = vec3(0.0);
  vec3 trans = vec3(1.0);                                   // per-channel transmittance (→ reddening)
  vec2 tt = vrSphereT(ro, rd, ${boundsRadius});
${occSetup}  if (tt.y > tt.x) {
    float t0 = max(tt.x, 0.0), t1 = tt.y;
${occClip}    const int STEPS = ${N};
    float dt = (t1 - t0) / float(STEPS);
    float t = t0 + dt * ${jit};                             // dither start → no step banding
    for (int i = 0; i < STEPS; i++) {
      vec3 p = ro + rd * t;
      vec3 emis, ext;
      ${callSample}
      col += trans * emis * dt;                             // emission through current transmittance
      trans *= exp(-ext * dt);                              // front-to-back absorption (dust occludes/reddens)
      t += dt;
      if (max(trans.r, max(trans.g, trans.b)) < 0.01) break;
    }
  }
${bgComposite}
${expose}  ${tone}                                          // tonemap ONCE — no stacked bloom
  col = pow(col, vec3(${invGamma}));                        // linear → sRGB
  gl_FragColor = vec4(col, 1.0);
}
`;
}
