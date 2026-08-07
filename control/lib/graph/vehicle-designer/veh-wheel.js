/**
 * veh-wheel — composable, seeded road-wheel recipes for the vehicle designer.
 *
 * First part module of the veh-* shelf (vehicle-designer.plan.md V1). The
 * output is a deterministic workbench manifest: the tire and rim are lathes
 * revolved around the axle (local ±x), spokes and lug hardware are shallow
 * outboard extrudes. Wheels attach to a chassis hub socket via the `garage`
 * block (`mountFamily: 'hub-mount'`, `hardpoints.hubCenter`).
 *
 * Local frame: axle along x (outboard face = +x), +y forward of travel,
 * +z up. The wheel is authored resting on the grid: contact patch at z=0,
 * hub at z=radius (`hardpoints.hubCenter`), so a standalone preview sits on
 * the studio floor and a chassis hub socket can seat it without a lift.
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

export { VEH_COLOR_ROLES };
export const VEH_WHEEL_PALETTES = VEH_PALETTES;

export const VEH_WHEEL_FAMILIES = {
  steelie: {
    rimStyle: 'steel',
    size: 'standard',
    sidewall: 'standard',
    hub: 'domeCap',
    sidewallBand: 'plain',
  },
  fiveSpokeAlloy: {
    rimStyle: 'fiveSpoke',
    size: 'standard',
    sidewall: 'lowProfile',
    hub: 'centerNut',
    sidewallBand: 'plain',
  },
  wireVintage: {
    rimStyle: 'wire',
    size: 'tall',
    sidewall: 'tall',
    hub: 'spinner',
    sidewallBand: 'whitewall',
  },
  heavyDuty: {
    rimStyle: 'deepDish',
    size: 'heavy',
    sidewall: 'tall',
    hub: 'lugRing',
    sidewallBand: 'plain',
  },
};

export const VEH_WHEEL_MODULES = {
  rimStyle: ['steel', 'fiveSpoke', 'wire', 'deepDish'],
  size: ['compact', 'standard', 'tall', 'heavy'],
  sidewall: ['lowProfile', 'standard', 'tall'],
  hub: ['domeCap', 'centerNut', 'spinner', 'lugRing'],
  sidewallBand: ['plain', 'whitewall'],
};

const FAMILY_IDS = Object.keys(VEH_WHEEL_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_WHEEL_PALETTES);

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) {
    modules.rimStyle = pick(rng, VEH_WHEEL_MODULES.rimStyle);
    modules.size = pick(rng, VEH_WHEEL_MODULES.size);
  }
  modules.sidewall = modules.rimStyle === 'fiveSpoke'
    ? pick(rng, ['lowProfile', 'standard'])
    : modules.rimStyle === 'wire' || modules.rimStyle === 'deepDish'
      ? pick(rng, ['standard', 'tall'])
      : pick(rng, VEH_WHEEL_MODULES.sidewall);
  modules.hub = pick(rng, VEH_WHEEL_MODULES.hub);
  modules.sidewallBand = pick(rng, VEH_WHEEL_MODULES.sidewallBand);
  return modules;
}

function lathe(id, x0, x1, profile, tint) {
  return {
    id,
    axisFrom: { x: round3(x0), y: 0, z: 0 },
    axisTo: { x: round3(x1), y: 0, z: 0 },
    profile: profile.map(({ t, radius }) => ({ t: round3(t), radius: round3(radius) })),
    tint,
  };
}

function extrudeX(id, x0, x1, points, tint) {
  return {
    id,
    axisFrom: { x: round3(x0), y: 0, z: 0 },
    axisTo: { x: round3(x1), y: 0, z: 0 },
    profile: { points: points.map(([u, v]) => [round3(u), round3(v)]) },
    tint,
  };
}

// A slim radial bar in the outboard face plane, rotated to `angle` — one spoke.
function spokePoints(r0, r1, halfWidth, angle) {
  const dir = [Math.cos(angle), Math.sin(angle)];
  const perp = [-dir[1], dir[0]];
  const corner = (r, s) => [dir[0] * r + perp[0] * s, dir[1] * r + perp[1] * s];
  return [corner(r0, -halfWidth), corner(r1, -halfWidth), corner(r1, halfWidth), corner(r0, halfWidth)];
}

function dimensions(size) {
  if (size === 'compact') return { radius: 0.85, width: 0.5 };
  if (size === 'tall') return { radius: 1.15, width: 0.62 };
  if (size === 'heavy') return { radius: 1.35, width: 0.85 };
  return { radius: 1.0, width: 0.6 };
}

function rimRadius(sidewall, radius) {
  if (sidewall === 'lowProfile') return radius * 0.62;
  if (sidewall === 'tall') return radius * 0.45;
  return radius * 0.55;
}

// Every outward-visible lathe end SELF-CLOSES (taper to r≈0.05) — the scene
// still drops flat end caps, so a near-constant-radius lathe reads as an
// open hoop. A "disc" here is a short cone closing to the axis.
function tire(dims, C) {
  const { radius: R, width: w } = dims;
  return lathe('tire', -w / 2, w / 2, [
    { t: 0, radius: 0.05 },
    { t: 0.03, radius: R * 0.86 },
    { t: 0.1, radius: R * 0.97 },
    { t: 0.28, radius: R },
    { t: 0.72, radius: R },
    { t: 0.9, radius: R * 0.97 },
    { t: 0.97, radius: R * 0.86 },
    { t: 1, radius: 0.05 },
  ], C.rubber);
}

function sidewallBand(kind, dims, C) {
  if (kind !== 'whitewall') return [];
  const { radius: R, width: w } = dims;
  return [lathe('sidewall_band', w / 2 + 0.005, w / 2 + 0.02, [
    { t: 0, radius: R * 0.78 },
    { t: 1, radius: 0.05 },
  ], C.trim)];
}

function rim(style, dims, rimR, C) {
  const { width: w } = dims;
  const barrelTint = style === 'steel' ? C.paint : C.chrome;
  const faceTint = style === 'steel' ? C.paint
    : style === 'deepDish' ? C.chrome
      : C.trim;
  const faceOut = w / 2 + 0.04;
  const parts = [
    lathe('rim_barrel', -w * 0.35, faceOut - 0.02, [
      { t: 0, radius: 0.05 },
      { t: 0.08, radius: rimR * 0.9 },
      { t: 0.85, radius: rimR },
      { t: 1, radius: rimR * 0.98 },
    ], barrelTint),
    lathe('rim_face', faceOut - 0.02, faceOut, [
      { t: 0, radius: rimR },
      { t: 1, radius: 0.05 },
    ], faceTint),
  ];
  if (style === 'deepDish') {
    // The dish reads as a proud chrome lip (rim_face) around a darker
    // center plate — a recessed face would hide behind the closed tire.
    parts.push(lathe('dish_center', faceOut + 0.01, faceOut + 0.03, [
      { t: 0, radius: rimR * 0.58 },
      { t: 1, radius: 0.05 },
    ], C.paint));
  }
  return parts;
}

function spokes(style, dims, rimR, C) {
  const { width: w } = dims;
  const faceX = w / 2 + 0.04;
  if (style === 'fiveSpoke') {
    return Array.from({ length: 5 }, (_, i) => extrudeX(
      `spoke_${i}`,
      faceX,
      faceX + 0.07,
      spokePoints(rimR * 0.18, rimR * 0.9, rimR * 0.11, (i / 5) * Math.PI * 2 + Math.PI / 2),
      C.chrome,
    ));
  }
  if (style === 'wire') {
    return Array.from({ length: 8 }, (_, i) => extrudeX(
      `wire_spoke_${i}`,
      faceX,
      faceX + 0.04,
      spokePoints(rimR * 0.14, rimR * 0.92, rimR * 0.035, (i / 8) * Math.PI * 2 + Math.PI / 8),
      C.chrome,
    ));
  }
  return [];
}

function hub(kind, dims, rimR, C) {
  const { width: w } = dims;
  const faceX = kind === 'lugRing' ? w / 2 + 0.08 : w / 2 + 0.04;
  if (kind === 'domeCap') {
    return {
      lathes: [lathe('hub_dome_cap', faceX + 0.02, faceX + 0.2, [
        { t: 0, radius: rimR * 0.42 },
        { t: 0.6, radius: rimR * 0.34 },
        { t: 1, radius: 0.02 },
      ], C.chrome)],
      extrudes: [],
    };
  }
  if (kind === 'centerNut') {
    return {
      lathes: [lathe('hub_center_nut', faceX + 0.06, faceX + 0.16, [
        { t: 0, radius: rimR * 0.16 },
        { t: 0.8, radius: rimR * 0.14 },
        { t: 1, radius: 0.04 },
      ], C.chrome)],
      extrudes: [],
    };
  }
  if (kind === 'spinner') {
    const ear = (i) => extrudeX(
      `spinner_ear_${i}`,
      faceX + 0.14,
      faceX + 0.19,
      spokePoints(0.03, rimR * 0.34, rimR * 0.05, (i / 3) * Math.PI * 2 + Math.PI / 2),
      C.chrome,
    );
    return {
      lathes: [lathe('spinner_dome', faceX + 0.02, faceX + 0.18, [
        { t: 0, radius: rimR * 0.3 },
        { t: 1, radius: 0.02 },
      ], C.chrome)],
      extrudes: [ear(0), ear(1), ear(2)],
    };
  }
  // lugRing — six lug nuts around a stub cap, recessed into the deep dish.
  const lugs = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    const r = rimR * 0.38;
    return extrudeX(
      `lug_nut_${i}`,
      faceX + 0.02,
      faceX + 0.1,
      spokePoints(r - 0.055, r + 0.055, 0.055, a),
      C.chrome,
    );
  });
  return {
    lathes: [lathe('hub_stub_cap', faceX + 0.02, faceX + 0.12, [
      { t: 0, radius: rimR * 0.18 },
      { t: 0.8, radius: rimR * 0.15 },
      { t: 1, radius: 0.04 },
    ], C.chrome)],
    extrudes: lugs,
  };
}

/**
 * Resolve a seeded road-wheel recipe.
 *
 * Options:
 * - `family`: steelie, fiveSpokeAlloy, wireVintage, heavyDuty; omitted = seeded pick.
 * - `palette`: factorySteel, chromeAlloy, vintageCream, murderedOut, or `{ base, ...colors }`; omitted = seeded pick.
 * - `colors`: partial role override (`paint`, `trim`, `glass`, `rubber`, `chrome`, `light`).
 * - `randomize`: when true, vary secondary modules from the seed while keeping explicit overrides.
 * - `seed`: number or string, deterministic.
 * - `overrides`: partial module overrides, e.g. `{ hub:'spinner', sidewallBand:'whitewall' }`.
 */
export function resolveVehWheelRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-wheel');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_WHEEL_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-wheel family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pickedFamily === 'wireVintage' ? 'vintageCream' : pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-wheel');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const dims = dimensions(modules.size);
  const rimR = rimRadius(modules.sidewall, dims.radius);
  const hubParts = hub(modules.hub, dims, rimR, C);
  // Lift the whole wheel so the contact patch sits on the grid (hub at z=radius).
  const lift = (m) => ({
    ...m,
    axisFrom: { ...m.axisFrom, z: round3(m.axisFrom.z + dims.radius) },
    axisTo: { ...m.axisTo, z: round3(m.axisTo.z + dims.radius) },
  });
  const lathes = [
    tire(dims, C),
    ...sidewallBand(modules.sidewallBand, dims, C),
    ...rim(modules.rimStyle, dims, rimR, C),
    ...hubParts.lathes,
  ].map(lift);
  const extrudes = [
    ...spokes(modules.rimStyle, dims, rimR, C),
    ...hubParts.extrudes,
  ].map(lift);
  return {
    kind: 'workbench',
    title: title || `veh-wheel ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    lathes,
    ...(extrudes.length ? { extrudes } : {}),
    garage: {
      kind: 'veh-wheel',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: { radius: round3(dims.radius), width: round3(dims.width) },
      localFrame: { axle: 'x', outboard: '+x', forward: '+y', up: '+z' },
      mountFamily: 'hub-mount',
      hardpoints: {
        hubCenter: [0, 0, round3(dims.radius)],
        contactPatch: [0, 0, 0],
      },
    },
  };
}

export function generateVehWheelVariants({ count = 4, seed = 'veh-wheel', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehWheelRecipe({
    family,
    palette,
    colors,
    overrides,
    randomize,
    seed: `${seed}:${i}`,
  }));
}

export function listVehWheelLanguage() {
  return {
    families: clone(VEH_WHEEL_FAMILIES),
    palettes: clone(VEH_WHEEL_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_WHEEL_MODULES),
  };
}
