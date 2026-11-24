// In-page script: THE BOSS FIGHT SEEN (worlds/controllable/boss.js, mines.js) — what a body facing a boss reads off the
// floor before it lands, and what a vehicle shows of itself:
//   a hazard's MARK   from the moment it is shown, its shape on the floor in the boss's tell colour, filling as its landing
//                     nears; while it lands, the shape in the hazard's colour, bright (a sweep its beam turning across the
//                     arc it marked, a ring its front rolling out, a strafe each landing as it comes); gone after
//   a MINE            a small disc and its light: amber while it arms, red once armed
//   a vehicle's PARTS boxes on the vehicle, placed from its pose each frame: a plate steel, a track dark, a weak spot red
//                     and beating while it can be hit, dim while something covers it; a broken part gone
//   a human boss's    the counter's PROP carried on its body (a `part` counter's `prop`: a canister) on its chest bone,
//   COUNTER           placed from the bone's rest and its back's depth, so it rides every clip; a hose from it to the right
//                     hand; glowing while it is bare, white for a moment as each hit lands; on breaking, a burst of fire
//                     and gone
//   a SCOPE           while a move holds the boss's eye to a scope, a GLINT at the eye, flaring as its shot nears (where
//                     it is, always); BLINDED (a flash counter), sparks circling its head till it sees again
//   a MECHA         (a vehicle of the mecha shelf, drawn as its own figure) its parts are not boxes but marks on it: a weak
//                   spot a beating red glass while it can be hit and a counting part an amber one while it can, each only
//                   where the pilot stands to reach it (`from`); a part shot off hides its bones; a drone's rotors spun
//   a CARRIER'S     its gunners' guns on their mounts, turned on what they fire at, drooped once the gunner is down, and
//                   the bursts' tracers; its drones shown only out of their bays, a mark over each (a courier's green, a
//                   hacked one's blue with its health, a chaser's red); its packages on their pallets and under the drone
//                   that carries one; the RF gun's beam on what it is held on and the hack's ring filling; under the boss
//                   bar its gunners and its deliveries, and what it last said
//   SEEN FROM THE SIDE (a side map's page: a castle's boss on its lane) a hazard is drawn upright along the lane where it
//                     touches it, as high as it reaches (its `rise`, else a body's height): its mark the whole stretch it
//                     will cross, faint and filling; while it lands, the stretch it is on now, bright. A low band is
//                     jumped, a tall one left
// Emitted only into a page whose world has a boss or a placed weapon, so every other page keeps every byte. Needs THREE,
// scene and __world in scope.
export function bossViewScript() {
  return `
// ── THE BOSS FIGHT SEEN ──
const __BV = { marks: new Map(), mines: new Map(), parts: new Map(), props: new Map(), fires: [] };
// (a rig's bone by its id, the first of the names it might go by; its index into the rig's bones)
const __bvBone = (fig, names) => { for (const n of names) { const i = fig.bones.findIndex((b) => (b.id || b) === n); if (i >= 0) return i; } return -1; };
const __bvV = new THREE.Vector3(), __bvW = new THREE.Vector3();
// (a soft round light, the glint's and the sparks')
const __bvGlowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const __bvSprite = (hex, s) => { const x = new THREE.Sprite(new THREE.SpriteMaterial({ map: __bvGlowTex, color: new THREE.Color(hex), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); x.scale.setScalar(s); x.visible = false; scene.add(x); return x; };
// (a body's head in the world: its rig's head bone where it has one, else its height)
function __bvHead(e, out) {
  const g = __bodies[e.id], rf = g && g.userData && g.userData.rigFig;
  if (rf) { const i = __bvBone(rf.fig, ['head']); if (i >= 0 && rf.boneMeshes[i]) { const b = rf.fig.bones[i], m = rf.boneMeshes[i]; m.updateWorldMatrix(true, false); return out.set(b.head[0], b.head[1], b.head[2] + 0.08).applyMatrix4(m.matrixWorld); } }
  const p = e.transform.pos; return out.set(p[0], p[1], p[2] + 1.65);
}
// (a prop's shading baked into its corners from its normals, as the page's bodies are: no light in the scene to do it)
function __bvShaded(geo, hex) {
  const n = geo.getAttribute('normal'), c = new THREE.Color(hex), col = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) { const k = 0.5 + 0.5 * Math.max(0, n.getX(i) * 0.35 - n.getY(i) * 0.55 + n.getZ(i) * 0.75); col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
// THE PROPS a boss's counters carry on its body: each on its chest bone at its back, a hose to its right hand
function __bvProps(e, g, B) {
  const rf = g.userData.rigFig, fig = rf.fig, out = [];
  const ci = __bvBone(fig, ['upperChest', 'chest', 'torso', 'spine2', 'spine']), hi = __bvBone(fig, ['handR', 'rightHand', 'hand_r', 'handRight']);
  if (ci < 0 || !rf.boneMeshes[ci]) return out;
  const bone = rf.boneMeshes[ci], bn = fig.bones[ci], head = bn.head || [0, 0, 1.3], tail = bn.tail || [head[0], head[1], head[2] + 0.2];
  // (the back's depth at the chest: the least forward of the skin the chest carries, else a chest's half)
  let back = head[1] - 0.13;
  const sk = rf.skin && rf.skin.geometry;
  if (sk) { const P = sk.getAttribute('position'), J = sk.getAttribute('skinIndex'), Wt = sk.getAttribute('skinWeight'); let m = Infinity;
    for (let i = 0; i < P.count; i++) for (let k = 0; k < 4; k++) if (J.getComponent(i, k) === ci && Wt.getComponent(i, k) > 0.4) { const y = P.getY(i), z = P.getZ(i); if (z > Math.min(head[2], tail[2]) - 0.05 && z < Math.max(head[2], tail[2]) + 0.05 && y < m) m = y; }
    if (m < Infinity) back = m; }
  for (const c of B.counters) {
    const Q = c.prop; if (!Q || Q.shape !== 'canister') continue;
    const o = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff }), band = new THREE.MeshBasicMaterial({ vertexColors: true });
    const body = new THREE.Mesh(__bvShaded(new THREE.CylinderGeometry(Q.r, Q.r, Q.h, 18), Q.colour), mat); body.rotation.x = Math.PI / 2; o.add(body);
    for (const z of [-0.36, 0.36]) { const b2 = new THREE.Mesh(__bvShaded(new THREE.CylinderGeometry(Q.r * 1.05, Q.r * 1.05, 0.035, 18), Q.band), band); b2.rotation.x = Math.PI / 2; b2.position.z = z * Q.h; o.add(b2); }
    const cap = new THREE.Mesh(__bvShaded(new THREE.SphereGeometry(Q.r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), Q.colour), mat); cap.rotation.x = Math.PI / 2; cap.position.z = Q.h / 2; o.add(cap);
    const valve = new THREE.Mesh(__bvShaded(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8), Q.band), band); valve.rotation.x = Math.PI / 2; valve.position.z = Q.h / 2 + Q.r * 0.9; o.add(valve);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(Q.r * 1.35, Q.r * 1.35, Q.h * 1.1, 18), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = Math.PI / 2; o.add(glow);
    // (in the scene, following the bone's matrix each frame: a body drawn as one mesh keeps its bone meshes hidden, for
    // their matrices alone, so nothing hung on them would show)
    const off = new THREE.Matrix4().makeTranslation((head[0] + tail[0]) / 2, back - Q.r - 0.015, (head[2] + tail[2]) / 2 + 0.02);
    o.matrixAutoUpdate = false; scene.add(o);
    const hose = hi >= 0 && rf.boneMeshes[hi] ? { mesh: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(Q.hose || '#1d1a17') })), bone: rf.boneMeshes[hi], at: fig.bones[hi].head } : null;
    if (hose) scene.add(hose.mesh);
    out.push({ id: c.id, o, mat, glow, hose, Q, bone, off, hits: 0, flash: -9, gone: false });
  }
  return out;
}

const __bvMat = (hex, op) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const __bvGeo = (h) => {
  const S = h.shape;
  if (S === 'line') { const dx = h.b[0] - h.a[0], dy = h.b[1] - h.a[1], L = Math.hypot(dx, dy) || 0.01; const g = new THREE.PlaneGeometry(L, h.w); g.rotateZ(Math.atan2(dy, dx)); g.translate((h.a[0] + h.b[0]) / 2, (h.a[1] + h.b[1]) / 2, 0); return g; }
  if (S === 'cone') { const g = new THREE.CircleGeometry(h.reach, 32, h.dir - h.half, 2 * h.half); g.translate(h.o[0], h.o[1], 0); return g; }
  if (S === 'sweep') { const a0 = Math.min(h.a0, h.a1) - h.beam, a1 = Math.max(h.a0, h.a1) + h.beam, g = new THREE.CircleGeometry(h.reach, 40, a0, a1 - a0); g.translate(h.o[0], h.o[1], 0); return g; }
  if (S === 'ring') { const g = new THREE.RingGeometry(Math.max(0.01, h.r0), h.r1 + h.band / 2, 64); g.translate(h.o[0], h.o[1], 0); return g; }
  if (S === 'disc') { const g = new THREE.CircleGeometry(h.r, 32); g.translate(h.c[0], h.c[1], 0); return g; }
  if (S === 'square') { const g = new THREE.PlaneGeometry(h.side * 0.96, h.side * 0.96); g.rotateZ(h.dir); g.translate(h.c[0], h.c[1], 0); return g; }
  if (S === 'strafe') { const L = Math.hypot(h.b[0] - h.a[0], h.b[1] - h.a[1]), n = Math.max(1, Math.floor(L / h.step)), gs = []; for (let k = 0; k <= n; k++) { const g = new THREE.CircleGeometry(h.r, 20); g.translate(h.a[0] + ((h.b[0] - h.a[0]) * k) / n, h.a[1] + ((h.b[1] - h.a[1]) * k) / n, 0); gs.push(g); } return gs; }
  return null;
};
// (the side view's: the lane's stretches a hazard touches, at a moment or over its whole time; an upright band a stretch)
const __BV_TALL = 2.6, __BV_STEP = 0.25;
function __bvLane(h, t) {
  const H = __CW.hazardHit, out = [], ts = t == null ? Array.from({ length: 17 }, (_, k) => h.t0 + ((h.t1 - h.t0) * k) / 16) : [t];
  const lo = (h.o || h.c || h.a || [0, 0])[1] - 40, hi = lo + 80;
  let a = null;
  for (let y = lo; y <= hi; y += __BV_STEP) {
    const on = ts.some((q) => H(h, 0, y, Math.min(h.t1, Math.max(h.t0, q))));
    if (on && a == null) a = y; else if (!on && a != null) { out.push([a, y]); a = null; }
  }
  if (a != null) out.push([a, hi]);
  return out;
}
function __bvBands(spans, h, hex, op) {
  const g = new THREE.Group(), tall = h.rise != null ? h.rise : __BV_TALL;
  for (const [a, b] of spans) {
    const q = new THREE.PlaneGeometry(b - a, tall); q.rotateX(Math.PI / 2); q.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(q, __bvMat(hex, op)); m.position.set(0.7, (a + b) / 2, tall / 2); g.add(m);
    // (its top a bright edge: the height a jump must clear)
    const e = new THREE.PlaneGeometry(b - a, 0.06); e.rotateX(Math.PI / 2); e.rotateZ(Math.PI / 2);
    const k = new THREE.Mesh(e, __bvMat(hex, Math.min(1, op * 2.5))); k.position.set(0.71, (a + b) / 2, tall - 0.03); g.add(k);
  }
  return g;
}
function __bvSideMark(h) {
  const grp = new THREE.Group(), tell = h.tellColour || '#ffd27a', hot = h.colour || '#ff5a3a';
  grp.position.z = h.z || 0;
  const T = __bvBands(__bvLane(h, null), h, tell, 0.18); grp.add(T);
  scene.add(grp);
  return { grp, side: true, tell: T.children.filter((x, i) => i % 2 === 0), edge: T.children.filter((x, i) => i % 2 === 1), hot: null, hotT: -1, h, hex: hot };
}
function __bvMark(h) {
  const grp = new THREE.Group(), z = (h.z || 0) + 0.06, tell = h.tellColour || '#ffd27a', hot = h.colour || '#ff5a3a';
  grp.position.z = z;
  const G = __bvGeo(h), list = Array.isArray(G) ? G : [G];
  const m = { grp, tell: list.map((g) => { const x = new THREE.Mesh(g, __bvMat(tell, 0.2)); grp.add(x); return x; }), hot: null, h };
  // (what lands: the beam of a sweep, the front of a ring, a strafe's landings one by one; the rest the shape itself)
  if (h.shape === 'sweep') { const g = new THREE.CircleGeometry(h.reach, 12, -h.beam, 2 * h.beam); m.hot = new THREE.Mesh(g, __bvMat(hot, 0.8)); m.hot.position.set(h.o[0], h.o[1], 0.01); grp.add(m.hot); }
  else if (h.shape === 'ring') { m.hot = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 64), __bvMat(hot, 0.85)); m.hot.position.set(h.o[0], h.o[1], 0.01); grp.add(m.hot); }
  else if (h.shape === 'strafe') m.hot = m.tell.map((x) => { const y = new THREE.Mesh(x.geometry, __bvMat(hot, 0.85)); y.visible = false; y.position.z = 0.01; grp.add(y); return y; });
  else { m.hot = new THREE.Group(); for (const g of list) m.hot.add(new THREE.Mesh(g, __bvMat(hot, 0.8))); m.hot.position.z = 0.01; grp.add(m.hot); }
  scene.add(grp);
  return m;
}
// A MECHA'S PARTS: marks on its figure (its weak spots red, its counting parts amber), each only while it can be hit and
// from where the pilot stands
function __bvMechaParts(W, e, B, S, P, t) {
  const pl = W.pilotId ? W.byId[W.pilotId] : null;
  const from = (p) => { if (!p.from || !pl) return true; const h = e.transform.heading || 0, dx = pl.transform.pos[0] - e.transform.pos[0], dy = pl.transform.pos[1] - e.transform.pos[1], lx = dx * Math.cos(h) + dy * Math.sin(h), ly = -dx * Math.sin(h) + dy * Math.cos(h), arc = (p.arc || 70) * Math.PI / 180;
    return p.from === 'behind' ? Math.abs(Math.atan2(ly, -lx)) <= arc : Math.abs(Math.atan2(lx, (p.side === 'right' ? -1 : 1) * ly)) <= arc; };
  for (const [id, x] of Object.entries(P.boxes)) {
    const p = x.p, broken = !!S.broken[id], open = !broken && (!p.behind || S.broken[p.behind]) && (!p.shown || [].concat(p.shown).includes(S.state));
    const shows = open && !(p.weak && (p.mult ?? 1) < 0.5) && !p.takes.every((k) => k === 'mine'), reach = from(p);
    x.box.visible = shows;
    if (shows) x.box.material.opacity = reach ? (p.weak ? 0.35 + 0.25 * Math.sin(t * 7) : 0.28) : 0.08;
  }
}
// (the bone hook, controllable channel: a part shot off a mecha hides its bones; a drone's rotors spun)
const __bvQ = new THREE.Quaternion(), __BV_Z = new THREE.Vector3(0, 0, 1);
window.__bossRigBone = function (e, fig, bi, Q, P, mesh) {
  const id = fig.bones[bi].id;
  if (e.drone) { if (/Rotor/.test(id)) { __bvQ.setFromAxisAngle(__BV_Z, (((__world.time || 0) * 60) % (2 * Math.PI)) * (/F.*-r$|R.*-l$/.test(id) ? 1 : -1)); Q.multiply(__bvQ); } return; }
  const B = e.rule && e.rule.boss, S = e.bossS; if (!B || !S || !B.frame) return;
  const lost = fig.__bvLost || (fig.__bvLost = (() => { const m = {}; for (const [pid, p] of Object.entries(B.parts)) for (const b of p.bones || []) m[b] = pid; return m; })());
  if (lost[id]) mesh.visible = !S.broken[lost[id]];
};
// A CARRIER, DRAWN
const __BVC = { marks: {}, pk: {}, guns: {}, beam: null, ring: null, tr: [], v: new THREE.Vector3(), hud: null, said: null, sayT: -9 };
function __bvScreen(q, dz) { __BVC.v.set(q[0], q[1], q[2] + (dz || 0)).project(camera); return { x: (__BVC.v.x + 1) / 2 * innerWidth, y: (1 - __BVC.v.y) / 2 * innerHeight, on: __BVC.v.z < 1 && Math.abs(__BVC.v.x) < 1.05 && Math.abs(__BVC.v.y) < 1.05 }; }
function __bvCarrier(W, e, B, S, t) {
  const C = S.carrier, F = W.bosses && W.bosses[e.id] && W.bosses[e.id].carrier; if (!C || !F) return;
  const pl = W.pilotId ? W.byId[W.pilotId] : null;
  // its drones, and a mark over each
  for (const d of C.drones) {
    const m = __bodies[d.id]; if (m) m.visible = !d.gone;
    let mk = __BVC.marks[d.id];
    if (!mk) { mk = __BVC.marks[d.id] = document.createElement('div'); mk.style.cssText = 'position:fixed;z-index:11;pointer-events:none;transform:translate(-50%,-100%);font:700 11px/1 ui-monospace,monospace;white-space:nowrap;text-align:center;text-shadow:0 0 4px #000'; document.body.appendChild(mk); }
    const D = d.drone, show = !d.gone && D.st !== 'fall' && !S.down, s2 = show ? __bvScreen(d.transform.pos, 0.7) : null;
    mk.style.display = s2 && s2.on ? 'block' : 'none'; if (!s2 || !s2.on) continue;
    mk.style.left = s2.x.toFixed(1) + 'px'; mk.style.top = s2.y.toFixed(1) + 'px';
    const hp = d.hpMax ? Math.max(0, d.body.hp / d.hpMax) : 1;
    mk.innerHTML = D.hacked ? '<div style="color:#7fd0ff">▲ HACKED' + (D.st === 'carry' ? ' · package' : '') + '</div><div style="margin:2px auto 0;width:40px;height:4px;background:rgba(255,255,255,.2)"><div style="height:100%;width:' + (hp * 100).toFixed(0) + '%;background:#7fd0ff"></div></div>'
      : D.role === 'courier' ? '<div style="color:' + (Math.sin(t * 6) > 0 ? '#6dff8a' : '#2f9a46') + '">◎ courier</div>' : '<div style="color:' + (D.chase ? '#ff4a3a' : 'rgba(255,170,140,.75)') + '">' + (D.chase ? '▼ chaser' : '▿') + '</div>';
  }
  // its packages
  for (const k in C.pkgs) {
    const K = C.pkgs[k];
    let X = __BVC.pk[k];
    if (!X) { X = __BVC.pk[k] = { pallet: new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.14), new THREE.MeshLambertMaterial({ color: 0x8a6a42 })), crate: new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.4), new THREE.MeshLambertMaterial({ color: 0x7a2c22 })), lamp: new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff6a2a })) };
      for (const m of [X.pallet, X.crate, X.lamp]) { m.raycast = function () {}; scene.add(m); } X.pallet.position.set(K.at[0], K.at[1], K.at[2] + 0.07); }
    const here = !K.carried && t >= K.back, c = K.pos || K.at;
    X.crate.visible = here || !!K.carried; X.lamp.visible = X.crate.visible && Math.sin(t * 5) > 0;
    X.crate.position.set(c[0], c[1], c[2] + (K.carried ? 0 : 0.36)); X.lamp.position.set(c[0], c[1], c[2] + (K.carried ? 0.25 : 0.62));
  }
  // the RF gun's beam and the hack's ring
  if (!__BVC.beam) { __BVC.beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.7 })); __BVC.beam.raycast = function () {}; scene.add(__BVC.beam);
    __BVC.ring = document.createElement('div'); __BVC.ring.style.cssText = 'position:fixed;z-index:12;pointer-events:none;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;display:none;-webkit-mask:radial-gradient(circle,transparent 58%,#000 60%);mask:radial-gradient(circle,transparent 58%,#000 60%)'; document.body.appendChild(__BVC.ring); }
  const J = C.jam, tg = J && J.id ? W.byId[J.id] : null;
  __BVC.beam.visible = !!(J && J.on && tg && pl);
  if (__BVC.beam.visible) { const a = pl.transform.pos, b = tg.transform.pos, P = __BVC.beam.geometry.attributes.position; P.setXYZ(0, a[0], a[1], a[2] + 1.35); P.setXYZ(1, b[0], b[1], b[2]); P.needsUpdate = true; }
  const rs = tg && J.u > 0.02 ? __bvScreen(tg.transform.pos, 0) : null;
  __BVC.ring.style.display = rs && rs.on ? 'block' : 'none';
  if (rs && rs.on) { __BVC.ring.style.left = rs.x.toFixed(1) + 'px'; __BVC.ring.style.top = rs.y.toFixed(1) + 'px'; __BVC.ring.style.background = 'conic-gradient(' + (J.on ? '#7fd0ff' : 'rgba(127,208,255,.6)') + ' ' + Math.round(J.u * 100) + '%, rgba(127,208,255,.12) 0)'; }
  // its gunners' guns
  for (const c of C.crew) {
    let G = __BVC.guns[c.cfg.id];
    if (!G) { G = __BVC.guns[c.cfg.id] = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8), new THREE.MeshLambertMaterial({ color: 0x3b3f36 })); post.rotation.x = Math.PI / 2; post.position.set(0, 0, -0.55); G.add(post);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.16), new THREE.MeshLambertMaterial({ color: 0x2a2d2f })); gun.position.set(0.55, 0, 0); G.add(gun); G.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.26), new THREE.MeshLambertMaterial({ color: 0x4a5040 }))); G.traverse((m) => { m.raycast = function () {}; }); scene.add(G); }
    const q = c.ent.transform.pos, h = (e.transform.heading || 0) + (c.cfg.face || 0) * Math.PI / 180 + (C.aim[c.cfg.id] || 0);
    G.position.set(q[0] + Math.cos(h) * 0.55, q[1] + Math.sin(h) * 0.55, q[2] + 1.15); G.rotation.set(0, c.down ? 0.5 : 0, h);
  }
  // the bursts' tracers
  const T = (W.bossFx && W.bossFx.tracers) || [];
  for (const r of T) if (!r.drawn && t - r.t < 0.25) { r.drawn = true; const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...r.from), new THREE.Vector3(...r.to)]), new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 })); l.raycast = function () {}; scene.add(l); __BVC.tr.push({ l, t: r.t }); }
  __BVC.tr = __BVC.tr.filter((x) => { if (t - x.t > 0.15) { scene.remove(x.l); x.l.geometry.dispose(); return false; } return true; });
  // under the boss bar: its gunners, its deliveries, what it said
  if (!__BVC.hud) { __BVC.hud = document.createElement('div'); __BVC.hud.style.cssText = 'position:fixed;left:50%;top:98px;transform:translateX(-50%);z-index:13;pointer-events:none;font:600 12px/1.4 ui-monospace,monospace;color:#e8e6e1;text-align:center;text-shadow:0 1px 2px #000'; document.body.appendChild(__BVC.hud);
    __BVC.say = document.createElement('div'); __BVC.say.style.cssText = 'position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:13;pointer-events:none;font:700 17px/1.2 ui-monospace,monospace;letter-spacing:.06em;color:#ffd27a;text-shadow:0 0 10px rgba(0,0,0,.9);text-align:center;opacity:0;transition:opacity .25s'; document.body.appendChild(__BVC.say); }
  __BVC.hud.innerHTML = S.down ? '' : 'gunners ' + Object.values(F.crew).map((c) => '<span style="margin:0 4px;color:' + (c.up ? '#ff9a2e' : '#7d7a75') + '">' + c.name.replace(/^the /, '').replace(/ gunner$/, '') + (c.up ? ' ●' : ' ✕') + '</span>').join('') + ' · delivered ' + F.deliveries;
  if (F.said && F.said !== __BVC.said) { __BVC.said = F.said; __BVC.say.textContent = F.said.text; __BVC.say.style.opacity = '1'; __BVC.sayT = t; }
  if (t - __BVC.sayT > 3.2) __BVC.say.style.opacity = '0';
}
function __bvFrame() {
  const W = __world, t = W.time || 0, __bvSide = !!(W.camera && W.camera.rule && W.camera.rule.type === 'side-map');
  // MARKS: one a hazard, shown from its mark, filling to its landing, bright while it lands
  const seen = new Set();
  for (const h of W.bossHazards || []) {
    seen.add(h.id);
    let m = __BV.marks.get(h.id);
    if (h.track != null && t < h.track && m) { scene.remove(m.grp); m = null; }
    if (!m) { m = __bvSide ? __bvSideMark(h) : __bvMark(h); __BV.marks.set(h.id, m); }
    m.h = h;
    const shown = t >= h.tm, lands = t >= h.t0 && t <= h.t1, u = h.t0 > h.tm ? Math.min(1, Math.max(0, (t - h.tm) / (h.t0 - h.tm))) : 1;
    m.grp.visible = shown;
    if (m.side) {
      // (from the side: its mark filling to its landing; while it lands, the stretch it is on now, bright)
      for (const x of m.tell) x.material.opacity = lands ? 0.08 : 0.1 + 0.3 * u + 0.08 * Math.sin(t * (6 + 10 * u));
      for (const x of m.edge) x.material.opacity = lands ? 0.2 : 0.4 + 0.5 * u;
      if (m.hot) { m.grp.remove(m.hot); m.hot.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); m.hot = null; }
      if (lands) { m.hot = __bvBands(__bvLane(h, t), h, m.hex, 0.75); m.grp.add(m.hot); }
      continue;
    }
    const beat = 0.5 + 0.5 * Math.sin(t * (6 + 10 * u));
    for (const x of m.tell) x.material.opacity = lands ? 0.12 : 0.12 + 0.32 * u + 0.1 * beat;
    const k = h.t1 > h.t0 ? Math.min(1, Math.max(0, (t - h.t0) / (h.t1 - h.t0))) : 1;
    if (h.shape === 'sweep') { m.hot.visible = lands; m.hot.rotation.z = h.a0 + (h.a1 - h.a0) * k; }
    else if (h.shape === 'ring') { const r = h.r0 + (h.r1 - h.r0) * k; m.hot.visible = lands; m.hot.geometry.dispose(); m.hot.geometry = new THREE.RingGeometry(Math.max(0.01, r - h.band / 2), r + h.band / 2, 64); }
    else if (h.shape === 'strafe') { const n = m.hot.length - 1, dt = (h.t1 - h.t0) / Math.max(1, n); m.hot.forEach((y, i) => { const tk = h.t0 + i * dt; y.visible = t >= tk && t <= tk + 0.5; }); }
    else m.hot.visible = lands;
  }
  for (const [id, m] of __BV.marks) if (!seen.has(id)) { scene.remove(m.grp); __BV.marks.delete(id); }
  // MINES: amber while they arm, red once armed
  const ms = new Set();
  for (const q of W.mines || []) {
    ms.add(q.id);
    let o = __BV.mines.get(q.id);
    if (!o) { o = new THREE.Group(); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0x3b3f33 })); base.rotation.x = Math.PI / 2; o.add(base); o.light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb000 })); o.light.position.z = 0.07; o.add(o.light); o.position.set(q.at[0], q.at[1], q.at[2] + 0.04); scene.add(o); __BV.mines.set(q.id, o); }
    const armed = t >= q.armAt; o.light.material.color.set(armed ? 0xff2a1a : 0xffb000); o.light.visible = armed ? Math.sin(t * 8) > -0.2 : Math.sin(t * 16) > 0;
  }
  for (const [id, o] of __BV.mines) if (!ms.has(id)) { scene.remove(o); __BV.mines.delete(id); }
  // A HUMAN BOSS'S COUNTERS, on its body as they are now
  for (const e of W.entities) {
    const B = e.rule && e.rule.boss;
    if (!B || B.kind !== 'human' || !B.counters || !e.bossS) continue;
    const g = __bodies[e.id];
    if (!g || !g.userData || !g.userData.rigFig) continue;
    let K = __BV.props.get(e.id);
    // (on its body as it is: a phase's look swapped in is another body, the props carried over to it)
    if (!K || K.g !== g) { if (K) for (const x of K.items) { scene.remove(x.o); if (x.hose) scene.remove(x.hose.mesh); } K = { g, items: __bvProps(e, g, B) }; __BV.props.set(e.id, K); }
    const st = (W.bosses && W.bosses[e.id] && W.bosses[e.id].counters) || {};
    for (const x of K.items) {
      const c = st[x.id] || {};
      if (x.gone) continue;
      x.bone.updateWorldMatrix(true, false); x.o.matrix.multiplyMatrices(x.bone.matrixWorld, x.off); x.o.matrixWorldNeedsUpdate = true;
      x.o.visible = g.visible; if (x.hose) x.hose.mesh.visible = g.visible;
      if (c.broken || e.gone) {
        // (it ruptures: a ball of fire where it was, the canister and its hose gone)
        x.gone = true; x.o.getWorldPosition(__bvV);
        for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffb347 : 0xff5a1a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); f.position.copy(__bvV); f.userData = { t0: t, v: [Math.cos(k * 0.9) * 1.6, Math.sin(k * 0.9) * 1.6, 1.2 + (k % 3) * 0.6] }; scene.add(f); __BV.fires.push(f); }
        x.o.visible = false; if (x.hose) x.hose.mesh.visible = false;
        continue;
      }
      if ((c.hits || 0) > x.hits) { x.hits = c.hits; x.flash = t; }
      x.mat.color.setScalar(t - x.flash < 0.14 ? 3 : 1);
      x.glow.material.opacity = c.bare ? 0.28 + 0.22 * Math.sin(t * 11) : 0;
      // (its hose: from the canister's foot, sagging, to the right hand)
      if (x.hose) {
        x.o.localToWorld(__bvV.set(0, 0, -x.Q.h * 0.42));
        const a = x.hose.at; x.hose.bone.updateWorldMatrix(true, false); __bvW.set(a[0], a[1], a[2]).applyMatrix4(x.hose.bone.matrixWorld);
        const mid = __bvV.clone().lerp(__bvW, 0.5); mid.z -= 0.35;
        const curve = new THREE.CatmullRomCurve3([__bvV.clone(), __bvV.clone().lerp(mid, 0.6).setZ(Math.min(__bvV.z, mid.z) - 0.05), mid, __bvW.clone()]);
        x.hose.mesh.geometry.dispose(); x.hose.mesh.geometry = new THREE.TubeGeometry(curve, 14, 0.022, 6, false);
      }
    }
  }
  // A SCOPE's GLINT and a blinded boss's sparks
  for (const e of W.entities) {
    const B = e.rule && e.rule.boss;
    if (!B || B.kind !== 'human' || !e.bossS) continue;
    let G = __BV.props.get(e.id + ':glint');
    if (!G) { G = { flare: __bvSprite((B.look && B.look.tell) || '#e8f4ff', 0.6), sparks: [0, 1, 2].map(() => __bvSprite('#ffffff', 0.18)) }; __BV.props.set(e.id + ':glint', G); }
    const S = e.bossS, C = S.cur, scoped = !!(C && C.scope && t < C.openAt && !e.gone), blind = S.blind != null && t < S.blind && !e.gone;
    G.flare.visible = scoped; G.sparks.forEach((x) => { x.visible = blind; });
    if (!scoped && !blind) continue;
    __bvHead(e, __bvV);
    if (scoped) {
      // (at the eye, a hand ahead along the aim; growing and quickening as the shot nears)
      const h = e.transform.heading || 0, u = Math.min(1, Math.max(0, (t - C.t0) / Math.max(0.1, C.openAt - C.t0)));
      G.flare.position.set(__bvV.x + Math.cos(h) * 0.22 - Math.sin(h) * 0.04, __bvV.y + Math.sin(h) * 0.22 + Math.cos(h) * 0.04, __bvV.z - 0.02);
      G.flare.scale.setScalar((0.35 + 0.9 * u) * (0.75 + 0.25 * Math.sin(t * (10 + 20 * u))));
    }
    if (blind) G.sparks.forEach((x, k) => { const a = t * 4 + (k * 2 * Math.PI) / 3; x.position.set(__bvV.x + Math.cos(a) * 0.32, __bvV.y + Math.sin(a) * 0.32, __bvV.z + 0.3 + 0.04 * Math.sin(t * 9 + k)); });
  }
  // (the fire a counter goes up in: thrown out and fading)
  __BV.fires = __BV.fires.filter((f) => { const u = t - f.userData.t0, v = f.userData.v; if (u > 1.4) { scene.remove(f); f.geometry.dispose(); return false; } f.position.x += v[0] * 0.016; f.position.y += v[1] * 0.016; f.position.z += v[2] * 0.016; f.scale.setScalar(1 + u * 3); f.material.opacity = 0.9 * (1 - u / 1.4); return true; });
  // A VEHICLE'S PARTS, as they are now
  for (const e of W.entities) {
    const B = e.rule && e.rule.boss;
    if (!B || B.kind !== 'vehicle' || !e.bossS) continue;
    let P = __BV.parts.get(e.id);
    if (!P) {
      P = { grp: new THREE.Group(), boxes: {} };
      // (how it looks: its dress, apart from the parts a hit is judged on)
      for (const d of B.frame ? [] : B.dress || []) { const [a, b] = d.box, g = new THREE.BoxGeometry(Math.max(0.03, b[0] - a[0]), Math.max(0.03, b[1] - a[1]), Math.max(0.03, b[2] - a[2])), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.fill), ...(d.alpha != null ? { transparent: true, opacity: d.alpha, depthWrite: false } : {}) }), x = new THREE.Mesh(g, mat); x.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); P.grp.add(x); }
      for (const [id, p] of Object.entries(B.parts)) {
        const [a, b] = p.box, g = new THREE.BoxGeometry(Math.max(0.05, b[0] - a[0]), Math.max(0.05, b[1] - a[1]), Math.max(0.05, b[2] - a[2]));
        const tone = p.weak && (p.mult ?? 1) >= 0.5 ? 0xd8322a : p.takes.includes('mine') ? 0x2a2c2e : p.hits > 0 ? 0x8d9296 : 0x5f6a5a;
        const box = new THREE.Mesh(g, B.frame ? new THREE.MeshBasicMaterial({ color: p.weak ? 0xff3322 : 0xffb030, transparent: true, opacity: 0.3, depthWrite: false }) : new THREE.MeshBasicMaterial({ color: tone }));
        box.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        P.grp.add(box); P.boxes[id] = { box, p, tone };
      }
      scene.add(P.grp); __BV.parts.set(e.id, P);
    }
    P.grp.visible = !e.gone;
    P.grp.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]);
    P.grp.rotation.z = e.transform.heading || 0;
    const S = e.bossS;
    if (B.frame) { __bvMechaParts(W, e, B, S, P, t); if (B.carrier) __bvCarrier(W, e, B, S, t); continue; }
    for (const [id, x] of Object.entries(P.boxes)) {
      const p = x.p, broken = !!S.broken[id], open = !broken && (!p.behind || S.broken[p.behind]) && (!p.shown || [].concat(p.shown).includes(S.state));
      // (a broken track lies wrecked, sagging and dark; a broken plate or joint is gone; the hull is its dress)
      x.box.visible = id !== 'hull' && (!broken || p.takes.includes('mine'));
      if (broken && p.takes.includes('mine') && !x.wrecked) { x.wrecked = true; x.box.material.color.set(0x161616); x.box.scale.set(0.8, 1, 0.55); x.box.position.z -= 0.2; x.box.rotation.y = 0.06; }
      if (p.weak && (p.mult ?? 1) >= 0.5) { x.box.material.color.set(open ? 0xff3322 : 0x4a1a16); x.box.material.opacity = open ? 0.75 + 0.25 * Math.sin(t * 7) : 1; }
    }
  }
  requestAnimationFrame(__bvFrame);
}
requestAnimationFrame(__bvFrame);
`;
}
