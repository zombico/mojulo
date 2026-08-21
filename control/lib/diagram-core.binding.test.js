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

// P0 edge-notation (typed heads/tails + dashed + self-loop) is pure diagram
// vocab — it must round-trip identically through both paths too.
const TYPED = {
  title: 'Typed',
  viewBox: { width: 420, height: 300 },
  stations: [
    { id: 'p', kind: 'db_row', label: 'P', x: 40, y: 40, w: 120, h: 60 },
    { id: 'c', kind: 'db_row', label: 'C', x: 40, y: 200, w: 120, h: 60 },
  ],
  edges: [
    { from: 'c', to: 'p', head: 'triangle-open', label: 'is-a' },
    { from: 'p', to: 'p', head: 'arrow', label: 'self' },
    { from: 'p', to: 'c', head: 'crowsfoot-many', tail: 'crowsfoot-one', dashed: true },
  ],
  marks: [{ kind: 'line', x1: 240, y1: 40, x2: 380, y2: 40, stroke: '#1a2230', head: 'diamond-filled', tail: 'dot' }],
};

// Edges-only twin of TYPED: takes NO creative expansion (marks trigger the inert
// neoRembrandt planning stamp), so it proves the typed-edge vocab is stored
// byte-identically through both paths.
const TYPED_EDGES = { ...TYPED, marks: undefined };

// P1 sequence — a `kind:'sequence'` spec lowered by expandSequence in BOTH paths.
// The lowering emits marks, so it's render-identical (not byte-identical-stored;
// create_sketch also stamps the inert neoRembrandt block — the Move 2b boundary).
const SEQUENCE = {
  kind: 'sequence',
  title: 'Seq',
  actors: [
    { id: 'a', label: 'Agent' },
    { id: 'm', label: 'mint' },
    { id: 'd', label: 'db' },
  ],
  messages: [
    { from: 'a', to: 'm', label: 'call', activate: true },
    { from: 'm', to: 'd', label: 'insert' },
    { from: 'd', to: 'm', label: 'ref', kind: 'return' },
    { from: 'm', to: 'a', label: 'ok', kind: 'return' },
  ],
};

// P5 gantt + P2 swimlanes — both lower to marks in BOTH paths (render-identical;
// marks-bearing, so the Move 2b byte-identical boundary applies as for sequence).
const GANTT = {
  kind: 'gantt',
  title: 'G',
  scale: { start: 0, end: 4, unit: 'wk' },
  tasks: [
    { label: 'A', start: 0, end: 2 },
    { label: 'B', start: 1, end: 4 },
  ],
};
const SWIMLANE = {
  title: 'SW',
  lanes: [
    { id: 'u', label: 'User' },
    { id: 's', label: 'System' },
  ],
  stations: [
    { id: 'a', kind: 'input', label: 'Ask', lane: 'u', col: 0 },
    { id: 'b', kind: 'mcp_tool', label: 'Do', lane: 's', col: 1 },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

// P3 ERD — stations (with divider) + typed edges + endpoint labels, NO marks →
// takes no creative expansion, so it's byte-identical-stored too.
const ERD = {
  title: 'ERD',
  viewBox: { width: 500, height: 220 },
  stations: [
    { id: 'user', kind: 'db_row', label: 'User', divider: true, items: ['id: pk', 'email'], x: 40, y: 60, w: 150, h: 90 },
    { id: 'order', kind: 'db_row', label: 'Order', divider: true, items: ['id: pk', 'user_id: fk'], x: 300, y: 60, w: 150, h: 90 },
  ],
  edges: [{ from: 'user', to: 'order', head: 'crowsfoot-many', tail: 'crowsfoot-one', fromLabel: '1', toLabel: '0..*' }],
};

// P4 containment — stations + edges + boundaries[]; boundaries lower to marks →
// render-identical (marks-bearing, Move 2b byte-identical boundary applies).
const BOUNDARY = {
  title: 'C4',
  viewBox: { width: 500, height: 300 },
  stations: [
    { id: 'a', kind: 'mcp_tool', label: 'A', x: 60, y: 60, w: 120, h: 50 },
    { id: 'b', kind: 'db_row', label: 'B', x: 60, y: 160, w: 120, h: 50 },
    { id: 'out', kind: 'input', label: 'Out', x: 320, y: 110, w: 120, h: 50 },
  ],
  edges: [{ from: 'out', to: 'a' }],
  boundaries: [{ label: 'Plane', contains: ['a', 'b'] }],
};

describe('diagram-core binding — mint_diagram ≡ create_sketch for diagram kinds', () => {
  // The user-visible invariant is identical RENDERED SVG. Both paths share the
  // one kernel validator + grid expansion (lib/diagram-core); create_sketch also
  // stamps an inert `neoRembrandt` planning block for marks, which does not
  // change the SVG for the box-arrow + basic dataviz vocab (bars/donut/KPI =
  // rect/wedge/text). Composite/layout marks (mandalaArrangement, horizontalStack)
  // DO need that Rendrant expander — the documented Move 2b boundary.
  for (const [name, manifest] of [['flowchart', FLOWCHART], ['chart', CHART], ['gridded', GRIDDED], ['typed', TYPED], ['sequence', SEQUENCE], ['gantt', GANTT], ['swimlane', SWIMLANE], ['erd', ERD], ['boundary', BOUNDARY]]) {
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
  for (const [name, manifest] of [['flowchart', FLOWCHART], ['gridded', GRIDDED], ['typed-edges', TYPED_EDGES], ['erd', ERD]]) {
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
