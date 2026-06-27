import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import CreationMap from '@/components/graph/CreationMap';

// The pulse primitive's value is the rendered animation, not just the schema:
// each token must be an <animateMotion> bound to the edge's own path so it plays
// live in the viewer and in the exported standalone .svg with no bake.
const manifest = {
  title: 'ping',
  viewBox: { width: 400, height: 200 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', x: 20, y: 60, w: 120, h: 80 },
    { id: 'b', kind: 'mcp_tool', label: 'B', x: 260, y: 60, w: 120, h: 80 },
  ],
  edges: [{ from: 'a', to: 'b', label: 'ping', pulse: { count: 2, dir: 'pingpong', color: '#5eead4' } }],
};

const render = (m) => renderToStaticMarkup(React.createElement(CreationMap, { manifest: m }));

describe('EdgePulse render', () => {
  it('emits one animateMotion token per count, bound to the edge path', () => {
    const svg = render(manifest);
    expect((svg.match(/<animateMotion/g) || []).length).toBe(2);
    expect(svg).toMatch(/path="M /); // animation rides the edge geometry
    expect(svg).toMatch(/fill="#5eead4"/);
  });

  it('ping-pongs via keyPoints without recomputing geometry', () => {
    expect(render(manifest)).toMatch(/keyPoints="0;1;0"/);
  });

  it('reverses travel via keyPoints', () => {
    const m = { ...manifest, edges: [{ from: 'a', to: 'b', pulse: { dir: 'reverse' } }] };
    expect(render(m)).toMatch(/keyPoints="1;0"/);
  });

  it('adds no animation markup when an edge has no pulse', () => {
    const m = { ...manifest, edges: [{ from: 'a', to: 'b' }] };
    expect(render(m)).not.toMatch(/animateMotion/);
  });
});
