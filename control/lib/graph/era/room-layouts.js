/**
 * ROOM LAYOUTS — what fills a room's floor, not only its walls: the pieces of the dressing (compose-dress.js PIECES) laid
 * in a figure across the room, so a body walking it has aisles to slip down, machines to hide behind, islands of low
 * cover and a way round. A stocked room (stocking.js) lines its walls and leaves its middle bare: a corridor and an empty
 * box to a sneaking body. A room given a layout is a place to move through: its sightlines broken, its doorways joined
 * by more than one way. A new layout is a row: its reading, its pieces and their dials, and the figure it lays.
 *
 *   LAYOUTS        { <id>: { reads, dials, nudge, lay(room, o, piece, dice, fits) → [{ kind, at, facing, group }] } }
 *     nudge        a loose figure's piece is moved to clear a doorway's approach; an aligned figure's is dropped (a
 *                  rack shoved out of its aisle is litter). `fits(kind, at, facing)` asks whether a place is clear, for
 *                  a figure that finds its own (a chicane's block slides along its wall to a stretch no doorway takes)
 *     aisles       rows of tall racks or shelves down the room's length, back to back, broken by cross aisles (aligned,
 *                  a grid; staggered, a maze): a warehouse's floor, a store's, an archive's stacks
 *     machines     big plant on a staggered grid, lanes between: a generator hall's, a pump room's; the tall ones block a
 *                  standing gaze, the low ones a crouch's
 *     islands      pods of desks back to back, a cabinet at an end: an office floor, a control room; cover for a crouch
 *                  or a crawl, a gaze over it
 *     stockpile    clumps of crates (stacked by the dice) on a jittered grid: a yard store, a hold; a winding way
 *     rows         benches or bunks in rows across the room from each long wall, a centre aisle down it: a workshop, a
 *                  dormitory, a mess
 *     chicane      blocks of crates against the long walls by turns, each past the middle: a corridor that is no
 *                  hallway, its length never seen down, its way a weave
 *
 *   readLayouts(v)        → the program's `layouts` ({ <room id or role>: <layout id> | { layout, …dials } }), checked
 *   layoutOf(L, roomId, role) → the room's asked layout ({ layout, …dials } its dials filled), or null
 *   layoutLaws(room, boxes, doors) → the laws a laid room is held to (the route search's and the eye's, on the room
 *                  alone): its doorways joined, a way round, its sightlines broken, cover in reach
 *
 * Pure: seeded dice only. compose-dress.js layProps lays a room's layout where the program asks for it (era/programs.js
 * `layouts`), each candidate placed where it stands clear of the doorways' approaches and the stairs (the doorways'
 * sightlines are not kept: breaking them is the point). The pieces are the dressing's own, so every look the building's
 * construction and palette give its dressing (era/style/bay-axes.js) is the layout's. docs/facility-pieces.md.
 */
const r2 = (v) => Math.round(v * 100) / 100;
// (the dials' widths are a body's with a third-person camera behind it: an aisle two metres and more, never a walker's
// shoulder room)
// pieces abreast a seam apart: the dressing keeps a hair between any two (compose-dress.js GAP)
const SEAM = 0.12;

// a room's axes: u along its long side, v across it; `at(u, v)` back to the plan's frame
const frame = (room) => {
  const alongX = room.x1 - room.x0 >= room.y1 - room.y0;
  const Lu = alongX ? room.x1 - room.x0 : room.y1 - room.y0, Lv = alongX ? room.y1 - room.y0 : room.x1 - room.x0;
  const at = (u, v) => (alongX ? [r2(room.x0 + u), r2(room.y0 + v)] : [r2(room.x0 + v), r2(room.y0 + u)]);
  // (a piece's long side along u faces across, ±v; along v it faces ±u)
  const across = (s = 1) => (alongX ? (s > 0 ? '+y' : '-y') : s > 0 ? '+x' : '-x');
  const down = (s = 1) => (alongX ? (s > 0 ? '+x' : '-x') : s > 0 ? '+y' : '-y');
  return { alongX, Lu, Lv, at, across, down };
};

// whole pieces of length `len` from `a` to `b`, `run` abreast, a gap `cross` between runs, the first run started `shift`
// along its period (a staggered row's)
const spans = (a, b, len, run, cross, shift = 0) => {
  const out = [], period = run * len + cross;
  for (let s = a - (shift ? period - shift : 0); s < b; s += period) {
    for (let k = 0; k < run; k++) { const u0 = s + k * len, u1 = u0 + len; if (u0 >= a - 1e-6 && u1 <= b + 1e-6) out.push(u0 + len / 2); }
  }
  return out;
};

export const LAYOUTS = Object.freeze({
  aisles: Object.freeze({
    reads: 'rows of tall racks down the room\'s length, back to back, broken by cross aisles: a warehouse floor, a store, the stacks; a body walks an aisle out of sight of the next',
    dials: Object.freeze({ piece: 'rack', aisle: 2.2, run: 3, cross: 'staggered', pair: true, margin: 1.6 }), nudge: false,
    lay(room, o, piece) {
      const F = frame(room), P = piece(o.piece), depth = o.pair ? 2 * P.d + SEAM : P.d, pitch = depth + o.aisle;
      const span = F.Lv - 2 * o.margin, n = Math.max(1, Math.floor((span + o.aisle) / pitch)), v0 = o.margin + (span - (n * pitch - o.aisle)) / 2;
      const out = [];
      for (let k = 0; k < n; k++) {
        const vc = v0 + k * pitch + depth / 2, shift = o.cross === 'staggered' && k % 2 ? (o.run * P.w + o.aisle) / 2 : 0;
        for (const u of spans(o.margin, F.Lu - o.margin, P.w + SEAM, o.run, o.aisle, shift)) {
          if (o.pair) for (const s of [-1, 1]) out.push({ kind: o.piece, at: F.at(u, vc + s * (P.d / 2 + SEAM / 2)), facing: F.across(s), group: `row-${k}` });
          else out.push({ kind: o.piece, at: F.at(u, vc), facing: F.across(k % 2 ? -1 : 1), group: `row-${k}` });
        }
      }
      return out;
    },
  }),
  machines: Object.freeze({
    reads: 'big plant on a staggered grid, lanes between: a generator hall, a pump room; the tall machines stop a standing gaze, the low ones a crouch\'s',
    dials: Object.freeze({ pieces: Object.freeze(['generator', 'pump', 'switchgear']), lane: 2.2, fill: 0.85, margin: 1.6 }), nudge: true,
    lay(room, o, piece, dice) {
      const F = frame(room), Ps = o.pieces.map(piece), cw = Math.max(...Ps.map((P) => P.w)) + o.lane, cd = Math.max(...Ps.map((P) => P.d)) + o.lane;
      const nu = Math.max(1, Math.floor((F.Lu - 2 * o.margin + o.lane) / cw)), nv = Math.max(1, Math.floor((F.Lv - 2 * o.margin + o.lane) / cd));
      const u0 = (F.Lu - (nu * cw - o.lane)) / 2, v0 = (F.Lv - (nv * cd - o.lane)) / 2, out = [];
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu - (j % 2 && nu > 1 ? 1 : 0); i++) {
        // (a floor of one or two places keeps them: the fill thins a hall, never empties a room)
        const pick = Math.floor(dice() * o.pieces.length), keep = dice() < o.fill || nu * nv <= 2;
        if (!keep) continue;
        const u = u0 + i * cw + (cw - o.lane) / 2 + (j % 2 && nu > 1 ? cw / 2 : 0), v = v0 + j * cd + (cd - o.lane) / 2;
        out.push({ kind: o.pieces[pick], at: F.at(u, v), facing: F.across(j % 2 ? -1 : 1), group: `m-${i}-${j}` });
      }
      return out;
    },
  }),
  islands: Object.freeze({
    reads: 'pods of desks back to back, a cabinet at one end: an office floor, a control room; low cover a crouch or a crawl keeps behind, a gaze over it',
    dials: Object.freeze({ piece: 'desk', end: 'filing', per: 2, lane: 2, margin: 1.6 }), nudge: true,
    lay(room, o, piece, dice) {
      const F = frame(room), P = piece(o.piece), E = o.end ? piece(o.end) : null;
      const pu = o.per * (P.w + SEAM) + (E ? E.d + SEAM : 0), pv = 2 * P.d + SEAM, cw = pu + o.lane, cd = pv + o.lane;
      const nu = Math.max(1, Math.floor((F.Lu - 2 * o.margin + o.lane) / cw)), nv = Math.max(1, Math.floor((F.Lv - 2 * o.margin + o.lane) / cd));
      const u0 = (F.Lu - (nu * cw - o.lane)) / 2, v0 = (F.Lv - (nv * cd - o.lane)) / 2, out = [];
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const left = dice() < 0.5, ua = u0 + i * cw + (left && E ? E.d + SEAM : 0), vc = v0 + j * cd + pv / 2, g = `pod-${i}-${j}`;
        for (let k = 0; k < o.per; k++) for (const s of [-1, 1]) out.push({ kind: o.piece, at: F.at(ua + k * (P.w + SEAM) + P.w / 2, vc + s * (P.d / 2 + SEAM / 2)), facing: F.across(s), group: g });
        if (E) out.push({ kind: o.end, at: F.at(left ? ua - SEAM / 2 - E.d / 2 : ua + o.per * (P.w + SEAM) + E.d / 2, vc), facing: F.down(left ? 1 : -1), group: g });
      }
      return out;
    },
  }),
  stockpile: Object.freeze({
    reads: 'clumps of crates stacked by the dice on a jittered grid: a yard store, a hold; a winding way through, a stack to crouch behind or climb',
    dials: Object.freeze({ piece: 'crate', spacing: 4.4, jitter: 0.6, margin: 1.6 }), nudge: true,
    lay(room, o, piece, dice) {
      const F = frame(room), P = piece(o.piece), q = P.w + SEAM, out = [];
      // (a clump's shape: crates on a grid of their own size, a square, an L, a line or a T)
      const SHAPES = [[[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1]]];
      const nu = Math.max(1, Math.floor((F.Lu - 2 * o.margin) / o.spacing)), nv = Math.max(1, Math.floor((F.Lv - 2 * o.margin) / o.spacing));
      const u0 = (F.Lu - nu * o.spacing) / 2, v0 = (F.Lv - nv * o.spacing) / 2;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const S = SHAPES[Math.floor(dice() * SHAPES.length)], flip = dice() < 0.5, ju = (dice() - 0.5) * 2 * o.jitter, jv = (dice() - 0.5) * 2 * o.jitter;
        const wu = Math.max(...S.map((c) => c[flip ? 1 : 0])) + 1, wv = Math.max(...S.map((c) => c[flip ? 0 : 1])) + 1;
        const cu = u0 + (i + 0.5) * o.spacing + ju - (wu * q) / 2, cv = v0 + (j + 0.5) * o.spacing + jv - (wv * q) / 2;
        for (const c of S) { const [a, b] = flip ? [c[1], c[0]] : c; out.push({ kind: o.piece, at: F.at(cu + (a + 0.5) * q, cv + (b + 0.5) * q), facing: F.across(1), group: `clump-${i}-${j}` }); }
      }
      return out;
    },
  }),
  chicane: Object.freeze({
    reads: 'blocks of crates against the long walls by turns, each reaching past the middle: a corridor that is no hallway; no gaze runs its length, the way through a weave',
    dials: Object.freeze({ piece: 'crate', cover: 0.6, len: 2, gap: 2.8, margin: 1.6 }), nudge: false,
    lay(room, o, piece, dice, fits = () => true) {
      const F = frame(room), P = piece(o.piece), qu = P.w + SEAM, qv = P.d + SEAM, out = [];
      // (a block: `len` pieces along the corridor, as many across as reach `cover` of its width, a body's way left past it)
      const across = Math.max(1, Math.min(Math.floor((o.cover * F.Lv) / qv + 0.5), Math.floor((F.Lv - 1.2) / qv)));
      const block = (u, s, k, n, m) => { const B = []; for (let a = 0; a < m; a++) for (let b = 0; b < n; b++) { const v = s < 0 ? 0.15 + P.d / 2 + b * qv : F.Lv - 0.15 - P.d / 2 - b * qv; B.push({ kind: o.piece, at: F.at(u + (a + 0.5) * qu, v), facing: F.across(-s), group: `block-${k}` }); } return B; };
      // (each block slid along from where the last left off to the first stretch of its wall that holds it whole, the
      // walls by turns; a row shallower, then a piece shorter, where it does not fit (a doorway opposite takes the
      // corridor's far half, a doorway beside it the wall's stretch); where its own wall holds none within a block and
      // a gap, the other)
      let s = -1, k = 0;
      for (let u = o.margin; u + qu <= F.Lu - o.margin + 1e-6;) {
        let laid = null;
        for (const side of [s, -s]) {
          for (let m = o.len; m >= 1 && !laid; m--) for (let n = across; n >= 1 && !laid; n--) {
            for (let du = 0; du <= o.gap + o.len * qu && u + du + m * qu <= F.Lu - o.margin + 1e-6; du += 0.25) {
              const B = block(u + du, side, k, n, m);
              if (B.every((p) => fits(p.kind, p.at, p.facing))) { laid = { B, u: u + du, side, m }; break; }
            }
          }
          if (laid) break;
        }
        if (!laid) break;
        out.push(...laid.B);
        u = laid.u + laid.m * qu + o.gap; s = -laid.side; k++;
      }
      return out;
    },
  }),
  rows: Object.freeze({
    reads: 'benches or bunks in rows across the room from each long wall, a centre aisle down it: a workshop, a dormitory, a mess; the rows a body ducks between',
    dials: Object.freeze({ piece: 'workbench', aisle: 2.4, lane: 1.6, margin: 1.4 }), nudge: false,
    lay(room, o, piece) {
      const F = frame(room), P = piece(o.piece), pitch = P.d + o.lane, out = [];
      // (each row a line of pieces across the room, its long side across, from the wall to the centre aisle)
      const reach = (F.Lv - o.aisle) / 2 - 0.3, per = Math.max(1, Math.floor(reach / (P.w + SEAM)));
      const n = Math.max(1, Math.floor((F.Lu - 2 * o.margin + o.lane) / pitch)), u0 = (F.Lu - (n * pitch - o.lane)) / 2;
      for (let k = 0; k < n; k++) {
        const u = u0 + k * pitch + P.d / 2;
        for (const s of [-1, 1]) for (let m = 0; m < per; m++) {
          const v = s < 0 ? 0.3 + m * (P.w + SEAM) + P.w / 2 : F.Lv - 0.3 - m * (P.w + SEAM) - P.w / 2;
          out.push({ kind: o.piece, at: F.at(u, v), facing: F.down(k % 2 ? -1 : 1), group: `row-${k}${s < 0 ? 'a' : 'b'}` });
        }
      }
      return out;
    },
  }),
});

export const LAYOUT_IDS = Object.freeze(Object.keys(LAYOUTS));

const DIAL_RANGES = Object.freeze({ aisle: [1, 4], lane: [0.9, 4], margin: [0.6, 4], spacing: [2.4, 8], jitter: [0, 1.5], fill: [0.3, 1], run: [1, 8], per: [1, 4], cover: [0.3, 0.8], len: [1, 6], gap: [1.5, 8] });

/** The program's `layouts`: { <room id or role>: <layout id> | { layout, …its dials } }. Throws a sentence on a bad one. */
export function readLayouts(v, pieceIds = null) {
  if (v === undefined) return undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`program: layouts is { <room id or role>: ${LAYOUT_IDS.join(' | ')} | { layout, …dials } }`);
  const out = {};
  for (const [room, w] of Object.entries(v)) {
    const o = typeof w === 'string' ? { layout: w } : w;
    if (!o || typeof o !== 'object' || !LAYOUTS[o.layout]) throw new Error(`program: layouts.${room} is a layout (${LAYOUT_IDS.join(', ')}) or { layout, …dials }`);
    const D = LAYOUTS[o.layout].dials;
    for (const [k, x] of Object.entries(o)) {
      if (k === 'layout') continue;
      if (!(k in D)) throw new Error(`program: layouts.${room}.${k} is not a dial of '${o.layout}' (${Object.keys(D).join(', ')})`);
      if (DIAL_RANGES[k] && !(typeof x === 'number' && x >= DIAL_RANGES[k][0] && x <= DIAL_RANGES[k][1])) throw new Error(`program: layouts.${room}.${k} is ${DIAL_RANGES[k][0]} to ${DIAL_RANGES[k][1]}`);
      const kinds = k === 'pieces' ? x : k === 'piece' || k === 'end' ? [x] : null;
      if (kinds && (!Array.isArray(kinds) || !kinds.length || (pieceIds && kinds.some((p) => p !== null && !pieceIds.includes(p))))) throw new Error(`program: layouts.${room}.${k} names pieces of the dressing${pieceIds ? ` (${pieceIds.join(', ')})` : ''}`);
      if (k === 'cross' && !['aligned', 'staggered'].includes(x)) throw new Error(`program: layouts.${room}.cross is 'aligned' or 'staggered'`);
      if (k === 'pair' && typeof x !== 'boolean') throw new Error(`program: layouts.${room}.pair is true or false`);
    }
    out[room] = { ...o };
  }
  return Object.freeze(out);
}

/** The room's asked layout, its dials filled: by its id first, then by its role. */
export function layoutOf(L, roomId, role) {
  const o = L && (L[roomId] ?? L[role]);
  return o ? { ...LAYOUTS[o.layout].dials, ...o } : null;
}

// THE LAWS, on the room alone: a grid of its floor, the pieces as boxes ({ min: [x, y], max: [x, y], h })
const CELL = 0.25, BODY = 0.35, WATCH = 1.35, STAND = 1.275, CROUCH = 0.825, REACH = 3;
export const HALL = 100;

/**
 * A laid room's laws. `room` { x0, y0, x1, y1 }, `boxes` its pieces' footprints with their heights, `doors` its doorways
 * ({ X, at, into, lo, hi }: compose-dress.js openingsOf). Each law { law, holds, says }.
 *   doors-joined     every doorway reaches every other over the floor left (a body's width)
 *   a-way-round      a piece or a clump stands clear of the walls: a body can circle it, so two ways to anywhere past it
 *   sight-broken     from no doorway does a watcher see three quarters of the floor a body stands on (a corridor, three
 *                    times as long as it is wide: from neither end does a watcher see more than three fifths of it)
 *   cover-in-reach   nine tenths of the floor is within three metres of a piece a crouch hides behind
 * A way round and a broken gaze are a HALL's (a floor of HALL square metres or more, ten metres square, or a corridor's length): a room
 * smaller is crossed in a breath, its doorway its cover, and is held to the other two.
 */
export function layoutLaws(room, boxes, doors) {
  const W = Math.max(1, Math.round((room.x1 - room.x0) / CELL)), H = Math.max(1, Math.round((room.y1 - room.y0) / CELL)), N = W * H;
  const cx = (i) => room.x0 + ((i % W) + 0.5) * CELL, cy = (i) => room.y0 + (Math.floor(i / W) + 0.5) * CELL;
  const cellOf = (p) => Math.min(H - 1, Math.max(0, Math.floor((p[1] - room.y0) / CELL))) * W + Math.min(W - 1, Math.max(0, Math.floor((p[0] - room.x0) / CELL)));
  const solid = new Uint8Array(N), piece = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const x = cx(i), y = cy(i);
    if (x < room.x0 + BODY || x > room.x1 - BODY || y < room.y0 + BODY || y > room.y1 - BODY) solid[i] = 1;
    for (let b = 0; b < boxes.length; b++) {
      const B = boxes[b];
      if (x > B.min[0] && x < B.max[0] && y > B.min[1] && y < B.max[1]) piece[i] = b;
      if (x > B.min[0] - BODY && x < B.max[0] + BODY && y > B.min[1] - BODY && y < B.max[1] + BODY) solid[i] = 1;
    }
  }
  const inside = doors.map((o) => cellOf(o.X ? [o.at + o.into * 0.6, (o.lo + o.hi) / 2] : [(o.lo + o.hi) / 2, o.at + o.into * 0.6]));
  for (const i of inside) solid[i] = 0;
  const flood = (from) => {
    const seen = new Uint8Array(N), q = [from];
    seen[from] = 1;
    while (q.length) { const i = q.pop(), x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= W || b >= H) continue; const j = b * W + a; if (!seen[j] && !solid[j]) { seen[j] = 1; q.push(j); } } }
    return seen;
  };
  const reach = inside.length ? flood(inside[0]) : null, joined = inside.every((i) => reach[i]);
  // (a way round: an island of blocked floor, its pieces' inflated cells joined, that touches no wall)
  const island = new Uint8Array(N);
  let islands = 0;
  for (let i = 0; i < N; i++) {
    if (!solid[i] || island[i]) continue;
    const q = [i];
    let wall = false;
    island[i] = 1;
    while (q.length) {
      const k = q.pop(), x = k % W, y = (k - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) wall = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= W || b >= H) continue; const j = b * W + a; if (solid[j] && !island[j]) { island[j] = 1; q.push(j); } }
    }
    if (!wall) islands++;
  }
  // (sight: from each doorway's inside, a watcher's eye to a standing body's, stopped by a piece taller than the line)
  const stopped = (a, b, eyeA, eyeB) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const B of boxes) {
      let t0 = 0, t1 = 1, miss = false;
      for (let k = 0; k < 2; k++) {
        const o = a[k], d = k ? dy : dx, lo = B.min[k], hi = B.max[k];
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { miss = true; break; } continue; }
        const u = (lo - o) / d, v = (hi - o) / d;
        t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v));
      }
      if (miss || t0 > t1) continue;
      if (Math.min(eyeA + (eyeB - eyeA) * t0, eyeA + (eyeB - eyeA) * t1) < B.h) return true;
    }
    return false;
  };
  const floor = [];
  for (let i = 0; i < N; i++) if (!solid[i] && (!reach || reach[i])) floor.push(i);
  const seenFrom = (eye) => Math.max(0, ...inside.map((d) => { const a = [cx(d), cy(d)]; let n = 0; for (const i of floor) if (!stopped(a, [cx(i), cy(i)], WATCH, eye)) n++; return n / (floor.length || 1); }));
  const w = room.x1 - room.x0, d = room.y1 - room.y0, long = Math.max(w, d) >= 3 * Math.min(w, d), hall = w * d >= HALL || long;
  // (a corridor's gaze is down its length: from a watcher at either end, its doorways' the corridor's sides)
  const ends = long ? (w >= d ? [[room.x0 + 0.6, (room.y0 + room.y1) / 2], [room.x1 - 0.6, (room.y0 + room.y1) / 2]] : [[(room.x0 + room.x1) / 2, room.y0 + 0.6], [(room.x0 + room.x1) / 2, room.y1 - 0.6]]) : null;
  const seenFromEnds = (eye) => Math.max(0, ...ends.map((a) => { let n = 0; for (const i of floor) if (!stopped(a, [cx(i), cy(i)], WATCH, eye)) n++; return n / (floor.length || 1); }));
  const stand = long ? seenFromEnds(STAND) : seenFrom(STAND), crouch = long ? seenFromEnds(CROUCH) : seenFrom(CROUCH);
  const covers = boxes.filter((B) => B.h >= CROUCH + 0.05);
  const near = floor.filter((i) => covers.some((B) => Math.hypot(Math.max(B.min[0] - cx(i), 0, cx(i) - B.max[0]), Math.max(B.min[1] - cy(i), 0, cy(i) - B.max[1])) <= REACH)).length / (floor.length || 1);
  const pc = (f) => `${Math.round(f * 100)}%`;
  return [
    { law: 'doors-joined', holds: joined, says: joined ? `its ${doors.length} doorway${doors.length === 1 ? '' : 's'} joined over the floor left` : 'a doorway is cut off by the pieces' },
    ...(hall ? [
      // (a corridor's way round is its weave: a block against one wall is walked past, never round; its law is the gaze)
      ...(long ? [] : [{ law: 'a-way-round', holds: islands > 0, says: islands ? `${islands} piece${islands === 1 ? '' : 's or clumps'} to walk round` : 'every piece is against a wall: one way through' }]),
      long ? { law: 'sight-broken', holds: stand < 0.6, says: `from either end a watcher sees at most ${pc(stand)} of its floor standing, ${pc(crouch)} crouched` }
        : { law: 'sight-broken', holds: stand < 0.75, says: `from its doorways a watcher sees at most ${pc(stand)} of the floor standing, ${pc(crouch)} crouched` },
    ] : []),
    { law: 'cover-in-reach', holds: near >= 0.9, says: `${pc(near)} of the floor within ${REACH} m of a piece a crouch hides behind` },
  ];
}
