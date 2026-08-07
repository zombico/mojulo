/**
 * veh-lights — composable, seeded lamp recipes for the vehicle designer
 * (vehicle-designer.plan.md V5). A recipe is a PAIR (or a bar): round or
 * rectangular lamps with chrome bezels, authored facing +y around a
 * mount-origin at the pair's center.
 *
 * Placement is by shell hardpoint, not by chassis socket: superpose the
 * pair at the body's `headlightMount` (facing forward) or `taillightMount`
 * with `flip:'y'` (facing rearward). Both head and tail lamps take the
 * `light` role — the shelf keeps six roles; tail lamps differ by the
 * `function` module's smaller lens, not by a seventh color.
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

export const VEH_LIGHTS_FAMILIES = {
  roundDuo: { shape: 'round', function: 'head', spread: 'standard' },
  rectDuo: { shape: 'rect', function: 'head', spread: 'standard' },
  barSingle: { shape: 'bar', function: 'head', spread: 'wide' },
};

export const VEH_LIGHTS_MODULES = {
  shape: ['round', 'rect', 'bar'],
  function: ['head', 'tail'],
  spread: ['narrow', 'standard', 'wide'],
};

const FAMILY_IDS = Object.keys(VEH_LIGHTS_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);
const SPREADS = { narrow: 1.4, standard: 1.7, wide: 1.9 };

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) modules.shape = pick(rng, VEH_LIGHTS_MODULES.shape);
  modules.spread = pick(rng, VEH_LIGHTS_MODULES.spread);
  return modules; // function (head/tail) is a placement choice, never randomized
}

function lathe(id, from, to, profile, tint) {
  return {
    id,
    axisFrom: { x: round3(from[0]), y: round3(from[1]), z: round3(from[2]) },
    axisTo: { x: round3(to[0]), y: round3(to[1]), z: round3(to[2]) },
    profile: profile.map(({ t, radius }) => ({ t: round3(t), radius: round3(radius) })),
    tint,
  };
}

/**
 * Resolve a seeded lamp recipe. Options mirror the veh-* shelf: `family`
 * (roundDuo, rectDuo, barSingle), `palette`, `colors`, `seed`, `overrides`
 * (e.g. `{ function:'tail' }`), `randomize`, `title`.
 */
export function resolveVehLightsRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-lights');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_LIGHTS_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-lights family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-lights');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const r = modules.function === 'tail' ? 0.16 : 0.24;
  const spread = SPREADS[modules.spread];
  const lathes = [];
  const extrudes = [];
  if (modules.shape === 'bar') {
    extrudes.push({
      id: 'light_bar',
      axisFrom: { x: -spread, y: 0, z: 0 },
      axisTo: { x: spread, y: 0, z: 0 },
      profile: { rect: { w: 0.3, h: r, r: 0.05 } },
      tint: C.light,
    });
  } else {
    for (const [side, sx] of [['l', -1], ['r', 1]]) {
      // bezel ring then lens dome, both self-closing forward (+y)
      lathes.push(lathe(`bezel_${side}`, [sx * spread, -0.06, 0], [sx * spread, 0.1, 0], [
        { t: 0, radius: 0.05 },
        { t: 0.3, radius: r + 0.06 },
        { t: 1, radius: r },
      ], C.chrome));
      lathes.push(lathe(`lens_${side}`, [sx * spread, 0.1, 0], [sx * spread, 0.26, 0], [
        { t: 0, radius: r },
        { t: 0.7, radius: r * 0.8 },
        { t: 1, radius: 0.04 },
      ], C.light));
    }
  }
  return {
    kind: 'workbench',
    title: title || `veh-lights ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    ...(lathes.length ? { lathes } : {}),
    ...(extrudes.length ? { extrudes } : {}),
    garage: {
      kind: 'veh-lights',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: { spread: round3(spread * 2), lensRadius: round3(r) },
      localFrame: { forward: '+y', up: '+z' },
      mountFamily: null, // superpose at the shell's headlightMount / taillightMount (flip 'y' for tail)
      hardpoints: { mount: [0, 0, 0] },
    },
  };
}

export function generateVehLightsVariants({ count = 4, seed = 'veh-lights', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehLightsRecipe({
    family, palette, colors, overrides, randomize, seed: `${seed}:${i}`,
  }));
}

export function listVehLightsLanguage() {
  return {
    families: clone(VEH_LIGHTS_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_LIGHTS_MODULES),
  };
}
