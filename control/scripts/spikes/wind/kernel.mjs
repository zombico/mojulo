// Wind spike kernel. Self-contained (no imports) so the same closure runs in Node verification and in the browser
// preview via toString(), as the particle-vacuum spike does. Geometry is z-up, metres, seconds.
//
// One field, many consumers, one dial:
//   field      : windAt(x, y, z, t), a mean wind with gusts carried downwind (frozen turbulence), a log profile over
//                the ground, and a slow veer. Analytic in t, so any time can be sampled in any order.
//   flaccidity : φ ∈ [0, 1] on every consumer, the share of the air's push it takes. 0 is every element before this
//                spike: it takes no wind. A φ = 0 element returns its still-air pose exactly.
//   anchored   : a cantilever (blade, culm, branch, leaf, ribbon). The wind adds a sideways load to its own weight; a
//                uniform load in a fixed direction is still the production elastica, rotated and scaled, so the pose
//                comes from the baked table. Its response lags the wind through a damped second-order filter at its
//                own first natural frequency.
//   free       : a particle (dust, leaf, twig). Linear drag toward φ·u, a settling speed, and a lift threshold for
//                grains lying on the ground. Stateful, so it steps at a fixed tick and seeks by replay from checkpoints.
export function buildWind(table) {
  const { nTheta, nB, Bmax, K, data } = table;
  const LB = Math.log1p(Bmax), HALF_PI = Math.PI / 2, G = 9.81, M = 32, ZERO2 = Object.freeze([0, 0]);

  // ── field ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function hash3(ix, iy, iz, seed) {
    let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(iz | 0, 0x7feb352d) ^ Math.imul(seed | 0, 0x85ebca77);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
    return ((h >>> 0) / 4294967296) * 2 - 1;
  }
  const fade = (t) => t * t * (3 - 2 * t);
  function noise3(x, y, z, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    const fx = fade(x - x0), fy = fade(y - y0), fz = fade(z - z0);
    const l = (a, b, f) => a + (b - a) * f;
    const c = (dx, dy, dz) => hash3(x0 + dx, y0 + dy, z0 + dz, seed);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
      l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
  }
  const fbm = (x, y, z, seed) => 0.7 * noise3(x, y, z, seed) + 0.3 * noise3(2.03 * x + 17.1, 2.03 * y - 9.7, 1.7 * z + 3.3, seed + 1);

  // speed: m/s at 2 m; dir: radians the wind blows toward; gust: 0..1; scale: cross-wind gust size (m), streamwise
  // twice that; evolve: s for a gust pattern to change shape; veer: radians of direction wander at gust 1; z0: roughness (m).
  const WIND = Object.freeze({ speed: 0, dir: 0, gust: 0.5, scale: 6, evolve: 5, veer: 0.35, z0: 0.03, seed: 1 });
  function makeWind(o = {}) {
    const w = { ...WIND, ...o };
    for (const k of Object.keys(WIND)) if (!Number.isFinite(w[k])) throw new Error(`wind.${k} must be a finite number`);
    if (w.speed < 0 || w.gust < 0 || w.scale <= 0 || w.evolve <= 0 || w.z0 <= 0) throw new Error('wind: speed, gust ≥ 0; scale, evolve, z0 > 0');
    return Object.freeze(w);
  }
  const profile = (w, z) => Math.log((Math.max(z, 0) + w.z0) / w.z0) / Math.log((2 + w.z0) / w.z0);
  function windAt(w, x, y, z, t, vertical = true) {
    if (w.speed === 0) return [0, 0, 0];
    const c = Math.cos(w.dir), s = Math.sin(w.dir);
    const a = (x * c + y * s - w.speed * t) / (2 * w.scale), b = (-x * s + y * c) / w.scale, e = t / w.evolve;
    const g = fbm(a, b, e, w.seed), v = fbm(a + 31.7, b - 12.3, e, w.seed + 7), p = profile(w, z);
    const sp = w.speed * p * Math.max(0, 1 + 2 * w.gust * g), th = w.dir + w.veer * w.gust * v;
    const up = vertical ? 0.3 * w.speed * p * w.gust * fbm(a - 5.1, b + 44.2, 1.6 * e, w.seed + 13) : 0;
    return [sp * Math.cos(th), sp * Math.sin(th), up];
  }

  // ── anchored: response filter ───────────────────────────────────────────────────────────────────────────────────
  // First mode of a uniform cantilever: f1 = (1.875²/2π)·√(EI/(m L⁴)), and with B = m g L³/(E I) that is √(g/(B L)).
  const naturalFrequency = (B, L) => 0.5596 * Math.sqrt(G / (Math.max(B, 1e-3) * L));
  // The impulse response of a damped oscillator, sampled at M lags over ~4 decay times and normalised to unit DC
  // gain: a steady wind gives exactly the static pose, gusts overshoot and ring at f1.
  function responseWeights(f1, zeta) {
    const w0 = 2 * Math.PI * f1, wd = w0 * Math.sqrt(1 - zeta * zeta), W = Math.min(4 / (zeta * w0), 4);
    const lags = [], wts = []; let sum = 0;
    for (let j = 0; j < M; j++) { const tau = ((j + 0.5) * W) / M, h = Math.exp(-zeta * w0 * tau) * Math.sin(wd * tau); lags.push(tau); wts.push(h); sum += h; }
    return { lags, wts: wts.map((h) => h / sum) };
  }
  // Filtered drag over a station (a place, with a response), per unit sail, before any element's φ. Flexible things
  // streamline as they bend, so drag grows as |u|^(2+V) (V: the Vogel exponent, 0 for a rigid bluff body, about −1
  // for a grass blade); u is in m/s, so a sail is the drag-to-weight ratio at 1 m/s.
  function stationLoad(w, st, t) {
    let rx = 0, ry = 0;
    for (let j = 0; j < st.lags.length; j++) {
      const u = windAt(w, st.pos[0], st.pos[1], st.pos[2], t - st.lags[j], false), m = Math.hypot(u[0], u[1]);
      const g = m > 0 ? Math.pow(m, 1 + st.vogel) : 0;
      rx += st.wts[j] * g * u[0]; ry += st.wts[j] * g * u[1];
    }
    return [rx, ry];
  }

  // ── anchored: pose ──────────────────────────────────────────────────────────────────────────────────────────────
  function lookup(theta, Beff) {
    const ti = Math.min(nTheta - 1, Math.max(0, ((theta + HALF_PI) / Math.PI) * (nTheta - 1)));
    const bj = Math.min(nB - 1, (Math.log1p(Math.min(Math.max(Beff, 0), Bmax)) / LB) * (nB - 1));
    const i0 = Math.min(nTheta - 2, Math.floor(ti)), j0 = Math.min(nB - 2, Math.floor(bj)), fi = ti - i0, fj = bj - j0;
    const at = (i, j, k, c) => data[((i * nB + j) * K + k) * 2 + c];
    const out = [];
    for (let k = 0; k < K; k++) {
      const p = [0, 1].map((c) => (1 - fi) * ((1 - fj) * at(i0, j0, k, c) + fj * at(i0, j0 + 1, k, c)) + fi * ((1 - fj) * at(i0 + 1, j0, k, c) + fj * at(i0 + 1, j0 + 1, k, c)));
      out.push(p);
    }
    return out;
  }
  // R: the sideways load in units of the element's own weight. The total load (R, −1) is uniform in direction, so the
  // elastica holds with B scaled by |load| and θ0 measured from the plane normal to it.
  function pose(el, base, dir, R) {
    const m = Math.sqrt(R[0] * R[0] + R[1] * R[1] + 1), up = [-R[0] / m, -R[1] / m, 1 / m];
    const sn = dir[0] * up[0] + dir[1] * up[1] + dir[2] * up[2];
    let eh = [dir[0] - sn * up[0], dir[1] - sn * up[1], dir[2] - sn * up[2]], n = Math.hypot(...eh);
    if (n < 1e-9) { eh = [up[2], 0, -up[0]]; n = Math.hypot(...eh); if (n < 1e-9) { eh = [1, 0, 0]; n = 1; } }
    eh = eh.map((v) => v / n);
    const shape = lookup(Math.asin(Math.min(1, Math.max(-1, sn))), el.B * m), pts = [base];
    for (const [x, y] of shape) pts.push([0, 1, 2].map((c) => base[c] + el.L * (x * eh[c] + y * up[c])));
    return pts;
  }
  function frameAt(pts, s) {
    const u = Math.min(1, Math.max(0, s)) * K, k = Math.min(K - 1, Math.floor(u)), f = u - k, a = pts[k], b = pts[k + 1];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], n = Math.hypot(...d) || 1;
    return { p: [a[0] + f * d[0], a[1] + f * d[1], a[2] + f * d[2]], t: d.map((v) => v / n) };
  }
  function rotateLike(v, from, to) {      // the rotation taking `from` to `to`, applied to v (Rodrigues)
    const k = [from[1] * to[2] - from[2] * to[1], from[2] * to[0] - from[0] * to[2], from[0] * to[1] - from[1] * to[0]];
    const s = Math.hypot(...k), c = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
    if (s < 1e-12) return v;
    const a = k.map((x) => x / s), kv = [a[1] * v[2] - a[2] * v[1], a[2] * v[0] - a[0] * v[2], a[0] * v[1] - a[1] * v[0]], kd = a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
    return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + a[i] * kd * (1 - c));
  }

  // ── anchored: scene ─────────────────────────────────────────────────────────────────────────────────────────────
  // scene: { stations: [{ pos, B, L, zeta, vogel? }], elements: [{ station, base, dir, L, B, sail, phi, parent?, at?, flutter?, flutterHz?, phase? }] }
  // Elements are in parent-before-child order; a child's base and dir are given in the rest pose and ride its parent.
  const fin = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  function prepareScene(scene) {
    const stations = scene.stations.map((s, i) => {
      const vogel = s.vogel ?? 0;
      if (!fin(s.pos) || !(s.L > 0) || !(s.B >= 0) || !(s.zeta > 0 && s.zeta < 1) || !(vogel > -2 && vogel <= 0)) throw new Error(`station ${i}: pos, L > 0, B ≥ 0, 0 < zeta < 1, −2 < vogel ≤ 0`);
      return { pos: s.pos, vogel, ...responseWeights(naturalFrequency(s.B, s.L), s.zeta), active: false };
    });
    const elements = scene.elements.map((e, i) => {
      if (!fin(e.base) || !fin(e.dir) || !(e.L > 0) || !(e.B >= 0) || !(e.sail >= 0)) throw new Error(`element ${i}: base, dir, L > 0, B ≥ 0, sail ≥ 0`);
      if (!(e.phi >= 0 && e.phi <= 1)) throw new Error(`element ${i}: flaccidity φ must be in [0, 1]`);
      if (!stations[e.station]) throw new Error(`element ${i}: unknown station ${e.station}`);
      const parent = e.parent ?? -1;
      if (parent >= i || (parent >= 0 && !(e.at >= 0 && e.at <= 1))) throw new Error(`element ${i}: parent must come first, with 0 ≤ at ≤ 1`);
      const n = Math.hypot(...e.dir);
      if (e.phi > 0 && e.sail > 0) stations[e.station].active = true;
      return { ...e, parent, dir: e.dir.map((v) => v / n) };
    });
    const prepared = { stations, elements, rest: null };
    prepared.rest = place(prepared, () => ZERO2);
    return prepared;
  }
  function place(P, loadOf) {
    const out = new Array(P.elements.length);
    for (let i = 0; i < P.elements.length; i++) {
      const el = P.elements[i]; let base = el.base, dir = el.dir;
      if (el.parent >= 0) {
        const fd = frameAt(out[el.parent], el.at);
        base = fd.p;
        if (P.rest) dir = rotateLike(el.dir, frameAt(P.rest[el.parent], el.at).t, fd.t);
      }
      out[i] = pose(el, base, dir, loadOf(el));
    }
    return out;
  }
  function sampleScene(P, w, t) {
    const loads = P.stations.map((st) => (st.active && w.speed > 0 ? stationLoad(w, st, t) : ZERO2));
    const pts = place(P, (el) => {
      if (el.phi === 0 || el.sail === 0) return ZERO2;
      const s = loads[el.station], k = el.phi * el.sail; return s === ZERO2 ? ZERO2 : [k * s[0], k * s[1]];
    });
    // Leaf flutter: a roll about the petiole, growing with the station's drag and saturating by about 5 m/s.
    const roll = P.elements.map((el) => {
      if (!el.flutter || el.phi === 0) return 0;
      const s = loads[el.station], a = Math.min(1, Math.hypot(s[0], s[1]) / 8);
      return el.phi * el.flutter * a * Math.sin(2 * Math.PI * (el.flutterHz || 5) * t + (el.phase || 0));
    });
    return { pts, roll };
  }

  // ── free: particles ─────────────────────────────────────────────────────────────────────────────────────────────
  // tau: drag relaxation (s); settle: still-air fall speed (m/s); lift: the ground wind (m/s, at 5 cm) that picks it up.
  const KINDS = Object.freeze({
    dust: Object.freeze({ tau: 0.04, settle: 0.12, lift: 0.9 }),
    leaf: Object.freeze({ tau: 0.3, settle: 0.9, lift: 1.8 }),
    twig: Object.freeze({ tau: 1.0, settle: 3.0, lift: 3.2 }),
  });
  const KIND_NAMES = Object.keys(KINDS);
  function makeParticles(list, domain) {
    if (!(domain && domain.W > 0 && domain.H > 0 && Number.isFinite(domain.x0) && Number.isFinite(domain.y0))) throw new Error('particles: domain { x0, y0, W > 0, H > 0 }');
    const n = list.length, f = () => new Float64Array(n);
    const st = { n, domain, tick: 0, kind: new Uint8Array(n), phi: f(), x: f(), y: f(), z: f(), vx: f(), vy: f(), vz: f() };
    list.forEach((p, i) => {
      const k = KIND_NAMES.indexOf(p.kind);
      if (k < 0 || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !(p.phi >= 0 && p.phi <= 1)) throw new Error(`particle ${i}: kind, x, y, φ ∈ [0, 1]`);
      st.kind[i] = k; st.phi[i] = p.phi; st.x[i] = p.x; st.y[i] = p.y; st.z[i] = Math.max(0, p.z || 0);
    });
    return st;
  }
  const cloneParticles = (s) => ({ ...s, kind: s.kind.slice(), phi: s.phi.slice(), x: s.x.slice(), y: s.y.slice(), z: s.z.slice(), vx: s.vx.slice(), vy: s.vy.slice(), vz: s.vz.slice() });
  const wrap = (v, o, L) => o + ((((v - o) % L) + L) % L);
  function stepParticles(s, w, dt) {
    const t = s.tick * dt, { x0, y0, W, H } = s.domain;
    for (let i = 0; i < s.n; i++) {
      const P = KINDS[KIND_NAMES[s.kind[i]]], phi = s.phi[i];
      let ux = 0, uy = 0, uz = 0;
      if (phi > 0 && w.speed > 0) { const u = windAt(w, s.x[i], s.y[i], Math.max(s.z[i], 0.05), t); ux = phi * u[0]; uy = phi * u[1]; uz = phi * u[2]; }
      if (s.z[i] <= 0) {
        const uh = Math.hypot(ux, uy);
        if (uh > P.lift) { s.vz[i] = 0.6 * (uh - P.lift); s.vx[i] = 0.5 * ux; s.vy[i] = 0.5 * uy; }
        else {                                          // resting or sliding to a stop
          const d = Math.exp(-dt / 0.15); s.vx[i] *= d; s.vy[i] *= d; s.vz[i] = 0;
          s.x[i] = wrap(s.x[i] + s.vx[i] * dt, x0, W); s.y[i] = wrap(s.y[i] + s.vy[i] * dt, y0, H); continue;
        }
      }
      const a = dt / P.tau;                             // implicit drag: stable for any tau
      s.vx[i] = (s.vx[i] + a * ux) / (1 + a); s.vy[i] = (s.vy[i] + a * uy) / (1 + a); s.vz[i] = (s.vz[i] + a * (uz - P.settle)) / (1 + a);
      s.x[i] = wrap(s.x[i] + s.vx[i] * dt, x0, W); s.y[i] = wrap(s.y[i] + s.vy[i] * dt, y0, H); s.z[i] += s.vz[i] * dt;
      if (s.z[i] <= 0) { s.z[i] = 0; s.vz[i] = 0; s.vx[i] *= 0.5; s.vy[i] *= 0.5; }
    }
    s.tick++;
    return s;
  }
  // Seeking: fixed ticks, a checkpoint each `every` ticks. Any time is the same state however it was reached.
  function makeTimeline(initial, w, dt = 1 / 60, every = 60) {
    const marks = [cloneParticles(initial)];
    return {
      dt,
      at(t) {
        const target = Math.max(0, Math.round(t / dt)), c = Math.min(Math.floor(target / every), marks.length - 1);
        let s = cloneParticles(marks[c]);
        while (s.tick < target) { stepParticles(s, w, dt); if (s.tick % every === 0 && s.tick / every === marks.length) marks.push(cloneParticles(s)); }
        return s;
      },
    };
  }

  return { WIND, KINDS, makeWind, profile, windAt, naturalFrequency, responseWeights, lookup, pose, frameAt, prepareScene, sampleScene, makeParticles, cloneParticles, stepParticles, makeTimeline };
}
