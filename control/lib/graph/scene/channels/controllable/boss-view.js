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
function __bvFrame() {
  const W = __world, t = W.time || 0;
  // MARKS: one a hazard, shown from its mark, filling to its landing, bright while it lands
  const seen = new Set();
  for (const h of W.bossHazards || []) {
    seen.add(h.id);
    let m = __BV.marks.get(h.id);
    if (h.track != null && t < h.track && m) { scene.remove(m.grp); m = null; }
    if (!m) { m = __bvMark(h); __BV.marks.set(h.id, m); }
    m.h = h;
    const shown = t >= h.tm, lands = t >= h.t0 && t <= h.t1, u = h.t0 > h.tm ? Math.min(1, Math.max(0, (t - h.tm) / (h.t0 - h.tm))) : 1;
    m.grp.visible = shown;
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
      for (const d of B.dress || []) { const [a, b] = d.box, g = new THREE.BoxGeometry(Math.max(0.03, b[0] - a[0]), Math.max(0.03, b[1] - a[1]), Math.max(0.03, b[2] - a[2])), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.fill), ...(d.alpha != null ? { transparent: true, opacity: d.alpha, depthWrite: false } : {}) }), x = new THREE.Mesh(g, mat); x.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); P.grp.add(x); }
      for (const [id, p] of Object.entries(B.parts)) {
        const [a, b] = p.box, g = new THREE.BoxGeometry(Math.max(0.05, b[0] - a[0]), Math.max(0.05, b[1] - a[1]), Math.max(0.05, b[2] - a[2]));
        const tone = p.weak && (p.mult ?? 1) >= 0.5 ? 0xd8322a : p.takes.includes('mine') ? 0x2a2c2e : p.hits > 0 ? 0x8d9296 : 0x5f6a5a;
        const box = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: tone }));
        box.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
        P.grp.add(box); P.boxes[id] = { box, p, tone };
      }
      scene.add(P.grp); __BV.parts.set(e.id, P);
    }
    P.grp.visible = !e.gone;
    P.grp.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]);
    P.grp.rotation.z = e.transform.heading || 0;
    const S = e.bossS;
    for (const [id, x] of Object.entries(P.boxes)) {
      const p = x.p, broken = !!S.broken[id], open = !broken && (!p.behind || S.broken[p.behind]) && (!p.shown || p.shown === S.state);
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
