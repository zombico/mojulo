// In-page script: BLAZE GUNNER'S STRIKES DRAWN (worlds/controllable/scroll-pods.js plays them): each pod's hurtbox drawn
// as light in the pod's hue, the shot's look (gameworld/feel/round-look.js): a white-hot core, the hue round it, additive,
// so what the ship fires reads against space and against a hull. Appended after the controllable channel's own script
// (it wraps stepControllable) on a scroll stage's page whose ship carries an arsenal, or that has foes, only, so every other page keeps
// every byte. A first pass: phase 8's effects pass raises it to the round look's full layers.
//
//   a SHOT, a BOMB   a core and its halo, camera-facing, sized to what it hits (a bomb pulsing, a pod's colour)
//   a RING           a burst's front, growing to its reach and fading
//   a SWEEP          the blade's arc so far: a band from the nose out to its reach, in the screen's plane
//   the BEAM         a core and a halo from the muzzle along its length, its width what it burns
//   the ORBIT        the ball and its chain to the ship
//   a DROP           a pod where its carrier fell, pulsing in its hue: what an open slot catches
//   a FOE'S BULLET   a white core in a ring of the foes' one hue (worlds/controllable/scroll-foes.js); a foe's TELL a glow
//                    growing at it before it fires
//
// `window.__mojCtrl.podsDrawn()` says how many of each were drawn this frame (a page's check).
export function scrollPodsScript() {
  return `
// ── THE PODS' STRIKES ──
const __SPV = (() => {
  const VIEWS = { side: { along: [0, 1, 0], across: [0, 0, 1], toward: [1, 0, 0] }, top: { along: [0, 1, 0], across: [-1, 0, 0], toward: [0, 0, 1] } };
  const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const glow = tex((g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const ring = tex((g) => { g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke(); });
  const root = new THREE.Group(); root.renderOrder = 10; scene.add(root);
  const mat = (map, color) => new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const pool = (map) => ({ map, list: [], n: 0 });
  const P = { halo: pool(glow), core: pool(glow), ring: pool(ring) };
  const sprite = (p, at, size, color, alpha) => {
    let s = p.list[p.n];
    if (!s) { s = new THREE.Sprite(mat(p.map, 0xffffff)); root.add(s); p.list.push(s); }
    p.n++; s.visible = true; s.position.set(at[0], at[1], at[2]); s.scale.set(size, size, 1); s.material.color.set(color); s.material.opacity = alpha;
  };
  // (a quad in the screen's plane: from its start along the way it points, its width across, additive)
  const quads = [], qMat = (c) => new THREE.MeshBasicMaterial({ color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
  let qn = 0;
  const quad = (B, a, b, width, color, alpha) => {
    let m = quads[qn];
    if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), qMat(0xffffff)); root.add(m); quads.push(m); }
    qn++; m.visible = true;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1e-3, x = d.map((v) => v / L), z = B.toward, y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    m.matrixAutoUpdate = false;
    m.matrix.set(x[0] * L, y[0] * width, z[0], (a[0] + b[0]) / 2 + z[0] * 0.05, x[1] * L, y[1] * width, z[1], (a[1] + b[1]) / 2 + z[1] * 0.05, x[2] * L, y[2] * width, z[2], (a[2] + b[2]) / 2 + z[2] * 0.05, 0, 0, 0, 1);
    m.material.color.set(color); m.material.opacity = alpha;
  };
  const W = (B, u, v) => [B.along[0] * u + B.across[0] * v, B.along[1] * u + B.across[1] * v, B.along[2] * u + B.across[2] * v];
  const seen = { shot: 0, ring: 0, sweep: 0, beam: 0, orbit: 0, bomb: 0, drop: 0, foeShot: 0, tell: 0 };
  function draw() {
    const w = __world, cam = w && w.camera;
    for (const p of Object.values(P)) { p.n = 0; for (const s of p.list) s.visible = false; }
    qn = 0; for (const m of quads) m.visible = false;
    for (const k in seen) seen[k] = 0;
    if (!cam || !cam.rule || cam.rule.type !== 'scroll') return;
    const B = VIEWS[cam.rule.view === 'top' ? 'top' : 'side'], t = w.time || 0;
    for (const e of w.entities) {
      if (!e.strikes || e.gone) continue;
      for (const s of e.strikes) {
        if (!s.w) continue;
        if (s.k === 'shot') { sprite(P.halo, s.w, s.r * 5, s.hue, 0.55); sprite(P.core, s.w, s.r * 2.2, 0xffffff, 0.95); seen.shot++; }
        else if (s.k === 'bomb') { const pulse = 0.75 + 0.25 * Math.sin(t * 24); sprite(P.halo, s.w, 3.2 * pulse, s.hue, 0.8); sprite(P.core, s.w, 1.4, 0xffffff, 0.9); seen.bomb++; }
        else if (s.k === 'ring') { const k = Math.min(1, s.t / s.life); sprite(P.ring, s.w, Math.max(0.1, s.r * 2.1), s.hue, 1 - k * 0.8); sprite(P.halo, s.w, Math.max(0.1, s.r * 1.6), s.hue, 0.5 * (1 - k)); seen.ring++; }
        else if (s.k === 'sweep') {
          // (the arc swept so far, laid as spokes from the nose: a fan of thin quads in the blade's hue, the newest brightest)
          const a1 = s.a == null ? s.from * Math.PI / 180 : s.a, a0 = s.from * Math.PI / 180, n = 7;
          for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n), tip = W(B, s.u + Math.cos(a) * s.reach, s.v + Math.sin(a) * s.reach), foot = W(B, s.u + Math.cos(a) * s.reach * 0.35, s.v + Math.sin(a) * s.reach * 0.35); quad(B, foot, tip, s.reach * 0.08, i === n ? 0xffffff : s.hue, 0.25 + 0.6 * (i / n)); }
          seen.sweep++;
        }
      }
      if (e.beam && e.beam.w0) { quad(B, e.beam.w0, e.beam.w1, e.beam.width * 4, e.beam.hue, 0.45); quad(B, e.beam.w0, e.beam.w1, e.beam.width * 1.2, 0xffffff, 0.95); seen.beam++; }
      if (e.orbit && e.orbit.w) { quad(B, e.orbit.wAt, e.orbit.w, 0.12, e.orbit.hue, 0.5); sprite(P.halo, e.orbit.w, e.orbit.r * 4, e.orbit.hue, 0.7); sprite(P.core, e.orbit.w, e.orbit.r * 1.8, 0xffffff, 0.9); seen.orbit++; }
    }
    // the FOES' FIRE: a white core inside a ring in the foes' one hue, read against stars and a hull alike; a foe's TELL a
    // glow in that hue growing at it before it fires
    for (const b of w.foeShots || []) { if (!b.w) continue; sprite(P.halo, b.w, b.r * 4.2, b.hue, 0.5); sprite(P.ring, b.w, b.r * 2.6, b.hue, 1); sprite(P.core, b.w, b.r * 1.7, 0xffffff, 1); seen.foeShot++; }
    for (const e of w.entities) if (e.tellNow > 0 && !e.gone && e.rule && e.rule.hue) { const k = e.tellNow, R = ((e.body && e.body.radius) || 2); sprite(P.halo, e.transform.pos, R * (0.6 + 1.2 * k), e.rule.hue, 0.25 + 0.6 * k); seen.tell++; }
    for (const d of w.podDrops || []) { if (!d.w) continue; const pulse = 0.8 + 0.2 * Math.sin(t * 6 + d.id); sprite(P.ring, d.w, 3.6 * pulse, d.hue, 0.9); sprite(P.halo, d.w, 2.6, d.hue, 0.6); sprite(P.core, d.w, 1.1, 0xffffff, 0.85); seen.drop++; }
  }
  return { draw, seen };
})();
const __spvStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __spvStep0(dt, inputOverride); __SPV.draw(); };
window.__mojCtrl.podsDrawn = () => ({ ...__SPV.seen });
`;
}
