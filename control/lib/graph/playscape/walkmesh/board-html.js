/**
 * THE WALKMESH BOARD — a walkmesh drawn for approval before it is built, as one HTML page from tracked PIECES (the UI
 * board's chrome, ui/board-html.js, and the art board's before it). Each piece is a pure function with a stable id:
 *
 *   walk:plate:<id>    the plate with what is played over it: the floor seen (cyan) and hidden (magenta), the occluders
 *                      and their base lines, the exits, the spawns, the horizon
 *   walk:ground:<id>   the scale ladder: the figure standing at five depths across the floor, so the camera fit is
 *                      judged by eye (a believable person at the front and at the back)
 *   walk:plan:<id>     the floor lifted into metres, from above: the camera and its view, occluders, exits, spawns
 *   walk:cuts          the cut graph: plates and the exits between them
 *   walk:laws          the advice
 *
 *   walkBoardHtml(wm, { images })   the board for a read walkmesh; `images` maps a plate id to an image href (a baked
 *                                   plate's render, or a painted plate's image inlined)
 *   walkPieceIds(wm)
 *   bakePlateHtml(plate)            the World page that renders a baked plate from its camera (scene-three.js)
 *   bakePlatePng(plate)             that page rendered (scene-png.js renderWorldToPng)
 *   walkBoardPagePng(wm, opts)      the board rendered (scene-png.js renderPageToPng)
 */
import { lift, figureSpan } from './camera.js';
import { scanline, bounds } from './geom.js';
import { plateMask } from './mask.js';
import { walkable } from './bake.js';
import { walkAdvice, WALK_LAWS } from './laws.js';
import { WALK_ITEMS, cutsOf } from './walkmesh.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;
const pts = (poly) => poly.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
const STATUS = { proposed: '#e8b04a', approved: '#6cc070', auto: '#8a93a6' };
const TITLES = { plates: 'Plates', ground: 'Ground', floor: 'Floor', occluders: 'Occluders', exits: 'Exits', cuts: 'Cuts' };
const SEEN = '#4ec3d6', HIDDEN = '#d65cc0', OCC = '#e8b04a', EXIT = '#ffffff';

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#14161a;color:#e9e4da;font:13px/1.35 Helvetica,Arial,sans-serif}
#board{width:1200px;padding:18px 20px 20px}
h1{font-size:22px;margin:0;letter-spacing:.02em}
.lede{color:#9a958c;font-size:12px;margin:3px 0 12px}
.row{display:grid;gap:10px;margin-bottom:10px}.r2{grid-template-columns:1fr 1fr}
.card{background:#1e2026;border-radius:6px;padding:12px 14px;min-width:0}
.card header{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.card h2{font-size:15px;margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.card h3{font-size:12px;margin:10px 0 4px;color:#9a958c;font-weight:400;text-transform:uppercase;letter-spacing:.04em}
.badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{border:1.5px solid;border-radius:10px;padding:1px 10px;font-size:11px;font-weight:700;text-transform:uppercase;white-space:nowrap}
.note{color:#9a958c;font-size:12px;margin:2px 0 8px}
.key{display:flex;gap:14px;color:#9a958c;font-size:11px;margin:6px 0 0}.key i{display:inline-block;width:12px;height:10px;margin-right:5px;vertical-align:-1px}
table{border-collapse:collapse;font-size:12px}td{padding:2px 10px 2px 0;vertical-align:top}td.k{color:#9a958c;white-space:nowrap}
ul.adv{margin:6px 0 0;padding-left:16px;color:#e8b04a;font-size:12px}ul.adv b{color:#e9e4da;font-weight:400}
p.ok{color:#6cc070;font-size:12px;margin:6px 0 0}
svg{display:block;width:100%;height:auto;background:#0d0e11;border-radius:3px}
[data-piece]{display:contents}
`;

const piece = (id, html) => `<div data-piece="${esc(id)}">${html}</div>`;
const badge = (label, status) => { const c = STATUS[status] || '#9a958c'; return `<span class="badge" style="color:${c};border-color:${c}">${esc(label)} · ${esc(status)}</span>`; };

// the figure: a plain person silhouette, feet at (x, y), s px tall
function figure([x, y], s, opacity = 0.92) {
  const r = s * 0.075, w = s * 0.13;
  return `<g fill="#f4efe6" stroke="#0d0e11" stroke-width="${r1(Math.max(0.6, s * 0.012))}" opacity="${opacity}">`
    + `<path d="M${r1(x - w * 0.55)} ${r1(y)} L${r1(x - w * 0.35)} ${r1(y - s * 0.47)} L${r1(x - w)} ${r1(y - s * 0.5)} L${r1(x - w * 0.8)} ${r1(y - s * 0.8)} L${r1(x + w * 0.8)} ${r1(y - s * 0.8)} L${r1(x + w)} ${r1(y - s * 0.5)} L${r1(x + w * 0.35)} ${r1(y - s * 0.47)} L${r1(x + w * 0.55)} ${r1(y)} Z"/>`
    + `<circle cx="${r1(x)}" cy="${r1(y - s + r)}" r="${r1(r)}"/></g>`;
}

function maskSvg(plate, mask) {
  const [W, H] = plate.size, sx = W / mask.w, sy = H / mask.h;
  let out = '';
  for (let j = 0; j < mask.h; j++) for (let i = 0; i < mask.w;) {
    const v = mask.cells[j * mask.w + i];
    if (!v) { i++; continue; }
    const s = i; while (i < mask.w && mask.cells[j * mask.w + i] === v) i++;
    out += `<rect x="${r1(s * sx)}" y="${r1(j * sy)}" width="${r1((i - s) * sx)}" height="${r1(sy + 1)}" fill="${v === 2 ? HIDDEN : SEEN}" fill-opacity="${v === 2 ? 0.5 : 0.26}"/>`;
  }
  return out;
}

const imageOf = (plate, images) => images[plate.id] || (plate.source === 'painted' ? plate.image : null);
function plateImage(plate, images, opacity = 1) {
  const [W, H] = plate.size, href = imageOf(plate, images);
  return href ? `<image href="${esc(href)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" opacity="${opacity}"/>`
    : `<rect width="${W}" height="${H}" fill="#2b2d33"/><text x="${W / 2}" y="${H / 2}" fill="#9a958c" font-size="${H / 18}" text-anchor="middle">${plate.source === 'baked' ? 'the bake is not rendered (bakePlatePng)' : 'no image'}</text>`;
}
const label = (x, y, text, size, anchor = 'start', fill = '#fff') => `<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(size)}" fill="${fill}" text-anchor="${anchor}" paint-order="stroke" stroke="#000" stroke-width="${r1(size / 5)}" font-family="Helvetica,Arial,sans-serif">${esc(text)}</text>`;

/** walk:plate:<id> — the plate and what is played over it. */
export function piecePlate(plate, images = {}, mask = plateMask(plate)) {
  const [W, H] = plate.size, u = H / 100;
  const horizon = plate.horizon !== null && plate.horizon > 0 && plate.horizon < H
    ? `<line x1="0" x2="${W}" y1="${r1(plate.horizon)}" y2="${r1(plate.horizon)}" stroke="#fff" stroke-opacity=".7" stroke-dasharray="${r1(u * 2)} ${r1(u * 1.4)}" stroke-width="${r1(u * 0.3)}"/>${label(u, plate.horizon - u, 'horizon', u * 2.6)}` : '';
  const floor = plate.source === 'painted' ? plate.floor.map((f) => `<polygon points="${pts(f.px)}" fill="none" stroke="${SEEN}" stroke-width="${r1(u * 0.35)}"/>`).join('') : '';
  const occ = plate.occluders.map((o) => {
    const xs = o.px.map((q) => q[0]);
    return `<polygon points="${pts(o.px)}" fill="none" stroke="${OCC}" stroke-width="${r1(u * 0.35)}" stroke-dasharray="${r1(u)} ${r1(u * 0.6)}"/><line x1="${r1(Math.min(...xs))}" x2="${r1(Math.max(...xs))}" y1="${r1(o.base)}" y2="${r1(o.base)}" stroke="${OCC}" stroke-width="${r1(u * 0.8)}"/>${label(Math.max(...xs) + u, o.base - u * 0.5, o.id, u * 2.4, 'start', OCC)}`;
  }).join('');
  const exits = plate.exits.filter((e) => e.px.every(Boolean)).map((e) => {
    const [a, b] = e.px, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const to = e.to.plate ? `→ ${e.to.plate}.${e.to.exit}` : `→ map ${e.to.map}${e.to.door ? `.${e.to.door}` : ''}`;
    const tx = Math.min(W - u, Math.max(u, mx)), anchor = mx < W * 0.2 ? 'start' : mx > W * 0.8 ? 'end' : 'middle';
    return `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" stroke="${EXIT}" stroke-width="${r1(u * 1.1)}" stroke-linecap="round"/>${label(tx, my - u * 1.6, `${e.id} ${to}`, u * 2.6, anchor)}`;
  }).join('');
  const spawns = plate.spawns.filter((s) => s.px).map((s) => {
    const span = s.m ? (figureSpan(plate.basis, s.m, plate.figure) || {}).span : null;
    return `${span ? figure(s.px, span, 0.95) : ''}<circle cx="${r1(s.px[0])}" cy="${r1(s.px[1])}" r="${r1(u * 0.9)}" fill="${EXIT}" stroke="#000" stroke-width="${r1(u * 0.25)}"/>${label(s.px[0] + u * 1.6, s.px[1] + u * 3.2, `${s.id}`, u * 2.4)}`;
  }).join('');
  return piece(`walk:plate:${plate.id}`, `<svg viewBox="0 0 ${W} ${H}">${plateImage(plate, images)}${maskSvg(plate, mask)}${floor}${horizon}${occ}${exits}${spawns}</svg>`);
}

/** The floor's scale ladder: five rows across the floor's height in the plate (even in screen y, so even in 1/depth). */
export function ladderOf(plate, n = 5) {
  const polys = plate.floor.map((f) => f.px).filter(Boolean);
  if (!polys.length) return [];
  const [W, H] = plate.size, [, y0, , y1] = bounds(polys.flat()), top = Math.max(y0, 0, (plate.horizon ?? -Infinity) + 1), bottom = Math.min(y1, H);
  const out = [];
  for (let k = 0; k < n; k++) {
    const y = top + ((bottom - top) * (k + 0.5)) / n, runs = scanline(polys, y).map(([a, b]) => [Math.max(a, 0), Math.min(b, W)]).filter(([a, b]) => b > a);
    if (!runs.length) continue;
    const run = runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a)), x = run[0] + (run[1] - run[0]) * (0.3 + 0.1 * k);
    const m = lift(plate.basis, [x, y]);
    if (m && plate.source === 'baked' && !walkable(plate.bake, m)) continue;
    const f = m && figureSpan(plate.basis, m, plate.figure);
    if (f) out.push({ px: [x, y], m, span: f.span, depth: f.depth });
  }
  return out;
}

/** walk:ground:<id> — the scale ladder over the dimmed plate, and the fit in numbers. */
export function pieceGround(plate, images = {}) {
  const [W, H] = plate.size, u = H / 100, rungs = ladderOf(plate);
  const horizon = plate.horizon !== null && plate.horizon > 0 && plate.horizon < H ? `<line x1="0" x2="${W}" y1="${r1(plate.horizon)}" y2="${r1(plate.horizon)}" stroke="#fff" stroke-opacity=".8" stroke-dasharray="${r1(u * 2)} ${r1(u * 1.4)}" stroke-width="${r1(u * 0.3)}"/>` : '';
  const figs = rungs.map((r) => `${figure(r.px, r.span)}${label(r.px[0] + r.span * 0.16 + u, r.px[1] - r.span * 0.5, `${r.depth.toFixed(1)} m`, Math.max(u * 2.4, 1))}`).join('');
  const P = plate.basis.position, fit = plate.source === 'painted'
    ? `<tr><td class="k">eye</td><td>${plate.ground.height} m over the floor</td></tr><tr><td class="k">fov</td><td>${plate.ground.fov}° across</td></tr><tr><td class="k">horizon</td><td>y ${Math.round(plate.ground.horizon)} of ${H}</td></tr>`
    : `<tr><td class="k">camera</td><td>at ${P.map((v) => v.toFixed(1)).join(', ')} m, ${plate.framing.horizontalFov}° across (read off the world)</td></tr>`;
  return piece(`walk:ground:${plate.id}`, `<svg viewBox="0 0 ${W} ${H}">${plateImage(plate, images, 0.45)}${horizon}${figs}</svg><table>${fit}<tr><td class="k">figure</td><td>${plate.figure} m${rungs.length ? `, ${Math.round(rungs[rungs.length - 1].span)} px at the front to ${Math.round(rungs[0].span)} px at the back` : ''}</td></tr></table>`);
}

/** walk:plan:<id> — the floor in metres from above (north up), with the camera, its view, and what stands on the floor. */
export function piecePlan(plate) {
  const floors = plate.floor.map((f) => f.m).filter((m) => m && m.every(Boolean));
  const P = plate.basis.position, F = plate.basis.forward, all = [...floors.flat(), P];
  for (const e of plate.exits) for (const q of e.m) if (q) all.push(q);
  let [x0, y0, x1, y1] = bounds(all.map((q) => [q[0], q[1]]));
  const pad = Math.max(1, (x1 - x0 + y1 - y0) * 0.06); x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const VW = 560, s = VW / (x1 - x0), VH = Math.min(520, Math.max(160, (y1 - y0) * s)), sy = VH / (y1 - y0), k = Math.min(s, sy);
  const X = (x) => (x - x0) * k, Y = (y) => VH - (y - y0) * k, at = (q) => `${r1(X(q[0]))},${r1(Y(q[1]))}`;
  const span = Math.max(x1 - x0, y1 - y0), step = [1, 2, 5, 10, 20, 50].find((g) => span / g <= 24) || 100;
  let grid = '';
  for (let g = Math.ceil(x0 / step) * step; g <= x1; g += step) grid += `<line x1="${r1(X(g))}" x2="${r1(X(g))}" y1="0" y2="${r1(VH)}" stroke="#2b2d33"/>`;
  for (let g = Math.ceil(y0 / step) * step; g <= y1; g += step) grid += `<line y1="${r1(Y(g))}" y2="${r1(Y(g))}" x1="0" x2="${VW}" stroke="#2b2d33"/>`;
  const walls = plate.source === 'baked' ? ((plate.payload && plate.payload.colliders) || []).map((c) => `<rect x="${r1(X(c.min[0]))}" y="${r1(Y(c.max[1]))}" width="${r1((c.max[0] - c.min[0]) * k)}" height="${r1((c.max[1] - c.min[1]) * k)}" fill="#45484f"/>`).join('') : '';
  const floor = floors.map((m) => `<polygon points="${m.map(at).join(' ')}" fill="${SEEN}" fill-opacity=".22" stroke="${SEEN}" stroke-opacity="${plate.source === 'baked' ? 0 : 1}" stroke-width="1.2"/>`).join('');
  // the view: the two edge rays of the frame, out to the floor's far side
  const fl = Math.hypot(F[0], F[1]) || 1, half = (plate.framing.horizontalFov * Math.PI) / 360, far = Math.hypot(x1 - x0, y1 - y0);
  const ray = (a) => { const c = Math.cos(a), sn = Math.sin(a), dx = (F[0] * c - F[1] * sn) / fl, dy = (F[0] * sn + F[1] * c) / fl; return [P[0] + dx * far, P[1] + dy * far]; };
  const view = `<polygon points="${at(P)} ${at(ray(half))} ${at(ray(-half))}" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".35" stroke-dasharray="4 3"/><circle cx="${r1(X(P[0]))}" cy="${r1(Y(P[1]))}" r="4" fill="#fff"/>${label(X(P[0]) + 7, Y(P[1]) + 4, 'eye', 11)}`;
  const occ = plate.occluders.map((o) => {
    const xs = o.px.map((q) => q[0]), a = lift(plate.basis, [Math.min(...xs), o.base]), b = lift(plate.basis, [Math.max(...xs), o.base]);
    return a && b ? `<line x1="${r1(X(a[0]))}" y1="${r1(Y(a[1]))}" x2="${r1(X(b[0]))}" y2="${r1(Y(b[1]))}" stroke="${OCC}" stroke-width="3"/>${label(X(b[0]) + 4, Y(b[1]) + 4, o.id, 10, 'start', OCC)}` : '';
  }).join('');
  const exits = plate.exits.filter((e) => e.m.every(Boolean)).map((e) => `<line x1="${r1(X(e.m[0][0]))}" y1="${r1(Y(e.m[0][1]))}" x2="${r1(X(e.m[1][0]))}" y2="${r1(Y(e.m[1][1]))}" stroke="${EXIT}" stroke-width="3" stroke-linecap="round"/>${label((X(e.m[0][0]) + X(e.m[1][0])) / 2, (Y(e.m[0][1]) + Y(e.m[1][1])) / 2 - 6, e.id, 11, 'middle')}`).join('');
  const spawns = plate.spawns.filter((x) => x.m).map((x) => `<circle cx="${r1(X(x.m[0]))}" cy="${r1(Y(x.m[1]))}" r="4" fill="${EXIT}" stroke="#000"/>${label(X(x.m[0]) + 6, Y(x.m[1]) + 4, x.id, 11)}`).join('');
  const bar = `<line x1="10" x2="${r1(10 + step * k)}" y1="${r1(VH - 10)}" y2="${r1(VH - 10)}" stroke="#fff" stroke-width="2"/>${label(10, VH - 15, `${step} m`, 10)}`;
  return piece(`walk:plan:${plate.id}`, `<svg viewBox="0 0 ${VW} ${r1(VH)}">${grid}${walls}${floor}${view}${occ}${exits}${spawns}${bar}</svg>`);
}

/** walk:cuts — the plates and the exits between them, each pair of exits that lead to each other drawn once. */
export function pieceCuts(wm, images = {}) {
  const n = wm.plates.length, TW = 240, gap = 90, VW = n * TW + (n - 1) * gap + 40;
  const th = (p) => (TW * p.size[1]) / p.size[0], TH = Math.max(...wm.plates.map(th)), VH = TH + 120;
  const x = (i) => 20 + i * (TW + gap), idx = new Map(wm.plates.map((p, i) => [p.id, i]));
  const nodes = wm.plates.map((p, i) => {
    const href = imageOf(p, images), h = th(p), y = 30 + (TH - h) / 2;
    return `${href ? `<image href="${esc(href)}" x="${x(i)}" y="${r1(y)}" width="${TW}" height="${r1(h)}" preserveAspectRatio="none"/>` : `<rect x="${x(i)}" y="${r1(y)}" width="${TW}" height="${r1(h)}" fill="#2b2d33"/>`}<rect x="${x(i)}" y="${r1(y)}" width="${TW}" height="${r1(h)}" fill="none" stroke="${wm.start.startsWith(`${p.id}.`) ? '#6cc070' : '#45484f'}" stroke-width="2"/>${label(x(i), 20, `${p.id} · ${p.source}`, 12)}`;
  }).join('');
  const done = new Set(), cy = 30 + TH / 2;
  const edges = cutsOf(wm).map((c) => {
    if (done.has(c.from)) return '';
    const [fp, fe] = c.from.split('.'), a = idx.get(fp);
    if (typeof c.to !== 'string') return `<line x1="${x(a) + TW / 2}" y1="${r1(30 + TH)}" x2="${x(a) + TW / 2}" y2="${r1(30 + TH + 40)}" stroke="#fff" stroke-dasharray="4 3"/>${label(x(a) + TW / 2, 30 + TH + 56, `${fe} → map ${c.to.map}`, 11, 'middle')}`;
    done.add(c.from); done.add(c.to);
    const [tp, te] = c.to.split('.'), b = idx.get(tp);
    if (b === undefined) return label(x(a) + TW / 2, 30 + TH + 56, `${fe} → ${c.to} (no such plate)`, 11, 'middle', OCC);
    if (b === a) return label(x(a) + TW / 2, 30 + TH + 56, `${fe} ↔ ${te}`, 11, 'middle');
    const [l, r] = a < b ? [a, b] : [b, a], [ln, rn] = a < b ? [fe, te] : [te, fe];
    const back = wm.plates[b].exits.find((e) => e.id === te), two = back && back.to.plate === fp && back.to.exit === fe;
    return `<line x1="${x(l) + TW}" y1="${r1(cy)}" x2="${x(r)}" y2="${r1(cy)}" stroke="#fff" stroke-width="2" ${two ? '' : 'stroke-dasharray="5 4"'}/>${label(x(l) + TW + 4, cy - 8, ln, 11)}${label(x(r) - 4, cy + 18, rn, 11, 'end')}`;
  }).join('');
  return piece('walk:cuts', `<svg viewBox="0 0 ${VW} ${r1(VH)}">${nodes}${edges}</svg>`);
}

/** walk:laws — the advice, grouped by law. */
export function pieceLaws(wm) {
  const adv = walkAdvice(wm), by = {};
  for (const a of adv) (by[a.law] = by[a.law] || []).push(a);
  return piece('walk:laws', adv.length
    ? `<ul class="adv">${Object.entries(by).map(([law, list]) => `<li><b>${esc(law)}</b>: ${list.map((a) => `${esc(a.at)}: ${esc(a.advice)}`).join('; ')}</li>`).join('')}</ul>`
    : `<p class="ok">every law holds (${Object.keys(WALK_LAWS).length} checked)</p>`);
}

export const walkPieceIds = (wm) => [...wm.plates.flatMap((p) => [`walk:plate:${p.id}`, `walk:ground:${p.id}`, `walk:plan:${p.id}`]), 'walk:cuts', 'walk:laws'];

const KEY = `<div class="key"><span><i style="background:${SEEN};opacity:.6"></i>floor, seen</span><span><i style="background:${HIDDEN};opacity:.8"></i>floor, hidden (the figure's feet go behind)</span><span><i style="background:${OCC}"></i>occluder and its base line</span><span><i style="background:${EXIT}"></i>exit, spawn</span></div>`;

/** The board for a read walkmesh, as one self-contained HTML document. */
export function walkBoardHtml(wm, { images = {} } = {}) {
  const st = wm.status;
  const plates = wm.plates.map((p) => {
    const derived = p.source === 'baked' ? ' (read off the world)' : '';
    return `<section class="card" data-plate="${esc(p.id)}"><header><h2>${esc(p.id)} · ${p.source}</h2><div class="badges">${['plates', 'floor', 'occluders', 'exits'].map((k) => badge(TITLES[k], st[k])).join('')}</div></header>
<p class="note">${p.size[0]}×${p.size[1]} · ${p.floor.length} floor ${p.source === 'baked' ? 'rectangles' : `polygon${p.floor.length === 1 ? '' : 's'}`}${derived} · ${p.source === 'baked' ? 'occluders: the world itself' : `${p.occluders.length} occluder${p.occluders.length === 1 ? '' : 's'}`} · ${p.exits.length} exit${p.exits.length === 1 ? '' : 's'} · ${p.spawns.length} spawn${p.spawns.length === 1 ? '' : 's'}</p>
${piecePlate(p, images)}${KEY}
<div class="row r2" style="margin-top:10px"><div><header><h3>Ground ${badge(TITLES.ground, st.ground)}</h3></header>${pieceGround(p, images)}</div><div><h3>From above</h3>${piecePlan(p)}</div></div></section>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>${esc(`Walkmesh · ${wm.title}`)}</title><style>${CSS}</style></head><body><div id="board">
<h1>${esc(`WALKMESH · ${wm.title}`.toUpperCase())}</h1>
<p class="lede">start ${esc(wm.start)} · approve each item: ${WALK_ITEMS.map((k) => TITLES[k].toLowerCase()).join(', ')}</p>
<div class="row">${plates}</div>
<div class="row r2"><section class="card"><header><h2>Cuts</h2>${badge(TITLES.cuts, st.cuts)}</header><p class="note">solid: the two exits lead to each other · dashed: one way · green frame: where it starts</p>${pieceCuts(wm, images)}</section>
<section class="card"><header><h2>Laws</h2></header><p class="note">measured and advised, never refused</p>${pieceLaws(wm)}</section></div>
</div></body></html>`;
}

/** The World page that renders a baked plate from its camera: the world's own payload, one fixed shot, no HUD. */
export async function bakePlateHtml(plate) {
  if (plate.source !== 'baked') throw new Error(`walkmesh: plate '${plate.id}' is painted; only a baked plate renders`);
  const { emitThreeWorld } = await import('../../scene/scene-three.js');
  const [width, height] = plate.size;
  return emitThreeWorld({ ...plate.payload, cameras: [{ name: plate.id, worldFraming: plate.framing }], viewBox: { width, height }, hud: false, walk: false, inline: true });
}

export async function bakePlatePng(plate) {
  const { renderWorldToPng } = await import('../../scene/scene-png.js');
  return renderWorldToPng(await bakePlateHtml(plate), { width: plate.size[0], height: plate.size[1], deviceScaleFactor: 1 });
}

export async function walkBoardPagePng(wm, opts) {
  const { renderPageToPng } = await import('../../scene/scene-png.js');
  return renderPageToPng(walkBoardHtml(wm, opts), { width: 1240, height: 1000, selector: '#board' });
}
