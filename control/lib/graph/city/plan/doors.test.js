import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { lobbyOf, doorOf, frontFrame, insideOf, LOBBY } from './doors.js';
import { segmentLevel, withCityLevel } from './level.js';
import { cityBoxes } from './scene.js';
import { cityGameOrder } from './game.js';

const city = (rec = {}) => designCity(inferCity({ seed: 6, grammar: 'new-york', segments: { levels: true }, ...rec }).recipe);

describe('the two ways into a city\'s buildings', () => {
  const d = city();
  it('each segment picks its walk-ins and its door, by default two and one, no lot twice', () => {
    for (const s of d.segments) {
      const mine = d.entries.filter((e) => e.segment === s.id && !e.error);
      expect(mine.filter((e) => e.enter === 'walk')).toHaveLength(2);
      expect(mine.filter((e) => e.enter === 'door')).toHaveLength(1);
    }
    expect(new Set(d.entries.map((e) => e.lot)).size).toBe(d.entries.length);
    expect(JSON.stringify(city().entries)).toBe(JSON.stringify(d.entries));
  });
  it('takes a lot by hand and its inside, and refuses what is off the card', () => {
    const lot = d.lots.find((l) => l.use === 'mixed' && !d.entries.some((e) => e.lot === l.id));
    const e = city({ lots: { [lot.id]: { enter: 'door', inside: { kind: 'store', card: 'bookstore' } } } }).entries.find((x) => x.lot === lot.id);
    expect(e).toMatchObject({ enter: 'door', byHand: true, inside: { kind: 'store', card: 'bookstore' } });
    expect(() => readCityPlan({ lots: { [lot.id]: { enter: 'climb' } } })).toThrow(/enter is 'walk'/);
    expect(() => readCityPlan({ lots: { [lot.id]: { inside: { kind: 'office' } } } })).toThrow(/give it enter: 'door'/);
    expect(() => readCityPlan({ lots: { [lot.id]: { enter: 'door', inside: { kind: 'castle' } } } })).toThrow(/inside is \{ kind: 'office'/);
    expect(() => readCityPlan({ segments: { levels: true, enter: { walk: 9 } } })).toThrow(/segments.enter is \{ walk\?, door\? \}/);
  });
  it('a door leads into an office from an office or a tower, a store or a restaurant from a shop', () => {
    expect(insideOf({ id: 'a.1', tower: true }).kind).toBe('office');
    expect(['store', 'restaurant']).toContain(insideOf({ id: 'a.2', use: 'mixed' }).kind);
  });
});

describe('a walk-in: its ground storey a lobby, part of the map', () => {
  const d = city(), e = d.entries.find((x) => x.enter === 'walk' && !x.error), l = d.lots.find((x) => x.id === e.lot), lb = lobbyOf(l, {});
  it('opens its door onto the walk and keeps its walls either side', () => {
    const F = frontFrame(l), walls = lb.colliders.filter((c) => c.of.endsWith(':wall'));
    const doorMid = F.P(F.w / 2, 0.15);
    const hit = (p) => walls.some((c) => p[0] >= c.min[0] && p[0] <= c.max[0] && p[1] >= c.min[1] && p[1] <= c.max[1]);
    expect(hit(doorMid)).toBe(false);
    expect(hit(F.P(0.5, 0.1))).toBe(true);
    expect(hit(F.P(F.w - 0.5, 0.1))).toBe(true);
    expect(lb.height).toBeLessThanOrEqual(LOBBY.height);
    expect(lb.faces.some((f) => f.group === 'city:lobby-counter')).toBe(true);
  });
  it('stands its facade on the lobby, and the level walls the lobby, not the whole lot', () => {
    const box = cityBoxes(d).find((b) => b.lot === l.id);
    expect(box.z0 * 3.66).toBeCloseTo(lb.height, 1);
    const L = segmentLevel(d, e.segment, { cityRef: 'sk_c' });
    expect(L.colliders.some((c) => c.of === `lot:${l.id}`)).toBe(false);
    expect(L.colliders.some((c) => c.of === `lot:${l.id}:over`)).toBe(true);
    expect(L.lobbies).toContain(l.id);
  });
});

describe('a door scene: the door a zone on the walk, the inside a level of its own', () => {
  const d = city(), e = d.entries.find((x) => x.enter === 'door' && !x.error), l = d.lots.find((x) => x.id === e.lot);
  it('stands its zone before the door and a walker coming out clear of it, facing the street', () => {
    const D = doorOf(l), F = frontFrame(l);
    expect(Math.hypot(D.spawn[0] - D.at[0], D.spawn[1] - D.at[1])).toBeGreaterThan(1.4);
    expect(Math.cos(D.heading)).toBeCloseTo(-F.v[0], 2);   // a heading is kept to two decimals
    expect(Math.sin(D.heading)).toBeCloseTo(-F.v[1], 2);
  });
  it('lowers to a door mechanic in its segment\'s level, and the game links it to its inside\'s out door', () => {
    const m = withCityLevel({ kind: 'city', ...d.plan, cityRef: 'sk_c', level: { segment: e.segment } }, d, `sk_c-${e.segment}`);
    expect(m.game.mechanics.find((x) => x.kind === 'door')).toMatchObject({ id: e.door.id });
    const order = cityGameOrder(d, 'sk_c', 'NY');
    const lk = order.createGame.links.find((x) => x.from.door === e.door.id);
    expect(lk).toEqual({ from: { ref: `sk_c-${e.segment}`, door: e.door.id }, to: { ref: `sk_c-in-${e.lot.replace(/\./g, '-')}`, door: 'out' } });
    expect(order.interiors.find((x) => x.door === e.door.id).manifest.level).toEqual({ door: 'out' });
  });
});
