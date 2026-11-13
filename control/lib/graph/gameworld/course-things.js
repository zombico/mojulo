/**
 * WHAT A COURSE'S THINGS ARE — the shapes a theme's premise gives a rolled course's asks, their tells and its end
 * (course-dress.js DRESS_THEMES: a theme with a premise names a thing for each; one with none stands plain boxes and
 * paints plain marks). A shape here is the thing DRAWN WHOLE inside the box the course was measured with (the box
 * itself is met and not drawn): the ask's box is still the box that is met, the tell still lies exactly where the course was sized, and every colour is a role's.
 *
 *   ASKS    barrier   a striped crossing barrier across the whole way (a hurdle)
 *           crates    a row of crates left across the line (a block)
 *           wagon     two stabled wagons end-on, one on each of the tracks the posts close; the open lane the clear track
 *   TELLS   hatching  a jump's window as hazard hatching between two lines (the window itself, as before)
 *           edges     a jump's window as its two lines alone
 *           indicator posts' arrows on the sleepers, and a lit indicator on each kerb pointing at the clear track
 *   END     terminus  a signal gantry over the exit showing clear on every track, the train shed over the end of the
 *                     line (seen from the start: its ribs, its lit board), buffer stops, and the train waiting
 *
 *   chunk(x0, x1, y0, y1, z0, z1, fill, bevel?)      → faces: a bevelled box in three tones, what things are built of
 *   askDrawing(thing, box, palette, { sun? })        → [{ corners, fill }]   the ask drawn whole (its roll group)
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

/** A thing's SHADOW on the way under a low sun ahead: its foot's shape thrown toward the runner, as long as it is tall.
 * It says how tall a thing is and where it stands before its colour is read. */
export const castShadow = ({ x0, x1, y0, h }, col, z = 0.012) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1 + 0.18 * h, y0 - 1.15 * h, z], [x0 + 0.18 * h, y0 - 1.15 * h, z]], fill: shade(col.ground, 0.66) });

// A CHUNK: a box with its top's edges bevelled by `c`, drawn in the tones a low sun ahead gives it (the top lit, the
// bevels catching the light, the face toward the runner in shade, the sides between). What a thing is built of.
export function chunk(x0, x1, y0, y1, z0, z1, fill, c = 0) {
  c = Math.max(0, Math.min(c, (x1 - x0) / 2 - 0.01, (y1 - y0) / 2 - 0.01, z1 - z0 - 0.01));
  const T = (k) => shade(fill, k), zc = z1 - c, out = [];
  out.push(face(x0, x1, y0, z0, zc, T(0.74)), side(x0, y0, y1, z0, zc, T(0.9)), side(x1, y0, y1, z0, zc, T(0.9)), flat(x0 + c, y0 + c, x1 - c, y1 - c, z1, T(1.16)));
  if (c > 0) {
    out.push({ corners: [[x0, y0, zc], [x1, y0, zc], [x1 - c, y0 + c, z1], [x0 + c, y0 + c, z1]], fill: T(0.98) });
    out.push({ corners: [[x0, y0, zc], [x0, y1, zc], [x0 + c, y1 - c, z1], [x0 + c, y0 + c, z1]], fill: T(1.06) });
    out.push({ corners: [[x1, y0, zc], [x1, y1, zc], [x1 - c, y1 - c, z1], [x1 - c, y0 + c, z1]], fill: T(1.06) });
  }
  return out;
}

/**
 * An ask drawn WHOLE as the thing it is, inside the box that is met (the box itself is not drawn: a `bare` block).
 * Chunky and specific: built of bevelled chunks a hand could hold, each thing with a face. { sun } throws its shadow.
 */
export function askDrawing(thing, { x0, x1, y0, y1, h }, col, { sun = null } = {}) {
  const out = [], f = y0 - E;
  if (!ASK_THINGS[thing]) return out;
  if (sun === 'ahead') out.push(castShadow({ x0, x1, y0, h }, col));
  if (thing === 'barrier') {
    // a striped board on three splayed feet, a rail under it
    const by0 = y0 + 0.16, by1 = y1 - 0.16, n = 11, w = (x1 - x0) / n;
    for (const x of [x0 + 0.5, (x0 + x1) / 2, x1 - 0.5]) out.push(...chunk(x - 0.16, x + 0.16, y0, y1, 0, 0.4, col.iron, 0.05));
    out.push(...chunk(x0 + 0.2, x1 - 0.2, by0 + 0.06, by1 - 0.06, 0.14, 0.26, col.iron));
    out.push(...chunk(x0, x1, by0, by1, 0.36, h, col.jump, 0.07));
    for (let i = 1; i < n; i += 2) { out.push(face(x0 + i * w, x0 + (i + 1) * w, by0 - E, 0.36, h - 0.07, col['tell-jump'])); out.push(flat(x0 + i * w, by0 + 0.07, x0 + (i + 1) * w, by1 - 0.07, h + E, col['tell-jump'])); }
  } else if (thing === 'crates') {
    // five crates with daylight between them, every other one a little lower and set back, each framed and braced
    const n = 5, w = (x1 - x0) / n, g = 0.07, t = 0.11, dark = shade(col.jump2, 0.5);
    for (let i = 0; i < n; i++) {
      const odd = i % 2, a = x0 + i * w + g, b = x0 + (i + 1) * w - g, top = odd ? h - 0.14 : h, yf = y0 + (odd ? 0.12 : 0), fy = yf - E;
      out.push(...chunk(a, b, yf, y1 - (odd ? 0 : 0.1), 0, top, odd ? shade(col.jump2, 0.86) : col.jump2, 0.05));
      out.push(face(a, b, fy, 0, t, dark), face(a, b, fy, top - 0.05 - t, top - 0.05, dark), face(a, a + t, fy, 0, top - 0.05, dark), face(b - t, b, fy, 0, top - 0.05, dark));
      const [p, q] = odd ? [b - t, a + t] : [a + t, b - t], sgn = odd ? -1 : 1;
      out.push({ corners: [[p, fy, t], [p + sgn * t * 1.2, fy, t], [q, fy, top - 0.05 - t], [q - sgn * t * 1.2, fy, top - 0.05 - t]], fill: dark });
      out.push(face((a + b) / 2 - 0.2, (a + b) / 2 + 0.2, fy - E, top * 0.4, top * 0.6, col['tell-jump']));
    }
  } else if (thing === 'wagon') {
    // two wagons end-on, one a track, daylight between: a round-shouldered body on an underframe and wheels, and a
    // FACE toward the runner: a windscreen with the sky in it, two headlamps, a number board, a buffer beam
    const mid = (x0 + x1) / 2, glass = shade(col.steer, 0.36);
    for (const [a, b] of [[x0, mid - 0.12], [mid + 0.12, x1]]) {
      const c = (a + b) / 2;
      for (const wx of [a + 0.28, b - 0.28]) out.push(...chunk(wx - 0.16, wx + 0.16, y0 + 0.2, y0 + 0.95, 0, 0.44, col.iron));
      out.push(...chunk(a + 0.1, b - 0.1, y0 + 0.1, y1, 0.2, 0.64, col.iron));
      out.push(...chunk(a, b, y0, y1, 0.64, h, col.steer, 0.34));
      out.push(...chunk(a + 0.06, b - 0.06, y0, y0 + 0.14, 0.52, 0.76, col.trim, 0.03));
      out.push(face(a + 0.24, b - 0.24, f, 1.66, 2.46, glass), { corners: [[a + 0.36, f - E, 1.78], [a + 0.62, f - E, 1.78], [a + 0.98, f - E, 2.36], [a + 0.72, f - E, 2.36]], fill: col['tell-steer'] });
      out.push(face(a + 0.2, a + 0.5, f, 0.9, 1.16, col.lamp), face(b - 0.5, b - 0.2, f, 0.9, 1.16, col.lamp));
      out.push(face(c - 0.3, c + 0.3, f, 1.2, 1.5, col.trim), face(c - 0.22, c + 0.22, f - E, 1.27, 1.43, col.iron));
      out.push(side(a - E, y0, y1, 1.24, 1.44, col['tell-steer']), side(b + E, y0, y1, 1.24, 1.44, col['tell-steer']));
      out.push(...chunk(c - 0.3, c + 0.3, y0 + 0.9, y0 + 1.7, h - 0.34, h - 0.12, shade(col.steer, 0.6), 0.04));
    }
  }
  return out;
}

export function jumpTell(tell, { ya, yb, half }, col) {
  // (edges: the window's first and last lines alone; coins say the rest)
  if (tell === 'edges') return [flat(-half, ya, half, ya + 0.16, 0.02, col['tell-jump']), flat(-half, yb - 0.16, half, yb, 0.02, col['tell-jump'])];
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
  // the train shed over the end of the line: ribs on tall columns, a lit departure board under the first, lamps under
  // each: taller than anything on the way, so where the line goes is seen from the first step
  const sx = half + 2.4;
  for (const [i, ry] of [y + 1.2, length + 7, length + 13].entries()) {
    for (const k of [-1, 1]) out.push(...solid(k * sx - 0.22, k * sx + 0.22, ry, ry + 0.4, 0, 9.4, col.iron));
    out.push(...solid(-sx, sx, ry, ry + 0.4, 9.4, 10, col.iron), flat(-sx, ry, sx, ry + 0.4, 9.4 - E, col.iron));
    // (the gable over the rib, stepped)
    for (const [wd, z] of [[0.72, 10], [0.46, 10.7], [0.2, 11.4]]) out.push(face(-sx * wd, sx * wd, ry - E, z, z + 0.7, col.iron));
    for (const lane of lanes) out.push(face(lane - 0.22, lane + 0.22, ry - E, 8.7, 9.1, col.lamp));
    if (i === 0) out.push(face(-2.6, 2.6, ry - 2 * E, 7.2, 8.4, col.iron), face(-2.4, 2.4, ry - 3 * E, 7.36, 8.24, col.lamp));
  }
  const t0 = length + 5.2, body = shade(col.flank2, 1.25);
  out.push(...solid(-1.45, 1.45, t0, t0 + 14, 0.55, 3.7, body), face(-1.45, 1.45, t0 - E, 0, 0.55, col.iron));
  out.push(face(-0.5, 0.5, t0 - E, 0.75, 2.9, col.lamp), face(-1.2, -0.75, t0 - E, 1.9, 2.9, col.lamp), face(0.75, 1.2, t0 - E, 1.9, 2.9, col.lamp));
  out.push(face(-1.25, -0.95, t0 - 2 * E, 0.95, 1.2, col.exit), face(0.95, 1.25, t0 - 2 * E, 0.95, 1.2, col.exit));
  return out;
}
