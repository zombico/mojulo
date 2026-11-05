// In-page script: the KNOCKBACK juice (worlds/controllable/knock.js). Only emitted into a page whose world has knockback
// (a level's `knockback`, or attacks carrying kinetic or impact energy), so every other page keeps its bytes.
//   · an IMPACT on the ground throws a dust ring out along it, as wide as the ground's share of its energy makes it (the
//     cube root of its joules: a slam's a metre or two, a big blast's several); a SLAM and a WALL a smaller puff;
//   · a body sliding after a throw kicks dust up under it as it goes, and a LANDING a puff where it comes down.
// Reads the world's records (`world.knock.log`, seq-keyed) and its thrown bodies (`e.knock`) each frame:
// `__updateKnock(dt)` from the controllable step.
export function knockFxScript() {
  return `
// --- knockback juice (knock.js) ---
const __kfRings = [], __kfPuffs = [], __kfDust = new THREE.Color(0.62, 0.57, 0.5);
let __kfSeen = -1;
const __kfPuffGeo = new THREE.CircleGeometry(1, 16);
function __kfRing(at, r, life) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 48), new THREE.MeshBasicMaterial({ color: __kfDust, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(at[0], at[1], at[2] + 0.05); m.renderOrder = 6; scene.add(m);
  __kfRings.push({ m, r, t: 0, life });
}
function __kfPuff(at, s) {
  const m = new THREE.Mesh(__kfPuffGeo, new THREE.MeshBasicMaterial({ color: __kfDust, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(at[0], at[1], at[2] + 0.1); m.renderOrder = 6; scene.add(m);
  __kfPuffs.push({ m, s, t: 0, life: 0.7 });
}
function __updateKnock(dt) {
  const K = __world.knock;
  if (!K) return;
  for (const L of K.log) {
    if (L.seq <= __kfSeen) continue;
    __kfSeen = L.seq;
    if (L.kind === 'impact') __kfRing(L.at, Math.max(0.8, 0.12 * Math.cbrt(L.ground || 0)), 0.6);
    else if (L.kind === 'slam' || L.kind === 'wall') __kfRing(L.at, 1.2, 0.4);
    else if (L.kind === 'land') __kfPuff(L.at, 0.5 + 0.05 * (L.v || 0));
  }
  // what slides kicks dust up under it
  for (const e of __world.entities) {
    const T = e.knock; if (!T || T.air) continue;
    const sp = Math.hypot(T.v[0], T.v[1]); if (sp < 1) continue;
    T.puff = (T.puff || 0) - dt;
    if (T.puff <= 0) { T.puff = 0.08; const p = e.transform.pos, eye = (e.rule && e.rule.eye) || 0; __kfPuff([p[0], p[1], p[2] - eye], 0.25 + 0.04 * sp); }
  }
  for (let i = __kfRings.length - 1; i >= 0; i--) {
    const R = __kfRings[i]; R.t += dt; const u = R.t / R.life;
    if (u >= 1) { scene.remove(R.m); R.m.geometry.dispose(); R.m.material.dispose(); __kfRings.splice(i, 1); continue; }
    R.m.scale.setScalar(R.r * (0.3 + 0.7 * Math.sqrt(u))); R.m.material.opacity = 0.55 * (1 - u);
  }
  for (let i = __kfPuffs.length - 1; i >= 0; i--) {
    const P = __kfPuffs[i]; P.t += dt; const u = P.t / P.life;
    if (u >= 1) { scene.remove(P.m); P.m.material.dispose(); __kfPuffs.splice(i, 1); continue; }
    P.m.scale.setScalar(P.s * (0.6 + 0.8 * u)); P.m.position.z += 0.4 * dt; P.m.material.opacity = 0.45 * (1 - u); P.m.lookAt(camera.position);
  }
}
window.__mojKnock = { rings: __kfRings, puffs: __kfPuffs };
`;
}
