// A SHOP ROW'S FRONTS BROKEN UP (a geotown's `fronts: 'broken'`): each shop's house its own over the shop. Opt-in:
// unsaid, a row is as it was.
import { describe, it, expect } from 'vitest';
import { readGeotown } from './read.js';
import { PATTERNS } from './pattern.js';
import { frontOf } from './fronts.js';

// (a pattern whose shop row says how it breaks: chosen from the registry, not by name)
const [id, P] = Object.entries(PATTERNS).find(([, p]) => p.rows.shops?.broken?.length);

describe('the word', () => {
  it('is opt-in: unsaid the spec carries nothing; said, it is carried; another value is refused', () => {
    expect(readGeotown({ pattern: id, segment: 'main-street' }).fronts).toBeUndefined();
    expect(readGeotown({ pattern: id, segment: 'main-street', fronts: 'broken' }).fronts).toBe('broken');
    expect(() => readGeotown({ pattern: id, fronts: 'tidy' })).toThrow(/fronts is 'broken'/);
  });
});

describe('the row\'s table', () => {
  const B = P.rows.shops.broken;
  it('breaks the eaves and the colours: more than one height, every front its own render', () => {
    expect(new Set(B.map((b) => b.storeys[0])).size).toBeGreaterThan(1);
    const renders = B.map((b) => b.style.palette?.plaster).filter(Boolean);
    expect(new Set(renders).size).toBe(renders.length);
    for (const b of B) { expect(typeof b.read).toBe('string'); expect(b.storeys[0]).toBe(b.storeys[1]); }
  });
});

describe('balconies over a shop', () => {
  const dims = { W: 7, n: 4, storeyH: 3, doorX: 3.5, doorW: 1.2 };
  const count = (front) => frontOf(front, dims).faces.length;
  it('a front may say its balcony\'s size; over a shop they hang from the second floor up, over the door too', () => {
    const shop = count({ shop: true }), own = count({ shop: true, balconies: { w: 1.7, d: 0.6, stride: 2.6, edge: 0.4, rail: 0.95 } });
    expect(own).toBeGreaterThan(shop);
    // (a front with no shop keeps its door's bay clear, as before: one wide balcony over a 7 m front's door is none)
    expect(count({ balconies: true })).toBe(count({}));
  });
});
