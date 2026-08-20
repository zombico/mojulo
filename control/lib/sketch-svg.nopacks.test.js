import { describe, it, expect } from 'vitest';
import { renderSketchToSvg } from '@/lib/sketch-svg';

// P3c proof: a bare kernel (no creative pack) can render a diagram. The whole
// transitive chain — sketch-svg → CreationMap → signage-chrome → color — is
// kernel-resident with zero lib/graph imports (asserted structurally by the
// pack-boundary guard; exercised functionally here).
describe('kernel diagram render (no packs installed)', () => {
  const diagram = {
    viewBox: { width: 320, height: 200 },
    marks: [
      { kind: 'line', x1: 20, y1: 100, x2: 300, y2: 100, stroke: '#1a1a1a', strokeWidth: 2 },
      { kind: 'text', x: 160, y: 60, value: 'HELLO', size: 14, anchor: 'middle' },
    ],
  };

  it('renders a diagram manifest to standalone SVG through the kernel renderer', async () => {
    const svg = await renderSketchToSvg(diagram, {});
    expect(typeof svg).toBe('string');
    expect(svg).toMatch(/<svg[\s>]/i);
    expect(svg).toContain('HELLO');
  });
});
