/**
 * THE MAP'S LIGHTS AT NIGHT — what a pilot finds the ground by after dark (the page's night-lights channel,
 * scene/channels/night-lights.js), from the dusk on (sky.js `night` past NIGHT_FROM):
 *
 *   runway     each runway's edge lights (white, every EDGE m down both sides), its thresholds (a green bar across each
 *              end) and its approach (a white bar every APPROACH m out from each end, APPROACH_BARS of them); a pad's
 *              edge (green, round it)
 *   beacons    the obstructions lit red and flashing: the country's mast and every building taller than BEACON_H m,
 *              each at its top
 *   traffic    the cars on the roads: each country road but a lane, each settlement's arterials, each metro highway's
 *              deck; their paths with the ground's (or the deck's) height under them, and how many cars a kilometre
 *
 *   nightLightsConfig(field) → { points: base64 Float32 [x, y, z, r, g, b, size, blink]…, n, traffic: [{ pts, lanes,
 *     perKm }] } | null (the day's, or a map with nothing to light)
 *
 * Metres, linear colours. Pure.
 */
import { SKINS } from './country.js';

export const NIGHT_FROM = 0.15;
export const RUNWAY_LIGHTS = Object.freeze({ edge: 60, approach: 60, bars: 5, size: 2.6 });
export const BEACON_H = 45;
const r2 = (v) => Math.round(v * 100) / 100;
const WHITE = [1.6, 1.5, 1.25], GREEN = [0.2, 1.4, 0.45], RED = [1.6, 0.12, 0.06];

/** The lights of a map's ground at night, or null. */
export function nightLightsConfig(field) {
  const S = field.sky; if (!S || S.night < NIGHT_FROM) return null;
  const pts = [], put = (x, y, z, c, size, blink = 0) => pts.push(r2(x), r2(y), r2(z), c[0], c[1], c[2], size, blink);
  const L = RUNWAY_LIGHTS;
  for (const p of field.pads || []) {
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
