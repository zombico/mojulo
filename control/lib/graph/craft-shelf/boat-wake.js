/**
 * boat-wake — what a boat does to the water it moves through, worked out from its own hull and drawn as part of the
 * assembled craft (index.js `assembleCraft(id, { underway: { speed } })`): its readout's `underway` and a `wake` item on
 * the water. Pure: the same boat at the same speed draws the same wake, its ragged edges from seeded dice.
 *
 * The physics it reads, from the hull at its waterline (`waterplane`: the length and beam where its sections cross the
 * water its weight sets) and its speed U:
 *   froude        U / √(g·L), L its waterline length: the wave the hull makes is as long as it at 0.4 (its hull speed)
 *   froudeVolume  U / √(g·∇^⅓), ∇ the volume it displaces: under 1 it displaces its way through the water, over 3 a
 *                 hull with chines planes on it (Savitsky's bands), between them it is half lifted; a round hull never
 *                 planes
 *   wavelength    2πU²/g, the transverse waves' (deep water: a wave's speed is the boat's)
 *   angle         the wake's half-angle: Kelvin's asin(1/3) = 19.47°, narrowed past a Froude number of 0.5 to the
 *                 apparent angle 1 / (2√(2π)·Fr) (Rabaud and Moisy) a fast boat's wake is seen at
 *
 * What it draws, on the water (its `z` 0 the surface) in the hull's frame (+y the bow, +x starboard):
 *   crests        the bow's Kelvin crests: each the curve x = a·cosθ(1 + sin²θ), y = a·sinθ·cos²θ behind the bow, a
 *                 the crest's distance down the track (n wavelengths), across narrowed to the apparent angle; low
 *                 ridges, each lower than the one before it (an estimate for drawing, not a resistance prediction)
 *   bow wave      foam climbing the hull's sides from the stem (a displacing hull pushing its bow wave; the first
 *                 crest breaking along the sides fast enough to)
 *   stern wake    the turbulent band behind the transom, as wide as the hull there and widening, its edges ragged
 *   wash          froth over each drive (a propeller, a jet's nozzle, a screw), a rooster tail behind a jet or an
 *                 outboard on the plane
 *   spray         sheets thrown from a planing hull's chines, outward and aft
 *
 * Craft space: +y forward, +z up, +x starboard, metres.
 */
import { DEG, lathe, sweep, extrudeWorld, loftWorld, planeUV, round3, mulberry32, hashSeed } from './craft-common.js';

export const G = 9.81;
const r3v = (v) => v.map(round3);
const KELVIN = Math.asin(1 / 3);
const FOAM = '#eef2f2', CREST = '#5d90a2', WASH = '#dfe9ea';
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
// (a flat sheet on the water: its outline in plan, a few centimetres thick, just proud of the surface)
const sheet = (id, ring, tint, z = 0) => extrudeWorld(id, [0, 0, z - 0.01], [0, 0, z + 0.025], ccw([0, 0, z - 0.01], [0, 0, z + 0.025], ring.map(([x, y]) => [x, y, 0])), tint);

/** Where a hull's sections cross the water at `draft` (above its keel): its waterline's length, its beam, its ends'
 *  places along it (y, hull frame) and its half-breadth at a y. `section(s)` is boat-parts.js `hullSection`. */
export function waterplane(row, draft, section, { samples = 240 } = {}) {
  const L = row.dims.length, half = [];
  for (let k = 0; k <= samples; k += 1) {
    const s = k / samples, P = section(row, s);
    let w = -1;
    for (let i = 0; i < P.length; i += 1) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[1] - draft) * (b[1] - draft) <= 0 && a[1] !== b[1]) w = Math.max(w, Math.abs(a[0] + ((draft - a[1]) / (b[1] - a[1])) * (b[0] - a[0])));
    }
    // (a section wholly under the water, a transom's run: as wide as it is)
    if (w < 0 && P.every((p) => p[1] < draft)) w = Math.max(...P.map((p) => Math.abs(p[0])));
    half.push([-L / 2 + s * L, w]);
  }
  const wet = half.filter(([, w]) => w > 0);
  if (!wet.length) return null;
  const aft = wet[0][0], fore = wet[wet.length - 1][0];
  const halfAt = (y) => { const k = Math.round(((y + L / 2) / L) * samples); return k < 0 || k > samples ? 0 : Math.max(0, half[k][1]); };
  return { length: round3(fore - aft), beam: round3(2 * Math.max(...wet.map(([, w]) => w))), aft: round3(aft), fore: round3(fore), halfAt };
}

/** The wake's numbers: a hull row at its draft and displaced volume, moving at `speed` m/s, its drives' places. */
export function boatWake({ row, draft, volume, speed, drives = [], section }) {
  const U = Math.max(0, +speed || 0), W = waterplane(row, draft, section);
  if (!W || !(U > 0)) return null;
  const L = W.length, froude = U / Math.sqrt(G * L), froudeVolume = U / Math.sqrt(G * Math.cbrt(Math.max(volume, 1e-6)));
  const chined = row.build.family === 'vee';
  // (a hull past its hull speed but short of lifting is still displacing: a destroyer at 30 knots)
  const regime = !chined || froudeVolume < 1 || froude < 0.5 ? 'displacement' : froudeVolume < 3 ? 'semi-planing' : 'planing';
  const angle = froude <= 0.5 ? KELVIN : Math.min(KELVIN, 1 / (2 * Math.sqrt(2 * Math.PI) * froude));
  const wavelength = (2 * Math.PI * U * U) / G;
  // (the waves along the wake's edge: their direction θ from the track the larger root of Kelvin's tan α = tan θ /
  // (1 + 2 tan² θ), their crests 90° − θ from it, their length λ·cos² θ; on Kelvin's 19.47° that is 35.26° and ⅔ λ)
  const ta = Math.tan(angle), tw = (1 + Math.sqrt(Math.max(0, 1 - 8 * ta * ta))) / (4 * ta), theta = Math.atan(tw);
  const divergent = { direction: round3(theta / DEG), crest: round3(90 - theta / DEG), wavelength: round3(wavelength * Math.cos(theta) ** 2) };
  // (the stagnation head U²/2g, a share of it the bow wave's climb up a displacing hull; a planing hull rides over it)
  const head = (U * U) / (2 * G);
  const bowWave = regime === 'planing' ? 0 : Math.min(0.15 * head, 0.8 * draft);
  // (a crest's height for drawing: the bow wave's at the first, falling off down the track)
  const crest = Math.max(0.02, Math.min(regime === 'planing' ? 0.25 * draft + 0.05 : 0.5 * draft, 0.35 * bowWave + 0.04 * W.beam * Math.min(1, froude / 0.4) ** 2));
  const reach = Math.max(2.5 * L, Math.min(8 * L, 3 * wavelength));
  // (the stern's turbulent wake: its white water `foam` long, its froth thinning out to `length`)
  const sternWake = { foam: round3(L * (regime === 'displacement' ? 0.3 + 1.2 * Math.min(froude, 0.6) : 1.5)), length: round3(L * (regime === 'displacement' ? 2 + 4 * Math.min(froude, 0.6) : 4)), width: round3(0.85 * W.beam) };
  const rooster = regime === 'planing' ? drives.filter((d) => d.kind === 'jet' || d.kind === 'outboard').map((d) => ({ at: r3v(d.at), height: round3(Math.min(0.06 * head, 4)) })) : [];
  return {
    speed: round3(U), knots: round3(U / 0.514444), froude: round3(froude), froudeVolume: round3(froudeVolume), regime,
    angle: round3(angle / DEG), wavelength: round3(wavelength), divergent, bowWave: round3(bowWave), crest: round3(crest), reach: round3(reach),
    waterline: { length: L, beam: W.beam, aft: W.aft, fore: W.fore }, sternWake, drives: drives.map((d) => ({ kind: d.kind, at: r3v(d.at) })),
    ...(rooster.length ? { rooster } : {}), ...(regime === 'planing' ? { spray: true } : {}),
    halfAt: W.halfAt,
  };
}

/** The wake as a recipe on the water (z 0 the surface), in the hull's frame: its crests, its edges, its bow wave, its
 *  stern's foam, its wash, its rooster tails and its spray. `seed` picks its ragged edges. */
export function wakeRecipe(w, { seed = 1 } = {}) {
  const rnd = mulberry32(hashSeed(`wake:${seed}:${w.speed}`)), sweeps = [], extrudes = [], lofts = [], lathes = [];
  const { fore, aft, beam, length: Lw } = w.waterline, half = (y) => w.halfAt(y), kelvin = w.froude <= 0.6;
  // the bow's Kelvin crests (a displacing hull's: its transverse waves and their divergent ends to the cusp), each a
  // curve behind the bow kept to the water outside the hull, lower each crest down the track
  if (kelvin) {
    const N = Math.max(1, Math.min(6, Math.floor(w.reach / w.wavelength) || 1));
    for (let n = 1; n <= N; n += 1) {
      const a = n * w.wavelength, r = round3(Math.max(0.02, (0.6 * w.crest) / Math.sqrt(n)));
      for (const sx of [1, -1]) {
        const pts = [];
        for (let k = 0; k <= 32; k += 1) {
          const th = (Math.PI / 2) * (k / 32), x = a * Math.cos(th) * (1 + Math.sin(th) ** 2), y = a * Math.sin(th) * Math.cos(th) ** 2;
          const Y = fore - x, X = sx * y;
          if (x > w.reach || (Y > aft - 0.5 && Math.abs(X) < half(Y) + 0.3)) continue;
          pts.push([round3(X), round3(Y), 0]);
        }
        if (pts.length >= 3) sweeps.push(sweep(`crest_${n}${sx > 0 ? 'r' : 'l'}`, pts, r, CREST, { sides: 6 }));
      }
    }
  }
  // the wake's edges: from the bow's shoulders (displacing) or the transom's corners (lifted) out at its apparent angle,
  // a low ridge falling as the cube root of its distance (a divergent wave's), white where it breaks near the boat; a
  // fast boat's divergent waves along it as short crests set at their own angle to the track, spaced their length along
  // it (a displacing hull's are its Kelvin crests' ends)
  const lifted = w.regime !== 'displacement', y0 = lifted ? aft : fore - 0.08 * Lw, x0 = half(y0) + 0.2, al = w.angle * DEG;
  const armAt = (sx, d) => [sx * (x0 + d * Math.sin(al)), y0 - d * Math.cos(al)];
  const rAt = (d) => Math.max(0.015, 0.5 * w.crest * Math.cbrt(Lw / Math.max(Lw, d)));
  for (const sx of [1, -1]) {
    const D = Array.from({ length: 13 }, (_, k) => w.reach * (k / 12) ** 1.5);
    sweeps.push(sweep(`edge_${sx > 0 ? 'r' : 'l'}`, D.map((d) => [...armAt(sx, d), 0].map(round3)), round3(rAt(Lw)), CREST, { sides: 6 }));
    // (breaking: a white cap along its first stretch, longer the faster it goes)
    const cap = Math.min(w.reach, Lw * (lifted ? 2.5 : 0.8 + 2 * Math.min(w.froude, 0.6))), C = Array.from({ length: 7 }, (_, k) => cap * (k / 6));
    sweeps.push(sweep(`edge_cap_${sx > 0 ? 'r' : 'l'}`, C.map((d) => [...armAt(sx, d), round3(0.8 * rAt(d))].map(round3)), round3(0.5 * rAt(Lw)), FOAM, { sides: 5 }));
    if (!kelvin) {
      const th = w.divergent.direction * DEG, gap = Math.max(0.5 * Lw, w.divergent.wavelength / Math.max(0.25, Math.cos(th - al))), n = Math.max(2, Math.min(20, Math.floor(w.reach / gap)));
      const ca = 90 * DEG - th, u = [sx * Math.sin(ca), -Math.cos(ca)], len = Math.min(0.4 * gap, 0.6 * Lw);
      for (let k = 1; k <= n; k += 1) {
        const c = armAt(sx, k * gap), r = round3(0.7 * rAt(k * gap));
        // (inboard of the edge, the crest's outer end on it)
        sweeps.push(sweep(`divergent_${sx > 0 ? 'r' : 'l'}${k}`, [[c[0] - u[0] * len, c[1] - u[1] * len, 0], [c[0] - u[0] * len / 2, c[1] - u[1] * len / 2, r * 0.3], [c[0], c[1], 0]].map((p) => p.map(round3)), r, CREST, { sides: 6 }));
      }
    }
  }
  // the bow wave: foam climbing the sides from the stem, its top falling away aft (a skin of panels along the side)
  if (w.bowWave > 0.05) for (const sx of [1, -1]) {
    const run = Math.min(0.25 * Lw, 3 * w.wavelength), S = 10, at = (k) => { const Y = fore - (run * k) / S; return [sx * (half(Y) + 0.04), Y, 0]; };
    for (let k = 0; k < S; k += 1) {
      const A = at(k), B = at(k + 1), h = round3(w.bowWave * Math.min(1, (k + 1) / 3) * (1 - k / (S + 1)));
      const d = [B[0] - A[0], B[1] - A[1]], l = Math.hypot(d[0], d[1]) || 1, p = [d[1] / l, -d[0] / l], n = Math.sign(p[0]) === sx ? p : [-p[0], -p[1]];
      extrudes.push(extrudeWorld(`bow_wave_${sx > 0 ? 'r' : 'l'}${k}`, A, B, ccw(A, B, [[0, 0, -0.02], [0, 0, h], [n[0] * 0.05, n[1] * 0.05, h], [n[0] * 0.05, n[1] * 0.05, -0.02]]), FOAM));
    }
  }
  // the stern's wake: its white water behind the transom, as wide as the hull there and widening, its edges ragged;
  // then its froth, thinning out down the track
  const SW = w.sternWake, K = 12, edge = [];
  const wideAt = (f) => (SW.width / 2) * (1 + 1.2 * Math.sqrt(f));
  for (let k = 0; k <= K; k += 1) { const f = k / K; edge.push([wideAt((f * SW.foam) / SW.length) * (1 - 0.55 * f * f) * (1 + 0.14 * (rnd() - 0.5)), aft - SW.foam * f]); }
  const ring = [...edge, ...edge.slice().reverse().map(([x, y]) => [-x * (1 + 0.1 * (rnd() - 0.5)), y])].map(([x, y]) => [round3(x), round3(y)]);
  extrudes.push(sheet('stern_wake', ring, FOAM));
  const froth = Math.max(8, Math.min(40, Math.round(SW.length / Math.max(2, beam))));
  for (let k = 0; k < froth; k += 1) {
    const f = rnd() ** 1.6, Y = aft - SW.foam * 0.6 - (SW.length - SW.foam * 0.6) * f, X = (rnd() * 2 - 1) * wideAt(Math.min(1, (aft - Y) / SW.length)) * 0.9;
    const R = (0.25 + 0.45 * rnd()) * Math.max(0.3, 0.18 * beam) * (1 - 0.6 * f);
    extrudes.push(sheet(`froth_${k}`, Array.from({ length: 7 }, (_, i) => { const q = (2 * Math.PI * i) / 7, rr = R * (0.7 + 0.3 * rnd()); return [round3(X + rr * Math.cos(q)), round3(Y + rr * 2.2 * Math.sin(q))]; }), WASH, 0.005));
  }
  // the wash over each drive: a churned patch on the surface aft of it
  for (const [k, d] of w.drives.entries()) {
    const R = Math.max(0.3, Math.min(6, 0.22 * beam)), X = d.at[0], Y = d.at[1] - R * 0.6;
    extrudes.push(sheet(`wash_${k}`, Array.from({ length: 9 }, (_, i) => { const q = (2 * Math.PI * i) / 9, rr = R * (0.75 + 0.25 * rnd()); return [round3(X + rr * Math.cos(q)), round3(Y + rr * 1.8 * Math.sin(q))]; }), FOAM, 0.01));
  }
  // a rooster tail behind a jet or an outboard on the plane: a fan of spray rising aft, spreading and falling back
  for (const [k, R] of (w.rooster || []).entries()) {
    const H = R.height, back = 4 * H;
    const stations = [0, 0.25, 0.5, 0.75, 1].map((f) => { const rx = 0.06 + 0.45 * H * f, rz = 0.03 + 0.06 * H * f, z = H * Math.sin(Math.PI * Math.min(1, f * 1.1)); return { t: f, points: Array.from({ length: 10 }, (_, i) => { const q = (2 * Math.PI * i) / 10; return [rx * Math.cos(q), 0, rz * Math.sin(q) + z]; }) }; });
    lofts.push(loftWorld(`rooster_${k}`, [R.at[0], R.at[1], 0], [R.at[0], R.at[1] - back, 0], stations, WASH));
  }
  // spray off a planing hull's chines where it meets the water: a thin sheet each side curling out and down from the
  // chine, low at its front and widest aft
  if (w.spray) for (const sx of [1, -1]) {
    const h = Math.min(0.35 + 0.01 * Lw, (0.05 * w.speed * w.speed) / (2 * G)), ya = fore - 0.4 * Lw, yb = fore - 0.8 * Lw;
    const stations = [0, 0.5, 1].map((f) => {
      const Y = ya + (yb - ya) * f, x = half(Y) + 0.02, k = 0.35 + 0.65 * f, out = 2.2 * h * k, up = h * k;
      // (an arc from the chine out and up to its crest and down again, a few centimetres thick)
      const arc = Array.from({ length: 7 }, (_, i) => { const q = i / 6; return [sx * (x + out * q), 0, up * Math.sin(Math.PI * q * 0.85) - 0.02]; });
      return { t: f, points: [...arc, ...arc.slice().reverse().map(([X, , Z]) => [X, 0, Z + 0.03])] };
    });
    lofts.push(loftWorld(`spray_${sx > 0 ? 'r' : 'l'}`, [0, ya, 0], [0, yb, 0], stations, WASH));
  }
  return { sweeps, extrudes, lofts, lathes, garage: { sku: 'wake', kind: 'boat-wake', mass: 0, hardpoints: { mount: [0, 0, 0] } } };
}
