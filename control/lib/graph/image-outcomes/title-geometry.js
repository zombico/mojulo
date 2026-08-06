/**
 * title-geometry — lay a line of text out as a vector OUTLINE fitted into a
 * rectangle, host-font-independent.
 *
 * mojulo designs cover text as geometry: the carve kernel (glyph-carver
 * layoutText) turns a shelf face + a string into positioned contours (em space,
 * y UP, run centred on x=0; counters are extra rings drawn evenodd). This module
 * fits that run into a target zone (canvas px, y DOWN) and emits it three ways —
 * the three title realizers share ONE geometry:
 *   - flat    → `titleSvgPath` fills the outline (this module)
 *   - carved  → the same contours feed effects/carved-solid extrudeProfile
 *   - painted → the same contours draw the control image the worker paints onto
 *
 * Pure: no fs beyond the font shelf's own load, no sharp. Returns SVG fragments.
 */
import { layoutText, CARVE_STYLES } from '../../motion/glyph-carver.js';
import { loadFace, DEFAULT_TITLE_FACE } from './fonts/font-shelf.js';

const r2 = (n) => Math.round(n * 100) / 100;

function bboxOf(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const [x, y] of r) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: (maxX - minX) || 1, h: (maxY - minY) || 1 };
}

function resolveStyle(style = {}) {
  const preset = style.preset && CARVE_STYLES[style.preset] ? CARVE_STYLES[style.preset] : {};
  return { ...preset, ...style };
}

/**
 * Lay `text` out in `face` and fit it into `zone` (canvas px). Returns the
 * positioned contour rings in SCREEN coords (y down) plus the fit transform —
 * the shared substrate the flat/carved/painted realizers all build on.
 *
 * @param {string} text
 * @param {{ face?: string, style?: object }} opts
 * @param {{ x:number, y:number, w:number, h:number }} zone
 * @param {{ fill?: number, align?: 'left'|'center'|'right', valign?: 'top'|'middle'|'bottom' }} [place]
 * @returns {{ rings: Array<Array<[number,number]>>, block: {w,h,x,y}, scale:number }}
 */
export function fitTextToZone(text, opts, zone, place = {}) {
  const { face = DEFAULT_TITLE_FACE, style = {} } = opts || {};
  const { fill = 0.9, align = 'center', valign = 'middle' } = place;
  const font = loadFace(face);
  const st = resolveStyle(style);
  const { glyphs } = layoutText(font, String(text ?? ''), st);
  const emRings = glyphs.flatMap((g) => g.contours);
  if (!emRings.length) return { rings: [], block: { w: 0, h: 0, x: zone.x, y: zone.y }, scale: 0 };

  const b = bboxOf(emRings);
  const scale = Math.min((zone.w * fill) / b.w, (zone.h * fill) / b.h);
  const blockW = b.w * scale, blockH = b.h * scale;
  const originX = align === 'left' ? zone.x
    : align === 'right' ? zone.x + zone.w - blockW
    : zone.x + (zone.w - blockW) / 2;
  const originY = valign === 'top' ? zone.y
    : valign === 'bottom' ? zone.y + zone.h - blockH
    : zone.y + (zone.h - blockH) / 2;
  // em is y-UP with the block's top at b.maxY; screen is y-DOWN from originY.
  const rings = emRings.map((ring) => ring.map(([x, y]) => [
    r2(originX + (x - b.minX) * scale),
    r2(originY + (b.maxY - y) * scale),
  ]));
  return { rings, block: { w: blockW, h: blockH, x: originX, y: originY }, scale };
}

/** The contour rings as one SVG path `d` (evenodd handles letter counters). */
export function ringsToPathD(rings) {
  return rings
    .map((ring) => (ring.length ? `M${ring.map((p) => `${p[0]} ${p[1]}`).join('L')}Z` : ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * The FLAT title realizer: `text` fitted into `zone` as a filled `<path>`.
 * @returns {string} an SVG `<path>` fragment (place inside an <svg>).
 */
export function titleSvgPath(text, opts, zone, place = {}) {
  const { rings } = fitTextToZone(text, opts, zone, place);
  if (!rings.length) return '';
  const d = ringsToPathD(rings);
  const fill = opts?.fill || '#111111';
  const stroke = opts?.stroke
    ? ` stroke="${opts.stroke}" stroke-width="${opts.strokeWidth ?? 2}"`
    : '';
  const opacity = opts?.opacity != null ? ` opacity="${opts.opacity}"` : '';
  return `<path d="${d}" fill="${fill}" fill-rule="evenodd"${stroke}${opacity}/>`;
}
