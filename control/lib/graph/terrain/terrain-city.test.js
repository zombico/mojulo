/**
 * Cities on terrain. Claims under test: the ground a city cannot build on is reserved before its streets (empty
 * blocks), and nothing stands on it; the terrain under the built city IS its datum, and past the city the ground is
 * the natural field's; every mass stands at the datum where its front door meets the street, with a plinth exactly
 * when the ground falls away more than 0.3 m, down to the lowest ground under it; towers keep to the flat; a sprawl
 * keeps full detail near its core and massing beyond, with its whole ground plan painted on the grade layer; the page
 * carries the grade layer, its paint and the pins, and computes the same ground; a world without cities carries none
 * of it; the manifest teaches.
 */
import { describe, expect, it } from 'vitest';

import { terrainField, gradedField } from './terrain-field.js';
import { terrainKernel } from './terrain-kernel.js';
import { prepareCity, seatCity, validateTerrainCities, cityLight } from './terrain-city.js';
import { assembleTerrainWorld } from './terrain-world.js';
import { terrainChannelScript } from '../scene/channels/terrain-lod.js';

const SCARP = { heartbeat: 'gentle-roughness', splatch: 'verdure-trio', seed: 'scarp', landform: [{ op: 'scarp', path: [[-16, -5], [-6, -9], [2, -7], [9, -11], [16, -9]], throw: 4.5, side: 'right', rough: 0.02, taper: 0.1 }, { op: 'strata', thickness: 0.6 }, { op: 'talus', retreat: 0.4, scree: 0.12 }] };
const TOWN = { profile: 'town', seed: 5, at: [60, 420], size: [360, 300] };
const HILLS = { heartbeat: 'gentle-pulse', splatch: 'verdure-trio', seed: 'metro' };

function city(from, spec) {
  const natural = terrainField({ from }); const prep = prepareCity(natural, spec);
  const field = gradedField(natural, [prep.grade.layer]);
  return { natural, prep, field, ...seatCity(prep, field, { light: cityLight(field) }) };
}
const inRect = (r, u, v) => u > r.x && u < r.x + r.w && v > r.y && v < r.y + r.d;

describe('a town at the foot of an escarpment', () => {
  const T = city(SCARP, TOWN);
  it('reserves the cliff and its talus before the streets: empty blocks, and nothing built or standing on them', () => {
    expect(T.prep.grade.stats.buildable).toBeGreaterThan(0.2); expect(T.prep.grade.stats.buildable).toBeLessThan(0.9);
    expect(T.prep.reservedRects.length).toBeGreaterThan(3);
    expect(T.plan.stats.blocksLaid.filter((b) => b.use === 'empty')).toHaveLength(T.prep.reservedRects.length);
    const R = T.prep.reservedRects.map((r) => ({ x: r.x + 0.3, y: r.y + 0.3, w: r.w - 0.6, d: r.d - 0.6 }));
    for (const s of T.seats) expect(R.some((r) => inRect(r, s.x + s.w / 2, s.y + s.d / 2))).toBe(false);
    for (const b of T.plan.boxes) expect(R.some((r) => inRect(r, b.x + b.w / 2, b.y + b.d / 2))).toBe(false);
    expect(T.seats.length).toBeGreaterThan(50);
  });
  it('the terrain under the built city is its datum; past the city it is the natural ground', () => {
    const L = T.prep.grade.layer; let onDatum = 0;
    for (let j = 0; j < L.ny; j += 3) for (let i = 0; i < L.nx; i += 3) {
      const k = j * L.nx + i; if (L.w[k] !== 255) continue;
      const X = L.x0 + i * L.dx, Y = L.y0 + j * L.dx;
      expect(T.field.heightAt(X, Y)).toBeCloseTo(L.dMin + L.dStep * L.dq[k], 9); onDatum++;
    }
    expect(onDatum).toBeGreaterThan(50);
    for (const [X, Y] of [[-900, -900], [900, 1300], [60, -600], [L.x0 - 5, L.y0 - 5]]) expect(T.field.heightAt(X, Y)).toBe(T.natural.heightAt(X, Y));
  });
  it('every mass stands at the datum at its front door; a plinth exactly when the ground falls 0.3 m, down to the lowest ground', () => {
    const mpu = T.prep.mpu, G = (u, v) => T.field.heightAt(T.prep.rect.x0 + u * mpu, T.prep.rect.y0 + v * mpu);
    let plinths = 0, fronted = 0;
    for (const s of T.seats) {
      expect(s.seat).toBe(G(s.at[0], s.at[1]) - 0.12);
      if (s.front) { fronted++; expect(s.at[0] === s.x || s.at[0] === s.x + s.w || s.at[1] === s.y || s.at[1] === s.y + s.d).toBe(true); }
      let low = Infinity; for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5], [0.5, 0.5]]) low = Math.min(low, G(s.x + a * s.w, s.y + c * s.d));
      expect(s.low).toBe(low); expect(s.plinth).toBe(s.seat - low > 0.3); if (s.plinth) plinths++;
    }
    expect(plinths).toBeGreaterThan(0); expect(fronted / T.seats.length).toBeGreaterThan(0.5);   // the houses turn to their streets too
  });
  it('its streets on the built ground are measured; the street bookmark stands on the ground in town', () => {
    expect(T.stats.streets.lengthM).toBeGreaterThan(1000); expect(T.stats.streets.maxGrade).toBeLessThan(0.5);
    expect(T.walk.z).toBe(T.field.heightAt(...T.walk.at));
  });
});

describe('a metro on a hill', () => {
  const M = city(HILLS, { profile: 'metro', seed: 3, at: [-545, -920] });
  it('keeps its towers to the flat: over 15 % no more than 4 floors, over 8 % no more than 6', () => {
    const mpu = M.prep.mpu, G = (u, v) => M.field.heightAt(M.prep.rect.x0 + u * mpu, M.prep.rect.y0 + v * mpu), e = 1;
    const slope = (u, v) => Math.hypot(G(u + e, v) - G(u - e, v), G(u, v + e) - G(u, v - e)) / (2 * e * mpu);
    expect(M.stats.capped).toBeGreaterThan(0);
    for (const s of M.seats) {
      if (s.kind === 'anchor' || s.floors === null) continue;
      const g = slope(s.x + s.w / 2, s.y + s.d / 2);
      if (g > 0.15) expect(s.floors).toBeLessThanOrEqual(4); else if (g > 0.08) expect(s.floors).toBeLessThanOrEqual(6);
    }
  });
});

describe('sprawl: the whole city planned once, detail near its core, massing beyond', () => {
  const S = city(HILLS, { profile: 'metro', seed: 11, at: [-300, -700], size: [1000, 700], detail: { radius: 150 } });
  it('masses past the radius are the planner\'s massing prune, the ones inside it are full', () => {
    const c = S.plan.core, r = 150 / S.prep.mpu; let far = 0;
    for (const s of S.seats) {
      const d = Math.hypot(s.x + s.w / 2 - c.cx, s.y + s.d / 2 - c.cy);
      if (d > r) { expect(s.lod).toBe('mass'); far++; } else expect(s.lod).toBe(null);
    }
    expect(far).toBeGreaterThan(200); expect(S.seats.length).toBe(S.plan.stats.buildings);
    expect(S.stats.detail.pruned.faces).toBeGreaterThan(10000);
  });
  it('its whole ground plan is painted on the grade layer, and only the core is draped', () => {
    const P = S.prep.grade.layer.paint; let on = 0; for (let k = 3; k < P.pc.length; k += 4) if (P.pc[k]) on++;
    expect(on / (P.nx * P.ny)).toBeGreaterThan(0.2);                  // streets, walks, lots and lawns; not under the buildings
    const [x0, x1, y0, y1] = S.pin; expect(x1 - x0).toBeLessThan(420); expect(y1 - y0).toBeLessThan(420);
  });
});

describe('in the world and on the page', () => {
  const M = { kind: 'terrain', from: SCARP, cities: [TOWN] };
  const live = assembleTerrainWorld(M, { live: true });
  it('the page carries the grade layer, its paint and a pin; the walk starts in town; the bookmarks look at it', () => {
    const K = live.terrain.K; expect(K.grade).toHaveLength(1); expect(typeof K.grade[0].dq).toBe('string'); expect(typeof K.grade[0].paint.pc).toBe('string');
    expect(live.terrain.pins).toHaveLength(1);
    expect(live.cameras.map((c) => c.name)).toEqual(['ground', 'aerial', 'world', 'city', 'city-aerial']);
    expect(live.faces.length).toBeGreaterThan(10000); expect(live.faces.every((f) => f.group === (f.metal ? 'city:metal' : 'city'))).toBe(true);   // the kit's metal rides its own group
    expect(live.meta.cities[0].masses).toBeGreaterThan(50);
    expect(() => new Function('THREE', 'scene', 'camera', 'walkColliders', terrainChannelScript(live.terrain))).not.toThrow();   // eslint-disable-line no-new-func
  });
  it('the page computes the same ground from what it carries', () => {
    const K = live.terrain.K, dec = (b, T) => { const u = Buffer.from(b, 'base64'); return new T(u.buffer, u.byteOffset, u.byteLength / T.BYTES_PER_ELEMENT); };
    const page = terrainKernel({ ...K, hq: dec(K.grids.hq, Uint16Array), hard: dec(K.grids.hard, Uint8Array), apron: dec(K.grids.apron, Uint8Array), grade: K.grade.map((L) => ({ ...L, dq: dec(L.dq, Uint16Array), w: dec(L.w, Uint8Array), paint: { ...L.paint, pc: dec(L.paint.pc, Uint8Array) } })) });
    const nat = terrainField({ from: SCARP }), prep = prepareCity(nat, TOWN), srv = gradedField(nat, [prep.grade.layer]);
    seatCity(prep, srv, { light: cityLight(srv) });
    for (const [X, Y] of [[60, 420], [0, 350], [150, 500], [-80, 300], [700, 900]]) {
      const z = srv.heightAt(X, Y); expect(page.heightAt(X, Y)).toBe(z);
      expect(page.colorAt(X, Y, z, [0, 0, 1])).toEqual(srv.colorAt(X, Y, z, [0, 0, 1]));
    }
  });
  it('a world without cities carries none of it', () => {
    const p = assembleTerrainWorld({ kind: 'terrain', from: SCARP }, { live: true });
    expect(p.terrain.K.grade).toBeUndefined(); expect(p.terrain.pins).toBeUndefined(); expect(p.faces).toEqual([]);
    expect(p.meta.cities).toBeUndefined(); expect(p.cameras.map((c) => c.name)).toEqual(['ground', 'aerial', 'world']);
  });
  it('exports get fine ground under the city and the city itself', () => {
    const { faces } = assembleTerrainWorld(M);
    expect(faces.some((f) => f.group === 'terrain-bake')).toBe(true); expect(faces.some((f) => f.group === 'city')).toBe(true);
  });
});

describe('validation teaches', () => {
  it('names the mistake', () => {
    expect(validateTerrainCities([TOWN, { ref: 'sk_city' }, {}])).toEqual([]);
    const e = (c) => validateTerrainCities([c]).join(' ');
    expect(e({ at: [1] })).toMatch(/at must be \[x, y\] in metres/);
    expect(e({ size: 10 })).toMatch(/size must be metres \(60–4000\)/);
    expect(e({ profile: 'canal' })).toMatch(/profile must be one of city, town, metro/);
    expect(e({ grade: { max: 0.9 } })).toMatch(/grade.max must be a slope/);
    expect(e({ detail: 3 })).toMatch(/detail must be \{ radius \}/);
    expect(validateTerrainCities('x').join(' ')).toMatch(/must be a list/);
  });
});
