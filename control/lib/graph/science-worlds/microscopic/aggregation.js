/**
 * Aggregation: a species that binds to itself, counted. The `aggregation` law's pass over a microscopic run: its own
 * seeded Gillespie (Gillespie 1977) on the aggregates in the well-mixed volume, sampled at the run's times. The spheres
 * on the page are where the monomers start; the aggregation is counted, not drawn, and the page says so.
 *
 *   mode 'nucleation' — nucleated growth (Oosawa & Kasai 1962): `nucleus` monomers come together into a nucleus at
 *     `nucleate`·[M]^n (M^(1−n)/s), a filament adds a monomer at `grow`·[M] (/M/s), and one longer than a nucleus loses
 *     one at `shrink` (/s). Slow to start and quick once seeded: the S-curve, its lag falling as the monomer is richer.
 *   mode 'coalescence' — any two clusters merge at the constant kernel `kernel` (/M/s), Smoluchowski's (1917) simplest
 *     case, whose mean field is exact: N(t) = N₀ / (1 + ½·K·n₀·t), the gate this mode is held to.
 *
 * Each sphere stands for `represents` molecules, as the reactions take them: every event moves that many.
 *
 *   runAggregation(entry, { species, index, counts0, t, NAV, w, seed }) → { series, readout, gates, assumption, capped }
 */

import { microscopic } from './kernel.js';

const MAX_EVENTS = 200000;
const sig = (v, n = 6) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(n) : v);
const gate = (id, want, ok, value, detail) => ({ id, want, ok: !!ok, value, detail });

// the sizes as a short histogram: each size up to 12, then doubling bins
function histogram(sizes) {
  const bins = new Map();
  for (const n of sizes) {
    const key = n <= 12 ? String(n) : (() => { let lo = 13, hi = 24; while (n > hi) { lo = hi + 1; hi = hi * 2; } return `${lo}–${hi}`; })();
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...bins.entries()].sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10)));
}

export function runAggregation(entry, { counts0, t, NAV, w, seed, of }) {
  const rand = microscopic.mulberry32(seed * 2654435761 + 13);
  const m0 = counts0;
  const conc = (n) => (n * w) / NAV;                       // mol/m³
  const series = { free: [], aggregates: [], fraction: [] };
  let events = 0, capped = false;
  const gates = [];

  if (entry.mode === 'coalescence') {
    // clusters by size; any two merge at K·(w/NAV) per pair (counts of spheres)
    const sizes = new Array(m0).fill(1);
    const c = (entry.kernel * w) / NAV;
    let now = 0;
    const N = [];
    for (let k = 0; k < t.length; k++) {
      while (sizes.length > 1 && !capped) {
        const a = (c * sizes.length * (sizes.length - 1)) / 2;
        const dt = -Math.log(1 - rand()) / a;
        if (now + dt > t[k]) break;
        now += dt;
        const i = Math.floor(rand() * sizes.length);
        let j = Math.floor(rand() * (sizes.length - 1));
        if (j >= i) j++;
        sizes[Math.min(i, j)] += sizes[Math.max(i, j)];
        sizes[Math.max(i, j)] = sizes[sizes.length - 1];
        sizes.pop();
        if (++events >= MAX_EVENTS) capped = true;
      }
      now = Math.max(now, t[k]);   // an event past the sample is redrawn from it (the waits are memoryless)
      N.push(sizes.length);
      series.free.push(sizes.filter((s) => s === 1).length * w);
      series.aggregates.push(sizes.length * w);
      series.fraction.push(sig(1 - sizes.filter((s) => s === 1).length / m0, 6));
    }
    // Smoluchowski's mean field for the constant kernel; the run is held to it at four to five of its standard errors
    const n0 = conc(m0), K = entry.kernel;
    let worst = 0, at = 0;
    t.forEach((time, k) => {
      const want = m0 / (1 + 0.5 * K * n0 * time);
      const room = 5 * Math.sqrt(want) + 2;
      const off = Math.abs(N[k] - want) / room;
      if (off > worst) { worst = off; at = k; }
    });
    const endWant = m0 / (1 + 0.5 * K * n0 * t[t.length - 1]);
    gates.push(gate('closed-form:smoluchowski', 'clusters merging at a constant rate fall as Smoluchowski\'s N₀ / (1 + ½·K·n₀·t), within five standard errors of the count (plus two)',
      worst <= 1 && !capped, { expected: { clusters: sig(endWant * w) }, measured: { clusters: N[N.length - 1] * w }, worst: sig(worst, 3), at: sig(t[at], 4) },
      capped ? 'the event budget ran out before the run ended' : worst <= 1 ? 'the count follows the textbook curve' : 'the count leaves the textbook curve: too few clusters to trust, or a wrong kernel'));
    const mean = (m0 / sizes.length);
    return {
      series, gates, capped, events,
      assumption: 'Aggregation (coalescence): any two clusters merge at one rate, whatever their sizes (the constant kernel), in a well-mixed volume; clusters never break apart.',
      readout: {
        mode: 'coalescence', of, clusters: { start: m0 * w, end: sizes.length * w }, meanSize: sig(mean, 4), sizes: histogram(sizes),
        halfTime: { value: sig(2 / (K * n0), 4), unit: 's', note: 'when Smoluchowski\'s count halves: 2 / (K·n₀)' },
      },
    };
  }

  // nucleation and elongation
  const nc = entry.nucleus, kn = entry.nucleate * 1000 ** (1 - nc);   // to SI: (mol/m³)^(1−n)/s
  const cg = (entry.grow * w) / NAV, ks = entry.shrink ?? 0;
  const fil = [];
  let m = m0, now = 0, long = 0;
  const nucleation = () => {
    if (m < nc) return 0;
    let ff = 1;
    for (let j = 0; j < nc; j++) ff *= (m - j) * w / NAV;   // the falling factorial, as concentrations
    return (kn * ff * NAV) / w;                             // nuclei a second, in spheres' worth
  };
  for (let k = 0; k < t.length; k++) {
    while (!capped) {
      const an = nucleation(), ae = cg * m * fil.length, as = ks * long, a = an + ae + as;
      if (!(a > 0)) break;
      const dt = -Math.log(1 - rand()) / a;
      if (now + dt > t[k]) break;
      now += dt;
      const r = rand() * a;
      if (r < an) { fil.push(nc); m -= nc; }
      else if (r < an + ae) { const f = Math.floor(rand() * fil.length); if (fil[f] === nc) long++; fil[f]++; m--; }
      else {
        // one of the filaments longer than a nucleus, uniformly
        let pick = Math.floor(rand() * long);
        for (let f = 0; f < fil.length; f++) if (fil[f] > nc && pick-- === 0) { fil[f]--; m++; if (fil[f] === nc) long--; break; }
      }
      if (++events >= MAX_EVENTS) capped = true;
    }
    now = Math.max(now, t[k]);
    series.free.push(m * w);
    series.aggregates.push(fil.length * w);
    series.fraction.push(sig(1 - m / m0, 6));
  }
  const total = m + fil.reduce((s, L) => s + L, 0);
  gates.push(gate('mass-conserved', 'every monomer is free or in an aggregate: none made, none lost', total === m0, { monomers: m0 * w, counted: total * w }, total === m0 ? 'the books close' : 'monomers went missing'));
  const when = (f) => { const k = series.fraction.findIndex((x) => x >= f); return k >= 0 ? sig(t[k], 4) : null; };
  const lengths = fil.slice();
  return {
    series, gates, capped, events,
    assumption: `Aggregation (nucleated growth): ${nc} monomers make a nucleus, a filament grows one monomer at a time at one end${ks ? ' and loses one at the rate given' : ''}, in a well-mixed volume; filaments neither break nor join (no secondary nucleation or fragmentation).`,
    readout: {
      mode: 'nucleation', of, nucleus: nc,
      aggregated: { end: series.fraction[series.fraction.length - 1], unit: 'share of the monomer' },
      lag: { value: when(0.1), unit: 's', note: 'when a tenth of the monomer has aggregated' }, half: { value: when(0.5), unit: 's' },
      filaments: lengths.length * w, meanLength: lengths.length ? sig(lengths.reduce((s, L) => s + L, 0) / lengths.length, 4) : null,
      lengths: histogram(lengths),
    },
  };
}
