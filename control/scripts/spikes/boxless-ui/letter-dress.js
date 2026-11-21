/**
 * BOXLESS UI, a spike — a game's HUD without its boxes, the decoration moved onto the letters. In a game's own HUD the
 * words are not set on a plate: they carry their plate with them, as a fill that runs top to bottom, a stroke round
 * each letter, a second ring outside it, a shadow dropped hard under it. The box was there to make the words read over
 * a busy picture; a dressed letter reads over it on its own, and the picture is not covered.
 *
 * A LETTER DRESS is the look of the HUD's type, by size:
 *   big     the numbers and names a player reads at a glance (the place, a held item's name, a moment's banner):
 *           its fill (a colour or a gradient), its rings (inside out: [colour, width px]),
 *           its drop (a hard shadow: [colour, dx, dy], or a soft one: [colour, dx, dy, blur]), its extrusion (a stack
 *           of drops a pixel apart: [colour, depth px]), its lean (degrees of skew)
 *   mid     the numbers in a stack (the lap, the times, the speed): the big dress, its rings and drop scaled to the
 *           type (MID), so a small number's counters stay open
 *   small   the labels (lap, time, best, held item, a key): a fill and one ring, enough to read and no more
 *
 * How it is drawn: a gradient fill is the text's own background clipped to its glyphs (CSS), and the rings, the
 * extrusion and the drop are ONE SVG filter a size (each ring the letters' alpha dilated and flooded, merged under
 * them), never `text-shadow` (it paints over a clipped background, covering the gradient) and never a chain of CSS
 * `drop-shadow`s (eight to a ring: too slow to repaint every frame, the first try's lesson).
 *
 *   DRESSES                       { <id>: { says, big, small } }
 *   dressCss(dress, scope)        → the CSS that strips the HUD's plates under `scope` and dresses its type
 *   dressSvg(dress)               → the SVG of its filters, laid once in the page's body
 *
 * A spike: nothing in mana-ui reads this yet (README.md says what it would take).
 */
export const DRESSES = Object.freeze({
  candy: {
    says: 'a candy wrapper: lemon to orange top to bottom, a berry stroke, a cream ring outside it, dropped hard on a dark berry',
    big: { fill: 'linear-gradient(180deg,#fffbe0 0%,#ffe36e 34%,#ffb02e 66%,#ff8a1f 100%)', rings: [['#8c1a4b', 3], ['#fff3e2', 2.5]], drop: ['#4f0d2b', 0, 5] },
    small: { fill: '#fff3e2', rings: [['#8c1a4b', 2]] },
  },
  sticker: {
    says: 'a sticker cut out round the word: berry letters in a fat white edge, a soft shadow under the sheet',
    big: { fill: '#ff3f7f', rings: [['#ffffff', 5]], drop: ['rgba(40,0,20,.45)', 0, 4, 5] },
    small: { fill: '#ffffff', rings: [['#c2185b', 2]] },
  },
  chrome: {
    says: 'polished metal: a sky over a horizon in the letters, a near-black stroke, a hard drop',
    big: { fill: 'linear-gradient(180deg,#ffffff 0%,#e3eaf0 44%,#7d8794 50%,#b9c3cc 72%,#ffffff 100%)', rings: [['#14171c', 3]], drop: ['#000000', 0, 4] },
    small: { fill: '#e3eaf0', rings: [['#14171c', 2]] },
  },
  extrude: {
    says: 'a block letter lifted off the screen: lemon faces on a berry depth, a dark keyline round both, leaning on',
    big: { fill: '#ffd03a', rings: [['#2a0f22', 2]], extrude: ['#c2185b', 6], after: [['#2a0f22', 2]], lean: -8 },
    small: { fill: '#fff3e2', rings: [['#2a0f22', 2]] },
  },
});

const n = (v) => Math.round(v * 100) / 100;
// ONE SVG FILTER a size (a chain of CSS drop-shadows a ring, eight to a ring, was too slow to repaint every frame): each
// ring the letters' alpha dilated by its reach and flooded in its colour, the extrusion that outline stepped a pixel at
// a time, the drop the outermost offset; merged under the letters, the outermost first
function filterSvg(id, d) {
  const parts = [], under = [];
  let reach = 0, k = 0, outer = 'SourceAlpha';
  const flood = (c, of, name) => { parts.push(`<feFlood flood-color="${c}"/><feComposite in2="${of}" operator="in" result="${name}"/>`); };
  for (const [c, w] of d.rings ?? []) { reach += w; const a = `a${k}`, r = `r${k++}`; parts.push(`<feMorphology in="SourceAlpha" operator="dilate" radius="${n(reach)}" result="${a}"/>`); flood(c, a, r); under.unshift(r); outer = a; }
  if (d.extrude) { const [c, depth] = d.extrude, steps = []; for (let i = 1; i <= depth; i++) { const o = `x${i}`; parts.push(`<feOffset in="${outer}" dx="${i}" dy="${i}" result="${o}"/>`); steps.push(`<feMergeNode in="${o}"/>`); } parts.push(`<feMerge result="xa">${steps.join('')}</feMerge>`); flood(c, 'xa', 'xr'); under.unshift('xr'); outer = 'xa'; }
  for (const [c, w] of d.after ?? []) { const a = `b${k}`, r = `q${k++}`; parts.push(`<feMorphology in="${outer}" operator="dilate" radius="${n(w)}" result="${a}"/>`); flood(c, a, r); under.unshift(r); outer = a; }
  if (d.drop) { const [c, dx, dy, blur = 0] = d.drop; parts.push(`<feOffset in="${outer}" dx="${dx}" dy="${dy}" result="do"/>${blur ? `<feGaussianBlur in="do" stdDeviation="${n(blur / 2)}" result="db"/>` : ''}`); flood(c, blur ? 'db' : 'do', 'dr'); under.unshift('dr'); }
  return `<filter id="${id}" x="-25%" y="-40%" width="150%" height="190%" color-interpolation-filters="sRGB">${parts.join('')}<feMerge>${under.map((r) => `<feMergeNode in="${r}"/>`).join('')}<feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}
/** The SVG the dress's filters live in: laid once in the page's body (the CSS names them by id). */
/** A dress at a smaller type: its rings, extrusion and drop scaled to it (a ring the width of a big word's would fill
 *  a small number's counters in, and read as the chip the dress was meant to replace). */
export function scaled(d, k) {
  return { ...d, rings: (d.rings ?? []).map(([c, w]) => [c, n(Math.max(1, w * k))]), ...(d.after ? { after: d.after.map(([c, w]) => [c, n(Math.max(1, w * k))]) } : {}),
    ...(d.extrude ? { extrude: [d.extrude[0], Math.max(1, Math.round(d.extrude[1] * k))] } : {}), ...(d.drop ? { drop: [d.drop[0], n(d.drop[1] * k), n(d.drop[2] * k), n((d.drop[3] ?? 0) * k)] } : {}) };
}
export const MID = 0.5;
export function dressSvg(dress) {
  const D = typeof dress === 'string' ? DRESSES[dress] : dress;
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${filterSvg('mana-dress-big', D.big)}${filterSvg('mana-dress-mid', scaled(D.big, MID))}${filterSvg('mana-dress-small', D.small)}${filterSvg('mana-dress-mark', { rings: [[D.small.rings[0][0], 2]] })}</svg>`;
}
const fillOf = (fill) => (fill.startsWith('linear-gradient') ? `background:${fill};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent` : `color:${fill};-webkit-text-fill-color:${fill};background:none`);

export function dressCss(dress, scope = '.mana-hud') {
  const D = typeof dress === 'string' ? DRESSES[dress] : dress, s = scope, I = '!important';
  const big = `${s} :is(.mana-text[data-role=display],.mana-text[data-role=title],.mana-banner .mana-text)`, mid = `${s} .mana-num`;
  const small = `${s} :is(.mana-text[data-role=label],.mana-label,.mana-max,.mana-caption)`;
  return [
    // the boxes gone: a region, a banner, a dial and a map sit on the picture itself
    `${s} .mana-place>.mana-region,${s} .mana-banner,${s} .mana-gauge,${s} .mana-minimap{background:none${I};border:0${I};box-shadow:none${I};clip-path:none${I};backdrop-filter:none${I};-webkit-backdrop-filter:none${I};outline:0${I}}`,
    `${s} .mana-place>.mana-region::before,${s} .mana-place>.mana-region::after,${s} .mana-banner::before,${s} .mana-banner::after{display:none${I}}`,
    // the type: heavy, its halo off (the dress is its halo), its decoration on the letters
    `${s} :is(.mana-text,.mana-num,.mana-label,.mana-max,.mana-caption){text-shadow:none${I};-webkit-text-stroke:0${I};font-weight:900${I};letter-spacing:.01em}`,
    `${big}{${fillOf(D.big.fill)}${I};filter:url(#mana-dress-big)${I};${D.big.lean ? `display:inline-block;transform:skewX(${D.big.lean}deg);` : ''}padding:0 .08em}`,
    `${mid}{${fillOf(D.big.fill)}${I};filter:url(#mana-dress-mid)${I};padding:0 .06em}`,
    `${small}{${fillOf(D.small.fill)}${I};filter:url(#mana-dress-small)${I};opacity:1${I}}`,
    // what is drawn, not written, takes the small ring: a pictogram, the map's route and its marks, the dial
    `${s} :is(.mana-icon,.mana-minimap,.mana-dial){filter:url(#mana-dress-mark)${I}}`,
    `${s} .mana-trace{background:${D.small.fill.startsWith('#') ? D.small.fill : '#ffffff'}${I};opacity:.9${I}}`,
  ].join('\n');
}
