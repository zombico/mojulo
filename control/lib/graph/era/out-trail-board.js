/**
 * THE LANDFORM BOARD — the first item an outdoor trail offers for approval, before a blade of grass is laid: the shape
 * of the land, in black and white. Two depth maps (white high, black low) — the ROUGH pass (the heartbeat, the beats'
 * edges, the bumps) and the SMOOTH pass (the walk laid level, the geology at the cliff, the pits cut) — with the trail,
 * its beats, its pockets, its hazards and its stairs sites drawn over them; the HEARTBEAT strip (the trail's height along
 * its length, rough and smoothed, the stairs runs, the beats); and the trail's LAWS, measured.
 * `outTrailBoardHtml(manifest)` is pure; `outTrailBoardPng(manifest)` lays it out in a headless Chromium (scene-png.js).
 */
import { outTrailSite, outTrailLaws, exploreSeconds, OUT_TRAIL } from './out-trail.js';
import { STAGE_KITS, resolveKitId } from './stage.js';
import { NATURE_STYLES } from './nature.js';
import { ISEKAI_STYLES } from './isekai.js';
import { JUNGLE_STYLES } from './jungle.js';
import { encodePngGrey } from '../landscape/surface-textures.js';
import { gridX, gridY } from '../polygonizer/landform.js';

const STYLES = { nature: NATURE_STYLES, isekai: ISEKAI_STYLES, jungle: JUNGLE_STYLES };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const LABEL = { trailhead: 'trailhead', exit: 'exit', pinch: 'pinch', reveal: 'reveal', landmark: 'landmark', crossing: 'crossing', pocket: 'pocket', rest: 'rest', pit: 'pit' };

/** The trail a recipe asks for, on the style its kit is drawn by. */
export function outTrailOf(manifest) {
  const kitId = resolveKitId(manifest.kit || 'isekai-meadow'), kit = STAGE_KITS[kitId];
  if (!kit || !STYLES[kit.shell]) throw new Error(`stage: kit '${kitId}' is not open ground: a trail is for an outdoor kit (${Object.keys(STAGE_KITS).filter((k) => STYLES[STAGE_KITS[k].shell]).join(', ')})`);
  const st = STYLES[kit.shell][manifest.style || kit.style], seed = Number.isFinite(manifest.seed) ? manifest.seed : 1;
  return { kitId, st, seed, site: outTrailSite(st, manifest.trail === undefined ? true : manifest.trail, seed) };
}

// a pass's grid as a greyscale PNG: the valley's own range white to black (the cliff top above it saturates white)
function depthPng(site, g) {
  const vals = [];
  for (let j = 0; j < g.ny; j += 2) for (let i = 0; i < g.nx; i += 2) { const x = gridX(g, i), y = gridY(g, j); if (x > site.cliffX(y) + 2) vals.push(g.z[j * g.nx + i]); }
  vals.sort((a, b) => a - b);
  const lo = vals[Math.floor(vals.length * 0.01)], hi = vals[Math.floor(vals.length * 0.99)] + 0.5, grey = Buffer.alloc(g.nx * g.ny);
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const t = Math.max(0, Math.min(1, (g.z[j * g.nx + i] - lo) / (hi - lo)));
    grey[(g.ny - 1 - j) * g.nx + i] = Math.round(18 + 225 * t);
  }
  return { url: `data:image/png;base64,${encodePngGrey(grey, g.nx, g.ny).toString('base64')}`, lo, hi };
}

// the trail, its beats and its hazards over a depth map `w` × `h` px
function overlay(site, g, w, h) {
  const x0 = gridX(g, 0), x1 = gridX(g, g.nx - 1), y1 = gridY(g, g.ny - 1);
  const X = (x) => ((x - x0) / (x1 - x0)) * w, Y = (y) => h - (y / y1) * h, k = w / (x1 - x0);
  const pts = []; for (let y = 0; y <= site.D; y += 0.5) pts.push(`${f1(X(site.trailX(y)))},${f1(Y(y))}`);
  const A = site.out.anchors, out = [];
  out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#000" stroke-width="${f1(site.halfW * 2 * k + 3)}" stroke-linejoin="round" opacity=".55"/>`);
  out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="${f1(site.halfW * 2 * k)}" stroke-linejoin="round"/>`);
  for (const p of site.out.pits) out.push(`<rect x="${f1(X(site.trailX(p.y)) - 26)}" y="${f1(Y(p.y + p.w / 2))}" width="52" height="${f1(p.w * k)}" fill="#000"/>`);
  for (const s of site.out.streams) out.push(`<rect x="${f1(X(site.cliffX(s.y) + 3))}" y="${f1(Y(s.y + 1.2))}" width="${f1(w - X(site.cliffX(s.y) + 3))}" height="${f1(2.4 * k)}" fill="url(#hatch)"/>`);
  for (const a of A.filter((q) => q.site === 'stairs')) {
    for (let s = a.s0; s <= a.s1; s += 1) { const y = site.out.plan.yOf(s), x = X(site.trailX(y)); out.push(`<line x1="${f1(x - 7)}" y1="${f1(Y(y))}" x2="${f1(x + 7)}" y2="${f1(Y(y))}" stroke="#000" stroke-width="1.6"/>`); }
  }
  for (const a of A.filter((q) => q.kind === 'beat')) {
    const x = X(a.at[0]), y = Y(a.at[1]);
    if (a.beat === 'pocket') out.push(`<line x1="${f1(X(a.mouth[0]))}" y1="${f1(Y(a.mouth[1]))}" x2="${f1(x)}" y2="${f1(y)}" stroke="#fff" stroke-width="3" stroke-dasharray="4 3"/><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(a.r * k)}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 3"/>`);
    if (a.beat === 'landmark') out.push(`<polygon points="${f1(x)},${f1(y - 11)} ${f1(x + 7)},${f1(y + 5)} ${f1(x - 7)},${f1(y + 5)}" fill="#000" stroke="#fff" stroke-width="1.5"/>`);
    else out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="5" fill="#000" stroke="#fff" stroke-width="1.5"/>`);
    const right = x < w * 0.62;
    out.push(`<text x="${f1(x + (right ? 10 : -10))}" y="${f1(y + 4)}" text-anchor="${right ? 'start' : 'end'}" class="lbl">${esc(a.id)}</text>`);
  }
  return `<svg class="over" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#000" stroke-width="2.4"/></pattern></defs>${out.join('')}</svg>`;
}

// the heartbeat: the trail's height along its length, rough (dashed) and smoothed (solid), the stairs, the beats
function heartbeat(site, w, h) {
  const P = site.out.plan, { ds, rough, smoothed } = P.profile, n = rough.length;
  let lo = Infinity, hi = -Infinity; for (let k = 0; k < n; k++) { lo = Math.min(lo, rough[k], smoothed[k]); hi = Math.max(hi, rough[k], smoothed[k]); }
  const span = Math.max(4, hi - lo), mid = (hi + lo) / 2, padL = 40, padB = 26, iw = w - padL - 10, ih = h - padB - 30;
  const X = (s) => padL + (s / P.L) * iw, Y = (z) => 30 + ih / 2 - ((z - mid) / span) * ih;
  const line = (a) => Array.from(a, (z, k) => `${f1(X(k * ds))},${f1(Y(z))}`).join(' ');
  const out = [];
  for (const r of P.stairs) out.push(`<rect x="${f1(X(r.s0))}" y="30" width="${f1(Math.max(2, X(r.s1) - X(r.s0)))}" height="${ih}" fill="url(#hatch2)"/><text x="${f1((X(r.s0) + X(r.s1)) / 2)}" y="${f1(30 + ih + 14)}" text-anchor="middle" class="sm">${esc(r.id)} · ${f1(Math.abs(r.rise))} m</text>`);
  for (let m = Math.ceil(lo); m <= hi; m += 1) out.push(`<line x1="${padL}" x2="${padL + iw}" y1="${f1(Y(m))}" y2="${f1(Y(m))}" stroke="#d9d9d9" stroke-width=".6"/>`);
  for (let s = 0; s <= P.L; s += 10) out.push(`<text x="${f1(X(s))}" y="${h - 4}" text-anchor="middle" class="sm">${s} m</text>`);
  out.push(`<polyline points="${line(rough)}" fill="none" stroke="#777" stroke-width="1.6" stroke-dasharray="5 4"/>`);
  out.push(`<polyline points="${line(smoothed)}" fill="none" stroke="#000" stroke-width="2.6"/>`);
  for (const b of P.beats) {
    const x = X(b.s), z = P.smoothAt(b.s);
    out.push(`<line x1="${f1(x)}" x2="${f1(x)}" y1="22" y2="${f1(Y(z))}" stroke="#000" stroke-width=".8" stroke-dasharray="2 2"/><circle cx="${f1(x)}" cy="${f1(Y(z))}" r="4.5" fill="#fff" stroke="#000" stroke-width="1.8"/><text x="${f1(x)}" y="16" text-anchor="middle" class="lbl2">${esc(LABEL[b.kind] || b.kind)}</text>`);
  }
  out.push(`<text x="4" y="${f1(Y(hi))}" class="sm">${f1(hi)} m</text><text x="4" y="${f1(Y(lo))}" class="sm">${f1(lo)} m</text>`);
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="hatch2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#bbb" stroke-width="2.5"/></pattern></defs>${out.join('')}</svg>`;
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#111;font:13px/1.35 Helvetica,Arial,sans-serif}
#board{width:1200px;padding:18px 20px 20px}
h1{font-size:22px;margin:0;letter-spacing:.02em}
.lede{color:#555;font-size:12px;margin:3px 0 12px}
.row{display:grid;gap:12px;margin-bottom:12px;grid-template-columns:auto auto 1fr;align-items:start}
.card{border:1.5px solid #111;border-radius:4px;padding:10px 12px;min-width:0}
.card header{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.card h2{font-size:14px;margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.badge{border:1.5px solid #111;border-radius:10px;padding:1px 10px;font-size:11px;font-weight:700;text-transform:uppercase}
.note{color:#555;font-size:12px;margin:6px 0 0}
.map{position:relative}.map img{display:block;image-rendering:auto}.map .over{position:absolute;left:0;top:0}
.lbl{font:700 11px Helvetica,Arial,sans-serif;fill:#000;paint-order:stroke;stroke:#fff;stroke-width:3px}
.lbl2{font:700 11px Helvetica,Arial,sans-serif;fill:#000}.sm{font:10px Helvetica,Arial,sans-serif;fill:#555}
table{border-collapse:collapse;width:100%}td{padding:3px 4px;border-bottom:1px solid #ddd;vertical-align:top}
td.ok{font-weight:700}td.no{font-weight:700;background:#111;color:#fff}
svg{display:block;width:100%;height:auto}
`;

/** The landform board for a stage recipe with a `trail`, as one self-contained HTML document. */
export function outTrailBoardHtml(manifest) {
  const { kitId, seed, site } = outTrailOf(manifest), P = site.out.plan, T = P.T, g0 = site.passes.rough, g1 = site.passes.smooth;
  const mw = 330, mh = Math.round((mw * (gridY(g0, g0.ny - 1) - gridY(g0, 0))) / (gridX(g0, g0.nx - 1) - gridX(g0, 0)));
  const map = (g, title, note) => { const d = depthPng(site, g); return `<div class="card"><header><h2>${title}</h2></header><div class="map" style="width:${mw}px;height:${mh}px"><img src="${d.url}" width="${mw}" height="${mh}" alt="">${overlay(site, g, mw, mh)}</div><p class="note">${note} · black ${f1(d.lo)} m, white ${f1(d.hi)} m</p></div>`; };
  const laws = outTrailLaws(site).map((l) => `<tr><td>${esc(l.law)}</td><td class="${l.ok ? 'ok' : 'no'}">${l.ok ? 'holds' : 'BROKEN'}</td><td>${esc(typeof l.value === 'number' ? f1(l.value) : l.value)}</td><td>${esc(l.want)}</td></tr>`).join('');
  const beats = P.beats.map((b) => `<tr><td><b>${esc(b.id)}</b></td><td>${f1(b.s)} m</td><td>${esc(b.kind === 'trailhead' ? 'where the walk starts: the landmark in view' : b.kind === 'exit' ? 'where the walk leaves for the next trail' : OUT_TRAIL.beats[b.kind].words)}</td></tr>`).join('');
  const status = (manifest.art && manifest.art.status && manifest.art.status.landform) || 'proposed';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>Landform · ${esc(T.id)}</title><style>${CSS}</style></head><body><div id="board">
<h1>LANDFORM · out-trail:${esc(T.id)}</h1>
<p class="lede">${esc(kitId)} · seed ${seed} · heartbeat ${f1(T.heartbeat)} · bumpiness ${f1(T.bumpiness)} · ${f1(P.L - 2 * OUT_TRAIL.ends)} m of trail, ${f1(T.run)} s to run, ${exploreSeconds(site)} s to explore · <span class="badge">${esc(status)}</span></p>
<div class="row">
${map(g0, '1 · rough', 'the heartbeat, the beats’ edges, the bumps')}
${map(g1, '2 · smooth', 'the walk laid level, the geology at the cliff, the pits cut')}
<div class="card"><header><h2>Laws</h2><span class="badge">machine gate</span></header><table>${laws}</table>
<header style="margin-top:12px"><h2>Beats</h2></header><table>${beats}</table>
<p class="note">white line: the trail · ● a beat · ▲ the landmark · dashed ring: a pocket and its spur · black bar: a pit · hatched: the stream · ticks: a stairs site</p></div>
</div>
<div class="card"><header><h2>Heartbeat</h2><span class="note" style="margin:0">dashed: rough · solid: smoothed · hatched: steeper than ${OUT_TRAIL.grade}, a stairs site</span></header>${heartbeat(site, 1156, 230)}</div>
</div></body></html>`;
}

/** The board as a PNG, laid out by a headless Chromium (scene-png.js). Throws when no browser can be resolved. */
export async function outTrailBoardPng(manifest) {
  const { renderPageToPng } = await import('../scene/scene-png.js');
  return renderPageToPng(outTrailBoardHtml(manifest), { width: 1240, height: 1000, selector: '#board' });
}
