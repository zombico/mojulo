/**
 * THE GEOTOWN'S SHEET — the town map first: the design drawn from above as its surfaces, each in its own colour, every
 * plot's pad shaded by its height over the town's lowest, the block names on the board, the crossings' heights, and the
 * ledger (every surface's square metres and share) with the laws' verdicts beside it. The plan judged as a plan, before
 * anything is built: the eyes gate is the operator's.
 *
 *   SURFACE_COLOURS              the sheet's colour for each surface
 *   geotownSheet(design, { px? }) → an SVG document (a string), `px` pixels a metre (2 by default)
 */
import { SURFACE_IDS, SURFACES } from './pattern.js';

export const SURFACE_COLOURS = Object.freeze({
  road: '#5d6066', verge: '#8fbf6a', walk: '#d9d4c8', front: '#a9d48a', path: '#c8b9a0', house: '#b5543c',
  side: '#cfc6b4', back: '#7fb35e', park: '#5e9e4a', 'park-path': '#d8caa8', furnish: '#bfae94', service: '#8e8a84', drive: '#a89a86', parking: '#77797e',
  grounds: '#8cc46c', field: '#4f9a3c', court: '#4f7f6a', track: '#b5583f', infield: '#c09468', play: '#9a7a58',
});
// a building's footprint by its row's kind
const KIND_COLOURS = Object.freeze({ houses: '#b5543c', shops: '#6a4a8c', apartments: '#3c6a8c', garage: '#7a6a58', mansion: '#c08a1e', school: '#8c3c4a', fieldhouse: '#7a6a58', pavilion: '#7a6a58' });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (v) => Math.round(v * 10) / 10;
const hex = (c) => c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** The sheet: the map, north up, and its ledger. */
export function geotownSheet(d, { px = 2 } = {}) {
  const { W, D } = d.frame, pad = 24, side = 300, w = Math.ceil(W * px) + 2 * pad, h = Math.ceil(D * px) + 2 * pad;
  const X = (x) => r1(pad + x * px), Y = (y) => r1(pad + (D - y) * px);
  const rect = (r, fill, extra = '') => `<rect x="${X(r[0])}" y="${Y(r[3])}" width="${r1((r[2] - r[0]) * px)}" height="${r1((r[3] - r[1]) * px)}" fill="${fill}"${extra}/>`;
  const pads = d.plots.map((p) => p.pad), lo = Math.min(...pads, d.land.range[0]), hi = Math.max(...pads, lo + 1);
  // a plot's yards shaded by its pad: lighter the higher it stands
  const shade = (hexc, z) => `#${hex(rgb(hexc).map((v) => v * (0.82 + 0.3 * ((z - lo) / (hi - lo)))))}`;
  const padOf = new Map(d.plots.map((p) => [p.id, p.pad]));
  const body = [];
  // (a site's track's corners under its track, its track under its turf: the drawn order of what overlaps)
  const order = (s) => (s.what === 'corners' ? 0 : s.what === 'track' ? 1 : s.inside && s.area !== undefined ? 3 : 2);
  for (const s of d.surfaces.slice().sort((a, b) => order(a) - order(b))) {
    if (s.cls === 'path') continue;
    const z = s.plot ? padOf.get(s.plot) : null;
    body.push(rect(s.rect, s.cls === 'house' ? KIND_COLOURS[s.mansion ? 'mansion' : s.kind] ?? SURFACE_COLOURS.house : z !== null && z !== undefined ? shade(SURFACE_COLOURS[s.cls], z) : SURFACE_COLOURS[s.cls]));
  }
  // the paths over the front yards they cross, and each plot's lines
  for (const s of d.surfaces) if (s.cls === 'path') body.push(rect(s.rect, SURFACE_COLOURS.path));
  for (const p of d.plots) body.push(rect(p.rect, 'none', ` stroke="#3b4a30" stroke-width="0.5" stroke-opacity="${p.built ? 0.55 : 0.25}"${p.built ? '' : ' stroke-dasharray="2 2"'}`));
  // the blocks: their names, an unbuilt one hatched
  for (const b of d.blocks) {
    const cx = (b.rect[0] + b.rect[2]) / 2, cy = (b.rect[1] + b.rect[3]) / 2;
    if (!b.built) body.push(rect(b.rect, '#ffffff', ' fill-opacity="0.35"'));
    body.push(`<text x="${X(cx)}" y="${Y(cy)}" font-size="${Math.max(12, 9 * px)}" font-family="sans-serif" font-weight="700" fill="#ffffff" fill-opacity="0.9" stroke="#24301c" stroke-width="0.6" text-anchor="middle" dominant-baseline="middle">${esc(b.id)}${b.use && b.use !== 'houses' ? ` · ${esc(b.use)}` : ''}${b.built ? '' : ' · unbuilt'}</text>`);
  }
  // the main streets, named along their line
  for (const s of d.streets.filter((x) => x.rank === 'main')) body.push(`<text x="${X(s.axis === 'x' ? 8 : s.at)}" y="${Y(s.axis === 'x' ? s.at : 8)}" font-size="${Math.max(10, 4.5 * px)}" font-family="sans-serif" font-weight="700" fill="#ffe9a8" dominant-baseline="middle"${s.axis === 'y' ? ` transform="rotate(-90 ${X(s.at)} ${Y(8)})"` : ''}>main street</text>`);
  // each crossing's height, the streets' ground there
  for (const x of d.X) for (const y of d.Y) body.push(`<text x="${X(x)}" y="${Y(y)}" font-size="${Math.max(9, 4 * px)}" font-family="sans-serif" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${r1(d.land.S(x, y))}</text>`);
  // the ledger
  const L = d.ledger, rows = SURFACE_IDS.map((k) => [k, L.town[k], L.town[k] / (L.total || 1)]);
  const lx = w + 12, line = (i) => pad + 18 * i;
  const led = [`<text x="${lx}" y="${line(0)}" font-size="14" font-weight="700" font-family="sans-serif">${esc(d.pattern.id)} · ${esc(d.spec.evoke)} · ${d.spec.grid.join(' × ')} blocks · ${d.plots.length} plots</text>`,
    `<text x="${lx}" y="${line(1)}" font-size="11" font-family="sans-serif" fill="#555">${r1(W)} × ${r1(D)} m · ${Math.round(L.total)} m² · the land ${d.land.range.join('–')} m</text>`];
  rows.forEach(([k, a, s], i) => {
    led.push(`<rect x="${lx}" y="${line(i + 2) - 10}" width="12" height="12" fill="${SURFACE_COLOURS[k]}"/>`);
    led.push(`<text x="${lx + 18}" y="${line(i + 2)}" font-size="12" font-family="sans-serif">${esc(k)}${SURFACES[k].grows.length ? '' : ' (bare)'}</text><text x="${lx + side - 20}" y="${line(i + 2)}" font-size="12" font-family="sans-serif" text-anchor="end">${Math.round(a)} m² · ${(s * 100).toFixed(1)} %</text>`);
  });
  d.laws.forEach((l, i) => led.push(`<text x="${lx}" y="${line(rows.length + 3 + i)}" font-size="11" font-family="sans-serif" fill="${l.ok ? '#2d6a2d' : '#a33'}">${l.ok ? '✓' : '·'} ${esc(l.law)}: ${esc(l.value)}</text>`));
  const total = w + side + 340;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${Math.max(h, line(rows.length + 4 + d.laws.length))}" viewBox="0 0 ${total} ${Math.max(h, line(rows.length + 4 + d.laws.length))}"><rect width="100%" height="100%" fill="#f4f1ea"/>${body.join('')}${led.join('')}</svg>`;
}
