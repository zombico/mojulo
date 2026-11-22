// In-page script: A BOSS FOUGHT IN PHASES, SHOWN (worlds/controllable/boss.js) — what the player reads of it:
//
//   its body      its guns turned on their mounts by its aim (the howitzer's and the launcher's rings and cradles), what
//                 has been shot off it gone from its body (a reloader's tail), a beat of rocking as its legs give
//   its fire      each shell and missile in flight on its arc, and under it a RING ON THE GROUND where it will land,
//                 closing as it comes (the read that says where cover is wanted); its tank's sight line, red from its
//                 muzzle to what it meets, brighter and blinking once locked; each burst a flash, a ball of fire and smoke
//   the mines     each one laid, a disc and its light blinking, faster once armed
//   a carrier's   its drones flown (their rotors spun, shown only while out of their bays), each one's mark (a courier's
//                 green, the hacked one's blue with its health, a chaser's red), its packages on their pallets and under
//                 the drone that carries one, the RF gun's beam on the drone it is held on and the hack's ring filling,
//                 each gunner's gun turned on what it fires at, the tracers of a burst
//   its spots     a mark on each weak spot of the phase it is in: lit where the pilot stands to hit it, dim where it does
//                 not (go round it); smoke from what is shot out
//   the HUD       its name, what it is doing and for how long (reloading: the window), its core's bar in a phase that wears
//                 it and a pip a part; what it last said; the mines the pilot has left; the pilot down, a way to try again
//
// It reads the world and draws; it changes nothing (but for the bone hook's turn of the rig it is handed). Emitted only into
// a page whose world has a body with `rule.boss`, so every other page keeps every byte. Needs THREE, scene, camera,
// __world, __CW and, where the page has audio, __AUDIO and __beatsCue.
export function bossScript() {
  return `
// ── A BOSS, SHOWN ──
const __BV = { shells: {}, rings: {}, bursts: {}, mines: {}, marks: {}, smoke: {}, seen: 0, said: null, v: new THREE.Vector3(), lastT: 0, laser: null, hurtT: -9 };
const __bvQ = new THREE.Quaternion(), __bvQ2 = new THREE.Quaternion(), __bvO = new THREE.Vector3(), __BV_Z = new THREE.Vector3(0, 0, 1), __BV_X = new THREE.Vector3(1, 0, 0), __BV_Y = new THREE.Vector3(0, 1, 0);
// THE BONE HOOK: the guns turned by the aim (a ring about its own head, the cradle and its weapon elevated about the trunnion
// and carried round the ring), a part shot off hidden, the rock of a failing stand about the hips
function __bossRigBone(e, fig, bi, Q, P, mesh) {
  const id = fig.bones[bi].id;
  // (a drone's rotors spun about their masts, a pair each way)
  if (e.drone) { if (/Rotor/.test(id)) { __bvQ.setFromAxisAngle(__BV_Z, (((__world.time || 0) * 60) % (2 * Math.PI)) * (/F.*-r$|R.*-l$/.test(id) ? 1 : -1)); Q.multiply(__bvQ); } return; }
  const S = e.boss; if (!S) return;
  const lost = fig.__bvLost || (fig.__bvLost = (function () { const m = {}; for (const sp of S.cfg.spots) for (const b of sp.bones || []) m[b] = sp.id; return m; })());
  if (lost[id]) { const R = S.spots[lost[id]]; mesh.visible = !(R && R.gone); }
  if (e.bossTilt) { __bvQ2.setFromAxisAngle(__BV_X, e.bossTilt); __bvO.set(P[0], P[1], P[2] - 4.5).applyQuaternion(__bvQ2); P[0] = __bvO.x; P[1] = __bvO.y; P[2] = __bvO.z + 4.5; Q.premultiply(__bvQ2); }
  const k = /^(turret|gun)([RL])$/.exec(id);
  if (!k) return;
  const A = S.aim[k[2].toLowerCase()]; if (!A) return;
  const PV = fig.__bvPiv || (fig.__bvPiv = {});
  if (k[1] === 'turret') PV[k[2]] = [P[0], P[1], P[2]];
  const piv = PV[k[2]] || fig.bones[fig.bones.findIndex((b) => b.id === 'turret' + k[2])].head;
  if (k[1] === 'gun') { __bvQ.setFromAxisAngle(__BV_X, (A.pitch || 0) * Math.PI / 180); Q.premultiply(__bvQ); }
  __bvQ.setFromAxisAngle(__BV_Z, -(A.yaw || 0) * Math.PI / 180);
  __bvO.set(P[0] - piv[0], P[1] - piv[1], P[2] - piv[2]).applyQuaternion(__bvQ);
  P[0] = piv[0] + __bvO.x; P[1] = piv[1] + __bvO.y; P[2] = piv[2] + __bvO.z;
  Q.premultiply(__bvQ);
}
window.__bossRigBone = __bossRigBone;
// (what is drawn is unlit and never picked)
const __bvMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
const __bvNoPick = (m) => { m.raycast = function () {}; return m; };
const __bvGeo = { ball: new THREE.SphereGeometry(1, 14, 10), dart: new THREE.ConeGeometry(0.18, 0.9, 8), ring: new THREE.RingGeometry(0.92, 1, 48), disc: new THREE.CircleGeometry(1, 40), mine: new THREE.CylinderGeometry(0.28, 0.32, 0.12, 14), lamp: new THREE.SphereGeometry(0.07, 8, 6) };
// a point on a shell's arc at u (0 … 1): its line, lifted by a parabola to its apex
function __bvArc(s, u, out) {
  out[0] = s.from[0] + (s.to[0] - s.from[0]) * u; out[1] = s.from[1] + (s.to[1] - s.from[1]) * u;
  out[2] = s.from[2] + (s.to[2] - s.from[2]) * u + 4 * (s.apex || 0) * u * (1 - u);
  return out;
}
// THE HUD: the boss's panel at the top, what it said under it, the mines at the foot, the pilot's end
const __bvHud = document.createElement('div');
__bvHud.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:13;pointer-events:none;min-width:340px;font:600 12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e6e1;text-align:center;text-shadow:0 1px 2px #000';
document.body.appendChild(__bvHud);
const __bvSay = document.createElement('div');
__bvSay.style.cssText = 'position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:13;pointer-events:none;font:700 18px/1.2 ui-monospace,monospace;letter-spacing:.08em;color:#ffd27a;text-shadow:0 0 10px rgba(0,0,0,.9);text-align:center;opacity:0;transition:opacity .25s';
document.body.appendChild(__bvSay);
const __bvFoot = document.createElement('div');
__bvFoot.style.cssText = 'position:fixed;right:16px;bottom:90px;z-index:12;pointer-events:none;font:600 12px ui-monospace,monospace;color:#e8e6e1;background:rgba(8,10,14,.6);padding:6px 9px;border:1px solid rgba(232,230,225,.2)';
document.body.appendChild(__bvFoot);
const __bvEnd = document.createElement('div');
__bvEnd.style.cssText = 'position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:rgba(10,4,4,.55);font:700 26px ui-monospace,monospace;letter-spacing:.12em;color:#f3ece4;pointer-events:none';
document.body.appendChild(__bvEnd);
window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyR' && __BV.over) location.reload(); });
const __bvBar = (frac, col, w) => '<div style="display:inline-block;vertical-align:middle;width:' + w + 'px;height:7px;background:rgba(255,255,255,.14);margin:0 4px"><div style="height:100%;width:' + Math.max(0, Math.min(100, frac * 100)).toFixed(1) + '%;background:' + col + '"></div></div>';
const __AUDIO_BOSS_STEP = () => typeof __AUDIO !== 'undefined' && __AUDIO && __AUDIO.boss && !!__AUDIO.boss.step;
function __bvCue(k, at) {
  const A = typeof __AUDIO !== 'undefined' && __AUDIO ? __AUDIO.boss : null; if (!A || !A[k] || typeof __beatsCue !== 'function') return;
  let g = 1;
  if (at) { const c = camera.position, d = Math.hypot(at[0] - c.x, at[1] - c.y, at[2] - c.z); g = Math.max(0.15, Math.min(1, 30 / Math.max(10, d))); }
  try { __beatsCue(A[k], g); } catch (e) {}
}
// A CARRIER, DRAWN (boss.js CARRIER)
const __BVC = { marks: {}, pk: {}, guns: {}, beam: null, ring: null };
function __bvCarrier(W, S, p, now) {
  // its drones: shown out of their bays, a mark over each
  for (const d of S.drones) {
    const m = __bodies[d.id]; if (m) m.visible = !d.gone;
    let mk = __BVC.marks[d.id];
    if (!mk) { mk = __BVC.marks[d.id] = document.createElement('div'); mk.style.cssText = 'position:fixed;z-index:11;pointer-events:none;transform:translate(-50%,-100%);font:700 11px/1 ui-monospace,monospace;white-space:nowrap;text-align:center;text-shadow:0 0 4px #000'; document.body.appendChild(mk); }
    const D = d.drone, show = !d.gone && D.st !== 'fall';
    if (!show) { mk.style.display = 'none'; continue; }
    const q = d.transform.pos; __BV.v.set(q[0], q[1], q[2] + 0.7).project(camera);
    const vis = __BV.v.z < 1 && Math.abs(__BV.v.x) < 1.05 && Math.abs(__BV.v.y) < 1.05;
    mk.style.display = vis ? 'block' : 'none'; if (!vis) continue;
    mk.style.left = ((__BV.v.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; mk.style.top = ((1 - __BV.v.y) / 2 * innerHeight).toFixed(1) + 'px';
    const hp = d.hpMax ? Math.max(0, d.body.hp / d.hpMax) : 1;
    if (D.hacked) mk.innerHTML = '<div style="color:#7fd0ff">\u25b2 HACKED' + (D.st === 'carry' ? ' \u00b7 package' : '') + '</div><div style="margin:2px auto 0;width:40px;height:4px;background:rgba(255,255,255,.2)"><div style="height:100%;width:' + (hp * 100).toFixed(0) + '%;background:#7fd0ff"></div></div>';
    else if (D.role === 'courier') mk.innerHTML = '<div style="color:' + (Math.sin(now * 6) > 0 ? '#6dff8a' : '#2f9a46') + '">\u25ce courier</div>';
    else mk.innerHTML = '<div style="color:' + (D.chase ? '#ff4a3a' : 'rgba(255,170,140,.75)') + '">' + (D.chase ? '\u25bc chaser' : '\u25bf') + '</div>';
  }
  // its packages: on their pallets, or under the drone that carries one
  for (const k in S.pkgs) {
    const K = S.pkgs[k];
    let X = __BVC.pk[k];
    if (!X) { X = __BVC.pk[k] = { pallet: __bvNoPick(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.14), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }))), crate: __bvNoPick(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.4), new THREE.MeshLambertMaterial({ color: 0x7a2c22 }))), lamp: __bvNoPick(new THREE.Mesh(__bvGeo.lamp, __bvMat(0xff6a2a, 1))) };
      X.pallet.position.set(K.at[0], K.at[1], K.at[2] + 0.07); scene.add(X.pallet); scene.add(X.crate); scene.add(X.lamp); }
    const here = !K.carried && now >= K.back;
    X.crate.visible = here || !!K.carried; X.lamp.visible = X.crate.visible && Math.sin(now * 5) > 0;
    const c = K.pos || K.at; X.crate.position.set(c[0], c[1], c[2] + (K.carried ? 0 : 0.36)); X.lamp.position.set(c[0], c[1], c[2] + (K.carried ? 0.25 : 0.62));
  }
  // the RF gun's beam on what it is held on, and the hack's ring round it
  const J = S.jam, tg = J && J.on && J.id ? W.byId[J.id] : null;
  if (!__BVC.beam) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); __BVC.beam = __bvNoPick(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.7 }))); scene.add(__BVC.beam);
    __BVC.ring = document.createElement('div'); __BVC.ring.style.cssText = 'position:fixed;z-index:12;pointer-events:none;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;display:none'; document.body.appendChild(__BVC.ring); }
  if (tg && p) {
    const a = p.transform.pos, b = tg.transform.pos, P = __BVC.beam.geometry.attributes.position;
    P.setXYZ(0, a[0], a[1], a[2] + 1.35); P.setXYZ(1, b[0], b[1], b[2]); P.needsUpdate = true; __BVC.beam.visible = Math.sin(now * 40) > -0.6;
    __BV.v.set(b[0], b[1], b[2]).project(camera);
    __BVC.ring.style.display = __BV.v.z < 1 ? 'block' : 'none';
    __BVC.ring.style.left = ((__BV.v.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; __BVC.ring.style.top = ((1 - __BV.v.y) / 2 * innerHeight).toFixed(1) + 'px';
    const u = Math.round(J.u * 100);
    __BVC.ring.style.background = 'conic-gradient(#7fd0ff ' + u + '%, rgba(127,208,255,.15) 0)'; __BVC.ring.style.webkitMask = __BVC.ring.style.mask = 'radial-gradient(circle, transparent 58%, #000 60%)';
    if (!__BVC.hum || now - __BVC.hum > 0.5) { __BVC.hum = now; __bvCue('jam'); }
  } else { __BVC.beam.visible = false; __BVC.ring.style.display = J && J.u > 0.02 && J.id && W.byId[J.id] ? 'block' : 'none';
    if (J && J.u > 0.02 && J.id && W.byId[J.id]) { const b = W.byId[J.id].transform.pos; __BV.v.set(b[0], b[1], b[2]).project(camera); __BVC.ring.style.left = ((__BV.v.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; __BVC.ring.style.top = ((1 - __BV.v.y) / 2 * innerHeight).toFixed(1) + 'px'; __BVC.ring.style.background = 'conic-gradient(rgba(127,208,255,.6) ' + Math.round(J.u * 100) + '%, rgba(127,208,255,.1) 0)'; } }
  // each gunner's gun: on its mount at the gunner's hands, turned on what it fires at, drooped once its gunner is down
  for (const sp of S.cfg.spots) {
    if (sp.part !== 'crew') continue;
    const B = S.ents[sp.id]; if (!B) continue;
    let G = __BVC.guns[sp.id];
    if (!G) { G = __BVC.guns[sp.id] = new THREE.Group(); const post = __bvNoPick(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0x3b3f36 }))); post.rotation.x = Math.PI / 2; post.position.set(0, 0, -0.55); G.add(post);
      const gun = __bvNoPick(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.16), new THREE.MeshLambertMaterial({ color: 0x2a2d2f }))); gun.position.set(0.55, 0, 0); G.add(gun); const box = __bvNoPick(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.26), new THREE.MeshLambertMaterial({ color: 0x4a5040 }))); G.add(box); G.userData.gun = gun; scene.add(G); }
    const q = B.transform.pos, h = B.transform.heading;
    G.position.set(q[0] + Math.cos(h) * 0.55, q[1] + Math.sin(h) * 0.55, q[2] + 1.15); G.rotation.set(0, S.spots[sp.id].gone ? 0.5 : 0, h);
  }
}
(function __bvFrame() {
  requestAnimationFrame(__bvFrame);
  const W = __world, F = W.bossFx || { shells: [], bursts: [], mines: [] }, now = W.time || 0, B = W.entities.find((x) => x.boss), p = W.pilotId ? W.byId[W.pilotId] : null;
  if (!B) return;
  const S = B.boss, seen = {}, pt = [0, 0, 0];
  // the shells in flight, and their rings where they will land
  for (const s of F.shells) {
    const u = (now - s.t0) / s.T;
    if (u < 0) continue;
    seen[s.id] = true;
    let m = __BV.shells[s.id];
    if (!m) {
      const line = s.kind === 'round' || s.kind === 'tracer';
      m = __BV.shells[s.id] = { body: __bvNoPick(new THREE.Mesh(s.kind === 'missile' ? __bvGeo.dart : __bvGeo.ball, __bvMat(line ? 0xffe9a8 : s.kind === 'missile' ? 0xd8dde2 : 0x3a3d40, 1))) };
      if (s.kind === 'shell') m.body.scale.setScalar(0.32);
      if (s.kind === 'grenade') m.body.scale.setScalar(0.12);
      if (line) m.body.scale.setScalar(s.kind === 'tracer' ? 0.06 : 0.25);
      scene.add(m.body);
      if (!line) {
        m.ring = __bvNoPick(new THREE.Mesh(__bvGeo.ring, __bvMat(s.kind === 'missile' ? 0xffa23a : 0xff3b2e, 0.9)));
        m.fill = __bvNoPick(new THREE.Mesh(__bvGeo.disc, __bvMat(s.kind === 'missile' ? 0xffa23a : 0xff3b2e, 0.18)));
        const r = s.r || 4; m.ring.scale.setScalar(r); m.ring.position.set(s.to[0], s.to[1], s.to[2] + 0.06); m.fill.position.set(s.to[0], s.to[1], s.to[2] + 0.05);
        scene.add(m.ring); scene.add(m.fill);
      } else {
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.from[0], s.from[1], s.from[2]), new THREE.Vector3(s.to[0], s.to[1], s.to[2])]);
        m.trace = __bvNoPick(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }))); scene.add(m.trace);
      }
      __bvCue(s.kind === 'missile' ? 'missile' : s.kind === 'round' ? 'round' : s.kind === 'tracer' ? 'burst-fire' : s.kind === 'grenade' ? 'drop' : 'launch', s.from);
    }
    __bvArc(s, Math.min(1, u), pt);
    m.body.position.set(pt[0], pt[1], pt[2]);
    if (s.kind === 'missile') { const q = __bvArc(s, Math.min(1, u + 0.02), [0, 0, 0]); __bvO.set(q[0] - pt[0], q[1] - pt[1], q[2] - pt[2]).normalize(); m.body.quaternion.setFromUnitVectors(__BV_Y, __bvO); }
    if (m.fill) { const r = s.r || 4; m.fill.scale.setScalar(Math.max(0.05, r * Math.min(1, u))); m.ring.material.opacity = 0.55 + 0.45 * Math.abs(Math.sin(now * (6 + 10 * u))); }
  }
  for (const id in __BV.shells) if (!seen[id]) { const m = __BV.shells[id]; for (const k of ['body', 'ring', 'fill', 'trace']) if (m[k]) scene.remove(m[k]); delete __BV.shells[id]; }
  // the bursts: a flash and a fireball, then smoke
  for (const b of F.bursts) {
    if (__BV.bursts[b.id] || now < b.t) continue;
    const ball = __bvNoPick(new THREE.Mesh(__bvGeo.ball, __bvMat(0xffb347, 0.95))), smoke = __bvNoPick(new THREE.Mesh(__bvGeo.ball, __bvMat(0x2d2c2b, 0.6)));
    ball.position.set(b.at[0], b.at[1], b.at[2] + 0.4); smoke.position.copy(ball.position);
    const light = new THREE.PointLight(0xffa64d, 6, b.r * 5); light.position.copy(ball.position);
    scene.add(ball); scene.add(smoke); scene.add(light);
    __BV.bursts[b.id] = { ball, smoke, light, t: b.t, r: b.r };
    __bvCue(b.kind === 'mine' ? 'mine' : b.kind === 'drone' ? 'drone-down' : 'burst', b.at);
  }
  for (const id in __BV.bursts) {
    const X = __BV.bursts[id], a = now - X.t;
    if (a > 2.6) { scene.remove(X.ball); scene.remove(X.smoke); scene.remove(X.light); delete __BV.bursts[id]; continue; }
    const k = Math.min(1, a / 0.35);
    X.ball.scale.setScalar(X.r * 0.55 * (0.3 + 0.7 * k)); X.ball.material.opacity = Math.max(0, 0.95 * (1 - a / 0.5));
    X.smoke.scale.setScalar(X.r * 0.45 * (0.4 + 0.6 * Math.min(1, a / 1.2))); X.smoke.position.z += 0.02; X.smoke.material.opacity = Math.max(0, 0.6 * (1 - a / 2.6));
    X.light.intensity = Math.max(0, 6 * (1 - a / 0.3));
  }
  // the mines: a disc and its lamp, blinking faster once armed
  const mseen = {};
  for (const m of F.mines) {
    if (m.gone) continue;
    mseen[m.id] = true;
    let M = __BV.mines[m.id];
    if (!M) { M = __BV.mines[m.id] = { body: __bvNoPick(new THREE.Mesh(__bvGeo.mine, new THREE.MeshLambertMaterial({ color: 0x3c4436 }))), lamp: __bvNoPick(new THREE.Mesh(__bvGeo.lamp, __bvMat(0xff2a1a, 1))) };
      M.body.rotation.x = Math.PI / 2; M.body.position.set(m.at[0], m.at[1], m.at[2] + 0.06); M.lamp.position.set(m.at[0], m.at[1], m.at[2] + 0.16); scene.add(M.body); scene.add(M.lamp); }
    const armed = now - m.t0 > 1;
    M.lamp.visible = Math.sin(now * (armed ? 14 : 4)) > 0;
  }
  for (const id in __BV.mines) if (!mseen[id] && !__BV.mines[id].crate) { scene.remove(__BV.mines[id].body); scene.remove(__BV.mines[id].lamp); delete __BV.mines[id]; }
  // the crates of mines still to be taken
  const CR = (S.cfg.mine && S.cfg.mine.crates) || [], taken = F.taken || {};
  for (const c of CR) {
    let X = __BV.mines['crate:' + c.id];
    if (!X) { X = __BV.mines['crate:' + c.id] = { body: __bvNoPick(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.5), new THREE.MeshLambertMaterial({ color: 0x55603f }))), lamp: __bvNoPick(new THREE.Mesh(__bvGeo.lamp, __bvMat(0xffd23a, 1))), crate: true }; X.body.position.set(c.at[0], c.at[1], (c.at[2] || 0) + 0.25); X.lamp.position.set(c.at[0], c.at[1], (c.at[2] || 0) + 0.62); scene.add(X.body); scene.add(X.lamp); }
    X.body.visible = X.lamp.visible = !taken[c.id];
    if (!taken[c.id]) X.lamp.visible = Math.sin(now * 3) > -0.4;
  }
  // A CARRIER'S: its drones, their marks, its packages, the beam, its gunners' guns
  if (S.carrier) __bvCarrier(W, S, p, now);
  // its footfalls, a walker's (each leg's planting in its gait), never folded
  if (__AUDIO_BOSS_STEP() && S.form === 'walker' && B.moving && B.locomotion === 'forward') {
    const ph = B.gaitPhase || 0;
    [0, 0.5].forEach((q, i) => { const k = Math.floor(ph - q); if (__BV.legs && __BV.legs[i] !== undefined && k !== __BV.legs[i]) __bvCue('step', B.transform.pos); (__BV.legs || (__BV.legs = {}))[i] = k; });
  }
  // the tank's sight line
  if (S.lay && S.step === 'lay') {
    if (!__BV.laser) { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); __BV.laser = __bvNoPick(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.8 }))); scene.add(__BV.laser); }
    const P = __BV.laser.geometry.attributes.position; P.setXYZ(0, S.lay.from[0], S.lay.from[1], S.lay.from[2]); P.setXYZ(1, S.lay.to[0], S.lay.to[1], S.lay.to[2]); P.needsUpdate = true;
    __BV.laser.visible = !S.lay.locked || Math.sin(now * 30) > -0.3;
    __BV.laser.material.opacity = S.lay.locked ? 1 : 0.35 + 0.5 * S.lay.u;
    if (S.lay.locked && !__BV.locked) { __BV.locked = true; __bvCue('lock'); }
  } else { if (__BV.laser) __BV.laser.visible = false; __BV.locked = false; }
  // its spots: a mark on each of the phase it is in, lit where the pilot can hit it; smoke from what is shot out
  const phase = S.phase === 'fall' || S.phase === 'transform' ? S.from : S.phase;
  for (const sp of S.cfg.spots) {
    const R = S.spots[sp.id], E = S.ents[sp.id];
    let mk = __BV.marks[sp.id];
    if (!mk) { mk = __BV.marks[sp.id] = document.createElement('div'); mk.style.cssText = 'position:fixed;z-index:11;pointer-events:none;transform:translate(-50%,-50%);font:700 13px/1 ui-monospace,monospace;white-space:nowrap;text-align:center'; document.body.appendChild(mk); }
    const on = E && !R.gone && S.phase !== 'down' && (!sp.phases || sp.phases.includes(phase)) && (sp.by || 'round') === 'round';
    if (!on) { mk.style.display = 'none'; }
    else {
      const q = E.transform.pos;
      __BV.v.set(q[0], q[1], q[2] + (sp.r || 0.8)).project(camera);
      const vis = __BV.v.z < 1 && Math.abs(__BV.v.x) < 1.05 && Math.abs(__BV.v.y) < 1.05;
      mk.style.display = vis ? 'block' : 'none';
      if (vis) {
        mk.style.left = ((__BV.v.x + 1) / 2 * innerWidth).toFixed(1) + 'px'; mk.style.top = ((1 - __BV.v.y) / 2 * innerHeight).toFixed(1) + 'px';
        const hot = !!E.body.hittable, hit = S.lastSpotHit && S.lastSpotHit.id === sp.id && now - S.lastSpotHit.t < 0.15;
        const frac = Number.isFinite(R.max) ? R.hp / R.max : null;
        mk.innerHTML = '<div style="font-size:' + (hot ? 18 : 12) + 'px;color:' + (hit ? '#fff' : hot ? '#ff9a2e' : 'rgba(255,190,120,.45)') + '">' + (hot ? '\\u25c6' : '\\u25c7') + '</div>' + (hot && frac != null ? '<div style="margin:2px auto 0;width:28px;height:3px;background:rgba(255,255,255,.2)"><div style="height:100%;width:' + (frac * 100).toFixed(0) + '%;background:#ff9a2e"></div></div>' : '');
      }
    }
    // (what is shot out smokes where it was)
    if (R.gone && !__BV.smoke[sp.id] && E) { const sm = __bvNoPick(new THREE.Mesh(__bvGeo.ball, __bvMat(0x1e1d1c, 0.5))); scene.add(sm); __BV.smoke[sp.id] = sm; }
    const sm = __BV.smoke[sp.id];
    if (sm && E) { const q = E.transform.pos, ph = (now * 0.7 + sp.id.length * 0.13) % 1; sm.position.set(q[0], q[1], q[2] + (sp.r || 0.8) + ph * 3); sm.scale.setScalar(0.4 + ph * 1.4); sm.material.opacity = 0.55 * (1 - ph); }
  }
  // THE HUD
  const name = (S.cfg.name || 'boss').toUpperCase(), doing = S.phase === 'down' ? 'destroyed' : S.phase === 'fall' ? 'staggering' : S.phase === 'transform' ? 'folding onto its wheels'
    : S.step === 'brood' ? (S.drones.some((d) => d.drone.hacked) ? 'a hacked drone is out' : S.drones.some((d) => d.drone.role === 'courier' && d.drone.out && d.drone.st !== 'fall') ? 'a courier is out' : 'its drones are out')
    : S.step === 'aim' ? 'laying a barrage' : S.step === 'fire' ? 'firing' : S.step === 'reload' ? 'reloading ' + Math.max(0, (S.reloadFor || 0) - S.t).toFixed(1) + ' s' : S.step === 'advance' ? 'advancing' : S.step === 'drive' ? (S.stunT > 0 ? 'drive broken ' + S.stunT.toFixed(1) + ' s' : 'driving') : S.step === 'lay' ? 'laying its gun' : S.step;
  const parts = S.cfg.spots.filter((sp) => Number.isFinite(S.spots[sp.id].max) && (!sp.phases || sp.phases.includes(phase))).map((sp) => {
    const R = S.spots[sp.id];
    return '<span style="display:inline-block;margin:2px 6px;color:' + (R.gone ? '#7d7a75' : '#e8e6e1') + '">' + (sp.name || sp.id).replace(/^(its|the) /, '') + (R.gone ? ' \\u2715' : __bvBar(R.hp / R.max, sp.part === 'leg' ? '#e0b040' : '#ff9a2e', 46)) + '</span>';
  }).join('');
  const core = S.cfg.phases[phase] && (S.cfg.phases[phase].kind === 'tank' || S.cfg.phases[phase].kind === 'carrier') || S.phase === 'down' ? '<div>' + __bvBar(S.hp / S.hpMax, '#ff4a3a', 260) + '</div>' : '';
  const crewOf = S.cfg.spots.filter((sp) => sp.part === 'crew'), crewL = crewOf.length ? '<div style="margin-top:2px">gunners ' + crewOf.map((sp) => '<span style="margin:0 4px;color:' + (S.spots[sp.id].gone ? '#7d7a75' : '#ff9a2e') + '">' + (sp.name || sp.id).replace(/^the /, '').replace(/ gunner$/, '') + (S.spots[sp.id].gone ? ' \u2715' : ' \u25cf') + '</span>').join('') + (S.carrier ? ' \u00b7 delivered ' + S.deliveries : '') + '</div>' : '';
  const reload = S.step === 'reload' && S.reloadFor ? '<div style="margin-top:2px">' + __bvBar(S.t / S.reloadFor, '#7fc8ff', 160) + '</div>' : '';
  __bvHud.innerHTML = '<div style="letter-spacing:.2em;font-size:13px">' + name + '</div><div style="color:#b9b5ae">' + doing + (S.tailsLost ? ' \\u00b7 reloaders lost ' + S.tailsLost : '') + '</div>' + core + reload + crewL + '<div style="margin-top:3px">' + parts + '</div>';
  // what it said: shown for a while as it is said
  if (S.said && S.said !== __BV.said) { __BV.said = S.said; __bvSay.textContent = S.said.text; __bvSay.style.opacity = '1'; __BV.sayT = now; if (S.said.on === 'boss:barrage') __bvCue('alarm'); if (S.said.on === 'boss:down') __bvCue('burst'); }
  if (__BV.sayT != null && now - __BV.sayT > 3.2) __bvSay.style.opacity = '0';
  // the mines in hand
  if (p && p.carry && p.rule.carry && p.rule.carry.items) {
    const i = p.rule.carry.items.findIndex((it) => it.id === ((S.cfg.mine && S.cfg.mine.item) || 'mine'));
    __bvFoot.style.display = i >= 0 ? 'block' : 'none';
    if (i >= 0) __bvFoot.textContent = 'MINES ' + p.carry.counts[i] + '  \\u00b7  H  lay one at your feet';
  }
  // the end: the pilot down, or the boss
  const lost = p && (p.downed || (p.body && Number.isFinite(p.body.hp) && p.body.hp <= 0));
  if (lost && !__BV.over) { __BV.over = 'lost'; __bvEnd.innerHTML = '<div>YOU ARE DOWN</div><div style="font-size:14px;letter-spacing:.1em;color:#d7c9bd">R  try again</div>'; __bvEnd.style.display = 'flex'; }
  if (S.phase === 'down' && !__BV.over && S.t > 2.5) { __BV.over = 'won'; __bvEnd.style.background = 'rgba(4,8,10,.35)'; __bvEnd.innerHTML = '<div>' + name + ' DESTROYED</div><div style="font-size:14px;letter-spacing:.1em;color:#cfd8dc">R  fight it again</div>'; __bvEnd.style.display = 'flex'; }
  // a hit on the pilot reads as a red edge
  if (p && p.hitFlash > __BV.hurtT && p.lastHitBy === B.id) { __BV.hurtT = p.hitFlash; document.body.animate([{ boxShadow: 'inset 0 0 120px rgba(255,30,20,.75)' }, { boxShadow: 'inset 0 0 0 rgba(255,30,20,0)' }], { duration: 600 }); }
})();
window.__mojBoss = () => (__CW.bossFacts ? __CW.bossFacts(__world) : null);
`;
}
