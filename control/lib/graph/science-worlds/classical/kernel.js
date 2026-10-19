/**
 * The classical kernel — the forces of the classical law table, two fixed-step integrators, contacts and
 * constraints, and the bookkeeping the gates read (energy, momentum, angular momentum).
 *
 * SINGLE SOURCE OF TRUTH, the `physics-sim.js` pattern: everything lives inside `buildClassical()`, a closure that
 * references nothing outside itself, so `buildClassical.toString()` is a complete unit a page can run. The solver
 * runs the instance below; the slider page will run the same text. There is no second integrator to drift.
 *
 * Input is a resolved SYSTEM (solve.js builds it from the spec; indices, not ids; every value canonical SI):
 *
 *   { bodies:     [{ m, r, q, fixed, x: [3], v: [3] }],
 *     forces:     [{ kind, idx: [i], … }],                 kind ∈ gravity-uniform | gravity-newton | spring | drag-linear |
 *                                                          drag-quadratic | buoyancy | coulomb | lorentz
 *     planes:     [{ p: [3], n: [3], e, mu, mus, idx }],   rigid half-spaces bodies bounce on, rest on and slide along
 *     rods:       [{ a, b, anchor, L, rope }],             b = -1 for a fixed anchor point
 *     collisions: [{ e, idx }] }                           smooth spheres, impulses along the line of centres
 *
 * Integrators: velocity Verlet (symplectic; only when every force reads position alone) and classical RK4. Rods and
 * ropes are exact Lagrange-multiplier forces inside the acceleration, with a projection after each step to hold drift
 * at round-off. Plane contacts are events after the step (a bounce mirrors the overshoot, scaled by e) and, once a
 * body rests, normal and Coulomb friction forces inside the acceleration.
 *
 * Determinism: no clock, no randomness; the same system and options give byte-identical output.
 */

export function buildClassical() {
  const dot = (a, i, b, j) => a[i] * b[j] + a[i + 1] * b[j + 1] + a[i + 2] * b[j + 2];

  function system(desc) {
    const n = desc.bodies.length;
    const S = {
      n,
      m: new Float64Array(n), im: new Float64Array(n), r: new Float64Array(n), q: new Float64Array(n),
      x: new Float64Array(3 * n), v: new Float64Array(3 * n),
      forces: desc.forces || [], planes: desc.planes || [], rods: desc.rods || [], collisions: desc.collisions || [],
      a: null,
    };
    desc.bodies.forEach((b, i) => {
      S.m[i] = b.m || 0; S.im[i] = b.fixed || !(b.m > 0) ? 0 : 1 / b.m; S.r[i] = b.r || 0; S.q[i] = b.q || 0;
      for (let k = 0; k < 3; k++) { S.x[3 * i + k] = b.x[k]; S.v[3 * i + k] = b.fixed ? 0 : b.v[k]; }
    });
    // a body starts resting on a plane when it touches it and is not moving away
    S.contact = S.planes.map((P) => {
      const c = new Uint8Array(n);
      for (const i of P.idx) {
        const s = (S.x[3 * i] - P.p[0]) * P.n[0] + (S.x[3 * i + 1] - P.p[1]) * P.n[1] + (S.x[3 * i + 2] - P.p[2]) * P.n[2] - S.r[i];
        if (Math.abs(s) <= 1e-9 && dot(S.v, 3 * i, P.n, 0) <= 0) c[i] = 1;
      }
      return c;
    });
    return S;
  }

  // ── forces that are not contacts or constraints ──
  function baseForces(S, x, v, F) {
    F.fill(0);
    for (const f of S.forces) {
      const idx = f.idx;
      if (f.kind === 'gravity-uniform') {
        for (const i of idx) for (let k = 0; k < 3; k++) F[3 * i + k] += S.m[i] * f.g[k];
      } else if (f.kind === 'gravity-newton' || f.kind === 'coulomb') {
        const grav = f.kind === 'gravity-newton';
        for (let u = 0; u < idx.length; u++) for (let w = u + 1; w < idx.length; w++) {
          const i = idx[u], j = idx[w];
          const dx = x[3 * j] - x[3 * i], dy = x[3 * j + 1] - x[3 * i + 1], dz = x[3 * j + 2] - x[3 * i + 2];
          const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
          if (!(r > 0)) continue;
          // gravity pulls i toward j; like charges push i away from j
          const s = (grav ? f.G * S.m[i] * S.m[j] : -f.k * S.q[i] * S.q[j]) / (r2 * r);
          F[3 * i] += s * dx; F[3 * i + 1] += s * dy; F[3 * i + 2] += s * dz;
          F[3 * j] -= s * dx; F[3 * j + 1] -= s * dy; F[3 * j + 2] -= s * dz;
        }
      } else if (f.kind === 'spring') {
        const a = f.a, b = f.b;
        const bx = b < 0 ? f.anchor : null;
        const d = [0, 0, 0], u = [0, 0, 0];
        for (let k = 0; k < 3; k++) {
          d[k] = x[3 * a + k] - (b < 0 ? bx[k] : x[3 * b + k]);
          u[k] = v[3 * a + k] - (b < 0 ? 0 : v[3 * b + k]);
        }
        const len = Math.hypot(d[0], d[1], d[2]);
        if (!(len > 0)) continue;
        const s = -f.k * (len - f.rest) - (f.c ? f.c * (u[0] * d[0] + u[1] * d[1] + u[2] * d[2]) / len : 0);
        for (let k = 0; k < 3; k++) {
          F[3 * a + k] += s * d[k] / len;
          if (b >= 0) F[3 * b + k] -= s * d[k] / len;
        }
      } else if (f.kind === 'drag-linear') {
        idx.forEach((i, t) => { for (let k = 0; k < 3; k++) F[3 * i + k] -= f.b[t] * (v[3 * i + k] - f.wind[k]); });
      } else if (f.kind === 'drag-quadratic') {
        idx.forEach((i, t) => {
          const ux = v[3 * i] - f.wind[0], uy = v[3 * i + 1] - f.wind[1], uz = v[3 * i + 2] - f.wind[2];
          const s = f.kq[t] * Math.hypot(ux, uy, uz);
          F[3 * i] -= s * ux; F[3 * i + 1] -= s * uy; F[3 * i + 2] -= s * uz;
        });
      } else if (f.kind === 'buoyancy') {
        for (const i of idx) {
          const V = submerged(S.r[i], f.surface - (dot(x, 3 * i, f.up, 0) - S.r[i]));
          for (let k = 0; k < 3; k++) F[3 * i + k] -= f.rho * V * f.g[k];
        }
      } else if (f.kind === 'lorentz') {
        for (const i of idx) {
          const q = S.q[i], vx = v[3 * i], vy = v[3 * i + 1], vz = v[3 * i + 2];
          F[3 * i] += q * (f.E[0] + vy * f.B[2] - vz * f.B[1]);
          F[3 * i + 1] += q * (f.E[1] + vz * f.B[0] - vx * f.B[2]);
          F[3 * i + 2] += q * (f.E[2] + vx * f.B[1] - vy * f.B[0]);
        }
      }
    }
  }

  // a sphere's volume below a surface it is sunk h into (a spherical cap), and that volume's integral over depth
  function submerged(r, h) {
    if (!(r > 0) || h <= 0) return 0;
    if (h >= 2 * r) return (4 / 3) * Math.PI * r * r * r;
    return Math.PI * h * h * (3 * r - h) / 3;
  }
  function submergedIntegral(r, h) {
    if (!(r > 0) || h <= 0) return 0;
    const cap = (s) => Math.PI * (r * s * s * s / 3 - s * s * s * s / 12);
    if (h <= 2 * r) return cap(h);
    return cap(2 * r) + (4 / 3) * Math.PI * r * r * r * (h - 2 * r);
  }

  // ── resting contacts: the normal force cancels pressing, Coulomb friction opposes sliding ──
  function planeForces(S, x, v, F) {
    S.planes.forEach((P, pi) => {
      const c = S.contact[pi];
      for (const i of P.idx) {
        if (!c[i] || S.im[i] === 0) continue;
        const fn = dot(F, 3 * i, P.n, 0);
        if (fn >= 0) continue;
        const N = -fn;
        for (let k = 0; k < 3; k++) F[3 * i + k] += N * P.n[k];
        const vn = dot(v, 3 * i, P.n, 0);
        const vt = [0, 1, 2].map((k) => v[3 * i + k] - vn * P.n[k]);
        const sp = Math.hypot(vt[0], vt[1], vt[2]);
        if (sp > 1e-9) {
          for (let k = 0; k < 3; k++) F[3 * i + k] -= P.mu * N * vt[k] / sp;
        } else {
          const ft = [F[3 * i], F[3 * i + 1], F[3 * i + 2]];
          const fm = Math.hypot(ft[0], ft[1], ft[2]);
          const hold = fm <= P.mus * N ? 1 : P.mu * N / fm;
          for (let k = 0; k < 3; k++) F[3 * i + k] -= hold * ft[k];
        }
      }
    });
  }

  // ── rods and ropes: Lagrange multipliers so the constraint's second derivative is zero ──
  function rodForces(S, x, v, F) {
    const rods = S.rods;
    if (!rods.length) return;
    const geo = rods.map((R) => {
      const d = [0, 0, 0], u = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        d[k] = x[3 * R.a + k] - (R.b < 0 ? R.anchor[k] : x[3 * R.b + k]);
        u[k] = v[3 * R.a + k] - (R.b < 0 ? 0 : v[3 * R.b + k]);
      }
      return { d, u, len: Math.hypot(d[0], d[1], d[2]) };
    });
    let active = rods.map((R, k) => !R.rope || geo[k].len >= R.L * (1 - 1e-9));
    for (let pass = 0; pass <= rods.length; pass++) {
      const on = rods.map((R, k) => k).filter((k) => active[k]);
      if (!on.length) return;
      const im = (i) => (i < 0 ? 0 : S.im[i]);
      const side = (i, R) => (i === R.a ? 1 : i === R.b && i >= 0 ? -1 : 0);
      const A = on.map(() => new Float64Array(on.length)), rhs = new Float64Array(on.length);
      on.forEach((k, r) => {
        const R = rods[k], g = geo[k];
        on.forEach((l, c) => {
          const Q = rods[l];
          const dd = g.d[0] * geo[l].d[0] + g.d[1] * geo[l].d[1] + g.d[2] * geo[l].d[2];
          A[r][c] = (im(R.a) * side(R.a, Q) - (R.b < 0 ? 0 : im(R.b) * side(R.b, Q))) * dd;
        });
        let fa = 0;
        for (let t = 0; t < 3; t++) fa += g.d[t] * (im(R.a) * F[3 * R.a + t] - (R.b < 0 ? 0 : im(R.b) * F[3 * R.b + t]));
        rhs[r] = -(g.u[0] * g.u[0] + g.u[1] * g.u[1] + g.u[2] * g.u[2]) - fa;
      });
      const lam = solveLinear(A, rhs);
      // a rope only pulls: a multiplier that would push lets that rope go slack, and the rest are solved again
      const slack = on.filter((k, r) => rods[k].rope && lam[r] > 0);
      if (slack.length) { for (const k of slack) active[k] = false; continue; }
      on.forEach((k, r) => {
        const R = rods[k], d = geo[k].d;
        for (let t = 0; t < 3; t++) {
          F[3 * R.a + t] += lam[r] * d[t];
          if (R.b >= 0) F[3 * R.b + t] -= lam[r] * d[t];
        }
      });
      return;
    }
  }

  function solveLinear(A, b) {
    const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const piv = M[c][c];
      if (!piv) continue;
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / piv;
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const out = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * out[k];
      out[r] = M[r][r] ? s / M[r][r] : 0;
    }
    return out;
  }

  function accel(S, x, v, A) {
    baseForces(S, x, v, A);
    if (S.planes.length) planeForces(S, x, v, A);
    if (S.rods.length) rodForces(S, x, v, A);
    for (let i = 0; i < S.n; i++) for (let k = 0; k < 3; k++) A[3 * i + k] *= S.im[i];
    return A;
  }

  function stepVerlet(S, dt) {
    const N = 3 * S.n;
    if (!S.a) S.a = accel(S, S.x, S.v, new Float64Array(N));
    const a = S.a;
    for (let j = 0; j < N; j++) { S.v[j] += 0.5 * dt * a[j]; S.x[j] += dt * S.v[j]; }
    const b = accel(S, S.x, S.v, new Float64Array(N));
    for (let j = 0; j < N; j++) S.v[j] += 0.5 * dt * b[j];
    S.a = b;
  }

  function stepRK4(S, dt) {
    const N = 3 * S.n, x0 = S.x, v0 = S.v;
    const x = new Float64Array(N), v = new Float64Array(N);
    const k1 = accel(S, x0, v0, new Float64Array(N));
    for (let j = 0; j < N; j++) { x[j] = x0[j] + 0.5 * dt * v0[j]; v[j] = v0[j] + 0.5 * dt * k1[j]; }
    const v2 = Float64Array.from(v), k2 = accel(S, x, v, new Float64Array(N));
    for (let j = 0; j < N; j++) { x[j] = x0[j] + 0.5 * dt * v2[j]; v[j] = v0[j] + 0.5 * dt * k2[j]; }
    const v3 = Float64Array.from(v), k3 = accel(S, x, v, new Float64Array(N));
    for (let j = 0; j < N; j++) { x[j] = x0[j] + dt * v3[j]; v[j] = v0[j] + dt * k3[j]; }
    const v4 = Float64Array.from(v), k4 = accel(S, x, v, new Float64Array(N));
    for (let j = 0; j < N; j++) {
      x0[j] += dt / 6 * (v0[j] + 2 * v2[j] + 2 * v3[j] + v4[j]);
      v0[j] += dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
    }
  }

  // hold rods at length and kill their stretching velocity (the drift a fixed step leaves; round-off size)
  function project(S) {
    if (!S.rods.length) return;
    for (let it = 0; it < 8; it++) {
      for (const R of S.rods) {
        const ia = S.im[R.a], ib = R.b < 0 ? 0 : S.im[R.b], w = ia + ib;
        if (!w) continue;
        const d = [0, 1, 2].map((k) => S.x[3 * R.a + k] - (R.b < 0 ? R.anchor[k] : S.x[3 * R.b + k]));
        const len = Math.hypot(d[0], d[1], d[2]);
        if (!(len > 0) || (R.rope && len < R.L)) continue;
        const s = (len - R.L) / len;
        for (let k = 0; k < 3; k++) {
          S.x[3 * R.a + k] -= d[k] * s * ia / w;
          if (R.b >= 0) S.x[3 * R.b + k] += d[k] * s * ib / w;
        }
        if (it === 7) {
          const u = [0, 1, 2].map((k) => S.v[3 * R.a + k] - (R.b < 0 ? 0 : S.v[3 * R.b + k]));
          const un = (u[0] * d[0] + u[1] * d[1] + u[2] * d[2]) / len;
          if (R.rope && un < 0) continue;
          for (let k = 0; k < 3; k++) {
            S.v[3 * R.a + k] -= un * d[k] / len * ia / w;
            if (R.b >= 0) S.v[3 * R.b + k] += un * d[k] / len * ib / w;
          }
        }
      }
    }
  }

  // plane events: a bounce mirrors the overshoot scaled by e and reverses the normal speed; a body too slow to bounce
  // rests, and a resting body leaves when nothing presses it in. Returns whether anything moved.
  function contacts(S, dt) {
    if (!S.planes.length) return false;
    let moved = false;
    const F = new Float64Array(3 * S.n);
    baseForces(S, S.x, S.v, F);
    S.planes.forEach((P, pi) => {
      const c = S.contact[pi];
      for (const i of P.idx) {
        if (S.im[i] === 0) continue;
        const s = (S.x[3 * i] - P.p[0]) * P.n[0] + (S.x[3 * i + 1] - P.p[1]) * P.n[1] + (S.x[3 * i + 2] - P.p[2]) * P.n[2] - S.r[i];
        const vn = dot(S.v, 3 * i, P.n, 0);
        const an = dot(F, 3 * i, P.n, 0) * S.im[i];
        const vrest = 2 * Math.max(-an, 0) * dt + 1e-12;
        if (c[i]) {
          if (an >= 0 || vn > vrest) { c[i] = 0; continue; }
          if (s < 0) { for (let k = 0; k < 3; k++) S.x[3 * i + k] -= s * P.n[k]; moved = true; }
          if (vn < 0) { for (let k = 0; k < 3; k++) S.v[3 * i + k] -= vn * P.n[k]; moved = true; }
          // a slide slow enough for friction to stop within a step stops, when static friction can hold it
          const vt = [0, 1, 2].map((k) => S.v[3 * i + k] - dot(S.v, 3 * i, P.n, 0) * P.n[k]);
          const sp = Math.hypot(vt[0], vt[1], vt[2]);
          if (sp > 0 && sp <= P.mu * -an * dt) {
            const fn = dot(F, 3 * i, P.n, 0);
            const ft = [0, 1, 2].map((k) => F[3 * i + k] - fn * P.n[k]);
            if (Math.hypot(ft[0], ft[1], ft[2]) <= P.mus * -fn) {
              for (let k = 0; k < 3; k++) S.v[3 * i + k] -= vt[k];
              moved = true;
            }
          }
        } else if (s < 0) {
          moved = true;
          if (-vn > vrest) {
            // back up to the moment of impact along the normal (exact under constant acceleration), reverse the
            // normal speed there scaled by e, and spend the rest of the step moving off the surface
            const tau = impactTime(s, vn, an, dt);
            const vi = vn - an * tau, vo = -P.e * vi;
            const s1 = vo * tau + 0.5 * an * tau * tau, v1 = vo + an * tau;
            for (let k = 0; k < 3; k++) { S.x[3 * i + k] += (s1 - s) * P.n[k]; S.v[3 * i + k] += (v1 - vn) * P.n[k]; }
            const dv = (1 + P.e) * -vi;
            if (P.mu > 0) {
              const vt = [0, 1, 2].map((k) => S.v[3 * i + k] - dot(S.v, 3 * i, P.n, 0) * P.n[k]);
              const sp = Math.hypot(vt[0], vt[1], vt[2]);
              if (sp > 0) { const cut = Math.min(sp, P.mu * dv) / sp; for (let k = 0; k < 3; k++) S.v[3 * i + k] -= cut * vt[k]; }
            }
          } else {
            for (let k = 0; k < 3; k++) { S.x[3 * i + k] -= s * P.n[k]; S.v[3 * i + k] -= vn * P.n[k]; }
            c[i] = 1;
          }
        }
      }
    });
    return moved;
  }

  // how long ago a body that ends a step at depth s < 0 with normal speed vn < 0 crossed the surface, under constant
  // normal acceleration an: the smallest τ in (0, dt] with s − vn·τ + ½·an·τ² = 0
  function impactTime(s, vn, an, dt) {
    const A = 0.5 * an, B = -vn, C = s;
    let tau = -C / B;
    if (Math.abs(A) > 0) {
      const disc = B * B - 4 * A * C;
      if (disc >= 0) {
        const q = -0.5 * (B + Math.sign(B) * Math.sqrt(disc));
        const roots = [q / A, q ? C / q : Infinity].filter((r) => r > 0);
        if (roots.length) tau = Math.min(...roots);
      }
    }
    return Math.max(0, Math.min(dt, tau));
  }

  // sphere pairs: an impulse along the line of centres with restitution e (momentum exact), then the overlap removed
  // in inverse-mass shares (momentum untouched)
  function collide(S) {
    let moved = false;
    for (const C of S.collisions) {
      const idx = C.idx;
      for (let u = 0; u < idx.length; u++) for (let w = u + 1; w < idx.length; w++) {
        const i = idx[u], j = idx[w], ii = S.im[i], ij = S.im[j], sum = ii + ij;
        if (!sum) continue;
        const d = [0, 1, 2].map((k) => S.x[3 * j + k] - S.x[3 * i + k]);
        const dist = Math.hypot(d[0], d[1], d[2]), overlap = S.r[i] + S.r[j] - dist;
        if (overlap <= 0 || !(dist > 0)) continue;
        const nrm = d.map((c) => c / dist);
        const un = [0, 1, 2].reduce((s, k) => s + (S.v[3 * j + k] - S.v[3 * i + k]) * nrm[k], 0);
        if (un < 0) {
          const J = -(1 + C.e) * un / sum;
          for (let k = 0; k < 3; k++) { S.v[3 * i + k] -= J * ii * nrm[k]; S.v[3 * j + k] += J * ij * nrm[k]; }
        }
        for (let k = 0; k < 3; k++) { S.x[3 * i + k] -= nrm[k] * overlap * ii / sum; S.x[3 * j + k] += nrm[k] * overlap * ij / sum; }
        moved = true;
      }
    }
    return moved;
  }

  function energy(S) {
    let ke = 0, pe = 0;
    for (let i = 0; i < S.n; i++) if (S.im[i] > 0) ke += 0.5 * S.m[i] * dot(S.v, 3 * i, S.v, 3 * i);
    for (const f of S.forces) {
      const idx = f.idx;
      if (f.kind === 'gravity-uniform') for (const i of idx) pe -= S.m[i] * dot(f.g, 0, S.x, 3 * i);
      else if (f.kind === 'gravity-newton' || f.kind === 'coulomb') {
        for (let u = 0; u < idx.length; u++) for (let w = u + 1; w < idx.length; w++) {
          const i = idx[u], j = idx[w];
          const r = Math.hypot(S.x[3 * j] - S.x[3 * i], S.x[3 * j + 1] - S.x[3 * i + 1], S.x[3 * j + 2] - S.x[3 * i + 2]);
          if (r > 0) pe += f.kind === 'gravity-newton' ? -f.G * S.m[i] * S.m[j] / r : f.k * S.q[i] * S.q[j] / r;
        }
      } else if (f.kind === 'spring') {
        const d = [0, 1, 2].map((k) => S.x[3 * f.a + k] - (f.b < 0 ? f.anchor[k] : S.x[3 * f.b + k]));
        const ext = Math.hypot(d[0], d[1], d[2]) - f.rest;
        pe += 0.5 * f.k * ext * ext;
      } else if (f.kind === 'lorentz') for (const i of idx) pe -= S.q[i] * dot(f.E, 0, S.x, 3 * i);
      else if (f.kind === 'buoyancy') {
        const gm = Math.hypot(f.g[0], f.g[1], f.g[2]);
        for (const i of idx) pe += f.rho * gm * submergedIntegral(S.r[i], f.surface - (dot(S.x, 3 * i, f.up, 0) - S.r[i]));
      }
    }
    return { ke, pe };
  }

  function momentum(S) {
    const p = [0, 0, 0];
    for (let i = 0; i < S.n; i++) if (S.im[i] > 0) for (let k = 0; k < 3; k++) p[k] += S.m[i] * S.v[3 * i + k];
    return p;
  }

  function angular(S) {
    const L = [0, 0, 0];
    for (let i = 0; i < S.n; i++) {
      if (!(S.im[i] > 0)) continue;
      const m = S.m[i], x = S.x, v = S.v, o = 3 * i;
      L[0] += m * (x[o + 1] * v[o + 2] - x[o + 2] * v[o + 1]);
      L[1] += m * (x[o + 2] * v[o] - x[o] * v[o + 2]);
      L[2] += m * (x[o] * v[o + 1] - x[o + 1] * v[o]);
    }
    return L;
  }

  /**
   * Run a system: `samples` intervals of `substeps` fixed steps each, recording state at every interval boundary.
   * Also tracks, at every step, what the gates need: the fastest body, the worst rod error, the deepest overshoot.
   */
  function run(desc, { interval, substeps, samples, stepper }) {
    const S = system(desc), dt = interval / substeps;
    const out = { t: [], x: [], v: [], ke: [], pe: [], p: [], L: [], maxSpeed: 0, maxRodError: 0, maxOvershoot: 0 };
    const record = (k) => {
      const e = energy(S);
      out.t.push(k * interval); out.x.push(Array.from(S.x)); out.v.push(Array.from(S.v));
      out.ke.push(e.ke); out.pe.push(e.pe); out.p.push(momentum(S)); out.L.push(angular(S));
    };
    const watch = () => {
      for (let i = 0; i < S.n; i++) {
        const sp = Math.sqrt(dot(S.v, 3 * i, S.v, 3 * i));
        if (sp > out.maxSpeed) out.maxSpeed = sp;
      }
      for (const R of S.rods) {
        if (R.rope) continue;
        const d = [0, 1, 2].map((k) => S.x[3 * R.a + k] - (R.b < 0 ? R.anchor[k] : S.x[3 * R.b + k]));
        const err = Math.abs(Math.hypot(d[0], d[1], d[2]) - R.L) / R.L;
        if (err > out.maxRodError) out.maxRodError = err;
      }
    };
    record(0);
    for (let k = 1; k <= samples; k++) {
      for (let s = 0; s < substeps; s++) {
        if (stepper === 'verlet') stepVerlet(S, dt); else stepRK4(S, dt);
        project(S);
        S.planes.forEach((P) => {
          for (const i of P.idx) {
            const over = S.r[i] - ((S.x[3 * i] - P.p[0]) * P.n[0] + (S.x[3 * i + 1] - P.p[1]) * P.n[1] + (S.x[3 * i + 2] - P.p[2]) * P.n[2]);
            if (over > out.maxOvershoot) out.maxOvershoot = over;
          }
        });
        const a = contacts(S, dt), b = collide(S);
        if (a || b) S.a = null;
        watch();
      }
      record(k);
    }
    return out;
  }

  return { system, accel, run, energy, momentum, angular };
}

export const classical = buildClassical();
