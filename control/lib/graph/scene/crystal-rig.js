/**
 * crystal-rig — crystals as light operators for worlds and games (crystal-rig R1).
 *
 * Game-directed, not physics: each gem does ONE thing to a beam that a player can read by light alone, its constant
 * taken from what the crystal-light study measured, then exaggerated and quantized.
 *
 *   relay   quartz (amethyst, sapphire tinted)  the beam leaves along the stone's c axis: the clear control, steered
 *   fan     diamond      white in → five saturated beams fanned in the plane ⟂ c (red least bent, violet most); a
 *                        coloured beam leaves as one, bent by its own wavelength
 *   twin    calcite      one beam → two parallel beams with crossed polarizations (Malus splits a polarized input)
 *   gate    tourmaline   passes only the share polarized along c (cos², a 0.25% leak), tinted green, polarized
 *   charge  ruby         red passes; the rest charges it (QE 0.7) and leaves as a red glow and a pulsed laser along c
 *   iris    opal         a seeded mosaic of Bragg mirrors: reflections whose colour is the angle (λ = 2·d·n·cosθ)
 *
 * `rigKernel()` is SELF-CONTAINED (no imports, no closure over module scope): the World page embeds its source and
 * runs the same solver live, re-solving every frame as crystals turn; the server runs it for tests and exports. It
 * also builds the occluder the beams stop at: a uniform grid over triangles (3D DDA, Möller–Trumbore), the same code
 * on both sides.
 */

import { crystalOptics } from '../polygonizer/crystal-optics.js';

export function rigKernel() {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const perp = (v) => unit(cross(v, Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const rot = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a); return add(add(scl(v, c), scl(cross(k, v), s)), scl(k, dot(k, v) * (1 - c))); };
  const hash = (n) => { let x = (n | 0) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

  // CIE 1931 2° (10 nm, 380–700) → linear sRGB, normalized to the brightest channel: the colour of a wavelength
  const CMF = [[0.001368, 0.000039, 0.00645], [0.004243, 0.00012, 0.02005], [0.01431, 0.000396, 0.06785], [0.04351, 0.00121, 0.2074], [0.13438, 0.004, 0.6456], [0.2839, 0.0116, 1.3856], [0.34828, 0.023, 1.74706], [0.3362, 0.038, 1.77211], [0.2908, 0.06, 1.6692], [0.19536, 0.09098, 1.28764], [0.09564, 0.13902, 0.81295], [0.03201, 0.20802, 0.46518], [0.0049, 0.323, 0.272], [0.0093, 0.503, 0.1582], [0.06327, 0.71, 0.07825], [0.1655, 0.862, 0.04216], [0.2904, 0.954, 0.0203], [0.43345, 0.99495, 0.00875], [0.5945, 0.995, 0.0039], [0.7621, 0.952, 0.0021], [0.9163, 0.87, 0.00165], [1.0263, 0.757, 0.0011], [1.0622, 0.631, 0.0008], [1.0026, 0.503, 0.00034], [0.85445, 0.381, 0.00019], [0.6424, 0.265, 0.00005], [0.4479, 0.175, 0.00002], [0.2835, 0.107, 0], [0.1649, 0.061, 0], [0.0874, 0.032, 0], [0.04677, 0.017, 0], [0.0227, 0.00821, 0], [0.011359, 0.004102, 0]];
  function lambdaColor(nm) {
    const x = Math.max(0, Math.min(31.999, (nm - 380) / 10)); const i = Math.floor(x), f = x - i; const c = [0, 1, 2].map((k) => CMF[i][k] + (CMF[i + 1][k] - CMF[i][k]) * f);
    const L = [3.2406 * c[0] - 1.5372 * c[1] - 0.4986 * c[2], -0.9689 * c[0] + 1.8758 * c[1] + 0.0415 * c[2], 0.0557 * c[0] - 0.204 * c[1] + 1.057 * c[2]].map((v) => Math.max(0, v));
    const m = Math.max(L[0], L[1], L[2]) || 1; return L.map((v) => v / m);
  }
  const whiteness = (c) => { const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mx > 0 ? mn / mx : 0; };
  /** A beam's colour as a word a recipe can ask for: by its wavelength when it has one, else by hue. */
  function colorName(color, lambda) {
    if (lambda) return lambda < 450 ? 'violet' : lambda < 490 ? 'blue' : lambda < 520 ? 'cyan' : lambda < 565 ? 'green' : lambda < 590 ? 'yellow' : lambda < 625 ? 'orange' : 'red';
    if (whiteness(color) > 0.6) return 'white';
    const [r, g, b] = color.map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));   // hue as the eye sees it: sRGB, not linear
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const h = ((mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn)) * 60 + 360) % 360;
    return h < 15 || h >= 330 ? 'red' : h < 40 ? 'orange' : h < 70 ? 'yellow' : h < 160 ? 'green' : h < 200 ? 'cyan' : h < 255 ? 'blue' : 'violet';
  }

  // ── the operators' constants, each from the study ────────────────────────────────────────────────────────
  const OPS = {
    relay: { loss: 0.05, twistPerMm: 21.7 },                                                  // Fresnel ×2 ≈ 5%; quartz ρ(589)
    fan: { bands: [640, 590, 540, 490, 445], spread: 26, bend: 14, keep: 0.92 },               // the brilliant returned 92%; fire ×~8
    twin: { walkoff: 6.24, exaggerate: 5 },                                                    // calcite's walk-off, ×5 to read
    gate: { tint: [0.3, 1, 0.22], leak: 0.0025 },                                              // a crossed pair passed 0.25%
    charge: { redPass: 0.9, qe: 0.7, lambda: 694, period: [0.35, 2.4], duty: 0.2 },            // ruby's R line; QE 0.7
    iris: { domains: 9, D: [200, 330], nEff: 1.42, reflect: 0.55 },                            // opal's sphere lattice
  };
  const OP_OF = { quartz: 'relay', amethyst: 'relay', sapphire: 'relay', diamond: 'fan', calcite: 'twin', tourmaline: 'gate', ruby: 'charge', opal: 'iris' };

  const out = (b, o, d, extra) => Object.assign({ o, d: unit(d), color: b.color, power: b.power, E: b.E, lambda: b.lambda, width: b.width, gen: b.gen + 1 }, extra || {});
  /** Where a beam leaves a stone it passed through: the far side of its bounding sphere along the beam. */
  const exitOf = (b, s, entry) => add(b.o, scl(b.d, entry + 2 * s.r));

  const OPERATORS = {
    relay(b, s) {
      const d = dot(s.axis, b.d) >= 0 ? s.axis : scl(s.axis, -1);
      const twist = (OPS.relay.twistPerMm * (s.mm || 2 * s.r * 10)) * Math.PI / 180;
      const E = b.E ? unit(rot(unit(sub(b.E, scl(d, dot(b.E, d)))), d, twist)) : null;
      const tint = s.tint || [1, 1, 1]; const col = b.color.map((v, k) => v * tint[k]); const m = Math.max(col[0], col[1], col[2]) || 1;
      return { beams: [out(b, add(s.at, scl(d, s.r * 1.1)), d, { power: b.power * (1 - OPS.relay.loss) * m, color: col.map((v) => v / m), E, lambda: s.tint ? null : b.lambda })],
        glows: [{ p: s.at, color: col.map((v) => v / m), power: b.power * 0.08 }] };
    },
    fan(b, s) {
      const f = OPS.fan; const spread = s.spread != null ? s.spread : f.spread, bend = s.bend != null ? s.bend : f.bend;
      const pd = sub(b.d, scl(s.axis, dot(b.d, s.axis))); const fwd = len(pd) < 1e-6 ? perp(s.axis) : unit(pd);   // the fan lies ⟂ c, aimed along the beam
      const o = add(s.at, scl(fwd, s.r * 1.1));
      if (whiteness(b.color) < 0.6 && b.lambda) {                                                  // a coloured beam: one beam, bent by its wavelength
        const k = (b.lambda - 445) / (640 - 445); const a = (bend + spread * (0.5 - k)) * Math.PI / 180;
        return { beams: [out(b, o, rot(fwd, s.axis, a), { power: b.power * f.keep })], glows: [{ p: s.at, color: b.color, power: b.power * 0.1 }] };
      }
      const K = f.bands.length;
      const beams = f.bands.map((l, i) => { const a = (bend + spread * (i / (K - 1) - 0.5)) * Math.PI / 180;
        return out(b, o, rot(fwd, s.axis, a), { color: lambdaColor(l), lambda: l, power: b.power * f.keep / K, E: null, width: b.width * 0.7 }); });
      const glints = [0, 1, 2, 3, 4, 5].map((i) => ({ p: add(s.at, scl(unit([hash(s.seed * 31 + i) - 0.5, hash(s.seed * 17 + i) - 0.5, hash(s.seed * 7 + i) - 0.3]), s.r)), color: lambdaColor(445 + 39 * i), power: b.power * 0.04 }));
      return { beams, glows: [{ p: s.at, color: [1, 1, 1], power: b.power * 0.15 }].concat(glints) };
    },
    twin(b, s, { entry }) {
      const t = OPS.twin; const cp = sub(s.axis, scl(b.d, dot(s.axis, b.d))); const u = len(cp) < 1e-6 ? perp(b.d) : unit(cp);
      const Eo = unit(cross(b.d, u)), Ee = u;                                                      // o: E ⟂ c; e: E in the principal plane
      const po = b.E ? dot(b.E, Eo) ** 2 : 0.5, pe = b.E ? dot(b.E, Ee) ** 2 : 0.5;
      const o = exitOf(b, s, entry); const off = scl(u, 2 * s.r * Math.tan(t.walkoff * Math.PI / 180) * t.exaggerate);
      const beams = [];
      if (po > 0.02) beams.push(out(b, o, b.d, { power: b.power * po, E: Eo, key: 'o' }));
      if (pe > 0.02) beams.push(out(b, add(o, off), b.d, { power: b.power * pe, E: Ee, key: 'e' }));
      return { beams, glows: [{ p: s.at, color: b.color, power: b.power * 0.05 }] };
    },
    gate(b, s, { entry }) {
      const g = OPS.gate; const cp = sub(s.axis, scl(b.d, dot(s.axis, b.d))); const pass = len(cp) < 1e-6 ? null : unit(cp);
      const share = !pass ? g.leak : b.E ? Math.max(g.leak, dot(b.E, pass) ** 2) : 0.5;               // looking down c there is no e ray: dark
      const color = b.color.map((v, k) => v * g.tint[k]); const m = Math.max(color[0], color[1], color[2]) || 1;
      return { beams: share > 0.01 ? [out(b, exitOf(b, s, entry), b.d, { power: b.power * share * m, color: color.map((v) => v / m), E: pass, lambda: 535 })] : [],
        glows: [{ p: s.at, color: [0.3, 1, 0.3], power: b.power * (1 - share) * 0.12 }] };
    },
    charge(b, s, { entry }) {
      const q = OPS.charge; const sum = b.color[0] + b.color[1] + b.color[2] || 1;
      const redShare = b.lambda ? (b.lambda > 640 ? 1 : 0) : b.color[0] / sum * (whiteness(b.color) > 0.6 ? 0.35 : 1);
      const pass = b.power * redShare * q.redPass, absorbed = b.power * (1 - redShare) * q.qe;
      const red = lambdaColor(q.lambda);
      const period = Math.max(q.period[0], Math.min(q.period[1], 0.25 / Math.max(absorbed, 1e-3)));
      const pulse = { period, duty: q.duty, phase: hash(s.seed) };
      const beams = [];
      if (pass > 0.01) beams.push(out(b, exitOf(b, s, entry), b.d, { power: pass, color: red, lambda: q.lambda }));
      if (absorbed > 0.01) beams.push(out(b, add(s.at, scl(s.axis, s.r * 1.1)), s.axis, { power: absorbed / q.duty, color: red, lambda: q.lambda, E: null, width: b.width * 0.45, pulse }));
      return { beams, glows: [{ p: s.at, color: red, power: absorbed * 0.8 + pass * 0.1, pulse: absorbed > 0.01 ? { period, duty: 0.6, phase: pulse.phase } : null }] };
    },
    iris(b, s) {
      const q = OPS.iris; const beams = [], glows = [];
      const sx = s.x ? sub(s.x, scl(s.axis, dot(s.x, s.axis))) : null; const x = sx && len(sx) > 1e-6 ? unit(sx) : perp(s.axis), y = cross(s.axis, x);   // the stone's own frame: a spin about c turns its domains
      for (let j = 0; j < q.domains; j++) {
        const gl = unit([hash(s.seed * 101 + j) - 0.5, hash(s.seed * 211 + j) - 0.5, hash(s.seed * 307 + j) - 0.5]);
        let g = add(add(scl(x, gl[0]), scl(y, gl[1])), scl(s.axis, gl[2]));                          // the domain's normal, carried by the stone
        if (dot(g, b.d) > 0) g = scl(g, -1);
        const cos = -dot(b.d, g); const D = q.D[0] + (q.D[1] - q.D[0]) * hash(s.seed * 401 + j);
        const lambda = 2 * D * Math.sqrt(2 / 3) * q.nEff * cos; if (lambda < 405 || lambda > 690) continue;   // UV or IR: not drawn
        const d = sub(b.d, scl(g, 2 * dot(b.d, g)));
        beams.push(out(b, add(s.at, scl(g, s.r)), d, { color: lambdaColor(lambda), lambda, power: b.power * q.reflect / q.domains * 1.6, E: null, width: b.width * 0.55 }));
        glows.push({ p: add(s.at, scl(g, s.r * 0.7)), color: lambdaColor(lambda), power: b.power * 0.05 });
      }
      return { beams, glows };
    },
  };

  /** Ray vs sphere: the entry distance, or null. */
  function hitSphere(o, d, c, r) { const oc = sub(o, c); const bq = dot(oc, d), cq = dot(oc, oc) - r * r; const disc = bq * bq - cq; if (disc < 0) return null; const t = -bq - Math.sqrt(disc); return t > 1e-9 ? t : null; }

  /**
   * An occluder over triangles (a flat array, 9 numbers each): a uniform grid walked by a 3D DDA, each cell's
   * triangles tested once per ray (a stamp), Möller–Trumbore. hit(o, d, tMax) → { t, n (facing the ray) } | null.
   */
  function buildGrid(tri) {
    const n = Math.floor(tri.length / 9); if (!n) return { hit: () => null, cells: 0, tris: 0 };
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n * 9; i += 3) for (let k = 0; k < 3; k++) { const v = tri[i + k]; if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v; }
    const ext = [0, 1, 2].map((k) => hi[k] - lo[k]); const big = Math.max(ext[0], ext[1], ext[2]) || 1;
    for (let k = 0; k < 3; k++) { const pad = big * 1e-4 + 1e-9; lo[k] -= pad; hi[k] += pad; ext[k] = hi[k] - lo[k]; }
    const vol = ext[0] * ext[1] * ext[2]; const cell = Math.cbrt(vol / Math.max(1, n / 2)) || big;
    const R = ext.map((e) => Math.max(1, Math.min(96, Math.ceil(e / cell))));
    const cs = [0, 1, 2].map((k) => ext[k] / R[k]);
    const at = (x, k) => Math.max(0, Math.min(R[k] - 1, Math.floor((x - lo[k]) / cs[k])));
    const range = (i) => { const r = []; for (let k = 0; k < 3; k++) { const a = tri[i * 9 + k], b = tri[i * 9 + 3 + k], c = tri[i * 9 + 6 + k]; r.push(at(Math.min(a, b, c), k), at(Math.max(a, b, c), k)); } return r; };
    const count = new Int32Array(R[0] * R[1] * R[2] + 1);
    for (let i = 0; i < n; i++) { const r = range(i); for (let z = r[4]; z <= r[5]; z++) for (let y = r[2]; y <= r[3]; y++) for (let x = r[0]; x <= r[1]; x++) count[(z * R[1] + y) * R[0] + x + 1]++; }
    for (let i = 1; i < count.length; i++) count[i] += count[i - 1];
    const idx = new Int32Array(count[count.length - 1]); const fill = count.slice(0, -1);
    for (let i = 0; i < n; i++) { const r = range(i); for (let z = r[4]; z <= r[5]; z++) for (let y = r[2]; y <= r[3]; y++) for (let x = r[0]; x <= r[1]; x++) idx[fill[(z * R[1] + y) * R[0] + x]++] = i; }
    const stamp = new Int32Array(n); let ray = 0;
    function triT(i, o, d) {
      const j = i * 9; const e1 = [tri[j + 3] - tri[j], tri[j + 4] - tri[j + 1], tri[j + 5] - tri[j + 2]], e2 = [tri[j + 6] - tri[j], tri[j + 7] - tri[j + 1], tri[j + 8] - tri[j + 2]];
      const p = cross(d, e2); const det = dot(e1, p); if (Math.abs(det) < 1e-14) return null; const inv = 1 / det;
      const s = [o[0] - tri[j], o[1] - tri[j + 1], o[2] - tri[j + 2]]; const u = dot(s, p) * inv; if (u < 0 || u > 1) return null;
      const q = cross(s, e1); const v = dot(d, q) * inv; if (v < 0 || u + v > 1) return null; const t = dot(e2, q) * inv; return t > 1e-7 ? { t, e1, e2 } : null;
    }
    function hit(o, d, tMax) {
      ray = (ray + 1) | 0; if (ray === 0) { stamp.fill(0); ray = 1; }
      let t0 = 0, t1 = tMax;
      for (let k = 0; k < 3; k++) { if (Math.abs(d[k]) < 1e-15) { if (o[k] < lo[k] || o[k] > hi[k]) return null; continue; }
        let a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k]; if (a > b) { const s = a; a = b; b = s; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return null; }
      const p = [o[0] + d[0] * t0, o[1] + d[1] * t0, o[2] + d[2] * t0]; const c = [at(p[0], 0), at(p[1], 1), at(p[2], 2)];
      const step = [], next = [], delta = [];
      for (let k = 0; k < 3; k++) {
        step.push(d[k] > 0 ? 1 : d[k] < 0 ? -1 : 0);
        const edge = lo[k] + (c[k] + (d[k] > 0 ? 1 : 0)) * cs[k];
        next.push(d[k] !== 0 ? (edge - o[k]) / d[k] : Infinity); delta.push(d[k] !== 0 ? cs[k] / Math.abs(d[k]) : Infinity);
      }
      let best = null;
      for (let guard = 0; guard < 4 * (R[0] + R[1] + R[2]); guard++) {
        const ci = (c[2] * R[1] + c[1]) * R[0] + c[0]; const cellEnd = Math.min(next[0], next[1], next[2], t1);
        for (let q = count[ci]; q < count[ci + 1]; q++) { const i = idx[q]; if (stamp[i] === ray) continue; stamp[i] = ray; const h = triT(i, o, d); if (h && h.t <= tMax && (!best || h.t < best.t)) best = { t: h.t, i, e1: h.e1, e2: h.e2 }; }
        if (best && best.t <= cellEnd + 1e-9) break;
        const k = next[0] < next[1] ? (next[0] < next[2] ? 0 : 2) : (next[1] < next[2] ? 1 : 2);
        if (next[k] > t1) break; c[k] += step[k]; if (c[k] < 0 || c[k] >= R[k]) break; next[k] += delta[k];
      }
      if (!best) return null;
      let nn = unit(cross(best.e1, best.e2)); if (dot(nn, d) > 0) nn = scl(nn, -1);
      return { t: best.t, n: nn };
    }
    return { hit, cells: R[0] * R[1] * R[2], tris: n };
  }

  /**
   * Solve a rig: lamps through stones (operators act; receivers and targets catch) and the occluder, into segments,
   * pools where beams land, glows at stones, and what each target caught. Deterministic in its inputs and `t` (s).
   *   lamps   [{ o, d, color, power, width }]
   *   stones  [{ at, axis, r, op | null (a receiver), seed, tint?, spread?, bend?, mm? }]
   *   targets [{ id, at, r }]
   *   wall    (o, d, tMax) → { t, n } | null
   */
  function solve({ lamps, stones = [], targets = [], wall = null, t = 0, budget = {} }) {
    const B = Object.assign({ depth: 6, beams: 96, minPower: 0.02, maxLen: 1 }, budget);
    const segments = [], pools = [], glows = [], lit = {}, caught = [];
    const queue = lamps.map((s) => Object.assign({ width: 0.002, gen: 0, E: null, lambda: null, power: 1, color: [1, 1, 1] }, s, { d: unit(s.d) }));
    let n = 0;
    while (queue.length && n < B.beams) {
      const b = queue.shift(); n++;
      let best = null;
      for (let i = 0; i < stones.length; i++) { const s = stones[i]; if (s === b.from) continue; const te = hitSphere(b.o, b.d, s.at, s.r); if (te != null && te < B.maxLen && (!best || te < best.t)) best = { t: te, s, i }; }
      for (const g of targets) { const te = hitSphere(b.o, b.d, g.at, g.r); if (te != null && te < B.maxLen && (!best || te < best.t)) best = { t: te, g }; }
      const w = wall ? wall(b.o, b.d, best ? best.t : B.maxLen) : null;
      const seg = { a: b.o, b: null, color: b.color, lambda: b.lambda || null, power: b.power, width: b.width, pulse: b.pulse || null, key: b.key || null };
      if (w && (!best || w.t < best.t)) {
        seg.b = add(b.o, scl(b.d, w.t)); segments.push(seg);
        pools.push({ p: seg.b, n: w.n, color: b.color, power: b.power, width: b.width, pulse: b.pulse || null });
      } else if (best && best.g) {
        seg.b = add(b.o, scl(b.d, best.t)); segments.push(seg);
        const L = lit[best.g.id] || (lit[best.g.id] = { power: 0, colors: {} }); const name = colorName(b.color, b.lambda);
        L.power += b.power; L.colors[name] = (L.colors[name] || 0) + b.power;
        glows.push({ p: best.g.at, color: b.color, power: b.power * 0.6, pulse: b.pulse || null, target: best.g.id });
      } else if (best && (!best.s.op || b.gen >= B.depth)) {
        seg.b = add(b.o, scl(b.d, best.t)); segments.push(seg);                                         // a receiver (or the depth cap): it lights up
        caught.push(best.i); glows.push({ p: best.s.at, color: b.color, power: b.power * 0.5, pulse: b.pulse || null, stone: best.i });
        pools.push({ p: seg.b, n: unit(sub(seg.b, best.s.at)), color: b.color, power: b.power * 0.6, width: b.width, pulse: b.pulse || null });
      } else if (best) {
        seg.b = add(b.o, scl(b.d, best.t)); segments.push(seg);
        const r = OPERATORS[best.s.op](b, best.s, { entry: best.t, t });
        for (const g of r.glows || []) glows.push(Object.assign(g, { stone: best.i }));
        for (const nb of r.beams) if (nb.power >= B.minPower) queue.push(Object.assign(nb, { from: best.s, pulse: nb.pulse || b.pulse || null }));
      } else {
        seg.b = add(b.o, scl(b.d, B.maxLen)); segments.push(seg);
      }
    }
    return { segments, pools, glows, lit, caught, stats: { beams: n, segments: segments.length, pools: pools.length, glows: glows.length, capped: queue.length > 0 } };
  }
  /** A pulse's brightness at time t (s): a soft on-window of its duty, else 0; 1 without a pulse. */
  function pulseAt(p, t) { if (!p) return 1; const x = ((t / p.period + p.phase) % 1 + 1) % 1; return x < p.duty ? Math.sin(Math.PI * x / p.duty) : 0; }
  /** Does what a target caught satisfy what it wants ({ color?, min? })? */
  function satisfied(caughtBy, want) {
    if (!caughtBy) return false; const min = want && Number.isFinite(want.min) ? want.min : 0.05;
    if (!want || !want.color) return caughtBy.power >= min;
    return (caughtBy.colors[want.color] || 0) >= min;
  }
  return { OPS, OP_OF, OPERATORS, lambdaColor, colorName, buildGrid, solve, pulseAt, satisfied, hitSphere };
}

export const { OPS: RIG_OPS, OP_OF: RIG_OP_OF, OPERATORS: RIG_OPERATORS, lambdaColor, colorName, buildGrid, solve: solveRig, pulseAt, satisfied } = rigKernel();

// ── the server side: a recipe's `crystalLight` + a page's faces → the rig the page runs ─────────────────────────────

const unit3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const v3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const perp3 = (a) => unit3(Math.abs(a[0]) < 0.9 ? [0, a[2], -a[1]] : [-a[2], 0, a[0]]);   // a × x̂, or a × ŷ near x
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; };
/** A group with more stones than this is a druse (a lining, a bed): a receiver the light lands on, not a rig part. */
export const RIG_OPERATOR_MAX = 12;
export const RIG_COLORS = Object.freeze(['white', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet']);
export const RIG_OPS_LIST = Object.freeze(['relay', 'fan', 'twin', 'gate', 'charge', 'iris']);

/** '#rrggbb' | [r,g,b] (0–1, sRGB) → a linear colour normalized to its brightest channel. */
function beamColour(c) {
  let rgb = [1, 1, 1];
  if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  else if (Array.isArray(c) && c.length === 3 && c.every(Number.isFinite)) rgb = c.map((x) => Math.max(0, Math.min(1, x)));
  const lin = rgb.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); const m = Math.max(...lin) || 1;
  return lin.map((x) => +(x / m).toFixed(4));
}

/** Errors (strings) for a `crystalLight` spec; [] when it resolves. */
export function validateCrystalLight(spec, at = 'crystalLight') {
  const e = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${at}: { lamps: [{ at, aim | dir, color?, power?, width? }], targets?: [{ id, at, r, want?, toggles? }], crystals?, budget?, gain? }`];
  if (!Array.isArray(spec.lamps) || !spec.lamps.length) e.push(`${at}.lamps: at least one { at: [x,y,z], aim: [x,y,z] } (or dir)`);
  (spec.lamps || []).forEach((l, i) => {
    if (!l || !v3(l.at)) e.push(`${at}.lamps[${i}].at: [x, y, z]`);
    if (!(v3(l && l.aim) || (v3(l && l.dir) && Math.hypot(...l.dir) > 0))) e.push(`${at}.lamps[${i}]: aim: [x,y,z] (a point) or dir: [x,y,z]`);
    if (l && l.color !== undefined && !(typeof l.color === 'string' ? /^#[0-9a-f]{6}$/i.test(l.color) : v3(l.color))) e.push(`${at}.lamps[${i}].color: '#rrggbb' or [r,g,b] 0–1`);
    if (l && l.power !== undefined && !(Number.isFinite(l.power) && l.power > 0 && l.power <= 4)) e.push(`${at}.lamps[${i}].power: 0–4`);
    if (l && l.width !== undefined && !(Number.isFinite(l.width) && l.width > 0)) e.push(`${at}.lamps[${i}].width: > 0 world units`);
  });
  if (spec.targets !== undefined && !Array.isArray(spec.targets)) e.push(`${at}.targets: [{ id, at, r, want? }]`);
  const ids = new Set();
  (Array.isArray(spec.targets) ? spec.targets : []).forEach((g, i) => {
    if (!g || typeof g.id !== 'string' || !g.id) e.push(`${at}.targets[${i}].id: a name (the bus events carry it)`); else if (ids.has(g.id)) e.push(`${at}.targets[${i}].id: '${g.id}' is used twice`); else ids.add(g.id);
    if (!g || !v3(g.at)) e.push(`${at}.targets[${i}].at: [x, y, z]`);
    if (!g || !(Number.isFinite(g.r) && g.r > 0)) e.push(`${at}.targets[${i}].r: its catch radius, > 0`);
    if (g && g.toggles !== undefined && !(typeof g.toggles === 'string' && g.toggles)) e.push(`${at}.targets[${i}].toggles: the name of a mover group with states (lit steps it on, dark steps it back)`);
    if (g && g.want !== undefined) { if (typeof g.want !== 'object' || (g.want.color !== undefined && !RIG_COLORS.includes(g.want.color)) || (g.want.min !== undefined && !(Number.isFinite(g.want.min) && g.want.min >= 0))) e.push(`${at}.targets[${i}].want: { color?: ${RIG_COLORS.join(' | ')}, min?: power }`); }
  });
  if (spec.crystals !== undefined) {
    if (!spec.crystals || typeof spec.crystals !== 'object' || Array.isArray(spec.crystals)) e.push(`${at}.crystals: { <group>: true | false | { op?, spread?, bend? } }`);
    else for (const [g, v] of Object.entries(spec.crystals)) if (!(v === true || v === false || (v && typeof v === 'object' && (v.op === undefined || RIG_OPS_LIST.includes(v.op)) && [v.spread, v.bend].every((x) => x === undefined || Number.isFinite(x))))) e.push(`${at}.crystals.${g}: true (acts), false (catches light), or { op?: ${RIG_OPS_LIST.join(' | ')}, spread?, bend? } (degrees)`);
  }
  if (spec.budget !== undefined) { const b = spec.budget; if (!b || typeof b !== 'object' || [b.depth, b.beams, b.maxLen].some((x) => x !== undefined && !(Number.isFinite(x) && x > 0)) || (b.beams > 256) || (b.depth > 12)) e.push(`${at}.budget: { depth ≤ 12, beams ≤ 256, maxLen > 0 }`); }
  if (spec.gain !== undefined && !(Number.isFinite(spec.gain) && spec.gain > 0 && spec.gain <= 4)) e.push(`${at}.gain: 0–4, how bright beams draw`);
  return e;
}

/** The faces a beam stops at: every drawn, opaque, non-crystal face, as triangles (9 numbers each). */
export function occluderTriangles(faces) {
  const out = [];
  for (const f of faces) {
    if (!f || f.crystal || f.decal || f.water || f.glow || !Array.isArray(f.corners) || f.corners.length < 3 || (typeof f.alpha === 'number' && f.alpha < 0.5)) continue;
    const c = f.corners; for (let k = 1; k + 1 < c.length; k++) { const b = c[k], d = c[k + 1]; if (b === d || (b[0] === d[0] && b[1] === d[1] && b[2] === d[2])) continue; out.push(...c[0], ...b, ...d); }
  }
  return out;
}

/**
 * A page's faces + a recipe's `crystalLight` → the rig: stones (one per crystal stone, operators or receivers), lamps,
 * targets, a budget scaled to the scene. Pure and deterministic. Returns null when the spec does not resolve.
 */
export function crystalRigFor(faces, spec) {
  if (!spec || validateCrystalLight(spec).length) return null;
  const stones = new Map(); const perGroup = new Map();
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    if (!f || !Array.isArray(f.corners)) continue;
    for (const p of f.corners) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
    const k = f.crystal; if (!k || typeof k.gem !== 'string' || !v3(k.c)) continue;
    const id = k.stone != null ? String(k.stone) : k.c.join(','); if (stones.has(id)) continue;
    const group = typeof f.group === 'string' ? f.group : 'static';
    stones.set(id, { id, group, gem: k.gem, at: k.c, r: k.r || 1, axis: unit3(v3(k.axis) ? k.axis : [0, 0, 1]), cmu: Number.isFinite(k.cmu) && k.cmu > 0 ? k.cmu : 1 });
    perGroup.set(group, (perGroup.get(group) || 0) + 1);
  }
  const radius = Number.isFinite(lo[0]) ? Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 : 10;
  const list = [...stones.values()];
  const rs = list.map((s) => s.r).sort((a, b) => a - b); const rMed = rs.length ? rs[rs.length >> 1] : radius * 0.02;
  const over = spec.crystals || {};
  const rigStones = list.map((s) => {
    const o = over[s.group]; const acts = o === undefined ? perGroup.get(s.group) <= RIG_OPERATOR_MAX : o !== false;
    const op = acts ? ((o && o.op) || RIG_OP_OF[s.gem] || 'relay') : null;
    const x = perp3(s.axis);   // the kernel's perp(axis), carried so a turn about c shows on the page
    const row = { group: s.group, at: s.at.map((v) => +v.toFixed(6)), axis: s.axis.map((v) => +v.toFixed(6)), x: x.map((v) => +v.toFixed(6)), r: +s.r.toFixed(6), op, seed: fnv(s.id) % 100000, mm: +(2 * s.r * s.cmu * 10).toFixed(4) };
    if (op === 'relay' && (s.gem === 'amethyst' || s.gem === 'sapphire')) {                       // a coloured relay: the stone's own colour across it
      const t = crystalOptics(s.gem).colour.o[2]; const m = Math.max(...t) || 1; row.tint = t.map((x) => +(x / m).toFixed(4));   // after 1 cm, as the GLB's attenuation
    }
    if (o && typeof o === 'object') { if (Number.isFinite(o.spread)) row.spread = o.spread; if (Number.isFinite(o.bend)) row.bend = o.bend; }
    return row;
  });
  const width = +(rMed * 0.15).toFixed(6);
  const lamps = spec.lamps.map((l) => ({ o: l.at, d: unit3(v3(l.aim) ? [l.aim[0] - l.at[0], l.aim[1] - l.at[1], l.aim[2] - l.at[2]] : l.dir).map((x) => +x.toFixed(6)),
    color: beamColour(l.color), power: Number.isFinite(l.power) ? l.power : 1, width: Number.isFinite(l.width) ? l.width : width }));
  const targets = (spec.targets || []).map((g) => ({ id: g.id, at: g.at, r: g.r, ...(g.want ? { want: g.want } : {}), ...(g.toggles ? { toggles: g.toggles } : {}) }));
  const budget = { depth: 6, beams: 96, minPower: 0.02, maxLen: +(radius * 4).toFixed(4), ...(spec.budget || {}) };
  return { stones: rigStones, lamps, targets, budget, gain: Number.isFinite(spec.gain) ? spec.gain : 1, width };
}

/** Solve a rig server-side (tests, exports): the occluder from the faces, the stones as placed, at time t (s). */
export function solveRigOnFaces(faces, rig, t = 0) {
  const grid = buildGrid(occluderTriangles(faces));
  return solveRig({ lamps: rig.lamps, stones: rig.stones, targets: rig.targets, wall: grid.hit, t, budget: rig.budget });
}

/**
 * A frozen frame of a rig at time t, as geometry an importer can hold: beams (two crossed quads a segment) and pools
 * (a disc where a beam lands) grouped by colour name, each group one emissive node; the brightest glows as point lights.
 * { groups: [{ name, color, positions: number[] (triangles) }], lights: [{ p, color, power }] }.
 */
export function rigFrozenFrame(faces, rig, { t = 0, lights = 8 } = {}) {
  const res = solveRigOnFaces(faces, rig, t); const by = new Map();
  const put = (name, color, tris) => { const g = by.get(name) || by.set(name, { name, color, positions: [], power: 0 }).get(name); for (const v of tris) g.positions.push(...v); };
  for (const s of res.segments) {
    const k = pulseAt(s.pulse, t); if (k < 0.05) continue;
    const d = unit3([s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]]); const p1 = perp3(d); const p2 = [d[1] * p1[2] - d[2] * p1[1], d[2] * p1[0] - d[0] * p1[2], d[0] * p1[1] - d[1] * p1[0]];
    const w = s.width * (0.55 + 0.8 * Math.sqrt(s.power)) * 0.6; const tris = [];
    for (const e of [p1, p2]) { const o = e.map((x) => x * w); const A = [s.a[0] - o[0], s.a[1] - o[1], s.a[2] - o[2]], B = [s.b[0] - o[0], s.b[1] - o[1], s.b[2] - o[2]], C = [s.b[0] + o[0], s.b[1] + o[1], s.b[2] + o[2]], D = [s.a[0] + o[0], s.a[1] + o[1], s.a[2] + o[2]]; tris.push(A, B, C, A, C, D); }
    put(colorName(s.color, s.lambda), s.color, tris);
  }
  for (const p of res.pools) {
    const k = pulseAt(p.pulse, t); if (k < 0.05) continue; const r = p.width * 3 * (0.6 + Math.sqrt(p.power)) * 1.4;
    const u = perp3(p.n); const v = [p.n[1] * u[2] - p.n[2] * u[1], p.n[2] * u[0] - p.n[0] * u[2], p.n[0] * u[1] - p.n[1] * u[0]]; const c = [0, 1, 2].map((i) => p.p[i] + p.n[i] * r * 0.02);
    const at = (a) => [0, 1, 2].map((i) => c[i] + r * (u[i] * Math.cos(a) + v[i] * Math.sin(a))); const tris = [];
    for (let i = 0; i < 12; i++) tris.push(c, at(i / 12 * 2 * Math.PI), at((i + 1) / 12 * 2 * Math.PI));
    put(colorName(p.color, null), p.color, tris);
  }
  const glows = res.glows.filter((g) => pulseAt(g.pulse, t) > 0.05).sort((a, b) => b.power - a.power).slice(0, lights).map((g) => ({ p: g.p, color: g.color, power: g.power }));
  return { groups: [...by.values()].map((g) => ({ name: g.name, color: g.color.map((x) => +x.toFixed(4)), positions: g.positions.map((x) => +x.toFixed(5)) })), lights: glows, stats: res.stats, lit: res.lit };
}

/** A rig as score.json carries it for an engine kernel: positions and lengths × `scale` (metres per unit). */
export function rigForScore(rig, scale = 1) {
  const s = (v) => v.map((x) => +(x * scale).toFixed(6)); const n = (x) => +(x * scale).toFixed(6);
  return {
    stones: rig.stones.map((st) => ({ ...st, at: s(st.at), r: n(st.r) })),
    lamps: rig.lamps.map((l) => ({ ...l, o: s(l.o), width: n(l.width) })),
    targets: rig.targets.map((g) => ({ ...g, at: s(g.at), r: n(g.r) })),
    budget: { ...rig.budget, maxLen: n(rig.budget.maxLen) }, gain: rig.gain, width: n(rig.width),
  };
}
