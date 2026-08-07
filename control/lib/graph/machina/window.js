/**
 * machina/window.js — the mid-tier kernel: stop verifying a POINT, solve over a SPACE. Sweep one design
 * parameter and report the FEASIBLE BAND — the contiguous range where every constraint holds — plus
 * which constraint BINDS each edge, and the most-robust point inside it.
 *
 * It's generic over any evaluator `evaluate(x) → { checks: [{ name, ok, marginFrac }] }`. A verify()-based
 * evaluator feeds it lift/compound problems; a domain model (e.g. the reel mower) feeds it problems that
 * don't fit the lift shape. Either way the window solver is the same. Pure.
 */

// evaluate: (x) => { checks: [{ name, ok, marginFrac }] }. A sample is feasible iff every check is ok.
export function feasibleWindow({ from, to, steps = 240, evaluate, param = 'param' }) {
  const dx = (to - from) / (steps - 1);
  const samples = [];
  for (let i = 0; i < steps; i++) {
    const x = from + i * dx;
    const checks = evaluate(x).checks;
    const feasible = checks.every((c) => c.ok);
    const minMargin = Math.min(...checks.map((c) => c.marginFrac));
    samples.push({ x, feasible, minMargin, checks });
  }

  // widest contiguous feasible run
  let best = null, run = null;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].feasible) { if (!run) run = { lo: i, hi: i }; else run.hi = i; }
    else if (run) { if (!best || run.hi - run.lo > best.hi - best.lo) best = run; run = null; }
  }
  if (run && (!best || run.hi - run.lo > best.hi - best.lo)) best = run;

  if (!best) {
    // nothing feasible — name the constraint that's tightest across the whole sweep (the closest miss)
    const closest = samples.reduce((a, b) => (b.minMargin > a.minMargin ? b : a));
    const worst = closest.checks.filter((c) => !c.ok).map((c) => c.name);
    return { feasible: false, band: null, param, closest: { x: closest.x, blocking: worst }, samples };
  }

  // which check flips false just OUTSIDE each edge → the binding constraint there
  const bindingAt = (idx) => (idx < 0 || idx >= samples.length) ? ['range edge'] : samples[idx].checks.filter((c) => !c.ok).map((c) => c.name);
  const lowEdge = samples[best.lo].x, highEdge = samples[best.hi].x;
  const bindingLow = bindingAt(best.lo - 1), bindingHigh = bindingAt(best.hi + 1);

  // most-robust point: maximise the margin on the constraints that actually BIND the window (the ones
  // forming the two edges). Targeting only those avoids an r-independent constraint sitting at a fixed
  // margin flattening the choice. Fall back to all-checks min when no edge constraint is named.
  const edgeNames = new Set([...bindingLow, ...bindingHigh].filter((n) => n !== 'range edge'));
  const robustness = (s) => {
    const relevant = edgeNames.size ? s.checks.filter((c) => edgeNames.has(c.name)) : s.checks;
    return Math.min(...relevant.map((c) => c.marginFrac));
  };
  const band = samples.slice(best.lo, best.hi + 1);
  const recommended = band.reduce((a, b) => (robustness(b) > robustness(a) ? b : a));

  return {
    feasible: true,
    param,
    band: [lowEdge, highEdge],
    bindingLow,    // what stops you going lower
    bindingHigh,   // what stops you going higher
    recommended: { [param]: recommended.x, marginFrac: robustness(recommended), minMarginFrac: recommended.minMargin },
    samples,
  };
}
