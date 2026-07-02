/**
 * create_mechanics_view — mint a classical-Newtonian MECHANICS depictor: a solid object MOVING
 * along its real trajectory in the traversable three.js World, with live velocity/acceleration
 * vectors and a numeric readout.
 *
 * Same fractal-generation philosophy as create_atom_view / create_cellular_view: the operator passes
 * a tiny RECIPE (a scenario + a few physical params); the substrate stores ONLY that recipe as a
 * sketch manifest (`kind: 'mechanics-view'`, no geometry) and regenerates the simulation on render.
 * The body shape is OUTPUT through the workbench monomer machinery; the motion rides emitThreeWorld's
 * mover channel — the trajectory is sampled at equal TIME steps, so the body visibly accelerates.
 *
 * Orbit-only object study (like atom-view / cellular-view) — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planMechanicsScene, MECHANICS_SCENARIOS } from '@/lib/graph/views/science/mechanics-view';

export function mintMechanicsView({ title, scenario, v0, angle, g, mu, length, height, mass, k, amplitude, radius, m1, m2, u1, u2, e, compare, g2, mass2, efficiency, armEffort, armLoad, leverClass, rWheel, rAxle, ropes, pulleyType, thickness, pitch, crankRadius, rodLength, flywheelR, rpm, scale, vectors, trace, strobe, strobeEvery, energy, forces, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'mechanics-view',
    scenario: MECHANICS_SCENARIOS.includes(scenario) ? scenario : 'projectile',
    ...(Number.isFinite(+v0) ? { v0: +v0 } : {}),
    ...(Number.isFinite(+angle) ? { angle: +angle } : {}),
    ...(Number.isFinite(+g) ? { g: +g } : {}),
    ...(Number.isFinite(+mu) ? { mu: +mu } : {}),
    ...(Number.isFinite(+length) ? { length: +length } : {}),
    ...(Number.isFinite(+height) ? { height: +height } : {}),
    ...(Number.isFinite(+mass) ? { mass: +mass } : {}),
    ...(Number.isFinite(+k) ? { k: +k } : {}),
    ...(Number.isFinite(+amplitude) ? { amplitude: +amplitude } : {}),
    ...(Number.isFinite(+radius) ? { radius: +radius } : {}),
    ...(Number.isFinite(+m1) ? { m1: +m1 } : {}),
    ...(Number.isFinite(+m2) ? { m2: +m2 } : {}),
    ...(Number.isFinite(+u1) ? { u1: +u1 } : {}),
    ...(Number.isFinite(+u2) ? { u2: +u2 } : {}),
    ...(Number.isFinite(+e) ? { e: +e } : {}),
    ...(compare === 'gravity' || compare === 'mass' ? { compare } : {}),
    ...(Number.isFinite(+g2) ? { g2: +g2 } : {}),
    ...(Number.isFinite(+mass2) ? { mass2: +mass2 } : {}),
    ...(Number.isFinite(+efficiency) ? { efficiency: +efficiency } : {}),   // simple-machine params
    ...(Number.isFinite(+armEffort) ? { armEffort: +armEffort } : {}),
    ...(Number.isFinite(+armLoad) ? { armLoad: +armLoad } : {}),
    ...([1, 2, 3].includes(+leverClass) ? { leverClass: +leverClass } : {}),
    ...(Number.isFinite(+rWheel) ? { rWheel: +rWheel } : {}),
    ...(Number.isFinite(+rAxle) ? { rAxle: +rAxle } : {}),
    ...(Number.isFinite(+ropes) ? { ropes: +ropes } : {}),
    ...(['fixed', 'movable', 'compound'].includes(pulleyType) ? { pulleyType } : {}),
    ...(Number.isFinite(+thickness) ? { thickness: +thickness } : {}),
    ...(Number.isFinite(+pitch) ? { pitch: +pitch } : {}),
    ...(Number.isFinite(+crankRadius) ? { crankRadius: +crankRadius } : {}),   // engine params
    ...(Number.isFinite(+rodLength) ? { rodLength: +rodLength } : {}),
    ...(Number.isFinite(+flywheelR) ? { flywheelR: +flywheelR } : {}),
    ...(Number.isFinite(+rpm) ? { rpm: +rpm } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(vectors === false ? { vectors: false } : {}),
    ...(trace === false ? { trace: false } : {}),
    ...(strobe === false ? { strobe: false } : {}),
    ...(Number.isFinite(+strobeEvery) ? { strobeEvery: +strobeEvery } : {}),
    ...(energy === false ? { energy: false } : {}),
    ...(forces === true ? { forces: true } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  // Resolve once to validate the recipe is renderable + return a kinematics readout (no geometry is
  // persisted — only the recipe above is stored).
  const plan = planMechanicsScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — mechanics`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats: { scenario: plan.stats.scenario, g: plan.stats.g, flightTime: +plan.stats.T.toFixed(3), loop: plan.stats.loop, faces: plan.faces.length },
  };
}

export async function createMechanicsViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_mechanics_view requires a recipe object');
  }
  const { title, scenario, v0, angle, g, mu, length, height, mass, k, amplitude, radius, m1, m2, u1, u2, e, compare, g2, mass2, efficiency, armEffort, armLoad, leverClass, rWheel, rAxle, ropes, pulleyType, thickness, pitch, crankRadius, rodLength, flywheelR, rpm, scale, vectors, trace, strobe, strobeEvery, energy, forces, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintMechanicsView({ title, scenario, v0, angle, g, mu, length, height, mass, k, amplitude, radius, m1, m2, u1, u2, e, compare, g2, mass2, efficiency, armEffort, armLoad, leverClass, rWheel, rAxle, ropes, pulleyType, thickness, pitch, crankRadius, rodLength, flywheelR, rpm, scale, vectors, trace, strobe, strobeEvery, energy, forces, viewBox, scene, ref, folderRef });
}

export function registerMechanicsViewTools() {
  registerTool({
    name: 'create_mechanics_view',
    description:
      "Mint an interactive classical-Newtonian MECHANICS depictor — a science/education viewer where a "
      + "solid OBJECT actually MOVES along its real trajectory (not a static diagram). Four scenarios: "
      + "'projectile' (a launched ball's parabolic arc — vx constant, vz accelerating under gravity), "
      + "'free-fall' (a body dropped from a height under constant a = g), 'inclined-plane' (a ball "
      + "released down a ramp of angle α with friction μ → a = g(sinα − μcosα)), 'pendulum' (a bob "
      + "swinging on a string, integrated HONESTLY so the large-angle swing slows correctly), 'spring' "
      + "(a mass on a spring in simple harmonic motion, F = −kx, with KE↔elastic-PE exchange), 'circular' "
      + "(uniform circular motion at constant speed — the centripetal acceleration v²/R always points to "
      + "the centre, showing acceleration ≠ speeding up), and "
      + "'collision' (two bodies on a track that collide and separate by conservation of momentum + a "
      + "restitution e — e=1 elastic, e=0 perfectly inelastic/stick; a two-body SYSTEM readout shows total "
      + "momentum p staying CONSTANT while KE holds or drops). Plus the six classical SIMPLE MACHINES — "
      + "'lever' (a beam on a fulcrum, MA = effort arm / load arm; classes 1/2/3 via leverClass), "
      + "'wheel-axle' (MA = wheel radius / axle radius), 'pulley' (fixed/movable/compound via pulleyType, "
      + "MA = supporting rope falls), 'incline' (an inclined plane as a machine, MA = length / height = "
      + "1/sinα), 'wedge' (MA = length / thickness) and 'screw' (MA = 2π·radius / pitch) — each a quasi-"
      + "static depictor of MECHANICAL ADVANTAGE and the CONSERVATION OF WORK: the load moves a short "
      + "distance with a large force while the effort moves a long distance with a small force, and the "
      + "WORK BARS show W_in = W_out (a machine multiplies force, never work; pass efficiency<1 to open a "
      + "friction-loss gap). Plus COMPOUND machines that chain simple machines in series so MA MULTIPLIES — "
      + "'gear-train' (a hand-cranked two-stage gear reduction driving a load drum, MA = ratio₁·ratio₂·"
      + "windlass), 'screw-jack' (a lever arm turning a screw, MA = 2π·arm/pitch — a tiny effort lifts a "
      + "great weight) and 'crane' (a crank wheel-axle feeding a movable pulley) — each showing 'MA = MA₁ × "
      + "MA₂ = total' with work still conserved end-to-end. Plus a reciprocating ENGINE — 'steam-engine', "
      + "the classic SLIDER-CRANK: a piston's reciprocating motion is converted to a crankshaft's rotary "
      + "motion through a connecting rod, with a heavy flywheel that carries the crank through the dead-"
      + "centres where the piston momentarily stops — and 'combustion', a single-cylinder 4-stroke (Otto) "
      + "engine in cutaway running the full intake → compression → power → exhaust cycle over two crank "
      + "revolutions, with poppet intake/exhaust valves that breathe on cue and a spark that fires at the "
      + "power stroke — and 'inline-four', an INLINE-4 of four phased slider-cranks on a single crankshaft "
      + "(throws at 0°/180°/180°/0°) firing 1-3-4-2 so a power stroke lands every half-revolution and the "
      + "pistons cascade (exact slider-crank kinematics, looping). And — a different domain entirely — "
      + "'dc-motor', a brushed DC ELECTRIC motor: a current-carrying armature coil spinning between N/S "
      + "stator poles by the motor effect (F = I L × B), shown with the magnetic field N→S, the force "
      + "couple that makes the torque, and a split-ring commutator that flips the current each half-turn so "
      + "the rotation never reverses (electromagnetism, not a mechanical linkage) — and 'ac-motor', an AC "
      + "INDUCTION motor: 3-phase stator windings make a magnetic field that ROTATES, a squirrel-cage rotor "
      + "chases it but never catches up (the lag is slip), and the rotor current is INDUCED with no brushes "
      + "or commutator at all. Plus 'drone' — a QUADCOPTER held aloft by Newtonian force balance: four "
      + "spinning rotors make thrust, and the whole craft's vertical motion is integrated from a = (ΣT − "
      + "mg)/m, so it climbs when lift > weight and HOVERS when total lift = weight (ΣF = 0); the free-body "
      + "diagram shows the lift and weight arrows and the readout the running balance — and 'drone-flight', "
      + "the same craft TRAVERSING a route through changing air (climb → cruise → a headwind it pitches into "
      + "→ a thermal updraft → a gust → descent), the wind in each zone drawn through the field channel and "
      + "the drone tilting its thrust vector to fly the line. And 'submarine' — the WATER twin of the drone: "
      + "the same ΣF = ma, but the up force is Archimedes' BUOYANCY (fixed, B = ρVg) and the crew controls "
      + "WEIGHT via ballast, so it dives by flooding the tanks (W > B), rises by blowing them (W < B), and "
      + "holds depth at neutral trim (W = B); shown with the buoyancy-vs-weight free-body, a translucent "
      + "water column with surface and seabed, a spinning screw, and a CUTAWAY BALLAST TANK whose water "
      + "level visibly floods (dive) and blows (rise) — the actual mechanism. The "
      + "trajectory is sampled at equal TIME steps, so the body visibly speeds up where it accelerates; "
      + "live velocity (green) and acceleration (orange) vector arrows + a numeric readout (v, a, g, t) "
      + "overlay the motion. The body shape is OUTPUT through the workbench monomer machinery. Served as "
      + "a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to "
      + "zoom); CLICK the body for its facts. You pass a tiny recipe (a scenario + a few params); the "
      + "substrate stores ONLY the recipe (`manifest.kind === 'mechanics-view'`, no geometry) and "
      + "regenerates the simulation on render — same params → same motion. ORBIT-ONLY object study: no "
      + "CSS-3D `/scene` form; open the worldUrl. Reach for this on framing like 'show me projectile "
      + "motion / visualize acceleration / a pendulum I can watch / depict gravity / Newtonian motion in "
      + "3D'. (Gravity-as-ORBIT — planets circling a star — is create_planetary, not this; this is the "
      + "constant-g ground frame.)",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...MECHANICS_SCENARIOS], description: "Which fundamental to depict (default 'projectile'). Dynamics: 'projectile', 'free-fall', 'inclined-plane', 'pendulum', 'spring', 'circular', 'collision'. Simple machines (mechanical advantage + work bars): 'lever', 'wheel-axle', 'pulley', 'incline', 'wedge', 'screw'. Compound machines (MA multiplies through the chain): 'gear-train' (a geared winch), 'screw-jack' (lever + screw), 'crane' (wheel-axle + movable pulley). Engines (reciprocating mechanisms): 'steam-engine' (a horizontal slider-crank converting piston reciprocation to crankshaft rotation, with a flywheel), 'combustion' (a vertical single-cylinder 4-stroke in cutaway — intake/compression/power/exhaust over two revolutions, with poppet valves and a power-stroke spark), 'inline-four' (an inline-4: four phased slider-cranks on one crankshaft firing 1-3-4-2, a power stroke every half-revolution). Electric motors (electromagnetism, not linkages): 'dc-motor' (a brushed DC motor — a current-carrying armature coil spinning between N/S poles by the motor effect F=I L×B, with the force couple, the field, and a commutator), 'ac-motor' (an AC induction motor — 3-phase windings make a rotating magnetic field that a squirrel-cage rotor chases but never catches; the lag is slip, the rotor current is induced, and there are no brushes). Flight: 'drone' (a quadcopter held aloft by Newtonian force balance — four spinning rotors produce thrust, and it climbs/hovers/descends as total lift compares to weight, ΣF = ma; the free-body diagram shows lift vs weight), 'drone-flight' (the same drone TRAVERSING a route through changing air — climb, cruise, a headwind it pitches into, a thermal updraft, a gust, then a descent; the wind zones render through the field channel and the craft pitches to fly the line), 'submarine' (the WATER twin of the drone — buoyancy: a sub dives by flooding ballast (W > B), rises by blowing it (W < B), and holds depth at neutral (W = B), with the buoyancy-vs-weight free-body, a translucent water column, and a spinning screw)." },
        v0: { type: 'number', description: 'Initial / launch speed in m/s (projectile; default 18).' },
        angle: { type: 'number', description: 'Angle in degrees — projectile launch angle, inclined-plane ramp angle, or pendulum release angle (scenario-dependent defaults).' },
        g: { type: 'number', description: 'Gravitational acceleration m/s² (default 9.8 — Earth; lower it for Moon/Mars to compare).' },
        mu: { type: 'number', description: 'Coefficient of friction for the inclined plane (default 0.1; 0 = frictionless).' },
        length: { type: 'number', description: 'Length in m — pendulum string length, or inclined-plane ramp length.' },
        height: { type: 'number', description: 'Drop height in m for free-fall (default 20).' },
        mass: { type: 'number', description: 'Body mass in kg for the energy readout (default 1; scales KE/PE, does not change the trajectory).' },
        k: { type: 'number', description: "Spring: stiffness in N/m (default 12). Sets the SHM frequency ω = √(k/m)." },
        amplitude: { type: 'number', description: "Spring: oscillation amplitude in m (default 6)." },
        radius: { type: 'number', description: "Circular motion: radius in m (default 10). Centripetal acceleration is v²/radius." },
        m1: { type: 'number', description: "Collision: mass of body 1 (the left/faster body) in kg (default 1)." },
        m2: { type: 'number', description: "Collision: mass of body 2 (the right body) in kg (default 1)." },
        u1: { type: 'number', description: "Collision: initial velocity of body 1 in m/s (default 5; must exceed u2 so they close)." },
        u2: { type: 'number', description: "Collision: initial velocity of body 2 in m/s (default 0; negative for a head-on approach)." },
        e: { type: 'number', description: "Collision: coefficient of restitution 0–1 (default 1 = elastic / KE conserved; 0 = perfectly inelastic / they stick)." },
        compare: { type: 'string', enum: ['gravity', 'mass'], description: "Comparison mode (for projectile/free-fall/inclined-plane/pendulum): run the scenario twice side-by-side in two depth lanes. 'gravity' = Earth-g vs Moon-g (the slower body lands later); 'mass' = light vs heavy moving in lockstep (Galileo: mass cancels)." },
        g2: { type: 'number', description: "Comparison 'gravity': the second body's gravitational acceleration in m/s² (default 1.62 = Moon)." },
        mass2: { type: 'number', description: "Comparison 'mass': the second body's mass in kg (default 6)." },
        efficiency: { type: 'number', description: "Simple machines: mechanical efficiency η, 0.2–1 (default 1 = ideal, where W_in = W_out exactly). Below 1 the effort force rises and a friction-loss (W_fric) bar opens the gap between work-in and work-out." },
        armEffort: { type: 'number', description: "Lever: the effort arm length in m (default 8). MA = armEffort / armLoad." },
        armLoad: { type: 'number', description: "Lever: the load arm length in m (default 4)." },
        leverClass: { type: 'number', enum: [1, 2, 3], description: "Lever class (default 1): 1 = fulcrum between effort and load (seesaw); 2 = load between (MA>1, wheelbarrow); 3 = effort between (MA<1, forearm — trades force for speed). For class 3 pass armEffort < armLoad." },
        rWheel: { type: 'number', description: "Wheel & axle: wheel radius R in m (default 6). MA = R / rAxle." },
        rAxle: { type: 'number', description: "Wheel & axle: axle radius r in m (default 1.5)." },
        ropes: { type: 'number', description: "Pulley (compound): number of rope falls supporting the load = the mechanical advantage (default 4; 2–6)." },
        pulleyType: { type: 'string', enum: ['fixed', 'movable', 'compound'], description: "Pulley type (default 'movable'): 'fixed' (MA=1, only redirects effort), 'movable' (MA=2), 'compound'/block-and-tackle (MA = ropes)." },
        thickness: { type: 'number', description: "Wedge: thickness/lift t in m (default 3). MA = length / thickness." },
        pitch: { type: 'number', description: "Screw: thread pitch p in m — the advance per turn (default 1). MA = 2π·radius / pitch." },
        crankRadius: { type: 'number', description: "Steam engine: crank throw r in m (default 2). The piston stroke is 2r." },
        rodLength: { type: 'number', description: "Steam engine: connecting-rod length L in m (default 7.5; must exceed the crank radius)." },
        flywheelR: { type: 'number', description: "Steam engine: flywheel radius in m (default 4.4)." },
        rpm: { type: 'number', description: "Steam engine: running speed label in rpm (default 60); playback is clamped to a watchable rate." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        vectors: { type: 'boolean', description: 'Show the velocity/acceleration arrows + numeric readout (default true).' },
        trace: { type: 'boolean', description: 'Draw the persistent trajectory ribbon — the arc/path stays visible even at rest (default true).' },
        strobe: { type: 'boolean', description: 'Drop faint stroboscopic afterimages of the body at equal time steps; their spacing visualizes acceleration without playing the motion (default true).' },
        strobeEvery: { type: 'number', description: 'Sample interval between strobe afterimages (default 12; lower = denser).' },
        energy: { type: 'boolean', description: 'Show the KE / PE / total energy bars in the readout — total stays flat as KE↔PE trade, and visibly sinks under friction (default true).' },
        forces: { type: 'boolean', description: 'Show the moving FREE-BODY diagram — the real force vectors acting on the body (weight mg, normal, friction, string tension) as labelled colour-coded arrows + a newton legend; they sum to ma (the orange acceleration arrow). Off by default (opt-in for the dynamics view).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#0b1020" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createMechanicsViewHandler,
  });
}
