/**
 * THE GEOCITY'S ROADS — each arterial's cross-section, laid band by band from its centre out, and the lanes a driver (a
 * Quest Open World's car, city hunter's) reads off it. A major street is four lanes, two each way; some carry a SPACER
 * between their directions (a planted median), most do not; a PAIR of one-way streets by the core carries three lanes
 * the same way each, the pair's two opposite (a Richmond and an Adelaide); STREETCAR rails run in some (a Queen, a
 * King), in the inner lanes, or down the spacer in their own right-of-way where the street has one (a Spadina).
 *
 *   card `roads`: { lane, parking, bike, lanes, median: { share, w }, oneway: { pairs, lanes },
 *                   streetcar: { spine, share, gauge, row } }
 *     lane, parking, bike   metres a travel lane, a parking lane and a bike lane are wide (never compressed: a car is a
 *                           car at game scale)
 *     lanes                 a two-way major street's travel lanes, half each way
 *     median                the share of two-way arterials with a spacer between their directions, and its width
 *     oneway                one-way pairs by the core (the nearest parallel arterials either side of nothing but each
 *                           other, off the spine), each `lanes` the same way, a bike lane on one side
 *     streetcar             rails on the spines (`spine`) and on a share of the other two-way arterials; `gauge` the
 *                           track's (Toronto's broad gauge), `row` the right-of-way a spacer takes when it carries them
 *
 *   roadKinds(lines, M, seed, seat) → { <line id>: { oneway: 0 | 1 | -1, median, streetcar } }
 *   layoutOf(kind, axis, R, traffic) → { road, bands: [{ kind, from, to, dir?, streetcar? }], tracks: [{ at, dir }] }
 *       offsets across the line from its centre (negative: its west side, or its south); `dir` +1 along its axis (north
 *       for a north-south line, east for an east-west one), −1 against; traffic 'right' or 'left' (the grammar's)
 *
 * Pure: a line's dice are its own (`${seed}|roads-v1|<line id>`).
 */
import { streamOf } from '../city/plan/dice.js';

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;

/** Which arterials are one-way pairs, which carry a spacer, which carry streetcars. */
export function roadKinds(lines, M, seed, seat) {
  const R = M.roads, out = Object.fromEntries(lines.map((l) => [l.id, { oneway: 0, median: false, streetcar: false }]));
  // the one-way pairs: east-west first (a downtown's), the two nearest parallel arterials off the spine on one side of it
  let pairs = R.oneway.pairs;
  for (const axis of ['ew', 'ns']) {
    const s = axis === 'ns' ? seat[0] : seat[1], side = lines.filter((l) => l.axis === axis && l.rank !== 'spine').sort((a, b) => Math.abs(a.at - s) - Math.abs(b.at - s));
    const used = new Set();
    for (let k = 0; pairs > 0 && k < side.length; k++) {
      const a = side[k], b = side.find((x, j) => j > k && !used.has(x.id) && Math.sign(x.at - s) === Math.sign(a.at - s));
      if (used.has(a.id) || !b) continue;
      const first = streamOf(seed, 'roads', `oneway:${a.id}`)() < 0.5 ? 1 : -1;
      out[a.id].oneway = first; out[b.id].oneway = -first;
      used.add(a.id); used.add(b.id); pairs--;
    }
  }
  for (const l of lines) {
    const K = out[l.id];
    if (K.oneway) continue;
    const Rl = streamOf(seed, 'roads', l.id);
    K.median = Rl() < R.median.share;
    K.streetcar = l.rank === 'spine' ? R.streetcar.spine : Rl() < R.streetcar.share;
  }
  return out;
}

/** A line's bands from its centre out, and its tracks. */
export function layoutOf(kind, axis, R, traffic = 'right') {
  const bands = [], tracks = [], hand = traffic === 'left' ? -1 : 1;
  // the way a side's traffic runs: on the right, a north-south line's east side runs north, an east-west line's south
  // side runs east
  const dirOf = (side) => hand * (axis === 'ns' ? side : -side);
  if (kind.oneway) {
    // parking, the lanes the same way, a bike lane, parking: centred on the line
    const d = kind.oneway, w = 2 * R.parking + R.oneway.lanes * R.lane + R.bike;
    let x = -w / 2;
    const band = (k, width, extra = {}) => { bands.push({ kind: k, from: r3(x), to: r3(x + width), ...extra }); x += width; };
    band('parking', R.parking);
    for (let i = 0; i < R.oneway.lanes; i++) band('travel', R.lane, { dir: d });
    band('bike', R.bike, { dir: d });
    band('parking', R.parking);
    return { road: r3(w), bands, tracks };
  }
  // the spacer: a planted median, or the streetcars' own right-of-way down the middle
  const row = kind.median && kind.streetcar, mid = row ? R.streetcar.row : kind.median ? R.median.w : 0;
  if (mid) bands.push({ kind: row ? 'streetcar-row' : 'median', from: r3(-mid / 2), to: r3(mid / 2) });
  if (row) for (const side of [-1, 1]) tracks.push({ at: r3(side * mid / 4), dir: dirOf(side) });
  for (const side of [-1, 1]) {
    let x = mid / 2;
    const band = (k, width, extra = {}) => { const a = side * x, b = side * (x + width); bands.push({ kind: k, from: r3(Math.min(a, b)), to: r3(Math.max(a, b)), ...extra }); x += width; };
    for (let i = 0; i < R.lanes / 2; i++) {
      const sc = kind.streetcar && !row && i === 0;
      band('travel', R.lane, { dir: dirOf(side), ...(sc ? { streetcar: true } : {}) });
      if (sc) tracks.push({ at: r3(side * (x - R.lane / 2)), dir: dirOf(side) });
    }
    band('parking', R.parking);
  }
  bands.sort((a, b) => a.from - b.from);
  const road = bands[bands.length - 1].to - bands[0].from;
  return { road: r3(road), bands, tracks };
}
