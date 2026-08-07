import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import CreationMap from '@/components/graph/CreationMap';

// adaptive-signage in the SVG diagram backend: the value is the rendered,
// export-safe annotation — a SMIL toast, a CSS-hover tooltip, a static popup
// first page — not just the schema.
const base = {
  title: 'signed',
  viewBox: { width: 400, height: 200 },
  stations: [{ id: 'a', kind: 'mcp_tool', label: 'A', x: 20, y: 60, w: 120, h: 80 }],
};

const render = (m) => renderToStaticMarkup(React.createElement(CreationMap, { manifest: m }));

describe('signage render (SVG backend)', () => {
  it('renders nothing signage-related when no signage is present', () => {
    const svg = render(base);
    expect(svg).not.toMatch(/moj-sign/);
    expect(svg).not.toMatch(/<style/);
  });

  it('byte-identical to the pre-feature output when signage is absent', () => {
    const withEmpty = render({ ...base, signage: [] });
    const without = render(base);
    expect(withEmpty).toBe(without);
  });

  it('toast emits a native SMIL opacity pop+fade with its scheduled delay', () => {
    const svg = render({
      ...base,
      signage: [{ variant: 'toast', text: '+100', anchor: { slot: 'top' }, after: 0.5, ttl: 2 }],
    });
    expect(svg).toMatch(/<animate /);
    expect(svg).toMatch(/attributeName="opacity"/);
    expect(svg).toMatch(/begin="0\.5s"/);
    expect(svg).toMatch(/values="0;1;1;0"/);
    expect(svg).toMatch(/data-variant="toast"/);
  });

  it('tooltip emits the CSS :hover rule + a target hotspot + foreignObject card', () => {
    const svg = render({
      ...base,
      signage: [{ variant: 'tooltip', text: 'a note', anchor: { object: 'a' } }],
    });
    expect(svg).toMatch(/<style/);
    expect(svg).toMatch(/moj-sign\[data-variant="tooltip"\]:hover/);
    expect(svg).toMatch(/moj-sign-hot/);
    expect(svg).toMatch(/<foreignObject/);
    expect(svg).toMatch(/a note/);
  });

  it('popup renders a static first page with a page indicator', () => {
    const svg = render({
      ...base,
      signage: [{ variant: 'popup', body: ['p1', 'p2', 'p3', 'p4', 'p5'], anchor: { slot: 'center' }, pageLines: 2 }],
    });
    expect(svg).toMatch(/data-variant="popup"/);
    expect(svg).toMatch(/p1/);
    expect(svg).toMatch(/1\/3/); // 5 lines / 2 per page = 3 pages
    expect(svg).not.toMatch(/p3/); // page 2+ not shown statically
  });

  it('drops an object-anchored sign whose target station does not exist', () => {
    const svg = render({
      ...base,
      signage: [{ variant: 'tooltip', text: 'orphan', anchor: { object: 'missing' } }],
    });
    expect(svg).not.toMatch(/orphan/);
  });
});
