/**
 * The classical law table — every force, contact and constraint the classical scale can compose, one row each.
 * A new law is a row here (and its force in kernel.js); a new demo is never code.
 *
 *   row = {
 *     id, words,                       the words an agent might reach for (the card lists them; the solver never reads them)
 *     shape,                           how a law entry names its bodies:
 *                                        'each'  → on?: [ids]           (default: every body the law can act on)
 *                                        'pairs' → among?: [ids]        (default: every body the law can act on)
 *                                        'link'  → between: [id, id | [x, y, z]]   (a point is a fixed anchor)
 *                                        'plane' → point, normal | tilt (+ downhill), on?: [ids]
 *     params: { name: { dim, vector?, default?, number?, required? } },   dims are machina/quantities DIM names
 *     validate?(entry, ctx) → message | null   what the params alone cannot say
 *     summary, assumption,             what it does; what the model leaves out (the page shows every assumption)
 *     resolve(entry, ctx) → { force } | { plane } | { rod } | { collision }   the kernel's resolved form
 *     flags(entry, ctx) → { velocityDependent, dissipative, external, central, contact }
 *     timescale(entry, ctx) → seconds | null   the fastest motion it can make, for choosing dt
 *     example                           a smallest model that exercises it (the card's worked example; the deep sweep's case)
 *   }
 *
 * ctx = { bodies, index: id → i, frame: { g, gvec, up } }. Everything is canonical SI.
 */

export const G_NEWTON = 6.6743e-11;          // m³ kg⁻¹ s⁻² (CODATA 2018)
export const K_COULOMB = 8.9875517923e9;     // N m² C⁻² (1 / 4πε₀)

const TAU = 2 * Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dotv = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const ids = (ctx, list, ok) => list.map((i) => ctx.index[i]).filter((i) => ok(ctx.bodies[i]));
const free = (b) => !b.fixed;

/** The bodies an 'each' or 'pairs' law acts on: its own list, or every body `ok` admits. */
export function members(entry, ctx, ok) {
  const list = entry.on || entry.among;
  return list ? ids(ctx, list, ok) : ctx.bodies.map((b, i) => i).filter((i) => ok(ctx.bodies[i]));
}

/** A link's ends: body indices, b = -1 with an anchor point when the second end is a point. */
export function ends(entry, ctx) {
  const [a, b] = entry.between;
  return { a: ctx.index[a], b: typeof b === 'string' ? ctx.index[b] : -1, anchor: typeof b === 'string' ? null : b };
}

const endPoint = (e, ctx) => (e.b < 0 ? e.anchor : ctx.bodies[e.b].at);
const initialLength = (entry, ctx) => { const e = ends(entry, ctx); return len(sub(ctx.bodies[e.a].at, endPoint(e, ctx))); };
const reducedMass = (e, ctx) => {
  const ma = ctx.bodies[e.a].mass, mb = e.b < 0 || ctx.bodies[e.b].fixed ? Infinity : ctx.bodies[e.b].mass;
  return mb === Infinity ? ma : (ma * mb) / (ma + mb);
};
const pairMin = (idx, f) => {
  let t = Infinity;
  for (let u = 0; u < idx.length; u++) for (let w = u + 1; w < idx.length; w++) t = Math.min(t, f(idx[u], idx[w]));
  return Number.isFinite(t) ? t : null;
};
const anyFixed = (idx, ctx) => idx.some((i) => ctx.bodies[i].fixed);

/**
 * The orbital timescale of two bodies pulling each other with strength k (F = k/r²; k = G·m₁·m₂ or −k_e·q₁·q₂), taken
 * at their closest approach rather than where they start, since that is where they move fastest. The closest
 * approach is the conic's periapsis from the pair's relative position and velocity; a head-on fall is clamped at
 * the two radii (or a thousandth of the start distance) so a singular fall does not ask for a zero step.
 */
export function pairTimescale(A, B, k) {
  const mu = k * ((A.fixed ? 0 : 1 / A.mass) + (B.fixed ? 0 : 1 / B.mass));   // k over the reduced mass
  const r = sub(B.at, A.at), v = sub(B.v, A.v), rl = len(r);
  if (!(mu > 0) || !(rl > 0)) return null;
  const h = len([r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]]);
  const eps = dotv(v, v) / 2 - mu / rl;
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (mu * mu)));
  const rp = Math.max((h * h) / mu / (1 + e), A.radius + B.radius, 1e-3 * rl);
  return TAU * Math.sqrt((Math.min(rp, rl) ** 3) / mu);
}
const NONE = { velocityDependent: false, dissipative: false, external: false, central: false, contact: false };

export const CLASSICAL_LAWS = [
  {
    id: 'gravity-uniform',
    words: ['gravity', 'weight', 'falling', 'g', 'free fall', 'projectile'],
    shape: 'each',
    params: { g: { dim: 'accel' } },
    summary: 'Uniform gravity: every body is pulled down (−z) with acceleration g (the frame\'s g unless given).',
    assumption: 'g is the same at every height (no inverse-square fall-off near the ground).',
    resolve: (e, ctx) => {
      const g = e.g ?? ctx.frame.g;
      return { force: { kind: 'gravity-uniform', g: ctx.frame.up.map((c) => -g * c), idx: members(e, ctx, free) } };
    },
    flags: () => ({ ...NONE, external: true }),
    timescale: () => null,
    example: { bodies: [{ id: 'ball', mass: 0.45, radius: 0.11, at: [0, 0, 1], v: [8, 0, 8] }], laws: [{ law: 'gravity-uniform' }], duration: 1.6 },
  },
  {
    id: 'gravity-newton',
    words: ['orbit', 'planet', 'moon', 'inverse square', 'universal gravitation', 'kepler', 'satellite'],
    shape: 'pairs',
    params: { G: { number: true, default: G_NEWTON } },
    summary: 'Newton\'s universal gravitation between every pair: F = G·m₁·m₂ / r², along the line between them.',
    assumption: 'Bodies attract as point masses (exact for uniform spheres); no relativity.',
    resolve: (e, ctx) => ({ force: { kind: 'gravity-newton', G: e.G ?? G_NEWTON, idx: members(e, ctx, (b) => b.mass > 0) } }),
    flags: (e, ctx) => ({ ...NONE, central: true, external: anyFixed(members(e, ctx, (b) => b.mass > 0), ctx) }),
    timescale: (e, ctx) => {
      const idx = members(e, ctx, (b) => b.mass > 0), G = e.G ?? G_NEWTON;
      return pairMin(idx, (i, j) => pairTimescale(ctx.bodies[i], ctx.bodies[j], G * ctx.bodies[i].mass * ctx.bodies[j].mass) ?? Infinity);
    },
    example: {
      bodies: [{ id: 'sun', mass: 1e12, at: [0, 0, 0] }, { id: 'moon', mass: 1, at: [10, 0, 0], v: [0, 2.5, 0] }],
      laws: [{ law: 'gravity-newton' }], duration: 50,
    },
  },
  {
    id: 'spring',
    words: ['spring', 'hooke', 'oscillation', 'bounce', 'elastic', 'shm', 'damped'],
    shape: 'link',
    params: { k: { dim: 'stiffness', required: true }, rest: { dim: 'length' }, damping: { dim: 'damping', default: 0 } },
    summary: 'A spring between two bodies, or a body and a fixed point: F = −k·(stretch) − damping·(stretching speed).',
    assumption: 'The spring is massless and obeys Hooke\'s law at every stretch.',
    resolve: (e, ctx) => {
      const x = ends(e, ctx);
      return { force: { kind: 'spring', a: x.a, b: x.b, anchor: x.anchor, k: e.k, rest: e.rest ?? initialLength(e, ctx), c: e.damping ?? 0, idx: [x.a, ...(x.b >= 0 ? [x.b] : [])] } };
    },
    flags: (e, ctx) => {
      const x = ends(e, ctx), damped = (e.damping ?? 0) > 0;
      return { ...NONE, velocityDependent: damped, dissipative: damped, external: x.b < 0 || ctx.bodies[x.b].fixed, central: x.b >= 0 };
    },
    timescale: (e, ctx) => TAU * Math.sqrt(reducedMass(ends(e, ctx), ctx) / e.k),
    example: { bodies: [{ id: 'mass', mass: 0.5, radius: 0.05, at: [0.3, 0, 0] }], laws: [{ law: 'spring', between: ['mass', [0, 0, 0]], k: 20, rest: 0.2 }], duration: 3 },
  },
  {
    id: 'rod',
    words: ['pendulum', 'rod', 'swing', 'rigid link', 'arm'],
    shape: 'link',
    params: { length: { dim: 'length' } },
    summary: 'A rigid rod holding two bodies (or a body and a fixed pivot) at a fixed distance: a pendulum, a dumbbell.',
    assumption: 'The rod is massless and perfectly rigid; the pivot has no friction.',
    resolve: (e, ctx) => { const x = ends(e, ctx); return { rod: { a: x.a, b: x.b, anchor: x.anchor, L: e.length ?? initialLength(e, ctx), rope: false } }; },
    flags: (e, ctx) => { const x = ends(e, ctx); return { ...NONE, velocityDependent: true, external: x.b < 0 || ctx.bodies[x.b].fixed, central: x.b >= 0 }; },
    timescale: (e, ctx) => (ctx.frame.gravity ? TAU * Math.sqrt((e.length ?? initialLength(e, ctx)) / ctx.frame.gravity) : null),
    example: {
      bodies: [{ id: 'bob', mass: 1, radius: 0.05, at: [Math.sin(Math.PI / 6), 0, 1 - Math.cos(Math.PI / 6)] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'rod', between: ['bob', [0, 0, 1]] }], duration: 4,
    },
  },
  {
    id: 'rope',
    words: ['rope', 'string', 'cable', 'tether', 'slack'],
    shape: 'link',
    params: { length: { dim: 'length' } },
    summary: 'A rope: like a rod while taut, but it only pulls; shorter than its length it goes slack.',
    assumption: 'The rope is massless and inextensible; when it snaps taut the jerk is perfectly inelastic along the rope.',
    resolve: (e, ctx) => { const x = ends(e, ctx); return { rod: { a: x.a, b: x.b, anchor: x.anchor, L: e.length ?? initialLength(e, ctx), rope: true } }; },
    flags: (e, ctx) => { const x = ends(e, ctx); return { ...NONE, velocityDependent: true, dissipative: true, external: x.b < 0 || ctx.bodies[x.b].fixed, central: x.b >= 0 }; },
    timescale: (e, ctx) => (ctx.frame.gravity ? TAU * Math.sqrt((e.length ?? initialLength(e, ctx)) / ctx.frame.gravity) : null),
    example: {
      bodies: [{ id: 'weight', mass: 2, radius: 0.08, at: [0.5, 0, 1] }],
      laws: [{ law: 'gravity-uniform' }, { law: 'rope', between: ['weight', [0, 0, 1]], length: 1 }], duration: 3,
    },
  },
  {
    id: 'drag-linear',
    words: ['drag', 'viscous', 'stokes', 'honey', 'syrup', 'terminal velocity', 'damping'],
    shape: 'each',
    params: { b: { dim: 'damping' }, viscosity: { dim: 'viscosity' }, wind: { dim: 'velocity', vector: true, default: [0, 0, 0] } },
    summary: 'Drag proportional to speed: F = −b·(v − wind). Give b, or a fluid viscosity for Stokes\' law b = 6πηr.',
    assumption: 'Slow, smooth (viscous) flow: drag grows with speed, not its square.',
    resolve: (e, ctx) => {
      const idx = members(e, ctx, free);
      const b = idx.map((i) => (e.b !== undefined ? e.b : 6 * Math.PI * e.viscosity * ctx.bodies[i].radius));
      return { force: { kind: 'drag-linear', b, wind: e.wind ?? [0, 0, 0], idx } };
    },
    flags: () => ({ ...NONE, velocityDependent: true, dissipative: true, external: true }),
    timescale: (e, ctx) => {
      const idx = members(e, ctx, free);
      const ts = idx.map((i) => { const b = e.b !== undefined ? e.b : 6 * Math.PI * e.viscosity * ctx.bodies[i].radius; return b > 0 ? ctx.bodies[i].mass / b : Infinity; });
      const t = Math.min(...ts);
      return Number.isFinite(t) ? t : null;
    },
    validate: (e, ctx) => {
      if (e.b === undefined && e.viscosity === undefined) return 'wants b (N·s/m) or viscosity (Pa·s)';
      if (e.b === undefined && members(e, ctx, free).some((i) => !(ctx.bodies[i].radius > 0))) return 'Stokes drag from a viscosity needs every body it acts on to have a radius';
      return null;
    },
    example: { bodies: [{ id: 'bead', mass: 0.01, radius: 0.005, at: [0, 0, 1] }], laws: [{ law: 'gravity-uniform' }, { law: 'drag-linear', b: 0.05 }], duration: 2 },
  },
  {
    id: 'drag-quadratic',
    words: ['air resistance', 'drag', 'wind', 'skydiver', 'terminal velocity', 'parachute'],
    shape: 'each',
    params: {
      cd: { dim: 'scalar', default: 0.47 }, rho: { dim: 'density', default: 1.225 }, area: { dim: 'area' },
      wind: { dim: 'velocity', vector: true, default: [0, 0, 0] },
    },
    summary: 'Air drag: F = −½·ρ·Cd·A·|v − wind|·(v − wind). A defaults to the body\'s cross-section πr²; ρ to sea-level air.',
    assumption: 'The drag coefficient is constant with speed (no drag crisis); the body does not spin.',
    resolve: (e, ctx) => {
      const idx = members(e, ctx, free), rho = e.rho ?? 1.225, cd = e.cd ?? 0.47;
      const kq = idx.map((i) => 0.5 * rho * cd * (e.area ?? Math.PI * ctx.bodies[i].radius ** 2));
      return { force: { kind: 'drag-quadratic', kq, wind: e.wind ?? [0, 0, 0], idx } };
    },
    flags: () => ({ ...NONE, velocityDependent: true, dissipative: true, external: true }),
    timescale: (e, ctx) => {
      const idx = members(e, ctx, free), rho = e.rho ?? 1.225, cd = e.cd ?? 0.47, g = ctx.frame.gravity || 0;
      let t = Infinity;
      for (const i of idx) {
        const b = ctx.bodies[i], kq = 0.5 * rho * cd * (e.area ?? Math.PI * b.radius ** 2);
        if (!(kq > 0)) continue;
        const vt = g > 0 ? Math.sqrt((b.mass * g) / kq) : 0;
        const vc = Math.max(len(b.v), vt);
        if (vc > 0) t = Math.min(t, b.mass / (kq * vc));
      }
      return Number.isFinite(t) ? t : null;
    },
    validate: (e, ctx) => (e.area === undefined && members(e, ctx, free).some((i) => !(ctx.bodies[i].radius > 0)) ? 'needs an area, or a radius on every body it acts on' : null),
    example: { bodies: [{ id: 'ball', mass: 0.06, radius: 0.033, at: [0, 0, 50] }], laws: [{ law: 'gravity-uniform' }, { law: 'drag-quadratic' }], duration: 4 },
  },
  {
    id: 'buoyancy',
    words: ['buoyancy', 'float', 'sink', 'archimedes', 'water', 'boat', 'submerged'],
    shape: 'each',
    params: { rho: { dim: 'density', default: 1000 }, surface: { dim: 'length', default: 0 } },
    summary: 'Archimedes: a fluid below height `surface` pushes a sphere up with the weight of the fluid it displaces (the sunk cap\'s volume).',
    assumption: 'The fluid is still and of constant density; the body is a sphere; no added mass, no waves.',
    resolve: (e, ctx) => ({
      force: { kind: 'buoyancy', rho: e.rho ?? 1000, surface: e.surface ?? 0, g: ctx.frame.gvec, up: ctx.frame.up, idx: members(e, ctx, (b) => free(b) && b.radius > 0) },
    }),
    flags: () => ({ ...NONE, external: true }),
    timescale: (e, ctx) => {
      const g = ctx.frame.gravity, rho = e.rho ?? 1000;
      if (!g) return null;
      const ts = members(e, ctx, (b) => free(b) && b.radius > 0).map((i) => TAU * Math.sqrt(ctx.bodies[i].mass / (rho * g * Math.PI * ctx.bodies[i].radius ** 2)));
      return ts.length ? Math.min(...ts) : null;
    },
    example: { bodies: [{ id: 'buoy', mass: 2, radius: 0.1, at: [0, 0, 0.2] }], laws: [{ law: 'gravity-uniform' }, { law: 'buoyancy' }], duration: 3 },
  },
  {
    id: 'coulomb',
    words: ['charge', 'electric', 'electrostatic', 'coulomb', 'attract', 'repel', 'static'],
    shape: 'pairs',
    params: { k: { number: true, default: K_COULOMB } },
    summary: 'Coulomb\'s law between every pair of charged bodies: F = k·q₁·q₂ / r²; like charges repel, unlike attract.',
    assumption: 'Point charges in a vacuum; nothing radiates; speeds far below light.',
    resolve: (e, ctx) => ({ force: { kind: 'coulomb', k: e.k ?? K_COULOMB, idx: members(e, ctx, (b) => !!b.charge) } }),
    flags: (e, ctx) => ({ ...NONE, central: true, external: anyFixed(members(e, ctx, (b) => !!b.charge), ctx) }),
    timescale: (e, ctx) => {
      const idx = members(e, ctx, (b) => !!b.charge), k = e.k ?? K_COULOMB;
      return pairMin(idx, (i, j) => {
        const A = ctx.bodies[i], B = ctx.bodies[j], kk = -k * A.charge * B.charge;
        // unlike charges orbit like gravity; like charges never come closer than they are pushed, so their start sets the pace
        if (kk > 0) return pairTimescale(A, B, kk) ?? Infinity;
        const r = len(sub(A.at, B.at)), mu = A.fixed ? B.mass : B.fixed ? A.mass : (A.mass * B.mass) / (A.mass + B.mass);
        return mu > 0 ? TAU * Math.sqrt((mu * r * r * r) / Math.abs(kk)) : Infinity;
      });
    },
    example: {
      bodies: [{ id: 'p', mass: 1e-3, radius: 0.01, charge: '1 µC', at: [0, 0, 0], fixed: true }, { id: 'q', mass: 1e-3, radius: 0.01, charge: '-1 µC', at: [0.5, 0, 0], v: [0, 3.5, 0] }],
      laws: [{ law: 'coulomb' }], duration: 4,
    },
  },
  {
    id: 'lorentz',
    words: ['magnetic', 'magnet', 'electric field', 'cyclotron', 'charged particle', 'lorentz', 'mass spectrometer'],
    shape: 'each',
    params: { E: { dim: 'efield', vector: true, default: [0, 0, 0] }, B: { dim: 'bfield', vector: true, default: [0, 0, 0] } },
    summary: 'Uniform electric and magnetic fields on charged bodies: F = q·(E + v × B). The magnetic part turns a charge without speeding it up.',
    assumption: 'The fields are uniform and steady; the charge does not radiate; speeds far below light.',
    resolve: (e, ctx) => ({ force: { kind: 'lorentz', E: e.E ?? [0, 0, 0], B: e.B ?? [0, 0, 0], idx: members(e, ctx, (b) => free(b) && !!b.charge) } }),
    flags: (e) => ({ ...NONE, external: true, velocityDependent: len(e.B ?? [0, 0, 0]) > 0 }),
    timescale: (e, ctx) => {
      const B = len(e.B ?? [0, 0, 0]);
      if (!(B > 0)) return null;
      const ts = members(e, ctx, (b) => free(b) && !!b.charge).map((i) => (TAU * ctx.bodies[i].mass) / (Math.abs(ctx.bodies[i].charge) * B));
      return ts.length ? Math.min(...ts) : null;
    },
    example: { bodies: [{ id: 'ion', mass: 1e-6, charge: '1 µC', at: [0, 0, 0], v: [1, 0, 0] }], laws: [{ law: 'lorentz', B: [0, 0, 1] }], duration: 15 },
  },
  {
    id: 'plane',
    words: ['ground', 'floor', 'table', 'ramp', 'incline', 'slope', 'wall', 'bounce', 'friction', 'slide'],
    shape: 'plane',
    params: {
      point: { dim: 'length', vector: true, default: [0, 0, 0] }, normal: { dim: 'scalar', vector: true },
      tilt: { dim: 'scalar' }, downhill: { dim: 'scalar', vector: true, default: [1, 0, 0] },
      e: { dim: 'scalar', default: 1 }, mu: { dim: 'scalar', default: 0 }, mus: { dim: 'scalar' },
    },
    summary: 'A rigid flat surface through `point`: a floor (default), a wall (`normal`), or a ramp (`tilt` an angle, sloping down along `downhill`). Bodies bounce with restitution e, rest on it, and slide with friction μ (static μs, default μ).',
    assumption: 'The surface is rigid and flat; bodies slide, they do not roll; elastic and frictionless unless e and μ say otherwise.',
    resolve: (e, ctx) => ({ plane: { id: e.id, p: e.point ?? [0, 0, 0], n: planeNormal(e, ctx), e: e.e ?? 1, mu: e.mu ?? 0, mus: e.mus ?? e.mu ?? 0, idx: members(e, ctx, free) } }),
    flags: (e) => {
      const rough = (e.mu ?? 0) > 0, lossy = (e.e ?? 1) < 1;
      return { ...NONE, external: true, contact: true, velocityDependent: rough, dissipative: rough || lossy };
    },
    timescale: () => null,
    validate: (e) => {
      if (e.normal !== undefined && e.tilt !== undefined) return 'give a normal or a tilt, not both';
      if (e.normal !== undefined && !(len(e.normal) > 0)) return 'normal must not be zero';
      if ((e.e ?? 1) < 0 || (e.e ?? 1) > 1) return 'e (restitution) is between 0 and 1';
      if ((e.mu ?? 0) < 0 || (e.mus ?? 0) < 0) return 'friction is ≥ 0';
      if (e.tilt !== undefined && (e.tilt <= -Math.PI / 2 || e.tilt >= Math.PI / 2)) return 'tilt is between −90° and 90°';
      return null;
    },
    example: {
      bodies: [{ id: 'block', mass: 1, radius: 0.05, at: [0, 0, 0], on_plane: 'ramp' }],
      laws: [{ law: 'gravity-uniform' }, { law: 'plane', id: 'ramp', tilt: '30 deg', mu: 0.2 }], duration: 2,
    },
  },
  {
    id: 'collision',
    words: ['collision', 'crash', 'billiards', 'newton\'s cradle', 'momentum', 'elastic', 'inelastic', 'impact'],
    shape: 'pairs',
    params: { e: { dim: 'scalar', default: 1 } },
    summary: 'Spheres that touch exchange an impulse along the line of centres with restitution e: 1 bounces with no loss, 0 sticks.',
    assumption: 'Contacts are instantaneous; spheres are smooth and do not spin.',
    resolve: (e, ctx) => ({ collision: { e: e.e ?? 1, idx: members(e, ctx, (b) => b.radius > 0) } }),
    flags: (e) => ({ ...NONE, central: true, contact: true, dissipative: (e.e ?? 1) < 1 }),
    timescale: () => null,
    validate: (e) => ((e.e ?? 1) < 0 || (e.e ?? 1) > 1 ? 'e (restitution) is between 0 and 1' : null),
    example: {
      bodies: [{ id: 'a', mass: 1, radius: 0.1, at: [-1, 0, 0], v: [2, 0, 0] }, { id: 'b', mass: 2, radius: 0.1, at: [1, 0, 0] }],
      laws: [{ law: 'collision', e: 0.5 }], duration: 2,
    },
  },
];

export const CLASSICAL_LAW = Object.fromEntries(CLASSICAL_LAWS.map((r) => [r.id, r]));

/** A plane's unit normal: given, or a ramp tilted from `up` toward `downhill` by `tilt`, or the frame's up. */
export function planeNormal(e, ctx) {
  const up = ctx.frame.up;
  if (e.normal) { const l = len(e.normal); return e.normal.map((c) => c / l); }
  if (e.tilt === undefined) return up.slice();
  const d = e.downhill ?? [1, 0, 0];
  const flat = sub(d, up.map((c) => c * dotv(d, up)));
  const fl = len(flat) || 1;
  const h = flat.map((c) => c / fl);
  return [0, 1, 2].map((k) => Math.cos(e.tilt) * up[k] + Math.sin(e.tilt) * h[k]);
}
