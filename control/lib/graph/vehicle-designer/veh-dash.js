/**
 * veh-dash — composable, seeded dashboard recipes for the vehicle designer
 * (vehicle-designer.plan.md V4, a rail-mount part).
 *
 * The dash slab is a wide x-axis extrude; the instrument cluster is a
 * binnacle extrude or a pair of round gauges (self-closing y-axis lathes
 * with glass faces). Fidelity floor: a dash reads as a dash through the
 * windshield — no vents, no switches.
 *
 * Local frame: +y forward, +z up. The MOUNT is the origin — the dash-rail
 * point that lands on the chassis `dashRail` anchor. The slab hangs just
 * below and behind it (-y is toward the driver). The cluster sits on the
 * driver side per the `position` module (left-hand drive = -x).
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

export const VEH_DASH_FAMILIES = {
  slabCluster: { form: 'slab', cluster: 'binnacle', position: 'left' },
  vintageGauges: { form: 'slab', cluster: 'roundGauges', position: 'left' },
  sportBinnacle: { form: 'wrap', cluster: 'binnacle', position: 'left' },
};

export const VEH_DASH_MODULES = {
  form: ['slab', 'wrap'],
  cluster: ['binnacle', 'roundGauges'],
  position: ['left', 'right'],
};

const FAMILY_IDS = Object.keys(VEH_DASH_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) modules.form = pick(rng, VEH_DASH_MODULES.form);
  modules.cluster = pick(rng, VEH_DASH_MODULES.cluster);
  return modules; // position is a driving-convention choice, never randomized
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

function extrude(id, from, to, profile, tint) {
  return {
    id,
    axisFrom: { x: round3(from[0]), y: round3(from[1]), z: round3(from[2]) },
    axisTo: { x: round3(to[0]), y: round3(to[1]), z: round3(to[2]) },
    profile,
    tint,
  };
}

const yzPoints = (points) => ({ points: points.map(([y, z]) => [round3(y), round3(z)]) });

/**
 * Resolve a seeded dash recipe. Options mirror the veh-* shelf: `family`
 * (slabCluster, vintageGauges, sportBinnacle), `palette`, `colors`, `seed`,
 * `overrides` (e.g. `{ position:'right' }` for RHD), `randomize`, `title`.
 */
export function resolveVehDashRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-dash');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_DASH_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-dash family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-dash');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const driverX = modules.position === 'right' ? 1.0 : -1.0;
  const halfW = 1.6;
  // slab profile in (y,z): a raked pad hanging below/behind the rail point
  const slabProfile = modules.form === 'wrap'
    ? yzPoints([[0.05, 0.1], [-0.42, -0.05], [-0.3, -0.5], [0.05, -0.42]])
    : yzPoints([[0.05, 0.08], [-0.34, 0.02], [-0.34, -0.44], [0.05, -0.44]]);
  const extrudes = [
    extrude('dash_slab', [-halfW, 0, 0], [halfW, 0, 0], slabProfile, C.trim),
  ];
  const lathes = [];
  if (modules.cluster === 'binnacle') {
    extrudes.push(extrude('cluster_binnacle', [driverX - 0.38, 0, 0], [driverX + 0.38, 0, 0], yzPoints([
      [-0.3, 0.06], [-0.56, 0.02], [-0.5, 0.34], [-0.28, 0.3],
    ]), C.paint));
  } else {
    for (const [i, dx] of [[0, -0.24], [1, 0.24]]) {
      lathes.push(lathe(`gauge_${i}`, [driverX + dx, -0.34, -0.05], [driverX + dx, -0.44, -0.05], [
        { t: 0, radius: 0.05 },
        { t: 0.3, radius: 0.16 },
        { t: 1, radius: 0.04 },
      ], C.glass));
    }
  }
  return {
    kind: 'workbench',
    title: title || `veh-dash ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    ...(lathes.length ? { lathes } : {}),
    extrudes,
    garage: {
      kind: 'veh-dash',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: { width: halfW * 2, depth: 0.6, height: 0.6 },
      localFrame: { forward: '+y', up: '+z', driver: modules.position === 'right' ? '+x' : '-x' },
      mountFamily: 'rail-mount',
      hardpoints: { mount: [0, 0, 0] },
    },
  };
}

export function generateVehDashVariants({ count = 4, seed = 'veh-dash', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehDashRecipe({
    family, palette, colors, overrides, randomize, seed: `${seed}:${i}`,
  }));
}

export function listVehDashLanguage() {
  return {
    families: clone(VEH_DASH_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_DASH_MODULES),
  };
}
