// In-page script: the VAYO TRAIL (worlds/controllable/vayo-move.js). Only emitted into a page whose world has a hero with
// a vayo move (a special ability that moves it on its own air), so every other page keeps its bytes.
//   · a hero moving on its vayo leaves a ribbon of its element's colour along the path its body took (the last few tenths
//     of a second), facing the eye, brightest where it is now and fading behind; it thickens and whitens as the move's
//     tier passes the play cap (`e.vayo.over`: the fiction it is held back from shows here, not in metres per second);
//   · a move whose fiction passes the speed of sound sets off a ring (the boom) where it starts;
//   · stopped, the ribbon drains away.
// Reads the world's entities (`e.vayo`, set by the runtime) each frame: `__updateVayo(dt)` from the controllable step.
export function vayoTrailScript() {
  return `
// --- vayo trail (rupa-vayo: vayo-move.js) ---
const __VT_N = 28, __vtTrails = new Map(), __vtBooms = [];
const __vtMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function __vtTrail(e) {
  let T = __vtTrails.get(e.id);
  if (T) return T;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(__VT_N * 2 * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(__VT_N * 2 * 3), 3));
  const idx = []; for (let i = 0; i < __VT_N - 1; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  const m = new THREE.Mesh(g, __vtMat); m.frustumCulled = false; m.renderOrder = 7; scene.add(m);
  T = { m, g, pts: [], col: [1, 1, 1], over: 0 };
  __vtTrails.set(e.id, T);
  return T;
}
const __vtA = new THREE.Vector3(), __vtB = new THREE.Vector3(), __vtS = new THREE.Vector3(), __vtV = new THREE.Vector3();
function __updateVayo(dt) {
  for (const e of __world.entities) {
    const V = e.vayo, T = V || __vtTrails.has(e.id) ? __vtTrail(e) : null;
    if (!T) continue;
    if (V) {
      const p = e.transform.pos, eye = (e.rule && e.rule.eye) || 0;
      T.pts.unshift([p[0], p[1], p[2] - 0.45 * eye]); T.col = V.color || T.col; T.over = V.over || 0;
      if (T.pts.length > __VT_N) T.pts.length = __VT_N;
      // the boom: a move whose fiction passes sound, at its start
      if (!T.live && V.fiction > 343) __vtBoom(p, T.col);
      T.live = true;
    } else { T.live = false; T.pts.splice(Math.max(1, T.pts.length - 3)); if (T.pts.length <= 1) T.pts.length = 0; }
    const P = T.g.attributes.position.array, C = T.g.attributes.color.array, n = T.pts.length;
    const w = 0.18 + 0.4 * T.over, white = 0.35 + 0.5 * T.over;
    for (let i = 0; i < __VT_N; i++) {
      const q = T.pts[Math.min(i, Math.max(0, n - 1))] || [0, 0, -1e6], q2 = T.pts[Math.min(i + 1, Math.max(0, n - 1))] || q;
      __vtA.set(q[0], q[1], q[2]); __vtB.set(q2[0], q2[1], q2[2]);
      __vtS.subVectors(__vtA, __vtB); if (__vtS.lengthSq() < 1e-10) __vtS.set(1, 0, 0);
      __vtV.subVectors(__vtA, camera.position); __vtS.cross(__vtV).normalize();
      const k = i < n ? 1 - i / Math.max(1, n - 1) : 0, ww = w * (0.3 + 0.7 * k);
      P.set([__vtA.x + __vtS.x * ww, __vtA.y + __vtS.y * ww, __vtA.z + __vtS.z * ww, __vtA.x - __vtS.x * ww, __vtA.y - __vtS.y * ww, __vtA.z - __vtS.z * ww], 6 * i);
      const c = T.col.map((x) => (x + (1 - x) * white * k) * k * 0.9);
      C.set([...c, ...c], 6 * i);
    }
    T.g.attributes.position.needsUpdate = T.g.attributes.color.needsUpdate = true;
    T.m.visible = n > 1;
  }
  for (let i = __vtBooms.length - 1; i >= 0; i--) {
    const B = __vtBooms[i]; B.t += dt;
    const u = B.t / 0.45; if (u >= 1) { scene.remove(B.m); B.m.geometry.dispose(); B.m.material.dispose(); __vtBooms.splice(i, 1); continue; }
    B.m.scale.setScalar(0.5 + 9 * u); B.m.material.opacity = 0.7 * (1 - u) * (1 - u); B.m.lookAt(camera.position);
  }
}
function __vtBoom(p, col) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6 + 0.4 * col[0], 0.6 + 0.4 * col[1], 0.6 + 0.4 * col[2]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.position.set(p[0], p[1], p[2]); m.renderOrder = 7; scene.add(m);
  __vtBooms.push({ m, t: 0 });
}
window.__mojVayo = { trails: __vtTrails, booms: __vtBooms };
`;
}
