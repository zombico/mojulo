/**
 * WHAT A COURSE'S THINGS ARE — the shapes a theme's premise gives a rolled course's asks, their tells and its end
 * (course-dress.js DRESS_THEMES: a theme with a premise names a thing for each; one with none stands plain boxes and
 * paints plain marks). A shape here is DRAWING over the thing the course was measured with: the ask's box is still
 * the box that is met, the tell still lies exactly where the course was sized, and every colour is a role's.
 *
 *   ASKS    barrier   a striped crossing barrier across the whole way (a hurdle)
 *           crates    a row of crates left across the line (a block)
 *           wagon     two stabled wagons end-on, one on each of the tracks the posts close; the open lane the clear track
 *   TELLS   hatching  a jump's window as hazard hatching between two lines (the window itself, as before)
 *           indicator posts' arrows on the sleepers, and a lit indicator on each kerb pointing at the clear track
 *   END     terminus  a signal gantry over the exit showing clear on every track, buffer stops, and the train waiting
 *
 *   askDrawing(thing, box, palette)                  → [{ corners, fill }]   drawn with the ask (its roll group)
 *   jumpTell(tell, { ya, yb, half }, palette)        → [{ corners, fill }]
 *   steerTell(tell, { ys, to, lanes, half }, palette) → [{ corners, fill }]  (ys: where a two-lane change begins, and half way)
 *   endDrawing(end, { exit, length, half, lanes }, palette) → [{ corners, fill }]
 *   box: { x0, x1, y0, y1, h }
 *
 * Pure: no dice.
 */
import { hexToRgb, rgbToHex } from '../color-theorist/oklab.js';

const shade = (hex, k) => rgbToHex(hexToRgb(hex).map((v) => v * k));
const E = 0.012;   // paint stands this far off the face it is on
// a quad on a plane across the way (facing the start) and one lying flat
const face = (x0, x1, y, z0, z1, fill) => ({ corners: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill });
const flat = (x0, y0, x1, y1, z, fill) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill });
const side = (x, y0, y1, z0, z1, fill) => ({ corners: [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], fill });
/** A box drawn whole: toward the start, both sides, the top. */
export const solid = (x0, x1, y0, y1, z0, z1, fill) => [face(x0, x1, y0, z0, z1, fill), side(x0, y0, y1, z0, z1, shade(fill, 0.82)), side(x1, y0, y1, z0, z1, shade(fill, 0.82)), flat(x0, y0, x1, y1, z1, shade(fill, 1.1))];

export const ASK_THINGS = Object.freeze({ barrier: 'jump', crates: 'jump', wagon: 'steer' });

export function askDrawing(thing, { x0, x1, y0, y1, h }, col) {
  const out = [], f = y0 - E;
  if (thing === 'barrier') {
    // stripes down its face and across its top, and a foot at each end and between the tracks
    const n = 11, w = (x1 - x0) / n;
    for (let i = 1; i < n; i += 2) { out.push(face(x0 + i * w, x0 + (i + 1) * w, f, 0.18, h, col['tell-jump'])); out.push(flat(x0 + i * w, y0, x0 + (i + 1) * w, y1, h + E, col['tell-jump'])); }
    out.push(face(x0, x1, f - E, 0, 0.18, col.iron));
  } else if (thing === 'crates') {
    // five crates side by side: the gaps between them, a batten round each, a stencilled mark
    const n = 5, w = (x1 - x0) / n, dark = shade(col.jump2, 0.55);
    for (let i = 0; i <= n; i++) { const x = Math.min(x1 - 0.05, Math.max(x0, x0 + i * w - 0.025)); out.push(face(x, x + 0.05, f, 0, h, col.iron)); out.push(flat(x, y0, x + 0.05, y1, h + E, col.iron)); }
    for (let i = 0; i < n; i++) { const a = x0 + i * w + 0.12, b = x0 + (i + 1) * w - 0.12; out.push(face(a, b, f, 0.1, 0.18, dark), face(a, b, f, h - 0.18, h - 0.1, dark), face(a + (b - a) * 0.38, a + (b - a) * 0.62, f, h * 0.4, h * 0.62, col['tell-jump'])); }
  } else if (thing === 'wagon') {
    // two wagons end-on, one a track: the gap between them, underframes and buffers, an end door, a roof, lamps
    const mid = (x0 + x1) / 2, deep = shade(col.steer, 0.62), roof = shade(col.steer, 0.5);
    out.push(face(mid - 0.11, mid + 0.11, f, 0, h, col.iron), flat(mid - 0.11, y0, mid + 0.11, y1, h + E, col.iron));
    for (const [a, b] of [[x0, mid - 0.11], [mid + 0.11, x1]]) {
      const c = (a + b) / 2;
      out.push(face(a, b, f, 0, 0.62, col.iron));
      out.push(face(a + 0.14, a + 0.44, f - E, 0.72, 1.0, col.trim), face(b - 0.44, b - 0.14, f - E, 0.72, 1.0, col.trim));
      out.push(face(c - 0.42, c + 0.42, f, 0.78, h - 0.5, deep), face(c - 0.03, c + 0.03, f - E, 0.78, h - 0.5, col.iron));
      out.push(face(a, b, f, h - 0.26, h, roof), flat(a, y0, b, y1, h + E, roof));
      out.push(face(c - 0.12, c + 0.12, f - E, h - 0.5, h - 0.3, col.lamp));
    }
    for (const x of [x0 - E, x1 + E]) out.push(side(x, y0, y1, 0, 0.62, col.iron), side(x, y0, y1, h - 0.26, h, roof));
  }
  return out;
}

export function jumpTell(tell, { ya, yb, half }, col) {
  if (tell !== 'hatching') return [flat(-half, ya, half, yb, 0.02, col['tell-jump'])];
  // the window's two edges as lines, and slanted bars between them
  const out = [flat(-half, ya, half, ya + 0.14, 0.02, col['tell-jump']), flat(-half, yb - 0.14, half, yb, 0.02, col['tell-jump'])], lean = Math.min(1.2, (yb - ya) * 0.5), cl = (x) => Math.max(-half, Math.min(half, x));
  for (let x = -half - lean; x < half; x += 1.1) out.push({ corners: [[cl(x), ya + 0.14, 0.02], [cl(x + 0.5), ya + 0.14, 0.02], [cl(x + 0.5 + lean), yb - 0.14, 0.02], [cl(x + lean), yb - 0.14, 0.02]], fill: col['tell-jump'] });
  return out.filter((q) => Math.abs(q.corners[0][0] - q.corners[1][0]) > 0.05 || Math.abs(q.corners[2][0] - q.corners[3][0]) > 0.05);
}

export function steerTell(tell, { ys, to, lanes, half }, col) {
  const out = [];
  // (an arrow on the sleepers of each closed lane: a shaft and a head, pointing across the way at the open one)
  for (const lane of lanes) for (const ay of ys) {
    out.push(to > 0 ? flat(lane - 0.55, ay - 0.16, lane + 0.25, ay + 0.16, 0.02, col['tell-steer']) : flat(lane - 0.25, ay - 0.16, lane + 0.55, ay + 0.16, 0.02, col['tell-steer']));
    out.push({ corners: [[lane + to * 0.25, ay - 0.5, 0.02], [lane + to * 0.85, ay, 0.02], [lane + to * 0.25, ay + 0.5, 0.02]], fill: col['tell-steer'] });
  }
  if (tell !== 'indicator') return out;
  // a lit indicator on each kerb where the change must begin: a post, a head, an arrow at the clear track
  for (const k of [-1, 1]) {
    const x = k * (half + 0.55), y = ys[0];
    out.push(...solid(x - 0.07, x + 0.07, y, y + 0.14, 1, 2.5, col.iron), face(x - 0.55, x + 0.55, y - E, 2.5, 3.3, col.iron));
    out.push({ corners: [[x - to * 0.36, y - 2 * E, 2.66], [x + to * 0.4, y - 2 * E, 2.9], [x - to * 0.36, y - 2 * E, 3.14]], fill: col['tell-steer'] });
  }
  return out;
}

export function endDrawing(end, { exit, length, half, lanes }, col) {
  if (end !== 'terminus') return [];
  const out = [], y = exit[1], g = half + 0.7;
  // the gantry over the exit: a column on each kerb, a beam, a signal showing clear over every track
  for (const k of [-1, 1]) out.push(...solid(k * g - 0.16, k * g + 0.16, y, y + 0.32, 1, 6.3, col.iron));
  out.push(...solid(-g, g, y, y + 0.32, 5.7, 6.3, col.iron));
  for (const lane of lanes) out.push(face(lane - 0.34, lane + 0.34, y - E, 4.7, 5.7, col.iron), face(lane - 0.17, lane + 0.17, y - 2 * E, 4.86, 5.2, col.exit));
  // the buffer stops at the end of each outer track, and the train on the middle one, its doors open and lit
  for (const lane of lanes.filter((l) => l !== 0)) out.push(...solid(lane - 0.8, lane + 0.8, length + 2.6, length + 3, 0, 1.1, col.iron), face(lane - 0.8, lane + 0.8, length + 2.6 - E, 0.62, 0.92, col.trim));
  const t0 = length + 5.2, body = shade(col.flank2, 1.25);
  out.push(...solid(-1.45, 1.45, t0, t0 + 14, 0.55, 3.7, body), face(-1.45, 1.45, t0 - E, 0, 0.55, col.iron));
  out.push(face(-0.5, 0.5, t0 - E, 0.75, 2.9, col.lamp), face(-1.2, -0.75, t0 - E, 1.9, 2.9, col.lamp), face(0.75, 1.2, t0 - E, 1.9, 2.9, col.lamp));
  out.push(face(-1.25, -0.95, t0 - 2 * E, 0.95, 1.2, col.exit), face(0.95, 1.25, t0 - 2 * E, 0.95, 1.2, col.exit));
  return out;
}
