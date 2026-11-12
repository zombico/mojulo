// A trail's rockfall (skandart-land.js trailSkandart): its cliff's talus past the apron's toe, the biggest blocks rolled on
// to the walk's edge, and spalls round its big stones' feet. Held on a made land (a cliff at x = 0, its apron to x = 4,
// the walk at x = 12), then on one stage: asked, laid and joined to its rock; asked nothing, the land as it was.
import { describe, it, expect } from 'vitest';
import { trailSkandart, TRAIL_SKANDART } from './skandart-land.js';
import { assembleStageScene } from './stage.js';

const SITE = { D: 40, ground: () => 0, cliffX: () => 0, apronAt: (x) => (x > 0.5 && x < 4 ? 1 : 0), trailX: () => 12, halfWAt: () => 1, trailDist: (x) => Math.abs(x - 12) };
const ROCK = { x: 15, y: 20, r: 0.9, h: 1.3 };
const lay = (over = {}) => trailSkandart(SITE, { amount: 1, seed: 3, rocks: [ROCK], apronMin: 0.5, read: { least: 0.077, distance: 6, screenPx: 1080 }, ...over });
const of = (L, p) => L.heaps.filter((h) => h.tpl.startsWith(p));

describe('a trail\'s rockfall', () => {
  it('lays talus past the apron\'s toe, its biggest blocks at the walk\'s edge on the cliff\'s side, spalls round a big stone', () => {
    const L = lay();
    expect(L.laws.filter((r) => !r.ok)).toEqual([]);
    for (const h of of(L, 'talus')) { expect(h.at[0]).toBeGreaterThan(4); expect(h.at[0]).toBeLessThan(11); }
    const runners = of(L, 'runner');
    expect(runners.length).toBeGreaterThan(0);
    for (const h of runners) { expect(h.at[0]).toBeLessThan(11); expect(h.at[0]).toBeGreaterThan(9); }
    // (a ring round the stone: its faces round it, none in its middle)
    const ring = of(L, 'ring')[0], cs = ring.faces.flatMap((f) => f.corners), d = cs.map((c) => Math.hypot(c[0] - ROCK.x, c[1] - ROCK.y));
    expect(Math.max(...d)).toBeGreaterThan(ROCK.r + 0.2);
    expect(Math.min(...d)).toBeGreaterThan(ROCK.r * 0.5);
    // (its ground claimed, for the grass to keep off)
    expect(L.claims.length).toBe(L.heaps.length);
  });

  it('keeps every heap and block off the walk; more falls the more is asked; a small stone sheds no ring; the same every time', () => {
    for (const h of lay().heaps) for (const f of h.faces) for (const c of f.corners) expect(Math.abs(c[0] - 12)).toBeGreaterThan(1);
    expect(of(lay({ amount: 0.2 }), 'runner').length).toBeLessThan(of(lay(), 'runner').length);
    expect(of(lay({ rocks: [{ ...ROCK, h: TRAIL_SKANDART.ring.least / 2 }] }), 'ring')).toEqual([]);
    expect(JSON.stringify(lay())).toBe(JSON.stringify(lay()));
  });
});

describe('a trail\'s rockfall on a stage', () => {
  it('is laid when asked, joined to the land\'s rock and walked over; asked nothing, the land is as it was', () => {
    const M = { kind: 'stage', trail: {}, seed: 3, geocube: { from: 'island-noon' } };
    const plain = assembleStageScene(M, {}), fell = assembleStageScene({ ...M, skandart: 1 }, {});
    expect(plain.skandart).toBeUndefined();
    expect(fell.skandart).toMatchObject({ amount: 1, laws: [] });
    expect(fell.skandart.talus + fell.skandart.runners + fell.skandart.rings).toBe(fell.skandart.heaps);
    const rock = (P) => P.faces.filter((f) => f.group === 'isekai:rock').length;
    expect(rock(fell)).toBeGreaterThan(rock(plain));
    expect((fell.colliders ?? []).length).toBe((plain.colliders ?? []).length);
  }, 120_000);
});
