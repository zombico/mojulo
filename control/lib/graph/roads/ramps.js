/**
 * ramps — what makes a road fly: shapes laid over its profile (alignment.js `profile.features`), each a lift dz(s) and
 * its slope dg(s) over a stretch [s0, s1], with its breaks (toe, lip, the drop's foot, the landing) as station marks.
 *
 *   kicker    a transition rising on a circle to its lip (height h, lip angle), then the back dropped: you land flat
 *   tabletop  the same lip, a flat top, a landing slope back down: overshoot the top and land on the slope
 *   gap       a lip, nothing (the road's own level) for `gap` metres, then a landing ramp: come up short and case it
 *   whoops    n humps of height h every `pitch` metres
 *
 * A lip's transition is a circle (radius h / (1 − cos θ)), as a built ramp's is: the slope rises smoothly from the
 * road's to θ, so a car is turned up, not struck. A drop is a steep face over DROP metres.
 *
 * Reach (`rampReach`): a car leaving the lip at v flies ballistic under g along the road from its lip angle; where it
 * meets the road again is its landing, measured on the drawn profile (alignment `at(s).z`). `v` is the speed the drive
 * rule counts: over the ground in plan, the rise the ramp's grade times it (a car climbs at v·grade, not v·sin θ). `lipSpeedBand` sweeps v for
 * the run of speeds that land on the landing slope. Straight roads are assumed under a ramp (a law keeps them there).
 */

const G = 9.81;
const DROP = 0.15;                  // m: the steep back face of a lip or the front of a landing ramp
const r3 = (v) => Math.round(v * 1000) / 1000;
const deg = (d) => (d * Math.PI) / 180;

export const RAMP_KINDS = Object.freeze(['kicker', 'tabletop', 'gap', 'whoops']);
// the ramps' sizes when a caller names only the kind (metres, degrees): kart-to-rally scale
export const RAMP_DEFAULTS = Object.freeze({
  kicker: Object.freeze({ h: 1.2, angle: 24 }),
  tabletop: Object.freeze({ h: 1.6, angle: 22, top: 8, land: 16 }),
  gap: Object.freeze({ h: 1.6, angle: 24, gap: 9, land: 18 }),
  whoops: Object.freeze({ h: 0.5, pitch: 4.5, n: 6 }),
});

// a transition up to h at lip angle θ: the circle's radius and its run along the road
function transition(h, angle) {
  const t = deg(angle), R = h / (1 - Math.cos(t));
  return { R, run: R * Math.sin(t), t };
}
const up = (R) => ({ z: (u) => R - Math.sqrt(Math.max(0, R * R - u * u)), g: (u) => u / Math.sqrt(Math.max(1e-9, R * R - u * u)) });

/** A ramp laid at station `at` (its toe): → a profile feature { kind, s0, s1, breaks, dz, dg, lip, landing, length }. */
export function ramp(spec) {
  const kind = spec.kind;
  if (!RAMP_KINDS.includes(kind)) throw new Error(`roadway: ramp '${kind}' is not one of ${RAMP_KINDS.join(', ')}`);
  const p = { ...RAMP_DEFAULTS[kind], ...spec }, at = p.at;
  if (!Number.isFinite(at)) throw new Error(`roadway: a ${kind} needs its station (at)`);
  // pieces: [from, to, z(u), g(u)] in local u from the toe
  const pieces = [];
  let lip = null, landing = null, end = 0;
  if (kind === 'whoops') {
    const L = p.n * p.pitch, w = (2 * Math.PI) / p.pitch;
    pieces.push([0, L, (u) => (p.h * (1 - Math.cos(w * u))) / 2, (u) => (p.h * w * Math.sin(w * u)) / 2]);
    end = L;
  } else {
    const { R, run } = transition(p.h, p.angle), c = up(R);
    pieces.push([0, run, c.z, c.g]);
    lip = { s: at + run, h: p.h, angle: p.angle };
    if (kind === 'kicker') {
      pieces.push([run, run + DROP, (u) => p.h * (1 - (u - run) / DROP), () => -p.h / DROP]);
      end = run + DROP;
    } else if (kind === 'tabletop') {
      const down = p.h / Math.tan(deg(p.land));
      pieces.push([run, run + p.top, () => p.h, () => 0]);
      pieces.push([run + p.top, run + p.top + down, (u) => p.h * (1 - (u - run - p.top) / down), () => -Math.tan(deg(p.land))]);
      landing = { s0: at + run + p.top, s1: at + run + p.top + down, angle: p.land };
      end = run + p.top + down;
    } else {
      const down = p.h / Math.tan(deg(p.land)), a = run + DROP, b = a + p.gap, c2 = b + DROP;
      pieces.push([run, a, (u) => p.h * (1 - (u - run) / DROP), () => -p.h / DROP]);
      pieces.push([a, b, () => 0, () => 0]);
      pieces.push([b, c2, (u) => (p.h * (u - b)) / DROP, () => p.h / DROP]);
      pieces.push([c2, c2 + down, (u) => p.h * (1 - (u - c2) / down), () => -Math.tan(deg(p.land))]);
      landing = { s0: at + c2, s1: at + c2 + down, angle: p.land, face: at + b };
      end = c2 + down;
    }
  }
  const piece = (s) => { const u = s - at; for (const q of pieces) if (u >= q[0] && u <= q[1]) return [q, u]; return null; };
  return {
    kind, s0: at, s1: at + end, length: r3(end),
    breaks: [at, ...pieces.map((q) => at + q[1]), ...(lip ? [lip.s - 0.01] : [])].map(r3),
    fine: kind === 'whoops' ? p.pitch / 12 : 0.5,
    dz: (s) => { const h = piece(s); return h ? h[0][2](h[1]) : 0; },
    dg: (s) => { const h = piece(s); return h ? h[0][3](h[1]) : 0; },
    lip, landing,
    params: Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'kind')),
  };
}

/** A car leaving a ramp's lip at v m/s (along the road, straight under it): where it lands on the drawn road.
 *  → { s, x (m flown), air (s), onLanding } or null for a ramp with no lip. */
export function rampReach(feature, alignment, v, { g = G, dt = 1 / 240 } = {}) {
  if (!feature.lip) return null;
  const s0 = feature.lip.s - 0.01, p = alignment.at(s0);
  const vx = v, vz = v * p.grade;
  for (let t = dt; t < 12; t += dt) {
    const x = vx * t, z = p.z + vz * t - (g * t * t) / 2, s = s0 + x;
    if (x > 0.3 && z <= alignment.at(s).z) {
      const onLanding = !!feature.landing && s >= feature.landing.s0 && s <= feature.landing.s1;
      return { s: r3(s), x: r3(x), air: r3(t), onLanding };
    }
  }
  return null;
}

/** The speeds (m/s) that land a ramp on its landing slope, swept up to vmax: { lo, hi } or null (none, or no landing). */
export function lipSpeedBand(feature, alignment, vmax, step = 0.25) {
  if (!feature.landing) return null;
  let lo = null, hi = null;
  for (let v = step; v <= vmax + 1e-9; v += step) {
    const r = rampReach(feature, alignment, v);
    if (r?.onLanding) { lo ??= v; hi = v; } else if (lo != null) break;
  }
  return lo == null ? null : { lo: r3(lo), hi: r3(hi) };
}
