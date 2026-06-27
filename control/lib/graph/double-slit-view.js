/**
 * double-slit-view — the double-slit experiment as a RIPPLE TANK, rendered in the traversable three.js
 * World. Wave interference is a 2-D field over a plane deforming in time, so it rides the ocean's
 * surface channel — generalised to POINT-SOURCE circular waves: an incoming plane wave hits a barrier
 * with two slits, each slit re-emits a circular wave, and their overlap IS the interference pattern
 * (the bright/dark fan), with the fringes projected on a screen.
 *
 * Scenarios:
 *   • double    — two coherent sources (the two slits) → interference fringes.
 *   • single    — one slit → smooth diffraction, NO two-source fringes (the contrast).
 *   • particles — the quantum punchline: individual particles each land at ONE spot, yet collectively
 *                 build the fringe pattern (dots distributed by |ψ|², the interference probability).
 *
 * Frame: the wave plane is x–y (x across the slits, y the propagation), z the wave amplitude; the
 * barrier is at y = 0, the screen downstream. Knob: `separation` (slit spacing d → fringe spacing λL/d).
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'double-slit-view', scenario?, separation?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const GOLDEN = 0.6180339887;   // low-discrepancy sequence (deterministic; no Math.random)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

const quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function boxFaces(center, half, fill, group) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half;
  const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  return [
    quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group),
    quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group),
    quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group),
    quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group),
    quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group),
    quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group),
  ];
}

// wave + geometry constants (render units).
const W = 100, D = 80, NX = 104, NY = 86;       // wave-plane grid
const LAM = 6, K = TAU / LAM, OM = 2.2, A = 1.8, DECAY = 0.05;
const Y_SCREEN = 34, SUBSRC = 6;                 // sub-sources per slit → the finite-width slit's sinc² envelope
const RIPPLE = { deep: [0.02, 0.05, 0.12], surf: [0.06, 0.28, 0.55], crest: [0.78, 0.93, 1.0] };

// model each slit as a FINITE-WIDTH aperture = a line of coherent (in-phase) sub-sources spread across
// its width `a`. Summing them makes the single-slit diffraction envelope (sinc²) EMERGE — no formula
// is bolted on: the two-slit fringes (cos²) ride under it automatically.
function slitSources(centers, a) {
  const out = [];
  for (const c of centers) for (let m = 0; m < SUBSRC; m++) out.push([c - a / 2 + a * (m + 0.5) / SUBSRC, 0]);
  return out;
}

// time-averaged intensity at (x, Ys): squared magnitude of the summed source phasors (∝ |ψ|²).
function intensity(x, Ys, sources) {
  let re = 0, im = 0;
  for (const s of sources) { const r = Math.hypot(x - s[0], Ys - s[1]) || 1e-4, a = 1 / Math.sqrt(r); re += a * Math.cos(K * r); im += a * Math.sin(K * r); }
  return re * re + im * im;
}

// barrier wall with gaps (of width `a`) at the given slit centres.
function barrierFaces(slitCenters, a) {
  const edges = [-W / 2]; for (const c of slitCenters) { edges.push(c - a / 2, c + a / 2); } edges.push(W / 2);
  const faces = [];
  for (let i = 0; i < edges.length; i += 2) { const a = edges[i], b = edges[i + 1]; if (b - a < 0.1) continue; faces.push(...boxFaces([(a + b) / 2, 0, 1.5], [(b - a) / 2, 0.8, 3.5], '#33405a', 'barrier')); }
  return faces;
}

// a screen at y = Y_SCREEN whose vertical bands are coloured by the interference intensity.
function screenFaces(sources) {
  const M = 92, x0 = -W / 2 + 2, x1 = W / 2 - 2, dx = (x1 - x0) / M, faces = [];
  const Is = Array.from({ length: M }, (_, i) => intensity(x0 + (i + 0.5) * dx, Y_SCREEN, sources));
  const Imax = Math.max(...Is) || 1;
  for (let i = 0; i < M; i++) {
    const xa = x0 + i * dx, xb = xa + dx, c = hex(lerp3([14, 18, 32], [255, 240, 180], Is[i] / Imax));
    faces.push(quad([[xa, Y_SCREEN, 0], [xb, Y_SCREEN, 0], [xb, Y_SCREEN, 9], [xa, Y_SCREEN, 9]], c, 'screen'));
  }
  return faces;
}

const surfaceFor = (sources) => ({
  grid: { w: W, d: D, nx: NX, ny: NY }, waves: [], sources, k: K, om: OM, A, decay: DECAY, barrierY: 0,
  amax: A * 1.5, ...RIPPLE, sun: [40, -30, 80], floaters: [],
});

const readoutField = (lines) => ({ animate: false, sets: [], lines: [], readout: lines });
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const BOUNDS = { center: [0, 2, 2], radius: Math.hypot(W / 2, D / 2) };

const SCENARIOS = {
  // two FINITE-WIDTH slits → interference fringes riding under the single-slit diffraction envelope.
  double(P) {
    const sep = clampNum(P.separation, 6, 36, 14), a = clampNum(P.slitWidth, 3, 16, 8);
    const centers = [-sep / 2, sep / 2], sources = slitSources(centers, a);
    return {
      surfaces: [surfaceFor(sources)],
      faces: [...barrierFaces(centers, a), ...screenFaces(sources)],
      picks: [{ name: 'screen', kind: 'screen', label: 'Screen', fields: compactFields([['fringes', 'spacing λL/d'], ['envelope', 'single-slit sinc² (∝ λ/a)']]) }],
      tracers: [],
      field: readoutField(['Double-slit interference', 'two finite slits → fringes UNDER a diffraction envelope', 'bright = waves add · dark = they cancel', `slit spacing d = ${sep} · slit width a = ${a}`]),
      stats: { scenario: 'double', separation: sep, slitWidth: a },
    };
  },
  // one finite slit → the sinc² diffraction pattern: a broad central maximum + weaker side lobes.
  single(P) {
    const a = clampNum(P.slitWidth, 3, 16, 8), sources = slitSources([0], a);
    return {
      surfaces: [surfaceFor(sources)],
      faces: [...barrierFaces([0], a), ...screenFaces(sources)],
      picks: [{ name: 'screen', kind: 'screen', label: 'Screen', fields: compactFields([['pattern', 'sinc² diffraction'], ['width', '∝ λ/a']]) }],
      tracers: [],
      field: readoutField(['Single slit — diffraction (sinc²)', 'one finite slit → broad central max + side lobes', 'narrower slit → broader spread (∝ λ/a)', `slit width a = ${a}`]),
      stats: { scenario: 'single', separation: 0, slitWidth: a },
    };
  },
  // the quantum punchline, LIVE: individual particles arrive one at a time and accumulate into the
  // (enveloped) fringe pattern — landing positions drawn from |ψ|², revealed over time by the buildup
  // channel. Each lands at ONE spot; collectively they build the wave pattern.
  particles(P) {
    const sep = clampNum(P.separation, 6, 36, 14), a = clampNum(P.slitWidth, 3, 16, 8);
    const sources = slitSources([-sep / 2, sep / 2], a);
    // |ψ|² CDF across the screen, then sample landing x by inverting it on a low-discrepancy sequence.
    const M = 360, x0 = -W / 2 + 3, x1 = W / 2 - 3, dx = (x1 - x0) / M;
    const cdf = [0];
    for (let i = 0; i < M; i++) cdf.push(cdf[i] + intensity(x0 + (i + 0.5) * dx, Y_SCREEN, sources));
    const total = cdf[M] || 1;
    const invCdf = (u) => { const target = u * total; let lo = 0, hi = M; while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < target) lo = mid + 1; else hi = mid; } return x0 + (lo - 0.5) * dx; };
    // N landing dots, distributed by |ψ|², then SORTED into a pseudo-random arrival order (so they
    // appear scattered and slowly resolve into fringes, not sweep left-to-right).
    const N = 360;
    const dots = Array.from({ length: N }, (_, i) => ({ x: invCdf((i + 0.5) / N), z: 0.6 + (((i * 0.7548776662) % 1)) * 8, key: ((i + 1) * GOLDEN) % 1 }));
    dots.sort((p, q) => p.key - q.key);
    const positions = dots.flatMap((p) => [p.x, Y_SCREEN, p.z]);

    const faces = [...barrierFaces([-sep / 2, sep / 2], a)];
    faces.push(quad([[x0, Y_SCREEN + 0.25, 0], [x1, Y_SCREEN + 0.25, 0], [x1, Y_SCREEN + 0.25, 9], [x0, Y_SCREEN + 0.25, 9]], '#10131f', 'screen'));
    const tracers = [];
    for (const sx of [-sep / 2, sep / 2]) tracers.push({ path: Array.from({ length: 18 }, (_, k) => { const t = k / 17; return [sx, -34 + 34 * t, 1.4]; }), color: [190, 230, 255], size: 0.5, period: 2.4, trail: 4, trailLag: 0.006 });
    return {
      surfaces: [], faces, tracers,
      buildup: { positions, color: 0xbfe6ff, size: 0.85, period: 16 },
      picks: [{ name: 'screen', kind: 'pattern', label: 'Accumulated hits', fields: compactFields([['each', 'one localised landing'], ['together', 'the fringe pattern']]) }],
      field: readoutField(['Single particles, one at a time', 'each lands at ONE spot on the screen', '…yet together they build the fringes', 'quantum: |ψ|² is the landing probability']),
      stats: { scenario: 'particles', separation: sep, slitWidth: a, hits: N },
    };
  },
};

export const DOUBLE_SLIT_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into faces + (optional) the wavefield surface + flow + readout. Pure.
 * @returns {{ faces, picks, surfaces, fields, tracers, bounds, stats }}
 */
export function planDoubleSlitScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'double';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const built = SCENARIOS[scenario]({ separation: recipe.separation, slitWidth: recipe.slitWidth });

  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = built.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const tracers = built.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  // the surface generates its own grid in-script; scale its extent + source positions + wavenumber.
  const surfaces = built.surfaces.map((sf) => ({ ...sf, grid: { ...sf.grid, w: sf.grid.w * scale, d: sf.grid.d * scale }, sources: sf.sources.map((s) => [s[0] * scale, s[1] * scale]), k: sf.k / scale, barrierY: sf.barrierY * scale, amax: sf.amax * scale, A: sf.A * scale }));
  const buildups = built.buildup ? [{ ...built.buildup, positions: built.buildup.positions.map((v, i) => v * scale), size: built.buildup.size * scale }] : [];

  return {
    faces, picks: built.picks, surfaces, fields: [built.field], tracers, buildups,
    bounds: { center: sc(BOUNDS.center), radius: BOUNDS.radius * scale },
    stats: built.stats,
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — an elevated 3/4 looking down the wave plane.
 */
export function assembleDoubleSlitScene(recipe = {}, { title } = {}) {
  const plan = planDoubleSlitScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius;
  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [center[0] + d * 0.15, center[1] - d * 1.05, center[2] + d * 0.85], lookAt: [center[0], center[1] + d * 0.18, 0], horizontalFov: 56 } },
    { name: 'top', worldFraming: { cameraPosition: [center[0], center[1] - d * 0.05, center[2] + d * 1.3], lookAt: [center[0], center[1], 0], horizontalFov: 52 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#060912';
  return {
    faces: plan.faces,
    picks: plan.picks,
    surfaces: plan.surfaces,
    fields: plan.fields,
    tracers: plan.tracers,
    buildups: plan.buildups,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} double-slit`,
    bg,
    glow: false,
  };
}
