import { safeJson } from '../emit-util.js';
import { isHighlight, readHighlight } from '../../game/highlight.js';
import { coatMatSrc, smoothNormalsSrc } from './coat-src.js';

// fx channel (game-ui-language.plan.md, U2): the game UI LANGUAGE decoration — standing STATES
// (float / spin / pulse / dim / shimmer, and a HIGHLIGHT: lit at its silhouette, game/highlight.js) and one-shot disappear GESTURES (pop / burst / ghost /
// dissolve) applied to controllable entities by id. Presentation-only, exactly the audio rule: it
// READS entity meshes + bus events and never writes sim state — so probes/audits/replay are
// untouched. Driven by __mojStep(t), so it is DETERMINISTIC in every mode (live rAF, capture
// frame(spec.t), capture step(__capT)); nothing here reads a wall clock. It decorates on the free
// transform seams __syncEntity never writes: the inner figure mesh's LOCAL position/rotation/scale
// (glyph/figure bodies), the outer mesh SCALE (any body), and material.color / opacity (multiply,
// so tints darken cleanly under vertexColors). Emitted only when the manifest carries `fx`;
// absent ⇒ byte-identical, and it requires the controllable channel (its `__mojCtrl.bodies` map).
export function fxChannelScript(fx) {
  // toon ink verbs (toon-shading Phase 4c) are spliced ONLY when the fx spec uses them — an
  // object state carrying `ink`, or an `inkFlash` gesture — so every existing fx world emits
  // byte-identical text (the char-net pins for fx / kitchen-sink hold).
  const usesInk = Object.values(fx.states || {}).some((s) => s && typeof s === 'object' && s.ink)
    || Object.values(fx.on || {}).some((b) => b === 'inkFlash' || (b && typeof b === 'object' && b.gesture === 'inkFlash'));
  const inkHelpers = usesInk ? `
// toon ink verbs (toon-shading Phase 4c): recolour the entity's OUTLINE meshes (userData.ink — the
// toon channel's hulls + crease lines, parented under rig parts) toward \`color\` by \`k\`. Reads from
// the just-reset base, so states/gestures compose idempotently like the fills' tints.
const __fxInkC = new THREE.Color();
function __fxInk(m, color, k) { __fxInkC.set(color || '#ffffff'); m.traverse((o) => { if (o.userData && o.userData.ink && o.material && o.material.color) o.material.color.lerp(__fxInkC, k); }); }` : '';
  const inkState = usesInk ? `
  // object state: { ink: '#hex', pulse?: true } — hold the outline at a colour, or breathe it on the step clock
  else if (s && typeof s === 'object' && s.ink) { __fxInk(m, s.ink, s.pulse ? 0.5 + 0.5 * Math.sin(t * 3.0) : 1); }` : '';
  const inkGesture = usesInk ? `
  // inkFlash: the outline snaps to \`color\` (white by default) and decays back over the envelope;
  // the entity stays visible when it ends (a status flash, not a disappearance).
  if (gesture === 'inkFlash') { __fxInk(m, color, 1 - p); return !done; }` : '';
  // HIGHLIGHT (game/highlight.js) is spliced ONLY when a state is one: an entity lit at its silhouette by a fresnel, so
  // every fx world without one emits the text it did. Its states are read here (every dial filled, a bad word refused).
  const usesHl = Object.values(fx.states || {}).some(isHighlight);
  if (usesHl) fx = { ...fx, states: Object.fromEntries(Object.entries(fx.states).map(([id, s]) => [id, isHighlight(s) ? readHighlight(s, `fx.states.${id}`, fx.rim) : s])) };
  const hlBand = usesHl && Object.values(fx.states).some((x) => isHighlight(x) && x.band > 0);
  const hlHelpers = usesHl ? `
// HIGHLIGHT: the entity wears a COAT, a second draw of each of its own meshes lit at the silhouette in the state's
// colour (channels/coat-src.js: the status coat's own source, so the page's log depth holds and it stands a hair off
// the surface), soft or a cel band as the game's juice has its rim. A mesh with no normals is given smooth ones once.
${coatMatSrc('__fxCoatMat', hlBand)}${smoothNormalsSrc('__fxNormals')}const __fxHl = {};
function __fxHlShell(id, m, s) {
  if (__fxHl[id]) return __fxHl[id];
  const own = [], c = new THREE.Color(s.highlight), S = { mat: __fxCoatMat([c.r, c.g, c.b], false, s.power${hlBand ? ', s.band' : ''}), meshes: [] };
  m.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.geometry && !(o.userData && (o.userData.ink || o.userData.coat))) own.push(o); });
  for (const o of own) {
    if (!o.geometry.attributes.normal) __fxNormals(o.geometry);
    const sh = new THREE.Mesh(o.geometry, S.mat); sh.userData.coat = true; sh.renderOrder = 4; sh.raycast = function () {}; sh.visible = false; o.add(sh); S.meshes.push(sh);
  }
  // (the coat is a material of the entity's now: its rest is remembered again, the coat's among them, so a reset
  // restores as many as it finds)
  delete __fxState[id]; __fxCapture(id, m);
  return (__fxHl[id] = S);
}
function __fxHlShow(id, on) { const S = __fxHl[id]; if (S) for (const sh of S.meshes) sh.visible = on; }` : '';
  const hlState = usesHl ? `
  // object state: { highlight, pulse, power, k, as?, when? }: its motion (if it names one), then its light, while its
  // bus var (if it names one) is truthy
  else if (s && typeof s === 'object' && s.highlight) {
    if (s.as) __fxApplyState(m, inner, canMove, s.as, t, id);
    const V = window.__mojBus && window.__mojBus.state && window.__mojBus.state.vars;
    if (s.when && !(V && V[s.when])) return;
    const S = __fxHlShell(id, m, s); S.mat.userData.uK.value = s.k * (s.pulse ? 0.65 + 0.35 * Math.sin(t * 3.0) : 1); __fxHlShow(id, true);
  }` : '';
  const inkColorArg = usesInk ? ', color' : '';
  const inkQueueColor = usesInk ? ", color: (__b && typeof __b === 'object' && __b.color) ? __b.color : null" : '';
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
function __fxFade(m, k) { m.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = o.material.opacity * k; } }); }${inkHelpers}${hlHelpers}
// standing state: decorate one entity for state \`s\` at time t.
function __fxApplyState(m, inner, canMove, s, t${usesHl ? ', id' : ''}) {
  const TAU = 6.28318530718;
  if (s === 'float') { if (canMove) inner.position.z = 0.16 * Math.sin(t * 2.2); }
  else if (s === 'spin') { if (canMove) { inner.position.z = 0.12 * Math.sin(t * 2.2); inner.rotation.z = (t * 1.6) % TAU; } }
  else if (s === 'pulse') { inner.scale.setScalar(1 + 0.12 * Math.sin(t * 3.0)); }
  else if (s === 'dim') { __fxTint(m, 0.4, 0.42, 0.46); }
  else if (s === 'shimmer') { const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t * 4.0)); __fxTint(m, k, k, Math.min(1, k + 0.08)); }${inkState}${hlState}
}
// one-shot gesture envelope p∈[0,1]; returns true while active, hides the entity on completion.
function __fxApplyGesture(id, m, inner, canMove, gesture, p${inkColorArg}) {
  const done = p >= 1;${inkGesture}
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
    for (const ev of events) for (const pat in __FX.on) { if (__fxGlob(ev.type, pat) || (ev.source && __fxGlob(ev.source, pat)) || (ev.zone && __fxGlob(ev.zone, pat))) { var __b = __FX.on[pat]; var __g = (__b && typeof __b === 'object') ? __b.gesture : __b; var __t = (__b && typeof __b === 'object' && __b.target) ? __b.target : (ev.id || ev.entity || (ev.match && ev.match.target) || __FX.onTarget || null); __fxQ.push({ id: __t, gesture: __g${inkQueueColor}, t0: null }); break; } }
    return __fxPE(state, events);
  };
}
const __fxActive = [];   // in-flight gestures { id, gesture, t0 }
stepFx = (tMs) => {
  const t = tMs / 1000;   // __mojStep drives t in MILLISECONDS (live rAF, __capT, ?t=); fx works in seconds
  const ctrl = window.__mojCtrl; if (!ctrl || !ctrl.bodies) return;
  // promote queued triggers, stamping t0 = now so the envelope is measured off __mojStep time.
  if (__fxQ.length) { for (const g of __fxQ) { g.t0 = t; __fxActive.push(g); } __fxQ = []; }
  const busy = {};   // id → true while a gesture owns it (states yield to gestures)${usesHl ? `
  for (const id in __fxHl) __fxHlShow(id, false);   // (a highlight is lit by its state each step: a gesture, a hidden thing or a var gone dark leaves it off)` : ''}
  for (let k = __fxActive.length - 1; k >= 0; k--) {
    const g = __fxActive[k]; const m = g.id && ctrl.bodies[g.id]; if (!m) { __fxActive.splice(k, 1); continue; }
    const inner = (m.userData && m.userData.fig) ? m.userData.fig.mesh : m; const canMove = inner !== m;
    __fxCapture(g.id, m); __fxReset(g.id, m, inner, canMove);
    const p = Math.min(1, (t - g.t0) / 0.5);
    busy[g.id] = true;
    if (!__fxApplyGesture(g.id, m, inner, canMove, g.gesture, p${usesInk ? ', g.color' : ''})) __fxActive.splice(k, 1);
  }
  if (__FX.states) for (const id in __FX.states) {
    const m = ctrl.bodies[id]; if (!m) continue;
    const st = __fxState[id]; if (st && st.hidden) continue; if (busy[id]) continue;
    const inner = (m.userData && m.userData.fig) ? m.userData.fig.mesh : m; const canMove = inner !== m;
    __fxCapture(id, m); __fxReset(id, m, inner, canMove);
    __fxApplyState(m, inner, canMove, __FX.states[id], t${usesHl ? ', id' : ''});
  }
};`;
}
