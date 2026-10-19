/**
 * Geodesics of the Schwarzschild spacetime, in units where Rs = 1 (so M = 1/2) and c = 1. Pure and deterministic.
 *
 * LIGHT. A light ray's path in Schwarzschild coordinates obeys, in a flat-looking Cartesian form,
 *     d²x/dλ² = −(3/2)·h²·x / r⁵,   h = |x × dx/dλ| conserved,
 * which reproduces the exact orbit equation u″ + u = (3/2)u² (u = 1/r, Rs = 1). The page's shader traces each
 * pixel's ray back from the eye with `traceRay`'s exact scheme (velocity Verlet, a step ∝ r), so the conformance
 * gate can hold the picture to these numbers; the closed-form gates use a much finer step of the same law.
 *
 * MATTER. A test body's path, against its proper time τ, obeys
 *     d²x/dτ² = −M·x/r³ − 3·M·L²·x/r⁵,   L = |x × dx/dτ| conserved,
 * the exact radial equation of a Schwarzschild geodesic, with dt/dτ = E / (1 − 1/r) for the far clock's time t.
 *
 * THE EYE. A still observer at radius D sees a ray at angle α from the centre; in Schwarzschild coordinates that ray
 * leaves at sin α_c = sin α / √(1 − 1/D) (the impact parameter b = D·sin α / √(1 − 1/D)), Synge's correction. It is
 * applied here and in the shader alike.
 */

export const M = 0.5;
export const B_CRIT = (3 * Math.sqrt(3)) / 2;   // the shadow's impact parameter, in Rs
export const PHOTON_SPHERE = 1.5;
export const ISCO = 3;

// the drawn scheme (shared with the shader, relativistic/shader.js): the step, the escape radius, the step budget
export const LIGHT_SCHEME = { k: 0.04, horizon: 1.0005, maxSteps: 1200 };
export const farRadius = (D, outer = 0) => Math.max(400, 4 * D, 4 * outer);

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit = (a) => scl(a, 1 / (len(a) || 1));

/** The coordinate direction of a ray an observer still at `ro` sees along the unit direction `rd` (Synge). */
export function eyeToCoordinate(ro, rd) {
  const D = len(ro), rhat = scl(ro, 1 / D);
  const cr = -dot(rd, rhat);                    // cos α, α measured from the line to the centre
  const tang = add(rd, scl(rhat, cr));          // rd's part across that line
  const st = len(tang);
  if (st < 1e-12) return rd.slice();
  const sa = Math.min(1, st / Math.sqrt(1 - 1 / D));
  const ca = Math.sign(cr || 1) * Math.sqrt(Math.max(0, 1 - sa * sa));
  return add(scl(rhat, -ca), scl(tang, sa / st));
}

/** The g factor of light from a disk ring at radius r (circular geodesic) to a still observer at D: ν_seen / ν_sent. */
export function diskG(r, lambda, D) {
  const omega = Math.sqrt(M / (r * r * r));
  return Math.sqrt(1 - 1.5 / r) / (Math.sqrt(1 - 1 / D) * (1 - omega * lambda));
}

/**
 * Trace a ray back from the eye at `ro` along `rd` (the eye's own direction, unit), with `traceRay`'s scheme.
 * Returns { fate: 'captured' | 'escaped', dir (escaped: the direction it leaves to, unit), hits: [{ r, g }] }, the
 * crossings of the equatorial plane z = 0 inside [inner, outer] in order (the disk's direct and lensed images).
 * `k` may be made finer for a closed-form check; the drawn picture uses LIGHT_SCHEME.k. `eye: false` takes `rd` as a
 * coordinate direction already (a ray arriving from far away, for the closed forms).
 */
export function traceRay(ro, rd, { inner = 0, outer = 0, k = LIGHT_SCHEME.k, maxSteps = LIGHT_SCHEME.maxSteps, rFar, eye = true } = {}) {
  const D = len(ro), far = rFar ?? farRadius(D, outer);
  let x = ro.slice(), v = eye ? eyeToCoordinate(ro, rd) : unit(rd);
  const L = cross(x, v), h2 = dot(L, L), lambda = -L[2];   // the real photon runs the other way: its L_z/E is −(x × v)_z
  const accel = (p) => { const r = len(p); return scl(p, (-1.5 * h2) / (r * r * r * r * r)); };
  let a = accel(x);
  const hits = [];
  for (let i = 0; i < maxSteps; i++) {
    const r = len(x);
    if (r < LIGHT_SCHEME.horizon) return { fate: 'captured', hits, steps: i };
    if (r > far && dot(x, v) > 0) return { fate: 'escaped', dir: unit(v), hits, steps: i };
    const dl = k * r;
    const vh = add(v, scl(a, 0.5 * dl));
    const xn = add(x, scl(vh, dl));
    const an = accel(xn);
    const vn = add(vh, scl(an, 0.5 * dl));
    if (outer > 0 && (x[2] > 0) !== (xn[2] > 0)) {
      const f = x[2] / (x[2] - xn[2]);
      const p = add(x, scl(add(xn, scl(x, -1)), f));
      const rho = Math.hypot(p[0], p[1]);
      if (rho >= inner && rho <= outer) hits.push({ r: rho, g: diskG(rho, lambda, D) });
    }
    x = xn; v = vn; a = an;
  }
  return { fate: 'unfinished', hits, steps: maxSteps };
}

/** The exact bending of light passing with impact parameter b (> B_CRIT), by quadrature of the orbit equation. */
export function exactDeflection(b) {
  // the closest approach r0: b² = r0³ / (r0 − 1); u0 = 1/r0, the largest root of 1/b² − u² + u³ = 0 below 2/3
  let lo = 0, hi = 2 / 3;
  const f = (u) => 1 / (b * b) - u * u + u * u * u;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
  const u0 = (lo + hi) / 2;
  // α = 2∫₀^u0 du / √f(u) − π, with u = u0(1 − t²) to take out the root's singularity; Gauss–Legendre on t ∈ [0, 1]
  const N = 400;
  let s = 0;
  for (let i = 0; i < N; i++) {
    // midpoint rule on a cosine-spaced grid is plenty for six figures here
    const t0 = i / N, t1 = (i + 1) / N, tm = (t0 + t1) / 2, u = u0 * (1 - tm * tm);
    s += (2 * u0 * tm) / Math.sqrt(Math.max(f(u), 1e-300)) * (t1 - t0);
  }
  return 2 * s - Math.PI;
}

/** The light bending a ray from far away shows with impact parameter b, traced with the law at a fine step. */
export function tracedDeflection(b, { k = 0.002 } = {}) {
  const start = 2000;
  const r = traceRay([-start, b, 0], [1, 0, 0], { k, rFar: 4000, maxSteps: 200000, eye: false });
  if (r.fate !== 'escaped') return null;
  // the ray came in along +x and left along r.dir; what bending lies beyond 2000 Rs at either end is ~1e-5 of it
  return Math.acos(Math.max(-1, Math.min(1, r.dir[0])));
}

/** The shadow's edge found by bisection on the impact parameter, with the given step (the drawn one, or finer). */
export function shadowEdge({ k = LIGHT_SCHEME.k, start = 400, eye = false } = {}) {
  let lo = 2.2, hi = 3.0;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    const r = traceRay([-start, m, 0], [1, 0, 0], { k, rFar: 2 * start, maxSteps: 400000, eye });
    if (r.fate === 'captured') lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** The shadow's angular radius seen by a still observer at D (Synge): sin α = B_CRIT·√(1 − 1/D) / D. */
export const shadowAngle = (D) => Math.asin(Math.min(1, (B_CRIT * Math.sqrt(1 - 1 / D)) / D));

// ── matter ──

/** A still observer's measured velocity w (fraction of c, components) at x, as the geodesic's dx/dτ and its E, L. */
export function bodyStart(x, w) {
  const r = len(x), rhat = scl(x, 1 / r);
  const wr = dot(w, rhat), wt = add(w, scl(rhat, -wr));
  const speed2 = dot(w, w);
  const gamma = 1 / Math.sqrt(1 - speed2);
  const u = add(scl(rhat, gamma * wr * Math.sqrt(1 - 1 / r)), scl(wt, gamma));
  const E = gamma * Math.sqrt(1 - 1 / r);
  return { x: x.slice(), u, E, L: len(cross(x, u)) };
}

/**
 * Integrate a test body (RK4 in proper time τ, a step ∝ r^1.5) for far-clock time `tEnd`, sampling `samples + 1`
 * evenly spaced far-clock moments. Stops at the horizon (plunged) or past `rEscape` going out (escaped).
 */
export function runBody(start, { tEnd, samples = 240, rEscape = 1e9, k = 0.002 }) {
  const { E } = start, L2 = start.L * start.L;
  const acc = (x) => { const r = len(x); return scl(x, -M / (r * r * r) - (3 * M * L2) / (r * r * r * r * r)); };
  const deriv = (s) => { const r = len(s.x); return { x: s.u, u: acc(s.x), t: E / (1 - 1 / r), tau: 1 }; };
  const step = (s, h) => {
    const k1 = deriv(s);
    const mid = (q, f) => ({ x: add(s.x, scl(q.x, f)), u: add(s.u, scl(q.u, f)), t: s.t + q.t * f, tau: s.tau + f });
    const k2 = deriv(mid(k1, h / 2)), k3 = deriv(mid(k2, h / 2)), k4 = deriv(mid(k3, h));
    const comb = (sel) => sel(k1).map((c, j) => (c + 2 * sel(k2)[j] + 2 * sel(k3)[j] + sel(k4)[j]) * (h / 6));
    return {
      x: add(s.x, comb((q) => q.x)), u: add(s.u, comb((q) => q.u)),
      t: s.t + (h / 6) * (k1.t + 2 * k2.t + 2 * k3.t + k4.t), tau: s.tau + h,
    };
  };
  let s = { x: start.x.slice(), u: start.u.slice(), t: 0, tau: 0 };
  const T = Array.from({ length: samples + 1 }, (_, i) => (i * tEnd) / samples);
  const out = { t: [], x: [], tau: [], r: [] };
  const record = (q) => { out.t.push(q.t); out.x.push(q.x.slice()); out.tau.push(q.tau); out.r.push(len(q.x)); };
  const peri = [];   // periapsis passages: the angle in the orbit plane, and when
  const n = unit(cross(start.x, start.u)), e1 = unit(start.x), e2 = cross(n, e1);
  const angle = (x) => Math.atan2(dot(x, e2), dot(x, e1));
  let phiAcc = 0, prevPhi = angle(s.x), prevRdot = dot(s.x, s.u);
  let fate = 'bound', next = 0, steps = 0;
  record(s); next = 1;
  while (next <= samples) {
    const r = len(s.x);
    if (r < 1.0005) { fate = 'plunged'; break; }
    if (r > rEscape && dot(s.x, s.u) > 0) { fate = 'escaped'; break; }
    // the step in τ: a fraction of the local dynamical time, and never past the next sample moment by much
    const h = k * Math.max(0.05, (r - 1)) * Math.sqrt(r);
    const n1 = step(s, h);
    steps++;
    if (steps > 4e6) { fate = 'unfinished'; break; }
    const phi = angle(n1.x);
    let dphi = phi - prevPhi; if (dphi > Math.PI) dphi -= 2 * Math.PI; if (dphi < -Math.PI) dphi += 2 * Math.PI;
    phiAcc += dphi; prevPhi = phi;
    const rdot = dot(n1.x, n1.u);
    if (prevRdot < 0 && rdot >= 0) {
      // periapsis inside this step: find the sub-step where ṙ = 0 by the secant method on the step itself (a linear
      // guess is good to the step's square; the advance can be far smaller than that, Mercury's 5e-7 rad a lap)
      let h0 = 0, f0 = prevRdot, h1 = h, f1 = rdot, hp = h * (-f0 / (f1 - f0));
      for (let it = 0; it < 40; it++) {
        const fp = dot(step(s, hp).x, step(s, hp).u);
        if (Math.abs(fp) < 1e-300) break;
        if ((fp < 0) === (f0 < 0)) { h0 = hp; f0 = fp; } else { h1 = hp; f1 = fp; }
        const nx = h0 + (h1 - h0) * (-f0 / (f1 - f0));
        if (Math.abs(nx - hp) <= 1e-15 * h) { hp = nx; break; }
        hp = nx;
      }
      const sp = step(s, hp);
      let dp = angle(sp.x) - (phi - dphi); if (dp > Math.PI) dp -= 2 * Math.PI; if (dp < -Math.PI) dp += 2 * Math.PI;
      peri.push({ phi: phiAcc - dphi + dp, t: sp.t });
    }
    prevRdot = rdot;
    // far-clock samples crossed by this step, interpolated linearly in t (the step is far finer than a sample)
    while (next <= samples && n1.t >= T[next]) {
      const f = (T[next] - s.t) / (n1.t - s.t);
      const lerp = (a, b) => a.map((c, j) => c + (b[j] - c) * f);
      out.t.push(T[next]); out.x.push(lerp(s.x, n1.x)); out.tau.push(s.tau + (n1.tau - s.tau) * f); out.r.push(len(lerp(s.x, n1.x)));
      next++;
    }
    s = n1;
  }
  if (fate === 'bound' && E >= 1 && dot(s.x, s.u) > 0) fate = 'escaping';   // unbound and leaving when the run ends
  return { ...out, fate, peri, steps, end: s };
}

/** The real roots, rising, of the orbit cubic g(u) = u³ − u² + u/L² + (E² − 1)/L² (u = 1/r), each polished by Newton. */
export function orbitRoots(E, L) {
  const b = 1 / (L * L), c = (E * E - 1) / (L * L);
  const g = (u) => ((u - 1) * u + b) * u + c, dg = (u) => (3 * u - 2) * u + b;
  // depressed cubic: u = y + 1/3 → y³ + p y + q = 0
  const p = b - 1 / 3, q = -2 / 27 + b / 3 + c;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  let roots;
  if (disc > 0) {
    const sq = Math.sqrt(disc), A = Math.cbrt(-q / 2 + sq), B = Math.cbrt(-q / 2 - sq);
    roots = [A + B + 1 / 3];
  } else {
    const m = 2 * Math.sqrt(-p / 3), th = Math.acos(Math.max(-1, Math.min(1, (3 * q) / (p * m)))) / 3;
    roots = [0, 1, 2].map((k) => m * Math.cos(th - (2 * Math.PI * k) / 3) + 1 / 3);
  }
  return roots.map((u) => { for (let i = 0; i < 4; i++) { const d = dg(u); if (d) u -= g(u) / d; } return u; }).sort((x, y) => x - y);
}

/**
 * What the effective potential says a body will do: 'bound' (between its turning radii), 'circular', 'plunge' (it
 * reaches the horizon) or 'escape'. Motion is allowed where g(u) ≥ 0; the body moves inside the stretch of it that
 * holds its start, and leaves through an end with no turning point (u = 0 is infinity, u = 1 the horizon).
 */
export function predictOrbit({ x, u, E, L }) {
  const r = len(x), u0 = 1 / r, rdot = dot(x, u) / r;
  const g = (q) => ((q - 1) * q + 1 / (L * L)) * q + (E * E - 1) / (L * L);
  // the cubic's roots in the physical range: outside the horizon (u < 1), not at infinity's far side (u > 0)
  let roots = orbitRoots(E, L).filter((q) => q > 0 && q < 1);
  const eps = 1e-9 * u0, probe = 1e-6 * u0;
  const turning = Math.abs(rdot) < 1e-12 * Math.max(1, Math.hypot(...u));
  // a start on a turning point is itself a root; rounding in E² − 1 can put it a hair either side of u0, so drop it
  if (turning && roots.length) {
    const near = roots.reduce((b, q) => (Math.abs(q - u0) < Math.abs(b - u0) ? q : b));
    if (Math.abs(near - u0) < 1e-5 * u0) roots = roots.filter((q) => q !== near);
  }
  const gp = g(u0 + probe), gm = g(u0 - probe);
  if (turning && gp <= 0 && gm <= 0) return { kind: 'circular', rPeri: r, rApo: r };   // a double root: it stays
  const up = turning ? gp > 0 : null;
  const lowEnd = turning && up ? u0 : roots.filter((q) => q < u0 - eps).pop();
  const highEnd = turning && up === false ? u0 : roots.find((q) => q > u0 + eps);
  if (lowEnd !== undefined && highEnd !== undefined) {
    if (Math.abs(highEnd - lowEnd) < 1e-7 * u0) return { kind: 'circular', rPeri: r, rApo: r };
    return { kind: 'bound', rPeri: 1 / highEnd, rApo: 1 / lowEnd, u1: lowEnd, u2: highEnd };
  }
  if (lowEnd === undefined && highEnd === undefined) return { kind: rdot > 0 ? 'escape' : 'plunge' };
  return { kind: lowEnd === undefined ? 'escape' : 'plunge' };
}

/** The exact perihelion advance per orbit (radians) of a bound orbit between u1 = 1/r_apo and u2 = 1/r_peri. */
export function exactAdvance(u1, u2) {
  const u3 = 1 - u1 - u2;   // the roots of u³ − u² + … sum to one
  // Δφ per radial period = 4∫₀^{π/2} dθ / √(u3 − u1 − (u2 − u1) sin²θ)  (u = u1 + (u2 − u1) sin²θ)
  const N = 2000;
  let s = 0;
  for (let i = 0; i < N; i++) {
    const th = ((i + 0.5) / N) * (Math.PI / 2), sn = Math.sin(th);
    s += 1 / Math.sqrt(u3 - u1 - (u2 - u1) * sn * sn);
  }
  return 4 * s * (Math.PI / 2 / N) - 2 * Math.PI;
}

/** The weak-field perihelion advance per orbit, 6πGM / (c²·a·(1 − e²)) = 3π / p with p the semi-latus rectum in Rs. */
export const weakAdvance = (rPeri, rApo) => (3 * Math.PI) / ((2 * rPeri * rApo) / (rPeri + rApo));

/** The innermost stable circular orbit read off the matter law itself: where the circular orbit's stability ends. */
export function iscoFromLaw() {
  // a circular orbit at r has L² = M r² / (r − 3M); it is stable while V_eff″(r) > 0, with
  // V_eff = −M/r + L²/(2r²) − M L²/r³ (the potential of the force above); bisect V_eff″ = 0
  const vpp = (r) => { const L2 = (M * r * r) / (r - 3 * M); return -2 * M / r ** 3 + 3 * L2 / r ** 4 - 12 * M * L2 / r ** 5; };
  let lo = 1.6, hi = 10;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (vpp(m) > 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

// ── clocks ──

/** A still clock at r ticks √(1 − 1/r) as fast as a far one. */
export const clockRate = (r) => Math.sqrt(1 - 1 / r);

/** A clock let fall from rest at r0: its proper time and the far clock's time, integrated (RK4 in τ), to `tEnd`. */
export function runFall(r0, { tEnd, samples = 240, k = 0.001 }) {
  const E = Math.sqrt(1 - 1 / r0);
  // state r, ṙ (in τ), t; r̈ = −M/r² (radial: L = 0), dt/dτ = E / (1 − 1/r)
  const f = (s) => ({ r: s.v, v: -M / (s.r * s.r), t: E / (1 - 1 / s.r) });
  let s = { r: r0, v: 0, t: 0, tau: 0 };
  const T = Array.from({ length: samples + 1 }, (_, i) => (i * tEnd) / samples);
  const out = { t: [0], r: [r0], tau: [0] };
  let next = 1, stop = null;
  while (next <= samples) {
    const h = k * Math.max(0.02, s.r - 1) ** 1.5 + 1e-6;
    const k1 = f(s), m1 = { r: s.r + (h / 2) * k1.r, v: s.v + (h / 2) * k1.v };
    const k2 = f(m1), m2 = { r: s.r + (h / 2) * k2.r, v: s.v + (h / 2) * k2.v };
    const k3 = f(m2), m3 = { r: s.r + h * k3.r, v: s.v + h * k3.v };
    const k4 = f(m3);
    const n = { r: s.r + (h / 6) * (k1.r + 2 * k2.r + 2 * k3.r + k4.r), v: s.v + (h / 6) * (k1.v + 2 * k2.v + 2 * k3.v + k4.v), t: s.t + (h / 6) * (k1.t + 2 * k2.t + 2 * k3.t + k4.t), tau: s.tau + h };
    if (n.r <= 1.002) { stop = { r: n.r, tau: n.tau, t: n.t }; break; }   // frozen, to the far clock, just outside the horizon
    while (next <= samples && n.t >= T[next]) {
      const q = (T[next] - s.t) / (n.t - s.t);
      out.t.push(T[next]); out.r.push(s.r + (n.r - s.r) * q); out.tau.push(s.tau + (n.tau - s.tau) * q); next++;
    }
    s = n;
  }
  // past the moment it freezes, the far clock sees it hold just outside the horizon, its own clock stopped
  while (out.t.length < samples + 1) { out.t.push(T[out.t.length]); out.r.push(out.r[out.r.length - 1]); out.tau.push(out.tau[out.tau.length - 1]); }
  return { ...out, stop, reached: stop !== null };
}

/** The closed-form proper time to fall from rest at r0 to r (the cycloid): τ = (r0^{3/2}/2)·(η + sin η), r = r0(1 + cos η)/2. */
export function closedFallTime(r0, r) {
  const eta = Math.acos(Math.max(-1, Math.min(1, (2 * r) / r0 - 1)));
  return (r0 ** 1.5 / 2) * (eta + Math.sin(eta));
}
