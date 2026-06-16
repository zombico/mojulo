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
      { type: 'chair', anchor: [0.34, 0.4], w: 0.1, h: 0.1, heightWorld: 2.3, supportRadius: 0.09 },
      { type: 'chair', anchor: [0.66, 0.4], w: 0.1, h: 0.1, heightWorld: 2.3, supportRadius: 0.09 },
      { type: 'chair', anchor: [0.34, 0.62], w: 0.1, h: 0.1, heightWorld: 2.3, supportRadius: 0.09 },
      { type: 'chair', anchor: [0.66, 0.62], w: 0.1, h: 0.1, heightWorld: 2.3, supportRadius: 0.09 },
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
};

const PUBLIC = ['L', 'D', 'L'];
const PRIVATE = ['B', 'O', 'B'];
const SERVICE = ['K', 'S', 'O'];

// ── fractal BSP generator ───────────────────────────────────────────────────
const HALL = 7;        // corridor thickness (plan units)
const MIN_ROOM = 24;   // smallest room dimension before a split is refused

function generateRooms(seed, width, height, maxDepth) {
  const rng = mulberry32(seed);
  const rooms = [];
  const halls = [];
  function split(r, depth) {
    const canH = r.w >= MIN_ROOM * 2 + HALL;
    const canV = r.h >= MIN_ROOM * 2 + HALL;
    // stop: max depth, too small, or a seeded leaf chance once past depth 1
    if (depth >= maxDepth || (!canH && !canV) || (depth > 1 && rng() < 0.28)) {
      rooms.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      return;
    }
    const horizontal = canH && (!canV || r.w >= r.h);
    const f = 0.38 + 0.24 * rng();
    if (horizontal) {
      const cut = r.x + r.w * f;
      halls.push({ x: cut - HALL / 2, y: r.y, w: HALL, h: r.h, axis: 'v' });
      split({ x: r.x, y: r.y, w: (cut - HALL / 2) - r.x, h: r.h }, depth + 1);
      split({ x: cut + HALL / 2, y: r.y, w: (r.x + r.w) - (cut + HALL / 2), h: r.h }, depth + 1);
    } else {
      const cut = r.y + r.h * f;
      halls.push({ x: r.x, y: cut - HALL / 2, w: r.w, h: HALL, axis: 'h' });
      split({ x: r.x, y: r.y, w: r.w, h: (cut - HALL / 2) - r.y }, depth + 1);
      split({ x: r.x, y: cut + HALL / 2, w: r.w, h: (r.y + r.h) - (cut + HALL / 2) }, depth + 1);
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

/**
 * Generate a full floor plan from a seed.
 * @returns {{ seed, width, height, rooms:[{x,y,w,h,glyph}], halls, doors }}
 */
export function generatePlan(seed, { width = 132, height = 90, maxDepth = 3 } = {}) {
  const { rooms, halls, rng } = generateRooms(seed, width, height, maxDepth);
  assignArchetypes(rooms, rng);
  const doors = computeDoors(rooms, halls);
  return { seed, width, height, rooms, halls, doors };
}

/** Expand one room's archetype into boxNet roomConcept.elements (seeded). */
export function fillRoom(room, seed = 1) {
  const arche = ARCHETYPES[room.glyph] || ARCHETYPES.S;
  return arche.fill(mulberry32(seed));
}
