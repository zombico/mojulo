/**
 * structure/tags — one tag per element and object, in the field's conventions (the structure book's spine).
 *
 * A tag is what a drawing set prints: a room number (101), a door numbered by the room it serves (101A), a window by
 * its type letter (A), a wall by its type number (1), a piece of furniture by its type (CH-1). The same tag is used on
 * the sheet, in its schedule, on the room card and as the book's anchor, so one thing reads as one thing everywhere.
 *
 * Tags are allocated, never stored: a pure function of the element model, in reading order (storey, then top to
 * bottom, left to right on the plan), so re-reading gives the same tags. Rooms are numbered as architects number them
 * (storey digit + sequence), which means adding a room renumbers the rooms that read after it on its storey — the
 * same thing a set does when a room is added; a resize that keeps the reading order keeps every tag.
 */

import { FIXTURES } from '../furnishings/fixtures.js';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // I and O are skipped, as door and window letters skip them (they read as 1 and 0)
const letter = (i) => (i < LETTERS.length ? LETTERS[i] : `${letter(Math.floor(i / LETTERS.length) - 1)}${LETTERS[i % LETTERS.length]}`);
const r2 = (n) => Math.round(n * 100) / 100;

/** The storey's number on a set: ground 1, the next 2, a basement B1 (index -1), B2 below it. */
export function storeyNumber(index) {
  return index >= 0 ? String(index + 1) : `B${-index}`;
}

/** A room number: the storey's number and a two-digit sequence (101, 102 … 201; B101 for a basement). */
export function roomNumber(index, seq) {
  return `${storeyNumber(index)}${String(seq + 1).padStart(2, '0')}`;
}

// reading order on a plan: plan y grows down the sheet (the plan is drawn as stored), then x
const readingOrder = (a, b) => (a.y - b.y) || (a.x - b.x);

/** Rooms in reading order per storey → Map(space id → room number). Halls are numbered with the rooms (a corridor is
 *  a room on a set). */
export function tagRooms(spaces, storeyIndexOf) {
  const byStorey = new Map();
  for (const s of spaces) {
    const k = storeyIndexOf(s.storey);
    if (!byStorey.has(k)) byStorey.set(k, []);
    byStorey.get(k).push(s);
  }
  const out = new Map();
  for (const [k, list] of [...byStorey.entries()].sort((a, b) => a[0] - b[0])) {
    list.slice().sort((a, b) => readingOrder(a.footprint, b.footprint)).forEach((s, i) => out.set(s.id, roomNumber(k, i)));
  }
  return out;
}

/**
 * Door tags: each door takes the number of the room it serves and a letter in that room's order of doors (101A,
 * 101B). The room it serves is the one it opens into: the room that is not circulation, else the later number; an
 * exterior door serves its one room.
 */
export function tagDoors(doors, roomTagOf, isCirculation) {
  const served = doors.map((d) => {
    const rooms = d.connects.filter((id) => roomTagOf.has(id));
    let serves = rooms[0] ?? null;
    if (rooms.length === 2) {
      const [a, b] = rooms;
      const ca = isCirculation(a), cb = isCirculation(b);
      serves = ca && !cb ? b : cb && !ca ? a : (roomTagOf.get(a) > roomTagOf.get(b) ? a : b);
    }
    return { d, serves };
  });
  const byRoom = new Map();
  for (const x of served) {
    const k = x.serves ?? '';
    if (!byRoom.has(k)) byRoom.set(k, []);
    byRoom.get(k).push(x);
  }
  const out = new Map();
  for (const [room, list] of byRoom) {
    list.sort((a, b) => readingOrder(a.d.at, b.d.at));
    list.forEach((x, i) => out.set(x.d.id, { tag: room ? `${roomTagOf.get(room)}${letter(i)}` : `X${letter(i)}`, serves: room || null }));
  }
  return out;
}

/** Types by a key, lettered or numbered in a stable order of the key. → { typeOf: Map(id → type), types: [{ type, key, ids }] } */
export function tagTypes(items, keyOf, name = (i) => letter(i)) {
  const groups = new Map();
  for (const it of items) {
    const k = keyOf(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it.id);
  }
  const keys = [...groups.keys()].sort();
  const typeOf = new Map();
  const types = keys.map((k, i) => {
    const type = name(i, k);
    for (const id of groups.get(k)) typeOf.set(id, type);
    return { type, key: k, ids: groups.get(k) };
  });
  return { typeOf, types };
}

/** A size in feet to the whole inch a schedule states it in. */
export const inches = (ft) => Math.round(ft * 12);

/** A window's type key: its nominal size and sill to the inch (the generator fits each window to its wall, so two
 *  windows a quarter inch apart are one type on the schedule, as they would be ordered). */
export const windowKey = (w) => `${String(inches(w.width)).padStart(4, '0')}x${String(inches(w.height)).padStart(4, '0')}@${String(inches(w.sill)).padStart(4, '0')}`;

/** A wall's type key: exterior before interior, then thickness. */
export const wallKey = (w) => `${w.interior ? 'b' : 'a'}:${String(r2(w.thickness)).padStart(7, '0')}`;

/** A furniture code: two letters from the type's name (CH for chair, SO for sofa); a ref piece is RF. */
export function objectCode(type) {
  // a fitted fixture takes the mark a plumber reads (WC, LAV, TUB, SHR …)
  const fx = /^fixture-(.+)$/.exec(String(type || ''));
  if (fx && FIXTURES[fx[1]]) return FIXTURES[fx[1]].mark;
  const s = String(type || '').replace(/[^a-z]/gi, '').toUpperCase();
  return s.length >= 2 ? s.slice(0, 2) : (s || 'OB').padEnd(2, 'X');
}

/** Object type tags, in the FF&E form CODE-n: one tag per (code, key), numbered within its code in key order. */
export function tagObjectTypes(keys) {
  const byCode = new Map();
  for (const k of [...new Set(keys.map((x) => x.key))].sort()) {
    const code = keys.find((x) => x.key === k).code;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(k);
  }
  const out = new Map();
  for (const [code, list] of byCode) list.forEach((k, i) => out.set(k, `${code}-${i + 1}`));
  return out;
}
