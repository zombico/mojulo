/**
 * SKIN RELIEF — the epidermis cube's skin: what makes a surface read as skin, conveyed rather than simulated, as a
 * height (mm) and a roughness at any point of a flat CHART (u, v in mm; +u right, +v up). A swatch studies it in the
 * chart; the head will map its own charts onto it. Gray: no colour here, only relief and sheen.
 *
 * The layers, coarse to fine, and the FIDELITY tier that turns each on (`SKIN_FIDELITY`; each tier adds to the last):
 *
 *   form      nothing: the surface as the field made it.
 *   creases   thin lines at the BONE/SKIN CONNECTIONS (tethers, where ligaments hold skin to bone), running across the
 *             muscle's pull: RADIAL ones fan from a point (crow's feet off the lateral orbital rim), ALONG ones run
 *             beside the tether (under-eye, forehead). Each is a seeded wavy line, tapered at its ends, sometimes
 *             forked, the skin bunched into low shoulders beside it with a faint companion line either side; a
 *             shallow trough marks the tether itself.
 *   keratin   the PRIMARY LINES: two crossing families of long, wavering furrows either side of the skin's tension
 *             direction (closer to it the more the region's tension stretches the skin), deep in stretches and
 *             fading in others, with a weaker family across; between them the rhomboid plateaus. PORES sit at the
 *             primary crossings, round, a seeded share of them, sized by region. A faint MINOR NET (a cellular field
 *             stretched along the tension, turned to follow a crease near one) breaks the plateaus.
 *   micro     the finest net, the corneum's grain, and its sheen: matte in the furrows and pores, a little gloss on
 *             the plateaus (the roughness).
 *
 * Dials: `region` (a `SKIN_REGIONS` name or its numbers), `age` 0 … 1 (deeper, coarser, more directional furrows;
 * more and deeper creases; larger pores; a fainter fine net), `squint` 0 … 1 (a compression across the creases that
 * deepens them), `pores` and `creases` (scales; 0 grows none), `angle` (the tension direction in degrees from +u,
 * over the region's), `tethers` (in chart mm), `seed`. Real scales: furrows 20–80 µm deep, plateaus 0.3–0.8 mm,
 * pores 0.03–0.15 mm across, fine lines 0.06–0.15 mm wide.
 *
 *   skinRelief(spec) → { at(u, v) → { h, rough, furrow, pore, crease }, lines, dir(u, v) }
 *
 * Pure and deterministic: lattice hashes and seeded dice, no clock. An absent layer adds nothing.
 */
import { hash3, vnoise } from '../era/dirt.js';
import { streamOf } from '../city/plan/dice.js';

export const SKIN_FIDELITY = Object.freeze(['form', 'creases', 'keratin', 'micro']);

/**
 * Regions of the face, each skin's own numbers (readings of dermatological measures, tuned on the eyes gate): `cell`
 * the primary lines' spacing (mm), `aniso` how much the tension stretches the skin (the line families close toward
 * its direction), `furrow` the primary lines' depth (µm, at age 0), `pore` a pore's radius (mm) and `poreShare` the
 * share of primary crossings that hold one, `angle` the tension's direction (degrees from +u, the chart's across),
 * `net` the minor net's depth over the primary lines' (0.45 when absent); a pore-dense skin (the nose) scatters more
 * pores among the lines, `poreGap` mm apart, `gapShare` of them.
 */
export const SKIN_REGIONS = Object.freeze({
  forehead: { cell: 0.6, aniso: 1.7, furrow: 26, pore: 0.04, poreShare: 0.35, angle: 0 },
  cheek: { cell: 0.5, aniso: 1.45, furrow: 22, pore: 0.05, poreShare: 0.4, angle: 35 },
  nose: { cell: 0.38, aniso: 1.1, furrow: 10, pore: 0.075, poreShare: 0.35, angle: 90, net: 0.3, poreGap: 0.4, gapShare: 0.75 },
  eyelid: { cell: 0.32, aniso: 1.6, furrow: 20, pore: 0.015, poreShare: 0.15, angle: 0, net: 0.85 },
  chin: { cell: 0.45, aniso: 1.2, furrow: 18, pore: 0.055, poreShare: 0.6, angle: 0 },
});

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const UM = 0.001;   // a micrometre in mm

/**
 * The cellular field under a metric stretched along `a` (unit, the tension direction) by `A`: the three nearest
 * feature points' distances (F1 ≤ F2 ≤ F3) and their lattice ids. Feature points jitter on a square lattice of
 * `cell` mm, seeded by `s`; the metric varies point to point without seams (the points do not move with it).
 */
function cells(u, v, cell, A, ax, ay, s) {
  const gi = Math.floor(u / cell), gj = Math.floor(v / cell), R = Math.ceil(A) + 1;
  let f1 = Infinity, f2 = Infinity, f3 = Infinity, k1 = 0, k2 = 0, k3 = 0;
  for (let j = gj - R; j <= gj + R; j++) for (let i = gi - R; i <= gi + R; i++) {
    const px = (i + 0.1 + 0.8 * hash3(i, j, s)) * cell, py = (j + 0.1 + 0.8 * hash3(i, j, s + 1)) * cell;
    const dx = u - px, dy = v - py, along = dx * ax + dy * ay, across = -dx * ay + dy * ax;
    const d = Math.sqrt((along / A) ** 2 + across ** 2);
    const id = (i * 73856093) ^ (j * 19349663);
    if (d < f1) { f3 = f2; k3 = k2; f2 = f1; k2 = k1; f1 = d; k1 = id; } else if (d < f2) { f3 = f2; k3 = k2; f2 = d; k2 = id; } else if (d < f3) { f3 = d; k3 = id; }
  }
  return { f1, f2, f3, k1, k2, k3 };
}

/**
 * One FAMILY of long furrows at angle `a` (radians, from +u), `sp` mm apart, each line jittered off its slot and
 * wavering along its length; its depth (0 … 1) wanders along it too, so a line runs deep, fades and returns. Returns
 * the nearest line's signed distance (mm), its index, and its depth share there.
 */
function family(u, v, a, sp, s) {
  const ca = Math.cos(a), sa = Math.sin(a), t = u * ca + v * sa, q = -u * sa + v * ca;
  const n0 = Math.round(q / sp);
  let best = { d: Infinity, n: 0, k: 0 };
  for (let n = n0 - 2; n <= n0 + 2; n++) {
    // off its slot, wandering long (its angle drifts: neighbours close and part, sometimes merge) and short
    const off = n * sp + sp * 0.6 * (hash3(n, 0, s) - 0.5) + sp * 1.3 * (vnoise(t / 5.5, n * 3.1, s + 1) - 0.5) + sp * 0.3 * (vnoise(t / 0.9, n * 5.3, s + 3) - 0.5);
    const d = q - off;
    if (Math.abs(d) < Math.abs(best.d)) best = { d, n, k: 0 };
  }
  // its depth along it: deep stretches, fades and breaks
  const w = vnoise(t / 1.1, best.n * 1.7, s + 2) * 0.75 + vnoise(t / 0.35, best.n * 2.9, s + 4) * 0.25;
  best.k = w < 0.38 ? 0 : Math.min(1, (w - 0.38) / 0.3);
  return best;
}

/**
 * The crease lines of one tether, as polylines in the chart (mm) with their depth (mm) and width. A RADIAL tether
 * fans `count` lines from its `pivot` across `span` (degrees), from `reach[0]` to `reach[1]` mm out; an ALONG tether
 * lays them beside its `path`, at offsets within `reach[1]` either side. More, and deeper, with age; deeper in a
 * squint. Each line wobbles, tapers, and sometimes forks.
 */
export function creaseLines(tether, { age = 0.35, squint = 0, scale = 1, seed = 1 } = {}, index = 0) {
  const dice = streamOf(seed, 'crease', `${index}`);
  const n = Math.round((tether.count ?? 6) * (0.45 + 0.9 * age) * scale);
  const depth = (tether.depth ?? 60) * UM * (0.12 + 1.5 * age * age) * (1 + 1.1 * squint);
  const lines = [];
  const wobble = (pts, amp) => {
    const ph = dice() * 6.283, fr = 0.5 + dice();
    return pts.map((p, k) => {
      const q = pts[Math.min(k + 1, pts.length - 1)], o = pts[Math.max(k - 1, 0)];
      const tx = q.u - o.u, ty = q.v - o.v, l = Math.hypot(tx, ty) || 1, w = amp * Math.sin(ph + fr * k);
      return { u: p.u - (ty / l) * w, v: p.v + (tx / l) * w };
    });
  };
  const push = (pts, d) => lines.push({ pts, depth: d * (0.6 + 0.4 * dice()), width: (0.05 + 0.06 * dice()) * (0.8 + 0.5 * age) });
  if (tether.kind === 'radial') {
    const [a0, a1] = tether.span ?? [-40, 40], [r0, r1] = tether.reach ?? [2, 12];
    for (let i = 0; i < n; i++) {
      const a = ((a0 + ((i + 0.5) / n) * (a1 - a0) + (dice() - 0.5) * ((a1 - a0) / n) * 0.8) * Math.PI) / 180;
      const s0 = r0 * (0.8 + 0.5 * dice()), s1 = s0 + (r1 - r0) * (0.45 + 0.55 * dice());
      const ray = Array.from({ length: 13 }, (_, k) => { const r = s0 + ((s1 - s0) * k) / 12; return { u: tether.pivot.u + Math.cos(a) * r, v: tether.pivot.v + Math.sin(a) * r }; });
      const line = wobble(ray, 0.12 + 0.2 * dice());
      push(line, depth);
      if (dice() < 0.3) {   // a fork from past its middle
        const k0 = 6 + Math.floor(dice() * 3), turn = ((dice() < 0.5 ? -1 : 1) * (10 + 10 * dice()) * Math.PI) / 180, b = line[k0];
        const fork = Array.from({ length: 6 }, (_, k) => { const r = ((s1 - s0) * 0.4 * k) / 5; return { u: b.u + Math.cos(a + turn) * r, v: b.v + Math.sin(a + turn) * r }; });
        push(wobble(fork, 0.08), depth * 0.6);
      }
    }
  } else {
    const path = tether.path, reach = (tether.reach ?? [0, 4])[1];
    for (let i = 0; i < n; i++) {
      const off = (i % 2 ? -1 : 1) * reach * ((Math.floor(i / 2) + 0.5 + (dice() - 0.5) * 0.6) / Math.ceil(n / 2));
      const t0 = dice() * 0.35, t1 = 0.65 + dice() * 0.35;
      const pts = Array.from({ length: 13 }, (_, k) => {
        const t = t0 + ((t1 - t0) * k) / 12, f = t * (path.length - 1), i0 = Math.min(path.length - 2, Math.floor(f)), w = f - i0;
        const p = { u: path[i0].u + (path[i0 + 1].u - path[i0].u) * w, v: path[i0].v + (path[i0 + 1].v - path[i0].v) * w };
        const tx = path[i0 + 1].u - path[i0].u, ty = path[i0 + 1].v - path[i0].v, l = Math.hypot(tx, ty) || 1;
        return { u: p.u - (ty / l) * off, v: p.v + (tx / l) * off };
      });
      push(wobble(pts, 0.1 + 0.15 * dice()), depth * (1 - 0.5 * Math.abs(off) / reach));
    }
  }
  return lines;
}

/** The nearest point of the crease lines to (u, v): its distance, the line's tangent there, and its taper share. */
function nearestLine(lines, u, v) {
  let best = { d: Infinity, tx: 1, ty: 0, line: null, s: 0 };
  for (const L of lines) {
    if (u < L.box[0] || u > L.box[2] || v < L.box[1] || v > L.box[3]) continue;
    const P = L.pts;
    for (let k = 0; k + 1 < P.length; k++) {
      const ax = P[k].u, ay = P[k].v, bx = P[k + 1].u - ax, by = P[k + 1].v - ay, l2 = bx * bx + by * by || 1e-12;
      const t = clamp01(((u - ax) * bx + (v - ay) * by) / l2), dx = u - ax - bx * t, dy = v - ay - by * t, d = Math.hypot(dx, dy);
      if (d < best.d) { const l = Math.sqrt(l2); best = { d, tx: bx / l, ty: by / l, line: L, s: (k + t) / (P.length - 1) }; }
    }
  }
  return best;
}

/** The skin's relief over a chart: see the module's head. */
export function skinRelief(spec = {}) {
  const R = { ...(SKIN_REGIONS[spec.region ?? 'cheek'] || SKIN_REGIONS.cheek), ...(typeof spec.region === 'object' ? spec.region : {}) };
  const tier = Math.max(0, SKIN_FIDELITY.indexOf(spec.fidelity ?? 'micro'));
  const age = clamp01(spec.age ?? 0.35), squint = clamp01(spec.squint ?? 0), seed = spec.seed ?? 1;
  const poreScale = spec.pores ?? 1, creaseScale = spec.creases ?? 1;
  const theta = (((spec.angle ?? 0) + R.angle) * Math.PI) / 180;
  // the age's numbers
  const cell = R.cell * (1 + 0.25 * age), A = R.aniso * (1 + 0.4 * age);
  const furrow = R.furrow * UM * (0.55 + 0.9 * age), fW = 0.03 + 0.06 * cell;
  const poreR = R.pore * (1 + 0.5 * age), poreD = (20 + 60 * R.pore / 0.1) * UM * (0.7 + 0.6 * age);
  const cell2 = cell * 0.2, furrow2 = furrow * 0.3 * (1 - 0.4 * age);
  // the line families' half-angle about the tension: wide (a square net) on loose skin, closing on stretched
  const phi = (Math.PI / 180) * 42 / Math.sqrt(A), sinX = Math.sin(2 * phi);
  const s0 = (seed * 7919) | 0;
  // the creases, with their bounding boxes (a line's reach, its shoulders' too)
  const lines = tier >= 1 && creaseScale > 0 ? (spec.tethers || []).flatMap((t, i) => creaseLines(t, { age, squint, scale: creaseScale, seed }, i)) : [];
  for (const L of lines) {
    const m = 4 * L.width + 2;   // the line's own reach, and the keratin's turn toward it
    L.box = [Math.min(...L.pts.map((p) => p.u)) - m, Math.min(...L.pts.map((p) => p.v)) - m, Math.max(...L.pts.map((p) => p.u)) + m, Math.max(...L.pts.map((p) => p.v)) + m];
  }
  const troughs = tier >= 1 ? (spec.tethers || []).filter((t) => t.path).map((t) => ({ pts: t.path, width: 1.2, depth: (t.trough ?? 25) * UM * (0.5 + age), box: [-Infinity, -Infinity, Infinity, Infinity] })) : [];
  // the tension direction there: the region's, turned to run with a crease near one (orientations blend doubled)
  const dirAt = (u, v, near) => {
    if (!near || !near.line) return { x: Math.cos(theta), y: Math.sin(theta) };
    const w = Math.exp(-near.d / 1.5), c2 = Math.cos(2 * theta) * (1 - w) + (near.tx * near.tx - near.ty * near.ty) * w, s2 = Math.sin(2 * theta) * (1 - w) + 2 * near.tx * near.ty * w;
    const a = Math.atan2(s2, c2) / 2;
    return { x: Math.cos(a), y: Math.sin(a) };
  };
  const at = (u, v) => {
    let h = 0, rough = 0.5, furrowShare = 0, pore = 0, crease = 0;
    if (tier === 0) return { h, rough, furrow: 0, pore: 0, crease: 0 };
    const near = lines.length ? nearestLine(lines, u, v) : null;
    // the creases: a thin groove tapered at its ends, the skin bunched in low shoulders beside it; the tether's trough
    if (near && near.line) {
      const L = near.line, taper = Math.pow(Math.sin(Math.PI * clamp01(near.s)), 0.6), x = near.d / L.width;
      crease = taper * Math.exp(-x * x);
      h += -L.depth * crease + 0.22 * L.depth * taper * Math.exp(-((x - 2.2) ** 2) / 1.2);
      // its faint companions, a fine line either side
      const c1 = near.d - 0.32 - 1.5 * L.width;
      h -= 0.22 * L.depth * taper * Math.exp(-((c1 / (0.5 * L.width)) ** 2));
    }
    for (const T of troughs) { const q = nearestLine([T], u, v); h -= T.depth * Math.exp(-((q.d / T.width) ** 2)); }
    if (tier >= 2) {
      // the primary lines: two crossing families about the tension, a weaker one across; a furrow is a V
      // (a fading line narrows as it shallows)
      const groove = (d, k, w) => { const wk = w * (0.45 + 0.55 * k); return Math.abs(d) < wk ? k * (1 - Math.abs(d) / wk) ** 2 : 0; };
      const f1 = family(u, v, theta + phi, cell, s0), f2 = family(u, v, theta - phi, cell * 1.1, s0 + 11), f3 = family(u, v, theta + Math.PI / 2, cell * 1.7, s0 + 23);
      const g = Math.max(groove(f1.d, f1.k, fW), groove(f2.d, f2.k, fW), 0.45 * groove(f3.d, f3.k * 0.7, fW * 0.8));
      // the minor net between them: faint, stretched along the tension, turned toward a crease
      const d = dirAt(u, v, near), c = cells(u, v, cell * 0.42, A, d.x, d.y, s0 + 5), e = (c.f2 - c.f1) * 0.5, wm = 0.6 * fW;
      const m = e < wm ? (R.net ?? 0.45) * (1 - e / wm) ** 2 : 0;
      furrowShare = Math.max(g, m);
      h -= furrow * (g + m * (1 - g));
      // the pores: at the two families' crossings, round
      // (near the crossing, not on it; most small, a few large)
      if (poreScale > 0 && hash3(f1.n, f2.n, s0 + 7) < R.poreShare * Math.min(1, poreScale)) {
        const z = hash3(f2.n, f1.n, s0 + 9), r = poreR * (0.45 + 1.1 * z * z) * Math.max(1, poreScale);
        const j1 = f1.d - cell * 0.25 * (hash3(f1.n, f2.n, s0 + 13) - 0.5), j2 = f2.d - cell * 0.25 * (hash3(f2.n, f1.n, s0 + 17) - 0.5);
        const q2 = (j1 * j1 + j2 * j2) / (sinX * sinX);
        if (q2 < 9 * r * r) { pore = Math.exp(-q2 / (r * r)); h -= poreD * (0.6 + 0.6 * z) * pore; }
      }
      // (a pore-dense skin's scatter among the lines)
      if (poreScale > 0 && R.poreGap) {
        const G = R.poreGap, gi = Math.floor(u / G), gj = Math.floor(v / G);
        for (let j = gj - 1; j <= gj + 1; j++) for (let i = gi - 1; i <= gi + 1; i++) {
          if (hash3(i, j, s0 + 41) >= R.gapShare * Math.min(1, poreScale)) continue;
          const px = (i + 0.15 + 0.7 * hash3(i, j, s0 + 43)) * G, py = (j + 0.15 + 0.7 * hash3(i, j, s0 + 47)) * G;
          const z = hash3(j, i, s0 + 49), r = poreR * (0.45 + 1.1 * z * z) * Math.max(1, poreScale), q2 = (u - px) ** 2 + (v - py) ** 2;
          if (q2 < 9 * r * r) { const p2 = Math.exp(-q2 / (r * r)); if (p2 > pore) { h -= poreD * (0.6 + 0.6 * z) * (p2 - pore); pore = p2; } }
        }
      }
      rough = 0.42 + 0.35 * furrowShare + 0.2 * pore;
    }
    if (tier >= 3) {
      // the finest net and the corneum's grain
      const c2 = cells(u, v, cell2, 1 + (A - 1) * 0.3, Math.cos(theta), Math.sin(theta), s0 + 31);
      const e2 = (c2.f2 - c2.f1) * 0.5, w2 = 0.015 + 0.02 * cell2;
      const f2 = e2 < w2 ? (1 - e2 / w2) ** 2 : 0;
      h += -furrow2 * f2 * (1 - 0.7 * furrowShare);
      const g = vnoise(u / 0.045, v / 0.045, s0 + 53) - 0.5;
      h += g * 2.5 * UM;
      rough = Math.min(1, rough + 0.12 * f2 + 0.12 * g);
    }
    return { h, rough, furrow: furrowShare, pore, crease };
  };
  return { at, lines, dir: (u, v) => dirAt(u, v, lines.length ? nearestLine(lines, u, v) : null) };
}
