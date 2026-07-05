/**
 * channels — the in-page channel scripts for the three.js World emitter
 * (renderer-emitter.plan.md E2b). Each function returns a JS source block that
 * emitThreeWorld splices into the page's module script; a channel not present in the
 * payload contributes ZERO bytes (the byte-identical-when-absent doctrine). Moved
 * verbatim out of scene-three.js — same functions, same emitted bytes; scene-three.js
 * remains the only consumer and owns splice order.
 *
 * Blocks run inside the page module and share its lexical scope: they may reference
 * the emitter-established globals (scene, camera, canvas, wrap, solids, meshes,
 * decodeF32, controls) and mutate the `let stepX` bindings the emitter declares.
 * The .toString()-stringified kernels (buildSim / buildControllable / buildBus /
 * buildBeatsKernel) must stay self-contained closures — no imports, no module scope.
 */

import { buildSim } from '../worlds/physics-sim.js';
import { buildControllable } from '../worlds/controllable-world.js';
import { buildBus } from '../worlds/event-bus.js';
import { buildBeatsKernel } from '../beats/beats-kernel.js';
import { PATCHES as BEATS_PATCHES } from '../beats/audio-patches.js';
import { CONTRACT_VERSION as GAME_CONTRACT_VERSION, MSG_READY as GAME_MSG_READY, MSG_INIT as GAME_MSG_INIT, MSG_OUTCOME as GAME_MSG_OUTCOME } from '../game/level-contract.js';
import { b64, safeJson } from './emit-util.js';
import { MOVER_HUD_JS } from '../views/science/mover-huds.js';


// In-page script: build one shared radial-gradient sprite texture, then drop an additive
// camera-facing THREE.Sprite at each emitter. depthWrite:false so halos blend over the
// baked mesh without z-fighting; AdditiveBlending so overlapping lamps accumulate light.
export function glowSpriteScript(sprites, opacity) {
  return `
// --- object-glow sprites (emitThreeWorld glow option) ---
const GLOW = ${safeJson(sprites)};
const glowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill();
  return new THREE.CanvasTexture(cv);
})();
for (const e of GLOW) {
  const mat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(e.color[0], e.color[1], e.color[2]),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: ${opacity} });
  const sp = new THREE.Sprite(mat);
  sp.position.set(e.pos[0], e.pos[1], e.pos[2]);
  sp.scale.set(e.size, e.size, 1);
  scene.add(sp);
}`;
}

// In-page script: the PICK channel (emitThreeWorld picks option). Click a pickable sub-mesh
// (keyed by its render-group name via mesh.userData.g) → raise a DOM metadata popup. A small
// pointer-movement threshold distinguishes a click from an orbit-drag, so it composes with
// OrbitControls. Raycasts every fill mesh (incl. wireframe-hidden ones, so picking still works
// in construction mode). Only emitted when the caller passes a non-empty `picks`.
export function pickChannelScript(pickMeta) {
  return `
const PICK_META = ${safeJson(pickMeta)};
const molPopup = document.getElementById('molPopup');
const pickRay = new THREE.Raycaster(), pickNdc = new THREE.Vector2();
let pickDown = null;
const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function hidePick() { if (molPopup) { molPopup.hidden = true; } }
function showPick(p, clientX, clientY) {
  if (!molPopup) return;
  const rows = (p.fields || []).map((f) => '<div class="pk-row"><span class="pk-k">' + escHtml(f.k) + '</span><span class="pk-v">' + escHtml(f.v) + '</span></div>').join('');
  molPopup.innerHTML = '<div class="pk-label">' + escHtml(p.label || p.name) + '</div>' + rows;
  const r = wrap.getBoundingClientRect();
  molPopup.hidden = false;
  const pw = molPopup.offsetWidth, ph = molPopup.offsetHeight;
  let x = clientX - r.left + 12, y = clientY - r.top + 12;
  x = Math.max(4, Math.min(x, r.width - pw - 4));
  y = Math.max(4, Math.min(y, r.height - ph - 4));
  molPopup.style.left = x + 'px'; molPopup.style.top = y + 'px';
}
canvas.addEventListener('pointerdown', (e) => { pickDown = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!pickDown) return;
  const moved = Math.hypot(e.clientX - pickDown[0], e.clientY - pickDown[1]);
  pickDown = null;
  if (moved > 5) return;                 // it was an orbit-drag, not a click
  const r = canvas.getBoundingClientRect();
  pickNdc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pickNdc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  pickRay.setFromCamera(pickNdc, camera);
  const hits = pickRay.intersectObjects(solids, false);
  for (const h of hits) {
    const meta = h.object && h.object.userData && PICK_META[h.object.userData.g];
    if (meta) { showPick(meta, e.clientX, e.clientY); return; }
  }
  hidePick();                            // clicked empty space → dismiss
});`;
}

// In-page script: the adaptive-signage channel (emitThreeWorld signs option). A DOM overlay layer
// of notes — tooltip / popup / toast — billboarded over the free-orbit scene: each frame, a sign's
// world anchor (an explicit point, or the centre of the mesh whose render-group name matches its
// { object } anchor) is projected to screen and the div re-positioned (hidden when behind). Toast
// timing is real-time (setTimeout, like the CSS-3D path); popup pages via its down-button (no wheel
// scroll); tooltip shows on hover/tap. Chrome is pre-derived from the scene palette. Only emitted
// when the caller passes a non-empty `signs` — every existing World is byte-for-byte unchanged.
export function signageChannelScript(signs) {
  return `
const SIGNS = ${safeJson(signs)};
const signLayer = document.getElementById('mojSigns');
const _signEls = {}, _signAnchors = {};
const _signVp = new THREE.Vector3();
const escS = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function signCardCss(c) { const sh = c.glow && c.glow !== 'none' ? c.glow : (c.shadow && c.shadow !== 'none' ? c.shadow : 'none'); return 'background:' + c.bg + ';color:' + c.color + ';border:' + c.border + ';border-radius:' + c.radius + ';box-shadow:' + sh + ';font-family:' + c.font + ';font-size:' + c.fontSize + 'px;font-weight:' + c.fontWeight + ';padding:' + c.padding + ';'; }
function signMeshCenter(name) { let found = null; scene.traverse((o) => { if (!found && o.isMesh && o.userData && o.userData.g === name) found = o; }); if (!found) return null; const g = found.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const ctr = g.boundingSphere.center.clone(); found.localToWorld(ctr); return ctr; }
SIGNS.forEach((s) => {
  const el = document.createElement('div'); el.className = 'moj-sign moj-sign--' + s.variant; el.dataset.signId = s.id;
  if (s.variant === 'tooltip') {
    el.tabIndex = 0;
    el.innerHTML = '<span class="moj-dot" style="background:' + (s.chrome.color || '#fff') + '"></span><div class="moj-tip" style="' + signCardCss(s.chrome) + '">' + escS(s.text) + '</div>';
    el.addEventListener('click', () => el.classList.toggle('tapped'));
  } else if (s.variant === 'popup') {
    el.setAttribute('style', signCardCss(s.chrome));
    const perPage = s.pageLines || 4; const pages = []; for (let i = 0; i < s.body.length; i += perPage) pages.push(s.body.slice(i, i + perPage));
    const pg = pages.length ? pages : [[s.text || '']];
    el.innerHTML = '<div class="moj-pages">' + pg.map((p, pi) => '<div class="moj-pg' + (pi === 0 ? ' on' : '') + '">' + p.map((l) => '<div>' + escS(l) + '</div>').join('') + '</div>').join('') + '</div>' + (pages.length > 1 ? '<button class="moj-pg-down">▾ <span class="moj-pg-ind">1/' + pages.length + '</span></button>' : '');
    const pEls = [...el.querySelectorAll('.moj-pg')], ind = el.querySelector('.moj-pg-ind'), btn = el.querySelector('.moj-pg-down'); let pi = 0;
    if (btn) btn.addEventListener('click', () => { pEls[pi].classList.remove('on'); pi = (pi + 1) % pEls.length; pEls[pi].classList.add('on'); if (ind) ind.textContent = (pi + 1) + '/' + pEls.length; });
  } else {
    el.setAttribute('style', signCardCss(s.chrome));
    el.innerHTML = (s.body.length ? s.body : [s.text || '']).map((l) => '<div>' + escS(l) + '</div>').join('');
    const a = s.after || 0, ttl = s.ttl || 2.5; setTimeout(() => { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), ttl * 1000); }, a * 1000);
  }
  const an = s.anchor || {};
  if (an.kind === 'slot') el.classList.add('moj-slot-' + an.slot);
  else if (an.kind === 'xy') { el.style.left = an.xy[0] + 'px'; el.style.top = an.xy[1] + 'px'; el.classList.add('moj-sign-pt'); }
  else { el.classList.add('moj-sign-track'); _signAnchors[s.id] = an.kind === 'world' ? new THREE.Vector3(an.world[0], an.world[1], an.world[2]) : null; }
  signLayer.appendChild(el); _signEls[s.id] = el;
});
stepSigns = function () {
  for (const s of SIGNS) {
    const el = _signEls[s.id]; if (!el || !el.classList.contains('moj-sign-track')) continue;
    let p = _signAnchors[s.id];
    if (!p) { p = signMeshCenter((s.anchor || {}).object); if (p) _signAnchors[s.id] = p; }
    if (!p) { el.style.display = 'none'; continue; }
    _signVp.copy(p).project(camera);
    if (_signVp.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = '';
    el.style.left = (_signVp.x * 0.5 + 0.5) * wrap.clientWidth + 'px';
    el.style.top = (-_signVp.y * 0.5 + 0.5) * wrap.clientHeight + 'px';
  }
};`;
}

// In-page script: the TRACER channel. Each tracer is a glowing additive sprite that advances along
// its `path` (a polyline) once per `period` seconds, looping — e.g. an electron tracing an orbital's
// wave-path. A short fading trail of dimmer sprites follows. Driven off setAnimationLoop's clock (no
// Date.now). Only emitted when the caller passes a non-empty `tracers`.
export function tracerChannelScript(tracers) {
  return `
const TRACERS = ${safeJson(tracers)};
function tracerTex(rgb) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(' + rgb.join(',') + ',0.95)');
  g.addColorStop(0.6, 'rgba(' + rgb.join(',') + ',0.35)'); g.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill(); return new THREE.CanvasTexture(cv);
}
const tracerRigs = TRACERS.map((tr) => {
  const rgb = tr.color || [120, 200, 255];
  const tex = tracerTex(rgb);
  const trail = Math.max(0, Math.floor(tr.trail ?? 14));
  const mk = (op, sz) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op })); s.scale.set(sz, sz, 1); s.renderOrder = 3; scene.add(s); return s; };
  const head = mk(1, tr.size || 1.2);
  const trailSprites = Array.from({ length: trail }, (_, i) => mk(0.5 * (1 - i / (trail + 1)), (tr.size || 1.2) * (1 - 0.5 * i / (trail + 1))));
  return { path: tr.path, segments: tr.segments || null, period: Math.max(1, tr.period || 10), lag: (tr.trailLag ?? 0.006), head, trailSprites };
});
function tracerAt(path, u) {
  const uu = ((u % 1) + 1) % 1; const f = uu * (path.length - 1); const i = Math.floor(f), a = f - i;
  const p0 = path[i], p1 = path[Math.min(i + 1, path.length - 1)];
  return [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a];
}

// Orbital FOCUS (Current/All): when a tracer carries path \`segments\` (index range → render-group),
// only the group the tracer is CURRENTLY in is shown; a HUD toggle flips to showing all at once.
const _orbGroups = Object.keys(meshes).filter((n) => n.indexOf('orb:') === 0);
const _baseAlpha = {}; for (const g of _orbGroups) _baseAlpha[g] = meshes[g].material.opacity;
const _hasSeg = tracerRigs.some((r) => r.segments);
const FOCUS_ALPHA = 0.85;
let focusMode = true, _curGroup = null;
if (_hasSeg) {
  const fb = document.createElement('button');
  const lab = () => { fb.textContent = 'orbital: ' + (focusMode ? 'current' : 'all'); fb.classList.toggle('on', focusMode); };
  fb.onclick = () => { focusMode = !focusMode; lab(); };
  lab(); hud.appendChild(fb);
}
function _groupAt(rig, u) {
  const idx = (((u % 1) + 1) % 1) * (rig.path.length - 1);
  for (const s of rig.segments) if (idx >= s.start && idx < s.end) return s.group;
  return rig.segments[rig.segments.length - 1].group;
}

stepTracers = (t) => {
  const sec = t / 1000;
  for (const rig of tracerRigs) {
    const u = sec / rig.period;
    const h = tracerAt(rig.path, u); rig.head.position.set(h[0], h[1], h[2]);
    rig.trailSprites.forEach((sp, i) => { const p = tracerAt(rig.path, u - rig.lag * (i + 1)); sp.position.set(p[0], p[1], p[2]); });
    if (rig.segments) _curGroup = _groupAt(rig, u);
  }
  if (_hasSeg) for (const g of _orbGroups) {
    const m = meshes[g]; if (!m) continue;
    const target = focusMode ? (g === _curGroup ? FOCUS_ALPHA : 0) : _baseAlpha[g];
    m.material.opacity += (target - m.material.opacity) * 0.12;
    m.visible = (typeof wireframeOn !== 'undefined' && wireframeOn) ? m.visible : (m.material.opacity > 0.012);
  }
};`;
}

// In-page script: the COMET channel. A comet rides its equal-dt Kepler `path` like a tracer, but it
// also grows a coma + two tails whose geometry is recomputed EVERY FRAME relative to the Sun: the ion
// tail is straight anti-solar (normalize(pos − sun)), the dust tail bends from anti-solar toward the
// trailing orbital direction (−velocity) so it curves and lags. Both bloom near perihelion and shrink
// to nothing near aphelion via `activity` (0 at aphelion → 1 at perihelion). All sprites are additive
// glows (same idiom as the tracer channel); a faint orbit track line + a Sun glow + a real-units
// readout round it out. Purely additive — only emitted when the caller passes a non-empty `comets`.
export function cometChannelScript(comets) {
  return `
const COMETS = ${safeJson(comets)};
function cometTex(rgb, soft) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); const c = rgb.join(',');
  g.addColorStop(0, 'rgba(255,255,255,' + (soft ? 0.85 : 1) + ')'); g.addColorStop(0.25, 'rgba(' + c + ',0.85)');
  g.addColorStop(0.6, 'rgba(' + c + ',0.30)'); g.addColorStop(1, 'rgba(' + c + ',0)');
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, 7); x.fill(); return new THREE.CanvasTexture(cv);
}
function cometSprite(tex, op, sz) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
  s.scale.set(sz, sz, 1); s.renderOrder = 3; scene.add(s); return s;
}
function cometAt(path, u) {
  const uu = ((u % 1) + 1) % 1; const f = uu * (path.length - 1); const i = Math.floor(f), a = f - i;
  const p0 = path[i], p1 = path[Math.min(i + 1, path.length - 1)];
  return [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a];
}
const _csub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _clen = (a) => Math.hypot(a[0], a[1], a[2]) || 1e-6;
const _cnorm = (a) => { const L = _clen(a); return [a[0] / L, a[1] / L, a[2] / L]; };
const _clerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cometRigs = COMETS.map((cm) => {
  const sun = cm.sun || [0, 0, 0];
  if (cm.track !== false) {
    const tg = new THREE.BufferGeometry().setFromPoints(cm.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const ln = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: cm.trackColor != null ? cm.trackColor : 0x39507a, transparent: true, opacity: 0.5 }));
    ln.renderOrder = 1; scene.add(ln);
  }
  const sg = cometSprite(cometTex(cm.sunColor || [255, 210, 110], true), 0.95, cm.sunSize || 3);
  sg.position.set(sun[0], sun[1], sun[2]);
  const nuc = cometSprite(cometTex((cm.nucleus && cm.nucleus.color) || [240, 240, 220], false), 1, (cm.nucleus && cm.nucleus.size) || 0.6);
  const coma = cometSprite(cometTex((cm.coma && cm.coma.color) || [170, 215, 255], true), 0.4, 1);
  const ion = cm.ion || {}; const ionN = Math.max(0, Math.floor(ion.count != null ? ion.count : 22));
  const ionTex = cometTex(ion.color || [120, 180, 255], true);
  const ionSprites = Array.from({ length: ionN }, (_, i) => cometSprite(ionTex, 0, (ion.width || 0.5) * (1 - 0.4 * i / (ionN + 1))));
  const dust = cm.dust || {}; const dustN = Math.max(0, Math.floor(dust.count != null ? dust.count : 18));
  const dustTex = cometTex(dust.color || [240, 210, 150], true);
  const dustSprites = Array.from({ length: dustN }, (_, i) => cometSprite(dustTex, 0, (dust.width || 0.7) * (1 + 0.6 * i / (dustN + 1))));
  let ro = null;
  if (cm.readout !== false) { ro = document.createElement('div'); ro.className = 'moj-readout'; wrap.appendChild(ro); }
  return { cm, sun, nuc, coma, ion, ionSprites, dust, dustSprites, ro };
});
stepComets = (t) => {
  const sec = t / 1000;
  for (const rig of cometRigs) {
    const cm = rig.cm; const u = sec / cm.period;
    const pos = cometAt(cm.path, u); const ahead = cometAt(cm.path, u + 0.003);
    const velDir = _cnorm(_csub(ahead, pos));
    const radial = _csub(pos, rig.sun); const r = _clen(radial); const anti = _cnorm(radial);
    const span = Math.max(1e-6, cm.rAphe - cm.rPeri);
    const rn = Math.max(0, Math.min(1, (r - cm.rPeri) / span));
    const activity = Math.pow(1 - rn, cm.sharp || 2.2);
    rig.nuc.position.set(pos[0], pos[1], pos[2]);
    rig.coma.position.set(pos[0], pos[1], pos[2]);
    const comaSz = ((cm.nucleus && cm.nucleus.size) || 0.6) + ((cm.coma && cm.coma.size) || 2.0) * activity;
    rig.coma.scale.set(comaSz, comaSz, 1); rig.coma.material.opacity = 0.12 + 0.5 * activity;
    const ionLen = (rig.ion.maxLen || 10) * activity; const ionN = rig.ionSprites.length;
    rig.ionSprites.forEach((sp, i) => {
      const f = (i + 1) / ionN;
      sp.position.set(pos[0] + anti[0] * ionLen * f, pos[1] + anti[1] * ionLen * f, pos[2] + anti[2] * ionLen * f);
      sp.material.opacity = 0.6 * (1 - i / (ionN + 1)) * Math.min(1, activity * 1.4);
    });
    const dustLen = (rig.dust.maxLen || 7) * activity; const dustN = rig.dustSprites.length; const curve = rig.dust.curve != null ? rig.dust.curve : 0.6;
    rig.dustSprites.forEach((sp, i) => {
      const f = (i + 1) / dustN; const dir = _cnorm(_clerp(anti, [-velDir[0], -velDir[1], -velDir[2]], curve * f));
      sp.position.set(pos[0] + dir[0] * dustLen * f, pos[1] + dir[1] * dustLen * f, pos[2] + dir[2] * dustLen * f);
      sp.material.opacity = 0.5 * (1 - i / (dustN + 1)) * Math.min(1, activity * 1.4);
    });
    if (rig.ro) {
      const idx = Math.round((((u % 1) + 1) % 1) * (cm.dist.length - 1));
      rig.ro.innerHTML = '<b>' + (cm.name || 'comet') + '</b>'
        + '<span>r = ' + cm.dist[idx].toFixed(2) + ' ' + (cm.distUnit || 'AU') + '</span>'
        + '<span class="v">v = ' + cm.speed[idx].toFixed(1) + ' ' + (cm.speedUnit || 'km/s') + '</span>'
        + '<span class="a">tail → away from Sun</span>';
    }
  }
};`;
}

// In-page script: the MOVER channel. Where the tracer moves a glowing additive SPRITE, a mover
// translates a SOLID render-group (a body mesh) along its `path` polyline — the Newtonian-motion
// channel (mechanics-view). The path is sampled at EQUAL TIME STEPS by the planner, so walking it at
// a constant parameter rate makes the body visibly accelerate (no time-warp logic here). Optional
// per-frame velocity / acceleration arrows (plain ArrowHelpers, no glow) + a numeric readout are
// driven off finite-differenced kinematics the planner ships in each mover. `loop:false` clamps at
// the end, holds, then replays (one-shot arcs); `loop:true` wraps (periodic, e.g. a pendulum). A
// `tether` point draws a line from a fixed anchor to the body each frame (the pendulum string).
// Only emitted when the caller passes a non-empty `movers`.
export function moverChannelScript(movers) {
  return `
const MOVERS = ${safeJson(movers)};
function moverAt(path, u) {
  const f = Math.max(0, Math.min(1, u)) * (path.length - 1); const i = Math.floor(f), a = f - i;
  const p0 = path[i], p1 = path[Math.min(i + 1, path.length - 1)];
  return [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a];
}
function moverU(mv, sec) {
  if (mv.loop) return ((sec / mv.period) % 1 + 1) % 1;
  const cycle = mv.period + (mv.hold || 0); const ph = sec % cycle;   // one-shot: play, hold at end, replay
  return ph < mv.period ? ph / mv.period : 1;
}
// CASCADE lifetimes: a mover may instead carry an absolute lifetime { t0, t1 } on a single SHARED scene
// clock (the chain-reaction timeline, where bodies appear and vanish at staggered times). _LIFE_T is that
// timeline's loop length — the latest t1 plus a tail hold — so the whole cascade replays in step. A
// lifetime mover is hidden outside its window; with \`vanish\` it disappears at t1 (a neutron absorbed),
// otherwise it freezes at its path end (a fragment come to rest, staying on screen as the reaction runs).
const _LIFE_T = (() => { let m = 0, any = false; for (const mv of MOVERS) { if (mv.t1 != null) { any = true; if (mv.t1 > m) m = mv.t1; } } return any ? m + 1.4 : 0; })();
function moverLifeU(mv, s) { return Math.max(0, Math.min(1, (s - mv.t0) / Math.max(1e-3, mv.t1 - mv.t0))); }
const _VEL_COL = 0x55e08a, _ACC_COL = 0xff6b4a, _TETHER_COL = 0x8e9bb6;
${MOVER_HUD_JS}
const moverRigs = MOVERS.map((mv) => {
  const mesh = meshes[mv.group] || null;
  let vel = null, acc = null, tether = null, forces = null;
  if (mv.vectors) {
    vel = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), mv.arrowLen, _VEL_COL, mv.arrowLen * 0.26, mv.arrowLen * 0.16);
    acc = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), mv.arrowLen, _ACC_COL, mv.arrowLen * 0.26, mv.arrowLen * 0.16);
    vel.renderOrder = acc.renderOrder = 3; scene.add(vel); scene.add(acc);
  }
  if (mv.forces) {   // one ArrowHelper per force channel (the moving free-body diagram)
    forces = mv.forces.map((ch) => {
      const ar = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), mv.arrowLen, ch.color, mv.arrowLen * 0.26, mv.arrowLen * 0.16);
      ar.renderOrder = 3; scene.add(ar); return ar;
    });
  }
  if (mv.tether) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(mv.tether[0], mv.tether[1], mv.tether[2]), new THREE.Vector3()]);
    tether = new THREE.Line(g, new THREE.LineBasicMaterial({ color: _TETHER_COL })); scene.add(tether);
  }
  if (mv.track) {   // draw the trajectory itself as a faint static rail (orbit ellipses, etc.)
    const tg = new THREE.BufferGeometry().setFromPoints(mv.path.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    scene.add(new THREE.Line(tg, new THREE.LineBasicMaterial({ color: mv.trackColor || 0x42577f, transparent: true, opacity: 0.5 })));
  }
  return { mv, mesh, base: mv.basePos, vel, acc, tether, forces };
});
let _readout = null;
if (moverRigs.length && (moverRigs[0].mv.vectors || moverRigs[0].mv.forces || moverRigs[0].mv.system || moverRigs[0].mv.compare || moverRigs[0].mv.cascade || moverRigs[0].mv.machine || moverRigs[0].mv.engine || moverRigs[0].mv.motor || moverRigs[0].mv.drone || moverRigs[0].mv.flight || moverRigs[0].mv.sub)) {   // hidden only when all off
  _readout = document.createElement('div'); _readout.className = 'moj-readout'; wrap.appendChild(_readout);
}
const _v3 = new THREE.Vector3(), _spinAxis = new THREE.Vector3(), _xUnit = new THREE.Vector3(1, 0, 0);
stepMovers = (t) => {
  const sec = t / 1000;
  for (const rig of moverRigs) {
    const mv = rig.mv;
    // CASCADE carrier: a meshless mover that only drives the population readout, counting live from the
    // shared-clock lifetimes (neutrons alive now, fissions fired so far). Always first; never vanishes.
    if (mv.cascade) {
      if (_readout && rig === moverRigs[0]) {
        const s = _LIFE_T > 0 ? (sec % _LIFE_T) : sec;
        let alive = 0, fiss = 0;
        for (const m2 of MOVERS) {
          if (m2.kindTag === 'neutron') { if (s >= m2.t0 && s <= m2.t1) alive++; }
          else if (m2.kindTag === 'fission') { if (s >= m2.t0) fiss++; }
        }
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _cascadeHud(mv.cascade, alive, fiss, mv.cascade.peak || 1);
      }
      continue;
    }
    // spin mode: rotate the render group about an axis through its pivot (a windmill rotor). The group
    // geometry is authored centred on the pivot; we place it at the pivot and spin it about the axis.
    if (mv.spin) {
      // optional lift: a per-sample vertical offset on the (loop-period) clock, so a propeller can SPIN
      // and RISE with its craft at once (a drone rotor climbing while the body translates the same lift).
      let lz = 0;
      if (mv.lift) { const u = moverU(mv, sec), n = mv.lift.length; lz = mv.lift[Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))))]; }
      if (rig.mesh) {
        rig.mesh.position.set(mv.pivot[0] - rig.base[0], mv.pivot[1] - rig.base[1], mv.pivot[2] + lz - rig.base[2]);
        rig.mesh.quaternion.setFromAxisAngle(_spinAxis.set(mv.spin.axis[0], mv.spin.axis[1], mv.spin.axis[2]).normalize(), mv.spin.omega * sec);
      }
      continue;
    }
    // TURN mode: PHASE-DRIVEN rotation about an axis through 'center' — the angle is read from a per-sample
    // array on the SAME play→hold→replay cycle the translating movers use, so a lever beam tilts, a screw
    // thread turns and a wheel spins exactly in step with their load (unlike spin's constant ω). The group
    // geometry is authored RELATIVE to 'center' (corner − center), so placing it at center + rotating about
    // the axis pivots it in place.
    if (mv.turn) {
      const u = moverU(mv, sec), i = Math.max(0, Math.min(mv.turn.angles.length - 1, Math.round(u * (mv.turn.angles.length - 1))));
      if (rig.mesh) {
        rig.mesh.position.set(mv.turn.center[0] - rig.base[0], mv.turn.center[1] - rig.base[1], mv.turn.center[2] - rig.base[2]);
        rig.mesh.quaternion.setFromAxisAngle(_spinAxis.set(mv.turn.axis[0], mv.turn.axis[1], mv.turn.axis[2]).normalize(), mv.turn.angles[i]);
      }
      // an electric motor's armature is a turn mover — drive its (static) readout from here
      if (_readout && rig === moverRigs[0] && mv.motor) _readout.innerHTML = '<b>' + mv.label + '</b>' + _motorHud(mv);
      continue;
    }
    // FILL mode: a tank's CONTENTS scaling vertically from the tank floor — a ballast tank flooding (frac→1)
    // and blowing (frac→0). Geometry authored from the floor up (z in [0, height]); scale.z = the fill
    // fraction anchored at the base height, plus an optional lift so the tank can ride a moving vehicle.
    if (mv.fill) {
      const u = moverU(mv, sec), n = mv.fill.frac.length, i = Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))));
      let lz = 0; if (mv.lift) { const j = Math.max(0, Math.min(mv.lift.length - 1, Math.round(u * (mv.lift.length - 1)))); lz = mv.lift[j]; }
      if (rig.mesh) {
        rig.mesh.position.set(-rig.base[0], -rig.base[1], mv.fill.base + lz - rig.base[2]);
        rig.mesh.scale.set(1, 1, Math.max(0.001, mv.fill.frac[i]));
      }
      continue;
    }
    // LINK mode: a rigid bar spanning two INDEPENDENTLY MOVING endpoints (a connecting rod between an
    // orbiting crank pin and a reciprocating piston). The bar geometry is authored as a UNIT segment along
    // +x from the origin; each frame we place it at A, aim +x at B, and scale x to |B−A| so it spans the gap.
    if (mv.link) {
      const u = moverU(mv, sec), n = mv.from.length, i = Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))));
      const A = mv.from[i], B = mv.to[i];
      const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], len = Math.hypot(dx, dy, dz) || 1e-6;
      if (rig.mesh) {
        rig.mesh.position.set(A[0] - rig.base[0], A[1] - rig.base[1], A[2] - rig.base[2]);
        rig.mesh.quaternion.setFromUnitVectors(_xUnit, _v3.set(dx / len, dy / len, dz / len));
        rig.mesh.scale.set(len, 1, 1);
      }
      continue;
    }
    // POSE mode: a rigid body that TRANSLATES along a path AND TILTS (per-sample orientation) at once — an
    // aircraft banking/pitching as it flies a route. Geometry authored relative to the body centre; each
    // frame we place it at path(u) and rotate it by the sampled tilt angle about its axis.
    if (mv.pose) {
      const u = moverU(mv, sec), n = mv.path.length, i = Math.max(0, Math.min(n - 1, Math.round(u * (n - 1))));
      const p = moverAt(mv.path, u);
      if (rig.mesh) {
        rig.mesh.position.set(p[0] - rig.base[0], p[1] - rig.base[1], p[2] - rig.base[2]);
        rig.mesh.quaternion.setFromAxisAngle(_spinAxis.set(mv.tilt.axis[0], mv.tilt.axis[1], mv.tilt.axis[2]).normalize(), mv.tilt.angles[i]);
      }
      if (_readout && rig === moverRigs[0] && mv.flight) _readout.innerHTML = '<b>' + mv.label + '</b>' + _flightHud(mv, i);
      continue;
    }
    // PULSE mode: a scale-pop synced to a PHASE of the loop period — a combustion flash that fires once per
    // cycle at the power stroke (unlike the cascade 'flash', which keys off the absolute lifetime clock).
    if (mv.pulse) {
      const u = moverU(mv, sec), dd = ((u - mv.pulse.phase) % 1 + 1) % 1, d = Math.min(dd, 1 - dd), on = d < mv.pulse.width;
      if (rig.mesh) {
        rig.mesh.visible = on;
        if (on) {
          rig.mesh.position.set(mv.pulse.at[0] - rig.base[0], mv.pulse.at[1] - rig.base[1], mv.pulse.at[2] - rig.base[2]);
          rig.mesh.scale.setScalar(Math.max(0.001, (mv.pulse.size || 1) * (1 - d / mv.pulse.width)));
        }
      }
      continue;
    }
    // FLASH: a brief scale-pop at a fixed point (a fission burst). Geometry authored centred on the
    // origin, so we place it at mv.at and pulse its scale 0→size→0 across [t0,t1]; hidden otherwise.
    if (mv.flash) {
      const s = _LIFE_T > 0 ? (sec % _LIFE_T) : sec;
      const on = s >= mv.t0 && s <= mv.t1;
      if (rig.mesh) {
        rig.mesh.visible = on;
        if (on) {
          const a = (s - mv.t0) / Math.max(1e-3, mv.t1 - mv.t0);
          const sc = Math.max(0.001, Math.sin(Math.PI * a) * (mv.flash.size || 1));
          rig.mesh.position.set(mv.at[0] - rig.base[0], mv.at[1] - rig.base[1], mv.at[2] - rig.base[2]);
          rig.mesh.scale.setScalar(sc);
        }
      }
      continue;
    }
    const N = mv.path.length;
    // LIFETIME mover (cascade): visible only within its [t0,t1] window on the shared clock; walks its
    // segment over that window. Otherwise the legacy period/loop walk (mechanics, orbit) is unchanged.
    let u;
    if (mv.t1 != null) {
      const s = _LIFE_T > 0 ? (sec % _LIFE_T) : sec;
      const vis = s >= mv.t0 && (mv.vanish ? s <= mv.t1 : true);
      if (rig.mesh) rig.mesh.visible = vis;
      if (!vis) continue;
      u = moverLifeU(mv, s);
    } else {
      u = moverU(mv, sec);
    }
    const i = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
    const p = moverAt(mv.path, u);
    if (rig.mesh) rig.mesh.position.set(p[0] - rig.base[0], p[1] - rig.base[1], p[2] - rig.base[2]);
    if (rig.tether) { const a = rig.tether.geometry.attributes.position; a.setXYZ(1, p[0], p[1], p[2]); a.needsUpdate = true; }
    if (mv.vectors) {
      const vd = mv.vdir[i], av = mv.avec[i];
      const vlen = Math.max(0.01, mv.arrowLen * (mv.speed[i] / mv.maxSpeed));
      rig.vel.position.set(p[0], p[1], p[2]);
      rig.vel.setDirection(_v3.set(vd[0], vd[1], vd[2]).normalize());
      rig.vel.setLength(vlen, vlen * 0.26, vlen * 0.16);
      const an = Math.hypot(av[0], av[1], av[2]) || 1, alen = Math.max(0.01, mv.arrowLen * (mv.accel[i] / mv.maxAccel));
      rig.acc.position.set(p[0], p[1], p[2]);
      rig.acc.setDirection(_v3.set(av[0] / an, av[1] / an, av[2] / an));
      rig.acc.setLength(alen, alen * 0.26, alen * 0.16);
    }
    if (mv.forces && rig.forces) {   // moving free-body diagram: each force arrow scaled vs maxForce
      for (let c = 0; c < mv.forces.length; c++) {
        const fv = mv.forces[c].vecs[i], fn = Math.hypot(fv[0], fv[1], fv[2]), ar = rig.forces[c];
        if (fn < 1e-6) { ar.visible = false; continue; }
        ar.visible = true;
        const flen = Math.max(0.01, mv.arrowLen * (fn / mv.maxForce));
        ar.position.set(p[0], p[1], p[2]);
        ar.setDirection(_v3.set(fv[0] / fn, fv[1] / fn, fv[2] / fn));
        ar.setLength(flen, flen * 0.26, flen * 0.16);
      }
    }
    if (_readout && rig === moverRigs[0]) {
      if (mv.compare) {   // two-body side-by-side comparison: a dual readout (both bodies + their times)
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _compareHud(mv);
      } else if (mv.machine) {   // simple machine: a mechanical-advantage headline + the conservation-of-work bars
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _machineHud(mv) + _workbars(mv, i);
      } else if (mv.engine) {   // reciprocating engine: crank angle + the reciprocating↔rotary conversion story
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _engineHud(mv, i);
      } else if (mv.drone) {   // multirotor aircraft: the whole-craft lift-vs-weight balance (ΣF = ma)
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _droneHud(mv, i);
      } else if (mv.sub) {   // submarine: the buoyancy-vs-weight balance (ballast controls weight)
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _subHud(mv, i);
      } else if (mv.system) {   // two-body collision: a system (momentum / KE) readout, not single-body kinematics
        _readout.innerHTML = '<b>' + mv.label + '</b>' + _collisionHud(mv, i);
      } else {
        // backward-compatible readout: mechanics shows t + g; orbit-view passes dist/footer/units → r + period.
        const ad = mv.accelDecimals != null ? mv.accelDecimals : 1;
        _readout.innerHTML = '<b>' + mv.label + '</b>'
          + (mv.dist ? '<span>r = ' + mv.dist[i].toFixed(2) + ' ' + (mv.distUnit || '') + '</span>'
            : '<span>t = ' + (u * mv.duration).toFixed(2) + ' s</span>')
          + '<span class="v">v = ' + mv.speed[i].toFixed(1) + ' ' + (mv.speedUnit || 'm/s') + '</span>'
          + '<span class="a">a = ' + mv.accel[i].toFixed(ad) + ' ' + (mv.accelUnit || 'm/s²') + '</span>'
          + '<span>' + (mv.footer || ('g = ' + mv.g.toFixed(1) + ' m/s²')) + '</span>'
          + (mv.energy ? _ebars(mv, i) : '')
          + (mv.forces ? _flegend(mv, i) : '');
      }
    }
  }
};`;
}

// In-page script: the FIELD channel. Where the mover translates one solid body, a field renders a
// LATTICE of vector arrows over space, updated per frame from an analytic field — the electromagnetism
// channel (field-view). Two modes off one sample shape: `animate:true` oscillates each arrow by
// sin(phase0 − ω·t) (a travelling E⊥B plane wave, with an optional moving sine curve through the arrow
// tips), and `animate:false` orients static needles along a frozen B (iron filings). Static field
// lines (dipole curves, B loops, coil windings) draw once as faint THREE.Lines, and an optional static
// readout (λ / f / c, etc.) reuses .moj-readout. Reuses the ArrowHelper + Line + readout idioms; no
// glow. Only emitted when the caller passes a non-empty `fields`.
export function fieldChannelScript(fields) {
  return `
const FIELDS = ${safeJson(fields)};
const fieldRigs = FIELDS.map((fd) => {
  const sets = (fd.sets || []).map((st) => {
    const col = st.color || 0xffffff;
    const arrows = st.samples.map((s) => {
      const a = new THREE.ArrowHelper(new THREE.Vector3(s.dir[0], s.dir[1], s.dir[2]).normalize(),
        new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]), Math.max(0.01, s.amp), s.color != null ? s.color : col, Math.max(0.01, s.amp) * 0.34, Math.max(0.01, s.amp) * 0.22);
      a.renderOrder = 3; scene.add(a); return a;
    });
    let curve = null;
    if (st.curve) { const g = new THREE.BufferGeometry().setFromPoints(st.samples.map(() => new THREE.Vector3())); curve = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col })); scene.add(curve); }
    return { st, arrows, curve };
  });
  (fd.lines || []).forEach((ln) => {
    const g = new THREE.BufferGeometry().setFromPoints(ln.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: ln.color || 0x6688cc, transparent: true, opacity: ln.opacity != null ? ln.opacity : 0.7 })));
  });
  if (Array.isArray(fd.readout) && fd.readout.length) {
    const ro = document.createElement('div'); ro.className = 'moj-readout';
    ro.innerHTML = fd.readout.map((s, k) => k === 0 ? '<b>' + s + '</b>' : '<span>' + s + '</span>').join('');
    wrap.appendChild(ro);
  }
  return { fd, sets, _init: false };
});
const _fdv = new THREE.Vector3();
function _stepField(rig, t) {
  const fd = rig.fd;
  for (const so of rig.sets) {
    const tips = so.curve ? [] : null;
    so.arrows.forEach((ar, i) => {
      const s = so.st.samples[i];
      let L = s.amp, sgn = 1;
      if (fd.animate) { const v = Math.sin((s.phase0 || 0) - (fd.omega || 0) * t / 1000); sgn = v >= 0 ? 1 : -1; L = Math.max(0.01, s.amp * Math.abs(v)); }
      ar.setDirection(_fdv.set(s.dir[0] * sgn, s.dir[1] * sgn, s.dir[2] * sgn).normalize());
      ar.setLength(L, L * 0.34, L * 0.22);
      if (tips) tips.push(new THREE.Vector3(s.pos[0] + s.dir[0] * sgn * L, s.pos[1] + s.dir[1] * sgn * L, s.pos[2] + s.dir[2] * sgn * L));
    });
    if (so.curve && tips) so.curve.geometry.setFromPoints(tips);
  }
}
stepFields = (t) => { for (const rig of fieldRigs) { if (rig.fd.animate || !rig._init) { _stepField(rig, t); rig._init = true; } } };`;
}

// In-page script: the PHYSICS channel — the live, interactive substrate of an actions-world
// (actions-world.plan.md). Unlike every other channel here (which REPLAY baked, deterministic
// motion), this RUNS the integrator in the browser: state accumulates, input can perturb it.
//
// Single source of truth: the integrator is the SAME code as the node module physics-sim.js,
// emitted via buildSim.toString() — there is no second, drifting browser copy. We step it on a
// FIXED dt (accumulator-clamped) off setAnimationLoop's time arg, so the sim rate is stable across
// frame-rate; the first frame seeds prevT (dt 0) so a frozen still / capture renders frame zero
// (the degradation contract: /svg + /scene + ?t → initial condition). Bodies render UNLIT
// (MeshBasicMaterial), matching the baked-light identity — physics moves the mesh, never relights it.
// Dynamic sphere bodies get their own mesh; static plane/aabb colliders are invisible (the scene's
// baked faces are the visual floor/walls). `window.__mojSim` is exposed for the actions channel
// (phase 4) and headless verification. Colours come from the raw manifest body (`color`).
export function physicsChannelScript(physics) {
  return `
const PHYSICS = ${safeJson(physics)};
const __SIM = (${buildSim.toString()})();
const __simState = __SIM.createState(PHYSICS);
const __FIXED_DT = 1 / 120;
const __DEFAULT_BODY_COLOR = 0xff7a59;
const __bodyMeshes = {};
const __bodyColor = {};   // id → manifest colour, so spawns/emitters can inherit a template colour
(PHYSICS.bodies || []).forEach((raw, i) => { const b = __simState.bodies[i]; if (b && raw && raw.color != null) __bodyColor[b.id] = raw.color; });
// Lazily build a mesh for any dynamic sphere that lacks one — covers the manifest bodies AND any
// body added at runtime by the spawn verb / emitters. A small dark "pole" marker rides the surface
// so SPIN is visible (a uniform unlit sphere looks identical from every angle while it rolls).
function __ensureMesh(b) {
  if (__bodyMeshes[b.id] || b.collider !== 'sphere') return;
  const col = __bodyColor[b.id] != null ? __bodyColor[b.id] : __DEFAULT_BODY_COLOR;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(col) }));
  const mark = new THREE.Mesh(new THREE.SphereGeometry(b.radius * 0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0x10141c }));
  mark.position.set(0, 0, b.radius);   // north-pole cap, in body-local space → rotates with the body
  mesh.add(mark);
  scene.add(mesh);
  __bodyMeshes[b.id] = mesh;
}
function __syncBodies() {
  for (const b of __simState.bodies) {
    __ensureMesh(b);
    const m = __bodyMeshes[b.id];
    if (!m) continue;
    m.position.set(b.position[0], b.position[1], b.position[2]);
    const q = b.orientation;
    if (q) m.quaternion.set(q[0], q[1], q[2], q[3]);   // rigid-body spin
  }
}
function __spawn(raw) {
  const b = __SIM.addBody(__simState, raw);
  if (raw && raw.color != null) __bodyColor[b.id] = raw.color;
  __ensureMesh(b); __syncBodies();
  return b;
}
// autonomous EMITTERS (a behaviour rule): each emits a body every 1/rate seconds, up to the cap, from
// its anchor with an initial velocity. Deterministic — a small index-based offset keeps emitted bodies from
// perfectly overlapping without any RNG (so a no-input playthrough stays reproducible).
const __emitters = (PHYSICS.emitters || []).filter((e) => e && e.template).map((e) => ({ spec: e, acc: 0, count: 0 }));
function __stepEmitters(dtSec) {
  for (const em of __emitters) {
    const rate = Number.isFinite(em.spec.rate) ? em.spec.rate : 1;
    const cap = Number.isFinite(em.spec.max) ? em.spec.max : 50;
    em.acc += dtSec;
    const period = 1 / Math.max(0.01, rate);
    while (em.acc >= period && em.count < cap) {
      em.acc -= period;
      const t = em.spec.template;
      const at = Array.isArray(em.spec.at) ? em.spec.at : (t.position || [0, 0, 5]);
      const off = (em.count % 5) * 0.15 - 0.3;   // deterministic spread
      __spawn({ ...t, id: (t.id || 'emit') + '-' + em.spec_i + '-' + em.count + '-' + Math.round(at[0] * 1000),
        position: [at[0] + off, at[1] + off, at[2]], velocity: em.spec.velocity || t.velocity });
      em.count++;
    }
  }
}
__emitters.forEach((em, i) => { em.spec_i = i; });
let __physPrevT = 0, __physAcc = 0;
stepPhysics = (t) => {
  if (!__physPrevT) { __physPrevT = t; __syncBodies(); return; }   // first frame → frame zero
  const frame = Math.min((t - __physPrevT) / 1000, 0.05); __physPrevT = t;
  __physAcc += frame;
  let guard = 0;
  while (__physAcc >= __FIXED_DT && guard++ < 8) { __SIM.step(__simState, __FIXED_DT); __physAcc -= __FIXED_DT; }
  __stepEmitters(frame);
  // grab-pin: while a body is grabbed (actions channel) the physics is overridden — it tracks the
  // cursor and holds zero velocity, so the sim doesn't fight the drag. Release restores dynamics.
  const g = window.__mojGrab;
  if (g && g.id && g.target) { const b = __simState.bodies.find((x) => x.id === g.id); if (b) { b.position = g.target.slice(); b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; } }
  __syncBodies();
};
// exposed for the actions channel + headless verification.
window.__mojSim = { sim: __SIM, state: __simState, meshes: __bodyMeshes, sync: __syncBodies, spawn: __spawn };`;
}

// In-page script: the ACTIONS channel — what makes an actions-world INTERACTIVE. Each action binds an
// input (`pointer` / `key`) to a verb on a physics body. Slice 1 verb is `impulse` (the kick.html
// primitive): a velocity kick whose magnitude is scaled by the body's inverse mass, so a heavy body
// barely moves and a light one shoots off — mass is first-class, as the brief asked.
//   { on:'pointer', target:'ball', do:'impulse', dir:'camera'|'up'|[x,y,z], gain:6 }
//   { on:'key', key:' ', target:'ball', do:'impulse', dir:'up', gain:8 }
// pointer with NO `target` kicks whatever body is under the cursor (raycast pick); with a `target` it
// kicks that named body on any click (button-feel). Default pointer `dir` is the camera ray (kick away
// from the eye). Requires the physics channel (uses window.__mojSim); gated on hasPhysics by the caller.
// NOTE (slice 1): fires on pointerdown, so a kick also nudges OrbitControls; click-vs-drag disambig is
// a follow-on. `window.__mojActions.fire(name)` is exposed for headless verification.
export function actionsChannelScript(actions) {
  return `
const ACTIONS = ${safeJson(actions)};
const __ray = new THREE.Raycaster();
function __bodyById(id) { return (window.__mojSim && window.__mojSim.state.bodies.find((b) => b.id === id)) || null; }
function __applyImpulse(body, dir, gain) {
  if (!body || body.invMass === 0) return false;
  const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const k = (gain != null ? gain : 5) * body.invMass;   // Δv = J·invMass → mass matters
  body.velocity[0] += dir[0] / L * k; body.velocity[1] += dir[1] / L * k; body.velocity[2] += dir[2] / L * k;
  body.resting = false;
  return true;
}
function __resolveDir(spec, ray) {
  if (Array.isArray(spec)) return spec;
  if (spec === 'up') return [0, 0, 1];
  if (spec === 'camera') { const v = new THREE.Vector3(); camera.getWorldDirection(v); return [v.x, v.y, v.z]; }
  return ray || [0, 0, 1];
}
function __pickBody(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  const nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
  __ray.setFromCamera({ x: nx, y: ny }, camera);
  const meshes = Object.values(window.__mojSim.meshes);
  const hit = __ray.intersectObjects(meshes, false)[0];
  let id = null;
  if (hit) for (const k in window.__mojSim.meshes) { if (window.__mojSim.meshes[k] === hit.object) { id = k; break; } }
  return { id, ray: [__ray.ray.direction.x, __ray.ray.direction.y, __ray.ray.direction.z] };
}
// Ray ∩ horizontal plane z=h → a world point under the cursor. Used by spawn (drop a body where
// you click) and grab (drag a body across a plane at its own height). Falls back to the camera
// target's height when the ray is parallel to the plane.
function __planeHit(ev, h) {
  const r = renderer.domElement.getBoundingClientRect();
  const nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
  __ray.setFromCamera({ x: nx, y: ny }, camera);
  const o = __ray.ray.origin, d = __ray.ray.direction;
  if (Math.abs(d.z) < 1e-6) return [o.x, o.y, h];
  const t = (h - o.z) / d.z;
  return [o.x + d.x * t, o.y + d.y * t, h];
}
function __runAction(act, ev) {
  if (!window.__mojSim) return;
  if (act.do === 'impulse') {
    if (act.on === 'pointer') {
      const pick = __pickBody(ev);
      const id = act.target || pick.id;
      if (id) __applyImpulse(__bodyById(id), __resolveDir(act.dir, pick.ray), act.gain);
    } else {
      __applyImpulse(__bodyById(act.target), __resolveDir(act.dir, null), act.gain);
    }
  } else if (act.do === 'spawn' && act.template) {
    const h = Number.isFinite(act.height) ? act.height : (act.template.position ? act.template.position[2] : 8);
    const at = act.on === 'pointer' && ev && ev.clientX != null ? __planeHit(ev, h) : (act.at || act.template.position || [0, 0, h]);
    window.__mojSim.spawn({ ...act.template, id: (act.template.id || 'spawn') + '-' + (window.__mojSpawnN = (window.__mojSpawnN || 0) + 1), position: at });
  }
}
// GRAB (pointer-only): pick a body on pointerdown, drag it across a horizontal plane at its grab
// height (pointermove), release with a throw velocity from the last cursor delta (pointerup). While
// grabbed, window.__mojGrab pins the body in the physics loop so the sim doesn't fight the drag.
function __wireGrab(act) {
  let grabH = 0, lastT = 0;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', (ev) => {
    if (!window.__mojSim) return;
    const pick = __pickBody(ev);
    const id = act.target || pick.id;
    const body = __bodyById(id);
    if (!body || body.invMass === 0) return;
    grabH = body.position[2];
    const p = __planeHit(ev, grabH);
    window.__mojGrab = { id, target: p, last: p, lastT: ev.timeStamp || 0 };
    lastT = ev.timeStamp || 0;
  });
  dom.addEventListener('pointermove', (ev) => {
    const g = window.__mojGrab;
    if (!g) return;
    g.last = g.target; g.target = __planeHit(ev, grabH);
    g.lastDt = Math.max(1e-3, ((ev.timeStamp || 0) - lastT) / 1000); lastT = ev.timeStamp || 0;
  });
  const release = () => {
    const g = window.__mojGrab;
    if (!g) return;
    const body = __bodyById(g.id);
    if (body && g.last) {
      const dt = g.lastDt || 1 / 60;
      body.velocity = [(g.target[0] - g.last[0]) / dt, (g.target[1] - g.last[1]) / dt, (g.target[2] - g.last[2]) / dt];
    }
    window.__mojGrab = null;
  };
  dom.addEventListener('pointerup', release);
  dom.addEventListener('pointercancel', release);
}
for (const act of ACTIONS) {
  if (act.do === 'grab') { __wireGrab(act); continue; }
  if (act.on === 'pointer') renderer.domElement.addEventListener('pointerdown', (ev) => __runAction(act, ev));
  else if (act.on === 'key') window.addEventListener('keydown', (ev) => { if (!act.key || ev.key === act.key) __runAction(act, ev); });
}
// exposed for headless verification: fire the Nth action (or the first matching the named target).
window.__mojActions = { list: ACTIONS, fire: (i) => __runAction(typeof i === 'number' ? ACTIONS[i] : ACTIONS.find((a) => a.target === i), {}) };`;
}

// In-page script: the CONTROLLABLE channel — the unified "control a thing in a world" primitive
// (controllable-world.plan.md). One model (entities = transform + rule + body; the camera is an
// entity), one input snapshot, one per-frame step — superseding the bespoke walk/over-shoulder/orbit
// controllers. The model is the SAME code as the node module controllable-world.js, emitted via
// buildControllable.toString() (single source of truth). When a camera entity is present it OWNS the
// camera (OrbitControls disabled), driven from the camera entity's transform each frame.
//
// Bodies (Phase 3): `mesh` (sphere/box, optional front marker so heading reads) and `none`. Input is
// mapped once here from keys/pointer to the normalized axes the pure rules consume. The `ground` hook
// raycasts the scene so `walk` entities follow terrain; `window.__mojCtrl` is exposed for headless
// verification (it can push input frames).
export function controllableChannelScript(entities, camera, figures) {
  return `
const __CW = (${buildControllable.toString()})();
const __world = __CW.createWorld({ entities: ${safeJson(entities)}, camera: ${safeJson(camera)} });
const __FIG = ${safeJson(figures || {})};   // name → packed baked figure frames (pos/col b64, origin, invScale, foot)
const __bodies = {};
// figure-frames body: re-expand baked frames (Uint16 corners + Uint8 colour) into raw Float32
// position arrays, feet planted at the body's local z=0 (FOOT subtracted) — packFigureFrames'
// compact encoding. The body owns ONE live BufferGeometry; each sync writes an INTERPOLATED pose
// into it (frame-pair lerp within a clip + crossfade between locomotion modes — renderer-ladder
// P2 rung 1, math from __CW.gaitFramePair/advanceGaitMix) instead of snapping whole geometries.
// Fixed topology across a figure's frames is the packing invariant that makes the lerp valid;
// a figure whose clips disagree on face count falls back to legacy frame-snapping.
const __FTRI = [0, 1, 2, 0, 2, 3];
function __figBytes(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function __decodeFigFrame(posB64, colB64, origin, inv, foot) {
  const q = new Uint16Array(__figBytes(posB64).buffer), col8 = __figBytes(colB64), nFace = col8.length / 3;
  const pos = new Float32Array(nFace * 6 * 3), col = new Float32Array(nFace * 6 * 3);
  let o = 0;
  for (let f = 0; f < nFace; f++) {
    const cb = f * 4 * 3, r = col8[f*3]/255, g = col8[f*3+1]/255, b = col8[f*3+2]/255;
    for (let t = 0; t < 6; t++) { const k = __FTRI[t] * 3;
      pos[o] = origin[0] + q[cb+k]*inv - foot[0]; pos[o+1] = origin[1] + q[cb+k+1]*inv - foot[1]; pos[o+2] = origin[2] + q[cb+k+2]*inv - foot[2];
      col[o] = r; col[o+1] = g; col[o+2] = b; o += 3; }
  }
  return { pos, col };
}
function __makeBody(e) {
  const b = e.body || {};
  // figure-rig body (renderer-ladder P2 rung 2): rigid PARTS bound once at rest + per-clip pose
  // CURVES ([qx,qy,qz,qw,hx,hy,hz] per bone per key). One THREE.Mesh per bone; each sync slerps
  // the bracketing keys and sets one matrix per bone — no vertex writes, no frame stacks.
  if ((b.type === 'figure-rig' || b.type === 'figure-frames') && __FIG[b.figure] && __FIG[b.figure].rig) {
    const fig = __FIG[b.figure];
    const group = new THREE.Group();
    const boneMeshes = fig.bones.map((bn, bi) => {
      const part = fig.parts[bi];
      if (!part) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(decodeF32(part.col), 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;   // matrices mutate per frame
      group.add(mesh);
      return mesh;
    });
    scene.add(group);
    group.userData.rigFig = { fig, boneMeshes, mix: {}, blendTime: b.blendTime, lookA: 0,
      yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2, headTrack: b.headTrack || null };
    return group;
  }
  if (b.type === 'figure-frames' && __FIG[b.figure]) {
    const fig = __FIG[b.figure];
    const clips = {};   // clip name → array of per-frame { pos, col } (one clip per locomotion mode)
    for (const cn in fig.clips) { const cd = fig.clips[cn]; clips[cn] = cd.pos.map((p, i) => __decodeFigFrame(p, cd.col[i], cd.origin, cd.invScale, cd.foot)); }
    const first = clips.forward || clips[Object.keys(clips)[0]];
    const len = first[0].pos.length;
    // lerp only when the pack said the clip's face ordering is frame-stable AND every frame
    // shares the live buffer's size; otherwise the sync falls back to frame snapping.
    // body.lerp:false forces the legacy flipbook path (authoring/debug A-B knob).
    let lerpable = b.lerp !== false;
    for (const cn in fig.clips) { if (fig.clips[cn].lerp === false) lerpable = false; }
    for (const cn in clips) for (const fr of clips[cn]) { if (fr.pos.length !== len) lerpable = false; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(first[0].pos.slice(), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(first[0].col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.frustumCulled = false;   // positions mutate per frame; skip stale-bound culling
    const group = new THREE.Group(); group.add(mesh); scene.add(group);
    group.userData.fig = { clips, mesh, lerpable, mix: {}, blendTime: b.blendTime, yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2 };   // figure faces +y → forward
    return group;
  }
  if (b.type !== 'mesh') return null;
  const geo = b.shape === 'box' ? new THREE.BoxGeometry((b.size||[1,1,1])[0], (b.size||[1,1,1])[1], (b.size||[1,1,1])[2]) : new THREE.SphereGeometry(b.radius || 0.5, 24, 16);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(b.color != null ? b.color : 0xff7a59) }));
  if (b.marker !== false) {   // a dark nub on local +X so heading/yaw is visible
    const s = (b.radius || ((b.size||[1])[0]) || 1) * 0.22;
    const nub = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), new THREE.MeshBasicMaterial({ color: 0x10141c }));
    nub.position.set((b.radius || ((b.size||[1,1])[0] / 2) || 0.6) * 1.05, 0, 0);
    mesh.add(nub);
  }
  scene.add(mesh);
  return mesh;
}
// resolve a locomotion MODE to (clip, phase): 'idle' holds the current clip's frame 0.
function __figClipOf(fig, e, mode) {
  const name = mode === 'idle' ? e.locomotion : mode;
  return (name && fig.clips[name]) || fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
}
// accumulate a clip pose (frame-pair lerp) into out with weight w.
function __figAccum(out, clip, phase, statik, w) {
  const pair = statik ? { i0: 0, i1: 0, t: 0 } : __CW.gaitFramePair(clip.length, phase);
  const a = clip[pair.i0].pos, b = clip[pair.i1].pos, t = pair.t;
  for (let i = 0; i < out.length; i++) out[i] += (a[i] + (b[i] - a[i]) * t) * w;
}
// one bone's [q, head] from a rig clip at a phase (frame-pair nlerp over the sparse keys);
// statik (idle) = the rest pose: identity rotation, rest head.
function __rigBone(fig, clipName, phase, statik, bi, outQ, outP) {
  const bone = fig.bones[bi];
  const clip = (clipName && fig.clips[clipName]) || fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
  if (statik || !clip) { outQ.set(0, 0, 0, 1); outP[0] = bone.head[0]; outP[1] = bone.head[1]; outP[2] = bone.head[2]; return; }
  const nb = fig.bones.length, K = clip.k, B = clip.b;
  const kf = (((phase % 1) + 1) % 1) * K;
  const i0 = Math.floor(kf) % K, i1 = (i0 + 1) % K, t = kf - Math.floor(kf);
  const o0 = (i0 * nb + bi) * 7, o1 = (i1 * nb + bi) * 7;
  const s = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (s * B[o1] - B[o0]) * t, B[o0 + 1] + (s * B[o1 + 1] - B[o0 + 1]) * t,
           B[o0 + 2] + (s * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (s * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP[0] = B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t;
  outP[1] = B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t;
  outP[2] = B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t;
}
const __rigQA = new THREE.Quaternion(), __rigQB = new THREE.Quaternion(), __rigQL = new THREE.Quaternion();
const __rigPA = [0, 0, 0], __rigPB = [0, 0, 0];
const __rigV = new THREE.Vector3(), __rigH = new THREE.Vector3(), __rigT = new THREE.Vector3();
const __RIG_Z = new THREE.Vector3(0, 0, 1), __RIG_ONE = new THREE.Vector3(1, 1, 1);
function __syncRigEntity(e, m, rig, dt) {
  m.rotation.set(0, 0, e.transform.heading + rig.yaw);
  const fig = rig.fig;
  const mode = e.moving ? e.locomotion : 'idle';
  const mix = __CW.advanceGaitMix(rig.mix, mode, e.gaitPhase, dt || 0, rig.blendTime);
  const w = mix.prevMode ? mix.w * mix.w * (3 - 2 * mix.w) : 1;
  // head-look-at overlay (renderer-convergence step 2, procedural rung): ease the head bone's
  // yaw toward a tracked entity, clamped to a natural range — a runtime joint override no
  // frame stack can express.
  let lookWant = 0;
  if (rig.headTrack) {
    const tgt = (__world.entities || []).find((x) => x.id === rig.headTrack);
    if (tgt) {
      m.updateMatrixWorld();
      __rigT.set(tgt.transform.pos[0], tgt.transform.pos[1], tgt.transform.pos[2]);
      m.worldToLocal(__rigT);                                   // figure-local: forward = +y
      const a = Math.atan2(-__rigT.x, __rigT.y);
      lookWant = Math.max(-1.0, Math.min(1.0, a));
    }
  }
  rig.lookA += (lookWant - rig.lookA) * Math.min(1, (dt || 0) * 6);
  for (let bi = 0; bi < fig.bones.length; bi++) {
    const mesh = rig.boneMeshes[bi];
    if (!mesh) continue;
    __rigBone(fig, mix.mode === 'idle' ? e.locomotion : mix.mode, mix.phase, mix.mode === 'idle', bi, __rigQA, __rigPA);
    if (mix.prevMode) {
      __rigBone(fig, mix.prevMode === 'idle' ? e.locomotion : mix.prevMode, mix.prevPhase, mix.prevMode === 'idle', bi, __rigQB, __rigPB);
      __rigQA.slerp(__rigQB, 1 - w);
      __rigPA[0] += (__rigPB[0] - __rigPA[0]) * (1 - w);
      __rigPA[1] += (__rigPB[1] - __rigPA[1]) * (1 - w);
      __rigPA[2] += (__rigPB[2] - __rigPA[2]) * (1 - w);
    }
    if (fig.bones[bi].id === 'head' && Math.abs(rig.lookA) > 1e-4) {
      __rigQL.setFromAxisAngle(__RIG_Z, rig.lookA);
      __rigQA.premultiply(__rigQL);
    }
    // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
    const rh = fig.bones[bi].head;
    __rigH.set(rh[0], rh[1], rh[2]).applyQuaternion(__rigQA);
    __rigV.set(__rigPA[0] - __rigH.x, __rigPA[1] - __rigH.y, __rigPA[2] - __rigH.z);
    mesh.matrix.compose(__rigV, __rigQA, __RIG_ONE);
  }
}
function __syncEntity(e, dt) {
  const m = __bodies[e.id]; if (!m) return;
  m.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]);
  const rigFig = m.userData && m.userData.rigFig;
  if (rigFig) { __syncRigEntity(e, m, rigFig, dt); return; }
  const fig = m.userData && m.userData.fig;
  if (fig) {
    m.rotation.set(0, 0, e.transform.heading + fig.yaw);
    if (!fig.lerpable) {   // mismatched clip topologies → legacy frame snapping
      const clip = __figClipOf(fig, e, e.moving ? e.locomotion : 'idle');
      const N = clip.length, ph = ((e.gaitPhase % 1) + 1) % 1;
      const frame = e.moving ? (Math.floor(ph * N) % N) : 0;
      const attr = fig.mesh.geometry.getAttribute('position');
      if (attr.array.length === clip[frame].pos.length) {
        attr.array.set(clip[frame].pos); attr.needsUpdate = true;
        const cattr = fig.mesh.geometry.getAttribute('color');
        cattr.array.set(clip[frame].col); cattr.needsUpdate = true;
      } else {   // face count differs from the live buffer → rebuild attributes for this frame
        fig.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(clip[frame].pos.slice(), 3));
        fig.mesh.geometry.setAttribute('color', new THREE.BufferAttribute(clip[frame].col, 3));
      }
      return;
    }
    const mode = e.moving ? e.locomotion : 'idle';
    const mix = __CW.advanceGaitMix(fig.mix, mode, e.gaitPhase, dt || 0, fig.blendTime);
    const attr = fig.mesh.geometry.getAttribute('position');
    const out = attr.array;
    out.fill(0);
    // smoothstep the crossfade so mode switches ease in/out instead of ramping linearly
    const w = mix.prevMode ? mix.w * mix.w * (3 - 2 * mix.w) : 1;
    __figAccum(out, __figClipOf(fig, e, mix.mode), mix.phase, mix.mode === 'idle', w);
    if (mix.prevMode) __figAccum(out, __figClipOf(fig, e, mix.prevMode), mix.prevPhase, mix.prevMode === 'idle', 1 - w);
    attr.needsUpdate = true;
  } else {
    m.rotation.set(0, 0, e.transform.heading);   // yaw about +Z (z-up)
  }
}
function __driveCamera() {
  const c = __world.camera; if (!c) return;
  const p = c.transform.pos;
  camera.position.set(p[0], p[1], p[2]);
  let look = c.lookAt;
  if (!look) { const h = c.transform.heading, pi = c.transform.pitch || 0; look = [p[0] + Math.cos(pi) * Math.cos(h), p[1] + Math.cos(pi) * Math.sin(h), p[2] + Math.sin(pi)]; }
  camera.lookAt(look[0], look[1], look[2]);
}
// ground hook: nearest scene surface straight below (excluding entity bodies), for walk entities.
const __groundRay = new THREE.Raycaster();
const __bodySet = () => Object.values(__bodies);
function __ground(pos) {
  // Probe straight down FROM the passed origin — the CALLER chooses the height. The walk rule passes
  // its eye position (finds the floor below it); the platform rule passes feet+step (so it lands on the
  // surface under the FEET and ignores platforms whose tops sit above them — you jump onto a ledge, you
  // do not warp up into it by walking into its base). (Was pos.z+20, which grabbed any overhead surface.)
  __groundRay.set(new THREE.Vector3(pos[0], pos[1], pos[2] + 0.05), new THREE.Vector3(0, 0, -1));
  const own = __bodySet();
  const hits = __groundRay.intersectObjects(scene.children, true);
  for (const hit of hits) { let o = hit.object; while (o) { if (own.includes(o)) break; o = o.parent; } if (!o) return hit.point.z; }
  return null;
}
// input: keys → normalized axes, mouse → look deltas (consumed each frame).
const __held = {};
window.addEventListener('keydown', (e) => { __held[e.code] = true; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', (e) => { __held[e.code] = false; });
let __lookDX = 0, __lookDY = 0, __drag = false;
const __canvas = renderer.domElement;
const __MOUSELOOK = ${!!(camera && (camera.turnMode === 'look' || camera.mouseLook))};   // FPS look camera?
if (__MOUSELOOK) {
  // pointer-lock FPS look: click once to capture the mouse, then RAW moves steer (no drag to hold).
  // both axes NEGATED so the view AGREES with the hand: swipe left looks left, push up looks up.
  __canvas.addEventListener('click', () => { if (document.pointerLockElement !== __canvas) __canvas.requestPointerLock(); });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === __canvas) { __lookDX -= e.movementX || 0; __lookDY -= e.movementY || 0; } });
} else {
  // default: hold-to-look drag (walk / glide / orbit worlds keep the cursor visible).
  __canvas.addEventListener('pointerdown', () => { __drag = true; });
  window.addEventListener('pointerup', () => { __drag = false; });
  __canvas.addEventListener('pointermove', (e) => { if (__drag) { __lookDX += e.movementX || 0; __lookDY += e.movementY || 0; } });
}
const __ax = (a, b) => (__held[a] ? 1 : 0) - (__held[b] ? 1 : 0);
let __prevJump = false;             // for the jump PRESS edge (platform rule) vs held (variable height)
function __readInput() {
  const sp = !!__held['Space'];
  const jump = sp && !__prevJump ? 1 : 0;   // rising edge: a discrete press, not a held axis
  __prevJump = sp;
  const inp = {
    forward: __ax('KeyW', 'KeyS') || __ax('ArrowUp', 'ArrowDown'),
    turn: __ax('KeyD', 'KeyA') || __ax('ArrowRight', 'ArrowLeft'),
    strafe: __ax('KeyE', 'KeyQ'),
    lift: __ax('Space', 'ShiftLeft') || __ax('Space', 'ShiftRight'),
    jump, jumpHeld: sp ? 1 : 0,
    lookDX: __lookDX, lookDY: __lookDY,
  };
  __lookDX = 0; __lookDY = 0;
  return inp;
}
// active whenever there are entities to step; the camera is OWNED only if a camera entity exists
// (otherwise OrbitControls keeps the view — e.g. a clock-driven figure turntable orbited by hand).
__ctrlActive = __world.entities.length > 0;
if (__world.camera) { controls.enabled = false; __ctrlOwnsCamera = true; }
for (const e of __world.entities) { const m = __makeBody(e); if (m) __bodies[e.id] = m; }
for (const e of __world.entities) __syncEntity(e);
if (__ctrlOwnsCamera) __driveCamera();
stepControllable = (dt, inputOverride) => {
  if (dt > 0) {
    __CW.stepWorld(__world, inputOverride || __readInput(), dt, { ground: __ground });
    for (const e of __world.entities) __syncEntity(e, dt);
  }
  if (__ctrlOwnsCamera) __driveCamera();
};
window.__mojCtrl = { world: __world, step: (dt, input) => stepControllable(dt, input) };`;
}

// In-page script: the SURFACE channel. The other channels move discrete things (sprites, bodies,
// arrows); a surface DEFORMS a continuous mesh over time — an animated ocean. It builds a grid
// BufferGeometry once, then every frame recomputes position + normal + colour from a Gerstner
// "waveform sequence" (a sum of moving wave trains): P.z = Σ A·sin θ, with the Gerstner horizontal
// pull P.xy += Σ Q·A·D·cos θ that sharpens crests, plus analytic normals so the surface is LIT.
// Unlike the basic-material world meshes, the ocean uses a MeshStandardMaterial + a sun light (added
// here), so existing scenes are unaffected (basic materials ignore the light). Buoys ride the surface
// (sampling the same displacement → the circular orbital water motion). Only emitted with `surfaces`.
export function surfaceChannelScript(surfaces) {
  return `
const SURFACES = ${safeJson(surfaces)};
function _gerstner(waves, x0, y0, t) {
  let px = x0, py = y0, pz = 0, nx = 0, ny = 0, nz = 1;
  for (let q = 0; q < waves.length; q++) {
    const w = waves[q], ph = w.k * (w.dx * x0 + w.dy * y0) - w.om * t + w.ph, c = Math.cos(ph), s = Math.sin(ph);
    px += w.Q * w.A * w.dx * c; py += w.Q * w.A * w.dy * c; pz += w.A * s;
    nx += -w.dx * w.k * w.A * c; ny += -w.dy * w.k * w.A * c; nz += -w.Q * w.k * w.A * s;
  }
  return [px, py, pz, nx, ny, nz];
}
// wavefield mode (double-slit ripple tank): an incoming plane wave for y < barrierY, then a SUM of
// circular waves from point sources (the slits) beyond it — vertical displacement (linear waves, no
// Gerstner pull) with analytic-gradient normals. Their overlap IS the interference pattern.
function _wavefield(sf, x0, y0, t) {
  const k = sf.k, om = sf.om, A = sf.A;
  let h = 0, gx = 0, gy = 0;
  if (y0 < (sf.barrierY || 0)) {
    const ph = k * y0 - om * t; h = A * Math.sin(ph); gy = A * k * Math.cos(ph);
  } else {
    for (let i = 0; i < sf.sources.length; i++) {
      const dx = x0 - sf.sources[i][0], dy = y0 - sf.sources[i][1], r = Math.hypot(dx, dy) || 1e-4;
      const env = 1 / Math.sqrt(Math.max(1, r * (sf.decay || 0.04))), ph = k * r - om * t, c = A * env * k * Math.cos(ph);
      h += A * env * Math.sin(ph); gx += c * dx / r; gy += c * dy / r;
    }
  }
  return [x0, y0, h, -gx, -gy, 1];
}
// gravity-wave mode (gravity-wave-view): a spacetime MEMBRANE under a compact-binary inspiral. The
// height is the quadrupole GW STRAIN — a static central well (curvature) plus a rotating two-armed
// (cos 2ψ) ripple radiated outward at the wave speed (retarded time t − r/v). The chirp (frequency
// rising to merger, then ringdown) lives in _gwphase — the exact twin of gwState() in gravity-wave-view.js.
function _gwphase(g, t) {
  let tau = (t % g.tLoop) / g.tLoop; if (tau < 0) tau += 1;
  const tm = g.tauMerge, a = g.aChirp;
  if (tau < tm) {
    const u = Math.max(1e-4, 1 - a * tau), fr = Math.pow(u, -0.375);
    return { tau: tau, fr: fr, phi: g.phiCoef * (1 - Math.pow(u, 0.625)), sep: g.sep0 * Math.pow(u, 0.25), amp: g.amp0 * Math.pow(fr, 0.66667) * Math.min(1, tau / 0.06), merged: false };
  }
  const um = Math.max(1e-4, 1 - a * tm), frm = Math.pow(um, -0.375), k = (tau - tm) / (1 - tm);
  return { tau: tau, fr: frm, phi: g.phiCoef * (1 - Math.pow(um, 0.625)) + g.ringRate * frm * (tau - tm), sep: g.sep0 * Math.pow(um, 0.25) * Math.max(0, 1 - k), amp: g.amp0 * Math.pow(frm, 0.66667) * Math.exp(-(tau - tm) / g.tauRing), merged: true };
}
function _gwstrain(g, x0, y0, t) {
  const r = Math.hypot(x0, y0), st = _gwphase(g, t - r / g.vWave), fall = g.r0 / (g.r0 + r);
  return -g.well * fall + st.amp * fall * Math.cos(2 * Math.atan2(y0, x0) - 2 * st.phi);
}
const _l3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const _surfRigs = SURFACES.map((sf) => {
  const nx = sf.grid.nx, ny = sf.grid.ny, w = sf.grid.w, d = sf.grid.d, N = nx * ny;
  const base = new Float32Array(N * 2); { let b = 0; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { base[b++] = (i / (nx - 1) - 0.5) * w; base[b++] = (j / (ny - 1) - 0.5) * d; } }
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const index = []; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1; index.push(a, c, b, b, c, e); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide }));
  scene.add(mesh);
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.2); sun.position.set(sf.sun[0], sf.sun[1], sf.sun[2]); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x3a5a7a, 0.7));
  const floats = (sf.floaters || []).map((fl) => { const m = new THREE.Mesh(new THREE.SphereGeometry(fl.r || 1.2, 18, 12), new THREE.MeshStandardMaterial({ color: fl.color || 0xff5a4a, roughness: 0.5 })); scene.add(m); return { fl, m }; });
  // gravity-wave mode: the inspiralling binary (two bodies) + the merged remnant, carried in-script so
  // they stay locked to the strain phase; a small HUD shows the chirping GW frequency + state.
  let gwr = null;
  if (sf.gw) {
    const g = sf.gw;
    const mkBody = (rad, color) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 22, 16), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5, roughness: 0.3, transparent: true, opacity: 1 })); scene.add(m); return m; };
    const rem = mkBody(Math.cbrt(g.r1 * g.r1 * g.r1 + g.r2 * g.r2 * g.r2), g.cRemnant); rem.material.opacity = 0;
    const hud = document.createElement('div'); hud.className = 'moj-readout'; wrap.appendChild(hud);
    gwr = { g: g, m1: mkBody(g.r1, g.c1), m2: mkBody(g.r2, g.c2), rem: rem, hud: hud };
  }
  return { sf, nx, ny, N, base, pos, nor, col, geo, floats, gwr };
});
stepSurfaces = (ms) => {
  const t = ms / 1000;
  for (const r of _surfRigs) {
    const sf = r.sf, amax = sf.amax || 1, deep = sf.deep, surf = sf.surf, crest = sf.crest;
    if (sf.gw) {
      const g = sf.gw, nxx = r.nx, nyy = r.ny;
      // pass 1: strain heights.
      for (let v = 0; v < r.N; v++) { const x0 = r.base[2 * v], y0 = r.base[2 * v + 1], o = 3 * v; r.pos[o] = x0; r.pos[o + 1] = y0; r.pos[o + 2] = _gwstrain(g, x0, y0, t); }
      // pass 2: normals (central differences on the height grid) + height colour.
      const dx = sf.grid.w / (nxx - 1), dy = sf.grid.d / (nyy - 1);
      for (let j = 0; j < nyy; j++) for (let i = 0; i < nxx; i++) {
        const v = j * nxx + i, o = 3 * v;
        const zl = r.pos[3 * (j * nxx + (i > 0 ? i - 1 : i)) + 2], zr = r.pos[3 * (j * nxx + (i < nxx - 1 ? i + 1 : i)) + 2];
        const zd = r.pos[3 * ((j > 0 ? j - 1 : j) * nxx + i) + 2], zu = r.pos[3 * ((j < nyy - 1 ? j + 1 : j) * nxx + i) + 2];
        const gx = (zr - zl) / (2 * dx), gy = (zu - zd) / (2 * dy), inv = 1 / (Math.hypot(gx, gy, 1) || 1);
        r.nor[o] = -gx * inv; r.nor[o + 1] = -gy * inv; r.nor[o + 2] = inv;
        // diverging strain colour: peel the static well off (ripple = z + well·fall), normalise by the
        // LOCAL falloff envelope so the arms stay vivid edge-to-edge (not drowned by 1/r), a contrast
        // curve, then cool-trough ↔ navy-rest ↔ bright-crest; the central well stays a touch dimmer.
        const x0 = r.base[2 * v], y0 = r.base[2 * v + 1], rr = Math.hypot(x0, y0), fall = g.r0 / (g.r0 + rr);
        let s = (r.pos[o + 2] + g.well * fall) / (amax * Math.max(0.18, fall));
        s = s < -1 ? -1 : s > 1 ? 1 : s;
        const sc = (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.7), cc = sc >= 0 ? _l3(surf, crest, sc) : _l3(surf, deep, -sc), dim = 1 - 0.4 * fall;
        r.col[o] = cc[0] * dim; r.col[o + 1] = cc[1] * dim; r.col[o + 2] = cc[2] * dim;
      }
      r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
      if (r.gwr) {
        const st = _gwphase(g, t), hx = Math.cos(st.phi), hy = Math.sin(st.phi);
        const p1x = hx * st.sep * g.frac1, p1y = hy * st.sep * g.frac1, p2x = -hx * st.sep * g.frac2, p2y = -hy * st.sep * g.frac2;
        const fIn = Math.min(1, st.tau / 0.06);
        r.gwr.m1.position.set(p1x, p1y, _gwstrain(g, p1x, p1y, t) + g.r1 * 0.6); r.gwr.m1.material.opacity = st.merged ? 0 : fIn;
        r.gwr.m2.position.set(p2x, p2y, _gwstrain(g, p2x, p2y, t) + g.r2 * 0.6); r.gwr.m2.material.opacity = st.merged ? 0 : fIn;
        const remOp = st.merged ? Math.exp(-(st.tau - g.tauMerge) / g.tauRing) : 0;
        r.gwr.rem.position.set(0, 0, _gwstrain(g, 0, 0, t) + g.r1 * 0.6); r.gwr.rem.material.opacity = Math.max(0, Math.min(1, remOp));
        const state = !st.merged ? 'inspiral' : (remOp > 0.15 ? 'ringdown' : 'merger');
        r.gwr.hud.innerHTML = '<b>gravitational waves</b><span>f<sub>GW</sub> ' + (g.fGwHz * st.fr).toFixed(g.fGwHz < 5 ? 2 : 0) + ' Hz</span><span>M<sub>chirp</sub> ' + g.chirpMassMsun + ' M☉</span><span class="v">' + state + '</span>';
      }
      continue;
    }
    for (let v = 0; v < r.N; v++) {
      const x0 = r.base[2 * v], y0 = r.base[2 * v + 1];
      const g = sf.sources ? _wavefield(sf, x0, y0, t) : _gerstner(sf.waves, x0, y0, t), inv = 1 / (Math.hypot(g[3], g[4], g[5]) || 1), o = 3 * v;
      r.pos[o] = g[0]; r.pos[o + 1] = g[1]; r.pos[o + 2] = g[2];
      r.nor[o] = g[3] * inv; r.nor[o + 1] = g[4] * inv; r.nor[o + 2] = g[5] * inv;
      const hf = Math.max(0, Math.min(1, 0.5 + g[2] / (2 * amax)));
      let cc = _l3(deep, surf, hf);
      const foam = Math.max(0, Math.min(1, (g[2] / amax - 0.5) / 0.5));
      cc = _l3(cc, crest, foam * 0.85);
      r.col[o] = cc[0]; r.col[o + 1] = cc[1]; r.col[o + 2] = cc[2];
    }
    r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true; r.geo.attributes.color.needsUpdate = true;
    for (const fo of r.floats) { const g = _gerstner(sf.waves, fo.fl.x, fo.fl.y, t); fo.m.position.set(g[0], g[1], g[2] + (fo.fl.r || 1.2) * 0.55); }
  }
};`;
}

// In-page script: the HEAT-SPHERE channel (heat-sphere-view). A UV-sphere mesh built ONCE, whose
// per-vertex COLOUR is recomputed every frame from an exact solution of the heat equation on the
// sphere: T(θ,t) = Σₗ aₗ·Pₗ(cosθ)·e^(−l(l+1)κt). The Legendre coefficients aₗ are baked (a projection
// of the scenario's initial temperature profile); the mode DECAYS e^(−l(l+1)κt) are recomputed once
// per frame (they depend only on t, not on the vertex), so each vertex only runs the cheap Legendre
// recurrence × coeff × decay. Time sweeps 0→tSpan (a sharp pole-to-pole split diffusing to uniform),
// holds, then resets. Colour is a diverging cold→neutral→hot map, so hue IS temperature. Uses a
// MeshStandardMaterial + a soft sun so the ball reads as a 3-D solid; existing basic-material world
// meshes ignore the added light. Only emitted with `heatSpheres`.

// Shared UV-sphere rig for the scalar-field sphere channels (heat-sphere + star-surface). Builds the
// indexed BufferGeometry ONCE — position + normal + colour attributes — and hands back the typed arrays
// so each channel writes per-vertex colour every frame. This is the ONLY thing the two channels share:
// their field maths, materials and lighting stay their own (Stage 6 of star-surface-view.plan.md — the
// merged-channel guess was wrong; the genuine duplicate was just this geometry build). Emitted once when
// either channel is present. `normal.z` doubles as cos θ, so the heat channel needs no separate array.
export function sphereRigPreamble() {
  return `
function __uvSphereRig(radius, nlat, nlon) {
  const rows = nlat + 1, cols = nlon + 1, N = rows * cols;
  const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3);
  let v = 0;
  for (let i = 0; i < rows; i++) {
    const th = Math.PI * (i / nlat), ct = Math.cos(th), sth = Math.sin(th);
    for (let j = 0; j < cols; j++) {
      const ph = 2 * Math.PI * (j / nlon), o = 3 * v, x = sth * Math.cos(ph), y = sth * Math.sin(ph), z = ct;
      pos[o] = radius * x; pos[o + 1] = radius * y; pos[o + 2] = radius * z;   // z-up: poles on the z axis
      nor[o] = x; nor[o + 1] = y; nor[o + 2] = z; v++;
    }
  }
  const index = [];
  for (let i = 0; i < nlat; i++) for (let j = 0; j < nlon; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; index.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  return { N, pos, nor, col, geo };
}`;
}

export function heatSphereChannelScript(heatSpheres) {
  return `
const HEATSPHERES = ${safeJson(heatSpheres)};
const _hsL3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const _hsRigs = HEATSPHERES.map((hs) => {
  const rig = __uvSphereRig(hs.radius, hs.nlat, hs.nlon);   // shared UV-sphere; normal.z IS cos θ
  const mesh = new THREE.Mesh(rig.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.02 }));
  scene.add(mesh);
  const sun = new THREE.DirectionalLight(0xffffff, 1.05); sun.position.set(hs.sun[0], hs.sun[1], hs.sun[2]); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8894a8, 0.85));
  return { hs, N: rig.N, nor: rig.nor, col: rig.col, geo: rig.geo, decay: new Float64Array(hs.coeffs.length) };
});
stepHeatSpheres = (ms) => {
  for (const r of _hsRigs) {
    const hs = r.hs, coeffs = hs.coeffs, L = coeffs.length - 1;
    // loop time → diffusion time. Sweep 0→tSpan over (1−holdFrac) of the loop, then HOLD near-uniform.
    let p = (ms % hs.loopMs) / hs.loopMs; if (p < 0) p += 1;
    const active = Math.min(1, p / (1 - hs.holdFrac));
    const tDiff = hs.tSpan * Math.pow(active, 1.35);   // linger a touch on the crisp initial split
    // per-frame mode decays e^(−l(l+1)κ t) — computed once, shared by every vertex.
    for (let l = 0; l <= L; l++) r.decay[l] = coeffs[l] * Math.exp(-l * (l + 1) * hs.kappa * tDiff);
    const cold = hs.cold, mid = hs.mid, hot = hs.hot;
    for (let vi = 0; vi < r.N; vi++) {
      const o = 3 * vi, x = r.nor[o + 2];   // cos θ = the vertex normal's z-component
      // T = Σ decay[l]·Pₗ(x), Legendre recurrence l·Pₗ = (2l−1)x·Pₗ₋₁ − (l−1)·Pₗ₋₂.
      let pm2 = 1, pm1 = x, T = r.decay[0] * pm2 + (L >= 1 ? r.decay[1] * pm1 : 0);
      for (let l = 2; l <= L; l++) {
        const pl = ((2 * l - 1) * x * pm1 - (l - 1) * pm2) / l;
        T += r.decay[l] * pl; pm2 = pm1; pm1 = pl;
      }
      T = T < -1 ? -1 : T > 1 ? 1 : T;
      const s = (T + 1) / 2, cc = s < 0.5 ? _hsL3(cold, mid, s * 2) : _hsL3(mid, hot, (s - 0.5) * 2);
      r.col[o] = cc[0] / 255; r.col[o + 1] = cc[1] / 255; r.col[o + 2] = cc[2] / 255;
    }
    r.geo.attributes.color.needsUpdate = true;
  }
};`;
}

// In-page script: the STAR-SURFACE channel (star-surface-view). A self-luminous UV-sphere whose
// per-vertex colour is a BLACKBODY map (Planck locus, Kelvin → RGB) of a live TEMPERATURE field:
//   T(vertex, t) = Tbase + granulation(Worley cells, boiling) + spots(cool patches in active bands)
// then dimmed by LIMB DARKENING — a view-dependent term (needs the camera direction, unlike every
// other mesh channel). Material is MeshBasicMaterial (unlit): a star emits its own light, so there is
// no shaded terminator; the sphere reads as 3-D purely from limb darkening, which is physically why a
// real disc looks solid. Differential rotation shears the field (equator faster than poles). The
// colour physics is honest (temperature → true hue); the granulation is a phenomenological cell model,
// not magnetoconvection. Only emitted with `starSurfaces`.
export function starSurfaceChannelScript(starSurfaces) {
  return `
const STARSURFACES = ${safeJson(starSurfaces)};
// Planck blackbody locus (Tanner-Helland approximation), Kelvin → linear-ish sRGB in [0,1].
function _bbColor(T) {
  const t = Math.max(1000, Math.min(40000, T)) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [Math.max(0, Math.min(255, r)) / 255, Math.max(0, Math.min(255, g)) / 255, Math.max(0, Math.min(255, b)) / 255];
}
const _hash3 = (i, j, k) => { let n = (i * 374761393 + j * 668265263 + k * 1274126177) | 0; n = (n ^ (n >> 13)) * 1274126177 | 0; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
const _sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };
const _starRigs = STARSURFACES.map((st) => {
  const rig = __uvSphereRig(st.radius, st.nlat, st.nlon);   // shared UV-sphere (self-luminous material)
  const mesh = new THREE.Mesh(rig.geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(mesh);
  const limbNorm = st.limb[0] + st.limb[1] + st.limb[2];   // I(μ=1) — normalise disc centre to ~1
  return { st, N: rig.N, pos: rig.pos, nrm: rig.nor, col: rig.col, geo: rig.geo, limbNorm };
});
stepStarSurfaces = (ms) => {
  const t = ms / 1000;
  const cpx = camera.position.x, cpy = camera.position.y, cpz = camera.position.z;
  for (const r of _starRigs) {
    const st = r.st, spots = st.spots || [], boil = st.granBoil, freq = st.granFreq;
    // artistic tint (declared): a final presentational multiply. Physical photospheres are near-white,
    // but people picture the Sun yellow, so the sun scenario carries a warm-gold tint; the other stars
    // keep it neutral and stay true to Planck. Chromaticity honest, this one grade owned up to.
    const tint = st.tint || [1, 1, 1];
    // pre-rotate each spot's centre by its own latitude-dependent differential-rotation angle.
    const scen = spots.map((sp) => {
      const ang = st.omegaEq * (1 - st.diffRot * sp.c[2] * sp.c[2]) * t, ca = Math.cos(ang), sa = Math.sin(ang);
      return { x: sp.c[0] * ca - sp.c[1] * sa, y: sp.c[0] * sa + sp.c[1] * ca, z: sp.c[2], cosUmbra: sp.cosUmbra, cosPenu: sp.cosPenu, dTumbra: sp.dTumbra, dTpenu: sp.dTpenu };
    });
    for (let vi = 0; vi < r.N; vi++) {
      const o = 3 * vi, nx = r.nrm[o], ny = r.nrm[o + 1], nz = r.nrm[o + 2];
      // differential rotation: sample the granulation field in a frame spun by φ(lat) (equator faster).
      const phi = st.omegaEq * (1 - st.diffRot * nz * nz) * t, cp = Math.cos(-phi), sp = Math.sin(-phi);
      const sx = (nx * cp - ny * sp) * freq, sy = (nx * sp + ny * cp) * freq, sz = nz * freq;
      // Worley F1/F2 over the 27 neighbouring lattice cells — animated feature points ⇒ boiling cells.
      const xi = Math.floor(sx), yi = Math.floor(sy), zi = Math.floor(sz);
      let f1 = 9, f2 = 9;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
        const cx = xi + di, cy = yi + dj, cz = zi + dk;
        const fx = cx + 0.5 + 0.42 * Math.sin(6.2831853 * (_hash3(cx, cy, cz) + boil * t));
        const fy = cy + 0.5 + 0.42 * Math.sin(6.2831853 * (_hash3(cx + 11, cy, cz) + boil * t));
        const fz = cz + 0.5 + 0.42 * Math.sin(6.2831853 * (_hash3(cx, cy + 17, cz) + boil * t));
        const dx = fx - sx, dy = fy - sy, dz = fz - sz, dd = dx * dx + dy * dy + dz * dz;
        if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
      }
      const edge = Math.sqrt(f2) - Math.sqrt(f1);            // small at cell boundaries (the dark lanes)
      const gran = st.granAmp * (_sstep(0, st.laneW, edge) - st.granBias);
      // spots: cool patches (umbra core + penumbra ring) wherever the vertex falls inside one.
      let spotDT = 0;
      for (let s = 0; s < scen.length; s++) {
        const sc = scen[s], d = nx * sc.x + ny * sc.y + nz * sc.z;
        if (d > sc.cosUmbra) spotDT += sc.dTumbra;
        else if (d > sc.cosPenu) spotDT += sc.dTpenu * _sstep(sc.cosPenu, sc.cosUmbra, d);
      }
      const T = st.Tbase + gran + spotDT;
      const rgb = _bbColor(T);
      // Stefan–Boltzmann luminance: a patch emits ∝ T⁴, normalised to the star's own base temperature —
      // THIS is why a cooler sunspot looks dark, not just oranger (colour alone misses it). Capped so a
      // hot granule doesn't blow out. Chromaticity from Planck, brightness from T⁴ — both honest.
      const lum = Math.min(1.7, Math.pow(T / st.Tbase, 4));
      // limb darkening: dim toward the disc edge by I(μ)/I(1), μ = cos(normal, view).
      const vx = cpx - r.pos[o], vy = cpy - r.pos[o + 1], vz = cpz - r.pos[o + 2], vl = Math.hypot(vx, vy, vz) || 1;
      let mu = (nx * vx + ny * vy + nz * vz) / vl; if (mu < 0) mu = 0;
      const L = Math.max(0, (st.limb[0] + st.limb[1] * mu + st.limb[2] * mu * mu) / r.limbNorm) * st.brightness * lum;
      r.col[o] = rgb[0] * L * tint[0]; r.col[o + 1] = rgb[1] * L * tint[1]; r.col[o + 2] = rgb[2] * L * tint[2];
    }
    r.geo.attributes.color.needsUpdate = true;
  }
};`;
}

// In-page script: the BUILDUP channel. A point cloud revealed PROGRESSIVELY over time — single
// particles accumulating into the double-slit interference pattern. The positions are pre-sorted into
// (pseudo-random) arrival order in the builder, so a growing draw-range reveals scattered dots that
// slowly resolve into fringes; a small counter shows the running hit total. Loops. Only with `buildups`.
export function buildupChannelScript(buildups) {
  return `
const BUILDUPS = ${safeJson(buildups)};
const _buRigs = BUILDUPS.map((bu) => {
  const N = (bu.positions.length / 3) | 0;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bu.positions), 3));
  geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: bu.color || 0xbfe6ff, size: bu.size || 0.8, sizeAttenuation: true, transparent: true, opacity: 0.96, depthWrite: false }));
  pts.renderOrder = 4; scene.add(pts);
  return { bu, geo, N };
});
let _buHud = null;
if (_buRigs.length) { _buHud = document.createElement('div'); _buHud.className = 'moj-readout'; _buHud.style.left = 'auto'; _buHud.style.right = '8px'; wrap.appendChild(_buHud); }
stepBuildups = (ms) => {
  const sec = ms / 1000;
  for (const r of _buRigs) {
    const period = r.bu.period || 14, k = Math.min(r.N, Math.floor(((sec % period) / period) * r.N));
    r.geo.setDrawRange(0, k);
    if (_buHud && r === _buRigs[0]) _buHud.innerHTML = '<b>' + k + ' / ' + r.N + ' particles</b>';
  }
};`;
}

// In-page script: the TRANSPORT channel (parallel-transport-view). HOLONOMY made visible — an arrow
// carried around a closed loop on a surface. Static (great in a frozen still): the loop line, a FAN of
// faded breadcrumb arrows (the carried vector sampled around the trip, green→red), and the bright green
// START vs red RETURNED arrow at the start point whose angular gap IS the holonomy. Animated: a
// traveller dot + a bright accent arrow sweeping the loop. A HUD shows the holonomy, the enclosed solid
// angle, and the Gauss–Bonnet check. The transport physics is precomputed in the builder; this just plays
// the arrays. Only emitted with `transports`.
export function transportChannelScript(transports) {
  return `
const TRANSPORTS = ${safeJson(transports)};
function _arrow(dir, at, len, color) { const a = new THREE.ArrowHelper(new THREE.Vector3(dir[0], dir[1], dir[2]), new THREE.Vector3(at[0], at[1], at[2]), len, color, len * 0.30, len * 0.18); a.renderOrder = 3; scene.add(a); return a; }
const _trRigs = TRANSPORTS.map((tr) => {
  const lg = new THREE.BufferGeometry().setFromPoints(tr.loop.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  scene.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: tr.loopColor || 0x7fd0ff })));
  // faded breadcrumb fan — the carried vector left at stations around the loop (the rotation reads as a fan).
  for (const b of tr.breadcrumbs) { const a = _arrow(b.dir, b.at, tr.arrowLen * 0.82, b.color); a.line.material.transparent = a.cone.material.transparent = true; a.line.material.opacity = a.cone.material.opacity = 0.4; }
  // the green START arrow and the red RETURNED arrow, both at the start point: their gap is the holonomy.
  _arrow(tr.startDir, tr.startAt, tr.arrowLen, tr.startColor || 0x66e0a0);
  _arrow(tr.endDir, tr.startAt, tr.arrowLen, tr.endColor || 0xff5a5a);
  // the animated traveller + the bright carried arrow.
  const dot = new THREE.Mesh(new THREE.SphereGeometry(tr.dotR || 0.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(dot);
  const arrow = _arrow(tr.startDir, tr.startAt, tr.arrowLen, tr.accent || 0xffd24a);
  const hud = document.createElement('div'); hud.className = 'moj-readout'; wrap.appendChild(hud);
  const gb = Math.abs(Math.abs(tr.holonomyDeg) - Math.abs(tr.predictedDeg)) < 1.0;
  hud.innerHTML = '<b>' + tr.title + '</b>'
    + '<span class="v">holonomy: ' + tr.holonomyDeg.toFixed(1) + '°</span>'
    + '<span>enclosed: ' + tr.solidAngleSr.toFixed(2) + ' sr  (' + tr.predictedDeg.toFixed(1) + '°)</span>'
    + '<span>Gauss–Bonnet: holonomy = ∫∫K dA ' + (gb ? '✓' : '≈') + '</span>'
    + tr.lines.map((l) => '<span style="opacity:.8">' + l + '</span>').join('');
  return { tr, dot, arrow };
});
stepTransports = (ms) => {
  for (const r of _trRigs) {
    const tr = r.tr, N = tr.loop.length, u = ((ms / 1000) / tr.period % 1 + 1) % 1;
    const f = u * (N - 1), i = Math.floor(f), a = f - i, j = Math.min(N - 1, i + 1);
    const p0 = tr.loop[i], p1 = tr.loop[j], d0 = tr.vectors[i], d1 = tr.vectors[j];
    const px = p0[0] + (p1[0] - p0[0]) * a, py = p0[1] + (p1[1] - p0[1]) * a, pz = p0[2] + (p1[2] - p0[2]) * a;
    let dx = d0[0] + (d1[0] - d0[0]) * a, dy = d0[1] + (d1[1] - d0[1]) * a, dz = d0[2] + (d1[2] - d0[2]) * a;
    const dm = Math.hypot(dx, dy, dz) || 1; dx /= dm; dy /= dm; dz /= dm;
    r.dot.position.set(px, py, pz);
    r.arrow.position.set(px, py, pz); r.arrow.setDirection(new THREE.Vector3(dx, dy, dz));
  }
};`;
}

// In-page script: lay each shadow decal as a flat dark radial quad just above the floor.
// depthWrite:false + a small z-lift avoid z-fighting the floor; normal-blended dark colour
// with a radial alpha texture darkens the ground (the World twin of the CSS dark `bg` pool).
export function shadowDecalScript(decals) {
  return `
// --- shadow decals (cast / contact) ---
const SHADOWS = ${safeJson(decals)};
const shadowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill();
  return new THREE.CanvasTexture(cv);
})();
for (const d of SHADOWS) {
  const q = d.quad, Z = 0.03;
  const pos = new Float32Array([
    q[0][0], q[0][1], q[0][2] + Z, q[1][0], q[1][1], q[1][2] + Z, q[2][0], q[2][1], q[2][2] + Z,
    q[0][0], q[0][1], q[0][2] + Z, q[2][0], q[2][1], q[2][2] + Z, q[3][0], q[3][1], q[3][2] + Z]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = new THREE.MeshBasicMaterial({ map: shadowTex, color: new THREE.Color(d.color[0] / 255, d.color[1] / 255, d.color[2] / 255),
    transparent: true, opacity: d.alpha, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 0.5; // over the floor, under additive glow
  scene.add(m);
}`;
}

// In-page script: crease "ink" decals — the soft contact-shadow feather, the WebGL twin of the
// CSS-3D gradient band. Unlike the radial shadow blob this is a DIRECTIONAL linear gradient
// (opaque at the crease edge → transparent across the band), so a wall/ground valley reads as a
// soft feather hugging the edge. Quad corner order is [crease0, crease1, outer1, outer0]; the UV
// puts texture-v=0 (opaque) on the crease pair. polygonOffset + depthWrite:false keep the near-
// coplanar band off the surface it sits on (the z-fight fix, for this pass).
export function inkDecalScript(inks) {
  return `
// --- ink (crease feather) decals ---
const INKS = ${safeJson(inks)};
const inkTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.38, 'rgba(255,255,255,0.38)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(cv); t.flipY = false; return t;
})();
for (const d of INKS) {
  const q = d.quad;
  const pos = new Float32Array([
    q[0][0], q[0][1], q[0][2], q[1][0], q[1][1], q[1][2], q[2][0], q[2][1], q[2][2],
    q[0][0], q[0][1], q[0][2], q[2][0], q[2][1], q[2][2], q[3][0], q[3][1], q[3][2]]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = new THREE.MeshBasicMaterial({ map: inkTex, color: new THREE.Color(d.color[0] / 255, d.color[1] / 255, d.color[2] / 255),
    transparent: true, opacity: d.alpha, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 0.55;
  scene.add(m);
}`;
}

// In-page script: a world-fixed sky, in two shapes. ATMOSPHERE (default): a huge inverted
// sphere (BackSide) centred on the scene carries a z-up zenith→horizon gradient in its vertex
// colours (linearised to match the baked faces); at night (day < 0.5) a seeded THREE.Points
// field is scattered on the UPPER dome — additive, depth-tested so terrain occludes stars near
// the horizon. SPACE (`space:true`): no gradient dome (the void is the scene bg), and the
// starfield wraps the FULL sphere, always on (the planetary body in a celestial sphere).
// Either way the dome + stars live in WORLD space (not parented to the camera), so orbiting
// pans across them. The luminaries ride the dome too: a phase-carved moon at night and a warm
// sun by day, each world-positioned from its sky-still { u, h } so it stays put as the camera orbits.
export function skyDomeScript(d) {
  return `
// --- world-fixed sky dome + night stars (emitThreeWorld sky option) ---
const SKY = ${safeJson(d)};
{
  const srgbLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = Math.min(SKY.radius * 12, 3500);
  // ATMOSPHERE sky only: a gradient dome from horizon→zenith. SPACE sky skips it — the void is
  // the scene bg and stars wrap the full sphere, so there is no dome seam to orbit past.
  if (!SKY.space) {
    const geo = new THREE.SphereGeometry(R, 48, 24);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    const zen = SKY.zenith.map(srgbLin), hor = SKY.horizon.map(srgbLin);
    for (let i = 0; i < p.count; i++) {
      const t = Math.pow(Math.max(0, Math.min(1, (p.getZ(i) / R) * 1.05 + 0.06)), 0.7); // z-up: top→zenith
      col[i*3] = hor[0] + (zen[0]-hor[0])*t; col[i*3+1] = hor[1] + (zen[1]-hor[1])*t; col[i*3+2] = hor[2] + (zen[2]-hor[2])*t;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
    dome.position.set(SKY.center[0], SKY.center[1], SKY.center[2]);
    dome.renderOrder = -2;
    scene.add(dome);
  }
  if (SKY.stars > 0 && (SKY.space || SKY.day < 0.5)) {
    const nightF = SKY.space ? 1 : Math.min(1, (0.5 - SKY.day) / 0.5);  // space stars are always on
    const N = Math.round((SKY.space ? 2000 : 900) * SKY.stars * nightF);
    let s = SKY.seed >>> 0 || 1; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    const sp = new Float32Array(N * 3), sc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // SPACE: uniform over the full sphere (el ∈ [-π/2, π/2] via asin). ATMOSPHERE: upper dome, zenith-biased.
      const az = rnd() * Math.PI * 2, el = SKY.space ? Math.asin(2 * rnd() - 1) : Math.pow(rnd(), 0.6) * (Math.PI / 2);
      const rr = R * 0.985, cr = Math.cos(el);
      sp[i*3] = SKY.center[0] + rr*cr*Math.cos(az); sp[i*3+1] = SKY.center[1] + rr*cr*Math.sin(az); sp[i*3+2] = SKY.center[2] + rr*Math.sin(el);
      const b = 0.6 + 0.4 * rnd(); sc[i*3] = b; sc[i*3+1] = b; sc[i*3+2] = b * (0.9 + 0.1 * rnd());
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    stars.renderOrder = -1;
    scene.add(stars);
  }
  if (SKY.moon) {
    const M = SKY.moon;
    const el = Math.max(0.25, Math.min(0.95, M.h)) * (Math.PI / 2);   // h: horizon→zenith
    const az = -Math.PI / 2 + (M.u - 0.5) * Math.PI;                  // front sky, opposite the sun azimuth
    const rr = R * 0.97, cr = Math.cos(el);
    const dir = [cr * Math.cos(az), cr * Math.sin(az), Math.sin(el)];
    // Phase-carved moon (lit from the right) + a soft halo, painted onto a sprite texture.
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), cx = 64, cy = 64, r = 42;
    const halo = x.createRadialGradient(cx, cy, r * 0.55, cx, cy, 64);
    halo.addColorStop(0, 'rgba(226,229,240,' + (0.4 * (M.nightFactor ?? 1)).toFixed(2) + ')'); halo.addColorStop(1, 'rgba(226,229,240,0)');
    x.fillStyle = halo; x.fillRect(0, 0, 128, 128);
    const ph = Math.max(0, Math.min(1, M.phase ?? 1)), tw = r * (2 * ph - 1);
    x.fillStyle = 'rgb(234,236,245)';
    x.beginPath();
    x.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);                       // lit right limb (semicircle)
    // terminator: bulge LEFT (gibbous, tw>0) or RIGHT (crescent, tw<0) of the lit half
    x.ellipse(cx, cy, Math.abs(tw), r, 0, Math.PI / 2, -Math.PI / 2, tw < 0);
    x.fill();
    const msp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    const sz = R * 0.05 * (M.size || 1);
    msp.position.set(SKY.center[0] + dir[0] * rr, SKY.center[1] + dir[1] * rr, SKY.center[2] + dir[2] * rr);
    msp.scale.set(sz, sz, 1); msp.renderOrder = -1;
    scene.add(msp);
  }
  if (SKY.sun) {
    const S = SKY.sun;
    // Two placements: a 3D world DIR (planetary/space — pin the sun at the true light direction,
    // so it sits over the lit hemisphere as the camera orbits) or the front-sky { u, h } horizon
    // projection (room/city scenes). A star in the void reads white; a horizon sun warms low down.
    let dir, warmth;
    if (Array.isArray(S.dir)) {
      const L = Math.hypot(S.dir[0], S.dir[1], S.dir[2]) || 1;
      dir = [S.dir[0] / L, S.dir[1] / L, S.dir[2] / L];
      warmth = 0;
    } else {
      const el = Math.max(0.25, Math.min(0.95, S.h)) * (Math.PI / 2); // h: horizon→zenith
      const az = -Math.PI / 2 + (S.u - 0.5) * Math.PI;                // same projection as the moon
      const cr = Math.cos(el);
      dir = [cr * Math.cos(az), cr * Math.sin(az), Math.sin(el)];
      warmth = Math.max(0, Math.min(1, 1 - el / (Math.PI / 2)));      // low sun → sunset orange
    }
    const rr = R * 0.97;
    // Warm luminary disc + a soft glow halo (no phase carving — the sun is always full),
    // painted onto a sprite texture. Warmer toward the horizon, scaled by the glow knob.
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), cx = 64, cy = 64, r = 30;
    const cr2 = Math.round(255), cg2 = Math.round(252 - 44 * warmth), cb2 = Math.round(240 - 90 * warmth);
    const core = 'rgb(' + cr2 + ',' + cg2 + ',' + cb2 + ')';
    const halo = x.createRadialGradient(cx, cy, r * 0.5, cx, cy, 64);
    halo.addColorStop(0, 'rgba(' + cr2 + ',' + cg2 + ',' + cb2 + ',' + (0.55 * (S.glow || 1)).toFixed(2) + ')');
    halo.addColorStop(1, 'rgba(' + cr2 + ',' + cg2 + ',' + cb2 + ',0)');
    x.fillStyle = halo; x.fillRect(0, 0, 128, 128);
    x.fillStyle = core; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    const ssp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    const sz = R * 0.06 * (S.size || 1);
    ssp.position.set(SKY.center[0] + dir[0] * rr, SKY.center[1] + dir[1] * rr, SKY.center[2] + dir[2] * rr);
    ssp.scale.set(sz, sz, 1); ssp.renderOrder = -1;
    scene.add(ssp);
  }
}`;
}

// In-page script: the translucent water sheet. A standalone mesh (NOT in the opaque face groups)
// whose colour attribute is 4-component, so three applies per-vertex alpha (USE_COLOR_ALPHA) —
// shallows read clear, deeps opaque. depthWrite:false + renderOrder 1 so it blends over the
// already-drawn opaque lakebed (depth-tested against terrain) without self-occluding.
export function waterMeshScript(wm) {
  return `
// --- translucent water sheet (per-vertex alpha) ---
{
  const pos = decodeF32(${safeJson(b64(wm.positions))});
  const col = decodeF32(${safeJson(b64(wm.colors))});
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 1;
  scene.add(m);
}`;
}

// First-person free-traverse (opt-in via emitThreeWorld({ walk })). A z-up pointer-lock
// controller — pure control, no collision/gravity/wobble. WASD moves on the heading plane,
// Space/Shift fly up/down, mouse looks. World-AGNOSTIC: it only mutates camera XYZ + yaw/pitch,
// and every World is z-up (camera.up=+Z), so the same controller traverses a room, a house, a
// city, a hub or terrain — the caller only picks spawn + speed (scale). The vendored
// PointerLockControls addon is y-up, so we drive yaw (about world +Z) and pitch by hand instead.
// `cfg`: { speed, spawn:[x,y,z] }. `center`: scene centroid (spawn faces it on entry).
export function walkModeScript(cfg, center) {
  return `
// --- first-person traversal (z-up): WALK (gravity + wall collision) and FLY (free 6DOF) ---
// Two grounded-vs-free modes sharing one pointer-lock look. WALK raycasts the real geometry
// (no separate collider data): straight down for the floor underfoot (stairs/terrain/voids all
// just work) and ahead for walls. FLY ignores both — W follows the full aim, Space/Shift fly z.
const WALK = ${safeJson(cfg)};
const WALK_CENTER = ${safeJson(center)};
const walkHint = document.querySelector('.hint');
const ORBIT_HINT = walkHint ? walkHint.textContent : '';
let walkYaw = 0, walkPitch = 0, walkMode = 'fly', walkVZ = 0, walkEye = WALK.minEye, walkGround = false, walkDragging = false;
const walkKeys = new Set();
// FPV head-bob (opt-in): WALK.bob is a baked gait-camera curve (gait-camera.js) — the figure
// rig's own head trajectory over one stride. Indexed by DISTANCE walked (the bob stops when you
// stop) and eased in/out with motion. Offsets are STAND units, scaled to the world by
// walkEye/0.855 (the figure's eye sits at 0.855 STAND) so a taller vantage bobs proportionally.
// null → rigid eye (the walk is unchanged).
// FPS-feel defaults: subtle, mostly POSITIONAL (rotational view-bob is the nauseating part,
// so yaw/pitch stay small). Override per-channel via the baked-curve object.
const BOB = WALK.bob || null;
const BOB_EYE_STAND = 0.855;
const BOB_SCALES = BOB ? { sway: BOB.swayScale ?? 0.12, vert: BOB.bobScale ?? 0.35, yaw: BOB.yawScale ?? 0.25, pitch: BOB.pitchScale ?? 0.15 } : null;
// Bob scales STAND->world by the player's standing eye height (walkEye, computed on entry) — so a
// caller MUST pass a street-level walk eye (the default spawn sits at the city centroid, which
// would balloon the bob). strideScale > 1 lengthens the stride -> calmer step cadence.
const BOB_STRIDE = BOB ? (BOB.strideScale ?? 1.6) : 1;
let bobPhase = 0, bobAmt = 0, bobPrev = { x: 0, y: 0, z: 0 };
function sampleBob(phase){
  const C = BOB.curve, N = C.length;
  const f = (((phase % 1) + 1) % 1) * N;
  const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, t = f - Math.floor(f);
  const a = C[i0], b = C[i1], lp = (k) => a[k] + (b[k] - a[k]) * t;
  return { dx: lp('dx'), dy: lp('dy'), dz: lp('dz'), pitch: lp('pitch'), yaw: lp('yaw') };
}
const WALK_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'];
// collide/ground against every opaque fill (incl. the x-ray outer walls, which live outside \`solids\`)
const walkColliders = solids.concat(xrayGroups.map((g) => g.fill));
const walkDown = new THREE.Raycaster(), walkAhead = new THREE.Raycaster();
const flyBtn = document.createElement('button'); flyBtn.textContent = 'fly';
const walkBtn = document.createElement('button'); walkBtn.textContent = 'walk';
function walkLookDir(){
  return new THREE.Vector3(Math.cos(walkPitch) * Math.cos(walkYaw), Math.cos(walkPitch) * Math.sin(walkYaw), Math.sin(walkPitch));
}
// world z of the nearest solid surface straight below (x,y) from height zFrom, or null if nothing underfoot
function groundBelow(x, y, zFrom){
  walkDown.set(new THREE.Vector3(x, y, zFrom), new THREE.Vector3(0, 0, -1));
  const hit = walkDown.intersectObjects(walkColliders, false)[0];
  return hit ? hit.point.z : null;
}
function enterFirstPerson(mode){
  walkMode = mode; walkOn = true; controls.enabled = false; walkVZ = 0;
  bobPhase = 0; bobAmt = 0; bobPrev = { x: 0, y: 0, z: 0 };   // reset head-bob on (re)entry
  flyBtn.classList.toggle('on', mode === 'fly'); walkBtn.classList.toggle('on', mode === 'walk');
  camera.position.set(WALK.spawn[0], WALK.spawn[1], WALK.spawn[2]);
  walkYaw = Math.atan2(WALK_CENTER[1] - WALK.spawn[1], WALK_CENTER[0] - WALK.spawn[0]); // spawn looking inward
  walkPitch = 0;
  if (mode === 'walk'){
    // eye height = how far the (tuned) spawn floats over the floor beneath it; keeps the caller's vantage,
    // then gravity holds you that far above whatever you stand on. Falls back to minEye over open air.
    const g = groundBelow(WALK.spawn[0], WALK.spawn[1], WALK.spawn[2] + 1e-3);
    walkEye = (g != null) ? Math.max(WALK.minEye, WALK.spawn[2] - g) : WALK.minEye;
    if (g != null) camera.position.z = g + walkEye;
  }
  // WALK captures the pointer (immersive FPS). FLY keeps the cursor free — you steer by
  // dragging and can still click the HUD — so it doubles as a navigable inspect mode.
  if (mode === 'walk') { canvas.requestPointerLock(); }
  else { walkDragging = false; canvas.style.cursor = 'grab'; }
  if (walkHint) walkHint.textContent = mode === 'walk'
    ? 'WALK · WASD move · Space jump · mouse look · gravity + walls · click to capture · Esc release'
    : 'FLY · WASD toward aim · Space/Shift up·down · drag to look · Esc release';
}
function exitWalk(){
  walkOn = false; controls.enabled = true; flyBtn.classList.remove('on'); walkBtn.classList.remove('on');
  if (document.pointerLockElement) document.exitPointerLock();
  walkDragging = false; canvas.style.cursor = '';
  if (walkHint) walkHint.textContent = ORBIT_HINT;
  applyCam(0);
}
flyBtn.onclick = () => (walkOn && walkMode === 'fly') ? exitWalk() : enterFirstPerson('fly');
walkBtn.onclick = () => (walkOn && walkMode === 'walk') ? exitWalk() : enterFirstPerson('walk');
hud.appendChild(flyBtn); hud.appendChild(walkBtn);
// WALK: re-capture pointer on click if lost; losing the lock (Esc) exits the mode.
canvas.addEventListener('click', () => { if (walkOn && walkMode === 'walk' && document.pointerLockElement !== canvas) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { if (walkOn && walkMode === 'walk' && document.pointerLockElement !== canvas) exitWalk(); });
// FLY: drag-to-look — only rotate while a mouse button is held, leaving the cursor usable otherwise.
canvas.addEventListener('mousedown', () => { if (walkOn && walkMode === 'fly') { walkDragging = true; canvas.style.cursor = 'grabbing'; } });
addEventListener('mouseup', () => { if (walkDragging) { walkDragging = false; canvas.style.cursor = 'grab'; } });
document.addEventListener('mousemove', (e) => {
  if (!walkOn) return;
  if (walkMode === 'walk' ? document.pointerLockElement !== canvas : !walkDragging) return;
  const s = 0.0022;
  walkYaw -= e.movementX * s; walkPitch -= e.movementY * s;
  const lim = Math.PI / 2 - 0.05; walkPitch = Math.max(-lim, Math.min(lim, walkPitch));
});
addEventListener('keydown', (e) => {
  if (!walkOn) return;
  if (e.code === 'Escape') { exitWalk(); return; }   // exits FLY (WALK also exits via pointerlockchange)
  if (WALK_CODES.includes(e.code)) { walkKeys.add(e.code); e.preventDefault(); }
});
addEventListener('keyup', (e) => walkKeys.delete(e.code));
// WALK horizontal move with wall-slide: advance X and Y separately, each clamped by a forward ray
// (cast at eye + shin so a low rail still stops you). Hitting a wall on one axis still slides the other.
function walkSlide(dx, dy){
  const axis = (ax, ay) => {
    const d = Math.hypot(ax, ay); if (d < 1e-6) return;
    const dir = new THREE.Vector3(ax / d, ay / d, 0);
    let allow = d;
    for (const zo of [0, -walkEye * 0.6]) {
      walkAhead.set(new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z + zo), dir);
      const hit = walkAhead.intersectObjects(walkColliders, false)[0];
      if (hit) allow = Math.min(allow, Math.max(0, hit.distance - WALK.radius));
    }
    camera.position.x += dir.x * allow; camera.position.y += dir.y * allow;
  };
  axis(dx, 0); axis(0, dy);
}
stepWalk = (dt) => {
  if (walkMode === 'fly') {
    const fwd = walkLookDir();                                                // full aim (yaw+pitch): W/S fly toward where you look
    const right = new THREE.Vector3(Math.sin(walkYaw), -Math.cos(walkYaw), 0); // strafe stays horizontal
    const v = new THREE.Vector3();
    if (walkKeys.has('KeyW')) v.add(fwd);
    if (walkKeys.has('KeyS')) v.sub(fwd);
    if (walkKeys.has('KeyD')) v.add(right);
    if (walkKeys.has('KeyA')) v.sub(right);
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(WALK.speed * dt);
    let dz = 0;
    if (walkKeys.has('Space')) dz += 1;
    if (walkKeys.has('ShiftLeft') || walkKeys.has('ShiftRight')) dz -= 1;
    camera.position.x += v.x; camera.position.y += v.y; camera.position.z += v.z + dz * WALK.speed * dt;
    camera.lookAt(camera.position.clone().add(walkLookDir()));
    return;
  }
  // WALK: horizontal heading only (pitch ignored for movement); gravity + the floor ray pin you down.
  // Strip last frame's head-bob first so physics + the floor-snap run on the CLEAN base eye — the bob
  // is a transient render offset, never fed back into the controller state (→ no drift / no creep).
  if (BOB) { camera.position.x -= bobPrev.x; camera.position.y -= bobPrev.y; camera.position.z -= bobPrev.z; }
  const fwd = new THREE.Vector3(Math.cos(walkYaw), Math.sin(walkYaw), 0);
  const right = new THREE.Vector3(Math.sin(walkYaw), -Math.cos(walkYaw), 0);
  const v = new THREE.Vector3();
  if (walkKeys.has('KeyW')) v.add(fwd);
  if (walkKeys.has('KeyS')) v.sub(fwd);
  if (walkKeys.has('KeyD')) v.add(right);
  if (walkKeys.has('KeyA')) v.sub(right);
  let moveDist = 0;
  if (v.lengthSq() > 0) { v.normalize().multiplyScalar(WALK.speed * dt); moveDist = v.length(); walkSlide(v.x, v.y); }
  if (walkGround && walkKeys.has('Space')) walkVZ = WALK.jump;   // jump only from the ground
  walkVZ -= WALK.gravity * dt;
  camera.position.z += walkVZ * dt;
  const g = groundBelow(camera.position.x, camera.position.y, camera.position.z);
  if (g != null && camera.position.z <= g + walkEye) {           // landed / standing: snap to floor + eye
    camera.position.z = g + walkEye; walkVZ = 0; walkGround = true;
  } else { walkGround = false; }
  // Head-bob: advance the gait phase by DISTANCE walked (2 steps per cycle), ease it in/out with
  // motion, sample the baked rig curve, apply it as a transient position offset on the clean eye + a
  // transient yaw/pitch on the LOOK only (walkYaw/walkPitch untouched → the mouse aim stays exact).
  let bobYaw = 0, bobPitch = 0;
  if (BOB) {
    const bu = walkEye / BOB_EYE_STAND;                          // STAND → world units, by standing eye height
    bobAmt += ((moveDist > 1e-6 ? 1 : 0) - bobAmt) * Math.min(1, dt * 6);
    if (moveDist > 1e-6) bobPhase += moveDist / (BOB.strideDistance * bu * 2 * BOB_STRIDE);
    const s = sampleBob(bobPhase);
    const ox = (right.x * s.dx + fwd.x * s.dy) * BOB_SCALES.sway * bu * bobAmt;
    const oy = (right.y * s.dx + fwd.y * s.dy) * BOB_SCALES.sway * bu * bobAmt;
    const oz = s.dz * BOB_SCALES.vert * bu * bobAmt;
    bobPrev = { x: ox, y: oy, z: oz };
    camera.position.x += ox; camera.position.y += oy; camera.position.z += oz;
    bobYaw = s.yaw * Math.PI / 180 * BOB_SCALES.yaw * bobAmt;
    bobPitch = s.pitch * Math.PI / 180 * BOB_SCALES.pitch * bobAmt;
  }
  const bl = new THREE.Vector3(
    Math.cos(walkPitch + bobPitch) * Math.cos(walkYaw + bobYaw),
    Math.cos(walkPitch + bobPitch) * Math.sin(walkYaw + bobYaw),
    Math.sin(walkPitch + bobPitch),
  );
  camera.lookAt(camera.position.clone().add(bl));
};`;
}

// Deform channel (opt-in, additive): apply a time-varying LINEAR map to a named face group, about a
// pivot, by writing the group mesh's matrix each frame. Where movers do rigid TRS (rotate + translate +
// axis-aligned scale), this does the GENERAL linear map a TRS can't reach — SHEAR, off-axis/anisotropic
// stretch, and rank-deficient collapse. The baked-flat lighting (MeshBasicMaterial, unlit) is what makes
// this cheap: deforming vertices can't break normals there are none. Two modes:
//   • morph — interpolate identity → `to` over `period` (mover-style play/hold/loop). The linear-map
//     reveal (transform-view): watch space flow into A; eigen-directions slide straight out.
//   • wave — M(t) = I + Σ ampᵢ·sin(2π t/periodᵢ + phaseᵢ)·basisᵢ. A superposition of oscillating
//     strains: a single `basis` is the 1-term case (a breathing +/× ring); two terms in quadrature
//     (plus·cos + cross·sin) make the rotating quadrupole an inspiral actually emits (the ring's
//     ellipse ROTATES — test masses trace circles).
// Each entry: { group, mode?:'morph'|'wave', to?, basis?|terms?, amp?, phase?, period?, hold?, loop?, pivot? }.
//   terms: [{ basis, amp?, period?, phase? }, …]   (superposed; `basis`+`amp`+… is shorthand for one term)
// `to`/`basis` accept a 2×2 (auto-embedded, z untouched) or a 3×3. Only emitted with non-empty `deforms`.
export function deformChannelScript(deforms) {
  return `
const DEFORMS = ${safeJson(deforms)};
const _ID3 = [[1,0,0],[0,1,0],[0,0,1]];
function _to3(M){ // 2×2 → 3×3 (z identity), or pass a 3×3 through
  if (M.length === 2) return [[M[0][0],M[0][1],0],[M[1][0],M[1][1],0],[0,0,1]];
  return [[M[0][0],M[0][1],M[0][2]],[M[1][0],M[1][1],M[1][2]],[M[2][0],M[2][1],M[2][2]]];
}
const _lerp3 = (A,B,u) => A.map((row,r) => row.map((v,c) => v + (B[r][c]-v)*u));
const _addScaled = (A,B,s) => A.map((row,r) => row.map((v,c) => v + B[r][c]*s));
function _deformU(d, sec){
  if (d.loop) return ((sec/(d.period||4)) % 1 + 1) % 1;
  const cycle = (d.period||4) + (d.hold||0), ph = sec % cycle;
  return ph < (d.period||4) ? ph/(d.period||4) : 1;
}
// affine 4×4 that applies linear L about pivot p:  v' = L·(v − p) + p = L·v + (p − L·p).
const _mat4 = new THREE.Matrix4();
function _applyLinear(mesh, L, p){
  const a=L[0][0],b=L[0][1],c=L[0][2], d=L[1][0],e=L[1][1],f=L[1][2], g=L[2][0],h=L[2][1],k=L[2][2];
  const px=p[0],py=p[1],pz=p[2];
  const tx = px-(a*px+b*py+c*pz), ty = py-(d*px+e*py+f*pz), tz = pz-(g*px+h*py+k*pz);
  _mat4.set(a,b,c,tx, d,e,f,ty, g,h,k,tz, 0,0,0,1);
  mesh.matrix.copy(_mat4);
  mesh.matrixWorldNeedsUpdate = true;   // matrixAutoUpdate is off → flag matrixWorld for recompute, else the render ignores it
}
const _deformRigs = DEFORMS.map((d) => {
  const mesh = meshes[d.group] || null;
  if (mesh) { mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; } // deformed bounds outgrow the sphere
  const raw = (Array.isArray(d.terms) && d.terms.length) ? d.terms : (d.basis ? [{ basis:d.basis, amp:d.amp, period:d.period, phase:d.phase }] : []);
  const terms = raw.map((tm) => ({ basis:_to3(tm.basis), amp:(tm.amp!=null?tm.amp:1), period:(tm.period||4), phase:(tm.phase||0) }));
  return { d, mesh, to: d.to ? _to3(d.to) : null, terms, pivot: d.pivot || [0,0,0] };
}).filter((r) => r.mesh);
stepDeforms = (t) => {
  const sec = t / 1000;   // the per-frame clock arrives in ms (matching every other channel)
  for (const r of _deformRigs){
    let L;
    if (r.d.mode === 'wave' && r.terms.length){
      L = [[1,0,0],[0,1,0],[0,0,1]];
      for (const tm of r.terms) L = _addScaled(L, tm.basis, tm.amp * Math.sin((2*Math.PI*sec)/tm.period + tm.phase));
    } else if (r.to) L = _lerp3(_ID3, r.to, _deformU(r.d, sec));
    else continue;
    _applyLinear(r.mesh, L, r.pivot);
  }
};`;
}

// In-page script: the EVENTS channel — the in-world bus (event-bus.plan.md). This is the MEMBRANE
// between mechanism and policy: the physics step emits physical FACTS (contact / rest), the bus
// assigns MEANING via declarative reactions + scope-keyed sequences, and the result is reflected
// onto marker meshes. Compute is truth, render is a projection of it — by the time __syncBus runs,
// the reaction has already decided what happened; the mesh just shows the foregone conclusion.
//
// Single source of truth: the reducer is the SAME code as the node module event-bus.js, emitted via
// buildBus.toString() — no second, drifting browser copy (same discipline as physics/controllable).
// Determinism: deriveEvents is EDGE-TRIGGERED off the integrator's per-step detections, and the first
// frame seeds dt 0 (frame zero → no events), so a frozen still / ?t render is the initial condition.
// Reaction VERBS reflected here are the non-physics ones — spawn (a marker appears), toggle (.on →
// mesh visibility), move (reposition). Reaching back INTO physics (impulse on a body) is Phase 5b.
export function eventsChannelScript(events) {
  return `
const EVENTS = ${safeJson(events)};
const __BUS = (${buildBus.toString()})();
const __busState = __BUS.createBusState(EVENTS, EVENTS.entities || []);
const __SOURCES = EVENTS.sources || [];
// INPUT as a source (the 4th, beside physics facts / timers / watches): bind key/pointer to a bus
// event. Listeners push onto a queue drained each frame, so a conceptual world is clickable.
const __inputQueue = [];
const __markerMeshes = {};        // bus entity id → mesh (spawn/toggle/move reflect onto these)
const __MARKER_COLOR = 0x7ad1ff;
const __pickRay = new THREE.Raycaster();
const __pickNdc = new THREE.Vector2();
// raycast the VISIBLE marker meshes under the pointer; return the nearest entity id, or null.
function __pickEntity(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  __pickNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  __pickNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  __pickRay.setFromCamera(__pickNdc, camera);
  const meshes = Object.values(__markerMeshes).filter((m) => m.visible);
  const hits = __pickRay.intersectObjects(meshes, false);
  return hits.length ? hits[0].object.__entityId : null;
}
// 'fire' is a line-of-sight laser. By DEFAULT it shoots CAMERA-forward (first-person: crosshair =
// screen-center). With a "from" entity id on the input it shoots from that CONTROLLABLE entity's OWN
// line of sight — origin at its head (transform + "eye" height, default 1.4), direction along its
// heading/pitch — so a THIRD-PERSON character aims where IT faces, not where the camera looks. Either
// way it raycasts ALL scene geometry and takes the NEAREST hit, so walls/obstacles occlude for free.
function __shotRay(inp) {                                            // → { origin, dir } or null
  if (inp && inp.from) {
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    const e = ctrl && ctrl.byId ? ctrl.byId[inp.from] : null;
    if (!e) return null;
    const p = e.transform.pos, h = e.transform.heading || 0, pit = inp.level ? 0 : (e.transform.pitch || 0);   // level → pure-yaw aim
    const eye = inp.eye != null ? inp.eye : 1.4;
    return { origin: new THREE.Vector3(p[0], p[1], p[2] + eye), dir: new THREE.Vector3(Math.cos(pit) * Math.cos(h), Math.cos(pit) * Math.sin(h), Math.sin(pit)).normalize() };
  }
  return { origin: camera.position.clone(), dir: camera.getWorldDirection(new THREE.Vector3()) };
}
// nearest scene intersection along a ray, started slightly IN FRONT of the origin so a character never
// shoots its own body. Returns { start, hit } (hit is the THREE intersection, or null on a miss).
function __rayHit(ray) {
  const start = ray.origin.clone().add(ray.dir.clone().multiplyScalar(0.6));
  __pickRay.set(start, ray.dir);
  const hits = __pickRay.intersectObjects(scene.children, true);    // recursive: walls/obstacles occlude
  return { start, hit: hits.length ? hits[0] : null };
}
// a brief laser BEAM from the muzzle to where the shot landed (a marker, a wall, or far). A pure
// visual flash OUTSIDE the bus (no determinism impact — the timeout/render is not the tick).
let __beam = null;
function __laserFlash(from, to) {
  if (!__beam) { __beam = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff5a4d, transparent: true, opacity: 0.9 })); __beam.frustumCulled = false; scene.add(__beam); }
  __beam.geometry.setFromPoints([from, to]);
  __beam.visible = true;
  clearTimeout(__beam.__t); __beam.__t = setTimeout(() => { if (__beam) __beam.visible = false; }, 90);
}
// aim SIGHT: a fixed screen-center reticle for CAMERA-fire; a world-space dot at the character's
// line-of-sight point for from-fire (updated each frame in stepEvents so you SEE where it aims).
const __fireInputs = (EVENTS.inputs || []).filter((i) => i && i.on === 'fire');
if (__fireInputs.some((i) => !i.from)) {
  const __sight = document.createElement('div');
  __sight.style.cssText = 'position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#ff5a4d;box-shadow:0 0 8px 2px rgba(255,90,77,.85),0 0 0 1px rgba(255,255,255,.55);pointer-events:none;z-index:11';
  document.body.appendChild(__sight);
}
const __losInput = __fireInputs.find((i) => i.from);
let __aimDot = null;
if (__losInput) { __aimDot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe000 })); __aimDot.frustumCulled = false; scene.add(__aimDot); }   // bright yellow reticle, distinct from red targets
function __updateAim() {   // park the aim dot where the character is looking (nearest hit, or far along the ray)
  if (!__aimDot || !__losInput) return;
  const ray = __shotRay(__losInput); if (!ray) return;
  const { start, hit } = __rayHit(ray);
  __aimDot.position.copy(hit ? hit.point : start.clone().add(ray.dir.clone().multiplyScalar(40)));
}
(EVENTS.inputs || []).forEach((inp) => {
  if (!inp || !inp.emit) return;
  if (inp.on === 'key') window.addEventListener('keydown', (ev) => { if (!inp.key || ev.key === inp.key) __inputQueue.push(Object.assign({}, inp.emit)); });
  else if (inp.on === 'pointer') renderer.domElement.addEventListener('pointerdown', () => __inputQueue.push(Object.assign({}, inp.emit)));
  // 'pick' raycasts the marker the pointer is over and stamps its id into the event (default 'target').
  else if (inp.on === 'pick') renderer.domElement.addEventListener('pointerdown', (ev) => {
    const id = __pickEntity(ev);
    if (id == null) return;                     // a miss is no deed — score stays tied to a real hit
    const e = Object.assign({}, inp.emit); e[inp.into || 'target'] = id; __inputQueue.push(e);
  });
  // 'fire' is the LOS laser (left-click): raycast camera-forward, flash a beam to wherever it landed,
  // and stamp the hit target. An occluded or missed shot flashes but is no deed — same "score stays
  // tied to a real hit" discipline as pick.
  else if (inp.on === 'fire') renderer.domElement.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;                // left-click only
    const ray = __shotRay(inp); if (!ray) return;
    const { start, hit } = __rayHit(ray);
    __laserFlash(start, hit ? hit.point : start.clone().add(ray.dir.clone().multiplyScalar(100)));   // beam, hit or miss
    const id = hit && hit.object.__entityId != null ? hit.object.__entityId : null;
    if (id == null) return;
    const e = Object.assign({}, inp.emit); e[inp.into || 'target'] = id; __inputQueue.push(e);
  });
});
function __ensureMarker(e) {
  if (__markerMeshes[e.id]) return __markerMeshes[e.id];
  const r = Number.isFinite(e.radius) ? e.radius : 0.4;
  const col = e.color != null ? new THREE.Color(e.color) : new THREE.Color(__MARKER_COLOR);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshBasicMaterial({ color: col }));
  mesh.__entityId = e.id;
  scene.add(mesh);
  __markerMeshes[e.id] = mesh;
  return mesh;
}
// optional HUD: bind vars → an on-screen readout (so the score/timer is visible while you play).
let __hud = null;
if (Array.isArray(EVENTS.hud) && EVENTS.hud.length) {
  __hud = document.createElement('div');
  __hud.style.cssText = 'position:fixed;top:12px;left:12px;font:600 18px system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.45);padding:8px 14px;border-radius:8px;z-index:10;letter-spacing:.5px';
  document.body.appendChild(__hud);
}
function __syncHud() { if (__hud) __hud.textContent = EVENTS.hud.map((h) => (h.label ? h.label + ': ' : '') + (__busState.vars[h.var] != null ? __busState.vars[h.var] : 0)).join(' '); }
// Read-only projection of bus ENTITY state onto meshes. The bus decides WHAT is true; this shows it.
// Physics body PROXIES (Phase 5b link) are skipped — they already render via the physics channel.
function __syncBus() {
  for (const e of __busState.entities) {
    if (__busState._linked && __busState._linked[e.id]) continue;
    const m = __ensureMarker(e);
    m.position.set(e.position[0], e.position[1], e.position[2]);
    m.visible = e.on !== false;   // toggle flips .on → hide/show; default shown
  }
}
// Phase 5b bridge: register physics bodies so reactions can impulse/move them, then seed any
// one-shot startup events (e.g. arming a rig saga). Runs once, before the loop (physics block ran
// first, so window.__mojSim is already present).
if (window.__mojSim) __BUS.linkPhysics(__busState, window.__mojSim.state);
if (EVENTS.initial) __BUS.processEvents(__busState, EVENTS.initial);
let __busPrev, __busPrevT = 0;
stepEvents = (t) => {
  const dtSec = __busPrevT ? Math.min((t - __busPrevT) / 1000, 0.05) : 0; __busPrevT = t;  // frame 0 → dt 0
  if (window.__mojSim) __BUS.syncFromBodies(__busState, window.__mojSim.state);   // fresh body reads
  const incoming = [];
  while (__inputQueue.length) incoming.push(__inputQueue.shift());   // input → bus events this frame
  if (window.__mojSim) {            // physics FACTS → events (edge-triggered), only if physics is live
    const d = __BUS.deriveEvents(window.__mojSim.state, __busPrev, __SOURCES);
    __busPrev = d.prev;
    for (const ev of d.events) incoming.push(ev);
  }
  if (incoming.length) __BUS.processEvents(__busState, incoming);
  __watchFix();                                      // conceptual predicates (vars/entities/counts)
  const ticks = __BUS.tickTimers(__busState, dtSec); // recurring world heartbeats (spawners, countdowns)
  if (ticks.length) __BUS.processEvents(__busState, ticks);
  const timed = __BUS.stepTime(__busState, dtSec);   // one-shot sequence awaits
  if (timed.length) __BUS.processEvents(__busState, timed);
  __watchFix();                                      // re-check after timer effects settle
  if (window.__mojSim) __BUS.syncToBodies(__busState, window.__mojSim.state);     // apply impulse/move back
  __syncBus(); __syncHud(); __updateAim();
};
// loop watches→reactions to a fixed point so a reaction's var write can trip a watch the same frame.
function __watchFix() { let g = 0; while (g++ < 8) { const w = __BUS.watchEvents(__busState); if (!w.length) break; __BUS.processEvents(__busState, w); } }
window.__mojBus = { bus: __BUS, state: __busState, markers: __markerMeshes, sync: __syncBus };`;
}

// audio channel (beats.plan.md): synthesized WebAudio presence over the live World — an ambient
// soundtrack, bus-event SFX stingers, gait/walk footsteps, and wind. Emitted ONLY when the payload
// carries `audio` AND the run is not a capture (muted headless bakes stay byte-identical); the
// returned string starts with '\n' and the call site interpolates '' when absent, so a world
// without audio emits byte-identical HTML to today. Presentation, not simulation: everything here
// READS sim state (bus events, gait phase, camera motion) and never writes back. The browser
// autoplay policy needs a user gesture — the canvas's existing click/pointer-lock entry is the
// unlock; a small HUD speaker toggles mute after that.
export function audioChannelScript(audio) {
  return `
// ---- beats audio channel (opt-in, presentation-only) ----
const __AUDIO = ${safeJson(audio)};
const __BEATS_PATCHES = ${safeJson(BEATS_PATCHES)};
const __BEATS = (${buildBeatsKernel.toString()})();
let __beatsCtx = null, __beatsEng = null, __beatsMuted = false;
function __beatsUnlock() {
  if (__beatsCtx) { if (__beatsCtx.state === 'suspended' && !__beatsMuted) __beatsCtx.resume(); return; }
  __beatsCtx = new (window.AudioContext || window.webkitAudioContext)();
  __beatsEng = __BEATS.createEngine(__beatsCtx);
  if (__AUDIO.soundtrack) {
    if (__AUDIO.soundtrack.kind === 'beats-composition') __beatsEng.startComposition(__AUDIO.soundtrack, __BEATS_PATCHES);
    else if (__AUDIO.soundtrack.kind === 'beats-pattern') __beatsEng.startPattern(__AUDIO.soundtrack, __BEATS_PATCHES);
    else __beatsEng.startAmbient(__AUDIO.soundtrack, __BEATS_PATCHES);
  }
  if (__AUDIO.wind) __beatsEng.wind(__AUDIO.wind);
  __beatsBtn.textContent = '\\u{1F50A}';
}
renderer.domElement.addEventListener('pointerdown', __beatsUnlock);
// HUD speaker: pre-unlock it advertises sound; after, it toggles mute (suspend keeps CPU quiet).
const __beatsBtn = document.createElement('button');
__beatsBtn.textContent = '\\u{1F507}';
__beatsBtn.title = 'sound (click world to start)';
__beatsBtn.setAttribute('aria-label', 'toggle sound');
__beatsBtn.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:12;width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(10,12,18,.55);color:#dfe6f2;font-size:15px;cursor:pointer';
__beatsBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
__beatsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!__beatsCtx) { __beatsUnlock(); return; }
  __beatsMuted = !__beatsMuted;
  __beatsEng.setMuted(__beatsMuted);
  if (__beatsMuted) __beatsCtx.suspend(); else __beatsCtx.resume();
  __beatsBtn.textContent = __beatsMuted ? '\\u{1F507}' : '\\u{1F50A}';
});
document.body.appendChild(__beatsBtn);
function __beatsCue(cue) { if (__beatsEng && !__beatsMuted && cue) __beatsEng.playCue(cue); }
// bus stingers: observe the drained event stream by wrapping the reducer entry — audio reads the
// events and never touches state, so bus determinism (hash → replay) is untouched.
if (__AUDIO.on && typeof __BUS !== 'undefined') {
  const __beatsGlob = (str, pat) => {
    if (pat === '*') return true;
    if (pat.indexOf('*') < 0) return String(str) === pat;
    return new RegExp('^' + pat.split('*').map((s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.*') + '$').test(String(str));
  };
  const __beatsPE = __BUS.processEvents;
  __BUS.processEvents = function (state, events) {
    for (const ev of events) {
      for (const pat in __AUDIO.on) {
        if (__beatsGlob(ev.type, pat)) { __beatsCue(__AUDIO.cues && __AUDIO.cues[__AUDIO.on[pat]]); break; }
      }
    }
    return __beatsPE(state, events);
  };
}
// footsteps: two sources, both read-only. Controllable entities expose gait edges (gaitPhase /
// jumped / landed — controllable-world.js computes them for exactly this); first-person walk mode
// has no entity, so accumulated camera travel stands in for stride. Half-gait crossings = steps.
if (__AUDIO.footsteps) {
  const __gaitLast = {};
  let __walkAcc = 0;
  const __walkPrev = { x: null, y: null };
  (function __beatsGait() {
    requestAnimationFrame(__beatsGait);
    if (!__beatsEng || __beatsMuted) return;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (ctrl) {
      for (const e of ctrl.entities) {
        const last = __gaitLast[e.id] || (__gaitLast[e.id] = { ix: 0, jumped: false, landed: false });
        const ix = Math.floor((e.gaitPhase || 0) * 2);
        if (e.moving && e.grounded !== false && ix !== last.ix) __beatsCue(__AUDIO.footsteps.step);
        if (e.jumped && !last.jumped) __beatsCue(__AUDIO.footsteps.jump);
        if (e.landed && !last.landed) __beatsCue(__AUDIO.footsteps.land);
        last.ix = ix; last.jumped = !!e.jumped; last.landed = !!e.landed;
      }
    }
    if (typeof walkOn !== 'undefined' && walkOn) {
      if (__walkPrev.x !== null) {
        __walkAcc += Math.hypot(camera.position.x - __walkPrev.x, camera.position.y - __walkPrev.y);
        if (__walkAcc > 2.2) { __walkAcc = 0; __beatsCue(__AUDIO.footsteps.step); }
      }
      __walkPrev.x = camera.position.x; __walkPrev.y = camera.position.y;
    } else { __walkPrev.x = null; __walkPrev.y = null; }
  })();
}`;
}

// game channel (game-metacontext.plan.md): the level-contract bridge. Emitted when the payload
// carries `game` — a LEVEL is a pure function (params, seed, ticks) → outcome envelope, and this
// block is its I/O surface. Params arrive from a hosting game shell via versioned postMessage
// (level posts game-ready, shell replies game-init); with no shell — opened standalone, or a
// capture run — the contract's presets.default feeds the level so it stays playable/auditable.
// ONE envelope leaves per session via __mojGame.end(); in a shell it posts game-outcome, always
// it lands on __mojGame.envelope so capture probes can assert it (the completability audit).
// The store lives in the shell, never here. Emitted in capture runs too (unlike audio): the
// bridge is inert I/O there — no DOM, no messaging — but the envelope must be observable.
export function gameChannelScript(game) {
  return `
// ---- game channel (level contract bridge, opt-in) ----
const __GAME = ${safeJson(game)};
(function () {
  const __CV = ${GAME_CONTRACT_VERSION};
  const hosted = (function () { try { return window.parent && window.parent !== window; } catch (e) { return false; } })();
  const capture = _capture;
  const st = { params: null, seed: 1, started: false, ended: false, events: [], envelope: null, onStart: [] };
  function start(params, seed) {
    if (st.started) return;
    st.started = true;
    st.params = params || {};
    if (typeof seed === 'number' && isFinite(seed)) st.seed = seed;
    st.onStart.splice(0).forEach((cb) => { try { cb(st.params, st.seed); } catch (e) { console.error('game onStart', e); } });
  }
  function emit(ev) { if (!st.ended && ev && typeof ev === 'object' && ev.type) st.events.push(ev); }
  function end(result) {
    if (st.ended) return st.envelope;
    st.ended = true;
    st.envelope = { contractVersion: __CV, levelRef: __GAME.levelRef, seed: st.seed, result: result || 'success', events: st.events.slice() };
    if (hosted && !capture) { try { window.parent.postMessage({ moj: '${GAME_MSG_OUTCOME}', envelope: st.envelope }, '*'); } catch (e) { console.error('game outcome post', e); } }
    if (!capture) {
      const o = document.createElement('div');
      o.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.55);z-index:40;pointer-events:none';
      o.innerHTML = '<div style="background:rgba(12,16,26,.92);border:1px solid #2a3b58;border-radius:10px;padding:18px 28px;color:#dfe8f8;font:15px system-ui;text-align:center">level ' + (st.envelope.result === 'success' ? 'complete' : st.envelope.result) + '<br><span style="font-size:12px;color:#8fa5c8">' + st.events.length + ' event' + (st.events.length === 1 ? '' : 's') + ' → store</span></div>';
      document.body.appendChild(o);
    }
    return st.envelope;
  }
  window.__mojGame = {
    contract: __GAME,
    get params() { return st.params; },
    get seed() { return st.seed; },
    get events() { return st.events.slice(); },
    get envelope() { return st.envelope; },
    onStart: function (cb) { if (st.started) cb(st.params, st.seed); else st.onStart.push(cb); },
    emit: emit,
    end: end,
  };
  // declarative bus → game mapping (mirrors audio.on): observe the drained event stream by
  // wrapping the reducer entry — reads only, so bus determinism (hash → replay) is untouched.
  if (__GAME.on && typeof __BUS !== 'undefined') {
    const glob = (str, pat) => {
      if (pat === '*') return true;
      if (pat.indexOf('*') < 0) return String(str) === pat;
      return new RegExp('^' + pat.split('*').map((s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.*') + '$').test(String(str));
    };
    const prev = __BUS.processEvents;
    __BUS.processEvents = function (state, events) {
      for (const ev of events) {
        for (const pat in __GAME.on) {
          if (!glob(ev.type, pat)) continue;
          const act = __GAME.on[pat];
          if (act.emit) emit(JSON.parse(JSON.stringify(act.emit)));
          else if (act.end) end(act.end);
          break;
        }
      }
      return prev(state, events);
    };
  }
  // handshake: hosted levels announce and await params; standalone/capture runs fall back to
  // the contract's default preset (1.5s grace for a slow shell; capture never waits).
  function fallback() { start((__GAME.presets && __GAME.presets.default) || {}, 1); }
  if (hosted && !capture) {
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || d.moj !== '${GAME_MSG_INIT}') return;
      if (d.contractVersion !== __CV) { console.error('game: shell contract v' + d.contractVersion + ' ≠ level v' + __CV + ' — running presets'); fallback(); return; }
      start(d.params, d.seed);
    });
    try { window.parent.postMessage({ moj: '${GAME_MSG_READY}', contractVersion: __CV, levelRef: __GAME.levelRef }, '*'); } catch (e) { /* opaque parent */ }
    setTimeout(() => { if (!st.started) fallback(); }, 1500);
  } else {
    fallback();
  }
})();`;
}

// ── the runtime-channel registry (renderer-emitter.plan.md E2b) ────────────────────
// One row per channel in the World page's RUNTIME SECTION, in splice order. A row is
// the single place a channel exists: its emitted comment header, its inert `let`
// binding(s), its __mojStep call (order here IS the step order — events after physics
// is semantic), and — for the uniform list channels — the payload filter + script.
// Channels marked bespoke (walk / physics / actions / events / controllable) are
// normalized in emitThreeWorld (they couple to mesh bounds, capture state, or each
// other) and hand their finished block in via the same `blocks` map. The generated
// text is byte-identical to the hand-wired section it replaced — pinned by
// emit-channels.char.test.js.

const listOrNull = (v, keep) => { const l = (Array.isArray(v) ? v : []).filter(keep); return l.length ? l : null; };

export const RUNTIME_CHANNELS = [
  { key: 'walk',
    comment: [`// walk mode (opt-in) overrides orbit per-frame. walkOn/stepWalk stay inert (orbit-only) when`,
      `// no walkBlock is emitted, so the default World loop is unchanged. dt off setAnimationLoop's`,
      `// time arg (clamped) — no Date.now, and stable across frame-rate.`],
    lets: `let walkPrevT = 0, walkOn = false, stepWalk = () => {};` },
  { key: 'tracers',
    comment: [`// tracer channel (opt-in): stepTracers stays inert unless a tracerBlock is emitted.`],
    lets: `let stepTracers = () => {};`, step: `stepTracers(t);`,
    normalize: (v) => listOrNull(v, (tr) => tr && Array.isArray(tr.path) && tr.path.length > 1),
    script: tracerChannelScript },
  { key: 'movers',
    comment: [`// mover channel (opt-in): stepMovers stays inert unless a moverBlock is emitted.`],
    lets: `let stepMovers = () => {};`, step: `stepMovers(t);`,
    normalize: (v) => listOrNull(v, (mv) => mv && (mv.spin || mv.turn || mv.link || mv.pose || mv.fill || mv.pulse || mv.flash || mv.cascade || (Array.isArray(mv.path) && mv.path.length > 1))),
    script: moverChannelScript },
  { key: 'comets',
    comment: [`// comet channel (opt-in): stepComets stays inert unless a cometBlock is emitted.`],
    lets: `let stepComets = () => {};`, step: `stepComets(t);`,
    normalize: (v) => listOrNull(v, (cm) => cm && Array.isArray(cm.path) && cm.path.length > 1),
    script: cometChannelScript },
  { key: 'fields',
    comment: [`// field channel (opt-in): stepFields stays inert unless a fieldBlock is emitted.`],
    lets: `let stepFields = () => {};`, step: `stepFields(t);`,
    normalize: (v) => listOrNull(v, (fd) => fd && (Array.isArray(fd.sets) || Array.isArray(fd.lines))),
    script: fieldChannelScript },
  { key: 'surfaces',
    comment: [`// surface channel (opt-in): stepSurfaces stays inert unless a surfaceBlock is emitted.`],
    lets: `let stepSurfaces = () => {};`, step: `stepSurfaces(t);`,
    normalize: (v) => listOrNull(v, (sf) => sf && sf.grid && (Array.isArray(sf.waves) || Array.isArray(sf.sources) || (sf.gw && typeof sf.gw === 'object'))),
    script: surfaceChannelScript },
  { key: 'sphereRig',
    comment: [`// shared UV-sphere rig for the heat-sphere + star-surface channels (defines __uvSphereRig once).`] },
  { key: 'heatSpheres',
    comment: [`// heat-sphere channel (opt-in): stepHeatSpheres stays inert unless a heatSphereBlock is emitted.`],
    lets: `let stepHeatSpheres = () => {};`, step: `stepHeatSpheres(t);`,
    normalize: (v) => listOrNull(v, (hs) => hs && hs.radius > 0 && Array.isArray(hs.coeffs) && hs.coeffs.length),
    script: heatSphereChannelScript },
  { key: 'starSurfaces',
    comment: [`// star-surface channel (opt-in): stepStarSurfaces stays inert unless a starSurfaceBlock is emitted.`],
    lets: `let stepStarSurfaces = () => {};`, step: `stepStarSurfaces(t);`,
    normalize: (v) => listOrNull(v, (st) => st && st.radius > 0 && Number.isFinite(st.Tbase)),
    script: starSurfaceChannelScript },
  { key: 'buildups',
    comment: [`// buildup channel (opt-in): stepBuildups stays inert unless a buildupBlock is emitted.`],
    lets: `let stepBuildups = () => {};`, step: `stepBuildups(t);`,
    normalize: (v) => listOrNull(v, (bu) => bu && Array.isArray(bu.positions) && bu.positions.length >= 3),
    script: buildupChannelScript },
  { key: 'transports',
    comment: [`// transport channel (opt-in): stepTransports stays inert unless a transportBlock is emitted.`],
    lets: `let stepTransports = () => {};`, step: `stepTransports(t);`,
    normalize: (v) => listOrNull(v, (tr) => tr && Array.isArray(tr.loop) && tr.loop.length > 1 && Array.isArray(tr.vectors)),
    script: transportChannelScript },
  { key: 'deforms',
    comment: [`// deform channel (opt-in): stepDeforms stays inert unless a deformBlock is emitted.`],
    lets: `let stepDeforms = () => {};`, step: `stepDeforms(t);`,
    normalize: (v) => listOrNull(v, (d) => d && typeof d.group === 'string' && (d.to || d.basis || (Array.isArray(d.terms) && d.terms.length))),
    script: deformChannelScript },
  { key: 'signs',
    comment: [`// signage channel (opt-in): stepSigns stays inert unless a signageBlock is emitted.`],
    lets: `let stepSigns = () => {};`, step: `stepSigns(t);`,
    normalize: (v) => listOrNull(v, (s) => s && s.variant && s.anchor),
    script: signageChannelScript },
  { key: 'physics',
    comment: [`// physics channel (opt-in, LIVE): stepPhysics stays inert unless a physicsBlock is emitted.`],
    lets: `let stepPhysics = () => {};`, step: `stepPhysics(t);` },
  { key: 'actions',
    comment: [`// actions channel (opt-in, LIVE): input→impulse listeners; sets up once, no per-frame step.`] },
  { key: 'events',
    comment: [`// events channel (opt-in, LIVE): the in-world bus. stepEvents stays inert unless an eventsBlock is`,
      `// emitted; it runs AFTER stepPhysics in __mojStep so it reacts to the freshest per-step facts.`],
    lets: `let stepEvents = () => {};`, step: `stepEvents(t);` },
  { key: 'controllable',
    comment: [`// controllable channel (opt-in, LIVE): the unified control primitive. stepControllable stays inert`,
      `// and __ctrlActive false unless a controllableBlock is emitted; when active it owns the camera.`],
    lets: `let stepControllable = () => {};
let __ctrlActive = false;       // there are controllable entities to step each frame
let __ctrlOwnsCamera = false;   // a camera entity is present → drive the camera + disable OrbitControls` },
];

// normalize the uniform list channels in one sweep; bespoke channels add their blocks after.
export function normalizeRuntimeChannels(opts) {
  const lists = {}, blocks = {};
  for (const r of RUNTIME_CHANNELS) {
    if (!r.normalize) continue;
    const v = r.normalize(opts[r.key]);
    lists[r.key] = v;
    blocks[r.key] = v ? r.script(v) : '';
  }
  blocks.sphereRig = (lists.heatSpheres || lists.starSurfaces) ? sphereRigPreamble() : '';
  return { lists, blocks };
}

// the page's runtime section: comment header + inert let(s) + block, per row, in order.
export function channelRuntimeSection(blocks) {
  return RUNTIME_CHANNELS
    .map((r) => [...r.comment, ...(r.lets ? [r.lets] : []), blocks[r.key] || ''].join('\n'))
    .join('\n');
}

// the __mojStep body: every stepped row, registry order.
export function mojStepCalls() {
  return RUNTIME_CHANNELS.filter((r) => r.step).map((r) => r.step).join(' ');
}
