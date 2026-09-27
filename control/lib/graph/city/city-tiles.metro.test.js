import { describe, expect, it, vi } from 'vitest';
import { streamSizing, cityStreamPayload, STREAM_TILE, STREAM_NEAR, STREAM_CACHE } from './city-tiles.js';

vi.setConfig({ testTimeout: 120000 });

// A metro block is ≈ 25–40 units, so a metro city streams in larger tiles over wider radii, and its
// streamed page carries the metro sky + haze; every other recipe keeps the stock sizing and no haze.
describe('city-tiles: metro sizing', () => {
  it('sizes metro tiles to its blocks and leaves the stock city alone', () => {
    expect(streamSizing({ profile: 'metro' })).toEqual({ tile: 32, near: 80, cache: 160 });
    expect(streamSizing({})).toEqual({ tile: STREAM_TILE, near: STREAM_NEAR, cache: STREAM_CACHE });
  });
  it('a metro streamed page uses the metro grid, sky and haze', () => {
    const recipe = { kind: 'fractal-city', seed: 7, profile: 'metro', region: { x: 2, y: 2, w: 100, d: 70 }, insets: [] };
    const p = cityStreamPayload(recipe, { url: '/t' });
    expect(p.stream.grid.tile).toBe(32);
    expect(p.stream.near).toBe(80);
    expect(p.haze && p.haze.density).toBeGreaterThan(0);
    expect(Array.isArray(p.sky.zenith)).toBe(true);
    const stock = cityStreamPayload({ kind: 'fractal-city', seed: 7, insets: [] }, { url: '/t' });
    expect(stock.stream.grid.tile).toBe(STREAM_TILE);
    expect(stock.haze).toBeUndefined();
  });
});
