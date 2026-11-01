/**
 * THE GEOCITY'S PARKS — each neighbourhood's own park, placed out of its green quota before its streets are cut, so the
 * collectors and locals laid later go round it (as city/plan's reserved sites are laid before its grid). A neighbourhood
 * takes its ring's share of its quota as its park; under the least it lays none, and the whole quota is left to its
 * segments (parkettes, plazas, verges, yards).
 *
 *   on the water   a waterfront neighbourhood's park is a band along its shore, the whole run of it (a lakeshore park)
 *   inland         a rect inside its INTERIOR (the neighbourhood clear of its arterial frontages), its long side along the
 *                  interior's, its longest side at most `aspect` times its shortest, set by its own dice
 *
 *   parksOf(d, heights) → { <region id>: { rect, area, along: 'water' | 'inland' } }   (a city park is its whole region)
 *
 * Pure: each park's dice are its neighbourhood's (`${seed}|parks-v1|<id>`).
 */
import { streamOf } from '../city/plan/dice.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

/** A neighbourhood clear of its arterial frontages: each arterial side stepped in by the corridor's depth. */
export function interiorOf(r, depth) {
  const [x0, y0, x1, y1] = r.rect, a = (s) => (r.sides[s].kind === 'arterial' ? depth : 0);
  return [r3(x0 + a('w')), r3(y0 + a('s')), r3(x1 - a('e')), r3(y1 - a('n'))];
}

export function parksOf(d) {
  const M = d.metro, P = M.green.park, depth = M.heights.corridor.depth, out = {};
  for (const r of d.regions) {
    if (r.park) continue;
    const want = r.green * P.share[r.ring];
    if (want < P.least) continue;
    const [x0, y0, x1, y1] = interiorOf(r, depth), W = x1 - x0, D = y1 - y0;
    if (W <= 0 || D <= 0) continue;
    const R = streamOf(d.seed, 'parks', r.id);
    const shore = ['s', 'n', 'w', 'e'].find((s) => r.sides[s].kind === 'water');
    let rect;
    if (shore) {
      // along the water: the shore's whole run, as deep as the park needs (never more than half the interior)
      const run = shore === 's' || shore === 'n' ? W : D, deep = Math.min(want / run, (shore === 's' || shore === 'n' ? D : W) / 2);
      rect = { s: [x0, y0, x1, y0 + deep], n: [x0, y1 - deep, x1, y1], w: [x0, y0, x0 + deep, y1], e: [x1 - deep, y0, x1, y1] }[shore];
    } else {
      // inland: its long side along the interior's, its aspect rolled, held inside the interior
      const aspect = 1 + (P.aspect - 1) * R(), long = Math.max(W, D), short = Math.min(W, D);
      let a = Math.min(long, Math.sqrt(want * aspect)), b = want / a;
      if (b > short) { b = short; a = Math.min(long, want / b); }
      const [w, h] = W >= D ? [a, b] : [b, a], px = x0 + (W - w) * R(), py = y0 + (D - h) * R();
      rect = [px, py, px + w, py + h];
    }
    rect = rect.map(r3);
    const area = r3((rect[2] - rect[0]) * (rect[3] - rect[1]));
    if (area < P.least) continue;
    out[r.id] = { rect, area, along: shore ? 'water' : 'inland' };
  }
  return out;
}
