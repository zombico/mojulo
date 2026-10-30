/**
 * THE GEOCITY'S LAWS — what a metro's map is measured by. Each advises and never refuses: { law, ok, value, want }. The
 * ledger's law is the map's own (every square metre once); the arterials' the land's (their grade); the rings', the
 * green's and the holds law the metro's shape; the region graph's (`open`, `sideways`) the Quest Open World's: every
 * neighbourhood reached without a gate, and always two ways round, so the map opens sideways and never forces a way in.
 *
 *   geocityLaws(design) → [{ law, ok, value, want }]
 */
import { sectionOf } from '../geotown/pattern.js';
import { ringMedians } from './heights.js';
import { interiorOf } from './parks.js';

const r2 = (v) => Math.round(v * 100) / 100;

export const GEOCITY_LAWS = Object.freeze({
  closes: 'every square metre of the map is one thing: water, an arterial, a park or a neighbourhood',
  grade: 'no arterial steeper than the metro\'s grade',
  rings: 'a core, a frame and outskirts, in that order out from the seat',
  green: 'the city\'s green share given out, and no neighbourhood\'s quota more than its most of its ground',
  holds: 'every outskirts neighbourhood holds a geotown neighbourhood of its outskirts\' pattern (two blocks by two)',
  ports: 'every neighbourhood fronts two arterials or more',
  open: 'every neighbourhood reached from every other across the arterials, no gate on the way',
  sideways: 'no edge of the region graph is its only way between two parts: always two ways round',
  skyline: 'the skyline falls outward: the core\'s neighbourhoods build higher on the whole than the frame\'s, the frame\'s than the outskirts\'',
  caps: 'every neighbourhood\'s interior inside the rail of the ring it builds as, its frontages inside theirs',
  interior: 'every neighbourhood keeps an interior behind its arterial frontages',
  parks: 'each neighbourhood\'s park placed as its quota asks, inside it and clear of its frontages',
});

/** The least neighbourhood a geotown of this pattern lays two blocks by two in: along its long blocks, and across their
 *  two rows back to back, a local street between them each way (the arterials round it are the geocity's). */
export function geotownLeast(P) {
  const row = sectionOf(P, 'street').row;
  return [r2(2 * P.block.long[0] + row), r2(2 * 2 * P.block.depth[0] + row)];
}

/** The region graph's bridges: the edges whose loss splits it. */
export function bridgesOf(graph) {
  const adj = new Map(graph.nodes.map((n) => [n, []]));
  for (const e of graph.edges) { adj.get(e.a).push([e.b, e.id]); adj.get(e.b).push([e.a, e.id]); }
  const disc = new Map(), low = new Map(), out = [];
  let t = 0;
  // (iterative: a metro's graph may be long)
  for (const root of graph.nodes) {
    if (disc.has(root)) continue;
    const stack = [[root, null, 0]];
    disc.set(root, t); low.set(root, t); t++;
    while (stack.length) {
      const top = stack[stack.length - 1], [u, via] = top, list = adj.get(u);
      if (top[2] < list.length) {
        const [v, id] = list[top[2]++];
        if (id === via) continue;
        if (!disc.has(v)) { disc.set(v, t); low.set(v, t); t++; stack.push([v, id, 0]); } else low.set(u, Math.min(low.get(u), disc.get(v)));
      } else {
        stack.pop();
        if (stack.length) { const p = stack[stack.length - 1][0]; low.set(p, Math.min(low.get(p), low.get(u))); if (low.get(u) > disc.get(p)) out.push(via); }
      }
    }
  }
  return out;
}

/** The parts of the region graph (each a list of its neighbourhoods). */
export function partsOf(graph) {
  const adj = new Map(graph.nodes.map((n) => [n, []]));
  for (const e of graph.edges) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  const seen = new Set(), parts = [];
  for (const n of graph.nodes) {
    if (seen.has(n)) continue;
    const part = [], q = [n];
    seen.add(n);
    while (q.length) { const u = q.shift(); part.push(u); for (const v of adj.get(u)) if (!seen.has(v)) { seen.add(v); q.push(v); } }
    parts.push(part);
  }
  return parts;
}

const within = (a, b) => a[0] >= b[0] - 1e-6 && a[1] >= b[1] - 1e-6 && a[2] <= b[2] + 1e-6 && a[3] <= b[3] + 1e-6;

export function geocityLaws(d) {
  const M = d.metro, L = d.ledger, out = [];
  const sum = L.water + L.arterials + L.parks + L.neighbourhoods;
  out.push({ law: 'closes', ok: Math.abs(sum - L.total) < 1, value: `${Math.round(sum)} of ${Math.round(L.total)} m²`, want: 'the map' });
  const steep = d.lines.reduce((b, l) => (l.grade > (b?.grade ?? -1) ? l : b), null);
  out.push({ law: 'grade', ok: !steep || steep.grade <= M.grade, value: steep ? `${steep.id} ${r2(steep.grade * 100)}%` : 'none', want: `≤ ${r2(M.grade * 100)}%` });
  const ringsOf = (k) => d.regions.filter((r) => r.ring === k);
  const far = (k) => Math.max(...ringsOf(k).map((r) => r.dist)), near = (k) => Math.min(...ringsOf(k).map((r) => r.dist));
  const present = ['core', 'frame', 'outskirts'].filter((k) => ringsOf(k).length);
  // (the four round the seat are the core whatever their reach: the frame is what must stand inside the outskirts)
  const ordered = present.length === 3 && far('frame') <= near('outskirts');
  out.push({ law: 'rings', ok: present.length === 3 && ordered, value: ['core', 'frame', 'outskirts'].map((k) => `${k} ${ringsOf(k).length}`).join(', '), want: 'each ring, outward' });
  const over = d.regions.filter((r) => !r.park && r.area > 0 && r.green / r.area > M.green.most);
  const given = L.green.reserved + L.green.quotas;
  out.push({ law: 'green', ok: given >= L.green.budget - 1 && !over.length, value: `${r2(given / (L.land || 1) * 100)}% of the land${over.length ? `; ${over.map((r) => r.id).join(', ')} over ${M.green.most}` : ''}`, want: `≥ ${r2(M.green.share * 100)}%` });
  const [a, b] = geotownLeast(d.spec.pattern);
  const holds = (r) => { const w = r.rect[2] - r.rect[0], h = r.rect[3] - r.rect[1]; return (w >= a && h >= b) || (w >= b && h >= a); };
  const small = d.regions.filter((r) => r.ring === 'outskirts' && !r.park && !holds(r));
  out.push({ law: 'holds', ok: !small.length, value: small.length ? `${small.length} too small (${small.slice(0, 6).map((r) => r.id).join(', ')}${small.length > 6 ? '…' : ''})` : 'every one', want: `${a} × ${b} m` });
  const lone = d.regions.filter((r) => r.ports.length < 2);
  out.push({ law: 'ports', ok: !lone.length, value: lone.length ? lone.map((r) => r.id).join(', ') : 'every one', want: '≥ 2 arterials' });
  const parts = partsOf(d.graph);
  out.push({ law: 'open', ok: parts.length === 1, value: `${parts.length} part${parts.length === 1 ? '' : 's'}`, want: 'one' });
  const bridges = bridgesOf(d.graph);
  out.push({ law: 'sideways', ok: !bridges.length, value: bridges.length ? bridges.join(', ') : 'no bridge', want: 'no bridge' });
  if (!d.regions.every((r) => r.storeys)) return out;
  // the heights: each ring's builders' mean median, falling outward
  const built = d.regions.filter((r) => !r.park), mean = (k) => { const ms = built.filter((r) => r.builds === k).map((r) => r.storeys.median); return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null; };
  const means = ['core', 'frame', 'outskirts'].map(mean), held = means.filter((m) => m !== null);
  out.push({ law: 'skyline', ok: held.every((m, k) => k === 0 || m < held[k - 1]), value: ['core', 'frame', 'outskirts'].map((k, i) => `${k} ${means[i] === null ? '–' : r2(means[i])}`).join(', '), want: 'falling outward' });
  const inside = (m, [lo, hi]) => m >= lo - 1e-6 && m <= hi + 1e-6;
  const off = built.filter((r) => !inside(r.storeys.median, r.storeys.rail) || Object.values(r.frontage).some((f) => !inside(f.median, f.rail)));
  const rm = ringMedians(d);
  out.push({ law: 'caps', ok: !off.length, value: off.length ? off.map((r) => r.id).join(', ') : Object.entries(rm).filter(([, v]) => v).map(([k, v]) => `${k} ${v.join('–')}`).join(', '), want: 'inside each rail' });
  const depth = M.heights.corridor.depth, thin = built.filter((r) => { const i = interiorOf(r, depth); return i[2] - i[0] <= 0 || i[3] - i[1] <= 0; });
  out.push({ law: 'interior', ok: !thin.length, value: thin.length ? thin.map((r) => r.id).join(', ') : 'every one', want: `> ${depth} m frontages` });
  const P = M.green.park, asked = built.filter((r) => r.green * P.share[r.ring] >= P.least), want = asked.reduce((s, r) => s + r.green * P.share[r.ring], 0);
  const placed = built.reduce((s, r) => s + (r.parkRect?.area ?? 0), 0);
  const stray = built.filter((r) => r.parkRect && !within(r.parkRect.rect, interiorOf(r, depth)));
  out.push({ law: 'parks', ok: !stray.length && placed >= 0.9 * want - 1, value: `${built.filter((r) => r.parkRect).length} parks, ${Math.round(placed / 1e4)} of ${Math.round(want / 1e4)} ha asked${stray.length ? `; ${stray.map((r) => r.id).join(', ')} astray` : ''}`, want: '≥ 90%, inside' });
  return out;
}
