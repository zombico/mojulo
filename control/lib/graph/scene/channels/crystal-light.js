import { rigKernel } from '../crystal-rig.js';
import { safeJson } from '../emit-util.js';

// In-page script: the crystal light channel (crystal-rig R2) — lamps whose beams pass through the page's crystals, each
// gem an operator (crystal-rig.js), re-solved every frame from __mojStep(t). Stones are posed from their group mesh's
// matrixWorld, so a mover that turns a crystal re-aims its light. Beams stop at the page's own geometry: an occluder
// grid built once from the static non-crystal meshes (the kernel's buildGrid), plus a live raycast against groups a
// mover drives (a door that opens lets the light through). Drawn with built-in materials only (the page's
// logarithmicDepthBuffer): the beams as one preallocated buffer of crossed additive ribbons, pools and glows as one
// additive InstancedMesh each, lamps and targets as a few meshes. Targets raise `lit` / `dark` on the events bus when
// what they catch satisfies what they want, and step a mover (`toggles`: a door) on each edge. Only emitted when the
// payload carries a resolved `crystalLight` rig.
export function crystalLightChannelScript(rig) {
  return `
// ---- crystal light (opt-in): lamps through crystals, each gem an operator ----
const __CLR = ${safeJson(rig)};
const __CLK = (${rigKernel.toString()})();
const __clrStones = __CLR.stones.map((s) => ({ ...s, mesh: meshes[s.group] || null }));
const __clrGrid = (() => {
  const skip = new Set([...__CLR.stones.map((s) => s.group), ...(__CLR.dynamic || [])]); const tri = []; const v = new THREE.Vector3();
  for (const [name, m] of Object.entries(meshes)) {
    if (skip.has(name) || !m.geometry || !m.geometry.attributes.position) continue;
    m.updateMatrixWorld(true); const P = m.geometry.attributes.position; const I = m.geometry.index;
    const n = I ? I.count : P.count; const inst = m.isInstancedMesh ? m.count : 1; if (tri.length / 9 + (n / 3) * inst > 400000) continue;   // a budget, not a wall
    const M = new THREE.Matrix4(), W = new THREE.Matrix4();
    for (let k = 0; k < inst; k++) {
      if (m.isInstancedMesh) { m.getMatrixAt(k, M); W.multiplyMatrices(m.matrixWorld, M); } else W.copy(m.matrixWorld);
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, I ? I.getX(i) : i).applyMatrix4(W); tri.push(v.x, v.y, v.z); }
    }
  }
  return __CLK.buildGrid(tri);
})();
const __clrDyn = (__CLR.dynamic || []).map((g) => meshes[g]).filter(Boolean);
const __clrRay = new THREE.Raycaster(); const __clrO = new THREE.Vector3(), __clrD = new THREE.Vector3();
function __clrWall(o, d, tMax) {
  let best = __clrGrid.hit(o, d, tMax);
  if (__clrDyn.length) {
    __clrRay.set(__clrO.set(o[0], o[1], o[2]), __clrD.set(d[0], d[1], d[2])); __clrRay.far = best ? best.t : tMax;
    const h = __clrRay.intersectObjects(__clrDyn, false)[0];
    if (h && h.face) { const nn = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (nn.x * d[0] + nn.y * d[1] + nn.z * d[2] > 0) nn.negate(); best = { t: h.distance, n: [nn.x, nn.y, nn.z] }; }
  }
  return best;
}
const __clrRadial = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); return t; })();
const __clrRing = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 50, 0, 2 * Math.PI); g.stroke();
  g.lineWidth = 3; g.globalAlpha = 0.5; g.beginPath(); g.arc(64, 64, 34, 0, 2 * Math.PI); g.stroke(); return new THREE.CanvasTexture(cv); })();
const __clrAdd = (map, extra) => new THREE.MeshBasicMaterial(Object.assign({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, extra || {}));
// beams: crossed ribbons, alpha 1 on the axis and 0 at the edge, one preallocated buffer
const __clrCap = Math.max(8, __CLR.budget.beams | 0);
const __clrPos = new Float32Array(__clrCap * 24 * 3), __clrCol = new Float32Array(__clrCap * 24 * 4);
const __clrBeamGeo = new THREE.BufferGeometry();
__clrBeamGeo.setAttribute('position', new THREE.BufferAttribute(__clrPos, 3).setUsage(THREE.DynamicDrawUsage));
__clrBeamGeo.setAttribute('color', new THREE.BufferAttribute(__clrCol, 4).setUsage(THREE.DynamicDrawUsage));
const __clrBeams = new THREE.Mesh(__clrBeamGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
__clrBeams.frustumCulled = false; __clrBeams.renderOrder = 3; scene.add(__clrBeams);
const __clrPools = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 24), __clrAdd(__clrRadial, { polygonOffset: true, polygonOffsetFactor: -4 }), __clrCap);
const __clrGlows = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), __clrAdd(__clrRadial), __clrCap * 4 + __CLR.lamps.length);
for (const im of [__clrPools, __clrGlows]) { im.frustumCulled = false; im.renderOrder = 3; im.count = 0; im.setColorAt(0, new THREE.Color(0, 0, 0)); scene.add(im); }
for (const l of __CLR.lamps) { const m = new THREE.Mesh(new THREE.SphereGeometry(l.width * 2.2, 14, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(l.color[0], l.color[1], l.color[2]) })); m.position.set(l.o[0], l.o[1], l.o[2]); scene.add(m); }
const __clrTargets = (__CLR.targets || []).map((g) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * g.r, 2 * g.r), __clrAdd(__clrRing)); m.position.set(g.at[0], g.at[1], g.at[2]); m.renderOrder = 3; scene.add(m); return { g, m, on: false }; });
const __clrHue = { white: [1, 1, 1], red: [1, 0.05, 0.03], orange: [1, 0.35, 0], yellow: [1, 0.85, 0.05], green: [0.1, 1, 0.15], cyan: [0, 0.9, 1], blue: [0.1, 0.25, 1], violet: [0.55, 0.1, 1] };
const __clrM = new THREE.Matrix4(), __clrQ = new THREE.Quaternion(), __clrS = new THREE.Vector3(), __clrP = new THREE.Vector3(), __clrC = new THREE.Color(), __clrZ = new THREE.Vector3(0, 0, 1), __clrN = new THREE.Vector3();
const __clrV = new THREE.Vector3(), __clrA = new THREE.Vector3(), __clrX = new THREE.Vector3(), __clrNM = new THREE.Matrix3();
let stepCrystalLight = (tMs) => {
  const t = tMs / 1000; const G = __CLR.gain;
  const stones = __clrStones.map((s) => {
    if (!s.mesh) return s; s.mesh.updateMatrixWorld(true); const W = s.mesh.matrixWorld; __clrNM.getNormalMatrix(W);
    __clrV.set(s.at[0], s.at[1], s.at[2]).applyMatrix4(W); __clrA.set(s.axis[0], s.axis[1], s.axis[2]).applyMatrix3(__clrNM).normalize(); __clrX.set(s.x[0], s.x[1], s.x[2]).applyMatrix3(__clrNM).normalize();
    return Object.assign({}, s, { at: [__clrV.x, __clrV.y, __clrV.z], axis: [__clrA.x, __clrA.y, __clrA.z], x: [__clrX.x, __clrX.y, __clrX.z], r: s.r * W.getMaxScaleOnAxis() });
  });
  const res = __CLK.solve({ lamps: __CLR.lamps, stones, targets: __CLR.targets, wall: __clrWall, t, budget: __CLR.budget });
  let v = 0;
  for (const s of res.segments) {
    const k = __CLK.pulseAt(s.pulse, t); const br = (0.22 + 0.95 * s.power) * k * G; if (br < 0.003 || v >= __clrCap * 24) continue;
    const a = s.a, b = s.b; const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const L = Math.hypot(dx, dy, dz) || 1; const u = [dx / L, dy / L, dz / L];
    const q = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; let p1 = [u[1] * q[2] - u[2] * q[1], u[2] * q[0] - u[0] * q[2], u[0] * q[1] - u[1] * q[0]]; const l1 = Math.hypot(p1[0], p1[1], p1[2]); p1 = p1.map((x) => x / l1);
    const p2 = [u[1] * p1[2] - u[2] * p1[1], u[2] * p1[0] - u[0] * p1[2], u[0] * p1[1] - u[1] * p1[0]];
    const w = s.width * (0.55 + 0.8 * Math.sqrt(s.power)); const C = [s.color[0] * br, s.color[1] * br, s.color[2] * br];
    for (const side of [p1, p2]) for (const h of [-1, 1]) {
      const e = [side[0] * w * h, side[1] * w * h, side[2] * w * h];
      const quad = [[a, 1], [b, 1], [[b[0] + e[0], b[1] + e[1], b[2] + e[2]], 0], [a, 1], [[b[0] + e[0], b[1] + e[1], b[2] + e[2]], 0], [[a[0] + e[0], a[1] + e[1], a[2] + e[2]], 0]];
      for (const [p, al] of quad) { __clrPos.set(p, v * 3); __clrCol[v * 4] = C[0]; __clrCol[v * 4 + 1] = C[1]; __clrCol[v * 4 + 2] = C[2]; __clrCol[v * 4 + 3] = al; v++; }
    }
  }
  __clrBeamGeo.setDrawRange(0, v); __clrBeamGeo.attributes.position.needsUpdate = true; __clrBeamGeo.attributes.color.needsUpdate = true;
  let np = 0;
  for (const p of res.pools) {
    if (np >= __clrCap) break; const k = __CLK.pulseAt(p.pulse, t); if (k < 0.01) continue; const r = p.width * 3 * (0.6 + Math.sqrt(p.power)) * 2.2;
    __clrN.set(p.n[0], p.n[1], p.n[2]); __clrQ.setFromUnitVectors(__clrZ, __clrN); __clrP.set(p.p[0] + p.n[0] * r * 0.02, p.p[1] + p.n[1] * r * 0.02, p.p[2] + p.n[2] * r * 0.02);
    __clrM.compose(__clrP, __clrQ, __clrS.set(r, r, r)); __clrPools.setMatrixAt(np, __clrM);
    const br = (0.35 + 1.1 * p.power) * k * G; __clrPools.setColorAt(np, __clrC.setRGB(p.color[0] * br, p.color[1] * br, p.color[2] * br)); np++;
  }
  __clrPools.count = np; __clrPools.instanceMatrix.needsUpdate = true; if (__clrPools.instanceColor) __clrPools.instanceColor.needsUpdate = true;
  let ng = 0; const cam = camera.position;
  const glow = (p, color, power, size, k) => {
    if (ng >= __clrGlows.instanceMatrix.count || k < 0.01) return; const dx = cam.x - p[0], dy = cam.y - p[1], dz = cam.z - p[2]; const dl = Math.hypot(dx, dy, dz) || 1; const lift = Math.min(size * 1.2, dl * 0.5);
    __clrP.set(p[0] + dx / dl * lift, p[1] + dy / dl * lift, p[2] + dz / dl * lift); __clrM.compose(__clrP, camera.quaternion, __clrS.set(size, size, size)); __clrGlows.setMatrixAt(ng, __clrM);
    const br = Math.min(1.5, 0.3 + 2 * power) * k * G; __clrGlows.setColorAt(ng, __clrC.setRGB(color[0] * br, color[1] * br, color[2] * br)); ng++;
  };
  for (const g of res.glows) { const base = g.stone != null ? stones[g.stone].r : g.target != null ? (__CLR.targets.find((x) => x.id === g.target) || { r: __CLR.width * 4 }).r : __CLR.width * 4; glow(g.p, g.color, g.power, base * (0.6 + 2.5 * Math.sqrt(g.power)), __CLK.pulseAt(g.pulse, t)); }
  for (const l of __CLR.lamps) glow(l.o, l.color, 0.6, l.width * 9, 1);
  __clrGlows.count = ng; __clrGlows.instanceMatrix.needsUpdate = true; if (__clrGlows.instanceColor) __clrGlows.instanceColor.needsUpdate = true;
  const fired = [];
  for (const T of __clrTargets) {
    const got = res.lit[T.g.id]; const on = __CLK.satisfied(got, T.g.want);
    T.m.quaternion.copy(camera.quaternion);
    const hint = T.g.want && T.g.want.color ? __clrHue[T.g.want.color] : [0.55, 0.6, 0.7]; const c = on ? hint : hint.map((x) => x * 0.28);
    T.m.material.color.setRGB(c[0] * G, c[1] * G, c[2] * G);
    if (on !== T.on) {
      T.on = on; const names = got ? Object.keys(got.colors).sort((a, b) => got.colors[b] - got.colors[a]) : []; fired.push(on ? { type: 'lit', source: T.g.id, color: names[0] || 'white' } : { type: 'dark', source: T.g.id });
      if (T.g.toggles && typeof window.__mojToggle === 'function') window.__mojToggle(T.g.toggles, on ? 1 : -1);   // a lit target opens its door
    }
  }
  if (fired.length && window.__mojBus && window.__mojBus.bus) window.__mojBus.bus.processEvents(window.__mojBus.state, fired);
  window.__mojCrystalLight = { stats: res.stats, lit: Object.fromEntries(__clrTargets.map((T) => [T.g.id, T.on])), beams: v / 24, pools: np, glows: ng, occluder: { tris: __clrGrid.tris, cells: __clrGrid.cells } };
};
`;
}
