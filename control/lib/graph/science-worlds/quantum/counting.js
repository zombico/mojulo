/**
 * The quantum scale's counting systems, where what the model says is the odds of each outcome and the dice are
 * seeded: a spin-½ beam through a chain of Stern–Gerlach magnets, and a batch of unstable nuclei decaying.
 * Pure and deterministic.
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A direction on the Bloch sphere: 'x', '-z', … or { theta, phi } (radians). */
export function direction(a) {
  if (typeof a === 'string') {
    const neg = a.startsWith('-'), k = a.replace(/^[-+]/, '');
    const v = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[k];
    if (!v) return null;
    return neg ? v.map((c) => -c) : v;
  }
  if (a && typeof a === 'object' && Number.isFinite(a.theta)) {
    const ph = Number.isFinite(a.phi) ? a.phi : 0;
    return [Math.sin(a.theta) * Math.cos(ph), Math.sin(a.theta) * Math.sin(ph), Math.cos(a.theta)];
  }
  return null;
}

// a spin-½ state pointing along a Bloch vector is fully described by that vector; the odds of 'up' along an axis n
// are (1 + s·n) / 2 — cos²(θ/2), θ the angle between them
const upOdds = (s, n) => (1 + s[0] * n[0] + s[1] * n[1] + s[2] * n[2]) / 2;

/**
 * Atoms through the magnets in order. Each atom's spin is measured along each magnet's axis: up with odds cos²(θ/2),
 * and it leaves pointing along (or against) that axis. A magnet that keeps one beam stops the other.
 * Returns per atom its outcomes ('up' | 'down' per stage reached) and the stage it was stopped at, if any.
 */
export function runSpin({ start, magnets, atoms, seed }) {
  const rand = mulberry32(seed);
  const out = [];
  for (let a = 0; a < atoms; a++) {
    let s = start.slice();
    const outcomes = [];
    let stopped = null;
    for (let k = 0; k < magnets.length; k++) {
      const M = magnets[k];
      const up = rand() < upOdds(s, M.axis);
      outcomes.push(up ? 'up' : 'down');
      s = up ? M.axis.slice() : M.axis.map((c) => -c);
      if ((M.keep === 'up' && !up) || (M.keep === 'down' && up)) { stopped = k; break; }
    }
    out.push({ outcomes, stopped });
  }
  return out;
}

/** The expected 'up' count at each magnet, and its binomial spread, given the atoms that reach it and their states. */
export function spinExpectation({ start, magnets, runs }) {
  return magnets.map((M, k) => {
    let mean = 0, varc = 0, reached = 0;
    for (const r of runs) {
      if (r.outcomes.length <= k) continue;
      reached++;
      const s = k === 0 ? start : (r.outcomes[k - 1] === 'up' ? magnets[k - 1].axis : magnets[k - 1].axis.map((c) => -c));
      const p = upOdds(s, M.axis);
      mean += p; varc += p * (1 - p);
    }
    const up = runs.filter((r) => r.outcomes[k] === 'up').length;
    return { reached, up, expected: mean, sd: Math.sqrt(varc) };
  });
}

/** Each nucleus's decay moment: exponential with the half-life T (seeded), in seconds. */
export function runDecay({ nuclei, halfLife, seed }) {
  const rand = mulberry32(seed), lambda = Math.LN2 / halfLife;
  const times = [];
  for (let i = 0; i < nuclei; i++) { let u = 0; while (u <= 1e-300) u = rand(); times.push(-Math.log(u) / lambda); }
  return times;
}
