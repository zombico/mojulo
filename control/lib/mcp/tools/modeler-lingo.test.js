import { describe, expect, it } from 'vitest';

import { translateModelerLingoHandler } from './modeler-lingo.js';

describe('translate_modeler_lingo', () => {
  it('requires lingo or list', async () => {
    await expect(translateModelerLingoHandler({})).rejects.toThrow(/lingo/);
    await expect(translateModelerLingoHandler(null)).rejects.toThrow();
  });

  it('lists the full lexicon when { list: true }', async () => {
    const out = await translateModelerLingoHandler({ list: true });
    expect(out.lexicon.length).toBeGreaterThan(10);
    expect(out.pipeline).toMatch(/export_model/);
    for (const e of out.lexicon) {
      expect(['native', 'partial', 'handoff']).toContain(e.support);
    }
  });

  it('routes a native term (blockout) to create_* + export_model', async () => {
    const out = await translateModelerLingoHandler({ lingo: 'greybox an environment' });
    expect(out.matches.length).toBeGreaterThan(0);
    const top = out.matches[0];
    expect(top.id).toBe('blockout');
    expect(top.support).toBe('native');
    expect(top.mojulo_routes.some((r) => r.tool.startsWith('create_'))).toBe(true);
    expect(top.then.some((r) => r.tool === 'export_model')).toBe(true);
  });

  it('is honest about handoff ops (retopo) — no false capability', async () => {
    const out = await translateModelerLingoHandler({ lingo: 'I need clean quad topology, retopo this' });
    const top = out.matches[0];
    expect(top.id).toBe('retopo');
    expect(top.support).toBe('handoff');
    expect(top.mojulo_routes).toHaveLength(0);
    expect(top.do_in_dcc).toMatch(/DCC|retopo/i);
  });

  it('reports the ceiling for partial ops (low-poly)', async () => {
    const out = await translateModelerLingoHandler({ lingo: 'low poly game res mesh' });
    const top = out.matches[0];
    expect(top.id).toBe('low-poly');
    expect(top.support).toBe('partial');
    expect(top.ceiling).toBeTruthy();
  });

  it('folds subject into suggested create_* args', async () => {
    const out = await translateModelerLingoHandler({ lingo: 'base mesh', subject: 'spaceship' });
    const top = out.matches[0];
    const poly = top.mojulo_routes.find((r) => r.tool === 'create_polygonized_sketch');
    expect(poly.args.prompt).toBe('spaceship');
    expect(out.subject).toBe('spaceship');
  });

  it('rigging routes to create_figure but flags static export', async () => {
    const out = await translateModelerLingoHandler({ lingo: 'rig and skin this character' });
    const top = out.matches[0];
    expect(top.id).toBe('rigging');
    expect(top.support).toBe('handoff');
    expect(top.do_in_dcc).toMatch(/rig|skin|joint/i);
  });

  it('returns a graceful fallback for unknown lingo', async () => {
    const out = await translateModelerLingoHandler({ lingo: 'frobnicate the zorptangle' });
    expect(out.matches).toHaveLength(0);
    expect(out.unmatched.suggestion).toMatch(/create_polygonized_sketch/);
    expect(Array.isArray(out.unmatched.known_terms)).toBe(true);
  });

  // text-to-cad-seam.plan.md T3 — the precision-CAD handoff and the way back in
  it('a toleranced mechanical part is a HANDOFF to a B-rep tool, with bind_mesh_render as the return door', async () => {
    const out = await translateModelerLingoHandler({ lingo: 'press fit bearing seat with a tapped hole' });
    const top = out.matches[0];
    expect(top.id).toBe('precision-cad');
    expect(top.support).toBe('handoff');
    expect(top.do_in_dcc).toMatch(/B-rep|text-to-cad|FreeCAD/);
    expect(top.then.some((r) => r.tool === 'bind_mesh_render' && r.args?.units === 'mm')).toBe(true);
    expect(top.ceiling).toMatch(/fit/);
    // the form route is still offered — the FORM is native, the FIT is not
    expect(top.mojulo_routes.some((r) => r.tool === 'mint_solid')).toBe(true);
  });

  it('a bolt circle is still native (array-pattern first); "precision cad" resolves directly', async () => {
    const bolts = await translateModelerLingoHandler({ lingo: 'bolt circle' });
    expect(bolts.matches[0].id).toBe('array-pattern');
    const direct = await translateModelerLingoHandler({ lingo: 'precision cad' });
    expect(direct.matches[0].id).toBe('precision-cad');
    const print = await translateModelerLingoHandler({ lingo: '3d print this' });
    expect(print.matches[0].id).toBe('3d-print');
    expect(print.matches[0].do_in_dcc).toMatch(/dfam-check|slice-print/);
  });
});
