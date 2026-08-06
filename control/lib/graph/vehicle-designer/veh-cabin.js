/**
 * veh-cabin — composable, seeded seating recipes for the vehicle designer
 * (vehicle-designer.plan.md V4, the deck-mount part).
 *
 * Cushions, backrests, and headrests are extrudes; a bench is one wide
 * slab pair, buckets are per-seat pairs. Fidelity floor: seats read as
 * seats from the side window — no piping, no stitching.
 *
 * Local frame: +y forward, +z up. The MOUNT is the origin — the cabin
 * floor point that lands on the chassis `cabinDeck` anchor. Front-row
 * seats sit forward (+y) of the mount, a second row behind it.
 */

import {
  VEH_COLOR_ROLES,
  VEH_PALETTES,
  clone,
  hashSeed,
  mulberry32,
  pick,
  resolvePalette,
  round3,
} from './veh-common.js';

export const VEH_CABIN_FAMILIES = {
  benchFront: { seating: 'bench', rows: 'one', headrests: 'none' },
  bucketsTwo: { seating: 'buckets', rows: 'one', headrests: 'paired' },
  twoPlusTwo: { seating: 'buckets', rows: 'two', headrests: 'paired' },
};

export const VEH_CABIN_MODULES = {
  seating: ['bench', 'buckets'],
  rows: ['one', 'two'],
  headrests: ['none', 'paired'],
};

const FAMILY_IDS = Object.keys(VEH_CABIN_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) modules.seating = pick(rng, VEH_CABIN_MODULES.seating);
  modules.rows = pick(rng, VEH_CABIN_MODULES.rows);
  modules.headrests = modules.seating === 'bench' ? 'none' : pick(rng, VEH_CABIN_MODULES.headrests);
  return modules;
}

function extrude(id, from, to, profile, tint) {
  return {
    id,
    axisFrom: { x: round3(from[0]), y: round3(from[1]), z: round3(from[2]) },
    axisTo: { x: round3(to[0]), y: round3(to[1]), z: round3(to[2]) },
    profile,
    tint,
  };
}

// profile for an x-axis extrude lives in the (y,z) plane
const yzRect = (points) => ({ points: points.map(([y, z]) => [round3(y), round3(z)]) });

// One seat: cushion slab + raked backrest (+ optional headrest), spanning
// x from x0 to x1, cushion front edge at local y = yFront.
function seat(idPrefix, x0, x1, yFront, C, headrest) {
  const cushion = extrude(`${idPrefix}_cushion`, [x0, 0, 0], [x1, 0, 0], yzRect([
    [yFront, 0.35], [yFront, 0.62], [yFront - 1.0, 0.62], [yFront - 1.0, 0.35],
  ]), C.trim);
  const backrest = extrude(`${idPrefix}_backrest`, [x0 + 0.03, 0, 0], [x1 - 0.03, 0, 0], yzRect([
    [yFront - 0.82, 0.62], [yFront - 1.06, 0.62], [yFront - 1.3, 1.6], [yFront - 1.06, 1.6],
  ]), C.trim);
  const parts = [cushion, backrest];
  if (headrest) {
    parts.push(extrude(`${idPrefix}_headrest`, [(x0 + x1) / 2 - 0.22, 0, 0], [(x0 + x1) / 2 + 0.22, 0, 0], yzRect([
      [yFront - 1.16, 1.72], [yFront - 1.36, 1.72], [yFront - 1.4, 2.02], [yFront - 1.2, 2.02],
    ]), C.trim));
  }
  return parts;
}

function rowMonomers(rowPrefix, yFront, modules, C) {
  const paired = modules.headrests === 'paired';
  if (modules.seating === 'bench') {
    return seat(`${rowPrefix}_bench`, -1.35, 1.35, yFront, C, false);
  }
  return [
    ...seat(`${rowPrefix}_seat_a`, -1.45, -0.55, yFront, C, paired),
    ...seat(`${rowPrefix}_seat_b`, 0.55, 1.45, yFront, C, paired),
  ];
}

/**
 * Resolve a seeded cabin recipe.
 *
 * Options mirror the veh-* shelf: `family` (benchFront, bucketsTwo,
 * twoPlusTwo), `palette`, `colors`, `seed`, `overrides`, `randomize`,
 * `title`.
 */
export function resolveVehCabinRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-cabin');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_CABIN_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-cabin family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-cabin');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const extrudes = [...rowMonomers('front', 1.8, modules, C)];
  if (modules.rows === 'two') {
    // second row is always a bench — the 2+2 idiom
    extrudes.push(...seat('rear_bench', -1.35, 1.35, -0.4, { trim: C.trim }, false));
  }
  return {
    kind: 'workbench',
    title: title || `veh-cabin ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    extrudes,
    garage: {
      kind: 'veh-cabin',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: { width: 2.9, depth: modules.rows === 'two' ? 3.6 : 1.4, height: modules.headrests === 'paired' ? 2.02 : 1.6 },
      localFrame: { forward: '+y', up: '+z' },
      mountFamily: 'deck-mount',
      hardpoints: { mount: [0, 0, 0] },
    },
  };
}

export function generateVehCabinVariants({ count = 4, seed = 'veh-cabin', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehCabinRecipe({
    family, palette, colors, overrides, randomize, seed: `${seed}:${i}`,
  }));
}

export function listVehCabinLanguage() {
  return {
    families: clone(VEH_CABIN_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_CABIN_MODULES),
  };
}
