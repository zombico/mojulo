/**
 * hero-lm — two small leaves of the arm's solvers, kept apart from hero-grip.js (whose gear import comes back round to the
 * motion library) so a module the motion library loads, hero-solid.js, can use them: the arm's CLEARANCE from the trunk
 * on the skeleton, and the LEVENBERG–MARQUARDT solve hero-grip and hero-reach run on. hero-grip re-exports both.
 * Pure and deterministic.
 */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * THE ARM CLEAR OF THE TRUNK: the nearest the upper arm and the forearm (their lines) come to the trunk's (the pelvis to
 * the neck), less what a slim trunk and an arm take up (a third of the shoulder span, and 4 cm of arm at the canonical
 * height): metres, + clear. An arm pressed into the waist reads as a collision, and a held guard shows the arm apart.
 */
export function armClear(R, n, side) {
  const segDist = (p1, q1, p2, q2) => { let best = Infinity; for (let i = 0; i <= 16; i++) { const p = add(p1, mul(sub(q1, p1), i / 16)), ab = sub(q2, p2), t = Math.max(0, Math.min(1, dot(sub(p, p2), ab) / dot(ab, ab))); best = Math.min(best, dist(p, add(p2, mul(ab, t)))); } return best; };
  const need = 0.32 * dist(R.joints.shoulderR, R.joints.shoulderL) + 0.04 * ((R.joints.headTop?.[2] ?? 1.674) / 1.674);
  // the upper arm from a little below its shoulder (the joint itself sits on the trunk's edge)
  const sh = add(n[`shoulder${side}`], mul(sub(n[`elbow${side}`], n[`shoulder${side}`]), 0.35));
  return Math.min(segDist(sh, n[`elbow${side}`], n.pelvisHub, n.neckHub), segDist(n[`elbow${side}`], n[`wrist${side}`], n.pelvisHub, n.neckHub)) - need;
}

/** Levenberg–Marquardt on a residual f(x) (an array) from x0, inside [lo, hi]: → { x, c (the squared residual) } */
export function lm(f, x0, lo, hi, iters = 40) {
  const clampX = (x) => x.map((v, i) => Math.max(lo[i], Math.min(hi[i], v)));
  let x = clampX(x0), r = f(x), c = r.reduce((a, v) => a + v * v, 0), lam = 1e-3; const N = x.length;
  for (let it = 0; it < iters; it++) {
    const J = []; for (let j = 0; j < N; j++) { const xp = [...x]; xp[j] += 0.05; const rp = f(clampX(xp)); J.push(rp.map((v, i) => (v - r[i]) / 0.05)); }
    const A = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => J[i].reduce((a, v, k) => a + v * J[j][k], 0)));
    const g = J.map((Ji) => Ji.reduce((a, v, k) => a + v * r[k], 0));
    let moved = false;
    for (let tries = 0; tries < 8 && !moved; tries++) {
      const M = A.map((row, i) => row.map((v, j) => v + (i === j ? lam * (A[i][i] + 1e-9) : 0))), b = g.map((v) => -v);
      for (let i = 0; i < N; i++) { let p = i; for (let k = i + 1; k < N; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; [b[i], b[p]] = [b[p], b[i]]; for (let k = i + 1; k < N; k++) { const q = M[k][i] / (M[i][i] || 1e-12); for (let l = i; l < N; l++) M[k][l] -= q * M[i][l]; b[k] -= q * b[i]; } }
      const dx = Array(N).fill(0); for (let i = N - 1; i >= 0; i--) { let v = b[i]; for (let l = i + 1; l < N; l++) v -= M[i][l] * dx[l]; dx[i] = v / (M[i][i] || 1e-12); }
      const xn = clampX(x.map((v, i) => v + dx[i])), rn = f(xn), cn = rn.reduce((a, v) => a + v * v, 0);
      if (cn < c) { const step = Math.hypot(...xn.map((v, i) => v - x[i])); x = xn; r = rn; c = cn; lam = Math.max(1e-7, lam / 3); moved = true; if (step < 1e-3) return { x, c }; }
      else lam *= 4;
    }
    if (!moved) break;
  }
  return { x, c };
}
