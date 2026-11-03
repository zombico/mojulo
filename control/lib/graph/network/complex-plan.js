/**
 * A COMPLEX'S SITE PLAN for a world's book (gameworld/bible-html.js): each building's ground floor in plan, its name and
 * use, its front door; each passage below grade as a dashed line between the basements it joins; the way a level is
 * played through it (from the building it is entered by to the one it is won in) in the accent. Drawn in
 * `currentColor` and the book's own variables, so a skin recolours it. From the layout alone (network/complex.js).
 *
 *   complexPlanSvg(manifest, width) → an svg string; manifest a stage recipe with `complex` (and its `level`, when played)
 *
 * Pure: the same recipe, the same plan.
 */
import { readComplex, layComplex, complexRoute } from './complex.js';

const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function complexPlanSvg(manifest, width = 300) {
  const C = readComplex(manifest.complex), L = layComplex(C, { built: false });
  const R = manifest.level ? complexRoute(manifest) : null, played = new Set(R && !R.error ? R.hops : []);
  const xs = L.nodes.flatMap((N) => [N.footprint[0], N.footprint[2]]), ys = L.nodes.flatMap((N) => [N.footprint[1], N.footprint[3]]);
  const pad = 6, x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad - 8, y1 = Math.max(...ys) + pad;
  const k = (width - 20) / (x1 - x0), H = r1((y1 - y0) * k + 20);
  // (the plan's north up: world y up the page)
  const X = (x) => r1(10 + (x - x0) * k), Y = (y) => r1(10 + (y1 - y) * k);
  const rooms = L.nodes.flatMap((N) => N.rooms.filter((r) => r.storey === 1).map((r) => `<rect x="${X(r.box.min[0])}" y="${Y(r.box.max[1])}" width="${r1((r.box.max[0] - r.box.min[0]) * k)}" height="${r1((r.box.max[1] - r.box.min[1]) * k)}" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1"/>`)).join('');
  const passages = L.passages.map((t) => `<path d="${t.line.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])} ${Y(p[1])}`).join(' ')}" fill="none" style="stroke:${played.has(t.id) ? 'var(--c-trail, currentColor)' : 'currentColor'}" stroke-width="${played.has(t.id) ? 3 : 1.5}" stroke-dasharray="5 3"/>`).join('');
  const labels = L.nodes.map((N) => {
    const cx = X((N.footprint[0] + N.footprint[2]) / 2), cy = Y(N.footprint[3]) - 4, d = N.door.at, role = R && !R.error ? (N.id === R.from ? ' · in' : N.id === R.to ? ' · goal' : '') : '';
    return `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="10" fill="currentColor">${esc(`${N.id} (${N.use})${role}`)}</text><circle cx="${X(d[0])}" cy="${Y(d[1])}" r="3" fill="currentColor"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="img" aria-label="The complex in plan: its buildings and the passages below them">${rooms}${passages}${labels}</svg>`;
}
