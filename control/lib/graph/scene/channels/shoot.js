import { safeJson } from '../emit-util.js';

// In-page SHOOT channel: a world's shoot plan (lib/graph/shoot/) drawn as objects. Per camera: its motion path, a
// dot per frame along it (their spacing is the ease, as in an After Effects motion path), a diamond per key (white
// for a hold key), the point-of-interest path when it moves, and the camera body: a frustum opening at the lens's
// field of view, a line to the point of interest and a dot on it. The body runs the cut list on a looping program
// clock; the camera whose shot is playing is solid, the others wait dimmed at the start of their first shot. A
// camera that follows a walker, a car or a mover draws that subject's route over its keys, dimmer.
// THE PLAN OWNS THE WORLD CLOCK: a shot shows the world over its span, so `__shClock` maps the page's running time to
// the playing shot's own time and the page steps every channel (cars, walkers, movers) to that — a cut between two
// shots of the same moment replays the action, and a followed car is where the plan sampled it.
// LOOK THROUGH drives the viewer from the plan (the gizmos hide so the frame is clean); the panel lists the shots,
// plays, pauses and scrubs. Everything moves off `t` and the per-frame track the kernel sampled (no clock, no dice),
// so ?t= stills are deterministic. Assigns the module-scoped `stepShoot`. Never emitted on capture runs, so no bake
// carries a gizmo; nothing here is a face, so no mesh export carries it. Absent plan ⇒ this block is not emitted.
export function shootChannelScript(shoot, { scale = 1, aspect = 16 / 9, panel = true, set = false } = {}) {
  return `
// --- shoot channel (a shoot plan's cameras and paths) ---
{
  const SH = ${safeJson(shoot)};
  const __shS = ${+scale.toFixed(4)}, __shAsp = ${+aspect.toFixed(4)}, __shTail = 0.8;
  const __shV = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const __shGizmos = [];
  const __shOver = (o) => { o.renderOrder = 980; o.traverse((c) => { if (c.material) { c.material.transparent = true; c.material.depthWrite = false; c.material.depthTest = false; } c.renderOrder = 980; }); scene.add(o); __shGizmos.push(o); return o; };
  const __shLine = (pts, col, op) => __shOver(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(__shV)), new THREE.LineBasicMaterial({ color: col, opacity: op })));
  const __shRigs = SH.cameras.map((c) => {
    const col = new THREE.Color(c.color);
    __shLine(c.path, col, 0.85);
    if (c.poiPath) __shLine(c.poiPath, col, 0.35);
    for (const f of c.follows || []) __shLine(f.path, col, 0.3);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(c.track.pos, 3));
    __shOver(new THREE.Points(dg, new THREE.PointsMaterial({ color: col, size: __shS * 0.16, opacity: 0.9 })));
    for (const k of c.keys) {
      const m = __shOver(new THREE.Mesh(new THREE.OctahedronGeometry(__shS * 0.2), new THREE.MeshBasicMaterial({ color: k.ease === 'hold' ? 0xffffff : col })));
      m.position.copy(__shV(k.pos));
    }
    // the body looks down its local +Z (Object3D.lookAt): the frustum opens along +Z, the box sits behind the eye
    const body = new THREE.Group();
    const frMat = new THREE.LineBasicMaterial({ color: col });
    const fr = new THREE.LineSegments(new THREE.BufferGeometry(), frMat);
    const boxMat = new THREE.MeshBasicMaterial({ color: col });
    const box = new THREE.Mesh(new THREE.BoxGeometry(__shS * 0.5, __shS * 0.36, __shS * 0.7), boxMat);
    box.position.z = -__shS * 0.35;
    body.add(fr); body.add(box);
    __shOver(body);
    const aimMat = new THREE.LineBasicMaterial({ color: col, opacity: 0.5 });
    const aim = __shOver(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), aimMat));
    const poiMat = new THREE.MeshBasicMaterial({ color: col });
    const poi = __shOver(new THREE.Mesh(new THREE.SphereGeometry(__shS * 0.14, 12, 8), poiMat));
    const first = SH.shots.find((s) => s.camera === c.id);
    return { c, body, fr, aim, poi, mats: [frMat, boxMat, aimMat, poiMat], hfov: -1, rest: first ? first.span[0] : c.track.t0 };
  });
  // the camera at camera-local time t, linear between the kernel's per-frame samples
  const __shAt = (c, t) => {
    const tr = c.track;
    const f = Math.max(0, Math.min(tr.n - 1, (t - tr.t0) * tr.fps));
    const i = Math.min(tr.n - 2, Math.floor(f)), a = tr.n > 1 ? f - i : 0, j = tr.n > 1 ? i + 1 : 0, i0 = Math.max(0, i);
    const L = (arr, k, d) => arr[i0 * d + k] + (arr[j * d + k] - arr[i0 * d + k]) * a;
    return { pos: [L(tr.pos, 0, 3), L(tr.pos, 1, 3), L(tr.pos, 2, 3)], look: [L(tr.look, 0, 3), L(tr.look, 1, 3), L(tr.look, 2, 3)], hfov: L(tr.hfov, 0, 1), roll: L(tr.roll, 0, 1) };
  };
  const __shFrustum = (r, hfov) => {
    if (Math.abs(hfov - r.hfov) < 1e-3) return;
    r.hfov = hfov;
    const L = __shS * 2, w = L * Math.tan(hfov * Math.PI / 360), h = w / __shAsp;
    const c = [[w, h, L], [-w, h, L], [-w, -h, L], [w, -h, L]];
    const s = [];
    for (let k = 0; k < 4; k++) { s.push(0, 0, 0, ...c[k], ...c[k], ...c[(k + 1) % 4]); }
    s.push(-w * 0.4, h * 1.08, L, 0, h * 1.5, L, 0, h * 1.5, L, w * 0.4, h * 1.08, L);   // the up tick
    r.fr.geometry.dispose();
    r.fr.geometry = new THREE.BufferGeometry();
    r.fr.geometry.setAttribute('position', new THREE.Float32BufferAttribute(s, 3));
  };
  const __shPose = (r, v, live) => {
    const eye = __shV(v.pos), look = __shV(v.look);
    r.body.position.copy(eye); r.body.up.set(0, 0, 1); r.body.lookAt(look); r.body.rotateZ(v.roll * Math.PI / 180);
    __shFrustum(r, v.hfov);
    const ap = r.aim.geometry.attributes.position; ap.setXYZ(0, eye.x, eye.y, eye.z); ap.setXYZ(1, look.x, look.y, look.z); ap.needsUpdate = true;
    r.poi.position.copy(look);
    r.aim.visible = r.poi.visible = r.c.type === 'two_node';
    r.mats.forEach((m, k) => { m.opacity = (live ? 1 : 0.35) * (k === 2 ? 0.5 : 1); });
  };
  // the program clock: plays, pauses, scrubs; loops with a short hold on the last frame
  let __shPlay = true, __shBase = 0, __shHeld = 0, __shLastT = 0, __shLook = false, __shSaved = null, __shNow = null, __shCur = null;
  const __shCycle = SH.total + __shTail;
  const __shTau = (sec) => {
    if (!__shPlay) return __shHeld;
    const x = (((sec - __shBase) % __shCycle) + __shCycle) % __shCycle;
    return Math.min(SH.total, x);
  };
  const __shShot = (tau) => {
    let i = 0;
    while (i + 1 < SH.shots.length && SH.shots[i + 1].start <= tau) i++;
    const s = SH.shots[i];
    return { i, s, t: s.span[0] + Math.min(s.length, tau - s.start) };
  };
  const __shView = (v) => {
    camera.position.set(v.pos[0], v.pos[1], v.pos[2]);
    controls.target.set(v.look[0], v.look[1], v.look[2]);
    camera.up.set(0, 0, 1); camera.lookAt(controls.target); camera.rotateZ(-v.roll * Math.PI / 180);
    camera.fov = 2 * Math.atan(Math.tan(v.hfov * Math.PI / 360) / (camera.aspect || 1)) * 180 / Math.PI;
    camera.updateProjectionMatrix();
  };${panel ? `
  const __shPanel = document.createElement('div');
  __shPanel.style.cssText = 'position:absolute;left:10px;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px;font:500 12px/1.3 system-ui,sans-serif;color:#e8eaf0;pointer-events:none';
  const __shRow = document.createElement('div');
  __shRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(14,16,20,.82);pointer-events:auto;max-width:560px';
  const __shBtn = (txt) => { const b = document.createElement('button'); b.textContent = txt; b.style.cssText = 'font:inherit;color:inherit;background:#232733;border:1px solid #3a4152;border-radius:6px;padding:3px 8px;cursor:pointer;white-space:nowrap'; return b; };
  const __shPlayB = __shBtn('Pause'), __shLookB = __shBtn('Look through');
  const __shScrub = document.createElement('input');
  __shScrub.type = 'range'; __shScrub.min = '0'; __shScrub.max = String(SH.total); __shScrub.step = String(1 / SH.fps); __shScrub.value = '0';
  __shScrub.style.cssText = 'flex:1;min-width:60px';
  const __shLab = document.createElement('span');
  __shLab.style.cssText = 'min-width:120px;text-align:right;font-variant-numeric:tabular-nums';
  __shRow.append(__shPlayB, __shScrub, __shLab, __shLookB);
  const __shChips = document.createElement('div');
  __shChips.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;pointer-events:auto;max-width:560px';
  const __shChipEls = SH.shots.map((s) => {
    const cam = SH.cameras.find((c) => c.id === s.camera);
    const b = __shBtn(s.name); b.style.borderColor = cam ? cam.color : '#3a4152';
    b.onclick = () => { __shSeek(s.start); };
    __shChips.appendChild(b); return b;
  });
  __shPanel.append(__shChips, __shRow);
  wrap.appendChild(__shPanel);
  const __shSeek = (tau) => {
    const sec = __shLastT / 1000;
    __shHeld = tau; if (__shPlay) __shBase = sec - tau;
    __shRedraw();
  };
  __shScrub.oninput = () => { __shPlay = false; __shSeek(+__shScrub.value); };
  __shPlayB.onclick = () => {
    if (__shPlay) { __shHeld = __shTau(__shLastT / 1000); __shPlay = false; } else { __shPlay = true; __shBase = __shLastT / 1000 - __shHeld; }
    __shRedraw();
  };
  __shLookB.onclick = () => { __shSetLook(!__shLook); __shRedraw(); };` : `
  const __shSeek = (tau) => { __shHeld = tau; if (__shPlay) __shBase = __shLastT / 1000 - tau; };`}
  const __shSetLook = (on) => {
    if (on === __shLook) return;
    __shLook = on;
    if (on) { __shSaved = { pos: camera.position.clone(), target: controls.target.clone(), fov: camera.fov }; controls.enabled = false; }
    else if (__shSaved) {
      camera.position.copy(__shSaved.pos); controls.target.copy(__shSaved.target); camera.up.set(0, 0, 1);
      camera.fov = __shSaved.fov; camera.updateProjectionMatrix(); controls.enabled = true; controls.update();
    }
    for (const g of __shGizmos) g.visible = !on;${panel ? `
    __shLookB.textContent = on ? 'Free view' : 'Look through';` : ''}
  };
  const __shRedraw = () => { __mojStep(__shClock(__shLastT)); renderer.render(scene, camera); };
  // the page's running time (ms) → the playing shot's world time (ms), which the page then steps every channel to
  __shClock = (raw) => {
    __shLastT = raw || 0;
    const tau = __shTau(__shLastT / 1000);
    __shCur = { tau, at: __shShot(tau) };${set ? `
    __shSetShot = __shCur.at.i;   // the shoot set shows this shot's pieces` : ''}
    return __shCur.at.t * 1000;
  };
  stepShoot = () => {
    if (!__shCur) __shClock(__shLastT);
    const { tau, at } = __shCur;
    __shNow = { shot: at.s.name, camera: at.s.camera, tau, t: at.t };
    for (const r of __shRigs) {
      const live = r.c.id === at.s.camera;
      const v = __shAt(r.c, live ? at.t : r.rest);
      if (live) { __shNow.pos = v.pos; __shNow.look = v.look; }
      if (!__shLook) __shPose(r, v, live);
      else if (live) __shView(v);
    }${panel ? `
    __shLab.textContent = at.s.name + ' · ' + tau.toFixed(2) + ' / ' + SH.total.toFixed(2) + ' s';
    __shScrub.value = String(tau);
    __shPlayB.textContent = __shPlay ? 'Pause' : 'Play';
    __shChipEls.forEach((b, k) => { b.style.background = k === at.i ? '#3a4152' : '#232733'; });` : ''}
  };
  window.__mojShoot = { cameras: __shRigs.length, shots: SH.shots.length, total: SH.total, now: () => __shNow,
    look: (on) => { __shSetLook(!!on); __shRedraw(); }, seek: (tau) => { __shPlay = false; __shSeek(+tau || 0); __shRedraw(); } };
}`;
}
