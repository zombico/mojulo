// THE STALKER'S EYE (eye.js, the city stalker): the air planned so the street sees the district and its ring and the
// tallest roof sees out to a skyline past the plan's edge; the far ring as instances, the skyline band as cards; the
// haze thinning with height on the page; a cloud deck over a hero's district, dark by night; the city-night look.
import { describe, it, expect } from 'vitest';
import { inferCity } from './card.js';
import { designCity } from './design.js';
import { stalkerEye, skylineFaces, OPAQUE_RD, RING } from './eye.js';
import { assembleCityScene, cityFogBoxes } from './scene.js';
import { withCityLevel, CITY_HERO } from './level.js';
import { readCityLook, lookLight } from './look.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

const recipe = (extra = {}) => inferCity({ seed: 3, grammar: 'new-york', board: { cols: 12, rows: 9 }, segments: true, ...extra }).recipe;
const R = recipe(), d = designCity(R), s = d.segments[0];

describe('the stalker\'s eye: air planned from the street and the roofs', () => {
  const E = stalkerEye(d, s);
  it('sees the district and its ring from the street, the skyline band\'s outer edge from the tallest roof', () => {
    expect(E.haze.see.street).toBeCloseTo(E.rings.ring, 2);
    expect(E.rings.ring).toBeCloseTo(E.rings.near + RING, 6);
    expect(E.haze.see.roof).toBeCloseTo(E.rings.horizon[1], 0);
    expect(E.rings.horizon[0]).toBeGreaterThan(E.rings.far);
    // the law: opaque where ρ(alt) · d reaches √(−ln 0.02), ρ thinning as H / (H + alt)
    const rho = (alt) => E.haze.density * E.haze.hazeHeight / (E.haze.hazeHeight + alt);
    expect(rho(E.top) * E.haze.see.roof).toBeCloseTo(OPAQUE_RD, 2);
  });
  it('sees further from a taller roof, never less', () => {
    const tall = designCity(recipe({ lots: { [d.lots.find((l) => l.x0 >= s.rect.x0 && l.x1 <= s.rect.x1 && l.y0 >= s.rect.y0 && l.y1 <= s.rect.y1 && l.h > 0).id]: { storeys: 90 } } }));
    const T = stalkerEye(tall, tall.segments[0]);
    expect(T.top).toBeGreaterThan(E.top);
    expect(T.haze.see.street).toBeCloseTo(E.haze.see.street, 2);
  });
  it('stands its skyline band round the plan, past its edge, each card facing in, the same every read', () => {
    const a = skylineFaces(d, E, { seed: 3 }), cx = d.frame.W / 2, cy = d.frame.D / 2;
    expect(a).toEqual(skylineFaces(d, E, { seed: 3 }));
    expect(a.length).toBeGreaterThan(40);
    for (const f of a) {
      const [p, q] = f.corners, mid = [(p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy], r = Math.hypot(...mid);
      expect(r).toBeGreaterThan(E.rings.horizon[0] * 0.99);
      expect(r).toBeLessThan(E.rings.horizon[1] * 1.01);
      expect(f.normal[0] * mid[0] + f.normal[1] * mid[1]).toBeLessThan(0);
      expect(f.corners[2][2]).toBeGreaterThan(0);
    }
  });
});

describe('a hero\'s district drawn with its air', () => {
  const at = (level) => assembleCityScene({ kind: 'city', ...R, level: { segment: s.id, ...level } });
  const hero = at({ hero: {} }), walker = at({});
  it('carries the far ring as instances, the skyline band and the height its haze thins over; the walker\'s none of it', () => {
    const far = hero.repeats.filter((r) => r.group.startsWith('city:far'));
    expect(far.map((r) => r.group)).toEqual(['city:far-walls', 'city:far-roofs']);
    expect(far[0].transforms.length).toBeGreaterThan(20);
    expect(far[0].transforms.every((t) => t.scale[2] > 0)).toBe(true);
    expect(hero.faces.some((f) => f.group === 'city:skyline')).toBe(true);
    expect(hero.hazeHeight).toBeGreaterThan(0);
    expect(hero.haze.density).toBeGreaterThan(0);
    expect((walker.repeats || []).some((r) => r.group.startsWith('city:far'))).toBe(false);
    expect(walker.faces.some((f) => f.group === 'city:skyline')).toBe(false);
    expect(walker.hazeHeight).toBeUndefined();
    expect(walker.haze).toBeUndefined();
  });
  it('thins the page\'s haze with the camera\'s height only where a world asks', () => {
    const floor = { corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#445566' };
    const page = (extra) => emitThreeWorld({ faces: [floor], haze: { color: '#1a1f2b', density: 0.02 }, ...extra });
    expect(page({ hazeHeight: 25 })).toContain('scene.fog.density = __hzBase * HH / (HH + Math.max(0, cam.position.z));');
    expect(page({})).not.toContain('__hzBase');
  });
});

describe('a hero\'s district under its clouds, and the city-night look', () => {
  const lower = (extra) => withCityLevel({ kind: 'city', ...recipe(extra), level: { segment: s.id, hero: {} } }, designCity(recipe(extra)), 'x');
  it('carries a cloud deck, dark by night, unless the recipe names its own', () => {
    expect(lower({}).clouds).toEqual(CITY_HERO.clouds.day);
    expect(lower({ look: 'city-night' }).clouds).toEqual(CITY_HERO.clouds.night);
    expect(lower({ clouds: false }).clouds).toBe(false);
    expect(withCityLevel({ kind: 'city', ...R, level: { segment: s.id } }, d, 'x').clouds).toBeUndefined();
  });
  it('clips its fog to the level it is played in', () => {
    const level = cityFogBoxes({ kind: 'city', ...R, level: { segment: s.id }, game: {}, figures: {} }), whole = cityFogBoxes({ kind: 'city', ...R });
    expect(level.length).toBeGreaterThan(0);
    expect(level.length).toBeLessThan(whole.length);
    expect(whole.every((b) => b.z1 > 0 && b.w > 0 && b.d > 0)).toBe(true);
  });
  it('city-night is a night: no sun, the city lit by its windows', () => {
    const spec = readCityLook('city-night');
    expect(spec.ref.light.key).toBeNull();
    expect(lookLight(spec, null).night).toBe(true);
    expect(spec.ref.air.fog.density * U).toBeGreaterThan(0);
  });
});
