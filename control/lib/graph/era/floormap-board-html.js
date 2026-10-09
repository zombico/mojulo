/**
 * THE FLOORMAP BOARD — a floormap drawn for approval before anything is baked or painted, as one HTML page of tracked
 * PIECES (the art board's chrome, as the UI and walkmesh boards copy it). No browser is needed to draw it: the shots
 * are the greybox projected through each camera in plain SVG.
 *
 *   map:plan            the floor from above: regions, each camera's zone tinted, edges by kind, doors, exits, items,
 *                       the cameras and their view, the cuts that turn the figure round
 *   map:shot:<camera>   the greybox through that camera, its zone tinted, a figure standing in it for scale
 *   map:laws            the advice
 *
 *   floormapBoardHtml(manifest)   the board (reads the floormap, solves the cameras)
 *   floormapPieceIds(manifest)
 *   floormapBoardPng(manifest)    the board laid out by a local Chromium (scene-png.js renderPageToPng)
 */
import { readFloormap, floormapFaces, footprint, centroid, triggerArea } from './floormap.js';
import { floormapCameras, cutsOf, VIEW, FIGURE } from './floormap-cameras.js';
import { floormapAdvice, project, FLOORMAP_LAWS } from './floormap-laws.js';
import { plateBrief } from './floormap-brief.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;
const STATUS = { proposed: '#e8b04a', approved: '#6cc070', auto: '#8a93a6' };
export const MAP_ITEMS = Object.freeze(['map', 'items', 'cameras']);
const TITLES = { map: 'Map', items: 'Items', cameras: 'Cameras' };
const HUES = ['#4ec3d6', '#e8b04a', '#d65cc0', '#6cc070', '#9a7cf0', '#f07c5a', '#5ab4f0', '#c0c060'];
const EDGE_STYLE = {
  wall: 'stroke="#e9e4da" stroke-width="3.2"',
  rail: 'stroke="#e9e4da" stroke-width="1.6" stroke-dasharray="2 3"',
  drop: 'stroke="#f07c5a" stroke-width="2.2" stroke-dasharray="1 3" stroke-linecap="round"',
  water: 'stroke="#5ab4f0" stroke-width="2.6"',
  foliage: 'stroke="#6cc070" stroke-width="2.6" stroke-dasharray="5 2"',
  void: 'stroke="#6d6f74" stroke-width="1"',
  open: 'stroke="#6d6f74" stroke-width=".8" stroke-dasharray="1 4"',
};
const SHADE = { floor: '#8d8a83', wall: '#6d6f74', lintel: '#6d6f74', rail: '#a3a5a9', foliage: '#5d7a55', drop: '#3d4a5a', water: '#3a5a7a', stand: '#d8d2c4', block: '#b8b0a0' };

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#14161a;color:#e9e4da;font:13px/1.35 Helvetica,Arial,sans-serif}
#board{width:1200px;padding:18px 20px 20px}
h1{font-size:22px;margin:0;letter-spacing:.02em}
.lede{color:#9a958c;font-size:12px;margin:3px 0 12px}
.row{display:grid;gap:10px;margin-bottom:10px}.r3{grid-template-columns:1fr 1fr 1fr}
.card{background:#1e2026;border-radius:6px;padding:12px 14px;min-width:0}
.card header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.card h2{font-size:15px;margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{border:1.5px solid;border-radius:10px;padding:1px 10px;font-size:11px;font-weight:700;text-transform:uppercase;white-space:nowrap}
.note{color:#9a958c;font-size:12px;margin:2px 0 8px}
.key{display:flex;flex-wrap:wrap;gap:4px 14px;color:#9a958c;font-size:11px;margin:6px 0 0}.key svg{display:inline-block;width:22px;height:10px;vertical-align:-1px;margin-right:4px;background:none}
.shot .brief{color:#9a958c;font-size:10.5px;line-height:1.3;margin:4px 0 0}.shot small{display:block;color:#9a958c;margin:4px 0 0;font-size:11px}.shot b{color:#e9e4da;font-weight:700}
ul.adv{margin:6px 0 0;padding-left:16px;color:#e8b04a;font-size:12px}ul.adv b{color:#e9e4da;font-weight:400}
p.ok{color:#6cc070;font-size:12px;margin:6px 0 0}
svg{display:block;width:100%;height:auto;background:#0d0e11;border-radius:3px}
[data-piece]{display:contents}
`;

const piece = (id, html) => `<div data-piece="${esc(id)}">${html}</div>`;
const badge = (label, status) => { const c = STATUS[status] || '#9a958c'; return `<span class="badge" style="color:${c};border-color:${c}">${esc(label)} · ${esc(status)}</span>`; };
const label = (x, y, text, size, anchor = 'start', fill = '#e9e4da') => `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" paint-order="stroke" stroke="#0d0e11" stroke-width="${r1(size / 4)}" font-family="Helvetica,Arial,sans-serif">${esc(text)}</text>`;
const hueOf = (cams) => new Map(cams.map((c, i) => [c.id, HUES[i % HUES.length]]));

function figurePath([x, y], s) {
  const w = s * 0.13, r = s * 0.075;
  return `<path d="M${r1(x - w * 0.55)} ${r1(y)} L${r1(x - w * 0.35)} ${r1(y - s * 0.47)} L${r1(x - w)} ${r1(y - s * 0.5)} L${r1(x - w * 0.8)} ${r1(y - s * 0.8)} L${r1(x + w * 0.8)} ${r1(y - s * 0.8)} L${r1(x + w)} ${r1(y - s * 0.5)} L${r1(x + w * 0.35)} ${r1(y - s * 0.47)} L${r1(x + w * 0.55)} ${r1(y)} Z"/><circle cx="${r1(x)}" cy="${r1(y - s + r)}" r="${r1(r)}"/>`;
}

const GLYPH = {
  stand: (x, y, k) => `<circle cx="${x}" cy="${y}" r="${r1(Math.max(3, k))}" fill="#e9e4da"/>`,
  hotspot: (x, y) => `<path d="M${x} ${y - 6} L${x + 6} ${y} L${x} ${y + 6} L${x - 6} ${y} Z" fill="#e8b04a"/>`,
  pickup: (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="none" stroke="#e8b04a" stroke-width="2"/>`,
  trigger: (x, y, k) => `<circle cx="${x}" cy="${y}" r="${r1(k)}" fill="none" stroke="#d65cc0" stroke-dasharray="3 2"/>`,
  light: (x, y) => `<circle cx="${x}" cy="${y}" r="3" fill="#fff6c0"/><circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#fff6c0" stroke-opacity=".5"/>`,
};

/** map:plan — the floor from above (north up). */
export function piecePlan(fm, cams, cuts) {
  const hue = hueOf(cams), pts = [...fm.regions.flatMap((r) => r.poly), ...cams.map((c) => c.basis.position)];
  let x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const pad = 2; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const VW = 1120, k = Math.min(VW / (x1 - x0), 620 / (y1 - y0)), VH = (y1 - y0) * k, W = (x1 - x0) * k, ox = (VW - W) / 2;
  const X = (x) => r1(ox + (x - x0) * k), Y = (y) => r1(VH - (y - y0) * k), at = (p) => `${X(p[0])},${Y(p[1])}`;
  const span = Math.max(x1 - x0, y1 - y0), step = [1, 2, 5, 10, 20].find((g) => span / g <= 40) || 50;
  let grid = '';
  for (let g = Math.ceil(x0 / step) * step; g <= x1; g += step) grid += `<line x1="${X(g)}" x2="${X(g)}" y1="0" y2="${r1(VH)}" stroke="#1d1f24"/>`;
  for (let g = Math.ceil(y0 / step) * step; g <= y1; g += step) grid += `<line y1="${Y(g)}" y2="${Y(g)}" x1="${r1(ox)}" x2="${r1(ox + W)}" stroke="#1d1f24"/>`;
  const floors = fm.regions.map((r) => `<polygon points="${r.poly.map(at).join(' ')}" fill="#2b2d33"/>`).join('');
  const zones = cams.map((c) => `<polygon points="${c.zone.poly.map(at).join(' ')}" fill="${hue.get(c.id)}" fill-opacity=".16"/>`).join('');
  const names = fm.regions.map((r) => { const c = centroid(r.poly); return label(X(c[0]), Y(c[1]) + 4, r.id, 12, 'middle', '#9a958c'); }).join('');
  const edges = fm.pieces.map((p) => {
    if (p.kind === 'door') {
      const tick = (q) => `<line x1="${X(q[0] - p.n[0] * 0.3)}" y1="${Y(q[1] - p.n[1] * 0.3)}" x2="${X(q[0] + p.n[0] * 0.3)}" y2="${Y(q[1] + p.n[1] * 0.3)}" stroke="#e8b04a" stroke-width="2.4"/>`;
      return `${tick(p.a)}${tick(p.b)}`;
    }
    if (p.kind === 'exit') {
      const m = [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2], e = [m[0] + p.n[0] * 1.4, m[1] + p.n[1] * 1.4];
      return `<line x1="${X(p.a[0])}" y1="${Y(p.a[1])}" x2="${X(p.b[0])}" y2="${Y(p.b[1])}" stroke="#fff" stroke-width="1.4" stroke-dasharray="6 3"/><line x1="${X(m[0])}" y1="${Y(m[1])}" x2="${X(e[0])}" y2="${Y(e[1])}" stroke="#fff" stroke-width="2.4" marker-end="url(#arrow)"/>${label(X(e[0] + p.n[0] * 0.6), Y(e[1] + p.n[1] * 0.6) + 4, `${p.id} → ${p.to.map}${p.to.door ? `.${p.to.door}` : ''}`, 11, p.n[0] < -0.5 ? 'end' : p.n[0] > 0.5 ? 'start' : 'middle')}`;
    }
    return `<line x1="${X(p.a[0])}" y1="${Y(p.a[1])}" x2="${X(p.b[0])}" y2="${Y(p.b[1])}" ${EDGE_STYLE[p.kind] || EDGE_STYLE.void} stroke-linecap="square"/>`;
  }).join('');
  const items = fm.items.map((it) => {
    const x = X(it.at[0]), y = Y(it.at[1]), f = footprint(it);
    let g;
    if (f && it.kind === 'block') g = `<polygon points="${f.map(at).join(' ')}" fill="#b8b0a0" fill-opacity=".85"/>`;
    else if (f) g = `<polygon points="${f.map(at).join(' ')}" fill="#e9e4da"/>`;
    else if (it.kind === 'trigger') g = `<polygon points="${triggerArea(it).map(at).join(' ')}" fill="#d65cc0" fill-opacity="${it.cut ? '.12' : '0'}" stroke="#d65cc0" stroke-dasharray="3 2"/>`;
    else if (it.kind === 'spawn') { const a = (it.face * Math.PI) / 180, d = [Math.cos(a), -Math.sin(a)]; g = `<path d="M${r1(x + d[0] * 9)} ${r1(y + d[1] * 9)} L${r1(x - d[1] * 5 - d[0] * 4)} ${r1(y + d[0] * 5 - d[1] * 4)} L${r1(x + d[1] * 5 - d[0] * 4)} ${r1(y - d[0] * 5 - d[1] * 4)} Z" fill="#fff"/>`; }
    else g = GLYPH[it.kind](x, y, (it.r || 1) * k);
    return `${g}${label(x + 8, y - 7, it.id, 10, 'start', '#c9c3b6')}`;
  }).join('');
  const lenses = cams.map((c) => {
    const P = c.basis.position, F = c.basis.forward, fl = Math.hypot(F[0], F[1]) || 1, half = (c.framing.horizontalFov * Math.PI) / 360, zc = centroid(c.zone.poly), L = Math.hypot(zc[0] - P[0], zc[1] - P[1]) * 1.35 + 1;
    const ray = (a) => { const cs = Math.cos(a), sn = Math.sin(a), dx = (F[0] * cs - F[1] * sn) / fl, dy = (F[0] * sn + F[1] * cs) / fl; return [P[0] + dx * L, P[1] + dy * L]; };
    const h = hue.get(c.id);
    return `<polygon points="${at(P)} ${at(ray(half))} ${at(ray(-half))}" fill="${h}" fill-opacity=".07" stroke="${h}" stroke-opacity=".7" stroke-dasharray="4 3"/><rect x="${r1(X(P[0]) - 5)}" y="${r1(Y(P[1]) - 4)}" width="10" height="8" fill="${h}"/>${label(X(P[0]), Y(P[1]) - 8, `${c.id} · ${c.shot}`, 11, 'middle', h)}`;
  }).join('');
  // a camera trigger: an arrow from its floor to the camera it cuts to (an insert's camera is its own)
  const pos = new Map(cams.map((c) => [c.id, c.basis.position]));
  const trig = fm.items.filter((it) => it.kind === 'trigger' && it.cut).map((it) => {
    const to = typeof it.cut === 'string' ? it.cut : it.id, P = pos.get(to), h = hue.get(to) || '#d65cc0';
    if (!P) return '';
    const d = [P[0] - it.at[0], P[1] - it.at[1]], L = Math.hypot(...d) || 1, e = [P[0] - (d[0] / L) * 0.5, P[1] - (d[1] / L) * 0.5];
    return `<line x1="${X(it.at[0])}" y1="${Y(it.at[1])}" x2="${X(e[0])}" y2="${Y(e[1])}" stroke="${h}" stroke-width="1.6" stroke-dasharray="5 3" marker-end="url(#arrow)"/>${label(X(it.at[0]), Y(it.at[1]) + 16, typeof it.cut === 'string' ? `cut → ${to}${it.from ? ` (from ${it.from})` : ''}` : `insert · ${it.cut.shot}`, 10, 'middle', h)}`;
  }).join('');
  const flips = cuts.filter((c) => c.flips && c.by !== 'leave').map((c) => `<circle cx="${X(c.at[0])}" cy="${Y(c.at[1])}" r="7" fill="none" stroke="#f07c5a" stroke-width="2"/>${label(X(c.at[0]) + 10, Y(c.at[1]) + 4, `${c.from} → ${c.to} turns round`, 10, 'start', '#f07c5a')}`).join('');
  const bar = `<line x1="${r1(ox + 10)}" x2="${r1(ox + 10 + step * k)}" y1="${r1(VH - 10)}" y2="${r1(VH - 10)}" stroke="#fff" stroke-width="2"/>${label(ox + 10, VH - 15, `${step} m`, 10)}`;
  const defs = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#fff"/></marker></defs>';
  return piece('map:plan', `<svg viewBox="0 0 ${VW} ${r1(VH)}">${defs}${grid}${floors}${zones}${names}${edges}${items}${lenses}${trig}${flips}${bar}</svg>`);
}

// a world polygon cut to the part in front of the camera
function clipNear(B, poly) {
  const side = (P) => (P[0] - B.position[0]) * B.forward[0] + (P[1] - B.position[1]) * B.forward[1] + (P[2] - B.position[2]) * B.forward[2] - 0.06;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length], sp = side(P), sq = side(Q);
    if (sp >= 0) out.push(P);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([0, 1, 2].map((j) => P[j] + (Q[j] - P[j]) * t)); }
  }
  return out;
}
const LIGHT = (() => { const v = [-0.35, -0.55, 0.76], L = Math.hypot(...v); return v.map((x) => x / L); })();
const shade = (hex, n) => { const s = 0.58 + 0.42 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]); return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * s).toString(16).padStart(2, '0')).join('')}`; };

/** map:shot:<camera> — the greybox through one camera, painter-sorted, back faces of the edges culled. */
export function pieceShot(fm, cam, faces, hue, brief = null) {
  const B = cam.basis, s = 480 / VIEW.width, z = fm.regions.find((r) => r.id === cam.zone.region).z, draws = [];
  for (const f of faces) {
    const c = f.corners.reduce((a, p) => [a[0] + p[0] / f.corners.length, a[1] + p[1] / f.corners.length, a[2] + p[2] / f.corners.length], [0, 0, 0]);
    if (f.kind !== 'floor' && (c[0] - B.position[0]) * f.normal[0] + (c[1] - B.position[1]) * f.normal[1] + (c[2] - B.position[2]) * f.normal[2] > 0) continue;
    const poly = clipNear(B, f.corners);
    if (poly.length < 3) continue;
    const q = poly.map((P) => project(B, P)).filter(Boolean);
    if (q.length < 3) continue;
    const depth = Math.max(...q.map((x) => x.depth));
    const base = shade(SHADE[f.kind] || '#8d8a83', f.normal);
    draws.push({ depth, floor: f.kind === 'floor', svg: `<polygon points="${q.map((x) => `${r1(x.px[0] * s)},${r1(x.px[1] * s)}`).join(' ')}" fill="${base}" stroke="#0d0e11" stroke-opacity=".35" stroke-width=".5"/>` });
  }
  // the zone on the floor, and a figure standing at its middle (sorted in, so a stand in front hides it)
  const zp = clipNear(B, cam.zone.poly.map(([x, y]) => [x, y, z + 0.01])).map((P) => project(B, P)).filter(Boolean);
  const zone = zp.length >= 3 ? `<polygon points="${zp.map((x) => `${r1(x.px[0] * s)},${r1(x.px[1] * s)}`).join(' ')}" fill="${hue}" fill-opacity=".18" stroke="${hue}" stroke-width="1.2"/>` : '';
  const c = centroid(cam.zone.poly), feet = project(B, [c[0], c[1], z]), head = project(B, [c[0], c[1], z + FIGURE]);
  if (feet && head) draws.push({ depth: feet.depth - 0.01, svg: `<g fill="#f4efe6" stroke="#0d0e11" stroke-width=".6">${figurePath([feet.px[0] * s, feet.px[1] * s], Math.hypot(feet.px[0] - head.px[0], feet.px[1] - head.px[1]) * s)}</g>` });
  for (const it of fm.items) {
    if (!GLYPH[it.kind] || it.kind === 'stand') continue;
    const p = project(B, [it.at[0], it.at[1], it.z + (it.kind === 'light' ? it.h : 0.05)]);
    if (p) draws.push({ depth: p.depth - 0.02, svg: GLYPH[it.kind](r1(p.px[0] * s), r1(p.px[1] * s), 6) });
  }
  // floors lie under everything that stands: they go first, then the zone's tint, then the rest far to near
  draws.sort((a, b) => (b.floor ? 1 : 0) - (a.floor ? 1 : 0) || b.depth - a.depth);
  const n = draws.filter((d) => d.floor).length, body = draws.slice(0, n).map((d) => d.svg).join('') + zone + draws.slice(n).map((d) => d.svg).join('');
  return piece(`map:shot:${cam.id}`, `<div class="shot"><svg viewBox="0 0 480 270"><rect width="480" height="270" fill="#202228"/>${body}</svg><small><b style="color:${hue}">${esc(cam.id)}</b> · ${cam.shot} · ${Math.round(cam.framing.horizontalFov)}° across · eye ${r1(cam.basis.position[2] - z)} m · sees ${esc(cam.zone.region)}</small>${brief ? `<p class="brief">${esc(brief.prompt)}</p>` : ''}</div>`);
}

/** map:laws — the advice, grouped by law. */
export function pieceLaws(adv) {
  const by = {};
  for (const a of adv) (by[a.law] = by[a.law] || []).push(a);
  return piece('map:laws', adv.length ? `<ul class="adv">${Object.entries(by).map(([law, list]) => `<li><b>${esc(law)}</b>: ${list.map((a) => `${esc(a.at)}: ${esc(a.advice)}`).join('; ')}</li>`).join('')}</ul>` : `<p class="ok">every law holds (${Object.keys(FLOORMAP_LAWS).length} checked)</p>`);
}

const solve = (manifest) => { const fm = readFloormap(manifest), cams = floormapCameras(fm, manifest.cameras), cuts = cutsOf(fm, cams); return { fm, cams, cuts, adv: floormapAdvice(fm, cams, cuts) }; };
export const floormapPieceIds = (manifest) => { const { cams } = solve(manifest); return ['map:plan', ...cams.map((c) => `map:shot:${c.id}`), 'map:laws']; };

const KEY = `<div class="key">${['wall', 'rail', 'drop', 'water', 'foliage', 'void'].map((k) => `<span><svg viewBox="0 0 22 10"><line x1="1" x2="21" y1="5" y2="5" ${EDGE_STYLE[k]}/></svg>${k}</span>`).join('')}<span><svg viewBox="0 0 22 10"><line x1="5" x2="5" y1="1" y2="9" stroke="#e8b04a" stroke-width="2.4"/><line x1="17" x2="17" y1="1" y2="9" stroke="#e8b04a" stroke-width="2.4"/></svg>door</span><span><svg viewBox="0 0 22 10"><line x1="1" x2="21" y1="5" y2="5" stroke="#fff" stroke-dasharray="6 3"/></svg>exit</span><span><svg viewBox="0 0 22 10"><circle cx="11" cy="5" r="4" fill="#e9e4da"/></svg>stand</span><span><svg viewBox="0 0 22 10"><rect x="5" y="1" width="12" height="8" fill="#b8b0a0"/></svg>block</span><span><svg viewBox="0 0 22 10"><path d="M11 0 L16 5 L11 10 L6 5 Z" fill="#e8b04a"/></svg>hotspot</span><span><svg viewBox="0 0 22 10"><circle cx="11" cy="5" r="3.5" fill="none" stroke="#e8b04a" stroke-width="2"/></svg>pickup</span><span><svg viewBox="0 0 22 10"><circle cx="11" cy="5" r="2.5" fill="#fff6c0"/></svg>light</span><span><svg viewBox="0 0 22 10"><rect x="6" y="1" width="10" height="8" fill="#4ec3d6"/></svg>camera, its zone tinted</span></div>`;

/** The board for a floormap manifest, as one self-contained HTML document. */
export function floormapBoardHtml(manifest) {
  const { fm, cams, cuts, adv } = solve(manifest), st = Object.fromEntries(MAP_ITEMS.map((k) => [k, (manifest.direction || {})[k] || 'proposed'])), hue = hueOf(cams), faces = floormapFaces(fm);
  const tally = Object.entries(fm.pieces.reduce((m, p) => ((m[p.kind] = (m[p.kind] || 0) + Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1])), m), {})).filter(([k]) => k !== 'open').map(([k, v]) => `${k} ${Math.round(v)} m`).join(' · ');
  const shots = cams.map((c) => pieceShot(fm, c, faces, hue.get(c.id), plateBrief(fm, c, { style: manifest.style }))).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>${esc(`Floormap · ${fm.title}`)}</title><style>${CSS}</style></head><body><div id="board">
<h1>${esc(`FLOORMAP · ${fm.title}`.toUpperCase())}</h1>
<p class="lede">seed ${fm.seed} · ${fm.regions.length} regions · ${fm.items.length} items · ${cams.length} cameras · ${cuts.length} cuts · approve each item: ${MAP_ITEMS.join(', ')}</p>
<div class="row"><section class="card"><header><h2>From above</h2><div class="badges">${badge(TITLES.map, st.map)}${badge(TITLES.items, st.items)}</div></header><p class="note">edges: ${esc(tally)} · everything off the floor is backdrop</p>${piecePlan(fm, cams, cuts)}${KEY}</section></div>
<div class="row"><section class="card"><header><h2>Shots</h2>${badge(TITLES.cameras, st.cameras)}</header><p class="note">the greybox through each camera; its zone tinted; a figure (${FIGURE} m) at the zone's middle · under each, the brief a painter gets with its guide</p><div class="row r3">${shots}</div></section></div>
<div class="row"><section class="card"><header><h2>Laws</h2></header><p class="note">measured and advised, never refused</p>${pieceLaws(adv)}</section></div>
</div></body></html>`;
}

export async function floormapBoardPng(manifest) {
  const { renderPageToPng } = await import('../scene/scene-png.js');
  return renderPageToPng(floormapBoardHtml(manifest), { width: 1240, height: 1000, selector: '#board' });
}

