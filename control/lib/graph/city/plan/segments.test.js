import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { segmentLevel, withCityLevel } from './level.js';
import { withCityRef } from './ref.js';
import { cityGameOrder } from './game.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

const city = (rec = {}) => designCity(inferCity({ seed: 3, grammar: 'new-york', board: { cols: 20, rows: 14 }, segments: true, ...rec }).recipe);

describe('segments: the city cut along its streets into the pieces it is played in', () => {
  const d = city();
  it('tile the frame exactly, each about a level across', () => {
    const area = d.segments.reduce((a, s) => a + (s.rect.x1 - s.rect.x0) * (s.rect.y1 - s.rect.y0), 0);
    expect(area).toBeCloseTo(d.frame.W * d.frame.D, 3);
    const [lo, hi] = d.plan.segments.across;
    for (const s of d.segments) for (const side of [s.rect.x1 - s.rect.x0, s.rect.y1 - s.rect.y0]) {
      expect(side).toBeGreaterThan(lo * 0.6);
      expect(side).toBeLessThan(hi * 1.4);
    }
  });
  it('cut at every straight run of the spine, always', () => {
    const xs = new Set(d.segments.flatMap((s) => [s.rect.x0, s.rect.x1]).map((v) => Math.round(v)));
    for (const st of d.streets.filter((x) => x.source === 'spine' && x.pts[0][0] === x.pts[1][0])) expect(xs.has(Math.round(st.pts[0][0]))).toBe(true);
  });
  it('join each pair of neighbours by one portal, the same from either side, on a street crossing their edge', () => {
    for (const s of d.segments) for (const nb of s.neighbours) {
      const back = d.segments.find((x) => x.id === nb.id).neighbours.find((x) => x.id === s.id);
      expect(back.portal).toEqual(nb.portal);
      expect(d.streets.some((x) => x.id === nb.portal.street)).toBe(true);
    }
    expect(d.segments.every((s) => s.neighbours.length >= 2)).toBe(true);
  });
  it('roll no dice: a lot by hand moves no segment', () => {
    const lot = d.lots.find((l) => l.use === 'mixed');
    const e = city({ lots: { [lot.id]: { storeys: 40 } } });
    expect(e.segments.map((s) => [s.id, s.rect, s.neighbours])).toEqual(d.segments.map((s) => [s.id, s.rect, s.neighbours]));
  });
});

describe('a segment as a level', () => {
  const d = city(), s = d.segments.find((x) => x.neighbours.length >= 3) ?? d.segments[0];
  const L = segmentLevel(d, s.id, { cityRef: 'sk_city' });
  const inRect = (p) => p[0] * U >= s.rect.x0 - 1 && p[0] * U <= s.rect.x1 + 1 && p[1] * U >= s.rect.y0 - 1 && p[1] * U <= s.rect.y1 + 1;
  it('leaves by an exit per neighbour, named for it, leading to its level', () => {
    expect(L.exits.map((x) => x.id)).toEqual(s.neighbours.map((n) => n.id));
    expect(L.exits.map((x) => x.to)).toEqual(s.neighbours.map((n) => `sk_city-${n.id}`));
  });
  it('arrives inside, clear of the way back out', () => {
    expect(inRect(L.spawn)).toBe(true);
    for (const x of L.exits) {
      expect(inRect(x.arrive)).toBe(true);
      expect(Math.hypot(x.arrive[0] - x.at[0], x.arrive[1] - x.at[1])).toBeGreaterThan(x.radius);
    }
  });
  it('walls its edges, open only at its portals', () => {
    const edges = L.colliders.filter((c) => c.of.startsWith('edge'));
    expect(edges.length).toBeGreaterThan(4);
    const blocked = (p) => edges.some((c) => p[0] >= c.min[0] && p[0] <= c.max[0] && p[1] >= c.min[1] && p[1] <= c.max[1]);
    for (const x of L.exits) expect(blocked(x.at)).toBe(false);
    expect(L.colliders.some((c) => c.of.startsWith('lot:'))).toBe(true);
  });
  it('a city of one segment is played to its farthest crossing', () => {
    // no spine (a spine line always cuts), a span wider than the city
    const one = designCity(inferCity({ seed: 3, grammar: 'paris', board: { cols: 4, rows: 3 }, spine: [], segments: { across: [180, 2000] } }).recipe);
    expect(one.segments.length).toBe(1);
    const L1 = segmentLevel(one, one.segments[0].id);
    expect(L1.exits).toEqual([]);
    expect(L1.goal.at).toHaveLength(3);
  });
  it('lowers to the game channel, the walker and its arrivals', () => {
    const m = withCityLevel({ kind: 'city', ...d.plan, cityRef: 'sk_city', level: { segment: s.id } }, d, `sk_city-${s.id}`);
    expect(m.game.mechanics.every((x) => x.kind === 'reach-exit' && x.exit)).toBe(true);
    expect(m.game.arrive).toEqual(s.neighbours.map((n) => `sk_city-${n.id}`));
    expect(m.events.reactions.map((r) => r.on)).toEqual(s.neighbours.map((n) => `arrive:sk_city-${n.id}`));
    expect(m.entities[0].pilotable).toBe(true);
  });
  it('names a segment the city has, and asks for segments first', () => {
    expect(segmentLevel(d, 'r9c9').error).toMatch(/no segment 'r9c9'/);
    expect(() => readCityPlan({ level: { segment: 'r1c1' } })).toThrow(/give it segments: true/);
  });
});

describe('a level reads its city by ref, and the game is ordered from the segments', () => {
  const base = { kind: 'city', ...inferCity({ seed: 3, segments: { levels: true } }).recipe, title: 'the city' };
  it('merges the city under the level\'s own keys, keeping the city\'s ref', () => {
    const m = withCityRef({ kind: 'city', city: 'sk_c', level: { segment: 'r1c1' }, title: 'lv' }, () => base);
    expect(m).toMatchObject({ cityRef: 'sk_c', title: 'lv', level: { segment: 'r1c1' }, play: base.play, spine: base.spine });
    expect(m.city).toBeUndefined();
    expect(() => withCityRef({ kind: 'city', city: 'sk_x' }, () => ({ kind: 'stage' }))).toThrow(/not a stored city plan/);
    expect(() => withCityRef({ kind: 'city', city: 'sk_x' }, () => ({ kind: 'city', city: 'sk_y' }))).toThrow(/itself a segment level/);
  });
  it('orders the map from the segment holding the core, every exit answered from the other side', () => {
    const d = designCity(base), order = cityGameOrder(d, 'sk_c', 'the city');
    const core = d.segments.find((s) => d.field.cx >= s.rect.x0 && d.field.cx < s.rect.x1 && d.field.cy >= s.rect.y0 && d.field.cy < s.rect.y1);
    expect(order.createGame.levels[0].ref).toBe(`sk_c-${core.id}`);
    expect(order.createGame.store.slices).toEqual([{ name: 'campaign', kind: 'progression' }]);
    for (const lv of order.createGame.levels) for (const x of lv.exits) expect(order.createGame.levels.find((l) => l.ref === x.to).exits.map((y) => y.to)).toContain(lv.ref);
  });
});
