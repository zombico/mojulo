/**
 * THE MAP'S LIGHTS AT NIGHT — what a pilot finds the ground by after dark (the page's night-lights channel,
 * scene/channels/night-lights.js), from the dusk on (sky.js `night` past NIGHT_FROM):
 *
 *   runway     each runway's edge lights (white, every EDGE m down both sides), its thresholds (a green bar across each
 *              end) and its approach (a white bar every APPROACH m out from each end, APPROACH_BARS of them); a pad's
 *              edge (green, round it)
 *   taxiway    its edges blue (every TAXI_LIGHTS.edge m down both sides of the parallel and of each connector), each
 *              connector's centre line green, leading on and off the runway
 *   PAPI       at each runway end, beside its touchdown aim (RUNWAY_AIM m past the threshold) on the left as it is
 *              landed on, four lamps in a row out from the edge: each white seen from above its angle and red from
 *              under it (PAPI.angles, the inner one the steepest), so on the 3° path two show white and two red; too
 *              high all white, too low all red. Lit by day too (a real one is); the page colours each by the eye's
 *              elevation from it, and only toward its approach
 *   beacons    the obstructions lit red and flashing: the country's mast and every building taller than BEACON_H m,
 *              each at its top
 *   traffic    the cars on the roads: each country road but a lane, each settlement's arterials, each metro highway's
 *              deck; their paths with the ground's (or the deck's) height under them, and how many cars a kilometre
 *
 *   nightLightsConfig(field) → { points: base64 Float32 [x, y, z, r, g, b, size, blink]…, n, traffic: [{ pts, lanes,
 *     perKm }] } | null (a map with nothing to light); blink 1 a beacon, 2 a PAPI lamp (its r, g, b its angle and facing)
 *   papiOf(pad) → [[x, y, z, angle, facing x, facing y]…]
 *
 * Metres, linear colours. Pure.
 */
import { SKINS } from './country.js';

export const NIGHT_FROM = 0.15;
export const RUNWAY_LIGHTS = Object.freeze({ edge: 60, approach: 60, bars: 5, size: 2.6 });
/** The touchdown aim past a runway's threshold (m): where the PAPI stands and a student aims (lesson-pilot.js). */
export const RUNWAY_AIM = 150;
/** The PAPI: its lamps' transition angles (degrees, the one nearest the runway first), their spacing (m), the first's
 *  distance from the runway's edge (m), their size. */
export const PAPI = Object.freeze({ angles: [3.5, 3.17, 2.83, 2.5], spacing: 9, edge: 15, size: 4.5 });
export const TAXI_LIGHTS = Object.freeze({ edge: 30, centre: 15, size: 1.8 });
export const BEACON_H = 45;
const r2 = (v) => Math.round(v * 100) / 100;
const WHITE = [1.6, 1.5, 1.25], GREEN = [0.2, 1.4, 0.45], RED = [1.6, 0.12, 0.06], BLUE = [0.15, 0.35, 1.7];

/** Each runway's PAPI: for each end, its four lamps [x, y, z, angle, facing x, facing y] (facing: toward its approach). */
export function papiOf(p) {
  if (p.kind !== 'runway') return [];
  const ax = p.along === 'x', d = ax ? [1, 0] : [0, 1], half = p.length / 2, out = [];
  for (const sg of [1, -1]) {
    // landed on along sg·d: its threshold at the end it comes from; its left, the side to the left of that heading
    const dir = [d[0] * sg, d[1] * sg], left = [-dir[1], dir[0]], at = [p.center[0] - dir[0] * (half - RUNWAY_AIM), p.center[1] - dir[1] * (half - RUNWAY_AIM)];
    PAPI.angles.forEach((a, k) => { const o = p.width / 2 + PAPI.edge + k * PAPI.spacing; out.push([r2(at[0] + left[0] * o), r2(at[1] + left[1] * o), r2(p.datum + 0.8), a, -dir[0], -dir[1]]); });
  }
  return out;
}

/** The lights of a map's ground: by day a runway's PAPI alone; from the dusk on every light; or null (nothing to light). */
export function nightLightsConfig(field) {
  const S = field.sky; if (!S) return null;
  const pts = [], put = (x, y, z, c, size, blink = 0) => pts.push(r2(x), r2(y), r2(z), c[0], c[1], c[2], size, blink);
  // (a PAPI lamp: its angle and its facing in the colour's place, a blink of 2 saying so: the page colours it)
  for (const p of field.pads || []) for (const [x, y, z, a, fx, fy] of papiOf(p)) put(x, y, z, [a, fx, fy], PAPI.size, 2);
  if (S.night < NIGHT_FROM) return pts.length ? { points: Buffer.from(new Float32Array(pts).buffer).toString('base64'), n: pts.length / 8, traffic: [], night: S.night } : null;
  const L = RUNWAY_LIGHTS;
  for (const p of field.pads || []) {
    // its taxiway: the edges blue, a connector's centre line green
    for (const { rect: q, axis } of p.taxiway?.rects ?? []) {
      const [a0, a1, b0, b1] = axis === 'x' ? [q[0], q[2], q[1], q[3]] : [q[1], q[3], q[0], q[2]], at = (a, b) => (axis === 'x' ? [a, b] : [b, a]), conn = (a1 - a0) < 200;   // (a connector: short, across the strip)
      for (let a = a0; a <= a1 + 1e-6; a += TAXI_LIGHTS.edge) for (const b of [b0, b1]) put(...at(a, b), p.datum + 0.3, BLUE, TAXI_LIGHTS.size);
      if (conn) for (let a = a0; a <= a1 + 1e-6; a += TAXI_LIGHTS.centre) put(...at(a, (b0 + b1) / 2), p.datum + 0.3, GREEN, TAXI_LIGHTS.size);
    }
    const z = p.datum + 0.4;
    if (p.kind !== 'runway') { for (const [x, y] of [[p.x0, p.y0], [p.x1, p.y0], [p.x1, p.y1], [p.x0, p.y1]]) put(x, y, z, GREEN, L.size); continue; }
    // along its axis a, across it b; its two ends
    const ax = p.along === 'x', [a0, a1] = ax ? [p.x0, p.x1] : [p.y0, p.y1], [b0, b1] = ax ? [p.y0, p.y1] : [p.x0, p.x1], at = (a, b) => (ax ? [a, b] : [b, a]);
    for (let a = a0; a <= a1 + 1e-6; a += L.edge) for (const b of [b0 - 1, b1 + 1]) put(...at(a, b), z, WHITE, L.size);
    for (const end of [a0, a1]) {
      for (let b = b0; b <= b1 + 1e-6; b += 3) put(...at(end, b), z, GREEN, L.size);
      const out = end === a0 ? -1 : 1;
      for (let k = 1; k <= L.bars; k++) for (let b = -6; b <= 6; b += 3) put(...at(end + out * k * L.approach, (b0 + b1) / 2 + b), z, WHITE, L.size * 1.2);
    }
  }
  // the obstructions: the mast's tip, every tall building's top (red, flashing)
  const A = field.aerial;
  if (A) {
    for (const [x, y, z, h] of A.masts || []) put(x, y, z + h + 1, RED, 5, 1);
    for (const b of A.boxes) if (b[5] > BEACON_H && b[8] !== SKINS.plain) put(b[0], b[1], b[2] + b[5] + 1, RED, 4, 1);
  }
  // the traffic: the country's roads but its lanes, each settlement's arterials, each metro highway's deck
  const traffic = [];
  if (field.country) {
    for (const r of field.country.roads) if (r.rank !== 'lane') traffic.push({ pts: r.pts.flatMap(([x, y]) => [x, y, r2(field.groundAt(x, y) + 0.8)]), lanes: r.rank === 'highway' ? 2 : 1, perKm: r.rank === 'highway' ? 22 : 8 });
    for (const st of field.country.settlements) {
      const o = st.origin, d = st.d, L0 = d.land.rect;
      for (const l of d.lines) {
        const pts = [], [lo, hi] = l.axis === 'ns' ? [L0[1], L0[3]] : [L0[0], L0[2]];
        for (let u = lo; u <= hi + 1e-6; u += Math.max(40, (hi - lo) / 40)) { const [x, y] = l.axis === 'ns' ? [o[0] + l.at, o[1] + u] : [o[0] + u, o[1] + l.at]; pts.push(r2(x), r2(y), r2(field.groundAt(x, y) + 0.8)); }
        traffic.push({ pts, lanes: Math.max(1, Math.round((l.road ?? 14) / 7)), perKm: st.kind === 'metro' ? 26 : st.kind === 'town' ? 12 : 5 });
      }
      for (const h of d.highways || []) {
        const s = h.stations, pts = [];
        for (let k = 0; k + 1 < s.length; k += 4) { const [x, y] = h.axis === 'x' ? [o[0] + s[k], o[1] + h.at] : [o[0] + h.at, o[1] + s[k]]; pts.push(r2(x), r2(y), r2(s[k + 1] + 0.8)); }
        traffic.push({ pts, lanes: h.lanes ?? 3, perKm: 40 });
      }
    }
  }
  if (!pts.length && !traffic.length) return null;
  const F = new Float32Array(pts);
  return { points: Buffer.from(F.buffer).toString('base64'), n: pts.length / 8, traffic, night: S.night };
}
