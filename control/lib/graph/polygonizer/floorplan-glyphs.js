/**
 * floorplan-glyphs — a glyph grammar for fractal room generation.
 *
 * The model declares intent (footprint + seed + optional constraints); this
 * library generates a coherent, furnished multi-room layout so the model does
 * NOT place every element. Three properties by construction:
 *
 *  - fractal: recursive binary space partition. Every split inserts a HALLWAY
 *    gap spanning the region, so corridors form a connected tree and align
 *    (sibling halls meet the parent hall at T-junctions).
 *  - inferrable: the output is a plain {rooms, halls, doors} map readable as a
 *    top-down plan; doors sit on corridor edges, so connectivity is explicit.
 *  - nondeterministic: a seeded PRNG drives split positions, archetype choice,
 *    and furniture jitter. Same seed → same plan; different seed → new plan.
 *
 * Each room gets an archetype glyph; the archetype's fill recipe expands into
 * boxNet roomConcept.elements (same furniture library as the room spikes), so a
 * generated room renders through the existing pipeline.
 */

// ── seeded RNG (mulberry32) — deterministic per seed ────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
function jit(rng, c, amt) { return c + (rng() * 2 - 1) * amt; }

// ── archetype glyph library ─────────────────────────────────────────────────
// tint = top-down map color. fill(rng) → element specs in room-local [0,1].
// Wall fixtures use surface:'backWall'; floor pieces default to the floor.
export const ARCHETYPES = {
  H: { glyph: 'H', name: 'hallway', tint: '#d9cfb6', corridor: true, fill: () => [] },
  E: {
    glyph: 'E', name: 'entry', tint: '#cdbd97',
    fill: (rng) => [
      { type: 'bench', anchor: [jit(rng, 0.5, 0.1), 0.7], heightWorld: 1.8 },
      { type: 'picture', surface: 'backWall', anchor: [jit(rng, 0.5, 0.12), 0.6], w: 0.13, h: 0.28 },
      { type: 'sconce', surface: 'backWall', anchor: [0.2, 0.74], w: 0.05, h: 0.18 },
    ],
  },
  L: {
    glyph: 'L', name: 'lounge', tint: '#b7c4a6',
    fill: (rng) => [
      { type: 'rug', anchor: [0.5, 0.5], w: 0.5, h: 0.42, heightWorld: 0.06 },
      { type: 'sofa', anchor: [jit(rng, 0.45, 0.06), 0.2], w: 0.36, h: 0.14, heightWorld: 2.4 },
      { type: 'table', anchor: [0.45, 0.46], w: 0.2, h: 0.15, heightWorld: 2.0, supportRadius: 0.12 },
      { type: 'armchair', anchor: [jit(rng, 0.7, 0.06), 0.6], w: 0.16, h: 0.16, heightWorld: 2.6 },
      { type: 'bookshelf', anchor: [0.09, 0.3], w: 0.1, h: 0.13, heightWorld: 6.2 },
      { type: 'window', surface: 'backWall', anchor: [jit(rng, 0.5, 0.1), 0.58], w: 0.18, h: 0.46 },
    ],
  },
  D: {
    glyph: 'D', name: 'dining', tint: '#cbb795',
    fill: (rng) => [
      { type: 'table', anchor: [0.5, 0.5], w: 0.28, h: 0.2, heightWorld: 2.3, supportRadius: 0.13 },
      { type: 'ladder-chair', anchor: [0.34, 0.4], w: 0.1, h: 0.1, heightWorld: 2.9, supportRadius: 0.07, facing: 'N' },
      { type: 'ladder-chair', anchor: [0.66, 0.4], w: 0.1, h: 0.1, heightWorld: 2.9, supportRadius: 0.07, facing: 'N' },
      { type: 'ladder-chair', anchor: [0.34, 0.62], w: 0.1, h: 0.1, heightWorld: 2.9, supportRadius: 0.07, facing: 'S' },
      { type: 'ladder-chair', anchor: [0.66, 0.62], w: 0.1, h: 0.1, heightWorld: 2.9, supportRadius: 0.07, facing: 'S' },
      { type: 'sideboard', anchor: [0.5, 0.16], w: 0.2, h: 0.1, heightWorld: 3.0 },
      { type: 'window', surface: 'backWall', anchor: [jit(rng, 0.5, 0.1), 0.58], w: 0.2, h: 0.44 },
    ],
  },
  K: {
    glyph: 'K', name: 'kitchen', tint: '#a9bdc3',
    fill: (rng) => [
      { type: 'cabinet', anchor: [0.3, 0.18], w: 0.14, h: 0.1, heightWorld: 4.0, supportPattern: 'none' },
      { type: 'sideboard', anchor: [0.66, 0.16], w: 0.22, h: 0.1, heightWorld: 3.0 },
      { type: 'window', surface: 'backWall', anchor: [jit(rng, 0.5, 0.08), 0.6], w: 0.18, h: 0.4 },
    ],
  },
  B: {
    glyph: 'B', name: 'bedroom', tint: '#b4a9c3',
    fill: (rng) => [
      { type: 'bed', anchor: [jit(rng, 0.42, 0.05), 0.34], w: 0.4, h: 0.34, heightWorld: 1.8 },
      { type: 'nightstand', anchor: [0.7, 0.22], w: 0.08, h: 0.08, heightWorld: 2.2 },
      { type: 'dresser', anchor: [0.85, 0.62], w: 0.13, h: 0.1, heightWorld: 3.4 },
      { type: 'window', surface: 'backWall', anchor: [jit(rng, 0.45, 0.1), 0.58], w: 0.17, h: 0.44 },
      { type: 'picture', surface: 'backWall', anchor: [0.78, 0.6], w: 0.1, h: 0.24 },
    ],
  },
  O: {
    glyph: 'O', name: 'office', tint: '#a9b1c3',
    fill: (rng) => [
      { type: 'standing-desk', anchor: [jit(rng, 0.42, 0.05), 0.22], w: 0.22, h: 0.1, heightWorld: 4.2, supportRadius: 0.12 },
      { type: 'computer-chair', anchor: [0.42, 0.38], w: 0.1, h: 0.1, heightWorld: 2.8, supportRadius: 0.1 },
      { type: 'rack-shelf', anchor: [0.88, 0.2], w: 0.1, h: 0.12, heightWorld: 5.2 },
      { type: 'bookshelf', anchor: [0.1, 0.28], w: 0.1, h: 0.12, heightWorld: 6.0 },
    ],
  },
  S: {
    glyph: 'S', name: 'storage', tint: '#b9a98f',
    fill: (rng) => [
      { type: 'dresser', anchor: [0.3, 0.3], w: 0.16, h: 0.12, heightWorld: 3.6 },
      { type: 'cabinet', anchor: [0.7, 0.26], w: 0.12, h: 0.1, heightWorld: 4.2, supportPattern: 'none' },
      { type: 'rack-shelf', anchor: [0.5, 0.7], w: 0.12, h: 0.1, heightWorld: 5.0 },
    ],
  },
  // Wet rooms — see floorplan-livability.plan.md. Only `toilet` renders as a
  // bath-specific motif today; the vanity/washer/dryer are `cabinet` proxies until
  // dedicated fixture motifs land in room-scene-elements.js. The relationship layer
  // does not depend on the motifs.
  W: {
    glyph: 'W', name: 'bathroom', tint: '#bcd2d0',
    fill: (rng) => [
      { type: 'toilet', anchor: [0.78, 0.24], w: 0.16, h: 0.2, heightWorld: 1.4 },
      { type: 'cabinet', anchor: [jit(rng, 0.3, 0.05), 0.2], w: 0.22, h: 0.12, heightWorld: 3.0, supportPattern: 'none' }, // vanity + sink
      { type: 'sconce', surface: 'backWall', anchor: [0.3, 0.74], w: 0.05, h: 0.16 },
      { type: 'picture', surface: 'backWall', anchor: [0.62, 0.6], w: 0.08, h: 0.2 },
    ],
  },
  Y: {
    glyph: 'Y', name: 'laundry', tint: '#cdc6bd',
    fill: (rng) => [
      { type: 'cabinet', anchor: [0.3, 0.2], w: 0.2, h: 0.16, heightWorld: 3.0, supportPattern: 'none' },  // washer
      { type: 'cabinet', anchor: [0.55, 0.2], w: 0.2, h: 0.16, heightWorld: 3.0, supportPattern: 'none' },  // dryer
      { type: 'rack-shelf', anchor: [0.85, 0.5], w: 0.12, h: 0.1, heightWorld: 5.0 },
    ],
  },
};

// ── room relationship spec — the livability constraint layer ─────────────────
// Per-archetype declarations the layout pass reads to keep semi-random draws
// LIVABLE (floorplan-livability.plan.md). Mirrors the archetypeArea() move: each
// room declares what it needs (relationships, not furniture); the placer obeys.
//
//   needsWindow   'egress' | 'yes' | 'preferred' | 'no'
//                 'egress'/'yes' ⇒ INVARIANT: cell must own a perimeter segment
//                 with a cut window ('egress' = egress-sized). 'preferred' ⇒ a
//                 gradient bonus only.
//   canBeInterior whether the cell may sit landlocked (no exterior wall). The
//                 relief valve that makes the daylight invariant SOLVABLE: wet/
//                 service rooms absorb the interior so B/L always claim perimeter.
//   privacyDepth  0 (entry/circulation) → 3 (bed/bath). Drives front→back order.
//   minDim        smallest allowed short dimension (ft) — area alone is a lie.
//   maxAspect     long/short clamp (null = unconstrained circulation).
//   mustTouch     hard shared-wall/shared-cell requirements. Keywords: 'exterior',
//                 'circulation' (hall/landing/core), 'core' (open public core),
//                 'wetWall' (shared plumbing wall); else a glyph.
//   nearTo        soft same-zone preference (gradient).
//   mustNotTouch  forbids a DOOR between the pair (a shared WALL is still allowed —
//                 e.g. bath/kitchen share plumbing but the bath door may not open
//                 onto the kitchen). 'entrySightline' = not on the entry axis.
//   reachVia      access-graph invariant: reachable from the entry passing only
//                 through cells of this class or shallower. 'exterior' | 'public' |
//                 'circulation' | 'any'.
export const RELATIONSHIPS = {
  E: { needsWindow: 'no',        canBeInterior: true,  privacyDepth: 0, minDim: 5,    maxAspect: 2.5,  mustTouch: ['exterior', 'L'],     nearTo: [],         mustNotTouch: [],                  reachVia: 'exterior' },
  H: { needsWindow: 'no',        canBeInterior: true,  privacyDepth: 0, minDim: 3.5,  maxAspect: null, mustTouch: [],                    nearTo: [],         mustNotTouch: [],                  reachVia: 'public' },
  L: { needsWindow: 'yes',       canBeInterior: false, privacyDepth: 1, minDim: 11,   maxAspect: 1.8,  mustTouch: ['circulation', 'core'], nearTo: [],       mustNotTouch: [],                  reachVia: 'public' },
  D: { needsWindow: 'preferred', canBeInterior: true,  privacyDepth: 1, minDim: 9,    maxAspect: 2.0,  mustTouch: ['K', 'L'],            nearTo: [],         mustNotTouch: ['W'],               reachVia: 'public' },
  K: { needsWindow: 'preferred', canBeInterior: true,  privacyDepth: 2, minDim: 8,    maxAspect: 2.2,  mustTouch: ['D', 'wetWall'],      nearTo: ['L'],      mustNotTouch: ['B'],               reachVia: 'public' },
  B: { needsWindow: 'egress',    canBeInterior: false, privacyDepth: 3, minDim: 10,   maxAspect: 1.8,  mustTouch: ['circulation'],       nearTo: ['W'],      mustNotTouch: ['entrySightline'],  reachVia: 'circulation' },
  O: { needsWindow: 'preferred', canBeInterior: true,  privacyDepth: 2, minDim: 8,    maxAspect: 2.0,  mustTouch: ['circulation'],       nearTo: [],         mustNotTouch: [],                  reachVia: 'circulation' },
  S: { needsWindow: 'no',        canBeInterior: true,  privacyDepth: 1, minDim: 4,    maxAspect: 3.0,  mustTouch: ['circulation'],       nearTo: ['K', 'E'], mustNotTouch: [],                  reachVia: 'any' },
  W: { needsWindow: 'no',        canBeInterior: true,  privacyDepth: 3, minDim: 5,    maxAspect: 2.0,  mustTouch: ['wetWall', 'circulation'], nearTo: ['B'], mustNotTouch: ['K', 'D', 'L'],     reachVia: 'circulation' },
  Y: { needsWindow: 'no',        canBeInterior: true,  privacyDepth: 2, minDim: 5,    maxAspect: 2.5,  mustTouch: ['wetWall'],           nearTo: ['K'],      mustNotTouch: ['L', 'D'],          reachVia: 'circulation' },
};

// privacy depth of a glyph (0 public/circulation → 3 private), defaulting to the
// public band — used to group a row's sleeping/wet rooms together.
const ROOM_DEPTH = (g) => (RELATIONSHIPS[g]?.privacyDepth ?? 1);
// the smallest short-dimension a room of this glyph tolerates (ft) — the dimension
// floor that keeps a budget-correct-but-unlivable slab (e.g. 4×28) from appearing.
const ROOM_MIN_DIM = (g, fallback = 8) => (RELATIONSHIPS[g]?.minDim ?? fallback);

const PUBLIC = ['L', 'D', 'L'];
const PRIVATE = ['B', 'O', 'B'];
const SERVICE = ['K', 'S', 'O'];

// ── fractal BSP generator ───────────────────────────────────────────────────
// World unit is one FOOT. Defaults are sized to a standard bungalow: a smallest
// room dimension of ~9 ft (a small bedroom/bath), corridors ~3.5 ft wide.
const HALL = 3.5;      // corridor thickness (feet) — corridor mode only
const MIN_ROOM = 9;    // smallest room dimension before a split is refused (feet)

// `corridors`: insert a HALL gap at every split (a circulation tree of corridors).
// When false (HOUSE mode), siblings share an exact cut edge — adjacent rooms get a
// single shared wall, doors punch directly between them, and no two walls ever land
// ~1 unit apart (the misaligned-hall artifact is impossible without halls).
function generateRooms(seed, width, height, maxDepth, corridors = false, minRoom = MIN_ROOM) {
  const rng = mulberry32(seed);
  const rooms = [];
  const halls = [];
  const gap = corridors ? HALL : 0;
  function split(r, depth) {
    const canH = r.w >= minRoom * 2 + gap;
    const canV = r.h >= minRoom * 2 + gap;
    // stop: max depth, too small, or a seeded leaf chance once past depth 1
    if (depth >= maxDepth || (!canH && !canV) || (depth > 1 && rng() < 0.28)) {
      rooms.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      return;
    }
    const horizontal = canH && (!canV || r.w >= r.h);
    const f = 0.38 + 0.24 * rng();
    if (horizontal) {
      const cut = r.x + r.w * f;
      if (corridors) halls.push({ x: cut - HALL / 2, y: r.y, w: HALL, h: r.h, axis: 'v' });
      split({ x: r.x, y: r.y, w: (cut - gap / 2) - r.x, h: r.h }, depth + 1);
      split({ x: cut + gap / 2, y: r.y, w: (r.x + r.w) - (cut + gap / 2), h: r.h }, depth + 1);
    } else {
      const cut = r.y + r.h * f;
      if (corridors) halls.push({ x: r.x, y: cut - HALL / 2, w: r.w, h: HALL, axis: 'h' });
      split({ x: r.x, y: r.y, w: r.w, h: (cut - gap / 2) - r.y }, depth + 1);
      split({ x: r.x, y: cut + gap / 2, w: r.w, h: (r.y + r.h) - (cut + gap / 2) }, depth + 1);
    }
  }
  split({ x: 2, y: 2, w: width - 4, h: height - 4 }, 0);
  return { rooms, halls, rng };
}

// Assign archetypes: smallest→service, largest→public, entry nearest origin.
function assignArchetypes(rooms, rng) {
  const byArea = [...rooms].sort((a, b) => (b.w * b.h) - (a.w * a.h));
  byArea.forEach((r, i) => {
    const t = i / Math.max(1, byArea.length - 1);
    r.glyph = t < 0.34 ? pick(rng, PUBLIC) : t < 0.7 ? pick(rng, PRIVATE) : pick(rng, SERVICE);
  });
  let entry = rooms[0];
  for (const r of rooms) if ((r.x + r.y) < (entry.x + entry.y)) entry = r;
  entry.glyph = 'E';
}

function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

// A door wherever a room edge abuts a hallway, at the shared-segment midpoint —
// so every door sits on a corridor and doors along a corridor line up.
function computeDoors(rooms, halls) {
  const doors = [];
  const eps = 0.8;
  for (let ri = 0; ri < rooms.length; ri += 1) {
    const r = rooms[ri];
    for (const h of halls) {
      const oy = overlap(r.y, r.y + r.h, h.y, h.y + h.h);
      const ox = overlap(r.x, r.x + r.w, h.x, h.x + h.w);
      const my = Math.max(r.y, h.y) + oy / 2;
      const mx = Math.max(r.x, h.x) + ox / 2;
      if (oy > HALL * 0.5 && Math.abs((r.x + r.w) - h.x) < eps) doors.push({ x: r.x + r.w, y: my, room: ri, edge: 'E' });
      if (oy > HALL * 0.5 && Math.abs(r.x - (h.x + h.w)) < eps) doors.push({ x: r.x, y: my, room: ri, edge: 'W' });
      if (ox > HALL * 0.5 && Math.abs((r.y + r.h) - h.y) < eps) doors.push({ x: mx, y: r.y + r.h, room: ri, edge: 'S' });
      if (ox > HALL * 0.5 && Math.abs(r.y - (h.y + h.h)) < eps) doors.push({ x: mx, y: r.y, room: ri, edge: 'N' });
    }
  }
  return doors;
}

// HOUSE-mode doors: rooms tile the footprint and share exact edges, so connect
// them directly. Build the room-adjacency graph (shared edge with enough overlap
// for a doorway), then door a spanning tree from the entry — every room reachable,
// one door into the network, no corridor needed.
function computeRoomDoors(rooms, entryIdx) {
  const eps = 0.5, MIN_SHARE = 3.5;   // a shared wall needs ~3.5 ft for a doorway
  const adj = [];
  const share = (i, j) => {
    const A = rooms[i], B = rooms[j];
    const vOv = overlap(A.y, A.y + A.h, B.y, B.y + B.h);
    const hOv = overlap(A.x, A.x + A.w, B.x, B.x + B.w);
    if (vOv > MIN_SHARE && Math.abs((A.x + A.w) - B.x) < eps) adj.push({ a: i, b: j, axis: 'v', at: B.x, lo: Math.max(A.y, B.y), hi: Math.min(A.y + A.h, B.y + B.h) });
    if (vOv > MIN_SHARE && Math.abs((B.x + B.w) - A.x) < eps) adj.push({ a: i, b: j, axis: 'v', at: A.x, lo: Math.max(A.y, B.y), hi: Math.min(A.y + A.h, B.y + B.h) });
    if (hOv > MIN_SHARE && Math.abs((A.y + A.h) - B.y) < eps) adj.push({ a: i, b: j, axis: 'h', at: B.y, lo: Math.max(A.x, B.x), hi: Math.min(A.x + A.w, B.x + B.w) });
    if (hOv > MIN_SHARE && Math.abs((B.y + B.h) - A.y) < eps) adj.push({ a: i, b: j, axis: 'h', at: A.y, lo: Math.max(A.x, B.x), hi: Math.min(A.x + A.w, B.x + B.w) });
  };
  for (let i = 0; i < rooms.length; i += 1) for (let j = i + 1; j < rooms.length; j += 1) share(i, j);
  const byRoom = new Map();
  adj.forEach((e, k) => { (byRoom.get(e.a) || byRoom.set(e.a, []).get(e.a)).push(k); (byRoom.get(e.b) || byRoom.set(e.b, []).get(e.b)).push(k); });
  const start = entryIdx >= 0 ? entryIdx : 0;
  const seen = new Set([start]), queue = [start], doors = [];
  while (queue.length) {
    const r = queue.shift();
    for (const k of (byRoom.get(r) || [])) {
      const e = adj[k], other = e.a === r ? e.b : e.a;
      if (seen.has(other)) continue;
      seen.add(other); queue.push(other);
      const mid = (e.lo + e.hi) / 2;
      if (e.axis === 'v') doors.push({ x: e.at, y: mid, room: r, edge: 'E' });
      else doors.push({ x: mid, y: e.at, room: r, edge: 'S' });
    }
  }
  return doors;
}

/**
 * Generate a full floor plan from a seed.
 * @param {object} opts { width, height, maxDepth, corridors=false }
 *   corridors:false (default) → HOUSE: rooms share single walls, doors between them.
 *   corridors:true → a circulation tree of hallways (the original model).
 * @returns {{ seed, width, height, rooms:[{x,y,w,h,glyph}], halls, doors, corridors }}
 */
export function generatePlan(seed, { width = 46, height = 34, maxDepth = 3, corridors = false, minRoom = MIN_ROOM } = {}) {
  const { rooms, halls, rng } = generateRooms(seed, width, height, maxDepth, corridors, minRoom);
  assignArchetypes(rooms, rng);
  const entryIdx = rooms.findIndex((r) => r.glyph === 'E');
  const doors = corridors ? computeDoors(rooms, halls) : computeRoomDoors(rooms, entryIdx);
  return { seed, width, height, rooms, halls, doors, corridors };
}

/** Expand one room's archetype into boxNet roomConcept.elements (seeded). */
export function fillRoom(room, seed = 1) {
  const arche = ARCHETYPES[room.glyph] || ARCHETYPES.S;
  return arche.fill(mulberry32(seed));
}

// ── geometry-aware ROOM ARRANGERS (richer than the flat archetype lists) ─────
// These read the room's real feet dimensions and compose RELATED pieces — a kitchen
// counter run (+ adaptive island), a living-room seating group facing a focal wall —
// instead of scattering. Elements use the same {type, anchor:[u,v], w, h, heightWorld}
// contract; u runs along width, v along depth (v≈0 = back wall). w/h are fractions of
// the room, so we divide real feet by the room size.

/** Kitchen: real LIBRARY ASSETS — a base-counter run along the longest wall with a
 *  fridge, sink and stove worked in (the work triangle), an island when the zone is
 *  wide AND deep enough for aisles, else a parallel galley run when very deep. The
 *  units are `local` assets, so `facing` aims their fronts into the room. */
export function arrangeKitchen(rng = Math.random, { w = 12, h = 10, wall = null } = {}) {
  const els = [];
  // `wall` (optional) names the EXTERIOR edge to seat the counter against —
  // 'N'(y0)/'S'(y1) force a horizontal run, 'E'(x1)/'W'(x0) a vertical one. Without it,
  // run along the longer wall hugging the small-coordinate edge (unchanged behavior).
  let horiz = w >= h;
  if (wall === 'N' || wall === 'S') horiz = true;
  else if (wall === 'E' || wall === 'W') horiz = false;
  const farSide = wall === 'S' || wall === 'E';          // hug the high-coordinate edge
  const alongFeet = horiz ? w : h, perpFeet = horiz ? h : w;
  const into = horiz ? (farSide ? 'S' : 'N') : (farSide ? 'W' : 'E');   // counter faces into the room
  const far = horiz ? (farSide ? 'N' : 'S') : (farSide ? 'E' : 'W');    // opposite wall (galley run)
  const place = (aC, pC, aLenFt, pLenFt, asset, hgt, facing) => els.push(horiz
    ? { type: asset, asset, anchor: [aC, pC], w: aLenFt / w, h: pLenFt / h, heightWorld: hgt, facing }
    : { type: asset, asset, anchor: [pC, aC], w: pLenFt / w, h: aLenFt / h, heightWorld: hgt, facing });
  const margin = 0.6, cDepth = 2.2;
  const runFeet = alongFeet - 2 * margin;
  const nUnit = Math.max(3, Math.round(runFeet / 2.6));
  const uFeet = runFeet / nUnit;
  const edgeP = (cDepth / 2) / perpFeet;
  const wallP = farSide ? 1 - edgeP : edgeP;             // counter row hugs the named wall
  const galleyP = farSide ? edgeP : 1 - edgeP;           // parallel run on the opposite wall
  const sinkAt = Math.max(1, Math.round(nUnit * 0.35));
  const stoveAt = Math.min(nUnit - 1, Math.max(sinkAt + 1, Math.round(nUnit * 0.7)));
  for (let i = 0; i < nUnit; i += 1) {
    const aC = (margin + (i + 0.5) * uFeet) / alongFeet;
    const asset = i === 0 ? 'kitchen-fridge' : i === sinkAt ? 'kitchen-sink'
      : i === stoveAt ? 'kitchen-stove' : 'kitchen-counter';
    place(aC, wallP, uFeet * 0.96, cDepth, asset, asset === 'kitchen-fridge' ? 5.6 : 3.0, into);
  }
  if (w >= 12 && h >= 13) {                               // island with aisles both sides
    place(0.5, 0.5, Math.min(6, alongFeet * 0.4), Math.min(2.6, perpFeet * 0.24), 'kitchen-counter', 3.0, into);
  } else if (perpFeet >= 17) {                            // very deep → parallel galley run
    for (let i = 0; i < nUnit; i += 1) {
      const aC = (margin + (i + 0.5) * uFeet) / alongFeet;
      place(aC, galleyP, uFeet * 0.96, cDepth, 'kitchen-counter', 3.0, far);
    }
  }
  return els;
}

/** Living room: a seating group facing the focal (back) wall — media unit + bookshelf
 *  on the wall, sofa across from it, coffee table between, armchairs flanking, rug under. */
export function arrangeLiving(rng = Math.random, { w = 14, h = 14 } = {}) {
  const j = (c, a) => c + (rng() * 2 - 1) * a;            // small seeded jitter
  return [
    { type: 'media-unit', anchor: [j(0.5, 0.04), 0.07], w: Math.min(7, w * 0.5) / w, h: 1.6 / h, heightWorld: 2.2 },
    { type: 'bookshelf', anchor: [0.11, 0.13], w: 1.2 / w, h: 1.2 / h, heightWorld: 6.0 },
    { type: 'rug', anchor: [0.5, 0.5], w: Math.min(11, w * 0.72) / w, h: Math.min(9, h * 0.6) / h, heightWorld: 0.06 },
    // real couch asset across the room; armchairs (box-net) angled toward the centre
    { type: 'sofa', asset: 'modern-couch', anchor: [j(0.5, 0.04), 0.72], w: Math.min(8.5, w * 0.58) / w, h: 3.2 / h, heightWorld: 2.6 },
    { type: 'table', anchor: [0.5, 0.47], w: Math.min(4, w * 0.3) / w, h: 2 / h, heightWorld: 1.4 },
    { type: 'armchair', anchor: [j(0.2, 0.03), 0.46], w: 2.5 / w, h: 2.5 / h, heightWorld: 2.6, facing: 'E' },
    { type: 'armchair', anchor: [j(0.8, 0.03), 0.46], w: 2.5 / w, h: 2.5 / h, heightWorld: 2.6, facing: 'W' },
  ];
}

/** Dining: a table centred in the room, chairs arrayed around it and each ORIENTED
 *  to point at the table (via `facing`), a sideboard on the back wall. */
export function arrangeDining(rng = Math.random, { w = 12, h = 12 } = {}) {
  const els = [];
  const tWft = Math.min(6, w * 0.42), tHft = Math.min(4, h * 0.42);
  const tw = tWft / w, th = tHft / h;
  els.push({ type: 'dining-table', anchor: [0.5, 0.5], w: tw, h: th, heightWorld: 2.4 });
  els.push({ type: 'sideboard', anchor: [0.5, 0.09], w: Math.min(6, w * 0.4) / w, h: 1.4 / h, heightWorld: 3.0 });
  const chW = 1.6 / w, chH = 1.6 / h;
  const offU = tw / 2 + 1.1 / w, offV = th / 2 + 1.1 / h;     // chair centres just past the table edge
  const chair = (u, v, facing) => els.push({ type: 'ladder-chair', anchor: [u, v], w: chW, h: chH, heightWorld: 2.9, supportRadius: 0.07, facing });
  const nSide = tWft >= 5 ? 2 : 1;                            // a longer table seats two per long side
  for (let i = 0; i < nSide; i += 1) {
    const u = nSide === 1 ? 0.5 : 0.5 + (i - (nSide - 1) / 2) * (tw * 0.6);
    chair(u, 0.5 - offV, 'N');                               // above the table → face +y toward it
    chair(u, 0.5 + offV, 'S');                               // below → face −y
  }
  chair(0.5 - offU, 0.5, 'E');                               // left → face +x
  chair(0.5 + offU, 0.5, 'W');                               // right → face −x
  return els;
}

/** Bedroom: bed against the back wall, nightstand beside it, dresser on the far wall,
 *  and — in larger rooms — a study desk with its chair facing the desk. Always ≥2 pieces. */
export function arrangeBedroom(rng = Math.random, { w = 11, h = 11 } = {}) {
  const els = [];
  const area = w * h;
  const bedW = Math.min(5, w * 0.46), bedD = Math.min(6.7, h * 0.5);
  const bedU = Math.min(0.62, Math.max(0.32, bedW / w / 2 + 0.06));
  els.push({ type: 'bed', anchor: [bedU, (bedD / h) / 2 + 0.04], w: bedW / w, h: bedD / h, heightWorld: 1.8 });
  els.push({ type: 'nightstand', anchor: [Math.min(0.9, bedU + bedW / w / 2 + 1.3 / w), 0.13], w: 1.6 / w, h: 1.6 / h, heightWorld: 2.2 });
  if (area >= 90) els.push({ type: 'dresser', anchor: [0.84, 0.62], w: Math.min(4, w * 0.32) / w, h: 1.8 / h, heightWorld: 3.2 });
  if (area >= 130 && rng() < 0.6) {                          // study nook: desk asset + chair facing it
    const desk = pick(rng, ['study-table', 'computer-table', 'standing-desk']);   // deterministic by seed
    els.push({ type: desk, asset: desk, anchor: [0.22, 0.9], w: Math.min(4, w * 0.34) / w, h: 1.8 / h, heightWorld: 2.5, facing: 'S' });
    els.push({ type: 'computer-chair', anchor: [0.22, 0.75], w: 1.7 / w, h: 1.7 / h, heightWorld: 2.8, facing: 'N' });
  }
  els.push({ type: 'picture', surface: 'backWall', anchor: [0.72, 0.6], w: 0.12, h: 0.26 });
  return els;
}

/** Office: a real desk asset against the back wall (working side into the room) with
 *  its chair facing it, plus shelving. The desk variant is seeded → deterministic. */
export function arrangeOffice(rng = Math.random, { w = 11, h = 11 } = {}) {
  const els = [];
  const desk = pick(rng, ['computer-table', 'study-table', 'standing-desk']);
  els.push({ type: desk, asset: desk, anchor: [0.4, 0.18], w: Math.min(5, w * 0.42) / w, h: 2.2 / h, heightWorld: 2.5, facing: 'N' });
  els.push({ type: 'computer-chair', anchor: [0.4, 0.37], w: 1.8 / w, h: 1.8 / h, heightWorld: 2.8, facing: 'S' });
  els.push({ type: 'bookshelf', anchor: [0.88, 0.42], w: 1.2 / w, h: Math.min(4, h * 0.3) / h, heightWorld: 6.0 });
  if (w * h >= 120) els.push({ type: 'rack-shelf', anchor: [0.12, 0.72], w: 1.2 / w, h: Math.min(3, h * 0.24) / h, heightWorld: 5.0 });
  return els;
}

/** Furniture for a room: geometry-aware arrangers for kitchen/living/dining/bedroom,
 *  the flat archetype list otherwise. `dims` are the room's interior feet {w, h}. */
export function furnishElements(glyph, seed = 1, dims = {}) {
  const rng = mulberry32((seed >>> 0) || 1);
  if (glyph === 'K') return arrangeKitchen(rng, dims);
  if (glyph === 'L') return arrangeLiving(rng, dims);
  if (glyph === 'D') return arrangeDining(rng, dims);
  if (glyph === 'B') return arrangeBedroom(rng, dims);
  if (glyph === 'O') return arrangeOffice(rng, dims);
  return (ARCHETYPES[glyph] || ARCHETYPES.S).fill(rng);
}

// ── COMMAND POSITION (movement-flow, kernel #2) ─────────────────────────────────
// The arrangers above lay a room out CANONICALLY: the door is assumed at the front
// ('S' wall), so the anchor piece (bed/desk/sofa) backs the opposite wall and faces the
// door. But generateProgramPlan doors land on a room's ACTUAL edge (private rows door onto
// the hall on their 'N' wall). `orientElementsToDoor` rotates the whole canonical layout so
// its front aligns with the real door edge — the anchor then backs a solid wall and faces
// the door (the "command position"), instead of jamming its headboard under the doorway.
// 180° (the common 'N'-door case) is extent-safe; a 90° turn swaps the piece's w/h footprint.
// See graph/movement-flow.plan.md (kernel #2) and graph/movement-flow.js (facingToward).
const FACING_SPIN = { S: 0, E: 1, N: 2, W: 3 };       // CW quarter-turns from the 'S' front
const SPIN_FACING = ['S', 'E', 'N', 'W'];
const SURFACE_EDGE = { backWall: 'N', rightWall: 'E', frontWall: 'S', leftWall: 'W' };
const EDGE_SURFACE = { N: 'backWall', E: 'rightWall', S: 'frontWall', W: 'leftWall' };
export function orientElementsToDoor(elements, doorEdge, W = 1, H = 1) {
  const k = FACING_SPIN[doorEdge] ?? 0;               // door 'S' ⇒ already canonical
  if (!k) return elements;
  const rotUV = (u, v) => { let x = u, y = v; for (let i = 0; i < k; i += 1) { const nx = y, ny = 1 - x; x = nx; y = ny; } return [x, y]; };
  const spin = (letter) => SPIN_FACING[(FACING_SPIN[letter] + k) % 4];
  const odd = k % 2 === 1;
  return elements.map((e) => {
    const out = { ...e };
    if (Array.isArray(e.anchor)) out.anchor = rotUV(e.anchor[0], e.anchor[1]);
    if (e.facing != null && FACING_SPIN[e.facing] != null) out.facing = spin(e.facing);
    if (e.surface && SURFACE_EDGE[e.surface]) out.surface = EDGE_SURFACE[spin(SURFACE_EDGE[e.surface])];
    if (odd && e.w != null && e.h != null) { out.w = (e.h * H) / W; out.h = (e.w * W) / H; }  // 90°: footprint swaps
    return out;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PROGRAM-DRIVEN, OPEN-SPACE-FIRST GENERATOR
// Open space is the SEED, not a leftover: reserve a wall-less public core, carve
// private rooms against it, door them straight onto it, and only spend a hallway
// when a room can't reach the core. Budget (footprint area) sizes the program —
// bigger house = bigger core AND bigger rooms — and the level ROLE picks whether
// the open zone is a living core (ground) or a stair landing/hall (upper).
// Plan: floorplan-program.plan.md. Contract matches generatePlan: {rooms,halls,doors}.
// ════════════════════════════════════════════════════════════════════════════

const PROGRAM_HALL = 3.75;     // landing / corridor width (feet)

// ── furniture-derived room budgets ──────────────────────────────────────────
// The layout is budgeted from WHAT EACH ROOM HOLDS, not arbitrary fractions. The
// presets in room-scene-elements.js carry only relative areaShare/aspect, so we
// ground each furniture type in an absolute floor FOOTPRINT (sqft) — derived from
// that aspect + a real depth. Summed over an archetype's `fill()` list (÷ a packing
// target for circulation), this gives the area a room of that kind WANTS. Rooms are
// then allocated the footprint in proportion to these budgets (the "fractal" share),
// so a bedroom is wider than a closet and bigger houses grow rooms AND add them.
const FURNITURE_FT = {
  sofa: 21, 'modern-couch': 22, table: 4, 'dining-table': 18,
  armchair: 6, 'club-chair': 6, 'lounge-chair': 6, 'tub-chair': 6, 'single-sofa': 6,
  chair: 3.5, 'yoke-chair': 3.5, 'ladder-chair': 3.5, 'computer-chair': 3.5, stool: 2,
  bench: 6, bed: 30, nightstand: 2.5, dresser: 6, drawers: 4, tallboy: 4,
  cabinet: 6, sideboard: 8, bar: 12, bookshelf: 4, 'rack-shelf': 5,
  'media-unit': 7, 'tv-stand': 7, 'standing-desk': 9, desk: 9, toilet: 3,
  // wall-mounted or floor-overlapping pieces block no usable floor → 0
  window: 0, door: 0, picture: 0, sconce: 0, tv: 0, rug: 0, runner: 0, monitor: 0, laptop: 0, keyboard: 0,
};
// furniture-to-floor coverage a room packs to; the remainder is circulation
const PACKING = { L: 0.30, D: 0.28, K: 0.22, B: 0.34, O: 0.30, S: 0.5, E: 0.3, W: 0.30, Y: 0.45 };

/** Furniture-derived target floor area (sqft) an archetype WANTS = Σ its piece
 *  footprints ÷ its packing target (circulation around the furniture). */
export function archetypeArea(glyph) {
  const arche = ARCHETYPES[glyph];
  if (!arche || !arche.fill) return 90;
  let furn = 0;
  for (const p of arche.fill(mulberry32(1))) furn += FURNITURE_FT[p.type] ?? 5;
  return Math.max(48, furn / (PACKING[glyph] ?? 0.3));
}

// ── HOUSE TIERS — bound the program so a house reads as a HOUSE, not a dorm row ──
// A tier fixes the BEDROOM budget, the open-core zones, the private-room wishlist, and
// a sensible default footprint. The floor COUNT stays caller-specified (input.levels);
// a footprint bigger than the program needs grows the rooms + open core rather than
// adding a longer row of bedrooms (that single long row is what reads as a dorm).
//   beds      total bedrooms in the house (on the ground when single-storey, upstairs
//             when there's an upper floor — so the house has the SAME bed count either way)
//   study     whether the program includes an office/study
//   core      the open public core's program zones (living/kitchen[/dining])
//   maxPerRow hard cap on private rooms in one back row → never a dorm corridor
//   footprint default usable size when the caller doesn't pass width/height
export const HOUSE_TIERS = {
  cottage: { beds: 1, study: false, core: ['L', 'K'],      maxPerRow: 2, footprint: { width: 30, height: 26 } },
  house:   { beds: 3, study: true,  core: ['L', 'K', 'D'], maxPerRow: 3, footprint: { width: 44, height: 32 } },
  villa:   { beds: 4, study: true,  core: ['L', 'K', 'D'], maxPerRow: 4, footprint: { width: 56, height: 40 } },
};
export const DEFAULT_TIER = 'house';

/** Resolve a tier name (or a partial override object) into a full tier config. */
export function resolveTier(tier) {
  if (tier && typeof tier === 'object') return { ...HOUSE_TIERS[DEFAULT_TIER], ...tier };
  return HOUSE_TIERS[tier] || HOUSE_TIERS[DEFAULT_TIER];
}

// Split `total` into segments PROPORTIONAL to weights (each room's furniture budget),
// summing exactly to total, lightly jittered. `minSeg` floors each segment — a single
// number applied to all, OR a per-segment array (so a bedroom floors wider than a bath).
function partitionWeighted(total, weights, rng, minSeg) {
  const n = weights.length;
  if (n <= 1) return [[0, total]];
  const minOf = (i) => (Array.isArray(minSeg) ? (minSeg[i] ?? 0) : minSeg);
  const wsum = weights.reduce((a, b) => a + b, 0) || n;
  let sizes = weights.map((w) => (w / wsum) * total * (0.9 + 0.2 * rng()));
  let s = sizes.reduce((a, b) => a + b, 0);
  sizes = sizes.map((v) => (v * total) / s);
  sizes = sizes.map((v, i) => Math.max(minOf(i), v));   // floor each room (per-glyph min)
  s = sizes.reduce((a, b) => a + b, 0);
  sizes = sizes.map((v) => (v * total) / s);            // renormalize to exact total
  const segs = []; let c = 0;
  for (const sz of sizes) { segs.push([c, c + sz]); c += sz; }
  segs[n - 1][1] = total;
  return segs;
}

// Raise every weight to ≥ ratio× the largest so no room is a 'broom closet' relative
// to its siblings — rooms in a row share the band depth, so area ∝ this width weight.
function balanceWeights(weights, ratio = 0.5) {
  const mx = Math.max(...weights, 0);
  return weights.map((w) => Math.max(w, mx * ratio));
}

// Pick private rooms from a priority wishlist until the available band area is
// budgeted full (furniture budgets), so a bigger band affords MORE rooms.
function chooseRooms(bandArea, wishlist, minArea) {
  const chosen = [];
  let acc = 0;
  for (const g of wishlist) {
    const a = archetypeArea(g);
    if (chosen.length && acc + a > bandArea + minArea) break;   // would overflow the band
    chosen.push(g); acc += a;
    if (acc >= bandArea) break;                                  // band budgeted full
  }
  return chosen.length ? chosen : [wishlist[0]];
}

// spread k items across r rows as evenly as possible, back rows first
function distribute(k, r) {
  if (r <= 1) return [k];
  const out = new Array(r).fill(0);
  for (let i = 0; i < k; i += 1) out[(r - 1) - (i % r)] += 1;
  return out;
}

/**
 * Generate an open-space-first floor plan.
 * @param {number} seed
 * @param {object} opts { width, height, role:'ground'|'upper'|'basement', hasUpper,
 *                        reservedOpen:{x0,x1,y0,y1}|null, inset, tier, terrace }
 *   `tier` ('cottage'|'house'|'villa' or an override object) bounds the program so the
 *   floor reads as a house, not a dorm row. `terrace:true` cuts a deck door (otherwise
 *   the deck anchor is reserved but no exterior door is opened — see `terraceZone`).
 * @returns {{ seed, width, height, rooms:[{x,y,w,h,glyph,open?}], halls,
 *            doors:[{x,y,edge,room,entry?,exterior?,leadsTo?}],
 *            stairZone:{x0,x1,y0,y1}|null, stairDir:'+x'|'+y', openCells:number[],
 *            terraceZone:{x0,x1,y0,y1}|null }}
 *   `rooms` are private/public cells; `halls` are circulation cells; both tile the
 *   usable rect. `stairZone`+`stairDir` (ground only) seat the meru in the open core.
 *   Every EXTERIOR door carries `leadsTo:'entrance'|'terrace'` — the only places an
 *   envelope door is allowed to open; `terraceZone` reserves where a future deck attaches.
 */
export function generateProgramPlan(seed, {
  width = 46, height = 34, role = 'ground', hasUpper = false, reservedOpen = null, inset = 2, stairSpan = 3.4,
  tier = DEFAULT_TIER, terrace = false, balcony = false,
} = {}) {
  const t = resolveTier(tier);
  const rng = mulberry32((seed >>> 0) || 1);
  const U = { x0: inset, y0: inset, x1: width - inset, y1: height - inset };
  const uw = U.x1 - U.x0, uh = U.y1 - U.y0, area = uw * uh;
  const wide = uw >= uh;
  const AL = wide ? uw : uh;          // length along the spine
  const DE = wide ? uh : uw;          // depth across the spine

  // normalized (along a, depth d) → actual rect / box / door
  const toRect = (a0, a1, d0, d1) => (wide
    ? { x: U.x0 + a0, y: U.y0 + d0, w: a1 - a0, h: d1 - d0 }
    : { x: U.x0 + d0, y: U.y0 + a0, w: d1 - d0, h: a1 - a0 });
  const toBox = (a0, a1, d0, d1) => { const r = toRect(a0, a1, d0, d1); return { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }; };
  const doorAt = (a, d) => (wide
    ? { x: U.x0 + a, y: U.y0 + d, edge: 'N' }
    : { x: U.x0 + d, y: U.y0 + a, edge: 'E' });
  // reservedOpen depth band (normalized), so an open zone can be placed to cover it
  const resD = reservedOpen ? (wide
    ? [reservedOpen.y0 - U.y0, reservedOpen.y1 - U.y0]
    : [reservedOpen.x0 - U.x0, reservedOpen.x1 - U.x0]) : null;

  const rooms = [], halls = [], doors = [], openCells = [];
  let stairZone = null, terraceZone = null;
  // run direction is resolved at seating time so the flight's open end (where you step
  // on/off) faces the entry/open core, never the end wall (see the stair seating below).
  let stairDir = wide ? '+x' : '+y';

  // BATH PROGRAM (floorplan-livability.plan.md): every house has ≥1 bath, seated on
  // the floor that HOSTS the bedrooms (upstairs when multi-floor, else the ground
  // row); a villa earns a second (the primary bath). Both door onto common
  // circulation — no ensuite. Basement and the bedroom-less multi-floor ground get none.
  const hostsBeds = role === 'upper' || (!hasUpper && role !== 'basement');
  const nBath = hostsBeds ? (t.beds >= 4 ? 2 : 1) : 0;

  if (role === 'upper') {
    // ── HALL builder: a landing/hall strip with bedroom rows on each side ──────
    // bedroom count comes from the BUDGET: how many bedrooms (at ~1.7× their furniture
    // budget) the non-hall floor affords — but HARD-CAPPED at the tier's bed count, so a
    // big upstairs grows the bedrooms rather than multiplying them into a dorm. Bigger
    // floor → bigger bedrooms, not more of them.
    const bedBudget = archetypeArea('B');
    const minBed = Math.max(9, Math.round(Math.sqrt(bedBudget) * 0.85));
    let nBed = Math.round((area - AL * PROGRAM_HALL) / (1.7 * bedBudget));
    nBed = Math.max(1, Math.min(t.beds, nBed));
    const hallW = Math.max(PROGRAM_HALL, resD ? (resD[1] - resD[0]) + 0.8 : PROGRAM_HALL);
    let hd0 = (DE - hallW) / 2;                              // centred → equal-depth bedroom rows
    if (resD) hd0 = Math.min(Math.max(hd0, resD[1] - hallW + 0.2), Math.max(0, resD[0] - 0.2));  // ...but cover the stair
    hd0 = Math.max(0, Math.min(hd0, DE - hallW));
    let hd1 = hd0 + hallW;
    // absorb any leftover band too thin to host a room INTO the hall, so the floor
    // still tiles exactly (no untiled sliver becoming a phantom exterior wall).
    if (hd0 > 0 && hd0 < minBed) hd0 = 0;
    if (DE - hd1 > 0 && DE - hd1 < minBed) hd1 = DE;
    const rowBands = [];
    if (hd0 >= minBed) rowBands.push({ d0: 0, d1: hd0, line: hd0 });        // front row, doors at hd0
    if (DE - hd1 >= minBed) rowBands.push({ d0: hd1, d1: DE, line: hd1 });  // back row, doors at hd1
    if (!rowBands.length) {
      // degenerate (tiny upper): carve one back row off the hall so there's a bedroom
      hd1 = Math.max(hd0 + PROGRAM_HALL, DE - minBed);
      rowBands.push({ d0: hd1, d1: DE, line: hd1 });
    }
    const hall = toRect(0, AL, hd0, hd1); hall.glyph = 'H'; hall.open = true;
    halls.push(hall);
    // flat program: bedrooms, the last cell an office when the tier has a study and
    // there are ≥3 rooms (so a study never displaces the tier's last bedroom in a small home)
    const bedProg = Array.from({ length: nBed }, (_, i) => (t.study && nBed >= 3 && i === nBed - 1) ? 'O' : 'B');
    // add the bath(s) to the bedroom floor — every row room doors onto the hall, so the
    // bath lands on common circulation (spec-compliant). Trim a bedroom before a bath if
    // the rows can't host both (relaxation order: never drop the bath). Group by privacy
    // depth so the bath sits among the bedrooms (the sleeping wing reads together).
    const rowCap = rowBands.length * Math.max(1, Math.floor(AL / minBed));
    const nBedFit = Math.max(1, Math.min(bedProg.length, rowCap - nBath));
    const prog = [...bedProg.slice(0, nBedFit), ...Array.from({ length: nBath }, () => 'W')]
      .sort((a, b) => ROOM_DEPTH(b) - ROOM_DEPTH(a));
    const per = distribute(prog.length, rowBands.length);
    let idx = 0, balconyDoor = null;
    rowBands.forEach((row, ri) => {
      let n = Math.max(1, per[ri]);
      while (n > 1 && AL / n < minBed) n -= 1;
      const slice = prog.slice(idx, idx + n); idx += n;
      const segs = partitionWeighted(AL, balanceWeights(slice.map(archetypeArea)), rng, slice.map((g) => ROOM_MIN_DIM(g, minBed)));
      slice.forEach((g, i) => {
        const [a0, a1] = segs[i];
        const r = toRect(a0, a1, row.d0, row.d1); r.glyph = g; rooms.push(r);
        doors.push({ ...doorAt((a0 + a1) / 2, row.line), room: rooms.length - 1, onto: 'hall' });   // off the landing → circulation
        // host a balcony door on a bedroom's exterior wall — PREFER the front row (a balcony over
        // the entry, street-facing + visible), fall back to a back bedroom if there's no front row.
        if (balcony && g === 'B') {
          const isFront = Math.abs(row.d1 - DE) > 0.1;
          if (isFront && (!balconyDoor || balconyDoor.line !== 0)) balconyDoor = { a: (a0 + a1) / 2, line: 0, room: rooms.length - 1 };
          else if (!balconyDoor) balconyDoor = { a: (a0 + a1) / 2, line: DE, room: rooms.length - 1 };
        }
      });
    });
    // a balcony: a french/glazed door on a bedroom's exterior wall, leading out to a projecting deck
    if (balconyDoor) doors.push({ ...doorAt(balconyDoor.a, balconyDoor.line), room: balconyDoor.room, exterior: true, leadsTo: 'balcony', kind: 'sliding' });
    openCells.push(-1);   // hall index tracked separately (halls[], not rooms[])
    return { seed, width, height, rooms, halls, doors, stairZone, stairDir, openCells, terraceZone };
  }

  // ── OPEN-CORE builder (ground / single / basement) ──────────────────────────
  // The open core's DEPTH is budgeted from its furniture: living + kitchen (+ dining)
  // area ÷ the core width. Private rooms are chosen from a priority wishlist until the
  // back band is budgeted full, and their WIDTHS are proportional to each room's own
  // furniture budget — a bedroom wider than a closet, the whole thing scaling with size.
  const minBand = 10, minPriv = 8;                                       // bed depth / room width floors
  // open-core zones, ordered so the KITCHEN sits at the FAR END of the core — against a
  // side exterior wall to run its counter along (not floating on an interior zone seam),
  // with dining beside it (K↔D). living/kitchen[/dining] per tier.
  const ZONE_ORDER = { L: 0, D: 1, K: 2 };
  const zones = [...t.core].sort((a, b) => (ZONE_ORDER[a] ?? 0) - (ZONE_ORDER[b] ?? 0));
  // TIER-BOUNDED wishlist: single-floor hangs the tier's bedrooms (+ study) off the core;
  // multi-floor ground keeps only service rooms (beds live upstairs); basement is storage.
  const wishlist = hasUpper ? (t.study ? ['O', 'S'] : ['S', 'S'])
    : role === 'basement' ? ['S', 'S']
    : [...Array.from({ length: t.beds }, () => 'B'), ...(t.study ? ['O'] : []), 'S'];
  // choose private rooms against a nominal private share of the floor, then let their
  // total furniture budget set the band DEPTH so each room ≈ its own budget area; the
  // open core soaks the remaining depth (so it grows with the house, not the bedrooms).
  const privShare = (hasUpper || role === 'basement') ? 0.34 : 0.48;
  let chosen = chooseRooms(AL * DE * privShare, wishlist, archetypeArea('S'));
  chosen = chosen.slice(0, t.maxPerRow);                                 // hard cap: never a dorm row
  while (chosen.length > 1 && chosen.reduce((s, g) => s + ROOM_MIN_DIM(g, minPriv), 0) > AL) chosen.pop();
  // guarantee the bath(s) in the row — evict a service room (S, then O) before a bedroom
  // to make space under the maxPerRow cap (relaxation order: keep the bath). The hall
  // pocket below puts these baths on circulation (not the open core), so they're compliant.
  for (let have = chosen.filter((g) => g === 'W').length; have < nBath; have += 1) {
    if (chosen.length >= t.maxPerRow) {
      // evict S, then O, then a bedroom — NEVER a bath we already placed
      const victim = ['S', 'O', 'B'].map((g) => chosen.lastIndexOf(g)).find((i) => i >= 0);
      if (victim === undefined) break;                                  // only baths left → cap reached
      chosen.splice(victim, 1);
    }
    chosen.push('W');
  }
  chosen.sort((a, b) => ROOM_DEPTH(b) - ROOM_DEPTH(a));                  // sleeping/wet rooms grouped
  const privTotal = chosen.reduce((s, g) => s + archetypeArea(g), 0);
  const rowDepth = Math.max(minBand, Math.min(privTotal / AL, DE - 12));

  // BEDROOM-HALL POCKET (floorplan-livability.plan.md, step 3): a single-floor house's
  // private rooms must NOT door onto the living core (the W↔L/K/D no-shared-door rule).
  // Insert a circulation HALL between the core and the private row — each room doors onto
  // the hall, the hall opens to the core at ONE mouth — so the bath/bedrooms reach the
  // core through circulation, not across the great room. Only when the footprint still
  // affords a core ≥ minBand after spending the hall depth; else fall back to dooring onto
  // the core (graceful degradation, flagged by assessLivability).
  const wantHall = hostsBeds && chosen.some((g) => RELATIONSHIPS[g]?.reachVia === 'circulation');
  const minCoreDepth = 8;                                               // an open living/kitchen core can be shallow in a tiny house
  const useHall = wantHall && (DE - (rowDepth + PROGRAM_HALL) >= minCoreDepth);
  const hallW = useHall ? PROGRAM_HALL : 0;
  let bandDepth = rowDepth + hallW;
  let coreDepth = DE - bandDepth;
  if (resD && coreDepth < resD[1] + 0.8) { coreDepth = Math.min(resD[1] + 0.8, DE - minBand); bandDepth = DE - coreDepth; }
  const rowLine = coreDepth + hallW;                                    // depth the private rooms front onto

  const core = toRect(0, AL, 0, coreDepth); core.glyph = 'L'; core.open = true; core.zones = zones;
  rooms.push(core); openCells.push(0);

  if (useHall) {
    const hall = toRect(0, AL, coreDepth, rowLine); hall.glyph = 'H'; hall.open = true;
    halls.push(hall);
    doors.push({ ...doorAt(AL / 2, coreDepth), room: 0, onto: 'core', kind: 'cased' });   // wing mouth: an open archway core → hall
  }

  // ENTRY DOOR — placed before the stair so the flight (and its budgeted bay) can be seated
  // before the private rooms tile around it. An EXTERIOR door is only allowed where it leads
  // somewhere real (entrance / terrace); placeOpenings refuses any other envelope door.
  const entryA = AL * (0.3 + 0.4 * rng());
  doors.push({ ...doorAt(entryA, 0), room: 0, entry: true, exterior: true, leadsTo: 'entrance' });

  // STAIR ZONE — reserve the flight inside the open core with real CLEARANCE (never against a
  // wall or in a doorway's path): inset `clear` from the spine-end + front walls AND the
  // core/private partition, run it to the clear side of the entry, and orient its open end
  // toward the entry/core. Captures the along-spine span so the rooms can tile AROUND it.
  let stairA0 = null, stairA1 = null;
  if (role !== 'basement' || reservedOpen) {
    const sw = stairSpan, clear = 2;             // ≥2 ft gap to every surrounding wall
    const doorClr = PROGRAM_HALL;                // keep the run a doorway's width off the entry door
    const sCtr = Math.min(DE / 2, coreDepth - sw / 2 - clear);   // depth band, clear of the band partition
    const sD0 = Math.max(clear, sCtr - sw / 2), sD1 = sD0 + sw;  // ...and clear of the front exterior wall
    const lo = clear, hi = AL - clear;           // along-spine span, inset from both end walls
    // a SWITCHBACK's real along-footprint is ~one half-run + landing (≈ 12–14 ft); reserve to
    // that, not the whole clear side, so the budgeted bay matches the flight (not dead space).
    const want = Math.min(hi - lo, 14);
    // the entry door splits the spine; run along whichever clear side of it is longer.
    const loGap = (entryA - doorClr) - lo, hiGap = hi - (entryA + doorClr);
    let sA0, sA1, forward = true;
    if (Math.max(loGap, hiGap) < sw) { sA0 = lo; sA1 = Math.min(hi, lo + want); forward = true; }   // no room either side → centred
    else if (hiGap >= loGap) { sA0 = entryA + doorClr; sA1 = sA0 + Math.min(want, hiGap); forward = true; }
    else { sA1 = entryA - doorClr; sA0 = sA1 - Math.min(want, loGap); forward = false; }
    stairZone = toBox(sA0, sA1, sD0, sD1);
    // seat the run so its open end (entry/exit) faces the entry side, not the end wall:
    // high-side zone climbs back toward the entry (+); low-side zone climbs the other way (−).
    stairDir = wide ? (forward ? '+x' : '-x') : (forward ? '+y' : '-y');
    stairA0 = sA0; stairA1 = sA1;
  }

  // PRIVATE ROW — tiled AROUND the stair's budgeted circulation BAY. A column at the flight's
  // along-span (+ clearance), spanning the row depth, is reserved as a hall so NO room sits
  // in front of / behind the stair (no room wall or door lands beside the flight) and the
  // stair genuinely COSTS floor area the rooms yield — the stair is wired into the area
  // budget, not squatting in free open space. No bay on a single-floor house (no stair) or
  // when the hall pocket already fronts the row (mutually exclusive: hall ⇒ no stair here).
  const placeRow = (a0, a1, gs) => {
    if (!gs.length || a1 - a0 < minPriv) return;
    const fit = gs.slice(0, Math.max(1, Math.floor((a1 - a0) / minPriv)));   // budget: drop rooms the bay squeezed out
    const segs = partitionWeighted(a1 - a0, balanceWeights(fit.map(archetypeArea)), rng, fit.map((g) => ROOM_MIN_DIM(g, minPriv)));
    fit.forEach((g, i) => {
      const r = toRect(a0 + segs[i][0], a0 + segs[i][1], rowLine, DE); r.glyph = g; rooms.push(r);
      doors.push({ ...doorAt(a0 + (segs[i][0] + segs[i][1]) / 2, rowLine), room: rooms.length - 1, onto: useHall ? 'hall' : 'core' });
    });
  };
  const bayClear = 1.5;
  let bayLo = (stairA0 != null && !useHall && DE - rowLine > 3) ? Math.max(0, stairA0 - bayClear) : null;
  let bayHi = bayLo != null ? Math.min(AL, stairA1 + bayClear) : null;
  if (bayLo != null) {
    if (bayLo < minPriv) bayLo = 0;              // absorb a too-thin left strip into the bay (exact tiling)
    if (AL - bayHi < minPriv) bayHi = AL;        // ...and a too-thin right strip
  }
  if (bayLo != null && (bayLo > 0 || bayHi < AL)) {
    const bayHall = toRect(bayLo, bayHi, rowLine, DE); bayHall.glyph = 'H'; bayHall.open = true;
    halls.push(bayHall);
    // open the bay to the core (else it's a sealed box) — seat the mouth on the wider clear
    // side of the flight so you reach it past the stair, not through it.
    const leftGap = stairA0 - bayLo, rightGap = bayHi - stairA1;
    const mouthA = rightGap >= leftGap ? (stairA1 + bayHi) / 2 : (bayLo + stairA0) / 2;
    // a wide CASED opening (archway, no leaf) — the bay is an open recess of the core, not a
    // doored closet you'd read as a 'door to nowhere'.
    doors.push({ ...doorAt(mouthA, rowLine), room: 0, onto: 'core', kind: 'cased', width: Math.max(3.5, Math.min(7, Math.max(leftGap, rightGap) - 0.5)) });
    const leftW = bayLo, rightW = AL - bayHi;
    const nLeft = leftW < minPriv ? 0 : rightW < minPriv ? chosen.length : Math.round(chosen.length * leftW / (leftW + rightW));
    placeRow(0, bayLo, chosen.slice(0, nLeft));
    placeRow(bayHi, AL, chosen.slice(nLeft));
  } else {
    placeRow(0, AL, chosen);
  }

  // reserve a TERRACE / DECK anchor the open living core opens onto — a patio off the
  // FRONT exterior wall, set to one side of the entry (the rear is the private band, so
  // the deck sits beside the great room). We do NOT build the deck; we reserve where it
  // goes and, only when `terrace:true`, cut its door. The door carries leadsTo:'terrace'
  // so it passes the exterior-door rule; without it the deck anchor is just metadata.
  if (role !== 'basement' && role !== 'upper') {
    const tHalf = Math.min(6, AL * 0.16), tDepth = 8, clr = PROGRAM_HALL + tHalf + 2;
    // seat the deck on whichever side of the entry has room along the front wall
    const tA = (entryA > AL / 2)
      ? Math.max(tHalf + 1, entryA - clr)
      : Math.min(AL - tHalf - 1, entryA + clr);
    terraceZone = wide
      ? { x0: U.x0 + tA - tHalf, x1: U.x0 + tA + tHalf, y0: U.y0 - tDepth, y1: U.y0 }
      : { x0: U.x0 - tDepth, x1: U.x0, y0: U.y0 + tA - tHalf, y1: U.y0 + tA + tHalf };
    if (terrace) doors.push({ ...doorAt(tA, 0), room: 0, exterior: true, leadsTo: 'terrace' });
  }
  return { seed, width, height, rooms, halls, doors, stairZone, stairDir, openCells, terraceZone };
}

/**
 * Assess a generated plan against the livability INVARIANTS (floorplan-livability.plan.md):
 *   - min-bath: the floor's house has ≥1 bathroom.
 *   - bath-onto-public: no privacy-sensitive room (bath) doors onto the open core / a
 *     public room — it must reach the core through circulation (a hall).
 * A pure CHECK used by tests/diagnostics — it does not repair. Door `onto` tags
 * ('core' | 'hall') come from generateProgramPlan; an untagged interior door is read as
 * dooring onto the core (the conservative reading). min-bath is a per-HOUSE invariant, so
 * pass the whole house (an array of floor plans, or {floors:[…]}) — a multi-floor house
 * keeps its bath upstairs and a single ground plan would falsely read as bathless.
 * @returns {{ baths:number, ok:boolean, violations:{rule,detail}[] }}
 */
export function assessLivability(planOrFloors) {
  const floors = Array.isArray(planOrFloors)
    ? planOrFloors
    : (planOrFloors && Array.isArray(planOrFloors.floors) ? planOrFloors.floors : [planOrFloors || {}]);
  const violations = [];
  let baths = 0;
  for (const f of floors) {
    const rooms = f.rooms || [];
    baths += rooms.filter((r) => r.glyph === 'W').length;
    for (const d of (f.doors || [])) {
      const r = rooms[d.room];
      if (!r) continue;
      const forbid = RELATIONSHIPS[r.glyph]?.mustNotTouch || [];
      const ontoPublic = d.onto === 'core' || (d.onto == null && !d.exterior && !d.entry);
      if (ontoPublic && forbid.some((g) => g === 'L' || g === 'K' || g === 'D')) {
        violations.push({ rule: 'bath-onto-public', detail: `${r.glyph} doors onto the open core` });
      }
    }
  }
  if (baths < 1) violations.push({ rule: 'min-bath', detail: 'house has no bathroom' });
  return { baths, ok: violations.length === 0, violations };
}
