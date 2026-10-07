/**
 * THE ART BOARD AS A PAGE — the same seven items as art-board.js, written as one HTML document: CSS grid lays the
 * panels out and wraps their words, the tiles are the generators' PNGs as images, and the drawings (the elevation and
 * section, the doodads, the plan, the atmosphere) are art-board.js's own SVG, inline. A headless Chromium
 * (scene-png.js renderPageToPng) turns the page into the PNG a tool answer carries; the page itself is what a viewer
 * opens. `artBoardHtml(manifest)` is pure.
 */
import { boardModel, drawingOf, architecturePanel, doodadsPanel, planPanel, atmospherePanel, hexOf } from './art-board.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { ART_ITEMS } from './art-direction.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STATUS = { proposed: '#e8b04a', approved: '#6cc070', auto: '#8a93a6' };
const TITLES = { palette: 'Palette', materials: 'Materials', architecture: 'Architecture', motifs: 'Motifs', doodads: 'Doodads', atmosphere: 'Atmosphere', plan: 'Plan' };

const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#14161a;color:#e9e4da;font:13px/1.35 Helvetica,Arial,sans-serif}
#board{width:1200px;padding:18px 20px 20px}
h1{font-size:22px;margin:0;letter-spacing:.02em}
.lede{color:#9a958c;font-size:12px;margin:3px 0 12px}
.row{display:grid;gap:10px;margin-bottom:10px}
.r1{grid-template-columns:380px 1fr 290px}.r2{grid-template-columns:560px 1fr 290px}
.card{background:#1e2026;border-radius:6px;padding:12px 14px;min-width:0}
.card header{display:flex;justify-content:space-between;align-items:center;gap:8px}
.card h2{font-size:15px;margin:0;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.badge{border:1.5px solid;border-radius:10px;padding:1px 10px;font-size:11px;font-weight:700;text-transform:uppercase;white-space:nowrap}
.note{color:#9a958c;font-size:12px;margin:2px 0 8px}
.ramp{display:grid;grid-template-columns:64px repeat(5,1fr) 62px;gap:4px;align-items:center;margin:5px 0}
.ramp span{color:#9a958c}.ramp code{color:#9a958c;font-size:11px}
.sw{height:28px;border-radius:3px}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 12px}
.tile{display:grid;grid-template-columns:86px 1fr;gap:8px;align-items:start}
.tile img{width:86px;height:86px;display:block;border-radius:2px;image-rendering:pixelated}
.tile b{display:block}.tile small{color:#9a958c;display:block}
.band{width:100%;height:64px;display:block;border-radius:2px}
.where{display:grid;grid-template-rows:16px 1fr 22px;height:110px;margin-top:10px;background:#2b2d33;border-radius:2px;font-size:10px;font-weight:700;color:#14161a;text-align:center}
.where .on{background:#e8b04a}.where .off{background:#45484f;color:#9a958c}.where .mid{display:flex;align-items:center;justify-content:center;color:#9a958c;font-weight:400}
svg{display:block;width:100%;height:auto}
`;

const card = (item, status, body, note = '') => {
  const c = STATUS[status] || '#9a958c', n = ART_ITEMS.indexOf(item) + 1;
  return `<section class="card" data-item="${item}"><header><h2>${n} ${TITLES[item]}</h2><span class="badge" style="color:${c};border-color:${c}">${esc(status || 'proposed')}</span></header>${note ? `<p class="note">${esc(note)}</p>` : ''}${body}</section>`;
};
const svg = (vb, inner) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

/** The board for a room stage recipe with an art direction, as one self-contained HTML document. */
export function artBoardHtml(manifest) {
  const { kitName, art, status, plan, k, P, tiles } = boardModel(manifest), X = art.motifs, W = art.materials.weathering || {};
  const ramps = [['walls', P.stone], ['floor', P.floor], ['vault', P.vault], ['trim', P.trim], ['wood', P.wood], ['accent', P.accent]]
    .map(([name, R]) => `<div class="ramp"><span>${name}</span>${R.map((c) => `<div class="sw" style="background:${hexOf(c)}"></div>`).join('')}<code>${hexOf(R[2])}</code></div>`).join('')
    + `<div class="ramp"><span>torch</span><div class="sw" style="background:${hexOf(P.light)};border-radius:50%;width:28px"></div><code style="grid-column:3/span 2">${hexOf(P.light)}</code></div>`;
  const mats = `<div class="tiles">${tiles.map(([name, key, note]) => `<div class="tile"><img src="${surfaceTexture(key) || ''}" alt=""><div><b>${esc(name)}</b>${String(note).split('\n').map((t) => `<small>${esc(t)}</small>`).join('')}</div></div>`).join('')}</div>`
    + `<p class="note" style="margin-top:10px">weathering: earth over ${Math.round((W.earth || 0) * 100)}% of the floor, ivy on ${Math.round((W.ivy || 0) * 100)}% of the bare bays</p>`;
  const on = X.on, motif = k.motif ? `<img class="band" src="${surfaceTexture(`${k.motif.family}-a`)}" alt="">` : '';
  const motifs = `${motif}<p style="margin:8px 0 0"><b style="font-size:15px">${esc(X.pattern)}</b></p><p class="note">relief ${Math.round(X.relief * 100)}%, its figure in the ${X.figure === 'accent' ? 'accent' : 'trim'} colour</p>`
    + `<div class="where"><div class="${on !== 'plinth' ? 'on' : 'off'}">cornice</div><div class="mid">runs along the ${on === 'both' ? 'plinth and the cornice' : on}</div><div class="${on !== 'cornice' ? 'on' : 'off'}" style="line-height:22px">plinth</div></div>`;
  const lift = k.lift || 1;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=1240"><title>Art direction · ${esc(kitName)}</title><style>${CSS}</style></head><body><div id="board">
<h1>ART DIRECTION · ${esc(kitName)}</h1>
<p class="lede">${esc(manifest.title || '')}${art.seed ? ` · seed ${art.seed}` : ''} · approve each item or send it back to be rolled again</p>
<div class="row r1">
${card('palette', status.palette, ramps, `stone: ${P.family} · shade (cool) to light (warm)`)}
${card('materials', status.materials, mats, 'the tiles the build lays, exactly')}
${card('motifs', status.motifs, motifs, 'small: a pattern carved in a band')}
</div>
<div class="row r2">
${card('architecture', status.architecture, svg('0 130 560 312', drawingOf(architecturePanel, plan, P)), `one wall, two bays · the room across · metres${lift > 1 ? ` · every room ×${lift} taller` : ''}`)}
${card('doodads', status.doodads, svg('0 50 290 392', drawingOf(doodadsPanel, plan, P)), 'the large things, never two together')}
${card('plan', status.plan, svg('0 50 290 392', drawingOf(planPanel, plan, P)), `${plan.rooms.length} rooms · the walk ends at the set piece`)}
</div>
${card('atmosphere', status.atmosphere, svg('0 44 1160 92', drawingOf(atmospherePanel, plan, art, P)))}
</div></body></html>`;
}

/** The page as a PNG, laid out by a headless Chromium (scene-png.js). Throws when no browser can be resolved. */
export async function artBoardPagePng(manifest) {
  const { renderPageToPng } = await import('../scene/scene-png.js');
  return renderPageToPng(artBoardHtml(manifest), { width: 1240, height: 1000, selector: '#board' });
}
