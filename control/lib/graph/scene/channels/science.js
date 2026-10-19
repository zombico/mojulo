import { safeJson } from '../emit-util.js';
import { CAPTURE_GLOBAL, CAPTURE_FRAME } from '../capture-contract.js';

// In-page script: the SCIENCE channel (opt-in via emitThreeWorld({ science }) — a science world's page: the
// classical kind today). Bespoke, not a registry row, so a page without it is byte-identical. Three parts:
//
//   the READOUT — the system, not one body: the clock in the model's own time, then the scale's ROWS, each a
//     per-sample series with a label and a unit, drawn as a bar (against the row's `max`) or as a line of text
//     (a classical world's energy and momentum, a microscopic world's counts). It plays on the movers' clock (the
//     same play → hold → replay cycle, the same sample index), so a number never disagrees with the picture. When
//     the movers made a readout (their arrows are on) this takes it over, since it runs after them in __mojStep.
//   the HONESTY PANEL — "What's real · what's drawn": the laws the model runs, the checks the solver ran on it
//     (the machine gate, with its numbers), what the model leaves out, and every liberty the drawing takes.
//     Built with textContent, never innerHTML, from strings the recipe supplied.
//   LABELS — a name over each moving body, projected every frame (a signage anchor is fixed at first sight;
//     these bodies move).
//   THE FILM (capture runs only — a film's viewer cannot open a panel): CALLOUTS, captions on the page clock, one
//     pinned beside a body when it names one; the SLOW-MOTION TAG while a stretched shot plays (the capture frame
//     says which shot, `__sciShot`); and the END CARD, the honesty panel as the film's last shot, with the film's
//     own liberties added. On a capture run the panel itself is not drawn: the card says it instead.
//
// The numbers are the solver's, recorded per sample; the page computes nothing physical, except a shader-drawn page's
// picture (science-worlds/shader.js), which the conformance gate holds to the solver: on a capture run with a `probe`,
// THE PROBE BRIDGE evaluates the page's own model function at given inputs into a float target (`__sciProbe`) and
// reads a rendered frame back (`__sciPixels`). An ordinary page carries none of it.
export function scienceChannelScript(cfg, probe = null) {
  return `${probe ? probeBridge(probe) : ''}
// ---- science channel: the system readout, the honesty panel, body labels ----
const SCI = ${safeJson(cfg)};
function _sciFmt(v, unit) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0 ' + unit;
  // a compound unit takes no prefix (a 'Tkg·m/s' reads wrong): powers of ten instead, outside the plain range
  if (unit.indexOf('·') >= 0) return (a >= 1e-3 && a < 1e6 ? v.toPrecision(3) : v.toExponential(2).replace('e+', 'e')) + ' ' + unit;
  if (a >= 1e15 || a < 1e-18) return v.toExponential(2).replace('e+', 'e') + ' ' + unit;   // past the prefixes
  const P = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  for (const [f, p] of P) if (a >= f * 0.9995) return (v / f).toPrecision(3) + ' ' + p + unit;
  return v.toExponential(2) + ' ' + unit;
}
function _sciTime(s) {
  const a = Math.abs(s);
  if (a >= 3.15576e7 * 0.9995) return (s / 3.15576e7).toPrecision(3) + ' yr';
  if (a >= 86400 * 0.9995) return (s / 86400).toPrecision(3) + ' d';
  if (a >= 3600 * 0.9995) return (s / 3600).toPrecision(3) + ' h';
  return _sciFmt(s, 's');
}
function _sciU(sec) {
  const cycle = SCI.period + SCI.hold, ph = sec % cycle;
  return ph < SCI.period ? ph / SCI.period : 1;
}
const _sciEl = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
let _sciRo = null, __sciShot = -1;
const _sciFilm = SCI.capture && SCI.film ? SCI.film : null;
if (SCI.hud) {
  _sciRo = (typeof _readout !== 'undefined' && _readout) || null;
  if (!_sciRo) { _sciRo = _sciEl('div'); _sciRo.className = 'moj-readout'; wrap.appendChild(_sciRo); }
  // the honesty panel: closed by default, opened by its summary; a capture run tells it on the end card instead
  if (!_sciFilm) {
  const box = _sciEl('details', 'position:absolute;right:8px;bottom:8px;max-width:340px;max-height:70%;overflow:auto;background:rgba(11,18,32,.88);border:1px solid #24324a;border-radius:6px;padding:6px 10px;font-size:12px;color:#cfe3ff;z-index:5');
  box.className = 'moj-honesty';
  const sum = _sciEl('summary', 'cursor:pointer;font-weight:600', SCI.honesty.title);
  box.appendChild(sum);
  for (const sec of SCI.honesty.sections) {
    if (!sec.items.length) continue;
    box.appendChild(_sciEl('div', 'margin-top:6px;font-weight:600;color:' + sec.color, sec.head));
    for (const it of sec.items) {
      const row = _sciEl('div', 'margin:2px 0 0 8px;line-height:1.35');
      if (it.mark) row.appendChild(_sciEl('span', 'color:' + (it.ok ? '#55e08a' : '#ffb347') + ';margin-right:4px', it.ok ? '✓' : '⚠'));
      row.appendChild(_sciEl('span', '', it.text));
      if (it.note) row.appendChild(_sciEl('span', 'opacity:.7;margin-left:4px', it.note));
      box.appendChild(row);
    }
  }
  wrap.appendChild(box);
  }
}
// the film's overlays: callout captions, the slow-motion tag, the end card (built once, shown by the clock)
const _sciCaps = _sciFilm ? _sciFilm.callouts.map((c) => {
  const e = _sciEl('div', c.group
    ? 'position:absolute;transform:translate(-50%,-180%);font-size:15px;font-weight:600;color:#fff;background:rgba(20,30,52,.86);border:1px solid #4f6fa8;padding:4px 9px;border-radius:5px;pointer-events:none;max-width:46%;z-index:6;display:none'
    : 'position:absolute;left:50%;top:7%;transform:translateX(-50%);font-size:17px;font-weight:600;color:#fff;background:rgba(20,30,52,.86);border:1px solid #4f6fa8;padding:6px 12px;border-radius:6px;pointer-events:none;max-width:80%;text-align:center;z-index:6;display:none', c.text);
  wrap.appendChild(e); return { c, e };
}) : [];
const _sciSlow = _sciFilm ? _sciEl('div', 'position:absolute;right:10px;top:10px;font-size:13px;font-weight:600;color:#ffd36b;background:rgba(11,18,32,.8);border:1px solid #6b5a2a;padding:3px 8px;border-radius:4px;pointer-events:none;z-index:6;display:none') : null;
if (_sciSlow) wrap.appendChild(_sciSlow);
const _sciEnd = _sciFilm && _sciFilm.end ? (() => {
  const card = _sciEl('div', 'position:absolute;inset:0;background:rgba(8,12,22,.94);color:#e6eefc;font-size:12px;padding:16px 22px;overflow:hidden;z-index:7;display:none');
  card.appendChild(_sciEl('div', 'font-size:18px;font-weight:700;margin-bottom:2px', SCI.honesty.title.split(' · ⚠')[0]));
  card.appendChild(_sciEl('div', 'opacity:.75;margin-bottom:6px', SCI.titleText + ' · ' + SCI.honesty.checks.held + ' of ' + SCI.honesty.checks.of + ' checks held'));
  const secs = SCI.honesty.sections.map((sec) => sec.head === 'Drawn, not real' ? { ...sec, items: [...sec.items, ..._sciFilm.liberties.map((l) => ({ text: l.what, note: l.why ? '(' + l.why + ')' : '' }))] } : sec);
  for (const sec of secs) {
    if (!sec.items.length) continue;
    card.appendChild(_sciEl('div', 'margin-top:7px;font-weight:600;color:' + sec.color, sec.head));
    for (const it of sec.items) {
      const row = _sciEl('div', 'margin:1px 0 0 8px;line-height:1.3');
      if (it.mark) row.appendChild(_sciEl('span', 'color:' + (it.ok ? '#55e08a' : '#ffb347') + ';margin-right:4px', it.ok ? '✓' : '⚠'));
      row.appendChild(_sciEl('span', '', it.text));
      card.appendChild(row);
    }
  }
  wrap.appendChild(card); return card;
})() : null;
const _sciLabels = SCI.hud ? SCI.labels.map((l) => {
  const e = _sciEl('div', 'position:absolute;transform:translate(-50%,-140%);font-size:11px;color:#e9eefa;background:rgba(11,18,32,.6);padding:1px 5px;border-radius:3px;pointer-events:none;white-space:nowrap;z-index:4', l.text);
  wrap.appendChild(e); return { l, e };
}) : [];
const _sciV = new THREE.Vector3();
function stepScience(t) {
  const sec = t / 1000, u = _sciU(sec), N = SCI.t.length, i = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
  if (_sciFilm) {
    const ph = sec % (SCI.period + SCI.hold);
    for (const { c, e } of _sciCaps) {
      const on = ph >= c.from && ph <= c.to;
      e.style.display = on ? '' : 'none';
      if (on && c.group) {
        const m = meshes[c.group];
        if (m) { m.getWorldPosition(_sciV); _sciV.project(camera); e.style.left = ((_sciV.x + 1) / 2 * 100) + '%'; e.style.top = ((1 - _sciV.y) / 2 * 100) + '%'; }
      }
    }
    const sp = __sciShot >= 0 ? _sciFilm.speeds[__sciShot] : 1;
    if (_sciSlow) { _sciSlow.style.display = sp && sp < 1 ? '' : 'none'; if (sp && sp < 1) _sciSlow.textContent = 'slow motion · ' + (Math.round(10 / sp) / 10) + '× slower'; }
    if (_sciEnd) _sciEnd.style.display = ph >= _sciFilm.end.from && ph <= _sciFilm.end.to ? '' : 'none';
  }
  for (const { l, e } of _sciLabels) {
    const m = meshes[l.group];
    if (!m) { e.style.display = 'none'; continue; }
    m.getWorldPosition(_sciV); _sciV.z += l.lift; _sciV.project(camera);
    if (_sciV.z > 1) { e.style.display = 'none'; continue; }
    e.style.display = ''; e.style.left = ((_sciV.x + 1) / 2 * 100) + '%'; e.style.top = ((1 - _sciV.y) / 2 * 100) + '%';
  }
  if (!_sciRo) return;
  let h = '<b>' + SCI.titleHtml + '</b>' + (SCI.noClock ? '' : '<span>t = ' + _sciTime(SCI.t[i]) + '</span>'), bars = '';
  const val = (r) => (r.int ? String(Math.round(r.values[i])) + (r.unit ? ' ' + r.unit : '') : _sciFmt(r.values[i], r.unit));
  const flush = () => { if (bars) { h += '<div style="width:' + SCI.barWidth + 'px;margin-top:4px">' + bars + '</div>'; bars = ''; } };
  for (const r of SCI.rows) {
    if (r.bar) {
      bars += '<div style="display:flex;align-items:center;gap:5px;margin-top:2px"><span style="width:' + SCI.labelWidth + 'px;color:' + r.color + '">' + r.html + '</span>'
        + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden"><span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, r.values[i] / r.max))) + '%;background:' + r.color + '"></span></span>'
        + '<span style="width:64px;text-align:right;opacity:.78">' + val(r) + '</span></div>';
    } else { flush(); h += '<span' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + r.html + ' = ' + val(r) + (r.suffix || '') + '</span>'; }
  }
  flush();
  _sciRo.innerHTML = h;
}
`;
}

function probeBridge(probe) {
  return `
// ---- science probe bridge (capture runs only): the shader's model function, read back for the conformance gate ----
const SCI_PROBE = ${safeJson(probe)};
window.__sciProbe = (pairs) => {
  const N = pairs.length, data = new Float32Array(N * 8);
  pairs.forEach((p, i) => { data.set(p[0], i * 8); data.set(p[1] || [0, 0, 0, 0], i * 8 + 4); });
  const tex = new THREE.DataTexture(data, 2 * N, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const uniforms = { uTime: { value: 0 }, uPts: { value: tex }, uN: { value: N } };
  for (const [k, v] of Object.entries(SCI_PROBE.uniforms)) uniforms[k] = { value: Array.isArray(v) ? new THREE.Vector3(v[0], v[1], v[2]) : v };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: SCI_PROBE.frag });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(quad);
  const rt = new THREE.WebGLRenderTarget(N, 1, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt); renderer.render(sc, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  const out = new Float32Array(N * 4); renderer.readRenderTargetPixels(rt, 0, 0, N, 1, out);
  renderer.setRenderTarget(prev); rt.dispose(); mat.dispose(); tex.dispose();
  return Array.from(out);
};
window.__sciPixels = (spec) => {
  window.${CAPTURE_GLOBAL}.${CAPTURE_FRAME}(spec);   // renders; the drawing buffer is read before it is presented
  const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { width: w, height: h, rgba: btoa(s) };
};
`;
}
