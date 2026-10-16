import { safeJson } from '../emit-util.js';
import { FIRE_COLORANTS } from '../../fire/fire.js';
import { wavePoints, sprayPoints } from '../../playscape/elements/elements.js';
import { strandPoints, beamLength } from '../../playscape/elements/beams.js';
import { GLYPHS_SRC, SPRAY_SRC } from './moment-channel.js';

/**
 * beam-channel — the page's side of the cast's BEAMS (state.moments `is: 'beam'`, playscape/elements/beams.js): each
 * attack plays once from its hand to its target on the world clock, then is gone. Every strand copy is a ribbon drawn
 * in up to three passes, values first:
 *
 *   ink    a black edge, laid over the scene (edge: ink | both)
 *   glow   the attack's colour, added, wide and soft (edge: glow | both)
 *   core   white, narrow: what reads first in greys
 *
 * A ribbon is camera-facing quads along the strand's spine (strandPoints, the module's own source), as wide at each point
 * as its radius; a head is the same passes as sprites. The charge is an orb swelling at the hand (or over the head)
 * with lights spiralling into it (wavePoints); rings ride a ray's line; sparks spray round every head (sprayPoints).
 * Its impact and shake are the moment channel's (moments the engine put down at the landing). Emitted only when a
 * world's cues fire a beam.
 */

/** The attacks a world's events fire (their specs, as lowered), in first-named order. */
export function beamSpecs(events) {
  const out = [];
  for (const r of (events && events.reactions) || []) if (r && r.do === 'ctrl' && r.op === 'beam' && r.spec && !out.includes(r.spec)) out.push(r.spec);
  // a party battle's juice: the attacks its steps fly (playscape/rpg/juice.js)
  const fx = events && events.rpg && events.rpg.juice && events.rpg.juice.fx;
  for (const B of Object.values((fx && fx.beams) || {})) if (!out.includes(B)) out.push(B);
  return out;
}

export function beamScript(specs) {
  const sparks = specs.some((B) => B.sparks), rings = specs.some((B) => B.rings), charge = specs.some((B) => B.charge);
  return `
// BEAMS: attacks fired from a hand at a target, once each, on the world clock (ink, glow and a white core)
const __bmCol = ${safeJson(FIRE_COLORANTS)};
const __bmRgb = (c) => (Array.isArray(c) ? c : typeof c === 'string' && __bmCol[c] ? __bmCol[c] : typeof c === 'string' && c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) : [1, 1, 1]);
const __bmStrand = ${strandPoints.toString()};
const __bmLength = ${beamLength.toString()};${charge ? `
const __bmWave = ${wavePoints.toString()};` : ''}
const __bmGlyph = ${GLYPHS_SRC};${sparks ? `
const __bmSpray = ${sprayPoints.toString()};
${SPRAY_SRC.replace(/__spr/g, '__bmSpr')}` : ''}
// across a ribbon: soft (glow), firm (core), hard (ink)
const __bmAcross = (edge) => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64); for (const [o, a] of edge) g.addColorStop(o, 'rgba(255,255,255,' + a + ')'); x.fillStyle = g; x.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(cv); };
const __bmTex = { glow: __bmAcross([[0, 0], [0.3, 0.35], [0.5, 1], [0.7, 0.35], [1, 0]]), core: __bmAcross([[0, 0], [0.2, 0.9], [0.5, 1], [0.8, 0.9], [1, 0]]), ink: __bmAcross([[0, 0], [0.08, 1], [0.92, 1], [1, 0]]) };
const __bmDisc = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 29, 0, 7); x.fill(); return new THREE.CanvasTexture(cv); })();
const __BM_N = 48;
// the passes a strand draws, outermost first: [kind, width ×, colour, additive?]
function __bmPasses(S, rgb) {
  const out = [];
  if (S.edge !== 'ink') out.push(['glow', S.edge === 'both' ? 2.9 : 2.6, rgb, true]);
  if (S.edge !== 'glow') out.push(['ink', 1.22, [0, 0, 0], false]);
  out.push(['core', S.edge === 'glow' ? 0.8 : 0.9, [1, 1, 1], S.edge === 'glow']);
  return out;
}
function __bmRibbon(kind, rgb, add, order) {
  const g = new THREE.BufferGeometry(), N = __BM_N, uv = new Float32Array(N * 4), idx = [];
  for (let k = 0; k < N; k++) { uv.set([k / (N - 1), 0, k / (N - 1), 1], k * 4); if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ map: __bmTex[kind], color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.userData.__fire = true;
  const r = new THREE.Mesh(g, m); r.frustumCulled = false; r.raycast = function () {}; r.renderOrder = order; r.visible = false; scene.add(r); return r;
}
function __bmHead(kind, rgb, add, order) {
  const m = new THREE.SpriteMaterial({ map: kind === 'glow' ? __bmGlyph.dot.tex : __bmDisc, color: new THREE.Color(rgb[0], rgb[1], rgb[2]), transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.userData.__fire = true; if (kind === 'core') m.opacity = 0.95;
  const s = new THREE.Sprite(m); s.raycast = function () {}; s.renderOrder = order; s.visible = false; scene.add(s); return s;
}
const __bmA = new THREE.Vector3(), __bmB = new THREE.Vector3(), __bmD = new THREE.Vector3(), __bmS = new THREE.Vector3(), __bmV = new THREE.Vector3();
function __bmLay(mesh, spine, mult) {
  const a = mesh.geometry.attributes.position.array, n = spine.length;
  for (let k = 0; k < __BM_N; k++) {
    const q = spine[Math.min(n - 1, k)], p0 = spine[Math.max(0, Math.min(n - 1, k - 1))].p, p1 = spine[Math.min(n - 1, k + 1)].p;
    __bmA.fromArray(q.p); __bmD.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); __bmV.subVectors(camera.position, __bmA);
    __bmS.crossVectors(__bmD, __bmV); const l = __bmS.length(); if (l > 1e-9) __bmS.multiplyScalar((q.r * mult) / l); else __bmS.set(0, 0, 0);
    a.set([__bmA.x - __bmS.x, __bmA.y - __bmS.y, __bmA.z - __bmS.z, __bmA.x + __bmS.x, __bmA.y + __bmS.y, __bmA.z + __bmS.z], k * 6);
  }
  mesh.geometry.attributes.position.needsUpdate = true;
}
const __bmLive = {}, __bmDone = {};
function __bmMake(M) {
  const B = M.spec, base = __bmRgb(M.color != null ? M.color : B.color), I = { M, B, from: M.from, to: M.to, copies: [], extra: [], gather: [] };
  I.len = __bmLength(B, Math.hypot(M.to[0] - M.from[0], M.to[1] - M.from[1], M.to[2] - M.from[2]));
  B.strands.forEach((S, si) => {
    const rgb = S.color != null && M.color == null ? __bmRgb(S.color) : base, passes = __bmPasses(S, rgb);
    for (let j = 0; j < S.count; j++) {
      const C = { S, j, rib: [], head: [], rgb };
      passes.forEach(([kind, mult, col, add], pi) => { C.rib.push([__bmRibbon(kind, col, add, 20 + pi), mult]); C.head.push([__bmHead(kind, col, add, 24 + pi), mult]); });${sparks ? `
      if (B.sparks) C.sp = __bmSprMake(B.sparks, rgb, __bmGlyph);` : ''}
      I.copies.push(C);
    }
  });${charge ? `
  if (B.charge) {
    // the orb, in the attack's passes, and lights spiralling into it
    const S0 = B.strands[0];
    I.orb = __bmPasses(S0, base).map(([kind, mult, col, add], pi) => [__bmHead(kind, col, add, 24 + pi), mult]);
    I.W = { count: 3, trail: 8, lag: 0.03, cycle: 0.9, turn: -2, r: [B.charge.size * 5 + 0.6, 0.04], z: [0.5, 0], arc: 0, tilt: 0, wobble: [0, 0], spread: 'even', env: 'in', tail: 0.3, pulse: 0, size: 0.2, twinkle: 8 };
    const n = __bmWave(I.W, [0, 0, 0], 0).length;
    for (let i = 0; i < n; i++) { const s = __bmHead('glow', base, true, 23); I.gather.push(s); }
  }` : ''}${rings ? `
  if (B.rings) {
    // shock rings on the first ray's line, facing along it
    const S0 = B.strands.find((S) => S.form === 'ray');
    if (S0) {
      const dir = new THREE.Vector3(M.to[0] - M.from[0], M.to[1] - M.from[1], M.to[2] - M.from[2]), D = dir.length(); dir.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      I.rings = { S: S0, D, dir, list: [] };
      for (let k = 0; k < Math.min(14, Math.ceil(D / B.rings.every) + 1); k++) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 36), new THREE.MeshBasicMaterial({ color: new THREE.Color(base[0], base[1], base[2]), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        m.material.userData.__fire = true; m.quaternion.copy(q); m.raycast = function () {}; m.visible = false; m.renderOrder = 19; scene.add(m); I.rings.list.push(m);
      }
    }
  }` : ''}
  return I;
}
function __bmStep(I, age) {
  const B = I.B, A = I.from, T = I.to;
  for (const C of I.copies) {
    const R = __bmStrand(C.S, A, T, age, C.j, __BM_N), on = R.spine.length > 1;
    for (const [m, mult] of C.rib) { m.visible = on; if (on) __bmLay(m, R.spine, mult); }
    for (const [s, mult] of C.head) { s.visible = !!R.head; if (R.head) { s.position.fromArray(R.head.p); const z = R.head.r * mult * 2 * (s.material.map === __bmDisc ? 1 : 1.6); s.scale.set(z, z, 1); } }${sparks ? `
    if (C.sp) __bmSprStep(C.sp, __bmSpray(B.sparks, R.head ? R.head.p : A, age + C.j * 0.37, true), 1, !!R.head);` : ''}
  }${charge ? `
  if (I.orb) {
    // swelling until the strands go, then gone as the first one leaves
    const c = B.charge, u = Math.min(1, age / c.time), go = Math.max(0, (age - c.time) / 0.25), k = (u * u * (3 - 2 * u)) * Math.max(0, 1 - go), fl = 1 + 0.08 * Math.sin(age * 40);
    for (const [s, mult] of I.orb) { s.visible = k > 0.01; s.position.fromArray(A); const z = c.size * k * fl * mult * 2 * (s.material.map === __bmDisc ? 1 : 1.6); s.scale.set(z, z, 1); }
    const pts = __bmWave(I.W, [A[0], A[1], A[2] - 0.5 * (1 - u)], age);
    I.gather.forEach((s, i) => { const q = pts[i]; s.visible = age < c.time && q && q.w > 0.05; if (s.visible) { s.position.fromArray(q.p); s.scale.setScalar(0.18 * (0.4 + 0.6 * q.w)); s.material.opacity = q.w; } });
  }` : ''}${rings ? `
  if (I.rings) {
    // riding forward along the line behind the ray's front, swelling as they go
    const Rg = I.rings, S = Rg.S, tt = age - S.delay, front = Math.min(Rg.D, S.speed * tt), live = tt > 0 && tt < Rg.D / S.speed + S.hold;
    Rg.list.forEach((m, k) => {
      const x = ((k * B.rings.every + tt * S.speed * 0.12) % (Rg.list.length * B.rings.every));
      m.visible = live && x < front - 0.3 && x > 0.4; if (!m.visible) return;
      m.position.set(A[0] + Rg.dir.x * x, A[1] + Rg.dir.y * x, A[2] + Rg.dir.z * x);
      const sz = S.width * B.rings.size * (0.8 + 0.4 * ((x / B.rings.every) % 1)); m.scale.setScalar(sz); m.material.opacity = 0.55 * (1 - ((x / B.rings.every) % 1) * 0.6);
    });
  }` : ''}
}
function __bmDrop(I) {
  const gone = (o) => { scene.remove(o); if (o.geometry && !o.isSprite) o.geometry.dispose(); o.material.dispose(); };
  for (const C of I.copies) { C.rib.forEach(([m]) => gone(m)); C.head.forEach(([s]) => gone(s));${sparks ? ' if (C.sp) __bmSprDrop(C.sp);' : ''} }${charge ? `
  if (I.orb) { I.orb.forEach(([s]) => gone(s)); I.gather.forEach(gone); }` : ''}${rings ? `
  if (I.rings) I.rings.list.forEach(gone);` : ''}
}
function __stepBeams() {
  const W = window.__mojCtrl && window.__mojCtrl.world; if (!W) return;
  const now = W.time || 0;
  for (const M of W.moments || []) {
    if (M.is !== 'beam') continue;
    const key = M.by + '|' + M.t0;
    if (!__bmLive[key] && !__bmDone[key] && now >= M.t0) __bmLive[key] = __bmMake(M);
  }
  for (const key in __bmLive) {
    const I = __bmLive[key], age = now - I.M.t0;
    if (age >= I.len || age < 0) { __bmDrop(I); delete __bmLive[key]; __bmDone[key] = 1; continue; }
    __bmStep(I, age);
  }
}
window.__mojBeams = { live: () => Object.keys(__bmLive) };`;
}
