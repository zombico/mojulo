process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// Binding test (kernel-diagram-surface.plan.md Move 3): the kernel mint_diagram
// and the creative create_sketch MUST produce byte-identical output for diagram
// kinds — because both delegate diagram validation + grid expansion to the one
// kernel module lib/diagram-core. If anyone forks the diagram logic, these go
// red. This is the "so we don't forget" enforcement: there is one source, and it
// is checked, not hoped.

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createSketchHandler } from '@/lib/mcp/tools/sketches';
import { mintDiagram } from '@/lib/mcp/tools/diagram';
import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';

beforeEach(() => {
  closeDb();
});

const FLOWCHART = {
  title: 'Flow',
  viewBox: { width: 400, height: 200 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', x: 20, y: 60, w: 120, h: 80 },
    { id: 'b', kind: 'mcp_tool', label: 'B', x: 260, y: 60, w: 120, h: 80 },
  ],
  edges: [{ from: 'a', to: 'b', label: 'writes' }],
};

const CHART = {
  title: 'Bars',
  viewBox: { width: 300, height: 200 },
  marks: [
    { kind: 'rect', x: 20, y: 100, w: 40, h: 80 },
    { kind: 'rect', x: 80, y: 60, w: 40, h: 120 },
    { kind: 'rect', x: 140, y: 40, w: 40, h: 140 },
  ],
};

// Exercises expandGridLayout (cell → absolute coords) through BOTH paths.
const GRIDDED = {
  title: 'Grid',
  viewBox: { width: 400, height: 300 },
  grid: { cols: 2, rows: 2 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', cell: { col: 0, row: 0 } },
    { id: 'b', kind: 'db_row', label: 'B', cell: { col: 1, row: 1 } },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

describe('diagram-core binding — mint_diagram ≡ create_sketch for diagram kinds', () => {
  // The user-visible invariant is identical RENDERED SVG. Both paths share the
  // one kernel validator + grid expansion (lib/diagram-core); create_sketch also
  // stamps an inert `neoRembrandt` planning block for marks, which does not
  // change the SVG for the box-arrow + basic dataviz vocab (bars/donut/KPI =
  // rect/wedge/text). Composite/layout marks (mandalaArrangement, horizontalStack)
  // DO need that Rendrant expander — the documented Move 2b boundary.
  for (const [name, manifest] of [['flowchart', FLOWCHART], ['chart', CHART], ['gridded', GRIDDED]]) {
    it(`${name}: renders identically (SVG) via both paths`, async () => {
      const viaKernel = mintDiagram({ title: manifest.title, manifest, ref: `k_${name}` });
      const viaCreative = await createSketchHandler({ title: manifest.title, manifest, ref: `c_${name}` });

      const k = SketchRepository.getByRef(viaKernel.ref);
      const c = SketchRepository.getByRef(viaCreative.ref);

      const ksvg = (await renderStoredSketchSvg(k)).split('k_' + name).join('REF');
      const csvg = (await renderStoredSketchSvg(c)).split('c_' + name).join('REF');
      expect(ksvg).toBe(csvg);
    });
  }

  // Stations-only manifests take NO creative expansion at all, so the stored
  // manifest is byte-identical too — the strongest form of the binding.
  for (const [name, manifest] of [['flowchart', FLOWCHART], ['gridded', GRIDDED]]) {
    it(`${name}: byte-identical stored manifest (no creative expansion)`, async () => {
      const k = SketchRepository.getByRef(mintDiagram({ title: manifest.title, manifest, ref: `mk_${name}` }).ref);
      const c = SketchRepository.getByRef((await createSketchHandler({ title: manifest.title, manifest, ref: `mc_${name}` })).ref);
      expect(JSON.stringify(k.manifest)).toBe(JSON.stringify(c.manifest));
    });
  }

  it('mint_diagram refuses creative-composition fields (recipe / polygonizer)', () => {
    expect(() => mintDiagram({ title: 'x', manifest: { ...FLOWCHART, recipe: { kind: 'architecturalConstruction' } } }))
      .toThrow(/creative-pack feature/);
    expect(() => mintDiagram({ title: 'x', manifest: { ...FLOWCHART, polygonizer: { elements: [] } } }))
      .toThrow(/creative-pack feature/);
  });

  it('mint_diagram rejects a non-diagram (world) manifest by shape', () => {
    expect(() => mintDiagram({ title: 'town', manifest: { kind: 'floorplan', seed: 7 } }))
      .toThrow(/Invalid manifest/);
  });
});
