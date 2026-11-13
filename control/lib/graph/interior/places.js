/**
 * interior/places — a decorated room, addressable: where a figure can stand in it. The solver knows where every piece
 * stands, the shell where the doors and windows are; the faces don't. This keeps that knowledge on the World payload in
 * the stage's own shape (era/anchors.js), so a scene can be set in the room (actor/set.js) and a script can send someone
 * "to the sofa", "to the fireplace", "to the door":
 *
 *   rooms:   [{ id, box: { min, max }, h, walled, solids, blocks, openings, stand }]
 *       the room's floor; `walled`: it is closed on every side; `solids`: the tall pieces a camera keeps clear of;
 *       `blocks`: every piece that stands on the floor, which a walk goes round (each with its height `h`);
 *       `openings`: each door and window, its span along its wall and its sill and head above the floor;
 *       `stand`: the middle of its most open floor, where a cast with no marks of its own is put
 *   anchors: [{ id, kind: 'spot', of, at }]
 *       a place to stand by each thing: a piece (the clear floor nearest its front), a wall piece, a fixed feature,
 *       each door (a step inside it) and each window
 *
 * A place is named the way a script says it: the piece's own word (`sofa`, `coffee-table`, `chair-2`; a lone
 * `bookcase-1` is `bookcase`), its whole id where two would share a word. A thing with no clear floor beside it gets no
 * place: nobody is stood inside a piece. Everything is in the payload's frame (the world's: feet, y north).
 *
 * Pure and deterministic.
 */
import { wallFrame } from './place.js';
import { MM_PER_FT } from './units.js';

const BODY = 250;        // the clear floor a standing figure wants about its feet, mm (a radius)
const OFF = 450;         // how far off a thing's edge a figure stands to it
const REACH = 1500;      // how far from a thing its place may be and still be "at" it
const TALL = 1200;        // a piece this high stands in a camera's way
const EASE = 450;         // the clear floor a figure in a scene stands easy in
const PAIR_MM = 1400;    // a conversation's distance (actor/scene.js PAIR), for the room's open spot
const DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** How far a point is from the nearest wall, standing piece or fixed feature, mm (inside one: 0). */
function clearance(R, x, y) {
  let c = Math.min(x, y, R.W - x, R.D - y);
  const rects = [...R.placed.filter((p) => p.mount !== 'skin').map((p) => p.rect), ...R.features.map((f) => f.rect)];
  for (const r of rects) c = Math.min(c, Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1)));
  return Math.max(0, c);
}

/**
 * Where a cast with no marks stands: two figures a conversation apart (along x), both clear of everything, with the
 * most floor left before them for a camera. A scene's first camera stands on the cast's south side (actor/coverage.js:
 * the side the set opens to), so of the spots with room to stand (EASE) the one farthest from the south wall wins;
 * a room with none takes its most open spot.
 */
function openSpot(R, cell = 100) {
  let best = null, open = null;
  for (let y = cell / 2; y < R.D; y += cell) {
    for (let x = cell / 2; x < R.W; x += cell) {
      const c = Math.min(clearance(R, x - PAIR_MM / 2, y), clearance(R, x, y), clearance(R, x + PAIR_MM / 2, y));
      // (ties go to the spot nearest the room's middle)
      const d = Math.hypot(x - R.W / 2, y - R.D / 2);
      if (!open || c > open.c + 1 || (Math.abs(c - open.c) <= 1 && d < open.d)) open = { x, y, c, d };
      if (c < EASE) continue;
      const room = R.D - y;
      if (!best || room > best.room + 1 || (Math.abs(room - best.room) <= 1 && d < best.d)) best = { x, y, room, d };
    }
  }
  const at = best ?? (open && open.c >= BODY ? open : null);
  return at ? [at.x, at.y] : [R.W / 2, R.D / 2];
}

/** The room's clear floor: every point of a grid where a figure can stand. */
function clearFloor(R, cell = 50) {
  const pts = [];
  for (let y = cell / 2; y < R.D; y += cell) for (let x = cell / 2; x < R.W; x += cell) if (clearance(R, x, y) >= BODY) pts.push([x, y]);
  return pts;
}

/** The clear point nearest `want`, within `reach` of it; null when the floor about it is taken. */
function nearest(floor, want, reach) {
  let best = null, bd = reach;
  for (const p of floor) { const d = Math.hypot(p[0] - want[0], p[1] - want[1]); if (d < bd - 1e-6) { best = p; bd = d; } }
  return best;
}

/** The point a figure would stand to a rect: off its `facing` side. */
function before(rect, facing) {
  const [dx, dy] = DIR[facing];
  return [(rect.x0 + rect.x1) / 2 + dx * ((rect.x1 - rect.x0) / 2 + OFF), (rect.y0 + rect.y1) / 2 + dy * ((rect.y1 - rect.y0) / 2 + OFF)];
}

/** The point a step `v` off a wall at `u`. */
const offWall = (R, edge, u, v) => wallFrame(R, edge).at(u, v);

/**
 * A compiled interior (interior/compile.js) → { rooms, anchors } for its World payload.
 */
export function interiorPlaces(c) {
  const { shell, solved } = c, R = solved.R;
  const z = shell.baseZ ?? 0;
  const world = ([x, y]) => [r4(shell.origin[0] + x / MM_PER_FT), r4(-(shell.origin[1] + y / MM_PER_FT)), r4(z)];
  const floor = clearFloor(R);
  const things = [];   // [{ of, word, at }] in placement order
  for (const p of solved.placed) {
    // a rug is floor: its own middle when nothing stands there, else beside it like any piece
    const mid = [(p.rect.x0 + p.rect.x1) / 2, (p.rect.y0 + p.rect.y1) / 2];
    const at = p.mount === 'skin' ? (clearance(R, ...mid) >= BODY ? mid : null) : nearest(floor, before(p.rect, p.facing), REACH);
    if (at) things.push({ of: p.id, word: slug(p.id.split('.').pop()), at });
  }
  for (const w of solved.wall) {
    const at = nearest(floor, offWall(R, w.edge, w.u, 1200), REACH);
    if (at) things.push({ of: w.id, word: slug(w.id.split('.').pop()), at });
  }
  for (const f of R.features) {
    // (a hearth is where a scene gathers: it always has a place, the nearest clear floor to its front)
    const at = nearest(floor, offWall(R, f.wall, f.u, f.depth + OFF), Infinity);
    if (at) things.push({ of: f.id, word: slug(f.type), at });
  }
  const count = {};
  for (const o of shell.openings) {
    const F = wallFrame(R, o.wall), [u0, u1] = F.span(o.a, o.b);
    const at = nearest(floor, offWall(R, o.wall, (u0 + u1) / 2, o.kind === 'door' ? 750 : 600), o.kind === 'door' ? Infinity : REACH);
    if (!at) continue;
    count[o.kind] = (count[o.kind] || 0) + 1;
    things.push({ of: o.tag, word: count[o.kind] > 1 ? `${o.kind}-${count[o.kind]}` : o.kind, at });
  }
  // a lone numbered piece takes its plain word; two things of one word keep their whole ids
  const words = things.map((t) => t.word);
  const plain = (w) => (/-1$/.test(w) && !words.includes(w.replace(/-1$/, '-2')) && !words.includes(w.replace(/-1$/, '')) ? w.replace(/-1$/, '') : w);
  const taken = new Set(), anchors = [];
  for (const t of things) {
    const word = plain(t.word), id = taken.has(word) ? slug(t.of) : word;
    if (taken.has(id)) continue;
    taken.add(id);
    anchors.push({ id, kind: 'spot', of: t.of, at: world(t.at) });
  }
  const [x0, y0] = world([0, 0]), [x1, y1] = world([R.W, R.D]);
  // what stands taller than a camera on its sticks: a camera never stands in or behind one (actor/coverage.js fitRoom)
  const tall = [...R.placed.filter((p) => p.mount !== 'skin' && p.h >= TALL).map((p) => p.rect), ...R.features.map((f) => f.rect)];
  const rectOf = (r) => { const a = world([r.x0, r.y0]), b = world([r.x1, r.y1]); return { min: [Math.min(a[0], b[0]), Math.min(a[1], b[1])], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1])] }; };
  // everything that stands on the floor: what a walk goes round (actor/route.js)
  // (each with how high it stands, `h`: a storyboard draws it, actor/storyboard.js; a fixed feature rises to the ceiling)
  const blocks = [
    ...R.placed.filter((p) => p.mount !== 'skin').map((p) => ({ ...rectOf(p.rect), ...(p.h > 0 ? { h: r4(p.h / MM_PER_FT) } : {}) })),
    ...R.features.map((f) => ({ ...rectOf(f.rect), h: r4(shell.heightFt) })),
  ];
  const solids = tall.map((r) => { const a = world([r.x0, r.y0]), b = world([r.x1, r.y1]); return { min: [Math.min(a[0], b[0]), Math.min(a[1], b[1])], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1])] }; });
  // each door and window, where it is in its wall: a storyboard draws it (actor/storyboard.js)
  const openings = shell.openings.map((o) => {
    const F = wallFrame(R, o.wall), [u0, u1] = F.span(o.a, o.b), a = world(F.at(u0, 0)), b = world(F.at(u1, 0));
    return { kind: o.kind, min: [Math.min(a[0], b[0]), Math.min(a[1], b[1])], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1])], sill: r4(o.sill / MM_PER_FT), head: r4(o.head / MM_PER_FT) };
  });
  const room = {
    id: slug(shell.card.name) || slug(shell.card.tag),
    box: { min: [Math.min(x0, x1), Math.min(y0, y1), r4(z)], max: [Math.max(x0, x1), Math.max(y0, y1), r4(z + shell.heightFt)] },
    h: shell.heightFt,
    walled: true,
    ...(solids.length ? { solids } : {}),
    ...(blocks.length ? { blocks } : {}),
    ...(openings.length ? { openings } : {}),
    stand: world(openSpot(R)),
  };
  return { rooms: [room], anchors };
}
