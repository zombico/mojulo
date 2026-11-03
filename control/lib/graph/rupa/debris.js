/**
 * rupa/debris.js — what a breaking leaves, deterministic in the force: the same blow on the same thing leaves the same
 * debris, and a harder blow leaves more, finer and faster. rupa is the internal name.
 *
 *   SOLIDS   fragmentsOf({ matter, box, joules, how?, from?, dir?, seed? }) → { pieces, dust, liquid?, stats }
 *            The breaking opens new crack surface: ETA_SURF (1 %) of the joules over the matter's fracture energy
 *            (`frac`, J/m²), so the mean piece is 6V over all its surface and the same joules shatter glass (8 J/m²)
 *            and only split timber (10⁴). Sizes follow Rosin–Rammler with the matter's `spread`; what falls under 2 mm
 *            is dust, a cloud. Pieces take the matter's `shape` (shards, chunks, splinters along the longest axis, torn
 *            plates, clods). A share of the joules by how it broke flies (a burst 0.3, a round 0.15, a swing 0.1, a crush
 *            0.05), away from where the blow came from, smaller pieces faster; the kinetic energy sums to that share
 *            exactly. A burn leaves ash (1 % of its mass as smoke); a melt its liquid. The runtime runs the same code
 *            (worlds/controllable/rupa.js fragments) on every break, so a World page's debris is these numbers.
 *   DIRT     dirtOf(crater, { at, joules, soil?, z?, seed? }) → { clumps, spray: { parcels, drag, settle }, cloud, stats }
 *            A crater's ejecta (rupa/ground.js crater's `ejected`) as it flies. Where it leaves the bowl sets its speed
 *            by the ejecta law (Housen–Holsapple: v = 0.6·√(gR)·(r/R)^(−1/μ), μ the soil's), at 45°. Cohesion against
 *            the stress of being thrown decides how it flies: c ÷ (c + ½ρv²) of it holds as CLUMPS (lumps from the rim,
 *            none from a dry sand; a clump landing faster than √(2c/ρ) crumbles), the rest is SPRAY, grains whose drag is
 *            g over their settling speed (sand far, silt at once), and a share of its fines hangs as a DUST cloud. They
 *            weigh what the ejecta does; their energy stays under a quarter of the charge's.
 *   LIQUIDS  splashOf({ liquid, at, speed, mass, size, seed? }) → { droplets, cavity, plop, stats }
 *            A body meeting a liquid opens a cavity (gravity regime) and splashes when Mundo's √We·Re^¼ passes 57.7;
 *            how much flies is scaled by inertia over viscosity, so water splashes, honey gloops and lava plops.
 */
import { MATTER, resolveMatter, isLiquid, isSoil, blockMatter } from './matter.js';
import { rupaPhysics } from './index.js';

const G = 9.81;
const vol = (b) => [0, 1, 2].reduce((a, k) => a * Math.max(0, b.max[k] - b.min[k]), 1);

export function fragmentsOf({ matter, box, joules, how = 'call', from = null, dir = null, seed } = {}) {
  if (!box || !Array.isArray(box.min) || !Array.isArray(box.max)) throw new Error('debris: box is { min, max }');
  const b = blockMatter(box, matter, 'debris.matter');
  if (!(Number.isFinite(joules) && joules >= 0)) throw new Error('debris: joules is what the breaking took, 0 or more');
  return rupaPhysics.fragments(box, { density: b.mass / Math.max(1e-12, vol(box) * b.fill), fill: b.fill, frac: b.frac, shape: b.shape, spread: b.spread,
    joules: Math.max(joules, b.joules), how, from, dir, seed: seed ?? rupaPhysics.seedOf(`${b.matter}:${box.min.join(',')}`, Math.round(joules)) });
}

export function splashOf({ liquid = 'water', at, speed, mass, size, seed } = {}) {
  const m = resolveMatter(liquid, 'splash.liquid');
  if (!isLiquid(m)) throw new Error(`splash: ${m.id} is not a liquid`);
  return rupaPhysics.splash(m, { at, speed, mass, size, seed: seed ?? rupaPhysics.seedOf(m.id, Math.round(speed * 1000 + mass)) });
}

// a grain's settling speed in air: Stokes for the fine, Newton's drag (Cd 0.44) for the coarse, whichever is slower;
// the runtime's own law (rupaPhysics.settleOf), so the dust a page draws settles as the debris here does
export function settleSpeed(d, particle = 2650) { return rupaPhysics.settleOf(d, particle); }
const AIRBORNE = 0.03;   // the share of the fines that hangs as a cloud; the rest falls with the spray
const cloudRadius = (kg) => Math.cbrt((3 * (kg / 0.01)) / (4 * Math.PI));

/**
 * A crater's ejecta as it flies: CLUMPS, SPRAY and DUST. The ejecta (its bank mass: the loose volume over the swell)
 * leaves in packets from across the bowl, each at the speed the ejecta law gives where it leaves. In each packet the
 * soil's cohesion against the stress of being thrown decides what holds: the share c ÷ (c + ½ρv²) stays a clump (none
 * for a dry sand; the rim's slow soil in lumps, the middle's fast soil torn apart), and a clump that lands faster than
 * √(2c/ρ) crumbles. The torn soil flies as grains (`grain`): their drag is g over their settling speed, so sand flies
 * far and a silty loam slows at once. Of its fines a share hangs as a dust cloud; the rest falls with the spray. The
 * clumps, the spray and the cloud weigh what the ejecta does; their energy stays under a quarter of the charge's.
 */
export function dirtOf(crater, { at, joules, soil = 'loam', z = 0, seed, packets = 48 } = {}) {
  const m = resolveMatter(soil, 'dirt.soil');
  if (!isSoil(m)) throw new Error(`dirt: ${m.id} is not a soil`);
  const R = crater && crater.radius, Ve = crater && crater.ejected;
  const empty = { clumps: [], spray: { parcels: [], drag: 0, settle: 0, grain: m.grain }, cloud: null, stats: { kg: 0, kinetic: 0, clumpKg: 0, sprayKg: 0, cloudKg: 0 } };
  if (!(R > 0) || !(Ve > 0)) return empty;
  let a = (seed ?? rupaPhysics.seedOf(`${m.id}:${at.join(',')}`, Math.round(joules))) >>> 0;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const M = (Ve * m.density) / m.swell, each = M / packets, mu = m.mu ?? 0.45, c = m.c ?? 0;
  const vt = settleSpeed(m.grain ?? 0.0003, m.particle ?? 2650), drag = G / vt, crumble = Math.sqrt((2 * c) / m.density);
  const clumps = [], parcels = [];
  let cloudKg = 0;
  for (let i = 0; i < packets; i++) {
    const rr = R * Math.sqrt(0.09 + 0.91 * r()), az = ((i + r()) / packets) * 2 * Math.PI, el = ((45 + (r() - 0.5) * 12) * Math.PI) / 180;
    const v = 0.6 * Math.sqrt(G * R) * Math.pow(rr / R, -1 / mu), from = [at[0] + Math.cos(az) * rr, at[1] + Math.sin(az) * rr, z];
    const dirOf = (daz, del) => [Math.cos(el + del) * Math.cos(az + daz), Math.cos(el + del) * Math.sin(az + daz), Math.sin(el + del)];
    const hold = c > 0 ? c / (c + 0.5 * m.density * v * v) : 0, clumpKg = each * hold, torn = each - clumpKg;
    if (clumpKg > 0) {
      // the clump in one to three lumps, each its own shape (a seed for the page's lumpiness)
      const n = 1 + Math.floor(r() * 3), shares = Array.from({ length: n }, () => 0.5 + r()), sum = shares.reduce((x, y) => x + y, 0);
      shares.forEach((sh) => {
        const kg = (clumpKg * sh) / sum, speed = v * (0.9 + 0.2 * r()), d = dirOf((r() - 0.5) * 0.12, (r() - 0.5) * 0.08);
        clumps.push({ at: [...from], vel: d.map((x) => x * speed), kg, size: Math.cbrt(kg / m.density), lump: Math.floor(r() * 2 ** 31), crumbles: speed > crumble });
      });
    }
    const fines = torn * (m.fines ?? 0), airborne = fines * AIRBORNE;
    cloudKg += airborne;
    const sprayKg = torn - airborne;
    if (sprayKg > 0) for (let k = 0; k < 3; k++) {
      const speed = v * (0.75 + 0.5 * r()), d = dirOf((r() - 0.5) * 0.3, (r() - 0.5) * 0.25);
      parcels.push({ at: [...from], vel: d.map((x) => x * speed), kg: sprayKg / 3 });
    }
  }
  // the energy cap: a quarter of the charge's at most, the speeds scaled down together
  const ke = (list) => list.reduce((s2, p) => s2 + 0.5 * p.kg * (p.vel[0] ** 2 + p.vel[1] ** 2 + p.vel[2] ** 2), 0);
  let Ek = ke(clumps) + ke(parcels);
  const cap = 0.25 * joules;
  if (Ek > cap) { const k = Math.sqrt(cap / Ek); for (const p of [...clumps, ...parcels]) p.vel = p.vel.map((x) => x * k); Ek = cap; }
  const clumpKg = clumps.reduce((s2, p) => s2 + p.kg, 0), sprayKg = parcels.reduce((s2, p) => s2 + p.kg, 0);
  return {
    clumps,
    spray: { parcels, drag, settle: vt, grain: m.grain },
    cloud: cloudKg > 1e-6 ? { kg: cloudKg, at: [at[0], at[1], z + 0.5], radius: cloudRadius(cloudKg), life: 6 + cloudRadius(cloudKg), settle: settleSpeed(2e-5, m.particle ?? 2650) } : null,
    stats: { kg: clumpKg + sprayKg + cloudKg, bank: M, kinetic: Ek, clumpKg, sprayKg, cloudKg, crumbleSpeed: crumble },
  };
}
