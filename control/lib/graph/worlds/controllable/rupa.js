/**
 * rupa.js — destructible physics on the runtime: blocks that break by what they are made of and fall by what holds
 * them (an OPT-IN builder, compose.js EMISSION_OPT_IN.rupa: emitted only when a world's blocks carry matter, so every
 * other page keeps its bytes). rupa is the internal name; the level says `destruction: 'physical'` (breakability.js).
 *
 * The basic break pass (rules-basic.js) still owns what it owns: the colliders, the held graph, falling and landing,
 * the break records the page swaps pieces on. This builder replaces COUNTING with PHYSICS for the blocks that carry
 * matter (each block's `joules`, `mass`, `compressive`, `cohesion`, from rupa/matter.js blockMatter at mint):
 *
 *   ENERGY   a blow spends joules: a swing (`swing` J), a hitscan round (`shot` J), a burst (its energy from its splash
 *            radius by cube-root blast scaling, W = (radius / blastZ)³ kg of TNT, reaching a block by the solid angle its
 *            face fills from the burst, A / 2π(d + r0)²), each × the world's `power`; a landing spends ½mv² on the block
 *            and on what it lands on. A block whose joules run out breaks. The basic pass's count never reaches them
 *            (their hp is held infinite), so one blow is never counted twice.
 *   LOAD     after anything breaks or lands: each block's weight (and all it carries) goes down to what it rests on,
 *            split by contact area; a block crushes when the stress passes its compressive strength × what is left of
 *            it (a cracked pillar holds less). A HUNG block (held only sideways: a lintel, a slab's tiles) is checked
 *            with its whole hung group in bending at the bonds that hold it: M = W·lever (a cantilever) or W·lever / 4
 *            (held on both sides), against cohesion × the bonds' section modulus Σ b·t²/6; past it the group lets go and
 *            the basic pass drops it.
 *
 *   HEAT     each block has a temperature, from where it was built (an ice block below its melt). Heat (a burst's share,
 *            `heatShare` of its energy as the fireball; `E.heatBlock` from a fire, a beam, a script) raises it by
 *            Q / heat capacity; at its `melt` the joules go to its latent heat and, that spent, it MELTS (`how: 'melt'`).
 *            Past `ignite` a combustible block BURNS: its fuel goes at its `burnRate` (× `fireTime`, play seconds to fire
 *            seconds: 60, a minute of fire a second), its strength with it, a tenth of its heat into each block it touches
 *            (fire spreads), and with its fuel gone it is ash (`how: 'burn'`); it gets no hotter than a flame, and its
 *            fire's weakening is the fuel it has lost, not its heat. Heat weakens: a block keeps heatFactor of
 *            its strength (half at `soften`), so a steel frame in a fire comes down by the load pass. A block not burning
 *            cools back toward where it started (`cool` seconds).
 *
 *   IMPACT   matter meets matter (impact): the closing energy of the reduced mass, ½μv²(1 − e²) with e the lower bounce,
 *            is dissipated, and each side takes it inversely to its stiffness (one contact force, energy F²/2k: the
 *            softer takes more). A target that breaks takes only its joules left, the energy that cost is all the
 *            mover loses, and it carries on, slower; one that holds sends the mover back at e of its closing speed.
 *            Density is the mass behind the speed. Landings use it (a block on another, or on the floor), and so do
 *            BODIES: matter thrown into the world (`E.throwMatter(state, { size, at, vel, ...blockMatter })`, a
 *            cannonball, a hurled boulder, a falling girder), stepped finely enough not to pass through a block, each
 *            contact spent on both, broken when its own joules run out (`state.rupa.bodies`, `how: 'impact'`).
 *
 *   POOLS    liquid standing in the world (`rupa.pools: [{ min, max, density, viscosity }]`, its surface at max[2]): a body
 *            in one is pushed up by the weight of the liquid it puts aside and slowed by pushing it aside, so pine floats
 *            a third under, ice nine tenths, solid steel sinks and a hollow steel hull floats (Archimedes falls out of the
 *            pressure on its faces); a block standing in one weighs that much less on its supports. A pool is a basin:
 *            what floats in it stays within its sides, whatever the wind.
 *
 *   SPRAY    a nozzle (`E.spray(state, { at, dir, speed, flow, seconds })`: a hose off a hydrant and a pump, the speed and
 *            flow from rupa/fluid.js jetOf or stepVessels) throws water in parcels that fly under gravity and the air's
 *            drag. A parcel that strikes a block stresses it by its stagnation pressure ½ρv², which harms it only past
 *            its strength (an impact then: water gives way, bounce 0), and cools it: each
 *            kilogram takes 4.19 kJ a degree up to 100 °C, then 2.26 MJ to boil away, so a burning block drenched below
 *            its ignition goes out (`how: 'douse'` on the hits). Where parcels land is counted (`state.rupa.wet`).
 *
 *   DEBRIS   each break carries what it leaves (`state.breaks[].debris`, from `fragments`): pieces sized by the new surface
 *            the joules opened against the matter's fracture energy, shaped by the matter, flying away from the blow with
 *            its share of the joules, the fines a dust cloud; a burn leaves ash, a melt its liquid. A body entering a pool
 *            splashes (`state.rupa.splashes`, from `splash`). Seeded by the block and the break: the same blow, the same debris.
 *
 *   MEDIA    water and air are one law (`pressure`, `immerse`, `stepIn`): a pool is a medium with a surface, the air the
 *            medium everywhere, the WIND its motion (`rupa.wind: { speed, dir, terrain?, gust?, seed? }`: faster with
 *            height, gusts seeded). Bodies and spray are lifted by the fluid they put aside and dragged toward its flow,
 *            so the wind carries light things and bends a jet; its pressure Cp·½ρu² on exposed faces tips or slides a
 *            stack whose weight and mortar cannot hold it, and the stack falls as bodies (`how: 'topple'`). A block casts
 *            a wind shadow, calmer air for about six of its heights behind it; the wind moves a body lying on the ground
 *            again once its drag beats what the body's weight holds (leaves skitter; a brick stays).
 *
 *   rupaPhysics (E.rupaPhysics, also run in Node by lib/graph/rupa/index.js):
 *     blastKg(radius, blastZ?) · blastJoules(radius, blastZ?) · faceArea(box, from) · burstShare(box, at, joules, r0?)
 *     blowJoules(how, { swing, shot, blastZ, power }, extra) · heatFactor(T, soften, melt, T0?) · loadPass(blocks, { fixed, floor, g, touch })
 *     impact(mover { mass, stiff, bounce, joules? }, target { stiff, bounce, joules?, mass?, fixed? }, closing speed)
 *       → { e, dissipated, toA, toB, breaksB }
 *     pressure(medium, { depth?, flow?, cp? }) → Pa (ρ·g·depth + Cp·½ρv²) · flowOf(medium, p) → m/s (√(2p/ρ))
 *     immerse(box, mass, vel, medium, flow?) → { V, lift, k, flow } | null · stepIn(vel, immersion, mass, h) → vel
 *     submerged(box, surface) · inPool(box, pool) · wet(box, mass, vel, pool) (immerse in a still pool)
 *     windOf({ speed, dir, terrain?, alpha?, gust?, seed? }) → wind · windAt(wind, pos, t) → [u, v, 0]
 *     fragments(box, { density, fill, frac, shape, spread, joules, how, from?, dir?, seed }) → { pieces, dust, liquid?, stats }
 *     splash(liquid { density, viscosity, tension }, { at, speed, mass, size, seed }) → { droplets, cavity, plop, stats }
 *       → { weight: Map, stress: Map, crush: [block], span: [[block]], groups } (pure over plain boxes)
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function. The physics is defined first and needs nothing from
 * E, so `buildRupa({})` hands Node the same functions the page runs.
 */

export function buildRupa(E) {
  // ── the physics: pure, self-contained ──
  const TNT = 4.184e6, G = 9.81;
  const ovl = (a, b, k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);
  const restsOn = (a, s, touch) => Math.abs(a.min[2] - s.max[2]) <= touch && ovl(a, s, 0) > 1e-3 && ovl(a, s, 1) > 1e-3;
  // the side two boxes share (the axis k across it, its width b along the other horizontal axis, its height t), or null
  const sideFace = (a, s, touch) => {
    if (ovl(a, s, 2) <= 1e-3) return null;
    for (const k of [0, 1]) {
      if (ovl(a, s, 1 - k) <= 1e-3) continue;
      if (Math.abs(a.max[k] - s.min[k]) <= touch) return { k, at: a.max[k], b: ovl(a, s, 1 - k), t: ovl(a, s, 2) };
      if (Math.abs(s.max[k] - a.min[k]) <= touch) return { k, at: a.min[k], b: ovl(a, s, 1 - k), t: ovl(a, s, 2) };
    }
    return null;
  };
  const vol = (b) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]);
  const centre = (b) => [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2);
  const boxDist = (b, p) => Math.hypot(...[0, 1, 2].map((k) => Math.max(b.min[k] - p[k], 0, p[k] - b.max[k])));

  const blastKg = (radius, blastZ = 4) => Math.pow(Math.max(0, radius) / blastZ, 3);
  const blastJoules = (radius, blastZ = 4) => blastKg(radius, blastZ) * TNT;
  // the area a box shows toward a point: each face's area weighted by how squarely it faces the point
  function faceArea(b, from) {
    const c = centre(b), d = [0, 1, 2].map((k) => c[k] - from[k]), n = Math.hypot(...d) || 1;
    const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
    return (Math.abs(d[0]) * sy * sz + Math.abs(d[1]) * sx * sz + Math.abs(d[2]) * sx * sy) / n;
  }
  // the share of a burst's energy a block takes: the solid angle its face fills of a ground burst's hemisphere
  const burstShare = (b, at, joules, r0 = 0.5) => joules * Math.min(1, faceArea(b, at) / (2 * Math.PI * Math.pow(boxDist(b, at) + r0, 2)));
  function blowJoules(how, R, extra = {}) {
    const p = R.power ?? 1;
    if (how === 'swing') return (R.swing ?? 300) * p;
    if (how === 'shot') return (R.shot ?? 2000) * p;
    if (how === 'burst') return blastJoules(extra.radius || 0, R.blastZ ?? 4) * p;
    return 0;
  }

  // what share of its strength a block keeps at T °C: whole where it started (T0), half at `soften`, none at `melt`
  function heatFactor(T, soften, melt, T0 = 20) {
    if (melt != null && T >= melt) return 0;
    if (!(T > T0) || !(soften > T0)) return T > T0 && !(soften > T0) ? 0.5 : 1;
    return 1 / (1 + Math.pow((T - T0) / (soften - T0), 6));
  }
  // matter meets matter: the dissipated closing energy, split inversely to stiffness; a target that breaks takes only
  // the joules it had left, and the mover pays only what that cost
  function impact(a, b, vn) {
    const e = Math.min(a.bounce ?? 0.2, b.bounce ?? 0.2);
    const mu = b.fixed || !(b.mass > 0) ? a.mass : (a.mass * b.mass) / (a.mass + b.mass);
    const dE = 0.5 * mu * vn * vn * (1 - e * e);
    const ca = 1 / (a.stiff || 1e10), cb = 1 / (b.stiff || 1e10), sa = ca / (ca + cb), sb = 1 - sa;
    const capB = b.joules ?? Infinity;
    if (dE * sb >= capB) { const used = capB / sb; return { e, dissipated: used, toA: used * sa, toB: capB, breaksB: true }; }
    return { e, dissipated: dE, toA: dE * sa, toB: dE * sb, breaksB: false };
  }
  // ── MEDIA: one law for every fluid, liquid or gas. A medium is { density, viscosity }: a POOL is one with a surface
  // (its max[2]) inside its footprint; the AIR is the medium everywhere, its motion the wind. The same three functions
  // serve water and air alike, so a dam, a hose and a gale are one physics ──
  const AIR = { density: 1.204, viscosity: 1.81e-5 };   // rupa/matter.js air
  // PRESSURE: the weight of the fluid over a point (ρ·g·depth: a pool on a wall, a tank on its foot) and the push of
  // its flow stopped against a face (Cp·½ρv²: a jet on a log, the wind on a wall)
  function pressure(m, { depth = 0, flow = 0, cp = 1 } = {}) { return m.density * G * Math.max(0, depth) + cp * 0.5 * m.density * flow * flow; }
  // the speed a pressure drives a fluid through an opening (its inverse: Bernoulli, √(2p/ρ))
  const flowOf = (m, p) => Math.sqrt((2 * Math.max(0, p)) / m.density);
  const WAVE = 1.5;   // 1/s: the surface's wave-making damping on a body crossing a pool's surface
  function submerged(b, surface) {
    const hz = b.max[2] - b.min[2], under = Math.max(0, Math.min(hz, surface - b.min[2]));
    return hz > 0 ? vol(b) * (under / hz) : 0;
  }
  function inPool(b, pool) {
    const c = centre(b);
    return c[0] >= pool.min[0] && c[0] <= pool.max[0] && c[1] >= pool.min[1] && c[1] <= pool.max[1] && b.min[2] < pool.max[2] && b.max[2] > pool.min[2];
  }
  // IMMERSION: a box in a medium moving at `flow`. The push up is the weight of the fluid it puts aside (Archimedes: the
  // pressure on its faces summed, the bottom's beating the top's by ρ·g·V); the drag of moving THROUGH it, relative to
  // its flow (½ρ·Cd·A·|v − u|², a cube's Cd 1.05, and Stokes' 3πηD|v − u|), as a rate the step relaxes the body toward
  // the medium's own motion by: still water slows it, the wind carries it
  // the area a box shows its motion: its faces as they face it; a thin plate (a leaf, a sheet) tumbles and flutters, and
  // a tumbling body shows on average a quarter of its surface (Cauchy), whichever way it moves
  function dragArea(b, rel) {
    const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2], speed = Math.hypot(...rel);
    if (Math.min(sx, sy, sz) < 0.2 * Math.max(sx, sy, sz)) return (sx * sy + sy * sz + sx * sz) / 2;
    return speed > 1e-9 ? (Math.abs(rel[0]) * sy * sz + Math.abs(rel[1]) * sx * sz + Math.abs(rel[2]) * sx * sy) / speed : sx * sy;
  }
  function immerse(b, mass, v, m, flow = null) {
    if (m.max && !inPool(b, m)) return null;
    const V = m.max ? submerged(b, m.max[2]) : vol(b);
    if (!(V > 0)) return null;
    const u = flow || [0, 0, 0], rel = [v[0] - u[0], v[1] - u[1], v[2] - u[2]];
    const speed = Math.hypot(...rel), A = dragArea(b, rel);
    const frac = V / vol(b), eta = m.viscosity ?? 1e-3;
    const waves = m.max && frac < 1 ? WAVE : 0;   // crossing a surface it makes waves, which carry its heave away
    return { V, lift: m.density * G * V, k: (frac * (0.5 * m.density * 1.05 * A * speed + 3 * Math.PI * eta * Math.cbrt(vol(b)))) / mass + waves, flow: u };
  }
  // one implicit step in a medium: lifted, and relaxed toward its flow at the drag's rate
  function stepIn(v, w, mass, h) {
    const k = w.k, out = [0, 1, 2].map((i) => (v[i] + h * k * w.flow[i]) / (1 + h * k));
    out[2] += (w.lift / mass) * h / (1 + h * k);
    return out;
  }
  const wet = (b, mass, v, pool) => immerse(b, mass, v, pool);   // a pool's name for it
  // THE WIND: the air moving. A reference speed at 10 m rising with height by a power law (α: sea 0.11, open 0.14, city
  // 0.3: buildings slow the air near the ground), and gusts as three travelling waves of seeded phase (`gust` their
  // share), so the same wind blows the same way at the same place and time
  const ALPHA = { sea: 0.11, open: 0.14, city: 0.3 };
  function windOf(spec) {
    if (!spec || !(spec.speed > 0)) return null;
    const d = Array.isArray(spec.dir) ? spec.dir : [Math.cos(((spec.dir ?? 0) * Math.PI) / 180), Math.sin(((spec.dir ?? 0) * Math.PI) / 180)];
    const L = Math.hypot(d[0], d[1]) || 1, r = rng(spec.seed ?? 7);
    const phases = [0, 1, 2].map(() => { const w = 0.3 + 1.2 * r(); return { w, k: w / spec.speed, p: r() * 2 * Math.PI }; });
    return { speed: spec.speed, dir: [d[0] / L, d[1] / L], alpha: spec.alpha ?? ALPHA[spec.terrain] ?? ALPHA.open, gust: spec.gust ?? 0, phases };
  }
  function windAt(wind, pos, t) {
    if (!wind) return [0, 0, 0];
    const base = wind.speed * Math.pow(Math.max(0.5, pos[2]) / 10, wind.alpha), x = pos[0] * wind.dir[0] + pos[1] * wind.dir[1];
    let g = 0;
    for (const ph of wind.phases) g += Math.sin(ph.w * t - ph.k * x + ph.p) / wind.phases.length;
    const u = Math.max(0, base * (1 + wind.gust * g));
    return [wind.dir[0] * u, wind.dir[1] * u, 0];
  }
  const touches = (a, s, touch) => restsOn(a, s, touch) || restsOn(s, a, touch) || !!sideFace(a, s, touch);

  // LOAD over plain boxes { min, max, mass, compressive, bond, lateral?, left? } (lateral: it may be held sideways;
  // bond: the strength of its side bonds, Pa; left: the share of its joules a block has left)
  function loadPass(blocks, { fixed = [], floor = 0, g = G, touch = 0.02 } = {}) {
    const onFloor = (b) => b.min[2] <= floor + touch;
    const below = new Map(), weight = new Map(), stress = new Map();
    for (const b of blocks) {
      const sup = blocks.filter((s) => s !== b && restsOn(b, s, touch));
      const fx = fixed.filter((s) => restsOn(b, s, touch));
      below.set(b, { blocks: sup, fixed: fx, ground: onFloor(b) });
    }
    const rests = (b) => { const u = below.get(b); return u.ground || u.fixed.length > 0 || u.blocks.length > 0; };
    // the hung groups: blocks resting on nothing, joined sideways; their roots are the resting blocks they bond to
    const hung = blocks.filter((b) => !rests(b) && b.lateral), seen = new Set(), groups = [];
    for (const h of hung) {
      if (seen.has(h)) continue;
      const g0 = [h], q = [h]; seen.add(h);
      while (q.length) {
        const a = q.pop();
        for (const s of hung) if (!seen.has(s) && sideFace(a, s, touch)) { seen.add(s); g0.push(s); q.push(s); }
      }
      const roots = [];
      for (const a of g0) for (const s of blocks) {
        if (g0.includes(s) || !rests(s)) continue;
        const f = sideFace(a, s, touch);
        if (f) roots.push({ block: a, root: s, ...f, bond: Math.min(a.bond, s.bond ?? a.bond) });
      }
      groups.push({ blocks: g0, roots, weight: 0 });
    }
    const groupOf = new Map();
    for (const gr of groups) for (const b of gr.blocks) groupOf.set(b, gr);
    // down the stack: a block's own weight and all it carries, to its supports by contact area; a hung group's to its roots
    const carried = new Map(blocks.map((b) => [b, 0]));
    const order = [...blocks].sort((a, b) => (b.min[2] - a.min[2]) || ((groupOf.has(b) ? 1 : 0) - (groupOf.has(a) ? 1 : 0)));
    const roots = new Set(groups.flatMap((gr) => gr.roots.map((r) => r.root)));
    // a hung group is handed to its roots before the roots pass theirs down: roots wait for every group on them
    const pending = [];
    const pass = (b) => {
      const w = b.mass * g + carried.get(b);
      weight.set(b, w);
      const gr = groupOf.get(b);
      if (gr) { gr.weight += w; return; }
      const u = below.get(b);
      const areas = u.blocks.map((s) => ovl(b, s, 0) * ovl(b, s, 1)), fa = u.fixed.map((s) => ovl(b, s, 0) * ovl(b, s, 1));
      const total = areas.reduce((x, y) => x + y, 0) + fa.reduce((x, y) => x + y, 0) + (u.ground ? (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) : 0);
      stress.set(b, total > 0 ? w / total : 0);
      if (total > 0) u.blocks.forEach((s, i) => carried.set(s, carried.get(s) + (w * areas[i]) / total));
    };
    for (const b of order) { if (roots.has(b)) pending.push(b); else pass(b); }
    for (const gr of groups) {
      if (!gr.roots.length) continue;
      const share = gr.weight / gr.roots.length;
      for (const r of gr.roots) carried.set(r.root, carried.get(r.root) + share);
    }
    for (const b of pending) pass(b);
    // crushing: the stress on what it rests on against its compressive strength, less as it is damaged
    const crush = blocks.filter((b) => !groupOf.has(b) && b.compressive > 0 && stress.get(b) > b.compressive * (b.left ?? 1));
    // spans: a hung group in bending at its roots
    const span = [];
    for (const gr of groups) {
      if (!gr.roots.length) { span.push(gr.blocks); continue; }
      let mx = 0, my = 0, W = 0;
      for (const b of gr.blocks) { const w = weight.get(b), c = centre(b); W += w; mx += w * c[0]; my += w * c[1]; }
      const cg = [mx / (W || 1), my / (W || 1)];
      let lever = Infinity, S = 0, bond = Infinity, both = false;
      for (const r of gr.roots) {
        lever = Math.min(lever, Math.abs(cg[r.k] - r.at));
        S += (r.b * r.t * r.t) / 6;
        bond = Math.min(bond, r.bond * Math.min(r.block.left ?? 1, r.root.left ?? 1));
        if (gr.roots.some((o) => o.k === r.k && Math.sign(cg[r.k] - o.at) !== Math.sign(cg[r.k] - r.at))) both = true;
      }
      const M = W * lever / (both ? 4 : 1);
      gr.moment = M; gr.capacity = bond * S;
      if (M > bond * S) span.push(gr.blocks);
    }
    return { weight, stress, crush, span, groups };
  }

  // ── DEBRIS: what a breaking leaves, deterministic in the blow (the same blow on the same block, the same pieces) ──
  const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const seedOf = (str, n) => { let h = (2166136261 ^ (n >>> 0)) >>> 0; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function gamma(x) {
    if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
    x -= 1; let a = LANCZOS[0]; const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
    return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
  }
  const ETA_SURF = 0.01;   // the share of a breaking's joules that opens new crack surface (comminution runs about 1 %)
  const DUST = 0.002;      // m: pieces finer than this are dust
  const KINETIC = { burst: 0.3, shot: 0.15, swing: 0.1, crush: 0.05, fall: 0.05, call: 0.02 };   // the share that flies
  const SHAPES = { chunk: [1, 1], shard: [1.8, 1.2], splinter: [3, 0.577], plate: [1.6, 1.6], clod: [1, 1] };
  const unitRand = (r) => { const z = r() * 2 - 1, a = r() * 2 * Math.PI, q = Math.sqrt(1 - z * z); return [q * Math.cos(a), q * Math.sin(a), z]; };
  const unit = (v) => { const L = Math.hypot(...v) || 1; return v.map((x) => x / L); };
  const cloud = (kg) => Math.cbrt((3 * (kg / 0.01)) / (4 * Math.PI));   // a dust cloud at about 10 g a cubic metre
  // a block's pieces: new surface = ETA_SURF × joules ÷ frac (fracture energy), so the mean piece is 6V ÷ (all its
  // surface); sizes by Rosin–Rammler (spread n), the share under DUST a cloud; each piece shaped by its matter (a
  // splinter along the block's longest axis), placed inside the block; KINETIC[how] of the joules flies, away from
  // where the blow came from (`from` a point, `dir` a direction), smaller pieces faster (∝ size^-⅓), summed exactly
  function fragments(b, { density, fill = 1, frac = 100, shape = 'chunk', spread = 1.2, joules, how = 'call', from = null, dir = null, seed = 1, max = 40 }) {
    const V = vol(b) * fill, M = V * density, c = centre(b), dims = [0, 1, 2].map((k) => b.max[k] - b.min[k]);
    if (how === 'melt') return { pieces: [], dust: null, liquid: { kg: M }, stats: { count: 0, kinetic: 0 } };
    if (how === 'burn') { const kg = M * 0.01; return { pieces: [], dust: { kg, at: c, radius: cloud(kg), life: 6 }, stats: { count: 0, kinetic: 0, ash: kg } }; }
    const A0 = 2 * (dims[0] * dims[1] + dims[1] * dims[2] + dims[0] * dims[2]), Anew = (ETA_SURF * joules) / frac;
    const s = Math.min(Math.cbrt(V), (6 * V) / (Anew + A0)), x0 = s / gamma(1 + 1 / spread);
    const fd = 1 - Math.exp(-Math.pow(DUST / x0, spread)), Vp = V * (1 - fd), r = rng(seed), xs = [];
    let used = 0;
    while (used < Vp - 1e-12 && xs.length < max) {
      let x = Math.max(DUST, Math.min(Math.cbrt(Vp), x0 * Math.pow(-Math.log(1 - r() * 0.999999), 1 / spread)));
      if (used + x ** 3 > Vp) x = Math.cbrt(Vp - used);
      xs.push(x); used += x ** 3;
    }
    if (used > 0 && used < Vp) { const k = Math.cbrt(Vp / used); for (let i = 0; i < xs.length; i++) xs[i] *= k; }   // the cap reached: the pieces carry the rest
    const Ek = (KINETIC[how] ?? 0.05) * joules, sh = SHAPES[shape] || SHAPES.chunk, order = [0, 1, 2].sort((p, q) => dims[q] - dims[p]), ws = [], ds = [];
    const pieces = xs.map((x) => {
      const jit = shape === 'chunk' || shape === 'clod' ? [0.8 + 0.4 * r(), 0.8 + 0.4 * r()] : [1, 1];
      const e = [sh[0] * jit[0], sh[1] * jit[1]]; e.push(1 / (e[0] * e[1]));
      const size = [0, 0, 0]; order.forEach((ax, j) => { size[ax] = x * e[j]; });
      const at = [0, 1, 2].map((k) => b.min[k] + Math.min(size[k], dims[k]) / 2 + r() * Math.max(0, dims[k] - size[k]));
      let d;
      if (from && how === 'burst') { const v = [at[0] - from[0], at[1] - from[1], at[2] - from[2]]; d = unit([v[0], v[1], v[2] + 0.3 * Math.hypot(v[0], v[1])]); }
      else if (dir) { const u = unitRand(r), n0 = unit(dir), cone = how === 'swing' ? 0.6 : 0.35; d = unit([n0[0] + u[0] * cone, n0[1] + u[1] * cone, n0[2] + u[2] * cone + 0.15]); }
      else if (how === 'crush' || how === 'fall') { const hz = unit([at[0] - c[0] + (r() - 0.5) * 0.2, at[1] - c[1] + (r() - 0.5) * 0.2, 0]); d = unit([hz[0], hz[1], 0.2]); }
      else { const u = unitRand(r); d = unit([u[0], u[1], Math.abs(u[2])]); }
      ws.push(Math.pow(x / s, -1 / 3) * (0.7 + 0.6 * r())); ds.push(d);
      return { at, size, kg: x ** 3 * density, vel: null, spin: unitRand(r).map((v) => v * 6 * Math.sqrt(s / x)) };
    });
    const sum = pieces.reduce((a, p, i) => a + p.kg * ws[i] * ws[i], 0), k = sum > 0 ? Math.sqrt((2 * Ek) / sum) : 0;
    pieces.forEach((p, i) => { p.vel = ds[i].map((v) => v * ws[i] * k); });
    const dustKg = fd * M;
    return { pieces, dust: dustKg > 1e-6 ? { kg: dustKg, at: c, radius: cloud(dustKg), life: 4 + 2 * cloud(dustKg) } : null, stats: { count: pieces.length, mean: s, surface: Anew, kinetic: Ek, dustShare: fd } };
  }
  // a body meeting a liquid: the cavity it opens (E = ρ·g·V·R, a hemisphere: R = (3E / 2πρg)^¼); it splashes when Mundo's
  // √We·Re^¼ passes 57.7 (inertia over surface tension and viscosity); a twentieth of the cavity flies as a crown of
  // droplets, with a tenth of the energy scaled by how much inertia beats viscosity (Re ÷ (Re + 1000)): water splashes,
  // honey gloops, lava plops
  const CROWN = 57.7;
  function splash(liquid, { at, speed, mass, size, seed = 1, max = 40 }) {
    const rho = liquid.density, eta = liquid.viscosity ?? 1e-3, sigma = liquid.tension ?? 0.072;
    const E = 0.5 * mass * speed * speed, Re = (rho * speed * size) / eta, We = (rho * speed * speed * size) / sigma, K = Math.sqrt(We) * Math.pow(Re, 0.25);
    const Rc = E > 0 ? Math.pow((3 * E) / (2 * Math.PI * rho * G), 0.25) : 0;
    if (!(E > 0) || !(K > CROWN)) return { droplets: [], cavity: Rc, plop: true, stats: { E, Re, We, K, kg: 0, kinetic: 0 } };
    const Ms = 0.05 * (2 / 3) * Math.PI * Rc ** 3 * rho, Es = 0.1 * E * (Re / (Re + 1000));
    const n = Math.max(6, Math.min(max, Math.round(Ms / 0.05))), r = rng(seed), kg = Ms / n, ws = [], ds = [];
    const droplets = Array.from({ length: n }, (_, i) => {
      const az = ((i + r()) / n) * 2 * Math.PI, el = ((15 + 30 * r()) * Math.PI) / 180;
      ds.push([Math.sin(el) * Math.cos(az), Math.sin(el) * Math.sin(az), Math.cos(el)]); ws.push(0.7 + 0.6 * r());
      return { at: [at[0] + Math.cos(az) * Rc * 0.6, at[1] + Math.sin(az) * Rc * 0.6, at[2]], kg, vel: null };
    });
    const sum = ws.reduce((a, w) => a + kg * w * w, 0), k = Math.sqrt((2 * Es) / sum);
    droplets.forEach((d, i) => { d.vel = ds[i].map((v) => v * ws[i] * k); });
    return { droplets, cavity: Rc, plop: false, stats: { E, Re, We, K, kg: Ms, kinetic: Es } };
  }

  const physics = { dragArea, blastKg, blastJoules, faceArea, burstShare, blowJoules, heatFactor, impact, pressure, flowOf, submerged, inPool, immerse, stepIn, wet, windOf, windAt, AIR, loadPass, fragments, splash, seedOf, vol, G, TNT };
  E.rupaPhysics = physics;
  if (!E.registerWorldPass) return;   // Node's physics-only build

  // ── the runtime: opt-in, a no-op on a world whose blocks carry no matter ──
  const { clamp, fwdXY } = E;
  const EPS = 0.05, TOUCH = 0.02, FLAME = 1000;
  const boxNear = (b, p) => [0, 1, 2].map((k) => clamp(p[k], b.min[k], b.max[k]));
  E.registerStateInit((state, spec) => {
    if (!state.breakables || !Array.isArray(spec.breakables)) return;
    const R = spec.rupa && typeof spec.rupa === 'object' ? spec.rupa : {};
    let any = false;
    state.breakables.forEach((b, i) => {
      const s = spec.breakables[i];
      if (!s || !(s.joules > 0)) return;
      any = true;
      const T0 = Number.isFinite(s.melt) ? Math.min(20, s.melt - 5) : 20;
      b.rupa = { cap: s.joules, joules: s.joules, mass: s.mass || 0, compressive: s.compressive || 0, cohesion: s.cohesion || 0,
        T: T0, T0, heatCap: s.heatCap || 0, soften: s.soften ?? 500, melt: Number.isFinite(s.melt) ? s.melt : null, fuse: s.fuse || 0, latent: 0,
        ignite: Number.isFinite(s.ignite) ? s.ignite : null, fuel: s.fuel || 0, fuelLeft: s.fuel || 0, burnRate: s.burnRate || 0, burning: false,
        stiff: s.stiff || 1e10, bounce: s.bounce ?? 0.2, fill: s.fill ?? 1, frac: s.frac ?? 100, shape: s.shape || 'chunk', spread: s.spread ?? 1.2, joint: s.joint || 'mortar' };
      b.hp = Infinity;   // the count never breaks it: the energy does
    });
    if (!any) return;
    state.rupa = { swing: R.swing ?? 300, shot: R.shot ?? 2000, blastZ: R.blastZ ?? 4, power: R.power ?? 1, g: R.g ?? G, heatShare: R.heatShare ?? 0.3, fireTime: R.fireTime ?? 60, cool: R.cool ?? 120, seq: -1, hits: [], hotAt: -1, bodies: [], bodySeq: 0, pools: Array.isArray(R.pools) ? R.pools : [], sprays: [], drops: [], dropSeq: 0, wet: { volume: 0, landed: [] }, splashes: [], splashSeq: 0,
      air: { ...AIR, density: R.airDensity ?? AIR.density }, wind: windOf(R.wind), windAt: -1, toppled: [] };
  });
  // src: { joules (what the breaking took: its joules, and any blow past them), from?, dir? } for the debris
  function breakIt(state, b, how, by, src = {}) {
    if (b.broken) return;
    const r = b.rupa, seq = state.breakSeq;
    const debris = fragments(b, { density: r.mass / Math.max(1e-9, vol(b) * r.fill), fill: r.fill, frac: r.frac, shape: r.shape, spread: r.spread,
      joules: src.joules ?? r.cap, how, from: src.from || null, dir: src.dir || null, seed: seedOf(b.id, seq) });
    r.joules = 0; b.hp = 0;
    b.broken = { t: state.time, by: by ?? null, how };
    const k = state.colliders.indexOf(b.collider);
    if (k >= 0) state.colliders.splice(k, 1);
    state.breaks.push({ seq: state.breakSeq++, id: b.id, t: state.time, at: [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2), by: by ?? null, how, debris });
    state.settleDirty = true;
  }
  function spend(state, b, joules, how, by, src = {}) {
    if (b.broken || !b.rupa || !(joules > 0)) return;
    const before = Math.max(0, b.rupa.joules);
    b.rupa.joules -= joules;
    state.rupa.hits.push({ t: state.time, id: b.id, how, joules: Math.round(joules), left: Math.max(0, Math.round(b.rupa.joules)) });
    if (state.rupa.hits.length > 64) state.rupa.hits.shift();
    if (b.rupa.joules <= 0) breakIt(state, b, how, by, { ...src, joules: b.rupa.cap + Math.max(0, joules - before) });
  }
  // heat into a block: up to its melt by its heat capacity, then into its latent heat; past `ignite` it catches
  function warm(state, b, Q, by) {
    const r = b.rupa;
    if (b.broken || !r || !(Q > 0) || !(r.heatCap > 0)) return;
    if (r.melt != null && r.T >= r.melt) r.latent += Q;
    else {
      r.T += Q / r.heatCap;
      if (r.melt != null && r.T > r.melt) { r.latent += (r.T - r.melt) * r.heatCap; r.T = r.melt; }
      if (r.ignite != null && r.T > FLAME) r.T = FLAME;   // what burns gets no hotter than its flame
    }
    if (r.melt != null && r.T >= r.melt && r.latent >= r.fuse) { breakIt(state, b, 'melt', by); return; }
    if (!r.burning && r.ignite != null && r.T >= r.ignite && r.fuelLeft > 0) { r.burning = true; state.rupa.hits.push({ t: state.time, id: b.id, how: 'ignite', joules: Math.round(Q), left: Math.round(r.joules) }); }
  }
  // a block with matter broken by a call (a trigger, a script) breaks outright: its count is held infinite
  const basicBreak = E.breakBlock;
  E.breakBlock = (state, id, dmg = 1, by = null) => {
    const b = state.rupa && state.breakables && state.breakables.find((q) => q.id === id);
    if (b && b.rupa) { if (b.broken) return false; breakIt(state, b, 'call', by); return true; }
    return basicBreak ? basicBreak(state, id, dmg, by) : false;
  };
  // heat a block by id: a fire, a beam, a script, a test (joules)
  E.heatBlock = (state, id, joules, by = null) => { const b = state.rupa && state.breakables.find((q) => q.id === id); if (b) warm(state, b, joules, by); return !!(b && b.rupa); };
  // fire and cooling (order 33, before the blows): a burning block spends its fuel and its strength, and heats what it
  // touches; a block not burning cools back toward where it started
  E.registerWorldPass('rupa-heat', (state, input, dt) => {
    if (!state.rupa) return;
    const R = state.rupa, live = state.breakables.filter((b) => !b.broken && b.rupa);
    let hot = false;
    for (const b of live) {
      const r = b.rupa;
      if (b.broken) continue;
      if (r.burning) {
        hot = true;
        const Q = Math.min(r.fuelLeft, r.burnRate * dt * R.fireTime);
        r.fuelLeft -= Q;
        if (r.fuel > 0) r.joules -= r.cap * (Q / r.fuel);   // its strength burns with its fuel (a blow's damage stays)
        for (const s of live) if (s !== b && !s.broken && touches(b, s, TOUCH)) warm(state, s, Q * 0.1, b.id);
        if (r.fuelLeft <= r.fuel * 0.05) breakIt(state, b, 'burn', null);
      } else if (r.T !== r.T0) {
        r.T = r.T0 + (r.T - r.T0) * Math.exp(-dt / R.cool);
        if (Math.abs(r.T - r.T0) < 0.5) r.T = r.T0;
        if (r.T > r.T0 + 0.1 * (r.soften - r.T0)) hot = true;
      }
    }
    // a hot structure has its load worked out again, a few times a second
    if (hot && state.time - R.hotAt >= 0.25) { R.hotAt = state.time; R.seq = -1; }
  }, 33);
  // ── bodies: matter thrown into the world ──
  const FLOOR = { stiff: 30e9, bounce: 0.2, fixed: true };   // the ground takes a hit as concrete does, and never breaks
  const targetOf = (b) => ({ stiff: b.rupa.stiff, bounce: b.rupa.bounce, joules: Math.max(0, b.rupa.joules), fixed: true });
  const overlaps = (a, b) => [0, 1, 2].every((k) => a.max[k] > b.min[k] && a.min[k] < b.max[k]);
  E.throwMatter = (state, spec) => {
    const R = state.rupa;
    if (!R || !spec) return null;
    const size = Array.isArray(spec.size) ? spec.size : [spec.size, spec.size, spec.size];
    const id = spec.id || `body${R.bodySeq++}`;
    R.bodies.push({ id, half: size.map((x) => x / 2), pos: [...spec.at], vel: [...spec.vel], mass: spec.mass, cap: spec.joules, joules: spec.joules,
      stiff: spec.stiff || 1e10, bounce: spec.bounce ?? 0.2, matter: spec.matter || null, broken: null, rest: false, born: state.time, hits: [] });
    return id;
  };
  // ── spray: water thrown from a nozzle ──
  const WATER = { density: 1000, heat: 4186, boil: 100, vapor: 2.26e6, stiff: 2.2e9 };   // its bulk modulus stands for stiffness
  const hash = (n) => { let x = (n ^ 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  E.spray = (state, spec) => {
    const R = state.rupa;
    if (!R || !spec) return null;
    const L = Math.hypot(...spec.dir) || 1;
    R.sprays.push({ at: [...spec.at], dir: spec.dir.map((x) => x / L), speed: spec.speed, flow: spec.flow, until: state.time + (spec.seconds ?? Infinity), spread: spec.spread ?? 0.03, drop: spec.drop ?? 0.16 });
    return R.sprays.length - 1;
  };
  function douse(state, b, kg, by) {
    const r = b.rupa;
    if (!r || !(r.heatCap > 0) || r.T <= r.T0) return;
    const Q = kg * (WATER.heat * Math.max(0, Math.min(r.T, WATER.boil) - Math.min(r.T0, WATER.boil)) + (r.T > WATER.boil ? WATER.vapor : 0));
    r.T = Math.max(r.T0, r.T - Q / r.heatCap);
    if (r.burning && r.ignite != null && r.T < r.ignite) { r.burning = false; state.rupa.hits.push({ t: state.time, id: b.id, how: 'douse', joules: Math.round(Q), left: Math.round(r.joules) }); }
  }
  // order 31: the spray first, so a doused block is cooler before the fire's pass
  E.registerWorldPass('rupa-spray', (state, input, dt) => {
    const R = state.rupa;
    if (!R || (!R.sprays.length && !R.drops.length)) return;
    for (const s of R.sprays) {
      if (state.time >= s.until || !(s.flow > 0)) continue;
      for (let k = 0; k < 2; k++) {
        const n = R.dropSeq++, jitter = [0, 1, 2].map((i) => (hash(n * 3 + i) - 0.5) * 2 * s.spread);
        const d = s.dir.map((x, i) => x + jitter[i]), L = Math.hypot(...d);
        R.drops.push({ pos: [...s.at], vel: d.map((x) => (x / L) * s.speed), kg: (s.flow * WATER.density * dt) / 2, drop: s.drop });
      }
    }
    const live = [];
    for (const p of R.drops) {
      // a parcel is a slug of the breaking jet (`drop` across): the air's drag on it is the same immersion every body
      // feels, relative to the wind, so a crosswind bends the spray
      const sp = Math.hypot(...p.vel), d = p.drop, cube = { min: [0, 0, 0], max: [d, d, d] }, dm = WATER.density * d * d * d;
      p.vel[2] -= R.g * dt;
      p.vel = stepIn(p.vel, immerse(cube, dm, p.vel, R.air, windHere(state, p.pos)), dm, dt);
      const next = p.pos.map((x, i) => x + p.vel[i] * dt);
      let hit = null;
      for (const b of state.breakables) if (!b.broken && next.every((x, i) => x >= b.min[i] && x <= b.max[i])) { hit = b; break; }
      if (hit) {
        if (hit.rupa) {
          // a jet stresses what it strikes by its stagnation pressure, ½ρv²; below the matter's strength the blow is
          // elastic and leaves it whole (a hose does not wear a log away; a cutting jet at thousands of bar would)
          const left = hit.rupa.cap > 0 ? Math.max(0, hit.rupa.joules) / hit.rupa.cap : 1;
          if (pressure(WATER, { flow: sp }) > hit.rupa.compressive * left) spend(state, hit, impact({ mass: p.kg, stiff: WATER.stiff, bounce: 0 }, targetOf(hit), sp).toB, 'shot', 'spray', { dir: p.vel });
          douse(state, hit, p.kg, 'spray');
        }
        continue;
      }
      if (next[2] <= state.breakFloor) {
        R.wet.volume += p.kg / WATER.density;
        if (R.wet.landed.length < 256) R.wet.landed.push([+next[0].toFixed(2), +next[1].toFixed(2)]);
        continue;
      }
      p.pos = next;
      live.push(p);
    }
    R.drops = live.length > 1200 ? live.slice(live.length - 1200) : live;
  }, 31);
  // the wind at a point as the structure leaves it: behind a block, below its top and within its width, the air is
  // calmer for about six of its heights downwind (its wake), recovering with distance from its lee face
  const WAKE = 6;
  function windHere(state, pos) {
    const R = state.rupa, u = windAt(R.wind, pos, state.time);
    if (!R.wind) return u;
    const d = R.wind.dir, across = [-d[1], d[0]];
    let f = 1;
    for (const b of state.breakables) {
      if (b.broken || b.max[2] <= pos[2]) continue;
      const h = b.max[2] - state.breakFloor, corners = [[b.min[0], b.min[1]], [b.max[0], b.min[1]], [b.min[0], b.max[1]], [b.max[0], b.max[1]]];
      const along = corners.map((c) => c[0] * d[0] + c[1] * d[1]), side = corners.map((c) => c[0] * across[0] + c[1] * across[1]);
      const pa = pos[0] * d[0] + pos[1] * d[1], ps = pos[0] * across[0] + pos[1] * across[1];
      if (ps < Math.min(...side) || ps > Math.max(...side)) continue;
      const behind = pa - Math.max(...along);
      if (behind <= 0 || behind > WAKE * h) continue;
      f = Math.min(f, 0.15 + (0.85 * behind) / (WAKE * h));
    }
    return f < 1 ? u.map((x) => x * f) : u;
  }
  E.windHere = (state, pos) => (state.rupa ? windHere(state, pos) : [0, 0, 0]);   // the wind a page draws, as the bodies feel it
  // what the wind's drag on a body at rest comes to (N), against what its weight holds on the ground
  const REST_MU = 0.5;
  function windWakes(state, p) {
    const R = state.rupa;
    if (!R.wind) return false;
    const u3 = windHere(state, p.pos), u = Math.hypot(...u3), area = dragArea({ min: p.half.map((x) => -x), max: p.half }, u3);
    return 0.5 * R.air.density * 1.05 * area * u * u > REST_MU * p.mass * R.g;
  }
  function bodyHit(state, p, r, onId) {
    p.joules -= r.toA;
    if (p.joules <= 0 && !p.broken) p.broken = { t: state.time, how: 'impact', at: [...p.pos], on: onId };
  }
  // order 32: before the heat, the blows and the count, so a block a body broke this tick is gone for them all
  E.registerWorldPass('rupa-bodies', (state, input, dt) => {
    const R = state.rupa;
    if (!R || !R.bodies.length) return;
    for (const p of R.bodies) {
      if (p.broken) continue;
      if (p.rest) { if (state.time - (p.restAt ?? -1) < 0.25 || !windWakes(state, p)) continue; p.rest = false; }   // the wind lifts what it can
      // steps short enough not to pass through a block: the body's own size, but never finer than 5 cm (no block is that
      // thin), so a 2 mm leaf is not stepped forty times a frame
      const fine = 0.8 * Math.max(0.05, Math.min(...p.half)), n = Math.min(256, Math.max(1, Math.ceil((Math.hypot(...p.vel) * dt) / fine))), h = dt / n;
      for (let k = 0; k < n && !p.broken && !p.rest; k++) {
        const box0 = { min: p.pos.map((x, i) => x - p.half[i]), max: p.pos.map((x, i) => x + p.half[i]) };
        // the air it stands in (lift and drag toward the wind), then any pool: one immersion law for both. The drag is
        // read at the step's start and gravity joins the implicit step, so the falling speed holds at any step size
        const inAir = immerse(box0, p.mass, p.vel, R.air, windHere(state, p.pos));
        p.vel[2] -= R.g * h;
        p.vel = stepIn(p.vel, inAir, p.mass, h);
        if (R.pools.length) {
          for (const pool of R.pools) {
            const w = immerse(box0, p.mass, p.vel, pool);
            if (!w) continue;
            if (!p.wet) {
              const sp0 = Math.hypot(...p.vel), at = [p.pos[0], p.pos[1], pool.max[2]];
              R.splashes.push({ seq: R.splashSeq++, t: state.time, by: p.id, at, ...splash(pool, { at, speed: sp0, mass: p.mass, size: 2 * Math.max(...p.half), seed: seedOf(p.id, R.splashSeq) }) });
              if (R.splashes.length > 32) R.splashes.shift();
            }
            p.vel = stepIn(p.vel, w, p.mass, h);
            p.wet = true;
          }
        }
        for (let i = 0; i < 3; i++) p.pos[i] += p.vel[i] * h;
        // a pool is a basin: what floats in it stays within its sides
        for (const pool of R.pools) {
          if (!p.wet || p.pos[2] - p.half[2] >= pool.max[2]) continue;
          const c0 = box0.min.map((x, i) => (x + box0.max[i]) / 2);
          if (c0[0] < pool.min[0] || c0[0] > pool.max[0] || c0[1] < pool.min[1] || c0[1] > pool.max[1]) continue;
          for (const i of [0, 1]) {
            const lo = pool.min[i] + p.half[i], hi = pool.max[i] - p.half[i];
            if (p.pos[i] < lo) { p.pos[i] = lo; if (p.vel[i] < 0) p.vel[i] = 0; }
            if (p.pos[i] > hi) { p.pos[i] = hi; if (p.vel[i] > 0) p.vel[i] = 0; }
          }
        }
        const box = { min: p.pos.map((x, i) => x - p.half[i]), max: p.pos.map((x, i) => x + p.half[i]) };
        for (const b of state.breakables) {
          if (b.broken || !overlaps(box, b)) continue;
          // the face it came through: the axis it is least far into, and which side of the block it is on
          let ax = 0, best = Infinity, side = 0;
          for (let i = 0; i < 3; i++) {
            const lo = box.max[i] - b.min[i], hi = b.max[i] - box.min[i];
            if (Math.min(lo, hi) < best) { best = Math.min(lo, hi); ax = i; side = lo < hi ? -1 : 1; }
          }
          const vn = -side * p.vel[ax];
          if (vn <= 0) continue;
          const ke = 0.5 * p.mass * (p.vel[0] ** 2 + p.vel[1] ** 2 + p.vel[2] ** 2);
          const r = impact(p, b.rupa ? targetOf(b) : FLOOR, vn);
          bodyHit(state, p, r, b.id);
          p.hits.push({ t: state.time, id: b.id, joules: Math.round(r.toB), broke: r.breaksB });
          if (p.hits.length > 32) p.hits.shift();
          if (b.rupa) spend(state, b, r.toB, 'shot', p.id, { dir: [...p.vel] });
          if (r.breaksB) { const keep = Math.sqrt(Math.max(0, 1 - r.dissipated / ke)); p.vel = p.vel.map((x) => x * keep); }
          else {
            p.vel[ax] = side * vn * r.e;
            for (let i = 0; i < 3; i++) if (i !== ax) p.vel[i] *= 0.8;
            p.pos[ax] = side < 0 ? b.min[ax] - p.half[ax] : b.max[ax] + p.half[ax];
          }
          break;   // one contact a step
        }
        // the floor, after the blocks (a thin block on the floor is met first)
        if (p.broken) break;
        if (p.pos[2] - p.half[2] < state.breakFloor) {
          p.pos[2] = state.breakFloor + p.half[2];
          const vn = -p.vel[2];
          if (vn > 0) {
            const r = impact(p, FLOOR, vn);
            bodyHit(state, p, r, null);
            p.vel[2] = vn * r.e;
            if (vn > 0.5) { p.vel[0] *= 0.7; p.vel[1] *= 0.7; }   // a real landing scuffs
          }
          // on the ground it slides against friction (μ·g), not glue
          const hs = Math.hypot(p.vel[0], p.vel[1]);
          if (hs > 0) { const dv = Math.min(hs, REST_MU * R.g * h); p.vel[0] -= (p.vel[0] / hs) * dv; p.vel[1] -= (p.vel[1] / hs) * dv; }
          if (Math.hypot(...p.vel) < 0.4 && !windWakes(state, p)) { p.rest = true; p.restAt = state.time; p.vel = [0, 0, 0]; }
        }
      }
    }
  }, 32);
  // the blows: read off this tick's records as the basic pass reads them, spent as joules (order 34: before its count)
  E.registerWorldPass('rupa-blows', (state) => {
    if (!state.rupa) return;
    const R = state.rupa, live = state.breakables.filter((b) => !b.broken && b.rupa);
    if (!live.length) return;
    for (const e of state.entities) {
      const s = e.lastShot;
      if (!s || s.t !== state.time || s.mode !== 'miss') continue;
      const b = live.find((q) => !q.broken && boxDist(q, s.to) <= EPS);
      if (b) spend(state, b, blowJoules('shot', R), 'shot', e.id, { dir: [s.to[0] - e.transform.pos[0], s.to[1] - e.transform.pos[1], s.to[2] - e.transform.pos[2]] });
    }
    for (const u of state.bursts || []) {
      if (u.t !== state.time) continue;
      const J = blowJoules('burst', R, { radius: u.radius || 0 });
      for (const b of live) if (boxDist(b, u.pos) <= (u.radius || 0) + EPS) { const q = burstShare(b, u.pos, J); spend(state, b, q, 'burst', null, { from: u.pos }); warm(state, b, q * R.heatShare, null); }
    }
    for (const e of state.entities) {
      const P = e.strikeParams;
      if (e.swingT == null || !P || e.swingT < P.from || e.swingT > P.to) continue;
      const t = e.transform, aim = fwdXY(t.heading + (P.aimYaw || 0)), o = [t.pos[0], t.pos[1], t.pos[2] + P.eye];
      const struck = e.struckThisSwing || (e.struckThisSwing = {});
      for (const b of live) {
        if (b.broken || struck['rupa:' + b.id] || boxDist(b, o) > P.reach) continue;
        const q = boxNear(b, o), v = [q[0] - o[0], q[1] - o[1]], flat = Math.hypot(v[0], v[1]);
        if (flat > 1e-3 && (v[0] * aim[0] + v[1] * aim[1]) / flat < P.cosCone) continue;
        struck['rupa:' + b.id] = true;
        spend(state, b, blowJoules('swing', R), 'swing', e.id, { dir: [q[0] - o[0], q[1] - o[1], q[2] - o[2]] });
      }
    }
  }, 34);
  // after the basic pass has dropped and landed: a landing is an impact (on the block below, or the floor), then the load
  // is worked out again
  E.registerWorldPass('rupa-load', (state) => {
    if (!state.rupa) return;
    const R = state.rupa;
    let changed = R.seq !== state.breakSeq;
    for (const b of state.breakables) {
      if (b.broken || !b.rupa || !b.landed || b.landed.t !== state.time || b.landed.speed <= 0) continue;
      changed = true;
      const under = b.landed.on != null ? state.breakables.find((q) => q.id === b.landed.on && !q.broken) : null;
      const r = impact({ mass: b.rupa.mass, stiff: b.rupa.stiff, bounce: b.rupa.bounce }, under && under.rupa ? targetOf(under) : FLOOR, b.landed.speed);
      spend(state, b, r.toA, 'fall', null);
      if (under && under.rupa) spend(state, under, r.toB, 'crush', b.id);
    }
    if (!changed) return;
    const live = state.breakables.filter((b) => !b.broken && !b.falling && b.rupa);
    const afloat = (b) => R.pools.reduce((m, pool) => (inPool(b, pool) ? m - pool.density * submerged(b, pool.max[2]) : m), b.rupa.mass);
    const boxes = live.map((b) => ({ min: b.min, max: b.max, mass: Math.max(0, afloat(b)), compressive: b.rupa.compressive, lateral: b.bond === 'lateral', bond: b.rupa.cohesion, left: (b.rupa.cap > 0 ? Math.max(0, b.rupa.joules) / b.rupa.cap : 1) * heatFactor(b.rupa.ignite != null ? Math.min(b.rupa.T, b.rupa.ignite) : b.rupa.T, b.rupa.soften, b.rupa.melt, b.rupa.T0), ref: b }));
    const fixed = state.colliders.filter((c) => c.blk == null);
    const L = loadPass(boxes, { fixed, floor: state.breakFloor, g: R.g, touch: TOUCH });
    for (const x of L.crush) breakIt(state, x.ref, 'crush', null);
    for (const grp of L.span) for (const x of grp) if (!x.ref.broken) { x.ref.bond = null; state.settleDirty = true; }
    R.seq = state.breakSeq;
  }, 36);
  // ── WIND LOAD (order 37, a few times a second while the wind blows): the wind's pressure on each exposed face,
  // Cp·½ρu² (Cp 1.3: the push on the windward face and the pull on the lee), u the wind at the block's height. A block
  // whose upwind face touches another block is sheltered. At each joint a stack is tipped by the wind's moment about its
  // downwind edge and slid by its push, and held by its weight (W·half its depth; μW) and, at a mortared joint, by the
  // joint's cohesion (its bending section b·t²/6; its area). A stack that goes leaves the structure as falling bodies. ──
  const MU = 0.6, CP = 1.3;
  E.registerWorldPass('rupa-wind', (state) => {
    const R = state.rupa;
    if (!R || !R.wind || state.time - R.windAt < 0.25) return;
    R.windAt = state.time;
    const d = R.wind.dir, live = state.breakables.filter((b) => !b.broken && !b.falling && b.rupa && b.bond !== 'lateral');
    if (!live.length) return;
    const across = (b) => Math.abs(d[0]) * (b.max[1] - b.min[1]) + Math.abs(d[1]) * (b.max[0] - b.min[0]);
    const depth = (b) => Math.abs(d[0]) * (b.max[0] - b.min[0]) + Math.abs(d[1]) * (b.max[1] - b.min[1]);
    const sheltered = (b) => live.some((s2) => { if (s2 === b) return false; const f = sideFace(b, s2, TOUCH); if (!f) return false; const n = f.at === b.min[f.k] ? -1 : 1; return n * d[f.k] < -0.5; });
    const force = new Map(live.map((b) => {
      if (sheltered(b)) return [b, 0];
      const u = Math.hypot(...windAt(R.wind, centre(b), state.time));
      return [b, pressure(R.air, { flow: u, cp: CP }) * across(b) * (b.max[2] - b.min[2])];
    }));
    const above = (b) => { const out = [b], q = [b]; while (q.length) { const a = q.pop(); for (const s2 of live) if (!out.includes(s2) && restsOn(s2, a, TOUCH)) { out.push(s2); q.push(s2); } } return out; };
    const gone = new Set();
    for (const b of [...live].sort((p, q) => p.min[2] - q.min[2])) {
      if (gone.has(b)) continue;
      const stack = above(b), F = stack.reduce((a, s2) => a + force.get(s2), 0);
      if (!(F > 0)) continue;
      const z0 = b.min[2], M = stack.reduce((a, s2) => a + force.get(s2) * ((s2.min[2] + s2.max[2]) / 2 - z0), 0);
      const W = stack.reduce((a, s2) => a + s2.rupa.mass * R.g, 0), t = depth(b), w = across(b);
      const support = live.find((s2) => restsOn(b, s2, TOUCH));
      const glued = b.rupa.joint === 'mortar' && (!support || support.rupa.joint === 'mortar');
      const coh = glued ? Math.min(b.rupa.cohesion, support ? support.rupa.cohesion : b.rupa.cohesion) : 0;
      const tips = M > W * (t / 2) + coh * ((w * t * t) / 6), slides = F > MU * W + coh * w * t;
      if (!tips && !slides) continue;
      for (const s2 of stack) {
        gone.add(s2);
        const r = s2.rupa, size = [0, 1, 2].map((k) => s2.max[k] - s2.min[k]);
        s2.broken = { t: state.time, by: 'wind', how: 'topple' }; s2.hp = 0;
        const k = state.colliders.indexOf(s2.collider);
        if (k >= 0) state.colliders.splice(k, 1);
        state.breaks.push({ seq: state.breakSeq++, id: s2.id, t: state.time, at: centre(s2), by: 'wind', how: 'topple', debris: null });
        const id = E.throwMatter(state, { id: `topple:${s2.id}`, size, at: centre(s2), vel: [d[0] * 0.8, d[1] * 0.8, 0], mass: r.mass, joules: Math.max(1, r.joules), stiff: r.stiff, bounce: r.bounce });
        R.toppled.push({ t: state.time, id: s2.id, body: id, how: tips ? 'tipped' : 'slid' });
      }
      state.settleDirty = true;
    }
  }, 37);
}
