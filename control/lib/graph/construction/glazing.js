// construction/glazing — what a glass in the catalog looks like as a pane: the colour it lends what is seen through it,
// how much of the view it takes (a flat pane's alpha), how much it reflects face-on, and a frosted glass's haze.
//
//   glassLook(name) → { fill, alpha, f0, haze, wire? }   (null for a name that is no glass)
//     fill    the glass's colour (#rrggbb): what the view through it is tinted by, and its edge
//     alpha   what a flat pane takes out of the view: its reflectance, its absorption (doubled: a thin pane's tint reads at
//             its edges and at a slant more than face-on) and its haze, held to [0.06, 0.95]
//     f0      the reflectance of one face square to it (Schlick's F0: the catalog's rv counts both faces), for a renderer
//             that raises a pane's reflection toward a grazing view
//     haze    0 clear … 1 milk; `wire` a wired glass's mesh pitch (mm)
// Pure data in, data out: no dice.
import { CATALOG } from './catalog.js';

const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function glassLook(name) {
  const g = CATALOG[name];
  if (!g || g.kind !== 'glass') return null;
  const absorb = Math.max(0, 1 - g.tv - g.rv), alpha = Math.min(0.95, Math.max(0.06, g.rv + 2 * absorb + 0.55 * g.haze));
  return { fill: hex(g.rgb), alpha: Math.round(alpha * 1000) / 1000, f0: g.rv / 2, haze: g.haze, ...(g.wire ? { wire: g.wire } : {}) };
}

/** Every glass in the catalog, by name. */
export const GLASSES = Object.freeze(Object.keys(CATALOG).filter((k) => CATALOG[k].kind === 'glass'));
