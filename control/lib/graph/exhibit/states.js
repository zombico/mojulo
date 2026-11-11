/**
 * PREPARED STATES: one exhibit shown as it is in several prepared versions (a dam at three water levels, a cell before and
 * after it divides, a city in two years), switched by a slider, a toggle or a carousel. Each state is a made exhibit of its
 * own, so every state is deterministic and nothing is computed live in the page; switching keeps the camera where the
 * visitor left it (each state's World page is framed with `?sync=1`: scene/channels/sync.js).
 *
 *   { kind: 'exhibit-states', title?, label?, control?: 'slider' | 'toggle' | 'carousel',
 *     states: [{ ref, label, caption? }], start?, kiosk?: true | { idle?: seconds } }
 *
 * `label` names what changes ("Water level"); each state's `label` is its value ("60 m"), its `caption` what is different
 * about it. Served at /api/sketches/<ref>/states; exported by export_model({ format: 'html' }) as a folder (index.html and
 * states/<ref>.html) that opens offline; a gallery can stand it as a room. Pure: the store is handed in.
 */
import { sketchRenderMode } from '../sketch/sketch-manifest.js';

export const STATES_KIND = 'exhibit-states';
export const STATE_CONTROLS = Object.freeze(['slider', 'toggle', 'carousel']);
export const STATES_LIMITS = Object.freeze({ states: 8, label: 40, caption: 300, title: 90, idleMin: 15, idleMax: 3600 });
export const isStatesKind = (kind) => kind === STATES_KIND;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const fail = (at, says) => { throw new Error(`states: ${at} ${says}`); };
const text = (v, at, max) => {
  if (typeof v !== 'string' || !v.trim()) fail(at, 'is a non-empty string');
  if (v.trim().length > max) fail(at, `is ${v.trim().length} characters; at most ${max}`);
  return v.trim();
};

/** The control that suits a count of states when none is asked for: two or three to compare side by side, more to scrub. */
export const defaultControl = (n) => (n <= 3 ? 'toggle' : 'slider');

/** A states recipe, checked against the store; returns its stored form. */
export function statesManifest(m, getSketch) {
  if (!isObj(m) || m.kind !== STATES_KIND) fail('', "is { kind: 'exhibit-states', states: [{ ref, label, caption? }], label?, control? }");
  const extra = Object.keys(m).filter((k) => !['kind', 'title', 'label', 'control', 'states', 'start', 'kiosk'].includes(k));
  if (extra.length) fail(`'${extra[0]}'`, 'is not a states key (it takes title, label, control, states, start, kiosk)');
  if (!Array.isArray(m.states) || m.states.length < 2) fail('states', 'is two prepared states or more');
  if (m.states.length > STATES_LIMITS.states) fail('states', `has ${m.states.length}; at most ${STATES_LIMITS.states}`);
  const refs = new Set(), labels = new Set();
  const states = m.states.map((st, i) => {
    const at = `states[${i}]`;
    if (!isObj(st)) fail(at, 'is { ref, label, caption? }');
    const bad = Object.keys(st).filter((k) => !['ref', 'label', 'caption'].includes(k));
    if (bad.length) fail(at, `has '${bad[0]}' (a state takes ref, label, caption)`);
    if (typeof st.ref !== 'string' || !st.ref) fail(`${at}.ref`, "is a made exhibit's ref");
    if (refs.has(st.ref)) fail(`${at}.ref`, `repeats '${st.ref}'`);
    refs.add(st.ref);
    const sk = getSketch(st.ref);
    if (!sk) fail(`${at}.ref`, `names no sketch '${st.ref}'`);
    if (sketchRenderMode(sk.manifest) !== 'world') fail(`${at}.ref`, `'${st.ref}' is a ${sk.manifest?.kind ?? 'sketch'}, not an exhibit or a world`);
    const label = text(st.label, `${at}.label`, STATES_LIMITS.label);
    if (labels.has(label)) fail(`${at}.label`, `repeats '${label}': each state is told apart by its label`);
    labels.add(label);
    return { ref: st.ref, label, ...(st.caption !== undefined ? { caption: text(st.caption, `${at}.caption`, STATES_LIMITS.caption) } : {}) };
  });
  if (m.control !== undefined && !STATE_CONTROLS.includes(m.control)) fail('control', `is one of ${STATE_CONTROLS.join(', ')}`);
  if (m.start !== undefined && !(Number.isInteger(m.start) && m.start >= 0 && m.start < states.length)) fail('start', `is a state's index, 0 to ${states.length - 1}`);
  let kiosk;
  if (m.kiosk !== undefined && m.kiosk !== false) {
    if (m.kiosk === true) kiosk = true;
    else if (isObj(m.kiosk) && Object.keys(m.kiosk).every((k) => k === 'idle') && (m.kiosk.idle === undefined
      || (Number.isInteger(m.kiosk.idle) && m.kiosk.idle >= STATES_LIMITS.idleMin && m.kiosk.idle <= STATES_LIMITS.idleMax))) kiosk = m.kiosk.idle === undefined ? true : { idle: m.kiosk.idle };
    else fail('kiosk', `is true or { idle: seconds, ${STATES_LIMITS.idleMin} to ${STATES_LIMITS.idleMax} }`);
  }
  return {
    kind: STATES_KIND,
    ...(m.title !== undefined ? { title: text(m.title, 'title', STATES_LIMITS.title) } : {}),
    ...(m.label !== undefined ? { label: text(m.label, 'label', STATES_LIMITS.label) } : {}),
    control: m.control ?? defaultControl(states.length),
    states,
    ...(m.start ? { start: m.start } : {}),
    ...(kiosk !== undefined ? { kiosk } : {}),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/**
 * The states page: one self-contained document. Two frames, the state shown and the next one loading; a switch asks the
 * shown state for its camera, loads the next, gives it the camera, and crossfades. `src(state)` is where a state's page is
 * (the /world route with ?sync=1 served, states/<ref>.html exported).
 */
export function statesHtml({ title, label, control, states, start = 0, kiosk }, { src }) {
  const idle = kiosk ? (kiosk === true ? 90 : kiosk.idle) : 0;
  const S = states.map((s) => ({ label: s.label, caption: s.caption || '', src: src(s) }));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title || 'Exhibit')}</title>
<style>
  :root{color-scheme:dark;--ink:#eef2f8;--mute:rgba(238,242,248,.62);--line:rgba(255,255,255,.16)}
  html,body{margin:0;height:100%;background:#0a0d14;color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden}
  iframe{position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .45s ease;z-index:0}
  iframe.on{opacity:1;z-index:1}
  .pn{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:3;width:min(620px,calc(100% - 32px));background:rgba(12,16,24,.84);border:1px solid var(--line);border-radius:10px;padding:12px 16px;box-shadow:0 6px 24px rgba(0,0,0,.35);backdrop-filter:blur(6px);box-sizing:border-box}
  .tt{font:600 12px/1.35 system-ui,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:rgba(238,242,248,.85);margin-bottom:6px}
  .ax{font:600 11px/1 system-ui,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:var(--mute);margin-bottom:8px}
  .cp{margin:8px 0 0;min-height:1.45em}
  input[type=range]{width:100%;accent-color:#9cc4ff;margin:4px 0 0}
  .tk{display:flex;justify-content:space-between;font-size:12px;color:var(--mute);margin-top:2px}.tk span.on{color:var(--ink);font-weight:600}
  .tg{display:flex;flex-wrap:wrap;gap:6px}.tg button,.cr button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:999px;padding:6px 14px}
  .tg button.on{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.4)}
  .cr{display:flex;align-items:center;gap:10px}.cr .v{flex:1;text-align:center;font-weight:600}.cr button{min-width:40px;font-size:18px;line-height:1}
  button:focus-visible,input:focus-visible{outline:2px solid #9cc4ff;outline-offset:2px}
  html.kiosk .pn{font-size:18px}html.kiosk .tg button{padding:10px 20px}html.kiosk,html.kiosk *{-webkit-user-select:none;user-select:none}
  .cue{position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:3;padding:9px 20px;border-radius:999px;background:rgba(12,16,24,.62);border:1px solid var(--line);font:600 15px/1 system-ui,sans-serif;letter-spacing:1px;opacity:0;transition:opacity .6s;pointer-events:none}
  .cue.on{opacity:1}
  @media (prefers-reduced-motion:reduce){iframe{transition:none}}
</style></head><body>
<iframe id="fa" title="state"></iframe><iframe id="fb" title="state"></iframe>
<section class="pn" id="pn" role="group" aria-label="${esc(label || 'states')}">
  ${title ? `<div class="tt">${esc(title)}</div>` : ''}
  ${label ? `<div class="ax">${esc(label)}</div>` : ''}
  <div id="ctl"></div>
  <p class="cp" id="cp" aria-live="polite"></p>
</section>
<div class="cue" id="cue">Touch to explore</div>
<script>
(function () {
  const S = ${json(S)}, CONTROL = ${json(control)}, N = S.length;
  const IDLE = ${idle} * 1000 || (/[?&]kiosk=(?!0)/.test(location.search) ? 90000 : 0);
  if (IDLE) { document.documentElement.classList.add('kiosk'); document.addEventListener('contextmenu', (e) => e.preventDefault()); }
  const $ = (id) => document.getElementById(id);
  const frames = [$('fa'), $('fb')], ctl = $('ctl'), cp = $('cp'), pn = $('pn'), cue = $('cue');
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let paint = () => {};
  if (CONTROL === 'slider') {
    const r = el('input'); r.type = 'range'; r.min = 0; r.max = N - 1; r.step = 1; r.setAttribute('aria-label', ${json(label || 'state')});
    const tk = el('div', 'tk'); const ticks = S.map((s) => { const t = el('span', null, s.label); tk.appendChild(t); return t; });
    r.addEventListener('input', () => show(+r.value));
    ctl.append(r, tk);
    paint = (i) => { r.value = i; r.setAttribute('aria-valuetext', S[i].label); ticks.forEach((t, k) => t.classList.toggle('on', k === i)); };
  } else if (CONTROL === 'toggle') {
    const g = el('div', 'tg'); const bs = S.map((s, i) => { const b = el('button', null, s.label); b.onclick = () => show(i); g.appendChild(b); return b; });
    ctl.append(g);
    paint = (i) => bs.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  } else {
    const c = el('div', 'cr'); const p = el('button', null, '\\u2039'), v = el('span', 'v'), n = el('button', null, '\\u203a');
    p.setAttribute('aria-label', 'previous'); n.setAttribute('aria-label', 'next');
    p.onclick = () => show((at - 1 + N) % N); n.onclick = () => show((at + 1) % N);
    c.append(p, v, n); ctl.append(c);
    paint = (i) => { v.textContent = S[i].label; };
  }
  // a switch: ask the shown state for its camera, load the next in the hidden frame, give it the camera, crossfade
  let at = -1, front = 0, token = 0, pose = null, waitPose = null;
  function show(i, first) {
    if (!(i >= 0 && i < N) || i === at) return;
    at = i; paint(i); cp.textContent = S[i].caption; document.title = ${json(title || 'Exhibit')} + ' \\u00b7 ' + S[i].label;
    const t = ++token;
    const go = () => {
      if (t !== token) return;
      const back = first ? frames[front] : frames[1 - front];
      back.dataset.token = String(t);
      back.src = S[i].src + (S[i].src.includes('?') ? '&' : '?') + 'sync=1';
    };
    if (first) { go(); return; }
    pose = null; waitPose = go;
    try { frames[front].contentWindow.postMessage({ moj: 'pose-get' }, '*'); } catch (err) { /* not loaded */ }
    setTimeout(() => { if (waitPose === go) { waitPose = null; go(); } }, 400);
  }
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || typeof d.moj !== 'string') return;
    const k = frames.findIndex((f) => f.contentWindow === e.source); if (k < 0) return;
    if (d.moj === 'pose' && k === front && waitPose) { pose = d; const g = waitPose; waitPose = null; g(); }
    else if (d.moj === 'pose-ready' && frames[k].dataset.token === String(token)) {
      if (pose && k !== front) { try { frames[k].contentWindow.postMessage({ moj: 'pose-set', pos: pose.pos, target: pose.target, fov: pose.fov }, '*'); } catch (err) { /* opaque */ } }
      frames[k].classList.add('on');   // (the panel stands at the top: a state's own readout or tour plate keeps the bottom)
      if (k !== front) { const old = frames[front]; front = k; old.classList.remove('on'); setTimeout(() => { if (!old.classList.contains('on')) old.removeAttribute('src'); }, 600); }
    } else if (d.moj === 'frame-touch') touched();
    else if (d.moj === 'frame-key' && k === front) step(d.key);   // the keyboard after a drag inside the state
  });
  function step(key) {
    if (key === 'ArrowRight') show(CONTROL === 'carousel' ? (at + 1) % N : Math.min(N - 1, at + 1));
    else if (key === 'ArrowLeft') show(CONTROL === 'carousel' ? (at - 1 + N) % N : Math.max(0, at - 1));
  }
  window.addEventListener('keydown', (e) => { if (e.target && e.target.type === 'range') return; step(e.key); });
  // a kiosk: left alone, it steps through its states on its own; a touch hands it to the visitor
  let attract = false, timer = 0, idleTimer = 0;
  function cycle() { clearTimeout(timer); if (!attract) return; timer = setTimeout(() => { show((at + 1) % N); cycle(); }, 8000); }
  function rest() { clearTimeout(idleTimer); if (IDLE) idleTimer = setTimeout(() => { attract = true; cue.classList.add('on'); cycle(); }, IDLE); }
  function touched() {
    if (attract) { attract = false; clearTimeout(timer); cue.classList.remove('on'); }
    rest();
    if (window.parent !== window) { try { window.parent.postMessage({ moj: 'tour-touch' }, '*'); } catch (err) { /* opaque */ } }   // a gallery's kiosk hears it
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, touched, { passive: true, capture: true }));
  show(${Number.isInteger(start) ? start : 0}, true);
  rest();
  window.__mojStates = { get at() { return at; }, count: N, show, labels: S.map((s) => s.label) };
})();
</script>
</body></html>
`;
}
