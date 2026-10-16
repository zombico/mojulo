/**
 * roadway-map — the inspectable MAP of a roadway world, served beside it at /world/map.
 *
 * A freeway corridor is kilometres long and ~100 m wide, so a true plan view is a hairline. The map
 * is therefore the highway engineer's STRAIGHT-LINE DIAGRAM: station along the page, lateral offset
 * exaggerated, every band, line, wall, structure and vehicle at its true station and length. Around
 * it, sharing one station axis and one cursor:
 *   - a key map (the true alignment in plan, with the window you are looking at);
 *   - the vertical profile (grades, K-sized curves, each structure's measured clearance);
 *   - the horizontal alignment (curvature by element, superelevation).
 * Click anything for its numbers; every inspected thing links to that spot in the 3D world
 * (`/world?view=s<station>-<lane>`). Wheel zooms, drag pans, double-click resets.
 *
 * `roadwayMapData(plan)` is the pure extraction (tested); `renderRoadwayMap(data, opts)` the page.
 * Deterministic: no clock, no dice, no external requests.
 */

import { roadwayCensus } from './roadway.js';
import { FLEET, PAINTS } from './fleet.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r5 = (v) => Math.round(v * 1e5) / 1e5;

export function roadwayMapData(plan, { title = 'mojulo roadway' } = {}) {
  const { alignment, section } = plan;
  const stations = [];
  for (let s = 0; s <= plan.length + 1e-9; s += 10) {
    const a = alignment.at(s);
    stations.push([r2(a.s), r2(a.x), r2(a.y), r3(a.z), r5(a.grade), r5(a.k), r5(a.e)]);
  }
  let acc = 0;
  const elements = alignment.elements.map((e) => {
    const out = { type: e.type, s0: r2(acc), s1: r2(acc + e.length), length: r2(e.length) };
    if (e.type === 'arc') { out.radius = e.radius; out.dir = e.dir; }
    if (e.type === 'spiral') { out.k0 = r5(e.k0); out.k1 = r5(e.k1); out.A = r2(Math.sqrt(e.length / Math.max(Math.abs(e.k0), Math.abs(e.k1)))); }
    acc += e.length;
    return out;
  });
  const vcurves = alignment.profile.curves.map((c) => ({ s0: r2(c.s0), s1: r2(c.s1), L: r2(c.L), K: c.K, A: r2(c.A), g1: r5(c.g1), g2: r5(c.g2), pvi: { s: c.pvi.s, z: r3(c.pvi.z) }, type: c.A < 0 ? 'crest' : 'sag' }));
  const census = roadwayCensus(plan);
  return {
    title, length: r2(plan.length), width: r2(section.width),
    bands: section.bands.map((b) => ({ kind: b.kind, d0: r3(b.d0), d1: r3(b.d1), w: r3(b.w), roadway: b.roadway || null, lane: b.lane ?? null, wall: b.wall || null, side: b.side || null })),
    opts: { laneW: plan.opts.laneW, express: plan.opts.express, collector: plan.opts.collector, speedKmh: plan.opts.speedKmh, designSpeed: plan.opts.designSpeed, dash: plan.opts.dash, gap: plan.opts.gap, lineW: plan.opts.lineW, edgeW: plan.opts.edgeW, barrier: plan.opts.barrier },
    dashPhase: Object.fromEntries(Object.entries(plan.dashPhase || {}).map(([k, v]) => [k, r3(v)])),
    stations, elements, vcurves,
    structures: plan.structures.map(({ soffits, ...s }) => ({ ...s, clearanceMin: r3(s.clearanceMin), pavementMax: r3(s.pavementMax), ...(s.underside != null ? { underside: r3(s.underside), deckTop: r3(s.deckTop) } : {}), ...(s.signBottom != null ? { signBottom: r3(s.signBottom) } : {}) })),
    lanes: plan.lanes.map(({ centreline, ...l }) => l),
    vehicles: plan.traffic.vehicles.map((v) => ({ lane: v.lane, cls: v.cls, s: r2(v.s), D: v.D, paint: PAINTS[v.paint] })),
    fleet: Object.fromEntries(Object.entries(FLEET).map(([k, f]) => [k, { L: f.L, W: f.W, H: f.H, wb: f.wb, track: f.track, r: f.r }])),
    lights: plan.lights.map(r2),
    context: plan.context.map((c) => ({ D: c.D, s: r2(c.s), d: r2(c.d), len: r2(c.len), dep: r2(c.dep), h: r2(c.h) })),
    cameras: plan.cameras.map((c) => c.name),
    census: { ...census, fleet: { ...census.fleet, dimRatio: Object.fromEntries(Object.entries(census.fleet.dimRatio).map(([k, v]) => [k, { L: r3(v.L), W: r3(v.W), H: r3(v.H) }])) } },
    advisories: plan.advisories,
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The map page. `worldHref` is the sibling 3D world's path (deep links append `?view=`). */
export function renderRoadwayMap(data, { worldHref = '' } = {}) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const c = data.census;
  const ov = data.structures.filter((s) => s.kind === 'overpass');
  const chip = (k, v) => `<div class="chip"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  const chips = [
    chip('Length', `${(data.length / 1000).toFixed(2)} km`),
    chip('Lanes / direction', `${data.opts.express} express + ${data.opts.collector} collector`),
    chip('Lane width', `${c.laneWidth[0].toFixed(2)} m`),
    chip('Paved, wall to wall', `${c.crossSectionPaved[0].toFixed(1)} m`),
    chip('Min radius', `${Math.round(c.radiusMin)} m`),
    chip('Max bank / grade', `${(c.crossSlopeMax * 100).toFixed(1)} % / ${(c.gradeMax * 100).toFixed(1)} %`),
    ...(ov.length ? [chip('Overpass clearance', `${Math.min(...ov.map((s) => s.clearanceMin)).toFixed(2)} m`)] : []),
    chip('Vehicles', `${c.fleet.vehicles} · ${(c.fleet.truckShare * 100).toFixed(0)} % trucks`),
  ].join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(data.title)} · map</title>
<style>
:root { --bg:#f4f3ef; --panel:#ffffff; --ink:#1d2126; --muted:#626a73; --line:#d9d6ce; --accent:#1f6b43; --asph:#80858c; --shld:#a9adb2; --wall:#d6cfbf; --wallE:#8c8676; --verge:#b9c29a; --struct:#3c5a8a; --gantry:#1f6b43; --cursor:#c2410c; }
@media (prefers-color-scheme: dark) { :root { --bg:#15171a; --panel:#1d2024; --ink:#e6e4de; --muted:#9aa1a9; --line:#30343a; --asph:#4c5157; --shld:#62676e; --wall:#8a8373; --wallE:#b9b2a0; --verge:#3d4631; --struct:#7fa2d8; --gantry:#4fb07a; --cursor:#fb923c; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { padding:14px 18px 8px; display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 16px; }
h1 { font-size:17px; margin:0; font-weight:650; }
.sub { color:var(--muted); }
.chips { display:flex; flex-wrap:wrap; gap:6px; padding:0 18px 10px; }
.chip { background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:4px 8px; display:flex; gap:6px; }
.chip span { color:var(--muted); } .chip b { font-weight:600; font-variant-numeric:tabular-nums; }
main { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:12px; padding:0 18px 18px; }
@media (max-width: 900px) { main { grid-template-columns:1fr; } }
.card { background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.card h2 { margin:0; padding:7px 10px; font-size:12px; font-weight:600; color:var(--muted); border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:8px; }
.strips svg { display:block; width:100%; user-select:none; touch-action:none; }
.strips { display:flex; flex-direction:column; gap:10px; }
#readout { font-variant-numeric:tabular-nums; color:var(--ink); font-weight:500; }
aside { display:flex; flex-direction:column; gap:10px; }
#inspect { padding:10px; min-height:120px; }
#inspect table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
#inspect td { padding:2px 0; vertical-align:top; } #inspect td:first-child { color:var(--muted); padding-right:10px; white-space:nowrap; }
#inspect .kind { font-weight:650; font-size:14px; margin-bottom:6px; }
a { color:var(--accent); }
.go { display:inline-block; margin-top:8px; padding:5px 9px; border:1px solid var(--accent); border-radius:5px; text-decoration:none; font-weight:600; }
.legend, .views { padding:8px 10px; display:grid; gap:4px; }
.sw { display:inline-block; width:18px; height:10px; border-radius:2px; vertical-align:middle; margin-right:6px; border:1px solid var(--line); }
.hint { color:var(--muted); font-size:12px; padding:6px 10px 8px; }
.adv { color:#b45309; padding:0 18px 8px; }
svg text { fill:var(--muted); font-size:10.5px; font-family:inherit; }
svg .lbl { fill:var(--ink); font-weight:600; }
.hit { cursor:pointer; } .hit:hover { stroke:var(--cursor); stroke-width:1.5px; }
</style>
</head>
<body>
<header><h1>${esc(data.title)}</h1><span class="sub">Straight-line diagram · stations in metres (1 u = 1 m) · offsets exaggerated</span></header>
<div class="chips">${chips}</div>
${data.advisories.length ? `<div class="adv">${data.advisories.map(esc).join(' · ')}</div>` : ''}
<main>
  <section class="strips">
    <div class="card"><h2><span>Key map · true plan, the window in view highlighted</span><span id="readout"></span></h2><svg id="key" height="120"></svg></div>
    <div class="card"><h2><span>Lanes · eastbound below the median, westbound above</span><span id="zoom"></span></h2><svg id="sld" height="420"></svg></div>
    <div class="card"><h2><span>Profile · pavement grade line and clearance under each structure (vertical ×<span id="vx"></span>)</span></h2><svg id="prof" height="170"></svg></div>
    <div class="card"><h2><span>Alignment · curvature by element, superelevation</span></h2><svg id="alg" height="120"></svg></div>
    <div class="hint">Wheel to zoom about the pointer, drag to pan, double-click to see the whole corridor. Click a lane, wall, structure, vehicle, curve or grade to inspect it.</div>
  </section>
  <aside>
    <div class="card"><h2><span>Inspector</span></h2><div id="inspect"><div class="sub">Nothing selected. Click something on the map.</div></div></div>
    <div class="card"><h2><span>Open the world at a preset</span></h2><div class="views">${data.cameras.map((n) => `<a href="${esc(worldHref)}?view=${encodeURIComponent(n)}" target="_blank" rel="noopener">${esc(n)}</a>`).join('')}</div></div>
    <div class="card"><h2><span>Legend</span></h2><div class="legend">
      <div><span class="sw" style="background:var(--asph)"></span>Lane (3.75 m)</div>
      <div><span class="sw" style="background:var(--shld)"></span>Shoulder</div>
      <div><span class="sw" style="background:var(--wall);border-color:var(--wallE)"></span>Tall Wall barrier</div>
      <div><span class="sw" style="background:var(--struct);opacity:.35"></span>Overpass deck</div>
      <div><span class="sw" style="background:var(--gantry)"></span>Sign gantry</div>
      <div><span class="sw" style="background:#dcb431"></span>Yellow left edge · white lines 3 m / 6 m</div>
    </div></div>
  </aside>
</main>
<script>
const DATA = ${json};
const WORLD = ${JSON.stringify(worldHref)};
const L = DATA.length, NS = 'http://www.w3.org/2000/svg';
let v0 = 0, v1 = L, sel = null, hover = null, dragged = false;
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 2) => Number(v).toFixed(d);
const pct = (v, d = 2) => (v * 100).toFixed(d) + ' %';
const laneBand = (rw, i) => DATA.bands.filter((b) => b.kind === 'lane' && b.roadway === rw)[i];
const st = (s) => { const i = Math.max(0, Math.min(DATA.stations.length - 2, Math.floor(s / 10))), a = DATA.stations[i], b = DATA.stations[i + 1], t = Math.max(0, Math.min(1, (s - a[0]) / ((b[0] - a[0]) || 1))); return a.map((v, k) => v + (b[k] - v) * t); };
const elementAt = (s) => DATA.elements.find((e) => s >= e.s0 && s <= e.s1) || DATA.elements[DATA.elements.length - 1];
const deep = (s, lane) => WORLD + '?view=s' + Math.round(Math.max(0, Math.min(L, s))) + (lane ? '-' + lane.replace(/:/g, '-') : '');
function el(tag, attrs, parent, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function size(svg) { const r = svg.getBoundingClientRect(); return [Math.max(200, r.width), +svg.getAttribute('height')]; }
const PADL = 96, PADR = 12;
const X = (s, W) => PADL + (s - v0) / (v1 - v0) * (W - PADL - PADR);
const S = (x, W) => v0 + (x - PADL) / (W - PADL - PADR) * (v1 - v0);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const rgb = (c) => 'rgb(' + c.map((v) => Math.round(v * 255)).join(',') + ')';

function axis(svg, W, H, y) {
  const span = v1 - v0, steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const step = steps.find((k) => span / k <= 12) || 1000;
  for (let s = Math.ceil(v0 / step) * step; s <= v1; s += step) {
    const x = X(s, W);
    el('line', { x1: x, x2: x, y1: 0, y2: y, stroke: css('--line'), 'stroke-width': 1 }, svg);
    el('text', { x: x + 3, y: y + 12 }, svg, s >= 1000 ? (s / 1000).toFixed(step < 1000 ? (step < 100 ? 2 : 1) : 0) + ' km' : s + ' m');
  }
}
function gutter(svg, H) { el('rect', { x: 0, y: 0, width: PADL - 4, height: H, fill: css('--panel') }, svg); }
function cursor(svg, W, H) { if (hover == null) return; const x = X(hover, W); if (x < PADL) return; el('line', { x1: x, x2: x, y1: 0, y2: H, stroke: css('--cursor'), 'stroke-width': 1, 'stroke-dasharray': '4 3' }, svg); }
function hit(node, info) { node.classList.add('hit'); node.addEventListener('click', (ev) => { ev.stopPropagation(); if (dragged) { dragged = false; return; } sel = info; inspect(); draw(); }); return node; }

// ── key map: the true plan, fitted; the window in view drawn heavy ──
function drawKey() {
  const svg = $('key'); svg.innerHTML = ''; const [W, H] = size(svg);
  const xs = DATA.stations.map((p) => p[1]), ys = DATA.stations.map((p) => p[2]);
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
  const k = Math.min((W - 40) / (mxx - mnx || 1), (H - 30) / (mxy - mny || 1));
  const px = (x) => 20 + (x - mnx) * k, py = (y) => H - 15 - (y - mny) * k;
  const path = (a, b) => DATA.stations.filter((p) => p[0] >= a && p[0] <= b).map((p, i) => (i ? 'L' : 'M') + px(p[1]).toFixed(1) + ' ' + py(p[2]).toFixed(1)).join('');
  el('path', { d: path(0, L), fill: 'none', stroke: css('--shld'), 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
  el('path', { d: path(v0 - 10, v1 + 10), fill: 'none', stroke: css('--cursor'), 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.85 }, svg);
  for (const s of DATA.structures) { const p = st(s.s); el('circle', { cx: px(p[1]), cy: py(p[2]), r: 4, fill: s.kind === 'overpass' ? css('--struct') : css('--gantry') }, svg); }
  const a = st(0), b = st(L);
  el('text', { x: px(a[1]), y: py(a[2]) - 8 }, svg, 'Stn 0');
  el('text', { x: px(b[1]) - 40, y: py(b[2]) - 8 }, svg, 'Stn ' + (L / 1000).toFixed(1) + ' km');
  el('text', { x: W - 70, y: 14 }, svg, 'eastbound →');
}

// ── the straight-line diagram ──
function drawSld() {
  const svg = $('sld'); svg.innerHTML = ''; const [W, H] = size(svg);
  const sx = (W - PADL - PADR) / (v1 - v0), cy = (H - 22) / 2, ky = (cy - 14) / (DATA.width + 6);
  const Y = (D, d) => cy + (D === 1 ? d : -d) * ky;
  $('zoom').textContent = fmt(sx, sx < 1 ? 2 : 1) + ' px/m · ' + Math.round(v0) + '–' + Math.round(v1) + ' m';
  // verge beyond the paved edge
  for (const D of [1, -1]) { const ya = Y(D, DATA.width), yb = Y(D, DATA.width + 6); el('rect', { x: PADL, y: Math.min(ya, yb), width: W - PADL - PADR, height: Math.abs(yb - ya), fill: css('--verge') }, svg); }
  const xa = Math.max(PADL, X(0, W)), xb = Math.min(W - PADR, X(L, W));
  for (const D of [1, -1]) for (const b of DATA.bands) {
    const ya = Y(D, b.d0), yb = Y(D, b.d1), y = Math.min(ya, yb), h = Math.max(0.5, Math.abs(yb - ya));
    const fill = b.kind === 'lane' ? css('--asph') : b.kind === 'shoulder' ? css('--shld') : css('--wall');
    const r = el('rect', { x: xa, y, width: Math.max(0, xb - xa), height: h, fill, stroke: b.kind === 'barrier' ? css('--wallE') : 'none', 'stroke-width': 0.6 }, svg);
    if (b.kind === 'lane') {
      const id = (D === 1 ? 'eb' : 'wb') + ':' + b.roadway + ':' + b.lane;
      hit(r, { type: 'lane', id, D });
    } else if (b.kind === 'barrier') hit(r, { type: 'wall', band: b, D });
    else hit(r, { type: 'shoulder', band: b, D });
  }
  // lines: yellow left edge, white lane lines (3 m / 6 m at true phase when legible), white right edge
  for (const D of [1, -1]) for (const rw of ['express', 'collector']) {
    const ls = DATA.bands.filter((b) => b.kind === 'lane' && b.roadway === rw); if (!ls.length) continue;
    const line = (d, color, w, dashed) => {
      const y = Y(D, d), attrs = { x1: xa, x2: xb, y1: y, y2: y, stroke: color, 'stroke-width': Math.max(1, w * ky) };
      if (dashed) {
        const cyc = (DATA.opts.dash + DATA.opts.gap) * sx;
        if (cyc >= 5) { attrs['stroke-dasharray'] = (DATA.opts.dash * sx) + ' ' + (DATA.opts.gap * sx); attrs['stroke-dashoffset'] = -(((DATA.dashPhase[D + ':' + rw] || 0) - v0) * sx) - (xa - X(v0, W)); }
        else attrs.opacity = 0.55;
      }
      el('line', attrs, svg);
    };
    line(ls[0].d0, '#dcb431', DATA.opts.edgeW, false);
    for (const b of ls.slice(1)) line(b.d0, '#f2f1ec', DATA.opts.lineW, true);
    line(ls[ls.length - 1].d1, '#f2f1ec', DATA.opts.edgeW, false);
  }
  // median luminaires
  if (sx > 0.25) for (const s of DATA.lights) { if (s < v0 || s > v1) continue; el('circle', { cx: X(s, W), cy, r: 2.2, fill: css('--ink'), opacity: 0.55 }, svg); }
  // vehicles at true length and width
  for (const v of DATA.vehicles) {
    const f = DATA.fleet[v.cls]; if (v.s + f.L < v0 || v.s - f.L > v1) continue;
    const [dir, rw, i] = v.lane.split(':'), b = laneBand(rw, +i), D = dir === 'eb' ? 1 : -1, dc = (b.d0 + b.d1) / 2;
    const x0 = X(v.s - f.L / 2, W), w = Math.max(1.5, f.L * sx), ya = Y(D, dc - f.W / 2), yb = Y(D, dc + f.W / 2);
    const r = el('rect', { x: x0, y: Math.min(ya, yb), width: w, height: Math.max(1.5, Math.abs(yb - ya)), fill: rgb(v.paint), stroke: 'rgba(0,0,0,.55)', 'stroke-width': 0.6, rx: Math.min(2, w / 6) }, svg);
    hit(r, { type: 'vehicle', v });
    if (w > 14) { const xf = D === 1 ? x0 + w - 2 : x0 + 2; el('line', { x1: xf, x2: xf, y1: Math.min(ya, yb) + 1, y2: Math.max(ya, yb) - 1, stroke: '#e9edf0', 'stroke-width': 1.2 }, svg); }
  }
  // structures
  for (const s of DATA.structures) {
    if (s.footprint.s1 < v0 || s.footprint.s0 > v1) continue;
    const x0 = X(s.footprint.s0, W), w = Math.max(3, (s.footprint.s1 - s.footprint.s0) * sx);
    if (s.kind === 'overpass') {
      const r = el('rect', { x: x0, y: 4, width: w, height: H - 30, fill: css('--struct'), opacity: 0.28, stroke: css('--struct'), 'stroke-width': 1.2 }, svg);
      hit(r, { type: 'structure', s });
      el('text', { x: x0 + w + 4, y: 14, class: 'lbl' }, svg, 'Overpass · ' + fmt(s.clearanceMin) + ' m');
    } else {
      const ya = Y(s.D, 0), yb = Y(s.D, DATA.width + 1.2);
      const r = el('rect', { x: x0, y: Math.min(ya, yb), width: w, height: Math.abs(yb - ya), fill: css('--gantry'), opacity: 0.8 }, svg);
      hit(r, { type: 'structure', s });
      el('text', { x: x0 + w + 4, y: s.D === 1 ? H - 26 : 14, class: 'lbl' }, svg, 'Gantry · ' + fmt(s.clearanceMin) + ' m');
    }
  }
  // labels at the left gutter
  el('rect', { x: 0, y: 0, width: PADL - 4, height: H, fill: css('--panel') }, svg);
  for (const D of [1, -1]) for (const b of DATA.bands.filter((q) => q.kind === 'lane')) {
    const y = (Y(D, b.d0) + Y(D, b.d1)) / 2 + 3.5;
    el('text', { x: 6, y }, svg, (D === 1 ? 'EB ' : 'WB ') + (b.roadway === 'express' ? 'exp ' : 'col ') + (b.lane + 1));
  }
  el('text', { x: 6, y: cy + 3.5, class: 'lbl' }, svg, 'median');
  el('text', { x: W - 90, y: Y(1, DATA.width) + 16, class: 'lbl' }, svg, 'eastbound →');
  el('text', { x: W - 90, y: Y(-1, DATA.width) - 8, class: 'lbl' }, svg, '← westbound');
  axis(svg, W, H, H - 20); cursor(svg, W, H);
  if (sel && sel.type === 'vehicle') {
    const v = sel.v, f = DATA.fleet[v.cls], [dir, rw, i] = v.lane.split(':'), b = laneBand(rw, +i), D = dir === 'eb' ? 1 : -1, dc = (b.d0 + b.d1) / 2;
    const ya = Y(D, dc - f.W / 2 - 0.4), yb = Y(D, dc + f.W / 2 + 0.4), x0 = X(v.s - f.L / 2, W) - 3;
    if (x0 > PADL) el('rect', { x: x0, y: Math.min(ya, yb), width: Math.max(6, f.L * sx) + 6, height: Math.abs(yb - ya), fill: 'none', stroke: css('--cursor'), 'stroke-width': 2, rx: 3 }, svg);
  }
  if (sel && sel.type === 'lane') for (const D of [sel.D]) { const [, rw, i] = sel.id.split(':'), b = laneBand(rw, +i); el('rect', { x: xa, y: Math.min(Y(D, b.d0), Y(D, b.d1)), width: xb - xa, height: Math.abs(Y(D, b.d1) - Y(D, b.d0)), fill: 'none', stroke: css('--cursor'), 'stroke-width': 1.5 }, svg); }
}

// ── the profile: pavement grade line, vertical curves, clearance under structures ──
function drawProf() {
  const svg = $('prof'); svg.innerHTML = ''; const [W, H] = size(svg);
  const pts = DATA.stations.filter((p) => p[0] >= v0 - 10 && p[0] <= v1 + 10);
  const tops = DATA.structures.filter((s) => s.s >= v0 - 60 && s.s <= v1 + 60).map((s) => s.deckTop ?? (s.signBottom + 3.6));
  const zs = [...pts.map((p) => p[3]), ...tops, ...pts.map((p) => p[3] + 1)];
  const zmin = Math.min(...zs) - 1, zmax = Math.max(...zs) + 2;
  const kz = (H - 34) / (zmax - zmin), Z = (z) => H - 22 - (z - zmin) * kz;
  const sx = (W - PADL - PADR) / (v1 - v0);
  $('vx').textContent = Math.max(1, Math.round(kz / sx));
  el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p[0], W).toFixed(1) + ' ' + Z(p[3]).toFixed(1)).join('') + 'L' + X(pts[pts.length - 1][0], W) + ' ' + (H - 22) + 'L' + X(pts[0][0], W) + ' ' + (H - 22) + 'Z', fill: css('--shld'), opacity: 0.35 }, svg);
  el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p[0], W).toFixed(1) + ' ' + Z(p[3]).toFixed(1)).join(''), fill: 'none', stroke: css('--ink'), 'stroke-width': 1.6 }, svg);
  for (const c of DATA.vcurves) {
    if (c.s1 < v0 || c.s0 > v1) continue;
    const r = el('rect', { x: X(c.s0, W), y: 4, width: Math.max(2, (c.s1 - c.s0) * sx), height: H - 26, fill: css('--accent'), opacity: 0.08 }, svg);
    hit(r, { type: 'vcurve', c });
    el('text', { x: X(c.pvi.s, W) - 30, y: 14 }, svg, (c.type === 'crest' ? 'crest' : 'sag') + ' K ' + c.K);
  }
  // grade labels between curves
  const marks = [0, ...DATA.vcurves.map((c) => c.pvi.s), L];
  for (let i = 0; i < marks.length - 1; i++) { const m = (marks[i] + marks[i + 1]) / 2; if (m < v0 || m > v1) continue; const g = st(m)[4]; el('text', { x: X(m, W) - 18, y: Z(st(m)[3]) - 8, class: 'lbl' }, svg, (g >= 0 ? '+' : '') + (g * 100).toFixed(2) + ' %'); }
  for (const s of DATA.structures) {
    if (s.footprint.s1 < v0 - 20 || s.footprint.s0 > v1 + 20) continue;
    const x = X(s.s, W);
    if (s.kind === 'overpass') {
      const r = el('rect', { x: X(s.footprint.s0, W), y: Z(s.deckTop), width: Math.max(3, (s.footprint.s1 - s.footprint.s0) * sx), height: Math.max(2, Z(s.underside) - Z(s.deckTop)), fill: css('--struct'), opacity: 0.75 }, svg);
      hit(r, { type: 'structure', s });
      el('line', { x1: x, x2: x, y1: Z(s.underside), y2: Z(s.pavementMax), stroke: css('--cursor'), 'stroke-width': 1.2, 'marker-end': '' }, svg);
      el('text', { x: x + 5, y: (Z(s.underside) + Z(s.pavementMax)) / 2 + 4, class: 'lbl' }, svg, fmt(s.clearanceMin) + ' m');
    } else {
      const r = el('rect', { x: x - 1.5, y: Z(s.signBottom + 3.6), width: 3, height: Z(s.signBottom) - Z(s.signBottom + 3.6), fill: css('--gantry') }, svg);
      hit(r, { type: 'structure', s });
      el('line', { x1: x + 3, x2: x + 3, y1: Z(s.signBottom), y2: Z(s.pavementMax), stroke: css('--cursor'), 'stroke-width': 1 }, svg);
      el('text', { x: x + 6, y: (Z(s.signBottom) + Z(s.pavementMax)) / 2 + 4 }, svg, fmt(s.clearanceMin) + ' m');
    }
  }
  gutter(svg, H);
  for (let z = Math.ceil(zmin / 5) * 5; z <= zmax; z += 5) { el('text', { x: 8, y: Z(z) + 4 }, svg, z + ' m'); el('line', { x1: PADL - 6, x2: PADL, y1: Z(z), y2: Z(z), stroke: css('--line') }, svg); }
  axis(svg, W, H, H - 20); cursor(svg, W, H);
}

// ── the horizontal alignment: curvature by element, superelevation ──
function drawAlg() {
  const svg = $('alg'); svg.innerHTML = ''; const [W, H] = size(svg);
  const kmax = Math.max(1e-4, ...DATA.stations.map((p) => Math.abs(p[5]))), emax = 0.06;
  const mid = (H - 22) / 2, K = (k) => mid - k / kmax * (mid - 12), E = (e) => H - 22 - e / emax * (H - 36);
  for (const e of DATA.elements) {
    if (e.s1 < v0 || e.s0 > v1) continue;
    const x0 = X(Math.max(v0, e.s0), W), x1 = X(Math.min(v1, e.s1), W);
    const r = el('rect', { x: x0, y: 4, width: Math.max(1, x1 - x0), height: H - 26, fill: e.type === 'arc' ? css('--accent') : e.type === 'spiral' ? css('--struct') : 'transparent', opacity: e.type === 'tangent' ? 1 : 0.1 }, svg);
    hit(r, { type: 'element', e });
    const name = e.type === 'arc' ? 'arc R ' + e.radius + ' m' : e.type === 'spiral' ? 'spiral ' + fmt(e.length, 0) + ' m' : 'tangent ' + fmt(e.length, 0) + ' m';
    if (x1 - x0 > 60) el('text', { x: x0 + 4, y: 14 }, svg, name);
  }
  el('line', { x1: PADL, x2: W - PADR, y1: mid, y2: mid, stroke: css('--line') }, svg);
  const pts = DATA.stations.filter((p) => p[0] >= v0 - 10 && p[0] <= v1 + 10);
  el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p[0], W).toFixed(1) + ' ' + K(p[5]).toFixed(1)).join(''), fill: 'none', stroke: css('--ink'), 'stroke-width': 1.6 }, svg);
  el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(p[0], W).toFixed(1) + ' ' + E(p[6]).toFixed(1)).join(''), fill: 'none', stroke: css('--cursor'), 'stroke-width': 1.2, 'stroke-dasharray': '5 3' }, svg);
  gutter(svg, H);
  el('text', { x: 6, y: mid - 4 }, svg, 'curvature');
  el('text', { x: 6, y: H - 26, fill: css('--cursor') }, svg, 'bank e (0–6 %)');
  axis(svg, W, H, H - 20); cursor(svg, W, H);
}

function inspect() {
  const box = $('inspect'); if (!sel) return;
  const rows = [];
  let title = '', link = null;
  const row = (k, v) => rows.push('<tr><td>' + k + '</td><td>' + v + '</td></tr>');
  if (sel.type === 'lane') {
    const l = DATA.lanes.find((q) => q.id === sel.id), b = laneBand(l.roadway, l.index);
    title = (l.dir === 'eb' ? 'Eastbound ' : 'Westbound ') + l.roadway + ' lane ' + (l.index + 1);
    row('Lane id', l.id); row('Width', fmt(l.width) + ' m'); row('Offset from median', fmt(b.d0) + '–' + fmt(b.d1) + ' m');
    row('Speed limit', l.speedKmh + ' km/h'); row('Surface', l.surface + ' · μ ' + l.mu);
    row('Left', (l.left.line || '').replace('-', ' ') + (l.left.lane ? ' → ' + l.left.lane : ' → ' + l.left.beyond));
    row('Right', (l.right.line || '').replace('-', ' ') + (l.right.lane ? ' → ' + l.right.lane : ' → ' + l.right.beyond));
    row('Vehicles in lane', DATA.vehicles.filter((v) => v.lane === l.id).length);
    link = deep(hover ?? (v0 + v1) / 2, l.id);
  } else if (sel.type === 'wall' || sel.type === 'shoulder') {
    const b = sel.band;
    title = sel.type === 'wall' ? (b.wall === 'median' ? 'Median Tall Wall' : 'Separation Tall Wall') : (b.side === 'left' ? 'Left' : 'Right') + ' shoulder · ' + b.roadway;
    row('Offset from median', fmt(b.d0) + '–' + fmt(b.d1) + ' m');
    if (sel.type === 'wall') { row('Base / top', fmt(DATA.opts.barrier.base) + ' / ' + fmt(DATA.opts.barrier.top) + ' m'); row('Height', fmt(DATA.opts.barrier.height) + ' m'); }
    else row('Width', fmt(b.w) + ' m');
  } else if (sel.type === 'structure') {
    const s = sel.s;
    title = s.kind === 'overpass' ? 'Overpass · ' + s.id : 'Sign gantry · ' + s.id + (s.D === 1 ? ' (eastbound)' : ' (westbound)');
    row('Station', fmt(s.s, 1) + ' m');
    row('Clearance, measured', '<b>' + fmt(s.clearanceMin, 3) + ' m</b>');
    row('Clearance target', fmt(s.clearanceTarget) + ' m' + (s.kind === 'overpass' ? ' (5.0 m MTO + resurfacing)' : ''));
    row('Tall load 4.15 m', 'air ' + fmt(s.clearanceMin - 4.15) + ' m');
    if (s.at) row('Tightest point', 'stn ' + fmt(s.at.s, 1) + ', ' + (s.at.D === 1 ? 'EB' : 'WB') + ' ' + fmt(s.at.d, 1) + ' m out');
    if (s.kind === 'overpass') { row('Deck width', fmt(s.deckHalfWidth * 2, 1) + ' m'); row('Span, abutment to abutment', fmt(s.span[1] - s.span[0], 1) + ' m'); row('Supports (offset)', s.bearings.map((b) => fmt(b, 1)).join(' · ') + ' m'); row('Soffit / deck top z', fmt(s.underside) + ' / ' + fmt(s.deckTop) + ' m'); }
    else row('Sign bottom z', fmt(s.signBottom) + ' m');
    link = deep(s.s - (s.kind === 'gantry' && s.D === -1 ? -200 : 200), s.kind === 'gantry' && s.D === -1 ? 'wb:express:1' : 'eb:express:1');
  } else if (sel.type === 'vehicle') {
    const v = sel.v, f = DATA.fleet[v.cls], r = DATA.census.fleet.dimRatio[v.cls];
    title = v.cls.replace(/([A-Z])/g, ' $1').toLowerCase();
    row('Lane', v.lane); row('Station', fmt(v.s, 1) + ' m');
    row('L × W × H', fmt(f.L) + ' × ' + fmt(f.W) + ' × ' + fmt(f.H) + ' m');
    row('Wheelbase / track', fmt(f.wb) + ' / ' + fmt(f.track) + ' m'); row('Wheel radius', fmt(f.r) + ' m');
    if (r) row('Drawn ÷ reference', fmt(r.L, 3) + ' · ' + fmt(r.W, 3) + ' · ' + fmt(r.H, 3));
    const ahead = DATA.vehicles.filter((q) => q.lane === v.lane && (v.D === 1 ? q.s > v.s : q.s < v.s)).sort((a, b) => Math.abs(a.s - v.s) - Math.abs(b.s - v.s))[0];
    if (ahead) { const gap = Math.abs(ahead.s - v.s) - (f.L + DATA.fleet[ahead.cls].L) / 2; row('Gap to vehicle ahead', fmt(gap, 1) + ' m · ' + fmt(gap / 30.6, 2) + ' s at 110 km/h'); }
    link = deep(v.s - v.D * 45, v.lane);
  } else if (sel.type === 'element') {
    const e = sel.e;
    title = e.type === 'arc' ? 'Circular arc' : e.type === 'spiral' ? 'Clothoid spiral' : 'Tangent';
    row('Stations', fmt(e.s0, 1) + '–' + fmt(e.s1, 1) + ' m'); row('Length', fmt(e.length, 1) + ' m');
    if (e.radius) { row('Radius', e.radius + ' m, ' + e.dir); row('Bank e', pct(st((e.s0 + e.s1) / 2)[6])); }
    if (e.A) row('Spiral parameter A', fmt(e.A, 0) + ' m');
    link = deep((e.s0 + e.s1) / 2 - 150, 'eb:express:1');
  } else if (sel.type === 'vcurve') {
    const c = sel.c;
    title = (c.type === 'crest' ? 'Crest' : 'Sag') + ' vertical curve';
    row('PVI', 'stn ' + fmt(c.pvi.s, 0) + ' m, z ' + fmt(c.pvi.z) + ' m'); row('Grades', pct(c.g1) + ' → ' + pct(c.g2));
    row('A (grade change)', fmt(Math.abs(c.A)) + ' %'); row('K', c.K + ' m/%'); row('Length', fmt(c.L, 1) + ' m');
    link = deep(c.s0 - 150, 'eb:express:1');
  }
  box.innerHTML = '<div class="kind">' + title + '</div><table>' + rows.join('') + '</table>' + (link ? '<a class="go" href="' + link + '" target="_blank" rel="noopener">Open in the 3D world here →</a>' : '');
}

function readout() {
  if (hover == null) { $('readout').textContent = ''; return; }
  const p = st(hover), e = elementAt(hover);
  $('readout').textContent = 'stn ' + fmt(hover, 0) + ' m · z ' + fmt(p[3]) + ' m · grade ' + pct(p[4]) + ' · bank ' + pct(p[6], 1) + ' · ' + (Math.abs(p[5]) > 1e-6 ? 'R ' + Math.round(1 / Math.abs(p[5])) + ' m' : 'tangent') + ' (' + e.type + ')';
}
function draw() { drawKey(); drawSld(); drawProf(); drawAlg(); readout(); }

// interaction: shared window across the strips
for (const id of ['sld', 'prof', 'alg']) {
  const svg = $(id); let drag = null;
  svg.addEventListener('wheel', (ev) => { ev.preventDefault(); const r = svg.getBoundingClientRect(), W = r.width; const s = S(ev.clientX - r.left, W), f = Math.exp(ev.deltaY * 0.0015); const span = Math.max(40, Math.min(L * 1.02, (v1 - v0) * f)); v0 = s - (s - v0) / (v1 - v0) * span; v1 = v0 + span; clamp(); draw(); }, { passive: false });
  // capture only once the pointer really drags: capturing on press would retarget the click to the
  // svg and nothing could be selected
  svg.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, a: v0, b: v1, id: ev.pointerId }; dragged = false; });
  svg.addEventListener('pointermove', (ev) => {
    const r = svg.getBoundingClientRect(), W = r.width, ox = ev.clientX - r.left;
    if (drag && (ev.buttons & 1)) {
      if (!dragged && Math.abs(ev.clientX - drag.x) > 3) { dragged = true; svg.setPointerCapture(drag.id); }
      if (dragged) { const ds = (ev.clientX - drag.x) / (W - PADL - PADR) * (drag.b - drag.a); v0 = drag.a - ds; v1 = drag.b - ds; clamp(); }
    }
    hover = Math.max(0, Math.min(L, S(ox, W))); draw();
  });
  svg.addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('pointerleave', () => { hover = null; draw(); });
  svg.addEventListener('dblclick', () => { v0 = 0; v1 = L; draw(); });
}
function clamp() { const span = v1 - v0; if (v0 < -span * 0.02) { v0 = -span * 0.02; v1 = v0 + span; } if (v1 > L + span * 0.02) { v1 = L + span * 0.02; v0 = v1 - span; } }
window.addEventListener('resize', draw);
draw();
</script>
</body>
</html>
`;
}
