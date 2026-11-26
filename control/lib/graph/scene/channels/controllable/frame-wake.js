// In-page script: A FRAME'S WAKE — the light a pulsed plasma drive leaves where it has been (assault-frame/parts.js
// PROPELLANTS: the batteries charge the booster's capacitors, it fires them as pulses, and each pulse's knot of plasma
// glows as it recombines). Kept in the world, not on the nozzle: a ribbon from each main bell along the way the bell
// went, so the pilot's movement draws the streaks (a strafe a curve, a quick boost a corner, a climb a hook).
//
//   THE RIBBON   facing the eye, white at its heart and the propellant's colour at its edges (the figure's `wake`), thin
//                to nothing as it ages; sampled on the world's clock (WAKE.step), gone after WAKE.life seconds
//   THE BEADS    the pulses themselves: bright knots along it, one every 1 / WAKE.rate seconds of the drive's burn, held
//                where they were thrown, so their spacing says the speed (close at a walk, strung out at a boost)
//   THE AIR      in an atmosphere the wake curls and frays as it ages (the plasma ionising the air round it and the air
//                tearing it) and fades sooner; in vacuum (`air: false`) it is dead straight and lasts
//   QUICK BOOST  the whole bank fired at once: the ribbon wide and white-hot while it lasts (a hard bright corner where it
//                turns), and a burst shed where it begins: a ring of small plasma bits thrown out across the dash (the
//                drive's field collapsing), each slowing, drifting back along the way it came and going out on its own,
//                so the ring frays and scatters as it fades; one point cloud a burst, moved in its shader
//   ASSAULT      its ribbon wider and hotter for as long as the charge is held
//
// Emitted only on a page whose figures carry a `wake` (an assault frame's) and never in a capture: every other page keeps
// its bytes. It reads each body's main bells (its rig's flame jets, frame-flame.js) and the world's entities (`thrust`,
// `qbT`, `qbDir`, `ab`); it writes nothing back. `window.__mojWake` { trails, rings } is its probe.
export const WAKE = Object.freeze({
  step: 1 / 45,
  life: Object.freeze({ air: 0.6, space: 1.1 }),
  width: 1.3,
  rate: 14,
  curl: 2.4,
  // (the quick boost's burst: `bits` small knots of plasma thrown out round the dash, from `ring[0]` to as far as
  // `ring[1]` metres, each fading on its own clock within `life` s, `size` metres across, drifting back `drift` m/s)
  qb: Object.freeze({ width: 2.4, ring: Object.freeze([0.8, 7]), life: 1.1, bits: 120, size: Object.freeze([0.1, 0.24]), drift: 2, spread: 0.35 }),
  ab: 1.6,
  rings: 8,
});

const WAKE_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aAge; attribute float aSide; attribute float aT; attribute float aHot;
varying float vAge; varying float vSide; varying float vT; varying float vHot;
void main() {
  vAge = aAge; vSide = aSide; vT = aT; vHot = aHot;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const WAKE_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCol; uniform float uRate;
varying float vAge; varying float vSide; varying float vT; varying float vHot;
void main() {
  #include <logdepthbuf_fragment>
  if (vAge >= 1.0) discard;
  float e = abs(vSide), heart = 1.0 - smoothstep(0.0, 0.4, e), body = 1.0 - smoothstep(0.45, 1.0, e);
  float fade = pow(1.0 - vAge, 1.6);
  // (a pulse: a knot of light where each was thrown, outlasting the glow round it a little)
  float bead = pow(0.5 + 0.5 * cos(vT * 6.2831853 * uRate), 10.0) * pow(1.0 - vAge, 0.8);
  float k = (0.32 * body + 0.42 * heart) * fade + 0.55 * bead * body;
  k *= 1.0 + 0.5 * vHot;
  if (k < 0.004) discard;
  vec3 c = mix(uCol, vec3(1.0), clamp(heart * 0.55 + vHot * 0.35 + bead * 0.3, 0.0, 1.0));
  gl_FragColor = vec4(c * k, k);
}`;

// (the burst's bits: each thrown out along its own way round the ring at its own pace, slowing, carried back along the
// dash, smaller and fainter as it goes, out by its own share of the burst's life, a flicker in it)
const BURST_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aDir; attribute float aSpeed; attribute float aSeed;
uniform float uAge; uniform float uLife; uniform vec3 uBack; uniform float uR0; uniform float uR1; uniform vec2 uSize; uniform float uViewH;
varying float vA; varying float vHeat;
void main() {
  float u = clamp(uAge / uLife, 0.0, 1.0);
  float r = uR0 + (uR1 - uR0) * aSpeed * (1.0 - pow(1.0 - u, 3.0));
  vec3 p = position + aDir * r + uBack * uAge * (0.5 + aSeed);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float own = 0.55 + 0.45 * aSeed;
  vA = pow(max(0.0, 1.0 - u / own), 1.6) * (0.8 + 0.2 * sin(uAge * 47.0 + aSeed * 31.0));
  vHeat = 1.0 - u;
  float sz = mix(uSize.x, uSize.y, fract(aSeed * 7.13)) * (1.0 - 0.55 * u);
  gl_PointSize = max(1.0, sz * uViewH / max(0.5, -mv.z));
  #include <logdepthbuf_vertex>
}`;
const BURST_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCol;
varying float vA; varying float vHeat;
void main() {
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vA < 0.004) discard;
  float a = (1.0 - d * d) * vA * 0.9;
  vec3 c = mix(uCol, vec3(1.0), 0.45 * (1.0 - d) * vHeat);
  gl_FragColor = vec4(c * a, a);
}`;

/** The page's block: `__updateWake(dt)`, called each step after the thrusters. */
export function frameWakeScript({ air = true } = {}) {
  const life = air ? WAKE.life.air : WAKE.life.space;
  return `
// A FRAME'S WAKE (scene/channels/controllable/frame-wake.js): the plasma's light left where each main bell has been
const __WK = ${JSON.stringify({ ...WAKE, life, air })}, __WK_N = Math.ceil(__WK.life / __WK.step) + 2;
const __wkTrails = new Map(), __wkRings = [];
const __wkP = new THREE.Vector3(), __wkD = new THREE.Vector3(), __wkS = new THREE.Vector3(), __wkV = new THREE.Vector3(), __wkE = new THREE.Vector3(), __wkQ = new THREE.Quaternion(), __wkUp = new THREE.Vector3(0, 1, 0);
function __wkTrail(e, rf) {
  let T = __wkTrails.get(e.id);
  if (T && T.rf === rf) return T;
  if (T) { scene.remove(T.m); T.g.dispose(); T.m.material.dispose(); }
  const jets = rf.jets.filter((j) => j.kind === 'flame' && j.main);
  if (!jets.length) { __wkTrails.set(e.id, null); return null; }
  const V = jets.length * __WK_N * 2, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V * 3), 3));
  for (const [k, n] of [['aAge', 1], ['aSide', 1], ['aT', 1], ['aHot', 1]]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(V * n), n));
  const idx = [];
  for (let j = 0; j < jets.length; j++) for (let i = 0; i < __WK_N - 1; i++) { const a = 2 * (j * __WK_N + i); idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  const col = new THREE.Color((rf.fig.wake && rf.fig.wake.colour) || '#8673bd');
  const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: col }, uRate: { value: __WK.rate } }, vertexShader: ${JSON.stringify(WAKE_VERT)}, fragmentShader: ${JSON.stringify(WAKE_FRAG)}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 6; m.raycast = function () {}; scene.add(m);
  T = { e: e.id, rf, m, g, col, jets: jets.map((j) => ({ j, s: [], last: -1e9, ws: j.holder.parent.getWorldScale(__wkS).x })), qb: false };
  __wkTrails.set(e.id, T);
  return T;
}
// (a curl in the air: how far a sample has drifted by its age, the same for the same sample on every page)
function __wkCurl(s, age, out) {
  const a = Math.pow(age, 1.5) * __WK.curl, t = s.t;
  out.set(s.x + a * Math.sin(t * 5.3 + s.j * 1.7), s.y + a * Math.cos(t * 4.1 + s.j * 2.3), s.z + a * 0.6 * Math.sin(t * 3.7 + s.j));
}
// (a burst: a point cloud from the pool, its bits laid round the dash's axis by the burst's own count, no dice)
let __wkSeq = 0;
const __wkH = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233 + 3.1) * 43758.5453; return x - Math.floor(x); };
function __wkRing(at, dir, col) {
  let R = __wkRings.find((r) => !r.m.visible);
  if (!R) {
    if (__wkRings.length >= __WK.rings) R = __wkRings.reduce((a, b) => (a.t0 < b.t0 ? a : b));
    else {
      const N = __WK.qb.bits, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('aSpeed', new THREE.BufferAttribute(new Float32Array(N), 1));
      g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(N), 1));
      const U = { uAge: { value: 0 }, uLife: { value: __WK.qb.life }, uBack: { value: new THREE.Vector3() }, uR0: { value: __WK.qb.ring[0] }, uR1: { value: __WK.qb.ring[1] }, uSize: { value: new THREE.Vector2(__WK.qb.size[0], __WK.qb.size[1]) }, uViewH: { value: 600 }, uCol: { value: new THREE.Color() } };
      const m = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: ${JSON.stringify(BURST_VERT)}, fragmentShader: ${JSON.stringify(BURST_FRAG)}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.frustumCulled = false; m.renderOrder = 6; m.raycast = function () {}; scene.add(m);
      R = { m, g, U, t0: 0 }; __wkRings.push(R);
    }
  }
  // (the ring's plane: two ways across the dash)
  const a = new THREE.Vector3(0, 0, 1).cross(dir); if (a.lengthSq() < 1e-6) a.set(1, 0, 0); a.normalize();
  const b = new THREE.Vector3().crossVectors(dir, a).normalize(), seq = ++__wkSeq, N = __WK.qb.bits;
  const P = R.g.attributes.position.array, D = R.g.attributes.aDir.array, SP = R.g.attributes.aSpeed.array, SE = R.g.attributes.aSeed.array;
  for (let i = 0; i < N; i++) {
    const th = (i / N + 0.6 * __wkH(i, seq) / N) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), j = (__wkH(i, seq + 7) - 0.5) * __WK.qb.spread;
    D[3 * i] = a.x * c + b.x * sn; D[3 * i + 1] = a.y * c + b.y * sn; D[3 * i + 2] = a.z * c + b.z * sn;
    P[3 * i] = dir.x * j; P[3 * i + 1] = dir.y * j; P[3 * i + 2] = dir.z * j;
    SP[i] = 0.55 + 0.45 * __wkH(i, seq + 13); SE[i] = __wkH(i, seq + 29);
  }
  for (const k of ['position', 'aDir', 'aSpeed', 'aSeed']) R.g.attributes[k].needsUpdate = true;
  R.t0 = __world.time; R.m.visible = true; R.m.position.copy(at);
  R.U.uBack.value.copy(dir).multiplyScalar(-__WK.qb.drift);
  R.U.uCol.value.copy(col).lerp(new THREE.Color(1, 1, 1), 0.25);
}
// (a look, never the game's: one that fails puts itself out, said once, and the world plays on)
let __wkOff = false;
function __updateWake(dt) {
  if (__wkOff) return;
  try { __wakeStep(dt); } catch (err) { __wkOff = true; for (const T of __wkTrails.values()) if (T) T.m.visible = false; console.warn('frame wake off:', err); }
}
function __wakeStep(dt) {
  const t = __world.time;
  for (const e of __world.entities) {
    const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig;
    if (!rf || !rf.jets || !rf.fig || !rf.fig.wake) continue;
    const T = __wkTrail(e, rf);
    if (!T) continue;
    const on = !e.gone && !e.dormant && body.visible !== false && (rf.thrustAmt || 0) > 0.05, qb = (e.qbT || 0) > 0, hot = qb ? 1 : e.ab ? 0.6 : 0;
    // (a quick boost's start: the bank fired at once, a ring shed across the dash where it begins)
    if (qb && !T.qb && on) {
      const p = e.transform.pos, d = Array.isArray(e.qbDir) ? e.qbDir : [Math.cos(e.transform.heading || 0), Math.sin(e.transform.heading || 0)];
      __wkD.set(d[0], d[1], d[2] || 0); if (__wkD.lengthSq() < 1e-6) __wkD.set(1, 0, 0); __wkD.normalize();
      __wkP.set(p[0], p[1], p[2]); __wkRing(__wkP, __wkD, T.col);
    }
    T.qb = qb;
    const P = T.g.attributes.position.array, AG = T.g.attributes.aAge.array, SD = T.g.attributes.aSide.array, AT = T.g.attributes.aT.array, HT = T.g.attributes.aHot.array;
    T.jets.forEach((J, jn) => {
      // (where the bell's plume ends: its mouth and a little aft along the way the exhaust leaves)
      J.j.holder.getWorldPosition(__wkP); J.j.holder.getWorldQuaternion(__wkQ); __wkD.copy(__wkUp).applyQuaternion(__wkQ);
      const w = J.j.rad * J.ws * __WK.width * (qb ? __WK.qb.width : e.ab ? __WK.ab : 1);
      __wkP.addScaledVector(__wkD, J.j.rad * J.ws * 2.5);
      if (on && t - J.last >= __WK.step) { J.s.unshift({ x: __wkP.x, y: __wkP.y, z: __wkP.z, t, w, h: hot, j: jn }); J.last = t; }
      while (J.s.length && (t - J.s[J.s.length - 1].t > __WK.life || J.s.length > __WK_N - 1)) J.s.pop();
      // (its head on the bell while it burns, so the ribbon never stands off it)
      const pts = on ? [{ x: __wkP.x, y: __wkP.y, z: __wkP.z, t, w, h: hot, j: jn }, ...J.s] : J.s, n = pts.length;
      const base = jn * __WK_N;
      for (let i = 0; i < __WK_N; i++) {
        const s = pts[Math.min(i, Math.max(0, n - 1))], o = 2 * (base + i);
        if (!s) { for (const k of [0, 1]) { AG[o + k] = 1; P.set([0, 0, -1e6], 3 * (o + k)); } continue; }
        const age = i < n ? Math.min(1, (t - s.t) / __WK.life) : 1;
        if (__WK.air) __wkCurl(s, age, __wkV); else __wkV.set(s.x, s.y, s.z);
        const c = Math.min(i, n - 1), s2 = pts[Math.min(c + 1, n - 1)], s0 = pts[Math.max(c - 1, 0)];
        __wkS.set(s0.x - s2.x, s0.y - s2.y, s0.z - s2.z); if (__wkS.lengthSq() < 1e-8) __wkS.copy(__wkD);
        __wkS.cross(__wkE.set(__wkV.x - camera.position.x, __wkV.y - camera.position.y, __wkV.z - camera.position.z)).normalize();
        const ww = s.w * (0.25 + 0.75 * (1 - age)) * (__WK.air ? 1 + 0.6 * age : 1);
        P.set([__wkV.x + __wkS.x * ww, __wkV.y + __wkS.y * ww, __wkV.z + __wkS.z * ww, __wkV.x - __wkS.x * ww, __wkV.y - __wkS.y * ww, __wkV.z - __wkS.z * ww], 3 * o);
        AG[o] = AG[o + 1] = age; SD[o] = -1; SD[o + 1] = 1; AT[o] = AT[o + 1] = s.t; HT[o] = HT[o + 1] = s.h;
      }
    });
    for (const k of ['position', 'aAge', 'aSide', 'aT', 'aHot']) T.g.attributes[k].needsUpdate = true;
    T.m.visible = T.jets.some((J) => J.s.length > 0);
  }
  // (the bursts' age, and the screen's scale for their bits' size: its height in device pixels over the lens's)
  const vh = (typeof innerHeight !== 'undefined' ? innerHeight : 720) * (typeof renderer !== 'undefined' && renderer.getPixelRatio ? renderer.getPixelRatio() : 1) * 0.5 / Math.tan(((camera.fov || 60) * Math.PI) / 360);
  for (const R of __wkRings) {
    if (!R.m.visible) continue;
    const age = t - R.t0;
    if (age >= __WK.qb.life || age < 0) { R.m.visible = false; continue; }
    R.U.uAge.value = age; R.U.uViewH.value = vh;
  }
}
window.__mojWake = { trails: __wkTrails, rings: __wkRings };
`;
}
