import { safeJson } from '../emit-util.js';

// In-page script: a WET ROAD (roads/race-mood.js: a race in the rain). The road's own faces are baked dark; this lays
// a film over them that the page lights per pixel: the sky by Fresnel (a grazing look down the road shines, a look
// straight down does not), and every lamp near the camera thrown back as a streak — the lamp mirrored under the
// road, the film narrow across and long toward the eye, as a wet road smears a light. A slow shimmer breaks the
// streaks the way rain on the film does. Additive, no depth write, offset onto the road. The clock is
// window.__mojClock when a capture pins it. Absent `wetRoad` ⇒ NOT emitted.
// `cfg`: { quads: [[[x, y, z] × 4], …], lamps: [{ at, rgb, intensity }], zenith: [r, g, b], horizon: [r, g, b] }
export const WET_ROAD_LAMPS = 24;
export function wetRoadScript(cfg) {
  return `
// --- wet road: the sky and the lamps thrown back off a wet film ---
(function () {
  const W = ${safeJson(cfg)}, N = ${WET_ROAD_LAMPS};
  if (!W.quads.length) return;
  const pos = new Float32Array(W.quads.length * 18);
  W.quads.forEach((q, i) => { [0, 1, 2, 0, 2, 3].forEach((k, j) => { pos[i * 18 + j * 3] = q[k][0]; pos[i * 18 + j * 3 + 1] = q[k][1]; pos[i * 18 + j * 3 + 2] = q[k][2] + 0.02; }); });   // (a hair over the road and its paint)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lin = (c) => new THREE.Vector3(...c.map((v) => Math.pow(v / 255, 2.2)));
  const U = {
    uZen: { value: lin(W.zenith) }, uHor: { value: lin(W.horizon) }, uT: { value: 0 }, uN: { value: 0 },
    uL: { value: Array.from({ length: N }, () => new THREE.Vector4()) }, uC: { value: Array.from({ length: N }, () => new THREE.Vector3()) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    // (the page's depth is logarithmic: the film writes and tests it as the meshes do)
    vertexShader: \`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }\`,
    fragmentShader: \`
      #include <logdepthbuf_pars_fragment>
      varying vec3 vW; uniform vec3 uZen, uHor; uniform float uT; uniform int uN; uniform vec4 uL[${WET_ROAD_LAMPS}]; uniform vec3 uC[${WET_ROAD_LAMPS}];
      float h2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p), w = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), w.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), w.x), w.y); }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 V = normalize(cameraPosition - vW), R = reflect(-V, vec3(0.0, 0.0, 1.0));
        float F = 0.02 + 0.98 * pow(1.0 - clamp(V.z, 0.0, 1.0), 5.0);
        float shimmer = 0.65 + 0.7 * n2(vW.xy * 1.7 + vec2(0.0, uT * 0.9)) * n2(vW.xy * 0.6 - vec2(uT * 0.3, 0.0));
        vec3 col = mix(uHor, uZen, clamp(R.z * 1.6, 0.0, 1.0)) * F * 0.55;
        vec3 toP = normalize(vW - cameraPosition);
        for (int i = 0; i < ${WET_ROAD_LAMPS}; i++) {
          if (i >= uN) break;
          vec3 L = uL[i].xyz, M = vec3(L.xy, 2.0 * vW.z - L.z), toM = normalize(M - cameraPosition);
          vec3 side = normalize(cross(toM, vec3(0.0, 0.0, 1.0))), up = cross(side, toM), d = toP - toM;
          float dx = dot(d, side), dy = dot(d, up);
          float s = exp(-dx * dx / 0.00005 - dy * dy / 0.006) * uL[i].w / (1.0 + length(L.xy - vW.xy) * 0.015);
          col += uC[i] * s * shimmer;
        }
        gl_FragColor = vec4(col, 1.0);
      }\`,
  });
  const film = new THREE.Mesh(g, mat); film.frustumCulled = false; film.renderOrder = 0.8; scene.add(film);
  const lamps = W.lamps.map((l) => ({ at: l.at, c: lin(l.rgb), k: l.intensity }));
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  (function tick() {
    const c = camera.position, near = lamps.map((l) => ({ l, d: (l.at[0] - c.x) ** 2 + (l.at[1] - c.y) ** 2 })).sort((a, b) => a.d - b.d).slice(0, N);
    near.forEach(({ l }, i) => { U.uL.value[i].set(l.at[0], l.at[1], l.at[2], l.k); U.uC.value[i].copy(l.c); });
    U.uN.value = near.length; U.uT.value = clock();
    requestAnimationFrame(tick);
  })();
})();
`;
}
