/**
 * veh-steering — composable, seeded steering recipes for the vehicle
 * designer (vehicle-designer.plan.md V4, a rail-mount part).
 *
 * The column and hub are lathes on the raked column axis, the rim is a
 * TRUE torus — a closed-loop sweep around the wheel circle — and spokes
 * are short sweeps from hub to rim. (An open lathe ring would drop its
 * caps in the scene still; the sweep torus stays solid from every angle.)
 *
 * Local frame: +y forward, +z up. The MOUNT is the origin — the point on
 * the dash rail the column hangs from (`planComponentFit` lands it on the
 * chassis `dashRail` anchor). The whole assembly is authored offset to the
 * driver side per the `position` module (left-hand drive = -x), and the
 * column rakes down-and-back (-y, -z) to the wheel.
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

export const VEH_STEERING_FAMILIES = {
  threeSpoke: { rimStyle: 'standard', spokes: 'three', position: 'left' },
  hornRing: { rimStyle: 'thin', spokes: 'two', position: 'left' },
  truckWheel: { rimStyle: 'wide', spokes: 'four', position: 'left' },
};

export const VEH_STEERING_MODULES = {
  rimStyle: ['standard', 'thin', 'wide'],
  spokes: ['two', 'three', 'four'],
  position: ['left', 'right'],
};

const FAMILY_IDS = Object.keys(VEH_STEERING_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);

const RIM = {
  standard: { radius: 0.42, tube: 0.05 },
  thin: { radius: 0.45, tube: 0.035 },
  wide: { radius: 0.5, tube: 0.06 },
};
const SPOKE_COUNT = { two: 2, three: 3, four: 4 };

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) modules.rimStyle = pick(rng, VEH_STEERING_MODULES.rimStyle);
  modules.spokes = pick(rng, VEH_STEERING_MODULES.spokes);
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

function sweep(id, path, radius, tint, sides = 10) {
  return { id, path: path.map((p) => p.map(round3)), radius: round3(radius), tint, sides };
}

const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

/**
 * Resolve a seeded steering recipe. Options mirror the veh-* shelf:
 * `family` (threeSpoke, hornRing, truckWheel), `palette`, `colors`, `seed`,
 * `overrides` (e.g. `{ position:'right' }` for RHD), `randomize`, `title`.
 */
export function resolveVehSteeringRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-steering');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_STEERING_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-steering family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-steering');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const rim = RIM[modules.rimStyle];
  const driverX = modules.position === 'right' ? 1.0 : -1.0;
  const root = [driverX, 0, 0]; // the rail attachment
  const axis = norm([0, -0.86, -0.5]); // column rakes down-and-back to the driver
  const wheelCenter = add(root, axis, 0.85);
  // an orthonormal basis of the wheel plane (perpendicular to the column axis)
  const u = [1, 0, 0];
  const w = norm([0, -axis[2], axis[1]]); // axis × u
  const circle = (r, n, closed = true) => {
    const pts = [];
    const count = closed ? n + 1 : n;
    for (let i = 0; i < count; i += 1) {
      const a = ((i % n) / n) * Math.PI * 2;
      pts.push(add(add(wheelCenter, u, Math.cos(a) * r), w, Math.sin(a) * r));
    }
    return pts;
  };
  const lathes = [
    lathe('steering_column', root, add(root, axis, 0.78), [
      { t: 0, radius: 0.05 },
      { t: 0.15, radius: 0.07 },
      { t: 0.85, radius: 0.07 },
      { t: 1, radius: 0.05 },
    ], C.trim),
    lathe('steering_hub', add(root, axis, 0.78), add(root, axis, 0.95), [
      { t: 0, radius: 0.05 },
      { t: 0.3, radius: 0.11 },
      { t: 1, radius: 0.04 },
    ], C.chrome),
  ];
  const sweeps = [
    sweep('steering_rim', circle(rim.radius, 16), rim.tube, C.rubber, 8),
  ];
  const n = SPOKE_COUNT[modules.spokes];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const spokeEnd = add(add(wheelCenter, u, Math.cos(a) * (rim.radius - 0.02)), w, Math.sin(a) * (rim.radius - 0.02));
    sweeps.push(sweep(`steering_spoke_${i}`, [wheelCenter, spokeEnd], 0.028, C.chrome, 8));
  }
  if (pickedFamily === 'hornRing' && overrides.hornRing !== false) {
    sweeps.push(sweep('horn_ring', circle(rim.radius * 0.55, 14), 0.02, C.chrome, 8));
  }
  return {
    kind: 'workbench',
    title: title || `veh-steering ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    lathes,
    sweeps,
    garage: {
      kind: 'veh-steering',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: { wheelRadius: round3(rim.radius), columnLength: 0.95 },
      localFrame: { forward: '+y', up: '+z', driver: modules.position === 'right' ? '+x' : '-x' },
      mountFamily: 'rail-mount',
      hardpoints: {
        mount: [0, 0, 0],
        wheelCenter: wheelCenter.map(round3),
      },
    },
  };
}

export function generateVehSteeringVariants({ count = 4, seed = 'veh-steering', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehSteeringRecipe({
    family, palette, colors, overrides, randomize, seed: `${seed}:${i}`,
  }));
}

export function listVehSteeringLanguage() {
  return {
    families: clone(VEH_STEERING_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_STEERING_MODULES),
  };
}
