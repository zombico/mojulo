/**
 * verify_machina — Machina's forward+verify entry point. The operator states a materials-handling
 * problem as a recipe (a demand: how many units, how heavy, how far/how fast; a mechanism: a chain of
 * simple machines; and a typed capacity envelope: force / rate / storage limits) and Machina returns a
 * CHECKED feasibility verdict — never a render, a verdict. It resolves the demand through the mechanism
 * (conservation of work is structural — machines trade force for distance, never yield work for free),
 * then reports feasibility as per-constraint MARGINS and names every binding constraint when infeasible.
 *
 * This is the design-calculus sibling of create_mechanics_view (which DEPICTS a machine). Pure compute:
 * no sketch is minted, nothing is persisted — same recipe → same verdict.
 */

import { registerTool } from '@/lib/mcp/server';
import { runRecipe } from '@/lib/graph/machina/recipe';

const qtyProp = (desc) => ({ type: 'object', properties: { value: { type: 'number' }, unit: { type: 'string' } }, required: ['value'], description: desc });

export function verifyMachinaHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('verify_machina requires a recipe object');
  if (!input.demand || typeof input.demand !== 'object') throw new Error('verify_machina requires a `demand`');
  if (!Array.isArray(input.mechanism) || input.mechanism.length === 0) throw new Error('verify_machina requires a non-empty `mechanism`');
  return runRecipe(input);
}

export function registerMachinaTools() {
  registerTool({
    name: 'verify_machina',
    description:
      "Machina — solve a volume/weight/capacity problem with mechanical design. State a materials-"
      + "handling problem and get back a CHECKED feasibility verdict (not a picture): can this MECHANISM "
      + "move this LOAD within these CAPACITY limits? You pass three things. (1) `demand` — the load: how "
      + "many units (`count`), how heavy (`unitMass` in kg, or `unitWeight` in N), how far/high they move "
      + "(`distance`), optionally over how long (`time`, which unlocks the power and throughput checks) "
      + "and how many move together per cycle (`unitsPerCycle`). (2) `mechanism` — a chain of simple "
      + "machines from effort to load, each a force-transformer: 'lever' (effortArm/loadArm), 'wheelAxle' "
      + "(wheelR/axleR), 'pulley' (segments = rope falls), 'incline' (slope/height), 'wedge' "
      + "(length/thickness), 'screw' (leverR + pitch); each takes an optional `eta` efficiency 0–1 "
      + "(default 1 = ideal). Advantage MULTIPLIES down the chain. (3) `capacities` — the typed envelope: "
      + "{type:'force', rating, on:'effort'|'peak'|<stage>} (a strength/structural limit — default 'on' is "
      + "the effort the operator must supply, NOT the load), {type:'rate', power?, throughput?} (a power "
      + "budget in W and/or a throughput ceiling in units/time), {type:'storage', rating} (max units "
      + "staged at once). Machina resolves the demand through the mechanism, enforces conservation of work "
      + "(W_in ≥ W_out always — a perpetual-motion design is structurally impossible to express), checks "
      + "each capacity, and returns { feasible, binding, report (a readable markdown verdict), verdict "
      + "(structured numbers: net advantage, effort force, total work, friction loss, sustained power, per-"
      + "constraint margins) }. Feasibility is reported as MARGINS (headroom), not a bare yes/no, so a "
      + "barely-feasible design reads differently from an overbuilt one; an infeasible result NAMES every "
      + "binding constraint. Reach for this on framing like 'can a person crank N crates up to the "
      + "mezzanine in an hour', 'size a block-and-tackle to lift this safely', 'will this ramp/jack/lever "
      + "handle the load within the force limit', 'design a machine to move X of weight W within capacity "
      + "C'. To DEPICT the resulting machine as a traversable 3D World instead, use create_mechanics_view.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Optional label for the problem (appears in the report heading).' },
        intent: { type: 'string', description: 'Optional one-line statement of the goal (appears under the heading).' },
        demand: {
          type: 'object',
          description: 'The load to move.',
          properties: {
            count: { type: 'number', description: 'How many units in total (the volume/multiplicity).' },
            unitMass: qtyProp('Mass of one unit, e.g. { value: 50, unit: "kg" }. Converted to weight via g.'),
            unitWeight: qtyProp('Weight (force) of one unit, e.g. { value: 490, unit: "N" }. Use instead of unitMass if you have force directly.'),
            distance: qtyProp('Distance/height one unit moves, e.g. { value: 3, unit: "m" }.'),
            time: qtyProp('Optional total time budget, e.g. { value: 1, unit: "h" }. Required for the rate (power/throughput) checks.'),
            unitsPerCycle: { type: 'number', description: 'Units moved together in one machine cycle (default 1).' },
            g: { type: 'number', description: 'Gravitational acceleration m/s² used to turn unitMass into weight (default 9.8 — Earth).' },
          },
          required: ['count', 'distance'],
        },
        mechanism: {
          type: 'array',
          description: 'The chain of simple machines from effort source to load. Advantage multiplies along it.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['lever', 'wheelAxle', 'pulley', 'incline', 'wedge', 'screw'], description: 'Which simple machine.' },
              eta: { type: 'number', description: 'Efficiency 0–1 (default 1 = ideal). Below 1 opens a friction-loss gap; W_in = W_out / eta.' },
              effortArm: { type: 'number', description: 'lever: effort arm length (m). MA = effortArm/loadArm.' },
              loadArm: { type: 'number', description: 'lever: load arm length (m).' },
              wheelR: { type: 'number', description: 'wheelAxle: wheel radius (m). MA = wheelR/axleR.' },
              axleR: { type: 'number', description: 'wheelAxle: axle radius (m).' },
              segments: { type: 'number', description: 'pulley: number of rope falls supporting the load = MA.' },
              slope: { type: 'number', description: 'incline: slope length (m). MA = slope/height.' },
              height: { type: 'number', description: 'incline: rise (m).' },
              length: { type: 'number', description: 'wedge: length (m). MA = length/thickness.' },
              thickness: { type: 'number', description: 'wedge: thickness (m).' },
              leverR: { type: 'number', description: 'screw: effort lever radius (m). MA = 2π·leverR/pitch.' },
              pitch: { type: 'number', description: 'screw: thread pitch / lead per turn (m).' },
            },
            required: ['type'],
          },
        },
        capacities: {
          type: 'array',
          description: 'The typed capacity envelope. Each entry is one constraint, checked independently with its own margin.',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['force', 'rate', 'storage'], description: 'Capacity kind.' },
              rating: qtyProp("force: max force (e.g. { value: 250, unit: 'N' }). storage: max units held (a plain number)."),
              on: { type: 'string', description: "force only: what bears it — 'effort' (default; the force the operator/source supplies), 'peak' (worst-loaded element), or a stage type/index." },
              power: qtyProp("rate: available power budget, e.g. { value: 150, unit: 'W' }."),
              throughput: { type: 'object', properties: { value: { type: 'number' }, per: { type: 'string', enum: ['s', 'min', 'h'] } }, description: "rate: throughput ceiling, e.g. { value: 120, per: 'h' } = 120 units/hour." },
            },
            required: ['type'],
          },
        },
      },
      required: ['demand', 'mechanism'],
    },
    handler: verifyMachinaHandler,
  });
}
