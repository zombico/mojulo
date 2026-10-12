/**
 * TRAFFIC: the city's streets as the lanes its cars drive and the junctions that signal them, for the shared traffic
 * model (scene/channels/traffic-model.js: stop lines, exclusive phases, following gaps, no two cars ever touching),
 * which the world path runs with its measured car bank (worlds/world-kinds.js attachCityCars).
 *
 *   cars: true | false                    on (the default) drives every straight street; false leaves them empty
 *
 * A street wide enough for two cars abreast carries a lane each way, on the grammar's side (`traffic`); a narrower
 * one carries one lane, its direction alternating street by street along each axis (a one-way grid). Every place two
 * streets meet is a junction, its box as wide as the crossing carriageways. A street that runs on a slant (a spine
 * cut across the grid) carries no cars: the model drives straight lanes.
 *
 * Pure and dice-free: a function of the streets the plan laid. Everything here is in the world's units.
 */
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
// two lanes need the widest car and its margins between their lines (traffic-model pairLanes), in metres, with room
const TWO_WAY = 7.5;

/** A recipe's `cars`, checked. */
export function readCars(v) {
  if (v === undefined) return true;
  if (typeof v !== 'boolean') throw new Error('city: cars is true (the streets driven, the default) or false (empty streets)');
  return v;
}

/**
 * The lanes and junctions of a designed city, in units, within `crop` (metres; the whole frame when absent):
 * { carLanes: [{ axis, cross, lo, hi, dir, oneWay? }], junctions: [{ x, y, wx, wy, streetW }] }.
 */
export function cityTraffic(d, crop = null) {
  const side = d.grammar.traffic === 'left' ? -1 : 1;
  const C = crop || { x0: 0, y0: 0, x1: d.frame.W, y1: d.frame.D };
  // straight runs: along y (a street at fixed x) and along x (at fixed y)
  const runs = [];
  for (const s of d.streets) for (let k = 1; k < s.pts.length; k++) {
    const a = s.pts[k - 1], b = s.pts[k];
    if (Math.abs(a[0] - b[0]) < 1e-6) runs.push({ id: s.id, axis: 'y', cross: a[0], lo: Math.min(a[1], b[1]), hi: Math.max(a[1], b[1]), road: s.road });
    else if (Math.abs(a[1] - b[1]) < 1e-6) runs.push({ id: s.id, axis: 'x', cross: a[1], lo: Math.min(a[0], b[0]), hi: Math.max(a[0], b[0]), road: s.road });
  }
  const within = (r) => (r.axis === 'x' ? r.cross >= C.y0 && r.cross <= C.y1 && r.hi > C.x0 && r.lo < C.x1 : r.cross >= C.x0 && r.cross <= C.x1 && r.hi > C.y0 && r.lo < C.y1);
  const kept = runs.filter(within).map((r) => {
    const [a, b] = r.axis === 'x' ? [C.x0, C.x1] : [C.y0, C.y1];
    return { ...r, lo: Math.max(r.lo, a), hi: Math.min(r.hi, b) };
  }).filter((r) => r.hi - r.lo > 20);
  kept.sort((p, q) => (p.axis < q.axis ? -1 : p.axis > q.axis ? 1 : p.cross - q.cross || p.lo - q.lo));
  // junctions: a run along x meeting a run along y, the box as wide as each carriageway
  const junctions = [], seen = new Set();
  for (const h of kept.filter((r) => r.axis === 'x')) for (const v of kept.filter((r) => r.axis === 'y')) {
    const ex = v.road / 2, ey = h.road / 2;
    if (v.cross < h.lo - ex || v.cross > h.hi + ex || h.cross < v.lo - ey || h.cross > v.hi + ey) continue;
    const key = `${r3(v.cross)},${r3(h.cross)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const wx = r3(v.road / U), wy = r3(h.road / U);
    junctions.push({ x: r3(v.cross / U), y: r3(h.cross / U), wx, wy, streetW: Math.max(wx, wy) });
  }
  // lanes: two each way on a wide road, the right-hand one first; a narrow road one-way, alternating along its axis
  const carLanes = [], oneWays = { x: 0, y: 0 };
  for (const r of kept) {
    const lo = r3(r.lo / U), hi = r3(r.hi / U), c = r.cross;
    if (r.road >= TWO_WAY) {
      const off = r.road / 4;
      // along x, +x drives on the low-y side (right-hand); along y, +y on the high-x side
      const plus = r.axis === 'x' ? c - off * side : c + off * side, minus = r.axis === 'x' ? c + off * side : c - off * side;
      carLanes.push({ axis: r.axis, cross: r3(plus / U), lo, hi, dir: 1 }, { axis: r.axis, cross: r3(minus / U), lo, hi, dir: -1 });
    } else carLanes.push({ axis: r.axis, cross: r3(c / U), lo, hi, dir: oneWays[r.axis]++ % 2 ? -1 : 1, oneWay: true });
  }
  return { carLanes, junctions };
}
