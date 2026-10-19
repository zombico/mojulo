/**
 * The microscopic kernel — overdamped Brownian dynamics with drift, reflecting or periodic box walls, partially
 * permeable membranes, and reactions drawn by Gillespie's algorithm on the well-mixed counts. Records what the gates
 * and the page read: counts per species, counts on each side of each membrane, every species' displacement statistics
 * (from molecules unchanged since t = 0), and the tracks of the molecules the page shows.
 *
 * SINGLE SOURCE OF TRUTH, the `physics-sim.js` pattern: `buildMicroscopic()` references nothing outside itself, so its
 * text is a complete unit a page can run. Seeded (mulberry32, its own copy inside the closure for that reason): the
 * same system, options and seed give byte-identical output. No clock, no `Math.random`.
 *
 *   system = {
 *     box:       { lo: [3], hi: [3], periodic },
 *     species:   [{ id, D, r, v: [3] }],                      v: the drift velocity on that species (zero for none)
 *     particles: [{ s, x: [3] }],                             the molecules at t = 0
 *     membranes: [{ axis, at, pass: [per species] }],        pass: crossing probability per hit (P·√(πΔt/D))
 *     reactions: [{ from: [s], to: [s], c }],                c: propensity per reactant combination, per second
 *     display:   [particle index],                          the molecules the page draws (a subset when many)
 *     near:      true,                                       a bimolecular event picks the partner nearest the first
 *   }
 */

export function buildMicroscopic() {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function run(sys, { dt, substeps, samples, interval, seed, maxEvents = 200000 }) {
    const rand = mulberry32(seed);
    let spare = null;
    const gauss = () => {
      if (spare !== null) { const g = spare; spare = null; return g; }
      let u = 0; while (u <= 1e-300) u = rand();
      const v = rand(), m = Math.sqrt(-2 * Math.log(u));
      spare = m * Math.sin(2 * Math.PI * v);
      return m * Math.cos(2 * Math.PI * v);
    };
    const S = sys.species.length, box = sys.box;
    // the molecules: species (−1 once gone), position, unwrapped position (periodic walls), where it started
    const P = sys.particles.map((p) => ({ s: p.s, x: p.x.slice(), u: p.x.slice(), x0: p.x.slice(), kept: true }));
    const count = new Array(S).fill(0);
    for (const p of P) count[p.s]++;
    const shown = new Map(sys.display.map((i) => [i, true]));
    const tracks = new Map(sys.display.map((i) => [i, [{ s: P[i].s, k0: 0, path: [] }]]));
    const steps = sys.species.map((sp) => Math.sqrt(2 * sp.D * dt));
    const out = { t: [], counts: [], sides: sys.membranes.map(() => []), msd: [], mean: [], events: 0, first: null };

    const record = (k) => {
      out.t.push(k * interval);
      out.counts.push(count.slice());
      sys.membranes.forEach((M, mi) => {
        const left = new Array(S).fill(0);
        for (const p of P) if (p.s >= 0 && p.x[M.axis] < M.at) left[p.s]++;
        out.sides[mi].push(left);
      });
      const n = new Array(S).fill(0), sum = sys.species.map(() => [0, 0, 0]), sq = new Array(S).fill(0);
      for (const p of P) {
        if (!p.kept || p.s < 0) continue;
        const d = [p.u[0] - p.x0[0], p.u[1] - p.x0[1], p.u[2] - p.x0[2]];
        n[p.s]++; for (let c = 0; c < 3; c++) sum[p.s][c] += d[c];
        sq[p.s] += d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
      }
      out.mean.push(sum.map((v, s) => (n[s] ? v.map((c) => c / n[s]) : [0, 0, 0])));
      // the displacement's variance about its mean: 6·D·t for free diffusion, with or without a drift
      out.msd.push(sq.map((q, s) => (n[s] ? q / n[s] - (sum[s][0] ** 2 + sum[s][1] ** 2 + sum[s][2] ** 2) / (n[s] * n[s]) : 0)));
      for (const [i, segs] of tracks) { const seg = segs[segs.length - 1]; if (seg.k1 === undefined) seg.path.push(P[i].x.slice()); }
    };

    // ── reactions: Gillespie on the counts ──
    const choose = (n, k) => (k === 1 ? n : k === 2 ? (n * (n - 1)) / 2 : 1);
    const propensity = (R) => {
      if (R.from.length === 1) return R.c * count[R.from[0]];
      if (R.from[0] === R.from[1]) return R.c * choose(count[R.from[0]], 2);
      return R.c * count[R.from[0]] * count[R.from[1]];
    };
    const pick = (s, not = -1) => {
      let n = 0; for (let i = 0; i < P.length; i++) if (P[i].s === s && i !== not) n++;
      let r = Math.floor(rand() * n);
      for (let i = 0; i < P.length; i++) if (P[i].s === s && i !== not) { if (r-- === 0) return i; }
      return -1;
    };
    const nearest = (s, from) => {
      let best = -1, bd = Infinity;
      for (let i = 0; i < P.length; i++) {
        if (P[i].s !== s || i === from) continue;
        const d = (P[i].x[0] - P[from].x[0]) ** 2 + (P[i].x[1] - P[from].x[1]) ** 2 + (P[i].x[2] - P[from].x[2]) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    };
    const retag = (i, s, k) => {
      if (tracks.has(i)) {
        const segs = tracks.get(i), seg = segs[segs.length - 1];
        seg.k1 = k;
        if (s >= 0) segs.push({ s, k0: k, path: [] });   // filled from the next record on
      }
      P[i].s = s; P[i].kept = false;
    };
    const fire = (R, k, t) => {
      const used = [];
      for (let j = 0; j < R.from.length; j++) {
        const i = j === 1 && sys.near && used.length ? nearest(R.from[1], used[0]) : pick(R.from[j], used[0] ?? -1);
        if (i < 0) return;
        used.push(i);
      }
      for (const s of R.from) count[s]--;
      for (const s of R.to) count[s]++;
      const at = P[used[0]].x;
      R.to.forEach((s, j) => {
        if (j < used.length) retag(used[j], s, k);
        else {
          // a product with no reactant to stand in for: a new molecule beside the first reactant
          const x = at.map((c) => c + (rand() - 0.5) * 2 * Math.max(sys.species[s].r, 1e-12) * 4);
          P.push({ s, x, u: x.slice(), x0: x.slice(), kept: false });
          if (shown.has(used[0])) { shown.set(P.length - 1, true); tracks.set(P.length - 1, [{ s, k0: k, path: [] }]); }
        }
      });
      for (let j = R.to.length; j < used.length; j++) retag(used[j], -1, k);
      out.events++;
      if (!out.first) out.first = { t, particle: used[0] };
    };
    let tNext = Infinity, a = [], a0 = 0;
    const draw = (t) => {
      a = sys.reactions.map(propensity);
      a0 = a.reduce((x, y) => x + y, 0);
      if (!(a0 > 0)) { tNext = Infinity; return; }
      let u = 0; while (u <= 1e-300) u = rand();
      tNext = t - Math.log(u) / a0;
    };
    const react = (t0, t1, k) => {
      while (tNext <= t1) {
        if (out.events >= maxEvents) { out.capped = true; tNext = Infinity; return; }
        const t = tNext;
        let r = rand() * a0, j = 0;
        while (j < a.length - 1 && r >= a[j]) { r -= a[j]; j++; }
        fire(sys.reactions[j], k, t);
        draw(t);
      }
    };

    // ── motion ──
    const L = [0, 1, 2].map((c) => box.hi[c] - box.lo[c]);
    const Ms = sys.membranes, nM = Ms.length, side = new Array(nM);
    const move = (p) => {
      const v = sys.species[p.s].v, st = steps[p.s], x = p.x, u = p.u;
      for (let m = 0; m < nM; m++) side[m] = x[Ms[m].axis] < Ms[m].at;
      const d0 = v[0] * dt + st * gauss(), d1 = v[1] * dt + st * gauss(), d2 = v[2] * dt + st * gauss();
      x[0] += d0; x[1] += d1; x[2] += d2; u[0] += d0; u[1] += d1; u[2] += d2;
      for (let m = 0; m < nM; m++) {
        const M = Ms[m];
        if ((x[M.axis] < M.at) !== side[m] && !(rand() < M.pass[p.s])) x[M.axis] = 2 * M.at - x[M.axis];
      }
      for (let c = 0; c < 3; c++) {
        if (box.periodic) {
          while (p.x[c] < box.lo[c]) p.x[c] += L[c];
          while (p.x[c] >= box.hi[c]) p.x[c] -= L[c];
        } else {
          if (p.x[c] < box.lo[c]) p.x[c] = 2 * box.lo[c] - p.x[c];
          if (p.x[c] > box.hi[c]) p.x[c] = 2 * box.hi[c] - p.x[c];
          p.x[c] = Math.min(box.hi[c], Math.max(box.lo[c], p.x[c]));
          p.u[c] = p.x[c];   // a reflecting wall folds the walk: the unwrapped path is the real one
        }
      }
    };

    draw(0);
    record(0);
    for (let k = 1; k <= samples; k++) {
      for (let s = 0; s < substeps; s++) {
        const t0 = ((k - 1) * substeps + s) * dt, t1 = t0 + dt;
        for (const p of P) if (p.s >= 0) move(p);
        react(t0, t1, k);
      }
      record(k);
    }
    for (const segs of tracks.values()) { const seg = segs[segs.length - 1]; if (seg.k1 === undefined) seg.k1 = samples; }
    out.tracks = [...tracks.entries()].map(([i, segs]) => ({ particle: i, segs }));
    return out;
  }

  return { run, mulberry32 };
}

export const microscopic = buildMicroscopic();
