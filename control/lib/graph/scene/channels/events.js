import { buildBus } from '../../worlds/event-bus.js';
import { colorCss, fmtDelta, hudSubst, normalizeHud, styleVars } from '../../game/hud-widgets.js';
import { safeJson } from '../emit-util.js';

// The HUD widget layer's stylesheet (hud-widgets.js): one absolutely-positioned column per slot
// over #wrap (the corners + the centre line), a widget per row, kinds styled by class. Every
// color and family is a `--moj-*` token so the game shell's theme (game-init sidecar) or the
// world's own `events.style` skins it; the fallbacks are today's look. Emitted ONLY when the
// world carries hud rows — a hud-less events world is byte-identical.
const HUD_CSS = [
  '.moj-hud{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:var(--moj-font);color:var(--moj-ink)}',
  '.moj-hud-col{position:absolute;display:flex;flex-direction:column;gap:8px;max-width:46%}',
  '.moj-hud-top-left{left:12px;top:12px}.moj-hud-top-right{right:12px;top:12px;align-items:flex-end}',
  '.moj-hud-top{left:50%;top:12px;transform:translateX(-50%);align-items:center}',
  '.moj-hud-center{left:50%;top:50%;transform:translate(-50%,-50%);align-items:center}',
  '.moj-hud-bottom-left{left:12px;bottom:12px}.moj-hud-bottom-right{right:12px;bottom:12px;align-items:flex-end}',
  '.moj-hud-bottom{left:50%;bottom:12px;transform:translateX(-50%);align-items:center}',
  '.moj-w{background:var(--moj-panel-a);border:1px solid var(--moj-line);border-radius:8px;padding:6px 12px;font:600 16px/1.3 var(--moj-font);letter-spacing:.5px;white-space:nowrap;transition:opacity .18s ease}',
  '.moj-w-text .moj-lbl{opacity:.75;margin-right:.5em}.moj-w-text .moj-lbl:empty{display:none}',
  '.moj-w-clock .moj-val{font-variant-numeric:tabular-nums}',
  '.moj-w-counter{display:flex;flex-direction:column;align-items:center;min-width:72px;padding:6px 14px}',
  '.moj-w-counter .moj-val{font-size:30px;font-weight:700;line-height:1.05;font-variant-numeric:tabular-nums}',
  '.moj-w-counter .moj-lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.7}',
  '.moj-w-bar{display:flex;align-items:center;gap:8px;min-width:180px}',
  '.moj-w-bar .moj-lbl,.moj-w-bar .moj-val{color:var(--moj-ink);font-size:12px;letter-spacing:1px;text-transform:uppercase}',
  '.moj-w-bar .moj-val{opacity:.8;font-variant-numeric:tabular-nums;text-transform:none}',
  '.moj-w-bar .moj-track{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden}',
  '.moj-w-bar .moj-fill{display:block;height:100%;width:0;background:currentColor;transition:width .12s linear}',
  '.moj-w-banner{font-size:34px;font-weight:800;letter-spacing:3px;text-transform:uppercase;padding:10px 26px;text-shadow:0 0 18px currentColor}',
  '.moj-w-toast{font-size:22px;font-weight:800;padding:2px 10px;background:none;border:0;text-shadow:0 0 12px currentColor;will-change:transform,opacity}',
  '.moj-w-legend{font-size:12px;font-weight:500;opacity:.85;letter-spacing:.3px}',
  '.moj-hidden{opacity:0}',
].join('');

// the in-page widget block. Widgets arrive normalized (kind / slot / as filled); each carries a
// pre-resolved `css` color so the page never interprets an author string as CSS. Banners watch
// the bus LOG delta each step (the same read-only observation the game channel makes) and hide
// on the frame clock `t` — real time never enters the bus, so a capture run stays deterministic.
// Toasts spawn one element per firing (capped per widget) that rises + fades on the same clock;
// an event toast reads its `{event.*}` fields from the frame's INCOMING list (the log keeps type
// only), a var toast from the var's change since the last frame (first frame seeds, never fires).
function hudScript(widgets, style) {
  // default colors: banners, event toasts and bars take the accent; a var toast with no color
  // takes NONE here — the page picks harm / goal by the sign of the change at fire time.
  const accentDefault = (w) => w.kind === 'banner' || (w.kind === 'toast' && !w.var) || (w.kind === 'readout' && w.as === 'bar');
  const rows = widgets.map((w) => ({ ...w, css: colorCss(w.color, accentDefault(w) ? 'var(--moj-accent)' : '') }));
  return `// HUD: the screen-space widget layer (hud-widgets.js) — a column per slot, a widget per row.
const __HUD = ${safeJson(rows)};
const __hudEls = [], __hudBanners = [], __hudTimed = [], __hudToasts = [], __hudLive = [], __hudCols = {};
const __TOAST_CAP = 8, __TOAST_RISE = 28;
(function () {
  const st = document.createElement('style'); st.textContent = ${JSON.stringify(`:root{${styleVars(style)}}${HUD_CSS}`)}; document.head.appendChild(st);
  const layer = document.createElement('div'); layer.className = 'moj-hud';
  const cols = __hudCols;
  const col = (slot) => { if (!cols[slot]) { const c = document.createElement('div'); c.className = 'moj-hud-col moj-hud-' + slot; layer.appendChild(c); cols[slot] = c; } return cols[slot]; };
  const span = (cls) => { const s = document.createElement('span'); s.className = cls; return s; };
  __HUD.forEach((w) => {
    const el = document.createElement('div');
    el.className = 'moj-w moj-w-' + w.kind + (w.kind === 'readout' ? ' moj-w-' + w.as : '');
    if (w.css) el.style.color = w.css;
    if (w.kind === 'readout') {
      const lbl = span('moj-lbl'), val = span('moj-val'); lbl.textContent = w.label;
      let fill = null;
      if (w.as === 'bar') { const track = span('moj-track'); fill = span('moj-fill'); track.appendChild(fill); el.appendChild(lbl); el.appendChild(track); el.appendChild(val); }
      else if (w.as === 'counter') { el.appendChild(val); el.appendChild(lbl); }
      else { el.appendChild(lbl); el.appendChild(val); }
      __hudEls.push({ w: w, val: val, fill: fill });
    } else if (w.kind === 'banner') { el.textContent = w.text; el.classList.add('moj-hidden'); __hudBanners.push({ w: w, el: el, until: 0 }); }
    else if (w.kind === 'toast') { col(w.slot); __hudToasts.push({ w: w, prev: null, n: 0 }); return; }   // spawns per firing; no standing element
    else { el.textContent = w.text; if (w.ttl) __hudTimed.push({ el: el, until: w.ttl * 1000 }); }
    col(w.slot).appendChild(el);
  });
  wrap.appendChild(layer);
})();
function __hudClock(n) { const s = Math.max(0, Math.ceil(n)); const m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
${hudSubst.toString()}
${fmtDelta.toString()}
function __hudSubst(text, ctx) { return hudSubst(text, __busState.vars, ctx); }   // "{name}" reads a bus var — "TIME! {score}" at game over
function __hudToast(tw, text, t, sign) {   // one rising, fading element per firing; the oldest goes past the cap
  const el = document.createElement('div');
  el.className = 'moj-w moj-w-toast'; el.textContent = text;
  el.style.color = tw.w.css || (sign < 0 ? 'var(--moj-harm)' : sign > 0 ? 'var(--moj-goal)' : 'var(--moj-accent)');
  __hudCols[tw.w.slot].appendChild(el);
  tw.n++; if (tw.n > __TOAST_CAP) { for (let i = 0; i < __hudLive.length; i++) if (__hudLive[i].tw === tw) { __hudLive[i].el.remove(); __hudLive.splice(i, 1); tw.n--; break; } }
  __hudLive.push({ tw: tw, el: el, born: t || 0, until: (t || 0) + tw.w.ttl * 1000 });
}
function __hudGlob(str, pat) {   // the game.on / fx.on glob: '*' spans, literals anchor at both ends
  str = String(str); if (pat === '*') return true;
  const parts = pat.split('*'); if (parts.length === 1) return str === pat;
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]; if (!p) continue;
    const at = str.indexOf(p, pos); if (at < 0 || (i === 0 && at !== 0)) return false;
    pos = at + p.length;
  }
  return !parts[parts.length - 1] || pos === str.length;
}
let __hudLogN = __busState.log ? __busState.log.length : 0, __hudT0 = -1;
function __syncHud(t, incoming) {
  if (__hudT0 < 0) __hudT0 = t || 0;
  for (const h of __hudEls) {
    const raw = __busState.vars[h.w.var], n = raw != null ? raw : 0;
    if (h.fill) {
      const mx = typeof h.w.max === 'string' ? (__busState.vars[h.w.max] || 0) : h.w.max;
      const pct = mx > 0 ? Math.max(0, Math.min(1, n / mx)) : 0;
      h.fill.style.width = (pct * 100).toFixed(1) + '%'; h.val.textContent = Math.ceil(n) + '/' + Math.ceil(mx);
    } else h.val.textContent = h.w.as === 'clock' ? __hudClock(n) : String(n);
  }
  const log = __busState.log || [];
  if (log.length < __hudLogN) __hudLogN = 0;
  for (let i = __hudLogN; i < log.length; i++) {
    const ev = log[i]; if (!ev || !ev.type) continue;
    for (const b of __hudBanners) if (__hudGlob(ev.type, b.w.on)) { b.el.textContent = __hudSubst(b.w.text); b.el.classList.remove('moj-hidden'); b.until = (t || 0) + b.w.ttl * 1000; }
    for (const tw of __hudToasts) if (tw.w.on && __hudGlob(ev.type, tw.w.on)) {
      let src = null; const inc = incoming || [];   // the firing event's fields: the last incoming of that type this frame
      for (let k = inc.length - 1; k >= 0; k--) if (inc[k] && inc[k].type === ev.type) { src = inc[k]; break; }
      __hudToast(tw, __hudSubst(tw.w.text, { event: src || {} }), t, 0);
    }
  }
  __hudLogN = log.length;
  for (const tw of __hudToasts) if (tw.w.var) {   // the var toast: fires on change, seeds silently on the first frame
    const raw = __busState.vars[tw.w.var], v = typeof raw === 'number' ? raw : 0;
    if (tw.prev === null) tw.prev = v;
    else if (v !== tw.prev) { const d = v - tw.prev; tw.prev = v; __hudToast(tw, __hudSubst(tw.w.text, { delta: fmtDelta(d), value: v }), t, d < 0 ? -1 : 1); }
  }
  for (let i = __hudLive.length - 1; i >= 0; i--) {   // rise + fade on the frame clock, reap past ttl
    const l = __hudLive[i], p = Math.min(1, ((t || 0) - l.born) / (l.until - l.born || 1));
    if (p >= 1) { l.el.remove(); l.tw.n--; __hudLive.splice(i, 1); continue; }
    l.el.style.opacity = String(1 - p * p); l.el.style.transform = 'translateY(' + (-__TOAST_RISE * p).toFixed(1) + 'px)';
  }
  for (const b of __hudBanners) if (b.until && (t || 0) >= b.until) { b.el.classList.add('moj-hidden'); b.until = 0; }
  for (const l of __hudTimed) if (l.until >= 0 && (t || 0) - __hudT0 >= l.until) { l.el.classList.add('moj-hidden'); l.until = -1; }
}`;
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
  const { widgets } = normalizeHud(events.hud);
  const hudBlock = widgets.length ? hudScript(widgets, events.style) : 'function __syncHud() {}';
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
${hudBlock}
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
let __busPrev, __busPrevT = 0, __zonePrev;
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
  if (window.__mojCtrl) {           // ZONE FACTS → enter/exit events for the walking player (M0-pre)
    const z = __BUS.deriveZoneEvents(window.__mojCtrl.world.entities, __zonePrev, __SOURCES);
    __zonePrev = z.prev;
    for (const ev of z.events) incoming.push(ev);
  }
  if (incoming.length) __BUS.processEvents(__busState, incoming);
  __watchFix();                                      // conceptual predicates (vars/entities/counts)
  const ticks = __BUS.tickTimers(__busState, dtSec); // recurring world heartbeats (spawners, countdowns)
  if (ticks.length) __BUS.processEvents(__busState, ticks);
  const timed = __BUS.stepTime(__busState, dtSec);   // one-shot sequence awaits
  if (timed.length) __BUS.processEvents(__busState, timed);
  __watchFix();                                      // re-check after timer effects settle
  if (window.__mojSim) __BUS.syncToBodies(__busState, window.__mojSim.state);     // apply impulse/move back
  if (window.__mojCtrl) __BUS.syncToCtrl(__busState, window.__mojCtrl.world.entities); // apply respawn/teleport warps
  __syncBus(); __syncHud(t, incoming); __updateAim();
};
// loop watches→reactions to a fixed point so a reaction's var write can trip a watch the same frame.
function __watchFix() { let g = 0; while (g++ < 8) { const w = __BUS.watchEvents(__busState); if (!w.length) break; __BUS.processEvents(__busState, w); } }
window.__mojBus = { bus: __BUS, state: __busState, markers: __markerMeshes, sync: __syncBus };`;
}
