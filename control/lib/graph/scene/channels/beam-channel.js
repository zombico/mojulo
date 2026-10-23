import { safeJson } from '../emit-util.js';
import { FIRE_COLORANTS } from '../../fire/fire.js';
import { wavePoints, sprayPoints } from '../../playscape/elements/elements.js';
import { strandPoints, beamLength } from '../../playscape/elements/beams.js';
import { GLYPHS_SRC, SPRAY_SRC } from './moment-channel.js';
import { GNOISE2_PAGE_SRC } from '../../noise/noise.js';
import { NOISE_GLSL } from '../../noise/noise-glsl.js';

/**
 * beam-channel — the page's side of the cast's BEAMS (state.moments `is: 'beam'`, playscape/elements/beams.js): each
 * attack plays once from its hand to its target on the world clock, then is gone. Every strand copy is a ribbon drawn
 * in up to three passes, values first:
 *
 *   ink    a black edge, laid over the scene (edge: ink | both)
 *   glow   the attack's colour, added, wide and soft (edge: glow | both)
 *   core   white, narrow: what reads first in greys
 *
 * A ribbon is camera-facing quads along the strand's spine (strandPoints, the module's own source), as wide at each point
 * as its radius; a head is the same passes as sprites. The charge is an orb swelling at the hand (or over the head)
 * with lights spiralling into it (wavePoints); rings ride a ray's line; sparks spray round every head (sprayPoints).
 * Its impact and shake are the moment channel's (moments the engine put down at the landing). Emitted only when a
 * world's cues fire a beam.
 */

/** The attacks a world's events fire (their specs, as lowered), in first-named order. */
export function beamSpecs(events) {
  const out = [];
  for (const r of (events && events.reactions) || []) if (r && r.do === 'ctrl' && r.op === 'beam' && r.spec && !out.includes(r.spec)) out.push(r.spec);
  // a party battle's juice: the attacks its steps fly (playscape/rpg/juice.js)
  const fx = events && events.rpg && events.rpg.juice && events.rpg.juice.fx;
  for (const B of Object.values((fx && fx.beams) || {})) if (!out.includes(B)) out.push(B);
  return out;
}

export function beamScript(specs, { fx = false } = {}) {
  const sparks = specs.some((B) => B.sparks), rings = specs.some((B) => B.rings), charge = specs.some((B) => B.charge);
  // a strand's style-floor words (scene/effect-style.js): a hue offset from the attack's colour, an opacity (an echo's),
  // a head stretched along its flight. Only emitted when an attack carries them
  const any = (k) => specs.some((B) => B.strands.some((S) => S[k]));
  const hue = any('hue'), alpha = any('alpha'), stretch = any('stretch'), ink = any('ink');
  // the noise effects (effects noise): lightning across a spine (`jag`, `forks`), a head drawn as flame (`fire`), a charge
  // drawn as a spell circle (`charge.form: 'circle'`). Only emitted when an attack carries them
  const jag = any('jag'), fire = any('fire'), circle = specs.some((B) => B.charge && B.charge.form === 'circle');
  // drawings a second (a composed style floor's `fps`, scene/juice-style.js): the attack held on each drawing, limited
  // animation; the world's clock (and so the landing) runs on. Only emitted when an attack carries it
  const fps = specs.some((B) => B.fps);
  // `fx` (the world's fxLight, scene/effect-light.js): each head, a ray's body and a charging orb throw their light
  return `
// BEAMS: attacks fired from a hand at a target, once each, on the world clock (ink, glow and a white core)
const __bmCol = ${safeJson(FIRE_COLORANTS)};
const __bmRgb = (c) => (Array.isArray(c) ? c : typeof c === 'string' && __bmCol[c] ? __bmCol[c] : typeof c === 'string' && c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) : [1, 1, 1]);
const __bmStrand = ${strandPoints.toString()};${jag ? `
// lightning: the spine pushed across itself by the module's own gradient noise (noise/noise.js), its ends held, struck
// anew (flicker) times a second; forks branch off it, each re-struck with it
const __nzN = ${GNOISE2_PAGE_SRC};
const __bmJ1 = new THREE.Vector3(), __bmJ2 = new THREE.Vector3(), __bmJd = new THREE.Vector3(), __bmJv = new THREE.Vector3();
const __bmRnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
function __bmJag(R, C, age) {
  const S = C.S, sp = R.spine, n = sp.length, strike = Math.floor(age * (S.flicker || 12)), sd = 101 + C.j * 37 + strike * 13;
  const a = sp[0].p, b = sp[n - 1].p; __bmJd.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = __bmJd.length() || 1; __bmJd.multiplyScalar(1 / L);
  __bmJv.set(camera.position.x - a[0], camera.position.y - a[1], camera.position.z - a[2]); __bmJ1.crossVectors(__bmJd, __bmJv).normalize(); __bmJ2.crossVectors(__bmJd, __bmJ1).normalize();
  const f = L / Math.max(0.5, S.jag * 3);
  for (let k = 1; k < n - 1; k++) {
    const u = k / (n - 1), env = Math.sin(Math.PI * u), x = u * f;
    const o1 = (__nzN(x, 0.5, sd) + 0.5 * __nzN(x * 2.3, 1.7, sd + 1) + 0.25 * __nzN(x * 5.1, 3.1, sd + 2)) * S.jag * env, o2 = 0.4 * __nzN(x, 9.3, sd + 3) * S.jag * env;
    const p = sp[k].p; sp[k] = { p: [p[0] + __bmJ1.x * o1 + __bmJ2.x * o2, p[1] + __bmJ1.y * o1 + __bmJ2.y * o2, p[2] + __bmJ1.z * o1 + __bmJ2.z * o2], r: sp[k].r };
  }
  if (C.forks) C.forks.forEach((F, i) => {
    const at = Math.floor((0.18 + 0.62 * __bmRnd(strike, i + 1)) * (n - 1)), o = sp[at].p, side = __bmRnd(strike, i + 7) < 0.5 ? -1 : 1, len = L * (0.12 + 0.2 * __bmRnd(strike, i + 3)), pts = [];
    for (let m = 0; m < 10; m++) { const u = m / 9, w = (__nzN(u * 4, i + 0.5, sd + 11 + i) * 0.35) * len, x = u * len;
      pts.push({ p: [o[0] + __bmJd.x * x * 0.6 + __bmJ1.x * (side * x * 0.8 + w) + __bmJ2.x * w * 0.5, o[1] + __bmJd.y * x * 0.6 + __bmJ1.y * (side * x * 0.8 + w) + __bmJ2.y * w * 0.5, o[2] + __bmJd.z * x * 0.6 + __bmJ1.z * (side * x * 0.8 + w) + __bmJ2.z * w * 0.5], r: sp[at].r * 0.7 * (1 - u) }); }
    for (const [m, mult] of F) { m.visible = true; __bmLay(m, pts, mult); }
  });
}` : ''}${fire || circle ? `
const __NZGL = ${JSON.stringify(NOISE_GLSL)};
// the page draws with a logarithmic depth buffer: a shader of its own carries three's log-depth chunks or the depth test
// puts it behind everything
const __bmQuadVS = '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\\n#include <logdepthbuf_vertex>\\n}';` : ''}${fire ? `
// a head drawn as FLAME: an egg of heat, its tail away from its flight, warped and torn by the shader noise scrolling back
const __bmFireFS = '#include <logdepthbuf_pars_fragment>\\nuniform float uT; uniform float uSd; uniform float uA; uniform vec3 uCol; varying vec2 vUv;\\n' + __NZGL + \`
void main() {
#include <logdepthbuf_fragment>
  vec2 p = vUv * 2.0 - 1.0; int sd = int(uSd);
  vec2 q = p * vec2(1.5, 1.0);
  vec2 w = vec2(nzFbm(q * 1.7 + vec2(0.0, -uT * 3.2), sd, 3), nzFbm(q * 1.7 + vec2(5.2, -uT * 3.6), sd + 9, 3));
  q += 0.38 * w;
  float body = length(vec2(q.x, (q.y + 0.38) * 0.6));
  float turb = nzFbm(q * 3.2 + vec2(0.0, -uT * 5.5), sd + 3, 4);
  float heat = clamp(1.0 - body + 0.42 * turb - max(p.y, 0.0) * 0.3, 0.0, 1.0) * (1.0 - smoothstep(0.7, 1.0, max(abs(p.x), abs(p.y))));
  vec3 c = mix(vec3(0.12, 0.03, 0.01), uCol * 0.85, smoothstep(0.06, 0.32, heat));
  c = mix(c, mix(uCol, vec3(1.0, 0.86, 0.42), 0.6), smoothstep(0.32, 0.58, heat));
  c = mix(c, vec3(1.0, 0.98, 0.9), smoothstep(0.6, 0.86, heat));
  gl_FragColor = vec4(c, smoothstep(0.05, 0.28, heat) * uA);
}\`;
const __bmF0 = new THREE.Vector3(), __bmF1 = new THREE.Vector3(), __bmFz = new THREE.Vector3(0, 0, 1), __bmFq = new THREE.Quaternion();
function __bmFlame(rgb, sd, a) {
  const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uSd: { value: sd }, uA: { value: a }, uCol: { value: new THREE.Color(rgb[0], rgb[1], rgb[2]) } }, vertexShader: __bmQuadVS, fragmentShader: __bmFireFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const f = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); f.raycast = function () {}; f.renderOrder = 26; f.visible = false; f.frustumCulled = false; scene.add(f); return f;
}` : ''}${circle ? `
// a SPELL CIRCLE: rings, a band of runes turning one way, ticks and a hexagram turning the other, drawn in the attack's
// colour with white where its lines are bright; it opens with an overshoot and stands square to the target
const __bmSigilFS = '#include <logdepthbuf_pars_fragment>\\nuniform float uT; uniform float uK; uniform vec3 uCol; varying vec2 vUv;\\n' + __NZGL + \`
float ring(float r, float R, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(r - R)); }
float seg(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return 1.0 - smoothstep(w * 0.5, w, length(pa - ba * h)); }
void main() {
#include <logdepthbuf_fragment>
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
  float a = atan(p.y, p.x), TAU = 6.2831853;
  float lines = ring(r, 0.96, 0.02) + ring(r, 0.865, 0.013) + ring(r, 0.6, 0.013) + ring(r, 0.32, 0.011);
  float ar = (a + uT * 0.55) / TAU * 40.0, cell = floor(ar), fa = fract(ar);
  float rune = step(0.885, r) * step(r, 0.94) * step(0.18, fa) * step(fa, 0.82) * step(-0.15, nzN(vec2(cell, 2.5), 7)) * (0.55 + 0.45 * step(0.0, nzN(vec2(cell * 3.0, fa * 5.0), 11)));
  float at = (a - uT * 0.8) / TAU * 24.0, tick = step(0.78, r) * step(r, 0.845) * step(0.42, abs(fract(at) - 0.5));
  float c = cos(-uT * 0.35), s = sin(-uT * 0.35); vec2 q = mat2(c, -s, s, c) * p; float star = 0.0;
  for (int k = 0; k < 3; k++) { float a0 = TAU * float(k) / 3.0 + 1.5708, a1 = a0 + TAU / 3.0; star += seg(q, 0.6 * vec2(cos(a0), sin(a0)), 0.6 * vec2(cos(a1), sin(a1)), 0.012) + seg(q, -0.6 * vec2(cos(a0), sin(a0)), -0.6 * vec2(cos(a1), sin(a1)), 0.012); }
  float glow = 0.18 * exp(-abs(r - 0.6) * 5.0) + 0.12 * (1.0 - smoothstep(0.0, 0.32, r));
  float L = clamp(lines + star, 0.0, 1.0), al = clamp(L + rune + tick * 0.8 + glow, 0.0, 1.0) * uK * (0.85 + 0.15 * sin(uT * 7.0));
  gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.55 * L), al);
}\`;
function __bmSigil(rgb, A, T, size) {
  const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uK: { value: 0 }, uCol: { value: new THREE.Color(rgb[0], rgb[1], rgb[2]) } }, vertexShader: __bmQuadVS, fragmentShader: __bmSigilFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); g.raycast = function () {}; g.renderOrder = 18; g.frustumCulled = false;
  const d = new THREE.Vector3(T[0] - A[0], T[1] - A[1], T[2] - A[2]).normalize(); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  g.position.fromArray(A); g.userData.size = size; g.visible = false; scene.add(g); return g;
}` : ''}${hue ? `
// a colour turned round the hue circle by deg (YIQ), its lightness kept
const __bmHue = (c, deg) => { const a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], i = 0.596 * c[0] - 0.274 * c[1] - 0.322 * c[2], q = 0.211 * c[0] - 0.523 * c[1] + 0.312 * c[2], i2 = i * co - q * si, q2 = i * si + q * co; return [y + 0.956 * i2 + 0.621 * q2, y - 0.272 * i2 - 0.647 * q2, y - 1.106 * i2 + 1.703 * q2].map((v) => Math.max(0, Math.min(1, v))); };` : ''}${stretch ? `
const __bmP0 = new THREE.Vector3(), __bmP1 = new THREE.Vector3();` : ''}
const __bmLength = ${beamLength.toString()};${charge ? `
const __bmWave = ${wavePoints.toString()};` : ''}
const __bmGlyph = ${GLYPHS_SRC};${sparks ? `
const __bmSpray = ${sprayPoints.toString()};
${SPRAY_SRC.replace(/__spr/g, '__bmSpr')}` : ''}
// across a ribbon: soft (glow), firm (core), hard (ink)
const __bmAcross = (edge) => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64); for (const [o, a] of edge) g.addColorStop(o, 'rgba(255,255,255,' + a + ')'); x.fillStyle = g; x.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(cv); };
const __bmTex = { glow: __bmAcross([[0, 0], [0.3, 0.35], [0.5, 1], [0.7, 0.35], [1, 0]]), core: __bmAcross([[0, 0], [0.2, 0.9], [0.5, 1], [0.8, 0.9], [1, 0]]), ink: __bmAcross([[0, 0], [0.08, 1], [0.92, 1], [1, 0]]) };
const __bmDisc = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 29, 0, 7); x.fill(); return new THREE.CanvasTexture(cv); })();
const __BM_N = 48;
// the passes a strand draws, outermost first: [kind, width ×, colour, additive?]
function __bmPasses(S, rgb) {
  const out = [];
  if (S.edge !== 'ink') out.push(['glow', S.edge === 'both' ? 2.9 : 2.6, rgb, true]);
  if (S.edge !== 'glow') out.push(['ink', 1.22, ${ink ? 'S.ink != null ? rgb.map((v) => v * S.ink) : ' : ''}[0, 0, 0], false]);
  out.push(['core', S.edge === 'glow' ? 0.8 : 0.9, [1, 1, 1], S.edge === 'glow']);
  return out;
}
function __bmRibbon(kind, rgb, add, order) {
  const g = new THREE.BufferGeometry(), N = __BM_N, uv = new Float32Array(N * 4), idx = [];
  for (let k = 0; k < N; k++) { uv.set([k / (N - 1), 0, k / (N - 1), 1], k * 4); if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ map: __bmTex[kind], color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.userData.__fire = true;
  const r = new THREE.Mesh(g, m); r.frustumCulled = false; r.raycast = function () {}; r.renderOrder = order; r.visible = false; scene.add(r); return r;
}
function __bmHead(kind, rgb, add, order) {
  const m = new THREE.SpriteMaterial({ map: kind === 'glow' ? __bmGlyph.dot.tex : __bmDisc, color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.userData.__fire = true; if (kind === 'core') m.opacity = 0.95;
  const s = new THREE.Sprite(m); s.raycast = function () {}; s.renderOrder = order; s.visible = false; scene.add(s); return s;
}
const __bmA = new THREE.Vector3(), __bmB = new THREE.Vector3(), __bmD = new THREE.Vector3(), __bmS = new THREE.Vector3(), __bmV = new THREE.Vector3();
function __bmLay(mesh, spine, mult) {
  const a = mesh.geometry.attributes.position.array, n = spine.length;
  for (let k = 0; k < __BM_N; k++) {
    const q = spine[Math.min(n - 1, k)], p0 = spine[Math.max(0, Math.min(n - 1, k - 1))].p, p1 = spine[Math.min(n - 1, k + 1)].p;
    __bmA.fromArray(q.p); __bmD.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); __bmV.subVectors(camera.position, __bmA);
    __bmS.crossVectors(__bmD, __bmV); const l = __bmS.length(); if (l > 1e-9) __bmS.multiplyScalar((q.r * mult) / l); else __bmS.set(0, 0, 0);
    a.set([__bmA.x - __bmS.x, __bmA.y - __bmS.y, __bmA.z - __bmS.z, __bmA.x + __bmS.x, __bmA.y + __bmS.y, __bmA.z + __bmS.z], k * 6);
  }
  mesh.geometry.attributes.position.needsUpdate = true;
}
const __bmLive = {}, __bmDone = {};
function __bmMake(M) {
  const B = M.spec, base = __bmRgb(M.color != null ? M.color : B.color), I = { M, B, from: M.from, to: M.to, copies: [], extra: [], gather: [], rgb: base };
  I.len = __bmLength(B, Math.hypot(M.to[0] - M.from[0], M.to[1] - M.from[1], M.to[2] - M.from[2]));
  B.strands.forEach((S, si) => {
    const rgb0 = S.color != null && M.color == null ? __bmRgb(S.color) : base, rgb = ${hue ? 'S.hue ? __bmHue(rgb0, S.hue) : ' : ''}rgb0, passes = __bmPasses(S, rgb);
    for (let j = 0; j < S.count; j++) {
      const C = { S, j, rib: [], head: [], rgb };
      passes.forEach(([kind, mult, col, add], pi) => { C.rib.push([__bmRibbon(kind, col, add, 20 + pi), mult]); ${fire ? 'if (!S.fire) ' : ''}C.head.push([__bmHead(kind, col, add, 24 + pi), mult]); });${alpha ? `
      if (S.alpha != null) for (const [o] of [...C.rib, ...C.head]) o.material.opacity *= S.alpha;` : ''}${jag ? `
      if (S.jag && S.forks) C.forks = Array.from({ length: S.forks }, () => passes.filter(([kind]) => kind !== 'ink').map(([kind, mult, col, add], pi) => [__bmRibbon(kind, col, add, 20 + pi), mult * 0.7]));` : ''}${fire ? `
      if (S.fire) C.flame = __bmFlame(rgb, 3 + si * 31 + j * 17, S.alpha != null ? S.alpha : 1);` : ''}${sparks ? `
      if (B.sparks) C.sp = __bmSprMake(B.sparks, rgb, __bmGlyph);` : ''}
      I.copies.push(C);
    }
  });${charge ? `
  ${circle ? `if (B.charge && B.charge.form === 'circle') I.sigil = __bmSigil(base, M.from, M.to, B.charge.size);
  else ` : ''}if (B.charge) {
    // the orb, in the attack's passes, and lights spiralling into it
    const S0 = B.strands[0];
    I.orb = __bmPasses(S0, base).map(([kind, mult, col, add], pi) => [__bmHead(kind, col, add, 24 + pi), mult]);
    I.W = { count: 3, trail: 8, lag: 0.03, cycle: 0.9, turn: -2, r: [B.charge.size * 5 + 0.6, 0.04], z: [0.5, 0], arc: 0, tilt: 0, wobble: [0, 0], spread: 'even', env: 'in', tail: 0.3, pulse: 0, size: 0.2, twinkle: 8 };
    const n = __bmWave(I.W, [0, 0, 0], 0).length;
    for (let i = 0; i < n; i++) { const s = __bmHead('glow', base, true, 23); I.gather.push(s); }
  }` : ''}${rings ? `
  if (B.rings) {
    // shock rings on the first ray's line, facing along it
    const S0 = B.strands.find((S) => S.form === 'ray');
    if (S0) {
      const dir = new THREE.Vector3(M.to[0] - M.from[0], M.to[1] - M.from[1], M.to[2] - M.from[2]), D = dir.length(); dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      I.rings = { S: S0, D, dir, list: [] };
      for (let k = 0; k < Math.min(14, Math.ceil(D / B.rings.every) + 1); k++) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(base[0], base[1], base[2]), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        m.material.userData.__fire = true; m.quaternion.copy(q); m.raycast = function () {}; m.visible = false; m.renderOrder = 19; scene.add(m); I.rings.list.push(m);
      }
    }
  }` : ''}
  return I;
}
function __bmStep(I, age) {
  const B = I.B, A = I.from, T = I.to;
  for (const C of I.copies) {
    const R = __bmStrand(C.S, A, T, age, C.j, __BM_N), on = R.spine.length > 1;${jag ? `
    if (C.forks) for (const F of C.forks) for (const [m] of F) m.visible = false;
    if (C.S.jag && on) __bmJag(R, C, age);` : ''}
    for (const [m, mult] of C.rib) { m.visible = on; if (on) __bmLay(m, R.spine, mult); }
    for (const [s, mult] of C.head) { s.visible = !!R.head; if (R.head) { s.position.fromArray(R.head.p); const z = R.head.r * mult * 2 * (s.material.map === __bmDisc ? 1 : 1.6); s.scale.set(z, z, 1); } }${fire ? `
    if (C.flame) { const F = C.flame; F.visible = !!R.head; if (R.head) {
      // square to the eye, its tail turned away from its flight on screen
      F.position.fromArray(R.head.p); F.quaternion.copy(camera.quaternion); const z = R.head.r * 1.5; F.scale.set(z, z * 1.5, 1);
      if (C.lastF) { __bmF0.fromArray(C.lastF).project(camera); __bmF1.fromArray(R.head.p).project(camera); const dx = (__bmF1.x - __bmF0.x) * camera.aspect, dy = __bmF1.y - __bmF0.y; if (dx * dx + dy * dy > 1e-9) C.ang = Math.atan2(dy, dx) + Math.PI / 2; }
      if (C.ang != null) F.quaternion.multiply(__bmFq.setFromAxisAngle(__bmFz, C.ang + Math.PI));
      F.material.uniforms.uT.value = age; C.lastF = R.head.p.slice(); } }` : ''}${stretch ? `
    // squash and stretch: the head drawn long along its flight on screen, thinner across it
    if (C.S.stretch && R.head) { if (C.last) { __bmP0.fromArray(C.last).project(camera); __bmP1.fromArray(R.head.p).project(camera); const dx = (__bmP1.x - __bmP0.x) * camera.aspect, dy = __bmP1.y - __bmP0.y; if (dx * dx + dy * dy > 1e-8) { const ang = Math.atan2(dy, dx); for (const [s] of C.head) { s.material.rotation = ang; s.scale.x *= 1 + C.S.stretch; s.scale.y /= 1 + 0.4 * C.S.stretch; } } } C.last = R.head.p.slice(); }` : ''}${fx ? `
    if (R.head) __fxlPush(R.head.p, I.rgb, __FXLR.head * C.S.width * (C.S.head || 1.2), (__FXLR.reach * C.S.width) ** 2);
    if (C.S.form === 'ray' && R.spine.length > 2) __fxlPush(R.spine[R.spine.length >> 1].p, I.rgb, __FXLR.body * C.S.width, (__FXLR.reach * 2 * C.S.width) ** 2);` : ''}${sparks ? `
    if (C.sp) __bmSprStep(C.sp, __bmSpray(B.sparks, R.head ? R.head.p : A, age + C.j * 0.37, true), 1, !!R.head);` : ''}
  }${charge ? `
  ${circle ? `if (I.sigil) {
    // opens with an overshoot over the charge (anticipation), turns, holds while the strands fly, fades as they end
    const c = B.charge, u = Math.min(1, age / (c.time * 0.7)), back = 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2, out = Math.max(0, Math.min(1, (I.len - 0.5 - age) / 0.5));
    const g = I.sigil, k = Math.max(0, back) * out; g.visible = k > 0.01; g.scale.setScalar(g.userData.size * Math.max(0.01, back));
    g.material.uniforms.uT.value = age; g.material.uniforms.uK.value = Math.min(1, u * 1.4) * out;${fx ? `
    __fxlPush(A, I.rgb, __FXLR.charge * c.size * 0.6 * k, (c.size * 1.5) ** 2);` : ''}
  }
  ` : ''}if (I.orb) {
    // swelling until the strands go, then gone as the first one leaves
    const c = B.charge, u = Math.min(1, age / c.time), go = Math.max(0, (age - c.time) / 0.25), k = (u * u * (3 - 2 * u)) * Math.max(0, 1 - go), fl = 1 + 0.08 * Math.sin(age * 40);
    for (const [s, mult] of I.orb) { s.visible = k > 0.01; s.position.fromArray(A); const z = c.size * k * fl * mult * 2 * (s.material.map === __bmDisc ? 1 : 1.6); s.scale.set(z, z, 1); }${fx ? `
    __fxlPush(A, I.rgb, __FXLR.charge * c.size * k * fl, (c.size * 2) ** 2);` : ''}
    const pts = __bmWave(I.W, [A[0], A[1], A[2] - 0.5 * (1 - u)], age);
    I.gather.forEach((s, i) => { const q = pts[i]; s.visible = age < c.time && q && q.w > 0.05; if (s.visible) { s.position.fromArray(q.p); s.scale.setScalar(0.18 * (0.4 + 0.6 * q.w)); s.material.opacity = q.w; } });
  }` : ''}${rings ? `
  if (I.rings) {
    // riding forward along the line behind the ray's front, swelling as they go
    const Rg = I.rings, S = Rg.S, tt = age - S.delay, front = Math.min(Rg.D, S.speed * tt), live = tt > 0 && tt < Rg.D / S.speed + S.hold;
    Rg.list.forEach((m, k) => {
      const x = ((k * B.rings.every + tt * S.speed * 0.12) % (Rg.list.length * B.rings.every));
      m.visible = live && x < front - 0.3 && x > 0.4; if (!m.visible) return;
      m.position.set(A[0] + Rg.dir.x * x, A[1] + Rg.dir.y * x, A[2] + Rg.dir.z * x);
      const sz = S.width * B.rings.size * (0.8 + 0.4 * ((x / B.rings.every) % 1)); m.scale.setScalar(sz); m.material.opacity = 0.55 * (1 - ((x / B.rings.every) % 1) * 0.6);
    });
  }` : ''}
}
function __bmDrop(I) {
  const gone = (o) => { scene.remove(o); if (o.geometry && !o.isSprite) o.geometry.dispose(); o.material.dispose(); };
  for (const C of I.copies) { C.rib.forEach(([m]) => gone(m)); C.head.forEach(([s]) => gone(s));${jag ? ' if (C.forks) C.forks.forEach((F) => F.forEach(([m]) => gone(m)));' : ''}${fire ? ' if (C.flame) gone(C.flame);' : ''}${sparks ? ' if (C.sp) __bmSprDrop(C.sp);' : ''} }${charge ? `
  if (I.orb) { I.orb.forEach(([s]) => gone(s)); I.gather.forEach(gone); }` : ''}${circle ? `
  if (I.sigil) gone(I.sigil);` : ''}${rings ? `
  if (I.rings) I.rings.list.forEach(gone);` : ''}
}
function __stepBeams() {
  const W = window.__mojCtrl && window.__mojCtrl.world; if (!W) return;
  const now = W.time || 0;
  for (const M of W.moments || []) {
    if (M.is !== 'beam') continue;
    const key = M.by + '|' + M.t0;
    if (!__bmLive[key] && !__bmDone[key] && now >= M.t0) __bmLive[key] = __bmMake(M);
  }
  for (const key in __bmLive) {
    const I = __bmLive[key], age = now - I.M.t0;
    if (age >= I.len || age < 0) { __bmDrop(I); delete __bmLive[key]; __bmDone[key] = 1; continue; }
    __bmStep(I, ${fps ? 'I.B.fps ? Math.floor(age * I.B.fps) / I.B.fps : age' : 'age'});
  }
}
window.__mojBeams = { live: () => Object.keys(__bmLive) };`;
}
