/**
 * The plane world's sheet: |ψ|² over the plane, played from the run's own frames, drawn by a shader as a layer over
 * the page's meshes (the far screen and its dots), with the wall as a raised slab open at the slits. The frames are
 * the solver's (plane.js, averaged down to SHEET_RES a side), passed as a float texture four frames to a texel; the
 * shader only looks them up (bilinear in space, linear in time), and the conformance gate holds what it looks up to
 * the frames, and its wall to the model's (probes.js).
 *
 * Brightness is the square root of |ψ|² against the run's brightest cell (stored so), so the weak passed wave shows
 * beside the strong incident one: dress, and the page says so.
 *
 * Frame: z-up, the sheet in z = 0 across [−half, half]², the wave travelling +x; one scene unit is 1/s nm.
 */

import { shaderPage } from '../shader.js';
import { SHEET_FRAMES, SHEET_RES, slitCentres } from './plane.js';

const g = (x) => { const s = (+x).toPrecision(9); return /[.e]/.test(s) ? s.replace(/e\+?/, 'e') : `${s}.0`; };

/** The run's frames as a texture: brightness √(|ψ|² / brightest), four frames to a texel, frames side by side. */
export function sheetTexture(frames) {
  const M = SHEET_RES, F = SHEET_FRAMES, tiles = F / 4, W = tiles * M;
  if (frames.length !== F) throw new Error(`science-worlds: a sheet wants ${F} frames`);
  let top = 0;
  for (const fr of frames) for (const v of fr) top = Math.max(top, v);
  const data = new Array(4 * W * M).fill(0);
  frames.forEach((fr, f) => {
    const tile = Math.floor(f / 4), c = f % 4;
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const b = top > 0 ? Math.sqrt(fr[j * M + i] / top) : 0;
      data[4 * (j * W + tile * M + i) + c] = Math.round(b * 1e4) / 1e4;
    }
  });
  return { data, width: W, height: M };
}

/** What the shader looks up at sheet coordinates (u, v) in [0, 1]² and frame position f (0 … F − 1), in float32. */
export function sheetValue(tex, u, v, f) {
  const M = SHEET_RES, F = SHEET_FRAMES, W = tex.width, fr = Math.fround;
  const texel = (k, i, j) => fr(tex.data[4 * (j * W + Math.floor(k / 4) * M + i) + (k % 4)]);
  const at = (k) => {
    const qx = u * M - 0.5, qy = v * M - 0.5, x0 = Math.floor(qx), y0 = Math.floor(qy), ax = qx - x0, ay = qy - y0;
    const c = (i) => Math.max(0, Math.min(M - 1, i));
    const a = texel(k, c(x0), c(y0)) * (1 - ax) + texel(k, c(x0 + 1), c(y0)) * ax;
    const b = texel(k, c(x0), c(y0 + 1)) * (1 - ax) + texel(k, c(x0 + 1), c(y0 + 1)) * ax;
    return a * (1 - ay) + b * ay;
  };
  const f0 = Math.floor(f), f1 = Math.min(f0 + 1, F - 1), w = f - f0;
  return at(f0) * (1 - w) + at(f1) * w;
}

/**
 * The sheet shader. `half` the sheet's half size and `s` scene units per nm; `wall` the model's (nm) or null; `wallH`
 * the slab's drawn height; `period` and `hold` the page clock; `frames` the run's.
 */
export function planeShader({ half, s, wall, wallH, period, hold, frames }) {
  const tex = sheetTexture(frames);
  const M = SHEET_RES, F = SHEET_FRAMES;
  // the wall as boxes: the stretches between the slits, at its half-height faces
  const boxes = [];
  if (wall) {
    const x0 = (wall.at - wall.thickness / 2) * s, x1 = (wall.at + wall.thickness / 2) * s;
    const gaps = slitCentres(wall).map((c) => [(c - wall.width / 2) * s, (c + wall.width / 2) * s]);
    let y = -half;
    for (const [a, b] of gaps) { if (a > y) boxes.push([x0, y, x1, a]); y = b; }
    if (y < half) boxes.push([x0, y, x1, half]);
  }
  const uniforms = { uHalf: half, uWallH: wallH, uPeriod: period, uHold: hold };
  const glsl = `
const float M = ${g(M)}, W = ${g(tex.width)}, FRAMES = ${g(F)};
const vec3 BASE = vec3(0.075, 0.095, 0.15), GLOW = vec3(1.0, 0.78, 0.38), WALL = vec3(0.56, 0.6, 0.68);
float texel(float f, float i, float j) {
  float tile = floor(f / 4.0), c = f - 4.0 * tile;
  vec4 t = texture2D(uSheet, vec2((tile * M + i + 0.5) / W, (j + 0.5) / M));
  return c < 0.5 ? t.x : c < 1.5 ? t.y : c < 2.5 ? t.z : t.w;
}
float frameAt(float f, vec2 uv) {
  vec2 q = uv * M - 0.5, q0 = floor(q), a = q - q0;
  float i0 = clamp(q0.x, 0.0, M - 1.0), i1 = clamp(q0.x + 1.0, 0.0, M - 1.0), j0 = clamp(q0.y, 0.0, M - 1.0), j1 = clamp(q0.y + 1.0, 0.0, M - 1.0);
  float lo = texel(f, i0, j0) * (1.0 - a.x) + texel(f, i1, j0) * a.x;
  float hi = texel(f, i0, j1) * (1.0 - a.x) + texel(f, i1, j1) * a.x;
  return lo * (1.0 - a.y) + hi * a.y;
}
// the brightness at sheet coordinates uv, frame position fp (the solver's frames, as stored)
float sheetAt(vec2 uv, float fp) {
  float f0 = floor(fp), f1 = min(f0 + 1.0, FRAMES - 1.0), w = fp - f0;
  return frameAt(f0, uv) * (1.0 - w) + frameAt(f1, uv) * w;
}
// 1 where the wall stands in the plane (x, y), 0 where the plane is open
float wallAt(vec2 p) {
  ${boxes.length ? boxes.map((b) => `if (p.x >= ${g(b[0])} && p.x <= ${g(b[2])} && p.y >= ${g(b[1])} && p.y <= ${g(b[3])}) return 1.0;`).join('\n  ') : ''}
  return 0.0;
}
// a ray against a box: (near, far) or (1, 0) on a miss; n the near face's normal
vec2 box(vec3 ro, vec3 rd, vec3 lo, vec3 hi, out vec3 n) {
  vec3 inv = 1.0 / rd, t0 = (lo - ro) * inv, t1 = (hi - ro) * inv, tn = min(t0, t1), tf = max(t0, t1);
  float a = max(max(tn.x, tn.y), tn.z), b = min(min(tf.x, tf.y), tf.z);
  n = a == tn.x ? vec3(-sign(rd.x), 0.0, 0.0) : a == tn.y ? vec3(0.0, -sign(rd.y), 0.0) : vec3(0.0, 0.0, -sign(rd.z));
  return b >= max(a, 0.0) ? vec2(max(a, 0.0), b) : vec2(1.0, 0.0);
}
vec4 sciImage(vec3 ro, vec3 rd) {
  float far = sciSceneDistance(rd), best = 1e30; vec3 col = vec3(0.0); float cover = 0.0;
  // the sheet
  if (rd.z < -1e-6 && ro.z > 0.0) {
    float t = -ro.z / rd.z; vec3 p = ro + rd * t;
    if (abs(p.x) <= uHalf && abs(p.y) <= uHalf && t < far) {
      float ph = mod(uTime, uPeriod + uHold), fp = clamp(ph / uPeriod, 0.0, 1.0) * (FRAMES - 1.0);
      float b = sheetAt((p.xy + uHalf) / (2.0 * uHalf), fp);
      best = t; col = BASE + GLOW * b * 1.1; cover = 1.0;
    }
  }
  // the wall's slab
  ${boxes.map((b) => `{ vec3 n; vec2 h = box(ro, rd, vec3(${g(b[0])}, ${g(b[1])}, 0.0), vec3(${g(b[2])}, ${g(b[3])}, uWallH), n);
    if (h.y > h.x && h.x < best && h.x < far) { best = h.x; col = WALL * (0.45 + 0.55 * abs(dot(n, normalize(vec3(0.4, -0.5, 0.8))))); cover = 1.0; } }`).join('\n  ')}
  return vec4(col * cover, cover);
}
// the model quantities, for the conformance gate: the sheet's brightness at (a.x, a.y) in frame position a.z, and
// whether the wall stands at the plane point (b.x, b.y)
vec4 sciValue(vec4 a, vec4 b) {
  return vec4(sheetAt(a.xy, a.z), wallAt(b.xy), 0.0, 0.0);
}
`;
  return { ...shaderPage({ glsl, uniforms, dataTextures: { uSheet: tex }, output: 'layer', depthClip: true }), texture: tex, boxes };
}
