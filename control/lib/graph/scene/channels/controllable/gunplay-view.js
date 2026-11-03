// In-page script: the GUNPLAY view (gameworld/arms-kit.js, worlds/controllable/gunplay.js) — what a shooter sees and
// presses with its carried arms. Emitted only into a page whose world has a gunplay rule, after the controllable
// channel's own script (it wraps __readInput and stepControllable, so every other page keeps every byte).
//
//   INPUT   the right mouse aims down the sights (held), Shift steadies a scope (held), R reloads (it no longer cycles
//           here: the wheel and 1–5 switch), the wheel steps the slots that are held; with a look camera A and D
//           strafe (the mouse turns).
//   VIEW    the camera closes to the sight's power as the sights come up (the field of view divided by it), the climb
//           of a spray lifts the view, a scope up shows its picture (the black round, the crosshair and its marks) and
//           hides the gun; the breath held is a bar under it, red while the body wants air.
//   THE GUN IN HAND (first person, a camera that rides the eye): the arm as its parts' boxes (arm-kit's view) in the
//           right hand below the eye, brought to the eye along its sight line as the sights come up (the rear sight at
//           its eye relief); it bobs with the stride, lags the look, kicks back with each round, dips and turns to
//           reload, and switches as two halves (the outgoing lowered out of view over its swapOut, the incoming raised
//           over its swapIn); a bow is drawn with the button held (the string back by the draw, an arrow on it while one
//           is nocked), and its arrows fly as shafts along their flight.
// The viewmodel draws over the world (its depth cleared before it), so it never sinks into a wall.
export function gunplayScript() {
  return `
// ── GUNPLAY ──
const __GP = { aim: false, breath: false, reload: false, wheel: 0, kick: 0, shots: {}, slot: -1, prev: -1, views: {}, bob: 0, lag: [0, 0], lastH: null, lastP: null, fov0: null, fovSet: null, arrows: new Map(), scene: false };
__canvas.addEventListener('mousedown', (ev) => { if (ev.button === 2) __GP.aim = true; });
window.addEventListener('mouseup', (ev) => { if (ev.button === 2) __GP.aim = false; });
__canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
__canvas.addEventListener('wheel', (ev) => { __GP.wheel += ev.deltaY > 0 ? 1 : -1; ev.preventDefault(); }, { passive: false });
window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyR' && !ev.repeat) __GP.reload = true; if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') __GP.breath = true; });
window.addEventListener('keyup', (ev) => { if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') __GP.breath = false; });
window.addEventListener('blur', () => { __GP.aim = false; __GP.breath = false; });
const __gpRead0 = __readInput;
__readInput = function () {
  const inp = __gpRead0(), p = __world.pilotId && __world.byId[__world.pilotId];
  const lo = p && p.rule && p.rule.gunplay && Array.isArray(p.rule.loadout) ? p.rule.loadout : null;
  if (!lo) { __GP.wheel = 0; __GP.reload = false; return inp; }
  if (__held.KeyR) inp.cycle = 0;   // R reloads in a gunplay world; the wheel and 1-5 switch
  // a look camera's A and D strafe (a shooter moves and strafes with the sights up), the mouse turns
  if (__MOUSELOOK && inp.turn && !inp.strafe) { inp.strafe = inp.turn; inp.turn = 0; }
  if (__GP.wheel) { const n = lo.length, H = p.loadoutHeld, d = __GP.wheel > 0 ? 1 : -1; let i = p.loadoutIdx || 0; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!H || H[i]) break; } if (i !== (p.loadoutIdx || 0)) inp.slot = i + 1; }
  __GP.wheel = 0;
  inp.aim = __GP.aim ? 1 : 0; inp.breath = __GP.breath ? 1 : 0; inp.reload = __GP.reload ? 1 : 0; __GP.reload = false;
  return inp;
};
// the scope's picture and the breath's bar
const __gpScope = document.createElement('div');
__gpScope.style.cssText = 'position:fixed;inset:0;pointer-events:none;display:none;z-index:6;background:radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 33vmin, rgba(0,0,0,0.55) 33.6vmin, #000 35vmin)';
__gpScope.innerHTML = '<svg viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet" style="position:absolute;inset:0;width:100%;height:100%"><g stroke="#111" stroke-width="0.35" fill="none"><line x1="-66" y1="0" x2="-3" y2="0"/><line x1="3" y1="0" x2="66" y2="0"/><line x1="0" y1="-66" x2="0" y2="-3"/><line x1="0" y1="3" x2="0" y2="66"/><line x1="-66" y1="0" x2="-30" y2="0" stroke-width="1.6"/><line x1="30" y1="0" x2="66" y2="0" stroke-width="1.6"/><line x1="0" y1="30" x2="0" y2="66" stroke-width="1.6"/></g><g fill="#111">' + [-24, -16, -8, 8, 16, 24].map((k) => '<circle cx="' + k + '" cy="0" r="0.7"/><circle cx="0" cy="' + k + '" r="0.7"/>').join('') + '</g><circle r="0.45" fill="#c22"/></svg><div style="position:absolute;left:50%;top:calc(50% + 37vmin);width:18vmin;height:0.8vmin;margin-left:-9vmin;background:rgba(255,255,255,0.15)"><div data-breath style="height:100%;width:100%;background:#cfe8ff"></div></div>';
document.body.appendChild(__gpScope);
const __gpBreath = __gpScope.querySelector('[data-breath]');
const __gpD = Math.PI / 180;
// the arm's view: its parts' boxes, item frame (x across, y up, z along the bore, cm) turned onto the camera's (the bore
// along -z, up +y: a half turn about y)
function __gpBuild(g) {
  const grp = new THREE.Group(), mats = new Map();
  // (the world's faces carry their light baked: a box is shaded the same way, by which way each face looks)
  const mat = () => { if (!mats.has(0)) mats.set(0, new THREE.MeshBasicMaterial({ vertexColors: true })); return mats.get(0); };
  const shade = (geo, c) => {
    const base = new THREE.Color(c), n = geo.attributes.normal, col = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) { const k = n.getY(i) > 0.5 ? 1.25 : n.getY(i) < -0.5 ? 0.55 : Math.abs(n.getX(i)) > 0.5 ? 0.85 : 1.0; col[3 * i] = Math.min(1, base.r * k + 0.04); col[3 * i + 1] = Math.min(1, base.g * k + 0.04); col[3 * i + 2] = Math.min(1, base.b * k + 0.05); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
  };
  const slab = (s, at, c, into) => { const m = new THREE.Mesh(shade(new THREE.BoxGeometry(s[0], s[1], s[2]), c), mat()); m.position.set(at[0], at[1], at[2]); (into || grp).add(m); return m; };
  const box = (lo, hi, c, into) => slab([0, 1, 2].map((i) => Math.max(0.15, hi[i] - lo[i]) / 100), [-(lo[0] + hi[0]) / 200, (lo[1] + hi[1]) / 200, -(lo[2] + hi[2]) / 200], c, into);
  const V = { grp, kind: g.view.kind, behind: [] };
  if (g.view.kind === 'bow') {
    // a bow before the eye, canted, left of the line: the riser, two limbs swept back to their tips, the string, an arrow
    const L = (g.view.length || 1.5) / 2, bow = new THREE.Group(); grp.add(bow); bow.rotation.z = -0.32;
    slab([0.028, 0.16, 0.035], [0, 0, 0], '#6a4a2e', bow);
    for (const s of [1, -1]) { const limb = new THREE.Group(); limb.position.set(0, s * 0.08, 0); limb.rotation.x = s * 0.1; bow.add(limb); slab([0.016, L, 0.012], [0, s * L / 2, 0], '#7b5a38', limb); }
    V.tips = [new THREE.Vector3(0, 0.08 + L * Math.cos(0.1), L * Math.sin(0.1)), new THREE.Vector3(0, -(0.08 + L * Math.cos(0.1)), L * Math.sin(0.1))];
    V.string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V.tips[0], new THREE.Vector3(0, 0, 0.16), V.tips[1]]), new THREE.LineBasicMaterial({ color: '#e8e2d0' }));
    bow.add(V.string);
    V.arrow = slab([0.006, 0.006, 0.74], [0, 0, 0], '#b8965f', bow); V.bow = bow;
    V.hip = [-0.12, -0.04, -0.62]; V.ads = [-0.03, 0.005, -0.62]; V.brace = 0.16;
  } else {
    for (const [lo, hi, c, part] of g.view.boxes) {
      let m;
      if (part === 'optic') {
        // an optic is a hood round its window, open along the sight line (a solid box would blind the eye behind it)
        const t = 0.25, o = new THREE.Group(); grp.add(o); m = o;
        box([lo[0], lo[1], lo[2]], [lo[0] + t, hi[1], hi[2]], c, o); box([hi[0] - t, lo[1], lo[2]], [hi[0], hi[1], hi[2]], c, o);
        box([lo[0], hi[1] - t, lo[2]], [hi[0], hi[1], hi[2]], c, o); box([lo[0], lo[1], lo[2]], [hi[0], lo[1] + t, hi[2]], c, o);
      } else m = box(lo, hi, c);
      // (the stock and its pad run back past the eye to the shoulder: drawn from the hip, gone at the sights)
      if (part === 'stock' || part === 'buttpad' || part === 'cheek') V.behind.push(m);
      if (part === 'magazine') V.mag = m;
    }
    const gp = g.view.grip, s = g.view.sight, hand = g.view.kind === 'handgun';
    // the hip: the fist below and right of the eye; the sights: the rear sight on the eye's line at its relief
    const fist = hand ? [0.12, -0.13, -0.42] : [0.13, -0.15, -0.3];
    V.hip = [fist[0] + gp[0] / 100, fist[1] - gp[1] / 100, fist[2] + gp[2] / 100];
    const eye = g.view.relief ? g.view.relief / 100 : hand ? 0.42 : 0.17;
    V.ads = [0, -s.y / 100, -eye + s.rear / 100];
  }
  grp.traverse((o) => { if (o.isMesh || o.isLine) { o.renderOrder = 1e6; o.frustumCulled = false; } });
  let first = null; grp.traverse((o) => { if (!first && o.isMesh) first = o; });
  if (first) { first.renderOrder = 1e6 - 1; first.onBeforeRender = (r) => r.clearDepth(); }
  grp.visible = false; camera.add(grp);
  return V;
}
function __gpEase(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function __gpFrame(dt) {
  const p = __world.pilotId && __world.byId[__world.pilotId];
  const lo = p && p.rule && p.rule.gunplay && Array.isArray(p.rule.loadout) ? p.rule.loadout : null;
  const idx = p ? p.loadoutIdx || 0 : 0, S = lo ? lo[idx] : null, g = S && S.gunplay, w = p && p.weapon;
  for (const k in __GP.views) __GP.views[k].grp.visible = false;
  if (!g || !w) { __gpScope.style.display = 'none'; return; }
  if (!__GP.scene) { scene.add(camera); if (camera.near > 0.03) { camera.near = 0.03; camera.updateProjectionMatrix(); } __GP.scene = true; }
  const G = p.gp || { aim: 0 }, a = __gpEase(G.aim);
  // (a drawn bow is its own sign of the charge: no charge ring at its muzzle)
  if (typeof __chgRings !== 'undefined' && __chgRings[p.id]) __chgRings[p.id].ring.visible = false;
  // the view's power: the page's own field of view, divided by the sight's power as it comes up
  if (__GP.fovSet == null || Math.abs(camera.fov - __GP.fovSet) > 1e-6) __GP.fov0 = camera.fov;
  const z = 1 + (g.ads.zoom - 1) * a, fov = 2 * Math.atan(Math.tan(__GP.fov0 * __gpD / 2) / z) / __gpD;
  if (Math.abs(camera.fov - fov) > 1e-4) { camera.fov = fov; camera.updateProjectionMatrix(); }
  __GP.fovSet = camera.fov;
  // the climb of a spray lifts the view (the round already leaves along it)
  if (w.kickNow) camera.rotateX(w.kickNow * 0.6 * __gpD);
  const fp = !!(__world.camera && __world.camera.rule && __world.camera.rule.type === 'eye');
  const scoped = !!g.ads.scope && a > 0.92;
  __gpScope.style.display = scoped ? 'block' : 'none';
  if (scoped) { const b = G.tired > 0 ? 1 : (G.breath || 0) / 4; __gpBreath.style.width = Math.round((1 - b) * 100) + '%'; __gpBreath.style.background = G.tired > 0 ? '#e55' : '#cfe8ff'; }
  if (!fp || scoped) return;
  // the switch: the outgoing lowered over its swapOut, the incoming raised over its swapIn
  if (__GP.slot !== idx) { __GP.prev = __GP.slot; __GP.slot = idx; }
  let show = idx, low = 0;
  if ((p.readyT || 0) > 0 && p.readyMax > 0) {
    const k = 1 - p.readyT / p.readyMax, sw = g.swap || { out: 0.3, in: 0.4 }, cut = sw.out / Math.max(1e-6, sw.out + sw.in);
    if (k < cut && __GP.prev >= 0 && lo[__GP.prev] && lo[__GP.prev].gunplay) { show = __GP.prev; low = __gpEase(k / cut); }
    else low = 1 - __gpEase((k - cut) / Math.max(1e-6, 1 - cut));
  }
  const SG = lo[show].gunplay, key = String(show);
  const V = __GP.views[key] || (__GP.views[key] = __gpBuild(SG));
  // the stride's bob, the look's lag, the round's kick, the reload's dip
  const pos = p.transform.pos, sp = __GP.lastP && dt > 0 ? Math.min(8, Math.hypot(pos[0] - __GP.lastP[0], pos[1] - __GP.lastP[1]) / dt) : 0;
  __GP.lastP = [pos[0], pos[1]];
  __GP.bob += dt * (2 + sp * 1.6);
  const dh = __GP.lastH == null ? 0 : Math.atan2(Math.sin(p.transform.heading - __GP.lastH), Math.cos(p.transform.heading - __GP.lastH));
  __GP.lastH = p.transform.heading;
  const lagK = Math.min(1, dt * 12); __GP.lag[0] += (Math.max(-0.05, Math.min(0.05, dh * 0.6)) - __GP.lag[0]) * lagK; __GP.lag[1] += (0 - __GP.lag[1]) * lagK;
  if (__GP.shots[key] !== undefined && w.shots > __GP.shots[key] && show === idx) __GP.kick = 1;
  __GP.shots[key] = show === idx ? w.shots : __GP.shots[key] ?? 0;
  __GP.kick = Math.max(0, __GP.kick - dt * 9);
  const hipK = 1 - 0.85 * a, mv = Math.min(1, sp / 4);
  const re = w.reloading && w.reload > 0 ? Math.sin(Math.PI * (1 - w.reloadT / w.reload)) : 0;
  const bobX = 0.011 * Math.sin(__GP.bob) * mv * hipK, bobY = 0.008 * Math.abs(Math.cos(__GP.bob)) * mv * hipK + 0.002 * Math.sin(__GP.bob * 0.35) * hipK;
  // (a bow drawn comes onto the line as the sights do)
  const up = V.kind === 'bow' ? Math.max(a, __gpEase(G.draw || 0)) : a;
  const P = [0, 1, 2].map((i) => V.hip[i] + (V.ads[i] - V.hip[i]) * up);
  V.grp.position.set(P[0] + bobX - __GP.lag[0] * hipK, P[1] - bobY - 0.32 * low - 0.06 * re, P[2] + 0.035 * __GP.kick);
  V.grp.rotation.set(-0.9 * low + 0.05 * __GP.kick + 0.35 * re, -__GP.lag[0] * 2 * hipK, 0.45 * re + 0.05 * Math.sin(__GP.bob) * mv * hipK);
  if (V.mag) V.mag.visible = re < 0.85;
  for (const m of V.behind) m.visible = a < 0.3;
  if (V.kind === 'bow') {
    // the string drawn back by the draw, the arrow on it while one is nocked
    const d = G.draw || 0, nockZ = V.brace + 0.5 * d;
    V.string.geometry.setFromPoints([V.tips[0], new THREE.Vector3(0, 0, nockZ), V.tips[1]]);
    V.arrow.visible = w.ammo > 0 && !w.reloading; V.arrow.position.set(0.012, 0, nockZ - 0.37);
  }
  V.grp.visible = true;
}
// the bow's arrows: shafts along their flight (the round's own ball drawn small: fxScale)
function __gpArrows() {
  const p = __world.pilotId && __world.byId[__world.pilotId], live = new Set();
  for (const r of __world.projectiles || []) {
    if (!p || r.owner !== p.id || r.smokeTrail) continue;
    live.add(r.id);
    let m = __GP.arrows.get(r.id);
    if (!m) { m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.75, 6), new THREE.MeshStandardMaterial({ color: '#a88a5c' })); scene.add(m); __GP.arrows.set(r.id, m); }
    m.position.set(r.pos[0], r.pos[1], r.pos[2]);
    const v = new THREE.Vector3(r.vel[0], r.vel[1], r.vel[2]); if (v.lengthSq() > 1e-9) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  }
  for (const [id, m] of __GP.arrows) if (!live.has(id)) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); __GP.arrows.delete(id); }
}
const __gpStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __gpStep0(dt, inputOverride); __gpFrame(dt || 0); __gpArrows(); };
`;
}
