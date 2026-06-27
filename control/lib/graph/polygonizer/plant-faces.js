/**
 * plant-faces — compose the taiji PLANT printer (expandPlant: trunk + branches +
 * canopy hat, or shoot/frond/flower/grove…) with the taiji→World-faces bridge, so
 * a whole plant becomes a baked face list the World renderers draw directly.
 *
 *   plantToFaces(spec) = expandPlant(spec).flatMap(t => taijiToFaces(t))
 *
 * Kept separate from plant.js so plant.js stays renderer-agnostic (it only knows
 * taiji specs; the SVG manji path and this WebGL/CSS-3D path are peers over the
 * same compiled taijis). Pure, deterministic, unit-testable.
 *
 * Design: control/lib/graph/vegetation.plan.md.
 */

import { expandPlant, validatePlants } from './plant.js';
import { taijiToFaces, pickTint } from './taiji-faces.js';
import { DEFAULT_LIGHT, hexToRgb } from './vexar.js';

// A few foliage greens cycled across a tree's canopy blobs so a single tree's hat
// reads with depth instead of one flat green (the same trick the box cityTree and
// expandGrove use, applied here per-blob in the World path WITHOUT touching the
// shared expandTree — which feeds the live manji SVG tool and its snapshots).
const DEFAULT_FOLIAGE_GREENS = ['#4a7c3a', '#5b8a44', '#3f6e34', '#43773a'];

// A tint is "foliage" when green clearly dominates — so the palette recolours
// leaves/clusters/conifer mass but never the brown trunk/branches, and leaves a
// deliberately non-green canopy (e.g. an autumn or custom leafStyle) untouched.
function isGreenish(hex) {
  const [r, g, b] = hexToRgb(hex);
  return g > r + 8 && g > b + 8;
}

// Bark browns cycled ACROSS trees so a row/grove isn't one uniform trunk colour.
// [0] is the original trunk brown, so a single tree at the origin is unchanged.
// Unlike the foliage palette (which cycles per blob within one canopy), bark is
// picked ONCE per plant — a tree's trunk + branches share one consistent bark.
const BARK_BROWNS = ['#6b4f2a', '#5e4626', '#7a5a33', '#574021', '#6f5330'];

// A tint is "woody" when it reads brown: red ≥ green ≥ blue with real warmth.
function isBrownish(hex) {
  const [r, g, b] = hexToRgb(hex);
  return r >= g && g >= b && r - b > 14 && !isGreenish(hex);
}

// Deterministic bark pick from the plant's anchor position, so trees at different
// spots get different bark with no caller bookkeeping (seedless, mirrors plant.js).
function pickBark(spec, palette) {
  if (!palette || !palette.length) return null;
  const p = spec.base || spec.center || { x: 0, y: 0, z: 0 };
  const s = Math.sin((Number(p.x) || 0) * 12.9898 + (Number(p.y) || 0) * 78.233 + 1) * 43758.5453;
  const f = s - Math.floor(s);
  return palette[Math.floor(f * palette.length) % palette.length];
}

/**
 * plantToFaces(spec, opts) → [{ corners, fill, doubleSided }]
 *
 * @param {object} spec  a plant spec (form:'tree'|'grove'|'shoot'…, base/tip, foliage…).
 * @param {object} opts  { light, crossSections, samples }
 *   light  — vexar light shared across every taiji of the plant (so the whole
 *            plant is lit coherently). Defaults to DEFAULT_LIGHT.
 *   crossSections / samples — face-mesh density override, passed to taijiToFaces.
 *   foliagePalette — array of hexes cycled across green foliage blobs for canopy
 *            depth. Defaults to DEFAULT_FOLIAGE_GREENS; pass `null` to disable
 *            (every blob keeps its own taiji tint), or your own palette.
 *   barkTint — a single hex forced onto every woody (trunk/branch) face of this
 *            plant. Use to set a tree's bark explicitly (e.g. cycle a row).
 *   barkPalette — browns auto-picked per plant by anchor position when barkTint
 *            is not given. Defaults to BARK_BROWNS; pass `null` to disable
 *            (trunks keep their taiji brown — the original uniform look).
 */
export function plantToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const palette = opts.foliagePalette === null ? null
    : (Array.isArray(opts.foliagePalette) && opts.foliagePalette.length ? opts.foliagePalette : DEFAULT_FOLIAGE_GREENS);
  const barkPalette = opts.barkPalette === null ? null
    : (Array.isArray(opts.barkPalette) && opts.barkPalette.length ? opts.barkPalette : BARK_BROWNS);
  const bark = opts.barkTint || pickBark(spec, barkPalette);
  const taijis = expandPlant(spec);
  const faces = [];
  let blob = 0; // index over GREEN taijis only, so the palette cycles per canopy blob
  for (const t of taijis) {
    const base = pickTint(t);
    let tint;
    if (palette && isGreenish(base)) {
      tint = palette[blob % palette.length];
      blob += 1;
    } else if (bark && isBrownish(base)) {
      tint = bark; // one consistent bark across the whole tree
    }
    faces.push(...taijiToFaces(t, { light, tint, crossSections: opts.crossSections, samples: opts.samples }));
  }
  return faces;
}

export { BARK_BROWNS, DEFAULT_FOLIAGE_GREENS };

// Box shapes that the box-city dispatch should render as a taiji plant (the same
// seam landmarks/churches use). A box with one of these `shape`s carries a `plant`
// sub-spec and is meshed by plantBoxToFaces at assemble time (so it's lit by the
// scene's day/night light, like every other box).
export const PLANT_BOX_SHAPES = new Set(['tree', 'conifer', 'shrub', 'palm']);
export function isPlantShape(shape) { return PLANT_BOX_SHAPES.has(shape); }

/**
 * plantBoxToFaces(box, { light }) — render a city/scene PLANT box into baked faces.
 *
 * The box carries a footprint (x,y,w,d,z0,z1) for placement + a `plant` sub-spec
 * ({ height, stemRadius, depth, branches, foliage, clusterSize, foliageTiers }).
 * The taiji geometry is computed from the footprint CENTRE and `plant.height`; the
 * box's own z1 is just a bbox hint (mirrors how landmark boxes ignore z1). Mesh
 * density defaults LOW — these are small street trees, many of them.
 */
export function plantBoxToFaces(box = {}, opts = {}) {
  const p = (box.plant && typeof box.plant === 'object') ? box.plant : {};
  const cx = (Number(box.x) || 0) + (Number(box.w) || 0) / 2;
  const cy = (Number(box.y) || 0) + (Number(box.d) || 0) / 2;
  const z0 = Number(box.z0) || 0;
  const h = Number(p.height) || ((Number(box.z1) || 3) - z0) || 3;
  const mesh = {
    light: opts.light,
    crossSections: opts.crossSections ?? 2,
    samples: opts.samples ?? 6,
    // No barkTint → auto-varies bark per position; box.tint forces it when set.
    ...(box.tint ? { barkTint: box.tint } : {}),
  };

  // Palm: a coconut palm (tropical street tree). Its trunk + coconuts are brown;
  // barkPalette stays on so the trunk auto-tints, but the bloom-free fronds carry
  // the green palette like any other foliage.
  if (box.shape === 'palm') {
    const palm = {
      form: 'palm',
      base: { x: cx, y: cy, z: z0 },
      tip: { x: cx, y: cy, z: z0 + h },
      stemRadius: Number(p.stemRadius) || 0.16,
      ...(Number.isInteger(p.fronds) ? { fronds: p.fronds } : {}),
      ...(Number.isInteger(p.pinnae) ? { pinnae: p.pinnae } : {}),
      ...(Number.isInteger(p.coconuts) ? { coconuts: p.coconuts } : {}),
      ...(Number.isInteger(p.upFronds) ? { upFronds: p.upFronds } : {}),
      ...(Number.isInteger(p.trunkSegments) ? { trunkSegments: p.trunkSegments } : {}),
      ...(Number.isFinite(p.droop) ? { droop: p.droop } : {}),
      ...(Number.isFinite(p.bend) ? { bend: p.bend } : {}),
      ...(Number.isFinite(p.frondLength) ? { frondLength: p.frondLength } : {}),
      ...(Number.isFinite(p.pinnaLength) ? { pinnaLength: p.pinnaLength } : {}),
      ...(Number.isFinite(p.lift) ? { lift: p.lift } : {}),
      ...(Number.isFinite(p.trunkBulge) ? { trunkBulge: p.trunkBulge } : {}),
      ...(Number.isFinite(p.fanSpread) ? { fanSpread: p.fanSpread } : {}),
      ...(p.frondType === 'fan' || p.frondType === 'palmate' ? { frondType: 'fan' } : {}),
    };
    return plantToFaces(palm, mesh);
  }

  const foliage = p.foliage || (box.shape === 'conifer' ? 'conifer' : box.shape === 'shrub' ? 'cluster' : 'cluster');
  const spec = {
    form: 'tree',
    base: { x: cx, y: cy, z: z0 },
    tip: { x: cx, y: cy, z: z0 + h },
    stemRadius: Number(p.stemRadius) || 0.12,
    depth: Number.isInteger(p.depth) ? p.depth : 1,
    branches: Number.isInteger(p.branches) ? p.branches : 3,
    foliage,
    clusterSize: Number(p.clusterSize) || 0.5,
    foliageTiers: Number.isInteger(p.foliageTiers) ? p.foliageTiers : 4,
    // Spread controls: a small branchAngle + high upBias keeps a street tree
    // columnar so its canopy doesn't overhang a neighbouring building.
    ...(Number.isFinite(p.branchAngle) ? { branchAngle: p.branchAngle } : {}),
    ...(Number.isFinite(p.upBias) ? { upBias: p.upBias } : {}),
    ...(Number.isFinite(p.lengthRatio) ? { lengthRatio: p.lengthRatio } : {}),
    // Newer canopy/structure knobs: tiered crowns and V/candelabra forks.
    ...(Number.isInteger(p.foliageLevels) ? { foliageLevels: p.foliageLevels } : {}),
    ...(p.forkStyle === 'planar' || p.forkStyle === 'spiral' ? { forkStyle: p.forkStyle } : {}),
  };
  return plantToFaces(spec, mesh);
}

/** Validate then expand a list of plant specs to a single face list. Returns
 *  { faces, errors }; faces is [] when there are validation errors (mirrors how
 *  the SVG path surfaces validateTaijis/validatePlants at mint, not at render). */
export function plantsToFaces(plants, opts = {}) {
  const errors = validatePlants(plants);
  if (errors.length) return { faces: [], errors };
  const light = opts.light || DEFAULT_LIGHT;
  const faces = [];
  for (const spec of plants) faces.push(...plantToFaces(spec, { ...opts, light }));
  return { faces, errors: [] };
}
