/**
 * THE INTERIOR, DRAWN (Blaze Gunner): a run inside a station or a facility (interior.js its plan) as the faces a scroll
 * stage's page draws, laid in screen axes and stood in the world by the view (frame.js toWorld), so the top view gets it
 * turned. The corridor is a box seen from its open side, as the side map's interiors are (side-map/scene.js):
 *
 *   the WALLS     each ceiling and floor run a slab from the back of the corridor to in front of the play plane: its
 *                 face toward the camera in panels, a step each, in two tones by turns (the side map's A and B bays),
 *                 a lit lip along the open's edge; its face to the open (the floor's top lit, the ceiling's underside in
 *                 shade) with a row of lamps along it; a riser where a step changes, facing the open
 *   BULKHEADS     the same slab across the corridor, its tip marked (the facility's in hazard stripes)
 *   the BACK      the corridor's far wall, in its look's dark, in bays, a lamp strip under the ceiling and over the
 *                 floor on each A bay; a station's windows out to the stars (holes: the space layers show through)
 *   the MOUTH     the hull's face where the run begins and ends, its rim in the look's trim, docking lights either side
 *   FOREGROUND    struts in front of the play, dark, sliding past fastest (the side map's girders), a lit edge each
 *
 * Lit as it is laid (the stage's pages draw their colours as they are): each face its base colour under its facing (a
 * floor's top full, a face toward the camera most of it, the ceiling's underside in shade), lamps their own colour
 * (bright: the page's bloom takes them, and what is fired lights the walls it passes, the shot light).
 *
 *   INTERIOR_LOOK   the looks (a new look is a row): { wall, panel (the B bays'), lip, top (the open's faces), back,
 *                   backBay, lamp, trim, stripe?, window? (a station's), strut }
 *   WALL_DEPTH      the slab's reach off the play plane: { front (toward the camera), back }, camera distances
 *   layInterior(plan, cam, { view, seed? }) → { faces, report: { walls, windows, lamps, struts } }
 *
 * Pure: seeded dice, the same plan the same faces.
 */
import { toWorld, SCROLL_VIEWS } from './frame.js';
import { streamOf } from '../../city/plan/dice.js';

const row = (o) => Object.freeze(o);
export const INTERIOR_LOOK = Object.freeze({
  // a station: pale grey panels, a cyan that marks its edges and its lamps, windows out to the stars
  station: row({ wall: '#5d6772', panel: '#525b66', lip: '#b9c6d3', top: '#8c98a6', back: '#1d232b', backBay: '#232a33', lamp: '#7fe8ff', trim: '#d5dee6', window: true, strut: '#141a21' }),
  // a facility: dark steel, amber lamps, hazard stripes on what crosses the way
  facility: row({ wall: '#4a4f56', panel: '#41464c', lip: '#8a8f94', top: '#5d636a', back: '#16181b', backBay: '#1b1e22', lamp: '#ffb347', trim: '#e0b020', stripe: '#1a1a1a', window: false, strut: '#111214' }),
});
export const WALL_DEPTH = Object.freeze({ front: 0.07, back: -0.3 });
const STRUT_DEPTH = 0.3, STRUT_EVERY = 1.3, LIP = 0.035, LAMP_EVERY = 1;   // (a strut a screen's 0.8 along; a lip a share across)

const r3 = (v) => Math.round(v * 1000) / 1000;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const shade = (hex, k) => rgbHex(hexRgb(hex).map((v) => v * k));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// how much light a face gets by its facing (screen axes): the camera's side most, a floor's top full, an underside little
const LIGHT = { toward: 0.86, up: 1, down: 0.55, back: 0.72, ahead: 0.62 };

/** The interior's faces (see the header). */
export function layInterior(plan, cam, { view = 'side', seed = 1 } = {}) {
  const V = SCROLL_VIEWS[view], K = INTERIOR_LOOK[plan.look] ?? INTERIOR_LOOK.station, C = cam.screen.across, A = cam.screen.along;
  const dF = r3(WALL_DEPTH.front * cam.dist), dB = r3(WALL_DEPTH.back * cam.dist), faces = [], report = { walls: 0, windows: 0, lamps: 0, struts: 0 };
  const die = streamOf(seed, 'scroll-interior', 'dress');
  const N = { toward: V.toward, up: V.across, down: V.across.map((x) => -x), back: V.along.map((x) => -x), ahead: V.along };
  // a quad from four (u, v, d) corners, facing n (one of N), anticlockwise seen from its side
  const quad = (pts, n, fill, group) => {
    const w = pts.map((p) => toWorld(view, p).map(r3)), [a, b, c] = w;
    const x = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], y = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
    faces.push({ corners: dot(cr, N[n]) < 0 ? w.reverse() : w, normal: [...N[n]], fill, group });
  };
  // a rectangle on a plane square to the camera (at depth d), from (u0, v0) to (u1, v1)
  const front = (d, u0, u1, v0, v1, fill, group) => { if (u1 - u0 > 1e-3 && v1 - v0 > 1e-3) quad([[u0, v0, d], [u1, v0, d], [u1, v1, d], [u0, v1, d]], 'toward', fill, group); };
  // a face along the corridor at v (up: the floor's top; down: the ceiling's underside), from d0 to d1
  const flat = (v, u0, u1, d0, d1, n, fill, group) => quad([[u0, v, d0], [u1, v, d0], [u1, v, d1], [u0, v, d1]], n, fill, group);
  // a face across the corridor at u (back: facing the ship coming; ahead: facing on), from v0 to v1
  const cross = (u, v0, v1, d0, d1, n, fill, group) => { if (v1 - v0 > 1e-3) quad([[u, v0, d0], [u, v1, d0], [u, v1, d1], [u, v0, d1]], n, fill, group); };
  const P = plan.profile, step = plan.step;
  const stepOf = (u) => Math.floor((u - plan.u0) / step + 1e-6);
  // ── the WALLS: the ceiling's and the floor's runs, their faces toward the camera in panels, a lip, the face to the open ──
  for (const w of plan.walls.filter((x) => x.role !== 'bulkhead')) {
    const ceil = w.role === 'ceiling', edge = ceil ? w.v0 : w.v1, lip = LIP * C;
    for (let u = w.u0; u < w.u1 - 1e-3; u += step) {
      const b = Math.min(w.u1, u + step), tone = stepOf(u) % 2 ? K.panel : K.wall;
      if (ceil) { front(dF, u, b, edge + lip, w.v1, shade(tone, LIGHT.toward), 'interior:wall'); front(dF, u, b, edge, edge + lip, K.lip, 'interior:lip'); }
      else { front(dF, u, b, w.v0, edge - lip, shade(tone, LIGHT.toward), 'interior:wall'); front(dF, u, b, edge - lip, edge, K.lip, 'interior:lip'); }
      // (its lamps along the face to the open: a short bright bar, a step each)
      if (stepOf(u) % LAMP_EVERY === 0) {
        const m = (u + b) / 2, half = step * 0.12;
        flat(edge + (ceil ? -0.02 : 0.02), m - half, m + half, dF - 0.25 * (dF - dB), dF - 0.12 * (dF - dB), ceil ? 'down' : 'up', K.lamp, 'interior:lamp'); report.lamps += 1;
      }
    }
    flat(edge, w.u0, w.u1, dB, dF, ceil ? 'down' : 'up', shade(K.top, ceil ? LIGHT.down : LIGHT.up), 'interior:wall');
    report.walls += 1;
  }
  // the RISERS: where a step changes, the face across the corridor between the two edges, facing the open's side it stands to
  for (const side of ['ceiling', 'floor']) {
    const runs = plan.walls.filter((x) => x.role === side).sort((a, b) => a.u0 - b.u0);
    for (let k = 1; k < runs.length; k++) {
      const a = runs[k - 1], b = runs[k], ea = side === 'ceiling' ? a.v0 : a.v1, eb = side === 'ceiling' ? b.v0 : b.v1, u = b.u0;
      // (the one that juts into the open shows the face: a lower ceiling ahead faces back at the ship, a higher one on)
      const juts = side === 'ceiling' ? eb < ea : eb > ea, lo = Math.min(ea, eb), hi = Math.max(ea, eb);
      cross(u, lo, hi, dB, dF, juts ? 'back' : 'ahead', shade(K.wall, juts ? LIGHT.back : LIGHT.ahead), 'interior:wall');
    }
  }
  // ── BULKHEADS: a slab across the way, its tip marked ──
  for (const w of plan.walls.filter((x) => x.role === 'bulkhead')) {
    const n = Math.max(2, Math.round((w.v1 - w.v0) / (C * 0.04)));
    for (let k = 0; k < n; k++) {
      const v0 = w.v0 + ((w.v1 - w.v0) * k) / n, v1 = w.v0 + ((w.v1 - w.v0) * (k + 1)) / n, fill = K.stripe ? (k % 2 ? K.stripe : K.trim) : k % 2 ? K.panel : K.wall;
      front(dF, w.u0, w.u1, v0, v1, shade(fill, LIGHT.toward), 'interior:bulkhead');
    }
    cross(w.u0, w.v0, w.v1, dB, dF, 'back', shade(K.wall, LIGHT.back), 'interior:bulkhead');
    cross(w.u1, w.v0, w.v1, dB, dF, 'ahead', shade(K.wall, LIGHT.ahead), 'interior:bulkhead');
    // (its tip, toward the open: a lit edge in the trim)
    const P0 = P.find((p) => p.u0 <= w.u0 && w.u0 <= p.u1), fromTop = P0 && Math.abs(w.v1 - P0.hi) < 1e-6, tip = fromTop ? w.v0 : w.v1;
    flat(tip, w.u0, w.u1, dB, dF, fromTop ? 'down' : 'up', K.trim, 'interior:bulkhead');
    report.walls += 1;
  }
  // ── the BACK: the corridor's far wall, a step a bay, its lamp strips, a station's windows ──
  for (let k = 0; k < P.length; k++) {
    const p = P[k], lo = p.lo - 0.5, hi = p.hi + 0.5, bay = k % 2 ? K.backBay : K.back, gap = p.hi - p.lo;
    const kind = plan.sections[p.section].kind, win = K.window && (kind === 'hall' || kind === 'core') && k % 4 === 2;
    if (win) {
      // (a window: the bay with a hole in it, the space layers seen through)
      const a = p.u0 + step * 0.2, b = p.u1 - step * 0.2, w0 = p.lo + gap * 0.3, w1 = p.hi - gap * 0.3;
      front(dB, p.u0, a, lo, hi, bay, 'interior:back'); front(dB, b, p.u1, lo, hi, bay, 'interior:back');
      front(dB, a, b, lo, w0, bay, 'interior:back'); front(dB, a, b, w1, hi, bay, 'interior:back');
      // its frame in the trim, set a little toward the camera
      for (const [x0, x1, y0, y1] of [[a, b, w0 - 1.2, w0], [a, b, w1, w1 + 1.2], [a - 1.2, a, w0 - 1.2, w1 + 1.2], [b, b + 1.2, w0 - 1.2, w1 + 1.2]]) front(dB + 0.5, x0, x1, y0, y1, shade(K.trim, 0.7), 'interior:back');
      report.windows += 1;
    } else front(dB, p.u0, p.u1, lo, hi, bay, 'interior:back');
    if (k % 2 === 0) for (const v of [p.hi - gap * 0.08, p.lo + gap * 0.08]) { front(dB + 0.4, p.u0 + step * 0.15, p.u1 - step * 0.15, v - 0.5, v + 0.5, K.lamp, 'interior:lamp'); report.lamps += 1; }
  }
  // ── the MOUTH and the way out: the hull's face across the run's ends, its rim and its docking lights ──
  const ends = [[plan.u0, 'back', P[0]], [plan.u1, 'ahead', P[P.length - 1]]];
  for (const [u, n, p] of ends) {
    cross(u, p.hi, p.hi + C, dB, dF, n, shade(K.trim, n === 'back' ? 0.8 : 0.6), 'interior:hull');
    cross(u, p.lo - C, p.lo, dB, dF, n, shade(K.trim, n === 'back' ? 0.8 : 0.6), 'interior:hull');
    const o = n === 'back' ? -0.3 : 0.3;
    for (const [v, hue] of [[p.hi + C * 0.02, '#ff3b30'], [p.lo - C * 0.02, '#3bff6a']]) { cross(u + o, v - 1.2, v + 1.2, dF - 3, dF - 0.6, n, hue, 'interior:lamp'); report.lamps += 1; }
  }
  // ── FOREGROUND: struts in front of the play, dark, a screen and a third apart (jittered), the frame's height and more ──
  const dS = STRUT_DEPTH * cam.dist, grow = (cam.dist - dS) / cam.dist, wide = C * 0.016;
  for (let u = plan.u0 + A * STRUT_EVERY * (0.3 + die() * 0.4); u < plan.u1; u += A * STRUT_EVERY * (0.8 + die() * 0.4)) {
    const p = P.find((q) => q.u0 <= u && u <= q.u1) ?? P[P.length - 1], half = (C / 2) * grow * 1.3;
    front(dS, u - wide / 2, u + wide / 2, p.mid - half, p.mid + half, K.strut, 'interior:strut');
    front(dS + 0.05, u - wide / 2, u - wide / 2 + wide * 0.18, p.mid - half, p.mid + half, shade(K.lip, 0.35), 'interior:strut');
    report.struts += 1;
  }
  return { faces, report };
}
