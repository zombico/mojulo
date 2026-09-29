import { safeJson } from '../emit-util.js';
import { resolveMetalSurface, metalLut, LUT_A } from '../../materials/metal-surface.js';

// In-page script: the metal channel (metal-surfaces S3) — metal surfaces shaded live on the World page. Groups whose
// geometry carries the per-vertex metal attribute (packed by faceListToMesh from faces tagged `metal`) get their
// MeshBasicMaterial patched: each pixel reflects a small studio (a dark floor, a dome tinted by the scene's own sky
// when it has one, a softbox) through the finish's microfacet spread along and across the toolpath, weighted per
// channel by the metal's measured reflectance at that angle (and through its oxide film, from one lookup texture of
// thickness × angle), plus the sun as an analytic anisotropic lobe. The finish's figure is drawn here (brushed
// streaks, lathe feed, blast grain, hammer dimples, zinc spangle, mill scale, bismuth's hopper terraces), and thermal
// scale and copper's age cover the metal where they would. A metal is mostly what it reflects: without this a
// correctly coloured metal reads as paint (the metal-surface spike: ΔE 7–44 baked, 0–4 reflected).
// Surfaces are scene-wide, so every patched group compiles the same program. A patch already on the material
// (specular, crystal) is chained, not replaced. A one-shot setup block: pages with no metal faces emit ZERO bytes.

// the studio a metal reflects, in linear light: a dome (zenith → horizon), a darker ground, a softbox
const STUDIO = { zen: [0.52, 0.55, 0.59], hor: [0.19, 0.2, 0.21], gnd: [0.06, 0.058, 0.056], box: [0.62, -0.62, 0.48], sunE: 0.18 };
const lin = (c) => { const v = c > 1 ? c / 255 : c; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const toLum = (c, L) => { const l = lum(c) || 1; return c.map((v) => +(v * L / l).toFixed(4)); };
/**
 * The channel's inputs from the scene's metal surface keys: the per-surface parameters, one RGBA lookup texture of
 * every metal used (rows stacked), and the studio, its dome and ground tinted by the scene's sky when there is one
 * (an atmosphere sky's zenith and horizon, rescaled to the studio's own brightness so a metal stays legible).
 */
export function metalChannelInputs(keys, { sky = null, unit = 1 } = {}) {
  const metals = []; const rowOf = {}; let rows = 0;
  const S = keys.map((key) => resolveMetalSurface(JSON.parse(key)));
  for (const s of S) if (!(s.metal in rowOf)) { const n = metalLut(s.metal).length / (LUT_A * 3); rowOf[s.metal] = [rows, n]; rows += n; metals.push(s.metal); }
  const rgba = new Uint8Array(rows * LUT_A * 4); let o = 0;
  for (const m of metals) { const t = metalLut(m); for (let i = 0; i < t.length; i += 3) { rgba[o++] = t[i]; rgba[o++] = t[i + 1]; rgba[o++] = t[i + 2]; rgba[o++] = 255; } }
  const surfaces = S.map((s) => { const [row0, n] = rowOf[s.metal]; const age = s.age != null ? ageCover(s.age) : [0, 0];
    return { A: [s.ax, s.ay, s.fig, +((s.seed * 12.9898) % 97).toFixed(4)], B: [row0, n, s.spread, s.scaleFrom], C: [age[0], age[1], s.thermal ? 1 : 0, 0] }; });
  const tinted = sky && Array.isArray(sky.zenith) && sky.zenith.length >= 3 && Array.isArray(sky.horizon) && sky.horizon.length >= 3;
  const zen = tinted ? toLum(sky.zenith.slice(0, 3).map(lin), lum(STUDIO.zen)) : STUDIO.zen, hor = tinted ? toLum(sky.horizon.slice(0, 3).map(lin), lum(STUDIO.hor)) : STUDIO.hor;
  const gnd = tinted ? toLum(hor, lum(STUDIO.gnd)) : STUDIO.gnd;
  return { index: Object.fromEntries(keys.map((k, i) => [k, i])), unit: Number.isFinite(unit) && unit > 0 ? unit : 1, surfaces, lut: { h: rows, b64: Buffer.from(rgba).toString('base64') }, zen, hor, gnd, box: STUDIO.box, sunE: STUDIO.sunE };
}
// copper's age as the channel's two cover dials: the brown past interference, and the verdigris share
function ageCover(age) { const d = 90 * Math.sqrt(Math.max(0, age) / 0.25); const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }; return [+ss(110, 380, d).toFixed(4), +ss(4, 40, age).toFixed(4)]; }

const FRAG_FNS = [
  'uniform vec3 uMetSun; uniform vec3 uMetZen; uniform vec3 uMetHor; uniform vec3 uMetGnd; uniform vec3 uMetBox; uniform float uMetSunE;',
  'uniform sampler2D uMetLut; uniform float uMetLutH; uniform float uMetUnit; float metFp;',
  // a figure feature of size `feat` (metres) fades out as it drops below two pixels: sub-pixel figures would sparkle,
  // and their mean is already in the reflectance (a brushed sheet far off is its anisotropic sheen, not its streaks)
  'float metAa(float feat) { return clamp(feat / (2.0 * metFp) - 0.5, 0.0, 1.0); }',
  'varying vec4 vMetT; varying float vMetD; varying vec3 vMetWp; varying vec3 vMetN;',
  'float metHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float metNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(metHash(i), metHash(i + vec2(1.0, 0.0)), w.x), mix(metHash(i + vec2(0.0, 1.0)), metHash(i + vec2(1.0, 1.0)), w.x), w.y); }',
  'float metN(vec2 p, float feat) { return mix(0.5, metNoise(p), metAa(feat)); }',
  // the studio, without the sun (the sun is the analytic lobe): the dome to the horizon, the ground below, a softbox
  // `w` pre-blurs the studio for a rough lobe (the softbox edge widens, its peak lowers with the spread), so eight fixed
  // samples read smooth instead of grainy: a cheap prefilter, the analytic studio's advantage over a texture
  'vec3 metStudio(vec3 d, float w) { float h = d.z; vec3 c = h > 0.0 ? mix(uMetHor, uMetZen, pow(h, 0.7)) : mix(uMetGnd, uMetHor * 0.6, exp(8.0 * h / (1.0 + 6.0 * w)));',
  '  return c + vec3(3.2 / (1.0 + 4.0 * w)) * smoothstep(0.90 - 0.9 * w, 0.94 + 0.2 * w, dot(d, uMetBox)); }',
  // reflectance by (film thickness, cosθ) from the metal's rows: columns crowd toward grazing, stored as sqrt(R)
  'vec3 metLutAt(vec4 B, float d, float c) { float col = 15.0 * (1.0 - sqrt(clamp(c, 0.0, 1.0))); float row = B.x + clamp(d / 5.0, 0.0, B.y - 1.0);',
  '  vec3 v = texture2D(uMetLut, vec2((col + 0.5) / 16.0, (row + 0.5) / uMetLutH)).rgb; return v * v; }',
].join('\\n');

const FRAG_MAIN = [
  'if (vMetT.w > -0.5) {',
  '  int s = int(vMetT.w + 0.5); vec4 A = uMetA[s]; vec4 B = uMetB[s]; vec4 C = uMetC[s];',
  '  vec3 Nflat = normalize(cross(dFdx(vMetWp), dFdy(vMetWp))); vec3 V = normalize(cameraPosition - vMetWp); if (dot(Nflat, V) < 0.0) Nflat = -Nflat;',
  '  vec3 N = dot(vMetN, vMetN) > 0.25 ? normalize(vMetN) : Nflat; if (dot(N, Nflat) < 0.0) N = -N;',   // the smoothed normal, on the seen side
  '  vec3 T = vMetT.xyz - N * dot(N, vMetT.xyz); T = dot(T, T) > 1e-8 ? normalize(T) : normalize(cross(N, abs(N.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0))); vec3 Bt = cross(N, T);',
  '  vec3 pm = vMetWp * uMetUnit; metFp = max(length(fwidth(pm)), 1e-7);',   // figures are authored in metres, whatever the recipe unit
  '  float u = dot(pm, T), v = dot(pm, Bt); int fig = int(A.z + 0.5); float sd = A.w; float ax = A.x, ay = A.y;',
  // position figures (grains, dimples, terraces, blots) sit in the plane of the dominant axis, so coplanar triangles agree
  '  vec3 an = abs(Nflat); vec2 pq = an.z >= max(an.x, an.y) ? pm.xy : (an.x >= an.y ? pm.yz : pm.xz);',
  '  float lum = 1.0, d = vMetD, cover = 0.0; vec3 coverC = vec3(0.0); vec2 slope = vec2(0.0);',
  '  if (B.z > 0.0 && fig != 7) d += B.z * (metN(pq * 60.0 + sd, 1.0 / 60.0) * 2.0 - 1.0);',   // a seeded thickness spread
  '  if (fig == 1) lum = 1.0 + 0.12 * (metN(vec2(u * 40.0, v * 3200.0) + sd, 1.0 / 3200.0) - 0.5) + 0.05 * (metN(vec2(u * 12.0, v * 11000.0) + sd * 3.0, 1.0 / 11000.0) - 0.5);',
  '  else if (fig == 2) lum = 1.0 + 0.08 * (metN(vec2(u * 30.0, v * 1500.0) + sd, 1.0 / 1500.0) - 0.5);',
  '  else if (fig == 3) lum = 1.0 + 0.06 * metAa(1.0 / 5000.0) * (metHash(floor(pq * 5000.0) + sd) - 0.5);',
  '  else if (fig == 4) {',                                                            // hammer dimples: the last blow wins
  '    float cs = 0.006; vec2 p = pq; vec2 ip = floor(p / cs); float bo = -1.0;',
  '    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) for (int k = 0; k < 2; k++) { vec2 c = ip + vec2(float(i), float(j)); float fk = float(k);',
  '      vec2 q = (c + vec2(metHash(c + sd + 2.0 * fk), metHash(c + sd + 2.0 * fk + 1.0))) * cs; float R = cs * (0.55 + 0.35 * metHash(c + sd + 9.0 + fk)); float o = metHash(c + sd + 20.0 + fk);',
  '      vec2 dd = p - q; if (dot(dd, dd) < R * R && o > bo) { bo = o; slope = -4.0 * 0.00018 * dd / (R * R); } }',
  '    slope *= metAa(cs); }',
  '  else if (fig == 5) {',                                                            // spangle: a tilt per grain, six-fold arms
  '    float gs = 0.012; vec2 p = pq / gs; vec2 ip = floor(p); float best = 9.0; vec2 bq = vec2(0.0), bid = vec2(0.0);',
  '    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { vec2 c = ip + vec2(float(i), float(j)); vec2 q = c + vec2(metHash(c + sd), metHash(c + sd + 17.0)); float dd = dot(p - q, p - q); if (dd < best) { best = dd; bq = q; bid = c; } }',
  '    float ta = metHash(bid + sd + 3.0) * 6.2832, tm = 0.015 + 0.05 * metHash(bid + sd + 5.0); slope = vec2(cos(ta), sin(ta)) * tm * metAa(gs);',
  '    vec2 r = (p - bq) * gs; float th = atan(r.y, r.x) - metHash(bid + sd + 9.0) * 1.0472; float a0 = floor(th / 1.0472 + 0.5) * 1.0472; float rr = length(r);',
  '    float off = rr * sin(th - a0), wd = 0.00012 + 0.02 * rr; lum = 0.96 + metAa(0.001) * (0.2 * exp(-(off * off) / (2.0 * wd * wd)) - 0.1); }',
  '  else if (fig == 6) {',                                                            // mill scale: rolled streaks, a few flakes of bright steel
  '    float streak = 0.85 + 0.3 * metN(vec2(u * 30.0, v * 700.0) + sd, 1.0 / 700.0);',
  '    float scale = metNoise(vec2(u * 60.0, v * 160.0) + sd * 4.0) < 0.9 ? 0.94 : 0.0; cover = mix(0.88, scale, metAa(1.0 / 160.0)); coverC = vec3(0.05, 0.056, 0.068) * streak; }',
  '  else if (fig == 7) {',                                                            // hopper terraces: nested squares, older inner steps thicker
  '    float cs = 0.02; vec2 p = pq / cs; vec2 ip = floor(p); vec2 f = p - ip - 0.5; float an = (metHash(ip + sd) - 0.5) * 0.5;',
  '    vec2 q = vec2(cos(an) * f.x - sin(an) * f.y, sin(an) * f.x + cos(an) * f.y); float m = max(abs(q.x), abs(q.y)) / 0.4; float dt = 26.0;',
  '    if (m < 1.0) { float k = floor((1.0 - m) / 0.12); dt = (d - B.z) + k * 24.0 + 60.0 * metHash(ip + sd + 4.0); lum = 1.0 - 0.25 * metAa(cs * 0.01) * step(0.9, fract((1.0 - m) / 0.12)); }',
  '    d = mix(d, dt, metAa(cs * 0.1)); }',
  '  vec3 Nf = normalize(N - slope.x * T - slope.y * Bt);',
  '  float dc = d; if (C.z > 0.5 && d > B.w) { float t = clamp((d - B.w) / (1.5 * B.w), 0.0, 1.0); t = t * t * (3.0 - 2.0 * t); if (t > cover) { cover = t; coverC = vec3(0.045, 0.045, 0.05); } dc = B.w; }',
  '  if (C.x > 0.0 || C.y > 0.0) {',                                                  // copper's age: brown, then green where water sits and runs
  '    float blot = metN(pq * 120.0 + sd * 7.0, 1.0 / 120.0); float wet = 0.65 * sqrt(max(Nf.z, 0.0)) + 0.35 * metN(vec2((pq.x + pq.y) * 300.0, pm.z * 25.0) + sd, 1.0 / 300.0);',
  '    float g = C.y > 0.0 ? smoothstep(1.0 - C.y - 0.08, 1.0 - C.y + 0.08, wet * 0.8 + 0.2 * blot) : 0.0; float c2 = max(C.x * 0.92, g);',
  '    if (c2 > cover) { cover = c2; coverC = mix(vec3(0.07, 0.035, 0.022), vec3(0.16, 0.36, 0.28) * (0.85 + 0.3 * blot), g); } }',
  '  vec3 acc = vec3(0.0); float rough = ax + ay; float wb = 0.25 * rough;',
  '  for (int i = 0; i < 8; i++) { float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 8.0) * 1.6;',
  '    vec3 h = rough < 0.03 ? Nf : normalize(Nf + ax * r * cos(a) * T + ay * r * sin(a) * Bt); vec3 R = reflect(-V, h); if (dot(R, Nf) < 0.0) R = reflect(R, Nf);',
  '    acc += metStudio(R, wb) * metLutAt(B, dc, max(dot(V, h), 0.0)); }',
  '  vec3 col = acc / 8.0 * lum;',
  '  vec3 H = normalize(uMetSun + V); float hn = dot(H, Nf), nl = dot(Nf, uMetSun), nv = max(dot(Nf, V), 1e-3);',   // the sun: an analytic anisotropic lobe
  '  if (hn > 0.0 && nl > 0.0) { float sx = dot(H, T) / hn, sy = dot(H, Bt) / hn; float a2 = max(ax, 0.01), b2 = max(ay, 0.01), vh = max(dot(V, H), 1e-3);',
  '    float D = exp(-0.5 * (sx * sx / (a2 * a2) + sy * sy / (b2 * b2))) / (6.2832 * a2 * b2 * hn * hn * hn * hn);',
  '    col += metLutAt(B, dc, vh) * lum * uMetSunE * 30.0 * D / (4.0 * nv) * min(1.0, 2.0 * hn * min(nv, nl) / vh) * 0.006; }',
  '  if (cover > 0.0) { vec3 E = mix(uMetGnd, mix(uMetHor, uMetZen, 0.5), 0.5 + 0.5 * Nf.z) + vec3(uMetSunE * max(dot(Nf, uMetSun), 0.0) / 3.14159) * 1.5; col = mix(col, coverC * E * 2.2, cover); }',
  '  vec3 x = col * 1.1; gl_FragColor.rgb = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);',
  '}',
  '#include <tonemapping_fragment>',
].join('\\n');

export function metalChannelScript({ toLight, inputs }) {
  const S = inputs.surfaces.length;
  return `
// --- metal channel (metal surfaces): live metal response on metal faces ---
const MET = ${safeJson({ sun: toLight.map((v) => +v.toFixed(6)), ...inputs })};
const __metLutTex = (() => { const b = atob(MET.lut.b64); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  const t = new THREE.DataTexture(u, 16, MET.lut.h, THREE.RGBAFormat); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
const __metUni = { uMetSun: { value: new THREE.Vector3(...MET.sun) }, uMetZen: { value: new THREE.Vector3(...MET.zen) }, uMetHor: { value: new THREE.Vector3(...MET.hor) },
  uMetGnd: { value: new THREE.Vector3(...MET.gnd) }, uMetBox: { value: new THREE.Vector3(...MET.box).normalize() }, uMetSunE: { value: MET.sunE },
  uMetLut: { value: __metLutTex }, uMetLutH: { value: MET.lut.h }, uMetUnit: { value: MET.unit },
  uMetA: { value: MET.surfaces.map((s) => new THREE.Vector4(...s.A)) }, uMetB: { value: MET.surfaces.map((s) => new THREE.Vector4(...s.B)) }, uMetC: { value: MET.surfaces.map((s) => new THREE.Vector4(...s.C)) } };
const __metPatch = (m, grp) => {
  const map = grp.metal.surfaces.map((k) => MET.index[k]); const buf = decodeF32(grp.metal.a);
  for (let i = 3; i < buf.length; i += 8) if (buf[i] > -0.5) buf[i] = map[Math.round(buf[i])];
  const ib = new THREE.InterleavedBuffer(buf, 8);
  m.geometry.setAttribute('aMetT', new THREE.InterleavedBufferAttribute(ib, 4, 0)); m.geometry.setAttribute('aMetD', new THREE.InterleavedBufferAttribute(ib, 1, 4)); m.geometry.setAttribute('aMetN', new THREE.InterleavedBufferAttribute(ib, 3, 5));
  const prev = m.material.onBeforeCompile;
  m.material.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m.material, sh, r); Object.assign(sh.uniforms, __metUni);
    sh.vertexShader = 'attribute vec4 aMetT;\\nattribute float aMetD;\\nattribute vec3 aMetN;\\nvarying vec4 vMetT;\\nvarying float vMetD;\\nvarying vec3 vMetWp;\\nvarying vec3 vMetN;\\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\\nvMetWp = (modelMatrix * vec4(transformed, 1.0)).xyz; vMetT = vec4(normalize(mat3(modelMatrix) * aMetT.xyz), aMetT.w); vMetD = aMetD; vMetN = mat3(modelMatrix) * aMetN;');
    sh.fragmentShader = '${FRAG_FNS}\\nuniform vec4 uMetA[${S}]; uniform vec4 uMetB[${S}]; uniform vec4 uMetC[${S}];\\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', '${FRAG_MAIN}');
  };
  m.material.customProgramCacheKey = () => 'metal' + (prev ? String(prev) : '');
  m.material.needsUpdate = true;
};
for (const grp of GROUPS) { if (grp.metal && meshes[grp.name]) __metPatch(meshes[grp.name], grp); }
const __mojMetal = { surfaces: MET.surfaces.length, lutRows: MET.lut.h };`;
}
