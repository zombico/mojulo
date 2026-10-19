import { safeJson } from '../emit-util.js';

// In-page script: the SCIENCE channel (opt-in via emitThreeWorld({ science }) — a science world's page: the
// classical kind today). Bespoke, not a registry row, so a page without it is byte-identical. Three parts:
//
//   the READOUT — the system, not one body: the clock in the model's own time, the energy (kinetic, potential
//     above its lowest, and the total), the momentum when nothing outside acts, and a speed line per body the
//     model observes. It plays on the movers' clock (the same play → hold → replay cycle, the same sample
//     index), so a number never disagrees with the picture. When the movers made a readout (their arrows are
//     on) this takes it over, since it runs after them in __mojStep.
//   the HONESTY PANEL — "What's real · what's drawn": the laws the model runs, the checks the solver ran on it
//     (the machine gate, with its numbers), what the model leaves out, and every liberty the drawing takes.
//     Built with textContent, never innerHTML, from strings the recipe supplied.
//   LABELS — a name over each moving body, projected every frame (a signage anchor is fixed at first sight;
//     these bodies move).
//
// The numbers are the solver's, recorded per sample; the page computes nothing physical.
export function scienceChannelScript(cfg) {
  return `
// ---- science channel: the system readout, the honesty panel, body labels ----
const SCI = ${safeJson(cfg)};
function _sciFmt(v, unit) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0 ' + unit;
  // a compound unit takes no prefix (a 'Tkg·m/s' reads wrong): powers of ten instead, outside the plain range
  if (unit.indexOf('·') >= 0) return (a >= 1e-3 && a < 1e6 ? v.toPrecision(3) : v.toExponential(2).replace('e+', 'e')) + ' ' + unit;
  if (a >= 1e15 || a < 1e-12) return v.toExponential(2).replace('e+', 'e') + ' ' + unit;   // past the prefixes
  const P = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
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
let _sciRo = null;
if (SCI.hud) {
  _sciRo = (typeof _readout !== 'undefined' && _readout) || null;
  if (!_sciRo) { _sciRo = _sciEl('div'); _sciRo.className = 'moj-readout'; wrap.appendChild(_sciRo); }
  // the honesty panel: closed by default, opened by its summary; captures see the summary line only
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
const _sciLabels = SCI.hud ? SCI.labels.map((l) => {
  const e = _sciEl('div', 'position:absolute;transform:translate(-50%,-140%);font-size:11px;color:#e9eefa;background:rgba(11,18,32,.6);padding:1px 5px;border-radius:3px;pointer-events:none;white-space:nowrap;z-index:4', l.text);
  wrap.appendChild(e); return { l, e };
}) : [];
const _sciV = new THREE.Vector3();
function stepScience(t) {
  const sec = t / 1000, u = _sciU(sec), N = SCI.t.length, i = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
  for (const { l, e } of _sciLabels) {
    const m = meshes[l.group];
    if (!m) { e.style.display = 'none'; continue; }
    m.getWorldPosition(_sciV); _sciV.z += l.lift; _sciV.project(camera);
    if (_sciV.z > 1) { e.style.display = 'none'; continue; }
    e.style.display = ''; e.style.left = ((_sciV.x + 1) / 2 * 100) + '%'; e.style.top = ((1 - _sciV.y) / 2 * 100) + '%';
  }
  if (!_sciRo) return;
  const s = SCI.series;
  let h = '<b>' + SCI.titleHtml + '</b><span>t = ' + _sciTime(SCI.t[i]) + '</span>';
  if (s.ke) {
    const bar = (lab, val, col) => '<div style="display:flex;align-items:center;gap:5px;margin-top:2px"><span style="width:18px;color:' + col + '">' + lab + '</span>'
      + '<span style="flex:1;height:6px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden"><span style="display:block;height:100%;width:' + (100 * Math.max(0, Math.min(1, val / s.emax))) + '%;background:' + col + '"></span></span>'
      + '<span style="width:64px;text-align:right;opacity:.78">' + _sciFmt(val, 'J') + '</span></div>';
    h += '<div style="width:200px;margin-top:4px">' + bar('KE', s.ke[i], '#55e08a') + bar('PE', s.pe[i] - s.peMin, '#5fa9e0') + '</div>'
      + '<span>E = ' + _sciFmt(s.e[i], 'J') + (SCI.conserves ? ' · holds' : ' · leaving') + '</span>';
  }
  if (s.p) h += '<span>|p| = ' + _sciFmt(s.p[i], 'kg·m/s') + ' · conserved</span>';
  for (const b of SCI.speeds) h += '<span class="v">' + b.html + ' = ' + _sciFmt(b.v[i], 'm/s') + '</span>';
  _sciRo.innerHTML = h;
}
`;
}
