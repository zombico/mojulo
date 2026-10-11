/**
 * structure/sheets/site — C-101, the site plan: the lot, the house on it, what stands around it, the setbacks.
 *
 *   property line   chain-dashed, heavy, the street side named
 *   house           the footprint hatched (the roof plan's outline), with its overall size
 *   site work       drive, path, patio, carport, garage, shed, as projected outlines named in place
 *   setbacks        front, back and both sides dimensioned from the footprint to the property line
 *
 * Present only when the recipe has a lot (`perimeter`); without one the book names the field in Open.
 */

import { n2, esc, makeView, fitScale, dimension, northArrow, scaleBar, titleBlock, drawingTitle, sheetSvg } from './kit.js';

const NAMES = { drive: 'DRIVEWAY', path: 'WALK', patio: 'PATIO', carport: 'CARPORT', garage: 'GARAGE', shed: 'SHED' };

export function siteDrawing(read, view, { units = 'imperial' } = {}) {
  const site = read.site, fp = read.footprint, lot = site.lot;
  const R = (r, cls) => `<rect class="${cls}" x="${n2(view.x(r.x0))}" y="${n2(view.y(r.y0))}" width="${n2(view.len(r.x1 - r.x0))}" height="${n2(view.len(r.y1 - r.y0))}"/>`;
  const out = [];
  // the property line
  out.push(`<rect class="s-grid" style="stroke-width:0.5;stroke-dasharray:8 1.4 1.4 1.4 1.4 1.4" x="${n2(view.x(lot.x0))}" y="${n2(view.y(lot.y0))}" width="${n2(view.len(lot.x1 - lot.x0))}" height="${n2(view.len(lot.y1 - lot.y0))}"/>`);
  // the site work
  for (const k of Object.keys(NAMES)) {
    const r = site[k];
    if (!r) continue;
    out.push(`<g class="s-sitework" data-kind="${k}">${R(r, 's-proj')}<text class="s-ts" text-anchor="middle" x="${n2(view.x((r.x0 + r.x1) / 2))}" y="${n2(view.y((r.y0 + r.y1) / 2) + 0.7)}">${NAMES[k]}</text></g>`);
  }
  // the house: its footprint hatched at 45°
  const hid = 'site-hatch';
  out.push(`<defs><pattern id="${hid}" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="s-dim" x1="0" y1="0" x2="0" y2="2.2"/></pattern></defs>`);
  out.push(`<g class="s-house"><rect fill="url(#${hid})" class="s-cut" x="${n2(view.x(fp.x0))}" y="${n2(view.y(fp.y0))}" width="${n2(view.len(fp.x1 - fp.x0))}" height="${n2(view.len(fp.y1 - fp.y0))}"/>`
    + `<rect class="s-paper" x="${n2(view.x((fp.x0 + fp.x1) / 2) - 16)}" y="${n2(view.y((fp.y0 + fp.y1) / 2) - 4)}" width="32" height="7"/>`
    + `<text class="s-tb" text-anchor="middle" x="${n2(view.x((fp.x0 + fp.x1) / 2))}" y="${n2(view.y((fp.y0 + fp.y1) / 2))}">${esc(String(read.title || 'HOUSE').toUpperCase().slice(0, 18))}</text>`
    + `<text class="s-ts" text-anchor="middle" x="${n2(view.x((fp.x0 + fp.x1) / 2))}" y="${n2(view.y((fp.y0 + fp.y1) / 2) + 2.4)}">${read.storeys.length} STOREY${read.storeys.length > 1 ? 'S' : ''} · ${Math.round(read.schedules.grossArea)} SF</text></g>`);
  // the street, named on its side
  const street = lot.street || '-y';
  const sx = view.x((lot.x0 + lot.x1) / 2);
  const sy = street === '-y' ? view.y(lot.y0) - 6 : view.y(lot.y1) + 8;
  out.push(`<text class="s-th" text-anchor="middle" x="${n2(sx)}" y="${n2(sy)}">STREET</text>`);
  // setbacks: front, back, and both sides, footprint to property line
  // the front and back strings run near the house's west corner, the side strings near its back: clear of the walk,
  // the drive and the carport, which stand at the front and the east
  const cx = fp.x0 + 3, cy = fp.y1 - 3;
  const d = (a, b, ft) => dimension(view.p(a), view.p(b), ft, { offset: 0, units });
  if (fp.y0 - lot.y0 > 0.5) out.push(d([cx + 4, lot.y0], [cx + 4, fp.y0], fp.y0 - lot.y0));
  if (lot.y1 - fp.y1 > 0.5) out.push(d([cx + 4, fp.y1], [cx + 4, lot.y1], lot.y1 - fp.y1));
  if (fp.x0 - lot.x0 > 0.5) out.push(d([lot.x0, cy + 4], [fp.x0, cy + 4], fp.x0 - lot.x0));
  if (lot.x1 - fp.x1 > 0.5) out.push(d([fp.x1, cy + 4], [lot.x1, cy + 4], lot.x1 - fp.x1));
  // the lot overall
  out.push(dimension(view.p([lot.x0, lot.y1]), view.p([lot.x1, lot.y1]), lot.x1 - lot.x0, { offset: -10, units }));
  out.push(dimension(view.p([lot.x1, lot.y1]), view.p([lot.x1, lot.y0]), lot.y1 - lot.y0, { offset: -10, units }));
  return `<g class="s-site">${out.join('')}</g>`;
}

/** C-101: the site plan sheet, or null when the recipe has no lot. → { id, title, scale, svg } */
export function siteSheet(read, { units = 'imperial', project, size = 'ANSI B', revision = null } = {}) {
  if (!read.site || !read.footprint) return null;
  const id = 'C-101', title = 'Site plan';
  const [dx, dy, dw, dh] = titleBlock({ size }).drawing;
  const lot = read.site.lot;
  const margin = 40;
  const scale = fitScale([lot.x1 - lot.x0, lot.y1 - lot.y0], [dw - margin, dh - margin - 16], units);
  const v0 = makeView({ scale });
  const wMm = v0.len(lot.x1 - lot.x0), hMm = v0.len(lot.y1 - lot.y0);
  const view = makeView({ scale, origin: [lot.x0, lot.y0], at: [dx + (dw - wMm) / 2, dy + 14 + Math.max(0, (dh - 30 - hMm) / 2)] });
  const body = [
    siteDrawing(read, view, { units }),
    drawingTitle([dx + 4, dy + dh - 8], { detail: '1', title, scale, sheet: id }),
    northArrow([dx + dw - 12, dy + 14], 0),
    scaleBar([dx + dw - 80, dy + dh - 9], view, units),
  ].join('');
  const block = titleBlock({ size, project: project || read.title || `mojulo ${read.occupancy?.label ?? 'house'}`, title, id, scale, revision });
  return { id, title, scale, svg: sheetSvg({ size, body, block }) };
}
