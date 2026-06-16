import { describe, expect, it } from 'vitest';

import { buildingExtras } from './building-facade.js';

describe('building facade extras', () => {
  it('renders storefronts as first-floor grouped panes and a header band', () => {
    const extras = buildingExtras(
      { x: 0, y: 0, w: 5, d: 1, z0: 0, z1: 4 },
      {
        storefront: true,
        storefrontTint: '#243848',
        storefrontTrim: '#d6c59b',
        awningTint: '#5a6068',
        rooftopKit: [],
      },
      4,
      5,
    );

    expect(extras.decals.some((d) => d.fill === '#d6c59b')).toBe(true);
    expect(extras.decals.filter((d) => d.fill === '#243848')).toHaveLength(4);
    expect(extras.decals.filter((d) => d.fill === '#18242e')).toHaveLength(1);
    expect(extras.boxes.some((b) => b.tint === '#5a6068')).toBe(true);
  });

  it('renders rooftop billboard kit as posts, panel, and sign decal', () => {
    const extras = buildingExtras(
      { x: 0, y: 0, w: 6, d: 1.2, z0: 0, z1: 5 },
      { noEntrance: true, rooftopKit: ['billboard'] },
      5,
      4,
    );

    expect(extras.boxes.filter((b) => b.tint === '#555a60')).toHaveLength(2);
    expect(extras.boxes.some((b) => b.tint === '#2f3f59')).toBe(true);
    expect(extras.decals.some((d) => d.fill === '#f0d36a')).toBe(true);
  });
});
