/**
 * TALL GRASS — a geocube's cover for a game played unseen: grass in tight clumps only where the level lays it, standing to
 * a height a body crouched or lying in it is hidden under, and no blades anywhere else. The gen-7 land's grass is
 * otherwise everywhere green and level near the eye, a meadow's look and most of a frame's triangles; here it is the
 * level's, little, and it plays.
 *
 *   recipe (a geocube's `tallGrass`):
 *     { patches: [{ at: [x, y], r, h? }], elsewhere?: 'none' | 'grass' | 'paint' }
 *       patches    each a clump of tall grass: its middle, its radius (m, TALL_GRASS.r), its height (m, TALL_GRASS.h)
 *       elsewhere  'none' (the default): no grass outside the patches; 'grass': the land's own grass too; 'paint': the
 *                  land's own grass as its colour on the ground from the eye out (the far field's blanket, no blade
 *                  built), so a field reads as grass and only the patches, the cover, stand
 *
 *   readTallGrass(spec)          → { patches, elsewhere } | null (null: no tall grass; a malformed patch left out)
 *   patchCover(x, y, patches)    → 0..1, how much of a patch is there: whole inside, thinning over its ragged edge
 *                                  (TALL_GRASS.edge m, wandering by the place's own dice)
 *   standOf(patches)             → the page's tall clump for them (channels/form-grass.js): its scale to their height,
 *                                  more blades a clump, set closer, drawn at every distance
 *   fieldOf()                    → the page's short sward round the patches (`elsewhere: 'grass'`), thinned (TALL_GRASS.field)
 *   veilsOf(patches, zAt)        → the runtime's veils (worlds/controllable/veil.js): each patch a column of grass, its
 *                                  foot on the ground (`zAt(x, y)`, else 0); a patch the land read says how it stands
 *                                  (`share`: of its ground level and green, where its grass grows; `z`: that ground's
 *                                  mean height) stands its foot there, and one with under TALL_GRASS.share of it grown
 *                                  is no veil: grass that is not drawn hides nothing
 *
 * Pure and deterministic.
 */
const fz = Object.freeze;

/** The patches' defaults and the clump the page draws in them: radius and height (m), the ragged edge's width (m) and
 *  the cell its wander is read over, and the clump (blades, spread, spacing) against the land's tall tier. */
export const TALL_GRASS = fz({
  r: 3, rMin: 0.8, rMax: 14, h: 1.2, hMin: 0.6, hMax: 2.4, edge: 0.9, edgeCell: 1.6, share: 0.5,
  // (the clumps 0.336 m apart: three fifths as many a square metre as at 0.26, the stand's first spacing, thinned on play)
  clump: fz({ blades: 9, spread: fz([0.05, 0.17]), width: fz([0.022, 0.032]), lean: fz([0.1, 0.26]) }), spacing: 0.336,
  // (the land's own grass round the patches, `elsewhere: 'grass'`: the short sward thinned, six bristles a cell and no dark
  // twin behind each, a third of its triangles: a field the eye reads as grass, cover only in the patches)
  field: fz({ clump: fz({ blades: 6, dark: false }) }),
  // (the land's tall clump's mean tip, form-grass.js GRASS_TIERS 'tall' × BLADE_RISE: a stand's scale is its height over it)
  tip: 0.62,
});

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function readTallGrass(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null;
  const patches = (Array.isArray(spec.patches) ? spec.patches : []).flatMap((p) => {
    if (!p || !Array.isArray(p.at) || !num(p.at[0]) || !num(p.at[1])) return [];
    return [{ at: [p.at[0], p.at[1]], r: clampN(num(p.r) ? p.r : TALL_GRASS.r, TALL_GRASS.rMin, TALL_GRASS.rMax), h: clampN(num(p.h) ? p.h : TALL_GRASS.h, TALL_GRASS.hMin, TALL_GRASS.hMax) }];
  });
  if (!patches.length) return null;
  return { patches, elsewhere: spec.elsewhere === 'grass' || spec.elsewhere === 'paint' ? spec.elsewhere : 'none' };
}

// (a place's own dice, 0..1, smooth over `cell` m)
const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, a = f * f * (3 - 2 * f), b = g * g * (3 - 2 * g);
  return (hash(i, j) * (1 - a) + hash(i + 1, j) * a) * (1 - b) + (hash(i, j + 1) * (1 - a) + hash(i + 1, j + 1) * a) * b;
}

export function patchCover(x, y, patches) {
  let c = 0;
  const E = TALL_GRASS.edge, cell = TALL_GRASS.edgeCell;
  for (const p of patches) {
    const d = Math.hypot(x - p.at[0], y - p.at[1]);
    if (d > p.r + E) continue;
    // (the edge wanders in and out by the place's dice, so a patch is a clump and never a disc)
    const rr = p.r + (vnoise(x / cell + 5.3, y / cell + 1.7) - 0.5) * 2 * E * 0.6, t = Math.min(1, Math.max(0, (rr - d) / E + 0.5));
    c = Math.max(c, t * t * (3 - 2 * t));
    if (c >= 1) break;
  }
  return c;
}

export function standOf(patches) {
  const h = patches.reduce((s, p) => s + p.h, 0) / Math.max(1, patches.length);
  return { scale: Math.round((h / TALL_GRASS.tip) * 1000) / 1000, spacing: TALL_GRASS.spacing, clump: { ...TALL_GRASS.clump, spread: [...TALL_GRASS.clump.spread], width: [...TALL_GRASS.clump.width], lean: [...TALL_GRASS.clump.lean] } };
}

export function fieldOf() { return { clump: { ...TALL_GRASS.field.clump } }; }

export function veilsOf(patches, zAt = null) {
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return patches.filter((p) => p.share === undefined || p.share >= TALL_GRASS.share).map((p) => {
    const z = Number.isFinite(p.z) ? p.z : zAt ? zAt(p.at[0], p.at[1]) : 0;
    return { at: [r3(p.at[0]), r3(p.at[1]), r3(Number.isFinite(z) ? z : 0)], r: p.r, h: p.h };
  });
}
