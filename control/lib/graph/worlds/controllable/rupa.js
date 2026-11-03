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
 *   rupaPhysics (E.rupaPhysics, also run in Node by lib/graph/rupa/index.js):
 *     blastKg(radius, blastZ?) · blastJoules(radius, blastZ?) · faceArea(box, from) · burstShare(box, at, joules, r0?)
 *     blowJoules(how, { swing, shot, blastZ, power }, extra) · heatFactor(T, soften, melt, T0?) · loadPass(blocks, { fixed, floor, g, touch })
 *     impact(mover { mass, stiff, bounce, joules? }, target { stiff, bounce, joules?, mass?, fixed? }, closing speed)
 *       → { e, dissipated, toA, toB, breaksB }
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

  const physics = { blastKg, blastJoules, faceArea, burstShare, blowJoules, heatFactor, impact, loadPass, vol, G, TNT };
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
        stiff: s.stiff || 1e10, bounce: s.bounce ?? 0.2 };
      b.hp = Infinity;   // the count never breaks it: the energy does
    });
    if (!any) return;
    state.rupa = { swing: R.swing ?? 300, shot: R.shot ?? 2000, blastZ: R.blastZ ?? 4, power: R.power ?? 1, g: R.g ?? G, heatShare: R.heatShare ?? 0.3, fireTime: R.fireTime ?? 60, cool: R.cool ?? 120, seq: -1, hits: [], hotAt: -1, bodies: [], bodySeq: 0 };
  });
  function breakIt(state, b, how, by) {
    if (b.broken) return;
    b.rupa.joules = 0; b.hp = 0;
    b.broken = { t: state.time, by: by ?? null, how };
    const k = state.colliders.indexOf(b.collider);
    if (k >= 0) state.colliders.splice(k, 1);
    state.breaks.push({ seq: state.breakSeq++, id: b.id, t: state.time, at: [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2), by: by ?? null, how });
    state.settleDirty = true;
  }
  function spend(state, b, joules, how, by) {
    if (b.broken || !b.rupa || !(joules > 0)) return;
    b.rupa.joules -= joules;
    state.rupa.hits.push({ t: state.time, id: b.id, how, joules: Math.round(joules), left: Math.max(0, Math.round(b.rupa.joules)) });
    if (state.rupa.hits.length > 64) state.rupa.hits.shift();
    if (b.rupa.joules <= 0) breakIt(state, b, how, by);
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
  function bodyHit(state, p, r, onId) {
    p.joules -= r.toA;
    if (p.joules <= 0 && !p.broken) p.broken = { t: state.time, how: 'impact', at: [...p.pos], on: onId };
  }
  // order 32: before the heat, the blows and the count, so a block a body broke this tick is gone for them all
  E.registerWorldPass('rupa-bodies', (state, input, dt) => {
    const R = state.rupa;
    if (!R || !R.bodies.length) return;
    for (const p of R.bodies) {
      if (p.broken || p.rest) continue;
      const fine = 0.8 * Math.min(...p.half), n = Math.min(256, Math.max(1, Math.ceil((Math.hypot(...p.vel) * dt) / fine))), h = dt / n;
      for (let k = 0; k < n && !p.broken && !p.rest; k++) {
        p.vel[2] -= R.g * h;
        for (let i = 0; i < 3; i++) p.pos[i] += p.vel[i] * h;
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
          if (b.rupa) spend(state, b, r.toB, 'shot', p.id);
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
            p.vel[2] = vn * r.e; p.vel[0] *= 0.7; p.vel[1] *= 0.7;
          }
          if (Math.hypot(...p.vel) < 0.4) { p.rest = true; p.vel = [0, 0, 0]; }
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
      if (b) spend(state, b, blowJoules('shot', R), 'shot', e.id);
    }
    for (const u of state.bursts || []) {
      if (u.t !== state.time) continue;
      const J = blowJoules('burst', R, { radius: u.radius || 0 });
      for (const b of live) if (boxDist(b, u.pos) <= (u.radius || 0) + EPS) { const q = burstShare(b, u.pos, J); spend(state, b, q, 'burst', null); warm(state, b, q * R.heatShare, null); }
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
        spend(state, b, blowJoules('swing', R), 'swing', e.id);
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
    const boxes = live.map((b) => ({ min: b.min, max: b.max, mass: b.rupa.mass, compressive: b.rupa.compressive, lateral: b.bond === 'lateral', bond: b.rupa.cohesion, left: (b.rupa.cap > 0 ? Math.max(0, b.rupa.joules) / b.rupa.cap : 1) * heatFactor(b.rupa.ignite != null ? Math.min(b.rupa.T, b.rupa.ignite) : b.rupa.T, b.rupa.soften, b.rupa.melt, b.rupa.T0), ref: b }));
    const fixed = state.colliders.filter((c) => c.blk == null);
    const L = loadPass(boxes, { fixed, floor: state.breakFloor, g: R.g, touch: TOUCH });
    for (const x of L.crush) breakIt(state, x.ref, 'crush', null);
    for (const grp of L.span) for (const x of grp) if (!x.ref.broken) { x.ref.bond = null; state.settleDirty = true; }
    R.seq = state.breakSeq;
  }, 36);
}
