/**
 * The electric and magnetic fields a classical world's laws make, for drawing them: the Coulomb field of every
 * charge its `coulomb` rows name (each row's own k), plus the uniform E and B of its `lorentz` rows. The solver moves
 * the bodies; this reads the field off the same model at any moment of the run, so a drawing of it is the model's.
 *
 *   E(p) = Σ k·qᵢ (p − xᵢ) / |p − xᵢ|³ + E₀        V(p) = Σ k·qᵢ / |p − xᵢ| − E₀ · p
 *
 * Gauss's law is the field's own check: the flux of E through a sphere round each charge is 4πk·q (q/ε₀), by a
 * numerical surface integral (Gauss–Legendre in cos θ, even in φ). Field lines are traced from the charges by RK4
 * along E, as many from each as its share of the largest charge, and end on a charge of the other sign or leave the
 * frame. Pure and deterministic; SI throughout.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = len(a) || 1; return scl(a, 1 / l); };

/** What makes the field: the charges (body ids, charge, their row's k) and the uniform E₀ and B₀. */
export function fieldSources(model) {
  const byId = Object.fromEntries(model.bodies.map((b) => [b.id, b]));
  const charges = [], E0 = [0, 0, 0], B0 = [0, 0, 0];
  for (const l of model.laws) {
    if (l.law === 'coulomb') {
      const ids = l.among ?? model.bodies.map((b) => b.id);
      for (const id of ids) if (byId[id].charge) charges.push({ id, q: byId[id].charge, k: l.k ?? 8.9875517923e9, radius: byId[id].radius ?? 0 });
    }
    if (l.law === 'lorentz') { for (let c = 0; c < 3; c++) { E0[c] += (l.E ?? [0, 0, 0])[c]; B0[c] += (l.B ?? [0, 0, 0])[c]; } }
  }
  return { charges, E0, B0 };
}

/** The charges' positions at track sample `k`. */
export const positionsAt = (src, tracks, k) => src.charges.map((c) => tracks.bodies[c.id].x[k]);

/** E at p from charges at `xs` (their positions), and the uniform E₀. */
export function fieldAt(src, xs, p) {
  const E = src.E0.slice();
  src.charges.forEach((c, i) => {
    const d = sub(p, xs[i]), r = len(d);
    if (r > 0) { const f = (c.k * c.q) / (r * r * r); E[0] += f * d[0]; E[1] += f * d[1]; E[2] += f * d[2]; }
  });
  return E;
}

/** V at p (zero far from the charges, and at the origin for the uniform part). */
export function potentialAt(src, xs, p) {
  let V = -dot(src.E0, p);
  src.charges.forEach((c, i) => { const r = len(sub(p, xs[i])); if (r > 0) V += (c.k * c.q) / r; });
  return V;
}

// Gauss–Legendre nodes and weights on [−1, 1] (Newton on the Legendre polynomial)
function legendreGauss(n) {
  const x = [], w = [];
  for (let i = 1; i <= n; i++) {
    let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++) {
      let p0 = 1, p1 = z;
      for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
      dp = (n * (z * p1 - p0)) / (z * z - 1);
      const dz = p1 / dp; z -= dz;
      if (Math.abs(dz) < 1e-16) break;
    }
    x.push(z); w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}

/** The flux of E through a sphere of radius r about c, by Gauss–Legendre in cos θ and an even rule in φ. */
export function fluxThrough(src, xs, c, r, { nTheta = 32, nPhi = 64 } = {}) {
  const { x, w } = legendreGauss(nTheta);
  let flux = 0;
  for (let i = 0; i < nTheta; i++) {
    const ct = x[i], st = Math.sqrt(1 - ct * ct);
    for (let j = 0; j < nPhi; j++) {
      const ph = (2 * Math.PI * (j + 0.5)) / nPhi, n = [st * Math.cos(ph), st * Math.sin(ph), ct];
      flux += w[i] * (2 * Math.PI / nPhi) * dot(fieldAt(src, xs, add(c, scl(n, r))), n) * r * r;
    }
  }
  return flux;
}

/**
 * Gauss's law at the run's start: about each charge, a sphere a third of the way to its nearest neighbour holds
 * flux 4πk·q; one about an empty point holds none. Returns the worst relative error and its charge.
 */
export function gaussCheck(src, xs, frameR) {
  let worst = 0, at = null;
  src.charges.forEach((c, i) => {
    const near = Math.min(...xs.filter((_, j) => j !== i).map((x) => len(sub(x, xs[i]))), 3 * frameR);
    const r = Math.max(near / 3, c.radius * 1.01, 1e-300);
    const want = 4 * Math.PI * c.k * c.q, got = fluxThrough(src, xs, xs[i], r);
    const e = Math.abs(got - want) / Math.abs(want);
    if (e > worst) { worst = e; at = c.id; }
  });
  // an empty sphere: halfway between the first charge and its nearest, or beside a lone one
  let empty = 0;
  if (src.charges.length) {
    const x0 = xs[0], other = xs.length > 1 ? xs.slice(1).reduce((b, x) => (len(sub(x, x0)) < len(sub(b, x0)) ? x : b)) : add(x0, [frameR, 0, 0]);
    const mid = scl(add(x0, other), 0.5), r = len(sub(other, x0)) / 6;
    const scale = Math.max(...src.charges.map((c) => Math.abs(4 * Math.PI * c.k * c.q)));
    empty = Math.abs(fluxThrough(src, xs, mid, r)) / scale;
  }
  return { worst, at, empty };
}

/**
 * The plane the charges and their paths (and the uniform field) lie in, if they do: its normal, else null (3-D). On
 * a line or at one point, the plane through it nearest level.
 */
export function chargePlane(src, xs, pts) {
  const all = [...xs, ...pts], c = all[0];
  const span = Math.max(...all.map((p) => len(sub(p, c))), 1e-300);
  const far = all.reduce((b, p) => (len(sub(p, c)) > len(sub(b, c)) ? p : b), c);
  let n;
  if (len(sub(far, c)) <= 1e-9 * span || len(sub(far, c)) === 0) n = [0, 0, 1];
  else {
    const d = unit(sub(far, c));
    const off = (p) => len(sub(sub(p, c), scl(d, dot(sub(p, c), d))));
    const side = all.reduce((b, p) => (off(p) > off(b) ? p : b), c);
    if (off(side) <= 1e-9 * span) {
      n = sub([0, 0, 1], scl(d, d[2]));
      n = len(n) > 1e-6 ? unit(n) : unit(cross(d, [0, 1, 0]));
    } else n = unit(cross(d, sub(side, c)));
  }
  if (all.some((p) => Math.abs(dot(sub(p, c), n)) > 1e-9 * span)) return null;
  if (Math.abs(dot(src.E0, n)) > 1e-12 * (len(src.E0) || 1)) return null;
  return n;
}

// seed directions about a charge: evenly round the plane's circle, or a Fibonacci sphere
function seeds(count, normal, phase = 0) {
  if (normal) {
    const u = unit(len(cross(normal, [1, 0, 0])) > 0.1 ? cross(normal, [1, 0, 0]) : cross(normal, [0, 1, 0])), v = cross(normal, u);
    return Array.from({ length: count }, (_, i) => { const a = (2 * Math.PI * (i + phase)) / count; return add(scl(u, Math.cos(a)), scl(v, Math.sin(a))); });
  }
  const ga = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => { const z = 1 - (2 * (i + 0.5)) / count, r = Math.sqrt(1 - z * z); return [r * Math.cos(ga * i), r * Math.sin(ga * i), z]; });
}

/**
 * Trace field lines at one moment. Each charge gets lines in proportion to its charge (`perMax` from the largest);
 * a positive charge's run along E, a negative charge's against it. A line ends on a charge of the other sign (it
 * reaches that charge's start radius), leaves the frame (a sphere of radius R about `centre`), or stops (it found no
 * end in its step budget: a null point). Lines from negative charges that would end on a positive one are already
 * drawn from it, so each negative charge adds only as many as it still lacks.
 */
export function traceLines(src, xs, { centre, R, perMax = 12, normal = null }) {
  const n = src.charges.length;
  if (!n) return { lines: [], per: [] };
  const qmax = Math.max(...src.charges.map((c) => Math.abs(c.q)));
  const want = src.charges.map((c) => Math.max(1, Math.round((perMax * Math.abs(c.q)) / qmax)));
  const nearest = xs.map((x, i) => Math.min(...xs.filter((_, j) => j !== i).map((y) => len(sub(x, y))), 2 * R));
  const start = src.charges.map((c, i) => Math.max(c.radius, Math.min(0.04 * R, 0.25 * nearest[i])));
  const trace = (from, i, sign) => {
    let p = add(xs[i], scl(from, start[i]));
    const pts = [xs[i], p];
    const dir = (q) => { const E = fieldAt(src, xs, q); const l = len(E); return l > 0 ? scl(E, sign / l) : [0, 0, 0]; };
    for (let step = 0; step < 6000; step++) {
      // the step: a tenth of the way to the nearest charge, within a fiftieth and a thousandth of the frame
      const dNear = Math.min(...xs.map((x) => len(sub(p, x))));
      const h = Math.max(0.001 * R, Math.min(0.02 * R, 0.1 * dNear));
      const k1 = dir(p), k2 = dir(add(p, scl(k1, h / 2))), k3 = dir(add(p, scl(k2, h / 2))), k4 = dir(add(p, scl(k3, h)));
      p = add(p, scl(add(add(k1, scl(k2, 2)), add(scl(k3, 2), k4)), h / 6));
      pts.push(p);
      for (let j = 0; j < n; j++) {
        if (j === i || Math.sign(src.charges[j].q) === Math.sign(src.charges[i].q)) continue;
        if (len(sub(p, xs[j])) <= start[j]) { pts.push(xs[j]); return { pts, from: i, to: j, end: 'charge' }; }
      }
      if (len(sub(p, centre)) > R) return { pts, from: i, to: null, end: 'frame' };
      if (len(k1) === 0) break;
    }
    return { pts, from: i, to: null, end: 'stopped' };
  };
  const lines = [], arrive = new Array(n).fill(0);
  src.charges.forEach((c, i) => {
    if (c.q <= 0) return;
    for (const d of seeds(want[i], normal, 0.5)) { const ln = trace(d, i, 1); lines.push(ln); if (ln.to !== null) arrive[ln.to]++; }
  });
  src.charges.forEach((c, i) => {
    if (c.q >= 0) return;
    let lack = want[i] - arrive[i];
    if (lack <= 0) return;
    for (const d of seeds(want[i], normal, 0.5)) {
      if (lack <= 0) break;
      const ln = trace(d, i, -1);
      if (ln.to !== null) continue;   // it ends on a positive charge: a line from that charge draws it
      lines.push(ln); lack--;
    }
  });
  // how many lines each charge carries: started there or ended there
  const carried = new Array(n).fill(0);
  for (const ln of lines) { carried[ln.from]++; if (ln.to !== null) carried[ln.to]++; }
  return { lines, per: src.charges.map((c, i) => ({ id: c.id, want: want[i], carried: carried[i] })) };
}

/** Thin a polyline to at most `max` points, keeping its ends. */
export function thin(pts, max = 80) {
  if (pts.length <= max) return pts;
  const out = [];
  for (let i = 0; i < max; i++) out.push(pts[Math.round((i * (pts.length - 1)) / (max - 1))]);
  return out;
}
