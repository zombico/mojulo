/**
 * A FIND, REVEALED (prospect/specimens.js): as a scan confirms what lies under it (the objectives' `objective:found`
 * for a task that names a specimen), the game stops for it (the world frozen, the pilot's keys held: the menus'
 * freeze) and the find is shown: its specimen drawn in wireframe in its own colour, its lines laid one after another
 * until it stands whole, then turning, glowing; "Sample confirmed", its name, its grade, its yield counted up to what
 * the scan reckons (≈ amount unit), what it is good for, logged; a chime rising as it is laid. It stands `hold` s, or
 * until a key after `least` s, then fades and the play goes on. Drawn in the level's look (game.look) where it has one.
 * Emitted only on a page whose level names finds: every other page byte-identical.
 *
 *   FIND_REVEAL                 the timings and sizes: { lay (s, the lines laid), hold, least, fade, spin (rad/s), size (px) }
 *   findRevealScript(finds)     → in-page; finds: [{ task, name, grade, about?, amount?: { approx, unit }, wire: { lines, colour } }]
 *   window.__mojFind            { up: false | { task, name }, shown: n } (a probe's: what was revealed)
 */
import { safeJson } from '../emit-util.js';

export const FIND_REVEAL = Object.freeze({ lay: 1.4, hold: 5.5, least: 1.6, fade: 0.6, spin: 0.55, size: 300 });

export function findRevealScript(finds) {
  const R = FIND_REVEAL;
  return `
// A FIND, REVEALED (find-reveal.js): a scan's specimen shown, the game stopped for it
(function () {
  const FINDS = ${safeJson(finds)}, R = ${safeJson(R)};
  const css = '.moj-find{position:fixed;inset:0;z-index:58;display:flex;align-items:center;justify-content:center;background:rgba(2,4,6,.62);opacity:0;transition:opacity .45s ease;font-family:var(--fd-font,system-ui,sans-serif);color:var(--fd-ink,#e9edee)}'
    + '.moj-find .p{display:flex;gap:30px;align-items:center;padding:26px 34px;border:1px solid var(--fd-line,#5d6a70);background:var(--fd-plate,rgba(13,17,20,.86));position:relative}'
    + '.moj-find .p i{position:absolute;width:16px;height:16px;border:2px solid var(--fd-accent,#9fd2d6)}.moj-find .p i.a{left:-6px;top:-6px;border-right:0;border-bottom:0}.moj-find .p i.b{right:-6px;top:-6px;border-left:0;border-bottom:0}.moj-find .p i.c{left:-6px;bottom:-6px;border-right:0;border-top:0}.moj-find .p i.d{right:-6px;bottom:-6px;border-left:0;border-top:0}'
    + '.moj-find canvas{display:block}.moj-find .k{font-size:12px;letter-spacing:.5em;text-transform:uppercase;color:var(--fd-accent2,#e3c98a)}'
    + '.moj-find .n{font-size:clamp(24px,3.4vw,38px);font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin:6px 0 10px}'
    + '.moj-find .g{display:inline-block;padding:3px 10px;border:1px solid currentColor;font-size:12px;letter-spacing:.3em;text-transform:uppercase}'
    + '.moj-find .y{margin-top:16px;font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.2em;text-transform:uppercase;opacity:.8}'
    + '.moj-find .v{font-family:ui-monospace,Menlo,monospace;font-size:clamp(26px,3vw,34px);color:var(--fd-accent,#9fd2d6);margin-top:2px}'
    + '.moj-find .a{margin-top:12px;max-width:300px;font-size:14px;line-height:1.45;opacity:.85}.moj-find .l{margin-top:14px;font-size:11px;letter-spacing:.32em;text-transform:uppercase;opacity:0;transition:opacity .4s ease}';
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.__mojFind = { up: false, shown: 0 };
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function look(el) {
    const L = (typeof __GAME !== 'undefined' && __GAME && __GAME.look) || {}, hex = /^#[0-9a-fA-F]{6}$/;
    for (const k of ['ink', 'line', 'accent', 'accent2']) if (hex.test(L[k] || '')) el.style.setProperty('--fd-' + k, L[k]);
    if (hex.test(L.panel || '')) { const h = L.panel; el.style.setProperty('--fd-plate', 'rgba(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16) + ',.88)'); }
  }
  let ctx = null;
  function chime() {
    try {
      if (typeof __beatsMuted !== 'undefined' && __beatsMuted) return;
      const c = (typeof __beatsCtx !== 'undefined' && __beatsCtx) || ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());
      if (c.state === 'suspended') c.resume().catch(() => {});
      // (a rising arpeggio, bell-like: a sine and its octave, each note ringing out)
      [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
        const t = c.currentTime + 0.05 + i * 0.13, g = c.createGain(); g.connect(c.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        for (const m of [1, 2]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz * m; const og = c.createGain(); og.gain.value = m === 1 ? 1 : 0.25; o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.5); }
      });
    } catch (e) { /* (no audio: the find is shown alone) */ }
  }
  function show(F) {
    const el = document.createElement('div'); el.className = 'moj-find'; look(el);
    const A = F.amount;
    el.innerHTML = '<div class="p"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><canvas width="' + R.size * 2 + '" height="' + R.size * 2 + '" style="width:' + R.size + 'px;height:' + R.size + 'px"></canvas><div>'
      + '<div class="k">Sample confirmed</div><div class="n">' + esc(F.name) + '</div><div class="g" style="color:' + esc(F.wire.colour) + '">' + esc(F.grade) + '</div>'
      + (A ? '<div class="y">Estimated yield</div><div class="v">\\u2248 <span class="num">0</span> ' + esc(A.unit) + '</div>' : '')
      + (F.about ? '<div class="a">' + esc(F.about) + '</div>' : '') + '<div class="l">+ Logged to the survey</div></div></div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    const cv = el.querySelector('canvas'), g = (cv.getContext && cv.getContext('2d')) || null, L = F.wire.lines, n = L.length / 6, num = el.querySelector('.num'), logged = el.querySelector('.l');
    const t0 = performance.now(); let done = false, closing = false;
    window.__mojFreeze = true; window.__mojMenuOpen = true; window.__mojFind.up = { task: F.task, name: F.name }; window.__mojFind.shown++;
    chime();
    function frame() {
      if (done) return;
      const u = (performance.now() - t0) / 1000, W = cv.width, s = W * 0.36, cx = W / 2, cy = W / 2;
      if (g) {
      g.clearRect(0, 0, W, W);
      // (a faint ring and a scan line under it: the scanner's view)
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, W * 0.44, 0, Math.PI * 2); g.stroke();
      const sweep = cy - W * 0.44 + ((u * 0.6) % 1) * W * 0.88; g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(cx - W * 0.44, sweep); g.lineTo(cx + W * 0.44, sweep); g.stroke();
      const yaw = 0.5 + u * R.spin, pit = 0.42 + 0.08 * Math.sin(u * 0.7), a = Math.cos(yaw), b = Math.sin(yaw), c = Math.cos(pit), d = Math.sin(pit);
      const P = (i) => { const x = L[i], y = L[i + 1], z = L[i + 2], X = x * a - y * b, Y = x * b + y * a; return [cx + X * s * 1.55, cy - (z * c - Y * d) * s * 1.55]; };
      // (the lines laid one after another, each drawn out from its first end, until it stands whole; then a glow on it)
      g.lineCap = 'round'; g.strokeStyle = F.wire.colour; g.shadowColor = F.wire.colour;
      for (let k = 0; k < n; k++) {
        const due = (k / n) * R.lay, f = Math.max(0, Math.min(1, (u - due) / 0.25)); if (f <= 0) continue;
        const p = P(k * 6), q = P(k * 6 + 3), e = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
        g.lineWidth = 3; g.shadowBlur = u > R.lay ? 14 + 6 * Math.sin(u * 3) : 8; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(e[0], e[1]); g.stroke();
        if (f < 1) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(e[0], e[1], 4, 0, Math.PI * 2); g.fill(); }
      }
      g.shadowBlur = 0;
      }
      if (A && num) { const k = Math.min(1, Math.max(0, (u - 0.3) / R.lay)), e = 1 - Math.pow(1 - k, 3); num.textContent = (A.approx * e).toFixed(A.approx < 10 ? 1 : 0); }
      if (u > R.lay + 0.2) logged.style.opacity = '1';
      if (!closing && u > R.hold) close();
      requestAnimationFrame(frame);
    }
    function close() {
      if (closing) return; closing = true;
      el.style.opacity = '0'; window.removeEventListener('keydown', key, true);
      setTimeout(() => { done = true; el.remove(); window.__mojFreeze = false; window.__mojMenuOpen = false; window.__mojFind.up = false; }, R.fade * 1000);
    }
    const key = () => { if ((performance.now() - t0) / 1000 > R.least) close(); };
    window.addEventListener('keydown', key, true);
    requestAnimationFrame(frame);
  }
  // (each task's find, raised as the objectives say it was found: read off the level's bus as it logs)
  let seen = 0;
  (function watch() {
    const B = window.__mojBus, log = B && B.state && B.state.log;
    if (log) {
      if (log.length < seen) seen = 0;
      for (; seen < log.length; seen++) { const ev = log[seen]; if (ev && ev.type === 'objective:found') { const F = FINDS.find((x) => x.task === ev.task); if (F) show(F); } }
    }
    requestAnimationFrame(watch);
  })();
})();
`;
}
