/**
 * veh-chassis — composable, seeded chassis/platform recipes for the vehicle
 * designer. The ROOT part of a veh-* build (vehicle-designer.plan.md V2):
 * every other component seats on it, and `veh-garage.js` derives all mount
 * sockets from its geometry (axle stubs found by axis direction, sides by
 * position — never by id).
 *
 * Local frame: +y forward of travel, +z up, +x right. The chassis is
 * authored at ride height — axle stub centerlines at z = dims.wheelRadius —
 * so a standard wheel seated on a hub socket touches the ground at z=0.
 * Standalone previews float at ride height by design (planWorkbench will
 * warn; the wheels are what hold a chassis up).
 *
 * Shelf rule inherited from veh-wheel: every outward-visible lathe end
 * self-closes (taper to r≈0.05) — the scene still drops flat end caps.
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

export const VEH_CHASSIS_FAMILIES = {
  ladderFrame: {
    frame: 'ladder',
    wheelbase: 'long',
    track: 'standard',
    rideHeight: 'high',
    crossmembers: 'heavy',
    nose: 'engine',
  },
  unibodyPan: {
    frame: 'unibody',
    wheelbase: 'standard',
    track: 'standard',
    rideHeight: 'standard',
    crossmembers: 'light',
    nose: 'engine',
  },
  sportPan: {
    frame: 'unibody',
    wheelbase: 'short',
    track: 'wide',
    rideHeight: 'low',
    crossmembers: 'light',
    nose: 'engine',
  },
  towedFrame: {
    frame: 'ladder',
    wheelbase: 'short',
    track: 'standard',
    rideHeight: 'standard',
    crossmembers: 'heavy',
    nose: 'tongue',
  },
};

export const VEH_CHASSIS_MODULES = {
  frame: ['ladder', 'unibody'],
  wheelbase: ['short', 'standard', 'long'],
  track: ['narrow', 'standard', 'wide'],
  rideHeight: ['low', 'standard', 'high'],
  crossmembers: ['light', 'heavy'],
  nose: ['engine', 'tongue'],
};

const FAMILY_IDS = Object.keys(VEH_CHASSIS_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);

const WHEELBASES = { short: 6.5, standard: 8.0, long: 9.5 };
const TRACKS = { narrow: 4.2, standard: 4.9, wide: 5.6 };
const CLEARANCES = { low: 0.15, standard: 0.35, high: 0.6 };
const WHEEL_RADIUS = 1.0; // the standard veh-wheel; hub sockets sit at this z

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) {
    modules.frame = pick(rng, VEH_CHASSIS_MODULES.frame);
  }
  modules.wheelbase = pick(rng, VEH_CHASSIS_MODULES.wheelbase);
  modules.track = pick(rng, VEH_CHASSIS_MODULES.track);
  modules.rideHeight = modules.frame === 'ladder'
    ? pick(rng, ['standard', 'high'])
    : pick(rng, VEH_CHASSIS_MODULES.rideHeight);
  modules.crossmembers = pick(rng, VEH_CHASSIS_MODULES.crossmembers);
  return modules;
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

const rect = (w, h, r = 0.05) => ({ rect: { w: round3(w), h: round3(h), r: round3(Math.min(r, w / 2, h / 2)) } });

function dimensions(modules) {
  const wheelbase = WHEELBASES[modules.wheelbase];
  const track = TRACKS[modules.track];
  const clearance = CLEARANCES[modules.rideHeight];
  const hubZ = WHEEL_RADIUS;
  const railZ = hubZ + clearance; // underside of the frame plane
  const frontOverhang = modules.nose === 'engine' ? 1.2 : 0.6;
  const rearOverhang = 1.4;
  return {
    wheelbase,
    track,
    clearance,
    hubZ,
    railZ,
    wheelRadius: WHEEL_RADIUS,
    frontY: wheelbase / 2,
    rearY: -wheelbase / 2,
    noseY: wheelbase / 2 + frontOverhang,
    tailY: -wheelbase / 2 - rearOverhang,
    length: wheelbase + frontOverhang + rearOverhang,
    width: track + 0.5,
  };
}

// Four axle stubs — the ONLY x-axis lathes on a chassis, which is how
// veh-garage finds them. Outer ends self-close at the hub.
function axleStubs(D, C, innerX) {
  const stubProfile = [
    { t: 0, radius: 0.05 },
    { t: 0.15, radius: 0.14 },
    { t: 0.85, radius: 0.14 },
    { t: 1, radius: 0.05 },
  ];
  const stub = (id, sideSign, y) => lathe(
    id,
    [sideSign * innerX, y, D.hubZ],
    [sideSign * (D.track / 2), y, D.hubZ],
    stubProfile,
    C.trim,
  );
  // ids deliberately carry NO reliable side/axle meaning — position is truth
  return [
    stub('axle_stub_a', 1, D.frontY),
    stub('axle_stub_b', -1, D.frontY),
    stub('axle_stub_c', 1, D.rearY),
    stub('axle_stub_d', -1, D.rearY),
  ];
}

function ladderMonomers(D, C, modules) {
  const railX = 0.9;
  const railH = 0.42;
  const railZc = D.railZ + railH / 2;
  const parts = [
    extrude('rail_a', [-railX, D.tailY, railZc], [-railX, D.noseY, railZc], rect(0.28, railH, 0.04), C.trim),
    extrude('rail_b', [railX, D.tailY, railZc], [railX, D.noseY, railZc], rect(0.28, railH, 0.04), C.trim),
  ];
  const crossCount = modules.crossmembers === 'heavy' ? 4 : 3;
  const crossH = modules.crossmembers === 'heavy' ? 0.3 : 0.22;
  for (let i = 0; i < crossCount; i += 1) {
    const y = D.tailY + 0.8 + ((D.noseY - D.tailY - 1.6) * i) / (crossCount - 1);
    parts.push(extrude(`crossmember_${i}`, [-railX - 0.14, y, railZc], [railX + 0.14, y, railZc], rect(crossH, crossH, 0.03), C.trim));
  }
  if (modules.nose === 'engine') {
    parts.push(extrude('bumper_front', [-D.track / 2 + 0.3, D.noseY + 0.1, railZc], [D.track / 2 - 0.3, D.noseY + 0.1, railZc], rect(0.35, 0.3, 0.08), C.chrome));
  }
  parts.push(extrude('bumper_rear', [-D.track / 2 + 0.3, D.tailY - 0.1, railZc], [D.track / 2 - 0.3, D.tailY - 0.1, railZc], rect(0.35, 0.3, 0.08), C.chrome));
  return { extrudes: parts, lathes: axleStubs(D, C, railX), sweeps: tongueSweeps(D, C, modules, railX, railZc) };
}

function tongueSweeps(D, C, modules, railX, railZc) {
  if (modules.nose !== 'tongue') return [];
  const hitchY = D.noseY + 1.6;
  return [
    { id: 'tongue_a', path: [[-railX, D.noseY, railZc], [0, hitchY, railZc]].map((p) => p.map(round3)), radius: 0.12, tint: C.trim, sides: 8 },
    { id: 'tongue_b', path: [[railX, D.noseY, railZc], [0, hitchY, railZc]].map((p) => p.map(round3)), radius: 0.12, tint: C.trim, sides: 8 },
  ];
}

function hitchBall(D, C, modules, railZc) {
  if (modules.nose !== 'tongue') return [];
  const hitchY = D.noseY + 1.6;
  return [lathe('hitch_ball', [0, hitchY, railZc + 0.1], [0, hitchY, railZc + 0.46], [
    { t: 0, radius: 0.05 },
    { t: 0.3, radius: 0.07 },
    { t: 0.6, radius: 0.16 },
    { t: 1, radius: 0.04 },
  ], C.chrome)];
}

function unibodyMonomers(D, C, modules) {
  const panW = D.track - 1.2;
  const panZ = D.railZ;
  const sillX = D.track / 2 - 0.6;
  const parts = [];
  // floor pan — a thin slab extruded upward, profile in the (x,y) plane
  parts.push(extrude('floor_pan', [0, 0, panZ], [0, 0, panZ + 0.12], { points: [
    [-panW / 2, D.tailY + 0.6], [panW / 2, D.tailY + 0.6], [panW / 2, D.frontY - 0.4], [-panW / 2, D.frontY - 0.4],
  ].map(([x, y]) => [round3(x), round3(y)]) }, C.paint));
  // center tunnel
  parts.push(extrude('center_tunnel', [0, 0, panZ + 0.12], [0, 0, panZ + 0.4], { points: [
    [-0.35, D.rearY + 0.4], [0.35, D.rearY + 0.4], [0.35, D.frontY - 0.4], [-0.35, D.frontY - 0.4],
  ].map(([x, y]) => [round3(x), round3(y)]) }, C.paint));
  // rocker sills
  parts.push(extrude('sill_a', [-sillX, D.rearY + 0.3, panZ + 0.2], [-sillX, D.frontY - 0.3, panZ + 0.2], rect(0.35, 0.5, 0.08), C.paint));
  parts.push(extrude('sill_b', [sillX, D.rearY + 0.3, panZ + 0.2], [sillX, D.frontY - 0.3, panZ + 0.2], rect(0.35, 0.5, 0.08), C.paint));
  // subframe rails, front + rear
  const subX = 1.1;
  parts.push(extrude('subframe_front_a', [-subX, D.frontY - 0.5, panZ + 0.1], [-subX, D.noseY, panZ + 0.1], rect(0.3, 0.35, 0.04), C.trim));
  parts.push(extrude('subframe_front_b', [subX, D.frontY - 0.5, panZ + 0.1], [subX, D.noseY, panZ + 0.1], rect(0.3, 0.35, 0.04), C.trim));
  parts.push(extrude('subframe_rear_a', [-subX, D.tailY, panZ + 0.1], [-subX, D.rearY + 0.5, panZ + 0.1], rect(0.3, 0.35, 0.04), C.trim));
  parts.push(extrude('subframe_rear_b', [subX, D.tailY, panZ + 0.1], [subX, D.rearY + 0.5, panZ + 0.1], rect(0.3, 0.35, 0.04), C.trim));
  const crossCount = modules.crossmembers === 'heavy' ? 3 : 2;
  for (let i = 0; i < crossCount; i += 1) {
    const y = D.rearY + 0.8 + ((D.wheelbase - 1.6) * i) / (crossCount - 1);
    parts.push(extrude(`crossmember_${i}`, [-panW / 2, y, panZ - 0.1], [panW / 2, y, panZ - 0.1], rect(0.2, 0.18, 0.03), C.trim));
  }
  return { extrudes: parts, lathes: axleStubs(D, C, subX), sweeps: [] };
}

/**
 * Resolve a seeded chassis recipe.
 *
 * Options:
 * - `family`: ladderFrame, unibodyPan, sportPan, towedFrame; omitted = seeded pick.
 * - `palette`: factorySteel, chromeAlloy, vintageCream, murderedOut, or `{ base, ...colors }`; omitted = seeded pick.
 * - `colors`: partial role override (`paint`, `trim`, `glass`, `rubber`, `chrome`, `light`).
 * - `randomize`: when true, vary secondary modules from the seed while keeping explicit overrides.
 * - `seed`: number or string, deterministic.
 * - `overrides`: partial module overrides, e.g. `{ wheelbase:'long', rideHeight:'low' }`.
 */
export function resolveVehChassisRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-chassis');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_CHASSIS_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-chassis family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-chassis');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const D = dimensions(modules);
  const built = modules.frame === 'ladder' ? ladderMonomers(D, C, modules) : unibodyMonomers(D, C, modules);
  const railZc = D.railZ + 0.21;
  const lathes = [...built.lathes, ...hitchBall(D, C, modules, railZc)];
  return {
    kind: 'workbench',
    title: title || `veh-chassis ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    lathes,
    extrudes: built.extrudes,
    ...(built.sweeps.length ? { sweeps: built.sweeps } : {}),
    garage: {
      kind: 'veh-chassis',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: {
        wheelbase: round3(D.wheelbase),
        track: round3(D.track),
        clearance: round3(D.clearance),
        hubZ: round3(D.hubZ),
        wheelRadius: round3(D.wheelRadius),
        length: round3(D.length),
        width: round3(D.width),
      },
      localFrame: { forward: '+y', up: '+z', right: '+x' },
      mountFamily: null, // the chassis is the root; it provides sockets
      provides: ['hub-mount', 'bay-mount', 'deck-mount', 'rail-mount', ...(modules.nose === 'tongue' ? ['hitch'] : [])],
      hardpoints: {
        origin: [0, 0, 0],
        frontAxle: [0, round3(D.frontY), round3(D.hubZ)],
        rearAxle: [0, round3(D.rearY), round3(D.hubZ)],
      },
    },
  };
}

export function generateVehChassisVariants({ count = 4, seed = 'veh-chassis', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehChassisRecipe({
    family,
    palette,
    colors,
    overrides,
    randomize,
    seed: `${seed}:${i}`,
  }));
}

export function listVehChassisLanguage() {
  return {
    families: clone(VEH_CHASSIS_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_CHASSIS_MODULES),
  };
}
