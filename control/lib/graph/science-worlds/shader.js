/**
 * A science page drawn by a shader. The rule: the law lives in JS, where the gates run; the shader is generated from
 * the same numbers and held to them. One GLSL source gives two fragment shaders:
 *
 *   the IMAGE  — a full-frame `effects[]` layer of the World page (scene-three.js), opaque, fed the live camera
 *                each frame: `vec4 sciImage(vec3 ro, vec3 rd)` is the colour seen along a ray from the eye.
 *   the PROBE  — the same functions evaluated at given inputs into a float target: `vec4 sciValue(vec4 a, vec4 b)`
 *                is the model quantity the shader computes (a field at a point, a ray's fate), read back by the
 *                conformance gate (conformance.js) and compared with what JS computes for the same input.
 *
 * Uniforms are the model's numbers: a name → a number (float) or [x, y, z] (vec3), declared here once for both
 * shaders, so the GLSL never carries a hand-typed twin of a JS constant. The probe half rides the page only on a
 * capture run (channels/science.js), so an ordinary page carries none of it.
 */

import { framing } from './page.js';

const NAME = /^u[A-Z][A-Za-z0-9]*$/;
const RESERVED = new Set(['uCamPos', 'uCamBasis', 'uRes', 'uTime', 'uFov', 'uPts', 'uN']);

function declarations(uniforms) {
  return Object.entries(uniforms).map(([k, v]) => {
    if (!NAME.test(k) || RESERVED.has(k)) throw new Error(`science-worlds: shader uniform '${k}' wants a name like uMass (and not a reserved one)`);
    if (typeof v === 'number' && Number.isFinite(v)) return `uniform float ${k};`;
    if (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) return `uniform vec3 ${k};`;
    throw new Error(`science-worlds: shader uniform '${k}' is a number or [x, y, z]`);
  }).join('\n');
}

/**
 * The two shaders from one source. `glsl` defines `vec4 sciImage(vec3 ro, vec3 rd)` and `vec4 sciValue(vec4 a, vec4 b)`
 * (and whatever they share); `uniforms` are the model's numbers.
 */
export function shaderPage({ glsl, uniforms = {} }) {
  if (typeof glsl !== 'string' || !/vec4\s+sciImage\s*\(/.test(glsl) || !/vec4\s+sciValue\s*\(/.test(glsl)) {
    throw new Error('science-worlds: a shader page defines vec4 sciImage(vec3 ro, vec3 rd) and vec4 sciValue(vec4 a, vec4 b)');
  }
  const decl = declarations(uniforms);
  const image = `precision highp float;
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime; uniform float uFov;
${decl}
${glsl}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 rd = normalize(uCamBasis * vec3(uv * 2.0 * tan(0.5 * uFov), 1.0));
  vec4 c = sciImage(uCamPos, rd);
  gl_FragColor = vec4(c.rgb, 1.0);
}
`;
  // each probe is two texels of uPts (a, b); pixel i of the N × 1 float target is sciValue(aᵢ, bᵢ)
  const probe = `precision highp float;
uniform float uTime;
${decl}
uniform sampler2D uPts; uniform float uN;
${glsl}
void main() {
  float i = floor(gl_FragCoord.x);
  vec4 a = texture2D(uPts, vec2((2.0 * i + 0.5) / (2.0 * uN), 0.5));
  vec4 b = texture2D(uPts, vec2((2.0 * i + 1.5) / (2.0 * uN), 0.5));
  gl_FragColor = sciValue(a, b);
}
`;
  return { layer: { frag: image, customUniforms: { ...uniforms } }, probe: { frag: probe, uniforms: { ...uniforms } } };
}

/** The ray the image shader casts through pixel (px, py) of a width × height frame, for an image probe's JS side. */
export function pixelRay({ pos, target, vfov, up = [0, 0, 1] }, px, py, width, height) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((c) => c / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = norm(sub(target, pos)), r = norm(cross(f, up)), u = norm(cross(r, f));
  const t = 2 * Math.tan((vfov * Math.PI) / 360);
  const x = ((px + 0.5) - 0.5 * width) / height, y = ((py + 0.5) - 0.5 * height) / height;   // py from the bottom, as gl_FragCoord
  return { ro: pos.slice(), rd: norm([0, 1, 2].map((k) => r[k] * x * t + u[k] * y * t + f[k])) };
}

/**
 * The World payload of a shader-drawn science page: no faces, the shader as a full-frame `effects[]` layer, cameras
 * framed on `points` (what the picture must show, in world units), and the science block (readout, honesty panel)
 * carrying the shader's probe for a capture run. `science` is the channel's config (channels/science.js).
 */
export function shaderPayload({ shader, points, science, viewBox = { width: 1120, height: 780 }, lead = 'angle', title = 'mojulo science world', bg = '#000000' }) {
  if (!science || !Array.isArray(science.t) || !science.t.length) throw new Error('science-worlds: a shader page carries its science block (the readout and the honesty panel)');
  const { center, radius, cameras } = framing(points, { viewBox, lead });
  return {
    faces: [], picks: [], cameras, viewBox, title, bg, glow: false,
    effects: [shader.layer], science: { ...science, probe: shader.probe },
    bounds: { center, radius },
  };
}
