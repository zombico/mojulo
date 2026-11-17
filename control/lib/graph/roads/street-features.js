/**
 * A STREET CIRCUIT'S FEATURES — what makes a race through a town more than a loop round its blocks (a design language's
 * `parts.city.split` and `parts.city.tunnel`, track-language.js; a course of streets, course.js designStreets):
 *
 *   split    the way divides down its longest straight: a branch leaves it on the side away from the town's middle,
 *            runs beside it round an island of shops and comes back before the corner. Either way is the lap: the
 *            branch is a road the karts drive (its points join the drive surface, roads/surface.js), the rail opens at
 *            its two mouths, and no checkpoint stands between them (roads/contract.js), so whichever way a racer takes
 *            the lap counts
 *   tunnel   an underpass down another straight: a building spans the street, the way passing under its ground floor,
 *            lit inside (set-pieces.js `toy-tunnel`)
 *
 *   streetFeatures({ stations, alignment, X, course, card }) → { split?, tunnel? } | null
 *     split   { side, s0, s1, leg, offset, branch: { alignment, stations } } (s0, s1 the mouths along the lap)
 *     tunnel  { s, l } (its middle along the lap and its length)
 *   splitGap(split, side, s) → is the main rail open here (a mouth of the split on this side)?
 *
 * Pure: geometry only, no dice (the course's seed decided its shape).
 */
import { fromPIs } from './course.js';
import { designClass } from './classes.js';
import { trackRuns } from './track.js';

export function streetFeatures({ stations, alignment: a, X, course, card }) {
  const C = card?.parts?.city;
  if (!C || course?.design?.form !== 'streets' || (!C.split && !C.tunnel)) return null;
  const L = a.length, runs = trackRuns({ stations, alignment: a });
  // (a straight over the start line keeps its grid and its gantry: no feature stands on it)
  const free = runs.straights.filter((r) => r.s1 <= L - 1 && r.s0 >= 1).map((r) => ({ ...r, len: r.s1 - r.s0 })).sort((p, q) => q.len - p.len);
  const xs = stations.map((p) => p.x), ys = stations.map((p) => p.y), core = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const P = (s, off) => { const q = a.at(s); return [q.x - Math.sin(q.heading) * off, q.y + Math.cos(q.heading) * off]; };
  const out = {};
  let used = null;
  if (C.split) {
    const offset = 2 * X.outer + 2 * C.sidewalk + C.split.island, leg = C.split.leg, need = 2 * leg + C.split.run + 2 * C.margin;
    const r = free.find((q) => q.len >= need);
    if (r) {
      const mid = (r.s0 + r.s1) / 2, half = leg + C.split.run / 2, s0 = mid - half, s1 = mid + half;
      // the side away from the town's middle (the branch runs where nothing of the lap's own lies)
      const away = (side) => { const p = P(mid, side * offset); return Math.hypot(p[0] - core[0], p[1] - core[1]); };
      const side = away(1) > away(-1) ? 1 : -1, cls = designClass(course.class), rad = Math.min(cls.rmin * 1.4, leg * 0.45);
      const pis = [[...P(s0, 0), rad], [...P(s0 + leg, side * offset), rad], [...P(s1 - leg, side * offset), rad], [...P(s1, 0), rad]];
      const branch = fromPIs({ class: course.class, pis, closed: false });
      out.split = { side, s0, s1, leg, offset, branch: { alignment: branch.alignment, stations: branch.alignment.stations({ fine: 1, coarse: 2 }) } };
      used = r;
    }
  }
  if (C.tunnel) {
    // (an underpass wants only its own length and a little either side: its building is the row there)
    const r = free.find((q) => q !== used && q.len >= C.tunnel.length + 16) ?? null;
    if (r) out.tunnel = { s: (r.s0 + r.s1) / 2, l: C.tunnel.length };
  }
  return Object.keys(out).length ? out : null;
}

/** Is the main way's rail open at s on this side (a mouth of the split: the branch leaving, or coming back)? */
export function splitGap(split, side, s) {
  if (!split || side !== split.side) return false;
  return (s > split.s0 - 2 && s < split.s0 + split.leg + 4) || (s > split.s1 - split.leg - 4 && s < split.s1 + 2);
}
