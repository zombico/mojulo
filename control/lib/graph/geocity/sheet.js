/**
 * THE GEOCITY'S SHEET — the metro's map first: its water, its arterials (the spine darker), its neighbourhoods, its
 * parks (the city park whole, each neighbourhood's own), its nodes, the region graph's portals, the crossings' heights,
 * and the ledger with the laws' verdicts beside it. The map judged as a map before anything inside it is laid: the eyes
 * gate is the operator's. Two views of one map:
 *
 *   rings      each neighbourhood coloured by the ring it builds as, shaded by its ground's height over the land's lowest
 *   heights    each neighbourhood coloured by its interior's median storeys, each arterial frontage band by its own
 *   blocks     inside each neighbourhood its streets (the collectors darker) and its blocks, each coloured by its
 *              segment, a tower block's towers on it
 *
 *   RING_COLOURS, SEGMENT_COLOURS         the sheet's colour for each ring and each block segment
 *   storeyColour(storeys)                 the heights view's colour for a median (pale low, deep high, on a log scale)
 *   geocitySheet(design, { px?, view?, focus? })  → an SVG document (a string), `px` pixels a metre (0.2 by default),
 *                                           `view` 'rings' (the default), 'heights' or 'blocks', `focus` neighbourhoods'
 *                                           ids: the sheet cropped round them
 */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (v) => Math.round(v * 10) / 10;
const hex = (c) => c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const RING_COLOURS = Object.freeze({ core: '#6a4a8c', frame: '#b5763c', outskirts: '#c9b37a' });
const COLOURS = Object.freeze({ water: '#4f7fa8', arterial: '#5d6066', spine: '#2f3238', park: '#5e9e4a', ground: '#e8e2d4', portal: '#ffffff', seat: '#d8452f', node: '#f2c14e', local: '#8a8d92', collector: '#6e7176' });
// the heights view's scale: from one storey (pale) to sixty (deep), log
const LOW = rgb('#f3ead2'), HIGH = rgb('#2a1f4a');
export const SEGMENT_COLOURS = Object.freeze({ tower: '#3e3266', podium: '#6a5a8e', square: '#e3d8bf', midrise: '#b5763c', slab: '#d9aa74',
  houses: '#c9b37a', 'main-street': '#9a4f7a', edge: '#8c5a3c', lowrise: '#7a8c5a', apartments: '#5a7a8c', school: '#8c3c4a', park: '#5e9e4a' });
export const storeyColour = (n) => { const t = Math.max(0, Math.min(1, Math.log(Math.max(1, n)) / Math.log(60))); return `#${hex(LOW.map((v, i) => v + (HIGH[i] - v) * t))}`; };

export function geocitySheet(d, { px = 0.2, view = 'rings', focus = null } = {}) {
  const { W, D } = d.frame, pad = 24, side = 320;
  // the sheet's bounds: the whole map, or the neighbourhoods in focus and a margin round them
  const ids = focus ? [].concat(focus) : null, inFocus = ids ? d.regions.filter((r) => ids.includes(r.id)) : [];
  const B = inFocus.length ? [Math.max(0, Math.min(...inFocus.map((r) => r.rect[0])) - 40), Math.max(0, Math.min(...inFocus.map((r) => r.rect[1])) - 40), Math.min(W, Math.max(...inFocus.map((r) => r.rect[2])) + 40), Math.min(D, Math.max(...inFocus.map((r) => r.rect[3])) + 40)] : [0, 0, W, D];
  const w = Math.ceil((B[2] - B[0]) * px) + 2 * pad, h = Math.ceil((B[3] - B[1]) * px) + 2 * pad;
  const X = (x) => r1(pad + (x - B[0]) * px), Y = (y) => r1(pad + (B[3] - y) * px);
  const rect = (r, fill, extra = '') => `<rect x="${X(r[0])}" y="${Y(r[3])}" width="${r1((r[2] - r[0]) * px)}" height="${r1((r[3] - r[1]) * px)}" fill="${fill}"${extra}/>`;
  const [lo, hi] = d.land.range, span = hi - lo || 1;
  const shade = (c, z) => `#${hex(rgb(c).map((v) => v * (0.75 + 0.45 * ((z - lo) / span))))}`;
  const body = [`<clipPath id="map"><rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}"/></clipPath><g clip-path="url(#map)">`, rect([0, 0, W, D], COLOURS.ground)];
  for (const wb of d.water) body.push(rect(wb.rect, COLOURS.water));
  const heights = view === 'heights' && d.regions.every((r) => r.storeys), blocks = view === 'blocks' && d.regions.every((r) => r.blocks);
  for (const r of d.regions) body.push(rect(r.rect, r.park ? COLOURS.park : blocks ? COLOURS.local : heights ? storeyColour(r.storeys.median) : shade(RING_COLOURS[r.builds ?? r.ring], r.height)));
  // the blocks view: each neighbourhood's collectors, its blocks by segment, a tower block's towers
  if (blocks) for (const r of d.regions) {
    for (const st of r.streets.filter((x) => x.rank === 'collector')) for (const [a, b] of st.runs) body.push(rect(st.axis === 'ns' ? [st.at - st.w / 2, a, st.at + st.w / 2, b] : [a, st.at - st.w / 2, b, st.at + st.w / 2], COLOURS.collector));
    for (const b of r.blocks) {
      body.push(rect(b.rect, SEGMENT_COLOURS[b.kind] ?? '#999999'));
      for (const t of b.towers ?? []) body.push(rect(t.rect, '#1c1630', ' stroke="#ffffff" stroke-width="0.4"'));
    }
  }
  // the heights view: each arterial frontage its band, coloured by its median
  if (heights) for (const r of d.regions.filter((x) => !x.park)) {
    const depth = d.metro.heights.corridor.depth, [x0, y0, x1, y1] = r.rect;
    for (const [side, f] of Object.entries(r.frontage)) body.push(rect({ w: [x0, y0, x0 + depth, y1], e: [x1 - depth, y0, x1, y1], s: [x0, y0, x1, y0 + depth], n: [x0, y1 - depth, x1, y1] }[side], storeyColour(f.median)));
  }
  if (!blocks) for (const r of d.regions) if (r.parkRect) body.push(rect(r.parkRect.rect, COLOURS.park));
  for (const l of d.lines.filter((x) => x.rank !== 'spine')) body.push(rect(l.rect, COLOURS.arterial));
  for (const l of d.lines.filter((x) => x.rank === 'spine')) body.push(rect(l.rect, COLOURS.spine));
  const font = Math.min(28, Math.max(10, Math.round(110 * px)));
  for (const r of d.regions) body.push(`<text x="${X(r.mid[0])}" y="${Y(r.mid[1])}" font-size="${font}" font-family="sans-serif" font-weight="700" fill="#ffffff" stroke="#24301c" stroke-width="0.5" text-anchor="middle" dominant-baseline="middle">${esc(r.id)}${r.beyond.length ? '›' : ''}${heights && !r.park ? ` ${r1(r.storeys.median)}` : ''}</text>`);
  for (const n of d.heights?.nodes ?? []) { const s = Math.min(14, Math.max(5, 40 * px)), cx = X(n.at[0]), cy = Y(n.at[1]); body.push(`<path d="M${cx} ${r1(cy - s)}L${r1(cx + s)} ${cy}L${cx} ${r1(cy + s)}L${r1(cx - s)} ${cy}Z" fill="${COLOURS.node}" stroke="#24301c" stroke-width="0.8"/>`); }
  for (const e of d.graph.edges) body.push(`<circle cx="${X(e.portal[0])}" cy="${Y(e.portal[1])}" r="${Math.min(7, Math.max(2, 14 * px))}" fill="${COLOURS.portal}" stroke="#24301c" stroke-width="0.5"/>`);
  for (const c of d.crossings) body.push(`<text x="${X(c.at[0])}" y="${Y(c.at[1])}" font-size="${Math.min(16, Math.max(8, Math.round(70 * px)))}" font-family="sans-serif" fill="${c.seat ? COLOURS.seat : '#ffffff'}" text-anchor="middle" dominant-baseline="middle">${r1(c.z)}</text>`);
  body.push(`<circle cx="${X(d.seat[0])}" cy="${Y(d.seat[1])}" r="${Math.min(16, Math.max(4, 30 * px))}" fill="none" stroke="${COLOURS.seat}" stroke-width="2"/>`, '</g>');

  const L = d.ledger, lx = w + 12, line = (i) => pad + 18 * i, pct = (a) => `${r1(a / L.total * 100)}%`;
  const rows = [['water', L.water, COLOURS.water], ['arterials', L.arterials, COLOURS.arterial], ['city parks', L.parks, COLOURS.park],
    ...Object.entries(L.rings).map(([k, a]) => [`${k} neighbourhoods`, a, RING_COLOURS[k]]),
    ...(L.green.placed !== undefined ? [['their parks', L.green.placed, COLOURS.park]] : []),
    ...(blocks ? [['their streets', L.streets, COLOURS.local]] : [])];
  // the blocks view's key: each segment and its count
  const counts = blocks ? d.regions.flatMap((r) => r.blocks).reduce((m, b) => ({ ...m, [b.kind]: (m[b.kind] ?? 0) + 1 }), {}) : {};
  const led = [`<text x="${lx}" y="${line(0)}" font-size="14" font-weight="700" font-family="sans-serif">${esc(d.metro.id)} · ${d.regions.length} neighbourhoods · ${d.lines.length} arterials · ${d.heights?.nodes.length ?? 0} nodes${heights ? ' · storeys' : ''}</text>`,
    `<text x="${lx}" y="${line(1)}" font-size="11" font-family="sans-serif" fill="#555">${W} × ${D} m · the streets' ground ${d.land.range.join('–')} m · falls ${d.metro.fall.drop} m to the ${esc(d.metro.fall.toward)}</text>`];
  rows.forEach(([k, a, c], i) => {
    led.push(`<rect x="${lx}" y="${line(i + 2) - 10}" width="12" height="12" fill="${c}"/>`);
    led.push(`<text x="${lx + 18}" y="${line(i + 2)}" font-size="12" font-family="sans-serif">${esc(k)}</text><text x="${lx + side - 20}" y="${line(i + 2)}" font-size="12" font-family="sans-serif" text-anchor="end">${Math.round(a / 1e4)} ha · ${pct(a)}</text>`);
  });
  Object.entries(counts).forEach(([k, n], i) => {
    const x = lx + (i % 3) * 110, y = line(rows.length + 3 + Math.floor(i / 3));
    led.push(`<rect x="${x}" y="${y - 10}" width="12" height="12" fill="${SEGMENT_COLOURS[k] ?? '#999999'}"/><text x="${x + 16}" y="${y}" font-size="11" font-family="sans-serif">${esc(k)} ${n}</text>`);
  });
  const keyRows = Math.ceil(Object.keys(counts).length / 3) + (Object.keys(counts).length ? 1 : 0);
  d.laws.forEach((l, i) => led.push(`<text x="${lx}" y="${line(rows.length + 3 + keyRows + i)}" font-size="11" font-family="sans-serif" fill="${l.ok ? '#2d6a2d' : '#a33'}">${l.ok ? '✓' : '·'} ${esc(l.law)}: ${esc(l.value)} (${esc(l.want)})</text>`));
  const total = w + side + 420, height = Math.max(h, line(rows.length + 4 + keyRows + d.laws.length));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${height}" viewBox="0 0 ${total} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${body.join('')}${led.join('')}</svg>`;
}
