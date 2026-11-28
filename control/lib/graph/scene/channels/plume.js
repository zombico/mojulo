/**
 * A PLUME — a prop's drive lit (a pusher rocket set on a rock, the Roman Candles): the frames' plasma boost
 * (controllable/frame-wake.js, frame-flame.js) at a ship's scale. As the level's bus says `ignite:<who>`, its bell lights:
 * a white-hot core inside layers of its plasma's colour, flickering, out of the bell along its axis; pulse beads running
 * up it; at the moment of ignition a ring of plasma bits thrown out across the ground from the bell and drifting back,
 * and a flash; a light of its colour on the ground round it. It burns on. Heard: the ignition's roar (a noise swept down
 * over a deep rumble) and the burn held under it. Read off the world each frame (where the body stands); emitted only
 * on a page whose level names plumes: every other page byte-identical.
 *
 *   PLUME                  the look and the sound: { length (m a metre of bell), core, layers, flicker, beads, burst: {
 *                          bits, ring: [m, m], life, size }, light, gain }
 *   plumeScript(plumes)    → in-page; plumes: [{ who, at: [x, y, z] (the bell's mouth off the body's foot), r (its
 *                          radius), dir: [x, y, z], colour }]
 *   window.__mojPlume      { lit: [who…] } (a probe's)
 */
import { safeJson } from '../emit-util.js';

export const PLUME = Object.freeze({
  // (each layer [its length's share, its opacity, its colour (null: the plasma's), its radius at the bell and at its end,
  // shares of the bell's]: a white core tapering inside two of the plasma's colour, widening as it leaves, as in vacuum)
  length: 22, layers: Object.freeze([[0.4, 1, '#ffffff', 0.6, 0.25], [0.75, 0.8, null, 0.9, 1.8], [1, 0.45, null, 1, 3.2]]), flicker: 0.08,
  beads: 22, burst: Object.freeze({ bits: 1400, ring: Object.freeze([3, 18]), life: 3.2, size: 1.4 }), light: 6, gain: 0.22,
});

export function plumeScript(plumes) {
  return `
// A PLUME (plume.js): a prop's drive lit, the frames' plasma boost at a ship's scale
(function () {
  const PL = ${safeJson(plumes)}, K = ${safeJson(PLUME)};
  window.__mojPlume = { lit: [] };
  // (a round soft dot for the bits and beads)
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext && c.getContext('2d'); if (g) { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); } return new THREE.CanvasTexture(c); })();
  const lit = new Map();
  function light(P) {
    const R = P.r, L = R * K.length, col = new THREE.Color(P.colour), grp = new THREE.Group(); grp.frustumCulled = false;
    // (the layers: a white core inside its colour, each a cone from the bell along its axis, open, additive)
    // (each layer soft: brightest at the bell and fading along it, thin at its edges as seen side on, so it reads as a
    // glow, not a cone; the page's depth logarithmic, written as the ground's is)
    const VS = '#include <common>\\n#include <logdepthbuf_pars_vertex>\\nvarying vec2 vU; varying vec3 vN; varying vec3 vV; void main() { vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv;\\n#include <logdepthbuf_vertex>\\n}';
    const FS = '#include <logdepthbuf_pars_fragment>\\nuniform vec3 uC; uniform float uOp; varying vec2 vU; varying vec3 vN; varying vec3 vV; void main() {\\n#include <logdepthbuf_fragment>\\nfloat along = pow(1.0 - vU.y, 1.4); float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); gl_FragColor = vec4(uC, clamp(uOp * along * (0.25 + 0.75 * edge), 0.0, 1.0)); }';
    const cones = K.layers.map(([len, op, c, r0, r1]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(R * r1, R * r0, L * len, 24, 1, true), new THREE.ShaderMaterial({ uniforms: { uC: { value: c ? new THREE.Color(c) : col }, uOp: { value: op } }, vertexShader: VS, fragmentShader: FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.geometry.translate(0, L * len / 2, 0); m.raycast = function () {}; grp.add(m); return { m, len }; });
    // (beads: the drive's pulses running up the plume)
    const bg = new THREE.BufferGeometry(), bp = new Float32Array(K.beads * 3); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    const beads = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xffffff, map: dot, size: R * 0.9, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    beads.frustumCulled = false; grp.add(beads);
    // (the burst: a ring of bits thrown out from the bell across the ground, slowing, drifting back, going out)
    const N = K.burst.bits, sg = new THREE.BufferGeometry(), sp = new Float32Array(N * 3), sv = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.2, s = K.burst.ring[0] + (K.burst.ring[1] - K.burst.ring[0]) * (0.5 + 0.5 * Math.sin(i * 78.233)); sv.push([Math.cos(a) * s * R, Math.sin(a) * s * R, (0.5 + 0.5 * Math.sin(i * 3.7)) * R * 1.5]); }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const burst = new THREE.Points(sg, new THREE.PointsMaterial({ color: col, map: dot, size: K.burst.size * R * 0.6, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    burst.frustumCulled = false;
    const glow = new THREE.PointLight(col, 0, R * 80, 1.6);
    scene.add(grp); scene.add(burst); scene.add(glow);
    return { P, grp, cones, beads, bp, burst, sp, sv, glow, t0: performance.now() / 1000 };
  }
  // (heard: the roar of its lighting over a deep rumble, then its burn held under it)
  let ctx = null, held = null;
  function roar() {
    try {
      if (typeof __beatsMuted !== 'undefined' && __beatsMuted) return;
      const c = (typeof __beatsCtx !== 'undefined' && __beatsCtx) || ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
      if (c.state === 'suspended') c.resume().catch(() => {});
      const t = c.currentTime + 0.02, n = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = n.getChannelData(0);
      let seed = 7; for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
      const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = n; bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(180, t + 2.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(K.gain * 1.6, t + 0.06); g.gain.exponentialRampToValueAtTime(K.gain * 0.5, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
      src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t); src.stop(t + 3);
      for (const [hz, k] of [[34, 1], [51, 0.6]]) { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(hz * 1.4, t); o.frequency.exponentialRampToValueAtTime(hz, t + 0.8); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(K.gain * k, t + 0.1); og.gain.exponentialRampToValueAtTime(0.0001, t + 3.4); o.connect(og); og.connect(c.destination); o.start(t); o.stop(t + 3.5); }
      if (!held) {
        const hs = c.createBufferSource(), lp = c.createBiquadFilter(), hg = c.createGain();
        hs.buffer = n; hs.loop = true; lp.type = 'lowpass'; lp.frequency.value = 320; hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(K.gain * 0.35, t + 1.5);
        hs.connect(lp); lp.connect(hg); hg.connect(c.destination); hs.start(t); held = { hs, hg };
      }
    } catch (e) { /* (no audio: it is seen alone) */ }
  }
  function frame() {
    const W = window.__mojCtrl && window.__mojCtrl.world, now = performance.now() / 1000;
    for (const L of lit.values()) {
      const e = W && W.byId[L.P.who]; if (!e) continue;
      const p = e.transform.pos, at = [p[0] + L.P.at[0], p[1] + L.P.at[1], p[2] + L.P.at[2]], u = now - L.t0, R = L.P.r, Ln = R * K.length;
      L.grp.position.set(at[0], at[1], at[2]); L.grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(L.P.dir[0], L.P.dir[1], L.P.dir[2]));
      // (lit over its first moment, then flickering at its length)
      const up = Math.min(1, u / 0.5);
      L.cones.forEach((C, i) => { const f = 1 + K.flicker * Math.sin(now * (23 + i * 7)) * Math.sin(now * (9.7 + i)); C.m.scale.set(1, up * f, 1); });
      for (let i = 0; i < K.beads; i++) { const s = ((now * 0.9 + i / K.beads) % 1) * up, w = R * 0.25 * Math.sin(i * 4.1 + now * 6); L.bp[i * 3] = w; L.bp[i * 3 + 1] = s * Ln * 0.8; L.bp[i * 3 + 2] = w * 0.6; }
      L.beads.geometry.attributes.position.needsUpdate = true;
      // (the burst: out across the ground from the bell's foot, slowing, falling back toward it, going out)
      const b = Math.min(1, u / K.burst.life), go = 1 - Math.pow(1 - b, 3), back = Math.max(0, b - 0.6) * 0.25;
      if (b < 1) { for (let i = 0; i < L.sv.length; i++) { const v = L.sv[i]; L.sp[i * 3] = p[0] + v[0] * (go - back); L.sp[i * 3 + 1] = p[1] + v[1] * (go - back); L.sp[i * 3 + 2] = p[2] + R * 0.6 + v[2] * go; } L.burst.geometry.attributes.position.needsUpdate = true; L.burst.material.opacity = 1 - b; }
      else if (L.burst.visible) L.burst.visible = false;
      L.glow.position.set(at[0], at[1], at[2] + R * 3); L.glow.intensity = K.light * (u < 0.25 ? 3 - u * 8 : 1) * (0.85 + 0.15 * Math.sin(now * 31));
    }
    requestAnimationFrame(frame);
  }
  let seen = 0;
  (function watch() {
    const B = window.__mojBus, log = B && B.state && B.state.log;
    if (log) {
      if (log.length < seen) seen = 0;
      for (; seen < log.length; seen++) { const ty = log[seen] && log[seen].type; if (typeof ty === 'string' && ty.indexOf('ignite:') === 0) { const who = ty.slice(7), P = PL.find((x) => x.who === who); if (P && !lit.has(who)) { lit.set(who, light(P)); window.__mojPlume.lit.push(who); roar(); } } }
    }
    requestAnimationFrame(watch);
  })();
  requestAnimationFrame(frame);
})();
`;
}
