import { safeJson } from '../emit-util.js';
import { FIRE_COLORANTS } from '../../fire/fire.js';
import { sprayPoints } from '../../playscape/elements/elements.js';
import { MOMENTS, MOMENT_KEYS, strikeBolt } from '../../playscape/elements/moments.js';

/**
 * moment-channel — the page's side of the cast's MOMENTS (state.moments, a puff's kinds and the camera's shake): each
 * plays once where it was put, on the world clock from its own time, and is gone. A kind is sprays (sprayPoints, the
 * look's drift run once) and a star, a bolt, a ground ring and a light (playscape/elements/moments.js). A shake moves
 * the camera round each draw: added just before renderer.render and taken off after, so whatever drives the camera
 * (orbit controls, a chase boom) never inherits it.
 *
 * GLYPHS is the particle textures, shared with the status channel's drift (cached on window, made once).
 * Emitted only when a world's cues puff or shake, with only the kinds they use.
 */

/** The moments a world's events play (puff kinds, and 'shake'), in first-named order. */
export function momentKinds(events) {
  const out = [];
  const add = (k) => { if (!out.includes(k)) out.push(k); };
  for (const r of (events && events.reactions) || []) {
    if (!r || r.do !== 'ctrl') continue;
    if (r.op === 'puff') { add(typeof r.is === 'string' && MOMENTS[r.is] ? r.is : 'smoke'); if (r.shake) add('shake'); }
    if (r.op === 'shake') add('shake');
    // a beam's impact and shake, where it lands
    if (r.op === 'beam' && r.spec) { if (r.spec.impact) add(r.spec.impact); if (r.spec.shake) add('shake'); }
  }
  return out;
}

// the particle glyphs, drawn white (a sprite's colour tints them); additive ones glow, the rest lie over the scene
export const GLYPHS_SRC = `window.__mojGlyphs || (window.__mojGlyphs = (() => {
  const mk = (draw) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = x.strokeStyle = '#fff'; draw(x); return new THREE.CanvasTexture(cv); };
  const rad = (x, stops) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); for (const [o, a] of stops) g.addColorStop(o, 'rgba(255,255,255,' + a + ')'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); };
  return {
    dot: { tex: mk((x) => rad(x, [[0, 1], [0.25, 0.5], [0.6, 0.12], [1, 0]])), add: true },
    soft: { tex: mk((x) => rad(x, [[0, 0.9], [0.45, 0.4], [1, 0]])), add: false },
    streak: { tex: mk((x) => { const g = x.createLinearGradient(0, 0, 64, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.beginPath(); x.ellipse(32, 32, 31, 4, 0, 0, 7); x.fill(); }), add: true, stretch: true },
    drop: { tex: mk((x) => { x.globalAlpha = 0.85; x.beginPath(); x.moveTo(6, 32); x.quadraticCurveTo(40, 25, 52, 27); x.arc(52, 32, 5, -Math.PI / 2, Math.PI / 2); x.quadraticCurveTo(40, 39, 6, 32); x.fill(); }), add: false, stretch: true },
    flake: { tex: mk((x) => { x.lineWidth = 3; x.lineCap = 'round'; x.translate(32, 32); for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 26); x.moveTo(0, 14); x.lineTo(7, 20); x.moveTo(0, 14); x.lineTo(-7, 20); x.stroke(); } }), add: false },
    leaf: { tex: mk((x) => { x.beginPath(); x.moveTo(6, 32); x.quadraticCurveTo(32, 6, 58, 32); x.quadraticCurveTo(32, 58, 6, 32); x.fill(); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 2; x.beginPath(); x.moveTo(8, 32); x.lineTo(56, 32); x.stroke(); }), add: false },
    spark: { tex: mk((x) => { rad(x, [[0, 1], [0.12, 0.6], [0.35, 0.08], [1, 0]]); x.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r = i % 2 ? 7 : 31; x.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a)); } x.closePath(); x.fill(); }), add: true },
    chip: { tex: mk((x) => { x.beginPath(); [[14, 18], [40, 10], [54, 30], [44, 52], [18, 48], [8, 32]].forEach(([a, b]) => x.lineTo(a, b)); x.closePath(); x.fill(); }), add: false },
    star: { tex: mk((x) => { rad(x, [[0, 1], [0.3, 0.55], [0.7, 0.1], [1, 0]]); x.beginPath(); for (let i = 0; i < 32; i++) { const a = (i * Math.PI) / 16, r = i % 2 ? 9 : 22 + ((i * 7) % 10); x.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a)); } x.closePath(); x.fill(); }), add: true },
  };
})())`;

// a spray's pool on the page, and its step: the particles' sprites (a streak or a drop lies along its flight, as it
// reads on the screen), and a ring for each drop that lands when the spray rings out
export const SPRAY_SRC = `function __sprMake(S, rgb, G) {
  const g = G[S.glyph] || G.dot, col = S.color != null ? S.color : rgb, P = { S, g, sprs: [], rings: [] };
  for (let i = 0; i < S.count * (S.trail || 1); i++) {
    const m = new THREE.SpriteMaterial({ map: g.tex, color: new THREE.Color(col[0], col[1], col[2]), blending: g.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: true });
    m.userData.__fire = true; const s = new THREE.Sprite(m); s.visible = false; s.raycast = function () {}; scene.add(s); P.sprs.push(s);
    if (S.rings) { const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.88, 1), transparent: true, depthWrite: false, side: THREE.DoubleSide })); r.material.userData.__fire = true; r.visible = false; r.raycast = function () {}; scene.add(r); P.rings.push(r); }
  }
  return P;
}
const __sprA = new THREE.Vector3(), __sprB = new THREE.Vector3();
function __sprStep(P, pts, fade, show) {
  const sz = renderer.domElement;
  pts.forEach((q, i) => {
    const s = P.sprs[i], r = P.rings[i];
    if (r) { r.visible = show && q.ring >= 0; if (r.visible) { r.position.set(q.p[0], q.p[1], q.p[2] + 0.01); r.scale.setScalar(0.03 + 0.16 * q.ring); r.material.opacity = 0.7 * (1 - q.ring) * fade; } }
    if (!show || q.w * fade < 0.02) { s.visible = false; return; }
    s.visible = true; s.position.set(q.p[0], q.p[1], q.p[2]); s.material.opacity = Math.min(1, q.w) * fade;
    if (P.g.stretch) {
      // along its flight as the camera sees it, longer the faster it goes
      __sprA.set(q.p[0], q.p[1], q.p[2]).project(camera); __sprB.set(q.p[0] + q.v[0] * 0.05, q.p[1] + q.v[1] * 0.05, q.p[2] + q.v[2] * 0.05).project(camera);
      const dx = (__sprB.x - __sprA.x) * sz.width, dy = (__sprB.y - __sprA.y) * sz.height, sp = Math.hypot(q.v[0], q.v[1], q.v[2]);
      s.material.rotation = Math.atan2(dy, dx); s.scale.set(q.s * Math.min(5, 1.5 + sp * 0.3), q.s * 0.5, 1);
    } else { s.material.rotation = q.rot; s.scale.set(q.s, q.s, 1); }
  });
}
function __sprDrop(P) { for (const s of P.sprs) { scene.remove(s); s.material.dispose(); } for (const r of P.rings) { scene.remove(r); r.geometry.dispose(); r.material.dispose(); } }`;

export function momentScript(kinds) {
  const K = kinds.filter((k) => MOMENTS[k]), shake = kinds.includes('shake');
  const spec = Object.fromEntries(K.map((k) => [k, { ...MOMENTS[k], key: MOMENT_KEYS[k] }]));
  const bolt = K.some((k) => MOMENTS[k].bolt), light = K.some((k) => MOMENTS[k].light);
  return `
// MOMENTS: a puff where it was put (${K.join(', ') || 'none'})${shake ? ', and the camera shaking' : ''}, once each, on the world clock
const __MO = ${safeJson(spec)};
const __moCol = ${safeJson(FIRE_COLORANTS)};
const __moRgb = (c) => (Array.isArray(c) ? c : typeof c === 'string' && __moCol[c] ? __moCol[c] : typeof c === 'string' && c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) : [1, 1, 1]);
const __moGlyph = ${GLYPHS_SRC};
const __moSpray = ${sprayPoints.toString()};
${SPRAY_SRC.replace(/__spr/g, '__moSpr')}${bolt ? `
const __moBolt = ${strikeBolt.toString()};
const __moA = new THREE.Vector3(), __moB = new THREE.Vector3(), __moD = new THREE.Vector3(), __moV = new THREE.Vector3(), __moS = new THREE.Vector3();
// a bolt's strokes: a quad a segment, facing the camera, as wide at each end as its node's thickness
function __moStroke(mesh, bolts, width) {
  const pos = mesh.geometry.attributes.position, a = pos.array; let i = 0;
  for (const b of bolts) for (let k = 1; k < b.nodes.length; k++) {
    __moA.fromArray(b.nodes[k - 1]); __moB.fromArray(b.nodes[k]);
    const wa = width * b.t[k - 1] * b.w, wb = width * b.t[k] * b.w;
    __moD.subVectors(__moB, __moA); __moV.subVectors(camera.position, __moA); __moS.crossVectors(__moD, __moV).normalize();
    const q = [__moA.x - __moS.x * wa, __moA.y - __moS.y * wa, __moA.z - __moS.z * wa, __moA.x + __moS.x * wa, __moA.y + __moS.y * wa, __moA.z + __moS.z * wa, __moB.x + __moS.x * wb, __moB.y + __moS.y * wb, __moB.z + __moS.z * wb, __moB.x - __moS.x * wb, __moB.y - __moS.y * wb, __moB.z - __moS.z * wb];
    for (const j of [0, 1, 2, 0, 2, 3]) { a[i++] = q[j * 3]; a[i++] = q[j * 3 + 1]; a[i++] = q[j * 3 + 2]; }
  }
  pos.needsUpdate = true;
}` : ''}${light ? `
// one light, made at the start so no material recompiles when a moment flashes; the brightest moment has it
const __moLight = new THREE.PointLight(0xffffff, 0, 16, 1.5); scene.add(__moLight);` : ''}${shake ? `
// the shake: added round each draw, taken off after
const __moShake = new THREE.Vector3(), __moKeep = new THREE.Vector3(), __moRender = renderer.render.bind(renderer);
renderer.render = (s, c) => { if (c !== camera || __moShake.lengthSq() === 0) return __moRender(s, c); __moKeep.copy(c.position); c.position.add(__moShake); __moRender(s, c); c.position.copy(__moKeep); };` : ''}
const __moLive = {};
function __moMake(M) {
  const S = __MO[M.is], col = M.color != null ? __moRgb(M.color) : null, at = M.at, I = { S, at, t0: M.t0, sprays: [], extra: [] };
  S.parts.forEach((p, i) => I.sprays.push(__moSprMake(p, col && S.key.includes(i) ? col : p.color || [1, 1, 1], __moGlyph)));
  const mat = (m) => { m.userData.__fire = true; return m; };
  if (S.star) { const c = col && S.star.key ? col : S.star.color || [1, 0.97, 0.88]; I.star = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: __moGlyph.star.tex, color: new THREE.Color(c[0], c[1], c[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))); I.star.raycast = function () {}; I.star.renderOrder = 10; scene.add(I.star); I.extra.push(I.star); }
  if (S.ring) { I.ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), mat(new THREE.MeshBasicMaterial({ color: S.ring.dark ? 0x000000 : 0xd8ecff, transparent: true, depthWrite: false, side: THREE.DoubleSide }))); I.ring.position.set(at[0], at[1], at[2] + 0.015); I.ring.raycast = function () {}; scene.add(I.ring); I.extra.push(I.ring); }${bolt ? `
  if (S.bolt) {
    let segs = 0; for (const b of __moBolt(at, S.bolt.h, 0)) segs += b.nodes.length - 1;
    const rib = (m, order) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 18), 3)); const r = new THREE.Mesh(g, mat(m)); r.frustumCulled = false; r.raycast = function () {}; r.renderOrder = order; scene.add(r); I.extra.push(r); return r; };
    I.glow = rib(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.7, 1), side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 10);
    I.core = rib(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 11);
  }` : ''}
  return I;
}
function __moStep(I, age) {
  const S = I.S, at = I.at, sm = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  I.sprays.forEach((P) => __moSprStep(P, __moSpray(P.S, at, age, false), 1, true));
  if (I.star) { const u = age / S.star.life; I.star.visible = u < 1; I.star.position.set(at[0], at[1], at[2] + S.star.z); const k = sm(u * 4) * (1 - u); I.star.scale.setScalar(S.star.size * (0.4 + 0.8 * Math.sqrt(Math.min(1, u)))); I.star.material.opacity = Math.min(1, 1.6 * k); I.star.material.rotation = age * 0.6; }
  if (I.ring) { const u = age / S.ring.life; I.ring.visible = u < 1; I.ring.scale.setScalar(0.05 + S.ring.r * (S.ring.dark ? Math.sqrt(Math.min(1, u * 3)) : Math.sqrt(Math.min(1, u)))); I.ring.material.opacity = (S.ring.dark ? 0.55 : 0.75) * (1 - u); }${bolt ? `
  if (I.core) {
    // struck again flicks times over its life, each a new path, dark between strikes
    const B = S.bolt, per = B.life / B.flicks, n = Math.floor(age / per), on = age < B.life && (age % per) / per < 0.62;
    I.core.visible = I.glow.visible = on;
    if (on) { const bs = __moBolt(at, B.h, n); __moStroke(I.core, bs, B.width); __moStroke(I.glow, bs, B.width * 3.2); I.glow.material.opacity = 0.6; }
  }` : ''}
}
function __moDrop(I) { I.sprays.forEach(__moSprDrop); for (const m of I.extra) { scene.remove(m); if (m.geometry) m.geometry.dispose(); m.material.dispose(); } }
function __stepMoments() {
  const W = window.__mojCtrl && window.__mojCtrl.world; if (!W) return;
  const now = W.time || 0;${light ? `
  let lk = 0;` : ''}${shake ? `
  __moShake.set(0, 0, 0);` : ''}
  for (const M of W.moments || []) {
    const age = now - M.t0;${shake ? `
    if (M.is === 'shake') {
      // dying away; three tones a world clock apart, so a replay shakes the same
      const u = age / M.for; if (u < 0 || u >= 1) continue;
      const a = M.k * 0.22 * (1 - u) * (1 - u);
      __moShake.x += a * Math.sin(now * 53 + 1.3); __moShake.y += a * Math.sin(now * 61 + 2.1); __moShake.z += 0.6 * a * Math.sin(now * 47 + 0.4);
      continue;
    }` : ''}
    const S = __MO[M.is]; if (!S) continue;
    const key = M.is + '|' + M.t0 + '|' + M.at.join(',');
    if (!__moLive[key] && age >= 0 && age < S.dur) __moLive[key] = __moMake(M);${light ? `
    if (S.light) { const u = (age - (S.light.delay || 0)) / S.light.life; if (u >= 0 && u < 1) { const k = S.light.k * (1 - u) * (1 - u); if (k > lk) { lk = k; __moLight.position.set(M.at[0], M.at[1], M.at[2] + S.light.z); } } }` : ''}
  }
  for (const key in __moLive) {
    const I = __moLive[key], age = now - I.t0;
    if (age >= I.S.dur || age < 0) { __moDrop(I); delete __moLive[key]; continue; }
    __moStep(I, age);
  }${light ? `
  __moLight.intensity = lk * 6;` : ''}
}
window.__mojMoments = { live: () => Object.keys(__moLive) };`;
}
