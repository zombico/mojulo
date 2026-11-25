/**
 * THE BOX, DRAWN (docs/metroidvania-map.md "The greybox"): the elevation of a laid box in greybox, read as a
 * metroidvania's map is read and as a level designer's blockout is: the void of each room in its ring's shade, the
 * closed parts pale, the cell grid over it, and on it what the designer reads:
 *
 *   the spiral     the walk from the gate to the throne, room to room, a number at each room in the order walked,
 *                  its shade deepening ring by ring
 *   the gates      each in its colour and its shape (gates.js): a sill, a grate's bars, a cracked block, a lock, a seal
 *   the way back   the shortcuts dashed, a drop's arrow pointing down it; the loops back to each ring's gate
 *   the rooms      save rooms, bosses, the powers and the key where they are found, the pockets and what they hold
 *   the laws       what the machine gate measured, each held or lost, under the map; the way the box is solved (the
 *                  order its powers come in)
 *
 *   drawBox({ layout, greybox, laws?, solved? }, { width? }) → an SVG document (a string)
 *
 * Pure.
 */
import { GATES } from './gates.js';

const r1 = (v) => Math.round(v * 10) / 10;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const RING_SHADE = ['#2d3340', '#30293c', '#3b2830', '#401f22', '#3a1a2a'];
const RING_LINE = ['#8fa3c8', '#b39ddb', '#e0a1b5', '#f28b82', '#ff6f91'];
const SOLID = '#c9c6bf', LEDGE = '#e4e1d9', GRID = '#ffffff14';

/** The box as a greybox elevation. */
export function drawBox({ layout: L, greybox: G, laws = [], solved }, { width = 1800 } = {}) {
  const W = G.screen.width, H = G.screen.height, [cols, rows] = L.box;
  const left = 40, top = 64, k = (width - left - 40) / (cols * W), mapW = cols * W * k, mapH = rows * H * k;
  const legendH = 40 + 18 * Math.max(laws.length, 6) + (solved ? 40 : 0);
  const Wpx = Math.ceil(left + mapW + 40), Hpx = Math.ceil(top + mapH + 40 + legendH);
  const X = (s) => r1(left + s * k), Y = (z) => r1(top + (rows * H - z) * k);
  const rect = (s0, s1, z0, z1, attrs) => `<rect x="${X(s0)}" y="${Y(z1)}" width="${r1((s1 - s0) * k)}" height="${r1((z1 - z0) * k)}" ${attrs}/>`;
  const room = new Map(L.rooms.map((r) => [r.id, r]));
  const centre = (r) => [(r.rect[0] + r.rect[2] / 2) * W, r.rect[1] * H + 1 + 2.2];
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Wpx}" height="${Hpx}" viewBox="0 0 ${Wpx} ${Hpx}" font-family="Inter, Helvetica, Arial, sans-serif">`);
  o.push(`<rect width="${Wpx}" height="${Hpx}" fill="#0b0c0f"/>`);
  o.push(`<text x="${left}" y="28" fill="#eee" font-size="18" font-weight="600">${esc(L.premise ?? 'A metroidvania box')}</text>`);
  o.push(`<text x="${left}" y="48" fill="#9aa" font-size="12">${cols} × ${rows} screens (a screen ${r1(W)} × ${r1(H)} m), ${(L.shape ?? 'spiral') === 'spiral' ? `walked ${L.turn}; ${L.rooms.length} rooms in ${L.rings.length - 1} rings round a core` : `a ${L.shape}; ${L.rooms.length} rooms in ${L.rings.length} regions`}; greybox</text>`);

  // the voids, by ring
  for (const r of L.rooms) { const [c, rr, w, h] = r.rect; o.push(rect(c * W, (c + w) * W, rr * H, (rr + h) * H, `fill="${RING_SHADE[r.ring % RING_SHADE.length]}"`)); }
  // the cell grid
  for (let c = 0; c <= cols; c++) o.push(`<line x1="${X(c * W)}" y1="${Y(0)}" x2="${X(c * W)}" y2="${Y(rows * H)}" stroke="${GRID}"/>`);
  for (let r = 0; r <= rows; r++) o.push(`<line x1="${X(0)}" y1="${Y(r * H)}" x2="${X(cols * W)}" y2="${Y(r * H)}" stroke="${GRID}"/>`);
  // the closed parts
  for (const s of G.solids) o.push(rect(s.s0, s.s1, s.z0, s.z1, `fill="${s.role === 'ledge' || s.role === 'lip' ? LEDGE : s.role === 'niche' ? '#a9a59c' : SOLID}"`));
  // each ring's place, in its gate room
  for (const R of L.rings) {
    const r = L.rooms.find((x) => x.ring === R.i), [c, rr, , h] = r.rect;
    o.push(`<text x="${X(c * W) + 6}" y="${Y((rr + h) * H) + 16}" fill="${RING_LINE[R.i % RING_LINE.length]}" font-size="12" font-weight="600">${esc(R.place)}</text>`);
  }

  // the gates
  for (const g of G.gates) {
    const C = GATES[g.kind].colour, w = (g.s1 - g.s0) * k, h = (g.z1 - g.z0) * k, x = X(g.s0), y = Y(g.z1);
    if (g.shape === 'grate') {
      o.push(rect(g.s0, g.s1, g.z0, g.z1, `fill="${C}33" stroke="${C}" stroke-width="1.5"`));
      const bars = Math.max(2, Math.round((w > h ? w : h) / 4));
      for (let b = 1; b < bars; b++) o.push(w > h ? `<line x1="${r1(x + (b * w) / bars)}" y1="${y}" x2="${r1(x + (b * w) / bars)}" y2="${r1(y + h)}" stroke="${C}" stroke-width="1.2"/>` : `<line x1="${x}" y1="${r1(y + (b * h) / bars)}" x2="${r1(x + w)}" y2="${r1(y + (b * h) / bars)}" stroke="${C}" stroke-width="1.2"/>`);
    } else if (g.shape === 'cracked') {
      o.push(rect(g.s0, g.s1, g.z0, g.z1, `fill="${C}aa" stroke="${C}" stroke-width="1.5"`));
      o.push(`<polyline points="${r1(x + w * 0.2)},${y} ${r1(x + w * 0.7)},${r1(y + h * 0.35)} ${r1(x + w * 0.3)},${r1(y + h * 0.6)} ${r1(x + w * 0.8)},${r1(y + h)}" fill="none" stroke="#1a1208" stroke-width="1.4"/>`);
    } else if (g.shape === 'lock') {
      o.push(rect(g.s0, g.s1, g.z0, g.z1, `fill="${C}" stroke="#5a4a10" stroke-width="1"`));
      o.push(`<circle cx="${r1(x + w / 2)}" cy="${r1(y + h * 0.4)}" r="${r1(Math.max(1.6, Math.min(w, h) * 0.25))}" fill="#3a2f08"/>`);
    } else if (g.shape === 'seal') {
      o.push(rect(g.s0, g.s1, g.z0, g.z1, `fill="${C}" stroke="#600" stroke-width="1"`));
      o.push(`<path d="M${x} ${y}L${r1(x + w)} ${r1(y + h)}M${r1(x + w)} ${y}L${x} ${r1(y + h)}" stroke="#300" stroke-width="1.2"/>`);
    } else o.push(rect(g.s0, g.s1, g.z0, g.z1, `fill="${C}" stroke="#063" stroke-width="1"`));
  }
  // a double-jump gate up a hole: its last rise marked beside the climb
  for (const c of G.chains.filter((x) => x.gate === 'double-jump')) {
    const h = G.holes.find((x) => x.door === c.door), s = (h.s0 + h.s1) / 2;
    o.push(`<line x1="${X(s)}" y1="${Y(c.stands.at(-2))}" x2="${X(s)}" y2="${Y(c.stands.at(-1))}" stroke="${GATES['double-jump'].colour}" stroke-width="3"/>`);
  }

  // a castle's boxes: each outlined and named, its shape said (castle.js)
  for (const B of L.castle?.boxes ?? []) {
    const [bc, br, bw, bh] = B.rect;
    o.push(rect(bc * W, (bc + bw) * W, br * H, (br + bh) * H, 'fill="none" stroke="#f3efe6" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="10 6"'));
    o.push(`<text x="${r1(X(bc * W) + 6)}" y="${r1(Y((br + bh) * H) - 6)}" fill="#f3efe6" fill-opacity="0.8" font-size="13" font-weight="600">${esc(B.id)} · a ${esc(B.shape)}</text>`);
  }
  // the way back: shortcuts and loops
  for (const d of L.doors.filter((x) => x.kind === 'shortcut' || x.kind === 'loop' || x.kind === 'return')) {
    const [p, q] = d.cells;
    if (p[1] === q[1]) {
      // (across: a wing's return to its hub, an arrow over the wall it opens)
      const s = Math.max(p[0], q[0]) * W, z = (p[1] + 0.78) * H, dir = q[0] > p[0] ? 1 : -1, C = d.gate ? GATES[d.gate].colour : '#9ad';
      o.push(`<line x1="${r1(X(s) - dir * 18)}" y1="${Y(z)}" x2="${r1(X(s) + dir * 18)}" y2="${Y(z)}" stroke="${C}" stroke-width="1.6" stroke-dasharray="5 4"/><path d="M${r1(X(s) + dir * 10)} ${r1(Y(z) - 5)}L${r1(X(s) + dir * 18)} ${Y(z)}L${r1(X(s) + dir * 10)} ${r1(Y(z) + 5)}" fill="none" stroke="${C}" stroke-width="1.8"/>`);
      continue;
    }
    const hole = G.holes.find((h) => h.door === d.id), s = hole ? (hole.s0 + hole.s1) / 2 : Math.max(p[0], q[0]) * W;
    const za = (p[1] + 0.5) * H, zb = (q[1] + 0.5) * H;
    const C = d.gate ? GATES[d.gate].colour : '#9ad';
    o.push(`<line x1="${X(s)}" y1="${Y(za)}" x2="${X(s)}" y2="${Y(zb)}" stroke="${C}" stroke-width="1.6" stroke-dasharray="5 4"/>`);
    if (d.oneWay) { const ya = Y(zb), dir = zb < za ? -1 : 1; o.push(`<path d="M${r1(X(s) - 5)} ${r1(ya + dir * 8)}L${X(s)} ${ya}L${r1(X(s) + 5)} ${r1(ya + dir * 8)}" fill="none" stroke="${C}" stroke-width="1.8"/>`); }
  }
  // the spiral: the walk, room to room
  const pts = L.walk.map((id) => centre(room.get(id)));
  for (let j = 1; j < pts.length; j++) {
    const ring = room.get(L.walk[j]).ring, C = RING_LINE[ring % RING_LINE.length];
    // (a walk that goes on through rooms already walked, as a hub's does to its next wing, drawn faint)
    const joined = L.doors.some((d) => (d.a === L.walk[j - 1] && d.b === L.walk[j]) || (d.b === L.walk[j - 1] && d.a === L.walk[j]));
    o.push(`<line x1="${X(pts[j - 1][0])}" y1="${Y(pts[j - 1][1])}" x2="${X(pts[j][0])}" y2="${Y(pts[j][1])}" stroke="${C}" stroke-width="${joined ? 2.4 : 1.2}" stroke-opacity="${joined ? 0.85 : 0.45}"${joined ? '' : ' stroke-dasharray="2 5"'}/>`);
  }
  L.walk.forEach((id, j) => {
    const [s, z] = pts[j], C = RING_LINE[room.get(id).ring % RING_LINE.length];
    o.push(`<circle cx="${X(s)}" cy="${Y(z)}" r="8" fill="#0b0c0f" stroke="${C}" stroke-width="1.5"/><text x="${X(s)}" y="${r1(Y(z) + 3.5)}" fill="#eee" font-size="9" text-anchor="middle">${j}</text>`);
  });

  // what the rooms hold
  for (const m of G.marks) {
    const x = X(m.at[0]), y = Y(m.at[1]);
    if (m.kind === 'entry') o.push(`<path d="M${r1(x - 26)} ${r1(y - 8)}L${r1(x - 6)} ${r1(y - 8)}M${r1(x - 12)} ${r1(y - 14)}L${r1(x - 6)} ${r1(y - 8)}L${r1(x - 12)} ${r1(y - 2)}" stroke="#eee" stroke-width="2" fill="none"/><text x="${r1(x - 4)}" y="${r1(y + 14)}" fill="#ccc" font-size="10">${esc(m.label)}</text>`);
    else if (m.kind === 'save') o.push(`<circle cx="${r1(x + 26)}" cy="${r1(y - 22)}" r="7" fill="#2f6fd6"/><text x="${r1(x + 26)}" y="${r1(y - 18.5)}" fill="#fff" font-size="9" font-weight="700" text-anchor="middle">S</text>`);
    else if (m.kind === 'boss') o.push(`<path d="M${x} ${r1(y - 44)}l9 9l-9 9l-9 -9z" fill="${GATES.boss.colour}"/><text x="${x}" y="${r1(y - 50)}" fill="#f99" font-size="11" font-weight="600" text-anchor="middle">${esc(m.label)}</text>`);
    else if (m.kind === 'power') o.push(`<text x="${x}" y="${r1(y - 30)}" fill="#ffe08a" font-size="15" text-anchor="middle">★</text><text x="${x}" y="${r1(y - 64)}" fill="#ffe08a" font-size="11" text-anchor="middle">${esc(m.label)}</text>`);
    else if (m.kind === 'key') o.push(`<text x="${r1(x - 22)}" y="${r1(y - 24)}" fill="${GATES.key.colour}" font-size="12" font-weight="700" text-anchor="middle">⚿ key</text>`);
  }
  for (const p of G.pockets) o.push(`<path d="M${X(p.at[0])} ${r1(Y(p.at[1]) - 14)}l5 6l-5 6l-5 -6z" fill="${GATES[p.gate].colour}" stroke="#fff" stroke-width="0.8"/><text x="${X(p.at[0])}" y="${r1(Y(p.at[1]) - 18)}" fill="#ddd" font-size="9" text-anchor="middle">${esc(p.holds)}</text>`);

  // the legend: the gates, the order solved, the laws
  let y = top + mapH + 30;
  let x = left;
  for (const [id, g] of Object.entries(GATES)) {
    o.push(`<rect x="${x}" y="${y - 10}" width="14" height="12" fill="${g.colour}"/><text x="${x + 20}" y="${y}" fill="#ccc" font-size="12">${esc(id)}: ${esc(g.shape)}</text>`);
    x += 190;
  }
  o.push(`<text x="${x}" y="${y}" fill="#9ad" font-size="12">- - - a shortcut (⌄ one way)</text>`);
  y += 24;
  if (solved) {
    const order = solved.got.filter((g) => g.kind !== 'pocket').map((g) => g.what).join(' → ');
    o.push(`<text x="${left}" y="${y}" fill="#ddd" font-size="12">solved: ${esc(order)}; the way in ${solved.wayIn} cells, the way back ${solved.wayBack}</text>`);
    y += 24;
  }
  for (const l of laws) {
    o.push(`<text x="${left}" y="${y}" fill="${l.holds ? '#7c7' : '#f77'}" font-size="12">${l.holds ? '✓' : '✗'} ${esc(l.id)}: ${esc(l.says)}</text>`);
    y += 18;
  }
  o.push('</svg>');
  return o.join('\n');
}
