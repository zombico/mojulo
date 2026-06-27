/**
 * scene-three — the World renderer: emit a self-contained, TRAVERSABLE HTML page
 * that draws a baked scene with three.js (WebGL) and lets the operator move
 * through it (OrbitControls). Sibling to `emitPreserve3dScene` in scene-css3d.js;
 * both consume the SAME engine-agnostic payload from `assembleBoxCityScene`:
 *
 *   { faces, cameras, viewBox, unitScale, title, bg, sky }
 *
 * The CSS-3D emitter is the "looked at / preset-shot" Scene tier; this is the
 * "moved through" World tier (see docs split: Scene→SVG/PNG, World→live canvas).
 *
 * three.js is vendored under /public/vendor/three. Three delivery modes:
 *   • default — importmap points at the control server's /vendor/three (small page,
 *     offline-safe on the self-hosted control plane). This is how the live /world
 *     route serves it. NOT openable as a bare file:// — ES modules need an origin.
 *   • cdn:true — importmap points at a public CDN (jsdelivr) serving the SAME pinned
 *     three revision as real ES modules. Drops three's ~1MB base64 payload from the
 *     page (the rest — baked geometry + textures — stays inline, so a heavy scene is
 *     still sizeable), and opens from file:// / email / a dropped spike folder. Needs
 *     network at open time and pins to the CDN staying up. This is the mode for minted
 *     / downloadable World artifacts where file size matters.
 *   • inline:true — three.module + core + OrbitControls are read off disk and
 *     embedded as data:-URL modules in the importmap, so the page is a SELF-CONTAINED
 *     artifact that runs anywhere with NO server and NO network. Bigger (three is
 *     ~0.9MB base64). Now reserved for the headless PNG bake (renderWorldToPng feeds
 *     the page to Chromium via setContent, which has no origin to resolve /vendor or
 *     reach a CDN reliably) — kept so that bake stays fully offline.
 *
 * Lighting is already baked into the face colours, so the mesh renders UNLIT
 * (MeshBasicMaterial + vertexColors). World coords are z-up; we set camera.up=+Z
 * and feed `worldFraming` straight through with no remapping. unitScale is a
 * CSS-projection artifact and is intentionally unused here (world units are used
 * directly).
 */

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { faceListToMesh, decollideFaces, faceColorLinear, collectGlowSprites, collectShadowDecals, collectWaterMesh } from './face-mesh.js';
import { expandSurfaceCards } from './facade-card.js';
import { buildSim } from './physics-sim.js';
import { buildControllable } from './controllable-world.js';

const VENDOR_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/vendor/three');

// Server-served importmap (default): three loads from the control plane's /vendor.
const VENDOR_IMPORTMAP = JSON.stringify({
  imports: {
    three: '/vendor/three/three.module.min.js',
    'three/addons/': '/vendor/three/addons/',
  },
});

// CDN importmap (cdn:true): three loads from jsdelivr as real ES modules. Pin the
// SAME revision (r184) the page is vendored against so behaviour matches /vendor.
// three.module.min.js imports './three.core.min.js' relatively — that resolves on
// the CDN's own origin, so we only map the two bare specifiers the page imports.
const CDN_THREE_VERSION = '0.184.0'; // npm version == three r184
const CDN_IMPORTMAP = JSON.stringify({
  imports: {
    three: `https://cdn.jsdelivr.net/npm/three@${CDN_THREE_VERSION}/build/three.module.min.js`,
    'three/addons/': `https://cdn.jsdelivr.net/npm/three@${CDN_THREE_VERSION}/examples/jsm/`,
  },
});

const dataModule = (src) => `data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`;

// Self-contained importmap: read the vendored three off disk and embed each module
// as a data: URL. three.module.min.js imports './three.core.min.js' relatively — we
// rewrite that to a bare specifier the map also resolves, so the whole module graph
// (three → three-core, OrbitControls → three) lives entirely in data: URLs and runs
// with no server / no file:// CORS fetch.
function inlineImportmap() {
  const core = readFileSync(path.join(VENDOR_DIR, 'three.core.min.js'), 'utf8');
  const mod = readFileSync(path.join(VENDOR_DIR, 'three.module.min.js'), 'utf8')
    .split('./three.core.min.js').join('three-core');
  const orbit = readFileSync(path.join(VENDOR_DIR, 'addons/controls/OrbitControls.js'), 'utf8');
  return JSON.stringify({
    imports: {
      'three-core': dataModule(core),
      three: dataModule(mod),
      'three/addons/controls/OrbitControls.js': dataModule(orbit),
    },
  });
}

function b64(typedArray) {
  return Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength).toString('base64');
}

// horizontal fov (deg) + aspect → vertical fov (deg) for THREE.PerspectiveCamera
export function verticalFov(hFovDeg, aspect) {
  const h = (hFovDeg || 60) * Math.PI / 180;
  const v = 2 * Math.atan(Math.tan(h / 2) / (aspect || 1));
  return v * 180 / Math.PI;
}

// In-page script: build one shared radial-gradient sprite texture, then drop an additive
// camera-facing THREE.Sprite at each emitter. depthWrite:false so halos blend over the
// baked mesh without z-fighting; AdditiveBlending so overlapping lamps accumulate light.
function glowSpriteScript(sprites, opacity) {
  return `
// --- object-glow sprites (emitThreeWorld glow option) ---
const GLOW = ${JSON.stringify(sprites)};
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
function pickChannelScript(pickMeta) {
  return `
const PICK_META = ${JSON.stringify(pickMeta)};
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
function signageChannelScript(signs) {
  return `
const SIGNS = ${JSON.stringify(signs)};
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
function tracerChannelScript(tracers) {
  return `
const TRACERS = ${JSON.stringify(tracers)};
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
function cometChannelScript(comets) {
  return `
const COMETS = ${JSON.stringify(comets)};
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
function moverChannelScript(movers) {
  return `
const MOVERS = ${JSON.stringify(movers)};
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
// energy bars (opt-in, mechanics): KE green, PE blue, total grey — widths are value/emax. Inline-styled
// so they need no extra page CSS. Total visibly stays flat as KE↔PE trade (or sinks under friction).
function _ebars(mv, i) {
  const em = mv.emax || 1;
  const row = (lab, val, col) => '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:16px;color:' + col + '">' + lab + '</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, val / em))) + '%;background:' + col + '"></span></span>'
    + '<span style="width:46px;text-align:right;opacity:.78">' + val.toFixed(0) + ' J</span></div>';
  return '<div style="width:172px;margin-top:4px">'
    + row('KE', mv.ke[i], '#55e08a') + row('PE', mv.pe[i], '#5fa9e0') + row('E', mv.etotal[i], '#9aa3b5') + '</div>';
}
// force legend (opt-in, mechanics): a colour chip + label + live magnitude in newtons per force channel,
// so the moving free-body arrows are unambiguous. Colours come straight off each channel (three.js int).
function _flegend(mv, i) {
  return '<div style="width:172px;margin-top:4px">' + mv.forces.map((ch) => {
    const fv = ch.vecs[i], fn = Math.hypot(fv[0], fv[1], fv[2]);
    const col = '#' + ('000000' + ch.color.toString(16)).slice(-6);
    return '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
      + '<span style="width:9px;height:9px;border-radius:2px;flex:none;background:' + col + '"></span>'
      + '<span style="flex:1">' + ch.label + '</span>'
      + '<span style="opacity:.78">' + fn.toFixed(0) + ' N</span></div>';
  }).join('') + '</div>';
}
// collision system readout (opt-in, two-body): total momentum p (CONSTANT — the conservation headline),
// the live per-body velocities, the restitution e, and a KE bar that shrinks when an inelastic hit burns
// kinetic energy. Inline-styled like the energy bars.
function _collisionHud(mv, i) {
  const s = mv.system, kb = s.keBefore || 1, kn = s.keNow[i], lost = Math.max(0, s.keBefore - kn);
  const tag = s.e >= 0.999 ? ' · elastic' : (s.e <= 0.001 ? ' · perfectly inelastic' : '');
  const bar = '<div style="width:172px;margin-top:4px"><div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:16px;color:#55e08a">KE</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, kn / kb))) + '%;background:#55e08a"></span></span>'
    + '<span style="width:46px;text-align:right;opacity:.78">' + kn.toFixed(0) + ' J</span></div></div>';
  return '<span>p = ' + s.pTotal.toFixed(1) + ' kg·m/s · conserved</span>'
    + '<span class="v">v₁ = ' + s.vx1[i].toFixed(1) + ' m/s</span>'
    + '<span class="v">v₂ = ' + s.vx2[i].toFixed(1) + ' m/s</span>'
    + '<span>e = ' + s.e.toFixed(2) + tag + (lost > 0.5 ? ' · KE −' + lost.toFixed(0) + ' J' : '') + '</span>' + bar;
}
// cascade readout (opt-in, chain reaction): the population headline — neutrons currently alive, fissions
// so far vs the assembly total — counted live from the shared-clock lifetimes, so the operator watches the
// number GROW (supercritical) or die (subcritical). Inline-styled like the energy bars.
function _cascadeHud(c, alive, fiss, peak) {
  const total = c.nuclei || 1;
  const bar = (lab, val, max, col) => '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:64px;color:' + col + '">' + lab + '</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, val / max))) + '%;background:' + col + '"></span></span>'
    + '<span style="width:46px;text-align:right;opacity:.78">' + val + '</span></div>';
  return '<span>regime: ' + c.regimeLabel + '</span>'
    + '<span class="v">neutrons alive: ' + alive + '</span>'
    + '<span>' + c.note + '</span>'
    + '<div style="width:188px;margin-top:4px">'
    + bar('neutrons', alive, Math.max(1, peak), '#bcd4ff')
    + bar('fissions', fiss, total, '#e0a05a') + '</div>';
}
// comparison readout (opt-in, two-body side-by-side): names both bodies (gold A, blue B) and the time
// each takes (flight time, or pendulum period), so the race the operator is watching has its numbers.
function _compareHud(mv) {
  const c = mv.compare;
  return '<span style="color:#e0b15f">A · ' + c.labA + ' → ' + c.unitLabel + ' ' + c.ta.toFixed(2) + ' s</span>'
    + '<span style="color:#7fa8d6">B · ' + c.labB + ' → ' + c.unitLabel + ' ' + c.tb.toFixed(2) + ' s</span>'
    + '<span style="opacity:.8">' + c.note + '</span>';
}
// simple-machine WORK bars (opt-in, machines): cumulative work-in (amber) vs work-out (blue) — they track
// EQUAL in an ideal machine (force traded for distance, NOT work) — plus the friction loss (red) that opens
// the gap when η<1. Scaled to the total work-in. Inline-styled like the energy bars.
function _workbars(mv, i) {
  const m = mv.machine, wm = m.maxWork || 1, hasFric = m.efficiency < 0.999;
  const row = (lab, val, col) => '<div style="display:flex;align-items:center;gap:5px;margin-top:2px">'
    + '<span style="width:30px;color:' + col + '">' + lab + '</span>'
    + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden">'
    + '<span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, val / wm))) + '%;background:' + col + '"></span></span>'
    + '<span style="width:48px;text-align:right;opacity:.78">' + val.toFixed(0) + ' J</span></div>';
  return '<div style="width:188px;margin-top:4px">'
    + row('W_in', m.workIn[i], '#e0a05a') + row('W_out', m.workOut[i], '#5fa9e0')
    + (hasFric ? row('W_fric', m.workFriction[i], '#e0606a') : '') + '</div>';
}
// machine readout headline: mechanical advantage and the force trade (a small effort force moving a large
// load), plus the distance trade and efficiency. The work bars below show work itself is conserved.
// engine readout (steam / IC engine): the crank angle, the running speed, and the headline — a slider-crank
// converts the piston's RECIPROCATING motion into ROTARY motion; the heavy flywheel carries the crank
// through the dead-centres where the piston momentarily stops (piston speed → 0 at θ = 0° / 180°).
// flight readout (a drone TRAVERSING changing air): the current aerial condition + how the craft is
// responding (pitching into a headwind, riding a thermal, correcting a gust), plus altitude and airspeed.
function _flightHud(mv, i) {
  const f = mv.flight;
  return '<span style="color:' + (f.col[i] || '#9aa3b5') + '">condition: ' + f.condition[i] + '</span>'
    + '<span class="v">' + f.note[i] + '</span>'
    + '<span class="a">altitude ' + f.alt[i].toFixed(1) + ' m · airspeed ' + f.speed[i].toFixed(1) + ' m/s</span>'
    + '<span style="opacity:.8">the thrust vector tilts to fly the route — ΣF = ma through every gust</span>';
}
// drone readout: the WHOLE-AIRCRAFT free-body balance — total rotor lift vs weight. ΣF = ma, so it climbs
// when lift > weight, falls when lift < weight, and HOVERS (holds altitude) when they balance (Newton I).
function _droneHud(mv, i) {
  const d = mv.drone, T = d.thrust[i], W = d.weight, net = T - W;
  const state = Math.abs(net) < W * 0.02 ? 'hover · ΣF = 0' : (net > 0 ? 'climbing' : 'descending');
  return '<span style="color:#55e08a">lift ' + T.toFixed(0) + ' N vs weight ' + W.toFixed(0) + ' N</span>'
    + '<span class="v">net ' + (net >= 0 ? '+' : '') + net.toFixed(0) + ' N → ' + state + '</span>'
    + '<span class="a">' + d.rotors + ' rotors · ' + (T / d.rotors).toFixed(0) + ' N each</span>'
    + '<span style="opacity:.8">it stays up when total lift = weight (Newton II: ΣF = ma)</span>';
}
// submarine readout: the buoyancy free-body — Archimedes' buoyant force (up, fixed) vs weight (down, which
// the crew CHANGES via ballast water). Flood → W > B → dive; blow → W < B → rise; neutral → W = B → hold.
function _subHud(mv, i) {
  const s = mv.sub, B = s.buoyancy, W = s.weight[i], net = B - W;
  const state = Math.abs(net) < B * 0.02 ? 'neutral · ΣF = 0 — holds depth' : (net > 0 ? 'rising — ballast blown (W < B)' : 'diving — ballast flooded (W > B)');
  return '<span style="color:#5fd0c0">buoyancy ' + B.toFixed(0) + ' N vs weight ' + W.toFixed(0) + ' N</span>'
    + '<span class="v">net ' + (net >= 0 ? '+' : '') + net.toFixed(0) + ' N → ' + state + '</span>'
    + '<span class="a">depth ' + s.depth[i].toFixed(1) + ' m · ballast ' + (s.ballast[i] * 100).toFixed(0) + '% flooded</span>'
    + '<span style="opacity:.8">Archimedes: flood to dive, blow to rise, neutral to hover (ΣF = ma)</span>';
}
// electric-motor readout: the motor effect (a current-carrying coil in a field feels F = I L × B), the
// resulting force couple → torque → rotation, and how the commutator flips the current each half-turn so
// the torque never reverses. Static (the lesson, not a per-frame value).
function _motorHud(mv) {
  const m = mv.motor;
  if (m.type === 'ac') {   // induction motor: a rotating stator field the rotor chases but never catches (slip)
    return '<span style="color:#ffd36b">3-phase rotating magnetic field</span>'
      + '<span class="v">the rotor chases it — slip ' + m.slip + '%</span>'
      + '<span class="a">' + m.syncRpm + ' rpm field · ' + m.rotorRpm + ' rpm rotor</span>'
      + '<span style="opacity:.8">rotor current is INDUCED — no brushes, no commutator</span>';
  }
  return '<span style="color:#e0606a">motor effect: F = I L × B</span>'
    + '<span class="v">opposite forces on the two coil sides → torque</span>'
    + '<span class="a">commutator flips the current every ½ turn</span>'
    + '<span style="opacity:.8">electrical → rotational · ' + (m.note || 'brushed DC motor') + '</span>';
}
function _engineHud(mv, i) {
  const e = mv.engine, ph = e.angle[i], deg = ((ph * 180 / Math.PI) % 360 + 360) % 360;
  if (e.engine === 'inline') {   // four cylinders firing in sequence — one power stroke every half-revolution
    const gdeg = ph * 180 / Math.PI;
    const firing = e.deltas.map((d, ci) => ({ n: ci + 1, ps: ((gdeg + d) % 720 + 720) % 720 })).filter((c) => c.ps >= 360 && c.ps < 540);
    return '<span style="color:#e0606a">power stroke: cylinder ' + (firing[0] ? firing[0].n : '—') + '</span>'
      + '<span class="v">firing order ' + e.order + '</span>'
      + '<span class="a">' + e.rpm + ' rpm · 4 cylinders · even firing every 180°</span>'
      + '<span style="opacity:.8">one power stroke per ½ revolution keeps the crankshaft smooth</span>';
  }
  if (e.engine === 'four-stroke') {   // the cycle spans TWO revolutions: intake · compression · power · exhaust
    const names = ['intake', 'compression', 'power', 'exhaust'], cols = ['#5fd0c0', '#7fa8d6', '#e0606a', '#9aa3b5'];
    const s = Math.floor(((ph % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI) / Math.PI);
    const rev = ph < 2 * Math.PI ? 1 : 2;
    return '<span style="color:' + cols[s] + '">stroke: ' + names[s] + (s === 2 ? ' · BANG' : '') + '</span>'
      + '<span class="v">crank ' + deg.toFixed(0) + '° · revolution ' + rev + ' of 2</span>'
      + '<span class="a">' + e.rpm + ' rpm · 4 strokes / 2 revolutions</span>'
      + '<span style="opacity:.8">suck · squeeze · bang · blow — the cam runs at ½ crank speed</span>';
  }
  const dead = (deg < 8 || deg > 352 || Math.abs(deg - 180) < 8) ? ' · dead-centre' : '';
  return '<span>crank ' + deg.toFixed(0) + '°' + dead + '</span>'
    + '<span class="v">piston ' + mv.speed[i].toFixed(1) + ' m/s</span>'
    + '<span class="a">' + e.rpm + ' rpm · stroke ' + e.stroke.toFixed(1) + ' m</span>'
    + '<span style="opacity:.8">reciprocating ↔ rotary · flywheel carries the dead-centres</span>';
}
function _machineHud(mv) {
  const m = mv.machine;
  // compound machines: show MA MULTIPLYING through the chain (MA = MA₁ × MA₂ × … = total)
  const chain = Array.isArray(m.stages) && m.stages.length > 1
    ? m.stages.map((s) => (+s[1]).toFixed(1)).join(' × ') + ' = ' : '';
  return '<span>MA = ' + chain + m.MA_ideal.toFixed(chain ? 1 : 2) + (m.efficiency < 0.999 ? ' · actual ' + m.MA_actual.toFixed(2) : '') + '</span>'
    + '<span class="v">effort ' + m.effortForce.toFixed(0) + ' N → load ' + m.loadForce.toFixed(0) + ' N</span>'
    + '<span class="a">d_in ' + m.dIn.toFixed(1) + ' m → d_out ' + m.dOut.toFixed(1) + ' m</span>'
    + '<span style="opacity:.8">efficiency ' + (m.efficiency * 100).toFixed(0) + '% · work in = work out</span>';
}
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
function fieldChannelScript(fields) {
  return `
const FIELDS = ${JSON.stringify(fields)};
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
function physicsChannelScript(physics) {
  return `
const PHYSICS = ${JSON.stringify(physics)};
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
function actionsChannelScript(actions) {
  return `
const ACTIONS = ${JSON.stringify(actions)};
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
function controllableChannelScript(entities, camera, figures) {
  return `
const __CW = (${buildControllable.toString()})();
const __world = __CW.createWorld({ entities: ${JSON.stringify(entities)}, camera: ${JSON.stringify(camera)} });
const __FIG = ${JSON.stringify(figures || {})};   // name → packed baked figure frames (pos/col b64, origin, invScale, foot)
const __bodies = {};
// figure-frames body: re-expand a baked frame (Uint16 corners + Uint8 colour) into a BufferGeometry,
// feet planted at the body's local z=0 (FOOT subtracted) — packFigureFrames' compact encoding.
const __FTRI = [0, 1, 2, 0, 2, 3];
function __figBytes(s) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function __buildFigGeo(posB64, colB64, origin, inv, foot) {
  const q = new Uint16Array(__figBytes(posB64).buffer), col8 = __figBytes(colB64), nFace = col8.length / 3;
  const pos = new Float32Array(nFace * 6 * 3), col = new Float32Array(nFace * 6 * 3);
  let o = 0;
  for (let f = 0; f < nFace; f++) {
    const cb = f * 4 * 3, r = col8[f*3]/255, g = col8[f*3+1]/255, b = col8[f*3+2]/255;
    for (let t = 0; t < 6; t++) { const k = __FTRI[t] * 3;
      pos[o] = origin[0] + q[cb+k]*inv - foot[0]; pos[o+1] = origin[1] + q[cb+k+1]*inv - foot[1]; pos[o+2] = origin[2] + q[cb+k+2]*inv - foot[2];
      col[o] = r; col[o+1] = g; col[o+2] = b; o += 3; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
function __makeBody(e) {
  const b = e.body || {};
  if (b.type === 'figure-frames' && __FIG[b.figure]) {
    const fig = __FIG[b.figure];
    const geos = fig.pos.map((p, i) => __buildFigGeo(p, fig.col[i], fig.origin, fig.invScale, fig.foot));
    const mesh = new THREE.Mesh(geos[0], new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    const group = new THREE.Group(); group.add(mesh); scene.add(group);
    group.userData.fig = { geos, mesh, N: geos.length, yaw: b.yawOffset != null ? b.yawOffset : -Math.PI / 2 };   // figure faces +y → forward
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
function __syncEntity(e) {
  const m = __bodies[e.id]; if (!m) return;
  m.position.set(e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]);
  const fig = m.userData && m.userData.fig;
  if (fig) {
    m.rotation.set(0, 0, e.transform.heading + fig.yaw);
    const ph = ((e.gaitPhase % 1) + 1) % 1;                     // frame chosen by stride phase
    const frame = e.moving ? (Math.floor(ph * fig.N) % fig.N) : 0;
    if (fig.mesh.geometry !== fig.geos[frame]) fig.mesh.geometry = fig.geos[frame];
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
  __groundRay.set(new THREE.Vector3(pos[0], pos[1], pos[2] + 20), new THREE.Vector3(0, 0, -1));
  const own = __bodySet();
  const hits = __groundRay.intersectObjects(scene.children, true);
  for (const hit of hits) { let o = hit.object; while (o) { if (own.includes(o)) break; o = o.parent; } if (!o) return hit.point.z; }
  return null;
}
// input: keys → normalized axes, pointer-drag → look deltas (consumed each frame).
const __held = {};
window.addEventListener('keydown', (e) => { __held[e.code] = true; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', (e) => { __held[e.code] = false; });
let __lookDX = 0, __lookDY = 0, __drag = false;
renderer.domElement.addEventListener('pointerdown', () => { __drag = true; });
window.addEventListener('pointerup', () => { __drag = false; });
renderer.domElement.addEventListener('pointermove', (e) => { if (__drag) { __lookDX += e.movementX || 0; __lookDY += e.movementY || 0; } });
const __ax = (a, b) => (__held[a] ? 1 : 0) - (__held[b] ? 1 : 0);
function __readInput() {
  const inp = {
    forward: __ax('KeyW', 'KeyS') || __ax('ArrowUp', 'ArrowDown'),
    turn: __ax('KeyD', 'KeyA') || __ax('ArrowRight', 'ArrowLeft'),
    strafe: __ax('KeyE', 'KeyQ'),
    lift: __ax('Space', 'ShiftLeft') || __ax('Space', 'ShiftRight'),
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
    for (const e of __world.entities) __syncEntity(e);
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
function surfaceChannelScript(surfaces) {
  return `
const SURFACES = ${JSON.stringify(surfaces)};
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

// In-page script: the BUILDUP channel. A point cloud revealed PROGRESSIVELY over time — single
// particles accumulating into the double-slit interference pattern. The positions are pre-sorted into
// (pseudo-random) arrival order in the builder, so a growing draw-range reveals scattered dots that
// slowly resolve into fringes; a small counter shows the running hit total. Loops. Only with `buildups`.
function buildupChannelScript(buildups) {
  return `
const BUILDUPS = ${JSON.stringify(buildups)};
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
function transportChannelScript(transports) {
  return `
const TRANSPORTS = ${JSON.stringify(transports)};
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
function shadowDecalScript(decals) {
  return `
// --- shadow decals (cast / contact) ---
const SHADOWS = ${JSON.stringify(decals)};
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
function inkDecalScript(inks) {
  return `
// --- ink (crease feather) decals ---
const INKS = ${JSON.stringify(inks)};
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
function skyDomeScript(d) {
  return `
// --- world-fixed sky dome + night stars (emitThreeWorld sky option) ---
const SKY = ${JSON.stringify(d)};
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
function waterMeshScript(wm) {
  return `
// --- translucent water sheet (per-vertex alpha) ---
{
  const pos = decodeF32(${JSON.stringify(b64(wm.positions))});
  const col = decodeF32(${JSON.stringify(b64(wm.colors))});
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
function walkModeScript(cfg, center) {
  return `
// --- first-person traversal (z-up): WALK (gravity + wall collision) and FLY (free 6DOF) ---
// Two grounded-vs-free modes sharing one pointer-lock look. WALK raycasts the real geometry
// (no separate collider data): straight down for the floor underfoot (stairs/terrain/voids all
// just work) and ahead for walls. FLY ignores both — W follows the full aim, Space/Shift fly z.
const WALK = ${JSON.stringify(cfg)};
const WALK_CENTER = ${JSON.stringify(center)};
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

/**
 * Emit a traversable three.js World page.
 * @param {object} payload  { faces, cameras, viewBox, title, bg, sky, glow }
 *   glow: object-glow halos for emissive-fixture faces (the World's counterpart to the
 *   CSS path's box-shadow). `true` (default) | `false` | `{ opacity, scale }`. No-op for
 *   scenes without `glow`-tagged faces (e.g. day scenes — the sun ships `fixture:false`).
 */
// A full-screen RAYMARCHER World: a fragment shader (e.g. a GR geodesic integrator for a black hole)
// rendered on a screen quad, with the orbit camera's position + basis fed in as uniforms each frame so
// the shader casts rays from wherever the user has dragged the camera. A separate, minimal emitter —
// the mesh pipeline (groups, picks, channels) is irrelevant here. Reuses the importmap + .moj-readout.
function emitRaymarchWorld({ frag, customUniforms = {}, cameraStart = [0, 3, 17], target = [0, 0, 0], fov = 46, readout = [], steps = [], viewBox = { width: 1120, height: 780 }, title = 'mojulo world', bg = '#01010a', inline = false, cdn = false } = {}) {
  const W = viewBox.width, H = viewBox.height;
  const importmap = cdn ? CDN_IMPORTMAP : inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  const cu = Object.entries(customUniforms).map(([k, v]) => `${k}:{value:${Array.isArray(v) ? `new THREE.Vector3(${v.join(',')})` : (+v)}}`).join(',');
  const VERT = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';
  // Optional STEPPER (gallery): a prev/next bar that swaps the shader's uniforms + readout between a
  // list of presets — one model per step (e.g. a planet gallery). Same shader, different uniform sets.
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const roHtml = hasSteps
    ? `<div class="moj-stepper"><button id="mojPrev">◀</button><span id="mojLbl"></span><button id="mojNext">▶</button></div><div class="moj-readout" id="mojRo"></div>`
    : ((Array.isArray(readout) && readout.length) ? `<div class="moj-readout">${readout.map((s, i) => i === 0 ? `<b>${s}</b>` : `<span>${s}</span>`).join('')}</div>` : '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>
  :root{color-scheme:dark} body{margin:0;background:${bg};color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%}
  .hint{position:absolute;right:8px;bottom:8px;color:#6f86ad;font-size:11px;user-select:none}
  .moj-readout{position:absolute;left:8px;bottom:8px;background:rgba(4,7,16,.74);border:1px solid #24324a;border-radius:6px;padding:7px 10px;font-size:12px;color:#cfe3ff;display:flex;flex-direction:column;gap:2px;pointer-events:none;z-index:4;max-width:60%}
  .moj-readout b{color:#fff;margin-bottom:2px}
  .moj-stepper{position:absolute;left:50%;top:8px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:rgba(4,7,16,.78);border:1px solid #24324a;border-radius:8px;padding:5px 10px;font-size:13px;color:#cfe3ff;z-index:5}
  .moj-stepper button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:5px;padding:3px 10px;cursor:pointer;font:inherit}
  .moj-stepper span{min-width:128px;text-align:center;font-variant-numeric:tabular-nums}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>${roHtml}<div class="hint">drag to orbit · scroll to zoom</div></div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const wrap = document.getElementById('wrap'), canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(${fov}, ${W / H}, 0.1, 2000);
cam.position.set(${cameraStart[0]}, ${cameraStart[1]}, ${cameraStart[2]});
const controls = new OrbitControls(cam, canvas);
controls.target.set(${target[0]}, ${target[1]}, ${target[2]});
controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 120; controls.update();
const uniforms = { uCamPos:{value:new THREE.Vector3()}, uCamBasis:{value:new THREE.Matrix3()}, uRes:{value:new THREE.Vector2()}, uTime:{value:0}, uFov:{value:${fov} * Math.PI / 180}, ${cu} };
const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: ${JSON.stringify(VERT)}, fragmentShader: ${JSON.stringify(frag)} });
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
const STEPS = ${hasSteps ? JSON.stringify(steps) : '[]'};
if (STEPS.length) {
  const roEl = document.getElementById('mojRo'), lblEl = document.getElementById('mojLbl');
  let si = 0;
  const applyStep = (i) => {
    si = ((i % STEPS.length) + STEPS.length) % STEPS.length;
    const u = STEPS[si].uniforms || {};
    for (const k in u) { if (!uniforms[k]) continue; const v = u[k]; if (Array.isArray(v)) uniforms[k].value.set(v[0], v[1], v[2]); else uniforms[k].value = v; }
    const r = STEPS[si].readout || [];
    roEl.innerHTML = r.map((s, j) => j === 0 ? '<b>' + s + '</b>' : '<span>' + s + '</span>').join('');
    lblEl.textContent = (si + 1) + ' / ' + STEPS.length + '  ·  ' + (STEPS[si].label || '');
  };
  document.getElementById('mojPrev').onclick = () => applyStep(si - 1);
  document.getElementById('mojNext').onclick = () => applyStep(si + 1);
  window.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') applyStep(si - 1); else if (e.key === 'ArrowRight') applyStep(si + 1); });
  applyStep(0);
}
const blitCam = new THREE.Camera();
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
function resize(){ const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h, false); const dpr = renderer.getPixelRatio(); uniforms.uRes.value.set(w * dpr, h * dpr); }
window.addEventListener('resize', resize); resize();
renderer.setAnimationLoop((t) => {
  controls.update();
  cam.getWorldDirection(_f);
  _r.crossVectors(_f, cam.up).normalize();
  _u.crossVectors(_r, _f).normalize();
  uniforms.uCamBasis.value.set(_r.x, _u.x, _f.x, _r.y, _u.y, _f.y, _r.z, _u.z, _f.z);   // columns = right, up, forward
  uniforms.uCamPos.value.copy(cam.position);
  uniforms.uTime.value = t / 1000;
  renderer.render(scene, blitCam);
});
</script>
</body></html>`;
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
function deformChannelScript(deforms) {
  return `
const DEFORMS = ${JSON.stringify(deforms)};
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

export function emitThreeWorld({ faces = [], cameras = [], viewBox = { width: 1120, height: 780 }, title = 'mojulo world', bg = '#0e1014', inline = false, cdn = false, glow = true, light = null, sky = null, textures = {}, wireframe = false, walk = false, picks = [], tracers = [], movers = [], comets = [], fields = [], surfaces = [], buildups = [], transports = [], deforms = [], raymarch = null, decollide = true, capture = false, signs = [], physics = null, actions = [], entities = [], camera = null, figures = {} } = {}) {
  // Raymarch mode (black-hole-view): a full-screen GR geodesic fragment shader replaces the mesh
  // pipeline entirely. The mesh channels can't bend light; this can. Same /world funnel.
  if (raymarch && raymarch.frag) return emitRaymarchWorld({ ...raymarch, viewBox, title, bg, inline, cdn });
  const W = viewBox.width, H = viewBox.height;
  const aspect = W / H;
  const importmap = cdn ? CDN_IMPORTMAP : inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  // `light` lets facade frame-bars self-shade their return cheeks (concrete/brick mass);
  // null is safe — the realizer falls back to a fixed asymmetry.
  // Water faces are pulled out up front: they render in their own translucent pass (per-vertex
  // alpha), never in the opaque mesh. They're plain quads, so they skip surface-card expansion.
  const waterRaw = faces.filter((f) => f && f.water);
  // De-collide ONCE over the whole opaque face set (z-fight fix). Done here — not inside each
  // group's bake — so coincident faces that land in DIFFERENT render groups (separate draw calls,
  // the worst z-fight case) are also lifted apart. Groups below then bake with decollide:false.
  const expanded0 = expandSurfaceCards(faces.filter((f) => !(f && f.water)), { light });
  const expanded = decollide ? decollideFaces(expanded0) : expanded0;
  const mesh = faceListToMesh(expanded, { decollide: false }); // global bound for the camera-framing fallback

  // Render groups: faces carrying a `group` (shell walls/ceiling/floor) become individually
  // toggleable sub-meshes; everything else collapses into one 'static' mesh. This is what
  // lets the World hide walls at runtime (immersive room cutaway). City/figure scenes ship
  // no `group`, so they render as a single mesh exactly as before. A hideable group needs a
  // `normal` (inward, toward room centre) on its faces to drive camera-facing auto-hide.
  const groupMap = new Map();
  // `decal:'shadow'` faces render ONLY in the shadow-decal pass, and `water` faces ONLY in the
  // translucent water pass below — keep both out of the opaque mesh (shadows would double as flat
  // dark patches; water needs per-vertex alpha the opaque mesh can't carry).
  for (const f of expanded) { if (f.decal === 'shadow' || f.decal === 'ink' || f.water) continue; const k = f.group || 'static'; (groupMap.get(k) || groupMap.set(k, []).get(k)).push(f); }
  const groups = [...groupMap].map(([name, fs]) => {
    const gm = faceListToMesh(fs, { decollide: false }); // already de-collided globally above
    const nf = fs.find((f) => Array.isArray(f.normal));
    const hideable = name.startsWith('shell:') && !name.endsWith('floor') && !!nf;
    // a group whose faces ask for it renders as a see-through edge cage (x-ray walls)
    const wireframe = fs.some((f) => f.wireframe);
    // textured sub-groups (label wraps): one { key, pos, uv } per texture, rendered as a
    // MeshBasicMaterial({ map }). Empty for every existing scene → no behavior change.
    const tex = Object.entries(gm.textureGroups || {}).map(([key, g]) => ({ key, pos: b64(g.positions), uv: b64(g.uvs), col: b64(g.colors), lit: !!g.lit }));
    // per-group translucency (cellular-view jelly + organelles): a face-level `alpha` < 1 turns
    // the whole group into a transparent mesh. null/absent → opaque, unchanged for every existing
    // scene. Stays a real group mesh (raycastable for picks, togglable to wireframe).
    const af = fs.find((f) => typeof f.alpha === 'number' && f.alpha < 1);
    const alpha = af ? af.alpha : null;
    return { name, pos: b64(gm.positions), col: b64(gm.colors), center: gm.center, normal: nf ? nf.normal : null, hideable, wireframe, tex, alpha };
  });
  const hasTextures = groups.some((g) => g.tex.length);

  // Object-glow: one camera-facing additive sprite per emissive-fixture face. Driven by
  // the SAME `glow` markers the baked face list already carries (see collectGlowSprites).
  const glowCfg = glow && typeof glow === 'object' ? glow : {};
  const sprites = glow ? collectGlowSprites(faces, { scale: glowCfg.scale ?? 1 }) : [];
  const glowBlock = sprites.length ? glowSpriteScript(sprites, glowCfg.opacity ?? 0.95) : '';

  // Shadow decals: the CSS-3D cast/contact shadows, realized as flat dark ground quads.
  const decals = collectShadowDecals(faces);
  const shadowBlock = decals.length ? shadowDecalScript(decals) : '';

  // Crease "ink" feather decals: faces tagged decal:'ink' (corner order [crease0,crease1,
  // outer1,outer0]) → directional soft contact-shadow bands. No existing scene emits them.
  const inks = faces.filter((f) => f.decal === 'ink' && Array.isArray(f.corners) && f.corners.length >= 4)
    .map((f) => ({ quad: f.corners.slice(0, 4), alpha: f.inkAlpha ?? 0.85, color: f.inkColor || [0, 0, 0] }));
  const inkBlock = inks.length ? inkDecalScript(inks) : '';

  // Translucent water: a separate mesh with per-vertex alpha (shallows clear, deeps opaque).
  const waterMesh = waterRaw.length ? collectWaterMesh(waterRaw) : null;
  const waterBlock = waterMesh ? waterMeshScript(waterMesh) : '';

  // Sky dome: a world-fixed gradient sphere (+ night stars + a phase-carved moon) centred on the
  // scene, so ORBITING reveals the gradient/stars/moon from new angles (they move with the world,
  // not glued to the viewport). Only the painted-landscape terrain ships the explicit
  // { zenith, horizon } sky shape; box-world preset skies carry no zenith array and are
  // skipped (their World keeps the solid bg) — so this is additive + safe for every kind.
  // Two sky shapes funnel through skyDomeScript: the ATMOSPHERE sky (a { zenith, horizon }
  // gradient dome + upper-biased night stars — painted-landscape) and the SPACE sky
  // (`space:true` — no gradient dome, a uniform FULL-sphere starfield always on, void bg —
  // the planetary body in a celestial sphere). Box-world preset skies carry neither flag and
  // are skipped (their World keeps the solid bg) — so this stays additive + safe for every kind.
  const skyDome = sky && (sky.space || (Array.isArray(sky.zenith) && Array.isArray(sky.horizon)))
    ? { space: !!sky.space, zenith: sky.zenith || [], horizon: sky.horizon || [],
      day: Number.isFinite(sky.day) ? sky.day : (sky.space ? 0 : 1),
      stars: Number.isFinite(sky.stars) ? sky.stars : (sky.space ? 1 : 0), seed: (sky.seed >>> 0) || 1,
      // a moon makes no sense pinned on a planet's own celestial sphere → space drops it; the sun
      // rides through (space suns carry a 3D `dir`, horizon suns a front-sky { u, h }).
      moon: sky.space ? null : (sky.moon || null), sun: sky.sun || null,
      // a scene may PIN the celestial-sphere centre/radius (e.g. planetary, so a far companion
      // body can't drag the bounds centroid — and the star sphere + sun direction — off the body);
      // otherwise fall back to the geometry bounds, unchanged for every existing scene.
      center: Array.isArray(sky.center) ? sky.center : mesh.center,
      radius: Number.isFinite(sky.radius) ? sky.radius : (mesh.radius || 20) }
    : null;
  const skyBlock = skyDome ? skyDomeScript(skyDome) : '';

  // Cameras → traversal bookmarks. Fall back to a 3/4 orbit framing of the
  // geometry's bounding sphere when a world ships no worldFraming camera.
  const cams = (cameras.length ? cameras : [null]).map((cam, i) => {
    const wf = cam && cam.worldFraming;
    if (wf && Array.isArray(wf.cameraPosition) && Array.isArray(wf.lookAt)) {
      return { name: cam.name || `view ${i}`, pos: wf.cameraPosition, target: wf.lookAt, vfov: verticalFov(wf.horizontalFov, aspect) };
    }
    const [cx, cy, cz] = mesh.center;
    const r = mesh.radius || 20;
    return { name: 'orbit', pos: [cx + r * 1.1, cy - r * 1.1, cz + r * 0.8], target: [cx, cy, cz], vfov: verticalFov(55, aspect) };
  });

  // Opt-in first-person free-traverse. Defaults derive off the mesh bounds so a bare
  // `walk:true` works in ANY World; callers may pass `{ speed, spawn:[x,y,z] }` or the legacy
  // `{ eye, spawn:[x,y] }` (eye → spawn z). Speed scales with world radius (a room and a city
  // both feel right). Spawn z falls back to the centroid height — a safe see-everything vantage
  // the operator flies down from with Shift.
  const wk = walk && typeof walk === 'object' ? walk : {};
  const walkZ = Number.isFinite(wk.eye) ? wk.eye : mesh.center[2];
  const walkXY = Array.isArray(wk.spawn) ? wk.spawn : [mesh.center[0], mesh.center[1]];
  const wkSpeed = Number.isFinite(wk.speed) ? wk.speed : Math.max(6, (mesh.radius || 20) * 0.4);
  // WALK-mode physics scale off the world: player half-width for wall collision, gravity/jump off
  // speed so a room and a city both feel right, a floor under derived eye-height. All overridable.
  const wkRadius = Number.isFinite(wk.radius) ? wk.radius : Math.max(0.3, (mesh.radius || 20) * 0.012);
  const walkCfg = walk ? {
    speed: wkSpeed,
    spawn: [walkXY[0], walkXY[1], Number.isFinite(walkXY[2]) ? walkXY[2] : walkZ],
    radius: wkRadius,
    minEye: Number.isFinite(wk.minEye) ? wk.minEye : Math.max(1, wkRadius * 2.5),
    gravity: Number.isFinite(wk.gravity) ? wk.gravity : wkSpeed * 2.5,
    jump: Number.isFinite(wk.jump) ? wk.jump : wkSpeed * 1.3,
    // opt-in FPV head-bob: a baked gait-camera curve (gait-camera.js `gaitCameraCurve`)
    // riding the WALK eye. null → the rigid-eye walk, byte-for-byte unchanged.
    bob: wk.bob && Array.isArray(wk.bob.curve) ? wk.bob : null,
  } : null;
  const walkBlock = walkCfg ? walkModeScript(walkCfg, mesh.center) : '';
  const hintText = walkCfg
    ? 'drag to orbit · <b>walk</b> = gravity + walls · <b>fly</b> = free 6DOF'
    : 'drag to orbit · scroll to zoom · right-drag to pan';

  // Pick channel (opt-in, additive): a name → metadata map keyed by group name, raised as a DOM
  // popup when the operator CLICKS the matching sub-mesh (an atom/bond, etc.). Empty `picks` →
  // no PICK_META, no handler, no overlay — every existing World is byte-for-byte unchanged.
  const pickMeta = {};
  for (const p of (Array.isArray(picks) ? picks : [])) { if (p && p.name) pickMeta[p.name] = p; }
  const hasPicks = Object.keys(pickMeta).length > 0;
  const pickBlock = hasPicks ? pickChannelScript(pickMeta) : '';

  // Tracer channel (opt-in, additive): glowing markers that travel along a path each frame (e.g. an
  // electron tracing an orbital's wave-path). Empty `tracers` → no block, default loop unchanged.
  const tracerList = (Array.isArray(tracers) ? tracers : []).filter((tr) => tr && Array.isArray(tr.path) && tr.path.length > 1);
  const tracerBlock = tracerList.length ? tracerChannelScript(tracerList) : '';

  // Mover channel (opt-in, additive): solid bodies translating along an equal-dt path (mechanics-view).
  // Empty `movers` → no block, default loop unchanged.
  const moverList = (Array.isArray(movers) ? movers : []).filter((mv) => mv && (mv.spin || mv.turn || mv.link || mv.pose || mv.fill || mv.pulse || mv.flash || mv.cascade || (Array.isArray(mv.path) && mv.path.length > 1)));
  const moverBlock = moverList.length ? moverChannelScript(moverList) : '';

  // Comet channel (opt-in, additive): a comet on an equal-dt Kepler path that grows a coma + anti-solar
  // ion tail + curved dust tail, recomputed every frame relative to the Sun (comet-view). Empty
  // `comets` → no block, default loop unchanged.
  const cometList = (Array.isArray(comets) ? comets : []).filter((cm) => cm && Array.isArray(cm.path) && cm.path.length > 1);
  const cometBlock = cometList.length ? cometChannelScript(cometList) : '';

  // Field channel (opt-in, additive): a lattice of vector arrows over space (field-view — EM waves,
  // magnetism). Empty `fields` → no block, default loop unchanged.
  const fieldList = (Array.isArray(fields) ? fields : []).filter((fd) => fd && (Array.isArray(fd.sets) || Array.isArray(fd.lines)));
  const fieldBlock = fieldList.length ? fieldChannelScript(fieldList) : '';

  // Surface channel (opt-in, additive): a grid mesh deformed per frame by a Gerstner waveform sequence
  // (ocean-view). Empty `surfaces` → no block, default loop unchanged.
  const surfaceList = (Array.isArray(surfaces) ? surfaces : []).filter((sf) => sf && sf.grid && (Array.isArray(sf.waves) || Array.isArray(sf.sources) || (sf.gw && typeof sf.gw === 'object')));
  const surfaceBlock = surfaceList.length ? surfaceChannelScript(surfaceList) : '';

  // Buildup channel (opt-in, additive): progressive reveal of a point cloud over time (single-photon
  // accumulation into the double-slit pattern). Empty `buildups` → no block.
  const buildupList = (Array.isArray(buildups) ? buildups : []).filter((bu) => bu && Array.isArray(bu.positions) && bu.positions.length >= 3);
  const buildupBlock = buildupList.length ? buildupChannelScript(buildupList) : '';

  // Transport channel (opt-in, additive): an arrow parallel-transported around a loop on a surface
  // (parallel-transport-view). Empty `transports` → no block, default loop unchanged.
  const transportList = (Array.isArray(transports) ? transports : []).filter((tr) => tr && Array.isArray(tr.loop) && tr.loop.length > 1 && Array.isArray(tr.vectors));
  const transportBlock = transportList.length ? transportChannelScript(transportList) : '';

  // Deform channel (opt-in, additive): a time-varying linear map on a named face group (shear / off-axis
  // stretch / collapse a TRS mover can't do). Empty `deforms` → no block, default loop unchanged.
  const deformList = (Array.isArray(deforms) ? deforms : []).filter((d) => d && typeof d.group === 'string' && (d.to || d.basis || (Array.isArray(d.terms) && d.terms.length)));
  const deformBlock = deformList.length ? deformChannelScript(deformList) : '';

  // adaptive-signage channel (opt-in, additive): a DOM overlay of billboarded notes. Empty `signs`
  // → no overlay, no CSS, no block — every existing World is byte-for-byte unchanged.
  const signList = (Array.isArray(signs) ? signs : []).filter((s) => s && s.variant && s.anchor);
  const hasSigns = signList.length > 0;
  const signageBlock = hasSigns ? signageChannelScript(signList) : '';

  // physics channel (opt-in, LIVE): the actions-world simulated-matter substrate. Empty / absent
  // `physics.bodies` → no block, default loop unchanged. This is the only NON-deterministic channel:
  // it runs the integrator live rather than replaying a baked path (actions-world.plan.md).
  const hasPhysics = physics && Array.isArray(physics.bodies) && physics.bodies.length > 0;
  const physicsBlock = hasPhysics ? physicsChannelScript(physics) : '';

  // actions channel (opt-in, LIVE): input → impulse on a physics body. Requires the physics channel,
  // so it is gated on hasPhysics; absent / empty `actions` → no block.
  const actionList = (Array.isArray(actions) ? actions : []).filter((a) => a && a.do);
  const actionsBlock = hasPhysics && actionList.length ? actionsChannelScript(actionList) : '';

  // controllable channel (opt-in, LIVE): the unified control primitive. Present when the manifest
  // carries `entities` (or a `camera` spec). When it owns a camera entity it disables OrbitControls.
  const entityList = (Array.isArray(entities) ? entities : []).filter((e) => e && (e.rule || e.body || e.isCamera));
  const hasControllable = entityList.length > 0 || (camera && camera.rule);
  // pack any `figure-frames` bodies once (Uint16 corners + Uint8 colour, feet planted at z=0) — the
  // packFigureFrames' compact encoding (Uint16 corners + Uint8 colour), shared with the SVG figure path.
  const packedFigures = {};
  for (const [name, frames] of Object.entries(figures || {})) {
    if (!Array.isArray(frames) || !frames.length) continue;
    const pk = packFigureFrames(frames);
    const foot = [pk.center[0], pk.center[1], pk.origin[2]];
    const figH = 2 * (pk.center[2] - pk.origin[2]) || pk.radius * 1.2;
    packedFigures[name] = { pos: pk.pos, col: pk.col, origin: pk.origin, invScale: pk.invScale, foot, figH };
  }
  const controllableBlock = hasControllable ? controllableChannelScript(entityList, camera, packedFigures) : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%}
  .hud{position:absolute;left:8px;top:8px;display:flex;gap:6px;flex-wrap:wrap}
  .hud button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  .hud button.on{background:#1b2740;color:#fff}
  .hud button.off{opacity:.45;text-decoration:line-through}
  .hint{position:absolute;right:8px;bottom:8px;color:#6f86ad;font-size:11px;user-select:none}
  .moj-readout{position:absolute;left:8px;bottom:8px;background:rgba(11,18,32,.82);border:1px solid #24324a;border-radius:6px;padding:7px 10px;font-size:12px;color:#cfe3ff;display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums;pointer-events:none;z-index:4}
  .moj-readout b{color:#fff;margin-bottom:2px}
  .moj-readout .v{color:#7ee2a6}
  .moj-readout .a{color:#ff9b80}
  .mol-popup{position:absolute;min-width:120px;max-width:240px;background:rgba(11,18,32,.93);border:1px solid #2c3e5c;border-radius:7px;padding:8px 10px;font-size:12px;color:#cfe3ff;pointer-events:none;box-shadow:0 6px 22px rgba(0,0,0,.45);z-index:5}
  .mol-popup .pk-label{font-weight:600;color:#fff;margin-bottom:4px}
  .mol-popup .pk-row{display:flex;justify-content:space-between;gap:12px;line-height:1.5}
  .mol-popup .pk-row .pk-k{color:#7f9bc4}${hasSigns ? `
  .moj-signs{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6}
  .moj-sign{position:absolute;pointer-events:auto;max-width:240px;box-sizing:border-box;line-height:1.4;transition:opacity .18s ease}
  .moj-sign--popup{width:210px}
  .moj-sign-track.moj-sign--popup,.moj-sign-track.moj-sign--toast,.moj-sign-pt.moj-sign--popup,.moj-sign-pt.moj-sign--toast{transform:translate(-50%,calc(-100% - 10px))}
  .moj-sign-track.moj-sign--tooltip,.moj-sign-pt.moj-sign--tooltip{transform:translate(-50%,-50%)}
  .moj-slot-top{left:50%;top:12px;transform:translateX(-50%)}
  .moj-slot-top-left{left:12px;top:12px}.moj-slot-top-right{right:12px;top:12px}
  .moj-slot-center{left:50%;top:50%;transform:translate(-50%,-50%)}
  .moj-slot-bottom{left:50%;bottom:12px;transform:translateX(-50%)}
  .moj-slot-bottom-left{left:12px;bottom:12px}.moj-slot-bottom-right{right:12px;bottom:12px}
  .moj-sign--toast{opacity:0;text-align:center}.moj-sign--toast.show{opacity:1}
  .moj-sign--tooltip{cursor:pointer}
  .moj-dot{display:block;width:11px;height:11px;border-radius:50%;box-shadow:0 0 8px rgba(0,0,0,.4)}
  .moj-tip{position:absolute;left:50%;bottom:calc(100% + 7px);transform:translateX(-50%);white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s ease}
  .moj-sign--tooltip:hover .moj-tip,.moj-sign--tooltip:focus .moj-tip,.moj-sign--tooltip.tapped .moj-tip{opacity:1}
  .moj-pages{overflow:hidden}.moj-pg{display:none}.moj-pg.on{display:block}
  .moj-pg-down{margin-top:6px;color:inherit;background:rgba(255,255,255,.12);border:none;border-radius:5px;padding:2px 8px;cursor:pointer;font:inherit}` : ''}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>
    <div class="hud" id="hud"></div>
    <div class="hint">${hintText}</div>
    ${hasPicks ? '<div class="mol-popup" id="molPopup" hidden></div>' : ''}
    ${hasSigns ? '<div class="moj-signs" id="mojSigns"></div>' : ''}
  </div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GROUPS = ${JSON.stringify(groups)};
const CAMS = ${JSON.stringify(cams)};
const BG = ${JSON.stringify(bg)};
const TEXTURES = ${hasTextures ? JSON.stringify(textures) : '{}'};
const WIREFRAME0 = ${wireframe ? 'true' : 'false'};   // start in construction-wireframe mode?
function decodeF32(s){ const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Float32Array(u.buffer); }

const wrap = document.getElementById('wrap'), canvas = document.getElementById('c'), hud = document.getElementById('hud');
// logarithmicDepthBuffer: the world camera spans near 0.05 → far 8000 (close interiors
// up to whole cities), and proud "decal" faces (arched windows/iwans, signage, balconies)
// sit only a few cm in front of their wall. A linear depth buffer starves that gap of
// precision and the decals z-fight (shimmer). The log buffer restores precision across
// the range so the proud faces win cleanly from any orbit distance.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

// One mesh per render group. Hideable groups (walls/ceiling) get a transparent material so
// they can fade; static groups (furniture, floor, whole cities) stay opaque.
const meshes = {}, hideable = [], solids = [], xrayGroups = [];   // solids: every opaque fill mesh, for the wireframe toggle
for (const grp of GROUPS) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(grp.pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(decodeF32(grp.col), 3));
  geo.computeBoundingSphere();
  const translucent = typeof grp.alpha === 'number' && grp.alpha < 1;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: grp.hideable || translucent, opacity: translucent ? grp.alpha : 1, depthWrite: !translucent });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = (grp.hideable || translucent) ? 1 : 0;
  m.userData.g = grp.name;   // group name → pick lookup (PICK_META); inert when no picks emitted
  scene.add(m); meshes[grp.name] = m;
  if (grp.hideable) hideable.push(grp);
  // X-ray group (outer walls): render an EdgesGeometry cage you can see through, with
  // the solid fill hidden by default. The 'x-ray' HUD button flips between the two.
  // Kept OUT of the solids set so the global wireframe toggle manages it via xrayGroups only.
  if (grp.wireframe) {
    const cage = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: 0x9fc0ea }));
    cage.renderOrder = 2; scene.add(cage);
    m.visible = false;
    xrayGroups.push({ name: grp.name, fill: m, cage, on: true });
  } else { solids.push(m); }
  // textured label-wrap sub-meshes: a MeshBasicMaterial({ map }) per texture key (the can/box label).
  for (const t of (grp.tex || [])) {
    const url = TEXTURES[t.key]; if (!url) continue;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(decodeF32(t.pos), 3));
    tg.setAttribute('uv', new THREE.BufferAttribute(decodeF32(t.uv), 2));
    // MULTIPLY-lit textures (textureLit faces, e.g. asphalt roads/ground) carry the baked
    // per-vertex colour so the GPU does texel * bakedLight. lit ONLY controls that multiply;
    // biaxial RepeatWrapping is set for every textured face so a small tile repeats across a
    // large quad on both axes (label wraps keep V in [0,1], so wrapT is a no-op for them).
    if (t.lit) tg.setAttribute('color', new THREE.BufferAttribute(decodeF32(t.col), 3));
    tg.computeBoundingSphere();
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
    const tm = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ map: tex, vertexColors: !!t.lit, side: THREE.DoubleSide }));
    tm.renderOrder = 0.6; // over the form, under additive glow
    scene.add(tm); solids.push(tm);
  }
}

const camera = new THREE.PerspectiveCamera(CAMS[0].vfov, wrap.clientWidth / wrap.clientHeight, 0.1, 8000);
camera.up.set(0, 0, 1); // world is z-up
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

function applyCam(i){
  const c = CAMS[i];
  camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
  controls.target.set(c.target[0], c.target[1], c.target[2]);
  camera.fov = c.vfov; camera.updateProjectionMatrix();
  controls.update();
  [...hud.children].forEach((b, k) => b.classList.toggle('on', k === i));
}
CAMS.forEach((c, i) => { const b = document.createElement('button'); b.textContent = c.name; b.onclick = () => applyCam(i); hud.appendChild(b); });

// Wireframe (construction) mode: hide the lit fills, show feature-edge lines built per group with
// EdgesGeometry — coplanar quad diagonals are dropped (a clean ring/profile cage, not triangle
// soup), and interpenetration / floating monomers that flat shading hides read straight off the
// edges. The edge meshes are built lazily on first toggle (no cost / no perf hit for worlds never
// switched to wire). Available in every World; it's the workbench object study that leans on it.
let wireframeOn = false, wiresBuilt = false; const wires = [];
const wireBtn = document.createElement('button'); wireBtn.textContent = 'wireframe';
function buildWires() {
  for (const s of solids) {
    const w = new THREE.LineSegments(new THREE.EdgesGeometry(s.geometry, 1), new THREE.LineBasicMaterial({ color: 0xa9c7ee }));
    w.renderOrder = 2; scene.add(w); wires.push(w);
  }
  wiresBuilt = true;
}
function setWireframe(on) {
  wireframeOn = on;
  if (on && !wiresBuilt) buildWires();
  for (const s of solids) s.visible = !on;
  for (const w of wires) w.visible = on;
  // x-ray fill stays hidden when EITHER global wireframe or x-ray is on; cage shows for either
  for (const g of xrayGroups) { g.fill.visible = !on && !g.on; g.cage.visible = on || g.on; }
  wireBtn.classList.toggle('on', on);
}
wireBtn.onclick = () => setWireframe(!wireframeOn);
hud.appendChild(wireBtn);

// X-ray outer walls: flip the envelope between a see-through edge cage and solid fill.
if (xrayGroups.length) {
  const xb = document.createElement('button'); xb.textContent = 'x-ray'; xb.classList.add('on');
  xb.onclick = () => {
    const on = !xrayGroups[0].on;
    for (const g of xrayGroups) { g.on = on; g.fill.visible = !on && !wireframeOn; g.cage.visible = on || wireframeOn; }
    xb.classList.toggle('on', on);
  };
  hud.appendChild(xb);
}

// Immersive room cutaway: per-wall toggles + auto-hide (hide a wall once the camera sits on
// its outward side, i.e. between camera and room). No hideable groups (city/figure) → no UI.
let autoCut = true; const manualHidden = new Set();
if (hideable.length) {
  const sep = document.createElement('span'); sep.textContent = 'walls:'; sep.style.cssText = 'align-self:center;opacity:.5;margin-left:6px'; hud.appendChild(sep);
  const ab = document.createElement('button'); ab.textContent = 'auto'; ab.classList.add('on');
  ab.onclick = () => { autoCut = !autoCut; ab.classList.toggle('on', autoCut); };
  hud.appendChild(ab);
  for (const grp of hideable) {
    const b = document.createElement('button');
    b.textContent = grp.name.replace('shell:', '').replace('Wall', '').replace('ceiling', 'roof');
    b.onclick = () => { manualHidden.has(grp.name) ? manualHidden.delete(grp.name) : manualHidden.add(grp.name); b.classList.toggle('off', manualHidden.has(grp.name)); };
    hud.appendChild(b);
  }
}
function updateCutaway() {
  for (const grp of hideable) {
    const m = meshes[grp.name], n = grp.normal;
    const dx = camera.position.x - grp.center[0], dy = camera.position.y - grp.center[1], dz = camera.position.z - grp.center[2];
    const camOutside = -(dx * n[0] + dy * n[1] + dz * n[2]) > 0; // camera on the wall's outward side
    const target = autoCut ? (camOutside ? 0 : 1) : (manualHidden.has(grp.name) ? 0 : 1);
    m.material.opacity += (target - m.material.opacity) * 0.18;
    m.visible = !wireframeOn && m.material.opacity > 0.02;   // wireframe owns fill visibility
  }
}

function resize(){
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
applyCam(0);
if (WIREFRAME0) setWireframe(true);   // deep-link / baked still can open straight in wire
${skyBlock}
${waterBlock}
${shadowBlock}
${inkBlock}
${glowBlock}
${pickBlock}
// walk mode (opt-in) overrides orbit per-frame. walkOn/stepWalk stay inert (orbit-only) when
// no walkBlock is emitted, so the default World loop is unchanged. dt off setAnimationLoop's
// time arg (clamped) — no Date.now, and stable across frame-rate.
let walkPrevT = 0, walkOn = false, stepWalk = () => {};
${walkBlock}
// tracer channel (opt-in): stepTracers stays inert unless a tracerBlock is emitted.
let stepTracers = () => {};
${tracerBlock}
// mover channel (opt-in): stepMovers stays inert unless a moverBlock is emitted.
let stepMovers = () => {};
${moverBlock}
// comet channel (opt-in): stepComets stays inert unless a cometBlock is emitted.
let stepComets = () => {};
${cometBlock}
// field channel (opt-in): stepFields stays inert unless a fieldBlock is emitted.
let stepFields = () => {};
${fieldBlock}
// surface channel (opt-in): stepSurfaces stays inert unless a surfaceBlock is emitted.
let stepSurfaces = () => {};
${surfaceBlock}
// buildup channel (opt-in): stepBuildups stays inert unless a buildupBlock is emitted.
let stepBuildups = () => {};
${buildupBlock}
// transport channel (opt-in): stepTransports stays inert unless a transportBlock is emitted.
let stepTransports = () => {};
${transportBlock}
// deform channel (opt-in): stepDeforms stays inert unless a deformBlock is emitted.
let stepDeforms = () => {};
${deformBlock}
// signage channel (opt-in): stepSigns stays inert unless a signageBlock is emitted.
let stepSigns = () => {};
${signageBlock}
// physics channel (opt-in, LIVE): stepPhysics stays inert unless a physicsBlock is emitted.
let stepPhysics = () => {};
${physicsBlock}
// actions channel (opt-in, LIVE): input→impulse listeners; sets up once, no per-frame step.
${actionsBlock}
// controllable channel (opt-in, LIVE): the unified control primitive. stepControllable stays inert
// and __ctrlActive false unless a controllableBlock is emitted; when active it owns the camera.
let stepControllable = () => {};
let __ctrlActive = false;       // there are controllable entities to step each frame
let __ctrlOwnsCamera = false;   // a camera entity is present → drive the camera + disable OrbitControls
${controllableBlock}
// Frozen-frame deep link: ?t=<ms> renders ONE static frame at that simulation time (every animated
// channel stepped to t) instead of running the rAF loop — a deterministic still/thumbnail that doesn't
// depend on how long the page has been open (and doesn't fight headless virtual-time budgets). Orbit
// still works: the camera re-renders on control change. No ?t → the normal live loop, unchanged.
function __mojStep(t) { stepTracers(t); stepMovers(t); stepComets(t); stepFields(t); stepSurfaces(t); stepBuildups(t); stepTransports(t); stepDeforms(t); stepSigns(t); stepPhysics(t); }
const _freezeRaw = new URLSearchParams(location.search).get('t');
const _freeze = _freezeRaw !== null && Number.isFinite(+_freezeRaw) ? +_freezeRaw : null;
const _capture = ${capture ? 'true' : 'false'};
if (_capture) {
  // Headless frame-capture mode (forge_motion world subjects): no rAF loop. The driver
  // (lib/motion/world-frames.js) sets the camera + sim-time per frame and renders on
  // demand, so each baked frame is deterministic and one WebGL context serves the whole clip.
  controls.update(); updateCutaway(); __mojStep(0); renderer.render(scene, camera);
  window.__mojCapture = {
    ready: true,
    frame(spec) {
      spec = spec || {};
      if (Array.isArray(spec.pos)) camera.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      if (Array.isArray(spec.target)) controls.target.set(spec.target[0], spec.target[1], spec.target[2]);
      if (Number.isFinite(spec.vfov)) { camera.fov = spec.vfov; camera.updateProjectionMatrix(); }
      controls.update();
      __mojStep(Number.isFinite(spec.t) ? spec.t : 0);
      updateCutaway();
      renderer.render(scene, camera);
    },
  };
} else if (_freeze !== null) {
  controls.update();
  __mojStep(_freeze);
  updateCutaway(); renderer.render(scene, camera);
  controls.addEventListener('change', () => renderer.render(scene, camera));
} else renderer.setAnimationLoop((t) => {
  const dt = walkPrevT ? Math.min((t - walkPrevT) / 1000, 0.05) : 0; walkPrevT = t;
  if (walkOn) stepWalk(dt);
  else {
    if (__ctrlActive) stepControllable(dt);                 // step entities (clock/walk/glide/follow)
    if (!__ctrlOwnsCamera) controls.update();               // OrbitControls unless a camera entity owns the view
  }
  __mojStep(t);
  updateCutaway(); renderer.render(scene, camera);
});
</script>
</body></html>
`;
}

// Pack one frame's faces into a COMPACT payload: 4 quantised corners per face
// (Uint16 over a shared bound) + ONE linear colour per face (Uint8). This exploits
// the figure's flat shading + fixed topology — the naive triangle-soup encoding
// (6 Float32 verts/face, colour duplicated per vertex) is ~5× larger and, at the
// figure's real density (~17k faces), blows a 24-frame loop past 75MB (proven in
// figure-world.spike.test.js). The browser re-expands corners → two tris and
// fans the per-face colour onto all 6 verts. See figure-world.plan.md.
function packFigureFrames(frames) {
  const all = frames.map((fr) => expandSurfaceCards(fr.faces || []).filter((f) => f && f.corners && f.corners.length >= 4));
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const ff of all) for (const f of ff) for (const c of f.corners) for (let k = 0; k < 3; k++) {
    if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k];
  }
  if (!Number.isFinite(mn[0])) { mn[0] = mn[1] = mn[2] = 0; mx[0] = mx[1] = mx[2] = 1; }
  const ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  const scale = 65000 / ext;                 // Uint16 fixed-point over the shared bound
  const pos = [], col = [];
  for (const ff of all) {
    const p = new Uint16Array(ff.length * 4 * 3);
    const c = new Uint8Array(ff.length * 3);
    let pi = 0, ci = 0;
    for (const f of ff) {
      for (const corner of f.corners) for (let k = 0; k < 3; k++) p[pi++] = Math.round((corner[k] - mn[k]) * scale);
      const [lr, lg, lb] = faceColorLinear(f);
      c[ci++] = Math.round(lr * 255); c[ci++] = Math.round(lg * 255); c[ci++] = Math.round(lb * 255);
    }
    pos.push(b64(p)); col.push(b64(c));
  }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radius = 0.5 * Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  return { pos, col, origin: mn, invScale: 1 / scale, center, radius };
}

/**
 * Emit a self-contained "kick from behind the ball" page: a FIRST-PERSON camera planted
 * just behind the ball at the spot, watching it get struck and fly down-range — the curve
 * and dip read against the pitch lines + goal as the ball recedes. Angle / force / spin are
 * LIVE dials: the SAME ball-flight.js integrator the server test validates is inlined and
 * re-run in the browser on every slider move (one model, two consumers). See ball-flight.plan.md.
 */
export function emitBallKickView({ launch = {}, opts = {}, viewBox = { width: 1120, height: 720 }, title = 'kick — first person (behind the ball)', bg = '#8ec3ea', goalDist = 20, inline = true, cdn = false } = {}) {
  const W = viewBox.width, H = viewBox.height;
  const aspect = W / H;
  const importmap = cdn ? CDN_IMPORTMAP : inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  // Single source of truth: inline the validated integrator (exports stripped) so the
  // browser's live dials run byte-for-byte the same physics as ball-flight.test.js.
  const physicsSrc = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'ball-flight.js'), 'utf8')
    .replace(/^export\s+/gm, '');
  const INIT = JSON.stringify({
    speed: launch.speed ?? 27,
    elevationDeg: launch.elevationDeg ?? 15,
    curlRev: launch.curlRev ?? 6,   // sidespin rev/s, + curls left (+y)
    spinRev: launch.spinRev ?? 3,   // + backspin (float) · − topspin (dip)
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0a0f16;color:#eaf2ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%;cursor:grab}
  .readout{position:absolute;left:10px;top:9px;font-variant-numeric:tabular-nums;color:#0a1a0e;background:rgba(255,255,255,.7);padding:4px 9px;border-radius:5px;font-weight:600}
  .panel{position:absolute;left:10px;bottom:10px;display:flex;flex-direction:column;gap:5px;background:rgba(8,14,22,.62);padding:9px 11px;border-radius:7px}
  .panel label{display:flex;align-items:center;gap:8px;font-size:12px;color:#bcd3f2}
  .panel label span{min-width:74px;color:#7f9bc4;text-align:right;font-variant-numeric:tabular-nums}
  .panel input[type=range]{width:150px;accent-color:#ffe04a}
  .panel .row{display:flex;gap:7px;margin-top:2px}
  .panel button{flex:1;color:#cfe0ff;background:rgba(20,30,46,.9);border:1px solid #2b3a54;border-radius:5px;padding:4px 8px;cursor:pointer;font:inherit}
  .panel button.on{background:#2b4a74;color:#fff}
  .hint{position:absolute;right:10px;bottom:10px;color:#0a1a0e;background:rgba(255,255,255,.55);padding:3px 8px;border-radius:5px;font-size:11px;user-select:none}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>
    <div class="readout" id="readout"></div>
    <div class="panel">
      <label>angle <input id="angle" type="range" min="3" max="45" step="1"><span id="angleV"></span></label>
      <label>force <input id="force" type="range" min="14" max="36" step="1"><span id="forceV"></span></label>
      <label>curl <input id="curl" type="range" min="-12" max="12" step="1"><span id="curlV"></span></label>
      <label>lift <input id="spin" type="range" min="-12" max="12" step="1"><span id="spinV"></span></label>
      <div class="row"><button id="replay">replay &#8635;</button><button id="slow">slow-mo</button></div>
    </div>
    <div class="hint">first person · behind the ball · drag to look</div>
  </div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';

/* ---- inlined ball-flight integrator: the SAME source ball-flight.test.js validates ---- */
${physicsSrc}
/* ---- end integrator ---- */

const INIT = ${INIT};
const BG = ${JSON.stringify(bg)};
const GOAL = ${goalDist};
const R = BALL.radius;

const wrap = document.getElementById('wrap'), canvas = document.getElementById('c');
const readoutEl = document.getElementById('readout');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const bgCol = new THREE.Color(BG);
scene.background = bgCol;
scene.fog = new THREE.Fog(bgCol, 45, 230);

// --- pitch: green ground + distance lines (across) + center stripe + side lines ---
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ color: 0x3f8a44 })));
const FH = 16, linePts = [];
for (let x = 0; x <= 80; x += 5) linePts.push(x, -FH, 0.02, x, FH, 0.02);   // mowing lines, every 5 m
linePts.push(-6, 0, 0.02, 80, 0, 0.02, -6, -FH, 0.02, 80, -FH, 0.02, -6, FH, 0.02, 80, FH, 0.02);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x69b06f })));

// --- goal at x = GOAL (regulation 7.32 × 2.44), z-up ---
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 10);
for (const y of [-3.66, 3.66]) { const p = new THREE.Mesh(postGeo, white); p.rotation.x = Math.PI / 2; p.position.set(GOAL, y, 1.22); scene.add(p); }
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 10), white);   // cylinder axis is +y → spans the mouth
bar.position.set(GOAL, 0, 2.44); scene.add(bar);
const netPts = [];   // sparse net hint on the goal mouth
for (let y = -3.66; y <= 3.66; y += 0.61) netPts.push(GOAL, y, 0, GOAL, y, 2.44);
for (let z = 0; z <= 2.44; z += 0.61) netPts.push(GOAL, -3.66, z, GOAL, 3.66, z);
const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
scene.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })));

// --- ball: white sphere + 3 orthogonal seam rings + a marker dot, so spin is unmistakable ---
const ballGroup = new THREE.Group();
ballGroup.add(new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), new THREE.MeshBasicMaterial({ color: 0xf6f6f2 })));
const seam = new THREE.MeshBasicMaterial({ color: 0x1b1b24 });
const ring = new THREE.TorusGeometry(R * 0.99, R * 0.05, 8, 44);
const r1 = new THREE.Mesh(ring, seam); ballGroup.add(r1);
const r2 = new THREE.Mesh(ring, seam); r2.rotation.x = Math.PI / 2; ballGroup.add(r2);
const r3 = new THREE.Mesh(ring, seam); r3.rotation.y = Math.PI / 2; ballGroup.add(r3);
const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd03b2e }));
dot.position.set(0, 0, R * 0.92); ballGroup.add(dot);
scene.add(ballGroup);

// --- ground shadow (depth cue from behind) + growing flight trail ---
const shadow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.5, 22), new THREE.MeshBasicMaterial({ color: 0x10300f, transparent: true, opacity: 0.5 }));
shadow.position.z = 0.025; scene.add(shadow);
const TRAIL_MAX = 9000;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffe04a }));
scene.add(trail);

// --- the boot: swings in during pre-roll and contacts at launch ---
const boot = new THREE.Mesh(new THREE.BoxGeometry(R * 2.8, R * 1.25, R * 1.7), new THREE.MeshBasicMaterial({ color: 0x20262f }));
scene.add(boot);
function placeBoot(u){
  const e = u * u * (3 - 2 * u);   // smoothstep
  boot.position.set(-R * 9 + (-R * 1.3 + R * 9) * e, 0, R * 0.3 + (R - R * 0.3) * e);
  boot.rotation.y = (1 - e) * 0.55;
}

// --- first-person camera: fixed eye just behind the ball, drag to look ---
const EYE = new THREE.Vector3(-3.2, 0.55, 1.45);
const camera = new THREE.PerspectiveCamera(${verticalFov(62, aspect)}, wrap.clientWidth / wrap.clientHeight, 0.05, 700);
camera.up.set(0, 0, 1);
camera.position.copy(EYE);
const baseDir = new THREE.Vector3(18, 0, 2.2).sub(EYE).normalize();
let baseYaw = Math.atan2(baseDir.y, baseDir.x), basePitch = Math.asin(baseDir.z);
let dYaw = 0, dPitch = 0, dragging = false, lx = 0, ly = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.style.cursor = 'grabbing'; });
addEventListener('mouseup', () => { dragging = false; canvas.style.cursor = 'grab'; });
addEventListener('mousemove', (e) => { if (!dragging) return; dYaw -= (e.clientX - lx) * 0.0026; dPitch -= (e.clientY - ly) * 0.0026; lx = e.clientX; ly = e.clientY; dPitch = Math.max(-0.5, Math.min(0.75, dPitch)); });
function aim(){ const yaw = baseYaw + dYaw, pit = basePitch + dPitch; camera.lookAt(EYE.x + Math.cos(pit) * Math.cos(yaw), EYE.y + Math.cos(pit) * Math.sin(yaw), EYE.z + Math.sin(pit)); }

// --- physics state + recompute on any dial change ---
const launch = { speed: INIT.speed, elevationDeg: INIT.elevationDeg, azimuthDeg: 0, spin: { x: 0, y: 0, z: 0 } };
let curlDial = INIT.curlRev, spinDial = INIT.spinRev;
let traj = null, flightT = 0, renderPts = null;
function recompute(){
  launch.spin = { x: 0, y: -rps(spinDial), z: rps(curlDial) };   // +lift=backspin → ω_y<0; +curl → ω_z>0 → +y
  traj = kickBall(launch);
  flightT = traj.summary.flightTime;
  const S = traj.samples, n = S.length;
  renderPts = new Float32Array(Math.min(n, TRAIL_MAX) * 3);
  const pos = trailGeo.attributes.position.array;
  for (let i = 0; i < n && i < TRAIL_MAX; i++) { const p = S[i].p; pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z + R; }
  trailGeo.attributes.position.needsUpdate = true;
  const s = traj.summary;
  readoutEl.textContent = 'range ' + s.range.toFixed(1) + ' m    apex ' + s.apex.toFixed(1) + ' m    curl ' + s.peakLateral.toFixed(2) + ' m    hang ' + s.flightTime.toFixed(2) + ' s';
  resetPlayback();
}
function idxAtTime(tp){   // last sample with t <= tp (binary search; samples' t is increasing)
  const S = traj.samples; let lo = 0, hi = S.length - 1;
  if (tp <= 0) return 0; if (tp >= flightT) return hi;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].t <= tp) lo = m; else hi = m - 1; }
  return lo;
}
function ballAt(tp){
  const S = traj.samples, i = idxAtTime(tp), a = S[i], b = S[Math.min(i + 1, S.length - 1)];
  const span = (b.t - a.t) || 1, f = Math.max(0, Math.min(1, (tp - a.t) / span));
  return {
    x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f, z: a.p.z + (b.p.z - a.p.z) * f,
    omega: a.omega, idx: i,
  };
}
function updateShadow(){
  const h = Math.max(0, ballGroup.position.z - R);
  shadow.position.set(ballGroup.position.x, ballGroup.position.y, 0.025);
  const sc = 1 + h * 0.22; shadow.scale.set(sc, sc, 1);
  shadow.material.opacity = Math.max(0.07, 0.5 - h * 0.028);
}

// --- playback: PRE (boot swing) → FLIGHT → POST hold → loop ---
const PRE = 0.55, POST = 1.2;
let clock = 0, slow = false;
function resetPlayback(){ clock = 0; ballGroup.quaternion.identity(); trailGeo.setDrawRange(0, 1); }
function step(dt){
  const total = PRE + flightT + POST, c = clock % total;
  if (c < PRE) {                       // pre-roll: ball at rest on the spot, boot swings in
    ballGroup.position.set(0, 0, R); ballGroup.quaternion.identity();
    boot.visible = true; placeBoot(c / PRE);
    trailGeo.setDrawRange(0, 1); updateShadow();
    return;
  }
  boot.visible = false;
  const ft = Math.min(c - PRE, flightT);
  const s = ballAt(ft);
  ballGroup.position.set(s.x, s.y, s.z + R);
  const w = Math.hypot(s.omega.x, s.omega.y, s.omega.z);
  if (w > 1e-6 && c - PRE <= flightT) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(s.omega.x / w, s.omega.y / w, s.omega.z / w), w * dt);
    ballGroup.quaternion.premultiply(q);
  }
  trailGeo.setDrawRange(0, Math.max(2, s.idx + 1));
  updateShadow();
}

// --- dials ---
const angleEl = document.getElementById('angle'), forceEl = document.getElementById('force');
const curlEl = document.getElementById('curl'), spinEl = document.getElementById('spin');
const angleV = document.getElementById('angleV'), forceV = document.getElementById('forceV');
const curlV = document.getElementById('curlV'), spinV = document.getElementById('spinV');
angleEl.value = INIT.elevationDeg; forceEl.value = INIT.speed; curlEl.value = INIT.curlRev; spinEl.value = INIT.spinRev;
function labels(){
  angleV.textContent = angleEl.value + '°';
  forceV.textContent = forceEl.value + ' m/s';
  const cv = +curlEl.value, sv = +spinEl.value;
  curlV.textContent = cv === 0 ? 'straight' : Math.abs(cv) + ' rev/s ' + (cv > 0 ? 'left' : 'right');
  spinV.textContent = sv === 0 ? 'none' : Math.abs(sv) + ' rev/s ' + (sv > 0 ? 'back' : 'top');
}
function readDials(){ launch.elevationDeg = +angleEl.value; launch.speed = +forceEl.value; curlDial = +curlEl.value; spinDial = +spinEl.value; labels(); recompute(); }
[angleEl, forceEl, curlEl, spinEl].forEach((el) => el.addEventListener('input', readDials));
document.getElementById('replay').onclick = () => resetPlayback();
const slowBtn = document.getElementById('slow');
slowBtn.onclick = () => { slow = !slow; slowBtn.classList.toggle('on', slow); };

function resize(){ const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
labels(); recompute();

let last = 0;
renderer.setAnimationLoop((t) => {
  const realDt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
  const rate = slow ? 0.35 : 1;
  clock += realDt * rate;
  step(realDt * rate);
  aim();
  renderer.render(scene, camera);
});
</script>
</body></html>
`;
}
