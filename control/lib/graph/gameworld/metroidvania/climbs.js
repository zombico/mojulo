/**
 * THE CLIMBS (docs/metroidvania-map.md "Climbs"): how a room is climbed to a door above it, as a FIGURE laid across the
 * screen, never a hop straight up a column. Going up is going across: every figure but the oldest turns the hero left and
 * right as she rises, so a shaft is a place played through, not a lift.
 *
 *   zigzag      ledges a jump apart, each a little aside of the one below (the first stair: kept where a double jump's
 *               sill must stand clear, and where no other figure fits)
 *   switchback  galleries across the screen, one over another two rises apart, joined at their ends by a step at the
 *               wall: she runs each gallery's length to climb a storey; the second jump later skips them
 *   flights     a staircase of treads a jump apart rising across the screen, a landing at the wall, the next flight back
 *               over it (the flights stacked in a V, the tread over hers always two rises up)
 *   stair       steps walked up without a jump, one flight across the screen from the floor toward the door, the last of
 *               it hopped (only where the rise fits one flight)
 *
 *   CLIMBS                 { <figure>: says }
 *   CLIMB_DEAL, climbDeal(as, k) → the figures tried for a room, in turn, the zigzag last
 *   CLIMB                  the figures' measures (m, or jumps and statures where said)
 *   layClimb(figure, ctx)  → [{ s0, s1, z, kind }] the stands above the floor, lowest first (kind tread | gallery | step |
 *                          landing | exit | stair), or null where the figure does not fit or fails its checks
 *     ctx  { a, b, floor, rise, n, top, hero: { stature, jump }, ledge, existing: [{ s0, s1, z }] }
 *          a, b the room's inner reach across; rise the metres climbed to the highest stand; n the rises; top where the
 *          last stand stands (under a hole, or the lip under a doorway); existing what already stands in the room
 *   climbFaults(stands, ctx) → [say]   what makes a figure unplayable: a stand over a head (less than a body and HEAD
 *                          under the one above it), a gap a jump cannot cross (more than REACH jumps between edges on a
 *                          rise), a rise over a jump
 *
 * Pure: the same room makes the same figure.
 */
export const CLIMBS = Object.freeze({
  zigzag: 'ledges a jump apart, each aside of the one below',
  switchback: 'galleries across the screen, each run its length, joined at the walls by a step',
  flights: 'treads rising across the screen, a landing at the wall, the next flight back over it',
  stair: 'steps walked up across the screen without a jump',
});
export const CLIMB_IDS = Object.freeze(Object.keys(CLIMBS));
/** the figures' measures: the open gap between pieces, a flight's tread and its landing, a walked stair's rise and going,
 * the most a gap between edges may be on a rise (`reach`, in jumps), the room a body needs under what is over it (`head`,
 * metres over her stature and a ledge's thickness), and the least a gallery runs */
export const CLIMB = Object.freeze({ gap: 0.7, tread: 2.2, landing: 3.4, riser: 0.3, going: 0.5, reach: 1.25, head: 0.25, gallery: 4, th: 0.4 });

/** THE DEAL: the figures a room is climbed by, tried in turn until one fits (a zigzag always does): a shaft's alternate
 * by the shafts' order, so no two climbed one after another are alike; a room a storey high walks a stair where one
 * fits; a room left through a double jump's sill keeps the zigzag on its far side */
export const CLIMB_DEAL = Object.freeze({
  shaft: Object.freeze([Object.freeze(['switchback', 'flights']), Object.freeze(['flights', 'switchback'])]),
  storey: Object.freeze([Object.freeze(['stair', 'flights', 'switchback']), Object.freeze(['flights', 'stair', 'switchback'])]),
  sill: Object.freeze([Object.freeze([])]),
});
/** The figures to try for a room, in order, its zigzag last: `as` shaft | storey | sill, `k` its turn in the deal. */
export const climbDeal = (as, k = 0) => { const D = CLIMB_DEAL[as] ?? CLIMB_DEAL.storey; return [...D[k % D.length], 'zigzag']; };

const r3 = (v) => Math.round(v * 1000) / 1000;
const piece = (s0, s1, z, kind) => ({ s0: r3(s0), s1: r3(s1), z: r3(z), kind });

/** What makes a figure unplayable (see the header). */
export function climbFaults(stands, { hero, existing = [], floor }) {
  const out = [], clear = hero.stature + CLIMB.th + CLIMB.head, all = [...existing, ...stands];
  for (const p of stands) for (const q of all) {
    if (q === p || q.z <= p.z) continue;
    const over = Math.min(p.s1, q.s1) - Math.max(p.s0, q.s0);
    if (over > 0.2 && q.z - p.z < clear) out.push(`a ${q.kind ?? 'ledge'} ${r3(q.z - p.z)} m over a ${p.kind} at ${p.s0}–${p.s1}`);
  }
  let prev = { s0: -Infinity, s1: Infinity, z: floor };
  for (const p of stands) {
    const gap = Math.max(0, p.s0 - prev.s1, prev.s0 - p.s1), rise = p.z - prev.z;
    if (rise > hero.jump + 1e-6) out.push(`a rise of ${r3(rise)} m to the ${p.kind} at ${p.z}`);
    if (rise > 0.01 && gap > CLIMB.reach * hero.jump) out.push(`a gap of ${r3(gap)} m to the ${p.kind} at ${p.z}`);
    prev = p;
  }
  return out;
}

/** A figure laid in a room (see the header), or null. */
export function layClimb(figure, ctx) {
  const { a, b, floor, rise, n, top, hero, ledge: L, existing = [] } = ctx, z = (k) => floor + (rise * k) / n, G = CLIMB.gap;
  const mid = (a + b) / 2, d0 = top > mid ? -1 : 1, clampIn = (s0, s1) => { const w = s1 - s0, c = Math.min(b - w / 2, Math.max(a + w / 2, (s0 + s1) / 2)); return [c - w / 2, c + w / 2]; };
  const exit = clampIn(top - L / 2, top + L / 2), out = [];
  if (figure === 'switchback') {
    // (top down: the exit under its door; a gallery from beside it to the far wall's step; then whole galleries between
    // the walls' steps, the steps taking the walls in turn)
    if (n < 3) return null;
    out[n] = piece(exit[0], exit[1], z(n), 'exit');
    const step = (side) => (side > 0 ? [b - L, b] : [a, a + L]), inner = [a + L + G, b - L - G];
    let side = d0;
    for (let k = n - 1, j = 0; k >= 1; k--, j++) {
      if (j % 2 === 1) { const s = step(side); out[k] = piece(s[0], s[1], z(k), 'step'); side = -side; continue; }
      let span = j === 0 ? (d0 > 0 ? [exit[1] + G, inner[1]] : [inner[0], exit[0] - G]) : inner;
      // (a gallery low over the floor would be over her head as she walks it: there, only its end at the step above)
      if (span[1] - span[0] < (j === 0 ? L : CLIMB.gallery)) return null;
      if (z(k) - floor < hero.stature + CLIMB.th + CLIMB.head) span = side > 0 ? [span[0], span[0] + L] : [span[1] - L, span[1]];
      out[k] = piece(span[0], span[1], z(k), 'gallery');
    }
  } else if (figure === 'flights') {
    // (top down: from the exit, treads stepping away from it a pitch at a time; a landing at the wall; then back)
    out[n] = piece(exit[0], exit[1], z(n), 'exit');
    const T = CLIMB.tread;
    let d = d0, c = (exit[0] + exit[1]) / 2, w = exit[1] - exit[0];
    for (let k = n - 1; k >= 1; k--) {
      const next = c + d * (w / 2 + G * 1.3 + T / 2);
      if (next + T / 2 > b || next - T / 2 < a) {
        // (the wall: a landing against it, beyond the tread above, then the flight below turns back; with no room for
        // one, the flight turns at that tread, the next one down beside it)
        const edge = c + d * (w / 2 + G), room = d > 0 ? b - edge : edge - a;
        d = -d;
        if (room >= CLIMB.landing * 0.4) { const s = d < 0 ? [edge, b] : [a, edge]; out[k] = piece(s[0], s[1], z(k), 'landing'); c = (s[0] + s[1]) / 2; w = s[1] - s[0]; continue; }
        const back = c + d * (w / 2 + G * 1.3 + T / 2);
        out[k] = piece(back - T / 2, back + T / 2, z(k), 'tread'); c = back; w = T;
        continue;
      }
      out[k] = piece(next - T / 2, next + T / 2, z(k), 'tread');
      c = next; w = T;
    }
  } else if (figure === 'stair') {
    // (one flight of steps walked up across the screen from the floor toward the door, its top step a hop under the exit)
    const steps = Math.ceil((rise - hero.jump * 0.75) / CLIMB.riser), room = (top > mid ? exit[0] - G - a : b - exit[1] - G), going = Math.min(CLIMB.going, room / steps), run = steps * going;
    if (going < CLIMB.going * 0.8) return null;
    out[n] = piece(exit[0], exit[1], z(n), 'exit');
    const zTop = floor + steps * CLIMB.riser;
    if (zTop > z(n) - 0.5 || zTop < z(n) - hero.jump * 0.9) return null;
    // (the flight runs away from the exit and rises toward it, its top tread a gap from the exit's side)
    const d = d0, t1 = d > 0 ? exit[1] + G : exit[0] - G, t0 = t1 + d * run;
    if (t0 > b + 1e-6 || t0 < a - 1e-6) return null;
    const st = [];
    for (let k = 1; k <= steps; k++) { const s = t0 - d * (k - 1) * going, e = s - d * going; st.push(piece(Math.min(s, e), Math.max(s, e), floor + k * CLIMB.riser, 'stair')); }
    const faults = climbFaults([...st, out[n]], { hero, existing, floor });
    return faults.length ? null : [...st, out[n]];
  } else return null;
  const stands = out.slice(1);
  return climbFaults(stands, { hero, existing, floor }).length ? null : stands;
}

/**
 * THE CASTLE'S OWN CLIMBS (docs/metroidvania-map.md "Climbs"): a room climbed by its STRUCTURE, never by a run of floating
 * steps. Every piece is built onto the castle and stands solid (a collider, never jumped up through): flights of stairs
 * walked up across the screen, their stringers under them; landings built out from a wall or the tower's pier; a ladder
 * at a turn, set in a slot beside the landing over it, where the way doubles back above itself; the tower's pier up its
 * middle, crossed through an archway at a landing (the climb weaves from one screen to the other); a flight of great
 * steps (each a jump) where the room is climbed by leaps; the rock itself breaking through the floor at the castle's foot.
 *
 *   STRUCTURES                 { <figure>: says }   stair-tower (walked flights) · great-stair (flights of great steps,
 *                              jumped, every other flight walked)
 *   STRUCT                     the pieces' measures (m)
 *   layStructure(figure, ctx)  → { pieces, stands, openings, ladders } or null where it does not fit or fails its checks
 *     ctx  { a, b, pier?: [p0, p1], floor, top, exit: { bay, end: 'lo' | 'hi' }, phase?: 'F' | 'L', hero, door,
 *          ceiling, floorHoles, floorDoors, existing, terrain? }   phase: the exit reached by a flight (unsaid) or by its
 *          ladder; floorDoors the doorways at its floor and what stands on it (a
 *          save, a relic, a key: kept clear)   a, b the room's inner reach; pier a tower's (its bays either side of it); top the exit's
 *          stand; exit where it is (the wall end of a bay under the door's hole, or the lip at its doorway); door a
 *          doorway's height (the pier's archways); floorHoles the holes in its floor (kept clear over); existing pieces
 *          already in the room; terrain true where the room stands on the castle's rock (its foot breaks through)
 *     pieces   [{ kind: 'stair' | 'great' | 'landing' | 'pier', s0, s1, z0, z1, terrain? }]   solids (z1 its top)
 *     stands   [{ s0, s1, z, way: 'walk' | 'jump' | 'ladder' }]   what she stands on, lowest first, and how she gets on it
 *     ladders  [{ s, z0, z1, off: [s, z] }]   each ladder's line, its foot and its head, where it is stepped off
 *   structFaults(pieces, ctx) → [say]   a solid over a head (closer than a jump and a body under it: she would strike it
 *                              rising), a solid over a hole in the floor she comes up through, a mass before a doorway
 */
export const STRUCTURES = Object.freeze({
  'stair-tower': 'flights walked up across the screen, landings on the walls and the pier, a ladder where the way doubles back',
  'great-stair': 'flights of great steps leapt up, every other flight walked, landings and ladders as a stair tower\'s',
});
/** the pieces' measures: a walked step's riser (under the runtime's step) and going (least and most), a stringer's depth
 * under its treads, a landing's length and its depth, a ladder turn's landings (the foot's, the head's slot left for the
 * ladder), a ladder's rise (a landing over another a jump and a body clear), a tower's pier, a great step's rise and going */
/** the structures a built room is tried by, dealt room by room in turn (a great stair's leaps, then a stair tower's walk) */
export const STRUCT_DEAL = Object.freeze([Object.freeze(['great-stair', 'stair-tower']), Object.freeze(['stair-tower', 'great-stair'])]);
export const STRUCT = Object.freeze({ riser: 0.28, going: Object.freeze([0.42, 0.5]), stringer: 1.0, landing: 2.6, depth: 0.8, foot: 3.6, slot: 1.1, ladder: 5.0, pier: 1.6, great: Object.freeze({ rise: 1.5, going: 2.4, depth: 2.0 }) });

/** What makes a structure unplayable (see the header). */
export function structFaults(pieces, { hero, floor, floorHoles = [], floorDoors = [], existing = [] }) {
  const out = [], clear = hero.jump + hero.stature + 0.2, solid = [...existing, ...pieces].filter((p) => p.kind !== 'pier');
  for (const p of solid) for (const q of solid) {
    if (p === q || q.z0 < p.z1 - 1e-6) continue;
    const over = Math.min(p.s1, q.s1) - Math.max(p.s0, q.s0);
    if (over > 0.2 && q.z0 - p.z1 < clear) out.push(`a ${q.kind} ${r3(q.z0 - p.z1)} m over a ${p.kind} at ${r3(p.s0)}–${r3(p.s1)}`);
  }
  for (const s of floorDoors) for (const p of pieces) {
    if (p.kind !== 'pier' && p.z0 < floor + clear && p.z1 > floor + 0.5 && Math.min(p.s1, s + 2.5) - Math.max(p.s0, s - 2.5) > 0) out.push(`a ${p.kind} before the doorway at ${r3(s)}`);
  }
  for (const h of floorHoles) for (const p of pieces) {
    if (p.kind === 'pier') continue;
    if (Math.min(p.s1, h[1]) - Math.max(p.s0, h[0]) > 0.1 && p.z0 < floor + clear) out.push(`a ${p.kind} over the hole at ${r3(h[0])}–${r3(h[1])}`);
  }
  return out;
}

/** A room climbed by its structure (see the header), or null. */
export function layStructure(figure, ctx) {
  if (!STRUCTURES[figure]) return null;
  const { a, b, pier = null, floor, top, exit, hero, door, ceiling, floorHoles = [], existing = [], terrain = false } = ctx, S = STRUCT;
  const bays = pier ? [[a, pier[0]], [pier[1], b]] : [[a, b]], two = bays.length === 2;
  // (the way up, a cycle: a flight across a bay, through the pier to the other bay, a flight across it, a ladder where
  // it doubles back; in one bay, a flight and a ladder at each wall)
  const moves = two
    ? [['F', 0, 'lo'], ['X', 0], ['F', 1, 'lo'], ['L', 1, 'hi'], ['F', 1, 'hi'], ['X', 1], ['F', 0, 'hi'], ['L', 0, 'lo']]
    : [['F', 0, 'lo'], ['L', 0, 'hi'], ['F', 0, 'hi'], ['L', 0, 'lo']];
  const other = (e) => (e === 'lo' ? 'hi' : 'lo');
  // (a landing at a bay's end: a ladder's foot the length of its turn, a ladder's head clear of the ladder's slot, the
  // pier's, the exit's)
  const landing = (k, end, kind, z) => {
    const [p, q] = bays[k], len = kind === 'pier' ? S.landing : S.foot, lo = kind === 'head' ? S.slot : 0;
    const [s0, s1] = end === 'lo' ? [p + lo, p + len] : [q - len, q - lo];
    return { kind: 'landing', s0, s1, z0: Math.max(floor, z - S.depth), z1: z, end, bay: k, role: kind };
  };
  const inner = (L) => (L.end === 'lo' ? L.s1 : L.s0);
  // (the move that arrives at the exit: the flight that ends at its end, or, a phase on, the ladder up to it)
  const byLadder = ctx.phase === 'L', top0 = landing(exit.bay, exit.end, byLadder ? 'head' : 'exit', top), down = [{ piece: top0, way: null }];
  const pieces = [top0], ladders = [], openings = [];
  let i = moves.findIndex((m) => (byLadder ? m[0] === 'L' && m[2] === exit.end : m[0] === 'F' && other(m[2]) === exit.end) && m[1] === exit.bay), cur = top0, z = top, flights = 0;
  if (i < 0) return null;
  for (let guard = 0; guard < 64 && z > floor + 1e-6; guard++) {
    const [kind, k, from] = moves[i], prev = moves[(i - 1 + moves.length) % moves.length];
    if (kind === 'F') {
      // (a flight down from the landing it arrives at to the one it leaves: walked steps, or great steps on every other
      // flight of a great stair; the lowest steepened to the floor where it reaches it)
      const great = figure === 'great-stair' && flights % 2 === 0, below = prev[0] === 'L' ? 'head' : prev[0] === 'X' ? 'pier' : 'foot';
      const fromL = landing(k, from, below, 0), e0 = inner(fromL), e1 = inner(cur), run = Math.abs(e1 - e0), dir = Math.sign(e1 - e0);
      const rise1 = great ? S.great.rise : S.riser, go = great ? [S.great.going, S.great.going] : S.going;
      let n = Math.floor(run / go[1]);
      const toFloor = z - floor <= n * rise1 + 1e-6 || z - floor <= Math.floor(run / go[0]) * rise1;
      if (toFloor) n = Math.ceil((z - floor) / rise1 - 1e-6);
      if (n < 1) return null;
      const g = toFloor ? Math.min(go[1], run / n) : run / n;
      if (g < go[0] - 1e-6) return null;
      // (step j from the top: its tread rise1 a step under the one above it, the landing's level the top step's)
      for (let j = 0; j < n; j++) {
        const t = z - (j + 1) * rise1, zt = Math.max(floor, t), x1 = e1 - dir * j * g, x0 = x1 - dir * g;
        if (zt <= floor + 1e-6) break;
        // (the flight that rises from the floor is built up from it, one stepped mass: never a stair hung in the air)
        const st = { kind: great ? 'great' : 'stair', s0: Math.min(x0, x1), s1: Math.max(x0, x1), z0: toFloor ? floor : Math.max(floor, zt - (great ? S.great.depth : S.stringer)), z1: zt };
        pieces.push(st); down.push({ piece: st, way: null });
      }
      // (the way onto each: a stand above the next walked or leapt)
      flights++;
      if (toFloor) break;
      z -= n * rise1;
      cur = landing(k, from, below, z); pieces.push(cur); down.push({ piece: cur, way: null });
    } else if (kind === 'L') {
      // (a ladder from the landing at its foot up to the head over it; from the floor where it is under its rise)
      const [, , end] = moves[i], p = bays[k], ws = end === 'lo' ? p[0] + 0.5 : p[1] - 0.5, z0 = Math.max(floor, z - S.ladder);
      ladders.push({ s: r3(ws), z0: r3(z0), z1: r3(z), off: [r3((cur.s0 + cur.s1) / 2), r3(z)] });
      down.at(-1).way = 'ladder';
      if (z0 <= floor + 1e-6) { z = floor; break; }
      z = z0;
      cur = landing(k, end, 'foot', z); pieces.push(cur); down.push({ piece: cur, way: null });
    } else {
      // (through the pier: the landing on its other side at the same height, an archway between them)
      const nk = k, Lx = landing(nk, nk === 0 ? 'hi' : 'lo', 'pier', z);
      openings.push({ z0: r3(z), z1: r3(z + door) });
      pieces.push(Lx); down.push({ piece: Lx, way: 'walk' });
      cur = Lx;
    }
    i = (i - 1 + moves.length) % moves.length;
  }
  // the pier, its archway at its foot and one at each crossing
  // (a pier only where the way weaves through it: a room of two screens climbed in one of them keeps its floor whole)
  if (two && openings.length) {
    const cuts = [{ z0: floor, z1: floor + door }, ...openings].sort((x, y) => x.z0 - y.z0);
    let zz = floor;
    for (const c of cuts) { if (c.z0 - zz > 0.05) pieces.push({ kind: 'pier', s0: pier[0], s1: pier[1], z0: zz, z1: c.z0 }); zz = Math.max(zz, c.z1); }
    if (ceiling - zz > 0.05) pieces.push({ kind: 'pier', s0: pier[0], s1: pier[1], z0: zz, z1: ceiling });
  }
  // the stands, lowest first, each reached from the one below it: walked where it rises a step, a ladder's head by its
  // ladder, else leapt
  const up = down.reverse(), stands = [];
  let last = floor;
  for (const { piece: p, way } of up) {
    const w = way === 'ladder' ? 'ladder' : p.z1 - last <= S.riser + 1e-6 ? 'walk' : 'jump';
    stands.push({ s0: r3(p.s0), s1: r3(p.s1), z: r3(p.z1), way: w });
    last = p.z1;
  }
  // (and where the room stands on the rock, what rises from its floor is the rock)
  const out = pieces.map((p) => ({ ...p, s0: r3(p.s0), s1: r3(p.s1), z0: r3(p.z0), z1: r3(p.z1), ...(terrain && p.z0 <= floor + 1e-6 && p.kind !== 'pier' ? { terrain: true } : {}) }));
  const faults = structFaults(out, { hero, floor, floorHoles, floorDoors: ctx.floorDoors ?? [], existing });
  // (each rise a jump at most but a ladder's; each gap within reach)
  for (let k = 1; k < stands.length; k++) {
    const p = stands[k], q = stands[k - 1], gap = Math.max(0, p.s0 - q.s1, q.s0 - p.s1);
    if (p.way !== 'ladder' && (p.z - q.z > hero.jump + 1e-6 || gap > CLIMB.reach * hero.jump)) faults.push(`a ${p.way} of ${r3(p.z - q.z)} m up and ${r3(gap)} m across`);
  }
  return faults.length ? null : { pieces: out, stands, ladders, openings };
}
