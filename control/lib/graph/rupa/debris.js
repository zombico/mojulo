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
 *   DIRT     dirtOf(crater, { at, joules, soil?, z?, seed? }) → { clods, stats }
 *            A crater's ejecta (rupa/ground.js crater's `ejected`) thrown as clods. Where each leaves inside the bowl
 *            sets its speed by the ejecta law (Housen–Holsapple: v = 0.6·√(gR)·(r/R)^(−1/μ), μ the soil's: 0.41 dry
 *            sand, 0.55 a cohesive clay), at 45°: the bowl's middle flies far, its edge falls near the rim. Their energy
 *            is held under a quarter of the charge's. Their volume is the ejecta's.
 *   LIQUIDS  splashOf({ liquid, at, speed, mass, size, seed? }) → { droplets, cavity, plop, stats }
 *            A body meeting a liquid opens a cavity (gravity regime) and splashes when Mundo's √We·Re^¼ passes 57.7;
 *            how much flies is scaled by inertia over viscosity, so water splashes, honey gloops and lava plops.
 */
import { resolveMatter, isLiquid, isSoil, blockMatter } from './matter.js';
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

export function dirtOf(crater, { at, joules, soil = 'loam', z = 0, seed, max = 48 } = {}) {
  const m = resolveMatter(soil, 'dirt.soil');
  if (!isSoil(m)) throw new Error(`dirt: ${m.id} is not a soil`);
  const R = crater && crater.radius, Ve = crater && crater.ejected;
  if (!(R > 0) || !(Ve > 0)) return { clods: [], stats: { count: 0, kinetic: 0 } };
  const r = (() => { let a = (seed ?? rupaPhysics.seedOf(`${m.id}:${at.join(',')}`, Math.round(joules))) >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const n = Math.max(8, Math.min(max, Math.round(Ve / 0.004))), each = Ve / n, kg = (each * m.density) / m.swell, mu = m.mu ?? 0.45;
  const clods = Array.from({ length: n }, (_, i) => {
    const rr = R * Math.sqrt(0.09 + 0.91 * r()), az = ((i + r()) / n) * 2 * Math.PI, el = ((45 + (r() - 0.5) * 10) * Math.PI) / 180;
    const v = 0.6 * Math.sqrt(G * R) * Math.pow(rr / R, -1 / mu);
    return { at: [at[0] + Math.cos(az) * rr, at[1] + Math.sin(az) * rr, z], vel: [Math.cos(el) * Math.cos(az) * v, Math.cos(el) * Math.sin(az) * v, Math.sin(el) * v], kg, size: Math.cbrt(each) };
  });
  const Ek = clods.reduce((a, c) => a + 0.5 * c.kg * (c.vel[0] ** 2 + c.vel[1] ** 2 + c.vel[2] ** 2), 0), cap = 0.25 * joules;
  if (Ek > cap) { const k = Math.sqrt(cap / Ek); for (const c of clods) c.vel = c.vel.map((x) => x * k); }
  return { clods, stats: { count: n, kinetic: Math.min(Ek, cap), volume: Ve } };
}
