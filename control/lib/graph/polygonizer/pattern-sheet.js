/**
 * PATTERN SHEET — the 2D face of a pattern garment, at true scale.
 *
 * The same pieces pattern-garment.js sews onto the body, laid flat on a page in centimetres:
 * outline, seam allowance, grain line, notches at the seam ends, the piece's name and what
 * it is cut from, a datum grid and a scale bar. Printed at 100 % it is a sewing pattern; the
 * page is also the atlas layout the image worker paints fabric onto (a later increment).
 *
 * Deterministic: pieces pack in recipe order on shelves, nothing is randomised, and the SVG
 * is a pure function of the report. 1 cm = 10 user units; the root carries `width`/`height`
 * in cm so a browser prints it at size.
 */

import { buildPatternGarment } from './pattern-garment.js';
import { GARMENTS, buildGarment } from './figure-garments.js';
import { buildPosedFigure } from './figure-render.js';
import { manifestGarment } from './figure-outfit.js';

export const SHEET_DEFAULTS = Object.freeze({ page_width_cm: 84, gap_cm: 3, margin_cm: 3, grid_cm: 5 });
const U = 10;   // user units per cm
const r2 = (v) => Math.round(v * 100) / 100;

// Outward offset of a CCW polygon by `d` (the seam allowance): offset every edge, intersect
// neighbours; near-parallel neighbours fall back to the bisector.
export function offsetOutline(pts, d) {
  const n = pts.length, out = [];
  const edge = (i) => { const a = pts[i], b = pts[(i + 1) % n]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return { a, b, nx: dy / l, ny: -dx / l }; };
  for (let i = 0; i < n; i++) {
    const e0 = edge((i - 1 + n) % n), e1 = edge(i);
    const p0 = [e0.a[0] + e0.nx * d, e0.a[1] + e0.ny * d], p1 = [e0.b[0] + e0.nx * d, e0.b[1] + e0.ny * d];
    const q0 = [e1.a[0] + e1.nx * d, e1.a[1] + e1.ny * d], q1 = [e1.b[0] + e1.nx * d, e1.b[1] + e1.ny * d];
    const r = [p1[0] - p0[0], p1[1] - p0[1]], s = [q1[0] - q0[0], q1[1] - q0[1]];
    const den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) { out.push([r2((p1[0] + q0[0]) / 2), r2((p1[1] + q0[1]) / 2)]); continue; }
    const t = ((q0[0] - p0[0]) * s[1] - (q0[1] - p0[1]) * s[0]) / den;
    const x = p0[0] + r[0] * t, y = p0[1] + r[1] * t;
    // a very sharp corner would shoot off: cap the mitre at 3 × d from the vertex
    const v = pts[i], dist = Math.hypot(x - v[0], y - v[1]);
    if (dist > 3 * d) { const k = 3 * d / dist; out.push([r2(v[0] + (x - v[0]) * k), r2(v[1] + (y - v[1]) * k)]); } else out.push([r2(x), r2(y)]);
  }
  return out;
}

/**
 * Lay the pieces of a built pattern garment on a page.
 * @param {object} report  buildPatternGarment(...).report
 * @param {{ page_width_cm?, gap_cm?, margin_cm? }} [opts]
 * @returns {{ width_cm, height_cm, pieces: [{ id, x, y, w, h, outline, allowance, sloper?, chart, mirrorOf?, seamEdges }] }}
 */
export function patternSheetLayout(report, opts = {}) {
  const o = { ...SHEET_DEFAULTS, ...opts };
  const mirrored = new Map();   // mirrored piece id -> source id (drawn once, "cut 2")
  const seamEdges = new Map();
  for (const s of report.seams) { for (const side of [s.a, s.b]) { if (!seamEdges.has(side.piece)) seamEdges.set(side.piece, new Set()); seamEdges.get(side.piece).add(side.edge); } }
  const pieces = [];
  for (const p of report.pieces) {
    if (p.mirrorOf) { mirrored.set(p.id, p.mirrorOf); continue; }
    const allowance = offsetOutline(p.outline, p.allowance_cm ?? 1);
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const [x, y] of allowance) { if (x < xMin) xMin = x; if (x > xMax) xMax = x; if (y < yMin) yMin = y; if (y > yMax) yMax = y; }
    pieces.push({ id: p.id, chart: p.chart, sloper: p.sloper ?? null, outline: p.outline, allowance, edges: p.edges, bbox: { xMin, xMax, yMin, yMax }, w: xMax - xMin, h: yMax - yMin, seamEdges: [...(seamEdges.get(p.id) ?? [])] });
  }
  for (const p of pieces) p.cut = 1 + [...mirrored.values()].filter((src) => src === p.id).length;
  // shelf packing, recipe order, widest pieces first on each shelf is NOT done — order is the recipe's
  const inner = o.page_width_cm - 2 * o.margin_cm;
  let x = o.margin_cm, y = o.margin_cm, shelfH = 0;
  for (const p of pieces) {
    if (x > o.margin_cm && x + p.w > o.margin_cm + inner) { x = o.margin_cm; y += shelfH + o.gap_cm; shelfH = 0; }
    p.x = r2(x); p.y = r2(y);
    x += p.w + o.gap_cm; shelfH = Math.max(shelfH, p.h);
  }
  const height = r2(y + shelfH + o.margin_cm);
  return { width_cm: o.page_width_cm, height_cm: height, pieces: pieces.map((p) => ({ ...p, w: r2(p.w), h: r2(p.h) })) };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const path = (pts, dx, dy) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2((x + dx) * U)} ${r2((y + dy) * U)}`).join(' ') + ' Z';

/**
 * The sheet as SVG at true scale (1 cm = 10 units; width/height in cm on the root).
 * Piece space is y-up; the page is y-down, so each piece is flipped about its own top.
 */
export function patternSheetSvg(layout, { title = 'pattern sheet', stature_cm = null, grid_cm = SHEET_DEFAULTS.grid_cm } = {}) {
  const W = layout.width_cm, H = layout.height_cm;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}cm" height="${H}cm" viewBox="0 0 ${r2(W * U)} ${r2(H * U)}" font-family="Helvetica, Arial, sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${r2(W * U)}" height="${r2(H * U)}" fill="#fff"/>`);
  // datum grid
  parts.push('<g stroke="#dfe6ee" stroke-width="0.6">');
  for (let g = 0; g <= W; g += grid_cm) parts.push(`<line x1="${r2(g * U)}" y1="0" x2="${r2(g * U)}" y2="${r2(H * U)}"/>`);
  for (let g = 0; g <= H; g += grid_cm) parts.push(`<line x1="0" y1="${r2(g * U)}" x2="${r2(W * U)}" y2="${r2(g * U)}"/>`);
  parts.push('</g>');
  // title + scale bar (10 cm)
  parts.push(`<text x="${U * 3}" y="${U * 1.8}" font-size="${U * 1.1}" fill="#1b2430">${esc(title)}${stature_cm ? ` — drafted for ${stature_cm} cm` : ''} — 1 cm = 1 cm at 100 %</text>`);
  parts.push(`<g stroke="#1b2430" stroke-width="1.2"><line x1="${r2((W - 13) * U)}" y1="${U * 1.4}" x2="${r2((W - 3) * U)}" y2="${U * 1.4}"/><line x1="${r2((W - 13) * U)}" y1="${U * 0.9}" x2="${r2((W - 13) * U)}" y2="${U * 1.9}"/><line x1="${r2((W - 3) * U)}" y1="${U * 0.9}" x2="${r2((W - 3) * U)}" y2="${U * 1.9}"/></g>`);
  parts.push(`<text x="${r2((W - 8) * U)}" y="${U * 2.6}" font-size="${U * 0.7}" text-anchor="middle" fill="#1b2430">10 cm</text>`);
  for (const p of layout.pieces) {
    // flip y: page y = p.y + (yMax - y) - ... place the allowance bbox at (p.x, p.y)
    const fx = (x) => x - p.bbox.xMin, fy = (y) => p.bbox.yMax - y;
    const flip = (pts) => pts.map(([x, y]) => [fx(x), fy(y)]);
    const ol = flip(p.outline), al = flip(p.allowance);
    parts.push(`<g data-piece="${esc(p.id)}">`);
    parts.push(`<path d="${path(al, p.x, p.y)}" fill="none" stroke="#7a8794" stroke-width="0.8" stroke-dasharray="4 3"/>`);
    parts.push(`<path d="${path(ol, p.x, p.y)}" fill="#f6f8fa" stroke="#1b2430" stroke-width="1.4"/>`);
    // grain line: vertical through the piece centre, arrowheads both ends
    const cx = (p.bbox.xMin + p.bbox.xMax) / 2, gy0 = p.bbox.yMin + p.h * 0.2, gy1 = p.bbox.yMax - p.h * 0.2;
    const gx = r2((fx(cx) + p.x) * U), y0 = r2((fy(gy1) + p.y) * U), y1 = r2((fy(gy0) + p.y) * U);
    parts.push(`<g stroke="#1b2430" stroke-width="1"><line x1="${gx}" y1="${y0}" x2="${gx}" y2="${y1}"/><path d="M${gx - 6} ${y0 + 9} L${gx} ${y0} L${gx + 6} ${y0 + 9}" fill="none"/><path d="M${gx - 6} ${y1 - 9} L${gx} ${y1} L${gx + 6} ${y1 - 9}" fill="none"/></g>`);
    // notches: a tick at both ends of every seamed edge
    for (const name of p.seamEdges) {
      const e = p.edges?.[name]; if (!e) continue;
      for (const idx of e) {
        const v = p.outline[idx]; if (!v) continue;
        const px = r2((fx(v[0]) + p.x) * U), py = r2((fy(v[1]) + p.y) * U);
        parts.push(`<circle cx="${px}" cy="${py}" r="2.2" fill="#b23a48"/>`);
      }
    }
    // label
    const lx = r2((fx(cx) + p.x) * U), ly = r2((fy((p.bbox.yMin + p.bbox.yMax) / 2) + p.y) * U);
    parts.push(`<text x="${lx}" y="${ly}" font-size="${U * 0.9}" text-anchor="middle" fill="#1b2430">${esc(p.id)}${p.sloper ? ` · ${esc(p.sloper)}` : ''}</text>`);
    parts.push(`<text x="${lx}" y="${ly + U * 1.1}" font-size="${U * 0.65}" text-anchor="middle" fill="#4a5664">cut ${p.cut}${p.cut > 1 ? ' (one mirrored)' : ''} · ${esc(p.chart)} · ${r2(p.w)} × ${r2(p.h)} cm with allowance</text>`);
    parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('\n');
}

/**
 * The sheet for a figure manifest wearing pattern garments — one page per garment spec,
 * stacked. Null when the figure wears none.
 */
export function figurePatternSheetSvg(manifest = {}, opts = {}) {
  const worn = manifestGarment(manifest);
  const list = worn == null ? [] : (Array.isArray(worn) ? worn : [worn]);
  const all = list.map((g) => (g && typeof g === 'object' ? g : GARMENTS[g])).filter(Boolean);
  const isPattern = (s) => Array.isArray(s.pieces) && s.pieces.some((p) => p && p.fit === 'pattern');
  if (!all.some(isPattern)) return null;
  // The designer's rule: the sheet is drafted on the STAND, whatever pose the figure holds —
  // the pattern does not change because the figure moved. Pose-invariant by construction.
  const stacks = buildPosedFigure({}, manifest.proto || {}, null, manifest.fluffs || null, null, null, manifest.proportions || null, 1, manifest.weld || null);
  const body = stacks.filter((s) => s.flesh);
  // The padded form: every layer is worn on the stand in order, so a garment's sheet is drafted
  // over what it is worn over (a jacket's over the shirt's) — the same draft the figure wears.
  const wornStacks = [], pages = [];
  for (const spec of all) {
    const cloth = spec.color?.cloth ?? '#3f6f93';
    if (!isPattern(spec)) { wornStacks.push(...buildGarment(body, spec).filter((g) => !g.id.includes(':under:'))); continue; }
    const { stacks, report } = buildPatternGarment(body, spec, { cloth, under: wornStacks, standUnder: wornStacks });
    wornStacks.push(...stacks);
    const layout = patternSheetLayout(report, opts);
    pages.push({ layout, svg: patternSheetSvg(layout, { title: `${manifest.title ? manifest.title + ' — ' : ''}${spec.id}`, stature_cm: report.stature_cm, ...opts }) });
  }
  if (pages.length === 1) return pages[0].svg;
  // Several garments: ONE document, the pages stacked as nested <svg> at cm offsets (a browser
  // renders only the first root of a concatenation).
  const W = Math.max(...pages.map((p) => p.layout.width_cm)), H = pages.reduce((s, p) => s + p.layout.height_cm, 0);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}cm" height="${r2(H)}cm" viewBox="0 0 ${r2(W * U)} ${r2(H * U)}">`];
  let y = 0;
  for (const p of pages) {
    parts.push(p.svg.replace(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="[^"]*" height="[^"]*"/, `<svg x="0" y="${r2(y * U)}" width="${r2(p.layout.width_cm * U)}" height="${r2(p.layout.height_cm * U)}"`));
    y += p.layout.height_cm;
  }
  parts.push('</svg>');
  return parts.join('\n');
}
