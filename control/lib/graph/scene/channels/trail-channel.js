import { safeJson } from '../emit-util.js';

/**
 * trail-channel — the page's side of a weapon's SWING TRAIL (a composed style floor's `trail`, scene/juice-style.js): every
 * character's hands are watched; what a hand holds reaches furthest from its wrist at the blade's tip (the hand's bone
 * mesh carries what it grips, in the bone's own frame, so its farthest point IS the tip, and an empty child there rides
 * every clip, as the muzzle locator does). While the tip moves faster than the game type's floor and the look's share of
 * the swing's own running peak speed (cel: only its fastest drawings), the swept blade is
 * kept, each sample the blade from `base` (a share of the way down from the tip) to the tip, and drawn as one strip
 * from the newest sample to the oldest (each span between two samples bent along a Catmull-Rom curve through its
 * neighbours, so a fast swing sampled a few times still sweeps an arc, not a wedge), gone after `life` seconds:
 *
 *   glow    (isekai) added light: white at the edge the tip cut, its colour toward the hilt, fading with age; glints shed
 *           off the tip
 *   cel     (cel) flat hard bands by age, newest light, then the colour, then a deep tone of it, cut off hard; sampled on
 *           the floor's drawings a second (held on twos)
 *   sheen   (material) a short faint added smear, the colour barely there
 *
 * A hand holding nothing (its farthest point within a hand's reach of its wrist) leaves none. Emitted only where a
 * composed floor carries a trail; the characters' bodies are exposed for it (effect-rim.js bodiesWanted).
 *
 *   swingTrailScript(trail)   the page's block: __stepSwing()
 */
export function swingTrailScript(trail) {
  const N = 48;
  return `
// --- swing trails: a weapon's swept blade, drawn in the look's way (scene/channels/trail-channel.js) ---
const __swT = ${safeJson(trail)};
const __swL = [], __swDone = new WeakSet(), __SW_N = ${N}, __SW_S = 5, __SW_M = (${N} - 1) * 5 + 1;
// a Catmull-Rom point between b and c at f (a and d its neighbours): the arc through the samples
const __swCR = (a, b, c, d, f) => { const f2 = f * f, f3 = f2 * f; return [0, 1, 2].map((i) => 0.5 * (2 * b[i] + (-a[i] + c[i]) * f + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * f2 + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * f3)); };
const __swV = new THREE.Vector3(), __swW = new THREE.Vector3();
const __swCol = (() => { const c = __swT.color, lite = c.map((x) => x + (1 - x) * 0.6), deep = c.map((x) => x * 0.55); return { c, lite, deep }; })();
${trail.glints ? `const __swGlint = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.6)'); g.addColorStop(0.4, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 6 : 31; x.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a)); } x.closePath(); x.fill(); return new THREE.CanvasTexture(cv); })();` : ''}
function __swMake(m) {
  const P = m.geometry.attributes.position; let best = 0, bi = -1;
  for (let i = 0; i < P.count; i++) { const d = P.getX(i) ** 2 + P.getY(i) ** 2 + P.getZ(i) ** 2; if (d > best) { best = d; bi = i; } }
  if (bi < 0 || Math.sqrt(best) < 0.32) return null;   // an empty hand: nothing to trail
  const tip = new THREE.Object3D(); tip.position.set(P.getX(bi), P.getY(bi), P.getZ(bi)); m.add(tip);
  const g = new THREE.BufferGeometry(), idx = [];
  for (let k = 0; k < __SW_M - 1; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(__SW_M * 6), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(__SW_M * 8), 4)); g.setIndex(idx); g.setDrawRange(0, 0);
  const add = __swT.kind !== 'cel';
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  mat.userData.__fire = true; mat.userData.__fxl = true;
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.raycast = function () {}; mesh.renderOrder = 8; scene.add(mesh);
  const L = { m, tip, mesh, pts: [], last: null, lastT: null, glints: [] };${trail.glints ? `
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: __swGlint, color: new THREE.Color(__swCol.lite[0], __swCol.lite[1], __swCol.lite[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.material.userData.__fire = true; s.visible = false; s.raycast = function () {}; scene.add(s); L.glints.push({ s, t0: -9, p: [0, 0, 0] }); }` : ''}
  return L;
}
let __swSeen = -1, __swTick = -1, __swGi = 0;
function __stepSwing() {
  const W = window.__mojCtrl && window.__mojCtrl.world, B = window.__mojCtrl && window.__mojCtrl.bodies; if (!W || !B) return;
  let n = 0; for (const id in B) n += B[id] ? 1 : 0;
  if (n !== __swSeen) {
    __swSeen = n;
    for (const id in B) { const R = B[id] && B[id].userData && B[id].userData.rigFig; if (!R) continue;
      R.fig.bones.forEach((bn, bi) => { const m = R.boneMeshes[bi]; if (!m || __swDone.has(m) || !/^hand[LR]$/.test(bn.id)) return; __swDone.add(m); const L = __swMake(m); if (L) __swL.push(L); }); }
  }
  const now = W.time || 0;${trail.fps ? `
  // held on the floor's drawings a second: a new sample (and a redraw) only on a new drawing
  const tick = Math.floor(now * __swT.fps); if (tick === __swTick) return; __swTick = tick;` : ''}
  for (const L of __swL) {
    L.m.updateMatrixWorld(true); L.tip.getWorldPosition(__swW); __swV.setFromMatrixPosition(L.m.matrixWorld);
    const tip = [__swW.x, __swW.y, __swW.z], dt = L.lastT == null ? 0 : now - L.lastT;
    const speed = L.last && dt > 0 ? Math.hypot(tip[0] - L.last[0], tip[1] - L.last[1], tip[2] - L.last[2]) / dt : 0;
    L.last = tip; L.lastT = now;
    const b = [tip[0] + (__swV.x - tip[0]) * (1 - __swT.base), tip[1] + (__swV.y - tip[1]) * (1 - __swT.base), tip[2] + (__swV.z - tip[2]) * (1 - __swT.base)];
    // fast enough: past the game type's floor and the look's share of this swing's running peak (decaying, so the next
    // swing finds its own)
    L.peak = Math.max(speed, (L.peak || 0) * Math.exp(-dt / 2));
    const fast = speed >= __swT.min && speed >= __swT.fast * L.peak;
    if (fast) {
      // a trail beginning starts where the blade was a sample ago, so the first span already sweeps (on twos, a long one)
      if (!L.moving && L.prev) L.pts.unshift({ ...L.prev, t0: now });
      L.pts.unshift({ b, t: tip, t0: now }); if (L.pts.length > __SW_N) L.pts.length = __SW_N;
    }
    L.moving = fast; L.prev = { b, t: tip };${trail.glints ? `
    if (fast && speed >= 0.7 * L.peak && L.glints.length) { const G = L.glints[__swGi++ % L.glints.length]; G.t0 = now; G.p = tip; }
    for (const G of L.glints) { const u = (now - G.t0) / 0.45; G.s.visible = u >= 0 && u < 1; if (G.s.visible) { G.s.position.set(G.p[0], G.p[1], G.p[2] + 0.2 * u); G.s.scale.setScalar(0.18 * (1 - u * 0.5)); G.s.material.opacity = 1 - u; } }` : ''}
    while (L.pts.length && now - L.pts[L.pts.length - 1].t0 > __swT.life) L.pts.pop();
    const pos = L.mesh.geometry.attributes.position.array, col = L.mesh.geometry.attributes.color.array, P = L.pts, n = P.length;
    // the samples bent into an arc: __SW_S points a span, each the blade's base and tip on the curve, its age between
    const R = [];
    for (let i = 0; i < n; i++) {
      if (i === n - 1) { R.push(P[i]); break; }
      const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(n - 1, i + 2)];
      for (let s = 0; s < __SW_S; s++) { const f = s / __SW_S; R.push(s === 0 ? b : { b: __swCR(a.b, b.b, c.b, d.b, f), t: __swCR(a.t, b.t, c.t, d.t, f), t0: b.t0 + (c.t0 - b.t0) * f }); }
    }
    const k = R.length;
    for (let i = 0; i < k; i++) {
      const q = R[i], u = Math.min(1, (now - q.t0) / __swT.life);
      pos.set([...q.b, ...q.t], i * 6);
      let cb, ct, a;
      if (__swT.kind === 'cel') { const band = u < 0.34 ? __swCol.lite : u < 0.67 ? __swCol.c : __swCol.deep; cb = band; ct = band; a = __swT.alpha; }
      else if (__swT.kind === 'glow') { cb = __swCol.c; ct = __swCol.lite.map((x) => x + (1 - x) * 0.5); a = __swT.alpha * (1 - u) ** 1.5; }
      else { cb = __swCol.c; ct = __swCol.lite; a = __swT.alpha * (1 - u); }
      col.set([...cb, a * (__swT.kind === 'cel' ? 1 : 0.35), ...ct, a], i * 8);
    }
    L.mesh.geometry.setDrawRange(0, Math.max(0, k - 1) * 6);
    L.mesh.geometry.attributes.position.needsUpdate = true; L.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
window.__mojSwing = { hands: () => __swL.length };`;
}
