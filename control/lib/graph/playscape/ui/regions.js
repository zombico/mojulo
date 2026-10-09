/**
 * REGIONS — where a UI part sits: the layout half of the UI problem. A screen is a 3×3 grid of regions (the HUD's seven
 * signage slots plus `left` and `right`), parts stack in a column inside their region, and the centre is reserved for
 * the focus band. Layers order what draws over what; surfaces say what the part is drawn on.
 *
 *   UI_REGIONS     the nine screen regions, row by row
 *   HUD_REGIONS    the ones the HUD page draws today (game/hud-widgets.js HUD_SLOTS); `left` and `right` are layout
 *                  words the wireframes draw, and the page draws once the rung-0 renderer lands
 *   UI_LAYERS      world < diegetic < hud < overlay < modal < system
 *   UI_SURFACES    screen (an overlay), object (on its obj:status), world (over an anchor), cursor
 *   PACES          glance | scan | study, which scales REGION_BUDGETS
 *   regionOf(at)   a part's `at` (a region word or { region }) → the region, or null ('over', above each entity, is a
 *                  part's own word: parts.js)
 */
import { HUD_SLOTS } from '../../game/hud-widgets.js';

export const UI_REGIONS = Object.freeze(['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']);
export const HUD_REGIONS = Object.freeze([...HUD_SLOTS]);
export const UI_LAYERS = Object.freeze(['world', 'diegetic', 'hud', 'overlay', 'modal', 'system']);
export const UI_SURFACES = Object.freeze(['screen', 'object', 'world', 'cursor']);

// each region's cell on the grid ([column, row], 0..2), for wireframes and the layout piece
export const REGION_CELLS = Object.freeze({
  'top-left': [0, 0], top: [1, 0], 'top-right': [2, 0],
  left: [0, 1], center: [1, 1], right: [2, 1],
  'bottom-left': [0, 2], bottom: [1, 2], 'bottom-right': [2, 2],
});

// how many parts a region holds before the layout advises (corners hold the persistent readouts, edges a few, the
// centre one moment at a time)
// …scaled by PACE: a twitch game is read in a glance (tight budgets), a management screen is studied, often paused (its
// density is the point); scan is the default between them
export const PACES = Object.freeze(['glance', 'scan', 'study']);
export const REGION_BUDGETS = Object.freeze({
  glance: Object.freeze({ corner: 2, edge: 1, center: 1 }),
  scan: Object.freeze({ corner: 3, edge: 2, center: 1 }),
  study: Object.freeze({ corner: 6, edge: 4, center: 2 }),
});
export const REGION_BUDGET = REGION_BUDGETS.scan;
export const regionClass = (r) => (r === 'center' ? 'center' : r.includes('-') ? 'corner' : 'edge');

/** A part's `at` → its region word, or null when it names none. */
export function regionOf(at) {
  const r = typeof at === 'string' ? at : at && typeof at === 'object' ? at.region : undefined;
  return UI_REGIONS.includes(r) ? r : null;
}
