import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { ISEKAI_STYLES } from './isekai.js';
import { SWATCHES } from './style/swatches.js';
import { sunDir } from './sun.js';
import { hexRgb } from './geom.js';

// the alien-night kit: the isekai grammar with other numbers, and the night (era/style/alien-night.js, era/isekai.js)
const ST = ISEKAI_STYLES['alien-night'];
const built = new Map();
const stage = (m) => { const k = JSON.stringify(m); return built.get(k) || built.set(k, assembleStageScene({ kind: 'stage', kit: 'alien-night', ...m })).get(k); };
const mean = (cs) => cs.reduce((a, p) => [a[0] + p[0] / cs.length, a[1] + p[1] / cs.length, a[2] + p[2] / cs.length], [0, 0, 0]);
const stopOf = (ramp, hex) => { const c = hexRgb(hex).map((v) => v * 255); return ramp.reduce((b, s, j) => (Math.hypot(...s.map((v, q) => v - c[q])) < Math.hypot(...ramp[b].map((v, q) => v - c[q])) ? j : b), 0); };

describe('alien-night', () => {
  it('reads its colours from the swatches and is the meadow\'s grammar with other numbers', () => {
    expect(ST.palette).toBe(SWATCHES['alien-night'].land);
    expect(ST.sun).toBeNull();
    expect(ST.cumulus).toBeNull();
  });

  it('the sky is night: stars, the moon drawn where the key light comes from, a pale world where the card hangs it', () => {
    const p = stage({ seed: 5 }), { sky } = p, key = sunDir(ST.light.key.elevation, ST.light.key.azimuth);
    expect(sky).toMatchObject({ day: ST.night.day, stars: 1 });
    // the dome's front-sky projection, inverted: u, h back to the key's direction
    const az = -Math.PI / 2 + (sky.moon.u - 0.5) * Math.PI, el = sky.moon.h * (Math.PI / 2);
    expect(Math.cos(el) * Math.cos(az)).toBeCloseTo(key[0], 3);
    expect(Math.cos(el) * Math.sin(az)).toBeCloseTo(key[1], 3);
    expect(sky.sun.dir).toEqual(sunDir(ST.night.planet.elevation, ST.night.planet.azimuth).map((v) => Math.round(v * 1e5) / 1e5));
    expect(sky.zenith).toEqual(ST.palette.sky[0]);
  }, 60000);

  it('the lanterns glow: self-lit crowns high on their ramp, a few with halos, and their light pooled on the ground', () => {
    const p = stage({ seed: 5 });
    const crowns = p.faces.filter((f) => f.group === 'isekai:crown');
    expect(crowns.length).toBeGreaterThan(100);
    expect(crowns.every((f) => f.emissive && f.emissiveStrength === ST.glow.emissive['isekai:crown'])).toBe(true);
    expect(crowns.every((f) => stopOf(ST.palette.foliage, f.fill) >= ST.glow.lift)).toBe(true);
    const halos = p.faces.filter((f) => f.glow);
    expect(halos.length).toBeGreaterThan(0);
    expect(halos.length).toBeLessThanOrEqual(ST.glow.halos);
    expect(p.glow).toBe(true);
    // the ground under a lantern sits higher on its ramp than the ground far from every lantern
    const lights = crowns.map((f) => mean(f.corners));
    const near = [], far = [];
    for (const f of p.faces.filter((q) => q.group === 'isekai:ground' && !q.texture)) {
      const c = mean(f.corners), d = Math.min(...lights.map((l) => Math.hypot(l[0] - c[0], l[1] - c[1])));
      (d < 2.5 ? near : d > 14 ? far : []).push(stopOf(ST.palette.grass, f.fill));
    }
    const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(near.length).toBeGreaterThan(20);
    expect(avg(near)).toBeGreaterThan(avg(far) + 0.5);
  }, 60000);

  it('a trail through it holds every law, its stream glows, and a kit without a night or a glow is untouched', () => {
    const p = stage({ seed: 5, trail: { id: 'crater', heartbeat: 0.9, bumpiness: 0.8, beats: ['crossing', 'landmark', 'pocket', 'reveal'] } });
    expect(p.outTrail.laws.filter((l) => !l.ok)).toEqual([]);
    expect(p.faces.filter((f) => f.group === 'trail:water').every((f) => f.fill === ST.water.fill)).toBe(true);
    const m = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed: 2 });
    expect(m.sky).toMatchObject({ day: 1, stars: 0 });
    expect(m.glow).toBe(false);
    expect(m.faces.some((f) => f.emissive)).toBe(false);
  }, 60000);
});
