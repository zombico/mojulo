// In-page script: THE BOSS FIGHT SEEN (worlds/controllable/boss.js, mines.js) — what a body facing a boss reads off the
// floor before it lands, and what a vehicle shows of itself:
//   a hazard's MARK   from the moment it is shown, its shape on the floor in the boss's tell colour, filling as its landing
//                     nears; while it lands, the shape in the hazard's colour, bright (a sweep its beam turning across the
//                     arc it marked, a ring its front rolling out, a strafe each landing as it comes); gone after
//   a MINE            a small disc and its light: amber while it arms, red once armed
//   a vehicle's PARTS boxes on the vehicle, placed from its pose each frame: a plate steel, a track dark, a weak spot red
//                     and beating while it can be hit, dim while something covers it; a broken part gone
// Emitted only into a page whose world has a boss or a placed weapon, so every other page keeps every byte. Needs THREE,
// scene and __world in scope.
export function bossViewScript() {
  return `
// ── THE BOSS FIGHT SEEN ──
const __BV = { marks: new Map(), mines: new Map(), parts: new Map() };
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
