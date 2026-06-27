/**
 * create_fluid_view — mint a fluid-dynamics depictor, opening with LIFT: an airfoil in a real
 * Joukowski POTENTIAL FLOW, rendered in the traversable three.js World. Lift is not drawn — it
 * EMERGES from the computed circulation (the Kutta condition), the faster-over-top flow, and
 * Kutta–Joukowski L = ρ·V·Γ.
 *
 * Same fractal-generation philosophy as the other science views: the operator passes a tiny RECIPE
 * (a scenario + angle of attack); the substrate stores ONLY the recipe (`kind: 'fluid-view'`, no
 * geometry) and regenerates the flow on render. Orbit-only object study — returns a `worldUrl`.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { registerTool } from '@/lib/mcp/server';
import { planFluidScene, FLUID_SCENARIOS } from '@/lib/graph/fluid-view';

export function mintFluidView({ title, scenario, angle, density, viscosity, spin, emitters, scale, viewBox, scene, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fluid-view',
    scenario: FLUID_SCENARIOS.includes(scenario) ? scenario : 'airfoil',
    ...(Number.isFinite(+angle) ? { angle: +angle } : {}),
    ...(Number.isFinite(+density) ? { density: +density } : {}),
    ...(Number.isFinite(+viscosity) ? { viscosity: +viscosity } : {}),
    ...(Number.isFinite(+spin) ? { spin: +spin } : {}),
    ...(Array.isArray(emitters) ? { emitters } : {}),
    ...(Number.isFinite(+scale) ? { scale: Math.max(0.2, +scale) } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(scene && typeof scene === 'object' ? { scene } : {}),
    ...(title ? { title } : {}),
  };

  const plan = planFluidScene(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `${manifest.scenario} — lift`,
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
    stats: {
      scenario: plan.stats.scenario, faces: plan.faces.length,
      ...(plan.stats.Gamma != null ? { circulation: +plan.stats.Gamma.toFixed(3) } : {}),
      ...(plan.stats.topRatio != null ? { topSpeedRatio: +plan.stats.topRatio.toFixed(2) } : {}),
      ...(plan.stats.rho != null ? { density: plan.stats.rho, state: plan.stats.floats ? (plan.stats.rho > 0.97 ? 'neutral' : 'floats') : 'sinks', submergedFrac: +plan.stats.submergedFrac.toFixed(2) } : {}),
      ...(plan.stats.viscosities ? { viscosities: plan.stats.viscosities } : {}),
      ...(plan.stats.mu != null ? { viscosity: plan.stats.mu } : {}),
    },
  };
}

export async function createFluidViewHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_fluid_view requires a recipe object');
  }
  const { title, scenario, angle, density, viscosity, spin, emitters, scale, viewBox, scene, ref, folder_ref: folderRef } = input;
  return mintFluidView({ title, scenario, angle, density, viscosity, spin, emitters, scale, viewBox, scene, ref, folderRef });
}

export function registerFluidViewTools() {
  registerTool({
    name: 'create_fluid_view',
    description:
      "Mint an interactive FLUID-DYNAMICS depictor — covering BOTH aerodynamics (flow) and hydrostatics "
      + "(still liquids). Three scenarios: 'airfoil' (LIFT as the first principle — a wing in a real "
      + "Joukowski POTENTIAL FLOW where lift EMERGES from the computed circulation via the Kutta "
      + "condition: faster-over-top → lower pressure → L = ρ·V·Γ; the `angle` of attack is the knob, and "
      + "flow particles speed up over the top); 'sail' (the counterintuitive Bernoulli case — a sail IS a "
      + "vertical airfoil, so the SAME potential flow gives lift ⟂ the apparent wind; because the boat "
      + "heads up INTO the wind, that sideways lift has a forward DRIVE component along the hull while the "
      + "keel cancels the leftover heel/leeway — the boat is 'propelled by the headwind' to windward. The "
      + "`angle` knob is the POINT OF SAIL β off the bow: drive ∝ sin β, upwind VMG ∝ sin 2β (best ≈ 45°), "
      + "and β→0 is the no-go zone); 'spin-sail' (a 'Gyro Zeppeli' variant — the wind is CONJURED, summed "
      + "from two arbitrary point emitters (two spinning steel balls = two potential-flow VORTICES, the "
      + "Spin); counter-rotating, they fling a JET of wind out between them, and a sail set in it develops "
      + "lift ⟂ the LOCAL wind via the same Kutta circulation. The `spin` knob sets each ball's vortex "
      + "strength; `emitters` places the two points. The wind field is the EXACT superposition of the two "
      + "singularities; the sail's lift is from the locally-sampled wind); 'rotor-sail' (the MAGNUS effect / "
      + "Flettner rotor — 'Gyro's balls behind him, a headwind in front': spinning balls in a real headwind "
      + "are rotors that each feel F = ρ·U∞·Γ ⟂ the wind (the same lift law, now from SPIN not camber); off "
      + "the bow that force has a forward component the keel resolves into DRIVE, so the spin drives you "
      + "forward INTO the headwind, as real rotor ships do. `angle` is the headwind angle off the bow, "
      + "`spin` each ball's strength — same-sense spin adds, dead-into-wind still gives no drive); 'buoyancy' (ARCHIMEDES — a block in water where the "
      + "bottom face sits deeper than the top, so the upward pressure exceeds the downward pressure and "
      + "that imbalance IS the buoyant force; the `density` knob makes it float or sink, settling where "
      + "buoyancy = weight, with green buoyant + red weight arrows); and 'water-pressure' (HYDROSTATIC "
      + "P = ρgh — pressure arrows on the tank walls grow with depth, and jets from holes at three depths "
      + "shoot out at v = √(2gh) by Torricelli, the deeper hole jetting faster); 'falling-sphere' "
      + "(VISCOSITY — a Stokes falling-sphere viscometer: identical balls dropped through water, oil and "
      + "honey reach terminal velocity v = (2/9)(ρ_s−ρ_f)g·r²/μ, so the honey ball crawls while the "
      + "water ball drops — higher viscosity → slower fall); and 'shear' (Couette flow — fluid between "
      + "a fixed floor and a dragged top plate, the linear velocity profile that DEFINES viscosity via "
      + "the shear stress τ = μ·dv/dy, the `viscosity` knob scaling the stress). Accurate physics, "
      + "compressed scale, real-relationship readout. Served as a live, traversable three.js World at "
      + "`/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); CLICK a body for its facts. You pass "
      + "a tiny recipe; the substrate stores ONLY the recipe (`manifest.kind === 'fluid-view'`, no "
      + "geometry) and regenerates on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the "
      + "worldUrl. Reach for this on framing like 'how lift works / airflow over a wing / why planes fly / "
      + "why things float / buoyancy / Archimedes / water pressure with depth / pressure in a tank'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        scenario: { type: 'string', enum: [...FLUID_SCENARIOS], description: "Which to depict (default 'airfoil'): 'airfoil' (lift via potential flow), 'sail' (a sail as a vertical airfoil driven to windward — the keel resolves lift into forward drive), 'spin-sail' (Gyro Zeppeli — wind conjured from two spinning point-vortices), 'rotor-sail' (the Magnus effect / Flettner rotor — spin drives you into a headwind), 'buoyancy' (Archimedes — float/sink), 'water-pressure' (hydrostatic P=ρgh + Torricelli jets), 'falling-sphere' (Stokes viscometer — balls falling through water/oil/honey), 'shear' (Couette flow — the velocity gradient defining viscosity)." },
        angle: { type: 'number', description: "For 'airfoil', the angle of attack in degrees (default 6; higher → more circulation → more lift; capped at 16° as inviscid flow does not stall). For 'sail' and 'rotor-sail', the wind angle β in degrees off the bow (default 42; best drive ≈ 45°; near 0° is the no-go zone where drive collapses)." },
        spin: { type: 'number', description: "Steel-ball spin strength (default 6). For 'spin-sail' the two balls counter-rotate (higher → stronger conjured jet); for 'rotor-sail' they spin the same sense (higher → more Magnus drive)." },
        emitters: { type: 'array', description: "For 'spin-sail', the two wind-source points (Gyro's steel balls): [{ x, y, spin, gust }, …]. x,y in flow-units (the sail sits at ~(1.4, 0)); `spin` is that ball's vortex strength (sign = rotation sense), `gust` an optional radial source. Defaults to a counter-rotating pair at (−1.6, ±1.1).", items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, spin: { type: 'number' }, gust: { type: 'number' } } } },
        density: { type: 'number', description: "Object density relative to water for 'buoyancy' (default 0.6 = wood; <1 floats, >1 sinks; e.g. cork 0.24, ice 0.92, aluminium 2.7)." },
        viscosity: { type: 'number', description: "Dynamic viscosity μ (Pa·s) for 'shear' (default 1; scales the shear-stress arrow τ = μ·dv/dy)." },
        scale: { type: 'number', description: 'Overall size multiplier (default 1).' },
        viewBox: { type: 'object', description: 'Optional render size { width, height } (default 1120×780).' },
        scene: { type: 'object', description: 'Optional scene options, e.g. { bg: "#070b14" } for the background colour.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createFluidViewHandler,
  });
}
