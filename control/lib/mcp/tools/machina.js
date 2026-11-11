/**
 * verify_machina — Machina's forward+verify entry point. The operator states a materials-handling
 * problem as a recipe (a demand: how many units, how heavy, how far/how fast; a mechanism: a chain of
 * simple machines; and a typed capacity envelope: force / rate / storage limits) and Machina returns a
 * CHECKED feasibility verdict — never a render, a verdict. It resolves the demand through the mechanism
 * (conservation of work is structural — machines trade force for distance, never yield work for free),
 * then reports feasibility as per-constraint MARGINS and names every binding constraint when infeasible.
 *
 * This is the design-calculus sibling of the mechanics exhibit (which DEPICTS a machine). Pure compute:
 * no sketch is minted, nothing is persisted — same recipe → same verdict. The description is routing
 * grade; the manual (every parameter, the units, what comes back) is the `machina` solid-vocab card.
 */

import { registerTool } from '@/lib/mcp/server';
import { runRecipe } from '@/lib/graph/machina/recipe';

const qtyProp = (desc) => ({ type: 'object', properties: { value: { type: 'number' }, unit: { type: 'string' } }, required: ['value'], description: desc });

const MANUAL = "manual: get_solid_vocab({ id: 'machina' })";

export function verifyMachinaHandler(input) {
  if (!input || typeof input !== 'object') throw new Error(`verify_machina requires a recipe object — ${MANUAL}`);
  if (!input.demand || typeof input.demand !== 'object') throw new Error(`verify_machina requires a \`demand\` — ${MANUAL}`);
  if (!Array.isArray(input.mechanism) || input.mechanism.length === 0) throw new Error(`verify_machina requires a non-empty \`mechanism\` — ${MANUAL}`);
  return runRecipe(input);
}

export function registerMachinaTools() {
  registerTool({
    name: 'verify_machina',
    description:
      'Machina: a CHECKED feasibility verdict for a materials-handling problem (a calculation, not a picture; nothing is '
      + 'minted): can this `mechanism` (a chain of simple machines: lever, wheelAxle, pulley, incline, wedge, screw) move '
      + 'this `demand` (how many, how heavy, how far, in what time) within these `capacities` (force, rate, storage)? '
      + 'Returns { feasible, binding, report, verdict }: margins per limit, every failing limit named. For \'can a person '
      + 'crank N crates up in an hour\', \'size a block-and-tackle\', \'will this ramp or lever handle the load\'. '
      + "Manual: get_solid_vocab({ id: 'machina' }). To depict a machine: create_exhibit science/mechanics.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Heads the report.' },
        intent: { type: 'string', description: 'One line under the heading.' },
        demand: {
          type: 'object',
          description: 'The load: { count, unitMass | unitWeight, distance, time?, unitsPerCycle?, g? }; quantities are { value, unit }.',
          properties: {
            count: { type: 'number', description: 'Units in total.' },
            unitMass: qtyProp('One unit, e.g. { value: 50, unit: "kg" }.'),
            unitWeight: qtyProp('Or its weight, e.g. { value: 490, unit: "N" }.'),
            distance: qtyProp('How far or high one unit moves.'),
            time: qtyProp('Total time; needed for the rate checks.'),
            unitsPerCycle: { type: 'number' },
            g: { type: 'number', description: 'm/s² (9.8).' },
          },
          required: ['count', 'distance'],
        },
        mechanism: {
          type: 'array',
          description: 'Stages from effort to load; advantage multiplies. Each { type, eta?, …its parameters } (the card lists them).',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['lever', 'wheelAxle', 'pulley', 'incline', 'wedge', 'screw'] },
              eta: { type: 'number', description: 'Efficiency 0–1 (1).' },
            },
            required: ['type'],
          },
        },
        capacities: {
          type: 'array',
          description: "Limits, each checked with its own margin: { type: 'force', rating, on? } | { type: 'rate', power?, throughput? } | { type: 'storage', rating }.",
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['force', 'rate', 'storage'] },
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
