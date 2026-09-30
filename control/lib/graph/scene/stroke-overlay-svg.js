/**
 * stroke-overlay-svg — a stroke and its residual drawn over a wire SVG.
 *
 * The wire drawing (wire-svg.js) is the view the stroke was drawn in; this adds, inside the same
 * `viewBox`, the stroke as a polyline (its width from pressure) and, for a silhouette that has a
 * residual (silhouette-solve.js), the pixels where the drawn outline and the solid disagree as a band of
 * translucent rects, one per scanline run, so the person sees what was not reached where they drew it.
 * Pure string work; `overlayWireSvg` splices the overlay before the wire's closing tag.
 */
const f1 = (x) => x.toFixed(1);
export const STROKE_STYLE = Object.freeze({ color: '#c8401f', residual: '#c8401f', residualOpacity: 0.28, minWidth: 1.5, maxWidth: 5 });

/** the stroke as SVG: a polyline per pressure band is overkill; one path, width from the mean pressure */
export function strokePathSvg(stroke, size, style = STROKE_STYLE) {
  const pts = stroke.points.map(([x, y]) => [x * size, y * size]);
  const pressure = stroke.points.reduce((s, p) => s + (p[2] ?? 0.5), 0) / stroke.points.length;
  const width = style.minWidth + (style.maxWidth - style.minWidth) * Math.max(0, Math.min(1, pressure));
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)},${f1(y)}`).join(' ') + (stroke.closed || stroke.intent === 'silhouette' ? ' Z' : '');
  return `<path id="stroke-${esc(stroke.id)}" data-stroke-intent="${esc(stroke.intent)}" data-stroke-view="${esc(typeof stroke.view === 'string' ? stroke.view : JSON.stringify(stroke.view))}" d="${d}" fill="none" stroke="${style.color}" stroke-width="${width.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

/** the residual mask (res × res, 1 where the outline and the solid disagree) as scanline-run rects in the view square */
export function residualRectsSvg(mask, res, size, style = STROKE_STYLE) {
  const k = size / res; const out = [];
  for (let j = 0; j < res; j++) {
    let i = 0;
    while (i < res) {
      if (!mask[j * res + i]) { i++; continue; }
      let e = i; while (e < res && mask[j * res + e]) e++;
      out.push(`<rect x="${f1(i * k)}" y="${f1(j * k)}" width="${f1((e - i) * k)}" height="${f1(k)}"/>`); i = e;
    }
  }
  return out.length ? `<g id="residual" fill="${style.residual}" fill-opacity="${style.residualOpacity}" stroke="none">${out.join('')}</g>` : '';
}

/**
 * The resolved points of a stroke as marks: a filled dot where a point hit the solid, a hollow one where it
 * missed, and the mirrored twins (already projected, `[x, y]` in [0, 1]²) as smaller dots joined by a dashed line.
 */
export function hitsSvg(resolved, size, { mirrored = null, style = STROKE_STYLE } = {}) {
  const dot = (x, y, hit, r) => `<circle cx="${f1(x * size)}" cy="${f1(y * size)}" r="${r}" fill="${hit ? style.color : 'none'}" stroke="${style.color}" stroke-width="1.2"/>`;
  const marks = resolved.map((a) => dot(a.x, a.y, !!a.hit, 3.2)).join('');
  let twins = '';
  if (mirrored?.length) {
    const d = mirrored.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x * size)},${f1(y * size)}`).join(' ');
    twins = `<path d="${d}" fill="none" stroke="${style.color}" stroke-width="1.4" stroke-dasharray="4 4" stroke-linecap="round"/>${mirrored.map(([x, y]) => dot(x, y, true, 2.2)).join('')}`;
  }
  return `<g id="stroke-hits">${twins}${marks}</g>`;
}

/** The overlay group for a stroke: its residual band (when given) under the stroke line, hit marks over it, with the numbers as data attributes. */
export function strokeOverlaySvg(stroke, size, { residual = null, resolved = null, mirrored = null } = {}) {
  const attrs = residual ? ` data-iou="${residual.iou}" data-residual-share="${residual.share}"${residual.bbox ? ` data-residual-bbox="${residual.bbox.join(' ')}"` : ''}` : '';
  return `<g id="stroke-overlay"${attrs}>${residual ? residualRectsSvg(residual.mask, residual.res, size) : ''}${strokePathSvg(stroke, size)}${resolved ? hitsSvg(resolved, size, { mirrored }) : ''}</g>`;
}

/** Splice an overlay into a wire SVG string, before its closing tag. */
export function overlayWireSvg(svg, overlay) {
  const at = svg.lastIndexOf('</svg>'); if (at < 0) throw new Error('stroke-overlay-svg: not an svg document');
  return `${svg.slice(0, at)}${overlay}${svg.slice(at)}`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
