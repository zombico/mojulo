// In-page script (part of the terrain channel, channels/terrain-lod.js): THE FLIGHT SKY, an airspace map's weather as a
// pilot sees it (skyscape/sky.js). Opt-in: the terrain channel carries `sky` only for an airspace map; absent, not one
// byte of this is emitted.
//
//   the sky      a sphere round the eye shaded as air: the horizon's colour (the haze's) up to the zenith's, the glow
//                round the sun and its disc (lost under an overcast)
//   cumulus      each cloud a cluster of puffs (camera-facing quads, one instanced draw), heaped over a FLAT base (a
//                puff is cut where it would hang under the cloud's base), each puff lit by the sun through the cloud
//                (its side toward the sun and the cloud's top bright, its belly the sky's shade), its edge torn by
//                noise and silvered when the sun stands behind it; drawn far to near (re-sorted as the eye moves);
//                faded as the eye comes into it. The clouds drift with the wind and wrap round the eye, so a pilot is
//                always under a sky
//   decks        a sheet between a base and a top (stratus, stratocumulus, altocumulus): from below its belly, dark
//                where thick; from above its top, lit by the sun, a floor of cloud; its cover the share it closes
//   cirrus       a thin high veil of streaks along the wind
//   whiteout     an eye inside a cloud or a deck sees the cloud's grey all round (the page's fog thickened and turned
//                to it), clearing as it flies out
//   shadows      the cumulus' shadows on the ground, cast along the sun and drifting with them (a footprint map the
//                ground's shader reads, window.__mojSkyPatch)
//
// The clock is window.__mojClock when a capture pins it, so a frame is reproducible. `window.__mojSky` → { puffs,
// decks, inside } what is drawn.

const NOISE_GLSL = `
float skH(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float skN(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(skH(i), skH(i + vec2(1, 0)), u.x), mix(skH(i + vec2(0, 1)), skH(i + vec2(1, 1)), u.x), u.y); }
float skF(vec2 p) { float s = 0.0, a = 0.5; mat2 R = mat2(0.8, 0.6, -0.6, 0.8); for (int i = 0; i < 5; i++) { s += a * skN(p); p = R * p * 2.03 + 7.1; a *= 0.5; } return s / 0.97; }`;

const SKY_VERT = `
varying vec3 vSkD;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vSkD = wp.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
const SKY_FRAG = `
uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uClear;
uniform vec3 uZenA; uniform vec3 uHorA; uniform vec3 uSunA; uniform float uAbove;
varying vec3 vSkD;
#include <common>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vSkD); float h = d.z, mu = max(dot(d, normalize(uSun)), 0.0);
  // (over a deck the sky is the hour's clear one, whatever the weather under it)
  vec3 zen = mix(uZen, uZenA, uAbove), hor = mix(uHor, uHorA, uAbove), sc = mix(uSunCol, uSunA, uAbove); float clr = max(uClear, uAbove);
  vec3 c = h > 0.0 ? mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.45)) : hor;
  // the air brightest just over the horizon (never at it: there it is the haze's own colour), and round the sun
  c += hor * 0.16 * exp(-h * 14.0) * smoothstep(0.0, 0.03, h);
  c += sc * (0.10 * pow(mu, 6.0) + 0.35 * pow(mu, 120.0)) * mix(0.45, 1.0, clr) * smoothstep(-0.02, 0.02, h);
  c += sc * 5.0 * smoothstep(0.99994, 0.99997, mu) * clr;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PUFF_VERT = `
attribute vec4 iPos; attribute vec4 iInfo;
uniform vec2 uDrift; uniform float uHalf;
varying vec2 vUv; varying vec4 vInfo; varying vec3 vWP; varying float vFade; varying float vR; varying vec3 vC;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() {
  // drifted with the wind, wrapped round the eye
  vec2 xy = iPos.xy + uDrift; xy = mod(xy - cameraPosition.xy + uHalf, 2.0 * uHalf) - uHalf + cameraPosition.xy;
  vec3 c = vec3(xy, iPos.z); float r = iPos.w;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = c + (right * position.x + up * position.y) * r;
  vUv = position.xy; vInfo = iInfo; vWP = wp; vR = r; vC = c;
  float d = distance(cameraPosition, c); vFade = smoothstep(r * 0.4, r * 1.6, d);
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`;
const PUFF_FRAG = `
uniform vec3 uSun; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uSunCol; uniform float uClear; uniform vec3 uLitA; uniform float uDeckTop;
varying vec2 vUv; varying vec4 vInfo; varying vec3 vWP; varying float vFade; varying float vR; varying vec3 vC;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  float r2 = dot(vUv, vUv); if (r2 > 1.0) discard;
  // a flat base: nothing of a puff hangs under its cloud's
  if (vWP.z < vInfo.z) discard;
  float base = smoothstep(0.0, vR * 0.12, vWP.z - vInfo.z);
  // its body: a ball, its rim torn by noise in the puff's own frame
  float n = skF(vUv * 2.4 + vInfo.x * 13.1), dens = (1.0 - r2) * (0.4 + 1.1 * n);
  float a = smoothstep(0.16, 0.46, dens) * vFade;
  if (a < 0.01) discard;
  // its light: the ball's normal toward the sun, the puff's place in its cloud (vInfo.y), the top brighter than the belly
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), fw = normalize(cameraPosition - vC);
  vec3 N = normalize(right * vUv.x + up * vUv.y + fw * sqrt(max(0.0, 1.0 - r2)));
  vec3 L = normalize(uSun);
  float sunlit = clamp(0.5 + 0.6 * dot(N, L), 0.0, 1.0) * vInfo.y;
  float height = smoothstep(vInfo.z, vInfo.w, vWP.z);
  float light = clamp(mix(0.12, 1.0, pow(height, 0.7)) * (0.3 + 0.85 * sunlit) * (0.8 + 0.4 * n), 0.0, 1.2);
  // (a thunderhead's crown, risen over the shelf under it, stands in the sun the shelf hides from its base)
  vec3 litC = mix(uLit, uLitA, smoothstep(uDeckTop, uDeckTop + 900.0, vWP.z));
  vec3 c = mix(uShade, litC, light);
  c *= mix(0.78, 1.0, base);
  // backlit: a cloud between the eye and the sun glows through, its outer puffs most (a whole puff, never a rim)
  vec3 V = normalize(vWP - cameraPosition);
  c += uSunCol * pow(max(dot(V, L), 0.0), 8.0) * (0.25 + 0.45 * (1.0 - vInfo.y)) * uClear;
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // (the haze lies low: a cloud stands over most of it, so it is veiled at about half the ground's thickness)
  #ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1.0 - exp(-fogDensity * fogDensity * 0.3 * vFogDepth * vFogDepth));
  #endif
}`;

const SHAFT_VERT = `
attribute vec4 iShaft;
uniform vec2 uDrift; uniform float uHalf;
varying vec2 vUv; varying float vSeed;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() {
  vec2 xy = iShaft.xy + uDrift; xy = mod(xy - cameraPosition.xy + uHalf, 2.0 * uHalf) - uHalf + cameraPosition.xy;
  vec2 to = normalize(cameraPosition.xy - xy + 1e-3), side = vec2(-to.y, to.x);
  vec3 wp = vec3(xy + side * position.x * iShaft.w, position.y * iShaft.z);
  vUv = vec2(position.x, position.y); vSeed = iShaft.x * 0.013;
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`;
const SHAFT_FRAG = `
uniform vec3 uShade; uniform float uTime;
varying vec2 vUv; varying float vSeed;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  float across = 1.0 - smoothstep(0.35, 1.0, abs(vUv.x + 0.25 * (skN(vec2(vUv.y * 3.0, vSeed)) - 0.5)));
  float streak = 0.55 + 0.45 * skF(vec2(vUv.x * 9.0 + vSeed, vUv.y * 0.8 + uTime * 0.25));
  float a = across * streak * smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y)) * 0.55;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uShade * 0.8, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const DECK_VERT = `
varying vec3 vWP;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`;
const DECK_FRAG = `
uniform vec3 uSun; uniform vec3 uLit; uniform vec3 uLitA; uniform float uAbove; uniform vec3 uShade; uniform vec2 uDrift; uniform float uCover; uniform float uScale; uniform float uForm; uniform float uTop; uniform float uEdge; uniform vec2 uWind;
varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
${NOISE_GLSL}
float deckCover(vec2 P) {
  vec2 q = (P - uDrift) / uScale;
  if (uForm > 2.5) { vec2 w = normalize(uWind); q = vec2(dot(q, w) * 0.15, dot(q, vec2(-w.y, w.x)) * 1.2); return smoothstep(0.45, 0.85, skF(q)) * 0.55; }   // cirrus
  float n = skF(q);
  if (uForm > 1.5) n = 0.55 * n + 0.45 * skF(q * 6.0 + 3.3);       // altocumulus: ripples of small cells
  else if (uForm > 0.5) n = 0.7 * n + 0.3 * skF(q * 2.6 + 9.1);    // stratocumulus: lumpy rolls
  float t = 1.0 - uCover;
  return uCover >= 0.999 ? 1.0 : smoothstep(t - 0.08, t + 0.08, n);
}
void main() {
  #include <logdepthbuf_fragment>
  float a = deckCover(vWP.xy);
  a *= 1.0 - smoothstep(uEdge * 0.75, uEdge, length(vWP.xy - cameraPosition.xy));
  if (a < 0.01) discard;
  float n = skF((vWP.xy - uDrift) / (uScale * 0.6) + 4.2);
  bool below = cameraPosition.z < vWP.z;
  vec3 c;
  if (uForm > 2.5) c = uLit;
  else if (below) c = mix(uShade * 0.8, uShade * 1.15, n) * mix(1.0, 0.75, a);            // its belly, darker where thick
  else { vec2 g = vec2(skF((vWP.xy - uDrift) / (uScale * 0.6) + vec2(4.25, 4.2)) - n, skF((vWP.xy - uDrift) / (uScale * 0.6) + vec2(4.2, 4.25)) - n);
    float lit = clamp(0.8 + 9.0 * dot(-g, normalize(uSun.xy)) * (1.0 - uSun.z * 0.5), 0.55, 1.2); c = mix(uLit, uLitA, uAbove) * lit * (0.88 + 0.18 * n); }  // its top, lumps lit by the sun over it
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** The ground's patch (the terrain material's onBeforeCompile, chained after the aerial ground's): the cumulus'
 *  shadows, cast along the sun from the cloud base. */
const SHADOW_PATCH = `
window.__mojSkyPatch = function (sh) {
  const S = window.__mojSky; if (!S || !S.shadow) return;
  Object.assign(sh.uniforms, S.shadow.uniforms);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nvarying vec3 vSkWP;').replace('#include <project_vertex>', '#include <project_vertex>\\nvSkWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\\nuniform sampler2D uSkShadow; uniform vec3 uSkSun; uniform vec2 uSkDrift; uniform float uSkHalf; uniform float uSkBase; uniform float uSkK; varying vec3 vSkWP;')
    .replace('#include <opaque_fragment>', 'vec2 skP = vSkWP.xy + uSkSun.xy / max(uSkSun.z, 0.05) * max(0.0, uSkBase - vSkWP.z) - uSkDrift;\\nfloat skS = texture2D(uSkShadow, skP / (2.0 * uSkHalf) + 0.5).r;\\noutgoingLight *= 1.0 - uSkK * skS;\\n#include <opaque_fragment>');
};`;

/** The flight sky's page source, in the terrain channel's scope (THREE, scene, camera, TERRAIN, __tMat, __tLin).
 *  `cfg` is TERRAIN.sky; `ownsGround`: no aerial ground on the page, so the sky patches the terrain's material itself. */
export function flightSkyScript(cfg, { ownsGround = true } = {}) {
  return `
// --- the flight sky (an airspace's weather): its air, its clouds, their shadows ---
${SHADOW_PATCH}
(function () {
  const K = TERRAIN.sky, dec = (b, T) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
  const col = (h) => new THREE.Color(h);   // (sRGB hex → linear, three's colour management)
  const lin3 = (c) => new THREE.Vector3(__tLin(c[0]), __tLin(c[1]), __tLin(c[2]));
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  const sun = new THREE.Vector3(...K.sun).normalize(), sunCol = col(K.sunCol), lit = col(K.cloudLit), shade = col(K.cloudShade), clear = K.clear;
  const out = window.__mojSky = { puffs: 0, decks: 0, inside: 0 };
  const drift = new THREE.Vector2();
  // THE SKY: a sphere round the eye, drawn first and behind everything
  const skyMat = new THREE.ShaderMaterial({ vertexShader: ${JSON.stringify(SKY_VERT)}, fragmentShader: ${JSON.stringify(SKY_FRAG)}, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uZen: { value: lin3(K.zenith) }, uHor: { value: lin3(K.horizon) }, uSun: { value: sun }, uSunCol: { value: new THREE.Vector3(sunCol.r, sunCol.g, sunCol.b) }, uClear: { value: clear },
      uZenA: { value: lin3(K.aloft.zenith) }, uHorA: { value: lin3(K.aloft.horizon) }, uSunA: { value: ((c) => new THREE.Vector3(c.r, c.g, c.b))(col(K.aloft.sun)) }, uAbove: { value: 0 } } });
  const skyBall = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMat);
  skyBall.renderOrder = -1; skyBall.frustumCulled = false; skyBall.raycast = () => {};
  // (the weather's state is brought up to the eye at every render, the sky being drawn first: a captured frame, rendered
  // once, sees what a flown one does)
  skyBall.onBeforeRender = (r, sc, cam) => { skyBall.position.copy(cam.position); skyBall.updateMatrixWorld(); update(cam); };
  scene.add(skyBall);
  // THE CUMULUS: each cloud's puffs, laid by its own dice
  const C = K.clouds.n ? dec(K.clouds.data, Float32Array) : new Float32Array(0), half = K.domain;
  const mul = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const P = [], I = [];
  for (let k = 0; k < K.clouds.n; k++) {
    const x = C[k * 6], y = C[k * 6 + 1], base = C[k * 6 + 2], rad = C[k * 6 + 3], hgt = C[k * 6 + 4], R = mul(C[k * 6 + 5]);
    const tower = hgt > 1.5 * rad, n = Math.max(10, Math.min(70, Math.round(8 + rad / 45 + hgt / (tower ? 140 : 70)))), top = base + hgt;
    for (let i = 0; i < n; i++) {
      // up the cloud: the lower puffs wide and many, the crown narrowing (a tower's anvil spreading at its top, downwind)
      const t = i < n * 0.4 ? R() * 0.25 : Math.min(1, 0.2 + R() * 0.85 * (i / n) + 0.15), spread = tower ? (t > 0.85 ? 1.3 : 0.45) : 1 - 0.7 * t;
      const ang = R() * 6.2832, rr = Math.sqrt(R()) * rad * 0.7 * spread, pr = rad * (tower ? (t > 0.85 ? 0.34 : 0.24) : 0.36 - 0.17 * t) * (0.7 + 0.6 * R());
      const ax = tower && t > 0.85 ? K.wind[0] * rad * 0.6 : 0, ay = tower && t > 0.85 ? K.wind[1] * rad * 0.6 : 0;
      const px = x + Math.cos(ang) * rr + ax, py = y + Math.sin(ang) * rr + ay, pz = base + pr * 0.55 + t * Math.max(0, hgt - pr);
      // its light inside its cloud: the side toward the sun bright, the far side and the deep middle shaded
      const ox = (px - x) / rad, oy = (py - y) / rad, oz = (pz - (base + hgt / 2)) / Math.max(hgt, 1), toward = ox * sun.x + oy * sun.y + oz * sun.z;
      P.push(px, py, pz, pr); I.push(R(), Math.min(1, Math.max(0.35, 0.68 + 0.45 * toward)), base, top);
    }
  }
  const NP = P.length / 4; out.puffs = NP;
  // (the top of the highest closed-ish deck: a cloud's crown over it is sunlit)
  const deckTop = Math.max(-1e5, ...K.layers.filter((L) => L.type === 'deck' && L.cover >= 0.5).map((L) => L.base + L.depth));
  let puffMesh = null;
  if (NP) {
    const geo = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(2, 2);
    geo.index = q.index; geo.setAttribute('position', q.attributes.position);
    const aP = new Float32Array(NP * 4), aI = new Float32Array(NP * 4);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(aP, 4)); geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(aI, 4)); geo.instanceCount = NP;
    const mat = new THREE.ShaderMaterial({ vertexShader: ${JSON.stringify(PUFF_VERT)}, fragmentShader: ${JSON.stringify(PUFF_FRAG)}, transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: sun }, uLit: { value: lit }, uShade: { value: shade }, uSunCol: { value: sunCol }, uClear: { value: clear }, uDrift: { value: drift }, uHalf: { value: half }, uLitA: { value: col(K.aloft.cloudLit) }, uDeckTop: { value: deckTop } }]) });
    mat.uniforms.uDrift.value = drift;
    puffMesh = new THREE.Mesh(geo, mat); puffMesh.frustumCulled = false; puffMesh.renderOrder = 3; puffMesh.raycast = () => {}; scene.add(puffMesh);
    // far to near: the puffs re-sorted as the eye moves (their wrapped places, drifted)
    const order = new Uint32Array(NP), dist = new Float32Array(NP);
    let last = null;
    const sort = () => {
      const c = camera.position, w = 2 * half;
      for (let k = 0; k < NP; k++) {
        let x = P[k * 4] + drift.x, y = P[k * 4 + 1] + drift.y; x = ((x - c.x + half) % w + w) % w - half; y = ((y - c.y + half) % w + w) % w - half;
        const z = P[k * 4 + 2] - c.z; dist[k] = x * x + y * y + z * z; order[k] = k;
      }
      order.sort((a, b) => dist[b] - dist[a]);
      for (let j = 0; j < NP; j++) { const k = order[j]; aP.set([P[k * 4], P[k * 4 + 1], P[k * 4 + 2], P[k * 4 + 3]], j * 4); aI.set([I[k * 4], I[k * 4 + 1], I[k * 4 + 2], I[k * 4 + 3]], j * 4); }
      geo.attributes.iPos.needsUpdate = true; geo.attributes.iInfo.needsUpdate = true;
    };
    puffMesh.onBeforeRender = () => { const c = camera.position, d = camera.getWorldDirection(new THREE.Vector3()); const key = [c.x, c.y, c.z, d.x, d.y, d.z];
      if (!last || Math.hypot(key[0] - last[0], key[1] - last[1], key[2] - last[2]) > 25 || Math.abs(key[3] - last[3]) + Math.abs(key[4] - last[4]) > 0.2 || (last.t !== undefined && clock() - last.t > 1)) { sort(); last = key; last.t = clock(); } };
    sort();
  }
  // RAIN SHAFTS: under each thunderhead, a curtain of rain from its base to the sea, turned to the eye about its axis
  const towers = []; for (let k = 0; k < K.clouds.n; k++) if (C[k * 6 + 4] > 1500) towers.push(k);
  if (towers.length) {
    const geo = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(2, 1); q.translate(0, 0.5, 0);
    geo.index = q.index; geo.setAttribute('position', q.attributes.position);
    const aS = new Float32Array(towers.length * 4); towers.forEach((k, i) => aS.set([C[k * 6], C[k * 6 + 1], C[k * 6 + 2], C[k * 6 + 3] * 0.8], i * 4));
    geo.setAttribute('iShaft', new THREE.InstancedBufferAttribute(aS, 4)); geo.instanceCount = towers.length;
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
      vertexShader: ${JSON.stringify(SHAFT_VERT)}, fragmentShader: ${JSON.stringify(SHAFT_FRAG)},
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uDrift: { value: drift }, uHalf: { value: half }, uShade: { value: shade }, uTime: { value: 0 } }]) });
    mat.uniforms.uDrift.value = drift;
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 2; m.raycast = () => {};
    m.onBeforeRender = () => { mat.uniforms.uTime.value = clock(); };
    scene.add(m); out.shafts = towers.length;
  }
  // THE DECKS: a sheet at the base (and one at the top) round the eye, out to the haze
  const decks = [], EDGE = 60000;
  for (const L of K.layers) {
    if (L.type === 'cumulus') continue;
    const form = L.type === 'cirrus' ? 3 : L.form === 'altocumulus' ? 2 : L.form === 'stratocumulus' ? 1 : 0, scale = form === 3 ? 2600 : form === 2 ? 1400 : form === 1 ? 900 : 2200;
    for (const z of form === 3 || !L.depth ? [L.base] : [L.base, L.base + L.depth]) {
      const m = new THREE.ShaderMaterial({ vertexShader: ${JSON.stringify(DECK_VERT)}, fragmentShader: ${JSON.stringify(DECK_FRAG)}, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: sun }, uLit: { value: lit }, uLitA: { value: col(K.aloft.cloudLit) }, uAbove: { value: 0 }, uShade: { value: shade }, uDrift: { value: drift }, uCover: { value: L.cover }, uScale: { value: scale }, uForm: { value: form }, uTop: { value: z > L.base ? 1 : 0 }, uEdge: { value: EDGE }, uWind: { value: new THREE.Vector2(K.wind[0], K.wind[1]) } }]) });
      m.uniforms.uDrift.value = drift;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * EDGE, 2 * EDGE), m); mesh.position.z = z; mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.raycast = () => {};
      mesh.onBeforeRender = (r, sc, cam) => { mesh.position.x = cam.position.x; mesh.position.y = cam.position.y; mesh.updateMatrixWorld(); };
      scene.add(mesh); decks.push({ L, form, scale, mat: m });
    }
  }
  out.decks = decks.length;
  // THE SHADOWS: the cumulus' footprints on a map over the domain (it repeats as they wrap), the ground's patch reads it
  if (NP && K.shadow) {
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    for (let k = 0; k < K.clouds.n; k++) {
      const x = C[k * 6], y = C[k * 6 + 1], rad = C[k * 6 + 3];
      for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
        const u = ((x / (2 * half)) + 0.5 + ox) * N, v = (0.5 - (y / (2 * half)) + oy) * N, rr = (rad * 0.85 / (2 * half)) * N;
        if (u < -rr || v < -rr || u > N + rr || v > N + rr) continue;
        const gr = g.createRadialGradient(u, v, rr * 0.15, u, v, rr); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(u, v, rr, 0, 6.2832); g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.NoColorSpace;
    const base = Math.min(...K.layers.filter((L) => L.type === 'cumulus').map((L) => L.base));
    out.shadow = { uniforms: { uSkShadow: { value: tex }, uSkSun: { value: sun }, uSkDrift: { value: drift }, uSkHalf: { value: half }, uSkBase: { value: base }, uSkK: { value: 0.42 * clear } } };
  }${ownsGround ? `
  if (out.shadow) { __tMat.onBeforeCompile = (sh) => window.__mojSkyPatch(sh); __tMat.needsUpdate = true; }` : ''}
  // WHITEOUT: the eye inside a cloud sees its grey all round; the fog thickened toward it, eased in and out
  const fogBase = scene.fog ? scene.fog.color.clone() : null, cloudFog = shade.clone().lerp(lit, 0.55), aloftHor = new THREE.Color().setRGB(__tLin(K.aloft.horizon[0]), __tLin(K.aloft.horizon[1]), __tLin(K.aloft.horizon[2]));
  const H = (x, y) => { let a = Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453); return a - Math.floor(a); };
  const VN = (x, y) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, h = y - j, u = f * f * (3 - 2 * f), v = h * h * (3 - 2 * h); return (H(i, j) * (1 - u) + H(i + 1, j) * u) * (1 - v) + (H(i, j + 1) * (1 - u) + H(i + 1, j + 1) * u) * v; };
  let inside = 0, lastT = null, fogSet = null, fogFrom = scene.fog ? scene.fog.density : 0;
  function update(cam) {
    const t = clock(); drift.set(K.wind[0] * K.windSpeed * t, K.wind[1] * K.windSpeed * t);
    const c = cam.position; let want = 0;
    for (const D of decks) { if (D.form === 3) continue; const L = D.L; if (c.z > L.base && c.z < L.base + L.depth) { const n = 0.6 * VN((c.x - drift.x) / D.scale, (c.y - drift.y) / D.scale) + 0.4 * VN((c.x - drift.x) / D.scale * 2.03 + 7.1, (c.y - drift.y) / D.scale * 2.03); want = Math.max(want, L.cover >= 0.999 ? 1 : Math.max(0, Math.min(1, (n - (1 - L.cover) + 0.1) / 0.2))); } }
    for (let k = 0; k < K.clouds.n && want < 1; k++) {
      const w = 2 * half; let x = C[k * 6] + drift.x - c.x, y = C[k * 6 + 1] + drift.y - c.y; x = ((x + half) % w + w) % w - half; y = ((y + half) % w + w) % w - half;
      const rad = C[k * 6 + 3], b = C[k * 6 + 2], top = b + C[k * 6 + 4] * 0.85, d = Math.hypot(x, y) / (rad * 0.7);
      if (d < 1 && c.z > b && c.z < top) want = Math.max(want, Math.min(1, (1 - d) * 3) * Math.min(1, (c.z - b) / 40, (top - c.z) / 60));
    }
    // (eased over about a fifth of a second; a capture's first frame at a pose takes it whole)
    inside = lastT === null || Math.abs(t - lastT) > 1 ? want : inside + (want - inside) * Math.min(1, (t - lastT) * 5); lastT = t; out.inside = inside;
    // ON TOP: over a closed deck the sky clears to the hour's, the deck's top is sunlit, the air over it thin
    let above = 0;
    for (const D of decks) if (D.form < 3 && D.L.cover >= 0.85) above = Math.max(above, Math.min(1, Math.max(0, (c.z - D.L.base - D.L.depth) / 150)));
    out.above = above; skyMat.uniforms.uAbove.value = above; for (const D of decks) D.mat.uniforms.uAbove.value = above;
    if (scene.fog && fogBase && scene.fog.isFogExp2) {
      scene.fog.color.copy(fogBase).lerp(aloftHor, above).lerp(cloudFog, Math.min(1, inside * 1.2));
      if (scene.fog.density !== fogSet) fogFrom = scene.fog.density;   // (the terrain's own, as it last set it)
      scene.fog.density = fogSet = Math.max(fogFrom * (1 - 0.6 * above), 0.012 * inside);
      if (scene.background && scene.background.isColor) scene.background.copy(scene.fog.color);
    }
  }
})();
`;
}
