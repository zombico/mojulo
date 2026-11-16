// AN INDUSTRIAL FACILITY AS A FIGHTING MAP (facility.js). One yard, a window of one industrial block chosen from the
// city in code (the first segment this metro has a block of, at the place a design named), small and grown briefly. The
// concepts: the reader keeps the place's own things and the drawing stands them where the design put them; what the
// generator grew is the yard's own cover; a night is dark and lit where a flood stands, the floods over the map's
// prizes; by day there is no flood; rain wets it; the same yard draws the same; the search finds a yard with the
// place's things in it.
import { describe, expect, it } from 'vitest';
import { designFacility, facilityGround, isFacility, FACILITY } from './facility.js';
import { cityGround, readGroundMap } from './read-town.js';
import { growArenaMap } from './generate.js';
import { mapLaws } from './laws.js';
import { designGeocity } from '../geocity/design.js';
import { INDUSTRY_SEGMENTS } from '../geocity/segments.js';
import { industryRaw } from '../geocity/industry.js';

const CITY = designGeocity({}, { seed: 1 });
const ON = INDUSTRY_SEGMENTS.find((k) => CITY.regions.flatMap((r) => r.blocks ?? []).some((b) => b.kind === k));
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const mid = (f) => f.corners.reduce((a, c) => a.map((v, i) => v + c[i] / f.corners.length), [0, 0, 0]);
const meanLight = (f) => lum(f.cornerLight.reduce((a, c) => a.map((v, i) => v + c[i] / f.cornerLight.length), [0, 0, 0]));

describe('a facility, designed', () => {
  const F = designFacility({}, { seed: 1, on: ON, design: CITY, size: 30, most: 1, passes: 200 });
  it(`(${ON}) is a yard of the block with the place's own things standing in it, grown under the laws`, () => {
    expect(F.on).toBe(ON);
    expect(F.kinds.length).toBeGreaterThan(0);
    expect(isFacility(F.map)).toBe(true);
    expect(F.map.read.things.some((t) => !t.beyond)).toBe(true);
    expect(F.held).toBeGreaterThanOrEqual(mapLaws(readGroundMap(cityGround(CITY, { on: ON }), { at: F.at, size: 30 })).held);
    expect(F.laws.find((l) => l.law === 'connected').holds && F.laws.find((l) => l.law === 'bounded').holds).toBe(true);
  }, 240000);
  it('is drawn as itself: the slab, concrete walls, the pieces where the design put them, a short container where the generator grew a mass', () => {
    const G = facilityGround(F.map, { hour: 'night', weather: 'rain' }), groups = new Set(G.faces.map((f) => f.group));
    expect(groups.has('facility:apron') && groups.has('facility:wall')).toBe(true);
    // (each thing in the cut that the pieces draw is on the page, in its group)
    const RAW = industryRaw();
    for (const t of F.map.read.things.filter((x) => x.kind === 'stamp' && RAW[x.key])) expect(groups.has(`facility:${t.key}`)).toBe(true);
    const grown = F.map.solids.filter(([i, j]) => !F.map.read.things.some((t) => { const q = t.q ?? t.foot; return q && (i + 0.5) * 3 > q[0] && (i + 0.5) * 3 < q[2] && (j + 0.5) * 3 > q[1] && (j + 0.5) * 3 < q[3]; }));
    if (grown.length) expect(groups.has('facility:container')).toBe(true);
    // (the colliders are the grid's, as the laws measured the map, and a mast's)
    expect(G.colliders.length).toBeGreaterThanOrEqual(F.map.solids.length);
    expect(facilityGround(F.map, { hour: 'night', weather: 'rain' })).toEqual(G);
  }, 120000);
  it('a night is dark and lit where a flood stands, the floods over the map\'s prizes; by day none stands lit', () => {
    const N = facilityGround(F.map, { hour: 'night' }), D = facilityGround(F.map, { hour: 'noon' });
    expect(N.night).toBe(true);
    expect(D.night).toBe(false);
    expect(D.floods).toEqual([]);
    expect(N.floods.length).toBeGreaterThan(0);
    expect(N.floods.length).toBeLessThanOrEqual(FACILITY.flood.most);
    expect(N.form.room.reflect.floods).toEqual(N.floods);
    expect(N.form.room.lights.filter((l) => l.radius < 1e8)).toHaveLength(N.floods.length);
    // (each over a prize of the map's own measures, in its cell)
    const prizes = mapLaws(F.map).furnished.items.map((x) => x.at);
    for (const l of N.floods) expect(prizes.some((c) => Math.floor(l.at[0] / 3) === c[0] && Math.floor(l.at[1] / 3) === c[1])).toBe(true);
    // (the slab: darker by night than by day, and by night brighter under a flood than far from every one)
    const slab = (G) => G.faces.filter((f) => f.group === 'facility:apron'), dist = (f) => Math.min(...N.floods.map((l) => Math.hypot(l.at[0] - mid(f)[0], l.at[1] - mid(f)[1])));
    const nS = slab(N), near = nS.reduce((a, b) => (dist(a) < dist(b) ? a : b)), far = nS.reduce((a, b) => (dist(a) > dist(b) ? a : b));
    expect(meanLight(near)).toBeGreaterThan(meanLight(far));
    const mean = (xs) => xs.reduce((s, f) => s + meanLight(f), 0) / xs.length;
    expect(mean(nS)).toBeLessThan(mean(slab(D)));
    // (a paint's base is the day's: the same colour under either hour, only its light differs)
    expect(nS[0].fill).toBe(slab(D)[0].fill);
  }, 120000);
  it('is wet where it rains and dry where it does not, and hands the form render its surfaces', () => {
    expect(facilityGround(F.map, { weather: 'rain' }).form.room.reflect.wet).toMatchObject({ rain: 1 });
    const dry = facilityGround(F.map, {});
    expect(dry.wet).toBe(false);
    expect(dry.form.room.reflect.wet).toBeUndefined();
    expect(Object.keys(dry.form.room.reflect.surfaces)).toContain('facility:apron');
  }, 120000);
  it('a map with no thing of a place is no facility', () => {
    expect(isFacility(growArenaMap({ template: 'courtyard', seed: 1, passes: 1 }).map)).toBe(false);
  });
});
