import { describe, it, expect } from 'vitest';
import { planMap, mapLaws, GRID, ROUTE, SEE_S } from './map.js';
import { airspaceOf, validateAirspace } from './airspace.js';
import { SEGMENT_KINDS } from './ground.js';
import { COLONY, SKINS } from './country.js';
import { coverPalette } from './aerial.js';
import { planRailStage } from './rail-stage.js';
import { readGeocube } from '../era/geocube.js';

// A ROUTE IN SEGMENTS (map.js `route`, ground.js `segments`): a rail stage's long way down a moon, its grid spent along
// it, its stretches a canyon walled, open country and a colony on the line in the colony's style (country.js); the
// rail laid down it (rail-stage.js). One small route holds every procedure: an open stretch, a colony, a canyon.
const SEGS = [{ kind: 'open', from: 0, to: 0.3 }, { kind: 'colony', from: 0.3, to: 0.55 }, { kind: 'canyon', from: 0.55, to: 1 }];
const CUBE = { from: 'island-noon', colour: { stone: '#75361f', floor: '#8a3f24', grass: '#a8633e', foliage: '#7a4a30', sand: '#c07045', water: '#3a2a2a' } };
const M = { kind: 'airspace', map: { form: 'canyon', craft: 'multirole', field: [13000, 4000], route: true }, rail: { speed: 120 }, seed: 3, ground: { segments: SEGS, geocube: CUBE, pads: [], country: { style: 'colony', roads: true, power: false } } };
const { map, field } = airspaceOf(M);
const S = planRailStage(map, field, { seed: 3, speed: 120 });
const F = map.rings.field, xOf = (u) => -F.hx + u * 2 * F.hx;

describe('a route map', () => {
  it('spends its grid along its way: finer cells than a square map of its length, its reach its field, seen ahead', () => {
    const square = planMap({ form: 'canyon', craft: 'multirole', field: 13000 });
    expect(map.route).toBe(true);
    expect(map.grid.cell).toBeLessThan(square.grid.cell);
    expect(map.grid.nx * map.grid.ny).toBeLessThanOrEqual(GRID.maxN * GRID.maxN * 1.1);
    expect(map.grid.nx).toBeLessThanOrEqual(ROUTE.maxN + 1);
    expect(map.rings.reach.hx - F.hx).toBe(ROUTE.margin);
    // (its laws its own: the way seen ahead, no turn back to need room for)
    const laws = mapLaws(map);
    expect(laws.every((l) => l.ok), JSON.stringify(laws)).toBe(true);
    expect(laws.map((l) => l.law)).toContain('way-seen');
    expect(laws.map((l) => l.law)).not.toContain('turn-room');
    expect(laws.find((l) => l.law === 'way-seen').note).toMatch(new RegExp(`${SEE_S}|\\d+ s of cruise`));
    expect(validateAirspace({ ...M, map: { ...M.map, route: 'yes' } }).join()).toMatch(/map\.route/);
  });
});

describe('a way in segments', () => {
  it('walls its canyon\'s stretch only: an open stretch and a colony\'s lie in a broad valley', () => {
    expect(Object.keys(SEGMENT_KINDS)).toEqual(['canyon', 'open', 'colony']);
    const G = field.gorge, wall = (u) => { const x = xOf(u), y = G.line(x); return field.groundAt(x, y + G.half + G.slope + 80) - field.groundAt(x, y); };
    expect(wall(0.8)).toBeGreaterThan(G.depth * 0.6);
    expect(wall(0.15)).toBeLessThan(G.depth * 0.3);
    expect(field.segments.map((g) => g.kind)).toEqual(['open', 'colony', 'canyon']);
    // (the rail's walled law reads its canyon only, and holds)
    expect(S.laws.every((l) => l.ok), JSON.stringify(S.laws)).toBe(true);
    expect(S.laws.find((l) => l.law === 'walled').note).toMatch(/down its canyon/);
  });

  it('stands a colony on the line in its stretch, and keeps the hazards out of it', () => {
    const [st] = field.country.settlements, mid = (st.land[0] + st.land[2]) / 2;
    expect(st.kind).toBe('colony');
    expect(mid).toBeGreaterThan(xOf(0.3) - 400);
    expect(mid).toBeLessThan(xOf(0.55) + 400);
    expect(S.hazards.every((h) => !(h.at[0] >= field.segments[1].x0 && h.at[0] <= field.segments[1].x1))).toBe(true);
    // (the way rises over what stands in the box's sweep, a spire included: never through a roof)
    for (let s = 0; s < S.length; s += 25) { const q = S.path[Math.min(S.path.length - 1, Math.round((s / S.length) * (S.path.length - 1)))]; expect(q[2]).toBeGreaterThan(field.topAt(q[0], q[1])); }
  });

  it('teaches on a bad ask', () => {
    const bad = (segments, m) => expect(validateAirspace({ ...M, ground: { ...M.ground, segments } }).join()).toMatch(m);
    bad([{ kind: 'swamp', from: 0, to: 1 }], /kind/);
    bad([{ kind: 'open', from: 0, to: 0.6 }, { kind: 'canyon', from: 0.4, to: 1 }], /after the stretch before/);
    bad([{ kind: 'open', from: 0, to: 1, settlement: 'town' }], /colony's card/);
    bad([], /1 to 12/);
  });
});

describe('the colony style', () => {
  const A = field.aerial;
  it('dresses the same settlement as a sci-fi colony: panelled blocks, domed habs, spires with lit masts, no gables', () => {
    expect(A.report.style).toBe('colony');
    expect(A.gables).toEqual([]);
    expect(A.report.domes).toBeGreaterThan(0);
    expect(A.rounds.filter((r) => r[6] === 1).length).toBe(A.report.domes);
    expect(A.report.spires).toBeGreaterThan(0);
    expect(A.masts.length).toBeGreaterThanOrEqual(A.report.spires);
    // (no house, flat or office windows: every block its panels' one lit band, or glass, or plain)
    expect(A.boxes.every((b) => [SKINS.glass, SKINS.industrial, SKINS.plain, SKINS.deck].includes(b[8]))).toBe(true);
    expect(A.boxes.filter((b) => b[8] === SKINS.glass).every((b) => COLONY.glass.includes(b[6]))).toBe(true);
    // (a spire's crown and mast are something a craft can hit)
    const top = A.boxes.reduce((t, b) => (b[2] + b[5] > t[2] + t[5] ? b : t));
    expect(field.topAt(top[0], top[1])).toBeGreaterThanOrEqual(top[2] + top[5] + COLONY.mast - 1);
  });

  it('lays the cover in its world\'s colours: a rust moon\'s plots are its dust, an earth town\'s are fields', () => {
    const cube = readGeocube(CUBE), earth = coverPalette(cube), colony = coverPalette(cube, { style: 'colony' });
    const red = (h) => parseInt(h.slice(1, 3), 16) - parseInt(h.slice(3, 5), 16);
    expect(red(colony.pasture)).toBeGreaterThan(red(earth.pasture) + 40);
    expect(A.cover.pasture).toBe(colony.pasture);
  });

  it('is deterministic', () => {
    const again = airspaceOf(M).field.aerial;
    expect(again.boxes).toEqual(A.boxes);
    expect(again.rounds).toEqual(A.rounds);
  });
});
