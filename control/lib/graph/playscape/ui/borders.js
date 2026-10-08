/**
 * STYLIZED BORDERS — art laid over a part's frame: tendrils at the corners, brackets, corner ticks, a hazard band,
 * scanlines, a dot grid, a notch, a stitch, a glow. The frame dial (register.js) says how heavy the edge is; a border
 * says what is drawn on and around it. Borders are composed from ELEMENTS, and a FLAVOR is a named set of elements
 * plus the face, the dials and the tint that go with them:
 *
 *   covert        thin brackets, scanlines, corner ticks; a mono face; a radio-green tint; snapped motion
 *   futurepunk    corner ticks, a notch, a dot grid, a glow; a clean sans; a cyan tint; eased motion
 *   mech-cockpit  a hazard band, a side bar, a notch; a heavy display face; a warning-orange tint; stepped motion
 *   cozy          a soft edge, a stitch, vine tendrils; a serif face; a warm tint; eased motion
 *
 * Elements draw in the guide's tokens only (line, accent, accent2, bg), so colour stays the guide's: the black-and-
 * white law holds, and a flavor's tint is a token proposal recorded with its source, never paint in the art.
 *
 *   BORDER_ELEMENTS        element → { slot, about } (a slot holds one element, except the stacking bg and shadow)
 *   BORDER_FLAVORS         flavor → { elements, font, dials, tint, about }
 *   readBorder(b)          a border word or { flavor?, elements?, tint? } → { flavor, elements, tint } (throws, teaching)
 *   PIXEL_SIZES            the pixelated tuning: 0 (off) or the pixel size in CSS px
 *   borderCss(r, scope)    THE DOM BACKEND for borders and the pixel tuning: closed words in, CSS out
 */
import { PLATE_LAYER } from './register.js';

const SVG = (d, t = '') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><g${t ? ` transform='${t}'` : ''} fill='none' stroke='#000' stroke-width='1.6' stroke-linecap='round'><path d='${d}'/></g></svg>`)}")`;
// one vine curling out of a corner, mirrored to the other three
const VINE = 'M2 22 C2 12 6 6 14 4 M6 14 C3 11 4 8 7 8 M10 7 C10 4 13 3 15 5 M2 22 C5 20 8 21 9 23';
const CORNERS = [['top left', ''], ['top right', 'translate(24 0) scale(-1 1)'], ['bottom left', 'translate(0 24) scale(1 -1)'], ['bottom right', 'translate(24 24) scale(-1 -1)']];

export const BORDER_ELEMENTS = Object.freeze({
  ticks: { slot: 'bg', about: 'corner ticks: an L at each corner in the accent' },
  scanlines: { slot: 'bg', about: 'fine horizontal scanlines over the plate' },
  dotgrid: { slot: 'bg', about: 'a faint dot grid on the plate' },
  hazard: { slot: 'bg', about: 'a diagonal hazard band along the top edge, in the second accent' },
  sidebar: { slot: 'bg', about: 'a heavy bar down the left edge, in the second accent' },
  brackets: { slot: 'before', about: 'thin brackets either side, standing off the edge' },
  tendrils: { slot: 'after', about: 'vines curling out of the four corners, in the line colour' },
  notch: { slot: 'clip', about: 'two opposite corners cut away' },
  stitch: { slot: 'outline', about: 'a dashed stitch just inside the edge' },
  glow: { slot: 'shadow', about: 'a soft outer and inner glow in the accent (inner only under a notch)' },
  soft: { slot: 'shadow', about: 'round corners and a soft lower bevel' },
});
export const ELEMENT_IDS = Object.keys(BORDER_ELEMENTS);
const STACKING = new Set(['bg', 'shadow']);

export const BORDER_FLAVORS = Object.freeze({
  covert: {
    about: 'the field radio: thin brackets, scanlines, corner ticks, a mono face, a radio-green tint',
    elements: ['brackets', 'scanlines', 'ticks'], font: 'mono', dials: { motion: 'snap', frame: 'hairline', plate: 'solid' },
    tint: { panel: '#06140c', bg: '#030a06', line: '#3c8a52', ink: '#c8f5d0', accent: '#7dff9a', accent2: '#e8d36a' },
  },
  futurepunk: {
    about: 'the net-dive overlay: corner ticks, a cut notch, a dot grid, a glow, a clean sans, a cyan tint',
    elements: ['ticks', 'notch', 'dotgrid', 'glow'], font: 'system', dials: { motion: 'ease', frame: 'hairline', plate: 'flat' },
    tint: { panel: '#071a24', bg: '#020b10', line: '#2f7f99', ink: '#e6fbff', accent: '#4de8ff', accent2: '#ff4d8a' },
  },
  'mech-cockpit': {
    about: 'the pilot\'s warning screen: a hazard band, a side bar, a notch, a heavy display face, a warning-orange tint',
    elements: ['hazard', 'sidebar', 'notch'], font: 'display', dials: { motion: 'stepped', frame: 'rule', plate: 'solid' },
    tint: { panel: '#140904', bg: '#070302', line: '#ff7a1a', ink: '#ffe2c4', accent: '#ff5a1a', accent2: '#ffd400' },
  },
  cozy: {
    about: 'the hearth: a soft edge, a stitch, vine tendrils, a serif face, a warm tint',
    elements: ['soft', 'stitch', 'tendrils'], font: 'serif', dials: { motion: 'ease', frame: 'hairline', plate: 'solid' },
    tint: { panel: '#3a2a20', bg: '#22170f', line: '#c99a6a', ink: '#fff1df', accent: '#ffb35c', accent2: '#8fc46a' },
  },
});
export const FLAVOR_IDS = Object.keys(BORDER_FLAVORS);
export const PIXEL_SIZES = Object.freeze([0, 2, 3, 4]);

/** A border (a flavor word, or { flavor?, elements?, tint? }) → { flavor, elements, tint }. */
export function readBorder(b, where = 'play.ui.border') {
  if (b === undefined || b === null || b === 'none') return null;
  const o = typeof b === 'string' ? { flavor: b } : b;
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error(`${where} is a flavor (${FLAVOR_IDS.join(', ')}) or { flavor?, elements?, tint? }`);
  if (o.flavor !== undefined && !FLAVOR_IDS.includes(o.flavor)) throw new Error(`${where}.flavor is one of: ${FLAVOR_IDS.join(', ')}`);
  const F = o.flavor ? BORDER_FLAVORS[o.flavor] : null;
  const elements = o.elements !== undefined ? o.elements : F ? F.elements : [];
  if (!Array.isArray(elements) || !elements.every((e) => ELEMENT_IDS.includes(e))) throw new Error(`${where}.elements are drawn from: ${ELEMENT_IDS.join(', ')}`);
  const taken = {};
  for (const e of elements) {
    const s = BORDER_ELEMENTS[e].slot;
    if (!STACKING.has(s) && taken[s]) throw new Error(`${where}: ${taken[s]} and ${e} both draw the ${s}; keep one`);
    taken[s] = e;
  }
  // a notch clips everything outside the box: brackets and tendrils stand there, so they cannot share it (a glow can:
  // under a notch it draws inside only)
  if (taken.clip && (taken.before || taken.after)) throw new Error(`${where}: notch cuts the corners away, so it cannot carry ${[taken.before, taken.after].filter(Boolean).join(' or ')} (they stand off the edge)`);
  return { flavor: o.flavor || null, elements: [...new Set(elements)], tint: o.tint !== false && !!F };
}

/** A pixel size (0 off). */
export function readPixel(p, where = 'play.ui.pixel') {
  if (p === undefined || p === false) return 0;
  if (p === true) return 3;
  if (!PIXEL_SIZES.includes(p)) throw new Error(`${where} is ${PIXEL_SIZES.join(', ')} (0 off; else the pixel size) or true`);
  return p;
}

/** A border as received on the page (a hand-poked events.register): only known elements and a known size survive. */
export function cleanBorder(r) {
  const els = r && Array.isArray(r.border) ? r.border.filter((e) => ELEMENT_IDS.includes(e)) : [];
  return { elements: [...new Set(els)], pixel: r && PIXEL_SIZES.includes(r.pixel) ? r.pixel : 0 };
}

const mix = (v, pct) => `color-mix(in srgb,var(--moj-${v}) ${pct}%,transparent)`;
const fill = (v) => `linear-gradient(var(--moj-${v}),var(--moj-${v}))`;
const BG = {
  ticks: (n) => { const t = n ? 2 * n : 2, l = n ? 4 * n : 9; return ['top left', 'top right', 'bottom left', 'bottom right'].flatMap((p) => [`${fill('accent')} ${p}/${l}px ${t}px no-repeat`, `${fill('accent')} ${p}/${t}px ${l}px no-repeat`]); },
  scanlines: (n) => [`repeating-linear-gradient(0deg,${mix('bg', 45)} 0 ${n || 1}px,transparent ${n || 1}px ${n ? 2 * n : 3}px)`],
  dotgrid: (n) => [`radial-gradient(${mix('line', 55)} ${n ? n / 2 : 0.8}px,transparent ${n ? n / 2 + 0.01 : 1.2}px) 0 0/${n ? 3 * n : 7}px ${n ? 3 * n : 7}px`],
  hazard: (n) => [`repeating-linear-gradient(-45deg,var(--moj-accent2) 0 ${n ? 2 * n : 5}px,var(--moj-bg) ${n ? 2 * n : 5}px ${n ? 4 * n : 10}px) top/100% ${n ? 2 * n : 5}px no-repeat`],
  sidebar: (n) => [`${fill('accent2')} left/${n ? 2 * n : 6}px 100% no-repeat`],
};

/**
 * The dom backend's sheet for borders and the pixel tuning over the plate `plate` (the register's plate dial: the
 * border's background layers stack over it). Laid after registerCss, so it wins where they meet.
 */
export function borderCss({ elements = [], pixel = 0, plate = 'flat' } = {}, scope = '.moj-hud') {
  const w = `${scope} .moj-w`, n = PIXEL_SIZES.includes(pixel) ? pixel : 0, has = (e) => elements.includes(e), rules = [];
  const P = PLATE_LAYER[plate] || PLATE_LAYER.flat;
  const layers = elements.filter((e) => BG[e]).flatMap((e) => BG[e](n));
  if (layers.length) rules.push(`${w}{background:${[...layers, P.img || 'none'].join(',')} ${P.color};position:relative}`);
  if (has('sidebar')) rules.push(`${w}{padding-left:${n ? 3 * n + 8 : 14}px}`);
  if (has('hazard')) rules.push(`${w}{padding-top:${n ? 2 * n + 6 : 10}px}`);
  const shadows = [];
  if (has('glow')) shadows.push(has('notch') ? `inset 0 0 ${n ? 0 : 10}px ${n ? `${n}px ` : ''}${mix('accent', 35)}` : n ? `0 0 0 ${n}px ${mix('accent', 60)}` : `0 0 10px ${mix('accent', 45)},inset 0 0 8px ${mix('accent', 22)}`);
  if (has('soft')) shadows.push(`inset 0 -${n || 3}px 0 ${mix('bg', 55)}`);
  if (shadows.length) rules.push(`${w}{box-shadow:${shadows.join(',')}}`);
  if (has('soft')) rules.push(`${w}{border-radius:${n ? 0 : 14}px}`);
  if (has('stitch')) rules.push(`${w}{outline:${n || 1.5}px dashed ${mix('line', 80)};outline-offset:-${n ? 2 * n : 5}px}`);
  if (has('notch')) { const c = n ? 3 * n : 9; rules.push(`${w}{border-radius:0;clip-path:polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))}`); }
  if (has('brackets')) rules.push(`${w}{position:relative;overflow:visible}${w}::before{content:'';position:absolute;inset:-4px -7px;border:${n || 1.5}px solid var(--moj-accent);-webkit-mask:${fill('bg')} left/9px 100% no-repeat,${fill('bg')} right/9px 100% no-repeat;mask:${fill('bg')} left/9px 100% no-repeat,${fill('bg')} right/9px 100% no-repeat;pointer-events:none}`);
  if (has('tendrils')) {
    const m = CORNERS.map(([pos, t]) => `${SVG(VINE, t)} ${pos}/22px 22px no-repeat`).join(',');
    rules.push(`${w}{position:relative;overflow:visible}${w}::after{content:'';position:absolute;inset:-11px;background:var(--moj-line);-webkit-mask:${m};mask:${m};pointer-events:none}`);
  }
  if (n) {
    // pixelated: no smoothing, hard edges, stepped corners, integer strokes, stepped motion (the guide gives it the mono face)
    // the stepped corners clip, so they give way to anything that stands off the edge
    if (!['notch', 'brackets', 'tendrils', 'glow'].some(has)) rules.push(`${w}{border-radius:0;clip-path:polygon(${n}px 0,calc(100% - ${n}px) 0,calc(100% - ${n}px) ${n}px,100% ${n}px,100% calc(100% - ${n}px),calc(100% - ${n}px) calc(100% - ${n}px),calc(100% - ${n}px) 100%,${n}px 100%,${n}px calc(100% - ${n}px),0 calc(100% - ${n}px),0 ${n}px,${n}px ${n}px)}`);
    rules.push(`${w}{-webkit-font-smoothing:none;font-smooth:never;text-rendering:optimizeSpeed;image-rendering:pixelated;text-shadow:none;border-width:${n}px;letter-spacing:1px}`);
    rules.push(`${w}-bar .moj-track{border-radius:0;height:${2 * n + 2}px}${w}-bar .moj-fill{transition-timing-function:steps(${2 * n},end)}`);
  }
  return rules.join('');
}
