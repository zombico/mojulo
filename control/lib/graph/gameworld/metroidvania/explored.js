/**
 * THE EXPLORED MAP (docs/metroidvania-map.md "The explored map"): the castle as the hunter has walked it, drawn the way
 * the idiom draws it, a TILE A SCREEN. Greybox first: the map's data from the laid box (box.js, castle.js: the same
 * rooms the play runs on, so the map never lies), what has been seen of it, and what the map affords the one reading it.
 *
 * Its principles, each an affordance (what the map lets the player know without being told):
 *
 *   1  a screen is a tile        the map's unit is the screen the camera holds (a cell of the box), so a room is its
 *                                tiles, outlined, and a tile on the map is a screen walked
 *   2  walked, a tile fills      a tile is drawn the moment the hero stands in it, never the whole room ahead of her: the
 *                                map is a record of where she has been, in her region's colour (a region read by colour)
 *   3  known is not walked       a map room (a lectern) shows its region's tiles as outlines: where to go, never that she
 *                                has gone (the idiom's bought or found map)
 *   4  you are here              the tile she stands in marked, the map turned to nothing: north is up, the box as drawn
 *   5  rooms with a purpose      a save room, a map room, a boss's room (crossed once felled), what is to be picked up (a
 *                                power, a key, a pocket's prize: a dot while it is there, gone when taken): the map says
 *                                where to rest and what is left
 *   6  the frontier              a doorway from a walked tile into one not walked is drawn open, a stub into the dark:
 *                                where she has not been yet, read at a glance
 *   7  gates remembered          a gate seen is drawn at its doorway in its own colour and shape (gates.js): shut while
 *                                what opens it is not held, and MARKED OPEN-ABLE the moment it is (the power found sends
 *                                her back: the map says where)
 *   8  one way, said             a drop or a door that goes one way is drawn with its arrow once either side is walked
 *   9  how much                  the share of tiles walked, the castle's and each region's (the idiom's percentage)
 *
 *   MAP_MARKS, TILE_STATES
 *   mapOf(L) → { box, regions, cells: [{ c, r, room, region, sides: { left, right, down, up } }], rooms: [{ id, region,
 *              cells, marks }], doors: { <id>: { gate?, colour?, token?, oneWay? } } }   the map of a laid box or castle:
 *              each tile's four sides `wall` | `open` (the same room) | a door's id; each room's marks (MAP_MARKS) and the
 *              tile each stands in; each door's gate, its colour and what opens it (a page draws from this alone)
 *   viewOf(M, seen) / mapView(M, seen) → { tiles, doors, marks, percent, regions }   what the map shows, given what has been seen:
 *              seen = { visited: [key], known?: [key], held?: [token], taken?: [id], felled?: [room], at?: [c, r] }
 *              (a tile's key `c,r`; `taken` a relic's id: `relic-<room>`, `relic-key-<ring>`, `prize-<room>-<k>`)
 *   cellAt(L, W, H, s, z) → [c, r] | null   the tile a point in the box's metres stands in
 *   MAP_LAWS, mapLaws(L) → [{ id, holds, says }]   the map's affordances measured on it drawn at the walk's start and its
 *              end: maps-placed (with `maps`, a map room in every region but the core), way-on (from the gate the map
 *              already shows a way on into the dark), sides-agree (a door is the same door from both its tiles),
 *              walked-whole (walked to its end, every tile filled, no frontier left, no gate shut)
 *   exploredSvg(view, { tile?, title? }) → the map drawn as the idiom draws it, in greybox (SVG): a tile a screen, walked
 *              tiles in their region's colour, known ones outlined, walls on their edges, doors as gaps, gates in their
 *              colours (shut, or open-able ringed), the frontier's stubs, the marks, the share walked
 *
 * Pure: the same box and what is seen make the same map.
 */
import { GATES } from './gates.js';

export const MAP_MARKS = Object.freeze({
  save: 'a save room: where she rests and wakes',
  map: 'a map room: its region\'s tiles shown, unwalked',
  boss: 'a boss\'s room: crossed once the boss has fallen',
  power: 'a power to be found: gone from the map once taken',
  key: 'a key to be found: gone once taken',
  prize: 'a pocket\'s prize: a dot while it is there',
  throne: 'the core\'s throne: the end',
});
export const TILE_STATES = Object.freeze(['hidden', 'known', 'visited', 'here']);
const SIDES = Object.freeze({ left: [-1, 0], right: [1, 0], down: [0, -1], up: [0, 1] });
const key = (c, r) => `${c},${r}`;

/** The tile a point in the box's metres stands in. */
export function cellAt(L, W, H, s, z) {
  const c = Math.floor(s / W), r = Math.floor((z - 1e-3) / H);
  return L.rooms.some((x) => x.cells.some((q) => q[0] === c && q[1] === r)) ? [c, r] : null;
}

/** The map of a laid box or castle. */
export function mapOf(L) {
  const roomAt = new Map();
  for (const r of L.rooms) for (const q of r.cells) roomAt.set(key(q[0], q[1]), r);
  const doorAt = new Map();
  for (const d of L.doors) {
    const [p, q] = d.cells;
    doorAt.set(`${key(p[0], p[1])}>${key(q[0], q[1])}`, d.id);
    doorAt.set(`${key(q[0], q[1])}>${key(p[0], p[1])}`, d.id);
  }
  const cells = [];
  for (const r of L.rooms) for (const [c, rr] of r.cells) {
    const sides = {};
    for (const [s, [dc, dr]] of Object.entries(SIDES)) {
      const n = roomAt.get(key(c + dc, rr + dr)), d = doorAt.get(`${key(c, rr)}>${key(c + dc, rr + dr)}`);
      sides[s] = n === r ? 'open' : d ?? 'wall';
    }
    cells.push({ c, r: rr, room: r.id, region: r.ring, sides });
  }
  // (each room's marks, in the tile its thing stands in: its middle tile, a hall's floor)
  const mid = (r) => { const [c, rr, w] = r.rect; return [c + Math.floor((w - 1) / 2), rr]; };
  const rooms = L.rooms.map((r) => {
    const at = mid(r), marks = [];
    if (r.save) marks.push({ kind: 'save', at });
    if (r.mapRoom) marks.push({ kind: 'map', at });
    if (r.boss) marks.push({ kind: L.rings[r.ring].core && r === L.rooms.filter((x) => L.rings[x.ring].core).at(-1) ? 'throne' : 'boss', at, id: r.id });
    if (r.finds && !r.boss) marks.push({ kind: 'power', at, id: `relic-${r.id}` });
    if (r.key) marks.push({ kind: 'key', at, id: `relic-key-${r.ring}` });
    r.pockets.forEach((p, k) => marks.push({ kind: 'prize', at, id: `prize-${r.id}-${k}`, gate: p.gate }));
    return { id: r.id, region: r.ring, cells: r.cells.map((q) => [...q]), marks };
  });
  // (each door the map can draw: its gate, the gate's colour and the token that opens it, the room it goes one way out of)
  const doors = {};
  for (const d of L.doors) doors[d.id] = { ...(d.gate ? { gate: d.gate, colour: GATES[d.gate].colour, token: d.gate === 'key' ? `key:${L.rooms.find((r) => r.id === d.a).ring}` : d.gate === 'boss' ? `boss:${d.a}` : `gate:${d.gate}` } : {}), ...(d.oneWay ? { oneWay: d.a } : {}) };
  return { box: [...L.box], regions: L.rings.map((g) => ({ i: g.i, id: g.id, place: g.place, ...(g.core ? { core: true } : {}) })), cells, rooms, doors };
}

/** What the map shows, given what has been seen (import-free: the page inlines it with toString). */
export function viewOf(M, seen) {
  const SIDES = { left: [-1, 0], right: [1, 0], down: [0, -1], up: [0, 1] }, K = (c, r) => `${c},${r}`, S = seen || {};
  const visited = new Set(S.visited || []), known = new Set(S.known || []), held = new Set(S.held || []);
  const taken = new Set(S.taken || []), felled = new Set(S.felled || []), here = S.at ? K(S.at[0], S.at[1]) : null;
  const tileState = (k) => (k === here ? 'here' : visited.has(k) ? 'visited' : known.has(k) ? 'known' : 'hidden');
  const tiles = M.cells.map((x) => ({ c: x.c, r: x.r, region: x.region, room: x.room, state: tileState(K(x.c, x.r)), sides: x.sides }));
  const byKey = new Map(tiles.map((t) => [K(t.c, t.r), t]));
  // (the doors: drawn where a tile seen meets them; a frontier where a walked tile's other side is unwalked; a gate in its
  // colour, shut, or open-able once what opens it is held; a one-way door with its arrow)
  const doors = [];
  for (const t of tiles) {
    if (t.state === 'hidden') continue;
    for (const s of Object.keys(t.sides)) {
      const v = t.sides[s];
      if (v === 'wall' || v === 'open') continue;
      const d = M.doors[v] || {}, o = byKey.get(K(t.c + SIDES[s][0], t.r + SIDES[s][1]));
      const walked = t.state === 'visited' || t.state === 'here', across = !!o && (o.state === 'visited' || o.state === 'here');
      const has = d.gate ? held.has(d.token) : false;
      doors.push({ id: v, c: t.c, r: t.r, side: s, kind: d.gate ? 'gate' : walked && !across ? 'frontier' : 'passed',
        ...(d.gate ? { gate: d.gate, colour: d.colour, state: has ? (walked && across ? 'passed' : 'open-able') : 'shut' } : {}),
        ...(d.oneWay ? { oneWay: d.oneWay === t.room ? 'out' : 'in' } : {}) });
    }
  }
  // (the marks of rooms seen: a thing taken gone, a boss felled crossed)
  const marks = [];
  for (const R of M.rooms) {
    if (!R.cells.some((q) => tileState(K(q[0], q[1])) !== 'hidden')) continue;
    for (const m of R.marks) {
      if ((m.kind === 'power' || m.kind === 'key' || m.kind === 'prize') && taken.has(m.id)) continue;
      marks.push({ kind: m.kind, c: m.at[0], r: m.at[1], ...(m.kind === 'boss' || m.kind === 'throne' ? { felled: felled.has(m.id) } : {}) });
    }
  }
  // (how much: the share of tiles walked, the castle's and each region's)
  const walked = (xs) => xs.filter((t) => t.state === 'visited' || t.state === 'here').length;
  const regions = M.regions.map((g) => { const xs = tiles.filter((t) => t.region === g.i); return { id: g.id, place: g.place, percent: Math.round((100 * walked(xs)) / Math.max(1, xs.length)) }; });
  return { box: M.box, tiles, doors, marks, percent: Math.round((100 * walked(tiles)) / Math.max(1, tiles.length)), regions };
}
/** What the map shows of a laid box, given what has been seen. */
export const mapView = (M, seen = {}) => viewOf(M, seen);

export const MAP_LAWS = Object.freeze(['maps-placed', 'way-on', 'sides-agree', 'walked-whole']);

/** The map's affordances, measured. */
export function mapLaws(L) {
  const M = mapOf(L), out = [], law = (id, holds, says) => out.push({ id, holds: !!holds, says });
  if (L.maps) {
    const none = L.rings.filter((g) => !g.core && !g.boxCore && !g.connector && !L.rooms.some((r) => r.ring === g.i && r.mapRoom)).map((g) => g.place);
    law('maps-placed', !none.length, none.length ? `no map room in ${none.join(', ')}` : 'a map room in every region but a core');
  }
  const first = L.rooms.find((r) => r.id === L.entry.room), start = viewOf(M, { visited: first.cells.map((q) => q.join(',')), at: first.cells[0] });
  const ways = start.doors.filter((d) => d.kind === 'frontier' || d.kind === 'gate');
  law('way-on', ways.length > 0, ways.length ? `from the gate the map shows ${ways.length} way${ways.length === 1 ? '' : 's'} on` : 'from the gate the map shows no way on: a dead end on the first screen');
  const bad = [];
  for (const x of M.cells) for (const [side, v] of Object.entries(x.sides)) {
    if (v === 'wall' || v === 'open') continue;
    const [dc, dr] = SIDES[side], o = M.cells.find((y) => y.c === x.c + dc && y.r === x.r + dr), back = o && Object.entries(o.sides).find(([sd]) => SIDES[sd][0] === -dc && SIDES[sd][1] === -dr);
    if (!back || back[1] !== v) bad.push(`${x.c},${x.r} ${side}`);
  }
  law('sides-agree', !bad.length, bad.length ? `a door drawn from one side only at ${bad.slice(0, 4).join('; ')}` : 'every door the same door from both its tiles');
  const all = M.cells.map((x) => `${x.c},${x.r}`), held = Object.values(M.doors).filter((d) => d.token).map((d) => d.token);
  const end = viewOf(M, { visited: all, held, taken: M.rooms.flatMap((r) => r.marks.map((m) => m.id)).filter(Boolean), felled: L.rooms.filter((r) => r.boss).map((r) => r.id) });
  const left = end.doors.filter((d) => d.kind === 'frontier' || (d.kind === 'gate' && d.state === 'shut'));
  law('walked-whole', end.percent === 100 && !left.length, left.length ? `walked whole, the map still shows ${left.length} way${left.length === 1 ? '' : 's'} not taken` : 'walked whole: every tile filled, no frontier left, no gate shut');
  return MAP_LAWS.map((id) => out.find((l) => l.id === id)).filter(Boolean);
}

/** The map drawn, in greybox (import-free: the page inlines it with toString). */
export function exploredSvg(V, { tile = 22, title = 'The explored map', key = true } = {}) {
  // (the regions' colours: muted, each apart from the next, a region read by colour)
  const REGION_FILL = ['#3d5a8c', '#7a3f5c', '#3f7a62', '#8c6a3d', '#5c4a8c', '#3d7a8c', '#8c3d3d', '#6a8c3d'];
  const SIDES = { left: [-1, 0], right: [1, 0], down: [0, -1], up: [0, 1] }, esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const [cols, rows] = V.box, T = tile, pad = 24, head = title ? 54 : 12, side = key ? 230 : 0, Wp = pad * 2 + cols * T + side, Hp = head + pad + rows * T + pad + 40;
  const X = (c) => pad + c * T, Y = (r) => head + (rows - 1 - r) * T, o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Wp}" height="${Hp}" viewBox="0 0 ${Wp} ${Hp}" font-family="sans-serif">`);
  o.push(`<rect width="${Wp}" height="${Hp}" fill="#0b0d16"/>`);
  if (title) o.push(`<text x="${pad}" y="28" fill="#e8e4d8" font-size="17" font-weight="600">${esc(title)}</text><text x="${pad}" y="46" fill="#8a90a8" font-size="12">${V.percent}% walked · a tile a screen</text>`);
  // the tiles: walked in their region's colour, known outlined, here bright
  for (const t of V.tiles) {
    if (t.state === 'hidden') continue;
    const fill = t.state === 'known' ? '#1c2130' : REGION_FILL[t.region % REGION_FILL.length];
    o.push(`<rect x="${X(t.c)}" y="${Y(t.r)}" width="${T}" height="${T}" fill="${fill}"${t.state === 'known' ? ' stroke="#3a4258" stroke-width="1"' : ''}/>`);
    if (t.state === 'here') o.push(`<rect x="${X(t.c) + 5}" y="${Y(t.r) + 5}" width="${T - 10}" height="${T - 10}" fill="#f4f0e2"/>`);
  }
  // the walls on the tiles' edges, the doors as gaps in them
  const edge = (t, s) => { const x = X(t.c), y = Y(t.r); return s === 'left' ? [x, y, x, y + T] : s === 'right' ? [x + T, y, x + T, y + T] : s === 'up' ? [x, y, x + T, y] : [x, y + T, x + T, y + T]; };
  const doorOn = new Map(V.doors.map((d) => [`${d.c},${d.r},${d.side}`, d]));
  for (const t of V.tiles) {
    if (t.state === 'hidden') continue;
    const ink = t.state === 'known' ? '#59617a' : '#e8e4d8';
    for (const [s, v] of Object.entries(t.sides)) {
      if (v === 'open') continue;
      const [x0, y0, x1, y1] = edge(t, s);
      const d = v !== 'wall' ? doorOn.get(`${t.c},${t.r},${s}`) : null;
      if (v === 'wall' || !d) { if (v === 'wall') o.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${ink}" stroke-width="2"/>`); continue; }
      // (a door: its edge broken in the middle, a third of it open)
      const ax = x0 + (x1 - x0) / 3, ay = y0 + (y1 - y0) / 3, bx = x0 + (2 * (x1 - x0)) / 3, by = y0 + (2 * (y1 - y0)) / 3;
      o.push(`<line x1="${x0}" y1="${y0}" x2="${ax}" y2="${ay}" stroke="${ink}" stroke-width="2"/><line x1="${bx}" y1="${by}" x2="${x1}" y2="${y1}" stroke="${ink}" stroke-width="2"/>`);
      if (d.kind === 'gate') {
        o.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${d.colour}" stroke-width="4"/>`);
        if (d.state === 'open-able') o.push(`<circle cx="${(ax + bx) / 2}" cy="${(ay + by) / 2}" r="${T * 0.36}" fill="none" stroke="${d.colour}" stroke-width="1.5" stroke-dasharray="3 2"/>`);
      } else if (d.kind === 'frontier') {
        // (a stub out into the dark: where she has not been)
        const [dc, dr] = SIDES[s], cx = (ax + bx) / 2, cy = (ay + by) / 2;
        o.push(`<line x1="${cx}" y1="${cy}" x2="${cx + dc * T * 0.45}" y2="${cy - dr * T * 0.45}" stroke="#f4d58a" stroke-width="2" stroke-dasharray="2 2"/>`);
      }
      if (d.oneWay) {
        const [dc, dr] = SIDES[s], dir = d.oneWay === 'out' ? 1 : -1, cx = (ax + bx) / 2, cy = (ay + by) / 2, ux = dc * dir, uy = -dr * dir;
        o.push(`<path d="M${cx - uy * 3 - ux * 3} ${cy + ux * 3 - uy * 3}L${cx + ux * 4} ${cy + uy * 4}L${cx + uy * 3 - ux * 3} ${cy - ux * 3 - uy * 3}" fill="none" stroke="#9ad" stroke-width="1.5"/>`);
      }
    }
  }
  // the marks: where to rest and what is left
  for (const m of V.marks) {
    const cx = X(m.c) + T / 2, cy = Y(m.r) + T / 2;
    if (m.kind === 'save') o.push(`<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="#c8323c"/><text x="${cx}" y="${cy + 4}" fill="#fff" font-size="9" font-weight="700" text-anchor="middle">S</text>`);
    else if (m.kind === 'map') o.push(`<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" fill="#2f8f8a"/><text x="${cx}" y="${cy + 4}" fill="#fff" font-size="9" font-weight="700" text-anchor="middle">M</text>`);
    else if (m.kind === 'boss' || m.kind === 'throne') o.push(`<path d="M${cx} ${cy - 7}l7 7l-7 7l-7 -7z" fill="${m.kind === 'throne' ? '#ffd23a' : '#e0414a'}"${m.felled ? ' fill-opacity="0.35"' : ''}/>${m.felled ? `<path d="M${cx - 6} ${cy - 6}L${cx + 6} ${cy + 6}M${cx + 6} ${cy - 6}L${cx - 6} ${cy + 6}" stroke="#e8e4d8" stroke-width="1.6"/>` : ''}`);
    else if (m.kind === 'power') o.push(`<path d="M${cx} ${cy - 7}l2 5h5l-4 3l2 5l-5 -3l-5 3l2 -5l-4 -3h5z" fill="#ffe08a"/>`);
    else if (m.kind === 'key') o.push(`<circle cx="${cx - 2}" cy="${cy}" r="3.5" fill="none" stroke="#e8c547" stroke-width="2"/><line x1="${cx + 1}" y1="${cy}" x2="${cx + 7}" y2="${cy}" stroke="#e8c547" stroke-width="2"/>`);
    else if (m.kind === 'prize') o.push(`<circle cx="${cx}" cy="${cy + 6}" r="2.6" fill="#f3efe6"/>`);
  }
  // the share walked, the castle's and each region's; the key to the marks
  if (!key) { o.push('</svg>'); return o.join('\n'); }
  const lx = pad + cols * T + 24;
  o.push(`<text x="${lx}" y="${head + 10}" fill="#e8e4d8" font-size="13" font-weight="600">${V.percent}% of the castle</text>`);
  V.regions.forEach((g, i) => { const y = head + 30 + i * 18; o.push(`<rect x="${lx}" y="${y - 10}" width="12" height="12" fill="${REGION_FILL[i % REGION_FILL.length]}"/><text x="${lx + 18}" y="${y}" fill="#c8ccd8" font-size="11">${esc(g.place)} · ${g.percent}%</text>`); });
  const ky = head + 40 + V.regions.length * 18;
  const keyRows = [['save', 'save room'], ['map', 'map room'], ['boss', 'boss (crossed: felled)'], ['power', 'a power to find'], ['key', 'a key to find'], ['prize', 'a prize left'], ['frontier', 'a way not yet walked'], ['gate', 'a gate (ringed: open-able now)']];
  keyRows.forEach(([k, label], i) => { const y = ky + i * 17; o.push(`<text x="${lx}" y="${y}" fill="#8a90a8" font-size="11">${k === 'frontier' ? '┄' : k === 'gate' ? '▬' : '·'} ${esc(label)}</text>`); });
  o.push('</svg>');
  return o.join('\n');
}
