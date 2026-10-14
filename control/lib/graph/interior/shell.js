/**
 * interior/shell — the room an interior decorates, read from its house. A room is a section of a house: its walls, its
 * doors (to the hall, the kitchen, the garden) and its windows are the floor plan's own, read through the house's read
 * model (structure/read.js), never drawn here. The shell is that room in the placer's frame (interior/place.js):
 * millimetres from the north-west corner of the floor the house lets a piece stand on.
 */
import { readStructure } from '../structure/read.js';
import { FLOORPLAN_DEFAULTS } from '../polygonizer/floorplan-structure.js';
import { MM_PER_FT } from './units.js';

const norm = (w) => String(w ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const TOL = 0.06;

/** The house's rooms a person might name, said as a list (for a refusal). */
export const roomList = (read) => read.rooms.map((r) => `${r.tag} ${r.name} (${r.glyph})${read.storeys.length > 1 ? ` on ${r.storey === 0 ? 'the ground floor' : `storey ${r.storey}`}` : ''}`).join(', ');

/**
 * The room a selector names: its tag ('101'), its name ('lounge', 'bedroom 2'), its role ('living') or its glyph
 * ('L'); `level` narrows a stack to one storey. Several rooms answering one word: the first in tag order, and `alsoMatched`
 * names the others. Throws, listing the house's rooms, when none answers.
 */
export function selectRoom(read, room, level = null) {
  const rooms = read.rooms.filter((r) => level == null || r.storey === level);
  const want = norm(room);
  const hit = (r) => norm(r.tag) === want || norm(r.name) === want || norm(r.role) === want || (r.glyph && norm(r.glyph) === want);
  const found = rooms.filter(hit);
  if (!found.length) throw new Error(`interior: the house has no room '${room}'${level != null ? ` on storey ${level}` : ''}: ${roomList(read)}`);
  return { card: found[0], alsoMatched: found.slice(1).map((r) => r.tag) };
}

/** The wall letter an opening at plan point p sits on, for a room rect, or null. */
function wallOf(rect, p) {
  if (Math.abs(p.y - rect.y) < TOL + 0.4 && p.x > rect.x - TOL && p.x < rect.x + rect.w + TOL) return 'N';
  if (Math.abs(p.y - (rect.y + rect.h)) < TOL + 0.4 && p.x > rect.x - TOL && p.x < rect.x + rect.w + TOL) return 'S';
  if (Math.abs(p.x - rect.x) < TOL + 0.4 && p.y > rect.y - TOL && p.y < rect.y + rect.h + TOL) return 'W';
  if (Math.abs(p.x - (rect.x + rect.w)) < TOL + 0.4 && p.y > rect.y - TOL && p.y < rect.y + rect.h + TOL) return 'E';
  return null;
}

/**
 * A house manifest and a room selector → the shell:
 *   { card, read, level, rect (plan ft), pad (ft), origin [x, y] plan ft of the frame's corner, W, D, H (mm),
 *     walls: { N|E|S|W: { tag, exterior, thickness } }, openings: [{ kind, tag, wall, a, b, sill, head, exterior,
 *     entry?, connects }], neighbours: { <tag>: name } }
 * An opening's a..b runs along its wall in the frame's own axis (x for N and S, y for E and W), in mm.
 */
export function roomShell(house, { room, level = null } = {}) {
  const read = readStructure(house);
  const { card, alsoMatched } = selectRoom(read, room, level);
  const storey = read.storeys.find((s) => s.index === card.storey) || { baseZ: 0, height: house.wallHeight ?? FLOORPLAN_DEFAULTS.wallHeight };
  // the floor a piece may stand on is the room's rect inset by the kernel's own pad (floorplan-structure roomItemPlacements)
  const pad = Math.max(house.wallThickness ?? FLOORPLAN_DEFAULTS.wallThickness, 0.4);
  const rect = card.rect;
  const origin = [rect.x + pad, rect.y + pad];
  const W = (rect.w - 2 * pad) * MM_PER_FT, D = (rect.h - 2 * pad) * MM_PER_FT, H = storey.height * MM_PER_FT;
  const walls = {};
  for (const w of read.elements.walls.filter((x) => x.storey === card.storey && card.walls.includes(x.tag))) {
    const edge = w.orientation === 'h'
      ? (Math.abs(w.at - rect.y) < TOL ? 'N' : Math.abs(w.at - (rect.y + rect.h)) < TOL ? 'S' : null)
      : (Math.abs(w.at - rect.x) < TOL ? 'W' : Math.abs(w.at - (rect.x + rect.w)) < TOL ? 'E' : null);
    if (edge && w.along[0] <= (edge === 'N' || edge === 'S' ? rect.x : rect.y) + TOL && w.along[1] >= (edge === 'N' || edge === 'S' ? rect.x + rect.w : rect.y + rect.h) - TOL) {
      walls[edge] = { tag: w.tag, exterior: !w.interior, thickness: w.thickness * MM_PER_FT };
    }
  }
  const names = new Map(read.rooms.map((r) => [r.tag, r.name]));
  const openings = [];
  const take = (o, kind) => {
    if (o.storey !== card.storey || !o.connects.includes(card.tag)) return;
    const wall = wallOf(rect, o.at);
    if (!wall) return;
    const along = wall === 'N' || wall === 'S' ? o.at.x - origin[0] : o.at.y - origin[1];
    const a = (along - o.width / 2) * MM_PER_FT, b = (along + o.width / 2) * MM_PER_FT;
    openings.push({
      kind, tag: kind === 'door' ? o.tag : o.mark, wall, a, b, sill: (o.sill || 0) * MM_PER_FT, head: ((o.sill || 0) + o.height) * MM_PER_FT,
      exterior: !!o.exterior, ...(o.entry ? { entry: true } : {}),
      connects: o.connects.filter((t) => t !== card.tag).map((t) => `${t} ${names.get(t) || ''}`.trim()),
    });
  };
  for (const d of read.elements.doors) take(d, 'door');
  for (const w of read.elements.windows) take(w, 'window');
  return {
    card, read, level: card.storey, baseZ: storey.baseZ ?? 0, heightFt: storey.height, rect, pad, origin, W, D, H, walls, openings,
    ...(alsoMatched.length ? { alsoMatched } : {}),
  };
}
