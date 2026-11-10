import { safeJson } from '../emit-util.js';

// In-page script: THE TOUR (exhibit/tour.js, an exhibit's stops). A plate along the bottom of the page: the stop's
// number and title, its caption, how sure it is (a tinted grade), how it explains (its shape), where it comes from (its
// cites); under it a crumb a stop, with the way back and on. Going to a stop eases the camera there (a world camera by
// index, a placed one, or a fit to groups from a side) and lights the groups it names while the rest dims (the focus
// verb's own originals, so the two never fight; a hideable wall stays the cutaway's); the subject sits in the room above
// the plate (the projection shifted up by half its height). The arrow keys, Page Up / Down,
// Home and End step it; a swipe across the plate does too. `?stop=<id|n>` opens on a stop; a capture or a viewer who
// asks for reduced motion is seated without easing. window.__mojTour { at, count, ids, go, next, prev } is the
// page's own handle (an audit's, a kiosk's). An exhibit is not the editor: the camera buttons and the wireframe toggle
// (construction tools) give way to the crumbs, the tour's title stands as a quiet label, and a world on the editor's
// flat field gets a ground of its own, a glow behind the subject in the colour of what the stop is about (a world with a
// sky keeps its sky). It reads the page's scene, renderer, camera, controls, meshes, hud, wireBtn, BG, CAMS and VIEW_DIRS.
// A KIOSK (`?kiosk=1`, or `?kiosk=<seconds idle>`, never in a capture): large type and touch targets, no text to
// select, and the attract loop: left alone for the idle time (90 s by default), the tour goes back to its start and
// plays itself, each stop held as long as its caption takes to read; a touch stops it and the visitor has the exhibit.
// In a GALLERY (`?gallery=1`, framed by exhibit/gallery.js) the label is the gallery's, and the tour talks to its frame:
// it says tour-ready, tour-touch and tour-end (the last stop of a play), and answers tour-play, tour-stop and tour-go.
// Emitted only when the page has a tour: every other page byte-identical.
export function tourScript(tour, { capture = false } = {}) {
  return `
// --- the tour: an exhibit's stops, the camera eased to each, a caption, the part talked about lit (exhibit/tour.js) ---
(function () {
  const TR = ${safeJson(tour)};
  const N = TR.stops.length;
  const TINT = { attested: '#7fd09a', reconstructed: '#e9c86e', conjectural: '#ec9a72', simulated: '#86b9ff', depicted: '#c7a8ff', explained: '#8fd6cc' };
  const SHAPE = { ladder: 'concept', process: 'process', structure: 'structure', stratified: 'layers', quantity: 'quantity', formal: 'definition' };
  const host = (typeof wrap !== 'undefined' && wrap) || document.body;
  const sheet = document.createElement('style');
  sheet.textContent = '.moj-tour{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:min(660px,calc(100% - 32px));z-index:12;color:#eef2f8;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;pointer-events:auto;touch-action:pan-y}'
    + '.moj-tour .pl{background:rgba(12,16,24,.84);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:12px 16px 10px;box-shadow:0 6px 24px rgba(0,0,0,.35);backdrop-filter:blur(6px)}'
    + '.moj-tour .hd{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}.moj-tour .no{font:600 12px/1 ui-monospace,Menlo,monospace;opacity:.6;letter-spacing:.5px}'
    + '.moj-tour .tt{font-weight:650;font-size:16px}'
    + '.moj-tour .cp{margin:0}.moj-tour .mt{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:8px;font-size:12px}'
    + '.moj-tour .gr{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.08)}.moj-tour .gr i{width:8px;height:8px;border-radius:50%;display:inline-block}'
    + '.moj-tour .sh{opacity:.6;text-transform:uppercase;letter-spacing:.8px;font-size:11px}.moj-tour .ct{opacity:.7;flex:1 1 220px}'
    + '.moj-tour .nv{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px}'
    + '.moj-tour button{font:inherit;color:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.18);background:rgba(12,16,24,.72);border-radius:8px}'
    + '.moj-tour .st{min-width:40px;min-height:34px;font-size:18px;line-height:1}.moj-tour .st:disabled{opacity:.3;cursor:default}'
    + '.moj-tour .cr{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.moj-tour .cr button{width:14px;height:14px;padding:0;border-radius:50%;background:rgba(255,255,255,.22)}'
    + '.moj-tour .cr button.on{background:#fff;transform:scale(1.15)}.moj-tour button:focus-visible{outline:2px solid #9cc4ff;outline-offset:2px}'
    + '.moj-tour-label{position:absolute;left:16px;top:14px;z-index:12;max-width:calc(100% - 140px);color:rgba(238,242,248,.78);font:600 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:1.6px;text-transform:uppercase;pointer-events:none}'
    + '.moj-tour-glow{position:absolute;inset:0;z-index:-1;pointer-events:none;transition:background-color 1.1s ease;'
    + '-webkit-mask-image:radial-gradient(ellipse 62% 58% at 50% 42%,#000 0%,rgba(0,0,0,.55) 42%,transparent 100%);mask-image:radial-gradient(ellipse 62% 58% at 50% 42%,#000 0%,rgba(0,0,0,.55) 42%,transparent 100%)}'
    + '.hud{left:auto;right:12px;top:10px}.hud button{color:#eef2f8;background:rgba(12,16,24,.55);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:5px 12px}'
    + '.hud button.on{background:rgba(255,255,255,.16);color:#fff}.hint{color:rgba(238,242,248,.38)}'
    + '.moj-tour.kiosk{font-size:18px}.moj-tour.kiosk .tt{font-size:21px}.moj-tour.kiosk .mt{font-size:14px}.moj-tour.kiosk .st{min-width:56px;min-height:48px;font-size:24px}'
    + '.moj-tour.kiosk .cr{gap:10px}.moj-tour.kiosk .cr button{width:18px;height:18px}.moj-kiosk,.moj-kiosk *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}.moj-kiosk .hint{display:none}'
    + '.moj-tour-cue{position:absolute;left:50%;top:16%;transform:translateX(-50%);z-index:12;padding:9px 20px;border-radius:999px;background:rgba(12,16,24,.62);border:1px solid rgba(255,255,255,.16);color:#fff;font:600 15px/1 system-ui,sans-serif;letter-spacing:1px;opacity:0;transition:opacity .6s;pointer-events:none}'
    + '.moj-tour-cue.on{opacity:1;animation:mojcue 2.6s ease-in-out infinite}@keyframes mojcue{50%{opacity:.45}}'
    + '@media (max-width:700px){.hint{display:none}}';   // a phone's bottom edge is the plate's: the orbit hint gives way
  document.head.appendChild(sheet);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const root = el('div', 'moj-tour'); root.setAttribute('role', 'region'); root.setAttribute('aria-label', TR.title || 'tour');
  const plate = el('div', 'pl'); const hd = el('div', 'hd'); const no = el('span', 'no'); const tt = el('span', 'tt');
  hd.append(no, tt);
  const label = el('div', 'moj-tour-label', TR.title || document.title || ''); host.appendChild(label);
  // the construction tools give way: the crumbs choose the views now
  if (typeof hud !== 'undefined' && hud && typeof CAMS !== 'undefined') [...hud.children].slice(0, CAMS.length).forEach((b) => { b.style.display = 'none'; });
  if (typeof wireBtn !== 'undefined' && wireBtn) wireBtn.style.display = 'none';
  // the exhibit's ground: on the editor's flat field (no sky, no backdrop) the canvas clears to nothing over a dark
  // ground and a glow behind the subject, tinted by what the stop lights
  let glow = null;
  const field = typeof BG === 'string' ? new THREE.Color(BG) : null;
  if (field && scene.background && scene.background.isColor && scene.background.getHex() === field.getHex()) {
    scene.background = null; renderer.setClearColor(0x000000, 0);
    host.style.isolation = 'isolate';
    host.style.background = field.clone().multiplyScalar(0.5).getStyle();
    glow = el('div', 'moj-tour-glow'); host.insertBefore(glow, host.firstChild);
  }
  const tints = new Map();
  function tint(names) {
    const key = names ? names.join('|') : '*';
    if (tints.has(key)) return tints.get(key);
    let r = 0, g = 0, b = 0, n = 0;
    for (const [gname, m] of Object.entries(meshes)) {
      if (!m || (names && !names.some((k) => gname === k || gname.startsWith(k + ':')))) continue;
      const col = m.geometry && m.geometry.attributes && m.geometry.attributes.color;
      if (col) { const step = Math.max(1, Math.floor(col.count / 400)); for (let i = 0; i < col.count; i += step) { r += col.getX(i); g += col.getY(i); b += col.getZ(i); n++; } }
      else if (m.material && m.material.color && !Array.isArray(m.material)) { r += m.material.color.r; g += m.material.color.g; b += m.material.color.b; n++; }
    }
    let c = null;
    if (n) {
      c = new THREE.Color(r / n, g / n, b / n);
      const hsl = {}; c.getHSL(hsl);
      c.setHSL(hsl.h, Math.min(0.75, hsl.s * 0.9 + 0.08), Math.max(0.2, Math.min(0.42, hsl.l * 0.8)));
    }
    tints.set(key, c);
    return c;
  }
  const cp = el('p', 'cp'); cp.setAttribute('aria-live', 'polite'); const mt = el('div', 'mt');
  plate.append(hd, cp, mt);
  const nv = el('div', 'nv'); const back = el('button', 'st', '\\u2039'); back.setAttribute('aria-label', 'previous stop');
  const on = el('button', 'st', '\\u203a'); on.setAttribute('aria-label', 'next stop'); const cr = el('div', 'cr');
  const crumbs = TR.stops.map((s, i) => { const b = el('button'); b.setAttribute('aria-label', 'stop ' + (i + 1) + (s.title ? ': ' + s.title : '')); b.onclick = () => go(i); cr.appendChild(b); return b; });
  nv.append(back, cr, on); root.append(plate, nv); host.appendChild(root);
  back.onclick = () => go(at - 1); on.onclick = () => go(at + 1);
  // the subject centred in the room above the plate, not behind it: the projection is shifted up by half the plate
  // (picks, signs and the guide project through the same camera, so they stay on what they mark)
  function room() {
    const w = wrap.clientWidth, h = wrap.clientHeight, ph = root.offsetHeight + 14;
    if (!(w > 0 && h > 0)) return;
    camera.setViewOffset(w, h, 0, Math.min(ph, h * 0.45) / 2, w, h); camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', room);

  // the part talked about lit, the rest dimmed (the focus verb's originals: one map, so the two never fight)
  function lit(names) {
    const want = names && names.length ? names : null;
    for (const [g, m] of Object.entries(meshes)) {
      if (!m || !m.material || Array.isArray(m.material)) continue;
      if (!__focusOrig.has(g)) __focusOrig.set(g, { transparent: m.material.transparent, opacity: m.material.opacity, depthWrite: m.material.depthWrite });
      if (hideable.some((h) => h.name === g)) continue;
      const o = __focusOrig.get(g);
      if (!want || want.some((n) => g === n || g.startsWith(n + ':'))) { m.material.transparent = o.transparent; m.material.opacity = o.opacity; m.material.depthWrite = o.depthWrite; }
      else { m.material.transparent = true; m.material.opacity = 0.12; m.material.depthWrite = false; }
      m.material.needsUpdate = true;
    }
  }
  // where a stop's camera stands: a world camera, a placed one, or a fit to its groups from a side
  function seat(c) {
    if (c.cam != null) { const k = CAMS[c.cam]; return { pos: k.pos, target: k.target, vfov: k.vfov, cam: c.cam }; }
    if (c.pos) return { pos: c.pos, target: c.target, vfov: c.vfov != null ? c.vfov : camera.fov };
    const box = new THREE.Box3(), part = new THREE.Box3();
    for (const [g, m] of Object.entries(meshes)) if (c.frame.some((n) => g === n || g.startsWith(n + ':'))) { part.setFromObject(m); if (!part.isEmpty()) box.union(part); }
    if (box.isEmpty()) return null;
    const ctr = box.getCenter(new THREE.Vector3()), rad = Math.max(box.getSize(new THREE.Vector3()).length() * 0.5, 0.5);
    const d = VIEW_DIRS[c.from] || VIEW_DIRS.threeQuarter, dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * (camera.aspect || 1));
    const dist = Math.max(rad / Math.tan(vf / 2), rad / Math.tan(hf / 2)) * 1.1;
    const p = ctr.clone().add(dir.multiplyScalar(dist));
    return { pos: [p.x, p.y, p.z], target: [ctr.x, ctr.y, ctr.z], vfov: camera.fov };
  }
  let flight = 0;
  // a capture is seated, never flown (the page's _capture is defined after this block, so the emitter says it here)
  const calm = ${capture ? 'true' : 'false'} || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function fly(s, instant) {
    if (typeof walkMode !== 'undefined' && walkMode) return;   // walking owns the camera; the plate still turns
    if (!s) return;
    if (typeof hud !== 'undefined' && hud && typeof CAMS !== 'undefined') [...hud.children].slice(0, CAMS.length).forEach((b, k) => b.classList.toggle('on', k === s.cam));
    controls.autoRotate = false;
    const p0 = camera.position.clone(), t0 = controls.target.clone(), f0 = camera.fov;
    const p1 = new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]), t1 = new THREE.Vector3(s.target[0], s.target[1], s.target[2]), f1 = s.vfov;
    const id = ++flight;
    const put = (k) => { camera.position.lerpVectors(p0, p1, k); controls.target.lerpVectors(t0, t1, k); camera.fov = f0 + (f1 - f0) * k; camera.updateProjectionMatrix(); controls.update(); };
    if (instant || calm) { put(1); return; }
    const T = 950, a = performance.now();
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    (function step() { if (id !== flight) return; const x = Math.min(1, (performance.now() - a) / T); put(ease(x)); if (x < 1) requestAnimationFrame(step); })();
  }
  let at = -1;
  function go(i, instant) {
    if (!(i >= 0 && i < N)) return;
    at = i; const s = TR.stops[i];
    no.textContent = (i + 1) + ' / ' + N; tt.textContent = s.title || '';
    cp.textContent = s.caption; mt.textContent = '';
    if (s.grade) { const g = el('span', 'gr'); const dot = el('i'); dot.style.background = TINT[s.grade]; g.append(dot, document.createTextNode(s.grade)); mt.appendChild(g); }
    if (s.shape) mt.appendChild(el('span', 'sh', SHAPE[s.shape]));
    if (s.cite) mt.appendChild(el('span', 'ct', s.cite.join(' \\u00b7 ')));
    mt.style.display = mt.childNodes.length ? '' : 'none';
    crumbs.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    back.disabled = i === 0; on.disabled = i === N - 1;
    lit(s.highlight || null);
    if (glow) { const c = tint(s.highlight || null) || tint(null); if (c) glow.style.backgroundColor = c.getStyle(); }
    room();
    fly(seat(s.camera), instant);
  }
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (typeof walkMode !== 'undefined' && walkMode) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown') { go(at + 1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { go(at - 1); e.preventDefault(); }
    else if (k === 'Home') { go(0); e.preventDefault(); }
    else if (k === 'End') { go(N - 1); e.preventDefault(); }
  });
  let sx = null;
  plate.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  plate.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) go(at + (dx < 0 ? 1 : -1)); });
  const Q = new URLSearchParams(location.search);
  const ask = Q.get('stop');
  let first = TR.start || 0;
  if (ask != null) { const byId = TR.stops.findIndex((s) => s.id === ask); const n = byId >= 0 ? byId : parseInt(ask, 10) - 1; if (n >= 0 && n < N) first = n; }
  go(first, true);

  // ---- the kiosk and the gallery ----
  const framed = window.parent !== window;
  const inGallery = framed && Q.get('gallery') === '1';
  const kq = Q.get('kiosk');
  const kiosk = ${capture ? 'false' : "kq != null && kq !== '0'"};
  const IDLE = kiosk ? Math.max(15, parseInt(kq, 10) || 90) * 1000 : 0;
  if (inGallery) label.style.display = 'none';
  if (kiosk) { root.classList.add('kiosk'); document.documentElement.classList.add('moj-kiosk'); document.addEventListener('contextmenu', (e) => e.preventDefault()); }
  const say = (m) => { if (framed) { try { window.parent.postMessage(m, '*'); } catch (err) { /* an opaque frame */ } } };
  // a stop is held as long as its caption takes to read, aloud or not: 7 to 20 seconds
  const hold = (s) => Math.min(20000, Math.max(7000, 2500 + (s.caption.split(/\s+/).length / 3.2) * 1000));
  const cue = el('div', 'moj-tour-cue', 'Touch to explore'); host.appendChild(cue);
  let playing = false, playTimer = 0, idleTimer = 0;
  function stop() { playing = false; clearTimeout(playTimer); cue.classList.remove('on'); }
  function play(from) {
    stop(); playing = true; cue.classList.add('on');
    go(from >= 0 && from < N ? from : 0);
    const tick = () => { playTimer = setTimeout(() => {
      if (!playing) return;
      if (at >= N - 1) { if (inGallery) { stop(); say({ moj: 'tour-end', count: N }); return; } go(0); } else go(at + 1);
      tick();
    }, hold(TR.stops[at])); };
    tick();
  }
  function rest() { clearTimeout(idleTimer); if (IDLE && !inGallery) idleTimer = setTimeout(() => play(TR.start || 0), IDLE); }
  function touched() { if (playing) stop(); say({ moj: 'tour-touch' }); rest(); }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, touched, { passive: true, capture: true }));
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (e.source !== window.parent || !d || typeof d.moj !== 'string') return;
    if (d.moj === 'tour-play') play(Number.isInteger(d.from) ? d.from : 0);
    else if (d.moj === 'tour-stop') stop();
    else if (d.moj === 'tour-go' && Number.isInteger(d.i)) { stop(); go(d.i); }
  });
  // where the stop's lit parts land: their box projected through the camera (its offset too), measured against the room
  // above the plate. The exhibit audit's page half reads it (scripts/exhibit-audit.mjs); a stop that lights nothing is
  // not measured (its view is the whole world's).
  function view() {
    const s = TR.stops[at], names = s && s.highlight;
    if (!names || !names.length) return { at, id: s && s.id, framed: null };
    const box = new THREE.Box3(), part = new THREE.Box3();
    for (const [g, m] of Object.entries(meshes)) if (m && names.some((n) => g === n || g.startsWith(n + ':'))) { part.setFromObject(m); if (!part.isEmpty()) box.union(part); }
    if (box.isEmpty()) return { at, id: s.id, framed: false, onScreen: 0, share: 0 };
    camera.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = 0;
    for (let k = 0; k < 8; k++) {
      const v = new THREE.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera);
      if (v.z > 1) behind += 1;
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const h = wrap.clientHeight || 1, floor = -1 + 2 * Math.min(root.offsetHeight + 14, h * 0.45) / h;
    const span = (a, b, lo, hi) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));
    const area = (x1 - x0) * (y1 - y0), seen = span(x0, x1, -1, 1) * span(y0, y1, floor, 1);
    return { at, id: s.id, onScreen: area > 0 ? seen / area : 0, share: seen / (2 * (1 - floor)), behind };
  }
  rest();
  say({ moj: 'tour-ready', count: N, title: TR.title || '' });
  window.__mojTour = { get at() { return at; }, count: N, ids: TR.stops.map((s) => s.id), go: (i, instant) => go(i, instant), next: () => go(at + 1), prev: () => go(at - 1),
    get playing() { return playing; }, play: (i) => play(i == null ? 0 : i), stop, kiosk, view };
})();
`;
}
