// In-page script: the TURRET view (worlds/controllable/turret.js) — what a gunner sees and the gun as others see it, for
// a page whose world has a turret. Appended after the controllable channel's own script (it wraps stepControllable), so
// every other page keeps every byte.
//
//   THE GUN     a graybox of the base (`turret.look.base`: a concrete plinth, a tower, a field gun's carriage, or a hull),
//               the turret and the barrel, posed each frame from the mount's yaw and elevation; or, on a base that is its
//               own figure (a tank from the vehicle library), its turret and gun bones turned; hidden from the gunner's
//               own sight
//   THE SIGHT   the camera on the gun's sight line, beside the barrel, along it: a reticle (the bore's line, and below it
//               a mark for each range of the loaded round, from `turret.range.table`: where the target must sit for the
//               gun to drop the round onto it); the right button zooms it (wide, 4×, 10×); O steps to the chase (a driver's
//               third-person view behind the hull, the gun's aim a pip), then behind the gun, then beside the base, and back
//   THE MARKS   where a round bursts on one of the range's stands (`turret.range.stands`, each a matter at a thickness),
//               what it did, by the same law the measures run (gameworld/combat/terminal.js terminalKernel): a hole, a
//               breach and its rubble, a spall, a dent, a scorch; on the ground a crater and its rim
//   THE READOUT the round loaded (or loading), the gun's elevation and traverse in mils, the last round's strike
//
// `window.__mojCtrl.turret()` says the sight, the zoom and the marks, a figure base's turned bones and its steered wheels'
// angles (° to the right) (a page's check).
import { terminalKernel } from '../../../gameworld/combat/terminal.js';

export function turretScript() {
  return `
// ── TURRET ──
const __terminalKernel = ${terminalKernel.toString()};
const __TV = { built: {}, sight: true, view: 0, zoom: 0, marks: [], seen: new Map(), bSeq: -1, kernels: {}, last: null, mils: 6400 / 360 };
const __TV_ZOOM = [24, 6, 2.4];
renderer.domElement.addEventListener('mousedown', (ev) => { if (ev.button === 2) { __TV.zoom = (__TV.zoom + 1) % __TV_ZOOM.length; __tvReticle(); } });
renderer.domElement.addEventListener('contextmenu', (ev) => ev.preventDefault());
// (O steps through the views: the sight, the chase behind the hull (a driver's), behind the gun, beside the base)
window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyO' && !ev.repeat) { __TV.view = (__TV.view + 1) % 4; __TV.sight = __TV.view === 0; __TV.chase = null; __tvReticle(); } });
// the readout and the reticle (a sight's glass: the bore's line, the range marks below it)
const __tvPanel = document.createElement('div');
__tvPanel.style.cssText = 'position:fixed;left:16px;bottom:64px;z-index:7;pointer-events:none;font:500 12px ui-monospace,monospace;color:#e8e6e0;background:rgba(20,22,26,0.78);border:1px solid #4a4c50;border-radius:4px;padding:6px 9px;white-space:pre;line-height:1.45';
document.body.appendChild(__tvPanel);
const __tvGlass = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
__tvGlass.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:6;pointer-events:none';
document.body.appendChild(__tvGlass);
function __tvGun() { const p = __world.pilotId && __world.byId[__world.pilotId]; return p && p.turret ? p : null; }
function __tvReticle() {
  const g = __tvGun();
  if (!g || !__TV.sight) { __tvGlass.innerHTML = ''; return; }
  const W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2, ppd = H / __TV_ZOOM[__TV.zoom];
  // (the marks of the form the base is in: a walker's tank form carries its gun lower)
  const RG = g.turret.range, tables = RG && ((RG.tableForm && g.form && RG.tableForm[g.form]) || RG.table);
  const R = g.turret.rounds && g.turret.rounds[g.turret.loaded || 0], word = R && R.ordnance, T = (tables && tables[word]) || [];
  let s = '<g stroke="#101214" stroke-width="1.4" fill="none" opacity="0.85">';
  s += '<line x1="' + (cx - 160) + '" y1="' + cy + '" x2="' + (cx - 14) + '" y2="' + cy + '"/><line x1="' + (cx + 14) + '" y1="' + cy + '" x2="' + (cx + 160) + '" y2="' + cy + '"/>';
  s += '<line x1="' + cx + '" y1="' + (cy - 120) + '" x2="' + cx + '" y2="' + (cy - 14) + '"/><circle cx="' + cx + '" cy="' + cy + '" r="2" fill="#101214"/>';
  // (a flat round's marks lie close: a label that would sit on the last goes to the other side, or is left off)
  let lastR = -1e9, lastL = -1e9;
  for (const [d, off] of T) {
    const y = cy + off * ppd;
    if (!(y > cy + 4 && y < H - 10)) continue;
    s += '<line x1="' + (cx - 22) + '" y1="' + y + '" x2="' + (cx + 22) + '" y2="' + y + '"/>';
    const side = y - lastR >= 12 ? 1 : y - lastL >= 12 ? -1 : 0;
    if (side) { if (side > 0) lastR = y; else lastL = y; s += '<text x="' + (side > 0 ? cx + 28 : cx - 28) + '" y="' + (y + 4) + '" text-anchor="' + (side > 0 ? 'start' : 'end') + '" fill="#101214" stroke="none" style="font:11px ui-monospace,monospace">' + d + '</text>'; }
  }
  s += '</g>';
  __tvGlass.innerHTML = s;
}
addEventListener('resize', __tvReticle);
// the gun in graybox: its base, its turret and its barrel
// (the page's world is shaded by its faces, not lit: each side of a box its own value, the top the lightest)
const __TV_SHADE = [0.82, 0.62, 0.74, 0.68, 1, 0.45];
function __tvBox(sx, sy, sz, c) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), __TV_SHADE.map((k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }))); m.raycast = function () {}; return m; }
// a box laid from one point to another (its length along them)
function __tvBeam(a, b, w, h, c) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), m = __tvBox(d.length(), w, h, c);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
  return m;
}
function __tvBuild(e) {
  const L = e.turret.look || {}, hull = L.base === 'hull', at = (e.turret.mount && e.turret.mount.at) || [0, 0, 2];
  const base = new THREE.Group(), turret = new THREE.Group(), barrel = new THREE.Group();
  const field = L.base === 'field', tower = L.base === 'tower';
  if (hull) { const h = __tvBox(7, 3.6, 1.4, '#5a6150'); h.position.set(0, 0, 0.9); base.add(h); for (const s of [1, -1]) { const t = __tvBox(6.8, 0.6, 0.9, '#2e3030'); t.position.set(0, s * 1.6, 0.45); base.add(t); } }
  else if (field) {
    // (a field gun's carriage: its wheels on their axle, its split trails spread back to their spades)
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 18), new THREE.MeshBasicMaterial({ color: 0x2b2d2e })); w.position.set(0, s * 0.95, 0.62); w.raycast = function () {}; base.add(w);
      base.add(__tvBeam([-0.2, s * 0.3, 0.6], [-3.4, s * 1.25, 0.2], 0.18, 0.2, '#5d6152'));
      const sp = __tvBox(0.12, 0.5, 0.4, '#3b3d3a'); sp.position.set(-3.5, s * 1.25, 0.15); base.add(sp);
    }
    const ax = __tvBox(0.2, 2, 0.2, '#4d5146'); ax.position.set(0, 0, 0.62); base.add(ax);
  } else if (tower) {
    // (a fortress tower: its shaft and its parapet, the gun on its roof)
    const h = Math.max(1, at[2] - 0.9), sh = __tvBox(5, 5, h, '#9d9a92'); sh.position.set(0, 0, h / 2); base.add(sh);
    for (const [x, y, sx, sy] of [[2.4, 0, 0.3, 5], [-2.4, 0, 0.3, 5], [0, 2.4, 5, 0.3], [0, -2.4, 5, 0.3]]) { const p = __tvBox(sx, sy, 0.9, '#8d8a82'); p.position.set(x, y, h + 0.45); base.add(p); }
  }
  else { const pl = __tvBox(3.2, 3.2, Math.max(0.4, at[2] - 0.6), '#a3a19c'); pl.position.set(0, 0, Math.max(0.4, at[2] - 0.6) / 2); base.add(pl); }
  // (the turret: a field gun's is its shield and cradle on the top carriage, any other's a box round the trunnion)
  if (field) { const sd = __tvBox(0.08, 2, 1.3, '#5d6152'); sd.position.set(0.5, 0, 0.1); turret.add(sd); const cr = __tvBox(1.6, 0.5, 0.45, '#4d5146'); cr.position.set(-0.4, 0, -0.1); turret.add(cr); }
  else { const tb = __tvBox(3.2, 2.8, 0.9, hull ? '#626a57' : '#7d7f78'); tb.position.set(-0.4, 0, 0); turret.add(tb); }
  const len = (e.turret.gun && e.turret.gun.barrel) || 5, br = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, len, 10), new THREE.MeshBasicMaterial({ color: 0x4a4f56 }));
  br.rotation.z = -Math.PI / 2; br.position.set(len / 2, 0, 0); br.raycast = function () {}; barrel.add(br);
  const mant = __tvBox(0.5, 0.9, 0.6, '#4a4e47'); mant.position.set(0.1, 0, 0); barrel.add(mant);
  turret.add(barrel); scene.add(base); scene.add(turret);
  return { base, turret, barrel };
}
// a base drawn as its own figure (a tank from the vehicle library: its 'turret' bone, and its 'gun' bone where it has one,
// car-designer/military.js 'gun') is turned on the rig itself, each frame, as the controllable channel poses it: the gun
// elevated about its trunnion, then both turned about the turret's ring; hidden from the gunner's own sight
const __tvQY = new THREE.Quaternion(), __tvQP = new THREE.Quaternion(), __tvO = new THREE.Vector3(), __TV_Z = new THREE.Vector3(0, 0, 1), __TV_X = new THREE.Vector3(1, 0, 0), __TV_Y = new THREE.Vector3(0, 1, 0);
function __tvRigBone(e, fig, bi, Q, P, mesh) {
  // (a twin-mount gun's bones by their side: 'turretR' and 'gunR' turn together, 'turretL' and 'gunL')
  // (each body's mesh kept: a base transforming on the range stays solid, its beat's shimmer a game's tell, not a gun's)
  if (e.transformT != null) (e.__tvMeshes || (e.__tvMeshes = new Set())).add(mesh);
  // (a steered wheel turned to its own angle about its hub, over its spin: the circle's centre on the fixed axles' line,
  // a right turn's to the right, the inner wheel more; worlds/controllable/steer.js e.steer)
  // (the steer.js rule's angle, ° to the right, or the drive rule's own, radians to the left)
  const sd = e.steer != null ? e.steer : e.steerAngle ? -e.steerAngle * 180 / Math.PI : 0;
  if (fig.steer && sd) {
    const by = fig.__steerBy || (fig.__steerBy = Object.fromEntries(fig.steer.wheels.map((w) => [w.id, w]))), W = by[fig.bones[bi].id];
    if (W) {
      const R = fig.steer.wheelbase / Math.tan(sd * Math.PI / 180), a = Math.atan(W.y / (R - W.x));
      __tvQY.setFromAxisAngle(__TV_Z, -a); Q.premultiply(__tvQY);
      (__TV.wheels || (__TV.wheels = {}))[W.id] = Math.round(a * 1800 / Math.PI) / 10;
      return;
    }
  }
  // (a craft's propeller turned about its nose, faster with its throttle)
  if (fig.bones[bi].id === 'prop' && e.rule && e.rule.type === 'fly') { __tvQP.setFromAxisAngle(__TV_Y, ((__world.time || 0) * (30 + 60 * (e.throttle || 0))) % (2 * Math.PI)); Q.premultiply(__tvQP); return; }
  // (a rotorcraft's rotors turned about their masts, a tail rotor about its own axle, faster with its thrust; a
  // multirotor's turn each way in pairs, the front right with the rear left)
  if (e.rule && e.rule.type === 'hover' && /rotor/i.test(fig.bones[bi].id)) {
    const id = fig.bones[bi].id, tail = /tail/i.test(id), sg = /(^|[a-z])(F|A|C|front)/.test(id) === /-r$/.test(id) ? 1 : -1;
    __tvQP.setFromAxisAngle(tail ? __TV_X : __TV_Z, (sg * (__world.time || 0) * (24 + 30 * (e.throttle || 0))) % (2 * Math.PI)); Q.premultiply(__tvQP); return;
  }
  const k = /^(turret|gun)(.*)$/.exec(fig.bones[bi].id);
  if (!k) return;
  const T = e.turret, map = fig.__tvTi || (fig.__tvTi = {}), ti = map[k[2]] !== undefined ? map[k[2]] : (map[k[2]] = fig.bones.findIndex((b) => b.id === 'turret' + k[2]));
  // (a gun with no turret bone, on a mount that slews (a helicopter's chin gun): turned about its own trunnion; a fixed
  // gun's, along the nose, stands)
  if (ti < 0 && (k[1] !== 'gun' || (T.mount && T.mount.fixed))) return;
  // (the turret's pivot where the clip has carried it this frame, a walking frame's mount bobbing with its body: kept as
  // the turret bone is posed, before the gun is)
  const PV = fig.__tvPiv || (fig.__tvPiv = {});
  if (k[1] === 'turret') PV[k[2]] = [P[0], P[1], P[2]];
  const piv = ti < 0 ? P.slice() : PV[k[2]] || fig.bones[ti].head;
  if (k[1] === 'gun') { __tvQP.setFromAxisAngle(__TV_X, (T.pitch || 0) * Math.PI / 180); Q.premultiply(__tvQP); }
  __tvQY.setFromAxisAngle(__TV_Z, (T.yaw || 0) * Math.PI / 180);
  __tvO.set(P[0] - piv[0], P[1] - piv[1], P[2] - piv[2]).applyQuaternion(__tvQY);
  P[0] = piv[0] + __tvO.x; P[1] = piv[1] + __tvO.y; P[2] = piv[2] + __tvO.z;
  Q.premultiply(__tvQY);
  mesh.visible = !(__TV.sight && e.id === __world.pilotId);
  __TV.rig = { yaw: T.yaw, pitch: T.pitch };
}
function __tvPose(e) {
  // (a base that is its own figure turns its own bones: no graybox)
  if (e.body && e.body.type === 'figure-rig') return;
  const B = __TV.built[e.id] || (__TV.built[e.id] = __tvBuild(e)), t = e.transform, T = e.turret, at = (T.mount && T.mount.at) || [0, 0, 2];
  const ch = Math.cos(t.heading), sh = Math.sin(t.heading);
  B.base.position.set(t.pos[0], t.pos[1], t.pos[2]); B.base.rotation.set(0, 0, t.heading);
  B.turret.position.set(t.pos[0] + ch * at[0] + sh * (at[1] || 0), t.pos[1] + sh * at[0] - ch * (at[1] || 0), t.pos[2] + at[2]);
  B.turret.rotation.set(0, 0, t.heading + (T.yaw || 0) * Math.PI / 180);
  B.barrel.rotation.set(0, -(T.pitch || 0) * Math.PI / 180, 0);
  const show = !(__TV.sight && e.id === __world.pilotId);
  B.turret.visible = show;
}
// the camera: the gunner's sight beside the barrel and along it, the chase behind the hull, a commander's view behind the
// gun, or beside the base
function __tvCamera(g, dt) {
  const T = g.turret, d = T.dir, m = T.muzzle, R = T.rounds && T.rounds[T.loaded || 0], L = (R && R.barrel) || (T.gun && T.gun.barrel) || 5;
  const piv = [m[0] - d[0] * L, m[1] - d[1] * L, m[2] - d[2] * L], left = [-d[1], d[0], 0], ln = Math.hypot(left[0], left[1]) || 1;
  // (the sight on the mount's outer side: a right-hand mount's to its right, clear of the frame it rides)
  const at = (R && R.atForm && g.form && R.atForm[g.form]) || (R && R.at) || (T.mount && T.mount.at) || [0, 0, 0], side = at[1] > 0.2 ? -1 : 1;
  if (__TV.sight) {
    camera.position.set(piv[0] + side * left[0] / ln * 0.75 + d[0] * 0.6, piv[1] + side * left[1] / ln * 0.75 + d[1] * 0.6, piv[2] + 0.35);
    camera.up.set(0, 0, 1); camera.lookAt(camera.position.x + d[0] * 100, camera.position.y + d[1] * 100, camera.position.z + d[2] * 100);
    const f = __TV_ZOOM[__TV.zoom]; if (Math.abs(camera.fov - f) > 1e-6) { camera.fov = f; camera.updateProjectionMatrix(); }
  } else if (__TV.view === 1) {
    // (THE CHASE, a driver's view: behind the hull and over it, by the base's size, its turn followed eased so a steered
    // curve swings the world and not the camera; the gun's aim a pip on the glass)
    const t = g.transform, H = (T.look && T.look.size) || 4, C = __TV.chase || (__TV.chase = { yaw: t.heading });
    const k = 1 - Math.exp(-(dt || 1 / 60) / (0.25 + 0.06 * H)), dh = Math.atan2(Math.sin(t.heading - C.yaw), Math.cos(t.heading - C.yaw));
    C.yaw += dh * k;
    // (a craft's chase follows its climb and its dive too: behind it along its flight path)
    const fp = g.rule && g.rule.type === 'fly' ? (t.pitch || 0) : 0, cp = Math.cos(fp), spp = Math.sin(fp);
    const back = 2 * H + 4.5, up = 0.65 * H + 1.5, fx = Math.cos(C.yaw) * cp, fy = Math.sin(C.yaw) * cp;
    camera.position.set(t.pos[0] - fx * back, t.pos[1] - fy * back, t.pos[2] - spp * back + up);
    camera.up.set(0, 0, 1); camera.lookAt(t.pos[0] + fx * H * 1.5, t.pos[1] + fy * H * 1.5, t.pos[2] + spp * H * 1.5 + H * 0.7);
    if (Math.abs(camera.fov - 55) > 1e-6) { camera.fov = 55; camera.updateProjectionMatrix(); }
  } else if (__TV.view === 3) {
    // (beside the base, square to its heading on its right, framing all of it: look.size its height, a tank's 4 m)
    const t = g.transform, H = (T.look && T.look.size) || 4, r = 2.4 * H + 4, rx = Math.sin(t.heading), ry = -Math.cos(t.heading);
    camera.position.set(t.pos[0] + rx * r, t.pos[1] + ry * r, t.pos[2] + H * 0.55);
    camera.up.set(0, 0, 1); camera.lookAt(t.pos[0], t.pos[1], t.pos[2] + H * 0.45);
    if (Math.abs(camera.fov - 40) > 1e-6) { camera.fov = 40; camera.updateProjectionMatrix(); }
  } else {
    // (behind the gun by its base's size: look.back and look.up, a tank's 18 m and 7 m when absent)
    const h = Math.hypot(d[0], d[1]) || 1, LK = T.look || {}, bk = LK.back || 18, up = LK.up || 7;
    camera.position.set(piv[0] - d[0] / h * bk, piv[1] - d[1] / h * bk, piv[2] + up);
    camera.up.set(0, 0, 1); camera.lookAt(piv[0] + d[0] / h * 40, piv[1] + d[1] / h * 40, piv[2]);
    if (Math.abs(camera.fov - 55) > 1e-6) { camera.fov = 55; camera.updateProjectionMatrix(); }
  }
}
// THE MARKS: a decal on a stand's face (its normal), or on the ground
const __tvMatOf = (c, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c), transparent: o < 1, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide });
function __tvDisc(at, normal, r, c, o) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.02, r), 18), __tvMatOf(c, o));
  m.position.set(at[0] + normal[0] * 0.012, at[1] + normal[1] * 0.012, at[2] + normal[2] * 0.012);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(normal[0], normal[1], normal[2]));
  m.raycast = function () {}; scene.add(m); return m;
}
function __tvStandAt(R, q) {
  for (const s of (R && R.stands) || []) if (q[0] >= s.min[0] - 0.4 && q[0] <= s.max[0] + 0.4 && q[1] >= s.min[1] - 0.2 && q[1] <= s.max[1] + 0.2 && q[2] >= s.min[2] - 0.3 && q[2] <= s.max[2] + 0.3) return s;
  return null;
}
function __tvStrike(g, rec, q) {
  const R = g.turret.range;
  if (!R) return;
  const K = __TV.kernels[g.id] || (__TV.kernels[g.id] = __terminalKernel(R.ordnance, R.matter));
  const stand = __tvStandAt(R, q), v = rec.vel, sp = Math.hypot(v[0], v[1], v[2]) || 1;
  // (a face's normal: a roof's up, a wall's back along the line, a sloped plate's laid back by its angle)
  const sa = stand && stand.angle ? stand.angle * Math.PI / 180 : 0;
  const n = stand && stand.face === 'top' ? [0, 0, 1] : stand ? [-Math.cos(sa), 0, Math.sin(sa)] : [0, 0, 1];
  const ob = Math.acos(Math.min(1, Math.abs(v[0] * n[0] + v[1] * n[1] + v[2] * n[2]) / sp)) * 180 / Math.PI;
  const target = stand ? { matter: stand.matter, thickness: stand.thickness, angle: stand.angle || 0 } : { matter: R.ground || 'loam' };
  if (!R.ordnance[rec.word] || !R.matter[target.matter]) return;
  const S = K.strike(rec.word, { v: sp, obliquity: stand && stand.angle ? 0 : ob }, target);
  // where on the face: the burst, or for a sloped plate where the line meets it
  let at = q.slice();
  if (stand && stand.face !== 'top') at = [stand.min[0] + (sa ? (q[2] - stand.min[2]) * Math.tan(sa) : 0), q[1], q[2]];
  if (stand && stand.face === 'top') at = [q[0], q[1], stand.max[2]];
  if (!stand) at = [q[0], q[1], 0];
  const col = (stand && stand.color) || '#6b5a44';
  const add = (o) => { __TV.marks.push({ stand: stand ? stand.id : 'ground', effect: S.effect, perforated: !!S.perforated, word: rec.word, v: Math.round(sp) }); return o; };
  if (S.effect === 'hole') { __tvDisc(at, n, S.hole, '#0b0c0d', 1); if (S.perforated && stand && stand.face !== 'top') { const back = sa ? [at[0] + stand.thickness / Math.cos(sa), at[1], at[2]] : [stand.max[0], at[1], at[2]]; __tvDisc(back, [-n[0], 0, -n[2]], S.hole * (stand.matter === 'armour-steel' || stand.matter === 'steel' ? 1.4 : 3), '#1d1e20', 0.9); } if (S.scorch) __tvDisc(at, n, S.scorch, '#141210', 0.45); }
  else if (S.effect === 'breach') { __tvDisc(at, n, S.hole, '#0b0c0d', 1); __tvDisc(at, n, S.hole * 1.35, '#5b5752', 0.6); for (let k = 0; k < 7; k++) { const b = __tvBox(0.25 + 0.05 * (k % 3), 0.2 + 0.05 * (k % 2), 0.15, col); b.position.set(at[0] - 0.4 - 0.25 * (k % 3), at[1] + (k - 3) * 0.22, 0.08); scene.add(b); } }
  else if (S.effect === 'spall') { const r = (S.crater && S.crater.r) || 0.2; __tvDisc(at, n, r, '#8b8681', 0.85); __tvDisc(at, n, r * 0.35, '#3a3836', 0.9); }
  else if (S.effect === 'dent') { __tvDisc(at, n, 0.06, '#2a2b2d', 0.9); if (S.scorch) __tvDisc(at, n, S.scorch, '#141210', 0.45); }
  else if (S.effect === 'scorch') __tvDisc(at, n, S.scorch || 0.3, '#141210', 0.55);
  else if (S.effect === 'crater') { const r = S.crater.r; __tvDisc(at, [0, 0, 1], r * 1.3, '#8e7f66', 0.7); __tvDisc(at, [0, 0, 1], r, '#3b2f22', 0.95); }
  add(null);
  __TV.last = (stand ? stand.id : 'the ground') + ' at ' + Math.round(Math.hypot(q[0] - g.transform.pos[0], q[1] - g.transform.pos[1])) + ' m: ' + S.effect + (S.perforated ? ', through' : '') + (S.penetration != null ? ' (pen ' + Math.round(S.penetration * 1000) + ' mm)' : '');
}
// the chase's pip: where the gun points, a ring on the glass
const __tvPip = document.createElement('div');
__tvPip.style.cssText = 'position:fixed;z-index:6;pointer-events:none;width:14px;height:14px;margin:-8px 0 0 -8px;border:2px solid rgba(232,230,224,0.9);border-radius:50%;box-shadow:0 0 0 1px rgba(16,18,20,0.6);display:none';
document.body.appendChild(__tvPip);
const __tvPV = new THREE.Vector3();
function __tvAimPip(g) {
  const T = g.turret, m = T.muzzle, d = T.dir;
  if (__TV.view !== 1 || !m) { __tvPip.style.display = 'none'; __TV.pip = null; return; }
  camera.updateMatrixWorld();
  // (a drone's drop: where what it lets go now lands, carried on by its own velocity as it falls)
  if (T.look && T.look.drop) {
    const v = g.vel || [0, 0, 0], h = Math.max(0, m[2] - (__ground([m[0], m[1], m[2]]) ?? 0)), t = (-v[2] + Math.sqrt(v[2] * v[2] + 2 * 9.81 * h)) / 9.81;
    __tvPV.set(m[0] + v[0] * t, m[1] + v[1] * t, m[2] - h);
  } else __tvPV.set(m[0] + d[0] * 600, m[1] + d[1] * 600, m[2] + d[2] * 600);
  __tvPV.project(camera);
  const on = __tvPV.z < 1 && Math.abs(__tvPV.x) <= 1 && Math.abs(__tvPV.y) <= 1;
  __tvPip.style.display = on ? 'block' : 'none';
  if (on) { const x = (__tvPV.x + 1) / 2 * innerWidth, y = (1 - __tvPV.y) / 2 * innerHeight; __tvPip.style.left = x + 'px'; __tvPip.style.top = y + 'px'; __TV.pip = [Math.round(x), Math.round(y)]; } else __TV.pip = null;
}
// THE BASE HEARD (the world's audio.base, the artillery range's): its engine held and driven by its speed (idling
// standing), a walking frame's hydraulics by its pace, and a footfall as each of its feet is planted (its legs' phases in
// its gait), never in its tank form; read-only, as every sound on the page is
const __tvHeard = { eng: null, hyd: null, last: null, legs: {} };
function __tvSound(g, dt) {
  const A = typeof __AUDIO !== 'undefined' && __AUDIO ? __AUDIO.base : null;
  if (!A || typeof __beatsEng === 'undefined' || !__beatsEng || !__beatsEng.sustain) return;
  try {
    if (!__tvHeard.eng && A.engine) __tvHeard.eng = __beatsEng.sustain(A.engine);
    if (!__tvHeard.hyd && A.hydraulics) __tvHeard.hyd = __beatsEng.sustain(A.hydraulics);
  } catch (e) { return; }
  const p = g.transform.pos, L = __tvHeard.last, v = L && dt > 0 ? Math.hypot(p[0] - L[0], p[1] - L[1]) / dt : 0;
  __tvHeard.last = [p[0], p[1], p[2]];
  const vmax = (g.rule && (g.rule.topSpeed || g.rule.speed)) || 6, pace = Math.min(1, v / vmax), walking = !!A.legs && g.form !== 'tank' && g.transformT == null;
  // (an aircraft's engine by its throttle lever, a ground machine's by its pace)
  if (__tvHeard.eng) __tvHeard.eng.set(A.throttle ? Math.min(1, g.throttle || 0) : Math.min(1, 0.1 + 0.9 * pace));
  if (__tvHeard.hyd) __tvHeard.hyd.set(walking && g.moving ? Math.max(0.2, pace) : 0);
  // (each foot's count of plantings kept while it walks, standing or not: a footfall as one is added on the move)
  if (walking && A.step) {
    const ph = g.gaitPhase || 0;
    A.legs.forEach((q, i) => { const k = Math.floor(ph - q); if (g.moving && __tvHeard.legs[i] !== undefined && k !== __tvHeard.legs[i]) __beatsCue(A.step, A.stepGain || 1); __tvHeard.legs[i] = k; });
  } else __tvHeard.legs = {};
}
function __tvFrame(dt) {
  const g = __tvGun();
  for (const e of __world.entities) if (e.__tvMeshes) { for (const m of e.__tvMeshes) if (m.material) { m.material.opacity = 1; m.material.transparent = false; } if (e.transformT == null) e.__tvMeshes = null; }
  for (const e of __world.entities) if (e.turret && e.turret.dir) __tvPose(e);
  if (!g || !g.turret.dir) return;
  // (a base that asks for it starts in the chase: an aircraft, flown from behind)
  if (!__TV.v0) { __TV.v0 = true; if (g.turret.look && g.turret.look.view === 'chase') { __TV.view = 1; __TV.sight = false; __tvReticle(); } if (g.rule && g.rule.type === 'fly') __tvPanel.style.bottom = '160px'; }   // (a craft's flight instruments sit below)
  __tvCamera(g, dt);
  __tvAimPip(g);
  __tvSound(g, dt);
  // (the small arms' reticle and ammo card are not a gunner's: the sight and the readout are)
  if (typeof __wep !== 'undefined' && __wep) { __wep.ret.style.display = 'none'; if (__wep.iconEl) __wep.iconEl.parentNode.style.display = 'none'; }
  // (a round loaded: its range marks on the glass)
  if (__TV.lr !== g.turret.loaded || __TV.lf !== g.form) { __TV.lr = g.turret.loaded; __TV.lf = g.form; __tvReticle(); }
  // the rounds in flight: their round (the one in the breech as it is first seen) and their last velocity, for the strike
  // when they burst
  const live = new Set();
  for (const p of __world.projectiles || []) {
    live.add(p.id);
    let r = __TV.seen.get(p.id);
    if (!r) { const o = __world.byId[p.owner], OT = o && o.turret; r = { word: OT && OT.rounds ? OT.rounds[OT.loaded || 0].ordnance : o && o.weapon && o.weapon.ordnance, owner: p.owner }; __TV.seen.set(p.id, r); }
    r.pos = p.pos.slice(); r.vel = p.vel.slice();
  }
  for (const b of __world.bursts || []) {
    if (b.seq <= __TV.bSeq) continue;
    __TV.bSeq = b.seq;
    // (the round that burst: the one gone this frame nearest the burst)
    let best = null, bd = 1e9;
    for (const [id, r] of __TV.seen) { if (live.has(id) || !r.pos) continue; const d = Math.hypot(r.pos[0] - b.pos[0], r.pos[1] - b.pos[1], r.pos[2] - b.pos[2]); if (d < bd) { bd = d; best = id; } }
    if (best !== null) { const r = __TV.seen.get(best); __TV.seen.delete(best); const o = __world.byId[r.owner]; if (o && o.turret && r.word) __tvStrike(o, r, b.pos); }
  }
  // the readout
  const T = g.turret, w = g.weapon, R = T.rounds && T.rounds[T.loaded || 0];
  // (a round fired high at what the gunner cannot see: its chart, the elevation for each range, and its flight)
  const C = R && T.range && T.range.chart && T.range.chart[R.ordnance], chart = C ? 'chart ' + C.map((c) => c[0] / 1000 + ' km ' + Math.round(c[1]) + ' mils ' + Math.round(c[2]) + ' s').join(' · ') : '';
  const name = R ? R.ordnance.toUpperCase() : 'GUN', keys = T.rounds ? T.rounds.map((x, i) => (i + 1) + ' ' + x.ordnance).join('  ') : '';
  __tvPanel.textContent = name + (w && w.reloading ? '  loading ' + Math.max(0, w.reloadT).toFixed(1) + ' s' : '  loaded') + '\\nelevation ' + ((T.pitch || 0) * __TV.mils).toFixed(1) + ' mils   traverse ' + ((T.yaw || 0) * __TV.mils).toFixed(0) + ' mils\\n' + (chart ? chart + '\\n' : '') + (keys ? keys + '\\n' : '') + (__TV.last ? 'last: ' + __TV.last : 'click fire · 1-' + (T.rounds ? T.rounds.length : 1) + ' load · right click zoom · O view');
}
const __tvStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __tvStep0(dt, inputOverride); __tvFrame(dt); };
window.__mojCtrl.turret = () => ({ sight: __TV.sight, view: ['sight', 'chase', 'behind', 'beside'][__TV.view], camera: [camera.position.x, camera.position.y, camera.position.z], ...(__TV.pip ? { pip: __TV.pip.slice() } : {}), zoom: __TV_ZOOM[__TV.zoom], marks: __TV.marks.slice(), ...(__TV.rig ? { rig: { ...__TV.rig } } : {}), ...(__TV.wheels ? { wheels: { ...__TV.wheels } } : {}), ...(__tvHeard.eng || __tvHeard.hyd ? { heard: { engine: !!__tvHeard.eng, hydraulics: !!__tvHeard.hyd } } : {}) });
window.__tvReady = true;
setTimeout(__tvReticle, 0);
`;
}
