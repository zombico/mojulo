import { describe, expect, it } from 'vitest';

import { sampleStickerCard, stickerContext } from './polygonizer/vehicle-fuselage-net.js';
import { buildFacadeCard, projectCardOntoQuad, expandSurfaceCards } from './facade-card.js';
import { makeLight, scaleHex } from './polygonizer/vexar.js';

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

  it('carries World shirt/finband realizer hints (body sheet + proud structure)', () => {
    const glass = buildFacadeCard({ ...facade, rhythm: 'grid' }, 4, 3);
    expect(glass.material).toBe('glass');
    expect(glass.frameHex).toBe('#334455');     // mullions = the proud structure
    expect(glass.floors).toBe(4);
    expect(glass.bays).toBe(3);
    const brick = buildFacadeCard({ ...facade, material: 'brick', rhythm: 'punched' }, 5, 4);
    expect(brick.material).toBe('brick');
    expect(brick.frameHex).toBe('#88aacc');     // the brick body IS the proud shirt
    expect(brick.bodyHex).not.toBe('#88aacc');  // recessed window sheet is dark, distinct from brick
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
    // glass shirt, 3 bays × 4 floors: body + 4 piers (3 facets) + 5 spandrels (3 facets,
    // but the 2 boundary spandrels drop their roof/floor-plane cheek → 2 facets each)
    expect(out.length).toBe(1 + (1 + 3 * 4 + 3 * 3 + 2 * 2));
  });
});

describe('projectCardOntoQuad (shirt / finband realizer)', () => {
  // a -y wall face (like cityBox emits): U=+x (width 2), V=+z (height 3), normal=-y
  const wall = [[0, 0, 0], [2, 0, 0], [2, 0, 3], [0, 0, 3]];
  const facade = { glass: '#88aacc', frame: '#334455', glassVar: 1 };

  it('emits a body sheet plus self-shading frame bars (3 facets each)', () => {
    const card = buildFacadeCard(facade, 4, 3);  // grid: 4 piers + 5 spandrels = 9 bars
    const faces = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.06 });
    // 4 piers (3 facets) + 3 interior spandrels (3) + 2 boundary spandrels (2, no roof/floor cheek)
    expect(faces.length).toBe(1 + 3 * 4 + 3 * 3 + 2 * 2);
    // body sheet first, recessed inward by the shirt thickness (normal -y → +y)
    expect(faces[0].corners.every((c) => c[1] === 0.06)).toBe(true);
    for (const f of faces) expect(f.corners.length).toBe(4);
  });

  it('lands the proud frame face on the wall quad and recesses the body inward', () => {
    const card = buildFacadeCard(facade, 4, 3);
    const faces = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.06 });
    // normal is -y → inward is +y. The frame's frontmost (proud) face sits on the wall
    // plane (y=0, the box footprint); the body sheet recesses to y ≈ +0.06.
    const frameYs = faces.slice(1).flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.min(...frameYs)).toBeCloseTo(0, 5);          // proud face on the footprint
    expect(Math.max(...frameYs)).toBeCloseTo(0.06, 5);       // cheeks drop back to the body
    expect(faces[0].corners.every((c) => c[1] === 0.06)).toBe(true);
  });

  it('self-shades return cheeks from the scene light (directional mass, not flat)', () => {
    const card = buildFacadeCard(facade, 4, 3);
    const light = makeLight({ direction: [0.4, 0.5, -0.76] });
    const lit = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.06, light });
    const flat = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.06, light: null });
    const distinct = (fs) => new Set(fs.slice(1).map((f) => f.fill)).size;
    expect(distinct(lit)).toBeGreaterThan(1);    // cheeks differ → directional shading
    // the lit pass shades cheeks by true side-normal, the flat fallback by fixed ratio
    expect(lit.map((f) => f.fill).join()).not.toBe(flat.map((f) => f.fill).join());
  });

  it('extends the two end piers past the wall edges for the per-wall corner seal', () => {
    const card = buildFacadeCard(facade, 4, 3);
    const faces = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.06 });
    const us = faces.flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.min(...us)).toBeLessThan(0);     // start pier reaches u < 0
    expect(Math.max(...us)).toBeGreaterThan(2);  // end pier reaches u > Ulen
  });

  it('brick → fin-band: dark recessed body, brick proud, layered (more facets)', () => {
    const card = buildFacadeCard({ ...facade, material: 'brick', rhythm: 'punched' }, 5, 4);
    const faces = projectCardOntoQuad(wall, card, { lit: 1, relief: 0.06 });
    expect(faces[0].fill).toBe(scaleHex(card.bodyHex, 1)); // body sheet = dark window
    // fins + fat spandrels + piers → richer than the plain shirt grid
    expect(faces.length).toBeGreaterThan(1 + 3 * 9);
  });

  it('can omit the body sheet', () => {
    const card = buildFacadeCard(facade, 4, 3);
    const withBase = projectCardOntoQuad(wall, card, { lit: 1 });
    const noBase = projectCardOntoQuad(wall, card, { lit: 1, includeBase: false });
    expect(noBase.length).toBe(withBase.length - 1);
  });
});
