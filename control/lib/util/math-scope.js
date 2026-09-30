/**
 * math-scope — the math a shared builder draws its transcendentals from (sin, cos, atan2, exp, pow, …).
 *
 * A helper that 2.1.0-era generators and 3.0 generators both reach writes `SM.sin(x)` (SM imported from here) where
 * it wrote `Math.sin(x)`. SM is the engine's own Math unless the build runs inside withMath(m, build): a 3.0
 * generator runs inside it with dmath, so every older helper it reaches regrows the same bytes on every CPU and Node
 * version, while a recipe from before 3.0 never enters the scope and its helpers call Math exactly as they did when
 * it was minted. Builders are synchronous, so the scope is a plain save / restore around one call; a build that
 * returns a promise is refused, since its awaited part would run outside the scope. A constant a shared module
 * computes at import keeps Math's value under any scope.
 */
export let SM = Math;

export function withMath(m, build) {
  const prev = SM;
  SM = m;
  try {
    const out = build();
    if (out && typeof out.then === 'function') throw new TypeError('withMath: the build must be synchronous');
    return out;
  } finally { SM = prev; }
}

/** A memo key suffix for geometry cached across calls: the engine's bytes and the scoped bytes never share a slot. */
export const mathKey = () => (SM === Math ? '' : '|dm');
