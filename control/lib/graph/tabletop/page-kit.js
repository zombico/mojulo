/**
 * THE TABLETOP PAGES' KIT — what every board-game page (tabletop-page.js and its euro, tile, card and round siblings)
 * builds the same way in Node, said once: the escapes, the levels and their picker, and the table view's cameras and
 * faces (the lattice as placed divs, lattice-css3d.js through scene-css3d.js).
 *
 *   r2(x) · escapeHtml(s) · scriptJson(x)   two decimals; text into markup; JSON inside a <script>
 *   LEVELS · levelSelect(level) → html      the computer's levels, and the header's picker
 *   tableCams(L, viewport, unit, turn?) → [{ name, matrix, perspective, center }]   the lattice's cameras; `turn` a
 *                                           point's map (the seat's side of the board)
 *   tableFaces(L, look, unit, cellOf) → [{ cell, w, h, fill, clip, t }]   every face a placed div; cellOf(name) → the
 *                                           cell's index (a face of no cell: -1)
 *
 * Pure strings and data; no dice, no clock.
 */
import { latticeFaces, latticeCameras } from '../polygonizer/lattice-css3d.js';
import { cameraMatrixFromWorldFraming, planeMatrix } from '../scene/scene-css3d.js';

export const LEVELS = Object.freeze(['easy', 'fair', 'hard']);

export const r2 = (x) => Math.round(x * 100) / 100;
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// JSON inside a <script>: no '</script>' can close it early
export const scriptJson = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

/** The header's level picker, the page's level chosen. */
export const levelSelect = (level) => `<select id="level" aria-label="Level">${LEVELS.map((l) => `<option value="${l}"${l === level ? ' selected' : ''}>${l}</option>`).join('')}</select>`;

/** The lattice's cameras for a viewport, each a matrix the view takes; `turn` moves a camera to a seat's side. */
export function tableCams(L, viewport, unit, turn = null) {
  return latticeCameras(L).map((c) => {
    const wf = turn ? { ...c.worldFraming, cameraPosition: turn(c.worldFraming.cameraPosition), lookAt: turn(c.worldFraming.lookAt) } : c.worldFraming;
    const { matrix, perspective, center } = cameraMatrixFromWorldFraming(wf, viewport, unit);
    return { name: c.name, matrix, perspective: r2(perspective), center };
  });
}

/** The lattice's faces as placed divs: a cell's top carries its index, so it is played by clicking there. */
export function tableFaces(L, look, unit, cellOf) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return latticeFaces(L, look).map((f) => {
    const c = f.corners, u = sub(c[1], c[0]), v = sub(c[3], c[0]);
    const cell = f.group.startsWith('cell:') ? cellOf(f.group.slice(5)) : -1;
    return { cell, w: r2(Math.hypot(...u) * unit), h: r2(Math.hypot(...v) * unit), fill: f.fill, clip: f.clip ?? null, t: planeMatrix(c[0], u, v, unit) };
  });
}
