import { describe, expect, it } from 'vitest';

import { EDUCATION_VIEW_KINDS, sketchRenderMode, classifyBucket } from './sketch/sketch-manifest.js';
import { resolveWorldScene } from './worlds/world-scene.js';
import { listTools } from '@/lib/mcp/server';

// The education module — math explainers, the sibling family to the science views. This test locks the
// whole wiring end to end: routing → world-scene dispatch → MCP tool registration, for every kind.

// the 14 kinds and the MCP tool that mints each (create_<snake>_view).
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
  'heat-sphere-view': 'create_heat_sphere_view',
};

describe('education module — routing', () => {
  it('exposes exactly the 14 math-explainer kinds', () => {
    expect(EDUCATION_VIEW_KINDS).toEqual(Object.keys(TOOL_OF));
  });

  it('every education kind routes to the world renderer + object bucket', () => {
    for (const kind of EDUCATION_VIEW_KINDS) {
      expect(sketchRenderMode({ kind }), kind).toBe('world');
      expect(classifyBucket({ kind }), kind).toBe('object');
    }
  });
});

describe('education module — world-scene dispatch', () => {
  it('every kind resolves to a renderable payload (faces / raymarch / surfaces) + cameras', async () => {
    for (const kind of EDUCATION_VIEW_KINDS) {
      const { payload } = await resolveWorldScene({ ref: 't', title: kind, manifest: { kind } });
      const content = (payload.faces && payload.faces.length) || payload.raymarch || (payload.surfaces && payload.surfaces.length) || (payload.heatSpheres && payload.heatSpheres.length);
      expect(content, `${kind} produced no renderable content (dispatch miss?)`).toBeTruthy();
      expect(payload.cameras && payload.cameras.length, `${kind} has no cameras`).toBeTruthy();
    }
  });
});

describe('education module — MCP tool registration', () => {
  it('every education kind is a create_view kind (math family) with an unlisted deprecated alias', async () => {
    // The per-kind create_*_view registrations retired into the consolidated
    // create_view entry (see lib/mcp/tools/tool-list-drawerization.plan.md).
    // What this locks now: each education kind has a VIEW_KINDS row in the
    // math family, appears in create_view's kind enum, keeps its retired
    // name as an unlisted alias, and documents its scenarios in a view-vocab
    // card (the scenario enum moved from tools/list into the card + the
    // mint's own validation).
    const { VIEW_KINDS } = await import('@/lib/mcp/tools/create-view.js');
    const { registerCreateViewTools } = await import('@/lib/mcp/tools/create-view.js');
    const { getViewVocabCatalog } = await import('@/lib/graph/views/view-vocab/loader.js');
    registerCreateViewTools();

    // Force flat: this asserts BOTH that create_view is on the listed surface
    // and that retired aliases are absent from it — packs mode (now the default)
    // would fold create_view off tools/list. `listTools` reads the env per call.
    const prevPacks = process.env.MOJULO_TOOL_PACKS;
    process.env.MOJULO_TOOL_PACKS = 'off';
    const byName = new Map(listTools().map((t) => [t.name, t]));
    if (prevPacks === undefined) delete process.env.MOJULO_TOOL_PACKS;
    else process.env.MOJULO_TOOL_PACKS = prevPacks;
    const createView = byName.get('create_view');
    expect(createView, 'create_view not registered').toBeTruthy();
    const kindEnum = createView.inputSchema?.properties?.kind?.enum || [];
    const catalog = getViewVocabCatalog();

    for (const [kind, toolName] of Object.entries(TOOL_OF)) {
      const shortKind = kind.replace(/-view$/, '');
      const entry = VIEW_KINDS[shortKind];
      expect(entry, `${shortKind} missing from VIEW_KINDS`).toBeTruthy();
      expect(entry.family, `${shortKind} family`).toBe('math');
      expect(entry.retired).toBe(toolName);
      expect(kindEnum, `${shortKind} missing from create_view kind enum`).toContain(shortKind);
      // The retired name resolves but is NOT listed.
      expect(byName.has(toolName), `${toolName} should be unlisted`).toBe(false);
      // The scenario documentation moved into the kind's vocab card.
      const card = catalog.get(shortKind);
      expect(card, `${shortKind} missing view-vocab card`).toBeTruthy();
      expect(card.body, `${shortKind} card missing parameter manual`).toMatch(/## Parameters/);
    }
  });
});
