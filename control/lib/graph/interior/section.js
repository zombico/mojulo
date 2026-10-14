/**
 * interior/section — "a room from scratch", floor plan first. A room is a section of a house, never a house alone, so a
 * room described in words is drafted as the smallest honest house round it: the room; past each wall a door leads
 * through, the space it leads to (a hall, a kitchen); past every other inside wall a neighbour; and outside only the
 * walls the room has windows in. The draft is an ordinary floorplan recipe (rooms in feet, x east, y south): minted as a
 * house row, it pays the house's own laws and door rules, and it can be grown into the whole house later.
 *
 *   draftSection({ room?, size, height?, windows?, doors?, neighbours? })
 *     room        what the room is: 'living' | 'bedroom' | 'dining' | 'study' | 'entry' (or a glyph)
 *     size        [width east–west, depth north–south], the room's clear floor (interior/units.js lengths)
 *     height      the ceiling (default the house's)
 *     windows     the walls that face outside: ['S'], or { S: 2 } — the house sizes the windows to the wall
 *     doors       [{ wall, to?, at? }]: a door in a wall, to a 'hall' (default), 'kitchen', 'bedroom', 'dining',
 *                 'bath', 'entry' or 'outside' (the garden or the street), `at` a fraction along the wall
 *     neighbours  { N|E|S|W: what } for an inside wall with no door (default another room)
 * → { house, rect: the room's plan rect (ft), glyph }
 */
import { lengthMm, mmToFt } from './units.js';
import { FLOORPLAN_DEFAULTS } from '../polygonizer/floorplan-structure.js';

const ROOM_GLYPH = { living: 'L', lounge: 'L', 'living room': 'L', bedroom: 'B', dining: 'D', 'dining room': 'D', study: 'O', office: 'O', entry: 'E', kitchen: 'K', bath: 'W', bathroom: 'W', hall: 'H', closet: 'S', storage: 'S' };
// what lies past a wall, and how deep (ft) the draft makes it: enough to read as a room through a door
const NEIGHBOUR = { hall: ['H', 5], kitchen: ['K', 10], bedroom: ['B', 11], dining: ['D', 11], bath: ['W', 7], entry: ['E', 6], closet: ['S', 4], room: ['B', 10], living: ['L', 12] };
const EDGES = ['N', 'E', 'S', 'W'];
const glyphOf = (w) => (typeof w === 'string' && /^[A-Z]$/.test(w) ? w : ROOM_GLYPH[String(w || 'living').toLowerCase()] || null);

/** Why a section brief is malformed → string[]. */
export function sectionErrors(s) {
  const e = [];
  if (!s || typeof s !== 'object') return ['section: { room, size: [width, depth], windows?, doors? }'];
  if (!glyphOf(s.room)) e.push(`section.room: one of ${Object.keys(ROOM_GLYPH).join(', ')}`);
  if (!Array.isArray(s.size) || s.size.length !== 2 || s.size.some((v) => lengthMm(v) == null)) e.push("section.size: [width, depth], e.g. ['14ft', '18ft'] or [4270, 5490]");
  if (s.height != null && lengthMm(s.height) == null) e.push("section.height: a length, e.g. '9ft'");
  const win = Array.isArray(s.windows) ? s.windows : Object.keys(s.windows || {});
  for (const w of win) if (!EDGES.includes(w)) e.push(`section.windows: '${w}' is not a wall (N, E, S, W)`);
  for (const [i, d] of (s.doors || []).entries()) {
    if (!EDGES.includes(d?.wall)) e.push(`section.doors[${i}].wall: N, E, S or W`);
    else if (win.includes(d.wall) && d.to !== 'outside') e.push(`section.doors[${i}]: the ${d.wall} wall faces outside (it has windows); a door there leads 'outside'`);
    if (d?.to != null && d.to !== 'outside' && !NEIGHBOUR[d.to]) e.push(`section.doors[${i}].to: 'outside' or one of ${Object.keys(NEIGHBOUR).join(', ')}`);
  }
  if (!(s.doors || []).length) e.push('section.doors: a room is entered: name at least one door ({ wall, to })');
  return e;
}

export function draftSection(s) {
  const errs = sectionErrors(s);
  if (errs.length) throw new Error(`section:\n- ${errs.join('\n- ')}`);
  const glyph = glyphOf(s.room);
  const pad = FLOORPLAN_DEFAULTS.wallThickness;
  // the room's cell is its clear floor and the wall it stands in (the kernel insets placed pieces by about a wall)
  const w = Math.round((mmToFt(lengthMm(s.size[0])) + 2 * pad) * 4) / 4, h = Math.round((mmToFt(lengthMm(s.size[1])) + 2 * pad) * 4) / 4;
  const outside = new Set(Array.isArray(s.windows) ? s.windows : Object.keys(s.windows || {}));
  const doorTo = Object.fromEntries((s.doors || []).filter((d) => d.to !== 'outside').map((d) => [d.wall, d.to || 'hall']));
  for (const d of s.doors || []) if (d.to === 'outside') outside.add(d.wall);
  const past = {};
  for (const e of EDGES) if (!outside.has(e)) past[e] = NEIGHBOUR[doorTo[e] || s.neighbours?.[e] || 'room'] || NEIGHBOUR.room;
  // tile the neighbours round the room so the house is one rectangle: N and S span the corners W and E leave
  const dW = past.W ? past.W[1] : 0, dE = past.E ? past.E[1] : 0, dN = past.N ? past.N[1] : 0;
  const rx = dW, ry = dN;
  const rooms = [{ x: rx, y: ry, w, h, glyph }];
  if (past.N) rooms.push({ x: 0, y: 0, w: dW + w + dE, h: dN, glyph: past.N[0] });
  if (past.S) rooms.push({ x: 0, y: ry + h, w: dW + w + dE, h: past.S[1], glyph: past.S[0] });
  if (past.W) rooms.push({ x: 0, y: ry, w: dW, h, glyph: past.W[0] });
  if (past.E) rooms.push({ x: rx + w, y: ry, w: dE, h, glyph: past.E[0] });
  // the room's doors on its own walls; the neighbours are doored by the house (connectPlan) and the entry is cut on
  // the outermost wall of the first circulation space, else by the house's own entry rule
  const doors = (s.doors || []).map((d) => {
    const at = Number.isFinite(d.at) ? Math.min(0.9, Math.max(0.1, d.at)) : 0.25;
    const along = (d.wall === 'N' || d.wall === 'S' ? w : h) * at;
    const p = { N: [rx + along, ry], S: [rx + along, ry + h], W: [rx, ry + along], E: [rx + w, ry + along] }[d.wall];
    return d.to === 'outside' ? { x: p[0], y: p[1], edge: d.wall, leadsTo: 'terrace' } : { x: p[0], y: p[1], edge: d.wall };
  });
  const hall = rooms.slice(1).find((r) => r.glyph === 'H' || r.glyph === 'E');
  // every other neighbour is doored onto the hall where it touches it, so the house cuts no door into the room that
  // was not asked for (the house's own rule doors a sealed room through whichever wall it finds)
  if (hall) {
    for (const n of rooms.slice(1)) {
      if (n === hall) continue;
      const touchX = Math.min(n.x + n.w, hall.x + hall.w) - Math.max(n.x, hall.x), touchY = Math.min(n.y + n.h, hall.y + hall.h) - Math.max(n.y, hall.y);
      if (Math.abs(n.y + n.h - hall.y) < 0.01 && touchX > 3.5) doors.push({ x: Math.max(n.x, hall.x) + touchX / 2, y: hall.y, edge: 'N' });
      else if (Math.abs(hall.y + hall.h - n.y) < 0.01 && touchX > 3.5) doors.push({ x: Math.max(n.x, hall.x) + touchX / 2, y: n.y, edge: 'S' });
      else if (Math.abs(n.x + n.w - hall.x) < 0.01 && touchY > 3.5) doors.push({ x: hall.x, y: Math.max(n.y, hall.y) + touchY / 2, edge: 'W' });
      else if (Math.abs(hall.x + hall.w - n.x) < 0.01 && touchY > 3.5) doors.push({ x: n.x, y: Math.max(n.y, hall.y) + touchY / 2, edge: 'E' });
    }
  }
  const house = {
    kind: 'floorplan', title: `${s.room || 'room'} section`,
    rooms, doors, windows: true,
    ...(hall ? {} : { entryDoor: true }),
    ...(s.height != null ? { wallHeight: Math.round(mmToFt(lengthMm(s.height)) * 100) / 100 } : {}),
  };
  if (hall) {
    // the front door: on the hall's longest outside wall, at its middle
    const W = Math.max(...rooms.map((r) => r.x + r.w)), H = Math.max(...rooms.map((r) => r.y + r.h));
    const sides = [['S', hall.y + hall.h >= H - 0.01, hall.w], ['N', hall.y <= 0.01, hall.w], ['E', hall.x + hall.w >= W - 0.01, hall.h], ['W', hall.x <= 0.01, hall.h]].filter((x) => x[1]).sort((a, b) => b[2] - a[2]);
    if (sides.length) {
      const [edge] = sides[0];
      const p = { N: [hall.x + hall.w / 2, 0], S: [hall.x + hall.w / 2, H], W: [0, hall.y + hall.h / 2], E: [W, hall.y + hall.h / 2] }[edge];
      house.doors.push({ x: p[0], y: p[1], edge, entry: true });
    } else house.entryDoor = true;
  }
  return { house, rect: { x: rx, y: ry, w, h }, glyph };
}
