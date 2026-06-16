/**
 * form-effect — drive a host-blind GENERATOR along a host FORM's geometry.
 *
 * The isolated primitive behind "vines on carved letters": a binding that routes
 * a generative primitive (plant, taiji, fractal, …) along a host form's
 * drive-geometry, emitting an effect-layer to composite back in the host's frame.
 * Carved letters are just the cheapest host; the seam is host- and generator-
 * agnostic. See lite-template/integration/0610/form-effect.plan.md.
 *
 * Five slots:
 *   host        — exposes drive-geometry (here: a 2D CONTOUR ring + a depth).
 *   carrier     — WHICH geometry drives, via a named CONTOUR_PATHINGS preset
 *                 (the model's options for routing along the contour).
 *   generator   — a host-blind emitter: (drivePath, params, progress) -> faces.
 *                 plant is the first (GENERATORS.plant); add variants as rows.
 *   bind        — the pathing preset already bakes axis + modulation into each
 *                 drivePath; the generator just consumes it.
 *   progress    — 0..1 gates/scales the effect (grow-in / sweep).
 *
 * Pure geometry in the host's LOCAL frame [x,y,z] (x,y = the contour plane,
 * z = depth: 0 front … `depth` back — matching carve-solid.extrudeProfile). The
 * renderer place()s + projects + vexar-shades, compositing with the host faces.
 */
import { norm3 } from './polygonizer/vexar.js';
import { expandPlant } from './polygonizer/plant.js';

// ── tiny vector helpers (local 3D + 2D) ──
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mid3 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const bez3 = (p0, p1, p2, t) => { const m = 1 - t; return [m*m*p0[0]+2*m*t*p1[0]+t*t*p2[0], m*m*p0[1]+2*m*t*p1[1]+t*t*p2[1], m*m*p0[2]+2*m*t*p1[2]+t*t*p2[2]]; };
const A = (p) => ({ x: p[0], y: p[1], z: p[2] });
function perpBasis(n) { const ref = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const u = norm3(cross(n, ref)); return [u, norm3(cross(n, u))]; }

/** Largest-area ring of a contour set (the outer silhouette). */
export function outerRing(contours) {
  const area = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };
  return contours.reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a));
}

// Resample a closed 2D ring to P even-arc-length samples, each with outward
// normal (perp to tangent, pointing away from the ring centroid).
function resample2D(ring, P) {
  const pts = ring.map((p) => [p[0], p[1]]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const seg = []; let total = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const d = Math.hypot(b[0]-a[0], b[1]-a[1]); seg.push({ a, b, d, acc: total }); total += d; }
  const out = [];
  for (let k = 0; k < P; k++) {
    const target = (k / P) * total; const s = seg.find((s) => target >= s.acc && target < s.acc + s.d) || seg[seg.length - 1];
    const f = s.d ? (target - s.acc) / s.d : 0;
    const p = [s.a[0] + (s.b[0]-s.a[0])*f, s.a[1] + (s.b[1]-s.a[1])*f];
    let tan = norm3([s.b[0]-s.a[0], s.b[1]-s.a[1], 0]);
    let nrm = [tan[1], -tan[0], 0];                          // right of tangent
    if ((nrm[0]) * (p[0]-cx) + (nrm[1]) * (p[1]-cy) < 0) nrm = [-nrm[0], -nrm[1], 0];   // point outward
    out.push({ p, tan: [tan[0], tan[1]], nrm: [nrm[0], nrm[1]] });
  }
  return out;
}
const at = (s, z) => [s.p[0], s.p[1], z];
const off = (s, z, d) => [s.p[0] + s.nrm[0] * d, s.p[1] + s.nrm[1] * d, z];

// ─────────────────────────────────────────────────────────────────────────
// CONTOUR_PATHINGS — the model's options for routing along a host contour.
// Each: (ring2D, depth, params) -> [ { base, tip, center?, normal, t0, span } ]
// in local [x,y,z]. `base→tip` is the generator's growth axis.
// ─────────────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
export const CONTOUR_PATHINGS = {
  // weave over/under the slab edge (the vine-wrap default): z oscillates from
  // proud-of-front to near-back as it travels the loop.
  wrap(ring, depth, { count = 11, overlap = 1.6, wraps = 2.4, outward = 0 } = {}) {
    const S = resample2D(ring, 240), P = S.length, paths = [];
    const z = (t) => depth * 0.4 + depth * 0.55 * Math.sin(wraps * TAU * t);
    for (let k = 0; k < count; k++) {
      const t0 = k / count, t1 = (k + overlap) / count;
      const a = S[Math.floor(t0 * P) % P], b = S[Math.floor(t1 * P) % P];
      paths.push({ base: off(a, z(t0), outward), tip: off(b, z(t1), outward), normal: [0, 0, -1], t0, span: 1 / count });
    }
    return paths;
  },
  // flat ring on the front face (a wreath / border): constant slight proud depth.
  band(ring, depth, { count = 12, overlap = 1.5, lift = 0.12, outward = 0 } = {}) {
    const S = resample2D(ring, 240), P = S.length, paths = [];
    const z = -depth * lift;
    for (let k = 0; k < count; k++) {
      const t0 = k / count, t1 = (k + overlap) / count;
      const a = S[Math.floor(t0 * P) % P], b = S[Math.floor(t1 * P) % P];
      paths.push({ base: off(a, z, outward), tip: off(b, z, outward), normal: [0, 0, -1], t0, span: 1 / count });
    }
    return paths;
  },
  // spiral: depth ramps monotonically front→back AND the run lifts outward, so
  // the effect climbs around-and-up the form.
  climb(ring, depth, { count = 12, overlap = 1.5, turns = 1, outward = 0.04 } = {}) {
    const S = resample2D(ring, 240), P = S.length, paths = [];
    for (let k = 0; k < count; k++) {
      const t0 = k / count, t1 = (k + overlap) / count;
      const a = S[Math.floor(t0 * P) % P], b = S[Math.floor(t1 * P) % P];
      const z0 = -depth * 0.1 + depth * 1.1 * ((t0 * turns) % 1), z1 = -depth * 0.1 + depth * 1.1 * ((t1 * turns) % 1);
      paths.push({ base: off(a, z0, outward * (1 + t0)), tip: off(b, z1, outward * (1 + t1)), normal: [0, 0, -1], t0, span: 1 / count });
    }
    return paths;
  },
  // hug the bevel rim: sit at mid-depth, pushed out to the silhouette edge.
  rim(ring, depth, { count = 13, overlap = 1.5, outward = 0.03 } = {}) {
    const S = resample2D(ring, 240), P = S.length, paths = [];
    const z = depth * 0.5;
    for (let k = 0; k < count; k++) {
      const t0 = k / count, t1 = (k + overlap) / count;
      const a = S[Math.floor(t0 * P) % P], b = S[Math.floor(t1 * P) % P];
      paths.push({ base: off(a, z, outward), tip: off(b, z, outward), normal: [0, 0, -1], t0, span: 1 / count });
    }
    return paths;
  },
  // sprigs that point OUTWARD from the contour (sunburst / spikes / barbs):
  // each axis aims away from the form (and a touch forward), not along the loop.
  radiate(ring, depth, { count = 28, length = 0.22, forward = 0.5, outward = 0.01 } = {}) {
    const S = resample2D(ring, Math.max(count, 8)), paths = [];
    for (let k = 0; k < count; k++) {
      const s = S[k % S.length], t0 = k / count;
      const base = off(s, -depth * forward * 0.3, outward);
      const tip = [base[0] + s.nrm[0] * length, base[1] + s.nrm[1] * length, base[2] - depth * forward];
      paths.push({ base, tip, normal: [s.nrm[0], s.nrm[1], 0], t0, span: 1 / count });
    }
    return paths;
  },
  // two interleaved wraps, phase-offset by half a turn (a double-helix vine).
  double(ring, depth, params = {}) {
    const a = CONTOUR_PATHINGS.wrap(ring, depth, params);
    const b = CONTOUR_PATHINGS.wrap(ring, depth, { ...params, wraps: -(params.wraps ?? 2.4) });
    return [...a, ...b];
  },
};
export const PATHING_NAMES = Object.keys(CONTOUR_PATHINGS);

// ── sweep one taiji spec into a tube (capsule) / leaf (spindle) of quads ──
export function sweepTaiji(spec, cs = 10, seg = 6) {
  const Y = [spec.yin.x, spec.yin.y, spec.yin.z], G = [spec.yang.x, spec.yang.y, spec.yang.z];
  const C = spec.center ? [spec.center.x, spec.center.y, spec.center.z] : mid3(Y, G);
  const dir = norm3(sub3(G, Y)), [uH, vH] = perpBasis(dir);
  const radius = spec.radius ?? 1, twist = spec.twist ?? 0.5, capsule = spec.profile === 'capsule';
  const rings = [];
  for (let i = 0; i <= cs; i++) {
    const t = i / cs, c = bez3(Y, C, G, t), R = capsule ? radius : radius * Math.sin(Math.PI * t), phi = TAU * twist * t, ring = [];
    for (let j = 0; j <= seg; j++) { const th = phi + (j / seg) * TAU; ring.push(add3(c, add3(scl3(uH, R * Math.cos(th)), scl3(vH, R * Math.sin(th))))); }
    rings.push(ring);
  }
  const quads = [];
  for (let i = 0; i < cs; i++) for (let j = 0; j < seg; j++) quads.push([rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]]);
  return quads;
}

// ─────────────────────────────────────────────────────────────────────────
// GENERATORS — host-blind emitters. The first variant is `plant`; future
// variants (taiji-fibers, fractal-crystal, rBrush) register here the same way.
// (drivePath, params, progress) -> [ { kind:'quad', pts:[[x,y,z]x4], role } ]
// ─────────────────────────────────────────────────────────────────────────
export function plantGenerator(path, params = {}, progress = 1) {
  const { form = 'frond', count = 4, leafLength = 0.6, leafWidth = 0.2, stemRadius = 0.085, taper = 0.5, arch = 0.35, leafTwist = 0.1 } = params;
  const ts = expandPlant({
    form, base: A(path.base), tip: A(path.tip),
    count, leafLength: leafLength * (0.4 + 0.6 * progress), leafWidth, stemRadius, taper, arch, leafTwist, detail: 'low',
  });
  const faces = [];
  for (const t of ts) {
    const role = t.profile === 'capsule' ? 'stem' : 'leaf';
    for (const q of sweepTaiji(t, role === 'stem' ? 10 : 8, role === 'stem' ? 6 : 5)) faces.push({ kind: 'quad', pts: q, role });
  }
  return faces;
}
// ── generator #2: electric — a FRACTAL-LIGHTNING emitter ──
// Not botanical fractal (plant) but random-midpoint-displacement fractal: the
// axis is recursively subdivided and each midpoint jittered perpendicular (amp
// halves per level → a 1/f jagged bolt), with occasional FORKS and bright HOT
// NODES at forks/tips. Emits thin `stroke` polylines + `node` glow-dots (a new
// face-kind set) instead of solid quads — the renderer draws them as bright
// cores + blurred bloom. Reseeds from `phase` so animation CRACKLES.
function mulberry32(a) { a >>>= 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedFrom = (t0, phase) => (Math.floor((t0 * 1000.37 + phase * 131.71) * 1009) >>> 0) || 1;
const len3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
function jagged(a, b, amp, gen, u, v, rand) {
  if (gen <= 0 || amp < 1e-4) return [a, b];
  const m = mid3(a, b);
  const mp = add3(m, add3(scl3(u, (rand() - 0.5) * amp), scl3(v, (rand() - 0.5) * amp)));
  const l = jagged(a, mp, amp * 0.55, gen - 1, u, v, rand);
  const r = jagged(mp, b, amp * 0.55, gen - 1, u, v, rand);
  return [...l.slice(0, -1), ...r];
}
export function electricGenerator(path, params = {}, progress = 1) {
  const { amp = 0.5, depth = 5, forks = 2, phase = 0, gap = 0.18, hotspots = 2 } = resolveElectric(params);
  const rand = mulberry32(seedFrom(path.t0, phase));
  if (rand() < gap) return [];                                 // intermittent: arc off this frame
  const base = path.base, tip = path.tip;
  const dir = norm3(sub3(tip, base)), [u, v] = perpBasis(dir), L = len3(base, tip) || 1e-3;
  const main = jagged(base, tip, amp * L, depth, u, v, rand);
  const items = [{ kind: 'stroke', pts: main, role: 'arc', intensity: 0.85 + 0.15 * rand() }];
  for (let f = 0; f < forks; f++) {
    if (rand() > 0.6) continue;
    const node = main[1 + Math.floor(rand() * (main.length - 2))];
    const fdir = norm3(add3(dir, scl3(u, (rand() - 0.5) * 2)));
    const fp = jagged(node, add3(node, scl3(fdir, L * (0.25 + 0.3 * rand()))), amp * L * 0.7, depth - 2, u, v, rand);
    items.push({ kind: 'stroke', pts: fp, role: 'fork', intensity: 0.4 + 0.3 * rand() });
    items.push({ kind: 'node', p: node, r: 0.04 * L, role: 'hot', intensity: 1 });
  }
  items.push({ kind: 'node', p: tip, r: 0.05 * L, role: 'hot', intensity: 1 });
  for (let h = 0; h < hotspots; h++) items.push({ kind: 'node', p: main[Math.floor(rand() * main.length)], r: 0.03 * L * (0.6 + rand()), role: 'hot', intensity: 0.7 + 0.3 * rand() });
  return items;
}

// ── generator #2b: electric_snake — a TRAVELLING arc (snake-then-dwell) ──
// Same fractal bolt as `electric`, but TEMPORAL: a head creeps along the contour
// (using each path's arc fraction `t0`) on an advance-then-dwell schedule, and
// only the paths in its trailing WINDOW light up — bright at the head, fading
// down the tail. While the head dwells it reseeds in place → crackles, then
// moves on. So one arc snakes across, stops for a bit, snakes on.
const smooth01 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function headAt(phase, stops, moveFrac) {
  const seg = (((phase % 1) + 1) % 1) * stops, i = Math.floor(seg), f = seg - i;
  const e = f < moveFrac ? smooth01(f / moveFrac) : 1;            // ease over the move, then hold (dwell)
  const from = i / stops, to = (i + 1) / stops;
  return ((from + (to - from) * e) % 1 + 1) % 1;
}
export function electricSnakeGenerator(path, params = {}, progress = 1) {
  const { phase = 0, stops = 4, moveFrac = 0.45, window = 0.3, amp = 0.5, depth = 5, forks = 2 } = resolveElectric(params);
  const head = headAt(phase, stops, moveFrac);
  let d = ((head - path.t0) % 1 + 1) % 1;                          // forward distance head→path along the loop
  if (d > window) return [];                                      // outside the trailing window → dark
  const intensity = 1 - d / window;                               // brightest at the head, fades down the tail
  const rand = mulberry32(seedFrom(path.t0, Math.floor(phase * 40)));   // reseed during dwell → in-place crackle
  const base = path.base, tip = path.tip;
  const dir = norm3(sub3(tip, base)), [u, v] = perpBasis(dir), L = len3(base, tip) || 1e-3;
  const main = jagged(base, tip, amp * L * (0.6 + 0.4 * intensity), depth, u, v, rand);
  const items = [{ kind: 'stroke', pts: main, role: 'arc', intensity: 0.45 + 0.55 * intensity }];
  if (d < window * 0.35) {                                        // the live head: a hot node + extra forks
    items.push({ kind: 'node', p: base, r: 0.06 * L, role: 'hot', intensity: 1 });
    for (let f = 0; f < forks; f++) {
      if (rand() > 0.5) continue;
      const node = main[1 + Math.floor(rand() * (main.length - 2))];
      const fdir = norm3(add3(dir, scl3(u, (rand() - 0.5) * 2)));
      items.push({ kind: 'stroke', pts: jagged(node, add3(node, scl3(fdir, L * (0.3 + 0.3 * rand()))), amp * L * 0.6, depth - 2, u, v, rand), role: 'fork', intensity: 0.5 * intensity + 0.2 });
      items.push({ kind: 'node', p: node, r: 0.035 * L, role: 'hot', intensity: 0.8 });
    }
  }
  return items;
}

export const GENERATORS = { plant: plantGenerator, electric: electricGenerator, electric_snake: electricSnakeGenerator };

// ── ELECTRIC_PRESETS — named lightning LOOKS so the model picks a name, not 8
// numbers. Each bundles the generator + its params; `electric(name, overrides)`
// returns the {generator, generatorParams} to spread into formEffect. Passing
// `generatorParams.preset` also works (resolveElectric merges it underneath any
// explicit params). Extend by adding a row.
export const ELECTRIC_PRESETS = {
  // all-over (electric): the whole outline crackles at once
  crackle:  { generator: 'electric', params: { amp: 0.6, depth: 5, forks: 2, gap: 0.20, hotspots: 2 } },
  arc:      { generator: 'electric', params: { amp: 0.4, depth: 5, forks: 1, gap: 0.04, hotspots: 1 } },  // steady, mostly-on
  storm:    { generator: 'electric', params: { amp: 0.95, depth: 6, forks: 3, gap: 0.14, hotspots: 3 } }, // wild, branchy
  filament: { generator: 'electric', params: { amp: 0.22, depth: 4, forks: 0, gap: 0.40, hotspots: 1 } }, // thin, faint threads
  // travelling (electric_snake): one head snakes + dwells
  snake:    { generator: 'electric_snake', params: { stops: 4, moveFrac: 0.50, window: 0.32, amp: 0.6, depth: 5, forks: 2 } },
  prowl:    { generator: 'electric_snake', params: { stops: 6, moveFrac: 0.32, window: 0.22, amp: 0.5, depth: 5, forks: 1 } }, // slow, long dwells, tight head
  surge:    { generator: 'electric_snake', params: { stops: 2, moveFrac: 0.72, window: 0.5, amp: 0.85, depth: 6, forks: 3 } }, // fast, big sweep
};
export const ELECTRIC_PRESET_NAMES = Object.keys(ELECTRIC_PRESETS);
function resolveElectric(params) { const p = params && ELECTRIC_PRESETS[params.preset]; return p ? { ...p.params, ...params } : params; }
/** One name → { generator, generatorParams } to spread into formEffect; add per-frame `phase` (and any tweak) via overrides. */
export function electric(name, overrides = {}) {
  const p = ELECTRIC_PRESETS[name] || ELECTRIC_PRESETS.crackle;
  return { generator: p.generator, generatorParams: { ...p.params, ...overrides } };
}

// ── generator #3: ice — faceted CRYSTAL shards growing off the contour ──
// A cluster of angular pyramids (square base → apex) aimed outward+forward; the
// renderer frost-shades them (translucent blue, facet highlights). Static.
export function iceGenerator(path, params = {}, progress = 1) {
  const { shards = 3, length = 0.22, width = 0.05, spread = 0.6, forward = 0.5 } = params;
  const rand = mulberry32(seedFrom(path.t0, 0));
  const n = path.normal || [0, 0, -1];
  const dir0 = norm3([n[0] || 0, n[1] || 0, -(forward + Math.abs(n[2] || 0) * 0.5)]);
  const [bu, bv] = perpBasis(dir0);
  const faces = [];
  for (let s = 0; s < shards; s++) {
    const dir = norm3(add3(dir0, add3(scl3(bu, (rand() - 0.5) * spread), scl3(bv, (rand() - 0.5) * spread))));
    const len = length * (0.55 + 0.9 * rand()) * (0.5 + 0.5 * progress), w = width * (0.7 + 0.6 * rand());
    const [su, sv] = perpBasis(dir), b = path.base, apex = add3(b, scl3(dir, len));
    const c = [add3(b, add3(scl3(su, w), scl3(sv, w))), add3(b, add3(scl3(su, -w), scl3(sv, w))), add3(b, add3(scl3(su, -w), scl3(sv, -w))), add3(b, add3(scl3(su, w), scl3(sv, -w)))];
    const tw = rand();   // per-crystal twinkle phase (geometry static; the renderer shimmers it)
    for (let i = 0; i < 4; i++) faces.push({ kind: 'quad', pts: [c[i], c[(i + 1) % 4], apex], role: 'ice', tw });   // 4 facets → a spike
  }
  return faces;
}

// ── generator #4: flame — tapered, wobbling fire TONGUES rising off the form ──
// Ribbons climbing local +y (up), tapering to a point, swayed by a phase-driven
// wobble (flicker). Each quad carries `s` (0 base … 1 tip) so the renderer
// gradients orange→yellow→white and glows. Animated via `phase`.
export function flameGenerator(path, params = {}, progress = 1) {
  const { count = 1, height = 0.5, width = 0.09, wobble = 0.5, steps = 8, phase = 0 } = params;
  const rand = mulberry32(seedFrom(path.t0, Math.floor(phase * 30)));
  const up = [0, 1, 0], side = [1, 0, 0], b = path.base, faces = [];
  for (let c = 0; c < count; c++) {
    const h = height * (0.7 + 0.6 * rand()) * (0.4 + 0.6 * progress), sway = rand() - 0.5;
    let pL, pR;
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const wob = (Math.sin(s * 5 + phase * 6 + sway * 5) * s + sway * s * 1.4) * wobble;
      const cx = add3(b, add3(scl3(up, s * h), scl3(side, wob * 0.32 * h)));
      const w = width * (1 - s) * (0.8 + 0.4 * rand());
      const L = add3(cx, scl3(side, -w)), R = add3(cx, scl3(side, w));
      if (i > 0) faces.push({ kind: 'quad', pts: [pL, pR, R, L], role: 'flame', s });
      pL = L; pR = R;
    }
  }
  return faces;
}
GENERATORS.ice = iceGenerator;
GENERATORS.flame = flameGenerator;

// ─────────────────────────────────────────────────────────────────────────
// OUTER_EFFECTS — the model-facing layer: a NAMED complete effect that bundles
// a generator + a contour pathing + a render style + its own preset variants.
// "encase in ice" / "engulf in flame" / "electrify" / "overgrow" are rows here;
// electric's presets are just this effect's `presets`. The renderer keys off
// `render` (solid | glow | frost | fire). Extend by adding a row.
// ─────────────────────────────────────────────────────────────────────────
export const OUTER_EFFECTS = {
  overgrow: {
    generator: 'plant', pathing: 'wrap', render: 'solid', defaultPreset: 'vine',
    presets: {
      vine: { pathingParams: { count: 8, wraps: 2.0 }, params: { form: 'frond', count: 2, leafLength: 0.44, leafWidth: 0.14, stemRadius: 0.06 } },   // sparse, so the form reads through
      moss: { pathing: 'radiate', pathingParams: { count: 40, length: 0.12 }, params: { form: 'shoot', count: 3, leafLength: 0.22, leafWidth: 0.14, stemRadius: 0.05 } },
      ivy: { pathing: 'climb', params: { form: 'frond', count: 3, leafLength: 0.5, leafWidth: 0.22 } },
    },
  },
  electric: { generator: 'electric', pathing: 'wrap', render: 'glow', defaultPreset: 'crackle', presets: ELECTRIC_PRESETS },
  ice: {
    generator: 'ice', pathing: 'rim', render: 'frost', defaultPreset: 'encase',
    presets: {
      encase: { pathing: 'rim', pathingParams: { count: 26 }, params: { shards: 3, length: 0.2, width: 0.055 } },
      shards: { pathing: 'radiate', pathingParams: { count: 30, length: 0.05 }, params: { shards: 2, length: 0.34, width: 0.05, spread: 0.4 } },
      rime: { pathing: 'wrap', pathingParams: { count: 22 }, params: { shards: 4, length: 0.12, width: 0.04, spread: 0.9 } },
    },
  },
  flame: {
    generator: 'flame', pathing: 'climb', render: 'fire', defaultPreset: 'engulf',
    presets: {
      engulf: { pathing: 'band', pathingParams: { count: 22 }, params: { count: 2, height: 0.5, width: 0.09, wobble: 0.5 } },
      lick: { pathing: 'band', pathingParams: { count: 16 }, params: { count: 1, height: 0.36, width: 0.07, wobble: 0.7 } },
      blaze: { pathing: 'band', pathingParams: { count: 28 }, params: { count: 3, height: 0.7, width: 0.1, wobble: 0.45 } },
    },
  },
};
export const OUTER_EFFECT_NAMES = Object.keys(OUTER_EFFECTS);

/**
 * Resolve a named outer-effect (+ optional preset) into everything formEffect +
 * the renderer need. Spread `effect` into formEffect; use `render` to draw.
 * @returns {{ generator, pathing, pathingParams, generatorParams, render }}
 */
export function outerEffect(name, preset, overrides = {}) {
  const fx = OUTER_EFFECTS[name] || OUTER_EFFECTS.electric;
  const p = (fx.presets && fx.presets[preset || fx.defaultPreset]) || {};
  return {
    generator: p.generator || fx.generator,
    pathing: p.pathing || fx.pathing,
    pathingParams: { ...(fx.pathingParams || {}), ...(p.pathingParams || {}) },
    generatorParams: { ...(p.params || {}), ...overrides },
    render: fx.render,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// INNER_EFFECTS — the dual of outer-effects: a luminosity treatment ON the form
// ITSELF, a SEPARATE layer from material. material = surface finish (metal /
// stone / glass); inner_effect = emission (the form glows / is lit from within).
// They compose: any material × any inner_effect. The renderer adds the glow
// colour to each face (rim/pulse-weighted) + a silhouette bloom halo. `glow` is
// the basic one; pulse / iridescent / inner-shadow / scanline are future rows.
// ─────────────────────────────────────────────────────────────────────────
export const INNER_EFFECTS = {
  glow: {
    render: 'lumin', defaultPreset: 'soft',
    presets: {
      soft:  { color: '#ffe6b0', emission: 0.50, rim: 0.30, bloom: 0.7, pulse: 0,   blur: 7 },   // warm, lit-from-within
      neon:  { color: '#19f0c8', emission: 0.90, rim: 0.50, bloom: 1.0, pulse: 0,   blur: 6 },   // saturated, bright halo
      ember: { color: '#ff5a1e', emission: 0.65, rim: 0.40, bloom: 0.85, pulse: 0.6, blur: 8 },  // hot, breathing
      rim:   { color: '#9fd0ff', emission: 0.95, rim: 0.95, bloom: 0.6, pulse: 0,   blur: 6 },    // edge-light only
      pulse: { color: '#7cc8ff', emission: 0.75, rim: 0.40, bloom: 0.95, pulse: 1.0, blur: 7 },   // animated breathe
    },
  },
};
export const INNER_EFFECT_NAMES = Object.keys(INNER_EFFECTS);
/** Resolve a named inner-effect (+ preset) → params the renderer applies over the
 *  material shade. `none`/falsy name → no glow. */
export function innerEffect(name = 'glow', preset, overrides = {}) {
  if (!name || name === 'none') return { render: 'none', family: 'none', emission: 0, bloom: 0 };
  const fx = INNER_EFFECTS[name] || INNER_EFFECTS.glow;
  const p = (fx.presets && fx.presets[preset || fx.defaultPreset]) || {};
  return { render: fx.render, family: name, ...p, ...overrides };
}

/**
 * Bind a generator along a host contour and return the effect-layer faces.
 * @param {object} args
 * @param {Array<[number,number]>} args.contour  the host's drive ring (local 2D)
 * @param {number} args.depth                     the host's extrusion depth
 * @param {string} [args.pathing='wrap']          a CONTOUR_PATHINGS preset
 * @param {object} [args.pathingParams]
 * @param {string|function} [args.generator='plant']
 * @param {object} [args.generatorParams]
 * @param {number} [args.progress=1]              0..1 grow-in
 * @returns {Array<object>} effect items — `{kind:'quad', pts, role}` solids
 *   (plant), or `{kind:'stroke', pts, role, intensity}` / `{kind:'node', p, r,
 *   role, intensity}` for line-and-glow generators (electric). The renderer
 *   interprets the kind; the operator just concatenates.
 */
export function formEffect({ contour, depth = 0.4, pathing = 'wrap', pathingParams = {}, generator = 'plant', generatorParams = {}, progress = 1 }) {
  const route = CONTOUR_PATHINGS[pathing] || CONTOUR_PATHINGS.wrap;
  const gen = typeof generator === 'function' ? generator : (GENERATORS[generator] || GENERATORS.plant);
  const paths = route(contour, depth, pathingParams);
  const faces = [];
  for (const path of paths) {
    if (path.t0 > progress) continue;
    const local = Math.max(0, Math.min(1, (progress - path.t0) / Math.max(path.span ?? 0.12, 1e-3)));
    faces.push(...gen(path, generatorParams, local));
  }
  return faces;
}
