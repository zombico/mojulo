/**
 * PEDESTRIANS: people on the walks, for plausibility, not a crowd model. Most walk round their block on its sidewalk;
 * some walk round two neighbouring blocks, crossing the street between them at both ends, and at a signalled crossing
 * they wait at the kerb until the cars of the street they cross are held and the street they walk along has green
 * enough left to cross on (traffic-model.js phaseAt: the cars' own signals).
 *
 *   people: 0…1      how many: none to a walker or so per block (capped); 0.5 by default when the streets are driven
 *
 * Each walker is a loop in the world's units ({ path, speed, holds: [{ s, sig, go, len }] }), handed to the legacy
 * city's walkers (worlds/world-kinds.js attachCityWalkers bakes their clothed rigs); a hold is where a crossing starts
 * along the loop, the junction it is beside, the axis whose green it walks with, and how long the crossing is. The
 * walkers channel steps a held walker from clock zero, as the cars are stepped, so a replay is the same people.
 * Seeded per block (`${seed}|people-v1|<block>`); a lot by hand moves no one.
 */
import { streamOf } from './dice.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

export const PEOPLE = Object.freeze({ cap: 48, levelCap: 12, inset: 1.2, speed: 1.35, pairShare: 0.4, sameEdge: 2.2 });
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A recipe's `people`, checked → 0…1. */
export function readPeople(v, driven = true) {
  if (v === undefined) return driven ? 0.5 : 0;
  if (!(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error('city: people is a number from 0 (none) to 1 (a walker or so per block)');
  return v;
}

// a closed ring round a rect, pushed out onto the walk, clockwise from its north-west corner (metres)
const ring = (r, k) => [[r.x0 - k, r.y0 - k], [r.x1 + k, r.y0 - k], [r.x1 + k, r.y1 + k], [r.x0 - k, r.y1 + k], [r.x0 - k, r.y0 - k]];

/**
 * The walkers of a designed city: [{ path: [[x, y, z]] (units, closed), speed (units/s), holds, block }]. `junctions` is
 * the traffic's (traffic.js cityTraffic, units), in the order its signals are built, so a hold names its signal by
 * index. `crop` (metres) keeps a level's walkers to its reach.
 */
export function cityPedestrians(d, junctions = [], { people = 0.5, crop = null } = {}) {
  if (!(people > 0)) return [];
  const blocks = d.blocks.filter((b) => b.rect && (b.rect.x1 - b.rect.x0) > 12 && (b.rect.y1 - b.rect.y0) > 12)
    .filter((b) => !crop || !(b.rect.x1 < crop.x0 || b.rect.x0 > crop.x1 || b.rect.y1 < crop.y0 || b.rect.y0 > crop.y1));
  const k = PEOPLE.inset, out = [];
  // a street's carriageway where a pair's edge crosses it: the street between the two blocks
  const between = (a, b, axis) => d.streets.find((s) => s.pts.length === 2 && (axis === 'x' ? Math.abs(s.pts[0][0] - s.pts[1][0]) < 1e-6 && s.pts[0][0] > a.rect.x1 && s.pts[0][0] < b.rect.x0 : Math.abs(s.pts[0][1] - s.pts[1][1]) < 1e-6 && s.pts[0][1] > a.rect.y1 && s.pts[0][1] < b.rect.y0));
  const junctionAt = (x, y) => { let best = -1, bd = Infinity; junctions.forEach((j, i) => { const dd = Math.hypot(j.x * U - x, j.y * U - y); if (dd < bd) { bd = dd; best = i; } }); return bd < 40 ? best : -1; };
  for (const b of blocks) {
    const rand = streamOf(d.plan.seed, 'people', b.id);
    if (rand() >= people) continue;
    // a neighbour across a street, its edges in line (within a walk's width), for a loop round the two
    const east = blocks.find((o) => o !== b && o.rect.x0 > b.rect.x1 && o.rect.x0 - b.rect.x1 < 40 && Math.abs(o.rect.y0 - b.rect.y0) < PEOPLE.sameEdge && Math.abs(o.rect.y1 - b.rect.y1) < PEOPLE.sameEdge);
    const south = blocks.find((o) => o !== b && o.rect.y0 > b.rect.y1 && o.rect.y0 - b.rect.y1 < 40 && Math.abs(o.rect.x0 - b.rect.x0) < PEOPLE.sameEdge && Math.abs(o.rect.x1 - b.rect.x1) < PEOPLE.sameEdge);
    const pair = rand() < PEOPLE.pairShare ? (east && rand() < 0.5 ? { o: east, axis: 'x' } : south ? { o: south, axis: 'y' } : east ? { o: east, axis: 'x' } : null) : null;
    const st = pair ? between(b, pair.o, pair.axis) : null;
    const R = pair && st ? { x0: Math.min(b.rect.x0, pair.o.rect.x0), y0: Math.min(b.rect.y0, pair.o.rect.y0), x1: Math.max(b.rect.x1, pair.o.rect.x1), y1: Math.max(b.rect.y1, pair.o.rect.y1) } : b.rect;
    const pts = ring(R, k), holds = [];
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      // this edge crosses the street between the pair: hold at its kerb, beside the junction there
      if (st) {
        const along = pair.axis === 'x' ? 0 : 1, at = st.pts[0][along], lo = Math.min(a[along], c[along]), hi = Math.max(a[along], c[along]);
        if (a[1 - along] === c[1 - along] && at > lo && at < hi) {
          const dir = Math.sign(c[along] - a[along]), kerb = at - dir * st.road / 2, sh = s + Math.abs(kerb - a[along]) - 0.3;
          const j = junctionAt(...(along === 0 ? [at, a[1]] : [a[0], at]));
          if (j >= 0) holds.push({ s: r3(sh / U), sig: j, go: along === 0 ? 'x' : 'y', len: r3((st.road + 0.6) / U) });
        }
      }
      s += L;
    }
    out.push({ block: b.id, path: pts.map(([x, y]) => [r3(x / U), r3(y / U), 0]), speed: r3((PEOPLE.speed * (0.85 + rand() * 0.3)) / U), start: r3(rand()), holds });
    if (out.length >= (crop ? PEOPLE.levelCap : PEOPLE.cap)) break;   // a level (drawn every frame a walker moves) keeps a dozen
  }
  return out;
}
