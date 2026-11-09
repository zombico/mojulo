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
//               gun to drop the round onto it); the right button zooms it (wide, 4×, 10×); O steps outside (a commander's
//               view behind the gun) and back
//   THE MARKS   where a round bursts on one of the range's stands (`turret.range.stands`, each a matter at a thickness),
//               what it did, by the same law the measures run (gameworld/combat/terminal.js terminalKernel): a hole, a
//               breach and its rubble, a spall, a dent, a scorch; on the ground a crater and its rim
//   THE READOUT the round loaded (or loading), the gun's elevation and traverse in mils, the last round's strike
//
// `window.__mojCtrl.turret()` says the sight, the zoom and the marks (a page's check).
import { terminalKernel } from '../../../gameworld/combat/terminal.js';

export function turretScript() {
  return `
// ── TURRET ──
const __terminalKernel = ${terminalKernel.toString()};
const __TV = { built: {}, sight: true, zoom: 0, marks: [], seen: new Map(), bSeq: -1, kernels: {}, last: null, mils: 6400 / 360 };
const __TV_ZOOM = [24, 6, 2.4];
renderer.domElement.addEventListener('mousedown', (ev) => { if (ev.button === 2) { __TV.zoom = (__TV.zoom + 1) % __TV_ZOOM.length; __tvReticle(); } });
renderer.domElement.addEventListener('contextmenu', (ev) => ev.preventDefault());
window.addEventListener('keydown', (ev) => { if (ev.code === 'KeyO' && !ev.repeat) { __TV.sight = !__TV.sight; __tvReticle(); } });
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
  const R = g.turret.rounds && g.turret.rounds[g.turret.loaded || 0], word = R && R.ordnance, T = (g.turret.range && g.turret.range.table && g.turret.range.table[word]) || [];
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
const __tvQY = new THREE.Quaternion(), __tvQP = new THREE.Quaternion(), __tvO = new THREE.Vector3(), __TV_Z = new THREE.Vector3(0, 0, 1), __TV_X = new THREE.Vector3(1, 0, 0);
function __tvRigBone(e, fig, bi, Q, P, mesh) {
  const id = fig.bones[bi].id;
  if (id !== 'turret' && id !== 'gun') return;
  const T = e.turret, ti = fig.__tvTi !== undefined ? fig.__tvTi : (fig.__tvTi = fig.bones.findIndex((b) => b.id === 'turret')), piv = fig.bones[ti].head;
  if (id === 'gun') { __tvQP.setFromAxisAngle(__TV_X, (T.pitch || 0) * Math.PI / 180); Q.premultiply(__tvQP); }
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
// the camera: the gunner's sight beside the barrel and along it, or a commander's view behind the gun
function __tvCamera(g) {
  const T = g.turret, d = T.dir, m = T.muzzle, L = (T.gun && T.gun.barrel) || 5;
  const piv = [m[0] - d[0] * L, m[1] - d[1] * L, m[2] - d[2] * L], left = [-d[1], d[0], 0], ln = Math.hypot(left[0], left[1]) || 1;
  if (__TV.sight) {
    camera.position.set(piv[0] + left[0] / ln * 0.75 + d[0] * 0.6, piv[1] + left[1] / ln * 0.75 + d[1] * 0.6, piv[2] + 0.35);
    camera.up.set(0, 0, 1); camera.lookAt(camera.position.x + d[0] * 100, camera.position.y + d[1] * 100, camera.position.z + d[2] * 100);
    const f = __TV_ZOOM[__TV.zoom]; if (Math.abs(camera.fov - f) > 1e-6) { camera.fov = f; camera.updateProjectionMatrix(); }
  } else {
    const h = Math.hypot(d[0], d[1]) || 1;
    camera.position.set(piv[0] - d[0] / h * 18, piv[1] - d[1] / h * 18, piv[2] + 7);
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
function __tvFrame() {
  const g = __tvGun();
  for (const e of __world.entities) if (e.turret && e.turret.dir) __tvPose(e);
  if (!g || !g.turret.dir) return;
  __tvCamera(g);
  // (the small arms' reticle and ammo card are not a gunner's: the sight and the readout are)
  if (typeof __wep !== 'undefined' && __wep) { __wep.ret.style.display = 'none'; if (__wep.iconEl) __wep.iconEl.parentNode.style.display = 'none'; }
  // (a round loaded: its range marks on the glass)
  if (__TV.lr !== g.turret.loaded) { __TV.lr = g.turret.loaded; __tvReticle(); }
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
  __tvPanel.textContent = name + (w && w.reloading ? '  loading ' + Math.max(0, w.reloadT).toFixed(1) + ' s' : '  loaded') + '\\nelevation ' + ((T.pitch || 0) * __TV.mils).toFixed(1) + ' mils   traverse ' + ((T.yaw || 0) * __TV.mils).toFixed(0) + ' mils\\n' + (chart ? chart + '\\n' : '') + (keys ? keys + '\\n' : '') + (__TV.last ? 'last: ' + __TV.last : 'click fire · 1-' + (T.rounds ? T.rounds.length : 1) + ' load · right click zoom · O outside');
}
const __tvStep0 = stepControllable;
stepControllable = (dt, inputOverride) => { __tvStep0(dt, inputOverride); __tvFrame(); };
window.__mojCtrl.turret = () => ({ sight: __TV.sight, zoom: __TV_ZOOM[__TV.zoom], marks: __TV.marks.slice(), ...(__TV.rig ? { rig: { ...__TV.rig } } : {}) });
window.__tvReady = true;
setTimeout(__tvReticle, 0);
`;
}
