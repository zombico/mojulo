import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { assembleCityScene, cityBoxes } from './scene.js';
import { withCityRef, withSiteEdifices } from './ref.js';
import { landmarkSize, LANDMARK_IDS, SACRED } from './landmarks.js';
import { readCity } from './read.js';
import { segmentLevel } from './level.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

const MUSEUM = { kind: 'edifice', seed: 2, entrance: 'hall',
  masses: [{ id: 'hall', footprint: { w: 160, d: 90 }, floors: 4, at: [0, 0], facade: { material: 'concrete', rhythm: 'pier', glass: '#5f7d8c', frame: '#e8e0d0' }, roof: 'modern-shed', interior: { kernel: 'open' } },
    { id: 'tower', footprint: { w: 50, d: 50 }, floors: 14, on: { anchor: 'hall', side: 'E', align: 'center', gap: 0 }, facade: { material: 'glass', rhythm: 'curtain', glass: '#4f6f86', frame: '#c9ced4' }, roof: 'flat', interior: { kernel: 'open' } }] };
const store = { sk_museum: MUSEUM, sk_room: { kind: 'stage' } };
const get = (r) => store[r];
const recipe = (sites, rec = {}) => ({ kind: 'city', ...inferCity({ seed: 6, grammar: 'paris', board: { cols: 12, rows: 9 }, cars: false, sites, ...rec }).recipe });
const inside = (m, r) => m.x0 >= r.x0 - 1e-6 && m.x1 <= r.x1 + 1e-6 && m.y0 >= r.y0 - 1e-6 && m.y1 <= r.y1 + 1e-6;

describe('a site stands a landmark of the library at its real size', () => {
  const d = designCity(recipe([{ at: 'E4:G6', use: 'landmark', landmark: 'eiffel' }, { at: 'J2', use: 'landmark', landmark: 'big-ben' }]));
  const [eiffel, ben] = d.sites;
  it('inside its site, a forecourt round it, scaled down only when it must be (and the law says so)', () => {
    for (const s of d.sites) expect(inside(s.mass, s.rect)).toBe(true);
    expect(eiffel.mass).toMatchObject({ landmark: 'eiffel-tower' });
    // the Eiffel Tower is 330 m to its tip: on a 150 m site, shrunk, and said
    expect(eiffel.mass.h).toBeCloseTo(330 * eiffel.mass.scale, 0);
    expect(eiffel.mass.scale).toBeLessThan(1);
    expect(d.laws.find((l) => l.id === 'landmark-fits').findings.map((f) => f.at)).toContain(eiffel.id);
    expect(ben.mass.h).toBeCloseTo(landmarkSize('big-ben').h * ben.mass.scale, 0);
  });
  it('is drawn by the library, from a box named for it', () => {
    const b = cityBoxes(d).find((x) => x.site === eiffel.id);
    expect(b).toMatchObject({ shape: 'eiffel-tower', class: 'landmark', metro: true });
    expect(b.z1 * U).toBeCloseTo(eiffel.mass.h, 0);
    const s = assembleCityScene(recipe([{ at: 'E4:G6', use: 'landmark', landmark: 'eiffel' }]));
    // the ground stays under the streets: laid first, so the World lifts the landmark's plinth over it, not it over them
    expect(s.faces.findIndex((f) => f.group === 'city:ground')).toBe(0);
  });
  it('every landmark the card names is laid', () => {
    for (const id of LANDMARK_IDS) expect(() => landmarkSize(id)).not.toThrow();
  });
});

describe('a civic site stands a sacred or civic building', () => {
  it('in its variant, named or read off its id, at the library\'s height', () => {
    const d = designCity(recipe([{ at: 'C7', use: 'civic', building: 'church', variant: 'basilica' }, { at: 'J7', use: 'civic', building: 'mosque' }]));
    expect(d.sites[0].mass).toMatchObject({ building: 'church', variant: 'basilica' });
    expect(SACRED.mosque.variants).toContain(d.sites[1].mass.variant);
    const boxes = cityBoxes(d);
    expect(boxes.find((x) => x.site === d.sites[0].id)).toMatchObject({ shape: 'church', class: 'religious', churchVariant: 'basilica', metro: true });
    expect(boxes.find((x) => x.site === d.sites[1].id).mosqueVariant).toBe(d.sites[1].mass.variant);
  });
});

describe('a site stands an edifice of your own, by ref', () => {
  const m = recipe([{ at: 'J2:K3', use: 'landmark', from: 'sk_museum', name: 'the museum' }]);
  it('read by ref at its true scale, seated in its site', () => {
    const d = designCity(withSiteEdifices(m, get)), s = d.sites[0];
    expect(s.mass).toMatchObject({ from: 'sk_museum' });
    expect(inside(s.mass, s.rect)).toBe(true);
    // 14 storeys of 11 ft, at the scale it was seated at
    expect(s.mass.h).toBeCloseTo(14 * 11 * 0.3048 * s.mass.scale, 0);
    const scene = assembleCityScene(withSiteEdifices(m, get));
    const mine = scene.faces.filter((f) => f.inset === 'sk_museum');
    expect(mine.length).toBeGreaterThan(50);
    const xs = mine.flatMap((f) => f.corners.map((p) => p[0] * U));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(s.mass.x0 - 0.5);
    expect(Math.max(...xs)).toBeLessThanOrEqual(s.mass.x1 + 0.5);
  });
  it('unread (no store at hand), it stands as a massing and the law says so; a ref that is not an edifice is refused', () => {
    const d = designCity(m);
    expect(d.sites[0].mass.unread).toBe(true);
    expect(readCity(m).design.laws.find((l) => l.id === 'landmark-fits').findings[0].detail).toMatch(/not read here/);
    expect(() => withSiteEdifices(recipe([{ at: 'J2', use: 'landmark', from: 'sk_room' }]), get)).toThrow(/a 'stage': a site stands an edifice/);
    expect(() => withSiteEdifices(recipe([{ at: 'J2', use: 'landmark', from: 'sk_none' }]), get)).toThrow(/no sketch with that ref/);
  });
  it('a segment level reads its city\'s edifices through the city', () => {
    const base = { ...recipe([{ at: 'J2:K3', use: 'landmark', from: 'sk_museum' }]), segments: { across: [180, 360] } };
    const lv = withCityRef({ kind: 'city', city: 'sk_c', level: { segment: 'r1c1' } }, (r) => (r === 'sk_c' ? base : get(r)));
    expect(lv.edifices.sk_museum).toBe(MUSEUM);
    const d = designCity(lv), seg = d.segments.find((x) => x.sites.includes(d.sites[0].id));
    if (seg) expect(segmentLevel(d, seg.id).colliders.some((c) => c.of === `site:${d.sites[0].id}`)).toBe(true);
  });
});

describe('the card refuses what a site cannot stand', () => {
  it.each([
    [{ at: 'B2', use: 'plaza', landmark: 'eiffel' }, /landmark stands on a landmark site/],
    [{ at: 'B2', use: 'landmark', landmark: 'eiffel', height: 100 }, /stands at its real height/],
    [{ at: 'B2', use: 'landmark', building: 'church' }, /building stands on a civic site/],
    [{ at: 'B2', use: 'civic', building: 'castle' }, /building is one of church, mosque, temple, rotunda/],
    [{ at: 'B2', use: 'civic', variant: 'onion' }, /variant is a building's/],
    [{ at: 'B2', use: 'landmark', landmark: 'eiffel', from: 'sk_x' }, /a site stands one thing/],
  ])('%j', (site, msg) => expect(() => readCityPlan({ sites: [site] })).toThrow(msg));
});
