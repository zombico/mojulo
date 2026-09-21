import { describe, it, expect, vi } from 'vitest';

// The package version is one of the salts; pin it so the test controls it.
const version = { current: '2.0.6' };
vi.mock('@/lib/server-version', () => ({ getServerVersion: () => version.current }));

import { etagFor, pickFlags, renderCacheKey } from '@/lib/graph/sketch/render-etag';

const manifest = { kind: 'fractal-city', seed: 7 };

describe('renderCacheKey', () => {
  it('is stable for the same recipe, flags and code', () => {
    const a = renderCacheKey({ ref: 'sk_a', manifest, flags: { wire: '' }, version: 'v1' });
    const b = renderCacheKey({ ref: 'sk_a', manifest: { ...manifest }, flags: { wire: '' }, version: 'v1' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('moves with the recipe, the flags and the ref', () => {
    const base = renderCacheKey({ ref: 'sk_a', manifest, flags: { wire: '' }, version: 'v1' });
    expect(renderCacheKey({ ref: 'sk_a', manifest: { ...manifest, seed: 8 }, flags: { wire: '' }, version: 'v1' })).not.toBe(base);
    expect(renderCacheKey({ ref: 'sk_a', manifest, flags: { wire: '1' }, version: 'v1' })).not.toBe(base);
    expect(renderCacheKey({ ref: 'sk_b', manifest, flags: { wire: '' }, version: 'v1' })).not.toBe(base);
  });

  it('moves with the route\'s code version — the hand-bumped salt', () => {
    const v1 = renderCacheKey({ ref: 'sk_a', manifest, version: 'v1' });
    const v2 = renderCacheKey({ ref: 'sk_a', manifest, version: 'v2' });
    expect(v2).not.toBe(v1);
  });

  it('moves with the package version — an upgrade invalidates browser-held pages once', () => {
    const before = renderCacheKey({ ref: 'sk_a', manifest, version: 'v1' });
    version.current = '2.0.7';
    try {
      expect(renderCacheKey({ ref: 'sk_a', manifest, version: 'v1' })).not.toBe(before);
    } finally {
      version.current = '2.0.6';
    }
    expect(renderCacheKey({ ref: 'sk_a', manifest, version: 'v1' })).toBe(before);
  });
});

describe('pickFlags / etagFor', () => {
  it('reads the named flags in order, absent ones as empty strings', () => {
    const search = new URLSearchParams('wire=1&view=exterior&unrelated=x');
    expect(pickFlags(search, ['view', 'wire', 'walk'])).toEqual({ view: 'exterior', wire: '1', walk: '' });
  });

  it('formats a quoted, prefixed, 32-hex ETag', () => {
    const key = renderCacheKey({ ref: 'sk_a', manifest, version: 'v1' });
    const etag = etagFor('w', key);
    expect(etag).toBe(`"w-${key.slice(0, 32)}"`);
  });
});
