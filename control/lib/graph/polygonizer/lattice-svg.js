/**
 * The lattice as a plan: one SVG, looking straight down mandala-space (north up). Cells are their corners' polygon;
 * corners and edges, the places a settlement or a road stands, show when asked. Pure string, the same bytes for the
 * same board and options.
 *
 *   latticeSvg(L, { px?, names?, corners?, edges?, fills?, types?, palette?, highlight?, title? }) → svg
 *     px pixels a metre (48); names the cells' names (true); corners / edges dots and strokes (false)
 *     fills { <cell name>: colour } over types { <type>: colour } over the palette, in turn by the lattice's colouring
 *     (two on a square, the chessboard's; three on a hex, so no two neighbours match)
 *     highlight { cells, corners, edges: [names] } drawn over the rest; ids: each cell's polygon carries data-cell (its
 *     index), for a page that plays on it
 *     A raised cell is lighter by its height, so a height reads in plan.
 */

import { address } from './lattice.js';

// A square's first colour is A1's, dark as on a chessboard.
export const SQUARE_PALETTE = ['#9a7350', '#e8d9b8'];
export const HEX_PALETTE = ['#c9c08f', '#b3aa78', '#9e9566'];
const INK = '#3a2f24', MARK = '#d2452f';

const f2 = (x) => String(Math.round(x * 100) / 100 || 0);

function shade(hex, k) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v + (255 - v) * k))).toString(16).padStart(2, '0')).join('')}`;
}

function escapeXml(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

/** The lattice's own colouring: a square's two (c + r), a hex's three (q - r mod 3). */
export function latticeColour(L, i) {
  const [a, b] = L.cells[i].v;
  return L.shape === 'square' ? (((a + b) % 2) + 2) % 2 : (((a - b) % 3) + 3) % 3;
}

/** The plan's frame: its size in pixels and where a world point lands on it, as latticeSvg draws. */
export function latticeSvgFrame(L, opts = {}) {
  const px = opts.px ?? 48, pad = 0.35 * L.cell * px;
  const xs = L.corners.map((c) => c.at[0]), ys = L.corners.map((c) => c.at[1]);
  const x0 = Math.min(...xs), y1 = Math.max(...ys);
  return { px, pad, x0, y1, W: L.size[0] * px + 2 * pad, H: L.size[1] * px + 2 * pad };
}

export function latticeSvg(L, opts = {}) {
  const { px, pad, x0, y1, W, H } = latticeSvgFrame(L, opts);
  const palette = opts.palette ?? (L.shape === 'square' ? SQUARE_PALETTE : HEX_PALETTE);
  const fills = opts.fills ?? {}, types = opts.types ?? {};
  const sx = (x) => f2((x - x0) * px + pad), sy = (y) => f2((y1 - y) * px + pad);
  const hMax = Math.max(1, ...L.cells.map((c) => c.h));
  const pick = (kind, list) => new Set((list ?? []).map((n) => address(L, n)).filter((a) => a?.kind === kind).map((a) => a.i));
  const hl = opts.highlight ?? {};
  const hlCells = pick('cell', hl.cells), hlCorners = pick('corner', hl.corners), hlEdges = pick('edge', hl.edges);

  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(W)} ${f2(H)}" width="${f2(W)}" height="${f2(H)}">`);
  if (opts.title) out.push(`<title>${escapeXml(opts.title)}</title>`);
  out.push(`<g stroke="${INK}" stroke-width="${f2(Math.max(1, px / 40))}" stroke-linejoin="round">`);
  L.cells.forEach((cl, i) => {
    const base = fills[cl.name] ?? types[cl.type] ?? palette[latticeColour(L, i) % palette.length];
    const fill = cl.h > 0 ? shade(base, 0.35 * (cl.h / hMax)) : base;
    const pts = cl.k.map((k) => `${sx(L.corners[k].at[0])},${sy(L.corners[k].at[1])}`).join(' ');
    out.push(`<polygon points="${pts}" fill="${fill}"${opts.ids ? ` data-cell="${i}"` : ''}${hlCells.has(i) ? ` stroke="${MARK}" stroke-width="${f2(px / 12)}"` : ''}><title>${cl.name}</title></polygon>`);
  });
  out.push('</g>');
  if (opts.edges || hlEdges.size) {
    out.push(`<g stroke-linecap="round">`);
    L.edges.forEach((ed, i) => {
      if (!opts.edges && !hlEdges.has(i)) return;
      const [a, b] = ed.ends.map((k) => L.corners[k].at);
      const on = hlEdges.has(i);
      out.push(`<line x1="${sx(a[0])}" y1="${sy(a[1])}" x2="${sx(b[0])}" y2="${sy(b[1])}" stroke="${on ? MARK : INK}" stroke-width="${f2(px / (on ? 9 : 16))}" stroke-opacity="${on ? 1 : 0.55}"><title>${ed.name}</title></line>`);
    });
    out.push('</g>');
  }
  if (opts.corners || hlCorners.size) {
    out.push('<g>');
    L.corners.forEach((cr, i) => {
      if (!opts.corners && !hlCorners.has(i)) return;
      const on = hlCorners.has(i);
      out.push(`<circle cx="${sx(cr.at[0])}" cy="${sy(cr.at[1])}" r="${f2(px / (on ? 8 : 14))}" fill="${on ? MARK : INK}"><title>${cr.name}</title></circle>`);
    });
    out.push('</g>');
  }
  if (opts.names ?? true) {
    const size = f2(Math.max(8, px * L.cell / 4.5));
    out.push(`<g font-family="ui-monospace, monospace" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${INK}" fill-opacity="0.6">`);
    L.cells.forEach((cl) => out.push(`<text x="${sx(cl.at[0])}" y="${sy(cl.at[1])}">${cl.name}</text>`));
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('\n');
}
