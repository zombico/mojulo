import { safeJson } from '../emit-util.js';
import { GLYPHS_SRC } from './moment-channel.js';
import { SEMANTIC_COLORS, styleTokens } from '../../game/hud-widgets.js';

/**
 * title-channel — the page's side of the HUD's TITLES (hud-widgets.js `as: 'title'`; game/title-carve.js carved them):
 * a title's words put on the screen as 3D letters when its event fires, the way a game announces a round, a K.O., a
 * clear — not a plate with words on it. Spliced into the HUD block (events.js hudScript) only when a world carries a
 * title the carver could carve; every other world is byte-identical.
 *
 *   the run     the text (its `{var}`s filled at the firing) laid out from the glyph atlas by advance, centred, scaled to
 *               the screen (a letter stands 0.17 of the screen's height, the word within 0.84 of its width), in a rig that
 *               follows the camera each frame one unit ahead of it (no parenting: a camera a controller drives is not
 *               touched); a character the atlas lacks is a space
 *   the look    baked into vertex colour from each face's winding under a light at the viewer's upper left, so the
 *               material is unlit and the scene's lights do not matter: anime (the composed floor's register, or the
 *               default) three flat cel bands and an ink hull behind each letter; western lambert, a specular glint
 *               and a dark drop copy behind
 *   the juice   on the frame clock from the firing's time (a capture draws the same frame):
 *                 slam   scaled down onto the screen with an overshoot and a settling tilt; on landing a white flash, a
 *                        jolt, and sparks thrown from the word (a halo ring in the anime look); leaves growing and fading
 *                 rise   each letter rises from below in turn, stretched, and squashes as it lands; leaves falling
 *                 stamp  punched in from the viewer's eye, a bounce and a harder jolt; leaves scattering, each letter
 *                        flying out on its own line and spin
 *               every number of chance (a tilt, a jolt's direction, a spark's line) is hashed from the firing's count,
 *               never drawn
 *
 *   titleScript(titles, { register })   the in-page block (defines __ttFire / __ttStep for the HUD block)
 *   titleHex(color, style)              a widget colour as the six-digit hex the letters are baked in
 */

const HEX = /^#[0-9a-fA-F]{3,8}$/;
/** A widget's colour (hex, a semantic name, a token) → '#rrggbb' for the letters; the accent when unnamed. */
export function titleHex(color, style) {
  const tok = styleTokens(style);
  let h = typeof color === 'string' && HEX.test(color) ? color : SEMANTIC_COLORS[color] || (color === 'accent' || color === 'accent2' ? tok[color] : tok.accent);
  if (!HEX.test(h)) h = tok.accent;
  let d = h.slice(1);
  if (d.length === 3 || d.length === 4) d = d.slice(0, 3).split('').map((c) => c + c).join('');
  return '#' + d.slice(0, 6).toLowerCase();
}

export function titleScript(titles, { register = 'anime' } = {}) {
  const cel = register !== 'western';
  return `
// TITLES: the carved banners (game/title-carve.js) — a title's words as 3D letters put on the screen when its event
// fires: laid out from the glyph atlas by advance, baked in the ${cel ? 'anime (cel)' : 'western (metal)'} look, played
// on the frame clock from the firing (title-channel.js)
const __TT = ${safeJson(titles)};
const __TT_CEL = ${cel};
const __ttGlyphs = ${GLYPHS_SRC};
const __ttD = 1.0, __ttGeo = {};
const __ttRig = new THREE.Group(); __ttRig.renderOrder = 990; scene.add(__ttRig);
const __ttFlash = document.createElement('div'); __ttFlash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:11'; wrap.appendChild(__ttFlash);
const __ttHash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const __ttHexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const __ttBack = (k) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);   // ease out, overshooting
const __ttL = (() => { const l = [-0.4, 0.8, 0.6], n = Math.hypot(l[0], l[1], l[2]); return [l[0] / n, l[1] / n, l[2] / n]; })();
const __ttH = (() => { const h = [__ttL[0], __ttL[1], __ttL[2] + 1], n = Math.hypot(h[0], h[1], h[2]); return [h[0] / n, h[1] / n, h[2] / n]; })();
// a glyph in a colour: the atlas's indexed triangles unshared, each face's normal from its winding, the look baked into
// vertex colour (cel: three flat bands; metal: lambert and a specular glint) — the material is unlit
function __ttGeometry(style, ch, hex) {
  const key = style + '/' + ch + '/' + hex; if (__ttGeo[key]) return __ttGeo[key];
  const g = __TT.styles[style].glyphs[ch], P = g.p, I = g.i, n = I.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), rgb = __ttHexRgb(hex);
  for (let k = 0; k < n; k += 3) {
    for (let j = 0; j < 3; j++) { const v = I[k + j] * 3, o = (k + j) * 3; pos[o] = P[v] / 1000; pos[o + 1] = P[v + 1] / 1000; pos[o + 2] = P[v + 2] / 1000; }
    const a = k * 3, b = a + 3, c = a + 6;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const lam = Math.max(0, nx * __ttL[0] + ny * __ttL[1] + nz * __ttL[2]);
    let r, gg, bb;
    if (__TT_CEL) { const band = lam > 0.75 ? 1 : lam > 0.42 ? 0.78 : 0.48; r = rgb[0] * band; gg = rgb[1] * band; bb = rgb[2] * band; }
    else { const sp = 0.75 * Math.pow(Math.max(0, nx * __ttH[0] + ny * __ttH[1] + nz * __ttH[2]), 28), d = 0.22 + 0.78 * lam; r = Math.min(1, rgb[0] * d + sp); gg = Math.min(1, rgb[1] * d + sp); bb = Math.min(1, rgb[2] * d + sp); }
    for (let j = 0; j < 3; j++) { const o = (k + j) * 3; col[o] = r; col[o + 1] = gg; col[o + 2] = bb; }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return (__ttGeo[key] = geo);
}
// the run: letters by advance, centred on x = 0; a character the atlas lacks is a space
function __ttLayout(style, text) {
  const S = __TT.styles[style], letters = []; let x = 0;
  for (const ch of String(text)) { const g = S.glyphs[ch]; if (!g || !g.i.length) { x += __TT.space + __TT.tracking; continue; } letters.push({ ch, x, a: g.a }); x += g.a + __TT.tracking; }
  return { letters, width: Math.max(0.001, x - __TT.tracking) };
}
function __ttBuild(tt, text, t) {
  const w = tt.w, L = __ttLayout(w.style, text), depth = __TT.styles[w.style].depth;
  const run = { w, t0: t, seq: tt.seq, grp: new THREE.Group(), letters: [], width: L.width, sparks: [], ring: null };
  const dark = '#' + __ttHexRgb(w.hex).map((v) => Math.round(v * 0.16 * 255).toString(16).padStart(2, '0')).join('');
  for (const l of L.letters) {
    // the letter's group sits at its centre, so a hull scales and a letter spins about it
    const lg = new THREE.Group(); lg.position.set(l.x + l.a / 2 - L.width / 2, 0, 0);
    const geo = __ttGeometry(w.style, l.ch, w.hex);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true })); m.position.set(-l.a / 2, -0.5, depth / 2); m.frustumCulled = false; m.renderOrder = 992;
    let edge;
    if (__TT_CEL) { edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: dark, side: THREE.BackSide, transparent: true })); edge.scale.setScalar(1.07); edge.position.copy(m.position).multiplyScalar(1.07); }
    else { edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: dark, transparent: true })); edge.position.set(m.position.x + 0.05, m.position.y - 0.06, m.position.z - 0.12); }
    edge.frustumCulled = false; edge.renderOrder = 991;
    lg.add(edge); lg.add(m); run.grp.add(lg); run.letters.push({ lg, m, edge });
  }
  if (w.look !== 'rise') {
    // the landing's sparks (the anime look's spark glyph in the title's colour; the western look's streaks, warm white)
    const G = __ttGlyphs[__TT_CEL ? 'spark' : 'streak'] || __ttGlyphs.dot, col = __TT_CEL ? w.hex : '#fff2d0';
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex, color: new THREE.Color(col), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      s.visible = false; s.raycast = function () {}; s.renderOrder = 993; run.grp.add(s);
      const ang = __ttHash(tt.seq + 1, 100 + i) * 6.2832, sp = 2.2 + 2.6 * __ttHash(tt.seq + 1, 200 + i);
      run.sparks.push({ s, ang, sp, size: 0.34 + 0.3 * __ttHash(tt.seq + 1, 300 + i) });
    }
    if (__TT_CEL) { run.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(w.hex), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, side: THREE.DoubleSide })); run.ring.visible = false; run.ring.renderOrder = 993; run.grp.add(run.ring); }
  }
  __ttRig.add(run.grp);
  return run;
}
function __ttDrop(run) {
  __ttRig.remove(run.grp);
  for (const L of run.letters) { L.m.material.dispose(); L.edge.material.dispose(); }
  for (const p of run.sparks) p.s.material.dispose();
  if (run.ring) { run.ring.geometry.dispose(); run.ring.material.dispose(); }
}
function __ttFire(tt, text, t) { if (tt.run) __ttDrop(tt.run); tt.seq++; tt.run = __ttBuild(tt, text, t || 0); }
// the landing's sparks and ring from \`when\` seconds after the firing, in the run's own frame (letter units)
function __ttSparks(run, u, when, show) {
  const d = u - when, life = 0.5, p = d / life;
  for (const q of run.sparks) {
    if (!show || d < 0 || p >= 1) { q.s.visible = false; continue; }
    q.s.visible = true; q.s.position.set(Math.cos(q.ang) * q.sp * d * 0.9, Math.sin(q.ang) * q.sp * d - 2.4 * d * d, 0.3);
    const sz = q.size * (1 - p * p); q.s.scale.set(sz, sz, 1); q.s.material.opacity = 1 - p;
    if (!__TT_CEL) { q.s.material.rotation = q.ang; q.s.scale.set(sz * 2.4, sz * 0.5, 1); }
  }
  if (run.ring) {
    const rp = d / 0.38;
    if (!show || d < 0 || rp >= 1) run.ring.visible = false;
    else { run.ring.visible = true; run.ring.position.set(0, 0, 0.25); const rs = run.width * (0.12 + 0.4 * Math.sqrt(rp)); run.ring.scale.set(rs, rs * 0.5, 1); run.ring.material.opacity = 0.9 * (1 - rp); }
  }
}
function __ttStep(t) {
  let live = false, flash = 0;
  for (const tt of __hudTitles) if (tt.run) live = true;
  if (!live) { if (__ttFlash.style.opacity !== '0') __ttFlash.style.opacity = '0'; return; }
  __ttRig.position.copy(camera.position); __ttRig.quaternion.copy(camera.quaternion);
  const H = 2 * __ttD * Math.tan((camera.fov || 50) * Math.PI / 360), W = H * (camera.aspect || 1.6);
  for (const tt of __hudTitles) {
    const r = tt.run; if (!r) continue;
    const u = (t - r.t0) / 1000, ttl = r.w.ttl, look = r.w.look;
    if (u >= ttl) { __ttDrop(r); tt.run = null; continue; }
    const ex = Math.max(0, (u - (ttl - 0.32)) / 0.32);   // the exit, over the last 0.32 s
    const s = Math.min(0.17 * H, 0.84 * W / r.width), slot = r.w.slot;
    const y = slot === 'top' || slot === 'top-left' || slot === 'top-right' ? 0.3 * H : slot === 'bottom' || slot === 'bottom-left' || slot === 'bottom-right' ? -0.3 * H : 0;
    const seed = (k) => __ttHash(r.seq + 1, k);
    r.grp.position.set(0, y, -__ttD); r.grp.scale.setScalar(s); r.grp.rotation.set(0, 0, 0);
    const jolt = (k0, when, amp) => { const d = u - when; if (d < 0) return; const e = Math.exp(-d * 14) * amp * H; r.grp.position.x += (seed(k0) - 0.5) * 2 * e * Math.sin(d * 90); r.grp.position.y += (seed(k0 + 1) - 0.5) * 2 * e * Math.sin(d * 70); };
    let land = 0;
    if (look === 'slam') {
      land = 0.22; const k = Math.min(1, u / land), e = __ttBack(k);
      r.grp.scale.setScalar(s * (1 + 2.0 * (1 - e)) * (1 + 0.5 * ex * ex));
      r.grp.rotation.z = (seed(3) - 0.5) * 0.16 * (1 - k);
      if (u >= land) { jolt(5, land, 0.05); flash = Math.max(flash, 0.42 * Math.max(0, 1 - (u - land) / 0.18)); }
    } else if (look === 'stamp') {
      land = 0.16; const k = Math.min(1, u / land), e = k * k;
      r.grp.position.z = -__ttD + 0.7 * __ttD * (1 - e);
      if (u >= land) { const d = u - land; r.grp.scale.setScalar(s * (1 + 0.14 * Math.sin(d * 28) * Math.exp(-d * 9))); jolt(7, land, 0.07); flash = Math.max(flash, 0.55 * Math.max(0, 1 - d / 0.2)); }
    }
    r.letters.forEach((L, i) => {
      L.lg.position.y = 0; L.lg.position.z = 0; L.lg.scale.set(1, 1, 1); L.lg.rotation.set(0, 0, 0);
      let a = 1;
      if (look === 'rise') {
        const p = Math.max(0, Math.min(1, (u - i * 0.045) / 0.2)), e = 1 - (1 - p) * (1 - p), sy = 1 + 0.45 * (1 - e);
        L.lg.position.y = -0.9 * (1 - e); L.lg.scale.set(1 / sy, sy, 1); a = Math.min(1, p * 3);
        if (ex > 0) { const q = Math.max(0, Math.min(1, (ex * 1.3 - i * 0.04))); L.lg.position.y -= 1.4 * q * q; }
      } else if (look === 'stamp' && ex > 0) {
        const ang = seed(20 + i) * 6.2832; L.lg.position.x += Math.cos(ang) * 1.6 * ex * ex; L.lg.position.y += Math.sin(ang) * 1.6 * ex * ex - 0.6 * ex * ex; L.lg.rotation.z = (seed(60 + i) - 0.5) * 3 * ex;
      }
      a *= 1 - ex;
      L.m.material.opacity = a; L.edge.material.opacity = a * (__TT_CEL ? 1 : 0.85);
    });
    if (look !== 'rise') __ttSparks(r, u, land, ex < 0.6);
  }
  __ttFlash.style.opacity = flash.toFixed(3);
}`;
}
