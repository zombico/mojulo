/**
 * THE GEOCITY'S HEIGHTS — how tall a metro builds where, in storeys, before a building is drawn. Three reads, the
 * highest of them wins at a point:
 *
 *   rings      each ring's MEDIAN runs from its outer reach to its inner one (the core's inner the seat), between them by
 *              distance and geometrically, inside the ring's RAIL: the core's towers, the frame's lower tall, the
 *              outskirts' four storeys and lower. The skyline falls outward
 *   nodes      SECONDARY CENTRES: every `every`-th crossing of a spine out past the core's reach (counted outward from
 *              the seat along it, the first on the spine's own dice). The four neighbourhoods round a node BUILD as the
 *              ring inside theirs, and the median rises toward the node within its `reach` as that ring's does toward
 *              its inner edge (a Yonge and Eglinton, a Yonge and Bloor)
 *   corridors  an arterial's FRONTAGE: the band `depth` metres deep along each arterial side of a neighbourhood may rise
 *              to the corridor's storeys for its rank (a spine's more than an arterial's) where its ring's rail stops
 *              short: a main street's mid-rise lining it past the core
 *
 *   heightsOf(d) → { reach, nodes: [{ id, at, street, cross }], storeysAt(x, y) → { median, ring, node? },
 *                    regions: { <id>: { builds, node?, storeys: { median, rail }, frontage: { <side>: { rank, median, rail } } } } }
 *
 * Pure: the nodes' dice are their spine's own (`${seed}|heights-v1|nodes:<spine>`), so a node moves only with its spine.
 */
import { streamOf } from '../city/plan/dice.js';
import { RING_IDS } from './metro.js';

const r2 = (v) => Math.round(v * 100) / 100 + 0;
// a ring a node lifts its neighbourhoods to: the ring inside theirs
const INWARD = Object.freeze({ outskirts: 'frame', frame: 'core', core: 'core' });

/** The ring a distance from the seat stands in. */
const ringAt = (dist, R) => (dist <= R.core ? 'core' : dist <= R.frame ? 'frame' : 'outskirts');

/** A ring's median at `t` (0 its outer reach, 1 its inner), geometric between its two medians. */
const medianAt = (h, t) => h.median[0] * (h.median[1] / h.median[0]) ** Math.max(0, Math.min(1, t));

export function heightsOf(d) {
  const M = d.metro, H = M.heights, R = M.rings, [sx, sy] = d.seat;
  // the reaches each ring runs between: the core from the seat, the outskirts out to its farthest neighbourhood's middle
  const far = Math.max(R.frame + 1, ...d.regions.map((r) => r.dist));
  const reach = { core: [0, R.core], frame: [R.core, R.frame], outskirts: [R.frame, far] };
  const tOf = (ring, dist) => { const [a, b] = reach[ring]; return b > a ? 1 - (dist - a) / (b - a) : 1; };

  // the nodes: along each spine, its crossings out past the core's reach each way, every `every`-th from a first rolled
  // on the spine's dice
  const nodes = [];
  if (H.nodes.every > 0) {
    for (const spine of d.lines.filter((l) => l.rank === 'spine')) {
      const crosses = d.lines.filter((l) => l.axis !== spine.axis), seatAt = spine.axis === 'ns' ? sy : sx;
      const first = Math.floor(streamOf(d.seed, 'heights', `nodes:${spine.id}`)() * H.nodes.every);
      for (const dir of [-1, 1]) {
        const out = crosses.filter((l) => (l.at - seatAt) * dir > R.core).sort((p, q) => (p.at - q.at) * dir);
        out.forEach((l, k) => {
          if (k % H.nodes.every !== first) return;
          const at = spine.axis === 'ns' ? [spine.at, l.at] : [l.at, spine.at];
          nodes.push({ id: `${spine.id}×${l.id}`, at, street: spine.id, cross: l.id });
        });
      }
    }
  }

  /** The median storeys at a point and the ring it builds as (a node's lift where one reaches it). */
  const storeysAt = (x, y) => {
    const dist = Math.hypot(x - sx, y - sy), ring = ringAt(dist, R);
    let median = medianAt(H[ring], tOf(ring, dist)), node = null;
    for (const n of nodes) {
      const dn = Math.hypot(x - n.at[0], y - n.at[1]);
      if (dn > H.nodes.reach) continue;
      // toward a node, the ring inside this one's median as it rises toward that ring's inner edge
      const m = medianAt(H[INWARD[ring]], 1 - dn / H.nodes.reach);
      if (m > median) { median = m; node = n.id; }
    }
    return { median: r2(median), ring, ...(node ? { node } : {}) };
  };

  // each neighbourhood: the ring it builds as, its interior's median and rail, and each arterial frontage's
  const regions = {};
  for (const r of d.regions) {
    const node = nodes.find((n) => Math.abs(n.at[0] - (r.rect[0] < n.at[0] ? r.rect[2] : r.rect[0])) <= d.section.half + 1e-6 && Math.abs(n.at[1] - (r.rect[1] < n.at[1] ? r.rect[3] : r.rect[1])) <= d.section.half + 1e-6);
    const builds = node ? INWARD[r.ring] : r.ring, rail = H[builds].rail;
    // (a neighbourhood a node lifts builds at least as its new ring does at its outer reach)
    const at = storeysAt(r.mid[0], r.mid[1]), median = r2(Math.min(rail[1], Math.max(rail[0], at.median, node ? H[builds].median[0] : 0)));
    const frontage = {};
    for (const p of r.ports) {
      const cap = H.corridor[p.rank === 'spine' ? 'spine' : 'arterial'], top = Math.max(rail[1], cap);
      // the frontage's median: the interior's, raised toward its corridor's storeys where the ring's rail stops short
      const mid = [(p.run[0][0] + p.run[1][0]) / 2, (p.run[0][1] + p.run[1][1]) / 2], m = storeysAt(mid[0], mid[1]).median;
      frontage[p.side] = { rank: p.rank, median: r2(Math.min(top, Math.max(median, m, cap > rail[1] ? (rail[1] + cap) / 2 : 0))), rail: [rail[0], top] };
    }
    regions[r.id] = { builds, ...(node ? { node: node.id } : {}), storeys: { median, rail: [...rail] }, frontage };
  }
  return { reach, nodes, storeysAt, regions };
}

/** Each ring's neighbourhoods' interior medians (those that build as it), lowest and highest: what the skyline law reads. */
export function ringMedians(d) {
  return Object.fromEntries(RING_IDS.map((k) => {
    const ms = d.regions.filter((r) => !r.park && r.builds === k).map((r) => r.storeys.median);
    return [k, ms.length ? [Math.min(...ms), Math.max(...ms)] : null];
  }));
}
