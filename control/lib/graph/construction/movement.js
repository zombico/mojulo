// construction/movement — what drying does to a member, from where its section sat in the log.
//
// Wood shrinks about twice as much round the rings (tangential) as out from the pith (radial), and hardly at all
// along the grain. So a section's shape change is set by its pose: at a point whose radius makes angle α with a
// direction, the strain along that direction is S_T·cos²α + S_R·sin²α, with α measured from the tangent. Across a
// board, the face farther from the pith lies closer to tangential, shrinks more, and goes concave: the board cups
// away from the heart. A quarter-sawn board's faces both run radial, so it stays flat. A section that encloses the
// pith cannot shrink round the rings without splitting: it checks (the reason a boxed-heart post takes a back kerf).
//
// Shrinkage is green → oven-dry (timber.js); moisture below the fibre saturation point scales it linearly.
import { TIMBERS, FSP } from './timber.js';

/**
 * movement(species, pose, W, D, { fromMC?: 'green' | %, toMC?: % }) →
 *   { cupMm, cupFace: 'y+' | 'y-' | 'z+' | 'z-' | null, widthMm, depthMm, checks: boolean }
 * `cupMm` is the sagitta across the wide face; `cupFace` the face that goes concave. `widthMm` / `depthMm` are the
 * section's shrinkage along y and z (positive = smaller).
 */
export function movement(species, pose, W, D, { fromMC = 'green', toMC = 12 } = {}) {
  const sp = TIMBERS[species];
  const from = fromMC === 'green' ? FSP : Math.min(FSP, fromMC);
  const phi = Math.max(0, (from - Math.min(FSP, toMC)) / FSP);
  const ST = (sp.shrinkT / 100) * phi, SR = (sp.shrinkR / 100) * phi;
  const at = (y, z) => [pose.c[0] + pose.wy[0] * y + pose.wz[0] * z, pose.c[1] + pose.wy[1] * y + pose.wz[1] * z];
  // strain along a section direction v (a log-plane unit vector) at local (y, z)
  const strain = (y, z, v) => {
    const q = at(y, z); const r = Math.hypot(q[0], q[1]);
    if (r < 1e-6) return (ST + SR) / 2;
    const c = (v[0] * q[0] + v[1] * q[1]) / r;                          // cos of the angle to the radius
    return ST * (1 - c * c) + SR * c * c;
  };
  const N = 21;
  const meanAlong = (fixed, axis) => {
    let s = 0;
    for (let i = 0; i < N; i++) {
      const t = -0.5 + (i + 0.5) / N;
      s += axis === 'y' ? strain(t * W, fixed, pose.wy) : strain(fixed, t * D, pose.wz);
    }
    return s / N;
  };
  // the section's own shrinkage: along y averaged over the depth, along z over the width
  let ey = 0, ez = 0;
  for (let i = 0; i < N; i++) { const t = -0.5 + (i + 0.5) / N; ey += meanAlong(t * D, 'y'); ez += meanAlong(t * W, 'z'); }
  ey /= N; ez /= N;
  // cup: the wide faces are normal to the thin axis; compare the two
  const thinZ = D <= W;
  const T = thinZ ? D : W, Wd = thinZ ? W : D;
  const faceA = thinZ ? meanAlong(D / 2, 'y') : meanAlong(W / 2, 'z');    // the + face
  const faceB = thinZ ? meanAlong(-D / 2, 'y') : meanAlong(-W / 2, 'z');  // the − face
  const kappa = (faceA - faceB) / T;                                        // + → the + face shrinks more
  const cupMm = Math.abs(kappa) * Wd * Wd / 8 * 1000;
  const axis = thinZ ? 'z' : 'y';
  const cupFace = cupMm < 0.05 ? null : `${axis}${kappa > 0 ? '+' : '-'}`;
  // the pith inside the section (with a little margin): the section checks
  const dx = -pose.c[0], dy = -pose.c[1];
  const pith = [dx * pose.wy[0] + dy * pose.wy[1], dx * pose.wz[0] + dy * pose.wz[1]];
  const checks = Math.abs(pith[0]) < W / 2 && Math.abs(pith[1]) < D / 2;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { cupMm: r2(cupMm), cupFace, widthMm: r2(ey * W * 1000), depthMm: r2(ez * D * 1000), checks };
}
