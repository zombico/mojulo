import { describe, it, expect } from 'vitest';
import { frontageTemplates, frontsOf, wallsOf, FACINGS, FRONTAGE } from './frontage.js';
import { mulberry32 } from '../city/plan/dice.js';

const L = { toLight: [0.4, -0.5, 0.75], ambient: 0.4, diffuse: 0.6 };
const FRAMES = ['#efe9dd', '#4a5547'];
const palette = { frame: [FRAMES[0]], shop: ['#1f3a2c', '#262626'], sign: ['#b8322a', '#f2c14e'], awning: ['#9c2b27'], door: ['#5a3a22'], rail: ['#2b2b2b'] };
const dress = (ground, extra = {}, wall = { facing: 's', a: [0, 0], L: 34, z0: 10 }) => frontsOf(wall, { storeys: 6, floorH: 3, use: 'residential', ground, palette, frames: FRAMES, ...extra }, mulberry32(3));
const count = (fs, re) => fs.filter((f) => re.test(f.key)).length;

describe('the metro\'s frontage: windows, storefronts, entries, lobbies, balconies', () => {
  const T = frontageTemplates(L, { frames: FRAMES });

  it('bakes every piece each way a wall faces, a window once a frame\'s paint, alone and in its block', () => {
    for (const f of Object.keys(FACINGS)) {
      for (const k of ['shop-glass', 'shop-frame', 'shop-sign', 'awning-awning', 'entry-door', 'entry-stone', 'entry-canopy', 'lobby-glass', 'balcony-slab', 'balcony-rail', 'band-band', 'win-unit0x11', 'win-unit1x42']) expect(T[`${k}:${f}`]?.length).toBeGreaterThan(0);
      // (a block is its windows over its bays and storeys)
      expect(T[`win-unit0x42:${f}`].length).toBe(8 * T[`win-unit0x11:${f}`].length);
    }
    // (a piece stands proud of its wall, on its outside)
    for (const c of T['shop-sign:s'].flatMap((x) => x.corners)) expect(c[1]).toBeLessThanOrEqual(1e-9);
    for (const c of T['shop-sign:e'].flatMap((x) => x.corners)) expect(c[0]).toBeGreaterThanOrEqual(-1e-9);
  });

  it('lays a shopping street\'s ground floor in storefronts, its windows over them in blocks and singles, each cell once', () => {
    const fs = dress('shops'), nb = Math.floor(34 / FRONTAGE.bay.residential);
    const shops = count(fs, /^shop-sign/), blocks = count(fs, /^win-unit\dx42/), singles = count(fs, /^win-unit\dx11/);
    expect(shops).toBe(Math.floor(34 / FRONTAGE.shop.least));
    expect(blocks * 8 + singles).toBe(5 * nb);
    expect(count(fs, /^awning/)).toBeLessThanOrEqual(shops);
    // (each shop its own sign's tint, a band over them, a cornice on top)
    expect(fs.filter((f) => /^shop-sign/.test(f.key)).every((f) => f.tint?.length === 3)).toBe(true);
    expect(count(fs, /^band/)).toBe(2);
    // (every piece on its wall, along it, from its foot up)
    for (const f of fs) { expect(f.pos[1]).toBeCloseTo(0, 6); expect(f.pos[0]).toBeGreaterThanOrEqual(0); expect(f.pos[0]).toBeLessThanOrEqual(34); expect(f.pos[2]).toBeGreaterThanOrEqual(10); }
  });

  it('lays a residential street\'s entries among its ground floor\'s windows, an office\'s lobby among its shops', () => {
    const fs = dress('entries'), nb = Math.floor(34 / FRONTAGE.bay.residential), ne = Math.round(34 / FRONTAGE.entry.every);
    expect(count(fs, /^entry-door/)).toBe(ne);
    expect(count(fs, /^win-unit\dx42/) * 8 + count(fs, /^win-unit\dx11/)).toBe(6 * nb - ne);
    const of = dress('lobby', { use: 'office' });
    expect(count(of, /^lobby-glass/)).toBe(1);
    expect(count(of, /^shop-sign/)).toBeGreaterThan(0);
  });

  it('dresses only a ground floor where a facade is another\'s, stood proud of its piers; nothing on a wall too short', () => {
    const fs = dress('shops', { windows: false }, { facing: 'n', a: [34, 0], L: 34, z0: 0, out: 0.35 });
    expect(count(fs, /^win|^band-band/) - 1).toBe(0);   // (its band over its shops alone)
    for (const f of fs) expect(f.pos[1]).toBeCloseTo(0.35, 6);
    expect(dress('shops', {}, { facing: 's', a: [0, 0], L: 2, z0: 0 })).toEqual([]);
    expect(JSON.stringify(dress('entries'))).toBe(JSON.stringify(dress('entries')));
    expect(wallsOf([0, 0, 10, 4])).toEqual({ s: { a: [0, 0], L: 10 }, n: { a: [10, 4], L: 10 }, e: { a: [10, 0], L: 4 }, w: { a: [0, 4], L: 4 } });
  });
});
