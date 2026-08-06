/**
 * veh-engine — composable, seeded engine recipes for the vehicle designer
 * (vehicle-designer.plan.md V3, the first bay-mount part).
 *
 * Fidelity floor per the plan: block + head + intake — an engine is 5–9
 * monomers, not a greeble festival. The block stack is extrudes, the crank
 * pulley and velocity stacks are self-closing lathes, intake logs and
 * exhaust manifolds are sweeps.
 *
 * Local frame: +y forward of travel (pulley end), +z up. The engine is
 * authored with its MOUNT at the origin — the bottom-center of the oil pan
 * at [0,0,0] (`garage.hardpoints.mount`) — so `planComponentFit` lands it on
 * the chassis engineBay anchor and the block rises above the deck.
 * Transverse layouts turn the crank across x; the mount stays at origin.
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

export const VEH_ENGINE_FAMILIES = {
  inlineFour: {
    layout: 'inline',
    displacement: 'standard',
    intake: 'plenum',
    dress: 'dressed',
    valveCover: 'painted',
  },
  veeEight: {
    layout: 'vee',
    displacement: 'big',
    intake: 'plenum',
    dress: 'dressed',
    valveCover: 'chrome',
  },
  transverseFour: {
    layout: 'transverse',
    displacement: 'small',
    intake: 'plenum',
    dress: 'bare',
    valveCover: 'painted',
  },
  vintageStacks: {
    layout: 'vee',
    displacement: 'standard',
    intake: 'stacks',
    dress: 'dressed',
    valveCover: 'chrome',
  },
};

export const VEH_ENGINE_MODULES = {
  layout: ['inline', 'vee', 'transverse'],
  displacement: ['small', 'standard', 'big'],
  intake: ['plenum', 'stacks'],
  dress: ['bare', 'dressed'],
  valveCover: ['painted', 'chrome'],
};

const FAMILY_IDS = Object.keys(VEH_ENGINE_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);

const DISPLACEMENT_SCALE = { small: 0.85, standard: 1.0, big: 1.15 };

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) {
    modules.layout = pick(rng, VEH_ENGINE_MODULES.layout);
  }
  modules.displacement = pick(rng, VEH_ENGINE_MODULES.displacement);
  modules.intake = modules.layout === 'transverse' ? 'plenum' : pick(rng, VEH_ENGINE_MODULES.intake);
  modules.dress = pick(rng, VEH_ENGINE_MODULES.dress);
  modules.valveCover = pick(rng, VEH_ENGINE_MODULES.valveCover);
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

function sweep(id, path, radius, tint) {
  return { id, path: path.map((p) => p.map(round3)), radius: round3(radius), tint, sides: 10 };
}

const rect = (w, h, r = 0.04) => ({ rect: { w: round3(w), h: round3(h), r: round3(Math.min(r, w / 2, h / 2)) } });

// A rectangle in the (x,y) plane as explicit points (for z-axis slab extrudes).
const slab = (hw, hl) => ({ points: [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([x, y]) => [round3(x), round3(y)]) });

// A rect rotated in the (x,z) profile plane of a y-axis extrude — a vee bank.
function bankProfile(cx, cz, hw, hh, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const corner = (u, v) => [round3(cx + u * cos - v * sin), round3(cz + u * sin + v * cos)];
  return { points: [corner(-hw, -hh), corner(hw, -hh), corner(hw, hh), corner(-hw, hh)] };
}

// crank-axis unit vector: longitudinal engines run the crank along y,
// transverse along x. `along(u)` maps (crank, across) to world (x, y).
function frameFor(layout) {
  const transverse = layout === 'transverse';
  return {
    transverse,
    along: (crank, across) => (transverse ? [crank, across] : [across, crank]),
  };
}

const coverTint = (modules, C) => (modules.valveCover === 'chrome' ? C.chrome : C.paint);

function inlineMonomers(S, modules, C) {
  const L = 1.6 * S; // along the crank
  const W = 1.1 * S;
  const F = frameFor(modules.layout);
  const at = (crank, across, z) => { const [x, y] = F.along(crank, across); return [x, y, z]; };
  const slabFor = (hwAcross, hlCrank) => (F.transverse ? slab(hlCrank, hwAcross) : slab(hwAcross, hlCrank));
  const extrudes = [
    extrude('oil_pan', at(0, 0, 0), at(0, 0, 0.25 * S), slabFor(0.42 * S, 0.62 * L / 1.6), C.trim),
    extrude('block', at(0, 0, 0.25 * S), at(0, 0, 0.75 * S), slabFor(W / 2, L / 2), C.trim),
    extrude('head', at(0, 0, 0.75 * S), at(0, 0, 0.95 * S), slabFor(0.48 * S, L / 2 - 0.03), C.paint),
    extrude('valve_cover', at(0, 0, 0.95 * S), at(0, 0, 1.15 * S), slabFor(0.4 * S, L / 2 - 0.06), coverTint(modules, C)),
  ];
  const sweeps = [];
  if (modules.intake === 'plenum') {
    sweeps.push(sweep('intake_log', [at(-0.55 * L / 1.6, 0.62 * S, 0.95 * S), at(0.55 * L / 1.6, 0.62 * S, 0.95 * S)], 0.16 * S, C.trim));
  }
  const lathes = [];
  if (modules.intake === 'stacks') {
    for (let i = 0; i < 4; i += 1) {
      const crank = (-0.45 + 0.3 * i) * L / 1.6;
      lathes.push(lathe(`stack_${i}`, at(crank, 0, 1.15 * S), at(crank, 0, 1.5 * S), [
        { t: 0, radius: 0.05 },
        { t: 0.2, radius: 0.09 * S },
        { t: 0.85, radius: 0.13 * S },
        { t: 1, radius: 0.04 },
      ], C.chrome));
    }
  }
  if (modules.dress === 'dressed') {
    const pulleyFrom = at(L / 2 + 0.05, 0, 0.45 * S);
    const pulleyTo = at(L / 2 + 0.2, 0, 0.45 * S);
    lathes.push(lathe('crank_pulley', pulleyFrom, pulleyTo, [
      { t: 0, radius: 0.04 },
      { t: 0.25, radius: 0.22 * S },
      { t: 0.75, radius: 0.22 * S },
      { t: 1, radius: 0.04 },
    ], C.chrome));
    sweeps.push(sweep('exhaust_manifold', [
      at(-0.5 * L / 1.6, -0.58 * S, 0.72 * S),
      at(0, -0.7 * S, 0.6 * S),
      at(0.5 * L / 1.6, -0.58 * S, 0.72 * S),
    ], 0.1 * S, C.trim));
  }
  return { extrudes, lathes, sweeps, dims: F.transverse ? { length: 1.24 * S, width: L, height: 1.15 * S } : { length: L, width: 1.24 * S, height: 1.15 * S } };
}

function veeMonomers(S, modules, C) {
  const L = 1.5 * S;
  const extrudes = [
    extrude('oil_pan', [0, 0, 0], [0, 0, 0.25 * S], slab(0.45 * S, 0.58 * S * (L / 1.5)), C.trim),
    extrude('block_lower', [0, 0, 0.25 * S], [0, 0, 0.6 * S], slab(0.62 * S, L / 2), C.trim),
    extrude('bank_a', [0, -L / 2 + 0.03, 0], [0, L / 2 - 0.03, 0], bankProfile(-0.42 * S, 0.85 * S, 0.34 * S, 0.26 * S, 28), coverTint(modules, C)),
    extrude('bank_b', [0, -L / 2 + 0.03, 0], [0, L / 2 - 0.03, 0], bankProfile(0.42 * S, 0.85 * S, 0.34 * S, 0.26 * S, -28), coverTint(modules, C)),
  ];
  const lathes = [];
  const sweeps = [];
  if (modules.intake === 'plenum') {
    extrudes.push(extrude('valley_plenum', [0, 0, 0.85 * S], [0, 0, 1.08 * S], slab(0.24 * S, L / 2 - 0.15), C.paint));
  } else {
    for (let i = 0; i < 4; i += 1) {
      const y = -0.45 * S + (0.3 * S) * i;
      lathes.push(lathe(`stack_${i}`, [0, y, 1.0 * S], [0, y, 1.38 * S], [
        { t: 0, radius: 0.05 },
        { t: 0.2, radius: 0.09 * S },
        { t: 0.85, radius: 0.13 * S },
        { t: 1, radius: 0.04 },
      ], C.chrome));
    }
  }
  if (modules.dress === 'dressed') {
    lathes.push(lathe('crank_pulley', [0, L / 2 + 0.05, 0.4 * S], [0, L / 2 + 0.2, 0.4 * S], [
      { t: 0, radius: 0.04 },
      { t: 0.25, radius: 0.24 * S },
      { t: 0.75, radius: 0.24 * S },
      { t: 1, radius: 0.04 },
    ], C.chrome));
    for (const [id, sideSign] of [['exhaust_manifold_a', -1], ['exhaust_manifold_b', 1]]) {
      sweeps.push(sweep(id, [
        [sideSign * 0.68 * S, -0.5 * S, 0.6 * S],
        [sideSign * 0.8 * S, 0, 0.5 * S],
        [sideSign * 0.68 * S, 0.5 * S, 0.6 * S],
      ], 0.1 * S, C.trim));
    }
  }
  return { extrudes, lathes, sweeps, dims: { length: L, width: 1.6 * S, height: (modules.intake === 'stacks' ? 1.38 : 1.15) * S } };
}

/**
 * Resolve a seeded engine recipe.
 *
 * Options:
 * - `family`: inlineFour, veeEight, transverseFour, vintageStacks; omitted = seeded pick.
 * - `palette`: factorySteel, chromeAlloy, vintageCream, murderedOut, or `{ base, ...colors }`; omitted = seeded pick.
 * - `colors`: partial role override (`paint`, `trim`, `glass`, `rubber`, `chrome`, `light`).
 * - `randomize`: when true, vary secondary modules from the seed while keeping explicit overrides.
 * - `seed`: number or string, deterministic.
 * - `overrides`: partial module overrides, e.g. `{ intake:'stacks', valveCover:'chrome' }`.
 */
export function resolveVehEngineRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-engine');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_ENGINE_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-engine family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-engine');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const S = DISPLACEMENT_SCALE[modules.displacement];
  const built = modules.layout === 'vee' ? veeMonomers(S, modules, C) : inlineMonomers(S, modules, C);
  return {
    kind: 'workbench',
    title: title || `veh-engine ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    ...(built.lathes.length ? { lathes: built.lathes } : {}),
    extrudes: built.extrudes,
    ...(built.sweeps.length ? { sweeps: built.sweeps } : {}),
    garage: {
      kind: 'veh-engine',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: {
        length: round3(built.dims.length),
        width: round3(built.dims.width),
        height: round3(built.dims.height),
      },
      localFrame: { forward: '+y', up: '+z', crank: modules.layout === 'transverse' ? 'x' : 'y' },
      mountFamily: 'bay-mount',
      hardpoints: {
        mount: [0, 0, 0],
        driveOutput: modules.layout === 'transverse'
          ? [round3(-built.dims.width / 2), 0, round3(0.45 * S)]
          : [0, round3(-built.dims.length / 2), round3(0.45 * S)],
      },
    },
  };
}

export function generateVehEngineVariants({ count = 4, seed = 'veh-engine', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehEngineRecipe({
    family,
    palette,
    colors,
    overrides,
    randomize,
    seed: `${seed}:${i}`,
  }));
}

export function listVehEngineLanguage() {
  return {
    families: clone(VEH_ENGINE_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_ENGINE_MODULES),
  };
}
