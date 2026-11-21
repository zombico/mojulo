/**
 * A STREET CIRCUIT'S FEATURES — what makes a race through a town more than a loop round its blocks (a design language's
 * `parts.city.split` and `parts.city.tunnel`, track-language.js; a course of streets, course.js designStreets):
 *
 *   split    an ALLEY: the way divides before a corner, a cobbled alley cutting across the corner's inside to the
 *            straight after it. It is shorter than the way round the turn but cobbled (slow taken bare: roads/surfaces.js
 *            `cobbles`) and laid with boost pads (quick taken over them): a choice that pays only if it is driven well.
 *            Either way is the lap: the alley is a road the karts drive (its points join the drive surface, marked rough,
 *            roads/surface.js), the rail opens at its two mouths, and no checkpoint stands between them
 *            (roads/contract.js), so whichever way a racer takes the lap counts
 *   tunnel   an underpass down another straight: a building spans the street, the way passing under its ground floor,
 *            lit inside (set-pieces.js `toy-tunnel`)
 *
 *   streetFeatures({ stations, alignment, X, course, card }) → { split?, tunnel? } | null
 *     split   { kind: 'alley', side, s0, s1, leg, corner, way, rough, branch: { alignment, stations }, pads? } (s0, s1
 *             the mouths along the lap, side the corner's inside;
 *             pads: [{ s, at, heading, len, w, boost }] down the branch, a boost of `boost` seconds a wheel on one lights)
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
    // THE ALLEY: a cut across the inside of a corner, from the straight before it to the straight after, shorter than the
    // way round its turn, cobbled (slow taken bare) and laid with boost pads (quick taken over them)
    const S = C.split, cut = S.cut;
    for (const c of runs.corners) {
      const before = free.find((q) => Math.abs(q.s1 - c.s) < 1), after = free.find((q) => q.s0 >= c.s - 1 && q.s0 - c.s < 60);
      // (the cut as long as the straights either side let it be, past the stubs the alley leaves and joins along)
      const stub = 14, k = before && after ? Math.min(cut, before.len - stub - 4, after.len - stub - 4) : 0;
      if (!before || !after || k < 14) continue;
      const a0 = c.s - k, b0 = after.s0 + k, side = c.d, cls = designClass(course.class);
      const chord = Math.hypot(...P(a0, 0).map((v, k) => v - P(b0, 0)[k])), rad = Math.min(cls.rmin * 4, chord * 0.35, stub / Math.tan(Math.PI / 8));
      // (tangent to the way at both ends: it leaves along the way's own line and bends off, and comes back the same)
      const pis = [[...P(a0 - stub, 0), rad], [...P(a0, 0), rad], [...P(b0, 0), rad], [...P(b0 + stub, 0), rad]];
      let branch;
      try { branch = fromPIs({ class: course.class, pis, closed: false }); } catch { continue; }
      // (where it clears the way: its first metres off the way's line further than the way's rail, the mouth's length)
      const Lb = branch.alignment.length, near = (q) => Math.min(...stations.map((p) => Math.hypot(p.x - q.x, p.y - q.y)));
      let clear = stub; while (clear < Lb / 2 && near(branch.alignment.at(clear)) < X.outer + X.road) clear += 1;
      const leg = clear, way = b0 - a0;
      const pads = (S.pads?.at ?? []).map((u) => { const s = leg + 10 + (Lb - 2 * leg - 20) * u, q = branch.alignment.at(s); return { s, at: [q.x, q.y], heading: q.heading, len: S.pads.len, w: 2 * X.road * 0.8, boost: S.pads.seconds }; });
      out.split = { kind: 'alley', side, s0: a0 - stub, s1: b0 + stub, leg: leg - stub + 4, clear: leg, corner: c.s, way, rough: S.surface ?? 'cobbles', branch: { alignment: branch.alignment, stations: branch.alignment.stations({ fine: 1, coarse: 2 }) }, ...(pads.length ? { pads } : {}) };
      used = [before, after];
      break;
    }
  }
  if (C.tunnel) {
    // (an underpass wants only its own length and a little either side: its building is the row there)
    const r = free.find((q) => !(used ?? []).includes(q) && q.len >= C.tunnel.length + 16) ?? null;
    if (r) out.tunnel = { s: (r.s0 + r.s1) / 2, l: C.tunnel.length };
  }
  return Object.keys(out).length ? out : null;
}

/** Is the main way's rail open at s on this side (a mouth of the split: the branch leaving, or coming back)? */
export function splitGap(split, side, s) {
  if (!split || side !== split.side) return false;
  return (s > split.s0 - 2 && s < split.s0 + split.leg + 4) || (s > split.s1 - split.leg - 4 && s < split.s1 + 2);
}
