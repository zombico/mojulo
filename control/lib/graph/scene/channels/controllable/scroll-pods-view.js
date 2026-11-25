// In-page script: BLAZE GUNNER'S STRIKES DRAWN (worlds/controllable/scroll-pods.js plays them): each pod's hurtbox drawn
// as light in the pod's hue, the shot's look (gameworld/feel/round-look.js): a white-hot core, the hue round it, additive,
// so what the ship fires reads against space and against a hull. Appended after the controllable channel's own script
// (it wraps stepControllable) on a scroll stage's page whose ship carries an arsenal, or that has foes, only, so every other page keeps
// every byte.
//
//   a SHOT, a BOMB   a core and its halo, camera-facing, sized to what it hits (a bomb pulsing, a pod's colour)
//   a RING           a burst's front, growing to its reach and fading
//   a SWEEP          the blade's arc so far: a band from the nose out to its reach, in the screen's plane
//   the BEAM         a core and a halo from the muzzle along its length, its width what it burns
//   the ORBIT        the ball and its chain to the ship
//   a DROP           a pod where its carrier fell, pulsing in its hue: what an open slot catches
//   a MUZZLE, a HIT  a flash at the nose as a round leaves; a white flash and a ring in the round's hue where it strikes
//   the GUARD        a ring round the ship, flickering, while it is unhurt after a hit
//   its LIGHT        what is fired lights the hulls it passes (`lights()`, laid by the shot light, shot-light-view.js)
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
  const seen = { shot: 0, ring: 0, sweep: 0, beam: 0, orbit: 0, bomb: 0, drop: 0, foeShot: 0, tell: 0, muzzle: 0, guard: 0, impact: 0 };
  function draw() {
    const w = __world, cam = w && w.camera;
    for (const p of Object.values(P)) { p.n = 0; for (const s of p.list) s.visible = false; }
    qn = 0; for (const m of quads) m.visible = false;
    for (const k in seen) seen[k] = 0;
    if (!cam || !cam.rule || cam.rule.type !== 'scroll') return;
    const B = VIEWS[cam.rule.view === 'top' ? 'top' : 'side'], t = w.time || 0, sc = cam.scrollVel || [0, 0];
    for (const e of w.entities) {
      if (!e.strikes || e.gone) continue;
      for (const s of e.strikes) {
        if (!s.w) continue;
        if (s.k === 'shot') {
          // (the shot's look, round-look.js: a white-hot core stretched along its flight, its hue round it, a fading tail
          // behind and nothing ahead of the ball; a still mine its halo alone, pulsing)
          const ru = s.du - sc[0], rv = s.dv - sc[1], sp = Math.hypot(ru, rv);
          if (s.still || sp < 1e-3) { sprite(P.halo, s.w, s.r * 3.4 * (0.85 + 0.15 * Math.sin(t * 9)), s.hue, 0.6); sprite(P.core, s.w, s.r * 1.4, 0xffffff, 0.9); }
          else {
            const tail = Math.min(s.r * 9, sp * 0.06), back = W(B, s.u - (ru / sp) * tail, s.v - (rv / sp) * tail), nose = W(B, s.u + (ru / sp) * s.r * 0.6, s.v + (rv / sp) * s.r * 0.6);
            // (the ball always round, at the head: a thin white streak through it gives the flight, never a block)
            quad(B, back, s.w, s.r * 1.6, s.hue, 0.5);
            sprite(P.halo, s.w, s.r * 4.6, s.hue, 0.6);
            sprite(P.core, s.w, s.r * 2.1, 0xffffff, 0.95);
            quad(B, W(B, s.u - (ru / sp) * s.r * 3, s.v - (rv / sp) * s.r * 3), nose, s.r * 0.45, 0xffffff, 0.85);
          }
          seen.shot++;
        }
        else if (s.k === 'bomb') { const pulse = 0.75 + 0.25 * Math.sin(t * 24); sprite(P.halo, s.w, 3.2 * pulse, s.hue, 0.8); sprite(P.core, s.w, 1.4, 0xffffff, 0.9); seen.bomb++; }
        else if (s.k === 'ring') { const k = Math.min(1, s.t / s.life); sprite(P.ring, s.w, Math.max(0.1, s.r * 2.1), s.hue, 1 - k * 0.8); sprite(P.halo, s.w, Math.max(0.1, s.r * 1.6), s.hue, 0.5 * (1 - k)); seen.ring++; }
        else if (s.k === 'sweep') {
          // (the arc swept so far, laid as spokes from the nose: a fan of thin quads in the blade's hue, the newest brightest)
          const a1 = s.a == null ? s.from * Math.PI / 180 : s.a, a0 = s.from * Math.PI / 180, n = 7;
          for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n), tip = W(B, s.u + Math.cos(a) * s.reach, s.v + Math.sin(a) * s.reach), foot = W(B, s.u + Math.cos(a) * s.reach * 0.35, s.v + Math.sin(a) * s.reach * 0.35); quad(B, foot, tip, s.reach * 0.08, i === n ? 0xffffff : s.hue, 0.25 + 0.6 * (i / n)); }
          seen.sweep++;
        }
      }
      // (a MUZZLE flash at the nose as a round leaves, its hue's; a ring round the ship while it is unhurt after a hit)
      if (e.lastFire && t - e.lastFire.t < 0.07 && e.screenAt) { const R = (e.rule.size && e.rule.size[0]) || 10; sprite(P.halo, W(B, e.screenAt[0] + R / 2, e.screenAt[1]), R * 0.32, e.lastFire.hue, 0.8); sprite(P.core, W(B, e.screenAt[0] + R / 2, e.screenAt[1]), R * 0.12, 0xffffff, 0.9); seen.muzzle++; }
      if (e._iT > 0 && e.screenAt) { const R = (e.rule.size && e.rule.size[0]) || 10; sprite(P.ring, W(B, e.screenAt[0], e.screenAt[1]), R * (1.25 + 0.05 * Math.sin(t * 30)), 0x9fd8ff, 0.25 + 0.35 * (Math.sin(t * 24) > 0 ? 1 : 0)); seen.guard++; }
      if (e.beam && e.beam.w0) { quad(B, e.beam.w0, e.beam.w1, e.beam.width * 4, e.beam.hue, 0.45); quad(B, e.beam.w0, e.beam.w1, e.beam.width * 1.2, 0xffffff, 0.95); seen.beam++; }
      if (e.orbit && e.orbit.w) { quad(B, e.orbit.wAt, e.orbit.w, 0.12, e.orbit.hue, 0.5); sprite(P.halo, e.orbit.w, e.orbit.r * 4, e.orbit.hue, 0.7); sprite(P.core, e.orbit.w, e.orbit.r * 1.8, 0xffffff, 0.9); seen.orbit++; }
    }
    // the FOES' FIRE: a white core inside a ring in the foes' one hue, read against stars and a hull alike; a foe's TELL a
    // glow in that hue growing at it before it fires
    for (const b of w.foeShots || []) { if (!b.w) continue; sprite(P.halo, b.w, b.r * 4.2, b.hue, 0.5); sprite(P.ring, b.w, b.r * 2.6, b.hue, 1); sprite(P.core, b.w, b.r * 1.7, 0xffffff, 1); seen.foeShot++; }
    for (const e of w.entities) if (e.tellNow > 0 && !e.gone && e.rule && e.rule.hue) { const k = e.tellNow, R = ((e.body && e.body.radius) || 2); sprite(P.halo, e.transform.pos, R * (0.6 + 1.2 * k), e.rule.hue, 0.25 + 0.6 * k); seen.tell++; }
    // an IMPACT where a round struck: a white flash and its hue's ring, a heavy one bigger (blastLook's layers, round-look.js)
    for (const h of w.podHits || []) { const k = Math.min(1, (t - h.t) / 0.25); if (k >= 1) continue; const R = h.big ? 5 : 2.4; sprite(P.core, h.w, R * (1 - 0.5 * k), 0xffffff, 1 - k); sprite(P.ring, h.w, R * (0.6 + 1.6 * k), h.hue, 0.9 * (1 - k)); seen.impact++; }
    for (const d of w.podDrops || []) { if (!d.w) continue; const pulse = 0.8 + 0.2 * Math.sin(t * 6 + d.id); sprite(P.ring, d.w, 3.6 * pulse, d.hue, 0.9); sprite(P.halo, d.w, 2.6, d.hue, 0.6); sprite(P.core, d.w, 1.1, 0xffffff, 0.85); seen.drop++; }
  }
  // THE LIGHT what is fired throws on the hulls (shot-light-view.js, its 'more'): each pod round, burst, bomb and beam in its
  // hue, a muzzle as it fires, the foes' bullets in theirs; spill, not flood (the shot light's own caps)
  const sat = (hex) => { const n = typeof hex === 'number' ? hex : parseInt(String(hex).slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255), m = Math.max(...c, 1e-6); return c.map((v) => v / m); };
  function lights() {
    const w = __world, cam = w && w.camera, out = [];
    if (!cam || !cam.rule || cam.rule.type !== 'scroll') return out;
    const t = w.time || 0, B = VIEWS[cam.rule.view === 'top' ? 'top' : 'side'];
    for (const e of w.entities) {
      if (!e.strikes || e.gone) continue;
      for (const s of e.strikes) {
        if (!s.w) continue;
        if (s.k === 'shot') out.push({ pos: s.w, color: sat(s.hue), reach: Math.max(4, s.r * 14), power: 0.5 });
        else if (s.k === 'ring') out.push({ pos: s.w, color: sat(s.hue), reach: Math.max(6, s.r * 2.2), power: 1 - Math.min(1, s.t / s.life) * 0.7 });
        else if (s.k === 'bomb') out.push({ pos: s.w, color: sat(s.hue), reach: 8, power: 0.7 });
      }
      if (e.beam && e.beam.w0) out.push({ pos: e.beam.w0.map((v, i) => (v + e.beam.w1[i]) / 2), color: sat(e.beam.hue), reach: Math.hypot(...e.beam.w1.map((v, i) => v - e.beam.w0[i])) * 0.6, power: 0.9 });
      if (e.lastFire && t - e.lastFire.t < 0.09 && e.screenAt) { const R = (e.rule.size && e.rule.size[0]) || 10; out.push({ pos: W(B, e.screenAt[0] + R / 2, e.screenAt[1]), color: sat(e.lastFire.hue), reach: R * 1.4, power: 0.8 }); }
    }
    for (const b of w.foeShots || []) if (b.w) out.push({ pos: b.w, color: sat(b.hue), reach: Math.max(4, b.r * 10), power: 0.35 });
    return out;
  }
  return { draw, seen, lights };
})();
const __spvStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __spvStep0(dt, inputOverride); __SPV.draw(); };
window.__mojCtrl.podsDrawn = () => ({ ...__SPV.seen });
`;
}
