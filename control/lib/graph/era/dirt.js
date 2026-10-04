/**
 * DIRT BY CAUSE — the per-corner grime a stage bakes into its vertex colour. Every term has a reason, so the
 * dirt reads designed rather than noisy:
 *   • fire   — a soot plume on the wall above each torch, a smudge on the ceiling over it;
 *   • water  — streaks running down from under the cornice, damp darkening at the wall base, a wet gutter;
 *   • feet   — a worn, lighter path along the walk line, grime pooled at the floor's edges;
 *   • time   — low-frequency blotching on the floor (AO in corners is the world's `ao` channel, not here).
 * `makeDirt(plan, lights, knobs)` → `(face, corner) => [r, g, b]` multipliers (1 = clean). Dirt is albedo, so a
 * caller multiplies it AFTER the light. Deterministic: integer hashing on lattice points, no dice, no clock.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** A lattice hash in [0, 1). */
export function hash3(a, b, s) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in [0, 1) over the plane. */
export function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash3(ix, iy, s), b = hash3(ix + 1, iy, s), c = hash3(ix, iy + 1, s), d = hash3(ix + 1, iy + 1, s);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

/** The walk line: spawn → each doorway's centre → the next room's centre, in link order. */
export function walkLine(plan) {
  const centre = (r) => [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const pts = [[plan.spawn[0], plan.spawn[1]], centre(plan.rooms[0])];
  for (const l of plan.links) {
    const mid = (l.lo + l.hi) / 2;
    pts.push(l.wall.endsWith('y') ? [mid, l.at] : [l.at, mid], centre(byId.get(l.to)));
  }
  return pts;
}
function distToLine(p, pts) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    const t = clamp01(((p[0] - ax) * dx + (p[1] - ay) * dy) / L2);
    best = Math.min(best, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy));
  }
  return best;
}

export const DIRT_DEFAULTS = Object.freeze({ age: 0.7, damp: 0.5, soot: 0.8, traffic: 0.6, seed: 7 });

export function makeDirt(plan, allLights, knobs = {}) {
  const k = { ...DIRT_DEFAULTS, ...knobs }, kit = plan.kit, S = k.seed | 0;
  const lights = allLights.filter((l) => (l.fixture ?? 'torch') === 'torch');   // only flames leave soot
  const walk = walkLine(plan);
  const roomAt = (x, y) => plan.rooms.find((r) => x >= r.x0 - 0.6 && x <= r.x1 + 0.6 && y >= r.y0 - 0.6 && y <= r.y1 + 0.6) || plan.rooms[0];
  const edgeDist = (r, x, y) => Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y);

  // fire: a plume up the wall the torch hangs on (lateral along the wall, rising and widening), faint below it
  const soot = (c, n) => {
    let m = 1;
    const t = [-n[1], n[0]];
    for (const l of lights) {
      // only faces looking the way the torch's wall looks (the wall and the pilaster fronts, not their sides)
      if (l.n && n[0] * l.n[0] + n[1] * l.n[1] < 0.9) continue;
      const d = [c[0] - l.at[0], c[1] - l.at[1]], depth = Math.abs(d[0] * n[0] + d[1] * n[1]);
      if (depth > 1.2) continue;   // not this torch's wall
      const lat = Math.abs(d[0] * t[0] + d[1] * t[1]), dz = c[2] - l.at[2];
      if (dz < -0.4) continue;
      const w = 0.3 + 0.2 * Math.max(0, dz);
      const plume = Math.exp(-((lat / w) ** 2)) * Math.exp(-Math.max(0, dz) / 2.4) * (dz < 0 ? 1 + dz / 0.4 : 1);
      m *= 1 - 0.72 * k.soot * plume;
    }
    return m;
  };
  const ceilingSoot = (c) => {
    let m = 1;
    for (const l of lights) { const dh = Math.hypot(c[0] - l.at[0], c[1] - l.at[1]); m *= 1 - 0.5 * k.soot * Math.exp(-((dh / 1.2) ** 2)); }
    return m;
  };

  return (f, c) => {
    const n = f.normal, g = f.group;
    if (g === 'stage:floor') {
      const r = roomAt(c[0], c[1]);
      const wear = 1 + 0.14 * k.traffic * Math.exp(-((distToLine(c, walk) / 1.0) ** 2));
      const edge = mix(0.68, 1, smooth(0, 1.6, edgeDist(r, c[0], c[1])) ** (1 - 0.5 * k.age));
      const blotch = 1 - 0.2 * k.age * smooth(0.45, 0.85, vnoise(c[0] * 0.55, c[1] * 0.55, S + 11));
      const v = wear * edge * blotch;
      return [v, v * 0.985, v * 0.96];   // grime warms as it darkens
    }
    if (g === 'stage:gutter') {
      const v = 0.86 * (1 - 0.22 * vnoise(c[0] * 1.3, c[1] * 1.3, S + 23));
      return [v * 0.86, v * 0.96, v * 0.8];   // wet and a little green
    }
    if (g === 'stage:ceiling' || (g === 'stage:trim' && n[2] < -0.5)) { const v = ceilingSoot(c); return [v, v, v]; }
    if ((g === 'stage:wall' || g === 'stage:trim') && Math.abs(n[2]) < 0.5) {
      const r = roomAt(c[0], c[1]), z = c[2];
      // water from below: a damp band, greener and darker toward the floor
      const damp = k.damp * (1 - smooth(0, 1.5, z));
      // water from above: streaks hanging from the cornice, each its own length, fading downward
      const u = Math.abs(n[0]) > 0.5 ? c[1] : c[0], plane = Math.round((Math.abs(n[0]) > 0.5 ? c[0] : c[1]) * 2);
      const top = f.top ?? r.h - kit.cornice.h, len = 1.2 + 2.6 * hash3(Math.floor(u * 1.4), plane, S + 31);   // a house front names its own top
      const streak = k.age * smooth(0.5, 0.78, vnoise(u * 1.4, plane, S + 37)) * smooth(top - len, top, z);
      const fire = soot(c, n);
      const v = (1 - 0.42 * streak) * fire;
      return [v * (1 - 0.4 * damp), v * (1 - 0.3 * damp), v * (1 - 0.46 * damp)];
    }
    return [1, 1, 1];
  };
}
