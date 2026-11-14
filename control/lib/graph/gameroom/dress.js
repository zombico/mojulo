/**
 * THE DRESS — a room's places drawn as the things of its trade: the second pass, after the room is solved from the game
 * (the blockout first, the art after). A dress never moves what stands: each place keeps its box and its collider, and
 * its thing is drawn into that box, fitted to it, so what is seen is what is walked round.
 *
 * The things are the ones mojulo already draws: the stage dressing's pieces (era/compose-dress.js PIECES: a crate, a
 * barrel, a sack, a workbench, a cart, a drum, sandbags, a barrier…, each a set of parts painted by its surfaces), the
 * furniture door's builds (furnishings/forms.js: the counter, the shop shelves, the tables, drawn from their locked
 * builds), and a few of the room's own (a stove, a field plot, a leaf pile, a wheelie bin) in the same part form.
 *
 *   DRESSES       { <trade>: { about, palette: { <surface>: hex }, piece(place, card) → a piece's kind | null } }:
 *                 kitchen, farm, site, chores, hall (a fight's). A place a trade has no thing for stays a block
 *   OWN_PIECES    the room's own pieces, in PIECES' form
 *   dressOf(card | null, asked?) → a trade's name: the asked one, the card's own `dress`, its starter's, else kitchen for
 *                 a shift and the hall for a fight
 *   dressPlaces(places, trade, { card? }) → { faces, dressed: Set(place ids), laid: [{ id, piece }] }
 *   drawPiece(out, place, kind, palette, group), face, box, prism   the drawing, shared with the area (area.js)
 *     place: { id, kind (a primitive's: counter, bin, shelf, pass, cover-low, …), at: [x, y, z], size: [w, d, h],
 *              sid?, verb?, item? }   (a counter's station id and verb, a bin's or a shelf's item)
 *
 * Pure.
 */
import { PIECES } from '../era/compose-dress.js';
import { resolveFurniture } from '../furnishings/forms.js';
import { lockedFurnitureFaces } from '../construction/facades.js';

const B = (u0, u1, v0, v1, z0, z1, s) => [u0, u1, v0, v1, z0, z1, s];
const r3 = (v) => Math.round(v * 1000) / 1000;

export const OWN_PIECES = Object.freeze({
  // a range: its body, the hob on top, the oven's door and its handle
  stove: { w: 1, d: 1, h: 0.9, parts: [B(0, 1, 0, 1, 0, 0.84, 'services'), B(0, 1, 0, 1, 0.84, 0.9, 'trim'), ['prism', 0.3, 0.3, 0.16, 0.9, 0.93, 10, 'paint'], ['prism', 0.7, 0.7, 0.16, 0.9, 0.93, 10, 'paint'], B(0.12, 0.88, -0.02, 0, 0.12, 0.62, 'trim'), B(0.2, 0.8, -0.05, -0.02, 0.66, 0.7, 'beam')] },
  // a field: tilled soil, its rows of crop
  plot: { w: 1, d: 1, h: 0.25, parts: [B(0, 1, 0, 1, 0, 0.12, 'beam'), B(0.08, 0.92, 0.1, 0.22, 0.12, 0.25, 'paint'), B(0.08, 0.92, 0.44, 0.56, 0.12, 0.25, 'paint'), B(0.08, 0.92, 0.78, 0.9, 0.12, 0.25, 'paint')] },
  // a heap of raked leaves
  leaves: { w: 1, d: 1, h: 0.5, parts: [['prism', 0.5, 0.5, 0.5, 0, 0.18, 9, 'paint'], ['prism', 0.48, 0.52, 0.36, 0.18, 0.34, 9, 'paint'], ['prism', 0.5, 0.48, 0.2, 0.34, 0.5, 9, 'cabinet']] },
  // a wheelie bin: its body, its lid
  bin: { w: 0.8, d: 0.8, h: 1.1, parts: [B(0.05, 0.75, 0.05, 0.75, 0.06, 1.0, 'paint'), B(0, 0.8, 0, 0.8, 1.0, 1.1, 'trim'), ['prism', 0.15, 0.08, 0.06, 0, 0.12, 8, 'beam'], ['prism', 0.65, 0.08, 0.06, 0, 0.12, 8, 'beam']] },
});
const pieceOf = (kind) => OWN_PIECES[kind] ?? PIECES[kind] ?? null;

const has = (s, words) => words.some((w) => s.includes(w));
// a raw thing's crate by what it holds: grain in sacks, liquids and fish in barrels, the rest in crates
const binFor = (item = '') => (has(item, ['rice', 'grain', 'flour', 'seed', 'cement', 'sand', 'meal']) ? 'sack' : has(item, ['fish', 'oil', 'water', 'brine']) ? 'barrel' : has(item, ['leaf', 'leaves']) ? 'leaves' : 'crate');

export const DRESSES = Object.freeze({
  kitchen: {
    about: 'a kitchen: a range for what cooks alone, workbenches for what is worked, counters for what is plated and handed in',
    palette: { cabinet: '#ece6da', beam: '#b98b5e', trim: '#8f9aa3', paint: '#d86f4f', services: '#c9ced3', concrete: '#a8a29a', column: '#d9d2c3', grate: '#7d858c' },
    piece: (p, card) => (p.kind === 'counter' ? (card?.stations?.[p.sid]?.wait ? 'stove' : p.verb === 'bucket' ? 'counter' : 'workbench')
      : p.kind === 'bin' ? binFor(p.item) : p.kind === 'shelf' ? 'shelves' : p.kind === 'pass' ? 'counter' : null),
  },
  farm: {
    about: 'a farm yard: fields for what grows alone, workbenches and carts, sacks and barrels',
    palette: { cabinet: '#b98b5e', beam: '#6f4b2e', trim: '#5e432c', paint: '#9bbf5a', services: '#a0764a', concrete: '#9b8f7d', column: '#8a6a48', grate: '#6d6d6d' },
    piece: (p, card) => (p.kind === 'counter' ? (card?.stations?.[p.sid]?.wait ? 'plot' : p.verb === 'bucket' ? 'cart' : 'workbench')
      : p.kind === 'bin' ? 'sack' : p.kind === 'shelf' ? 'barrel' : p.kind === 'pass' ? 'cart' : null),
  },
  site: {
    about: 'a building site: a drum for what mixes alone, sandbags where it is dug, benches, barriers, sacks and crates',
    palette: { cabinet: '#c9a978', beam: '#5f6368', trim: '#e8b04a', paint: '#e8b04a', services: '#9aa3ab', concrete: '#b5b0a8', column: '#7b7f84', grate: '#5f6368' },
    piece: (p, card) => {
      const st = card?.stations?.[p.sid];
      return p.kind === 'counter' ? (st?.wait ? 'drum' : st && !Object.keys(st.takes ?? {}).length ? 'sandbags' : p.verb === 'bucket' ? 'barrier' : 'workbench')
        : p.kind === 'bin' ? binFor(p.item) : p.kind === 'shelf' ? 'crate' : p.kind === 'pass' ? 'barrier' : null;
    },
  },
  chores: {
    about: 'a chore: leaf piles where it is raked, sacks where it is bagged, the bin it all goes to',
    palette: { cabinet: '#b3763a', beam: '#5b4330', trim: '#4f6f52', paint: '#d98a3a', services: '#7f8c8d', concrete: '#9a9a9a', column: '#8a6a48', grate: '#6d6d6d' },
    piece: (p) => (p.kind === 'counter' ? (p.verb === 'bucket' ? 'sack' : 'leaves') : p.kind === 'bin' ? 'leaves' : p.kind === 'shelf' ? 'sack' : p.kind === 'pass' ? 'bin' : null),
  },
  hall: {
    about: 'a hall to fight in: long tables and shelves for cover, crates and barrels, the pillars and decks left as built',
    palette: { cabinet: '#a8805a', beam: '#5e432c', trim: '#8a8172', paint: '#8c3b2f', services: '#9aa3ab', concrete: '#a59d90', column: '#b3a48f', grate: '#5f6368' },
    piece: (p) => (p.kind === 'cover-low' ? 'long-table' : p.kind === 'cover-tall' ? 'shelves' : p.kind === 'crate' ? 'crate' : null),
  },
});
// the starters' trades (worksim/scenarios.js)
const STARTER_DRESS = Object.freeze({ kitchen: 'kitchen', farm: 'farm', site: 'site', roof: 'chores' });

export function dressOf(card, asked = null) {
  if (asked) { if (!DRESSES[asked]) throw new Error(`game room: dress is ${Object.keys(DRESSES).join(', ')} (or false: the greybox)`); return asked; }
  if (card?.dress && DRESSES[card.dress]) return card.dress;
  if (card) return STARTER_DRESS[card.id] ?? 'kitchen';
  return 'hall';
}

// a flat face (a quad or a triangle as a quad with a doubled corner), double-sided, in a hex (the area's too: area.js)
export const face = (corners, fill, group) => ({ corners: corners.map((c) => c.map(r3)), fill, group, doubleSided: true });
export function box(out, mn, mx, fill, group) {
  const [x0, y0, z0] = mn, [x1, y1, z1] = mx;
  out.push(face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fill, group), face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], fill, group),
    face([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], fill, group), face([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], fill, group),
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], fill, group));
}
export function prism(out, c, rx, ry, z0, z1, sides, fill, group) {
  const pts = Array.from({ length: sides }, (_, k) => { const a = (k / sides) * 2 * Math.PI; return [c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)]; });
  for (let k = 0; k < sides; k++) { const p = pts[k], q = pts[(k + 1) % sides]; out.push(face([[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]], fill, group)); }
  out.push(face(pts.map((p) => [p[0], p[1], z1]), fill, group));
}

/** A place's thing, drawn into its box: a piece's parts stretched to it (its front, +v, toward the screen's bottom), or a
 * furniture build fitted to it. (The area's surround lays its things with it: area.js.) */
export function drawPiece(out, place, kind, palette, group) {
  const P = pieceOf(kind), [w, d, h] = place.size, [x, y, z = 0] = place.at;
  if (P.furniture) {
    const L = resolveFurniture({ like: P.furniture, size: [w, d, h].map((v) => Math.round(v * 1000)) }).locked;
    // the build faces +y; turned to face -y (toward the screen's bottom, where the worker comes from)
    for (const fc of lockedFurnitureFaces(L, { unitMm: 1000, fit: true })) out.push(face(fc.corners.map(([u, v, q]) => [x - u, y - v, z + q]), fc.fill, group));
    return;
  }
  const su = w / P.w, sv = d / P.d, sz = h / P.h;
  // the piece's frame: u along x from the box's west, v from its south (its front) northward, z up
  const at = (u, v, q) => [x - w / 2 + u * su, y - d / 2 + v * sv, z + q * sz];
  for (const p of P.parts) {
    if (p[0] === 'prism') {
      const [, cu, cv, rad, z0, z1, sides, s] = p, c = at(cu, cv, 0);
      prism(out, c, rad * su, rad * sv, z + z0 * sz, z + z1 * sz, sides, palette[s] ?? '#a0a0a0', group);
    } else {
      const [u0, u1, v0, v1, z0, z1, s] = p;
      box(out, at(u0, v0, z0), at(u1, v1, z1), palette[s] ?? '#a0a0a0', group);
    }
  }
}

export function dressPlaces(places, trade, { card = null } = {}) {
  const D = DRESSES[trade];
  if (!D) throw new Error(`game room: dress is ${Object.keys(DRESSES).join(', ')}`);
  const faces = [], dressed = new Set(), laid = [];
  for (const p of places) {
    const kind = D.piece(p, card);
    if (!kind || !pieceOf(kind)) continue;
    drawPiece(faces, p, kind, D.palette, `room:dress:${p.id}`);
    dressed.add(p.id); laid.push({ id: p.id, piece: kind });
  }
  return { faces, dressed, laid };
}
