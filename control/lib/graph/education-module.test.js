import { describe, expect, it } from 'vitest';

import { EDUCATION_VIEW_KINDS, sketchRenderMode, classifyBucket } from './sketch/sketch-manifest.js';
import { resolveWorldScene } from './worlds/world-scene.js';
import { listTools } from '@/lib/mcp/server';

// The education module — math explainers, the sibling family to the science views. This test locks the
// whole wiring end to end: routing → world-scene dispatch → MCP tool registration, for every kind.

// the 13 kinds and the MCP tool that mints each (create_<snake>_view).
const TOOL_OF = {
  'transform-view': 'create_transform_view',
  'field-flow-view': 'create_field_flow_view',
  'surface-view': 'create_surface_view',
  'series-view': 'create_series_view',
  'probability-view': 'create_probability_view',
  'complex-view': 'create_complex_view',
  'trig-circle-view': 'create_trig_circle_view',
  'pythagoras-view': 'create_pythagoras_view',
  'quadratic-view': 'create_quadratic_view',
  'complete-square-view': 'create_complete_square_view',
  'conics-view': 'create_conics_view',
  'derivative-view': 'create_derivative_view',
  'ftc-view': 'create_ftc_view',
};

describe('education module — routing', () => {
  it('exposes exactly the 13 math-explainer kinds', () => {
    expect(EDUCATION_VIEW_KINDS).toEqual(Object.keys(TOOL_OF));
  });

  it('every education kind routes to the world renderer + world bucket', () => {
    for (const kind of EDUCATION_VIEW_KINDS) {
      expect(sketchRenderMode({ kind }), kind).toBe('world');
      expect(classifyBucket({ kind }), kind).toBe('world');
    }
  });
});

describe('education module — world-scene dispatch', () => {
  it('every kind resolves to a renderable payload (faces / raymarch / surfaces) + cameras', async () => {
    for (const kind of EDUCATION_VIEW_KINDS) {
      const { payload } = await resolveWorldScene({ ref: 't', title: kind, manifest: { kind } });
      const content = (payload.faces && payload.faces.length) || payload.raymarch || (payload.surfaces && payload.surfaces.length);
      expect(content, `${kind} produced no renderable content (dispatch miss?)`).toBeTruthy();
      expect(payload.cameras && payload.cameras.length, `${kind} has no cameras`).toBeTruthy();
    }
  });
});

describe('education module — MCP tool registration', () => {
  it('registering the education tools exposes a create_*_view per kind, each with a scenario enum', async () => {
    // registerTool just populates the in-memory registry (no DB, no server) — safe to call here.
    const regs = await Promise.all(EDUCATION_VIEW_KINDS.map((k) =>
      import(`@/lib/mcp/tools/${k}.js`).then((m) => Object.values(m).find((v) => typeof v === 'function' && v.name.startsWith('register')))));
    regs.forEach((fn) => fn());

    const byName = new Map(listTools().map((t) => [t.name, t]));
    for (const [kind, toolName] of Object.entries(TOOL_OF)) {
      const tool = byName.get(toolName);
      expect(tool, `${toolName} not registered`).toBeTruthy();
      const scen = tool.inputSchema?.properties?.scenario;
      expect(Array.isArray(scen?.enum) && scen.enum.length, `${toolName} missing scenario enum`).toBeTruthy();
    }
  });
});
