/**
 * Closed forms the classical solver checks itself against: a second closed table. When a composed model happens to be
 * a setup physics has an exact answer for (a vacuum projectile, a pendulum at any amplitude, a Kepler orbit, a
 * cyclotron turn…), the run is measured and compared with that answer. It is the machine gate's sharpest test of the
 * stepper, and the teacher's "this is the textbook number" readout.
 *
 *   matcher = {
 *     id, want,                                   the gate's id is `closed-form:<id>`; want says the formula and tolerance
 *     applies(m) → args | null                    m = { bodies, laws: [{ row, entry }], frame, duration }
 *     expect(args) → { quantity: value }
 *     measure(run, args) → { quantity: value }
 *     needs?(expected) → seconds                  the run must last this long to measure it (two periods and a bit);
 *                                                 a shorter run skips the check rather than failing it
 *     tol                                         relative
 *   }
 */

import { along, period, peak, returnRange, at, vel } from './measure.js';
import { ends } from './laws.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = len(a); return a.map((c) => c / l); };
const parallel = (a, b) => len(cross(a, b)) <= 1e-12 * (len(a) * len(b) || 1);

/** The complete elliptic integral of the first kind, K(k), by the arithmetic–geometric mean. */
export function ellipticK(k) {
  let a = 1, b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-16 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}

// the model is exactly these law ids (in any order), each once
const only = (m, ...wanted) => m.laws.length === wanted.length && wanted.every((id) => m.laws.filter((l) => l.row.id === id).length === 1);
const law = (m, id) => m.laws.find((l) => l.row.id === id).entry;
const lone = (m) => {
  const freeIdx = m.bodies.map((b, i) => i).filter((i) => !m.bodies[i].fixed);
  return freeIdx.length === 1 ? freeIdx[0] : -1;
};
const gOf = (m) => (m.laws.find((l) => l.row.id === 'gravity-uniform')?.entry.g ?? m.frame.g);

export const CLASSICAL_CLOSED_FORMS = [
  {
    id: 'ballistic',
    want: 'apex h = v↑²/2g and range R = 2·v↑·v→/g, within 0.1%',
    tol: 1e-3,
    applies(m) {
      const i = lone(m);
      if (i < 0 || !only(m, 'gravity-uniform')) return null;
      const g = gOf(m), up = m.frame.up, v = m.bodies[i].v, vu = dot(v, up);
      if (!(vu > 0)) return null;
      const vh = len(sub(v, up.map((c) => c * vu)));
      return { i, g, up, vu, vh, lands: m.duration >= 2 * vu / g };
    },
    expect: (a) => ({ apex: (a.vu * a.vu) / (2 * a.g), ...(a.lands && a.vh > 0 ? { range: (2 * a.vu * a.vh) / a.g } : {}) }),
    measure: (run, a) => {
      const h = along(run, a.i, a.up);
      return { apex: peak(h) - h[0], ...(a.lands && a.vh > 0 ? { range: returnRange(run, a.i, a.up) } : {}) };
    },
  },
  {
    id: 'harmonic',
    want: 'period T = 2π·√(m/k), within 0.1%',
    tol: 1e-3,
    needs: (x) => 2.2 * x.period,
    applies(m) {
      const i = lone(m);
      if (i < 0 || !(only(m, 'spring') || only(m, 'spring', 'gravity-uniform'))) return null;
      const s = law(m, 'spring');
      if ((s.damping ?? 0) > 0) return null;
      const e = ends(s, m.ctx);
      if (e.b >= 0 || e.a !== i) return null;
      const axis = sub(m.bodies[i].at, e.anchor);
      if (!(len(axis) > 0) || !parallel(axis, m.bodies[i].v) && len(m.bodies[i].v) > 0) return null;
      if (m.laws.length === 2 && !parallel(axis, m.frame.up)) return null;
      return { i, axis: unit(axis), m: m.bodies[i].mass, k: s.k };
    },
    expect: (a) => ({ period: 2 * Math.PI * Math.sqrt(a.m / a.k) }),
    measure: (run, a) => ({ period: period(along(run, a.i, a.axis), run.t) }),
  },
  {
    id: 'pendulum',
    want: 'period T = 4·√(L/g)·K(sin(θ₀/2)) at any amplitude, within 0.1%',
    tol: 1e-3,
    needs: (x) => 2.2 * x.period,
    applies(m) {
      const i = lone(m);
      if (i < 0 || !only(m, 'gravity-uniform', 'rod')) return null;
      const rod = law(m, 'rod'), e = ends(rod, m.ctx);
      if (e.b >= 0 || e.a !== i || len(m.bodies[i].v) > 0) return null;
      const up = m.frame.up, d = sub(m.bodies[i].at, e.anchor), L = rod.length ?? len(d);
      const theta = Math.acos(Math.max(-1, Math.min(1, -dot(d, up) / len(d))));
      if (!(theta > 1e-6 && theta < Math.PI - 1e-3)) return null;
      const horiz = sub(d, up.map((c) => c * dot(d, up)));
      return { i, L, g: gOf(m), theta, axis: unit(horiz) };
    },
    expect: (a) => ({ period: 4 * Math.sqrt(a.L / a.g) * ellipticK(Math.sin(a.theta / 2)) }),
    measure: (run, a) => ({ period: period(along(run, a.i, a.axis), run.t) }),
  },
  {
    id: 'kepler',
    want: 'period T = 2π·√(a³/μ), a from the orbit\'s energy, within 0.1%',
    tol: 1e-3,
    needs: (x) => 2.2 * x.period,
    applies(m) {
      if (m.bodies.length !== 2 || !only(m, 'gravity-newton')) return null;
      const [A, B] = m.bodies;
      if (A.fixed && B.fixed) return null;
      const G = law(m, 'gravity-newton').G ?? m.G;
      const mu = G * (A.fixed ? A.mass : B.fixed ? B.mass : A.mass + B.mass);
      const r = sub(B.at, A.at), v = sub(B.v, A.v), eps = dot(v, v) / 2 - mu / len(r);
      // a head-on fall is a degenerate orbit through the centre: no period to check
      if (!(eps < 0) || len(cross(r, v)) <= 1e-9 * len(r) * len(v)) return null;
      const a = -mu / (2 * eps);
      return { a, mu, axis: unit(r) };
    },
    expect: (a) => ({ period: 2 * Math.PI * Math.sqrt((a.a * a.a * a.a) / a.mu) }),
    measure: (run, a) => ({ period: period(run.t.map((t, k) => dot(sub(at(run, k, 1), at(run, k, 0)), a.axis)), run.t) }),
  },
  {
    id: 'cyclotron',
    want: 'period T = 2π·m/(|q|·B) and radius r = m·v⊥/(|q|·B), within 0.1%',
    tol: 1e-3,
    needs: (x) => 2.2 * x.period,
    applies(m) {
      const i = lone(m);
      if (i < 0 || !only(m, 'lorentz')) return null;
      const f = law(m, 'lorentz'), B = f.B ?? [0, 0, 0], E = f.E ?? [0, 0, 0], b = m.bodies[i];
      if (len(E) > 0 || !(len(B) > 0) || !b.charge) return null;
      const bh = unit(B), vperp = sub(b.v, bh.map((c) => c * dot(b.v, bh)));
      if (!(len(vperp) > 0)) return null;
      return { i, m: b.mass, q: Math.abs(b.charge), B: len(B), vp: len(vperp), axis: unit(vperp) };
    },
    expect: (a) => ({ period: (2 * Math.PI * a.m) / (a.q * a.B), radius: (a.m * a.vp) / (a.q * a.B) }),
    measure: (run, a) => {
      const s = along(run, a.i, a.axis);
      return { period: period(s, run.t), radius: (peak(s) + peak(s.map((c) => -c))) / 2 };
    },
  },
  {
    id: 'terminal',
    want: 'terminal speed m·g/b (linear drag) or √(m·g/(½ρCdA)) (quadratic), within 0.1%',
    tol: 1e-3,
    applies(m) {
      const i = lone(m), g = gOf(m), b = m.bodies[i];
      if (i < 0) return null;
      if (only(m, 'gravity-uniform', 'drag-linear')) {
        const d = law(m, 'drag-linear');
        if (len(d.wind ?? [0, 0, 0]) > 0) return null;
        const k = d.b !== undefined ? d.b : 6 * Math.PI * d.viscosity * b.radius;
        return m.duration >= 12 * b.mass / k ? { i, vt: (b.mass * g) / k } : null;
      }
      if (only(m, 'gravity-uniform', 'drag-quadratic')) {
        const d = law(m, 'drag-quadratic');
        if (len(d.wind ?? [0, 0, 0]) > 0) return null;
        const kq = 0.5 * (d.rho ?? 1.225) * (d.cd ?? 0.47) * (d.area ?? Math.PI * b.radius ** 2), vt = Math.sqrt((b.mass * g) / kq);
        return m.duration >= 8 * vt / g + len(b.v) / g ? { i, vt } : null;
      }
      return null;
    },
    expect: (a) => ({ speed: a.vt }),
    measure: (run, a) => ({ speed: Math.hypot(...vel(run, run.t.length - 1, a.i)) }),
  },
  {
    id: 'incline',
    want: 'slide distance s = ½·g·(sin α − μ·cos α)·t² from rest (0 when μs ≥ tan α), within 0.1%',
    tol: 1e-3,
    applies(m) {
      const i = lone(m);
      if (i < 0 || !only(m, 'gravity-uniform', 'plane') || len(m.bodies[i].v) > 0) return null;
      const p = m.resolved.planes[0];
      if (!m.restingOn(i, 0)) return null;
      const cos = dot(p.n, m.frame.up), sin = Math.sqrt(Math.max(0, 1 - cos * cos));
      if (!(cos > 0)) return null;
      const g = gOf(m), a = sin <= p.mus * cos ? 0 : g * (sin - p.mu * cos);
      return { i, a: Math.max(0, a), t: m.duration };
    },
    expect: (a) => ({ distance: 0.5 * a.a * a.t * a.t }),
    measure: (run, a) => ({ distance: len(sub(at(run, run.t.length - 1, a.i), at(run, 0, a.i))) }),
  },
  {
    id: 'collision',
    want: 'head-on final speeds v₁′, v₂′ from momentum and restitution e, within 0.1%',
    tol: 1e-3,
    applies(m) {
      if (m.bodies.length !== 2 || m.bodies.some((b) => b.fixed) || !only(m, 'collision')) return null;
      const [A, B] = m.bodies, line = sub(B.at, A.at);
      if (!parallel(line, A.v) && len(A.v) > 0 || !parallel(line, B.v) && len(B.v) > 0) return null;
      const n = unit(line), u1 = dot(A.v, n), u2 = dot(B.v, n), closing = u1 - u2;
      if (!(closing > 0)) return null;
      if (m.duration <= (len(line) - A.radius - B.radius) / closing * 1.05) return null;
      const e = law(m, 'collision').e ?? 1, M = A.mass + B.mass, P = A.mass * u1 + B.mass * u2;
      return { n, v1: (P + B.mass * e * (u2 - u1)) / M, v2: (P + A.mass * e * (u1 - u2)) / M };
    },
    expect: (a) => ({ v1: a.v1, v2: a.v2 }),
    measure: (run, a) => {
      const k = run.t.length - 1;
      return { v1: dot(vel(run, k, 0), a.n), v2: dot(vel(run, k, 1), a.n) };
    },
  },
];

/** Every closed form that applies, as gates: `{ id, want, ok, value: { expected, measured, error }, detail }`. */
export function closedFormGates(m, run) {
  const out = [];
  for (const cf of CLASSICAL_CLOSED_FORMS) {
    const args = cf.applies(m);
    if (!args) continue;
    const expected = cf.expect(args);
    if (cf.needs && m.duration < cf.needs(expected)) continue;
    const measured = cf.measure(run, args);
    let worst = 0, missing = [];
    for (const [q, ev] of Object.entries(expected)) {
      const mv = measured[q];
      if (mv === null || mv === undefined || !Number.isFinite(mv)) { missing.push(q); continue; }
      const err = Math.abs(mv - ev) / (Math.abs(ev) || 1);
      if (err > worst) worst = err;
    }
    const ok = !missing.length && worst <= cf.tol;
    out.push({
      id: `closed-form:${cf.id}`, want: cf.want, ok,
      value: { expected: round(expected), measured: round(measured), error: +worst.toPrecision(3) },
      detail: missing.length ? `could not measure ${missing.join(', ')} within the run` : ok ? 'the run matches the textbook answer' : `off by ${(worst * 100).toPrecision(3)}%`,
    });
  }
  return out;
}

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? +v.toPrecision(6) : v]));
