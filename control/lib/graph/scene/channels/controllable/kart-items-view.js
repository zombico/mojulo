/**
 * A KART RACE'S ITEMS ON THE PAGE (roads/kart-items.js): the step the race's items run on, inlined as its source; the
 * boxes drawn; what is used laid on the drive rule's karts. Emitted only when the track's drive surface carries `items`
 * (an absent channel adds nothing).
 *
 *   the boxes   a rounded core with a "?" on every face, in a shell lit at its rim in colours that run round it (a
 *               fresnel: the more the shell turns from the eye, the brighter and the further round the wheel), turning
 *               on a tilted axis and bobbing; popped when taken, grown back when it returns
 *   the toffee  a squat glossy blob where it was dropped; a gumball a glossy ball rolling down the line
 *   the karts   every body on the drive or the racer rule takes and uses items; the pilot's item on E (or right Shift,
 *               the scheme's `useItem`, on the pause sheet too: F, right Shift, the pad's left face); a boost is the drive rule's own (`boostT`), a hit cuts the kart's speed and
 *               spins its body a turn; `e.item` is set while one is held (the kart's juice pulses on it)
 *   window.__mojItems   { held(id), says(kind), icon(kind) }: what the HUD reads
 *
 *   kartItemsViewScript(seed) → the page's script (after the drive surface's table, `__surfaceT`)
 */
import { kartItemsStep, itemState } from '../../../roads/kart-items.js';

export function kartItemsViewScript(seed = 1) {
  return `// race items (roads/kart-items.js): the boxes, what they hand out, and what is used
const __kiStep = ${kartItemsStep.toString()};
const __kiState = (${itemState.toString()})(__surfaceT.items, ${(seed >>> 0) || 1});
__kiState.T.line = __surfaceT.pts;
let __kiKeyWas = false, __kiPadWas = false;
window.__mojItems = { held: (id) => __kiState.held[id] || null, says: (k) => (__kiState.T.kinds[k] ? __kiState.T.kinds[k].says : k), icon: (k) => (__kiState.T.kinds[k] && __kiState.T.kinds[k].icon) || k };
// the box: a rounded cube (a box's vertices pulled onto a rounded hull) — its core with the "?" and its shell
function __kiRounded(size, round) {
  const g = new THREE.BoxGeometry(size, size, size, 8, 8, 8), p = g.attributes.position, h = size / 2 - round, v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(Math.max(-h, Math.min(h, v.x)), Math.max(-h, Math.min(h, v.y)), Math.max(-h, Math.min(h, v.z))); v.sub(c).normalize().multiplyScalar(round).add(c); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  return g;
}
const __kiMark = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ffe066'); gr.addColorStop(1, '#ffb02e'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  x.font = '900 100px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = 14; x.strokeStyle = '#ff4f86'; x.strokeText('?', 64, 70); x.fillStyle = '#fff3e2'; x.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(cv); if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; return t;
})();
// (the shell's shader carries three's log-depth chunks: a page drawn with a logarithmic depth buffer tests it as its own)
const __kiShellMat = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false,
  vertexShader: '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec3 vN; varying vec3 vV; varying vec3 vP; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = position; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w;\\n#include <logdepthbuf_vertex>\\n}',
  fragmentShader: '#include <logdepthbuf_pars_fragment>\\nuniform float uT; varying vec3 vN; varying vec3 vV; varying vec3 vP; vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); } void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); vec3 rim = hue(fract(uT * 0.22 + f * 0.7 + (vP.x + vP.y + vP.z) * 0.18)); vec3 c = mix(vec3(1.0, 0.86, 0.95) * 0.35, rim * 1.35, smoothstep(0.02, 0.85, f)) + vec3(1.0) * pow(f, 5.0) * 0.7; gl_FragColor = vec4(c, 0.22 + 0.7 * f);\\n#include <logdepthbuf_fragment>\\n}',
});
const __kiCoreMat = new THREE.MeshBasicMaterial({ map: __kiMark, toneMapped: false });
const __kiSize = __kiState.T.size || 1.4, __kiShellG = __kiRounded(__kiSize, __kiSize * 0.22), __kiCoreG = __kiRounded(__kiSize * 0.62, __kiSize * 0.1);
const __kiBoxes = __kiState.T.boxes.map((b, i) => {
  const g = new THREE.Group(), core = new THREE.Mesh(__kiCoreG, __kiCoreMat), shell = new THREE.Mesh(__kiShellG, __kiShellMat);
  shell.renderOrder = 3; g.add(core); g.add(shell); g.position.set(b[0], b[1], b[2]); g.userData = { vis: 1, i };
  core.raycast = shell.raycast = function () {}; scene.add(g); return g;
});
// the toffee and the gumballs: pooled meshes, glossy
const __kiMat = (hex) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.25, metalness: 0.0, emissive: new THREE.Color(hex), emissiveIntensity: 0.18 });
const __kiPool = { trap: [], shot: [] }, __kiGeo = { trap: new THREE.SphereGeometry(1, 18, 10), shot: new THREE.SphereGeometry(1, 18, 12) };
function __kiMesh(kind, n, hex) {
  const P = __kiPool[kind];
  while (P.length <= n) { const m = new THREE.Mesh(__kiGeo[kind], __kiMat(hex)); m.raycast = function () {}; scene.add(m); P.push(m); }
  return P[n];
}
const __kiSpin = {};
function __kiTick(dt) {
  const T = __kiState.T, now = performance.now() / 1000;
  // (the pad's left face: its press, not its hold)
  // (the pilot's use item, its press: the key the scheme binds, controls/schemes.js useItem, and the pad's left face)
  const keyOn = typeof __k === 'function' ? !!__k('useItem') : false, keyUse = keyOn && !__kiKeyWas; __kiKeyWas = keyOn;
  let padUse = false; try { const gp = navigator.getGamepads && navigator.getGamepads()[0]; const on = !!(gp && gp.buttons[2] && gp.buttons[2].pressed); padUse = on && !__kiPadWas; __kiPadWas = on; } catch (e) {}
  const karts = [];
  for (const e of __world.entities) {
    if (!e || !e.transform || e.gone || !e.rule || (e.rule.type !== 'drive' && e.rule.type !== 'racer')) continue;
    const pilot = e.id === __world.pilotId;
    karts.push({ id: e.id, pos: e.transform.pos, heading: e.transform.heading || 0, speed: e.speed || 0, use: pilot && (keyUse || padUse), ai: !pilot });
  }
  if (dt > 0 && !window.__mojFreeze) for (const f of __kiStep(__kiState, karts, dt)) {
    const e = __world.byId[f.id]; if (!e) continue;
    if (f.took) e.item = 1;
    if (f.used) e.item = 0;
    if (f.boost) e.boostT = Math.max(e.boostT || 0, f.boost);
    if (f.slow) { e.speed = (e.speed || 0) * f.slow; __kiSpin[f.id] = { t: f.spin, of: f.spin }; }
  }
  // a hit kart's body spun a turn on its own axis while it lasts
  for (const id in __kiSpin) {
    const s = __kiSpin[id], m = __bodies[id];
    s.t -= dt; if (s.t <= 0) { delete __kiSpin[id]; continue; }
    if (m) m.rotation.z += 2 * Math.PI * (1 - s.t / s.of);
  }
  // the boxes: turning on a tilted axis, bobbing; popped and grown back
  __kiShellMat.uniforms.uT.value = now;
  for (const g of __kiBoxes) {
    const i = g.userData.i, want = __kiState.box[i] > 0 ? 0 : 1, b = T.boxes[i];
    g.userData.vis += (want - g.userData.vis) * Math.min(1, dt * (want ? 6 : 16));
    const v = g.userData.vis, pop = want ? 1 : 1 + 0.6 * (1 - v);
    g.visible = v > 0.02; g.scale.setScalar(Math.max(0.001, v * pop));
    g.position.z = b[2] + 0.18 * Math.sin(now * 2.4 + i * 0.9);
    g.rotation.set(0.42, 0.36, now * 1.5 + i * 0.7);
  }
  // the toffee where it lies, the gumballs where they roll
  __kiState.traps.forEach((q, n) => { const I = T.kinds[q.id], m = __kiMesh('trap', n, I.hex); m.visible = true; m.position.set(q.at[0], q.at[1], q.at[2] + 0.08); m.scale.set(I.r, I.r, I.r * 0.28); });
  for (let n = __kiState.traps.length; n < __kiPool.trap.length; n++) __kiPool.trap[n].visible = false;
  __kiState.shots.forEach((q, n) => { const I = T.kinds[q.id], m = __kiMesh('shot', n, I.hex); m.visible = true; m.position.set(q.at[0], q.at[1], q.at[2]); m.scale.setScalar(I.r); m.rotation.y += q.v * dt / I.r; m.rotation.z = q.heading; });
  for (let n = __kiState.shots.length; n < __kiPool.shot.length; n++) __kiPool.shot[n].visible = false;
}
`;
}
