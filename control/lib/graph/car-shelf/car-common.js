/**
 * car-common — what the car shelf's builders share: the colours its trim is drawn in, and a form face made from its
 * corners (its normal its own, turned the way it faces; its corners rounded so neighbours share them exactly).
 *
 *   CAR_HEX                                    the trim's colours (no light in them: the page lights them)
 *   face(corners, part, material, albedo, toward) → a form face, or null when it has no area
 *   FLARE                                      how far a flare stands proud of the side (m)
 *
 * Pure.
 */
export const CAR_HEX = Object.freeze({
  glass: '#1e2630', rubber: '#141518', plastic: '#1f2226', chrome: '#d4d7da', steel: '#3a3e43', lamp: '#e9edf0', tail: '#9a1a17',
  amber: '#ff9a1f', smoke: '#2b3036', interior: '#2a2724', seat: '#3b352f', fabric: '#1c1d20', alloy: '#c3c7cb', seal: '#141518',
});

/** How far a flare round an arch stands proud of the side (m): the parts draw it, the body makes room for it. */
export const FLARE = 0.028;

const unit = (v) => { const d = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / d, v[1] / d, v[2] / d]; };
function newell(c) {
  const n = [0, 0, 0];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return n;
}
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
/** A form face, its normal its own (Newell's) turned toward `toward`; null when it has no area. Corners rounded to the
 *  hundredth of a millimetre, so neighbours share their corners exactly (the glasshouse reads shared edges). */
export function face(corners, part, material, albedo, toward) {
  const c0 = corners.map((p) => p.map(r5)), c = c0.filter((p, i) => { const q = c0[(i + 1) % c0.length]; return p[0] !== q[0] || p[1] !== q[1] || p[2] !== q[2]; });
  if (c.length < 3) return null;
  const n0 = newell(c);
  if (Math.hypot(n0[0], n0[1], n0[2]) < 1e-7) return null;
  let n = unit(n0), cs = c;
  if (n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2] < 0) { n = n.map((v) => -v + 0); cs = c.slice().reverse(); }
  return { corners: cs, part, material, albedo, outNormal: n };
}

