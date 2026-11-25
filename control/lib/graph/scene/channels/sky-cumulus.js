// In-page script (part of the form channel's sky, channels/form-sky.js): A GROUND WORLD'S CUMULUS, the flight sky's own
// clouds (skyscape/sky.js groundCumulus, laid by cumulus-puffs.js) over a walker's world. Opt-in: the land's `cumulus`
// (its weather clear, fair or haze); absent, not one byte of this is emitted.
//
//   SKY SPACE   cumulus stand kilometres off and a ground world's camera sees a few: each puff is drawn scaled toward the
//               eye (its place and its size divided alike, so its angle and its size on the screen are true), inside the
//               sky's dome, drawn after the dome and before the land, so the land, its buildings and its trees always
//               stand in front of the sky's clouds. The clouds wrap round the eye as it walks, drift with the wind
//   THE LOOK    the flight sky's: a fair cloud a dome over a flat base, lit as one body by the sun and its height, soft at
//               its rims; far off it fades into the horizon's air, gone at its square's edge
//
// `window.__formSky.cumulus` → its puffs' count.

const SKYC_VERT = `
attribute vec4 iPos; attribute vec4 iInfo;
uniform float uK; uniform vec2 uDrift; uniform float uHalf;
varying vec2 vUv; varying vec4 vInfo; varying float vZ; varying float vD; varying vec3 vRel;
void main() {
  // (wrapped round the eye, drifted with the wind; in metres from the eye)
  vec2 xy = iPos.xy + uDrift; xy = mod(xy - cameraPosition.xy + uHalf, 2.0 * uHalf) - uHalf + cameraPosition.xy;
  vec3 rel = vec3(xy, iPos.z) - cameraPosition; vD = length(rel.xy); vRel = rel;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float sq = iInfo.x < 0.0 ? 1.0 : 0.95;
  vec3 off = (right * position.x + up * position.y * sq) * iPos.w;
  vZ = iPos.z + off.z; vUv = position.xy; vInfo = iInfo;
  // (in sky space: the place and the size scaled toward the eye alike)
  gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + (rel + off) / uK, 1.0);
}`;
const SKYC_FRAG = `
uniform vec3 uSun; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uHaze; uniform float uHalf;
varying vec2 vUv; varying vec4 vInfo; varying float vZ; varying float vD; varying vec3 vRel;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y); }
float fb(vec2 p) { return 0.55 * vn(p) + 0.3 * vn(p * 2.03 + 17.0) + 0.15 * vn(p * 4.1 + 41.0); }
void main() {
  float r2 = dot(vUv, vUv); if (r2 > 1.0) discard;
  if (vZ < vInfo.z) discard;
  float foot = vInfo.x < 0.0 ? 1.0 : smoothstep(0.0, 45.0, vZ - vInfo.z), base = smoothstep(0.0, 70.0, vZ - vInfo.z);
  float n = fb(vUv * 2.4 + abs(vInfo.x) * 13.1), dens = (1.0 - r2) * (0.4 + 1.1 * n);
  float a = smoothstep(0.1, 0.55, dens) * foot * (1.0 - smoothstep(uHalf * 0.7, uHalf * 0.95, vD));
  if (a < 0.01) discard;
  // (lit as the flight sky's are: its normal a ball's leaning up, its share of the sun, bright up its tops, shaded under)
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]), fw = normalize(-vRel);
  vec3 N = normalize(mix(normalize(right * vUv.x + up * vUv.y + fw * sqrt(max(0.0, 1.0 - r2))), vec3(0.0, 0.0, 1.0), 0.4));
  float sunlit = clamp(0.5 + 0.6 * dot(N, uSun), 0.0, 1.0) * vInfo.y, height = smoothstep(vInfo.z, vInfo.w, vZ);
  float light = clamp(mix(0.2, 1.0, pow(height, 0.7)) * (0.35 + 0.8 * sunlit) * (0.85 + 0.3 * n), 0.0, 1.2);
  vec3 c = mix(uShade, uLit, light) * mix(0.78, 1.0, base);
  // (far off, the horizon's air over it)
  c = mix(c, uHaze, smoothstep(2500.0, uHalf * 0.8, length(vRel)) * 0.85);
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** The block, in the form sky's scope (THREE, scene, D, sun, sunL, amb, haze, FSK): the land's cumulus drawn in sky space. */
export function skyCumulusScript({ puffs }) {
  return `
    // --- a ground world's cumulus (channels/sky-cumulus.js): the flight sky's clouds over a walker, in sky space ---
    if (D.cumulus && D.cumulus.n) {
      const CU = D.cumulus, CD = new Float32Array(CU.data), half = CU.half;
      const { P, I } = (${puffs})(CD, CU.n, CU.wind, sun);
      const NP = P.length / 4, geo = new THREE.InstancedBufferGeometry(), q = new THREE.PlaneGeometry(2, 2);
      geo.index = q.index; geo.setAttribute('position', q.attributes.position);
      const aP = new Float32Array(P), aI = new Float32Array(I);
      geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(aP, 4)); geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(aI, 4)); geo.instanceCount = NP;
      const sz = Math.max(0.05, sun.z), V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
      // (white in the sun, the sky's light under it: a cloud is the brightest thing in a fair sky)
      const lit = V3([0, 1, 2].map((c) => 0.9 * (sunL[c] * sz * 1.35 + amb[c] * 1.4))), shade = V3([0, 1, 2].map((c) => 0.9 * amb[c] * 0.95));
      const CU_U = { uSun: { value: sun }, uLit: { value: lit }, uShade: { value: shade }, uHaze: { value: V3(haze) }, uHalf: { value: half }, uK: { value: 10 }, uDrift: { value: new THREE.Vector2() } };
      const cmat = new THREE.ShaderMaterial({ uniforms: CU_U, vertexShader: ${JSON.stringify(SKYC_VERT)}, fragmentShader: ${JSON.stringify(SKYC_FRAG)},
        transparent: false, depthTest: false, depthWrite: false, fog: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        // (the canvas kept opaque: its alpha blended as the colour is would leave a rim see-through to the page behind it)
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
      const cmesh = new THREE.Mesh(geo, cmat); cmesh.renderOrder = -1.8; cmesh.frustumCulled = false; cmesh.raycast = () => {}; scene.add(cmesh);
      // (far to near, re-sorted as the eye moves: their wrapped places)
      const ord = new Uint32Array(NP), dist = new Float32Array(NP), sP = new Float32Array(NP * 4), sI = new Float32Array(NP * 4);
      let sortedAt = null;
      const t0 = performance.now(), wrap = (v, e) => (((v - e + half) % (2 * half)) + 2 * half) % (2 * half) - half;
      cmesh.onBeforeRender = (r, s, cam) => {
        const e = cam.position, far = Math.sqrt(2) * half * 0.95 + 3000, domeR = Math.min(FSK.radius, (cam.far || 8000) * 0.9);
        CU_U.uK.value = far / (0.8 * domeR);
        // (a capture's own clock when it pins one, so a still is the same however long it took to draw)
        const tt = window.__mojClock != null ? window.__mojClock / 1000 : (performance.now() - t0) / 1000; CU_U.uDrift.value.set(CU.wind[0] * FSK.clouds.drift * tt, CU.wind[1] * FSK.clouds.drift * tt);
        if (sortedAt && Math.hypot(e.x - sortedAt[0], e.y - sortedAt[1]) < 150) return;
        sortedAt = [e.x, e.y];
        const dx = CU_U.uDrift.value.x, dy = CU_U.uDrift.value.y;
        for (let k = 0; k < NP; k++) { ord[k] = k; const x = wrap(P[k * 4] + dx, e.x), y = wrap(P[k * 4 + 1] + dy, e.y), z = P[k * 4 + 2] - e.z; dist[k] = x * x + y * y + z * z; }
        ord.sort((a, b) => dist[b] - dist[a]);
        for (let k = 0; k < NP; k++) { const o = ord[k]; for (let c = 0; c < 4; c++) { sP[k * 4 + c] = P[o * 4 + c]; sI[k * 4 + c] = I[o * 4 + c]; } }
        aP.set(sP); aI.set(sI); geo.attributes.iPos.needsUpdate = true; geo.attributes.iInfo.needsUpdate = true;
      };
      CUMULUS_N = NP;
    }`;
}
