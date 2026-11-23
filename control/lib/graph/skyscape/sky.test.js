import { describe, it, expect } from 'vitest';
import { flightSky, readSkyAsk, sunAt, seaOf, FLIGHT_SKIES, FLIGHT_SKY_IDS, DEFAULT_HOUR } from './sky.js';
import { planMap } from './map.js';
import { assembleAirspace, airspaceOf, validateAirspace } from './airspace.js';
import { terrainChannelScript } from '../scene/channels/terrain-lod.js';

const map = planMap({ craft: 'trainer' });

describe('the flight sky', () => {
  it('reads its ask in the geocube\'s weather words, and says what it cannot fly', () => {
    expect(FLIGHT_SKY_IDS).toEqual(['clear', 'fair', 'high', 'haze', 'overcast', 'storm']);
    expect(readSkyAsk('fair')).toEqual([]);
    expect(readSkyAsk({ kind: 'storm', cover: 0.3, hour: 17, wind: { from: 270, speed: 20 } })).toEqual([]);
    expect(readSkyAsk('drizzle').join()).toMatch(/one of/);
    expect(readSkyAsk({ hour: 25 }).join()).toMatch(/hour/);
    expect(readSkyAsk({ wind: { speed: 80 } }).join()).toMatch(/wind/);
    expect(validateAirspace({ kind: 'airspace', sky: { fog: 1 } }).join()).toMatch(/fog/);
    expect(validateAirspace({ kind: 'airspace', map: { form: 'void' }, sky: 'fair' }).join()).toMatch(/space has no weather/);
  });

  it('puts the sun where the hour does: east in the morning, south at noon, low and warm late', () => {
    const m = sunAt(9), n = sunAt(12), e = sunAt(17.5);
    expect(m.dir[0]).toBeGreaterThan(0); expect(n.dir[1]).toBeLessThan(-0.4); expect(e.dir[0]).toBeLessThan(0);
    expect(n.elev).toBeGreaterThan(m.elev); expect(e.elev).toBeLessThan(10);
    const late = flightSky({ kind: 'fair', hour: 17.5 }, { map }), noon = flightSky({ kind: 'fair', hour: 12 }, { map });
    expect(late.light.tint[2]).toBeLessThan(late.light.tint[0]);   // warm: less blue than red
    expect(noon.light.tint.every((v) => Math.abs(v - 1) < 0.01)).toBe(true);
  });

  it('lays each weather\'s layers: fair cumulus in the air, an overcast\'s closed lid, a storm\'s towers and its sea', () => {
    const fair = flightSky('fair', { map }), over = flightSky('overcast', { map }), storm = flightSky('storm', { map });
    expect(fair.clouds.length).toBeGreaterThan(50);
    for (const [x, y, base, r, h] of fair.clouds) { expect(Math.abs(x)).toBeLessThanOrEqual(fair.domain + 2000); expect(base).toBeGreaterThan(900); expect(r).toBeGreaterThan(100); expect(h).toBeGreaterThan(0); expect(y).toBeDefined(); }
    expect(over.clouds).toEqual([]); expect(over.layers[0]).toMatchObject({ type: 'deck', cover: 1 });
    expect(over.light.gain).toBeLessThan(fair.light.gain);
    expect(storm.clouds.some((c) => c[4] > 2000)).toBe(true);
    expect(storm.sea.height).toBeGreaterThan(4 * fair.sea.height);
    expect(fair.metar).toMatch(/^\d{3}\d{2}KT \d{4} FEW\d{3}$/);
    expect(over.metar).toMatch(/OVC0\d\d/);
  });

  it('raises a fully developed sea from the wind, never a wave steeper than a seventh of its length', () => {
    for (const U of [3, 8, 16]) {
      const S = seaOf([1, 0], U, 1);
      expect(S.height).toBeCloseTo(0.21 * U * U / 9.81, 1);
      for (const [dx, dy, L, A] of S.waves) { expect(Math.hypot(dx, dy)).toBeCloseTo(1, 2); expect(A).toBeLessThanOrEqual(L / 14 + 1e-9); }
    }
  });

  it('is deterministic, and its main layer takes the ask\'s cover and base', () => {
    expect(JSON.stringify(flightSky('fair', { map, seed: 3 }))).toBe(JSON.stringify(flightSky('fair', { map, seed: 3 })));
    const more = flightSky({ kind: 'fair', cover: 0.5, base: 1500 }, { map });
    expect(more.clouds.length).toBeGreaterThan(flightSky('fair', { map }).clouds.length);
    expect(more.layers[0].base).toBe(1500);
    expect(DEFAULT_HOUR).toBeGreaterThan(12);
    expect(Object.keys(FLIGHT_SKIES.storm)).toContain('layers');
  });
});

describe('the sky on an airspace map', () => {
  const M = { kind: 'airspace', map: { craft: 'trainer' }, ground: { pads: [{ kind: 'runway', at: [0.5, 0.25] }] }, seed: 2 };
  it('lights the ground by the weather\'s sun and leaves its haze thicker, never thinner', () => {
    const fair = airspaceOf(M).field, storm = airspaceOf({ ...M, sky: 'storm' }).field;
    expect(fair.K.light).toEqual(fair.sky.light.dir);
    expect(storm.K.lambert.gain).toBeLessThan(fair.K.lambert.gain);
    const a = assembleAirspace(M, { live: true }), b = assembleAirspace({ ...M, sky: 'storm' }, { live: true });
    expect(b.haze.density).toBeGreaterThan(a.haze.density);
    expect(b.meta.sky.kind).toBe('storm');
  });

  it('carries its sky and its sea to the live page, and neither to an export', () => {
    const live = assembleAirspace(M, { live: true }), src = terrainChannelScript(live.terrain);
    expect(live.terrain.sky.clouds.n).toBeGreaterThan(0);
    expect(live.terrain.ocean.waves.length).toBeGreaterThan(4);
    expect(src).toMatch(/the flight sky \(an airspace's weather\)/);
    expect(src).toMatch(/the ocean \(an airspace's sea\)/);
    const baked = assembleAirspace(M, { live: false });
    expect(baked.terrain.sky).toBeUndefined(); expect(baked.terrain.ocean).toBeUndefined();
  });

  it('a terrain page that is no airspace carries none of it', () => {
    const live = assembleAirspace(M, { live: true }), { sky: _s, ocean: _o, ...plain } = live.terrain;
    const src = terrainChannelScript(plain);
    expect(src).not.toMatch(/__mojSky|__mojOcean/);
  });
});

describe('night and lightning', () => {
  const M = { kind: 'airspace', map: { craft: 'trainer' }, ground: { pads: [{ kind: 'runway', at: [0.5, 0.25] }], country: { towns: 1, villages: 1 } }, seed: 2 };
  it('fades the day through the twilight into a moonlit night, the ground darkened and lit by the moon', () => {
    const day = flightSky({ kind: 'fair', hour: 14 }, { map }), dusk = flightSky({ kind: 'fair', hour: 18.2 }, { map }), night = flightSky({ kind: 'fair', hour: 22, moon: 0.9 }, { map });
    expect(day.night).toBe(0); expect(dusk.night).toBeGreaterThan(0); expect(dusk.night).toBeLessThan(1); expect(night.night).toBe(1);
    expect(night.light.dir).toEqual(night.moon.dir);
    expect(Math.max(...night.light.tint)).toBeLessThan(0.3);
    expect(night.colours.zenith.reduce((a, v) => a + v, 0)).toBeLessThan(60);
    expect(night.moon.phase).toBe(0.9);
    expect(readSkyAsk({ moon: 2 }).join()).toMatch(/moon/);
  });

  it('lights a storm, and only a storm unless asked', () => {
    expect(flightSky('storm', { map }).lightning).toBe(true);
    expect(flightSky('fair', { map }).lightning).toBe(false);
    expect(flightSky({ kind: 'overcast', lightning: true }, { map }).lightning).toBe(true);
    expect(readSkyAsk({ lightning: 'yes' }).join()).toMatch(/lightning/);
  });

  it('carries the night\'s lights to the page from the dusk on: the runway, the beacons, the traffic, the towns\' glow', () => {
    const day = assembleAirspace(M, { live: true }), night = assembleAirspace({ ...M, sky: { kind: 'fair', hour: 21 } }, { live: true });
    expect(day.terrain.lights).toBeUndefined();
    const L = night.terrain.lights;
    expect(L.n).toBeGreaterThan(30);
    expect(L.traffic.length).toBeGreaterThan(2);
    expect(night.terrain.sky.night).toBe(1);
    expect(night.terrain.sky.glows.length).toBe(2);
    expect(night.terrain.aerial.night).toBe(1);
    expect(night.terrain.aerial.tint.every((v) => v < 0.1)).toBe(true);
    const src = terrainChannelScript(night.terrain);
    expect(src).toMatch(/the ground's lights at night/);
    expect(terrainChannelScript(day.terrain)).not.toMatch(/__mojLights/);
    // (a runway is dark at night but for its lights: its asphalt under the night's tint)
    const pad = airspaceOf({ ...M, sky: { kind: 'fair', hour: 21 } }).field.K.grade[0];
    expect(Math.max(...pad.ramp.stops[3])).toBeLessThan(40);
  });
});
