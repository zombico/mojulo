/**
 * The classical world's field drawn as a volume over its meshes: the field's strength as a glow on a log scale
 * (`volume`), or the potential's shells where |V| doubles (`shells`), coloured by the potential's sign. The charges'
 * paths ride in as a float texture (one row per charge, one texel per track sample: x, y, z in scene units and k·q),
 * read on the page's clock exactly as the movers read theirs (play, hold, replay; linear between samples), so the
 * field moves with the bodies. E and V are computed from them per sample, the same sums as field.js; the
 * conformance gate holds the shader's E and V to JS at points and moments through the run (probes.js).
 *
 * The model is E and V. How they glow is dress: the log scale's range, the shells' spacing, the colours.
 *
 * Frame: z-up scene units, s scene units per metre; E in V/m and V in volts, computed in SI.
 */

import { shaderPage } from '../shader.js';

const g = (x) => { const s = (+x).toPrecision(9); return /[.e]/.test(s) ? s.replace(/e\+?/, 'e') : `${s}.0`; };

/** The charges' tracks as a texture: row i is charge i, texel k its sample k (scene x, y, z, and k·q). */
export function trackTexture(src, tracks, s) {
  const N = tracks.t.length, n = src.charges.length, data = new Array(4 * N * n);
  src.charges.forEach((c, i) => {
    const x = tracks.bodies[c.id].x;
    for (let k = 0; k < N; k++) { const o = 4 * (i * N + k); data[o] = x[k][0] * s; data[o + 1] = x[k][1] * s; data[o + 2] = x[k][2] * s; data[o + 3] = c.k * c.q; }
  });
  return { data, width: N, height: n };
}

/** Where the charges are at page time `sec` (scene units), as the shader reads them: the movers' clock, float64. */
export function chargesAt(tex, sec, period, hold) {
  const ph = sec % (period + hold), u = ph < period ? ph / period : 1, f = u * (tex.width - 1), k0 = Math.floor(f), k1 = Math.min(k0 + 1, tex.width - 1), a = f - k0;
  return Array.from({ length: tex.height }, (_, i) => {
    const o0 = 4 * (i * tex.width + k0), o1 = 4 * (i * tex.width + k1), d = tex.data;
    return { x: [0, 1, 2].map((c) => d[o0 + c] + (d[o1 + c] - d[o0 + c]) * a), kq: d[o0 + 3] };
  });
}

/**
 * The field shader. `mode` 'volume' | 'shells'; `tex` the tracks; `E0` the uniform field (V/m); `s` scene units per
 * metre; `centre`, `R` the drawn region (scene units); `lo`, `hi` the log scale (log10 V/m); `vref` the potential the
 * shells double from (V); `period`, `hold` the page clock.
 */
export function fieldShader({ mode, tex, E0, s, centre, R, lo, hi, vref, period, hold, steps = mode === 'shells' ? 128 : 80 }) {
  const n = tex.height;
  const uniforms = { uE0: E0, uS: s, uCentre: centre, uR: R, uLo: lo, uHi: hi, uVref: vref, uPeriod: period, uHold: hold, uEScale: 10 ** -hi };
  const glsl = `
const int N = ${n};
const float SAMPLES = ${g(tex.width)};
const vec3 WARM = vec3(1.0, 0.62, 0.32), COOL = vec3(0.35, 0.62, 1.0);
// the charges at page time t: the movers' clock (play, hold, replay), linear between samples
void chargesAt(float t, out vec4 C[N]) {
  float ph = mod(t, uPeriod + uHold), u = ph < uPeriod ? ph / uPeriod : 1.0;
  float f = u * (SAMPLES - 1.0), k0 = floor(f), k1 = min(k0 + 1.0, SAMPLES - 1.0), a = f - k0;
  for (int i = 0; i < N; i++) {
    float v = (float(i) + 0.5) / float(N);
    vec4 p0 = texture2D(uTrack, vec2((k0 + 0.5) / SAMPLES, v)), p1 = texture2D(uTrack, vec2((k1 + 0.5) / SAMPLES, v));
    C[i] = vec4(mix(p0.xyz, p1.xyz, a), p0.w);
  }
}
// E (V/m) and V (volts) at scene point p, from the charges C: SI distances
void field(vec3 p, vec4 C[N], out vec3 E, out float V) {
  E = uE0; V = -dot(uE0, p / uS);
  for (int i = 0; i < N; i++) {
    vec3 d = (p - C[i].xyz) / uS; float r = length(d);
    if (r > 0.0) { E += C[i].w * d / (r * r * r); V += C[i].w / r; }
  }
}
vec4 sciImage(vec3 ro, vec3 rd) {
  vec4 C[N]; chargesAt(uTime, C);
  vec3 oc = ro - uCentre; float b = dot(oc, rd), h = b * b - (dot(oc, oc) - uR * uR);
  if (h < 0.0) return vec4(0.0);
  h = sqrt(h);
  float t0 = max(-b - h, 0.0), t1 = min(-b + h, sciSceneDistance(rd));
  if (t1 <= t0) return vec4(0.0);
  float dt = (t1 - t0) / float(${steps}), jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 col = vec3(0.0); float T = 1.0;
  for (int i = 0; i < ${steps}; i++) {
    vec3 p = ro + rd * (t0 + (float(i) + jitter) * dt);
    vec3 E; float V; field(p, C, E, V);
    vec3 tint = mix(COOL, WARM, 0.5 + 0.5 * clamp(V / uVref, -1.0, 1.0));
    ${mode === 'shells' ? `float lv = log2(max(abs(V), 1e-30) / uVref);
    float w = (lv > -3.5 && lv < 4.5) ? smoothstep(0.1, 0.0, abs(fract(lv + 0.5) - 0.5)) : 0.0;
    float a = 1.0 - exp(-4.0 * w * dt / uR);` : `float gl = clamp((log(max(length(E), 1e-30)) / log(10.0) - uLo) / (uHi - uLo), 0.0, 1.0);
    float a = 1.0 - exp(-0.6 * gl * gl * gl * gl * dt / uR);
    tint *= 0.3 + 1.6 * gl * gl;`}
    col += T * a * tint; T *= 1.0 - a;
    if (T < 0.01) break;
  }
  return vec4(col, 1.0 - T);
}
// the model quantities, for the conformance gate: E (scaled by 10^−hi) and V (by 1/vref) at scene point a.xyz at page
// time a.w
vec4 sciValue(vec4 a, vec4 b) {
  vec4 C[N]; chargesAt(a.w, C);
  vec3 E; float V; field(a.xyz, C, E, V);
  return vec4(E * uEScale, V / uVref);
}
`;
  return { ...shaderPage({ glsl, uniforms, dataTextures: { uTrack: tex }, output: 'layer', depthClip: true }), texture: tex };
}
