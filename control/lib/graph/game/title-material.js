/**
 * title-material — what a carved title's letters are made of (hud-widgets.js `material` on an `as: 'title'` row): the
 * legacy carver's material shelf (polygonizer/materials.js, the carved-solid wordmark's `material`) brought to the page's
 * letters, which otherwise take the register's look (anime cel bands, western lambert and a glint) in the title's colour.
 *
 *   a metal   chrome, gold, silver, copper, bronze, brass, steel, titanium … (materials/metal-surface.js METALS and
 *             its aliases, and the shelf's metal rows: gunmetal reads as steel): the face of each letter reflects the
 *             studio sweep the broadcast's metal reflects (broadcast-package.js metalStops: the softbox above, the dark
 *             horizon under the middle, the floor's bounce, weighted by the metal's measured reflectance), top to
 *             bottom of the line of type, the chrome logo's look; in three hard bands in the anime register. The
 *             metal is the colour: a row's `color` still tints what stands behind the letters (a glow edge).
 *   a finish  any other shelf row (stone, wood, plastic, satin, matte, glass, neon, cel …, and their aliases: marble,
 *             ceramic, concrete …): the row's own shade (ambient, diffuse, a Blinn glint, cel bands, emission, glass's
 *             opacity) in the title's colour, or the row's own colour when the row names none.
 *
 *   titleMaterialName(m)                 the canonical name a word resolves to, or null (the validator's)
 *   titleMaterial(name, { cel })         → { metal, stops, hex } | { shade: { … }, base } | null (absent: null, no bytes)
 *
 * Pure arithmetic over the two tables; deterministic (dmath inside metalStops).
 */
import { MATERIALS, materialName } from '../polygonizer/materials.js';
import { METALS, METAL_ALIASES } from '../materials/metal-surface.js';
import { metalStops } from '../broadcast/broadcast-package.js';

// the shelf's metal rows a measured table does not hold, by the metal they read as
const SHELF_METAL = Object.freeze({ gunmetal: 'steel' });

function measuredMetal(word) {
  const k = word.trim().toLowerCase();
  if (Object.hasOwn(METALS, k)) return k;
  if (Object.hasOwn(METAL_ALIASES, k)) return METAL_ALIASES[k];
  return null;
}

/** The canonical name a material word resolves to (a measured metal, or a shelf row), or null. */
export function titleMaterialName(m) {
  if (typeof m !== 'string' || !m.trim()) return null;
  const metal = measuredMetal(m);
  if (metal) return metal;
  const row = materialName(m) || materialName(m.trim().toLowerCase());
  if (!row) return null;
  return SHELF_METAL[row] || row;
}

/**
 * What the page needs to bake a title in `name` (a titleMaterialName): a metal's gradient stops (hard bands when `cel`)
 * and the hex at its middle (what its edges are darkened from), or a shelf row's shade and its own colour.
 */
export function titleMaterial(name, { cel = false } = {}) {
  const n = titleMaterialName(name);
  if (!n) return null;
  if (Object.hasOwn(METALS, n)) {
    const stops = metalStops(n, { cel });
    return { metal: n, stops, hex: stops[Math.floor(stops.length / 2)][1] };
  }
  const row = MATERIALS[n];
  const shade = { ambient: row.ambient, diffuse: row.diffuse };
  for (const k of ['specular', 'shininess', 'emissive', 'cel', 'opacity']) if (row[k]) shade[k] = row[k];
  return { shade, base: row.base };
}
