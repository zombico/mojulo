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
  parks: 'each neighbourhood\'s park placed as its quota asks, inside it (fitted to its streets, it may take a strip of its frontage)',
  blocks: 'inside every neighbourhood its streets, blocks and park are its ground once, and every block\'s surfaces its area',
  pitch: 'every block inside its ring\'s block length (half its least to half again its most)',
  segments: 'every block given to a segment of its ring, and a neighbourhood large enough its civic block (the core\'s square, the outskirts\' school)',
  soft: 'each neighbourhood\'s green ground (its park, its yards, lawns, courts and plantings) at least most of its green quota',
  towers: 'the core\'s towers rise past their podiums and stand inside their rail, the tallest in the core',
  evokes: 'an evocation keeps the metro to scale\'s measures: each ring\'s mix of segments and its storeys, its green share, its towers a core block',
});
// how far an evocation's measures may stand from the metro to scale's before the law advises
export const EVOKE_TOLERANCE = Object.freeze({ mix: 0.25, storeys: [0.8, 1.25], green: 0.05, towers: [0.6, 1.6] });

/** A design's measures the evokes law compares: each ring's segments' shares and its mean storeys, its green share of
 *  the land, its towers a core block. */
export function measuresOf(d) {
  const lots = d.regions.flatMap((r) => r.blocks).filter((b) => b.kind !== 'park'), out = { mix: {}, storeys: {} };
  for (const k of ['core', 'frame', 'outskirts']) {
    const ring = lots.filter((b) => b.ring === k);
    if (!ring.length) continue;
    out.mix[k] = ring.reduce((m, b) => ({ ...m, [b.kind]: (m[b.kind] ?? 0) + 1 / ring.length }), {});
    out.storeys[k] = ring.reduce((a, b) => a + b.storeys.median, 0) / ring.length;
  }
  out.green = d.ledger.green.soft / (d.ledger.land || 1);
  const core = lots.filter((b) => b.ring === 'core');
  out.towers = core.length ? core.reduce((a, b) => a + (b.towers?.length ?? 0), 0) / core.length : 0;
  return out;
}

/** The evokes law: an evocation's measures beside the metro to scale's. */
export function evokesLaw(d, ref) {
  const a = measuresOf(d), b = measuresOf(ref), T = EVOKE_TOLERANCE, off = [];
  for (const k of Object.keys(b.mix)) {
    if (!a.mix[k]) { off.push(`no ${k}`); continue; }
    const kinds = new Set([...Object.keys(a.mix[k]), ...Object.keys(b.mix[k])]), tv = [...kinds].reduce((s, x) => s + Math.abs((a.mix[k][x] ?? 0) - (b.mix[k][x] ?? 0)), 0) / 2;
    if (tv > T.mix) off.push(`${k}'s mix ${r2(tv)} apart`);
    const ratio = a.storeys[k] / b.storeys[k];
    if (ratio < T.storeys[0] || ratio > T.storeys[1]) off.push(`${k}'s storeys ×${r2(ratio)}`);
  }
  if (Math.abs(a.green - b.green) > T.green) off.push(`green ${r2(a.green * 100)}% for ${r2(b.green * 100)}%`);
  const tr = b.towers ? a.towers / b.towers : 1;
  if (b.towers && (tr < T.towers[0] || tr > T.towers[1])) off.push(`towers ×${r2(tr)}`);
  return { law: 'evokes', ok: !off.length, value: off.length ? off.join('; ') : `rings ${Object.keys(a.mix).join(', ')}, green ${r2(a.green * 100)}% for ${r2(b.green * 100)}%, ${r2(a.towers)} towers a core block for ${r2(b.towers)}`, want: 'the metro to scale\'s' };
}

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
  const stray = built.filter((r) => r.parkRect && !within(r.parkRect.rect, r.rect));
  out.push({ law: 'parks', ok: !stray.length && placed >= 0.9 * want - 1, value: `${built.filter((r) => r.parkRect).length} parks, ${Math.round(placed / 1e4)} of ${Math.round(want / 1e4)} ha asked${stray.length ? `; ${stray.map((r) => r.id).join(', ')} astray` : ''}`, want: '≥ 90%, inside' });
  if (!d.regions.every((r) => r.blocks)) return out;
  // the blocks: each neighbourhood's ground once, each block's surfaces its area
  const open_ = d.regions.filter((r) => r.ledger.streets < -1 || Math.abs(r.ledger.streets + r.ledger.blocks + r.ledger.park - r.area) > 1
    || r.blocks.some((b) => Math.abs(Object.values(b.surfaces).reduce((a, v) => a + v, 0) - b.area) > 0.01));
  const all = d.regions.flatMap((r) => r.blocks), lots = all.filter((b) => b.kind !== 'park');
  out.push({ law: 'blocks', ok: !open_.length, value: open_.length ? open_.map((r) => r.id).join(', ') : `${lots.length} blocks, ${Math.round(L.streets / 1e4)} ha of their streets`, want: 'each neighbourhood' });
  const G = d.grammar, TP = d.spec.pattern;
  const rail = (ring) => (ring === 'outskirts' ? [[2 * TP.block.depth[0], 2 * TP.block.depth[1]], TP.block.long] : [G.block.pitch, G.block.pitch]);
  const offPitch = lots.filter((b) => { const [rx, ry] = rail(b.ring), w = b.rect[2] - b.rect[0], h = b.rect[3] - b.rect[1]; return w < 0.5 * rx[0] || w > 1.5 * rx[1] || h < 0.5 * ry[0] || h > 1.5 * ry[1]; });
  out.push({ law: 'pitch', ok: offPitch.length <= 0.1 * lots.length, value: `${offPitch.length} of ${lots.length} off their ring's length`, want: '≤ 10%' });
  const OF = { core: ['tower', 'podium', 'square'], frame: ['midrise', 'slab'], outskirts: ['houses', 'main-street', 'edge', 'lowrise', 'apartments', 'school'] };
  const wrong = lots.filter((b) => !OF[b.ring].includes(b.kind));
  const civicLess = built.filter((r) => r.builds !== 'frame' && r.blocks.filter((b) => b.kind !== 'park').length >= M.streets.civic && !r.blocks.some((b) => b.kind === 'square' || b.kind === 'school'));
  out.push({ law: 'segments', ok: !wrong.length && civicLess.length <= Math.ceil(0.2 * built.length), value: `${Object.entries(lots.reduce((m, b) => ({ ...m, [b.kind]: (m[b.kind] ?? 0) + 1 }), {})).map(([k, n]) => `${k} ${n}`).join(', ')}${wrong.length ? `; ${wrong.length} off their ring` : ''}${civicLess.length ? `; no civic block in ${civicLess.map((r) => r.id).join(', ')}` : ''}`, want: 'each its ring\'s' });
  const short = built.filter((r) => r.soft < 0.9 * r.green);
  out.push({ law: 'soft', ok: short.length <= Math.ceil(0.2 * built.length), value: `${Math.round(L.green.soft / 1e4)} ha green ground${short.length ? `; ${short.length} short of their quota (${short.slice(0, 5).map((r) => r.id).join(', ')}${short.length > 5 ? '…' : ''})` : ''}`, want: '≥ 90% each, most of them' });
  const towers = lots.flatMap((b) => (b.towers ?? []).map((t) => ({ ...t, b })));
  const badT = towers.filter((t) => t.storeys <= t.b.podium || t.storeys > t.b.storeys.rail[1]);
  const tallest = (k) => Math.max(0, ...lots.filter((b) => b.ring === k).map((b) => Math.max(b.storeys.median, ...(b.towers ?? []).map((t) => t.storeys))));
  out.push({ law: 'towers', ok: !badT.length && tallest('core') >= tallest('frame'), value: `${towers.length} towers, the tallest ${tallest('core')} storeys${badT.length ? `; ${badT.length} off their rail` : ''}`, want: 'past their podiums, inside their rail' });
  return out;
}
