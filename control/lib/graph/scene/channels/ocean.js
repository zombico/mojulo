// In-page script (part of the terrain channel, channels/terrain-lod.js): THE OCEAN round an airspace map, in place of
// the flat translucent sheet (opt-in: `ocean` on the terrain channel; absent, the sheet as it was and none of this).
//
//   the sheet    rings round the eye, fine at its feet and widening to the horizon, scaled by its height over the sea (a
//                pilot at a kilometre needs no metre-wide cells), its middle stepped under the eye so the waves never
//                swim with it
//   the sea      the sky's own (skyscape/sky.js seaOf): the wind sea's trains about its peak and a long swell, summed as
//                Gerstner waves (deep water: ω = √(g·k)); a train is laid only where the sheet's cells are fine enough
//                for it, and every train shapes the light per pixel, fading as it falls under a pixel, so far water
//                calms instead of shimmering
//   the light    the aqua look (channels/aqua-glsl.js): fine ripples over the waves, the sky by Fresnel (mirror at
//                grazing), the sun's glint, foam as bubble lace
//   the shore    the water's depth over the land under it (the terrain kernel's ground, baked over the map's grid):
//                the waves shoal and drop in the shallows, the water turns from the deep's colour to a clear
//                turquoise, and surf breaks in bands running in to the beach
//   whitecaps    the crests break white once the wind passes a moderate breeze, more as it rises
//
// The clock is window.__mojClock when a capture pins it. `window.__mojOcean` → { verts, trains }.
import { AQUA_GLSL } from './aqua-glsl.js';

const OCEAN_VERT = `
uniform float uTime; uniform float uScale; uniform vec2 uCenter; uniform float uSea; uniform vec4 uW[8]; uniform vec2 uWd[8]; uniform int uNW;
uniform sampler2D uDepth; uniform vec4 uDepthR;
varying vec3 vAqWp; varying vec3 vAqN; varying float vAqFoam; varying float vDepth;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
float depthAt(vec2 p) { vec2 u = (p - uDepthR.xy) / (uDepthR.zw - uDepthR.xy); return (u.x < 0.0 || u.y < 0.0 || u.x > 1.0 || u.y > 1.0) ? 60.0 : texture2D(uDepth, u).r * 60.0; }
void main() {
  vec2 xy = uCenter + position.xy * uScale; float r = length(position.xy) * uScale, cell = max(1.0, r * 0.09 + uScale);
  float D = depthAt(xy), shoal = smoothstep(0.3, 10.0, D);
  vec3 p = vec3(xy, uSea);
  for (int i = 0; i < 8; i++) { if (i >= uNW) break;
    float L = uW[i].x, A = uW[i].y, k = 6.2832 / L, w = sqrt(9.81 * k), f = smoothstep(L * 0.5, L * 0.18, cell) * shoal;
    float ph = k * dot(uWd[i], xy) - w * uTime + uW[i].z; float Q = min(0.8, 0.6 / max(k * A * float(uNW), 1e-3));
    p.xy += uWd[i] * Q * A * cos(ph) * f; p.z += A * sin(ph) * f; }
  vAqWp = p; vAqN = vec3(0.0, 0.0, 1.0); vAqFoam = 0.0; vDepth = D;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`;

const OCEAN_FRAG = `
uniform float uTime; uniform vec4 uW[8]; uniform vec2 uWd[8]; uniform int uNW; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uWind;
varying float vDepth;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
${AQUA_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  vec3 V = normalize(cameraPosition - vAqWp); float fp = max(length(fwidth(vAqWp.xy)), 1e-4);
  float D = vDepth, shoal = smoothstep(0.3, 10.0, D);
  // the waves' slope, every train, each fading as it falls under a pixel; the crest's height for the whitecaps
  vec2 sl = vec2(0.0); float crest = 0.0, amps = 0.0;
  for (int i = 0; i < 8; i++) { if (i >= uNW) break;
    float L = uW[i].x, A = uW[i].y, k = 6.2832 / L, w = sqrt(9.81 * k), f = (1.0 - smoothstep(L * 0.12, L * 0.45, fp)) * shoal;
    float ph = k * dot(uWd[i], vAqWp.xy) - w * uTime + uW[i].z;
    sl += uWd[i] * k * A * cos(ph) * f; crest += A * sin(ph) * f; amps += A * f; }
  vec3 Ng = normalize(vec3(-sl, 1.0));
  vec2 rs = aqSlope(vAqWp.xy, fp); vec3 N = normalize(Ng - uAqNAmp * vec3(rs, 0.0));
  // the foam: whitecaps on the crests in a fresh wind; surf in bands running in over the shallows
  // (a crest breaks in streaks and patches, never whole: torn by a noise along the wind, finer than the waves)
  float tear = smoothstep(-0.12, 0.18, aqFbm(vec2(dot(vAqWp.xy, uAqFlow), dot(vAqWp.xy, vec2(-uAqFlow.y, uAqFlow.x)) * 2.5) * 0.12 + uTime * 0.05, fp * 0.12));
  float caps = smoothstep(0.42, 0.85, crest / max(amps, 1e-3)) * smoothstep(5.0, 14.0, uWind) * tear * 0.9;
  float surf = (1.0 - smoothstep(0.2, 3.5, D)) * (0.45 + 0.4 * sin(D * 2.2 - uTime * 1.6)) + (1.0 - smoothstep(0.0, 0.6, D)) * 0.6;
  float foam = clamp(max(caps, surf), 0.0, 1.0), fr = aqFroth(vAqWp.xy, foam, fp);
  // the water's own colour: clear turquoise over the shallows, the deep's colour past them, lighter where the light
  // comes up through a wave's face toward the eye
  vec3 body = mix(uShallow, uDeep, smoothstep(1.0, 22.0, D));
  body *= 0.9 + 0.25 * clamp(dot(Ng.xy, normalize(uAqSun.xy)) * 4.0, -0.4, 1.0);
  float F; vec3 R, Sp; aqLight(N, V, fp, fr, F, R, Sp);
  vec3 c = F * R + Sp + (1.0 - F) * mix(body, uAqFoamCol, fr);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** The ocean's page source, in the terrain channel's scope (THREE, scene, camera, TERRAIN, __tk, __tLin). `cfg` is
 *  TERRAIN.ocean: { z, deep, shallow, foam (sRGB hex), zenith, horizon (0–255), sun, sunCol, waves [[dx, dy, L, A]…],
 *  wind (m/s), rect (the depth bake's), res, look { rough, nScale, nAmp, nSpeed, froth } }. */
export function oceanScript() {
  return `
// --- the ocean (an airspace's sea): waves by the wind, the sky in it, the shore's surf ---
(function () {
  const O = TERRAIN.ocean, lin3 = (c) => new THREE.Vector3(__tLin(c[0]), __tLin(c[1]), __tLin(c[2])), col = (h) => new THREE.Color(h);
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  // the water's depth over the land under it, baked over the map's grid (the kernel's ground)
  const N = O.res, R = O.rect, dd = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = __tk.heightAt(R[0] + (R[2] - R[0]) * i / (N - 1), R[1] + (R[3] - R[1]) * j / (N - 1)), d = Math.max(0, Math.min(60, O.z - h)), k = (j * N + i) * 4; dd[k] = Math.round(d / 60 * 255); dd[k + 3] = 255; }
  const depth = new THREE.DataTexture(dd, N, N, THREE.RGBAFormat); depth.magFilter = depth.minFilter = THREE.LinearFilter; depth.needsUpdate = true;
  // the sheet: rings round the eye, geometric outward to the horizon
  const RINGS = 150, SEG = 160, G = Math.pow(90000, 1 / RINGS), pos = [0, 0, 0], idx = [];
  for (let k = 1; k <= RINGS; k++) { const r = Math.pow(G, k) - 1; for (let s = 0; s < SEG; s++) { const a = s / SEG * 6.2832; pos.push(r * Math.cos(a), r * Math.sin(a), 0); } }
  for (let s = 0; s < SEG; s++) idx.push(0, 1 + s, 1 + (s + 1) % SEG);
  for (let k = 1; k < RINGS; k++) for (let s = 0; s < SEG; s++) { const a = 1 + (k - 1) * SEG + s, b = 1 + (k - 1) * SEG + (s + 1) % SEG, c = a + SEG, d = b + SEG; idx.push(a, c, d, a, d, b); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const W = O.waves.slice(0, 8), uW = [], uWd = [];
  for (let i = 0; i < 8; i++) { const w = W[i] || [1, 0, 1, 0, 0]; uW.push(new THREE.Vector4(w[2], w[3], w[4] ?? i * 1.7, 0)); uWd.push(new THREE.Vector2(w[0], w[1])); }
  const L = O.look, sun = new THREE.Vector3(...O.sun).normalize(), sc = col(O.sunCol);
  const mat = new THREE.ShaderMaterial({ vertexShader: ${JSON.stringify(OCEAN_VERT)}, fragmentShader: ${JSON.stringify(OCEAN_FRAG)}, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uScale: { value: 1 }, uCenter: { value: new THREE.Vector2() }, uSea: { value: O.z }, uW: { value: uW }, uWd: { value: uWd }, uNW: { value: W.length },
      uDepth: { value: depth }, uDepthR: { value: new THREE.Vector4(R[0], R[1], R[2], R[3]) }, uDeep: { value: col(O.deep) }, uShallow: { value: col(O.shallow) }, uWind: { value: O.wind },
      uAqTime: { value: 0 }, uAqZen: { value: lin3(O.zenith) }, uAqHor: { value: lin3(O.horizon) }, uAqGnd: { value: lin3(O.horizon).multiplyScalar(0.5) }, uAqSun: { value: sun }, uAqSunCol: { value: new THREE.Vector3(sc.r, sc.g, sc.b).multiplyScalar(O.glint) },
      uAqRough: { value: L.rough }, uAqNScale: { value: L.nScale }, uAqNAmp: { value: L.nAmp }, uAqNSpeed: { value: L.nSpeed }, uAqFlow: { value: new THREE.Vector2(O.waves[0][0], O.waves[0][1]) },
      uAqFroth: { value: L.froth }, uAqRefl: { value: 1 }, uAqFoamCol: { value: col(O.foam) }, uAqSide: { value: 1 },
      uAqSigma: { value: new THREE.Vector3() }, uAqShore: { value: 0 }, uAqTint: { value: new THREE.Vector3() }, uAqDepth: { value: depth }, uAqRes: { value: new THREE.Vector2(1, 1) }, uAqLogF: { value: 1 }, uAqHasDepth: { value: 0 }, uAqScene: { value: depth }, uAqRefr: { value: 0 },
    }]) });
  const U = mat.uniforms;
  const sea = new THREE.Mesh(geo, mat); sea.frustumCulled = false; sea.userData.g = 'ocean'; sea.raycast = () => {};
  sea.onBeforeRender = (r, s, cam) => {
    const t = clock(), alt = Math.max(1, cam.position.z - O.z), k = Math.max(0.6, alt / 40), step = 4 * k;
    U.uTime.value = t; U.uAqTime.value = t; U.uScale.value = k;
    U.uCenter.value.set(Math.round(cam.position.x / step) * step, Math.round(cam.position.y / step) * step);
  };
  scene.add(sea);
  window.__mojOcean = { verts: pos.length / 3, trains: W.length };
})();
`;
}
