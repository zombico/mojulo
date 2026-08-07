/**
 * painted-landscape → raymarch. Productizes the spike (scripts/render-landscape.mjs): resolve a
 * painted-landscape recipe JS-side and bake the numbers into a GLSL raymarch that runs
 * painted-landscape's OWN height / slope / Lambert / palette-ramp math per-pixel — a third renderer
 * over the recipe, beside the CSS-3D and three.js-mesh backends. See docs/raymarch-effects-layer.md.
 *
 * `composeLandscapeRaymarch(manifest)` → the `raymarch` payload emitThreeWorld already dispatches to
 * emitRaymarchWorld (scene-three.js). Wired as `/api/sketches/[ref]/world?render=raymarch`.
 *
 * Ported: both heartbeat engines (sine-stack exactly; fbm by CHARACTER — a float-hash value-noise
 * fBm with the resolved octaves/persistence/lacunarity, not JS's exact Math.imul noise), an optional
 * water plane, sky + clouds, aerial + volumetric valley haze. NOT ported: structures / scatter /
 * forest (they'd come in as SDF box unions — the fog-occluder primitive).
 */
import { resolveHeartbeat, derivePalette, deriveSky } from '../polygonizer/painted-landscape.js';
import { buildVolumeFrag } from '../effects/volume-raymarch.js';
import { SDF_GLSL } from '../effects/sdf-glsl.js';

const f = (n) => (+n).toFixed(6);
const rgb = (c) => `vec3(${(c[0] / 255).toFixed(4)}, ${(c[1] / 255).toFixed(4)}, ${(c[2] / 255).toFixed(4)})`;
const K = 6.2831853;

// JS twins of painted-landscape's height evaluators (painted-landscape.js:1503-1585), so we can place
// trees ON the terrain (base height) + cull by water/treeline without a round-trip through the shader.
function hashCell(i, j, seed) {
  let h = seed | 0;
  h = Math.imul(h + i, 374761393) | 0;
  h = Math.imul(h + j, 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function valueNoise2D(x, y, seed) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const ss = (t) => t * t * (3 - 2 * t);
  const v00 = hashCell(i, j, seed), v10 = hashCell(i + 1, j, seed);
  const v01 = hashCell(i, j + 1, seed), v11 = hashCell(i + 1, j + 1, seed);
  const sx = ss(fx), sy = ss(fy);
  const v0 = v00 + (v10 - v00) * sx, v1 = v01 + (v11 - v01) * sx;
  return (v0 + (v1 - v0) * sy) * 2 - 1;
}
function jsHeight(x, y, hb) {
  if (hb.engine === 'fbm') {
    const { octaves, persistence, lacunarity, baseScale, amplitude, noiseSeed } = hb.fbm;
    let sum = 0, amp = 1, freq = 1 / baseScale, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * valueNoise2D(x * freq, y * freq, noiseSeed + i * 1009); norm += amp; amp *= persistence; freq *= lacunarity; }
    return (sum / Math.max(norm, 1e-9)) * amplitude;
  }
  const u = (x - -12) / 24, v = (6 - y) / 30;
  return hb.waves.reduce((h, w) => h + w.amplitude * Math.sin(K * (w.cycles.u * u + w.cycles.v * v) + w.phase), 0);
}

// Forest placement — a jittered candidate grid thresholded by a density noise, each kept point riding
// the terrain height, culled below the waterline and above an optional treeline (painted-landscape.js:1940).
function placeForest(hb, wl, cfg) {
  const density = Number.isFinite(cfg.density) ? cfg.density : (cfg === true ? 0.5 : Number.isFinite(+cfg) ? +cfg : 0.5);
  const sizeLo = cfg.size?.[0] ?? 1.5, sizeHi = cfg.size?.[1] ?? 2.8;
  const treeline = Number.isFinite(cfg.treeline) ? cfg.treeline : null;
  const cap = cfg.max ?? 52;
  let s = (typeof cfg.seed === 'number' ? cfg.seed : 20250701) >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const cand = [];
  const step = 1.25;
  for (let x = -11; x <= 11; x += step) {
    for (let y = -22; y <= 4; y += step) {
      const jx = x + (rnd() - 0.5) * step, jy = y + (rnd() - 0.5) * step;
      const clump = 0.5 + 0.5 * valueNoise2D(jx * 0.16, jy * 0.16, 7);   // gentle low-freq clumping
      if (rnd() > density * (0.62 + 0.38 * clump)) continue;
      const base = jsHeight(jx, jy, hb);
      if (wl != null && base < wl + 0.15) continue;                       // no trees in the water
      if (treeline != null && base > treeline) continue;                  // snowline cull
      cand.push({ x: jx, y: jy, base, scale: sizeLo + rnd() * (sizeHi - sizeLo) });
    }
  }
  // sample down to the cap ACROSS the whole domain (Fisher–Yates), not in left-to-right loop order
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  return cand.slice(0, cap);
}
const MAX_TREES = 64;

// GLSL body of `float H(vec2 w)` (w = worldX, worldY) for each engine.
function heightGLSL(hb) {
  if (hb.engine === 'fbm') {
    const { octaves, persistence, lacunarity, baseScale, amplitude } = hb.fbm;
    // float-hash value-noise fBm — same octave structure as painted-landscape.js:1527, different hash.
    return `float H(vec2 w){
  float sum = 0.0, amp = 1.0, freq = ${f(1 / baseScale)}, norm = 0.0;
  for (int i = 0; i < ${Math.max(1, Math.round(octaves))}; i++){
    sum += amp * (vn2(w * freq + vec2(float(i) * 17.3, float(i) * 9.7)) * 2.0 - 1.0);
    norm += amp; amp *= ${f(persistence)}; freq *= ${f(lacunarity)};
  }
  return (sum / max(norm, 1e-9)) * ${f(amplitude)};
}`;
  }
  // sine-stack: exact — painted-landscape.js:1579 waveValue over normalized (u,v)
  const expr = hb.waves.map((w) => `${f(w.amplitude)}*sin(${K}*(${f(w.cycles.u)}*u+${f(w.cycles.v)}*v)+${f(w.phase)})`).join('\n    + ');
  return `float H(vec2 w){
  float u = (w.x - (-12.0)) / 24.0;
  float v = (6.0 - w.y) / 30.0;
  return ${expr};
}`;
}

/**
 * @param {object} manifest  a painted-landscape manifest ({ heartbeat, splatch, seed, light, ... }).
 * @param {object} [opts]     { waterLevel, camera } overrides.
 * @returns {object} raymarch payload: { frag, customUniforms, cameraStart, target, fov, pixelRatioCap, readout }.
 */
export function composeLandscapeRaymarch(manifest, opts = {}) {
  const seed = manifest.seed || 'default';
  const hb = resolveHeartbeat(manifest.heartbeat, seed, manifest.heartbeatOverrides);
  const pal = derivePalette(manifest.splatch, manifest.paletteOverrides);
  const light = manifest.light || hb.defaultLight || { x: 0.55, y: 0.35, z: 0.4 };
  const sky = deriveSky(pal, light);

  // water: honour an explicit level (elevation mode or an override); otherwise dry.
  const wl = Number.isFinite(opts.waterLevel) ? opts.waterLevel
    : Number.isFinite(manifest.elevation?.waterLevel) ? manifest.elevation.waterLevel
      : Number.isFinite(manifest.waterLevel) ? manifest.waterLevel : null;
  const hasWater = wl != null;

  // forest: an SDF-tree instance layer placed on the terrain (opt-in via manifest.forest / opts.forest).
  const forestCfg = opts.forest ?? manifest.forest;
  const trees = (forestCfg && forestCfg !== false)
    ? placeForest(hb, hasWater ? wl : null, (forestCfg && typeof forestCfg === 'object') ? forestCfg : { density: forestCfg === true ? 0.5 : +forestCfg })
    : [];
  const hasForest = trees.length > 0;
  const treeData = [];
  for (const t of trees) treeData.push(t.x, t.base, t.y, t.scale);   // one texel: (worldX, baseZ, worldY, scale)
  // fraction of trees rendered as conifers (conical) vs round; per-tree choice derives from the seed.
  const coniferFrac = (forestCfg && typeof forestCfg === 'object' && Number.isFinite(forestCfg.conifer)) ? forestCfg.conifer : 0.4;

  // day/night: deriveSky's `day` (0 night → 1 day). At night the terrain is lit by the MOON, not the
  // sun (which is below the horizon → no direct light), tinted cool + dim; the sky gains a moon + stars.
  const day = sky.day;
  const isNight = day < 0.4;
  const Llen = Math.hypot(light.x, light.z, light.y) || 1;
  const sunShader = `vec3(${f(light.x / Llen)}, ${f(light.z / Llen)}, ${f(light.y / Llen)})`;   // (x, up=worldZ, worldY)
  const md = [-0.30, 0.52, -0.80];                             // shader dir: up + left + FRONT (in view)
  const mlen = Math.hypot(md[0], md[1], md[2]) || 1;
  const MOON_DIR = `vec3(${f(md[0] / mlen)}, ${f(md[1] / mlen)}, ${f(md[2] / mlen)})`;
  const KEY_LIGHT = isNight ? MOON_DIR : sunShader;
  const LIGHT_MUL = isNight ? 'vec3(0.34, 0.40, 0.58)' : 'vec3(1.0)';   // cool dim moonlight vs full sun
  const skyOpts = (manifest.sky && typeof manifest.sky === 'object') ? manifest.sky : {};
  const coverage = Number.isFinite(opts.cloudCoverage) ? opts.cloudCoverage
    : Number.isFinite(skyOpts.clouds?.coverage) ? skyOpts.clouds.coverage
      : (isNight ? 0.45 : 0.5);
  const P = pal.positions;
  // swathe: quantise terrain shading into N Lambert bands (the 2D painter's faceted colour swaths). 0 = smooth.
  const swathe = Number.isFinite(opts.swathe) ? opts.swathe : Number.isFinite(manifest.swathe) ? manifest.swathe : 0;

  // SDF-tree instance layer (gated on hasForest). Trunk capsule + smin'd foliage blobs, placed from the
  // baked tree texture, culled per-tree by a bounding sphere (far ⇒ cheap lower bound = LOD).
  const treeGLSL = hasForest ? `
vec4 efTree(int i){ return texture2D(uTreeTex, vec2((float(i) + 0.5) / uTreeCount, 0.5)); }
float treeSeed(vec3 c){ return fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453); }  // per-tree rng
float thash(float n){ return fract(sin(n) * 43758.5453); }
bool isPine(float sd){ return fract(sd * 7.31) < ${f(coniferFrac)}; }
float treeTrunk(vec3 q, bool pine){ return sdfCapsule(q, vec3(0.0), vec3(0.0, pine ? 0.7 : 1.05, 0.0), pine ? 0.075 : 0.09); }
// ROUND crown — a base sphere welded (smin) to a seed-jittered cluster of superpositioned spheres.
float foliageRound(vec3 q, float sd){
  float cy = 1.42 + 0.5 * sd, R = 0.44 + 0.22 * sd;
  float f = sdfSphere(q - vec3(0.0, cy, 0.0), R);
  for (int i = 0; i < 4; i++){                                        // 4 spheres (was 6) — cheaper
    float fi = float(i);
    float a   = thash(sd * 9.0 + fi * 2.7) * 6.2831;
    float rad = (0.26 + 0.5 * thash(sd * 5.0 + fi)) * R * 1.5;
    float rr  = (0.34 + 0.36 * thash(sd * 3.0 + fi * 1.7)) * R;
    vec3 off  = vec3(cos(a) * rad, cy + (thash(sd + fi * 4.1) - 0.4) * R * 1.4, sin(a) * rad);
    f = sdfSmin(f, sdfSphere(q - off, rr), 0.26);
  }
  return f;
}
// CONIFER crown — 3 round-cone tiers narrowing upward, base radius jittered by seed.
float foliagePine(vec3 q, float sd){
  float w = 0.9 + 0.35 * sd;
  float d = 1e5;
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    d = min(d, sdfRoundCone(q - vec3(0.0, 0.65 + fi * 0.62, 0.0), (0.62 - fi * 0.15) * w, 0.05, 0.95));
  }
  return d;
}
float foliage(vec3 q, float sd, bool pine){ return pine ? foliagePine(q, sd) : foliageRound(q, sd); }
float sdfTree(vec3 p, vec3 c, float s, float sd){ vec3 q = (p - c) / s; bool pine = isPine(sd); return min(treeTrunk(q, pine), foliage(q, sd, pine)) * s; }
float instanceField(vec3 p){
  float d = 1e5;
  for (int i = 0; i < ${MAX_TREES}; i++){
    if (i >= int(uTreeCount)) break;
    vec4 t = efTree(i);
    vec3 c = vec3(t.x, t.y, t.z); float s = t.w;
    float bd = length(p - (c + vec3(0.0, 1.35 * s, 0.0))) - 2.05 * s;  // bounding sphere (covers pines too)
    if (bd > 0.2) { d = min(d, bd); continue; }                        // far ⇒ cheap lower bound (LOD)
    d = min(d, sdfTree(p, c, s, treeSeed(c)));                         // near ⇒ exact
  }
  return d;
}
vec3 shadeTree(vec3 p){
  // find the tree actually hit, classify trunk vs canopy by GEOMETRY (no green on the trunk), and take
  // the normal from the NEAREST tree only (was: re-march the whole forest 6× — the big cost).
  vec3 bc = vec3(0.0); float bs = 1.0, bsd = 0.0, best = 1e5;
  for (int i = 0; i < ${MAX_TREES}; i++){
    if (i >= int(uTreeCount)) break;
    vec4 t = efTree(i); vec3 c = vec3(t.x, t.y, t.z); float s = t.w;
    if (length(p - (c + vec3(0.0, 1.35 * s, 0.0))) - 2.05 * s > 0.35) continue;
    float d = sdfTree(p, c, s, treeSeed(c));
    if (d < best) { best = d; bc = c; bs = s; bsd = treeSeed(c); }
  }
  bool pine = isPine(bsd);
  vec3 q = (p - bc) / bs;
  bool isTrunk = treeTrunk(q, pine) < foliage(q, bsd, pine);
  vec2 e = vec2(0.02, 0.0);                                            // normal = central-diff of the ONE nearest tree
  vec3 n = normalize(vec3(
    sdfTree(p+e.xyy, bc, bs, bsd) - sdfTree(p-e.xyy, bc, bs, bsd),
    sdfTree(p+e.yxy, bc, bs, bsd) - sdfTree(p-e.yxy, bc, bs, bsd),
    sdfTree(p+e.yyx, bc, bs, bsd) - sdfTree(p-e.yyx, bc, bs, bsd)));
  float lam = 0.30 + 0.80 * max(0.0, dot(n, LIGHT));
  vec3 folCol = pine
    ? mix(vec3(0.06, 0.16, 0.09), vec3(0.13, 0.30, 0.15), 0.3 + 0.6 * bsd)   // darker blue-green conifer
    : mix(vec3(0.09, 0.19, 0.07), vec3(0.34, 0.48, 0.21), 0.3 + 0.6 * bsd);  // brighter round-tree green
  vec3 col = isTrunk ? vec3(0.27, 0.19, 0.12) : folCol;
  return col * lam * LIGHT_MUL;
}
` : '';
  const sceneMin = hasForest
    ? '0.70 * min(min(terrainField(p), waterField(p)), instanceField(p))'
    : '0.70 * min(terrainField(p), waterField(p))';

  const GLOBALS = `
${hasForest ? SDF_GLSL : ''}
const float AMBIENT = 0.22, GAIN = 0.78;
const vec3 P_SHADOW = ${rgb(pal.shadow)}, P_BASE = ${rgb(pal.base)}, P_MID = ${rgb(pal.mid)}, P_HIGH = ${rgb(pal.highlight)};
const vec3 ZENITH = ${rgb(sky.zenith)}, HORIZON = ${rgb(sky.horizon)};
const vec3 LIGHT = ${KEY_LIGHT};
const vec3 LIGHT_MUL = ${LIGHT_MUL};
const float DAY = ${f(day)}, COVERAGE = ${f(coverage)};
const float GAMMA = ${f(pal.gamma || 1)}, SWATHE = ${f(swathe)};
const vec3 MOON_DIR = ${MOON_DIR}, MOON_COL = vec3(0.96, 0.97, 1.0);
const float WL = ${f(hasWater ? wl : -1e4)};

float h21(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vn2(vec2 p){ vec2 i = floor(p), fr = fract(p); fr = fr*fr*(3.0-2.0*fr);
  float a=h21(i), b=h21(i+vec2(1,0)), c=h21(i+vec2(0,1)), d=h21(i+vec2(1,1));
  return mix(mix(a,b,fr.x), mix(c,d,fr.x), fr.y); }
float fbm2c(vec2 p){ float v=0.0, a=0.5; for (int i=0;i<4;i++){ v+=a*vn2(p); p*=2.05; a*=0.5; } return v; }

${heightGLSL(hb)}
vec3 terrainNormal(vec2 w){
  float e = 0.06;
  float hR = H(w + vec2(e,0.0)), hL = H(w - vec2(e,0.0));
  float hU = H(w + vec2(0.0,e)), hD = H(w - vec2(0.0,e));
  return normalize(vec3(-(hR - hL) / (2.0*e), 1.0, -(hU - hD) / (2.0*e)));
}
float terrainField(vec3 p){ return p.y - H(p.xz); }
float waterField(vec3 p){ ${hasWater ? 'if (H(p.xz) >= WL) return 1e4; return p.y - WL;' : 'return 1e4;'} }
${treeGLSL}
float sdfScene(vec3 p){ return ${sceneMin}; }

vec3 ramp(float t){
  t = clamp(t, 0.0, 1.0);
  if (t <= ${f(P[1])}) return mix(P_SHADOW, P_BASE, (t - ${f(P[0])}) / ${f(P[1] - P[0])});
  if (t <= ${f(P[2])}) return mix(P_BASE, P_MID, (t - ${f(P[1])}) / ${f(P[2] - P[1])});
  return mix(P_MID, P_HIGH, (t - ${f(P[2])}) / ${f(P[3] - P[2])});
}
vec3 shadeTerrain(vec3 p){
  vec3 n = terrainNormal(p.xz);
  float lam = AMBIENT + GAIN * max(0.0, dot(n, LIGHT));
  float t = clamp((lam - AMBIENT) / GAIN, 0.0, 1.0);
  t = pow(t, GAMMA);                                   // palette gamma (painted-landscape.js:1470)
  // SWATHE: quantise Lambert into bands (with soft edges) → the 2D painter's faceted colour swaths,
  // which per-pixel raymarching would otherwise dissolve into a smooth gradient. 0 ⇒ smooth.
  if (SWATHE > 0.5){ float ft = t * SWATHE, k = floor(ft); t = (k + smoothstep(0.40, 0.60, ft - k)) / SWATHE; }
  return ramp(t) * LIGHT_MUL;                          // cool-dim at night, full sun by day
}
vec3 skyCol(vec3 d){
  vec3 dn = normalize(d);
  float t = clamp(dn.y * 0.6 + 0.4, 0.0, 1.0);
  vec3 s = mix(HORIZON, ZENITH, t);
  // daytime leans toward a blue sky (palette skies are pale → white clouds wouldn't read otherwise)
  s = mix(s, mix(vec3(0.50, 0.67, 0.92), vec3(0.15, 0.39, 0.82), t), DAY * 0.7);
  float night = 1.0 - DAY;
  // stars + moon (night only)
  if (night > 0.01 && dn.y > 0.02) {
    float grid = h21(floor(dn.xz / max(dn.y, 0.12) * 90.0));
    s += vec3(0.85, 0.88, 1.0) * smoothstep(0.978, 0.995, grid) * night * smoothstep(0.03, 0.25, dn.y);
    float m = dot(dn, MOON_DIR);
    s += MOON_COL * pow(max(m, 0.0), 130.0) * 0.9 * night;                 // soft halo
    s = mix(s, MOON_COL, smoothstep(0.9979, 0.9990, m) * night);          // disc
  }
  // clouds — COVERAGE drives the threshold (lower threshold ⇒ more cloud). A lower-freq second sample
  // shades the undersides so the puffs read even against a pale day sky.
  vec2 uv = dn.xz / max(dn.y, 0.14) * 0.55 + vec2(uTime * 0.012, 0.0);
  float cf = fbm2c(uv);
  float c = smoothstep(1.0 - COVERAGE, 1.0 - COVERAGE + 0.28, cf);
  float lit = smoothstep(0.35, 0.75, fbm2c(uv * 0.6 + 3.1));              // top-lit vs shaded base
  vec3 cloudCol = mix(mix(vec3(0.58, 0.62, 0.72), vec3(1.0), lit), MOON_COL, 1.0 - DAY);
  return mix(s, cloudCol, c * smoothstep(-0.04, 0.22, dn.y) * (0.72 + 0.25 * DAY));
}
vec3 shadeWater(vec3 p, vec3 rd){
  float depth = clamp((WL - H(p.xz)) / 5.0, 0.0, 1.0);
  vec3 body = mix(vec3(0.47, 0.67, 0.78), vec3(0.08, 0.19, 0.31), depth);
  float e = 0.05; vec2 q = vec2(p.x * 1.2 - uTime * 0.4, p.z * 1.4);
  float nn = fbm2c(q), nx = fbm2c(q + vec2(e,0)) - nn, nz = fbm2c(q + vec2(0,e)) - nn;
  vec3 n = normalize(vec3(-nx * 1.2, 1.0, -nz * 1.2));
  float fres = 0.03 + 0.45 * pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
  return mix(body, skyCol(reflect(rd, n)), fres);
}
vec3 shadeSurface(vec3 p, vec3 rd){
  float dT = terrainField(p), dW = waterField(p);
  ${hasForest ? 'float dI = instanceField(p); vec3 c = (dI < dT && dI < dW) ? shadeTree(p) : (dW < dT ? shadeWater(p, rd) : shadeTerrain(p));'
    : 'vec3 c = (dW < dT) ? shadeWater(p, rd) : shadeTerrain(p);'}
  float haze = clamp((length(p - uCamPos) - 12.0) / 48.0, 0.0, 1.0);
  return mix(c, HORIZON, haze * 0.35);
}
void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){
  float above = max(p.y - (WL - 0.2), 0.0);
  float lay = ${hasWater ? 'exp(-above * above * 0.7)' : '0.0'};
  float dens = lay * (0.5 + 0.6 * fbm2c(p.xz * 0.2 + vec2(uTime * 0.05, 0.0))) * 0.07;
  emis = HORIZON * dens * 1.15;
  ext  = vec3(dens * 0.8);
}
`;

  const frag = buildVolumeFrag({
    globals: GLOBALS,
    uniforms: ['uniform float uRmax;', ...(hasForest ? ['uniform sampler2D uTreeTex;', 'uniform float uTreeCount;'] : [])],
    rayDirArg: true,
    boundsRadius: 'uRmax',
    steps: hasWater ? 40 : 8,                 // the valley haze needs steps; dry scenes skip the volume
    occluder: { sdfFn: 'sdfScene', groundFn: 'shadeSurface', traceSteps: hasForest ? 110 : 120, surfEps: '0.006', minStep: '0.02' },
    background: 'skyCol',
  });

  const cam = opts.camera || {};
  return {
    frag,
    customUniforms: { uRmax: 34, ...(hasForest ? { uTreeCount: trees.length } : {}) },
    ...(hasForest ? { dataTextures: { uTreeTex: { data: treeData, width: trees.length, height: 1 } } } : {}),
    cameraStart: cam.pos || [-2, 3.4, 13],
    target: cam.target || [0, 1.4, -13],           // horizon higher → sky (clouds/moon) fills the upper frame
    fov: cam.fov || 55,
    pixelRatioCap: hasForest ? 0.7 : 0.8,          // forests are per-instance-heavy → deemphasize resolution
    readout: [`${manifest.title || 'painted landscape'} · raymarch`, `${manifest.heartbeat} / ${manifest.splatch}${hasWater ? ' · water' : ''}${hasForest ? ` · ${trees.length} trees` : ''}`],
  };
}
