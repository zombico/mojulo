/**
 * THE COLOUR BOOK — a game's colour laid out to be chosen by eye (`/bible?book=colour`): what it is now and each way it
 * could be oriented (colour.js colourOptions), every one painted into the same small landscape (the theorist's contact
 * sheet: color-theorist/contact.js) with the game's cast standing on its ground, the distance each sits from it said
 * beside it. The only thing that differs between two rows is the colour, so the choice is the colour's.
 *
 *   colourBookHtml(world) → a whole HTML page; throws where the world has no ground to read (a room kit)
 *
 * The machine half is on the page (the figure laws, the palette laws, each distance); whether an option reads as this
 * game is the eyes gate's, and the page says so. Taking one is a patch (design_game { ref, patch }): the page prints it.
 *
 * Pure: a recipe in, text out. On a neutral grey: a coloured surround biases the eye.
 */
import { colourOptions } from './colour.js';
import { thumbnail } from '../color-theorist/contact.js';
import { FIGURE_MIN } from '../color-theorist/figures.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexOf = (against, what) => against.find((a) => a.what === what)?.hex ?? against[0].hex;

// a figure as a small standing shape on the ground it is seen on, the foliage behind its head
function figure(f, against) {
  const ok = f.clear >= FIGURE_MIN;
  return `<div class="fig"><svg width="64" height="78" viewBox="0 0 64 78" role="img" aria-label="${esc(f.name)}"><rect width="64" height="78" fill="${hexOf(against, 'ground')}"/><rect width="64" height="30" fill="${hexOf(against, 'foliage')}"/>`
    + `<circle cx="32" cy="22" r="10" fill="${f.hex}" stroke="#1b1b1b" stroke-width="1.2"/><path d="M18 70 Q18 34 32 34 Q46 34 46 70 Z" fill="${f.hex}" stroke="#1b1b1b" stroke-width="1.2"/></svg>`
    + `<b>${esc(f.id)}</b><span class="${ok ? 'ok' : 'no'}">${f.clear.toFixed(2)}</span><code>${f.hex}</code>${f.was ? `<code class="was">was ${f.was}</code>` : ''}</div>`;
}
// a land with no palette to paint a landscape from: its ground's own swatches
const swatches = (against) => `<div class="sw">${against.map((a) => `<span style="background:${a.hex}" title="${esc(a.what)} ${a.hex}"></span>`).join('')}</div>`;
const lawLine = (laws) => { const bad = laws.filter((l) => !l.ok); return bad.length ? `figure laws advising: ${bad.map((l) => `${esc(l.law)} (${esc(l.value)})`).join('; ')}` : 'every figure law holds'; };

function row({ tag, name, says, why, figures, laws, zones, against, palette, patch, pick }) {
  const lands = zones?.length ? zones : null, perZone = (i) => (lands ? [{ what: 'ground', hex: lands[i].roles.ground[2] }, { what: 'foliage', hex: lands[i].roles.foliage[2] }] : against);
  const thumbs = lands ? lands.map((K) => thumbnail(K, { w: lands.length > 1 ? 250 : 380, h: lands.length > 1 ? 150 : 228 })).join('') : swatches(against);
  const figs = (lands ?? [null]).map((_, i) => `<div class="figs">${lands && lands.length > 1 ? `<i>level ${i + 1}</i>` : ''}${figures.map((f) => figure(f, perZone(i))).join('')}</div>`).join('');
  const failing = palette?.failing;
  return `<section${pick ? ' class="pick"' : ''}><h2><em>${esc(tag)}</em> ${esc(name)}${pick ? ' <small>the machine\'s pick</small>' : ''}</h2><p>${esc(says)}${why ? ` <span class="why">${esc(why)}.</span>` : ''}</p>`
    + `<div class="row"><div class="thumbs">${thumbs}</div><div>${figs}</div></div>`
    + `<p class="spec">${lawLine(laws)}${failing ? ` · ${failing.length ? `palette laws advising: ${failing.map(esc).join(', ')}` : 'every palette law holds'}` : ''}</p>`
    + (patch?.length ? `<details><summary>Take it: design_game({ ref, patch })</summary><pre>${esc(JSON.stringify(patch, null, 1))}</pre></details>` : '') + '</section>';
}

export function colourBookHtml(world) {
  const R = colourOptions(world);
  if (!R) throw new Error('colour book: this world has no ground to read its cast against (a room kit paints no land)');
  const now = R.now, nowLand = now.ground.palette ? [now.ground.palette] : null;
  const rows = [row({ tag: 'now', name: 'As it is', says: now.figures.length ? (now.sinks.length ? `${now.sinks.map((s) => `${s.id} sits ${s.clear} from the ${s.from}`).join('; ')}: under ${FIGURE_MIN} a figure sinks into the land` : 'every figure parts from the land it stands on') : 'no figure is read yet',
    figures: now.figures, laws: now.laws, zones: nowLand, against: now.ground.against })];
  R.options.forEach((o, i) => rows.push(row({ tag: String.fromCharCode(65 + i), ...o, against: now.ground.against, pick: o.id === R.recommend })));
  const unread = now.unread.length ? `<p class="spec">Not read yet: ${now.unread.map((u) => `<b>${esc(u.id)}</b> (${esc(u.why)})`).join('; ')}.</p>` : '';
  const name = world.name ?? world.id ?? 'the game';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} · colour</title><style>`
    + 'body{margin:0;padding:18px 22px;background:#8c8c8c;font:13px system-ui,sans-serif;color:#161616}h1{font-size:19px;margin:0 0 4px}h2{font-size:15px;margin:0}h2 em{font-style:normal;background:#161616;color:#fff;border-radius:4px;padding:1px 7px;margin-right:6px}h2 small{font-weight:400;font-size:11px;background:#0b5a1e;color:#fff;border-radius:4px;padding:1px 6px;margin-left:6px}'
    + 'section{background:#b9b9b9;border-radius:8px;padding:12px 14px;margin:12px 0}section.pick{outline:2px solid #0b5a1e}p{margin:3px 0 8px}.why{color:#333}.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}.thumbs{display:flex;gap:6px;flex-wrap:wrap}.thumbs svg{border-radius:4px;display:block}'
    + '.sw{display:flex;border-radius:4px;overflow:hidden}.sw span{width:60px;height:78px}.figs{display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap}.figs i{width:48px;font-style:normal;color:#333}.fig{display:flex;flex-direction:column;align-items:center;font-size:11px;gap:1px}.fig svg{border-radius:4px}'
    + '.fig code{font-size:10px;color:#333}.fig .was{color:#555}.ok{color:#0b5a1e;font-weight:600}.no{color:#8f1010;font-weight:700}.spec{color:#333;font-size:12px;margin:8px 0 0}details{margin-top:8px}summary{cursor:pointer;font-size:12px}pre{background:#a9a9a9;border-radius:6px;padding:8px;overflow:auto;font-size:11px;max-height:220px}'
    + `</style></head><body><h1>${esc(name)}: colour</h1><p>Each row is the same small landscape in one colouring, the game's cast standing on its ground and its foliage. The number under a figure is how far it sits from them (OKLab): under ${FIGURE_MIN}, in red, it sinks into the land. The machine measures; whether a row reads as this game is yours to see.</p>`
    + `${rows.join('')}${R.options.length ? '' : '<p class="spec">Nothing here would change it: its cast is painted against its land, and it is laid in every direction it can take.</p>'}${unread}${R.recommend ? `<p class="spec">The machine's pick is the first row under which the figure laws hold with the fewest palette laws advising: ${esc(R.why)}.</p>` : ''}</body></html>`;
}
