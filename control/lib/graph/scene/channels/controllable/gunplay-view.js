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
//   THE GUN IN THE HERO'S HANDS (a camera off the eye: over the shoulder, a chase): the same arm in its own frame,
//           carried by the body: the chest side-on to the line, a long gun's butt in the right shoulder's pocket and a
//           pistol out at the arms' reach, at a low ready until the sights come up or a round goes, each hand closed on
//           its station (the kit's view.hands, arms/handling.js); laid over the rig's pose each time it is posed.
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
// along -z, up +y: a half turn about y); \`held\`, the item's own frame in metres, for a body to carry (__gpHold)
function __gpBuild(g, held) {
  const f = held ? 1 : -1;
  const grp = new THREE.Group(), mats = new Map();
  // (the world's faces carry their light baked: a box is shaded the same way, by which way each face looks)
  const mat = () => { if (!mats.has(0)) mats.set(0, new THREE.MeshBasicMaterial({ vertexColors: true })); return mats.get(0); };
  const shade = (geo, c) => {
    const base = new THREE.Color(c), n = geo.attributes.normal, col = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) { const k = n.getY(i) > 0.5 ? 1.25 : n.getY(i) < -0.5 ? 0.55 : Math.abs(n.getX(i)) > 0.5 ? 0.85 : 1.0; col[3 * i] = Math.min(1, base.r * k + 0.04); col[3 * i + 1] = Math.min(1, base.g * k + 0.04); col[3 * i + 2] = Math.min(1, base.b * k + 0.05); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
  };
  const slab = (s, at, c, into) => { const m = new THREE.Mesh(shade(new THREE.BoxGeometry(s[0], s[1], s[2]), c), mat()); m.position.set(at[0], at[1], at[2]); (into || grp).add(m); return m; };
  const box = (lo, hi, c, into) => slab([0, 1, 2].map((i) => Math.max(0.15, hi[i] - lo[i]) / 100), [f * (lo[0] + hi[0]) / 200, (lo[1] + hi[1]) / 200, f * (lo[2] + hi[2]) / 200], c, into);
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
  // (carried, it is never footing, cover or a mark: no ray finds it)
  if (held) { grp.matrixAutoUpdate = false; grp.visible = false; grp.traverse((o) => { o.raycast = function () {}; }); return V; }
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
  if (fp && window.__mojMuzzle) __gpMz(p.id, null);
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
  if (V.kind !== 'bow') { camera.updateMatrixWorld(true); __gpMz(p.id, V.grp.localToWorld(new THREE.Vector3(0, 0, -(SG.view.muzzle || 0) / 100))); }
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
// THE GUN IN THE HERO'S HANDS (a camera off the eye: over the shoulder, a chase): the arm drawn in its own frame and
// carried by the body as a shooter carries it. The upper body turns side-on to the line (a long gun's butt in the right
// shoulder's pocket, a pistol out at the arms' reach), the gun points along the look (dipped at a low ready until the
// sights come up or a round goes), and each hand closes on its station (arms/handling.js, the kit's view.hands): the
// fist's centre, its index side, its long axis; the arm reached to it in two bones, the elbow down. Laid over the rig's
// pose each time the rig is posed (its sync wrapped), never accumulated; a rig without the bones carries nothing.
const __gpHeld = {}, __gpV = () => new THREE.Vector3();
// where a drawn gun's muzzle stands in the world, by its holder (the channel's shot effects start there)
const __gpMz = (id, v) => { const M = window.__mojMuzzle || (window.__mojMuzzle = {}); if (v) M[id] = [v.x, v.y, v.z]; else delete M[id]; };
const __gpT = { a: __gpV(), b: __gpV(), c: __gpV(), d: __gpV(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), m: new THREE.Matrix4(), m2: new THREE.Matrix4(), one: new THREE.Vector3(1, 1, 1), z: new THREE.Vector3(0, 0, 1) };
const __gpA = (a) => new THREE.Vector3(a[0], a[1], a[2]);
function __gpHoldRig(rig) {
  if (rig.__hold !== undefined) return rig.__hold;
  const B = rig.fig.bones, ix = (id) => B.findIndex((b) => b.id === id);
  const side = (s) => {
    const up = ix('upperArm' + s), fo = ix('foreArm' + s) >= 0 ? ix('foreArm' + s) : ix('forearm' + s), hand = ix('hand' + s);
    if (up < 0 || fo < 0 || hand < 0) return null;
    const fingers = []; B.forEach((b, i) => { if (/^(thumb|index|middle|ring|little)[0-9]/.test(b.id) && b.id.slice(-1) === s) fingers.push(i); });
    // the digits as chains from the knuckle out, each with the axis it bends about toward the palm (rest frame)
    const chains = ['thumb', 'index', 'middle', 'ring', 'little'].map((d) => ({ d, bones: [1, 2, 3].map((k) => ix(d + k + s)).filter((i) => i >= 0) })).filter((c) => c.bones.length);
    const h = B[hand], i1 = ix('index1' + s), l1 = ix('little1' + s);
    const a0 = __gpA(h.tail).sub(__gpA(h.head)), hl = a0.length(); a0.normalize();
    const c0 = i1 >= 0 && l1 >= 0 ? __gpA(B[i1].head).sub(__gpA(B[l1].head)) : new THREE.Vector3(0, 1, 0);
    c0.addScaledVector(a0, -c0.dot(a0)).normalize();
    // (the palm: inward on either hand, so the right's is c × a and the left's a × c)
    const palm = s === 'R' ? c0.clone().cross(a0) : a0.clone().cross(c0);
    return { up, fo, hand, fingers, chains, ef: ix('elbowFold' + s), clav: ix('clavicle' + s), sf: ix('shoulderFold' + s), a0, c0, palm, hl, la: __gpA(B[up].tail).distanceTo(__gpA(B[up].head)), lb: __gpA(B[fo].tail).distanceTo(__gpA(B[fo].head)) };
  };
  const R = side('R'), L = side('L'), lumbar = ix('lumbar') >= 0 ? ix('lumbar') : ix('pelvis'), neck = ix('neck'), head = ix('head');
  if (!R || !L || lumbar < 0 || head < 0) return (rig.__hold = null);
  // the lower body keeps the stride; the rest turns about the spine, the neck and head back to the line
  const lower = new Set(), top = new Set([head]);
  B.forEach((b, i) => { if (/^(pelvis|lumbar|thigh|shank|foot|toes|hipFold|kneeFold)/.test(b.id)) lower.add(i); if (/^(jaw|eye|brow|lid|hair)/.test(b.id)) top.add(i); });
  return (rig.__hold = { R, L, lumbar, neck, head, lower, top, torso: ix('torso'), pivot: __gpA(B[lumbar].head), ready: 0, last: -1e9, shots: -1, kick: 0, slot: -1, prev: -1 });
}
// a frame turning rest vectors (a0 exactly, b0 as near as square allows) onto posed ones (a1, b1)
function __gpAlign(a0, b0, a1, b1, q) {
  const basis = (a, b, m) => { const x = a.clone().normalize(), z = x.clone().cross(b).normalize(), y = z.clone().cross(x); return m.makeBasis(x, y, z); };
  const M1 = basis(a1, b1, new THREE.Matrix4()), M0 = basis(a0, b0, new THREE.Matrix4());
  return q.setFromRotationMatrix(M1.multiply(M0.transpose()));
}
// a bone's pose in the rig's frame: head' + q·(v − restHead)
function __gpPut(rig, bi, q, at) {
  const rh = rig.fig.bones[bi].head, mesh = rig.boneMeshes[bi]; if (!mesh) return;
  __gpT.d.set(rh[0], rh[1], rh[2]).applyQuaternion(q);
  mesh.matrix.compose(__gpT.c.copy(at).sub(__gpT.d), q, __gpT.one);
}
const __gpQOf = (rig, bi, q) => { const m = rig.boneMeshes[bi]; return m ? q.setFromRotationMatrix(m.matrix) : q.identity(); };
const __gpHeadOf = (rig, bi, v) => { const h = rig.fig.bones[bi].head, m = rig.boneMeshes[bi]; v.set(h[0], h[1], h[2]); return m ? v.applyMatrix4(m.matrix) : v; };
// a rigid turn about a point, laid over a bone's pose
function __gpTurn(rig, bi, q, at) { const m = rig.boneMeshes[bi]; if (!m) return; __gpT.m.makeRotationFromQuaternion(q); __gpT.m2.makeTranslation(-at.x, -at.y, -at.z); __gpT.m.multiply(__gpT.m2); __gpT.m2.makeTranslation(at.x, at.y, at.z); m.matrix.premultiply(__gpT.m.premultiply(__gpT.m2)); }
// one arm closed on a station: the hand turned onto it, the wrist where the fist's centre lands, the arm reached in two
// bones with the elbow toward its pole, the elbow's fold between the two, the digits closed (by curl)
function __gpReach(rig, A, fist, a1, c1, pole, curl = 1) {
  const qh = __gpAlign(A.a0, A.c0, a1, c1, new THREE.Quaternion());
  const W = fist.clone().sub(A.a0.clone().multiplyScalar(0.5 * A.hl).addScaledVector(A.palm, 0.015).applyQuaternion(qh));
  const S = __gpHeadOf(rig, A.up, __gpV()), d0 = W.clone().sub(S), n = d0.clone().normalize();
  const d = Math.max(Math.abs(A.la - A.lb) + 1e-3, Math.min(A.la + A.lb - 1e-4, d0.length()));
  const x = (A.la * A.la - A.lb * A.lb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, A.la * A.la - x * x));
  const pd = pole.clone().addScaledVector(n, -pole.dot(n)); if (pd.lengthSq() < 1e-8) pd.set(0, 0, -1); pd.normalize();
  const E = S.clone().addScaledVector(n, x).addScaledVector(pd, h), Wr = S.clone().addScaledVector(n, d);
  A.miss = W.distanceTo(Wr);   // (how far the wrist fell short of where the fist closes: 0 when it reaches)
  const B = rig.fig.bones, dir = (bi) => __gpA(B[bi].tail).sub(__gpA(B[bi].head)).normalize();
  // the upper arm swung from where the stride had it (its twist kept), the forearm twisted with the hand
  const qu0 = __gpQOf(rig, A.up, new THREE.Quaternion()), cur = dir(A.up).applyQuaternion(qu0);
  const qu = new THREE.Quaternion().setFromUnitVectors(cur, E.clone().sub(S).normalize()).multiply(qu0);
  const qf = __gpAlign(dir(A.fo), A.c0, Wr.clone().sub(E), A.c0.clone().applyQuaternion(qh), new THREE.Quaternion());
  __gpPut(rig, A.up, qu, S); __gpPut(rig, A.fo, qf, E);
  if (A.ef >= 0) __gpPut(rig, A.ef, qu.clone().slerp(qf, 0.5), E);
  __gpPut(rig, A.hand, qh, Wr);
  // the digits closed round the station: each joint bent toward the palm (the fingers about the line across the
  // knuckles, the thumb across the palm, less), laid out from the hand as the hand now stands; the stride's own finger
  // pose is not kept (a hand on a gun is closed)
  const hr = B[A.hand].head;
  for (const ch of A.chains) {
    const thumb = ch.d === 'thumb', b0 = B[ch.bones[0]], d0 = __gpA(b0.tail).sub(__gpA(b0.head)).normalize();
    const ax = d0.clone().cross(A.palm).normalize().applyQuaternion(qh), bend = thumb ? [0.25, 0.35, 0.3] : [0.95 * curl, 1.05 * curl, 0.7 * curl];
    let q = qh.clone(), at = __gpA(b0.head).sub(__gpA(hr)).applyQuaternion(qh).add(Wr), prev = null;
    ch.bones.forEach((bi, k) => {
      if (prev !== null) at = at.clone().add(__gpA(B[bi].head).sub(__gpA(B[prev].head)).applyQuaternion(q));
      q = new THREE.Quaternion().setFromAxisAngle(ax, bend[k] || 0).multiply(q);
      __gpPut(rig, bi, q, at); prev = bi;
    });
  }
}
function __gpHold(e, m, rig, dt) {
  for (const k in __gpHeld) __gpHeld[k].grp.visible = false;
  if (e.id === __world.pilotId && window.__mojMuzzle) __gpMz(e.id, null);
  const camR = __world.camera && __world.camera.rule;
  if (!camR || camR.type === 'eye' || e.id !== __world.pilotId) return;
  const lo = e.rule && e.rule.gunplay && Array.isArray(e.rule.loadout) ? e.rule.loadout : null, w = e.weapon;
  const idx = e.loadoutIdx || 0, S0 = lo && lo[idx];
  if (!S0 || !S0.gunplay || !w || e.swingT != null || e.dodgeT != null || e.staggerT != null || e.tumble || e.downed || e.dead) return;
  const H = __gpHoldRig(rig); if (!H) return;
  // the switch (the outgoing lowered over its swapOut, the incoming raised over its swapIn), as the eye's view has it
  if (H.slot !== idx) { H.prev = H.slot; H.slot = idx; }
  let show = idx, low = 0;
  if ((e.readyT || 0) > 0 && e.readyMax > 0) {
    const k = 1 - e.readyT / e.readyMax, sw = S0.gunplay.swap || { out: 0.3, in: 0.4 }, cut = sw.out / Math.max(1e-6, sw.out + sw.in);
    if (k < cut && H.prev >= 0 && lo[H.prev] && lo[H.prev].gunplay) { show = H.prev; low = __gpEase(k / cut); }
    else low = 1 - __gpEase((k - cut) / Math.max(1e-6, 1 - cut));
  }
  const g = lo[show].gunplay, hands = g.view && g.view.hands;
  if (!hands || g.view.kind === 'bow') return;
  const V = __gpHeld[show] || (__gpHeld[show] = __gpBuild(g, true));
  if (V.grp.parent !== m) m.add(V.grp);
  // the ready: up while the sights are, a round went in the last second, or a burst runs; down at a sprint
  if (H.shots >= 0 && w.shots > H.shots) { H.last = __world.time; H.kick = 1; }
  H.shots = w.shots || 0; H.kick = Math.max(0, H.kick - dt * 9);
  const a = __gpEase((e.gp && e.gp.aim) || 0), want = e.sprinting ? 0 : a > 0.05 || __world.time - H.last < 1 || (w.burstLeft || 0) > 0 ? 1 : 0;
  H.ready += (want - H.ready) * Math.min(1, dt * 10);
  const re = w.reloading && w.reload > 0 ? Math.sin(Math.PI * (1 - w.reloadT / w.reload)) : 0;
  const pistol = g.view.kind === 'handgun';
  // the gun's frame: along the look, dipped at a low ready, lower still while stowed, rolled to reload
  const pitch = (e.transform.pitch || 0) - (1 - H.ready) * (pistol ? 0.7 : 0.5) - low * 0.9 - re * 0.25;
  const F = new THREE.Vector3(0, Math.cos(pitch), Math.sin(pitch)), U = new THREE.Vector3(0, -Math.sin(pitch), Math.cos(pitch)), L = new THREE.Vector3(-1, 0, 0);
  if (re) { const qr = new THREE.Quaternion().setFromAxisAngle(F, -0.5 * re); U.applyQuaternion(qr); L.applyQuaternion(qr); }
  const item = (p, o) => o.clone().addScaledVector(L, p[0] / 100).addScaledVector(U, p[1] / 100).addScaledVector(F, p[2] / 100);
  const along = (v) => L.clone().multiplyScalar(v[0]).addScaledVector(U, v[1]).addScaledVector(F, v[2]).normalize();
  // the joints as the stride left them, turned about the spine by a blade
  const P = H.pivot, SR0 = __gpHeadOf(rig, H.R.up, __gpV()), SL0 = __gpHeadOf(rig, H.L.up, __gpV()), N0 = __gpHeadOf(rig, H.neck >= 0 ? H.neck : H.head, __gpV());
  const about = (v, q) => v.clone().sub(P).applyQuaternion(q).add(P);
  // (the stride's own twist of the chest, taken out: a shooter's chest holds still over running legs)
  let swing = 0;
  if (H.torso >= 0) { const v = new THREE.Vector3(1, 0, 0).applyQuaternion(__gpQOf(rig, H.torso, new THREE.Quaternion())); swing = Math.atan2(v.y, v.x); }
  const sp = hands.support, reachL = H.L.la + H.L.lb + 0.5 * H.L.hl;
  // where the gun stands for a blade: a long gun's butt in the right shoulder's pocket (in from the joint, a little
  // forward and down, turned with the chest), a pistol's grip out on the line at the arms' reach, drawn in at the ready;
  // through a reload drawn in toward the chest; and where the support hand closes on it (the nearer station if the far
  // will not reach, the magazine's well through a reload)
  const place = (blade, pull = 0) => {
    const q = new THREE.Quaternion().setFromAxisAngle(__gpT.z, -blade - swing);
    let O;
    if (hands.butt && !pistol) O = about(SR0, q).add(new THREE.Vector3(-0.07, 0.05, -0.04).applyQuaternion(q)).sub(item(hands.butt, __gpV()));
    else O = about(N0, q).add(new THREE.Vector3(0.05, 0, -0.2)).addScaledVector(F, 0.28 + 0.12 * H.ready).sub(item(hands.strong.at, __gpV()));
    O.addScaledVector(F, -0.035 * H.kick - 0.14 * re - pull).addScaledVector(L, 0.06 * re);
    const SL = about(SL0, q);
    let s = sp, fist = null;
    if (sp) {
      if (sp.alt && SL.distanceTo(item(sp.at, O)) > reachL * 0.98) s = sp.alt;
      fist = item(s.at, O);
      if (re && g.view.mag) fist.lerp(item(g.view.mag, O), re);
    }
    return { q, O, s, fist, short: fist ? SL.distanceTo(fist) - reachL * 0.97 : 0 };
  };
  // the upper body side-on to the line (a long gun bladed, a pistol nearly square), and further while the support hand
  // would not reach (the stride swings the left shoulder back; a reload brings the hand to the well)
  let blade = pistol ? 0.18 : 0.62, at = place(blade);
  for (let k = 0; k < 5 && at.short > 0; k++) { blade += 0.08; at = place(blade); }
  // (and last, the gun drawn back along its line, the butt off the pocket and under the arm, as a low ready carries it)
  for (let pull = 0.03; pull <= 0.18 && at.short > 0; pull += 0.03) at = place(blade, pull);
  const B = rig.fig.bones;
  for (let bi = 0; bi < B.length; bi++) {
    if (H.lower.has(bi) && bi !== H.lumbar) continue;
    const k = bi === H.lumbar ? 0.4 : bi === H.neck ? 0.5 : H.top.has(bi) ? 0 : 1;
    if (k) __gpTurn(rig, bi, k === 1 ? at.q : __gpT.q2.setFromAxisAngle(__gpT.z, -(blade + swing) * k), P);
  }
  const O = at.O;
  V.grp.matrix.makeBasis(L, U, F).setPosition(O); V.grp.visible = true;
  if (V.mag) V.mag.visible = re < 0.85;
  m.updateMatrixWorld(true); __gpMz(e.id, V.grp.localToWorld(new THREE.Vector3(0, 0, (g.view.muzzle || 0) / 100)));
  // the hands: the strong one on its grip, the support one where it closes
  __gpReach(rig, H.R, item(hands.strong.at, O), along(hands.strong.a), along(hands.strong.c), new THREE.Vector3(0.6, -0.2, -0.8));
  if (at.fist) {
    // still short: the support shoulder reaches forward, the collarbone turned about its root toward the hand (to a limit)
    const A = H.L;
    if (at.short > 0 && A.clav >= 0) {
      const C = __gpHeadOf(rig, A.clav, __gpV()), SL = __gpHeadOf(rig, A.up, __gpV()), r = SL.distanceTo(C);
      const ax = SL.clone().sub(C).cross(at.fist.clone().sub(SL)).normalize(), th = Math.min(0.5, at.short / Math.max(0.05, r));
      if (ax.lengthSq() > 0.5) { const qc = new THREE.Quaternion().setFromAxisAngle(ax, th); for (const bi of [A.clav, A.sf, A.up, A.fo, A.hand, A.ef, ...A.fingers]) if (bi >= 0) __gpTurn(rig, bi, qc, C); }
    }
    __gpReach(rig, A, at.fist, along(at.s.a), along(at.s.c), new THREE.Vector3(-0.25, 0, -1), 0.8);
  }
  H.blade = blade;
}
if (typeof __syncRigEntity === 'function') {
  const __gpSync0 = __syncRigEntity;
  __syncRigEntity = function (e, m, rig, dt) { __gpSync0(e, m, rig, dt); if (e.rule && e.rule.gunplay) __gpHold(e, m, rig, dt || 0); };
}
const __gpStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __gpStep0(dt, inputOverride); __gpFrame(dt || 0); __gpArrows(); };
`;
}
