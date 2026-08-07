import { safeJson } from '../emit-util.js';

// fx channel (game-ui-language.plan.md, U2): the game UI LANGUAGE decoration — standing STATES
// (float / spin / pulse / dim / shimmer) and one-shot disappear GESTURES (pop / burst / ghost /
// dissolve) applied to controllable entities by id. Presentation-only, exactly the audio rule: it
// READS entity meshes + bus events and never writes sim state — so probes/audits/replay are
// untouched. Driven by __mojStep(t), so it is DETERMINISTIC in every mode (live rAF, capture
// frame(spec.t), capture step(__capT)); nothing here reads a wall clock. It decorates on the free
// transform seams __syncEntity never writes: the inner figure mesh's LOCAL position/rotation/scale
// (glyph/figure bodies), the outer mesh SCALE (any body), and material.color / opacity (multiply,
// so tints darken cleanly under vertexColors). Emitted only when the manifest carries `fx`;
// absent ⇒ byte-identical, and it requires the controllable channel (its `__mojCtrl.bodies` map).
export function fxChannelScript(fx) {
  return `
// ---- fx channel: game UI language decoration (presentation-only) ----
const __FX = ${safeJson(fx)};
const __fxState = {};   // id → { base:[Color…], baseOpacity:[…], hidden, captured }
let __fxQ = [];         // queued one-shot gestures: { id, gesture, t0:null }
const __fxGlob = (str, pat) => {
  if (pat === '*') return true;
  if (pat.indexOf('*') < 0) return String(str) === pat;
  return new RegExp('^' + pat.split('*').map((s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.*') + '$').test(String(str));
};
// remember an entity's rest materials once, so every tint/opacity is computed FROM base (idempotent).
function __fxCapture(id, m) {
  if (__fxState[id]) return __fxState[id];
  const base = [], baseOpacity = [];
  m.traverse((o) => { if (o.material && o.material.color) { base.push(o.material.color.clone()); baseOpacity.push(o.material.opacity); } });
  return (__fxState[id] = { base, baseOpacity, hidden: false });
}
// reset an entity's free seams to rest, then the current state/gesture re-applies from a clean slate.
function __fxReset(id, m, inner, canMove) {
  const st = __fxState[id]; if (!st) return;
  inner.scale.setScalar(1);
  if (canMove) { inner.position.z = 0; inner.rotation.z = 0; }
  let i = 0;
  m.traverse((o) => { if (o.material && o.material.color) { o.material.color.copy(st.base[i]); o.material.opacity = st.baseOpacity[i]; o.material.transparent = st.baseOpacity[i] < 1; i++; } });
}
function __fxTint(m, r, g, b) { m.traverse((o) => { if (o.material && o.material.color) o.material.color.setRGB(o.material.color.r * r, o.material.color.g * g, o.material.color.b * b); }); }
function __fxFade(m, k) { m.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = o.material.opacity * k; } }); }
// standing state: decorate one entity for state \`s\` at time t.
function __fxApplyState(m, inner, canMove, s, t) {
  const TAU = 6.28318530718;
  if (s === 'float') { if (canMove) inner.position.z = 0.16 * Math.sin(t * 2.2); }
  else if (s === 'spin') { if (canMove) { inner.position.z = 0.12 * Math.sin(t * 2.2); inner.rotation.z = (t * 1.6) % TAU; } }
  else if (s === 'pulse') { inner.scale.setScalar(1 + 0.12 * Math.sin(t * 3.0)); }
  else if (s === 'dim') { __fxTint(m, 0.4, 0.42, 0.46); }
  else if (s === 'shimmer') { const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t * 4.0)); __fxTint(m, k, k, Math.min(1, k + 0.08)); }
}
// one-shot gesture envelope p∈[0,1]; returns true while active, hides the entity on completion.
function __fxApplyGesture(id, m, inner, canMove, gesture, p) {
  const done = p >= 1;
  if (gesture === 'pop') {
    if (p < 0.3) { const q = p / 0.3; inner.scale.setScalar(1 + 0.22 * q); __fxTint(m, 1 + q, 1 + q, 1 + q); }
    else { const q = (p - 0.3) / 0.7; inner.scale.setScalar(Math.max(0.001, 1.22 * (1 - q))); }
  } else if (gesture === 'burst') {
    inner.scale.setScalar(1 + 1.3 * p); __fxFade(m, Math.max(0, 1 - p * 1.1));
  } else if (gesture === 'ghost') {
    if (canMove) inner.position.z = 1.1 * p * p; inner.scale.setScalar(1 + 0.2 * p); __fxFade(m, Math.max(0, 1 - p));
  } else if (gesture === 'dissolve') {
    if (canMove) inner.rotation.z = p * 6.0; inner.scale.setScalar(Math.max(0.001, 1 - p)); __fxFade(m, Math.max(0, 1 - p * 0.9));
  }
  if (done) { m.visible = false; if (__fxState[id]) __fxState[id].hidden = true; }
  return !done;
}
// bus wrap: a matching event QUEUES a gesture (t0 stamped at the next stepFx so timing rides __mojStep).
if (__FX.on && typeof __BUS !== 'undefined') {
  const __fxPE = __BUS.processEvents;
  __BUS.processEvents = function (state, events) {
    // match a binding against the event's TYPE, or its zone SOURCE (deriveZoneEvents' enter/exit
    // carry source/zone = the zone id) — so a per-zone binding (e.g. a pickup's zone) fires on the
    // top-level enter event. NOTE the wrap only sees TOP-LEVEL incoming events; emit-ted events
    // drain recursively INSIDE processEvents, so bind to facts (enter/contact/timer), not emits.
    for (const ev of events) for (const pat in __FX.on) { if (__fxGlob(ev.type, pat) || (ev.source && __fxGlob(ev.source, pat)) || (ev.zone && __fxGlob(ev.zone, pat))) { var __b = __FX.on[pat]; var __g = (__b && typeof __b === 'object') ? __b.gesture : __b; var __t = (__b && typeof __b === 'object' && __b.target) ? __b.target : (ev.id || ev.entity || (ev.match && ev.match.target) || __FX.onTarget || null); __fxQ.push({ id: __t, gesture: __g, t0: null }); break; } }
    return __fxPE(state, events);
  };
}
const __fxActive = [];   // in-flight gestures { id, gesture, t0 }
stepFx = (tMs) => {
  const t = tMs / 1000;   // __mojStep drives t in MILLISECONDS (live rAF, __capT, ?t=); fx works in seconds
  const ctrl = window.__mojCtrl; if (!ctrl || !ctrl.bodies) return;
  // promote queued triggers, stamping t0 = now so the envelope is measured off __mojStep time.
  if (__fxQ.length) { for (const g of __fxQ) { g.t0 = t; __fxActive.push(g); } __fxQ = []; }
  const busy = {};   // id → true while a gesture owns it (states yield to gestures)
  for (let k = __fxActive.length - 1; k >= 0; k--) {
    const g = __fxActive[k]; const m = g.id && ctrl.bodies[g.id]; if (!m) { __fxActive.splice(k, 1); continue; }
    const inner = (m.userData && m.userData.fig) ? m.userData.fig.mesh : m; const canMove = inner !== m;
    __fxCapture(g.id, m); __fxReset(g.id, m, inner, canMove);
    const p = Math.min(1, (t - g.t0) / 0.5);
    busy[g.id] = true;
    if (!__fxApplyGesture(g.id, m, inner, canMove, g.gesture, p)) __fxActive.splice(k, 1);
  }
  if (__FX.states) for (const id in __FX.states) {
    const m = ctrl.bodies[id]; if (!m) continue;
    const st = __fxState[id]; if (st && st.hidden) continue; if (busy[id]) continue;
    const inner = (m.userData && m.userData.fig) ? m.userData.fig.mesh : m; const canMove = inner !== m;
    __fxCapture(id, m); __fxReset(id, m, inner, canMove);
    __fxApplyState(m, inner, canMove, __FX.states[id], t);
  }
};`;
}
