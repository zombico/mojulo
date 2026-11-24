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
