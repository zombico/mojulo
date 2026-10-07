/**
 * THE OUTDOOR MASTER INDEX, drawn — one HTML page that is the style guide for what people build along a trail and the
 * colours every outdoor kit may use: the cascade (laws → kit → trail → piece), the swatches, the laws, the parts and
 * joints, each pattern in elevation and section (black and white, dimensioned, measured against its laws), each kit's
 * tokens with a plate painted in its swatches, and a trail's `made` block resolved, every value tagged with the layer
 * that set it. Data: era/out-made.js and era/style/swatches.js. `outIndexHtml(opts)` is pure.
 */
import { MADE_PATTERNS, MADE_PATTERN_IDS, MADE_LAWS, MADE_PARTS, MADE_JOINTS, MADE_RAILS, MADE_KITS, MADE_SPOTS, madeStyle, designPiece } from './out-made.js';
import { SWATCHES, hexOfRgb, accentOf } from './style/swatches.js';
import { madeColour } from './made-elements.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (typeof v === 'number' ? (Math.round(v * 1000) / 1000).toString() : String(v));
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const showRail = (v) => (Array.isArray(v) && typeof v[0] === 'string' ? [...new Set(v)].join(' | ') : Array.isArray(v) ? `${v[0]}–${v[1]}${v[2] === 'i' ? ' (whole)' : ''}` : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k} → ${x}`).join(', ') : String(v));

// ── drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// ink: black and white by default; a kit plate paints from the style's swatch roles, outlines in each ramp's darkest stop
const BW = { line: '#111', timber: '#fff', stone: '#e4e4e4', kerb: '#c8c8c8', paint: '#9a9a9a', hat: '#111', soil: '#fff', water: '#fff', rope: '#111' };
function inkOf(style) {
  if (!style) return BW;
  const S = style.swatch, h = (role, i) => hexOfRgb(S[role].stops[Math.min(i, S[role].stops.length - 1)]);
  return { line: h('timber', 0), timber: h('timber', 2), stone: h('stone', 3), kerb: h('stone', 2), paint: h('paint', 1), hat: h('hat', 2), soil: '#fff', water: '#fff', rope: h('rope', 1), colour: true };
}

let UID = 0;
function bounds(shapes) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const s of shapes) {
    if (s.k === 'box' || s.k === 'bond' || s.k === 'relief') { add(s.x, s.y); add(s.x + s.w, s.y + s.h); if (s.cap === 'round') add(s.x, s.y + s.h + s.w / 2); }
    else if (s.k === 'poly') for (const [x, y] of s.pts) add(x, y);
    else if (s.k === 'ground') { add(s.x0, s.y ?? 0); add(s.x1, (s.y ?? 0) - 0.3); }
    else if (s.k === 'water') { add(s.x0, s.y); add(s.x1, s.bed - 0.15); }
    else if (s.k === 'dim') { add(...s.a); add(...s.b); }
    else if (s.k === 'hat') { add(s.x, s.y + 0.08); add(s.x + s.w, s.y); }
  }
  return { x0, x1, y0, y1 };
}

/** Shapes (metres) → an SVG `w` px wide (at most `maxH` high). */
export function drawShapes(shapes, { w = 520, maxH = 300, style, pad = 26, dims = true } = {}) {
  if (!dims) shapes = shapes.filter((s) => s.k !== 'dim');
  const ink = inkOf(style), b = bounds(shapes), id = `d${++UID}`, padR = pad + (shapes.some((s) => s.k === 'dim' && Math.abs(s.a[0] - s.b[0]) < 1e-6) ? 46 : 0);
  const sc = Math.min((w - pad - padR) / (b.x1 - b.x0 || 1), (maxH - 2 * pad) / (b.y1 - b.y0 || 1));
  const H = Math.ceil((b.y1 - b.y0) * sc + 2 * pad), X = (x) => (pad + (x - b.x0) * sc).toFixed(1), Y = (y) => (H - pad - (y - b.y0) * sc).toFixed(1), L = (v) => (v * sc).toFixed(1);
  const lw = 1.3, o = [];
  const defs = `<defs><pattern id="${id}h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${ink.line}" stroke-width="0.8"/></pattern>`
    + `<pattern id="${id}w" width="10" height="5" patternUnits="userSpaceOnUse"><path d="M0 2.5 q2.5 -2 5 0 t5 0" fill="none" stroke="${ink.line}" stroke-width="0.6"/></pattern>`
    + `<pattern id="${id}d" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="0.7" fill="${ink.line}"/></pattern></defs>`;
  const rect = (s, fill, extra = '') => `<rect x="${X(s.x)}" y="${Y(s.y + s.h)}" width="${L(s.w)}" height="${L(s.h)}" fill="${fill}" stroke="${ink.line}" stroke-width="${lw}"${extra}/>`;
  const grey = (v) => { const g = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0'); return `#${g}${g}${g}`; };
  const fillOf = (s) => (s.solid ? (style ? madeColour(style, s) : grey(s.value)) : s.cut ? `url(#${id}h)` : s.painted ? ink.paint : s.part === 'stone' ? (s.kerb ? ink.kerb : ink.stone) : s.part === 'soil' ? `url(#${id}h)` : s.part === 'bedding' ? `url(#${id}d)` : ink.timber);
  for (const s of shapes) {
    if (s.k === 'ground') {
      const y = s.y ?? 0;
      o.push(`<rect x="${X(s.x0)}" y="${Y(y)}" width="${L(s.x1 - s.x0)}" height="${L(0.3)}" fill="url(#${id}h)" opacity="0.55"/><line x1="${X(s.x0)}" y1="${Y(y)}" x2="${X(s.x1)}" y2="${Y(y)}" stroke="${ink.line}" stroke-width="2"/>`);
    } else if (s.k === 'water') {
      o.push(`<rect x="${X(s.x0)}" y="${Y(s.y)}" width="${L(s.x1 - s.x0)}" height="${L(s.y - s.bed)}" fill="url(#${id}w)"/><line x1="${X(s.x0)}" y1="${Y(s.y)}" x2="${X(s.x1)}" y2="${Y(s.y)}" stroke="${ink.line}" stroke-width="1.2"/>`);
      o.push(`<rect x="${X(s.x0)}" y="${Y(s.bed)}" width="${L(s.x1 - s.x0)}" height="${L(0.15)}" fill="url(#${id}h)" opacity="0.55"/><line x1="${X(s.x0)}" y1="${Y(s.bed)}" x2="${X(s.x1)}" y2="${Y(s.bed)}" stroke="${ink.line}" stroke-width="1.6"/>`);
    } else if (s.k === 'box') {
      if (s.buried) { o.push(rect(s, 'none', ' stroke-dasharray="3 2"')); continue; }
      o.push(rect(s, fillOf(s)));
      if (s.part === 'post' || s.part === 'riser') {
        if (s.timber === 'culm') for (let y = s.y + 0.3; y < s.y + s.h - 0.05; y += 0.3) o.push(`<line x1="${X(s.x)}" y1="${Y(y)}" x2="${X(s.x + s.w)}" y2="${Y(y)}" stroke="${ink.line}" stroke-width="1.6"/>`);
        else if (s.h > 0.3) for (const f of s.timber === 'round' ? [0.3, 0.7] : [0.5]) o.push(`<line x1="${X(s.x + s.w * f)}" y1="${Y(s.y + 0.06)}" x2="${X(s.x + s.w * f)}" y2="${Y(s.y + s.h - 0.06)}" stroke="${ink.line}" stroke-width="0.5"/>`);
        const top = s.y + s.h;
        if (s.cap === 'round') o.push(`<path d="M${X(s.x)} ${Y(top)} A${L(s.w / 2)} ${L(s.w / 2)} 0 0 1 ${X(s.x + s.w)} ${Y(top)}" fill="${ink.timber}" stroke="${ink.line}" stroke-width="${lw}"/>`);
        else if (s.cap === 'bevel') o.push(`<path d="M${X(s.x)} ${Y(top - 0.03)} L${X(s.x + s.w / 2)} ${Y(top)} L${X(s.x + s.w)} ${Y(top - 0.03)}" fill="none" stroke="${ink.line}" stroke-width="0.8"/>`);
        else if (s.cap === 'open') o.push(`<ellipse cx="${X(s.x + s.w / 2)}" cy="${Y(top)}" rx="${L(s.w / 2)}" ry="${L(0.02)}" fill="#fff" stroke="${ink.line}" stroke-width="0.8"/>`);
        else if (s.cap === 'hat') o.push(hatPath(X, Y, L, s.x - 0.02, top, s.w + 0.04, ink.hat));
      } else if ((s.part === 'rail' || s.part === 'beam' || s.part === 'plank') && !s.cut && s.w > 1) {
        o.push(`<line x1="${X(s.x + 0.05)}" y1="${Y(s.y + s.h * 0.5)}" x2="${X(s.x + s.w - 0.05)}" y2="${Y(s.y + s.h * 0.5)}" stroke="${ink.line}" stroke-width="0.4"/>`);
      } else if (s.part === 'stone' && !s.cut && !s.kerb && s.bond !== 'block') {
        const R = mulberry32(Math.round(s.x * 977 + s.y * 131) | 1), course = 0.22, unit = s.bond === 'rubble' || s.bond === 'flagstone' ? 0.3 : 0.45;
        for (let y = s.y + course, row = 0; y < s.y + s.h - 0.02; y += course, row++) o.push(`<line x1="${X(s.x)}" y1="${Y(y)}" x2="${X(s.x + s.w)}" y2="${Y(y)}" stroke="${ink.line}" stroke-width="${s.joint === 'mortared' ? 1.4 : 0.7}"/>`);
        for (let y = s.y, row = 0; y < s.y + s.h - 0.02; y += course, row++) for (let x = s.x + (row % 2 ? unit / 2 : unit) * (s.bond === 'rubble' ? 0.5 + R() : 1); x < s.x + s.w - 0.05; x += unit * (s.bond === 'rubble' ? 0.6 + R() * 0.8 : 1)) o.push(`<line x1="${X(x)}" y1="${Y(y)}" x2="${X(x)}" y2="${Y(Math.min(y + course, s.y + s.h))}" stroke="${ink.line}" stroke-width="0.7"/>`);
      }
    } else if (s.k === 'poly') {
      o.push(`<polygon points="${s.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="${fillOf(s)}" stroke="${ink.line}" stroke-width="${s.solid ? 0.5 : lw}" stroke-linejoin="round"/>`);
      if (s.part === 'board') o.push(`<line x1="${X(s.pts[0][0] + 0.05)}" y1="${Y((s.pts[0][1] + s.pts[4][1]) / 2)}" x2="${X(s.pts[2][0] - 0.12)}" y2="${Y((s.pts[0][1] + s.pts[4][1]) / 2)}" stroke="${ink.line}" stroke-width="0.4"/>`);
    } else if (s.k === 'joint') {
      const x = +X(s.x), y = +Y(s.y), r = 3.5;
      if (s.kind === 'lashed') o.push(`<path d="M${x - r} ${y - r} L${x + r} ${y + r} M${x + r} ${y - r} L${x - r} ${y + r}" stroke="${ink.rope}" stroke-width="1.6"/>`);
      else if (s.kind === 'pegged') o.push(`<circle cx="${x}" cy="${y}" r="2" fill="${ink.line}"/>`);
      else if (s.kind === 'notched') o.push(`<path d="M${x - r} ${y - r} L${x} ${y} L${x + r} ${y - r}" fill="none" stroke="${ink.line}" stroke-width="1"/>`);
    } else if (s.k === 'hat') o.push(hatPath(X, Y, L, s.x, s.y, s.w, ink.hat));
    else if (s.k === 'relief') o.push(reliefPath(X, Y, L, s, ink.line));
    else if (s.k === 'chip') o.push(`<path d="M${X(s.x)} ${Y(s.y)} l3 -2 l-1 4 z" fill="${ink.line}"/>`);
    else if (s.k === 'bond') o.push(bondSvg(X, Y, L, s, ink, id));
  }
  for (const s of shapes) if (s.k === 'dim') o.push(dimSvg(X, Y, s, ink.colour ? '#555' : '#111'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">${defs}${o.join('')}</svg>`;
}

function hatPath(X, Y, L, x, y, w, fill) {
  const n = Math.max(4, Math.round(w / 0.035)), pts = [];
  for (let i = 0; i <= n; i++) { const xi = x + (w * i) / n; pts.push(`${X(xi)},${Y(y + (i % 2 ? 0.06 : 0.025))}`); }
  const drips = [];
  for (let i = 0; i <= n; i += 2) { const xi = x + (w * i) / n; drips.push(`${X(xi)},${Y(y - (i % 4 ? 0.05 : 0.025))}`); }
  return `<polygon points="${X(x)},${Y(y)} ${pts.join(' ')} ${X(x + w)},${Y(y)} ${drips.reverse().join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="0.6"/>`;
}
function reliefPath(X, Y, L, s, line) {
  const n = Math.max(3, Math.round(s.w / (s.h * 1.4))), step = s.w / n, d = [];
  if (s.kind === 'notch-band') for (let i = 0; i < n; i++) d.push(`M${X(s.x + i * step + step * 0.15)} ${Y(s.y + s.h)} L${X(s.x + i * step + step * 0.5)} ${Y(s.y)} L${X(s.x + i * step + step * 0.85)} ${Y(s.y + s.h)} Z`);
  else if (s.kind === 'chevron') { d.push(`M${X(s.x)} ${Y(s.y)}`); for (let i = 0; i < n; i++) d.push(`L${X(s.x + (i + 0.5) * step)} ${Y(s.y + s.h)} L${X(s.x + (i + 1) * step)} ${Y(s.y)}`); }
  else if (s.kind === 'rope') for (let i = 0; i < n * 1.5; i++) { const xi = s.x + (i * step) / 1.5; d.push(`M${X(xi)} ${Y(s.y)} L${X(xi + step / 1.5)} ${Y(s.y + s.h)}`); }
  return `<path d="${d.join(' ')}" fill="${s.kind === 'notch-band' ? line : 'none'}" stroke="${line}" stroke-width="0.9"/>`;
}
function dimSvg(X, Y, s, c) {
  const [ax, ay] = [+X(s.a[0]), +Y(s.a[1])], [bx, by] = [+X(s.b[0]), +Y(s.b[1])], vert = Math.abs(ax - bx) < 1;
  const t = vert ? `M${ax - 4} ${ay} h8 M${bx - 4} ${by} h8` : `M${ax} ${ay - 4} v8 M${bx} ${by - 4} v8`;
  const lx = vert ? ax + 6 : (ax + bx) / 2, ly = vert ? (ay + by) / 2 + 4 : ay - 5;
  return `<path d="M${ax} ${ay} L${bx} ${by} ${t}" stroke="${c}" stroke-width="0.8" fill="none"/><text x="${lx}" y="${ly}" class="dim" text-anchor="${vert ? 'start' : 'middle'}" fill="${c}">${esc(s.label)}</text>`;
}
// a bond in plan: the brick generator's bonds drawn as joints, clipped to the strip
function bondSvg(X, Y, L, s, ink, id) {
  const R = mulberry32(s.seed), polys = [], u = s.unit, x1 = s.x + s.w, y1 = s.y + s.h;
  if (s.bond === 'running') {
    const ch = u * 0.55;
    for (let y = s.y, row = 0; y < y1; y += ch, row++) for (let x = s.x - (row % 2 ? u / 2 : 0); x < x1; x += u) polys.push([[x, y], [x + u, y], [x + u, y + ch], [x, y + ch]]);
  } else if (s.bond === 'hex') {
    const r = u / 2, hw = r * Math.sqrt(3);
    for (let row = 0, y = s.y; y < y1 + r; row++, y += r * 1.5) for (let x = s.x - (row % 2 ? hw / 2 : 0); x < x1 + hw; x += hw) polys.push([0, 1, 2, 3, 4, 5].map((k) => [x + r * Math.cos(Math.PI / 6 + (k * Math.PI) / 3), y + r * Math.sin(Math.PI / 6 + (k * Math.PI) / 3)]));
  } else {
    // flagstone and rubble: a jittered grid, corners shared so the stones tile
    const nx = Math.ceil(s.w / u) + 1, ny = Math.max(2, Math.round(s.h / u)), cw = s.w / (nx - 1), chh = s.h / ny, jit = s.bond === 'rubble' ? 0.38 : 0.26, P = [];
    for (let j = 0; j <= ny; j++) { P.push([]); for (let i = 0; i <= nx; i++) P[j].push([s.x + i * cw + (i && i < nx ? (R() - 0.5) * jit * cw : 0), s.y + j * chh + (j && j < ny ? (R() - 0.5) * jit * chh : 0)]); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) polys.push([P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]]);
  }
  const shrink = (pts) => { const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; return pts.map(([x, y]) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1, k = Math.max(0, 1 - s.joint / 2 / l); return [cx + dx * k, cy + dy * k]; }); };
  const clip = `${id}c${Math.round(s.y * 100)}`;
  return `<clipPath id="${clip}"><rect x="${X(s.x)}" y="${Y(y1)}" width="${L(s.w)}" height="${L(s.h)}"/></clipPath><rect x="${X(s.x)}" y="${Y(y1)}" width="${L(s.w)}" height="${L(s.h)}" fill="${ink.line}" opacity="0.8"/><g clip-path="url(#${clip})">${polys.map((p) => `<polygon points="${shrink(p).map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" fill="${ink.stone}"/>`).join('')}</g>`;
}

// ── parts and joints, drawn once each ────────────────────────────────────────────────────────────────────────────────
const PART_SHAPES = {
  post: [{ k: 'ground', x0: -0.25, x1: 0.25 }, { k: 'box', part: 'footing', x: -0.06, y: -0.4, w: 0.12, h: 0.4, buried: true }, { k: 'box', part: 'post', x: -0.06, y: 0, w: 0.12, h: 1.1, timber: 'sawn', cap: 'bevel' }],
  rail: [{ k: 'box', part: 'rail', x: 0, y: 0, w: 1.4, h: 0.09, timber: 'sawn' }],
  beam: [{ k: 'box', part: 'beam', x: 0, y: 0, w: 1.6, h: 0.3, timber: 'sawn' }],
  plank: [{ k: 'box', part: 'plank', x: 0, y: 0, w: 0.25, h: 0.06, cut: true }, { k: 'box', part: 'plank', x: 0.3, y: 0, w: 0.25, h: 0.06, cut: true }, { k: 'box', part: 'plank', x: 0.6, y: 0, w: 0.25, h: 0.06, cut: true }],
  tread: [{ k: 'poly', part: 'soil', cut: true, pts: [[0, 0], [0, 0.15], [0.35, 0.15], [0.35, 0.3], [0.7, 0.3], [0.7, -0.1], [0, -0.1]] }],
  riser: [{ k: 'box', part: 'riser', x: 0, y: -0.1, w: 0.06, h: 0.28, timber: 'sawn' }, { k: 'box', part: 'footing', x: -0.04, y: -0.4, w: 0.04, h: 0.36, buried: true }],
  board: [{ k: 'box', part: 'board', x: 0, y: 0, w: 0.9, h: 0.35, timber: 'sawn' }, { k: 'relief', x: 0.04, y: 0.25, w: 0.82, h: 0.05, kind: 'notch-band' }],
  cap: [{ k: 'box', part: 'post', x: 0, y: 0, w: 0.14, h: 0.3, timber: 'sawn', cap: 'bevel' }, { k: 'box', part: 'post', x: 0.3, y: 0, w: 0.14, h: 0.3, timber: 'round', cap: 'round' }, { k: 'box', part: 'post', x: 0.6, y: 0, w: 0.14, h: 0.3, timber: 'sawn', cap: 'hat' }],
  footing: [{ k: 'ground', x0: -0.3, x1: 0.3 }, { k: 'box', part: 'footing', x: -0.07, y: -0.45, w: 0.14, h: 0.45, buried: true }, { k: 'box', part: 'post', x: -0.07, y: 0, w: 0.14, h: 0.3, timber: 'sawn' }],
  stone: [{ k: 'box', part: 'stone', x: 0, y: 0, w: 1.1, h: 0.5, bond: 'coursed', joint: 'mortared' }],
};
const JOINT_SHAPES = {
  lashed: [{ k: 'box', part: 'post', x: -0.05, y: 0, w: 0.1, h: 0.6, timber: 'culm', cap: 'open' }, { k: 'box', part: 'rail', x: -0.4, y: 0.4, w: 0.8, h: 0.08, timber: 'culm' }, { k: 'joint', x: 0, y: 0.44, kind: 'lashed' }],
  pegged: [{ k: 'box', part: 'post', x: -0.06, y: 0, w: 0.12, h: 0.6, timber: 'sawn', cap: 'bevel' }, { k: 'box', part: 'rail', x: -0.4, y: 0.4, w: 0.8, h: 0.08, timber: 'sawn' }, { k: 'joint', x: 0, y: 0.44, kind: 'pegged' }],
  notched: [{ k: 'box', part: 'post', x: -0.06, y: 0, w: 0.12, h: 0.6, timber: 'round', cap: 'round' }, { k: 'box', part: 'rail', x: -0.4, y: 0.4, w: 0.8, h: 0.08, timber: 'round' }, { k: 'joint', x: 0, y: 0.44, kind: 'notched' }],
  mortared: [{ k: 'box', part: 'stone', x: 0, y: 0, w: 0.9, h: 0.44, bond: 'coursed', joint: 'mortared' }],
  dry: [{ k: 'box', part: 'stone', x: 0, y: 0, w: 0.9, h: 0.44, bond: 'rubble', joint: 'dry' }],
};

// ── the page ────────────────────────────────────────────────────────────────────────────────────────────────────────
const CSS = `
:root{--ink:#111;--mute:#555;--line:#d6d6d6;--paper:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:13px/1.4 Helvetica,Arial,sans-serif}
#page{max-width:1240px;margin:0 auto;padding:22px 16px 60px}
h1{font-size:24px;margin:0;letter-spacing:.02em}h2{font-size:15px;margin:34px 0 8px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid var(--ink);padding-bottom:4px}
h3{font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.03em}
.lede{color:var(--mute);margin:4px 0 0;max-width:880px}.note{color:var(--mute);font-size:12px;margin:4px 0}
.grid{display:grid;gap:14px;align-items:start}.g2{grid-template-columns:repeat(auto-fit,minmax(min(100%,560px),1fr))}.g3{grid-template-columns:repeat(auto-fit,minmax(min(100%,370px),1fr))}.g5{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
.card{border:1.5px solid var(--ink);padding:12px;min-width:0}.card svg{max-width:100%;height:auto;display:block}
.badge{display:inline-block;border:1.5px solid var(--ink);border-radius:10px;padding:0 8px;font-size:10px;font-weight:700;text-transform:uppercase;margin-left:6px;vertical-align:1px}
.badge.solid{background:var(--ink);color:var(--paper)}
table{border-collapse:collapse;width:100%;font-size:12px}td,th{border-bottom:1px solid var(--line);padding:3px 6px 3px 0;text-align:left;vertical-align:top}th{font-size:10px;text-transform:uppercase;color:var(--mute)}
td.ok{font-weight:700}td.no{font-weight:700;background:var(--ink);color:var(--paper)}td.na{color:var(--mute)}
.ramp{display:flex;align-items:center;gap:0;margin:2px 0}.ramp .nm{width:64px;font-size:11px;font-weight:700}.ramp .chip{width:46px;height:30px;position:relative}.ramp .chip span{position:absolute;left:3px;bottom:2px;font-size:8.5px;font-family:Menlo,monospace}
.acc{display:inline-flex;align-items:center;gap:6px;font-size:11px;margin-top:6px}.acc i{width:18px;height:18px;display:inline-block;border:1px solid var(--ink)}
.tree{font:12px/1.55 Menlo,monospace;white-space:pre;overflow-x:auto;border:1.5px solid var(--ink);padding:10px}
.dim{font:10px Helvetica,Arial,sans-serif}.err{font:11px Menlo,monospace;background:#f2f2f2;padding:4px 6px;margin:3px 0;white-space:pre-wrap}
.from-trail{font-weight:700;text-decoration:underline}code{font:11.5px Menlo,monospace}
.views{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.views figure{margin:0;min-width:0}.views figcaption{font-size:10px;text-transform:uppercase;color:var(--mute)}`;

const rampRow = (name, stops) => `<div class="ramp"><span class="nm">${esc(name)}</span>${stops.map((c, i) => `<span class="chip" style="background:${hexOfRgb(c)}"><span style="color:${(c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) > 140 ? '#000' : '#fff'}">${i} ${hexOfRgb(c).slice(1)}</span></span>`).join('')}</div>`;

function swatchCard(kitId) {
  const K = SWATCHES[kitId], acc = accentOf(kitId);
  const land = K.land ? Object.entries(K.land).map(([n, s]) => rampRow(n, s)).join('') : '<p class="note">no land ramps yet: this kit\'s ground is a texture times a tint, recorded on its card</p>';
  const made = Object.entries(K.made).map(([n, s]) => (typeof s === 'string' ? `<div class="ramp"><span class="nm">${esc(n)}</span><span class="note">→ land ramp <b>${esc(s)}</b></span></div>` : rampRow(n, s))).join('');
  return `<div class="card"><h3>${esc(kitId)}</h3><p class="note">LAND${K.land ? '<span class="badge solid">drives the build</span>' : ''}</p>${land}<p class="note" style="margin-top:8px">MADE<span class="badge">built things</span></p>${made}<div class="acc"><i style="background:${hexOfRgb(acc)}"></i>accent: <code>${esc(K.accent.join(' '))}</code> ${hexOfRgb(acc)}, one small use</div></div>`;
}

function lawRows(laws) {
  return laws.map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok === null ? 'na' : l.ok ? 'ok' : 'no'}">${l.ok === null ? 'when placed' : l.ok ? 'holds' : 'BROKEN'}</td><td>${esc(n2(l.value))}</td><td>${esc(l.want)}</td></tr>`).join('');
}

function patternCard(id, style, seed) {
  const P = MADE_PATTERNS[id], d = designPiece(id, style, seed);
  const views = [d.elevation && ['elevation', d.elevation, 560], d.plan && ['plan', d.plan, 560], d.section && [id === 'bridge' ? 'end' : 'section', d.section, 300]].filter(Boolean);
  const draw = views.map(([nm, sh, w]) => `<figure>${drawShapes(sh, { w, maxH: 280 })}<figcaption>${nm}</figcaption></figure>`).join('');
  const kits = MADE_KITS.map((k) => { const st = madeStyle(k, seed), dd = designPiece(id, st, seed); return `<figure>${drawShapes(dd.elevation || dd.plan, { w: 220, maxH: 150, pad: 14, dims: false })}<figcaption>${esc(k)}${dd.variant ? ` · ${esc(dd.variant)}` : ''}</figcaption></figure>`; }).join('');
  // the bridge is the playscape entry: each of its variants, dressed in the meadow's other tokens
  const variants = id === 'bridge' ? `<h3 style="margin-top:10px">Its variants, in the same tokens <span class="badge">playscape entry</span></h3><div class="views">${['deck', 'rope', 'arch', 'plank'].map((v) => { const vd = designPiece(id, { ...style, tokens: { ...style.tokens, bridge: v } }, seed); return `<figure>${drawShapes(vd.elevation, { w: 280, maxH: 170, pad: 14, dims: false })}<figcaption>${v} · ${esc(vd.crossing.read)}${vd.laws.every((l) => l.ok !== false) ? ' · laws hold' : ' · BROKEN'} · ${esc(vd.elements.join(', '))}</figcaption></figure>`; }).join('')}</div>` : '';
  const why = MADE_LAWS.filter((l) => l.pattern === id).map((l) => `<tr><td>${esc(l.law)}</td><td>${esc(l.why)}</td></tr>`).join('');
  const rails = Object.entries(P.rails).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(showRail(v))}</td><td>${esc(n2(d.dims[k]))}</td></tr>`).join('');
  return `<div class="card" id="p-${id}"><h3>${esc(id)}</h3><p class="note">${esc(P.read)}</p>
<p class="note">stands at: <b>${P.at.map(esc).join(', ')}</b> · parts: ${P.parts.map(esc).join(', ')} · joints: ${P.joints.map(esc).join(', ')}</p>
<div class="views">${draw}</div>
<div class="grid g2" style="margin-top:8px"><div><h3>Laws, measured <span class="badge">machine gate</span></h3><table><tr><th>law</th><th></th><th>value</th><th>want</th></tr>${lawRows(d.laws)}</table>
<h3 style="margin-top:10px">Why</h3><table>${why}</table></div>
<div><h3>Dimension rails</h3><table><tr><th>dimension</th><th>rail (m)</th><th>this one</th></tr>${rails}</table><p class="note">The rails sit inside the laws: any roll holds them.</p></div></div>
${variants}<h3 style="margin-top:10px">The same pattern in each kit's tokens</h3><div class="views">${kits}</div></div>`;
}

function kitCard(kitId, seed) {
  const R = MADE_RAILS[kitId], st = madeStyle(kitId, seed);
  const rows = Object.entries(R).filter(([k]) => k !== 'swatch').map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(showRail(v))}</td><td>${esc(n2(st.tokens[k]))}</td></tr>`).join('');
  const roles = Object.entries(st.swatch).map(([role, s]) => `<tr><td>${esc(role)}</td><td>${esc(s.ramp)}</td><td><span style="display:inline-flex">${s.stops.map((c) => `<i style="width:14px;height:14px;display:inline-block;background:${hexOfRgb(c)}"></i>`).join('')}</span></td></tr>`).join('');
  const plate = ['post-fence', 'sign', 'inukshuk'].map((p) => `<figure>${drawShapes(designPiece(p, st, seed).elevation, { w: 112, maxH: 150, style: st, pad: 8, dims: false })}</figure>`).join('')
    + `<figure>${drawShapes(designPiece('bridge', st, seed).elevation, { w: 340, maxH: 150, style: st, pad: 8, dims: false })}<figcaption>bridge: ${esc(st.tokens.bridge)}</figcaption></figure>`;
  return `<div class="card"><h3>${esc(kitId)}</h3><table><tr><th>token</th><th>rail</th><th>seed ${seed}</th></tr>${rows}</table>
<h3 style="margin-top:8px">Swatch roles</h3><table>${roles}</table><h3 style="margin-top:8px">Plate <span class="badge">painted from the swatches</span></h3><div class="views">${plate}</div></div>`;
}

function cascadeSvg() {
  const box = (y, t, s, solid) => `<rect x="150" y="${y}" width="360" height="46" fill="${solid ? '#111' : '#fff'}" stroke="#111" stroke-width="1.5"/><text x="166" y="${y + 20}" font-weight="700" font-size="13" fill="${solid ? '#fff' : '#111'}">${t}</text><text x="166" y="${y + 36}" font-size="11" fill="${solid ? '#ddd' : '#555'}">${s}</text>`;
  const arrow = (y) => `<path d="M330 ${y} v14 m-5 -6 l5 6 l5 -6" stroke="#111" fill="none" stroke-width="1.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="270" viewBox="0 0 560 270">
${box(6, '1 · LAWS', 'structural, the same in every style: checks, never tokens', true)}${arrow(52)}
${box(68, '2 · KIT', 'tokens rolled in rails by the seed · swatch roles', false)}${arrow(114)}
${box(130, '3 · TRAIL  made: { tokens, swatches, pieces }', 'narrow a token · re-point a role · add a piece', false)}${arrow(176)}
${box(192, '4 · PIECE', 'a pattern\'s dimensions in its rails, by its sub-seed', false)}
<rect x="6" y="68" width="120" height="46" fill="#fff" stroke="#111" stroke-dasharray="4 3"/><text x="16" y="88" font-weight="700" font-size="12">SWATCHES</text><text x="16" y="104" font-size="10" fill="#555">every colour</text><path d="M126 91 h22 m-6 -5 l6 5 l-6 5" stroke="#111" fill="none"/>
<text x="150" y="258" font-size="11" fill="#555">a lower layer may narrow, never loosen: the laws hold at every layer</text></svg>`;
}

const TREE = `outdoor master index
├─ swatches            style/swatches.js — every colour, per kit
│  ├─ land             ramps the builder paints from today (isekai kits)
│  ├─ made             timber · stone · rope · paint · moss
│  └─ accent           one stop, one small use
├─ laws                structural non-negotiables, per pattern (checks)
├─ parts · joints      post rail beam plank tread riser board cap footing stone
│                      lashed pegged notched mortared dry
├─ patterns            read · stands at (trail spots) · parts · joints · dimension rails · design
├─ kit rails           tokens (timber joint edge bond relief chunk hat paint wear) · swatch roles
├─ trail.made          tokens (narrow) · swatches (re-point) · pieces (add)
└─ piece               pattern + sub-seed → dimensions → elevation, section, plan → laws measured`;

const EXAMPLE = {
  kit: 'isekai-meadow', seed: 8,
  made: { tokens: { timber: 'round', hat: [0.8, 0.9] }, swatches: { hat: 'foliage' }, pieces: [{ pattern: 'bridge', at: 'crossing', dims: { span: 6 } }, { pattern: 'sign', at: 'trailhead' }, { pattern: 'paving', from: 4, to: 16 }] },
};
const REFUSED = [
  { laws: { 'rail-height': [0.6, 1.2] } },
  { tokens: { joint: 'lashed' } },
  { tokens: { chunk: 2 } },
  { swatches: { paint: 'neon' } },
  { pieces: [{ pattern: 'post-fence', at: 'pit', dims: { railTop: 0.7 } }] },
  { pieces: [{ pattern: 'inukshuk', from: 0, to: 10 }] },
];

function cascadeCard() {
  const base = madeStyle(EXAMPLE.kit, EXAMPLE.seed), ford = madeStyle(EXAMPLE.kit, EXAMPLE.seed, EXAMPLE.made);
  const rows = Object.keys(ford.tokens).map((k) => `<tr><td>${esc(k)}</td><td>${esc(n2(base.tokens[k]))}</td><td class="${ford.from[k] === 'trail' ? 'from-trail' : ''}">${esc(n2(ford.tokens[k]))}</td><td>${esc(ford.from[k])}</td></tr>`).join('')
    + Object.entries(ford.swatch).map(([r, s]) => `<tr><td>swatch ${esc(r)}</td><td>${esc(base.swatch[r].ramp)}</td><td class="${s.from === 'trail' ? 'from-trail' : ''}">${esc(s.ramp)}</td><td>${esc(s.from)}</td></tr>`).join('');
  const refused = REFUSED.map((m) => { try { madeStyle(EXAMPLE.kit, 1, m); return ''; } catch (e) { return `<div class="err"><b>${esc(JSON.stringify(m))}</b>\n→ ${esc(e.message)}</div>`; } }).join('');
  const pieces = ford.pieces.map((p, i) => { const d = designPiece(p.pattern, ford, EXAMPLE.seed + i, p.dims); return `<figure>${drawShapes(d.elevation || d.plan, { w: 300, maxH: 170, style: ford, pad: 14 })}<figcaption>${esc(p.pattern)} · ${esc(p.at ?? `${p.from}–${p.to} m`)} · ${d.laws.every((l) => l.ok !== false) ? 'laws hold' : 'BROKEN'}</figcaption></figure>`; }).join('');
  return `<div class="grid g2"><div class="card"><h3>out-trail:ford — <code>trail.made</code></h3><pre class="err">${esc(JSON.stringify(EXAMPLE.made, null, 1))}</pre>
<table><tr><th>token</th><th>kit (meadow, seed ${EXAMPLE.seed})</th><th>computed</th><th>set by</th></tr>${rows}</table><p class="note">Underlined: set by the trail. Everything else falls through from the kit, rolled by the same sub-seed, so narrowing one token leaves the others where they were.</p></div>
<div class="card"><h3>Refused, and why</h3>${refused}<h3 style="margin-top:10px">The ford's pieces</h3><div class="views">${pieces}</div></div></div>`;
}

/** The whole index as one HTML page. */
export function outIndexHtml({ seed = 8 } = {}) {
  UID = 0;
  const meadow = madeStyle('isekai-meadow', seed);
  const parts = Object.entries(MADE_PARTS).map(([k, read]) => `<div class="card"><h3>${esc(k)}</h3>${drawShapes(PART_SHAPES[k], { w: 200, maxH: 120, pad: 12 })}<p class="note">${esc(read)}</p></div>`).join('');
  const joints = Object.entries(MADE_JOINTS).map(([k, read]) => `<div class="card"><h3>${esc(k)}</h3>${drawShapes(JOINT_SHAPES[k], { w: 200, maxH: 110, pad: 12 })}<p class="note">${esc(read)}</p></div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outdoor Master Index</title><style>${CSS}</style></head><body><div id="page">
<h1>OUTDOOR MASTER INDEX</h1>
<p class="lede">Man-made architecture along a trail and the colours every outdoor kit may use. The page is a cascade: laws no layer can loosen, then each kit's tokens and swatches, then a trail's own <code>made</code> block, then the single piece. The drawings are black and white; colour lives in the swatches and the kit plates. Placed in a world: not yet. The trail spots a piece may stand at: ${MADE_SPOTS.map(esc).join(', ')}.</p>
<h2>The hierarchy</h2><div class="grid g2"><div>${cascadeSvg()}</div><div class="tree">${esc(TREE)}</div></div>
<h2>Swatches <span class="badge solid">art direction</span></h2><p class="note">The source of every outdoor colour. A land ramp marked "drives the build" is what that kit's builder paints from: change a stop here and the kit changes. Each ramp runs darkest to lightest; the darkest stop is a cool colour, never black.</p>
<div class="grid g3">${Object.keys(SWATCHES).map(swatchCard).join('')}</div>
<h2>Parts</h2><div class="grid g5">${parts}</div>
<h2>Joints</h2><div class="grid g5">${joints}</div>
<h2>Patterns</h2><p class="note">Each drawn in isekai-meadow's tokens at seed ${seed} (${esc(Object.entries(meadow.tokens).map(([k, v]) => `${k} ${n2(v)}`).join(' · '))}), then once in every kit's tokens.</p>
${MADE_PATTERN_IDS.map((id) => patternCard(id, meadow, seed)).join('<div style="height:14px"></div>')}
<h2>Kits</h2><div class="grid g3">${MADE_KITS.map((k) => kitCard(k, seed)).join('')}</div>
<h2>A trail's own layer</h2>${cascadeCard()}
</div></body></html>`;
}
