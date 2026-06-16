import { describe, expect, it } from 'vitest';

import { sampleStickerCard, stickerContext } from './polygonizer/vehicle-fuselage-net.js';
import { buildFacadeCard, projectCardOntoQuad, expandSurfaceCards } from './facade-card.js';

describe('grid mark (shared sticker sampler)', () => {
  const card = {
    base: '#000000', wrap: null,
    parts: [{ kind: 'grid', role: 'p', u0: 0, u1: 1, v0: 0, v1: 1, countU: 2, countV: 2, gapU: 0.1, gapV: 0.1, fill: '#ffffff' }],
  };
  const ctx = stickerContext(card, 1, 1);

  it('hits inside a cell → the mark fill', () => {
    expect(sampleStickerCard(card, 0.25, 0.25, ctx)).toBe('#ffffff');
    expect(sampleStickerCard(card, 0.75, 0.75, ctx)).toBe('#ffffff');
  });

  it('falls into the gap between cells → the base', () => {
    expect(sampleStickerCard(card, 0.5, 0.5, ctx)).toBe('#000000'); // mullion gap
    expect(sampleStickerCard(card, 0.25, 0.5, ctx)).toBe('#000000'); // floor gap
  });

  it('outside the grid extent → the base', () => {
    expect(sampleStickerCard({ ...card, parts: [{ ...card.parts[0], u0: 0.2, u1: 0.8, v0: 0.2, v1: 0.8 }] }, 0.05, 0.05, ctx)).toBe('#000000');
  });
});

describe('buildFacadeCard', () => {
  const facade = { glass: '#88aacc', frame: '#334455', glassVar: 1 };

  it('maps bays/floors to a grid mark, structure color as base', () => {
    const card = buildFacadeCard(facade, 4, 3);
    expect(card.base).toBe('#334455');
    const grid = card.parts.find((p) => p.kind === 'grid');
    expect(grid.countU).toBe(3); // bays
    expect(grid.countV).toBe(4); // floors
    expect(typeof grid.fill).toBe('string');
  });

  it('clamps degenerate counts (≥2 floors, ≥1 bay)', () => {
    const card = buildFacadeCard(facade, 0, 0);
    const grid = card.parts.find((p) => p.kind === 'grid');
    expect(grid.countV).toBe(2);
    expect(grid.countU).toBe(1);
  });

  it('maps brick to dark windows over the brick body (not a structure base)', () => {
    const card = buildFacadeCard({ ...facade, material: 'brick', rhythm: 'punched' }, 5, 4);
    expect(card.base).toBe('#88aacc'); // glass field = brick body color
    const grid = card.parts.find((p) => p.kind === 'grid');
    expect(grid.fill).not.toBe('#88aacc'); // dark recessed window, distinct from body
  });

  it('varies gap ratios by rhythm (piers carry thicker vertical structure than a plain grid)', () => {
    const grid = buildFacadeCard({ ...facade, rhythm: 'grid' }, 6, 6).parts[0];
    const pier = buildFacadeCard({ ...facade, rhythm: 'pier' }, 6, 6).parts[0];
    expect(pier.gapU).toBeGreaterThan(grid.gapU);
  });
});

describe('expandSurfaceCards', () => {
  const wall = [[0, 0, 0], [2, 0, 0], [2, 0, 3], [0, 0, 3]];
  const facade = { glass: '#88aacc', frame: '#334455', glassVar: 1 };

  it('expands carded faces and passes untagged faces through untouched', () => {
    const flat = { corners: wall, fill: '#777777' };
    const carded = { corners: wall, card: buildFacadeCard(facade, 4, 3), lit: 1 };
    const out = expandSurfaceCards([flat, carded]);
    expect(out[0]).toBe(flat);                 // untagged: same object, untouched
    expect(out.length).toBe(1 + (1 + 12));     // flat + (base + 12 panes)
  });
});

describe('projectCardOntoQuad', () => {
  // a -y wall face (like cityBox emits): U=+x (width 2), V=+z (height 3), normal=-y
  const wall = [[0, 0, 0], [2, 0, 0], [2, 0, 3], [0, 0, 3]];
  const facade = { glass: '#88aacc', frame: '#334455', glassVar: 1 };

  it('emits the base quad plus one facet per window cell', () => {
    const card = buildFacadeCard(facade, 4, 3); // 3×4 = 12 panes
    const faces = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.02 });
    expect(faces.length).toBe(1 + 12);
    expect(faces[0].corners).toEqual(wall);       // base first, unmoved
    for (const f of faces) expect(f.corners.length).toBe(4);
  });

  it('pushes pane facets proud of the wall along the face normal', () => {
    const card = buildFacadeCard(facade, 4, 3);
    const faces = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.05 });
    // normal is -y, so proud panes sit at y ≈ -0.05; the base stays at y=0
    const paneYs = faces.slice(1).flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.min(...paneYs)).toBeCloseTo(-0.05, 5);
    expect(faces[0].corners.every((c) => c[1] === 0)).toBe(true);
  });

  it('can omit the base quad', () => {
    const card = buildFacadeCard(facade, 4, 3);
    const faces = projectCardOntoQuad(wall, card, { includeBase: false });
    expect(faces.length).toBe(12);
  });
});
