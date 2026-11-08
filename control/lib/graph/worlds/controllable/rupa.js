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
 *   DISTORTION  plastic matter (a block with a `yield`, rupa/matter.js isPlastic: steel, brass, lead, aluminium, putty,
 *            dough) keeps the shape a blow leaves, automatically wherever it stands under destructible physics. A blow's
 *            work W pushes aside V = W / H of it (H the hardness, 3 × yield × heatFactor: hot steel dents sooner), as a
 *            bowl as sharp as the blow (`dentOf`: depth k × radius, a round 1, a body 0.5, a swing 0.25, a landing 0.15,
 *            a burst's dish 0.1; the contact no wider than what strikes), its volume kept in a rim from a to 2a a third
 *            of the depth high: a crater in a solid. The work comes off the block's joules, so the budget still says
 *            whether it stands. Three things past a dent:
 *              THROUGH  a bowl as deep as the stuff is thick (a shell's `wall`, else its box) is a hole: only the plug's
 *                       work H·½π·a²·t is spent and the rest carries on (a round to the next block on its line, a swing
 *                       into what is behind, a body on through, slower). A blow past twice a block's whole budget
 *                       tears it apart outright and carries the rest the same way: powerscaling's top end.
 *              SQUASH   a dent wider than the face it strikes flattens the whole block along the blow at constant volume
 *                       (a shell crumples, its air lost); its collider moves and what it held settles: dough spreads.
 *              STRIP    a plastic block hung by its side (`bond: 'lateral'`: a plate welded to a wall) whose joules run
 *                       out comes off whole as a body (`how: 'strip'`), back toward the blow, instead of breaking into
 *                       debris, so focus fire strips one plate and leaves its neighbours.
 *            Each block keeps its dents (`b.rupa.dents: [{ ax, side, at, a, d, V, hole }]`, merged where they overlap, at
 *            most 24) and a `form` count the page redraws it by; `state.rupa.dents` records each (seq-keyed).
 *
 *              TOOL     a strike carries what it is struck with (the striker's rule's `strikeTool`: sword, axe,
 *                       knife, bat, metal-bat, hammer, fist, or { is?, edge, stroke?, strength, force?, contact? };
 *                       a swing is a sword and a round a round unless said). A tool softer than the stuff's hardness
 *                       cannot bite it, and its force (× power) caps a bowl's radius at √(F / πH): a hammer barely
 *                       marks a steel block, a wooden bat never dents one.
 *              DISH     a panel thinner than the bowl would be wide, or one a soft tool cannot bite, bends once the
 *                       force passes its collapse load π·σy·t²/2 (`dishOf`: bending, then membrane): a broad dish both
 *                       faces show, so a bat dents a car-thin sheet and leaves a centimetre plate whole.
 *              CUT      an edge harder than the stuff (`kerfHard`: 3 × yield; a wood's crushing) cuts a groove on the
 *                       plane of its stroke, snapped to the block's axes (level: horizontal; chop: vertical across),
 *                       W / kerfWork square metres a stroke (`b.rupa.cuts`); through a solid, cleave at run time parts
 *                       the block into two blocks (`<id>/a`, `<id>/b`, `how: 'cut'`, `into`), matter and budget by
 *                       volume, held or dropped by the held graph and the load pass; through a shell, a slit. Timber
 *                       cuts as metal does; brittle stuff breaks as ever.
 *            `E.strikeBlock(state, id, joules, how?, src?)` lands a blow by id (a script, a test; src.tool a tool).
 *
 *   COMBUSTION  a burning block's flame stands Heskestad's L = 0.235·Q^⅖ − 1.02·D tall (flameOf; fire/fire.js
 *            blockFires draws it), and its heat leaves it three ways: its flame into what touches it (a tenth), radiation
 *            from mid-flame (χr 0.3, by the solid angle a target's facing area fills, absorbed 0.9: a crate a metre off
 *            catches, one five metres off does not), and its plume into what hangs over it (the convective heat, by the
 *            share of its footprint covered, fading to nothing at twice the flame's height).
 *
 *   SMOKE    dust and smoke drift on the wind, each a formula of time (puffAt; rupa/smoke-solver.js the scene's
 *            solver): smoke rises on its fire's heat (Briggs' plume rise), dust settles at its grains' speed, both spread
 *            as the air mixes them and fade as their mass thins; a size of dust settling faster than the air stirs it
 *            falls out. Sources go on `state.rupa.smoke`: a break's dust, a burning block's plume, a douse's steam.
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
 *   GROUND   the land as a soil grid (`rupa.ground`, rupa/ground-grid.js: the stage's landform heights and, facet by facet,
 *            its ground's soil): a burst near it digs its crater, the bank thrown to a rim, the faces slumping by their
 *            soil; a footing whose land went drops to it (state.rupa.ground, its `version` and `dirty` cells for the page)
 *
 *   WATER    the stage's lakes and sea on the ground grid (`rupa.ground.water`: boxes and levels), and its rivers
 *            (`rupa.ground.rivers`: each its course, its ends held at their levels so it runs): a depth at each point,
 *            still until moved (a crater at its edge, a levee broken, rain at the page's weather's rate × `rainTime`), then
 *            flowing by rupa/fluid.js's virtual pipes till still; a block on the land holds it, its push breaches one
 *            that cannot (state.rupa.ground.w, its `wVersion` for the page)
 *
 *   TREES    a level's trees as blocks (rupa/tree-blocks.js, `rupa.trees`: each its blocks, its foot, its crown and the
 *            wind that snaps it): a gust at its crown past that speed throws it downwind about its foot (a felling); its
 *            trunk breaks and burns as green wood, its crown as fine fuel
 *
 *   SCARS    cosmetic damage on a map that may not change (`rupa.scars: { ground, wall, walls? }`, a soil's and a matter's
 *            numbers; `walls` [{ min, max, wall }] walls of their own matter by where they stand, the rest the world's `wall`): a burst paints the crater it would dig and throws the dirt it would throw, scorches the fixed walls
 *            in its reach and spalls them, a round chips what it stops on; nothing breaks, nothing moves, every mark and
 *            its debris from the same laws as a breaking (state.rupa.scars.marks)
 *
 *   rupaPhysics (E.rupaPhysics, also run in Node by lib/graph/rupa/index.js):
 *     blastKg(radius, blastZ?) · blastJoules(radius, blastZ?) · faceArea(box, from) · burstShare(box, at, joules, r0?)
 *     blowJoules(how, { swing, shot, blastZ, power }, extra) · heatFactor(T, soften, melt, T0?) · loadPass(blocks, { fixed, floor, g, touch })
 *     impact(mover { mass, stiff, bounce, joules? }, target { stiff, bounce, joules?, mass?, fixed? }, closing speed)
 *       → { e, dissipated, toA, toB, breaksB }
 *     dentOf(work, hardness, { how?, thick?, cap? }) → { V, a, d, rim, k, through, cost } (the dent a blow leaves in
 *       plastic matter; `cost` the work it spends: all of it, or a hole's plug) · SHARP · SHOT_R
 *     pressure(medium, { depth?, flow?, cp? }) → Pa (ρ·g·depth + Cp·½ρv²) · flowOf(medium, p) → m/s (√(2p/ρ))
 *     immerse(box, mass, vel, medium, flow?) → { V, lift, k, flow } | null · stepIn(vel, immersion, mass, h) → vel
 *     submerged(box, surface) · inPool(box, pool) · wet(box, mass, vel, pool) (immerse in a still pool)
 *     windOf({ speed, dir, terrain?, alpha?, gust?, seed? }) → wind · windAt(wind, pos, t) → [u, v, 0]
 *     resistance(φ) · bleed(φ) · blockDrag(φ) · wakeFactor(x behind, h, φ) → the share of the wind left there
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
  // DISTORTION: the dent a blow's work W leaves in plastic matter of hardness H. V = W / H is pushed aside as a
  // paraboloid bowl of depth k·a (the blow's sharpness), its contact radius no wider than `cap` (a round's, a body's
  // half-size), so V = ½π·a²·d; that volume stands in its rim (a to 2a, d / 3 high). A bowl that reaches `thick` goes
  // through: the plug, the dent that just reaches the far face, costs H·½π·a²·t, and that is all the blow spends
  const SHARP = { shot: 1, body: 0.5, swing: 0.25, call: 0.25, fall: 0.15, crush: 0.15, burst: 0.1 };
  const SHOT_R = 0.012;   // m: a round's contact radius, mushroomed
  function dentOf(W, H, { how = 'swing', thick = Infinity, cap = null } = {}) {
    const k = SHARP[how] ?? 0.25, lim = cap ?? (how === 'shot' ? SHOT_R : Infinity);
    if (!(W > 0) || !(H > 0)) return { V: 0, a: 0, d: 0, rim: 0, k, through: false, cost: 0 };
    const V = W / H, a = Math.min(lim, Math.cbrt((2 * V) / (Math.PI * k))), d = (2 * V) / (Math.PI * a * a);
    if (d < thick * (1 - 1e-9)) return { V, a, d, rim: d / 3, k, through: false, cost: W };
    const at = Math.min(lim, thick / k), cost = Math.min(W, H * 0.5 * Math.PI * at * at * thick);
    return { V: cost / H, a: at, d: thick, rim: thick / 3, k, through: true, cost };
  }
  // THE TOOL a blow is struck with (a strike's `strikeTool`): its shape (`edge`: blunt, edge, point), how an edge strokes
  // (`stroke`: level, a horizontal cut; chop, a vertical one across), its `strength` (Pa: the most pressure its face
  // survives, so a tool softer than what it strikes cannot bite it), the peak `force` a person's blow of it brings (N,
  // × the world's power; none: the blow's energy alone decides) and its `contact` (m: a blunt face's radius, a round's)
  const TOOLS = {
    sword: { edge: 'edge', stroke: 'level', strength: 1.5e9, force: 5e3, contact: 0.002 },
    axe: { edge: 'edge', stroke: 'level', strength: 1.2e9, force: 1.2e4, contact: 0.003 },   // it fells: level into a side
    knife: { edge: 'edge', stroke: 'level', strength: 1.5e9, force: 1e3, contact: 0.001 },
    bat: { edge: 'blunt', strength: 50e6, force: 1.5e4, contact: 0.03 },          // ash: its crushing strength
    'metal-bat': { edge: 'blunt', strength: 830e6, force: 1.5e4, contact: 0.03 }, // aluminium: 3 × its yield
    hammer: { edge: 'blunt', strength: 2e9, force: 3e4, contact: 0.015 },          // hardened steel
    fist: { edge: 'blunt', strength: 100e6, force: 3e3, contact: 0.04 },
    round: { edge: 'point', strength: 3e9, force: null, contact: SHOT_R },         // a steel-cored round
  };
  const TOOL_FIELDS = ['is', 'edge', 'stroke', 'strength', 'force', 'contact'];
  function toolOf(spec) {
    if (spec == null) return null;
    if (typeof spec === 'string') return TOOLS[spec] || null;
    if (typeof spec !== 'object') return null;
    const base = spec.is != null ? TOOLS[spec.is] || {} : {}, out = { ...base };
    for (const k of TOOL_FIELDS) if (k !== 'is' && spec[k] !== undefined) out[k] = spec[k];
    return out.edge ? out : null;
  }
  // A THIN PANEL DISHES: past its collapse force π·σy·t²/2 (a plate's yield-line load under a point) it bends, W = Pc·δ
  // to δ = t, then stretches as a membrane, W = Pc·t + (π/2)·σy·t·(δ² − t²); a broad dish (the tool's contact and four
  // times its depth across, at most the face), no rim: the panel moves rather than flows aside. Below Pc it rings
  function dishOf(W, sy, t, { force = Infinity, contact = 0.03, half = Infinity } = {}) {
    const Pc = 0.5 * Math.PI * sy * t * t;
    if (!(W > 0) || !(t > 0) || !(force >= Pc)) return null;
    const Wb = Pc * t, M = 0.5 * Math.PI * sy * t, dmax = 0.5 * half;
    let d = W <= Wb ? W / Pc : Math.sqrt(t * t + (W - Wb) / M), cost = W;
    if (d > dmax) { d = dmax; cost = d <= t ? Pc * d : Wb + M * (d * d - t * t); }
    return { a: Math.min(half, contact + 4 * d), d, cost, Pc, dish: true };
  }
  // AN EDGE CUTS: W opens W / kerfWork square metres of cut, so across a face `width` wide it runs that ÷ width deep
  const cutDepth = (W, kerfWork, width) => W / (kerfWork * Math.max(1e-6, width));
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
  // ── DUST AND SMOKE: puffs carried by the wind, each a formula of time, as a leaf's drift is (rupa/wind-script.js).
  // A puff rides the wind at its height (the power law, held at its 0.5 m value below that) with the gusts' exact sums;
  // smoke RISES on its heat by Briggs' plume rise, Δh = 1.6·F^⅓·t^⅔·u^(−⅓), F = g·Q / (π·cp·ρ·T) its buoyancy flux, to
  // its final rise at x_f = 3.5·x* (x* = 14·F^⅝ below F = 55, 34·F^⅖ above), the calm air taken at 1 m/s (a plume
  // stirs its own); dust SETTLES at its grains' speed (Stokes for the fine, Newton's drag for the coarse, the slower).
  // It spreads as the air mixes it, σ = σ0 + i·u·t (i, the turbulence's intensity, from the ground's roughness: the
  // wind's α), a rising plume at least half as wide as it has risen; its mass deposits at its settling speed over its
  // depth (e^(−vs·t/H)) and steam's droplets evaporate; it shows by its optical depth, alpha = 1 − e^(−K·m/πσ²) (K the
  // mass extinction: soot ~8700 m²/kg, a grain 3/(ρ·d)), so the same mass fades as it spreads. Seeded meander only.
  const AIR_CP = 1005, AIR_T = 293, SOOT_K = 8700, SOOT_YIELD = 0.015, PUFF_RATE = 2, PUFF_MIN = 0.01, PUFF_LIFE = 90, PUFF_SUB = 5;
  const DUST_BINS = [[0, 2e-5, 1e-5], [2e-5, 1e-4, 5e-5], [1e-4, 5e-4, 2.5e-4], [5e-4, 2e-3, 1e-3]];   // m: [from, to, as]
  // a grain's settling speed in air: Stokes for the fine, Newton's drag (Cd 0.44) for the coarse, whichever is slower
  const settleOf = (d, rho = 2650) => Math.min((rho * G * d * d) / (18 * AIR.viscosity), Math.sqrt((4 * rho * G * d) / (3 * 0.44 * AIR.density)));
  const buoyancyOf = (Q) => (G * Math.max(0, Q)) / (Math.PI * AIR_CP * AIR.density * AIR_T);   // m⁴/s³, Q in W
  const stir = (wind) => 1.05 * (wind ? wind.alpha : 0.14) + 0.1 * (wind ? wind.gust : 0);       // the turbulence's intensity
  const uAt = (wind, z) => (wind ? wind.speed * Math.pow(Math.max(0.5, z) / 10, wind.alpha) : 0);
  const hash01 = (n) => { let x = (n ^ 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  function riseOf(F, u, age) {
    if (!(F > 0)) return 0;
    const ue = Math.max(u, 1), xs = F < 55 ? 14 * Math.pow(F, 0.625) : 34 * Math.pow(F, 0.4), tf = (3.5 * xs) / ue;
    return (1.6 * Math.cbrt(F) * Math.pow(Math.min(age, tf), 2 / 3)) / Math.cbrt(ue);
  }
  // a puff p { at, t0, m0, sigma0, vs, F, K, evap?, seed, floor? } at time t → { pos, sigma, alpha, m, age } or null
  function puffAt(p, wind, t) {
    const age = t - p.t0;
    if (!(age >= 0)) return null;
    const rise = riseOf(p.F, uAt(wind, p.at[2]), age), floor = p.floor ?? 0, z = Math.max(floor, p.at[2] + rise - p.vs * age);
    const u = uAt(wind, (p.at[2] + z) / 2), d = wind ? wind.dir : [1, 0], across = [-d[1], d[0]];
    let drift = u * age;
    if (wind && wind.gust > 0) { let g = 0; for (const ph of wind.phases) g += (Math.sin(ph.w * t + ph.p) - Math.sin(ph.w * (t - age) + ph.p)) / ph.w; drift += (wind.gust * u * g) / wind.phases.length; }
    const sigma = Math.max(p.sigma0 + stir(wind) * Math.max(u, 1) * age, p.F > 0 ? 0.5 * rise : 0);
    const wob = 0.6 * (sigma - p.sigma0), h1 = hash01(p.seed * 2 + 1) - 0.5, h2 = hash01(p.seed * 2 + 2) - 0.5;
    const pos = [p.at[0] + d[0] * drift + across[0] * 2 * wob * h1, p.at[1] + d[1] * drift + across[1] * 2 * wob * h1, Math.max(floor, z + 0.5 * wob * h2)];   // it wanders less up and down than across
    const m = p.m0 * Math.exp((-p.vs * age) / Math.max(0.5, p.at[2] - floor, p.sigma0)) * (p.evap > 0 ? Math.exp(-age / p.evap) : 1);
    return { pos, sigma, alpha: 1 - Math.exp((-p.K * m) / (Math.PI * sigma * sigma)), m, age };
  }
  // how long a puff stays in sight (its alpha above PUFF_MIN), found once by halving: a puff fades monotonically
  function lifeOf(p, wind) {
    const seen = (a) => { const q = puffAt({ ...p, t0: 0 }, wind, a); return q && q.alpha >= PUFF_MIN; };
    if (!seen(0)) return 0;
    if (seen(PUFF_LIFE)) return PUFF_LIFE;
    let lo = 0, hi = PUFF_LIFE;
    for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (seen(mid)) lo = mid; else hi = mid; }
    return lo;
  }
  // THE SMOKE SOLVER's decision for one source, with its reasons in numbers (rupa/smoke-solver.js solves a scene):
  //   PLUME  a fire: continuous and buoyant, a puff every 1/PUFF_RATE seconds while it burns, each the soot of that
  //          time (SOOT_YIELD of the fuel burnt) rising on the fire's heat release Q
  //   PUFF   a break's dust (its grains below 2 mm in four sizes, shared by the break's Rosin–Rammler), a burst of steam
  //   HANG / FALL  a size of dust hangs on the air when it settles slower than the air stirs it (vs < i·u, u at least
  //          1 m/s), else it falls out with the debris's spray at once and is not smoke
  //   SKIP   what starts too thin to see (alpha under PUFF_MIN)
  // a source: { kind: 'fire', at, Q, fuel, t0, t1?, radius? } | { kind: 'dust', at, kg, grain?: { x0, n }, particle?,
  // radius?, t0 } | { kind: 'steam', at, kg, t0 } → { puffs, plume?, fallout, reasons }
  function smokeOf(src, wind) {
    const reasons = [], fallout = [], puffs = [], seed = src.seed ?? 1;
    if (src.kind === 'fire') {
      const F = buoyancyOf(src.Q), soot = Math.max(0, src.fuel || 0) * (src.yield ?? SOOT_YIELD), dt = 1 / PUFF_RATE;
      const tmpl = { at: [...src.at], m0: soot * dt, sigma0: Math.max(0.1, src.radius ?? 0.3), vs: 0, F, K: SOOT_K, floor: src.floor ?? 0, seed };
      const life = lifeOf(tmpl, wind);
      reasons.push(`plume: Q ${Math.round(src.Q)} W gives F ${F.toPrecision(3)} m⁴/s³; ${(soot * 1000).toPrecision(3)} g/s of soot; each puff in sight ${life.toFixed(1)} s`);
      return { plume: { ...tmpl, rate: PUFF_RATE, life, t0: src.t0, t1: src.t1 ?? null }, puffs, fallout, reasons };
    }
    if (src.kind === 'steam') {
      const p = { at: [...src.at], t0: src.t0, m0: src.kg, sigma0: 0.25, vs: 0, F: buoyancyOf(src.kg * 2.26e6), K: 300, evap: 1.5, floor: src.floor ?? 0, seed };
      const life = lifeOf(p, wind);
      reasons.push(`steam: ${src.kg.toPrecision(3)} kg boiled, its droplets evaporating in 1.5 s; in sight ${life.toFixed(1)} s`);
      if (life > 0) puffs.push({ ...p, life, kind: 'steam' }); else reasons.push('steam: too thin to see');
      return { puffs, fallout, reasons };
    }
    // dust: four sizes, each hanging or falling out
    const x0 = src.grain && src.grain.x0 > 0 ? src.grain.x0 : 2e-4, n = src.grain && src.grain.n > 0 ? src.grain.n : 1, rho = src.particle ?? 2650;
    const cdf = (x) => 1 - Math.exp(-Math.pow(x / x0, n)), whole = cdf(2e-3) || 1, w = stir(wind) * Math.max(uAt(wind, src.at[2]), 1);
    DUST_BINS.forEach(([a, b, d], k) => {
      const kg = (src.kg * (cdf(b) - cdf(a))) / whole, vs = settleOf(d, rho);
      if (!(kg > 1e-9)) return;
      const tag = `${Math.round(d * 1e6)} µm`;
      if (vs >= w) { fallout.push({ d, kg, vs }); reasons.push(`dust ${tag}: settles at ${vs.toPrecision(2)} m/s, faster than the air stirs it (${w.toPrecision(2)} m/s): falls out`); return; }
      // a cloud of PUFF_SUB puffs billowing from where it broke, each a share of the size's mass, seeded about it
      const r0 = Math.max(0.1, src.radius ?? 0.5), floor = src.floor ?? 0, subs = [];
      for (let j = 0; j < PUFF_SUB; j++) {
        const sd = (seed * 5 + k) * 16 + j, off = [0, 1, 2].map((a) => (hash01(sd * 3 + a) - 0.5) * 1.2 * r0);
        const at = [src.at[0] + off[0], src.at[1] + off[1], Math.max(floor + 0.3 * r0, src.at[2] + Math.abs(off[2]))];
        subs.push({ at, t0: src.t0, m0: kg / PUFF_SUB, sigma0: 0.6 * r0, vs, F: 0, K: 3 / (rho * d), floor, seed: sd });
      }
      const life = lifeOf(subs[0], wind);
      if (!(life > 0)) { reasons.push(`dust ${tag}: ${(kg * 1000).toPrecision(2)} g, too thin to see`); return; }
      reasons.push(`dust ${tag}: settles at ${vs.toPrecision(2)} m/s under the air's ${w.toPrecision(2)}: hangs, in sight ${life.toFixed(1)} s`);
      for (const p of subs) puffs.push({ ...p, life, kind: 'dust', d });
    });
    return { puffs, fallout, reasons };
  }
  // a plume's puffs alive at t: one let go every 1/rate seconds while it burned
  function plumePuffs(pl, wind, t) {
    const out = [], dt = 1 / pl.rate, end = pl.t1 == null ? t : Math.min(t, pl.t1);
    for (let j = Math.floor(end / dt); j * dt >= pl.t0 && t - j * dt <= pl.life; j--) {
      const q = puffAt({ ...pl, t0: j * dt, seed: pl.seed * 7919 + j }, wind, t);
      if (q && q.alpha >= PUFF_MIN) out.push(q);
    }
    return out;
  }
  // ── COMBUSTION: a fire's flame and how its heat leaves it. The flame stands Heskestad's L = 0.235·Q^⅖ − 1.02·D tall
  // (Q in kW, D the burning area's equivalent diameter, m: a 60 kW campfire half a metre across ~0.8 m); of its heat
  // χr = 0.3 leaves as radiation from mid-flame (a point source, Modak: q = χr·Q / 4πd² on a face square to it), the rest
  // rises in its plume, and what touches it is heated by its flame directly
  const CHI_R = 0.3;
  const flameOf = (Q, D) => ({ L: Math.max(0.05, 0.235 * Math.pow(Math.max(0, Q) / 1000, 0.4) - 1.02 * D), D });
  const footD = (b) => Math.sqrt((4 * (b.max[0] - b.min[0]) * (b.max[1] - b.min[1])) / Math.PI);
  // ── BLOCKING: flow's opposite. A barrier is one number, its POROSITY φ (its open share: 0 a solid wall, ~0.5 a hedge
  // or a slatted fence, 1 nothing at all), and how flow gets past it follows from that, never from a tuned allowance:
  //   resistance  a perforated barrier's loss coefficient, k = (1/(Cc·φ) − 1)² (Borda–Carnot, Weisbach's contraction
  //               Cc = 0.62 + 0.38φ³): the pressure it takes to push flow through, in units of ½ρu²
  //   bleed       the share of the flow's speed that passes through, β = 1/√(1 + k) (none through a solid wall)
  //   drag        what it takes from the flow, Cd = 1.2·k/(1 + k) (a solid fence's 1.2; nothing for an open one)
  //   wake        behind it the flow recovers as a plane wake does: its deficit Δu/U = 0.98·√(Cd·d/x) (Schlichting), d its
  //               height doubled by its mirror in the ground, x the distance behind it; close behind, the deficit is
  //               capped at what does not bleed through (1 − β). So a porous hedge shelters less deeply and as far, and a
  //               solid wall stills the air right behind it; above its top the flow passes over it ──
  const contraction = (phi) => 0.62 + 0.38 * phi * phi * phi;
  const resistance = (phi) => (!(phi > 0) ? Infinity : phi >= 1 ? 0 : Math.pow(1 / (contraction(phi) * phi) - 1, 2));
  const bleed = (phi) => { const k = resistance(phi); return k === Infinity ? 0 : 1 / Math.sqrt(1 + k); };
  const blockDrag = (phi) => { const k = resistance(phi); return k === Infinity ? 1.2 : (1.2 * k) / (1 + k); };
  function wakeFactor(x, h, phi = 0) {
    if (!(x > 0) || !(h > 0) || phi >= 1) return 1;
    return 1 - Math.min(1 - bleed(phi), 0.98 * Math.sqrt((blockDrag(phi) * 2 * h) / x));
  }
  const touches = (a, s, touch) => restsOn(a, s, touch) || restsOn(s, a, touch) || !!sideFace(a, s, touch);

  // LOAD over plain boxes { min, max, mass, compressive, bond, lateral?, left? } (lateral: it may be held sideways;
  // bond: the strength of its side bonds, Pa; left: the share of its joules a block has left)
  // a grid over boxes' footprints: a box's neighbours are those sharing a cell with it (padded by `pad`), in the list's
  // own order, so a search through it answers as the whole list would and a large structure stays quick; a box over
  // more than GRID_MOST cells (a level's floor) is everyone's neighbour
  const GRID_MOST = 4096;
  function gridOf(list, cell = 2, pad = 0.05) {
    const map = new Map(), wide = [];
    const span = (b) => [Math.floor((b.min[0] - pad) / cell), Math.floor((b.max[0] + pad) / cell), Math.floor((b.min[1] - pad) / cell), Math.floor((b.max[1] + pad) / cell)];
    list.forEach((b, n) => {
      const [i0, i1, j0, j1] = span(b);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > GRID_MOST) { wide.push(n); return; }
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i + ',' + j, at = map.get(k); if (at) at.push(n); else map.set(k, [n]); }
    });
    return (b) => {
      const [i0, i1, j0, j1] = span(b), seen = new Set(wide);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > GRID_MOST) return list.slice();
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const at = map.get(i + ',' + j); if (at) for (const n of at) seen.add(n); }
      return [...seen].sort((x, y) => x - y).map((n) => list[n]);
    };
  }

  function loadPass(blocks, { fixed = [], floor = 0, g = G, touch = 0.02 } = {}) {
    const onFloor = (b) => b.min[2] <= floor + touch;
    const below = new Map(), weight = new Map(), stress = new Map();
    const nearBlock = gridOf(blocks, 2, touch + 0.01), nearFixed = gridOf(fixed, 2, touch + 0.01);
    for (const b of blocks) {
      const sup = nearBlock(b).filter((s) => s !== b && restsOn(b, s, touch));
      const fx = nearFixed(b).filter((s) => restsOn(b, s, touch));
      below.set(b, { blocks: sup, fixed: fx, ground: onFloor(b) });
    }
    const rests = (b) => { const u = below.get(b); return u.ground || u.fixed.length > 0 || u.blocks.length > 0; };
    // the hung groups: blocks resting on nothing, joined sideways; their roots are the resting blocks they bond to
    const hung = blocks.filter((b) => !rests(b) && b.lateral), hungSet = new Set(hung), seen = new Set(), groups = [];
    for (const h of hung) {
      if (seen.has(h)) continue;
      const g0 = [h], q = [h]; seen.add(h);
      while (q.length) {
        const a = q.pop();
        for (const s of nearBlock(a)) if (!seen.has(s) && hungSet.has(s) && sideFace(a, s, touch)) { seen.add(s); g0.push(s); q.push(s); }
      }
      const roots = [];
      const inG = new Set(g0);
      for (const a of g0) for (const s of nearBlock(a)) {
        if (inG.has(s) || !rests(s)) continue;
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
    if (how === 'burn') { const kg = M * 0.01; return { pieces: [], dust: { kg, at: c, radius: cloud(kg), life: 6, grain: { x0: 2e-5, n: 1 }, particle: 300 }, stats: { count: 0, kinetic: 0, ash: kg } }; }
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
    return { pieces, dust: dustKg > 1e-6 ? { kg: dustKg, at: c, radius: cloud(dustKg), life: 4 + 2 * cloud(dustKg), grain: { x0, n: spread }, particle: density } : null, stats: { count: pieces.length, mean: s, surface: Anew, kinetic: Ek, dustShare: fd } };
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

  // ── SOIL THROWN: a crater's size and the dirt it throws (rupa/ground.js and rupa/debris.js call these; so does the page,
  // to paint a crater it may not dig) ──
  // a crater's size from the energy that reaches the ground: the volume thrown is the energy over the soil's `dig`; the
  // bowl a paraboloid 0.4 as deep as its radius (V = 0.2πR³)
  function craterSize(joules, dig) {
    const V = Math.max(0, joules) / dig, R = Math.cbrt(V / (0.2 * Math.PI));
    return { volume: V, radius: R, depth: 0.4 * R };
  }
  // a grain's settling speed in air: Stokes for the fine, Newton's drag (Cd 0.44) for the coarse, whichever is slower
  const settleSpeed = settleOf;   // (the smoke's law, settleOf: Stokes or Newton, the slower)
  const DIRT_AIRBORNE = 0.03;   // the share of a soil's fines that hangs as a cloud; the rest falls with the spray
  // a crater's ejecta as clumps, spray and dust (rupa/debris.js dirtOf: the law), for a soil record { density, swell, c,
  // mu, grain, fines, particle }
  function dirt(crater, { at, joules, soil: m, z = 0, seed = 1, packets = 48 } = {}) {
    const R = crater && crater.radius, Ve = crater && crater.ejected;
    const empty = { clumps: [], spray: { parcels: [], drag: 0, settle: 0, grain: m.grain }, cloud: null, stats: { kg: 0, kinetic: 0, clumpKg: 0, sprayKg: 0, cloudKg: 0 } };
    if (!(R > 0) || !(Ve > 0)) return empty;
    const r = rng(seed);
    const M = (Ve * m.density) / m.swell, each = M / packets, mu = m.mu ?? 0.45, c = m.c ?? 0;
    const vt = settleSpeed(m.grain ?? 0.0003, m.particle ?? 2650), drag = G / vt, crumble = Math.sqrt((2 * c) / m.density);
    const clumps = [], parcels = [];
    let cloudKg = 0;
    for (let i = 0; i < packets; i++) {
      const rr = R * Math.sqrt(0.09 + 0.91 * r()), az = ((i + r()) / packets) * 2 * Math.PI, el = ((45 + (r() - 0.5) * 12) * Math.PI) / 180;
      const v = 0.6 * Math.sqrt(G * R) * Math.pow(rr / R, -1 / mu), from = [at[0] + Math.cos(az) * rr, at[1] + Math.sin(az) * rr, z];
      const dirOf = (daz, del) => [Math.cos(el + del) * Math.cos(az + daz), Math.cos(el + del) * Math.sin(az + daz), Math.sin(el + del)];
      const hold = c > 0 ? c / (c + 0.5 * m.density * v * v) : 0, clumpKg = each * hold, torn = each - clumpKg;
      if (clumpKg > 0) {
        // the clump in one to three lumps, each its own shape (a seed for the page's lumpiness)
        const n = 1 + Math.floor(r() * 3), shares = Array.from({ length: n }, () => 0.5 + r()), sum = shares.reduce((x, y) => x + y, 0);
        shares.forEach((sh) => {
          const kg = (clumpKg * sh) / sum, speed = v * (0.9 + 0.2 * r()), d = dirOf((r() - 0.5) * 0.12, (r() - 0.5) * 0.08);
          clumps.push({ at: [...from], vel: d.map((x) => x * speed), kg, size: Math.cbrt(kg / m.density), lump: Math.floor(r() * 2 ** 31), crumbles: speed > crumble });
        });
      }
      const fines = torn * (m.fines ?? 0), airborne = fines * DIRT_AIRBORNE;
      cloudKg += airborne;
      const sprayKg = torn - airborne;
      if (sprayKg > 0) for (let k = 0; k < 3; k++) {
        const speed = v * (0.75 + 0.5 * r()), d = dirOf((r() - 0.5) * 0.3, (r() - 0.5) * 0.25);
        parcels.push({ at: [...from], vel: d.map((x) => x * speed), kg: sprayKg / 3 });
      }
    }
    // the energy cap: a quarter of the charge's at most, the speeds scaled down together
    const ke = (list) => list.reduce((s2, p) => s2 + 0.5 * p.kg * (p.vel[0] ** 2 + p.vel[1] ** 2 + p.vel[2] ** 2), 0);
    let Ek = ke(clumps) + ke(parcels);
    const cap = 0.25 * joules;
    if (Ek > cap) { const k = Math.sqrt(cap / Ek); for (const p of [...clumps, ...parcels]) p.vel = p.vel.map((x) => x * k); Ek = cap; }
    const clumpKg = clumps.reduce((s2, p) => s2 + p.kg, 0), sprayKg = parcels.reduce((s2, p) => s2 + p.kg, 0);
    return {
      clumps,
      spray: { parcels, drag, settle: vt, grain: m.grain },
      cloud: cloudKg > 1e-6 ? { kg: cloudKg, at: [at[0], at[1], z + 0.5], radius: cloud(cloudKg), life: 6 + cloud(cloudKg), settle: settleSpeed(2e-5, m.particle ?? 2650) } : null,
      stats: { kg: clumpKg + sprayKg + cloudKg, bank: M, kinetic: Ek, clumpKg, sprayKg, cloudKg, crumbleSpeed: crumble },
    };
  }

  // ── SCARS: what a blow would do to what may not change (cosmetic damage): the bowl it would take out of a face and
  // what it knocks off it. The bowl is the joules over the matter's strength (crushing, or yield where it yields: a
  // blow's work against the stress that holds the face, V = E/σ, as a crater is E/dig), a dish 0.4 as deep as wide; a
  // matter that yields DENTS and throws nothing; a brittle face spalls the bowl as fragments, a twentieth of the blow
  // breaking it (SPALL: the rest goes to heat, sound and the wave through the wall). A burst also blackens the disc its
  // reach cuts on the face (`reach`: √(R² − d²)) ──
  const SPALL = 0.05;
  function scarOf(at, normal, joules, wall, { how = 'burst', from = null, dir = null, seed = 1, faceSize = 1, thick = Infinity, reach = 0 } = {}) {
    const plastic = wall.yield > 0, strength = plastic ? wall.yield : (wall.compressive ?? 20e6), cap = 0.5 * faceSize;
    const r = Math.max(0.005, Math.min(cap, Math.cbrt(joules / strength / (0.2 * Math.PI)))), depth = Math.min(0.4 * r, thick);
    if (plastic) return { kind: 'dent', at, normal, radius: r, bowl: r, depth, debris: null };
    const kind = how === 'burst' ? 'scorch' : 'chip', ax = Math.abs(normal[0]) > 0.5 ? 0 : Math.abs(normal[1]) > 0.5 ? 1 : 2;
    const h = 0.627 * r, half = [h, h, h];   // a square slab of the bowl's volume at its depth (4h²·0.4r = 0.2πr³)
    half[ax] = depth / 2;
    const c = at.map((x, i) => x - (i === ax ? Math.sign(normal[ax]) * depth / 2 : 0)), slab = { min: c.map((x, i) => x - half[i]), max: c.map((x, i) => x + half[i]) };
    const debris = fragments(slab, { density: wall.density ?? 1900, fill: 1, frac: wall.frac ?? 100, shape: wall.shape || 'chunk', spread: wall.spread ?? 1.2, joules: SPALL * joules, how: how === 'burst' ? 'burst' : 'shot', from, dir, seed, max: 12 });
    return { kind, at, normal, radius: Math.max(r, Math.min(cap, reach)), bowl: r, depth, debris };
  }

  // ── GROUND: the land as a grid of soil (rupa/ground-grid.js lays it from the stage's landform and its substrate):
  // heights at the grid's points, what each facet's ground is (a soil record: dig, swell, c, phi, density, depth over
  // bedrock). A blow near it digs the crater its energy would in that soil (craterSize), never below bedrock; the bank
  // dug, bulked by the soil's swell, falls in a rim out to three radii thinning as (r/R)⁻³, every cubic metre laid; then
  // the faces it left slump (Mohr–Coulomb: a drop stands within the critical height 4c/γ·tan(45° + φ/2), past it the soil
  // runs to its angle of repose), the weaker of the two grounds deciding. The same laws as rupa/ground.js, on the page ──
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function unb64(str) {
    const s = String(str).replace(/=+$/, ''), out = new Uint8Array(Math.floor((s.length * 3) / 4));
    let o = 0, acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) { acc = (acc << 6) | B64.indexOf(s[i]); bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255; } }
    return out;
  }
  function groundOf(G) {
    if (!G || typeof G.z !== 'string' || !Array.isArray(G.soils)) return null;
    const zb = unb64(G.z), z = new Float32Array(zb.buffer, 0, G.nx * G.ny), cells = unb64(G.cells), rock = new Float32Array(z.length);
    const out = { x0: G.x0, y0: G.y0, dx: G.dx, nx: G.nx, ny: G.ny, z, z0: Float32Array.from(z), rock, cells, soils: G.soils, version: 0, seen: 0, dirty: null };
    for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) { const sl = soilAt(out, i, j); rock[j * G.nx + i] = z[j * G.nx + i] - (sl ? sl.depth : 0); }
    return out;
  }
  function soilAt(G, i, j) {
    const c = G.cells[Math.min(Math.max(j, 0), G.ny - 2) * (G.nx - 1) + Math.min(Math.max(i, 0), G.nx - 2)];
    return c === 255 || c === undefined ? null : G.soils[c] || null;
  }
  const gclamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function groundZ(G, x, y, of = 'z') {
    const A = G[of], u = gclamp((x - G.x0) / G.dx, 0, G.nx - 1), v = gclamp((y - G.y0) / G.dx, 0, G.ny - 1);
    const i = Math.min(G.nx - 2, Math.floor(u)), j = Math.min(G.ny - 2, Math.floor(v)), a = u - i, b = v - j, k = j * G.nx + i;
    return (A[k] * (1 - a) + A[k + 1] * a) * (1 - b) + (A[k + G.nx] * (1 - a) + A[k + G.nx + 1] * a) * b;
  }
  const hc = (sl) => (sl ? ((4 * sl.c) / (sl.density * G)) * Math.tan(((45 + sl.phi / 2) * Math.PI) / 180) : Infinity);
  function slumpRegion(Gd, i0, i1, j0, j1, iterations = 60) {
    const { nx, dx, z, rock } = Gd;
    for (let n = 0; n < iterations; n++) {
      let most = 0;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const [di, dj] of [[1, 0], [0, 1]]) {
        if (i + di > i1 || j + dj > j1) continue;
        const a = j * nx + i, b = (j + dj) * nx + i + di, sa = soilAt(Gd, i, j), sb = soilAt(Gd, i + di, j + dj);
        if (!sa || !sb) continue;
        const weak = hc(sa) <= hc(sb) ? sa : sb, repose = dx * Math.tan((weak.phi * Math.PI) / 180), drop = z[a] - z[b], dz = Math.abs(drop);
        if (dz <= hc(weak) || dz <= repose) continue;
        const hi = drop > 0 ? a : b, lo = drop > 0 ? b : a, q = Math.min((dz - repose) / 2, z[hi] - rock[hi]);
        if (q <= 1e-6) continue;
        z[hi] -= q; z[lo] += q; most = Math.max(most, q);
      }
      if (most < 1e-4) break;
    }
  }
  function groundCrater(Gd, at, joules) {
    const { nx, ny, dx, x0, y0, z, rock } = Gd, ic = Math.round((at[0] - x0) / dx), jc = Math.round((at[1] - y0) / dx), sl = soilAt(Gd, ic, jc);
    if (!sl || !(sl.dig > 0) || !(joules > 0)) return null;
    const C = craterSize(joules, sl.dig), R = C.radius, Dp = C.depth;
    if (R < 0.5 * dx) return { radius: R, depth: Dp, removed: 0, small: true };
    const reach = 3 * R, i0 = Math.max(0, Math.floor((at[0] - reach - x0) / dx)), i1 = Math.min(nx - 1, Math.ceil((at[0] + reach - x0) / dx));
    const j0 = Math.max(0, Math.floor((at[1] - reach - y0) / dx)), j1 = Math.min(ny - 1, Math.ceil((at[1] + reach - y0) / dx)), A = dx * dx;
    let taken = 0, wsum = 0;
    const rim = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const r = Math.hypot(x0 + i * dx - at[0], y0 + j * dx - at[1]), k = j * nx + i;
      if (r < R) { const to = Math.max(rock[k], z[k] - Dp * (1 - (r / R) ** 2)); taken += (z[k] - to) * A; z[k] = to; }
      else if (r < reach && soilAt(Gd, i, j)) { const w = (r / R) ** -3; rim.push([k, w]); wsum += w; }
    }
    const ejected = taken * sl.swell;
    if (ejected > 0 && wsum > 0) for (const [k, w] of rim) z[k] += (ejected / A) * (w / wsum);
    const pad = 2;
    slumpRegion(Gd, Math.max(0, i0 - pad), Math.min(nx - 1, i1 + pad), Math.max(0, j0 - pad), Math.min(ny - 1, j1 + pad));
    Gd.version++;
    const d = Gd.dirty;
    Gd.dirty = d ? [Math.min(d[0], i0 - pad), Math.max(d[1], i1 + pad), Math.min(d[2], j0 - pad), Math.max(d[3], j1 + pad)] : [i0 - pad, i1 + pad, j0 - pad, j1 + pad];
    return { radius: R, depth: Dp, removed: taken, ejected, soil: sl };
  }

  // ── THE SHOVEL: a scoop (a bank volume: a hand shovel's 10 L, a bucket's 0.8 m³, an excavator's 2 m³) taken out of the
  // ground as a bowl down to bedrock, never narrower than the grid's cell (a smaller scoop is spread over one, the same
  // volume, so dig after dig it deepens), and its loose volume (× the soil's swell) piled where it is thrown as a cone at
  // the soil's angle of repose, then slumped; nothing lost (rupa/ground.js dig, deposit, shovel) ──
  const SCOOPS = { hand: 0.01, bucket: 0.8, excavator: 2 };
  function groundDig(Gd, at, bank) {
    const { nx, ny, dx, x0, y0, z, rock } = Gd, ic = Math.round((at[0] - x0) / dx), jc = Math.round((at[1] - y0) / dx), sl = soilAt(Gd, ic, jc);
    if (!sl || !(bank > 0) || sl.depth <= 0) return null;
    const r = Math.max(0.75 * dx, Math.cbrt((2 * bank) / Math.PI)), D = (2 * bank) / (Math.PI * r * r), A = dx * dx;
    const i0 = Math.max(0, Math.floor((at[0] - r - x0) / dx)), i1 = Math.min(nx - 1, Math.ceil((at[0] + r - x0) / dx));
    const j0 = Math.max(0, Math.floor((at[1] - r - y0) / dx)), j1 = Math.min(ny - 1, Math.ceil((at[1] + r - y0) / dx));
    // the bowl's shape over the grid's points, scaled so it takes the scoop's volume exactly (where bedrock allows)
    const pts = [];
    let shape = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(x0 + i * dx - at[0], y0 + j * dx - at[1]); if (d < r) { const w = 1 - (d / r) ** 2; pts.push([j * nx + i, w]); shape += w * A; } }
    if (!(shape > 0)) return null;
    let taken = 0;
    for (const [k, w] of pts) { const to = Math.max(rock[k], z[k] - (bank / shape) * w); taken += (z[k] - to) * A; z[k] = to; }
    Gd.version++;
    return { bank: taken, loose: taken * sl.swell, soil: sl, radius: r, depth: D, box: [i0, i1, j0, j1] };
  }
  function groundPile(Gd, at, loose, sl) {
    const { nx, ny, dx, x0, y0, z } = Gd, A = dx * dx, tan = Math.tan(((sl ? sl.phi : 30) * Math.PI) / 180);
    const r = Math.max(dx, Math.cbrt((3 * loose) / (Math.PI * Math.max(tan, 0.05))));
    const i0 = Math.max(0, Math.floor((at[0] - r - x0) / dx)), i1 = Math.min(nx - 1, Math.ceil((at[0] + r - x0) / dx));
    const j0 = Math.max(0, Math.floor((at[1] - r - y0) / dx)), j1 = Math.min(ny - 1, Math.ceil((at[1] + r - y0) / dx));
    const pts = [];
    let wsum = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(x0 + i * dx - at[0], y0 + j * dx - at[1]); if (d < r) { pts.push([j * nx + i, r - d]); wsum += r - d; } }
    if (!(wsum > 0)) { const k = Math.min(ny - 1, Math.max(0, Math.round((at[1] - y0) / dx))) * nx + Math.min(nx - 1, Math.max(0, Math.round((at[0] - x0) / dx))); z[k] += loose / A; }
    else for (const [k, w] of pts) z[k] += (loose / A) * (w / wsum);
    slumpRegion(Gd, Math.max(0, i0 - 2), Math.min(nx - 1, i1 + 2), Math.max(0, j0 - 2), Math.min(ny - 1, j1 + 2));
    Gd.version++;
    return { radius: r };
  }
  function groundShovel(Gd, from, to, scoop = 'hand') {
    const bank = typeof scoop === 'string' ? SCOOPS[scoop] : scoop, D = groundDig(Gd, from, bank);
    if (!D) return null;
    const [i0, i1, j0, j1] = D.box;
    slumpRegion(Gd, Math.max(0, i0 - 2), Math.min(Gd.nx - 1, i1 + 2), Math.max(0, j0 - 2), Math.min(Gd.ny - 1, j1 + 2));
    groundPile(Gd, to, D.loose, D.soil);
    const d = Gd.dirty, box = [Math.min(i0, Math.floor((to[0] - Gd.x0) / Gd.dx) - 4), Math.max(i1, Math.ceil((to[0] - Gd.x0) / Gd.dx) + 4), Math.min(j0, Math.floor((to[1] - Gd.y0) / Gd.dx) - 4), Math.max(j1, Math.ceil((to[1] - Gd.y0) / Gd.dx) + 4)];
    Gd.dirty = d ? [Math.min(d[0], box[0]), Math.max(d[1], box[1]), Math.min(d[2], box[2]), Math.max(d[3], box[3])] : box;
    return { bank: D.bank, loose: D.loose };
  }

  // ── WATER ON THE GROUND (the stage's lakes and sea, rupa/ground-grid.js `water`: each a box and its level): a depth at
  // each point of the ground grid, the land under the level filled to it. It moves only when something moves it (a crater
  // dug at its edge, a levee broken, rain): the virtual-pipe scheme rupa/fluid.js runs, its flux driven by ρg·Δs over a
  // face as deep as the water upstream, held to what a point holds. A block standing on the land is ground raised to its
  // top (water pools behind it and pours over it when it rises past); the water's push on it, ½ρg(d₁² − d₂²) a metre,
  // against its weight's friction (it stands on the land unmortared), breaches it ──
  const WATER_RHO = 1000, WATER_BED = 0.4;
  function waterInit(Gd, bodies, rivers) {
    const n = Gd.nx * Gd.ny, w = new Float32Array(n);
    for (const B of bodies || []) for (let j = 0; j < Gd.ny; j++) for (let i = 0; i < Gd.nx; i++) {
      const x = Gd.x0 + i * Gd.dx, y = Gd.y0 + j * Gd.dx, k = j * Gd.nx + i;
      if (x < B.min[0] || x > B.max[0] || y < B.min[1] || y > B.max[1]) continue;
      const d = B.level - Gd.z[k];
      if (d > w[k]) w[k] = d;
    }
    // a river (its course: its line xr and level wl down it, every dy from y0, its half-width hw): laid at its level, its
    // two ends HELD there (fed in upstream, let out downstream), so it runs and never settles
    const held = [], heldAt = [];
    for (const Rv of rivers || []) {
      const m = Rv.xr.length, at = (a, y) => { const u = Math.max(0, Math.min(m - 1.001, (y - Rv.y0) / Rv.dy)), i = Math.floor(u); return a[i] + (a[i + 1] - a[i]) * (u - i); };
      for (let j = 0; j < Gd.ny; j++) for (let i = 0; i < Gd.nx; i++) {
        const x = Gd.x0 + i * Gd.dx, y = Gd.y0 + j * Gd.dx, k = j * Gd.nx + i;
        if (Math.abs(x - at(Rv.xr, y)) >= Rv.hw) continue;
        const L = at(Rv.wl, y), d = L - Gd.z[k];
        if (d <= 0) continue;
        if (d > w[k]) w[k] = d;
        if (j === 0 || j === Gd.ny - 1) { held.push(k); heldAt.push(L); }
      }
    }
    Object.assign(Gd, { w, w0: Float32Array.from(w), q: new Float32Array(n * 4), bar: new Float32Array(n), flowing: held.length > 0, calm: 0, wVersion: 0, wGround: -1, barSeq: -1, held, heldAt, running: held.length > 0 });
  }
  // the blocks on the land as raised ground: each standing block's top over the points under it
  function waterBars(state, Gd) {
    const { nx, ny, dx, x0, y0, z, bar } = Gd;
    bar.fill(0);
    for (const b of state.breakables) {
      if (b.broken || b.falling || b.fell != null || !b.rupa) continue;
      const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
      if (b.min[2] > groundZ(Gd, c[0], c[1]) + 0.3) continue;   // only what stands on the land
      const i0 = Math.max(0, Math.ceil((b.min[0] - x0) / dx)), i1 = Math.min(nx - 1, Math.floor((b.max[0] - x0) / dx));
      const j0 = Math.max(0, Math.ceil((b.min[1] - y0) / dx)), j1 = Math.min(ny - 1, Math.floor((b.max[1] - y0) / dx));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; bar[k] = Math.max(bar[k], b.max[2] - z[k]); }
    }
  }
  const W_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function waterStep(Gd, seconds) {
    const { nx, ny, dx, z, w, q, bar } = Gd, n = nx * ny, A = dx * dx;
    let t = 0, moved = 0;
    while (t < seconds - 1e-9) {
      // (only the wet part of the grid and a margin: a river costs its own points)
      let dmax = 0, i0 = nx, i1 = -1, j0 = ny, j1 = -1;
      for (let k = 0; k < n; k++) if (w[k] > 0) { if (w[k] > dmax) dmax = w[k]; const i = k % nx, j = (k - i) / nx; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
      if (dmax <= 1e-6) break;
      i0 = Math.max(0, i0 - 2); i1 = Math.min(nx - 1, i1 + 2); j0 = Math.max(0, j0 - 2); j1 = Math.min(ny - 1, j1 + 2);
      const dt = Math.min(seconds - t, (0.35 * dx) / Math.sqrt(G * dmax));
      const s = (k) => z[k] + Math.max(bar[k], 0) + w[k];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * nx + i;
        let out = 0;
        for (let r = 0; r < 4; r++) {
          const ii = i + W_DIRS[r][0], jj = j + W_DIRS[r][1], at = k * 4 + r;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || w[k] <= 0) { q[at] = 0; continue; }
          const kk = jj * nx + ii, ds = s(k) - s(kk), face = ds > 0 ? w[k] : w[kk];
          if (face <= 0) { q[at] = 0; continue; }
          let v = (q[at] + dt * G * face * ds) / (1 + dt * WATER_BED);
          q[at] = v > 0 ? v : 0; out += q[at];
        }
        if (out * dt > w[k] * A && out > 0) { const K = (w[k] * A) / (out * dt); for (let r = 0; r < 4; r++) q[k * 4 + r] *= K; }
      }
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * nx + i;
        let net = -(q[k * 4] + q[k * 4 + 1] + q[k * 4 + 2] + q[k * 4 + 3]);
        if (i > 0) net += q[(k - 1) * 4]; if (i < nx - 1) net += q[(k + 1) * 4 + 1];
        if (j > 0) net += q[(k - nx) * 4 + 2]; if (j < ny - 1) net += q[(k + nx) * 4 + 3];
        const d = Math.max(0, w[k] + (dt * net) / A);
        moved = Math.max(moved, Math.abs(d - w[k])); w[k] = d;
      }
      // a river's ends held at their levels: what ran out downstream is let go, what it needs upstream fed in
      if (Gd.held) for (let h = 0; h < Gd.held.length; h++) { const k = Gd.held[h]; w[k] = Math.max(0, Gd.heldAt[h] - z[k]); }
      t += dt;
    }
    return moved;
  }

  const physics = { SCOOPS, groundDig, groundPile, groundShovel, waterInit, waterStep, groundOf, groundZ, groundCrater, unb64, craterSize, settleSpeed, dirt, scarOf, flameOf, footD, CHI_R, settleOf, buoyancyOf, riseOf, puffAt, lifeOf, smokeOf, plumePuffs, SOOT_K, SOOT_YIELD, resistance, bleed, blockDrag, wakeFactor, dragArea, blastKg, blastJoules, faceArea, burstShare, blowJoules, heatFactor, impact, dentOf, SHARP, SHOT_R, TOOLS, toolOf, dishOf, cutDepth, pressure, flowOf, submerged, inPool, immerse, stepIn, wet, windOf, windAt, AIR, loadPass, fragments, splash, seedOf, vol, G, TNT };
  E.rupaPhysics = physics;
  if (!E.registerWorldPass) return;   // Node's physics-only build

  // ── the runtime: opt-in, a no-op on a world whose blocks carry no matter ──
  const { clamp, fwdXY } = E;
  const EPS = 0.05, TOUCH = 0.02, FLAME = 1000;
  const boxNear = (b, p) => [0, 1, 2].map((k) => clamp(p[k], b.min[k], b.max[k]));
  E.registerStateInit((state, spec) => {
    const R = spec.rupa && typeof spec.rupa === 'object' ? spec.rupa : {};
    // a scarred world (cosmetic damage: rupa.scars) runs the physics with nothing breakable at all; so does one whose
    // things carry metal panels (rupa/panels.js), resolved by the mint
    const panelled = !!spec.rupa && Array.isArray(spec.entities) && spec.entities.some((e) => e && Array.isArray(e.panels) && e.panels.some((p) => p && p.yield > 0));
    if (R.scars || R.ground || panelled) { if (!state.breakables) state.breakables = []; if (!state.breaks) { state.breaks = []; state.breakSeq = 0; } if (state.breakFloor === undefined) state.breakFloor = spec.breakFloor ?? 0; if (!state.colliders) state.colliders = []; }
    if (!state.breakables || (!Array.isArray(spec.breakables) && !R.scars && !R.ground && !panelled)) return;
    let any = !!(R.scars || R.ground || panelled);
    state.breakables.forEach((b, i) => {
      if (!spec.breakables) return;
      const s = spec.breakables[i];
      if (!s || !(s.joules > 0)) return;
      any = true;
      const T0 = Number.isFinite(s.melt) ? Math.min(20, s.melt - 5) : 20;
      b.rupa = { cap: s.joules, joules: s.joules, mass: s.mass || 0, compressive: s.compressive || 0, cohesion: s.cohesion || 0,
        T: T0, T0, heatCap: s.heatCap || 0, soften: s.soften ?? 500, melt: Number.isFinite(s.melt) ? s.melt : null, fuse: s.fuse || 0, latent: 0,
        ignite: Number.isFinite(s.ignite) ? s.ignite : null, fuel: s.fuel || 0, fuelLeft: s.fuel || 0, burnRate: s.burnRate || 0, burning: false,
        stiff: s.stiff || 1e10, bounce: s.bounce ?? 0.2, fill: s.fill ?? 1, frac: s.frac ?? 100, shape: s.shape || 'chunk', spread: s.spread ?? 1.2, joint: s.joint || 'mortar', porosity: s.porosity ?? 0 };
      // plastic matter keeps what a blow does to it: its dents, and a count the page redraws it by
      if (s.yield > 0 || s.kerfWork > 0) Object.assign(b.rupa, { yield: s.yield || 0, wall: s.wall > 0 ? s.wall : null, kerfWork: s.kerfWork || 0, kerfHard: s.kerfHard || 0, tensile: s.tensile || 0, dents: [], cuts: [], form: 0, squash: 0 });
      b.hp = Infinity;   // the count never breaks it: the energy does
    });
    if (!any) return;
    state.rupa = { swing: R.swing ?? 300, shot: R.shot ?? 2000, blastZ: R.blastZ ?? 4, power: R.power ?? 1, g: R.g ?? G, heatShare: R.heatShare ?? 0.3, fireTime: R.fireTime ?? 60, cool: R.cool ?? 120, seq: -1, hits: [], hotAt: -1, bodies: [], bodySeq: 0, pools: Array.isArray(R.pools) ? R.pools : [], sprays: [], drops: [], dropSeq: 0, wet: { volume: 0, landed: [] }, splashes: [], splashSeq: 0,
      air: { ...AIR, density: R.airDensity ?? AIR.density }, wind: windOf(R.wind), windAt: -1, toppled: [], dents: [], dentSeq: 0, fells: [], fellSeq: 0, smoke: [], smokeSeq: 0,
      ground: groundOf(R.ground), craters: [], craterSeq: 0, rain: 0, rainTime: R.rainTime ?? 1,
      // the footings (a building's, a tree's roots: rupa/shell-blocks.js, tree-blocks.js): the world's colliders keep only
      // their boxes, so they are found by their place among the level's own (core.js normalizeColliders keeps the order)
      footings: (() => { const out = []; let n = 0; for (const c of Array.isArray(spec.colliders) ? spec.colliders : []) { if (!(c && Array.isArray(c.min) && Array.isArray(c.max) && c.min.length === 3 && c.max.length === 3)) continue; if (String(c.of || '').endsWith(':footing') && state.colliders[n]) out.push(state.colliders[n]); n++; } return out; })(),
      trees: Array.isArray(R.trees) ? R.trees.map((t) => ({ id: t.id, blocks: t.blocks.slice(), foot: t.foot, crown: t.crown.slice(), breakSpeed: t.breakSpeed, snapped: null })) : [], treesAt: -1,
      treeOf: Array.isArray(R.trees) ? Object.fromEntries(R.trees.flatMap((t) => t.blocks.map((id) => [id, t.id]))) : {},
      scars: R.scars ? { ground: R.scars.ground, wall: R.scars.wall, ...(R.scars.walls ? { walls: R.scars.walls } : {}), marks: [], seq: 0 } : null,
      // an object's metal panels: each a plastic plate in its entity's frame, keeping its dents as a block does
      panels: panelled ? panelsOf(state, spec) : [] };
    if (state.rupa.ground && R.ground && ((Array.isArray(R.ground.water) && R.ground.water.length) || (Array.isArray(R.ground.rivers) && R.ground.rivers.length))) waterInit(state.rupa.ground, R.ground.water, R.ground.rivers);
  });
  // src: { joules (what the breaking took: its joules, and any blow past them), from?, dir? } for the debris
  // SMOKE SOURCES (`state.rupa.smoke`, seq-keyed, the last 128): what the page's dust and smoke are solved from
  // (smokeOf, above): a break's dust, a burning block's plume (its real heat release: `fireTime` hastens how long a fire
  // burns, not how big it is), the steam a douse boils off
  function emitSmoke(state, src) {
    const R = state.rupa, rec = { seq: R.smokeSeq++, floor: state.breakFloor ?? 0, ...src };
    R.smoke.push(rec);
    if (R.smoke.length > 128) R.smoke.shift();
    return rec;
  }
  const topOf = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.max[2]];
  function endPlume(state, r) { if (r.plume && r.plume.t1 == null) r.plume.t1 = state.time; }
  function breakIt(state, b, how, by, src = {}) {
    if (b.broken) return;
    const r = b.rupa, seq = state.breakSeq;
    endPlume(state, r);
    const debris = fragments(b, { density: r.mass / Math.max(1e-9, vol(b) * r.fill), fill: r.fill, frac: r.frac, shape: r.shape, spread: r.spread,
      joules: src.joules ?? r.cap, how, from: src.from || null, dir: src.dir || null, seed: seedOf(b.id, seq) });
    r.joules = 0; b.hp = 0;
    b.broken = { t: state.time, by: by ?? null, how };
    const k = state.colliders.indexOf(b.collider);
    if (k >= 0) state.colliders.splice(k, 1);
    state.breaks.push({ seq: state.breakSeq++, id: b.id, t: state.time, at: [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2), by: by ?? null, how, debris });
    // its dust starts as big as what broke, and spreads from there
    if (debris.dust) emitSmoke(state, { kind: 'dust', id: b.id, skin: b.skin || b.id, t0: state.time, at: [...debris.dust.at], kg: debris.dust.kg, grain: debris.dust.grain, particle: debris.dust.particle, radius: 0.6 * Math.max(...[0, 1, 2].map((k) => b.max[k] - b.min[k])), seed: seq + 1 });
    state.settleDirty = true;
  }
  // a blow of `joules` on a block. src: { from?, dir?, at?, ax?, side?, cap?, kind?, depth?, tool? } (where it lands and what
  // lands it, for the debris and a plastic block's dent). Returns the joules it carried THROUGH a plastic block (a hole,
  // or a block torn apart), 0 if it stopped there; a round or a swing hands them on itself (carry)
  function spend(state, b, joules, how, by, src = {}) {
    if (b.broken || !b.rupa || !(joules > 0)) return 0;
    const r = b.rupa, before = Math.max(0, r.joules), plastic = r.yield > 0, shaped = plastic || r.kerfWork > 0;
    let take = joules, through = 0;
    if (plastic && joules >= OVERKILL * r.cap) { take = before; through = joules - before; }   // torn apart outright
    else if (shaped) { const D = distort(state, b, joules, how, src); take = D.spent; through = D.through; }
    if (b.broken) { if (through > 0 && (how === 'shot' || how === 'swing') && src.kind !== 'body') carry(state, b, through, how, by, src); return through; }   // cut in two
    r.joules -= take;
    state.rupa.hits.push({ t: state.time, id: b.id, how, joules: Math.round(take), left: Math.max(0, Math.round(r.joules)), ...(through > 0 ? { through: Math.round(through) } : {}) });
    if (state.rupa.hits.length > 64) state.rupa.hits.shift();
    if (r.joules <= 0) {
      // a plate hung on its weld, worn out by its dents, comes off whole; torn apart (or not plastic) it breaks
      if (plastic && through === 0 && b.bond === 'lateral') stripIt(state, b, by, src);
      else breakIt(state, b, how, by, { ...src, joules: r.cap + Math.max(0, take - before) });
    }
    if (through > 0 && (how === 'shot' || how === 'swing') && src.kind !== 'body') carry(state, b, through, how, by, src);
    return through;
  }
  // ── PANELS: an object's metal plates (rupa/panels.js), each a plastic block in its entity's frame (x its heading, y its
  // left, z up, from its transform's point; a flyer's roll and pitch turn it too). A blow is carried into that frame and
  // lands by the distortion law below; a plate worn out (or a blow twice what it holds) comes off as a body of its own ──
  function panelsOf(state, spec) {
    const out = [];
    for (const raw of spec.entities) {
      const e = raw && state.byId[raw.id];
      if (!e || !Array.isArray(raw.panels)) continue;
      for (const p of raw.panels) {
        if (!(p && p.yield > 0 && p.joules > 0)) continue;   // resolved by the mint (readPanels): a metal plate's numbers
        const T0 = Number.isFinite(p.melt) ? Math.min(20, p.melt - 5) : 20;
        out.push({ id: `${e.id}:${p.id}`, of: e.id, face: p.face, min: [...p.min], max: [...p.max], color: p.color ?? null, off: null,
          rupa: { cap: p.joules, joules: p.joules, mass: p.mass || 0, T: T0, T0, soften: p.soften ?? 500, melt: Number.isFinite(p.melt) ? p.melt : null, stiff: p.stiff || 1e10, bounce: p.bounce ?? 0.2, fill: 1,
            yield: p.yield, wall: p.wall > 0 ? p.wall : null, kerfWork: p.kerfWork || 0, kerfHard: p.kerfHard || 0, tensile: p.tensile || 0, dents: [], cuts: [], form: 0, squash: 0 } });
      }
    }
    return out;
  }
  // the entity's frame: world = pos + Rz(heading)·Ry(−pitch)·Rx(roll)·local (the page's 'ZYX' attitude), and back
  const turnTo = (e, v, inv) => {
    const h = e.transform.heading || 0, roll = (e.tilt && e.tilt.roll) || 0, pitch = (e.tilt && e.tilt.pitch) || 0;
    let [x, y, z] = v;
    const rz = (a) => { const c = Math.cos(a), sn = Math.sin(a); [x, y] = [c * x - sn * y, sn * x + c * y]; };
    const ry = (a) => { const c = Math.cos(a), sn = Math.sin(a); [x, z] = [c * x + sn * z, -sn * x + c * z]; };
    const rx = (a) => { const c = Math.cos(a), sn = Math.sin(a); [y, z] = [c * y - sn * z, sn * y + c * z]; };
    if (inv) { rz(-h); if (pitch) ry(pitch); if (roll) rx(-roll); } else { if (roll) rx(roll); if (pitch) ry(-pitch); rz(h); }
    return [x, y, z];
  };
  const BORE = 0.004;   // m: a round's own radius, the least hole it leaves
  const FACE_AX = { front: 0, back: 0, left: 1, right: 1, top: 2, bottom: 2 };
  const toLocal = (e, p) => turnTo(e, [p[0] - e.transform.pos[0], p[1] - e.transform.pos[1], p[2] - e.transform.pos[2]], true);
  const toWorld = (e, q) => { const v = turnTo(e, q, false); return [e.transform.pos[0] + v[0], e.transform.pos[1] + v[1], e.transform.pos[2] + v[2]]; };
  // a blow of W joules on a panel, src in the entity's frame; returns what distortion made of it ({ spent, through })
  function panelBlow(state, P, W, how, src, away) {
    if (P.off || !(W > 0)) return { spent: 0, through: 0 };
    const r = P.rupa, e = state.byId[P.of];
    if (W >= OVERKILL * r.cap) { panelOff(state, P, e, away, how); return { spent: Math.max(0, r.joules), through: W - Math.max(0, r.joules) }; }
    // a plate is struck on its broad face, from the side the blow comes from (never on its edge, a wall thick)
    // (a blast only reaches its outer face: what is behind a plate is the object it skins; a round or a swing comes from
    // where it comes from, so a round through the far side strikes this one from inside)
    const ax = FACE_AX[P.face], out = P.face === 'front' || P.face === 'left' || P.face === 'top' ? 1 : -1;
    const side = how === 'burst' ? out : src.dir ? (src.dir[ax] > 0 ? -1 : 1) : src.from ? (src.from[ax] > (P.min[ax] + P.max[ax]) / 2 ? 1 : -1) : out;
    const at = boxNear(P, src.at || src.from || centre(P));
    const n0 = r.dents.length, D = distort(state, P, W, how, { ...src, ax, side, at, panel: true });
    // a round through a sheet leaves at least its own bore (it pushes the petals aside), however thin the sheet
    if (how === 'shot' && D.through > 0) { const q = r.dents.length > n0 ? r.dents[r.dents.length - 1] : r.dents.find((x) => x.hole && Math.hypot(x.at[0] - src.at[0], x.at[1] - src.at[1], x.at[2] - src.at[2]) < 2 * BORE); if (q && q.hole) q.a = Math.max(q.a, BORE); }
    r.joules -= D.spent;
    state.rupa.hits.push({ t: state.time, id: P.id, how, joules: Math.round(D.spent), left: Math.max(0, Math.round(r.joules)), ...(D.through > 0 ? { through: Math.round(D.through) } : {}) });
    if (state.rupa.hits.length > 64) state.rupa.hits.shift();
    if (r.joules <= 0) panelOff(state, P, e, away, how);
    return D;
  }
  // a plate off its object: a body of its own, thrown away from the blow with what it was moving at
  function panelOff(state, P, e, away, how) {
    const r = P.rupa, ext = [0, 1, 2].map((k) => P.max[k] - P.min[k]), h = e.transform.heading || 0, c = Math.abs(Math.cos(h)), sn = Math.abs(Math.sin(h));
    const size = [c * ext[0] + sn * ext[1], sn * ext[0] + c * ext[1], ext[2]], at = toWorld(e, centre(P)), d = unit3([away[0], away[1], 0]), v = e.vel || [0, 0, 0];
    r.joules = 0;
    const body = E.throwMatter(state, { id: `panel:${P.id}`, size, at, vel: [v[0] + d[0] * 1.5, v[1] + d[1] * 1.5, (v[2] || 0) + 0.5], mass: r.mass, joules: Math.max(1, r.cap * 0.1), stiff: r.stiff, bounce: r.bounce, matter: null });
    P.off = { t: state.time, how, body, heading: h, away: d };
    state.rupa.hits.push({ t: state.time, id: P.id, how: 'off', joules: 0, left: 0 });
  }
  // the panels a ray from o along d (o + t·d) meets first: the nearest, and where; `upTo` the farthest t it reaches (a
  // round that hit the thing itself reaches its plates however far in they sit)
  function panelOnRay(state, o, d, skip, target) {
    let best = null;
    for (const P of state.rupa.panels) {
      if (P.off || P.of === skip) continue;
      const e = state.byId[P.of], lo = toLocal(e, o), ld = turnTo(e, d, true), t = rayHit(P, lo, ld);
      if (t == null || (P.of !== target && t > 1 + EPS / (Math.hypot(d[0], d[1], d[2]) || 1))) continue;
      if (!best || t < best.t) best = { P, t, at: [lo[0] + ld[0] * t, lo[1] + ld[1] * t, lo[2] + ld[2] * t], dir: ld };
    }
    return best;
  }

  // ── DISTORTION on the runtime (the law is dentOf, above) ──
  const OVERKILL = 2, DENT_MIN = 0.001, DENTS = 24, KERF_W = 0.002;   // KERF_W: rupa/matter.js KERF, the width an edge opens
  const hardOf = (r) => 3 * r.yield * Math.max(0.02, heatFactor(r.T, r.soften, r.melt, r.T0));
  const unit3 = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
  // the face a blow lands on: { ax, side, at } (side +1 the box's max face on axis ax), from what the blow says
  function faceOf(b, src) {
    if (src.ax != null) return { ax: src.ax, side: src.side, at: src.at ? [...src.at] : centre(b) };
    if (src.from) {
      const p = src.from, out = [0, 1, 2].map((k) => Math.max(b.min[k] - p[k], p[k] - b.max[k], 0));
      const ax = out[0] || out[1] || out[2] ? out.indexOf(Math.max(...out)) : 2;
      return { ax, side: p[ax] > (b.min[ax] + b.max[ax]) / 2 ? 1 : -1, at: boxNear(b, p) };
    }
    if (src.at) {
      const p = src.at; let ax = 0, side = 1, best = Infinity;
      for (let k = 0; k < 3; k++) for (const [sd, w] of [[-1, b.min[k]], [1, b.max[k]]]) if (Math.abs(p[k] - w) < best) { best = Math.abs(p[k] - w); ax = k; side = sd; }
      return { ax, side, at: [...p] };
    }
    if (src.dir) {
      const d = src.dir, ax = [0, 1, 2].reduce((m, k) => (Math.abs(d[k]) > Math.abs(d[m]) ? k : m), 0);
      return { ax, side: d[ax] > 0 ? -1 : 1, at: centre(b) };
    }
    return null;
  }
  // what a blow does to a block that keeps its shape, by the tool that lands it: an edge harder than the stuff cuts it;
  // a tool that bites (as strong as the stuff is hard) dents it, as wide as its force can press (√(F / πH)); a panel
  // thinner than that bowl would be wide dishes instead; a tool too soft to bite still dishes a panel it can bend; else
  // the blow rings off and spends nothing. A round, a body, a burst, a landing carry no tool's limits: their energy decides
  const DEFAULT_TOOL = { swing: 'sword', shot: 'round' };
  const minOf = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));
  function distort(state, b, W, how, src) {
    const r = b.rupa, f = faceOf(b, src);
    if (!f) return { spent: W, through: 0 };
    const kind = src.kind || how, tool = src.tool === null || kind === 'body' ? null : toolOf(src.tool ?? DEFAULT_TOOL[kind] ?? null);
    const ext = [0, 1, 2].map((k) => b.max[k] - b.min[k]), thick = r.wall ?? ext[f.ax];
    const u = [0, 1, 2].filter((k) => k !== f.ax), half = 0.5 * Math.min(ext[u[0]], ext[u[1]]);
    if (tool && tool.edge === 'edge' && r.kerfWork > 0 && tool.strength > kerfHardOf(r)) return cut(state, b, f, W, tool, src);
    if (!(r.yield > 0)) return { spent: W, through: 0 };   // timber struck blunt: its budget, as ever
    const H = hardOf(r), F = tool && tool.force > 0 ? tool.force * (state.rupa.power ?? 1) : Infinity, contact = (tool && tool.contact) || 0.03;
    const panel = () => { const P = dishOf(W, H / 3, thick, { force: F, contact, half }); if (P) addDent(state, b, f, P, thick); return { spent: P ? P.cost : 0, through: 0 }; };
    if (tool && !(tool.strength >= H)) return panel();
    const k = SHARP[kind] ?? 0.25, capF = Number.isFinite(F) ? Math.sqrt(F / (Math.PI * H)) : null;
    let D = dentOf(W, H, { how: kind, thick, cap: src.cap ?? (tool && tool.edge === 'point' ? tool.contact : null) });
    if (D.through) { addDent(state, b, f, D, thick); return { spent: D.cost, through: W - D.cost }; }
    if (D.a > half) { if (src.panel) return panel(); squash(state, b, f, D.V); return { spent: D.cost, through: 0 }; }   // a panel is a plate: it dishes
    if (thick < D.a) return panel();
    if (capF != null && capF < D.a) {   // the force runs out first: a bowl only as wide as it can press, the rest rings off
      const a = capF, d = Math.min(k * a, 0.95 * thick), V = 0.5 * Math.PI * a * a * d;
      D = { V, a, d, rim: d / 3, k, through: false, cost: H * V };
    }
    if (D.d >= DENT_MIN) addDent(state, b, f, D, thick);
    return { spent: D.cost, through: 0 };
  }
  const kerfHardOf = (r) => r.kerfHard * (r.yield > 0 ? Math.max(0.02, heatFactor(r.T, r.soften, r.melt, r.T0)) : 1);
  // the cut's plane, snapped to the block's axes: a level stroke across a side face cuts horizontally; a chop cuts the
  // vertical plane across the face; from above, any stroke cuts across the block's longer way
  function cutAxis(b, f, tool) {
    if (f.ax !== 2) return (tool.stroke ?? 'level') === 'level' ? 2 : 1 - f.ax;
    return b.max[0] - b.min[0] >= b.max[1] - b.min[1] ? 0 : 1;
  }
  // a groove along the plane where the edge lands, deepened by each stroke there; through a solid it parts the block
  // (cleaveBlock), through a shell it is a slit
  function cut(state, b, f, W, tool, src) {
    const r = b.rupa, n = cutAxis(b, f, tool), m = [0, 1, 2].find((k) => k !== f.ax && k !== n);
    const t = r.wall ?? b.max[f.ax] - b.min[f.ax], width = b.max[m] - b.min[m], at = clamp(f.at[n], b.min[n], b.max[n]);
    let c = r.cuts.find((q) => q.ax === f.ax && q.side === f.side && q.n === n && Math.abs(q.at - at) < 0.02);
    if (!c && r.cuts.length >= DENTS) c = r.cuts.reduce((x, q) => (Math.abs(q.at - at) < Math.abs(x.at - at) ? q : x));
    if (!c) { c = { ax: f.ax, side: f.side, n, at, depth: 0, through: false }; r.cuts.push(c); }
    if (c.through) return { spent: 0, through: W };   // through the slit already
    // the blow's work goes into the cut; the block's budget, its whole, loses only what the kerf held (KERF wide)
    const kerf = (dA) => (r.cap * dA * KERF_W) / Math.max(1e-12, (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]) * r.fill);
    const need = (t - c.depth) * width * r.kerfWork;
    if (W < need) {
      const dd = cutDepth(W, r.kerfWork, width);
      c.depth += dd;
      record(state, b, { how: 'cut', ax: c.ax, side: c.side, n, at: r6(c.at), depth: r6(c.depth) });
      if (n === 2 && c.ax !== 2) state.rupa.seq = -1;   // a level groove narrows the hinge what stands above it rests on
      return { spent: kerf(dd * width), through: 0 };
    }
    const dA = (t - c.depth) * width;
    c.depth = t; c.through = true;
    record(state, b, { how: 'cut', ax: c.ax, side: c.side, n, at: r6(c.at), depth: r6(t), through: true });
    if (r.wall == null) cleaveBlock(state, b, n, c.at, Math.max(r.joules - kerf(dA), 0.05 * r.cap), src.by ?? null);
    return { spent: kerf(dA), through: W - need };
  }
  // CLEAVE at run time: a block cut through parts on its plane into two blocks, each with the matter, the heat and the
  // marks on its side and its share (by volume) of the budget left; the held graph and the load pass decide what stands
  function cleaveBlock(state, b, n, at, left, by) {
    const r = b.rupa, L = b.max[n] - b.min[n];
    if (at - b.min[n] < 0.01 || b.max[n] - at < 0.01) return false;   // a sliver: the groove stays a groove
    b.broken = { t: state.time, by, how: 'cut' }; b.hp = 0;
    const k0 = state.colliders.indexOf(b.collider);
    if (k0 >= 0) state.colliders.splice(k0, 1);
    const into = [];
    for (const [lo, hi, tag] of [[b.min[n], at, 'a'], [at, b.max[n], 'b']]) {
      const min = [...b.min], max = [...b.max], s2 = (hi - lo) / L, id = `${b.id}/${tag}`;
      min[n] = lo; max[n] = hi;
      const c = { min, max, of: id, blk: state.breakables.length }, mine = (x) => x >= lo - 1e-9 && x <= hi + 1e-9;
      const sc = {};
      for (const key of ['cap', 'mass', 'heatCap', 'fuel', 'fuelLeft', 'fuse', 'burnRate', 'latent']) sc[key] = (r[key] || 0) * s2;
      state.colliders.push(c);
      state.breakables.push({ id, min: c.min, max: c.max, hp: Infinity, bond: b.bond, broken: null, falling: null, landed: null, collider: c, skin: b.skin || b.id, parent: b.id,
        rupa: { ...r, ...sc, joules: left * s2, dents: r.dents.filter((q) => mine(q.at[n])).map((q) => ({ ...q, at: [...q.at] })),
          cuts: r.cuts.filter((q) => q.n !== n || (q.at !== at && mine(q.at))).map((q) => ({ ...q })), form: 1 } });
      into.push(id);
    }
    state.breaks.push({ seq: state.breakSeq++, id: b.id, t: state.time, at: centre(b), by, how: 'cut', debris: null, into, plane: { axis: n, at: r6(at) } });
    state.settleDirty = true; state.rupa.seq = -1;
    return true;
  }
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  function record(state, b, rec) {
    const R = state.rupa;
    b.rupa.form++;
    R.dents.push({ seq: R.dentSeq++, t: state.time, id: b.id, ...rec });
    if (R.dents.length > 64) R.dents.shift();
  }
  function addDent(state, b, f, D, thick) {
    const r = b.rupa, at = [...f.at];
    at[f.ax] = f.side > 0 ? b.max[f.ax] : b.min[f.ax];
    const dent = { ax: f.ax, side: f.side, at, a: D.a, d: D.d, V: D.V ?? 0, hole: !!D.through, ...(D.dish ? { dish: true } : {}) };
    const face = r.dents.filter((q) => q.ax === dent.ax && q.side === dent.side && !!q.dish === !!dent.dish);
    const gap = (q) => Math.hypot(q.at[0] - at[0], q.at[1] - at[1], q.at[2] - at[2]);
    let q = face.find((x) => gap(x) < 0.5 * Math.max(x.a, dent.a));
    if (!q && r.dents.length >= DENTS) q = (face.length ? face : r.dents).reduce((m, x) => (gap(x) < gap(m) ? x : m));
    if (q && dent.dish) {
      // overlapping dishes sink one panel further: the membrane's work goes as the square of its depth
      q.a = Math.max(q.a, dent.a); q.d = Math.min(Math.hypot(q.d, dent.d), q.a);   // never deeper than it is wide
    } else if (q) {
      // overlapping blows deepen one bowl: their volumes add over the wider of the two
      const V = q.V + dent.V;
      for (let k = 0; k < 3; k++) q.at[k] = (q.at[k] * q.V + at[k] * dent.V) / V;
      q.a = Math.max(q.a, dent.a); q.V = V; q.d = Math.min(thick, (2 * V) / (Math.PI * q.a * q.a));
      q.hole = q.hole || dent.hole || q.d >= thick * (1 - 1e-9);
      if (q.hole) q.d = thick;
    } else r.dents.push(dent);
    const m = q || dent;
    record(state, b, { how: m.hole ? 'hole' : m.dish ? 'dish' : 'dent', ax: m.ax, side: m.side, at: m.at.map(r6), a: r6(m.a), d: r6(m.d) });
  }
  // flattened along the blow at constant volume (a shell crumples, keeping its footprint); its dents ride with it
  function squash(state, b, f, V) {
    const r = b.rupa, ext = [0, 1, 2].map((k) => b.max[k] - b.min[k]), solid = ext[0] * ext[1] * ext[2] * r.fill;
    const eps = Math.min(0.5, V / Math.max(1e-12, solid));
    if (!(eps > 1e-4)) return;
    const old = { min: [...b.min], max: [...b.max] }, L = ext[f.ax] * (1 - eps), grow = r.wall == null ? 1 / Math.sqrt(1 - eps) : 1;
    if (f.ax === 2 || f.side > 0) b.max[f.ax] = r6(b.min[f.ax] + L); else b.min[f.ax] = r6(b.max[f.ax] - L);
    for (let k = 0; k < 3; k++) {
      if (k === f.ax) continue;
      if (k === 2) b.max[2] = r6(b.min[2] + ext[2] * grow);   // it stays on what holds it
      else { const c = (old.min[k] + old.max[k]) / 2; b.min[k] = r6(c - (ext[k] * grow) / 2); b.max[k] = r6(c + (ext[k] * grow) / 2); }
    }
    const remap = (x, k) => b.min[k] + ((x - old.min[k]) * (b.max[k] - b.min[k])) / (old.max[k] - old.min[k] || 1);
    for (const q of r.dents) for (let k = 0; k < 3; k++) q.at[k] = remap(q.at[k], k);
    for (const q of r.cuts) q.at = remap(q.at, q.n);
    r.squash += eps;
    record(state, b, { how: 'squash', ax: f.ax, side: f.side, eps: r6(eps) });
    state.settleDirty = true; state.rupa.seq = -1;
  }
  // a plate off its weld: gone from the structure, a body of its own falling back toward the blow
  function stripIt(state, b, by, src) {
    const r = b.rupa, size = [0, 1, 2].map((k) => b.max[k] - b.min[k]), c = centre(b);
    const d = src.dir ? unit3([-src.dir[0], -src.dir[1], 0]) : src.from ? unit3([src.from[0] - c[0], src.from[1] - c[1], 0]) : [0, 0, 0];
    r.joules = 0; b.hp = 0;
    b.broken = { t: state.time, by: by ?? null, how: 'strip' };
    const k = state.colliders.indexOf(b.collider);
    if (k >= 0) state.colliders.splice(k, 1);
    const id = E.throwMatter(state, { id: `strip:${b.id}`, size, at: c, vel: [d[0] * 1.5, d[1] * 1.5, 0.5], mass: r.mass, joules: Math.max(1, r.cap * 0.1), stiff: r.stiff, bounce: r.bounce, matter: null });
    state.breaks.push({ seq: state.breakSeq++, id: b.id, t: state.time, at: c, by: by ?? null, how: 'strip', debris: null, body: id, away: d });
    state.settleDirty = true;
  }
  // what a blow carries through: a round on along its line to the next block it meets, a swing into what stands behind
  function rayHit(b, o, d) {
    let t0 = -Infinity, t1 = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-12) { if (o[k] < b.min[k] || o[k] > b.max[k]) return null; continue; }
      const a = (b.min[k] - o[k]) / d[k], c = (b.max[k] - o[k]) / d[k];
      t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c));
    }
    return t1 >= Math.max(t0, 0) ? Math.max(t0, 0) : null;
  }
  function carry(state, b, joules, how, by, src) {
    if (!src.dir || (src.depth || 0) >= 16) return;
    const d = unit3(src.dir), o = src.at ? [...src.at] : centre(b), reach = how === 'shot' ? 200 : 1 + Math.max(...[0, 1, 2].map((k) => b.max[k] - b.min[k]));
    let best = null, bt = Infinity;
    for (const q of state.breakables) {
      if (q === b || q.broken || !q.rupa) continue;
      const t = rayHit(q, o, d);
      if (t != null && t > 1e-6 && t < bt && t <= reach) { bt = t; best = q; }
    }
    if (best) spend(state, best, joules, how, by, { dir: src.dir, at: o.map((x, i) => x + d[i] * bt), depth: (src.depth || 0) + 1 });
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
    if (!r.burning && r.ignite != null && r.T >= r.ignite && r.fuelLeft > 0) {
      r.burning = true; state.rupa.hits.push({ t: state.time, id: b.id, how: 'ignite', joules: Math.round(Q), left: Math.round(r.joules) });
      const heat = r.mass > 0 ? r.fuel / r.mass : 0;   // its heat of combustion, J/kg
      r.plume = emitSmoke(state, { kind: 'fire', id: b.id, t0: state.time, t1: null, at: topOf(b), Q: r.burnRate, fuel: heat > 0 ? r.burnRate / heat : 0, radius: 0.5 * Math.min(b.max[0] - b.min[0], b.max[1] - b.min[1]), seed: state.rupa.smokeSeq + 1 });
    }
  }
  // a block with matter broken by a call (a trigger, a script) breaks outright: its count is held infinite
  const basicBreak = E.breakBlock;
  E.breakBlock = (state, id, dmg = 1, by = null) => {
    const b = state.rupa && state.breakables && state.breakables.find((q) => q.id === id);
    if (b && b.rupa) { if (b.broken) return false; breakIt(state, b, 'call', by); return true; }
    return basicBreak ? basicBreak(state, id, dmg, by) : false;
  };
  // a blow on a block by id: a trigger, a script, a test (joules, as a round, a swing, a burst or a landing; src says
  // where it lands: { dir?, at?, from? }). Returns what it carried through (a plastic block's hole), handed on as a round's
  // or a swing's would be
  E.strikeBlock = (state, id, joules, how = 'shot', src = {}, by = null) => { const b = state.rupa && state.breakables.find((q) => q.id === id); return b && b.rupa ? spend(state, b, joules, how, by, src) : 0; };
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
      if (r.steam > 0.02 && state.time - (r.steamAt ?? -1) >= 0.25) { emitSmoke(state, { kind: 'steam', id: b.id, t0: state.time, at: topOf(b), kg: r.steam, seed: R.smokeSeq + 1 }); r.steam = 0; r.steamAt = state.time; }
      if (r.burning) {
        hot = true;
        const Q = Math.min(r.fuelLeft, r.burnRate * dt * R.fireTime);
        r.fuelLeft -= Q;
        if (r.fuel > 0) r.joules -= r.cap * (Q / r.fuel);   // its strength burns with its fuel (a blow's damage stays)
        // its heat reaches what is around it: its flame what it touches, its radiation what faces it (by the solid angle
        // the facing area fills from mid-flame, absorbed 0.9), its plume what hangs over it (the convective heat by the
        // share of its footprint covered, within twice the flame's height)
        const top = b.max[2], fl = flameOf(r.burnRate, footD(b)), src = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, top + fl.L / 2], foot = (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]);
        for (const s of live) {
          if (s === b || s.broken || !s.rupa) continue;
          if (touches(b, s, TOUCH)) warm(state, s, Q * 0.1, b.id);
          const d = boxDist(s, src);
          if (d < Math.max(3, 6 * fl.L)) warm(state, s, Q * CHI_R * 0.9 * Math.min(0.5, faceArea(s, src) / (4 * Math.PI * Math.max(d * d, 0.01))), b.id);
          if (s.min[2] >= top - TOUCH && s.min[2] <= top + 2 * fl.L && foot > 0) {
            const cover = Math.max(0, ovl(b, s, 0)) * Math.max(0, ovl(b, s, 1)) / foot;
            if (cover > 0) warm(state, s, Q * (1 - CHI_R) * 0.5 * Math.min(1, cover) * (1 - (s.min[2] - top) / (2 * fl.L + 1e-9)), b.id);
          }
        }
        if (r.fuelLeft <= r.fuel * 0.05) breakIt(state, b, 'burn', null);
      } else if (r.T !== r.T0) {
        r.T = r.T0 + (r.T - r.T0) * Math.exp(-dt / R.cool);
        if (Math.abs(r.T - r.T0) < 0.01) r.T = r.T0;   // cooled: round off (finer than a far fire's warming a step)
        if (r.T > r.T0 + 0.1 * (r.soften - r.T0)) hot = true;
      }
    }
    // a hot structure has its load worked out again, a few times a second
    if (hot && state.time - R.hotAt >= 0.25) { R.hotAt = state.time; R.seq = -1; }
  }, 33);
  // ── bodies: matter thrown into the world ──
  const FLOOR = { stiff: 30e9, bounce: 0.2, fixed: true };   // the ground takes a hit as concrete does, and never breaks
  // a plastic block lets a body through for a hole's work (the plug as wide as the body's contact) when that is less
  // than what it has left
  const holeCost = (b, ax, cap) => { const r = b.rupa, t = r.wall ?? (b.max[ax] - b.min[ax]), a = Math.min(cap, t / SHARP.body); return hardOf(r) * 0.5 * Math.PI * a * a * t; };
  const targetOf = (b, ax = null, cap = null) => ({ stiff: b.rupa.stiff, bounce: b.rupa.bounce, joules: Math.max(0, ax != null && b.rupa.yield > 0 ? Math.min(b.rupa.joules, holeCost(b, ax, cap)) : b.rupa.joules), fixed: true });
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
    if (r.T > WATER.boil) r.steam = (r.steam || 0) + kg;   // boiled off: it leaves as steam (rupa-heat lets it go)
    r.T = Math.max(r.T0, r.T - Q / r.heatCap);
    if (r.burning && r.ignite != null && r.T < r.ignite) { r.burning = false; endPlume(state, r); state.rupa.hits.push({ t: state.time, id: b.id, how: 'douse', joules: Math.round(Q), left: Math.round(r.joules) }); }
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
  // the wind at a point as the structure leaves it: behind a block, below its top and within its width, in its wake
  // (wakeFactor: what its porosity bleeds through, recovering as a plane wake)
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
      if (behind <= 0) continue;
      f = Math.min(f, wakeFactor(behind, h, b.rupa ? b.rupa.porosity : 0));
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
        if (p.through) for (const id of [...p.through]) { const q = state.breakables.find((x) => x.id === id); if (!q || q.broken || !overlaps(box, q)) p.through.delete(id); }
        for (const b of state.breakables) {
          if (b.broken || !overlaps(box, b) || (p.through && p.through.has(b.id))) continue;
          // the face it came through: the axis it is least far into, and which side of the block it is on
          let ax = 0, best = Infinity, side = 0;
          for (let i = 0; i < 3; i++) {
            const lo = box.max[i] - b.min[i], hi = b.max[i] - box.min[i];
            if (Math.min(lo, hi) < best) { best = Math.min(lo, hi); ax = i; side = lo < hi ? -1 : 1; }
          }
          const vn = -side * p.vel[ax];
          if (vn <= 0) continue;
          const ke = 0.5 * p.mass * (p.vel[0] ** 2 + p.vel[1] ** 2 + p.vel[2] ** 2);
          const cap = Math.min(...[0, 1, 2].filter((i) => i !== ax).map((i) => p.half[i]));
          const r = impact(p, b.rupa ? targetOf(b, ax, cap) : FLOOR, vn);
          bodyHit(state, p, r, b.id);
          p.hits.push({ t: state.time, id: b.id, joules: Math.round(r.toB), broke: r.breaksB });
          if (p.hits.length > 32) p.hits.shift();
          if (b.rupa) {
            const at = p.pos.map((x, i) => (i === ax ? (side < 0 ? b.min[i] : b.max[i]) : clamp(x, b.min[i], b.max[i])));
            spend(state, b, r.toB, 'shot', p.id, { dir: [...p.vel], ax, side, at, cap, kind: 'body' });
            if (r.breaksB && !b.broken) (p.through || (p.through = new Set())).add(b.id);   // through its hole
          }
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
    if (!live.length && !R.panels.length) return;
    // a round meets an object's panels first (the nearest on its line); one that stops it spares what stands behind
    const stopped = new Set();
    if (R.panels.length) for (const e of state.entities) {
      const s = e.lastShot;
      if (!s || s.t !== state.time || !Array.isArray(s.from) || !Array.isArray(s.to)) continue;
      const d = [s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]], hit = panelOnRay(state, s.from, d, e.id, s.mode !== 'miss' ? s.targetId : null);
      if (!hit) continue;
      const D = panelBlow(state, hit.P, blowJoules('shot', R), 'shot', { dir: hit.dir, at: hit.at }, d);
      if (!(D.through > 0)) stopped.add(e.id);
    }
    for (const e of state.entities) {
      const s = e.lastShot;
      if (!s || s.t !== state.time || s.mode !== 'miss' || stopped.has(e.id)) continue;
      const b = live.find((q) => !q.broken && boxDist(q, s.to) <= EPS);
      if (b) spend(state, b, blowJoules('shot', R), 'shot', e.id, { dir: [s.to[0] - e.transform.pos[0], s.to[1] - e.transform.pos[1], s.to[2] - e.transform.pos[2]], at: boxNear(b, s.to) });
    }
    for (const u of state.bursts || []) {
      if (u.t !== state.time) continue;
      const J = blowJoules('burst', R, { radius: u.radius || 0 });
      for (const b of live) if (boxDist(b, u.pos) <= (u.radius || 0) + EPS) { const q = burstShare(b, u.pos, J); spend(state, b, q, 'burst', null, { from: u.pos }); warm(state, b, q * R.heatShare, null); }
      // a blast on a panel is a load across the whole plate, not a point: it dishes the plate in, as wide as it is
      for (const P of R.panels) {
        if (P.off) continue;
        const e = state.byId[P.of], o = toLocal(e, u.pos);
        if (boxDist(P, o) > (u.radius || 0) + EPS) continue;
        const ext = [0, 1, 2].map((k) => P.max[k] - P.min[k]), half = 0.5 * Math.min(...ext.filter((x, k) => k !== FACE_AX[P.face]));
        const c = toWorld(e, centre(P));
        panelBlow(state, P, burstShare(P, o, J), 'burst', { from: o, tool: { edge: 'blunt', strength: 1, contact: half } }, [c[0] - u.pos[0], c[1] - u.pos[1], c[2] - u.pos[2]]);
      }
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
        spend(state, b, blowJoules('swing', R), 'swing', e.id, { dir: [q[0] - o[0], q[1] - o[1], q[2] - o[2]], from: o, tool: e.rule && e.rule.strikeTool, by: e.id });
      }
      for (const Q of R.panels) {
        if (Q.off || Q.of === e.id || struck['panel:' + Q.id]) continue;
        const pe = state.byId[Q.of], lo = toLocal(pe, o);
        if (boxDist(Q, lo) > P.reach) continue;
        const q = toWorld(pe, boxNear(Q, lo)), v = [q[0] - o[0], q[1] - o[1]], flat = Math.hypot(v[0], v[1]);
        if (flat > 1e-3 && (v[0] * aim[0] + v[1] * aim[1]) / flat < P.cosCone) continue;
        struck['panel:' + Q.id] = true;
        const dw = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
        panelBlow(state, Q, blowJoules('swing', R), 'swing', { dir: turnTo(pe, dw, true), from: lo, tool: e.rule && e.rule.strikeTool, by: e.id }, dw);
      }
    }
  }, 34);
  // after the basic pass has dropped and landed: a landing is an impact (on the block below, or the floor), then the load
  // is worked out again
  // ── FELLING: what a level groove leaves standing. Above a groove the block and all it carries rest on the uncut wood,
  // the HINGE ([lo, hi] across the groove's axis, the block's width along the other). A stack whose centre of mass hangs
  // past the hinge's edge is held only by the hinge's tension, σt·b·h²/2 against W·(overhang); past that it tips. A
  // cut through leaves no tension: the top half tips if its centre of mass is off the stump. What tips FELLS: the block
  // above the cut and all it carries turn as one body about the hinge's edge under gravity (θ'' = M·g·rc·sin(θ + φ0) / I),
  // and lying, a quarter turn on, they land as boxes again (a quarter turn keeps a box a box), the fall's energy spent on
  // them as a landing. `state.rupa.fells: [{ ids, pivot, dir, theta, done }]` is what the page turns them by.
  const turn = (p, P, d, th) => {
    const v = [p[0] - P[0], p[1] - P[1], p[2] - P[2]], s0 = v[0] * d[0] + v[1] * d[1], l = [v[0] - s0 * d[0], v[1] - s0 * d[1]];
    const c = Math.cos(th), sn = Math.sin(th), s1 = s0 * c + v[2] * sn, z1 = -s0 * sn + v[2] * c;
    return [P[0] + l[0] + d[0] * s1, P[1] + l[1] + d[1] * s1, P[2] + z1];
  };
  const turnBox = (b, P, d) => {
    const pts = [];
    for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) pts.push(turn([x, y, z], P, d, Math.PI / 2));
    return { min: [0, 1, 2].map((k) => r6(Math.min(...pts.map((q) => q[k])))), max: [0, 1, 2].map((k) => r6(Math.max(...pts.map((q) => q[k])))) };
  };
  // the stack a block carries: it and every block resting on what is in it
  const carriedBy = (b, live) => { const out = [b], q = [b]; while (q.length) { const a = q.pop(); for (const s2 of live) if (!out.includes(s2) && restsOn(s2, a, TOUCH)) { out.push(s2); q.push(s2); } } return out; };
  // does a level groove (or a through cut's seat) on b let what is above it go? → { ax, sign, at, edge } or null
  function hingeOf(state, b, live) {
    const r = b.rupa, G = state.rupa.g;
    const grooves = (r.cuts || []).filter((c) => c.n === 2 && c.ax !== 2 && !c.through);
    const seat = b.parent && !grooves.length ? live.find((s2) => s2 !== b && s2.parent === b.parent && restsOn(b, s2, TOUCH)) : null;
    if (!grooves.length && !seat) return null;
    const at = grooves.length ? grooves.reduce((m, c) => (c.depth > m.depth ? c : m)).at : b.min[2];
    const top = carriedBy(b, live).filter((q) => q !== b);
    const share = grooves.length ? (b.max[2] - at) / (b.max[2] - b.min[2]) : 1, parts = [{ m: r.mass * share, c: [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (at + b.max[2]) / 2] }, ...top.map((q) => ({ m: q.rupa.mass, c: centre(q) }))];
    const M = parts.reduce((a, p) => a + p.m, 0), com = [0, 1, 2].map((k) => parts.reduce((a, p) => a + p.m * p.c[k], 0) / (M || 1)), W = M * G;
    for (const ax of [0, 1]) {
      let lo = b.min[ax], hi = b.max[ax];
      for (const c of grooves) if (c.ax === ax && Math.abs(c.at - at) < 0.02) { if (c.side < 0) lo = Math.max(lo, b.min[ax] + c.depth); else hi = Math.min(hi, b.max[ax] - c.depth); }
      if (seat) { lo = Math.max(lo, seat.min[ax]); hi = Math.min(hi, seat.max[ax]); }
      const m = 1 - ax, width = b.max[m] - b.min[m], h = Math.max(0, hi - lo), tension = seat ? 0 : r.tensile * width * h * h / 2;
      if (com[ax] > hi && W * (com[ax] - hi) > tension) return { ax, sign: 1, at, edge: hi, top, com, M };
      if (com[ax] < lo && W * (lo - com[ax]) > tension) return { ax, sign: -1, at, edge: lo, top, com, M };
    }
    return null;
  }
  function fell(state, b, H) {
    const R = state.rupa, live = () => state.breakables.filter((q) => !q.broken && q.rupa);
    // a groove: part the block on its plane first, so what turns is the block above it
    let upper = b;
    if (H.at > b.min[2] + 1e-6) {
      const left = Math.max(b.rupa.joules, 0.05 * b.rupa.cap);
      if (!cleaveBlock(state, b, 2, H.at, left, null)) return;
      upper = state.breakables.find((q) => q.id === `${b.id}/b`);
    }
    const ids = [upper.id, ...H.top.map((q) => q.id)], group = ids.map((id) => state.breakables.find((q) => q.id === id));
    const d = H.ax === 0 ? [H.sign, 0] : [0, H.sign], P = H.ax === 0 ? [H.edge, (upper.min[1] + upper.max[1]) / 2, H.at] : [(upper.min[0] + upper.max[0]) / 2, H.edge, H.at];
    let I = 0, M = 0, cs = 0, cz = 0;
    for (const q of group) {
      const c = centre(q), m = q.rupa.mass, s0 = (c[0] - P[0]) * d[0] + (c[1] - P[1]) * d[1], z0 = c[2] - P[2];
      const ds = Math.abs(d[0]) * (q.max[0] - q.min[0]) + Math.abs(d[1]) * (q.max[1] - q.min[1]), dz = q.max[2] - q.min[2];
      I += m * (s0 * s0 + z0 * z0 + (ds * ds + dz * dz) / 12); M += m; cs += m * s0; cz += m * z0;
    }
    cs /= M || 1; cz /= M || 1;
    for (const q of group) { q.fell = R.fellSeq; const k = state.colliders.indexOf(q.collider); if (k >= 0) state.colliders.splice(k, 1); }
    R.fells.push({ seq: R.fellSeq++, t: state.time, ids, pivot: P.map(r6), dir: [d[0], d[1], 0], theta: 0, omega: 0, I, M, rc: Math.hypot(cs, cz), phi0: Math.atan2(cs, cz), z0: cz + P[2], done: false, slide: 0 });
    state.settleDirty = true;   // a felling is no break: the blocks stay whole (the page reads it off fells)
  }
  // order 35: the felled turn, and land a quarter turn on
  E.registerWorldPass('rupa-fell', (state, input, dt) => {
    const R = state.rupa;
    if (!R || !R.fells.some((f) => !f.done)) return;
    for (const f of R.fells) {
      if (f.done) continue;
      f.omega += ((f.M * R.g * f.rc * Math.sin(f.theta + f.phi0)) / (f.I || 1)) * dt;
      f.theta = Math.min(Math.PI / 2, f.theta + f.omega * dt);
      if (f.theta < Math.PI / 2) continue;
      f.done = true; f.landedAt = state.time;
      const group = f.ids.map((id) => state.breakables.find((q) => q.id === id)).filter((q) => q && !q.broken);
      const boxes = group.map((q) => turnBox(q, f.pivot, f.dir)), ax = f.dir[0] ? 0 : 1, sg = f.dir[ax];
      // it comes down clear of what it turned over (the stump it hinged on): slid on along its fall by what it lies in
      let slide = 0;
      for (const B of boxes) for (const s2 of state.breakables) {
        if (s2.broken || s2.fell != null || !s2.rupa || [0, 1, 2].some((k) => B.max[k] <= s2.min[k] + 1e-6 || B.min[k] >= s2.max[k] - 1e-6)) continue;
        slide = Math.max(slide, sg > 0 ? s2.max[ax] - B.min[ax] : B.max[ax] - s2.min[ax]);
      }
      let zAfter = 0, M = 0;
      for (let i = 0; i < group.length; i++) {
        const q = group[i], B = boxes[i], lift = Math.max(0, state.breakFloor - B.min[2]);
        B.min[2] += lift; B.max[2] += lift; B.min[ax] = r6(B.min[ax] + sg * slide); B.max[ax] = r6(B.max[ax] + sg * slide);
        const r = q.rupa;
        // its marks turn with it
        for (const dn of r.dents || []) { const nrm = [0, 0, 0]; nrm[dn.ax] = dn.side; const o = turn([0, 0, 0], [0, 0, 0], f.dir, Math.PI / 2), t1 = turn(nrm, [0, 0, 0], f.dir, Math.PI / 2).map((x, i) => x - o[i]); dn.ax = [0, 1, 2].reduce((a, k) => (Math.abs(t1[k]) > Math.abs(t1[a]) ? k : a), 0); dn.side = t1[dn.ax] > 0 ? 1 : -1; dn.at = turn(dn.at, f.pivot, f.dir, Math.PI / 2); dn.at[2] += lift; dn.at[ax] += sg * slide; }
        r.cuts = [];
        for (let k = 0; k < 3; k++) { q.min[k] = B.min[k]; q.max[k] = B.max[k]; }
        if (!r.dents) Object.assign(r, { dents: [], cuts: [], squash: 0, form: 0, yield: r.yield || 0, kerfWork: r.kerfWork || 0, kerfHard: r.kerfHard || 0, wall: r.wall ?? null });
        r.form = (r.form || 0) + 1;
        delete q.fell; q.falling = null; q.landed = null;
        if (!state.colliders.includes(q.collider)) state.colliders.push(q.collider);
        zAfter += r.mass * centre(q)[2]; M += r.mass;
      }
      // the fall's energy, the drop of its centre of mass, spent on what fell as a landing, each by its share of the mass
      const E0 = f.M * R.g * Math.max(0, f.z0 - zAfter / (M || 1));
      for (const q of group) spend(state, q, (E0 * q.rupa.mass) / (M || 1), 'fall', null, { ax: 2, side: -1, at: [(q.min[0] + q.max[0]) / 2, (q.min[1] + q.max[1]) / 2, q.min[2]], tool: null });
      f.slide = r6(slide);
      state.settleDirty = true; R.seq = -1;
    }
  }, 35);
  E.registerWorldPass('rupa-load', (state) => {
    if (!state.rupa) return;
    const R = state.rupa;
    let changed = R.seq !== state.breakSeq;
    for (const b of state.breakables) {
      if (b.broken || !b.rupa || !b.landed || b.landed.t !== state.time || b.landed.speed <= 0) continue;
      changed = true;
      const under = b.landed.on != null ? state.breakables.find((q) => q.id === b.landed.on && !q.broken) : null;
      const r = impact({ mass: b.rupa.mass, stiff: b.rupa.stiff, bounce: b.rupa.bounce }, under && under.rupa ? targetOf(under) : FLOOR, b.landed.speed);
      const foot = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]];
      spend(state, b, r.toA, 'fall', null, { ax: 2, side: -1, at: foot });
      if (under && under.rupa) spend(state, under, r.toB, 'crush', b.id, { ax: 2, side: 1, at: foot });
    }
    if (!changed) return;
    const live = state.breakables.filter((b) => !b.broken && !b.falling && b.rupa && b.fell == null);
    const afloat = (b) => R.pools.reduce((m, pool) => (inPool(b, pool) ? m - pool.density * submerged(b, pool.max[2]) : m), b.rupa.mass);
    const boxes = live.map((b) => ({ min: b.min, max: b.max, mass: Math.max(0, afloat(b)), compressive: b.rupa.compressive, lateral: b.bond === 'lateral', bond: b.rupa.cohesion, left: (b.rupa.cap > 0 ? Math.max(0, b.rupa.joules) / b.rupa.cap : 1) * heatFactor(b.rupa.ignite != null ? Math.min(b.rupa.T, b.rupa.ignite) : b.rupa.T, b.rupa.soften, b.rupa.melt, b.rupa.T0), ref: b }));
    const fixed = state.colliders.filter((c) => c.blk == null);
    const L = loadPass(boxes, { fixed, floor: state.breakFloor, g: R.g, touch: TOUCH });
    for (const x of L.crush) breakIt(state, x.ref, 'crush', null);
    for (const grp of L.span) for (const x of grp) if (!x.ref.broken) { x.ref.bond = null; state.settleDirty = true; }
    // felling: a level groove's hinge, or a through cut's seat, that no longer holds what is above it
    for (const b of live) {
      if (b.broken || b.fell != null || !b.rupa.cuts) continue;
      const H = hingeOf(state, b, live.filter((q) => !q.broken && q.fell == null));
      if (H) fell(state, b, H);
    }
    R.seq = state.breakSeq;
  }, 36);
  // ── WIND LOAD (order 37, a few times a second while the wind blows): the wind's pressure on each exposed face,
  // Cp·½ρu² (Cp 1.3: the push on the windward face and the pull on the lee, scaled by a porous block's drag), u the wind
  // where the block stands, in the wake of whatever is upwind of it (a block against another stands in its still air). At each joint a stack is tipped by the wind's moment about its
  // downwind edge and slid by its push, and held by its weight (W·half its depth; μW) and, at a mortared joint, by the
  // joint's cohesion (its bending section b·t²/6; its area). A stack that goes leaves the structure as falling bodies. ──
  const MU = 0.6, CP = 1.3;
  E.registerWorldPass('rupa-wind', (state) => {
    const R = state.rupa;
    if (!R || !R.wind || state.time - R.windAt < 0.25) return;
    R.windAt = state.time;
    // (a tree's own law is its storm's, rupa-trees: its trunk is one piece of wood on its roots, not a stack)
    const d = R.wind.dir, live = state.breakables.filter((b) => !b.broken && !b.falling && b.rupa && b.bond !== 'lateral' && !(R.treeOf && R.treeOf[b.id]));
    if (!live.length) return;
    const across = (b) => Math.abs(d[0]) * (b.max[1] - b.min[1]) + Math.abs(d[1]) * (b.max[0] - b.min[0]);
    const depth = (b) => Math.abs(d[0]) * (b.max[0] - b.min[0]) + Math.abs(d[1]) * (b.max[1] - b.min[1]);

    // each block feels the wind where it stands, in whatever wake is upwind of it (a block against another is in its
    // still air), and takes from it what its porosity lets it: CP for a solid face, scaled by blockDrag for a porous one
    const force = new Map(live.map((b) => {
      const u = Math.hypot(...windHere(state, [(b.min[0] + b.max[0]) / 2 - d[0] * 1e-3, (b.min[1] + b.max[1]) / 2 - d[1] * 1e-3, (b.min[2] + b.max[2]) / 2]));
      return [b, pressure(R.air, { flow: u, cp: CP * (blockDrag(b.rupa.porosity) / 1.2) }) * across(b) * (b.max[2] - b.min[2])];
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
  // ── TREES IN A STORM (order 37.2, a few times a second while the wind blows): a tree (rupa/tree-blocks.js: its trunk in
  // courses, its crown on it, the wind that snaps it from its plant form at its height) whose gust at its crown passes
  // that speed is thrown downwind about its foot, its whole length turning as a felled stack does (fell); one whose foot
  // is already gone, or that has fallen, is left to the rest of the physics ──
  E.registerWorldPass('rupa-trees', (state) => {
    const R = state.rupa;
    if (!R || !R.wind || !R.trees.length || state.time - R.treesAt < 0.25) return;
    R.treesAt = state.time;
    for (const T of R.trees) {
      if (T.snapped) continue;
      const foot = state.breakables.find((q) => q.id === T.foot);
      if (!foot || foot.broken || foot.fell != null || foot.falling || !foot.rupa) continue;
      const u = windAt(R.wind, T.crown, state.time), speed = Math.hypot(u[0], u[1]);
      if (speed <= T.breakSpeed) continue;
      const ax = Math.abs(u[0]) >= Math.abs(u[1]) ? 0 : 1, sign = u[ax] >= 0 ? 1 : -1;
      const top = T.blocks.filter((id) => id !== T.foot).map((id) => state.breakables.find((q) => q.id === id)).filter((q) => q && !q.broken && q.fell == null && q.rupa);
      T.snapped = { t: state.time, speed, dir: [u[0] / speed, u[1] / speed] };
      const n = R.fells.length;
      fell(state, foot, { at: foot.min[2], ax, sign, edge: sign > 0 ? foot.max[ax] : foot.min[ax], top });
      // the gust has done the first of it: its weight carried just past the edge it turns on (a slim trunk's few hundredths
      // of a radian), and the crown already moving as the drag that snapped it leaves it; gravity takes it from there
      const F = R.fells[n];
      if (F) { F.theta = Math.max(0, -F.phi0) + 0.01; F.omega = Math.max(F.omega, 0.3); }
    }
  }, 37.2);

  // ── SCARS (order 34.5, after the projectiles and the blows): cosmetic damage, on a map that may not change. A burst
  // near the floor PAINTS the crater it would dig (craterSize from its energy, coupled less the higher it went off, in the
  // ground's soil) and the dirt it would throw (dirt); every fixed wall within its reach is SCORCHED by its share
  // (scarOf: the bowl its share would crush, the disc its reach blackens), and what spalls off flies; a round that stops on a wall or the floor CHIPS it. The colliders, the floor and
  // the footing are never touched: the marks are `state.rupa.scars.marks`, seq-keyed, for the page to paint ──
  const SCAR_KEEP = 96;
  function scar(state, mark) {
    const S = state.rupa.scars;
    S.marks.push({ seq: S.seq++, t: state.time, ...mark });
    if (S.marks.length > SCAR_KEEP) S.marks.shift();
  }
  // the face of a box nearest a point: where on it, and which way it faces
  function faceToward(c, p) {
    const q = [0, 1, 2].map((k) => clamp(p[k], c.min[k], c.max[k])), d = [0, 1, 2].map((k) => p[k] - q[k]);
    let ax = 0;
    for (let k = 1; k < 3; k++) if (Math.abs(d[k]) > Math.abs(d[ax])) ax = k;
    if (Math.hypot(...d) < 1e-9) ax = 2;
    const n = [0, 0, 0]; n[ax] = d[ax] >= 0 ? 1 : -1;
    const size = Math.min(...[0, 1, 2].filter((k) => k !== ax).map((k) => c.max[k] - c.min[k]));
    return { at: q, normal: n, size, thick: c.max[ax] - c.min[ax] };
  }
  const fixedOf = (state) => state.colliders.filter((c) => c.blk == null && !String(c.of || '').startsWith('bound:'));
  // the matter a point on a wall is marked as: the wall of its own it falls in (`scars.walls`, by its box), else the world's
  const ownWall = (S, p) => { const o = S.walls && S.walls.find((q) => boxDist(q, p) <= EPS); return o ? o.wall : S.wall; };
  E.registerWorldPass('rupa-scars', (state) => {
    const R = state.rupa;
    if (!R || !R.scars) return;
    const S = R.scars, floor = state.breakFloor ?? 0;
    for (const u of state.bursts || []) {
      if (u.t !== state.time) continue;
      const J = blowJoules('burst', R, { radius: u.radius || 0 }), h = u.pos[2] - floor, r = u.radius || 0;
      if (S.ground && h < r) {
        const C = craterSize(J * (1 - Math.max(0, h) / r), S.ground.dig), at = [u.pos[0], u.pos[1], floor];
        const D = S.ground.density ? dirt({ radius: C.radius, ejected: C.volume * (S.ground.swell ?? 1.2) }, { at, joules: J, soil: S.ground, z: floor + 0.05, seed: seedOf('crater', S.seq), packets: 24 }) : null;
        scar(state, { kind: 'crater', at, radius: C.radius, depth: C.depth, rim: 3 * C.radius, debris: D });
      }
      if (!S.wall) continue;
      // (a wall of its own matter, `scars.walls`: the box it stands in; any other as the world's walls)
      for (const c of fixedOf(state)) {
        if (boxDist(c, u.pos) > r + EPS) continue;
        const f = faceToward(c, u.pos), q = burstShare(c, u.pos, J), d = boxDist(c, u.pos);
        if (q < 1) continue;
        scar(state, { on: c.of ?? null, ...scarOf(f.at, f.normal, q, ownWall(S, [0, 1, 2].map((k) => (c.min[k] + c.max[k]) / 2)), { how: 'burst', from: u.pos, seed: seedOf(String(c.of), S.seq), faceSize: f.size, thick: f.thick, reach: Math.sqrt(Math.max(0, r * r - d * d)) }) });
      }
    }
    for (const e of state.entities) {
      const sh = e.lastShot;
      if (!sh || sh.t !== state.time || sh.mode !== 'miss' || !sh.to) continue;
      const J = blowJoules('shot', R), dir = [sh.to[0] - e.transform.pos[0], sh.to[1] - e.transform.pos[1], sh.to[2] - e.transform.pos[2]];
      const c = S.wall && fixedOf(state).find((x) => boxDist(x, sh.to) <= EPS);
      if (c) { const f = faceToward(c, e.transform.pos); scar(state, { on: c.of ?? null, ...scarOf(sh.to, f.normal, J, ownWall(S, sh.to), { how: 'shot', dir, seed: seedOf(String(c.of), S.seq), faceSize: f.size, thick: f.thick }) }); }
      else if (S.ground && Math.abs(sh.to[2] - floor) < 0.1) { const C = craterSize(J, S.ground.dig); scar(state, { kind: 'pock', at: [sh.to[0], sh.to[1], floor], radius: Math.max(0.04, C.radius), depth: C.depth, debris: null }); }
    }
  }, 34.5);
  // ── GROUND (order 34.6): a burst near the land digs its crater there (less the higher it went off, none above its own
  // radius); and what stood on land that went comes down to it: a footing (a building's, a tree's roots) whose ground is
  // lower now drops to it, and what it carried settles ──
  E.registerWorldPass('rupa-ground', (state) => {
    const R = state.rupa, Gd = R && R.ground;
    if (!Gd) return;
    for (const u of state.bursts || []) {
      if (u.t !== state.time) continue;
      const r = u.radius || 0, gz = groundZ(Gd, u.pos[0], u.pos[1]), h = u.pos[2] - gz;
      if (!(h < r)) continue;
      const J = blowJoules('burst', R, { radius: r }) * (1 - Math.max(0, h) / r), c = groundCrater(Gd, [u.pos[0], u.pos[1]], J);
      // (and the dirt it throws, by the dirt law: clumps, spray and dust from its own soil, seeded by the crater)
      if (c && !c.small && c.removed > 0) {
        const at = [u.pos[0], u.pos[1], gz], debris = c.soil.grain ? dirt({ radius: c.radius, ejected: c.ejected }, { at, joules: J, soil: c.soil, z: gz + 0.05, seed: seedOf('ground', R.craterSeq), packets: 24 }) : null;
        R.craters.push({ seq: R.craterSeq++, t: state.time, at, radius: c.radius, depth: c.depth, ...(debris ? { debris } : {}) });
        if (R.craters.length > 64) R.craters.shift();
      }
    }
    if (Gd.version === Gd.seen) return;
    Gd.seen = Gd.version;
    for (const c of R.footings) {
      const pts = [[c.min[0], c.min[1]], [c.max[0], c.min[1]], [c.min[0], c.max[1]], [c.max[0], c.max[1]], [(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2]];
      const low = Math.min(...pts.map(([x, y]) => groundZ(Gd, x, y)));
      if (low < c.max[2] - TOUCH) { const d = c.max[2] - low; c.min[2] -= d; c.max[2] -= d; state.settleDirty = true; R.seq = -1; }
    }
  }, 34.6);
  // ── WATER (order 34.7): rain falls on the land (mm/h, the page's weather, × rainTime); the blocks on it are raised
  // ground; what changed sets the water moving, and it runs until it is still. Where it stands against a block, its push
  // breaches what cannot hold it ──
  const RAIN_MM = { drizzle: 0.5, rain: 5, downpour: 25, thunderstorm: 50 };
  E.rupaRain = RAIN_MM;
  E.registerWorldPass('rupa-water', (state, input, dt) => {
    const R = state.rupa, Gd = R && R.ground;
    if (!Gd || !Gd.w) return;
    if (R.rain > 0) {
      const add = (R.rain / 3.6e6) * R.rainTime * dt;
      for (let k = 0; k < Gd.w.length; k++) if (Gd.cells[Math.min(Math.floor(k / Gd.nx), Gd.ny - 2) * (Gd.nx - 1) + Math.min(k % Gd.nx, Gd.nx - 2)] !== 255) Gd.w[k] += add;
      Gd.flowing = true; Gd.calm = 0;
    }
    if (state.breakSeq !== Gd.barSeq || Gd.version !== Gd.wGround) {
      const first = Gd.barSeq === -1;   // (the bars laid at the start set nothing moving: the lake was laid at rest)
      waterBars(state, Gd); Gd.barSeq = state.breakSeq; Gd.wGround = Gd.version;
      if (!first) { Gd.flowing = true; Gd.calm = 0; }
    }
    // the push on what holds it, twice a second: each block standing on the land, across its thinner side; it stands on
    // the land unmortared, so what holds it is its weight's friction (μ 0.6)
    if (Math.floor(state.time * 2) !== Math.floor((state.time - dt) * 2)) for (const b of state.breakables) {
      if (b.broken || b.falling || b.fell != null || !b.rupa) continue;
      const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2], ax = b.max[0] - b.min[0] <= b.max[1] - b.min[1] ? 0 : 1;
      if (b.min[2] > groundZ(Gd, c[0], c[1]) + 0.3) continue;
      const side = (sg) => { const p = c.slice(); p[ax] = sg < 0 ? b.min[ax] - Gd.dx : b.max[ax] + Gd.dx; return Math.max(0, groundZ(Gd, p[0], p[1], 'w')); };
      const d1 = side(-1), d2 = side(1), hi = Math.max(d1, d2), lo = Math.min(d1, d2);
      if (hi < 0.05) continue;
      const push = 0.5 * WATER_RHO * G * (hi * hi - lo * lo) * (b.max[1 - ax] - b.min[1 - ax]);
      if (push > 0.6 * b.rupa.mass * G) breakIt(state, b, 'water', null);
    }
    if (!Gd.flowing) return;
    const moved = waterStep(Gd, dt);
    Gd.wVersion++;
    Gd.calm = moved < 1e-4 ? Gd.calm + dt : 0;
    if (Gd.calm > 2 && !Gd.running) Gd.flowing = false;
  }, 34.7);
}
