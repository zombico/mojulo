/**
 * rupa/smoke-solver.js — dust and smoke solved for a whole scene: each source is read by its physics and handed the
 * script that shows it, the reason in numbers. The wind solver's sibling (wind-solver.js): the same wind, the same
 * air. rupa is the internal name.
 *
 * THE SCRIPT (the runtime's own, controllable/rupa.js puffAt, so a World page draws what this solves): a puff is a
 * formula of time. It rides the wind at its height with the gusts' exact sums; smoke rises on its heat by Briggs' plume
 * rise, Δh = 1.6·F^⅓·t^⅔·u^(−⅓) (F = g·Q / π·cp·ρ·T, its buoyancy flux) to its final rise; dust settles at its grains'
 * speed (Stokes or Newton's drag, the slower). It spreads as the air mixes it, σ = σ0 + i·u·t (i from the ground's
 * roughness), its mass deposits at its settling speed over its depth, steam's droplets evaporate, and it shows by its
 * optical depth, 1 − e^(−K·m/πσ²): the same mass fades as it spreads, so smoke is as thick as the fire is big.
 *
 * THE DECISION, source by source:
 *   PLUME   a fire: continuous and buoyant, a puff every half second while it burns, each the soot of that time (1.5 %
 *           of the fuel burnt: a wood fire, well aired) rising on the fire's heat release
 *   PUFF    a break's dust, a burst of steam: let go once
 *   HANG    a size of dust settling slower than the air stirs it (vs < i·u, u at least 1 m/s): it drifts as smoke does
 *   FALL    a size settling faster: it falls out with the debris's spray at once, and is no smoke
 *   SKIP    a source with nothing in sight: what starts too thin to see (what of it falls out is still listed)
 *
 *   solveSmoke(sources, windSpec, { floor? }) → { plumes, puffs, fallout, skipped, reasons }
 *     a source: { id, kind: 'fire', at, Q (W), fuel (kg/s), t0, t1?, radius? }
 *             | { id, kind: 'dust', at, kg, grain?: { x0, n } (Rosin–Rammler, m), particle? (kg/m³), radius?, t0 }
 *             | { id, kind: 'steam', at, kg, t0 }
 *   puffsAt(solved, windSpec, t) → [{ id, kind, pos, sigma, alpha }]: every puff in sight at t (the page's draw list)
 */
import { rupaPhysics } from './index.js';

const KINDS = ['fire', 'dust', 'steam'];

export function solveSmoke(sources, windSpec = null, { floor = 0 } = {}) {
  if (!Array.isArray(sources)) throw new Error('smokeSolver: sources is a list of { id, kind: fire | dust | steam, at, … }');
  const wind = rupaPhysics.windOf(windSpec), out = { plumes: [], puffs: [], fallout: [], skipped: [], reasons: {} };
  sources.forEach((src, i) => {
    const id = src.id ?? `source${i}`;
    if (!KINDS.includes(src.kind)) throw new Error(`smokeSolver: ${id}'s kind is ${KINDS.join(', ')}`);
    if (!Array.isArray(src.at) || src.at.length !== 3) throw new Error(`smokeSolver: ${id} needs at [x, y, z]`);
    if (src.kind === 'fire' && !(src.Q > 0)) throw new Error(`smokeSolver: ${id} is a fire: Q is its heat release, W above 0`);
    if (src.kind !== 'fire' && !(src.kg > 0)) throw new Error(`smokeSolver: ${id} needs kg above 0`);
    const S = rupaPhysics.smokeOf({ floor, t0: 0, seed: i + 1, ...src }, wind);
    out.reasons[id] = S.reasons;
    if (S.plume) out.plumes.push({ id, kind: 'smoke', ...S.plume });
    for (const p of S.puffs) out.puffs.push({ id, ...p });
    for (const f of S.fallout) out.fallout.push({ id, ...f });
    if (!S.plume && !S.puffs.length) out.skipped.push(id);   // nothing of it in sight (what falls out is the debris's)
  });
  return out;
}

export function puffsAt(solved, windSpec, t) {
  const wind = rupaPhysics.windOf(windSpec), out = [];
  for (const pl of solved.plumes) for (const q of rupaPhysics.plumePuffs(pl, wind, t)) out.push({ id: pl.id, kind: 'smoke', pos: q.pos, sigma: q.sigma, alpha: q.alpha });
  for (const p of solved.puffs) {
    if (t - p.t0 > p.life) continue;
    const q = rupaPhysics.puffAt(p, wind, t);
    if (q) out.push({ id: p.id, kind: p.kind, pos: q.pos, sigma: q.sigma, alpha: q.alpha });
  }
  return out;
}
