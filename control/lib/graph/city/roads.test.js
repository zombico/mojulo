import { describe, expect, it } from 'vitest';

import { roadRibbons, straightPath, streetcarTrack, streetcarPlatform } from './roads.js';

describe('road ribbon profiles', () => {
  it('adds dedicated outer bike lanes as seeded road-layer ribbons', () => {
    const path = straightPath([0, 0], [8, 0], 2);
    const plain = roadRibbons({ path, width: 2.2, laneLine: true, lanes: 2 });
    const withBike = roadRibbons({ path, width: 2.2, laneLine: true, lanes: 2, bikeLanes: 'outer' });

    expect(withBike.ribbons.length).toBeGreaterThan(plain.ribbons.length);
    expect(withBike.ribbons.filter((r) => r.tint === '#357a5b')).toHaveLength(2);
    expect(withBike.ribbons.filter((r) => r.tint === '#d7ead9')).toHaveLength(2);
  });
});

describe('streetcar track', () => {
  const path = straightPath([0, 0], [0, 20], 20);   // a vertical line (rails offset in x)
  const track = streetcarTrack({ path, gauge: 0.56, wireZ: 3.2, poleEvery: 5 });

  it('lays twin rails at gauge width on the ground', () => {
    const rails = track.ribbons.filter((r) => r.tint === '#aab2bb');
    expect(rails).toHaveLength(2);
    const xs = rails.map((r) => r.path[0][0]).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeCloseTo(0.56, 5);     // rail-to-rail = gauge
    expect(rails.every((r) => r.z1 <= 0.12)).toBe(true);   // rails sit on the ground
  });

  it('runs an overhead contact wire down the centreline at wireZ', () => {
    const wire = track.ribbons.find((r) => r.tint === '#26282c');
    expect(wire).toBeTruthy();
    expect(wire.z0).toBeCloseTo(3.2, 5);
    expect(wire.path[0][0]).toBeCloseTo(0, 5);      // centred over the track
  });

  it('carries the wire on cantilever poles (mast + bracket + hanger)', () => {
    const kinds = new Set(track.boxes.map((b) => b.kind));
    expect(kinds.has('tram-pole')).toBe(true);
    expect(kinds.has('tram-bracket')).toBe(true);
    expect(kinds.has('tram-hanger')).toBe(true);
    const poles = track.boxes.filter((b) => b.kind === 'tram-pole');
    expect(poles.length).toBeGreaterThan(0);
    expect(poles.every((p) => p.z1 > 3.2)).toBe(true);   // mast rises past the wire
  });
});

describe('streetcar platform', () => {
  const plat = streetcarPlatform({ center: [0, 0], axis: 'x', side: 1, length: 6, width: 1.4, height: 0.26, wallHeight: 2.2 });

  it('raises a boarding slab with a yellow safety strip at the track edge', () => {
    const slab = plat.boxes.find((b) => b.kind === 'platform');
    expect(slab).toBeTruthy();
    expect(slab.z1).toBeCloseTo(0.26, 5);
    const strip = plat.grounds.find((g) => g.fill === '#e6c33a');
    expect(strip).toBeTruthy();
    expect(strip.z).toBeGreaterThan(slab.z1);            // strip sits on top of the slab
  });

  it('stands a paneled back wall above the slab', () => {
    const wall = plat.boxes.find((b) => b.kind === 'platform-wall');
    expect(wall).toBeTruthy();
    expect(wall.z0).toBeCloseTo(0.26, 5);                // rises from the slab top
    expect(wall.z1).toBeCloseTo(0.26 + 2.2, 5);
    expect(plat.boxes.filter((b) => b.kind === 'platform-panel').length).toBeGreaterThanOrEqual(2);
  });

  it('caps the bay with a canopy roof on front posts (droppable via roof:false)', () => {
    const roofSlab = plat.boxes.find((b) => b.kind === 'platform-roof');
    expect(roofSlab).toBeTruthy();
    expect(roofSlab.z0).toBeCloseTo(0.26 + 2.2, 5);                 // sits atop the back wall
    expect(plat.boxes.filter((b) => b.kind === 'platform-post').length).toBeGreaterThanOrEqual(2);
    const bare = streetcarPlatform({ center: [0, 0], axis: 'x', side: 1, length: 6, roof: false });
    expect(bare.boxes.some((b) => b.kind === 'platform-roof')).toBe(false);
  });
});
