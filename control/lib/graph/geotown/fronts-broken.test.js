// A SHOP ROW'S FRONTS BROKEN UP (a geotown's `fronts: 'broken'`): each shop's house its own over the shop. Opt-in:
// unsaid, a row is as it was.
import { describe, it, expect } from 'vitest';
import { readGeotown, FRONTS } from './read.js';
import { designGeotown } from './design.js';
import { PATTERNS } from './pattern.js';
import { frontOf } from './fronts.js';

// (a pattern whose shop row says how it breaks: chosen from the registry, not by name)
const [id, P] = Object.entries(PATTERNS).find(([, p]) => p.rows.shops?.broken?.length);

describe('the word', () => {
  it('is opt-in: unsaid the spec carries nothing; said, it is carried; another value is refused', () => {
    expect(readGeotown({ pattern: id, segment: 'main-street' }).fronts).toBeUndefined();
    expect(readGeotown({ pattern: id, segment: 'main-street', fronts: 'broken' }).fronts).toBe('broken');
    expect(() => readGeotown({ pattern: id, fronts: 'tidy' })).toThrow(/fronts is 'broken'/);
    for (const f of FRONTS) expect(P.rows.shops[f].length, f).toBeGreaterThan(1);
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

describe('alleys and setbacks', () => {
  const shops = (spec, seed) => designGeotown({ pattern: id, segment: 'main-street', hills: false, ...spec }, { seed }).plots.filter((p) => p.kind === 'shops');
  // (the first seed whose row rolls both: found, not named)
  const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((s) => { const S = shops({ fronts: FRONTS[0] }, s); return S.some((p) => p.alleyBeside) && S.some((p) => p.house.env[1] > p.setback); });
  it('a broken row has an alley beside some buildings and some set back behind a paved forecourt', () => {
    expect(seed).toBeTruthy();
    const S = shops({ fronts: FRONTS[0] }, seed), Bk = P.rows.shops.breaks;
    for (const p of S.filter((q) => q.alleyBeside)) {
      const gap = p.w - p.house.env[2];
      expect(gap).toBeGreaterThanOrEqual(Bk.alley.w[0] - 1e-6); expect(gap).toBeLessThanOrEqual(Bk.alley.w[1] + 1e-6);
      expect(p.corner).toBeFalsy();
    }
    // (never two running)
    S.forEach((p, k) => { if (p.alleyBeside && S[k + 1]?.block === p.block && S[k + 1]?.side === p.side) expect(S[k + 1].alleyBeside).toBeFalsy(); });
    for (const p of S.filter((q) => q.house.env[1] > q.setback)) { expect(p.paved).toBe(true); expect(p.house.env[1] - p.setback).toBeLessThanOrEqual(Bk.setback.by[1] + 1e-6); }
  });
  it('unsaid, the row is as it was: party wall to party wall, built to the walk', () => {
    for (const p of shops({}, seed)) { expect(p.alleyBeside).toBeUndefined(); expect(p.house.env[1]).toBe(p.setback); expect(p.house.env[2]).toBe(p.w); }
  });
});

describe('the rough quarter\'s ground', () => {
  it('names the finishes it changes, each a finish the pattern already has', () => {
    const G = P.grounds?.rough;
    expect(G).toBeTruthy();
    for (const k of Object.keys(G)) { expect(P.finishes[k], k).toBeTruthy(); expect(G[k]).not.toBe(P.finishes[k]); }
  });
});
