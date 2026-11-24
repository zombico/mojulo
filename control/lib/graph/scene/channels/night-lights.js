// In-page script (part of the terrain channel, channels/terrain-lod.js): THE GROUND'S LIGHTS AT NIGHT (skyscape/
// night-lights.js): a runway's edges, thresholds and approach bars, its taxiway's blue edges and green lead-on lines,
// its PAPI (each lamp white or red by the eye's elevation from it, by day too), the red beacons on the mast and the
// tall buildings (flashing), and the traffic: cars on the roads, the arterials and the highways' decks, each a pair of lamps that shows
// white to an eye it is coming toward and red to one it is going from. Every light a point that keeps a pixel or two
// however far it is, dimmed by the haze it shines through more weakly than a lit surface is. Opt-in (`lights` on the
// terrain channel, an airspace from the dusk on); absent, nothing of this is emitted.
//
// The clock is window.__mojClock when a capture pins it; the cars are placed at every render, so a captured frame
// sees them where a flown one does. `window.__mojLights` → { points, cars }.

const LIGHT_VERT = `
attribute vec3 color; attribute vec2 info;
uniform float uTime; uniform float uPxPerM;
varying vec3 vCol; varying float vA;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() {
  vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
  float d = max(-mvPosition.z, 1.0);
  gl_PointSize = max(1.6, info.x * uPxPerM / d);
  // a beacon flashes about once a second, each on its own beat
  float blink = info.y > 0.5 && info.y < 1.5 ? step(0.55, fract(uTime * 0.95 + fract(position.x * 0.013 + position.y * 0.007))) : 1.0;
  vCol = color;
  if (info.y > 1.5) {
    // a PAPI lamp (its colour its angle and its facing): white to an eye above its angle, red under it, a sliver of
    // pink at the change; seen only from its approach
    vec3 to = cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz; float hz = max(length(to.xy), 1.0), el = degrees(atan(to.z, hz));
    float w = smoothstep(color.x - 0.06, color.x + 0.06, el); vCol = mix(vec3(1.7, 0.1, 0.05), vec3(1.6, 1.5, 1.3), w);
    blink = smoothstep(0.1, 0.4, dot(to.xy / hz, color.yz));
    gl_PointSize = max(2.4, info.x * uPxPerM / d);
  }
  vA = blink * clamp(info.x * uPxPerM / d / 1.6, 0.35, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`;
const LIGHT_FRAG = `
varying vec3 vCol; varying float vA;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard;
  float a = vA * (1.0 - r) * (1.0 - r);
  vec3 c = vCol * a;
  #ifdef USE_FOG
  c *= exp(-fogDensity * fogDensity * 0.25 * vFogDepth * vFogDepth);
  #endif
  gl_FragColor = vec4(c, a);
}`;

/** The night lights' page source, in the terrain channel's scope (THREE, scene, camera, TERRAIN, renderer). */
export function nightLightsScript() {
  return `
// --- the ground's lights at night: runways, beacons, traffic ---
(function () {
  const NL = TERRAIN.lights, dec = (b) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Float32Array(u.buffer); };
  const clock = () => (window.__mojClock != null ? window.__mojClock : performance.now()) / 1000;
  const mkMat = () => new THREE.ShaderMaterial({ vertexShader: ${JSON.stringify(LIGHT_VERT)}, fragmentShader: ${JSON.stringify(LIGHT_FRAG)}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uPxPerM: { value: 800 } }]) });
  const pxPerM = (cam) => (typeof renderer !== 'undefined' ? renderer.domElement.height : 760) / (2 * Math.tan((cam.fov || 60) * Math.PI / 360));
  const out = window.__mojLights = { points: NL.n, cars: 0 };
  // the fixed lights
  if (NL.n) {
    const F = dec(NL.points), pos = new Float32Array(NL.n * 3), col = new Float32Array(NL.n * 3), info = new Float32Array(NL.n * 2);
    for (let k = 0; k < NL.n; k++) { pos.set([F[k * 8], F[k * 8 + 1], F[k * 8 + 2]], k * 3); col.set([F[k * 8 + 3], F[k * 8 + 4], F[k * 8 + 5]], k * 3); info.set([F[k * 8 + 6], F[k * 8 + 7]], k * 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('info', new THREE.BufferAttribute(info, 2));
    const m = mkMat(), pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; pts.raycast = () => {};
    pts.onBeforeRender = (r, s, cam) => { m.uniforms.uTime.value = clock(); m.uniforms.uPxPerM.value = pxPerM(cam); };
    scene.add(pts);
  }
  // the traffic: each path's cars by its length, both ways, each its own speed and place (seeded), a lane apiece
  const paths = (NL.traffic || []).map((T) => {
    const p = T.pts, cum = [0]; for (let k = 3; k < p.length; k += 3) cum.push(cum[cum.length - 1] + Math.hypot(p[k] - p[k - 3], p[k + 1] - p[k - 2]));
    return { p, cum, len: cum[cum.length - 1], lanes: T.lanes, perKm: T.perKm };
  }).filter((P) => P.len > 50);
  const cars = []; let seed = 7;
  const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  paths.forEach((P, i) => { const n = Math.round(P.len / 1000 * P.perKm); for (let k = 0; k < n; k++) cars.push({ i, s0: R() * P.len, v: 14 + R() * 16, dir: R() < 0.5 ? 1 : -1, lane: 1 + Math.floor(R() * Math.max(1, P.lanes)) }); });
  out.cars = cars.length;
  if (cars.length) {
    const N = cars.length * 2, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), info = new Float32Array(N * 2);
    for (let k = 0; k < N; k++) info.set([1.6, 0], k * 2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('info', new THREE.BufferAttribute(info, 2));
    const m = mkMat(), pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; pts.raycast = () => {};
    const at = (P, s) => { s = Math.max(0, Math.min(P.len, s)); let j = 1; while (j < P.cum.length - 1 && P.cum[j] < s) j++; const a = P.cum[j - 1], b = P.cum[j], t = b > a ? (s - a) / (b - a) : 0, o = (j - 1) * 3, q = j * 3;
      return [P.p[o] + (P.p[q] - P.p[o]) * t, P.p[o + 1] + (P.p[q + 1] - P.p[o + 1]) * t, P.p[o + 2] + (P.p[q + 2] - P.p[o + 2]) * t, P.p[q] - P.p[o], P.p[q + 1] - P.p[o + 1]]; };
    pts.onBeforeRender = (r, sc, cam) => {
      const t = clock(), c = cam.position; m.uniforms.uTime.value = t; m.uniforms.uPxPerM.value = pxPerM(cam);
      cars.forEach((C, k) => {
        const P = paths[C.i], s = ((C.s0 + C.dir * C.v * t) % P.len + P.len) % P.len, [x, y, z, dx, dy] = at(P, s), l = Math.hypot(dx, dy) || 1, fx = dx / l * C.dir, fy = dy / l * C.dir;
        // keep right: its lane out from the middle; its lamps a pair across it
        const ox = fy * 3.4 * C.lane, oy = -fx * 3.4 * C.lane, toward = (c.x - x) * fx + (c.y - y) * fy > 0;
        const lamp = toward ? [1.5, 1.4, 1.15] : [1.4, 0.08, 0.04];
        for (const side of [-1, 1]) { const q = k * 2 + (side > 0 ? 1 : 0); pos.set([x + ox + fy * 0.8 * side, y + oy - fx * 0.8 * side, z], q * 3); col.set(lamp, q * 3); }
      });
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    };
    scene.add(pts);
  }
})();
`;
}
