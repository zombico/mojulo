// Bakes the production elastica (vegetation/mechanics) into a lookup over (θ0, B) so the wind kernel can pose
// thousands of cantilevers a frame. The kernel never solves an elastica itself; it only reads this table.
import { elastica } from '../../../lib/graph/vegetation/mechanics.js';

export const TABLE_SPEC = Object.freeze({ nTheta: 25, nB: 32, Bmax: 120, K: 8 });

/**
 * θ0 ∈ [−π/2, π/2] is the clamp angle above the plane normal to the load; B ∈ [0, Bmax] is spaced evenly in log1p(B).
 * Each entry stores K points along the arc at s = k/K (k = 1..K), (x, y) in units of L, y against the load.
 */
export function bakeElasticaTable(spec = TABLE_SPEC, n = 80) {
  const { nTheta, nB, Bmax, K } = spec;
  const data = [];
  for (let i = 0; i < nTheta; i++) {
    const theta0 = -Math.PI / 2 + (Math.PI * i) / (nTheta - 1);
    for (let j = 0; j < nB; j++) {
      const B = Math.expm1((j / (nB - 1)) * Math.log1p(Bmax));
      const { pts } = elastica({ B, theta0, n });
      for (let k = 1; k <= K; k++) { const p = pts[Math.round((n * k) / K)]; data.push(p[0], p[1]); }
    }
  }
  return { nTheta, nB, Bmax, K, data };
}
