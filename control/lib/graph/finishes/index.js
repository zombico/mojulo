/**
 * finishes — the visual language of a house's fixed finishes, so houses are not all minted alike: how its doors are
 * made, how its windows are divided, what its floors are laid in, and what dresses its walls.
 *
 *   DOOR_STYLES      the leaf's face: panels, glass, grooves or reeds, as parts on the leaf (0..1 across, 0..1 up)
 *   WINDOW_STYLES    the divided-light patterns (the kernel's own, and crittall, prairie, cottage, six-over-six)
 *   FLOOR_PATTERNS   planks and tiles, procedural in any colours (finishes/patterns.js)
 *   WALL_TREATMENTS  how a wall's lower part is dressed: wainscot, board-and-batten, shiplap, picture-frame, beadboard
 *   WALLPAPERS       papers, procedural in any colours (finishes/patterns.js)
 *
 * They are house knobs like `windowStyle` and `entryDoorTint`: `doorStyle`, `doorLeafTint`, `windowStyle`,
 * `windowFrameTint`, `livingFloor`, `bedroomFloor`, `wetFloor`, `wallTreatment`, `wallpaper`. A new house is minted
 * with `finishes: 'auto'`, and its style's roll draws them with its siding, roof and paints (each family's lists live
 * in polygonizer/floorplan-styles.js beside its other picks); a house minted before keeps its bytes. A knob the
 * manifest names wins over the roll. An interior's surfaces choose from the same tables.
 */
import { FLOOR_PATTERNS, WALLPAPERS, patternKey } from './patterns.js';

export { FLOOR_PATTERNS, WALLPAPERS, patternKey };

// ── doors ───────────────────────────────────────────────────────────────────────────────────────────────────────
// A part: [s0, s1, z0, z1, kind]; kind 'panel' (recessed), 'glass', 'groove' (a cut line), 'reed' (proud), 'rail'
// (a raised bar). The leaf itself is the slab.
const grid = (cols, rows, s0, s1, z0, z1, gap = 0.06) => {
  const out = [], w = (s1 - s0 - gap * (cols - 1)) / cols, h = (z1 - z0 - gap * (rows - 1)) / rows;
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) out.push([s0 + c * (w + gap), s0 + c * (w + gap) + w, z0 + r * (h + gap), z0 + r * (h + gap) + h]);
  return out;
};
export const DOOR_STYLES = Object.freeze({
  'two-panel': { label: 'two-panel', line: 'two recessed panels, the house’s own leaf', parts: [[0.16, 0.84, 0.1, 0.43, 'panel'], [0.16, 0.84, 0.52, 0.92, 'panel']] },
  shaker: { label: 'Shaker', line: 'one tall flat panel in a square frame', parts: [[0.18, 0.82, 0.1, 0.9, 'panel']] },
  'five-panel': { label: 'five-panel', line: 'five flat panels stacked, the craftsman door', parts: grid(1, 5, 0.17, 0.83, 0.08, 0.92, 0.04).map((p) => [...p, 'panel']) },
  'six-panel': { label: 'six-panel', line: 'two columns of three, the colonial door', parts: [[0.13, 0.47, 0.08, 0.36], [0.53, 0.87, 0.08, 0.36], [0.13, 0.47, 0.42, 0.78], [0.53, 0.87, 0.42, 0.78], [0.13, 0.47, 0.83, 0.94], [0.53, 0.87, 0.83, 0.94]].map((p) => [...p, 'panel']) },
  flush: { label: 'flush', line: 'a plain slab, no panels', parts: [] },
  glazed: { label: 'half-glazed', line: 'a glass light over one panel', parts: [[0.17, 0.83, 0.1, 0.42, 'panel'], [0.17, 0.83, 0.5, 0.9, 'glass']] },
  french: { label: 'French', line: 'glass lights the leaf’s height, divided by bars', parts: [[0.12, 0.88, 0.08, 0.92, 'glass'], [0.49, 0.51, 0.08, 0.92, 'rail'], ...[0.29, 0.5, 0.71].map((z) => [0.12, 0.88, z - 0.01, z + 0.01, 'rail'])] },
  plank: { label: 'plank', line: 'vertical boards held by two ledgers, the cottage door', parts: [[0.25, 0.26, 0, 1, 'groove'], [0.5, 0.51, 0, 1, 'groove'], [0.75, 0.76, 0, 1, 'groove'], [0.06, 0.94, 0.18, 0.24, 'rail'], [0.06, 0.94, 0.76, 0.82, 'rail']] },
  fluted: { label: 'fluted', line: 'fine vertical reeds the whole face, the contemporary door', parts: Array.from({ length: 11 }, (_, i) => [0.08 + i * 0.077, 0.08 + i * 0.077 + 0.04, 0.04, 0.96, 'reed']) },
});
export const DOOR_STYLE_NAMES = Object.freeze(Object.keys(DOOR_STYLES));

// ── windows ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const WINDOW_STYLES = Object.freeze({
  picture: 'one clean pane', casement: 'a pair of side-hung sashes', 'double-hung': 'two sashes, a meeting rail, two-over-two',
  colonial: 'a grid of small lights', transom: 'a light over the main sash', french: 'tall divided lights to the floor',
  german: 'tilt-turn sashes under a transom', crittall: 'a fine grid of steel bars, black-framed',
  prairie: 'a border of narrow lights round a clear centre', cottage: 'divided lights in the top third only',
  'six-over-six': 'two sashes of six lights each',
});

// ── walls ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const WALL_TREATMENTS = Object.freeze({
  wainscot: 'raised-panel dado under a chair rail',
  'board-and-batten': 'flat boards with battens over the joints, to two thirds of the height',
  shiplap: 'horizontal boards with a shadow gap, floor to ceiling',
  'picture-frame': 'applied moulding boxes, a row low and a row high',
  beadboard: 'narrow beaded boards under a chair rail',
});

// The room kinds a house's floors are laid by: `livingFloor` for lounges, dining rooms, studies, entries and halls,
// `bedroomFloor` for bedrooms, `wetFloor` for kitchens, baths and laundries.
export const ROOM_KIND = Object.freeze({ L: 'living', D: 'living', O: 'living', E: 'living', H: 'living', S: 'living', B: 'sleeping', K: 'wet', W: 'wet', Y: 'wet' });
export const FLOOR_KNOBS = Object.freeze(['livingFloor', 'bedroomFloor', 'wetFloor']);

const HEX = /^#[0-9a-f]{6}$/i;
/**
 * Why a house's finish knobs are malformed → string[], each naming what is valid. They are knobs like `windowStyle`:
 * drawn by the house style's roll for a house with `finishes: 'auto'` (polygonizer/floorplan-styles.js), or named.
 */
export function finishKnobErrors(m) {
  const e = [];
  if (!m || typeof m !== 'object') return e;
  if (m.finishes != null && m.finishes !== false && m.finishes !== 'auto') e.push("finishes: 'auto' (the house style draws its doors, windows, floors and walls), or null");
  if (m.doorStyle != null && !DOOR_STYLES[m.doorStyle]) e.push(`doorStyle: one of ${DOOR_STYLE_NAMES.join(', ')}`);
  if (m.windowStyle != null && !WINDOW_STYLES[m.windowStyle] && m.windowStyle !== 'plain') e.push(`windowStyle: one of ${Object.keys(WINDOW_STYLES).join(', ')}`);
  for (const k of ['doorLeafTint', 'windowFrameTint']) if (m[k] != null && !HEX.test(m[k])) e.push(`${k}: '#rrggbb'`);
  if (m.wallTreatment != null && !WALL_TREATMENTS[m.wallTreatment]) e.push(`wallTreatment: one of ${Object.keys(WALL_TREATMENTS).join(', ')}`);
  const pat = (p, table, at) => {
    if (!p || typeof p !== 'object' || !table[p.pattern]) { e.push(`${at}.pattern: one of ${Object.keys(table).join(', ')}`); return; }
    if (!Array.isArray(p.colours) || p.colours.length < 2 || !p.colours.every((c) => HEX.test(c))) e.push(`${at}.colours: two or three '#rrggbb'`);
  };
  if (m.wallpaper != null) pat(m.wallpaper, WALLPAPERS, 'wallpaper');
  for (const k of FLOOR_KNOBS) if (m[k] != null) pat(m[k], FLOOR_PATTERNS, k);
  return e;
}

/** A floor or paper spec → its texture key and the feet one tile covers. */
export function patternFace(spec) {
  const P = FLOOR_PATTERNS[spec.pattern] || WALLPAPERS[spec.pattern];
  return P ? { texture: patternKey(spec.pattern, spec.colours), tileFt: P.tileFt } : null;
}
