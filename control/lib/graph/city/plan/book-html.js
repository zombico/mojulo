/**
 * THE CITY PLAN BOOK: a city recipe read as a book, served from /bible. A cover (what it is and its census), the plan
 * sheet (the board, the districts, every street, every lot by use and height, the sites, the lines and their stops, the
 * walk's findings marked where they stand), the laws, the lots by id (the ids `lots` takes), and what is open, from the
 * same table the mint's `next` reads. Pure and self-contained: no script, no fetch.
 */
import { cityGreen } from './green.js';
import { readCity, openCityConcerns, CITY_OUTCOMES } from './read.js';
import { cellName } from '../../level/ground.js';
import { CITY_GROUND } from './scene.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
const USE_FILL = { office: '#6f8fb0', mixed: '#c9a46a', residential: '#b8876e', industrial: '#8d8f86', civic: '#8fa37c', parking: '#6b6d70' };
const DISTRICT_FILL = { core: '#e7d3b0', commercial: '#ecdcc0', residential: '#ead8cf', industrial: '#dcdcd6', civic: '#dbe5d1', park: '#c6d8b4', water: '#b9d1df' };

/** The plan sheet as SVG: x across, y down, in metres, with the board's cells named on its margins. */
export function cityPlanSvg(d, { width = 1100 } = {}) {
  const { W, D, cell, cols, rows } = d.frame, pad = 34, s = (width - 2 * pad) / W, H = D * s + 2 * pad;
  const X = (x) => r1(pad + x * s), Y = (y) => r1(pad + y * s);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${r1(H)}" class="sheet" role="img" aria-label="city plan">`];
  out.push(`<rect x="${X(0)}" y="${Y(0)}" width="${r1(W * s)}" height="${r1(D * s)}" fill="#e9eadf"/>`);
  for (const x of d.districts) out.push(`<rect x="${X(x.rect.x0)}" y="${Y(x.rect.y0)}" width="${r1((x.rect.x1 - x.rect.x0) * s)}" height="${r1((x.rect.y1 - x.rect.y0) * s)}" fill="${DISTRICT_FILL[x.use]}"/>`);
  for (const g of d.gore) out.push(`<rect x="${X(g.x0)}" y="${Y(g.y0)}" width="${r1((g.x1 - g.x0) * s)}" height="${r1((g.y1 - g.y0) * s)}" fill="#cfdcbf" opacity="0.6"/>`);
  for (const st of d.streets) {
    const pts = st.pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ');
    out.push(`<polyline points="${pts}" fill="none" stroke="#c9c5ba" stroke-width="${r1((st.road + 2 * st.walk) * s)}" stroke-linecap="square"/>`);
    out.push(`<polyline points="${pts}" fill="none" stroke="${st.rank === 'major' ? '#55585c' : '#7b7e82'}" stroke-width="${r1(st.road * s)}" stroke-linecap="square"><title>${esc(st.id)} · ${st.rank} · ${st.source}</title></polyline>`);
  }
  for (const l of d.lots) {
    const top = l.use === 'parking' ? USE_FILL.parking : USE_FILL[l.use] || '#999';
    const op = l.use === 'parking' ? 0.5 : Math.min(1, 0.45 + l.h / 120);
    out.push(`<rect x="${X(l.x0)}" y="${Y(l.y0)}" width="${r1((l.x1 - l.x0) * s)}" height="${r1((l.y1 - l.y0) * s)}" fill="${top}" fill-opacity="${r1(op)}" stroke="#fff" stroke-width="0.4"><title>${esc(l.id)} · ${l.use}${l.floors ? ` · ${l.floors} storeys, ${Math.round(l.h)} m` : ''}${l.tower ? ' · tower' : ''}</title></rect>`);
  }
  for (const si of d.sites) {
    out.push(`<rect x="${X(si.rect.x0)}" y="${Y(si.rect.y0)}" width="${r1((si.rect.x1 - si.rect.x0) * s)}" height="${r1((si.rect.y1 - si.rect.y0) * s)}" fill="${si.use === 'park' ? CITY_GROUND.park : CITY_GROUND.plaza}" stroke="#3b3d40" stroke-dasharray="4 3"/>`);
    if (si.mass) out.push(`<rect x="${X(si.mass.x0)}" y="${Y(si.mass.y0)}" width="${r1((si.mass.x1 - si.mass.x0) * s)}" height="${r1((si.mass.y1 - si.mass.y0) * s)}" fill="#3b3d40"/>`);
    out.push(`<text x="${X((si.rect.x0 + si.rect.x1) / 2)}" y="${Y(si.rect.y1) + 12}" class="lbl" text-anchor="middle">${esc(si.name || si.use)}</text>`);
  }
  // the green (green.js): a dot per plant, a street tree darker than a park's, a shrub small, a palm a star
  for (const g of cityGreen(d)) {
    const r = g.plant === 'shrub' ? 1.2 : 2.2, fill = g.plant === 'palm' ? '#7e9a3c' : g.plant === 'conifer' ? '#2f5a3a' : g.kind === 'street' ? '#3f6e3c' : '#5b8a48';
    out.push(`<circle cx="${X(g.x)}" cy="${Y(g.y)}" r="${r}" fill="${fill}" fill-opacity="0.85"/>`);
  }
  for (const t of d.transit) {
    out.push(`<polyline points="${t.pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="#b5452f" stroke-width="2.4" stroke-dasharray="7 4"/>`);
    for (const st of t.stops) out.push(`<circle cx="${X(st.at[0])}" cy="${Y(st.at[1])}" r="4.5" fill="${st.onStreet ? '#fff' : '#b5452f'}" stroke="#b5452f" stroke-width="2"/>`);
  }
  // the walk's findings, where they stand: an edge too long between crossings or without a beat
  const flagged = new Set(d.laws.filter((l) => ['crossing-every', 'beat-every'].includes(l.id)).flatMap((l) => l.findings.map((f) => f.at)));
  for (const e of d.walk.edges) if (flagged.has(e.street)) {
    const A = d.walk.nodes[e.a], B = d.walk.nodes[e.b];
    if (e.len > d.grammar.walk.beat) out.push(`<line x1="${X(A.x)}" y1="${Y(A.y)}" x2="${X(B.x)}" y2="${Y(B.y)}" stroke="#d6336c" stroke-width="2" stroke-dasharray="2 3"/>`);
  }
  // the segments a city is played in: each its outline and name, each portal a gate on its edge
  for (const sg of d.segments || []) {
    out.push(`<rect x="${X(sg.rect.x0)}" y="${Y(sg.rect.y0)}" width="${r1((sg.rect.x1 - sg.rect.x0) * s)}" height="${r1((sg.rect.y1 - sg.rect.y0) * s)}" fill="none" stroke="#7a3fb0" stroke-width="2.2" stroke-dasharray="10 5"/>`);
    out.push(`<text x="${X(sg.rect.x0) + 6}" y="${Y(sg.rect.y0) + 16}" class="seg">${sg.id}</text>`);
    for (const nb of sg.neighbours) if (nb.id > sg.id) out.push(`<rect x="${X(nb.portal.at[0]) - 5}" y="${Y(nb.portal.at[1]) - 5}" width="10" height="10" fill="#7a3fb0"><title>portal ${sg.id} ↔ ${nb.id} on ${nb.portal.street}</title></rect>`);
  }
  out.push(`<circle cx="${X(d.field.cx)}" cy="${Y(d.field.cy)}" r="${r1(d.field.lambda * s)}" fill="none" stroke="#6f8fb0" stroke-dasharray="3 5"/>`);
  // the board: every cell line faint, named on the margins
  for (let c = 0; c <= cols; c++) out.push(`<line x1="${X(c * cell)}" y1="${Y(0)}" x2="${X(c * cell)}" y2="${Y(D)}" stroke="#000" stroke-opacity="0.07"/>`);
  for (let r = 0; r <= rows; r++) out.push(`<line x1="${X(0)}" y1="${Y(r * cell)}" x2="${X(W)}" y2="${Y(r * cell)}" stroke="#000" stroke-opacity="0.07"/>`);
  for (let c = 0; c < cols; c++) out.push(`<text x="${X((c + 0.5) * cell)}" y="${pad - 12}" class="cell" text-anchor="middle">${cellName(c, 1).replace(/\d+$/, '')}</text>`);
  for (let r = 1; r <= rows; r++) out.push(`<text x="${pad - 10}" y="${Y((r - 0.5) * cell) + 4}" class="cell" text-anchor="end">${r}</text>`);
  out.push('</svg>');
  return out.join('');
}

/** The book: { title? } plus the city recipe → a self-contained HTML page. */
export function cityBookHtml(m, { ref = null, world = null } = {}) {
  const { read, design: d } = readCity(m), open = openCityConcerns(m, read);
  const title = m.title || `${read.grammar.label} · city plan`;
  const st = read.stats, inferred = m.notes?.inferred || [];
  const lawRows = d.laws.map((l) => `<tr class="${l.ok ? 'ok' : 'open'}"><td><b>${esc(l.id)}</b><div class="why">${esc(l.why)}</div></td><td>${esc(l.want)}</td><td>${l.ok ? 'holds' : `${l.findings.length} finding${l.findings.length === 1 ? '' : 's'}<ul>${l.findings.slice(0, 6).map((f) => `<li>${esc(f.detail)}</li>`).join('')}</ul>`}${l.waived ? `<div class="why">${l.waived} waived</div>` : ''}</td></tr>`).join('');
  const lotRows = d.lots.slice().sort((a, b) => b.h - a.h).slice(0, 60).map((l) => `<tr><td><code>${esc(l.id)}</code></td><td>${esc(l.use)}${l.tower ? ' · tower' : ''}${l.byHand ? ' · by hand' : ''}</td><td>${l.floors || '—'}</td><td>${Math.round(l.h)} m</td><td>${Math.round(l.x1 - l.x0)} × ${Math.round(l.y1 - l.y0)} m</td><td>${esc(l.skin || '')}</td><td>${esc(cellName(Math.min(d.frame.cols - 1, Math.floor(((l.x0 + l.x1) / 2) / d.frame.cell)), Math.min(d.frame.rows, 1 + Math.floor(((l.y0 + l.y1) / 2) / d.frame.cell))))}</td></tr>`).join('');
  const openRows = CITY_OUTCOMES.map((o) => {
    const mine = open.filter((c) => c.outcome === o.id);
    return `<section class="outcome"><h3>${esc(o.name)} <span class="q">${esc(o.question)}</span></h3>${mine.length ? `<ul>${mine.map((c) => `<li><b>${esc(c.id)}</b>: ${esc(c.adds)}<br><code>${esc(c.field)}</code></li>`).join('')}</ul>` : '<p class="why">Nothing open.</p>'}</section>`;
  }).join('');
  const legend = Object.entries(USE_FILL).map(([k, v]) => `<span><i style="background:${v}"></i>${k}</span>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
:root{--bg:#f6f5f0;--ink:#24262a;--muted:#6b6d70;--rule:#d9d6cc;--card:#fff;--open:#b5452f;--ok:#3f7a4a}
@media (prefers-color-scheme:dark){:root{--bg:#17181b;--ink:#e6e4de;--muted:#9a9c9f;--rule:#34363a;--card:#202226}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}h1{font-size:28px;margin:0 0 4px}h2{margin:36px 0 10px;font-size:20px;border-bottom:1px solid var(--rule);padding-bottom:6px}
.sub{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}
.stat{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:10px 12px}.stat b{display:block;font-size:20px}.stat span{color:var(--muted);font-size:13px}
.sheet{width:100%;height:auto;background:#fff;border:1px solid var(--rule);border-radius:6px}.sheet .cell{font:11px system-ui;fill:#6b6d70}.sheet .lbl{font:11px system-ui;fill:#24262a}.sheet .seg{font:bold 13px system-ui;fill:#7a3fb0}
.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:var(--muted);margin:8px 0}.legend i{display:inline-block;width:12px;height:12px;border-radius:2px;margin-right:5px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{border-bottom:1px solid var(--rule);padding:7px 8px;text-align:left;vertical-align:top}tr.open td:first-child b{color:var(--open)}tr.ok td:first-child b{color:var(--ok)}
.why{color:var(--muted);font-size:13px}ul{margin:4px 0;padding-left:18px}code{font-size:12.5px;word-break:break-word}.q{color:var(--muted);font-weight:400;font-size:14px}
.scroll{overflow-x:auto}iframe{width:100%;height:520px;border:1px solid var(--rule);border-radius:6px;background:#000}
</style></head><body><main>
<h1>${esc(title)}</h1>
<div class="sub">${esc(read.grammar.label)} grammar · ${esc(read.play)} scale · ${read.board.cols} × ${read.board.rows} cells of ${read.board.cell} m (${read.frame.w} × ${read.frame.d} m) · seed ${d.plan.seed}${ref ? ` · <code>${esc(ref)}</code>` : ''}</div>
<div class="grid">
<div class="stat"><b>${st.blocks}</b><span>blocks, ${st.pitch} m pitch</span></div>
<div class="stat"><b>${st.lots}</b><span>lots, ${st.towers} towers</span></div>
<div class="stat"><b>${Math.round(st.height.p50)} m</b><span>median height (p90 ${Math.round(st.height.p90)} m)</span></div>
<div class="stat"><b>${st.streetKm} km</b><span>of street, ${Math.round(st.crossingsPerKm2)} crossings / km²</span></div>
<div class="stat"><b>${st.walkAcross ? `${Math.round(st.walkAcross.minutes)} min` : '—'}</b><span>corner to corner on foot, at ${st.walkAcross ? st.walkAcross.pace : '—'} m/s</span></div>
<div class="stat"><b>${d.laws.filter((l) => l.ok).length} / ${d.laws.length}</b><span>laws hold</span></div>
</div>
<h2>Plan</h2>
<div class="legend">${legend}<span><i style="background:#cfdcbf"></i>left over</span><span><i style="border:2px dashed #6f8fb0;background:none"></i>height field's reach</span><span><i style="background:#d6336c"></i>walk finding</span>${d.segments ? '<span><i style="border:2px dashed #7a3fb0;background:none"></i>segment, ■ portal</span>' : ''}</div>
${cityPlanSvg(d)}
${world ? `<h2>Walk</h2><iframe src="${esc(world.src)}" title="the city, walkable" loading="lazy"></iframe>` : ''}
<h2>Laws</h2><div class="scroll"><table><tr><th>Law</th><th>Wants</th><th>Now</th></tr>${lawRows}</table></div>
${inferred.length ? `<h2>Given at mint</h2><ul>${inferred.map((i) => `<li><b>${esc(i.field)}</b>: ${esc(i.reason)}</li>`).join('')}</ul>` : ''}
<h2>Lots</h2><p class="why">The tallest ${Math.min(60, d.lots.length)} of ${d.lots.length}. A lot by hand: <code>lots: { '&lt;id&gt;': { use?, storeys? } }</code>; the rest of its block keeps its dice.</p>
<div class="scroll"><table><tr><th>Lot</th><th>Use</th><th>Storeys</th><th>Height</th><th>Footprint</th><th>Skin</th><th>Cell</th></tr>${lotRows}</table></div>
${d.segments ? `<h2>Segments</h2><p class="why">The city as it is played: each segment a level, left by a portal on a street into its neighbour.${m.segments && m.segments.levels ? ' Each is minted beside the city as <code>&lt;city ref&gt;-&lt;id&gt;</code>.' : ' <code>segments.levels: true</code> mints a level for each.'}</p>
<div class="scroll"><table><tr><th>Segment</th><th>Size</th><th>Lots</th><th>Ways out</th></tr>${d.segments.map((x) => `<tr><td><b>${x.id}</b></td><td>${Math.round(x.rect.x1 - x.rect.x0)} × ${Math.round(x.rect.y1 - x.rect.y0)} m</td><td>${x.lots.length}</td><td>${x.neighbours.map((n) => `${n.id} (${n.side}, by ${esc(n.portal.street)})`).join(', ') || 'none: its goal is its farthest crossing'}</td></tr>`).join('')}</table></div>` : ''}
<h2>Open</h2>${openRows}
</main></body></html>`;
}

