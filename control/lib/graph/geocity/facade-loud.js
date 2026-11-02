/**
 * AN EVOKED FACADE DRAWN LOUD: a wall's facade card (architecture/facade-card.js buildFacadeCard, its window grid) made
 * geometry here, so each of its windows can be pulled off square, where the renderer would draw the card's grid
 * square (expandSurfaceCards). The cube's `exaggerate.homes.skew` (era/exaggerate.js) is how far.
 *
 *   loudFacade(corners, card, { lit, hue, ink, k, seed, lights })
 *     corners  the wall quad in metres (c0 c1 along its foot, c3 over c0)
 *     card     its facade card: the window grid in its first part (u0 u1 v0 v1, countU × countV, gapU gapV)
 *     hue      the lot's wall hue the wall and its glass lean to (null: as they were)
 *     ink      the lot's frame ink (each window framed fat in it, proud of its glass)
 *     k        the skew (0–0.3): each window's corners drawn inward by skewCorners, at least three of them off 90°
 *     lights   the night's lit panes on this wall, as [u0, u1, v0, v1, fill, group] in the card's (u, v): a window whose
 *              middle one covers burns in its colour (its dice the night's, city/plan/night.js), its glass never shaded
 *
 * Returns { faces, windows }: the wall sheet in the structure's colour, then a window's glass and its frame's four
 * sides; `windows` each window's glass corners in the wall's (u, z) metres, for the law. A card with no window grid (a
 * metal rainscreen) returns null: it stays a card.
 *
 * Pure, seeded by `seed` alone (a window its own dice from it, by its cell), and never called on a plumb cube.
 */
import { scaleHex } from '../polygonizer/vexar.js';
import { skewCorners, offSquare, OFF_SQUARE } from '../era/exaggerate.js';
import { leanHue } from '../era/town-dress.js';

// how far proud of the wall a window's glass and its frame stand (m), and the frame's width as a share of the window's
// lesser side (held between FRAME_MIN and FRAME_MAX metres)
// (a window's corners off square by SKEW_MARGIN degrees at the least, so they stay off the law's 3 once the metro rounds
// them to its own grid)
const SKEW_MARGIN = 4.5, GLASS_PROUD = 0.03, FRAME_PROUD = 0.11, FRAME = 0.16, FRAME_MIN = 0.07, FRAME_MAX = 0.3;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function loudFacade(corners, card, { lit = 1, hue = null, ink = '#1c1830', k = 0.16, seed = 1, lights = [] } = {}) {
  const g = card && card.parts && card.parts[0];
  if (!g || g.kind !== 'grid' || card.material === 'metal' || !(g.countU >= 1 && g.countV >= 1)) return null;
  const c0 = corners[0], U = sub(corners[1], c0), V = sub(corners[3], c0), Ul = Math.hypot(...U) || 1, Vl = Math.hypot(...V) || 1;
  const uh = U.map((v) => v / Ul), vh = V.map((v) => v / Vl);
  const n0 = [uh[1] * vh[2] - uh[2] * vh[1], uh[2] * vh[0] - uh[0] * vh[2], uh[0] * vh[1] - uh[1] * vh[0]], nl = Math.hypot(...n0) || 1, n = n0.map((v) => v / nl);
  // (a point of the wall at (u, z) metres along and up it, p proud of it)
  const at = (u, z, p) => [0, 1, 2].map((j) => r5(c0[j] + uh[j] * u + vh[j] * z + n[j] * p));
  const lean = (hex, t) => (hue ? leanHue(hex, hue, t) : hex);
  const wall = lean(card.frameHex ?? card.base, 0.7), glass = lean(card.bodyHex ?? g.fill, 0.35);
  const faces = [{ corners: corners.map((p) => p.map(r5)), fill: scaleHex(wall, lit), part: 'wall' }], windows = [];
  const stepU = (g.u1 - g.u0) / g.countU, stepV = (g.v1 - g.v0) / g.countV;
  for (let j = 0; j < g.countV; j++) for (let i = 0; i < g.countU; i++) {
    const su0 = g.u0 + i * stepU + g.gapU / 2, su1 = g.u0 + (i + 1) * stepU - g.gapU / 2, sv0 = g.v0 + j * stepV + g.gapV / 2, sv1 = g.v0 + (j + 1) * stepV - g.gapV / 2;
    const w = (su1 - su0) * Ul, h = (sv1 - sv0) * Vl;
    if (!(w > 0.2 && h > 0.2)) continue;
    // (the window's frame first, so a window pulled in still fits its cell: the glass drawn inward of the frame's outside)
    const fw = Math.min(FRAME_MAX, Math.max(FRAME_MIN, FRAME * Math.min(w, h))), gw = w - 2 * fw, gh = h - 2 * fw;
    if (!(gw > 0.1 && gh > 0.1)) continue;
    const off = skewCorners((seed * 31 + j * 1009 + i * 7919) >>> 0 || 1, gw, gh, k, SKEW_MARGIN);
    const u0 = su0 * Ul + fw, z0 = sv0 * Vl + fw;
    const inner = [[u0, z0], [u0 + gw, z0], [u0 + gw, z0 + gh], [u0, z0 + gh]].map((p, q) => [p[0] + off[q][0], p[1] + off[q][1]]);
    // (its frame's outside: the glass's corners pushed out by the frame's width, each along its own diagonal, so the
    // frame leans with the window and stays a frame's width all round)
    const cu = inner.reduce((s, p) => s + p[0], 0) / 4, cz = inner.reduce((s, p) => s + p[1], 0) / 4;
    const outer = inner.map(([u, z]) => [u + Math.sign(u - cu) * fw, z + Math.sign(z - cz) * fw]);
    const mu = (su0 + su1) / 2, mv = (sv0 + sv1) / 2, L = lights.find((l) => mu >= l[0] && mu <= l[1] && mv >= l[2] && mv <= l[3]);
    faces.push(L
      ? { corners: inner.map(([u, z]) => at(u, z, GLASS_PROUD)), fill: L[4], group: L[5], noInk: true, part: 'glass' }
      : { corners: inner.map(([u, z]) => at(u, z, GLASS_PROUD)), fill: scaleHex(glass, lit), part: 'glass' });
    for (let q = 0; q < 4; q++) {
      const a = q, b = (q + 1) % 4;
      faces.push({ corners: [at(...outer[a], FRAME_PROUD), at(...outer[b], FRAME_PROUD), at(...inner[b], FRAME_PROUD), at(...inner[a], FRAME_PROUD)], fill: scaleHex(ink, lit), part: 'frame' });
    }
    windows.push(inner);
  }
  return { faces, windows };
}

/** Every window of a loud facade off square at OFF_SQUARE corners or more (exaggerate.js offSquare). */
export const loudWindowsOk = (windows) => windows.every((w) => offSquare(w) >= OFF_SQUARE);
