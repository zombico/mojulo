/**
 * THE UI BOARD — a world's UI direction drawn for approval before it is created, as one HTML page built from tracked
 * PIECES (era/art-board-html.js is the model, and its chrome is copied, not redesigned). Every piece is a pure function
 * with a stable id, so a piece can be generated on its own, kept, and compared:
 *
 *   ui:guide               the style guide: the register on its slider, every dial and token tagged with its source
 *   ui:motion              each motion as a strip of frames
 *   ui:part:<part>.<var>[:<binds>]  a part in each appearance state, in values first, then dressed by the guide (on a
 *                          world's board one per part it declares, keyed by its var or event; on the sheet one per variant)
 *   ui:layout              the region grid, the parts in it, the budget and the advice
 *   ui:wireframe:<phase>   one black-and-white frame per phase: boxes only, so structure is approved apart from look
 *   ui:cues                every cue as when → then → until, and whether the page draws it yet
 *   ui:menu:<id>           a menu in values, then dressed by the guide (its plate raised to solid: it reads over play)
 *
 *   uiBoardHtml(manifest)    the board for a world with play.ui (as the page a viewer opens)
 *   uiSheetHtml(opts)        THE REFERENCE SHEET: every part × variant × state at a register, pre-generated once per
 *                            register and kept (the outdoor master index, era/out-index-html.js, is the precedent)
 *   boardPieceIds(manifest)  the ids the board is assembled from
 *   uiBoardPagePng(manifest) the page laid out by a local Chromium (scene-png.js)
 *
 * The specimens use the HUD page's own sheet (scene/channels/events.js HUD_CSS) and the register's dom backend
 * (register.js registerCss), so what the board shows is what the page draws.
 */
import { HUD_CSS, MENU_CSS } from '../../scene/channels/events.js';
import { styleVars, colorCss, FONTS } from '../../game/hud-widgets.js';
import { PARTS, PART_IDS, UI_STATES, readPart } from './parts.js';
import { UI_REGIONS, REGION_CELLS, REGION_BUDGETS, regionClass } from './regions.js';
import { REGISTER_STOPS, STOP_IDS, DIAL_IDS, DIAL_ABOUT, registerCss, dialsAt, stopOf, fontOfType } from './register.js';
import { motionSheet } from './motion.js';
import { borderCss, BORDER_ELEMENTS } from './borders.js';
import { UI_ITEMS, GREYBOX_TOKENS, phasesOf } from './direction.js';
import { uiAdvice, DEFAULT_REGION, MOMENTS, FOCUS } from './laws.js';
import { readCues } from './cues.js';
import { CAST_WHEN } from './cast.js';
import { readMenus, openers, MENU_KINDS, menuPages, menuHtml } from './menus.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STATUS = { proposed: '#e8b04a', approved: '#6cc070', auto: '#8a93a6' };
const TITLES = { guide: 'Style guide', motion: 'Motion', parts: 'Parts', layout: 'Layout', wireframes: 'Wireframes' };

// the board's chrome: art-board-html.js's, verbatim where it applies
const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#14161a;color:#e9e4da;font:13px/1.35 Helvetica,Arial,sans-serif}
#board{width:1200px;padding:18px 20px 20px}
h1{font-size:22px;margin:0;letter-spacing:.02em}
.lede{color:#9a958c;font-size:12px;margin:3px 0 12px}
.row{display:grid;gap:10px;margin-bottom:10px}
.r1{grid-template-columns:1fr 1fr}.r3{grid-template-columns:1fr 1fr}
.card{background:#1e2026;border-radius:6px;padding:12px 14px;min-width:0}
.card header{display:flex;justify-content:space-between;align-items:center;gap:8px}
.card h2{font-size:15px;margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.badge{border:1.5px solid;border-radius:10px;padding:1px 10px;font-size:11px;font-weight:700;text-transform:uppercase;white-space:nowrap}
.note{color:#9a958c;font-size:12px;margin:2px 0 8px}
table{border-collapse:collapse;width:100%;font-size:12px}td{padding:2px 6px 2px 0;vertical-align:top}td.src{color:#9a958c;white-space:nowrap}td.about{color:#9a958c}
.sw{display:inline-block;width:28px;height:18px;border-radius:3px;vertical-align:middle;border:1px solid #333}
.toks{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:6px 0}.toks code{display:block;color:#9a958c;font-size:10px}
.slider{position:relative;height:30px;margin:6px 4px 14px}.slider .track{position:absolute;left:0;right:0;top:12px;height:4px;background:#45484f;border-radius:2px}
.slider .tick{position:absolute;top:6px;width:1px;height:16px;background:#9a958c}.slider .tick span{position:absolute;top:18px;left:-30px;width:60px;text-align:center;font-size:10px;color:#9a958c}
.slider .knob{position:absolute;top:5px;width:14px;height:18px;margin-left:-7px;background:#e8b04a;border-radius:3px}
.strip{display:grid;grid-template-columns:96px 1fr 120px;gap:8px;align-items:center;margin:3px 0}.strip small{color:#9a958c}
.specs{display:grid;grid-template-columns:150px repeat(${UI_STATES.length},1fr);gap:6px 8px;align-items:center}
.specs .h{color:#9a958c;font-size:11px;text-transform:uppercase}
.pu-stage{position:relative;padding:12px;border-radius:3px;min-height:46px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.pu-stage .moj-w{position:relative;zoom:.78}.pu-stage .moj-w-banner{zoom:.42}.pu-stage .moj-w-legend{zoom:.64}
.pu-hidden{opacity:.12;outline:1px dashed #888}.pu-focus{outline:2px solid var(--moj-accent);outline-offset:2px}.pu-active{color:var(--moj-accent)!important}
.pu-disabled{opacity:.4;filter:grayscale(1)}.pu-alert{color:var(--moj-harm)!important}
.grid9{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.grid9>div{background:#2b2d33;border-radius:2px;padding:6px;min-height:58px;font-size:11px}
.grid9 b{display:block;color:#9a958c;font-weight:400;font-size:10px;text-transform:uppercase}.grid9 .over{outline:1.5px solid #e8b04a}
.wfs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.wf small{color:#9a958c;display:block;margin-bottom:3px}
table.cues td{padding:3px 10px 3px 0}.mns{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}.mn-pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}.mn-pair .pu-stage{align-items:flex-start;zoom:.8}table.cues small{color:#9a958c}
ul.adv{margin:6px 0 0;padding-left:16px;color:#e8b04a;font-size:12px}
svg{display:block;width:100%;height:auto}
[data-piece]{display:contents}
.pu-stage .moj-w-ledger,.pu-stage .moj-w-allocator,.pu-stage .moj-w-scoreboard,.pu-stage .moj-w-queue,.pu-stage .moj-w-alerts{zoom:.56}
.pu-stage .moj-w-nameplate{zoom:.7}.pu-stage .moj-w-forecast{zoom:.62}
.pu-stage .pu-bare,.pu-stage .pu-bare::before,.pu-stage .pu-bare::after{background:none!important;border:0!important;box-shadow:none!important;outline:0!important;clip-path:none!important;padding:0!important;content:none!important}
`;

// the board-first parts' sheet: drawn here before their page renderer lands (it becomes the page's sheet then), in the
// page's tokens only, so the guide and the borders dress them like any part
const PROPOSED_CSS = [
  '.moj-w .pu-tab{border-collapse:collapse;width:auto;font-size:13px}.moj-w .pu-tab td{padding:1px 8px 1px 0;vertical-align:middle}',
  '.moj-w .pu-tab th{font-size:10px;letter-spacing:1px;text-transform:uppercase;opacity:.7;text-align:left;padding:0 8px 2px 0}',
  '.moj-w .pu-num{font-variant-numeric:tabular-nums;text-align:right}.moj-w .pu-dim{opacity:.6}',
  '.moj-w-ledger,.moj-w-allocator,.moj-w-queue,.moj-w-alerts,.moj-w-scoreboard{white-space:nowrap;display:flex;flex-direction:column;gap:3px}',
  '.moj-w-forecast,.moj-w-trend{display:flex;align-items:center;gap:8px;font-size:13px}',
  '.moj-w .pu-step{display:inline-block;width:16px;border:1px solid var(--moj-line);text-align:center;line-height:14px}',
  '.moj-w .pu-slots{display:flex;gap:3px}.moj-w .pu-slot{width:14px;height:14px;border:1px solid var(--moj-line)}',
  '.moj-w .pu-slot.on{background:linear-gradient(90deg,currentColor 55%,transparent 55%)}.moj-w .pu-slot.next{background:var(--moj-line)}',
  '.moj-w .pu-mini{display:inline-block;width:60px;height:5px;background:rgba(255,255,255,.15);vertical-align:middle}.moj-w .pu-mini i{display:block;height:100%;background:currentColor}',
  '.moj-w-nameplate{display:flex;align-items:center;gap:5px;font-size:12px;padding:2px 6px}.moj-w .pu-mark{width:10px;height:10px;display:inline-block}',
  '.pu-pair{display:flex;gap:6px;align-items:center}',
].join('');


const card = (item, status, body, note = '') => {
  const c = STATUS[status] || '#9a958c', n = UI_ITEMS.indexOf(item) + 1;
  return `<section class="card" data-item="${item}"><header><h2>${n} ${TITLES[item]}</h2><span class="badge" style="color:${c};border-color:${c}">${esc(status || 'proposed')}</span></header>${note ? `<p class="note">${esc(note)}</p>` : ''}${body}</section>`;
};
const piece = (id, html) => `<div data-piece="${esc(id)}">${html}</div>`;

// ── pieces ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** ui:guide — the register on its slider, the dials, the tokens, the face. */
export function pieceGuide(guide) {
  const ticks = STOP_IDS.map((s) => `<div class="tick" style="left:${REGISTER_STOPS[s] * 100}%"><span>${s}</span></div>`).join('');
  const slider = `<div class="slider"><div class="track"></div>${ticks}<div class="knob" style="left:${guide.register * 100}%"></div></div>`;
  const faceBy = guide.sources && guide.sources.font && !['register', 'operator'].includes(guide.sources.font) ? guide.sources.font : null;
  const dials = `<table>${DIAL_IDS.map((d) => `<tr><td><b>${d}</b></td><td>${esc(guide.dials[d])}${d === 'type' && faceBy ? ` → ${esc(guide.font)}` : ''}</td><td class="src">${esc(d === 'type' && faceBy ? faceBy : guide.sources.dials[d])}</td><td class="about">${esc(DIAL_ABOUT[d])}</td></tr>`).join('')}</table>`;
  const toks = `<div class="toks">${Object.entries(guide.tokens).map(([k, v]) => `<div><span class="sw" style="background:${esc(v)}"></span><code>${k}</code><code>${esc(v)}</code></div>`).join('')}</div>`;
  const src = (k) => esc((guide.sources && guide.sources[k]) || 'default');
  const face = `<p style="font:600 18px/1.2 ${FONTS[guide.font]};margin:6px 0 0">The quick brown fox · 0123456789</p><p class="note">face: ${esc(guide.font)} · set by ${src('font')}</p>`;
  const b = guide.border, border = `<table style="margin-top:6px"><tr><td><b>border</b></td><td>${b ? esc(b.flavor || 'custom') : 'none'}</td><td class="src">${src('border')}</td><td class="about">${b ? b.elements.map((e) => `${esc(e)}: ${esc(BORDER_ELEMENTS[e].about)}`).join(' · ') : 'no art over the frame'}</td></tr>`
    + `<tr><td><b>pace</b></td><td>${esc(guide.pace || 'scan')}</td><td class="src">${src('pace')}</td><td class="about">${{ glance: 'read in a glance: tight budgets, nothing standing in the centre', scan: 'read in a scan: the default budgets', study: 'read slowly, often paused: dense panels, the centre may hold one' }[guide.pace || 'scan']}</td></tr>`
    + `<tr><td><b>pixel</b></td><td>${guide.pixel ? `${guide.pixel}px` : 'off'}</td><td class="src">${src('pixel')}</td><td class="about">${guide.pixel ? 'no smoothing, hard edges, stepped corners, the mono face' : 'smooth'}</td></tr></table>`;
  return piece('ui:guide', `<p class="note">register ${guide.register} · ${esc(guide.stop)} · set by ${esc(guide.sources.register)}</p>${slider}${dials}${border}<p class="note" style="margin-top:8px">tokens · from ${esc(guide.sources.tokens)}</p>${toks}${face}`);
}

// a step function's progress at x (0..1)
const progress = (fn, x) => {
  const m = /steps\((\d+)/.exec(fn);
  return m ? Math.floor(x * Number(m[1])) / Number(m[1]) : 1 - (1 - x) ** 3;
};
/** ui:motion — each motion as a strip of up to twelve frames. */
export function pieceMotion(motion, dial) {
  const rows = motionSheet(dial, motion).map((m) => {
    const n = Math.min(12, m.frames), cells = Array.from({ length: n }, (_, i) => {
      const p = progress(m.fn, n === 1 ? 1 : i / (n - 1)), x = i * 22 + 2;
      return `<rect x="${x}" y="2" width="20" height="20" fill="none" stroke="#45484f"/><rect x="${x + 4}" y="${6 + (1 - p) * 8}" width="12" height="${4 + p * 8}" fill="#e9e4da" opacity="${(0.2 + 0.8 * p).toFixed(2)}"/>`;
    }).join('');
    return `<div class="strip"><b>${m.name}</b><svg viewBox="0 0 266 24" style="max-width:266px">${cells}</svg><small>${m.frames} f · ${m.ms} ms${m.loop ? ' · loop' : ''}</small></div>`;
  }).join('');
  return piece('ui:motion', `<p class="note">${esc(dial)} · ${esc(motionSheet(dial)[0].fn)} · frames on the game clock (60 a second)</p>${rows}`);
}

const rate = (n) => `<span class="pu-num" style="color:var(--moj-${n >= 0 ? 'goal' : 'harm'})">${n >= 0 ? '+' : '−'}${Math.abs(n)}/min</span>`;
const MARK_SVG = { chevron: '<path d="M1 2 L5 7 L9 2"/>', diamond: '<path d="M5 1 L9 5 L5 9 L1 5 Z"/>', circle: '<circle cx="5" cy="5" r="4"/>', square: '<rect x="1.5" y="1.5" width="7" height="7"/>', bar: '<rect x="1" y="4" width="8" height="2"/>' };
const markSvg = (m) => (m && MARK_SVG[m] ? `<svg class="pu-mark" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6">${MARK_SVG[m]}</svg>` : '');
const NAMES = ['Ash', 'Rook', 'Vale', 'Kite'];
// the shooter's marks, drawn in currentColor so the state classes and the guide colour them
const svgBox = (w, h, inner, extra = '') => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"${extra}>${inner}</svg>`;
const arc = (cx, cy, r, from, to) => { const a = (d) => [cx + r * Math.cos((d - 90) * Math.PI / 180), cy + r * Math.sin((d - 90) * Math.PI / 180)]; const [x0, y0] = a(from), [x1, y1] = a(to); return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}"/>`; };
function reticleSvg(variant, layers, state) {
  // ready (shown) · on target (focus: the assist ring closes, solid) · cooling down (active: the status arc) ·
  // reloading (disabled: the arc in the line colour) · empty (alert: the core breaks into dashes)
  const o = [], c = 24, broken = state === 'alert' ? ' stroke-dasharray="2 2.5"' : '';
  if (layers.includes('assist')) o.push(`<circle cx="${c}" cy="${c}" r="15"${state === 'focus' ? '' : ' stroke-dasharray="3 4" opacity=".55"'}/>`);
  if (layers.includes('status') && (state === 'active' || state === 'disabled')) o.push(`<g stroke-width="2.6"${state === 'disabled' ? ' opacity=".5"' : ''}>${arc(c, c, 20, 0, state === 'active' ? 230 : 120)}</g>`);
  if (layers.includes('charge') && state === 'focus') o.push(`<circle cx="${c}" cy="${c}" r="4.5" stroke-width="2"/>`);
  if (variant === 'ring') o.push(`<circle cx="${c}" cy="${c}" r="8"${broken}/><circle cx="${c}" cy="${c}" r="1.4" fill="currentColor" stroke="none"/>`);
  else if (variant === 'cross') o.push(`<g${broken}><path d="M${c} ${c - 11} V${c - 4} M${c} ${c + 4} V${c + 11} M${c - 11} ${c} H${c - 4} M${c + 4} ${c} H${c + 11}"/></g>`);
  else if (variant === 'dot') o.push(`<circle cx="${c}" cy="${c}" r="2.4" fill="currentColor" stroke="none"${broken}/>`);
  else o.push(`<path d="M${c - 7} ${c + 6} L${c} ${c} L${c + 7} ${c + 6}"${broken}/>`);
  return svgBox(48, 48, o.join(''));
}
const RIFLE = '<path d="M2 11 H30 M4 11 V16 H9 V12 M12 8 H22 M30 10 H36"/>';

// the board-first parts, drawn with sample values in the page's classes
const PROPOSED = {
  ledger: ({ cls, accent, label, p }) => `<div class="${cls}"${accent}><span class="moj-lbl">${label}</span><table class="pu-tab">${(p.rows || []).slice(0, 4).map((r, i) => `<tr><td>${esc(r.label || r.var)}</td><td class="pu-num">${[120, 40, 64, 9][i]}</td><td>${r.rate ? rate([12, -30, 4, -2][i]) : ''}</td></tr>`).join('')}</table></div>`,
  forecast: ({ cls, accent, label, variant }) => `<div class="${cls}"${accent}><span class="moj-lbl">${label}</span><span class="moj-val">${variant === 'empty' ? 'runs out in 2:10' : 'full in 0:40'}</span><span class="pu-mini"><i style="width:${variant === 'empty' ? 28 : 82}%"></i></span></div>`,
  trend: ({ cls, accent, label }) => `<div class="${cls}"${accent}><span class="moj-lbl">${label}</span><svg viewBox="0 0 60 16" style="width:60px;height:16px"><polyline points="0,4 8,6 16,5 24,9 32,8 40,11 48,10 60,14" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></div>`,
  alerts: ({ cls, accent, label }) => `<div class="${cls}"${accent}><span class="moj-lbl">${label || 'Alerts'}</span><span>! Food stores low</span><span class="pu-dim">! Raiders sighted · east</span></div>`,
  allocator: ({ cls, accent, label, variant, p }) => `<div class="${cls}"${accent}><span class="moj-lbl">${label} · 2 free</span><table class="pu-tab">${(p.into || []).slice(0, 4).map((t, i) => `<tr><td>${esc(t)}</td>${variant === 'steppers' ? `<td><span class="pu-step">−</span></td><td class="pu-num">${[4, 3, 1, 0][i]}</td><td><span class="pu-step">+</span></td>` : `<td><span class="pu-mini"><i style="width:${[50, 37, 13, 0][i]}%"></i></span></td><td class="pu-num">${[4, 3, 1, 0][i]}</td>`}</tr>`).join('')}</table></div>`,
  queue: ({ cls, accent, label, variant }) => (variant === 'strip'
    ? `<div class="${cls}"${accent}><span class="moj-lbl">${label}</span><span class="pu-slots"><span class="pu-slot on"></span><span class="pu-slot next"></span><span class="pu-slot next"></span><span class="pu-slot"></span><span class="pu-slot"></span></span></div>`
    : `<div class="${cls}"${accent}><span class="moj-lbl">${label}</span><span>Mill <span class="pu-mini"><i style="width:55%"></i></span></span><span class="pu-dim">Granary</span><span class="pu-dim">Wall ×4</span></div>`),
  nameplate: ({ cls, accent, variant, p }) => {
    const one = (who, i) => `<div class="${cls}"${accent}>${markSvg(p.mark && p.mark[who])}<span>${NAMES[i]}</span>${variant === 'name-bar' ? `<span class="pu-mini"><i style="width:${[70, 35][i]}%"></i></span>` : ''}</div>`;
    return `<div class="pu-pair">${one('ally', 0)}${one('enemy', 1)}</div>`;
  },
  reticle: ({ cls, variant, p, state }) => `<div class="${cls} pu-bare" style="color:var(--moj-ink)">${reticleSvg(variant, (p && p.layers) || ['core'], state)}</div>`,
  hitmarker: ({ cls, variant, state }) => `<div class="${cls} pu-bare" style="color:var(--moj-ink)">${svgBox(48, 48, variant === 'x'
    ? `<g stroke-width="${state === 'active' ? 3.2 : 1.8}"><path d="M14 14 L19 19 M34 14 L29 19 M14 34 L19 29 M34 34 L29 29"/></g>`
    : `<circle cx="24" cy="24" r="${state === 'active' ? 13 : 10}" stroke-width="${state === 'active' ? 3 : 1.8}"/>`)}</div>`,
  ammo: ({ cls, accent, variant, state }) => {
    const n = state === 'alert' ? 0 : 24, label = state === 'disabled' ? 'RELOADING' : state === 'alert' && variant === 'gauge' ? 'OVERHEAT' : '';
    if (variant === 'pips') return `<div class="${cls}"${accent}><span class="pu-slots">${Array.from({ length: 10 }, (_, i) => `<span class="pu-slot${i < (state === 'alert' ? 0 : 7) ? ' on' : ''}" style="width:5px;height:14px${i < (state === 'alert' ? 0 : 7) ? ';background:currentColor' : ''}"></span>`).join('')}</span>${label ? `<span class="moj-lbl">${label}</span>` : ''}</div>`;
    if (variant === 'bar') return `<div class="${cls} moj-w-bar"${accent}><span class="moj-lbl">AMMO</span><span class="moj-track"><span class="moj-fill" style="width:${state === 'alert' ? 0 : 80}%"></span></span><span class="moj-val">${label || `${n}`}</span></div>`;
    if (variant === 'gauge') return `<div class="${cls}"${accent}>${svgBox(30, 30, `<circle cx="15" cy="15" r="11" opacity=".25" stroke-width="3"/><g stroke-width="3">${arc(15, 15, 11, 0, state === 'alert' ? 359 : 280)}</g>`)}<span class="moj-val">${label || '78%'}</span></div>`;
    return `<div class="${cls} moj-w-counter"${accent}><span class="moj-val">${label || `${n} / 30`}</span><span class="moj-lbl">ammo</span></div>`;
  },
  weapon: ({ cls, accent, variant }) => (variant === 'loadout'
    ? `<div class="${cls}"${accent}><span class="pu-slots">${['', ' on', ''].map((on, i) => `<span class="pu-slot${on}" style="width:34px;height:20px;${on ? 'transform:translateY(-3px);border-color:var(--moj-accent)' : 'opacity:.6'}">${svgBox(34, 20, `<g transform="scale(.8) translate(2 2)">${RIFLE}</g>`)}</span>`).join('')}</span></div>`
    : `<div class="${cls}"${accent} style="display:flex;align-items:center;gap:8px">${svgBox(38, 20, RIFLE)}<span>Carbine</span></div>`),
  lock: ({ cls, variant }) => `<div class="${cls} pu-bare" style="color:var(--moj-accent2);display:flex;flex-direction:column;align-items:center">${svgBox(40, 40, variant === 'diamond'
    ? '<rect x="9" y="9" width="22" height="22" transform="rotate(45 20 20)" stroke-width="2"/>'
    : '<path d="M6 13 V6 H13 M27 6 H34 V13 M34 27 V34 H27 M13 34 H6 V27" stroke-width="2"/>')}<span style="font-size:9px;letter-spacing:2px">LOCK</span></div>`,
  target: ({ cls, accent }) => `<div class="${cls} moj-w-bar"${accent}><span class="moj-lbl">ROOK</span><span class="moj-track"><span class="moj-fill" style="width:45%;background:var(--moj-harm)"></span></span><span class="moj-val">45</span></div>`,
  damage: ({ cls }) => `<div class="${cls} pu-bare" style="color:var(--moj-harm)">${svgBox(56, 56, `<g opacity=".2">${arc(28, 28, 24, 320, 40)}${arc(28, 28, 24, 140, 220)}${arc(28, 28, 24, 230, 310)}</g><g stroke-width="3.4">${arc(28, 28, 24, 50, 130)}</g>`)}</div>`,
  feed: ({ cls, accent }) => `<div class="${cls}"${accent} style="display:flex;flex-direction:column;gap:2px;font-size:12px"><span>Ash › Rook</span><span class="pu-dim">Vale › Kite</span></div>`,
  scoreboard: ({ cls, accent, p }) => `<div class="${cls}"${accent}><table class="pu-tab"><tr><th></th>${(p.columns || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${NAMES.slice(0, 3).map((n, i) => `<tr><td>${n}</td>${(p.columns || []).map((_, j) => `<td class="pu-num">${[[12, 3, 1450], [9, 5, 1120], [4, 8, 610]][i][j] ?? '–'}</td>`).join('')}</tr>`).join('')}</table></div>`,
};

// a part's specimen markup: the page's own classes (scene/channels/events.js hudScript)
function specimen(part, variant, state, p = PARTS[part].example) {
  // a placeholder ({delta}, {score}, {event.damage}) shows a sample value, as the page would fill it
  const WHO = /killer|victim|name|who|player|by/i;
  let nth = 0;
  const sample = (t) => String(t).replace(/\{([^}]*)\}/g, (_, k) => (WHO.test(k) ? NAMES[nth++ % NAMES.length] : part === 'toast' ? '-20' : '12'));
  const label = esc(p.label || (p.bind && p.bind.var) || part), cls = `moj-w moj-w-${part === 'readout' ? `readout moj-w-${variant}` : part}${state !== 'shown' ? ` pu-${state}` : ''}`;
  const hue = p.color ? colorCss(p.color, '') : part === 'banner' || (part === 'readout' && variant === 'bar') || (part === 'toast' && variant === 'event') ? 'var(--moj-accent)' : '';
  const accent = hue ? ` style="color:${esc(hue)}"` : '';
  if (part === 'readout') {
    const val = variant === 'clock' ? '1:24' : variant === 'bar' ? '62' : '1250';
    if (variant === 'bar') return `<div class="${cls}"${accent}><span class="moj-lbl">${label}</span><span class="moj-track"><span class="moj-fill" style="width:62%"></span></span><span class="moj-val">${val}</span></div>`;
    if (variant === 'counter') return `<div class="${cls}"${accent}><span class="moj-val">${val}</span><span class="moj-lbl">${label}</span></div>`;
    return `<div class="${cls}"${accent}><span class="moj-lbl">${label}</span><span class="moj-val">${val}</span></div>`;
  }
  if (part === 'toast') return `<div class="${cls}"${accent}>${variant === 'change' ? '+5' : esc(sample(p.text || '-20'))}</div>`;
  if (PROPOSED[part]) return PROPOSED[part]({ cls, accent, label, variant, p, sample, state });
  return `<div class="${cls}"${accent}>${esc(sample(p.text || part))}</div>`;
}
// the page's own sheet is on the board once (CSS); a stage only sets its tokens, which the sheet's var()s inherit
// the values row is the black-and-white test: the semantic hues (harm, value, goal) drain to greys there too, so two
// parts that differ only by colour show it
const DRAINED = '--moj-harm:#bdbdbd;--moj-value:#e0e0e0;--moj-goal:#9e9e9e';
const stageCss = (scope, tokens, font, dials, drain = false, guide = null) => `${scope}{${styleVars({ ...tokens, font })}${drain ? `;${DRAINED}` : ''};font-family:var(--moj-font);color:var(--moj-ink);background:var(--moj-bg)}${dials ? registerCss({ ...dials, surface: 'overlay' }, scope) : ''}${guide && (guide.border || guide.pixel) ? borderCss({ elements: guide.border ? guide.border.elements : [], pixel: guide.pixel || 0, plate: dials.plate }, scope) : ''}`;

/** ui:part:<part>.<variant> — the part in every state, in values (greybox) and dressed (the guide). */
export function piecePart(part, variant, guide, p, of = '') {
  const id = `ui:part:${part}.${variant}${of ? `:${of}` : ''}`, k = id.replace(/[^a-z0-9]/gi, '-');
  const css = `<style>${stageCss(`.v-${k}`, GREYBOX_TOKENS, 'system', null, true)}${guide ? stageCss(`.d-${k}`, guide.tokens, guide.font, guide.dials, false, guide) : ''}</style>`;
  const row = (cls, name) => `<div><b>${esc(part)}</b> ${esc(variant)}${of ? ` · ${esc(of)}` : ''}<br><small style="color:#9a958c">${name}</small></div>${UI_STATES.map((s) => `<div class="pu-stage ${cls}">${specimen(part, variant, s, p)}</div>`).join('')}`;
  return piece(id, `${css}${row(`v-${k}`, 'values')}${guide ? row(`d-${k}`, 'dressed') : ''}`);
}

/** ui:layout — the grid, the parts in each region (all phases), the budget and the advice. */
export function pieceLayout(play, ui, entities = null) {
  const parts = (play.parts || []).map((p, i) => readPart(p, i)), advice = uiAdvice(play, ui, { entities });
  const pace = (ui && ui.guide && ui.guide.pace) || 'scan', budgets = REGION_BUDGETS[pace];
  const name = (x) => esc(`${x.part}.${x.variant}${x.binds ? ` ${x.part === 'banner' || x.part === 'alerts' ? 'on ' : ''}${x.binds}` : ''}${x.of !== 'self' ? ` · of ${x.of}` : ''}${x.audience !== (x.of === 'self' ? 'self' : x.of === 'team' ? 'team' : 'all') ? ` · seen by ${x.audience}` : ''}${x.page ? '' : ' ◦'}`);
  const cells = UI_REGIONS.map((r) => {
    const here = parts.filter((x) => (x.region || DEFAULT_REGION[x.part]) === r), budget = budgets[regionClass(r)];
    const standing = here.filter((x) => !MOMENTS.includes(x.part) && !FOCUS.includes(x.part)).length;   // moments and the focus pass through; the budget is what stands
    return `<div class="${standing > budget ? 'over' : ''}"><b>${r} · ${standing}/${budget}${here.length > standing ? ` +${here.length - standing} moment${here.length - standing > 1 ? 's' : ''}` : ''}</b>${here.map(name).join('<br>')}</div>`;
  }).join('');
  const over = parts.filter((x) => x.region === 'over');
  return piece('ui:layout', `<p class="note">pace ${esc(pace)} · ◦ drawn on the board only</p><div class="grid9">${cells}</div>${over.length ? `<p class="note" style="margin-top:6px">over each entity: ${over.map(name).join(', ')}</p>` : ''}${advice.length ? `<ul class="adv">${advice.map((a) => `<li>${esc(a.law)} · ${esc(a.at || '')}: ${esc(a.advice)}</li>`).join('')}</ul>` : '<p class="note" style="margin-top:6px">no advice</p>'}`);
}

// a happening and an effect in words, as the board reads them
const zoneWords = (w) => (w.anchor ? `${w.anchor} (${w.r} m)` : w.zone ? `'${w.zone}'` : w.area.r ? `${w.area.r} m round ${w.area.at[0]}, ${w.area.at[1]}` : `${w.area.half[0] * 2} × ${w.area.half[1] * 2} m at ${w.area.at[0]}, ${w.area.at[1]}`);
export function whenWords(w) {
  if (w.kind === 'enter' || w.kind === 'near' || w.kind === 'leave') return `${{ enter: 'walks into', near: 'comes near', leave: 'walks out of' }[w.kind]} ${zoneWords(w)}`;
  if (w.kind === 'use') return `uses ${w.id || zoneWords(w)}${w.prompt ? ` (${w.prompt})` : ''}`;
  if (w.kind === 'take') return `takes ${w.id}`;
  if (w.kind === 'var') { const sym = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=', ne: '≠' }; return `${w.var} ${Object.keys(sym).filter((k) => w[k] !== undefined).map((k) => `${sym[k]} ${w[k]}`).join(' and ')}`; }
  if (w.kind === 'on') return `the bus says ${w.on}${w.match ? ` (${Object.entries(w.match).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''}`;
  if (w.kind === 'ttl') return `${w.ttl} s`;
  if (CAST_WHEN[w.kind]) return `${w.who} ${{ down: 'falls', gone: 'is sent away', spawned: 'appears', arrive: 'arrives', stuck: 'is stuck' }[w.kind]}${w.at ? ` at ${w.at}` : ''}`;
  return 'the level starts';
}
const place = (p) => (Array.isArray(p) ? `[${p.slice(0, 2).join(', ')}]` : p);
const castWords = (t) => (t.op === 'walk' ? `${t.who} walks to ${t.to.map(place).join(' → ')}${t.then && t.then !== 'stay' ? ` (${t.then})` : ''}` : t.op === 'spawn' ? `${t.who} appears${t.at ? ` at ${place(t.at)}` : ''}` : t.op === 'hurt' ? `${t.who} −${t.by} hp` : t.op === 'heal' ? `${t.who} +${t.by ?? 'all'} hp` : `${{ vanish: 'send away', kill: 'fell', stop: 'stop' }[t.op]} ${t.who}`);
const thenWords = (t) => (t.kind === 'cast' ? castWords(t) : t.kind === 'say' ? `${t.as} “${t.say}” at ${t.region}` : t.kind === 'state' ? `${t.part} → ${t.to}` : t.kind === 'phase' ? `phase → ${t.phase}` : t.kind === 'open' ? `open menu ${t.menu}` : t.kind === 'close' ? `close ${t.menu ? `menu ${t.menu}` : 'the menu'}` : t.kind === 'set' ? `${t.var} = ${t.to}` : t.kind === 'emit' ? `emit ${t.event}` : `${t.kind} ${t.part}`);

/** ui:cues — every cue as when → then → until; ◦ marks an effect the page does not draw yet (set on the bus). */
export function pieceCues(play) {
  const cues = readCues(play, phasesOf(play));
  const rows = cues.map((c) => `<tr><td><b>${esc(c.id)}</b>${c.once ? ' <small>once</small>' : ''}</td><td>${esc(whenWords(c.when))}</td><td>→</td><td>${c.then.map((t) => esc(thenWords(t)) + (t.page ? '' : ' ◦')).join('<br>')}</td><td class="about">${c.until ? `until ${esc(c.until.same ? 'it walks away' : whenWords(c.until))}` : ''}</td></tr>`).join('');
  return piece('ui:cues', `<table class="cues"><tr><td class="about">cue</td><td class="about">when the figure…</td><td></td><td class="about">the UI</td><td class="about"></td></tr>${rows}</table>`);
}

// a menu's specimen: the page's own markup (menus.js menuHtml), sample values for a list's vars
const menuSpecimen = (m) => menuHtml(m).replace(/\{[^}]+\}/g, (_, i) => '62');
const RAISE = { clear: 'solid', flat: 'solid', solid: 'solid', textured: 'textured' };

/** ui:menu:<id> — a menu in values, then dressed by the world's guide, with what opens it. */
export function pieceMenu(m, guide, by = []) {
  const id = `ui:menu:${m.id}`, k = id.replace(/[^a-z0-9]/gi, '-');
  // a menu reads over play: the guide's plate, raised to solid when it is clearer
  const css = `<style>${stageCss(`.v-${k}`, GREYBOX_TOKENS, 'system', { plate: 'solid' }, true)}${guide ? stageCss(`.d-${k}`, guide.tokens, guide.font, { ...guide.dials, plate: RAISE[guide.dials.plate] || 'solid' }, false, guide) : ''}</style>`;
  return piece(id, `${css}<div class="mn"><p class="note"><b style="color:#e9e4da">${esc(m.id)}</b> · ${esc(m.kind)} · ${esc(MENU_KINDS[m.kind].about)}<br>opened by ${by.length ? esc(by.join(', ')) : '<span style="color:#e8b04a">nothing yet</span>'}</p><div class="mn-pair"><div class="pu-stage v-${k}">${menuSpecimen(m)}</div>${guide ? `<div class="pu-stage d-${k}">${menuSpecimen(m)}</div>` : ''}</div></div>`);
}

// who sees a part from a view: a player sees all but the spectators' own overlays; a spectator sees what is shown to all
const seenBy = (x, view) => (view === 'spectator' ? x.audience === 'all' || x.audience === 'spectator' : x.audience !== 'spectator');
// over an entity, from the player's view: team parts over allies, all parts over everyone, self parts over no one else
const overEntity = (x, view, who, i) => (x.of === 'target' ? view !== 'spectator' && who === 'enemy' && i === 2 : view === 'spectator' ? seenBy(x, view) : x.audience === 'all' || (x.audience === 'team' && who === 'ally'));
const BOX = { reticle: [0.12, 12], hitmarker: [0.12, 8], damage: [0.22, 10], banner: [0.9, 18], ledger: [0.8, 40], allocator: [0.8, 30], queue: [0.8, 20], alerts: [0.8, 26], trend: [0.62, 16], scoreboard: [0.95, 58] };
/** The views a world's wireframes are drawn from: the player's, and the spectator's once anything is shared. */
export const viewsOf = (play) => ((play.parts || []).some((p, i) => { const x = readPart(p, i); return x.of.startsWith('each:') || x.audience === 'spectator'; }) ? ['player', 'spectator'] : [null]);

/** ui:wireframe:<phase>[:<view>] — black and white boxes in a 16:9 frame, from one view; markers for allies (A) and enemies (E). */
export function pieceWireframe(phase, play, dials, view = null) {
  const W = 320, H = 180, all = (play.parts || []).map((p, i) => ({ ...readPart(p, i), when: p.when })).filter((x) => !x.when || x.when.includes(phase));
  const parts = all.filter((x) => x.region !== 'over' && seenBy(x, view || 'player')), overs = all.filter((x) => x.region === 'over');
  const band = dials && dials.surface === 'console' ? 40 : 0, o = [`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#fff" stroke="#111"/>`];
  if (band) o.push(`<rect x="0.5" y="${H - band}" width="${W - 1}" height="${band - 0.5}" fill="#e4e4e4" stroke="#111"/>`);
  const clip = (t, w) => (t.length * 4.3 > w - 6 ? `${t.slice(0, Math.max(3, Math.floor((w - 6) / 4.3) - 1))}…` : t);
  const txt = (x, y, t) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="8" font-family="Helvetica,Arial,sans-serif" fill="#111">${esc(t)}</text>`;
  if (overs.length) {
    // the others in the match: two allies, two enemies, and over each what this view is shown
    const y = (H - band) * 0.66;
    [['ally', 104], ['ally', 132], ['enemy', 188], ['enemy', 216]].forEach(([who, x], k) => {
      o.push(`<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#111"/>${txt(x - 2.6, y + 2.8, who === 'ally' ? 'A' : 'E')}`);
      overs.filter((p) => overEntity(p, view || 'player', who, k)).forEach((p, i) => {
        const m = p.mark && p.mark[who], top = y - 18 - i * 11;
        o.push(`<rect x="${x - 13}" y="${top}" width="26" height="9" fill="none" stroke="#111"/>${m && m !== 'none' ? txt(x - 12, top + 7.5, m === 'chevron' ? 'v' : m === 'diamond' ? '◇' : '•') : ''}`);
      });
    });
  }
  // the marks on the world itself sit at the exact centre, one over another: the reticle, the hitmarker, the damage ring
  const CX = W / 2, CY = (H - band) / 2, MARKS_AT_CENTRE = ['reticle', 'hitmarker', 'damage'];
  for (const x of parts.filter((y) => MARKS_AT_CENTRE.includes(y.part) && (y.region || DEFAULT_REGION[y.part]) === 'center')) {
    const d = x.page ? '' : ' stroke-dasharray="2 1.5"';
    if (x.part === 'reticle') o.push(`<circle cx="${CX}" cy="${CY}" r="4" fill="none" stroke="#111"${d}/><path d="M${CX} ${CY - 8} V${CY - 5} M${CX} ${CY + 5} V${CY + 8} M${CX - 8} ${CY} H${CX - 5} M${CX + 5} ${CY} H${CX + 8}" stroke="#111"/>`);
    else if (x.part === 'hitmarker') o.push(`<path d="M${CX - 7} ${CY - 7} L${CX - 5} ${CY - 5} M${CX + 7} ${CY - 7} L${CX + 5} ${CY - 5} M${CX - 7} ${CY + 7} L${CX - 5} ${CY + 5} M${CX + 7} ${CY + 7} L${CX + 5} ${CY + 5}" stroke="#111"/>`);
    else o.push(`<circle cx="${CX}" cy="${CY}" r="14" fill="none" stroke="#111"${d || ' stroke-dasharray="2 1.5"'}/>`);
  }
  const cw = W / 3;
  for (const r of UI_REGIONS) {
    const here = parts.filter((x) => (x.region || DEFAULT_REGION[x.part]) === r && !(r === 'center' && MARKS_AT_CENTRE.includes(x.part))), [cx, cy] = REGION_CELLS[r];
    let acc = 0;
    here.forEach((x) => {
      const [fw, h] = BOX[x.part] || [0.62, 12], w = cw * fw * (x.part === 'scoreboard' ? 1.6 : 1);
      const total = here.reduce((n, y) => n + (BOX[y.part] || [0, 12])[1] + 3, 0);
      const left = cx === 0 ? 6 : cx === 2 ? W - 6 - w : W / 2 - w / 2;
      const top = band && cy === 2 ? H - band + 6 + acc : cy === 0 ? 6 + acc : cy === 2 ? (H - band) - 6 - total + acc : cx === 1 && cy === 1 && parts.some((y) => MARKS_AT_CENTRE.includes(y.part)) ? (H - band) / 2 + 20 + acc : (H - band) / 2 - total / 2 + acc;
      acc += h + 3;
      o.push(`<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h}" fill="${x.part === 'scoreboard' ? '#fff' : 'none'}" stroke="#111" stroke-width="1"${x.page ? '' : ' stroke-dasharray="3 1.5"'}/>${txt(left + 3, top + 8, clip(`${x.part}${x.binds ? ` ${x.binds}` : ''}`, w))}`);
    });
  }
  const id = `ui:wireframe:${phase}${view ? `:${view}` : ''}`;
  return piece(id, `<div class="wf"><small>${esc(phase)}${view ? ` · ${esc(view)}'s view` : ''}</small><svg viewBox="0 0 ${W} ${H}">${o.join('')}</svg></div>`);
}

// ── assembly ────────────────────────────────────────────────────────────────────────────────────────────────────────

// one specimen per part the world declares (two pools are two rows: whether they read apart is the question the
// board answers), keyed by what it binds; the reference sheet draws one per variant instead
const ofPart = (x) => x.binds || '';
const usedParts = (play) => {
  const seen = new Map();
  (play.parts || []).forEach((p, i) => { const x = readPart(p, i), k = `${x.part}.${x.variant}:${ofPart(x)}`; if (!seen.has(k)) seen.set(k, { ...x, p, of: ofPart(x) }); });
  return [...seen.values()];
};

/** The ids a world's board is assembled from, in board order. */
export function boardPieceIds(manifest) {
  const play = manifest.play || {};
  return ['ui:guide', 'ui:motion', ...usedParts(play).map((x) => `ui:part:${x.part}.${x.variant}${x.of ? `:${x.of}` : ''}`), ...(play.cues && play.cues.length ? ['ui:cues'] : []), ...readMenus(play).map((m) => `ui:menu:${m.id}`), 'ui:layout', ...phasesOf(play).flatMap((ph) => viewsOf(play).map((v) => `ui:wireframe:${ph}${v ? `:${v}` : ''}`))];
}

const page = (title, lede, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>${esc(title)}</title><style>${CSS}${HUD_CSS}${MENU_CSS}${PROPOSED_CSS}</style></head><body><div id="board">
<h1>${esc(title.toUpperCase())}</h1>
<p class="lede">${esc(lede)}</p>
${body}
</div></body></html>`;
const specs = (rows) => `<div class="specs"><div></div>${UI_STATES.map((s) => `<div class="h">${s}</div>`).join('')}${rows}</div>`;

/** The board for a world whose play block carries a UI direction, as one self-contained HTML document. */
export function uiBoardHtml(manifest) {
  const play = manifest.play || {}, ui = play.ui || {}, g = ui.guide, status = ui.status || {};
  if (!g) throw new Error('uiBoardHtml: the world has no UI direction yet (play.ui: \'propose\' makes one)');
  const parts = usedParts(play), phases = phasesOf(play);
  return page(`UI direction · ${manifest.title || manifest.kind || 'world'}`, `${ui.seed ? `seed ${ui.seed} · ` : ''}approve each item or send the guide or the motion back to be drawn again`, `
<div class="row r1">
${card('guide', status.guide, pieceGuide(g), 'every value tagged with the layer that set it')}
${card('motion', status.motion, pieceMotion(ui.motion, g.dials.motion), 'the moves, in frames')}
</div>
<div class="row">${card('parts', status.parts, parts.length ? specs(parts.map((x) => piecePart(x.part, x.variant, g, x.p, x.of)).join('')) : '<p class="note">no parts yet: play.parts</p>', 'each part in every state: in values, then dressed by the guide · drawn at 78% (banners 42%, legends 64%, panels 56%) to fit a cell')}</div>
${play.cues && play.cues.length ? `<div class="row"><section class="card" data-item="cues"><header><h2>Cues</h2></header><p class="note">what the game does → what the UI does, until when · each fires the bus event cue:&lt;id&gt; · ◦ set on the bus, drawn on the board only · approved with the parts</p>${pieceCues(play)}</section></div>` : ''}
${(play.menus || []).length ? (() => { const by = openers(play); return `<div class="row"><section class="card" data-item="menus"><header><h2>Menus</h2></header><p class="note">what comes up when the figure does something in the map · in values, then dressed by the world's guide (no look of its own) · drawn on the board; the page draws menus in a later step</p><div class="mns">${menuPages(play).map((m) => pieceMenu(m, g, by.get(m.id))).join('')}</div></section></div>`; })() : ''}
<div class="row r3">
${card('layout', status.layout, pieceLayout(play, ui, Array.isArray(manifest.entities) ? manifest.entities : null), 'every phase at once; standing parts against the pace\'s budget (moments pass through); a region over it is outlined')}
${card('wireframes', status.wireframes, `<div class="wfs">${phases.flatMap((ph) => viewsOf(play).map((v) => pieceWireframe(ph, play, g.dials, v))).join('')}</div>`, 'black and white: structure apart from look · dashed: drawn on the board only')}
</div>`);
}

/** THE REFERENCE SHEET: every part × variant × state at a register (and tokens), pre-generated and kept. */
export function uiSheetHtml({ register = 0, tokens = GREYBOX_TOKENS, hints, border = null, pixel = 0, font } = {}) {
  const dials = dialsAt(register), guide = { register, stop: stopOf(register), dials, font: font || fontOfType(dials.type, hints), tokens, border, pixel, sources: { register: 'sheet', tokens: 'sheet', dials: Object.fromEntries(DIAL_IDS.map((d) => [d, 'register'])) } };
  const rows = PART_IDS.flatMap((part) => PARTS[part].variants.map((v) => piecePart(part, v, guide))).join('');
  return page(`UI parts · ${guide.stop}`, `register ${register} · every part in every state, in values and dressed`, `<div class="row">${card('guide', 'auto', pieceGuide(guide))}</div><div class="row">${card('parts', 'auto', specs(rows))}</div>`);
}

/** The board as a PNG, laid out by a headless Chromium (scene-png.js). Throws when no browser can be resolved. */
export async function uiBoardPagePng(manifest) {
  const { renderPageToPng } = await import('../../scene/scene-png.js');
  return renderPageToPng(uiBoardHtml(manifest), { width: 1240, height: 1000, selector: '#board' });
}
