process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// The opt-in backdrop: a standalone diagram SVG paints its surface colour under the drawing, so a
// download or a host page's <img> doesn't put the dark surface's pale ink on the viewer's white.

import { describe, it, expect } from 'vitest';
import { renderSketchToSvg } from '@/lib/sketch-svg';

const DIAGRAM = {
  title: 'Flow',
  viewBox: { width: 400, height: 160 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', x: 20, y: 40, w: 120, h: 50 },
    { id: 'b', kind: 'db_row', label: 'B', sublabel: 'rows', x: 240, y: 40, w: 120, h: 50 },
  ],
  edges: [{ from: 'a', to: 'b' }],
};
const FIRST_CHILD = /^(?:<\?xml[^>]*>\s*)?<svg\b[^>]*>(<[^>]*>)/;

describe('renderSketchToSvg backdrop', () => {
  it('is off by default: the drawing stays transparent for callers with their own backdrop', async () => {
    const svg = await renderSketchToSvg(DIAGRAM);
    expect(svg.match(FIRST_CHILD)[1]).not.toMatch(/^<rect/);
  });

  it('paints the dark surface colour full-bleed as the first child', async () => {
    const svg = await renderSketchToSvg(DIAGRAM, { backdrop: true });
    expect(svg.match(FIRST_CHILD)[1]).toBe('<rect x="0" y="0" width="400" height="160" fill="#111827">');
  });

  it("uses a theme's own --background, and paints nothing on the transparent light surface", async () => {
    const themed = await renderSketchToSvg(DIAGRAM, { backdrop: true, vars: { '--background': '#0b1d2e' } });
    expect(themed.match(FIRST_CHILD)[1]).toContain('fill="#0b1d2e"');
    const light = await renderSketchToSvg(DIAGRAM, { backdrop: true, surface: 'light' });
    expect(light.match(FIRST_CHILD)[1]).not.toMatch(/^<rect/);
  });

  it('draws station outlines and sublabels in surface-aware ink tokens', async () => {
    const light = await renderSketchToSvg(DIAGRAM, { surface: 'light' });
    expect(light).toContain('stroke="#6a6a6a"');   // input outline: --text-muted, light
    expect(light).toContain('stroke="#7c3aed"');   // db_row outline: --entity-purple, light
    expect(light).toMatch(/fill="#3a3a3a"[^>]*>rows</);   // sublabel: --text-secondary, light
  });
});
